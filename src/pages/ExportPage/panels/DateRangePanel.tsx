import { useTranslation } from 'react-i18next';
import { Collapsible } from '../shared';

interface DateRangePanelProps {
  open: boolean;
  onToggle: () => void;
  dateFrom: string;
  dateTo: string;
  campaignMin: string;
  campaignMax: string;
  filteredCount: number;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onReset: () => void;
}

export function DateRangePanel({ open, onToggle, dateFrom, dateTo, campaignMin, campaignMax, filteredCount, onFromChange, onToChange, onReset }: DateRangePanelProps) {
  const { t } = useTranslation('export');
  return (
    <Collapsible
      label={t('dateRange.label')}
      badge={(dateFrom || dateTo) ? t('dateRange.filtered', { count: filteredCount }) : undefined}
      badgeColor="indigo"
      open={open}
      onToggle={onToggle}
    >
      <div className="space-y-2">
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('dateRange.from')}</label>
          <input type="date" value={dateFrom} min={campaignMin} max={dateTo || campaignMax} onChange={e => onFromChange(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('dateRange.to')}</label>
          <input type="date" value={dateTo} min={dateFrom || campaignMin} max={campaignMax} onChange={e => onToChange(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
        </div>
        {(dateFrom || dateTo) && (
          <button onClick={onReset} className="text-xs text-gray-400 hover:text-gray-600 underline">{t('dateRange.reset')}</button>
        )}
      </div>
    </Collapsible>
  );
}
