import { useState, useRef, ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { isValidCSVFile, formatFileSize } from '../../utils/csvParser';
import { SpinnerIcon, UploadIcon } from '../../icons';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isLoading?: boolean;
}

/** A single upload button — most users are on mobile, where drag-and-drop
 * doesn't apply, so this just opens the native file picker. */
export function FileUpload({ onFileSelect, isLoading = false }: FileUploadProps) {
  const { t } = useTranslation('upload');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = e.target.files;
    if (files && files.length > 0) handleFile(files[0]);
    e.target.value = '';
  };

  const handleFile = (file: File) => {
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(t('errors.tooLarge', { size: formatFileSize(maxSize) }));
      return;
    }
    if (!isValidCSVFile(file)) {
      setError(t('errors.invalidType'));
      return;
    }
    onFileSelect(file);
  };

  const handleClick = () => fileInputRef.current?.click();

  return (
    <div className="flex flex-col items-center sm:items-stretch">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv,application/vnd.ms-excel"
        onChange={handleFileInputChange}
        className="hidden"
        disabled={isLoading}
      />

      <button onClick={handleClick} disabled={isLoading} className="btn-primary flex items-center justify-center gap-2">
        {isLoading ? (
          <>
            <SpinnerIcon className="w-5 h-5 animate-spin" />
            {t('dropzone.processing')}
          </>
        ) : (
          <>
            <UploadIcon className="w-5 h-5" />
            {t('dropzone.button')}
          </>
        )}
      </button>

      {error && <p className="mt-2 text-xs text-red-600 text-center">{error}</p>}
    </div>
  );
}
