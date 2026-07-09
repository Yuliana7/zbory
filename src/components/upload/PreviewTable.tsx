import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Donation } from '../../types';
import { formatCurrency, formatShortDate } from '../../utils/dataAggregator';
import { SaveCampaignControl } from '../insights/SaveCampaignControl';

interface PreviewTableProps {
  donations: Donation[];
  totalCount: number;
  invalidRowCount?: number;
  onProceed: (goal?: number) => void;
  onCancel: () => void;
  onEdit?: () => void;
  initialGoal?: number; // prefilled when the dataset came with a goal (campaign / restored session)
}

export function PreviewTable({ donations, totalCount, invalidRowCount = 0, onProceed, onCancel, onEdit, initialGoal }: PreviewTableProps) {
  const { t } = useTranslation('upload');
  const [goalInput, setGoalInput] = useState(initialGoal ? String(initialGoal) : '');
  const [showErrors, setShowErrors] = useState(false);

  const previewDonations = donations.slice(0, 10);
  const parsedGoal = parseGoal(goalInput);

  function handleProceed() {
    if (invalidRowCount > 0 && !showErrors) {
      setShowErrors(true);
      return;
    }
    onProceed(parsedGoal ?? undefined);
  }

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <div className="card">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('preview.title')}</h2>
            <p className="text-sm text-gray-600 mt-1">
              {t('preview.foundCount', { count: totalCount })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800
                         bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm
                         hover:border-gray-300 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {t('preview.cancelButton')}
            </button>
            <button
              onClick={handleProceed}
              className="flex items-center gap-2 text-sm font-semibold text-white
                         bg-indigo-600 hover:bg-indigo-700 rounded-lg px-4 py-2 shadow-sm transition-all"
            >
              {showErrors && invalidRowCount > 0
                ? t('preview.proceedAnywayButton')
                : t('preview.proceedButton')}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {(['date', 'time', 'donor', 'amount', 'category'] as const).map((col) => (
                  <th
                    key={col}
                    className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${
                      col === 'amount' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {t(`preview.columns.${col}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {previewDonations.map((donation, index) => (
                <tr key={index} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {formatShortDate(donation.timestamp)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                    {formatTime(donation.timestamp)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {donation.donor || (
                      <span className="text-gray-400 italic">{t('preview.anonymous')}</span>
                    )}
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

        {totalCount > 10 && (
          <div className="mt-4 text-center text-sm text-gray-500">
            {t('preview.showingOf', { total: totalCount })}
          </div>
        )}

        {/* Invalid rows warning — shown only after a proceed attempt */}
        {showErrors && invalidRowCount > 0 && (
          <div className="mt-4 flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
            <span className="text-amber-500 text-base leading-none mt-0.5">⚠</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-800">
                {t('preview.invalidRows', { count: invalidRowCount })}
              </p>
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

        {/* Goal input */}
        <div className="mt-6 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
          <label className="block text-sm font-semibold text-indigo-900 mb-1">
            {t('preview.goal.label')}{' '}
            <span className="font-normal text-indigo-500">{t('preview.goal.optional')}</span>
          </label>
          <p className="text-xs text-indigo-600 mb-3">{t('preview.goal.hint')}</p>
          <div className="flex items-center gap-2 max-w-xs">
            <div className="relative flex-1">
              <input
                type="text"
                inputMode="numeric"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                placeholder={t('preview.goal.placeholder')}
                className="w-full pl-3 pr-8 py-2 rounded-lg border border-indigo-200 bg-white text-sm text-gray-900
                           focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent
                           placeholder:text-gray-400"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">
                ₴
              </span>
            </div>
          </div>
          {goalInput && parsedGoal === null && (
            <p className="mt-1 text-xs text-red-500">{t('preview.goal.invalidNumber')}</p>
          )}
        </div>

        {/* Utility actions: fix data, or save a snapshot — step navigation lives in the header above.
            Stacked full-width below sm: so the labels never get squeezed on narrow phones. */}
        <div className="relative mt-6 flex flex-col sm:flex-row gap-3">
          {onEdit && (
            <button onClick={onEdit} className="btn-secondary flex-1 flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {t('preview.editButton')}
            </button>
          )}
          <SaveCampaignControl fullWidth goalOverride={parsedGoal ?? undefined} />
        </div>
      </div>
    </div>
  );
}

function parseGoal(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/[\s,.]/g, '');
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
