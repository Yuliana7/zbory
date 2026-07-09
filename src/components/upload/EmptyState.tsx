import { useTranslation } from 'react-i18next';
import { HryvniaIcon, EditIcon } from '../../icons';
import { FileUpload } from './FileUpload';

interface EmptyStateProps {
  onFileSelect: (file: File) => void;
  onManualClick: () => void;
  isLoading: boolean;
}

/** First-run screen: no saved campaigns yet, so orient the volunteer with a
 * quick 3-step explainer before the two ways to start. */
export function EmptyState({ onFileSelect, onManualClick, isLoading }: EmptyStateProps) {
  const { t } = useTranslation('upload');
  const steps = t('emptyState.steps', { returnObjects: true }) as string[];

  return (
    <div className="max-w-xl mx-auto text-center animate-fade-in">
      <div className="w-16 h-16 mx-auto mb-5 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-sm">
        <HryvniaIcon className="w-8 h-8" />
      </div>
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{t('title')}</h2>
      <p className="text-gray-600 mb-8">{t('subtitle')}</p>

      <ol className="text-left max-w-sm mx-auto space-y-2.5 mb-8">
        {steps.map((step, i) => (
          <li key={i} className="flex items-center gap-3 text-sm text-gray-700">
            <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>

      <div className="flex flex-col sm:flex-row items-center sm:items-start justify-center gap-3">
        <FileUpload onFileSelect={onFileSelect} isLoading={isLoading} />
        <button onClick={onManualClick} className="btn-secondary flex items-center justify-center gap-2">
          <EditIcon className="w-5 h-5" />
          {t('tabs.manual')}
        </button>
      </div>
    </div>
  );
}
