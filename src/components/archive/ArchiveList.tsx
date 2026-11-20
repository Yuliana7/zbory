import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../context/AppContext';
import type { OwnJar } from '../../types';
import { listCampaigns, type CampaignMeta } from '../../utils/campaignStore';
import { listOwnJars, goalPct } from '../../utils/ownJars';
import { ARCHIVE_PAGE_SIZE, archiveYears, inYear, isArchived, matchesName, yearSummary } from '../../utils/archive';
import { fmtUah, pageOf } from '../../utils/friendJars';
import { ArchiveIcon, LockIcon } from '../../icons';
import { Pager, SearchBox } from '../ListControls';

const shortDate = (ms: number) => new Date(ms).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
const daysBetween = (first: string, last: string) =>
  first && last ? Math.round((new Date(`${last}T12:00:00`).getTime() - new Date(`${first}T12:00:00`).getTime()) / 864e5) + 1 : 0;
const MONTHS = ['січ', 'квіт', 'лип', 'жовт', 'груд'];

/** The archive's list: a year at a time (or all of them), a card with what that year's closed projects
 * raised, then the projects and the user's own jars, each searchable and in pages. */
export function ArchiveList() {
  const { t } = useTranslation('archive');
  const { t: tCommon } = useTranslation();
  const { dispatch } = useAppContext();
  const [campaigns, setCampaigns] = useState<CampaignMeta[] | null>(null);
  const [jars, setJars] = useState<OwnJar[] | null>(null);
  const [year, setYear] = useState<number | null | undefined>(undefined); // undefined = the newest year, once loaded
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [jarPage, setJarPage] = useState(0);

  useEffect(() => {
    listCampaigns().then((all) => setCampaigns(all.filter(isArchived))).catch(() => setCampaigns([]));
    listOwnJars().then((all) => setJars(all.filter(isArchived))).catch(() => setJars([]));
  }, []);

  const years = useMemo(() => archiveYears([...(campaigns ?? []), ...(jars ?? [])]), [campaigns, jars]);
  const shownYear = year === undefined ? (years[0] ?? null) : year;

  if (!campaigns || !jars) return null;

  if (years.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center animate-fade-in">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <ArchiveIcon className="h-7 w-7" />
        </span>
        <h2 className="text-xl font-bold text-gray-900">{t('list.empty')}</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">{t('list.emptyText')}</p>
        <button onClick={() => dispatch({ type: 'SECTION_CHANGED', payload: 'active' })} className="btn-primary mt-6">
          {t('list.toActive')}
        </button>
      </div>
    );
  }

  const yearCampaigns = inYear(campaigns, shownYear);
  const yearJars = inYear(jars, shownYear);
  const summary = yearSummary(yearCampaigns);
  const foundCampaigns = yearCampaigns.filter((c) => matchesName(c.name, query));
  const foundJars = yearJars.filter((j) => matchesName(j.name, query));
  const shownCampaigns = pageOf(foundCampaigns, page, ARCHIVE_PAGE_SIZE);
  const shownJars = pageOf(foundJars, jarPage, ARCHIVE_PAGE_SIZE);
  const maxMonth = Math.max(...summary.byMonth, 1);

  const pickYear = (y: number | null) => {
    setYear(y);
    setPage(0);
    setJarPage(0);
  };
  const chip = (on: boolean) =>
    `px-4 py-2 rounded-full text-sm transition-colors ${on ? 'bg-indigo-600 text-white font-semibold' : 'bg-white border border-gray-200 text-gray-700 font-medium hover:border-indigo-300'}`;
  const open = (kind: 'project' | 'ownJar', id: string) => dispatch({ type: 'ARCHIVE_VIEW', payload: { kind, id } });

  return (
    <div className="max-w-3xl mx-auto py-6 sm:py-8 space-y-5 animate-fade-in">
      <h2 className="text-2xl font-bold text-gray-900">{t('list.title')}</h2>

      <div role="tablist" aria-label={t('list.yearLabel')} className="flex flex-wrap gap-2">
        {years.map((y) => (
          <button key={y} role="tab" aria-selected={shownYear === y} onClick={() => pickYear(y)} className={chip(shownYear === y)}>
            {y}
          </button>
        ))}
        {years.length > 1 && (
          <button role="tab" aria-selected={shownYear === null} onClick={() => pickYear(null)} className={chip(shownYear === null)}>
            {t('list.allYears')}
          </button>
        )}
      </div>

      {yearCampaigns.length > 0 && (
        <section className="rounded-2xl bg-gradient-to-br from-indigo-900 to-indigo-600 p-5 text-white space-y-4">
          <p className="text-sm text-indigo-200">{shownYear === null ? t('list.allCard') : t('list.yearCard', { year: shownYear })}</p>
          <p className="text-4xl font-extrabold tracking-tight">{fmtUah(summary.total)} ₴</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { n: summary.count, label: t('list.projects', { count: summary.count }) },
              { n: summary.donations, label: t('list.donations', { count: summary.donations }) },
              { n: summary.friends, label: t('list.friendJars', { count: summary.friends }) },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-xl font-bold">{fmtUah(s.n)}</p>
                <p className="text-xs text-indigo-200">{s.label}</p>
              </div>
            ))}
          </div>
          {shownYear !== null && (
            <div>
              <div role="img" aria-label={t('list.byMonth')} className="flex h-14 items-end gap-1.5">
                {summary.byMonth.map((v, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded ${v ? 'bg-indigo-300' : 'bg-indigo-300/30'}`}
                    style={{ height: v ? `${Math.max(6, Math.round((v / maxMonth) * 56))}px` : '3px' }}
                  />
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-indigo-200" aria-hidden="true">
                {MONTHS.map((m) => (
                  <span key={m}>{m}</span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {yearCampaigns.length + yearJars.length > ARCHIVE_PAGE_SIZE / 2 && (
        <SearchBox
          value={query}
          onChange={(q) => {
            setQuery(q);
            setPage(0);
            setJarPage(0);
          }}
        />
      )}

      {query.trim() && foundCampaigns.length + foundJars.length === 0 && (
        <p className="py-4 text-center text-sm text-gray-500">{tCommon('list.nothingFound', { query: query.trim() })}</p>
      )}

      {foundCampaigns.length > 0 && (
        <section className="space-y-3">
          <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('list.main')}</h3>
          <ul className="space-y-3">
            {shownCampaigns.items.map((c) => {
              const pct = c.goal ? Math.round((c.summary.totalAmount / c.goal) * 100) : null;
              const days = daysBetween(c.summary.firstDate, c.summary.lastDate);
              const friends = c.archive?.friendsCount ?? 0;
              const meta = [
                t('list.closedOn', { date: shortDate(c.archivedAt!) }),
                pct !== null ? t('list.ofGoal', { pct }) : null,
                days > 0 ? t('list.days', { count: days }) : null,
                friends > 0 ? t('list.friends', { count: friends }) : null,
              ].filter(Boolean);
              return (
                <li key={c.id}>
                  <button
                    onClick={() => open('project', c.id)}
                    className="block w-full text-left rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:border-indigo-300 transition-colors"
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 font-semibold text-gray-900">{c.name}</span>
                      <span className="shrink-0 whitespace-nowrap font-bold text-gray-900">{fmtUah(c.summary.totalAmount)} ₴</span>
                    </span>
                    {pct !== null && (
                      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-gray-100">
                        <span className={`block h-full rounded-full ${pct >= 100 ? 'bg-green-500' : 'bg-gray-400'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                      </span>
                    )}
                    <span className="mt-2 flex items-center gap-1.5 text-xs text-gray-600">
                      <LockIcon className="h-3.5 w-3.5 shrink-0" />
                      {meta.join(' · ')}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <Pager page={shownCampaigns.page} pages={shownCampaigns.pages} size={ARCHIVE_PAGE_SIZE} shown={shownCampaigns.items.length} total={foundCampaigns.length} onPage={setPage} />
        </section>
      )}

      {foundJars.length > 0 && (
        <section className="space-y-3">
          <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('list.own')}</h3>
          <ul className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm divide-y divide-gray-100">
            {shownJars.items.map((j) => {
              const pct = goalPct(j.raised, j.target);
              return (
                <li key={j.id}>
                  <button onClick={() => open('ownJar', j.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-gray-900">{j.name || '—'}</span>
                      <span className="block text-xs text-gray-600">
                        {t('list.closedOn', { date: shortDate(j.archivedAt!) })}
                        {pct !== null && ` · ${t('list.ofOwnGoal', { pct })}`}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-bold text-gray-900">{fmtUah(j.raised)} ₴</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <Pager page={shownJars.page} pages={shownJars.pages} size={ARCHIVE_PAGE_SIZE} shown={shownJars.items.length} total={foundJars.length} onPage={setJarPage} />
        </section>
      )}

      {yearCampaigns.length + yearJars.length === 0 && <p className="py-6 text-center text-sm text-gray-500">{t('list.nothingThisYear')}</p>}
    </div>
  );
}
