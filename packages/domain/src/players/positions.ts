import type { Position } from './types';

export const POSITION_LABELS: Record<Position, string> = {
  GK: 'POR',
  RB: 'LD',
  RWB: 'CAD',
  CB: 'DFC',
  LB: 'LI',
  LWB: 'CAI',
  CDM: 'MCD',
  CM: 'MC',
  CAM: 'MCO',
  RM: 'MD',
  LM: 'MI',
  RW: 'ED',
  LW: 'EI',
  CF: 'SD',
  ST: 'DC',
};

export type PositionLine = 'goalkeeper' | 'defence' | 'midfield' | 'attack';

export const POSITION_LINE: Record<Position, PositionLine> = {
  GK: 'goalkeeper',
  RB: 'defence',
  RWB: 'defence',
  CB: 'defence',
  LB: 'defence',
  LWB: 'defence',
  CDM: 'midfield',
  CM: 'midfield',
  CAM: 'midfield',
  RM: 'midfield',
  LM: 'midfield',
  RW: 'attack',
  LW: 'attack',
  CF: 'attack',
  ST: 'attack',
};

/**
 * Posiciones "relacionadas" (encaje parcial) del modelo clásico.
 * Una posición que no es natural ni relacionada es un encaje pobre.
 */
const RELATED: Record<Position, Position[]> = {
  GK: [],
  CB: [],
  RB: ['RWB'],
  RWB: ['RB', 'RM'],
  LB: ['LWB'],
  LWB: ['LB', 'LM'],
  CDM: ['CM'],
  CM: ['CDM', 'CAM'],
  CAM: ['CM', 'CF'],
  RM: ['RW', 'RWB'],
  LM: ['LW', 'LWB'],
  RW: ['RM'],
  LW: ['LM'],
  CF: ['CAM', 'ST'],
  ST: ['CF'],
};

export type PositionFit = 'natural' | 'related' | 'poor';

/**
 * Encaje de un futbolista en una posición de la formación.
 * - natural: su posición de carta.
 * - related: posición vecina o una de sus posiciones alternativas.
 * - poor: cualquier otra.
 */
export function positionFit(cardPosition: Position, altPositions: readonly Position[], slotPosition: Position): PositionFit {
  if (cardPosition === slotPosition) return 'natural';
  if (altPositions.includes(slotPosition)) return 'related';
  if (RELATED[cardPosition]?.includes(slotPosition)) return 'related';
  return 'poor';
}
