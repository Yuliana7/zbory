import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../context/AppContext';
import { FileUpload } from '../components/upload/FileUpload';
import { PreviewTable } from '../components/upload/PreviewTable';
import { CampaignList } from '../components/upload/CampaignList';
import { EmptyState } from '../components/upload/EmptyState';
import { ManualEntryEditor } from '../components/upload/ManualEntryEditor';
import { rawDonationsToManualRows } from '../utils/csvExporter';
import { loadSession, clearSession } from '../utils/session';
import { listCampaigns, type CampaignMeta } from '../utils/campaignStore';
import type { MergeResult } from '../utils/mergeDonations';
import type { ManualRow } from '../types';
import { ArrowLeftIcon, CheckCircleIcon, EditIcon, PlusIcon, SaveIcon, XIcon } from '../icons';

export function UploadPage() {
  const { t } = useTranslation('upload');
  const { t: tManual } = useTranslation('manual');
  const { state, handleFileSelect, handleProceedToInsights, handleReset, handleManualDataProceed, handleRestoreSession, handleMergeFile } =
    useAppContext();
  const { app, isLoading } = state;
  const [editRows, setEditRows] = useState<ManualRow[] | null>(null);
  const [savedSession, setSavedSession] = useState(() => loadSession());
  const [showMerge, setShowMerge] = useState(false);
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);
  const [showManual, setShowManual] = useState(false);
  // null = not loaded yet (avoids flashing the empty state before we know)
  const [campaigns, setCampaigns] = useState<CampaignMeta[] | null>(null);

  useEffect(() => {
    listCampaigns().then(setCampaigns).catch(() => setCampaigns([]));
  }, []);

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

  // Preview after file is parsed (upload or manual entry)
  if (app.donations) {
    return (
      <div className="py-8">
        {mergeResult && (
          <div className="max-w-5xl mx-auto mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800 animate-fade-in flex items-center gap-2">
            <CheckCircleIcon className="w-5 h-5 shrink-0" />
            {t('merge.result', { added: mergeResult.added, duplicates: mergeResult.duplicates })}
          </div>
        )}
        <PreviewTable
          donations={app.donations}
          totalCount={app.donations.length}
          invalidRowCount={invalidRowCount}
          onProceed={handleProceedToInsights}
          onCancel={handleReset}
          onEdit={app.rawData ? handleStartEdit : undefined}
          initialGoal={app.goal}
        />
        {/* Merge another export of the same jar into the loaded dataset */}
        <div className="max-w-5xl mx-auto mt-6 text-center">
          {showMerge ? (
            <div className="animate-fade-in">
              <p className="text-sm text-gray-600 mb-4">{t('merge.title')}</p>
              <FileUpload
                onFileSelect={async (file) => {
                  const result = await handleMergeFile(file);
                  if (result) {
                    setMergeResult(result);
                    setShowMerge(false);
                  }
                }}
                isLoading={isLoading}
              />
              <button
                onClick={() => setShowMerge(false)}
                className="mt-3 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
              >
                {t('merge.cancel')}
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setShowMerge(true);
                setMergeResult(null);
              }}
              className="flex items-center gap-1.5 mx-auto text-sm font-medium text-indigo-600 hover:text-indigo-800 border border-dashed border-indigo-300
                         hover:border-indigo-500 rounded-xl px-4 py-2 transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              {t('merge.button')}
            </button>
          )}
        </div>
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
          <CampaignList campaigns={campaigns} onCampaignsChange={setCampaigns} />
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-1">
              {t('addNew.title')}
            </p>
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3">
              <FileUpload onFileSelect={handleFileSelect} isLoading={isLoading} />
              <button onClick={() => setShowManual(true)} className="btn-secondary flex items-center justify-center gap-2">
                <EditIcon className="w-4 h-4" />
                {t('tabs.manual')}
              </button>
            </div>
          </div>
        </>
      ) : (
        <EmptyState onFileSelect={handleFileSelect} onManualClick={() => setShowManual(true)} isLoading={isLoading} />
      )}
    </div>
  );
}
