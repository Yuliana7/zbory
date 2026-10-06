import { useTranslation } from 'react-i18next';
import { FriendsEditor } from '../../FriendsEditor';
import { SectionCard } from './SectionCard';

export function FriendsSection() {
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
      <FriendsEditor />
    </SectionCard>
  );
}
