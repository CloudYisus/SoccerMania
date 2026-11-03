import type { ReactNode } from 'react';
import { getRarity, listRarities, PACKS } from '@fu/domain';
import { PlayerCard } from '../components/card/PlayerCard';
import { Icon } from '../components/ui/icons';
import { Coins, Meter } from '../components/ui/ui';
import { DEMO_DATA_NOTICE, version } from '../data/catalog';
import { CHALLENGES } from '../state/challenges';
import { DIVISION_SEASON_GAMES, PROMOTION_POINTS, useGame } from '../state/gameStore';
import { useSquadView } from '../state/squadView';
import { useUi, type Tab } from '../state/uiStore';
import { PackArt } from './packs/PackArt';
import './home.css';

function Tile({
  to,
  intent,
  className,
  eyebrow,
  title,
  children,
  art,
  cta,
}: {
  to: Tab;
  intent?: string;
  className?: string;
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
  art?: ReactNode;
  cta?: string;
}) {
  const go = useUi((s) => s.go);
  return (
    <button className={`tile ${className ?? ''}`} onClick={() => go(to, intent ?? null)}>
      <div className="tile__art" aria-hidden>
        {art}
      </div>
      <div className="tile__content">
        <span className="t-eyebrow">{eyebrow}</span>
        <h2 className="tile__title t-display">{title}</h2>
        {children}
      </div>
      <span className="tile__cta t-ui">
        {cta ?? 'Abrir'} <Icon.Chevron size={16} />
      </span>
    </button>
  );
}

function MiniPitch() {
  const view = useSquadView();
  return (
    <svg className="mini-pitch" viewBox="0 0 100 100" aria-hidden>
      <rect x="2" y="2" width="96" height="96" rx="3" className="mini-pitch__field" />
      <line x1="2" y1="50" x2="98" y2="50" className="mini-pitch__line" />
      <circle cx="50" cy="50" r="10" className="mini-pitch__line" />
      {view.chemistry.links.map((l) => {
        const a = view.formation.slots[l.a];
        const b = view.formation.slots[l.b];
        return (
          <line
            key={`${l.a}-${l.b}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            className="mini-pitch__link"
            data-strength={l.strength ?? 'empty'}
          />
        );
      })}
      {view.formation.slots.map((s) => (
        <circle key={s.index} cx={s.x} cy={s.y} r="3.4" className="mini-pitch__dot" data-filled={!!view.starters[s.index]} />
      ))}
    </svg>
  );
}

export function HomeScreen() {
  const view = useSquadView();
  const division = useGame((s) => s.division);
  const cards = useGame((s) => s.cards);
  const welcomeClaimed = useGame((s) => s.welcomeClaimed);
  const myListings = useGame((s) => s.myListings);
  const listings = useGame((s) => s.market.listings);
  const history = useGame((s) => s.history);
  const claimed = useGame((s) => s.challenges);
  const coins = useGame((s) => s.coins);

  const readyChallenges = CHALLENGES.filter((c) => {
    const p = c.evaluate(view);
    return !claimed[c.id] && p.current >= p.target;
  }).length;
  const openChallenges = CHALLENGES.filter((c) => !claimed[c.id]).length;
  const activeSales = myListings.filter((l) => l.status === 'active').length;
  const featured = [...listings].sort((a, b) => getRarity(version(b.versionId).version.rarity).tier - getRarity(version(a.versionId).version.rarity).tier)[0];
  const collectionCount = Object.keys(cards).length;
  const byRarity = listRarities().map((r) => ({
    r,
    n: Object.values(cards).filter((c) => version(c.versionId).version.rarity === r.id).length,
  }));
  const promoPack = welcomeClaimed ? PACKS.find((p) => p.id === 'premium')! : PACKS.find((p) => p.id === 'welcome')!;

  return (
    <div className="home">
      <div className="home__grid stagger">
        <Tile
          to="packs"
          className="tile--hero"
          eyebrow="Temporada 1 · Sobre destacado"
          title={
            <>
              Cada época.
              <br />
              <span className="t-gold">Cada leyenda.</span>
            </>
          }
          cta="Ver sobres"
          art={
            <div className="hero-fan">
              <PlayerCard versionId="maradona-icon" size="lg" className="hero-fan__card hero-fan__card--l" />
              <PlayerCard versionId="pele-icon" size="lg" className="hero-fan__card hero-fan__card--c" />
              <PlayerCard versionId="cruyff-icon" size="lg" className="hero-fan__card hero-fan__card--r" />
            </div>
          }
        >
          <p className="tile__text">
            Pelé, Maradona, Cruyff y los Iconos de cada generación llegan al Sobre Icono. Una carta, Icono garantizado.
          </p>
        </Tile>

        <Tile
          to="squad"
          className="tile--squad"
          eyebrow="Mi plantilla"
          title={view.formation.name}
          cta="Gestionar"
          art={<MiniPitch />}
        >
          <div className="tile__stats">
            <div>
              <span className="t-num tile__big">{view.rating}</span>
              <span className="t-ui muted">Valoración</span>
            </div>
            <div>
              <span className="t-num tile__big">{view.chemistry.team}</span>
              <span className="t-ui muted">Química</span>
            </div>
          </div>
        </Tile>

        <Tile to="compete" intent="divisions" className="tile--division" eyebrow="Divisiones" title={`División ${division.level}`} cta="Jugar">
          <div className="tile__progress">
            <div className="tile__progress-row t-ui">
              <span>
                {division.points} pts · {division.played}/{DIVISION_SEASON_GAMES} partidos
              </span>
              <span className="muted">Ascenso {PROMOTION_POINTS} pts</span>
            </div>
            <Meter value={division.points} max={PROMOTION_POINTS} tone="green" label="Puntos para ascender" />
          </div>
          <div className="tile__division-crest" aria-hidden>
            <span className="t-display">{division.level}</span>
          </div>
        </Tile>

        <Tile
          to="market"
          className="tile--market"
          eyebrow="Mercado de traspasos"
          title="Fichajes"
          cta="Explorar"
          art={featured && <PlayerCard versionId={featured.versionId} size="sm" className="tile__floating-card" />}
        >
          <p className="tile__text">
            {listings.length} jugadores disponibles
            {activeSales > 0 ? ` · ${activeSales} ventas activas` : ''}
          </p>
          {featured && (
            <div className="tile__price">
              <span className="t-ui muted">Destacado</span>
              <Coins value={featured.price} size="sm" />
            </div>
          )}
        </Tile>

        <Tile to="compete" intent="challenges" className="tile--challenges" eyebrow="Desafíos de plantilla" title="Objetivos" cta="Ver desafíos">
          <p className="tile__text">
            {readyChallenges > 0 ? (
              <span className="tag tag--green">
                <Icon.Check size={13} /> {readyChallenges} listo{readyChallenges > 1 ? 's' : ''} para reclamar
              </span>
            ) : (
              `${openChallenges} desafíos activos con recompensa en monedas`
            )}
          </p>
        </Tile>

        <Tile
          to="packs"
          className="tile--pack"
          eyebrow={welcomeClaimed ? 'Tienda' : 'Regalo de bienvenida'}
          title={promoPack.name}
          cta={promoPack.price === 0 ? 'Abrir gratis' : 'Comprar'}
          art={<PackArt pack={promoPack} size="sm" />}
        >
          <p className="tile__text">{promoPack.tagline}</p>
          {promoPack.price > 0 && <Coins value={promoPack.price} size="sm" />}
        </Tile>

        <Tile to="club" className="tile--club" eyebrow="Mi club" title={`${collectionCount} cartas`} cta="Ver club">
          <div className="rarity-bars">
            {byRarity.map(({ r, n }) => (
              <div key={r.id} className="rarity-bars__row" data-rarity={r.id}>
                <span className="t-ui">{r.label}</span>
                <span className="rarity-bars__bar">
                  <span style={{ width: `${Math.min(100, (n / Math.max(1, collectionCount)) * 100 * 2)}%` }} />
                </span>
                <span className="t-num">{n}</span>
              </div>
            ))}
          </div>
        </Tile>

        <Tile to="compete" className="tile--results" eyebrow="Competir" title="Últimos partidos" cta="Competir">
          {history.length === 0 ? (
            <p className="tile__text">Aún no has jugado. Empieza con un partido rápido o tu primera temporada en Divisiones.</p>
          ) : (
            <ul className="results">
              {history.slice(0, 3).map((h) => {
                const res = h.goalsFor > h.goalsAgainst || (h.penalties && h.penalties.for > h.penalties.against) ? 'V' : h.goalsFor === h.goalsAgainst && !h.penalties ? 'E' : 'D';
                return (
                  <li key={h.id}>
                    <span className={`results__mark results__mark--${res}`}>{res}</span>
                    <span className="results__opp">{h.opponent}</span>
                    <span className="t-num">
                      {h.goalsFor}–{h.goalsAgainst}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Tile>
      </div>
      <footer className="home__footer">
        <span className="demo-note">{DEMO_DATA_NOTICE}</span>
        <span className="demo-note">
          Saldo <Coins value={coins} size="sm" />
        </span>
      </footer>
    </div>
  );
}
