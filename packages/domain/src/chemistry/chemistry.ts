import type { Formation } from '../squad/formations';
import { neighbours } from '../squad/formations';
import type { Position } from '../players/types';
import { positionFit, type PositionFit } from '../players/positions';
import { DEFAULT_CHEMISTRY_CONFIG, type ChemistryConfig, type LinkStrength } from './config';

/** Datos mínimos de un futbolista para calcular química (desacoplado del catálogo). */
export interface ChemPlayer {
  playerId: string;
  clubId: string;
  leagueId: string;
  nationCode: string;
  position: Position;
  altPositions: readonly Position[];
  isIcon: boolean;
  loyal: boolean;
}

export interface ChemManager {
  nationCode: string;
  leagueId: string;
}

export interface LinkResult {
  a: number;
  b: number;
  /** null cuando uno de los extremos está vacío. */
  strength: LinkStrength | null;
  points: number;
  shared: { club: boolean; league: boolean; nation: boolean; icon: boolean };
}

export interface PlayerChemistry {
  slot: number;
  fit: PositionFit;
  linkAverage: number;
  base: number;
  loyaltyBonus: number;
  managerBonus: number;
  /** Química individual final (0–10). */
  value: number;
}

export interface ChemistryResult {
  links: LinkResult[];
  players: (PlayerChemistry | null)[];
  /** Química total del equipo (0–100). */
  team: number;
}

const ORDER: LinkStrength[] = ['weak', 'medium', 'strong'];
const maxStrength = (a: LinkStrength, b: LinkStrength) => (ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b);

export function evaluateLink(p: ChemPlayer, q: ChemPlayer, cfg: ChemistryConfig = DEFAULT_CHEMISTRY_CONFIG) {
  const club = p.clubId === q.clubId;
  const league = p.leagueId === q.leagueId;
  const nation = p.nationCode === q.nationCode;
  const points =
    (club ? cfg.linkWeights.club : 0) + (league ? cfg.linkWeights.league : 0) + (nation ? cfg.linkWeights.nation : 0);
  let strength: LinkStrength =
    points >= cfg.thresholds.strong ? 'strong' : points >= cfg.thresholds.medium ? 'medium' : 'weak';
  const icon = p.isIcon || q.isIcon;
  if (icon) {
    const iconStrength = nation ? cfg.iconLinks.sameNation : cfg.iconLinks.otherwise;
    strength = maxStrength(strength, iconStrength);
  }
  return { strength, points, shared: { club, league, nation, icon } };
}

export function calculateChemistry(
  formation: Formation,
  slots: (ChemPlayer | null)[],
  manager: ChemManager | null = null,
  cfg: ChemistryConfig = DEFAULT_CHEMISTRY_CONFIG,
): ChemistryResult {
  const links: LinkResult[] = formation.links.map(([a, b]) => {
    const pa = slots[a];
    const pb = slots[b];
    if (!pa || !pb) {
      return { a, b, strength: null, points: 0, shared: { club: false, league: false, nation: false, icon: false } };
    }
    return { a, b, ...evaluateLink(pa, pb, cfg) };
  });

  const players = formation.slots.map((slot): PlayerChemistry | null => {
    const p = slots[slot.index];
    if (!p) return null;
    const fit = positionFit(p.position, p.altPositions, slot.position);
    const own = links.filter((l) => l.a === slot.index || l.b === slot.index);
    const degree = neighbours(formation, slot.index).length || 1;
    // Los enlaces a slots vacíos cuentan como 0 (penaliza plantillas incompletas).
    const total = own.reduce((acc, l) => acc + (l.strength ? cfg.linkValue[l.strength] : 0), 0);
    const linkAverage = total / degree;
    const row = cfg.individualTable.find((r) => linkAverage >= r.minLinkAverage) ?? cfg.individualTable[cfg.individualTable.length - 1];
    const base = row[fit];
    const loyaltyBonus = p.loyal ? cfg.loyaltyBonus : 0;
    const managerBonus =
      manager && (manager.nationCode === p.nationCode || manager.leagueId === p.leagueId) ? cfg.managerBonus : 0;
    const value = Math.min(cfg.maxIndividual, base + loyaltyBonus + managerBonus);
    return { slot: slot.index, fit, linkAverage, base, loyaltyBonus, managerBonus, value };
  });

  const team = Math.min(
    cfg.maxTeam,
    players.reduce((acc, p) => acc + (p ? p.value : 0), 0),
  );
  return { links, players, team };
}

/** Multiplicador de rendimiento que el simulador aplica a los atributos. */
export function chemistryPerformanceFactor(individual: number, cfg: ChemistryConfig = DEFAULT_CHEMISTRY_CONFIG): number {
  const t = Math.max(0, Math.min(1, individual / cfg.maxIndividual));
  return cfg.performanceFloor + (1 - cfg.performanceFloor) * t;
}
