import { useMemo, useState } from 'react';
import { createCard, createEmptySquad, getFormation, POSITION_LABELS, type FormationId, type PlayerCard as Card, type SlotRef } from '@fu/domain';
import { PlayerCard } from '../components/card/PlayerCard';
import { Icon } from '../components/ui/icons';
import { Button, Coins, Drawer } from '../components/ui/ui';
import { catalog } from '../data/catalog';
import { useGame } from '../state/gameStore';
import { computeSquadView } from '../state/squadView';
import { userToMatchSetup } from '../state/teams';
import {
  DRAFT_FEE,
  DRAFT_PRIZES,
  draftChemistry,
  draftComplete,
  GROUP_LETTERS,
  groupTable,
  nationTeam,
  nextUserFixture,
  STAGE_LABEL,
  teamOf,
  USER_DRAFT,
  type DraftFixture,
  type DraftStage,
  type DraftState,
} from '../state/draft';
import type { CupState } from '../state/cup';
import { feedback, type MatchRequest } from '../state/uiStore';
import { CupStats } from './CupView';
import { Pitch } from './squad/Pitch';
import './draft.css';

const KO: DraftStage[] = ['r16', 'qf', 'sf', 'final'];

/** Plantilla "virtual" del draft (cartas temporales) para reutilizar campo, química y motor. */
function draftView(d: DraftState, name: string) {
  const squad = createEmptySquad(name, d.formationId ?? '4-3-3');
  const cards: Record<string, Card> = {};
  squad.starters = d.slots.map((v, i) => {
    if (!v) return null;
    const id = `draft-${i}`;
    cards[id] = createCard(id, v, 'reward', 0);
    return id;
  });
  return { squad, cards, view: computeSquadView(squad, cards) };
}

export function DraftView({ onPlay }: { onPlay: (m: MatchRequest) => void }) {
  const d = useGame((s) => s.draft);
  const coins = useGame((s) => s.coins);
  if (d.status === 'idle') return <DraftIntro d={d} coins={coins} />;
  if (d.status === 'drafting') {
    if (d.step === 'captain') return <CaptainStep d={d} />;
    if (d.step === 'formation') return <FormationStep d={d} />;
    return <PlayersStep d={d} />;
  }
  return <Tournament d={d} onPlay={onPlay} />;
}

function DraftIntro({ d, coins }: { d: DraftState; coins: number }) {
  return (
    <section className="draft-intro panel">
      <div>
        <span className="t-eyebrow">Modo Draft</span>
        <h3 className="t-display">Mundial Draft</h3>
        <p>
          Elige a tu <b>capitán</b> entre 5, una <b>formación</b> entre 5 al azar y, para cada posición, <b>1 de 5 futbolistas aleatorios</b>: actuales, temporadas
          pasadas, especiales, Iconos e Históricos. Las cartas 90+ son poco frecuentes: la química y el encaje cuentan.
        </p>
        <p>
          Con tu once disputas un <b>Mundial de 32 selecciones</b>: 8 grupos de 4 (pasan los 2 primeros), octavos, cuartos, semifinal y final, con goleadores,
          asistentes y porterías a cero propios. Las cartas del draft no pasan a tu club.
        </p>
        {d.edition > 0 && (
          <p className="muted small">
            Mundiales jugados: {d.edition} · Títulos: {d.titles} {d.best && `· Mejor resultado: ${d.best === 'champion' ? 'Campeón' : STAGE_LABEL[d.best]}`}
          </p>
        )}
      </div>
      <div className="draft-intro__side">
        <span className="t-ui muted">Premios</span>
        <ul className="draft-prizes">
          {(['champion', 'final', 'sf', 'qf', 'r16', 'group'] as const).map((k) => (
            <li key={k}>
              <span>{k === 'champion' ? '🏆 Campeón' : k === 'final' ? 'Subcampeón' : k === 'group' ? 'Fase de grupos' : STAGE_LABEL[k]}</span>
              <Coins value={DRAFT_PRIZES[k]} size="sm" />
            </li>
          ))}
        </ul>
        <Button variant="gold" size="lg" icon={<Icon.Play size={14} />} disabled={coins < DRAFT_FEE} onClick={() => feedback(useGame.getState().draftStart())}>
          Empezar draft · {DRAFT_FEE.toLocaleString('es-ES')}
        </Button>
      </div>
    </section>
  );
}

function CaptainStep({ d }: { d: DraftState }) {
  return (
    <section className="draft-step panel">
      <header className="draft-step__head">
        <span className="t-eyebrow">Paso 1 de 3</span>
        <h3 className="t-display">Elige a tu capitán</h3>
        <p className="muted">Será el primer jugador de tu once y ocupará su posición en la formación que elijas.</p>
      </header>
      <div className="draft-picks">
        {d.captainOptions.map((id) => (
          <PlayerCard key={id} versionId={id} size="md" interactive tilt onClick={() => useGame.getState().draftCaptain(id)} />
        ))}
      </div>
    </section>
  );
}

function MiniFormation({ id }: { id: FormationId }) {
  const f = getFormation(id);
  return (
    <svg viewBox="0 0 100 100" className="mini-formation" aria-hidden>
      <rect x="1" y="1" width="98" height="98" rx="4" />
      <line x1="1" y1="50" x2="99" y2="50" />
      {f.slots.map((s) => (
        <circle key={s.index} cx={s.x} cy={s.y} r="4.2" />
      ))}
    </svg>
  );
}

function FormationStep({ d }: { d: DraftState }) {
  const cap = catalog.versions.get(d.captain!)!;
  return (
    <section className="draft-step panel">
      <header className="draft-step__head">
        <span className="t-eyebrow">Paso 2 de 3</span>
        <h3 className="t-display">Elige la formación</h3>
        <p className="muted">
          Tu capitán, {catalog.players.get(cap.playerId)!.knownAs} ({POSITION_LABELS[cap.position]}), se colocará en su mejor posición.
        </p>
      </header>
      <div className="draft-formations">
        {d.formationOptions.map((id) => (
          <button key={id} className="draft-formation" onClick={() => useGame.getState().draftFormation(id)}>
            <MiniFormation id={id} />
            <b className="t-display">{getFormation(id).name}</b>
            <small className="muted">{getFormation(id).style}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function PlayersStep({ d }: { d: DraftState }) {
  const name = useGame((s) => s.squad.name);
  const [slot, setSlot] = useState<number | null>(null);
  const { view } = useMemo(() => draftView(d, name), [d, name]);
  const filled = d.slots.filter(Boolean).length;
  const formation = getFormation(d.formationId!);
  const open = (ref: SlotRef) => {
    if (ref.zone !== 'starter' || d.slots[ref.index]) return;
    useGame.getState().draftOptions(ref.index);
    setSlot(ref.index);
  };
  const options = slot !== null ? (d.options[slot] ?? []) : [];
  return (
    <div className="draft-build">
      <div className="draft-build__pitch">
        <Pitch view={view} selected={slot !== null ? { zone: 'starter', index: slot } : null} onSlot={open} onDropTo={() => {}} />
      </div>
      <aside className="draft-build__side panel">
        <span className="t-eyebrow">Paso 3 de 3</span>
        <h3 className="t-display">Completa tu once</h3>
        <p className="muted small">Pulsa una posición vacía para ver 5 futbolistas al azar. Cada elección es definitiva.</p>
        <div className="draft-build__stats">
          <div>
            <b className="t-num">{view.rating}</b>
            <span className="t-ui">Media</span>
          </div>
          <div>
            <b className="t-num">{view.chemistry.team}</b>
            <span className="t-ui">Química</span>
          </div>
          <div>
            <b className="t-num">{filled}/11</b>
            <span className="t-ui">Elegidos</span>
          </div>
        </div>
        <Button variant="gold" size="lg" disabled={!draftComplete(d)} onClick={() => feedback(useGame.getState().draftBegin())}>
          Comenzar el Mundial
        </Button>
        <button className="link-btn t-ui" onClick={() => useGame.getState().draftAbandon()}>
          Abandonar draft (se pierde la entrada)
        </button>
      </aside>
      <Drawer open={slot !== null} onClose={() => setSlot(null)} title={slot !== null ? `Elige tu ${POSITION_LABELS[formation.slots[slot].position]}` : ''} wide>
        <div className="draft-options">
          {options.map((id) => {
            const next = [...d.slots];
            if (slot !== null) next[slot] = id;
            const after = draftChemistry(d.formationId!, next);
            const chemSlot = slot !== null ? (after.chem.players[slot]?.value ?? 0) : 0;
            return (
              <div key={id} className="draft-option">
                <PlayerCard
                  versionId={id}
                  size="md"
                  interactive
                  tilt
                  onClick={() => {
                    if (slot === null) return;
                    useGame.getState().draftPick(slot, id);
                    setSlot(null);
                  }}
                />
                <span className="t-ui small">
                  Química del jugador {chemSlot}/10 · Equipo {after.chem.team}
                </span>
              </div>
            );
          })}
        </div>
      </Drawer>
    </div>
  );
}

function FixtureRow({ d, f }: { d: DraftState; f: DraftFixture }) {
  const h = teamOf(d, f.home);
  const a = teamOf(d, f.away);
  return (
    <li className="dfx" data-user={f.home === USER_DRAFT || f.away === USER_DRAFT}>
      <span data-win={f.winner === f.home}>{h.name}</span>
      <b className="t-num">
        {f.result ? `${f.result.home} – ${f.result.away}` : 'vs'}
        {f.result?.pens && <small> ({f.result.pens.home}-{f.result.pens.away} p.)</small>}
      </b>
      <span data-win={f.winner === f.away}>{a.name}</span>
    </li>
  );
}

function Tournament({ d, onPlay }: { d: DraftState; onPlay: (m: MatchRequest) => void }) {
  const name = useGame((s) => s.squad.name);
  const tactics = useGame((s) => s.squad.tactics);
  const fx = nextUserFixture(d);
  const userGroup = d.groups.findIndex((g) => g.includes(USER_DRAFT));
  const [tab, setTab] = useState<'groups' | 'ko'>(d.fixtures.some((f) => f.stage !== 'group') ? 'ko' : 'groups');
  const rivalId = fx ? (fx.home === USER_DRAFT ? fx.away : fx.home) : null;
  const rival = rivalId ? nationTeam(teamOf(d, rivalId).nationCode!) : null;
  const statsCup = { players: d.players, teams: d.teams, fixtures: d.fixtures } as unknown as CupState;

  const play = () => {
    if (!fx || !rival || !rivalId) return;
    const { view } = draftView(d, name);
    const userSetup = userToMatchSetup(view, name, tactics, {});
    const label = fx.stage === 'group' ? `Grupo ${GROUP_LETTERS[fx.group!]} · Jornada ${fx.round + 1}` : STAGE_LABEL[fx.stage];
    onPlay({ mode: 'draft', opponent: rival, opponentId: rivalId, difficulty: rival.difficulty, title: `Mundial Draft · ${label}`, userSetup, knockout: fx.stage !== 'group' });
  };

  return (
    <div className="draft-cup">
      <section className="draft-cup__head panel">
        <div>
          <span className="t-eyebrow">Mundial Draft · edición {d.edition}</span>
          <h3 className="t-display">
            {d.status === 'won' ? '🏆 ¡Campeón del mundo!' : d.status === 'eliminated' ? 'Eliminado' : fx ? (fx.stage === 'group' ? `Fase de grupos · Jornada ${fx.round + 1}` : STAGE_LABEL[fx.stage]) : 'Mundial'}
          </h3>
          {d.champion && <p className="muted">Campeón: {teamOf(d, d.champion).name}</p>}
          {d.prize !== undefined && (
            <p>
              Premio cobrado: <Coins value={d.prize} size="sm" />
            </p>
          )}
        </div>
        {fx && rival ? (
          <div className="draft-next">
            <span className="t-ui muted">Próximo partido</span>
            <b className="t-display">
              {name} vs {rival.name}
            </b>
            <span className="small muted">
              Media {rival.rating} · {rival.formationId}
            </span>
            <Button variant="gold" icon={<Icon.Play size={14} />} onClick={play}>
              Jugar
            </Button>
          </div>
        ) : (
          <Button variant="gold" onClick={() => useGame.getState().draftAbandon()}>
            Nuevo draft
          </Button>
        )}
      </section>

      <div className="segmented draft-cup__tabs" role="group" aria-label="Vista del torneo">
        <button data-active={tab === 'groups'} aria-pressed={tab === 'groups'} onClick={() => setTab('groups')}>
          Grupos
        </button>
        <button data-active={tab === 'ko'} aria-pressed={tab === 'ko'} onClick={() => setTab('ko')}>
          Eliminatorias
        </button>
      </div>

      {tab === 'groups' ? (
        <div className="draft-groups">
          {d.groups.map((g, gi) => (
            <section key={gi} className="panel draft-group" data-user={gi === userGroup}>
              <h4 className="t-ui">Grupo {GROUP_LETTERS[gi]}</h4>
              <table className="ltable">
                <thead>
                  <tr>
                    <th className="ltable__team">Selección</th>
                    <th>PJ</th>
                    <th>DG</th>
                    <th>Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {groupTable(d, gi).map((r, i) => (
                    <tr key={r.id} data-me={r.id === USER_DRAFT} data-zone={i < 2 ? 'up' : undefined}>
                      <td className="ltable__team">
                        <span className="ltable__kit" style={{ background: teamOf(d, r.id).colors.primary, borderColor: teamOf(d, r.id).colors.secondary }} />
                        {teamOf(d, r.id).name}
                      </td>
                      <td className="t-num">{r.p}</td>
                      <td className="t-num">{r.gf - r.ga}</td>
                      <td className="t-num">
                        <b>{r.pts}</b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {gi === userGroup && (
                <ul className="dfx-list">
                  {d.fixtures
                    .filter((f) => f.stage === 'group' && f.group === gi)
                    .map((f) => (
                      <FixtureRow key={f.id} d={d} f={f} />
                    ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      ) : (
        <div className="draft-ko">
          {KO.map((st) => {
            const list = d.fixtures.filter((f) => f.stage === st).sort((a, b) => a.slot - b.slot);
            return (
              <section key={st} className="panel">
                <h4 className="t-ui">{STAGE_LABEL[st]}</h4>
                {list.length ? (
                  <ul className="dfx-list">
                    {list.map((f) => (
                      <FixtureRow key={f.id} d={d} f={f} />
                    ))}
                  </ul>
                ) : (
                  <p className="muted small">Por decidir</p>
                )}
              </section>
            );
          })}
        </div>
      )}
      <CupStats cup={statsCup} />
    </div>
  );
}
