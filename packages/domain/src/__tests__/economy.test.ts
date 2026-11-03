import { describe, expect, it } from 'vitest';
import { createRng } from '@fu/shared';
import { marketValue, priceRange, quickSellValue, afterTax, saleProbability } from '../economy/market';
import { PACKS, getPack, openPack } from '../economy/packs';
import { getRarity } from '../cards/rarity';
import type { PlayerVersion } from '../players/types';
import { addXp } from '../progression/progression';

const pool: PlayerVersion[] = (['common', 'special', 'epic', 'legend', 'icon', 'unique'] as const).flatMap((rarity, ri) =>
  Array.from({ length: 6 }, (_, i) => ({
    id: `${rarity}-${i}`,
    playerId: `${rarity}-${i}`,
    label: 'x',
    season: '2025',
    clubId: 'c',
    nationCode: 'es',
    position: 'CM' as const,
    altPositions: [],
    rating: 78 + ri * 3 + (i % 3),
    stats: { kind: 'outfield' as const, pac: 80, sho: 80, pas: 80, dri: 80, def: 80, phy: 80 },
    rarity,
    shirtNumber: 8,
  })),
);

describe('economía', () => {
  it('el valor crece con rating y rareza', () => {
    expect(marketValue(90, 'common')).toBeGreaterThan(marketValue(85, 'common'));
    expect(marketValue(88, 'icon')).toBeGreaterThan(marketValue(88, 'special'));
    const r = priceRange(85, 'epic');
    expect(r.min).toBeLessThan(r.max);
    expect(quickSellValue(85, 'epic')).toBeLessThan(r.min);
    expect(afterTax(1000)).toBe(950);
  });
  it('vender caro es menos probable', () => {
    expect(saleProbability(1000, 1000)).toBeGreaterThan(saleProbability(2000, 1000));
  });
});

describe('sobres', () => {
  it.each(PACKS.map((p) => p.id))('%s respeta tamaño y garantía', (id) => {
    const pack = getPack(id);
    for (let seed = 1; seed <= 25; seed++) {
      const cards = openPack(createRng(seed), pack, pool);
      expect(cards).toHaveLength(pack.size);
      if (pack.guaranteed) {
        const tier = getRarity(pack.guaranteed.rarity).tier;
        expect(cards.filter((c) => getRarity(c.rarity).tier >= tier).length).toBeGreaterThanOrEqual(pack.guaranteed.count);
      }
      if (pack.minRating) expect(cards.every((c) => c.rating >= pack.minRating!)).toBe(true);
    }
  });
  it('es determinista con la misma semilla', () => {
    const a = openPack(createRng(42), getPack('premium'), pool).map((v) => v.id);
    const b = openPack(createRng(42), getPack('premium'), pool).map((v) => v.id);
    expect(a).toEqual(b);
  });
});

describe('progresión', () => {
  it('sube de nivel al acumular experiencia', () => {
    const r = addXp({ level: 1, xp: 0 }, 5000);
    expect(r.levelsGained).toBeGreaterThan(0);
    expect(r.progress.level).toBe(1 + r.levelsGained);
  });
});
