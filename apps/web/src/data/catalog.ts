import { demoCatalog, DEMO_DATA_NOTICE, MANAGERS, OPPONENTS, STARTER } from '@fu/database';
import { resolveCard, resolveVersion, type PlayerCard, type ResolvedCard } from '@fu/domain';

export const catalog = demoCatalog;
export { DEMO_DATA_NOTICE, MANAGERS, OPPONENTS, STARTER };

/** Versiones coleccionables "normales": las En Forma sólo circulan cuando su jugador está en el Equipo de la Semana. */
export const allVersions = [...catalog.versions.values()].filter((v) => v.event !== 'totw');

/** Versión En Forma de una carta base (si existe). */
export function inFormOf(versionId: string) {
  return catalog.versions.get(`${versionId}-if`);
}
/** Carta base de una versión En Forma. */
export function baseOfInForm(versionId: string) {
  return versionId.endsWith('-if') ? versionId.slice(0, -3) : versionId;
}

export function resolve(card: PlayerCard): ResolvedCard {
  return resolveCard(catalog, card);
}
export function version(id: string) {
  return resolveVersion(catalog, id);
}
export function managerById(id: string | null) {
  return MANAGERS.find((m) => m.id === id) ?? null;
}
