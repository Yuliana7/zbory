import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../context/AppContext';
import { InsightsPanel } from '../components/insights/InsightsPanel';
import { SaveCampaignControl } from '../components/insights/SaveCampaignControl';
import { CrossCampaignSection } from '../components/insights/CrossCampaignSection';
import { detectMoments } from '../utils/momentDetector';
import { normalizeDonations } from '../utils/csvParser';
import { aggregateDonations } from '../utils/dataAggregator';
import { generateInsights } from '../utils/insightGenerator';
import { analyzeComments } from '../utils/commentAnalyzer';

export function InsightsPage() {
  const { t } = useTranslation('insights');
  const { t: tC } = useTranslation('campaigns');
  const { state, dispatch, goToStep, handleTemplateSelect } = useAppContext();
  const { app } = state;

  // Multi mode: «Разом» (the global merged pipeline) or one jar, recomputed locally
  const datasets = app.campaignDatasets;
  const [viewId, setViewId] = useState<string>('merged');
  const perJar = useMemo(() => {
    if (!datasets || viewId === 'merged') return null;
    const ds = datasets.find((d) => d.id === viewId);
    if (!ds) return null;
    const { donations, withdrawals, currentBalance } = normalizeDonations(ds.rawData);
    const aggregates = aggregateDonations(donations, withdrawals, currentBalance);
    return { aggregates, insights: generateInsights(aggregates, t), commentInsights: analyzeComments(donations) };
  }, [datasets, viewId, t]);

  if (!app.aggregates || !app.insights) return null;

  const moments = detectMoments(app.aggregates, t, app.goal);
  const isMerged = !perJar;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">{t('title')}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => goToStep('upload')}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800
                       bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm
                       hover:border-gray-300 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('backButton')}
          </button>
          <SaveCampaignControl />
          <button
            onClick={() => dispatch({ type: 'GO_TO_STEP', payload: 'gallery' })}
            className="flex items-center gap-2 text-sm font-semibold text-white
                       bg-indigo-600 hover:bg-indigo-700 rounded-lg px-4 py-2 shadow-sm transition-all"
          >
            {t('nextButton')}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
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

      {/* Share-worthy moments — one tap jumps to the matching template */}
      {isMerged && moments.length > 0 && (
        <div className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-3">
            {t('moments.title')}
          </p>
          <div className="flex flex-wrap gap-2">
            {moments.map((m) => (
              <button
                key={m.id}
                onClick={() => handleTemplateSelect(m.templateId)}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-amber-200 rounded-xl
                           text-sm font-medium text-gray-800 shadow-sm
                           hover:border-amber-400 hover:shadow transition-all"
              >
                <span className="text-base leading-none">{m.icon}</span>
                {m.text}
                <span className="text-amber-500 font-semibold">→</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <InsightsPanel
        insights={perJar?.insights ?? app.insights}
        aggregates={perJar?.aggregates ?? app.aggregates}
        goal={isMerged ? app.goal : undefined}
        commentInsights={perJar?.commentInsights ?? app.commentInsights}
      />

      {/* Cross-campaign analytics — only in multi mode, on the merged view */}
      {isMerged && datasets && datasets.length >= 2 && (
        <div className="mt-6">
          <CrossCampaignSection datasets={datasets} />
        </div>
      )}
    </div>
  );
}
