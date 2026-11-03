import type { SquadView } from './squadView';
import { catalog } from '../data/catalog';

export interface Challenge {
  id: string;
  title: string;
  description: string;
  reward: number;
  /** Progreso real calculado sobre la plantilla actual. */
  evaluate: (v: SquadView) => { current: number; target: number };
}

const starters = (v: SquadView) => v.starters.filter((s): s is NonNullable<typeof s> => !!s);

export const CHALLENGES: Challenge[] = [
  {
    id: 'chem-90',
    title: 'Química perfecta',
    description: 'Alcanza 90 de química de equipo.',
    reward: 5000,
    evaluate: (v) => ({ current: v.chemistry.team, target: 90 }),
  },
  {
    id: 'rating-86',
    title: 'Once de élite',
    description: 'Consigue una valoración de equipo de 86.',
    reward: 7500,
    evaluate: (v) => ({ current: v.rating, target: 86 }),
  },
  {
    id: 'icons-xi',
    title: 'Iconos en el once',
    description: 'Alinea al menos 2 Iconos como titulares.',
    reward: 3000,
    evaluate: (v) => ({ current: starters(v).filter((s) => s.player.icon).length, target: 2 }),
  },
  {
    id: 'eras',
    title: 'Todas las épocas',
    description: 'Titulares de 4 décadas distintas.',
    reward: 4500,
    evaluate: (v) => ({ current: new Set(starters(v).map((s) => Math.floor(s.version.year / 10))).size, target: 4 }),
  },
  {
    id: 'conmebol-5',
    title: 'Raíces sudamericanas',
    description: 'Alinea 5 titulares de selecciones de CONMEBOL.',
    reward: 4000,
    evaluate: (v) => ({ current: starters(v).filter((s) => catalog.nations.get(s.nation.code)?.confederation === 'CONMEBOL').length, target: 5 }),
  },
  {
    id: 'club-block',
    title: 'Bloque de club',
    description: 'Alinea 6 titulares del mismo club.',
    reward: 4000,
    evaluate: (v) => {
      const counts = new Map<string, number>();
      for (const s of starters(v)) counts.set(s.club.id, (counts.get(s.club.id) ?? 0) + 1);
      return { current: Math.max(0, ...counts.values()), target: 6 };
    },
  },
  {
    id: 'five-leagues',
    title: 'Cinco ligas',
    description: 'Titulares de 5 ligas distintas sin bajar de 70 de química.',
    reward: 6000,
    evaluate: (v) => {
      const leagues = new Set(starters(v).map((s) => s.league.id)).size;
      return { current: v.chemistry.team >= 70 ? leagues : Math.min(leagues, 4), target: 5 };
    },
  },
];
