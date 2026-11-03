import type { PackDefinition } from '@fu/domain';
import { BrandMark } from '../../components/TopBar';
import './pack.css';

/** Sobre físico dibujado con CSS: foil, crimpado y temática por tipo. */
export function PackArt({ pack, size = 'md', shaking }: { pack: PackDefinition; size?: 'sm' | 'md' | 'lg'; shaking?: boolean }) {
  return (
    <div className={`pack pack--${size}`} data-theme={pack.theme} data-shaking={shaking ?? false} aria-hidden>
      <div className="pack__foil">
        <div className="pack__crimp pack__crimp--top" />
        <div className="pack__glow" />
        <div className="pack__mark">
          <BrandMark size={size === 'sm' ? 30 : size === 'lg' ? 64 : 46} />
        </div>
        <div className="pack__name t-display">{pack.name.replace('Sobre ', '')}</div>
        <div className="pack__count t-ui">{pack.size} {pack.size === 1 ? 'carta' : 'cartas'}</div>
        <div className="pack__crimp pack__crimp--bottom" />
        <div className="pack__sheen" />
      </div>
    </div>
  );
}
