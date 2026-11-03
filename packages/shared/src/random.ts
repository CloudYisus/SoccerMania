/**
 * Generador pseudoaleatorio determinista (mulberry32).
 * Toda la lógica de juego (sobres, mercado, simulación) usa RNG con semilla
 * para que los resultados sean reproducibles y testeables.
 */
export interface Rng {
  /** Número en [0, 1). */
  next(): number;
  /** Entero en [min, max] (ambos incluidos). */
  int(min: number, max: number): number;
  /** Número en [min, max). */
  range(min: number, max: number): number;
  /** true con probabilidad p. */
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** Selección ponderada; los pesos <= 0 se ignoran. */
  weighted<T>(items: readonly T[], weight: (item: T) => number): T;
  /** Distribución normal aproximada (Box–Muller). */
  gaussian(mean?: number, stdDev?: number): number;
  /** Estado interno, útil para persistir. */
  state(): number;
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    range: (min, max) => next() * (max - min) + min,
    chance: (p) => next() < p,
    pick: (items) => {
      if (items.length === 0) throw new Error('pick() sobre una lista vacía');
      return items[Math.floor(next() * items.length)];
    },
    weighted: (items, weight) => {
      let total = 0;
      for (const it of items) total += Math.max(0, weight(it));
      if (total <= 0) throw new Error('weighted() sin pesos positivos');
      let r = next() * total;
      for (const it of items) {
        const w = Math.max(0, weight(it));
        if (r < w) return it;
        r -= w;
      }
      return items[items.length - 1];
    },
    gaussian: (mean = 0, stdDev = 1) => {
      const u = Math.max(next(), 1e-9);
      const v = next();
      return mean + stdDev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    state: () => s,
  };
  return rng;
}

/** Hash FNV-1a de 32 bits para derivar semillas desde cadenas. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
