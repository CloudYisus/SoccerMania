import Phaser from 'phaser';
import { PITCH, type DecisionFamily, type DecisionPrompt, type MatchSnapshot, type RenderFrame, type TeamSide } from '@fu/domain';

/**
 * MATCH RENDERER (Phaser 3)
 * Representa el partido. No toma decisiones de juego.
 *
 * Rendimiento:
 *  - Un único bucle: la escena pide cada fotograma a `onFrame(dtMs)` (que avanza
 *    el motor) y dibuja el `RenderFrame` interpolado entre ticks → movimiento
 *    fluido a la frecuencia de la pantalla (60/120/144 Hz), también a cámara lenta.
 *  - Los metadatos (energía, selección) llegan aparte y con menos frecuencia.
 *  - Las fichas se componen una vez (texturas circulares de bandera cacheadas).
 */
export interface TeamPalette {
  primary: string;
  secondary: string;
}

/** Identidad visual de cada jugador (su carta): bandera, color de edición, Icono. */
export interface PlayerToken {
  /** Imagen de la bandera ya cargada (la precarga quien crea la vista). */
  flagImage?: HTMLImageElement | null;
  flagKey?: string;
  /** Color de acento de la edición de su carta. */
  edition?: string;
  icon?: boolean;
  /** Nombre corto para la etiqueta. */
  short: string;
  rating?: number;
}

export interface MatchViewOptions {
  parent: HTMLElement;
  home: TeamPalette;
  away: TeamPalette;
  /** Lado controlado por el usuario (para resaltar y permitir seleccionar). */
  userSide: TeamSide;
  tokens?: Record<string, PlayerToken>;
  /** Llamada en cada fotograma: avanza la simulación y devuelve qué dibujar. */
  onFrame: (deltaMs: number) => RenderFrame | null;
  onPlayerClick?: (playerId: string) => void;
}

export type EffectKind = 'dribble' | 'skill' | 'tackle' | 'save' | 'goal' | 'post' | 'foul' | 'card' | 'interception';

export interface MatchView {
  /** Metadatos (energía, nombres…): basta con unas pocas veces por segundo. */
  update(snapshot: MatchSnapshot): void;
  setSelected(playerId: string | null): void;
  /** Resalta a un jugador (jugada destacada): anillos que se expanden. */
  spotlight(playerId: string): void;
  /** Dibuja las opciones de una decisión pendiente (null para ocultarlas). */
  setDecision(decision: DecisionPrompt | null, focusOptionId?: string | null): void;
  /** Efecto visual de un acontecimiento sobre un jugador o sobre el balón. */
  effect(kind: EffectKind, playerId?: string): void;
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

/** Contraste de texto sobre un color. */
function textOn(color: string) {
  const c = Phaser.Display.Color.HexStringToColor(color);
  return (c.red * 299 + c.green * 587 + c.blue * 114) / 1000 > 150 ? '#0b0c0f' : '#ffffff';
}

const TOKEN_R = 14; // radio del anillo del equipo
const TOK_PX = 84; // tamaño de la textura de la ficha (2× para nitidez)
const FLAG_R = 8.6; // radio de la bandera
const FLAG_TEX = 48; // resolución de la textura circular

interface Sprite {
  container: Phaser.GameObjects.Container;
  hit: Phaser.GameObjects.Arc;
  ring: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  tag: Phaser.GameObjects.Text;
  stamina: Phaser.GameObjects.Rectangle;
  side: TeamSide;
  x: number;
  y: number;
  labelOn: boolean;
}

class MatchScene extends Phaser.Scene {
  private sprites = new Map<string, Sprite>();
  private spriteList: (Sprite | undefined)[] = [];
  private ball!: Phaser.GameObjects.Arc;
  private ballShadow!: Phaser.GameObjects.Ellipse;
  private ownerMarker!: Phaser.GameObjects.Triangle;
  private selected: string | null = null;
  private lastPhase: string | null = null;
  private goalFlash!: Phaser.GameObjects.Rectangle;
  private decision: DecisionPrompt | null = null;
  private involved = new Set<string>();
  private focus: string | null = null;
  private decoG!: Phaser.GameObjects.Graphics;
  private decoTags: { id: string; bg: Phaser.GameObjects.Arc; text: Phaser.GameObjects.Text }[] = [];
  private pulse = 0;
  private meta: MatchSnapshot | null = null;
  private ready = false;
  private trail: { x: number; y: number }[] = [];
  private trailG!: Phaser.GameObjects.Graphics;
  private trailColor = 0xffffff;
  private ballXY = { x: 0, y: 0 };

  constructor(
    private opts: MatchViewOptions,
    private dpr = 1,
  ) {
    super('match');
  }

  setMeta(s: MatchSnapshot) {
    this.meta = s;
    if (!this.ready) return;
    for (const p of s.players) {
      const sp = this.ensureSprite(p.id, p.side, p.position === 'GK', p.number, p.name);
      if (sp.stamina.visible) {
        sp.stamina.width = 16 * p.stamina;
        sp.stamina.fillColor = p.stamina > 0.6 ? 0x39d98a : p.stamina > 0.4 ? 0xf5c443 : 0xef4f55;
      }
    }
  }
  setSelected(id: string | null) {
    this.selected = id;
  }
  spotlight(id: string) {
    const s = this.sprites.get(id);
    if (!s || !this.ready) return;
    for (let i = 0; i < 3; i++) {
      const ring = this.add.circle(0, 0, 14, 0x000000, 0).setStrokeStyle(3, 0xf3d99b, 1).setDepth(19);
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
  /** Efectos de acontecimientos (todos con tweens cortos que se autodestruyen). */
  effect(kind: EffectKind, playerId?: string) {
    if (!this.ready) return;
    const s = playerId ? this.sprites.get(playerId) : undefined;
    const x = s ? s.x : this.ballXY.x;
    const y = s ? s.y : this.ballXY.y;
    const ring = (color: number, r0: number, r1: number, dur: number, width = 3) => {
      const c = this.add.circle(x, y, r0, 0, 0).setStrokeStyle(width, color, 1).setDepth(36);
      this.tweens.add({ targets: c, radius: r1, alpha: 0, duration: dur, ease: 'Cubic.easeOut', onComplete: () => c.destroy() });
    };
    const burst = (color: number, n: number, dist: number, size = 2.5, dur = 500) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
        const d = this.add.circle(x, y, size, color, 1).setDepth(37);
        this.tweens.add({ targets: d, x: x + Math.cos(a) * dist, y: y + Math.sin(a) * dist, alpha: 0, scale: 0.4, duration: dur, ease: 'Cubic.easeOut', onComplete: () => d.destroy() });
      }
    };
    const popText = (text: string, color: string, bg: string) => {
      const t = this.add
        .text(x, y - 26, text, { fontFamily: 'Barlow Condensed, Arial Narrow, sans-serif', fontSize: '14px', fontStyle: '800', color, backgroundColor: bg, padding: { x: 5, y: 2 }, resolution: this.dpr })
        .setOrigin(0.5)
        .setDepth(45)
        .setScale(0.4);
      this.tweens.add({ targets: t, scale: 1, y: y - 40, duration: 260, ease: 'Back.easeOut' });
      this.tweens.add({ targets: t, alpha: 0, delay: 1100, duration: 400, onComplete: () => t.destroy() });
    };
    switch (kind) {
      case 'dribble': {
        // Estela curva alrededor del regateador.
        const g = this.add.graphics().setDepth(35);
        g.lineStyle(3, 0xf3d99b, 0.9);
        g.beginPath();
        g.arc(x, y, 20, -0.4, Math.PI * 0.9, false);
        g.strokePath();
        this.tweens.add({ targets: g, alpha: 0, angle: 140, duration: 520, ease: 'Cubic.easeOut', onComplete: () => g.destroy() });
        break;
      }
      case 'skill': {
        ring(0xf3d99b, 10, 42, 650, 3.5);
        burst(0xfff1c4, 10, 34, 2.4, 650);
        popText('¡FILIGRANA!', '#1a1204', '#f3d99b');
        break;
      }
      case 'tackle':
        burst(0xd8e6dc, 8, 18, 2.2, 380);
        ring(0xffffff, 6, 22, 360, 2);
        break;
      case 'interception':
        ring(0x6cc4ff, 6, 24, 420, 2.5);
        break;
      case 'save':
        ring(0x9fd2ff, 8, 34, 520, 3.5);
        burst(0xffffff, 8, 26, 2.2, 450);
        popText('¡PARADA!', '#06121f', '#9fd2ff');
        break;
      case 'post':
        ring(0xffffff, 4, 40, 520, 4);
        burst(0xffffff, 12, 30, 2, 500);
        this.cameras.main.shake(160, 0.003);
        popText('¡PALO!', '#0b0c0f', '#ffffff');
        break;
      case 'foul':
        popText('FALTA', '#ffffff', 'rgba(20,20,24,0.92)');
        ring(0xffd38a, 6, 24, 420, 2.5);
        break;
      case 'card': {
        const c = this.add.rectangle(x + 10, y - 30, 11, 15, 0xffe14d).setStrokeStyle(1.5, 0x5a4a00).setDepth(46).setAngle(-12).setScale(0.2);
        this.tweens.add({ targets: c, scale: 1.4, angle: 8, duration: 280, ease: 'Back.easeOut' });
        this.tweens.add({ targets: c, alpha: 0, y: y - 44, delay: 1300, duration: 500, onComplete: () => c.destroy() });
        break;
      }
      case 'goal': {
        // Onda en la red y confeti dorado.
        for (let i = 0; i < 3; i++) {
          const c = this.add.circle(x, y, 6, 0, 0).setStrokeStyle(3, 0xffffff, 0.9).setDepth(36);
          this.tweens.add({ targets: c, radius: 60, alpha: 0, delay: i * 140, duration: 700, ease: 'Cubic.easeOut', onComplete: () => c.destroy() });
        }
        const colors = [0xf3d99b, 0xffffff, 0x39d98a, 0x6cc4ff, 0xff6b6b];
        for (let i = 0; i < 40; i++) {
          const d = this.add.rectangle(x, y, 3, 6, colors[i % colors.length]).setDepth(38).setAngle(Math.random() * 360);
          const a = Math.random() * Math.PI * 2;
          const dist = 30 + Math.random() * 110;
          this.tweens.add({
            targets: d,
            x: x + Math.cos(a) * dist,
            y: y + Math.sin(a) * dist + 40,
            angle: d.angle + 360,
            alpha: 0,
            duration: 1200 + Math.random() * 600,
            ease: 'Cubic.easeOut',
            onComplete: () => d.destroy(),
          });
        }
        break;
      }
    }
  }

  setDecision(d: DecisionPrompt | null, focus: string | null) {
    this.focus = focus;
    // Antes de create() la escena aún no puede crear objetos: se aplica al arrancar.
    if (!this.ready) {
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
          .text(0, 0, String(i + 1), { fontFamily: 'Barlow Condensed, Arial Narrow, sans-serif',
        resolution: this.dpr, fontSize: '14px', fontStyle: '800', color: '#ffffff' })
          .setOrigin(0.5)
          .setDepth(42);
        this.decoTags.push({ id: o.id, bg, text });
      });
    }
    this.decision = d;
    this.involved.clear();
    if (d) {
      this.involved.add(d.playerId);
      for (const o of d.options) if (o.targetId) this.involved.add(o.targetId);
    }
  }

  create() {
    this.cameras.main.setZoom(this.dpr).centerOn(W / 2, H / 2);
    this.drawPitch();
    this.buildFlagTextures();
    this.ballShadow = this.add.ellipse(0, 0, 9, 5, 0x000000, 0.4).setDepth(5);
    this.ball = this.add.circle(0, 0, 4.6, 0xffffff).setStrokeStyle(1.2, 0x111111).setDepth(30);
    this.ownerMarker = this.add.triangle(0, 0, 0, 0, 10, 0, 5, 7, 0xf3d99b).setDepth(31).setVisible(false);
    this.goalFlash = this.add.rectangle(W / 2, H / 2, W, H, 0xf3d99b, 0).setDepth(50);
    this.decoG = this.add.graphics().setDepth(40);
    this.trailG = this.add.graphics().setDepth(29);
    this.ready = true;
    if (this.meta) this.setMeta(this.meta);
    if (this.decision) {
      const d = this.decision;
      this.decision = null;
      this.setDecision(d, this.focus);
    }
  }

  /** Banderas recortadas en círculo una sola vez por nación. */
  private buildFlagTextures() {
    for (const t of Object.values(this.opts.tokens ?? {})) {
      if (!t.flagKey || !t.flagImage || !t.flagImage.naturalWidth) continue;
      const key = `flagc:${t.flagKey}`;
      if (this.textures.exists(key)) continue;
      const img = t.flagImage;
      const tex = this.textures.createCanvas(key, FLAG_TEX, FLAG_TEX);
      if (!tex) continue;
      const ctx = tex.getContext();
      ctx.save();
      ctx.beginPath();
      ctx.arc(FLAG_TEX / 2, FLAG_TEX / 2, FLAG_TEX / 2, 0, Math.PI * 2);
      ctx.clip();
      const h = FLAG_TEX;
      const w = (img.naturalWidth / img.naturalHeight) * h;
      ctx.drawImage(img, (FLAG_TEX - w) / 2, 0, w, h);
      // Brillo sutil para dar volumen.
      const g = ctx.createRadialGradient(FLAG_TEX * 0.35, FLAG_TEX * 0.3, 2, FLAG_TEX / 2, FLAG_TEX / 2, FLAG_TEX / 2);
      g.addColorStop(0, 'rgba(255,255,255,0.28)');
      g.addColorStop(0.6, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, FLAG_TEX, FLAG_TEX);
      ctx.restore();
      tex.refresh();
    }
  }

  /** El campo se dibuja una vez en una textura (no se re-tesela en cada fotograma). */
  private tokenTexture(id: string, token: PlayerToken | undefined, kitHex: string, secondary: string, number: number) {
    const key = `tok:${id}`;
    if (this.textures.exists(key)) return key;
    const tex = this.textures.createCanvas(key, TOK_PX, TOK_PX)!;
    const ctx = tex.getContext();
    const k = 2; // escala
    const c = TOK_PX / 2;
    const circle = (r: number, fill: string) => {
      ctx.beginPath();
      ctx.arc(c, c, r * k, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
    };
    // Sombra
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath();
    ctx.ellipse(c + 1.5 * k, c + 8 * k, 11 * k, 4 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Filete de la edición (fino) + borde oscuro
    if (token?.edition) circle(TOKEN_R + 1.6, token.edition);
    circle(TOKEN_R + 0.5, '#0b0c0f');
    // Anillo grueso del equipo
    circle(TOKEN_R, kitHex);
    ctx.lineWidth = 1.2 * k;
    ctx.strokeStyle = secondary;
    ctx.beginPath();
    ctx.arc(c, c, (TOKEN_R - 0.6) * k, 0, Math.PI * 2);
    ctx.stroke();
    const flag = token?.flagKey ? this.textures.exists(`flagc:${token.flagKey}`) : false;
    if (flag) {
      const img = this.textures.get(`flagc:${token!.flagKey}`).getSourceImage() as HTMLCanvasElement;
      circle(FLAG_R + 0.8, '#0b0c0f');
      ctx.drawImage(img, c - FLAG_R * k, c - FLAG_R * k, FLAG_R * 2 * k, FLAG_R * 2 * k);
      // Dorsal en una chapa
      const bx = c + 9.5 * k;
      const by = c + 9 * k;
      ctx.beginPath();
      ctx.arc(bx, by, 5.8 * k, 0, Math.PI * 2);
      ctx.fillStyle = kitHex;
      ctx.fill();
      ctx.lineWidth = 1 * k;
      ctx.strokeStyle = '#0b0c0f';
      ctx.stroke();
      ctx.fillStyle = textOn(kitHex);
      ctx.font = `800 ${8.5 * k}px "Barlow Condensed", "Arial Narrow", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(number), bx, by + 0.4 * k);
    } else {
      ctx.fillStyle = textOn(kitHex);
      ctx.font = `800 ${12 * k}px "Barlow Condensed", "Arial Narrow", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(number), c, c + 0.5 * k);
    }
    if (token?.icon) {
      // Estrella dorada de Icono
      const sx = c - 9.5 * k;
      const sy = c - 9 * k;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = (i % 2 ? 2.4 : 5.6) * k;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fillStyle = '#f3d99b';
      ctx.fill();
      ctx.lineWidth = 1 * k;
      ctx.strokeStyle = '#6b4a14';
      ctx.stroke();
    }
    tex.refresh();
    return key;
  }

  private drawPitch() {
    const g = this.make.graphics({}, false);
    g.fillStyle(0x0c2b1e, 1).fillRect(0, 0, W, H);
    const stripes = 14;
    const sw = (PITCH.length * SCALE) / stripes;
    for (let i = 0; i < stripes; i++) {
      g.fillStyle(i % 2 ? 0x134a32 : 0x11422d, 1).fillRect(MARGIN + i * sw, MARGIN, sw, PITCH.width * SCALE);
    }
    g.fillStyle(0x000000, 0.22).fillRect(0, 0, W, MARGIN).fillRect(0, H - MARGIN, W, MARGIN);
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
      const gx = side ? px(PITCH.length) : px(0) - 2 * SCALE;
      g.fillStyle(0xffffff, 0.12).fillRect(gx, py(PITCH.width / 2 - PITCH.goalWidth / 2), 2 * SCALE, PITCH.goalWidth * SCALE);
      g.lineStyle(2.5, 0xffffff, 0.85).strokeRect(gx, py(PITCH.width / 2 - PITCH.goalWidth / 2), 2 * SCALE, PITCH.goalWidth * SCALE);
      g.lineStyle(2, 0xffffff, 0.55);
      g.fillStyle(0xffffff, 0.7);
    }
    g.generateTexture('pitch', W, H);
    g.destroy();
    this.add.image(0, 0, 'pitch').setOrigin(0, 0).setDepth(0);
  }

  /**
   * Ficha del jugador: su carta en miniatura.
   * - Centro: bandera de su nación (como el fondo de su carta).
   * - Anillo grueso: color del equipo (portero, color propio).
   * - Filete exterior: color de la edición de su carta.
   * - Dorsal en una chapa; estrella dorada si es Icono; nombre siempre visible.
   */
  private ensureSprite(id: string, side: TeamSide, isGK: boolean, number: number, name: string): Sprite {
    let s = this.sprites.get(id);
    if (s) return s;
    const palette = side === 'home' ? this.opts.home : this.opts.away;
    const token = this.opts.tokens?.[id];
    const kitHex = isGK ? (side === 'home' ? '#2fbf71' : '#f08c2e') : palette.primary;
    const items: Phaser.GameObjects.GameObject[] = [];

    const ring = this.add.circle(0, 0, 18, 0x000000, 0).setStrokeStyle(2.5, 0xf3d99b, 1).setVisible(false);
    items.push(ring);
    // Ficha pre-renderizada en una sola textura: sombra, filete de edición, anillo
    // del equipo, bandera, dorsal y estrella de Icono → una imagen por jugador.
    items.push(this.add.image(0, 1, this.tokenTexture(id, token, kitHex, palette.secondary, number)).setDisplaySize(TOK_PX / 2, TOK_PX / 2));
    const hit = this.add.circle(0, 0, TOKEN_R + 1, 0x000000, 0.001);
    items.push(hit);
    const short = (token?.short ?? name).toUpperCase();
    const tag = this.add
      .text(0, TOKEN_R + 3, short, {
        fontFamily: 'Barlow Condensed, Arial Narrow, sans-serif',
        resolution: this.dpr,
        fontSize: '9px',
        fontStyle: '700',
        color: '#f4efe4',
      })
      .setOrigin(0.5, 0)
      .setAlpha(0.72)
      .setShadow(0, 1, 'rgba(0,0,0,0.9)', 2);
    items.push(tag);
    const label = this.add
      .text(0, TOKEN_R + 3, short, {
        fontFamily: 'Barlow Condensed, Arial Narrow, sans-serif',
        resolution: this.dpr,
        fontSize: '11px',
        fontStyle: '700',
        color: '#f4efe4',
        backgroundColor: 'rgba(6,7,9,0.8)',
        padding: { x: 4, y: 1 },
      })
      .setOrigin(0.5, 0)
      .setVisible(false);
    items.push(label);
    const stamina = this.add.rectangle(-8, -TOKEN_R - 5, 16, 2.5, 0x39d98a).setOrigin(0, 0.5).setVisible(side === this.opts.userSide);
    items.push(stamina);
    const container = this.add.container(0, 0, items).setDepth(10);
    if (side === this.opts.userSide && this.opts.onPlayerClick) {
      hit.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.opts.onPlayerClick?.(id));
    }
    s = { container, hit, ring, label, tag, stamina, side, x: 0, y: 0, labelOn: false };
    this.sprites.set(id, s);
    return s;
  }

  override update(_time: number, delta: number) {
    if (!this.ready) return;
    const frame = this.opts.onFrame(delta);
    if (!frame) return;

    if (frame.phase === 'goal' && this.lastPhase !== 'goal') {
      this.goalFlash.setAlpha(0.35);
      this.tweens.add({ targets: this.goalFlash, alpha: 0, duration: 900, ease: 'Cubic.easeOut' });
      this.cameras.main.shake(260, 0.004);
    }
    this.lastPhase = frame.phase;

    const ownerId = frame.ownerId;
    const meta = this.meta;
    for (let i = 0; i < frame.players.length; i++) {
      const p = frame.players[i];
      let s = this.spriteList[i];
      if (!s) {
        const m = meta?.players[i];
        if (!m) continue;
        s = this.spriteList[i] = this.ensureSprite(m.id, m.side, m.position === 'GK', m.number, m.name);
      }
      s.x = px(p.x);
      s.y = py(p.y);
      s.container.setPosition(s.x, s.y);
      const isSel = p.id === this.selected;
      s.ring.setVisible(isSel);
      const big = isSel || p.id === ownerId || this.involved.has(p.id);
      if (big !== s.labelOn) {
        s.labelOn = big;
        s.label.setVisible(big);
        s.tag.setVisible(!big);
      }
      s.container.setDepth(isSel ? 20 : p.id === ownerId ? 15 : 10);
      s.container.setAlpha(p.stunned && !p.dive ? 0.62 : 1);
      // Estirada: la ficha se alarga en la dirección del salto.
      if (p.dive) s.container.setScale(1.35, 0.78);
      else if (s.container.scaleX !== 1) s.container.setScale(1);
    }

    // Balón: altura visual en pases largos y disparos (sólo estética)
    const bx = px(frame.ball.x);
    const by = py(frame.ball.y);
    let lift = 0;
    const f = frame.flight;
    if (f) {
      const t = Math.min(1, Math.max(0, (frame.time - f.start) / f.duration));
      const dist = Math.hypot(f.toX - f.fromX, f.toY - f.fromY);
      const h = f.lofted ? Math.min(16, 4 + dist * 0.32) : f.kind === 'shot' ? Math.min(4, dist * 0.1) : 0;
      lift = 4 * h * t * (1 - t);
    }
    this.ballShadow.setPosition(bx + lift * 0.6, by + 3 + lift * 0.3).setScale(1 - Math.min(0.4, lift / 30));
    this.ball.setPosition(bx, by - lift).setScale(1 + lift / 40);
    this.ballXY.x = bx;
    this.ballXY.y = by;
    // Estela del balón en disparos y envíos largos.
    const tg = this.trailG;
    if (f && (f.kind === 'shot' || f.lofted)) {
      this.trailColor = f.kind === 'shot' ? 0xf3d99b : 0xffffff;
      this.trail.push({ x: bx, y: by - lift });
      if (this.trail.length > 14) this.trail.shift();
    } else if (this.trail.length) {
      this.trail.shift();
    }
    tg.clear();
    for (let i = 1; i < this.trail.length; i++) {
      const a = this.trail[i - 1];
      const b = this.trail[i];
      tg.lineStyle(1 + (i / this.trail.length) * 4, this.trailColor, (i / this.trail.length) * 0.55);
      tg.lineBetween(a.x, a.y, b.x, b.y);
    }

    const owner = ownerId ? this.sprites.get(ownerId) : null;
    this.ownerMarker.setVisible(!!owner && !this.decision);
    if (owner) this.ownerMarker.setPosition(owner.x - 5, owner.y - TOKEN_R - 16);
    this.drawDecision(delta);
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
    const d = this.decision;
    if (!d) {
      if (this.pulse !== 0) {
        g.clear();
        this.pulse = 0;
      }
      return;
    }
    g.clear();
    this.pulse += delta;
    const actor = this.sprites.get(d.playerId);
    if (!actor) return;
    const pr = 18 + Math.sin(this.pulse / 160) * 3;
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
        tx = actor.x + (i - 1.5) * 26;
        ty = actor.y - 36;
      } else {
        g.lineStyle(focused ? 3.5 : 2.2, color, dim ? 0.25 : 0.9);
        this.dashed(g, actor.x, actor.y, tx, ty, this.pulse / 25);
        if (o.family === 'pass' && target && usePoint) g.lineStyle(1.5, color, dim ? 0.2 : 0.6).strokeCircle(target.x, target.y, 16);
      }
      if (focused) g.fillStyle(color, 0.22).fillCircle(tx, ty, 20);
      tag.bg.setPosition(tx, ty).setAlpha(dim ? 0.4 : 1).setScale(focused ? 1.25 : 1);
      tag.text.setPosition(tx, ty).setAlpha(dim ? 0.4 : 1).setScale(focused ? 1.25 : 1);
    });
  }
}

export function createMatchView(opts: MatchViewOptions): MatchView {
  // Resolución nativa en pantallas Retina (máx. 2×): el lienzo se dibuja al
  // doble y la cámara amplía, así las fichas y los textos se ven nítidos.
  const dpr = typeof window !== 'undefined' ? Math.min(2, Math.max(1, Math.round(window.devicePixelRatio || 1))) : 1;
  const scene = new MatchScene(opts, dpr);
  const game = new Phaser.Game({
    // Escena 2D ligera (imágenes y texto): Canvas 2D rinde más y con menos variación
    // que WebGL en portátiles y en GPU integradas. `?webgl` en la URL fuerza WebGL.
    type: typeof location !== "undefined" && location.search.includes("webgl") ? Phaser.WEBGL : Phaser.CANVAS,
    parent: opts.parent,
    width: W * dpr,
    height: H * dpr,
    backgroundColor: '#0b0d11',
    transparent: false,
    antialias: true,
    banner: false,
    audio: { noAudio: true },
    // Sin límite: se dibuja a la frecuencia de refresco de la pantalla.
    fps: { smoothStep: false },
    render: { powerPreference: 'high-performance', antialias: true, roundPixels: false },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene,
  });
  return {
    update: (s) => scene.setMeta(s),
    setSelected: (id) => scene.setSelected(id),
    spotlight: (id) => scene.spotlight(id),
    setDecision: (d, focus) => scene.setDecision(d, focus ?? null),
    effect: (kind, id) => scene.effect(kind, id),
    destroy: () => game.destroy(true),
  };
}
