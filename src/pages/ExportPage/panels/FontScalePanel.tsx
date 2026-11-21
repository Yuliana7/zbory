import { useTranslation } from 'react-i18next';
import { Collapsible } from '../shared';
import { CARD_FONTS, DEFAULT_FONT_ID, fontById, fontStack } from '../../../utils/cardFonts';

interface FontScalePanelProps {
  open: boolean;
  onToggle: () => void;
  fontScale: number;
  onFontScaleChange: (v: number) => void;
  fontId: string | null | undefined;
  onFontChange: (id: string) => void;
  styleBadge?: string;
}

/** The card's font and its text size. */
export function FontScalePanel({ open, onToggle, fontScale, onFontScaleChange, fontId, onFontChange, styleBadge }: FontScalePanelProps) {
  const { t } = useTranslation('export');
  const current = fontById(fontId);
  return (
    <Collapsible
      label={t('fontScale.label')}
      badge={`${current.label} · ${fontScale.toFixed(2)}×${styleBadge ? ` · ${styleBadge}` : ''}`}
      open={open}
      onToggle={onToggle}
    >
      <p className="text-xs font-medium text-gray-500 mb-2">{t('fontScale.font')}</p>
      <div role="radiogroup" aria-label={t('fontScale.font')} className="grid grid-cols-2 gap-2 mb-4">
        {CARD_FONTS.map((f) => {
          const on = f.id === (fontId ?? DEFAULT_FONT_ID);
          return (
            <button
              key={f.id}
              role="radio"
              aria-checked={on}
              onClick={() => onFontChange(f.id)}
              style={{ fontFamily: fontStack(f.id) }}
              className={`px-3 py-2 rounded-lg border text-left text-base leading-tight transition-colors ${
                on ? 'border-indigo-500 bg-indigo-50 text-indigo-800' : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300'
              }`}
            >
              {f.label}
              <span className="block text-xs font-normal text-gray-500">Збір 12 500 ₴</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs font-medium text-gray-500 mb-2">{t('fontScale.size')}</p>
      <input type="range" min={0.75} max={2.5} step={0.05} value={fontScale} onChange={(e) => onFontScaleChange(parseFloat(e.target.value))} className="w-full accent-indigo-600" />
      <div className="flex justify-between text-[10px] text-gray-400 mt-1">
        <span>0.75×</span><span>1×</span><span>2.5×</span>
      </div>
    </Collapsible>
  );
}
