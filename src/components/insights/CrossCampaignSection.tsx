import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CampaignDataset } from '../../types';
import { analyzeCampaigns, datasetsToItems } from '../../utils/campaignAnalytics';
import { formatCurrency } from '../../utils/dataAggregator';
import { CAMPAIGN_COLORS } from '../../utils/campaignColors';

const formatIsoDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}.${m}.${y.slice(2)}` : iso;
};

/**
 * Side-by-side campaign comparison table. The aligned cumulative chart,
 * quarter totals and cross-campaign loyal-donor ranking moved to the top of
 * the insights page (CumulativeChart + the merged repeat/top-donor lists),
 * so this component now only carries the per-campaign detail table.
 */
export function CrossCampaignSection({ datasets }: { datasets: CampaignDataset[] }) {
  const { t } = useTranslation('campaigns');
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const visible = useMemo(() => datasets.filter((d) => !hidden.has(d.id)), [datasets, hidden]);
  const stats = useMemo(() => analyzeCampaigns(datasetsToItems(visible)), [visible]);
  const colorOf = (id: string) => CAMPAIGN_COLORS[datasets.findIndex((d) => d.id === id) % CAMPAIGN_COLORS.length];

  const toggle = (id: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (datasets.length < 2) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-gray-900">{t('compare.tableTitle')}</h3>
        <div className="flex flex-wrap gap-2">
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
  );
}
