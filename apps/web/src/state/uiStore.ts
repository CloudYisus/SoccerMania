import { create } from 'zustand';
import type { TeamBuild } from './teams';

export type Tab = 'home' | 'squad' | 'club' | 'market' | 'packs' | 'compete';
export const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Inicio' },
  { id: 'squad', label: 'Plantilla' },
  { id: 'club', label: 'Club' },
  { id: 'market', label: 'Mercado' },
  { id: 'packs', label: 'Sobres' },
  { id: 'compete', label: 'Competir' },
];

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info' | 'reward';
  text: string;
}

export interface MatchRequest {
  mode: 'quick' | 'division' | 'cup';
  /** Torneo (si mode = 'cup'). */
  tournamentId?: string;
  opponent: TeamBuild;
  difficulty: number;
  title: string;
}

interface UiState {
  tab: Tab;
  prevTab: Tab;
  /** Sub-vista dentro de una sección (p. ej. "tactics" en plantilla). */
  intent: string | null;
  match: MatchRequest | null;
  toasts: Toast[];
  go: (tab: Tab, intent?: string | null) => void;
  clearIntent: () => void;
  startMatch: (m: MatchRequest) => void;
  endMatch: () => void;
  toast: (kind: Toast['kind'], text: string) => void;
  dismiss: (id: number) => void;
}

let toastSeq = 0;

export const useUi = create<UiState>((set, get) => ({
  tab: 'home',
  prevTab: 'home',
  intent: null,
  match: null,
  toasts: [],
  go: (tab, intent = null) => {
    if (tab === get().tab && intent === get().intent) return;
    set({ prevTab: get().tab, tab, intent });
  },
  clearIntent: () => set({ intent: null }),
  startMatch: (match) => set({ match }),
  endMatch: () => set({ match: null }),
  toast: (kind, text) => {
    const id = ++toastSeq;
    set({ toasts: [...get().toasts.slice(-3), { id, kind, text }] });
    setTimeout(() => get().dismiss(id), kind === 'error' ? 4200 : 3200);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

/** Ejecuta una acción del juego y muestra su resultado como toast. */
export function feedback(r: { ok: boolean; message: string }) {
  useUi.getState().toast(r.ok ? 'success' : 'error', r.message);
  return r.ok;
}
