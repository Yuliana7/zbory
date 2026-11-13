import { useTranslation } from 'react-i18next';
import { DateRangeField } from '../../../components/DateRangeField';
import { dateToIso } from '../../../utils/dateRange';
import { Collapsible } from '../shared';

interface DateRangePanelProps {
  open: boolean;
  onToggle: () => void;
  dateFrom: string;
  dateTo: string;
  campaignMin: string;
  /** donations inside the range; 0 means the card falls back to the whole campaign */
  rangeCount: number;
  onChange: (from: string, to: string) => void;
  onReset: () => void;
}

export function DateRangePanel({ open, onToggle, dateFrom, dateTo, campaignMin, rangeCount, onChange, onReset }: DateRangePanelProps) {
  const { t } = useTranslation('export');
  const { t: tc } = useTranslation();
  const filtered = !!(dateFrom || dateTo);
  return (
    <Collapsible
      label={t('dateRange.label')}
      badge={filtered ? t('dateRange.filtered', { count: rangeCount }) : undefined}
      badgeColor="indigo"
      open={open}
      onToggle={onToggle}
    >
      <div className="space-y-2">
        <DateRangeField
          label={tc('dateRange.period')}
          from={dateFrom}
          to={dateTo}
          min={campaignMin}
          max={dateToIso(new Date())}
          placeholder={t('dateRange.whole')}
          onChange={onChange}
        />
        {filtered && rangeCount === 0 && (
          <p role="status" className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">{t('dateRange.empty')}</p>
        )}
        {filtered && (
          <button onClick={onReset} className="text-sm font-medium text-indigo-600 hover:text-indigo-800 underline">{t('dateRange.reset')}</button>
        )}
      </div>
    </Collapsible>
  );
}
