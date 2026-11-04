import { createRng, hashString } from '@fu/shared';
import { MatchEngine, penaltyShootout, type MatchEvent, type MatchTeamSetup } from '@fu/domain';
import { catalog } from '../data/catalog';
import { aiToMatchSetup, buildOpponent, clubTeam, divisionOpponent, QUICK_OPPONENTS, type TeamBuild } from './teams';
import { mixTeam, TOURNAMENTS, type TournamentDef } from './tournaments';

/** Nombre visible de un futbolista para las estadísticas de la copa. */
export const cupPlayerName = (versionId: string | undefined, fallback: string) => {
  const v = versionId ? catalog.versions.get(versionId) : undefined;
  return v ? catalog.players.get(v.playerId)!.knownAs : fallback;
};

/**
 * COPA ULTIMATE
 * Torneo de 8 equipos a eliminación directa (cuartos, semifinal, final).
 * El usuario juega sus partidos en directo; el resto se simula con el mismo
 * motor de partido, de modo que las estadísticas del torneo (goleadores,
 * asistentes, porterías a cero) incluyen a todos los participantes.
 */
export const CUP_ROUNDS = ['Cuartos de final', 'Semifinal', 'Final'] as const;
export const CUP_TEAMS = 8;
export const USER_ID = 'user';

export type CupTeamSource =
  | { kind: 'quick'; id: string }
  | { kind: 'division'; level: number; game: number }
  | { kind: 'club'; clubId: string }
  | { kind: 'mix'; tournament: string; edition: number; index: number };
export type RivalMode = 'real' | 'mix';

export interface CupTeamRef {
  id: string;
  name: string;
  shortName: string;
  colors: { primary: string; secondary: string };
  user?: boolean;
  source?: CupTeamSource;
}

export interface CupFixture {
  id: string;
  round: number;
  slot: number;
  home: string;
  away: string;
  result?: { home: number; away: number; pens?: { home: number; away: number } };
  winner?: string;
}

export interface CupPlayerLine {
  key: string;
  name: string;
  teamId: string;
  versionId?: string;
  goals: number;
  assists: number;
  cleanSheets: number;
}

export interface CupState {
  /** Torneo al que pertenece este estado. */
  defId: string;
  /** Rivales: clubes reales o equipos mixtos con química. */
  mode: RivalMode;
  status: 'idle' | 'running' | 'eliminated' | 'won';
  titles: number;
  /** Nº de edición (para variar participantes y semillas). */
  edition: number;
  /** Ronda en la que está el usuario (null fuera del torneo). */
  round: number | null;
  teams: CupTeamRef[];
  fixtures: CupFixture[];
  players: Record<string, CupPlayerLine>;
  champion?: string;
}

/** Lo que aporta un partido a las estadísticas del torneo. */
export interface CupMatchReport {
  lines: { key: string; name: string; teamId: string; versionId?: string; goals: number; assists: number; cleanSheets: number }[];
}

export const emptyCup = (titles = 0, edition = 0, defId = 'ultimate', mode: RivalMode = 'mix'): CupState => ({
  defId,
  mode,
  status: 'idle',
  titles,
  edition,
  round: null,
  teams: [],
  fixtures: [],
  players: {},
});

/** Convierte partidas guardadas con el formato antiguo de copa. */
export function normalizeCup(c: Partial<CupState> | undefined, defId = 'ultimate'): CupState {
  if (!c) return emptyCup(0, 0, defId);
  if (!Array.isArray(c.teams) || !Array.isArray(c.fixtures) || !c.players) return emptyCup(c.titles ?? 0, c.titles ?? 0, defId);
  return { ...emptyCup(0, 0, defId), ...c, defId } as CupState;
}

const DIVISION_GUESTS: CupTeamSource[] = [
  { kind: 'division', level: 1, game: 2 },
  { kind: 'division', level: 2, game: 4 },
  { kind: 'division', level: 1, game: 6 },
  { kind: 'division', level: 3, game: 1 },
];

export function buildCupTeam(ref: CupTeamRef): TeamBuild {
  const s = ref.source!;
  switch (s.kind) {
    case 'quick':
      return buildOpponent(s.id);
    case 'division':
      return divisionOpponent(s.level, s.game);
    case 'club':
      return clubTeam(s.clubId);
    case 'mix':
      return mixTeam(s.tournament, s.edition, s.index);
  }
}

/** Participantes de la IA según el torneo y el tipo de rivales. */
function guestSources(def: TournamentDef, mode: RivalMode, edition: number, rng: ReturnType<typeof createRng>): CupTeamSource[] {
  const n = CUP_TEAMS - 1;
  if (mode === 'real') {
    const pool = [...def.realClubs()];
    // Sorteo ponderado: los mejores casi siempre están, pero no siempre los mismos.
    const out: CupTeamSource[] = [];
    while (out.length < n && pool.length) {
      const pick = rng.weighted(
        pool.map((c, i) => ({ c, i })),
        (e) => 1 / (1 + e.i * 0.35),
      ).c;
      pool.splice(pool.indexOf(pick), 1);
      out.push({ kind: 'club', clubId: pick });
    }
    return out;
  }
  if (def.id === 'ultimate') {
    return [
      ...QUICK_OPPONENTS.map((id) => ({ kind: 'quick' as const, id })),
      ...[...DIVISION_GUESTS].sort(() => rng.next() - 0.5).slice(0, n - QUICK_OPPONENTS.length),
    ];
  }
  return Array.from({ length: n }, (_, index) => ({ kind: 'mix' as const, tournament: def.id, edition, index }));
}

/** Crea una nueva edición: el usuario + 7 rivales sorteados en el cuadro. */
export function createCup(prev: CupState, userName: string, mode: RivalMode = prev.mode): CupState {
  const def = TOURNAMENTS.find((t) => t.id === prev.defId) ?? TOURNAMENTS[0];
  const edition = prev.edition + 1;
  const rng = createRng(hashString(`${def.id}-${edition}-${mode}`));
  const sources = guestSources(def, mode, edition, rng);
  const guests: CupTeamRef[] = sources.map((source) => {
    const t = buildCupTeam({ id: '', name: '', shortName: '', colors: { primary: '', secondary: '' }, source });
    return { id: t.id, name: t.name, shortName: t.shortName, colors: t.colors, source };
  });
  // Sorteo del cuadro.
  for (let i = guests.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [guests[i], guests[j]] = [guests[j], guests[i]];
  }
  const user: CupTeamRef = { id: USER_ID, name: userName, shortName: userName.split(' ').slice(0, 2).join(' ').toUpperCase().slice(0, 12), colors: { primary: '#f3d99b', secondary: '#0b0d11' }, user: true };
  const userSlot = rng.int(0, CUP_TEAMS - 1);
  const order = [...guests];
  order.splice(userSlot, 0, user);
  const fixtures: CupFixture[] = [];
  for (let i = 0; i < CUP_TEAMS / 2; i++) fixtures.push({ id: `r0-${i}`, round: 0, slot: i, home: order[i * 2].id, away: order[i * 2 + 1].id });
  return { defId: def.id, mode, status: 'running', titles: prev.titles, edition, round: 0, teams: [user, ...guests], fixtures, players: {} };
}

export const teamOf = (cup: CupState, id: string) => cup.teams.find((t) => t.id === id);

/** Partido pendiente del usuario en su ronda actual. */
export function userFixture(cup: CupState): CupFixture | undefined {
  return cup.fixtures.find((f) => !f.winner && (f.home === USER_ID || f.away === USER_ID));
}

/** Estadísticas de un partido a partir de sus eventos (goles, asistencias, porterías a cero). */
export function reportFromEvents(events: readonly MatchEvent[], sides: { home: { teamId: string; setup: MatchTeamSetup }; away: { teamId: string; setup: MatchTeamSetup } }, score: { home: number; away: number }, names: (versionId: string | undefined, fallback: string) => string): CupMatchReport {
  const lines = new Map<string, CupMatchReport['lines'][number]>();
  const byId = new Map<string, { teamId: string; versionId?: string; name: string; position: string }>();
  for (const side of ['home', 'away'] as const) {
    for (const p of sides[side].setup.players) byId.set(p.id, { teamId: sides[side].teamId, versionId: p.versionId, name: p.name, position: p.position });
  }
  const line = (playerId: string) => {
    const p = byId.get(playerId);
    if (!p) return null;
    const key = `${p.teamId}|${p.versionId ?? playerId}`;
    let l = lines.get(key);
    if (!l) {
      l = { key, name: names(p.versionId, p.name), teamId: p.teamId, versionId: p.versionId, goals: 0, assists: 0, cleanSheets: 0 };
      lines.set(key, l);
    }
    return l;
  };
  for (const e of events) {
    if (e.type !== 'goal') continue;
    if (e.playerId) {
      const l = line(e.playerId);
      if (l) l.goals++;
    }
    if (e.otherId) {
      const l = line(e.otherId);
      if (l) l.assists++;
    }
  }
  for (const side of ['home', 'away'] as const) {
    const conceded = side === 'home' ? score.away : score.home;
    if (conceded > 0) continue;
    const gk = sides[side].setup.players.find((p) => p.position === 'GK');
    if (gk) {
      const l = line(gk.id);
      if (l) l.cleanSheets++;
    }
  }
  return { lines: [...lines.values()] };
}

/** Registra el resultado de un partido y, si la ronda termina, genera la siguiente. */
export function applyResult(cup: CupState, fixtureId: string, result: NonNullable<CupFixture['result']>, report: CupMatchReport): CupState {
  const fixtures = cup.fixtures.map((f) => {
    if (f.id !== fixtureId) return f;
    const homeWins = result.home > result.away || (result.home === result.away && !!result.pens && result.pens.home > result.pens.away);
    return { ...f, result, winner: homeWins ? f.home : f.away };
  });
  const players = { ...cup.players };
  for (const l of report.lines) {
    const prev = players[l.key];
    players[l.key] = prev
      ? { ...prev, goals: prev.goals + l.goals, assists: prev.assists + l.assists, cleanSheets: prev.cleanSheets + l.cleanSheets }
      : { ...l };
  }
  let next: CupState = { ...cup, fixtures, players };
  // ¿Ronda completa? → emparejar ganadores en orden del cuadro.
  const round = fixtures.find((f) => f.id === fixtureId)!.round;
  const inRound = fixtures.filter((f) => f.round === round).sort((a, b) => a.slot - b.slot);
  if (inRound.every((f) => f.winner)) {
    if (inRound.length === 1) {
      next = { ...next, champion: inRound[0].winner };
    } else if (!fixtures.some((f) => f.round === round + 1)) {
      const nf: CupFixture[] = [];
      for (let i = 0; i < inRound.length / 2; i++) {
        nf.push({ id: `r${round + 1}-${i}`, round: round + 1, slot: i, home: inRound[i * 2].winner!, away: inRound[i * 2 + 1].winner! });
      }
      next = { ...next, fixtures: [...fixtures, ...nf] };
    }
  }
  return next;
}

/** Simula con el motor un partido entre dos equipos de la IA. */
export function simulateFixture(cup: CupState, f: CupFixture, names: (versionId: string | undefined, fallback: string) => string) {
  const home = aiToMatchSetup(buildCupTeam(teamOf(cup, f.home)!));
  const away = aiToMatchSetup(buildCupTeam(teamOf(cup, f.away)!));
  const seed = hashString(`${cup.edition}-${f.id}-${f.home}-${f.away}`);
  const engine = new MatchEngine(home, away, seed);
  engine.simulateToEnd();
  const s = engine.getSnapshot();
  let pens: { home: number; away: number } | undefined;
  if (s.score.home === s.score.away) {
    const shooters = (t: MatchTeamSetup) => [...t.players].sort((a, b) => b.attributes.shooting - a.attributes.shooting).map((p) => p.attributes.shooting);
    const keeper = (t: MatchTeamSetup) => t.players.find((p) => p.position === 'GK')?.attributes.goalkeeping ?? 50;
    pens = penaltyShootout(createRng(seed ^ 0x9e3779b9), { shooting: shooters(home), keeper: keeper(home) }, { shooting: shooters(away), keeper: keeper(away) });
  }
  const report = reportFromEvents(engine.events, { home: { teamId: f.home, setup: home }, away: { teamId: f.away, setup: away } }, s.score, names);
  return { result: { home: s.score.home, away: s.score.away, pens }, report };
}

/** Juega todos los partidos pendientes sin el usuario (de la ronda actual o de todo el torneo). */
export function simulatePending(cup: CupState, names: (versionId: string | undefined, fallback: string) => string, untilEnd: boolean): CupState {
  let c = cup;
  for (let guard = 0; guard < 16; guard++) {
    const pending = c.fixtures.filter((f) => !f.winner && f.home !== USER_ID && f.away !== USER_ID);
    if (!pending.length) break;
    const roundNow = Math.min(...pending.map((f) => f.round));
    for (const f of pending.filter((x) => x.round === roundNow)) {
      const { result, report } = simulateFixture(c, f, names);
      c = applyResult(c, f.id, result, report);
    }
    if (!untilEnd) break;
  }
  return c;
}

/** Clasificaciones del torneo. */
export function leaders(cup: CupState, key: 'goals' | 'assists' | 'cleanSheets', n = 8) {
  return Object.values(cup.players)
    .filter((p) => p[key] > 0)
    .sort((a, b) => b[key] - a[key] || b.goals - a.goals || a.name.localeCompare(b.name))
    .slice(0, n);
}
