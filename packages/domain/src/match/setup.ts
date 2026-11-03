import type { FaceStats, Position } from '../players/types';
import type { Formation } from '../squad/formations';
import type { PlayerInstruction, TeamTactics } from '../tactics/tactics';
import { chemistryPerformanceFactor } from '../chemistry/chemistry';
import type { MatchAttributes, MatchTeamSetup } from './types';

/** Convierte las 6 estadísticas de carta en atributos de simulación. */
export function toMatchAttributes(stats: FaceStats, chemistry: number): MatchAttributes {
  const f = chemistryPerformanceFactor(chemistry);
  const base: MatchAttributes =
    stats.kind === 'outfield'
      ? {
          pace: stats.pac,
          shooting: stats.sho,
          passing: stats.pas,
          dribbling: stats.dri,
          defending: stats.def,
          physical: stats.phy,
          goalkeeping: 15,
          reflexes: 20,
        }
      : {
          pace: stats.spd,
          shooting: 20,
          passing: stats.kic,
          dribbling: 35,
          defending: Math.round(stats.pos * 0.6),
          physical: 60,
          goalkeeping: Math.round((stats.div + stats.han + stats.pos) / 3),
          reflexes: stats.ref,
        };
  const out = { ...base };
  for (const k of Object.keys(out) as (keyof MatchAttributes)[]) out[k] = Math.round(out[k] * f);
  return out;
}

export interface LineupEntry {
  id: string;
  name: string;
  number: number;
  stats: FaceStats;
  chemistry: number;
  instruction?: PlayerInstruction;
}

/** Construye la configuración de un equipo para el motor a partir de una formación y sus 11 titulares. */
export function buildTeamSetup(params: {
  id: string;
  name: string;
  shortName: string;
  colors: { primary: string; secondary: string };
  formation: Formation;
  tactics: TeamTactics;
  lineup: LineupEntry[];
  rating: number;
  chemistry: number;
}): MatchTeamSetup {
  if (params.lineup.length !== 11) throw new Error('La alineación debe tener 11 jugadores');
  return {
    id: params.id,
    name: params.name,
    shortName: params.shortName,
    colors: params.colors,
    formationId: params.formation.id,
    tactics: params.tactics,
    rating: params.rating,
    chemistry: params.chemistry,
    players: params.lineup.map((p, i) => {
      const slot = params.formation.slots[i];
      return {
        id: p.id,
        name: p.name,
        number: p.number,
        position: slot.position as Position,
        anchor: { x: slot.x, y: slot.y },
        attributes: toMatchAttributes(p.stats, p.chemistry),
        chemistry: p.chemistry,
        instruction: p.instruction ?? 'none',
      };
    }),
  };
}
