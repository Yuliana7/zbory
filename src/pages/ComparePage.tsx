import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../context/AppContext';
import { listCampaigns, loadCampaignData, type CampaignMeta } from '../utils/campaignStore';
import { analyzeCampaigns, buildReport, type CrossCampaignStats, type ReportPeriod } from '../utils/campaignAnalytics';
import { formatCurrency } from '../utils/dataAggregator';
import { ReportCard } from '../components/templates/ReportCard';
import { PALETTES, DEFAULT_PALETTE } from '../utils/palettes';
import { exportToPNG } from '../utils/exportPNG';
import type { RawDonation } from '../types';

// One fixed color per campaign, reused by chart, legend and table dots
const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

const formatIsoDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}.${m}.${y.slice(2)}` : iso;
};

export function ComparePage() {
  const { t } = useTranslation('campaigns');
  const { dispatch } = useAppContext();
  const [stats, setStats] = useState<CrossCampaignStats | null>(null);
  const [items, setItems] = useState<Array<{ meta: CampaignMeta; rawData: RawDonation[] }>>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const metas = await listCampaigns();
      const loaded = (
        await Promise.all(metas.map(async (meta) => ({ meta, rawData: (await loadCampaignData(meta.id)) ?? [] })))
      ).filter((i) => i.rawData.length > 0);
      if (!cancelled) {
        setItems(loaded);
        setStats(analyzeCampaigns(loaded));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!stats) {
    return <p className="py-16 text-center text-sm text-gray-500">{t('compare.loading')}</p>;
  }

  const maxDays = Math.max(...stats.campaigns.map((c) => c.days), 1);
  const maxTotal = Math.max(...stats.campaigns.map((c) => c.totalAmount), 1);

  const overview = [
    { label: t('compare.stats.campaigns'), value: String(stats.campaigns.length) },
    { label: t('compare.stats.total'), value: formatCurrency(stats.totalAmount) },
    { label: t('compare.stats.donations'), value: String(stats.totalDonations) },
    { label: t('compare.stats.uniqueDonors'), value: String(stats.uniqueDonors) },
  ];

  // Chart geometry: 640×280 viewBox, 8px padding; curves normalized to the
  // longest campaign (x) and the biggest total (y)
  const W = 640;
  const H = 280;
  const P = 8;
  const px = (day: number) => P + (day / Math.max(maxDays - 1, 1)) * (W - 2 * P);
  const py = (value: number) => H - P - (value / maxTotal) * (H - 2 * P);

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">{t('compare.title')}</h2>
        <button
          onClick={() => dispatch({ type: 'GO_TO_STEP', payload: 'upload' })}
          className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800
                     bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm hover:border-gray-300 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t('compare.back')}
        </button>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {overview.map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm text-center">
            <p className="text-xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Cumulative curves aligned by campaign day */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm mb-6">
        <div className="flex items-baseline justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-900">{t('compare.chartTitle')}</h3>
          <span className="text-xs text-gray-400">{t('compare.chartDays', { count: maxDays })}</span>
        </div>
        <p className="text-xs text-gray-400 mb-4">{t('compare.chartHint')}</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={P} x2={W - P} y1={py(maxTotal * f)} y2={py(maxTotal * f)} stroke="#f3f4f6" strokeWidth={1} />
          ))}
          {stats.campaigns.map((c, i) => (
            <polyline
              key={c.meta.id}
              fill="none"
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={c.cumulativeByDay.map((v, day) => `${px(day)},${py(v)}`).join(' ')}
            />
          ))}
        </svg>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
          {stats.campaigns.map((c, i) => (
            <span key={c.meta.id} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              {c.meta.name}
            </span>
          ))}
        </div>
      </div>

      {/* Side-by-side table */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm mb-6">
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
              {stats.campaigns.map((c, i) => (
                <tr key={c.meta.id}>
                  <td className="px-3 py-2.5 font-medium text-gray-900">
                    <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
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

      <ReportBuilder items={items} stats={stats} />
    </div>
  );
}

// ─── «Звіти»: period → shareable PNG ─────────────────────────────────────────

function ReportBuilder({
  items,
  stats,
}: {
  items: Array<{ meta: CampaignMeta; rawData: RawDonation[] }>;
  stats: CrossCampaignStats;
}) {
  const { t } = useTranslation('campaigns');
  const [periodKey, setPeriodKey] = useState('all');
  const [format, setFormat] = useState<'post' | 'story'>('story');
  const [paletteId, setPaletteId] = useState(DEFAULT_PALETTE.id);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);

  // Period options come from the data: all time, then years, then quarters
  const options = useMemo(() => {
    const years = [...new Set(stats.quarters.map((q) => q.year))].sort((a, b) => b - a);
    const quarters = [...stats.quarters].sort((a, b) => b.year - a.year || b.quarter - a.quarter);
    return [
      { key: 'all', label: t('report.periodAll') },
      ...years.map((y) => ({ key: `y-${y}`, label: t('report.periodYear', { year: y }) })),
      ...quarters.map((q) => ({ key: `q-${q.year}-${q.quarter}`, label: t('report.periodQuarter', { quarter: q.quarter, year: q.year }) })),
    ];
  }, [stats.quarters, t]);

  const period: ReportPeriod = useMemo(() => {
    const [kind, year, quarter] = periodKey.split('-');
    if (kind === 'y') return { kind: 'year', year: Number(year) };
    if (kind === 'q') return { kind: 'quarter', year: Number(year), quarter: Number(quarter) };
    return { kind: 'all' };
  }, [periodKey]);

  const report = useMemo(() => buildReport(items, period), [items, period]);

  const periodLabel =
    period.kind === 'all'
      ? t('report.labelAll')
      : period.kind === 'year'
        ? t('report.labelYear', { year: period.year })
        : t('report.labelQuarter', { quarter: period.quarter, year: period.year });

  const palette = PALETTES.find((p) => p.id === paletteId) ?? DEFAULT_PALETTE;
  const height = format === 'story' ? 1920 : 1080;

  useEffect(() => {
    const update = () => wrapRef.current && setScale(Math.min(wrapRef.current.clientWidth / 1080, 0.4));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const handleDownload = async () => {
    if (!exportRef.current || exporting) return;
    setExporting(true);
    try {
      await exportToPNG(exportRef.current, `zbory-zvit-${periodKey}-${format}.png`, 1080, height);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm mt-6">
      <h3 className="text-sm font-semibold text-gray-900">🖼️ {t('report.title')}</h3>
      <p className="text-xs text-gray-400 mb-4">{t('report.hint')}</p>

      <div className="flex flex-col sm:flex-row gap-6">
        {/* Controls */}
        <div className="sm:w-64 shrink-0 space-y-4">
          <select
            value={periodKey}
            onChange={(e) => setPeriodKey(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900
                       focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>

          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 gap-1">
            {(['story', 'post'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  format === f ? 'bg-white text-indigo-700 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t(`report.format${f === 'story' ? 'Story' : 'Post'}`)}
              </button>
            ))}
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-1.5">{t('report.palette')}</p>
            <div className="flex flex-wrap gap-2">
              {PALETTES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPaletteId(p.id)}
                  title={p.name}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    paletteId === p.id ? 'border-indigo-500 scale-110' : 'border-gray-200'
                  }`}
                  style={{ background: p.background }}
                />
              ))}
            </div>
          </div>

          <button
            onClick={handleDownload}
            disabled={exporting || report.donationCount === 0}
            className="w-full px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40
                       text-white rounded-lg transition-colors"
          >
            {exporting ? t('report.downloading') : t('report.download')}
          </button>
          {report.donationCount === 0 && <p className="text-xs text-amber-600">{t('report.empty')}</p>}
        </div>

        {/* Scaled live preview */}
        <div ref={wrapRef} className="flex-1 min-w-0">
          <div style={{ height: height * scale, position: 'relative', overflow: 'hidden' }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: 1080 }}>
              <ReportCard report={report} periodLabel={periodLabel} format={format} palette={palette} />
            </div>
          </div>
        </div>
      </div>

      {/* Offscreen node exported at native resolution */}
      <div style={{ position: 'fixed', left: -12000, top: 0, pointerEvents: 'none' }} aria-hidden>
        <ReportCard ref={exportRef} report={report} periodLabel={periodLabel} format={format} palette={palette} />
      </div>
    </div>
  );
}
