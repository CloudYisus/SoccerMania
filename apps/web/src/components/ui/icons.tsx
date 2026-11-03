import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = ({ size = 18, ...p }: P) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...p,
});

export const Icon = {
  Coin: ({ size = 18, ...p }: P) => (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...p}>
      <defs>
        <linearGradient id="coin-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff3cf" />
          <stop offset=".5" stopColor="#d6a84c" />
          <stop offset="1" stopColor="#7a5418" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#coin-g)" />
      <circle cx="12" cy="12" r="7.2" fill="none" stroke="#6b4a14" strokeOpacity=".55" strokeWidth="1.2" />
      <path d="M9.2 8h5.6l-.6 1.8h-3.3l-.4 1.5h2.9l-.6 1.8h-2.8L9.6 16H7.7z" fill="#5b3d0e" />
    </svg>
  ),
  Home: (p: P) => (
    <svg {...base(p)}>
      <path d="M3 11 12 4l9 7" />
      <path d="M5 10v10h14V10" />
    </svg>
  ),
  Shirt: (p: P) => (
    <svg {...base(p)}>
      <path d="M8 3 4 5.5 2.5 10l3.5 1.2V21h12v-9.8l3.5-1.2L20 5.5 16 3c-.6 1.6-2.2 2.6-4 2.6S8.6 4.6 8 3Z" />
    </svg>
  ),
  Grid: (p: P) => (
    <svg {...base(p)}>
      <rect x="3.5" y="3.5" width="7" height="9" rx="1" />
      <rect x="13.5" y="3.5" width="7" height="9" rx="1" />
      <rect x="3.5" y="15" width="7" height="5.5" rx="1" />
      <rect x="13.5" y="15" width="7" height="5.5" rx="1" />
    </svg>
  ),
  Transfer: (p: P) => (
    <svg {...base(p)}>
      <path d="M4 8h14l-3.5-3.5" />
      <path d="M20 16H6l3.5 3.5" />
    </svg>
  ),
  Pack: (p: P) => (
    <svg {...base(p)}>
      <path d="M6 3h12l-1 3 1 3-1 3 1 3-1 3 1 3H6l1-3-1-3 1-3-1-3 1-3z" />
      <path d="M9.5 10h5M9.5 14h5" />
    </svg>
  ),
  Trophy: (p: P) => (
    <svg {...base(p)}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5" />
      <path d="M12 14v3M8.5 20h7l-1-3h-5z" />
    </svg>
  ),
  Play: (p: P) => (
    <svg {...base(p)}>
      <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
    </svg>
  ),
  Pause: (p: P) => (
    <svg {...base(p)}>
      <path d="M8 5v14M16 5v14" strokeWidth="3" />
    </svg>
  ),
  FastForward: (p: P) => (
    <svg {...base(p)}>
      <path d="M3.5 6v12l8-6zM12.5 6v12l8-6z" fill="currentColor" />
    </svg>
  ),
  Close: (p: P) => (
    <svg {...base(p)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  ),
  Chevron: (p: P) => (
    <svg {...base(p)}>
      <path d="m9 5 7 7-7 7" />
    </svg>
  ),
  ChevronLeft: (p: P) => (
    <svg {...base(p)}>
      <path d="m15 5-7 7 7 7" />
    </svg>
  ),
  Swap: (p: P) => (
    <svg {...base(p)}>
      <path d="M7 4v14l-3-3M17 20V6l3 3" />
    </svg>
  ),
  Tactics: (p: P) => (
    <svg {...base(p)}>
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="6" r="2" />
      <path d="M8 16c4-1 4-7 8-8" strokeDasharray="2 2.5" />
      <path d="m4 4 4 4M8 4 4 8" />
    </svg>
  ),
  Bolt: (p: P) => (
    <svg {...base(p)}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
    </svg>
  ),
  Star: (p: P) => (
    <svg {...base(p)}>
      <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
    </svg>
  ),
  Check: (p: P) => (
    <svg {...base(p)}>
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  ),
  Lock: (p: P) => (
    <svg {...base(p)}>
      <rect x="5" y="10.5" width="14" height="10" rx="1.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </svg>
  ),
  Search: (p: P) => (
    <svg {...base(p)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  ),
  Wand: (p: P) => (
    <svg {...base(p)}>
      <path d="M4 20 15 9M14 4v3M19 9h-3M17.5 5.5l-2 2" />
    </svg>
  ),
  Refresh: (p: P) => (
    <svg {...base(p)}>
      <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4.5h-4.5" />
    </svg>
  ),
  Whistle: (p: P) => (
    <svg {...base(p)}>
      <circle cx="9" cy="14" r="5" />
      <path d="M12.5 10.5 21 6v4l-6 2" />
    </svg>
  ),
  Shield: (p: P) => (
    <svg {...base(p)}>
      <path d="M12 3 5 6v6c0 4 3 7.5 7 9 4-1.5 7-5 7-9V6z" />
    </svg>
  ),
  Link: (p: P) => (
    <svg {...base(p)}>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </svg>
  ),
};
