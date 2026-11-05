import { seasonToYear, type Player, type PlayerVersion, type Position } from '@fu/domain';
import { deriveStats, slug } from './squads/build';

/**
 * VERSIONES HISTÓRICAS ADICIONALES
 * - Nuevos Iconos (leyendas retiradas): todas sus cartas son de Icono.
 * - Temporadas pasadas de estrellas actuales.
 * - Destacados del Mundial 2010 (diseño de la edición 2010).
 *
 * Nombre|POS|media|nación|club|temporada|etiqueta|alt1,alt2|hito
 * Ratings y estadísticas son valores de diseño de juego.
 */
const ICONS = `
  Kaká|CAM|94|br|milan|2006-07|Milan '07|CM,CF|Balón de Oro
  Kaká|CAM|91|br|real-madrid|2009-10|Real Madrid '10|CM
  Beckham|RM|91|gb-eng|man-utd|1998-99|Man Utd '99|CM,RW|Triplete
  Lampard|CM|91|gb-eng|chelsea|2008-09|Chelsea '09|CAM
  Gerrard|CM|92|gb-eng|liverpool|2004-05|Liverpool '05|CAM,CDM|Noche de Estambul
  Drogba|ST|92|ci|chelsea|2011-12|Chelsea '12||Campeón de Europa
  Raúl|ST|91|es|real-madrid|2001-02|Real Madrid '02|CF,CAM|Campeón de Europa
  Figo|RW|92|pt|real-madrid|2000-01|Real Madrid '01|RM,CAM|Balón de Oro
  Nesta|CB|93|it|milan|2002-03|Milan '03||Campeón de Europa
  Cannavaro|CB|93|it|juventus|2005-06|Italia '06||Balón de Oro
  Shevchenko|ST|93|ua|milan|2003-04|Milan '04||Balón de Oro
  Del Piero|CF|92|it|juventus|1997-98|Juventus '98|ST,LW
  Totti|CAM|92|it|roma|2000-01|Roma '01|CF,ST|Scudetto
  Van Basten|ST|95|nl|milan|1988-89|Milan '89||Balón de Oro
  Gullit|CAM|93|nl|milan|1988-89|Milan '89|CM,CF|Campeón de Europa
  Lahm|RB|91|de|bayern|2012-13|Bayern '13|CDM,LB|Triplete
  Klose|ST|90|de|bremen|2005-06|Werder '06||Máximo goleador
  Klose|ST|91|de|lazio|2014|Alemania '14||Campeones del mundo
`;

const SEASONS = `
  Messi|RW|97|ar|barcelona|2014-15|Barcelona '15|CF,CAM|Triplete
  Cristiano Ronaldo|LW|93|pt|man-utd|2007-08|Man Utd '08|RW,ST|Balón de Oro
  Neymar|LW|93|br|barcelona|2014-15|Barcelona '15|CAM|Triplete
  Suárez|ST|92|uy|liverpool|2013-14|Liverpool '14|CF|Bota de Oro
  Salah|RW|92|eg|liverpool|2017-18|Liverpool '18|ST|Récord de goles
  Mbappé|ST|88|fr|monaco|2016-17|Monaco '17|LW|Campeón de Ligue 1
  Haaland|ST|89|no|dortmund|2020-21|Dortmund '21|
  Kane|ST|91|gb-eng|tottenham|2017-18|Tottenham '18||Récord de goles
  De Bruyne|CAM|90|be|wolfsburg|2014-15|Wolfsburg '15|CM|Mejor jugador de la Bundesliga
  Lewandowski|ST|94|pl|bayern|2019-20|Bayern '20||Triplete
  Benzema|ST|93|fr|real-madrid|2021-22|Real Madrid '22|CF|Balón de Oro
  Griezmann|ST|91|fr|atletico|2015-16|Atlético '16|CF,LW
  Modrić|CM|93|hr|real-madrid|2017-18|Real Madrid '18|CAM|Balón de Oro
`;

const WORLD_CUP_2010 = `
  Forlán|ST|91|uy|atletico|2010|Uruguay '10|CF|Mejor jugador del Mundial
  Sneijder|CAM|91|nl|inter|2010|Países Bajos '10|CM|Subcampeones del mundo
  Robben|RW|91|nl|bayern|2010|Países Bajos '10|RM|Subcampeones del mundo
  Villa|ST|91|es|valencia|2010|España '10|LW|Campeones del mundo
  Xabi Alonso|CDM|89|es|real-madrid|2010|España '10|CM|Campeones del mundo
  Sergio Ramos|RB|88|es|real-madrid|2010|España '10|CB|Campeones del mundo
  Piqué|CB|89|es|barcelona|2010|España '10||Campeones del mundo
  T. Müller|RW|88|de|bayern|2010|Alemania '10|CAM,ST|Bota de Oro del Mundial
  Özil|CAM|88|de|bremen|2010|Alemania '10|CM|Mejor joven del Mundial
  Schweinsteiger|CM|90|de|bayern|2010|Alemania '10|CDM
  Klose|ST|89|de|bayern|2010|Alemania '10||Tercer puesto
  Suárez|ST|86|uy|ajax|2010|Uruguay '10||Cuarto puesto
`;

/**
 * HISTÓRICOS: futbolistas retirados que, sin ser Iconos, firmaron etapas o
 * momentos memorables (temporadas récord, títulos inesperados, grandes torneos).
 * Comparten categoría con los Iconos (carta "HISTÓRICO", ribete bronce).
 */
const HEROES = `
  Sturridge|ST|88|gb-eng|liverpool|2013-14|Liverpool '14|CF|21 goles en la Premier
  Michu|CAM|86|es|swansea|2012-13|Swansea '13|ST|Revelación de la Premier
  Yaya Touré|CM|90|ci|man-city|2013-14|Man City '14|CDM,CAM|20 goles de liga
  Kompany|CB|89|be|man-city|2011-12|Man City '12||Campeón de liga
  Wes Morgan|CB|84|jm|leicester|2015-16|Leicester '16||El milagro del Leicester
  Huth|CB|84|de|leicester|2015-16|Leicester '16||El milagro del Leicester
  Drinkwater|CM|85|gb-eng|leicester|2015-16|Leicester '16|CDM|El milagro del Leicester
  Hazard|LW|92|be|chelsea|2014-15|Chelsea '15|CAM|Mejor jugador de la Premier
  Hazard|LW|86|be|lille|2010-11|Lille '11|RW|Doblete en Francia
  Bale|RW|90|gb-wls|tottenham|2012-13|Tottenham '13|LW,CAM|Mejor jugador de la Premier
  Berbatov|ST|87|bg|man-utd|2010-11|Man Utd '11|CF|Máximo goleador de la Premier
  Tevez|ST|88|ar|juventus|2014-15|Juventus '15|CF|Scudetto
  Diego Milito|ST|90|ar|inter|2009-10|Inter '10||Triplete
  Sneijder|CAM|90|nl|inter|2009-10|Inter '10|CM|Triplete
  Luca Toni|ST|89|it|fiorentina|2005-06|Fiorentina '06||Bota de Oro
  Di Natale|ST|88|it|udinese|2009-10|Udinese '10|CF|Capocannoniere
  Hamšík|CAM|87|sk|napoli|2012-13|Napoli '13|CM
  Lavezzi|LW|85|ar|napoli|2010-11|Napoli '11|ST
  Grafite|ST|88|br|wolfsburg|2008-09|Wolfsburg '09||Campeón y máximo goleador
  Ailton|ST|88|br|bremen|2003-04|Werder '04||Doblete y máximo goleador
  Ribéry|LW|91|fr|bayern|2012-13|Bayern '13|LM|Triplete
  Robben|RW|91|nl|bayern|2012-13|Bayern '13|RM|Gol en la final europea
  Ballack|CM|89|de|leverkusen|2001-02|Leverkusen '02|CAM
  Mario Gómez|ST|86|de|stuttgart|2008-09|Stuttgart '09
  Juninho|CM|89|br|lyon|2005-06|Lyon '06|CAM|Rey del tiro libre
  Gourcuff|CAM|87|fr|bordeaux|2008-09|Bordeaux '09||Mejor jugador de la Ligue 1
  Pauleta|ST|86|pt|psg|2002-03|PSG '03||Mejor jugador de la Ligue 1
  Forlán|ST|88|uy|villarreal|2004-05|Villarreal '05||Bota de Oro
  Makaay|ST|87|nl|deportivo|2002-03|Deportivo '03||Bota de Oro
  Diego Tristán|ST|86|es|deportivo|2001-02|Deportivo '02||Pichichi
  Mendieta|CM|88|es|valencia|1999-00|Valencia '00|RM|Finalista europeo
  Aimar|CAM|88|ar|valencia|2001-02|Valencia '02|CM|Campeón de liga
  Riquelme|CAM|89|ar|villarreal|2005-06|Villarreal '06|CM|Semifinalista europeo
  Joaquín|RM|85|es|betis|2004-05|Betis '05|RW|Campeón de Copa
  Fernando Torres|ST|90|es|liverpool|2007-08|Liverpool '08||24 goles en la Premier
  Cazorla|CM|86|es|villarreal|2007-08|Villarreal '08|CAM|Subcampeón de liga
  Pires|LM|88|fr|arsenal|2001-02|Arsenal '02|CAM|Mejor jugador de Inglaterra
  Özil|CAM|89|de|arsenal|2015-16|Arsenal '16|CM|19 asistencias
  Arshavin|CAM|87|ru|arsenal|2008-09|Arsenal '09|LW|Póker en Anfield
  Rooney|ST|91|gb-eng|man-utd|2009-10|Man Utd '10|CF|Mejor jugador de la Premier
  Park Ji-sung|CM|84|kr|man-utd|2010-11|Man Utd '11|RM
  Nakata|CAM|85|jp|roma|2000-01|Roma '01|CM|Scudetto
  Gattuso|CDM|88|it|milan|2006-07|Milan '07|CM|Campeón de Europa
  Materazzi|CB|86|it|inter|2006|Italia '06||Campeones del mundo
  Grosso|LB|85|it|inter|2006|Italia '06|LWB|Campeones del mundo
  Hasan Şaş|LW|85|tr|galatasaray|2002|Turquía '02|ST|Tercer puesto mundial
  Rüştü|GK|86|tr|fenerbahce|2002|Turquía '02||Tercer puesto mundial
  El Hadji Diouf|ST|84|sn|lens|2002|Senegal '02|LW|Cuartos de final
  Mandžukić|ST|87|hr|juventus|2018|Croacia '18||Subcampeones del mundo
  Varane|CB|88|fr|real-madrid|2018|Francia '18||Campeones del mundo
`;

/** Retirados que ya existen en otras colecciones (Equipo del Año, Mundial 2010…). */
const RETIRED = [
  'Dani Alves', 'Marcelo', 'Van Persie', 'Ibrahimović', 'Bonucci', 'Kroos', 'Hazard', 'Forlán', 'Sneijder', 'Robben',
  'Villa', 'Xabi Alonso', 'Piqué', 'Özil', 'Schweinsteiger', 'Čech', 'Cahill', 'Hummels', 'Mascherano', 'Marchena',
  'Senna', 'Ballack', 'Arshavin', 'Charisteas', 'Dellas', 'Zagorakis', 'Nikopolidis', 'Seitaridis', 'Ricardo Carvalho',
  'Ashley Cole', 'Maniche', 'Baroš', 'Nedvěd', 'Fernando Torres', 'Rooney', 'Kompany', 'Yaya Touré', 'Sturridge',
];

/** Identidades (slug del nombre) de los futbolistas Históricos. */
export const HERO_NAMES = new Set([
  ...HEROES.split('\n').map((l) => l.trim().split('|')[0]).filter(Boolean),
  ...RETIRED,
].map((n) => slug(n)));

const ICON_NAMES = new Set(
  ICONS.split('\n')
    .map((l) => l.trim().split('|')[0])
    .filter(Boolean)
    .map((n) => slug(n)),
);

export function historyCatalog(players: Player[], existing: PlayerVersion[] = []): { players: Player[]; versions: PlayerVersion[] } {
  const all = [...players];
  const byKey = new Map(players.map((p) => [`${slug(p.knownAs)}|${p.nationCode}`, p]));
  const ids = new Set(players.map((p) => p.id));
  const versions: PlayerVersion[] = [];
  const vids = new Set<string>(existing.map((v) => v.id));
  for (const block of [ICONS, SEASONS, WORLD_CUP_2010, HEROES]) {
    for (const raw of block.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const [name, pos, rating, nation, clubId, season, label, alts, milestone] = line.split('|').map((x) => x.trim());
      const key = `${slug(name)}|${nation}`;
      let p = byKey.get(key);
      const icon = ICON_NAMES.has(slug(name));
      if (!p) {
        let id = slug(name);
        if (ids.has(id)) id = `${id}-${nation}`;
        p = { id, knownAs: name, fullName: name, nationCode: nation, birthYear: 0, icon };
        ids.add(id);
        all.push(p);
        byKey.set(key, p);
      }
      const year = seasonToYear(season);
      let vid = `${p.id}-${String(year).slice(-2)}`;
      if (vids.has(vid)) vid = `${vid}-${slug(clubId)}`;
      vids.add(vid);
      const position = pos as Position;
      versions.push({
        id: vid,
        playerId: p.id,
        label,
        season,
        year,
        clubId,
        nationCode: nation,
        position,
        altPositions: (alts ? alts.split(',').filter(Boolean) : []) as Position[],
        rating: Number(rating),
        stats: deriveStats(`${name}|${season}`, position, Number(rating)),
        shirtNumber: { GK: 1, RB: 2, CB: 4, LB: 3, CDM: 6, CM: 8, CAM: 10, RM: 7, LM: 11, RW: 7, LW: 11, CF: 9, ST: 9 }[position as string] ?? 14,
        milestone: milestone || undefined,
      });
    }
  }
  return { players: all, versions };
}
