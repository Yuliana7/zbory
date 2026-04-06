import type { Insight, Aggregates } from '../../types';

interface InsightsPanelProps {
  insights: Insight[];
  aggregates: Aggregates;
}

export function InsightsPanel({ insights, aggregates }: InsightsPanelProps) {
  const duration = Math.ceil(
    (aggregates.lastDate.getTime() - aggregates.firstDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="space-y-4">
      {/* Hero stat */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-6 text-white">
        <p className="text-indigo-200 text-sm font-medium mb-1">Загальна сума</p>
        <p className="text-4xl font-bold tracking-tight">
          {new Intl.NumberFormat('uk-UA').format(Math.round(aggregates.totalAmount))} ₴
        </p>
        <p className="mt-2 text-indigo-200 text-sm">
          {aggregates.donationCount} донатів за {duration} {getDaysWord(duration)} 💙💛
        </p>
      </div>

      {/* Insight cards */}
      {insights.slice(1).map((insight, i) => (
        <div
          key={i}
          className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-start gap-3"
        >
          <span className="text-2xl leading-none mt-0.5">{insight.icon}</span>
          <div className="min-w-0">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
              {insight.title}
            </p>
            <p className="text-lg font-semibold text-gray-900 mt-0.5">{insight.value}</p>
            {insight.description && (
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{insight.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function getDaysWord(days: number): string {
  if (days === 1) return 'день';
  if (days >= 2 && days <= 4) return 'дні';
  if (days >= 5 && days <= 20) return 'днів';
  const lastDigit = days % 10;
  if (lastDigit === 1) return 'день';
  if (lastDigit >= 2 && lastDigit <= 4) return 'дні';
  return 'днів';
}
