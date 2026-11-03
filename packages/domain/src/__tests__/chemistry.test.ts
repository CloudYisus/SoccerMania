import { describe, expect, it } from 'vitest';
import { calculateChemistry, evaluateLink, type ChemPlayer } from '../chemistry/chemistry';
import { DEFAULT_CHEMISTRY_CONFIG } from '../chemistry/config';
import { FORMATIONS, getFormation } from '../squad/formations';
import type { Position } from '../players/types';

const p = (over: Partial<ChemPlayer> = {}): ChemPlayer => ({
  playerId: Math.random().toString(36),
  clubId: 'club-a',
  leagueId: 'league-a',
  nationCode: 'es',
  position: 'CM',
  altPositions: [],
  isIcon: false,
  loyal: false,
  ...over,
});

describe('enlaces clásicos', () => {
  it('mismo club (y liga) → verde', () => {
    expect(evaluateLink(p({ nationCode: 'br' }), p({ nationCode: 'fr' })).strength).toBe('strong');
  });
  it('misma liga y nación → verde', () => {
    expect(evaluateLink(p({ clubId: 'x' }), p({ clubId: 'y' })).strength).toBe('strong');
  });
  it('sólo liga → amarillo', () => {
    expect(evaluateLink(p({ clubId: 'x', nationCode: 'br' }), p({ clubId: 'y', nationCode: 'fr' })).strength).toBe('medium');
  });
  it('sólo nación → amarillo', () => {
    expect(evaluateLink(p({ clubId: 'x', leagueId: 'l1' }), p({ clubId: 'y', leagueId: 'l2' })).strength).toBe('medium');
  });
  it('nada en común → rojo', () => {
    const a = p({ clubId: 'x', leagueId: 'l1', nationCode: 'br' });
    const b = p({ clubId: 'y', leagueId: 'l2', nationCode: 'fr' });
    expect(evaluateLink(a, b).strength).toBe('weak');
  });
  it('Icono: fuerte con su nación y medio con el resto', () => {
    const icon = p({ isIcon: true, clubId: 'x', leagueId: 'l1', nationCode: 'br' });
    expect(evaluateLink(icon, p({ clubId: 'y', leagueId: 'l2', nationCode: 'br' })).strength).toBe('strong');
    expect(evaluateLink(icon, p({ clubId: 'y', leagueId: 'l2', nationCode: 'fr' })).strength).toBe('medium');
  });
  it('los umbrales son configurables', () => {
    const cfg = { ...DEFAULT_CHEMISTRY_CONFIG, thresholds: { strong: 3, medium: 2 } };
    expect(evaluateLink(p({ clubId: 'x' }), p({ clubId: 'y' }), cfg).strength).toBe('medium');
  });
});

const sumIndividual = (r: ReturnType<typeof calculateChemistry>) => r.players.reduce((a, x) => a + (x?.value ?? 0), 0);

function fullSquad(formationId: keyof typeof FORMATIONS, make: (pos: Position, i: number) => ChemPlayer) {
  return getFormation(formationId).slots.map((s) => make(s.position, s.index));
}

describe('química de plantilla', () => {
  it('once del mismo club en posición natural → 100 y todas las líneas verdes', () => {
    const f = getFormation('4-3-3');
    const r = calculateChemistry(f, fullSquad('4-3-3', (pos) => p({ position: pos })));
    expect(r.team).toBe(100);
    expect(r.links.every((l) => l.strength === 'strong')).toBe(true);
    expect(r.players.every((x) => x?.value === 10)).toBe(true);
  });

  it('jugadores fuera de posición pierden química', () => {
    const f = getFormation('4-3-3');
    const slots = fullSquad('4-3-3', (pos) => p({ position: pos }));
    slots[9] = p({ position: 'CB' }); // central como delantero
    const r = calculateChemistry(f, slots);
    expect(r.players[9]!.fit).toBe('poor');
    expect(r.players[9]!.value).toBeLessThan(5);
    // La química total se limita a 100 (11 × 10 = 110), así que se compara la suma individual.
    expect(sumIndividual(r)).toBeLessThan(110);
  });

  it('posición relacionada da química intermedia', () => {
    const f = getFormation('4-3-3');
    const slots = fullSquad('4-3-3', (pos) => p({ position: pos }));
    slots[6] = p({ position: 'CDM' }); // MCD en MC
    const r = calculateChemistry(f, slots);
    expect(r.players[6]!.fit).toBe('related');
    expect(r.players[6]!.value).toBe(7);
  });

  it('cambiar a un jugador recalcula los enlaces afectados', () => {
    const f = getFormation('4-3-3');
    const slots = fullSquad('4-3-3', (pos) => p({ position: pos }));
    const before = calculateChemistry(f, slots);
    slots[9] = p({ position: 'ST', clubId: 'z', leagueId: 'lz', nationCode: 'jp' });
    const after = calculateChemistry(f, slots);
    const stLinks = after.links.filter((l) => l.a === 9 || l.b === 9);
    expect(stLinks.length).toBeGreaterThan(0);
    expect(stLinks.every((l) => l.strength === 'weak')).toBe(true);
    expect(sumIndividual(after)).toBeLessThan(sumIndividual(before));
  });

  it('cambiar la formación cambia el grafo de enlaces', () => {
    const slots = fullSquad('4-3-3', (pos) => p({ position: pos }));
    const a = calculateChemistry(getFormation('4-3-3'), slots);
    const b = calculateChemistry(getFormation('4-4-2'), slots);
    expect(a.links.length).not.toBe(b.links.length);
  });

  it('lealtad y mánager suman hasta el máximo de 10', () => {
    const f = getFormation('4-3-3');
    const slots = fullSquad('4-3-3', (pos, i) =>
      p({ position: pos, clubId: `c${i}`, leagueId: `l${i}`, nationCode: `n${i}`, loyal: true }),
    );
    const r = calculateChemistry(f, slots, { nationCode: 'n0', leagueId: 'none' });
    expect(r.players[0]!.base).toBe(3); // todo rojo, posición natural
    expect(r.players[0]!.value).toBe(5); // +1 lealtad +1 mánager
    expect(r.players[1]!.value).toBe(4); // sólo lealtad
  });

  it('los huecos vacíos no generan enlaces y penalizan', () => {
    const f = getFormation('4-3-3');
    const slots: (ChemPlayer | null)[] = fullSquad('4-3-3', (pos) => p({ position: pos }));
    slots[2] = null;
    const r = calculateChemistry(f, slots);
    expect(r.players[2]).toBeNull();
    expect(r.links.filter((l) => l.a === 2 || l.b === 2).every((l) => l.strength === null)).toBe(true);
    expect(r.players[0]!.value).toBeLessThan(10);
  });
});
