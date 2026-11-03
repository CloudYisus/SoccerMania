import { describe, expect, it } from 'vitest';
import { autoAssign, getFormation, positionFit, resolveVersion } from '@fu/domain';
import { demoCatalog, OPPONENTS, STARTER } from './index';

describe('catálogo de demostración', () => {
  it('tiene integridad referencial (buildCatalog valida)', () => {
    expect(demoCatalog.versions.size).toBeGreaterThan(50);
  });

  it('las versiones no duplican identidades de jugador', () => {
    const ids = [...demoCatalog.players.keys()];
    expect(new Set(ids).size).toBe(ids.length);
    const r9 = [...demoCatalog.versions.values()].filter((v) => v.playerId === 'r9');
    expect(r9.length).toBeGreaterThanOrEqual(4);
    expect(new Set(r9.map((v) => v.clubId)).size).toBeGreaterThan(1);
  });

  it('el club inicial es válido y sin futbolistas repetidos', () => {
    const all = [...STARTER.lineup, ...STARTER.bench, ...STARTER.reserves];
    all.forEach((id) => expect(demoCatalog.versions.has(id), id).toBe(true));
    const players = [...STARTER.lineup, ...STARTER.bench].map((id) => demoCatalog.versions.get(id)!.playerId);
    expect(new Set(players).size).toBe(players.length);
    const f = getFormation(STARTER.formationId);
    expect(STARTER.lineup).toHaveLength(11);
    expect(resolveVersion(demoCatalog, STARTER.lineup[0]).version.position).toBe(f.slots[0].position);
    expect(positionFit('GK', [], f.slots[0].position)).toBe('natural');
  });

  it('cada rival IA puede formar un once completo', () => {
    const versions = [...demoCatalog.versions.values()];
    for (const o of OPPONENTS) {
      const pool = versions.filter(
        (v) =>
          (!o.pool.rarities || o.pool.rarities.includes(v.rarity)) &&
          (!o.pool.nations || o.pool.nations.includes(v.nationCode)) &&
          (!o.pool.maxRating || v.rating <= o.pool.maxRating),
      );
      const xi = autoAssign(
        getFormation(o.formationId),
        pool.map((v) => ({ id: v.id, playerId: v.playerId, position: v.position, altPositions: v.altPositions, rating: v.rating })),
      );
      expect(xi.filter(Boolean), o.id).toHaveLength(11);
    }
  });
});
