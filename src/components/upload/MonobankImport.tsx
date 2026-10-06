import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MonobankJarRef, RawDonation } from '../../types';
import {
  MonobankError,
  dayEndSec,
  dayStartSec,
  defaultRange,
  estimateRequests,
  fetchJarStatement,
  fetchJars,
  REQUEST_GAP_SECONDS,
  isUahJar,
  jarGoal,
  statementItemsToRawDonations,
  toIsoDate,
  type FetchProgress,
  type MonoJar,
} from '../../utils/monobankApi';
import { SpinnerIcon } from '../../icons';
import { DateField } from '../DateField';
import { CountdownRing } from './CountdownRing';

export interface MonobankFetchResult {
  rows: RawDonation[];
  jar: MonobankJarRef;
  /** the jar's own goal in hryvnias, if it has one */
  goal?: number;
}

interface MonobankImportProps {
  /** import: pick a jar first. update: refresh a known jar (no jar list request). */
  mode: 'import' | 'update';
  /** update mode: the jar to refresh */
  jar?: MonobankJarRef;
  /** update mode: first day to fetch (the newest saved row's day) */
  fromDate?: string;
  onFetched: (result: MonobankFetchResult) => void;
  onCancel: () => void;
}

type Stage = 'token' | 'loadingJars' | 'jars' | 'range' | 'fetching';

const INPUT =
  // text-base (16px): anything smaller makes iOS zoom the page on focus
  'w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-base text-gray-900 ' +
  'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-gray-400';

const fmtUah = (kopecks: number) => new Intl.NumberFormat('uk-UA').format(Math.round(kopecks / 100));

/** Pulls a jar's statement from the Monobank API. The token lives in this
 * component's state only: it is never written to storage or logged, goes only
 * to api.monobank.ua, and is gone as soon as the screen closes. */
export function MonobankImport({ mode, jar: knownJar, fromDate, onFetched, onCancel }: MonobankImportProps) {
  const { t } = useTranslation('upload');
  const [stage, setStage] = useState<Stage>('token');
  const [token, setToken] = useState('');
  const [jars, setJars] = useState<MonoJar[]>([]);
  const [jarId, setJarId] = useState<string | null>(null);
  const [range, setRange] = useState(() => ({ ...defaultRange(), ...(fromDate ? { from: fromDate } : null) }));
  const [progress, setProgress] = useState<FetchProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  // seconds the jar-list request is waiting out Monobank's rate limit (0 = not waiting)
  const [jarsWait, setJarsWait] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // Leaving the screen cancels any request or countdown still running
  useEffect(() => () => abortRef.current?.abort(), []);

  const today = toIsoDate(new Date());
  const selectedJar = mode === 'update' ? null : jars.find((j) => j.id === jarId) ?? null;
  const rangeValid = range.from !== '' && range.to !== '' && range.from <= range.to && range.to <= today;
  const requests = rangeValid ? estimateRequests(dayStartSec(range.from), dayEndSec(range.to, Math.floor(Date.now() / 1000))) : 1;

  const describe = (err: unknown) => {
    const kind = err instanceof MonobankError ? err.kind : 'unexpected';
    return t(`monobank.errors.${kind}`);
  };

  const handleToken = async () => {
    if (!token.trim()) return;
    setError(null);
    if (mode === 'update') {
      // The statement request itself tells us whether the token is good
      setStage('range');
      return;
    }
    setStage('loadingJars');
    setJarsWait(0);
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const all = await fetchJars(token, { signal: abort.signal, onWait: setJarsWait });
      setJars(all);
      setJarId(all.find(isUahJar)?.id ?? null);
      setStage('jars');
    } catch (err) {
      if (abort.signal.aborted) return;
      setError(describe(err));
      setStage('token');
    } finally {
      setJarsWait(0);
    }
  };

  const handleFetch = async () => {
    const target: MonobankJarRef | null = mode === 'update' ? (knownJar ?? null) : selectedJar && { id: selectedJar.id, title: selectedJar.title };
    if (!target || !rangeValid) return;
    setError(null);
    setProgress(null);
    setStage('fetching');
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const items = await fetchJarStatement({
        token,
        jarId: target.id,
        fromSec: dayStartSec(range.from),
        toSec: dayEndSec(range.to, Math.floor(Date.now() / 1000)),
        onProgress: setProgress,
        signal: abort.signal,
      });
      const rows = statementItemsToRawDonations(items);
      if (rows.length === 0) {
        setError(t('monobank.empty'));
        setStage('range');
        return;
      }
      onFetched({ rows, jar: target, goal: selectedJar ? jarGoal(selectedJar) : undefined });
    } catch (err) {
      if (abort.signal.aborted) return;
      setError(describe(err));
      // A rejected token is fixed on the first screen; anything else can simply be retried
      setStage(err instanceof MonobankError && err.kind === 'invalid-token' ? 'token' : 'range');
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setStage('range');
  };

  const titleKey = mode === 'update' ? 'monobank.updateTitle' : 'monobank.title';

  return (
    <div className="max-w-xl mx-auto animate-fade-in">
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 text-center">
        {t(titleKey)}
        {mode === 'update' && knownJar ? ` · ${knownJar.title}` : ''}
      </h2>

      {error && (
        <div role="alert" className="my-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {(stage === 'token' || stage === 'loadingJars') && (
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
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleToken()}
              placeholder={t('monobank.tokenPlaceholder')}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className={INPUT}
            />
          </label>

          {stage === 'loadingJars' && jarsWait > 0 && (
            <p className="flex items-center gap-2 text-xs text-indigo-600" aria-live="polite">
              <CountdownRing secondsLeft={jarsWait} totalSeconds={REQUEST_GAP_SECONDS} className="w-5 h-5 shrink-0" />
              <span>
                {t('monobank.waitingPause', { seconds: jarsWait })} · {t('monobank.rateLimitPause')}
              </span>
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleToken}
              disabled={!token.trim() || stage === 'loadingJars'}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {stage === 'loadingJars' && <SpinnerIcon className="w-4 h-4 animate-spin" />}
              {mode === 'update' ? t('monobank.continue') : t('monobank.showJars')}
            </button>
            <button onClick={onCancel} className="btn-secondary">
              {t('monobank.cancel')}
            </button>
          </div>
        </div>
      )}

      {stage === 'jars' && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-gray-600">{t('monobank.pickJar')}</p>
          {jars.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">{t('monobank.noJars')}</p>
          ) : (
            <div className="space-y-2">
              {jars.map((j) => {
                const usable = isUahJar(j);
                const selected = j.id === jarId;
                return (
                  <label
                    key={j.id}
                    className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${
                      !usable
                        ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200'
                        : selected
                          ? 'cursor-pointer bg-indigo-50 border-indigo-400'
                          : 'cursor-pointer bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="monobank-jar"
                      checked={selected}
                      disabled={!usable}
                      onChange={() => setJarId(j.id)}
                      className="mt-1 accent-indigo-600"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-gray-900 truncate">{j.title}</span>
                      <span className="block text-sm text-gray-500">
                        {t('monobank.jarBalance', { amount: fmtUah(j.balance) })}
                        {j.goal > 0 && ` · ${t('monobank.jarGoal', { amount: fmtUah(j.goal) })}`}
                      </span>
                      {!usable && <span className="block text-xs text-amber-600 mt-1">{t('monobank.uahOnly')}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={() => setStage('range')} disabled={!selectedJar} className="btn-primary flex-1">
              {t('monobank.continue')}
            </button>
            <button onClick={onCancel} className="btn-secondary">
              {t('monobank.cancel')}
            </button>
          </div>
        </div>
      )}

      {(stage === 'range' || stage === 'fetching') && (
        <div className="mt-4 space-y-4">
          {selectedJar && <p className="text-sm text-gray-600">{t('monobank.fromJar', { title: selectedJar.title })}</p>}
          {mode === 'update' && <p className="text-sm text-gray-600">{t('monobank.updateHint')}</p>}

          <div className="grid grid-cols-2 gap-4">
            <DateField
              label={t('monobank.from')}
              value={range.from}
              max={range.to || today}
              disabled={stage === 'fetching'}
              onChange={(from) => setRange((r) => ({ ...r, from }))}
            />
            <DateField
              label={t('monobank.to')}
              value={range.to}
              min={range.from}
              max={today}
              disabled={stage === 'fetching'}
              onChange={(to) => setRange((r) => ({ ...r, to }))}
            />
          </div>

          {requests > 1 && stage === 'range' && (
            <p className="text-xs text-gray-500">{t('monobank.manyRequests', { count: requests, minutes: requests - 1 })}</p>
          )}

          {stage === 'fetching' && (
            <div className="px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-xl text-sm text-indigo-900" aria-live="polite">
              <div className="flex items-center gap-2 font-medium">
                {progress && progress.waitSeconds > 0 ? (
                  <CountdownRing secondsLeft={progress.waitSeconds} totalSeconds={REQUEST_GAP_SECONDS} className="w-5 h-5 shrink-0" />
                ) : (
                  <SpinnerIcon className="w-5 h-5 shrink-0 animate-spin" />
                )}
                {progress && progress.waitSeconds > 0
                  ? // part 2+ of a long period vs. a plain pause (a repeated request, or Monobank asking us to slow down)
                    t(progress.done > 0 ? 'monobank.waiting' : 'monobank.waitingPause', { seconds: progress.waitSeconds })
                  : t('monobank.requesting')}
              </div>
              {progress && progress.total > 1 && (
                <p className="mt-1 text-xs text-indigo-600">
                  {t('monobank.progress', { done: progress.done, total: progress.total })}
                </p>
              )}
              {progress && progress.waitSeconds > 0 && (
                <p className="mt-1 text-xs text-indigo-600">
                  {t(progress.total > 1 ? 'monobank.rateLimit' : 'monobank.rateLimitPause')}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            {stage === 'fetching' ? (
              <button onClick={handleStop} className="btn-secondary flex-1">
                {t('monobank.stop')}
              </button>
            ) : (
              <>
                <button onClick={handleFetch} disabled={!rangeValid} className="btn-primary flex-1">
                  {t('monobank.fetch')}
                </button>
                <button onClick={onCancel} className="btn-secondary">
                  {t('monobank.cancel')}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
