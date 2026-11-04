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

## Repertorio de jugadas
| Jugada | Cuándo ocurre | Qué la favorece |
|---|---|---|
| **Desmarque** a la espalda de la defensa | Atacantes y medios pican al espacio cuando su equipo progresa | Línea de ataque, RIT, instrucciones *Desmarcarse* (×2,8), *Buscar diagonales* (×2,2), *Subir al ataque* |
| **Pase al hueco** | El poseedor filtra el balón al espacio por delante del compañero que pica | PAS, desmarques activos |
| **Pase largo / cambio de orientación** (por alto) | Pases de 30–62 m; sólo se cortan cerca del destino | PAS, ritmo alto; *Conservar el balón* los evita |
| **Centro al área + remate de cabeza** | Desde la banda en el último tercio o en los córners | PAS del centrador; FÍS + TIR del rematador; marcaje en el área |
| **Disparo lejano** (21–38 m) | Buenos lanzadores con espacio | TIR, *Buscar disparos* (×1,7) |
| **Encarar / regate de varios rivales** | Rival delante a < 3,4 m | REG, RIT; aviso al superar a 2 o más |
| **Mano a mano** | Ningún defensor entre el poseedor y la portería | Conduce hasta ~15 m y decide disparar o **regatear al portero** (REG vs portero) |
| **Faltas y tarjetas** | En los intentos de entrada | Presión alta, instrucción *Presionar*, REG del rival frente a DEF |
| **Penalti** | Falta dentro del área | Lanza el mejor tirador; jugadores fuera del área |
| **Tiro libre directo** | Falta a < 31 m y centrada | Barrera de 4 a 9,15 m; mejor lanzador (TIR + PAS) |
| **Córner** | Balón despejado por el defensor | Cinco rematadores en el área, marcaje y centro directo |
| **Palo, paradón** | Resultado de cualquier disparo | Calidad del disparo (xG) frente al portero |

Calibración (30 partidos 85 vs 78 y 80 vs 80): ≈ 170 pases, 12 disparos, 2 goles, 4 faltas y
≈ 16 avisos por partido: 2–3 pases largos, ~2 pases al hueco, ~2 disparos lejanos, ~1,5 regates
múltiples, ~1,7 manos a mano, ~1 cabezazo, ~1 tiro libre peligroso, ~0,3 penaltis.

## Avisos de jugada destacada
Cada jugada relevante emite un `MatchEvent` con `highlight: { kind, title, detail, major }`.
Las de prioridad alta (gol, penalti, tiro libre, mano a mano, regate al portero, paradón, palo)
siempre se emiten; las demás respetan 7 s de motor entre avisos para no saturar.
La retransmisión las muestra como un aviso breve sobre el campo, resalta al jugador con anillos
y, si está activada la *cámara lenta en jugadas clave*, ralentiza las jugadas de prioridad alta.
Los goles pausan la simulación unos segundos y muestran la **carta del goleador** con minuto,
tipo de gol y asistencia (último pase completado al goleador en los 10 s previos).

## Instrucciones individuales
Presionar · Desmarcarse · Mantener posición (sin desmarques) · Subir al ataque · Replegarse ·
Buscar diagonales · Conservar el balón (menos balones largos, regates y disparos lejanos) ·
Buscar disparos (más tiros y menos regates al portero). Modificables en directo.

## Atributos → probabilidades
- Pase: distancia, PAS, riesgo de línea por rivales (alcance según DEF), presión al receptor.
- Disparo: a puerta = f(TIR, distancia, presión); gol | a puerta = f(TIR − portero, distancia, ángulo).
- Entrada: f(DEF − REG, FÍS − FÍS). Balón suelto: control ponderado por FÍS/REG.
- Velocidad: RIT; fatiga reduce velocidad y atributos (FÍS reduce el desgaste, presionar lo aumenta).
- Química: multiplicador 0,88–1,00 sobre todos los atributos.

Calibración actual (equipos sintéticos, 30 partidos): ≈ 165 pases, 13 disparos y 2,3 goles por
partido; un equipo 7 puntos superior gana ≈ 55 %, empata ≈ 30 % y pierde ≈ 15 %.

## Reglas simplificadas
Sin fueras de juego ni expulsiones (una amarilla como máximo por jugador); los equipos no cambian de campo en el descanso; saques
de banda/puerta/esquina se resuelven entregando el balón al lanzador. Copa: penaltis con
`penaltyShootout` si hay empate.

## Siguientes pasos
Fuera de juego, expulsiones, balón aéreo real (altura), sustituciones, roles de jugador, rendimiento
individual (notas), repeticiones a partir de la semilla, ejecución autoritativa en servidor.

## Decisiones del usuario (simulación + intervenciones)

El partido sigue siendo 11 contra 11 simulado, con movimiento automático. En las
situaciones relevantes el motor abre una **decisión** (`engine.decision`) y la
retransmisión pasa a cámara muy lenta (0,1 s de motor por segundo real), sin
pausa completa: los compañeros siguen desmarcándose y las probabilidades se
recalculan cada 0,25 s con las posiciones reales.

- **Contextos**: con balón (`attack`), mano a mano (`oneonone`), balón parado
  propio (`setpiece`: penalti, tiro libre directo, córner), defensa (`defense`)
  y portero ante un mano a mano rival (`keeper`).
- **Opciones (2–4)**: regate, filigrana (Ruleta, Bicicleta, Caño…), conducción,
  aguantar, pase, pared, pase al hueco, cambio de orientación, balón largo,
  centro, disparo, disparo colocado, trallazo, disparo lejano, vaselina, regatear
  al portero; penalti (izquierda, derecha, centro, Panenka); tiro libre (rosca,
  potente, colgarla, jugada ensayada); córner (primer palo, segundo palo, borde
  del área); entrada, temporizar, plancha, falta táctica; salir a los pies o
  aguantar bajo palos. Se elige la mejor de cada familia (moverse, pasar,
  disparar) y se completan hasta 4.
- **Indicadores**: probabilidad cualitativa (5 niveles; "de éxito" o "de gol"),
  riesgo (coste de fallar: pérdida en zona peligrosa, falta, penalti, tarjeta) y
  la comparativa de atributos que decide el duelo ("REG 91 vs DEF 84").
- **Las cartas importan**: la probabilidad sale de los atributos (con química y
  cansancio) y las acciones especiales se desbloquean con atributos altos
  (REG 86+ filigrana, TIR 84+ colocado, PAS 88+ pase magistral, TIR 85+
  Panenka…). Los Iconos las desbloquean 4 puntos antes.
- **Resultados graduados**: `great`, `good`, `partial` (p. ej. "falta recibida",
  "lo para el portero"), `fail`. Se emiten como eventos `decision` cuando el
  balón llega a su destino, para que el aviso coincida con lo que se ve.
- **Encadenadas**: si la acción deja al jugador (o al receptor) en situación de
  peligro, se ofrece otra decisión inmediata (máx. 2 seguidas).
- **Frecuencia**: `off` / `low` / `medium` / `high` (≈ 0 / 8 / 14 / 19 por
  partido). Si el usuario no elige a tiempo, decide la IA.
- `simulateToEnd()` desactiva las decisiones. Con las mismas elecciones, el
  partido es determinista.

## Estilos de la IA rival

`TeamTactics.style`: `balanced`, `possession`, `counter`, `direct`, `wings`,
`highpress`. Cada estilo modifica las preferencias de pase (corto, largo, al
hueco, centro), de disparo lejano, de regate, la frecuencia de desmarques, la
altura del bloque, la amplitud, el ritmo, la presión y las faltas.

## Impulso: las jugadas bien elegidas tienen continuidad

Tras una decisión ofensiva acertada (regate, filigrana, pared, pase al hueco,
centro, conducción…), el jugador que continúa la jugada recibe **impulso**
(nivel 1–3 según la cadena y la calidad de la acción, durante ~5,5 s de motor):
- queda protegido de entradas ~1,2 s y los rivales cercanos tardan en reaccionar;
- sus siguientes acciones tienen ventaja: regate +6 %/nivel, pase +4 %/nivel,
  entradas rivales −12 %/nivel, y en el disparo +7 % a puerta y ×(1 + 0,2·nivel)
  de gol;
- si decide la IA, busca terminar la jugada (prefiere el disparo cerca del área);
- se pueden encadenar hasta 3 decisiones seguidas.

Así, en las pruebas, alrededor del 58 % de las decisiones ofensivas acertadas
acaban en disparo y el 27 % en gol (medido sobre las acciones acertadas, no
sobre cadenas completas). No es gol seguro: un remate con impulso sigue
pudiendo ir fuera o pararse.

## Goleadores variados

- **Llegadas desde segunda línea**: medios y extremos atacan el área (punto de
  penalti o frontal) cuando el balón se acerca; si reciben ahí, rematan de
  primeras.
- **Pase de la muerte**: el poseedor encimado busca al compañero libre ante el
  portero.
- **Balón parado**: en los córners y en las faltas laterales cercanas suben los
  mejores en el juego aéreo (incluidos los centrales, que cabecean con su
  atributo de defensa), con azar en quién gana la posición. Un medio espera el
  rechace en la frontal.
- **Rechaces**: el portero puede despejar dentro del área (balón vivo). Los
  despejes de cabeza caen a la frontal o salen a córner, y algunos disparos
  desviados también acaban en córner.
- **Marcaje a las estrellas**: los delanteros más peligrosos reciben marcaje más
  estrecho, lo que reparte más el juego.

Reparto medido con plantillas reales: ~78 % de los goles son de delanteros, ~15 %
de medios y ~8 % de defensas.

## Render y rendimiento

- El motor expone `getFrame()`: posiciones **interpoladas entre ticks** (0,1 s)
  en un objeto reutilizado. El movimiento es fluido a cualquier velocidad,
  también a cámara lenta durante las decisiones.
- Hay un solo bucle: la escena de Phaser llama a `onFrame(dt)` (avanza el motor
  y devuelve el fotograma). La interfaz de React se actualiza 4 veces por
  segundo.
- El campo y las fichas se pre-renderizan en texturas una sola vez. Se usa
  Canvas 2D (`?webgl` en la URL fuerza WebGL), a resolución nativa en pantallas
  Retina.
- Durante el partido, el resto de la aplicación queda oculto (no se pinta ni
  anima nada detrás).

## Fichas de los jugadores

Cada ficha es la carta del jugador en miniatura:
- bandera de su nación en el centro;
- anillo grueso del color del equipo, ajustado para que contraste con el césped
  y con el rival;
- filete exterior del color de la edición de su carta;
- dorsal en una chapa y estrella dorada si es Icono;
- nombre siempre visible.
