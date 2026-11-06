import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Aggregates, CardState } from '../../../types';
import type { SelectedComment } from '../../../components/templates/CommentsCard';
import type { RemovableElement } from '../../../utils/templateConfig';
import { ELEMENT_SCALE_MAX, ELEMENT_SCALE_MIN, cardOverflows, snapScale, withElementScale } from '../../../utils/elementScale';
import { undoLastHidden } from '../../../utils/overlayLayout';
import { CheckIcon, TrashIcon, UndoIcon } from '../../../icons';
import { ElementsOverlay } from '../ElementsOverlay';

type Edit = Pick<CardState, 'hiddenElements' | 'elementScales'>;

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
  onChange: (edit: Partial<Edit>) => void;
  onClose: () => void;
}

/** The card as large as the screen allows: tap an element, then resize its text or remove it in the bar
 * below. «Скасувати» steps back through both, in the order they were made. */
export function ElementsEditorOverlay({ card, elements, dims, aggregates, selectedComments, renderCard, onChange, onClose }: ElementsEditorOverlayProps) {
  const { t } = useTranslation('export');
  const templateRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thinIds, setThinIds] = useState<string[]>([]);
  const [hasText, setHasText] = useState(true);
  const [overflows, setOverflows] = useState(false);
  // what the card looked like before each edit of this session
  const [history, setHistory] = useState<Edit[]>([]);
  const dragging = useRef(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useLayoutEffect(() => {
    const calc = () => {
      const root = rootRef.current;
      const style = root ? getComputedStyle(root) : null;
      const insets = style ? (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0) : 0;
      const availW = window.innerWidth - 16;
      const availH = (root?.clientHeight ?? window.innerHeight) - insets - (topRef.current?.offsetHeight ?? 0) - (barRef.current?.offsetHeight ?? 0) - 16;
      setScale(Math.min(availW / dims.width, availH / dims.height, 1));
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [dims]);

  // text can run past the card once it's bigger, and what is cut off isn't always obvious at this size
  useLayoutEffect(() => {
    const root = templateRef.current;
    if (!root) return;
    setOverflows(cardOverflows(root));
    const node = selectedId ? root.querySelector(`[data-element="${selectedId}"]`) : null;
    setHasText(!!node?.textContent?.trim());
  }, [card.elementScales, card.hiddenElements, selectedId, scale]);

  const before = (): Edit => ({ hiddenElements: card.hiddenElements, elementScales: card.elementScales });
  const edit = (change: Partial<Edit>) => {
    setHistory((h) => [...h, before()]);
    onChange(change);
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (last) {
      setHistory((h) => h.slice(0, -1));
      onChange(last);
      return;
    }
    // reopened later, there is no history: removals can still be taken back, newest first
    onChange({ hiddenElements: undoLastHidden(card.hiddenElements, elements, card.format) });
  };
  const canUndo = history.length > 0 || undoLastHidden(card.hiddenElements, elements, card.format) !== card.hiddenElements;

  const remove = () => {
    if (!selectedId) return;
    edit({ hiddenElements: [...card.hiddenElements, selectedId] });
    setSelectedId(null);
  };

  const resize = (value: number) => {
    if (!selectedId) return;
    // a whole drag is one step of «Скасувати»
    if (!dragging.current) {
      dragging.current = true;
      setHistory((h) => [...h, before()]);
    }
    onChange({ elementScales: withElementScale(card.elementScales, selectedId, snapScale(value)) });
  };

  const onThinChange = useCallback((ids: string[]) => setThinIds((prev) => (prev.join() === ids.join() ? prev : ids)), []);

  const selected = elements.find((e) => e.id === selectedId);
  const size = selectedId ? (card.elementScales?.[selectedId] ?? 1) : 1;
  const thin = elements.filter((e) => thinIds.includes(e.id));
  const chip = (on: boolean) => `px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${on ? 'bg-indigo-600 text-white' : 'bg-white/10 text-gray-200 hover:bg-white/20'}`;

  return (
    <div
      ref={rootRef}
      className="screen-overlay z-[300] bg-gray-950 flex flex-col"
      style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'calc(var(--safe-bottom) + var(--toolbar-gap))' }}
    >
      <div ref={topRef} className="shrink-0 flex items-center justify-between gap-3 px-3 py-2">
        <button
          onClick={undo}
          disabled={!canUndo}
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

      <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden" onClick={() => setSelectedId(null)}>
        <div style={{ width: Math.ceil(dims.width * scale), height: Math.ceil(dims.height * scale), flexShrink: 0 }}>
          <div style={{ width: dims.width, height: dims.height, zoom: scale, position: 'relative' }}>
            {renderCard(card, { templateRef }, { aggregates, selectedComments })}
            <ElementsOverlay
              templateRef={templateRef}
              elements={elements}
              card={card}
              effectiveScale={scale}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onThinChange={onThinChange}
            />
          </div>
        </div>
      </div>

      {/* always the same height, so selecting an element doesn't resize the card */}
      <div ref={barRef} className="shrink-0 h-40 bg-gray-900 rounded-t-2xl px-4 py-3 text-white flex flex-col justify-center gap-2">
        {selected ? (
          <>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold truncate">{t(selected.labelKey)}</span>
              {hasText && <span className="tabular-nums text-gray-300">{Math.round(size * 100)}%</span>}
            </div>
            {hasText ? (
              <label className="flex items-center gap-3">
                <span aria-hidden="true" className="text-xs text-gray-400">A</span>
                <input
                  type="range"
                  aria-label={t('layout.textSize')}
                  min={ELEMENT_SCALE_MIN}
                  max={ELEMENT_SCALE_MAX}
                  step={0.01}
                  value={size}
                  onChange={(e) => resize(parseFloat(e.target.value))}
                  onPointerUp={() => (dragging.current = false)}
                  onBlur={() => (dragging.current = false)}
                  className="flex-1 min-w-0 accent-indigo-400"
                />
                <span aria-hidden="true" className="text-lg text-gray-200">A</span>
              </label>
            ) : (
              <p className="text-xs text-gray-400">{t('layout.noText')}</p>
            )}
            {overflows && <p role="status" className="text-xs text-amber-300">{t('layout.overflow')}</p>}
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => edit({ elementScales: withElementScale(card.elementScales, selected.id, 1) })}
                disabled={size === 1}
                className="px-3 py-1.5 rounded-full text-sm font-medium text-gray-200 hover:bg-white/10 disabled:opacity-40 transition-colors"
              >
                {t('layout.resetSize')}
              </button>
              <button onClick={remove} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-red-300 hover:bg-red-500/20 transition-colors">
                <TrashIcon className="w-4 h-4" />
                {t('layout.remove')}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-300">{t('layout.editHint')}</p>
            {overflows && <p role="status" className="text-xs text-amber-300">{t('layout.overflow')}</p>}
            {thin.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {thin.map((e) => (
                  <button key={e.id} onClick={() => setSelectedId(e.id)} className={chip(false)}>
                    {t(e.labelKey)}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
