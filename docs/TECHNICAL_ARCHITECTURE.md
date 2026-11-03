# Arquitectura técnica

## Stack
React 19 · TypeScript (estricto) · Vite 7 · Zustand · Phaser 3 · Node 22 · Zod · Vitest ·
PostgreSQL (esquema preparado) · monorepo con npm workspaces.

## Capas y dependencias
```
apps/web ──► @fu/domain, @fu/database (catálogo), @fu/match-renderer, @fu/shared
apps/server ──► @fu/data-providers, @fu/database, @fu/domain
@fu/match-renderer ──► @fu/domain (tipos de snapshot), phaser
@fu/data-providers ──► @fu/domain (tipos), zod
@fu/database ──► @fu/domain
@fu/domain ──► @fu/shared            (sin React, Phaser, DOM ni APIs)
```
`packages/domain/tsconfig.json` compila sin `DOM` ni tipos de Node para garantizar la independencia.

Los paquetes exportan TypeScript fuente (`exports: ./src/index.ts`); Vite, tsx y Vitest lo
consumen directamente sin pasos de build intermedios.

## Cliente (apps/web)
- `state/gameStore.ts` — estado persistente (localStorage) con acciones de dominio: colección,
  plantilla, mercado, sobres, divisiones, copa, desafíos, historial.
- `state/squadView.ts` — derivación pura: cartas resueltas, química (`calculateChemistry`), rating.
- `state/teams.ts` — rivales IA construidos con versiones reales del catálogo + adaptadores al motor.
- `components/card/` — **CardRenderer** (`PlayerCard`) + `FlagArt`, `ClubCrest`, `Portrait`.
- `assets/assets.ts` — cliente del manifiesto de recursos (una petición, sin 404).
- Transiciones de pantalla con capas de entrada/salida (`App.tsx › ScreenStage`).
- El partido (`screens/match`) se carga de forma diferida (Phaser en su propio chunk).

## Servidor (apps/server)
- `GET /api/health`, `GET /api/providers`
- `GET /api/assets/manifest` — estado público de cada recurso (sin rutas ni claves).
- `GET /api/assets/provenance` — registro completo de procedencia/licencia.
- `GET /assets/{flag|crest|portrait|competition}/{id}` — sirve el recurso cacheado.
- `POST /api/assets/refresh?kind=&id=` — fuerza la re-resolución.
- `GET /api/teams/search?q=` — búsqueda en API-Football (503 si no hay clave).
- Scripts: `sync:countries`, `sync:teams`, `db:migrate`.

## Sistema de recursos
```
AssetProvider (caché en disco + manifiesto + reintentos + deduplicación)
 ├── CountryFlagProvider     manual → API-Football flags/{code}.svg → flag-icons (local)
 ├── ClubCrestProvider       manual → API-Football teams/{id}.png → TheSportsDB strBadge
 ├── PlayerPortraitProvider  manual → API-Football players/{id}.png (si hay ID)
 └── CompetitionLogoProvider manual → API-Football leagues/{id}.png
```
Cada `AssetRecord` guarda: id, tipo, entidad, proveedor, URL de origen, ruta local,
content-type, estado (`ready|failed|missing|pending`), error, fecha, nota de licencia e intentos.
Los fallos no se reintentan hasta `ASSET_RETRY_HOURS`. El servidor precalienta la caché al
arrancar. El cliente añade un respaldo propio: banderas `flag-icons` empaquetadas por Vite,
escudos provisionales generados (SVG con colores del club). Las cartas no muestran retratos:
el `PlayerPortraitProvider` se mantiene para futuras pantallas de detalle.

Mapeo de banderas especiales (`data-providers/src/assets/flag-codes.ts`): `gb-eng`, `gb-sct`,
`gb-wls`, `gb-nir`, `xk`; ampliable con `assets/flags/api-football-codes.json`.

## Multijugador (preparación)
El motor es determinista (RNG con semilla, paso fijo) y separado del render: puede ejecutarse
en servidor y retransmitir snapshots o instrucciones (`setInstruction`, `setTactics`).
El estado del usuario está aislado en un store sustituible por una API con PostgreSQL.

## Calidad
- `npm test` — 63 pruebas (química, formaciones, plantilla, economía, sobres, motor,
  proveedores con fetch simulado, integridad del catálogo, rivales IA).
- `npm run typecheck` — todos los paquetes.
