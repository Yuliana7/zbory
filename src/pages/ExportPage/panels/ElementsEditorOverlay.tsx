import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Aggregates, CardState } from '../../../types';
import type { SelectedComment } from '../../../components/templates/CommentsCard';
import { undoLastHidden } from '../../../utils/overlayLayout';
import type { RemovableElement } from '../../../utils/templateConfig';
import { CheckIcon, UndoIcon } from '../../../icons';
import { ElementsOverlay } from '../ElementsOverlay';

interface ElementsEditorOverlayProps {
  card: CardState;
  elements: RemovableElement[];
  dims: { width: number; height: number };
  aggregates: Aggregates;
  selectedComments: SelectedComment[];
  renderCard: (
    card: CardState,
    refs: { templateRef: React.RefObject<HTMLDivElement> },
    overrides?: { aggregates?: Aggregates; selectedComments?: SelectedComment[] },
  ) => ReactNode;
  onChange: (hiddenElements: string[]) => void;
  onClose: () => void;
}

/** The card as large as the screen allows: tap ✕ to remove an element, «Скасувати» takes back the last one. */
export function ElementsEditorOverlay({ card, elements, dims, aggregates, selectedComments, renderCard, onChange, onClose }: ElementsEditorOverlayProps) {
  const { t } = useTranslation('export');
  const templateRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useLayoutEffect(() => {
    const calc = () => {
      const style = rootRef.current ? getComputedStyle(rootRef.current) : null;
      const insets = style ? (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0) : 0;
      const availW = window.innerWidth - 16;
      const availH = window.innerHeight - insets - (barRef.current?.offsetHeight ?? 0) - 16;
      setScale(Math.min(availW / dims.width, availH / dims.height, 1));
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [dims]);

  const undone = undoLastHidden(card.hiddenElements, elements, card.format);

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[300] bg-gray-950 flex flex-col"
      style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}
    >
      <div ref={barRef} className="shrink-0 flex items-center justify-between gap-3 px-3 py-2">
        <button
          onClick={() => onChange(undone)}
          disabled={undone === card.hiddenElements}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:hover:bg-white/10 text-white text-sm font-medium transition-colors"
        >
          <UndoIcon className="w-4 h-4" />
          {t('layout.undo')}
        </button>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
        >
          <CheckIcon className="w-4 h-4" />
          {t('layout.done')}
        </button>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden">
        <div style={{ width: Math.ceil(dims.width * scale), height: Math.ceil(dims.height * scale), flexShrink: 0 }}>
          <div style={{ width: dims.width, height: dims.height, zoom: scale, position: 'relative' }}>
            {renderCard(card, { templateRef }, { aggregates, selectedComments })}
            <ElementsOverlay
              templateRef={templateRef}
              elements={elements}
              card={card}
              effectiveScale={scale}
              onHide={(id) => onChange([...card.hiddenElements, id])}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
