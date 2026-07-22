import { useTranslation } from 'react-i18next';
import { DownloadIcon } from '../../../icons';
import { Collapsible } from '../shared';

interface StickersPanelProps {
  open: boolean;
  onToggle: () => void;
  availableStickers: string[];
  onExport: (stickerId: string) => void;
}

export function StickersPanel({ open, onToggle, availableStickers, onExport }: StickersPanelProps) {
  const { t } = useTranslation('export');
  return (
    <Collapsible label={t('stickers.label')} open={open} onToggle={onToggle}>
      <p className="text-xs text-gray-400 mb-2">{t('stickers.hint')}</p>
      <div className="space-y-1.5">
        {availableStickers.map((s) => (
          <button
            key={s}
            onClick={() => onExport(s)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
          >
            {t(`stickers.blocks.${s}`)}
            <DownloadIcon className="w-4 h-4 text-gray-400" />
          </button>
        ))}
      </div>
    </Collapsible>
  );
}
