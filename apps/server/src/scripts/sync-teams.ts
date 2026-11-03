/**
 * Verifica/asocia los IDs de API-Football de los clubes del catálogo buscando por
 * nombre (GET /teams?search=) y guarda el resultado en assets/clubs/mapping.json.
 * El mapeo tiene prioridad sobre los apiFootballId del seed. Requiere APISPORTS_KEY.
 */
import { demoCatalog } from '@fu/database';
import { createAssetsService, CLUB_MAPPING_FILE, type ClubMappingEntry } from '../assets-service';

const svc = await createAssetsService();
if (!svc.apiFootball.configured) {
  console.error('APISPORTS_KEY no configurada: no se puede sincronizar /teams.');
  process.exit(1);
}
const COUNTRY_EN: Record<string, string> = {
  es: 'Spain', 'gb-eng': 'England', it: 'Italy', de: 'Germany', fr: 'France', nl: 'Netherlands', pt: 'Portugal',
  br: 'Brazil', ar: 'Argentina', us: 'USA', sa: 'Saudi-Arabia', hu: 'Hungary',
};
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const mapping: Record<string, ClubMappingEntry> = { ...svc.clubMapping };

for (const club of demoCatalog.clubs.values()) {
  const term = club.theSportsDbName ?? club.name;
  try {
    const items = await svc.apiFootball.searchTeams(term);
    const country = COUNTRY_EN[club.nationCode];
    const candidates = items.filter((i) => !i.team.national && (!country || i.team.country === country));
    const best =
      candidates.find((i) => norm(i.team.name) === norm(term)) ??
      candidates.find((i) => club.apiFootballId && i.team.id === club.apiFootballId) ??
      candidates[0];
    if (best) {
      mapping[club.id] = { apiFootballId: best.team.id, name: best.team.name, logo: best.team.logo ?? null, verifiedAt: new Date().toISOString() };
      const flag = club.apiFootballId && club.apiFootballId !== best.team.id ? ` (seed tenía ${club.apiFootballId})` : '';
      console.log(`✔ ${club.id} → ${best.team.id} ${best.team.name}${flag}`);
    } else {
      console.warn(`✘ ${club.id}: sin coincidencias para "${term}" — usa un escudo manual en assets/clubs/manual/${club.id}.png`);
    }
  } catch (e) {
    console.warn(`✘ ${club.id}: ${e instanceof Error ? e.message : e}`);
  }
  await new Promise((r) => setTimeout(r, 6500)); // respeta el límite por minuto del plan gratuito
}
await svc.store.writeJson(CLUB_MAPPING_FILE, mapping);
console.log(`Mapeo guardado en assets/${CLUB_MAPPING_FILE}. Cuota restante: ${svc.apiFootball.rateLimit.remainingDaily ?? '¿?'}`);
