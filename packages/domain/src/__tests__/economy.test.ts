import { describe, expect, it } from 'vitest';
import { createRng } from '@fu/shared';
import { marketValue, priceRange, quickSellValue, afterTax, saleProbability } from '../economy/market';
import { PACKS, getPack, openPack, packPool } from '../economy/packs';
import { editionTag, ratingBand, seasonToYear } from '../cards/edition';
import type { PlayerVersion } from '../players/types';
import { addXp } from '../progression/progression';

const pool: PlayerVersion[] = Array.from({ length: 60 }, (_, i) => ({
  id: `v${i}`,
  playerId: `p${i}`,
  label: 'x',
  season: '2025',
  year: i % 3 === 0 ? 1990 + (i % 20) : 2025,
  clubId: 'c',
  nationCode: 'es',
  position: 'CM' as const,
  altPositions: [],
  rating: 76 + (i % 22),
  stats: { kind: 'outfield' as const, pac: 80, sho: 80, pas: 80, dri: 80, def: 80, phy: 80 },
  shirtNumber: 8,
}));

describe('ediciones', () => {
  it('deriva el año de edición de la temporada', () => {
    expect(seasonToYear('1970')).toBe(1970);
    expect(seasonToYear('1997-98')).toBe(1998);
    expect(seasonToYear('1999-00')).toBe(2000);
    expect(seasonToYear('2025-26')).toBe(2026);
    expect(() => seasonToYear('setenta')).toThrow();
    expect(editionTag(1986)).toBe("'86");
  });
  it('clasifica valoraciones en bandas', () => {
    expect(ratingBand(80)).toBe('b75');
    expect(ratingBand(87)).toBe('b86');
    expect(ratingBand(95)).toBe('b92');
  });
});

describe('economía', () => {
  it('el valor crece con la valoración', () => {
    expect(marketValue(90)).toBeGreaterThan(marketValue(85));
    const r = priceRange(85);
    expect(r.min).toBeLessThan(r.max);
    expect(quickSellValue(85)).toBeLessThan(r.min);
    expect(afterTax(1000)).toBe(950);
  });
  it('vender caro es menos probable', () => {
    expect(saleProbability(1000, 1000)).toBeGreaterThan(saleProbability(2000, 1000));
  });
});

describe('sobres', () => {
  it.each(PACKS.map((p) => p.id))('%s respeta tamaño, filtro y garantía', (id) => {
    const pack = getPack(id);
    for (let seed = 1; seed <= 25; seed++) {
      const cards = openPack(createRng(seed), pack, pool);
      expect(cards).toHaveLength(pack.size);
      if (pack.guaranteed) expect(cards.filter((c) => c.rating >= pack.guaranteed!.minRating).length).toBeGreaterThanOrEqual(pack.guaranteed.count);
      const allowed = new Set(packPool(pack, pool).map((v) => v.id));
      expect(cards.every((c) => allowed.has(c.id))).toBe(true);
    }
  });
  it('el sobre Clásicos sólo contiene ediciones históricas', () => {
    const cards = openPack(createRng(3), getPack('classic'), pool);
    expect(cards.every((c) => c.year <= 2010 && c.rating >= 90)).toBe(true);
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
