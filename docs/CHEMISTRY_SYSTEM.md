# Sistema de química (modelo clásico FUT 17–22)

Implementación: `packages/domain/src/chemistry/` · Configuración: `DEFAULT_CHEMISTRY_CONFIG`.

## 1. Grafo por formación
Cada formación (`squad/formations.ts`) define sus 11 slots y sus **aristas de enlace**. Sólo los
futbolistas conectados en el grafo se influyen. Formaciones: 4-3-3, 4-2-3-1, 4-4-2, 3-5-2,
4-1-4-1, 4-3-1-2. Los tests verifican que cada grafo es conexo y que todos los slots tienen ≥ 2 enlaces.

## 2. Fuerza de un enlace
```
puntos = club·w_club + liga·w_liga + nación·w_nación      (w = 1 por defecto)
verde    (fuerte)    si puntos ≥ 2
amarillo (intermedio) si puntos ≥ 1
rojo     (débil)     si puntos = 0
```
Casos: mismo club → verde (club + liga). Liga + nación → verde. Sólo liga o sólo nación → amarillo.
**Iconos**: verde con su nación y, como mínimo, amarillo con cualquiera.

Valor numérico para promediar: verde 2 · amarillo 1 · rojo 0. Los enlaces a slots vacíos valen 0.

## 3. Química individual (0–10)
Media de enlaces del jugador → fila de la tabla; columna según el encaje posicional:

| Media de enlaces | Natural | Relacionada | Fuera de posición |
|---|---|---|---|
| ≥ 1,6 | 10 | 7 | 3 |
| ≥ 1,0 | 9 | 6 | 2 |
| ≥ 0,5 | 6 | 4 | 1 |
| < 0,5 | 3 | 2 | 0 |

Bonificaciones (tope 10): **lealtad** +1 · **mánager** +1 si coincide nación o liga.
Encaje: *natural* = posición de la carta (o su cambio de posición); *relacionada* = vecina
(MC↔MCD/MCO, LD↔CAD, ED↔MD, DC↔SD…) o posición alternativa de la versión; resto *fuera de posición*.

## 4. Química de equipo
Suma de las individuales, con tope 100 (11 × 10 = 110).

## 5. Recalcular
La química es una función pura de (formación, 11 jugadores, mánager). En el cliente se recalcula
con `useMemo` cada vez que cambia la plantilla: cambio de jugador, posición, formación, versión
de carta o club/liga/nación representados. El panel de alternativas calcula la **química
proyectada** de cada candidato antes de colocarlo.

## 6. Visualización
Líneas SVG por encima del césped **recortadas al borde de las cartas** (nunca quedan ocultas),
con núcleo + halo y colores verde/amarillo/rojo; discontinuas si falta un extremo. Al
seleccionar una carta se resaltan sus enlaces y se atenúan los demás.

## 7. Influencia en el partido
`chemistryPerformanceFactor(q) = 0,88 + 0,12 · q/10` multiplica los atributos de simulación
(química 0 → −12 %). Un test verifica que un equipo con química 10 rinde mejor que uno con 0.
