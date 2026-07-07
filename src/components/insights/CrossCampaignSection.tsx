import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CampaignDataset } from '../../types';
import { analyzeCampaigns, datasetsToItems } from '../../utils/campaignAnalytics';
import { formatCurrency } from '../../utils/dataAggregator';

// One fixed color per campaign, shared by chart, legend and table dots
const CAMPAIGN_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

const formatIsoDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}.${m}.${y.slice(2)}` : iso;
};

/** Cross-campaign analytics block: aligned cumulative curves, side-by-side table, loyal donors, quarter totals. */
export function CrossCampaignSection({ datasets }: { datasets: CampaignDataset[] }) {
  const { t } = useTranslation('campaigns');
  // With many jars loaded, chips toggle which campaigns take part in every
  // block below (chart, table, loyal donors, quarters)
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const visible = useMemo(() => datasets.filter((d) => !hidden.has(d.id)), [datasets, hidden]);
  const stats = useMemo(() => analyzeCampaigns(datasetsToItems(visible)), [visible]);
  // Colors stay pinned to the original dataset order, so toggling never recolors
  const colorOf = (id: string) => CAMPAIGN_COLORS[datasets.findIndex((d) => d.id === id) % CAMPAIGN_COLORS.length];

  const toggle = (id: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (datasets.length < 2) return null;

  const maxDays = Math.max(...stats.campaigns.map((c) => c.days), 1);
  const maxTotal = Math.max(...stats.campaigns.map((c) => c.totalAmount), 1);

  const W = 640;
  const H = 280;
  const P = 8;
  const px = (day: number) => P + (day / Math.max(maxDays - 1, 1)) * (W - 2 * P);
  const py = (value: number) => H - P - (value / maxTotal) * (H - 2 * P);

  return (
    <div className="space-y-6">
      {/* Cumulative curves aligned by campaign day */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-baseline justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-900">{t('compare.chartTitle')}</h3>
          <span className="text-xs text-gray-400">{t('compare.chartDays', { count: maxDays })}</span>
        </div>
        <p className="text-xs text-gray-400 mb-4">{t('compare.chartHint')}</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={P} x2={W - P} y1={py(maxTotal * f)} y2={py(maxTotal * f)} stroke="#f3f4f6" strokeWidth={1} />
          ))}
          {stats.campaigns.map((c) => (
            <polyline
              key={c.meta.id}
              fill="none"
              stroke={colorOf(c.meta.id)}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={c.cumulativeByDay.map((v, day) => `${px(day)},${py(v)}`).join(' ')}
            />
          ))}
        </svg>
        {/* Legend doubles as a filter: click a chip to hide/show that jar everywhere below */}
        <div className="flex flex-wrap gap-2 mt-3">
          {datasets.map((d) => {
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
      </div>

      {/* Side-by-side table */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('compare.tableTitle')}</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wider">
                {(['name', 'period', 'days', 'donations', 'total', 'median', 'perDay'] as const).map((col) => (
                  <th key={col} className={`px-3 py-2 font-medium ${col === 'name' || col === 'period' ? 'text-left' : 'text-right'}`}>
                    {t(`compare.table.${col}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stats.campaigns.map((c) => (
                <tr key={c.meta.id}>
                  <td className="px-3 py-2.5 font-medium text-gray-900">
                    <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: colorOf(c.meta.id) }} />
                    {c.meta.name}
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                    {formatIsoDate(c.meta.summary.firstDate)} — {formatIsoDate(c.meta.summary.lastDate)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-700">{c.days}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700">{c.donationCount}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-gray-900 whitespace-nowrap">{formatCurrency(c.totalAmount)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700 whitespace-nowrap">{formatCurrency(c.medianDonation)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700 whitespace-nowrap">{formatCurrency(Math.round(c.avgPerDay))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        {/* Donors who supported more than one jar */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">💛 {t('compare.crossTitle')}</h3>
          <p className="text-xs text-gray-400 mb-3">{t('compare.crossHint')}</p>
          {stats.crossDonors.length === 0 ? (
            <p className="text-sm text-gray-500">{t('compare.crossEmpty')}</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {stats.crossDonors.slice(0, 10).map((d) => (
                <li key={d.name} className="py-2 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{d.name}</p>
                    <p className="text-xs text-gray-500">
                      {t('compare.crossCampaigns', { count: d.campaignCount })} · {t('donations', { count: d.donationCount })}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">{formatCurrency(d.totalAmount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Quarter totals */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">📆 {t('compare.quartersTitle')}</h3>
          <ul className="divide-y divide-gray-100">
            {stats.quarters.map((q) => (
              <li key={`${q.year}-${q.quarter}`} className="py-2 flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700 w-20 shrink-0">
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
      </div>
    </div>
  );
}
