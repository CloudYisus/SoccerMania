import type { Rng } from '@fu/shared';
import { getRarity, type RarityId } from '../cards/rarity';
import type { PlayerVersion } from '../players/types';

export interface PackDefinition {
  id: string;
  name: string;
  tagline: string;
  price: number;
  /** Sólo se puede reclamar una vez (sobre de bienvenida). */
  oneTime?: boolean;
  size: number;
  /** Probabilidades por rareza para cada carta (se normalizan). */
  odds: Partial<Record<RarityId, number>>;
  /** Rareza mínima garantizada en al menos una carta. */
  guaranteed?: { rarity: RarityId; count: number };
  /** Rating mínimo de las cartas del sobre. */
  minRating?: number;
  theme: 'gold' | 'premium' | 'legend' | 'icon' | 'welcome';
}

export const PACKS: PackDefinition[] = [
  {
    id: 'welcome',
    name: 'Sobre de Bienvenida',
    tagline: 'Tu primer paso. Gratis, una sola vez.',
    price: 0,
    oneTime: true,
    size: 5,
    odds: { common: 55, special: 35, epic: 10 },
    guaranteed: { rarity: 'special', count: 1 },
    theme: 'welcome',
  },
  {
    id: 'gold',
    name: 'Sobre Oro',
    tagline: '6 cartas · al menos una Especial',
    price: 5000,
    size: 6,
    odds: { common: 58, special: 30, epic: 9, legend: 2.4, icon: 0.5, unique: 0.1 },
    guaranteed: { rarity: 'special', count: 1 },
    theme: 'gold',
  },
  {
    id: 'premium',
    name: 'Sobre Premium',
    tagline: '9 cartas · 2 Especiales o superior',
    price: 12500,
    size: 9,
    odds: { common: 45, special: 36, epic: 13, legend: 4.5, icon: 1.2, unique: 0.3 },
    guaranteed: { rarity: 'special', count: 2 },
    minRating: 78,
    theme: 'premium',
  },
  {
    id: 'legend',
    name: 'Sobre Leyendas',
    tagline: '3 cartas · Leyenda garantizada',
    price: 50000,
    size: 3,
    odds: { special: 50, epic: 30, legend: 16, icon: 3, unique: 1 },
    guaranteed: { rarity: 'legend', count: 1 },
    minRating: 84,
    theme: 'legend',
  },
  {
    id: 'icon',
    name: 'Sobre Icono',
    tagline: '1 carta · Icono garantizado',
    price: 110000,
    size: 1,
    odds: { icon: 100 },
    guaranteed: { rarity: 'icon', count: 1 },
    theme: 'icon',
  },
];

export function getPack(id: string): PackDefinition {
  const p = PACKS.find((x) => x.id === id);
  if (!p) throw new Error(`Sobre desconocido: ${id}`);
  return p;
}

/**
 * Abre un sobre: devuelve versiones (no cartas) ordenadas de mayor a menor
 * exclusividad. La creación de PlayerCard con IDs se hace en la capa de estado.
 */
export function openPack(rng: Rng, pack: PackDefinition, pool: readonly PlayerVersion[]): PlayerVersion[] {
  const eligible = pool.filter((v) => !pack.minRating || v.rating >= pack.minRating);
  const byRarity = new Map<RarityId, PlayerVersion[]>();
  for (const v of eligible) {
    const list = byRarity.get(v.rarity) ?? [];
    list.push(v);
    byRarity.set(v.rarity, list);
  }
  const rarities = (Object.keys(pack.odds) as RarityId[]).filter((r) => (byRarity.get(r)?.length ?? 0) > 0);
  if (rarities.length === 0) throw new Error(`El sobre ${pack.id} no tiene cartas elegibles`);

  const drawFrom = (rarity: RarityId): PlayerVersion => {
    const list = byRarity.get(rarity)!;
    // Dentro de una rareza, las cartas de mayor rating son algo menos frecuentes.
    return rng.weighted(list, (v) => Math.pow(0.9, v.rating - 75));
  };
  const drawRarity = () => rng.weighted(rarities, (r) => pack.odds[r] ?? 0);

  const result: PlayerVersion[] = [];
  const used = new Set<string>();
  const take = (rarity: RarityId) => {
    for (let attempt = 0; attempt < 8; attempt++) {
      const v = drawFrom(rarity);
      if (!used.has(v.playerId) || attempt === 7) {
        used.add(v.playerId);
        result.push(v);
        return;
      }
    }
  };

  if (pack.guaranteed) {
    const minTier = getRarity(pack.guaranteed.rarity).tier;
    const upgraded = rarities.filter((r) => getRarity(r).tier >= minTier);
    for (let i = 0; i < pack.guaranteed.count; i++) {
      take(rng.weighted(upgraded, (r) => pack.odds[r] ?? 0));
    }
  }
  while (result.length < pack.size) take(drawRarity());

  return result.sort((a, b) => getRarity(b.rarity).tier - getRarity(a.rarity).tier || b.rating - a.rating);
}
