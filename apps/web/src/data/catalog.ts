import { demoCatalog, DEMO_DATA_NOTICE, MANAGERS, OPPONENTS, STARTER } from '@fu/database';
import { resolveCard, resolveVersion, type PlayerCard, type ResolvedCard } from '@fu/domain';

export const catalog = demoCatalog;
export { DEMO_DATA_NOTICE, MANAGERS, OPPONENTS, STARTER };

export const allVersions = [...catalog.versions.values()];

export function resolve(card: PlayerCard): ResolvedCard {
  return resolveCard(catalog, card);
}
export function version(id: string) {
  return resolveVersion(catalog, id);
}
export function managerById(id: string | null) {
  return MANAGERS.find((m) => m.id === id) ?? null;
}
