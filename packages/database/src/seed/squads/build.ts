import { hashString } from '@fu/shared';
import { seasonToYear, type Club, type FaceStats, type FormationId, type Player, type PlayerVersion, type PlayStyle, type Position } from '@fu/domain';

/**
 * PLANTILLAS COMPACTAS
 *
 * Para cubrir todos los clubes de las 5 grandes ligas (y varias secundarias) sin
 * escribir a mano miles de líneas, cada plantilla se describe en formato compacto:
 *
 *   Nombre|POS|media|nación[|pos.alt1,pos.alt2]
 *
 * y las 6 estadísticas de la carta se derivan de la posición y la media con una
 * variación determinista por jugador. Son DATOS DE DEMOSTRACIÓN (diseño de juego),
 * aproximados a la temporada 2025-26 con conocimiento público hasta 2025: pueden
 * no reflejar fichajes posteriores y no son datos oficiales ni de ninguna API.
 */
export interface SquadDef {
  id: string;
  name: string;
  shortName: string;
  leagueId: string;
  nationCode: string;
  primary: string;
  secondary: string;
  api?: number | null;
  style?: PlayStyle;
  formation?: FormationId;
  roster: string;
}

export const SEASON = '2025-26';

export const squad = (
  id: string,
  name: string,
  shortName: string,
  leagueId: string,
  nationCode: string,
  colors: [string, string],
  opts: { api?: number | null; style?: PlayStyle; formation?: FormationId },
  roster: string,
): SquadDef => ({ id, name, shortName, leagueId, nationCode, primary: colors[0], secondary: colors[1], ...opts, roster });

const POSITIONS = new Set<Position>(['GK', 'RB', 'RWB', 'CB', 'LB', 'LWB', 'CDM', 'CM', 'CAM', 'RM', 'LM', 'RW', 'LW', 'CF', 'ST']);

/** Desviación de cada estadística respecto a la media según el puesto. */
const ARCHETYPE: Record<Exclude<Position, 'GK'>, [number, number, number, number, number, number]> = {
  CB: [-10, -36, -16, -15, 3, 1],
  RB: [4, -22, -6, -4, -4, -6],
  LB: [4, -22, -6, -4, -4, -6],
  RWB: [6, -18, -4, -2, -6, -6],
  LWB: [6, -18, -4, -2, -6, -6],
  CDM: [-14, -14, -3, -6, 0, 1],
  CM: [-10, -9, 1, 0, -14, -7],
  CAM: [-6, -4, 2, 3, -36, -18],
  RM: [5, -6, -3, 2, -38, -16],
  LM: [5, -6, -3, 2, -38, -16],
  RW: [6, -5, -4, 3, -46, -18],
  LW: [6, -5, -4, 3, -46, -18],
  CF: [-2, 1, -6, 1, -46, -10],
  ST: [0, 3, -14, -3, -46, -4],
};

const clamp = (v: number) => Math.max(20, Math.min(99, Math.round(v)));

export function deriveStats(name: string, pos: Position, rating: number): FaceStats {
  const h = hashString(`${name}|${pos}`);
  const j = (i: number, amp = 3) => (((h >>> (i * 4)) & 15) / 15 - 0.5) * 2 * amp;
  if (pos === 'GK') {
    return {
      kind: 'goalkeeper',
      div: clamp(rating + 1 + j(0)),
      han: clamp(rating - 2 + j(1)),
      kic: clamp(rating - 12 + j(2, 6)),
      ref: clamp(rating + 2 + j(3)),
      spd: clamp(rating - 34 + j(4, 8)),
      pos: clamp(rating + j(5)),
    };
  }
  const a = ARCHETYPE[pos];
  return {
    kind: 'outfield',
    pac: clamp(rating + a[0] + j(0, 5)),
    sho: clamp(rating + a[1] + j(1, 4)),
    pas: clamp(rating + a[2] + j(2)),
    dri: clamp(rating + a[3] + j(3)),
    def: clamp(rating + a[4] + j(4, 4)),
    phy: clamp(rating + a[5] + j(5, 5)),
  };
}

const DEFAULT_NUMBER: Partial<Record<Position, number[]>> = {
  GK: [1, 13, 25],
  RB: [2, 12],
  RWB: [2],
  CB: [4, 5, 15, 3],
  LB: [3, 18],
  LWB: [3],
  CDM: [6, 16],
  CM: [8, 14, 20],
  CAM: [10, 21],
  RM: [7, 17],
  LM: [11, 22],
  RW: [7, 17],
  LW: [11, 22],
  CF: [9, 19],
  ST: [9, 19, 29],
};

const titleCase = (s: string) =>
  s
    .toLowerCase()
    .split(' ')
    .map((w) => (w.length <= 3 && w.includes('.') ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');

export const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ø/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * Expande las plantillas: añade clubes nuevos (o completa los existentes con
 * estilo/formación) y crea jugadores y versiones de la temporada actual.
 * Si un futbolista ya existe en el catálogo curado con una carta de la temporada
 * actual, se respeta la curada y no se duplica.
 */
export function expandSquads(
  defs: SquadDef[],
  base: { clubs: Club[]; players: Player[]; versions: PlayerVersion[] },
): { clubs: Club[]; players: Player[]; versions: PlayerVersion[] } {
  const year = seasonToYear(SEASON);
  const clubs = new Map(base.clubs.map((c) => [c.id, { ...c }]));
  const players = new Map(base.players.map((p) => [p.id, p]));
  const versions = [...base.versions];
  const versionIds = new Set(versions.map((v) => v.id));
  const byName = new Map(base.players.map((p) => [slug(p.knownAs), p]));
  const hasCurrent = new Set(versions.filter((v) => v.year >= year && !v.event).map((v) => v.playerId));
  const generated = new Map<string, string>();

  for (const d of defs) {
    const existing = clubs.get(d.id);
    if (existing) {
      clubs.set(d.id, { ...existing, style: d.style ?? existing.style, formation: d.formation ?? existing.formation });
    } else {
      clubs.set(d.id, {
        id: d.id,
        name: d.name,
        shortName: d.shortName,
        leagueId: d.leagueId,
        nationCode: d.nationCode,
        colors: { primary: d.primary, secondary: d.secondary },
        apiFootballId: d.api ?? null,
        theSportsDbName: d.name,
        style: d.style,
        formation: d.formation,
      });
    }
    const club = clubs.get(d.id)!;
    const used = new Set<number>(versions.filter((v) => v.clubId === d.id && v.year >= year).map((v) => v.shirtNumber));
    const lines = d.roster
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    for (const line of lines) {
      const [name, posRaw, ratingRaw, nation, altsRaw] = line.split('|').map((x) => x?.trim());
      const pos = posRaw as Position;
      const rating = Number(ratingRaw);
      if (!name || !POSITIONS.has(pos) || !Number.isFinite(rating) || !nation) throw new Error(`Plantilla ${d.id}: línea inválida "${line}"`);
      const alts = (altsRaw ? altsRaw.split(',').map((x) => x.trim()) : []) as Position[];
      for (const a of alts) if (!POSITIONS.has(a)) throw new Error(`Plantilla ${d.id}: posición alternativa inválida en "${line}"`);

      const key = slug(name);
      if (generated.has(`${key}|${nation}`)) throw new Error(`Plantillas: "${name}" (${nation}) aparece en dos clubes (${generated.get(`${key}|${nation}`)} y ${d.id})`);
      generated.set(`${key}|${nation}`, d.id);
      let player = byName.get(key);
      if (player && player.nationCode !== nation) player = undefined;
      if (player && hasCurrent.has(player.id)) continue; // ya tiene carta curada de esta temporada
      if (!player) {
        let id = key;
        if (players.has(id)) id = `${key}-${d.id}`;
        player = { id, knownAs: name, fullName: name, nationCode: nation, birthYear: 0, icon: false };
        players.set(id, player);
        byName.set(key, player);
      }
      hasCurrent.add(player.id);

      let num = (DEFAULT_NUMBER[pos] ?? []).find((n) => !used.has(n));
      if (num === undefined) {
        num = 23;
        while (used.has(num)) num++;
      }
      used.add(num);

      let vid = `${player.id}-26`;
      if (versionIds.has(vid)) vid = `${player.id}-${d.id}-26`;
      versionIds.add(vid);
      versions.push({
        id: vid,
        playerId: player.id,
        label: titleCase(club.shortName),
        season: SEASON,
        year,
        clubId: d.id,
        nationCode: nation,
        position: pos,
        altPositions: alts,
        rating,
        stats: deriveStats(name, pos, rating),
        shirtNumber: num,
      });
    }
  }
  return { clubs: [...clubs.values()], players: [...players.values()], versions };
}
