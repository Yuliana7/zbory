import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Aggregates } from '../../types';
import { formatUkrainianDate } from '../../utils/dataAggregator';

interface CampaignChartsProps {
  aggregates: Aggregates;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtFull(n: number) {
  return new Intl.NumberFormat('uk-UA').format(Math.round(n));
}

function shortDate(s: string) {
  const d = new Date(s);
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function dateKeyFromDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CampaignCharts({ aggregates }: CampaignChartsProps) {
  const { t } = useTranslation(['insights', 'export']);

  const {
    totalRaised,
    totalWithdrawn,
    currentBalance,
    impliedRefunds,
    withdrawals,
    byDate,
  } = aggregates;

  const hasWithdrawals = totalWithdrawn > 0;
  const hasRefunds = impliedRefunds > 500;

  // ── Day columns: donations up + withdrawals down ──────────────────────────

  const dayColumns = useMemo(() => {
    const all = Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b));

    // Aggregate withdrawals by date key
    const wByDay = new Map<string, number>();
    for (const w of withdrawals) {
      const key = dateKeyFromDate(w.timestamp);
      wByDay.set(key, (wByDay.get(key) || 0) + w.amount);
    }

    if (all.length <= 60) {
      return all.map(([d, v]) => ({
        dateKey: d,
        label: shortDate(d),
        donations: v.amount,
        withdrawn: wByDay.get(d) || 0,
      }));
    }

    // Group into buckets for long campaigns
    const bucketSize = Math.ceil(all.length / 60);
    const buckets = [];
    for (let i = 0; i < all.length; i += bucketSize) {
      const slice = all.slice(i, i + bucketSize);
      buckets.push({
        dateKey: slice[0][0],
        label: shortDate(slice[0][0]),
        donations: slice.reduce((s, [, v]) => s + v.amount, 0),
        withdrawn: slice.reduce((s, [d]) => s + (wByDay.get(d) || 0), 0),
      });
    }
    return buckets;
  }, [byDate, withdrawals]);

  // ── Withdrawal events (sorted oldest → newest) ────────────────────────────

  const withdrawalEvents = useMemo(
    () => [...withdrawals].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
    [withdrawals],
  );

  return (
    <div className="space-y-4 mb-2">

      {/* ── Summary stat row ─────────────────────────────────────────── */}
      <div className={`grid gap-3 ${hasWithdrawals ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`}>
        {hasRefunds && <StatCard label={t('charts.raised')}    value={fmtFull(totalRaised) + ' ₴'}    color="indigo" />}
        {hasWithdrawals && (
          <StatCard label={t('charts.withdrawn')} value={fmtFull(totalWithdrawn) + ' ₴'} color="amber" />
        )}
        <StatCard label={t('charts.balance')}   value={fmtFull(currentBalance) + ' ₴'} color="green" />
        {hasRefunds && (
          <StatCard label={t('charts.refunds')}  value={fmtFull(impliedRefunds) + ' ₴'} color="purple" />
        )}
      </div>

      {/* ── Refunds disclaimer ───────────────────────────────────────── */}
      {hasRefunds && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-1.5">
          <div className="flex items-start gap-2">
            <span className="text-base leading-none mt-0.5">↩️</span>
            <p className="text-sm font-semibold text-purple-900">{t('export:refundsPanel.title')}</p>
          </div>
          <p className="text-xs text-purple-700 leading-relaxed pl-6">
            {t('export:refundsPanel.description', { amount: fmtFull(impliedRefunds) })}
          </p>
          <p className="text-xs text-purple-500 italic pl-6">{t('export:refundsPanel.note')}</p>
        </div>
      )}

      {/* ── Diverging bar chart: donations up / withdrawals down ──────── */}
      {(() => {
        const maxDonation = Math.max(...dayColumns.map((c) => c.donations), 1);
        const maxWithdrawn = Math.max(...dayColumns.map((c) => c.withdrawn), 1);
        const anyWithdrawal = dayColumns.some((c) => c.withdrawn > 0);

        return (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
              {t('charts.dailyLabel')}
            </p>

            {/* Donation bars — grow upward */}
            <div className="flex items-end gap-px h-32">
              {dayColumns.map((col) => {
                const h = Math.max(2, (col.donations / maxDonation) * 100);
                const isBest = col.donations === maxDonation;
                return (
                  <div
                    key={col.dateKey}
                    className={`flex-1 min-w-0 rounded-t transition-colors ${isBest ? 'bg-green-400' : 'bg-indigo-400 hover:bg-indigo-500'}`}
                    style={{ height: `${h}%` }}
                    title={`${col.label}: ${fmtFull(col.donations)} ₴`}
                  />
                );
              })}
            </div>

            {/* Baseline */}
            <div className="h-px bg-gray-300" />

            {/* Withdrawal bars — grow downward (only rendered when there are withdrawals) */}
            {anyWithdrawal && (
              <div className="flex items-start gap-px h-14">
                {dayColumns.map((col) => {
                  const h = col.withdrawn > 0
                    ? Math.max(10, (col.withdrawn / maxWithdrawn) * 100)
                    : 0;
                  return h > 0 ? (
                    <div
                      key={col.dateKey}
                      className="flex-1 min-w-0 rounded-b bg-amber-400 hover:bg-amber-500 transition-colors"
                      style={{ height: `${h}%` }}
                      title={`${col.label}: −${fmtFull(col.withdrawn)} ₴`}
                    />
                  ) : (
                    <div key={col.dateKey} className="flex-1 min-w-0" />
                  );
                })}
              </div>
            )}

            {/* Date labels */}
            {dayColumns.length > 1 && (
              <div className="flex justify-between mt-1.5 text-xs text-gray-400">
                <span>{dayColumns[0].label}</span>
                <span>{dayColumns[dayColumns.length - 1].label}</span>
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              <Legend color="bg-indigo-400" label={t('charts.donationsBar')} />
              <Legend color="bg-green-400" label={t('charts.bestDay')} />
              {anyWithdrawal && <Legend color="bg-amber-400" label={t('charts.withdrawalDay')} />}
            </div>
          </div>
        );
      })()}

      {/* ── Withdrawal events list ────────────────────────────────────── */}
      {hasWithdrawals && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
            {t('charts.withdrawalsLabel')}
          </p>
          <div className="space-y-3">
            {withdrawalEvents.map((w, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {formatUkrainianDate(w.timestamp)}
                    </p>
                    {w.destination && (
                      <p className="text-xs text-gray-400 truncate">{w.destination}</p>
                    )}
                  </div>
                </div>
                <span className="flex-shrink-0 text-sm font-semibold text-amber-700">
                  −{fmtFull(w.amount)} ₴
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between text-sm">
            <span className="text-gray-500">{t('charts.totalWithdrawn')}</span>
            <span className="font-semibold text-amber-700">{fmtFull(totalWithdrawn)} ₴</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

const COLOR_MAP = {
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', label: 'text-indigo-500' },
  amber:  { bg: 'bg-amber-50',  text: 'text-amber-700',  label: 'text-amber-500'  },
  green:  { bg: 'bg-green-50',  text: 'text-green-700',  label: 'text-green-500'  },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'text-purple-500' },
} as const;

function StatCard({ label, value, color }: { label: string; value: string; color: keyof typeof COLOR_MAP }) {
  const c = COLOR_MAP[color];
  return (
    <div className={`${c.bg} rounded-xl p-4`}>
      <p className={`text-xs font-medium ${c.label} mb-1`}>{label}</p>
      <p className={`text-lg font-bold ${c.text} leading-tight`}>{value}</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-400">
      <span className={`inline-block w-3 h-3 rounded-sm ${color}`} />
      {label}
    </div>
  );
}
