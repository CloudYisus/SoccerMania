import { squad } from './build';

const L = 'eng-premier';
const N = 'gb-eng';

/** Premier League 2025-26 (datos de demostración; ver build.ts). */
export const ENG = [
  squad('arsenal', 'Arsenal FC', 'ARSENAL', L, N, ['#ef0107', '#f5f5f5'], { style: 'possession', formation: '4-3-3' }, `
    Raya|GK|86|es
    J. Timber|RB|84|nl|CB
    Calafiori|LB|81|it|CB
    Mosquera|CB|79|es
    Zubimendi|CDM|86|es|CM
    Merino|CM|83|es|ST
    Eze|CAM|84|gb-eng|LW
    Martinelli|LW|82|br
    Madueke|RW|80|gb-eng
    Trossard|LW|81|be|ST
    Gyökeres|ST|86|se
    Havertz|ST|82|de|CAM
    Lewis-Skelly|LB|77|gb-eng|CM
  `),
  squad('aston-villa', 'Aston Villa', 'ASTON VILLA', L, N, ['#670e36', '#95bfe5'], { style: 'balanced', formation: '4-2-3-1', api: 66 }, `
    E. Martínez|GK|85|ar
    Cash|RB|78|pl
    Konsa|CB|81|gb-eng
    Pau Torres|CB|81|es
    Digne|LB|78|fr
    Kamara|CDM|81|fr
    Tielemans|CM|82|be
    McGinn|CM|80|gb-sct
    Rogers|CAM|82|gb-eng|LW
    Bailey|RW|78|jm
    Watkins|ST|83|gb-eng
    Malen|ST|79|nl|RW
  `),
  squad('bournemouth', 'AFC Bournemouth', 'BOURNEMOUTH', L, N, ['#da291c', '#111111'], { style: 'highpress', formation: '4-2-3-1', api: 35 }, `
    Petrović|GK|78|rs
    J. Araujo|RB|75|mx
    Senesi|CB|78|ar
    Diakité|CB|74|fr
    Truffert|LB|75|fr
    Adams|CDM|76|us
    Scott|CM|77|gb-eng
    Kluivert|CAM|79|nl|LW
    Semenyo|RW|81|gh|LW
    Tavernier|LM|76|gb-eng
    Evanilson|ST|78|br
  `),
  squad('brentford', 'Brentford FC', 'BRENTFORD', L, N, ['#e30613', '#f5f5f5'], { style: 'direct', formation: '4-3-3', api: 55 }, `
    Kelleher|GK|79|ie
    Kayode|RB|74|it
    Collins|CB|76|ie
    Van den Berg|CB|75|nl
    Henry|LB|74|gb-eng
    Jensen|CM|76|dk
    Yarmoliuk|CM|74|ua
    Damsgaard|CAM|77|dk
    Schade|LW|76|de
    Ouattara|RW|74|bf
    Thiago|ST|78|br
  `),
  squad('brighton', 'Brighton & Hove Albion', 'BRIGHTON', L, N, ['#0057b8', '#f5f5f5'], { style: 'possession', formation: '4-2-3-1', api: 51 }, `
    Verbruggen|GK|79|nl
    Veltman|RB|75|nl
    Van Hecke|CB|78|nl
    Dunk|CB|77|gb-eng
    De Cuyper|LB|76|be
    Baleba|CDM|79|cm
    Ayari|CM|76|se
    D. Gómez|CAM|75|py
    Minteh|RW|77|gm
    Mitoma|LW|80|jp
    Welbeck|ST|76|gb-eng
    Rutter|ST|76|fr|CAM
  `),
  squad('burnley', 'Burnley FC', 'BURNLEY', L, N, ['#6c1d45', '#99d6ea'], { style: 'counter', formation: '4-2-3-1', api: 44 }, `
    Dúbravka|GK|76|sk
    Walker|RB|79|gb-eng
    Estève|CB|73|fr
    Tuanzebe|CB|72|cd
    Hartman|LB|72|nl
    Cullen|CDM|73|ie
    Ugochukwu|CM|74|fr
    Hannibal|CAM|72|tn
    Anthony|LW|73|gb-eng
    Edwards|RW|71|gb-eng
    Foster|ST|72|gb-eng
  `),
  squad('chelsea', 'Chelsea FC', 'CHELSEA', L, N, ['#034694', '#f5f5f5'], { style: 'possession', formation: '4-2-3-1', api: 49 }, `
    Sánchez|GK|79|es
    R. James|RB|83|gb-eng
    Colwill|CB|80|gb-eng
    Chalobah|CB|79|gb-eng
    W. Fofana|CB|78|fr
    Cucurella|LB|82|es
    Caicedo|CDM|86|ec
    Enzo Fernández|CM|84|ar
    Palmer|CAM|87|gb-eng|RW
    Neto|RW|81|pt|LW
    Estêvão|RW|79|br
    Garnacho|LW|79|ar
    João Pedro|ST|81|br|CAM
    Delap|ST|77|gb-eng
  `),
  squad('crystal-palace', 'Crystal Palace', 'CRYSTAL PALACE', L, N, ['#1b458f', '#c4122e'], { style: 'counter', formation: '3-5-2', api: 52 }, `
    Henderson|GK|80|gb-eng
    Muñoz|RWB|80|co|RB
    Lacroix|CB|79|fr
    Richards|CB|76|us
    Guéhi|CB|82|gb-eng
    Mitchell|LWB|76|gb-eng|LB
    Wharton|CM|79|gb-eng
    Lerma|CDM|77|co
    Kamada|CAM|77|jp
    I. Sarr|RW|79|sn|ST
    Mateta|ST|80|fr
  `),
  squad('everton', 'Everton FC', 'EVERTON', L, N, ['#003399', '#f5f5f5'], { style: 'direct', formation: '4-2-3-1', api: 45 }, `
    Pickford|GK|83|gb-eng
    O'Brien|RB|73|ie
    Tarkowski|CB|79|gb-eng
    Branthwaite|CB|78|gb-eng
    Mykolenko|LB|76|ua
    Gueye|CDM|77|sn
    Garner|CM|76|gb-eng
    Dewsbury-Hall|CM|76|gb-eng
    Grealish|CAM|80|gb-eng|LW
    I. Ndiaye|LW|79|sn
    Barry|ST|75|gb-eng
    Beto|ST|74|pt
  `),
  squad('fulham', 'Fulham FC', 'FULHAM', L, N, ['#f5f5f5', '#111111'], { style: 'possession', formation: '4-2-3-1', api: 36 }, `
    Leno|GK|81|de
    Tete|RB|76|br
    Andersen|CB|78|dk
    Bassey|CB|75|ng
    Robinson|LB|77|us
    Berge|CDM|76|no
    Lukić|CM|76|rs
    King|CAM|75|gb-eng
    Iwobi|RW|77|ng
    Smith Rowe|LW|76|gb-eng
    Jiménez|ST|76|mx
  `),
  squad('leeds', 'Leeds United', 'LEEDS', L, N, ['#f5f5f5', '#1d428a'], { style: 'highpress', formation: '4-2-3-1', api: 63 }, `
    Perri|GK|75|br
    Bogle|RB|73|gb-eng
    Rodon|CB|74|gb-wls
    Bijol|CB|75|si
    G. Gudmundsson|LB|73|is
    Ampadu|CDM|75|gb-wls
    Stach|CM|75|de
    Aaronson|CAM|73|us
    D. James|RW|74|gb-wls
    Gnonto|LW|74|it
    Calvert-Lewin|ST|74|gb-eng
    Nmecha|ST|73|de
  `),
  squad('liverpool', 'Liverpool FC', 'LIVERPOOL', L, N, ['#c8102e', '#f6eb61'], { style: 'highpress', formation: '4-2-3-1' }, `
    Frimpong|RB|83|nl|RWB
    Konaté|CB|84|fr
    Kerkez|LB|80|hu
    Gravenberch|CM|85|nl|CDM
    Szoboszlai|CM|84|hu|CAM
    Jones|CM|79|gb-eng
    Gakpo|LW|83|nl
    Ekitiké|ST|82|fr
    Isak|ST|87|se
    Chiesa|RW|76|it
    Bradley|RB|77|gb-nir
  `),
  squad('man-city', 'Manchester City', 'MAN CITY', L, N, ['#6cabdd', '#1c2c5b'], { style: 'possession', formation: '4-3-3' }, `
    Lewis|RB|79|gb-eng|CM
    Aït-Nouri|LB|81|dz
    Stones|CB|82|gb-eng
    Aké|CB|80|nl
    Reijnders|CM|84|nl
    Nico González|CDM|79|es
    Kovačić|CM|81|hr
    Cherki|CAM|80|fr
    Doku|LW|82|be
    Savinho|RW|80|br
    Marmoush|ST|82|eg
    Trafford|GK|77|gb-eng
  `),
  squad('man-utd', 'Manchester United', 'MAN UTD', L, N, ['#da291c', '#111111'], { style: 'direct', formation: '3-5-2' }, `
    Lammens|GK|76|be
    Onana|GK|78|cm
    Mazraoui|RWB|78|ma|RB
    De Ligt|CB|80|nl
    Maguire|CB|77|gb-eng
    Yoro|CB|77|fr
    Li. Martínez|CB|81|ar
    Dalot|LWB|78|pt|RB
    Shaw|LB|77|gb-eng
    Casemiro|CDM|79|br
    Mainoo|CM|78|gb-eng
    Ugarte|CDM|77|uy
    Mbeumo|RW|83|cm|ST
    Cunha|CAM|82|br|ST
    Mount|CAM|76|gb-eng
    Šeško|ST|80|si
    Amad|RW|79|ci
  `),
  squad('newcastle', 'Newcastle United', 'NEWCASTLE', L, N, ['#241f20', '#f5f5f5'], { style: 'highpress', formation: '4-3-3', api: 34 }, `
    Pope|GK|81|gb-eng
    Trippier|RB|79|gb-eng
    Schär|CB|79|ch
    Botman|CB|79|nl
    Thiaw|CB|78|de
    Hall|LB|78|gb-eng
    Tonali|CDM|84|it
    Guimarães|CM|86|br
    Joelinton|CM|81|br
    Elanga|RW|79|se
    Gordon|LW|83|gb-eng
    Woltemade|ST|79|de
    Wissa|ST|78|cd
  `),
  squad('nottingham', 'Nottingham Forest', 'NOTT. FOREST', L, N, ['#dd0000', '#f5f5f5'], { style: 'counter', formation: '4-2-3-1', api: 65 }, `
    Sels|GK|80|be
    Aina|RB|76|ng
    Milenković|CB|81|rs
    Murillo|CB|81|br
    Williams|LB|74|gb-eng
    Anderson|CM|81|gb-eng
    Sangaré|CDM|77|ml
    Gibbs-White|CAM|82|gb-eng
    Hudson-Odoi|LW|78|gb-eng
    Ndoye|RW|78|ch
    Wood|ST|80|nz
  `),
  squad('sunderland', 'Sunderland AFC', 'SUNDERLAND', L, N, ['#eb172b', '#f5f5f5'], { style: 'counter', formation: '4-2-3-1', api: 746 }, `
    Roefs|GK|74|nl
    Hume|RB|72|gb-nir
    Mukiele|CB|75|fr
    Ballard|CB|72|gb-nir
    Reinildo|LB|74|mz
    Xhaka|CDM|81|ch
    Sadiki|CM|74|cd
    Le Fée|CAM|76|fr
    Talbi|RW|74|ma
    Adingra|LW|74|ci
    Isidor|ST|73|fr
  `),
  squad('tottenham', 'Tottenham Hotspur', 'TOTTENHAM', L, N, ['#f5f5f5', '#132257'], { style: 'highpress', formation: '4-3-3', api: 47 }, `
    Vicario|GK|81|it
    Porro|RB|81|es
    C. Romero|CB|83|ar
    Van de Ven|CB|83|nl
    Udogie|LB|78|it
    Palhinha|CDM|81|pt
    Bentancur|CM|78|uy
    Bergvall|CM|76|se
    Simons|CAM|82|nl
    Kudus|RW|81|gh
    Johnson|LW|78|gb-wls
    Richarlison|ST|77|br
    Solanke|ST|78|gb-eng
  `),
  squad('west-ham', 'West Ham United', 'WEST HAM', L, N, ['#7a263a', '#1bb1e7'], { style: 'direct', formation: '4-2-3-1' }, `
    Areola|GK|78|fr
    Wan-Bissaka|RB|78|gb-eng
    Kilman|CB|77|gb-eng
    Todibo|CB|77|fr
    Diouf|LB|74|sn
    Soucek|CDM|77|cz
    Ward-Prowse|CM|76|gb-eng
    Paquetá|CAM|81|br
    Bowen|RW|81|gb-eng
    Summerville|LW|76|nl
    Füllkrug|ST|76|de
  `),
  squad('wolves', 'Wolverhampton Wanderers', 'WOLVES', L, N, ['#fdb913', '#231f20'], { style: 'counter', formation: '3-5-2', api: 39 }, `
    José Sá|GK|78|pt
    Doherty|RWB|73|ie
    Agbadou|CB|75|ci
    Mosquera|CB|74|co
    Toti|CB|74|pt
    Hoever|LWB|71|nl
    André|CDM|77|br
    J. Gomes|CM|77|br
    Bellegarde|CAM|74|fr
    Hwang|CF|75|kr
    Strand Larsen|ST|76|no
  `),
];
