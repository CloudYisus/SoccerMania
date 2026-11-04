import { useEffect, useMemo, useState } from 'react';
import { PLAY_STYLES } from '@fu/domain';
import { PlayerCard } from '../components/card/PlayerCard';
import { Icon } from '../components/ui/icons';
import { Button, Coins, Meter, SectionHeader, Segmented } from '../components/ui/ui';
import { CHALLENGES } from '../state/challenges';
import { catalog } from '../data/catalog';
import { CUP_ENTRY_FEE, CUP_ROUNDS, DIVISION_SEASON_GAMES, PROMOTION_POINTS, RELEGATION_POINTS, useGame } from '../state/gameStore';
import { useSquadView } from '../state/squadView';
import { buildOpponent, divisionOpponent, QUICK_OPPONENTS, type TeamBuild } from '../state/teams';
import { buildCupTeam, teamOf, USER_ID, userFixture } from '../state/cup';
import { CupBracket, CupStats } from './CupView';
import { feedback, useUi, type MatchRequest } from '../state/uiStore';
import './compete.css';

type Mode = 'quick' | 'divisions' | 'cup' | 'challenges';

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
    if (intent === 'divisions' || intent === 'challenges' || intent === 'cup' || intent === 'quick') {
      setMode(intent);
      clearIntent();
    }
  }, [intent, clearIntent]);

  const view = useSquadView();
  const startMatch = useUi((s) => s.startMatch);
  const go = useUi((s) => s.go);
  const division = useGame((s) => s.division);
  const cup = useGame((s) => s.cup);
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
  const divOpp = useMemo(() => divisionOpponent(division.level, division.played), [division.level, division.played]);
  const cupFx = cup.status === 'running' ? userFixture(cup) : undefined;
  const cupOppId = cupFx ? (cupFx.home === USER_ID ? cupFx.away : cupFx.home) : null;
  const cupOpp = useMemo(() => {
    const ref = cupOppId ? teamOf(cup, cupOppId) : undefined;
    return ref?.source ? buildCupTeam(ref) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cupOppId, cup.edition]);

  return (
    <div className="compete">
      <SectionHeader eyebrow="Competir" title={{ quick: 'Partido rápido', divisions: 'Divisiones', cup: 'Copa Ultimate', challenges: 'Desafíos' }[mode]}>
        <Segmented<Mode>
          label="Modo"
          value={mode}
          onChange={setMode}
          options={[
            { id: 'quick', label: 'Partido rápido' },
            { id: 'divisions', label: 'Divisiones' },
            { id: 'cup', label: 'Copa' },
            { id: 'challenges', label: 'Desafíos' },
          ]}
        />
      </SectionHeader>

      {!view.complete && mode !== 'challenges' && (
        <div className="notice">
          <span>Tu once está incompleto. Necesitas 11 titulares para competir.</span>
          <Button size="sm" variant="primary" onClick={() => go('squad')}>
            Ir a plantilla
          </Button>
        </div>
      )}

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

      {mode === 'quick' && (
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
      )}

      {mode === 'divisions' && (
        <div className="division">
          <section className="division__status">
            <div className="division__badge">
              <span className="t-eyebrow">División</span>
              <span className="division__num t-display">{division.level}</span>
              <span className="muted small">Mejor: División {division.best}</span>
            </div>
            <div className="division__season">
              <div className="division__row t-ui">
                <span>Temporada</span>
                <span>
                  {division.played}/{DIVISION_SEASON_GAMES} partidos
                </span>
              </div>
              <div className="division__games">
                {Array.from({ length: DIVISION_SEASON_GAMES }, (_, i) => (
                  <span key={i} data-played={i < division.played} />
                ))}
              </div>
              <div className="division__record">
                <div>
                  <b className="t-num">{division.wins}</b>
                  <span className="t-ui">V</span>
                </div>
                <div>
                  <b className="t-num">{division.draws}</b>
                  <span className="t-ui">E</span>
                </div>
                <div>
                  <b className="t-num">{division.losses}</b>
                  <span className="t-ui">D</span>
                </div>
                <div>
                  <b className="t-num t-gold">{division.points}</b>
                  <span className="t-ui">Puntos</span>
                </div>
              </div>
              <div className="division__thresholds">
                <Meter value={division.points} max={PROMOTION_POINTS} tone="green" label="Progreso hacia el ascenso" />
                <div className="division__row small muted">
                  <span>Descenso ≤ {RELEGATION_POINTS} pts</span>
                  <span>Ascenso ≥ {PROMOTION_POINTS} pts</span>
                </div>
              </div>
              {division.lastOutcome && (
                <span className={`tag ${division.lastOutcome === 'promoted' ? 'tag--green' : division.lastOutcome === 'relegated' ? 'tag--red' : ''}`}>
                  Última temporada: {{ promoted: 'Ascenso', relegated: 'Descenso', stayed: 'Permanencia' }[division.lastOutcome]}
                </span>
              )}
            </div>
          </section>
          <TeamPanel
            team={divOpp}
            cta={`Jugar jornada ${division.played + 1}`}
            disabled={!view.complete}
            onPlay={() => play({ mode: 'division', opponent: divOpp, difficulty: divOpp.difficulty, title: `División ${division.level} · Jornada ${division.played + 1}` })}
          />
        </div>
      )}

      {mode === 'cup' && (
        <div className="cup">
          {cup.status === 'running' && cupOpp && cupFx ? (
            <TeamPanel
              team={cupOpp}
              cta={`Jugar ${CUP_ROUNDS[cupFx.round].toLowerCase()}`}
              disabled={!view.complete}
              extra={<p className="muted small">{CUP_ROUNDS[cupFx.round]} · edición {cup.edition}. Partido único: si hay empate, penaltis.</p>}
              onPlay={() => play({ mode: 'cup', opponent: cupOpp, difficulty: cupOpp.difficulty, title: `Copa Ultimate · ${CUP_ROUNDS[cupFx.round]}` })}
            />
          ) : (
            <section className="cup__entry panel">
              <h3 className="t-display">
                {cup.status === 'won' ? '¡Campeón!' : cup.status === 'eliminated' ? 'Eliminado' : 'Copa Ultimate'}
              </h3>
              <p className="muted">
                {cup.status === 'eliminated' && cup.champion
                  ? `El título fue para ${teamOf(cup, cup.champion)?.name}. `
                  : ''}
                Ocho equipos a eliminación directa. Todos los partidos del torneo se juegan con el motor del juego y cuentan para goleadores, asistentes y porterías a cero. El campeón gana 25.000 monedas.
              </p>
              <div className="cup__fee">
                <span className="t-ui muted">Inscripción</span>
                <Coins value={CUP_ENTRY_FEE} />
                <span className="t-ui muted">· Títulos: {cup.titles}</span>
              </div>
              <Button variant="gold" disabled={coins < CUP_ENTRY_FEE} onClick={() => feedback(useGame.getState().startCup())}>
                {cup.status === 'idle' && cup.edition === 0 ? 'Inscribirse' : 'Nueva edición'}
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
