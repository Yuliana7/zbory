import { useTranslation } from 'react-i18next';
import { FriendsEditor } from '../../FriendsEditor';
import { useFriendsDraft } from '../../../hooks/useFriendsDraft';
import { useUnsavedFriendsGuard } from '../../../hooks/useUnsavedFriendsGuard';
import { ScreenShell } from './ScreenShell';

/** «Редагувати» → «Друзі збору»: only the helper jars. «Зберегти друзів» already writes them to the
 * saved project, so leaving only has to make sure nothing typed is dropped by accident. */
export function FriendsScreen({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation('upload');
  const { t: tExport } = useTranslation('export');
  const draft = useFriendsDraft();
  const { guard, dialog } = useUnsavedFriendsGuard(draft);

  return (
    <ScreenShell title={tExport('friends.label')} backLabel={t('focus.back')} onBack={() => guard(onDone)}>
      <FriendsEditor draft={draft} />
      <button onClick={() => guard(onDone)} className="mt-5 btn-primary w-full">
        {t('focus.done')}
      </button>
      {dialog}
    </ScreenShell>
  );
}
