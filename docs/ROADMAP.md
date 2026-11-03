# Roadmap

## v0.1 — Hecho
- Identidad visual, navegación FUT de 6 secciones con transiciones y atajos Q/E.
- CardRenderer con bandera a sangre, retrato, escudo lateral, 6 atributos y 6 rarezas.
- Plantilla 11 + 7 con química clásica real, 6 formaciones, mánager, tácticas, autocompletar,
  arrastrar y soltar, alternativas con química proyectada.
- Club, mercado (compra/venta IA con impuesto), sobres con walkout, divisiones, copa, desafíos.
- Integración API-Football + TheSportsDB + flag-icons con caché, procedencia y placeholders.
- Match Engine determinista (pases, movimientos, recuperaciones, disparos, porteros, fatiga,
  tácticas, instrucciones) + renderer Phaser 3.
- 63 pruebas automatizadas.

## v0.2 — Próximo
- Verificar IDs con clave real (`sync:teams`, `sync:countries`) y escudos manuales para clubes históricos.
- Retratos con transparencia y licencia (pipeline de recorte y normalización de proporciones).
- Persistencia en servidor (PostgreSQL) y cuentas de usuario; mercado real entre usuarios.
- Cambios de posición (consumibles), suplentes en partido, roles de jugador.
- Motor: fuera de juego, faltas, juego aéreo, notas de jugador, repeticiones.

## v0.3+
- Multijugador asíncrono y en tiempo real (motor autoritativo en servidor).
- Temporadas, objetivos semanales, SBC avanzados, eventos de cartas especiales.
- Audio, ambientación de estadio, más animaciones de walkout.
- Licencias de nombres, escudos y fotografías antes de cualquier lanzamiento comercial.
