import type { Club, League, Nation } from '../world/types';
import type { Player, PlayerVersion, Position } from '../players/types';
import type { PlayerCard } from './types';

/** Catálogo inmutable de entidades del juego, independiente de su origen (seed, BD, API). */
export interface Catalog {
  nations: ReadonlyMap<string, Nation>;
  leagues: ReadonlyMap<string, League>;
  clubs: ReadonlyMap<string, Club>;
  players: ReadonlyMap<string, Player>;
  versions: ReadonlyMap<string, PlayerVersion>;
}

export interface CatalogData {
  nations: Nation[];
  leagues: League[];
  clubs: Club[];
  players: Player[];
  versions: PlayerVersion[];
}

export function buildCatalog(data: CatalogData): Catalog {
  const byId = <T extends { id: string }>(items: T[]) => new Map(items.map((i) => [i.id, i]));
  const catalog: Catalog = {
    nations: new Map(data.nations.map((n) => [n.code, n])),
    leagues: byId(data.leagues),
    clubs: byId(data.clubs),
    players: byId(data.players),
    versions: byId(data.versions),
  };
  validateCatalog(catalog);
  return catalog;
}

/** Comprueba la integridad referencial del catálogo. Lanza al primer error. */
export function validateCatalog(c: Catalog): void {
  for (const club of c.clubs.values()) {
    if (!c.leagues.has(club.leagueId)) throw new Error(`Club ${club.id}: liga ${club.leagueId} inexistente`);
    if (!c.nations.has(club.nationCode)) throw new Error(`Club ${club.id}: nación ${club.nationCode} inexistente`);
  }
  for (const p of c.players.values()) {
    if (!c.nations.has(p.nationCode)) throw new Error(`Jugador ${p.id}: nación ${p.nationCode} inexistente`);
  }
  for (const v of c.versions.values()) {
    if (!c.players.has(v.playerId)) throw new Error(`Versión ${v.id}: jugador ${v.playerId} inexistente`);
    if (!c.clubs.has(v.clubId)) throw new Error(`Versión ${v.id}: club ${v.clubId} inexistente`);
    if (!c.nations.has(v.nationCode)) throw new Error(`Versión ${v.id}: nación ${v.nationCode} inexistente`);
    if (!Number.isInteger(v.year) || v.year < 1900 || v.year > 2100) throw new Error(`Versión ${v.id}: año de edición inválido`);
    const expectedKind = v.position === 'GK' ? 'goalkeeper' : 'outfield';
    if (v.stats.kind !== expectedKind) throw new Error(`Versión ${v.id}: estadísticas incompatibles con ${v.position}`);
  }
}

/** Vista resuelta de una carta: todo lo necesario para renderizarla o calcular química. */
export interface ResolvedCard {
  card: PlayerCard;
  version: PlayerVersion;
  player: Player;
  club: Club;
  league: League;
  nation: Nation;
  position: Position;
}

export function resolveVersion(c: Catalog, versionId: string) {
  const version = c.versions.get(versionId);
  if (!version) throw new Error(`Versión inexistente: ${versionId}`);
  const player = c.players.get(version.playerId)!;
  const club = c.clubs.get(version.clubId)!;
  const league = c.leagues.get(club.leagueId)!;
  const nation = c.nations.get(version.nationCode)!;
  return { version, player, club, league, nation };
}

export function resolveCard(c: Catalog, card: PlayerCard): ResolvedCard {
  const r = resolveVersion(c, card.versionId);
  return { card, ...r, position: card.positionOverride ?? r.version.position };
}

/** Todas las versiones de un mismo futbolista. */
export function versionsOfPlayer(c: Catalog, playerId: string): PlayerVersion[] {
  return [...c.versions.values()].filter((v) => v.playerId === playerId);
}
