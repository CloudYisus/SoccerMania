import { useMemo, useState } from 'react';
import { POSITION_LINE, type PlayerVersion, type PositionLine } from '@fu/domain';
import { PlayerCard } from '../components/card/PlayerCard';
import { SectionHeader, Segmented } from '../components/ui/ui';
import { allVersions, catalog } from '../data/catalog';
import { useGame } from '../state/gameStore';
import { useUi } from '../state/uiStore';
import { MATCHES_PER_WEEK, normalizeWorld } from '../state/world';
import './collections.css';

type View = 'totw' | 'events' | 'icons' | 'heroes' | 'wc2010' | 'legends';

const GROUPS: { title: string; kinds: string[] }[] = [
  { title: 'Promociones', kinds: ['tormenta', 'gala', 'promesas'] },
  { title: 'Equipo de la Temporada', kinds: ['tots'] },
  { title: 'Equipo del Año', kinds: ['toty'] },
  { title: 'Onces de torneos', kinds: ['mundial', 'euro'] },
];
const LINES: { id: PositionLine; label: string }[] = [
  { id: 'attack', label: 'Delanteros' },
  { id: 'midfield', label: 'Centrocampistas' },
  { id: 'defence', label: 'Defensas' },
  { id: 'goalkeeper', label: 'Porteros' },
];

/** Colecciones: equipos especiales, Iconos, Mundial 2010 y grandes temporadas. */
export function CollectionsScreen() {
  const [view, setView] = useState<View>('totw');
  const events = useMemo(() => [...catalog.events.values()], []);
  const [eventId, setEventId] = useState(events[0]?.id ?? '');
  const cards = useGame((s) => s.cards);
  const owned = useMemo(() => new Set(Object.values(cards).map((c) => c.versionId)), [cards]);

  const lists: Record<Exclude<View, 'events' | 'totw'>, { title: string; text: string; versions: PlayerVersion[] }> = useMemo(
    () => ({
      icons: {
        title: 'Iconos',
        text: 'Leyendas retiradas. Todas sus cartas llevan el borde interno blanco, sea cual sea su versión.',
        versions: allVersions.filter((v) => catalog.players.get(v.playerId)!.icon).sort((a, b) => b.rating - a.rating),
      },
      heroes: {
        title: 'Históricos',
        text: 'Retirados con etapas inolvidables: temporadas récord, títulos inesperados y grandes torneos. Ribete bronce y sello HISTÓRICO en todas sus cartas.',
        versions: allVersions.filter((v) => catalog.players.get(v.playerId)!.hero).sort((a, b) => b.rating - a.rating),
      },
      wc2010: {
        title: 'Mundial 2010',
        text: 'Los destacados de Sudáfrica 2010, con el diseño de la edición 2010.',
        versions: allVersions.filter((v) => v.season === '2010').sort((a, b) => b.rating - a.rating),
      },
      legends: {
        title: 'Grandes temporadas',
        text: 'Versiones de temporadas pasadas de futbolistas no Icono: cada año con su propio diseño.',
        versions: allVersions
          .filter((v) => !v.event && v.year < 2026 && v.season !== '2010' && !catalog.players.get(v.playerId)!.icon && !catalog.players.get(v.playerId)!.hero)
          .sort((a, b) => b.year - a.year || b.rating - a.rating),
      },
    }),
    [],
  );

  return (
    <div className="collections">
      <SectionHeader eyebrow="Colecciones" title={view === 'events' ? 'Equipos especiales' : view === 'totw' ? 'Equipo de la Semana' : lists[view].title}>
        <Segmented<View>
          label="Colección"
          value={view}
          onChange={setView}
          options={[
            { id: 'totw', label: 'Equipo de la Semana' },
            { id: 'events', label: 'Eventos' },
            { id: 'icons', label: 'Iconos' },
            { id: 'heroes', label: 'Históricos' },
            { id: 'wc2010', label: 'Mundial 2010' },
            { id: 'legends', label: 'Grandes temporadas' },
          ]}
        />
      </SectionHeader>
      {view === 'totw' ? (
        <TotwView owned={owned} />
      ) : view === 'events' ? (
        <>
          <div className="coll-events">
            {GROUPS.map((g) => (
              <div key={g.title} className="coll-events__group">
                <span className="t-eyebrow">{g.title}</span>
                <div className="coll-events__chips">
                  {events
                    .filter((e) => g.kinds.includes(e.kind))
                    .map((e) => {
                      const vs = allVersions.filter((v) => v.event === e.id);
                      const have = vs.filter((v) => owned.has(v.id)).length;
                      return (
                        <button key={e.id} className="coll-chip" data-kind={e.kind} data-on={e.id === eventId} onClick={() => setEventId(e.id)}>
                          <b>{e.kind === 'tots' ? `${catalog.leagues.get(e.leagueId ?? '')?.name} ${e.year - 1}/${String(e.year).slice(-2)}` : e.name}</b>
                          <small className="t-ui">
                            {have}/{vs.length}
                          </small>
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
          <EventTeam eventId={eventId} owned={owned} />
        </>
      ) : (
        <Gallery text={lists[view].text} versions={lists[view].versions} owned={owned} />
      )}
    </div>
  );
}

function TotwView({ owned }: { owned: Set<string> }) {
  const world = useGame((s) => s.world);
  const inForm = useGame((s) => s.inForm);
  const go = useUi((s) => s.go);
  const w = normalizeWorld(world);
  const left = MATCHES_PER_WEEK - w.matchesThisWeek;
  if (!w.totw.length) {
    return (
      <section className="coll-team panel" data-kind="totw">
        <h3 className="t-display">Aún no hay Equipo de la Semana</h3>
        <p className="muted">
          Cada semana se juega una jornada en todas las ligas del juego. Con esos rendimientos y con los de tus partidos se elige el once de la semana. La semana se cierra con cada
          jornada de Liga o cada {MATCHES_PER_WEEK} partidos en otros modos.
        </p>
        <p className="muted small">
          Si uno de tus jugadores brilla (nota de 8 o más), entra en el equipo y jugará el siguiente partido con su carta En Forma. Las cartas En Forma de cada semana también salen en
          sobres y en el mercado.
        </p>
      </section>
    );
  }
  const results = w.results.filter((r) => ['eng-premier', 'esp-laliga', 'ita-serie-a', 'ger-bundesliga', 'fra-ligue-1'].includes(r.leagueId));
  const mine = Object.values(inForm);
  return (
    <section className="coll-team panel" data-kind="totw">
      <header className="coll-team__head">
        <div>
          <h3 className="t-display">Equipo de la Semana · Semana {w.totwWeek}</h3>
          <p className="muted">
            Los mejores de la última jornada del juego. Sus cartas En Forma (negras) salen en sobres y en el mercado mientras dure la semana; si las consigues, son tuyas para siempre.
          </p>
          <p className="muted small">
            Próxima semana: {left > 0 ? `se cierra con tu próxima jornada de Liga o tras ${left} ${left === 1 ? 'partido' : 'partidos'} más.` : 'se cierra con tu próximo partido.'}
          </p>
        </div>
        <div className="coll-team__progress">
          <button className="link-btn t-ui" onClick={() => go('market')}>
            Buscar en el mercado
          </button>
        </div>
      </header>
      {LINES.map((l) => {
        const row = w.totw.filter((e) => POSITION_LINE[catalog.versions.get(e.ifId)!.position] === l.id);
        if (!row.length) return null;
        return (
          <div key={l.id} className="coll-team__line">
            <span className="t-ui muted">{l.label}</span>
            <div className="coll-team__cards">
              {row.map((e) => (
                <div key={e.ifId} className="coll-card totw-card" data-owned={owned.has(e.ifId)} data-user={!!e.cardId}>
                  <PlayerCard versionId={e.ifId} size="md" interactive tilt />
                  <span className="totw-card__score t-num">{e.score.toFixed(1)}</span>
                  <span className="t-ui small">{e.line}</span>
                  {e.cardId && <span className="tag tag--gold">{mine.includes(e.ifId) ? 'Tu jugador · En Forma el próximo partido' : 'Tu jugador'}</span>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {results.length > 0 && (
        <div className="totw-results">
          <span className="t-ui muted">Resultados de la jornada · grandes ligas</span>
          <ul>
            {results.map((r) => (
              <li key={r.home + r.away}>
                <span>{catalog.clubs.get(r.home)!.name}</span>
                <b className="t-num">
                  {r.hg} – {r.ag}
                </b>
                <span>{catalog.clubs.get(r.away)!.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function EventTeam({ eventId, owned }: { eventId: string; owned: Set<string> }) {
  const ev = catalog.events.get(eventId);
  const go = useUi((s) => s.go);
  if (!ev) return null;
  const vs = allVersions.filter((v) => v.event === ev.id);
  const have = vs.filter((v) => owned.has(v.id)).length;
  return (
    <section className="coll-team panel" data-kind={ev.kind}>
      <header className="coll-team__head">
        <div>
          <h3 className="t-display">{ev.name}</h3>
          <p className="muted">{ev.description}</p>
        </div>
        <div className="coll-team__progress">
          <b className="t-num">
            {have}/{vs.length}
          </b>
          <span className="t-ui muted">conseguidas</span>
          <button className="link-btn t-ui" onClick={() => go('market')}>
            Buscar en el mercado
          </button>
        </div>
      </header>
      {LINES.map((l) => {
        const row = vs.filter((v) => POSITION_LINE[v.position] === l.id).sort((a, b) => b.rating - a.rating);
        if (!row.length) return null;
        return (
          <div key={l.id} className="coll-team__line">
            <span className="t-ui muted">{l.label}</span>
            <div className="coll-team__cards">
              {row.map((v) => (
                <div key={v.id} className="coll-card" data-owned={owned.has(v.id)}>
                  <PlayerCard versionId={v.id} size="md" dim={!owned.has(v.id)} interactive tilt />
                  <span className="t-ui small">{owned.has(v.id) ? 'En tu club' : 'No conseguida'}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function Gallery({ text, versions, owned }: { text: string; versions: PlayerVersion[]; owned: Set<string> }) {
  return (
    <section className="coll-gallery">
      <p className="muted">
        {text} · {versions.filter((v) => owned.has(v.id)).length}/{versions.length} conseguidas
      </p>
      <div className="card-grid">
        {versions.map((v) => (
          <div key={v.id} className="coll-card" data-owned={owned.has(v.id)}>
            <PlayerCard versionId={v.id} size="md" dim={!owned.has(v.id)} interactive tilt />
            <span className="t-ui small">{owned.has(v.id) ? 'En tu club' : 'No conseguida'}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
