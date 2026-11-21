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
import { TopAction } from '../../TopAction';

interface HomeScreenProps {
  onMonobank: () => void;
  onManual: () => void;
  onAction: (campaign: CampaignMeta, action: CampaignAction) => void;
}

const SECTION = 'mb-3 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500';

/** «Активні»: the autosave restore offer, «Додати банку» on top, then the active main jars and the user's
 * own friendly jars, each in its own section. Closed ones live in the archive. A first run with nothing
 * saved shows just the ways to start. */
export function HomeScreen({ onMonobank, onManual, onAction }: HomeScreenProps) {
  const { t } = useTranslation('upload');
  const { state, handleFileSelect, handleRestoreSession } = useAppContext();
  const { app, isLoading } = state;
  const [savedSession, setSavedSession] = useState(() => loadSession());
  // «Додати банку»: the ways a jar comes in, in place of the lists
  const [adding, setAdding] = useState(false);

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
  // «Додати банку»: the same ways in from either view; a jar added by link lands in the friendly jars
  const options = (
    <NewProjectOptions
      onFileSelect={handleFileSelect}
      onMonobankClick={onMonobank}
      onManualClick={onManual}
      isLoading={isLoading}
      onLinkAdded={() => {
        loadOwnJars();
        setAdding(false);
      }}
    />
  );
  const hasAnything = loaded && (campaigns.length > 0 || ownJars.length > 0);

  return (
    <div className="pb-8">
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

      {!loaded ? null : adding ? (
        <div className="max-w-md mx-auto">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-gray-900">{t('addJarTitle')}</h2>
            <button onClick={() => setAdding(false)} className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800">
              <ArrowLeftIcon className="w-4 h-4" />
              {t('addJarBack')}
            </button>
          </div>
          {options}
        </div>
      ) : hasAnything ? (
        // one screen: «Додати банку» on top, then the main jars and the user's own friendly jars apart
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="flex justify-end">
            <TopAction onClick={() => setAdding(true)} label={t('addJarTitle')} />
          </div>
          {campaigns.length > 0 && (
            <section aria-labelledby="home-main">
              <h3 id="home-main" className={SECTION}>
                {t('view.saved')}
              </h3>
              <CampaignList campaigns={campaigns} onCampaignsChange={setCampaigns} onAction={onAction} />
            </section>
          )}
          {ownJars.length > 0 && (
            <section aria-labelledby="home-own">
              <h3 id="home-own" className={SECTION}>
                {t('view.own')}
              </h3>
              <OwnJarsTab jars={ownJars} onJarsChange={setOwnJars} />
            </section>
          )}
        </div>
      ) : (
        <EmptyState options={options} />
      )}
      {loaded && <BackupControls hasProjects={hasAnything} onRestored={(all) => setCampaigns(all.filter((c) => !isArchived(c)))} onJarsRestored={loadOwnJars} />}
    </div>
  );
}
