export const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export interface Vec2 {
  x: number;
  y: number;
}
export const vec = (x: number, y: number): Vec2 => ({ x, y });
export const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s });
export const len = (a: Vec2) => Math.hypot(a.x, a.y);
export const norm = (a: Vec2): Vec2 => {
  const l = Math.hypot(a.x, a.y);
  return l < 1e-9 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
};
/** Distancia de un punto p al segmento ab y parámetro t de la proyección. */
export function pointSegment(p: Vec2, a: Vec2, b: Vec2): { d: number; t: number } {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const l2 = abx * abx + aby * aby;
  const t = l2 === 0 ? 0 : clamp(((p.x - a.x) * abx + (p.y - a.y) * aby) / l2, 0, 1);
  return { d: Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t)), t };
}
