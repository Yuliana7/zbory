import { useTranslation } from 'react-i18next';
import { useAppContext } from '../context/AppContext';
import { InsightsPanel } from '../components/insights/InsightsPanel';

export function InsightsPage() {
  const { t } = useTranslation('insights');
  const { state, dispatch, handleReset } = useAppContext();
  const { app } = state;

  if (!app.aggregates || !app.insights) return null;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">{t('title')}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800
                       bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm
                       hover:border-gray-300 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('backButton')}
          </button>
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
      <InsightsPanel
        insights={app.insights}
        aggregates={app.aggregates}
        goal={app.goal}
        commentInsights={app.commentInsights}
      />
    </div>
  );
}
