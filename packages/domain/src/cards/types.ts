import type { Position } from '../players/types';

export type CardSource = 'starter' | 'pack' | 'market' | 'reward';

/** PlayerCard: edición coleccionable que posee un usuario. */
export interface PlayerCard {
  id: string;
  versionId: string;
  source: CardSource;
  acquiredAt: number;
  /** Lealtad clásica: cartas de sobre/recompensa o tras 10 partidos en el club. */
  loyal: boolean;
  gamesPlayed: number;
  /** Cambio de posición aplicado (modificador de posición clásico). */
  positionOverride?: Position;
  untradeable: boolean;
}

export const LOYALTY_GAMES = 10;

export function createCard(
  id: string,
  versionId: string,
  source: CardSource,
  now: number,
): PlayerCard {
  const loyal = source === 'pack' || source === 'reward' || source === 'starter';
  return {
    id,
    versionId,
    source,
    acquiredAt: now,
    loyal,
    gamesPlayed: 0,
    untradeable: source === 'reward' || source === 'starter',
  };
}

export function registerGamePlayed(card: PlayerCard): PlayerCard {
  const gamesPlayed = card.gamesPlayed + 1;
  return { ...card, gamesPlayed, loyal: card.loyal || gamesPlayed >= LOYALTY_GAMES };
}
