import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface UnsavedFriendsDialogProps {
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

/** Shown when leaving the preview with helper-jar edits that were never saved. */
export function UnsavedFriendsDialog({ onSave, onDiscard, onCancel }: UnsavedFriendsDialogProps) {
  const { t } = useTranslation('export');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[300] bg-black/40 flex items-end sm:items-center justify-center sm:p-4 animate-fade-in"
      style={{ paddingTop: 'var(--safe-top)' }}
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-friends-title"
        className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 space-y-4"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 1.25rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-1">
          <h2 id="unsaved-friends-title" className="text-base font-semibold text-gray-900">
            {t('friends.leave.title')}
          </h2>
          <p className="text-sm text-gray-600">{t('friends.leave.text')}</p>
        </div>
        <div className="space-y-2">
          <button onClick={onSave} className="btn-primary w-full">
            {t('friends.leave.save')}
          </button>
          <button
            onClick={onDiscard}
            className="w-full px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
          >
            {t('friends.leave.discard')}
          </button>
          <button
            onClick={onCancel}
            className="w-full px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            {t('friends.leave.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
