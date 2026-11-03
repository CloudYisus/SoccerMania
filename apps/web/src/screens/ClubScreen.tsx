import { useMemo, useState } from 'react';
import {
  POSITION_LABELS,
  POSITION_LINE,
  priceRange,
  quickSellValue,
  squadCardIds,
  versionsOfPlayer,
  type PositionLine,
} from '@fu/domain';
import { PlayerCard, versionLabel } from '../components/card/PlayerCard';
import { editionStyle, getEdition } from '../components/card/editions';
import { Icon } from '../components/ui/icons';
import { Button, Coins, Drawer, SectionHeader, Segmented } from '../components/ui/ui';
import { catalog, resolve } from '../data/catalog';
import { useGame } from '../state/gameStore';
import { feedback } from '../state/uiStore';
import './screens.css';

type LineFilter = 'all' | PositionLine;
type Sort = 'rating' | 'edition' | 'recent';

export function ClubScreen() {
  const cards = useGame((s) => s.cards);
  const squad = useGame((s) => s.squad);
  const myListings = useGame((s) => s.myListings);
  const [query, setQuery] = useState('');
  const [edition, setEdition] = useState<string>('all');
  const [iconsOnly, setIconsOnly] = useState(false);
  const [line, setLine] = useState<LineFilter>('all');
  const [sort, setSort] = useState<Sort>('rating');
  const [openId, setOpenId] = useState<string | null>(null);

  const inSquad = useMemo(() => new Set(squadCardIds(squad)), [squad]);
  const listed = useMemo(() => new Set(myListings.filter((l) => l.status === 'active').map((l) => l.cardId)), [myListings]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return Object.values(cards)
      .map(resolve)
      .filter((r) => edition === 'all' || String(r.version.year) === edition)
      .filter((r) => !iconsOnly || r.player.icon)
      .filter((r) => line === 'all' || POSITION_LINE[r.position] === line)
      .filter((r) => {
        if (!q) return true;
        const hay = `${r.player.knownAs} ${r.player.fullName} ${r.club.name} ${r.nation.name} ${r.version.label}`
          .toLowerCase()
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '');
        return hay.includes(q);
      })
      .sort((a, b) =>
        sort === 'rating'
          ? b.version.rating - a.version.rating
          : sort === 'edition'
            ? b.version.year - a.version.year || b.version.rating - a.version.rating
            : b.card.acquiredAt - a.card.acquiredAt,
      );
  }, [cards, query, edition, iconsOnly, line, sort]);

  const editionYears = useMemo(
    () => [...new Set(Object.values(cards).map((c) => catalog.versions.get(c.versionId)!.year))].sort((a, b) => b - a),
    [cards],
  );
  const open = openId && cards[openId] ? resolve(cards[openId]) : null;

  return (
    <div className="club">
      <SectionHeader eyebrow="Mi club" title="Colección">
        <span className="tag tag--gold">{Object.keys(cards).length} cartas</span>
        <span className="tag">{new Set(Object.values(cards).map((c) => catalog.versions.get(c.versionId)!.playerId)).size} futbolistas</span>
      </SectionHeader>

      <div className="filters">
        <label className="search">
          <Icon.Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar jugador, club, nación…" aria-label="Buscar" />
        </label>
        <label className="select select--inline">
          <span className="t-ui">Edición</span>
          <select value={edition} onChange={(e) => setEdition(e.target.value)} aria-label="Edición">
            <option value="all">Todas</option>
            {editionYears.map((y) => (
              <option key={y} value={y}>
                {y} · {getEdition(y).name}
              </option>
            ))}
          </select>
        </label>
        <button className="toggle t-ui" data-on={iconsOnly} aria-pressed={iconsOnly} onClick={() => setIconsOnly((v) => !v)}>
          ★ Sólo Iconos
        </button>
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
        <Segmented<Sort>
          label="Orden"
          value={sort}
          onChange={setSort}
          options={[
            { id: 'rating', label: 'Media' },
            { id: 'edition', label: 'Edición' },
            { id: 'recent', label: 'Recientes' },
          ]}
        />
      </div>

      {list.length === 0 ? (
        <p className="empty-state">No hay cartas que coincidan con los filtros.</p>
      ) : (
        <div className="card-grid">
          {list.map((r) => (
            <div key={r.card.id} className="card-grid__item">
              <PlayerCard card={r.card} size="md" interactive tilt onClick={() => setOpenId(r.card.id)} />
              <div className="card-grid__flags">
                {inSquad.has(r.card.id) && <span className="tag tag--green">En plantilla</span>}
                {listed.has(r.card.id) && <span className="tag tag--blue">En venta</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Drawer open={!!open} onClose={() => setOpenId(null)} title={open ? open.player.knownAs : ''} wide>
        {open && <CardDetail cardId={open.card.id} inSquad={inSquad.has(open.card.id)} listed={listed.has(open.card.id)} onDone={() => setOpenId(null)} />}
      </Drawer>
    </div>
  );
}

function CardDetail({ cardId, inSquad, listed, onDone }: { cardId: string; inSquad: boolean; listed: boolean; onDone: () => void }) {
  const card = useGame((s) => s.cards[cardId]);
  const allCards = useGame((s) => s.cards);
  const { quickSell, listCard } = useGame.getState();
  const r = resolve(card);
  const range = priceRange(r.version.rating);
  const [price, setPrice] = useState(Math.round((range.min + range.max) / 2 / 100) * 100);
  const qs = quickSellValue(r.version.rating);
  const owned = new Set(Object.values(allCards).map((c) => c.versionId));
  const others = versionsOfPlayer(catalog, r.player.id);

  return (
    <div className="card-detail">
      <div className="card-detail__hero">
        <PlayerCard card={card} size="lg" tilt interactive />
        <div className="card-detail__info">
          <div className="card-detail__tags">
            <span className="tag tag--edition" style={editionStyle(r.version.year)}>
              Edición {getEdition(r.version.year).name} {r.version.year}
            </span>
            {r.player.icon && <span className="tag tag--icon">★ Icono</span>}
          </div>
          <h3 className="t-display">{r.player.fullName}</h3>
          <dl className="facts">
            <dt>Versión</dt>
            <dd>
              {versionLabel(r.version.label, r.version.season)}
            </dd>
            <dt>Club</dt>
            <dd>{r.club.name}</dd>
            <dt>Liga</dt>
            <dd>{r.league.name}</dd>
            <dt>Nación</dt>
            <dd>{r.nation.name}</dd>
            <dt>Posición</dt>
            <dd>
              {POSITION_LABELS[r.position]}
              {r.version.altPositions.length > 0 && ` · alt. ${r.version.altPositions.map((p) => POSITION_LABELS[p]).join(', ')}`}
            </dd>
            <dt>Lealtad</dt>
            <dd>{card.loyal ? 'Sí (+1 química)' : `${card.gamesPlayed}/10 partidos`}</dd>
            <dt>Origen</dt>
            <dd>{{ starter: 'Club inicial', pack: 'Sobre', market: 'Mercado', reward: 'Recompensa' }[card.source]}</dd>
          </dl>
          <div className="card-detail__status">
            {inSquad && <span className="tag tag--green">En plantilla</span>}
            {listed && <span className="tag tag--blue">En venta</span>}
            {card.untradeable && <span className="tag">Intransferible</span>}
          </div>
        </div>
      </div>

      <div className="card-detail__actions">
        <div className="action-box">
          <h4 className="t-ui">Venta rápida</h4>
          <p className="muted small">Se vende al instante al club.</p>
          <Button variant="danger" disabled={inSquad || listed} onClick={() => feedback(quickSell(cardId)) && onDone()}>
            Vender por <Coins value={qs} size="sm" />
          </Button>
        </div>
        <div className="action-box">
          <h4 className="t-ui">Mercado de traspasos</h4>
          <p className="muted small">
            Rango permitido {range.min.toLocaleString('es-ES')} – {range.max.toLocaleString('es-ES')}. Impuesto del 5 %.
          </p>
          <div className="price-input">
            <Icon.Coin size={16} />
            <input
              type="number"
              min={range.min}
              max={range.max}
              step={100}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              disabled={card.untradeable || inSquad || listed}
              aria-label="Precio de venta"
            />
          </div>
          <Button variant="gold" disabled={card.untradeable || inSquad || listed} onClick={() => feedback(listCard(cardId, price)) && onDone()}>
            Poner en venta
          </Button>
          {(inSquad || card.untradeable) && (
            <p className="muted small">{card.untradeable ? 'Las cartas iniciales y de recompensa son intransferibles.' : 'Retírala de la plantilla para venderla.'}</p>
          )}
        </div>
      </div>

      {others.length > 1 && (
        <div className="versions">
          <h4 className="t-ui">Versiones de {r.player.knownAs}</h4>
          <div className="versions__row">
            {others.map((v) => (
              <div key={v.id} className="versions__item" data-owned={owned.has(v.id)}>
                <PlayerCard versionId={v.id} size="sm" dim={!owned.has(v.id)} />
                <span className="t-ui small">{owned.has(v.id) ? 'En tu club' : 'No conseguida'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
