import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../../context/AppContext';
import { NewProjectOptions } from '../NewProjectOptions';
import type { CampaignAction } from '../CampaignActionsSheet';
import { CampaignList } from '../CampaignList';
import { EmptyState } from '../EmptyState';
import { loadSession, clearSession } from '../../../utils/session';
import { listCampaigns, type CampaignMeta } from '../../../utils/campaignStore';
import { SaveIcon, XIcon } from '../../../icons';

interface HomeScreenProps {
  onMonobank: () => void;
  onManual: () => void;
  onAction: (campaign: CampaignMeta, action: CampaignAction) => void;
}

/** Step 1's front page: the autosave restore offer, then saved projects and the ways to start a
 * new one (just the ways to start, for a first run with nothing saved). */
export function HomeScreen({ onMonobank, onManual, onAction }: HomeScreenProps) {
  const { t } = useTranslation('upload');
  const { state, handleFileSelect, handleRestoreSession } = useAppContext();
  const { app, isLoading } = state;
  const [savedSession, setSavedSession] = useState(() => loadSession());
  // Step 1 has two views: the saved projects and the ways to start a new one
  const [tab, setTab] = useState<'saved' | 'new'>('saved');
  // null = not loaded yet (avoids flashing the empty state before we know)
  const [campaigns, setCampaigns] = useState<CampaignMeta[] | null>(null);

  // The list is refetched whenever the loaded data clears (coming back from a project, saving
  // one from the preview), and on the first mount.
  useEffect(() => {
    if (app.donations) return;
    listCampaigns().then(setCampaigns).catch(() => setCampaigns([]));
  }, [app.donations]);

  return (
    <div className="py-8 sm:py-12">
      {/* Restore autosaved session */}
      {savedSession && (
        <div className="max-w-xl mx-auto mb-8 flex items-center gap-3 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl animate-fade-in">
          <SaveIcon className="w-5 h-5 text-indigo-500 shrink-0" />
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium text-indigo-900">
              {t('restore.title', {
                name: savedSession.fileName ?? t('restore.manualData'),
                count: savedSession.rawData.length,
              })}
            </p>
            <p className="text-xs text-indigo-500 mt-0.5">{new Date(savedSession.savedAt).toLocaleString('uk-UA')}</p>
          </div>
          <button
            onClick={() => {
              if (!handleRestoreSession()) {
                clearSession();
                setSavedSession(null);
              }
            }}
            className="shrink-0 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            {t('restore.button')}
          </button>
          <button
            onClick={() => {
              clearSession();
              setSavedSession(null);
            }}
            title={t('restore.dismiss')}
            className="shrink-0 p-1.5 text-indigo-400 hover:text-indigo-600 rounded-lg transition-colors"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {campaigns === null ? null : campaigns.length > 0 ? (
        <>
          <div role="tablist" className="max-w-md mx-auto mb-8 flex p-1 bg-gray-100 rounded-xl">
            {(['saved', 'new'] as const).map((key) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === key ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t(`view.${key}`)}
                {key === 'saved' && <span className="ml-1.5 text-xs text-gray-400">{campaigns.length}</span>}
              </button>
            ))}
          </div>
          {tab === 'saved' ? (
            <CampaignList campaigns={campaigns} onCampaignsChange={setCampaigns} onAction={onAction} />
          ) : (
            <NewProjectOptions
              onFileSelect={handleFileSelect}
              onMonobankClick={onMonobank}
              onManualClick={onManual}
              isLoading={isLoading}
            />
          )}
        </>
      ) : (
        <EmptyState
          onFileSelect={handleFileSelect}
          onManualClick={onManual}
          onMonobankClick={onMonobank}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
