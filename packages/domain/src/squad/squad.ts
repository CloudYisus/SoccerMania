import type { Result } from '@fu/shared';
import type { FormationId } from './formations';
import type { TeamTactics, PlayerInstruction } from '../tactics/tactics';
import { DEFAULT_TACTICS } from '../tactics/tactics';

export const STARTERS = 11;
export const BENCH_SIZE = 7;

export interface Manager {
  id: string;
  name: string;
  nationCode: string;
  leagueId: string;
}

export interface Squad {
  name: string;
  formationId: FormationId;
  /** cardId por slot de la formación (índice estable). */
  starters: (string | null)[];
  bench: (string | null)[];
  managerId: string | null;
  tactics: TeamTactics;
  /** Instrucciones individuales por defecto (por cardId). */
  instructions: Record<string, PlayerInstruction>;
}

export type SlotRef = { zone: 'starter' | 'bench'; index: number };

export function createEmptySquad(name: string, formationId: FormationId = '4-3-3'): Squad {
  return {
    name,
    formationId,
    starters: Array(STARTERS).fill(null),
    bench: Array(BENCH_SIZE).fill(null),
    managerId: null,
    tactics: { ...DEFAULT_TACTICS },
    instructions: {},
  };
}

export function getSlot(squad: Squad, ref: SlotRef): string | null {
  return (ref.zone === 'starter' ? squad.starters : squad.bench)[ref.index] ?? null;
}

export function findCard(squad: Squad, cardId: string): SlotRef | null {
  const s = squad.starters.indexOf(cardId);
  if (s >= 0) return { zone: 'starter', index: s };
  const b = squad.bench.indexOf(cardId);
  if (b >= 0) return { zone: 'bench', index: b };
  return null;
}

function setSlot(squad: Squad, ref: SlotRef, cardId: string | null): Squad {
  const key = ref.zone === 'starter' ? 'starters' : 'bench';
  const arr = [...squad[key]];
  arr[ref.index] = cardId;
  return { ...squad, [key]: arr };
}

/** Intercambia el contenido de dos slots (titular↔titular, titular↔suplente…). */
export function swapSlots(squad: Squad, a: SlotRef, b: SlotRef): Squad {
  const ca = getSlot(squad, a);
  const cb = getSlot(squad, b);
  return setSlot(setSlot(squad, a, cb), b, ca);
}

/**
 * Coloca una carta en un slot.
 * - Si la carta ya está en la plantilla, intercambia posiciones.
 * - Si otra versión del mismo futbolista está en otro slot, se rechaza
 *   (un futbolista no puede figurar dos veces en la plantilla).
 */
export function placeCard(
  squad: Squad,
  ref: SlotRef,
  cardId: string,
  playerIdOf: (cardId: string) => string,
): Result<Squad> {
  const existing = findCard(squad, cardId);
  if (existing) return { ok: true, value: swapSlots(squad, existing, ref) };
  const playerId = playerIdOf(cardId);
  const all: { ref: SlotRef; id: string | null }[] = [
    ...squad.starters.map((id, index) => ({ ref: { zone: 'starter' as const, index }, id })),
    ...squad.bench.map((id, index) => ({ ref: { zone: 'bench' as const, index }, id })),
  ];
  const clash = all.find(
    (e) => e.id && playerIdOf(e.id) === playerId && !(e.ref.zone === ref.zone && e.ref.index === ref.index),
  );
  if (clash) return { ok: false, error: 'Este futbolista ya forma parte de la plantilla con otra carta.' };
  return { ok: true, value: setSlot(squad, ref, cardId) };
}

export function removeFromSquad(squad: Squad, ref: SlotRef): Squad {
  return setSlot(squad, ref, null);
}

export function changeFormation(squad: Squad, formationId: FormationId): Squad {
  return { ...squad, formationId };
}

export function squadCardIds(squad: Squad): string[] {
  return [...squad.starters, ...squad.bench].filter((x): x is string => !!x);
}
