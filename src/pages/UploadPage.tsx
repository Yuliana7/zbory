import { useTranslation } from 'react-i18next';
import { useAppContext } from '../context/AppContext';
import { FileUpload } from '../components/upload/FileUpload';
import { PreviewTable } from '../components/upload/PreviewTable';

export function UploadPage() {
  const { t } = useTranslation('upload');
  const { state, handleFileSelect, handleProceedToInsights, handleReset } = useAppContext();
  const { app, isLoading } = state;

  if (app.donations) {
    return (
      <div className="py-8">
        <PreviewTable
          donations={app.donations}
          totalCount={app.donations.length}
          onProceed={handleProceedToInsights}
          onCancel={handleReset}
        />
      </div>
    );
  }

  return (
    <div className="text-center py-12 sm:py-20">
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">{t('title')}</h2>
      <p className="text-gray-600 mb-8">{t('subtitle')}</p>
      <FileUpload onFileSelect={handleFileSelect} isLoading={isLoading} />
    </div>
  );
}
