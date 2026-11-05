import { buildCatalog, type CatalogData } from '@fu/domain';
import { CLUBS, LEAGUES, MANAGERS, NATIONS } from './seed/world';
import { PLAYERS, VERSIONS } from './seed/players';
import { expandSquads } from './seed/squads/build';
import { ENG } from './seed/squads/eng';
import { ESP } from './seed/squads/esp';
import { ITA } from './seed/squads/ita';
import { GER } from './seed/squads/ger';
import { FRA } from './seed/squads/fra';
import { REST } from './seed/squads/rest';
import { eventCatalog, EVENTS } from './seed/events';
import { HERO_NAMES, historyCatalog } from './seed/history';
import { slug } from './seed/squads/build';
import { inFormCatalog, TOTW_EVENT } from './seed/inform';

/** Ligas principales con plantilla completa de todos sus clubes. */
export const BIG_FIVE = ['eng-premier', 'esp-laliga', 'ita-serie-a', 'ger-bundesliga', 'fra-ligue-1'] as const;

const expanded = expandSquads([...ENG, ...ESP, ...ITA, ...GER, ...FRA, ...REST], { clubs: CLUBS, players: PLAYERS, versions: VERSIONS });
const withHistory = historyCatalog(expanded.players, expanded.versions);
const withEvents = eventCatalog(withHistory.players);
// Históricos: retirados con etapas memorables (todas sus cartas llevan el sello).
const allPlayers = withEvents.players.map((p) => (!p.icon && HERO_NAMES.has(slug(p.knownAs)) ? { ...p, hero: true } : p));

export { STARTER, OPPONENTS, type OpponentDefinition } from './seed/starter';
export { MANAGERS, EVENTS, TOTW_EVENT };
export { inFormBoost } from './seed/inform';
export * from './repository';

/**
 * Aviso que la interfaz debe mostrar: los datos de jugadores son de demostración.
 */
export const DEMO_DATA_NOTICE =
  'Catálogo de demostración: ratings y estadísticas son valores de diseño de juego, no datos oficiales ni de API.';

export const demoCatalogData: CatalogData = {
  nations: NATIONS,
  leagues: LEAGUES,
  clubs: expanded.clubs,
  players: allPlayers,
  versions: [...expanded.versions, ...withHistory.versions, ...withEvents.versions, ...inFormCatalog(allPlayers, expanded.versions)],
  events: [...EVENTS, TOTW_EVENT],
};

export const demoCatalog = buildCatalog(demoCatalogData);
