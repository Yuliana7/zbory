import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Aggregates, CampaignDataset } from '../../types';
import { analyzeCampaigns, datasetsToItems } from '../../utils/campaignAnalytics';
import { formatCurrency } from '../../utils/dataAggregator';
import { CAMPAIGN_COLORS } from '../../utils/campaignColors';

const W = 640;
const H = 220;
const P = 8;

interface CumulativeChartProps {
  aggregates: Aggregates; // single-jar fallback: one line from aggregates.cumulative
  datasets: CampaignDataset[] | null; // 2+ = multi-line, aligned by campaign day
}

/**
 * Always-visible cumulative chart at the top of the insights page: one line
 * for a single jar, one line per jar (aligned by campaign day, filterable)
 * once 2+ statements are loaded together.
 */
export function CumulativeChart({ aggregates, datasets }: CumulativeChartProps) {
  const { t } = useTranslation('campaigns');
  const isMulti = (datasets?.length ?? 0) >= 2;
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const visibleDatasets = useMemo(
    () => (isMulti ? datasets!.filter((d) => !hidden.has(d.id)) : []),
    [isMulti, datasets, hidden],
  );
  const stats = useMemo(
    () => (visibleDatasets.length > 0 ? analyzeCampaigns(datasetsToItems(visibleDatasets)) : null),
    [visibleDatasets],
  );
  const colorOf = (id: string) => CAMPAIGN_COLORS[(datasets ?? []).findIndex((d) => d.id === id) % CAMPAIGN_COLORS.length];

  const toggle = (id: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Single-jar line: aggregates.cumulative is already chronological
  const singleLine = aggregates.cumulative;
  const maxTotal = isMulti
    ? Math.max(...(stats?.campaigns.map((c) => c.totalAmount) ?? [1]), 1)
    : Math.max(...singleLine.map((p) => p.total), 1);
  const maxDays = isMulti ? Math.max(...(stats?.campaigns.map((c) => c.days) ?? [1]), 1) : Math.max(singleLine.length, 1);

  const px = (i: number) => P + (i / Math.max(maxDays - 1, 1)) * (W - 2 * P);
  const py = (v: number) => H - P - (v / maxTotal) * (H - 2 * P);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
        {t('compare.chartTitle')}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={P} x2={W - P} y1={py(maxTotal * f)} y2={py(maxTotal * f)} stroke="#f3f4f6" strokeWidth={1} />
        ))}
        {isMulti
          ? stats?.campaigns.map((c) => (
              <polyline
                key={c.meta.id}
                fill="none"
                stroke={colorOf(c.meta.id)}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                points={c.cumulativeByDay.map((v, day) => `${px(day)},${py(v)}`).join(' ')}
              />
            ))
          : (
            <polyline
              fill="none"
              stroke={CAMPAIGN_COLORS[0]}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={singleLine.map((p, i) => `${px(i)},${py(p.total)}`).join(' ')}
            />
          )}
      </svg>

      {isMulti && (
        <div className="flex flex-wrap gap-2 mt-3">
          {datasets!.map((d) => {
            const off = hidden.has(d.id);
            return (
              <button
                key={d.id}
                onClick={() => toggle(d.id)}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all ${
                  off ? 'border-gray-200 text-gray-400 opacity-50 line-through' : 'border-gray-200 text-gray-700 bg-gray-50 hover:border-indigo-300'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorOf(d.id) }} />
                {d.name}
              </button>
            );
          })}
        </div>
      )}

      {isMulti && stats && stats.quarters.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            {t('compare.quartersTitle')}
          </p>
          <ul className="divide-y divide-gray-100">
            {stats.quarters.map((q) => (
              <li key={`${q.year}-${q.quarter}`} className="py-1.5 flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700 w-16 shrink-0">
                  {t('compare.quarterLabel', { quarter: q.quarter, year: q.year })}
                </span>
                <span className="flex-1 text-xs text-gray-500">
                  {t('donations', { count: q.count })} · {t('compare.crossCampaigns', { count: q.campaignCount })}
                </span>
                <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">{formatCurrency(q.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
