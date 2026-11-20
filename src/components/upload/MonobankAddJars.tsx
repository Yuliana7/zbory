import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MonobankJarRef, OwnJar, RawDonation } from '../../types';
import {
  MonobankError,
  dayEndSec,
  dayStartSec,
  defaultRange,
  estimateRequests,
  fetchJarStatement,
  fetchJars,
  jarGoal,
  jarShortId,
  REQUEST_GAP_SECONDS,
  statementItemsToRawDonations,
  toIsoDate,
  type FetchProgress,
} from '../../utils/monobankApi';
import { forgetToken, loadToken, saveToken } from '../../utils/monobankToken';
import { listCampaigns, saveCampaign } from '../../utils/campaignStore';
import { attachJarLink, listOwnJars, mergeMonoIntoOwn, ownJarFromMono, saveOwnJar } from '../../utils/ownJars';
import { jarChoices, type JarChoice, type JarKind } from '../../utils/addJars';
import { fmtUah } from '../../utils/friendJars';
import { DateRangeField } from '../DateRangeField';
import { MonobankTokenForm, TOKEN_INPUT } from './MonobankTokenForm';
import { CountdownRing } from './CountdownRing';
import { CheckIcon, SpinnerIcon } from '../../icons';

type Stage = 'token' | 'loadingJars' | 'pick' | 'details' | 'working' | 'done';

export interface AddJarsResult {
  /** where to land: the projects or the friendly jars */
  tab: 'saved' | 'own';
}

interface Summary {
  mains: string[];
  friendly: string[];
  emptyMains: string[];
  failedMains: string[];
  badLinks: string[];
}

const kopecks = (n: number) => fmtUah(n / 100);

/**
 * «Додати банку» → Monobank: every jar of the user's client-info, main and friendly together. The kind
 * comes from Monobank (a friendly jar has no share id) and can be switched. Friendly jars come in at once
 * with their amount and goal (a link can be added, and one already tracked by link can be merged into);
 * main jars with their statement for one period, one after another (Monobank allows a statement a minute).
 * A single main jar and nothing else opens its analytics, as before.
 */
export function MonobankAddJars({
  onDone,
  onCancel,
  onSingleMain,
}: {
  onDone: (result: AddJarsResult) => void;
  onCancel: () => void;
  onSingleMain: (rows: RawDonation[], jar: MonobankJarRef, goal?: number) => Promise<void>;
}) {
  const { t } = useTranslation('upload');
  const { t: tc } = useTranslation();
  const [stage, setStage] = useState<Stage>('token');
  const [token, setToken] = useState(() => loadToken() ?? '');
  const [remember, setRemember] = useState(() => !!loadToken());
  const [wait, setWait] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [choices, setChoices] = useState<JarChoice[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [kinds, setKinds] = useState<Map<string, JarKind>>(new Map());
  const [links, setLinks] = useState<Map<string, string>>(new Map());
  const [separate, setSeparate] = useState<Set<string>>(new Set());
  const [range, setRange] = useState(() => defaultRange());
  const [progress, setProgress] = useState<{ index: number; total: number; name: string; fetch: FetchProgress | null } | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const describe = (err: unknown) => t(`monobank.errors.${err instanceof MonobankError ? err.kind : 'unexpected'}`);
  const kindOf = (c: JarChoice) => kinds.get(c.jar.id) ?? c.kind;
  const chosen = choices.filter((c) => picked.has(c.jar.id));
  const mains = chosen.filter((c) => kindOf(c) === 'main');
  const friendly = chosen.filter((c) => kindOf(c) === 'friendly');
  const today = toIsoDate(new Date());
  const rangeValid = range.from !== '' && range.to !== '' && range.from <= range.to && range.to <= today;
  const requestsEach = rangeValid ? estimateRequests(dayStartSec(range.from), dayEndSec(range.to, Math.floor(Date.now() / 1000))) : 1;

  const loadJars = async () => {
    if (!token.trim()) return;
    setError(null);
    setStage('loadingJars');
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const [jars, campaigns, ownJars] = await Promise.all([fetchJars(token, { signal: abort.signal, onWait: setWait }), listCampaigns(), listOwnJars()]);
      if (remember) saveToken(token);
      else forgetToken();
      const list = jarChoices(jars, campaigns, ownJars);
      setChoices(list);
      setPicked(new Set());
      setStage('pick');
    } catch (err) {
      if (abort.signal.aborted) return;
      if (err instanceof MonobankError && err.kind === 'invalid-token') forgetToken();
      setError(describe(err));
      setStage('token');
    } finally {
      setWait(0);
    }
  };

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const switchKind = (c: JarChoice) => setKinds((prev) => new Map(prev).set(c.jar.id, kindOf(c) === 'main' ? 'friendly' : 'main'));

  const run = async () => {
    setError(null);
    setStage('working');
    const abort = new AbortController();
    abortRef.current = abort;
    const done: Summary = { mains: [], friendly: [], emptyMains: [], failedMains: [], badLinks: [] };
    const now = Date.now();

    // friendly jars first: no statement to wait for
    const known: OwnJar[] = await listOwnJars();
    // a jar tracked by link can take only one client-info jar
    const merged = new Set<string>();
    for (const c of friendly) {
      const merge = c.match && !separate.has(c.jar.id) && !merged.has(c.match.id) ? c.match : null;
      if (merge) merged.add(merge.id);
      let jar = merge ? mergeMonoIntoOwn(merge, c.jar, now) : ownJarFromMono(c.jar, now);
      const link = links.get(c.jar.id)?.trim();
      if (link && !jar.jarId) {
        const res = await attachJarLink(jar, link, known, { signal: abort.signal }).catch(() => ({ error: 'unexpected' as const }));
        if ('jar' in res) jar = res.jar;
        else done.badLinks.push(jar.name);
      }
      await saveOwnJar(jar);
      known.push(jar);
      done.friendly.push(jar.name);
    }

    // main jars: one statement after another, each paced by Monobank's limit
    const fromSec = dayStartSec(range.from);
    const toSec = dayEndSec(range.to, Math.floor(Date.now() / 1000));
    for (const [index, c] of mains.entries()) {
      if (abort.signal.aborted) return;
      const ref: MonobankJarRef = { id: c.jar.id, title: c.jar.title, shortId: jarShortId(c.jar) };
      setProgress({ index, total: mains.length, name: c.jar.title, fetch: null });
      try {
        const items = await fetchJarStatement({
          token,
          jarId: c.jar.id,
          fromSec,
          toSec,
          signal: abort.signal,
          onProgress: (fetch) => setProgress({ index, total: mains.length, name: c.jar.title, fetch }),
        });
        const rows = statementItemsToRawDonations(items);
        if (rows.length === 0) {
          done.emptyMains.push(c.jar.title);
          continue;
        }
        // one main jar and nothing else: straight into its analytics, as before
        if (mains.length === 1 && friendly.length === 0) {
          await onSingleMain(rows, ref, jarGoal(c.jar));
          return;
        }
        await saveCampaign({ name: c.jar.title, rawData: rows, fileName: null, goal: jarGoal(c.jar), monobankJar: ref, monobankSyncedAt: Date.now() });
        done.mains.push(c.jar.title);
      } catch (err) {
        if (abort.signal.aborted) return;
        if (err instanceof MonobankError && err.kind === 'invalid-token') {
          forgetToken();
          setError(describe(err));
          setStage('token');
          return;
        }
        done.failedMains.push(c.jar.title);
      }
    }
    setProgress(null);
    setSummary(done);
    setStage('done');
  };

  const stop = () => {
    abortRef.current?.abort();
    setProgress(null);
    setStage('details');
  };

  const pill = (on: boolean) =>
    `shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${on ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'}`;

  return (
    <div className="max-w-xl mx-auto animate-fade-in">
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 text-center">{t('addJars.title')}</h2>
      {error && (
        <div role="alert" className="my-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {(stage === 'token' || stage === 'loadingJars') && (
        <MonobankTokenForm
          token={token}
          onToken={setToken}
          remember={remember}
          onRemember={setRemember}
          onSubmit={() => void loadJars()}
          onCancel={onCancel}
          loading={stage === 'loadingJars'}
          wait={wait}
        />
      )}

      {stage === 'pick' && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-gray-600">{t('addJars.pick')}</p>
          {choices.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">{t('monobank.noJars')}</p>
          ) : (
            <ul className="space-y-2">
              {choices.map((c) => {
                const kind = kindOf(c);
                const disabled = !c.usable || !!c.added;
                const on = picked.has(c.jar.id);
                return (
                  <li
                    key={c.jar.id}
                    className={`flex items-start gap-3 rounded-xl border p-4 transition-colors ${
                      disabled ? 'bg-gray-50 border-gray-200 opacity-60' : on ? 'bg-indigo-50 border-indigo-400' : 'bg-white border-gray-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={disabled}
                      onChange={() => toggle(c.jar.id)}
                      aria-label={c.jar.title}
                      className="mt-1 h-5 w-5 shrink-0 accent-indigo-600"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-gray-900 [overflow-wrap:anywhere]">{c.jar.title}</span>
                      <span className="block text-sm text-gray-500">
                        {t('monobank.jarBalance', { amount: kopecks(c.jar.balance) })}
                        {c.jar.goal > 0 && ` · ${t('monobank.jarGoal', { amount: kopecks(c.jar.goal) })}`}
                      </span>
                      {c.added && <span className="mt-1 block text-xs font-medium text-gray-600">{t(`addJars.added.${c.added}`)}</span>}
                      {!c.usable && <span className="mt-1 block text-xs text-amber-600">{t('monobank.uahOnly')}</span>}
                      {!c.added && kind === 'friendly' && c.match && (
                        <span className="mt-1 block text-xs text-amber-700">{t('addJars.looksLike', { name: c.match.name })}</span>
                      )}
                    </span>
                    {/* the kind Monobank suggests, switchable */}
                    <button
                      onClick={() => switchKind(c)}
                      disabled={disabled}
                      title={t('addJars.switchKind')}
                      aria-label={`${t(`addJars.kind.${kind}`)} · ${t('addJars.switchKind')}`}
                      className={pill(kind === 'main')}
                    >
                      {t(`addJars.kind.${kind}`)} ⇄
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-xs text-gray-500">{t('addJars.kindHint')}</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={() => setStage('details')} disabled={chosen.length === 0} className="btn-primary flex-1">
              {t('monobank.continue')}
            </button>
            <button onClick={onCancel} className="btn-secondary">
              {t('monobank.cancel')}
            </button>
          </div>
        </div>
      )}

      {stage === 'details' && (
        <div className="mt-4 space-y-5">
          {friendly.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">{t('addJars.friendlyTitle', { count: friendly.length })}</h3>
              <p className="text-xs text-gray-500">{t('addJars.linkWhy')}</p>
              {friendly.map((c) => {
                const merging = !!c.match && !separate.has(c.jar.id);
                return (
                  <div key={c.jar.id} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                    <p className="text-sm">
                      <span className="font-semibold text-gray-900 [overflow-wrap:anywhere]">{c.jar.title}</span>{' '}
                      <span className="whitespace-nowrap text-gray-500">· {kopecks(c.jar.balance)} ₴</span>
                    </p>
                    {c.match && (
                      <div className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900 space-y-2" role="group" aria-label={t('addJars.sameTitle')}>
                        <p className="font-medium">{t('addJars.sameTitle')}</p>
                        <p className="text-xs">{t('addJars.sameText', { name: c.match.name, raised: fmtUah(c.match.raised) })}</p>
                        {[true, false].map((merge) => (
                          <label key={String(merge)} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`merge-${c.jar.id}`}
                              checked={merging === merge}
                              onChange={() =>
                                setSeparate((prev) => {
                                  const next = new Set(prev);
                                  if (merge) next.delete(c.jar.id);
                                  else next.add(c.jar.id);
                                  return next;
                                })
                              }
                              className="h-4 w-4 accent-indigo-600"
                            />
                            {merge ? t('addJars.merge', { name: c.match!.name }) : t('addJars.separate')}
                          </label>
                        ))}
                      </div>
                    )}
                    {/* a merged jar keeps the link it was tracked by */}
                    {!(merging && c.match?.jarId) && (
                      <label className="block">
                        <span className="mb-1 block text-xs text-gray-600">{t('addJars.link')}</span>
                        <input
                          value={links.get(c.jar.id) ?? ''}
                          onChange={(e) => setLinks((prev) => new Map(prev).set(c.jar.id, e.target.value))}
                          placeholder={t('addJars.linkPlaceholder')}
                          inputMode="url"
                          autoCapitalize="off"
                          autoCorrect="off"
                          spellCheck={false}
                          className={TOKEN_INPUT}
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </section>
          )}

          {mains.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">{t('addJars.mainTitle', { count: mains.length })}</h3>
              <p className="text-xs text-gray-500">{mains.map((c) => c.jar.title).join(', ')}</p>
              <DateRangeField label={tc('dateRange.period')} from={range.from} to={range.to} max={today} required onChange={(from, to) => setRange({ from, to })} />
              {mains.length * requestsEach > 1 && (
                <p className="text-xs text-gray-500">{t('addJars.slow', { count: mains.length * requestsEach, minutes: mains.length * requestsEach - 1 })}</p>
              )}
            </section>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={() => void run()} disabled={mains.length > 0 && !rangeValid} className="btn-primary flex-1">
              {t('addJars.confirm', { n: chosen.length })}
            </button>
            <button onClick={() => setStage('pick')} className="btn-secondary">
              {t('addJars.back')}
            </button>
          </div>
        </div>
      )}

      {stage === 'working' && (
        <div className="mt-6 space-y-4">
          <div className="px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-xl text-sm text-indigo-900" aria-live="polite">
            <div className="flex items-center gap-2 font-medium">
              {progress?.fetch && progress.fetch.waitSeconds > 0 ? (
                <CountdownRing secondsLeft={progress.fetch.waitSeconds} totalSeconds={REQUEST_GAP_SECONDS} className="w-5 h-5 shrink-0" />
              ) : (
                <SpinnerIcon className="w-5 h-5 shrink-0 animate-spin" />
              )}
              {progress ? t('addJars.reading', { name: progress.name, n: progress.index + 1, total: progress.total }) : t('addJars.saving')}
            </div>
            {progress?.fetch && progress.fetch.waitSeconds > 0 && (
              <p className="mt-1 text-xs text-indigo-600">{t('monobank.waitingPause', { seconds: progress.fetch.waitSeconds })}</p>
            )}
          </div>
          <button onClick={stop} className="btn-secondary w-full">
            {t('monobank.stop')}
          </button>
        </div>
      )}

      {stage === 'done' && summary && (
        <div className="mt-6 space-y-4">
          <ul className="space-y-2 text-sm">
            {summary.mains.length > 0 && (
              <li className="flex gap-2">
                <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                {t('addJars.doneMains', { count: summary.mains.length, names: summary.mains.join(', ') })}
              </li>
            )}
            {summary.friendly.length > 0 && (
              <li className="flex gap-2">
                <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                {t('addJars.doneFriendly', { count: summary.friendly.length, names: summary.friendly.join(', ') })}
              </li>
            )}
          </ul>
          {(summary.emptyMains.length > 0 || summary.failedMains.length > 0 || summary.badLinks.length > 0) && (
            <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 space-y-1">
              {summary.emptyMains.length > 0 && <p>{t('addJars.emptyMains', { names: summary.emptyMains.join(', ') })}</p>}
              {summary.failedMains.length > 0 && <p>{t('addJars.failedMains', { names: summary.failedMains.join(', ') })}</p>}
              {summary.badLinks.length > 0 && <p>{t('addJars.badLinks', { names: summary.badLinks.join(', ') })}</p>}
            </div>
          )}
          <button onClick={() => onDone({ tab: summary.mains.length > 0 ? 'saved' : 'own' })} className="btn-primary w-full">
            {t('addJars.done')}
          </button>
        </div>
      )}
    </div>
  );
}
