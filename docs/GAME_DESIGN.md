# Game Design — Football Ultimate

## Visión
Juego de colección y gestión de cartas de futbolistas reales de todas las épocas. El jugador
abre sobres, ficha en el mercado, construye un once (11 + 7 suplentes) con química clásica y
compite en partidos simulados que se ven en directo y admiten instrucciones individuales.

## Bucle principal
1. **Conseguir cartas** → sobres (tienda) y mercado de traspasos.
2. **Construir plantilla** → formación, química, mánager, tácticas.
3. **Competir** → partido rápido, Divisiones, Copa, Desafíos de plantilla.
4. **Recompensas** → monedas y experiencia → más sobres y fichajes.

## Secciones (navegación superior, Q/E para cambiar)
| Sección | Contenido implementado |
|---|---|
| Inicio | Panel promocional, accesos con estado real (plantilla, división, mercado, desafíos, club, resultados) |
| Plantilla | Campo con 11 cartas, líneas de química, banquillo de 7, reservas, panel de jugador, alternativas con química proyectada, tácticas, autocompletar, arrastrar y soltar |
| Club | Colección con filtros, detalle de carta, versiones del mismo jugador, venta rápida y venta en mercado |
| Mercado | Compra a vendedores IA, filtros, ventas propias con resolución temporizada e impuesto del 5 % |
| Sobres | 5 sobres con probabilidades visibles; apertura con "walkout" (nación → posición → club → carta) |
| Competir | Partido rápido (5 rivales), Divisiones (10 niveles, temporadas de 7 jornadas), Copa (3 rondas, penaltis), Desafíos (6 objetivos evaluados sobre la plantilla real) |

## Economía
- Valor de mercado = f(valoración) — exponencial; rango de precios permitido 0,6×–2,5×.
- Venta rápida ≈ 8 % del valor; impuesto de mercado 5 %.
- Recompensa por partido según resultado, goles y dificultad. Bonus de fin de temporada.
- Cartas de sobre/recompensa: leales (+1 química). Compradas: lealtad tras 10 partidos.
- Cartas iniciales y de recompensa: intransferibles.

## Ediciones e Iconos
No hay rarezas. Cada **año** tiene su propio diseño de carta (todas las versiones de 2022 comparten
estética), y los **Iconos** —leyendas retiradas— se distinguen en todas sus cartas, sea cual sea
la versión. Los sobres se definen por bandas de valoración y por épocas. Ver `CARD_SYSTEM.md`.

## Principios
- La lógica nunca es decorativa: química, rating, precios y resultados se calculan.
- Los mejores rinden mejor estadísticamente, pero no ganan siempre.
- Datos de demostración claramente señalados; nada se presenta como dato oficial de API.

## Copa Ultimate

Ocho equipos (el del usuario y 7 rivales de la IA, sorteados en el cuadro) a
eliminación directa: cuartos, semifinal y final, con penaltis si hay empate.
El usuario juega en directo. Los demás partidos se simulan con el mismo motor
al terminar cada ronda, y si el usuario cae el torneo sigue hasta coronar
campeón.

Se registran estadísticas de todos los participantes:
- goleadores (Bota de oro);
- asistentes;
- porterías a cero (Guante de oro).

Se muestran junto al cuadro con la carta del líder. Inscripción: 2.500
monedas; premio al campeón: 25.000.
