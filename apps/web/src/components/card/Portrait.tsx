import { useId, useState } from 'react';
import { hashString } from '@fu/shared';
import { useAssetUrl } from '../../assets/assets';

/**
 * Retrato del futbolista. Si existe un recurso (PNG con transparencia) se usa;
 * si no, una silueta original con la camiseta del club representado.
 */
export function Portrait({
  playerId,
  colors,
}: {
  playerId: string;
  colors: { primary: string; secondary: string };
}) {
  const { url } = useAssetUrl('portrait', playerId);
  const [failed, setFailed] = useState(false);
  if (url && !failed) return <img src={url} alt="" draggable={false} loading="lazy" onError={() => setFailed(true)} />;
  return <Silhouette seed={playerId} colors={colors} />;
}

const HAIR = [
  'M64 74 C60 40 82 26 100 26 C122 26 142 40 136 74 C130 60 118 52 100 52 C82 52 70 60 64 74 Z',
  'M66 66 C66 42 84 32 100 32 C118 32 134 42 134 66 C126 56 114 50 100 50 C86 50 74 56 66 66 Z',
  'M58 92 C48 40 80 20 100 22 C124 20 154 40 142 92 C140 72 128 58 100 56 C74 58 62 72 58 92 Z',
  'M64 72 C62 44 78 30 98 30 C106 22 128 26 134 44 C138 54 138 64 136 74 C128 60 116 50 100 50 C84 50 70 58 64 72 Z',
];

export function Silhouette({ seed, colors }: { seed: string; colors: { primary: string; secondary: string } }) {
  const id = useId().replace(/:/g, '');
  const h = hashString(seed);
  const hair = HAIR[h % HAIR.length];
  const stripes = (h >> 3) % 4 === 0;
  return (
    <svg viewBox="0 0 200 220" aria-hidden data-placeholder="true">
      <defs>
        <linearGradient id={`s${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3a404c" />
          <stop offset=".55" stopColor="#1b1f27" />
          <stop offset="1" stopColor="#0b0d11" />
        </linearGradient>
        <radialGradient id={`l${id}`} cx=".32" cy=".3" r=".7">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".16" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`j${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={colors.primary} />
          <stop offset="1" stopColor={colors.primary} stopOpacity=".55" />
        </linearGradient>
        <linearGradient id={`d${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity=".55" />
          <stop offset=".35" stopColor="#000" stopOpacity="0" />
          <stop offset=".7" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".6" />
        </linearGradient>
        <clipPath id={`k${id}`}>
          <path d="M8 220 C12 172 40 152 72 143 L86 137 C92 152 108 152 114 137 L128 143 C160 152 188 172 192 220 Z" />
        </clipPath>
      </defs>
      {/* Camiseta */}
      <path d="M8 220 C12 172 40 152 72 143 L86 137 C92 152 108 152 114 137 L128 143 C160 152 188 172 192 220 Z" fill={`url(#j${id})`} />
      <g clipPath={`url(#k${id})`}>
        {stripes && [40, 76, 112, 148].map((x) => <rect key={x} x={x} y="130" width="16" height="100" fill={colors.secondary} opacity=".55" />)}
        <rect x="0" y="130" width="200" height="100" fill={`url(#d${id})`} />
      </g>
      <path d="M86 137 L100 162 L114 137" fill="none" stroke={colors.secondary} strokeWidth="6" strokeLinejoin="round" />
      {/* Cuello y cabeza */}
      <path d="M84 110 L116 110 L117 140 C108 150 92 150 83 140 Z" fill={`url(#s${id})`} />
      <ellipse cx="66" cy="84" rx="6" ry="10" fill="#1b1f27" />
      <ellipse cx="134" cy="84" rx="6" ry="10" fill="#151820" />
      <ellipse cx="100" cy="80" rx="34" ry="42" fill={`url(#s${id})`} />
      <ellipse cx="100" cy="80" rx="34" ry="42" fill={`url(#l${id})`} />
      <path d={hair} fill="#0a0b0e" />
      {/* Luz de contorno */}
      <path d="M68 66 C72 46 86 38 100 38" fill="none" stroke="#fff" strokeOpacity=".22" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16 206 C22 176 44 158 72 149" fill="none" stroke="#fff" strokeOpacity=".2" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
