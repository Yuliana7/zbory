import { useTranslation } from 'react-i18next';
import { FriendsEditor } from '../../FriendsEditor';
import { useFriendsDraft } from '../../../hooks/useFriendsDraft';
import { useUnsavedFriendsGuard } from '../../../hooks/useUnsavedFriendsGuard';
import { PlusIcon } from '../../../icons';
import { ScreenShell } from './ScreenShell';

/** «Редагувати» → «Друзі збору»: only the helper jars. «Зберегти друзів» already writes them to the
 * saved project, so leaving only has to make sure nothing typed is dropped by accident. */
export function FriendsScreen({ onDone, backLabel }: { onDone: () => void; backLabel?: string }) {
  const { t } = useTranslation('upload');
  const { t: tExport } = useTranslation('export');
  const draft = useFriendsDraft();
  const { guard, dialog } = useUnsavedFriendsGuard(draft);

  return (
    <ScreenShell
      stickyHeader
      wide
      title={tExport('friends.label')}
      backLabel={backLabel ?? t('focus.back')}
      onBack={() => guard(onDone)}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={draft.addRow}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-600 text-sm font-medium transition-colors"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            {tExport('friends.add')}
          </button>
          <button onClick={() => guard(onDone)} className="px-3 sm:px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors">
            {t('focus.done')}
          </button>
        </div>
      }
    >
      <FriendsEditor draft={draft} />
      {dialog}
    </ScreenShell>
  );
}
