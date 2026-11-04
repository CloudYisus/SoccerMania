/**
 * Ediciones de carta por año (modelo FUT): todas las versiones de un mismo año
 * comparten diseño. El dominio sólo conoce el año; la identidad visual de cada
 * edición vive en la capa de presentación (apps/web/src/components/card/editions.ts).
 */

/**
 * Año de edición a partir de la temporada representada:
 *  "1970" → 1970 · "1997-98" → 1998 · "2025-26" → 2026
 */
export function seasonToYear(season: string): number {
  const single = /^(\d{4})$/.exec(season);
  if (single) return Number(single[1]);
  const split = /^(\d{4})-(\d{2})$/.exec(season);
  if (split) {
    const start = Number(split[1]);
    const end = Math.floor(start / 100) * 100 + Number(split[2]);
    return end < start ? end + 100 : end;
  }
  throw new Error(`Temporada no válida: "${season}" (usa "YYYY" o "YYYY-YY")`);
}

/** Etiqueta corta de edición: 1970 → "'70". */
export function editionTag(year: number): string {
  return `'${String(year).slice(-2)}`;
}

/** Bandas de valoración usadas por sobres y filtros (sustituyen a las rarezas). */
export type RatingBandId = 'b75' | 'b83' | 'b86' | 'b89' | 'b92';

export const RATING_BANDS: { id: RatingBandId; label: string; min: number; max: number }[] = [
  { id: 'b75', label: '82 o menos', min: 0, max: 82 },
  { id: 'b83', label: '83 – 85', min: 83, max: 85 },
  { id: 'b86', label: '86 – 88', min: 86, max: 88 },
  { id: 'b89', label: '89 – 91', min: 89, max: 91 },
  { id: 'b92', label: '92 o más', min: 92, max: 99 },
];

export function ratingBand(rating: number): RatingBandId {
  return RATING_BANDS.find((b) => rating >= b.min && rating <= b.max)!.id;
}

/** Cartas a partir de este rating merecen animación de revelado ("walkout"). */
export const WALKOUT_RATING = 88;

/** Año de la temporada en curso: sus cartas de temporada son las cartas base del juego. */
export const CURRENT_YEAR = 2026;

/** Tipo de carta (para filtros y diseño). */
export type CardType = 'base' | 'season' | 'event' | 'icon';

/** Clasificación de una versión: evento > base (temporada actual) > temporada pasada. */
export function versionType(v: { year: number; event?: string }): 'base' | 'season' | 'event' {
  if (v.event) return 'event';
  return v.year >= CURRENT_YEAR ? 'base' : 'season';
}

/** "2002-03" → "02/03" · "1970" → "1970". */
export function seasonTag(season: string): string {
  const m = /^\d{2}(\d{2})-(\d{2})$/.exec(season);
  return m ? `${m[1]}/${m[2]}` : season;
}
