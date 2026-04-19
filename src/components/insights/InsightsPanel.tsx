import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('insights');

  const duration = Math.ceil(
    (aggregates.lastDate.getTime() - aggregates.firstDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  const actionableInsights = generateActionableInsights(aggregates, goal);

  return (
    <div className="space-y-4">
      {/* Hero stat */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-6 text-white">
        <p className="text-indigo-200 text-sm font-medium mb-1">{t('totalAmount')}</p>
        <p className="text-4xl font-bold tracking-tight">
          {new Intl.NumberFormat('uk-UA').format(Math.round(aggregates.totalAmount))} ₴
        </p>
        <p className="mt-2 text-indigo-200 text-sm">
          {t('donationsCount', { count: aggregates.donationCount })}{' '}
          {t('duration', { count: duration })} 💙💛
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
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{insight.title}</p>
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
          <SectionDivider label={t('sections.whatNext')} color="amber" />
          <div className="space-y-3">
            {actionableInsights.map((action, i) => (
              <div
                key={i}
                className="bg-amber-50 rounded-xl p-4 border border-amber-200 flex items-start gap-3"
              >
                <span className="text-2xl leading-none mt-0.5">{action.icon}</span>
                <div className="min-w-0">
                  <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide">{action.title}</p>
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
          <SectionDivider label={t('sections.comments')} color="purple" />
          <div className="space-y-3">

            {commentInsights.topEmojis.length > 0 && (
              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">
                  {t('comments.topEmojis')}
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
                  {t('comments.emojiUsageFrom', { count: commentInsights.totalWithComments })}
                </p>
              </div>
            )}

            {commentInsights.repeatDonors.length > 0 && (
              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">
                  {t('comments.repeatDonors')}
                </p>
                <p className="text-xs text-gray-500 mb-2">
                  {t('comments.repeatDonorsCount', { count: commentInsights.repeatDonors.length })}
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

            {commentInsights.communities.length > 0 && (
              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">
                  {t('comments.communities')}
                </p>
                <p className="text-xs text-gray-500 mb-2">
                  {t('comments.communitiesCount', { count: commentInsights.communities.length })}
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
