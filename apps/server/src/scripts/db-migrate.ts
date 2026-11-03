/**
 * Aplica el esquema PostgreSQL y vuelca el catálogo de demostración.
 * Opcional en esta fase: el cliente funciona sin base de datos.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import { demoCatalogData } from '@fu/database';
import { config, REPO_ROOT } from '../config';

if (!config.databaseUrl) {
  console.error('DATABASE_URL no configurada.');
  process.exit(1);
}
const client = new pg.Client({ connectionString: config.databaseUrl });
await client.connect();
try {
  await client.query('BEGIN');
  await client.query(await readFile(resolve(REPO_ROOT, 'packages/database/sql/001_init.sql'), 'utf8'));
  for (const n of demoCatalogData.nations)
    await client.query(
      `INSERT INTO nations(code,name,card_name,confederation) VALUES($1,$2,$3,$4)
       ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, card_name=EXCLUDED.card_name`,
      [n.code, n.name, n.cardName, n.confederation],
    );
  for (const l of demoCatalogData.leagues)
    await client.query(
      `INSERT INTO leagues(id,name,short_name,nation_code,api_football_id) VALUES($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, api_football_id=EXCLUDED.api_football_id`,
      [l.id, l.name, l.shortName, l.nationCode, l.apiFootballId],
    );
  for (const c of demoCatalogData.clubs)
    await client.query(
      `INSERT INTO clubs(id,name,short_name,league_id,nation_code,color_primary,color_secondary,api_football_id,thesportsdb_name,historical)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
      [c.id, c.name, c.shortName, c.leagueId, c.nationCode, c.colors.primary, c.colors.secondary, c.apiFootballId, c.theSportsDbName ?? null, !!c.historical],
    );
  for (const p of demoCatalogData.players)
    await client.query(
      `INSERT INTO players(id,known_as,full_name,nation_code,birth_year,icon) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
      [p.id, p.knownAs, p.fullName, p.nationCode, p.birthYear, p.icon],
    );
  for (const v of demoCatalogData.versions)
    await client.query(
      `INSERT INTO player_versions(id,player_id,label,season,club_id,nation_code,position,alt_positions,rating,stats,year,shirt_number,milestone)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (id) DO NOTHING`,
      [v.id, v.playerId, v.label, v.season, v.clubId, v.nationCode, v.position, v.altPositions, v.rating, JSON.stringify(v.stats), v.year, v.shirtNumber, v.milestone ?? null],
    );
  await client.query('COMMIT');
  console.log('Migración y catálogo de demostración aplicados.');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  await client.end();
}
