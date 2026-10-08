import { useTranslation } from 'react-i18next';
import { FriendsEditor } from '../../FriendsEditor';
import type { FriendsDraft } from '../../../hooks/useFriendsDraft';
import { SectionCard } from './SectionCard';

export function FriendsSection({ draft }: { draft: FriendsDraft }) {
  const { t } = useTranslation('upload');
  const { t: tExport } = useTranslation('export');
  return (
    <SectionCard
      id="friends"
      title={
        <>
          {tExport('friends.label')} <span className="text-sm font-normal text-gray-500">{t('preview.goal.optional')}</span>
        </>
      }
    >
      <FriendsEditor draft={draft} />
    </SectionCard>
  );
}
