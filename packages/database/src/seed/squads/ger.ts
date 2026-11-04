import { squad } from './build';

const L = 'ger-bundesliga';
const N = 'de';

/** Bundesliga 2025-26 (datos de demostración; ver build.ts). */
export const GER = [
  squad('augsburg', 'FC Augsburg', 'AUGSBURG', L, N, ['#ba3733', '#46714d'], { style: 'counter', formation: '3-5-2', api: 170 }, `
    Dahmen|GK|76|de
    Gouweleeuw|CB|74|nl
    K. Schlotterbeck|CB|74|de
    Matsima|CB|74|fr
    Wolf|RWB|72|de
    Giannoulis|LWB|73|gr
    Rexhbeçaj|CM|74|xk
    Jakić|CDM|74|hr
    Claude-Maurice|CAM|75|fr
    Essende|ST|73|cd
    Kömür|LW|72|de
  `),
  squad('union-berlin', '1. FC Union Berlin', 'UNION BERLIN', L, N, ['#eb1923', '#ffd700'], { style: 'counter', formation: '3-5-2', api: 182 }, `
    Rønnow|GK|77|dk
    Doekhi|CB|76|nl
    Querfeld|CB|75|at
    Leite|CB|75|pt
    Trimmel|RWB|72|at
    Rothe|LWB|74|de
    Khedira|CDM|73|de
    Kemlein|CM|73|de
    Schäfer|CM|73|de
    A. Ilić|ST|74|rs
    Burke|ST|72|gb-sct
  `),
  squad('bremen', 'SV Werder Bremen', 'WERDER', L, N, ['#1d9053', '#f5f5f5'], { style: 'balanced', formation: '3-5-2', api: 162 }, `
    Backhaus|GK|76|de
    Pieper|CB|75|de
    Friedl|CB|76|at
    Stark|CB|74|de
    Sugawara|RWB|74|jp
    Deman|LWB|72|be
    Lynen|CDM|75|be
    Stage|CM|76|dk
    Grüll|LW|74|at
    Njinmah|ST|73|de
    Topp|ST|72|de
  `),
  squad('dortmund', 'Borussia Dortmund', 'DORTMUND', L, N, ['#fde100', '#111111'], { style: 'counter', formation: '3-5-2', api: 165 }, `
    Kobel|GK|86|ch
    Süle|CB|78|de
    Anton|CB|80|de
    N. Schlotterbeck|CB|82|de
    Ryerson|RWB|78|no
    Svensson|LWB|74|se
    Can|CDM|77|de
    Groß|CM|79|de
    Sabitzer|CM|78|at
    J. Bellingham|CM|76|gb-eng
    Brandt|CAM|80|de
    Adeyemi|LW|79|de
    Beier|ST|79|de
    Guirassy|ST|84|gn
  `),
  squad('frankfurt', 'Eintracht Frankfurt', 'FRANKFURT', L, N, ['#e1000f', '#111111'], { style: 'counter', formation: '4-2-3-1', api: 169 }, `
    Kaua Santos|GK|76|br
    R. Kristensen|RB|75|dk
    Koch|CB|78|de
    Theate|CB|77|be
    N. Brown|LB|75|gb-eng
    Larsson|CM|78|se
    Skhiri|CDM|77|tn
    Götze|CAM|76|de
    Knauff|RW|76|de
    Doan|RW|77|jp
    Burkardt|ST|77|de
    Batshuayi|ST|74|be
  `),
  squad('freiburg', 'SC Freiburg', 'FREIBURG', L, N, ['#e2001a', '#111111'], { style: 'balanced', formation: '4-2-3-1', api: 160 }, `
    Atubolu|GK|78|de
    Kübler|RB|75|de
    Ginter|CB|77|de
    Lienhart|CB|76|at
    Günter|LB|74|de
    Eggestein|CM|76|de
    Höfler|CDM|74|de
    Grifo|LW|77|it
    J. Suzuki|CAM|74|jp
    Beste|LM|75|de
    Höler|ST|72|de
  `),
  squad('hamburg', 'Hamburger SV', 'HAMBURG', L, N, ['#0a3f86', '#f5f5f5'], { style: 'balanced', formation: '4-2-3-1', api: 180 }, `
    Fernandes|GK|73|pt
    Capaldo|CB|73|ar
    Vušković|CB|74|hr
    Elfadli|CDM|72|ma
    Muheim|LB|72|ch
    Mikelbrencis|RB|71|fr
    Remberg|CM|72|no
    Vieira|CAM|75|pt
    Königsdörffer|ST|73|de
    Dompé|LW|73|fr
    Glatzel|ST|72|de
  `),
  squad('heidenheim', '1. FC Heidenheim', 'HEIDENHEIM', L, N, ['#e2001a', '#003a79'], { style: 'counter', formation: '4-2-3-1', api: null }, `
    Ramaj|GK|73|de
    Busch|RB|71|de
    Mainka|CB|72|de
    Gimber|CB|71|de
    Föhrenbach|LB|71|de
    Schöppner|CDM|72|de
    Dorsch|CM|72|de
    Beck|CAM|73|de
    Conteh|RW|72|de
    Schimmer|ST|72|de
    Zivzivadze|ST|71|ge
  `),
  squad('hoffenheim', 'TSG Hoffenheim', 'HOFFENHEIM', L, N, ['#1961b5', '#f5f5f5'], { style: 'highpress', formation: '4-2-3-1', api: 167 }, `
    Baumann|GK|78|de
    Kaderábek|RB|73|cz
    Hranáč|CB|75|cz
    Akpoguma|CB|73|ng
    Prass|LB|74|at
    Avdullahu|CDM|74|xk
    Burger|CM|75|ch
    Kramarić|CAM|78|hr
    Hlozek|ST|75|cz
    Asllani|LW|75|xk
    Lemperle|ST|73|de
  `),
  squad('koln', '1. FC Köln', 'KÖLN', L, N, ['#ed1c24', '#f5f5f5'], { style: 'highpress', formation: '4-2-3-1', api: 192 }, `
    Schwäbe|GK|74|de
    Sebulonsen|RB|72|no
    Hübers|CB|72|de
    Özkacar|CB|73|tr
    Lund|LB|73|us
    Martel|CDM|74|de
    Huseinbašić|CM|73|de
    Kainz|CAM|74|at
    Waldschmidt|RW|73|de
    Bülter|LW|72|de
    Ache|ST|72|de
  `),
  squad('leipzig', 'RB Leipzig', 'LEIPZIG', L, N, ['#dd0741', '#f5f5f5'], { style: 'highpress', formation: '4-2-3-1', api: 173 }, `
    Gulácsi|GK|79|hu
    Vandevoordt|GK|76|be
    Baku|RB|77|de
    Orbán|CB|80|hu
    Lukeba|CB|79|fr
    Raum|LB|78|de
    Seiwald|CDM|77|at
    Schlager|CM|78|at
    Baumgartner|CAM|79|at
    Nusa|LW|77|no
    Y. Diomande|RW|76|ci
    Rômulo|ST|74|br
    Harder|ST|74|dk
  `),
  squad('leverkusen', 'Bayer 04 Leverkusen', 'LEVERKUSEN', L, N, ['#e32221', '#111111'], { style: 'possession', formation: '3-5-2', api: 168 }, `
    Flekken|GK|80|nl
    Tapsoba|CB|80|bf
    Quansah|CB|77|gb-eng
    Badé|CB|76|fr
    Arthur|RWB|75|br
    Grimaldo|LWB|83|es
    Andrich|CDM|78|de
    García|CM|77|es
    M. Tillman|CAM|78|us
    Ben Seghir|LW|77|ma
    Hofmann|CAM|77|de
    Schick|ST|80|cz
    Kofane|ST|73|cm
  `),
  squad('mainz', '1. FSV Mainz 05', 'MAINZ', L, N, ['#c3141e', '#f5f5f5'], { style: 'highpress', formation: '3-5-2', api: 164 }, `
    Zentner|GK|77|de
    Kohr|CB|75|de
    Hanche-Olsen|CB|75|no
    Leitsch|CB|74|de
    Caci|RWB|74|fr
    Mwene|LWB|73|at
    Amiri|CM|76|de
    Sano|CDM|74|jp
    Nebel|CAM|76|de
    Lee|CAM|76|kr
    Weiper|ST|72|de
  `),
  squad('gladbach', 'Borussia Mönchengladbach', 'GLADBACH', L, N, ['#111111', '#f5f5f5'], { style: 'balanced', formation: '4-2-3-1', api: 163 }, `
    Omlin|GK|78|ch
    Scally|RB|74|us
    Elvedi|CB|77|ch
    Itakura|CB|77|jp
    Ullrich|LB|73|de
    Reitz|CDM|76|de
    Weigl|CM|76|de
    Stöger|CAM|76|at
    Hack|RW|74|de
    Honorat|LW|78|fr
    Tabaković|ST|75|ba
  `),
  squad('bayern', 'FC Bayern München', 'BAYERN', L, N, ['#dc052d', '#f5f5f5'], { style: 'possession', formation: '4-2-3-1' }, `
    Neuer|GK|86|de
    Laimer|RB|80|at|CDM
    Upamecano|CB|83|fr
    Tah|CB|84|de
    Kim Min-jae|CB|82|kr
    Ito|CB|78|jp|LB
    Goretzka|CM|81|de
    Pavlović|CDM|80|de
    Olise|RW|86|fr
    Gnabry|RW|80|de
    Luis Díaz|LW|85|co
    Jackson|ST|81|sn
    Karl|CAM|72|de
  `),
  squad('st-pauli', 'FC St. Pauli', 'ST. PAULI', L, N, ['#5b3a29', '#f5f5f5'], { style: 'counter', formation: '3-5-2', api: 186 }, `
    Vasilj|GK|76|ba
    Wahl|CB|73|de
    Smith|CB|73|gb-eng
    Mets|CB|72|ee
    Saliakas|RWB|72|gr
    Ritzka|LWB|71|de
    Irvine|CDM|74|au
    Sands|CM|72|us
    Fujita|CM|72|jp
    Sinani|CAM|73|lu
    Hountondji|ST|72|bj
  `),
  squad('stuttgart', 'VfB Stuttgart', 'STUTTGART', L, N, ['#f5f5f5', '#e32219'], { style: 'possession', formation: '4-2-3-1', api: 172 }, `
    Nübel|GK|80|de
    Vagnoman|RB|74|de
    Chabot|CB|76|de
    Jeltsch|CB|75|de
    Mittelstädt|LB|78|de
    Karazor|CDM|76|de
    Stiller|CM|79|de
    Leweling|LW|76|de
    Führich|LM|77|de
    El Khannouss|CAM|76|ma
    Demirović|ST|78|ba
    Undav|ST|78|de
  `),
  squad('wolfsburg', 'VfL Wolfsburg', 'WOLFSBURG', L, N, ['#65b32e', '#f5f5f5'], { style: 'balanced', formation: '4-2-3-1', api: 161 }, `
    Grabara|GK|78|pl
    Fischer|RB|73|dk
    Koulierakis|CB|75|gr
    Vavro|CB|74|sk
    Maehle|LB|74|dk
    Arnold|CDM|76|de
    Svanberg|CM|74|se
    Eriksen|CAM|77|dk
    Wimmer|RW|74|at
    Amoura|ST|78|dz
    Wind|ST|75|dk
  `),
];
