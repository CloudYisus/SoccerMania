/**
 * Valoración del equipo con la fórmula clásica de FUT:
 * 1) media de los once;
 * 2) "corrección": se suma lo que cada jugador supera esa media;
 * 3) (suma + corrección) / 11, redondeado hacia abajo.
 * Los huecos vacíos cuentan como 0 para penalizar plantillas incompletas.
 */
export function teamRating(ratings: (number | null)[], slots = 11): number {
  const values = Array.from({ length: slots }, (_, i) => ratings[i] ?? 0);
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / slots;
  const correction = values.reduce((acc, r) => (r > avg ? acc + (r - avg) : acc), 0);
  return Math.floor((sum + correction) / slots);
}
