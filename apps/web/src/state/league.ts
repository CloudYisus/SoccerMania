import { createRng, hashString } from '@fu/shared';
import { PLAY_STYLES, POSITION_LINE, type MatchAttributes, type PlayStyle } from '@fu/domain';
import { catalog } from '../data/catalog';
import { divisionOpponent, type TeamBuild } from './teams';
import { roundPairs, simulateScore } from './world';

/**
 * LIGA (modo Divisiones): temporada de 8 equipos a una vuelta (7 jornadas) con
 * clasificación, resultados del resto de la jornada, goleadores, moral,
 * entrenamiento semanal, rueda de prensa, clima y estadio.
 * Ascienden los 2 primeros y descienden los 2 últimos.
 */

export const LEAGUE_TEAMS = 8;
export const LEAGUE_ROUNDS = LEAGUE_TEAMS - 1;
export const USER_TEAM = 'user';

export type WeatherId = 'clear' | 'cloudy' | 'rain' | 'night' | 'heat' | 'wind' | 'snow';
export const WEATHER: Record<WeatherId, { label: string; icon: string; effect: string; delta: Partial<MatchAttributes> }> = {
  clear: { label: 'Despejado', icon: '☀️', effect: 'Condiciones perfectas para jugar.', delta: {} },
  cloudy: { label: 'Nublado', icon: '☁️', effect: 'Sin efecto en el juego.', delta: {} },
  night: { label: 'Noche de focos', icon: '🌙', effect: 'Ambiente eléctrico bajo los focos.', delta: {} },
  rain: { label: 'Lluvia', icon: '🌧️', effect: 'Césped rápido y resbaladizo: −3 pase, −2 regate.', delta: { passing: -3, dribbling: -2 } },
  heat: { label: 'Calor', icon: '🥵', effect: 'Desgaste físico: −2 ritmo, −2 físico.', delta: { pace: -2, physical: -2 } },
  wind: { label: 'Viento', icon: '💨', effect: 'Golpeos imprecisos: −3 tiro.', delta: { shooting: -3 } },
  snow: { label: 'Nieve', icon: '❄️', effect: 'Balón pesado: −3 ritmo, −2 pase.', delta: { pace: -3, passing: -2 } },
};

export type TrainingId = 'attack' | 'defense' | 'possession' | 'physical' | 'recovery';
export const TRAINING: Record<TrainingId, { label: string; text: string; delta: Partial<MatchAttributes> }> = {
  attack: { label: 'Finalización', text: '+3 tiro, +2 regate en el próximo partido.', delta: { shooting: 3, dribbling: 2 } },
  defense: { label: 'Defensa', text: '+3 defensa, +2 físico en el próximo partido.', delta: { defending: 3, physical: 2 } },
  possession: { label: 'Posesión', text: '+3 pase, +1 regate en el próximo partido.', delta: { passing: 3, dribbling: 1 } },
  physical: { label: 'Físico', text: '+2 ritmo, +3 físico en el próximo partido.', delta: { pace: 2, physical: 3 } },
  recovery: { label: 'Recuperación', text: 'Sin mejoras, pero los lesionados se recuperan un partido antes y la moral sube.', delta: {} },
};

export type PressId = 'confident' | 'respect' | 'pressure' | 'final';
export const PRESS: Record<PressId, { label: string; quote: string; text: string }> = {
  confident: { label: 'Confianza total', quote: '«Salimos a ganar. Sin excusas.»', text: 'Si ganas: +2 moral y +20% monedas. Si pierdes: −2 moral.' },
  respect: { label: 'Respeto al rival', quote: '«Es un rival muy serio; iremos paso a paso.»', text: '+1 moral ahora. Sin riesgo.' },
  pressure: { label: 'Presión al rival', quote: '«Toda la presión es para ellos.»', text: 'El rival juega con −2 de moral. Si pierdes: −1 moral.' },
  final: { label: 'Es una final', quote: '«Para nosotros, esto es una final.»', text: '+2 moral ahora. Si pierdes: −3 moral.' },
};

export interface LeagueTeam {
  id: string;
  /** Índice del rival para reconstruir su plantilla (−1 = tu club). */
  idx: number;
  name: string;
  shortName: string;
  colors: { primary: string; secondary: string };
  rating: number;
  stadium: string;
}

export interface LeagueFixture {
  round: number;
  home: string;
  away: string;
  hg?: number;
  ag?: number;
  weather: WeatherId;
  attendance: number;
}

export interface LeagueSeason {
  season: number;
  level: number;
  rivals: 'mix' | 'real';
  teams: LeagueTeam[];
  fixtures: LeagueFixture[];
  /** Próxima jornada (0-based). */
  round: number;
  /** Moral del vestuario (−3 … +3). */
  morale: number;
  plan: { training: TrainingId | null; press: PressId | null };
  scorers: Record<string, { name: string; teamId: string; goals: number }>;
  /** Crónica breve de la última jornada (para el centro de la liga). */
  news: string[];
}

export interface TableRow {
  id: string;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
  form: ('W' | 'D' | 'L')[];
}

const WEATHER_POOL: [WeatherId, number][] = [
  ['clear', 4],
  ['cloudy', 3],
  ['night', 3],
  ['rain', 2.4],
  ['heat', 1.2],
  ['wind', 1.2],
  ['snow', 0.5],
];

export function rivalTeam(s: LeagueSeason, id: string): TeamBuild | null {
  const t = s.teams.find((x) => x.id === id);
  if (!t || t.idx < 0) return null;
  return divisionOpponent(s.level, t.idx + s.season * 7, s.rivals);
}

export function createSeason(level: number, rivals: 'mix' | 'real', season: number, userName: string): LeagueSeason {
  const rng = createRng(hashString(`league-${season}-${level}-${rivals}`));
  const teams: LeagueTeam[] = [{ id: USER_TEAM, idx: -1, name: userName, shortName: userName.toUpperCase().slice(0, 12), colors: { primary: '#f3d99b', secondary: '#0b0d11' }, rating: 0, stadium: `Estadio ${userName}` }];
  const seen = new Set<string>();
  for (let i = 0; teams.length < LEAGUE_TEAMS && i < 40; i++) {
    const t = divisionOpponent(level, i + season * 7, rivals);
    if (seen.has(t.id) || seen.has(t.name)) continue;
    seen.add(t.id);
    seen.add(t.name);
    const club = t.id.startsWith('club-') ? catalog.clubs.get(t.id.slice(5)) : undefined;
    teams.push({
      id: t.id,
      idx: i,
      name: t.name,
      shortName: t.shortName,
      colors: t.colors,
      rating: t.rating,
      stadium: club ? `Estadio del ${club.name}` : `Campo de ${t.name}`,
    });
  }
  const ids = teams.map((t) => t.id);
  const order = [...ids].sort((a, b) => hashString(`${a}${season}`) - hashString(`${b}${season}`));
  const fixtures: LeagueFixture[] = [];
  for (let r = 0; r < LEAGUE_ROUNDS; r++) {
    for (const [home, away] of roundPairs(order, r)) {
      fixtures.push({ round: r, home, away, weather: rng.weighted(WEATHER_POOL, (w) => w[1])[0], attendance: Math.round(rng.range(58, 99)) });
    }
  }
  return { season, level, rivals, teams, fixtures, round: 0, morale: 0, plan: { training: null, press: null }, scorers: {}, news: [] };
}

export function teamById(s: LeagueSeason, id: string) {
  return s.teams.find((t) => t.id === id)!;
}

export function userFixture(s: LeagueSeason, round = s.round) {
  return s.fixtures.find((f) => f.round === round && (f.home === USER_TEAM || f.away === USER_TEAM));
}

export function leagueTable(s: LeagueSeason): TableRow[] {
  const rows = new Map<string, TableRow>(s.teams.map((t) => [t.id, { id: t.id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] }]));
  for (const f of [...s.fixtures].sort((a, b) => a.round - b.round)) {
    if (f.hg === undefined || f.ag === undefined) continue;
    for (const [id, gf, ga] of [
      [f.home, f.hg, f.ag],
      [f.away, f.ag, f.hg],
    ] as const) {
      const r = rows.get(id)!;
      r.p++;
      r.gf += gf;
      r.ga += ga;
      if (gf > ga) {
        r.w++;
        r.pts += 3;
        r.form.push('W');
      } else if (gf === ga) {
        r.d++;
        r.pts++;
        r.form.push('D');
      } else {
        r.l++;
        r.form.push('L');
      }
    }
  }
  return [...rows.values()].sort((a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf || (a.id === USER_TEAM ? -1 : 1));
}

/** Lo que está en juego en la próxima jornada (frase para la previa). */
export function stakesText(s: LeagueSeason): string {
  const table = leagueTable(s);
  const fx = userFixture(s);
  if (!fx) return '';
  const rivalId = fx.home === USER_TEAM ? fx.away : fx.home;
  const pos = table.findIndex((r) => r.id === USER_TEAM) + 1;
  const rpos = table.findIndex((r) => r.id === rivalId) + 1;
  const left = LEAGUE_ROUNDS - s.round;
  if (s.round === 0) return 'Arranca la temporada: primera jornada, todo por escribir.';
  if (pos <= 2 && rpos <= 2) return `Duelo directo por el liderato: ${pos}º contra ${rpos}º.`;
  if (pos <= 2) return left <= 2 ? `Estás en zona de ascenso a falta de ${left} jornadas: ¡no puedes fallar!` : 'Defiendes la zona de ascenso.';
  if (pos >= 7) return left <= 2 ? `Zona de descenso a falta de ${left} jornadas: partido de vida o muerte.` : 'Necesitas puntuar para salir del descenso.';
  if (pos === 3) return 'A un paso del ascenso: si ganas y fallan los de arriba, entras.';
  if (rpos <= 2) return `Visita el ${rpos}º clasificado: una victoria te mete en la pelea.`;
  return `Eres ${pos}º: tres puntos te acercan a los puestos de ascenso.`;
}

/** Plan para contrarrestar el estilo del rival (lo sugiere el analista). */
export function analystPlan(style: PlayStyle): { style: PlayStyle; tip: string } {
  switch (style) {
    case 'highpress':
      return { style: 'direct', tip: 'Presionan muy arriba: los balones largos a la espalda de su defensa son nuestra mejor arma.' };
    case 'possession':
      return { style: 'highpress', tip: 'Quieren el balón: presionemos arriba para robar cerca de su área.' };
    case 'counter':
      return { style: 'possession', tip: 'Esperan atrás para salir rápido: toquemos con paciencia y no perdamos el balón.' };
    case 'direct':
      return { style: 'counter', tip: 'Juegan en largo: defensa ordenada y salidas rápidas al contragolpe.' };
    case 'wings':
      return { style: 'possession', tip: 'Todo su juego pasa por las bandas: tengamos el balón para que no lleguen arriba.' };
    default:
      return { style: 'wings', tip: 'Equipo equilibrado: abrir el campo por las bandas puede desordenarlos.' };
  }
}

export const styleLabel = (s: PlayStyle) => PLAY_STYLES[s].label;

function addDelta(a: Partial<MatchAttributes>, b: Partial<MatchAttributes>) {
  const out: Partial<MatchAttributes> = { ...a };
  for (const [k, v] of Object.entries(b) as [keyof MatchAttributes, number][]) out[k] = (out[k] ?? 0) + v;
  return out;
}
const all = (n: number): Partial<MatchAttributes> => ({ pace: n, shooting: n, passing: n, dribbling: n, defending: n, physical: n, goalkeeping: n, reflexes: n });

export interface MatchContext {
  round: string;
  stadium: string;
  weather: WeatherId;
  attendance: number;
  userHome: boolean;
  stakes: string;
  userBoost: Partial<MatchAttributes>;
  rivalBoost: Partial<MatchAttributes>;
  notes: string[];
}

/** Ambientación y modificadores de la próxima jornada. */
export function matchContext(s: LeagueSeason): MatchContext | null {
  const fx = userFixture(s);
  if (!fx) return null;
  const userHome = fx.home === USER_TEAM;
  const w = WEATHER[fx.weather];
  const notes: string[] = [];
  let user: Partial<MatchAttributes> = { ...w.delta };
  let rival: Partial<MatchAttributes> = { ...w.delta };
  // Ventaja de campo: el público empuja al local.
  if (userHome) {
    user = addDelta(user, all(1));
    notes.push('Juegas en casa: +1 a todo tu equipo');
  } else {
    rival = addDelta(rival, all(1));
    notes.push('Juegas fuera: el rival tiene +1 por su afición');
  }
  let morale = s.morale;
  if (s.plan.press === 'respect') morale += 1;
  if (s.plan.press === 'final') morale += 2;
  morale = Math.max(-3, Math.min(3, morale));
  const m = Math.round(morale * 0.8);
  if (m) {
    user = addDelta(user, all(m));
    notes.push(`Moral ${m > 0 ? 'alta' : 'baja'}: ${m > 0 ? '+' : ''}${m} a todo tu equipo`);
  }
  if (s.plan.press === 'pressure') {
    rival = addDelta(rival, all(-2));
    notes.push('Rival presionado: −2 a todo su equipo');
  }
  if (s.plan.training) {
    const t = TRAINING[s.plan.training];
    user = addDelta(user, t.delta);
    notes.push(`Entrenamiento de ${t.label.toLowerCase()}`);
  }
  if (w.delta && Object.keys(w.delta).length) notes.push(`${w.label}: ${w.effect}`);
  return {
    round: `Jornada ${s.round + 1} de ${LEAGUE_ROUNDS}`,
    stadium: teamById(s, fx.home).stadium,
    weather: fx.weather,
    attendance: fx.attendance,
    userHome,
    stakes: stakesText(s),
    userBoost: user,
    rivalBoost: rival,
    notes,
  };
}

/** Goleadores simulados de un equipo rival. */
function rivalScorers(team: TeamBuild | null, goals: number, seed: string): string[] {
  if (!team || goals <= 0) return [];
  const rng = createRng(hashString(seed));
  const vs = team.versionIds.map((id) => catalog.versions.get(id)!);
  const w = { attack: 5, midfield: 1.8, defence: 0.45, goalkeeper: 0 } as const;
  return Array.from({ length: goals }, () => catalog.players.get(rng.weighted(vs, (v) => w[POSITION_LINE[v.position]] * Math.pow(v.rating / 80, 3)).playerId)!.knownAs);
}

export interface LeagueOutcome {
  season: LeagueSeason;
  /** Fin de temporada (si se ha completado). */
  ended?: { position: number; outcome: 'promoted' | 'relegated' | 'stayed' | 'champion'; bonus: number; level: number; topScorer?: { name: string; goals: number } };
  pressCoins: number;
}

/** Aplica el resultado del usuario, simula el resto de la jornada y avanza. */
export function playRound(s: LeagueSeason, goalsFor: number, goalsAgainst: number, userScorers: string[], userName: string): LeagueOutcome {
  const fx = userFixture(s);
  if (!fx) return { season: s, pressCoins: 0 };
  const userHome = fx.home === USER_TEAM;
  const rng = createRng(hashString(`round-${s.season}-${s.level}-${s.round}`));
  const scorers = { ...s.scorers };
  const addScorer = (name: string, teamId: string) => {
    const key = `${teamId}|${name}`;
    scorers[key] = { name, teamId, goals: (scorers[key]?.goals ?? 0) + 1 };
  };
  const news: string[] = [];
  const fixtures = s.fixtures.map((f) => {
    if (f.round !== s.round) return f;
    if (f === fx) {
      const hg = userHome ? goalsFor : goalsAgainst;
      const ag = userHome ? goalsAgainst : goalsFor;
      const rivalId = userHome ? f.away : f.home;
      for (const n of userScorers) addScorer(n, USER_TEAM);
      for (const n of rivalScorers(rivalTeam(s, rivalId), goalsAgainst, `${s.season}-${s.round}-${rivalId}`)) addScorer(n, rivalId);
      return { ...f, hg, ag };
    }
    const th = rivalTeam(s, f.home);
    const ta = rivalTeam(s, f.away);
    const { hg, ag } = simulateScore(rng, th?.rating ?? 80, ta?.rating ?? 80, 0.2);
    for (const n of rivalScorers(th, hg, `${s.season}-${s.round}-${f.home}-h`)) addScorer(n, f.home);
    for (const n of rivalScorers(ta, ag, `${s.season}-${s.round}-${f.away}-a`)) addScorer(n, f.away);
    const nh = teamById(s, f.home).name;
    const na = teamById(s, f.away).name;
    news.push(hg === ag ? `Reparto de puntos entre ${nh} y ${na} (${hg}-${ag}).` : `${hg > ag ? nh : na} gana ${Math.max(hg, ag)}-${Math.min(hg, ag)} ${hg > ag ? 'a' : 'en casa del'} ${hg > ag ? na : nh}.`);
    return { ...f, hg, ag };
  });
  // Moral y rueda de prensa
  const win = goalsFor > goalsAgainst;
  const loss = goalsFor < goalsAgainst;
  let morale = s.morale + (win ? 1 : loss ? -1 : 0);
  let pressCoins = 0;
  const press = s.plan.press;
  if (press === 'confident') {
    if (win) {
      morale += 2;
      pressCoins = 0.2;
    } else if (loss) morale -= 2;
  } else if (press === 'respect') morale += 1;
  else if (press === 'pressure' && loss) morale -= 1;
  else if (press === 'final') morale += loss ? -3 : 2;
  if (s.plan.training === 'recovery') morale += 1;
  morale = Math.max(-3, Math.min(3, morale));

  let next: LeagueSeason = { ...s, fixtures, scorers, morale, round: s.round + 1, plan: { training: null, press: null }, news };
  if (next.round < LEAGUE_ROUNDS) return { season: next, pressCoins };

  // Fin de temporada
  const table = leagueTable(next);
  const position = table.findIndex((r) => r.id === USER_TEAM) + 1;
  let level = s.level;
  let outcome: 'promoted' | 'relegated' | 'stayed' | 'champion' = 'stayed';
  if (position === 1 && level === 1) outcome = 'champion';
  else if (position <= 2 && level > 1) {
    level--;
    outcome = 'promoted';
  } else if (position >= LEAGUE_TEAMS - 1 && level < 10) {
    level++;
    outcome = 'relegated';
  }
  const bonus = 2000 + (11 - s.level) * 600 + (LEAGUE_TEAMS - position) * 700 + (position === 1 ? 3000 : 0);
  const top = Object.values(next.scorers).sort((a, b) => b.goals - a.goals)[0];
  next = createSeason(level, s.rivals, s.season + 1, userName);
  next.morale = Math.max(-1, Math.min(1, morale));
  return { season: next, pressCoins, ended: { position, outcome, bonus, level, topScorer: top ? { name: top.name, goals: top.goals } : undefined } };
}
