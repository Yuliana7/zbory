import { useTranslation } from 'react-i18next';
import type { TemplateType } from '../../../types';
import type { TemplateGroup } from '../../../utils/templateConfig';
import { ChevronDownIcon } from '../../../icons';

interface AddTemplateModalProps {
  groups: TemplateGroup[];
  openGroupIds: Set<string>;
  onToggleGroup: (id: string) => void;
  onSelect: (id: TemplateType) => void;
  onClose: () => void;
}

export function AddTemplateModal({ groups, openGroupIds, onToggleGroup, onSelect, onClose }: AddTemplateModalProps) {
  const { t } = useTranslation('export');
  return (
    <div
      className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-80 max-h-[70vh] overflow-y-auto p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-gray-800 mb-3">{t('stack.addTemplate')}</p>
        <div className="space-y-2">
          {groups.map((group) => {
            const isOpen = openGroupIds.has(group.id);
            return (
              <div key={group.id} className="border border-gray-100 rounded-xl overflow-hidden">
                <button
                  onClick={() => onToggleGroup(group.id)}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors"
                >
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <span className="text-sm leading-none">{group.icon}</span>
                    {t(`gallery:${group.labelKey}`)}
                    <span className="text-gray-300 normal-case">{group.ids.length}</span>
                  </span>
                  <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="pb-1 px-1 space-y-0.5">
                    {group.ids.map((id) => (
                      <button
                        key={id}
                        onClick={() => onSelect(id)}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm text-left rounded-lg
                                   text-gray-700 hover:bg-indigo-50 hover:text-indigo-800 transition-colors"
                      >
                        {t(`templateNames.${id}`)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
