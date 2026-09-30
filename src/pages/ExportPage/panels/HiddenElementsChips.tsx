import { useTranslation } from 'react-i18next';
import type { CardState } from '../../../types';
import type { Format } from '../../../utils/exportStack';
import type { RemovableElement } from '../../../utils/templateConfig';
import { PlusIcon } from '../../../icons';

interface HiddenElementsChipsProps {
  elements: RemovableElement[];
  format: Format;
  card: CardState;
  onRestore: (id: string) => void;
}

/**
 * Restore chips for whatever's currently hidden on this card — lives right
 * under the preview (not the sidebar) since it's a direct readout of what
 * the tap-to-remove overlay (see ElementsOverlay) has done to the canvas
 * above it. Renders nothing when nothing's hidden.
 */
export function HiddenElementsChips({ elements, format, card, onRestore }: HiddenElementsChipsProps) {
  const { t } = useTranslation('export');
  const visible = elements.filter((e) => !e.storyOnly || format === 'story');
  const hidden = visible.filter((e) => card.hiddenElements.includes(e.id));

  if (hidden.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-full">
      <span className="text-xs text-gray-400">{t('layout.hiddenLabel')}</span>
      {hidden.map((e) => (
        <button
          key={e.id}
          onClick={() => onRestore(e.id)}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-full shadow-sm transition-colors"
        >
          {t(e.labelKey)}
          <PlusIcon className="w-3 h-3" />
        </button>
      ))}
    </div>
  );
}
