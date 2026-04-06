import type { Donation } from '../../types';
import { formatCurrency, formatShortDate } from '../../utils/dataAggregator';

interface PreviewTableProps {
  donations: Donation[];
  totalCount: number;
  onProceed: () => void;
  onCancel: () => void;
}

export function PreviewTable({ donations, totalCount, onProceed, onCancel }: PreviewTableProps) {
  // Show first 10 donations as preview
  const previewDonations = donations.slice(0, 10);

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Перегляд файлу</h2>
            <p className="text-sm text-gray-600 mt-1">
              Знайдено {totalCount} {getDonationsWord(totalCount)}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={onCancel} className="btn-secondary text-sm">
              Скасувати
            </button>
            <button onClick={onProceed} className="btn-primary">
              Продовжити →
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Дата
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Час
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Донатер
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Сума
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Категорія
                </th>
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
                      <span className="text-gray-400 italic">Анонімно</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                    {formatCurrency(donation.amount)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {donation.category}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalCount > 10 && (
          <div className="mt-4 text-center text-sm text-gray-500">
            Показано 10 з {totalCount} донатів
          </div>
        )}

        <div className="mt-6 flex justify-end space-x-3">
          <button onClick={onCancel} className="btn-secondary">
            Обрати інший файл
          </button>
          <button onClick={onProceed} className="btn-primary">
            Продовжити до аналітики →
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Formats time as HH:MM
 */
function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Gets correct Ukrainian word form for "donations"
 */
function getDonationsWord(count: number): string {
  if (count === 1) return 'донат';
  if (count >= 2 && count <= 4) return 'донати';
  if (count >= 5 && count <= 20) return 'донатів';

  const lastDigit = count % 10;
  if (lastDigit === 1) return 'донат';
  if (lastDigit >= 2 && lastDigit <= 4) return 'донати';
  return 'донатів';
}