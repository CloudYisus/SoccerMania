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
  for (const block of [ICONS, SEASONS, WORLD_CUP_2010]) {
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
