import { useState } from 'react';
import { bundledFlagUrl, FLAG_FOCUS, useAssetUrl } from '../../assets/assets';

/**
 * Bandera a sangre para fondos de carta y paneles.
 * Prioridad: recurso del servidor (API-Football/manual) → flag-icons empaquetado → placeholder.
 */
export function FlagArt({ code, className }: { code: string; className?: string }) {
  const remote = useAssetUrl('flag', code);
  const [failed, setFailed] = useState(false);
  const preferRemote = remote.url && remote.provider !== 'flag-icons' && !failed;
  const src = preferRemote ? remote.url : bundledFlagUrl(code);
  if (!src) {
    return (
      <div className={`flag-fallback ${className ?? ''}`} aria-hidden>
        {code.slice(0, 2)}
      </div>
    );
  }
  return (
    <img
      className={className}
      src={src}
      alt=""
      draggable={false}
      loading="lazy"
      decoding="async"
      style={{ objectPosition: FLAG_FOCUS[code] ?? '50% 50%' }}
      onError={() => setFailed(true)}
    />
  );
}
