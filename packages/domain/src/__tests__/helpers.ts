import { buildTeamSetup, getFormation, type FaceStats, type FormationId, type MatchTeamSetup } from '../index';
import { DEFAULT_TACTICS } from '../tactics/tactics';

/** Equipo sintético con todos los atributos al mismo nivel. */
export function syntheticTeam(id: string, level: number, formationId: FormationId = '4-3-3', chemistry = 10): MatchTeamSetup {
  const formation = getFormation(formationId);
  return buildTeamSetup({
    id,
    name: id,
    shortName: id.toUpperCase(),
    colors: { primary: '#fff', secondary: '#000' },
    formation,
    tactics: { ...DEFAULT_TACTICS },
    rating: level,
    chemistry: chemistry * 10,
    lineup: formation.slots.map((s, i) => {
      const stats: FaceStats =
        s.position === 'GK'
          ? { kind: 'goalkeeper', div: level, han: level, kic: level, ref: level, spd: level - 20, pos: level }
          : { kind: 'outfield', pac: level, sho: level, pas: level, dri: level, def: level, phy: level };
      return { id: `${id}-${i}`, name: `${id}${i}`, number: i + 1, stats, chemistry };
    }),
  });
}
