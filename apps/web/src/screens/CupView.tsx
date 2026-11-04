import { useState } from 'react';
import { PlayerCard } from '../components/card/PlayerCard';
import { Icon } from '../components/ui/icons';
import { Segmented } from '../components/ui/ui';
import { CUP_ROUNDS, leaders, teamOf, USER_ID, type CupFixture, type CupPlayerLine, type CupState } from '../state/cup';
import './cup.css';

/** Cuadro del torneo: cuartos → semifinal → final. */
export function CupBracket({ cup }: { cup: CupState }) {
  return (
    <section className="cupb" aria-label="Cuadro de la copa">
      {CUP_ROUNDS.map((name, round) => {
        const size = 4 >> round;
        const fixtures = Array.from({ length: size }, (_, slot) => cup.fixtures.find((f) => f.round === round && f.slot === slot));
        return (
          <div key={name} className="cupb__round">
            <h4 className="t-ui">{name}</h4>
            <div className="cupb__col">
              {fixtures.map((f, i) => (
                <FixtureBox key={f?.id ?? `${round}-${i}`} cup={cup} fixture={f} />
              ))}
            </div>
          </div>
        );
      })}
      <div className="cupb__champion" data-won={!!cup.champion}>
        <Icon.Trophy size={42} />
        <span className="t-ui">Campeón</span>
        <b className="t-display">{cup.champion ? teamOf(cup, cup.champion)?.shortName : '—'}</b>
      </div>
    </section>
  );
}

function FixtureBox({ cup, fixture }: { cup: CupState; fixture?: CupFixture }) {
  if (!fixture) {
    return (
      <div className="cupb__fx" data-empty="true">
        <div className="cupb__team">
          <span className="muted">Por decidir</span>
        </div>
        <div className="cupb__team">
          <span className="muted">Por decidir</span>
        </div>
      </div>
    );
  }
  const row = (id: string, goals?: number, pens?: number) => {
    const t = teamOf(cup, id);
    return (
      <div className="cupb__team" data-user={id === USER_ID} data-winner={fixture.winner === id} data-loser={!!fixture.winner && fixture.winner !== id}>
        <span className="cupb__kit" style={{ background: t?.colors.primary, boxShadow: `inset 0 0 0 2px ${t?.colors.secondary}` }} />
        <span className="cupb__name">{t?.shortName ?? id}</span>
        <span className="cupb__score t-num">
          {goals ?? ''}
          {pens !== undefined && <small> ({pens})</small>}
        </span>
      </div>
    );
  };
  return (
    <div className="cupb__fx" data-live={!fixture.winner && (fixture.home === USER_ID || fixture.away === USER_ID)}>
      {row(fixture.home, fixture.result?.home, fixture.result?.pens?.home)}
      {row(fixture.away, fixture.result?.away, fixture.result?.pens?.away)}
    </div>
  );
}

type StatKey = 'goals' | 'assists' | 'cleanSheets';
const STAT_LABEL: Record<StatKey, { title: string; unit: string; award: string }> = {
  goals: { title: 'Goleadores', unit: 'goles', award: 'Bota de oro' },
  assists: { title: 'Asistencias', unit: 'asist.', award: 'Mejor asistente' },
  cleanSheets: { title: 'Porterías a cero', unit: 'p. a cero', award: 'Guante de oro' },
};

/** Estadísticas del torneo: goleadores, asistentes y porteros imbatidos. */
export function CupStats({ cup }: { cup: CupState }) {
  const [key, setKey] = useState<StatKey>('goals');
  const list = leaders(cup, key, 10);
  const totalGoals = Object.values(cup.players).reduce((n, p) => n + p.goals, 0);
  const played = cup.fixtures.filter((f) => f.result).length;
  return (
    <section className="cups panel" aria-label="Estadísticas de la copa">
      <header className="cups__head">
        <div>
          <h3 className="t-display">Estadísticas del torneo</h3>
          <span className="muted small">
            {played} partidos · {totalGoals} goles{played ? ` · ${(totalGoals / played).toFixed(1)} por partido` : ''}
          </span>
        </div>
        <Segmented<StatKey>
          label="Estadística"
          value={key}
          onChange={setKey}
          options={(Object.keys(STAT_LABEL) as StatKey[]).map((k) => ({ id: k, label: STAT_LABEL[k].title }))}
        />
      </header>
      {list.length === 0 ? (
        <p className="empty-state">Aún no hay datos: se actualizan tras cada partido del torneo.</p>
      ) : (
        <div className="cups__body">
          <Leader line={list[0]} cup={cup} stat={key} />
          <ol className="cups__list">
            {list.map((p, i) => (
              <LeaderRow key={p.key} line={p} rank={i + 1} cup={cup} stat={key} />
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

function Leader({ line, cup, stat }: { line: CupPlayerLine; cup: CupState; stat: StatKey }) {
  const team = teamOf(cup, line.teamId);
  return (
    <div className="cups__leader">
      <span className="t-eyebrow">{STAT_LABEL[stat].award}</span>
      {line.versionId && <PlayerCard versionId={line.versionId} size="sm" />}
      <b className="t-display">{line.name}</b>
      <span className="muted small">{team?.name}</span>
      <span className="cups__big t-num">
        {line[stat]} <small>{STAT_LABEL[stat].unit}</small>
      </span>
    </div>
  );
}

function LeaderRow({ line, rank, cup, stat }: { line: CupPlayerLine; rank: number; cup: CupState; stat: StatKey }) {
  const team = teamOf(cup, line.teamId);
  return (
    <li className="cups__row" data-user={line.teamId === USER_ID}>
      <span className="cups__rank t-num">{rank}</span>
      <span className="cups__kit" style={{ background: team?.colors.primary }} />
      <span className="cups__name">
        <b>{line.name}</b>
        <small className="muted">{team?.shortName}</small>
      </span>
      <span className="cups__extra muted small t-num">
        {stat === 'goals' ? `${line.assists} as.` : stat === 'assists' ? `${line.goals} g.` : ''}
      </span>
      <span className="cups__val t-num">{line[stat]}</span>
    </li>
  );
}
