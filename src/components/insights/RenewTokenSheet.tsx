import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RememberToken } from '../upload/RememberToken';

interface RenewTokenSheetProps {
  error: string | null;
  onSubmit: (token: string, remember: boolean) => void;
  onClose: () => void;
}

/** Asks for the Monobank token when none is remembered; the renew carries on as soon as it is in. */
export function RenewTokenSheet({ error, onSubmit, onClose }: RenewTokenSheetProps) {
  const { t } = useTranslation('upload');
  const [token, setToken] = useState('');
  const [remember, setRemember] = useState(false);
  const submit = () => {
    if (token.trim()) onSubmit(token, remember);
  };

  return (
    <div
      className="fixed inset-0 z-[300] bg-black/40 flex items-end sm:items-center justify-center sm:p-4 animate-fade-in text-left"
      style={{ paddingTop: 'var(--safe-top)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={t('monobank.updateTitle')}
        className="sheet-panel w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 space-y-4 overflow-y-auto overscroll-contain"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 1.25rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-base font-semibold text-gray-900">{t('monobank.updateTitle')}</h3>
          <p className="mt-1 text-sm text-gray-600">
            {t('monobank.renewPrompt')}{' '}
            <a href="https://api.monobank.ua/" target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-600 underline">
              api.monobank.ua
            </a>
          </p>
        </div>
        {error && <p role="alert" className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</p>}
        <label className="block">
          <span className="block text-sm font-semibold text-gray-900 mb-1">{t('monobank.tokenLabel')}</span>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder={t('monobank.tokenPlaceholder')}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-gray-400"
          />
        </label>
        <RememberToken checked={remember} onChange={setRemember} />
        <p className="text-xs text-gray-500">{t('monobank.privacy')}</p>
        <div className="flex gap-2">
          <button onClick={submit} disabled={!token.trim()} className="btn-primary flex-1 disabled:opacity-50">
            {t('monobank.updateButton')}
          </button>
          <button onClick={onClose} className="btn-secondary">
            {t('monobank.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
