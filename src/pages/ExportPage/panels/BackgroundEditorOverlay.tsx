import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Aggregates, CardState, SharedStyle } from '../../../types';
import type { SelectedComment } from '../../../components/templates/CommentsCard';
import { useBackgroundGestures } from '../hooks/useBackgroundGestures';
import { CheckIcon } from '../../../icons';

// Reserve vertical space for the bottom control sheet when fitting the card
// to the viewport — an approximation (the sheet's real height varies a little
// with font rendering), generous enough that the card never hides behind it.
const CONTROLS_H = 300;

interface BackgroundEditorOverlayProps {
  card: CardState;
  style: SharedStyle;
  onPatchStyle: (patch: Partial<SharedStyle>) => void;
  dims: { width: number; height: number };
  aggregates: Aggregates;
  selectedComments: SelectedComment[];
  renderCard: (
    card: CardState,
    refs: { templateRef: React.RefObject<HTMLDivElement> },
    overrides?: { aggregates?: Aggregates; selectedComments?: SelectedComment[] },
  ) => ReactNode;
  onClose: () => void;
}

/**
 * Full-screen, gesture-isolated background editor — replaces the old
 * always-on drag-to-pan directly on the small inline preview (which
 * conflicted with page scroll on mobile). Owns the whole viewport while
 * open: drag/pinch/rotate here never leak into the page underneath, and
 * closing is only ever explicit (no click-outside-to-dismiss), so a gesture
 * mid-pinch can't accidentally exit.
 */
export function BackgroundEditorOverlay({
  card, style, onPatchStyle, dims, aggregates, selectedComments, renderCard, onClose,
}: BackgroundEditorOverlayProps) {
  const { t } = useTranslation('export');
  const templateRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const [scale, setScale] = useState(0.5);
  useLayoutEffect(() => {
    const calc = () => {
      const availW = window.innerWidth * 0.92;
      const availH = (window.innerHeight - CONTROLS_H) * 0.92;
      setScale(Math.min(availW / dims.width, availH / dims.height, 1));
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [dims]);

  const previewW = Math.ceil(dims.width * scale);
  const previewH = Math.ceil(dims.height * scale);

  const { onPointerDown, onPointerMove, onPointerUp, onPointerCancel } =
    useBackgroundGestures(clipRef, style, onPatchStyle, previewW, previewH);

  const resetAndClose = () => {
    onPatchStyle({
      bgImage: null, bgColor: null, bgTransparent: false,
      bgBrightness: 1, bgOpacity: 1, bgZoom: 1, bgOffsetX: 0, bgOffsetY: 0, bgRotate: 0,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/90 flex flex-col">
      <div className="flex-1 flex items-center justify-center overflow-hidden p-4">
        <div
          ref={clipRef}
          style={{
            width: previewW,
            height: previewH,
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 8,
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            touchAction: 'none',
            userSelect: 'none',
            flexShrink: 0,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        >
          <div style={{ width: dims.width, height: dims.height, zoom: scale, position: 'relative' }}>
            {renderCard(card, { templateRef }, { aggregates, selectedComments })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-t-3xl px-5 pt-4 pb-6 space-y-3 max-h-[45vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800">{t('background.editPosition')}</p>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors"
          >
            <CheckIcon className="w-3.5 h-3.5" />
            {t('layout.done')}
          </button>
        </div>
        <p className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-2.5 py-1.5">
          {t('background.gestureHint')}
        </p>

        <div>
          <div className="flex justify-between text-[11px] text-gray-500 mb-1"><span>{t('background.brightness')}</span><span>{Math.round(style.bgBrightness * 100)}%</span></div>
          <input type="range" min={0.1} max={1.5} step={0.05} value={style.bgBrightness} onChange={e => onPatchStyle({ bgBrightness: parseFloat(e.target.value) })} className="w-full accent-indigo-600" />
        </div>
        <div>
          <div className="flex justify-between text-[11px] text-gray-500 mb-1"><span>{t('background.opacity')}</span><span>{Math.round(style.bgOpacity * 100)}%</span></div>
          <input type="range" min={0.05} max={1} step={0.05} value={style.bgOpacity} onChange={e => onPatchStyle({ bgOpacity: parseFloat(e.target.value) })} className="w-full accent-indigo-600" />
        </div>
        <div>
          <div className="flex justify-between text-[11px] text-gray-500 mb-1"><span>{t('background.zoom')}</span><span>{Math.round(style.bgZoom * 100)}%</span></div>
          <input type="range" min={1} max={3} step={0.05} value={style.bgZoom} onChange={e => onPatchStyle({ bgZoom: parseFloat(e.target.value) })} className="w-full accent-indigo-600" />
        </div>
        <div>
          <div className="flex justify-between text-[11px] text-gray-500 mb-1"><span>{t('background.offsetX')}</span><span>{style.bgOffsetX}%</span></div>
          <input type="range" min={-100} max={100} step={1} value={style.bgOffsetX} onChange={e => onPatchStyle({ bgOffsetX: parseInt(e.target.value, 10) })} className="w-full accent-indigo-600" />
        </div>
        <div>
          <div className="flex justify-between text-[11px] text-gray-500 mb-1"><span>{t('background.offsetY')}</span><span>{style.bgOffsetY}%</span></div>
          <input type="range" min={-100} max={100} step={1} value={style.bgOffsetY} onChange={e => onPatchStyle({ bgOffsetY: parseInt(e.target.value, 10) })} className="w-full accent-indigo-600" />
        </div>
        <div>
          <div className="flex justify-between text-[11px] text-gray-500 mb-1"><span>{t('background.rotate')}</span><span>{style.bgRotate}°</span></div>
          <input type="range" min={0} max={360} step={1} value={style.bgRotate} onChange={e => onPatchStyle({ bgRotate: parseInt(e.target.value, 10) })} className="w-full accent-indigo-600" />
        </div>

        <button onClick={resetAndClose} className="text-xs text-gray-400 hover:text-gray-600 underline">
          {t('background.reset')}
        </button>
      </div>
    </div>
  );
}
