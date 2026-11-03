import { useMemo } from 'react';
import {
  calculateChemistry,
  getFormation,
  teamRating,
  type ChemPlayer,
  type ChemistryResult,
  type Formation,
  type ResolvedCard,
  type Squad,
  type PlayerCard,
} from '@fu/domain';
import { managerById, resolve } from '../data/catalog';
import { useGame } from './gameStore';

export interface SquadView {
  formation: Formation;
  starters: (ResolvedCard | null)[];
  bench: (ResolvedCard | null)[];
  chemistry: ChemistryResult;
  rating: number;
  complete: boolean;
  manager: ReturnType<typeof managerById>;
}

export function toChemPlayer(r: ResolvedCard): ChemPlayer {
  return {
    playerId: r.player.id,
    clubId: r.club.id,
    leagueId: r.league.id,
    nationCode: r.nation.code,
    position: r.position,
    altPositions: r.version.altPositions,
    isIcon: r.rarity.chemistryProfile === 'icon',
    loyal: r.card.loyal,
  };
}

/** Calcula la vista completa de una plantilla (química real, rating, etc.). */
export function computeSquadView(squad: Squad, cards: Record<string, PlayerCard>): SquadView {
  const formation = getFormation(squad.formationId);
  const res = (id: string | null) => (id && cards[id] ? resolve(cards[id]) : null);
  const starters = squad.starters.map(res);
  const bench = squad.bench.map(res);
  const manager = managerById(squad.managerId);
  const chemistry = calculateChemistry(
    formation,
    starters.map((r) => (r ? toChemPlayer(r) : null)),
    manager ? { nationCode: manager.nationCode, leagueId: manager.leagueId } : null,
  );
  const rating = teamRating(starters.map((r) => r?.version.rating ?? null));
  return { formation, starters, bench, chemistry, rating, complete: starters.every(Boolean), manager };
}

export function useSquadView(): SquadView {
  const squad = useGame((s) => s.squad);
  const cards = useGame((s) => s.cards);
  return useMemo(() => computeSquadView(squad, cards), [squad, cards]);
}
