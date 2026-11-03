import type { Position } from '../players/types';
import type { FormationId } from '../squad/formations';
import type { PlayerInstruction, TeamTactics } from '../tactics/tactics';

export type TeamSide = 'home' | 'away';

/** Atributos de simulación (0–100) ya ajustados por química. */
export interface MatchAttributes {
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  goalkeeping: number;
  reflexes: number;
}

export interface MatchPlayerSetup {
  id: string;
  name: string;
  number: number;
  /** Posición del slot que ocupa en la formación. */
  position: Position;
  /** Coordenadas del slot en la vista de plantilla (0–100). */
  anchor: { x: number; y: number };
  attributes: MatchAttributes;
  chemistry: number;
  instruction: PlayerInstruction;
}

export interface MatchTeamSetup {
  id: string;
  name: string;
  shortName: string;
  colors: { primary: string; secondary: string };
  formationId: FormationId;
  tactics: TeamTactics;
  players: MatchPlayerSetup[];
  rating: number;
  chemistry: number;
}

export interface MatchConfig {
  /** Paso fijo de simulación en segundos de motor. */
  tickSeconds: number;
  /** Duración total del partido en segundos de motor (90' comprimidos). */
  engineDurationSeconds: number;
}

export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  tickSeconds: 0.1,
  engineDurationSeconds: 360,
};

export const PITCH = { length: 105, width: 68, goalWidth: 7.32, boxDepth: 16.5 } as const;

export interface PlayerState {
  id: string;
  side: TeamSide;
  index: number;
  name: string;
  number: number;
  position: Position;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 0–1 */
  stamina: number;
  instruction: PlayerInstruction;
  /** Segundos que el jugador queda superado tras una acción fallida. */
  stunned: number;
}

export interface BallFlight {
  kind: 'pass' | 'shot';
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  start: number;
  duration: number;
  /** Resultado decidido por el motor al golpear el balón. */
  outcome: 'complete' | 'intercepted' | 'loose' | 'goal' | 'saved' | 'miss';
  targetId: string | null;
  kickerId: string;
}

export interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: string | null;
  flight: BallFlight | null;
}

export type MatchPhase = 'kickoff' | 'play' | 'restart' | 'goal' | 'halftime' | 'fulltime';

export interface TeamStats {
  goals: number;
  shots: number;
  shotsOnTarget: number;
  passes: number;
  passesCompleted: number;
  tackles: number;
  interceptions: number;
  possessionTicks: number;
}

export type MatchEventType =
  | 'kickoff'
  | 'pass'
  | 'interception'
  | 'tackle'
  | 'dribble'
  | 'shot'
  | 'save'
  | 'goal'
  | 'miss'
  | 'out'
  | 'halftime'
  | 'fulltime'
  | 'instruction';

export interface MatchEvent {
  id: number;
  minute: number;
  type: MatchEventType;
  side: TeamSide | null;
  playerId?: string;
  otherId?: string;
  text: string;
  /** Eventos que merecen aparecer en la crónica. */
  important: boolean;
}

export interface MatchSnapshot {
  time: number;
  minute: number;
  period: 1 | 2;
  phase: MatchPhase;
  score: { home: number; away: number };
  ball: BallState;
  players: PlayerState[];
  possession: TeamSide | null;
  stats: Record<TeamSide, TeamStats>;
}
