import type { PlayerMatchRating } from './ratings';
import type { MatchEvent, MatchTeamSetup, ShotStory, TeamSide } from './types';

/** Momento destacado del partido contado como una crónica breve y emocionante. */
export interface StoryMoment {
  minute: number;
  side: TeamSide | null;
  playerId?: string;
  /** Icono temático: gol, golazo, parada, remontada… */
  icon: 'goal' | 'wonder' | 'save' | 'comeback' | 'late' | 'hattrick' | 'post' | 'injury' | 'penalty' | 'wall';
  title: string;
  text: string;
  /** Relevancia (para elegir los mejores momentos). */
  weight: number;
}

export interface MatchStory {
  headline: string;
  moments: StoryMoment[];
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function finish(s: ShotStory | undefined): string {
  if (!s) return 'la mandó al fondo de la red';
  if (s.mode === 'emptynet') return 'dejó sentado al portero y empujó a puerta vacía';
  if (s.mode === 'penalty') return 'no perdonó desde los once metros';
  if (s.mode === 'freekick') return `clavó un tiro libre directo desde ${s.distance} metros`;
  if (s.mode === 'header') return s.assist === 'cross' ? 'se elevó más que nadie y la cabeceó a la red' : 'la remató de cabeza a la red';
  if (s.style === 'chip') return 'picó el balón por encima del portero';
  if (s.style === 'volley') return 'la enganchó de volea';
  if (s.style === 'finesse') return 'la colocó con rosca junto al palo';
  if (s.style === 'power' || s.distance >= 24) return s.distance >= 24 ? `soltó un misil desde ${s.distance} metros` : 'la reventó con un disparo potentísimo';
  if (s.distance <= 7) return 'la empujó a bocajarro';
  return 'definió con frialdad';
}

/**
 * Resumen narrado: los momentos más espectaculares o decisivos del partido,
 * contados de forma fácil de entender ("X corrió 50 metros, eludió al portero y ¡GOL!").
 */
export function matchStory(
  events: readonly MatchEvent[],
  teams: Record<TeamSide, MatchTeamSetup>,
  score: { home: number; away: number },
  ratings: PlayerMatchRating[] = [],
): MatchStory {
  const names = new Map<string, string>();
  for (const side of ['home', 'away'] as const) for (const p of teams[side].players) names.set(p.id, p.name);
  const name = (id?: string) => (id ? (names.get(id) ?? '') : '');
  const teamName = (side: TeamSide) => teams[side].name;
  const moments: StoryMoment[] = [];
  const run = { home: 0, away: 0 };
  let worstDeficit: Record<TeamSide, number> = { home: 0, away: 0 };
  const goalsBy = new Map<string, number>();

  for (const e of events) {
    if (e.type === 'goal' && e.side) {
      const side = e.side;
      const other: TeamSide = side === 'home' ? 'away' : 'home';
      const before = run[side] - run[other];
      run[side]++;
      const after = run[side] - run[other];
      worstDeficit = {
        home: Math.min(worstDeficit.home, run.home - run.away),
        away: Math.min(worstDeficit.away, run.away - run.home),
      };
      const s = e.story;
      const scorer = name(e.playerId);
      const assister = name(e.otherId);
      goalsBy.set(e.playerId ?? '', (goalsBy.get(e.playerId ?? '') ?? 0) + 1);
      let text: string;
      let weight = 3;
      let icon: StoryMoment['icon'] = 'goal';
      if (s && s.carry >= 30) {
        text = `${scorer} arrancó con el balón, recorrió ${s.carry} metros a toda velocidad${s.beaten ? `, se fue de ${plural(s.beaten, 'rival', 'rivales')}` : ''} y ${finish(s)}. ¡GOL!`;
        weight += 3 + s.carry / 20 + s.beaten;
        icon = 'wonder';
      } else if (s && s.beaten >= 2) {
        text = `${scorer} dejó atrás a ${plural(s.beaten, 'rival', 'rivales')} en un palmo de terreno y ${finish(s)}. ¡GOL!`;
        weight += 2 + s.beaten;
        icon = 'wonder';
      } else if (s?.mode === 'emptynet') {
        text = `${scorer} se plantó solo ante el portero, ${finish(s)}. ¡GOL!`;
        weight += 2.5;
        icon = 'wonder';
      } else if (s && (s.distance >= 24 || s.mode === 'freekick')) {
        text = `¡Golazo! ${scorer} ${finish(s)}.`;
        weight += 3 + Math.max(0, s.distance - 22) / 4;
        icon = 'wonder';
      } else if (assister && s?.assist === 'cross') {
        text = `${assister} la puso desde la banda y ${scorer} ${finish(s)}.`;
        weight += 1;
      } else if (assister && s?.assist === 'through') {
        text = `${assister} filtró un pase al hueco, ${scorer} se quedó solo y ${finish(s)}.`;
        weight += 1.2;
      } else if (assister) {
        text = `${scorer} ${finish(s)} tras el pase de ${assister}.`;
      } else {
        text = `${scorer} ${finish(s)}.`;
      }
      if (s?.style === 'volley' || s?.style === 'chip') {
        weight += 1.5;
        icon = 'wonder';
      }
      if (s?.decision) weight += 0.8;
      let title = `GOL · ${teamName(side)} ${run.home}-${run.away}`;
      // Contexto del marcador
      if (e.minute >= 84 && before <= 0 && after >= 0) {
        weight += 4;
        icon = 'late';
        title = after === 0 ? `EMPATE AL FINAL · ${run.home}-${run.away}` : `GOL DE LA VICTORIA · ${run.home}-${run.away}`;
        text += after === 0 ? ` Minuto ${e.minute}: ¡empate cuando el partido se escapaba!` : ` Minuto ${e.minute}: ¡un gol que vale un partido!`;
      } else if (before === 0 && after === 1 && run[side] + run[other] === 1) {
        weight += 0.5;
        title = `PRIMER GOL · ${run.home}-${run.away}`;
      } else if (before < 0 && after === 0) {
        weight += 1;
        title = `EMPATE · ${run.home}-${run.away}`;
      }
      if (s?.mode === 'penalty') icon = 'penalty';
      moments.push({ minute: e.minute, side, playerId: e.playerId, icon, title, text, weight });
      const g = goalsBy.get(e.playerId ?? '')!;
      if (g === 3) {
        moments.push({
          minute: e.minute,
          side,
          playerId: e.playerId,
          icon: 'hattrick',
          title: '¡HAT-TRICK!',
          text: `${scorer} firma su tercer gol del partido. Se lleva el balón a casa.`,
          weight: 8,
        });
      }
    } else if (e.type === 'highlight' && e.highlight) {
      const h = e.highlight;
      if (h.kind === 'bigsave' && h.title.includes('PENALTI')) {
        moments.push({ minute: e.minute, side: e.side, playerId: e.playerId, icon: 'save', title: '¡PENALTI PARADO!', text: `${name(e.playerId)} adivinó la intención de ${name(e.otherId)} y detuvo el penalti.`, weight: 6 });
      } else if (h.kind === 'bigsave' && h.title.includes('PARADÓN')) {
        moments.push({ minute: e.minute, side: e.side, playerId: e.playerId, icon: 'save', title: '¡PARADÓN!', text: `${name(e.playerId)} voló para negarle el gol a ${name(e.otherId)}.`, weight: 3 });
      } else if (h.kind === 'woodwork') {
        moments.push({ minute: e.minute, side: e.side, playerId: e.playerId, icon: 'post', title: '¡AL PALO!', text: `${name(e.playerId) || 'El disparo'} estuvo a centímetros del gol: el balón se estrelló en la madera.`, weight: 1.8 });
      }
    } else if (e.type === 'injury') {
      moments.push({
        minute: e.minute,
        side: e.side,
        playerId: e.playerId,
        icon: 'injury',
        title: 'LESIÓN',
        text: `${name(e.playerId)} cayó lesionado y terminó el partido mermado. Estará ${plural(e.injuryMatches ?? 1, 'partido', 'partidos')} de baja.`,
        weight: 5,
      });
    }
  }

  // Muro bajo palos
  for (const r of ratings) {
    if (r.saves >= 5) {
      moments.push({ minute: 90, side: r.side, playerId: r.id, icon: 'wall', title: 'UN MURO BAJO PALOS', text: `${r.name} sostuvo a su equipo con ${r.saves} paradas.`, weight: 2 + r.saves * 0.5 });
    }
  }

  // Remontada
  const winner: TeamSide | null = score.home > score.away ? 'home' : score.away > score.home ? 'away' : null;
  let headline: string;
  const diff = Math.abs(score.home - score.away);
  if (winner && worstDeficit[winner] <= -1) {
    moments.push({
      minute: 90,
      side: winner,
      icon: 'comeback',
      title: '¡REMONTADA!',
      text: `${teamName(winner)} llegó a ir perdiendo por ${plural(-worstDeficit[winner], 'gol', 'goles')} y acabó ganando ${score.home}-${score.away}.`,
      weight: 7 + -worstDeficit[winner],
    });
    headline = '¡Remontada épica!';
  } else if (winner && diff >= 4) headline = `Goleada de ${teamName(winner)}`;
  else if (winner && diff === 1 && moments.some((m) => m.icon === 'late')) headline = 'Victoria en el último suspiro';
  else if (winner) headline = `Victoria de ${teamName(winner)}`;
  else if (score.home === 0) headline = 'Empate sin goles';
  else if (score.home >= 3) headline = 'Locura de goles y reparto de puntos';
  else headline = 'Reparto de puntos';

  const top = [...moments].sort((a, b) => b.weight - a.weight).slice(0, 5);
  top.sort((a, b) => a.minute - b.minute);
  return { headline, moments: top };
}
