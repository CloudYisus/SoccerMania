import { describe, expect, it } from 'vitest';
import type { Club } from '@fu/domain';
import { ApiFootballClient } from './api-football/client';
import { TheSportsDbClient } from './thesportsdb/client';
import { AssetProvider } from './assets/asset-provider';
import { ClubCrestProvider, CountryFlagProvider, type ProviderDeps } from './assets/providers';
import { apiFootballFlagCode, flagIconsCode, isValidFlagCode, normalizeFlagCode } from './assets/flag-codes';
import type { AssetRecord, AssetStore } from './assets/types';
import type { FetchLike } from './http';

type Route = (url: string, headers?: Record<string, string>) => { status: number; body?: unknown; bytes?: Uint8Array; type?: string };
const mockFetch = (route: Route): FetchLike & { calls: string[] } => {
  const calls: string[] = [];
  const f = (async (url: string, init?: { headers?: Record<string, string> }) => {
    calls.push(url);
    const r = route(url, init?.headers);
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      headers: { get: (h: string) => (h === 'content-type' ? r.type ?? 'application/json' : h === 'x-ratelimit-requests-remaining' ? '99' : null) },
      json: async () => r.body,
      arrayBuffer: async () => (r.bytes ?? new Uint8Array()).buffer as ArrayBuffer,
    };
  }) as FetchLike & { calls: string[] };
  f.calls = calls;
  return f;
};

class MemoryStore implements AssetStore {
  files = new Map<string, Uint8Array>();
  manifest: Record<string, AssetRecord> = {};
  async exists(p: string) {
    return this.files.has(p);
  }
  async write(p: string, d: Uint8Array) {
    this.files.set(p, d);
  }
  async findManual(dir: string, base: string, exts: string[]) {
    for (const e of exts) if (this.files.has(`${dir}/${base}.${e}`)) return `${dir}/${base}.${e}`;
    return null;
  }
  async loadManifest() {
    return this.manifest;
  }
  async saveManifest(m: Record<string, AssetRecord>) {
    this.manifest = m;
  }
}

const PNG = new Uint8Array(200).fill(7);
const club: Club = {
  id: 'real-madrid',
  name: 'Real Madrid C.F.',
  shortName: 'REAL MADRID',
  leagueId: 'esp',
  nationCode: 'es',
  colors: { primary: '#fff', secondary: '#000' },
  apiFootballId: 541,
  theSportsDbName: 'Real Madrid',
};

describe('códigos de bandera', () => {
  it('normaliza y mapea casos especiales', () => {
    expect(normalizeFlagCode('GB-ENG')).toBe('gb-eng');
    expect(apiFootballFlagCode('gb-sct')).toBe('gb-sct');
    expect(apiFootballFlagCode('es', { es: 'es-x' })).toBe('es-x');
    expect(flagIconsCode('XK')).toBe('xk');
    expect(isValidFlagCode('gb-wls')).toBe(true);
    expect(isValidFlagCode('../etc')).toBe(false);
  });
});

describe('ApiFootballClient', () => {
  it('envía la clave en cabecera y valida la respuesta de /teams', async () => {
    const f = mockFetch((url, headers) => {
      expect(headers?.['x-apisports-key']).toBe('k');
      expect(url).toBe('https://v3.football.api-sports.io/teams?league=39&season=2025');
      return { status: 200, body: { errors: [], results: 1, response: [{ team: { id: 33, name: 'Manchester United', logo: 'x' }, venue: {} }] } };
    });
    const c = new ApiFootballClient({ apiKey: 'k', fetch: f });
    const teams = await c.getTeams({ league: 39, season: 2025 });
    expect(teams[0].team.id).toBe(33);
    expect(c.rateLimit.remainingDaily).toBe(99);
    expect(c.teamLogoUrl(33)).toBe('https://media.api-sports.io/football/teams/33.png');
    expect(c.flagUrl('BR')).toBe('https://media.api-sports.io/flags/br.svg');
  });
  it('propaga los errores de la API', async () => {
    const f = mockFetch(() => ({ status: 200, body: { errors: { token: 'Error/Missing application key.' }, response: [] } }));
    await expect(new ApiFootballClient({ apiKey: 'k', fetch: f }).getCountries()).rejects.toThrow(/application key/);
  });
  it('falla sin clave sin llamar a la red', async () => {
    const f = mockFetch(() => ({ status: 200, body: {} }));
    const c = new ApiFootballClient({ apiKey: '', fetch: f });
    expect(c.configured).toBe(false);
    await expect(c.getCountries()).rejects.toThrow(/APISPORTS_KEY/);
    expect(f.calls).toHaveLength(0);
  });
});

describe('AssetProvider', () => {
  const setup = (route: Route, opts: Partial<ProviderDeps> = {}) => {
    const store = new MemoryStore();
    const f = mockFetch(route);
    const deps: ProviderDeps = {
      apiFootball: new ApiFootballClient({ apiKey: undefined, fetch: f }),
      theSportsDb: new TheSportsDbClient({ fetch: f }),
      manual: (d, b, e) => store.findManual(d, b, e),
      ...opts,
    };
    const provider = new AssetProvider({ store, fetch: f, autoFetch: true, retryHours: 1 });
    return { store, f, deps, provider };
  };

  it('descarga el escudo por ID de API-Football y lo cachea', async () => {
    const { store, f, deps, provider } = setup((url) =>
      url.endsWith('/teams/541.png') ? { status: 200, bytes: PNG, type: 'image/png' } : { status: 404 },
    );
    const sub = new ClubCrestProvider(deps);
    const rec = await provider.resolve(sub, club);
    expect(rec.status).toBe('ready');
    expect(rec.provider).toBe('api-football');
    expect(rec.sourceUrl).toBe('https://media.api-sports.io/football/teams/541.png');
    expect(store.files.has('cache/crest/real-madrid.png')).toBe(true);
    await provider.resolve(sub, club);
    expect(f.calls).toHaveLength(1); // segunda vez desde caché
  });

  it('cae a TheSportsDB si API-Football falla', async () => {
    const { deps, provider } = setup((url) => {
      if (url.includes('api-sports')) return { status: 500 };
      if (url.includes('searchteams')) return { status: 200, body: { teams: [{ idTeam: '1', strTeam: 'Real Madrid', strBadge: 'https://img/rm.png' }] } };
      if (url === 'https://img/rm.png') return { status: 200, bytes: PNG, type: 'image/png' };
      return { status: 404 };
    });
    const rec = await provider.resolve(new ClubCrestProvider(deps), club);
    expect(rec.provider).toBe('thesportsdb');
    expect(rec.attempts?.[0].provider).toBe('api-football');
  });

  it('prioriza recursos manuales (escudos históricos)', async () => {
    const { store, deps, provider, f } = setup(() => ({ status: 500 }));
    store.files.set('clubs/manual/real-madrid.png', PNG);
    const rec = await provider.resolve(new ClubCrestProvider(deps), club);
    expect(rec.provider).toBe('manual');
    expect(f.calls).toHaveLength(0);
  });

  it('usa flag-icons como respaldo local de banderas', async () => {
    const { deps, provider } = setup(() => ({ status: 503 }), { flagIconsPath: async (c) => `/node_modules/flag-icons/flags/4x3/${c}.svg` });
    const rec = await provider.resolve(new CountryFlagProvider(deps), 'gb-eng');
    expect(rec.provider).toBe('flag-icons');
    expect(rec.localPath).toContain('gb-eng.svg');
  });

  it('marca el recurso como fallido y no reintenta antes de tiempo', async () => {
    const { deps, provider, f } = setup(() => ({ status: 500 }));
    const noTsdb = { ...deps, theSportsDb: null };
    const sub = new ClubCrestProvider(noTsdb);
    const rec = await provider.resolve(sub, club);
    expect(rec.status).toBe('failed');
    await provider.resolve(sub, club);
    expect(f.calls).toHaveLength(1);
  });

  it('rechaza respuestas que no son imágenes', async () => {
    const { deps, provider } = setup(() => ({ status: 200, body: {}, type: 'text/html' }));
    const rec = await provider.resolve(new ClubCrestProvider({ ...deps, theSportsDb: null }), club);
    expect(rec.status).toBe('failed');
    expect(rec.error).toMatch(/tipo de contenido/);
  });
});
