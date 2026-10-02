import { useTranslation } from 'react-i18next';
import { EditIcon, GlobeIcon } from '../../icons';
import { FileUpload } from './FileUpload';

interface NewProjectOptionsProps {
  onFileSelect: (file: File) => void;
  onMonobankClick: () => void;
  onManualClick: () => void;
  isLoading: boolean;
}

/** The three ways to start a new project, each with a line on when to use it. */
export function NewProjectOptions({ onFileSelect, onMonobankClick, onManualClick, isLoading }: NewProjectOptionsProps) {
  const { t } = useTranslation('upload');
  return (
    <div className="max-w-md mx-auto space-y-5">
      <div>
        <FileUpload onFileSelect={onFileSelect} isLoading={isLoading} fullWidth />
        <p className="mt-1.5 text-xs text-gray-500 text-center">{t('newOptions.csvHint')}</p>
      </div>
      <div>
        <button onClick={onMonobankClick} className="btn-secondary w-full flex items-center justify-center gap-2">
          <GlobeIcon className="w-5 h-5" />
          {t('monobank.button')}
        </button>
        <p className="mt-1.5 text-xs text-gray-500 text-center">{t('newOptions.apiHint')}</p>
      </div>
      <div>
        <button onClick={onManualClick} className="btn-secondary w-full flex items-center justify-center gap-2">
          <EditIcon className="w-5 h-5" />
          {t('tabs.manual')}
        </button>
        <p className="mt-1.5 text-xs text-gray-500 text-center">{t('newOptions.manualHint')}</p>
      </div>
    </div>
  );
}
