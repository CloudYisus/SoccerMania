# CLAUDE.md: guía para continuar el proyecto

FOOTBALL ULTIMATE es un juego web en español de colección de cartas y gestión futbolística, al estilo Ultimate Team. Tiene sobres, mercado, química, partidos simulados en directo con decisiones del usuario, Liga, Torneos, Draft y colecciones especiales. Toda la interfaz, el código comentado y los commits están en **español**.

Lee primero este archivo y después la sección del README que corresponda. En `docs/` está el detalle de cada sistema: `MATCH_ENGINE`, `CARD_SYSTEM`, `GAME_DESIGN`, `CHEMISTRY_SYSTEM`, `DATA_MODEL` y `TECHNICAL_ARCHITECTURE`.

## Comandos

```bash
npm install
npm run dev         # web (5173) + servidor de recursos (8787); sólo web: npm run dev:web
npm test            # Vitest en todo el monorepo
npm run typecheck   # tsc estricto en cada paquete
npm run build       # build de producción del cliente
```

Antes de dar algo por terminado, `npm run typecheck`, `npm test` y `npm run build` deben pasar. Para comprobar la interfaz se usa Playwright (está preinstalado: `require('playwright')`) contra `npm run dev:web`.

## Reglas del proyecto (no negociables)

- **No inventar datos de API.** Los ratings y estadísticas son "valores de diseño de juego" y se declaran así (`DEMO_DATA_NOTICE`). La clave de API-Football solo vive en el servidor y nunca llega al navegador.
- **Sin marcas ni recursos de EA.** Los eventos usan nombres propios: Equipo del Año, Equipo de la Temporada, En Forma, Tormenta, Noches de Gala, Once Ideal… Los escudos y fotos se sirven desde el servidor de recursos con placeholders. Hay que revisar los derechos (`assets/README.md`).
- **Ningún botón muerto.** Toda acción visible hace algo o está deshabilitada con su explicación.
- **El dominio es puro.** `packages/domain` no importa React, Phaser ni APIs.
- **Determinismo.** El motor y las simulaciones usan el RNG con semilla de `@fu/shared` (`createRng`, `hashString`). Nunca se usa `Math.random` en la lógica.
- Rama de trabajo: la que indique la sesión. No se crean PRs salvo que se pidan.

## Arquitectura (monorepo con npm workspaces)

```
packages/shared          RNG determinista (createRng: next/int/range/chance/weighted), utilidades
packages/domain          Reglas puras: players, cards (edition, catalog), squad (formations, auto),
                         chemistry, tactics (instrucciones por puesto, estilos), match (engine,
                         ratings, story, penalties), economy (packs, mercado), progression
packages/database        Catálogo de demostración (seed/*) → buildCatalog(); esquema PostgreSQL
packages/match-renderer  Phaser 3: sólo dibuja frames del motor (no decide nada)
packages/data-providers  API-Football / TheSportsDB / proveedores de banderas y escudos
apps/server              Node: caché de recursos y proxy seguro de la API
apps/web                 React + Vite + Zustand: pantallas, estado del juego, cartas
```

Los paquetes exportan el código fuente TS directamente (sin compilar). Cada paquete tiene su `tsconfig` y el typecheck se hace paquete a paquete.

### Catálogo (packages/database)

- `seed/squads/*.ts`: plantillas compactas `Nombre|POS|media|nación|alts` por club. `build.ts` las expande y deriva las estadísticas por arquetipo con jitter por hash. Detecta duplicados y lanza error si los hay.
- Proceso de construcción en `index.ts`:
  1. `expandSquads`
  2. `historyCatalog` (Iconos nuevos, temporadas pasadas, Mundial 2010, **Históricos**)
  3. `eventCatalog` (eventos con plantilla `ROSTERS`)
  4. marcado de `hero` por nombre (`HERO_NAMES`)
  5. `inFormCatalog` (versión En Forma `<id>-if` de cada carta base)
  6. `buildCatalog`
- `Player.icon` marca a un Icono y `Player.hero` a un Histórico. Ambos son propiedades de la **identidad**: todas sus cartas llevan el sello.
- `PlayerVersion.event` apunta a un `CardEvent`. `CardEvent.kind` define la familia de diseño: `toty`, `tots` (con `leagueId`), `promesas`, `tormenta`, `gala`, `mundial`, `euro`, `totw`.
- Año de edición = `seasonToYear(season)`. `CURRENT_YEAR = 2026`: las cartas base de la temporada actual no muestran el año.
- Para añadir futbolistas se edita el bloque de texto correspondiente. Un futbolista que ya existe se reutiliza por `slug(nombre)|nación`, así que conviene escribir el nombre igual que en su plantilla.

### Web (apps/web/src)

- `data/catalog.ts`:
  - `allVersions` son las versiones coleccionables **sin** las En Forma; estas solo circulan mientras su jugador esté o haya estado en un Equipo de la Semana.
  - `inFormOf(id)` devuelve la versión En Forma de una carta.
- `state/gameStore.ts` es el store Zustand persistido en localStorage (`football-ultimate-save`):
  - `partialize` decide qué se guarda.
  - `merge` migra partidas antiguas: descarta las que referencian versiones inexistentes y normaliza `world`, `draft` y `tournaments`.
  - **`recordMatch` es el único punto de entrada tras cada partido.** Reparte monedas y XP y aplica, según el modo:
    - Liga: `playRound`.
    - Copa: `applyResult` / `simulatePending`.
    - Draft: `applyUserResult`.
  - Además, en cada partido gestiona:
    - lesiones (descuento y nuevas),
    - consumo de la versión En Forma,
    - rendimientos de la semana y cierre de semana (`closeWeek`).
- Cada modo de juego es un módulo de **funciones puras** sobre un estado serializable, con su test:

  | Módulo | Qué hace |
  |---|---|
  | `state/league.ts` | Liga de 8 equipos a 7 jornadas: `createSeason`, `playRound`, `leagueTable`, `matchContext` (clima, local, moral, entrenamiento, prensa → `userBoost`/`rivalBoost`). |
  | `state/world.ts` | Mundo simulado: jornada semanal de todas las ligas reales (`closeWeek`, `simulateScore`, `roundPairs`) y Equipo de la Semana (`pickTotw`). |
  | `state/cup.ts` + `tournaments.ts` | Torneos de 8 a eliminación directa; los partidos de la IA se simulan con el motor real. |
  | `state/draft.ts` | Mundial Draft (ver abajo). |
  | `state/teams.ts` | Equipos de la IA: `assemble`, `clubTeam`, `divisionOpponent`, `styleTactics`, `aiToMatchSetup`, `userToMatchSetup`. |
  | `state/squadView.ts` | `computeSquadView(squad, cards, inForm)` y `matchdaySquad` (sustituye a los lesionados). |
  | `state/marketSearch.ts` | Buscador del mercado (las ofertas se generan con semilla). |

- `state/uiStore.ts`: pestañas, toasts y `MatchRequest`, que tiene:
  - `mode`
  - `opponent`
  - `context?` (ambientación de Liga)
  - `userSetup?` (el once del Draft sustituye a la plantilla)
  - `knockout?` (penaltis si hay empate)
  - `opponentId?`
- `screens/match/MatchScreen.tsx`:
  - Construye los equipos (aplicando los `boost` de contexto) y crea `MatchEngine` y la vista Phaser.
  - Un único bucle: Phaser pide el frame y en `onFrame` se avanza el motor. React solo se refresca cada 250 ms.
  - Al terminar muestra el resumen: crónica narrada (`matchStory`), mejor jugador (`matchRatings`) y estadísticas. Después llama a `recordMatch`.
- Pantallas de modos dentro de `CompeteScreen`:
  - Partido rápido.
  - Liga (`LeagueView`).
  - Torneos (`CupView`).
  - Draft (`DraftView`).
  - Desafíos.
- Diseño de cartas:
  - `components/card/PlayerCard.tsx` lee `data-type`, `data-event`, `data-icon`, `data-hero`, `data-frame` y `data-shape`.
  - `editions.ts` define los temas por año (`EDITIONS` + paleta generada) y `EVENT_THEMES` por familia.
  - El CSS está en `card.css` y `editions.css`.
  - Iconos: borde interno blanco. Históricos: borde bronce. En Forma: negro.

### Motor de partido (packages/domain/src/match)

- `engine.ts`:
  - Paso fijo de 0,1 s; 360 s de motor equivalen a 90'.
  - Agentes con IA por línea, estilos de equipo (`STYLE`) e instrucciones por puesto (`INSTRUCTION_PROFILE`).
  - `getFrame()` interpola entre ticks para el render.
- **Decisiones del usuario:**
  - El motor abre un `DecisionPrompt` con 2–4 opciones, cada una con probabilidad, riesgo y recompensa cualitativos, y se ralentiza mientras espera.
  - `choose()` ejecuta la opción y el resultado se califica en 4 grados.
  - Hay cadenas de hasta 3 decisiones e impulso tras los aciertos.
  - Contextos: ataque, mano a mano, balón parado, defensa, portero y remate aéreo.
- **Eventos (`MatchEvent`):**
  - `highlight` sirve para los avisos en pantalla.
  - `decision` lleva el resultado de una decisión.
  - Los goles llevan `story` (`ShotStory`: metros conducidos, rivales superados, distancia, golpeo, tipo de asistencia).
  - `injury` lleva `injuryMatches`.
- Lesiones: probabilidad baja por falta recibida y como máximo una por equipo. El jugador sigue mermado en el partido.
- `ratings.ts` calcula las notas de 3 a 10 (y el mejor del partido). `story.ts` elige los 5 momentos más destacados con un titular.
- Formaciones (`squad/formations.ts`): 14. Los índices de slot son estables y el 0 es el portero. Un test comprueba que las cartas no se solapen en la vista: 12,5 % de ancho × 17,5 % de alto.

## Modos de juego (resumen)

- **Liga:**
  - Temporada de 8 equipos con mixtos o clubes reales.
  - Ascienden 2 y descienden 2.
  - Previa con estadio, clima y lo que está en juego. Analista, entrenamiento, rueda de prensa, moral y enfermería.
- **Torneos:** 9 torneos de 8 equipos con estadísticas (`tournaments.ts`), con clubes reales o equipos mixtos.
- **Mundial Draft (`state/draft.ts`):**
  - Se elige capitán (5 opciones), formación (5 al azar entre las 14) y 1 de 5 jugadores por puesto.
  - Las opciones salen por niveles de media (`DRAFT_TIERS`): como mucho una 90+ por puesto, para mantener el equilibrio.
  - El pool incluye cartas base, temporadas pasadas, eventos, Iconos e Históricos.
  - Las opciones se guardan en cuanto se generan, así que no se pueden volver a sortear.
  - El Mundial es de 32 equipos (tu draft + 31 selecciones de `nationTeam`): 8 grupos de 4 con bombos, pasan 2, después octavos, cuartos, semifinal y final.
  - Los partidos de la IA se simulan con `simulateScore` y goleadores ponderados. Las estadísticas son goles, asistencias y porterías a cero.
  - Las cartas del draft **no** pasan al club. El premio depende de la ronda alcanzada.
  - El once del draft llega al motor como `MatchRequest.userSetup` (construido con cartas temporales `draft-N`).
- **Equipo de la Semana:**
  - La semana se cierra con cada jornada de Liga o cada 3 partidos.
  - Tus jugadores con buena nota pueden entrar; como mucho 2.
  - Los que entran juegan su versión En Forma en el siguiente partido (`inForm`).
  - Las En Forma de esa semana salen en sobres y mercado.

## Convenciones

- Los textos de la interfaz van en español, con un registro cercano.
- Las pruebas van junto al código (`*.test.ts`) o en `packages/domain/src/__tests__`. Los helpers de equipos sintéticos están en `__tests__/helpers.ts`.
- El CSS va por pantalla (`screens/*.css`), con tokens en `styles/tokens.css` (`--gold-1`, `--surface`, `--line`, `--radius-md`, fuentes `--font-display`/`--font-ui`).
- Rendimiento del partido:
  - Se usa el renderizador Canvas 2D (`?webgl` fuerza WebGL), con césped y fichas prerenderizados como texturas.
  - Mientras se juega, la app y el stage quedan ocultos.
  - Las animaciones CSS usan solo `transform` y `opacity`.
- Cuando se añade un campo al estado persistido: hay que incluirlo en `partialize`, normalizarlo en `merge` y darle un valor por defecto en `initialData`.
- Cuando se añade un modo que juega partidos: hay que ampliar `MatchRecord.mode` y `MatchRequest.mode`, añadir la rama en `recordMatch` y añadir la vuelta (`go('compete', intent)`) en `MatchScreen.close`.

## Ideas pendientes (propuestas al usuario, aún sin hacer)

Evoluciones de cartas, rasgos de juego que desbloqueen decisiones, desafíos de creación de plantillas, sonido, tutorial interactivo, penaltis interactivos, repeticiones de goles y guardado en la nube (PostgreSQL ya está esquematizado en `packages/database`).
