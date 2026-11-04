import { describe, expect, it } from 'vitest';
import { CURRENT_YEAR, versionType } from '@fu/domain';
import { allVersions, catalog } from '../data/catalog';
import { clubTeam, REAL_CLUBS } from './teams';
import { createCup, emptyCup } from './cup';
import { mixTeam, TOURNAMENTS } from './tournaments';
import { EMPTY_FILTERS, matches, searchMarket } from './marketSearch';

const BIG5 = ['eng-premier', 'esp-laliga', 'ita-serie-a', 'ger-bundesliga', 'fra-ligue-1'];

describe('catálogo ampliado', () => {
  it('incluye todos los clubes de las 5 grandes ligas con plantilla jugable', () => {
    const expected = { 'eng-premier': 20, 'esp-laliga': 20, 'ita-serie-a': 20, 'ger-bundesliga': 18, 'fra-ligue-1': 18 };
    for (const [league, n] of Object.entries(expected)) {
      expect(REAL_CLUBS.filter((c) => c.leagueId === league).length, league).toBe(n);
    }
    expect(REAL_CLUBS.filter((c) => !BIG5.includes(c.leagueId)).length).toBeGreaterThan(20);
  });

  it('cada evento de Equipo del Año tiene 15 cartas especiales', () => {
    for (const ev of catalog.events.values()) {
      const n = allVersions.filter((v) => v.event === ev.id).length;
      if (ev.kind === 'toty') expect(n, ev.id).toBe(15);
      else expect(n).toBeGreaterThan(5);
    }
    const messi = allVersions.find((v) => v.event === 'toty-2012' && catalog.players.get(v.playerId)!.knownAs === 'Messi')!;
    expect(messi.year).toBe(2012);
    expect(versionType(messi)).toBe('event');
  });

  it('las cartas de la temporada actual son las base; las demás muestran su año', () => {
    const base = allVersions.filter((v) => versionType(v) === 'base');
    expect(base.every((v) => v.year >= CURRENT_YEAR && !v.event)).toBe(true);
    expect(allVersions.some((v) => versionType(v) === 'season')).toBe(true);
  });
});

describe('equipos reales y torneos', () => {
  it('cada club real forma un once válido con su formación y estilo', () => {
    for (const c of REAL_CLUBS) {
      const t = clubTeam(c.id);
      expect(t.versionIds).toHaveLength(11);
      expect(new Set(t.versionIds.map((id) => catalog.versions.get(id)!.playerId)).size, c.id).toBe(11);
      const own = t.versionIds.filter((id) => catalog.versions.get(id)!.clubId === c.id).length;
      expect(own, c.id).toBeGreaterThanOrEqual(10);
      expect(t.tactics.style).toBeDefined();
    }
  });

  it('todos los torneos se pueden sortear con rivales reales y mixtos', () => {
    for (const def of TOURNAMENTS) {
      for (const mode of def.modes) {
        const cup = createCup(emptyCup(0, 0, def.id, mode), 'Mi Club', mode);
        expect(cup.teams, `${def.id}-${mode}`).toHaveLength(8);
        expect(new Set(cup.teams.map((t) => t.id)).size).toBe(8);
      }
    }
    const m = mixTeam('inglaterra', 1, 0);
    expect(new Set(m.versionIds.map((id) => catalog.versions.get(id)!.playerId)).size).toBe(11);
  });
});

describe('buscador del mercado', () => {
  it('filtra por tipo, nombre, liga, nación y posición', () => {
    const icons = allVersions.filter((v) => matches(v, { ...EMPTY_FILTERS, type: 'icon' }));
    expect(icons.every((v) => catalog.players.get(v.playerId)!.icon)).toBe(true);
    const messi = allVersions.filter((v) => matches(v, { ...EMPTY_FILTERS, name: 'messi' }));
    expect(messi.length).toBeGreaterThanOrEqual(3);
    const spGk = allVersions.filter((v) => matches(v, { ...EMPTY_FILTERS, league: 'esp-laliga', nation: 'es', position: 'GK', type: 'base' }));
    expect(spGk.length).toBeGreaterThan(5);
    expect(spGk.every((v) => v.position === 'GK' && v.nationCode === 'es')).toBe(true);
  });

  it('una búsqueda devuelve ofertas de las cartas que coinciden y respeta el precio máximo', () => {
    const r = searchMarket({ ...EMPTY_FILTERS, league: 'eng-premier', maxPrice: 20000 }, 7);
    expect(r.matched).toBeGreaterThan(100);
    expect(r.listings.length).toBeGreaterThan(0);
    expect(r.listings.every((l) => l.price <= 20000)).toBe(true);
    const one = searchMarket({ ...EMPTY_FILTERS, name: 'Lamine Yamal', type: 'toty' }, 3);
    expect(one.listings.length).toBe(1);
  });
});
