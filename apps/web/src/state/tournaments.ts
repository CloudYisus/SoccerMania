import { createRng, hashString } from '@fu/shared';
import { CURRENT_YEAR, FORMATION_IDS, type PlayStyle } from '@fu/domain';
import { allVersions, catalog } from '../data/catalog';
import { assemble, rankedClubs, REAL_CLUBS, styleTactics, type TeamBuild } from './teams';

/**
 * TORNEOS
 * Todos son eliminatorias de 8 equipos. Cada uno puede jugarse contra CLUBES
 * REALES (plantillas, formación y estilo del club) o contra EQUIPOS MIXTOS
 * (como el del usuario: futbolistas de distintos clubes con química),
 * generados desde la base de jugadores del torneo.
 */
export interface TournamentDef {
  id: string;
  name: string;
  description: string;
  fee: number;
  prize: number;
  /** Modos permitidos (el primero es el sugerido). */
  modes: ('real' | 'mix')[];
  /** Clubes candidatos para el modo real, de más a menos fuertes. */
  realClubs: () => string[];
  /** Base de jugadores para los equipos mixtos. */
  mixPool: { leagues?: string[]; nations?: string[]; icons?: boolean; legends?: boolean; minRating?: number };
  accent: string;
}

const clubsOf = (leagues: string[]) => () =>
  rankedClubs()
    .filter((c) => leagues.includes(catalog.clubs.get(c.clubId)!.leagueId))
    .map((c) => c.clubId);

const AMERICAS = ['usa-mls', 'mex-ligamx', 'bra-serie-a', 'arg-primera'];
const BIG5 = ['eng-premier', 'esp-laliga', 'ita-serie-a', 'ger-bundesliga', 'fra-ligue-1'];

export const TOURNAMENTS: TournamentDef[] = [
  {
    id: 'ultimate',
    name: 'Copa Ultimate',
    description: 'El torneo clásico del juego: rivales de todos los niveles y estilos.',
    fee: 2500,
    prize: 25000,
    modes: ['mix', 'real'],
    realClubs: () => rankedClubs().map((c) => c.clubId).slice(0, 24),
    mixPool: { minRating: 80 },
    accent: '#f3d99b',
  },
  {
    id: 'europa',
    name: 'Copa de Campeones',
    description: 'Los gigantes de las cinco grandes ligas de Europa.',
    fee: 5000,
    prize: 45000,
    modes: ['real', 'mix'],
    realClubs: () => clubsOf(BIG5)().slice(0, 16),
    mixPool: { leagues: BIG5, minRating: 83 },
    accent: '#6cc4ff',
  },
  {
    id: 'inglaterra',
    name: 'Copa de Inglaterra',
    description: 'Clubes de la Premier League.',
    fee: 3000,
    prize: 30000,
    modes: ['real', 'mix'],
    realClubs: clubsOf(['eng-premier']),
    mixPool: { leagues: ['eng-premier'] },
    accent: '#c084fc',
  },
  {
    id: 'espana',
    name: 'Copa de España',
    description: 'Clubes de LaLiga.',
    fee: 3000,
    prize: 30000,
    modes: ['real', 'mix'],
    realClubs: clubsOf(['esp-laliga']),
    mixPool: { leagues: ['esp-laliga'] },
    accent: '#ff6b6b',
  },
  {
    id: 'italia',
    name: 'Copa de Italia',
    description: 'Clubes de la Serie A.',
    fee: 3000,
    prize: 30000,
    modes: ['real', 'mix'],
    realClubs: clubsOf(['ita-serie-a']),
    mixPool: { leagues: ['ita-serie-a'] },
    accent: '#4ade80',
  },
  {
    id: 'alemania',
    name: 'Copa de Alemania',
    description: 'Clubes de la Bundesliga.',
    fee: 3000,
    prize: 30000,
    modes: ['real', 'mix'],
    realClubs: clubsOf(['ger-bundesliga']),
    mixPool: { leagues: ['ger-bundesliga'] },
    accent: '#facc15',
  },
  {
    id: 'francia',
    name: 'Copa de Francia',
    description: 'Clubes de la Ligue 1.',
    fee: 3000,
    prize: 30000,
    modes: ['real', 'mix'],
    realClubs: clubsOf(['fra-ligue-1']),
    mixPool: { leagues: ['fra-ligue-1'] },
    accent: '#60a5fa',
  },
  {
    id: 'americas',
    name: 'Copa de las Américas',
    description: 'Clubes de la MLS, Liga MX, Brasil y Argentina.',
    fee: 2000,
    prize: 20000,
    modes: ['real', 'mix'],
    realClubs: clubsOf(AMERICAS),
    mixPool: { leagues: AMERICAS },
    accent: '#34d399',
  },
  {
    id: 'leyendas',
    name: 'Torneo de Leyendas',
    description: 'Iconos y grandes temporadas de la historia. El reto más exigente.',
    fee: 8000,
    prize: 60000,
    modes: ['mix'],
    realClubs: () => [],
    mixPool: { legends: true },
    accent: '#fff4d6',
  },
];

export const tournamentById = (id: string) => TOURNAMENTS.find((t) => t.id === id) ?? TOURNAMENTS[0];

/** Nombres propios del juego para los equipos mixtos. */
const MIX_NAMES: [string, string, string, string][] = [
  ['Real Altamira', 'ALTAMIRA', '#7b1e2b', '#f2e8cf'],
  ['Deportivo Valle Azul', 'VALLE AZUL', '#1f4e8c', '#f5f5f5'],
  ['Unión Costera', 'U. COSTERA', '#0f766e', '#fde68a'],
  ['Sporting Meridional', 'MERIDIONAL', '#166534', '#f8fafc'],
  ['Atlético Cumbres', 'CUMBRES', '#b91c1c', '#1e293b'],
  ['Racing Bahía', 'R. BAHÍA', '#0e7490', '#0f172a'],
  ['Olímpico del Norte', 'OLÍMPICO', '#4c1d95', '#e9d5ff'],
  ['Estrella Polar', 'E. POLAR', '#1e3a8a', '#fbbf24'],
  ['Inter Galaxia', 'GALAXIA', '#111827', '#a78bfa'],
  ['Halcones Dorados', 'HALCONES', '#a16207', '#111111'],
  ['Corsarios FC', 'CORSARIOS', '#991b1b', '#f5f5f5'],
  ['Titanes United', 'TITANES', '#334155', '#38bdf8'],
];
const STYLES: PlayStyle[] = ['balanced', 'possession', 'counter', 'direct', 'wings', 'highpress'];

/** Equipo mixto con química (jugadores de varios clubes) generado para un torneo. */
export function mixTeam(tournamentId: string, edition: number, index: number): TeamBuild {
  const def = tournamentById(tournamentId);
  const rng = createRng(hashString(`mix-${tournamentId}-${edition}-${index}`));
  const p = def.mixPool;
  const pool = allVersions.filter((v) => {
    const player = catalog.players.get(v.playerId)!;
    const club = catalog.clubs.get(v.clubId)!;
    if (p.legends) return player.icon || (v.year < CURRENT_YEAR && !v.event && v.rating >= 86);
    if (v.event || v.year < CURRENT_YEAR) return false;
    if (p.leagues && !p.leagues.includes(club.leagueId)) return false;
    if (p.minRating && v.rating < p.minRating) return false;
    return true;
  });
  // Núcleo: una nación o liga para que el equipo tenga química; el resto, del pool general.
  const anchorBy = rng.chance(0.5) ? 'nation' : 'league';
  const anchors = [...new Set(pool.map((v) => (anchorBy === 'nation' ? v.nationCode : catalog.clubs.get(v.clubId)!.leagueId)))];
  const anchor = anchors[rng.int(0, anchors.length - 1)];
  const core = pool.filter((v) => (anchorBy === 'nation' ? v.nationCode : catalog.clubs.get(v.clubId)!.leagueId) === anchor);
  const rest = pool.filter((v) => !core.includes(v));
  // Nivel variable entre equipos del mismo torneo (unos más fuertes que otros).
  const strength = rng.range(0.15, 0.95);
  const shuffle = <T>(arr: T[]) => [...arr].sort(() => rng.next() - 0.5);
  const byQuality = (arr: typeof pool) => {
    const sorted = [...arr].sort((a, b) => b.rating - a.rating);
    const cut = Math.floor(sorted.length * (1 - strength) * 0.6);
    return shuffle(sorted.slice(cut, cut + 40));
  };
  const chosen = [...byQuality(core).slice(0, 18), ...byQuality(rest).slice(0, 26)];
  const [name, shortName, primary, secondary] = MIX_NAMES[(index + edition * 3 + hashString(tournamentId)) % MIX_NAMES.length];
  const style = STYLES[rng.int(0, STYLES.length - 1)];
  const formationId = FORMATION_IDS[rng.int(0, FORMATION_IDS.length - 1)];
  const team = assemble(
    {
      id: `mix-${tournamentId}-${edition}-${index}`,
      name,
      shortName,
      colors: { primary, secondary },
      formationId,
      difficulty: 3,
      description: `Equipo mixto · ${def.name}`,
    },
    chosen,
  );
  const difficulty = team.rating >= 88 ? 5 : team.rating >= 85 ? 4 : team.rating >= 82 ? 3 : team.rating >= 79 ? 2 : 1;
  return { ...team, difficulty, tactics: styleTactics(style, difficulty) };
}

export { REAL_CLUBS };
