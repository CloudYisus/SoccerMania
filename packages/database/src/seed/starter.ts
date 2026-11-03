/**
 * Club inicial del usuario (versiones del catálogo de demostración).
 * El orden de `lineup` sigue los índices de slot de la formación 4-3-3.
 */
export const STARTER = {
  coins: 30000,
  squadName: 'Football Ultimate FC',
  formationId: '4-3-3' as const,
  managerId: 'mgr-ortega',
  lineup: [
    'maignan-milan',
    'dimarco-inter',
    'araujo-fcb',
    'rudiger-rm',
    'kounde-fcb',
    'gavi-fcb',
    'tchouameni-rm',
    'bruno-mu',
    'leao-milan',
    'gimenez-milan',
    'rodrygo-rm',
  ],
  bench: ['joangarcia-fcb', 'balde-fcb', 'carvajal-rm', 'camavinga-rm', 'dejong-fcb', 'raphinha-fcb', 'edson-wh'],
  reserves: ['barella-inter', 'marquinhos-psg', 'gvardiol-city', 'bernardo-city', 'foden-city', 'macallister-lfc', 'hsanchez-86', 'lozano-22', 'pulisic-milan', 'gabriel-ars'],
};

/**
 * Rivales controlados por la IA. Nombres ficticios propios del juego; se
 * construyen automáticamente a partir de grupos de versiones del catálogo.
 */
export interface OpponentDefinition {
  id: string;
  name: string;
  shortName: string;
  colors: { primary: string; secondary: string };
  formationId: '4-3-3' | '4-2-3-1' | '4-4-2' | '3-5-2' | '4-1-4-1' | '4-3-1-2';
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** Filtro de versiones elegibles para su once. */
  pool: { icons?: boolean; maxRating?: number; minRating?: number; minYear?: number; maxYear?: number; nations?: string[] };
  description: string;
}

export const OPPONENTS: OpponentDefinition[] = [
  {
    id: 'ai-norte',
    name: 'Ciudad Norte FC',
    shortName: 'NORTE',
    colors: { primary: '#2d6a4f', secondary: '#f1faee' },
    formationId: '4-4-2',
    difficulty: 1,
    pool: { icons: false, minYear: 2024, maxRating: 84 },
    description: 'Bloque ordenado, poca pegada.',
  },
  {
    id: 'ai-puerto',
    name: 'Atlético Puerto Real',
    shortName: 'PUERTO',
    colors: { primary: '#1d3557', secondary: '#e9c46a' },
    formationId: '4-2-3-1',
    difficulty: 2,
    pool: { icons: false, minYear: 2024, maxRating: 87 },
    description: 'Doble pivote y transiciones rápidas.',
  },
  {
    id: 'ai-modernos',
    name: 'Galácticos Modernos',
    shortName: 'GALÁCTICOS',
    colors: { primary: '#f8f9fa', secondary: '#7b2cbf' },
    formationId: '4-3-3',
    difficulty: 3,
    pool: { icons: false, minYear: 2023, minRating: 86 },
    description: 'Las estrellas actuales en un solo once.',
  },
  {
    id: 'ai-sudamerica',
    name: 'Leyendas del Sur XI',
    shortName: 'SUR XI',
    colors: { primary: '#f4d35e', secondary: '#0d3b66' },
    formationId: '4-3-1-2',
    difficulty: 4,
    pool: { nations: ['br', 'ar', 'uy', 'mx'] },
    description: 'Talento sudamericano de todas las épocas.',
  },
  {
    id: 'ai-europa',
    name: 'Clásicos de Europa XI',
    shortName: 'EUROPA XI',
    colors: { primary: '#0b132b', secondary: '#c9a227' },
    formationId: '4-3-3',
    difficulty: 5,
    pool: { icons: true, nations: ['de', 'it', 'es', 'fr', 'nl', 'pt', 'hu', 'hr'] },
    description: 'Iconos y leyendas europeas. El reto definitivo.',
  },
];
