import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../context/AppContext';
import { FileUpload } from '../components/upload/FileUpload';
import { PreviewTable } from '../components/upload/PreviewTable';
import { ManualEntryEditor } from '../components/upload/ManualEntryEditor';
import { rawDonationsToManualRows } from '../utils/csvExporter';
import type { ManualRow } from '../types';

type Tab = 'upload' | 'manual';

export function UploadPage() {
  const { t } = useTranslation('upload');
  const { t: tManual } = useTranslation('manual');
  const { state, handleFileSelect, handleProceedToInsights, handleReset, handleManualDataProceed } =
    useAppContext();
  const { app, isLoading } = state;
  const [activeTab, setActiveTab] = useState<Tab>('upload');
  const [editRows, setEditRows] = useState<ManualRow[] | null>(null);

  const invalidRowCount = useMemo(() => {
    if (!app.rawData) return 0;
    return rawDonationsToManualRows(app.rawData).filter((row) => {
      if (!row.date || !row.name) return true;
      const amount = parseFloat(row.amount);
      return !row.amount || isNaN(amount) || amount <= 0;
    }).length;
  }, [app.rawData]);

  console.log(invalidRowCount);

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
