import { useTranslation } from 'react-i18next';
import { FriendsEditor } from '../../FriendsEditor';
import type { FriendsDraft } from '../../../hooks/useFriendsDraft';
import { CollapsibleSection } from './CollapsibleSection';

interface FriendsSectionProps {
  draft: FriendsDraft;
  /** how many helpers are saved */
  savedCount: number;
  open: boolean;
  onToggle: () => void;
}

export function FriendsSection({ draft, savedCount, open, onToggle }: FriendsSectionProps) {
  const { t } = useTranslation('upload');
  const { t: tExport } = useTranslation('export');
  return (
    <CollapsibleSection
      title={
        <>
          {tExport('friends.label')} <span className="text-sm font-normal text-gray-500">{t('preview.goal.optional')}</span>
        </>
      }
      summary={
        draft.dirty ? (
          <span className="text-amber-700">{tExport('friends.unsavedShort')}</span>
        ) : savedCount > 0 ? (
          t('preview.friends.count', { count: savedCount })
        ) : (
          t('preview.friends.none')
        )
      }
      open={open}
      onToggle={onToggle}
    >
      <FriendsEditor draft={draft} />
    </CollapsibleSection>
  );
}
