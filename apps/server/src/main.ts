import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { ProviderError, type AssetKind } from '@fu/data-providers';
import { config } from './config';
import { createAssetsService } from './assets-service';

/**
 * Servidor Football Ultimate.
 * - Custodia las credenciales de API-Football (nunca llegan al navegador).
 * - Sirve recursos cacheados (banderas, escudos, retratos, logos) con su procedencia.
 * - Expone búsqueda de equipos para el panel de administración / scripts.
 */
const assets = await createAssetsService();

const KINDS: AssetKind[] = ['flag', 'crest', 'portrait', 'competition'];

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname;

  if (req.method === 'GET' && path === '/api/health') {
    return json(res, 200, { ok: true, service: 'football-ultimate-server' });
  }

  if (req.method === 'GET' && path === '/api/providers') {
    return json(res, 200, {
      apiFootball: { configured: assets.apiFootball.configured, rateLimit: assets.apiFootball.rateLimit },
      theSportsDb: { enabled: true, publicKey: config.theSportsDb.key === '3' },
      autoFetch: config.assets.autoFetch,
    });
  }

  if (req.method === 'GET' && path === '/api/assets/manifest') {
    return json(res, 200, { generatedAt: new Date().toISOString(), assets: assets.publicManifest() });
  }

  if (req.method === 'GET' && path === '/api/assets/provenance') {
    // Registro completo de procedencia (para auditoría de derechos antes de publicar).
    return json(
      res,
      200,
      assets.provider.all().map(({ localPath: _l, ...r }) => r),
    );
  }

  if (req.method === 'POST' && path === '/api/assets/refresh') {
    const kind = url.searchParams.get('kind') as AssetKind;
    const id = url.searchParams.get('id') ?? '';
    if (!KINDS.includes(kind)) return json(res, 400, { error: 'kind inválido' });
    const rec = await assets.resolve(kind, id, true);
    if (!rec) return json(res, 404, { error: 'Entidad desconocida' });
    await assets.provider.flush();
    const { localPath: _l, ...pub } = rec;
    return json(res, 200, pub);
  }

  const m = path.match(/^\/assets\/(flag|crest|portrait|competition)\/([^/]+)$/);
  if (req.method === 'GET' && m) {
    const kind = m[1] as AssetKind;
    const id = decodeURIComponent(m[2]);
    const rec = await assets.resolve(kind, id);
    const file = rec && rec.status === 'ready' ? assets.absolutePath(rec) : null;
    if (!rec || !file) return json(res, 404, { error: 'Recurso no disponible', status: rec?.status ?? 'unknown' });
    try {
      const st = await stat(file);
      res.writeHead(200, {
        'content-type': rec.contentType ?? 'application/octet-stream',
        'content-length': st.size,
        'cache-control': 'public, max-age=86400',
        'x-asset-provider': rec.provider,
      });
      createReadStream(file).pipe(res);
    } catch {
      return json(res, 404, { error: 'Fichero no encontrado' });
    }
    return;
  }

  if (req.method === 'GET' && path === '/api/teams/search') {
    if (!assets.apiFootball.configured) {
      return json(res, 503, { error: 'API-Football no configurada. Define APISPORTS_KEY en .env.' });
    }
    try {
      const items = await assets.apiFootball.searchTeams(url.searchParams.get('q') ?? '');
      return json(
        res,
        200,
        items.map((i) => ({ id: i.team.id, name: i.team.name, country: i.team.country, code: i.team.code, national: i.team.national, logo: i.team.logo })),
      );
    } catch (e) {
      const status = e instanceof ProviderError ? 502 : 500;
      return json(res, status, { error: e instanceof Error ? e.message : String(e) });
    }
  }

  return json(res, 404, { error: 'Ruta no encontrada' });
}

const server = createServer((req, res) => {
  handle(req, res).catch((e) => {
    console.error(e);
    if (!res.headersSent) json(res, 500, { error: 'Error interno' });
  });
});

server.listen(config.port, () => {
  console.log(`[server] Football Ultimate en http://localhost:${config.port}`);
  console.log(
    `[server] API-Football: ${assets.apiFootball.configured ? 'configurada' : 'SIN CLAVE (se usarán recursos locales y placeholders)'}`,
  );
  // Precalentar la caché de recursos sin bloquear el arranque.
  void assets.warm();
});
