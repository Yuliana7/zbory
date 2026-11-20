import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../../context/AppContext';
import { NewProjectOptions } from '../NewProjectOptions';
import type { CampaignAction } from '../CampaignActionsSheet';
import { CampaignList } from '../CampaignList';
import { EmptyState } from '../EmptyState';
import { BackupControls } from '../BackupControls';
import { loadSession, clearSession } from '../../../utils/session';
import { listCampaigns, type CampaignMeta } from '../../../utils/campaignStore';
import { listOwnJars } from '../../../utils/ownJars';
import type { OwnJar } from '../../../types';
import { OwnJarsTab } from '../../ownJars/OwnJarsTab';
import { isArchived } from '../../../utils/archive';
import { ArrowLeftIcon, SaveIcon, XIcon } from '../../../icons';

type HomeTab = 'saved' | 'own';
const TAB_KEY = 'zbory.homeTab';
/** null = nothing chosen this visit yet */
const readTab = (): HomeTab | null => {
  try {
    const v = sessionStorage.getItem(TAB_KEY);
    return v === 'own' || v === 'saved' ? v : null;
  } catch {
    return null;
  }
};

interface HomeScreenProps {
  onMonobank: () => void;
  onManual: () => void;
  onAction: (campaign: CampaignMeta, action: CampaignAction) => void;
}

/** Step 1's front page: the autosave restore offer, then the active projects (with «Новий збір» among
 * them) and the user's own friendly jars. Closed ones live in the archive. A first run with nothing
 * saved shows just the ways to start. */
export function HomeScreen({ onMonobank, onManual, onAction }: HomeScreenProps) {
  const { t } = useTranslation('upload');
  const { state, handleFileSelect, handleRestoreSession } = useAppContext();
  const { app, isLoading } = state;
  const [savedSession, setSavedSession] = useState(() => loadSession());
  // Step 1 has two views: the projects and the user's own friendly jars. The view is remembered for
  // the visit, so coming back from a jar's cards lands on the jars.
  const [tab, setTabState] = useState<HomeTab | null>(readTab);
  // «Новий збір» in the projects view: the ways to start one, in place of the list
  const [adding, setAdding] = useState(false);
  const setTab = (next: HomeTab) => {
    setTabState(next);
    try {
      sessionStorage.setItem(TAB_KEY, next);
    } catch {
      /* only the memory of the tab is lost */
    }
  };
  // null = not loaded yet (avoids flashing the empty state before we know)
  const [campaigns, setCampaigns] = useState<CampaignMeta[] | null>(null);
  const [ownJars, setOwnJars] = useState<OwnJar[] | null>(null);
  const loadOwnJars = () => listOwnJars().then((all) => setOwnJars(all.filter((j) => !isArchived(j)))).catch(() => setOwnJars([]));

  // The lists are refetched whenever the loaded data clears (coming back from a project, saving
  // one from the preview), and on the first mount.
  useEffect(() => {
    if (app.donations) return;
    listCampaigns().then((all) => setCampaigns(all.filter((c) => !isArchived(c)))).catch(() => setCampaigns([]));
    loadOwnJars();
  }, [app.donations]);

  const loaded = campaigns !== null && ownJars !== null;
  const hasAnything = loaded && (campaigns.length > 0 || ownJars.length > 0);
  // until a view is picked: with no projects yet the jars are what there is to show
  const shownTab: HomeTab = tab ?? (loaded && campaigns.length === 0 && ownJars.length > 0 ? 'own' : 'saved');

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
            onClick={async () => {
              if (!(await handleRestoreSession())) {
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

      {!loaded ? null : hasAnything || tab === 'own' ? (
        <>
          <div role="tablist" className="max-w-lg mx-auto mb-8 flex p-1 bg-gray-100 rounded-xl">
            {(['saved', 'own'] as const).map((key) => (
              <button
                key={key}
                role="tab"
                aria-selected={shownTab === key}
                onClick={() => setTab(key)}
                className={`flex-1 px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium leading-tight transition-colors ${
                  shownTab === key ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t(`view.${key}`)}
                {key === 'saved' && campaigns.length > 0 && <span className="ml-1 text-xs text-gray-400">{campaigns.length}</span>}
                {key === 'own' && ownJars.length > 0 && <span className="ml-1 text-xs text-gray-400">{ownJars.length}</span>}
              </button>
            ))}
          </div>
          {shownTab === 'own' ? (
            <OwnJarsTab jars={ownJars} onJarsChange={setOwnJars} />
          ) : campaigns.length > 0 && !adding ? (
            <CampaignList campaigns={campaigns} onCampaignsChange={setCampaigns} onAction={onAction} onNew={() => setAdding(true)} />
          ) : (
            <>
              {campaigns.length > 0 && (
                <div className="max-w-3xl mx-auto mb-2">
                  <button onClick={() => setAdding(false)} className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800">
                    <ArrowLeftIcon className="w-4 h-4" />
                    {t('view.saved')}
                  </button>
                </div>
              )}
              <NewProjectOptions
                onFileSelect={handleFileSelect}
                onMonobankClick={onMonobank}
                onManualClick={onManual}
                isLoading={isLoading}
              />
            </>
          )}
        </>
      ) : (
        <EmptyState
          onFileSelect={handleFileSelect}
          onManualClick={onManual}
          onMonobankClick={onMonobank}
          onOwnJarsClick={() => setTab('own')}
          isLoading={isLoading}
        />
      )}
      {loaded && <BackupControls hasProjects={hasAnything} onRestored={setCampaigns} onJarsRestored={loadOwnJars} />}
    </div>
  );
}
