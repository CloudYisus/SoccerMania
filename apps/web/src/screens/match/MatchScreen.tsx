import { useEffect, useMemo, useRef, useState } from 'react';
import { createRng } from '@fu/shared';
import {
  INSTRUCTIONS,
  matchRatings,
  matchStory,
  instructionsFor,
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
  type DecisionFrequency,
  type DecisionPrompt,
  type DecisionOption,
  type Likelihood,
  type Level,
  type MatchAttributes,
  type StoryMoment,
  PLAY_STYLES,
} from '@fu/domain';
import { createMatchView, type MatchView, type PlayerToken } from '@fu/match-renderer';
import { bundledFlagUrl } from '../../assets/assets';
import { cardTheme } from '../../components/card/editions';
import { catalog, version as resolveVersion } from '../../data/catalog';
import { Icon } from '../../components/ui/icons';
import { PlayerCard } from '../../components/card/PlayerCard';
import { Button, Coins, Segmented } from '../../components/ui/ui';
import { useGame } from '../../state/gameStore';
import { computeSquadView, matchdaySquad } from '../../state/squadView';
import { WEATHER } from '../../state/league';
import { aiToMatchSetup, userToMatchSetup } from '../../state/teams';
import { cupPlayerName, reportFromEvents, USER_ID } from '../../state/cup';
import { useUi } from '../../state/uiStore';
import './match.css';

const SPEEDS = [1, 2, 4, 8] as const;
/** Velocidad del motor (segundos de motor por segundo real) mientras se decide: cámara muy lenta, sin pausa. */
const DECISION_RATE = 0.1;
const FREQ_KEY = 'fu-decision-frequency';

function loadFrequency(): DecisionFrequency {
  try {
    const v = localStorage.getItem(FREQ_KEY);
    if (v === 'off' || v === 'low' || v === 'medium' || v === 'high') return v;
  } catch {
    /* almacenamiento no disponible */
  }
  return 'medium';
}
function saveFrequency(v: DecisionFrequency) {
  try {
    localStorage.setItem(FREQ_KEY, v);
  } catch {
    /* almacenamiento no disponible */
  }
}

function lum(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function colorDistance(a: string, b: string) {
  const [r1, g1, b1] = lum(a);
  const [r2, g2, b2] = lum(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}

const PITCH_GREEN = '#134a32';
/** El color del equipo debe destacar sobre el césped (las fichas usan el anillo del kit). */
function onPitch(c: { primary: string; secondary: string }) {
  if (colorDistance(c.primary, PITCH_GREEN) >= 120) return c;
  if (colorDistance(c.secondary, PITCH_GREEN) >= 120) return { primary: c.secondary, secondary: c.primary };
  return { primary: '#e8ecf2', secondary: c.primary };
}

/** Evita que ambos equipos vistan colores parecidos (ni parecidos al césped). */
function resolveKits(home: MatchTeamSetup, away: MatchTeamSetup) {
  const h = onPitch(home.colors);
  let a = onPitch(away.colors);
  if (colorDistance(h.primary, a.primary) < 120 && colorDistance(a.secondary, PITCH_GREEN) >= 120) a = { primary: a.secondary, secondary: a.primary };
  if (colorDistance(h.primary, a.primary) < 120) a = { primary: '#e8ecf2', secondary: '#1d2430' };
  if (colorDistance(h.primary, a.primary) < 120) a = { primary: '#2f6fe0', secondary: '#0b0d11' };
  return { home: h, away: a };
}

const flagCache = new Map<string, HTMLImageElement>();
/** Imagen de bandera (cacheada) para las fichas del partido. */
function flagImage(code: string): HTMLImageElement | null {
  const url = bundledFlagUrl(code);
  if (!url) return null;
  let img = flagCache.get(code);
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.src = url;
    flagCache.set(code, img);
  }
  return img;
}
function whenImagesReady(imgs: (HTMLImageElement | null | undefined)[], timeoutMs: number) {
  const pending = imgs.filter((i): i is HTMLImageElement => !!i && !i.complete);
  if (!pending.length) return Promise.resolve();
  return Promise.race([
    Promise.all(
      pending.map(
        (i) =>
          new Promise<void>((res) => {
            i.addEventListener('load', () => res(), { once: true });
            i.addEventListener('error', () => res(), { once: true });
          }),
      ),
    ),
    new Promise<void>((res) => setTimeout(res, timeoutMs)),
  ]);
}

export default function MatchScreen() {
  const req = useUi((s) => s.match)!;
  const endMatch = useUi((s) => s.endMatch);
  const go = useUi((s) => s.go);
  const toast = useUi((s) => s.toast);

  // Configuración congelada al empezar el partido.
  const { home, away, engine, kits } = useMemo(() => {
    const g = useGame.getState();
    // Los lesionados se quedan fuera: entra el mejor suplente de su línea.
    const listed = new Set(g.myListings.filter((l) => l.status === 'active').map((l) => l.cardId));
    const { squad, replaced } = matchdaySquad(g.squad, g.cards, g.injuries, listed);
    const view = computeSquadView(squad, g.cards, g.inForm);
    const home = req.userSetup ?? boosted(userToMatchSetup(view, g.squad.name, g.squad.tactics, g.squad.instructions), req.context?.userBoost);
    const away = boosted(aiToMatchSetup(req.opponent), req.context?.rivalBoost);
    const notes = (req.userSetup ? [] : replaced).map((r) => `${resolveVersion(g.cards[r.out].versionId).player.knownAs} está lesionado: juega ${resolveVersion(g.cards[r.in].versionId).player.knownAs}`);
    if (notes.length) setTimeout(() => notes.forEach((n, i) => setTimeout(() => useUi.getState().toast('info', n), i * 500)), 600);
    const engine = new MatchEngine(home, away, (Date.now() ^ 0x5f3759df) >>> 0);
    engine.setDecisionMode('home', loadFrequency());
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
  const [decision, setDecision] = useState<DecisionPrompt | null>(null);
  const [focusOpt, setFocusOpt] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<DecisionFrequency>(() => engine.decisionFrequency);
  const [result, setResult] = useState<MatchEvent | null>(null);
  const decisionRef = useRef<DecisionPrompt | null>(null);
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
    const view = viewRef.current;
    for (const e of evs) {
      // Efectos sobre el campo.
      if (view) {
        if (e.type === 'dribble') view.effect('dribble', e.playerId);
        else if (e.type === 'tackle') view.effect('tackle', e.otherId ?? e.playerId);
        else if (e.type === 'interception') view.effect('interception', e.playerId);
        else if (e.type === 'save') view.effect('save', e.playerId);
        else if (e.type === 'goal') view.effect('goal');
        else if (e.type === 'miss' && e.text.includes('palo')) view.effect('post');
        else if (e.type === 'foul') view.effect('foul', e.otherId);
        else if (e.type === 'card') view.effect('card', e.playerId);
        else if (e.highlight?.kind === 'skillrun' && e.highlight.title !== '¡DESBORDE!') view.effect('skill', e.playerId);
      }
      if (e.decision) {
        setResult(e);
        continue;
      }
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

  /** Identidad de cada ficha: bandera de su nación, color de su edición, Icono. */
  const tokens = useMemo(() => {
    const out: Record<string, PlayerToken> = {};
    for (const p of [...home.players, ...away.players]) {
      if (!p.versionId) {
        out[p.id] = { short: p.name };
        continue;
      }
      const r = resolveVersion(p.versionId);
      const words = r.player.knownAs.split(' ');
      out[p.id] = {
        short: r.player.knownAs.length > 11 ? words[words.length - 1] : r.player.knownAs,
        flagImage: flagImage(r.nation.code),
        flagKey: r.nation.code,
        edition: (() => {
          const ev = r.version.event ? catalog.events.get(r.version.event) : undefined;
          return cardTheme(r.version.year, ev?.kind, ev?.leagueId).accent;
        })(),
        icon: r.player.icon,
        rating: r.version.rating,
      };
    }
    return out;
  }, [home, away]);

  useEffect(() => {
    if (!hostRef.current) return;
    let cancelled = false;
    let lastUi = 0;
    let slowShown = false;
    // Un único bucle: Phaser pide cada fotograma, aquí se avanza el motor.
    const onFrame = (deltaMs: number) => {
      const now = performance.now();
      const dt = Math.min(0.1, deltaMs / 1000);
      const c = control.current;
      const slow = now < c.slowUntil;
      const hold = now < c.holdUntil;
      const pending = engine.decision;
      const speedNow = pending ? DECISION_RATE : slow ? Math.min(c.speed, 1) * 0.6 : c.speed;
      if (!c.paused && !hold && !engine.finished) engine.step(dt * speedNow);
      const evs = engine.drainEvents();
      if (evs.length) ingestRef.current(evs, true);
      const d = engine.decision;
      if (d !== decisionRef.current) {
        decisionRef.current = d;
        setDecision(d);
        viewRef.current?.setDecision(d, null);
        if (!d) setFocusOpt(null);
      }
      // La interfaz (marcador, energía, crónica) no necesita 60 fps.
      if (now - lastUi > 250 || (engine.finished && lastUi >= 0)) {
        lastUi = engine.finished ? -1 : now;
        const s = engine.getSnapshot();
        viewRef.current?.update(s);
        setSnap(s);
        if (slow !== slowShown) {
          slowShown = slow;
          setSlowActive(slow);
        }
      }
      return engine.getFrame();
    };
    const host = hostRef.current;
    let view: MatchView | null = null;
    // Las banderas se cargan antes de crear la escena (texturas circulares una sola vez).
    void whenImagesReady(Object.values(tokens).map((t) => t.flagImage), 1500).then(() => {
      if (cancelled) return;
      view = createMatchView({
        parent: host,
        home: kits.home,
        away: kits.away,
        userSide: 'home',
        tokens,
        onFrame,
        onPlayerClick: (id) => setSelected((s) => (s === id ? null : id)),
      });
      viewRef.current = view;
      view.update(engine.getSnapshot());
      view.setDecision(decisionRef.current, null);
    });
    return () => {
      cancelled = true;
      view?.destroy();
      viewRef.current = null;
    };
  }, [engine, kits, tokens]);

  useEffect(() => viewRef.current?.setSelected(selected), [selected]);
  useEffect(() => viewRef.current?.setDecision(decision, focusOpt), [decision, focusOpt]);
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => setResult(null), 2800);
    return () => clearTimeout(t);
  }, [result]);
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

  const choose = (opt: DecisionOption) => {
    const d = decisionRef.current;
    if (!d) return;
    if (engine.choose(d.id, opt.id)) {
      // La acción elegida se ve a cámara lenta.
      if (control.current.slowMo) control.current.slowUntil = performance.now() + 2600;
    }
    decisionRef.current = null;
    setDecision(null);
    setFocusOpt(null);
    viewRef.current?.setDecision(null, null);
  };
  const skipDecision = () => {
    engine.skipDecision();
    decisionRef.current = null;
    setDecision(null);
    setFocusOpt(null);
    viewRef.current?.setDecision(null, null);
  };
  const changeFrequency = (f: DecisionFrequency) => {
    setFrequency(f);
    saveFrequency(f);
    engine.setDecisionMode('home', f);
  };

  // Atajos: 1–4 eligen opción, Esc deja decidir al equipo.
  useEffect(() => {
    if (!decision) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const n = Number(e.key);
      if (n >= 1 && n <= decision.options.length) {
        e.preventDefault();
        choose(decision.options[n - 1]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        skipDecision();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decision]);

  const simulateRest = () => {
    skipDecision();
    engine.simulateToEnd();
    ingest(engine.drainEvents(), false);
    setBanners([]);
    setGoalShow(null);
    setResult(null);
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
    if (!finished || (req.mode !== 'cup' && !req.knockout) || snap.score.home !== snap.score.away) return null;
    const shooters = (t: MatchTeamSetup) => [...t.players].sort((a, b) => b.attributes.shooting - a.attributes.shooting).map((p) => p.attributes.shooting);
    const keeper = (t: MatchTeamSetup) => t.players.find((p) => p.position === 'GK')?.attributes.goalkeeping ?? 50;
    const r = penaltyShootout(createRng(snap.score.home * 97 + Math.round(snap.time)), { shooting: shooters(home), keeper: keeper(home) }, { shooting: shooters(away), keeper: keeper(away) });
    return { for: r.home, against: r.away };
  }, [finished, req.mode, snap.score, snap.time, home, away]);

  const reward = finished ? matchReward(snap.score.home, snap.score.away, req.difficulty) : null;
  // Mejor jugador del partido (de cualquiera de los dos equipos).
  const ratings = useMemo(
    () => (finished ? matchRatings(engine.events, { home, away }, snap.score) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [finished],
  );
  const motm = ratings[0];
  const story = useMemo(
    () => (finished ? matchStory(engine.events, { home, away }, snap.score, ratings) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [finished, ratings],
  );

  const close = () => {
    if (finished) {
      const cupReport =
        req.mode === 'cup' || req.mode === 'draft'
          ? reportFromEvents(engine.events, { home: { teamId: USER_ID, setup: home }, away: { teamId: req.opponentId ?? req.opponent.id, setup: away } }, snap.score, cupPlayerName)
          : undefined;
      const g = useGame.getState();
      const perf = ratings
        .filter((x) => x.side === 'home' && g.cards[x.id])
        .map((x) => ({ cardId: x.id, versionId: g.cards[x.id].versionId, score: x.rating, goals: x.goals, assists: x.assists }));
      const newInjuries = engine.events
        .filter((e) => e.type === 'injury' && e.side === 'home' && e.playerId && g.cards[e.playerId])
        .map((e) => ({ cardId: e.playerId!, matches: e.injuryMatches ?? 1 }));
      const scorers = engine.events.filter((e) => e.type === 'goal' && e.side === 'home').map((e) => home.players.find((p) => p.id === e.playerId)?.name ?? '—');
      const r = g.recordMatch({
        perf,
        newInjuries,
        scorers,
        cupReport,
        tournamentId: req.tournamentId,
        mode: req.mode,
        opponent: req.opponent.name,
        goalsFor: snap.score.home,
        goalsAgainst: snap.score.away,
        penalties: penalties ?? undefined,
        difficulty: req.difficulty,
      });
      toast('reward', `+${r.coins.toLocaleString('es-ES')} monedas · +${r.xp} XP${r.levelsGained ? ' · ¡Subes de nivel!' : ''}`);
      if (r.note) setTimeout(() => toast('info', r.note!), 400);
      if (r.totw?.length) {
        const names = r.totw.map((e) => catalog.players.get(catalog.versions.get(e.versionId)!.playerId)!.knownAs).join(', ');
        setTimeout(() => toast('reward', `¡${names} ${r.totw!.length > 1 ? 'entran' : 'entra'} en el Equipo de la Semana! Jugará${r.totw!.length > 1 ? 'n' : ''} el próximo partido con su versión En Forma.`), 900);
      } else if (r.totwWeek) setTimeout(() => toast('info', `Nuevo Equipo de la Semana (semana ${r.totwWeek}) disponible en Colecciones.`), 900);
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
    ...(snap.stats.home.decisions > 0 ? [['Decisiones acertadas', `${snap.stats.home.decisionsWon}/${snap.stats.home.decisions}`, '—'] as [string, string, string]] : []),
  ];
  const awayStyle = PLAY_STYLES[away.tactics.style ?? 'balanced'];

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
          <small className="t-ui muted" title={awayStyle.description}>
            {away.rating} · Q{away.chemistry} · {awayStyle.label}
          </small>
          <span className="t-display">{away.shortName}</span>
          <span className="scoreboard__kit" style={{ background: kits.away.primary }} />
        </div>
        <div className="scoreboard__title t-ui">
          {req.title}
          {req.context && (
            <span className="scoreboard__ctx" title={req.context.notes.join(' · ')}>
              {' · '}
              {WEATHER[req.context.weather].icon} {WEATHER[req.context.weather].label} · {req.context.stadium} · {req.context.attendance}% de aforo
            </span>
          )}
        </div>
      </header>

      <div className="match__layout">
        <div className="match__pitch">
          <div className="match__stage">
            <div className="match__canvas" ref={hostRef} />
            {req.context && <div className="match__weather" data-w={req.context.weather} aria-hidden />}
            {banners[0]?.highlight && (
              <HighlightBanner key={banners[0].id} event={banners[0]} kit={banners[0].side === 'away' ? kits.away.primary : kits.home.primary} />
            )}
            {slowActive && !goalShow && !decision && <span className="slowmo-badge t-ui">Cámara lenta</span>}
            {result?.decision && !goalShow && <DecisionResultToast key={result.id} event={result} />}
            {decision && !goalShow && !finished && (
              <DecisionPanel
                decision={decision}
                time={snap.time}
                focus={focusOpt}
                onFocus={setFocusOpt}
                onChoose={choose}
                onSkip={skipDecision}
                paused={paused}
              />
            )}
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
            <h3 className="t-ui">Intervenciones</h3>
            <Segmented<DecisionFrequency>
              label="Frecuencia de decisiones"
              value={frequency}
              onChange={changeFrequency}
              options={[
                { id: 'off', label: 'No' },
                { id: 'low', label: 'Pocas' },
                { id: 'medium', label: 'Normal' },
                { id: 'high', label: 'Muchas' },
              ]}
            />
            <p className="muted small">
              {frequency === 'off'
                ? 'Partido 100 % simulado: el equipo decide solo.'
                : 'En las jugadas clave el partido se ralentiza y eliges qué hacer. Teclas 1–4 · Esc deja decidir al equipo.'}
            </p>
          </section>

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
                {[...instructionsFor(sel.position), ...(instructionsFor(sel.position).some((i) => i.id === sel.instruction) ? [] : INSTRUCTIONS.filter((i) => i.id === sel.instruction))].map((i) => (
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
                <li key={e.id} data-type={e.type} data-side={e.side ?? 'none'} data-hl={e.highlight?.kind} data-grade={e.decision?.grade}>
                  <span className="feed__min t-num">{e.minute}'</span>
                  <span>
                    {e.decision ? (
                      <>
                        <b>{GRADE_ICON[e.decision.grade]} {e.decision.title}</b> {e.decision.label} · {e.decision.detail}
                      </>
                    ) : e.highlight && e.type === 'highlight' ? (
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
            {story && story.moments.length > 0 && (
              <section className="story" aria-label="Lo mejor del partido">
                <h3 className="story__headline t-display">{story.headline}</h3>
                <ol className="story__list">
                  {story.moments.map((m, i) => (
                    <li key={i} className="story__item" data-side={m.side ?? 'none'} data-icon={m.icon} style={{ '--i': i } as React.CSSProperties}>
                      <span className="story__icon" aria-hidden>
                        {STORY_ICON[m.icon]}
                      </span>
                      <div>
                        <b className="t-ui">
                          {m.minute}' · {m.title}
                        </b>
                        <p>{m.text}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            {motm && (
              <div className="motm" data-mine={motm.side === 'home'}>
                {motm.versionId && <PlayerCard versionId={motm.versionId} size="sm" />}
                <div className="motm__info">
                  <span className="t-eyebrow">Mejor del partido</span>
                  <b className="t-display">{motm.name}</b>
                  <span className="muted small">{motm.side === 'home' ? home.name : away.name}</span>
                  <span className="motm__line t-ui">
                    {[
                      motm.goals && `${motm.goals} ${motm.goals === 1 ? 'gol' : 'goles'}`,
                      motm.assists && `${motm.assists} asist.`,
                      motm.saves && `${motm.saves} ${motm.saves === 1 ? 'parada' : 'paradas'}`,
                      motm.dribbles && `${motm.dribbles} ${motm.dribbles === 1 ? 'regate' : 'regates'}`,
                      motm.tackles + motm.interceptions && `${motm.tackles + motm.interceptions} ${motm.tackles + motm.interceptions === 1 ? 'recuperación' : 'recuperaciones'}`,
                      motm.passes && `${motm.passes} pases`,
                    ]
                      .filter(Boolean)
                      .slice(0, 4)
                      .join(' · ')}
                  </span>
                </div>
                <span className="motm__rating t-num">{motm.rating.toFixed(1)}</span>
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
  injury: { label: 'Lesión', tone: 'card' },
};

const STORY_ICON: Record<StoryMoment['icon'], string> = {
  goal: '⚽',
  wonder: '🌟',
  save: '🧤',
  comeback: '🔥',
  late: '⏱️',
  hattrick: '🎩',
  post: '🥅',
  injury: '🚑',
  penalty: '🎯',
  wall: '🧱',
};

/** Aplica los modificadores de la jornada (clima, moral, entrenamiento…) a un equipo. */
function boosted(t: MatchTeamSetup, delta?: Partial<MatchAttributes>): MatchTeamSetup {
  if (!delta || !Object.keys(delta).length) return t;
  return {
    ...t,
    players: t.players.map((p) => {
      const a = { ...p.attributes };
      for (const [k, v] of Object.entries(delta) as [keyof MatchAttributes, number][]) a[k] = Math.max(1, Math.min(99, a[k] + v));
      return { ...p, attributes: a };
    }),
  };
}

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

// ───────────────────────────── Decisiones ─────────────────────────────

const CONTEXT_LABEL: Record<DecisionPrompt['context'], string> = {
  attack: 'Tu decisión',
  oneonone: 'Ocasión clara',
  setpiece: 'Balón parado',
  defense: 'Defensa',
  keeper: 'Portero',
  aerial: 'Remate',
};
const LIKELIHOOD_SUCCESS: Record<Likelihood, string> = {
  'very-high': 'Muy probable',
  high: 'Probable',
  medium: 'Incierto',
  low: 'Difícil',
  'very-low': 'Muy difícil',
};
const LIKELIHOOD_GOAL: Record<Likelihood, string> = {
  'very-high': 'Gol muy probable',
  high: 'Buena ocasión',
  medium: 'Ocasión',
  low: 'Gol difícil',
  'very-low': 'Gol muy difícil',
};
const PIPS: Record<Likelihood, number> = { 'very-high': 5, high: 4, medium: 3, low: 2, 'very-low': 1 };
const LEVEL_LABEL: Record<Level, string> = { low: 'bajo', medium: 'medio', high: 'alto' };
const GRADE_ICON = { great: '★', good: '✓', partial: '≈', fail: '✗' } as const;

function DecisionPanel({
  decision,
  time,
  focus,
  onFocus,
  onChoose,
  onSkip,
  paused,
}: {
  decision: DecisionPrompt;
  time: number;
  focus: string | null;
  onFocus: (id: string | null) => void;
  onChoose: (o: DecisionOption) => void;
  onSkip: () => void;
  paused: boolean;
}) {
  const left = Math.max(0, Math.min(1, (decision.expiresAt - time) / (decision.expiresAt - decision.createdAt)));
  return (
    <div className="decision" data-context={decision.context} role="dialog" aria-label={`Decisión: ${decision.title}`}>
      <header className="decision__head">
        <span className="decision__ctx t-ui">
          {CONTEXT_LABEL[decision.context]}
          {decision.chain > 0 && <em> · jugada encadenada ×{decision.chain + 1}</em>}
          {paused && <em> · en pausa</em>}
        </span>
        <span className="decision__title t-display">{decision.title}</span>
        <span className="decision__sit">{decision.situation}</span>
        <button className="decision__skip t-ui" onClick={onSkip} title="La IA decide esta jugada (Esc)">
          Que decida el equipo
        </button>
      </header>
      <div className="decision__timer" aria-hidden>
        <span style={{ transform: `scaleX(${left})` }} data-low={left < 0.3} />
      </div>
      <div className="decision__options" data-n={decision.options.length}>
        {decision.options.map((o, i) => (
          <button
            key={o.id}
            className="dopt"
            data-family={o.family}
            data-focus={focus === o.id}
            data-trait={!!o.trait}
            onMouseEnter={() => onFocus(o.id)}
            onMouseLeave={() => onFocus(null)}
            onFocus={() => onFocus(o.id)}
            onBlur={() => onFocus(null)}
            onClick={() => onChoose(o)}
          >
            <span className="dopt__key t-num">{i + 1}</span>
            <span className="dopt__body">
              <span className="dopt__label">{o.label}</span>
              <span className="dopt__detail t-ui">{o.detail}</span>
              {o.trait && <span className="dopt__trait t-ui">★ {o.trait}</span>}
            </span>
            <span className="dopt__meta">
              <span className="dopt__chance" data-lk={o.likelihood} title={`${Math.round(o.chance * 100)} %`}>
                <span className="dopt__pips" aria-hidden>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <i key={n} data-on={n <= PIPS[o.likelihood]} />
                  ))}
                </span>
                <span className="t-ui">{(o.measure === 'goal' ? LIKELIHOOD_GOAL : LIKELIHOOD_SUCCESS)[o.likelihood]}</span>
              </span>
              <span className="dopt__risk t-ui" data-level={o.risk}>
                Riesgo {LEVEL_LABEL[o.risk]}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Resultado de la decisión: éxito, a medias o fallo. */
function DecisionResultToast({ event }: { event: MatchEvent }) {
  const d = event.decision!;
  return (
    <div className="dresult" data-grade={d.grade} role="status" aria-live="polite">
      <span className="dresult__icon">{GRADE_ICON[d.grade]}</span>
      <span className="dresult__body">
        <span className="dresult__title t-display">{d.title}</span>
        <span className="dresult__detail">{d.detail}</span>
      </span>
    </div>
  );
}
