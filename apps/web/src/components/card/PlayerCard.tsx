import { memo, useRef, type CSSProperties, type MouseEvent } from 'react';
import { POSITION_LABELS, statEntries, type PlayerCard as Card, type Position } from '@fu/domain';
import { version as resolveVersion } from '../../data/catalog';
import { FlagArt } from './FlagArt';
import { ClubCrest } from './ClubCrest';
import { Portrait } from './Portrait';
import './card.css';

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
  /** Posición que ocupa en la plantilla (para mostrarla si difiere). */
  slotPosition?: Position;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

function nameSize(name: string) {
  const n = name.length;
  if (n <= 7) return '2.35em';
  if (n <= 10) return '2.05em';
  if (n <= 13) return '1.7em';
  return '1.42em';
}

/**
 * CardRenderer: compone cualquier carta a partir de sus datos.
 * Capas: marco de rareza → bandera a sangre (tela, tinte, sombra) → retrato →
 * rating/posición → insignia → escudo lateral → nombre, versión y 6 atributos → brillos.
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
  const { version, player, club, nation, rarity } = resolveVersion(vid);
  const position = card?.positionOverride ?? version.position;
  const stats = statEntries(version.stats);
  // "Inter" → "Inter 25/26"; las versiones históricas ya incluyen su año ("México '86").
  const seasonTag = /^\d{4}-\d{2}$/.test(version.season) ? ` ${version.season.slice(2, 4)}/${version.season.slice(5)}` : '';
  const versionLabel = version.label.includes("'") || version.label === 'Icono' ? version.label : `${version.label}${seasonTag}`;
  const subline = [version.label.toUpperCase().includes(nation.cardName.slice(0, 4)) ? null : nation.cardName, club.name, version.milestone].filter(Boolean).join(' · ');

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

  const label = `${player.knownAs}, ${version.label}, ${version.rating} ${POSITION_LABELS[position]}, ${rarity.label}`;

  return (
    <div
      ref={ref}
      className={`fu-card ${className ?? ''}`}
      data-rarity={version.rarity}
      data-size={size}
      data-interactive={interactive || !!onClick}
      data-tilt={tilt}
      data-selected={selected ?? false}
      data-dim={dim ?? false}
      style={{ '--w': width ?? `${WIDTHS[size]}px`, ...style } as CSSProperties}
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
        <div className="fu-card__body">
          <div className="fu-card__flag">
            <FlagArt code={nation.code} />
          </div>
          <div className="fu-card__tint" />
          <div className="fu-card__portrait">
            <Portrait playerId={player.id} colors={club.colors} />
          </div>
          <div className="fu-card__shade" />
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
          <span className="fu-card__badge">{rarity.badge}</span>
          <div className="fu-card__crest">
            <ClubCrest club={club} />
          </div>
          <div className="fu-card__info">
            <div className="fu-card__name" style={{ '--name-size': nameSize(player.knownAs) } as CSSProperties}>
              {player.knownAs}
            </div>
            <div className="fu-card__meta">
              <span className="fu-card__version">{versionLabel}</span>
              <span className="fu-card__number">#{version.shirtNumber}</span>
            </div>
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
      </div>
    </div>
  );
});
