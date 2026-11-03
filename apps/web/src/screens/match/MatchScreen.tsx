import { useEffect, useMemo, useRef, useState } from 'react';
import { createRng } from '@fu/shared';
import {
  INSTRUCTIONS,
  MatchEngine,
  matchReward,
  MENTALITY_LABELS,
  penaltyShootout,
  POSITION_LABELS,
  type MatchEvent,
  type MatchSnapshot,
  type MatchTeamSetup,
  type Mentality,
  type PlayerInstruction,
  type HighlightKind,
} from '@fu/domain';
import { createMatchView, type MatchView } from '@fu/match-renderer';
import { Icon } from '../../components/ui/icons';
import { PlayerCard } from '../../components/card/PlayerCard';
import { Button, Coins, Segmented } from '../../components/ui/ui';
import { useGame } from '../../state/gameStore';
import { computeSquadView } from '../../state/squadView';
import { aiToMatchSetup, userToMatchSetup } from '../../state/teams';
import { useUi } from '../../state/uiStore';
import './match.css';

const SPEEDS = [1, 2, 4, 8] as const;

function lum(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function colorDistance(a: string, b: string) {
  const [r1, g1, b1] = lum(a);
  const [r2, g2, b2] = lum(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}

/** Evita que ambos equipos vistan colores parecidos. */
function resolveKits(home: MatchTeamSetup, away: MatchTeamSetup) {
  const h = home.colors;
  let a = away.colors;
  if (colorDistance(h.primary, a.primary) < 120) a = { primary: a.secondary, secondary: a.primary };
  if (colorDistance(h.primary, a.primary) < 120) a = { primary: '#e8ecf2', secondary: '#1d2430' };
  return { home: h, away: a };
}

export default function MatchScreen() {
  const req = useUi((s) => s.match)!;
  const endMatch = useUi((s) => s.endMatch);
  const go = useUi((s) => s.go);
  const toast = useUi((s) => s.toast);

  // Configuración congelada al empezar el partido.
  const { home, away, engine, kits } = useMemo(() => {
    const g = useGame.getState();
    const view = computeSquadView(g.squad, g.cards);
    const home = userToMatchSetup(view, g.squad.name, g.squad.tactics, g.squad.instructions);
    const away = aiToMatchSetup(req.opponent);
    const engine = new MatchEngine(home, away, (Date.now() ^ 0x5f3759df) >>> 0);
    return { home, away, engine, kits: resolveKits(home, away) };
  }, [req]);

  const hostRef = useRef<HTMLDivElement>(null);
  const ingestRef = useRef<(evs: MatchEvent[], live: boolean) => void>(() => {});
  const viewRef = useRef<MatchView | null>(null);
  const [snap, setSnap] = useState<MatchSnapshot>(() => engine.getSnapshot());
  const [feed, setFeed] = useState<MatchEvent[]>([]);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(2);
  const [paused, setPaused] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [mentality, setMentality] = useState<Mentality>(home.tactics.mentality);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [goalShow, setGoalShow] = useState<MatchEvent | null>(null);
  const [banners, setBanners] = useState<MatchEvent[]>([]);
  const [slowMo, setSlowMo] = useState(true);
  const [slowActive, setSlowActive] = useState(false);
  const control = useRef({ speed, paused, slowMo, holdUntil: 0, slowUntil: 0 });
  control.current.speed = speed;
  control.current.paused = paused;
  control.current.slowMo = slowMo;

  /** Versión de carta de cada jugador del partido (para la carta del goleador). */
  const versionOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of [...home.players, ...away.players]) if (p.versionId) m.set(p.id, p.versionId);
    return m;
  }, [home, away]);

  /** Procesa eventos en directo: avisos, cámara lenta, carta del goleador y crónica. */
  const ingest = (evs: MatchEvent[], live: boolean) => {
    if (!evs.length) return;
    const important = evs.filter((e) => e.important);
    if (important.length) setFeed((f) => [...[...important].reverse(), ...f].slice(0, 60));
    if (!live) return;
    const now = performance.now();
    for (const e of evs) {
      if (!e.highlight) continue;
      if (e.playerId) viewRef.current?.spotlight(e.playerId);
      if (e.highlight.kind === 'goal') {
        setGoalShow(e);
        setBanners([]);
        control.current.holdUntil = now + 3600;
        continue;
      }
      const major = e.highlight.major;
      setBanners((b) => {
        // Los avisos importantes se muestran de inmediato; los menores esperan su turno.
        // Se descartan avisos caducados (más de 2 minutos de partido).
        const fresh = b.filter((x) => e.minute - x.minute <= 2);
        const next = major ? [e, ...fresh.filter((x) => x.highlight?.major)] : [...fresh, e];
        // Cola corta: si se acumulan, se descartan antes los avisos menores.
        while (next.length > 3) {
          const minor = next.findIndex((x, i) => i > 0 && !x.highlight?.major);
          next.splice(minor > 0 ? minor : 1, 1);
        }
        return next;
      });
      if (major && control.current.slowMo) control.current.slowUntil = now + 3800;
    }
  };

  useEffect(() => {
    if (!hostRef.current) return;
    const view = createMatchView({
      parent: hostRef.current,
      home: kits.home,
      away: kits.away,
      userSide: 'home',
      onPlayerClick: (id) => setSelected((s) => (s === id ? null : id)),
    });
    viewRef.current = view;
    let raf = 0;
    let last = performance.now();
    let lastUi = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const c = control.current;
      const slow = now < c.slowUntil;
      const hold = now < c.holdUntil;
      const speedNow = slow ? Math.min(c.speed, 1) * 0.6 : c.speed;
      if (!c.paused && !hold && !engine.finished) engine.step(dt * speedNow);
      const s = engine.getSnapshot();
      view.update(s);
      ingestRef.current(engine.drainEvents(), true);
      if (now - lastUi > 110 || engine.finished) {
        lastUi = now;
        setSnap(s);
        setSlowActive(slow);
      }
      if (!engine.finished) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      view.destroy();
      viewRef.current = null;
    };
  }, [engine, kits]);

  useEffect(() => viewRef.current?.setSelected(selected), [selected]);
  useEffect(() => {
    if (!goalShow) return;
    const t = setTimeout(() => setGoalShow(null), 3600);
    return () => clearTimeout(t);
  }, [goalShow]);
  useEffect(() => {
    if (!banners.length) return;
    const t = setTimeout(() => setBanners((b) => b.slice(1)), banners.length > 1 ? 2000 : 2800);
    return () => clearTimeout(t);
  }, [banners]);

  ingestRef.current = ingest;

  const simulateRest = () => {
    engine.simulateToEnd();
    ingest(engine.drainEvents(), false);
    setBanners([]);
    setGoalShow(null);
    setSnap(engine.getSnapshot());
  };

  const setInstruction = (id: string, instr: PlayerInstruction) => {
    engine.setInstruction(id, instr);
    setSnap(engine.getSnapshot());
  };
  const changeMentality = (m: Mentality) => {
    setMentality(m);
    engine.setTactics('home', { ...engine.getTactics('home'), mentality: m });
  };

  const finished = snap.phase === 'fulltime';
  const homePlayers = snap.players.filter((p) => p.side === 'home');
  const sel = homePlayers.find((p) => p.id === selected) ?? null;
  const totalPoss = snap.stats.home.possessionTicks + snap.stats.away.possessionTicks || 1;
  const possHome = Math.round((snap.stats.home.possessionTicks / totalPoss) * 100);

  // Penaltis en eliminatorias de copa
  const penalties = useMemo(() => {
    if (!finished || req.mode !== 'cup' || snap.score.home !== snap.score.away) return null;
    const shooters = (t: MatchTeamSetup) => [...t.players].sort((a, b) => b.attributes.shooting - a.attributes.shooting).map((p) => p.attributes.shooting);
    const keeper = (t: MatchTeamSetup) => t.players.find((p) => p.position === 'GK')?.attributes.goalkeeping ?? 50;
    const r = penaltyShootout(createRng(snap.score.home * 97 + Math.round(snap.time)), { shooting: shooters(home), keeper: keeper(home) }, { shooting: shooters(away), keeper: keeper(away) });
    return { for: r.home, against: r.away };
  }, [finished, req.mode, snap.score, snap.time, home, away]);

  const reward = finished ? matchReward(snap.score.home, snap.score.away, req.difficulty) : null;

  const close = () => {
    if (finished) {
      const r = useGame.getState().recordMatch({
        mode: req.mode,
        opponent: req.opponent.name,
        goalsFor: snap.score.home,
        goalsAgainst: snap.score.away,
        penalties: penalties ?? undefined,
        difficulty: req.difficulty,
      });
      toast('reward', `+${r.coins.toLocaleString('es-ES')} monedas · +${r.xp} XP${r.levelsGained ? ' · ¡Subes de nivel!' : ''}`);
      if (r.note) setTimeout(() => toast('info', r.note!), 400);
    }
    endMatch();
    go('compete', req.mode === 'division' ? 'divisions' : req.mode);
  };

  const scorers = (side: 'home' | 'away') =>
    engine.events.filter((e) => e.type === 'goal' && e.side === side).map((e) => {
      const p = snap.players.find((x) => x.id === e.playerId);
      return `${p?.name ?? '—'} ${e.minute}'`;
    });

  const statRows: [string, number | string, number | string][] = [
    ['Posesión', `${possHome}%`, `${100 - possHome}%`],
    ['Disparos', snap.stats.home.shots, snap.stats.away.shots],
    ['A puerta', snap.stats.home.shotsOnTarget, snap.stats.away.shotsOnTarget],
    ['Pases', snap.stats.home.passes, snap.stats.away.passes],
    [
      'Precisión',
      `${Math.round((snap.stats.home.passesCompleted / Math.max(1, snap.stats.home.passes)) * 100)}%`,
      `${Math.round((snap.stats.away.passesCompleted / Math.max(1, snap.stats.away.passes)) * 100)}%`,
    ],
    ['Regates', snap.stats.home.dribblesWon, snap.stats.away.dribblesWon],
    ['Entradas ganadas', snap.stats.home.tackles, snap.stats.away.tackles],
    ['Faltas', snap.stats.home.fouls, snap.stats.away.fouls],
    ['Amarillas', snap.stats.home.yellowCards, snap.stats.away.yellowCards],
    ['Intercepciones', snap.stats.home.interceptions, snap.stats.away.interceptions],
  ];

  return (
    <div className="match" role="dialog" aria-modal="true" aria-label={`Partido contra ${away.name}`}>
      <header className="scoreboard">
        <div className="scoreboard__team scoreboard__team--home">
          <span className="scoreboard__kit" style={{ background: kits.home.primary }} />
          <span className="t-display">{home.shortName}</span>
          <small className="t-ui muted">
            {home.rating} · Q{home.chemistry}
          </small>
        </div>
        <div className="scoreboard__center">
          <div className="scoreboard__score t-display">
            <span>{snap.score.home}</span>
            <span className="scoreboard__sep">–</span>
            <span>{snap.score.away}</span>
          </div>
          <div className="scoreboard__clock t-num">
            {finished ? 'FINAL' : snap.phase === 'halftime' ? 'DESCANSO' : `${snap.minute}'`}
          </div>
        </div>
        <div className="scoreboard__team scoreboard__team--away">
          <small className="t-ui muted">
            {away.rating} · Q{away.chemistry}
          </small>
          <span className="t-display">{away.shortName}</span>
          <span className="scoreboard__kit" style={{ background: kits.away.primary }} />
        </div>
        <div className="scoreboard__title t-ui">{req.title}</div>
      </header>

      <div className="match__layout">
        <div className="match__pitch">
          <div className="match__stage">
            <div className="match__canvas" ref={hostRef} />
            {banners[0]?.highlight && (
              <HighlightBanner key={banners[0].id} event={banners[0]} kit={banners[0].side === 'away' ? kits.away.primary : kits.home.primary} />
            )}
            {slowActive && !goalShow && <span className="slowmo-badge t-ui">Cámara lenta</span>}
            {goalShow && (
              <GoalCard
                key={goalShow.id}
                event={goalShow}
                versionId={goalShow.playerId ? versionOf.get(goalShow.playerId) : undefined}
                mine={goalShow.side === 'home'}
                score={snap.score}
                assistName={goalShow.otherId ? snap.players.find((p) => p.id === goalShow.otherId)?.name : undefined}
              />
            )}
          </div>
          <div className="match__controls">
            <button className="icon-btn" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Reanudar' : 'Pausar'} disabled={finished}>
              {paused ? <Icon.Play size={16} /> : <Icon.Pause size={16} />}
            </button>
            <Segmented
              label="Velocidad"
              value={String(speed)}
              onChange={(v) => setSpeed(Number(v) as (typeof SPEEDS)[number])}
              options={SPEEDS.map((s) => ({ id: String(s), label: `${s}×` }))}
            />
            <button
              className="toggle t-ui"
              data-on={slowMo}
              aria-pressed={slowMo}
              onClick={() => setSlowMo((v) => !v)}
              title="Ralentiza la retransmisión durante las jugadas clave"
            >
              Cámara lenta en jugadas clave
            </button>
            <Button size="sm" icon={<Icon.FastForward size={14} />} disabled={finished} onClick={simulateRest}>
              Simular hasta el final
            </Button>
            <span className="match__spacer" />
            {!finished && (
              <Button size="sm" variant={confirmLeave ? 'danger' : 'ghost'} onClick={() => (confirmLeave ? (endMatch(), go('compete')) : setConfirmLeave(true))}>
                {confirmLeave ? 'Confirmar abandono (sin recompensas)' : 'Abandonar'}
              </Button>
            )}
          </div>
        </div>

        <aside className="match__side">
          <section className="match-panel">
            <h3 className="t-ui">Mentalidad</h3>
            <Segmented<Mentality>
              label="Mentalidad"
              value={mentality}
              onChange={changeMentality}
              options={(['defensive', 'balanced', 'attacking'] as Mentality[]).map((m) => ({ id: m, label: MENTALITY_LABELS[m] }))}
            />
          </section>

          <section className="match-panel">
            <h3 className="t-ui">Instrucciones individuales</h3>
            <ul className="roster">
              {homePlayers.map((p) => (
                <li key={p.id}>
                  <button className="roster__row" data-selected={p.id === selected} onClick={() => setSelected(p.id === selected ? null : p.id)}>
                    <span className="roster__num t-num">{p.number}</span>
                    <span className="roster__pos t-ui">{POSITION_LABELS[p.position]}</span>
                    <span className="roster__name">{p.name}</span>
                    <span className="roster__instr t-ui">{p.instruction !== 'none' ? INSTRUCTIONS.find((i) => i.id === p.instruction)?.label : ''}</span>
                    <span className="roster__stamina" title={`Energía ${Math.round(p.stamina * 100)}%`}>
                      <span style={{ width: `${p.stamina * 100}%` }} data-low={p.stamina < 0.5} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {sel && (
              <div className="instr-grid">
                {INSTRUCTIONS.map((i) => (
                  <button key={i.id} className="instr" data-active={sel.instruction === i.id} onClick={() => setInstruction(sel.id, i.id)} title={i.description}>
                    {i.label}
                  </button>
                ))}
              </div>
            )}
            {!sel && <p className="muted small">Selecciona un jugador en la lista o en el campo para darle una instrucción.</p>}
          </section>

          <section className="match-panel match-panel--feed">
            <h3 className="t-ui">Crónica</h3>
            <ol className="feed">
              {feed.map((e) => (
                <li key={e.id} data-type={e.type} data-side={e.side ?? 'none'} data-hl={e.highlight?.kind}>
                  <span className="feed__min t-num">{e.minute}'</span>
                  <span>
                    {e.highlight && e.type === 'highlight' ? (
                      <>
                        <b>{e.highlight.title}</b> {e.highlight.detail}
                      </>
                    ) : (
                      e.text
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>

      {finished && (
        <div className="summary" role="dialog" aria-label="Resumen del partido">
          <div className="summary__card">
            <span className="t-eyebrow">{req.title}</span>
            <div className="summary__score">
              <div>
                <span className="t-display">{home.name}</span>
                <small className="muted">{scorers('home').join(' · ')}</small>
              </div>
              <span className="summary__result t-display">
                {snap.score.home} – {snap.score.away}
              </span>
              <div>
                <span className="t-display">{away.name}</span>
                <small className="muted">{scorers('away').join(' · ')}</small>
              </div>
            </div>
            {penalties && (
              <div className="summary__pens t-ui">
                Penaltis: {penalties.for} – {penalties.against} · {penalties.for > penalties.against ? 'Clasificado' : 'Eliminado'}
              </div>
            )}
            <table className="summary__stats">
              <tbody>
                {statRows.map(([label, h, a]) => (
                  <tr key={label}>
                    <td className="t-num">{h}</td>
                    <th className="t-ui">{label}</th>
                    <td className="t-num">{a}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {reward && (
              <div className="summary__reward">
                <span className="t-ui muted">Recompensa</span>
                <Coins value={reward.coins} />
                <span className="tag tag--gold">+{reward.xp} XP</span>
              </div>
            )}
            <Button variant="gold" size="lg" onClick={close}>
              Continuar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const HL_CATEGORY: Record<HighlightKind, { label: string; tone: 'attack' | 'setpiece' | 'keeper' | 'card' | 'goal' }> = {
  goal: { label: 'Gol', tone: 'goal' },
  throughball: { label: 'Desmarque', tone: 'attack' },
  longball: { label: 'Juego largo', tone: 'attack' },
  cross: { label: 'Centro', tone: 'attack' },
  header: { label: 'Juego aéreo', tone: 'attack' },
  longshot: { label: 'Disparo', tone: 'attack' },
  skillrun: { label: 'Regate', tone: 'attack' },
  oneonone: { label: 'Ocasión', tone: 'attack' },
  roundkeeper: { label: 'Ocasión', tone: 'attack' },
  penalty: { label: 'Balón parado', tone: 'setpiece' },
  freekick: { label: 'Balón parado', tone: 'setpiece' },
  bigsave: { label: 'Portero', tone: 'keeper' },
  woodwork: { label: 'Ocasión', tone: 'keeper' },
  card: { label: 'Árbitro', tone: 'card' },
};

/** Aviso breve de jugada destacada sobre la retransmisión. */
function HighlightBanner({ event, kit }: { event: MatchEvent; kit: string }) {
  const h = event.highlight!;
  const cat = HL_CATEGORY[h.kind];
  return (
    <div className="hl-banner" data-tone={cat.tone} data-major={h.major} role="status" aria-live="polite">
      <span className="hl-banner__kit" style={{ background: kit }} />
      <div className="hl-banner__body">
        <span className="hl-banner__cat t-ui">
          {cat.label} · {event.minute}'
        </span>
        <span className="hl-banner__title t-display">{h.title}</span>
        <span className="hl-banner__detail">{h.detail}</span>
      </div>
      <span className="hl-banner__timer" />
    </div>
  );
}

/** Celebración: carta del goleador destacada. */
function GoalCard({
  event,
  versionId,
  mine,
  score,
  assistName,
}: {
  event: MatchEvent;
  versionId?: string;
  mine: boolean;
  score: { home: number; away: number };
  assistName?: string;
}) {
  const how = event.highlight?.detail.split(' · ').slice(1).find((x) => !x.startsWith('asistencia'));
  return (
    <div className="goal-show" data-mine={mine} role="status" aria-live="assertive">
      <div className="goal-show__rays" />
      <div className="goal-show__inner">
        <span className="goal-show__title t-display">{mine ? '¡GOL!' : 'GOL DEL RIVAL'}</span>
        {versionId && (
          <div className="goal-show__card">
            <PlayerCard versionId={versionId} size="lg" />
          </div>
        )}
        <span className="goal-show__meta t-ui">
          {event.minute}'{how ? ` · ${how}` : ''}
          {assistName ? ` · asistencia de ${assistName}` : ''}
        </span>
        <span className="goal-show__score t-display">
          {score.home} – {score.away}
        </span>
      </div>
    </div>
  );
}
