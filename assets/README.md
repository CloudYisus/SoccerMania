# Recursos gráficos — procedencia y derechos

Este directorio contiene los recursos del juego y la caché del `AssetProvider`.

| Carpeta | Uso | Prioridad |
|---|---|---|
| `players/manual/{playerId}.png` | Retratos (no se usan en las cartas; reservado para pantallas de detalle) | 1ª para retratos |
| `clubs/manual/{clubId}.png\|svg` | Escudos manuales (clubes históricos, selecciones) | 1ª para escudos |
| `flags/manual/{code}.svg` | Banderas personalizadas (p. ej. naciones históricas) | 1ª para banderas |
| `competitions/manual/{leagueId}.png` | Logos de competición | 1ª para logos |
| `clubs/mapping.json` | IDs de API-Football verificados por `npm run sync:teams` | Sustituye al seed |
| `flags/api-football-codes.json` | Códigos de bandera de `/countries` (`npm run sync:countries`) | Overrides de código |
| `cache/` | Descargas automáticas + `manifest.json` (ignorado por git) | — |
| `cards/`, `ui/`, `audio/` | Recursos propios de la interfaz (reservado) | — |

Orden de resolución completo: ver `docs/TECHNICAL_ARCHITECTURE.md`.

## ⚠️ Derechos de uso

La **disponibilidad técnica** de un escudo, una bandera o una fotografía a través de una API
**no implica autorización para su uso comercial**. Escudos, nombres de clubes, fotografías
de futbolistas y marcas de competición pertenecen a sus titulares.

Antes de publicar el juego:

1. Revisar el registro de procedencia (`GET /api/assets/provenance` o `assets/cache/manifest.json`):
   cada recurso indica proveedor, URL de origen, fecha y nota de licencia.
2. Verificar los términos de API-Sports y de TheSportsDB para el uso previsto.
3. Obtener licencias (clubes, ligas, FIFPRO/asociaciones de jugadores, derechos de imagen)
   o sustituir los recursos por arte propio.
4. `flag-icons` se distribuye bajo licencia MIT.
