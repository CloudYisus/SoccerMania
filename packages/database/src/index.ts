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
import { historyCatalog } from './seed/history';

/** Ligas principales con plantilla completa de todos sus clubes. */
export const BIG_FIVE = ['eng-premier', 'esp-laliga', 'ita-serie-a', 'ger-bundesliga', 'fra-ligue-1'] as const;

const expanded = expandSquads([...ENG, ...ESP, ...ITA, ...GER, ...FRA, ...REST], { clubs: CLUBS, players: PLAYERS, versions: VERSIONS });
const withHistory = historyCatalog(expanded.players, expanded.versions);
const withEvents = eventCatalog(withHistory.players);

export { STARTER, OPPONENTS, type OpponentDefinition } from './seed/starter';
export { MANAGERS, EVENTS };
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
  players: withEvents.players,
  versions: [...expanded.versions, ...withHistory.versions, ...withEvents.versions],
  events: EVENTS,
};

export const demoCatalog = buildCatalog(demoCatalogData);
