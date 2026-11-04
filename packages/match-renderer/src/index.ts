import Phaser from 'phaser';
import { PITCH, type DecisionFamily, type DecisionPrompt, type MatchSnapshot, type TeamSide } from '@fu/domain';

/**
 * MATCH RENDERER (Phaser 3)
 * Representa los snapshots del Match Engine. No toma ninguna decisión de juego:
 * sólo interpola posiciones, dibuja y comunica clics del usuario.
 */
export interface TeamPalette {
  primary: string;
  secondary: string;
}

export interface MatchViewOptions {
  parent: HTMLElement;
  home: TeamPalette;
  away: TeamPalette;
  /** Lado controlado por el usuario (para resaltar y permitir seleccionar). */
  userSide: TeamSide;
  onPlayerClick?: (playerId: string) => void;
}

export interface MatchView {
  update(snapshot: MatchSnapshot): void;
  setSelected(playerId: string | null): void;
  /** Resalta a un jugador (jugada destacada): anillos que se expanden. */
  spotlight(playerId: string): void;
  /** Dibuja las opciones de una decisión pendiente (null para ocultarlas). */
  setDecision(decision: DecisionPrompt | null, focusOptionId?: string | null): void;
  destroy(): void;
}

const SCALE = 10; // px por metro
const MARGIN = 34;
const W = PITCH.length * SCALE + MARGIN * 2;
const H = PITCH.width * SCALE + MARGIN * 2;
const px = (x: number) => MARGIN + x * SCALE;
const py = (y: number) => MARGIN + y * SCALE;

const hex = (c: string) => Phaser.Display.Color.HexStringToColor(c).color;

const FAMILY_COLOR: Record<DecisionFamily, number> = {
  move: 0xf3d99b,
  pass: 0x6cc4ff,
  shot: 0xff6b6b,
  defense: 0x39d98a,
};

/** Contraste de texto sobre el color de la camiseta. */
function textOn(color: string) {
  const c = Phaser.Display.Color.HexStringToColor(color);
  return (c.red * 299 + c.green * 587 + c.blue * 114) / 1000 > 150 ? '#0b0c0f' : '#ffffff';
}

interface Sprite {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Arc;
  ring: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  stamina: Phaser.GameObjects.Rectangle;
  side: TeamSide;
  x: number;
  y: number;
}

class MatchScene extends Phaser.Scene {
  private latest: MatchSnapshot | null = null;
  private sprites = new Map<string, Sprite>();
  private ball!: Phaser.GameObjects.Arc;
  private ballShadow!: Phaser.GameObjects.Ellipse;
  private ownerMarker!: Phaser.GameObjects.Triangle;
  private bx = px(PITCH.length / 2);
  private by = py(PITCH.width / 2);
  private selected: string | null = null;
  private lastPhase: string | null = null;
  private goalFlash!: Phaser.GameObjects.Rectangle;
  private decision: DecisionPrompt | null = null;
  private focus: string | null = null;
  private decoG!: Phaser.GameObjects.Graphics;
  private decoTags: { id: string; bg: Phaser.GameObjects.Arc; text: Phaser.GameObjects.Text }[] = [];
  private pulse = 0;

  constructor(private opts: MatchViewOptions) {
    super('match');
  }

  setSnapshot(s: MatchSnapshot) {
    this.latest = s;
  }
  setSelected(id: string | null) {
    this.selected = id;
  }
  setDecision(d: DecisionPrompt | null, focus: string | null) {
    this.focus = focus;
    // Antes de create() la escena aún no puede crear objetos: se aplica al arrancar.
    if (!this.decoG) {
      this.decision = d;
      return;
    }
    if (d?.id !== this.decision?.id) {
      for (const t of this.decoTags) {
        t.bg.destroy();
        t.text.destroy();
      }
      this.decoTags = [];
      d?.options.forEach((o, i) => {
        const color = FAMILY_COLOR[o.family];
        const bg = this.add.circle(0, 0, 11, 0x0b0d11, 0.92).setStrokeStyle(2.5, color, 1).setDepth(41);
        const text = this.add
          .text(0, 0, String(i + 1), { fontFamily: 'Barlow Condensed, Arial Narrow, sans-serif', fontSize: '14px', fontStyle: '800', color: '#ffffff' })
          .setOrigin(0.5)
          .setDepth(42);
        this.decoTags.push({ id: o.id, bg, text });
      });
    }
    this.decision = d;
  }
  spotlight(id: string) {
    const s = this.sprites.get(id);
    if (!s || !this.scene.isActive()) return;
    for (let i = 0; i < 3; i++) {
      const ring = this.add.circle(0, 0, 12, 0x000000, 0).setStrokeStyle(3, 0xf3d99b, 1).setDepth(19);
      s.container.add(ring);
      this.tweens.add({
        targets: ring,
        scale: 3.2,
        alpha: 0,
        duration: 1100,
        delay: i * 260,
        ease: 'Cubic.easeOut',
        onComplete: () => ring.destroy(),
      });
    }
  }

  create() {
    this.drawPitch();
    this.ballShadow = this.add.ellipse(this.bx, this.by, 9, 5, 0x000000, 0.4).setDepth(5);
    this.ball = this.add.circle(this.bx, this.by, 4.6, 0xffffff).setStrokeStyle(1.2, 0x111111).setDepth(30);
    this.ownerMarker = this.add.triangle(0, 0, 0, 0, 10, 0, 5, 7, 0xf3d99b).setDepth(31).setVisible(false);
    this.goalFlash = this.add.rectangle(W / 2, H / 2, W, H, 0xf3d99b, 0).setDepth(50);
    this.decoG = this.add.graphics().setDepth(40);
    if (this.decision) {
      const d = this.decision;
      this.decision = null;
      this.setDecision(d, this.focus);
    }
  }

  /** Línea discontinua (Phaser no las trae de serie). */
  private dashed(g: Phaser.GameObjects.Graphics, x0: number, y0: number, x1: number, y1: number, offset: number) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 1) return;
    const ux = (x1 - x0) / len;
    const uy = (y1 - y0) / len;
    const dash = 9;
    const gap = 6;
    for (let t = -((offset % (dash + gap)) + dash + gap); t < len; t += dash + gap) {
      const a = Math.max(0, t);
      const b = Math.min(len, t + dash);
      if (b <= a) continue;
      g.lineBetween(x0 + ux * a, y0 + uy * a, x0 + ux * b, y0 + uy * b);
    }
  }

  /** Opciones de la decisión pendiente: líneas desde el jugador a cada destino. */
  private drawDecision(delta: number) {
    const g = this.decoG;
    g.clear();
    const d = this.decision;
    if (!d) return;
    this.pulse += delta;
    const actor = this.sprites.get(d.playerId);
    if (!actor) return;
    const pr = 16 + Math.sin(this.pulse / 160) * 3;
    g.lineStyle(2.5, 0xf3d99b, 0.9).strokeCircle(actor.x, actor.y, pr);
    d.options.forEach((o, i) => {
      const tag = this.decoTags[i];
      if (!tag) return;
      const color = FAMILY_COLOR[o.family];
      const target = o.targetId ? this.sprites.get(o.targetId) : undefined;
      let tx: number;
      let ty: number;
      const usePoint = o.point && (!target || o.kind === 'through' || o.kind === 'carry' || o.kind === 'corner-edge');
      if (usePoint) {
        tx = px(o.point!.x);
        ty = py(o.point!.y);
      } else if (target) {
        tx = target.x;
        ty = target.y;
      } else {
        tx = actor.x;
        ty = actor.y;
      }
      const focused = this.focus === o.id;
      const dim = this.focus !== null && !focused;
      const self = Math.hypot(tx - actor.x, ty - actor.y) < 6;
      if (self) {
        // Acción sin destino (aguantar): etiqueta encima del jugador.
        tx = actor.x + (i - 1.5) * 26;
        ty = actor.y - 34;
      } else {
        g.lineStyle(focused ? 3.5 : 2.2, color, dim ? 0.25 : 0.9);
        this.dashed(g, actor.x, actor.y, tx, ty, this.pulse / 25);
        if (o.family === 'pass' && target && usePoint) {
          // Pase al espacio: también se marca al receptor.
          g.lineStyle(1.5, color, dim ? 0.2 : 0.6).strokeCircle(target.x, target.y, 14);
        }
      }
      if (focused) g.fillStyle(color, 0.22).fillCircle(tx, ty, 20);
      tag.bg.setPosition(tx, ty).setAlpha(dim ? 0.4 : 1).setScale(focused ? 1.25 : 1);
      tag.text.setPosition(tx, ty).setAlpha(dim ? 0.4 : 1).setScale(focused ? 1.25 : 1);
    });
  }

  private drawPitch() {
    const g = this.add.graphics().setDepth(0);
    // Césped con franjas
    g.fillStyle(0x0c2b1e, 1).fillRect(0, 0, W, H);
    const stripes = 14;
    const sw = (PITCH.length * SCALE) / stripes;
    for (let i = 0; i < stripes; i++) {
      g.fillStyle(i % 2 ? 0x134a32 : 0x11422d, 1).fillRect(MARGIN + i * sw, MARGIN, sw, PITCH.width * SCALE);
    }
    // Viñeta
    const v = this.add.graphics().setDepth(1);
    v.fillStyle(0x000000, 0.22).fillRect(0, 0, W, MARGIN).fillRect(0, H - MARGIN, W, MARGIN);
    // Líneas
    g.lineStyle(2, 0xffffff, 0.55);
    g.strokeRect(px(0), py(0), PITCH.length * SCALE, PITCH.width * SCALE);
    g.lineBetween(px(PITCH.length / 2), py(0), px(PITCH.length / 2), py(PITCH.width));
    g.strokeCircle(px(PITCH.length / 2), py(PITCH.width / 2), 9.15 * SCALE);
    g.fillStyle(0xffffff, 0.7).fillCircle(px(PITCH.length / 2), py(PITCH.width / 2), 2.5);
    for (const side of [0, 1]) {
      const x0 = side ? PITCH.length - 16.5 : 0;
      g.strokeRect(px(x0), py(PITCH.width / 2 - 20.16), 16.5 * SCALE, 40.32 * SCALE);
      const x1 = side ? PITCH.length - 5.5 : 0;
      g.strokeRect(px(x1), py(PITCH.width / 2 - 9.16), 5.5 * SCALE, 18.32 * SCALE);
      const spot = side ? PITCH.length - 11 : 11;
      g.fillCircle(px(spot), py(PITCH.width / 2), 2.2);
      // Porterías
      const gx = side ? px(PITCH.length) : px(0) - 2 * SCALE;
      g.fillStyle(0xffffff, 0.12).fillRect(gx, py(PITCH.width / 2 - PITCH.goalWidth / 2), 2 * SCALE, PITCH.goalWidth * SCALE);
      g.lineStyle(2.5, 0xffffff, 0.85).strokeRect(gx, py(PITCH.width / 2 - PITCH.goalWidth / 2), 2 * SCALE, PITCH.goalWidth * SCALE);
      g.lineStyle(2, 0xffffff, 0.55);
      g.fillStyle(0xffffff, 0.7);
    }
  }

  private ensureSprite(p: MatchSnapshot['players'][number]): Sprite {
    let s = this.sprites.get(p.id);
    if (s) return s;
    const palette = p.side === 'home' ? this.opts.home : this.opts.away;
    const isGK = p.position === 'GK';
    const fill = isGK ? (p.side === 'home' ? 0x2fbf71 : 0xf08c2e) : hex(palette.primary);
    const ring = this.add.circle(0, 0, 15, 0x000000, 0).setStrokeStyle(2.5, 0xf3d99b, 1).setVisible(false);
    const shadow = this.add.ellipse(1.5, 7, 20, 8, 0x000000, 0.35);
    const body = this.add.circle(0, 0, 10.5, fill).setStrokeStyle(2, hex(palette.secondary), 1);
    const num = this.add
      .text(0, 0.5, String(p.number), {
        fontFamily: 'Barlow Condensed, Arial Narrow, sans-serif',
        fontSize: '12px',
        fontStyle: '800',
        color: isGK ? '#0b0c0f' : textOn(palette.primary),
      })
      .setOrigin(0.5);
    const label = this.add
      .text(0, 17, p.name.toUpperCase(), {
        fontFamily: 'Barlow Condensed, Arial Narrow, sans-serif',
        fontSize: '11px',
        fontStyle: '700',
        color: '#f4efe4',
        backgroundColor: 'rgba(6,7,9,0.72)',
        padding: { x: 4, y: 1 },
      })
      .setOrigin(0.5, 0)
      .setVisible(false);
    const stamina = this.add.rectangle(-8, -16, 16, 2.5, 0x39d98a).setOrigin(0, 0.5).setVisible(p.side === this.opts.userSide);
    const container = this.add.container(px(p.x), py(p.y), [shadow, ring, body, num, label, stamina]).setDepth(10);
    if (p.side === this.opts.userSide && this.opts.onPlayerClick) {
      body.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.opts.onPlayerClick?.(p.id));
    }
    s = { container, body, ring, label, stamina, side: p.side, x: px(p.x), y: py(p.y) };
    this.sprites.set(p.id, s);
    return s;
  }

  override update(_time: number, delta: number) {
    const snap = this.latest;
    if (!snap) return;
    const k = 1 - Math.exp(-delta / 55);

    // Teletransportes (saque inicial) sin interpolación
    const kickoff = snap.phase === 'kickoff' && this.lastPhase !== 'kickoff';
    if (snap.phase === 'goal' && this.lastPhase !== 'goal') {
      this.goalFlash.setAlpha(0.35);
      this.tweens.add({ targets: this.goalFlash, alpha: 0, duration: 900, ease: 'Cubic.easeOut' });
      this.cameras.main.shake(260, 0.004);
    }
    this.lastPhase = snap.phase;

    const ownerId = snap.ball.ownerId;
    for (const p of snap.players) {
      const s = this.ensureSprite(p);
      const tx = px(p.x);
      const ty = py(p.y);
      const jump = Math.hypot(tx - s.x, ty - s.y) > 80;
      s.x = kickoff || jump ? tx : s.x + (tx - s.x) * k;
      s.y = kickoff || jump ? ty : s.y + (ty - s.y) * k;
      s.container.setPosition(s.x, s.y);
      const isSel = p.id === this.selected;
      s.ring.setVisible(isSel);
      const involved = !!this.decision && (this.decision.playerId === p.id || this.decision.options.some((o) => o.targetId === p.id));
      s.label.setVisible(isSel || p.id === ownerId || involved);
      s.container.setDepth(isSel ? 20 : p.id === ownerId ? 15 : 10);
      s.container.setAlpha(p.stunned > 0 ? 0.65 : 1);
      if (s.stamina.visible) {
        s.stamina.width = 16 * p.stamina;
        s.stamina.fillColor = p.stamina > 0.6 ? 0x39d98a : p.stamina > 0.4 ? 0xf5c443 : 0xef4f55;
      }
    }

    // Balón: altura visual en pases largos y disparos (sólo estética)
    const tbx = px(snap.ball.x);
    const tby = py(snap.ball.y);
    const fast = Math.hypot(tbx - this.bx, tby - this.by) > 60 || kickoff;
    this.bx = fast ? tbx : this.bx + (tbx - this.bx) * Math.min(1, k * 1.6);
    this.by = fast ? tby : this.by + (tby - this.by) * Math.min(1, k * 1.6);
    let lift = 0;
    const f = snap.ball.flight;
    if (f) {
      const t = Math.min(1, Math.max(0, (snap.time - f.start) / f.duration));
      const dist = Math.hypot(f.toX - f.fromX, f.toY - f.fromY);
      const h = f.lofted ? Math.min(16, 4 + dist * 0.32) : f.kind === 'shot' ? Math.min(4, dist * 0.1) : 0;
      lift = 4 * h * t * (1 - t);
    }
    this.ballShadow.setPosition(this.bx + lift * 0.6, this.by + 3 + lift * 0.3).setScale(1 - Math.min(0.4, lift / 30));
    this.ball.setPosition(this.bx, this.by - lift).setScale(1 + lift / 40);

    const owner = ownerId ? this.sprites.get(ownerId) : null;
    this.ownerMarker.setVisible(!!owner && !this.decision);
    if (owner) this.ownerMarker.setPosition(owner.x - 5, owner.y - 26);
    this.drawDecision(delta);
  }
}

export function createMatchView(opts: MatchViewOptions): MatchView {
  const scene = new MatchScene(opts);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: opts.parent,
    width: W,
    height: H,
    backgroundColor: '#0b0d11',
    transparent: false,
    antialias: true,
    banner: false,
    audio: { noAudio: true },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene,
  });
  return {
    update: (s) => scene.setSnapshot(s),
    setSelected: (id) => scene.setSelected(id),
    spotlight: (id) => scene.spotlight(id),
    setDecision: (d, focus) => scene.setDecision(d, focus ?? null),
    destroy: () => game.destroy(true),
  };
}
