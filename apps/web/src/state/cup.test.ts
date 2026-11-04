import { describe, expect, it } from 'vitest';
import { applyResult, createCup, cupPlayerName, emptyCup, leaders, normalizeCup, simulatePending, USER_ID, userFixture } from './cup';

describe('Copa Ultimate', () => {
  it('sortea 8 equipos sin repetir y el usuario juega en cuartos', () => {
    const cup = createCup(emptyCup(), 'Mi Club');
    expect(cup.teams).toHaveLength(8);
    expect(new Set(cup.teams.map((t) => t.id)).size).toBe(8);
    expect(cup.fixtures).toHaveLength(4);
    expect(userFixture(cup)?.round).toBe(0);
  });

  it('avanza ronda a ronda y acumula estadísticas coherentes con los marcadores', () => {
    let cup = createCup(emptyCup(), 'Mi Club');
    for (let round = 0; round < 3; round++) {
      const fx = userFixture(cup)!;
      expect(fx.round).toBe(round);
      const userHome = fx.home === USER_ID;
      // El usuario gana 2-0 (goles sin autor conocido en esta prueba).
      cup = applyResult(cup, fx.id, userHome ? { home: 2, away: 0 } : { home: 0, away: 2 }, { lines: [] });
      cup = simulatePending(cup, cupPlayerName, false);
    }
    expect(cup.champion).toBe(USER_ID);
    expect(cup.fixtures).toHaveLength(7);
    const aiGoals = cup.fixtures
      .filter((f) => f.home !== USER_ID && f.away !== USER_ID)
      .reduce((n, f) => n + f.result!.home + f.result!.away, 0);
    const scored = Object.values(cup.players).reduce((n, p) => n + p.goals, 0);
    expect(scored).toBe(aiGoals);
    const assists = Object.values(cup.players).reduce((n, p) => n + p.assists, 0);
    expect(assists).toBeLessThanOrEqual(scored);
    expect(leaders(cup, 'goals').length).toBeGreaterThan(0);
    // Cada partido sin goles en contra suma una portería a cero.
    const sheets = cup.fixtures.reduce((n, f) => n + (f.result!.away === 0 ? 1 : 0) + (f.result!.home === 0 ? 1 : 0), 0);
    expect(Object.values(cup.players).reduce((n, p) => n + p.cleanSheets, 0)).toBe(sheets - cup.fixtures.filter((f) => f.home === USER_ID || f.away === USER_ID).length);
  });

  it('si el usuario cae, el torneo continúa hasta tener campeón', () => {
    let cup = createCup(emptyCup(), 'Mi Club');
    const fx = userFixture(cup)!;
    cup = applyResult(cup, fx.id, fx.home === USER_ID ? { home: 0, away: 1 } : { home: 1, away: 0 }, { lines: [] });
    cup = simulatePending(cup, cupPlayerName, true);
    expect(cup.champion).toBeDefined();
    expect(cup.champion).not.toBe(USER_ID);
    expect(cup.fixtures.every((f) => f.winner)).toBe(true);
  });

  it('migra partidas antiguas sin cuadro', () => {
    const c = normalizeCup({ status: 'running', titles: 2, round: 1 } as never);
    expect(c.status).toBe('idle');
    expect(c.titles).toBe(2);
    expect(c.fixtures).toEqual([]);
  });
});
