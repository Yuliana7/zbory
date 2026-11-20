import { useTranslation } from 'react-i18next';
import { REQUEST_GAP_SECONDS } from '../../utils/monobankApi';
import { SpinnerIcon } from '../../icons';
import { RememberToken } from './RememberToken';
import { CountdownRing } from './CountdownRing';

export const TOKEN_INPUT =
  // text-base (16px): anything smaller makes iOS zoom the page on focus
  'w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-base text-gray-900 ' +
  'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-gray-400';

interface MonobankTokenFormProps {
  token: string;
  onToken: (token: string) => void;
  remember: boolean;
  onRemember: (remember: boolean) => void;
  onSubmit: () => void;
  onCancel: () => void;
  loading: boolean;
  /** seconds the request is waiting out Monobank's rate limit (0 = not waiting) */
  wait: number;
}

/** The token step of every Monobank flow: how to get one, the field, «Запам'ятати», and a countdown while
 * Monobank asks for a pause. The token goes only to api.monobank.ua. */
export function MonobankTokenForm({ token, onToken, remember, onRemember, onSubmit, onCancel, loading, wait }: MonobankTokenFormProps) {
  const { t } = useTranslation('upload');
  return (
    <div className="mt-4 space-y-4">
      <details open className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 text-sm text-indigo-900">
        <summary className="font-semibold cursor-pointer">{t('monobank.howTitle')}</summary>
        <ol className="mt-3 space-y-2 list-decimal list-inside text-indigo-800">
          <li>
            {t('monobank.how1Before')}{' '}
            <a href="https://api.monobank.ua/" target="_blank" rel="noopener noreferrer" className="font-medium underline">
              api.monobank.ua
            </a>{' '}
            {t('monobank.how1After')}
          </li>
          <li>{t('monobank.how2')}</li>
          <li>{t('monobank.how3')}</li>
        </ol>
        <p className="mt-3 text-xs text-indigo-600">{t('monobank.privacy')}</p>
      </details>

      <label className="block">
        <span className="block text-sm font-semibold text-gray-900 mb-1">{t('monobank.tokenLabel')}</span>
        <input
          type="password"
          value={token}
          onChange={(e) => onToken(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          placeholder={t('monobank.tokenPlaceholder')}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className={TOKEN_INPUT}
        />
      </label>
      <RememberToken checked={remember} onChange={onRemember} />

      {loading && wait > 0 && (
        <p className="flex items-center gap-2 text-xs text-indigo-600" aria-live="polite">
          <CountdownRing secondsLeft={wait} totalSeconds={REQUEST_GAP_SECONDS} className="w-5 h-5 shrink-0" />
          <span>
            {t('monobank.waitingPause', { seconds: wait })} · {t('monobank.rateLimitPause')}
          </span>
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={onSubmit} disabled={!token.trim() || loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
          {loading && <SpinnerIcon className="w-4 h-4 animate-spin" />}
          {t('monobank.showJars')}
        </button>
        <button onClick={onCancel} className="btn-secondary">
          {t('monobank.cancel')}
        </button>
      </div>
    </div>
  );
}
