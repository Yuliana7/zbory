import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../context/AppContext';
import type { CampaignAction } from '../components/upload/CampaignActionsSheet';
import { ProjectPreview } from '../components/upload/ProjectPreview';
import { HomeScreen } from '../components/upload/screens/HomeScreen';
import { GoalScreen } from '../components/upload/screens/GoalScreen';
import { FriendsScreen } from '../components/upload/screens/FriendsScreen';
import { AddCsvScreen } from '../components/upload/screens/AddCsvScreen';
import { ManualEntryEditor } from '../components/upload/ManualEntryEditor';
import { MonobankImport, type MonobankFetchResult } from '../components/upload/MonobankImport';
import { rawDonationsToManualRows } from '../utils/csvExporter';
import { updateRangeStart } from '../utils/monobankApi';
import type { CampaignMeta } from '../utils/campaignStore';
import type { MergeResult } from '../utils/mergeDonations';
import type { ManualRow } from '../types';
import { ArrowLeftIcon, CheckCircleIcon, WarningIcon } from '../icons';

/** 180 → "3 год", 90 → "1 год 30 хв", -5 → "5 хв" (direction doesn't matter to the reader). */
function formatShift(minutes: number): string {
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return [h > 0 ? `${h} год` : '', m > 0 ? `${m} хв` : ''].filter(Boolean).join(' ');
}

/** What «Редагувати» opened a saved project for. Each one is a screen of its own. */
type Focus = 'goal' | 'friends' | 'csv' | 'rows';

/** Step 1 is a small state machine over what app state already says: nothing loaded → the home
 * screen (or one of the ways to start a project); a project loaded → its preview, or the focused
 * screen «Редагувати» asked for. */
export function UploadPage() {
  const { t } = useTranslation('upload');
  const { t: tManual } = useTranslation('manual');
  const { state, handleProceedToInsights, handleReset, handleManualDataProceed, handleMergeFile, handleMergeRows, handleMonobankSource, handleLoadCampaign } =
    useAppContext();
  const { app, isLoading } = state;
  const [editRows, setEditRows] = useState<ManualRow[] | null>(null);
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);
  const [showManual, setShowManual] = useState(false);
  // Monobank API: the import screen, the review table of what it returned, and the
  // screen shown over an already-loaded preview — 'update' refreshes the jar the
  // project came from, 'link' picks a jar for a project that has none yet
  const [showMonobank, setShowMonobank] = useState(false);
  const [monobankRows, setMonobankRows] = useState<ManualRow[] | null>(null);
  const [monobankMerge, setMonobankMerge] = useState<'update' | 'link' | null>(null);
  // «Редагувати» on a saved project opens a focused screen; leaving it without a data change goes
  // back to the project list, whereas a change of data continues on the preview (to review/save)
  const [focus, setFocus] = useState<Focus | null>(null);
  const [fromList, setFromList] = useState(false);

  const invalidRowCount = useMemo(() => {
    if (!app.rawData) return 0;
    return rawDonationsToManualRows(app.rawData).filter((row) => {
      if (!row.date) return true;
      const amount = parseFloat(row.amount);
      return !row.amount || isNaN(amount) || amount <= 0;
    }).length;
  }, [app.rawData]);

  const closeFocus = () => {
    setFocus(null);
    setEditRows(null);
    setMonobankMerge(null);
    if (fromList) {
      setFromList(false);
      handleReset();
    }
  };

  // data changed → the preview takes over (it has «Зберегти зміни»)
  const continueOnPreview = () => {
    setFocus(null);
    setEditRows(null);
    setMonobankMerge(null);
    setFromList(false);
  };

  const handleEditProceed = (rows: ManualRow[]) => {
    handleManualDataProceed(rows);
    continueOnPreview();
  };

  const handleManualProceed = (rows: ManualRow[]) => {
    handleManualDataProceed(rows);
    setShowManual(false);
  };

  const handleMonobankFetched = ({ rows, jar, goal }: MonobankFetchResult) => {
    handleMonobankSource(jar, goal);
    setMonobankRows(rawDonationsToManualRows(rows));
    setShowMonobank(false);
  };

  const handleMonobankReviewProceed = (rows: ManualRow[]) => {
    handleManualDataProceed(rows);
    setMonobankRows(null);
  };

  const handleMonobankReviewCancel = () => {
    handleMonobankSource(undefined);
    setMonobankRows(null);
  };

  const handleMonobankMerged = ({ rows, jar }: MonobankFetchResult) => {
    const result = handleMergeRows(rows, { monobankJar: jar });
    if (result) {
      setMergeResult(result);
      continueOnPreview();
    }
  };

  const handleCsvMerge = async (file: File): Promise<boolean> => {
    const result = await handleMergeFile(file);
    if (result) {
      setMergeResult(result);
      continueOnPreview();
    }
    return !!result;
  };

  // «Редагувати» → an option: load the project, then show the screen for that option. The screen is
  // chosen before the load finishes so the preview never flashes in between.
  const handleCampaignAction = async (campaign: CampaignMeta, action: CampaignAction) => {
    setMergeResult(null);
    setFromList(true);
    if (action === 'monobank') setMonobankMerge(campaign.monobankJar ? 'update' : 'link');
    else setFocus(action === 'edit' ? 'rows' : action === 'csv' ? 'csv' : action);
    const loaded = await handleLoadCampaign(campaign.id);
    if (!loaded) {
      setFocus(null);
      setMonobankMerge(null);
      setFromList(false);
      return;
    }
    if (action === 'edit') setEditRows(rawDonationsToManualRows(loaded.rawData));
  };

  // Editing rows: the table over whatever else would show
  if (editRows) {
    return (
      <div className="py-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 text-center">
          {tManual('editTitle')}
        </h2>
        <ManualEntryEditor
          initialRows={editRows}
          onProceed={handleEditProceed}
          onCancel={closeFocus}
          isLoading={isLoading}
        />
      </div>
    );
  }

  if (app.donations) {
    // a saved project is open for «Редагувати рядки», the table is about to appear
    if (focus === 'rows') return null;

    // Bring newer donations into a loaded project from Monobank
    if (monobankMerge) {
      return (
        <div className="py-8">
          {monobankMerge === 'update' && app.monobankJar ? (
            <MonobankImport
              mode="update"
              jar={app.monobankJar}
              fromDate={app.rawData ? (updateRangeStart(app.rawData) ?? undefined) : undefined}
              onFetched={handleMonobankMerged}
              onCancel={closeFocus}
            />
          ) : (
            <MonobankImport mode="import" onFetched={handleMonobankMerged} onCancel={closeFocus} />
          )}
        </div>
      );
    }

    if (focus === 'goal') return <GoalScreen onDone={closeFocus} />;
    if (focus === 'friends') return <FriendsScreen onDone={closeFocus} />;
    if (focus === 'csv') return <AddCsvScreen onFile={handleCsvMerge} onBack={closeFocus} isLoading={isLoading} />;

    // Preview after file is parsed (upload, manual entry, Monobank)
    return (
      <div className="py-8">
        {mergeResult && (
          <div className="max-w-5xl mx-auto mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800 animate-fade-in flex items-center gap-2">
            <CheckCircleIcon className="w-5 h-5 shrink-0" />
            <div>
              {t('merge.result', { added: mergeResult.added, duplicates: mergeResult.duplicates })}
              {mergeResult.timeShiftMinutes !== null && (
                <p className="mt-1 text-xs text-green-700">
                  {t('merge.timeShift', { shift: formatShift(mergeResult.timeShiftMinutes) })}
                </p>
              )}
            </div>
          </div>
        )}
        {mergeResult?.suspectedOverlap && (
          <div role="alert" className="max-w-5xl mx-auto mb-4 px-4 py-3 bg-amber-50 border border-amber-300 rounded-xl text-sm text-amber-900 animate-fade-in flex items-start gap-2">
            <WarningIcon className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
            {t('merge.suspectedOverlap', { added: mergeResult.added })}
          </div>
        )}
        <ProjectPreview
          donations={app.donations}
          rawData={app.rawData ?? []}
          totalCount={app.donations.length}
          invalidRowCount={invalidRowCount}
          onProceed={handleProceedToInsights}
          onBack={handleReset}
          onEdit={
            app.rawData ? () => setEditRows(rawDonationsToManualRows(app.rawData!)) : undefined
          }
          onMergeFile={handleCsvMerge}
          onMonobank={() => {
            setMonobankMerge(app.monobankJar ? 'update' : 'link');
            setMergeResult(null);
          }}
          monobankJar={app.monobankJar}
          isLoading={isLoading}
          initialGoal={app.goal}
        />
      </div>
    );
  }

  // Review what the Monobank API returned: the same table as manual entry, so rows
  // can be corrected before they go into the normal flow
  if (monobankRows) {
    return (
      <div className="py-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 text-center">{t('monobank.reviewTitle')}</h2>
        <p className="text-sm text-gray-500 mb-6 text-center">{t('monobank.reviewHint')}</p>
        <ManualEntryEditor
          initialRows={monobankRows}
          onProceed={handleMonobankReviewProceed}
          onCancel={handleMonobankReviewCancel}
          isLoading={isLoading}
        />
      </div>
    );
  }

  if (showMonobank) {
    return (
      <div className="py-8">
        <MonobankImport mode="import" onFetched={handleMonobankFetched} onCancel={() => setShowMonobank(false)} />
      </div>
    );
  }

  // Manual entry, opened fresh from the button group / empty state
  if (showManual) {
    return (
      <div className="py-8">
        <div className="max-w-3xl mx-auto mb-4">
          <button
            onClick={() => setShowManual(false)}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            {t('backToOptions')}
          </button>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 text-center">
          {t('manualTitle')}
        </h2>
        <ManualEntryEditor onProceed={handleManualProceed} isLoading={isLoading} />
      </div>
    );
  }

  return (
    <HomeScreen
      onMonobank={() => setShowMonobank(true)}
      onManual={() => setShowManual(true)}
      onAction={handleCampaignAction}
    />
  );
}
