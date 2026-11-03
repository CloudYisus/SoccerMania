# Modelo de datos

Tipos en `packages/domain/src` · Esquema SQL en `packages/database/sql/001_init.sql`.

```
nations (code PK: ISO alpha-2 / gb-eng…)  ◄── leagues (api_football_id)
                                         ◄── clubs (league_id, colores, api_football_id, thesportsdb_name, historical)
players (identidad, icon)  ──1:N──►  player_versions (club_id, nation_code, position, alt_positions[],
                                                rating, stats JSONB, year, shirt_number, milestone)
users ──1:N──► player_cards (version_id, source, loyal, games_played, position_override, untradeable)
users ──1:N──► squads (formation_id, starters[11], bench[7], manager_id, tactics JSONB, instructions JSONB)
market_listings (vendedor o IA, version/card, precio, estado, resolves_at)
assets (kind, entity_id, provider, source_url, local_path, status, error, updated_at, license_note)
provider_sync_log (proveedor, operación, ok, detalle)
```

## Estadísticas de carta (`FaceStats`)
- Jugador de campo: `pac sho pas dri def phy` (RIT TIR PAS REG DEF FÍS).
- Portero: `div han kic ref spd pos` (EST MAN SAQ REF VEL COL).

## Persistencia actual
- Catálogo: `@fu/database` (seed en TS, validado por `buildCatalog`), repositorio en memoria
  con contrato `CatalogRepository` preparado para PostgreSQL.
- Partida del usuario: `localStorage` (`football-ultimate-save`), con descarte automático si
  referencia versiones inexistentes.
- `npm run db:migrate` crea el esquema y vuelca el catálogo en PostgreSQL (`DATABASE_URL`).

## Datos de demostración
Ratings y atributos son **valores de diseño de juego**, no datos oficiales ni de API.
Los `apiFootballId` del seed son un mapeo inicial **no verificado** en este entorno: `npm run sync:teams`
los comprueba contra `/teams?search=` y guarda el resultado en `assets/clubs/mapping.json`,
que tiene prioridad.
