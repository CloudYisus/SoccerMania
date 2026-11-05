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

describe('variedad de jugadas y avisos', () => {
  const play = (h: ReturnType<typeof syntheticTeam>, a: ReturnType<typeof syntheticTeam>, seed: number) => {
    const e = new MatchEngine(h, a, seed);
    e.simulateToEnd();
    return e;
  };

  it('produce jugadas destacadas de muchos tipos', () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 24; seed++) {
      for (const ev of play(syntheticTeam('h', 84), syntheticTeam('a', 82), seed).events) if (ev.highlight) kinds.add(ev.highlight.kind);
    }
    for (const k of ['goal', 'throughball', 'longball', 'longshot', 'skillrun', 'oneonone', 'freekick', 'penalty', 'header', 'woodwork', 'bigsave', 'card'])
      expect(kinds.has(k), k).toBe(true);
  });

  it('los goles llevan aviso y, a veces, asistencia', () => {
    let goals = 0;
    let assists = 0;
    for (let seed = 1; seed <= 10; seed++) {
      for (const ev of play(syntheticTeam('h', 84), syntheticTeam('a', 80), seed).events) {
        if (ev.type !== 'goal') continue;
        goals++;
        expect(ev.highlight?.kind).toBe('goal');
        if (ev.otherId) assists++;
      }
    }
    expect(goals).toBeGreaterThan(0);
    expect(assists).toBeGreaterThan(0);
  });

  it('la instrucción "Desmarcarse" multiplica los desmarques', () => {
    const count = (instr: 'makeRuns' | 'holdPosition') => {
      let runs = 0;
      for (let seed = 1; seed <= 6; seed++) {
        const h = syntheticTeam('h', 82);
        h.players.forEach((p) => p.position !== 'GK' && (p.instruction = instr));
        runs += play(h, syntheticTeam('a', 82), seed).events.filter((e) => e.type === 'run' && e.side === 'home').length;
      }
      return runs;
    };
    expect(count('makeRuns')).toBeGreaterThan(count('holdPosition') * 2);
  });

  it('"Buscar disparos" provoca más disparos lejanos que "Conservar el balón"', () => {
    const count = (instr: 'shootOnSight' | 'keepPossession') => {
      let n = 0;
      for (let seed = 1; seed <= 8; seed++) {
        const h = syntheticTeam('h', 84);
        h.players.forEach((p) => p.position !== 'GK' && (p.instruction = instr));
        n += play(h, syntheticTeam('a', 82), seed).events.filter((e) => e.type === 'shot' && e.side === 'home' && e.text.includes('lejano')).length;
      }
      return n;
    };
    expect(count('shootOnSight')).toBeGreaterThan(count('keepPossession'));
  });

  it('las faltas en el área son penalti y fuera generan tiros libres', () => {
    let penalties = 0;
    let freeKicks = 0;
    for (let seed = 1; seed <= 16; seed++) {
      const e = play(syntheticTeam('h', 82), syntheticTeam('a', 82), seed);
      penalties += e.events.filter((x) => x.highlight?.kind === 'penalty').length;
      freeKicks += e.events.filter((x) => x.type === 'out' && x.text.startsWith('Tiro libre')).length;
      expect(e.getSnapshot().stats.home.fouls + e.getSnapshot().stats.away.fouls).toBeGreaterThan(0);
    }
    expect(penalties).toBeGreaterThan(0);
    expect(freeKicks).toBeGreaterThan(0);
  });
});

describe('goleadores variados', () => {
  it('también marcan centrocampistas y defensas (córners, llegadas, rechaces)', async () => {
    const { POSITION_LINE } = await import('../players/positions');
    const lines: Record<string, number> = {};
    for (let seed = 1; seed <= 24; seed++) {
      const h = syntheticTeam('h', 82);
      const a = syntheticTeam('a', 82);
      const e = new MatchEngine(h, a, seed);
      e.simulateToEnd();
      const pos = new Map([...h.players, ...a.players].map((p) => [p.id, p.position]));
      for (const ev of e.events) if (ev.type === 'goal') lines[POSITION_LINE[pos.get(ev.playerId!)!]] = (lines[POSITION_LINE[pos.get(ev.playerId!)!]] ?? 0) + 1;
    }
    const total = Object.values(lines).reduce((x, y) => x + y, 0);
    expect(lines.midfield ?? 0).toBeGreaterThan(0);
    expect(lines.defence ?? 0).toBeGreaterThan(0);
    expect((lines.attack ?? 0) / total).toBeLessThan(0.9);
  });
});

describe('mejor jugador del partido', () => {
  it('asigna notas a los 22 jugadores y premia a goleadores y porteros', async () => {
    const { matchRatings } = await import('../match/ratings');
    const h = syntheticTeam('h', 84);
    const a = syntheticTeam('a', 80);
    const e = new MatchEngine(h, a, 5);
    e.simulateToEnd();
    const s = e.getSnapshot();
    const r = matchRatings(e.events, { home: h, away: a }, s.score);
    expect(r).toHaveLength(22);
    for (const x of r) {
      expect(x.rating).toBeGreaterThanOrEqual(3);
      expect(x.rating).toBeLessThanOrEqual(10);
    }
    const scorer = r.find((x) => x.goals > 0);
    const quiet = r.filter((x) => x.goals === 0 && x.assists === 0 && x.saves === 0);
    if (scorer) expect(scorer.rating).toBeGreaterThan(quiet[quiet.length - 1].rating);
    expect(r[0].rating).toBe(Math.max(...r.map((x) => x.rating)));
  });
});

describe('crónica del partido', () => {
  it('cuenta los goles con su contexto y titular', async () => {
    const { matchStory } = await import('../match/story');
    const { matchRatings } = await import('../match/ratings');
    const home = syntheticTeam('h', 84);
    const away = syntheticTeam('a', 78);
    const e = new MatchEngine(home, away, 21);
    e.simulateToEnd();
    const s = e.getSnapshot();
    const goals = e.events.filter((x) => x.type === 'goal');
    expect(goals.every((g) => g.story !== undefined)).toBe(true);
    const story = matchStory(e.events, { home, away }, s.score, matchRatings(e.events, { home, away }, s.score));
    expect(story.headline.length).toBeGreaterThan(3);
    expect(story.moments.length).toBeLessThanOrEqual(5);
    if (goals.length) expect(story.moments.some((m) => m.title.includes('GOL') || m.icon === 'hattrick' || m.icon === 'comeback')).toBe(true);
  });

  it('las lesiones son poco frecuentes', () => {
    let injuries = 0;
    for (let seed = 0; seed < 40; seed++) {
      const e = new MatchEngine(syntheticTeam('h', 80), syntheticTeam('a', 80), seed);
      e.simulateToEnd();
      const inj = e.events.filter((x) => x.type === 'injury');
      for (const i of inj) expect(i.injuryMatches).toBeGreaterThanOrEqual(1);
      injuries += inj.length;
    }
    expect(injuries / 40).toBeLessThan(0.35);
  }, 30000);
});
