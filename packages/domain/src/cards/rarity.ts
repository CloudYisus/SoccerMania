/**
 * Sistema de rarezas extensible. El dominio sólo conoce las reglas
 * (orden, perfil de química, multiplicador económico). La identidad visual de
 * cada rareza vive en la capa de presentación (apps/web/src/styles/rarity.css).
 */
export type RarityId = 'common' | 'special' | 'epic' | 'legend' | 'icon' | 'unique' | (string & {});

export interface RarityDefinition {
  id: RarityId;
  /** Etiqueta visible (singular, femenino: "carta épica"). */
  label: string;
  /** Etiqueta de la insignia de la carta. */
  badge: string;
  /** Orden de exclusividad: mayor = más exclusiva. */
  tier: number;
  /**
   * Perfil de química:
   * - standard: enlaces por club/liga/nación.
   * - icon: enlace fuerte con su nación y medio con cualquiera (modelo clásico de Iconos).
   */
  chemistryProfile: 'standard' | 'icon';
  /** Multiplicador sobre el valor de mercado base. */
  marketMultiplier: number;
  /** Si una carta de esta rareza merece animación de "walkout" en sobres. */
  walkout: boolean;
}

const registry = new Map<RarityId, RarityDefinition>();

export function registerRarity(def: RarityDefinition): void {
  registry.set(def.id, def);
}

export function getRarity(id: RarityId): RarityDefinition {
  const def = registry.get(id);
  if (!def) throw new Error(`Rareza desconocida: ${id}`);
  return def;
}

export function listRarities(): RarityDefinition[] {
  return [...registry.values()].sort((a, b) => a.tier - b.tier);
}

[
  { id: 'common', label: 'Común', badge: 'COMÚN', tier: 0, chemistryProfile: 'standard', marketMultiplier: 1, walkout: false },
  { id: 'special', label: 'Especial', badge: 'ESPECIAL', tier: 1, chemistryProfile: 'standard', marketMultiplier: 1.35, walkout: false },
  { id: 'epic', label: 'Épica', badge: 'ÉPICO', tier: 2, chemistryProfile: 'standard', marketMultiplier: 1.8, walkout: true },
  { id: 'legend', label: 'Leyenda', badge: 'LEYENDA', tier: 3, chemistryProfile: 'standard', marketMultiplier: 2.6, walkout: true },
  { id: 'icon', label: 'Icono', badge: 'ICONO', tier: 4, chemistryProfile: 'icon', marketMultiplier: 3.6, walkout: true },
  { id: 'unique', label: 'Única', badge: 'ÚNICA', tier: 5, chemistryProfile: 'standard', marketMultiplier: 5, walkout: true },
].forEach((d) => registerRarity(d as RarityDefinition));
