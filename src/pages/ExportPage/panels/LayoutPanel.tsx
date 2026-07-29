import { useTranslation } from 'react-i18next';
import type { CardState } from '../../../types';
import type { Format } from '../../../utils/exportStack';
import type { RemovableElement } from '../../../utils/templateConfig';
import { PlusIcon } from '../../../icons';

interface LayoutPanelProps {
  elements: RemovableElement[];
  format: Format;
  card: CardState;
  editMode: boolean;
  onToggleEditMode: () => void;
  onRestore: (field: RemovableElement['field']) => void;
}

/**
 * Replaces the old flat switch list: one button arms "element edit mode"
 * (tap elements on the canvas to hide them — see ElementsOverlay), and
 * hidden elements surface here as restore chips instead of a permanent
 * toggle row per element.
 */
export function LayoutPanel({ elements, format, card, editMode, onToggleEditMode, onRestore }: LayoutPanelProps) {
  const { t } = useTranslation('export');
  const visible = elements.filter((e) => !e.storyOnly || format === 'story');
  const hidden = visible.filter((e) => !card[e.field]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <button
        onClick={onToggleEditMode}
        className={`w-full px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${editMode ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
          }`}
      >
        {editMode ? t('layout.done') : t('layout.editButton')}
      </button>
      {editMode && <p className="text-xs text-gray-400 text-center">{t('layout.editHint')}</p>}
      {hidden.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-1.5">{t('layout.hiddenLabel')}</p>
          <div className="flex flex-wrap gap-1.5">
            {hidden.map((e) => (
              <button
                key={e.id}
                onClick={() => onRestore(e.field)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition-colors"
              >
                {t(e.labelKey)}
                <PlusIcon className="w-3 h-3" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
