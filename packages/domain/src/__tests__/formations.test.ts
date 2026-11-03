import { describe, expect, it } from 'vitest';
import { FORMATIONS, FORMATION_IDS, neighbours } from '../squad/formations';

describe('formaciones', () => {
  it.each(FORMATION_IDS)('%s tiene 11 slots válidos y un grafo conexo', (id) => {
    const f = FORMATIONS[id];
    expect(f.slots).toHaveLength(11);
    expect(f.slots[0].position).toBe('GK');
    f.slots.forEach((s, i) => expect(s.index).toBe(i));
    const seen = new Set<string>();
    for (const [a, b] of f.links) {
      expect(a).not.toBe(b);
      const key = [a, b].sort().join('-');
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    // conexo
    const visited = new Set([0]);
    const queue = [0];
    while (queue.length) for (const n of neighbours(f, queue.shift()!)) if (!visited.has(n)) visited.add(n), queue.push(n);
    expect(visited.size).toBe(11);
    // todos con al menos 2 enlaces
    for (const s of f.slots) expect(neighbours(f, s.index).length).toBeGreaterThanOrEqual(2);
  });

  it.each(FORMATION_IDS)('%s: las cartas no se solapan en la vista (12.5% × 17.5%)', (id) => {
    const slots = FORMATIONS[id].slots;
    for (let i = 0; i < slots.length; i++)
      for (let j = i + 1; j < slots.length; j++) {
        const overlapX = Math.abs(slots[i].x - slots[j].x) < 12.5;
        const overlapY = Math.abs(slots[i].y - slots[j].y) < 17.5;
        expect(overlapX && overlapY, `${slots[i].position}#${i} vs ${slots[j].position}#${j}`).toBe(false);
      }
  });
});
