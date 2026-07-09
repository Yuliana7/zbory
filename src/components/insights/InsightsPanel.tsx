import { useTranslation } from 'react-i18next';
import type { Insight, Aggregates, CommentInsights, RepeatDonor, CampaignDataset } from '../../types';
import { generateActionableInsights } from '../../utils/insightGenerator';
import { formatCurrency } from '../../utils/dataAggregator';
import { CampaignCharts } from './CampaignCharts';
import { CumulativeChart } from './CumulativeChart';

interface InsightsPanelProps {
  insights: Insight[];
  aggregates: Aggregates;
  goal?: number;
  commentInsights: CommentInsights | null;
  // Multi-jar "Разом" view only — powers the always-visible chart (top of page)
  // and lets the donor lists below show "у N зборах" per identity.
  campaignDatasets?: CampaignDataset[] | null;
}

export function InsightsPanel({ insights, aggregates, goal, commentInsights, campaignDatasets }: InsightsPanelProps) {
  const { t } = useTranslation('insights');

  const msPerDay = 1000 * 60 * 60 * 24;
  const firstDay = new Date(
    aggregates.firstDate.getFullYear(),
    aggregates.firstDate.getMonth(),
    aggregates.firstDate.getDate(),
  );
  const lastDay = new Date(
    aggregates.lastDate.getFullYear(),
    aggregates.lastDate.getMonth(),
    aggregates.lastDate.getDate(),
  );
  const duration = Math.round((lastDay.getTime() - firstDay.getTime()) / msPerDay) + 1;

  const actionableInsights = generateActionableInsights(aggregates, t, goal);

  return (
    <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
      {/* Left column: hero, charts, insight cards */}
      <div className="space-y-4">
        {/* Hero stat */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-6 text-white">
          <p className="text-indigo-200 text-sm font-medium mb-1">{t('totalAmount')}</p>
          <p className="text-4xl font-bold tracking-tight">
            {new Intl.NumberFormat('uk-UA').format(Math.round(aggregates.currentBalance + aggregates.totalWithdrawn))} ₴
          </p>
          <p className="mt-2 text-indigo-200 text-sm">
            {t('donationsCount', { count: aggregates.donationCount })}{' '}
            {t('duration', { count: duration })} 💙💛
          </p>
        </div>

        {/* Cumulative chart: one line per jar, aligned by campaign day in multi mode.
            Hidden for a campaign that ran within a single day — a one-point line
            isn't a meaningful "over time" chart. */}
        {duration > 1 && (
          <CumulativeChart aggregates={aggregates} datasets={campaignDatasets ?? null} />
        )}

        {/* Charts section */}
        <CampaignCharts aggregates={aggregates} />

        {/* Regular insight cards */}
        {insights.slice(1).map((insight, i) => (
          <div
            key={i}
            className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-start gap-3"
          >
            <span className="text-2xl leading-none mt-0.5">{insight.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{insight.title}</p>
              {insight.value && (
                <p className="text-lg font-semibold text-gray-900 mt-0.5">{insight.value}</p>
              )}
              {insight.stats && (
                <div className="mt-2 space-y-1.5">
                  {insight.stats.map((stat, j) => (
                    <div key={j} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-gray-600">
                        {stat.icon} {stat.label}
                      </span>
                      <span className="font-semibold text-gray-900 tabular-nums shrink-0">{stat.value}</span>
                    </div>
                  ))}
                </div>
              )}
              {insight.description && (
                <p className={`text-xs text-gray-500 leading-relaxed ${insight.stats ? 'mt-2' : 'mt-0.5'}`}>
                  {insight.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Right column: "Що робити далі?" onward */}
      <div className="space-y-4">
        {/* Actionable recommendations */}
        {actionableInsights.length > 0 && (
          <div className="pt-2 lg:pt-0">
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
                <DonorListCard
                  title={t('comments.repeatDonors')}
                  subtitle={t('comments.repeatDonorsCount', { count: commentInsights.repeatDonors.length })}
                  donors={commentInsights.repeatDonors}
                  metric="count"
                  anonymousCount={aggregates.anonymousDonations}
                  t={t}
                />
              )}

              {commentInsights.topDonorsBySum.length > 0 && (
                <DonorListCard
                  title={t('comments.topDonorsBySum')}
                  donors={commentInsights.topDonorsBySum}
                  metric="sum"
                  t={t}
                />
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
    </div>
  );
}

interface DonorListCardProps {
  title: string;
  subtitle?: string;
  donors: RepeatDonor[];
  metric: 'count' | 'sum';
  anonymousCount?: number;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

/** Repeat/top-donor list — mirrors the TopDonorsCard template's rank+metric layout. */
function DonorListCard({ title, subtitle, donors, metric, anonymousCount, t }: DonorListCardProps) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">{title}</p>
      {subtitle && <p className="text-xs text-gray-500 mb-2">{subtitle}</p>}
      <div className="space-y-2">
        {donors.map(({ identity, count, totalAmount, campaignCount }, i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <span className="text-sm text-gray-800 truncate flex-1">{identity}</span>
            <div className="flex items-center gap-2 shrink-0">
              {campaignCount !== undefined && campaignCount >= 2 && (
                <span className="text-xs text-amber-600 font-medium">
                  {t('comments.inCampaigns', { count: campaignCount })}
                </span>
              )}
              <span className="text-xs text-gray-400">{count}×</span>
              <span className={`text-xs font-medium ${metric === 'sum' ? 'text-indigo-700' : 'text-gray-500'}`}>
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>
        ))}
      </div>
      {!!anonymousCount && anonymousCount > 0 && (
        <p className="mt-3 pt-2 border-t border-gray-100 text-xs text-gray-400">
          {t('comments.anonymousExtra', { count: anonymousCount })}
        </p>
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
