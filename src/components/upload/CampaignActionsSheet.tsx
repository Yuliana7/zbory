import { useEffect, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import type { CampaignMeta } from '../../utils/campaignStore';
import { CheckCircleIcon, DownloadIcon, EditIcon, PlusIcon, TrashIcon } from '../../icons';
import type { IconProps } from '../../icons/types';

/** What "Змінити" can do to a saved project; each one opens a full-screen flow. */
export type CampaignAction = 'monobank' | 'csv' | 'edit' | 'details';

interface CampaignActionsSheetProps {
  campaign: CampaignMeta;
  onAction: (action: CampaignAction) => void;
  onDelete: () => void;
  onClose: () => void;
}

/** Small action menu for a saved project: a bottom sheet on phones, a centered
 * card on larger screens. Anything heavy (Monobank wizard, the row table) is a
 * full screen of its own — this only chooses which one. */
export function CampaignActionsSheet({ campaign, onAction, onDelete, onClose }: CampaignActionsSheetProps) {
  const { t } = useTranslation('campaigns');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const items: Array<{ action: CampaignAction; label: string; Icon: ComponentType<IconProps> }> = [
    {
      action: 'monobank',
      label: campaign.monobankJar ? t('actions.monobankUpdate') : t('actions.monobankLink'),
      Icon: DownloadIcon,
    },
    { action: 'csv', label: t('actions.csv'), Icon: PlusIcon },
    { action: 'edit', label: t('actions.edit'), Icon: EditIcon },
    { action: 'details', label: t('actions.details'), Icon: CheckCircleIcon },
  ];

  return (
    <div
      className="fixed inset-0 z-[300] bg-black/40 flex items-end sm:items-center justify-center sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={campaign.name}
        className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-2"
        // keep the last item clear of the iPhone home indicator
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="px-3 pt-3 pb-2 text-sm font-semibold text-gray-900 truncate">{campaign.name}</p>
        <ul>
          {items.map(({ action, label, Icon }) => (
            <li key={action}>
              <button
                onClick={() => onAction(action)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-base text-gray-800 hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <Icon className="w-5 h-5 text-gray-400 shrink-0" />
                {label}
              </button>
            </li>
          ))}
          <li className="mt-1 pt-1 border-t border-gray-100">
            <button
              onClick={onDelete}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-base text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors"
            >
              <TrashIcon className="w-5 h-5 shrink-0" />
              {t('delete')}
            </button>
          </li>
        </ul>
        <button
          onClick={onClose}
          className="mt-1 w-full px-3 py-3 rounded-xl text-base font-medium text-gray-500 hover:bg-gray-50 transition-colors"
        >
          {t('close')}
        </button>
      </div>
    </div>
  );
}
