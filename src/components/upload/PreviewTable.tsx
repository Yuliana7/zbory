import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Donation } from '../../types';
import { formatCurrency, formatShortDate } from '../../utils/dataAggregator';

interface PreviewTableProps {
  donations: Donation[];
  totalCount: number;
  onProceed: (goal?: number) => void;
  onCancel: () => void;
}

export function PreviewTable({ donations, totalCount, onProceed, onCancel }: PreviewTableProps) {
  const { t } = useTranslation('upload');
  const [goalInput, setGoalInput] = useState('');

  const previewDonations = donations.slice(0, 10);
  const parsedGoal = parseGoal(goalInput);

  function handleProceed() {
    onProceed(parsedGoal ?? undefined);
  }

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('preview.title')}</h2>
            <p className="text-sm text-gray-600 mt-1">
              {t('preview.foundCount', { count: totalCount })}
            </p>
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
            {parsedGoal !== null && (
              <span className="text-xs text-indigo-700 font-medium whitespace-nowrap">
                = {new Intl.NumberFormat('uk-UA').format(parsedGoal)} ₴
              </span>
            )}
          </div>
          {goalInput && parsedGoal === null && (
            <p className="mt-1 text-xs text-red-500">{t('preview.goal.invalidNumber')}</p>
          )}
        </div>

        <div className="mt-4 flex justify-end space-x-3">
          <button onClick={onCancel} className="btn-secondary">
            {t('preview.cancelButton')}
          </button>
          <button onClick={handleProceed} className="btn-primary">
            {t('preview.proceedButton')}
          </button>
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
