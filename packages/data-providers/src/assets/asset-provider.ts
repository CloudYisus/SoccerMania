import { withTimeout, type FetchLike } from '../http';
import type { SubProvider } from './providers';
import { LICENSES, type AssetKind, type AssetRecord, type AssetStore } from './types';

export interface AssetProviderOptions {
  store: AssetStore;
  fetch?: FetchLike;
  /** Descargar de proveedores remotos cuando falte el recurso. */
  autoFetch: boolean;
  /** Horas antes de reintentar un recurso fallido o inexistente. */
  retryHours: number;
  now?: () => Date;
  log?: (msg: string) => void;
}

const EXT_TYPES: Record<string, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  webp: 'image/webp',
  jpg: 'image/jpeg',
};

/**
 * AssetProvider: orquesta los sub-proveedores (banderas, escudos, retratos,
 * logos), cachea en disco, registra procedencia y evita llamadas repetidas.
 * Nunca se invoca por cada renderizado: el cliente consulta el manifiesto una
 * vez y pide sólo los recursos con estado "ready".
 */
export class AssetProvider {
  private manifest: Record<string, AssetRecord> = {};
  private inflight = new Map<string, Promise<AssetRecord>>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly fetchImpl: FetchLike;
  private readonly now: () => Date;

  constructor(private readonly opts: AssetProviderOptions) {
    this.fetchImpl = opts.fetch ?? (globalThis.fetch as unknown as FetchLike);
    this.now = opts.now ?? (() => new Date());
  }

  async init(): Promise<void> {
    this.manifest = await this.opts.store.loadManifest();
  }

  get(kind: AssetKind, entityId: string): AssetRecord | undefined {
    return this.manifest[`${kind}:${entityId}`];
  }

  all(): AssetRecord[] {
    return Object.values(this.manifest);
  }

  private isFresh(rec: AssetRecord) {
    if (rec.status === 'ready') return true;
    const age = this.now().getTime() - new Date(rec.updatedAt).getTime();
    return age < this.opts.retryHours * 3600_000;
  }

  async resolve<E>(sub: SubProvider<E>, entity: E, options: { force?: boolean } = {}): Promise<AssetRecord> {
    const entityId = sub.entityId(entity);
    const id = `${sub.kind}:${entityId}`;
    const existing = this.manifest[id];
    if (existing && !options.force && this.isFresh(existing)) {
      if (existing.status !== 'ready' || (existing.localPath && (existing.localPath.startsWith('/') || (await this.opts.store.exists(existing.localPath))))) {
        return existing;
      }
    }
    const running = this.inflight.get(id);
    if (running) return running;
    const p = this.doResolve(sub, entity, id, entityId).finally(() => this.inflight.delete(id));
    this.inflight.set(id, p);
    return p;
  }

  private async doResolve<E>(sub: SubProvider<E>, entity: E, id: string, entityId: string): Promise<AssetRecord> {
    const attempts: { provider: AssetRecord['provider']; error: string }[] = [];
    const base = { id, kind: sub.kind, entityId, updatedAt: this.now().toISOString() };
    let record: AssetRecord | null = null;

    for (const c of sub.candidates(entity)) {
      try {
        if (c.type === 'local') {
          const path = await c.path();
          if (!path) continue;
          const ext = path.split('.').pop() ?? '';
          record = {
            ...base,
            provider: c.source,
            sourceUrl: null,
            localPath: path,
            contentType: EXT_TYPES[ext] ?? c.contentType,
            status: 'ready',
            license: LICENSES[c.source],
          };
          break;
        }
        if (!this.opts.autoFetch) {
          attempts.push({ provider: c.source, error: 'descarga automática desactivada (ASSET_AUTO_FETCH=false)' });
          continue;
        }
        const url = await c.url();
        if (!url) {
          attempts.push({ provider: c.source, error: 'sin coincidencias en el proveedor' });
          continue;
        }
        const res = await withTimeout(12000, (signal) => this.fetchImpl(url, { signal }));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const type = (res.headers.get('content-type') ?? EXT_TYPES[c.ext] ?? '').split(';')[0].trim();
        if (!type.startsWith('image/')) throw new Error(`tipo de contenido no válido: ${type || 'desconocido'}`);
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (bytes.byteLength < 64) throw new Error('imagen vacía');
        const ext = type === 'image/svg+xml' ? 'svg' : type === 'image/webp' ? 'webp' : type === 'image/jpeg' ? 'jpg' : 'png';
        const rel = `cache/${sub.kind}/${entityId}.${ext}`;
        await this.opts.store.write(rel, bytes);
        record = {
          ...base,
          provider: c.source,
          sourceUrl: url,
          localPath: rel,
          contentType: type,
          status: 'ready',
          license: LICENSES[c.source],
        };
        break;
      } catch (e) {
        const msg = e instanceof Error ? (e.name === 'AbortError' ? 'tiempo de espera agotado' : e.message) : String(e);
        attempts.push({ provider: c.source, error: msg });
      }
    }

    if (!record) {
      const failed = attempts.some((a) => !a.error.startsWith('sin coincidencias') && !a.error.startsWith('descarga'));
      record = {
        ...base,
        provider: 'none',
        sourceUrl: null,
        localPath: null,
        contentType: null,
        status: failed ? 'failed' : 'missing',
        error: attempts.map((a) => `${a.provider}: ${a.error}`).join(' | ') || 'sin proveedores disponibles',
        license: LICENSES.none,
      };
      if (record.status === 'failed') this.opts.log?.(`[assets] ${id} no disponible → ${record.error}`);
    }
    record.attempts = attempts.length ? attempts : undefined;
    this.manifest[id] = record;
    this.scheduleSave();
    return record;
  }

  private scheduleSave() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.opts.store.saveManifest(this.manifest);
    }, 300);
  }

  async flush(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.opts.store.saveManifest(this.manifest);
  }
}
