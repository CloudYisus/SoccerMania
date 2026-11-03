import { useId, useState } from 'react';
import type { Club } from '@fu/domain';
import { useAssetUrl } from '../../assets/assets';

/** Escudo del club: recurso cacheado por el servidor o escudo provisional generado. */
export function ClubCrest({ club, className }: { club: Club; className?: string }) {
  const { url, provider } = useAssetUrl('crest', club.id);
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return (
      <img
        className={className}
        src={url}
        alt={club.name}
        title={`${club.name} · ${provider}`}
        draggable={false}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }
  return <CrestPlaceholder club={club} className={className} />;
}

function initials(name: string) {
  const words = name.replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/** Escudo provisional (no es el escudo oficial): forma heráldica con los colores del club. */
export function CrestPlaceholder({ club, className }: { club: Club; className?: string }) {
  const id = useId().replace(/:/g, '');
  const { primary, secondary } = club.colors;
  const text = initials(club.shortName);
  return (
    <svg className={className} viewBox="0 0 100 118" role="img" aria-label={`${club.name} (escudo provisional)`} data-placeholder="true">
      <title>{`${club.name} — escudo provisional`}</title>
      <defs>
        <linearGradient id={`m${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff3cf" />
          <stop offset=".45" stopColor="#c8963a" />
          <stop offset="1" stopColor="#6b4a14" />
        </linearGradient>
        <linearGradient id={`f${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={primary} />
          <stop offset="1" stopColor={primary} stopOpacity=".78" />
        </linearGradient>
        <clipPath id={`c${id}`}>
          <path d="M50 8 L88 18 V56 C88 82 70 100 50 110 C30 100 12 82 12 56 V18 Z" />
        </clipPath>
      </defs>
      <path d="M50 2 L94 13 V56 C94 86 73 106 50 116 C27 106 6 86 6 56 V13 Z" fill={`url(#m${id})`} />
      <path d="M50 8 L88 18 V56 C88 82 70 100 50 110 C30 100 12 82 12 56 V18 Z" fill={`url(#f${id})`} />
      <g clipPath={`url(#c${id})`}>
        <rect x="40" y="0" width="20" height="120" fill={secondary} opacity=".9" />
        <path d="M0 0 L100 0 L100 40 L0 70 Z" fill="#fff" opacity=".08" />
      </g>
      <text
        x="50"
        y="66"
        textAnchor="middle"
        fontFamily="Anton, Impact, sans-serif"
        fontSize={text.length > 2 ? 24 : 30}
        fill="#fff"
        stroke="rgba(0,0,0,.55)"
        strokeWidth="1.2"
        paintOrder="stroke"
        letterSpacing="1"
      >
        {text}
      </text>
    </svg>
  );
}
