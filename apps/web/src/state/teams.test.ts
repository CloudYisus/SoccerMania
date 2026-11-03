import { describe, expect, it } from 'vitest';
import { createCard, getFormation } from '@fu/domain';
import { catalog, STARTER } from '../data/catalog';
import { aiToMatchSetup, buildOpponent, cupOpponent, divisionOpponent, QUICK_OPPONENTS, userToMatchSetup } from './teams';
import { computeSquadView } from './squadView';
import { CHALLENGES } from './challenges';

const uniquePlayers = (ids: string[]) => new Set(ids.map((id) => catalog.versions.get(id)!.playerId)).size;

describe('rivales IA', () => {
  it('todos los rivales rápidos y de copa tienen 11 futbolistas distintos', () => {
    for (const t of [...QUICK_OPPONENTS.map(buildOpponent), cupOpponent(0), cupOpponent(1), cupOpponent(2)]) {
      expect(t.versionIds).toHaveLength(11);
      expect(uniquePlayers(t.versionIds), t.id).toBe(11);
      expect(aiToMatchSetup(t).players).toHaveLength(11);
    }
  });
  it('todas las jornadas de todas las divisiones generan un once válido y más fuerte en divisiones altas', () => {
    for (let level = 1; level <= 10; level++)
      for (let g = 0; g < 7; g++) {
        const t = divisionOpponent(level, g);
        expect(uniquePlayers(t.versionIds), `${level}-${g}`).toBe(11);
      }
    expect(divisionOpponent(1, 0).rating).toBeGreaterThan(divisionOpponent(10, 0).rating);
  });
});

describe('club inicial', () => {
  const cards = Object.fromEntries(
    [...STARTER.lineup, ...STARTER.bench].map((v, i) => [`c${i}`, createCard(`c${i}`, v, 'starter', 0)]),
  );
  const squad = {
    name: 'T',
    formationId: STARTER.formationId,
    starters: STARTER.lineup.map((_, i) => `c${i}`),
    bench: STARTER.bench.map((_, i) => `c${i + 11}`),
    managerId: STARTER.managerId,
    tactics: { mentality: 'balanced' as const, pressing: 50, width: 50, depth: 50, tempo: 50 },
    instructions: {},
  };
  const view = computeSquadView(squad, cards);

  it('deja margen de mejora en química (los desafíos no se completan solos)', () => {
    expect(view.complete).toBe(true);
    expect(view.chemistry.team).toBeGreaterThan(40);
    expect(view.chemistry.team).toBeLessThan(90);
    expect(view.formation).toBe(getFormation('4-3-3'));
    const done = CHALLENGES.filter((c) => {
      const p = c.evaluate(view);
      return p.current >= p.target;
    });
    expect(done).toHaveLength(0);
  });

  it('genera la configuración del motor para el equipo del usuario', () => {
    const setup = userToMatchSetup(view, 'Test FC', squad.tactics, {});
    expect(setup.players.map((p) => p.position)).toEqual(getFormation('4-3-3').slots.map((s) => s.position));
  });
});
