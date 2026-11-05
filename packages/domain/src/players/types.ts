import type { FlagCode } from '../world/types';

export type Position =
  | 'GK'
  | 'RB'
  | 'RWB'
  | 'CB'
  | 'LB'
  | 'LWB'
  | 'CDM'
  | 'CM'
  | 'CAM'
  | 'RM'
  | 'LM'
  | 'RW'
  | 'LW'
  | 'CF'
  | 'ST';

export interface OutfieldStats {
  kind: 'outfield';
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
}

export interface GoalkeeperStats {
  kind: 'goalkeeper';
  div: number;
  han: number;
  kic: number;
  ref: number;
  spd: number;
  pos: number;
}

export type FaceStats = OutfieldStats | GoalkeeperStats;

/** Player: identidad única del futbolista (nunca se duplica por versión). */
export interface Player {
  id: string;
  /** Nombre que aparece en la carta. */
  knownAs: string;
  fullName: string;
  nationCode: FlagCode;
  birthYear: number;
  /**
   * Icono: leyenda retirada del fútbol. Es una propiedad de la IDENTIDAD, no de
   * la versión: todas sus cartas lo muestran y aplican la química de Icono.
   */
  icon: boolean;
  /**
   * Histórico: futbolista retirado con etapas memorables que no llega a Icono.
   * Comparte categoría con los Iconos (sello "HISTÓRICO" en todas sus cartas).
   */
  hero?: boolean;
  /** ID del jugador en API-Football (fotografía oficial del proveedor), si existe. */
  apiFootballId?: number | null;
}

/** PlayerVersion: etapa/temporada concreta representada por una carta. */
export interface PlayerVersion {
  id: string;
  playerId: string;
  /** Etiqueta de la versión, p. ej. "Brasil '70" o "Inter 97-98". */
  label: string;
  /** Temporada o año representado ("1970", "2025-26"). */
  season: string;
  /** Año de edición de la carta (define su diseño). Derivado de `season`. */
  year: number;
  /** Club representado en esta versión (determina liga y química). */
  clubId: string;
  /** Nación representada (normalmente la del jugador). */
  nationCode: FlagCode;
  position: Position;
  altPositions: Position[];
  rating: number;
  stats: FaceStats;
  shirtNumber: number;
  /** Hito asociado (p. ej. "Campeones del mundo"). */
  milestone?: string;
  /** Evento/equipo temático al que pertenece (p. ej. "toty-2012"): carta especial. */
  event?: string;
}

export const OUTFIELD_STAT_KEYS = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'] as const;
export const GOALKEEPER_STAT_KEYS = ['div', 'han', 'kic', 'ref', 'spd', 'pos'] as const;

export const STAT_LABELS: Record<string, string> = {
  pac: 'RIT',
  sho: 'TIR',
  pas: 'PAS',
  dri: 'REG',
  def: 'DEF',
  phy: 'FÍS',
  div: 'EST',
  han: 'MAN',
  kic: 'SAQ',
  ref: 'REF',
  spd: 'VEL',
  pos: 'COL',
};

export function statEntries(stats: FaceStats): { key: string; label: string; value: number }[] {
  const keys = stats.kind === 'outfield' ? OUTFIELD_STAT_KEYS : GOALKEEPER_STAT_KEYS;
  return keys.map((k) => ({
    key: k,
    label: STAT_LABELS[k],
    value: (stats as unknown as Record<string, number>)[k],
  }));
}
