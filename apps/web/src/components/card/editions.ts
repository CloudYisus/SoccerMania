import type { CSSProperties } from 'react';

/**
 * EDICIONES POR AÑO
 * Cada año tiene un diseño propio (marco metálico, foil, tinte, brillo, color de
 * valoración y acento). La composición, tipografía y proporciones son comunes, de
 * modo que todas las cartas pertenecen al mismo juego.
 *
 * Para añadir un año: añade una entrada a EDITIONS. Los años sin entrada reciben
 * un diseño generado de forma determinista (nunca quedan sin estilo).
 */
export type FoilPattern =
  | 'dots'
  | 'pinstripe'
  | 'crosshatch'
  | 'sunburst'
  | 'hstripes'
  | 'chevrons'
  | 'zigzag'
  | 'waves'
  | 'confetti'
  | 'scanlines'
  | 'diagonal'
  | 'rays'
  | 'brushed'
  | 'hex'
  | 'vstripes'
  | 'diamonds'
  | 'triangles'
  | 'mosaic'
  | 'crystal'
  | 'lattice'
  | 'carbon'
  | 'grid'
  | 'aurora'
  | 'hexgrid'
  | 'stars'
  | 'sparkle';

export type FoilMotion = 'none' | 'sweep' | 'holo' | 'pulse';
/** Ornamento del marco. */
export type FrameStyle = 'bevel' | 'double' | 'filigree' | 'rivets' | 'tape' | 'gems' | 'neon';
/** Silueta de la carta. */
export type CardShape = 'rounded' | 'sharp' | 'arched' | 'notched';

export interface EditionTheme {
  year: number;
  name: string;
  /** Marco metálico. */
  frame: string;
  /** Color base del cuerpo (zona inferior). */
  base: string;
  /** Tinte de la bandera (soft-light). */
  tint: string;
  /** Relleno del número de valoración. */
  rating: string;
  /** Acento: líneas, versión, posición. */
  accent: string;
  /** Halo del escudo y glow al hover. */
  glow: string;
  foil: FoilPattern;
  /** Color de las líneas del foil. */
  foilInk: string;
  motion: FoilMotion;
  frameStyle: FrameStyle;
  shape: CardShape;
}

const metal = (a: string, b: string, c: string, d: string) =>
  `linear-gradient(145deg, ${a} 0%, ${b} 24%, ${c} 48%, ${a} 68%, ${b} 82%, ${d} 100%)`;
const fill = (top: string, bottom: string) => `linear-gradient(180deg, #ffffff 0%, ${top} 40%, ${bottom} 100%)`;

const T = (
  year: number,
  name: string,
  frame: string,
  base: string,
  tint: string,
  rating: string,
  accent: string,
  glow: string,
  foil: FoilPattern,
  foilInk: string,
  motion: FoilMotion = 'none',
): EditionTheme => ({ year, name, frame, base, tint, rating, accent, glow, foil, foilInk, motion, ...(FRAMES[year] ?? generatedFrame(year)) });

/** Marco y silueta de cada año: lo que hace reconocible la edición a primera vista. */
const FRAMES: Record<number, { frameStyle: FrameStyle; shape: CardShape }> = {
  1954: { frameStyle: 'filigree', shape: 'rounded' },
  1962: { frameStyle: 'double', shape: 'arched' },
  1966: { frameStyle: 'rivets', shape: 'sharp' },
  1970: { frameStyle: 'gems', shape: 'arched' },
  1972: { frameStyle: 'tape', shape: 'rounded' },
  1974: { frameStyle: 'bevel', shape: 'notched' },
  1986: { frameStyle: 'filigree', shape: 'notched' },
  1987: { frameStyle: 'double', shape: 'rounded' },
  1994: { frameStyle: 'neon', shape: 'sharp' },
  1996: { frameStyle: 'neon', shape: 'rounded' },
  1998: { frameStyle: 'tape', shape: 'notched' },
  2002: { frameStyle: 'gems', shape: 'rounded' },
  2003: { frameStyle: 'bevel', shape: 'arched' },
  2004: { frameStyle: 'rivets', shape: 'rounded' },
  2005: { frameStyle: 'tape', shape: 'sharp' },
  2006: { frameStyle: 'gems', shape: 'notched' },
  2010: { frameStyle: 'rivets', shape: 'notched' },
  2014: { frameStyle: 'filigree', shape: 'arched' },
  2018: { frameStyle: 'bevel', shape: 'sharp' },
  2022: { frameStyle: 'filigree', shape: 'rounded' },
  2023: { frameStyle: 'neon', shape: 'notched' },
  2024: { frameStyle: 'double', shape: 'sharp' },
  2025: { frameStyle: 'neon', shape: 'arched' },
  2026: { frameStyle: 'gems', shape: 'notched' },
};
const FRAME_STYLES: FrameStyle[] = ['bevel', 'double', 'filigree', 'rivets', 'tape', 'gems', 'neon'];
const SHAPES: CardShape[] = ['rounded', 'sharp', 'arched', 'notched'];
function generatedFrame(year: number) {
  return { frameStyle: FRAME_STYLES[year % FRAME_STYLES.length], shape: SHAPES[Math.floor(year / 7) % SHAPES.length] };
}

export const EDITIONS: Record<number, EditionTheme> = Object.fromEntries(
  [
    T(1954, 'Sepia', metal('#f1d9b5', '#a8784a', '#5a3a1e', '#3a2412'), '#140d07', 'rgba(190,140,80,.55)', fill('#f3dcb8', '#b98a55'), '#d8b27f', 'rgba(216,178,127,.45)', 'dots', 'rgba(40,22,8,.55)'),
    T(1962, 'Esmeralda', metal('#dcf7e4', '#3f9a66', '#174a30', '#0d2e1d'), '#06120c', 'rgba(60,180,110,.4)', fill('#d6f5e2', '#6fcf98'), '#7fd9a4', 'rgba(80,210,140,.45)', 'pinstripe', 'rgba(255,255,255,.22)'),
    T(1966, 'Tweed', metal('#f4e6d0', '#a13232', '#4d1414', '#2a0a0a'), '#140707', 'rgba(170,50,50,.38)', fill('#f6e7cf', '#d4b386'), '#e3c79f', 'rgba(220,120,100,.4)', 'crosshatch', 'rgba(255,240,220,.18)'),
    T(1970, 'Sol', metal('#fff1b8', '#f0a020', '#8a4a08', '#5a2c02'), '#170e03', 'rgba(255,170,40,.42)', fill('#ffe9a8', '#ffb420'), '#ffcf5c', 'rgba(255,190,60,.6)', 'sunburst', 'rgba(255,230,160,.28)', 'pulse'),
    T(1972, 'Mandarina', metal('#ffe0c2', '#ff7a1a', '#9a3d00', '#4d1e00'), '#150903', 'rgba(255,120,30,.4)', fill('#ffd6b8', '#ff8d40'), '#ff9a50', 'rgba(255,130,40,.5)', 'hstripes', 'rgba(255,255,255,.14)'),
    T(1974, 'Cromo', metal('#ffffff', '#9aa3ad', '#3f4650', '#6a737e'), '#0d1012', 'rgba(80,210,140,.24)', fill('#e9eef3', '#aab4bf'), '#4fd58c', 'rgba(140,230,180,.45)', 'chevrons', 'rgba(255,255,255,.16)', 'sweep'),
    T(1986, 'Azteca', metal('#c8fff4', '#19b3a0', '#0a5a52', '#c9a227'), '#04120f', 'rgba(25,180,160,.4)', fill('#fdf0c0', '#e8c25a'), '#f0d070', 'rgba(40,210,190,.5)', 'zigzag', 'rgba(240,208,112,.3)'),
    T(1987, 'Vesubio', metal('#e0f4ff', '#3aa6e8', '#0e4a7a', '#0a2f50'), '#06101b', 'rgba(60,160,230,.42)', fill('#d8f0ff', '#7cc7ff'), '#7cc7ff', 'rgba(80,170,240,.55)', 'waves', 'rgba(255,255,255,.2)'),
    T(1994, 'Neón', metal('#ffd6f5', '#ff3fae', '#2a0f5a', '#19e0d0'), '#0c0517', 'linear-gradient(135deg, rgba(255,60,170,.4), rgba(25,224,208,.32))', fill('#c8fff9', '#3ff0e0'), '#ff6fc4', 'rgba(255,80,190,.55)', 'confetti', 'rgba(255,255,255,.3)'),
    T(1996, 'Holograma', 'conic-gradient(from var(--holo), #ff9ad5, #ffe08a, #9affd8, #8ad4ff, #c49aff, #ff9ad5)', '#07070c', 'rgba(170,150,255,.32)', fill('#efeaff', '#c4b5ff'), '#c4b5ff', 'rgba(180,150,255,.6)', 'scanlines', 'rgba(255,255,255,.18)', 'holo'),
    T(1998, 'Tricolor', metal('#ffffff', '#2f5fd0', '#0b1f55', '#d22c3a'), '#050a1b', 'rgba(47,95,208,.42)', fill('#e2e9ff', '#9db4ff'), '#ff5a66', 'rgba(70,120,240,.5)', 'diagonal', 'rgba(255,255,255,.16)'),
    T(2002, 'Sol Naciente', metal('#fff0f0', '#e23a3a', '#7a0d14', '#d4a64a'), '#15060a', 'rgba(226,58,58,.38)', fill('#ffe7c2', '#ffbf5a'), '#ffd28a', 'rgba(240,80,70,.5)', 'rays', 'rgba(255,220,180,.22)', 'pulse'),
    T(2003, 'Platino', metal('#ffffff', '#d8dde4', '#7c8590', '#eef1f4'), '#111418', 'rgba(220,228,238,.32)', fill('#f4f7fa', '#aeb8c3'), '#e6ebf0', 'rgba(230,236,245,.55)', 'brushed', 'rgba(255,255,255,.22)', 'sweep'),
    T(2004, 'Bronce', metal('#ffe2c4', '#c0763a', '#5e3011', '#8a4b1f'), '#130a04', 'rgba(200,120,60,.4)', fill('#ffe2c4', '#e09a5c'), '#f0aa70', 'rgba(220,140,80,.5)', 'hex', 'rgba(255,220,190,.2)'),
    T(2005, 'Grana', metal('#f7d6e0', '#a5004d', '#3d0a2a', '#1b2e7a'), '#110518', 'rgba(165,0,77,.4)', fill('#ffe0ee', '#ff86bb'), '#ff7ab0', 'rgba(200,40,110,.5)', 'vstripes', 'rgba(40,60,160,.35)'),
    T(2006, 'Azzurro', metal('#e8f0ff', '#2c6fe0', '#0c2a6e', '#d6b456'), '#050b1b', 'rgba(44,111,224,.42)', fill('#fff3c8', '#ffd166'), '#ffd166', 'rgba(60,130,240,.55)', 'diamonds', 'rgba(255,209,102,.24)'),
    T(2010, 'Vuvu', metal('#fff5c8', '#e8b818', '#1a1a1a', '#5a4a10'), '#0b0a06', 'rgba(232,184,24,.36)', fill('#fff3c0', '#f5c518'), '#f5c518', 'rgba(245,197,24,.55)', 'triangles', 'rgba(0,0,0,.3)'),
    T(2014, 'Selva', metal('#d8ffe8', '#1fc47a', '#0a4a3a', '#f2d43a'), '#04110c', 'rgba(31,196,122,.38)', fill('#fbf3b8', '#f2d43a'), '#f2d43a', 'rgba(40,210,130,.5)', 'mosaic', 'rgba(255,255,255,.16)'),
    T(2018, 'Hielo', metal('#ffffff', '#bfe6ff', '#5b7d99', '#d03a3a'), '#09101a', 'rgba(190,230,255,.38)', fill('#f2fbff', '#a9dcff'), '#ff6b6b', 'rgba(190,230,255,.6)', 'crystal', 'rgba(255,255,255,.26)', 'sweep'),
    T(2022, 'Desierto', metal('#fff0d6', '#8a1538', '#3a0716', '#d4a64a'), '#13050a', 'rgba(138,21,56,.42)', fill('#fff3d8', '#f3d99b'), '#f3d99b', 'rgba(200,60,90,.5)', 'lattice', 'rgba(243,217,155,.26)'),
    T(2023, 'Cobalto', metal('#dce8ff', '#2f5bff', '#0d1a66', '#7fa0ff'), '#05091d', 'rgba(47,91,255,.38)', fill('#e6edff', '#a9bcff'), '#7fa0ff', 'rgba(70,110,255,.55)', 'carbon', 'rgba(255,255,255,.1)'),
    T(2024, 'Obsidiana', metal('#e6e6e6', '#3a3a3a', '#0a0a0a', '#c9a227'), '#050505', 'rgba(255,255,255,.1)', fill('#f6e3b0', '#d6a84c'), '#d6a84c', 'rgba(214,168,76,.45)', 'grid', 'rgba(214,168,76,.2)'),
    T(2025, 'Aurora', metal('#e9ffff', '#7b5cff', '#13104a', '#26e0b0'), '#070716', 'linear-gradient(160deg, rgba(123,92,255,.38), rgba(38,224,176,.28))', fill('#dffff8', '#8cf5df'), '#8cf5df', 'rgba(120,100,255,.6)', 'aurora', 'rgba(140,245,223,.28)', 'holo'),
    T(2026, 'Ultimate', metal('#fff3cf', '#e2b85c', '#14110a', '#a5772a'), '#0a0805', 'rgba(243,217,155,.24)', fill('#fff1c4', '#e2b85c'), '#39d98a', 'rgba(243,217,155,.55)', 'hexgrid', 'rgba(243,217,155,.22)', 'sweep'),
  ].map((t) => [t.year, t]),
);

const FALLBACK_FOILS: FoilPattern[] = ['dots', 'diagonal', 'waves', 'hex', 'chevrons', 'grid', 'diamonds', 'scanlines', 'lattice', 'crystal', 'zigzag', 'confetti'];
const MOTIONS: FoilMotion[] = ['none', 'sweep', 'pulse', 'none', 'sweep'];

/**
 * Diseño determinista para años sin entrada curada: cada año recibe una pareja
 * de tonos distinta (principal + contraste), su propio foil, marco y silueta,
 * de modo que la paleta crece con el catálogo sin repetir combinaciones.
 */
function generated(year: number): EditionTheme {
  const hue = (year * 137.508) % 360; // ángulo áureo: tonos muy separados entre años vecinos
  const hue2 = (hue + 150 + (year % 5) * 12) % 360;
  const h = (l: number, sat = 70, a = 1, hh = hue) => `hsla(${Math.round(hh)}, ${sat}%, ${l}%, ${a})`;
  return T(
    year,
    `Edición ${year}`,
    metal(h(93, 60), h(58, 75), h(24, 70), h(62, 75, 1, hue2)),
    h(5, 45),
    `linear-gradient(160deg, ${h(55, 75, 0.4)}, ${h(55, 75, 0.28, hue2)})`,
    fill(h(90, 80), h(66, 80)),
    h(72, 85, 1, hue2),
    h(60, 85, 0.55),
    FALLBACK_FOILS[year % FALLBACK_FOILS.length],
    'rgba(255,255,255,.2)',
    MOTIONS[year % MOTIONS.length],
  );
}

/** Familias de cartas de evento: diseño propio, independiente del año. */
export const EVENT_THEMES: Record<string, Omit<EditionTheme, 'year'>> = {
  toty: {
    name: 'Equipo del Año',
    frame: 'linear-gradient(145deg, #fff6d0 0%, #e8b84a 18%, #1d2c7a 42%, #f8de8c 62%, #0b1550 82%, #d9a53a 100%)',
    base: '#040a26',
    tint: 'linear-gradient(170deg, rgba(40,80,230,.55), rgba(10,20,90,.5))',
    rating: fill('#fff1c4', '#f2c35a'),
    accent: '#ffd76a',
    glow: 'rgba(90,150,255,.75)',
    foil: 'stars',
    foilInk: 'rgba(255,232,170,.85)',
    motion: 'holo',
    frameStyle: 'gems',
    shape: 'notched',
  },
  promesas: {
    name: 'Promesas',
    frame: 'linear-gradient(145deg, #e8fffb 0%, #19c6a7 22%, #5b2ad6 50%, #a9f3ff 72%, #3b1a8f 100%)',
    base: '#08061a',
    tint: 'linear-gradient(160deg, rgba(25,198,167,.45), rgba(91,42,214,.45))',
    rating: fill('#dcfff7', '#7ff5dd'),
    accent: '#7ff5dd',
    glow: 'rgba(120,90,255,.7)',
    foil: 'sparkle',
    foilInk: 'rgba(200,255,245,.7)',
    motion: 'holo',
    frameStyle: 'neon',
    shape: 'arched',
  },
  heroes: {
    name: 'Héroes',
    frame: 'linear-gradient(145deg, #fff 0%, #ff8a3d 22%, #5a0d0d 50%, #ffd28a 72%, #3a0606 100%)',
    base: '#140404',
    tint: 'linear-gradient(160deg, rgba(255,110,40,.45), rgba(120,10,10,.45))',
    rating: fill('#ffe2c4', '#ff9a50'),
    accent: '#ffb070',
    glow: 'rgba(255,120,40,.65)',
    foil: 'rays',
    foilInk: 'rgba(255,220,180,.5)',
    motion: 'sweep',
    frameStyle: 'double',
    shape: 'sharp',
  },
};

/** Tema de una carta: el del evento si lo tiene; si no, el de su año. */
export function cardTheme(year: number, eventKind?: string): EditionTheme {
  const ev = eventKind ? EVENT_THEMES[eventKind] : undefined;
  return ev ? { ...ev, year } : getEdition(year);
}

export function getEdition(year: number): EditionTheme {
  return EDITIONS[year] ?? generated(year);
}

/** Variables CSS de una edición (para cartas, filas, etiquetas, sobres…). */
export function editionStyle(year: number, eventKind?: string): CSSProperties {
  const e = cardTheme(year, eventKind);
  return {
    '--e-frame': e.frame,
    '--e-base': e.base,
    '--e-tint': e.tint,
    '--e-rating': e.rating,
    '--e-accent': e.accent,
    '--e-glow': e.glow,
    '--e-foil-ink': e.foilInk,
  } as CSSProperties;
}
