import { squad } from './build';

const L = 'fra-ligue-1';
const N = 'fr';

/** Ligue 1 2025-26 (datos de demostración; ver build.ts). */
export const FRA = [
  squad('angers', 'Angers SCO', 'ANGERS', L, N, ['#111111', '#f5f5f5'], { style: 'counter', formation: '3-5-2', api: 77 }, `
    Koffi|GK|73|bf
    Allevinah|RW|70|fr
    Lefort|CB|71|fr
    Arcus|RWB|70|fr
    Aholou|CM|72|ci
    Belkhdim|CM|71|fr
    Capelle|LWB|71|fr
    Sima|ST|73|sn
    Louiserre|CDM|71|fr
    Raolisoa|CAM|71|fr
    Biumla|CB|70|fr
  `),
  squad('auxerre', 'AJ Auxerre', 'AUXERRE', L, N, ['#f5f5f5', '#0050a0'], { style: 'counter', formation: '3-5-2', api: 108 }, `
    Léon|GK|74|fr
    Siwe|CB|71|ci
    Osho|CB|72|ng
    Akpa|CB|71|ci
    Mensah|LWB|72|gh
    Danois|CM|73|fr
    Sinayoko|ST|74|ml
    Owusu|CM|72|gh
    Mara|ST|72|fr
    Oppegård|LWB|70|no
    Casimir|RW|71|fr
  `),
  squad('brest', 'Stade Brestois', 'BREST', L, N, ['#e2001a', '#f5f5f5'], { style: 'balanced', formation: '4-3-3', api: 106 }, `
    Coudert|GK|74|fr
    Lala|RB|74|fr
    Chardonnet|CB|74|fr
    Le Cardinal|CB|73|fr
    Locko|LB|72|fr
    Magnetti|CDM|74|fr
    M. Camara|CM|74|fr
    Lees-Melou|CM|74|fr
    Doumbia|LW|75|ml
    Del Castillo|RW|76|fr
    Ajorque|ST|75|fr
  `),
  squad('le-havre', 'Le Havre AC', 'LE HAVRE', L, N, ['#1a3d74', '#87ceeb'], { style: 'counter', formation: '4-2-3-1', api: 111 }, `
    Diaw|GK|72|sn
    Kechta|LW|73|fr
    Sangante|CB|72|sn
    G. Lloris|CB|72|fr
    Zouaoui|LB|70|dz
    R. Ndiaye|CM|72|sn
    A. Touré|CDM|71|fr
    Soumaré|CM|72|fr
    Nego|RB|71|hu
    Soumaoro|ST|71|fr
    Sabbi|RW|71|fr
  `),
  squad('lens', 'RC Lens', 'LENS', L, N, ['#fde100', '#e2001a'], { style: 'highpress', formation: '3-5-2', api: 116 }, `
    Risser|GK|76|fr
    Gradit|CB|76|fr
    M. Sarr|CB|74|sn
    Baidoo|CB|73|gh
    Aguilar|RWB|74|fr
    Udol|LWB|73|fr
    Thomasson|CM|77|fr
    Sangaré|CDM|75|ci
    Sotoca|CF|75|fr
    Edouard|ST|75|fr
    Saïd|ST|74|fr
  `),
  squad('lille', 'LOSC Lille', 'LILLE', L, N, ['#e01e13', '#20325f'], { style: 'possession', formation: '4-2-3-1', api: 79 }, `
    Özer|GK|77|tr
    Meunier|RB|75|be
    Mandi|CB|75|dz
    Alexsandro|CB|77|br
    Perraud|LB|75|fr
    B. André|CDM|78|fr
    Bouaddi|CM|77|fr
    Haraldsson|CAM|77|is
    Sahraoui|RW|76|no
    Fernández-Pardo|LW|75|be
    Giroud|ST|75|fr
  `),
  squad('lorient', 'FC Lorient', 'LORIENT', L, N, ['#f37021', '#111111'], { style: 'counter', formation: '3-5-2', api: 97 }, `
    Mvogo|GK|73|ch
    Talbi|CB|72|tn
    Meïté|CB|71|ci
    Mendy|CB|71|sn
    Le Bris|RWB|71|fr
    Kouassi|LWB|70|ci
    Abergel|CM|73|fr
    Makengo|CM|72|fr
    Faivre|CAM|74|fr
    Tosin|ST|73|ng
    Bamba|ST|72|ci
  `),
  squad('lyon', 'Olympique Lyonnais', 'LYON', L, N, ['#f5f5f5', '#14387f'], { style: 'possession', formation: '4-2-3-1', api: 80 }, `
    Greif|GK|78|sk
    Maitland-Niles|RB|74|gb-eng
    Mata|CB|75|ao
    Niakhaté|CB|77|sn
    Abner|LB|74|br
    Tolisso|CM|77|fr
    Morton|CDM|75|gb-eng
    Tessmann|CM|75|us
    Merah|LW|73|fr
    M. Fofana|LW|75|be
    Šulc|CAM|76|cz
    Satriano|ST|74|uy
  `),
  squad('marseille', 'Olympique de Marseille', 'MARSEILLE', L, N, ['#2faee0', '#f5f5f5'], { style: 'highpress', formation: '4-2-3-1', api: 81 }, `
    Rulli|GK|81|ar
    Weah|RB|76|us
    Balerdi|CB|79|ar
    Aguerd|CB|78|ma
    Medina|LB|77|ar
    Højbjerg|CDM|79|dk
    Kondogbia|CDM|76|cf
    O'Riley|CM|78|dk
    Greenwood|RW|82|gb-eng
    Paixão|LW|76|br
    Gouiri|ST|79|dz
    Aubameyang|ST|78|ga
  `),
  squad('metz', 'FC Metz', 'METZ', L, N, ['#7d1d2d', '#f5f5f5'], { style: 'counter', formation: '4-2-3-1', api: 112 }, `
    Fischer|GK|72|ch
    Gbamin|CDM|71|ci
    Kouao|RB|70|ci
    Yegbe|CB|71|cm
    Colin|CB|70|fr
    Sabaly|LB|70|sn
    Stambouli|CM|71|fr
    Diallo|LW|72|sn
    Traoré|RW|71|fr
    Hein|CAM|71|ee
    Sané|ST|70|sn
  `),
  squad('monaco', 'AS Monaco', 'MONACO', L, N, ['#e7212c', '#f5f5f5'], { style: 'highpress', formation: '4-2-3-1', api: 91 }, `
    Köhn|GK|76|ch
    Vanderson|RB|79|br
    Dier|CB|76|gb-eng
    Kehrer|CB|76|de
    Henrique|LB|74|br
    Zakaria|CDM|78|ch
    L. Camara|CM|77|sn
    Golovin|CAM|79|ru
    Pogba|CM|76|fr
    Akliouche|RW|80|fr
    Minamino|LW|77|jp
    Ansu Fati|LW|75|es
    Balogun|ST|78|us
  `),
  squad('nantes', 'FC Nantes', 'NANTES', L, N, ['#ffe500', '#007a3d'], { style: 'counter', formation: '4-2-3-1', api: 83 }, `
    Lopes|GK|75|pt
    Guessand|RB|71|ci
    Awaziem|CB|72|ng
    Cozza|CB|71|fr
    Amian|LB|71|fr
    Leroux|CDM|72|fr
    Lepenant|CM|73|fr
    Abline|LW|75|fr
    Mohamed|RW|73|eg
    Kwon|LM|70|kr
    Coquelin|CDM|72|fr
  `),
  squad('nice', 'OGC Nice', 'NICE', L, N, ['#c4122e', '#111111'], { style: 'balanced', formation: '3-5-2', api: 84 }, `
    Bulka|GK|79|pl
    Clauss|RWB|76|fr
    Dante|CB|74|br
    Bombito|CB|76|ca
    Bard|LWB|76|dz
    Boudaoui|CM|75|dz
    Sanson|CM|74|fr
    Diop|CF|75|fr
    Moffi|ST|76|ng
    Laborde|ST|75|fr
    Cho|LW|73|fr
  `),
  squad('paris-fc', 'Paris FC', 'PARIS FC', L, N, ['#0b1d3f', '#e4b54d'], { style: 'balanced', formation: '4-3-3', api: 114 }, `
    Trapp|GK|76|de
    Kebbal|LW|75|dz
    Kolodziejczak|CB|72|fr
    Sakho|CB|71|fr
    Simon|RW|74|fr
    Marchetti|CM|72|fr
    Lopez|CM|72|fr
    Krasso|ST|73|ci
    Mbow|CB|71|sn
    Chergui|LB|70|fr
    Ikoné|RW|73|fr
  `),
  squad('psg', 'Paris Saint-Germain', 'PARIS SG', L, N, ['#004170', '#da291c'], { style: 'possession', formation: '4-3-3' }, `
    Chevalier|GK|81|fr
    Nuno Mendes|LB|86|pt
    Pacho|CB|83|ec
    Zabarnyi|CB|79|ua
    Zaïre-Emery|CM|80|fr
    João Neves|CM|85|pt
    Fabián Ruiz|CM|83|es
    Kvaratskhelia|LW|87|ge
    Doué|RW|84|fr
    Barcola|LW|82|fr
    Gonçalo Ramos|ST|79|pt
    Lee Kang-in|CAM|78|kr
  `),
  squad('strasbourg', 'RC Strasbourg', 'STRASBOURG', L, N, ['#0d5fa8', '#f5f5f5'], { style: 'possession', formation: '3-5-2', api: 95 }, `
    Penders|GK|75|be
    G. Doué|CB|74|ci
    Omobamidele|CB|72|ie
    Mamadou Sarr|CB|73|fr
    A. Ouattara|RWB|72|bf
    Doukouré|LWB|71|fr
    Barco|CM|76|ar
    Santos|CDM|74|br
    Panichelli|ST|75|ar
    Enciso|CAM|76|py
    Emegha|ST|74|nl
  `),
  squad('toulouse', 'Toulouse FC', 'TOULOUSE', L, N, ['#6b4c9a', '#f5f5f5'], { style: 'counter', formation: '3-5-2', api: 96 }, `
    Restes|GK|76|fr
    Nicolaisen|CB|73|dk
    Cresswell|CB|72|gb-eng
    McKenzie|CB|73|us
    Sidibé|RWB|72|ml
    Methalie|LWB|71|fr
    Sauer|CM|73|nl
    Casseres|CM|74|ve
    Gboho|CAM|74|ci
    Donnum|LW|73|no
    Magri|ST|73|fr
  `),
  squad('rennes', 'Stade Rennais', 'RENNES', L, N, ['#e13327', '#111111'], { style: 'balanced', formation: '4-2-3-1', api: 94 }, `
    Samba|GK|78|fr
    Assignon|RB|74|fr
    Jacquet|CB|75|fr
    Brassier|CB|74|fr
    Rongier|CM|75|fr
    Blas|CAM|76|fr
    Kader Meïté|ST|73|ci
    Al-Tamari|RW|75|jo
    Lepaul|ST|76|fr
    Seidu|CB|73|gh
    Merlin|LB|73|fr
  `),
];
