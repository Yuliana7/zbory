import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../context/AppContext';
import type { OwnJar } from '../../types';
import { goalPct, listOwnJars, ownJarDataset, setOwnJarArchived, setOwnJarGoalReached, setOwnJarStatement } from '../../utils/ownJars';
import { listCampaigns, type CampaignMeta } from '../../utils/campaignStore';
import { archiveYear, isArchived } from '../../utils/archive';
import { downloadCSV, manualRowsToCSVString, rawDonationsToManualRows } from '../../utils/csvExporter';
import { normalizeDonations, parseCSV } from '../../utils/csvParser';
import { aggregateDonations } from '../../utils/dataAggregator';
import { GrowthSection, MoneySection, StatsGrid, SupportersSection } from './ArchiveStory';
import { GoalReachedQuestion } from './GoalReachedQuestion';
import { fmtUah } from '../../utils/friendJars';
import { CopyJarLink } from '../insights/friendsShared';
import { ArrowLeftIcon, ArrowRightIcon, DownloadIcon, ImageIcon, LockIcon } from '../../icons';

const longDate = (ms: number) => new Date(ms).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
const shortDay = (ms: number) => new Date(ms).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });

/** One of the user's own friendly jars, closed: what it raised against its own goal, the main jar it fed
 * (opening that project's archive page when it is archived too), how the amount grew, and its history.
 * With the jar's statement (asked for from the bank's support) it tells the same story a project does,
 * and makes cards. */
export function ArchivedOwnJar({ id }: { id: string }) {
  const { t } = useTranslation('archive');
  const { dispatch, handleLoadCampaigns } = useAppContext();
  const [jar, setJar] = useState<OwnJar | null | 'missing'>(null);
  const [mainProject, setMainProject] = useState<CampaignMeta | null>(null);
  const [reading, setReading] = useState(false);
  const [statementError, setStatementError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listOwnJars()
      .then((all) => {
        const found = all.find((j) => j.id === id) ?? null;
        setJar(found ?? 'missing');
        const short = found?.main?.shortId;
        if (short) return listCampaigns().then((cs) => setMainProject(cs.find((c) => isArchived(c) && c.monobankJar?.shortId === short) ?? null));
      })
      .catch(() => setJar('missing'));
  }, [id]);

  // the statement's numbers, when there is one
  const told = useMemo(() => {
    if (!jar || jar === 'missing' || !jar.statement) return null;
    const { donations, withdrawals, currentBalance } = normalizeDonations(jar.statement);
    return donations.length ? { donations, aggregates: aggregateDonations(donations, withdrawals, currentBalance) } : null;
  }, [jar]);

  const back = () => dispatch({ type: 'ARCHIVE_VIEW', payload: null });
  if (jar === null) return null;
  if (jar === 'missing') {
    return (
      <div className="max-w-xl mx-auto py-10 text-center">
        <p className="text-sm text-gray-600">{t('page.loadError')}</p>
        <button onClick={back} className="btn-secondary mt-4">{t('list.title')}</button>
      </div>
    );
  }

  const pct = goalPct(jar.raised, jar.target);
  const main = jar.main;
  const mainTotal = mainProject?.summary.totalAmount ?? main?.raised;
  const share = mainTotal ? Math.round((jar.raised / mainTotal) * 100) : null;
  const history = jar.history ?? [];
  const maxPoint = Math.max(1, ...history.map((h) => h.raised));
  const card = 'rounded-2xl border border-gray-200 bg-white shadow-sm';

  const downloadHistory = () => {
    const rows = [['Дата', 'Зібрано, ₴'], ...history.map((h) => [new Date(h.at).toLocaleDateString('uk-UA'), h.raised.toFixed(2)])];
    return downloadCSV(rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n'), `${(jar.name || 'banka').replace(/[\\/:*?"<>|]+/g, ' ')} — історія.csv`);
  };
  const addStatement = async (file: File | undefined) => {
    if (!file) return;
    setStatementError(null);
    setReading(true);
    try {
      const rows = await parseCSV(file);
      if (normalizeDonations(rows).donations.length === 0) setStatementError(t('statement.noDonations'));
      else setJar(await setOwnJarStatement(jar, rows));
    } catch {
      setStatementError(t('statement.readError'));
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  const removeStatement = async () => {
    if (!window.confirm(t('statement.removeConfirm'))) return;
    setJar(await setOwnJarStatement(jar, null));
  };
  const makeCards = async () => {
    const dataset = ownJarDataset(jar);
    if (!dataset) return;
    if (await handleLoadCampaigns([], { proceed: true, extra: [{ dataset, goal: jar.target }] })) {
      dispatch({ type: 'ARCHIVED_CARDS_OPENED', payload: { kind: 'ownJar', id: jar.id } });
    }
  };
  const stem = (jar.name || 'banka').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'banka';
  // the statement's total next to what the jar showed: a statement for part of the time reads short
  const statementTotal = told?.aggregates.totalAmount ?? 0;
  const mismatch = told && Math.abs(statementTotal - jar.raised) > Math.max(1, jar.raised * 0.01);
  const fileInput = (
    <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void addStatement(e.target.files?.[0])} />
  );

  const unarchive = async () => {
    if (!window.confirm(t('page.unarchiveConfirm', { name: jar.name || '—' }))) return;
    await setOwnJarArchived(jar, null);
    dispatch({ type: 'SECTION_CHANGED', payload: 'active' });
  };

  return (
    <div className="max-w-2xl mx-auto py-4 sm:py-8 space-y-4 animate-fade-in">
      <button onClick={back} className="flex items-center gap-1.5 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">
        <ArrowLeftIcon className="h-4 w-4" />
        {t('page.back', { year: archiveYear(jar) })}
      </button>

      <div className="space-y-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
          <LockIcon className="h-3.5 w-3.5" />
          {t('page.ownBadge', { date: longDate(jar.archivedAt!) })}
        </span>
        <h2 className="text-2xl font-bold leading-tight text-gray-900 [overflow-wrap:anywhere]">{jar.name || '—'}</h2>
      </div>

      <section className={`${card} p-5 space-y-2.5`}>
        <p className="text-sm text-gray-600">{t('page.ownRaised')}</p>
        <p className="text-4xl font-extrabold tracking-tight text-gray-900">{fmtUah(jar.raised)} ₴</p>
        {/* no goal was set: the user's word on it, for «Мій рік» */}
        {pct === null && (
          <div className="border-t border-gray-100 pt-2.5">
            <GoalReachedQuestion value={jar.goalReached} onChange={(v) => void setOwnJarGoalReached(jar, v).then(setJar)} />
          </div>
        )}
        {pct !== null && (
          <>
            <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
              <div className={`h-full rounded-full ${pct >= 100 ? 'bg-green-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t('page.ownGoal', { goal: fmtUah(jar.target!) })}</span>
              <span className={`font-bold ${pct >= 100 ? 'text-green-700' : 'text-indigo-700'}`}>{pct}%</span>
            </div>
          </>
        )}
      </section>

      {main && (
        <button
          onClick={mainProject ? () => dispatch({ type: 'ARCHIVE_VIEW', payload: { kind: 'project', id: mainProject.id } }) : undefined}
          disabled={!mainProject}
          className={`${card} flex w-full items-center gap-3 p-4 text-left ${mainProject ? 'hover:border-indigo-300' : 'cursor-default'}`}
        >
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-gray-600">{t('page.mainJar')}</span>
            <span className="block font-semibold text-gray-900">
              {mainProject?.name ?? main.title ?? '—'}
              {mainTotal !== undefined && ` · ${fmtUah(mainTotal)} ₴`}
            </span>
            {share !== null && <span className="block text-xs text-gray-600">{t('page.myShare', { pct: share })}</span>}
          </span>
          {mainProject && <ArrowRightIcon className="h-4 w-4 shrink-0 text-gray-500" />}
        </button>
      )}

      {told ? (
        <>
          <StatsGrid aggregates={told.aggregates} />
          {mismatch && (
            <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {t('statement.mismatch', { statement: fmtUah(statementTotal), raised: fmtUah(jar.raised) })}
            </p>
          )}
          <GrowthSection aggregates={told.aggregates} donations={told.donations} goal={jar.target} />
          <SupportersSection donations={told.donations} />
          <MoneySection aggregates={told.aggregates} />
        </>
      ) : (
        <section className={`${card} p-4 space-y-3`}>
          <h3 className="text-sm font-semibold text-gray-900">{t('statement.title')}</h3>
          <p className="text-sm leading-relaxed text-gray-600">{t('statement.addText')}</p>
          {statementError && (
            <p role="alert" className="text-sm text-red-700">
              {statementError}
            </p>
          )}
          <button onClick={() => fileRef.current?.click()} disabled={reading} className="btn-secondary flex w-full items-center justify-center gap-2">
            {reading ? t('statement.reading') : t('statement.add')}
          </button>
          {fileInput}
        </section>
      )}

      {!told && history.length > 1 && (
        <section className={`${card} p-4 space-y-2`}>
          <h3 className="text-sm font-semibold text-gray-900">{t('page.growth')}</h3>
          <div role="img" aria-label={t('page.growth')} className="flex h-24 items-end gap-1">
            {history.map((h) => (
              <div key={h.at} className="flex-1 rounded-t bg-indigo-300" style={{ height: `${Math.max(3, Math.round((h.raised / maxPoint) * 96))}px` }} />
            ))}
          </div>
          <div className="flex justify-between text-[11px] text-gray-600">
            <span>{shortDay(history[0].at)}</span>
            <span>{shortDay(history[history.length - 1].at)}</span>
          </div>
        </section>
      )}

      {(history.length > 0 || told) && (
        <section className={`${card} overflow-hidden`}>
          {told && (
            <button
              onClick={() => void downloadCSV(manualRowsToCSVString(rawDonationsToManualRows(jar.statement!)), `${stem}.csv`)}
              className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <DownloadIcon className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-gray-900">{t('statement.title')}</span>
                <span className="block text-xs text-gray-600">{t('page.statementNote', { count: told.aggregates.donationCount })}</span>
              </span>
            </button>
          )}
          {history.length > 0 && (
          <button onClick={() => void downloadHistory()} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <DownloadIcon className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-gray-900">{t('page.history')}</span>
              <span className="block text-xs text-gray-600">{t('page.historyNote')}</span>
            </span>
          </button>
          )}
        </section>
      )}

      {told && (
        <button onClick={() => void makeCards()} className="btn-primary flex w-full items-center justify-center gap-2">
          <ImageIcon className="h-4 w-4" />
          {t('page.cards')}
        </button>
      )}

      <div className="flex flex-col items-center gap-1 pt-1">
        {jar.shortId && <CopyJarLink shortId={jar.shortId} />}
        {told && (
          <div className="flex items-center gap-1 text-sm">
            <button onClick={() => fileRef.current?.click()} disabled={reading} className="px-2 py-2 font-medium text-gray-600 underline hover:text-gray-900">
              {reading ? t('statement.reading') : t('statement.replace')}
            </button>
            <span className="text-gray-300" aria-hidden="true">·</span>
            <button onClick={() => void removeStatement()} className="px-2 py-2 font-medium text-gray-600 underline hover:text-gray-900">
              {t('statement.remove')}
            </button>
            {fileInput}
          </div>
        )}
        {statementError && told && (
          <p role="alert" className="text-sm text-red-700">
            {statementError}
          </p>
        )}
        <button onClick={() => void unarchive()} className="px-2 py-2 text-sm font-medium text-gray-600 underline hover:text-gray-900">
          {t('page.unarchive')}
        </button>
      </div>
    </div>
  );
}
