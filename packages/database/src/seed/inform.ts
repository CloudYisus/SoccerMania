import { CURRENT_YEAR, type CardEvent, type FaceStats, type Player, type PlayerVersion } from '@fu/domain';

/**
 * EQUIPO DE LA SEMANA · cartas "En Forma"
 * Cada carta base de la temporada actual (sin Iconos ni Históricos) tiene una
 * versión En Forma con mejoras. Sólo aparecen en sobres y mercado cuando el
 * futbolista entra en el Equipo de la Semana, que se decide con los partidos
 * que se juegan dentro del juego.
 */
export const TOTW_EVENT: CardEvent = {
  id: 'totw',
  kind: 'totw',
  name: 'Equipo de la Semana',
  cardName: 'EN FORMA',
  year: CURRENT_YEAR,
  description: 'Los mejores de cada jornada del juego. Su versión En Forma sólo se consigue mientras estén en el Equipo de la Semana.',
};

const cap = (n: number) => Math.min(99, n);

function boostStats(s: FaceStats, b: number): FaceStats {
  if (s.kind === 'goalkeeper') return { ...s, div: cap(s.div + b), han: cap(s.han + b), kic: cap(s.kic + b - 1), ref: cap(s.ref + b), spd: cap(s.spd + b - 1), pos: cap(s.pos + b) };
  return { ...s, pac: cap(s.pac + b), sho: cap(s.sho + b), pas: cap(s.pas + b), dri: cap(s.dri + b), def: cap(s.def + b), phy: cap(s.phy + b) };
}

/** Mejora de una carta En Forma: más grande cuanto más baja es la media. */
export function inFormBoost(rating: number) {
  return rating >= 88 ? 2 : rating >= 82 ? 3 : 4;
}

export function inFormCatalog(players: Player[], versions: PlayerVersion[]): PlayerVersion[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  return versions
    .filter((v) => v.year >= CURRENT_YEAR && !v.event && !byId.get(v.playerId)?.icon && !byId.get(v.playerId)?.hero)
    .map((v) => {
      const b = inFormBoost(v.rating);
      return { ...v, id: `${v.id}-if`, rating: cap(v.rating + b), stats: boostStats(v.stats, b), event: TOTW_EVENT.id, milestone: 'Equipo de la Semana' };
    });
}
