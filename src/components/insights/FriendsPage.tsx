import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../context/AppContext';
import type { FriendJar } from '../../types';
import { useFriendsRefresh } from '../../hooks/useFriendsRefresh';
import { downloadCSV } from '../../utils/csvExporter';
import { computeFriendStats, fmtUah, formatSharePct, friendBar, friendsToCSV, pageOf, sortFriends, FRIENDS_PAGE_SIZE, type FriendSortKey } from '../../utils/friendJars';
import { FRIEND_FILTERS, FRIEND_SORT_KEYS, forecast, growth, leftToTarget, matchesFilter, matchesSearch, stalledDays, type FriendFilter } from '../../utils/friendInsights';
import { formatWhen, linkedOpen } from '../../utils/friendsRefresh';
import { FriendsFreshness, RefreshButton, TargetsBar } from './friendsShared';
import { ReminderCard } from './ReminderCard';
import { StatTile, SubPage } from './SubPage';

const GROWTH_DAYS = 7;

/** A helper's amount over time as one small line. Needs two points; the scale is its own, so it shows the shape, not the size. */
function Trend({ friend }: { friend: FriendJar }) {
  const points = friend.history ?? [];
  if (points.length < 2) return null;
  const W = 72;
  const H = 24;
  const first = points[0].at;
  const span = Math.max(1, points[points.length - 1].at - first);
  const min = Math.min(...points.map((p) => p.raised));
  const range = Math.max(1, Math.max(...points.map((p) => p.raised)) - min);
  const line = points.map((p) => `${((p.at - first) / span) * W},${H - 2 - ((p.raised - min) / range) * (H - 4)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="shrink-0 overflow-visible" aria-hidden="true">
      <polyline points={line} fill="none" stroke="#818cf8" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function JarRow({ friend: f, listed, totalAmount, now }: { friend: FriendJar; listed: FriendJar[]; totalAmount: number; now: number }) {
  const { t } = useTranslation('insights');
  const bar = friendBar(f, listed);
  const g = growth(f, GROWTH_DAYS, now);
  const stalled = stalledDays(f, now);
  const left = f.closed ? 0 : leftToTarget(f);
  const eta = forecast(f, now);
  return (
    <li className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-medium text-gray-800">
          {f.name || '—'}
          {bar.reached && <span className="ml-2 text-green-600" title={t('friends.reachedBadge')}>✓</span>}
          {f.closed && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">{t('friends.closed')}</span>}
          {stalled !== null && (
            <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">{t('friendsPage.stalled', { count: stalled })}</span>
          )}
        </span>
        <span className="shrink-0 whitespace-nowrap">
          <span className="font-semibold text-gray-900">{fmtUah(f.raised)} ₴</span>
          <span className="text-xs text-gray-400 ml-2">{formatSharePct(f.raised / totalAmount)}%</span>
        </span>
      </div>
      {bar.mode !== 'none' && (
        <div className="mt-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
          <div className={`h-full rounded-full ${bar.reached ? 'bg-green-500' : 'bg-indigo-400'}`} style={{ width: `${bar.fill * 100}%` }} />
        </div>
      )}
      <div className="mt-1.5 flex items-center justify-between gap-3">
        <div className="min-w-0 text-xs text-gray-500 space-y-0.5">
          {bar.pct !== null && f.target && (
            <p>
              {t('friends.ofTarget', { pct: Math.round(bar.pct), target: fmtUah(f.target) })}
              {left > 0 && ` · ${t('friendsPage.left', { amount: fmtUah(left) })}`}
              {eta && ` · ${t('friendsPage.eta', { date: new Date(eta).toLocaleDateString('uk-UA') })}`}
            </p>
          )}
          <p>
            {g && g.delta > 0 && <span className="font-medium text-gray-700">{t('friendsPage.growth', { amount: fmtUah(g.delta), when: new Date(g.since).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' }) })} · </span>}
            {f.updatedAt ? t('friendsPage.changed', { when: formatWhen(f.updatedAt, now) }) : t('friendsPage.neverChanged')}
            {!f.jarId && ` · ${t('friendsPage.manual')}`}
          </p>
        </div>
        <Trend friend={f} />
      </div>
    </li>
  );
}

/** Every helper jar: what the owner of the main jar needs to see who is moving, who stalled and who is done.
 * Read-only, like the analytics; «Редагувати» opens the friends screen. */
export function FriendsPage({ friends, totalAmount }: { friends: FriendJar[]; totalAmount: number }) {
  const { t } = useTranslation('insights');
  const { dispatch } = useAppContext();
  const refresh = useFriendsRefresh(friends);
  const [now] = useState(() => Date.now());
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FriendFilter>('all');
  const [sort, setSort] = useState<{ key: FriendSortKey; desc: boolean }>({ key: 'modified', desc: false });
  const [page, setPage] = useState(0);

  const stats = computeFriendStats(friends, totalAmount);
  const { ranked, total, share, exceedsTotal } = stats;
  const closedCount = ranked.filter((f) => f.closed).length;
  const list = useMemo(
    () => sortFriends(ranked.filter((f) => matchesFilter(f, filter, now) && matchesSearch(f, query)), sort.key, sort.desc),
    [ranked, filter, now, query, sort],
  );
  const shown = pageOf(list, page, FRIENDS_PAGE_SIZE);
  const from = shown.page * FRIENDS_PAGE_SIZE + 1;
  const linked = linkedOpen(friends).length;

  const pickSort = (key: FriendSortKey) => {
    setSort((cur) => ({ key, desc: cur.key === key ? !cur.desc : false }));
    setPage(0);
  };
  const stamp = () => new Date().toLocaleDateString('sv-SE');
  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${active ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`;

  return (
    <SubPage
      title={t('friends.title')}
      actions={
        <div className="flex items-center gap-4">
          {linked > 0 && <RefreshButton refresh={refresh} />}
          <button onClick={() => dispatch({ type: 'FRIENDS_EDIT_OPENED' })} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
            {t('friends.edit')}
          </button>
        </div>
      }
    >
      <FriendsFreshness friends={friends} refresh={refresh} />

      <div className="mb-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label={t('friendsPage.jars')} value={fmtUah(ranked.length)} note={t('friendsPage.jarsNote', { open: ranked.length - closedCount, closed: closedCount })} />
        <StatTile label={t('friendsPage.raised')} value={`${fmtUah(total)} ₴`} note={t('friendsPage.shareNote', { pct: formatSharePct(share) })} />
        <StatTile label={t('friendsPage.direct')} value={`${fmtUah(Math.max(0, totalAmount - total))} ₴`} note={t('friendsPage.directNote')} />
        <StatTile label={t('friendsPage.reached')} value={stats.withTarget > 0 ? `${stats.reached} / ${stats.withTarget}` : '—'} note={t('friendsPage.reachedNote')} />
      </div>

      {stats.targetsProgress !== null && (
        <div className="mb-4 bg-white rounded-xl border border-gray-100 shadow-sm p-4"><TargetsBar stats={stats} /></div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 space-y-3 border-b border-gray-100">
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder={t('friendsPage.search')}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent placeholder:text-gray-400"
          />
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('friendsPage.filterLabel')}>
            {FRIEND_FILTERS.map((key) => (
              <button
                key={key}
                onClick={() => {
                  setFilter(key);
                  setPage(0);
                }}
                aria-pressed={filter === key}
                className={chip(filter === key)}
              >
                {t(`friendsPage.filter.${key}`)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('friends.sort.label')}>
            <span className="text-xs text-gray-500">{t('friends.sort.label')}:</span>
            {FRIEND_SORT_KEYS.map((key) => (
              <button key={key} onClick={() => pickSort(key)} aria-pressed={sort.key === key} className={chip(sort.key === key)}>
                {t(`friends.sort.${key}`)}
                {sort.key === key && <span aria-hidden="true"> {sort.desc ? '↓' : '↑'}</span>}
              </button>
            ))}
          </div>
        </div>

        {shown.items.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500">{t('friendsPage.nothing')}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {shown.items.map((f) => (
              <JarRow key={f.id} friend={f} listed={ranked} totalAmount={totalAmount} now={now} />
            ))}
          </ul>
        )}

        {shown.pages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-3 text-xs text-gray-500">
            <button
              onClick={() => setPage(shown.page - 1)}
              disabled={shown.page === 0}
              className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:hover:bg-gray-100 font-medium text-gray-700 transition-colors"
            >
              ‹ {t('friends.prev')}
            </button>
            <span>{t('friends.pageRange', { from, to: from + shown.items.length - 1, total: list.length })}</span>
            <button
              onClick={() => setPage(shown.page + 1)}
              disabled={shown.page >= shown.pages - 1}
              className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:hover:bg-gray-100 font-medium text-gray-700 transition-colors"
            >
              {t('friends.next')} ›
            </button>
          </div>
        )}
      </div>

      {exceedsTotal && <p className="mt-3 text-xs text-red-500">{t('friends.exceeds')}</p>}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-gray-500">
        {linked > 0 ? (
          <button
            onClick={() => refresh.setAuto(!refresh.auto)}
            aria-pressed={refresh.auto}
            title={t('friends.autoHint')}
            className="flex items-center gap-1.5 hover:text-gray-800 transition-colors"
          >
            <span className={`inline-block w-7 h-4 rounded-full relative transition-colors ${refresh.auto ? 'bg-indigo-500' : 'bg-gray-300'}`}>
              <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${refresh.auto ? 'left-3.5' : 'left-0.5'}`} />
            </span>
            {t('friends.auto')}
          </button>
        ) : (
          <span />
        )}
        <button onClick={() => downloadCSV(friendsToCSV(friends), `druzi_zboru_${stamp()}.csv`)} className="font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
          {t('friends.csv')}
        </button>
      </div>

      {linked > 0 && <ReminderCard />}
    </SubPage>
  );
}
