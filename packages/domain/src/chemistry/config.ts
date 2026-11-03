/**
 * Parámetros del sistema clásico de química (FUT 17–22). Todos configurables
 * para poder ajustar el balance sin tocar el algoritmo.
 */
export type LinkStrength = 'strong' | 'medium' | 'weak';

export interface IndividualChemRow {
  /** Media mínima del valor de los enlaces (0–2) para aplicar la fila. */
  minLinkAverage: number;
  natural: number;
  related: number;
  poor: number;
}

export interface ChemistryConfig {
  /** Puntos que aporta cada coincidencia en un enlace. */
  linkWeights: { club: number; league: number; nation: number };
  /** Umbrales de puntos: >= strong → verde, >= medium → amarillo, si no rojo. */
  thresholds: { strong: number; medium: number };
  /** Valor numérico de cada enlace al promediar la química individual. */
  linkValue: Record<LinkStrength, number>;
  /** Regla clásica de Iconos: fuerte con su nación y, como mínimo, medio con cualquiera. */
  iconLinks: { sameNation: LinkStrength; otherwise: LinkStrength };
  /** Tabla de química individual base (ordenada de mayor a menor minLinkAverage). */
  individualTable: IndividualChemRow[];
  loyaltyBonus: number;
  managerBonus: number;
  maxIndividual: number;
  maxTeam: number;
  /**
   * Influencia de la química en el simulador: multiplicador de atributos
   * = floor + (1 - floor) * (química / maxIndividual).
   */
  performanceFloor: number;
}

export const DEFAULT_CHEMISTRY_CONFIG: ChemistryConfig = {
  linkWeights: { club: 1, league: 1, nation: 1 },
  thresholds: { strong: 2, medium: 1 },
  linkValue: { strong: 2, medium: 1, weak: 0 },
  iconLinks: { sameNation: 'strong', otherwise: 'medium' },
  individualTable: [
    { minLinkAverage: 1.6, natural: 10, related: 7, poor: 3 },
    { minLinkAverage: 1.0, natural: 9, related: 6, poor: 2 },
    { minLinkAverage: 0.5, natural: 6, related: 4, poor: 1 },
    { minLinkAverage: 0, natural: 3, related: 2, poor: 0 },
  ],
  loyaltyBonus: 1,
  managerBonus: 1,
  maxIndividual: 10,
  maxTeam: 100,
  performanceFloor: 0.88,
};
