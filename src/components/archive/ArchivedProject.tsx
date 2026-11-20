import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../context/AppContext';
import type { FriendJar, Raffle, RawDonation } from '../../types';
import { buildProjectBackup, getCampaignMeta, listCampaigns, loadCampaignData, unarchiveCampaign, type CampaignMeta } from '../../utils/campaignStore';
import { normalizeDonations } from '../../utils/csvParser';
import { aggregateDonations } from '../../utils/dataAggregator';
import { downloadCSV, manualRowsToCSVString, rawDonationsToManualRows } from '../../utils/csvExporter';
import { saveBlob } from '../../utils/download';
import { computeFriendStats, fmtUah, friendsToCSV } from '../../utils/friendJars';
import { biggestDonation, eligibleJars, raffleParticipants } from '../../utils/raffles';
import { formatDateRange } from '../../utils/dateRange';
import { archiveYear, isArchived } from '../../utils/archive';
import { CompareSection, GrowthSection, MoneySection, SupportersSection } from './ArchiveStory';
import { CopyJarLink } from '../insights/friendsShared';
import { ArrowLeftIcon, CalendarIcon, DownloadIcon, ImageIcon, LockIcon } from '../../icons';

interface Loaded {
  meta: CampaignMeta;
  rawData: RawDonation[];
  friends: FriendJar[];
  raffles: Raffle[];
}

const FRIENDS_SHOWN = 5;
const longDate = (ms: number) => new Date(ms).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
const fileStem = (name: string) => name.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'zbir';

/** A closed project, read-only: its final numbers, how it went, its friends and raffles as they were,
 * the files to keep, and cards made from it. Everything comes from what was saved; nothing is renewed. */
export function ArchivedProject({ id }: { id: string }) {
  const { t } = useTranslation('archive');
  const { t: tInsights } = useTranslation('insights');
  const { dispatch, handleLoadCampaign } = useAppContext();
  const [loaded, setLoaded] = useState<Loaded | null | 'error'>(null);
  const [allFriends, setAllFriends] = useState(false);
  const [archived, setArchived] = useState<CampaignMeta[]>([]);

  useEffect(() => {
    Promise.all([getCampaignMeta(id), loadCampaignData(id)])
      .then(([meta, data]) => setLoaded(meta && data ? { meta, rawData: data.rawData, friends: data.friends, raffles: data.raffles } : 'error'))
      .catch(() => setLoaded('error'));
    // the other closed projects, to compare with
    listCampaigns().then((all) => setArchived(all.filter(isArchived))).catch(() => setArchived([]));
  }, [id]);

  const numbers = useMemo(() => {
    if (!loaded || loaded === 'error') return null;
    const { donations, withdrawals, currentBalance } = normalizeDonations(loaded.rawData);
    if (donations.length === 0) return null;
    const aggregates = aggregateDonations(donations, withdrawals, currentBalance);
    const days = Math.max(1, aggregates.byDay.size && Math.round((aggregates.lastDate.getTime() - aggregates.firstDate.getTime()) / 864e5) + 1);
    return { donations, aggregates, days, bestDay: Math.max(0, ...aggregates.byDay.values()) };
  }, [loaded]);

  const back = () => dispatch({ type: 'ARCHIVE_VIEW', payload: null });

  if (loaded === null) return null;
  if (loaded === 'error' || !numbers) {
    return (
      <div className="max-w-xl mx-auto py-10 text-center">
        <p className="text-sm text-gray-600">{t('page.loadError')}</p>
        <button onClick={back} className="btn-secondary mt-4">{t('list.title')}</button>
      </div>
    );
  }

  const { meta, rawData, friends, raffles } = loaded;
  const { aggregates, days, bestDay, donations } = numbers;
  const total = aggregates.totalAmount;
  const pct = meta.goal ? Math.round((total / meta.goal) * 100) : null;
  const ranked = [...friends].sort((a, b) => b.raised - a.raised);
  const friendStats = computeFriendStats(friends, total);
  const topRaised = Math.max(1, ...ranked.map((f) => f.raised));
  const stem = fileStem(meta.name);

  const stats = [
    { label: t('page.donations'), value: fmtUah(aggregates.donationCount) },
    { label: t('page.donors'), value: fmtUah(aggregates.uniqueDonors) },
    { label: t('page.median'), value: `${fmtUah(aggregates.medianDonation)} ₴` },
    { label: t('page.max'), value: `${fmtUah(aggregates.maxDonation)} ₴` },
    { label: t('page.bestDay'), value: `${fmtUah(bestDay)} ₴` },
    { label: t('page.perDay'), value: `${fmtUah(Math.round(total / days))} ₴` },
  ];

  const downloads = [
    {
      title: t('page.statement'),
      note: t('page.statementNote', { count: aggregates.donationCount }),
      run: () => downloadCSV(manualRowsToCSVString(rawDonationsToManualRows(rawData)), `${stem}.csv`),
    },
    ...(friends.length > 0
      ? [{ title: t('page.friendsCsv'), note: t('page.friendsCsvNote', { count: friends.length }), run: () => downloadCSV(friendsToCSV(friends), `${stem} — друзі.csv`) }]
      : []),
    {
      title: t('page.backup'),
      note: t('page.backupNote'),
      run: async () => {
        const backup = await buildProjectBackup(id);
        if (backup) await saveBlob(new Blob([JSON.stringify(backup)], { type: 'application/json' }), `${stem}.json`);
      },
    },
  ];

  const makeCards = async () => {
    if (await handleLoadCampaign(id, { proceed: true })) dispatch({ type: 'ARCHIVED_CARDS_OPENED', payload: id });
  };

  const unarchive = async () => {
    if (!window.confirm(t('page.unarchiveConfirm', { name: meta.name }))) return;
    if (await unarchiveCampaign(id)) dispatch({ type: 'SECTION_CHANGED', payload: 'active' });
  };

  const card = 'rounded-2xl border border-gray-200 bg-white shadow-sm';
  const shownFriends = allFriends ? ranked : ranked.slice(0, FRIENDS_SHOWN);

  return (
    <div className="max-w-2xl mx-auto py-4 sm:py-8 space-y-4 animate-fade-in">
      <button onClick={back} className="flex items-center gap-1.5 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">
        <ArrowLeftIcon className="h-4 w-4" />
        {t('page.back', { year: archiveYear(meta) })}
      </button>

      <div className="space-y-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
          <LockIcon className="h-3.5 w-3.5" />
          {t('page.readOnly', { date: longDate(meta.archivedAt!) })}
        </span>
        <h2 className="text-2xl sm:text-3xl font-bold leading-tight text-gray-900 [overflow-wrap:anywhere]">{meta.name}</h2>
      </div>

      <section className={`${card} p-5 space-y-2.5`}>
        <p className="text-sm text-gray-600">{t('page.raisedAll')}</p>
        <p className="text-4xl font-extrabold tracking-tight text-gray-900">{fmtUah(total)} ₴</p>
        {pct !== null && (
          <>
            <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
              <div className={`h-full rounded-full ${pct >= 100 ? 'bg-green-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t('page.goal', { goal: fmtUah(meta.goal!) })}</span>
              <span className={`font-bold ${pct >= 100 ? 'text-green-700' : 'text-indigo-700'}`}>{pct}%</span>
            </div>
          </>
        )}
        <p className="flex items-center gap-1.5 border-t border-gray-100 pt-2.5 text-sm text-gray-600">
          <CalendarIcon className="h-4 w-4 shrink-0" />
          {formatDateRange(meta.summary.firstDate, meta.summary.lastDate)} · {t('list.days', { count: days })}
        </p>
      </section>

      <section className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className={`${card} px-3 py-2.5`}>
            <p className="text-xs text-gray-600">{s.label}</p>
            <p className="mt-0.5 text-lg font-bold text-gray-900">{s.value}</p>
          </div>
        ))}
      </section>

      <GrowthSection aggregates={aggregates} donations={donations} goal={meta.goal} />
      <SupportersSection donations={donations} />

      {ranked.length > 0 && (
        <section className={`${card} overflow-hidden`}>
          <div className="flex items-baseline justify-between gap-3 px-4 pt-4 pb-2">
            <h3 className="text-sm font-semibold text-gray-900">{t('page.friendsTitle', { count: ranked.length })}</h3>
            <span className="text-xs text-gray-600">{t('page.friendsShare', { pct: Math.round(friendStats.share * 100) })}</span>
          </div>
          <ul>
            {shownFriends.map((f) => {
              const reached = !!f.target && f.raised >= f.target;
              const fill = f.target ? Math.min(1, f.raised / f.target) : f.raised / topRaised;
              return (
                <li key={f.id} className="border-t border-gray-100 px-4 py-2.5 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-medium text-gray-900">{f.name || '—'}</span>
                    <span className="shrink-0 font-bold text-gray-900">{fmtUah(f.raised)} ₴</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div className={`h-full rounded-full ${reached ? 'bg-green-500' : 'bg-indigo-400'}`} style={{ width: `${fill * 100}%` }} />
                  </div>
                  {allFriends && f.shortId && <CopyJarLink shortId={f.shortId} className="-ml-2" />}
                </li>
              );
            })}
          </ul>
          {ranked.length > FRIENDS_SHOWN || ranked.some((f) => f.shortId) ? (
            <button onClick={() => setAllFriends((v) => !v)} className="block w-full border-t border-gray-100 px-4 py-3 text-left text-sm font-medium text-indigo-600 hover:bg-indigo-50">
              {allFriends ? t('page.fewerFriends') : t('page.allFriends', { count: ranked.length })}
            </button>
          ) : null}
        </section>
      )}

      <MoneySection aggregates={aggregates} />
      <CompareSection meta={meta} archived={archived} />

      {raffles.length > 0 && (
        <section className={`${card} p-4 space-y-2`}>
          <h3 className="text-sm font-semibold text-gray-900">{t('page.raffles')}</h3>
          {raffles.map((r) => {
            const biggest = r.kind === 'biggest' ? biggestDonation(donations, r) : null;
            const result =
              r.kind === 'biggest'
                ? biggest
                  ? `${fmtUah(biggest.amount)} ₴`
                  : '—'
                : t('page.participants', { count: r.kind === 'jars' ? eligibleJars(friends, r).length : raffleParticipants(donations, r) });
            return (
              <div key={r.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 text-gray-900">
                  {r.prize} <span className="text-gray-500">· {tInsights(`raffles.kind.${r.kind}`)}</span>
                </span>
                <span className="shrink-0 text-gray-700">{result}</span>
              </div>
            );
          })}
        </section>
      )}

      <section className={`${card} overflow-hidden`}>
        <h3 className="px-4 pt-4 pb-2 text-sm font-semibold text-gray-900">{t('page.downloads')}</h3>
        {downloads.map((d) => (
          <button key={d.title} onClick={() => void d.run()} className="flex w-full items-center gap-3 border-t border-gray-100 px-4 py-3 text-left hover:bg-gray-50 transition-colors">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <DownloadIcon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-gray-900">{d.title}</span>
              <span className="block text-xs text-gray-600">{d.note}</span>
            </span>
          </button>
        ))}
      </section>

      <button onClick={() => void makeCards()} className="btn-primary flex w-full items-center justify-center gap-2">
        <ImageIcon className="h-4 w-4" />
        {t('page.cards')}
      </button>

      <div className="flex flex-col items-center gap-1 pt-1">
        {meta.monobankJar?.shortId && <CopyJarLink shortId={meta.monobankJar.shortId} />}
        <button onClick={() => void unarchive()} className="px-2 py-2 text-sm font-medium text-gray-600 underline hover:text-gray-900">
          {t('page.unarchive')}
        </button>
      </div>
    </div>
  );
}
