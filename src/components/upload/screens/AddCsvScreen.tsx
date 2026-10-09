import { useTranslation } from 'react-i18next';
import { FileUpload } from '../FileUpload';
import { ScreenShell } from './ScreenShell';

/** «Змінити» → «Додати CSV-виписку»: pick a file to merge into the project. */
export function AddCsvScreen({
  onFile,
  onBack,
  isLoading,
}: {
  /** resolves true when the merge went through */
  onFile: (file: File) => Promise<boolean>;
  onBack: () => void;
  isLoading: boolean;
}) {
  const { t } = useTranslation('upload');
  return (
    <ScreenShell title={t('merge.button')} backLabel={t('focus.back')} onBack={onBack}>
      <p className="mb-4 text-sm text-gray-600">{t('addData.description')}</p>
      <FileUpload onFileSelect={(file) => void onFile(file)} isLoading={isLoading} />
    </ScreenShell>
  );
}
