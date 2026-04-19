import { useRef, useState, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../context/AppContext';
import type { TemplateType } from '../types';
import { ProgressCard } from '../components/templates/ProgressCard';
import { DailyActivityCard } from '../components/templates/DailyActivityCard';
import { ThankYouCard } from '../components/templates/ThankYouCard';
import { exportToPNG } from '../utils/exportPNG';

type Format = 'post' | 'story';

const TEMPLATE_DEFAULT_FORMAT: Record<TemplateType, Format> = {
  progress: 'post',
  'daily-activity': 'story',
  'thank-you': 'post',
};

const FORMAT_DIMS: Record<Format, { width: number; height: number; label: string }> = {
  post: { width: 1080, height: 1080, label: '1080×1080' },
  story: { width: 1080, height: 1920, label: '1080×1920' },
};

export function ExportPage() {
  const { t } = useTranslation('export');
  const { state, dispatch } = useAppContext();
  const { app } = state;

  const templateRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [goal, setGoal] = useState(app.goal ? String(app.goal) : '');
  const [isExporting, setIsExporting] = useState(false);
  const [format, setFormat] = useState<Format>(
    app.selectedTemplate ? TEMPLATE_DEFAULT_FORMAT[app.selectedTemplate.id] : 'post',
  );

  if (!app.selectedTemplate || !app.aggregates) return null;

  const templateId = app.selectedTemplate.id;
  const dims = FORMAT_DIMS[format];
  const goalValue = goal ? parseFloat(goal.replace(/\s/g, '').replace(',', '.')) : undefined;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useLayoutEffect(() => {
    const calculate = () => {
      if (!previewContainerRef.current) return;
      const containerW = previewContainerRef.current.clientWidth - 48;
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
      const filename = `zbory-${templateId}-${format}-${Date.now()}.png`;
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
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => dispatch({ type: 'GO_TO_STEP', payload: 'gallery' })}
          className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800
                     bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm
                     hover:border-gray-300 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t('backButton')}
        </button>
        <div className="text-sm font-medium text-gray-700">{t(`templateNames.${templateId}`)}</div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-8 items-start">
        {/* Preview */}
        <div
          ref={previewContainerRef}
          className="bg-gray-100 rounded-2xl p-6 flex items-center justify-center"
          style={{ minHeight: previewH + 48 }}
        >
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
            <div
              style={{
                width: dims.width,
                height: dims.height,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }}
            >
              {templateId === 'progress' && (
                <ProgressCard ref={templateRef} aggregates={app.aggregates} goal={goalValue} format={format} />
              )}
              {templateId === 'daily-activity' && (
                <DailyActivityCard ref={templateRef} aggregates={app.aggregates} format={format} />
              )}
              {templateId === 'thank-you' && (
                <ThankYouCard ref={templateRef} aggregates={app.aggregates} format={format} />
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Format toggle */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">{t('format.label')}</p>
            <div className="grid grid-cols-2 gap-2">
              {(['post', 'story'] as Format[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`py-2.5 px-3 rounded-lg text-sm font-medium border transition-all ${
                    format === f
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  {f === 'post' ? t('format.post') : t('format.story')}
                  <span className={`block text-xs mt-0.5 ${format === f ? 'text-indigo-200' : 'text-gray-400'}`}>
                    {FORMAT_DIMS[f].label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Goal input — only for progress template */}
          {templateId === 'progress' && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('goal.label')}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder={t('goal.placeholder')}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-10 text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₴</span>
              </div>
              <p className="mt-1.5 text-xs text-gray-400">{t('goal.hint')}</p>
            </div>
          )}

          {/* Stats summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <p className="text-sm font-semibold text-gray-700">{t('stats.title')}</p>
            {[
              { label: t('stats.collected'), value: new Intl.NumberFormat('uk-UA').format(Math.round(app.aggregates.totalAmount)) + ' ₴' },
              { label: t('stats.donations'), value: String(app.aggregates.donationCount) },
              { label: t('stats.average'), value: new Intl.NumberFormat('uk-UA').format(Math.round(app.aggregates.avgDonation)) + ' ₴' },
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
                {t('exporting')}
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {t('download')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
