import { useRef, useState, useLayoutEffect } from 'react';
import type { Aggregates, Insight, TemplateType } from '../../types';
import { ProgressCard } from '../templates/ProgressCard';
import { DailyActivityCard } from '../templates/DailyActivityCard';
import { ThankYouCard } from '../templates/ThankYouCard';
import { exportToPNG } from '../../utils/exportPNG';

interface ExportScreenProps {
  templateId: TemplateType;
  aggregates: Aggregates;
  insights: Insight[];
  onBack: () => void;
}

const TEMPLATE_DIMS: Record<TemplateType, { width: number; height: number; label: string }> = {
  progress: { width: 1080, height: 1080, label: 'Пост 1:1 • 1080×1080' },
  'daily-activity': { width: 1080, height: 1920, label: 'Сторіс 9:16 • 1080×1920' },
  'thank-you': { width: 1080, height: 1080, label: 'Пост 1:1 • 1080×1080' },
};

const TEMPLATE_NAMES: Record<TemplateType, string> = {
  progress: 'Картка прогресу',
  'daily-activity': 'Активність за днями',
  'thank-you': 'Подяка донатерам',
};

export function ExportScreen({ templateId, aggregates, insights, onBack }: ExportScreenProps) {
  const templateRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [goal, setGoal] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const dims = TEMPLATE_DIMS[templateId];
  const goalValue = goal ? parseFloat(goal.replace(/\s/g, '').replace(',', '.')) : undefined;

  // Calculate preview scale to fit the container
  useLayoutEffect(() => {
    const calculate = () => {
      if (!previewContainerRef.current) return;
      const containerW = previewContainerRef.current.clientWidth - 48; // padding
      const containerH = window.innerHeight * 0.65;
      const scaleW = containerW / dims.width;
      const scaleH = containerH / dims.height;
      setScale(Math.min(scaleW, scaleH, 0.55));
    };

    calculate();
    window.addEventListener('resize', calculate);
    return () => window.removeEventListener('resize', calculate);
  }, [dims]);

  const handleExport = async () => {
    if (!templateRef.current) return;
    setIsExporting(true);
    try {
      const filename = `zbory-${templateId}-${Date.now()}.png`;
      await exportToPNG(templateRef.current, filename, dims.width, dims.height);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const previewW = Math.round(dims.width * scale);
  const previewH = Math.round(dims.height * scale);

  return (
    <div>
      {/* Top nav */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Назад до аналітики
        </button>
        <div className="text-sm font-medium text-gray-700">
          {TEMPLATE_NAMES[templateId]}
          <span className="ml-2 text-xs text-gray-400 font-normal">{dims.label}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-8 items-start">
        {/* Preview */}
        <div
          ref={previewContainerRef}
          className="bg-gray-100 rounded-2xl p-6 flex items-center justify-center"
          style={{ minHeight: previewH + 48 }}
        >
          {/* Overflow wrapper — crops to scaled size */}
          <div
            style={{
              width: previewW,
              height: previewH,
              overflow: 'hidden',
              borderRadius: 8,
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              flexShrink: 0,
            }}
          >
            {/* Scale wrapper */}
            <div
              style={{
                width: dims.width,
                height: dims.height,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }}
            >
              {templateId === 'progress' && (
                <ProgressCard ref={templateRef} aggregates={aggregates} goal={goalValue} />
              )}
              {templateId === 'daily-activity' && (
                <DailyActivityCard ref={templateRef} aggregates={aggregates} />
              )}
              {templateId === 'thank-you' && (
                <ThankYouCard ref={templateRef} aggregates={aggregates} />
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Goal input — only for progress template */}
          {templateId === 'progress' && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Ціль збору (опційно)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="наприклад: 200000"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-10 text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  ₴
                </span>
              </div>
              <p className="mt-1.5 text-xs text-gray-400">
                Введіть суму — з'явиться прогрес-бар
              </p>
            </div>
          )}

          {/* Stats summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <p className="text-sm font-semibold text-gray-700">У шаблоні</p>
            {[
              { label: 'Зібрано', value: new Intl.NumberFormat('uk-UA').format(Math.round(aggregates.totalAmount)) + ' ₴' },
              { label: 'Донатів', value: String(aggregates.donationCount) },
              { label: 'Середній', value: new Intl.NumberFormat('uk-UA').format(Math.round(aggregates.avgDonation)) + ' ₴' },
            ].map((s) => (
              <div key={s.label} className="flex justify-between text-sm">
                <span className="text-gray-500">{s.label}</span>
                <span className="font-medium text-gray-900">{s.value}</span>
              </div>
            ))}
          </div>

          {/* Download button */}
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400
                       text-white font-semibold rounded-xl py-4 px-6
                       flex items-center justify-center gap-3
                       transition-colors duration-150 shadow-lg shadow-indigo-200"
          >
            {isExporting ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Генерація...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Завантажити PNG
              </>
            )}
          </button>

          <p className="text-xs text-center text-gray-400">
            {dims.label}
          </p>
        </div>
      </div>
    </div>
  );
}
