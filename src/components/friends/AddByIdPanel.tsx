import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SpinnerIcon } from '../../icons';
import type { FriendsDraft } from '../../hooks/useFriendsDraft';

/** Paste one or several long jar ids (one per line, or separated by spaces/commas): each becomes a
 * helper with its name, amount, goal and status read from Monobank. */
export function AddByIdPanel({ draft, onClose }: { draft: FriendsDraft; onClose: () => void }) {
  const { t } = useTranslation('export');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<FriendsDraft['addByIds']>> | null>(null);

  const submit = async () => {
    const ids = text.split(/[\s,;]+/).filter(Boolean);
    if (ids.length === 0) return;
    setBusy(true);
    const res = await draft.addByIds(ids);
    setBusy(false);
    setResult(res);
    if (res.added > 0 && res.invalid === 0 && res.duplicate === 0 && !res.failed) onClose();
  };

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 space-y-2">
      <p className="text-xs text-gray-600">{t('friends.addById.hint')}</p>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setResult(null);
        }}
        rows={3}
        placeholder={t('friends.addById.placeholder')}
        aria-label={t('friends.addById.placeholder')}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-base text-gray-900 font-mono
                   focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent placeholder:text-gray-400"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={submit}
          disabled={busy || text.trim() === ''}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-medium transition-colors"
        >
          {busy && <SpinnerIcon className="w-4 h-4 animate-spin" />}
          {t('friends.addById.submit')}
        </button>
        <button onClick={onClose} className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors">
          {t('friends.addById.close')}
        </button>
      </div>
      {result && (
        <ul className="text-xs space-y-0.5">
          {result.added > 0 && <li className="text-green-700">{t('friends.addById.added', { count: result.added })}</li>}
          {result.invalid > 0 && <li className="text-red-500">{t('friends.addById.invalid', { count: result.invalid })}</li>}
          {result.duplicate > 0 && <li className="text-amber-700">{t('friends.addById.duplicate', { count: result.duplicate })}</li>}
          {result.failed && <li className="text-red-500">{t(`friends.jarErrors.${result.failed}`)}</li>}
        </ul>
      )}
    </div>
  );
}
