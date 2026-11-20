import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OwnJar } from '../../types';
import { useAppContext } from '../../context/AppContext';
import { fmtUah } from '../../utils/friendJars';
import { formatWhen } from '../../utils/friendsRefresh';
import { forecast, growth } from '../../utils/friendInsights';
import { attachJarLink, goalPct, renewOwnJarsOfficial, ownJarsStale, removeOwnJar, saveOwnJar, setOwnJarArchived, sortOwnJars } from '../../utils/ownJars';
import { ARCHIVE_PAGE_SIZE, matchesName } from '../../utils/archive';
import { pageOf } from '../../utils/friendJars';
import { Pager, SearchBox } from '../ListControls';
import type { JarErrorKind } from '../../utils/monobankJar';
import { CopyJarLink } from '../insights/friendsShared';
import { JarChartModal } from '../insights/JarChartModal';
import { ArchiveIcon, ImageIcon, LinkIcon, PlusIcon, RefreshIcon, SpinnerIcon, TrashIcon } from '../../icons';
import { OwnJarArchiveSheet } from '../archive/OwnJarArchiveSheet';
import { RenewTokenSheet } from '../insights/RenewTokenSheet';
import { MonobankError, fetchJars, type MonoJar } from '../../utils/monobankApi';
import { forgetToken, loadToken, saveToken } from '../../utils/monobankToken';

const GROWTH_DAYS = 7;

/** «Мої дружні банки»: the user's own friendly jars, which Monobank leaves out of their statement.
 * Added by link, read from the jar's public numbers, renewed together; each opens the templates.
 * Only active jars are here: «В архів» files one under the year it was closed. */
export function OwnJarsTab({ jars, onJarsChange, onAdd }: { jars: OwnJar[]; onJarsChange: (jars: OwnJar[]) => void; onAdd: () => void }) {
  const { t } = useTranslation('upload');
  const { t: tExport } = useTranslation('export');
  const { t: tCommon } = useTranslation();
  const { dispatch } = useAppContext();
  const [renewing, setRenewing] = useState(false);
  const [renewError, setRenewError] = useState<JarErrorKind | null>(null);
  const [chartId, setChartId] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<OwnJar | null>(null);
  // what the last «Оновити» couldn't do the official way
  const [note, setNote] = useState<{ fellBack: string | null; unread: string[]; closed: string[] } | null>(null);
  const [wait, setWait] = useState(0);
  const [askToken, setAskToken] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [now] = useState(() => Date.now());
  const jarsRef = useRef(jars);
  jarsRef.current = jars;
  const ctl = useRef<AbortController | null>(null);

  const errorText = (kind: string) => tExport(`friends.jarErrors.${kind}`);

  /** «Оновити»: jars tied to the user's Monobank from one client-info call (with the saved token, or one
   * given just now), the rest — and those, if that call can't be made — through their public links.
   * A quiet run (opening the tab) keeps the notes about the fallback to itself. */
  const renew = useCallback(async (opts: { token?: string; quiet?: boolean } = {}) => {
    const list = jarsRef.current;
    if (list.length === 0) return;
    ctl.current?.abort();
    const controller = new AbortController();
    ctl.current = controller;
    setRenewing(true);
    setRenewError(null);
    setNote(null);
    try {
      const tied = list.some((j) => j.monoId && !j.closed);
      const token = opts.token ?? loadToken();
      let mono: MonoJar[] | null = null;
      let why: string | null = null;
      if (tied && token) {
        try {
          mono = await fetchJars(token, { signal: controller.signal, onWait: setWait });
        } catch (err) {
          if (controller.signal.aborted) return;
          const kind = err instanceof MonobankError ? err.kind : 'unexpected';
          if (kind === 'invalid-token') forgetToken();
          why = t(`monobank.errors.${kind}`);
        } finally {
          setWait(0);
        }
      } else if (tied) why = t('ownJars.noToken');
      const res = await renewOwnJarsOfficial(list, mono, { signal: controller.signal });
      if (controller.signal.aborted) return;
      // only jars still in the list: one removed while the reads ran stays removed
      const ids = new Set(jarsRef.current.map((j) => j.id));
      const kept = res.jars.filter((j) => ids.has(j.id));
      await Promise.all(kept.map(saveOwnJar));
      onJarsChange(sortOwnJars(kept));
      if (res.failed > 0) setRenewError(res.firstError ?? 'unexpected');
      if (!opts.quiet || res.closedNow.length > 0) {
        setNote({
          fellBack: res.fellBack ? why : null,
          unread: res.unread.map((j) => j.name || '—'),
          closed: res.closedNow.map((j) => j.name || '—'),
        });
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) setRenewError('unexpected');
    } finally {
      if (ctl.current === controller) {
        ctl.current = null;
        setRenewing(false);
      }
    }
  }, [onJarsChange, t]);

  // opening the tab brings jars nobody has read for a while up to date, once
  const autoRenewed = useRef(false);
  useEffect(() => {
    if (autoRenewed.current || jars.length === 0) return;
    autoRenewed.current = true;
    if (ownJarsStale(jars, Date.now())) void renew({ quiet: true });
  }, [jars, renew]);
  useEffect(() => () => ctl.current?.abort(), []);

  // a link for a jar known only through the token: copyable, its main jar found, readable without a token
  const link = async (jar: OwnJar, input: string): Promise<string | null> => {
    const res = await attachJarLink(jar, input, jarsRef.current);
    if ('error' in res) return errorText(res.error);
    await saveOwnJar(res.jar);
    onJarsChange(jarsRef.current.map((j) => (j.id === jar.id ? res.jar : j)));
    return null;
  };

  const remove = async (jar: OwnJar) => {
    if (!window.confirm(t('ownJars.removeConfirm', { name: jar.name || '—' }))) return;
    await removeOwnJar(jar.id);
    onJarsChange(jarsRef.current.filter((j) => j.id !== jar.id));
  };

  // the sheet asks whether a jar with no goal reached it, then it goes
  const archive = async (jar: OwnJar, goalReached: boolean | undefined) => {
    setArchiving(null);
    await setOwnJarArchived(goalReached === undefined ? jar : { ...jar, goalReached }, Date.now());
    onJarsChange(jarsRef.current.filter((j) => j.id !== jar.id));
  };

  const found = jars.filter((j) => matchesName(j.name, query));
  const shown = pageOf(found, page, ARCHIVE_PAGE_SIZE);

  const asOf = jars.filter((j) => !j.closed && j.syncedAt).map((j) => j.syncedAt!);
  const chartJar = jars.find((j) => j.id === chartId);
  const closeChart = useCallback(() => setChartId(null), []);

  return (
    <div className="max-w-3xl mx-auto mb-10 animate-fade-in">
      <p className="mb-4 px-1 text-sm text-gray-500 text-center">{t('ownJars.intro')}</p>

      <div className="mb-2 flex justify-end">
        <button
          onClick={onAdd}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-600 text-sm font-medium transition-colors"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          {t('addJarTitle')}
        </button>
      </div>

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
          {renewing && wait > 0 && <p className="basis-full text-indigo-600">{t('monobank.waitingPause', { seconds: wait })}</p>}
          {renewError && !renewing && (
            <p role="alert" className="basis-full text-amber-700">
              {errorText(renewError)}
            </p>
          )}
          {note && !renewing && (note.fellBack || note.unread.length > 0 || note.closed.length > 0) && (
            <div role="status" className="basis-full mt-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 space-y-1">
              {note.fellBack && <p>{t('ownJars.fellBack', { why: note.fellBack })}</p>}
              {note.unread.length > 0 && <p>{t('ownJars.unread', { names: note.unread.join(', ') })}</p>}
              {note.closed.length > 0 && <p>{t('ownJars.closedNow', { names: note.closed.join(', ') })}</p>}
              {(note.fellBack || note.unread.length > 0) && (
                <button onClick={() => setAskToken(true)} className="font-semibold text-indigo-700 underline hover:text-indigo-900">
                  {t('ownJars.enterToken')}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {jars.length > ARCHIVE_PAGE_SIZE / 2 && (
        <div className="mb-3">
          <SearchBox
            value={query}
            onChange={(q) => {
              setQuery(q);
              setPage(0);
            }}
          />
        </div>
      )}
      {jars.length === 0 ? (
        <p className="mt-6 text-center text-sm text-gray-400">{t('ownJars.empty')}</p>
      ) : found.length === 0 ? (
        <p className="mt-6 text-center text-sm text-gray-500">{tCommon('list.nothingFound', { query: query.trim() })}</p>
      ) : (
        <ul className="space-y-3">
          {shown.items.map((jar) => (
            <OwnJarItem
              key={jar.id}
              jar={jar}
              now={now}
              onChart={() => setChartId(jar.id)}
              onCards={() => dispatch({ type: 'OWN_JAR_OPENED', payload: jar })}
              onArchive={() => setArchiving(jar)}
              onRemove={() => void remove(jar)}
              onLink={(input) => link(jar, input)}
            />
          ))}
        </ul>
      )}
      <div className="mt-4">
        <Pager page={shown.page} pages={shown.pages} size={ARCHIVE_PAGE_SIZE} shown={shown.items.length} total={found.length} onPage={setPage} />
      </div>

      {chartJar && <JarChartModal friend={chartJar} now={now} onClose={closeChart} />}
      {askToken && (
        <RenewTokenSheet
          error={null}
          onSubmit={(token, remember) => {
            if (remember) saveToken(token);
            setAskToken(false);
            void renew({ token: token.trim() });
          }}
          onClose={() => setAskToken(false)}
        />
      )}
      {archiving && <OwnJarArchiveSheet jar={archiving} onConfirm={(v) => void archive(archiving, v)} onCancel={() => setArchiving(null)} />}
    </div>
  );
}

function OwnJarItem({
  jar,
  now,
  onChart,
  onCards,
  onArchive,
  onRemove,
  onLink,
}: {
  jar: OwnJar;
  now: number;
  onChart: () => void;
  onCards: () => void;
  onArchive: () => void;
  onRemove: () => void;
  /** adds the jar's public link; resolves to an error to show, or null */
  onLink: (input: string) => Promise<string | null>;
}) {
  const [linking, setLinking] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const saveLink = async () => {
    if (!linking?.trim()) return;
    setLinkBusy(true);
    const err = await onLink(linking.trim());
    setLinkBusy(false);
    if (err) setLinkError(err);
    else setLinking(null);
  };
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
        {jar.shortId ? (
          <CopyJarLink shortId={jar.shortId} />
        ) : (
          linking === null && (
            <button onClick={() => setLinking('')} className={`${action} text-indigo-600 hover:bg-indigo-50`}>
              <LinkIcon className="w-3.5 h-3.5" />
              {t('ownJars.addLink')}
            </button>
          )
        )}
        {/* a jar that is done says so: closed on Monobank or past its goal */}
        <button
          onClick={onArchive}
          className={`${action} ${jar.closed || (pct ?? 0) >= 100 ? 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}
        >
          <ArchiveIcon className="w-3.5 h-3.5" />
          {t('ownJars.toArchive')}
        </button>
        <button onClick={onRemove} title={t('ownJars.remove')} aria-label={t('ownJars.remove')} className={`${action} ml-auto text-gray-400 hover:text-red-600 hover:bg-red-50`}>
          <TrashIcon className="w-3.5 h-3.5" />
        </button>
      </div>
      {/* a jar known only through the token: its link, to copy it, find its main jar, read it without the token */}
      {linking !== null && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void saveLink();
          }}
          className="mt-2.5 space-y-1.5"
        >
          <p className="text-xs text-gray-500">{t('ownJars.linkWhy')}</p>
          <div className="flex gap-2">
            <input
              autoFocus
              value={linking}
              onChange={(e) => {
                setLinking(e.target.value);
                setLinkError(null);
              }}
              placeholder="send.monobank.ua/jar/…"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label={t('ownJars.addLink')}
              className="min-w-0 flex-1 px-3 py-2 rounded-lg border border-gray-200 bg-white text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button type="submit" disabled={linkBusy || !linking.trim()} className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {linkBusy ? <SpinnerIcon className="w-4 h-4 animate-spin" /> : t('ownJars.saveLink')}
            </button>
            <button type="button" onClick={() => setLinking(null)} className="shrink-0 rounded-lg px-2 py-2 text-sm text-gray-500 hover:bg-gray-100">
              {t('monobank.cancel')}
            </button>
          </div>
          {linkError && <p role="alert" className="text-xs text-red-600">{linkError}</p>}
        </form>
      )}
    </li>
  );
}
