import { createRng, hashString } from '@fu/shared';
import {
  autoAssign,
  buildTeamSetup,
  calculateChemistry,
  FORMATION_IDS,
  getFormation,
  positionFit,
  teamRating,
  type FormationId,
  type MatchTeamSetup,
  type PlayerInstruction,
  type PlayStyle,
  CURRENT_YEAR,
  type TeamTactics,
  DEFAULT_TACTICS,
} from '@fu/domain';
import { allVersions, catalog, OPPONENTS, version } from '../data/catalog';
import type { SquadView } from './squadView';

/** Equipo controlado por la IA, construido con versiones reales del catálogo. */
export interface TeamBuild {
  id: string;
  name: string;
  shortName: string;
  colors: { primary: string; secondary: string };
  formationId: FormationId;
  versionIds: string[];
  rating: number;
  chemistry: number;
  slotChemistry: number[];
  difficulty: number;
  description: string;
  tactics: TeamTactics;
}

function chemFor(formationId: FormationId, versionIds: string[]) {
  const formation = getFormation(formationId);
  return calculateChemistry(
    formation,
    versionIds.map((id) => {
      const r = version(id);
      return {
        playerId: r.player.id,
        clubId: r.club.id,
        leagueId: r.league.id,
        nationCode: r.nation.code,
        position: r.version.position,
        altPositions: r.version.altPositions,
        isIcon: r.player.icon,
        loyal: true,
      };
    }),
  );
}

export function assemble(
  base: Omit<TeamBuild, 'versionIds' | 'rating' | 'chemistry' | 'slotChemistry' | 'tactics'> & { tactics?: TeamTactics },
  pool: typeof allVersions,
): TeamBuild {
  const formation = getFormation(base.formationId);
  const ids = autoAssign(
    formation,
    pool.map((v) => ({ id: v.id, playerId: v.playerId, position: v.position, altPositions: v.altPositions, rating: v.rating })),
  );
  // Si el pool no cubre algún slot, se completa con el catálogo general
  // (mejor encaje posicional y rating más cercano a la media del equipo).
  const taken = new Set(ids.filter(Boolean).map((x) => catalog.versions.get(x!)!.playerId));
  const placed = ids.filter(Boolean).map((x) => catalog.versions.get(x!)!.rating);
  const target = placed.length ? placed.reduce((a, b) => a + b, 0) / placed.length : 80;
  const fitRank = { natural: 0, related: 1, poor: 2 } as const;
  const filled = ids.map((id, i) => {
    if (id) return id;
    const slot = formation.slots[i];
    const pick = allVersions
      .filter((v) => !taken.has(v.playerId))
      .sort(
        (a, b) =>
          fitRank[positionFit(a.position, a.altPositions, slot.position)] - fitRank[positionFit(b.position, b.altPositions, slot.position)] ||
          Math.abs(a.rating - target) - Math.abs(b.rating - target),
      )[0];
    taken.add(pick.playerId);
    return pick.id;
  });
  const chem = chemFor(base.formationId, filled);
  return {
    ...base,
    tactics: base.tactics ?? { ...DEFAULT_TACTICS },
    versionIds: filled,
    rating: teamRating(filled.map((id) => catalog.versions.get(id)!.rating)),
    chemistry: chem.team,
    slotChemistry: chem.players.map((p) => p?.value ?? 0),
  };
}

export function buildOpponent(id: string): TeamBuild {
  const def = OPPONENTS.find((o) => o.id === id);
  if (!def) throw new Error(`Rival desconocido ${id}`);
  const pool = allVersions.filter(
    (v) =>
      (def.pool.icons === undefined || catalog.players.get(v.playerId)!.icon === def.pool.icons) &&
      (!def.pool.nations || def.pool.nations.includes(v.nationCode)) &&
      (!def.pool.maxRating || v.rating <= def.pool.maxRating) &&
      (!def.pool.minRating || v.rating >= def.pool.minRating) &&
      (!def.pool.minYear || v.year >= def.pool.minYear) &&
      (!def.pool.maxYear || v.year <= def.pool.maxYear),
  );
  return assemble({ ...def, tactics: styleTactics(def.style ?? 'balanced', def.difficulty) }, pool);
}

/** Planteamiento de la IA según su estilo y dificultad. */
export function styleTactics(style: PlayStyle, difficulty: number): TeamTactics {
  return {
    ...DEFAULT_TACTICS,
    mentality: difficulty >= 4 ? 'attacking' : difficulty <= 1 ? 'defensive' : 'balanced',
    pressing: style === 'highpress' ? 80 : style === 'counter' ? 32 : 40 + difficulty * 8,
    width: style === 'wings' ? 85 : style === 'possession' ? 62 : DEFAULT_TACTICS.width,
    tempo: style === 'possession' ? 38 : style === 'direct' || style === 'counter' ? 74 : DEFAULT_TACTICS.tempo,
    depth: style === 'highpress' ? 70 : style === 'counter' ? 35 : DEFAULT_TACTICS.depth,
    style,
  };
}

const difficultyOf = (rating: number) => (rating >= 86 ? 5 : rating >= 83 ? 4 : rating >= 80 ? 3 : rating >= 77 ? 2 : 1);

// ───────────────────────────── Equipos reales ─────────────────────────────

/** Clubes reales jugables (plantilla de la temporada actual con al menos 11 jugadores). */
export const REAL_CLUBS = [...catalog.clubs.values()].filter(
  (c) => !c.historical && allVersions.filter((v) => v.clubId === c.id && v.year >= CURRENT_YEAR && !v.event).length >= 11,
);

const clubCache = new Map<string, TeamBuild>();

/** Equipo real controlado por la IA: su plantilla, su formación y su estilo. */
export function clubTeam(clubId: string): TeamBuild {
  const cached = clubCache.get(clubId);
  if (cached) return cached;
  const club = catalog.clubs.get(clubId);
  if (!club) throw new Error(`Club desconocido ${clubId}`);
  const pool = allVersions.filter((v) => v.clubId === clubId && v.year >= CURRENT_YEAR && !v.event);
  const style = club.style ?? 'balanced';
  const league = catalog.leagues.get(club.leagueId)!;
  const formationId = club.formation ?? '4-3-3';
  // Valoración previa para fijar la dificultad (y con ella la intensidad del planteamiento).
  const top = [...pool].sort((a, b) => b.rating - a.rating).slice(0, 11);
  const approx = top.reduce((n, v) => n + v.rating, 0) / Math.max(1, top.length);
  const difficulty = difficultyOf(approx);
  const team = assemble(
    {
      id: `club-${clubId}`,
      name: club.name,
      shortName: club.shortName,
      colors: club.colors,
      formationId,
      difficulty,
      description: `${league.name} · plantilla real`,
      tactics: styleTactics(style, difficulty),
    },
    pool,
  );
  clubCache.set(clubId, team);
  return team;
}

/** Clubes reales ordenados por media del once (cacheado). */
let ranked: { clubId: string; rating: number }[] | null = null;
export function rankedClubs() {
  ranked ??= REAL_CLUBS.map((c) => ({ clubId: c.id, rating: clubTeam(c.id).rating })).sort((a, b) => b.rating - a.rating);
  return ranked;
}

export const QUICK_OPPONENTS = OPPONENTS.map((o) => o.id);

const DIVISION_CLUBS = [
  ['Real Altamira', 'ALTAMIRA', '#7b1e2b', '#f2e8cf'],
  ['Deportivo Valle Azul', 'VALLE AZUL', '#1f4e8c', '#f5f5f5'],
  ['Unión Costera', 'U. COSTERA', '#0f766e', '#fde68a'],
  ['Sporting Meridional', 'MERIDIONAL', '#166534', '#f8fafc'],
  ['Atlético Cumbres', 'CUMBRES', '#b91c1c', '#1e293b'],
  ['Racing Bahía', 'R. BAHÍA', '#0e7490', '#0f172a'],
  ['Olímpico del Norte', 'OLÍMPICO', '#4c1d95', '#e9d5ff'],
] as const;

const DIVISION_STYLES: PlayStyle[] = ['balanced', 'possession', 'counter', 'direct', 'wings', 'highpress'];

/** Rival de Divisiones: su nivel depende de la división (10 = más baja). */
export function divisionOpponent(level: number, gameIndex: number, rivals: 'mix' | 'real' = 'mix'): TeamBuild {
  if (rivals === 'real') {
    // Clubes reales cuya media se acerca al nivel de la división.
    const target = 76 + (10 - level) * 1.2;
    const list = rankedClubs()
      .map((c) => ({ ...c, d: Math.abs(c.rating - target) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 12)
      .sort((a, b) => hashString(`${a.clubId}-${level}`) - hashString(`${b.clubId}-${level}`));
    return clubTeam(list[gameIndex % list.length].clubId);
  }
  const rng = createRng(hashString(`div-${level}-${gameIndex}`));
  const target = 78 + (10 - level) * 1.4;
  let spread = 4;
  let pool = allVersions.filter((v) => Math.abs(v.rating - target) <= spread);
  while ((pool.length < 30 || pool.filter((v) => v.position === 'GK').length < 2) && spread < 20) {
    spread += 2;
    pool = allVersions.filter((v) => Math.abs(v.rating - target) <= spread);
  }
  const [name, shortName, primary, secondary] = DIVISION_CLUBS[gameIndex % DIVISION_CLUBS.length];
  const formationId = FORMATION_IDS[rng.int(0, FORMATION_IDS.length - 1)];
  const style = DIVISION_STYLES[rng.int(0, DIVISION_STYLES.length - 1)];
  // Mezcla determinista del pool para variar los onces.
  const shuffled = [...pool].sort((a, b) => hashString(a.id + gameIndex + level) - hashString(b.id + gameIndex + level));
  return assemble(
    {
      id: `div-${level}-${gameIndex}`,
      name,
      shortName,
      colors: { primary, secondary },
      formationId,
      difficulty: Math.max(1, Math.min(5, Math.round((11 - level) / 2))),
      description: `Rival de División ${level}`,
      tactics: {
        ...DEFAULT_TACTICS,
        pressing: style === 'highpress' ? 78 : 35 + (10 - level) * 4,
        width: style === 'wings' ? 85 : DEFAULT_TACTICS.width,
        tempo: style === 'possession' ? 38 : style === 'direct' || style === 'counter' ? 74 : DEFAULT_TACTICS.tempo,
        style,
      },
    },
    shuffled.slice(0, 40),
  );
}

export function cupOpponent(round: number): TeamBuild {
  const ids = ['ai-modernos', 'ai-sudamerica', 'ai-europa'];
  return buildOpponent(ids[Math.min(round, ids.length - 1)]);
}

export function aiToMatchSetup(t: TeamBuild): MatchTeamSetup {
  const formation = getFormation(t.formationId);
  return buildTeamSetup({
    id: t.id,
    name: t.name,
    shortName: t.shortName,
    colors: t.colors,
    formation,
    tactics: t.tactics,
    rating: t.rating,
    chemistry: t.chemistry,
    lineup: t.versionIds.map((id, i) => {
      const r = version(id);
      return {
        id: `${t.id}-${i}-${id}`,
        name: r.player.knownAs,
        number: r.version.shirtNumber,
        stats: r.version.stats,
        chemistry: t.slotChemistry[i],
        versionId: id,
        icon: r.player.icon,
      };
    }),
  });
}

export function userToMatchSetup(view: SquadView, name: string, tactics: TeamTactics, instructions: Record<string, PlayerInstruction>): MatchTeamSetup {
  return buildTeamSetup({
    id: 'user',
    name,
    shortName: name.split(' ').slice(0, 2).join(' ').toUpperCase().slice(0, 12),
    colors: { primary: '#f3d99b', secondary: '#0b0d11' },
    formation: view.formation,
    tactics,
    rating: view.rating,
    chemistry: view.chemistry.team,
    lineup: view.starters.map((r, i) => {
      if (!r) throw new Error('Plantilla incompleta');
      return {
        id: r.card.id,
        name: r.player.knownAs,
        number: r.version.shirtNumber,
        stats: r.version.stats,
        chemistry: view.chemistry.players[i]?.value ?? 0,
        instruction: instructions[r.card.id] ?? 'none',
        versionId: r.version.id,
        icon: r.player.icon,
      };
    }),
  });
}
