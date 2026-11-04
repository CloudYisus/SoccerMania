import { describe, expect, it } from 'vitest';
import { createRng } from '@fu/shared';
import { MatchEngine } from '../match/engine';
import type { DecisionFrequency, DecisionKind, DecisionPrompt, MatchTeamSetup, PlayStyle } from '../index';
import { syntheticTeam } from './helpers';

/** Juega un partido eligiendo opciones con `pick` en cada decisión. */
function playWithDecisions(
  frequency: DecisionFrequency,
  seed: number,
  pick: (d: DecisionPrompt, rng: ReturnType<typeof createRng>) => string | null,
  home: MatchTeamSetup = syntheticTeam('h', 82),
  away: MatchTeamSetup = syntheticTeam('a', 82),
) {
  const e = new MatchEngine(home, away, seed);
  e.setDecisionMode('home', frequency);
  const rng = createRng(seed * 31);
  const prompts: DecisionPrompt[] = [];
  let guard = 0;
  while (!e.finished && guard++ < 100000) {
    e.step(0.1);
    const d = e.decision;
    if (d && prompts[prompts.length - 1]?.id !== d.id) {
      prompts.push(d);
      const id = pick(d, rng);
      if (id) e.choose(d.id, id);
    }
  }
  return { e, prompts };
}
const randomPick = (d: DecisionPrompt, rng: ReturnType<typeof createRng>) => d.options[rng.int(0, d.options.length - 1)].id;

describe('decisiones del usuario', () => {
  it('sin activar, el partido es 100 % simulado', () => {
    const e = new MatchEngine(syntheticTeam('h', 82), syntheticTeam('a', 82), 4);
    let seen = false;
    while (!e.finished) {
      e.step(0.5);
      if (e.decision) seen = true;
    }
    expect(seen).toBe(false);
    expect(e.getSnapshot().stats.home.decisions).toBe(0);
  });

  it('ofrece entre 2 y 4 opciones contextuales con indicadores coherentes', () => {
    for (let seed = 1; seed <= 4; seed++) {
      const { prompts } = playWithDecisions('medium', seed, randomPick);
      expect(prompts.length).toBeGreaterThan(4);
      for (const d of prompts) {
        expect(d.options.length).toBeGreaterThanOrEqual(2);
        expect(d.options.length).toBeLessThanOrEqual(4);
        expect(new Set(d.options.map((o) => o.id)).size).toBe(d.options.length);
        expect(d.expiresAt).toBeGreaterThan(d.createdAt);
        for (const o of d.options) {
          expect(o.chance).toBeGreaterThanOrEqual(0);
          expect(o.chance).toBeLessThanOrEqual(1);
          expect(o.label.length).toBeGreaterThan(3);
          expect(['low', 'medium', 'high']).toContain(o.risk);
        }
      }
    }
  });

  it('la frecuencia elegida se respeta (pocas < normal < muchas)', () => {
    const count = (f: DecisionFrequency) => {
      let n = 0;
      for (let seed = 1; seed <= 5; seed++) n += playWithDecisions(f, seed, randomPick).prompts.length;
      return n / 5;
    };
    const low = count('low');
    const medium = count('medium');
    const high = count('high');
    expect(low).toBeLessThan(medium);
    expect(medium).toBeLessThan(high);
    expect(low).toBeGreaterThanOrEqual(3);
    expect(high).toBeLessThanOrEqual(30);
  });

  it('cada decisión ejecutada produce un resultado con grado', () => {
    const { e } = playWithDecisions('high', 9, randomPick);
    const results = e.events.filter((x) => x.decision);
    expect(results.length).toBeGreaterThan(5);
    const grades = new Set(results.map((x) => x.decision!.grade));
    expect(grades.has('fail')).toBe(true);
    expect(grades.has('good') || grades.has('great')).toBe(true);
    const s = e.getSnapshot().stats.home;
    expect(s.decisionsWon).toBeLessThanOrEqual(s.decisions);
  });

  it('la acción elegida es la que se ve en el campo', () => {
    let checked = 0;
    for (let seed = 1; seed <= 6 && checked < 6; seed++) {
      const e = new MatchEngine(syntheticTeam('h', 84), syntheticTeam('a', 80), seed);
      e.setDecisionMode('home', 'high');
      let last = 0;
      while (!e.finished && checked < 6) {
        e.step(0.1);
        const d = e.decision;
        if (!d || d.id === last) continue;
        last = d.id;
        const shot = d.options.find((o) => o.family === 'shot' && !o.kind.startsWith('pen'));
        const pass = d.options.find((o) => o.kind === 'pass' || o.kind === 'through');
        const opt = shot ?? pass;
        if (!opt || d.context === 'setpiece') {
          e.skipDecision();
          continue;
        }
        e.drainEvents();
        expect(e.choose(d.id, opt.id)).toBe(true);
        const snap = e.getSnapshot();
        // Inmediatamente después, el balón sale de los pies del jugador hacia su destino.
        expect(snap.ball.flight).not.toBeNull();
        expect(snap.ball.flight!.kickerId).toBe(d.playerId);
        expect(snap.ball.flight!.kind).toBe(opt.family === 'shot' ? 'shot' : 'pass');
        if (opt.targetId && opt.family === 'pass') expect(snap.ball.flight!.outcome === 'complete' ? snap.ball.flight!.targetId : opt.targetId).toBe(opt.targetId);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(3);
  });

  it('elegir siempre opciones probables sale mejor que elegir las improbables', () => {
    const rate = (best: boolean) => {
      let won = 0;
      let total = 0;
      for (let seed = 1; seed <= 6; seed++) {
        const { e } = playWithDecisions('high', seed, (d) => {
          const sorted = [...d.options].filter((o) => o.measure === 'success').sort((a, b) => b.chance - a.chance);
          if (!sorted.length) return null;
          return (best ? sorted[0] : sorted[sorted.length - 1]).id;
        });
        const s = e.getSnapshot().stats.home;
        won += s.decisionsWon;
        total += s.decisions;
      }
      return won / Math.max(1, total);
    };
    expect(rate(true)).toBeGreaterThan(rate(false) + 0.1);
  });

  it('si no se decide a tiempo, decide la IA y el partido continúa', () => {
    const { e, prompts } = playWithDecisions('high', 3, () => null);
    expect(prompts.length).toBeGreaterThan(3);
    expect(e.finished).toBe(true);
    expect(e.getSnapshot().stats.home.decisions).toBe(0);
  });

  it('las cartas desbloquean acciones especiales (atributo alto o Icono)', () => {
    const star = syntheticTeam('h', 90);
    const plain = syntheticTeam('h', 74);
    const kinds = (team: MatchTeamSetup) => {
      const set = new Set<DecisionKind>();
      for (let seed = 1; seed <= 4; seed++) playWithDecisions('high', seed, randomPick, team).prompts.forEach((d) => d.options.forEach((o) => o.trait && set.add(o.kind)));
      return set;
    };
    const starKinds = kinds(star);
    expect(starKinds.size).toBeGreaterThan(0);
    expect(kinds(plain).size).toBeLessThan(starKinds.size);
    // Un Icono con atributos algo menores también accede a ellas.
    const icons = syntheticTeam('h', 83);
    icons.players.forEach((p) => (p.icon = true));
    expect(kinds(icons).size).toBeGreaterThan(0);
  });

  it('es determinista con la misma semilla y las mismas elecciones', () => {
    const run = () => {
      const { e } = playWithDecisions('medium', 11, (d) => d.options[0].id);
      return e.getSnapshot();
    };
    const a = run();
    const b = run();
    expect(a.score).toEqual(b.score);
    expect(a.stats).toEqual(b.stats);
  });
});

describe('estilos de la IA rival', () => {
  const withStyle = (style: PlayStyle, tweak: Partial<MatchTeamSetup['tactics']> = {}) => {
    const t = syntheticTeam('a', 82);
    t.tactics = { ...t.tactics, style, ...tweak };
    return t;
  };
  const sample = (style: PlayStyle, tweak: Partial<MatchTeamSetup['tactics']> = {}) => {
    let crosses = 0;
    let passes = 0;
    let longs = 0;
    let longShots = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const e = new MatchEngine(syntheticTeam('h', 82), withStyle(style, tweak), seed);
      e.simulateToEnd();
      const mine = e.events.filter((x) => x.side === 'away');
      crosses += mine.filter((x) => x.type === 'pass' && x.text.includes('centra')).length;
      longs += mine.filter((x) => x.type === 'pass' && x.text.includes('en largo')).length;
      longShots += mine.filter((x) => x.type === 'shot' && x.text.startsWith('Disparo lejano')).length;
      passes += e.getSnapshot().stats.away.passes;
    }
    return { crosses, passes, longs, longShots };
  };

  it('cada estilo cambia la forma de jugar', () => {
    const balanced = sample('balanced');
    const wings = sample('wings', { width: 85 });
    const possession = sample('possession', { tempo: 38 });
    const direct = sample('direct', { tempo: 74 });
    expect(wings.crosses).toBeGreaterThan(balanced.crosses);
    expect(possession.longs).toBeLessThan(direct.longs);
    expect(direct.longShots).toBeGreaterThan(possession.longShots);
  });
});
