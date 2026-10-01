import { useTranslation } from 'react-i18next';
import { FriendsEditor } from '../../../components/FriendsEditor';
import { Collapsible } from '../shared';

interface FriendsPanelProps {
  open: boolean;
  onToggle: () => void;
  count: number;
}

export function FriendsPanel({ open, onToggle, count }: FriendsPanelProps) {
  const { t } = useTranslation('export');
  return (
    <Collapsible
      label={t('friends.label')}
      badge={count > 0 ? t('friends.badge', { count }) : undefined}
      badgeColor="indigo"
      open={open}
      onToggle={onToggle}
    >
      <FriendsEditor />
    </Collapsible>
  );
}
