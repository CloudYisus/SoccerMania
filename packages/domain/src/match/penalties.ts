import type { Rng } from '@fu/shared';

/**
 * Tanda de penaltis (5 lanzamientos + muerte súbita).
 * La probabilidad de marcar depende del tiro del lanzador frente al portero.
 */
export function penaltyShootout(
  rng: Rng,
  home: { shooting: number[]; keeper: number },
  away: { shooting: number[]; keeper: number },
): { home: number; away: number } {
  const p = (sho: number, gk: number) => Math.min(0.92, Math.max(0.55, 0.76 + (sho - gk) / 200));
  let h = 0;
  let a = 0;
  for (let i = 0; i < 5; i++) {
    if (rng.chance(p(home.shooting[i % home.shooting.length], away.keeper))) h++;
    if (h > a + (5 - i)) break;
    if (rng.chance(p(away.shooting[i % away.shooting.length], home.keeper))) a++;
    if (a > h + (4 - i) || h > a + (4 - i)) break;
  }
  let round = 5;
  while (h === a && round < 30) {
    const hs = rng.chance(p(home.shooting[round % home.shooting.length], away.keeper));
    const as = rng.chance(p(away.shooting[round % away.shooting.length], home.keeper));
    if (hs) h++;
    if (as) a++;
    round++;
  }
  if (h === a) h++;
  return { home: h, away: a };
}
