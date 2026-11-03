import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getRarity, PACKS, POSITION_LABELS, type PackDefinition } from '@fu/domain';
import { PlayerCard } from '../../components/card/PlayerCard';
import { FlagArt } from '../../components/card/FlagArt';
import { ClubCrest } from '../../components/card/ClubCrest';
import { Button, Coins, SectionHeader } from '../../components/ui/ui';
import { useGame } from '../../state/gameStore';
import { feedback, useUi } from '../../state/uiStore';
import { resolve } from '../../data/catalog';
import { PackArt } from './PackArt';
import '../screens.css';
import './packs.css';

export function PacksScreen() {
  const coins = useGame((s) => s.coins);
  const welcomeClaimed = useGame((s) => s.welcomeClaimed);
  const [opening, setOpening] = useState<{ pack: PackDefinition; cardIds: string[] } | null>(null);
  const [oddsOpen, setOddsOpen] = useState<string | null>(null);

  const buy = (pack: PackDefinition) => {
    const r = useGame.getState().buyPack(pack.id);
    if (!r.ok) return feedback(r);
    setOpening({ pack, cardIds: r.cardIds });
  };

  const packs = PACKS.filter((p) => !(p.oneTime && welcomeClaimed));

  return (
    <div className="packs">
      <SectionHeader eyebrow="Tienda" title="Sobres">
        <Coins value={coins} size="lg" />
      </SectionHeader>
      <div className="pack-grid stagger">
        {packs.map((p) => {
          const total = Object.values(p.odds).reduce<number>((a, b) => a + (b ?? 0), 0);
          return (
            <article key={p.id} className="pack-offer" data-theme={p.theme}>
              <div className="pack-offer__stage">
                <PackArt pack={p} />
              </div>
              <div className="pack-offer__body">
                <h2 className="t-display">{p.name}</h2>
                <p className="muted">{p.tagline}</p>
                <button className="pack-offer__odds-toggle t-ui" onClick={() => setOddsOpen(oddsOpen === p.id ? null : p.id)} aria-expanded={oddsOpen === p.id}>
                  Probabilidades
                </button>
                {oddsOpen === p.id && (
                  <ul className="odds">
                    {Object.entries(p.odds).map(([r, w]) => (
                      <li key={r} data-rarity={r}>
                        <span className="odds__swatch" />
                        <span>{getRarity(r).label}</span>
                        <b className="t-num">{(((w ?? 0) / total) * 100).toFixed(1)} %</b>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="pack-offer__buy">
                  {p.price === 0 ? <span className="tag tag--gold">Gratis</span> : <Coins value={p.price} />}
                  <Button variant="gold" disabled={coins < p.price} onClick={() => buy(p)}>
                    {p.price === 0 ? 'Abrir' : 'Comprar y abrir'}
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {opening && (
        <PackOpening
          pack={opening.pack}
          cardIds={opening.cardIds}
          onClose={() => setOpening(null)}
          onAgain={coins >= opening.pack.price && !opening.pack.oneTime ? () => buy(opening.pack) : undefined}
        />
      )}
    </div>
  );
}

type Stage = 'shake' | 'flag' | 'position' | 'club' | 'reveal' | 'summary';

function PackOpening({ pack, cardIds, onClose, onAgain }: { pack: PackDefinition; cardIds: string[]; onClose: () => void; onAgain?: () => void }) {
  const cards = useGame((s) => s.cards);
  const go = useUi((s) => s.go);
  const best = cards[cardIds[0]] ? resolve(cards[cardIds[0]]) : null;
  const walkout = !!best && best.rarity.walkout;
  const [stage, setStage] = useState<Stage>('shake');

  useEffect(() => {
    setStage('shake');
  }, [cardIds]);

  useEffect(() => {
    const seq: [Stage, number][] = walkout
      ? [
          ['shake', 1300],
          ['flag', 1500],
          ['position', 1100],
          ['club', 1300],
          ['reveal', 2200],
        ]
      : [['shake', 1100]];
    const i = seq.findIndex(([s]) => s === stage);
    if (i === -1) return;
    const t = setTimeout(() => setStage(i + 1 < seq.length ? seq[i + 1][0] : 'summary'), seq[i][1]);
    return () => clearTimeout(t);
  }, [stage, walkout]);

  const skip = () => setStage('summary');

  return createPortal(
    <div className="opening" role="dialog" aria-modal="true" aria-label={`Abriendo ${pack.name}`} data-rarity={best?.version.rarity}>
      <div className="opening__bg" />
      {stage !== 'summary' && (
        <button className="opening__skip t-ui" onClick={skip}>
          Saltar
        </button>
      )}

      {stage === 'shake' && (
        <div className="opening__center">
          <PackArt pack={pack} size="lg" shaking />
        </div>
      )}

      {best && stage === 'flag' && (
        <div className="walkout walkout--flag">
          <div className="walkout__flag">
            <FlagArt code={best.nation.code} />
          </div>
          <span className="walkout__caption t-display">{best.nation.name}</span>
        </div>
      )}
      {best && stage === 'position' && (
        <div className="walkout">
          <span className="walkout__big t-display">{POSITION_LABELS[best.position]}</span>
        </div>
      )}
      {best && stage === 'club' && (
        <div className="walkout">
          <div className="walkout__crest">
            <ClubCrest club={best.club} />
          </div>
          <span className="walkout__caption t-display">{best.club.name}</span>
        </div>
      )}
      {best && stage === 'reveal' && (
        <div className="walkout walkout--reveal">
          <div className="walkout__rays" />
          <PlayerCard card={best.card} size="xl" tilt interactive />
          <span className="walkout__caption t-display">{best.player.knownAs}</span>
        </div>
      )}

      {stage === 'summary' && (
        <div className="opening__summary">
          <h2 className="t-display">{pack.name}</h2>
          <div className="opening__cards">
            {cardIds.map((id, i) =>
              cards[id] ? (
                <div key={id} className="opening__card" style={{ animationDelay: `${i * 90}ms` }}>
                  <PlayerCard card={cards[id]} size="md" tilt interactive />
                </div>
              ) : null,
            )}
          </div>
          <div className="opening__actions">
            <Button variant="primary" onClick={() => (onClose(), go('club'))}>
              Ver en mi club
            </Button>
            {onAgain && (
              <Button variant="gold" onClick={onAgain}>
                Abrir otro · <Coins value={pack.price} size="sm" />
              </Button>
            )}
            <Button onClick={onClose}>Cerrar</Button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
