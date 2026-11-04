import { squad } from './build';

const L = 'esp-laliga';
const N = 'es';

/** LaLiga 2025-26 (datos de demostración; ver build.ts). */
export const ESP = [
  squad('alaves', 'Deportivo Alavés', 'ALAVÉS', L, N, ['#0761af', '#f5f5f5'], { style: 'counter', formation: '4-4-2', api: 542 }, `
    Sivera|GK|77|es
    Tenaglia|RB|74|ar
    Pacheco|CB|75|es
    Koski|CB|72|fi
    Diarra|LB|72|ml
    Blanco|CDM|75|es
    Guridi|CM|75|es
    Ibáñez|CAM|74|es
    Vicente|LM|74|es
    Toni Martínez|ST|74|es
    Boyé|ST|75|ar
  `),
  squad('athletic', 'Athletic Club', 'ATHLETIC', L, N, ['#ee2523', '#f5f5f5'], { style: 'highpress', formation: '4-2-3-1', api: 531 }, `
    Unai Simón|GK|84|es
    De Marcos|RB|76|es
    Vivian|CB|80|es
    Paredes|CB|78|es
    Yuri Berchiche|LB|77|es
    Jauregizar|CDM|78|es
    Ruiz de Galarreta|CM|78|es
    Sancet|CAM|80|es
    I. Williams|RW|78|gh
    N. Williams|LW|84|es
    Guruzeta|ST|78|es
    Berenguer|LW|77|es
  `),
  squad('atletico', 'Atlético de Madrid', 'ATLÉTICO', L, N, ['#cb3524', '#262e61'], { style: 'counter', formation: '4-4-2' }, `
    Oblak|GK|86|si
    Llorente|RB|81|es|RM
    Le Normand|CB|80|es
    Giménez|CB|81|uy
    Hancko|CB|80|sk|LB
    Ruggeri|LB|77|ar
    Barrios|CM|80|es
    Koke|CM|80|es
    Cardoso|CDM|79|us
    Baena|LM|83|es
    Gi. Simeone|RM|78|ar
    Almada|CAM|80|ar
    Griezmann|CF|83|fr|ST
    Sørloth|ST|81|no
  `),
  squad('barcelona', 'FC Barcelona', 'BARCELONA', L, N, ['#a50044', '#004d98'], { style: 'possession', formation: '4-3-3' }, `
    Lamine Yamal|RW|89|es|CAM
    Cubarsí|CB|83|es
    Eric García|CB|78|es
    Christensen|CB|78|dk
    Fermín|CAM|80|es
    Olmo|CAM|83|es
    Casadó|CDM|76|es
    Lewandowski|ST|86|pl
    Ferran Torres|ST|80|es
    Rashford|LW|80|gb-eng
    Szczęsny|GK|80|pl
    Ter Stegen|GK|84|de
  `),
  squad('celta', 'RC Celta', 'CELTA', L, N, ['#8ac3ee', '#e5254e'], { style: 'possession', formation: '3-5-2', api: 538 }, `
    Radu|GK|75|ro
    Mingueza|RWB|77|es|RB
    Starfelt|CB|75|se
    Marcos Alonso|CB|76|es
    Javi Rodríguez|CB|74|es
    Carreira|LWB|72|es
    Beltrán|CM|77|es
    Sotelo|CM|74|es
    Swedberg|CAM|75|se
    Aspas|CF|79|es
    Borja Iglesias|ST|76|es
  `),
  squad('elche', 'Elche CF', 'ELCHE', L, N, ['#05642c', '#f5f5f5'], { style: 'possession', formation: '3-5-2', api: 797 }, `
    Dituro|GK|74|ar
    Pedrosa|LWB|72|es
    Bigas|CB|72|es
    Affengruber|CB|74|at
    Chust|CB|72|es
    Valera|RWB|72|es
    Febas|CM|73|es
    Aguado|CDM|74|es
    Josan|CAM|72|es
    André Silva|ST|75|pt
    Álvaro Rodríguez|ST|73|uy
  `),
  squad('espanyol', 'RCD Espanyol', 'ESPANYOL', L, N, ['#007fc8', '#f5f5f5'], { style: 'counter', formation: '4-4-2', api: 540 }, `
    Dmitrović|GK|76|rs
    El Hilali|RB|73|ma
    Cabrera|CB|76|uy
    Calero|CB|73|es
    Carlos Romero|LB|73|es
    Lozano|CDM|72|hn
    Expósito|CM|76|es
    Dolan|LM|74|gb-eng
    Jofre|RM|72|es
    Kike García|ST|74|es
    Roberto Fernández|ST|73|es
  `),
  squad('getafe', 'Getafe CF', 'GETAFE', L, N, ['#005999', '#f5f5f5'], { style: 'counter', formation: '4-4-2', api: 546 }, `
    Soria|GK|78|es
    Iglesias|RB|73|es
    Djené|CB|77|tg
    Duarte|CB|74|br
    Diego Rico|LB|73|es
    Milla|CM|77|es
    Arambarri|CDM|76|uy
    Mario Martín|CM|73|es
    Uche|ST|75|ng
    Mayoral|ST|76|es
    Liso|RW|72|es
  `),
  squad('girona', 'Girona FC', 'GIRONA', L, N, ['#cd2534', '#f5f5f5'], { style: 'possession', formation: '4-2-3-1', api: 547 }, `
    Gazzaniga|GK|78|ar
    Arnau Martínez|RB|76|es
    Krejčí|CB|76|cz
    Blind|CB|76|nl
    Miguel Gutiérrez|LB|78|es
    Witsel|CDM|76|be
    Iván Martín|CM|77|es
    Asprilla|RW|77|co
    Tsygankov|RW|78|ua
    Echeverri|CAM|75|ar
    Stuani|ST|74|uy
    Vanat|ST|75|ua
  `),
  squad('levante', 'Levante UD', 'LEVANTE', L, N, ['#004c97', '#b5121b'], { style: 'counter', formation: '4-2-3-1', api: 539 }, `
    Ryan|GK|74|au
    Pampín|RB|72|es
    Elgezabal|CB|72|es
    Dela|CB|72|es
    Manu Sánchez|LB|73|es
    Oriol Rey|CDM|72|es
    Pablo Martínez|CM|73|es
    Carlos Álvarez|CAM|76|es
    Iván Romero|ST|72|es
    Brugué|LW|72|es
    Morales|ST|74|es
  `),
  squad('mallorca', 'RCD Mallorca', 'MALLORCA', L, N, ['#e20613', '#111111'], { style: 'counter', formation: '4-4-2', api: 798 }, `
    Leo Román|GK|76|es
    Maffeo|RB|75|ar
    Valjent|CB|77|sk
    Raíllo|CB|75|es
    Mojica|LB|74|co
    Samu Costa|CDM|76|pt
    Darder|CM|76|es
    Morlanes|CM|74|es
    Asano|RW|74|jp
    Muriqi|ST|78|xk
    Larin|ST|74|ca
  `),
  squad('osasuna', 'CA Osasuna', 'OSASUNA', L, N, ['#d91a21', '#0a346f'], { style: 'direct', formation: '4-2-3-1', api: 727 }, `
    Sergio Herrera|GK|77|es
    Rosier|RB|74|fr
    Catena|CB|77|es
    Boyomo|CB|75|cm
    Bretones|LB|73|es
    Torró|CDM|76|es
    Moncayola|CM|76|es
    Aimar Oroz|CAM|76|es
    Rubén García|RW|76|es
    Moi Gómez|LW|75|es
    Budimir|ST|79|hr
  `),
  squad('oviedo', 'Real Oviedo', 'OVIEDO', L, N, ['#0050a0', '#f5f5f5'], { style: 'counter', formation: '4-2-3-1', api: 718 }, `
    Escandell|GK|73|es
    Bailly|CB|72|ci
    Costas|CB|72|es
    Ahijado|RB|71|es
    Alhassane|LB|70|gh
    Colombatto|CDM|74|ar
    Reina|CM|71|es
    Cazorla|CAM|74|es
    Ilic|RW|72|rs
    Hassan|LW|72|eg
    Rondón|ST|73|ve
  `),
  squad('rayo', 'Rayo Vallecano', 'RAYO', L, N, ['#f5f5f5', '#e53027'], { style: 'highpress', formation: '4-2-3-1', api: 728 }, `
    Batalla|GK|77|ar
    Ratiu|RB|76|ro
    Lejeune|CB|76|fr
    Mumin|CB|74|gh
    Chavarría|LB|75|ar
    Unai López|CM|76|es
    Óscar Valentín|CDM|75|es
    Isi Palazón|CAM|77|es
    Pathé Díaz|RW|74|es
    De Frutos|LW|76|es
    Alemão|ST|73|br
  `),
  squad('betis', 'Real Betis', 'BETIS', L, N, ['#00954c', '#f5f5f5'], { style: 'possession', formation: '4-2-3-1', api: 543 }, `
    Pau López|GK|76|es
    Bellerín|RB|75|es
    Bartra|CB|76|es
    Natan|CB|77|br
    Ricardo Rodríguez|LB|76|ch
    Marc Roca|CDM|77|es
    Fornals|CM|79|es
    Lo Celso|CAM|80|ar
    Isco|CAM|81|es
    Antony|RW|79|br
    Abde|LW|78|ma
    Bakambu|ST|75|cd
    Cucho Hernández|ST|78|co
  `),
  squad('real-madrid', 'Real Madrid C.F.', 'REAL MADRID', L, N, ['#f4f1e8', '#1b2a5c'], { style: 'counter', formation: '4-3-3' }, `
    Huijsen|CB|82|es
    Militão|CB|84|br
    Carreras|LB|80|es
    Mendy|LB|79|fr
    Ceballos|CM|78|es
    Güler|CAM|81|tr|RW
    Mastantuono|RW|76|ar
    Brahim|CAM|79|ma
    Endrick|ST|77|br
    Lunin|GK|79|ua
  `),
  squad('real-sociedad', 'Real Sociedad', 'REAL SOCIEDAD', L, N, ['#0067b1', '#f5f5f5'], { style: 'possession', formation: '4-3-3', api: 548 }, `
    Remiro|GK|80|es
    Aramburu|RB|76|ve
    Zubeldia|CB|78|es
    Caleta-Car|CB|75|hr
    Aihen|LB|74|es
    Zakharyan|CM|76|ru
    Brais Méndez|CAM|79|es
    Turrientes|CM|76|es
    Kubo|RW|80|jp
    Barrenetxea|LW|78|es
    Oyarzabal|ST|81|es
    L. Sučić|CM|76|hr
  `),
  squad('sevilla', 'Sevilla FC', 'SEVILLA', L, N, ['#f5f5f5', '#d71920'], { style: 'balanced', formation: '4-2-3-1', api: 536 }, `
    Vlachodimos|GK|76|gr
    Carmona|RB|75|es
    Marcão|CB|75|br
    Kike Salas|CB|74|es
    Suazo|LB|73|cl
    Agoumé|CDM|75|fr
    Sow|CM|75|ch
    Vargas|CAM|76|ch
    Ejuke|LW|76|ng
    Isaac Romero|ST|75|es
    Alexis Sánchez|ST|74|cl
  `),
  squad('valencia', 'Valencia CF', 'VALENCIA', L, N, ['#f5f5f5', '#ee3524'], { style: 'counter', formation: '4-4-2', api: 532 }, `
    Dimitrievski|GK|76|mk
    Foulquier|RB|74|fr
    Tárrega|CB|76|es
    Copete|CB|74|es
    Gayà|LB|78|es
    Pepelu|CDM|76|es
    Guerra|CM|78|es
    Diego López|LM|77|es
    Rioja|RM|75|es
    Hugo Duro|ST|76|es
    Danjuma|ST|76|nl
  `),
  squad('villarreal', 'Villarreal CF', 'VILLARREAL', L, N, ['#ffe667', '#005187'], { style: 'possession', formation: '4-4-2', api: 533 }, `
    Júnior|GK|76|br
    Mouriño|RB|75|uy
    Veiga|CB|78|es
    Kambwala|CB|75|fr
    Pedraza|LB|77|es
    Parejo|CM|80|es
    Comesaña|CDM|76|es
    Pépé|RW|79|ci
    Moleiro|LM|78|es
    Gerard Moreno|ST|80|es
    Mikautadze|ST|78|ge
    Buchanan|LM|76|ca
  `),
];
