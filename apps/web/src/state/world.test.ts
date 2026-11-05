import { describe, expect, it } from 'vitest';
import { catalog } from '../data/catalog';
import { addUserPerf, closeWeek, emptyWorld, inFormEligible, roundPairs } from './world';
import { createSeason, LEAGUE_ROUNDS, leagueTable, matchContext, playRound, USER_TEAM, userFixture } from './league';

describe('Equipo de la Semana', () => {
  it('cada jornada empareja a todos sin repetir equipo', () => {
    const teams = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    for (let r = 0; r < 12; r++) {
      const ids = roundPairs(teams, r).flat();
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.length).toBe(6);
    }
  });

  it('publica un once variado de cartas base y añade a tus jugadores destacados', () => {
    const base = [...catalog.versions.values()].find((v) => inFormEligible(v.id) && v.position === 'ST')!;
    let w = addUserPerf(emptyWorld(), [{ cardId: 'c1', versionId: base.id, score: 9.8, goals: 3, assists: 1 }], 'Rival', '4-1');
    const { world, qualified } = closeWeek(w);
    expect(world.totw.length).toBe(11);
    expect(world.totw.every((e) => catalog.versions.get(e.ifId)?.event === 'totw')).toBe(true);
    expect(qualified.map((q) => q.cardId)).toContain('c1');
    const clubs = new Map<string, number>();
    for (const e of world.totw.filter((x) => !x.cardId)) clubs.set(e.clubId, (clubs.get(e.clubId) ?? 0) + 1);
    expect(Math.max(...clubs.values())).toBeLessThanOrEqual(2);
    // Semanas distintas → equipos distintos
    w = world;
    const next = closeWeek(w).world;
    const same = next.totw.filter((e) => world.totw.some((x) => x.versionId === e.versionId)).length;
    expect(same).toBeLessThan(8);
    expect(Object.keys(world.tables).length).toBeGreaterThan(5);
  });

  it('los Iconos y los Históricos no tienen versión En Forma', () => {
    for (const v of catalog.versions.values()) {
      if (v.event !== 'totw') continue;
      const p = catalog.players.get(v.playerId)!;
      expect(p.icon || p.hero).toBeFalsy();
    }
  });
});

describe('Liga', () => {
  it('temporada completa de 7 jornadas con clasificación, goleadores y ascensos', () => {
    let s = createSeason(8, 'mix', 1, 'Mi Club');
    expect(s.teams.length).toBe(8);
    expect(s.fixtures.length).toBe(28);
    for (let r = 0; r < LEAGUE_ROUNDS; r++) expect(userFixture(s, r)).toBeTruthy();
    expect(matchContext(s)?.notes.length).toBeGreaterThan(0);
    let ended;
    for (let r = 0; r < LEAGUE_ROUNDS; r++) {
      s = { ...s, plan: { training: 'attack', press: 'confident' } };
      const out = playRound(s, 3, 0, ['Goleador', 'Goleador', 'Otro'], 'Mi Club');
      if (r < LEAGUE_ROUNDS - 1) {
        const t = leagueTable(out.season);
        expect(t.find((x) => x.id === USER_TEAM)!.pts).toBe((r + 1) * 3);
        expect(out.season.morale).toBeGreaterThan(0);
      }
      s = out.season;
      ended = out.ended;
    }
    expect(ended?.position).toBe(1);
    expect(ended?.outcome).toBe('promoted');
    expect(ended?.level).toBe(7);
    expect(ended?.topScorer?.name).toBeTruthy();
    expect(s.round).toBe(0);
    expect(s.level).toBe(7);
  });
});
