import { mkdir, readFile, writeFile, access, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { AssetRecord, AssetStore } from '@fu/data-providers';

/** Almacén de recursos en disco bajo /assets (la caché va en assets/cache, ignorada por git). */
export class FsAssetStore implements AssetStore {
  constructor(readonly root: string) {}

  abs(rel: string) {
    return join(this.root, rel);
  }

  async exists(rel: string) {
    try {
      await access(this.abs(rel));
      return true;
    } catch {
      return false;
    }
  }

  async write(rel: string, data: Uint8Array) {
    const p = this.abs(rel);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, data);
  }

  async findManual(dir: string, base: string, exts: string[]) {
    for (const ext of exts) {
      const rel = `${dir}/${base}.${ext}`;
      if (await this.exists(rel)) return rel;
    }
    return null;
  }

  async loadManifest(): Promise<Record<string, AssetRecord>> {
    try {
      return JSON.parse(await readFile(this.abs('cache/manifest.json'), 'utf8'));
    } catch {
      return {};
    }
  }

  async saveManifest(m: Record<string, AssetRecord>) {
    const p = this.abs('cache/manifest.json');
    await mkdir(dirname(p), { recursive: true });
    await writeFile(`${p}.tmp`, JSON.stringify(m, null, 2));
    await rename(`${p}.tmp`, p);
  }

  async readJson<T>(rel: string, fallback: T): Promise<T> {
    try {
      return JSON.parse(await readFile(this.abs(rel), 'utf8')) as T;
    } catch {
      return fallback;
    }
  }

  async writeJson(rel: string, data: unknown) {
    const p = this.abs(rel);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, JSON.stringify(data, null, 2) + '\n');
  }
}
