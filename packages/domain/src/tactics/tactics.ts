export type Mentality = 'defensive' | 'balanced' | 'attacking';

/** Estilo de juego: preferencias tácticas de un equipo (sobre todo de la IA rival). */
export type PlayStyle = 'balanced' | 'possession' | 'counter' | 'direct' | 'wings' | 'highpress';

export const PLAY_STYLES: Record<PlayStyle, { label: string; description: string }> = {
  balanced: { label: 'Equilibrado', description: 'Sin preferencias marcadas: elige según la jugada.' },
  possession: { label: 'Posesión', description: 'Pases cortos, paciencia y pocas pérdidas. Rara vez dispara de lejos.' },
  counter: { label: 'Contraataque', description: 'Bloque bajo y salidas rápidas al espacio tras robar.' },
  direct: { label: 'Juego directo', description: 'Balones largos, centros y disparos desde cualquier distancia.' },
  wings: { label: 'Juego por bandas', description: 'Amplitud máxima, regates en banda y muchos centros al área.' },
  highpress: { label: 'Presión alta', description: 'Línea adelantada y presión asfixiante. Comete más faltas.' },
};

export interface TeamTactics {
  mentality: Mentality;
  /** Estilo de juego (opcional; por defecto equilibrado). */
  style?: PlayStyle;
  /** Intensidad de presión 0–100. */
  pressing: number;
  /** Amplitud del bloque en posesión 0–100. */
  width: number;
  /** Altura de la línea defensiva 0–100. */
  depth: number;
  /** Ritmo de circulación 0–100 (más alto = decisiones y pases más rápidos/verticales). */
  tempo: number;
}

export const DEFAULT_TACTICS: TeamTactics = {
  mentality: 'balanced',
  pressing: 50,
  width: 55,
  depth: 50,
  tempo: 55,
};

export type PlayerInstruction =
  | 'none'
  | 'press'
  | 'makeRuns'
  | 'holdPosition'
  | 'getForward'
  | 'dropBack'
  | 'diagonalRuns'
  | 'keepPossession'
  | 'shootOnSight';

export const INSTRUCTIONS: { id: PlayerInstruction; label: string; description: string }[] = [
  { id: 'none', label: 'Sin instrucción', description: 'Comportamiento según su rol.' },
  { id: 'press', label: 'Presionar', description: 'Sale a por el poseedor con más intensidad. Gasta más energía.' },
  { id: 'makeRuns', label: 'Desmarcarse', description: 'Ataca los espacios a la espalda de la defensa.' },
  { id: 'holdPosition', label: 'Mantener posición', description: 'No abandona su zona en ningún momento.' },
  { id: 'getForward', label: 'Subir al ataque', description: 'Se incorpora al ataque en posesión.' },
  { id: 'dropBack', label: 'Replegarse', description: 'Se mantiene por detrás del balón para proteger.' },
  { id: 'diagonalRuns', label: 'Buscar diagonales', description: 'Movimientos en diagonal hacia el interior.' },
  { id: 'keepPossession', label: 'Conservar el balón', description: 'Prioriza pases seguros y evita pérdidas.' },
  { id: 'shootOnSight', label: 'Buscar disparos', description: 'Dispara en cuanto tiene una opción razonable.' },
];

export const MENTALITY_LABELS: Record<Mentality, string> = {
  defensive: 'Defensiva',
  balanced: 'Equilibrada',
  attacking: 'Ofensiva',
};
