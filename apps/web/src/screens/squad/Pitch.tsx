import type { DragEvent } from 'react';
import { POSITION_LABELS, type LinkResult, type SlotRef } from '@fu/domain';
import { PlayerCard } from '../../components/card/PlayerCard';
import { ChemDots } from '../../components/ui/ui';
import type { SquadView } from '../../state/squadView';

/** Medidas de carta sobre el campo, en % del lado del campo (cuadrado). */
export const SLOT_W = 12.5;
export const SLOT_H = SLOT_W * 1.4;

/** Recorta una conexión para que empiece y termine en el borde de las cartas. */
function edgeSegment(ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const hw = SLOT_W / 2 + 0.6;
  const hh = SLOT_H / 2 + 0.6;
  const t = Math.min(dx === 0 ? Infinity : hw / Math.abs(dx), dy === 0 ? Infinity : hh / Math.abs(dy));
  if (t >= 0.5) return null;
  return { x1: ax + dx * t, y1: ay + dy * t, x2: bx - dx * t, y2: by - dy * t };
}

export function ChemLines({ view, focus }: { view: SquadView; focus: number | null }) {
  return (
    <svg key={view.formation.id} className="chem-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      {view.chemistry.links.map((l: LinkResult) => {
        const a = view.formation.slots[l.a];
        const b = view.formation.slots[l.b];
        const seg = edgeSegment(a.x, a.y, b.x, b.y);
        if (!seg) return null;
        const touches = focus === null || l.a === focus || l.b === focus;
        return (
          <g key={`${l.a}-${l.b}`} className="chem-link" data-strength={l.strength ?? 'empty'} data-focus={focus !== null && touches} data-dim={!touches}>
            <line {...seg} className="chem-link__glow" />
            <line {...seg} className="chem-link__core" />
          </g>
        );
      })}
    </svg>
  );
}

export function Pitch({
  view,
  selected,
  onSlot,
  onDropTo,
}: {
  view: SquadView;
  selected: SlotRef | null;
  onSlot: (ref: SlotRef) => void;
  onDropTo: (ref: SlotRef, e: DragEvent) => void;
}) {
  const focus = selected?.zone === 'starter' ? selected.index : null;
  return (
    <div className="pitch" data-formation={view.formation.id}>
      <div className="pitch__grass" aria-hidden>
        <div className="pitch__markings">
          <span className="pitch__halfway" />
          <span className="pitch__circle" />
          <span className="pitch__box pitch__box--top" />
          <span className="pitch__box pitch__box--bottom" />
          <span className="pitch__six pitch__six--top" />
          <span className="pitch__six pitch__six--bottom" />
        </div>
      </div>
      <ChemLines view={view} focus={focus} />
      {view.formation.slots.map((slot) => {
        const r = view.starters[slot.index];
        const chem = view.chemistry.players[slot.index];
        const isSel = selected?.zone === 'starter' && selected.index === slot.index;
        return (
          <div
            key={slot.index}
            className="slot"
            data-selected={isSel}
            data-empty={!r}
            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
            draggable={!!r}
            onDragStart={(e) => {
              e.dataTransfer.setData('text/slot', JSON.stringify({ zone: 'starter', index: slot.index }));
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.dataset.over = 'true';
            }}
            onDragLeave={(e) => delete e.currentTarget.dataset.over}
            onDrop={(e) => {
              delete e.currentTarget.dataset.over;
              onDropTo({ zone: 'starter', index: slot.index }, e);
            }}
          >
            {r ? (
              <PlayerCard card={r.card} size="xs" width={`${SLOT_W}cqw`} selected={isSel} onClick={() => onSlot({ zone: 'starter', index: slot.index })} />
            ) : (
              <button className="slot__empty" onClick={() => onSlot({ zone: 'starter', index: slot.index })} aria-label={`Posición ${POSITION_LABELS[slot.position]} vacía`}>
                <span className="t-ui">+</span>
              </button>
            )}
            <div className="slot__meta">
              <span className="slot__pos t-ui" data-fit={chem?.fit ?? 'none'}>
                {POSITION_LABELS[slot.position]}
              </span>
              {chem && <ChemDots value={chem.value} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
