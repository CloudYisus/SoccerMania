import { describe, expect, it } from 'vitest';
import { MatchEngine } from '../match/engine';
import { PITCH } from '../match/types';
import { syntheticTeam } from './helpers';

describe('match engine', () => {
  it('es determinista con la misma semilla', () => {
    const run = () => {
      const e = new MatchEngine(syntheticTeam('h', 80), syntheticTeam('a', 80), 7);
      e.simulateToEnd();
      return e.getSnapshot();
    };
    const a = run();
    const b = run();
    expect(a.score).toEqual(b.score);
    expect(a.stats).toEqual(b.stats);
  });

  it('completa los 90 minutos con eventos coherentes', () => {
    const e = new MatchEngine(syntheticTeam('h', 82), syntheticTeam('a', 80), 3);
    e.simulateToEnd();
    const s = e.getSnapshot();
    expect(s.phase).toBe('fulltime');
    expect(s.minute).toBe(90);
    const types = new Set(e.events.map((x) => x.type));
    for (const t of ['kickoff', 'pass', 'shot', 'halftime', 'fulltime']) expect(types.has(t as never)).toBe(true);
    const goals = e.events.filter((x) => x.type === 'goal');
    expect(goals.filter((g) => g.side === 'home').length).toBe(s.score.home);
    expect(goals.filter((g) => g.side === 'away').length).toBe(s.score.away);
    expect(s.stats.home.passesCompleted).toBeLessThanOrEqual(s.stats.home.passes);
    expect(s.stats.home.shotsOnTarget).toBeLessThanOrEqual(s.stats.home.shots);
  });

  it('los jugadores permanecen en el terreno de juego', () => {
    const e = new MatchEngine(syntheticTeam('h', 80), syntheticTeam('a', 80), 11);
    for (let i = 0; i < 1500; i++) {
      e.step(0.1);
      for (const p of e.getSnapshot().players) {
        expect(p.x).toBeGreaterThanOrEqual(-2);
        expect(p.x).toBeLessThanOrEqual(PITCH.length + 2);
        expect(p.y).toBeGreaterThanOrEqual(-2);
        expect(p.y).toBeLessThanOrEqual(PITCH.width + 2);
      }
    }
  });

  it('un equipo claramente superior gana más a menudo, pero no siempre arrasa', () => {
    let strong = 0;
    let weak = 0;
    let goalsStrong = 0;
    let goalsWeak = 0;
    for (let seed = 1; seed <= 16; seed++) {
      const e = new MatchEngine(syntheticTeam('h', 86), syntheticTeam('a', 74), seed);
      e.simulateToEnd();
      const { home, away } = e.getSnapshot().score;
      goalsStrong += home;
      goalsWeak += away;
      if (home > away) strong++;
      if (away > home) weak++;
    }
    expect(strong).toBeGreaterThan(weak);
    expect(goalsStrong).toBeGreaterThan(goalsWeak);
    expect(goalsWeak).toBeGreaterThan(0);
  });

  it('la química baja reduce el rendimiento', () => {
    let high = 0;
    let low = 0;
    for (let seed = 1; seed <= 16; seed++) {
      const e = new MatchEngine(syntheticTeam('h', 82, '4-3-3', 10), syntheticTeam('a', 82, '4-3-3', 0), seed);
      e.simulateToEnd();
      const s = e.getSnapshot().score;
      high += s.home;
      low += s.away;
    }
    expect(high).toBeGreaterThan(low);
  });

  it('acepta instrucciones individuales durante el partido', () => {
    const e = new MatchEngine(syntheticTeam('h', 80), syntheticTeam('a', 80), 5);
    e.step(5);
    e.setInstruction('h-9', 'makeRuns');
    expect(e.getSnapshot().players.find((p) => p.id === 'h-9')!.instruction).toBe('makeRuns');
    expect(e.drainEvents().some((x) => x.type === 'instruction')).toBe(true);
  });
});
