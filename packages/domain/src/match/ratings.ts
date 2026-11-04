import type { MatchEvent, MatchTeamSetup, TeamSide } from './types';
import { POSITION_LINE } from '../players/positions';

/** Nota de un jugador en un partido (escala 3–10) y lo que la justifica. */
export interface PlayerMatchRating {
  id: string;
  name: string;
  side: TeamSide;
  versionId?: string;
  rating: number;
  goals: number;
  assists: number;
  shots: number;
  saves: number;
  tackles: number;
  interceptions: number;
  dribbles: number;
  passes: number;
}

/**
 * Notas del partido a partir de los eventos del motor: goles, asistencias,
 * disparos, paradas, entradas, intercepciones, regates y pases, más el
 * resultado y las porterías a cero. El mejor del partido es la nota más alta.
 */
export function matchRatings(events: readonly MatchEvent[], teams: Record<TeamSide, MatchTeamSetup>, score: { home: number; away: number }): PlayerMatchRating[] {
  const rows = new Map<string, PlayerMatchRating & { fouls: number; cards: number; line: string; good: number }>();
  for (const side of ['home', 'away'] as const) {
    for (const p of teams[side].players) {
      rows.set(p.id, {
        id: p.id,
        name: p.name,
        side,
        versionId: p.versionId,
        rating: 0,
        goals: 0,
        assists: 0,
        shots: 0,
        saves: 0,
        tackles: 0,
        interceptions: 0,
        dribbles: 0,
        passes: 0,
        fouls: 0,
        cards: 0,
        good: 0,
        line: POSITION_LINE[p.position],
      });
    }
  }
  const get = (id?: string) => (id ? rows.get(id) : undefined);
  for (const e of events) {
    const p = get(e.playerId);
    switch (e.type) {
      case 'goal':
        if (p) p.goals++;
        if (get(e.otherId)) get(e.otherId)!.assists++;
        break;
      case 'shot':
        if (p) p.shots++;
        break;
      case 'save':
        if (p) p.saves++;
        break;
      case 'tackle':
        if (p) p.tackles++;
        break;
      case 'interception':
        if (p) p.interceptions++;
        break;
      case 'dribble':
        if (p) p.dribbles++;
        break;
      case 'pass':
        if (p) p.passes++;
        break;
      case 'foul':
        if (p) p.fouls++;
        break;
      case 'card':
        if (p) p.cards++;
        break;
      case 'decision':
        if (p && e.decision && (e.decision.grade === 'great' || e.decision.grade === 'good')) p.good++;
        break;
    }
  }
  const out: PlayerMatchRating[] = [];
  for (const r of rows.values()) {
    const forGoals = r.side === 'home' ? score.home : score.away;
    const against = r.side === 'home' ? score.away : score.home;
    let v = 6.2;
    v += r.goals * 1.1 + (r.goals >= 3 ? 0.4 : 0);
    v += r.assists * 0.7;
    v += r.shots * 0.1;
    v += r.saves * 0.35;
    v += r.tackles * 0.18 + r.interceptions * 0.14;
    v += r.dribbles * 0.12;
    v += Math.min(0.7, r.passes * 0.012);
    v += r.good * 0.08;
    v -= r.fouls * 0.1 + r.cards * 0.35;
    v += forGoals > against ? 0.3 : forGoals < against ? -0.2 : 0;
    if (r.line === 'goalkeeper') v += against === 0 ? 0.6 : -0.25 * against;
    else if (r.line === 'defence') v += against === 0 ? 0.35 : -0.12 * against;
    const { fouls: _f, cards: _c, line: _l, good: _g, ...rest } = r;
    out.push({ ...rest, rating: Math.round(Math.max(3, Math.min(10, v)) * 10) / 10 });
  }
  return out.sort((a, b) => b.rating - a.rating || b.goals - a.goals);
}

/** Mejor jugador del partido (de cualquiera de los dos equipos). */
export function manOfTheMatch(ratings: PlayerMatchRating[]): PlayerMatchRating | undefined {
  return ratings[0];
}
