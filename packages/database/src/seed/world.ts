import type { Club, League, Nation } from '@fu/domain';

/**
 * DATOS DE DEMOSTRACIÓN — mundo del juego.
 *
 * Los `apiFootballId` de clubes y ligas son un mapeo inicial NO VERIFICADO contra
 * la API en este entorno (sin credenciales). Ejecuta `npm run sync:teams` con una
 * APISPORTS_KEY válida para verificarlos/corregirlos: el resultado se guarda en
 * assets/clubs/mapping.json y tiene prioridad sobre estos valores.
 */
export const NATIONS: Nation[] = [
  { code: 'br', name: 'Brasil', cardName: 'BRASIL', confederation: 'CONMEBOL' },
  { code: 'ar', name: 'Argentina', cardName: 'ARGENTINA', confederation: 'CONMEBOL' },
  { code: 'uy', name: 'Uruguay', cardName: 'URUGUAY', confederation: 'CONMEBOL' },
  { code: 'pt', name: 'Portugal', cardName: 'PORTUGAL', confederation: 'UEFA' },
  { code: 'fr', name: 'Francia', cardName: 'FRANCIA', confederation: 'UEFA' },
  { code: 'de', name: 'Alemania', cardName: 'ALEMANIA', confederation: 'UEFA' },
  { code: 'nl', name: 'Países Bajos', cardName: 'PAÍSES BAJOS', confederation: 'UEFA' },
  { code: 'es', name: 'España', cardName: 'ESPAÑA', confederation: 'UEFA' },
  { code: 'it', name: 'Italia', cardName: 'ITALIA', confederation: 'UEFA' },
  { code: 'gb-eng', name: 'Inglaterra', cardName: 'INGLATERRA', confederation: 'UEFA' },
  { code: 'hr', name: 'Croacia', cardName: 'CROACIA', confederation: 'UEFA' },
  { code: 'be', name: 'Bélgica', cardName: 'BÉLGICA', confederation: 'UEFA' },
  { code: 'no', name: 'Noruega', cardName: 'NORUEGA', confederation: 'UEFA' },
  { code: 'hu', name: 'Hungría', cardName: 'HUNGRÍA', confederation: 'UEFA' },
  { code: 'mx', name: 'México', cardName: 'MÉXICO', confederation: 'CONCACAF' },
  { code: 'ca', name: 'Canadá', cardName: 'CANADÁ', confederation: 'CONCACAF' },
  { code: 'us', name: 'Estados Unidos', cardName: 'EE. UU.', confederation: 'CONCACAF' },
  { code: 'eg', name: 'Egipto', cardName: 'EGIPTO', confederation: 'CAF' },
  { code: 'ma', name: 'Marruecos', cardName: 'MARRUECOS', confederation: 'CAF' },
  { code: 'sa', name: 'Arabia Saudí', cardName: 'ARABIA SAUDÍ', confederation: 'AFC' },
];

export const LEAGUES: League[] = [
  { id: 'eng-premier', name: 'Premier League', shortName: 'PREMIER', nationCode: 'gb-eng', apiFootballId: 39 },
  { id: 'esp-laliga', name: 'LaLiga', shortName: 'LALIGA', nationCode: 'es', apiFootballId: 140 },
  { id: 'ita-serie-a', name: 'Serie A', shortName: 'SERIE A', nationCode: 'it', apiFootballId: 135 },
  { id: 'ger-bundesliga', name: 'Bundesliga', shortName: 'BUNDESLIGA', nationCode: 'de', apiFootballId: 78 },
  { id: 'fra-ligue-1', name: 'Ligue 1', shortName: 'LIGUE 1', nationCode: 'fr', apiFootballId: 61 },
  { id: 'ned-eredivisie', name: 'Eredivisie', shortName: 'EREDIVISIE', nationCode: 'nl', apiFootballId: 88 },
  { id: 'por-primeira', name: 'Primeira Liga', shortName: 'PRIMEIRA', nationCode: 'pt', apiFootballId: 94 },
  { id: 'bra-serie-a', name: 'Brasileirão Série A', shortName: 'BRASILEIRÃO', nationCode: 'br', apiFootballId: 71 },
  { id: 'arg-primera', name: 'Liga Profesional Argentina', shortName: 'LPF', nationCode: 'ar', apiFootballId: 128 },
  { id: 'usa-mls', name: 'Major League Soccer', shortName: 'MLS', nationCode: 'us', apiFootballId: 253 },
  { id: 'ksa-pro', name: 'Saudi Pro League', shortName: 'SPL', nationCode: 'sa', apiFootballId: 307 },
  { id: 'hun-nb1', name: 'Liga húngara (histórica)', shortName: 'NB I', nationCode: 'hu', apiFootballId: null },
];

const c = (
  id: string,
  name: string,
  shortName: string,
  leagueId: string,
  nationCode: string,
  primary: string,
  secondary: string,
  apiFootballId: number | null,
  extra: Partial<Club> = {},
): Club => ({ id, name, shortName, leagueId, nationCode, colors: { primary, secondary }, apiFootballId, ...extra });

export const CLUBS: Club[] = [
  c('real-madrid', 'Real Madrid C.F.', 'REAL MADRID', 'esp-laliga', 'es', '#f4f1e8', '#1b2a5c', 541, { theSportsDbName: 'Real Madrid' }),
  c('barcelona', 'FC Barcelona', 'BARCELONA', 'esp-laliga', 'es', '#a50044', '#004d98', 529, { theSportsDbName: 'Barcelona' }),
  c('atletico', 'Atlético de Madrid', 'ATLÉTICO', 'esp-laliga', 'es', '#cb3524', '#262e61', 530, { theSportsDbName: 'Atletico Madrid' }),
  c('man-city', 'Manchester City', 'MAN CITY', 'eng-premier', 'gb-eng', '#6cabdd', '#1c2c5b', 50, { theSportsDbName: 'Manchester City' }),
  c('liverpool', 'Liverpool FC', 'LIVERPOOL', 'eng-premier', 'gb-eng', '#c8102e', '#f6eb61', 40, { theSportsDbName: 'Liverpool' }),
  c('arsenal', 'Arsenal FC', 'ARSENAL', 'eng-premier', 'gb-eng', '#ef0107', '#f5f5f5', 42, { theSportsDbName: 'Arsenal' }),
  c('man-utd', 'Manchester United', 'MAN UTD', 'eng-premier', 'gb-eng', '#da291c', '#111111', 33, { theSportsDbName: 'Manchester United' }),
  c('west-ham', 'West Ham United', 'WEST HAM', 'eng-premier', 'gb-eng', '#7a263a', '#1bb1e7', 48, { theSportsDbName: 'West Ham' }),
  c('bayern', 'FC Bayern München', 'BAYERN', 'ger-bundesliga', 'de', '#dc052d', '#f5f5f5', 157, { theSportsDbName: 'Bayern Munich' }),
  c('juventus', 'Juventus FC', 'JUVENTUS', 'ita-serie-a', 'it', '#f5f5f5', '#111111', 496, { theSportsDbName: 'Juventus' }),
  c('inter', 'FC Internazionale', 'INTER', 'ita-serie-a', 'it', '#0068a8', '#111111', 505, { theSportsDbName: 'Inter Milan' }),
  c('milan', 'AC Milan', 'MILAN', 'ita-serie-a', 'it', '#fb090b', '#111111', 489, { theSportsDbName: 'AC Milan' }),
  c('napoli', 'SSC Napoli', 'NAPOLI', 'ita-serie-a', 'it', '#12a0d7', '#f5f5f5', 492, { theSportsDbName: 'Napoli' }),
  c('roma', 'AS Roma', 'ROMA', 'ita-serie-a', 'it', '#8e1f2f', '#f0bc42', 497, { theSportsDbName: 'Roma' }),
  c('psg', 'Paris Saint-Germain', 'PARIS SG', 'fra-ligue-1', 'fr', '#004170', '#da291c', 85, { theSportsDbName: 'Paris SG' }),
  c('ajax', 'AFC Ajax', 'AJAX', 'ned-eredivisie', 'nl', '#d2122e', '#f5f5f5', 194, { theSportsDbName: 'Ajax' }),
  c('psv', 'PSV Eindhoven', 'PSV', 'ned-eredivisie', 'nl', '#ed1c24', '#f5f5f5', 197, { theSportsDbName: 'PSV Eindhoven' }),
  c('benfica', 'S.L. Benfica', 'BENFICA', 'por-primeira', 'pt', '#e83030', '#f5f5f5', 211, { theSportsDbName: 'Benfica' }),
  c('santos', 'Santos FC', 'SANTOS', 'bra-serie-a', 'br', '#f5f5f5', '#111111', 128, { theSportsDbName: 'Santos' }),
  c('boca', 'Boca Juniors', 'BOCA', 'arg-primera', 'ar', '#0b3b8c', '#f6c22b', 451, { theSportsDbName: 'Boca Juniors' }),
  c('inter-miami', 'Inter Miami CF', 'INTER MIAMI', 'usa-mls', 'us', '#f7b5cd', '#231f20', 9568, { theSportsDbName: 'Inter Miami' }),
  c('al-nassr', 'Al Nassr FC', 'AL NASSR', 'ksa-pro', 'sa', '#fcd116', '#1f3f99', 2939, { theSportsDbName: 'Al-Nassr' }),
  c('al-hilal', 'Al Hilal SFC', 'AL HILAL', 'ksa-pro', 'sa', '#1450a0', '#f5f5f5', 2932, { theSportsDbName: 'Al-Hilal' }),
  c('honved', 'Budapest Honvéd', 'HONVÉD', 'hun-nb1', 'hu', '#d71920', '#111111', null, { historical: true, theSportsDbName: 'Honved' }),
];

/** Mánagers de demostración (personajes ficticios del juego). */
export const MANAGERS = [
  { id: 'mgr-ortega', name: 'L. Ortega', nationCode: 'es', leagueId: 'esp-laliga' },
  { id: 'mgr-whitmore', name: 'J. Whitmore', nationCode: 'gb-eng', leagueId: 'eng-premier' },
  { id: 'mgr-ferraro', name: 'M. Ferraro', nationCode: 'it', leagueId: 'ita-serie-a' },
  { id: 'mgr-carvalho', name: 'R. Carvalho', nationCode: 'br', leagueId: 'bra-serie-a' },
  { id: 'mgr-lambert', name: 'A. Lambert', nationCode: 'fr', leagueId: 'fra-ligue-1' },
  { id: 'mgr-vogel', name: 'K. Vogel', nationCode: 'de', leagueId: 'ger-bundesliga' },
  { id: 'mgr-sosa', name: 'D. Sosa', nationCode: 'ar', leagueId: 'arg-primera' },
  { id: 'mgr-ibarra', name: 'F. Ibarra', nationCode: 'mx', leagueId: 'esp-laliga' },
];
