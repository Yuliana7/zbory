import { useRef, useState, useLayoutEffect, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../context/AppContext';
import type { TemplateType } from '../types';
import { ProgressCard } from '../components/templates/ProgressCard';
import { DailyActivityCard } from '../components/templates/DailyActivityCard';
import { ThankYouCard } from '../components/templates/ThankYouCard';
import { MilestoneCard } from '../components/templates/MilestoneCard';
import { DonorsCountCard } from '../components/templates/DonorsCountCard';
import { UrgencyCard } from '../components/templates/UrgencyCard';
import { TopDonorsCard } from '../components/templates/TopDonorsCard';
import { WeeklyRecapCard } from '../components/templates/WeeklyRecapCard';
import { SpeedCard } from '../components/templates/SpeedCard';
import { exportToPNG } from '../utils/exportPNG';
import { aggregateDonations } from '../utils/dataAggregator';
import { PALETTES, DEFAULT_PALETTE, type Palette } from '../utils/palettes';
import { TEMPLATE_TEXT_FIELDS, TEMPLATE_SUPPORTS_DATE_RANGE, TEMPLATE_REQUIRES_GOAL } from '../utils/templateConfig';

type Format = 'post' | 'story';

const FORMAT_DIMS: Record<Format, { width: number; height: number; label: string }> = {
  post: { width: 1080, height: 1080, label: '1080×1080' },
  story: { width: 1080, height: 1920, label: '1080×1920' },
};

const DEFAULT_FORMAT: Record<TemplateType, Format> = {
  progress: 'post',
  'daily-activity': 'story',
  'thank-you': 'post',
  milestone: 'post',
  'top-donors': 'story',
  'donors-count': 'post',
  urgency: 'post',
  'weekly-recap': 'story',
  speed: 'post',
};

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function ExportPage() {
  const { state } = useAppContext();
  const { app } = state;
  if (!app.selectedTemplate || !app.aggregates || !app.donations) return null;
  return <ExportPageInner />;
}

function ExportPageInner() {
  const { t } = useTranslation(['export', 'templates']);
  const { state, dispatch } = useAppContext();
  const { app } = state;

  // These are guaranteed non-null by the guard in ExportPage
  const selectedTemplate = app.selectedTemplate!;
  const fullAggregates = app.aggregates!;
  const donations = app.donations!;
  const templateId: TemplateType = selectedTemplate.id;

  const templateRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const [scale, setScale] = useState(0.5);
  const [goal, setGoal] = useState(app.goal ? String(app.goal) : '');
  const [isExporting, setIsExporting] = useState(false);
  const [format, setFormat] = useState<Format>(DEFAULT_FORMAT[templateId]);
  const [palette, setPalette] = useState<Palette>(DEFAULT_PALETTE);
  const [textOverrides, setTextOverrides] = useState<Record<string, string>>({});
  const [textEditorOpen, setTextEditorOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    setFormat(DEFAULT_FORMAT[templateId]);
    setTextOverrides({});
  }, [templateId]);

  const dims = FORMAT_DIMS[format];

  const campaignMin = toDateInput(fullAggregates.firstDate);
  const campaignMax = toDateInput(fullAggregates.lastDate);

  const filteredAggregates = useMemo(() => {
    if (!dateFrom && !dateTo) return fullAggregates;
    const from = dateFrom ? new Date(dateFrom).getTime() : 0;
    const to = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : Infinity;
    const filtered = donations.filter(d => {
      const ts = d.timestamp.getTime();
      return ts >= from && ts <= to;
    });
    if (filtered.length === 0) return fullAggregates;
    try {
      return aggregateDonations(filtered);
    } catch {
      return fullAggregates;
    }
  }, [donations, fullAggregates, dateFrom, dateTo]);

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

  const goalValue = goal ? parseFloat(goal.replace(/\s/g, '').replace(',', '.')) : undefined;

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

  const textFields = TEMPLATE_TEXT_FIELDS[templateId];
  const supportsDateRange = TEMPLATE_SUPPORTS_DATE_RANGE[templateId];
  const requiresGoal = TEMPLATE_REQUIRES_GOAL[templateId];
  const showGoal = requiresGoal || templateId === 'progress';

  const templateProps = {
    aggregates: filteredAggregates,
    goal: goalValue,
    format,
    palette,
    textOverrides,
  };

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

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-8 items-start">
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
              <TemplateRenderer templateId={templateId} templateRef={templateRef} {...templateProps} />
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

          {/* Palette picker */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">{t('palette.label')}</p>
            <div className="grid grid-cols-3 gap-2">
              {PALETTES.map((pal) => (
                <button
                  key={pal.id}
                  onClick={() => setPalette(pal)}
                  title={pal.name}
                  className={`relative rounded-lg overflow-hidden h-14 transition-all ${
                    palette.id === pal.id
                      ? 'ring-2 ring-indigo-500 ring-offset-1 scale-105'
                      : 'hover:scale-102 hover:ring-1 hover:ring-gray-300'
                  }`}
                  style={{ background: pal.background }}
                >
                  <span
                    className="absolute inset-0 flex items-end justify-start p-1.5"
                    style={{ color: pal.primary, fontSize: 10, fontWeight: 600, opacity: 0.8 }}
                  >
                    {pal.name}
                  </span>
                  {palette.id === pal.id && (
                    <span className="absolute top-1 right-1 w-3 h-3 bg-white rounded-full flex items-center justify-center">
                      <svg className="w-2 h-2 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          {supportsDateRange && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm font-semibold text-gray-700 mb-3">{t('dateRange.label')}</p>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t('dateRange.from')}</label>
                  <input
                    type="date"
                    value={dateFrom}
                    min={campaignMin}
                    max={dateTo || campaignMax}
                    onChange={e => setDateFrom(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t('dateRange.to')}</label>
                  <input
                    type="date"
                    value={dateTo}
                    min={dateFrom || campaignMin}
                    max={campaignMax}
                    onChange={e => setDateTo(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                {(dateFrom || dateTo) && (
                  <button
                    onClick={() => { setDateFrom(''); setDateTo(''); }}
                    className="text-xs text-gray-400 hover:text-gray-600 underline"
                  >
                    {t('dateRange.reset')}
                  </button>
                )}
              </div>
              {(dateFrom || dateTo) && (
                <p className="mt-2 text-xs text-indigo-600 font-medium">
                  {t('dateRange.filtered', { count: filteredAggregates.donationCount })}
                </p>
              )}
            </div>
          )}

          {/* Goal input */}
          {showGoal && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('goal.label')}
                {requiresGoal && <span className="text-red-500 ml-1">*</span>}
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

          {/* Text editor */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => setTextEditorOpen(o => !o)}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
            >
              <p className="text-sm font-semibold text-gray-700">{t('textEditor.label')}</p>
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${textEditorOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {textEditorOpen && (
              <div className="px-5 pb-5 space-y-3 border-t border-gray-100">
                {textFields.map((field) => {
                  const defaultValue = t(`templates:${templateId}.${field.key}`);
                  const currentValue = textOverrides[field.key] ?? defaultValue;
                  return (
                    <div key={field.key}>
                      <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                      {field.multiline ? (
                        <textarea
                          value={currentValue}
                          onChange={e => setTextOverrides(prev => ({ ...prev, [field.key]: e.target.value }))}
                          placeholder={t('textEditor.defaultPlaceholder')}
                          rows={3}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                                     resize-none"
                        />
                      ) : (
                        <input
                          type="text"
                          value={currentValue}
                          onChange={e => setTextOverrides(prev => ({ ...prev, [field.key]: e.target.value }))}
                          placeholder={t('textEditor.defaultPlaceholder')}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                      )}
                    </div>
                  );
                })}
                {Object.keys(textOverrides).some(k => textOverrides[k]) && (
                  <button
                    onClick={() => setTextOverrides({})}
                    className="text-xs text-gray-400 hover:text-gray-600 underline"
                  >
                    {t('textEditor.reset')}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Stats summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <p className="text-sm font-semibold text-gray-700">{t('stats.title')}</p>
            {[
              { label: t('stats.collected'), value: new Intl.NumberFormat('uk-UA').format(Math.round(filteredAggregates.totalAmount)) + ' ₴' },
              { label: t('stats.donations'), value: String(filteredAggregates.donationCount) },
              { label: t('stats.average'), value: new Intl.NumberFormat('uk-UA').format(Math.round(filteredAggregates.avgDonation)) + ' ₴' },
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

// ─── Template renderer ────────────────────────────────────────────────────────

interface RendererProps {
  templateId: TemplateType;
  templateRef: React.RefObject<HTMLDivElement>;
  aggregates: ReturnType<typeof aggregateDonations>;
  goal?: number;
  format: Format;
  palette: Palette;
  textOverrides: Record<string, string>;
}

function TemplateRenderer({ templateId, templateRef, aggregates, goal, format, palette, textOverrides }: RendererProps) {
  const shared = { ref: templateRef, aggregates, format, palette, textOverrides };
  switch (templateId) {
    case 'progress':        return <ProgressCard {...shared} goal={goal} />;
    case 'daily-activity':  return <DailyActivityCard {...shared} />;
    case 'thank-you':       return <ThankYouCard {...shared} />;
    case 'milestone':       return <MilestoneCard {...shared} goal={goal} />;
    case 'donors-count':    return <DonorsCountCard {...shared} />;
    case 'urgency':         return <UrgencyCard {...shared} goal={goal} />;
    case 'top-donors':      return <TopDonorsCard {...shared} />;
    case 'weekly-recap':    return <WeeklyRecapCard {...shared} />;
    case 'speed':           return <SpeedCard {...shared} />;
  }
}
