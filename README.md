# FOOTBALL ULTIMATE

Juego web de colección y gestión futbolística: cartas de futbolistas de todas las épocas,
sobres, mercado, plantillas con el **sistema clásico de química** y partidos simulados en
directo sobre un campo 2D.

> Estado: primera implementación jugable (v0.1). Datos de jugadores **de demostración**.

## Puesta en marcha

Requisitos: Node.js ≥ 20.12 (probado con 22) y npm ≥ 10.

```bash
npm install
```

```bash
npm run dev
```

- Cliente (Vite + React): http://localhost:5173
- Servidor de recursos (Node): http://localhost:8787 (el cliente lo usa vía proxy)

Otros comandos:

```bash
npm test            # Vitest: dominio, química, motor, economía, proveedores, catálogo
npm run typecheck   # TypeScript estricto en todos los paquetes
npm run build       # Build de producción del cliente
```

## Configurar las APIs

1. Copia `.env.example` a `.env` en la raíz.
2. Rellena `APISPORTS_KEY` con tu clave de [API-Football](https://www.api-football.com/documentation-v3).
3. (Opcional) `THESPORTSDB_KEY` — por defecto se usa la clave pública de pruebas `3`.
4. Verifica/actualiza los IDs y códigos con los datos reales de la API:

```bash
npm run sync:countries
```

```bash
npm run sync:teams
```

Sin clave el juego funciona igualmente: las banderas salen de `flag-icons` (local) y los
escudos/retratos usan placeholders generados. Las claves **nunca** llegan al navegador.

## Estructura

```
apps/
  web/            React + Vite + Zustand — interfaz FUT, CardRenderer, pantallas
  server/         Node — AssetProvider con caché en disco, proxy seguro de API-Football, scripts de sync
packages/
  domain/         Reglas puras (sin React/Phaser/APIs): players, cards, squad, chemistry,
                  tactics, match (motor), economy, progression
  match-renderer/ Phaser 3 — sólo dibuja snapshots del motor
  data-providers/ api-football/, thesportsdb/, assets/ (Flag/Crest/Portrait/Competition providers)
  database/       Esquema PostgreSQL, repositorios, catálogo de demostración
  shared/         RNG determinista, utilidades matemáticas
assets/           Recursos manuales, mapeos sincronizados y caché (ver assets/README.md)
docs/             Diseño de juego y arquitectura
```

Documentación: [docs/](docs/) — `GAME_DESIGN`, `TECHNICAL_ARCHITECTURE`, `CARD_SYSTEM`,
`CHEMISTRY_SYSTEM`, `MATCH_ENGINE`, `DATA_MODEL`, `ROADMAP`.

## Aviso legal

Proyecto con identidad propia; no usa recursos ni marcas de EA. Los nombres de futbolistas,
clubes y sus escudos pertenecen a sus titulares: revisa `assets/README.md` antes de publicar.
