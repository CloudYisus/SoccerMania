import { memo, useRef, type CSSProperties, type MouseEvent } from 'react';
import { editionTag, POSITION_LABELS, seasonTag, statEntries, versionType, WALKOUT_RATING, type PlayerCard as Card } from '@fu/domain';
import { catalog, version as resolveVersion } from '../../data/catalog';
import { FlagArt } from './FlagArt';
import { ClubCrest } from './ClubCrest';
import { cardTheme, editionStyle } from './editions';
import './card.css';
import './editions.css';

export type CardSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
const WIDTHS: Record<CardSize, number> = { xs: 92, sm: 128, md: 176, lg: 236, xl: 300 };

export interface PlayerCardProps {
  /** Carta del usuario (si existe) o, en su defecto, una versión del catálogo. */
  card?: Card;
  versionId?: string;
  size?: CardSize;
  /** Ancho CSS explícito (p. ej. "12cqw"). Tiene prioridad sobre size. */
  width?: string;
  interactive?: boolean;
  tilt?: boolean;
  selected?: boolean;
  dim?: boolean;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

function nameSize(name: string) {
  const n = name.length;
  if (n <= 6) return '3.6em';
  if (n <= 8) return '3.25em';
  if (n <= 10) return '2.85em';
  if (n <= 12) return '2.45em';
  if (n <= 14) return '2.15em';
  return '1.9em';
}

/** "Inter" + "2025-26" → "Inter 25/26"; las versiones con año propio se respetan ("México '86"). */
export function versionLabel(label: string, season: string) {
  if (label.includes("'")) return label;
  const m = /^\d{2}(\d{2})-(\d{2})$/.exec(season);
  return m ? `${label} ${m[1]}/${m[2]}` : `${label} ${season}`;
}

export function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="m12 2 2.9 6.2 6.8.8-5 4.7 1.3 6.8L12 17.2l-6 3.3 1.3-6.8-5-4.7 6.8-.8z" fill="currentColor" />
    </svg>
  );
}

/**
 * CardRenderer: compone cualquier carta a partir de sus datos.
 * Protagonistas: NACIÓN (bandera a sangre) + CLUB (escudo grande en el centro).
 * El diseño (marco, foil, brillo, colores) lo define el AÑO de la edición.
 * Los Iconos (propiedad del futbolista) añaden ribete, sello y destellos.
 */
export const PlayerCard = memo(function PlayerCard({
  card,
  versionId,
  size = 'md',
  width,
  interactive = false,
  tilt = false,
  selected,
  dim,
  className,
  style,
  onClick,
}: PlayerCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const vid = card?.versionId ?? versionId;
  if (!vid) throw new Error('PlayerCard requiere card o versionId');
  const { version, player, club, nation } = resolveVersion(vid);
  const type = versionType(version);
  const event = version.event ? catalog.events.get(version.event) : undefined;
  const edition = cardTheme(version.year, event?.kind, event?.leagueId);
  // Base (temporada actual): sólo el club. Temporadas pasadas: club + año. Eventos: club + temporada.
  const versionLine =
    type === 'base' ? version.label : type === 'event' ? `${club.shortName.charAt(0)}${club.shortName.slice(1).toLowerCase()} ${seasonTag(version.season)}` : versionLabel(version.label, version.season);
  const position = card?.positionOverride ?? version.position;
  const stats = statEntries(version.stats);
  // Línea secundaria sin repetir lo que ya dice la versión ("Inter 25/26" no repite "FC Internazionale").
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const labelN = norm(versionLine);
  const showNation = !labelN.includes(norm(nation.name).slice(0, 4));
  const showClub = !norm(club.name).includes(labelN.split(' ')[0]) && !labelN.includes(norm(club.shortName).split(' ')[0]);
  const subline = [showNation ? nation.name : null, showClub ? club.name : null, event ? null : version.milestone].filter(Boolean).join(' · ');

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!tilt || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    ref.current.style.setProperty('--ry', `${(px - 0.5) * 14}deg`);
    ref.current.style.setProperty('--rx', `${(0.5 - py) * 12}deg`);
    ref.current.style.setProperty('--mx', `${px * 100}%`);
    ref.current.style.setProperty('--my', `${py * 100}%`);
  };
  const onLeave = () => {
    ref.current?.style.setProperty('--rx', '0deg');
    ref.current?.style.setProperty('--ry', '0deg');
  };

  const label = `${player.knownAs}${player.icon ? ' (Icono)' : ''}, ${event ? event.name + ', ' : ''}${versionLine}, ${version.rating} ${POSITION_LABELS[position]}${type === 'base' ? '' : `, edición ${edition.name} ${version.year}`}`;

  return (
    <div
      ref={ref}
      className={`fu-card ${className ?? ''}`}
      data-year={version.year}
      data-type={type}
      data-event={event?.kind}
      data-motion={edition.motion}
      data-frame={edition.frameStyle}
      data-shape={edition.shape}
      data-elite={version.rating >= WALKOUT_RATING}
      data-icon={player.icon}
      data-size={size}
      data-interactive={interactive || !!onClick}
      data-tilt={tilt}
      data-selected={selected ?? false}
      data-dim={dim ?? false}
      style={{ ...editionStyle(version.year, event?.kind, event?.leagueId), '--w': width ?? `${WIDTHS[size]}px`, ...style } as CSSProperties}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={onClick}
      role={onClick ? 'button' : 'img'}
      tabIndex={onClick ? 0 : undefined}
      aria-label={label}
      aria-pressed={onClick ? !!selected : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="fu-card__frame">
        <div className="fu-card__ring" />
        <div className="fu-card__body">
          <div className="fu-card__flag">
            <FlagArt code={nation.code} />
          </div>
          <div className="fu-card__tint" />
          <div className="fu-card__foil" data-foil={edition.foil} />
          <div className="fu-card__shade" />
          <div className="fu-card__panel" />
          <div className="fu-card__crest-hero">
            <ClubCrest club={club} />
          </div>
          <div className="fu-card__top">
            <span className="fu-card__rating">{version.rating}</span>
            <span className="fu-card__pos">{POSITION_LABELS[position]}</span>
            {version.altPositions.length > 0 && (
              <span className="fu-card__alt">
                {version.altPositions.slice(0, 2).map((p) => (
                  <span key={p}>{POSITION_LABELS[p]}</span>
                ))}
              </span>
            )}
          </div>
          {type === 'season' && (
            <>
              <div className="fu-card__watermark" aria-hidden>
                {editionTag(version.year)}
              </div>
              <div className="fu-card__plaque" title={`Edición ${edition.name} ${version.year}`}>
                <small>TEMPORADA</small>
                <b>{seasonTag(version.season)}</b>
              </div>
            </>
          )}
          {event && (
            <div className="fu-card__plaque fu-card__plaque--event" title={event.name}>
              <small>{event.cardName}</small>
              <b>{event.kind === 'tots' ? catalog.leagues.get(event.leagueId ?? '')?.shortName ?? event.year : event.kind === 'toty' ? event.year : `'${String(event.year).slice(-2)}`}</b>
            </div>
          )}
          {player.icon && (
            <div className="fu-card__icon" title="Icono">
              <StarIcon />
              <span>ICONO</span>
              <StarIcon />
            </div>
          )}
          <div className="fu-card__info">
            <div className="fu-card__name" style={{ '--name-size': nameSize(player.knownAs) } as CSSProperties}>
              {player.knownAs}
            </div>
            <div className="fu-card__version">{versionLine}</div>
            <div className="fu-card__club">{subline}</div>
            <div className="fu-card__stats">
              {stats.map((s) => (
                <div key={s.key} className="fu-card__stat" data-hi={s.value >= 90}>
                  <b>{s.value}</b>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="fu-card__sweep" />
          <div className="fu-card__shine" />
        </div>
        <div className="fu-card__gems" />
      </div>
    </div>
  );
});
