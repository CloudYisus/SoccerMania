import { useEffect, useMemo, useState } from 'react';
import { PLAY_STYLES } from '@fu/domain';
import { PlayerCard } from '../components/card/PlayerCard';
import { Icon } from '../components/ui/icons';
import { Button, Coins, Meter, SectionHeader, Segmented } from '../components/ui/ui';
import { CHALLENGES } from '../state/challenges';
import { catalog } from '../data/catalog';
import { CUP_ROUNDS, useGame } from '../state/gameStore';
import { LeagueView } from './LeagueView';
import { DraftView } from './DraftView';
import { useSquadView } from '../state/squadView';
import { buildOpponent, clubTeam, QUICK_OPPONENTS, REAL_CLUBS, type TeamBuild } from '../state/teams';
import { TOURNAMENTS, tournamentById } from '../state/tournaments';
import { buildCupTeam, normalizeCup, teamOf, USER_ID, userFixture, type RivalMode } from '../state/cup';
import { CupBracket, CupStats } from './CupView';
import { feedback, useUi, type MatchRequest } from '../state/uiStore';
import './compete.css';

type Mode = 'quick' | 'divisions' | 'cup' | 'draft' | 'challenges';

function Stars({ n }: { n: number }) {
  return (
    <span className="stars" aria-label={`Dificultad ${n} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon.Star key={i} size={13} data-on={i <= n} />
      ))}
    </span>
  );
}

function TeamPanel({ team, cta, onPlay, disabled, extra }: { team: TeamBuild; cta: string; onPlay: () => void; disabled?: boolean; extra?: React.ReactNode }) {
  const stars = [...team.versionIds].sort((a, b) => catalog.versions.get(b)!.rating - catalog.versions.get(a)!.rating).slice(0, 3);
  return (
    <article className="team-panel" style={{ '--team-a': team.colors.primary, '--team-b': team.colors.secondary } as React.CSSProperties}>
      <div className="team-panel__band" />
      <header className="team-panel__head">
        <div className="team-panel__badge t-display">{team.shortName.slice(0, 2)}</div>
        <div>
          <h3 className="t-display">{team.name}</h3>
          <span className="muted small">{team.description}</span>
          <span className="team-panel__style t-ui" title={PLAY_STYLES[team.tactics.style ?? 'balanced'].description}>
            Estilo: {PLAY_STYLES[team.tactics.style ?? 'balanced'].label}
          </span>
        </div>
      </header>
      <div className="team-panel__stats">
        <div>
          <b className="t-num">{team.rating}</b>
          <span className="t-ui">Media</span>
        </div>
        <div>
          <b className="t-num">{team.chemistry}</b>
          <span className="t-ui">Química</span>
        </div>
        <div>
          <b className="t-num">{team.formationId}</b>
          <span className="t-ui">Formación</span>
        </div>
        <div>
          <Stars n={team.difficulty} />
          <span className="t-ui">Dificultad</span>
        </div>
      </div>
      <div className="team-panel__cards">
        {stars.map((v) => (
          <PlayerCard key={v} versionId={v} size="xs" />
        ))}
      </div>
      {extra}
      <Button variant="gold" icon={<Icon.Play size={14} />} disabled={disabled} onClick={onPlay}>
        {cta}
      </Button>
    </article>
  );
}

export function CompeteScreen() {
  const intent = useUi((s) => s.intent);
  const clearIntent = useUi((s) => s.clearIntent);
  const [mode, setMode] = useState<Mode>('quick');
  useEffect(() => {
    if (intent === 'divisions' || intent === 'challenges' || intent === 'cup' || intent === 'quick' || intent === 'draft') {
      setMode(intent);
      clearIntent();
    }
  }, [intent, clearIntent]);

  const view = useSquadView();
  const startMatch = useUi((s) => s.startMatch);
  const go = useUi((s) => s.go);
  const tournaments = useGame((s) => s.tournaments);
  const [tid, setTid] = useState<string>('ultimate');
  const tdef = tournamentById(tid);
  const cup = normalizeCup(tournaments[tid], tid);
  const [tMode, setTMode] = useState<RivalMode>(tdef.modes[0]);
  useEffect(() => setTMode(tdef.modes[0]), [tdef]);
  const [qLeague, setQLeague] = useState<string>('esp-laliga');
  const coins = useGame((s) => s.coins);
  const claimed = useGame((s) => s.challenges);

  const play = (m: MatchRequest) => {
    if (!view.complete) {
      useUi.getState().toast('error', 'Completa los 11 titulares antes de jugar.');
      return;
    }
    startMatch(m);
  };

  const quickTeams = useMemo(() => QUICK_OPPONENTS.map(buildOpponent), []);
  const quickClubs = useMemo(
    () =>
      REAL_CLUBS.filter((c) => c.leagueId === qLeague)
        .map((c) => clubTeam(c.id))
        .sort((a, b) => b.rating - a.rating),
    [qLeague],
  );
  const quickLeagues = useMemo(() => [...new Set(REAL_CLUBS.map((c) => c.leagueId))].map((id) => catalog.leagues.get(id)!), []);
  const cupFx = cup.status === 'running' ? userFixture(cup) : undefined;
  const cupOppId = cupFx ? (cupFx.home === USER_ID ? cupFx.away : cupFx.home) : null;
  const cupOpp = useMemo(() => {
    const ref = cupOppId ? teamOf(cup, cupOppId) : undefined;
    return ref?.source ? buildCupTeam(ref) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cupOppId, cup.edition, tid]);

  return (
    <div className="compete">
      <SectionHeader eyebrow="Competir" title={{ quick: 'Partido rápido', divisions: 'Liga', cup: 'Torneos', draft: 'Mundial Draft', challenges: 'Desafíos' }[mode]}>
        <Segmented<Mode>
          label="Modo"
          value={mode}
          onChange={setMode}
          options={[
            { id: 'quick', label: 'Partido rápido' },
            { id: 'divisions', label: 'Liga' },
            { id: 'cup', label: 'Torneos' },
            { id: 'draft', label: 'Draft' },
            { id: 'challenges', label: 'Desafíos' },
          ]}
        />
      </SectionHeader>

      {!view.complete && mode !== 'challenges' && mode !== 'draft' && (
        <div className="notice">
          <span>Tu once está incompleto. Necesitas 11 titulares para competir.</span>
          <Button size="sm" variant="primary" onClick={() => go('squad')}>
            Ir a plantilla
          </Button>
        </div>
      )}

      {mode !== 'draft' && (
      <div className="my-team-strip">
        <span className="t-ui muted">Tu equipo</span>
        <b className="t-num">{view.rating}</b>
        <span className="t-ui muted">media</span>
        <b className="t-num">{view.chemistry.team}</b>
        <span className="t-ui muted">química</span>
        <b className="t-num">{view.formation.name}</b>
        <button className="link-btn t-ui" onClick={() => go('squad', 'tactics')}>
          Tácticas <Icon.Chevron size={14} />
        </button>
      </div>
      )}

      {mode === 'quick' && (
        <>
          <h3 className="compete__sub t-ui">Equipos mixtos</h3>
          <div className="team-grid stagger">
            {quickTeams.map((t) => (
              <TeamPanel
                key={t.id}
                team={t}
                cta="Jugar amistoso"
                disabled={!view.complete}
                onPlay={() => play({ mode: 'quick', opponent: t, difficulty: t.difficulty, title: 'Partido rápido' })}
              />
            ))}
          </div>
          <div className="compete__subrow">
            <h3 className="compete__sub t-ui">Clubes reales</h3>
            <label className="select select--inline">
              <span className="t-ui">Liga</span>
              <select value={qLeague} onChange={(e) => setQLeague(e.target.value)} aria-label="Liga">
                {quickLeagues.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="team-grid">
            {quickClubs.map((t) => (
              <TeamPanel
                key={t.id}
                team={t}
                cta="Jugar amistoso"
                disabled={!view.complete}
                onPlay={() => play({ mode: 'quick', opponent: t, difficulty: t.difficulty, title: `Amistoso · ${t.name}` })}
              />
            ))}
          </div>
        </>
      )}

      {mode === 'divisions' && <LeagueView canPlay={view.complete} onPlay={play} />}

      {mode === 'draft' && <DraftView onPlay={startMatch} />}

      {mode === 'cup' && (
        <div className="cup">
          <div className="tourney-grid">
            {TOURNAMENTS.map((t) => {
              const st = normalizeCup(tournaments[t.id], t.id);
              return (
                <button key={t.id} className="tourney" data-on={t.id === tid} style={{ '--t-accent': t.accent } as React.CSSProperties} onClick={() => setTid(t.id)}>
                  <Icon.Trophy size={22} />
                  <b className="t-display">{t.name}</b>
                  <span className="muted small">{t.description}</span>
                  <span className="tourney__meta t-ui">
                    {st.status === 'running' ? `En juego · ${CUP_ROUNDS[userFixture(st)?.round ?? 0]}` : `Premio ${t.prize.toLocaleString('es-ES')}`}
                    {st.titles > 0 && ` · ${st.titles} 🏆`}
                  </span>
                </button>
              );
            })}
          </div>
          {cup.status === 'running' && cupOpp && cupFx ? (
            <TeamPanel
              team={cupOpp}
              cta={`Jugar ${CUP_ROUNDS[cupFx.round].toLowerCase()}`}
              disabled={!view.complete}
              extra={<p className="muted small">{tdef.name} · {CUP_ROUNDS[cupFx.round]} · edición {cup.edition} · rivales {cup.mode === 'real' ? 'reales' : 'mixtos'}. Partido único: si hay empate, penaltis.</p>}
              onPlay={() => play({ mode: 'cup', tournamentId: tid, opponent: cupOpp, difficulty: cupOpp.difficulty, title: `${tdef.name} · ${CUP_ROUNDS[cupFx.round]}` })}
            />
          ) : (
            <section className="cup__entry panel">
              <h3 className="t-display">{cup.status === 'won' ? '¡Campeón!' : cup.status === 'eliminated' ? 'Eliminado' : tdef.name}</h3>
              <p className="muted">
                {cup.status === 'eliminated' && cup.champion ? `El título fue para ${teamOf(cup, cup.champion)?.name}. ` : ''}
                {tdef.description} Ocho equipos a eliminación directa; todos los partidos cuentan para goleadores, asistentes y porterías a cero.
              </p>
              {tdef.modes.length > 1 && (
                <div className="cup__mode">
                  <span className="t-ui muted">Rivales</span>
                  <Segmented<RivalMode>
                    label="Rivales"
                    value={tMode}
                    onChange={setTMode}
                    options={tdef.modes.map((m) => ({ id: m, label: m === 'real' ? 'Clubes reales' : 'Equipos mixtos' }))}
                  />
                </div>
              )}
              <div className="cup__fee">
                <span className="t-ui muted">Inscripción</span>
                <Coins value={tdef.fee} />
                <span className="t-ui muted">· Premio</span>
                <Coins value={tdef.prize} />
                <span className="t-ui muted">· Títulos: {cup.titles}</span>
              </div>
              <Button variant="gold" disabled={coins < tdef.fee} onClick={() => feedback(useGame.getState().startTournament(tid, tMode))}>
                {cup.edition === 0 ? 'Inscribirse' : 'Nueva edición'}
              </Button>
            </section>
          )}
          {cup.fixtures.length > 0 && (
            <>
              <CupBracket cup={cup} />
              <CupStats cup={cup} />
            </>
          )}
        </div>
      )}

      {mode === 'challenges' && (
        <div className="challenges stagger">
          {CHALLENGES.map((c) => {
            const p = c.evaluate(view);
            const done = p.current >= p.target;
            const isClaimed = !!claimed[c.id];
            return (
              <article key={c.id} className="challenge" data-done={done} data-claimed={isClaimed}>
                <div className="challenge__body">
                  <h3 className="t-display">{c.title}</h3>
                  <p className="muted">{c.description}</p>
                  <div className="challenge__progress">
                    <Meter value={p.current} max={p.target} tone={done ? 'green' : 'gold'} label={c.title} />
                    <span className="t-num">
                      {Math.min(p.current, p.target)}/{p.target}
                    </span>
                  </div>
                </div>
                <div className="challenge__reward">
                  <Coins value={c.reward} />
                  {isClaimed ? (
                    <span className="tag tag--green">
                      <Icon.Check size={13} /> Reclamado
                    </span>
                  ) : done ? (
                    <Button variant="gold" size="sm" onClick={() => feedback(useGame.getState().claimChallenge(c.id, c.reward))}>
                      Reclamar
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => go('squad')}>
                      Ajustar plantilla
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
