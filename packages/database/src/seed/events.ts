import { seasonToYear, type CardEvent, type Player, type PlayerVersion, type Position } from '@fu/domain';
import { deriveStats, slug } from './squads/build';

/**
 * EVENTOS Y EQUIPOS TEMÁTICOS (cartas especiales)
 *
 * "Equipo del Año" es una SELECCIÓN PROPIA DEL JUEGO (15 futbolistas por año),
 * inspirada en las grandes temporadas; no es un premio oficial ni usa marcas de
 * terceros. Ratings y estadísticas son valores de diseño de juego.
 */
export const EVENTS: CardEvent[] = [
  { id: 'toty-2012', kind: 'toty', name: 'Equipo del Año 2012', cardName: 'EQUIPO DEL AÑO', year: 2012, description: 'Los 15 mejores de la temporada 2011-12, según el juego.' },
  { id: 'toty-2017', kind: 'toty', name: 'Equipo del Año 2017', cardName: 'EQUIPO DEL AÑO', year: 2017, description: 'Los 15 mejores de la temporada 2016-17, según el juego.' },
  { id: 'toty-2025', kind: 'toty', name: 'Equipo del Año 2025', cardName: 'EQUIPO DEL AÑO', year: 2025, description: 'Los 15 mejores de la temporada 2024-25, según el juego.' },
  { id: 'promesas-2026', kind: 'promesas', name: 'Promesas 2026', cardName: 'PROMESAS', year: 2026, description: 'Jóvenes talentos con versión mejorada para esta temporada.' },
];

/** Nombre|POS|media|nación|club|temporada[|alt1,alt2] */
const ROSTERS: Record<string, string> = {
  'toty-2012': `
    Casillas|GK|94|es|real-madrid|2011-12
    Dani Alves|RB|91|br|barcelona|2011-12|RWB
    Piqué|CB|91|es|barcelona|2011-12
    Sergio Ramos|CB|92|es|real-madrid|2011-12|RB
    Marcelo|LB|90|br|real-madrid|2011-12|LWB
    Xavi|CM|95|es|barcelona|2011-12
    Iniesta|CM|94|es|barcelona|2011-12|CAM
    Xabi Alonso|CDM|92|es|real-madrid|2011-12|CM
    Messi|RW|98|ar|barcelona|2011-12|CF,CAM
    Cristiano Ronaldo|LW|97|pt|real-madrid|2011-12|ST
    Falcao|ST|93|co|atletico|2011-12
    Neuer|GK|92|de|bayern|2011-12
    Pirlo|CM|93|it|juventus|2011-12|CDM
    Van Persie|ST|93|nl|arsenal|2011-12
    Ibrahimović|ST|93|se|milan|2011-12
  `,
  'toty-2017': `
    Buffon|GK|94|it|juventus|2016-17
    Dani Alves|RB|90|br|juventus|2016-17
    Bonucci|CB|92|it|juventus|2016-17
    Sergio Ramos|CB|94|es|real-madrid|2016-17
    Marcelo|LB|92|br|real-madrid|2016-17
    Modrić|CM|94|hr|real-madrid|2016-17
    Kroos|CM|93|de|real-madrid|2016-17|CDM
    Iniesta|CM|92|es|barcelona|2016-17|CAM
    Messi|RW|98|ar|barcelona|2016-17|CF
    Cristiano Ronaldo|ST|97|pt|real-madrid|2016-17|LW
    Neymar|LW|94|br|barcelona|2016-17
    Lewandowski|ST|94|pl|bayern|2016-17
    Kanté|CDM|92|fr|chelsea|2016-17|CM
    Hazard|LW|93|be|chelsea|2016-17|CAM
    De Gea|GK|93|es|man-utd|2016-17
  `,
  'toty-2025': `
    Donnarumma|GK|94|it|psg|2024-25
    Hakimi|RB|93|ma|psg|2024-25|RWB
    Van Dijk|CB|94|nl|liverpool|2024-25
    Saliba|CB|92|fr|arsenal|2024-25
    Nuno Mendes|LB|93|pt|psg|2024-25
    Vitinha|CM|94|pt|psg|2024-25|CDM
    Pedri|CM|94|es|barcelona|2024-25|CAM
    Bellingham|CAM|93|gb-eng|real-madrid|2024-25|CM
    Dembélé|RW|96|fr|psg|2024-25|ST
    Salah|RW|96|eg|liverpool|2024-25
    Lamine Yamal|RW|95|es|barcelona|2024-25|CAM
    Raphinha|LW|94|br|barcelona|2024-25
    Kane|ST|94|gb-eng|bayern|2024-25
    Mbappé|ST|95|fr|real-madrid|2024-25|LW
    Rice|CDM|92|gb-eng|arsenal|2024-25|CM
  `,
  'promesas-2026': `
    Cubarsí|CB|87|es|barcelona|2025-26
    Mastantuono|RW|84|ar|real-madrid|2025-26|CAM
    Estêvão|RW|85|br|chelsea|2025-26
    Doué|RW|88|fr|psg|2025-26|LW
    Zaïre-Emery|CM|85|fr|psg|2025-26
    Güler|CAM|86|tr|real-madrid|2025-26|RW
    Nico Paz|CAM|87|ar|como|2025-26
    Lewis-Skelly|LB|83|gb-eng|arsenal|2025-26|CM
    Yıldız|LW|88|tr|juventus|2025-26|CAM
    Endrick|ST|84|br|real-madrid|2025-26
  `,
};

/** Crea las versiones de evento (y los futbolistas que aún no existan). */
export function eventCatalog(players: Player[]): { players: Player[]; versions: PlayerVersion[] } {
  const all = [...players];
  const byKey = new Map(players.map((p) => [`${slug(p.knownAs)}|${p.nationCode}`, p]));
  const ids = new Set(players.map((p) => p.id));
  const versions: PlayerVersion[] = [];
  for (const ev of EVENTS) {
    const lines = ROSTERS[ev.id]
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    lines.forEach((line, i) => {
      const [name, pos, rating, nation, clubId, season, alts] = line.split('|').map((x) => x.trim());
      let p = byKey.get(`${slug(name)}|${nation}`);
      if (!p) {
        let id = slug(name);
        if (ids.has(id)) id = `${id}-${ev.year}`;
        p = { id, knownAs: name, fullName: name, nationCode: nation, birthYear: 0, icon: false };
        ids.add(id);
        all.push(p);
        byKey.set(`${slug(name)}|${nation}`, p);
      }
      const position = pos as Position;
      versions.push({
        id: `${p.id}-${ev.id}`,
        playerId: p.id,
        label: ev.name,
        season,
        year: seasonToYear(season),
        clubId,
        nationCode: nation,
        position,
        altPositions: (alts ? alts.split(',') : []) as Position[],
        rating: Number(rating),
        stats: deriveStats(`${name}|${ev.id}`, position, Number(rating)),
        shirtNumber: [1, 2, 3, 4, 5, 8, 6, 10, 7, 11, 9, 12, 14, 17, 21][i] ?? 20 + i,
        milestone: ev.name,
        event: ev.id,
      });
    });
  }
  return { players: all, versions };
}
