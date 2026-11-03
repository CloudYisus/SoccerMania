/**
 * Entidades del "mundo" futbolístico. Los identificadores internos son estables
 * y propios del juego; los identificadores de proveedores externos se guardan
 * aparte (apiFootballId, etc.) para poder re-sincronizar recursos.
 */

/** Código de bandera: ISO 3166-1 alpha-2 en minúsculas o subdivisión (gb-eng, gb-sct…). */
export type FlagCode = string;

export interface Nation {
  /** Código usado para la bandera y la química (p. ej. "br", "gb-eng"). */
  code: FlagCode;
  name: string;
  /** Nombre corto en mayúsculas para las cartas (p. ej. "BRASIL"). */
  cardName: string;
  confederation: 'UEFA' | 'CONMEBOL' | 'CONCACAF' | 'CAF' | 'AFC' | 'OFC';
}

export interface League {
  id: string;
  name: string;
  shortName: string;
  nationCode: FlagCode;
  /** ID de la competición en API-Football (para su logo). null = sin mapear. */
  apiFootballId: number | null;
}

export interface ClubColors {
  primary: string;
  secondary: string;
}

export interface Club {
  id: string;
  name: string;
  shortName: string;
  leagueId: string;
  nationCode: FlagCode;
  colors: ClubColors;
  /**
   * ID del equipo en API-Football. Se usa para el escudo:
   * https://media.api-sports.io/football/teams/{id}.png
   * null = sin mapear (usar sync:teams o un escudo manual).
   */
  apiFootballId: number | null;
  /** Nombre para buscar en TheSportsDB si API-Football no tiene escudo. */
  theSportsDbName?: string;
  /** El club/selección es histórico y requiere escudo manual. */
  historical?: boolean;
}
