import { useTranslation } from 'react-i18next';
import type { Format } from '../../../utils/exportStack';
import { Collapsible, ToggleRow } from '../shared';

interface FormatPanelProps {
  open: boolean;
  onToggle: () => void;
  format: Format;
  onFormatChange: (f: Format) => void;
  showSafeZones: boolean;
  onShowSafeZonesChange: (v: boolean) => void;
}

export function FormatPanel({ open, onToggle, format, onFormatChange, showSafeZones, onShowSafeZonesChange }: FormatPanelProps) {
  const { t } = useTranslation('export');
  return (
    <Collapsible label={t('format.label')} open={open} onToggle={onToggle}>
      <div className="flex rounded-lg border border-gray-200 overflow-hidden shadow-sm w-fit">
        {(['post', 'post-4-5', 'story'] as Format[]).map((f) => (
          <button
            key={f}
            onClick={() => onFormatChange(f)}
            className={`px-4 py-2 text-xs font-medium transition-colors ${format === f ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
          >
            {f === 'post' ? t('format.postShort') : f === 'post-4-5' ? t('format.post45Short') : t('format.storyShort')}
          </button>
        ))}
      </div>
      {format === 'story' && (
        <div className="mt-3">
          <ToggleRow label={t('safeZones.toggle')} value={showSafeZones} onChange={onShowSafeZonesChange} />
          <p className="mt-1 text-xs text-gray-400">{t('safeZones.hint')}</p>
        </div>
      )}
    </Collapsible>
  );
}
