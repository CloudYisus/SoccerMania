import type { Position } from '../players/types';

/**
 * Coordenadas de la vista de plantilla:
 *  x: 0 (banda izquierda) → 100 (banda derecha)
 *  y: 0 (portería rival)   → 100 (portería propia)
 * Los índices de slot son estables entre formaciones (0 = portero) para que
 * el cambio de formación conserve a cada futbolista y se pueda animar.
 */
export interface FormationSlot {
  index: number;
  position: Position;
  x: number;
  y: number;
}

export type FormationId =
  | '4-3-3'
  | '4-2-3-1'
  | '4-4-2'
  | '3-5-2'
  | '4-1-4-1'
  | '4-3-1-2'
  | '3-4-3'
  | '3-4-1-2'
  | '5-3-2'
  | '5-4-1'
  | '4-2-2-2'
  | '4-3-2-1'
  | '4-4-1-1'
  | '4-5-1';

export interface Formation {
  id: FormationId;
  name: string;
  /** Descripción táctica corta. */
  style: string;
  slots: FormationSlot[];
  /** Grafo de enlaces de química (aristas no dirigidas entre índices de slot). */
  links: [number, number][];
}

const s = (index: number, position: Position, x: number, y: number): FormationSlot => ({ index, position, x, y });

const BACK_FOUR = [s(0, 'GK', 50, 89), s(1, 'LB', 12, 69), s(2, 'CB', 36, 73), s(3, 'CB', 64, 73), s(4, 'RB', 88, 69)];
const BACK_FOUR_LINKS: [number, number][] = [
  [0, 2],
  [0, 3],
  [1, 2],
  [2, 3],
  [3, 4],
];

export const FORMATIONS: Record<FormationId, Formation> = {
  '4-3-3': {
    id: '4-3-3',
    name: '4-3-3',
    style: 'Extremos abiertos y un mediocentro organizador',
    slots: [...BACK_FOUR, s(5, 'CM', 24, 46), s(6, 'CM', 50, 51), s(7, 'CM', 76, 46), s(8, 'LW', 15, 18), s(9, 'ST', 50, 12), s(10, 'RW', 85, 18)],
    links: [...BACK_FOUR_LINKS, [1, 5], [2, 6], [3, 6], [4, 7], [5, 6], [6, 7], [5, 8], [7, 10], [6, 9], [8, 9], [9, 10], [1, 8], [4, 10]],
  },
  '4-2-3-1': {
    id: '4-2-3-1',
    name: '4-2-3-1',
    style: 'Doble pivote y mediapunta entre líneas',
    slots: [...BACK_FOUR, s(5, 'CDM', 36, 53), s(6, 'CDM', 64, 53), s(7, 'LM', 14, 32), s(8, 'CAM', 50, 32), s(9, 'RM', 86, 32), s(10, 'ST', 50, 11)],
    links: [...BACK_FOUR_LINKS, [1, 7], [4, 9], [2, 5], [3, 6], [5, 6], [5, 7], [6, 9], [5, 8], [6, 8], [7, 8], [8, 9], [8, 10], [7, 10], [9, 10]],
  },
  '4-4-2': {
    id: '4-4-2',
    name: '4-4-2',
    style: 'Bloque equilibrado con dos puntas',
    slots: [...BACK_FOUR, s(5, 'LM', 13, 41), s(6, 'CM', 37, 47), s(7, 'CM', 63, 47), s(8, 'RM', 87, 41), s(9, 'ST', 36, 14), s(10, 'ST', 64, 14)],
    links: [...BACK_FOUR_LINKS, [1, 5], [4, 8], [2, 6], [3, 7], [5, 6], [6, 7], [7, 8], [5, 9], [6, 9], [7, 10], [8, 10], [9, 10]],
  },
  '3-5-2': {
    id: '3-5-2',
    name: '3-5-2',
    style: 'Tres centrales y carrileros profundos',
    slots: [s(0, 'GK', 50, 89), s(1, 'CB', 25, 72), s(2, 'CB', 50, 71), s(3, 'CB', 75, 72), s(4, 'LM', 10, 43), s(5, 'CDM', 36, 54), s(6, 'CDM', 64, 54), s(7, 'RM', 90, 43), s(8, 'CAM', 50, 33), s(9, 'ST', 35, 12), s(10, 'ST', 65, 12)],
    links: [[0, 1], [0, 2], [0, 3], [1, 2], [2, 3], [1, 4], [3, 7], [1, 5], [3, 6], [2, 5], [2, 6], [4, 5], [5, 6], [6, 7], [5, 8], [6, 8], [4, 9], [7, 10], [8, 9], [8, 10], [9, 10]],
  },
  '4-1-4-1': {
    id: '4-1-4-1',
    name: '4-1-4-1',
    style: 'Mediocentro defensivo y línea de cuatro por delante',
    slots: [...BACK_FOUR, s(5, 'CDM', 50, 55), s(6, 'LM', 12, 36), s(7, 'CM', 36, 36), s(8, 'CM', 64, 36), s(9, 'RM', 88, 36), s(10, 'ST', 50, 11)],
    links: [...BACK_FOUR_LINKS, [1, 6], [4, 9], [2, 5], [3, 5], [5, 7], [5, 8], [6, 7], [7, 8], [8, 9], [7, 10], [8, 10]],
  },
  '4-3-1-2': {
    id: '4-3-1-2',
    name: '4-3-1-2',
    style: 'Rombo estrecho con enganche y dos delanteros',
    slots: [...BACK_FOUR, s(5, 'CM', 22, 51), s(6, 'CM', 50, 55), s(7, 'CM', 78, 51), s(8, 'CAM', 50, 32), s(9, 'ST', 34, 12), s(10, 'ST', 66, 12)],
    links: [...BACK_FOUR_LINKS, [1, 5], [4, 7], [2, 6], [3, 6], [5, 6], [6, 7], [5, 8], [7, 8], [6, 8], [5, 9], [7, 10], [8, 9], [8, 10], [9, 10]],
  },
  '3-4-3': {
    id: '3-4-3',
    name: '3-4-3',
    style: 'Tres centrales, dos carrileros y tridente ofensivo',
    slots: [s(0, 'GK', 50, 89), s(1, 'CB', 25, 72), s(2, 'CB', 50, 71), s(3, 'CB', 75, 72), s(4, 'LM', 10, 45), s(5, 'CM', 37, 50), s(6, 'CM', 63, 50), s(7, 'RM', 90, 45), s(8, 'LW', 18, 18), s(9, 'ST', 50, 12), s(10, 'RW', 82, 18)],
    links: [[0, 1], [0, 2], [0, 3], [1, 2], [2, 3], [1, 4], [3, 7], [1, 5], [2, 5], [2, 6], [3, 6], [4, 5], [5, 6], [6, 7], [4, 8], [5, 9], [6, 9], [7, 10], [8, 9], [9, 10]],
  },
  '3-4-1-2': {
    id: '3-4-1-2',
    name: '3-4-1-2',
    style: 'Carrileros largos y un mediapunta tras dos delanteros',
    slots: [s(0, 'GK', 50, 89), s(1, 'CB', 25, 72), s(2, 'CB', 50, 71), s(3, 'CB', 75, 72), s(4, 'LWB', 10, 47), s(5, 'CM', 38, 52), s(6, 'CM', 62, 52), s(7, 'RWB', 90, 47), s(8, 'CAM', 50, 32), s(9, 'ST', 36, 12), s(10, 'ST', 64, 12)],
    links: [[0, 1], [0, 2], [0, 3], [1, 2], [2, 3], [1, 4], [3, 7], [1, 5], [2, 5], [2, 6], [3, 6], [4, 5], [5, 6], [6, 7], [5, 8], [6, 8], [4, 9], [7, 10], [8, 9], [8, 10], [9, 10]],
  },
  '5-3-2': {
    id: '5-3-2',
    name: '5-3-2',
    style: 'Defensa de cinco y contragolpe con dos puntas',
    slots: [s(0, 'GK', 50, 89), s(1, 'LWB', 9, 62), s(2, 'CB', 28, 73), s(3, 'CB', 50, 71), s(4, 'CB', 72, 73), s(5, 'RWB', 91, 62), s(6, 'CM', 28, 46), s(7, 'CM', 50, 50), s(8, 'CM', 72, 46), s(9, 'ST', 36, 13), s(10, 'ST', 64, 13)],
    links: [[0, 2], [0, 3], [0, 4], [1, 2], [2, 3], [3, 4], [4, 5], [1, 6], [5, 8], [2, 6], [3, 7], [4, 8], [6, 7], [7, 8], [6, 9], [7, 9], [7, 10], [8, 10], [9, 10]],
  },
  '5-4-1': {
    id: '5-4-1',
    name: '5-4-1',
    style: 'Bloque bajo muy sólido y un delantero de referencia',
    slots: [s(0, 'GK', 50, 89), s(1, 'LWB', 9, 64), s(2, 'CB', 28, 74), s(3, 'CB', 50, 71), s(4, 'CB', 72, 74), s(5, 'RWB', 91, 64), s(6, 'LM', 14, 40), s(7, 'CM', 38, 46), s(8, 'CM', 62, 46), s(9, 'RM', 86, 40), s(10, 'ST', 50, 12)],
    links: [[0, 2], [0, 3], [0, 4], [1, 2], [2, 3], [3, 4], [4, 5], [1, 6], [5, 9], [2, 7], [3, 7], [3, 8], [4, 8], [6, 7], [7, 8], [8, 9], [6, 10], [7, 10], [8, 10], [9, 10]],
  },
  '4-2-2-2': {
    id: '4-2-2-2',
    name: '4-2-2-2',
    style: 'Doble pivote, dos mediapuntas abiertos y dos delanteros',
    slots: [...BACK_FOUR, s(5, 'CDM', 36, 55), s(6, 'CDM', 64, 55), s(7, 'CAM', 22, 33), s(8, 'CAM', 78, 33), s(9, 'ST', 36, 12), s(10, 'ST', 64, 12)],
    links: [...BACK_FOUR_LINKS, [1, 7], [4, 8], [2, 5], [3, 6], [5, 6], [5, 7], [6, 8], [7, 9], [8, 10], [9, 10]],
  },
  '4-3-2-1': {
    id: '4-3-2-1',
    name: '4-3-2-1',
    style: 'Árbol de Navidad: dos mediapuntas por detrás del nueve',
    slots: [...BACK_FOUR, s(5, 'CM', 24, 50), s(6, 'CM', 50, 54), s(7, 'CM', 76, 50), s(8, 'CF', 34, 28), s(9, 'CF', 66, 28), s(10, 'ST', 50, 11)],
    links: [...BACK_FOUR_LINKS, [1, 5], [2, 6], [3, 6], [4, 7], [5, 6], [6, 7], [5, 8], [7, 9], [6, 8], [6, 9], [8, 9], [8, 10], [9, 10]],
  },
  '4-4-1-1': {
    id: '4-4-1-1',
    name: '4-4-1-1',
    style: 'Línea de cuatro y un segundo delantero entre líneas',
    slots: [...BACK_FOUR, s(5, 'LM', 13, 42), s(6, 'CM', 37, 49), s(7, 'CM', 63, 49), s(8, 'RM', 87, 42), s(9, 'CF', 50, 30), s(10, 'ST', 50, 11)],
    links: [...BACK_FOUR_LINKS, [1, 5], [4, 8], [2, 6], [3, 7], [5, 6], [6, 7], [7, 8], [6, 9], [7, 9], [9, 10], [5, 10], [8, 10]],
  },
  '4-5-1': {
    id: '4-5-1',
    name: '4-5-1',
    style: 'Centro del campo poblado con un mediapunta',
    slots: [...BACK_FOUR, s(5, 'LM', 12, 38), s(6, 'CM', 32, 48), s(7, 'CAM', 50, 34), s(8, 'CM', 68, 48), s(9, 'RM', 88, 38), s(10, 'ST', 50, 11)],
    links: [...BACK_FOUR_LINKS, [1, 5], [4, 9], [2, 6], [3, 8], [5, 6], [6, 7], [7, 8], [8, 9], [7, 10], [5, 10], [9, 10]],
  },
};

export const FORMATION_IDS = Object.keys(FORMATIONS) as FormationId[];

export function getFormation(id: FormationId): Formation {
  const f = FORMATIONS[id];
  if (!f) throw new Error(`Formación desconocida: ${id}`);
  return f;
}

/** Vecinos de un slot dentro del grafo de la formación. */
export function neighbours(formation: Formation, slot: number): number[] {
  const out: number[] = [];
  for (const [a, b] of formation.links) {
    if (a === slot) out.push(b);
    else if (b === slot) out.push(a);
  }
  return out;
}
