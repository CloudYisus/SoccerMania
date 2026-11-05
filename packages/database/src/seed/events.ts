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
  { id: 'tormenta-2026', kind: 'tormenta', name: 'Tormenta', cardName: 'TORMENTA', year: 2026, description: 'Promoción de la temporada: los futbolistas más eléctricos, con mejoras de ritmo y regate.' },
  { id: 'gala-2026', kind: 'gala', name: 'Noches de Gala', cardName: 'NOCHES DE GALA', year: 2026, description: 'Promoción de las grandes noches europeas: estrellas en su mejor versión.' },
  { id: 'tots-eng-2025', kind: 'tots', leagueId: 'eng-premier', name: 'Equipo de la Temporada · Premier League', cardName: 'EQUIPO DE LA TEMPORADA', year: 2025, description: 'El once ideal de la Premier League 2024-25, según el juego.' },
  { id: 'tots-esp-2025', kind: 'tots', leagueId: 'esp-laliga', name: 'Equipo de la Temporada · LaLiga', cardName: 'EQUIPO DE LA TEMPORADA', year: 2025, description: 'El once ideal de LaLiga 2024-25, según el juego.' },
  { id: 'tots-ita-2025', kind: 'tots', leagueId: 'ita-serie-a', name: 'Equipo de la Temporada · Serie A', cardName: 'EQUIPO DE LA TEMPORADA', year: 2025, description: 'El once ideal de la Serie A 2024-25, según el juego.' },
  { id: 'tots-ger-2025', kind: 'tots', leagueId: 'ger-bundesliga', name: 'Equipo de la Temporada · Bundesliga', cardName: 'EQUIPO DE LA TEMPORADA', year: 2025, description: 'El once ideal de la Bundesliga 2024-25, según el juego.' },
  { id: 'tots-fra-2025', kind: 'tots', leagueId: 'fra-ligue-1', name: 'Equipo de la Temporada · Ligue 1', cardName: 'EQUIPO DE LA TEMPORADA', year: 2025, description: 'El once ideal de la Ligue 1 2024-25, según el juego.' },
  // Onces históricos (selecciones propias del juego, inspiradas en cada torneo/temporada)
  { id: 'tots-eng-2014', kind: 'tots', leagueId: 'eng-premier', name: 'Equipo de la Temporada · Premier League 13/14', cardName: 'EQUIPO DE LA TEMPORADA', year: 2014, description: 'El once ideal de la Premier League 2013-14: el Liverpool de Suárez y Sturridge, el City de Yaya Touré y el Chelsea de Hazard.' },
  { id: 'mundial-2014', kind: 'mundial', name: 'Once Ideal · Mundial 2014', cardName: 'ONCE IDEAL MUNDIAL', year: 2014, description: 'Los destacados del Mundial de Brasil 2014, según el juego.' },
  { id: 'euro-2008', kind: 'euro', name: 'Once Ideal · Eurocopa 2008', cardName: 'ONCE IDEAL EUROCOPA', year: 2008, description: 'La Eurocopa del tiqui-taca y de la Rusia de Arshavin, según el juego.' },
  { id: 'euro-2004', kind: 'euro', name: 'Once Ideal · Eurocopa 2004', cardName: 'ONCE IDEAL EUROCOPA', year: 2004, description: 'La gesta de Grecia y los mejores de Portugal 2004, según el juego.' },
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
  'tormenta-2026': `
    Saliba|CB|90|fr|arsenal|2025-26
    Rice|CDM|90|gb-eng|arsenal|2025-26|CM
    Pedri|CM|91|es|barcelona|2025-26|CAM
    Vitinha|CM|91|pt|psg|2025-26|CDM
    Wirtz|CAM|90|de|liverpool|2025-26|CM
    Olise|RW|90|fr|bayern|2025-26|CAM
    Lamine Yamal|RW|92|es|barcelona|2025-26|CAM
    Kvaratskhelia|LW|91|ge|psg|2025-26
    Raphinha|LW|91|br|barcelona|2025-26|RW
    Isak|ST|90|se|liverpool|2025-26
    Gyökeres|ST|89|se|arsenal|2025-26
    Kane|ST|92|gb-eng|bayern|2025-26
  `,
  'gala-2026': `
    Courtois|GK|91|be|real-madrid|2025-26
    Hakimi|RB|91|ma|psg|2025-26|RWB
    Van Dijk|CB|91|nl|liverpool|2025-26
    De Bruyne|CM|89|be|napoli|2025-26|CAM
    Bellingham|CAM|91|gb-eng|real-madrid|2025-26|CM
    Salah|RW|91|eg|liverpool|2025-26
    Dembélé|RW|93|fr|psg|2025-26|ST
    Vini Jr.|LW|92|br|real-madrid|2025-26
    Lautaro|ST|90|ar|inter|2025-26
    Guirassy|ST|89|gn|dortmund|2025-26
    Haaland|ST|93|no|man-city|2025-26
    Mbappé|ST|93|fr|real-madrid|2025-26|LW
  `,
  'tots-eng-2025': `
    Raya|GK|90|es|arsenal|2024-25
    Alexander-Arnold|RB|90|gb-eng|liverpool|2024-25|CM
    Van Dijk|CB|93|nl|liverpool|2024-25
    Gabriel|CB|90|br|arsenal|2024-25
    Kerkez|LB|88|hu|bournemouth|2024-25
    Gravenberch|CDM|90|nl|liverpool|2024-25|CM
    Palmer|CAM|91|gb-eng|chelsea|2024-25|RW
    Mbeumo|RW|89|cm|brentford|2024-25
    Salah|RW|95|eg|liverpool|2024-25
    Isak|ST|92|se|newcastle|2024-25
    Rice|CM|90|gb-eng|arsenal|2024-25|CDM
  `,
  'tots-esp-2025': `
    Oblak|GK|90|si|atletico|2024-25
    Koundé|RB|90|fr|barcelona|2024-25|CB
    Cubarsí|CB|89|es|barcelona|2024-25
    Iñigo Martínez|CB|89|es|barcelona|2024-25
    Balde|LB|88|es|barcelona|2024-25
    Valverde|CM|91|uy|real-madrid|2024-25|CDM
    Pedri|CM|93|es|barcelona|2024-25|CAM
    Bellingham|CAM|91|gb-eng|real-madrid|2024-25
    Lamine Yamal|RW|94|es|barcelona|2024-25
    Raphinha|LW|93|br|barcelona|2024-25
    Mbappé|ST|94|fr|real-madrid|2024-25
  `,
  'tots-ita-2025': `
    Svilar|GK|89|rs|roma|2024-25
    Di Lorenzo|RB|89|it|napoli|2024-25
    Bastoni|CB|90|it|inter|2024-25
    Buongiorno|CB|88|it|napoli|2024-25
    Dimarco|LB|89|it|inter|2024-25|LWB
    Lobotka|CDM|89|sk|napoli|2024-25
    McTominay|CM|91|gb-sct|napoli|2024-25|CAM
    Reijnders|CM|89|nl|milan|2024-25
    Lookman|LW|89|ng|atalanta|2024-25
    Retegui|ST|90|it|atalanta|2024-25
    Kean|ST|89|it|fiorentina|2024-25
  `,
  'tots-ger-2025': `
    Kobel|GK|89|ch|dortmund|2024-25
    Frimpong|RB|89|nl|leverkusen|2024-25|RWB
    Tah|CB|89|de|leverkusen|2024-25
    Upamecano|CB|89|fr|bayern|2024-25
    Mittelstädt|LB|87|de|stuttgart|2024-25
    Kimmich|CDM|91|de|bayern|2024-25|RB
    Wirtz|CAM|93|de|leverkusen|2024-25
    Musiala|CAM|91|de|bayern|2024-25|LW
    Olise|RW|91|fr|bayern|2024-25
    Guirassy|ST|90|gn|dortmund|2024-25
    Kane|ST|93|gb-eng|bayern|2024-25
  `,
  'tots-fra-2025': `
    Chevalier|GK|88|fr|lille|2024-25
    Hakimi|RB|92|ma|psg|2024-25
    Marquinhos|CB|89|br|psg|2024-25
    Pacho|CB|89|ec|psg|2024-25
    Nuno Mendes|LB|91|pt|psg|2024-25
    Vitinha|CM|92|pt|psg|2024-25
    João Neves|CM|90|pt|psg|2024-25|CDM
    Akliouche|CAM|88|fr|monaco|2024-25|RW
    Greenwood|RW|89|gb-eng|marseille|2024-25
    Doué|LW|89|fr|psg|2024-25|RW
    Dembélé|ST|94|fr|psg|2024-25|RW
  `,
  'tots-eng-2014': `
    Čech|GK|88|cz|chelsea|2013-14
    Coleman|RB|86|ie|everton|2013-14|RWB
    Cahill|CB|87|gb-eng|chelsea|2013-14
    Kompany|CB|89|be|man-city|2013-14
    Shaw|LB|85|gb-eng|southampton|2013-14|LWB
    Yaya Touré|CM|92|ci|man-city|2013-14|CAM,CDM
    Gerrard|CDM|91|gb-eng|liverpool|2013-14|CM
    Lallana|CAM|87|gb-eng|southampton|2013-14|CM,LM
    Hazard|LW|92|be|chelsea|2013-14|CAM
    Suárez|ST|94|uy|liverpool|2013-14|CF
    Sturridge|ST|90|gb-eng|liverpool|2013-14|CF
  `,
  'mundial-2014': `
    Neuer|GK|93|de|bayern|2014
    Lahm|RB|92|de|bayern|2014|CDM
    Hummels|CB|90|de|dortmund|2014
    Thiago Silva|CB|90|br|psg|2014
    Marcos Rojo|LB|86|ar|sporting|2014|CB
    Mascherano|CDM|90|ar|barcelona|2014|CB
    Kroos|CM|91|de|bayern|2014|CAM
    James Rodríguez|CAM|91|co|monaco|2014|RW|Bota de Oro del Mundial
    Robben|RW|92|nl|bayern|2014
    Messi|RW|95|ar|barcelona|2014|CF
    T. Müller|ST|91|de|bayern|2014|CAM,RW
    Neymar|LW|91|br|barcelona|2014
    Götze|CAM|88|de|bayern|2014|CF
    Keylor Navas|GK|89|cr|levante|2014
  `,
  'euro-2008': `
    Casillas|GK|93|es|real-madrid|2008
    Sergio Ramos|RB|88|es|real-madrid|2008|CB
    Puyol|CB|91|es|barcelona|2008
    Marchena|CB|86|es|valencia|2008|CDM
    Lahm|LB|89|de|bayern|2008|RB
    Senna|CDM|90|es|villarreal|2008|CM
    Xavi|CM|94|es|barcelona|2008
    Ballack|CM|89|de|chelsea|2008|CAM
    Sneijder|CAM|89|nl|real-madrid|2008|CM
    Arshavin|LW|91|ru|zenit|2008|CAM
    Villa|ST|92|es|valencia|2008|LW
    Fernando Torres|ST|90|es|liverpool|2008
    Pavlyuchenko|ST|85|ru|spartak|2008
  `,
  'euro-2004': `
    Nikopolidis|GK|86|gr|panathinaikos|2004
    Seitaridis|RB|84|gr|panathinaikos|2004
    Dellas|CB|88|gr|roma|2004
    Ricardo Carvalho|CB|89|pt|porto|2004
    Ashley Cole|LB|87|gb-eng|arsenal|2004
    Zagorakis|CDM|90|gr|aek|2004|CM
    Maniche|CM|87|pt|porto|2004|CAM
    Lampard|CM|89|gb-eng|chelsea|2004|CAM
    Nedvěd|CAM|91|cz|juventus|2004|LM
    Cristiano Ronaldo|RW|86|pt|man-utd|2004|LW
    Rooney|ST|88|gb-eng|everton|2004|CF
    Baroš|ST|88|cz|liverpool|2004
    Charisteas|ST|87|gr|bremen|2004
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
