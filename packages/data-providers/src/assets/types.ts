export type AssetKind = 'flag' | 'crest' | 'portrait' | 'competition';
export type AssetSource = 'manual' | 'api-football' | 'thesportsdb' | 'flag-icons' | 'none';
export type AssetStatus = 'pending' | 'ready' | 'failed' | 'missing';

/** Registro de un recurso gráfico con su procedencia. */
export interface AssetRecord {
  /** `${kind}:${entityId}`, p. ej. "crest:real-madrid". */
  id: string;
  kind: AssetKind;
  entityId: string;
  provider: AssetSource;
  sourceUrl: string | null;
  /** Ruta relativa al directorio de caché (o ruta de paquete para flag-icons). */
  localPath: string | null;
  contentType: string | null;
  status: AssetStatus;
  error?: string;
  updatedAt: string;
  /** Nota de procedencia/licencia. Verificar derechos antes de publicar. */
  license: string;
  /** Intentos fallidos por proveedor (para depuración). */
  attempts?: { provider: AssetSource; error: string }[];
}

/** Almacenamiento de binarios y del manifiesto (implementado en el servidor con fs). */
export interface AssetStore {
  exists(relPath: string): Promise<boolean>;
  write(relPath: string, data: Uint8Array): Promise<void>;
  /** Busca un fichero manual con cualquiera de las extensiones dadas. */
  findManual(dir: string, baseName: string, exts: string[]): Promise<string | null>;
  loadManifest(): Promise<Record<string, AssetRecord>>;
  saveManifest(manifest: Record<string, AssetRecord>): Promise<void>;
}

export const LICENSES = {
  'api-football': 'API-Sports media — uso sujeto a los términos de API-Sports. Escudos/marcas pertenecen a sus titulares.',
  thesportsdb: 'TheSportsDB — contenido aportado por la comunidad; verificar derechos de cada imagen.',
  'flag-icons': 'flag-icons (MIT) — https://github.com/lipis/flag-icons',
  manual: 'Recurso añadido manualmente — documentar su origen y licencia.',
  none: 'Sin recurso — se usa placeholder generado.',
} as const satisfies Record<AssetSource, string>;
