import { useTranslation } from 'react-i18next';
import { DateField } from '../../../components/DateField';
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
        <div className="grid grid-cols-2 gap-3">
          <DateField label={t('dateRange.from')} value={dateFrom} min={campaignMin} max={dateTo || campaignMax} onChange={onFromChange} />
          <DateField label={t('dateRange.to')} value={dateTo} min={dateFrom || campaignMin} max={campaignMax} onChange={onToChange} />
        </div>
        {(dateFrom || dateTo) && (
          <button onClick={onReset} className="text-sm font-medium text-indigo-600 hover:text-indigo-800 underline">{t('dateRange.reset')}</button>
        )}
      </div>
    </Collapsible>
  );
}
