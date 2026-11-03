import { useEffect, useMemo, useState, type DragEvent } from 'react';
import {
  calculateChemistry,
  FORMATION_IDS,
  INSTRUCTIONS,
  MENTALITY_LABELS,
  positionFit,
  POSITION_LABELS,
  squadCardIds,
  statEntries,
  type FormationId,
  type Mentality,
  type PlayerInstruction,
  type ResolvedCard,
  type SlotRef,
} from '@fu/domain';
import { PlayerCard, versionLabel } from '../../components/card/PlayerCard';
import { editionStyle, getEdition } from '../../components/card/editions';
import { Icon } from '../../components/ui/icons';
import { Button, ChemDots, Drawer, Meter, Panel, Segmented } from '../../components/ui/ui';
import { MANAGERS, resolve } from '../../data/catalog';
import { useGame } from '../../state/gameStore';
import { toChemPlayer, useSquadView, type SquadView } from '../../state/squadView';
import { feedback, useUi } from '../../state/uiStore';
import { Pitch } from './Pitch';
import './squad.css';

const FIT_LABEL = { natural: 'Posición natural', related: 'Posición relacionada', poor: 'Fuera de posición' } as const;
const STRENGTH_LABEL = { strong: 'Fuerte', medium: 'Intermedia', weak: 'Débil' } as const;

function sameRef(a: SlotRef | null, b: SlotRef | null) {
  return !!a && !!b && a.zone === b.zone && a.index === b.index;
}

export function SquadScreen() {
  const view = useSquadView();
  const squad = useGame((s) => s.squad);
  const cards = useGame((s) => s.cards);
  const myListings = useGame((s) => s.myListings);
  const { placeInSlot, swap, setFormation, autoFill } = useGame.getState();
  const intent = useUi((s) => s.intent);
  const clearIntent = useUi((s) => s.clearIntent);
  const [selected, setSelected] = useState<SlotRef | null>(null);
  const [tacticsOpen, setTacticsOpen] = useState(false);

  useEffect(() => {
    if (intent === 'tactics') {
      setTacticsOpen(true);
      clearIntent();
    }
  }, [intent, clearIntent]);

  const reserves = useMemo(() => {
    const inSquad = new Set(squadCardIds(squad));
    const listed = new Set(myListings.filter((l) => l.status === 'active').map((l) => l.cardId));
    return Object.values(cards)
      .filter((c) => !inSquad.has(c.id) && !listed.has(c.id))
      .map(resolve)
      .sort((a, b) => b.version.rating - a.version.rating);
  }, [cards, squad, myListings]);

  const onSlot = (ref: SlotRef) => {
    if (sameRef(selected, ref)) return setSelected(null);
    if (selected) {
      const a = selected;
      const hasA = !!(a.zone === 'starter' ? squad.starters : squad.bench)[a.index];
      const hasB = !!(ref.zone === 'starter' ? squad.starters : squad.bench)[ref.index];
      if (hasA || hasB) {
        swap(a, ref);
        setSelected(null);
        return;
      }
    }
    setSelected(ref);
  };

  const onDropTo = (ref: SlotRef, e: DragEvent) => {
    const slot = e.dataTransfer.getData('text/slot');
    const card = e.dataTransfer.getData('text/card');
    if (slot) swap(JSON.parse(slot) as SlotRef, ref);
    else if (card) feedback(placeInSlot(ref, card));
    setSelected(null);
  };

  const placeSelected = (cardId: string) => {
    if (!selected) return;
    if (feedback(placeInSlot(selected, cardId))) setSelected(null);
  };

  const strong = view.chemistry.links.filter((l) => l.strength === 'strong').length;
  const medium = view.chemistry.links.filter((l) => l.strength === 'medium').length;
  const weak = view.chemistry.links.filter((l) => l.strength === 'weak').length;

  return (
    <div className="squad">
      <header className="squad__header">
        <div className="squad__title">
          <span className="t-eyebrow">Plantilla activa</span>
          <h1 className="t-display">{squad.name}</h1>
        </div>
        <div className="squad__kpis">
          <div className="kpi">
            <span className="kpi__value t-num">{view.rating}</span>
            <span className="kpi__label t-ui">Valoración</span>
          </div>
          <div className="kpi">
            <span className="kpi__value t-num" data-tone={view.chemistry.team >= 75 ? 'good' : view.chemistry.team >= 45 ? 'mid' : 'low'}>
              {view.chemistry.team}
            </span>
            <span className="kpi__label t-ui">Química</span>
            <Meter value={view.chemistry.team} max={100} tone="green" label="Química del equipo" />
          </div>
          <div className="kpi kpi--links" title="Conexiones de química">
            <span className="link-count" data-s="strong">
              {strong}
            </span>
            <span className="link-count" data-s="medium">
              {medium}
            </span>
            <span className="link-count" data-s="weak">
              {weak}
            </span>
            <span className="kpi__label t-ui">Conexiones</span>
          </div>
        </div>
        <div className="squad__actions">
          <label className="select">
            <span className="t-ui">Formación</span>
            <select value={squad.formationId} onChange={(e) => setFormation(e.target.value as FormationId)} aria-label="Formación">
              {FORMATION_IDS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <Button icon={<Icon.Tactics />} onClick={() => setTacticsOpen(true)}>
            Tácticas
          </Button>
          <Button icon={<Icon.Wand />} onClick={() => (feedback(autoFill()), setSelected(null))}>
            Autocompletar
          </Button>
        </div>
      </header>

      <div className="squad__layout">
        <div className="squad__pitch-col">
          <div className="pitch-wrap">
            <Pitch view={view} selected={selected} onSlot={onSlot} onDropTo={onDropTo} />
          </div>
          <Bench view={view} selected={selected} onSlot={onSlot} onDropTo={onDropTo} />
        </div>

        <aside className="squad__side">
          {selected ? (
            <SelectedPanel view={view} slot={selected} reserves={reserves} onPlace={placeSelected} onClose={() => setSelected(null)} />
          ) : (
            <SummaryPanel view={view} reserves={reserves} />
          )}
        </aside>
      </div>

      <TacticsDrawer open={tacticsOpen} onClose={() => setTacticsOpen(false)} view={view} />
    </div>
  );
}

function Bench({
  view,
  selected,
  onSlot,
  onDropTo,
}: {
  view: SquadView;
  selected: SlotRef | null;
  onSlot: (r: SlotRef) => void;
  onDropTo: (r: SlotRef, e: DragEvent) => void;
}) {
  return (
    <section className="bench" aria-label="Suplentes">
      <h2 className="bench__title t-ui">Suplentes</h2>
      <div className="bench__row">
        {view.bench.map((r, i) => {
          const ref: SlotRef = { zone: 'bench', index: i };
          const isSel = sameRef(selected, ref);
          return (
            <div
              key={i}
              className="bench__slot"
              data-selected={isSel}
              draggable={!!r}
              onDragStart={(e) => e.dataTransfer.setData('text/slot', JSON.stringify(ref))}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDropTo(ref, e)}
            >
              {r ? (
                <PlayerCard card={r.card} size="xs" width="100%" selected={isSel} onClick={() => onSlot(ref)} />
              ) : (
                <button className="slot__empty slot__empty--bench" onClick={() => onSlot(ref)} aria-label={`Suplente ${i + 1} vacío`}>
                  <span className="t-ui">+</span>
                </button>
              )}
              <span className="bench__label t-ui">SUP {i + 1}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SummaryPanel({ view, reserves }: { view: SquadView; reserves: ResolvedCard[] }) {
  const setManager = useGame((s) => s.setManager);
  const managerId = useGame((s) => s.squad.managerId);
  return (
    <div className="side-stack stagger">
      <Panel title="Resumen táctico">
        <p className="side-text">{view.formation.style}.</p>
        <p className="side-text muted">
          Selecciona una carta para ver sus estadísticas y conexiones, o arrástrala sobre otra para intercambiarlas. Las líneas verdes, amarillas y rojas indican la fuerza real de cada enlace.
        </p>
        <label className="select select--block">
          <span className="t-ui">Mánager</span>
          <select value={managerId ?? ''} onChange={(e) => setManager(e.target.value || null)}>
            <option value="">Sin mánager</option>
            {MANAGERS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} · {m.nationCode.toUpperCase()} · {m.leagueId}
              </option>
            ))}
          </select>
        </label>
        <p className="side-text muted small">El mánager suma +1 de química a los jugadores de su nación o liga.</p>
      </Panel>
      <Panel title={`Reservas · ${reserves.length}`}>
        <p className="side-text muted small">Arrastra una reserva sobre una posición o selecciona primero la posición.</p>
        <ul className="alt-list">
          {reserves.slice(0, 14).map((r) => (
            <li
              key={r.card.id}
              className="alt-row"
              draggable
              onDragStart={(e) => e.dataTransfer.setData('text/card', r.card.id)}
              style={editionStyle(r.version.year)}
            >
              <span className="alt-row__rating t-num">{r.version.rating}</span>
              <span className="alt-row__pos t-ui">{POSITION_LABELS[r.position]}</span>
              <span className="alt-row__name">
                <b>{r.player.knownAs}</b>
                <small>{versionLabel(r.version.label, r.version.season)}{r.player.icon ? ' · Icono' : ''}</small>
              </span>
              <span className="alt-row__rarity" />
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function SelectedPanel({
  view,
  slot,
  reserves,
  onPlace,
  onClose,
}: {
  view: SquadView;
  slot: SlotRef;
  reserves: ResolvedCard[];
  onPlace: (cardId: string) => void;
  onClose: () => void;
}) {
  const removeFromSlot = useGame((s) => s.removeFromSlot);
  const instructions = useGame((s) => s.squad.instructions);
  const setInstruction = useGame((s) => s.setInstruction);
  const isStarter = slot.zone === 'starter';
  const r = isStarter ? view.starters[slot.index] : view.bench[slot.index];
  const slotPos = isStarter ? view.formation.slots[slot.index].position : r?.position ?? null;
  const chem = isStarter ? view.chemistry.players[slot.index] : null;
  const links = isStarter ? view.chemistry.links.filter((l) => l.a === slot.index || l.b === slot.index) : [];

  // Alternativas con química proyectada (cálculo real con el cambio aplicado).
  const alternatives = useMemo(() => {
    const current = isStarter ? view.starters[slot.index] : view.bench[slot.index];
    const squadPlayers = new Set(
      [...view.starters, ...view.bench].filter((x) => x && x.card.id !== current?.card.id).map((x) => x!.player.id),
    );
    // Reservas cuyo futbolista no esté ya en la plantilla + suplentes (intercambio directo).
    const pool = [
      ...reserves.filter((c) => !squadPlayers.has(c.player.id)),
      ...(isStarter ? view.bench.filter((b): b is ResolvedCard => !!b) : []),
    ];
    return pool
      .map((c) => {
        let projected: number | null = null;
        let delta = 0;
        if (isStarter) {
          const slots = view.starters.map((s) => (s ? toChemPlayer(s) : null));
          const before = view.chemistry.team;
          slots[slot.index] = toChemPlayer(c);
          const res = calculateChemistry(view.formation, slots, view.manager ? { nationCode: view.manager.nationCode, leagueId: view.manager.leagueId } : null);
          projected = res.players[slot.index]?.value ?? 0;
          delta = res.team - before;
        }
        const fit = slotPos ? positionFit(c.position, c.version.altPositions, slotPos) : 'natural';
        return { c, projected, delta, fit };
      })
      .sort((a, b) => {
        const fo = { natural: 0, related: 1, poor: 2 } as const;
        return fo[a.fit] - fo[b.fit] || (b.projected ?? 0) - (a.projected ?? 0) || b.c.version.rating - a.c.version.rating;
      })
      .slice(0, 12);
  }, [reserves, view, slot, isStarter, slotPos]);

  return (
    <div className="side-stack">
      <Panel
        className="selected-panel"
        title={isStarter ? `Posición · ${slotPos ? POSITION_LABELS[slotPos] : ''}` : `Suplente ${slot.index + 1}`}
        aside={
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar selección">
            <Icon.Close size={16} />
          </button>
        }
      >
        {r ? (
          <div className="selected">
            <PlayerCard card={r.card} size="md" tilt interactive />
            <div className="selected__info">
              <h3 className="t-display">{r.player.knownAs}</h3>
              <span className="muted small">
                {versionLabel(r.version.label, r.version.season)} · {r.club.name} · {r.league.name}
              </span>
              <div className="selected__tags">
                <span className="tag tag--edition" style={editionStyle(r.version.year)}>
                  Edición {getEdition(r.version.year).name} {r.version.year}
                </span>
                {r.player.icon && <span className="tag tag--icon">★ Icono</span>}
                {r.card.loyal && <span className="tag tag--gold">Lealtad</span>}
              </div>
              <div className="stat-bars">
                {statEntries(r.version.stats).map((s) => (
                  <div key={s.key} className="stat-bar">
                    <span className="t-ui">{s.label}</span>
                    <span className="stat-bar__track">
                      <span style={{ width: `${s.value}%` }} data-tier={s.value >= 85 ? 'hi' : s.value >= 70 ? 'mid' : 'lo'} />
                    </span>
                    <b className="t-num">{s.value}</b>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="side-text muted">Posición vacía. Elige un futbolista de tu club.</p>
        )}

        {chem && (
          <div className="chem-breakdown">
            <div className="chem-breakdown__head">
              <span className="t-ui">Química individual</span>
              <ChemDots value={chem.value} />
            </div>
            <ul>
              <li>
                <span>{FIT_LABEL[chem.fit]}</span>
                <b data-fit={chem.fit}>{chem.fit === 'natural' ? '✓' : chem.fit === 'related' ? '≈' : '✕'}</b>
              </li>
              <li>
                <span>Media de enlaces</span>
                <b className="t-num">{chem.linkAverage.toFixed(2)} / 2</b>
              </li>
              <li>
                <span>Base</span>
                <b className="t-num">{chem.base}</b>
              </li>
              <li>
                <span>Lealtad</span>
                <b className="t-num">+{chem.loyaltyBonus}</b>
              </li>
              <li>
                <span>Mánager</span>
                <b className="t-num">+{chem.managerBonus}</b>
              </li>
            </ul>
            <div className="link-list">
              {links.map((l) => {
                const other = l.a === slot.index ? l.b : l.a;
                const o = view.starters[other];
                const reasons = [l.shared.club && 'Club', l.shared.league && 'Liga', l.shared.nation && 'Nación', l.shared.icon && 'Icono'].filter(Boolean);
                return (
                  <div key={other} className="link-item" data-strength={l.strength ?? 'empty'}>
                    <span className="link-item__dot" />
                    <span className="link-item__name">{o ? o.player.knownAs : `${POSITION_LABELS[view.formation.slots[other].position]} vacío`}</span>
                    <span className="link-item__why muted">{l.strength ? `${STRENGTH_LABEL[l.strength]}${reasons.length ? ' · ' + reasons.join(' + ') : ''}` : '—'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {r && isStarter && (
          <label className="select select--block">
            <span className="t-ui">Instrucción por defecto</span>
            <select value={instructions[r.card.id] ?? 'none'} onChange={(e) => setInstruction(r.card.id, e.target.value as PlayerInstruction)}>
              {INSTRUCTIONS.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {r && (
          <Button size="sm" variant="danger" onClick={() => (removeFromSlot(slot), onClose())}>
            Quitar de la plantilla
          </Button>
        )}
      </Panel>

      <Panel title="Sustituir por">
        {alternatives.length === 0 && <p className="side-text muted">No hay cartas disponibles en tu club.</p>}
        <ul className="alt-list">
          {alternatives.map(({ c, projected, delta, fit }) => (
            <li key={c.card.id}>
              <button className="alt-row" onClick={() => onPlace(c.card.id)} style={editionStyle(c.version.year)}>
                <span className="alt-row__rating t-num">{c.version.rating}</span>
                <span className="alt-row__pos t-ui" data-fit={fit}>
                  {POSITION_LABELS[c.position]}
                </span>
                <span className="alt-row__name">
                  <b>{c.player.knownAs}</b>
                  <small>
                    {versionLabel(c.version.label, c.version.season)} · {c.club.shortName}
                    {c.player.icon ? ' · Icono' : ''}
                  </small>
                </span>
                {projected !== null && (
                  <span className="alt-row__chem">
                    <ChemDots value={projected} />
                    <small className="t-num" data-delta={delta > 0 ? 'up' : delta < 0 ? 'down' : 'eq'}>
                      {delta > 0 ? `+${delta}` : delta}
                    </small>
                  </span>
                )}
                <span className="alt-row__rarity" />
              </button>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}


function TacticsDrawer({ open, onClose, view }: { open: boolean; onClose: () => void; view: SquadView }) {
  const tactics = useGame((s) => s.squad.tactics);
  const setTactics = useGame((s) => s.setTactics);
  const sliders: { key: 'pressing' | 'width' | 'depth' | 'tempo'; label: string; low: string; high: string }[] = [
    { key: 'pressing', label: 'Presión', low: 'Esperar', high: 'Asfixiante' },
    { key: 'width', label: 'Amplitud', low: 'Estrecho', high: 'Abierto' },
    { key: 'depth', label: 'Altura de la defensa', low: 'Baja', high: 'Alta' },
    { key: 'tempo', label: 'Ritmo', low: 'Pausado', high: 'Vertical' },
  ];
  return (
    <Drawer open={open} onClose={onClose} title="Tácticas">
      <div className="tactics">
        <div className="tactics__row">
          <span className="t-ui">Mentalidad</span>
          <Segmented<Mentality>
            label="Mentalidad"
            value={tactics.mentality}
            onChange={(m) => setTactics({ mentality: m })}
            options={(['defensive', 'balanced', 'attacking'] as Mentality[]).map((m) => ({ id: m, label: MENTALITY_LABELS[m] }))}
          />
        </div>
        {sliders.map((s) => (
          <label key={s.key} className="tactics__slider">
            <span className="tactics__slider-head">
              <span className="t-ui">{s.label}</span>
              <b className="t-num">{tactics[s.key]}</b>
            </span>
            <input type="range" min={0} max={100} step={5} value={tactics[s.key]} onChange={(e) => setTactics({ [s.key]: Number(e.target.value) })} />
            <span className="tactics__slider-ends muted">
              <span>{s.low}</span>
              <span>{s.high}</span>
            </span>
          </label>
        ))}
        <p className="side-text muted small">
          Las tácticas se aplican en el simulador: altura de línea, amplitud, presión sobre el poseedor y verticalidad de los pases. Formación actual: {view.formation.name}.
        </p>
      </div>
    </Drawer>
  );
}
