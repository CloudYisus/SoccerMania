import { clamp, createRng, pointSegment, type Rng } from '@fu/shared';
import { POSITION_LINE, type PositionLine } from '../players/positions';
import type { PlayerInstruction, TeamTactics } from '../tactics/tactics';
import {
  DEFAULT_MATCH_CONFIG,
  PITCH,
  type BallState,
  type MatchAttributes,
  type MatchConfig,
  type MatchEvent,
  type MatchEventType,
  type MatchPhase,
  type MatchSnapshot,
  type MatchTeamSetup,
  type PlayerState,
  type TeamSide,
  type TeamStats,
} from './types';

/**
 * MATCH ENGINE — prototipo
 *
 * El motor es la única fuente de verdad del partido: decide el resultado de
 * cada acción (pase, regate, entrada, disparo, parada) en el momento en que se
 * ejecuta, con probabilidades derivadas de los atributos. El renderizador sólo
 * dibuja los snapshots que produce.
 *
 * Inteligencia en tres niveles:
 *  1. Colectiva  → forma del bloque, altura de línea, amplitud, presión (computeTeamShape).
 *  2. Por puesto → objetivo de cada jugador según su línea y su anclaje en la formación.
 *  3. Individual → decisiones del poseedor, presión, entradas e instrucciones del usuario.
 *
 * Coordenadas: metros, x ∈ [0, 105] (local ataca hacia +x), y ∈ [0, 68].
 */

const L = PITCH.length;
const W = PITCH.width;
const GOAL_HALF = PITCH.goalWidth / 2;

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
  runTimer: number;
  dribbleX: number;
  dribbleY: number;
  mustPass: boolean;
  /** Segundos que lleva conduciendo el balón (penaliza conducciones eternas). */
  carryTime: number;
}

interface Restart {
  side: TeamSide;
  takerId: string;
  x: number;
  y: number;
  timer: number;
  kind: 'throw' | 'goalkick' | 'corner';
}

const emptyStats = (): TeamStats => ({
  goals: 0,
  shots: 0,
  shotsOnTarget: 0,
  passes: 0,
  passesCompleted: 0,
  tackles: 0,
  interceptions: 0,
  possessionTicks: 0,
});

const MENTALITY_SHIFT = { defensive: -1, balanced: 0, attacking: 1 } as const;

export class MatchEngine {
  readonly config: MatchConfig;
  private readonly rng: Rng;
  private readonly agents: Agent[] = [];
  private readonly byId = new Map<string, Agent>();
  private readonly tactics: Record<TeamSide, TeamTactics>;
  private ball: BallState = { x: L / 2, y: W / 2, vx: 0, vy: 0, ownerId: null, flight: null };
  private time = 0;
  private accumulator = 0;
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
          runTimer: this.rng.range(0, 6),
          dribbleX: 0,
          dribbleY: 0,
          mustPass: false,
          carryTime: 0,
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
    while (!this.finished) this.tick();
  }

  setInstruction(playerId: string, instruction: PlayerInstruction): void {
    const a = this.byId.get(playerId);
    if (!a) return;
    a.instruction = instruction;
    this.emit('instruction', a.side, `${a.name}: nueva instrucción`, false, a.id);
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
    };
  }

  // ───────────────────────────── Bucle principal ─────────────────────────────

  private tick(): void {
    const dt = this.config.tickSeconds;
    this.time += dt;
    const half = this.config.engineDurationSeconds / 2;

    if (this.period === 1 && this.time >= half && this.phase !== 'goal') {
      this.period = 2;
      this.phase = 'halftime';
      this.phaseTimer = 1.5;
      this.ball.flight = null;
      this.emit('halftime', null, `Descanso: ${this.home.shortName} ${this.score.home} – ${this.score.away} ${this.away.shortName}`, true);
    }
    if (this.time >= this.config.engineDurationSeconds && this.phase !== 'goal') {
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
        this.computeTargets();
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
      a.runTimer += dt;
    }

    this.computeTargets();
    if (this.phase === 'play') {
      this.carrierDecision(dt);
      this.defensiveDuels();
    }
    this.moveAgents(dt, 1);
    this.updateBall(dt);

    if (this.possession) this.stats[this.possession].possessionTicks++;
  }

  // ───────────────────────────── Utilidades de coordenadas ─────────────────────────────

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
  private teamSetup(side: TeamSide) {
    return side === 'home' ? this.home : this.away;
  }
  /** Factor de rendimiento por cansancio aplicado a los atributos. */
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

  private emit(type: MatchEventType, side: TeamSide | null, text: string, important: boolean, playerId?: string, otherId?: string) {
    const e: MatchEvent = { id: ++this.eventSeq, minute: this.minute, type, side, text, important, playerId, otherId };
    this.pending.push(e);
    this.log.push(e);
  }

  // ───────────────────────────── Saques ─────────────────────────────

  private setupKickoff(side: TeamSide) {
    this.phase = 'kickoff';
    this.phaseTimer = 1.0;
    this.restart = null;
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
    }
    // Delantero más centrado del equipo que saca, en el círculo central.
    const kicker = this.team(side)
      .filter((a) => !a.isGK)
      .sort((p, q) => p.anchor.y + Math.abs(p.anchor.x - 50) * 0.5 - (q.anchor.y + Math.abs(q.anchor.x - 50) * 0.5))[0];
    kicker.x = L / 2 - (side === 'home' ? 0.6 : -0.6);
    kicker.y = W / 2;
    this.giveBall(kicker, false);
    this.possession = side;
  }

  private startRestart(kind: Restart['kind'], side: TeamSide, x: number, y: number) {
    let taker: Agent;
    if (kind === 'goalkick') taker = this.gk(side);
    else {
      taker = this.team(side)
        .filter((a) => !a.isGK)
        .sort((p, q) => Math.hypot(p.x - x, p.y - y) - Math.hypot(q.x - x, q.y - y))[0];
    }
    this.ball = { x, y, vx: 0, vy: 0, ownerId: null, flight: null };
    this.restart = { side, takerId: taker.id, x, y, timer: 2.2, kind };
    this.phase = 'restart';
    this.possession = side;
    const label = kind === 'throw' ? 'Saque de banda' : kind === 'goalkick' ? 'Saque de puerta' : 'Saque de esquina';
    this.emit('out', side, `${label} para ${this.teamSetup(side).shortName}`, false);
  }

  private updateRestart(dt: number) {
    const r = this.restart;
    if (!r) {
      this.phase = 'play';
      return;
    }
    r.timer -= dt;
    const taker = this.byId.get(r.takerId)!;
    if (Math.hypot(taker.x - r.x, taker.y - r.y) < 1.2 || r.timer <= 0) {
      taker.x = r.x;
      taker.y = r.y;
      taker.vx = taker.vy = 0;
      this.restart = null;
      this.phase = 'play';
      this.giveBall(taker, false);
      taker.decisionTimer = 0.35;
      taker.mustPass = true;
    }
  }

  // ───────────────────────────── Nivel 1 y 2: forma colectiva y por puesto ─────────────────────────────

  private computeTargets() {
    const ball = this.ball;
    const owner = ball.ownerId ? this.byId.get(ball.ownerId)! : null;
    const poss = this.possession;

    for (const side of ['home', 'away'] as const) {
      const t = this.tactics[side];
      const inPoss = poss === side;
      const m = MENTALITY_SHIFT[t.mentality];
      const ballDepth = this.depthOf(side, ball.x);
      const ballLat = this.latOf(side, ball.y);
      const opponents = this.team(this.opp(side));
      // Última línea rival (en coordenadas propias) para los desmarques.
      const lastLine = Math.max(
        ...opponents.filter((o) => !o.isGK).map((o) => this.depthOf(side, o.x)),
      );

      let lineDepth: number, length: number, halfWidth: number, latShift: number;
      if (inPoss) {
        lineDepth = clamp(26 + t.depth * 0.18 + m * 4 + (ballDepth - 50) * 0.45, 18, 62);
        length = 38 + m * 4 + t.tempo * 0.04;
        halfWidth = 20 + t.width * 0.13;
        latShift = (ballLat - W / 2) * 0.15;
      } else {
        lineDepth = clamp(16 + t.depth * 0.2 + m * 3 + (ballDepth - 52) * 0.5, 9, 48);
        length = 26 + m * 2;
        halfWidth = 15 + t.width * 0.05;
        latShift = (ballLat - W / 2) * 0.4;
      }

      for (const a of this.team(side)) {
        a.urgent = false;
        if (a.id === ball.ownerId) continue;
        if (a.isGK) {
          const depth = inPoss ? 7 : clamp(2.5 + (ballDepth < 25 ? 2 : 0), 1, 8);
          const lat = W / 2 + (ballLat - W / 2) * 0.22;
          a.targetX = this.fx(side, depth);
          a.targetY = this.fy(side, lat);
          continue;
        }
        const rel = clamp((73 - a.anchor.y) / 62, 0, 1.05);
        let depth = lineDepth + rel * length;
        let lat = W / 2 + ((a.anchor.x - 50) / 50) * halfWidth + (a.instruction === 'holdPosition' ? 0 : latShift);

        if (inPoss) {
          if (a.line === 'attack') depth = Math.max(depth, Math.min(lastLine - 1, depth + 12));
          switch (a.instruction) {
            case 'getForward':
              depth += 10;
              break;
            case 'dropBack':
              depth -= 9;
              break;
            case 'diagonalRuns':
              lat += (W / 2 - lat) * 0.45;
              depth += 6;
              break;
            case 'makeRuns': {
              // Ciclo de desmarque: ataca la espalda de la defensa durante parte del ciclo.
              const cycle = a.runTimer % 7;
              if (cycle < 3) {
                depth = Math.min(lastLine + 5, 101);
                a.urgent = true;
              }
              break;
            }
          }
          // Apoyo: si está muy lejos del balón, se acerca para ofrecer línea de pase.
          if (owner && owner.side === side) {
            const d = Math.hypot(this.fx(side, depth) - ball.x, this.fy(side, lat) - ball.y);
            if (d > 28 && a.instruction !== 'holdPosition') {
              depth += (ballDepth - depth) * 0.22;
              lat += (ballLat - lat) * 0.18;
            }
          }
        } else {
          if (a.instruction === 'dropBack') depth -= 6;
          if (a.instruction === 'getForward') depth += 5;
          if (a.line === 'attack') depth = Math.max(depth, ballDepth - 32);
        }

        depth = clamp(depth, 3, 102);
        lat = clamp(lat, 2, W - 2);
        let tx = this.fx(side, depth);
        let ty = this.fy(side, lat);

        // Marcaje zonal: al defender, se ajusta hacia el rival más cercano a su zona.
        if (!inPoss && a.instruction !== 'holdPosition') {
          let best: Agent | null = null;
          let bd = 11;
          for (const o of opponents) {
            if (o.isGK || o.id === ball.ownerId) continue;
            const d = Math.hypot(o.x - tx, o.y - ty);
            if (d < bd) {
              bd = d;
              best = o;
            }
          }
          if (best) {
            const goalSide = side === 'home' ? -1.6 : 1.6;
            tx += (best.x + goalSide - tx) * 0.45;
            ty += (best.y - ty) * 0.45;
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
        const pressCount = 1 + (t.pressing > 62 || ownerDepthForUs < 35 ? 1 : 0);
        candidates.forEach(({ a, d }, i) => {
          const hold = a.instruction === 'holdPosition' && d > 8;
          const instructed = a.instruction === 'press' && d < 22;
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
      const chase = !f || f.outcome === 'loose';
      if (chase) {
        const px = f ? f.toX : ball.x + ball.vx * 0.4;
        const py = f ? f.toY : ball.y + ball.vy * 0.4;
        for (const side of ['home', 'away'] as const) {
          const inBox = this.depthOf(side, px) < 16 && Math.abs(py - W / 2) < 20;
          const c = this.team(side)
            .filter((a) => a.stunned <= 0 && (!a.isGK || inBox))
            .sort((p, q) => Math.hypot(p.x - px, p.y - py) - Math.hypot(q.x - px, q.y - py))[0];
          if (c) {
            c.targetX = px;
            c.targetY = py;
            c.urgent = true;
          }
        }
      }
    }

    // Saque: el lanzador va al punto.
    if (this.phase === 'restart' && this.restart) {
      const taker = this.byId.get(this.restart.takerId)!;
      taker.targetX = this.restart.x;
      taker.targetY = this.restart.y;
      taker.urgent = true;
    }
  }

  // ───────────────────────────── Nivel 3: decisiones individuales ─────────────────────────────

  private carrierDecision(dt: number) {
    const owner = this.ball.ownerId ? this.byId.get(this.ball.ownerId) : null;
    if (!owner) return;
    owner.decisionTimer -= dt;
    owner.carryTime += dt;
    if (owner.decisionTimer > 0) {
      owner.targetX = owner.dribbleX;
      owner.targetY = owner.dribbleY;
      owner.urgent = true;
      return;
    }

    const side = owner.side;
    const t = this.tactics[side];
    const tempo = t.tempo / 100;
    const myDepth = this.depthOf(side, owner.x);
    const opponents = this.team(this.opp(side));
    const passing = this.att(owner, 'passing') / 100;
    const instr = owner.instruction;
    const noise = () => this.rng.gaussian(0, 0.035 + (1 - passing) * 0.05);

    // ── Disparo
    const gx = this.goalX(side);
    const dGoal = Math.hypot(gx - owner.x, W / 2 - owner.y);
    let shotUtil = -Infinity;
    const maxShot = instr === 'shootOnSight' ? 36 : 30;
    if (!owner.isGK && !owner.mustPass && dGoal < maxShot) {
      const angle = clamp(1 - (Math.abs(owner.y - W / 2) - 4) / 26, 0.15, 1);
      const q = clamp(Math.exp(-(dGoal - 7) / 10), 0, 1) * angle;
      const blocked = this.laneRisk(owner.x, owner.y, gx, W / 2, opponents, true).risk;
      shotUtil = q * (0.7 + (this.att(owner, 'shooting') / 100) * 0.8) * (1 - blocked * 0.35);
      if (instr === 'shootOnSight') shotUtil *= 1.6;
      if (instr === 'keepPossession') shotUtil *= 0.75;
      if (dGoal < 13) shotUtil += 0.15;
    }

    // ── Pase
    let bestPass: { util: number; to: Agent; x: number; y: number; p: number } | null = null;
    for (const r of this.team(side)) {
      if (r === owner || r.stunned > 0) continue;
      const rx = clamp(r.x + r.vx * 0.5, 1, L - 1);
      const ry = clamp(r.y + r.vy * 0.5, 1, W - 1);
      const d = Math.hypot(rx - owner.x, ry - owner.y);
      if (d < 4 || d > 52) continue;
      const lane = this.laneRisk(owner.x, owner.y, rx, ry, opponents, false).risk;
      const rp = clamp(1 - this.nearestOpponentDist(side, rx, ry) / 6, 0, 1);
      const p = clamp((0.99 - d * 0.0045 * (1.6 - passing)) * (1 - lane * (0.95 - passing * 0.35)) * (1 - rp * 0.25), 0.03, 0.985);
      const rDepth = this.depthOf(side, rx);
      const progress = rDepth - myDepth;
      const zone = rDepth > 82 ? 0.35 : rDepth > 66 ? 0.15 : 0;
      const value = 0.32 + clamp((progress / 35) * (1 + tempo * 0.5), -0.4, 0.85) + zone;
      const lossCost = 0.25 + (1 - myDepth / L) * 0.45;
      let util =
        instr === 'keepPossession'
          ? p * p * value * 0.9 + p * 0.25 - (1 - p) * lossCost * 1.6
          : p * value - (1 - p) * lossCost;
      if (r.isGK) util *= 0.45;
      util += noise();
      if (!bestPass || util > bestPass.util) bestPass = { util, to: r, x: rx, y: ry, p };
    }

    // ── Conducción / regate
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
        const dri = this.att(owner, 'dribbling') / 100;
        let util = (0.06 + 0.34 * space * (0.6 + dri * 0.5) + gain * 0.1) * Math.max(0.35, 1 - owner.carryTime / 5);
        const close = this.nearestOpponentDist(side, owner.x, owner.y);
        if (close < 2.5) util *= 0.55 + dri * 0.45;
        if (instr === 'keepPossession') util *= 0.85;
        util += noise();
        if (!dribble || util > dribble.util) dribble = { util, x: ax, y: ay };
      }
    }

    owner.mustPass = false;
    const passUtil = bestPass?.util ?? -Infinity;
    const dribUtil = dribble?.util ?? -Infinity;
    if (shotUtil + noise() > Math.max(passUtil, dribUtil)) {
      this.shoot(owner);
    } else if (bestPass && passUtil >= dribUtil) {
      this.pass(owner, bestPass.to, bestPass.x, bestPass.y, bestPass.p);
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

  private pass(from: Agent, to: Agent, rx: number, ry: number, p: number) {
    const side = from.side;
    const opponents = this.team(this.opp(side));
    let outcome: 'complete' | 'intercepted' | 'loose';
    let tx = rx;
    let ty = ry;
    let targetId: string | null = to.id;
    if (this.rng.chance(p)) {
      outcome = 'complete';
    } else {
      const { worst } = this.laneRisk(from.x, from.y, rx, ry, opponents, false);
      if (worst && worst.r > 0.2) {
        outcome = 'intercepted';
        tx = from.x + (rx - from.x) * worst.t;
        ty = from.y + (ry - from.y) * worst.t;
        targetId = worst.agent.id;
      } else {
        outcome = 'loose';
        const ang = this.rng.range(0, Math.PI * 2);
        const mag = this.rng.range(3, 9);
        tx = rx + Math.cos(ang) * mag;
        ty = ry + Math.sin(ang) * mag;
        targetId = null;
      }
    }
    const d = Math.hypot(tx - from.x, ty - from.y);
    const speed = clamp(11 + d * 0.42, 12, 27);
    this.ball.ownerId = null;
    this.ball.flight = {
      kind: 'pass',
      fromX: from.x,
      fromY: from.y,
      toX: tx,
      toY: ty,
      start: this.time,
      duration: Math.max(0.2, d / speed),
      outcome,
      targetId,
      kickerId: from.id,
    };
    this.lastTouch = side;
    this.stats[side].passes++;
    this.emit('pass', side, `${from.name} busca a ${to.name}`, false, from.id, to.id);
  }

  private shoot(a: Agent) {
    const side = a.side;
    const defending = this.opp(side);
    const gx = this.goalX(side);
    const dGoal = Math.hypot(gx - a.x, W / 2 - a.y);
    const sho = this.att(a, 'shooting');
    const pressure = clamp(1 - this.nearestOpponentDist(side, a.x, a.y) / 3, 0, 1);
    const angle = clamp(1 - (Math.abs(a.y - W / 2) - 4) / 26, 0.15, 1);
    const keeper = this.gk(defending);
    const gkSkill = this.att(keeper, 'goalkeeping') * 0.6 + this.att(keeper, 'reflexes') * 0.4;

    const onTarget = clamp(0.34 + (sho / 100) * 0.5 - (dGoal - 10) * 0.012 - pressure * 0.15, 0.1, 0.88);
    const goalGivenOnTarget = clamp(0.36 + ((sho - gkSkill) / 100) * 0.45 - (dGoal - 11) * 0.016 + (angle - 1) * 0.2, 0.05, 0.85);
    const roll = this.rng.next();
    let outcome: 'goal' | 'saved' | 'miss';
    if (roll < onTarget * goalGivenOnTarget) outcome = 'goal';
    else if (roll < onTarget) outcome = 'saved';
    else outcome = 'miss';

    const dirOut = side === 'home' ? 1 : -1;
    let tx: number, ty: number;
    if (outcome === 'goal') {
      tx = gx + dirOut * 1.2;
      ty = W / 2 + this.rng.range(-GOAL_HALF + 0.4, GOAL_HALF - 0.4);
    } else if (outcome === 'saved') {
      tx = gx - dirOut * 0.9;
      ty = clamp(keeper.y + this.rng.range(-1.5, 1.5), W / 2 - GOAL_HALF, W / 2 + GOAL_HALF);
    } else {
      tx = gx + dirOut * 1.5;
      ty = W / 2 + (this.rng.chance(0.5) ? 1 : -1) * (GOAL_HALF + this.rng.range(0.6, 6));
    }
    const d = Math.hypot(tx - a.x, ty - a.y);
    this.ball.ownerId = null;
    this.ball.flight = {
      kind: 'shot',
      fromX: a.x,
      fromY: a.y,
      toX: tx,
      toY: ty,
      start: this.time,
      duration: Math.max(0.25, d / 27),
      outcome,
      targetId: outcome === 'saved' ? keeper.id : null,
      kickerId: a.id,
    };
    this.lastTouch = side;
    this.stats[side].shots++;
    if (outcome !== 'miss') this.stats[side].shotsOnTarget++;
    this.emit('shot', side, `Disparo de ${a.name}`, true, a.id);
  }

  private defensiveDuels() {
    const owner = this.ball.ownerId ? this.byId.get(this.ball.ownerId) : null;
    if (!owner) return;
    const side = this.opp(owner.side);
    const t = this.tactics[side];
    for (const d of this.team(side)) {
      if (d.stunned > 0 || d.tackleTimer > 0 || d.isGK) continue;
      const dist = Math.hypot(d.x - owner.x, d.y - owner.y);
      if (dist > 1.8) continue;
      d.tackleTimer = 0.45;
      const attempt = 0.5 + (d.instruction === 'press' ? 0.2 : 0) + t.pressing / 500;
      if (!this.rng.chance(attempt)) continue;
      const p = clamp(
        0.42 + ((this.att(d, 'defending') - this.att(owner, 'dribbling')) / 100) * 0.6 +
          ((this.att(d, 'physical') - this.att(owner, 'physical')) / 100) * 0.15,
        0.1,
        0.82,
      );
      if (this.rng.chance(p)) {
        owner.stunned = 0.7;
        this.giveBall(d, true);
        this.stats[side].tackles++;
        this.emit('tackle', side, `Recuperación de ${d.name} ante ${owner.name}`, false, d.id, owner.id);
      } else {
        d.stunned = 1.0;
        this.emit('dribble', owner.side, `${owner.name} supera a ${d.name}`, false, owner.id, d.id);
      }
      return;
    }
  }

  // ───────────────────────────── Física simple ─────────────────────────────

  private moveAgents(dt: number, speedScale: number) {
    for (const a of this.agents) {
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
      const drain = dt * ratio * ratio * 0.0026 * (1.25 - (a.attrs.physical / 100) * 0.5) * (a.instruction === 'press' ? 1.3 : 1);
      a.stamina = clamp(a.stamina - drain + (ratio < 0.3 ? dt * 0.0006 : 0), 0.25, 1);
    }
  }

  private giveBall(a: Agent, contested: boolean) {
    this.ball.ownerId = a.id;
    this.ball.flight = null;
    this.ball.vx = this.ball.vy = 0;
    this.possession = a.side;
    this.lastTouch = a.side;
    a.decisionTimer = contested ? 0.35 : 0.2 + this.rng.range(0, 0.15);
    a.carryTime = 0;
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

  private resolveFlight(f: NonNullable<BallState['flight']>) {
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
        if (r && Math.hypot(r.x - ball.x, r.y - ball.y) < 3.2) {
          r.x += (ball.x - r.x) * 0.5;
          r.y += (ball.y - r.y) * 0.5;
          this.giveBall(r, f.outcome === 'intercepted');
          if (f.outcome === 'complete') this.stats[side].passesCompleted++;
          else {
            this.stats[r.side].interceptions++;
            this.emit('interception', r.side, `${r.name} intercepta el pase de ${kicker.name}`, false, r.id, kicker.id);
          }
        } else {
          ball.vx = (dirx / dl) * 5;
          ball.vy = (diry / dl) * 5;
          this.checkOut();
        }
        return;
      }
      case 'loose':
        ball.vx = (dirx / dl) * 4.5;
        ball.vy = (diry / dl) * 4.5;
        this.checkOut();
        return;
      case 'goal': {
        this.score[side]++;
        this.stats[side].goals++;
        ball.vx = ball.vy = 0;
        this.phase = 'goal';
        this.phaseTimer = 3;
        this.pendingKickoff = this.opp(side);
        this.possession = null;
        this.emit('goal', side, `¡GOL de ${kicker.name}! ${this.home.shortName} ${this.score.home} – ${this.score.away} ${this.away.shortName}`, true, kicker.id);
        return;
      }
      case 'saved': {
        const keeper = this.gk(this.opp(side));
        const handling = this.att(keeper, 'goalkeeping') / 100;
        this.emit('save', keeper.side, `Parada de ${keeper.name}`, true, keeper.id, kicker.id);
        if (this.rng.chance(0.35 + handling * 0.45)) {
          keeper.x = ball.x;
          keeper.y = ball.y;
          this.giveBall(keeper, false);
          keeper.decisionTimer = 1.1;
          keeper.mustPass = true;
        } else {
          const cy = ball.y < W / 2 ? 0.6 : W - 0.6;
          this.startRestart('corner', side, this.goalX(side) === L ? L - 0.6 : 0.6, cy);
        }
        return;
      }
      case 'miss': {
        this.emit('miss', side, `${kicker.name} dispara fuera`, true, kicker.id);
        const def = this.opp(side);
        this.startRestart('goalkick', def, this.fx(def, 5.5), W / 2 + this.rng.range(-6, 6));
        return;
      }
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
