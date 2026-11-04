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
  // Generales (compatibles con partidas antiguas)
  | 'none'
  | 'press'
  | 'makeRuns'
  | 'holdPosition'
  | 'getForward'
  | 'dropBack'
  | 'diagonalRuns'
  | 'keepPossession'
  | 'shootOnSight'
  // Portero
  | 'sweeperKeeper'
  | 'stayOnLine'
  | 'distributeLong'
  // Central
  | 'stepUp'
  | 'ballPlaying'
  | 'attackSetPieces'
  // Lateral / carrilero
  | 'overlap'
  | 'invertedFullback'
  // Centrocampista
  | 'boxToBox'
  | 'holdingMid'
  | 'lateRuns'
  | 'playmaker'
  // Extremo / mediapunta
  | 'cutInside'
  | 'stayWide'
  // Delantero
  | 'falseNine'
  | 'targetMan'
  | 'poacher';

/** Efecto de cada instrucción en la IA del motor (multiplicadores y desplazamientos). */
export interface InstructionProfile {
  /** Presión al poseedor rival (0 = normal, 1 = intensa). */
  press: number;
  /** Multiplicador de desmarques a la espalda de la defensa. */
  runs: number;
  /** Multiplicador de llegadas al área desde segunda línea. */
  late: number;
  /** No abandona su zona. */
  hold: boolean;
  /** Metros que adelanta su posición con balón. */
  forward: number;
  /** Metros que retrasa su posición (con y sin balón). */
  back: number;
  /** Atracción hacia el carril central (0–1). */
  inside: number;
  /** Metros extra de amplitud hacia la banda. */
  wide: number;
  /** Prioriza pases seguros. */
  keep: boolean;
  /** Multiplicador de ganas de disparar. */
  shoot: number;
  /** Multiplicador de encarar al rival. */
  takeOn: number;
  /** Bonus a centros, pases largos y al hueco. */
  cross: number;
  long: number;
  through: number;
  /** Preferencia como rematador aéreo (centros y balón parado). */
  aerial: number;
  /** Portero: adelanta su posición (líbero) o se queda bajo palos (−1). */
  sweeper: number;
}

const P = (p: Partial<InstructionProfile>): InstructionProfile => ({
  press: 0,
  runs: 1,
  late: 1,
  hold: false,
  forward: 0,
  back: 0,
  inside: 0,
  wide: 0,
  keep: false,
  shoot: 1,
  takeOn: 1,
  cross: 0,
  long: 0,
  through: 0,
  aerial: 0,
  sweeper: 0,
  ...p,
});

export const INSTRUCTION_PROFILE: Record<PlayerInstruction, InstructionProfile> = {
  none: P({}),
  press: P({ press: 1 }),
  makeRuns: P({ runs: 2.8, late: 1.6, takeOn: 1.1 }),
  holdPosition: P({ hold: true, runs: 0, late: 0 }),
  getForward: P({ forward: 10, runs: 1.8, late: 2.6 }),
  dropBack: P({ back: 9, runs: 0.1, late: 0.15 }),
  diagonalRuns: P({ runs: 2.2, inside: 0.35, forward: 5, late: 1.3 }),
  keepPossession: P({ keep: true, runs: 0.6, late: 0.7, shoot: 0.6, takeOn: 0.4 }),
  shootOnSight: P({ shoot: 1.7, runs: 1.1, late: 1.5, takeOn: 1.1 }),
  sweeperKeeper: P({ sweeper: 1 }),
  stayOnLine: P({ sweeper: -1 }),
  distributeLong: P({ long: 0.25 }),
  stepUp: P({ press: 1, forward: 4 }),
  ballPlaying: P({ long: 0.18, through: 0.1 }),
  attackSetPieces: P({ aerial: 0.8 }),
  overlap: P({ forward: 14, wide: 6, cross: 0.3, runs: 1.6, late: 0.4 }),
  invertedFullback: P({ inside: 0.45, forward: 5, keep: true }),
  boxToBox: P({ forward: 6, press: 0.6, late: 2.2, runs: 1.3 }),
  holdingMid: P({ back: 6, hold: true, runs: 0.1, late: 0 }),
  lateRuns: P({ late: 3.2, runs: 1.2, shoot: 1.2 }),
  playmaker: P({ keep: true, long: 0.15, through: 0.2, takeOn: 0.8 }),
  cutInside: P({ inside: 0.5, shoot: 1.45, takeOn: 1.25, runs: 1.3 }),
  stayWide: P({ wide: 6, cross: 0.32, takeOn: 1.15 }),
  falseNine: P({ back: 8, late: 1.8, keep: true, through: 0.15, runs: 0.5 }),
  targetMan: P({ aerial: 0.7, runs: 0.5, takeOn: 0.7 }),
  poacher: P({ shoot: 1.5, runs: 1.4, forward: 3, takeOn: 0.8, late: 0 }),
};

export type InstructionRole = 'goalkeeper' | 'centreback' | 'fullback' | 'midfield' | 'winger' | 'striker';

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
  { id: 'sweeperKeeper', label: 'Portero líbero', description: 'Juega adelantado y sale a cortar balones a la espalda de la defensa.' },
  { id: 'stayOnLine', label: 'Bajo palos', description: 'No sale del área pequeña: mejor en el uno contra uno, peor ante balones largos.' },
  { id: 'distributeLong', label: 'Saque largo', description: 'Inicia el juego en largo hacia los delanteros.' },
  { id: 'stepUp', label: 'Anticiparse', description: 'Adelanta la posición y sale a presionar al delantero que recibe.' },
  { id: 'ballPlaying', label: 'Salida de balón', description: 'Rompe líneas con pases largos y al hueco desde atrás.' },
  { id: 'attackSetPieces', label: 'Subir a rematar', description: 'Va al área rival en córners y faltas: amenaza aérea.' },
  { id: 'overlap', label: 'Subir por la banda', description: 'Se incorpora como extremo, dobla por fuera y centra al área.' },
  { id: 'invertedFullback', label: 'Lateral por dentro', description: 'Se mete al centro del campo para dar superioridad.' },
  { id: 'boxToBox', label: 'Ida y vuelta', description: 'Presiona arriba y llega al área: recorre todo el campo.' },
  { id: 'holdingMid', label: 'Mediocentro posicional', description: 'Protege a la defensa y no se descoloca.' },
  { id: 'lateRuns', label: 'Llegada al área', description: 'Aparece desde segunda línea para rematar.' },
  { id: 'playmaker', label: 'Organizador', description: 'Pide el balón, cambia de orientación y filtra pases.' },
  { id: 'cutInside', label: 'Recortar hacia dentro', description: 'Encara y busca su disparo desde la banda contraria a su pierna.' },
  { id: 'stayWide', label: 'Pegado a la banda', description: 'Da amplitud, desborda por fuera y centra.' },
  { id: 'falseNine', label: 'Falso 9', description: 'Baja a recibir entre líneas y deja espacio a los que llegan.' },
  { id: 'targetMan', label: 'Referencia', description: 'Delantero de choque: gana duelos aéreos y aguanta de espaldas.' },
  { id: 'poacher', label: 'Cazagoles', description: 'Vive en el área: dispara en cuanto puede.' },
];

/** Instrucciones disponibles por rol (las específicas de cada puesto). */
export const INSTRUCTIONS_BY_ROLE: Record<InstructionRole, PlayerInstruction[]> = {
  goalkeeper: ['none', 'sweeperKeeper', 'stayOnLine', 'distributeLong'],
  centreback: ['none', 'holdPosition', 'stepUp', 'ballPlaying', 'attackSetPieces'],
  fullback: ['none', 'overlap', 'invertedFullback', 'holdPosition', 'press'],
  midfield: ['none', 'boxToBox', 'holdingMid', 'lateRuns', 'playmaker', 'press', 'shootOnSight'],
  winger: ['none', 'cutInside', 'stayWide', 'makeRuns', 'shootOnSight', 'press', 'dropBack'],
  striker: ['none', 'poacher', 'makeRuns', 'targetMan', 'falseNine', 'press'],
};

export function instructionRole(pos: string): InstructionRole {
  switch (pos) {
    case 'GK':
      return 'goalkeeper';
    case 'CB':
      return 'centreback';
    case 'RB':
    case 'LB':
    case 'RWB':
    case 'LWB':
      return 'fullback';
    case 'CDM':
    case 'CM':
      return 'midfield';
    case 'CAM':
    case 'RM':
    case 'LM':
    case 'RW':
    case 'LW':
      return 'winger';
    default:
      return 'striker';
  }
}

/** Instrucciones que se pueden dar a un jugador según la posición que ocupa. */
export function instructionsFor(pos: string) {
  const ids = INSTRUCTIONS_BY_ROLE[instructionRole(pos)];
  return ids.map((id) => INSTRUCTIONS.find((i) => i.id === id)!);
}

export const MENTALITY_LABELS: Record<Mentality, string> = {
  defensive: 'Defensiva',
  balanced: 'Equilibrada',
  attacking: 'Ofensiva',
};
