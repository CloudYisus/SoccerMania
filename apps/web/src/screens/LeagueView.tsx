import { useMemo } from 'react';
import { PLAY_STYLES } from '@fu/domain';
import { PlayerCard } from '../components/card/PlayerCard';
import { Icon } from '../components/ui/icons';
import { Button, Segmented } from '../components/ui/ui';
import { catalog, resolve } from '../data/catalog';
import { TREATMENT_COST, useGame } from '../state/gameStore';
import {
  analystPlan,
  createSeason,
  LEAGUE_ROUNDS,
  LEAGUE_TEAMS,
  leagueTable,
  matchContext,
  PRESS,
  rivalTeam,
  teamById,
  TRAINING,
  USER_TEAM,
  userFixture,
  WEATHER,
  type PressId,
  type TrainingId,
} from '../state/league';
import { feedback, type MatchRequest } from '../state/uiStore';
import './league.css';

const FORM_LABEL = { W: 'V', D: 'E', L: 'D' } as const;

/** Centro de la Liga: previa, preparación de la semana, clasificación y goleadores. */
export function LeagueView({ canPlay, onPlay }: { canPlay: boolean; onPlay: (m: MatchRequest) => void }) {
  const division = useGame((s) => s.division);
  const squadName = useGame((s) => s.squad.name);
  const injuries = useGame((s) => s.injuries);
  const cards = useGame((s) => s.cards);
  const tactics = useGame((s) => s.squad.tactics);
  const season = useMemo(
    () => (division.season && division.season.level === division.level ? division.season : createSeason(division.level, division.rivals ?? 'mix', 1, squadName)),
    [division.season, division.level, division.rivals, squadName],
  );
  const table = useMemo(() => leagueTable(season), [season]);
  const fx = userFixture(season);
  const rivalId = fx ? (fx.home === USER_TEAM ? fx.away : fx.home) : null;
  const rival = useMemo(() => (rivalId ? rivalTeam(season, rivalId) : null), [season, rivalId]);
  const ctx = useMemo(() => matchContext(season), [season]);
  const rivalStyle = rival?.tactics.style ?? 'balanced';
  const plan = analystPlan(rivalStyle);
  const rivalRow = table.find((r) => r.id === rivalId);
  const rivalPos = table.findIndex((r) => r.id === rivalId) + 1;
  const userPos = table.findIndex((r) => r.id === USER_TEAM) + 1;
  const star = rival ? [...rival.versionIds].sort((a, b) => catalog.versions.get(b)!.rating - catalog.versions.get(a)!.rating)[0] : null;
  const scorers = Object.values(season.scorers)
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 6);
  const injured = Object.entries(injuries).filter(([id]) => cards[id]);
  const finalAvailable = season.round >= LEAGUE_ROUNDS - 3 || rivalPos <= 2;
  const setPlan = useGame((s) => s.setLeaguePlan);
  const lastRound = season.fixtures.filter((f) => f.round === season.round - 1 && f.hg !== undefined);

  const play = () => {
    if (!rival || !fx || !ctx) return;
    onPlay({
      mode: 'division',
      opponent: rival,
      difficulty: rival.difficulty,
      title: `División ${season.level} · ${ctx.round}`,
      context: ctx,
    });
  };

  return (
    <div className="league">
      <section className="league__head panel">
        <div className="league__badge">
          <span className="t-eyebrow">División</span>
          <span className="league__num t-display">{season.level}</span>
          <span className="muted small">Mejor: División {division.best}</span>
        </div>
        <div className="league__meta">
          <div className="league__row t-ui">
            <span>Temporada {season.season}</span>
            <span>
              Jornada {Math.min(season.round + 1, LEAGUE_ROUNDS)} de {LEAGUE_ROUNDS}
            </span>
          </div>
          <div className="league__games">
            {Array.from({ length: LEAGUE_ROUNDS }, (_, i) => (
              <span key={i} data-played={i < season.round} data-now={i === season.round} />
            ))}
          </div>
          <div className="league__row small">
            <span>
              Posición: <b className="t-gold">{userPos}º</b> de {LEAGUE_TEAMS}
            </span>
            <span className="league__morale" data-v={season.morale}>
              Moral del vestuario:{' '}
              <b>
                {season.morale > 0 ? '+' : ''}
                {season.morale}
              </b>{' '}
              {season.morale >= 2 ? '🔥' : season.morale <= -2 ? '🥶' : season.morale > 0 ? '🙂' : season.morale < 0 ? '😕' : '😐'}
            </span>
          </div>
          <span className="muted small">Ascienden los 2 primeros · descienden los 2 últimos · el líder de División 1 es campeón.</span>
          {division.lastOutcome && (
            <span className={`tag ${division.lastOutcome === 'promoted' ? 'tag--green' : division.lastOutcome === 'relegated' ? 'tag--red' : ''}`}>
              Última temporada: {{ promoted: 'Ascenso', relegated: 'Descenso', stayed: 'Permanencia' }[division.lastOutcome]}
            </span>
          )}
        </div>
        {season.round === 0 && (
          <div className="league__rivals">
            <span className="t-ui muted">Rivales</span>
            <Segmented<'mix' | 'real'>
              label="Rivales"
              value={division.rivals ?? 'mix'}
              onChange={(v) => feedback(useGame.getState().setDivisionRivals(v))}
              options={[
                { id: 'mix', label: 'Equipos mixtos' },
                { id: 'real', label: 'Clubes reales' },
              ]}
            />
          </div>
        )}
      </section>

      <div className="league__grid">
        <div className="league__main">
          {fx && rival && ctx && rivalId && (
            <section className="preview panel" style={{ '--team-a': rival.colors.primary, '--team-b': rival.colors.secondary } as React.CSSProperties}>
              <div className="preview__band" data-w={fx.weather} />
              <header className="preview__head">
                <span className="t-eyebrow">Previa · {ctx.round}</span>
                <h3 className="t-display">
                  {fx.home === USER_TEAM ? squadName : rival.name} <span className="muted">vs</span> {fx.home === USER_TEAM ? rival.name : squadName}
                </h3>
                <p className="preview__stakes">{ctx.stakes}</p>
              </header>
              <div className="preview__facts">
                <div>
                  <span className="t-ui muted">Estadio</span>
                  <b>{ctx.stadium}</b>
                  <small className="muted">{ctx.userHome ? 'Juegas en casa' : 'Juegas fuera'}</small>
                </div>
                <div>
                  <span className="t-ui muted">Clima</span>
                  <b>
                    {WEATHER[fx.weather].icon} {WEATHER[fx.weather].label}
                  </b>
                  <small className="muted">{WEATHER[fx.weather].effect}</small>
                </div>
                <div>
                  <span className="t-ui muted">Aforo</span>
                  <b>{fx.attendance}%</b>
                  <small className="muted">{fx.attendance >= 90 ? 'Lleno absoluto' : fx.attendance >= 75 ? 'Gran ambiente' : 'Grada a medio llenar'}</small>
                </div>
              </div>
              <div className="preview__scout">
                <div className="preview__rival">
                  <span className="t-ui muted">Informe del rival</span>
                  <b className="t-display">{rival.name}</b>
                  <span className="small">
                    {rivalPos}º · {rivalRow?.pts ?? 0} pts · Media {rival.rating} · {rival.formationId}
                  </span>
                  <span className="small" title={PLAY_STYLES[rivalStyle].description}>
                    Estilo: <b>{PLAY_STYLES[rivalStyle].label}</b>
                  </span>
                  <span className="preview__form">
                    Forma:{' '}
                    {rivalRow?.form.length
                      ? rivalRow.form.slice(-3).map((f, i) => (
                          <i key={i} data-r={f}>
                            {FORM_LABEL[f]}
                          </i>
                        ))
                      : <span className="muted">sin partidos</span>}
                  </span>
                </div>
                {star && (
                  <div className="preview__star">
                    <PlayerCard versionId={star} size="xs" />
                    <span className="t-ui small">Jugador a seguir</span>
                  </div>
                )}
              </div>
              <div className="preview__analyst">
                <span className="t-ui">🧠 Analista</span>
                <p>{plan.tip}</p>
                <Button
                  size="sm"
                  variant={tactics.style === plan.style ? 'ghost' : 'primary'}
                  disabled={tactics.style === plan.style}
                  onClick={() => {
                    useGame.getState().setTactics({ style: plan.style });
                    feedback({ ok: true, message: `Plan aplicado: estilo ${PLAY_STYLES[plan.style].label}` });
                  }}
                >
                  {tactics.style === plan.style ? `Plan aplicado (${PLAY_STYLES[plan.style].label})` : `Aplicar plan: ${PLAY_STYLES[plan.style].label}`}
                </Button>
              </div>
            </section>
          )}

          <section className="prep panel">
            <h3 className="t-ui">Semana de preparación</h3>
            <div className="prep__block">
              <span className="t-ui muted">Entrenamiento</span>
              <div className="prep__chips">
                {(Object.keys(TRAINING) as TrainingId[]).map((id) => (
                  <button key={id} className="prep__chip" data-on={season.plan.training === id} onClick={() => setPlan({ training: season.plan.training === id ? null : id })} title={TRAINING[id].text}>
                    <b>{TRAINING[id].label}</b>
                    <small>{TRAINING[id].text}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="prep__block">
              <span className="t-ui muted">Rueda de prensa</span>
              <div className="prep__chips">
                {(Object.keys(PRESS) as PressId[])
                  .filter((id) => id !== 'final' || finalAvailable)
                  .map((id) => (
                    <button key={id} className="prep__chip prep__chip--press" data-on={season.plan.press === id} onClick={() => setPlan({ press: season.plan.press === id ? null : id })}>
                      <b>{PRESS[id].label}</b>
                      <q>{PRESS[id].quote.replace(/[«»]/g, '')}</q>
                      <small>{PRESS[id].text}</small>
                    </button>
                  ))}
              </div>
            </div>
            {ctx && ctx.notes.length > 0 && (
              <ul className="prep__notes small">
                {ctx.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
            {injured.length > 0 && (
              <div className="prep__block">
                <span className="t-ui muted">Enfermería</span>
                <ul className="prep__injuries">
                  {injured.map(([id, n]) => {
                    const r = resolve(cards[id]);
                    return (
                      <li key={id}>
                        <span>
                          🚑 <b>{r.player.knownAs}</b> · {n} {n === 1 ? 'partido' : 'partidos'} de baja
                        </span>
                        <Button size="sm" variant="ghost" onClick={() => feedback(useGame.getState().treatInjury(id))}>
                          Tratamiento ({TREATMENT_COST.toLocaleString('es-ES')})
                        </Button>
                      </li>
                    );
                  })}
                </ul>
                <span className="muted small">Los lesionados no juegan: entra el mejor suplente de su línea.</span>
              </div>
            )}
            <Button variant="gold" size="lg" icon={<Icon.Play size={14} />} disabled={!canPlay || !rival} onClick={play}>
              Jugar {ctx?.round.toLowerCase() ?? 'jornada'}
            </Button>
          </section>
        </div>

        <aside className="league__side">
          <section className="panel">
            <h3 className="t-ui">Clasificación</h3>
            <table className="ltable">
              <thead>
                <tr>
                  <th>#</th>
                  <th className="ltable__team">Equipo</th>
                  <th>PJ</th>
                  <th>DG</th>
                  <th>Pts</th>
                  <th className="ltable__form">Forma</th>
                </tr>
              </thead>
              <tbody>
                {table.map((r, i) => {
                  const t = teamById(season, r.id);
                  return (
                    <tr key={r.id} data-me={r.id === USER_TEAM} data-zone={i < 2 ? 'up' : i >= LEAGUE_TEAMS - 2 ? 'down' : undefined} data-next={r.id === rivalId}>
                      <td className="t-num">{i + 1}</td>
                      <td className="ltable__team">
                        <span className="ltable__kit" style={{ background: t.colors.primary, borderColor: t.colors.secondary }} />
                        {t.name}
                      </td>
                      <td className="t-num">{r.p}</td>
                      <td className="t-num">{r.gf - r.ga > 0 ? `+${r.gf - r.ga}` : r.gf - r.ga}</td>
                      <td className="t-num">
                        <b>{r.pts}</b>
                      </td>
                      <td className="ltable__form">
                        {r.form.slice(-3).map((f, k) => (
                          <i key={k} data-r={f}>
                            {FORM_LABEL[f]}
                          </i>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
          {lastRound.length > 0 && (
            <section className="panel">
              <h3 className="t-ui">Resultados · Jornada {season.round}</h3>
              <ul className="lresults">
                {lastRound.map((f) => (
                  <li key={f.home} data-me={f.home === USER_TEAM || f.away === USER_TEAM}>
                    <span>{teamById(season, f.home).name}</span>
                    <b className="t-num">
                      {f.hg} – {f.ag}
                    </b>
                    <span>{teamById(season, f.away).name}</span>
                  </li>
                ))}
              </ul>
              {season.news.length > 0 && <p className="muted small">{season.news[0]}</p>}
            </section>
          )}
          <section className="panel">
            <h3 className="t-ui">Goleadores</h3>
            {scorers.length ? (
              <ol className="lscorers">
                {scorers.map((g) => (
                  <li key={`${g.teamId}${g.name}`} data-me={g.teamId === USER_TEAM}>
                    <span>{g.name}</span>
                    <small className="muted">{teamById(season, g.teamId)?.name}</small>
                    <b className="t-num">{g.goals}</b>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted small">Aún no se ha marcado ningún gol esta temporada.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
