import { clamp, createRng, pointSegment, type Rng } from '@fu/shared';
import { POSITION_LINE, type PositionLine } from '../players/positions';
import { INSTRUCTION_PROFILE, type InstructionProfile, type PlayerInstruction, type PlayStyle, type TeamTactics } from '../tactics/tactics';
import {
  DEFAULT_MATCH_CONFIG,
  PITCH,
  type BallFlight,
  type BallState,
  type DecisionContext,
  type DecisionFamily,
  type DecisionFrequency,
  type DecisionGrade,
  type DecisionKind,
  type DecisionOption,
  type DecisionPrompt,
  type Level,
  type Likelihood,
  type HighlightKind,
  type MatchAttributes,
  type MatchConfig,
  type MatchEvent,
  type MatchEventType,
  type MatchPhase,
  type MatchSnapshot,
  type MatchTeamSetup,
  type PassVariant,
  type PlayerState,
  type RenderFrame,
  type ShotMode,
  type TeamSide,
  type TeamStats,
} from './types';

/**
 * MATCH ENGINE
 *
 * El motor es la única fuente de verdad del partido: decide el resultado de
 * cada acción (pase, regate, entrada, falta, disparo, parada) en el momento en
 * que se ejecuta, con probabilidades derivadas de los atributos. El
 * renderizador sólo dibuja los snapshots que produce.
 *
 * Inteligencia en tres niveles:
 *  1. Colectiva  → forma del bloque, altura de línea, amplitud, presión.
 *  2. Por puesto → objetivo de cada jugador según su línea y su anclaje; desmarques.
 *  3. Individual → pases (cortos, largos, al hueco, centros), regates, encaradas,
 *     disparos (cercanos, lejanos, de cabeza), manos a mano, faltas e instrucciones.
 *
 * Las jugadas destacadas se emiten como eventos con `highlight` para que la
 * retransmisión las anuncie.
 *
 * Coordenadas: metros, x ∈ [0, 105] (local ataca hacia +x), y ∈ [0, 68].
 */

const L = PITCH.length;
const W = PITCH.width;
const GOAL_HALF = PITCH.goalWidth / 2;
const BOX_DEPTH = 16.5;
const BOX_HALF = 20.16;

interface Agent extends PlayerState {
  attrs: MatchAttributes;
  anchor: { x: number; y: number };
  line: PositionLine;
  isGK: boolean;
  targetX: number;
  targetY: number;
  urgent: boolean;
  decisionTimer: number;
  tackleTimer: number;
  dribbleX: number;
  dribbleY: number;
  mustPass: boolean;
  /** Segundos que lleva conduciendo el balón (penaliza conducciones eternas). */
  carryTime: number;
  /** Segundos restantes de un desmarque a la espalda de la defensa. */
  runLeft: number;
  /** Rivales superados en la posesión actual. */
  beaten: number;
  skillAnnounced: number;
  oneOnOneAnnounced: boolean;
  booked: boolean;
  icon: boolean;
  /** Protegido de entradas hasta este instante (acción elegida por el usuario). */
  protectedUntil: number;
  /** Posición al inicio del tick (para interpolar el render). */
  px: number;
  py: number;
  /** Impulso de una jugada elegida con éxito (0–3) y hasta cuándo dura. */
  momentum: number;
  momentumUntil: number;
  /** Desmarque de llegada al área (segunda línea) en lugar de a la espalda de la defensa. */
  boxRun: boolean;
  /** Recibió llegando desde segunda línea: busca el remate de primeras. */
  arrivalUntil: number;
  /** Estirada / carrera explosiva en curso (portero que se lanza, etc.). */
  dive: { vx: number; vy: number; until: number } | null;
}

type RestartKind = 'throw' | 'goalkick' | 'corner' | 'freekick' | 'penalty';

interface Restart {
  side: TeamSide;
  takerId: string;
  x: number;
  y: number;
  timer: number;
  /** Espera mínima (balón parado) para que los jugadores se coloquen. */
  minWait: number;
  kind: RestartKind;
  direct: boolean;
  /** Estado de la decisión del usuario sobre este balón parado. */
  decision?: 'pending' | 'auto';
  /** Variación de quién sube a rematar (determinista por jugada). */
  seed: number;
  /** Jugador que espera el rechace en la frontal. */
  lurkerId?: string;
}

const emptyStats = (): TeamStats => ({
  goals: 0,
  shots: 0,
  shotsOnTarget: 0,
  passes: 0,
  passesCompleted: 0,
  tackles: 0,
  interceptions: 0,
  fouls: 0,
  yellowCards: 0,
  dribblesWon: 0,
  possessionTicks: 0,
  decisions: 0,
  decisionsWon: 0,
});

const MENTALITY_SHIFT = { defensive: -1, balanced: 0, attacking: 1 } as const;

/** Frecuencia base de desmarques (por segundo) según línea e instrucción. */
const RUN_RATE: Record<PositionLine, number> = { goalkeeper: 0, defence: 0.012, midfield: 0.05, attack: 0.13 };

/** Preferencias de cada estilo de juego (modificadores sobre la IA base). */
interface StyleProfile {
  short: number;
  long: number;
  through: number;
  cross: number;
  shot: number;
  longShot: number;
  takeOn: number;
  run: number;
  press: number;
  line: number;
  width: number;
  tempo: number;
  foul: number;
}
const STYLE: Record<PlayStyle, StyleProfile> = {
  balanced: { short: 0, long: 0, through: 0, cross: 0, shot: 1, longShot: 1, takeOn: 1, run: 1, press: 0, line: 0, width: 0, tempo: 0, foul: 0 },
  possession: { short: 0.12, long: -0.14, through: -0.06, cross: -0.08, shot: 0.88, longShot: 0.6, takeOn: 0.8, run: 0.8, press: 0, line: 3, width: 4, tempo: -0.2, foul: 0 },
  counter: { short: -0.04, long: 0.1, through: 0.24, cross: 0, shot: 1.05, longShot: 1, takeOn: 1.1, run: 1.9, press: -1, line: -7, width: -3, tempo: 0.3, foul: 0 },
  direct: { short: -0.07, long: 0.2, through: 0.08, cross: 0.14, shot: 1.12, longShot: 1.6, takeOn: 0.9, run: 1.3, press: 0, line: 0, width: 0, tempo: 0.2, foul: 0 },
  wings: { short: 0, long: 0.04, through: 0, cross: 0.32, shot: 0.95, longShot: 0.85, takeOn: 1.25, run: 1.1, press: 0, line: 0, width: 9, tempo: 0.05, foul: 0 },
  highpress: { short: 0.03, long: -0.03, through: 0.05, cross: 0, shot: 1, longShot: 1, takeOn: 1, run: 1.2, press: 1, line: 8, width: 0, tempo: 0.1, foul: 0.025 },
};

/** Separación mínima (segundos de motor) entre decisiones no encadenadas. */
const DECISION_COOLDOWN: Record<Exclude<DecisionFrequency, 'off'>, number> = { low: 100, medium: 52, high: 30 };
/** Probabilidad de ofrecer la decisión en un córner. */
const CORNER_PROMPT: Record<Exclude<DecisionFrequency, 'off'>, number> = { low: 0.35, medium: 0.7, high: 1 };
/** Ventana (segundos de motor) para decidir antes de que lo haga la IA. */
const PROMPT_WINDOW: Record<DecisionContext, number> = { attack: 1.15, oneonone: 0.95, setpiece: 1.6, defense: 0.95, keeper: 0.85, aerial: 0.8 };
const CHAIN_WINDOW = 2.4;
const MAX_CHAIN = 3;
/** Duración (s de motor) del impulso tras una decisión acertada. */
const MOMENTUM_TIME = 5.5;
const SKILL_MOVES = ['Ruleta', 'Bicicleta', 'Caño', 'Elástica', 'Sombrero', 'Cola de vaca'];

const FAMILY: Record<DecisionKind, DecisionFamily> = {
  dribble: 'move', skill: 'move', carry: 'move', shield: 'move', roundkeeper: 'move', wingrun: 'move',
  cutback: 'pass', earlycross: 'pass', knockdown: 'pass',
  header: 'shot', 'header-down': 'shot', volley: 'shot',
  pass: 'pass', onetwo: 'pass', through: 'pass', longball: 'pass', switch: 'pass', cross: 'pass',
  'fk-cross': 'pass', 'fk-short': 'pass', 'corner-near': 'pass', 'corner-far': 'pass', 'corner-edge': 'pass',
  shoot: 'shot', finesse: 'shot', power: 'shot', longshot: 'shot', chip: 'shot',
  'pen-left': 'shot', 'pen-right': 'shot', 'pen-center': 'shot', panenka: 'shot', 'fk-shot': 'shot', 'fk-power': 'shot',
  tackle: 'defense', slide: 'defense', jockey: 'defense', tacticalfoul: 'defense', 'gk-rush': 'defense', 'gk-stay': 'defense',
};
const REWARD_VALUE: Partial<Record<DecisionKind, number>> = {
  pass: 0.35, onetwo: 0.7, through: 0.8, longball: 0.5, switch: 0.45, cross: 0.65,
  dribble: 0.6, skill: 0.75, carry: 0.45, shield: 0.25,
  wingrun: 0.7, cutback: 0.75, earlycross: 0.55, knockdown: 0.5,
};

function likelihoodOf(chance: number, measure: 'success' | 'goal'): Likelihood {
  const t = measure === 'goal' ? [0.5, 0.3, 0.17, 0.08] : [0.78, 0.6, 0.42, 0.25];
  return chance >= t[0] ? 'very-high' : chance >= t[1] ? 'high' : chance >= t[2] ? 'medium' : chance >= t[3] ? 'low' : 'very-low';
}

/** Opción interna: la pública más los datos para reevaluarla y ejecutarla. */
interface OptionSpec extends DecisionOption {
  score: number;
  move?: string;
}
interface ActivePrompt extends DecisionPrompt {
  specs: OptionSpec[];
  refreshAt: number;
}
interface DecisionCtx {
  promptId: number;
  kind: DecisionKind;
  label: string;
  side: TeamSide;
  /** Decisión defensiva: el resultado se evalúa a la inversa. */
  defensive: boolean;
  chain: number;
  /** Fase de una pared (1 = pase, 2 = devolución). */
  stage?: number;
  ownerId: string;
}

/** Variante de golpeo elegida en una decisión (o impuesta en un penalti). */
interface ShotStyle {
  kind?: 'finesse' | 'power' | 'chip' | 'placed' | 'volley';
  gkBonus?: number;
  forced?: 'goal' | 'saved' | 'miss' | 'post';
  aimY?: number;
  decisionId?: number;
}


/** Jugadas de prioridad alta: no se filtran y piden cámara lenta. */
const MAJOR: ReadonlySet<HighlightKind> = new Set(['goal', 'penalty', 'oneonone', 'roundkeeper', 'bigsave', 'woodwork', 'freekick']);
/** Separación mínima (segundos de motor) entre avisos de prioridad normal. */
const HIGHLIGHT_COOLDOWN = 7;

export class MatchEngine {
  readonly config: MatchConfig;
  private readonly rng: Rng;
  private readonly agents: Agent[] = [];
  private readonly byId = new Map<string, Agent>();
  private readonly tactics: Record<TeamSide, TeamTactics>;
  private ball: BallState = { x: L / 2, y: W / 2, vx: 0, vy: 0, ownerId: null, flight: null };
  private time = 0;
  private accumulator = 0;
  private prevBall = { x: L / 2, y: W / 2 };
  private frame: RenderFrame | null = null;
  private phase: MatchPhase = 'kickoff';
  private phaseTimer = 1.2;
  private period: 1 | 2 = 1;
  private score = { home: 0, away: 0 };
  private stats: Record<TeamSide, TeamStats> = { home: emptyStats(), away: emptyStats() };
  private possession: TeamSide | null = 'home';
  private lastTouch: TeamSide = 'home';
  private restart: Restart | null = null;
  private pendingKickoff: TeamSide = 'home';
  private eventSeq = 0;
  private pending: MatchEvent[] = [];
  private readonly log: MatchEvent[] = [];
  private lastHighlightAt = -Infinity;
  /** Último pase completado (para asistencias). */
  private lastPass: { kickerId: string; receiverId: string; side: TeamSide; time: number } | null = null;

  // Decisiones del usuario
  private decisionSide: TeamSide | null = null;
  private frequency: DecisionFrequency = 'off';
  private prompt: ActivePrompt | null = null;
  private publicPrompt: DecisionPrompt | null = null;
  private promptSeq = 0;
  private lastPromptAt = -Infinity;
  private lastDefPromptAt = -Infinity;
  private chain: { playerId: string; until: number; level: number } | null = null;
  private readonly decisionCtx = new Map<number, DecisionCtx>();
  private oneTwo: { by: string; ctx: DecisionCtx } | null = null;
  private scripted: { ownerId: string; defId: string; at: number; ctx: DecisionCtx } | null = null;
  /** Acciones diferidas: animaciones que terminan en una consecuencia (regatear al portero…). */
  private actions: { at: number; run: () => void }[] = [];
  /** Segunda jugada tras un balón colgado: el jugador de la frontal remata de primeras. */
  private secondBall: { lurkerId: string; until: number } | null = null;

  constructor(
    readonly home: MatchTeamSetup,
    readonly away: MatchTeamSetup,
    seed: number,
    config: Partial<MatchConfig> = {},
  ) {
    this.config = { ...DEFAULT_MATCH_CONFIG, ...config };
    this.rng = createRng(seed);
    this.tactics = { home: { ...home.tactics }, away: { ...away.tactics } };
    for (const [side, team] of [
      ['home', home],
      ['away', away],
    ] as const) {
      if (team.players.length !== 11) throw new Error(`${team.name}: se necesitan 11 jugadores`);
      team.players.forEach((p, index) => {
        const agent: Agent = {
          id: p.id,
          side,
          index,
          name: p.name,
          number: p.number,
          position: p.position,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          stamina: 1,
          instruction: p.instruction,
          stunned: 0,
          attrs: p.attributes,
          anchor: p.anchor,
          line: POSITION_LINE[p.position],
          isGK: p.position === 'GK',
          targetX: 0,
          targetY: 0,
          urgent: false,
          decisionTimer: 0,
          tackleTimer: 0,
          dribbleX: 0,
          dribbleY: 0,
          mustPass: false,
          carryTime: 0,
          runLeft: 0,
          beaten: 0,
          skillAnnounced: 0,
          oneOnOneAnnounced: false,
          booked: false,
          icon: !!p.icon,
          protectedUntil: 0,
          px: 0,
          py: 0,
          momentum: 0,
          momentumUntil: 0,
          boxRun: false,
          arrivalUntil: 0,
          dive: null,
        };
        if (this.byId.has(agent.id)) throw new Error(`ID de jugador duplicado en el partido: ${agent.id}`);
        this.agents.push(agent);
        this.byId.set(agent.id, agent);
      });
    }
    this.setupKickoff('home');
    this.emit('kickoff', 'home', `Comienza el partido: ${home.name} – ${away.name}`, true);
  }

  // ───────────────────────────── API pública ─────────────────────────────

  get finished(): boolean {
    return this.phase === 'fulltime';
  }

  /** Avanza la simulación en tiempo de motor (paso fijo interno). */
  step(dtSeconds: number): void {
    this.accumulator += Math.min(dtSeconds, 5);
    let guard = 0;
    while (this.accumulator >= this.config.tickSeconds && guard++ < 2000 && !this.finished) {
      this.tick();
      this.accumulator -= this.config.tickSeconds;
    }
  }

  simulateToEnd(): void {
    this.setDecisionMode(null, 'off');
    while (!this.finished) this.tick();
  }

  setInstruction(playerId: string, instruction: PlayerInstruction): void {
    const a = this.byId.get(playerId);
    if (!a) return;
    a.instruction = instruction;
    if (instruction === 'holdPosition' || instruction === 'dropBack') a.runLeft = 0;
    this.emit('instruction', a.side, `${a.name}: nueva instrucción`, false, a.id);
  }

  /**
   * Activa las intervenciones manuales para un equipo. Con 'off' el partido es
   * 100 % simulado (por defecto, y siempre en `simulateToEnd`).
   */
  setDecisionMode(side: TeamSide | null, frequency: DecisionFrequency): void {
    this.decisionSide = frequency === 'off' ? null : side;
    this.frequency = side ? frequency : 'off';
    if (this.frequency === 'off' && this.prompt) this.expirePrompt();
  }

  get decisionFrequency(): DecisionFrequency {
    return this.frequency;
  }

  /** Decisión pendiente (o null). */
  get decision(): DecisionPrompt | null {
    return this.publicPrompt;
  }

  /** Ejecuta la opción elegida por el usuario. Devuelve false si ya no es válida. */
  choose(promptId: number, optionId: string): boolean {
    const pr = this.prompt;
    if (!pr || pr.id !== promptId || this.finished) return false;
    if (!this.promptStillValid(pr)) {
      this.clearPrompt();
      return false;
    }
    this.refreshPrompt(true);
    const opt = pr.specs.find((o) => o.id === optionId);
    if (!opt) return false;
    this.clearPrompt();
    this.executeDecision(pr, opt);
    return true;
  }

  /** Deja que la IA decida la jugada pendiente. */
  skipDecision(): void {
    if (this.prompt) this.expirePrompt();
  }

  setTactics(side: TeamSide, tactics: TeamTactics): void {
    this.tactics[side] = { ...tactics };
  }

  getTactics(side: TeamSide): TeamTactics {
    return { ...this.tactics[side] };
  }

  /** Devuelve y vacía los eventos producidos desde la última llamada. */
  drainEvents(): MatchEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }

  get events(): readonly MatchEvent[] {
    return this.log;
  }

  get minute(): number {
    return Math.min(90, Math.floor((this.time / this.config.engineDurationSeconds) * 90));
  }

  /**
   * Fotograma para el renderizador: posiciones interpoladas entre el tick
   * anterior y el actual según el tiempo acumulado. Reutiliza el mismo objeto
   * en cada llamada para no generar basura a 60–144 fps.
   */
  getFrame(): RenderFrame {
    const alpha = clamp(this.accumulator / this.config.tickSeconds, 0, 1);
    const f =
      this.frame ??
      (this.frame = {
        time: 0,
        phase: this.phase,
        ownerId: null,
        flight: null,
        ball: { x: 0, y: 0 },
        players: this.agents.map((a) => ({ id: a.id, x: a.x, y: a.y, stunned: false, jump: false, dive: false })),
      });
    f.time = this.time - this.config.tickSeconds + alpha * this.config.tickSeconds;
    f.phase = this.phase;
    f.ownerId = this.ball.ownerId;
    f.flight = this.ball.flight;
    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i];
      const p = f.players[i];
      const jump = Math.abs(a.x - a.px) + Math.abs(a.y - a.py) > 6;
      p.jump = jump;
      p.x = jump ? a.x : a.px + (a.x - a.px) * alpha;
      p.y = jump ? a.y : a.py + (a.y - a.py) * alpha;
      p.stunned = a.stunned > 0;
      p.dive = !!a.dive;
    }
    const b = this.ball;
    const bj = Math.abs(b.x - this.prevBall.x) + Math.abs(b.y - this.prevBall.y) > 8;
    f.ball.x = bj ? b.x : this.prevBall.x + (b.x - this.prevBall.x) * alpha;
    f.ball.y = bj ? b.y : this.prevBall.y + (b.y - this.prevBall.y) * alpha;
    return f;
  }

  getSnapshot(): MatchSnapshot {
    return {
      time: this.time,
      minute: this.minute,
      period: this.period,
      phase: this.phase,
      score: { ...this.score },
      ball: { ...this.ball, flight: this.ball.flight ? { ...this.ball.flight } : null },
      players: this.agents.map((a) => ({
        id: a.id,
        side: a.side,
        index: a.index,
        name: a.name,
        number: a.number,
        position: a.position,
        x: a.x,
        y: a.y,
        vx: a.vx,
        vy: a.vy,
        stamina: a.stamina,
        instruction: a.instruction,
        stunned: a.stunned,
      })),
      possession: this.possession,
      stats: { home: { ...this.stats.home }, away: { ...this.stats.away } },
      decision: this.publicPrompt,
    };
  }

  // ───────────────────────────── Bucle principal ─────────────────────────────

  private tick(): void {
    const dt = this.config.tickSeconds;
    for (const a of this.agents) {
      a.px = a.x;
      a.py = a.y;
    }
    this.prevBall.x = this.ball.x;
    this.prevBall.y = this.ball.y;
    this.time += dt;
    const half = this.config.engineDurationSeconds / 2;
    const setPiece = this.phase === 'restart' && (this.restart?.kind === 'penalty' || this.restart?.direct);

    if (this.period === 1 && this.time >= half && this.phase !== 'goal' && !setPiece) {
      this.clearPrompt();
      this.chain = null;
      this.period = 2;
      this.phase = 'halftime';
      this.phaseTimer = 1.5;
      this.restart = null;
      this.ball.flight = null;
      this.emit('halftime', null, `Descanso: ${this.home.shortName} ${this.score.home} – ${this.score.away} ${this.away.shortName}`, true);
    }
    if (this.time >= this.config.engineDurationSeconds && this.phase !== 'goal' && !setPiece && !this.ball.flight) {
      this.clearPrompt();
      this.phase = 'fulltime';
      this.ball.flight = null;
      this.emit('fulltime', null, `Final: ${this.home.shortName} ${this.score.home} – ${this.score.away} ${this.away.shortName}`, true);
      return;
    }

    switch (this.phase) {
      case 'halftime':
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) {
          this.setupKickoff('away');
          this.emit('kickoff', 'away', 'Comienza la segunda parte', true);
        }
        return;
      case 'goal':
        this.phaseTimer -= dt;
        this.computeTargets(dt);
        this.moveAgents(dt, 0.45);
        if (this.phaseTimer <= 0) {
          if (this.time >= this.config.engineDurationSeconds) {
            this.phase = 'fulltime';
            this.emit('fulltime', null, `Final: ${this.home.shortName} ${this.score.home} – ${this.score.away} ${this.away.shortName}`, true);
          } else this.setupKickoff(this.pendingKickoff);
        }
        return;
      case 'kickoff':
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) {
          this.phase = 'play';
          const owner = this.ball.ownerId ? this.byId.get(this.ball.ownerId) : null;
          if (owner) {
            owner.decisionTimer = 0;
            owner.mustPass = true;
          }
        }
        this.updateBall(dt);
        return;
      case 'restart':
        this.updateRestart(dt);
        break;
      case 'play':
        break;
      default:
        return;
    }

    for (const a of this.agents) {
      a.stunned = Math.max(0, a.stunned - dt);
      a.tackleTimer = Math.max(0, a.tackleTimer - dt);
    }

    if (this.prompt) {
      if (!this.promptStillValid(this.prompt)) this.clearPrompt();
      else if (this.time >= this.prompt.expiresAt) this.expirePrompt();
      else if (this.time >= this.prompt.refreshAt) this.refreshPrompt(false);
    }
    if (this.scripted && this.time >= this.scripted.at) this.runScripted();
    if (this.actions.length) {
      const due = this.actions.filter((x) => this.time >= x.at);
      if (due.length) {
        this.actions = this.actions.filter((x) => this.time < x.at);
        for (const d of due) if (this.phase === 'play') d.run();
      }
    }

    this.computeTargets(dt);
    if (this.phase === 'play') {
      this.carrierDecision(dt);
      if (this.phase === 'play') this.defensiveDuels();
    }
    this.moveAgents(dt, 1);
    this.updateBall(dt);

    if (this.possession) this.stats[this.possession].possessionTicks++;
  }

  // ───────────────────────────── Utilidades ─────────────────────────────

  private depthOf(side: TeamSide, x: number) {
    return side === 'home' ? x : L - x;
  }
  private latOf(side: TeamSide, y: number) {
    return side === 'home' ? y : W - y;
  }
  private fx(side: TeamSide, depth: number) {
    return side === 'home' ? depth : L - depth;
  }
  private fy(side: TeamSide, lat: number) {
    return side === 'home' ? lat : W - lat;
  }
  private goalX(attacking: TeamSide) {
    return attacking === 'home' ? L : 0;
  }
  private opp(side: TeamSide): TeamSide {
    return side === 'home' ? 'away' : 'home';
  }
  private team(side: TeamSide) {
    return this.agents.filter((a) => a.side === side);
  }
  private gk(side: TeamSide) {
    return this.agents.find((a) => a.side === side && a.isGK) ?? this.team(side)[0];
  }
  /** Estirada o carrera explosiva hacia un punto durante `dur` segundos. */
  private diveTo(a: Agent, x: number, y: number, dur: number, stun: number) {
    a.dive = { vx: (x - a.x) / dur, vy: (y - a.y) / dur, until: this.time + dur };
    a.stunned = Math.max(a.stunned, stun);
  }
  private later(delay: number, run: () => void) {
    this.actions.push({ at: this.time + delay, run });
  }

  /** Efectos de la instrucción individual del jugador. */
  private prof(a: Agent): InstructionProfile {
    return INSTRUCTION_PROFILE[a.instruction] ?? INSTRUCTION_PROFILE.none;
  }
  /** Nivel de impulso vigente del jugador (0 si no tiene). */
  private mom(a: Agent) {
    return a.momentumUntil > this.time ? a.momentum : 0;
  }
  private style(side: TeamSide): StyleProfile {
    return STYLE[this.tactics[side].style ?? 'balanced'];
  }
  private teamSetup(side: TeamSide) {
    return side === 'home' ? this.home : this.away;
  }
  /** Atributo con penalización por cansancio. */
  private att(a: Agent, key: keyof MatchAttributes) {
    return a.attrs[key] * (0.86 + 0.14 * a.stamina);
  }
  private nearestOpponentDist(side: TeamSide, x: number, y: number) {
    let best = Infinity;
    for (const o of this.agents) {
      if (o.side === side) continue;
      const d = Math.hypot(o.x - x, o.y - y);
      if (d < best) best = d;
    }
    return best;
  }
  /** ¿Está el punto dentro del área que defiende `defending`? */
  private inBoxOf(defending: TeamSide, x: number, y: number) {
    return this.depthOf(defending, x) <= BOX_DEPTH && Math.abs(y - W / 2) <= BOX_HALF;
  }
  /** Profundidad (en coordenadas de `side`) del último defensor de campo rival. */
  private lastLine(side: TeamSide) {
    return Math.max(...this.team(this.opp(side)).filter((o) => !o.isGK).map((o) => this.depthOf(side, o.x)));
  }

  private emit(type: MatchEventType, side: TeamSide | null, text: string, important: boolean, playerId?: string, otherId?: string) {
    const e: MatchEvent = { id: ++this.eventSeq, minute: this.minute, type, side, text, important, playerId, otherId };
    this.pending.push(e);
    this.log.push(e);
    return e;
  }

  /** Emite un aviso de jugada destacada (filtrado por prioridad/enfriamiento). */
  private highlight(kind: HighlightKind, side: TeamSide, title: string, detail: string, playerId?: string, otherId?: string) {
    const major = MAJOR.has(kind);
    if (!major && this.time - this.lastHighlightAt < HIGHLIGHT_COOLDOWN) return;
    this.lastHighlightAt = this.time;
    const e = this.emit('highlight', side, `${title} ${detail}`, true, playerId, otherId);
    e.highlight = { kind, title, detail, major };
  }

  // ───────────────────────────── Saques y balón parado ─────────────────────────────

  private setupKickoff(side: TeamSide) {
    this.phase = 'kickoff';
    this.phaseTimer = 1.0;
    this.restart = null;
    this.lastPass = null;
    this.ball = { x: L / 2, y: W / 2, vx: 0, vy: 0, ownerId: null, flight: null };
    for (const a of this.agents) {
      const rel = clamp((73 - a.anchor.y) / 62, 0, 1);
      let depth = a.isGK ? 4 : 14 + rel * 32;
      depth = Math.min(depth, 48);
      const lat = W / 2 + ((a.anchor.x - 50) / 50) * 24;
      a.x = this.fx(a.side, depth);
      a.y = this.fy(a.side, lat);
      a.vx = a.vy = 0;
      a.stunned = 0;
      a.decisionTimer = 0;
      a.runLeft = 0;
    }
    const kicker = this.team(side)
      .filter((a) => !a.isGK)
      .sort((p, q) => p.anchor.y + Math.abs(p.anchor.x - 50) * 0.5 - (q.anchor.y + Math.abs(q.anchor.x - 50) * 0.5))[0];
    kicker.x = L / 2 - (side === 'home' ? 0.6 : -0.6);
    kicker.y = W / 2;
    this.giveBall(kicker, false);
    this.possession = side;
  }

  /** Mejor lanzador de balón parado del equipo. */
  private setPieceTaker(side: TeamSide, weightShot = 0.7) {
    return this.team(side)
      .filter((a) => !a.isGK)
      .sort((p, q) => {
        const s = (a: Agent) => a.attrs.shooting * weightShot + a.attrs.passing * (1 - weightShot);
        return s(q) - s(p);
      })[0];
  }

  /** Balón parado que se cuelga al área: córner o falta lateral cercana. */
  private isDelivery(kind: RestartKind, direct: boolean, side: TeamSide, x: number, y: number) {
    if (kind === 'corner') return true;
    if (kind !== 'freekick' || direct) return false;
    const d = Math.hypot(this.goalX(side) - x, W / 2 - y);
    return this.depthOf(side, x) > 62 && d < 42;
  }

  private startRestart(kind: RestartKind, side: TeamSide, x: number, y: number, direct = false) {
    let taker: Agent;
    if (kind === 'goalkick') taker = this.gk(side);
    else if (kind === 'penalty' || (kind === 'freekick' && direct)) taker = this.setPieceTaker(side);
    else if (kind === 'corner') taker = this.setPieceTaker(side, 0.2);
    else {
      taker = this.team(side)
        .filter((a) => !a.isGK)
        .sort((p, q) => Math.hypot(p.x - x, p.y - y) - Math.hypot(q.x - x, q.y - y))[0];
    }
    for (const a of this.agents) a.runLeft = 0;
    this.ball = { x, y, vx: 0, vy: 0, ownerId: null, flight: null };
    const setPiece = kind === 'penalty' || direct;
    const delivery = this.isDelivery(kind, direct, side, x, y);
    this.restart = {
      side,
      takerId: taker.id,
      x,
      y,
      // Los centrales necesitan tiempo para subir al área.
      timer: setPiece ? 4 : delivery ? 5.5 : 2.2,
      minWait: setPiece ? 2.4 : delivery ? 3.6 : 0,
      kind,
      direct,
      seed: this.rng.int(0, 9999),
    };
    this.phase = 'restart';
    this.possession = side;
    const labels: Record<RestartKind, string> = {
      throw: 'Saque de banda',
      goalkick: 'Saque de puerta',
      corner: 'Saque de esquina',
      freekick: 'Tiro libre',
      penalty: 'Penalti',
    };
    this.emit('out', side, `${labels[kind]} para ${this.teamSetup(side).shortName}`, kind === 'corner' || kind === 'penalty' || direct);
  }

  private updateRestart(dt: number) {
    const r = this.restart;
    if (!r) {
      this.phase = 'play';
      return;
    }
    r.timer -= dt;
    r.minWait -= dt;
    const taker = this.byId.get(r.takerId)!;
    const ready = Math.hypot(taker.x - r.x, taker.y - r.y) < 1.2 && r.minWait <= 0;
    if (!ready && r.timer > 0) return;
    if (r.decision === 'pending') return;
    taker.x = r.x;
    taker.y = r.y;
    taker.vx = taker.vy = 0;
    if (!r.decision && this.maybeSetPiecePrompt(r, taker)) return;
    this.restart = null;
    this.phase = 'play';
    if (r.kind === 'penalty') {
      this.shoot(taker, 'penalty');
      return;
    }
    if (r.kind === 'freekick' && r.direct) {
      this.shoot(taker, 'freekick');
      return;
    }
    this.giveBall(taker, false);
    if (this.isDelivery(r.kind, r.direct, r.side, r.x, r.y)) {
      if (r.lurkerId) this.secondBall = { lurkerId: r.lurkerId, until: this.time + 6 };
      const target = this.bestAerialTarget(taker, true);
      if (target) {
        this.pass(taker, target.agent, target.x, target.y, target.p, 'cross');
        return;
      }
    }
    taker.decisionTimer = 0.35;
    taker.mustPass = true;
  }

  /** Mejor rematador dentro del área rival para un centro desde la posición del lanzador. */
  private bestAerialTarget(from: Agent, random = false) {
    const side = from.side;
    const def = this.opp(side);
    const all: { agent: Agent; x: number; y: number; p: number; score: number }[] = [];
    for (const r of this.team(side)) {
      if (r === from || r.isGK || !this.inBoxOf(def, r.x, r.y)) continue;
      const aerial = r.attrs.physical * 0.5 + r.attrs.shooting * 0.5;
      const p = this.crossChance(from, r);
      const score = p * (0.6 + aerial / 200) * (1 + this.prof(r).aerial);
      all.push({ agent: r, x: r.x + r.vx * 0.6, y: r.y + r.vy * 0.6, p, score });
    }
    if (!all.length) return null;
    // A balón parado el centro no siempre va al mismo: el que gana la posición remata.
    if (random) return this.rng.weighted(all, (e) => e.score + 0.08);
    return all.reduce((a, b) => (b.score > a.score ? b : a));
  }

  // ───────────────────────────── Nivel 1 y 2: forma colectiva y por puesto ─────────────────────────────

  private computeTargets(dt: number) {
    const ball = this.ball;
    const owner = ball.ownerId ? this.byId.get(ball.ownerId)! : null;
    const poss = this.possession;

    for (const side of ['home', 'away'] as const) {
      const t = this.tactics[side];
      const st = this.style(side);
      const inPoss = poss === side;
      const m = MENTALITY_SHIFT[t.mentality];
      const ballDepth = this.depthOf(side, ball.x);
      const ballLat = this.latOf(side, ball.y);
      const opponents = this.team(this.opp(side));
      const lastLine = this.lastLine(side);

      let lineDepth: number, length: number, halfWidth: number, latShift: number;
      if (inPoss) {
        lineDepth = clamp(26 + t.depth * 0.18 + m * 4 + (ballDepth - 50) * 0.45 + st.line * 0.5, 18, 62);
        length = 38 + m * 4 + t.tempo * 0.04;
        halfWidth = clamp(20 + t.width * 0.13 + st.width, 16, 32);
        latShift = (ballLat - W / 2) * 0.15;
      } else {
        lineDepth = clamp(16 + t.depth * 0.2 + m * 3 + (ballDepth - 52) * 0.5 + st.line, 9 + Math.min(0, st.line), 48 + Math.max(0, st.line));
        length = 26 + m * 2;
        halfWidth = 15 + t.width * 0.05;
        latShift = (ballLat - W / 2) * 0.4;
      }

      for (const a of this.team(side)) {
        a.urgent = false;
        if (a.id === ball.ownerId) continue;
        if (a.isGK) {
          const sw = this.prof(a).sweeper;
          const depth = inPoss
            ? 7 + sw * 3
            : sw > 0
              ? clamp(2.5 + (ballDepth > 40 ? 9 : ballDepth > 25 ? 5 : 2), 1, 13)
              : sw < 0
                ? 1.6
                : clamp(2.5 + (ballDepth < 25 ? 2 : 0), 1, 8);
          const lat = W / 2 + (ballLat - W / 2) * 0.22;
          a.targetX = this.fx(side, depth);
          a.targetY = this.fy(side, lat);
          continue;
        }
        const rel = clamp((73 - a.anchor.y) / 62, 0, 1.05);
        const pf = this.prof(a);
        let depth = lineDepth + rel * length;
        let lat = W / 2 + ((a.anchor.x - 50) / 50) * halfWidth + (pf.hold ? 0 : latShift);

        if (inPoss) {
          if (a.line === 'attack') depth = Math.max(depth, Math.min(lastLine - 1, depth + 12));
          depth += pf.forward - pf.back;
          if (pf.inside) lat += (W / 2 - lat) * pf.inside;
          if (pf.wide) lat += Math.sign(lat - W / 2 || 1) * pf.wide;

          // Desmarques a la espalda de la defensa (nivel individual sobre la forma colectiva).
          const myDepth = this.depthOf(side, a.x);
          if (a.runLeft > 0) {
            a.runLeft -= dt;
            if (a.boxRun) {
              // Llegada desde segunda línea: al punto de penalti o a la frontal.
              depth = L - 11 - (a.index % 3) * 3.5;
              lat = W / 2 + ((a.index % 2 ? 1 : -1) * (3 + (a.index % 4) * 2));
            } else {
              depth = Math.min(lastLine + 7, L - 4);
              if (pf.inside > 0 || a.line === 'midfield') lat += (W / 2 - lat) * 0.55;
            }
            a.urgent = true;
          } else if (owner && owner.side === side && this.phase === 'play') {
            a.boxRun = false;
            const ownerDepth = this.depthOf(side, owner.x);
            const rate = RUN_RATE[a.line] * pf.runs * st.run * (0.6 + a.attrs.pace / 125);
            const eligible = ownerDepth > 28 && ownerDepth < 88 && myDepth > ownerDepth - 10 && lastLine < L - 12;
            if (eligible && this.rng.chance(rate * dt)) {
              a.runLeft = this.rng.range(2.2, 3.6);
              this.emit('run', side, `${a.name} pica al espacio`, false, a.id);
            } else if (ownerDepth > L - 48 && a !== owner && !pf.hold && myDepth > ownerDepth - 22 && (a.line !== 'attack' || Math.abs(a.anchor.x - 50) > 18)) {
              // Medios, extremos (entrando desde la banda) y a veces defensas llegan al área.
              const late = (a.line === 'midfield' ? 0.26 : a.line === 'attack' ? 0.3 : 0.012) * pf.late * st.run;
              if (this.rng.chance(late * dt)) {
                a.runLeft = this.rng.range(3.2, 4.6);
                a.boxRun = true;
                this.emit('run', side, `${a.name} llega desde segunda línea`, false, a.id);
              }
            }
          }
          // Apoyo: si está muy lejos del balón, se acerca para ofrecer línea de pase.
          if (owner && owner.side === side && a.runLeft <= 0) {
            const d = Math.hypot(this.fx(side, depth) - ball.x, this.fy(side, lat) - ball.y);
            if (d > 28 && !pf.hold) {
              depth += (ballDepth - depth) * 0.22;
              lat += (ballLat - lat) * 0.18;
            }
          }
        } else {
          a.runLeft = 0;
          depth -= pf.back * 0.66;
          depth += pf.forward * 0.5;
          if (a.line === 'attack') depth = Math.max(depth, ballDepth - 32);
        }

        depth = clamp(depth, 3, 102);
        lat = clamp(lat, 2, W - 2);
        let tx = this.fx(side, depth);
        let ty = this.fy(side, lat);

        // Marcaje zonal; se sigue a los rivales que pican al espacio.
        if (!inPoss && !pf.hold) {
          let best: Agent | null = null;
          let bd = 11;
          for (const o of opponents) {
            if (o.isGK || o.id === ball.ownerId) continue;
            // Los rematadores más peligrosos reciben marcaje más estrecho (a veces doble).
            const danger = o.line === 'attack' ? clamp((o.attrs.shooting - 80) / 4, 0, 3) : 0;
            const d = Math.hypot(o.x - tx, o.y - ty) - (o.runLeft > 0 ? 4 : 0) - danger;
            if (d < bd) {
              bd = d;
              best = o;
            }
          }
          if (best) {
            const goalSide = side === 'home' ? -1.6 : 1.6;
            const star = best.line === 'attack' && best.attrs.shooting >= 86;
            const k = best.runLeft > 0 ? (star ? 0.82 : 0.65) : star ? 0.55 : 0.45;
            tx += (best.x + goalSide - tx) * k;
            ty += (best.y - ty) * k;
            if (best.runLeft > 0) a.urgent = true;
          }
        }
        a.targetX = tx;
        a.targetY = ty;
      }

      // Presión sobre el poseedor rival.
      if (owner && owner.side !== side && this.phase === 'play') {
        const candidates = this.team(side)
          .filter((a) => !a.isGK && a.stunned <= 0)
          .map((a) => ({ a, d: Math.hypot(a.x - owner.x, a.y - owner.y) }))
          .sort((p, q) => p.d - q.d);
        const ownerDepthForUs = this.depthOf(side, owner.x);
        const pressCount = Math.max(1, 1 + (t.pressing > 62 || ownerDepthForUs < 35 ? 1 : 0) + (st.press > 0 && ownerDepthForUs > 55 ? 1 : 0) + (st.press < 0 && ownerDepthForUs > 50 ? -1 : 0));
        candidates.forEach(({ a, d }, i) => {
          const hold = this.prof(a).hold && d > 8;
          const instructed = this.prof(a).press > 0 && d < 22;
          if ((i < pressCount && !hold) || instructed) {
            const goalDir = side === 'home' ? -1 : 1;
            a.targetX = owner.x + goalDir * (i === 0 ? 0.6 : 3.5);
            a.targetY = owner.y;
            a.urgent = true;
          }
        });
      }
    }

    // Balón suelto: el más cercano de cada equipo va a por él.
    if (!owner) {
      const f = ball.flight;
      if (f && f.targetId) {
        const r = this.byId.get(f.targetId)!;
        r.targetX = f.toX;
        r.targetY = f.toY;
        r.urgent = true;
      }
      const chase = this.phase === 'play' && (!f || f.outcome === 'loose');
      if (chase) {
        const px = f ? f.toX : ball.x + ball.vx * 0.4;
        const py = f ? f.toY : ball.y + ball.vy * 0.4;
        for (const side of ['home', 'away'] as const) {
          const inBox = this.depthOf(side, px) < 16 && Math.abs(py - W / 2) < 20;
          const c = this.team(side)
            .filter((a) => a.stunned <= 0 && (!a.isGK || inBox || (this.prof(a).sweeper > 0 && this.depthOf(side, px) < 28)))
            .sort((p, q) => Math.hypot(p.x - px, p.y - py) - Math.hypot(q.x - px, q.y - py))[0];
          if (c) {
            c.targetX = px;
            c.targetY = py;
            c.urgent = true;
          }
        }
      }
    }

    if (this.phase === 'restart' && this.restart) this.setPieceTargets(this.restart);
  }

  /** Colocación específica de balón parado: penalti, barrera, córner. */
  private setPieceTargets(r: Restart) {
    const att = r.side;
    const def = this.opp(att);
    const taker = this.byId.get(r.takerId)!;
    taker.targetX = r.x;
    taker.targetY = r.y;
    taker.urgent = true;

    if (r.kind === 'penalty') {
      for (const a of this.agents) {
        if (a === taker) continue;
        if (a.isGK && a.side === def) {
          a.targetX = this.goalX(att) + (att === 'home' ? -0.4 : 0.4);
          a.targetY = W / 2;
          continue;
        }
        if (a.isGK) continue;
        // Todos fuera del área y detrás del punto de penalti.
        const d = this.depthOf(att, a.targetX);
        if (d > L - BOX_DEPTH - 2) a.targetX = this.fx(att, L - BOX_DEPTH - 2.5 - (a.index % 3) * 1.5);
        a.urgent = true;
      }
      return;
    }

    if (r.kind === 'freekick' && r.direct) {
      // Barrera de 4 a 9,15 m en la línea balón–portería.
      const gx = this.goalX(att);
      const dx = gx - r.x;
      const dy = W / 2 - r.y;
      const dl = Math.hypot(dx, dy) || 1;
      const wx = r.x + (dx / dl) * 9.15;
      const wy = r.y + (dy / dl) * 9.15;
      const wall = this.team(def)
        .filter((a) => !a.isGK)
        .sort((p, q) => Math.hypot(p.x - wx, p.y - wy) - Math.hypot(q.x - wx, q.y - wy))
        .slice(0, 4);
      wall.forEach((a, i) => {
        const off = (i - 1.5) * 0.9;
        a.targetX = wx + (-dy / dl) * off;
        a.targetY = wy + (dx / dl) * off;
        a.urgent = true;
      });
      return;
    }

    if (this.isDelivery(r.kind, r.direct, r.side, r.x, r.y)) {
      const gx = this.goalX(att);
      const inward = att === 'home' ? -1 : 1;
      // Suben los mejores en el juego aéreo (centrales incluidos), con algo de azar.
      const aerial = (a: Agent) =>
        a.attrs.physical * 1.1 + a.attrs.shooting * 0.45 + (((a.index + 1) * 7919 + r.seed) % 23) + (a.line === 'defence' ? 3 : 0) + this.prof(a).aerial * 40;
      const attackers = this.team(att)
        .filter((a) => a !== taker && !a.isGK)
        .sort((p, q) => aerial(q) - aerial(p))
        .slice(0, 5);
      const spots = [-6, -2.5, 0, 3, 6.5];
      attackers.forEach((a, i) => {
        a.targetX = gx + inward * (6 + (i % 3) * 3);
        a.targetY = W / 2 + spots[i];
        a.urgent = true;
      });
      const markers = this.team(def)
        .filter((a) => !a.isGK)
        .sort((p, q) => this.depthOf(att, q.x) - this.depthOf(att, p.x))
        .slice(0, 5);
      markers.forEach((a, i) => {
        const m = attackers[i];
        if (!m) return;
        a.targetX = m.targetX + inward * 0.9;
        a.targetY = m.targetY + 0.6;
        a.urgent = true;
      });
      // Un medio con buen golpeo espera el rechace en la frontal.
      const lurker = this.team(att)
        .filter((a) => a !== taker && !a.isGK && !attackers.includes(a) && a.line !== 'defence')
        .sort((p, q) => q.attrs.shooting - p.attrs.shooting)[0];
      if (lurker) {
        r.lurkerId = lurker.id;
        lurker.targetX = gx + inward * 19;
        lurker.targetY = W / 2 + (r.seed % 2 ? 3 : -3);
        lurker.urgent = true;
      }
    }
  }

  // ───────────────────────────── Nivel 3: decisiones individuales ─────────────────────────────

  private carrierDecision(dt: number) {
    const owner = this.ball.ownerId ? this.byId.get(this.ball.ownerId) : null;
    if (!owner) return;
    // Mientras el usuario decide, el poseedor (o el rival encarado) conduce despacio.
    if (this.prompt && (this.prompt.playerId === owner.id || this.prompt.rivalId === owner.id)) {
      owner.targetX = owner.dribbleX;
      owner.targetY = owner.dribbleY;
      owner.urgent = false;
      return;
    }
    owner.decisionTimer -= dt;
    owner.carryTime += dt;
    if (owner.decisionTimer > 0) {
      owner.targetX = owner.dribbleX;
      owner.targetY = owner.dribbleY;
      owner.urgent = true;
      return;
    }

    if (this.maybeDefensePrompt(owner)) return;

    const side = owner.side;
    const defSide = this.opp(side);
    const t = this.tactics[side];
    const st = this.style(side);
    const tempo = clamp(t.tempo / 100 + st.tempo, 0, 1);
    const myDepth = this.depthOf(side, owner.x);
    const myLat = this.latOf(side, owner.y);
    const opponents = this.team(defSide);
    const passing = this.att(owner, 'passing') / 100;
    const shooting = this.att(owner, 'shooting');
    const dri = this.att(owner, 'dribbling');
    const pfo = this.prof(owner);
    const noise = () => this.rng.gaussian(0, 0.035 + (1 - passing) * 0.05);
    const gx = this.goalX(side);
    const dGoal = Math.hypot(gx - owner.x, W / 2 - owner.y);

    // ── Mano a mano: ningún defensor de campo entre el poseedor y la portería.
    if (this.isOneOnOne(owner)) {
      const keeper = this.gk(defSide);
      if (!owner.oneOnOneAnnounced) {
        owner.oneOnOneAnnounced = true;
        this.highlight('oneonone', side, '¡MANO A MANO!', `${owner.name} se queda solo ante ${keeper.name}`, owner.id, keeper.id);
      }
      const dK = Math.hypot(keeper.x - owner.x, keeper.y - owner.y);
      if (dGoal > 15 && dK > 6.5) {
        // Conduce hacia la portería para acercarse.
        owner.dribbleX = owner.x + ((gx - owner.x) / dGoal) * 6;
        owner.dribbleY = owner.y + ((W / 2 - owner.y) / dGoal) * 6;
        owner.targetX = owner.dribbleX;
        owner.targetY = owner.dribbleY;
        owner.urgent = true;
        owner.decisionTimer = 0.25;
        return;
      }
      if (this.maybeAttackPrompt(owner, true)) return;
      const roundPref = clamp((dri - 62) / 34, 0.05, 0.75) * (pfo.shoot > 1.3 ? 0.3 : 1);
      if (dK < 8 && this.rng.chance(roundPref)) this.roundKeeper(owner, keeper);
      else this.shoot(owner, 'open');
      return;
    }

    if (this.maybeAttackPrompt(owner, false)) return;

    // ── Disparo (cercano o lejano)
    let shotUtil = -Infinity;
    let shotMode: ShotMode = 'open';
    const angle = clamp(1 - (Math.abs(owner.y - W / 2) - 4) / 26, 0.15, 1);
    if (!owner.isGK && !owner.mustPass && dGoal < 38) {
      const blocked = this.laneRisk(owner.x, owner.y, gx, W / 2, opponents, true).risk;
      if (dGoal < 30) {
        const q = clamp(Math.exp(-(dGoal - 7) / 10), 0, 1) * angle;
        shotUtil = q * (0.7 + (shooting / 100) * 0.8) * (1 - blocked * 0.35);
        if (dGoal < 13) shotUtil += 0.15;
      }
      if (dGoal >= 21) {
        // Disparo lejano: sólo atractivo para buenos lanzadores con espacio.
        const space = clamp(this.nearestOpponentDist(side, owner.x, owner.y) / 5, 0, 1);
        const longUtil = st.longShot * clamp((shooting - 64) / 24, 0, 1) * 0.62 * angle * (1 - blocked * 0.45) * (0.45 + space * 0.55);
        if (longUtil > shotUtil) {
          shotUtil = longUtil;
          shotMode = 'long';
        }
      }
      shotUtil *= st.shot;
      // Con impulso, el jugador busca terminar la jugada.
      const m = this.mom(owner);
      if (m > 0 && dGoal < 30) shotUtil = shotUtil * (1 + 0.7 * m) + 0.16 * m;
      // Llegada desde segunda línea: remate de primeras.
      if (owner.arrivalUntil > this.time && dGoal < 27) shotUtil += 0.3;
      shotUtil *= pfo.shoot;
    }

    // ── Pases: cortos, largos, al hueco y centros
    type PassOption = { util: number; to: Agent; x: number; y: number; p: number; variant: PassVariant };
    const pick: { best: PassOption | null } = { best: null };
    const pressedNow = this.nearestOpponentDist(side, owner.x, owner.y) < 2.6 && dGoal < 22;
    const consider = (to: Agent, x: number, y: number, variant: PassVariant, bonus: number) => {
      const p = this.passChance(owner, x, y, variant);
      bonus += variant === 'cross' ? st.cross : st[variant];
      bonus += variant === 'cross' ? pfo.cross : variant === 'long' ? pfo.long : variant === 'through' ? pfo.through : 0;
      // Quien llega desde segunda línea suele estar solo: buen destino para el pase atrás.
      if (to.boxRun && to.runLeft > 0) bonus += 0.5;
      // Pase de la muerte: si el poseedor está encimado y un compañero está libre ante el portero.
      if (pressedNow && this.depthOf(side, x) > L - 17 && Math.abs(y - W / 2) < 10 && this.nearestOpponentDist(side, x, y) > 3) bonus += 0.4;
      const rDepth = this.depthOf(side, x);
      const progress = rDepth - myDepth;
      const central = Math.abs(y - W / 2) < 12;
      const zone = rDepth > 82 ? (central ? 0.45 : 0.3) : rDepth > 66 ? 0.15 : 0;
      const value = 0.32 + clamp((progress / 35) * (1 + tempo * 0.5), -0.4, 0.85) + zone + bonus;
      const lossCost = 0.25 + (1 - myDepth / L) * 0.45;
      let util =
        pfo.keep
          ? p * p * value * 0.9 + p * 0.25 - (1 - p) * lossCost * 1.6
          : p * value - (1 - p) * lossCost;
      if (to.isGK) util *= 0.45;
      if (pfo.keep && variant !== 'short') util *= 0.7;
      util += noise();
      if (!pick.best || util > pick.best.util) pick.best = { util, to, x, y, p, variant };
    };
    const wide = myLat < 15 || myLat > W - 15;
    for (const r of this.team(side)) {
      if (r === owner || r.stunned > 0) continue;
      const rx = clamp(r.x + r.vx * 0.5, 1, L - 1);
      const ry = clamp(r.y + r.vy * 0.5, 1, W - 1);
      const d = Math.hypot(rx - owner.x, ry - owner.y);
      if (d >= 4 && d <= 62) consider(r, rx, ry, d > 30 ? 'long' : 'short', d > 30 ? 0.05 + passing * 0.1 : 0);
      // Pase al hueco a un compañero que pica al espacio.
      if (r.runLeft > 0.4 && !r.isGK) {
        const sp = Math.hypot(r.vx, r.vy) || 1;
        const lead = 5 + r.attrs.pace / 20;
        const tx = clamp(r.x + (r.vx / sp) * lead, 2, L - 2);
        const ty = clamp(r.y + (r.vy / sp) * lead, 2, W - 2);
        if (this.depthOf(side, tx) > myDepth + 4 && Math.hypot(tx - owner.x, ty - owner.y) < 48) consider(r, tx, ty, 'through', 0.35 + passing * 0.1);
      }
    }
    // Centro al área desde la banda.
    if (wide && myDepth > L - 30 && !owner.isGK) {
      const target = this.bestAerialTarget(owner, true);
      if (target) {
        const util = target.p * (0.9 + (target.agent.attrs.shooting - 70) / 100) - (1 - target.p) * 0.25 + st.cross + pfo.cross + noise();
        if (!pick.best || util > pick.best.util) pick.best = { util, to: target.agent, x: target.x, y: target.y, p: target.p, variant: 'cross' };
      }
    }

    // ── Encarar al rival (regate)
    let takeOn: { util: number; def: Agent } | null = null;
    if (!owner.isGK && !owner.mustPass) {
      const front = opponents
        .filter((o) => !o.isGK && o.stunned <= 0)
        .map((o) => ({ o, d: Math.hypot(o.x - owner.x, o.y - owner.y) }))
        .filter((e) => e.d < 3.4 && this.depthOf(side, e.o.x) > myDepth - 0.5)
        .sort((a, b) => a.d - b.d)[0];
      if (front) {
        let util = 0.12 + ((dri - 72) / 40) * 0.42 + (owner.beaten > 0 ? 0.08 : 0) + (myDepth > 65 ? 0.06 : 0);
        util *= st.takeOn;
        util *= pfo.takeOn;
        takeOn = { util: util + noise(), def: front.o };
      }
    }

    // ── Conducción
    let dribble: { util: number; x: number; y: number } | null = null;
    if (!owner.isGK && !owner.mustPass) {
      const dir = side === 'home' ? 1 : -1;
      for (const deg of [-55, -25, 0, 25, 55]) {
        const toGoal = Math.atan2(W / 2 - owner.y, gx - owner.x);
        const base = myDepth > 80 ? toGoal : dir > 0 ? 0 : Math.PI;
        const ang = base + (deg * Math.PI) / 180;
        const ax = clamp(owner.x + Math.cos(ang) * 6, 1, L - 1);
        const ay = clamp(owner.y + Math.sin(ang) * 6, 1.5, W - 1.5);
        const space = clamp(this.nearestOpponentDist(side, ax, ay) / 12, 0, 1);
        const gain = (this.depthOf(side, ax) - myDepth) / 6;
        let util = (0.06 + 0.34 * space * (0.6 + (dri / 100) * 0.5) + gain * 0.1) * Math.max(0.35, 1 - owner.carryTime / 5);
        const close = this.nearestOpponentDist(side, owner.x, owner.y);
        if (close < 2.5) util *= 0.55 + (dri / 100) * 0.45;
        if (pfo.keep) util *= 0.85;
        util += noise();
        if (!dribble || util > dribble.util) dribble = { util, x: ax, y: ay };
      }
      // Extremo que recorta hacia dentro para buscar su disparo.
      const wideNow = myLat < 18 || myLat > W - 18;
      if (wideNow && owner.line === 'attack' && myDepth > 64 && myDepth < L - 6) {
        const tx = this.fx(side, Math.min(L - 15, myDepth + 7));
        const ty = W / 2 + (owner.y < W / 2 ? -7 : 7);
        const d = Math.hypot(tx - owner.x, ty - owner.y) || 1;
        const ax = owner.x + ((tx - owner.x) / d) * 6;
        const ay = owner.y + ((ty - owner.y) / d) * 6;
        const space = clamp(this.nearestOpponentDist(side, ax, ay) / 8, 0, 1);
        const util = (0.2 + 0.32 * space) * (0.55 + (dri / 100) * 0.6) * (0.6 + clamp((shooting - 70) / 40, 0, 0.5)) * Math.max(0.4, 1 - owner.carryTime / 4) + noise();
        if (!dribble || util > dribble.util) dribble = { util, x: ax, y: ay };
      }
    }

    owner.mustPass = false;
    const bestPass = pick.best;
    const passUtil = bestPass?.util ?? -Infinity;
    const takeUtil = takeOn?.util ?? -Infinity;
    const dribUtil = dribble?.util ?? -Infinity;
    const best = Math.max(passUtil, takeUtil, dribUtil);
    const arriving = owner.arrivalUntil > this.time && dGoal < 30 && shotUtil > 0.12 && this.nearestOpponentDist(side, owner.x, owner.y) > 1.6;
    if (arriving || shotUtil + noise() > best) {
      this.shoot(owner, shotMode);
    } else if (bestPass && passUtil === best) {
      this.pass(owner, bestPass.to, bestPass.x, bestPass.y, bestPass.p, bestPass.variant);
    } else if (takeOn && takeUtil === best) {
      this.attemptTakeOn(owner, takeOn.def);
    } else if (dribble) {
      owner.dribbleX = dribble.x;
      owner.dribbleY = dribble.y;
      owner.targetX = dribble.x;
      owner.targetY = dribble.y;
      owner.urgent = true;
      owner.decisionTimer = 0.25 + (1 - tempo) * 0.35 + this.rng.range(0, 0.2);
    } else {
      owner.decisionTimer = 0.3;
    }
  }

  /** Probabilidad de que un pase del poseedor llegue a (x, y). */
  private passChance(owner: Agent, x: number, y: number, variant: PassVariant) {
    const side = owner.side;
    const opponents = this.team(this.opp(side));
    const passing = this.att(owner, 'passing') / 100;
    const d = Math.hypot(x - owner.x, y - owner.y);
    const lofted = variant !== 'short';
    // Los balones por alto sólo pueden cortarse cerca del destino.
    const lane = lofted
      ? this.laneRisk(owner.x + (x - owner.x) * 0.75, owner.y + (y - owner.y) * 0.75, x, y, opponents, false).risk * 0.8
      : this.laneRisk(owner.x, owner.y, x, y, opponents, false).risk;
    const rp = clamp(1 - this.nearestOpponentDist(side, x, y) / 6, 0, 1);
    let p = (0.99 - d * 0.0045 * (1.6 - passing)) * (1 - lane * (0.95 - passing * 0.35)) * (1 - rp * 0.25);
    if (lofted) p *= 0.72 + passing * 0.25;
    if (variant === 'through') p *= 0.82 + passing * 0.16;
    p += this.mom(owner) * 0.04;
    return clamp(p, 0.03, 0.97);
  }

  /** Probabilidad de que un centro de `from` encuentre a `r` en el área. */
  private crossChance(from: Agent, r: Agent) {
    const def = this.opp(from.side);
    const crowd = this.team(def).filter((d) => Math.hypot(d.x - r.x, d.y - r.y) < 3).length;
    const aerial = r.attrs.physical * 0.5 + r.attrs.shooting * 0.5;
    return clamp(0.4 + (this.att(from, 'passing') / 100) * 0.35 + (aerial - 70) / 200 - crowd * 0.09, 0.12, 0.82);
  }

  /** Ningún defensor de campo entre el poseedor y la portería, cerca del área. */
  private isOneOnOne(owner: Agent) {
    if (owner.isGK || owner.mustPass) return false;
    const side = owner.side;
    const myDepth = this.depthOf(side, owner.x);
    const myLat = this.latOf(side, owner.y);
    const dGoal = Math.hypot(this.goalX(side) - owner.x, W / 2 - owner.y);
    if (myDepth <= 68 || dGoal >= 34) return false;
    return !this.team(this.opp(side)).some(
      (o) => !o.isGK && this.depthOf(side, o.x) > myDepth - 1 && Math.abs(this.latOf(side, o.y) - myLat) < 9 + (this.depthOf(side, o.x) - myDepth) * 0.25,
    );
  }

  /** Probabilidad de superar a un defensor en el uno contra uno. */
  private takeOnChance(owner: Agent, def: Agent, skill = false) {
    const p =
      0.46 + ((this.att(owner, 'dribbling') - this.att(def, 'defending')) / 100) * 0.8 + ((this.att(owner, 'pace') - this.att(def, 'pace')) / 100) * 0.15;
    const m = this.mom(owner) * 0.06;
    return skill ? clamp(p + 0.11 + m, 0.18, 0.92) : clamp(p + m, 0.12, 0.9);
  }

  /** Probabilidad de que una entrada de `d` robe el balón a `owner`. */
  private tackleChance(d: Agent, owner: Agent) {
    return clamp(
      0.42 +
        ((this.att(d, 'defending') - this.att(owner, 'dribbling')) / 100) * 0.6 +
        ((this.att(d, 'physical') - this.att(owner, 'physical')) / 100) * 0.15 -
        this.mom(owner) * 0.12,
      0.08,
      0.82,
    );
  }

  /** Riesgo de que un rival corte la línea entre dos puntos (0–1) y el rival más peligroso. */
  private laneRisk(x0: number, y0: number, x1: number, y1: number, opponents: Agent[], shot: boolean) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    let survive = 1;
    let worst: { agent: Agent; r: number; t: number } | null = null;
    for (const o of opponents) {
      if (shot && o.isGK) continue;
      const { d, t } = pointSegment({ x: o.x, y: o.y }, { x: x0, y: y0 }, { x: x1, y: y1 });
      if (t <= 0.02) continue;
      const reach = 1.1 + t * len * 0.07 + (this.att(o, 'defending') / 100) * 0.6;
      const r = Math.exp(-((d / reach) ** 2)) * 0.85;
      survive *= 1 - r;
      if (!worst || r > worst.r) worst = { agent: o, r, t };
    }
    return { risk: 1 - survive, worst };
  }

  private pass(from: Agent, to: Agent, rx: number, ry: number, p: number, variant: PassVariant, decisionId?: number) {
    const side = from.side;
    const opponents = this.team(this.opp(side));
    const lofted = variant !== 'short';
    let outcome: 'complete' | 'intercepted' | 'loose';
    let tx = rx;
    let ty = ry;
    let targetId: string | null = to.id;
    if (this.rng.chance(p)) {
      outcome = 'complete';
    } else {
      const { worst } = this.laneRisk(from.x, from.y, rx, ry, opponents, false);
      if (worst && worst.r > 0.2 && (!lofted || worst.t > 0.7)) {
        outcome = 'intercepted';
        tx = from.x + (rx - from.x) * worst.t;
        ty = from.y + (ry - from.y) * worst.t;
        targetId = worst.agent.id;
      } else {
        outcome = 'loose';
        const ang = this.rng.range(0, Math.PI * 2);
        const mag = this.rng.range(3, lofted ? 11 : 9);
        tx = rx + Math.cos(ang) * mag;
        ty = ry + Math.sin(ang) * mag;
        targetId = null;
      }
    }
    const d = Math.hypot(tx - from.x, ty - from.y);
    const speed = lofted ? clamp(10 + d * 0.3, 12, 22) : clamp(11 + d * 0.42, 12, 27);
    this.ball.ownerId = null;
    this.ball.flight = {
      kind: 'pass',
      lofted,
      variant,
      fromX: from.x,
      fromY: from.y,
      toX: tx,
      toY: ty,
      start: this.time,
      duration: Math.max(0.2, d / speed),
      outcome,
      targetId,
      kickerId: from.id,
      decisionId,
    };
    this.lastTouch = side;
    this.stats[side].passes++;
    const verb = variant === 'through' ? 'filtra un pase al hueco para' : variant === 'cross' ? 'centra al área buscando a' : variant === 'long' ? 'lanza en largo hacia' : 'busca a';
    this.emit('pass', side, `${from.name} ${verb} ${to.name}`, variant !== 'short', from.id, to.id);
  }

  /** Encarar a un defensor: el motor resuelve el duelo en el acto. */
  private attemptTakeOn(owner: Agent, def: Agent) {
    const side = owner.side;
    const p = this.takeOnChance(owner, def);
    def.tackleTimer = 0.8;
    if (this.rng.chance(p)) {
      def.stunned = 1.3;
      this.registerBeaten(owner, def);
      // Arrancada tras el regate.
      const gx = this.goalX(side);
      const dGoal = Math.hypot(gx - owner.x, W / 2 - owner.y) || 1;
      owner.dribbleX = clamp(owner.x + ((gx - owner.x) / dGoal) * 7, 1, L - 1);
      owner.dribbleY = clamp(owner.y + ((W / 2 - owner.y) / dGoal) * 4 + this.rng.range(-2, 2), 1.5, W - 1.5);
      owner.targetX = owner.dribbleX;
      owner.targetY = owner.dribbleY;
      owner.urgent = true;
      owner.decisionTimer = 0.45;
      owner.carryTime = Math.max(0, owner.carryTime - 1.5);
    } else {
      owner.stunned = 0.6;
      this.giveBall(def, true);
      this.stats[def.side].tackles++;
      this.emit('tackle', def.side, `${def.name} frena a ${owner.name}`, false, def.id, owner.id);
    }
  }

  private registerBeaten(owner: Agent, def: Agent) {
    owner.beaten++;
    this.stats[owner.side].dribblesWon++;
    this.emit('dribble', owner.side, `${owner.name} supera a ${def.name}`, false, owner.id, def.id);
    if (owner.beaten >= 2 && owner.beaten > owner.skillAnnounced) {
      owner.skillAnnounced = owner.beaten;
      const title = owner.beaten >= 3 ? `¡SE VA DE ${owner.beaten}!` : '¡SE VA DE DOS!';
      this.highlight('skillrun', owner.side, title, `${owner.name} deja atrás a ${owner.beaten} rivales`, owner.id);
    }
  }

  /** Regatear al portero en un mano a mano. */
  /**
   * Regatear al portero, animado: el portero se lanza a los pies y el delantero
   * lo rodea antes de empujarla a puerta vacía (o el portero se la roba).
   */
  private roundKeeper(owner: Agent, keeper: Agent, p = this.roundChance(owner, keeper), ctx?: DecisionCtx) {
    const side = owner.side;
    const dir = side === 'home' ? 1 : -1;
    const goSide = owner.y < keeper.y ? -1 : 1;
    owner.decisionTimer = 5;
    owner.protectedUntil = this.time + 1;
    if (this.rng.chance(p)) {
      this.diveTo(keeper, owner.x + dir * 0.4, owner.y - goSide * 0.6, 0.35, 2.4);
      owner.dribbleX = clamp(keeper.x + dir * 2.4, 1, L - 1);
      owner.dribbleY = clamp(keeper.y + goSide * 3.2, 1, W - 1);
      owner.targetX = owner.dribbleX;
      owner.targetY = owner.dribbleY;
      owner.urgent = true;
      this.highlight('roundkeeper', side, '¡REGATEA AL PORTERO!', `${owner.name} deja sentado a ${keeper.name}`, owner.id, keeper.id);
      this.later(0.6, () => {
        if (this.ball.ownerId === owner.id) this.shoot(owner, 'emptynet', { decisionId: ctx?.promptId });
      });
    } else {
      this.diveTo(keeper, owner.x, owner.y, 0.3, 0.3);
      this.later(0.3, () => {
        if (this.ball.ownerId !== owner.id) return;
        owner.stunned = 0.8;
        owner.protectedUntil = 0;
        this.giveBall(keeper, false);
        keeper.decisionTimer = 1.0;
        keeper.mustPass = true;
        this.highlight('bigsave', keeper.side, '¡EL PORTERO GANA EL DUELO!', `${keeper.name} le roba el balón a ${owner.name}`, keeper.id, owner.id);
        if (ctx) this.result(ctx, 'fail', 'EL PORTERO GANA', `${keeper.name} le roba el balón a ${owner.name}`, owner.id);
      });
    }
  }

  /**
   * Modelo de disparo: probabilidad de ir a puerta y de que el portero no la
   * detenga. `style` modifica el golpeo elegido en una decisión.
   */
  private shotProbs(a: Agent, mode: ShotMode, style?: ShotStyle) {
    const side = a.side;
    const defending = this.opp(side);
    const gx = this.goalX(side);
    const dGoal = Math.hypot(gx - a.x, W / 2 - a.y);
    const sho = this.att(a, 'shooting');
    const m = mode === 'penalty' || mode === 'freekick' ? 0 : this.mom(a);
    const pressure = mode === 'penalty' || mode === 'freekick' ? 0 : clamp(1 - this.nearestOpponentDist(side, a.x, a.y) / 3, 0, 1) * (1 - m * 0.3);
    const angle = clamp(1 - (Math.abs(a.y - W / 2) - 4) / 26, 0.15, 1);
    const keeper = this.gk(defending);
    const line = this.prof(keeper).sweeper;
    const gkSkill =
      (keeper.stunned > 0 ? 10 : this.att(keeper, 'goalkeeping') * 0.6 + this.att(keeper, 'reflexes') * 0.4) +
      (style?.gkBonus ?? 0) +
      (line < 0 ? (mode === 'header' ? -3 : 3) : line > 0 ? (mode === 'header' ? 3 : -1) : 0);

    let onTarget: number;
    let goalGiven: number;
    switch (mode) {
      case 'penalty':
        onTarget = 0.93;
        goalGiven = clamp(0.8 + (sho - gkSkill) / 250, 0.62, 0.93);
        break;
      case 'emptynet':
        onTarget = 0.95;
        goalGiven = 0.96;
        break;
      case 'freekick':
        onTarget = clamp(0.24 + (sho / 100) * 0.38 + (this.att(a, 'passing') / 100) * 0.15 - (dGoal - 18) * 0.01, 0.15, 0.7);
        goalGiven = clamp(0.2 + ((sho - gkSkill) / 100) * 0.5 - (dGoal - 18) * 0.008, 0.05, 0.5);
        break;
      case 'header': {
        // Los centrales cabecean bien aunque no sean grandes tiradores.
        const aerial = Math.max(sho, this.att(a, 'defending') * 0.85) * 0.55 + this.att(a, 'physical') * 0.45;
        onTarget = clamp(0.26 + (aerial / 100) * 0.42 - (dGoal - 6) * 0.02 - pressure * 0.12, 0.1, 0.75);
        goalGiven = clamp(0.32 + ((aerial - gkSkill) / 100) * 0.5 - (dGoal - 7) * 0.02, 0.06, 0.7);
        break;
      }
      default:
        onTarget = clamp(0.34 + (sho / 100) * 0.5 - (dGoal - 10) * 0.012 - pressure * 0.15, 0.1, 0.88);
        goalGiven = clamp(0.37 + ((sho - gkSkill) / 100) * 0.45 - (dGoal - 11) * 0.016 + (angle - 1) * 0.2, 0.04, 0.85);
    }
    switch (style?.kind) {
      case 'finesse': {
        // Colocado: algo menos preciso, pero mucho más difícil de parar si va dentro.
        const touch = (this.att(a, 'passing') + sho) / 200;
        onTarget *= 0.86 + touch * 0.1;
        goalGiven = clamp(goalGiven * 1.22 + (touch - 0.75) * 0.3, 0.04, 0.9);
        break;
      }
      case 'power': {
        const strike = (sho * 0.6 + this.att(a, 'physical') * 0.4) / 100;
        onTarget *= 0.78 + strike * 0.12;
        goalGiven = clamp(goalGiven * 1.3 + (strike - 0.75) * 0.25, 0.04, 0.9);
        break;
      }
      case 'placed': {
        // Cabezazo picado al suelo: más preciso, algo menos potente.
        onTarget = clamp(onTarget + 0.1, 0, 0.85);
        goalGiven = clamp(goalGiven * 1.05, 0.04, 0.8);
        break;
      }
      case 'volley': {
        // Controlar y disparar: depende del regate (control) y del tiro, con la presión del rival.
        const ctrl = (this.att(a, 'dribbling') + sho) / 200;
        onTarget = clamp(onTarget * (0.6 + ctrl * 0.3), 0.08, 0.85);
        goalGiven = clamp(goalGiven * (0.8 + ctrl * 0.3), 0.04, 0.8);
        break;
      }
      case 'chip': {
        // Vaselina: depende de lo adelantado que esté el portero.
        const off = Math.abs(keeper.x - this.goalX(side));
        onTarget = clamp(0.42 + (sho + this.att(a, 'dribbling')) / 500 - pressure * 0.1, 0.25, 0.85);
        goalGiven = clamp(0.2 + off * 0.075 + (sho - 75) / 150, 0.08, 0.92);
        break;
      }
    }
    if (m > 0) {
      // Jugada trabajada: el rematador llega en ventaja (balanceado: nunca gol seguro).
      onTarget = clamp(onTarget + 0.07 * m, 0, 0.92);
      goalGiven = clamp(goalGiven * (1 + 0.2 * m) + 0.03 * m, 0, 0.82);
    }
    return { onTarget, goalGiven, xg: onTarget * goalGiven, dGoal, keeper };
  }

  private shoot(a: Agent, mode: ShotMode, style?: ShotStyle) {
    const side = a.side;
    const gx = this.goalX(side);
    const { onTarget, goalGiven, dGoal, keeper } = this.shotProbs(a, mode, style);
    const xg = onTarget * goalGiven;
    let outcome: 'goal' | 'saved' | 'miss' | 'post';
    if (style?.forced) outcome = style.forced;
    else {
      const roll = this.rng.next();
      if (roll < xg) outcome = 'goal';
      else if (roll < onTarget) outcome = 'saved';
      else outcome = this.rng.chance(mode === 'emptynet' ? 0.3 : 0.16) ? 'post' : 'miss';
    }

    const dirOut = side === 'home' ? 1 : -1;
    let tx: number, ty: number;
    if (outcome === 'goal') {
      tx = gx + dirOut * 1.2;
      ty = style?.aimY ?? W / 2 + this.rng.range(-GOAL_HALF + 0.4, GOAL_HALF - 0.4);
    } else if (outcome === 'saved') {
      tx = gx - dirOut * 0.9;
      ty = style?.aimY ?? clamp(keeper.y + this.rng.range(-1.5, 1.5), W / 2 - GOAL_HALF, W / 2 + GOAL_HALF);
    } else if (outcome === 'post') {
      tx = gx;
      ty = W / 2 + (this.rng.chance(0.5) ? 1 : -1) * GOAL_HALF;
    } else {
      tx = gx + dirOut * 1.5;
      ty = W / 2 + (this.rng.chance(0.5) ? 1 : -1) * (GOAL_HALF + this.rng.range(0.6, 6));
    }
    const d = Math.hypot(tx - a.x, ty - a.y);
    const speed = style?.kind === 'chip' ? 15 : mode === 'freekick' ? 23 : mode === 'header' ? 18 : style?.kind === 'power' ? 33 : 27;
    this.ball.ownerId = null;
    this.ball.flight = {
      kind: 'shot',
      lofted: mode === 'freekick' || mode === 'long' || style?.kind === 'chip',
      variant: mode,
      xg,
      fromX: a.x,
      fromY: a.y,
      toX: tx,
      toY: ty,
      start: this.time,
      duration: Math.max(0.25, d / speed),
      outcome,
      targetId: outcome === 'saved' ? keeper.id : null,
      kickerId: a.id,
      decisionId: style?.decisionId,
    };
    this.lastTouch = side;
    this.stats[side].shots++;
    if (outcome === 'goal' || outcome === 'saved') this.stats[side].shotsOnTarget++;
    // El portero se estira hacia el balón (parada) o llega tarde (gol).
    const flightTime = Math.max(0.25, Math.hypot(tx - a.x, ty - a.y) / speed);
    if (!keeper.dive && keeper.stunned <= 0 && mode !== 'emptynet' && (outcome === 'saved' || outcome === 'goal')) {
      const reach = outcome === 'saved' ? 1 : 0.55;
      this.diveTo(keeper, keeper.x + (tx - keeper.x) * 0.5 * reach, keeper.y + (ty - keeper.y) * reach, Math.min(0.45, flightTime), 0.5);
    }
    const label: Record<ShotMode, string> = {
      open: 'Disparo de',
      long: 'Disparo lejano de',
      header: 'Remate de cabeza de',
      freekick: 'Tiro libre directo de',
      penalty: 'Penalti lanzado por',
      emptynet: 'Tiro a puerta vacía de',
    };
    this.emit('shot', side, `${label[mode]} ${a.name}`, true, a.id);
    if (mode === 'long') this.highlight('longshot', side, '¡DISPARO LEJANO!', `${a.name} lo intenta desde ${Math.round(dGoal)} m`, a.id);
  }

  private defensiveDuels() {
    const owner = this.ball.ownerId ? this.byId.get(this.ball.ownerId) : null;
    if (!owner) return;
    if (this.prompt && (this.prompt.playerId === owner.id || this.prompt.rivalId === owner.id)) return;
    if (owner.protectedUntil > this.time) return;
    const side = this.opp(owner.side);
    const t = this.tactics[side];
    const st = this.style(side);
    for (const d of this.team(side)) {
      if (d.stunned > 0 || d.tackleTimer > 0 || d.isGK) continue;
      const dist = Math.hypot(d.x - owner.x, d.y - owner.y);
      if (dist > 1.8) continue;
      d.tackleTimer = 0.45;
      const attempt = 0.5 + this.prof(d).press * 0.2 + t.pressing / 500 + st.foul * 2;
      if (!this.rng.chance(attempt)) continue;
      // Falta: más probable cuanto mejor regatea el rival y más se presiona.
      const foulP = clamp(
        0.075 + st.foul + this.prof(d).press * 0.04 + t.pressing / 1600 + (this.att(owner, 'dribbling') - this.att(d, 'defending')) / 500,
        0.03,
        0.18,
      );
      if (this.rng.chance(foulP)) {
        this.foul(d, owner);
        return;
      }
      const p = this.tackleChance(d, owner);
      if (this.rng.chance(p)) {
        owner.stunned = 0.7;
        this.giveBall(d, true);
        this.stats[side].tackles++;
        this.emit('tackle', side, `Recuperación de ${d.name} ante ${owner.name}`, false, d.id, owner.id);
      } else {
        d.stunned = 1.0;
        this.registerBeaten(owner, d);
      }
      return;
    }
  }

  /** Falta: tarjeta opcional y balón parado (penalti, tiro libre directo o indirecto). */
  private foul(def: Agent, victim: Agent, cardChance = 0.2) {
    const att = victim.side;
    this.stats[def.side].fouls++;
    this.emit('foul', def.side, `Falta de ${def.name} sobre ${victim.name}`, true, def.id, victim.id);
    victim.stunned = 0.5;
    if (!def.booked && this.rng.chance(cardChance)) {
      def.booked = true;
      this.stats[def.side].yellowCards++;
      this.emit('card', def.side, `Tarjeta amarilla para ${def.name}`, true, def.id);
      this.highlight('card', def.side, 'TARJETA AMARILLA', `${def.name} ve la amarilla`, def.id);
    }
    const x = clamp(victim.x, 1, L - 1);
    const y = clamp(victim.y, 1, W - 1);
    if (this.inBoxOf(def.side, x, y)) {
      this.startRestart('penalty', att, this.fx(att, L - 11), W / 2);
      const taker = this.byId.get(this.restart!.takerId)!;
      this.highlight('penalty', att, '¡PENALTI!', `${def.name} derriba a ${victim.name} en el área · lanzará ${taker.name}`, victim.id, def.id);
      return;
    }
    const dGoal = Math.hypot(this.goalX(att) - x, W / 2 - y);
    if (dGoal < 31 && Math.abs(y - W / 2) < 22) {
      this.startRestart('freekick', att, x, y, true);
      const taker = this.byId.get(this.restart!.takerId)!;
      this.highlight('freekick', att, 'TIRO LIBRE PELIGROSO', `${taker.name} se prepara a ${Math.round(dGoal)} m de la portería`, taker.id);
      return;
    }
    this.startRestart('freekick', att, x, y, false);
  }

  // ───────────────────────────── Decisiones del usuario ─────────────────────────────

  private cooldown() {
    return this.frequency === 'off' ? Infinity : DECISION_COOLDOWN[this.frequency];
  }

  private chainLevel(playerId: string) {
    const c = this.chain;
    return c && c.playerId === playerId && this.time <= c.until && c.level <= MAX_CHAIN ? c.level : 0;
  }

  /** Abre una decisión con el balón si la jugada lo merece. */
  private maybeAttackPrompt(owner: Agent, oneOnOne: boolean): boolean {
    if (!this.decisionSide || owner.side !== this.decisionSide || this.prompt || owner.isGK || owner.mustPass) return false;
    const chain = this.chainLevel(owner.id);
    const since = this.time - this.lastPromptAt;
    const depth = this.depthOf(owner.side, owner.x);
    if (oneOnOne) {
      if (since < 3) return false;
    } else {
      if (!chain && (since < this.cooldown() || this.time < 15)) return false;
      if (depth < (chain ? (this.mom(owner) ? 46 : 58) : 56)) return false;
    }
    const specs = oneOnOne ? this.oneOnOneOptions(owner) : this.attackOptions(owner);
    const picked = this.pickOptions(specs);
    if (picked.length < 2) return false;
    const side = owner.side;
    const keeper = this.gk(this.opp(side));
    const context: DecisionContext = oneOnOne ? 'oneonone' : 'attack';
    const title = oneOnOne ? '¡MANO A MANO!' : chain ? `${owner.name} sigue la jugada` : `${owner.name} lleva el balón`;
    const situation = oneOnOne ? `${owner.name} encara a ${keeper.name}` : this.describeZone(owner);
    this.openPrompt(context, owner, picked, title, situation, chain);
    return true;
  }

  /** Centro que llega a un compañero dentro del área: cómo rematarlo. */
  private maybeAerialPrompt(r: Agent, kicker: Agent): boolean {
    if (!this.decisionSide || r.side !== this.decisionSide || this.prompt || this.frequency === 'off') return false;
    const side = r.side;
    const gx = this.goalX(side);
    const keeper = this.gk(this.opp(side));
    const aerial = `FÍS ${this.stat(r, 'physical')} · TIR ${this.stat(r, 'shooting')}`;
    const specs: (OptionSpec | null)[] = [
      this.spec(r, 'header', 'Cabezazo potente', aerial, { point: { x: gx, y: W / 2 } }),
      this.spec(r, 'header-down', 'Cabezazo picado al suelo', `${aerial} · más preciso`, { point: { x: gx, y: keeper.y < W / 2 ? W / 2 + 2.6 : W / 2 - 2.6 } }),
      this.spec(r, 'volley', 'Controlar y disparar', `REG ${this.stat(r, 'dribbling')} · TIR ${this.stat(r, 'shooting')}`, { point: { x: gx, y: W / 2 } }),
    ];
    const mate = this.team(side)
      .filter((m) => m !== r && m !== kicker && !m.isGK && Math.hypot(m.x - r.x, m.y - r.y) < 11 && this.depthOf(side, m.x) > L - 20)
      .sort((p, q) => this.nearestOpponentDist(side, q.x, q.y) - this.nearestOpponentDist(side, p.x, p.y))[0];
    if (mate) specs.push(this.spec(r, 'knockdown', `Dejarla de cabeza a ${mate.name}`, `Remate de ${mate.name} (TIR ${this.stat(mate, 'shooting')})`, { targetId: mate.id, reward: 'high' }));
    const list = specs.filter((o): o is OptionSpec => !!o);
    this.openPrompt('aerial', r, list, '¡CENTRO AL ÁREA!', `${kicker.name} la pone · remata ${r.name}`, this.chainLevel(r.id));
    return true;
  }

  /** Abre una decisión defensiva cuando el rival amenaza el área propia. */
  private maybeDefensePrompt(rival: Agent): boolean {
    const us = this.decisionSide;
    if (!us || rival.side === us || this.prompt || rival.isGK) return false;
    if (this.time - this.lastDefPromptAt < this.cooldown() * 2.4 || this.time - this.lastPromptAt < this.cooldown() * 0.4) return false;
    const depth = this.depthOf(rival.side, rival.x);
    if (depth < 64) return false;
    let specs: OptionSpec[];
    let actor: Agent;
    let context: DecisionContext;
    let title: string;
    if (this.isOneOnOne(rival)) {
      const dGoal = Math.hypot(this.goalX(rival.side) - rival.x, W / 2 - rival.y);
      if (dGoal > 22) return false;
      actor = this.gk(us);
      specs = this.keeperOptions(actor, rival);
      context = 'keeper';
      title = `¡${rival.name} se queda solo!`;
    } else {
      const d = this.team(us)
        .filter((a) => !a.isGK && a.stunned <= 0)
        .map((a) => ({ a, d: Math.hypot(a.x - rival.x, a.y - rival.y) }))
        .sort((p, q) => p.d - q.d)[0];
      if (!d || d.d > 4.2) return false;
      actor = d.a;
      specs = this.defenseOptions(actor, rival);
      context = 'defense';
      title = `${rival.name} avanza hacia tu área`;
    }
    const picked = this.pickOptions(specs);
    if (picked.length < 2) return false;
    this.lastDefPromptAt = this.time;
    // El atacante avanza despacio mientras el usuario decide.
    const gx = this.goalX(rival.side);
    const dl = Math.hypot(gx - rival.x, W / 2 - rival.y) || 1;
    rival.dribbleX = rival.x + ((gx - rival.x) / dl) * 2;
    rival.dribbleY = rival.y + ((W / 2 - rival.y) / dl) * 2;
    this.openPrompt(context, actor, picked, title, `Decide ${actor.name} (${this.teamSetup(us).shortName})`, 0, rival);
    return true;
  }

  /** Penaltis, tiros libres directos y córners del equipo del usuario. */
  private maybeSetPiecePrompt(r: Restart, taker: Agent): boolean {
    if (!this.decisionSide || r.side !== this.decisionSide || this.prompt) return false;
    if (r.kind !== 'penalty' && r.kind !== 'corner' && !(r.kind === 'freekick' && r.direct)) return false;
    if (r.kind === 'corner' && this.frequency !== 'off' && !this.rng.chance(CORNER_PROMPT[this.frequency])) {
      r.decision = 'auto';
      return false;
    }
    const specs = this.setPieceOptions(r, taker);
    const picked = r.kind === 'penalty' ? specs : this.pickOptions(specs, 3);
    if (picked.length < 2) {
      r.decision = 'auto';
      return false;
    }
    r.decision = 'pending';
    const dGoal = Math.round(Math.hypot(this.goalX(r.side) - r.x, W / 2 - r.y));
    const title = r.kind === 'penalty' ? '¡PENALTI A FAVOR!' : r.kind === 'corner' ? 'SAQUE DE ESQUINA' : `TIRO LIBRE A ${dGoal} M`;
    taker.dribbleX = taker.x;
    taker.dribbleY = taker.y;
    this.openPrompt('setpiece', taker, picked, title, `Lanza ${taker.name}`, 0);
    return true;
  }

  private openPrompt(context: DecisionContext, actor: Agent, specs: OptionSpec[], title: string, situation: string, chain: number, rival?: Agent) {
    const id = ++this.promptSeq;
    if (context === 'aerial') {
      // El balón "está en el aire": el rematador espera quieto.
      actor.dribbleX = actor.x;
      actor.dribbleY = actor.y;
    } else if (context === 'attack' || context === 'oneonone') {
      // Conducción lenta hacia delante mientras se decide.
      const dir = actor.side === 'home' ? 1 : -1;
      actor.dribbleX = clamp(actor.x + dir * 1.6, 1, L - 1);
      actor.dribbleY = actor.y;
    }
    this.chain = null;
    if (context !== 'defense' && context !== 'keeper') this.lastPromptAt = this.time;
    this.prompt = {
      id,
      side: this.decisionSide!,
      context,
      playerId: actor.id,
      playerName: actor.name,
      rivalId: rival?.id,
      title,
      situation,
      options: [],
      specs: specs.map((o, i) => ({ ...o, id: `${i + 1}-${o.kind}` })),
      createdAt: this.time,
      expiresAt: this.time + PROMPT_WINDOW[context],
      chain,
      refreshAt: this.time + 0.25,
    };
    this.publish();
  }

  private publish() {
    const pr = this.prompt;
    if (!pr) {
      this.publicPrompt = null;
      return;
    }
    const { specs, refreshAt: _r, ...rest } = pr;
    this.publicPrompt = {
      ...rest,
      options: specs.map(({ score: _s, move: _m, ...o }) => ({ ...o, point: o.point ? { ...o.point } : undefined })),
    };
  }

  private clearPrompt() {
    if (!this.prompt) return;
    const r = this.restart;
    if (r && r.decision === 'pending') r.decision = 'auto';
    this.prompt = null;
    this.publicPrompt = null;
  }

  /** Se acabó el tiempo: decide la IA. */
  private expirePrompt() {
    const pr = this.prompt;
    if (!pr) return;
    this.clearPrompt();
    const a = this.byId.get(pr.playerId);
    if (a && (pr.context === 'attack' || pr.context === 'oneonone')) a.decisionTimer = 0;
    if (a && pr.context === 'aerial' && this.ball.ownerId === a.id) this.shoot(a, 'header');
    this.emit('decision', pr.side, `${pr.playerName}: decide el equipo técnico`, false, pr.playerId);
  }

  private promptStillValid(pr: ActivePrompt) {
    switch (pr.context) {
      case 'attack':
      case 'oneonone':
      case 'aerial':
        return this.phase === 'play' && this.ball.ownerId === pr.playerId;
      case 'defense':
      case 'keeper':
        return this.phase === 'play' && this.ball.ownerId === pr.rivalId;
      case 'setpiece':
        return this.phase === 'restart' && this.restart?.decision === 'pending';
    }
  }

  /** Reevalúa las probabilidades con las posiciones actuales (los jugadores se mueven). */
  private refreshPrompt(force: boolean) {
    const pr = this.prompt;
    if (!pr) return;
    pr.refreshAt = this.time + 0.25;
    const actor = this.byId.get(pr.playerId)!;
    const rival = pr.rivalId ? this.byId.get(pr.rivalId) : undefined;
    let changed = force;
    for (const o of pr.specs) {
      const c = this.evaluate(o, actor, rival);
      if (c === null) continue;
      if (Math.abs(c - o.chance) > 0.005) changed = true;
      o.chance = c;
      o.likelihood = likelihoodOf(c, o.measure);
      const pt = this.optionPoint(o, actor);
      if (pt) o.point = pt;
    }
    if (changed) this.publish();
  }

  /** Elige 2–4 opciones variadas: la mejor de cada familia y luego las más valiosas. */
  private pickOptions(specs: OptionSpec[], maxPerFamily = 2): OptionSpec[] {
    const sorted = [...specs].sort((a, b) => b.score - a.score);
    const out: OptionSpec[] = [];
    const per: Partial<Record<DecisionFamily, number>> = {};
    for (const fam of ['move', 'pass', 'shot', 'defense'] as DecisionFamily[]) {
      const best = sorted.find((o) => o.family === fam);
      if (best) {
        out.push(best);
        per[fam] = 1;
      }
    }
    for (const o of sorted) {
      if (out.length >= 4) break;
      const cap = o.family === 'defense' ? 4 : maxPerFamily;
      if (out.includes(o) || (per[o.family] ?? 0) >= cap || o.score < -0.1) continue;
      out.push(o);
      per[o.family] = (per[o.family] ?? 0) + 1;
    }
    const order: DecisionFamily[] = ['move', 'pass', 'shot', 'defense'];
    return out
      .slice(0, 4)
      .sort((a, b) => order.indexOf(a.family) - order.indexOf(b.family) || (a.family === 'defense' ? specs.indexOf(a) - specs.indexOf(b) : b.score - a.score));
  }

  private describeZone(a: Agent) {
    const side = a.side;
    const depth = this.depthOf(side, a.x);
    const lat = this.latOf(side, a.y);
    const flank = lat < 18 ? 'izquierda' : lat > W - 18 ? 'derecha' : null;
    const close = this.team(this.opp(side))
      .filter((o) => !o.isGK)
      .map((o) => ({ o, d: Math.hypot(o.x - a.x, o.y - a.y) }))
      .sort((p, q) => p.d - q.d)[0];
    const zone =
      depth > L - BOX_DEPTH && !flank
        ? 'Dentro del área'
        : depth > L - 26
          ? flank
            ? `Banda ${flank}, cerca de la línea de fondo`
            : 'Frontal del área'
          : depth > L * 0.62
            ? flank
              ? `Tres cuartos, banda ${flank}`
              : 'Tres cuartos de campo'
            : 'Medio campo rival';
    return close && close.d < 4.5 ? `${zone} · le presiona ${close.o.name}` : `${zone} · con espacio`;
  }

  /** Construye una opción con su probabilidad, riesgo y recompensa. */
  private spec(
    actor: Agent,
    kind: DecisionKind,
    label: string,
    detail: string,
    extra: { targetId?: string; point?: { x: number; y: number }; trait?: string; move?: string; risk?: Level; reward?: Level; bonus?: number },
    rival?: Agent,
  ): OptionSpec | null {
    const measure: 'success' | 'goal' = FAMILY[kind] === 'shot' ? 'goal' : 'success';
    const base: OptionSpec = {
      id: kind,
      kind,
      family: FAMILY[kind],
      label,
      detail,
      chance: 0,
      measure,
      likelihood: 'medium',
      risk: extra.risk ?? 'medium',
      reward: extra.reward ?? 'medium',
      trait: extra.trait,
      targetId: extra.targetId,
      point: extra.point,
      move: extra.move,
      score: 0,
    };
    const c = this.evaluate(base, actor, rival);
    if (c === null) return null;
    base.chance = c;
    base.likelihood = likelihoodOf(c, measure);
    if (!extra.risk) base.risk = this.riskOf(kind, actor);
    if (!extra.reward) base.reward = this.rewardOf(kind);
    const lossCost = base.risk === 'high' ? 0.55 : base.risk === 'medium' ? 0.3 : 0.12;
    base.score =
      measure === 'goal'
        ? c * 2.6 + 0.12
        : c * (REWARD_VALUE[kind] ?? 0.5) - (1 - c) * lossCost + (FAMILY[kind] === 'defense' ? 0.5 : 0);
    base.score += (extra.trait ? 0.12 : 0) + (extra.bonus ?? 0);
    return base;
  }

  private riskOf(kind: DecisionKind, a: Agent): Level {
    const depth = this.depthOf(a.side, a.x);
    switch (kind) {
      case 'shoot':
      case 'finesse':
      case 'power':
      case 'longshot':
      case 'chip':
      case 'cross':
      case 'fk-shot':
      case 'fk-power':
      case 'fk-cross':
      case 'corner-near':
      case 'corner-far':
      case 'pen-left':
      case 'pen-right':
      case 'pen-center':
      case 'panenka':
      case 'jockey':
        return 'low';
      case 'roundkeeper':
      case 'tackle':
      case 'tacticalfoul':
      case 'corner-edge':
      case 'fk-short':
      case 'gk-stay':
        return 'medium';
      case 'slide':
        return this.inBoxOf(a.side, a.x, a.y) || this.depthOf(a.side, a.x) < 22 ? 'high' : 'medium';
      case 'gk-rush':
        return 'high';
      default:
        return depth < 45 ? 'high' : depth < 70 ? 'medium' : kind === 'skill' ? 'medium' : 'low';
    }
  }

  private rewardOf(kind: DecisionKind): Level {
    switch (kind) {
      case 'pass':
      case 'shield':
      case 'jockey':
      case 'fk-short':
      case 'corner-edge':
        return 'low';
      case 'carry':
      case 'dribble':
      case 'switch':
      case 'longball':
      case 'tackle':
      case 'tacticalfoul':
        return 'medium';
      default:
        return 'high';
    }
  }

  /** Probabilidad actual de una opción (null si ya no es aplicable). */
  private evaluate(o: OptionSpec, a: Agent, rival?: Agent): number | null {
    const target = o.targetId ? this.byId.get(o.targetId) : undefined;
    const side = a.side;
    switch (o.kind) {
      case 'dribble':
      case 'skill':
        return target ? this.takeOnChance(a, target, o.kind === 'skill') : null;
      case 'carry': {
        const pt = this.carryPoint(a);
        const space = this.nearestOpponentDist(side, pt.x, pt.y);
        return clamp(0.42 + clamp(space / 10, 0, 1) * 0.35 + (this.att(a, 'dribbling') - 70) / 200 + (this.att(a, 'pace') - 70) / 400, 0.18, 0.93);
      }
      case 'shield': {
        const near = this.team(this.opp(side)).reduce((m, x) => Math.min(m, Math.hypot(x.x - a.x, x.y - a.y)), Infinity);
        const nd = this.team(this.opp(side)).find((x) => Math.hypot(x.x - a.x, x.y - a.y) === near);
        return clamp(0.52 + (this.att(a, 'physical') - (nd ? this.att(nd, 'defending') : 60)) / 100 * 0.7 + (near > 3 ? 0.12 : 0), 0.2, 0.9);
      }
      case 'pass':
      case 'longball':
      case 'switch':
      case 'fk-short':
      case 'corner-edge': {
        if (!target) return null;
        const pt = this.optionPoint(o, a)!;
        const variant: PassVariant = o.kind === 'pass' || o.kind === 'fk-short' ? 'short' : 'long';
        return this.passChance(a, pt.x, pt.y, variant);
      }
      case 'through': {
        if (!target) return null;
        const pt = this.leadPoint(a, target);
        const bonus = o.trait ? 0.08 : 0;
        return clamp(this.passChance(a, pt.x, pt.y, 'through') + bonus, 0.03, 0.97);
      }
      case 'onetwo': {
        if (!target) return null;
        const first = this.passChance(a, target.x, target.y, 'short');
        const ret = this.runPoint(a);
        const back = clamp(0.95 - Math.hypot(ret.x - target.x, ret.y - target.y) * 0.006 - (1 - this.att(target, 'passing') / 100) * 0.35 - clamp(1 - this.nearestOpponentDist(side, ret.x, ret.y) / 6, 0, 1) * 0.25, 0.2, 0.95);
        return clamp(first * back, 0.05, 0.92);
      }
      case 'cross':
      case 'fk-cross':
      case 'corner-near':
      case 'corner-far':
        return target ? this.crossChance(a, target) : null;
      case 'shoot':
        return this.shotProbs(a, this.shotModeFor(a), undefined).xg;
      case 'finesse':
        return this.shotProbs(a, this.shotModeFor(a), { kind: 'finesse' }).xg;
      case 'power':
        return this.shotProbs(a, this.shotModeFor(a), { kind: 'power' }).xg;
      case 'longshot':
        return this.shotProbs(a, 'long', undefined).xg;
      case 'chip':
        return this.shotProbs(a, 'open', { kind: 'chip' }).xg;
      case 'roundkeeper': {
        const keeper = this.gk(this.opp(side));
        return this.roundChance(a, keeper) * 0.9;
      }
      case 'pen-left':
      case 'pen-right':
      case 'pen-center':
      case 'panenka': {
        const m = this.penaltyModel(a, o.kind);
        return m.onTarget * (m.guessSame * m.goalIfGuessed + (1 - m.guessSame) * 0.97);
      }
      case 'fk-shot':
        return this.shotProbs(a, 'freekick', o.trait ? { kind: 'finesse' } : undefined).xg;
      case 'fk-power':
        return this.shotProbs(a, 'freekick', { kind: 'power' }).xg;
      case 'wingrun': {
        const near = this.team(this.opp(side))
          .filter((x) => !x.isGK)
          .sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y))[0];
        const pace = near ? this.att(near, 'pace') : 70;
        const pt = this.wingPoint(a);
        const space = clamp(this.nearestOpponentDist(side, (a.x + pt.x) / 2, (a.y + pt.y) / 2) / 8, 0, 1);
        return clamp(0.36 + ((this.att(a, 'pace') - pace) / 100) * 0.9 + (this.att(a, 'dribbling') - 75) / 220 + space * 0.22, 0.15, 0.9);
      }
      case 'cutback':
        return target ? this.passChance(a, target.x, target.y, 'short') : null;
      case 'earlycross':
        return target ? clamp(this.crossChance(a, target) - 0.06, 0.08, 0.8) : null;
      case 'header':
        return this.shotProbs(a, 'header').xg;
      case 'header-down':
        return this.shotProbs(a, 'header', { kind: 'placed' }).xg;
      case 'volley':
        return this.shotProbs(a, 'open', { kind: 'volley' }).xg;
      case 'knockdown':
        return target ? clamp(this.passChance(a, target.x, target.y, 'short') - 0.1, 0.1, 0.85) : null;
      case 'tackle':
        return rival ? this.tackleChance(a, rival) : null;
      case 'slide':
        return rival ? clamp(this.tackleChance(a, rival) + 0.13 + (this.att(a, 'physical') - 70) / 300, 0.15, 0.9) : null;
      case 'jockey':
        return rival
          ? clamp(0.58 + ((this.att(a, 'defending') - this.att(rival, 'dribbling')) / 100) * 0.5 + ((this.att(a, 'pace') - this.att(rival, 'pace')) / 100) * 0.2, 0.25, 0.92)
          : null;
      case 'tacticalfoul':
        return 0.96;
      case 'gk-rush': {
        if (!rival) return null;
        const gk = this.att(a, 'goalkeeping') * 0.6 + this.att(a, 'pace') * 0.4;
        const dist = Math.hypot(rival.x - a.x, rival.y - a.y);
        return clamp(0.32 + ((gk - this.att(rival, 'dribbling')) / 100) * 0.6 + clamp((dist - 6) / 20, 0, 0.18), 0.12, 0.8);
      }
      case 'gk-stay':
        return rival ? 1 - this.shotProbs(rival, 'open', { gkBonus: 10 }).xg : null;
    }
  }

  private shotModeFor(a: Agent): ShotMode {
    const d = Math.hypot(this.goalX(a.side) - a.x, W / 2 - a.y);
    return d >= 21 ? 'long' : 'open';
  }

  private roundChance(a: Agent, keeper: Agent) {
    return clamp(0.38 + (this.att(a, 'dribbling') - this.att(keeper, 'goalkeeping') * 0.85) / 100 + (this.att(a, 'pace') - 70) / 300, 0.2, 0.78);
  }

  /** Punto hacia el que conduce el jugador (portería si está cerca, adelante si no). */
  private carryPoint(a: Agent) {
    const gx = this.goalX(a.side);
    const depth = this.depthOf(a.side, a.x);
    const dir = a.side === 'home' ? 1 : -1;
    if (depth > 72) {
      const d = Math.hypot(gx - a.x, W / 2 - a.y) || 1;
      return { x: clamp(a.x + ((gx - a.x) / d) * 8, 1, L - 1), y: clamp(a.y + ((W / 2 - a.y) / d) * 8, 1.5, W - 1.5) };
    }
    return { x: clamp(a.x + dir * 9, 1, L - 1), y: clamp(a.y + (W / 2 - a.y) * 0.12, 1.5, W - 1.5) };
  }

  /** Punto de destino de un pase al hueco: por delante del receptor, hacia la portería. */
  private leadPoint(from: Agent, r: Agent) {
    const side = from.side;
    const sp = Math.hypot(r.vx, r.vy);
    const dir = side === 'home' ? 1 : -1;
    let tx: number, ty: number;
    if (r.runLeft > 0.3 && sp > 1) {
      const lead = 5 + r.attrs.pace / 20;
      tx = r.x + (r.vx / sp) * lead;
      ty = r.y + (r.vy / sp) * lead;
    } else {
      tx = r.x + dir * (6 + r.attrs.pace / 25);
      ty = r.y + (W / 2 - r.y) * 0.18;
    }
    return { x: clamp(tx, 2, L - 2), y: clamp(ty, 2, W - 2) };
  }

  /** Línea de fondo a la que llega un desborde por la banda. */
  private wingPoint(a: Agent) {
    const left = this.latOf(a.side, a.y) < W / 2;
    const lat = left ? 4 : W - 4;
    return { x: this.fx(a.side, L - 6), y: this.fy(a.side, lat) };
  }

  /** Hueco al que corre el jugador tras una pared. */
  private runPoint(a: Agent) {
    const dir = a.side === 'home' ? 1 : -1;
    return { x: clamp(a.x + dir * 11, 2, L - 2), y: clamp(a.y + (W / 2 - a.y) * 0.15, 2, W - 2) };
  }

  /** Punto que dibuja cada opción en el campo. */
  private optionPoint(o: OptionSpec, a: Agent): { x: number; y: number } | undefined {
    const t = o.targetId ? this.byId.get(o.targetId) : undefined;
    const gx = this.goalX(a.side);
    switch (o.kind) {
      case 'through':
        return t ? this.leadPoint(a, t) : o.point;
      case 'carry':
        return this.carryPoint(a);
      case 'shield':
        return { x: a.x, y: a.y };
      case 'onetwo':
        return t ? { x: t.x, y: t.y } : o.point;
      case 'wingrun':
        return this.wingPoint(a);
      case 'header':
      case 'header-down':
      case 'volley':
        return { x: gx, y: o.point?.y ?? W / 2 };
      case 'shoot':
      case 'finesse':
      case 'power':
      case 'longshot':
      case 'chip':
      case 'fk-shot':
      case 'fk-power':
        return o.point ?? { x: gx, y: W / 2 };
      case 'pen-left':
      case 'pen-right':
      case 'pen-center':
      case 'panenka':
        return o.point;
      case 'roundkeeper':
      case 'gk-rush':
      case 'gk-stay':
      case 'dribble':
      case 'skill':
      case 'tackle':
      case 'slide':
      case 'jockey':
      case 'tacticalfoul':
        return t ? { x: t.x, y: t.y } : o.point;
      default:
        return t ? { x: clamp(t.x + t.vx * 0.5, 1, L - 1), y: clamp(t.y + t.vy * 0.5, 1, W - 1) } : o.point;
    }
  }

  private stat(a: Agent, key: keyof MatchAttributes) {
    return Math.round(this.att(a, key));
  }

  /** Umbral de atributo para acciones especiales (los Iconos lo tienen más fácil). */
  private has(a: Agent, key: keyof MatchAttributes, min: number) {
    return a.attrs[key] >= min - (a.icon ? 4 : 0);
  }
  private traitLabel(a: Agent, name: string, key: keyof MatchAttributes, abbr: string) {
    return `${a.icon ? 'Icono · ' : ''}${name} (${abbr} ${this.stat(a, key)})`;
  }

  private attackOptions(a: Agent): OptionSpec[] {
    const side = a.side;
    const def = this.opp(side);
    const out: (OptionSpec | null)[] = [];
    const gx = this.goalX(side);
    const dGoal = Math.hypot(gx - a.x, W / 2 - a.y);
    const myDepth = this.depthOf(side, a.x);
    const myLat = this.latOf(side, a.y);
    const angle = clamp(1 - (Math.abs(a.y - W / 2) - 4) / 26, 0.15, 1);
    const opps = this.team(def);
    const mates = this.team(side).filter((r) => r !== a && !r.isGK && r.stunned <= 0);
    const lastLine = this.lastLine(side);

    // ── Con el balón en los pies
    const front = opps
      .filter((o) => !o.isGK && o.stunned <= 0)
      .map((o) => ({ o, d: Math.hypot(o.x - a.x, o.y - a.y) }))
      .filter((e) => e.d < 5.5 && this.depthOf(side, e.o.x) > myDepth - 1)
      .sort((p, q) => p.d - q.d)[0];
    if (front) {
      out.push(this.spec(a, 'dribble', `Regatear a ${front.o.name}`, `REG ${this.stat(a, 'dribbling')} vs DEF ${this.stat(front.o, 'defending')}`, { targetId: front.o.id }));
      if (this.has(a, 'dribbling', 86)) {
        const move = SKILL_MOVES[(a.number + Math.floor(this.time)) % SKILL_MOVES.length];
        out.push(
          this.spec(a, 'skill', `${move} ante ${front.o.name}`, `Filigrana · REG ${this.stat(a, 'dribbling')} vs DEF ${this.stat(front.o, 'defending')}`, {
            targetId: front.o.id,
            move,
            trait: this.traitLabel(a, 'Regateador', 'dribbling', 'REG'),
          }),
        );
      }
      if (front.d < 3.6 && this.has(a, 'physical', 72)) {
        out.push(this.spec(a, 'shield', 'Aguantar y esperar apoyo', `FÍS ${this.stat(a, 'physical')} · llegan compañeros`, {}));
      }
    }
    const cp = this.carryPoint(a);
    if (this.nearestOpponentDist(side, cp.x, cp.y) > 4 && dGoal > 12) {
      out.push(this.spec(a, 'carry', myDepth > 72 ? 'Conducir hacia el área' : 'Avanzar con el balón', `RIT ${this.stat(a, 'pace')} · REG ${this.stat(a, 'dribbling')}`, { point: cp }));
    }

    // ── Disparos
    const sho = this.stat(a, 'shooting');
    if (dGoal < 26 && angle > 0.3) {
      out.push(this.spec(a, 'shoot', 'Disparar a puerta', `TIR ${sho} · ${Math.round(dGoal)} m`, { point: { x: gx, y: W / 2 } }));
      if (this.has(a, 'shooting', 84)) {
        const far = a.y < W / 2 ? W / 2 + GOAL_HALF - 0.6 : W / 2 - GOAL_HALF + 0.6;
        out.push(
          this.spec(a, 'finesse', 'Disparo colocado al palo largo', `TIR ${sho} · PAS ${this.stat(a, 'passing')}`, {
            point: { x: gx, y: far },
            trait: this.traitLabel(a, 'Rematador', 'shooting', 'TIR'),
          }),
        );
      }
    }
    if (dGoal >= 20 && dGoal < 36 && angle > 0.35 && this.has(a, 'shooting', 72)) {
      out.push(this.spec(a, 'longshot', `Disparo lejano (${Math.round(dGoal)} m)`, `TIR ${sho}`, { point: { x: gx, y: W / 2 }, bonus: -0.05 }));
    }
    if (dGoal >= 15 && dGoal < 32 && angle > 0.3 && this.has(a, 'shooting', 80) && this.has(a, 'physical', 74)) {
      out.push(
        this.spec(a, 'power', 'Trallazo con potencia', `TIR ${sho} · FÍS ${this.stat(a, 'physical')}`, {
          point: { x: gx, y: W / 2 + (a.y < W / 2 ? -1.5 : 1.5) },
          trait: this.traitLabel(a, 'Cañonero', 'shooting', 'TIR'),
        }),
      );
    }

    // ── Pases
    const pas = this.stat(a, 'passing');
    const scored = mates.map((r) => {
      const d = Math.hypot(r.x - a.x, r.y - a.y);
      const rd = this.depthOf(side, r.x);
      return { r, d, rd, p: this.passChance(a, r.x, r.y, d > 30 ? 'long' : 'short') };
    });
    const safe = scored
      .filter((e) => e.d >= 5 && e.d <= 30)
      .sort((p, q) => q.p * (1 + (q.rd - myDepth) / 60) - p.p * (1 + (p.rd - myDepth) / 60))[0];
    if (safe) out.push(this.spec(a, 'pass', `Pasar a ${safe.r.name}`, `PAS ${pas} · ${Math.round(safe.d)} m`, { targetId: safe.r.id }));

    const runners = scored
      .filter((e) => e.r.line !== 'defence' && e.rd >= myDepth - 3 && e.d < 45)
      .map((e) => {
        const pt = this.leadPoint(a, e.r);
        const behind = this.depthOf(side, pt.x) >= lastLine - 1;
        return { ...e, pt, behind, p: this.passChance(a, pt.x, pt.y, 'through') };
      })
      .filter((e) => this.depthOf(side, e.pt.x) > myDepth + 5)
      .sort((p, q) => q.p * (q.behind ? 1.5 : 1) * (1 + q.r.runLeft) - p.p * (p.behind ? 1.5 : 1) * (1 + p.r.runLeft))[0];
    if (runners) {
      const master = this.has(a, 'passing', 88);
      out.push(
        this.spec(a, 'through', master ? `Pase filtrado magistral a ${runners.r.name}` : `Filtrar un pase a ${runners.r.name}`, `PAS ${pas} · ${runners.behind ? 'a la espalda de la defensa' : 'al espacio'}`, {
          targetId: runners.r.id,
          trait: master ? this.traitLabel(a, 'Visión de juego', 'passing', 'PAS') : undefined,
          reward: runners.behind ? 'high' : 'medium',
        }),
      );
    }

    const wall = scored
      .filter((e) => e.d >= 5 && e.d <= 15 && e.p > 0.6)
      .sort((p, q) => q.p - p.p)[0];
    const rp = this.runPoint(a);
    if (wall && myDepth < L - 12 && this.nearestOpponentDist(side, rp.x, rp.y) > 2.5) {
      out.push(this.spec(a, 'onetwo', `Pared con ${wall.r.name}`, `PAS ${pas} · RIT ${this.stat(a, 'pace')}`, { targetId: wall.r.id }));
    }

    if (this.has(a, 'passing', 76)) {
      const sw = scored
        .filter((e) => Math.abs(this.latOf(side, e.r.y) - myLat) > 24 && e.d > 24 && e.d < 58 && e.rd > myDepth - 12)
        .sort((p, q) => q.p - p.p)[0];
      if (sw) out.push(this.spec(a, 'switch', `Cambio de orientación a ${sw.r.name}`, `PAS ${pas} · ${Math.round(sw.d)} m en largo`, { targetId: sw.r.id }));
    }
    if (myDepth < 70) {
      const lb = scored.filter((e) => e.r.line === 'attack' && e.rd - myDepth > 22 && e.d < 60).sort((p, q) => q.p - p.p)[0];
      if (lb) out.push(this.spec(a, 'longball', `Balón largo a ${lb.r.name}`, `PAS ${pas} · ${Math.round(lb.d)} m`, { targetId: lb.r.id }));
    }
    const wide = myLat < 16 || myLat > W - 16;
    // Desborde por la banda hasta la línea de fondo y centro.
    if ((myLat < 21 || myLat > W - 21) && myDepth > 46 && myDepth < L - 16) {
      const wp = this.wingPoint(a);
      if (this.nearestOpponentDist(side, (a.x + wp.x) / 2, (a.y + wp.y) / 2) > 3) {
        out.push(
          this.spec(a, 'wingrun', 'Desborde por la banda y centro', `RIT ${this.stat(a, 'pace')} · REG ${this.stat(a, 'dribbling')} · luego centro al área`, {
            point: wp,
            bonus: 0.12,
            reward: 'high',
          }),
        );
      }
    }
    // Centro tenso desde tres cuartos, sin llegar a la línea de fondo.
    if (wide && myDepth > 60 && myDepth <= 72) {
      const t = this.bestAerialTarget(a);
      if (t) out.push(this.spec(a, 'earlycross', `Centro tenso para ${t.agent.name}`, `PAS ${pas} · balón rápido al área`, { targetId: t.agent.id }));
    }
    // Pase atrás desde la línea de fondo al que llega al punto de penalti.
    if (myDepth > L - 14 && Math.abs(myLat - W / 2) > 8) {
      const cb = mates
        .filter((m) => this.depthOf(side, m.x) > L - 22 && this.depthOf(side, m.x) < L - 7 && Math.abs(this.latOf(side, m.y) - W / 2) < 11)
        .sort((p, q) => this.nearestOpponentDist(side, q.x, q.y) - this.nearestOpponentDist(side, p.x, p.y))[0];
      if (cb) out.push(this.spec(a, 'cutback', `Pase atrás para ${cb.name}`, `PAS ${pas} · remate de ${cb.name} (TIR ${this.stat(cb, 'shooting')})`, { targetId: cb.id, reward: 'high', bonus: 0.15 }));
    }
    if (wide && myDepth > 72) {
      const t = this.bestAerialTarget(a);
      if (t) {
        out.push(
          this.spec(a, 'cross', `Centro al área buscando a ${t.agent.name}`, `PAS ${pas} · remate de ${t.agent.name} (FÍS ${this.stat(t.agent, 'physical')})`, {
            targetId: t.agent.id,
            bonus: 0.1,
          }),
        );
      }
    }
    return out.filter((o): o is OptionSpec => !!o);
  }

  private oneOnOneOptions(a: Agent): OptionSpec[] {
    const side = a.side;
    const keeper = this.gk(this.opp(side));
    const gx = this.goalX(side);
    const out: (OptionSpec | null)[] = [];
    const sho = this.stat(a, 'shooting');
    const gkStat = this.stat(keeper, 'goalkeeping');
    out.push(this.spec(a, 'shoot', `Definir ante ${keeper.name}`, `TIR ${sho} vs POR ${gkStat}`, { point: { x: gx, y: keeper.y < W / 2 ? W / 2 + 2.6 : W / 2 - 2.6 } }));
    out.push(this.spec(a, 'roundkeeper', `Regatear a ${keeper.name}`, `REG ${this.stat(a, 'dribbling')} vs POR ${gkStat}`, { targetId: keeper.id }));
    if (this.has(a, 'shooting', 80) || this.has(a, 'dribbling', 85)) {
      out.push(this.spec(a, 'chip', 'Picarla por encima del portero', `TIR ${sho} · portero adelantado`, { point: { x: gx, y: W / 2 }, trait: this.traitLabel(a, 'Sangre fría', 'shooting', 'TIR') }));
    }
    const myDepth = this.depthOf(side, a.x);
    const mate = this.team(side)
      .filter((r) => r !== a && !r.isGK && this.depthOf(side, r.x) > myDepth - 6 && Math.hypot(r.x - a.x, r.y - a.y) < 22 && this.nearestOpponentDist(side, r.x, r.y) > 3)
      .sort((p, q) => this.passChance(a, q.x, q.y, 'short') - this.passChance(a, p.x, p.y, 'short'))[0];
    if (mate) out.push(this.spec(a, 'pass', `Pase de la muerte a ${mate.name}`, `PAS ${this.stat(a, 'passing')} · gol casi seguro si llega`, { targetId: mate.id, reward: 'high' }));
    return out.filter((o): o is OptionSpec => !!o);
  }

  private setPieceOptions(r: Restart, taker: Agent): OptionSpec[] {
    const side = r.side;
    const gx = this.goalX(side);
    const out: (OptionSpec | null)[] = [];
    const sho = this.stat(taker, 'shooting');
    const keeper = this.gk(this.opp(side));
    const leftY = W / 2 + (side === 'home' ? -1 : 1) * 2.7;
    const rightY = W / 2 + (side === 'home' ? 1 : -1) * 2.7;
    if (r.kind === 'penalty') {
      const vs = `TIR ${sho} vs POR ${this.stat(keeper, 'goalkeeping')}`;
      out.push(this.spec(taker, 'pen-left', 'Colocado a la izquierda', `${vs} · preciso`, { point: { x: gx, y: leftY } }));
      out.push(this.spec(taker, 'pen-right', 'Fuerte a la derecha', `${vs} · potente`, { point: { x: gx, y: rightY } }));
      out.push(this.spec(taker, 'pen-center', 'Fuerte al centro', `${vs} · si el portero se lanza`, { point: { x: gx, y: W / 2 } }));
      if (this.has(taker, 'shooting', 85)) {
        out.push(this.spec(taker, 'panenka', 'Lanzamiento a lo Panenka', 'Picado al centro · todo o nada', { point: { x: gx, y: W / 2 }, trait: this.traitLabel(taker, 'Sangre fría', 'shooting', 'TIR') }));
      }
      return out.filter((o): o is OptionSpec => !!o);
    }
    const inBox = this.team(side).filter((m) => m !== taker && !m.isGK && this.inBoxOf(this.opp(side), m.targetX, m.targetY));
    if (r.kind === 'freekick') {
      const dGoal = Math.round(Math.hypot(gx - r.x, W / 2 - r.y));
      const curl = this.has(taker, 'passing', 84) && this.has(taker, 'shooting', 82);
      out.push(
        this.spec(taker, 'fk-shot', curl ? 'Disparo con rosca a la escuadra' : 'Disparo directo', `TIR ${sho} · PAS ${this.stat(taker, 'passing')} · ${dGoal} m`, {
          point: { x: gx, y: W / 2 + (r.y < W / 2 ? 2.8 : -2.8) },
          trait: curl ? this.traitLabel(taker, 'Especialista', 'passing', 'PAS') : undefined,
        }),
      );
      if (this.has(taker, 'shooting', 82) && this.has(taker, 'physical', 75)) {
        out.push(this.spec(taker, 'fk-power', 'Disparo potente por encima de la barrera', `TIR ${sho} · FÍS ${this.stat(taker, 'physical')}`, { point: { x: gx, y: W / 2 }, trait: this.traitLabel(taker, 'Cañonero', 'shooting', 'TIR') }));
      }
      const aerial = [...inBox].sort((p, q) => q.attrs.physical + q.attrs.shooting - (p.attrs.physical + p.attrs.shooting))[0];
      if (aerial) out.push(this.spec(taker, 'fk-cross', `Colgarla al área para ${aerial.name}`, `PAS ${this.stat(taker, 'passing')} · FÍS ${this.stat(aerial, 'physical')}`, { targetId: aerial.id }));
      const short = this.team(side)
        .filter((m) => m !== taker && !m.isGK && Math.hypot(m.x - r.x, m.y - r.y) < 16)
        .sort((p, q) => q.attrs.shooting - p.attrs.shooting)[0];
      if (short) out.push(this.spec(taker, 'fk-short', `Jugada ensayada con ${short.name}`, `Toque corto para el disparo de ${short.name} (TIR ${this.stat(short, 'shooting')})`, { targetId: short.id }));
      return out.filter((o): o is OptionSpec => !!o);
    }
    // Córner: primer palo, segundo palo o al borde del área.
    const nearY = r.y < W / 2 ? W / 2 - 3 : W / 2 + 3;
    const farY = r.y < W / 2 ? W / 2 + 4 : W / 2 - 4;
    const pickNear = (y: number) =>
      [...inBox].sort((p, q) => Math.abs(p.targetY - y) - Math.abs(q.targetY - y) || q.attrs.physical - p.attrs.physical)[0];
    const near = pickNear(nearY);
    const far = inBox.filter((m) => m !== near).sort((p, q) => Math.abs(p.targetY - farY) - Math.abs(q.targetY - farY))[0];
    if (near) out.push(this.spec(taker, 'corner-near', `Al primer palo para ${near.name}`, `PAS ${this.stat(taker, 'passing')} · FÍS ${this.stat(near, 'physical')}`, { targetId: near.id }));
    if (far) out.push(this.spec(taker, 'corner-far', `Al segundo palo para ${far.name}`, `PAS ${this.stat(taker, 'passing')} · FÍS ${this.stat(far, 'physical')}`, { targetId: far.id }));
    const edge = this.team(side)
      .filter((m) => m !== taker && !m.isGK && !inBox.includes(m))
      .sort((p, q) => q.attrs.shooting - p.attrs.shooting)[0];
    if (edge) {
      // El elegido se coloca en la frontal para el disparo.
      edge.targetX = this.fx(side, L - 20);
      edge.targetY = W / 2 + (r.y < W / 2 ? -4 : 4);
      out.push(this.spec(taker, 'corner-edge', `Atrás, al borde del área, para ${edge.name}`, `Disparo de ${edge.name} (TIR ${this.stat(edge, 'shooting')})`, { targetId: edge.id, point: { x: edge.targetX, y: edge.targetY } }));
    }
    return out.filter((o): o is OptionSpec => !!o);
  }

  private defenseOptions(d: Agent, rival: Agent): OptionSpec[] {
    const out: (OptionSpec | null)[] = [];
    const vs = `DEF ${this.stat(d, 'defending')} vs REG ${this.stat(rival, 'dribbling')}`;
    const inBox = this.inBoxOf(d.side, rival.x, rival.y);
    out.push(this.spec(d, 'tackle', `Entrada al balón de ${d.name}`, vs, { targetId: rival.id }, rival));
    out.push(this.spec(d, 'jockey', 'Temporizar y cerrar el paso', `${vs} · RIT ${this.stat(d, 'pace')}`, { targetId: rival.id }, rival));
    out.push(
      this.spec(d, 'slide', 'Entrada en plancha', `FÍS ${this.stat(d, 'physical')} · ${inBox ? '¡riesgo de penalti!' : 'riesgo de falta'}`, { targetId: rival.id, risk: inBox ? 'high' : 'medium', reward: 'high' }, rival),
    );
    if (!inBox && !d.booked && this.depthOf(rival.side, rival.x) < L - 22) {
      out.push(this.spec(d, 'tacticalfoul', 'Falta táctica', 'Corta la jugada · casi seguro amarilla', { targetId: rival.id, risk: 'medium', reward: 'medium', bonus: -0.25 }, rival));
    }
    return out.filter((o): o is OptionSpec => !!o);
  }

  private keeperOptions(gk: Agent, rival: Agent): OptionSpec[] {
    const vs = `POR ${this.stat(gk, 'goalkeeping')} vs REG ${this.stat(rival, 'dribbling')}`;
    return [
      this.spec(gk, 'gk-rush', 'Salir a los pies', `${vs} · RIT ${this.stat(gk, 'pace')}`, { targetId: rival.id }, rival),
      this.spec(gk, 'gk-stay', 'Aguantar bajo palos', `REF ${this.stat(gk, 'reflexes')} vs TIR ${this.stat(rival, 'shooting')}`, { targetId: rival.id, reward: 'medium' }, rival),
    ].filter((o): o is OptionSpec => !!o);
  }

  /** Modelo del penalti elegido: dirección, acierto y adivinanza del portero. */
  private penaltyModel(a: Agent, kind: DecisionKind) {
    const keeper = this.gk(this.opp(a.side));
    const edge = (this.att(a, 'shooting') - (this.att(keeper, 'goalkeeping') * 0.6 + this.att(keeper, 'reflexes') * 0.4)) / 250;
    const sho = this.att(a, 'shooting');
    switch (kind) {
      case 'pen-left':
        return { onTarget: clamp(0.88 + (sho - 80) / 400, 0.8, 0.96), guessSame: 0.375, goalIfGuessed: clamp(0.42 + edge, 0.25, 0.6) };
      case 'pen-right':
        return { onTarget: clamp(0.83 + (sho - 80) / 300, 0.74, 0.93), guessSame: 0.375, goalIfGuessed: clamp(0.6 + edge, 0.4, 0.78) };
      case 'pen-center':
        return { onTarget: 0.97, guessSame: 0.25, goalIfGuessed: 0.08 };
      default:
        return { onTarget: clamp(0.9 + (sho - 85) / 200, 0.85, 0.97), guessSame: 0.25, goalIfGuessed: 0.04 };
    }
  }

  private makeCtx(pr: DecisionPrompt, o: OptionSpec): DecisionCtx {
    const ctx: DecisionCtx = {
      promptId: pr.id,
      kind: o.kind,
      label: o.label,
      side: pr.side,
      defensive: pr.context === 'defense' || pr.context === 'keeper',
      chain: pr.chain,
      ownerId: pr.playerId,
    };
    this.decisionCtx.set(pr.id, ctx);
    this.stats[pr.side].decisions++;
    return ctx;
  }

  private result(ctx: DecisionCtx, grade: DecisionGrade, title: string, detail: string, playerId?: string) {
    this.decisionCtx.delete(ctx.promptId);
    if (ctx.kind === 'onetwo') this.oneTwo = null;
    if (grade === 'great' || grade === 'good') this.stats[ctx.side].decisionsWon++;
    const e = this.emit('decision', ctx.side, `${title}: ${detail}`, true, playerId ?? ctx.ownerId);
    e.decision = { promptId: ctx.promptId, kind: ctx.kind, label: ctx.label, grade, title, detail };
  }

  /** Impulso: el jugador que continúa una jugada acertada llega en ventaja. */
  private boost(a: Agent, ctx: DecisionCtx, extra: number) {
    if (ctx.defensive || a.side !== ctx.side) return;
    a.momentum = clamp(Math.max(this.mom(a), ctx.chain + extra), 1, 3);
    a.momentumUntil = this.time + MOMENTUM_TIME;
    a.protectedUntil = Math.max(a.protectedUntil, this.time + 1.2);
    // Los rivales cercanos tardan en reaccionar.
    for (const o of this.team(this.opp(a.side))) {
      if (!o.isGK && Math.hypot(o.x - a.x, o.y - a.y) < 4) o.tackleTimer = Math.max(o.tackleTimer, 0.8);
    }
  }

  /** La jugada continúa: el siguiente poseedor puede recibir otra decisión. */
  private continueChain(ctx: DecisionCtx, playerId: string, extra = 0) {
    if (ctx.defensive || ctx.chain + 1 > MAX_CHAIN) return;
    this.chain = { playerId, until: this.time + extra + CHAIN_WINDOW, level: ctx.chain + 1 };
  }

  private executeDecision(pr: ActivePrompt, o: OptionSpec) {
    const ctx = this.makeCtx(pr, o);
    const a = this.byId.get(pr.playerId)!;
    const t = o.targetId ? this.byId.get(o.targetId) : undefined;
    const side = a.side;
    const p = o.chance;
    a.mustPass = false;
    if (pr.context === 'setpiece') {
      const r = this.restart;
      if (r) {
        a.x = r.x;
        a.y = r.y;
      }
      a.vx = a.vy = 0;
      this.restart = null;
      this.phase = 'play';
    }
    switch (o.kind) {
      case 'dribble':
      case 'skill': {
        if (!t) break;
        const roll = this.rng.next();
        t.tackleTimer = 0.9;
        if (roll < p) {
          const skill = o.kind === 'skill';
          t.stunned = skill ? 1.9 : 1.3;
          this.registerBeaten(a, t);
          const gx = this.goalX(side);
          const dGoal = Math.hypot(gx - a.x, W / 2 - a.y) || 1;
          const burst = skill ? 9 : 7;
          a.dribbleX = clamp(a.x + ((gx - a.x) / dGoal) * burst, 1, L - 1);
          a.dribbleY = clamp(a.y + ((W / 2 - a.y) / dGoal) * 4 + (a.y < t.y ? -1.5 : 1.5), 1.5, W - 1.5);
          a.targetX = a.dribbleX;
          a.targetY = a.dribbleY;
          a.urgent = true;
          a.decisionTimer = 0.55;
          a.carryTime = 0;
          this.boost(a, ctx, skill ? 2 : 1);
          a.protectedUntil = this.time + (skill ? 1.2 : 0.9);
          if (skill) this.highlight('skillrun', side, `¡${(o.move ?? 'Filigrana').toUpperCase()}!`, `${a.name} deja sentado a ${t.name}`, a.id, t.id);
          this.result(ctx, skill ? 'great' : 'good', skill ? `¡${(o.move ?? 'Filigrana').toUpperCase()}!` : '¡REGATE CONSEGUIDO!', `${a.name} se va de ${t.name}`, a.id);
          this.continueChain(ctx, a.id, 0.5);
        } else if (roll < p + (1 - p) * 0.22) {
          const pen = this.inBoxOf(t.side, a.x, a.y);
          this.result(ctx, pen ? 'great' : 'partial', pen ? '¡PENALTI PROVOCADO!' : 'FALTA RECIBIDA', `${t.name} derriba a ${a.name}`, a.id);
          this.foul(t, a);
        } else {
          a.stunned = 0.7;
          this.giveBall(t, true);
          this.stats[t.side].tackles++;
          this.emit('tackle', t.side, `${t.name} frena a ${a.name}`, false, t.id, a.id);
          this.result(ctx, 'fail', 'PIERDE EL BALÓN', `${t.name} gana el duelo a ${a.name}`, a.id);
        }
        return;
      }
      case 'carry':
      case 'shield': {
        const shield = o.kind === 'shield';
        const pt = shield ? { x: a.x - (side === 'home' ? 1 : -1) * 1.2, y: a.y } : this.carryPoint(a);
        const hold = shield ? 1.2 : 0.95;
        a.dribbleX = pt.x;
        a.dribbleY = pt.y;
        a.targetX = pt.x;
        a.targetY = pt.y;
        a.urgent = !shield;
        a.decisionTimer = hold;
        a.carryTime = 0;
        if (this.rng.chance(p)) {
          this.boost(a, ctx, 1);
          a.protectedUntil = this.time + hold;
          if (shield) {
            // Los compañeros llegan en apoyo: dos desmarques.
            this.team(side)
              .filter((m) => m !== a && !m.isGK && m.line !== 'defence')
              .sort((m1, m2) => Math.hypot(m1.x - a.x, m1.y - a.y) - Math.hypot(m2.x - a.x, m2.y - a.y))
              .slice(0, 2)
              .forEach((m) => (m.runLeft = 2.6));
          }
          this.result(ctx, 'good', shield ? 'LA AGUANTA' : 'AVANZA CON PELIGRO', shield ? `${a.name} protege el balón y llegan apoyos` : `${a.name} gana metros con el balón`, a.id);
          this.continueChain(ctx, a.id, hold);
        } else {
          const thief = this.team(this.opp(side))
            .filter((x) => !x.isGK && x.stunned <= 0)
            .sort((m1, m2) => Math.hypot(m1.x - a.x, m1.y - a.y) - Math.hypot(m2.x - a.x, m2.y - a.y))[0];
          if (thief) this.scripted = { ownerId: a.id, defId: thief.id, at: this.time + (shield ? 0.35 : 0.5), ctx };
          else this.result(ctx, 'good', 'AVANZA', `${a.name} sigue con el balón`, a.id);
        }
        return;
      }
      case 'pass':
      case 'longball':
      case 'switch':
      case 'fk-short':
      case 'corner-edge': {
        if (!t) break;
        const pt = o.kind === 'corner-edge' && o.point ? o.point : this.optionPoint(o, a)!;
        if (pr.context === 'setpiece') this.giveBall(a, false);
        const variant: PassVariant = o.kind === 'pass' || o.kind === 'fk-short' ? 'short' : 'long';
        this.pass(a, t, pt.x, pt.y, p, variant, ctx.promptId);
        return;
      }
      case 'through': {
        if (!t) break;
        const pt = this.leadPoint(a, t);
        t.runLeft = Math.max(t.runLeft, 3);
        this.pass(a, t, pt.x, pt.y, p, 'through', ctx.promptId);
        return;
      }
      case 'onetwo': {
        if (!t) break;
        ctx.stage = 1;
        this.oneTwo = { by: t.id, ctx };
        a.runLeft = 3;
        this.pass(a, t, t.x, t.y, this.passChance(a, t.x, t.y, 'short'), 'short', ctx.promptId);
        return;
      }
      case 'wingrun': {
        const pt = this.wingPoint(a);
        const dist = Math.hypot(pt.x - a.x, pt.y - a.y);
        const dur = clamp(dist / (6 + this.att(a, 'pace') / 25), 0.6, 2.6);
        a.dribbleX = pt.x;
        a.dribbleY = pt.y;
        a.targetX = pt.x;
        a.targetY = pt.y;
        a.urgent = true;
        a.decisionTimer = dur + 1;
        a.carryTime = 0;
        if (this.rng.chance(p)) {
          // Carrera a toda velocidad pegado a la banda y centro desde la línea de fondo.
          a.protectedUntil = this.time + dur + 0.2;
          a.momentum = Math.max(this.mom(a), 1);
          a.momentumUntil = this.time + dur + 2;
          this.highlight('skillrun', side, '¡DESBORDE!', `${a.name} se va por la banda`, a.id);
          this.later(dur, () => {
            if (this.ball.ownerId !== a.id) return;
            const target = this.bestAerialTarget(a, true);
            if (!target) {
              a.decisionTimer = 0;
              this.result(ctx, 'partial', 'SIN REMATADOR', `${a.name} llega a la línea de fondo pero no hay nadie en el área`, a.id);
              return;
            }
            ctx.kind = 'cross';
            this.pass(a, target.agent, target.x, target.y, target.p, 'cross', ctx.promptId);
          });
        } else {
          const thief = this.team(this.opp(side))
            .filter((x) => !x.isGK && x.stunned <= 0)
            .sort((m1, m2) => Math.hypot(m1.x - a.x, m1.y - a.y) - Math.hypot(m2.x - a.x, m2.y - a.y))[0];
          if (thief) this.scripted = { ownerId: a.id, defId: thief.id, at: this.time + dur * 0.55, ctx };
        }
        return;
      }
      case 'cutback': {
        if (!t) break;
        this.pass(a, t, t.x, t.y, p, 'short', ctx.promptId);
        return;
      }
      case 'earlycross': {
        if (!t) break;
        ctx.kind = 'cross';
        this.pass(a, t, t.x + t.vx * 0.6, t.y + t.vy * 0.6, p, 'cross', ctx.promptId);
        return;
      }
      case 'header':
      case 'header-down':
        this.shoot(a, 'header', { kind: o.kind === 'header-down' ? 'placed' : undefined, decisionId: ctx.promptId });
        return;
      case 'volley':
        this.shoot(a, 'open', { kind: 'volley', decisionId: ctx.promptId });
        return;
      case 'knockdown': {
        if (!t) break;
        this.pass(a, t, t.x, t.y, p, 'short', ctx.promptId);
        return;
      }
      case 'cross':
      case 'fk-cross':
      case 'corner-near':
      case 'corner-far': {
        if (!t) break;
        if (pr.context === 'setpiece') this.giveBall(a, false);
        this.pass(a, t, t.x + t.vx * 0.6, t.y + t.vy * 0.6, p, 'cross', ctx.promptId);
        return;
      }
      case 'shoot':
      case 'longshot':
        this.shoot(a, o.kind === 'longshot' ? 'long' : this.shotModeFor(a), { decisionId: ctx.promptId, aimY: o.point?.y !== W / 2 ? o.point?.y : undefined });
        return;
      case 'finesse':
      case 'power':
      case 'chip':
        this.shoot(a, o.kind === 'chip' ? 'open' : this.shotModeFor(a), { kind: o.kind, decisionId: ctx.promptId });
        return;
      case 'fk-shot':
      case 'fk-power':
        this.shoot(a, 'freekick', { kind: o.kind === 'fk-power' ? 'power' : o.trait ? 'finesse' : undefined, decisionId: ctx.promptId });
        return;
      case 'roundkeeper': {
        this.roundKeeper(a, this.gk(this.opp(side)), this.roundChance(a, this.gk(this.opp(side))), ctx);
        return;
      }
      case 'pen-left':
      case 'pen-right':
      case 'pen-center':
      case 'panenka': {
        const keeper = this.gk(this.opp(side));
        const m = this.penaltyModel(a, o.kind);
        const guessRoll = this.rng.next();
        const center = o.kind === 'pen-center' || o.kind === 'panenka';
        // Adivinanza del portero: izquierda, derecha o quedarse.
        const leftY = W / 2 + (side === 'home' ? -1 : 1) * 2.7;
        const rightY = W / 2 + (side === 'home' ? 1 : -1) * 2.7;
        const guess = guessRoll < 0.375 ? 'left' : guessRoll < 0.75 ? 'right' : 'center';
        const mine = o.kind === 'pen-left' ? 'left' : o.kind === 'pen-right' ? 'right' : 'center';
        const guessed = center ? guess === 'center' : guess === mine;
        let outcome: 'goal' | 'saved' | 'miss' | 'post';
        if (!this.rng.chance(m.onTarget)) outcome = this.rng.chance(0.3) ? 'post' : 'miss';
        else outcome = this.rng.chance(guessed ? m.goalIfGuessed : 0.97) ? 'goal' : 'saved';
        const gy = guess === 'left' ? leftY : guess === 'right' ? rightY : W / 2;
        if (guess !== 'center') this.diveTo(keeper, keeper.x, gy, 0.38, 0.9);
        const aimY = o.kind === 'pen-left' ? leftY - (side === 'home' ? 0.6 : -0.6) : o.kind === 'pen-right' ? rightY + (side === 'home' ? 0.6 : -0.6) : W / 2;
        this.shoot(a, 'penalty', { forced: outcome, aimY: outcome === 'saved' ? gy : aimY, decisionId: ctx.promptId, kind: o.kind === 'panenka' ? 'chip' : undefined });
        return;
      }
      case 'tackle':
      case 'slide': {
        const rival = this.byId.get(pr.rivalId!)!;
        const roll = this.rng.next();
        const foulBand = o.kind === 'slide' ? 0.45 : 0.12;
        if (roll < p) {
          rival.stunned = o.kind === 'slide' ? 1.1 : 0.7;
          a.x += (rival.x - a.x) * 0.6;
          a.y += (rival.y - a.y) * 0.6;
          this.giveBall(a, true);
          this.stats[a.side].tackles++;
          this.emit('tackle', a.side, `${o.kind === 'slide' ? 'Entrada en plancha' : 'Entrada'} de ${a.name} ante ${rival.name}`, true, a.id, rival.id);
          this.result(ctx, o.kind === 'slide' ? 'great' : 'good', '¡BALÓN RECUPERADO!', `${a.name} le quita el balón a ${rival.name}`, a.id);
        } else if (roll < p + (1 - p) * foulBand) {
          const pen = this.inBoxOf(a.side, rival.x, rival.y);
          this.result(ctx, 'fail', pen ? 'PENALTI EN CONTRA' : 'FALTA', `${a.name} derriba a ${rival.name}`, a.id);
          this.foul(a, rival, o.kind === 'slide' ? 0.45 : 0.2);
        } else {
          a.stunned = o.kind === 'slide' ? 1.7 : 1.1;
          this.registerBeaten(rival, a);
          rival.decisionTimer = 0.1;
          this.result(ctx, 'fail', 'TE SUPERA', `${rival.name} se va de ${a.name}`, a.id);
        }
        return;
      }
      case 'jockey': {
        const rival = this.byId.get(pr.rivalId!)!;
        if (this.rng.chance(p)) {
          rival.mustPass = true;
          rival.decisionTimer = 0.15;
          rival.carryTime = 3;
          a.tackleTimer = 0;
          a.x += (rival.x - a.x) * 0.4;
          a.y += (rival.y - a.y) * 0.4;
          this.result(ctx, 'good', 'LE CIERRA EL PASO', `${a.name} obliga a ${rival.name} a soltar el balón`, a.id);
        } else {
          a.stunned = 0.7;
          this.registerBeaten(rival, a);
          rival.decisionTimer = 0.1;
          this.result(ctx, 'fail', 'SE LE ESCAPA', `${rival.name} gana la espalda a ${a.name}`, a.id);
        }
        return;
      }
      case 'tacticalfoul': {
        const rival = this.byId.get(pr.rivalId!)!;
        this.result(ctx, 'partial', 'FALTA TÁCTICA', `${a.name} corta el ataque de ${rival.name}`, a.id);
        this.foul(a, rival, 0.75);
        return;
      }
      case 'gk-rush': {
        const rival = this.byId.get(pr.rivalId!)!;
        rival.decisionTimer = 5;
        rival.protectedUntil = this.time + 1;
        if (this.rng.chance(p)) {
          // El portero se lanza a los pies del delantero.
          this.diveTo(a, rival.x + (rival.side === 'home' ? 0.6 : -0.6), rival.y, 0.32, 0.3);
          this.later(0.32, () => {
            if (this.ball.ownerId !== rival.id) return;
            rival.stunned = 0.8;
            rival.protectedUntil = 0;
            this.giveBall(a, false);
            a.decisionTimer = 0.9;
            a.mustPass = true;
            this.highlight('bigsave', a.side, '¡SALIDA PERFECTA!', `${a.name} le roba el balón a ${rival.name}`, a.id, rival.id);
            this.result(ctx, 'great', '¡SALIDA PERFECTA!', `${a.name} se lanza a los pies de ${rival.name}`, a.id);
          });
        } else {
          // Sale en falso: el delantero lo rodea y marca a puerta vacía.
          const goSide = rival.y < a.y ? -1 : 1;
          const dir = rival.side === 'home' ? 1 : -1;
          this.diveTo(a, rival.x - dir * 0.3, rival.y - goSide * 0.8, 0.35, 2.4);
          rival.dribbleX = clamp(rival.x + dir * 3, 1, L - 1);
          rival.dribbleY = clamp(rival.y + goSide * 3, 1, W - 1);
          this.highlight('roundkeeper', rival.side, '¡REGATEA AL PORTERO!', `${rival.name} deja sentado a ${a.name}`, rival.id, a.id);
          this.result(ctx, 'fail', 'TE REGATEA', `${rival.name} supera la salida de ${a.name}`, a.id);
          this.later(0.6, () => {
            if (this.ball.ownerId === rival.id) this.shoot(rival, 'emptynet');
          });
        }
        return;
      }
      case 'gk-stay': {
        const rival = this.byId.get(pr.rivalId!)!;
        this.shoot(rival, 'open', { gkBonus: 10, decisionId: ctx.promptId });
        return;
      }
    }
    // Opción inválida (objetivo desaparecido): decide la IA.
    this.decisionCtx.delete(ctx.promptId);
    this.stats[pr.side].decisions--;
    if (pr.context === 'setpiece') {
      this.giveBall(a, false);
      a.decisionTimer = 0.3;
      a.mustPass = true;
    } else a.decisionTimer = 0;
  }

  /** Acciones con resultado diferido (robo tras una conducción fallida). */
  private runScripted() {
    const sc = this.scripted!;
    this.scripted = null;
    const owner = this.byId.get(sc.ownerId)!;
    const thief = this.byId.get(sc.defId)!;
    if (this.ball.ownerId !== owner.id || this.phase !== 'play') {
      this.decisionCtx.delete(sc.ctx.promptId);
      return;
    }
    const dir = owner.side === 'home' ? 1 : -1;
    thief.x = owner.x + dir * 0.9;
    thief.y = owner.y + (thief.y > owner.y ? 0.5 : -0.5);
    owner.stunned = 0.7;
    owner.protectedUntil = 0;
    this.giveBall(thief, true);
    this.stats[thief.side].tackles++;
    this.emit('tackle', thief.side, `${thief.name} roba a ${owner.name}`, false, thief.id, owner.id);
    this.result(sc.ctx, 'fail', 'LE CIERRAN EL PASO', `${thief.name} le roba el balón a ${owner.name}`, owner.id);
  }

  /** Evalúa el resultado de un pase o disparo nacido de una decisión. */
  private flightDecision(f: BallFlight, received: Agent | null): boolean {
    if (f.decisionId === undefined) return false;
    const ctx = this.decisionCtx.get(f.decisionId);
    if (!ctx) return false;
    const kicker = this.byId.get(f.kickerId)!;
    if (f.kind === 'shot') {
      const def = ctx.defensive;
      const keeper = this.gk(this.opp(kicker.side));
      switch (f.outcome) {
        case 'goal':
          if (def) this.result(ctx, 'fail', 'NO PUDO SER', `${kicker.name} bate a ${keeper.name}`, keeper.id);
          else this.result(ctx, 'great', f.variant === 'long' || ctx.kind === 'chip' || ctx.kind === 'panenka' ? '¡GOLAZO!' : '¡GOL!', `${kicker.name} acierta: ${ctx.label.toLowerCase()}`, kicker.id);
          return false;
        case 'saved':
          if (def) this.result(ctx, 'great', '¡PARADÓN!', `${keeper.name} aguanta y detiene el disparo`, keeper.id);
          else this.result(ctx, 'partial', 'LO PARA EL PORTERO', `${keeper.name} detiene el disparo de ${kicker.name}`, kicker.id);
          return false;
        case 'post':
          if (def) this.result(ctx, 'good', 'SALVADO POR EL PALO', `El disparo de ${kicker.name} se estrella en la madera`, keeper.id);
          else this.result(ctx, 'partial', 'AL PALO', `${kicker.name} roza el gol`, kicker.id);
          return false;
        default:
          if (def) this.result(ctx, 'good', 'AGUANTA BIEN', `${keeper.name} achica y ${kicker.name} falla`, keeper.id);
          else this.result(ctx, 'fail', 'DISPARO DESVIADO', `${kicker.name} no encuentra portería`, kicker.id);
          return false;
      }
    }
    // Pases
    if (f.outcome === 'complete' && received) {
      if (ctx.kind === 'onetwo' && ctx.stage === 1 && this.oneTwo && this.oneTwo.by === received.id) {
        // Devolución al hueco hacia el jugador que inició la pared.
        const back = this.byId.get(ctx.ownerId)!;
        this.oneTwo = null;
        ctx.stage = 2;
        const pt = this.leadPoint(received, back);
        back.runLeft = Math.max(back.runLeft, 1.5);
        this.pass(received, back, pt.x, pt.y, this.passChance(received, pt.x, pt.y, 'through'), 'through', ctx.promptId);
        return true;
      }
      const side = kicker.side;
      const behind = this.depthOf(side, received.x) >= this.lastLine(side) - 1 && this.depthOf(side, received.x) > 70;
      const titles: Partial<Record<DecisionKind, [DecisionGrade, string, string]>> = {
        pass: ['good', 'PASE COMPLETADO', `${received.name} recibe de ${kicker.name}`],
        through: behind
          ? ['great', '¡PASE AL HUECO PERFECTO!', `${received.name} queda a la espalda de la defensa`]
          : ['good', 'PASE AL ESPACIO', `${received.name} controla en carrera`],
        onetwo: ['great', '¡PARED PERFECTA!', `${received.name} y ${kicker.name} rompen la línea`],
        longball: ['good', 'BALÓN LARGO CONTROLADO', `${received.name} baja el balón`],
        switch: ['good', 'CAMBIO DE ORIENTACIÓN', `${received.name} recibe en el otro costado`],
        cross: ['good', 'CENTRO PRECISO', `${received.name} llega al remate`],
        'fk-cross': ['good', 'BALÓN AL ÁREA', `${received.name} remata`],
        'corner-near': ['good', 'CÓRNER BIEN BOTADO', `${received.name} cabecea en el primer palo`],
        'corner-far': ['good', 'CÓRNER BIEN BOTADO', `${received.name} cabecea en el segundo palo`],
        'corner-edge': ['good', 'JUGADA ENSAYADA', `${received.name} prepara el disparo`],
        cutback: ['great', '¡PASE ATRÁS PERFECTO!', `${received.name} recibe solo en el punto de penalti`],
        knockdown: ['good', 'LA DEJA DE CABEZA', `${received.name} recibe en el área`],
        'fk-short': ['good', 'JUGADA ENSAYADA', `${received.name} prepara el disparo`],
      };
      const [grade, title, detail] = titles[ctx.kind] ?? ['good', 'BIEN EJECUTADO', ctx.label];
      this.result(ctx, grade, title, detail, received.id);
      if (received.side === ctx.side && ctx.kind !== 'pass' && ctx.kind !== 'switch') this.boost(received, ctx, grade === 'great' ? 2 : 1);
      else if (received.side === ctx.side && this.depthOf(side, received.x) > 60) this.boost(received, ctx, 1);
      // Sólo se encadena si la jugada deja al receptor en situación de peligro.
      const rDepth = this.depthOf(side, received.x);
      const promising =
        ctx.kind === 'onetwo' ||
        ctx.kind === 'cutback' ||
        ctx.kind === 'knockdown' ||
        ctx.kind === 'fk-short' ||
        ctx.kind === 'corner-edge' ||
        (ctx.kind === 'through' && (behind || rDepth > 74)) ||
        rDepth > 76;
      if (received.side === ctx.side && promising) this.continueChain(ctx, received.id);
      return false;
    }
    if (f.outcome === 'intercepted' && received) {
      this.result(ctx, 'fail', 'PASE INTERCEPTADO', `${received.name} corta el pase de ${kicker.name}`, kicker.id);
      return false;
    }
    this.result(ctx, f.outcome === 'complete' ? 'partial' : 'fail', f.outcome === 'complete' ? 'NO LLEGA A CONTROLAR' : 'PASE IMPRECISO', `El balón de ${kicker.name} se pierde`, kicker.id);
    return false;
  }

  // ───────────────────────────── Física simple ─────────────────────────────

  private moveAgents(dt: number, speedScale: number) {
    for (const a of this.agents) {
      if (a.dive) {
        if (this.time < a.dive.until) {
          a.vx = a.dive.vx;
          a.vy = a.dive.vy;
          continue;
        }
        a.dive = null;
        a.vx *= 0.2;
        a.vy *= 0.2;
      }
      const isOwner = a.id === this.ball.ownerId;
      const base = 4.6 + (this.att(a, 'pace') / 100) * 4.4;
      let max = base * (0.72 + 0.28 * a.stamina) * speedScale;
      if (isOwner) max *= 0.84 + (this.att(a, 'dribbling') / 100) * 0.1;
      if (a.stunned > 0) max *= 0.3;
      const dx = a.targetX - a.x;
      const dy = a.targetY - a.y;
      const dd = Math.hypot(dx, dy);
      const cruise = a.urgent || isOwner ? max : max * 0.68;
      const speed = dd > 5 ? cruise : cruise * (dd / 5);
      const dvx = dd > 1e-3 ? (dx / dd) * speed : 0;
      const dvy = dd > 1e-3 ? (dy / dd) * speed : 0;
      const k = Math.min(1, dt * 6);
      a.vx += (dvx - a.vx) * k;
      a.vy += (dvy - a.vy) * k;
    }
    // Separación ligera entre compañeros para evitar solapamientos.
    for (let i = 0; i < this.agents.length; i++) {
      for (let j = i + 1; j < this.agents.length; j++) {
        const a = this.agents[i];
        const b = this.agents[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < 1.4) {
          const push = ((1.4 - d) / d) * 0.5;
          if (a.id !== this.ball.ownerId) {
            a.vx -= dx * push;
            a.vy -= dy * push;
          }
          if (b.id !== this.ball.ownerId) {
            b.vx += dx * push;
            b.vy += dy * push;
          }
        }
      }
    }
    for (const a of this.agents) {
      a.x = clamp(a.x + a.vx * dt, -2, L + 2);
      a.y = clamp(a.y + a.vy * dt, -2, W + 2);
      if (a.id === this.ball.ownerId) {
        a.x = clamp(a.x, 0.4, L - 0.4);
        a.y = clamp(a.y, 0.4, W - 0.4);
      }
      const base = 4.6 + (a.attrs.pace / 100) * 4.4;
      const ratio = Math.min(1, Math.hypot(a.vx, a.vy) / base);
      const drain = dt * ratio * ratio * 0.0026 * (1.25 - (a.attrs.physical / 100) * 0.5) * (1 + this.prof(a).press * 0.3);
      a.stamina = clamp(a.stamina - drain + (ratio < 0.3 ? dt * 0.0006 : 0), 0.25, 1);
    }
  }

  private giveBall(a: Agent, contested: boolean) {
    const prev = this.ball.ownerId ? this.byId.get(this.ball.ownerId) : null;
    if (prev && prev !== a) {
      prev.momentumUntil = 0;
      prev.beaten = 0;
      prev.skillAnnounced = 0;
      prev.oneOnOneAnnounced = false;
    }
    this.ball.ownerId = a.id;
    this.ball.flight = null;
    this.ball.vx = this.ball.vy = 0;
    this.possession = a.side;
    this.lastTouch = a.side;
    a.decisionTimer = contested ? 0.35 : 0.2 + this.rng.range(0, 0.15);
    a.carryTime = 0;
    a.beaten = 0;
    a.skillAnnounced = 0;
    a.oneOnOneAnnounced = false;
    a.arrivalUntil = a.boxRun && a.runLeft > 0 ? this.time + 2.6 : 0;
    if (this.secondBall && this.secondBall.lurkerId === a.id && this.time < this.secondBall.until) {
      a.arrivalUntil = this.time + 1.6;
      this.secondBall = null;
    }
    a.runLeft = 0;
    a.boxRun = false;
    a.dribbleX = a.x;
    a.dribbleY = a.y;
  }

  private updateBall(dt: number) {
    const ball = this.ball;
    if (ball.ownerId) {
      const o = this.byId.get(ball.ownerId)!;
      const sp = Math.hypot(o.vx, o.vy);
      const dir = o.side === 'home' ? 1 : -1;
      const fx = sp > 0.3 ? o.vx / sp : dir;
      const fy = sp > 0.3 ? o.vy / sp : 0;
      ball.x = o.x + fx * 0.65;
      ball.y = o.y + fy * 0.65;
      ball.vx = o.vx;
      ball.vy = o.vy;
      return;
    }
    const f = ball.flight;
    if (f) {
      const t = clamp((this.time - f.start) / f.duration, 0, 1);
      const nx = f.fromX + (f.toX - f.fromX) * t;
      const ny = f.fromY + (f.toY - f.fromY) * t;
      ball.vx = (nx - ball.x) / dt;
      ball.vy = (ny - ball.y) / dt;
      ball.x = nx;
      ball.y = ny;
      if (t >= 1) this.resolveFlight(f);
      return;
    }
    // Balón suelto
    const fr = Math.exp(-1.6 * dt);
    ball.vx *= fr;
    ball.vy *= fr;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    if (this.phase !== 'play') return;
    if (this.checkOut()) return;
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > 14) return;
    const near = this.agents
      .filter((a) => a.stunned <= 0)
      .map((a) => ({ a, d: Math.hypot(a.x - ball.x, a.y - ball.y) }))
      .filter((e) => e.d < 1.3);
    if (near.length === 0) return;
    const winner = this.rng.weighted(near, (e) => (1.4 - e.d) * (40 + this.att(e.a, 'physical') + this.att(e.a, 'dribbling') * 0.5));
    if (winner.a.side !== this.lastTouch) {
      this.stats[winner.a.side].interceptions++;
    }
    this.giveBall(winner.a, true);
  }

  private resolveFlight(f: BallFlight) {
    const kicker = this.byId.get(f.kickerId)!;
    const side = kicker.side;
    const ball = this.ball;
    ball.flight = null;
    const dirx = f.toX - f.fromX;
    const diry = f.toY - f.fromY;
    const dl = Math.hypot(dirx, diry) || 1;

    switch (f.outcome) {
      case 'complete':
      case 'intercepted': {
        const r = f.targetId ? this.byId.get(f.targetId)! : null;
        if (r && f.outcome === 'intercepted' && f.variant === 'cross' && this.inBoxOf(r.side, ball.x, ball.y) && this.rng.chance(0.5)) {
          if (this.rng.chance(0.3)) {
            // Despeje a córner.
            this.emit('interception', r.side, `${r.name} despeja a córner`, false, r.id, kicker.id);
            this.flightDecision(f, r);
            this.startRestart('corner', side, this.goalX(side) === L ? L - 0.6 : 0.6, ball.y < W / 2 ? 0.6 : W - 0.6);
            return;
          }
          // Despeje de cabeza: el balón cae suelto hacia la frontal.
          const out = r.side === 'home' ? 1 : -1;
          ball.vx = out * this.rng.range(9, 15);
          ball.vy = (W / 2 - ball.y) * this.rng.range(0.2, 0.6) + this.rng.range(-3, 3);
          this.lastTouch = r.side;
          this.emit('interception', r.side, `${r.name} despeja de cabeza`, false, r.id, kicker.id);
          this.flightDecision(f, r);
          return;
        }
        if (r && Math.hypot(r.x - ball.x, r.y - ball.y) < 3.4) {
          r.x += (ball.x - r.x) * 0.5;
          r.y += (ball.y - r.y) * 0.5;
          this.giveBall(r, f.outcome === 'intercepted');
          if (f.outcome === 'complete') {
            this.stats[side].passesCompleted++;
            this.lastPass = { kickerId: kicker.id, receiverId: r.id, side, time: this.time };
            if (!this.flightDecision(f, r)) this.announcePass(kicker, r, f, dl);
          } else {
            this.stats[r.side].interceptions++;
            this.emit('interception', r.side, `${r.name} intercepta el pase de ${kicker.name}`, false, r.id, kicker.id);
            this.flightDecision(f, r);
          }
        } else {
          this.flightDecision(f, null);
          ball.vx = (dirx / dl) * 5;
          ball.vy = (diry / dl) * 5;
          this.checkOut();
        }
        return;
      }
      case 'loose':
        this.flightDecision(f, null);
        ball.vx = (dirx / dl) * 4.5;
        ball.vy = (diry / dl) * 4.5;
        this.checkOut();
        return;
      case 'goal': {
        this.flightDecision(f, null);
        this.score[side]++;
        this.stats[side].goals++;
        ball.vx = ball.vy = 0;
        this.phase = 'goal';
        this.phaseTimer = 3;
        this.pendingKickoff = this.opp(side);
        this.possession = null;
        const lp = this.lastPass;
        const assist =
          lp && lp.side === side && lp.receiverId === kicker.id && lp.kickerId !== kicker.id && this.time - lp.time < 10 && f.variant !== 'penalty' && f.variant !== 'freekick'
            ? this.byId.get(lp.kickerId)!
            : null;
        const how: Partial<Record<string, string>> = {
          long: 'desde lejos',
          header: 'de cabeza',
          freekick: 'de tiro libre',
          penalty: 'de penalti',
          emptynet: 'tras regatear al portero',
        };
        const detail = [how[f.variant], assist ? `asistencia de ${assist.name}` : null].filter(Boolean).join(' · ');
        const e = this.emit(
          'goal',
          side,
          `¡GOL de ${kicker.name}${how[f.variant] ? ' ' + how[f.variant] : ''}! ${this.home.shortName} ${this.score.home} – ${this.score.away} ${this.away.shortName}`,
          true,
          kicker.id,
          assist?.id,
        );
        e.highlight = { kind: 'goal', title: '¡GOL!', detail: detail ? `${kicker.name} · ${detail}` : kicker.name, major: true };
        this.lastHighlightAt = this.time;
        this.lastPass = null;
        return;
      }
      case 'saved': {
        this.flightDecision(f, null);
        const keeper = this.gk(this.opp(side));
        const handling = this.att(keeper, 'goalkeeping') / 100;
        this.emit('save', keeper.side, `Parada de ${keeper.name}`, true, keeper.id, kicker.id);
        if ((f.xg ?? 0) >= 0.3 || f.variant === 'penalty') {
          this.highlight(
            'bigsave',
            keeper.side,
            f.variant === 'penalty' ? '¡PENALTI PARADO!' : '¡PARADÓN!',
            `${keeper.name} le niega el gol a ${kicker.name}`,
            keeper.id,
            kicker.id,
          );
        }
        const roll = this.rng.next();
        const hold = 0.35 + handling * 0.45;
        if (roll < hold) {
          keeper.x = ball.x;
          keeper.y = ball.y;
          this.giveBall(keeper, false);
          keeper.decisionTimer = 1.1;
          keeper.mustPass = true;
        } else if (roll < hold + (1 - hold) * 0.5) {
          // Rechace dentro del área: balón vivo para quien llegue primero.
          const back = side === 'home' ? -1 : 1;
          ball.x = this.goalX(side) + back * 1.2;
          ball.vx = back * this.rng.range(7, 12);
          ball.vy = this.rng.range(-7, 7);
          keeper.stunned = 0.9;
          this.lastTouch = keeper.side;
          this.emit('save', keeper.side, `${keeper.name} rechaza y el balón queda muerto en el área`, true, keeper.id);
        } else {
          const cy = ball.y < W / 2 ? 0.6 : W - 0.6;
          this.startRestart('corner', side, this.goalX(side) === L ? L - 0.6 : 0.6, cy);
        }
        return;
      }
      case 'post': {
        this.flightDecision(f, null);
        this.emit('miss', side, `¡${kicker.name} estrella el balón en el palo!`, true, kicker.id);
        this.highlight('woodwork', side, '¡AL PALO!', `El disparo de ${kicker.name} se estrella en la madera`, kicker.id);
        // Rechace hacia el campo.
        const back = side === 'home' ? -1 : 1;
        ball.x = this.goalX(side) + back * 0.6;
        ball.vx = back * this.rng.range(6, 11);
        ball.vy = this.rng.range(-6, 6);
        return;
      }
      case 'miss': {
        this.flightDecision(f, null);
        const def = this.opp(side);
        // Parte de los disparos fuera los desvía un defensa: córner.
        if (f.variant !== 'penalty' && this.rng.chance(0.38)) {
          this.emit('miss', side, `El disparo de ${kicker.name} sale desviado por un defensa`, true, kicker.id);
          this.startRestart('corner', side, this.goalX(side) === L ? L - 0.6 : 0.6, ball.y < W / 2 ? 0.6 : W - 0.6);
          return;
        }
        this.emit('miss', side, `${kicker.name} dispara fuera`, true, kicker.id);
        this.startRestart('goalkick', def, this.fx(def, 5.5), W / 2 + this.rng.range(-6, 6));
        return;
      }
    }
  }

  /** Avisos de pases que merecen atención; los centros terminan en remate de cabeza. */
  private announcePass(kicker: Agent, r: Agent, f: BallFlight, dist: number) {
    const side = kicker.side;
    const rDepth = this.depthOf(side, r.x);
    if (f.variant === 'cross' && this.inBoxOf(this.opp(side), r.x, r.y)) {
      // Con decisiones activas, el usuario elige cómo rematar el centro.
      if (this.maybeAerialPrompt(r, kicker)) return;
      this.highlight('header', side, '¡CENTRO Y REMATE!', `${kicker.name} la pone y ${r.name} cabecea`, r.id, kicker.id);
      this.shoot(r, 'header');
      return;
    }
    if (f.variant === 'through' && rDepth > 70 && rDepth >= this.lastLine(side) - 1) {
      this.highlight('throughball', side, '¡PASE AL HUECO!', `${kicker.name} habilita a ${r.name} a la espalda de la defensa`, r.id, kicker.id);
      return;
    }
    if (f.variant === 'long' && dist >= 38) {
      this.highlight('longball', side, 'PASE LARGO', `${kicker.name} encuentra a ${r.name} a ${Math.round(dist)} m`, r.id, kicker.id);
    }
  }

  /** Comprueba si el balón suelto ha salido del campo y ordena el saque. */
  private checkOut(): boolean {
    const b = this.ball;
    if (b.y < 0 || b.y > W) {
      const side = this.opp(this.lastTouch);
      this.startRestart('throw', side, clamp(b.x, 1, L - 1), b.y < 0 ? 0.3 : W - 0.3);
      return true;
    }
    if (b.x < 0 || b.x > L) {
      const goalSideTeam: TeamSide = b.x < 0 ? 'home' : 'away'; // equipo que defiende esa portería
      if (this.lastTouch === goalSideTeam) {
        const attacker = this.opp(goalSideTeam);
        this.startRestart('corner', attacker, b.x < 0 ? 0.6 : L - 0.6, b.y < W / 2 ? 0.6 : W - 0.6);
      } else {
        this.startRestart('goalkick', goalSideTeam, this.fx(goalSideTeam, 5.5), W / 2);
      }
      return true;
    }
    return false;
  }
}

/** Simula un partido completo de forma instantánea. */
export function simulateMatch(home: MatchTeamSetup, away: MatchTeamSetup, seed: number): MatchSnapshot {
  const engine = new MatchEngine(home, away, seed);
  engine.simulateToEnd();
  return engine.getSnapshot();
}
