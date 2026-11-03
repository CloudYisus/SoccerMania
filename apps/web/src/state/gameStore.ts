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
  mode: 'quick' | 'division' | 'cup';
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
}
export interface CupState {
  /** Ronda actual (0 = cuartos, 1 = semis, 2 = final). null = sin participar. */
  round: number | null;
  status: 'idle' | 'running' | 'eliminated' | 'won';
  titles: number;
}

export const DIVISION_SEASON_GAMES = 7;
export const PROMOTION_POINTS = 13;
export const RELEGATION_POINTS = 5;
export const CUP_ROUNDS = ['Cuartos de final', 'Semifinal', 'Final'] as const;
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
  cup: CupState;
  challenges: Record<string, boolean>;
  history: MatchRecord[];
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
  refreshMarket(force?: boolean): void;
  recordMatch(r: Omit<MatchRecord, 'id' | 'at' | 'coins'> & { difficulty: number }): { coins: number; xp: number; levelsGained: number; note?: string };
  startCup(): ActionResult;
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
    const value = marketValue(v.rating, v.rarity);
    const { min, max } = priceRange(v.rating, v.rarity);
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
    cup: { round: null, status: 'idle', titles: 0 },
    challenges: {},
    history: [],
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
        const versions = openPack(rng, pack, allVersions);
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
        const value = quickSellValue(v.rating, v.rarity);
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
        const range = priceRange(v.rating, v.rarity);
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
          const sold = resolveSale(createRng(hashString(l.id)), l.price, marketValue(v.rating, v.rarity));
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
        let cup = s.cup;

        if (r.mode === 'division') {
          const d = { ...division, played: division.played + 1 };
          if (win) {
            d.wins++;
            d.points += 3;
          } else if (draw) {
            d.draws++;
            d.points += 1;
          } else d.losses++;
          if (d.played >= DIVISION_SEASON_GAMES) {
            let outcome: DivisionState['lastOutcome'] = 'stayed';
            let level = d.level;
            if (d.points >= PROMOTION_POINTS && level > 1) {
              level--;
              outcome = 'promoted';
            } else if (d.points <= RELEGATION_POINTS && level < 10) {
              level++;
              outcome = 'relegated';
            }
            const seasonBonus = 2000 + (11 - d.level) * 600 + d.points * 150;
            coins += seasonBonus;
            note =
              outcome === 'promoted'
                ? `¡Ascenso a División ${level}! Bonus de temporada: ${seasonBonus.toLocaleString('es-ES')}`
                : outcome === 'relegated'
                  ? `Descenso a División ${level}. Bonus de temporada: ${seasonBonus.toLocaleString('es-ES')}`
                  : `Permanencia en División ${level}. Bonus de temporada: ${seasonBonus.toLocaleString('es-ES')}`;
            division = { level, played: 0, points: 0, wins: 0, draws: 0, losses: 0, best: Math.min(d.best, level), lastOutcome: outcome };
          } else division = d;
        }

        if (r.mode === 'cup' && cup.status === 'running' && cup.round !== null) {
          if (win) {
            if (cup.round >= CUP_ROUNDS.length - 1) {
              cup = { round: null, status: 'won', titles: cup.titles + 1 };
              coins += 25000;
              note = '¡Campeón de la Copa Ultimate! +25.000 monedas';
            } else {
              cup = { ...cup, round: cup.round + 1 };
              note = `Clasificado para ${CUP_ROUNDS[cup.round!]}`;
            }
          } else {
            cup = { ...cup, round: null, status: 'eliminated' };
            note = 'Eliminado de la Copa Ultimate';
          }
        }

        const { progress, levelsGained } = addXp(s.progress, reward.xp);
        const cards = { ...s.cards };
        for (const id of s.squad.starters) if (id && cards[id]) cards[id] = registerGamePlayed(cards[id]);
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
        set({ coins: s.coins + coins, progress, cards, division, cup, history: [rec, ...s.history].slice(0, 30) });
        return { coins, xp: reward.xp, levelsGained, note };
      },

      startCup() {
        const s = get();
        if (s.cup.status === 'running') return { ok: false, message: 'Ya estás compitiendo en la Copa.' };
        if (s.coins < CUP_ENTRY_FEE) return { ok: false, message: 'Monedas insuficientes para la inscripción.' };
        set({ coins: s.coins - CUP_ENTRY_FEE, cup: { ...s.cup, round: 0, status: 'running' } });
        return { ok: true, message: 'Inscripción completada. ¡Cuartos de final!' };
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
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => {
        const { saveVersion, coins, progress, cards, cardSeq, squad, welcomeClaimed, market, myListings, division, cup, challenges, history } = s;
        return { saveVersion, coins, progress, cards, cardSeq, squad, welcomeClaimed, market, myListings, division, cup, challenges, history };
      },
      // Descarta partidas guardadas que referencian versiones ya inexistentes en el catálogo.
      merge: (persisted, current) => {
        const p = persisted as Partial<GameData> | undefined;
        if (!p?.cards || Object.values(p.cards).some((c) => !catalog.versions.has(c.versionId))) return current;
        return { ...current, ...p };
      },
    },
  ),
);
