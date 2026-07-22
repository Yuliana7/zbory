import { useTranslation } from 'react-i18next';
import { Collapsible } from '../shared';

interface FontScalePanelProps {
  open: boolean;
  onToggle: () => void;
  fontScale: number;
  onFontScaleChange: (v: number) => void;
  styleBadge?: string;
}

export function FontScalePanel({ open, onToggle, fontScale, onFontScaleChange, styleBadge }: FontScalePanelProps) {
  const { t } = useTranslation('export');
  return (
    <Collapsible
      label={t('fontScale.label')}
      badge={`${fontScale.toFixed(2)}×${styleBadge ? ` · ${styleBadge}` : ''}`}
      open={open}
      onToggle={onToggle}
    >
      <input type="range" min={0.75} max={2.5} step={0.05} value={fontScale} onChange={(e) => onFontScaleChange(parseFloat(e.target.value))} className="w-full accent-indigo-600" />
      <div className="flex justify-between text-[10px] text-gray-400 mt-1">
        <span>0.75×</span><span>1×</span><span>2.5×</span>
      </div>
    </Collapsible>
  );
}
