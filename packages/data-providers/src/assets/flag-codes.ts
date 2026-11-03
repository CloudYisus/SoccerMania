/**
 * Mapeo de códigos de bandera internos → códigos de proveedores.
 * Internamente usamos ISO 3166-1 alpha-2 en minúsculas y las subdivisiones de
 * flag-icons para las naciones futbolísticas británicas.
 */
export const SPECIAL_FLAG_CODES: Record<string, { name: string; apiFootball: string; flagIcons: string }> = {
  'gb-eng': { name: 'Inglaterra', apiFootball: 'gb-eng', flagIcons: 'gb-eng' },
  'gb-sct': { name: 'Escocia', apiFootball: 'gb-sct', flagIcons: 'gb-sct' },
  'gb-wls': { name: 'Gales', apiFootball: 'gb-wls', flagIcons: 'gb-wls' },
  'gb-nir': { name: 'Irlanda del Norte', apiFootball: 'gb-nir', flagIcons: 'gb-nir' },
  xk: { name: 'Kosovo', apiFootball: 'xk', flagIcons: 'xk' },
};

/** Normaliza un código de bandera a minúsculas con guion (GB-ENG → gb-eng). */
export function normalizeFlagCode(code: string): string {
  return code.trim().toLowerCase().replace(/_/g, '-');
}

/** Código a solicitar en media.api-sports.io/flags/{code}.svg */
export function apiFootballFlagCode(code: string, overrides: Record<string, string> = {}): string {
  const c = normalizeFlagCode(code);
  return overrides[c] ?? SPECIAL_FLAG_CODES[c]?.apiFootball ?? c;
}

/** Código de fichero en flag-icons/flags/4x3/{code}.svg */
export function flagIconsCode(code: string): string {
  const c = normalizeFlagCode(code);
  return SPECIAL_FLAG_CODES[c]?.flagIcons ?? c;
}

export function isValidFlagCode(code: string): boolean {
  return /^[a-z]{2}(-[a-z]{3})?$/.test(normalizeFlagCode(code));
}
