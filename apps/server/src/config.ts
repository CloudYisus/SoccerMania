import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
export const ASSETS_ROOT = resolve(REPO_ROOT, 'assets');

const envFile = resolve(REPO_ROOT, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const bool = (v: string | undefined, def: boolean) => (v === undefined || v === '' ? def : v === 'true' || v === '1');

export const config = {
  port: Number(process.env.SERVER_PORT || 8787),
  apiSports: {
    key: process.env.APISPORTS_KEY || undefined,
    baseUrl: process.env.APISPORTS_BASE_URL || 'https://v3.football.api-sports.io',
    mediaUrl: process.env.APISPORTS_MEDIA_URL || 'https://media.api-sports.io',
  },
  theSportsDb: {
    key: process.env.THESPORTSDB_KEY || '3',
    baseUrl: process.env.THESPORTSDB_BASE_URL || 'https://www.thesportsdb.com/api/v1/json',
  },
  assets: {
    autoFetch: bool(process.env.ASSET_AUTO_FETCH, true),
    retryHours: Number(process.env.ASSET_RETRY_HOURS || 12),
  },
  databaseUrl: process.env.DATABASE_URL || undefined,
};
