import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAssetBootstrap } from './assets/assets';
import { TopBar } from './components/TopBar';
import { useGame } from './state/gameStore';
import { TABS, useUi, type Tab } from './state/uiStore';
import { HomeScreen } from './screens/HomeScreen';
import { SquadScreen } from './screens/squad/SquadScreen';
import { ClubScreen } from './screens/ClubScreen';
import { MarketScreen } from './screens/MarketScreen';
import { PacksScreen } from './screens/packs/PacksScreen';
import { CompeteScreen } from './screens/CompeteScreen';
import { version } from './data/catalog';
import { afterTax } from '@fu/domain';
import './styles/shell.css';

const MatchScreen = lazy(() => import('./screens/match/MatchScreen'));

const SCREENS: Record<Tab, () => ReactNode> = {
  home: () => <HomeScreen />,
  squad: () => <SquadScreen />,
  club: () => <ClubScreen />,
  market: () => <MarketScreen />,
  packs: () => <PacksScreen />,
  compete: () => <CompeteScreen />,
};

interface Layer {
  key: number;
  tab: Tab;
  leaving: boolean;
  dir: number;
}

/** Escenario con transiciones de entrada y salida entre secciones. */
function ScreenStage() {
  const tab = useUi((s) => s.tab);
  const seq = useRef(0);
  const [layers, setLayers] = useState<Layer[]>([{ key: 0, tab, leaving: false, dir: 1 }]);

  useEffect(() => {
    setLayers((prev) => {
      const current = prev[prev.length - 1];
      if (current.tab === tab) return prev;
      const order = TABS.map((t) => t.id);
      const dir = order.indexOf(tab) >= order.indexOf(current.tab) ? 1 : -1;
      return [{ ...current, leaving: true, dir }, { key: ++seq.current, tab, leaving: false, dir }];
    });
    window.scrollTo({ top: 0 });
    const t = setTimeout(() => setLayers((prev) => prev.filter((l) => !l.leaving)), 260);
    return () => clearTimeout(t);
  }, [tab]);

  return (
    <div className="screens">
      {layers.map((l) => (
        <div
          key={l.key}
          className={`screen ${l.leaving ? 'screen--leaving' : ''}`}
          style={{ '--dir': l.dir } as React.CSSProperties}
          aria-hidden={l.leaving || undefined}
          inert={l.leaving || undefined}
        >
          {SCREENS[l.tab]()}
        </div>
      ))}
    </div>
  );
}

function Toasts() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismiss);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button key={t.id} className={`toast toast--${t.kind}`} onClick={() => dismiss(t.id)}>
          <span className="toast__mark" />
          {t.text}
        </button>
      ))}
    </div>
  );
}

/** Navegación con Q/E (equivalente a los gatillos LB/RB). */
function useKeyboardNav() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, select, textarea, [role="dialog"]') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (useUi.getState().match) return;
      const key = e.key.toLowerCase();
      if (key !== 'q' && key !== 'e') return;
      const order = TABS.map((t) => t.id);
      const i = order.indexOf(useUi.getState().tab);
      const next = order[(i + (key === 'e' ? 1 : -1) + order.length) % order.length];
      useUi.getState().go(next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Resuelve las ventas del mercado en segundo plano, esté donde esté el usuario. */
function useMarketTicker() {
  useEffect(() => {
    const tick = () => {
      const resolved = useGame.getState().processListings(Date.now());
      for (const l of resolved) {
        const name = version(l.versionId).player.knownAs;
        if (l.status === 'sold') useUi.getState().toast('reward', `${name} vendido: +${afterTax(l.price).toLocaleString('es-ES')} monedas`);
        else useUi.getState().toast('info', `${name}: sin comprador. Vuelve a tu club.`);
      }
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, []);
}

export function App() {
  useAssetBootstrap();
  useKeyboardNav();
  useMarketTicker();
  const match = useUi((s) => s.match);
  return (
    <>
      <div className="stage" aria-hidden>
        <div className="stage__lines" />
        <div className="stage__grain" />
      </div>
      <div className="app" inert={match ? true : undefined}>
        <TopBar />
        <main className="shell">
          <ScreenStage />
        </main>
      </div>
      {match && (
        <Suspense fallback={<div className="match-loading t-ui">Preparando el estadio…</div>}>
          <MatchScreen />
        </Suspense>
      )}
      <Toasts />
    </>
  );
}
