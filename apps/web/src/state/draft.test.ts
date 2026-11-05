import { describe, expect, it } from 'vitest';
import { createRng } from '@fu/shared';
import { getFormation, POSITION_LINE, positionFit } from '@fu/domain';
import { catalog } from '../data/catalog';
import {
  applyUserResult,
  chooseCaptain,
  chooseFormation,
  draftChemistry,
  draftComplete,
  emptyDraft,
  ensureOptions,
  groupTable,
  nextUserFixture,
  pickPlayer,
  rankedNations,
  slotOptions,
  startDraft,
  startTournament,
  USER_DRAFT,
  type DraftState,
} from './draft';

function drafted(): DraftState {
  let d = startDraft(emptyDraft());
  expect(d.captainOptions.length).toBe(5);
  d = chooseCaptain(d, d.captainOptions[0]);
  expect(d.formationOptions.length).toBe(5);
  d = chooseFormation(d, d.formationOptions[0]);
  for (let i = 0; i < 11; i++) {
    d = ensureOptions(d, i);
    if (d.slots[i]) continue;
    const opts = d.options[i];
    expect(opts.length).toBeGreaterThanOrEqual(4);
    d = pickPlayer(d, i, opts[opts.length - 1]);
  }
  expect(draftComplete(d)).toBe(true);
  return d;
}

describe('Draft', () => {
  it('las opciones encajan en la posición y están equilibradas (no siempre las mejores)', () => {
    const rng = createRng(5);
    const ratings: number[] = [];
    for (let i = 0; i < 60; i++) {
      for (const pos of ['GK', 'CB', 'CM', 'ST', 'LWB'] as const) {
        const opts = slotOptions(rng, pos, new Set());
        expect(new Set(opts.map((id) => catalog.versions.get(id)!.playerId)).size).toBe(opts.length);
        expect(opts.filter((id) => catalog.versions.get(id)!.rating >= 90).length).toBeLessThanOrEqual(1);
        for (const id of opts) {
          const v = catalog.versions.get(id)!;
          expect(positionFit(v.position, v.altPositions, pos)).not.toBe('poor');
          if (pos === 'GK') expect(POSITION_LINE[v.position]).toBe('goalkeeper');
          ratings.push(v.rating);
        }
      }
    }
    const elite = ratings.filter((r) => r >= 90).length / ratings.length;
    const mid = ratings.filter((r) => r >= 80 && r <= 88).length / ratings.length;
    expect(elite).toBeLessThan(0.12);
    expect(mid).toBeGreaterThan(0.5);
  });

  it('el capitán ocupa su posición y no se repiten futbolistas', () => {
    const d = drafted();
    const players = d.slots.map((id) => catalog.versions.get(id!)!.playerId);
    expect(new Set(players).size).toBe(11);
    const f = getFormation(d.formationId!);
    const ci = d.slots.indexOf(d.captain);
    const cv = catalog.versions.get(d.captain!)!;
    expect(positionFit(cv.position, cv.altPositions, f.slots[ci].position)).not.toBe('poor');
    expect(draftChemistry(d.formationId!, d.slots).rating).toBeGreaterThan(70);
  });

  it('Mundial de 32: grupos de 4, octavos y campeón; estadísticas propias', () => {
    expect(rankedNations().length).toBeGreaterThanOrEqual(31);
    let d = startTournament(drafted(), 'Mi Draft');
    expect(d.teams.length).toBe(32);
    expect(d.groups.every((g) => g.length === 4)).toBe(true);
    expect(d.fixtures.filter((f) => f.stage === 'group').length).toBe(48);
    // Gana todos sus partidos
    for (let i = 0; i < 7 && d.status === 'running'; i++) {
      const fx = nextUserFixture(d)!;
      d = applyUserResult(d, 2, 0, { lines: [{ key: `${USER_DRAFT}|x`, name: 'Goleador', teamId: USER_DRAFT, goals: 2, assists: 0, cleanSheets: 0 }] });
      if (fx.stage === 'group' && fx.round === 2) {
        expect(d.fixtures.filter((f) => f.stage === 'group').every((f) => f.result)).toBe(true);
        expect(d.fixtures.filter((f) => f.stage === 'r16').length).toBe(8);
      }
    }
    expect(d.status).toBe('won');
    expect(d.champion).toBe(USER_DRAFT);
    expect(d.prize).toBeGreaterThan(10000);
    expect(groupTable(d, d.groups.findIndex((g) => g.includes(USER_DRAFT)))[0].id).toBe(USER_DRAFT);
    expect(Object.values(d.players).some((p) => p.teamId !== USER_DRAFT && p.goals > 0)).toBe(true);
  });

  it('si cae en grupos, el torneo se completa sin él', () => {
    let d = startTournament(drafted(), 'Mi Draft');
    for (let i = 0; i < 3; i++) d = applyUserResult(d, 0, 3, { lines: [] });
    expect(d.status).toBe('eliminated');
    expect(d.champion).toBeTruthy();
    expect(d.fixtures.find((f) => f.stage === 'final')?.winner).toBe(d.champion);
    expect(d.reached).toBe('group');
  });
});
