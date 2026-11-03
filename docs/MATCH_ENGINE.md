# Match Engine

Implementación: `packages/domain/src/match/` · Render: `packages/match-renderer/`.

## Principio
El **motor decide**, el renderizador **representa**. Cada acción se resuelve en el instante en que
se ejecuta (pase completado/interceptado/perdido, gol/parada/fuera, entrada ganada/perdida) con
probabilidades derivadas de los atributos. Phaser sólo interpola posiciones y dibuja.

## Contratos
```ts
new MatchEngine(home: MatchTeamSetup, away: MatchTeamSetup, seed, config?)
engine.step(dtSeconds)          // paso fijo interno (0,1 s)
engine.simulateToEnd()
engine.getSnapshot(): MatchSnapshot   // posiciones, balón, marcador, fase, estadísticas
engine.drainEvents(): MatchEvent[]    // pase, intercepción, entrada, regate, disparo, parada, gol…
engine.setInstruction(playerId, instr)
engine.setTactics(side, tactics)
createMatchView({ parent, home, away, userSide, onPlayerClick }) → { update, setSelected, destroy }
```
Determinista: misma semilla + mismas entradas ⇒ mismo partido (base para repeticiones y multijugador).

## Coordenadas y tiempo
Campo 105 × 68 m. 90' se comprimen en 360 s de motor (≈ 6 min a 1×; velocidades 1×–8×).

## Inteligencia en tres niveles
1. **Colectiva** — fase (posesión/defensa), altura de la línea, longitud y amplitud del bloque,
   desplazamiento lateral hacia el balón; dependen de mentalidad, presión, amplitud, altura y ritmo.
2. **Por puesto** — cada jugador parte del anclaje de su slot en la formación; delanteros sobre
   la última línea, portero cubriendo el centro, marcaje zonal sobre el rival más cercano.
3. **Individual** — el poseedor evalúa disparo, todos los pases (riesgo de línea, presión sobre
   el receptor, progreso, coste de pérdida) y 5 direcciones de conducción; elige por utilidad con
   ruido dependiente de su calidad. Presión del más cercano (2 si presión alta), entradas a < 1,8 m.

## Instrucciones individuales
Presionar · Desmarcarse (ataque cíclico a la espalda) · Mantener posición · Subir al ataque ·
Replegarse · Buscar diagonales · Conservar el balón (utilidad de pase cuadrática en éxito) ·
Buscar disparos (mayor rango y peso del tiro). Modificables en directo.

## Atributos → probabilidades
- Pase: distancia, PAS, riesgo de línea por rivales (alcance según DEF), presión al receptor.
- Disparo: a puerta = f(TIR, distancia, presión); gol | a puerta = f(TIR − portero, distancia, ángulo).
- Entrada: f(DEF − REG, FÍS − FÍS). Balón suelto: control ponderado por FÍS/REG.
- Velocidad: RIT; fatiga reduce velocidad y atributos (FÍS reduce el desgaste, presionar lo aumenta).
- Química: multiplicador 0,88–1,00 sobre todos los atributos.

Calibración actual (equipos sintéticos, 30 partidos): ≈ 165 pases, 13 disparos y 2,3 goles por
partido; un equipo 7 puntos superior gana ≈ 55 %, empata ≈ 30 % y pierde ≈ 15 %.

## Reglas simplificadas del prototipo
Sin fueras de juego, faltas ni tarjetas; los equipos no cambian de campo en el descanso; saques
de banda/puerta/esquina se resuelven entregando el balón al lanzador. Copa: penaltis con
`penaltyShootout` si hay empate.

## Siguientes pasos
Fuera de juego, faltas, balón aéreo real (altura), sustituciones, roles de jugador, rendimiento
individual (notas), repeticiones a partir de la semilla, ejecución autoritativa en servidor.
