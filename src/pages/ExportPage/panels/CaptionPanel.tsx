import { useTranslation } from 'react-i18next';
import { Collapsible } from '../shared';

interface CaptionPanelProps {
  open: boolean;
  onToggle: () => void;
  captionValue: string;
  onCaptionChange: (v: string) => void;
  isEdited: boolean;
  onRegenerate: () => void;
  onCopy: () => void;
  copied: boolean;
  multiCard: boolean;
  cardCount: number;
  onCopyAll: () => void;
  allCopied: boolean;
}

export function CaptionPanel({
  open, onToggle, captionValue, onCaptionChange, isEdited, onRegenerate,
  onCopy, copied, multiCard, cardCount, onCopyAll, allCopied,
}: CaptionPanelProps) {
  const { t } = useTranslation('export');
  return (
    <Collapsible label={t('caption.label')} open={open} onToggle={onToggle}>
      <textarea
        value={captionValue}
        onChange={(e) => onCaptionChange(e.target.value)}
        rows={9}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={onCopy}
          className={`flex-1 px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${copied
            ? 'bg-green-100 text-green-700'
            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
        >
          {copied ? t('caption.copied') : t('caption.copy')}
        </button>
        {isEdited && (
          <button
            onClick={onRegenerate}
            title={t('caption.regenerate')}
            className="px-3 py-2 text-sm font-medium border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
          >
            ↺
          </button>
        )}
      </div>
      {multiCard && (
        <button
          onClick={onCopyAll}
          className={`mt-2 w-full px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${allCopied
            ? 'bg-green-100 border-green-200 text-green-700'
            : 'border-indigo-200 text-indigo-700 hover:bg-indigo-50'
            }`}
        >
          {allCopied ? t('caption.copied') : t('stack.copyAllCaptions', { count: cardCount })}
        </button>
      )}
    </Collapsible>
  );
}
