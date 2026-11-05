import { useMemo } from 'react';
import {
  POSITION_LINE,
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
    isIcon: r.player.icon,
    loyal: r.card.loyal,
  };
}

/** Calcula la vista completa de una plantilla (química real, rating, etc.). */
export function computeSquadView(squad: Squad, cards: Record<string, PlayerCard>, inForm: Record<string, string> = {}): SquadView {
  const formation = getFormation(squad.formationId);
  // Las cartas En Forma juegan su versión mejorada (sólo el próximo partido).
  const res = (id: string | null) => (id && cards[id] ? resolve(inForm[id] ? { ...cards[id], versionId: inForm[id] } : cards[id]) : null);
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
  const inForm = useGame((s) => s.inForm);
  return useMemo(() => computeSquadView(squad, cards, inForm), [squad, cards, inForm]);
}

/**
 * Once del día de partido: los titulares lesionados se sustituyen por el mejor
 * suplente disponible de su misma línea (o, si no hay, por el mejor del club).
 */
export function matchdaySquad(squad: Squad, cards: Record<string, PlayerCard>, injuries: Record<string, number>, listed: Set<string> = new Set()) {
  const replaced: { out: string; in: string }[] = [];
  const formation = getFormation(squad.formationId);
  const used = new Set([...squad.starters, ...squad.bench].filter(Boolean) as string[]);
  const starters = [...squad.starters];
  const bench = [...squad.bench];
  const playerOf = (id: string) => resolve(cards[id]).player.id;
  const onPitch = () => new Set(starters.filter(Boolean).map((id) => playerOf(id!)));
  starters.forEach((id, i) => {
    if (!id || !injuries[id]) return;
    const line = POSITION_LINE[formation.slots[i].position];
    const taken = onPitch();
    const fits = (cid: string) => {
      if (injuries[cid] || listed.has(cid) || !cards[cid] || taken.has(playerOf(cid))) return false;
      const r = resolve(cards[cid]);
      return POSITION_LINE[r.position] === line && (line === 'goalkeeper') === (r.position === 'GK');
    };
    const rating = (cid: string) => resolve(cards[cid]).version.rating;
    const fromBench = bench.filter((b): b is string => !!b && fits(b)).sort((a, b) => rating(b) - rating(a))[0];
    const fromClub = Object.keys(cards).filter((c) => !used.has(c) && fits(c)).sort((a, b) => rating(b) - rating(a))[0];
    const pick = fromBench ?? fromClub;
    if (!pick) return;
    starters[i] = pick;
    if (fromBench) bench[bench.indexOf(pick)] = id;
    used.add(pick);
    replaced.push({ out: id, in: pick });
  });
  return { squad: { ...squad, starters, bench }, replaced };
}
