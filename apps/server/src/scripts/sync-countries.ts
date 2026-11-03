/**
 * Sincroniza países desde API-Football (GET /countries):
 * - guarda la respuesta original en assets/flags/api-football-countries.json
 * - genera assets/flags/api-football-codes.json (código interno → código API)
 * Requiere APISPORTS_KEY.
 */
import { demoCatalog } from '@fu/database';
import { normalizeFlagCode } from '@fu/data-providers';
import { createAssetsService, FLAG_CODES_FILE } from '../assets-service';

const svc = await createAssetsService();
if (!svc.apiFootball.configured) {
  console.error('APISPORTS_KEY no configurada: no se puede sincronizar /countries.');
  process.exit(1);
}
const countries = await svc.apiFootball.getCountries();
await svc.store.writeJson('flags/api-football-countries.json', { fetchedAt: new Date().toISOString(), countries });

const overrides: Record<string, string> = {};
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const ENGLISH: Record<string, string> = { 'gb-eng': 'england', 'gb-sct': 'scotland', 'gb-wls': 'wales', 'gb-nir': 'northern-ireland' };
for (const nation of demoCatalog.nations.values()) {
  const byCode = countries.find((c) => c.code && normalizeFlagCode(c.code) === nation.code);
  const byName = countries.find((c) => norm(c.name) === (ENGLISH[nation.code] ?? ''));
  const hit = byCode ?? byName;
  if (hit?.flag) {
    const code = hit.flag.split('/').pop()!.replace(/\.svg$/, '');
    if (code !== nation.code) overrides[nation.code] = code;
    console.log(`✔ ${nation.code} → ${hit.name} (${hit.flag})`);
  } else {
    console.warn(`✘ ${nation.code}: sin bandera en API-Football (se usará flag-icons)`);
  }
}
await svc.store.writeJson(FLAG_CODES_FILE, overrides);
console.log(`Hecho. ${countries.length} países. Overrides: ${Object.keys(overrides).length}. Cuota restante: ${svc.apiFootball.rateLimit.remainingDaily ?? '¿?'}`);
