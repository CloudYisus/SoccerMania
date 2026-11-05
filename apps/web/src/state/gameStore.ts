import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createRng, hashString } from '@fu/shared';
import {
  addXp,
  afterTax,
  autoAssign,
  createCard,
  createEmptySquad,
  getFormation,
  getPack,
  marketValue,
  matchReward,
  openPack,
  placeCard,
  priceRange,
  quickSellValue,
  registerGamePlayed,
  removeFromSquad,
  resolveSale,
  squadCardIds,
  swapSlots,
  type FormationId,
  type PlayerCard,
  type PlayerInstruction,
  type Progress,
  type SlotRef,
  type Squad,
  type TeamTactics,
} from '@fu/domain';
import { allVersions, catalog, STARTER } from '../data/catalog';
import { applyResult, CUP_ROUNDS, createCup, cupPlayerName as cupName, emptyCup, normalizeCup, simulatePending, USER_ID, userFixture, type CupMatchReport, type CupState, type RivalMode } from './cup';
import { tournamentById } from './tournaments';
import { addUserPerf, closeWeek, emptyWorld, MATCHES_PER_WEEK, normalizeWorld, type TotwEntry, type WorldState } from './world';
import {
  applyUserResult,
  chooseCaptain,
  chooseFormation,
  DRAFT_FEE,
  emptyDraft,
  ensureOptions,
  normalizeDraft,
  pickPlayer,
  startDraft,
  startTournament as startDraftTournament,
  STAGE_LABEL,
  type DraftState,
} from './draft';
import { createSeason, playRound, type LeagueSeason, type PressId, type TrainingId } from './league';

export interface AiListing {
  id: string;
  versionId: string;
  price: number;
  expiresAt: number;
}
export interface MyListing {
  id: string;
  cardId: string;
  versionId: string;
  price: number;
  listedAt: number;
  resolveAt: number;
  status: 'active' | 'sold' | 'expired';
}
export interface MatchRecord {
  id: string;
  mode: 'quick' | 'division' | 'cup' | 'draft';
  opponent: string;
  goalsFor: number;
  goalsAgainst: number;
  penalties?: { for: number; against: number };
  coins: number;
  at: number;
}
export interface DivisionState {
  level: number;
  played: number;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  best: number;
  lastOutcome: 'promoted' | 'relegated' | 'stayed' | null;
  /** Rivales de la temporada: equipos mixtos o clubes reales. */
  rivals?: 'mix' | 'real';
  /** Temporada de liga en curso (clasificación, calendario, moral…). */
  season?: LeagueSeason;
}

/** Rendimiento de una carta tuya en un partido (para el Equipo de la Semana). */
export interface CardPerf {
  cardId: string;
  versionId: string;
  score: number;
  goals: number;
  assists: number;
}

export const TREATMENT_COST = 1500;

export const DIVISION_SEASON_GAMES = 7;
export const PROMOTION_POINTS = 13;
export const RELEGATION_POINTS = 5;
export { CUP_ROUNDS } from './cup';
export const CUP_ENTRY_FEE = 2500;

interface GameData {
  saveVersion: 1;
  coins: number;
  progress: Progress;
  cards: Record<string, PlayerCard>;
  cardSeq: number;
  squad: Squad;
  welcomeClaimed: boolean;
  market: { listings: AiListing[]; refreshedAt: number; seed: number };
  myListings: MyListing[];
  division: DivisionState;
  /** Estado de cada torneo (por id de torneo). */
  tournaments: Record<string, CupState>;
  challenges: Record<string, boolean>;
  history: MatchRecord[];
  /** Mundo simulado y Equipo de la Semana. */
  world: WorldState;
  /** Cartas que jugarán su versión En Forma en el próximo partido (cardId → versión). */
  inForm: Record<string, string>;
  /** Lesiones: partidos que le quedan de baja a cada carta. */
  injuries: Record<string, number>;
  /** Modo Draft (Mundial de 32 selecciones). */
  draft: DraftState;
}

export interface ActionResult {
  ok: boolean;
  message: string;
}

interface GameActions {
  placeInSlot(ref: SlotRef, cardId: string): ActionResult;
  swap(a: SlotRef, b: SlotRef): void;
  removeFromSlot(ref: SlotRef): void;
  setFormation(id: FormationId): void;
  setManager(id: string | null): void;
  setTactics(t: Partial<TeamTactics>): void;
  setInstruction(cardId: string, instruction: PlayerInstruction): void;
  autoFill(): ActionResult;
  buyPack(packId: string): { ok: boolean; message: string; cardIds: string[] };
  quickSell(cardId: string): ActionResult;
  listCard(cardId: string, price: number): ActionResult;
  cancelListing(listingId: string): void;
  processListings(now: number): MyListing[];
  buyListing(listingId: string): ActionResult;
  /** Compra una oferta encontrada con el buscador del mercado. */
  buySearchListing(versionId: string, price: number): ActionResult;
  refreshMarket(force?: boolean): void;
  recordMatch(
    r: Omit<MatchRecord, 'id' | 'at' | 'coins'> & {
      difficulty: number;
      cupReport?: CupMatchReport;
      tournamentId?: string;
      perf?: CardPerf[];
      newInjuries?: { cardId: string; matches: number }[];
      scorers?: string[];
    },
  ): { coins: number; xp: number; levelsGained: number; note?: string; totw?: TotwEntry[]; totwWeek?: number };
  draftStart(): ActionResult;
  draftCaptain(versionId: string): void;
  draftFormation(id: FormationId): void;
  draftOptions(slot: number): void;
  draftPick(slot: number, versionId: string): void;
  draftBegin(): ActionResult;
  draftAbandon(): void;
  setLeaguePlan(plan: { training?: TrainingId | null; press?: PressId | null }): void;
  treatInjury(cardId: string): ActionResult;
  startTournament(defId: string, mode: RivalMode): ActionResult;
  setDivisionRivals(r: 'mix' | 'real'): ActionResult;
  claimChallenge(id: string, reward: number): ActionResult;
  reset(): void;
}

export type GameState = GameData & GameActions;

const playerIdOf = (cards: Record<string, PlayerCard>) => (cardId: string) => catalog.versions.get(cards[cardId].versionId)!.playerId;

function newCardId(seq: number) {
  return `c${seq.toString(36)}`;
}

function generateMarket(seed: number, now: number): AiListing[] {
  const rng = createRng(seed);
  const pool = [...allVersions];
  const out: AiListing[] = [];
  for (let i = 0; i < 28 && pool.length; i++) {
    const idx = rng.int(0, pool.length - 1);
    const v = pool.splice(idx, 1)[0];
    const value = marketValue(v.rating);
    const { min, max } = priceRange(v.rating);
    const price = Math.min(max, Math.max(min, Math.round((value * rng.range(0.88, 1.32)) / 50) * 50));
    out.push({ id: `L${seed.toString(36)}-${i}`, versionId: v.id, price, expiresAt: now + rng.int(8, 60) * 60_000 });
  }
  return out.sort((a, b) => a.price - b.price);
}

function initialData(): GameData {
  const now = Date.now();
  let seq = 1;
  const cards: Record<string, PlayerCard> = {};
  const add = (versionId: string) => {
    const id = newCardId(seq++);
    cards[id] = createCard(id, versionId, 'starter', now);
    return id;
  };
  const squad = createEmptySquad(STARTER.squadName, STARTER.formationId);
  squad.starters = STARTER.lineup.map(add);
  squad.bench = STARTER.bench.map(add);
  squad.managerId = STARTER.managerId;
  STARTER.reserves.forEach(add);
  const seed = hashString(`market-${now}`);
  return {
    saveVersion: 1,
    coins: STARTER.coins,
    progress: { level: 1, xp: 0 },
    cards,
    cardSeq: seq,
    squad,
    welcomeClaimed: false,
    market: { listings: generateMarket(seed, now), refreshedAt: now, seed },
    myListings: [],
    division: { level: 10, played: 0, points: 0, wins: 0, draws: 0, losses: 0, best: 10, lastOutcome: null },
    tournaments: {},
    challenges: {},
    history: [],
    world: emptyWorld(),
    inForm: {},
    injuries: {},
    draft: emptyDraft(),
  };
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      ...initialData(),

      placeInSlot(ref, cardId) {
        const s = get();
        if (s.myListings.some((l) => l.cardId === cardId && l.status === 'active'))
          return { ok: false, message: 'La carta está en el mercado de traspasos.' };
        const r = placeCard(s.squad, ref, cardId, playerIdOf(s.cards));
        if (!r.ok) return { ok: false, message: r.error };
        set({ squad: r.value });
        return { ok: true, message: 'Plantilla actualizada' };
      },
      swap(a, b) {
        set({ squad: swapSlots(get().squad, a, b) });
      },
      removeFromSlot(ref) {
        set({ squad: removeFromSquad(get().squad, ref) });
      },
      setFormation(id) {
        set({ squad: { ...get().squad, formationId: id } });
      },
      setManager(id) {
        set({ squad: { ...get().squad, managerId: id } });
      },
      setTactics(t) {
        const squad = get().squad;
        set({ squad: { ...squad, tactics: { ...squad.tactics, ...t } } });
      },
      setInstruction(cardId, instruction) {
        const squad = get().squad;
        set({ squad: { ...squad, instructions: { ...squad.instructions, [cardId]: instruction } } });
      },
      autoFill() {
        const s = get();
        const listed = new Set(s.myListings.filter((l) => l.status === 'active').map((l) => l.cardId));
        const candidates = Object.values(s.cards)
          .filter((c) => !listed.has(c.id))
          .map((c) => {
            const v = catalog.versions.get(c.versionId)!;
            return { id: c.id, playerId: v.playerId, position: c.positionOverride ?? v.position, altPositions: v.altPositions, rating: v.rating };
          });
        const starters = autoAssign(getFormation(s.squad.formationId), candidates);
        const used = new Set(starters.filter(Boolean).map((id) => candidates.find((c) => c.id === id)!.playerId));
        const bench = candidates
          .filter((c) => !used.has(c.playerId))
          .sort((a, b) => b.rating - a.rating)
          .reduce<string[]>((acc, c) => {
            if (acc.length < 7 && !used.has(c.playerId)) {
              used.add(c.playerId);
              acc.push(c.id);
            }
            return acc;
          }, []);
        set({ squad: { ...s.squad, starters, bench: [...bench, ...Array(7 - bench.length).fill(null)] } });
        return { ok: true, message: 'Mejor once disponible colocado' };
      },

      buyPack(packId) {
        const s = get();
        const pack = getPack(packId);
        if (pack.oneTime && s.welcomeClaimed) return { ok: false, message: 'Ya has abierto este sobre.', cardIds: [] };
        if (s.coins < pack.price) return { ok: false, message: 'Monedas insuficientes.', cardIds: [] };
        const now = Date.now();
        const rng = createRng(hashString(`${packId}-${now}-${s.cardSeq}`));
        // Las cartas En Forma del Equipo de la Semana vigente también salen en sobres.
        const totw = normalizeWorld(s.world).totw.map((e) => catalog.versions.get(e.ifId)!).filter(Boolean);
        const versions = openPack(rng, pack, [...allVersions, ...totw]);
        let seq = s.cardSeq;
        const cards = { ...s.cards };
        const ids = versions.map((v) => {
          const id = newCardId(seq++);
          cards[id] = createCard(id, v.id, 'pack', now);
          return id;
        });
        set({
          cards,
          cardSeq: seq,
          coins: s.coins - pack.price,
          welcomeClaimed: s.welcomeClaimed || !!pack.oneTime,
        });
        return { ok: true, message: `${pack.name} abierto`, cardIds: ids };
      },

      quickSell(cardId) {
        const s = get();
        const card = s.cards[cardId];
        if (!card) return { ok: false, message: 'Carta inexistente.' };
        if (squadCardIds(s.squad).includes(cardId)) return { ok: false, message: 'Retira primero la carta de la plantilla.' };
        if (s.myListings.some((l) => l.cardId === cardId && l.status === 'active'))
          return { ok: false, message: 'La carta está en el mercado.' };
        const v = catalog.versions.get(card.versionId)!;
        const value = quickSellValue(v.rating);
        const cards = { ...s.cards };
        delete cards[cardId];
        set({ cards, coins: s.coins + value });
        return { ok: true, message: `Venta rápida: +${value.toLocaleString('es-ES')} monedas` };
      },

      listCard(cardId, price) {
        const s = get();
        const card = s.cards[cardId];
        if (!card) return { ok: false, message: 'Carta inexistente.' };
        if (card.untradeable) return { ok: false, message: 'Carta intransferible: sólo admite venta rápida.' };
        if (squadCardIds(s.squad).includes(cardId)) return { ok: false, message: 'Retira primero la carta de la plantilla.' };
        if (s.myListings.some((l) => l.cardId === cardId && l.status === 'active')) return { ok: false, message: 'Ya está en venta.' };
        const v = catalog.versions.get(card.versionId)!;
        const range = priceRange(v.rating);
        if (price < range.min || price > range.max)
          return { ok: false, message: `El precio debe estar entre ${range.min.toLocaleString('es-ES')} y ${range.max.toLocaleString('es-ES')}.` };
        const now = Date.now();
        const listing: MyListing = {
          id: `M${now.toString(36)}${cardId}`,
          cardId,
          versionId: card.versionId,
          price,
          listedAt: now,
          resolveAt: now + 20_000 + (hashString(cardId + now) % 25_000),
          status: 'active',
        };
        set({ myListings: [listing, ...s.myListings].slice(0, 40) });
        return { ok: true, message: 'Carta puesta en el mercado' };
      },

      cancelListing(listingId) {
        set({ myListings: get().myListings.filter((l) => l.id !== listingId || l.status !== 'active') });
      },

      processListings(now) {
        const s = get();
        const resolved: MyListing[] = [];
        let coins = s.coins;
        const cards = { ...s.cards };
        const myListings = s.myListings.map((l) => {
          if (l.status !== 'active' || now < l.resolveAt) return l;
          const v = catalog.versions.get(l.versionId)!;
          const sold = resolveSale(createRng(hashString(l.id)), l.price, marketValue(v.rating));
          const next: MyListing = { ...l, status: sold ? 'sold' : 'expired' };
          if (sold) {
            coins += afterTax(l.price);
            delete cards[l.cardId];
          }
          resolved.push(next);
          return next;
        });
        if (resolved.length) set({ myListings, coins, cards });
        return resolved;
      },

      buyListing(listingId) {
        const s = get();
        const l = s.market.listings.find((x) => x.id === listingId);
        if (!l) return { ok: false, message: 'El anuncio ya no está disponible.' };
        if (s.coins < l.price) return { ok: false, message: 'Monedas insuficientes.' };
        const now = Date.now();
        const id = newCardId(s.cardSeq);
        set({
          coins: s.coins - l.price,
          cards: { ...s.cards, [id]: createCard(id, l.versionId, 'market', now) },
          cardSeq: s.cardSeq + 1,
          market: { ...s.market, listings: s.market.listings.filter((x) => x.id !== listingId) },
        });
        return { ok: true, message: 'Fichaje completado. La carta está en tu club.' };
      },

      buySearchListing(versionId, price) {
        const s = get();
        if (!catalog.versions.has(versionId)) return { ok: false, message: 'La carta ya no está disponible.' };
        if (s.coins < price) return { ok: false, message: 'Monedas insuficientes.' };
        const id = newCardId(s.cardSeq);
        set({ coins: s.coins - price, cards: { ...s.cards, [id]: createCard(id, versionId, 'market', Date.now()) }, cardSeq: s.cardSeq + 1 });
        return { ok: true, message: 'Fichaje completado. La carta está en tu club.' };
      },

      refreshMarket(force) {
        const s = get();
        const now = Date.now();
        const stale = now - s.market.refreshedAt > 10 * 60_000;
        if (!force && !stale) {
          const listings = s.market.listings.filter((l) => l.expiresAt > now);
          if (listings.length !== s.market.listings.length) set({ market: { ...s.market, listings } });
          return;
        }
        const seed = hashString(`market-${now}`);
        set({ market: { listings: generateMarket(seed, now), refreshedAt: now, seed } });
      },

      recordMatch(r) {
        const s = get();
        const reward = matchReward(r.goalsFor, r.goalsAgainst, r.difficulty);
        const win = r.goalsFor > r.goalsAgainst || (r.penalties && r.penalties.for > r.penalties.against);
        const draw = r.goalsFor === r.goalsAgainst && !r.penalties;
        let coins = reward.coins;
        let note: string | undefined;
        let division = s.division;
        const tId = r.tournamentId ?? 'ultimate';
        let cup = s.tournaments[tId] ?? emptyCup(0, 0, tId);
        const tdef = tournamentById(tId);

        if (r.mode === 'division') {
          const d = { ...division, played: division.played + 1 };
          if (win) {
            d.wins++;
            d.points += 3;
          } else if (draw) {
            d.draws++;
            d.points += 1;
          } else d.losses++;
          const season = d.season && d.season.level === d.level ? d.season : createSeason(d.level, d.rivals ?? 'mix', 1, s.squad.name);
          const out = playRound(season, r.goalsFor, r.goalsAgainst, r.scorers ?? [], s.squad.name);
          if (out.pressCoins) coins += Math.round(reward.coins * out.pressCoins);
          if (out.ended) {
            const e = out.ended;
            coins += e.bonus;
            const label =
              e.outcome === 'champion'
                ? `¡Campeón de División 1!`
                : e.outcome === 'promoted'
                  ? `¡Ascenso a División ${e.level}!`
                  : e.outcome === 'relegated'
                    ? `Descenso a División ${e.level}`
                    : `Permanencia en División ${e.level}`;
            note = `${label} · Terminaste ${e.position}º · Bonus: ${e.bonus.toLocaleString('es-ES')}${e.topScorer ? ` · Pichichi: ${e.topScorer.name} (${e.topScorer.goals})` : ''}`;
            division = {
              level: e.level,
              played: 0,
              points: 0,
              wins: 0,
              draws: 0,
              losses: 0,
              best: Math.min(d.best, e.level),
              lastOutcome: e.outcome === 'champion' ? 'stayed' : e.outcome,
              rivals: d.rivals,
              season: out.season,
            };
          } else division = { ...d, season: out.season };
        }

        const fx = r.mode === 'cup' && cup.status === 'running' ? userFixture(cup) : undefined;
        if (fx) {
          const userHome = fx.home === USER_ID;
          const pens = r.penalties ? (userHome ? { home: r.penalties.for, away: r.penalties.against } : { home: r.penalties.against, away: r.penalties.for }) : undefined;
          const result = userHome ? { home: r.goalsFor, away: r.goalsAgainst, pens } : { home: r.goalsAgainst, away: r.goalsFor, pens };
          cup = applyResult(cup, fx.id, result, r.cupReport ?? { lines: [] });
          if (win) {
            if (fx.round >= CUP_ROUNDS.length - 1) {
              cup = { ...cup, round: null, status: 'won', titles: cup.titles + 1 };
              coins += tdef.prize;
              note = `¡Campeón de ${tdef.name}! +${tdef.prize.toLocaleString('es-ES')} monedas`;
            } else {
              // El resto de partidos de la ronda se disputan a la vez.
              cup = { ...simulatePending(cup, cupName, false), round: fx.round + 1 };
              note = `Clasificado para ${CUP_ROUNDS[fx.round + 1]}`;
            }
          } else {
            // El torneo sigue sin el usuario hasta coronar campeón.
            cup = { ...simulatePending(cup, cupName, true), round: null, status: 'eliminated' };
            note = `Eliminado de ${tdef.name}`;
          }
        }

        const { progress, levelsGained } = addXp(s.progress, reward.xp);
        const cards = { ...s.cards };
        const clubMatch = r.mode !== 'draft';
        if (clubMatch) for (const id of s.squad.starters) if (id && cards[id]) cards[id] = registerGamePlayed(cards[id]);

        // Draft: resultado en el Mundial; al terminar se cobra el premio de la ronda alcanzada.
        let draft = s.draft;
        if (r.mode === 'draft' && draft.status === 'running') {
          draft = applyUserResult(draft, r.goalsFor, r.goalsAgainst, r.cupReport ?? { lines: [] }, r.penalties);
          if (draft.status === 'won' || draft.status === 'eliminated') {
            coins += draft.prize ?? 0;
            note =
              draft.status === 'won'
                ? `¡Campeón del Mundial Draft! +${(draft.prize ?? 0).toLocaleString('es-ES')} monedas`
                : `Fin del Mundial Draft (${draft.reached === 'group' ? 'fase de grupos' : STAGE_LABEL[draft.reached as keyof typeof STAGE_LABEL]?.toLowerCase() ?? ''}). Premio: ${(draft.prize ?? 0).toLocaleString('es-ES')} monedas`;
          }
        }

        // Lesiones: cada partido descuenta uno (dos con entrenamiento de recuperación).
        const heal = r.mode === 'division' && s.division.season?.plan.training === 'recovery' ? 2 : 1;
        const injuries: Record<string, number> = {};
        for (const [id, n] of Object.entries(s.injuries)) if (n - heal > 0 && cards[id]) injuries[id] = n - heal;
        for (const i of r.newInjuries ?? []) if (cards[i.cardId]) injuries[i.cardId] = Math.max(injuries[i.cardId] ?? 0, i.matches);

        // En Forma: la versión mejorada dura un partido (el de los titulares que la usaron).
        const inForm = { ...s.inForm };
        if (clubMatch) for (const id of s.squad.starters) if (id) delete inForm[id];

        // Equipo de la Semana: la semana se cierra con cada jornada de liga o cada 3 partidos.
        let world = addUserPerf(normalizeWorld(s.world), r.perf ?? [], r.opponent, `${r.goalsFor}-${r.goalsAgainst}`);
        let totw: TotwEntry[] | undefined;
        let totwWeek: number | undefined;
        if (r.mode === 'division' || world.matchesThisWeek >= MATCHES_PER_WEEK) {
          const closed = closeWeek(world);
          world = closed.world;
          totwWeek = world.totwWeek;
          totw = closed.qualified;
          for (const q of closed.qualified) if (q.cardId && cards[q.cardId]) inForm[q.cardId] = q.ifId;
        }
        const rec: MatchRecord = {
          id: `m${Date.now().toString(36)}`,
          mode: r.mode,
          opponent: r.opponent,
          goalsFor: r.goalsFor,
          goalsAgainst: r.goalsAgainst,
          penalties: r.penalties,
          coins,
          at: Date.now(),
        };
        set({
          coins: s.coins + coins,
          progress,
          cards,
          division,
          tournaments: r.mode === 'cup' ? { ...s.tournaments, [tId]: cup } : s.tournaments,
          history: [rec, ...s.history].slice(0, 30),
          world,
          inForm,
          injuries,
          draft,
        });
        return { coins, xp: reward.xp, levelsGained, note, totw, totwWeek };
      },

      draftStart() {
        const s = get();
        if (s.draft.status === 'drafting' || s.draft.status === 'running') return { ok: false, message: 'Ya tienes un draft en curso.' };
        if (s.coins < DRAFT_FEE) return { ok: false, message: 'Monedas insuficientes para la entrada al draft.' };
        set({ coins: s.coins - DRAFT_FEE, draft: startDraft(s.draft) });
        return { ok: true, message: '¡Draft iniciado! Elige a tu capitán.' };
      },
      draftCaptain(versionId) {
        set({ draft: chooseCaptain(get().draft, versionId) });
      },
      draftFormation(id) {
        set({ draft: chooseFormation(get().draft, id) });
      },
      draftOptions(slot) {
        const d = get().draft;
        const next = ensureOptions(d, slot);
        if (next !== d) set({ draft: next });
      },
      draftPick(slot, versionId) {
        set({ draft: pickPlayer(get().draft, slot, versionId) });
      },
      draftBegin() {
        const s = get();
        const next = startDraftTournament(s.draft, s.squad.name);
        if (next === s.draft) return { ok: false, message: 'Completa los 11 puestos antes de empezar.' };
        set({ draft: next });
        return { ok: true, message: '¡Sorteo realizado! Comienza el Mundial.' };
      },
      draftAbandon() {
        set({ draft: emptyDraft(get().draft) });
      },

      setLeaguePlan(plan) {
        const s = get();
        const d = s.division;
        const season = d.season && d.season.level === d.level ? d.season : createSeason(d.level, d.rivals ?? 'mix', 1, s.squad.name);
        set({ division: { ...d, season: { ...season, plan: { ...season.plan, ...plan } } } });
      },

      treatInjury(cardId) {
        const s = get();
        const n = s.injuries[cardId];
        if (!n) return { ok: false, message: 'Este jugador no está lesionado.' };
        if (s.coins < TREATMENT_COST) return { ok: false, message: 'Monedas insuficientes para el tratamiento.' };
        const injuries = { ...s.injuries };
        if (n <= 1) delete injuries[cardId];
        else injuries[cardId] = n - 1;
        set({ coins: s.coins - TREATMENT_COST, injuries });
        return { ok: true, message: n <= 1 ? 'Tratamiento completado: ¡recuperado!' : `Tratamiento completado: le quedan ${n - 1} partidos de baja.` };
      },

      startTournament(defId, mode) {
        const s = get();
        const def = tournamentById(defId);
        const prev = normalizeCup(s.tournaments[defId], defId);
        if (prev.status === 'running') return { ok: false, message: `Ya estás compitiendo en ${def.name}.` };
        if (s.coins < def.fee) return { ok: false, message: 'Monedas insuficientes para la inscripción.' };
        const cup = createCup({ ...prev, mode }, s.squad.name, mode);
        set({ coins: s.coins - def.fee, tournaments: { ...s.tournaments, [defId]: cup } });
        return { ok: true, message: `Inscripción en ${def.name} completada. ¡Sorteo realizado!` };
      },

      setDivisionRivals(rivals) {
        const s = get();
        if (s.division.played > 0 || (s.division.season?.round ?? 0) > 0) return { ok: false, message: 'Podrás cambiar el tipo de rivales al empezar la próxima temporada.' };
        set({ division: { ...s.division, rivals, season: createSeason(s.division.level, rivals, s.division.season?.season ?? 1, s.squad.name) } });
        return { ok: true, message: rivals === 'real' ? 'Esta temporada te enfrentarás a clubes reales.' : 'Esta temporada te enfrentarás a equipos mixtos.' };
      },

      claimChallenge(id, reward) {
        const s = get();
        if (s.challenges[id]) return { ok: false, message: 'Recompensa ya reclamada.' };
        set({ challenges: { ...s.challenges, [id]: true }, coins: s.coins + reward });
        return { ok: true, message: `Desafío completado: +${reward.toLocaleString('es-ES')} monedas` };
      },

      reset() {
        set(initialData());
      },
    }),
    {
      name: 'football-ultimate-save',
      version: 1,
      // Acceso protegido: si el navegador bloquea o llena el almacenamiento, el juego sigue funcionando.
      storage: createJSONStorage(() => ({
        getItem: (k: string) => {
          try {
            return localStorage.getItem(k);
          } catch {
            return null;
          }
        },
        setItem: (k: string, v: string) => {
          try {
            localStorage.setItem(k, v);
          } catch (e) {
            console.warn('No se pudo guardar la partida', e);
          }
        },
        removeItem: (k: string) => {
          try {
            localStorage.removeItem(k);
          } catch {
            /* sin almacenamiento */
          }
        },
      })),
      partialize: (s) => {
        const { saveVersion, coins, progress, cards, cardSeq, squad, welcomeClaimed, market, myListings, division, tournaments, challenges, history, world, inForm, injuries, draft } = s;
        return { saveVersion, coins, progress, cards, cardSeq, squad, welcomeClaimed, market, myListings, division, tournaments, challenges, history, world, inForm, injuries, draft };
      },
      // Descarta partidas guardadas que referencian versiones ya inexistentes en el catálogo.
      merge: (persisted, current) => {
        const p = persisted as Partial<GameData> | undefined;
        if (!p?.cards || Object.values(p.cards).some((c) => !c || !catalog.versions.has(c.versionId))) return current;
        // Estructura mínima: una partida dañada o de otra versión no debe romper la carga.
        if (!p.squad || !Array.isArray(p.squad.starters) || !Array.isArray(p.squad.bench) || typeof p.coins !== 'number') return current;
        // Migración: la antigua copa única pasa a ser el torneo "ultimate".
        const legacy = (p as { cup?: Partial<CupState> }).cup;
        const tournaments: Record<string, CupState> = {};
        for (const [id, t] of Object.entries(p.tournaments ?? {})) tournaments[id] = normalizeCup(t, id);
        if (legacy && !tournaments.ultimate) tournaments.ultimate = normalizeCup(legacy, 'ultimate');
        const cardsOk = (m: Record<string, unknown> | undefined) => Object.fromEntries(Object.entries(m ?? {}).filter(([id]) => p.cards![id]));
        const inForm = Object.fromEntries(Object.entries(cardsOk(p.inForm)).filter(([, v]) => catalog.versions.has(v as string))) as Record<string, string>;
        // Temporada de liga de una versión anterior (sin calendario): se recrea.
        const division =
          p.division && (!p.division.season || !Array.isArray(p.division.season.fixtures))
            ? { ...p.division, season: undefined, played: 0, points: 0, wins: 0, draws: 0, losses: 0 }
            : p.division;
        return { ...current, ...p, division: division ?? current.division, tournaments, world: normalizeWorld(p.world), draft: normalizeDraft(p.draft), inForm, injuries: cardsOk(p.injuries) as Record<string, number> };
      },
    },
  ),
);
