import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../context/AppContext';
import type { CampaignAction } from '../components/upload/CampaignActionsSheet';
import { HomeScreen } from '../components/upload/screens/HomeScreen';
import { GoalScreen } from '../components/upload/screens/GoalScreen';
import { FriendsScreen } from '../components/upload/screens/FriendsScreen';
import { AddCsvScreen } from '../components/upload/screens/AddCsvScreen';
import { RenameScreen } from '../components/upload/screens/RenameScreen';
import { RafflesScreen } from '../components/upload/screens/RafflesScreen';
import { ManualEntryEditor } from '../components/upload/ManualEntryEditor';
import { MonobankImport, type MonobankFetchResult } from '../components/upload/MonobankImport';
import { downloadCSV, manualRowsToCSVString, rawDonationsToManualRows } from '../utils/csvExporter';
import { loadCampaignData, type CampaignMeta } from '../utils/campaignStore';
import type { ManualRow } from '../types';
import { ArrowLeftIcon } from '../icons';

/** What «Редагувати» opened a saved project for. Each one is a screen of its own. */
type Focus = 'goal' | 'friends' | 'raffles' | 'csv' | 'rows' | 'rename' | 'link';

/** Step 1: the saved projects, the ways to start a new one, and the focused screens «Редагувати»
 * opens. Whatever brings data in saves it and moves on to the analytics, so there is no stop in between. */
export function UploadPage() {
  const { t } = useTranslation('upload');
  const { t: tManual } = useTranslation('manual');
  const { state, dispatch, handleReset, handleManualDataProceed, handleMergeFile, handleMergeRows, handleMonobankProject, handleLoadCampaign } = useAppContext();
  const { app, isLoading } = state;
  const [editRows, setEditRows] = useState<ManualRow[] | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [showMonobank, setShowMonobank] = useState(false);
  const [focus, setFocus] = useState<Focus | null>(null);

  // leaving a focused screen without a change of data: back to the list
  const closeFocus = () => {
    setFocus(null);
    setEditRows(null);
    handleReset();
  };

  const handleCsvMerge = async (file: File): Promise<boolean> => !!(await handleMergeFile(file));

  const handleLinked = async ({ rows, jar }: MonobankFetchResult) => {
    await handleMergeRows(rows, { monobankJar: jar, syncedAt: Date.now() });
  };

  const handleNewFromMonobank = async ({ rows, jar, goal }: MonobankFetchResult) => {
    await handleMonobankProject(rows, jar, goal);
  };

  // «Редагувати» → an option: load the project, then show the screen for that option. The screen is
  // chosen before the load finishes so nothing else flashes in between.
  const handleCampaignAction = async (campaign: CampaignMeta, action: CampaignAction) => {
    if (action === 'download') {
      const data = await loadCampaignData(campaign.id);
      if (data) await downloadCSV(manualRowsToCSVString(rawDonationsToManualRows(data.rawData)), `${campaign.name}.csv`);
      return;
    }
    if (action === 'monobank' && campaign.monobankJar) {
      // a linked jar renews right on the analytics
      const loaded = await handleLoadCampaign(campaign.id, { proceed: true });
      if (loaded) dispatch({ type: 'RENEW_REQUESTED', payload: true });
      return;
    }
    setFocus(action === 'monobank' ? 'link' : action === 'edit' ? 'rows' : action);
    const loaded = await handleLoadCampaign(campaign.id);
    if (!loaded) {
      setFocus(null);
      return;
    }
    if (action === 'edit') setEditRows(rawDonationsToManualRows(loaded.rawData));
  };

  if (editRows) {
    return (
      <div className="py-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 text-center">{tManual('editTitle')}</h2>
        <ManualEntryEditor initialRows={editRows} onProceed={(rows) => handleManualDataProceed(rows)} onCancel={closeFocus} isLoading={isLoading} />
      </div>
    );
  }

  if (app.donations) {
    // opened from the analytics: «Готово» / «Назад» return there
    if (app.friendsEdit) {
      return <FriendsScreen onDone={() => dispatch({ type: 'FRIENDS_EDIT_DONE' })} backLabel={t('focus.backToAnalytics')} />;
    }
    if (app.rafflesEdit) {
      return <RafflesScreen onDone={() => dispatch({ type: 'RAFFLES_EDIT_DONE' })} backLabel={t('focus.backToAnalytics')} />;
    }
    if (focus === 'link') {
      return (
        <div className="py-8">
          <MonobankImport onFetched={handleLinked} onCancel={closeFocus} />
        </div>
      );
    }
    if (focus === 'goal') return <GoalScreen onDone={closeFocus} />;
    if (focus === 'friends') return <FriendsScreen onDone={closeFocus} />;
    if (focus === 'raffles') return <RafflesScreen onDone={closeFocus} />;
    if (focus === 'rename') return <RenameScreen onDone={closeFocus} />;
    if (focus === 'csv') return <AddCsvScreen onFile={handleCsvMerge} onBack={closeFocus} isLoading={isLoading} />;
    return null; // a project is loading into a focused screen
  }

  if (showMonobank) {
    return (
      <div className="py-8">
        <MonobankImport onFetched={handleNewFromMonobank} onCancel={() => setShowMonobank(false)} />
      </div>
    );
  }

  if (showManual) {
    return (
      <div className="py-8">
        <div className="max-w-3xl mx-auto mb-4">
          <button onClick={() => setShowManual(false)} className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800">
            <ArrowLeftIcon className="w-4 h-4" />
            {t('backToOptions')}
          </button>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 text-center">{t('manualTitle')}</h2>
        <ManualEntryEditor onProceed={(rows) => handleManualDataProceed(rows)} isLoading={isLoading} />
      </div>
    );
  }

  return <HomeScreen onMonobank={() => setShowMonobank(true)} onManual={() => setShowManual(true)} onAction={handleCampaignAction} />;
}
