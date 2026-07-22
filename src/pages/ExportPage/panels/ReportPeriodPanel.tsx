import { useTranslation } from 'react-i18next';

interface ReportPeriodPanelProps {
  periodKey: string;
  onChange: (key: string) => void;
  quarters: Array<{ year: number; quarter: number }>;
}

export function ReportPeriodPanel({ periodKey, onChange, quarters }: ReportPeriodPanelProps) {
  const { t } = useTranslation('export');
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <label className="block text-xs text-gray-500 mb-1.5">{t('campaigns:report.periodLabel')}</label>
      <select
        value={periodKey}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="all">{t('campaigns:report.periodAll')}</option>
        {[...new Set(quarters.map((q) => q.year))].sort((a, b) => b - a).map((y) => (
          <option key={y} value={`y-${y}`}>{t('campaigns:report.periodYear', { year: y })}</option>
        ))}
        {[...quarters].sort((a, b) => b.year - a.year || b.quarter - a.quarter).map((q) => (
          <option key={`${q.year}-${q.quarter}`} value={`q-${q.year}-${q.quarter}`}>
            {t('campaigns:report.periodQuarter', { quarter: q.quarter, year: q.year })}
          </option>
        ))}
      </select>
    </div>
  );
}
