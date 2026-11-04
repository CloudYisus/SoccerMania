import { squad } from './build';

const L = 'ita-serie-a';
const N = 'it';

/** Serie A 2025-26 (datos de demostración; ver build.ts). */
export const ITA = [
  squad('atalanta', 'Atalanta BC', 'ATALANTA', L, N, ['#1e71b8', '#111111'], { style: 'highpress', formation: '3-5-2', api: 499 }, `
    Carnesecchi|GK|81|it
    Djimsiti|CB|77|al
    Hien|CB|79|se
    Kolašinac|CB|77|ba
    Bellanova|RWB|77|it
    Zappacosta|LWB|76|it
    Éderson|CM|82|br
    De Roon|CDM|78|nl
    De Ketelaere|CAM|81|be
    Lookman|LW|83|ng
    Scamacca|ST|79|it
    Krstović|ST|77|me
  `),
  squad('bologna', 'Bologna FC', 'BOLOGNA', L, N, ['#a21c26', '#1a2f48'], { style: 'possession', formation: '4-2-3-1', api: 500 }, `
    Skorupski|GK|79|pl
    Holm|RB|76|se
    Lucumí|CB|79|co
    Heggem|CB|74|no
    Miranda|LB|78|es
    Freuler|CDM|78|ch
    Ferguson|CM|79|gb-sct
    Odgaard|CAM|76|dk
    Orsolini|RW|81|it
    Bernardeschi|LW|76|it
    Castro|ST|79|ar
    Immobile|ST|76|it
  `),
  squad('cagliari', 'Cagliari Calcio', 'CAGLIARI', L, N, ['#a50f2d', '#002350'], { style: 'counter', formation: '4-3-3', api: 490 }, `
    Caprile|GK|76|it
    Zappa|RB|73|it
    Mina|CB|74|co
    Luperto|CB|73|it
    Obert|LB|72|sk
    Adopo|CM|74|fr
    Prati|CDM|73|it
    Deiola|CM|72|it
    Felici|LW|72|it
    Esposito|ST|75|it
    Borrelli|ST|73|it
  `),
  squad('como', 'Como 1907', 'COMO', L, N, ['#1f3e8f', '#f5f5f5'], { style: 'possession', formation: '4-2-3-1', api: 895 }, `
    Butez|GK|76|fr
    Smolčić|RB|74|hr
    Kempf|CB|76|de
    Ramón|CB|74|es
    Valle|LB|74|es
    Perrone|CDM|77|ar
    Da Cunha|CM|76|fr
    Nico Paz|CAM|82|ar
    Baturina|CAM|77|hr
    Kühn|RW|75|de
    Morata|ST|78|es
    Douvikas|ST|75|gr
  `),
  squad('cremonese', 'US Cremonese', 'CREMONESE', L, N, ['#d4001c', '#808080'], { style: 'counter', formation: '3-5-2', api: 520 }, `
    Audero|GK|74|it
    Terracciano|CB|71|it
    Baschirotto|CB|73|it
    Bianchetti|CB|71|it
    Barbieri|RWB|71|it
    Pezzella|LWB|72|it
    Vandeputte|CM|73|be
    Bondo|CDM|73|fr
    Zerbin|RW|71|it
    Vardy|ST|75|gb-eng
    Bonazzoli|ST|74|it
  `),
  squad('fiorentina', 'ACF Fiorentina', 'FIORENTINA', L, N, ['#4b2e83', '#f5f5f5'], { style: 'balanced', formation: '3-5-2', api: 502 }, `
    De Gea|GK|82|es
    Dodô|RWB|80|br
    Pongračić|CB|76|hr
    Comuzzo|CB|76|it
    Ranieri|CB|76|it
    Gosens|LWB|77|de
    Mandragora|CM|76|it
    Fagioli|CM|77|it
    Ndour|CM|74|it
    A. Gudmundsson|CF|79|is
    Kean|ST|81|it
    Džeko|ST|76|ba
  `),
  squad('genoa', 'Genoa CFC', 'GENOA', L, N, ['#a50021', '#002e5d'], { style: 'counter', formation: '4-2-3-1', api: 495 }, `
    Leali|GK|74|it
    Norton-Cuffy|RB|72|gb-eng
    Vásquez|CB|75|mx
    Østigård|CB|74|no
    A. Martín|LB|74|es
    Frendrup|CDM|76|dk
    Malinovskyi|CAM|76|ua
    Masini|CM|72|it
    Thorsby|CM|73|no
    Vitinha|LW|74|pt
    Colombo|ST|72|it
    Ekhator|ST|72|it
  `),
  squad('verona', 'Hellas Verona', 'VERONA', L, N, ['#00337f', '#ffd600'], { style: 'counter', formation: '3-5-2', api: 504 }, `
    Montipò|GK|75|it
    Nunez|CB|71|ar
    Bella-Kotchap|CB|72|de
    Valentini|CB|71|ar
    Belghali|RWB|72|ma
    Frese|LWB|71|dk
    Serdar|CM|73|tr
    Bernede|CM|72|fr
    Suslov|CAM|74|sk
    Giovane|ST|72|br
    Orban|ST|73|ng
  `),
  squad('inter', 'FC Internazionale', 'INTER', L, N, ['#0068a8', '#111111'], { style: 'balanced', formation: '3-5-2' }, `
    Sommer|GK|84|ch
    Pavard|CB|81|fr
    Acerbi|CB|80|it
    Bastoni|CB|85|it
    Akanji|CB|82|ch
    Dumfries|RWB|83|nl
    Çalhanoğlu|CDM|85|tr
    Mkhitaryan|CM|80|am
    P. Sučić|CM|77|hr
    Zieliński|CM|78|pl
    M. Thuram|ST|84|fr
    Bonny|ST|77|fr
    Pio Esposito|ST|74|it
  `),
  squad('juventus', 'Juventus FC', 'JUVENTUS', L, N, ['#f5f5f5', '#111111'], { style: 'possession', formation: '4-2-3-1' }, `
    Di Gregorio|GK|81|it
    Kalulu|RB|78|fr
    Gatti|CB|79|it
    Bremer|CB|84|br
    Kelly|CB|76|gb-eng
    Cambiaso|LB|81|it
    Locatelli|CDM|81|it
    K. Thuram|CM|80|fr
    Koopmeiners|CM|80|nl
    Yıldız|LW|83|tr|CAM
    Conceição|RW|80|pt
    Zhegrova|RW|79|xk
    Vlahović|ST|81|rs
    David|ST|82|ca
    Openda|ST|80|be
  `),
  squad('lazio', 'SS Lazio', 'LAZIO', L, N, ['#87d8f7', '#f5f5f5'], { style: 'balanced', formation: '4-3-3', api: 487 }, `
    Provedel|GK|80|it
    Marušić|RB|76|me
    Gila|CB|80|es
    Romagnoli|CB|78|it
    Tavares|LB|79|pt
    Guendouzi|CM|80|fr
    Rovella|CDM|79|it
    Dele-Bashiru|CM|74|ng
    Zaccagni|LW|80|it
    Isaksen|RW|77|dk
    Castellanos|ST|78|ar
    Pedro|RW|76|es
  `),
  squad('lecce', 'US Lecce', 'LECCE', L, N, ['#ffd700', '#d71920'], { style: 'counter', formation: '4-3-3', api: 867 }, `
    Falcone|GK|76|it
    Danilo Veiga|RB|72|pt
    Gaspar|CB|74|ao
    Tiago Gabriel|CB|72|pt
    Gallo|LB|73|it
    Ramadani|CDM|73|al
    Berisha|CM|73|al
    Coulibaly|CM|72|ml
    Pierotti|RW|72|ar
    Banda|LW|73|zm
    Camarda|ST|72|it
  `),
  squad('milan', 'AC Milan', 'MILAN', L, N, ['#fb090b', '#111111'], { style: 'counter', formation: '3-5-2' }, `
    Tomori|CB|79|gb-eng
    Gabbia|CB|78|it
    Pavlović|CB|78|rs
    De Winter|CB|77|be
    Saelemaekers|RWB|78|be
    Estupiñán|LWB|77|ec
    Modrić|CM|85|hr
    Rabiot|CM|81|fr
    Y. Fofana|CDM|79|fr
    Ricci|CDM|77|it
    Jashari|CM|76|ch
    Loftus-Cheek|CM|77|gb-eng
    Nkunku|CF|80|fr
  `),
  squad('napoli', 'SSC Napoli', 'NAPOLI', L, N, ['#12a0d7', '#f5f5f5'], { style: 'balanced', formation: '4-3-3' }, `
    V. Milinković-Savić|GK|80|rs
    Meret|GK|80|it
    Di Lorenzo|RB|81|it
    Rrahmani|CB|80|xk
    Buongiorno|CB|81|it
    Beukema|CB|78|nl
    Olivera|LB|78|uy
    Spinazzola|LB|76|it
    Lobotka|CDM|84|sk
    Anguissa|CM|82|cm
    McTominay|CM|85|gb-sct
    Politano|RW|79|it
    Neres|RW|78|br
    Lang|LW|78|nl
    Højlund|ST|79|dk
    Lukaku|ST|80|be
  `),
  squad('parma', 'Parma Calcio', 'PARMA', L, N, ['#ffe200', '#004a97'], { style: 'possession', formation: '3-5-2', api: 523 }, `
    Z. Suzuki|GK|76|jp
    Delprato|RWB|74|it
    Circati|CB|75|au
    Valenti|CB|73|ar
    A. Ndiaye|CB|72|sn
    Valeri|LWB|73|it
    Bernabé|CM|76|es
    Keita|CDM|74|be
    Sørensen|CM|72|dk
    Cutrone|ST|74|it
    Pellegrino|ST|74|ar
  `),
  squad('pisa', 'Pisa SC', 'PISA', L, N, ['#00205b', '#111111'], { style: 'counter', formation: '3-5-2', api: 801 }, `
    Šemper|GK|72|hr
    Canestrelli|CB|72|it
    Caracciolo|CB|71|it
    Calabresi|CB|70|it
    Touré|RWB|72|fr
    Angori|LWB|70|it
    Aebischer|CM|73|ch
    Marin|CM|72|ro
    Tramoni|CAM|73|fr
    Meister|ST|72|dk
    Nzola|ST|73|ao
  `),
  squad('roma', 'AS Roma', 'ROMA', L, N, ['#8e1f2f', '#f0bc42'], { style: 'highpress', formation: '3-5-2' }, `
    Svilar|GK|83|rs
    Mancini|CB|79|it
    N'Dicka|CB|79|ci
    Hermoso|CB|76|es
    Wesley|RWB|77|br
    Angeliño|LWB|78|es
    Koné|CM|80|fr
    Cristante|CDM|77|it
    Pellegrini|CAM|79|it
    Soulé|RW|79|ar
    Dybala|CF|81|ar
    Dovbyk|ST|78|ua
    Ferguson|ST|76|ie
  `),
  squad('sassuolo', 'US Sassuolo', 'SASSUOLO', L, N, ['#00a752', '#111111'], { style: 'balanced', formation: '4-3-3', api: 488 }, `
    Muric|GK|75|xk
    Toljan|RB|72|de
    Muharemović|CB|74|ba
    Idzes|CB|72|id
    Doig|LB|73|gb-sct
    Matić|CDM|75|rs
    Thorstvedt|CM|74|no
    I. Koné|CM|72|ca
    Berardi|RW|80|it
    Laurienté|LW|77|fr
    Pinamonti|ST|74|it
  `),
  squad('torino', 'Torino FC', 'TORINO', L, N, ['#8a1e03', '#f5f5f5'], { style: 'counter', formation: '3-5-2', api: 503 }, `
    Israel|GK|74|uy
    Pedersen|RWB|74|no
    Ismajli|CB|74|al
    Maripán|CB|75|cl
    Coco|CB|74|gq
    Lazaro|LWB|73|at
    I. Ilić|CM|75|rs
    Casadei|CM|74|it
    Vlašić|CAM|78|hr
    G. Simeone|ST|75|ar
    Zapata|ST|76|co
    Adams|ST|76|gb-sct
  `),
  squad('udinese', 'Udinese Calcio', 'UDINESE', L, N, ['#f5f5f5', '#111111'], { style: 'counter', formation: '3-5-2', api: 494 }, `
    Okoye|GK|75|ng
    T. Kristensen|CB|74|dk
    Kabasele|CB|73|be
    Solet|CB|76|fr
    Ehizibue|RWB|72|nl
    H. Kamara|LWB|73|ci
    Karlström|CDM|74|se
    Ekkelenkamp|CM|74|nl
    Atta|CAM|74|fr
    Zaniolo|RW|74|it
    Davis|ST|74|gb-eng
  `),
];
