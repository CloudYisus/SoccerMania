import { createRng, hashString, type Rng } from '@fu/shared';
import { POSITION_LINE, versionType, type PositionLine } from '@fu/domain';
import { catalog, inFormOf } from '../data/catalog';
import { clubTeam, REAL_CLUBS } from './teams';

/**
 * MUNDO SIMULADO · Equipo de la Semana
 * Cada "semana" se juega una jornada en todas las ligas del juego (simulación
 * estadística rápida con las plantillas reales). Con esos rendimientos y con
 * los de tus propios partidos se arma el Equipo de la Semana (11 jugadores).
 * Si uno de tus jugadores entra, jugará su versión En Forma el próximo partido.
 */

export interface TotwEntry {
  /** Versión base del futbolista y su versión En Forma. */
  versionId: string;
  ifId: string;
  clubId: string;
  score: number;
  /** "2 goles · 1 asist. · Barcelona 3-1 Sevilla" */
  line: string;
  /** Rendimiento logrado en tus partidos (carta de tu club). */
  cardId?: string;
}

export interface WorldResult {
  leagueId: string;
  home: string;
  away: string;
  hg: number;
  ag: number;
}

export interface StandingRow {
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
}

export interface UserPerf {
  versionId: string;
  score: number;
  goals: number;
  assists: number;
  opponent: string;
  result: string;
}

export interface WorldState {
  /** Semana en curso (la próxima en cerrarse). */
  week: number;
  matchesThisWeek: number;
  /** Mejor rendimiento de cada carta tuya durante la semana. */
  userPerf: Record<string, UserPerf>;
  /** Último Equipo de la Semana publicado. */
  totw: TotwEntry[];
  totwWeek: number;
  /** Futbolistas (versión base) que estuvieron en Equipos de la Semana anteriores. */
  pastTotw: string[];
  /** Resultados de la última jornada simulada. */
  results: WorldResult[];
  /** Clasificación de cada liga real (temporada en curso). */
  tables: Record<string, Record<string, StandingRow>>;
}

export const MATCHES_PER_WEEK = 3;

export function emptyWorld(): WorldState {
  return { week: 1, matchesThisWeek: 0, userPerf: {}, totw: [], totwWeek: 0, pastTotw: [], results: [], tables: {} };
}

export function normalizeWorld(w: Partial<WorldState> | undefined): WorldState {
  const base = emptyWorld();
  if (!w) return base;
  return {
    ...base,
    ...w,
    // Descarta entradas cuya versión ya no existe en el catálogo.
    totw: (w.totw ?? []).filter((e) => catalog.versions.has(e.ifId)),
    pastTotw: (w.pastTotw ?? []).filter((id) => catalog.versions.has(`${id}-if`)),
  };
}

/** Ligas con clubes reales jugables. */
function leagueClubs() {
  const by = new Map<string, string[]>();
  for (const c of REAL_CLUBS) {
    const list = by.get(c.leagueId) ?? [];
    list.push(c.id);
    by.set(c.leagueId, list);
  }
  for (const list of by.values()) list.sort();
  return [...by.entries()].filter(([, l]) => l.length >= 2);
}

/** Emparejamientos de una jornada (método del círculo, ida y vuelta). */
export function roundPairs<T>(teams: T[], round: number): [T, T][] {
  const list: (T | null)[] = [...teams];
  if (list.length % 2) list.push(null);
  const n = list.length;
  const rounds = n - 1;
  const r = round % (rounds * 2);
  const second = r >= rounds;
  const rr = r % rounds;
  const fixed = list[0];
  const rest = list.slice(1);
  const rot = [...rest.slice(rest.length - rr), ...rest.slice(0, rest.length - rr)];
  const arr = [fixed, ...rot];
  const out: [T, T][] = [];
  for (let i = 0; i < n / 2; i++) {
    const a = arr[i];
    const b = arr[n - 1 - i];
    if (a === null || b === null) continue;
    const homeFirst = (i + rr) % 2 === 0;
    const pair: [T, T] = homeFirst !== second ? [a, b] : [b, a];
    out.push(pair);
  }
  return out;
}

function poisson(rng: Rng, lambda: number) {
  const l = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng.next();
  } while (p > l && k < 10);
  return k - 1;
}

/** Marcador simulado entre dos equipos según su media (y ventaja de campo). */
export function simulateScore(rng: Rng, ratingHome: number, ratingAway: number, homeAdv = 0.18) {
  const d = (ratingHome - ratingAway) / 9;
  return { hg: poisson(rng, Math.max(0.25, 1.3 * Math.exp(d) + homeAdv)), ag: poisson(rng, Math.max(0.2, 1.1 * Math.exp(-d))) };
}

const GOAL_W: Record<PositionLine, number> = { attack: 5, midfield: 1.8, defence: 0.45, goalkeeper: 0 };
const ASSIST_W: Record<PositionLine, number> = { attack: 2.4, midfield: 3, defence: 1, goalkeeper: 0.05 };

interface Perf {
  versionId: string;
  clubId: string;
  score: number;
  goals: number;
  assists: number;
  line: string;
  cardId?: string;
}

/** Rendimientos individuales de un partido simulado. */
function matchPerformances(rng: Rng, clubId: string, lineup: string[], gf: number, ga: number, rivalName: string, scoreLine: string): Perf[] {
  const players = lineup.map((id) => catalog.versions.get(id)!);
  const goals = new Map<string, number>();
  const assists = new Map<string, number>();
  for (let g = 0; g < gf; g++) {
    const scorer = rng.weighted(players, (v) => GOAL_W[POSITION_LINE[v.position]] * Math.pow(v.rating / 80, 3));
    goals.set(scorer.id, (goals.get(scorer.id) ?? 0) + 1);
    if (rng.chance(0.72)) {
      const others = players.filter((v) => v.id !== scorer.id);
      const a = rng.weighted(others, (v) => ASSIST_W[POSITION_LINE[v.position]] * Math.pow(v.rating / 80, 2));
      assists.set(a.id, (assists.get(a.id) ?? 0) + 1);
    }
  }
  const result = gf > ga ? 0.35 : gf < ga ? -0.35 : 0;
  return players.map((v) => {
    const line = POSITION_LINE[v.position];
    const g = goals.get(v.id) ?? 0;
    const a = assists.get(v.id) ?? 0;
    let score = 6.1 + rng.range(-0.7, 0.9) + (v.rating - 80) * 0.03 + result + g * 1.25 + a * 0.8;
    if (ga === 0 && (line === 'defence' || line === 'goalkeeper')) score += line === 'goalkeeper' ? 1 : 0.7;
    if (line === 'goalkeeper' && ga > 0) score += rng.range(-0.3, 0.9) - ga * 0.2;
    if (line === 'defence') score -= ga * 0.15;
    const bits = [g && `${g} ${g === 1 ? 'gol' : 'goles'}`, a && `${a} asist.`, ga === 0 && line !== 'attack' && 'portería a cero'].filter(Boolean);
    return {
      versionId: v.id,
      clubId,
      score: Math.round(Math.min(10, Math.max(4, score)) * 10) / 10,
      goals: g,
      assists: a,
      line: `${bits.length ? bits.join(' · ') + ' · ' : ''}${scoreLine}`,
    };
  });
}

const club = (id: string) => catalog.clubs.get(id)!;
const short = (id: string) => {
  const s = club(id).shortName;
  return s.charAt(0) + s.slice(1).toLowerCase();
};

/** Elegibles para cartas En Forma: cartas base, sin Iconos ni Históricos. */
export function inFormEligible(versionId: string) {
  const v = catalog.versions.get(versionId);
  if (!v || versionType(v) !== 'base') return false;
  const p = catalog.players.get(v.playerId)!;
  return !p.icon && !p.hero && !!inFormOf(versionId);
}

/** Máximo de jugadores de tu club en un mismo Equipo de la Semana. */
const MAX_USER = 2;
/** Las notas del motor de partido son algo más generosas que las del mundo simulado. */
const USER_SCORE_ADJUST = 0.45;

const QUOTA: Record<PositionLine, number> = { goalkeeper: 1, defence: 4, midfield: 3, attack: 3 };

/** Elige el once de la semana: mejores notas por línea, máx. 2 por club y variedad respecto a la anterior. */
export function pickTotw(perfs: Perf[], previous: Set<string>): TotwEntry[] {
  // Tus jugadores compiten con los del mundo; una actuación sobresaliente (≥ 8,8) asegura plaza.
  const forcedUser = perfs.filter((p) => p.cardId && p.score >= 8.8).sort((a, b) => b.score - a.score).slice(0, 1);
  let userTaken = 0;
  const ranked = [...perfs]
    .filter((p) => inFormEligible(p.versionId))
    .map((p) => ({ p, s: p.score - (previous.has(p.versionId) ? 0.5 : 0) }))
    .sort((a, b) => b.s - a.s);
  const out: Perf[] = [];
  const perClub = new Map<string, number>();
  const players = new Set<string>();
  const lineCount: Record<PositionLine, number> = { goalkeeper: 0, defence: 0, midfield: 0, attack: 0 };
  const take = (p: Perf) => {
    const v = catalog.versions.get(p.versionId)!;
    const line = POSITION_LINE[v.position];
    if (players.has(v.playerId) || lineCount[line] >= QUOTA[line]) return false;
    if (!p.cardId && (perClub.get(p.clubId) ?? 0) >= 2) return false;
    if (p.cardId && userTaken >= MAX_USER) return false;
    if (p.cardId) userTaken++;
    players.add(v.playerId);
    lineCount[line]++;
    perClub.set(p.clubId, (perClub.get(p.clubId) ?? 0) + 1);
    out.push(p);
    return true;
  };
  for (const p of forcedUser) if (inFormEligible(p.versionId)) take(p);
  for (const { p } of ranked) {
    if (out.length >= 11) break;
    take(p);
  }
  const order: PositionLine[] = ['goalkeeper', 'defence', 'midfield', 'attack'];
  return out
    .sort((a, b) => order.indexOf(POSITION_LINE[catalog.versions.get(a.versionId)!.position]) - order.indexOf(POSITION_LINE[catalog.versions.get(b.versionId)!.position]) || b.score - a.score)
    .map((p) => ({ versionId: p.versionId, ifId: `${p.versionId}-if`, clubId: p.clubId, score: p.score, line: p.line, cardId: p.cardId }));
}

/** Cierra la semana: simula la jornada mundial y publica el Equipo de la Semana. */
export function closeWeek(w: WorldState): { world: WorldState; qualified: TotwEntry[] } {
  const rng = createRng(hashString(`world-week-${w.week}`));
  const perfs: Perf[] = [];
  const results: WorldResult[] = [];
  const tables = { ...w.tables };
  for (const [leagueId, clubs] of leagueClubs()) {
    const n = clubs.length % 2 ? clubs.length + 1 : clubs.length;
    // Nueva temporada al completar la ida y la vuelta.
    if ((w.week - 1) % ((n - 1) * 2) === 0) tables[leagueId] = {};
    const table = { ...(tables[leagueId] ?? {}) };
    for (const [h, a] of roundPairs(clubs, w.week - 1)) {
      const th = clubTeam(h);
      const ta = clubTeam(a);
      const { hg, ag } = simulateScore(rng, th.rating, ta.rating);
      results.push({ leagueId, home: h, away: a, hg, ag });
      const scoreLine = `${short(h)} ${hg}-${ag} ${short(a)}`;
      perfs.push(...matchPerformances(rng, h, th.versionIds, hg, ag, short(a), scoreLine));
      perfs.push(...matchPerformances(rng, a, ta.versionIds, ag, hg, short(h), scoreLine));
      for (const [id, gf, ga] of [
        [h, hg, ag],
        [a, ag, hg],
      ] as const) {
        const r = { ...(table[id] ?? { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }) };
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
        table[id] = r;
      }
    }
    tables[leagueId] = table;
  }
  // Rendimientos de tus cartas (notas del motor de partido).
  for (const [cardId, u] of Object.entries(w.userPerf)) {
    const v = catalog.versions.get(u.versionId);
    if (!v) continue;
    const bits = [u.goals && `${u.goals} ${u.goals === 1 ? 'gol' : 'goles'}`, u.assists && `${u.assists} asist.`].filter(Boolean);
    perfs.push({ versionId: u.versionId, clubId: v.clubId, score: Math.round((u.score - USER_SCORE_ADJUST) * 10) / 10, goals: u.goals, assists: u.assists, line: `${bits.length ? bits.join(' · ') + ' · ' : ''}${u.result} ante ${u.opponent} · tu club`, cardId });
  }
  const previous = new Set(w.totw.map((e) => e.versionId));
  const totw = pickTotw(perfs, previous);
  const past = [...new Set([...totw.map((e) => e.versionId), ...w.pastTotw])].slice(0, 220);
  return {
    world: { ...w, week: w.week + 1, matchesThisWeek: 0, userPerf: {}, totw, totwWeek: w.week, pastTotw: past, results, tables },
    qualified: totw.filter((e) => e.cardId),
  };
}

/** Registra los rendimientos de tus cartas en un partido (se queda el mejor de la semana). */
export function addUserPerf(w: WorldState, perfs: { cardId: string; versionId: string; score: number; goals: number; assists: number }[], opponent: string, result: string): WorldState {
  const userPerf = { ...w.userPerf };
  for (const p of perfs) {
    const prev = userPerf[p.cardId];
    if (!prev || p.score > prev.score) userPerf[p.cardId] = { versionId: p.versionId, score: p.score, goals: p.goals, assists: p.assists, opponent, result };
  }
  return { ...w, userPerf, matchesThisWeek: w.matchesThisWeek + 1 };
}

/** Clasificación ordenada de una liga real. */
export function sortedTable(table: Record<string, StandingRow>) {
  return Object.entries(table).sort(([, a], [, b]) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf);
}
