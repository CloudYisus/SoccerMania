import { createRng } from '@fu/shared';
import { marketValue, POSITION_LINE, roundPrice, versionType, type PlayerVersion, type Position } from '@fu/domain';
import { allVersions, catalog } from '../data/catalog';

/**
 * BUSCADOR DEL MERCADO (modelo FUT): el mercado no lista todo el catálogo; el
 * usuario busca con filtros y aparecen las ofertas que vendedores IA tienen
 * publicadas en ese momento para esas cartas.
 */
export type CardTypeFilter = 'all' | 'base' | 'season' | 'icon' | 'toty' | 'promesas';

export interface SearchFilters {
  type: CardTypeFilter;
  name: string;
  league: string;
  club: string;
  nation: string;
  /** Posición concreta ("ST") o línea ("line:defence"). */
  position: string;
  minRating: number;
  maxPrice: number | '';
}

export const EMPTY_FILTERS: SearchFilters = { type: 'all', name: '', league: '', club: '', nation: '', position: '', minRating: 0, maxPrice: '' };

export interface SearchListing {
  id: string;
  versionId: string;
  price: number;
  expiresAt: number;
}

export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ø/g, 'o');

/** Valor de mercado según media y tipo de carta (eventos e Iconos cotizan más). */
export function cardValue(v: PlayerVersion): number {
  const player = catalog.players.get(v.playerId)!;
  const ev = v.event ? catalog.events.get(v.event) : undefined;
  const mult = ev?.kind === 'toty' ? 1.8 : ev ? 1.35 : player.icon ? 1.5 : versionType(v) === 'season' ? 1.15 : 1;
  return roundPrice(marketValue(v.rating) * mult);
}

export function matches(v: PlayerVersion, f: SearchFilters): boolean {
  const player = catalog.players.get(v.playerId)!;
  const club = catalog.clubs.get(v.clubId)!;
  const ev = v.event ? catalog.events.get(v.event) : undefined;
  switch (f.type) {
    case 'base':
      if (versionType(v) !== 'base' || player.icon) return false;
      break;
    case 'season':
      if (versionType(v) !== 'season' || player.icon) return false;
      break;
    case 'icon':
      if (!player.icon) return false;
      break;
    case 'toty':
    case 'promesas':
      if (ev?.kind !== f.type) return false;
      break;
  }
  if (f.name) {
    const q = norm(f.name.trim());
    if (q && !norm(player.knownAs).includes(q) && !norm(player.fullName).includes(q)) return false;
  }
  if (f.league && club.leagueId !== f.league) return false;
  if (f.club && v.clubId !== f.club) return false;
  if (f.nation && v.nationCode !== f.nation) return false;
  if (f.position) {
    if (f.position.startsWith('line:')) {
      if (POSITION_LINE[v.position] !== f.position.slice(5)) return false;
    } else if (v.position !== (f.position as Position)) return false;
  }
  if (f.minRating && v.rating < f.minRating) return false;
  return true;
}

/** Ejecuta una búsqueda: ofertas disponibles ahora mismo para las cartas que encajan. */
export function searchMarket(f: SearchFilters, seed: number, now = Date.now()) {
  const found = allVersions.filter((v) => matches(v, f));
  const rng = createRng(seed);
  const listings: SearchListing[] = [];
  for (const v of found) {
    // Las cartas top escasean: menos ofertas publicadas.
    const supply = v.rating >= 90 ? 0.45 : v.rating >= 86 ? 0.65 : 0.85;
    const copies = rng.chance(supply) ? 1 + (rng.chance(supply * 0.5) ? 1 : 0) : 0;
    for (let i = 0; i < copies; i++) {
      const price = roundPrice(cardValue(v) * rng.range(0.9, 1.3));
      if (f.maxPrice !== '' && price > f.maxPrice) continue;
      listings.push({ id: `s${seed}-${v.id}-${i}`, versionId: v.id, price, expiresAt: now + rng.int(3, 58) * 60_000 });
    }
  }
  // Si hay coincidencias pero el azar no dejó ninguna, siempre aparece al menos una oferta.
  if (!listings.length && found.length) {
    const v = found[rng.int(0, found.length - 1)];
    const price = roundPrice(cardValue(v) * rng.range(1.05, 1.35));
    if (f.maxPrice === '' || price <= f.maxPrice) listings.push({ id: `s${seed}-${v.id}-x`, versionId: v.id, price, expiresAt: now + 30 * 60_000 });
  }
  listings.sort((a, b) => a.expiresAt - b.expiresAt);
  return { matched: found.length, listings: listings.slice(0, 36) };
}
