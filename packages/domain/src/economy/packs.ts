import type { Rng } from '@fu/shared';
import { ratingBand, type RatingBandId } from '../cards/edition';
import type { PlayerVersion } from '../players/types';

export interface PackDefinition {
  id: string;
  name: string;
  tagline: string;
  price: number;
  /** Sólo se puede reclamar una vez (sobre de bienvenida). */
  oneTime?: boolean;
  size: number;
  /** Probabilidades por banda de valoración para cada carta (se normalizan). */
  odds: Partial<Record<RatingBandId, number>>;
  /** Al menos `count` cartas con valoración ≥ `minRating`. */
  guaranteed?: { minRating: number; count: number };
  /** Filtro del contenido del sobre. */
  pool?: { minRating?: number; maxYear?: number; minYear?: number };
  theme: 'welcome' | 'gold' | 'premium' | 'elite' | 'classic';
}

export const PACKS: PackDefinition[] = [
  {
    id: 'welcome',
    name: 'Sobre de Bienvenida',
    tagline: 'Tu primer paso. Gratis, una sola vez.',
    price: 0,
    oneTime: true,
    size: 5,
    odds: { b75: 45, b83: 40, b86: 15 },
    guaranteed: { minRating: 85, count: 1 },
    theme: 'welcome',
  },
  {
    id: 'gold',
    name: 'Sobre Oro',
    tagline: '6 cartas · al menos una de 85+',
    price: 5000,
    size: 6,
    odds: { b75: 50, b83: 32, b86: 13, b89: 4.2, b92: 0.8 },
    guaranteed: { minRating: 85, count: 1 },
    theme: 'gold',
  },
  {
    id: 'premium',
    name: 'Sobre Premium',
    tagline: '9 cartas · dos de 86+ garantizadas',
    price: 12500,
    size: 9,
    odds: { b75: 32, b83: 38, b86: 21, b89: 7.3, b92: 1.7 },
    guaranteed: { minRating: 86, count: 2 },
    pool: { minRating: 78 },
    theme: 'premium',
  },
  {
    id: 'elite',
    name: 'Sobre Élite',
    tagline: '3 cartas · una de 90+ garantizada',
    price: 50000,
    size: 3,
    odds: { b86: 55, b89: 33, b92: 12 },
    guaranteed: { minRating: 90, count: 1 },
    pool: { minRating: 86 },
    theme: 'elite',
  },
  {
    id: 'classic',
    name: 'Sobre Clásicos',
    tagline: '1 carta · edición histórica 90+',
    price: 110000,
    size: 1,
    odds: { b89: 60, b92: 40 },
    guaranteed: { minRating: 90, count: 1 },
    pool: { minRating: 90, maxYear: 2010 },
    theme: 'classic',
  },
];

export function getPack(id: string): PackDefinition {
  const p = PACKS.find((x) => x.id === id);
  if (!p) throw new Error(`Sobre desconocido: ${id}`);
  return p;
}

/** Versiones que pueden salir en un sobre. */
export function packPool(pack: PackDefinition, pool: readonly PlayerVersion[]): PlayerVersion[] {
  const f = pack.pool ?? {};
  return pool.filter(
    (v) =>
      (f.minRating === undefined || v.rating >= f.minRating) &&
      (f.maxYear === undefined || v.year <= f.maxYear) &&
      (f.minYear === undefined || v.year >= f.minYear),
  );
}

/**
 * Abre un sobre: devuelve versiones (no cartas) ordenadas de mayor a menor
 * valoración. La creación de PlayerCard con IDs se hace en la capa de estado.
 */
export function openPack(rng: Rng, pack: PackDefinition, pool: readonly PlayerVersion[]): PlayerVersion[] {
  const eligible = packPool(pack, pool);
  const byBand = new Map<RatingBandId, PlayerVersion[]>();
  for (const v of eligible) {
    const b = ratingBand(v.rating);
    const list = byBand.get(b) ?? [];
    list.push(v);
    byBand.set(b, list);
  }
  const bands = (Object.keys(pack.odds) as RatingBandId[]).filter((b) => (byBand.get(b)?.length ?? 0) > 0);
  if (bands.length === 0) throw new Error(`El sobre ${pack.id} no tiene cartas elegibles`);

  const result: PlayerVersion[] = [];
  const used = new Set<string>();
  const takeFrom = (list: PlayerVersion[]) => {
    for (let attempt = 0; attempt < 8; attempt++) {
      // Dentro de una banda, las cartas de mayor valoración son algo menos frecuentes.
      const v = rng.weighted(list, (x) => Math.pow(0.9, x.rating - 75));
      if (!used.has(v.playerId) || attempt === 7) {
        used.add(v.playerId);
        result.push(v);
        return;
      }
    }
  };

  if (pack.guaranteed) {
    const top = eligible.filter((v) => v.rating >= pack.guaranteed!.minRating);
    if (top.length === 0) throw new Error(`El sobre ${pack.id} no puede cumplir su garantía`);
    for (let i = 0; i < pack.guaranteed.count; i++) takeFrom(top);
  }
  while (result.length < pack.size) {
    const band = rng.weighted(bands, (b) => pack.odds[b] ?? 0);
    takeFrom(byBand.get(band)!);
  }
  return result.sort((a, b) => b.rating - a.rating);
}
