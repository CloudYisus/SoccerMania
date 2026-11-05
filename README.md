# FOOTBALL ULTIMATE

Juego web de colección y gestión futbolística: cartas de futbolistas de todas las épocas,
sobres, mercado, plantillas con el **sistema clásico de química** y partidos simulados en
directo sobre un campo 2D.

> Estado: juego completo jugable. Datos de jugadores **de demostración** (ratings de diseño de juego).
>
> **¿Retomas el proyecto (persona o IA)?** Lee primero [`CLAUDE.md`](CLAUDE.md): arquitectura,
> reglas, dónde vive cada sistema y cómo extenderlo, sin necesidad del historial de desarrollo.

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

## Qué incluye

| Área | Dónde | Resumen |
|---|---|---|
| Cartas y catálogo | `packages/database/src/seed`, `components/card` | 5 grandes ligas + ligas secundarias, temporadas pasadas con diseño por año, Iconos (ribete blanco), Históricos (ribete bronce), eventos (Equipo del Año, Equipo de la Temporada por liga, Promesas, Tormenta, Noches de Gala, Onces Ideales de Mundial/Eurocopa) y En Forma |
| Plantilla | `screens/squad` | Química clásica, 14 formaciones, tácticas, estilos e instrucciones específicas por puesto |
| Partido | `packages/domain/src/match`, `packages/match-renderer` | Simulación 11v11 en directo con decisiones del usuario (opciones contextuales con probabilidad/riesgo), estilos de la IA, lesiones, mejor del partido y crónica narrada |
| Mercado y sobres | `screens/MarketScreen.tsx`, `state/marketSearch.ts` | Buscador con filtros tipo FUT; sobres por bandas de media |
| Liga | `state/league.ts`, `screens/LeagueView.tsx` | 8 equipos, 7 jornadas, ascensos/descensos, previa (estadio, clima, aforo), analista, entrenamiento, rueda de prensa, moral y enfermería |
| Torneos | `state/cup.ts`, `state/tournaments.ts` | 9 torneos de 8 equipos con clubes reales o mixtos y estadísticas |
| Mundial Draft | `state/draft.ts`, `screens/DraftView.tsx` | Draft (capitán, formación y 1 de 5 por puesto) y Mundial de 32 selecciones con grupos, eliminatorias y estadísticas |
| Equipo de la Semana | `state/world.ts` | Jornada semanal simulada de todas las ligas; tus jugadores destacados juegan su versión En Forma |
| Colecciones | `screens/CollectionsScreen.tsx` | Equipo de la Semana, eventos, Iconos, Históricos, Mundial 2010, grandes temporadas |

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
los escudos usan placeholders generados con los colores del club. Las claves **nunca** llegan al navegador.

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

Guía para continuar el desarrollo: [CLAUDE.md](CLAUDE.md).
Documentación: [docs/](docs/) — `GAME_DESIGN`, `TECHNICAL_ARCHITECTURE`, `CARD_SYSTEM`,
`CHEMISTRY_SYSTEM`, `MATCH_ENGINE`, `DATA_MODEL`, `ROADMAP`.

## Aviso legal

Proyecto con identidad propia; no usa recursos ni marcas de EA. Los nombres de futbolistas,
clubes y sus escudos pertenecen a sus titulares: revisa `assets/README.md` antes de publicar.
