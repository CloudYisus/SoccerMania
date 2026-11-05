import { createRng, hashString, type Rng } from '@fu/shared';
import {
  calculateChemistry,
  CURRENT_YEAR,
  FORMATION_IDS,
  getFormation,
  POSITION_LINE,
  positionFit,
  teamRating,
  type FormationId,
  type PlayerVersion,
  type PositionLine,
} from '@fu/domain';
import { allVersions, catalog } from '../data/catalog';
import { assemble, styleTactics, type TeamBuild } from './teams';
import { roundPairs, simulateScore } from './world';
import type { CupMatchReport, CupPlayerLine } from './cup';

/**
 * MODO DRAFT · MUNDIAL
 * Como el draft de FUT: eliges capitán (entre 5), formación (entre 5 al azar) y,
 * para cada posición, 1 de 5 futbolistas aleatorios. Las opciones siguen una
 * distribución por niveles de media (no salen siempre los mejores).
 * Con ese once disputas un Mundial de 32 selecciones: 8 grupos de 4 (pasan 2),
 * octavos, cuartos, semifinal y final, con estadísticas propias.
 * Las cartas del draft no pasan a tu club: el premio son monedas según la ronda.
 */

export const DRAFT_ID = 'draft';
export const DRAFT_FEE = 3000;
export const DRAFT_OPTIONS = 5;
export const GROUP_LETTERS = 'ABCDEFGH';
export type DraftStage = 'group' | 'r16' | 'qf' | 'sf' | 'final';
export const STAGE_LABEL: Record<DraftStage, string> = { group: 'Fase de grupos', r16: 'Octavos de final', qf: 'Cuartos de final', sf: 'Semifinal', final: 'Final' };
const KO: DraftStage[] = ['r16', 'qf', 'sf', 'final'];

/** Premio según hasta dónde llegas. */
export const DRAFT_PRIZES: Record<'group' | DraftStage | 'champion', number> = { group: 1200, r16: 2800, qf: 4500, sf: 7000, final: 11000, champion: 20000 };

/**
 * Probabilidad de cada nivel de media en una opción de draft.
 * Equilibrio: lo normal son cartas 80–88; las 90+ aparecen de vez en cuando.
 */
export const DRAFT_TIERS: { min: number; max: number; p: number }[] = [
  { min: 90, max: 99, p: 0.07 },
  { min: 87, max: 89, p: 0.18 },
  { min: 84, max: 86, p: 0.31 },
  { min: 80, max: 83, p: 0.3 },
  { min: 70, max: 79, p: 0.14 },
];
const CAPTAIN_TIERS = [
  { min: 90, max: 99, p: 0.3 },
  { min: 86, max: 89, p: 0.7 },
];

export interface DraftTeam {
  id: string;
  name: string;
  shortName: string;
  colors: { primary: string; secondary: string };
  nationCode?: string;
  rating: number;
  user?: boolean;
}

export interface DraftFixture {
  id: string;
  stage: DraftStage;
  /** Grupo (0–7) en la fase de grupos. */
  group?: number;
  /** Jornada (0–2) de grupos o índice del cruce en eliminatorias. */
  round: number;
  slot: number;
  home: string;
  away: string;
  result?: { home: number; away: number; pens?: { home: number; away: number } };
  winner?: string;
}

export interface DraftState {
  status: 'idle' | 'drafting' | 'running' | 'eliminated' | 'won';
  edition: number;
  seed: number;
  /** Paso del draft. */
  step: 'captain' | 'formation' | 'players';
  captainOptions: string[];
  captain: string | null;
  formationOptions: FormationId[];
  formationId: FormationId | null;
  /** Versión elegida en cada slot de la formación. */
  slots: (string | null)[];
  /** Opciones generadas por slot (se guardan para no poder "rebarajar"). */
  options: Record<number, string[]>;
  teams: DraftTeam[];
  groups: string[][];
  fixtures: DraftFixture[];
  players: Record<string, CupPlayerLine>;
  champion?: string;
  /** Ronda máxima alcanzada por el usuario y premio cobrado. */
  reached?: DraftStage | 'champion';
  prize?: number;
  /** Historial de ediciones jugadas. */
  titles: number;
  best?: DraftStage | 'champion';
}

export const USER_DRAFT = 'user';

export function emptyDraft(prev?: Partial<DraftState>): DraftState {
  return {
    status: 'idle',
    edition: prev?.edition ?? 0,
    seed: 0,
    step: 'captain',
    captainOptions: [],
    captain: null,
    formationOptions: [],
    formationId: null,
    slots: [],
    options: {},
    teams: [],
    groups: [],
    fixtures: [],
    players: {},
    titles: prev?.titles ?? 0,
    best: prev?.best,
  };
}

export function normalizeDraft(d: Partial<DraftState> | undefined): DraftState {
  if (!d) return emptyDraft();
  const base = emptyDraft(d);
  const ok = (id: string | null | undefined) => !id || catalog.versions.has(id);
  const out = { ...base, ...d } as DraftState;
  if (!out.captainOptions.every(ok) || !out.slots.every(ok) || !Object.values(out.options).flat().every(ok) || (out.formationId && !FORMATION_IDS.includes(out.formationId)))
    return emptyDraft(d);
  return out;
}

// ───────────────────────────── Opciones del draft ─────────────────────────────

/** Pool del draft: todas las cartas coleccionables (base, temporadas, eventos, Iconos, Históricos). */
const POOL = allVersions;

function pickTier(rng: Rng, tiers: { min: number; max: number; p: number }[]) {
  return rng.weighted(tiers, (t) => t.p);
}

/** Cinco opciones para una posición, sin repetir futbolistas ya elegidos. */
export function slotOptions(rng: Rng, position: string, taken: Set<string>, n = DRAFT_OPTIONS): string[] {
  const fits = (v: PlayerVersion, natural: boolean) => {
    const f = positionFit(v.position, v.altPositions, position as never);
    return natural ? f === 'natural' : f !== 'poor';
  };
  const out: PlayerVersion[] = [];
  const used = new Set(taken);
  let elite = 0;
  for (let i = 0; i < n * 6 && out.length < n; i++) {
    let tier = pickTier(rng, DRAFT_TIERS);
    // Como mucho una carta 90+ por posición: el equilibrio importa.
    if (tier.min >= 90 && elite >= 1) tier = DRAFT_TIERS[1];
    let cands = POOL.filter((v) => v.rating >= tier.min && v.rating <= tier.max && !used.has(v.playerId) && fits(v, true));
    if (cands.length < 3) cands = POOL.filter((v) => v.rating >= tier.min && v.rating <= tier.max && !used.has(v.playerId) && fits(v, false));
    if (!cands.length) continue;
    const v = cands[rng.int(0, cands.length - 1)];
    used.add(v.playerId);
    if (v.rating >= 90) elite++;
    out.push(v);
  }
  return out.sort((a, b) => b.rating - a.rating).map((v) => v.id);
}

export function captainOptions(rng: Rng): string[] {
  const out: PlayerVersion[] = [];
  const used = new Set<string>();
  const lines = new Set<PositionLine>();
  for (let i = 0; i < 60 && out.length < DRAFT_OPTIONS; i++) {
    const tier = pickTier(rng, CAPTAIN_TIERS);
    const cands = POOL.filter((v) => v.rating >= tier.min && v.rating <= tier.max && !used.has(v.playerId) && v.position !== 'GK');
    const v = cands[rng.int(0, cands.length - 1)];
    // Variedad de líneas entre los capitanes.
    if (lines.has(POSITION_LINE[v.position]) && lines.size < 3 && i < 30) continue;
    used.add(v.playerId);
    lines.add(POSITION_LINE[v.position]);
    out.push(v);
  }
  return out.map((v) => v.id);
}

export function formationOptions(rng: Rng): FormationId[] {
  const ids = [...FORMATION_IDS];
  const out: FormationId[] = [];
  while (out.length < DRAFT_OPTIONS && ids.length) out.push(ids.splice(rng.int(0, ids.length - 1), 1)[0]);
  return out;
}

/** Slot donde encaja mejor el capitán en la formación elegida. */
export function captainSlot(formationId: FormationId, versionId: string): number {
  const f = getFormation(formationId);
  const v = catalog.versions.get(versionId)!;
  const rank = { natural: 0, related: 1, poor: 2 } as const;
  return [...f.slots].sort((a, b) => rank[positionFit(v.position, v.altPositions, a.position)] - rank[positionFit(v.position, v.altPositions, b.position)] || (a.position === 'GK' ? 1 : 0) - (b.position === 'GK' ? 1 : 0))[0].index;
}

export function startDraft(prev: DraftState): DraftState {
  const edition = prev.edition + 1;
  const seed = hashString(`draft-${edition}-${Date.now()}`);
  const rng = createRng(seed);
  return { ...emptyDraft(prev), status: 'drafting', edition, seed, step: 'captain', captainOptions: captainOptions(rng) };
}

export function chooseCaptain(d: DraftState, versionId: string): DraftState {
  if (d.step !== 'captain' || !d.captainOptions.includes(versionId)) return d;
  const rng = createRng(d.seed ^ 0x9e3779b9);
  return { ...d, captain: versionId, step: 'formation', formationOptions: formationOptions(rng) };
}

export function chooseFormation(d: DraftState, id: FormationId): DraftState {
  if (d.step !== 'formation' || !d.formationOptions.includes(id) || !d.captain) return d;
  const slots: (string | null)[] = Array(11).fill(null);
  slots[captainSlot(id, d.captain)] = d.captain;
  return { ...d, formationId: id, slots, step: 'players', options: {} };
}

const takenPlayers = (d: DraftState) => new Set(d.slots.filter(Boolean).map((id) => catalog.versions.get(id!)!.playerId));

/** Opciones de un slot (se generan una vez y quedan fijadas). */
export function ensureOptions(d: DraftState, slot: number): DraftState {
  if (d.options[slot] || !d.formationId || d.slots[slot]) return d;
  const rng = createRng((d.seed + slot * 7919) >>> 0);
  const pos = getFormation(d.formationId).slots[slot].position;
  return { ...d, options: { ...d.options, [slot]: slotOptions(rng, pos, takenPlayers(d)) } };
}

export function pickPlayer(d: DraftState, slot: number, versionId: string): DraftState {
  if (d.step !== 'players' || d.slots[slot] || !d.options[slot]?.includes(versionId)) return d;
  const pid = catalog.versions.get(versionId)!.playerId;
  if (takenPlayers(d).has(pid)) return d;
  const slots = [...d.slots];
  slots[slot] = versionId;
  return { ...d, slots };
}

export const draftComplete = (d: DraftState) => d.slots.length === 11 && d.slots.every(Boolean);

/** Química y media del once del draft (o con una opción hipotética en un slot). */
export function draftChemistry(formationId: FormationId, slots: (string | null)[]) {
  const formation = getFormation(formationId);
  const chem = calculateChemistry(
    formation,
    slots.map((id) => {
      if (!id) return null;
      const v = catalog.versions.get(id)!;
      const club = catalog.clubs.get(v.clubId)!;
      return {
        playerId: v.playerId,
        clubId: v.clubId,
        leagueId: club.leagueId,
        nationCode: v.nationCode,
        position: v.position,
        altPositions: v.altPositions,
        isIcon: catalog.players.get(v.playerId)!.icon,
        loyal: true,
      };
    }),
  );
  const rating = teamRating(slots.map((id) => (id ? catalog.versions.get(id)!.rating : null)));
  return { chem, rating };
}

// ───────────────────────────── Selecciones rivales ─────────────────────────────

const KITS: Record<string, [string, string]> = {
  'gb-eng': ['#f5f5f5', '#1d3c8f'], fr: ['#1b2f6b', '#f5f5f5'], es: ['#c8102e', '#f6c22b'], br: ['#f6d32b', '#1f7a3a'], pt: ['#9b1b30', '#1f6b3a'],
  ar: ['#7fb8e6', '#f5f5f5'], de: ['#f5f5f5', '#111111'], nl: ['#f36c21', '#f5f5f5'], it: ['#1c5bb8', '#f5f5f5'], be: ['#c8102e', '#111111'],
  uy: ['#6aa9e0', '#111111'], ch: ['#d52b1e', '#f5f5f5'], hr: ['#f5f5f5', '#d1132a'], tr: ['#e30a17', '#f5f5f5'], no: ['#ba0c2f', '#00205b'],
  rs: ['#c6363c', '#0c4076'], ma: ['#c1272d', '#006233'], se: ['#fecc00', '#006aa7'], co: ['#fcd116', '#003893'], pl: ['#f5f5f5', '#dc143c'],
  sn: ['#f5f5f5', '#00853f'], dk: ['#c8102e', '#f5f5f5'], jp: ['#1b2f8c', '#f5f5f5'], us: ['#f5f5f5', '#1f3a93'], ci: ['#f77f00', '#009e60'],
  ng: ['#008751', '#f5f5f5'], dz: ['#f5f5f5', '#006633'], at: ['#ed2939', '#f5f5f5'], mx: ['#006847', '#f5f5f5'], ua: ['#ffd500', '#005bbb'],
  sk: ['#f5f5f5', '#0b4ea2'], cz: ['#d7141a', '#11457e'], gh: ['#f5f5f5', '#111111'], sa: ['#006c35', '#f5f5f5'], ie: ['#169b62', '#f5f5f5'],
};
function kit(code: string): { primary: string; secondary: string } {
  const k = KITS[code];
  if (k) return { primary: k[0], secondary: k[1] };
  const h = hashString(code) % 360;
  return { primary: `hsl(${h}, 60%, 40%)`, secondary: '#f5f5f5' };
}

function nationPool(code: string) {
  const current = POOL.filter((v) => v.nationCode === code && v.year >= CURRENT_YEAR && !v.event);
  if (current.length >= 16) return current;
  // Selecciones con pocos jugadores actuales: se completan con temporadas pasadas (sin Iconos).
  const past = POOL.filter((v) => v.nationCode === code && v.year < CURRENT_YEAR && !v.event && !catalog.players.get(v.playerId)!.icon).map((v) => ({ ...v, rating: v.rating - 3 }));
  return [...current, ...past];
}

let nationsCache: { code: string; rating: number }[] | null = null;
/** Selecciones disponibles, ordenadas por la media de su mejor once. */
export function rankedNations() {
  nationsCache ??= [...new Set(POOL.map((v) => v.nationCode))]
    .map((code) => {
      const pool = nationPool(code);
      const top = pool.map((v) => v.rating).sort((a, b) => b - a).slice(0, 11);
      // Con menos de 11 jugadores propios, el once se completa con cartas de otros países (penaliza la media).
      return { code, rating: top.reduce((a, b) => a + b, 0) / Math.max(1, top.length) - (11 - top.length) * 1.5, n: pool.length };
    })
    .filter((n) => n.n >= 8 && catalog.nations.has(n.code))
    .sort((a, b) => b.rating - a.rating);
  return nationsCache;
}

const nationTeams = new Map<string, TeamBuild>();
/** Selección nacional controlada por la IA. */
export function nationTeam(code: string): TeamBuild {
  const cached = nationTeams.get(code);
  if (cached) return cached;
  const nation = catalog.nations.get(code)!;
  const pool = nationPool(code).map((v) => catalog.versions.get(v.id)!);
  const rng = createRng(hashString(`nation-${code}`));
  const formationId = (['4-3-3', '4-2-3-1', '4-4-2', '3-5-2', '4-1-4-1', '3-4-3', '5-3-2', '4-3-2-1'] as FormationId[])[rng.int(0, 7)];
  const styles = ['balanced', 'possession', 'counter', 'direct', 'wings', 'highpress'] as const;
  const style = styles[rng.int(0, styles.length - 1)];
  const approx = rankedNations().find((n) => n.code === code)?.rating ?? 78;
  const difficulty = approx >= 85 ? 5 : approx >= 82 ? 4 : approx >= 79 ? 3 : approx >= 75 ? 2 : 1;
  const t = assemble(
    {
      id: `nat-${code}`,
      name: nation.name,
      shortName: nation.cardName,
      colors: kit(code),
      formationId,
      difficulty,
      description: `Selección de ${nation.name}`,
      tactics: styleTactics(style, difficulty),
    },
    pool,
  );
  nationTeams.set(code, t);
  return t;
}

// ───────────────────────────── Torneo ─────────────────────────────

/** Arranca el Mundial con el once del draft: sorteo de grupos por bombos. */
export function startTournament(d: DraftState, userName: string): DraftState {
  if (!draftComplete(d) || !d.formationId) return d;
  const rng = createRng(d.seed ^ 0x51ed27);
  const { rating } = draftChemistry(d.formationId, d.slots);
  const nations = rankedNations().slice(0, 31);
  const teams: DraftTeam[] = [
    { id: USER_DRAFT, name: userName, shortName: userName.toUpperCase().slice(0, 12), colors: { primary: '#f3d99b', secondary: '#0b0d11' }, rating, user: true },
    ...nations.map((n) => {
      const t = nationTeam(n.code);
      return { id: t.id, name: t.name, shortName: t.shortName, colors: t.colors, nationCode: n.code, rating: t.rating };
    }),
  ];
  // Bombos: tu equipo + 7 mejores en el bombo 1; el resto por media.
  const others = teams.slice(1).sort((a, b) => b.rating - a.rating);
  const pots = [[teams[0], ...others.slice(0, 7)], others.slice(7, 15), others.slice(15, 23), others.slice(23, 31)];
  const groups: string[][] = Array.from({ length: 8 }, () => []);
  for (const pot of pots) {
    const shuffled = [...pot].sort(() => rng.next() - 0.5);
    shuffled.forEach((t, i) => groups[i].push(t.id));
  }
  const fixtures: DraftFixture[] = [];
  groups.forEach((g, gi) => {
    for (let r = 0; r < 3; r++) {
      roundPairs(g, r).forEach(([home, away], k) => fixtures.push({ id: `g${gi}-${r}-${k}`, stage: 'group', group: gi, round: r, slot: k, home, away }));
    }
  });
  return { ...d, status: 'running', teams, groups, fixtures, players: {}, champion: undefined, reached: 'group', prize: undefined };
}

export interface GroupRow {
  id: string;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
}

export function groupTable(d: DraftState, g: number): GroupRow[] {
  const rows = new Map<string, GroupRow>(d.groups[g].map((id) => [id, { id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }]));
  for (const f of d.fixtures) {
    if (f.stage !== 'group' || f.group !== g || !f.result) continue;
    for (const [id, gf, ga] of [
      [f.home, f.result.home, f.result.away],
      [f.away, f.result.away, f.result.home],
    ] as const) {
      const r = rows.get(id)!;
      r.p++;
      r.gf += gf;
      r.ga += ga;
      if (gf > ga) {
        r.w++;
        r.pts += 3;
      } else if (gf === ga) {
        r.d++;
        r.pts++;
      } else r.l++;
    }
  }
  const teamRating = (id: string) => d.teams.find((t) => t.id === id)?.rating ?? 0;
  return [...rows.values()].sort((a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf || teamRating(b.id) - teamRating(a.id));
}

export function teamOf(d: DraftState, id: string) {
  return d.teams.find((t) => t.id === id)!;
}

/** Próximo partido del usuario (si sigue vivo). */
export function nextUserFixture(d: DraftState): DraftFixture | undefined {
  if (d.status !== 'running') return undefined;
  return d.fixtures.filter((f) => !f.result && (f.home === USER_DRAFT || f.away === USER_DRAFT)).sort((a, b) => order(a) - order(b))[0];
}
const order = (f: DraftFixture) => (f.stage === 'group' ? f.round : 3 + KO.indexOf(f.stage)) * 100 + f.slot;

/** Goleadores/asistentes simulados de una selección rival. */
function simReport(rng: Rng, teamId: string, t: TeamBuild, gf: number, ga: number): CupMatchReport['lines'] {
  const vs = t.versionIds.map((id) => catalog.versions.get(id)!);
  const lines = new Map<string, CupMatchReport['lines'][number]>();
  const line = (v: PlayerVersion) => {
    const key = `${teamId}|${v.id}`;
    let l = lines.get(key);
    if (!l) {
      l = { key, name: catalog.players.get(v.playerId)!.knownAs, teamId, versionId: v.id, goals: 0, assists: 0, cleanSheets: 0 };
      lines.set(key, l);
    }
    return l;
  };
  const gw = { attack: 5, midfield: 1.8, defence: 0.45, goalkeeper: 0 } as const;
  const aw = { attack: 2.4, midfield: 3, defence: 1, goalkeeper: 0.05 } as const;
  for (let i = 0; i < gf; i++) {
    const s = rng.weighted(vs, (v) => gw[POSITION_LINE[v.position]] * Math.pow(v.rating / 80, 3));
    line(s).goals++;
    if (rng.chance(0.72)) line(rng.weighted(vs.filter((v) => v !== s), (v) => aw[POSITION_LINE[v.position]])).assists++;
  }
  if (ga === 0) {
    const gk = vs.find((v) => v.position === 'GK');
    if (gk) line(gk).cleanSheets++;
  }
  return [...lines.values()];
}

function addReport(players: Record<string, CupPlayerLine>, lines: CupMatchReport['lines']) {
  const out = { ...players };
  for (const l of lines) {
    const p = out[l.key] ?? { ...l, goals: 0, assists: 0, cleanSheets: 0 };
    out[l.key] = { ...p, goals: p.goals + l.goals, assists: p.assists + l.assists, cleanSheets: p.cleanSheets + l.cleanSheets };
  }
  return out;
}

const knockoutWinner = (rng: Rng, f: DraftFixture, hr: number, ar: number) => {
  const r = f.result!;
  if (r.home !== r.away) return r.home > r.away ? f.home : f.away;
  const pHome = 0.5 + (hr - ar) * 0.015;
  const homeWins = rng.chance(pHome);
  const a = 3 + rng.int(0, 2);
  const b = a - 1 - (rng.chance(0.3) ? 1 : 0);
  f.result = { ...r, pens: homeWins ? { home: a, away: Math.max(0, b) } : { home: Math.max(0, b), away: a } };
  return homeWins ? f.home : f.away;
};

function simulate(d: DraftState, f: DraftFixture, rng: Rng): { fixture: DraftFixture; lines: CupMatchReport['lines'] } {
  const th = nationTeam(teamOf(d, f.home).nationCode!);
  const ta = nationTeam(teamOf(d, f.away).nationCode!);
  const { hg, ag } = simulateScore(rng, th.rating, ta.rating, 0.05);
  const fx: DraftFixture = { ...f, result: { home: hg, away: ag } };
  if (f.stage !== 'group') fx.winner = knockoutWinner(rng, fx, th.rating, ta.rating);
  return { fixture: fx, lines: [...simReport(rng, f.home, th, hg, ag), ...simReport(rng, f.away, ta, ag, hg)] };
}

/** Genera la siguiente eliminatoria cuando la anterior está completa. */
function advance(d: DraftState): DraftState {
  const pending = (stage: DraftStage) => d.fixtures.filter((f) => f.stage === stage);
  // Fin de grupos → octavos (1A-2B, 1B-2A, 1C-2D, …)
  if (!pending('r16').length && pending('group').every((f) => f.result)) {
    const t = d.groups.map((_, g) => groupTable(d, g));
    const pairs: [string, string][] = [];
    for (let g = 0; g < 8; g += 2) {
      pairs.push([t[g][0].id, t[g + 1][1].id]);
      pairs.push([t[g + 1][0].id, t[g][1].id]);
    }
    return { ...d, fixtures: [...d.fixtures, ...pairs.map(([home, away], i) => ({ id: `r16-${i}`, stage: 'r16' as const, round: 0, slot: i, home, away }))] };
  }
  for (let k = 0; k < KO.length - 1; k++) {
    const cur = pending(KO[k]);
    const next = KO[k + 1];
    if (cur.length && cur.every((f) => f.winner) && !pending(next).length) {
      const sorted = [...cur].sort((a, b) => a.slot - b.slot);
      const fx: DraftFixture[] = [];
      for (let i = 0; i < sorted.length; i += 2) fx.push({ id: `${next}-${i / 2}`, stage: next, round: 0, slot: i / 2, home: sorted[i].winner!, away: sorted[i + 1].winner! });
      return { ...d, fixtures: [...d.fixtures, ...fx] };
    }
  }
  const final = pending('final')[0];
  if (final?.winner) return { ...d, champion: final.winner };
  return d;
}

/** Simula el resto del torneo, ronda a ronda, hasta coronar campeón. */
function simulateToEnd(d: DraftState, rng: Rng): DraftState {
  let s = advance(d);
  for (let guard = 0; guard < 12 && !s.champion; guard++) {
    const open = s.fixtures.filter((f) => !f.result).sort((a, b) => order(a) - order(b));
    if (!open.length) break;
    const first = open[0];
    const batch = open.filter((f) => f.stage === first.stage && (f.stage !== 'group' || f.round === first.round));
    let pl = s.players;
    const fixtures = s.fixtures.map((f) => {
      if (!batch.includes(f)) return f;
      const r = simulate(s, f, rng);
      pl = addReport(pl, r.lines);
      return r.fixture;
    });
    s = advance({ ...s, fixtures, players: pl });
  }
  return s;
}

/** Registra un partido del usuario, simula el resto de su ronda y avanza el cuadro. */
export function applyUserResult(d: DraftState, goalsFor: number, goalsAgainst: number, report: CupMatchReport, pens?: { for: number; against: number }): DraftState {
  const fx = nextUserFixture(d);
  if (!fx) return d;
  const rng = createRng((d.seed + d.fixtures.filter((f) => f.result).length * 104729) >>> 0);
  const userHome = fx.home === USER_DRAFT;
  const result = userHome ? { home: goalsFor, away: goalsAgainst } : { home: goalsAgainst, away: goalsFor };
  const updated: DraftFixture = { ...fx, result };
  if (fx.stage !== 'group') {
    const win = goalsFor > goalsAgainst || (goalsFor === goalsAgainst && !!pens && pens.for > pens.against);
    if (goalsFor === goalsAgainst && pens) updated.result = { ...result, pens: userHome ? { home: pens.for, away: pens.against } : { home: pens.against, away: pens.for } };
    updated.winner = win ? USER_DRAFT : userHome ? fx.away : fx.home;
  }
  let s: DraftState = { ...d, fixtures: d.fixtures.map((f) => (f.id === fx.id ? updated : f)), players: addReport(d.players, report.lines) };
  // El resto de partidos de esa jornada/ronda se juegan a la vez.
  const sameRound = (f: DraftFixture) => !f.result && f.stage === fx.stage && (fx.stage !== 'group' || f.round === fx.round);
  let pl = s.players;
  s = {
    ...s,
    fixtures: s.fixtures.map((f) => {
      if (!sameRound(f)) return f;
      const r = simulate(s, f, rng);
      pl = addReport(pl, r.lines);
      return r.fixture;
    }),
  };
  s = advance({ ...s, players: pl });

  const alive = s.fixtures.some((f) => !f.result && (f.home === USER_DRAFT || f.away === USER_DRAFT));
  const reached = (s.fixtures.filter((f) => f.home === USER_DRAFT || f.away === USER_DRAFT).map((f) => f.stage).sort((a, b) => KO.indexOf(b) - KO.indexOf(a))[0] ?? 'group') as DraftStage;
  if (s.champion === USER_DRAFT) return finish({ ...s, status: 'won', reached: 'champion' });
  if (!alive && !s.champion) {
    // Eliminado: el torneo sigue sin ti hasta coronar campeón.
    s = simulateToEnd({ ...s, status: 'eliminated', reached }, rng);
    return finish({ ...s, status: 'eliminated', reached });
  }
  if (!alive) return finish({ ...s, status: 'eliminated', reached });
  return { ...s, reached };
}

const RANK: Record<DraftStage | 'champion', number> = { group: 0, r16: 1, qf: 2, sf: 3, final: 4, champion: 5 };
function finish(s: DraftState): DraftState {
  const reached = s.reached ?? 'group';
  const best = !s.best || RANK[reached] > RANK[s.best] ? reached : s.best;
  return { ...s, prize: DRAFT_PRIZES[reached], best, titles: s.titles + (reached === 'champion' ? 1 : 0) };
}

export function draftLeaders(d: DraftState, key: 'goals' | 'assists' | 'cleanSheets', n = 8) {
  return Object.values(d.players)
    .filter((p) => p[key] > 0)
    .sort((a, b) => b[key] - a[key] || b.goals - a.goals || a.name.localeCompare(b.name))
    .slice(0, n);
}

