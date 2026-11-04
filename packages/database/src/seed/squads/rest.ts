import { squad } from './build';

/** Ligas secundarias 2025-26 (datos de demostración; ver build.ts). */
export const REST = [
  // ── Arabia Saudí ───────────────────────────────────────
  squad('al-nassr', 'Al Nassr FC', 'AL NASSR', 'ksa-pro', 'sa', ['#fcd116', '#1f3f99'], { style: 'direct', formation: '4-2-3-1' }, `
    Bento|GK|78|br
    Iñigo Martínez|CB|79|es
    Simakan|CB|78|fr
    Al-Amri|CB|72|sa
    Sultan Al-Ghannam|RB|72|sa
    Brozović|CDM|80|hr
    Otávio|CM|78|pt
    João Félix|CAM|80|pt
    Coman|RW|80|fr
    Mané|LW|80|sn
  `),
  squad('al-hilal', 'Al Hilal SFC', 'AL HILAL', 'ksa-pro', 'sa', ['#1450a0', '#f5f5f5'], { style: 'possession', formation: '4-2-3-1' }, `
    Bounou|GK|82|ma
    Cancelo|RB|81|pt
    Koulibaly|CB|80|sn
    Ali Al-Bulayhi|CB|73|sa
    Theo|LB|83|fr
    Rúben Neves|CDM|81|pt
    S. Milinković-Savić|CM|82|rs
    Malcom|RW|80|br
    Salem Al-Dawsari|LW|78|sa
    Darwin Núñez|ST|80|uy
    Kanno|CM|74|sa
  `),
  squad('al-ittihad', 'Al Ittihad Club', 'AL ITTIHAD', 'ksa-pro', 'sa', ['#fde100', '#111111'], { style: 'counter', formation: '4-3-3', api: 2938 }, `
    Rajković|GK|78|rs
    Danilo Pereira|CB|77|pt
    Mitaj|LB|73|al
    Al-Shanqeeti|RB|71|sa
    Kanté|CDM|81|fr
    Fabinho|CDM|79|br
    Houssem Aouar|CM|77|dz
    Diaby|RW|80|fr
    Bergwijn|LW|78|nl
    Benzema|ST|83|fr
    Al-Mousa|CB|70|sa
  `),
  squad('al-ahli', 'Al Ahli Saudi', 'AL AHLI', 'ksa-pro', 'sa', ['#008346', '#f5f5f5'], { style: 'balanced', formation: '4-3-3', api: 2929 }, `
    É. Mendy|GK|80|sn
    Demiral|CB|80|tr
    Ibañez|CB|79|br
    Majrashi|LB|70|sa
    Kessié|CM|79|ci
    Galeno|LW|80|br
    Mahrez|RW|81|dz
    Toney|ST|81|gb-eng
    Enzo Millot|CAM|78|fr
    Al-Majhad|CDM|70|sa
    Abdulhamid|RB|72|sa
  `),
  // ── Estados Unidos ─────────────────────────────────────
  squad('inter-miami', 'Inter Miami CF', 'INTER MIAMI', 'usa-mls', 'us', ['#f7b5cd', '#231f20'], { style: 'possession', formation: '4-3-3' }, `
    Ustari|GK|72|ar
    Weigandt|RB|69|ar
    Falcón|CB|70|uy
    Jordi Alba|LB|78|es
    Busquets|CDM|80|es
    De Paul|CM|81|ar
    Segovia|CAM|73|uy
    Allende|LW|74|ar
    Suárez|ST|78|uy
    Avilés|CB|70|ar
  `),
  squad('la-galaxy', 'LA Galaxy', 'LA GALAXY', 'usa-mls', 'us', ['#00245d', '#ffd200'], { style: 'balanced', formation: '4-3-3', api: 1605 }, `
    Micović|GK|71|rs
    Yamane|RB|70|jp
    Garcés|CB|70|ar
    Aude|LB|68|us
    Fagúndez|CM|72|uy
    Delgado|CM|71|es
    Reus|CAM|75|de
    Paintsil|RW|74|gh
    Pec|LW|73|br
    Nascimento|ST|69|us
    Ramírez|ST|70|mx
  `),
  squad('lafc', 'Los Angeles FC', 'LAFC', 'usa-mls', 'us', ['#111111', '#c39e6d'], { style: 'counter', formation: '4-3-3', api: 1616 }, `
    H. Lloris|GK|79|fr
    Palencia|RB|70|es
    Long|CB|71|us
    Segura|CB|70|co
    Hollingshead|LB|70|us
    Delgado|CDM|71|us
    T. Tillman|CM|73|us
    Bouanga|LW|77|ga
    Son|ST|83|kr
    Ordaz|RW|69|ve
    Martínez|CB|70|mx
  `),
  // ── Portugal ───────────────────────────────────────────
  squad('benfica', 'S.L. Benfica', 'BENFICA', 'por-primeira', 'pt', ['#e83030', '#f5f5f5'], { style: 'possession', formation: '4-2-3-1' }, `
    Trubin|GK|80|ua
    Dedić|RB|75|ba
    António Silva|CB|79|pt
    Otamendi|CB|79|ar
    Dahl|LB|76|se
    Ríos|CDM|79|co
    Barreiro|CM|76|lu
    Aursnes|CM|77|no
    Di María|RW|80|ar
    Aktürkoğlu|LW|78|tr
    Pavlidis|ST|79|gr
    Sudakov|CAM|78|ua
  `),
  squad('porto', 'FC Porto', 'PORTO', 'por-primeira', 'pt', ['#0d4c92', '#f5f5f5'], { style: 'highpress', formation: '4-3-3', api: 212 }, `
    Diogo Costa|GK|84|pt
    Alberto Costa|RB|74|pt
    Bednarek|CB|76|pl
    Kiwior|CB|77|pl
    Francisco Moura|LB|74|pt
    Varela|CDM|77|ar
    Froholdt|CM|75|dk
    Mora|CAM|76|pt
    Pepê|RW|78|br
    Borja Sainz|LW|76|es
    Samu|ST|79|es
  `),
  squad('sporting', 'Sporting CP', 'SPORTING', 'por-primeira', 'pt', ['#008057', '#f5f5f5'], { style: 'possession', formation: '3-5-2', api: 228 }, `
    Rui Silva|GK|78|pt
    Quaresma|CB|76|pt
    O. Diomande|CB|80|ci
    Inácio|CB|79|pt
    Maxi Araújo|LWB|74|uy
    Fresneda|RWB|73|es
    Hjulmand|CDM|81|dk
    Morita|CM|79|jp
    Trincão|RW|81|pt
    Pedro Gonçalves|CAM|80|pt
    Suárez|ST|80|co
  `),
  // ── Países Bajos ──────────────────────────────────────
  squad('ajax', 'AFC Ajax', 'AJAX', 'ned-eredivisie', 'nl', ['#d2122e', '#f5f5f5'], { style: 'possession', formation: '4-3-3' }, `
    Jaros|GK|76|cz
    Gaaei|RB|75|fr
    Šutalo|CB|76|hr
    Baas|CB|74|nl
    Rosa|LB|72|br
    Klaassen|CM|76|nl
    Taylor|CM|78|nl
    Mokio|CDM|73|be
    Godts|LW|77|be
    Berghuis|RW|76|nl
    Weghorst|ST|75|nl
  `),
  squad('psv', 'PSV Eindhoven', 'PSV', 'ned-eredivisie', 'nl', ['#ed1c24', '#f5f5f5'], { style: 'highpress', formation: '4-2-3-1' }, `
    Kovář|GK|76|cz
    Mauro Júnior|RB|75|br
    Gasiorowski|CB|74|es
    Flamingo|CB|76|nl
    Dest|RB|77|us
    Schouten|CDM|78|nl
    Veerman|CM|79|nl
    Saibari|CAM|78|ma
    Til|CAM|77|nl
    Perišić|LW|76|hr
    Pepi|ST|75|us
  `),
  squad('feyenoord', 'Feyenoord', 'FEYENOORD', 'ned-eredivisie', 'nl', ['#e00000', '#f5f5f5'], { style: 'highpress', formation: '4-3-3', api: 209 }, `
    Wellenreuther|GK|75|de
    Read|RB|74|gb-eng
    Watanabe|CB|75|jp
    Smal|LB|73|nl
    Hwang In-beom|CM|78|kr
    Q. Timber|CM|76|nl
    Moder|CDM|75|pl
    Hadj Moussa|RW|77|dz
    Ueda|ST|76|jp
    Sauer|LW|74|sk
    Ivanušec|LW|74|hr
  `),
  // ── Turquía ────────────────────────────────────────────
  squad('galatasaray', 'Galatasaray SK', 'GALATASARAY', 'tur-super', 'tr', ['#a90432', '#fdb912'], { style: 'direct', formation: '4-2-3-1', api: 645 }, `
    Çakır|GK|79|tr
    Singo|RB|76|ci
    Sánchez|CB|77|co
    Bardakcı|CB|76|tr
    Jakobs|LB|74|de
    Torreira|CDM|79|uy
    Lemina|CM|77|ga
    Sara|CAM|78|br
    Sané|LW|80|de
    Barış Alper|RW|77|tr
    Osimhen|ST|85|ng
  `),
  squad('fenerbahce', 'Fenerbahçe SK', 'FENERBAHÇE', 'tur-super', 'tr', ['#163962', '#ffed00'], { style: 'balanced', formation: '4-2-3-1', api: 611 }, `
    Ederson Moraes|GK|83|br
    Semedo|RB|77|pt
    Skriniar|CB|79|sk
    Soyüncü|CB|75|tr
    A. Brown|LB|73|gb-eng
    E. Álvarez|CDM|78|mx
    Fred|CM|77|br
    Asensio|CAM|79|es
    Kerem Aktürkoğlu|LW|78|tr
    Nene|RW|74|pt
    En-Nesyri|ST|79|ma
  `),
  // ── México ─────────────────────────────────────────────
  squad('america', 'Club América', 'AMÉRICA', 'mex-ligamx', 'mx', ['#ffd700', '#002855'], { style: 'possession', formation: '4-2-3-1', api: 2287 }, `
    Malagón|GK|76|mx
    Fidalgo|CM|76|es
    Lichnovsky|CB|73|cl
    Ramón Juárez|CB|72|mx
    Kevin Álvarez|RB|73|mx
    Cáceres|LB|71|uy
    Dos Santos|CDM|74|mx
    Zendejas|RW|73|us
    Rodríguez|LW|72|mx
    Brian Rodríguez|LW|74|uy
    Raúl Zúñiga|ST|72|co
  `),
  squad('tigres', 'Tigres UANL', 'TIGRES', 'mex-ligamx', 'mx', ['#fdb913', '#004a8f'], { style: 'balanced', formation: '4-2-3-1', api: 2279 }, `
    Guzmán|GK|74|mx
    Garza|RB|72|mx
    Purata|CB|72|mx
    Angulo|LB|71|mx
    Gorriarán|CM|75|uy
    Vigón|CDM|73|mx
    Brunetta|CAM|75|ar
    Correa|RW|78|ar
    Ibáñez|LW|71|ar
    Gignac|ST|74|fr
    Lainez|RW|72|mx
  `),
  squad('monterrey', 'CF Monterrey', 'MONTERREY', 'mex-ligamx', 'mx', ['#002f6c', '#f5f5f5'], { style: 'possession', formation: '4-2-3-1', api: 2282 }, `
    Andrada|GK|75|ar
    Medina|RB|72|mx
    Sergio Ramos|CB|80|es
    Nájera|CB|71|mx
    Vegas|LB|70|mx
    L. Romo|CDM|71|mx
    Canales|CAM|77|es
    Corona|RW|75|mx
    Oliver Torres|CM|75|es
    Berterame|ST|75|mx
    Arteaga|LB|71|mx
  `),
  squad('chivas', 'C.D. Guadalajara', 'CHIVAS', 'mex-ligamx', 'mx', ['#cd1f2d', '#002b5c'], { style: 'highpress', formation: '4-3-3', api: 2278 }, `
    Rangel|GK|72|mx
    Mozo|RB|70|mx
    G. Sepúlveda|CB|71|mx
    Ledezma|CB|69|mx
    Castillo|LB|69|mx
    F. Romo|CM|71|mx
    González|CM|71|mx
    Alvarado|RW|72|mx
    Cade Cowell|LW|71|us
    Armando González|ST|72|mx
    Pulido|ST|72|mx
  `),
  squad('cruz-azul', 'Cruz Azul', 'CRUZ AZUL', 'mex-ligamx', 'mx', ['#00337f', '#f5f5f5'], { style: 'possession', formation: '4-2-3-1', api: 2295 }, `
    Mier|GK|74|mx
    Rotondi|RB|73|ar
    Piovi|CB|73|ar
    Ditta|CB|72|ar
    Rivero|LB|71|mx
    Lira|CDM|73|mx
    Romero|CM|73|ar
    Faravelli|CAM|73|ar
    Á. Sepúlveda|ST|72|mx
    Paradela|RW|73|ar
    Bogusz|ST|74|pl
  `),
  // ── Brasil y Argentina ─────────────────────────────────
  squad('flamengo', 'CR Flamengo', 'FLAMENGO', 'bra-serie-a', 'br', ['#c3281e', '#111111'], { style: 'possession', formation: '4-2-3-1', api: 127 }, `
    Rossi|GK|77|ar
    Varela|RB|74|uy
    Léo Ortiz|CB|76|br
    Léo Pereira|CB|75|br
    Alex Sandro|LB|74|br
    Pulgar|CDM|75|cl
    Jorginho|CM|78|it
    Arrascaeta|CAM|80|uy
    Luiz Araújo|RW|76|br
    Samuel Lino|LW|76|br
    Pedro|ST|78|br
    Plata|LW|77|ec
  `),
  squad('palmeiras', 'SE Palmeiras', 'PALMEIRAS', 'bra-serie-a', 'br', ['#006437', '#f5f5f5'], { style: 'counter', formation: '4-2-3-1', api: 121 }, `
    Weverton|GK|77|br
    Giay|RB|73|ar
    Gustavo Gómez|CB|78|py
    Murilo|CB|75|br
    Piquerez|LB|76|uy
    Aníbal Moreno|CDM|75|ar
    Andreas Pereira|CM|77|br
    Maurício|CAM|76|br
    Facundo Torres|RW|76|uy
    Vitor Roque|ST|77|br
    Flaco López|ST|76|ar
  `),
  squad('santos', 'Santos FC', 'SANTOS', 'bra-serie-a', 'br', ['#f5f5f5', '#111111'], { style: 'balanced', formation: '4-2-3-1' }, `
    Gabriel Brazão|GK|73|br
    Escobar|RB|69|ar
    Zé Ivaldo|CB|70|br
    Luan Peres|CB|70|br
    Souza|LB|70|br
    Zé Rafael|CDM|72|br
    Tomás Rincón|CM|70|ve
    Neymar|CAM|82|br
    Rollheiser|RW|72|ar
    Guilherme|LW|71|br
    Barreal|LW|72|ar
  `),
  squad('boca', 'Boca Juniors', 'BOCA', 'arg-primera', 'ar', ['#0b3b8c', '#f6c22b'], { style: 'direct', formation: '4-4-2' }, `
    Marchesín|GK|74|ar
    Advíncula|RB|73|pe
    Costa|CB|72|ar
    Di Lollo|CB|71|ar
    Blanco|LB|72|ar
    Paredes|CDM|78|ar
    Herrera|CM|73|uy
    Zenón|LM|72|ar
    Palacios|CAM|74|ar
    Cavani|ST|74|uy
    Merentiel|ST|74|uy
  `),
  squad('river', 'River Plate', 'RIVER', 'arg-primera', 'ar', ['#f5f5f5', '#d71920'], { style: 'possession', formation: '4-3-3', api: 435 }, `
    Armani|GK|74|ar
    Montiel|RB|74|ar
    Martínez Quarta|CB|76|ar
    Pezzella|CB|74|ar
    Acuña|LB|75|ar
    Enzo Pérez|CDM|73|ar
    Castaño|CM|74|co
    Galarza|CM|74|py
    Quintero|CAM|75|co
    Colidio|LW|74|ar
    Borja|ST|75|co
  `),
  // ── Escocia ────────────────────────────────────────────
  squad('celtic', 'Celtic FC', 'CELTIC', 'sco-prem', 'gb-sct', ['#018749', '#f5f5f5'], { style: 'possession', formation: '4-3-3', api: 247 }, `
    Schmeichel|GK|76|dk
    Johnston|RB|74|ca
    Carter-Vickers|CB|76|us
    Scales|CB|72|ie
    Tierney|LB|75|gb-sct
    McGregor|CM|77|gb-sct
    Engels|CM|75|be
    Hatate|CM|76|jp
    Maeda|LW|78|jp
    Idah|ST|73|ie
    Iheanacho|ST|73|ng
  `),
  squad('rangers', 'Rangers FC', 'RANGERS', 'sco-prem', 'gb-sct', ['#1b458f', '#f5f5f5'], { style: 'direct', formation: '4-2-3-1', api: 257 }, `
    Butland|GK|76|gb-eng
    J. Tavernier|RB|74|gb-eng
    Souttar|CB|73|au
    Sterling|LB|72|gb-eng
    Raskin|CDM|74|be
    Mo. Diomande|CM|74|ci
    Cerny|RW|76|cz
    Gassama|LW|72|fr
    Chermiti|ST|71|pt
    Dessers|ST|73|ng
    Bajrami|CAM|73|al
  `),
];
