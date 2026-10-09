import { useTranslation } from 'react-i18next';
import type { Donation } from '../../../types';
import { formatCurrency, formatShortDate } from '../../../utils/dataAggregator';
import { DownloadIcon, EditIcon, WarningIcon } from '../../../icons';
import { SectionCard } from './SectionCard';

const ROWS_SHOWN = 5;
const SECONDARY_BUTTON =
  'flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 bg-white border border-gray-200 ' +
  'rounded-lg px-3 py-2 shadow-sm hover:border-gray-300 transition-all';

interface PreviewSectionProps {
  donations: Donation[];
  totalCount: number;
  invalidRowCount: number;
  /** show the "some rows are incomplete" warning (after a first "Далі" attempt) */
  showInvalidWarning: boolean;
  onEdit?: () => void;
  onDownload: () => void;
}

/** The first rows of what was loaded, with the two things you do to the data itself:
 * fix it by hand, or take a copy as CSV. */
export function PreviewSection({ donations, totalCount, invalidRowCount, showInvalidWarning, onEdit, onDownload }: PreviewSectionProps) {
  const { t } = useTranslation('upload');
  return (
    <SectionCard
      title={t('preview.title')}
      description={t('preview.foundCount', { count: totalCount })}
      actions={
        <>
          {onEdit && (
            <button onClick={onEdit} className={SECONDARY_BUTTON}>
              <EditIcon className="w-4 h-4" />
              {t('preview.editButton')}
            </button>
          )}
          <button onClick={onDownload} className={SECONDARY_BUTTON}>
            <DownloadIcon className="w-4 h-4" />
            {t('preview.saveCSVButton')}
          </button>
        </>
      }
    >
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {(['date', 'time', 'donor', 'amount', 'category'] as const).map((col) => (
                <th
                  key={col}
                  className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${col === 'amount' ? 'text-right' : 'text-left'}`}
                >
                  {t(`preview.columns.${col}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {donations.slice(0, ROWS_SHOWN).map((donation, index) => (
              <tr key={index} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{formatShortDate(donation.timestamp)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{formatTime(donation.timestamp)}</td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {donation.donor || <span className="text-gray-400 italic">{t('preview.anonymous')}</span>}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                  {formatCurrency(donation.amount)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{donation.category}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalCount > ROWS_SHOWN && (
        <div className="mt-4 text-center text-sm text-gray-500">{t('preview.showingOf', { shown: ROWS_SHOWN, total: totalCount })}</div>
      )}

      {showInvalidWarning && invalidRowCount > 0 && (
        <div className="mt-4 flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <WarningIcon className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800">{t('preview.invalidRows', { count: invalidRowCount })}</p>
            <p className="text-xs text-amber-600 mt-0.5">{t('preview.invalidRowsHint')}</p>
          </div>
          {onEdit && (
            <button
              onClick={onEdit}
              className="shrink-0 px-3 py-1.5 text-xs font-medium bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg transition-colors"
            >
              {t('preview.editButton')}
            </button>
          )}
        </div>
      )}
    </SectionCard>
  );
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
