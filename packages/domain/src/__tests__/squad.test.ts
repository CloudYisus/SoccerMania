import { describe, expect, it } from 'vitest';
import { createEmptySquad, placeCard, swapSlots, findCard } from '../squad/squad';
import { teamRating } from '../squad/rating';
import { autoAssign } from '../squad/auto';
import { getFormation } from '../squad/formations';

describe('plantilla', () => {
  const playerOf = (id: string) => id.split(':')[0];

  it('coloca e intercambia cartas', () => {
    let s = createEmptySquad('T');
    s = (placeCard(s, { zone: 'starter', index: 0 }, 'a:1', playerOf) as { ok: true; value: typeof s }).value;
    s = (placeCard(s, { zone: 'bench', index: 0 }, 'b:1', playerOf) as { ok: true; value: typeof s }).value;
    s = swapSlots(s, { zone: 'starter', index: 0 }, { zone: 'bench', index: 0 });
    expect(s.starters[0]).toBe('b:1');
    expect(s.bench[0]).toBe('a:1');
    expect(findCard(s, 'a:1')).toEqual({ zone: 'bench', index: 0 });
  });

  it('no permite dos versiones del mismo futbolista', () => {
    let s = createEmptySquad('T');
    s = (placeCard(s, { zone: 'starter', index: 9 }, 'r9:inter', playerOf) as { ok: true; value: typeof s }).value;
    const r = placeCard(s, { zone: 'starter', index: 8 }, 'r9:psv', playerOf);
    expect(r.ok).toBe(false);
    // pero sí sustituir la versión en el mismo slot
    expect(placeCard(s, { zone: 'starter', index: 9 }, 'r9:psv', playerOf).ok).toBe(true);
  });

  it('valoración clásica de equipo', () => {
    expect(teamRating(Array(11).fill(80))).toBe(80);
    // un 99 en un once de 80 sube la media más que la media aritmética
    const ratings = [...Array(10).fill(80), 99];
    const avg = ratings.reduce((a, b) => a + b) / 11;
    expect(teamRating(ratings)).toBeGreaterThanOrEqual(Math.floor(avg));
    expect(teamRating([...Array(10).fill(80), null])).toBeLessThan(80);
  });

  it('autoAssign respeta posiciones naturales y no repite futbolista', () => {
    const f = getFormation('4-3-3');
    const cands = f.slots.map((s, i) => ({ id: `c${i}`, playerId: `p${i}`, position: s.position, altPositions: [], rating: 80 }));
    cands.push({ id: 'dup', playerId: 'p9', position: 'ST', altPositions: [], rating: 99 });
    const res = autoAssign(f, cands);
    expect(res.filter(Boolean)).toHaveLength(11);
    const players = res.map((id) => cands.find((c) => c.id === id)!.playerId);
    expect(new Set(players).size).toBe(11);
    expect(res[9]).toBe('dup');
  });
});
