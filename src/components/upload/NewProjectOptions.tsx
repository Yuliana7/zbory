import { useTranslation } from 'react-i18next';
import { EditIcon, GlobeIcon } from '../../icons';
import { FileUpload } from './FileUpload';
import { AddJarByLink } from '../ownJars/AddJarByLink';

interface NewProjectOptionsProps {
  onFileSelect: (file: File) => void;
  onMonobankClick: () => void;
  onManualClick: () => void;
  isLoading: boolean;
  /** a friendly jar was added by its link */
  onLinkAdded: () => void;
}

/** «Додати банку»: every way a jar comes in, each with a line on when to use it. Monobank brings all the
 * user's jars, main and friendly; a file or the table make a main jar; a link adds a friendly jar. */
export function NewProjectOptions({ onFileSelect, onMonobankClick, onManualClick, isLoading, onLinkAdded }: NewProjectOptionsProps) {
  const { t } = useTranslation('upload');
  return (
    <div className="max-w-md mx-auto space-y-5">
      <div>
        <button onClick={onMonobankClick} className="btn-primary w-full flex items-center justify-center gap-2">
          <GlobeIcon className="w-5 h-5" />
          {t('monobank.button')}
        </button>
        <p className="mt-1.5 text-xs text-gray-500 text-center">{t('newOptions.apiHint')}</p>
      </div>
      <div>
        <FileUpload onFileSelect={onFileSelect} isLoading={isLoading} fullWidth />
        <p className="mt-1.5 text-xs text-gray-500 text-center">{t('newOptions.csvHint')}</p>
      </div>
      <div>
        <button onClick={onManualClick} className="btn-secondary w-full flex items-center justify-center gap-2">
          <EditIcon className="w-5 h-5" />
          {t('tabs.manual')}
        </button>
        <p className="mt-1.5 text-xs text-gray-500 text-center">{t('newOptions.manualHint')}</p>
      </div>
      <div className="border-t border-gray-200 pt-5">
        <p className="mb-2 text-sm font-semibold text-gray-900 text-center">{t('newOptions.linkTitle')}</p>
        <AddJarByLink onAdded={onLinkAdded} />
        <p className="mt-1.5 text-xs text-gray-500 text-center">{t('newOptions.linkHint')}</p>
      </div>
    </div>
  );
}
