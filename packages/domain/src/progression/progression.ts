/** Progresión del manager: niveles por experiencia. */
export function xpForLevel(level: number): number {
  return Math.round(400 * Math.pow(level, 1.35));
}

export interface Progress {
  level: number;
  xp: number;
}

export function addXp(p: Progress, amount: number): { progress: Progress; levelsGained: number } {
  let { level, xp } = p;
  xp += amount;
  let gained = 0;
  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level++;
    gained++;
  }
  return { progress: { level, xp }, levelsGained: gained };
}

export interface MatchReward {
  coins: number;
  xp: number;
}

export function matchReward(goalsFor: number, goalsAgainst: number, difficulty: number): MatchReward {
  const outcome = goalsFor > goalsAgainst ? 'win' : goalsFor === goalsAgainst ? 'draw' : 'loss';
  const base = outcome === 'win' ? 900 : outcome === 'draw' ? 450 : 200;
  const coins = Math.round((base + goalsFor * 60) * (0.8 + difficulty * 0.1));
  const xp = outcome === 'win' ? 300 : outcome === 'draw' ? 180 : 100;
  return { coins, xp };
}
