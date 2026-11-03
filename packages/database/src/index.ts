import { buildCatalog, type CatalogData } from '@fu/domain';
import { CLUBS, LEAGUES, MANAGERS, NATIONS } from './seed/world';
import { PLAYERS, VERSIONS } from './seed/players';

export { STARTER, OPPONENTS, type OpponentDefinition } from './seed/starter';
export { MANAGERS };
export * from './repository';

/**
 * Aviso que la interfaz debe mostrar: los datos de jugadores son de demostración.
 */
export const DEMO_DATA_NOTICE =
  'Catálogo de demostración: ratings y estadísticas son valores de diseño de juego, no datos oficiales ni de API.';

export const demoCatalogData: CatalogData = {
  nations: NATIONS,
  leagues: LEAGUES,
  clubs: CLUBS,
  players: PLAYERS,
  versions: VERSIONS,
};

export const demoCatalog = buildCatalog(demoCatalogData);
