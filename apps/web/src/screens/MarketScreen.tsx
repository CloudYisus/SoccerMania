import { useEffect, useMemo, useState } from 'react';
import { afterTax, POSITION_LABELS } from '@fu/domain';
import { PlayerCard } from '../components/card/PlayerCard';
import { Icon } from '../components/ui/icons';
import { Button, Coins, SectionHeader, Segmented } from '../components/ui/ui';
import { allVersions, catalog, version } from '../data/catalog';
import { cardValue, EMPTY_FILTERS, norm, searchMarket, type CardTypeFilter, type SearchFilters, type SearchListing } from '../state/marketSearch';
import { useGame } from '../state/gameStore';
import { feedback, useUi } from '../state/uiStore';
import './screens.css';

type View = 'buy' | 'sell';

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
  const myListings = useGame((s) => s.myListings);
  const { cancelListing } = useGame.getState();
  const go = useUi((s) => s.go);
  const now = useNow();
  const active = myListings.filter((l) => l.status === 'active');

  return (
    <div className="market">
      <SectionHeader eyebrow="Mercado de traspasos" title={view === 'buy' ? 'Buscar jugadores' : 'Mis ventas'}>
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
        <MarketSearch now={now} />
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

const TYPE_OPTIONS: { id: CardTypeFilter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'base', label: 'Temporada actual' },
  { id: 'season', label: 'Temporadas pasadas' },
  { id: 'icon', label: 'Iconos' },
  { id: 'toty', label: 'Equipo del Año' },
  { id: 'tots', label: 'Equipo de la Temporada' },
  { id: 'tormenta', label: 'Tormenta' },
  { id: 'gala', label: 'Noches de Gala' },
  { id: 'promesas', label: 'Promesas' },
];
const POSITION_OPTIONS = [
  { id: '', label: 'Cualquiera' },
  { id: 'line:goalkeeper', label: 'Porteros' },
  { id: 'line:defence', label: 'Defensas' },
  { id: 'line:midfield', label: 'Centrocampistas' },
  { id: 'line:attack', label: 'Delanteros' },
  ...(['GK', 'RB', 'CB', 'LB', 'RWB', 'LWB', 'CDM', 'CM', 'CAM', 'RM', 'LM', 'RW', 'LW', 'CF', 'ST'] as const).map((p) => ({ id: p, label: POSITION_LABELS[p] })),
];

/** Buscador con filtros (tipo, nombre, liga, club, nación, posición, media y precio). */
function MarketSearch({ now }: { now: number }) {
  const coins = useGame((s) => s.coins);
  const [f, setF] = useState<SearchFilters>(EMPTY_FILTERS);
  const [results, setResults] = useState<{ matched: number; listings: SearchListing[] } | null>(null);
  const [seed, setSeed] = useState(() => Date.now() % 100000);
  const set = <K extends keyof SearchFilters>(k: K, v: SearchFilters[K]) => setF((x) => ({ ...x, [k]: v, ...(k === 'league' ? { club: '' } : {}) }));

  const leagues = useMemo(() => [...catalog.leagues.values()].filter((l) => [...catalog.clubs.values()].some((c) => c.leagueId === l.id && !c.historical)), []);
  const clubs = useMemo(
    () => [...catalog.clubs.values()].filter((c) => !c.historical && (!f.league || c.leagueId === f.league)).sort((a, b) => a.name.localeCompare(b.name)),
    [f.league],
  );
  const nations = useMemo(() => {
    const used = new Set(allVersions.map((v) => v.nationCode));
    return [...catalog.nations.values()].filter((n) => used.has(n.code)).sort((a, b) => a.name.localeCompare(b.name));
  }, []);
  const suggestions = useMemo(() => {
    const q = norm(f.name.trim());
    if (q.length < 2) return [];
    return [...new Set([...catalog.players.values()].filter((p) => norm(p.knownAs).includes(q)).map((p) => p.knownAs))].slice(0, 8);
  }, [f.name]);

  const run = () => {
    const next = seed + 1;
    setSeed(next);
    setResults(searchMarket(f, next));
  };
  const reset = () => {
    setF(EMPTY_FILTERS);
    setResults(null);
  };
  const live = results?.listings.filter((l) => l.expiresAt > now) ?? [];

  return (
    <div className="msearch">
      <form
        className="msearch__form panel"
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <label className="msearch__field msearch__field--wide">
          <span className="t-ui">Nombre del jugador</span>
          <input list="msearch-names" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Escribe un nombre…" aria-label="Nombre del jugador" />
          <datalist id="msearch-names">
            {suggestions.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </label>
        <div className="msearch__field msearch__field--wide">
          <span className="t-ui">Tipo de carta</span>
          <div className="msearch__chips" role="radiogroup" aria-label="Tipo de carta">
            {TYPE_OPTIONS.map((o) => (
              <button type="button" key={o.id} role="radio" aria-checked={f.type === o.id} className="chip t-ui" data-on={f.type === o.id} onClick={() => set('type', o.id)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <label className="msearch__field">
          <span className="t-ui">Liga</span>
          <select value={f.league} onChange={(e) => set('league', e.target.value)}>
            <option value="">Todas</option>
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label className="msearch__field">
          <span className="t-ui">Club</span>
          <select value={f.club} onChange={(e) => set('club', e.target.value)}>
            <option value="">Todos</option>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="msearch__field">
          <span className="t-ui">Nacionalidad</span>
          <select value={f.nation} onChange={(e) => set('nation', e.target.value)}>
            <option value="">Todas</option>
            {nations.map((n) => (
              <option key={n.code} value={n.code}>
                {n.name}
              </option>
            ))}
          </select>
        </label>
        <label className="msearch__field">
          <span className="t-ui">Posición</span>
          <select value={f.position} onChange={(e) => set('position', e.target.value)}>
            {POSITION_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="msearch__field">
          <span className="t-ui">Media mínima</span>
          <select value={f.minRating} onChange={(e) => set('minRating', Number(e.target.value))}>
            {[0, 75, 80, 83, 85, 87, 89, 91, 93].map((r) => (
              <option key={r} value={r}>
                {r ? `${r}+` : 'Cualquiera'}
              </option>
            ))}
          </select>
        </label>
        <label className="msearch__field">
          <span className="t-ui">Precio máximo</span>
          <span className="price-input">
            <Icon.Coin size={16} />
            <input type="number" min={0} step={500} placeholder="Sin límite" value={f.maxPrice} onChange={(e) => set('maxPrice', e.target.value === '' ? '' : Number(e.target.value))} aria-label="Precio máximo" />
          </span>
        </label>
        <div className="msearch__actions">
          <Button type="button" onClick={reset}>
            Restablecer
          </Button>
          <Button type="submit" variant="gold" icon={<Icon.Search size={16} />}>
            Buscar
          </Button>
        </div>
      </form>

      {!results ? (
        <p className="empty-state">Elige los filtros y pulsa Buscar para ver las ofertas disponibles en este momento.</p>
      ) : live.length === 0 ? (
        <p className="empty-state">{results.matched ? 'No hay ofertas disponibles para esa búsqueda ahora mismo. Prueba de nuevo en un momento o amplía el precio.' : 'Ninguna carta coincide con esos filtros.'}</p>
      ) : (
        <>
          <p className="muted small">
            {live.length} ofertas · {results.matched} cartas coinciden con la búsqueda · Vendedores IA, precios de la economía del juego
          </p>
          <div className="listing-grid">
            {live.map((l) => {
              const value = cardValue(catalog.versions.get(l.versionId)!);
              const deal = l.price <= value * 0.97;
              return (
                <article key={l.id} className="listing">
                  <PlayerCard versionId={l.versionId} size="md" interactive tilt />
                  <div className="listing__bar">
                    <div className="listing__price">
                      <Coins value={l.price} />
                      {deal && <span className="tag tag--green">Oportunidad</span>}
                    </div>
                    <span className="listing__time muted small">Expira en {fmtTime(l.expiresAt - now)}</span>
                    <Button
                      variant="gold"
                      size="sm"
                      disabled={coins < l.price}
                      onClick={() => {
                        if (feedback(useGame.getState().buySearchListing(l.versionId, l.price)))
                          setResults((r) => (r ? { ...r, listings: r.listings.filter((x) => x.id !== l.id) } : r));
                      }}
                    >
                      Comprar ya
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
