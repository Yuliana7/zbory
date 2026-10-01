import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FriendJar } from '../../types';
import { computeFriendStats, formatSharePct } from '../../utils/friendJars';
import { FriendsEditor } from '../FriendsEditor';

interface FriendsChartProps {
  friends: FriendJar[];
  /** the main jar's total — helpers are a share OF it, never added to it */
  totalAmount: number;
}

const MAX_ROWS = 10;
const fmt = (n: number) => new Intl.NumberFormat('uk-UA').format(Math.round(n));

/** How much each helper jar brought in. Per-helper bars are scaled to the best
 * helper (comparison), the top bar shows helpers' share of the whole jar. */
export function FriendsChart({ friends, totalAmount }: FriendsChartProps) {
  const { t } = useTranslation('insights');
  const [editing, setEditing] = useState(false);
  const { ranked, total, share, exceedsTotal } = computeFriendStats(friends, totalAmount);

  if (ranked.length === 0 && !editing) return null;

  const rows = ranked.slice(0, MAX_ROWS);
  const top = rows[0]?.raised ?? 1;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('friends.title')}</p>
          <p className="text-sm text-gray-600 mt-1">
            {t('friends.summary', { amount: fmt(total), pct: formatSharePct(share), n: ranked.length })}
          </p>
        </div>
        <button
          onClick={() => setEditing((e) => !e)}
          className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          {editing ? t('friends.done') : t('friends.edit')}
        </button>
      </div>

      {ranked.length > 0 && (
        <>
          {/* Helpers' share of the whole jar */}
          <div className="h-3 rounded-full bg-gray-100 overflow-hidden mb-5" title={t('friends.shareBar')}>
            <div className="h-full rounded-full bg-indigo-400" style={{ width: `${share * 100}%` }} />
          </div>

          <div className="space-y-3">
            {rows.map((f, i) => (
              <div key={f.id}>
                <div className="flex items-baseline justify-between gap-3 text-sm mb-1">
                  <span className="min-w-0 truncate font-medium text-gray-800">
                    <span className="text-gray-400 mr-2">{i + 1}</span>
                    {f.name || '—'}
                  </span>
                  <span className="shrink-0 whitespace-nowrap">
                    <span className="font-semibold text-gray-900">{fmt(f.raised)} ₴</span>
                    <span className="text-xs text-gray-400 ml-2">{formatSharePct(f.raised / totalAmount)}%</span>
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-indigo-400" style={{ width: `${(f.raised / top) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          {ranked.length > MAX_ROWS && (
            <p className="mt-3 text-xs text-gray-400">{t('friends.more', { n: ranked.length - MAX_ROWS })}</p>
          )}
        </>
      )}

      {exceedsTotal && <p className="mt-3 text-xs text-red-500">{t('friends.exceeds')}</p>}
      {editing && (
        <div className="mt-5 pt-4 border-t border-gray-100">
          <FriendsEditor />
        </div>
      )}
    </div>
  );
}
