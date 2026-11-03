import { positionFit } from '../players/positions';
import type { Position } from '../players/types';
import type { Formation } from './formations';

export interface AutoCandidate {
  id: string;
  playerId: string;
  position: Position;
  altPositions: readonly Position[];
  rating: number;
}

/**
 * Asigna automáticamente candidatos a los slots de una formación priorizando
 * encaje natural y rating. Nunca repite futbolista (identidad).
 */
export function autoAssign(formation: Formation, candidates: readonly AutoCandidate[]): (string | null)[] {
  const used = new Set<string>();
  const result: (string | null)[] = Array(formation.slots.length).fill(null);
  const fitScore = { natural: 2, related: 1, poor: 0 } as const;
  for (const pass of [2, 1, 0]) {
    // Slots más restrictivos primero (portero, defensas).
    for (const slot of formation.slots) {
      if (result[slot.index]) continue;
      const best = candidates
        .filter((c) => !used.has(c.playerId) && fitScore[positionFit(c.position, c.altPositions, slot.position)] >= pass)
        .sort((a, b) => b.rating - a.rating)[0];
      if (best) {
        result[slot.index] = best.id;
        used.add(best.playerId);
      }
    }
  }
  return result;
}
