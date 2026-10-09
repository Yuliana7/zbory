import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MonobankJarRef } from '../../../types';
import { GlobeIcon, PlusIcon } from '../../../icons';
import { FileUpload } from '../FileUpload';
import { CollapsibleSection } from './CollapsibleSection';

const OPTION_BUTTON =
  'flex items-center justify-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 border border-dashed ' +
  'border-indigo-300 hover:border-indigo-500 rounded-xl px-4 py-3 transition-colors';

interface AddDataSectionProps {
  monobankJar?: MonobankJarRef;
  /** merge another CSV into the project; resolves true when it went through */
  onMergeFile: (file: File) => Promise<boolean>;
  onMonobank: () => void;
  isLoading: boolean;
  open: boolean;
  onToggle: () => void;
}

/** Bring more donations of the same jar into the project, from a CSV or from Monobank.
 * Rows already in the project are recognised and skipped. */
export function AddDataSection({ monobankJar, onMergeFile, onMonobank, isLoading, open, onToggle }: AddDataSectionProps) {
  const { t } = useTranslation('upload');
  const [pickingFile, setPickingFile] = useState(false);

  return (
    <CollapsibleSection title={t('addData.title')} summary={t('addData.summary')} open={open} onToggle={onToggle}>
      <p className="mb-3 text-sm text-gray-500">{t('addData.description')}</p>
      {pickingFile ? (
        <div className="animate-fade-in">
          <p className="mb-3 text-sm text-gray-600">{t('merge.title')}</p>
          <FileUpload
            onFileSelect={async (file) => {
              if (await onMergeFile(file)) setPickingFile(false);
            }}
            isLoading={isLoading}
          />
          <button
            onClick={() => setPickingFile(false)}
            className="mt-3 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            {t('merge.cancel')}
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <button onClick={() => setPickingFile(true)} className={OPTION_BUTTON}>
            <PlusIcon className="w-4 h-4" />
            {t('merge.button')}
          </button>
          <button onClick={onMonobank} className={OPTION_BUTTON}>
            <GlobeIcon className="w-4 h-4 shrink-0" />
            <span className="truncate">
              {monobankJar ? `${t('monobank.updateButton')} · ${monobankJar.title}` : t('monobank.linkButton')}
            </span>
          </button>
        </div>
      )}
    </CollapsibleSection>
  );
}
