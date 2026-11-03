import { useLayoutEffect, useRef, useState } from 'react';
import { xpForLevel } from '@fu/domain';
import { useGame } from '../state/gameStore';
import { TABS, useUi } from '../state/uiStore';
import { useAssetStore } from '../assets/assets';
import { Coins } from './ui/ui';
import './topbar.css';

export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="brand-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff3cf" />
          <stop offset=".5" stopColor="#d6a84c" />
          <stop offset="1" stopColor="#7a5418" />
        </linearGradient>
      </defs>
      <path d="M32 2 60 12v20c0 15-12 26-28 30C16 58 4 47 4 32V12z" fill="#0d0f13" stroke="url(#brand-g)" strokeWidth="2.5" />
      <path d="M17 17h20l-2.4 6.2H24.6l-1.2 4.6H33l-2 6.2h-9.6l-3 13H11z" fill="url(#brand-g)" />
      <path d="M36.5 30h6.2l-3.4 11.5c-.6 2 1.8 2.6 2.6.4L45.7 30H52l-3.8 13c-2.3 7.8-17 7.8-14.6 0z" fill="#f4efe4" />
    </svg>
  );
}

export function TopBar() {
  const tab = useUi((s) => s.tab);
  const go = useUi((s) => s.go);
  const coins = useGame((s) => s.coins);
  const progress = useGame((s) => s.progress);
  const online = useAssetStore((s) => s.online);
  const navRef = useRef<HTMLElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const update = () => {
      const el = navRef.current?.querySelector<HTMLElement>(`[data-tab="${tab}"]`);
      if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
      el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    };
    update();
    void document.fonts?.ready.then(update);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [tab]);

  const xpPct = Math.round((progress.xp / xpForLevel(progress.level)) * 100);

  return (
    <header className="topbar">
      <button className="topbar__brand" onClick={() => go('home')} aria-label="Football Ultimate — inicio">
        <BrandMark />
        <span className="topbar__wordmark">
          <span>FOOTBALL</span>
          <span className="t-gold">ULTIMATE</span>
        </span>
      </button>

      <nav className="topbar__nav" ref={navRef} aria-label="Secciones">
        <kbd className="topbar__key" aria-hidden>
          Q
        </kbd>
        {TABS.map((t) => (
          <button
            key={t.id}
            data-tab={t.id}
            className="topbar__tab"
            data-active={t.id === tab}
            aria-current={t.id === tab ? 'page' : undefined}
            onClick={() => go(t.id)}
          >
            {t.label}
          </button>
        ))}
        <kbd className="topbar__key" aria-hidden>
          E
        </kbd>
        <span className="topbar__indicator" style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }} />
      </nav>

      <div className="topbar__account">
        <span
          className="topbar__status"
          data-online={online ?? 'pending'}
          title={online === false ? 'Servidor de recursos no disponible: usando recursos locales' : 'Servidor de recursos conectado'}
        />
        <Coins value={coins} />
        <div className="topbar__level" title={`Nivel ${progress.level} · ${xpPct}% hacia el siguiente`}>
          <span className="topbar__level-num t-num">{progress.level}</span>
          <svg viewBox="0 0 36 36" className="topbar__level-ring" aria-hidden>
            <circle cx="18" cy="18" r="16" />
            <circle cx="18" cy="18" r="16" style={{ strokeDasharray: `${xpPct} 100` }} pathLength={100} />
          </svg>
        </div>
      </div>
    </header>
  );
}
