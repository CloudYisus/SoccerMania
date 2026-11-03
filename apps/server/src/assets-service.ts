import { createRequire } from 'node:module';
import { access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  ApiFootballClient,
  AssetProvider,
  ClubCrestProvider,
  CompetitionLogoProvider,
  CountryFlagProvider,
  PlayerPortraitProvider,
  TheSportsDbClient,
  type AssetKind,
  type AssetRecord,
  type ProviderDeps,
} from '@fu/data-providers';
import { demoCatalog } from '@fu/database';
import { ASSETS_ROOT, config } from './config';
import { FsAssetStore } from './fs-store';

const require = createRequire(import.meta.url);

function flagIconsDir(): string | null {
  try {
    return join(dirname(require.resolve('flag-icons/package.json')), 'flags', '4x3');
  } catch {
    return null;
  }
}

export interface ClubMappingEntry {
  apiFootballId: number | null;
  name?: string;
  logo?: string | null;
  verifiedAt: string;
}

export const CLUB_MAPPING_FILE = 'clubs/mapping.json';
export const FLAG_CODES_FILE = 'flags/api-football-codes.json';

export async function createAssetsService() {
  const store = new FsAssetStore(ASSETS_ROOT);
  const apiFootball = new ApiFootballClient({
    apiKey: config.apiSports.key,
    baseUrl: config.apiSports.baseUrl,
    mediaUrl: config.apiSports.mediaUrl,
  });
  const theSportsDb = new TheSportsDbClient({ apiKey: config.theSportsDb.key, baseUrl: config.theSportsDb.baseUrl });
  const clubMapping = await store.readJson<Record<string, ClubMappingEntry>>(CLUB_MAPPING_FILE, {});
  const flagOverrides = await store.readJson<Record<string, string>>(FLAG_CODES_FILE, {});
  const flagsDir = flagIconsDir();

  const deps: ProviderDeps = {
    apiFootball,
    theSportsDb,
    manual: (dir, base, exts) => store.findManual(dir, base, exts),
    flagCodeOverrides: flagOverrides,
    flagIconsPath: async (code) => {
      if (!flagsDir) return null;
      const p = join(flagsDir, `${code}.svg`);
      try {
        await access(p);
        return p;
      } catch {
        return null;
      }
    },
  };

  const provider = new AssetProvider({
    store,
    autoFetch: config.assets.autoFetch,
    retryHours: config.assets.retryHours,
  });
  await provider.init();

  const subs = {
    flag: new CountryFlagProvider(deps),
    crest: new ClubCrestProvider(deps, () =>
      Object.fromEntries(Object.entries(clubMapping).map(([k, v]) => [k, v.apiFootballId])),
    ),
    portrait: new PlayerPortraitProvider(deps),
    competition: new CompetitionLogoProvider(deps),
  };

  /** Resuelve (con caché) un recurso de cualquier tipo por ID de entidad del catálogo. */
  async function resolve(kind: AssetKind, entityId: string, force = false): Promise<AssetRecord | null> {
    switch (kind) {
      case 'flag':
        return demoCatalog.nations.has(entityId) || /^[a-z]{2}(-[a-z]{3})?$/.test(entityId)
          ? provider.resolve(subs.flag, entityId, { force })
          : null;
      case 'crest': {
        const club = demoCatalog.clubs.get(entityId);
        return club ? provider.resolve(subs.crest, club, { force }) : null;
      }
      case 'portrait': {
        const p = demoCatalog.players.get(entityId);
        return p ? provider.resolve(subs.portrait, p, { force }) : null;
      }
      case 'competition': {
        const l = demoCatalog.leagues.get(entityId);
        return l ? provider.resolve(subs.competition, l, { force }) : null;
      }
    }
  }

  /** Precalienta la caché de todo el catálogo (en segundo plano, concurrencia limitada). */
  async function warm() {
    const jobs: [AssetKind, string][] = [
      ...[...demoCatalog.nations.keys()].map((k) => ['flag', k] as [AssetKind, string]),
      ...[...demoCatalog.clubs.keys()].map((k) => ['crest', k] as [AssetKind, string]),
      ...[...demoCatalog.leagues.keys()].map((k) => ['competition', k] as [AssetKind, string]),
      ...[...demoCatalog.players.keys()].map((k) => ['portrait', k] as [AssetKind, string]),
    ];
    let i = 0;
    const worker = async () => {
      while (i < jobs.length) {
        const [kind, id] = jobs[i++];
        await resolve(kind, id).catch((e) => console.warn(`[assets] ${kind}:${id}`, e));
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    await provider.flush();
    const all = provider.all();
    const ready = all.filter((r) => r.status === 'ready');
    const failed = all.filter((r) => r.status === 'failed');
    const bySource = ready.reduce<Record<string, number>>((acc, r) => ((acc[r.provider] = (acc[r.provider] ?? 0) + 1), acc), {});
    console.log(`[assets] ${ready.length}/${all.length} recursos disponibles ${JSON.stringify(bySource)}`);
    if (failed.length) {
      console.log(`[assets] ${failed.length} no se pudieron descargar (se usarán placeholders). Ejemplo: ${failed[0].id} → ${failed[0].error}`);
      console.log('[assets] Detalle completo en GET /api/assets/provenance');
    }
  }

  /** Manifiesto público para el cliente (sin rutas locales ni claves). */
  function publicManifest() {
    const out: Record<string, { status: AssetRecord['status']; provider: AssetRecord['provider']; url: string | null; updatedAt: string }> = {};
    for (const r of provider.all()) {
      out[r.id] = {
        status: r.status,
        provider: r.provider,
        url: r.status === 'ready' ? `/assets/${r.kind}/${encodeURIComponent(r.entityId)}?v=${encodeURIComponent(r.updatedAt)}` : null,
        updatedAt: r.updatedAt,
      };
    }
    return out;
  }

  function absolutePath(r: AssetRecord): string | null {
    if (!r.localPath) return null;
    return r.localPath.startsWith('/') ? r.localPath : store.abs(r.localPath);
  }

  return { apiFootball, theSportsDb, provider, resolve, warm, publicManifest, absolutePath, store, clubMapping };
}

export type AssetsService = Awaited<ReturnType<typeof createAssetsService>>;
