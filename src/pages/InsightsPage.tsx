import { Suspense, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../context/AppContext';
import { InsightsPanel } from '../components/insights/InsightsPanel';
import { MergeBanner } from '../components/insights/MergeBanner';
import { RenewReportCard } from '../components/insights/RenewReportCard';
import { RenewTokenSheet } from '../components/insights/RenewTokenSheet';
import { useRenewAll } from '../hooks/useRenewAll';
import { CrossCampaignSection } from '../components/insights/CrossCampaignSection';
import { normalizeDonations } from '../utils/csvParser';
import { aggregateDonations } from '../utils/dataAggregator';
import { generateInsights } from '../utils/insightGenerator';
import { analyzeComments, attachCampaignCounts } from '../utils/commentAnalyzer';
import { rawDonationsToManualRows } from '../utils/csvExporter';
import { lazyNamed } from '../utils/lazyPage';
import { PageLoading } from '../components/PageLoading';
import { ArrowLeftIcon, ArrowRightIcon } from '../icons';

const FriendsPage = lazyNamed(() => import('../components/insights/FriendsPage'), 'FriendsPage');
const DailyPage = lazyNamed(() => import('../components/insights/DailyPage'), 'DailyPage');

export function InsightsPage() {
  const { t } = useTranslation('insights');
  const { t: tC } = useTranslation('campaigns');
  const { t: tU } = useTranslation('upload');
  const { state, dispatch, handleReset } = useAppContext();
  const { app } = state;
  // lives here so a renew carries on, and reports, across the analytics' pages
  const renew = useRenewAll();

  // Multi mode: «Разом» (the global merged pipeline) or one jar, recomputed locally
  const datasets = app.campaignDatasets;
  const [viewId, setViewId] = useState<string>('merged');
  const perJar = useMemo(() => {
    if (!datasets || viewId === 'merged') return null;
    const ds = datasets.find((d) => d.id === viewId);
    if (!ds) return null;
    const { donations, withdrawals, currentBalance } = normalizeDonations(ds.rawData);
    const aggregates = aggregateDonations(donations, withdrawals, currentBalance);
    return { aggregates, donations, withdrawals, insights: generateInsights(aggregates, t), commentInsights: analyzeComments(donations) };
  }, [datasets, viewId, t]);

  const isMerged = !perJar;

  // Merged multi-jar view: enrich the repeat/top-donor lists with how many
  // of the loaded statements each identity actually donated in — lost once
  // statements are merged into one flat dataset, so it's re-derived here.
  const mergedCommentInsights = useMemo(() => {
    if (!isMerged || !datasets || datasets.length < 2 || !app.commentInsights) return app.commentInsights;
    return {
      ...app.commentInsights,
      repeatDonors: attachCampaignCounts(app.commentInsights.repeatDonors, datasets),
      topDonorsBySum: attachCampaignCounts(app.commentInsights.topDonorsBySum, datasets),
    };
  }, [isMerged, datasets, app.commentInsights]);

  const invalidRows = useMemo(
    () =>
      rawDonationsToManualRows(app.rawData ?? []).filter((row) => {
        const amount = parseFloat(row.amount);
        return !row.date || !row.amount || isNaN(amount) || amount <= 0;
      }).length,
    [app.rawData],
  );

  if (!app.aggregates || !app.insights) return null;

  const tokenSheet = renew.askToken && (
    <RenewTokenSheet
      error={renew.error === 'invalid-token' ? tU('monobank.errors.invalid-token') : null}
      onSubmit={renew.submitToken}
      onClose={renew.closeTokenSheet}
    />
  );

  if (app.insightsView === 'friends') {
    return (
      <Suspense fallback={<PageLoading />}>
        <FriendsPage friends={app.friends ?? []} totalAmount={app.aggregates.totalAmount} renew={renew} />
        {tokenSheet}
      </Suspense>
    );
  }
  if (app.insightsView === 'daily') {
    return (
      <Suspense fallback={<PageLoading />}>
        <DailyPage
          aggregates={perJar?.aggregates ?? app.aggregates}
          donations={perJar?.donations ?? app.donations ?? []}
          withdrawals={perJar?.withdrawals ?? app.withdrawals ?? []}
        />
      </Suspense>
    );
  }

  return (
    <div>
      <div className="mb-6 flex justify-between">
        <h2 className="text-2xl font-bold text-gray-900">{t('title')}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800
                       bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm
                       hover:border-gray-300 transition-all"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            {t('backButton')}
          </button>
          <button
            onClick={() => dispatch({ type: 'GO_TO_STEP', payload: 'gallery' })}
            className="flex items-center gap-2 text-sm font-semibold text-white
                       bg-indigo-600 hover:bg-indigo-700 rounded-lg px-4 py-2 shadow-sm transition-all"
          >
            {t('nextButton')}
            <ArrowRightIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Multi mode: merged vs per-jar view */}
      {datasets && datasets.length >= 2 && (
        <div className="mb-6 flex flex-wrap gap-1 p-1 bg-gray-50 border border-gray-200 rounded-xl w-fit">
          {[{ id: 'merged', name: tC('viewMerged') }, ...datasets].map((v) => (
            <button
              key={v.id}
              onClick={() => setViewId(v.id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                viewId === v.id ? 'bg-white text-indigo-700 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {v.name}
            </button>
          ))}
        </div>
      )}

      {app.lastMerge && <MergeBanner merge={app.lastMerge} />}
      <RenewReportCard renew={renew} />
      {invalidRows > 0 && (
        <p role="status" className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          {tU('preview.invalidRows', { count: invalidRows })}
        </p>
      )}

      {/* Cross-campaign analytics — only in multi mode, on the merged view */}
      {isMerged && datasets && datasets.length >= 2 && (
        <div className="mt-6 mb-6">
          <CrossCampaignSection datasets={datasets} />
        </div>
      )}

      <InsightsPanel
        insights={perJar?.insights ?? app.insights}
        aggregates={perJar?.aggregates ?? app.aggregates}
        commentInsights={perJar?.commentInsights ?? mergedCommentInsights}
        campaignDatasets={isMerged ? datasets : null}
        friends={isMerged ? (app.friends ?? []) : undefined}
        renew={renew}
      />
      {tokenSheet}

    </div>
  );
}
