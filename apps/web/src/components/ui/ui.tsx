import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './icons';
import './ui.css';

type Variant = 'primary' | 'gold' | 'ghost' | 'danger';

export function Button({
  variant = 'ghost',
  size = 'md',
  icon,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; icon?: ReactNode }) {
  return (
    <button className={`btn btn--${variant} btn--${size} ${className ?? ''}`} {...rest}>
      {icon && <span className="btn__icon">{icon}</span>}
      {children && <span className="btn__label">{children}</span>}
    </button>
  );
}

export function Coins({ value, size = 'md', className }: { value: number; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <span className={`coins coins--${size} ${className ?? ''}`}>
      <Icon.Coin size={size === 'lg' ? 22 : size === 'sm' ? 14 : 17} />
      <span className="t-num">{value.toLocaleString('es-ES')}</span>
    </span>
  );
}

export function SectionHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <header className="section-header">
      <div>
        {eyebrow && <div className="t-eyebrow">{eyebrow}</div>}
        <h1 className="section-header__title t-display">{title}</h1>
      </div>
      {children && <div className="section-header__actions">{children}</div>}
    </header>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={o.id === value} data-active={o.id === value} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Meter({ value, max, tone = 'gold', label }: { value: number; max: number; tone?: 'gold' | 'green' | 'blue'; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`meter meter--${tone}`} role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      <div className="meter__fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Panel({ children, className, title, aside }: { children: ReactNode; className?: string; title?: string; aside?: ReactNode }) {
  return (
    <section className={`panel ${className ?? ''}`}>
      {title && (
        <header className="panel__head">
          <h2 className="t-ui">{title}</h2>
          {aside}
        </header>
      )}
      {children}
    </section>
  );
}

export function Drawer({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return createPortal(
    <div className="drawer" role="dialog" aria-modal="true" aria-label={title} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <button className="drawer__scrim" aria-label="Cerrar" onClick={onClose} />
      <div className={`drawer__sheet ${wide ? 'drawer__sheet--wide' : ''}`}>
        <header className="drawer__head">
          <h2 className="t-display">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar" autoFocus>
            <Icon.Close />
          </button>
        </header>
        <div className="drawer__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function ChemDots({ value, max = 10 }: { value: number; max?: number }) {
  const tone = value >= 7 ? 'strong' : value >= 4 ? 'medium' : 'weak';
  return (
    <span className={`chem-pill chem-pill--${tone}`} title={`Química ${value}/${max}`}>
      <Icon.Link size={12} />
      <b className="t-num">{value}</b>
    </span>
  );
}
