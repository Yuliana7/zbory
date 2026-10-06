import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../context/AppContext';
import { NewProjectOptions } from '../components/upload/NewProjectOptions';
import type { CampaignAction } from '../components/upload/CampaignActionsSheet';
import { ProjectPreview } from '../components/upload/ProjectPreview';
import { CampaignList } from '../components/upload/CampaignList';
import { EmptyState } from '../components/upload/EmptyState';
import { ManualEntryEditor } from '../components/upload/ManualEntryEditor';
import { MonobankImport, type MonobankFetchResult } from '../components/upload/MonobankImport';
import { rawDonationsToManualRows } from '../utils/csvExporter';
import { loadSession, clearSession } from '../utils/session';
import { updateRangeStart } from '../utils/monobankApi';
import { setSectionHash, type SectionId } from '../utils/sectionAnchors';
import { listCampaigns, type CampaignMeta } from '../utils/campaignStore';
import type { MergeResult } from '../utils/mergeDonations';
import type { ManualRow } from '../types';
import { ArrowLeftIcon, CheckCircleIcon, SaveIcon, WarningIcon, XIcon } from '../icons';

/** 180 → "3 год", 90 → "1 год 30 хв", -5 → "5 хв" (direction doesn't matter to the reader). */
function formatShift(minutes: number): string {
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return [h > 0 ? `${h} год` : '', m > 0 ? `${m} хв` : ''].filter(Boolean).join(' ');
}

export function UploadPage() {
  const { t } = useTranslation('upload');
  const { t: tManual } = useTranslation('manual');
  const { state, handleFileSelect, handleProceedToInsights, handleReset, handleManualDataProceed, handleRestoreSession, handleMergeFile, handleMergeRows, handleMonobankSource, handleLoadCampaign } =
    useAppContext();
  const { app, isLoading } = state;
  const [editRows, setEditRows] = useState<ManualRow[] | null>(null);
  const [savedSession, setSavedSession] = useState(() => loadSession());
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);
  const [showManual, setShowManual] = useState(false);
  // Step 1 has two views: the saved projects and the ways to start a new one
  const [tab, setTab] = useState<'saved' | 'new'>('saved');
  // Monobank API: the import screen, the review table of what it returned, and the
  // screen shown over an already-loaded preview — 'update' refreshes the jar the
  // project came from, 'link' picks a jar for a project that has none yet
  const [showMonobank, setShowMonobank] = useState(false);
  const [monobankRows, setMonobankRows] = useState<ManualRow[] | null>(null);
  const [monobankMerge, setMonobankMerge] = useState<'update' | 'link' | null>(null);
  // null = not loaded yet (avoids flashing the empty state before we know)
  const [campaigns, setCampaigns] = useState<CampaignMeta[] | null>(null);

  // UploadPage doesn't unmount between "preview" and "default" (both are just
  // branches of this same component while app.step stays 'upload') — so a
  // campaign saved from the preview screen wouldn't show up on cancel without
  // this refetch. Re-running whenever donations clear covers both that path
  // and the initial mount, matching the fresh listCampaigns() a real remount
  // (e.g. coming back via Insights → "Назад") already gets for free.
  useEffect(() => {
    if (app.donations) return;
    listCampaigns().then(setCampaigns).catch(() => setCampaigns([]));
  }, [app.donations]);

  const invalidRowCount = useMemo(() => {
    if (!app.rawData) return 0;
    return rawDonationsToManualRows(app.rawData).filter((row) => {
      if (!row.date) return true;
      const amount = parseFloat(row.amount);
      return !row.amount || isNaN(amount) || amount <= 0;
    }).length;
  }, [app.rawData]);

  const handleStartEdit = () => {
    if (!app.rawData) return;
    setEditRows(rawDonationsToManualRows(app.rawData));
  };

  const handleCancelEdit = () => setEditRows(null);

  const handleEditProceed = (rows: ManualRow[]) => {
    handleManualDataProceed(rows);
    setEditRows(null);
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
      setMonobankMerge(null);
    }
  };

  // «Змінити» on a saved project: open it on the preview, already scrolled to the section for
  // the chosen option (the URL hash names it). Whatever the option, the changes that follow
  // are saved from the preview with «Зберегти зміни».
  const SECTION_FOR_ACTION: Record<CampaignAction, SectionId> = {
    edit: 'preview',
    csv: 'add-data',
    monobank: 'add-data',
    details: 'goal',
  };
  const handleCampaignAction = async (campaign: CampaignMeta, action: CampaignAction) => {
    setSectionHash(SECTION_FOR_ACTION[action]);
    const loaded = await handleLoadCampaign(campaign.id);
    if (!loaded) return;
    setMergeResult(null);
  };

  // Edit mode: overlay the editor over whatever else would show
  if (editRows) {
    return (
      <div className="py-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 text-center">
          {tManual('editTitle')}
        </h2>
        <ManualEntryEditor
          initialRows={editRows}
          onProceed={handleEditProceed}
          onCancel={handleCancelEdit}
          isLoading={isLoading}
        />
      </div>
    );
  }

  // Bring newer donations into a loaded project from Monobank
  if (app.donations && monobankMerge) {
    return (
      <div className="py-8">
        {monobankMerge === 'update' && app.monobankJar ? (
          <MonobankImport
            mode="update"
            jar={app.monobankJar}
            fromDate={app.rawData ? (updateRangeStart(app.rawData) ?? undefined) : undefined}
            onFetched={handleMonobankMerged}
            onCancel={() => setMonobankMerge(null)}
          />
        ) : (
          <MonobankImport mode="import" onFetched={handleMonobankMerged} onCancel={() => setMonobankMerge(null)} />
        )}
      </div>
    );
  }

  // Preview after file is parsed (upload or manual entry)
  if (app.donations) {
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
          onEdit={app.rawData ? handleStartEdit : undefined}
          onMergeFile={async (file) => {
            const result = await handleMergeFile(file);
            if (result) setMergeResult(result);
            return !!result;
          }}
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

  // Default: saved campaigns (if any) go first, with a compact way to add a
  // new one below; first-run volunteers with no saved campaigns get a
  // welcoming empty state with a short explainer instead.
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
            <p className="text-xs text-indigo-500 mt-0.5">
              {new Date(savedSession.savedAt).toLocaleString('uk-UA')}
            </p>
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
            <CampaignList campaigns={campaigns} onCampaignsChange={setCampaigns} onAction={handleCampaignAction} />
          ) : (
            <NewProjectOptions
              onFileSelect={handleFileSelect}
              onMonobankClick={() => setShowMonobank(true)}
              onManualClick={() => setShowManual(true)}
              isLoading={isLoading}
            />
          )}
        </>
      ) : (
        <EmptyState
          onFileSelect={handleFileSelect}
          onManualClick={() => setShowManual(true)}
          onMonobankClick={() => setShowMonobank(true)}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
