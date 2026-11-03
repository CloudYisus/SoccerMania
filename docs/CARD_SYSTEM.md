# Sistema de cartas

## Modelo: Player → PlayerVersion → PlayerCard
| Entidad | Qué representa | Ejemplo |
|---|---|---|
| `Player` | Identidad única del futbolista (nunca se duplica) | Ronaldo Nazário |
| `PlayerVersion` | Etapa/temporada: club, nación, posición, rating, 6 atributos, rareza, dorsal, hito | `r9-psv96` (Única), `r9-inter98` (Leyenda), `r9-brasil02` (Leyenda), `r9-icon` (Icono) |
| `PlayerCard` | Edición coleccionable del usuario: origen, lealtad, partidos, cambio de posición, intransferible | `c1a` |

Regla de plantilla: un mismo `Player` no puede aparecer dos veces (aunque sean versiones distintas).

## Composición del CardRenderer (`apps/web/src/components/card/PlayerCard.tsx`)
Todas las medidas internas están en `em` (1em = ancho/20) → una sola composición para cualquier
tamaño (`xs` en el campo, `xl` en el walkout). Capas, de fondo a frente:
1. **Marco** metálico de la rareza (gradiente/conic animado en Única).
2. **Bandera a sangre** (≈ 74 % superior) con tela (pliegues diagonales + grano), tinte de
   rareza en `soft-light` e iluminación cenital; punto focal por país (`FLAG_FOCUS`).
3. **Retrato** recortado en primer plano, anclado abajo, con sombra propia.
4. **Sombra** que funde bandera → bloque de información.
5. **Rating** (Anton, relleno de gradiente por rareza) + **posición** + posiciones alternativas.
6. **Insignia** de rareza (arriba a la derecha).
7. **Escudo** en el lateral derecho (4,1em) con sombra.
8. **Nombre** con tamaño adaptativo, **versión/temporada**, dorsal, nación·club·hito.
9. **Seis atributos** (RIT TIR PAS REG DEF FÍS · porteros EST MAN SAQ REF VEL COL);
   los ≥ 90 se destacan con el color de la rareza.
10. **Brillos**: reflejo especular que sigue al cursor, barrido de luz, inclinación 3D.

Estados: `selected`, `dim`, `interactive`, `tilt`. Tamaño `xs` oculta atributos e insignia.

## Rarezas (extensibles)
Dominio (`packages/domain/src/cards/rarity.ts`): id, etiqueta, orden (`tier`), perfil de química,
multiplicador de mercado y si merece walkout. Visual (`apps/web/src/styles/rarity.css`): variables
`--r-frame`, `--r-base`, `--r-tint`, `--r-rating`, `--r-accent`, `--r-badge`, `--r-glow`, `--r-hi`.

| Rareza | Acabado | Efecto |
|---|---|---|
| Común | Acero satinado | — |
| Especial | Azul eléctrico | Brillo frío al hover |
| Épica | Platino/violeta | Walkout |
| Leyenda | Oro metálico, rating dorado | Walkout |
| Icono | Marfil/champán | Barrido de luz continuo, destellos, química de Icono |
| Única | Holográfica iridiscente | Marco conic animado, barrido prismático |

Añadir una rareza: `registerRarity({...})` + un bloque `[data-rarity='nueva']` en `rarity.css`.

## Recursos
Bandera, escudo y retrato llegan del sistema de recursos (ver `TECHNICAL_ARCHITECTURE.md`).
Sin recurso: bandera `flag-icons` local, escudo provisional generado (marcado como tal en su
`title`) y silueta original con la camiseta del club. No existen imágenes estáticas por carta.
