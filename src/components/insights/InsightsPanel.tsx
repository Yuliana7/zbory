import type { Insight, Aggregates, CommentInsights } from '../../types';
import { generateActionableInsights } from '../../utils/insightGenerator';
import { formatCurrency } from '../../utils/dataAggregator';

interface InsightsPanelProps {
  insights: Insight[];
  aggregates: Aggregates;
  goal?: number;
  commentInsights: CommentInsights | null;
}

export function InsightsPanel({ insights, aggregates, goal, commentInsights }: InsightsPanelProps) {
  const duration = Math.ceil(
    (aggregates.lastDate.getTime() - aggregates.firstDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const actionableInsights = generateActionableInsights(aggregates, goal);

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

      {/* Regular insight cards */}
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

      {/* Actionable recommendations */}
      {actionableInsights.length > 0 && (
        <div className="pt-2">
          <SectionDivider label="Що робити далі?" color="amber" />
          <div className="space-y-3">
            {actionableInsights.map((action, i) => (
              <div
                key={i}
                className="bg-amber-50 rounded-xl p-4 border border-amber-200 flex items-start gap-3"
              >
                <span className="text-2xl leading-none mt-0.5">{action.icon}</span>
                <div className="min-w-0">
                  <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide">
                    {action.title}
                  </p>
                  <p className="text-base font-semibold text-amber-900 mt-0.5">{action.value}</p>
                  {action.description && (
                    <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">{action.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comment analysis */}
      {commentInsights?.hasEnoughData && (
        <div className="pt-2">
          <SectionDivider label="Коментарі донатерів" color="purple" />
          <div className="space-y-3">

            {/* Top emojis */}
            {commentInsights.topEmojis.length > 0 && (
              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">
                  🎭 Найпопулярніші емоджі
                </p>
                <div className="flex items-end gap-3 flex-wrap">
                  {commentInsights.topEmojis.map(({ emoji, count }, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <span
                        className="leading-none"
                        style={{ fontSize: i === 0 ? '2rem' : i === 1 ? '1.6rem' : '1.25rem' }}
                      >
                        {emoji}
                      </span>
                      <span className="text-xs text-gray-500">{count}×</span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-400">
                  З {commentInsights.totalWithComments} особистих коментарів
                </p>
              </div>
            )}

            {/* Repeat donors */}
            {commentInsights.repeatDonors.length > 0 && (
              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">
                  🧡 Постійні донатери
                </p>
                <p className="text-xs text-gray-500 mb-2">
                  {commentInsights.repeatDonors.length}{' '}
                  {getPersonsWord(commentInsights.repeatDonors.length)} донатили більше одного разу
                </p>
                <div className="space-y-2">
                  {commentInsights.repeatDonors.map(({ identity, count, totalAmount }, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-gray-800 truncate flex-1">{identity}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-400">{count}×</span>
                        <span className="text-xs font-medium text-indigo-700">
                          {formatCurrency(totalAmount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* External communities */}
            {commentInsights.communities.length > 0 && (
              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">
                  🌐 Зовнішні спільноти
                </p>
                <p className="text-xs text-gray-500 mb-2">
                  Донати надходять з {commentInsights.communities.length}{' '}
                  {getCommunitiesWord(commentInsights.communities.length)}
                </p>
                <div className="flex flex-wrap gap-2">
                  {commentInsights.communities.map((c, i) => (
                    <span
                      key={i}
                      className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full px-2 py-0.5 font-medium"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function SectionDivider({ label, color }: { label: string; color: 'amber' | 'purple' }) {
  const lineClass = color === 'amber' ? 'bg-amber-200' : 'bg-purple-200';
  const textClass = color === 'amber' ? 'text-amber-700' : 'text-purple-700';
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className={`h-px flex-1 ${lineClass}`} />
      <p className={`text-xs font-semibold uppercase tracking-wider px-1 ${textClass}`}>{label}</p>
      <div className={`h-px flex-1 ${lineClass}`} />
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

function getPersonsWord(n: number): string {
  if (n === 1) return 'людина';
  if (n >= 2 && n <= 4) return 'людини';
  return 'людей';
}

function getCommunitiesWord(n: number): string {
  if (n === 1) return 'спільноти';
  if (n >= 2 && n <= 4) return 'спільнот';
  return 'спільнот';
}
