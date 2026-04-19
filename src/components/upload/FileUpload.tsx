import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { isValidCSVFile, formatFileSize } from '../../utils/csvParser';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isLoading?: boolean;
}

export function FileUpload({ onFileSelect, isLoading = false }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setError(null);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFile = (file: File) => {
    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      setError(`Файл занадто великий. Максимальний розмір: ${formatFileSize(maxSize)}`);
      return;
    }

    // Validate file type
    if (!isValidCSVFile(file)) {
      setError('Будь ласка, оберіть CSV файл');
      return;
    }

    onFileSelect(file);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div
        className={`
          border-2 border-dashed rounded-xl p-12
          transition-all duration-200 cursor-pointer
          ${isDragging
            ? 'border-indigo-500 bg-indigo-50'
            : 'border-gray-300 hover:border-indigo-400 bg-white'
          }
          ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
          ${error ? 'border-red-300 bg-red-50' : ''}
        `}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={isLoading ? undefined : handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv,application/vnd.ms-excel"
          onChange={handleFileInputChange}
          className="hidden"
          disabled={isLoading}
        />

        <div className="text-center">
          {isLoading ? (
            <>
              <div className="mx-auto h-12 w-12 text-indigo-600 animate-spin">
                <svg className="w-full h-full" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
              <p className="mt-4 text-sm font-medium text-indigo-600">
                Обробка файлу...
              </p>
            </>
          ) : (
            <>
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              <p className="mt-4 text-base text-gray-700">
                <span className="font-medium">Перетягніть файл сюди</span> або клацніть для вибору
              </p>

              <p className="mt-2 text-sm text-gray-500">
                CSV файли до 50 MB
              </p>

              {error && (
                <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="mt-6 text-center">
        <details className="mt-2">
          <summary className="text-xs text-indigo-600 cursor-pointer hover:text-indigo-700">
            Де знайти файл виписки?
          </summary>
          <div className="mt-2 text-xs text-gray-600 text-left max-w-lg mx-auto bg-gray-50 p-4 rounded-lg">
            <ol className="list-decimal list-inside space-y-1">
              <li>Відкрийте додаток Monobank</li>
              <li>Перейдіть до вашої Банки (Jar)</li>
              <li>Натисніть на "⋮" (три крапки)</li>
              <li>Оберіть "Виписка"</li>
              <li>Оберіть період та формат CSV</li>
              <li>Завантажте файл</li>
            </ol>
          </div>
        </details>
      </div>
    </div>
  );
}