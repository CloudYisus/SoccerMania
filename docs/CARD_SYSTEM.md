# Sistema de cartas

## Modelo: Player → PlayerVersion → PlayerCard
| Entidad | Qué representa | Ejemplo |
|---|---|---|
| `Player` | Identidad única del futbolista. Incluye `icon` (leyenda retirada) | Ronaldo Nazário · Icono |
| `PlayerVersion` | Etapa/temporada: club, nación, posición, valoración, 6 atributos, dorsal, hito y **año de edición** (`year`, derivado de `season`) | `r9-psv96` (1996), `r9-inter98` (1998), `r9-brasil02` (2002), `r9-rm03` (2003) |
| `PlayerCard` | Edición coleccionable del usuario: origen, lealtad, partidos, cambio de posición, intransferible | `c1a` |

Regla de plantilla: un mismo `Player` no puede aparecer dos veces (aunque sean versiones distintas).

## Sin rarezas: diseño por año de edición
Como en FUT, el diseño lo define la **edición (año)**: todas las versiones de 2022 comparten
estética, todas las de 1970 la suya, etc. `seasonToYear`: `"1970"` → 1970 · `"1997-98"` → 1998 ·
`"2025-26"` → 2026.

Cada edición (`apps/web/src/components/card/editions.ts`) define: nombre, marco metálico, color
base, tinte de la bandera, relleno de la valoración, acento, halo, **patrón de foil** (24 patrones:
puntos, rayas, rayos, chevrones, hexágonos, cristal, carbono, aurora…) y **movimiento**
(`sweep` barrido de luz, `holo` marco holográfico, `pulse` halo latente). Composición, tipografía y
proporciones son comunes a todas → todas se ven del mismo juego.

| Año | Edición | Rasgos |
|---|---|---|
| 1954 | Sepia | Bronce envejecido, foil de puntos |
| 1962 | Esmeralda | Verde y oro, raya diplomática |
| 1966 | Tweed | Granate y crema, trama cruzada |
| 1970 | Sol | Oro anaranjado, rayos de sol, halo latente |
| 1972 | Mandarina | Naranja, franjas horizontales |
| 1974 | Cromo | Acero cromado con acento verde, chevrones, barrido |
| 1986 | Azteca | Turquesa y oro, zigzag |
| 1987 | Vesubio | Celeste, ondas |
| 1994 | Neón | Magenta y turquesa, confeti |
| 1996 | Holograma | Marco holográfico animado, líneas de escaneo |
| 1998 | Tricolor | Azul, blanco y rojo, diagonales |
| 2002 | Sol Naciente | Rojo y oro, rayos, halo latente |
| 2003 | Platino | Platino cepillado, barrido |
| 2004 | Bronce | Bronce, hexágonos |
| 2005 | Grana | Grana y azul, franjas verticales |
| 2006 | Azzurro | Azul real y oro, rombos |
| 2010 | Vuvu | Oro y negro, triángulos |
| 2014 | Selva | Verde y amarillo, mosaico |
| 2018 | Hielo | Plata helada con acento rojo, cristal, barrido |
| 2022 | Desierto | Granate y oro, celosía |
| 2023 | Cobalto | Azul cobalto, fibra de carbono |
| 2024 | Obsidiana | Negro y oro, rejilla |
| 2025 | Aurora | Violeta y turquesa, aurora holográfica |
| 2026 | Ultimate | Negro y oro con acento verde, panal, barrido (temporada actual) |

Años sin entrada curada reciben un diseño generado de forma determinista a partir del año.
Para añadir uno basta una entrada en `EDITIONS`.

## Iconos
"Icono" es una propiedad del **futbolista**, no de la versión: todas las cartas de Pelé,
Maradona, Cruyff, Ronaldo Nazário… lo muestran sobre el diseño de su año con un sello
"★ ICONO ★" centrado arriba, un ribete interior marfil, nombre en marfil dorado y destellos.
En química aplican la regla clásica de Iconos (ver `CHEMISTRY_SYSTEM.md`) y en los sobres
tienen revelado propio.

## Composición del CardRenderer (`apps/web/src/components/card/PlayerCard.tsx`)
1em = ancho/20 → una sola composición para cualquier tamaño. Capas de fondo a frente:
1. **Marco** metálico de la edición.
2. **Nación**: bandera a sangre con tinte de la edición e iluminación cenital.
3. **Foil** de la edición sobre la bandera (patrón en `overlay`, se desvanece hacia abajo).
4. **Club**: escudo grande en el centro, con sombra de contacto y halo del color de la edición.
5. **Valoración** + posición + posiciones alternativas (arriba a la izquierda).
6. **Sello de año** (`'70`) arriba a la derecha; **sello de Icono** centrado si corresponde.
7. **Nombre** centrado y grande, **versión** centrada en el color de acento entre filetes
   ("BRASIL '70", "REAL MADRID 25/26"), línea secundaria sin repetir información.
8. **Seis atributos** (≥ 90 en color de acento).
9. **Brillos**: reflejo que sigue al cursor, barrido de luz, inclinación 3D.

Tamaño `xs` (campo y banquillo) oculta atributos y la línea secundaria.

## Recursos
Bandera y escudo llegan del sistema de recursos (ver `TECHNICAL_ARCHITECTURE.md`). Sin recurso:
bandera `flag-icons` local y escudo provisional generado con los colores del club (marcado
como provisional en su `title`). No existen imágenes estáticas por carta.

## Sobres y valor
Sin rarezas, los sobres usan **bandas de valoración** (≤82, 83–85, 86–88, 89–91, 92+), garantías
de valoración mínima y filtros por época (p. ej. *Sobre Clásicos*: ediciones ≤ 2010 de 90+).
El valor de mercado depende de la valoración. Revelado especial ("walkout") para 88+ e Iconos.

## Marco y silueta por edición

Además del foil, los colores y el brillo, cada año tiene un **marco propio**:
- `frameStyle`: `bevel`, `double` (doble filete), `filigree` (grabado),
  `rivets` (remaches), `tape` (franjas), `gems` (gemas en esquinas y centros),
  `neon` (resplandor animado).
- `shape`: `rounded`, `sharp`, `arched` (esquinas amplias), `notched` (esquinas
  cortadas).
- Cada carta proyecta un halo del color de su edición. Las ediciones con
  movimiento y las cartas de 88+ tienen una luz que recorre el marco.

Composición: la bandera ocupa la mitad superior sin obstáculos. El escudo va
más abajo, en la frontera con el panel inferior. Debajo van el nombre (grande),
la versión centrada y los seis atributos en tamaño grande, sin hueco intermedio.

## Tipos de carta

| Tipo | Cuándo | Diseño |
|---|---|---|
| **Base** | Temporada actual (2025-26) | Diseño estándar del juego. No muestra el año; la línea de versión indica sólo el club. |
| **Temporada pasada** | Cualquier otra temporada | Placa grande "TEMPORADA 02/03" arriba a la derecha y el año gigante de fondo, en el color de su edición. Cada año tiene su paleta, foil, marco y silueta. Los años sin diseño curado reciben uno generado con el ángulo áureo, así cada año tiene una combinación de tonos distinta. |
| **Evento** | `version.event` (p. ej. `toty-2012`) | Diseño de familia (Equipo del Año: azul noche, oro y constelación; Promesas: turquesa y violeta con destellos) con placa del evento y luz que recorre el marco. |
| **Icono** | Propiedad del futbolista | Siempre con **borde interno blanco** entre el marco de su versión y la carta, más el sello "ICONO". |

Eventos incluidos (selección propia del juego, sin marcas de terceros):
- Equipo del Año 2012, 2017 y 2025: 15 cartas cada uno.
- Promesas 2026: 10 cartas.

Se definen en `packages/database/src/seed/events.ts`.

## Catálogo ampliado

`packages/database/src/seed/squads/*.ts` contiene en formato compacto
(`Nombre|POS|media|nación|alt`) todas las plantillas de los clubes de las 5
grandes ligas (96 clubes) y de 28 clubes de ligas secundarias:
- Arabia Saudí, MLS, Portugal y Países Bajos;
- Turquía, Liga MX, Brasil, Argentina y Escocia.

`build.ts` deriva las estadísticas de la carta a partir de la posición y la
media, y detecta jugadores duplicados. Son datos de demostración aproximados a
2025-26 con información pública hasta 2025: pueden no reflejar los últimos
fichajes y no son datos oficiales.
