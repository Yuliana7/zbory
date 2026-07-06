import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../context/AppContext';
import { FileUpload } from '../components/upload/FileUpload';
import { PreviewTable } from '../components/upload/PreviewTable';
import { ManualEntryEditor } from '../components/upload/ManualEntryEditor';
import { rawDonationsToManualRows } from '../utils/csvExporter';
import { loadSession, clearSession } from '../utils/session';
import type { ManualRow } from '../types';

type Tab = 'upload' | 'manual';

export function UploadPage() {
  const { t } = useTranslation('upload');
  const { t: tManual } = useTranslation('manual');
  const { state, handleFileSelect, handleProceedToInsights, handleReset, handleManualDataProceed, handleRestoreSession } =
    useAppContext();
  const { app, isLoading } = state;
  const [activeTab, setActiveTab] = useState<Tab>('upload');
  const [editRows, setEditRows] = useState<ManualRow[] | null>(null);
  const [savedSession, setSavedSession] = useState(() => loadSession());

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
        <PreviewTable
          donations={app.donations}
          totalCount={app.donations.length}
          invalidRowCount={invalidRowCount}
          onProceed={handleProceedToInsights}
          onCancel={handleReset}
          onEdit={app.rawData ? handleStartEdit : undefined}
        />
      </div>
    );
  }

  // Default: tab switcher
  return (
    <div className="py-8 sm:py-12">
      {/* Restore autosaved session */}
      {savedSession && (
        <div className="max-w-xl mx-auto mb-8 flex items-center gap-3 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl animate-fade-in">
          <span className="text-xl leading-none">💾</span>
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
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex justify-center mb-8">
        <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1 gap-1">
          {(['upload', 'manual'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-white text-indigo-700 shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t(`tabs.${tab}`)}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'upload' && (
        <div className="text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">{t('title')}</h2>
          <p className="text-gray-600 mb-8">{t('subtitle')}</p>
          <FileUpload onFileSelect={handleFileSelect} isLoading={isLoading} />
        </div>
      )}

      {activeTab === 'manual' && (
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 text-center">
            {t('manualTitle')}
          </h2>
          <ManualEntryEditor onProceed={handleManualDataProceed} isLoading={isLoading} />
        </div>
      )}
    </div>
  );
}
