import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OwnJar } from '../../types';
import { useAppContext } from '../../context/AppContext';
import { fmtUah } from '../../utils/friendJars';
import { formatWhen } from '../../utils/friendsRefresh';
import { forecast, growth } from '../../utils/friendInsights';
import { addOwnJar, goalPct, ownJarsStale, removeOwnJar, renewOwnJars, saveOwnJar, sortOwnJars } from '../../utils/ownJars';
import type { JarErrorKind } from '../../utils/monobankJar';
import { CopyJarLink } from '../insights/friendsShared';
import { JarChartModal } from '../insights/JarChartModal';
import { ImageIcon, PlusIcon, RefreshIcon, SpinnerIcon, TrashIcon } from '../../icons';

const GROWTH_DAYS = 7;

/** «Мої дружні банки»: the user's own friendly jars, which Monobank leaves out of their statement.
 * Added by link, read from the jar's public numbers, renewed together; each opens the templates. */
export function OwnJarsTab({ jars, onJarsChange }: { jars: OwnJar[]; onJarsChange: (jars: OwnJar[]) => void }) {
  const { t } = useTranslation('upload');
  const { t: tExport } = useTranslation('export');
  const { dispatch } = useAppContext();
  const [input, setInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [renewing, setRenewing] = useState(false);
  const [renewError, setRenewError] = useState<JarErrorKind | null>(null);
  const [chartId, setChartId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const jarsRef = useRef(jars);
  jarsRef.current = jars;
  const ctl = useRef<AbortController | null>(null);

  const errorText = (kind: string) => tExport(`friends.jarErrors.${kind}`);

  const renew = useCallback(async () => {
    const list = jarsRef.current;
    if (list.length === 0) return;
    ctl.current?.abort();
    const controller = new AbortController();
    ctl.current = controller;
    setRenewing(true);
    setRenewError(null);
    try {
      const res = await renewOwnJars(list, { signal: controller.signal });
      if (controller.signal.aborted) return;
      // only jars still in the list: one removed while the reads ran stays removed
      const ids = new Set(jarsRef.current.map((j) => j.id));
      const kept = res.jars.filter((j) => ids.has(j.id));
      await Promise.all(kept.map(saveOwnJar));
      onJarsChange(sortOwnJars(kept));
      if (res.failed > 0) setRenewError(res.firstError ?? 'unexpected');
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) setRenewError('unexpected');
    } finally {
      if (ctl.current === controller) {
        ctl.current = null;
        setRenewing(false);
      }
    }
  }, [onJarsChange]);

  // opening the tab brings jars nobody has read for a while up to date, once
  const autoRenewed = useRef(false);
  useEffect(() => {
    if (autoRenewed.current || jars.length === 0) return;
    autoRenewed.current = true;
    if (ownJarsStale(jars, Date.now())) void renew();
  }, [jars, renew]);
  useEffect(() => () => ctl.current?.abort(), []);

  const add = async () => {
    const text = input.trim();
    if (!text || adding) return;
    setAdding(true);
    setAddError(null);
    const res = await addOwnJar(text, jarsRef.current);
    setAdding(false);
    if ('error' in res) {
      setAddError(errorText(res.error));
      return;
    }
    await saveOwnJar(res.jar);
    onJarsChange(sortOwnJars([...jarsRef.current, res.jar]));
    setInput('');
  };

  const remove = async (jar: OwnJar) => {
    if (!window.confirm(t('ownJars.removeConfirm', { name: jar.name || '—' }))) return;
    await removeOwnJar(jar.id);
    onJarsChange(jarsRef.current.filter((j) => j.id !== jar.id));
  };

  const asOf = jars.filter((j) => !j.closed && j.syncedAt).map((j) => j.syncedAt!);
  const chartJar = jars.find((j) => j.id === chartId);
  const closeChart = useCallback(() => setChartId(null), []);

  return (
    <div className="max-w-3xl mx-auto mb-10 animate-fade-in">
      <p className="mb-4 px-1 text-sm text-gray-500 text-center">{t('ownJars.intro')}</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
        className="mb-2 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setAddError(null);
          }}
          placeholder={t('ownJars.placeholder')}
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label={t('ownJars.placeholder')}
          className="min-w-0 flex-1 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent placeholder:text-gray-400"
        />
        <button
          type="submit"
          disabled={adding || !input.trim()}
          className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white text-sm font-semibold transition-colors"
        >
          {adding ? <SpinnerIcon className="w-4 h-4 animate-spin" /> : <PlusIcon className="w-4 h-4" />}
          {t('ownJars.add')}
        </button>
      </form>
      {addError && (
        <p role="alert" className="mb-2 px-1 text-xs text-red-600">
          {addError}
        </p>
      )}

      {jars.length > 0 && (
        <div className="mt-4 mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1 text-xs text-gray-500" aria-live="polite">
          <span>
            {renewing
              ? t('ownJars.renewing')
              : asOf.length > 0
                ? t('ownJars.asOf', { when: formatWhen(Math.min(...asOf)) })
                : null}
          </span>
          <button
            onClick={renewing ? () => ctl.current?.abort() : () => void renew()}
            className="flex items-center gap-1 font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            {renewing ? <SpinnerIcon className="w-3.5 h-3.5 animate-spin" /> : <RefreshIcon className="w-3.5 h-3.5" />}
            {renewing ? t('ownJars.stop') : t('ownJars.renew')}
          </button>
          {renewError && !renewing && (
            <p role="alert" className="basis-full text-amber-700">
              {errorText(renewError)}
            </p>
          )}
        </div>
      )}

      {jars.length === 0 ? (
        <p className="mt-6 text-center text-sm text-gray-400">{t('ownJars.empty')}</p>
      ) : (
        <ul className="space-y-3">
          {jars.map((jar) => (
            <OwnJarItem
              key={jar.id}
              jar={jar}
              now={now}
              onChart={() => setChartId(jar.id)}
              onCards={() => dispatch({ type: 'OWN_JAR_OPENED', payload: jar })}
              onRemove={() => void remove(jar)}
            />
          ))}
        </ul>
      )}

      {chartJar && <JarChartModal friend={chartJar} now={now} onClose={closeChart} />}
    </div>
  );
}

function OwnJarItem({ jar, now, onChart, onCards, onRemove }: { jar: OwnJar; now: number; onChart: () => void; onCards: () => void; onRemove: () => void }) {
  const { t } = useTranslation('upload');
  const pct = goalPct(jar.raised, jar.target);
  const left = jar.target ? Math.max(0, jar.target - jar.raised) : 0;
  const g = growth(jar, GROWTH_DAYS, now);
  const eta = jar.closed ? null : forecast(jar, now);
  const main = jar.main;
  const mainPct = main ? goalPct(main.raised ?? 0, main.goal) : null;
  const action = 'flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors';

  return (
    <li className="px-4 py-3.5 bg-white border border-gray-100 rounded-xl shadow-sm">
      {/* like a row on the friends page: the jar's numbers open its chart */}
      <button onClick={onChart} aria-haspopup="dialog" title={t('ownJars.chart')} className="block w-full text-left">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="min-w-0 truncate text-sm font-semibold text-gray-900">
          {jar.name || '—'}
          {jar.closed && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">{t('ownJars.closed')}</span>}
        </h3>
        <span className="shrink-0 text-lg font-bold text-gray-900 whitespace-nowrap">{fmtUah(jar.raised)} ₴</span>
      </div>

      {pct !== null && (
        <div className="mt-1.5">
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className={`h-full rounded-full ${pct >= 100 ? 'bg-green-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {t('ownJars.ofGoal', { pct, goal: fmtUah(jar.target!) })}
            {left > 0 ? ` · ${t('ownJars.left', { amount: fmtUah(left) })}` : ` · ${t('ownJars.reached')}`}
            {left > 0 && eta && ` · ${t('ownJars.eta', { date: new Date(eta).toLocaleDateString('uk-UA') })}`}
          </p>
        </div>
      )}
      {g && g.delta > 0 && (
        <p className="mt-0.5 text-xs font-medium text-gray-700">
          {t('ownJars.growth', { amount: fmtUah(g.delta), when: new Date(g.since).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' }) })}
        </p>
      )}
      </button>

      {main && (
        <div className="mt-2.5 rounded-lg bg-indigo-50/60 px-3 py-2 text-xs text-gray-600">
          {main.title ? (
            <>
              <p className="min-w-0 truncate">
                {t('ownJars.mainFor')} <span className="font-semibold text-gray-800">«{main.title}»</span>
                {main.ownerName && ` · ${main.ownerName}`}
              </p>
              {main.raised !== undefined && (
                <p className="mt-0.5">
                  {main.goal ? t('ownJars.mainRaisedOf', { raised: fmtUah(main.raised), goal: fmtUah(main.goal) }) : t('ownJars.mainRaised', { raised: fmtUah(main.raised) })}
                  {mainPct !== null && ` · ${mainPct}%`}
                  {main.closed && ` · ${t('ownJars.closed')}`}
                </p>
              )}
            </>
          ) : (
            <p>{t('ownJars.mainUnknown')}</p>
          )}
        </div>
      )}

      <div className="mt-2.5 -mx-2 flex flex-wrap items-center gap-x-1 gap-y-1">
        <button onClick={onCards} className={`${action} text-white bg-indigo-600 hover:bg-indigo-700 px-3`}>
          <ImageIcon className="w-3.5 h-3.5" />
          {t('ownJars.cards')}
        </button>
        {jar.shortId && <CopyJarLink shortId={jar.shortId} />}
        <button onClick={onRemove} title={t('ownJars.remove')} aria-label={t('ownJars.remove')} className={`${action} ml-auto text-gray-400 hover:text-red-600 hover:bg-red-50`}>
          <TrashIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </li>
  );
}
