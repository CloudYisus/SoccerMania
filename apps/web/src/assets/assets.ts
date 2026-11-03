import { useEffect } from 'react';
import { create } from 'zustand';

/**
 * Cliente del sistema de recursos.
 * - Pide el manifiesto al servidor UNA vez (y un par de refrescos mientras el
 *   servidor precalienta su caché). Nunca llama a APIs externas desde el navegador.
 * - Sólo se solicitan imágenes con estado "ready" → sin peticiones 404.
 * - Las banderas tienen respaldo local empaquetado (flag-icons) y placeholder.
 */
export type AssetKind = 'flag' | 'crest' | 'portrait' | 'competition';
interface ManifestEntry {
  status: 'pending' | 'ready' | 'failed' | 'missing';
  provider: string;
  url: string | null;
}

interface AssetState {
  manifest: Record<string, ManifestEntry>;
  online: boolean | null;
  load: () => Promise<void>;
}

export const useAssetStore = create<AssetState>((set) => ({
  manifest: {},
  online: null,
  load: async () => {
    try {
      const res = await fetch('/api/assets/manifest');
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { assets: Record<string, ManifestEntry> };
      set({ manifest: data.assets, online: true });
    } catch {
      set({ online: false });
    }
  },
}));

/** Arranca la carga del manifiesto con refrescos espaciados (warm-up del servidor). */
export function useAssetBootstrap() {
  const load = useAssetStore((s) => s.load);
  useEffect(() => {
    void load();
    const timers = [4000, 15000, 45000].map((ms) => setTimeout(() => void load(), ms));
    return () => timers.forEach(clearTimeout);
  }, [load]);
}

export function useAssetUrl(kind: AssetKind, entityId: string): { url: string | null; provider: string | null } {
  const entry = useAssetStore((s) => s.manifest[`${kind}:${entityId}`]);
  return entry?.status === 'ready' && entry.url ? { url: entry.url, provider: entry.provider } : { url: null, provider: null };
}

// ── Respaldo local de banderas (flag-icons, MIT) empaquetado por Vite ──
const bundledFlags = import.meta.glob('@flag-icons/flags/4x3/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const FLAG_INDEX: Record<string, string> = {};
for (const [path, url] of Object.entries(bundledFlags)) {
  const code = path.split('/').pop()!.replace('.svg', '');
  FLAG_INDEX[code] = url;
}

export function bundledFlagUrl(code: string): string | null {
  return FLAG_INDEX[code.toLowerCase()] ?? null;
}

/** Punto focal de cada bandera al recortarla en formato vertical. */
export const FLAG_FOCUS: Record<string, string> = {
  pt: '38% 50%',
  us: '30% 40%',
  sa: '50% 50%',
  ca: '50% 50%',
  mx: '50% 50%',
  br: '50% 50%',
  ar: '50% 50%',
  uy: '30% 40%',
  hr: '50% 45%',
  eg: '50% 50%',
  ma: '50% 50%',
};
