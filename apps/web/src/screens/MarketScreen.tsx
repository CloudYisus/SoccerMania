import { useEffect, useMemo, useState } from 'react';
import { afterTax, listRarities, marketValue, POSITION_LINE, type PositionLine } from '@fu/domain';
import { PlayerCard } from '../components/card/PlayerCard';
import { Icon } from '../components/ui/icons';
import { Button, Coins, SectionHeader, Segmented } from '../components/ui/ui';
import { version } from '../data/catalog';
import { useGame } from '../state/gameStore';
import { feedback, useUi } from '../state/uiStore';
import './screens.css';

type View = 'buy' | 'sell';
type LineFilter = 'all' | PositionLine;

function useNow(interval = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [interval]);
  return now;
}

function fmtTime(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s >= 3600) return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
  if (s >= 60) return `${Math.floor(s / 60)} min`;
  return `${s} s`;
}

export function MarketScreen() {
  const [view, setView] = useState<View>('buy');
  const listings = useGame((s) => s.market.listings);
  const myListings = useGame((s) => s.myListings);
  const coins = useGame((s) => s.coins);
  const { refreshMarket, buyListing, cancelListing } = useGame.getState();
  const go = useUi((s) => s.go);
  const now = useNow();
  const [rarity, setRarity] = useState('all');
  const [line, setLine] = useState<LineFilter>('all');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');

  useEffect(() => refreshMarket(false), [refreshMarket]);

  const filtered = useMemo(
    () =>
      listings
        .filter((l) => l.expiresAt > now)
        .filter((l) => {
          const v = version(l.versionId).version;
          return (rarity === 'all' || v.rarity === rarity) && (line === 'all' || POSITION_LINE[v.position] === line) && (maxPrice === '' || l.price <= maxPrice);
        }),
    [listings, rarity, line, maxPrice, now],
  );

  const active = myListings.filter((l) => l.status === 'active');

  return (
    <div className="market">
      <SectionHeader eyebrow="Mercado de traspasos" title={view === 'buy' ? 'Fichajes' : 'Mis ventas'}>
        <Segmented<View>
          label="Vista"
          value={view}
          onChange={setView}
          options={[
            { id: 'buy', label: 'Comprar' },
            { id: 'sell', label: `Mis ventas${active.length ? ` (${active.length})` : ''}` },
          ]}
        />
      </SectionHeader>

      {view === 'buy' ? (
        <>
          <div className="filters">
            <Segmented
              label="Rareza"
              value={rarity}
              onChange={setRarity}
              options={[{ id: 'all', label: 'Todas' }, ...listRarities().map((r) => ({ id: r.id as string, label: r.label }))]}
            />
            <Segmented<LineFilter>
              label="Línea"
              value={line}
              onChange={setLine}
              options={[
                { id: 'all', label: 'Todos' },
                { id: 'goalkeeper', label: 'POR' },
                { id: 'defence', label: 'DEF' },
                { id: 'midfield', label: 'MED' },
                { id: 'attack', label: 'DEL' },
              ]}
            />
            <label className="price-input price-input--filter">
              <Icon.Coin size={16} />
              <input
                type="number"
                placeholder="Precio máx."
                value={maxPrice}
                min={0}
                step={500}
                onChange={(e) => setMaxPrice(e.target.value === '' ? '' : Number(e.target.value))}
                aria-label="Precio máximo"
              />
            </label>
            <Button icon={<Icon.Refresh size={16} />} onClick={() => refreshMarket(true)}>
              Actualizar
            </Button>
          </div>
          <p className="demo-note market__note">Mercado simulado con compradores y vendedores IA · precios de la economía del juego</p>
          {filtered.length === 0 ? (
            <p className="empty-state">No hay anuncios con estos filtros.</p>
          ) : (
            <div className="listing-grid">
              {filtered.map((l) => {
                const r = version(l.versionId);
                const value = marketValue(r.version.rating, r.version.rarity);
                const deal = l.price <= value * 0.95;
                return (
                  <article key={l.id} className="listing">
                    <PlayerCard versionId={l.versionId} size="md" interactive tilt />
                    <div className="listing__bar">
                      <div className="listing__price">
                        <Coins value={l.price} />
                        {deal && <span className="tag tag--green">Oportunidad</span>}
                      </div>
                      <span className="listing__time muted small">Expira en {fmtTime(l.expiresAt - now)}</span>
                      <Button variant="gold" size="sm" disabled={coins < l.price} onClick={() => feedback(buyListing(l.id))}>
                        Comprar ya
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="sales">
          {myListings.length === 0 ? (
            <div className="empty-state">
              <p>No tienes cartas en venta. Elige una carta transferible en tu club para ponerla en el mercado.</p>
              <Button variant="primary" onClick={() => go('club')}>
                Ir al club
              </Button>
            </div>
          ) : (
            <ul className="sales__list">
              {myListings.map((l) => {
                const r = version(l.versionId);
                const progress = Math.min(1, (now - l.listedAt) / (l.resolveAt - l.listedAt));
                return (
                  <li key={l.id} className="sale" data-status={l.status}>
                    <PlayerCard versionId={l.versionId} size="xs" />
                    <div className="sale__info">
                      <b>{r.player.knownAs}</b>
                      <span className="muted small">{r.version.label}</span>
                      <Coins value={l.price} size="sm" />
                    </div>
                    <div className="sale__state">
                      {l.status === 'active' && (
                        <>
                          <span className="t-ui small">Buscando comprador</span>
                          <div className="sale__progress">
                            <span style={{ width: `${progress * 100}%` }} />
                          </div>
                          <Button size="sm" onClick={() => cancelListing(l.id)}>
                            Retirar
                          </Button>
                        </>
                      )}
                      {l.status === 'sold' && (
                        <span className="tag tag--green">
                          Vendido · +{afterTax(l.price).toLocaleString('es-ES')}
                        </span>
                      )}
                      {l.status === 'expired' && <span className="tag">Sin comprador · de vuelta en tu club</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
