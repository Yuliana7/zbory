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
import { FundsFlowCard } from '../components/templates/FundsFlowCard';
import { FinalReportCard } from '../components/templates/FinalReportCard';
import { ConcreteAskCard } from '../components/templates/ConcreteAskCard';
import { EmojiCloudCard } from '../components/templates/EmojiCloudCard';
import { CommentsCard, type SelectedComment } from '../components/templates/CommentsCard';
import { exportToPNG, renderToPNGDataUrl, dataUrlToBytes } from '../utils/exportPNG';
import { aggregateDonations, formatUkrainianDate } from '../utils/dataAggregator';
import { generateCaption } from '../utils/captionGenerator';
import { getPersonalComments } from '../utils/commentAnalyzer';
import { createZip } from '../utils/zip';
import { PALETTES, DEFAULT_PALETTE, type Palette } from '../utils/palettes';
import type { CommentInsights } from '../types';
import {
  TEMPLATE_TEXT_FIELDS,
  TEMPLATE_SUPPORTS_DATE_RANGE,
  TEMPLATE_REQUIRES_GOAL,
  TEMPLATE_DEFAULT_FORMAT,
  TEMPLATE_HAS_HEADER,
  TEMPLATE_HAS_FOOTER,
  TEMPLATE_STICKERS,
} from '../utils/templateConfig';

type Format = 'post' | 'story';
type FontScale = number;

const FORMAT_DIMS: Record<Format, { width: number; height: number; label: string }> = {
  post: { width: 1080, height: 1080, label: '1080×1080' },
  story: { width: 1080, height: 1920, label: '1080×1920' },
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
  const exportRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const [scale, setScale] = useState(0.5);
  const [goal, setGoal] = useState(app.goal ? String(app.goal) : '');
  const [isExporting, setIsExporting] = useState(false);
  const [format, setFormat] = useState<Format>(TEMPLATE_DEFAULT_FORMAT[templateId]);
  const [palette, setPalette] = useState<Palette>(DEFAULT_PALETTE);
  const [textOverrides, setTextOverrides] = useState<Record<string, string>>({});
  const [textEditorOpen, setTextEditorOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [fontScale, setFontScale] = useState<FontScale>(1);
  const [showRefunds, setShowRefunds] = useState(false);
  const [formatOpen, setFormatOpen] = useState(true);
  const [bgOpen, setBgOpen] = useState(false);
  const [fontOpen, setFontOpen] = useState(true);
  const [dateOpen, setDateOpen] = useState(false);
  const [refundsOpen, setRefundsOpen] = useState(true);
  const [layoutOpen, setLayoutOpen] = useState(true);
  const [goalOpen, setGoalOpen] = useState(true);
  const [statsOpen, setStatsOpen] = useState(false);
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [bgColor, setBgColor] = useState<string | null>(null);
  const [bgTransparent, setBgTransparent] = useState(false);
  const [bgBrightness, setBgBrightness] = useState(1);
  const [bgOpacity, setBgOpacity] = useState(1);
  const [bgZoom, setBgZoom] = useState(1);
  const [bgOffsetX, setBgOffsetX] = useState(0);
  const [bgOffsetY, setBgOffsetY] = useState(0);
  const [bgRotate, setBgRotate] = useState(0);
  // Template section visibility (header / footer / daily-activity blocks)
  const [showHeader, setShowHeader] = useState(true);
  const [showFooter, setShowFooter] = useState(true);
  const [showChart, setShowChart] = useState(true);
  const [showBars, setShowBars] = useState(true);
  const [showBestDay, setShowBestDay] = useState(true);
  const [showSafeZones, setShowSafeZones] = useState(false);
  // Caption, comment picker, stickers, batch export
  const [captionText, setCaptionText] = useState('');
  const [captionCopied, setCaptionCopied] = useState(false);
  const [captionOpen, setCaptionOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(true);
  const [stickersOpen, setStickersOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [selectedCommentKeys, setSelectedCommentKeys] = useState<Set<string>>(new Set());
  const [availableStickers, setAvailableStickers] = useState<string[]>([]);
  const [batchSelection, setBatchSelection] = useState<Set<TemplateType>>(new Set());
  const [batchQueue, setBatchQueue] = useState<TemplateType[]>([]);
  const batchResults = useRef<{ name: string; data: Uint8Array }[]>([]);
  const batchRef = useRef<HTMLDivElement>(null);
  const batchInnerRef = useRef<HTMLDivElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  const commentInsights: CommentInsights | null = app.commentInsights;
  const personalComments = useMemo(() => getPersonalComments(donations), [donations]);

  useEffect(() => {
    setFormat(TEMPLATE_DEFAULT_FORMAT[templateId]);
    setTextOverrides({});
    setShowHeader(true);
    setShowFooter(true);
    setShowChart(true);
    setShowBars(true);
    setShowBestDay(true);
    // Pre-select the three freshest comments so the card isn't empty
    if (templateId === 'comments') {
      setSelectedCommentKeys(new Set(personalComments.slice(0, 3).map((c) => c.text)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the template changes
  }, [templateId]);

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setBgImage(ev.target?.result as string); setBgTransparent(false); setBgColor(null); };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Image is rendered as a separate overlay div (with filter/opacity controls),
  // so the template itself gets 'transparent' when an image is active.
  const bgOverride = bgTransparent || bgImage
    ? 'transparent'
    : bgColor ?? undefined;

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

  // On mobile (single-column layout) the preview is sticky; shrink it as the
  // user scrolls into the controls so the panel gets roughly half the screen.
  const [scrollShrink, setScrollShrink] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      // xl breakpoint = side-by-side layout, no shrinking needed
      if (window.innerWidth >= 1280) {
        setScrollShrink(0);
        return;
      }
      setScrollShrink(Math.min(1, Math.max(0, window.scrollY / 320)));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const effectiveScale = scale * (1 - 0.45 * scrollShrink);

  const goalValue = goal ? parseFloat(goal.replace(/\s/g, '').replace(',', '.')) : undefined;

  const selectedComments: SelectedComment[] = useMemo(
    () =>
      personalComments
        .filter((c) => selectedCommentKeys.has(c.text))
        .slice(0, 5)
        .map((c) => ({ text: c.text, donor: c.donor })),
    [personalComments, selectedCommentKeys],
  );

  const regenerateCaption = () => {
    setCaptionText(
      generateCaption(templateId, filteredAggregates, t, {
        goal: goalValue,
        linkUrl: textOverrides.linkUrl,
        comments: selectedComments,
      }),
    );
  };

  // Fresh caption whenever the template changes; manual edits survive until then
  useEffect(() => {
    setCaptionText(
      generateCaption(templateId, filteredAggregates, t, {
        goal: goalValue,
        linkUrl: textOverrides.linkUrl,
        comments: selectedComments,
      }),
    );
    setCaptionCopied(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- regenerate only on template change
  }, [templateId]);

  const handleCopyCaption = async () => {
    try {
      await navigator.clipboard.writeText(captionText);
      setCaptionCopied(true);
      setTimeout(() => setCaptionCopied(false), 2000);
    } catch (err) {
      console.error('Clipboard write failed:', err);
    }
  };

  // Which sticker blocks are actually present in the rendered template
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const root = templateRef.current;
      if (!root) {
        setAvailableStickers([]);
        return;
      }
      setAvailableStickers(
        TEMPLATE_STICKERS[templateId].filter((s) => root.querySelector(`[data-sticker="${s}"]`)),
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [templateId, format, goalValue, showHeader, showFooter, showChart, showBars, showBestDay, filteredAggregates, selectedComments]);

  const handleStickerExport = async (stickerId: string) => {
    const el = templateRef.current?.querySelector<HTMLElement>(`[data-sticker="${stickerId}"]`);
    if (!el) return;
    try {
      await exportToPNG(el, `zbory-${templateId}-${stickerId}.png`, el.offsetWidth, el.offsetHeight);
    } catch (err) {
      console.error('Sticker export failed:', err);
    }
  };

  // Templates eligible for batch export: comments needs manual curation,
  // emoji-cloud needs comment data, goal-based ones need a goal
  const batchableTemplates = useMemo(() => {
    return (Object.keys(TEMPLATE_DEFAULT_FORMAT) as TemplateType[]).filter((id) => {
      if (id === 'comments') return false;
      if (id === 'emoji-cloud' && !commentInsights?.topEmojis.length) return false;
      if (TEMPLATE_REQUIRES_GOAL[id] && !goalValue) return false;
      return true;
    });
  }, [commentInsights, goalValue]);

  const batchCurrent = batchQueue[0] ?? null;

  useEffect(() => {
    if (!batchCurrent) return;
    let cancelled = false;
    const run = async () => {
      // Give the offscreen template a beat to lay out and paint
      await new Promise((r) => setTimeout(r, 150));
      const el = batchRef.current;
      if (!el || cancelled) return;
      const d = FORMAT_DIMS[TEMPLATE_DEFAULT_FORMAT[batchCurrent]];
      try {
        const dataUrl = await renderToPNGDataUrl(el, d.width, d.height);
        batchResults.current.push({ name: `zbory-${batchCurrent}.png`, data: dataUrlToBytes(dataUrl) });
      } catch (err) {
        console.error(`Batch export failed for ${batchCurrent}:`, err);
      }
      if (cancelled) return;
      setBatchQueue((q) => {
        const rest = q.slice(1);
        if (rest.length === 0 && batchResults.current.length > 0) {
          const blob = createZip(batchResults.current);
          batchResults.current = [];
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = `zbory-${Date.now()}.zip`;
          link.href = url;
          link.click();
          URL.revokeObjectURL(url);
        }
        return rest;
      });
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [batchCurrent]);

  const startBatchExport = () => {
    if (batchQueue.length > 0 || batchSelection.size === 0) return;
    batchResults.current = [];
    setBatchQueue(batchableTemplates.filter((id) => batchSelection.has(id)));
  };

  const milestoneAchievedKey = (() => {
    const pct = goalValue ? (filteredAggregates.totalAmount / goalValue) * 100 : null;
    if (pct === null) return 'achievedLabel_noGoal';
    if (pct >= 100) return 'achievedLabel_100';
    if (pct >= 75) return 'achievedLabel_75';
    if (pct >= 50) return 'achievedLabel_50';
    if (pct >= 25) return 'achievedLabel_25';
    return 'achievedLabel_0';
  })();

  const handleExport = async () => {
    const exportEl = exportRef.current ?? templateRef.current;
    if (!exportEl) return;
    setIsExporting(true);
    try {
      const filename = `zbory-${templateId}-${format}-${Date.now()}.png`;
      await exportToPNG(exportEl, filename, dims.width, dims.height);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const previewW = Math.round(dims.width * effectiveScale);
  const previewH = Math.round(dims.height * effectiveScale);

  const textFields = TEMPLATE_TEXT_FIELDS[templateId];
  const supportsDateRange = TEMPLATE_SUPPORTS_DATE_RANGE[templateId];
  const requiresGoal = TEMPLATE_REQUIRES_GOAL[templateId];
  const showGoal = requiresGoal || templateId === 'progress';

  const hasHeaderToggle = TEMPLATE_HAS_HEADER[templateId];
  const hasFooterToggle = TEMPLATE_HAS_FOOTER[templateId];
  const hasLayoutSection = hasHeaderToggle || hasFooterToggle || templateId === 'daily-activity';

  const templateProps = {
    aggregates: filteredAggregates,
    goal: goalValue,
    format,
    palette,
    textOverrides,
    fontScale,
    showRefunds,
    bgOverride,
    showHeader,
    showFooter,
    showChart,
    showBars,
    showBestDay,
    commentInsights,
    selectedComments,
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

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-8 items-start" style={{ position: 'relative' }}>
        {/* Preview */}
        <div
          ref={previewContainerRef}
          className="bg-gray-100 rounded-2xl p-6 flex items-center justify-center"
          style={{ minHeight: (previewH + 48), position: 'sticky', top: '0px', zIndex: 100 }}
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
                transform: `scale(${effectiveScale})`,
                transformOrigin: 'top left',
                position: 'relative',
              }}
            >
              {/* exportRef wrapper captures template + image overlay for PNG export */}
              <div
                ref={exportRef}
                style={{
                  position: 'relative',
                  width: dims.width,
                  height: dims.height,
                  overflow: 'hidden',
                  // palette bg shows through semi-transparent image when opacity < 1
                  background: bgImage ? palette.background : undefined,
                }}
              >
                {bgImage && (
                  <img
                    src={bgImage}
                    alt=""
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      transform: `translate(${bgOffsetX}%, ${bgOffsetY}%) scale(${bgZoom}) rotate(${bgRotate}deg)`,
                      filter: `brightness(${bgBrightness})`,
                      opacity: bgOpacity,
                    }}
                  />
                )}
                <TemplateRenderer templateId={templateId} templateRef={templateRef} {...templateProps} />
              </div>

              {/* Instagram story safe zones — preview only, never exported
                  (the overlay is a sibling of exportRef, outside the capture) */}
              {format === 'story' && showSafeZones && (
                <>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 250, background: 'rgba(244,63,94,0.14)', borderBottom: '3px dashed rgba(244,63,94,0.55)', pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 310, background: 'rgba(244,63,94,0.14)', borderTop: '3px dashed rgba(244,63,94,0.55)', pointerEvents: 'none' }} />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Reusable chevron */}
          {/* Format — collapsible */}
          <Collapsible label={t('format.label')} open={formatOpen} onToggle={() => setFormatOpen(o => !o)}>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden shadow-sm w-fit">
              {(['post', 'story'] as Format[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`px-4 py-2 text-xs font-medium transition-colors ${format === f ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                >
                  {f === 'post' ? t('format.postShort') : t('format.storyShort')}
                </button>
              ))}
            </div>
            {format === 'story' && (
              <div className="mt-3">
                <ToggleRow label={t('safeZones.toggle')} value={showSafeZones} onChange={setShowSafeZones} />
                <p className="mt-1 text-xs text-gray-400">{t('safeZones.hint')}</p>
              </div>
            )}
          </Collapsible>

          {/* Background + palette — collapsible */}
          <Collapsible label={t('background.label')} open={bgOpen} onToggle={() => setBgOpen(o => !o)}>
            <div className="space-y-4">
              {/* Palette swatches */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">{t('palette.label')}</p>
                <div className="grid grid-cols-4 gap-2">
                  {PALETTES.map((pal) => (
                    <button
                      key={pal.id}
                      onClick={() => setPalette(pal)}
                      title={pal.name}
                      className={`relative rounded-lg overflow-hidden h-10 transition-all ${palette.id === pal.id
                        ? 'ring-2 ring-indigo-500 ring-offset-1 scale-105'
                        : 'hover:ring-1 hover:ring-gray-300'
                        }`}
                      style={{ background: pal.background }}
                    >
                      <span className="absolute inset-0 flex items-end justify-start p-1" style={{ color: pal.primary, fontSize: 8, fontWeight: 600, opacity: 0.85 }}>
                        {pal.name}
                      </span>
                      {palette.id === pal.id && (
                        <span className="absolute top-0.5 right-0.5 w-3 h-3 bg-white rounded-full flex items-center justify-center">
                          <svg className="w-2 h-2 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Background override */}
              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs font-medium text-gray-500 mb-2">{t('background.ownLabel')}</p>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => { setBgTransparent(v => !v); setBgImage(null); setBgColor(null); }}
                    title={t('background.transparent')}
                    className={`w-10 h-10 rounded-lg border-2 overflow-hidden transition-all ${bgTransparent ? 'border-indigo-500 scale-105' : 'border-gray-200 hover:border-gray-400'}`}
                  >
                    <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                      <rect width="40" height="40" fill="#fff" />
                      <rect x="0" y="0" width="10" height="10" fill="#ccc" /><rect x="20" y="0" width="10" height="10" fill="#ccc" />
                      <rect x="10" y="10" width="10" height="10" fill="#ccc" /><rect x="30" y="10" width="10" height="10" fill="#ccc" />
                      <rect x="0" y="20" width="10" height="10" fill="#ccc" /><rect x="20" y="20" width="10" height="10" fill="#ccc" />
                      <rect x="10" y="30" width="10" height="10" fill="#ccc" /><rect x="30" y="30" width="10" height="10" fill="#ccc" />
                    </svg>
                  </button>
                  <label title={t('background.customColor')} className="relative w-10 h-10 rounded-lg border-2 overflow-hidden cursor-pointer transition-all hover:border-indigo-400 border-gray-200">
                    <input type="color" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" value={bgColor ?? '#ffffff'} onChange={(e) => { setBgColor(e.target.value); setBgImage(null); setBgTransparent(false); }} />
                    <div className="w-full h-full" style={{ background: bgColor ?? 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }} />
                  </label>
                  <button
                    onClick={() => bgInputRef.current?.click()}
                    title={t('background.uploadPhoto')}
                    className={`w-10 h-10 rounded-lg border-2 overflow-hidden flex items-center justify-center transition-all ${bgImage ? 'border-indigo-500' : 'border-gray-200 hover:border-gray-400'}`}
                    style={bgImage ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
                  >
                    {!bgImage && <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                  </button>
                  <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
                </div>
                {bgImage && (
                  <div className="mt-3 space-y-3">
                    <div>
                      <div className="flex justify-between text-[11px] text-gray-500 mb-1"><span>{t('background.brightness')}</span><span>{Math.round(bgBrightness * 100)}%</span></div>
                      <input type="range" min={0.1} max={1.5} step={0.05} value={bgBrightness} onChange={e => setBgBrightness(parseFloat(e.target.value))} className="w-full accent-indigo-600" />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-gray-500 mb-1"><span>{t('background.opacity')}</span><span>{Math.round(bgOpacity * 100)}%</span></div>
                      <input type="range" min={0.05} max={1} step={0.05} value={bgOpacity} onChange={e => setBgOpacity(parseFloat(e.target.value))} className="w-full accent-indigo-600" />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-gray-500 mb-1"><span>{t('background.zoom')}</span><span>{Math.round(bgZoom * 100)}%</span></div>
                      <input type="range" min={1} max={3} step={0.05} value={bgZoom} onChange={e => setBgZoom(parseFloat(e.target.value))} className="w-full accent-indigo-600" />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-gray-500 mb-1"><span>{t('background.offsetX')}</span><span>{bgOffsetX}%</span></div>
                      <input type="range" min={-50} max={50} step={1} value={bgOffsetX} onChange={e => setBgOffsetX(parseInt(e.target.value, 10))} className="w-full accent-indigo-600" />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-gray-500 mb-1"><span>{t('background.offsetY')}</span><span>{bgOffsetY}%</span></div>
                      <input type="range" min={-50} max={50} step={1} value={bgOffsetY} onChange={e => setBgOffsetY(parseInt(e.target.value, 10))} className="w-full accent-indigo-600" />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-gray-500 mb-1"><span>{t('background.rotate')}</span><span>{bgRotate}%</span></div>
                      <input type="range" min={0} max={360} step={1} value={bgRotate} onChange={e => setBgRotate(parseInt(e.target.value, 10))} className="w-full accent-indigo-600" />
                    </div>
                  </div>
                )}
                {(bgImage || bgColor || bgTransparent) && (
                  <button onClick={() => { setBgImage(null); setBgColor(null); setBgTransparent(false); setBgBrightness(1); setBgOpacity(1); setBgZoom(1); setBgOffsetX(0); setBgOffsetY(0); }} className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline">
                    {t('background.reset')}
                  </button>
                )}
              </div>
            </div>
          </Collapsible>

          {/* Font scale — collapsible */}
          <Collapsible
            label={t('fontScale.label')}
            badge={`${fontScale.toFixed(2)}×`}
            open={fontOpen}
            onToggle={() => setFontOpen(o => !o)}
          >
            <input type="range" min={0.75} max={2.5} step={0.05} value={fontScale} onChange={(e) => setFontScale(parseFloat(e.target.value))} className="w-full accent-indigo-600" />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>0.75×</span><span>1×</span><span>2.5×</span>
            </div>
          </Collapsible>

          {/* Date range — collapsible, conditional */}
          {supportsDateRange && (
            <Collapsible
              label={t('dateRange.label')}
              badge={(dateFrom || dateTo) ? t('dateRange.filtered', { count: filteredAggregates.donationCount }) : undefined}
              badgeColor="indigo"
              open={dateOpen}
              onToggle={() => setDateOpen(o => !o)}
            >
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t('dateRange.from')}</label>
                  <input type="date" value={dateFrom} min={campaignMin} max={dateTo || campaignMax} onChange={e => setDateFrom(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t('dateRange.to')}</label>
                  <input type="date" value={dateTo} min={dateFrom || campaignMin} max={campaignMax} onChange={e => setDateTo(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>
                {(dateFrom || dateTo) && (
                  <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs text-gray-400 hover:text-gray-600 underline">{t('dateRange.reset')}</button>
                )}
              </div>
            </Collapsible>
          )}

          {/* Refunds — collapsible, conditional */}
          {templateId === 'funds-flow' && filteredAggregates.impliedRefunds > 500 && (
            <Collapsible label={t('refundsPanel.title')} icon="↩️" open={refundsOpen} onToggle={() => setRefundsOpen(o => !o)} purple>
              <p className="text-xs text-purple-700 leading-relaxed mb-3">
                {t('refundsPanel.description', { amount: new Intl.NumberFormat('uk-UA').format(Math.round(filteredAggregates.impliedRefunds)) })}
              </p>
              <label className="flex items-center gap-3 cursor-pointer group">
                <div onClick={() => setShowRefunds(v => !v)} className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${showRefunds ? 'bg-purple-600' : 'bg-gray-300'}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${showRefunds ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
                <span className="text-xs font-medium text-purple-800 group-hover:text-purple-900">{t('refundsPanel.toggle')}</span>
              </label>
              <p className="text-xs text-purple-500 italic mt-2">{t('refundsPanel.note')}</p>
            </Collapsible>
          )}

          {/* Template sections — collapsible, conditional */}
          {hasLayoutSection && (
            <Collapsible label={t('layout.label')} open={layoutOpen} onToggle={() => setLayoutOpen(o => !o)}>
              <div className="space-y-3">
                {hasHeaderToggle && (
                  <ToggleRow label={t('layout.header')} value={showHeader} onChange={setShowHeader} />
                )}
                {hasFooterToggle && (
                  <ToggleRow label={t('layout.footer')} value={showFooter} onChange={setShowFooter} />
                )}
                {templateId === 'daily-activity' && (
                  <>
                    <ToggleRow label={t('layout.chart')} value={showChart} onChange={setShowChart} />
                    {format === 'story' && (
                      <ToggleRow label={t('layout.bars')} value={showBars} onChange={setShowBars} />
                    )}
                    <ToggleRow label={t('layout.bestDay')} value={showBestDay} onChange={setShowBestDay} />
                  </>
                )}
              </div>
            </Collapsible>
          )}

          {/* Goal — collapsible, conditional */}
          {showGoal && (
            <Collapsible label={t('goal.label')} open={goalOpen} onToggle={() => setGoalOpen(o => !o)}>
              <div className="relative">
                <input
                  type="text"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder={t('goal.placeholder')}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₴</span>
              </div>
              <p className="mt-1.5 text-xs text-gray-400">{t('goal.hint')}</p>
              {requiresGoal && !goal && <p className="mt-1 text-xs text-red-500">{t('requiredField')}</p>}
            </Collapsible>
          )}

          {/* Text editor — collapsible */}
          <Collapsible label={t('textEditor.label')} open={textEditorOpen} onToggle={() => setTextEditorOpen(o => !o)}>
            <div className="space-y-3">
              {textFields.map((field) => {
                const defaultValue =
                  field.key === 'achievedLabel' && templateId === 'milestone'
                    ? t(`templates:milestone.${milestoneAchievedKey}`)
                    : field.key === 'dateRange'
                      ? `${formatUkrainianDate(filteredAggregates.firstDate)} — ${formatUkrainianDate(filteredAggregates.lastDate)}`
                      : t(`templates:${templateId}.${field.key}`);
                const currentValue = textOverrides[field.key] ?? defaultValue;
                return (
                  <div key={field.key}>
                    <label className="block text-xs text-gray-500 mb-1">{t(`fieldLabels.${templateId}.${field.key}`)}</label>
                    {field.multiline ? (
                      <textarea value={currentValue} onChange={e => setTextOverrides(prev => ({ ...prev, [field.key]: e.target.value }))} placeholder={t('textEditor.defaultPlaceholder')} rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none" />
                    ) : (
                      <input type="text" value={currentValue} onChange={e => setTextOverrides(prev => ({ ...prev, [field.key]: e.target.value }))} placeholder={t('textEditor.defaultPlaceholder')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                    )}
                  </div>
                );
              })}
              {Object.keys(textOverrides).length > 0 && (
                <button onClick={() => setTextOverrides({})} className="text-xs text-gray-400 hover:text-gray-600 underline">{t('textEditor.reset')}</button>
              )}
            </div>
          </Collapsible>

          {/* Comment picker — only for the "Слова підтримки" template */}
          {templateId === 'comments' && (
            <Collapsible
              label={t('commentPicker.label')}
              badge={`${selectedComments.length}/5`}
              badgeColor="indigo"
              open={commentsOpen}
              onToggle={() => setCommentsOpen(o => !o)}
            >
              {personalComments.length === 0 ? (
                <p className="text-xs text-gray-400">{t('commentPicker.empty')}</p>
              ) : (
                <>
                  <p className="text-xs text-gray-400 mb-2">{t('commentPicker.hint')}</p>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {personalComments.map((c) => {
                      const checked = selectedCommentKeys.has(c.text);
                      const disabled = !checked && selectedComments.length >= 5;
                      return (
                        <label
                          key={c.text}
                          className={`flex items-start gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                            disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() =>
                              setSelectedCommentKeys((prev) => {
                                const next = new Set(prev);
                                if (next.has(c.text)) next.delete(c.text);
                                else next.add(c.text);
                                return next;
                              })
                            }
                            className="mt-0.5 accent-indigo-600"
                          />
                          <span className="min-w-0">
                            <span className="text-gray-800 break-words">{c.text}</span>
                            {c.donor && <span className="text-gray-400"> — {c.donor}</span>}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
            </Collapsible>
          )}

          {/* Caption for the post — collapsible */}
          <Collapsible label={t('caption.label')} open={captionOpen} onToggle={() => setCaptionOpen(o => !o)}>
            <textarea
              value={captionText}
              onChange={(e) => setCaptionText(e.target.value)}
              rows={9}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={handleCopyCaption}
                className={`flex-1 px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  captionCopied
                    ? 'bg-green-100 text-green-700'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                {captionCopied ? t('caption.copied') : t('caption.copy')}
              </button>
              <button
                onClick={regenerateCaption}
                title={t('caption.regenerate')}
                className="px-3 py-2 text-sm font-medium border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
              >
                ↺
              </button>
            </div>
          </Collapsible>

          {/* Sticker export — collapsible, conditional */}
          {availableStickers.length > 0 && (
            <Collapsible label={t('stickers.label')} open={stickersOpen} onToggle={() => setStickersOpen(o => !o)}>
              <p className="text-xs text-gray-400 mb-2">{t('stickers.hint')}</p>
              <div className="space-y-1.5">
                {availableStickers.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStickerExport(s)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                  >
                    {t(`stickers.blocks.${s}`)}
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                ))}
              </div>
            </Collapsible>
          )}

          {/* Batch export — collapsible */}
          <Collapsible label={t('batch.label')} open={batchOpen} onToggle={() => setBatchOpen(o => !o)}>
            <p className="text-xs text-gray-400 mb-2">{t('batch.hint')}</p>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {batchableTemplates.map((id) => (
                <label key={id} className="flex items-center gap-2 px-2 py-1 rounded-lg text-sm cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={batchSelection.has(id)}
                    onChange={() =>
                      setBatchSelection((prev) => {
                        const next = new Set(prev);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        return next;
                      })
                    }
                    className="accent-indigo-600"
                  />
                  <span className="text-gray-700">{t(`templateNames.${id}`)}</span>
                </label>
              ))}
            </div>
            <button
              onClick={startBatchExport}
              disabled={batchQueue.length > 0 || batchSelection.size === 0}
              className="mt-3 w-full px-3 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white transition-colors"
            >
              {batchQueue.length > 0
                ? t('batch.exporting', { left: batchQueue.length })
                : t('batch.download', { count: batchSelection.size })}
            </button>
          </Collapsible>

          {/* Stats — collapsible */}
          <Collapsible label={t('stats.title')} open={statsOpen} onToggle={() => setStatsOpen(o => !o)}>
            <div className="space-y-3">
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
          </Collapsible>

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

      {/* Offscreen batch renderer — one template at a time */}
      {batchCurrent && (
        <div style={{ position: 'fixed', left: -12000, top: 0 }} aria-hidden>
          <div
            ref={batchRef}
            style={{
              width: FORMAT_DIMS[TEMPLATE_DEFAULT_FORMAT[batchCurrent]].width,
              height: FORMAT_DIMS[TEMPLATE_DEFAULT_FORMAT[batchCurrent]].height,
              overflow: 'hidden',
            }}
          >
            <TemplateRenderer
              templateId={batchCurrent}
              templateRef={batchInnerRef}
              aggregates={filteredAggregates}
              goal={goalValue}
              format={TEMPLATE_DEFAULT_FORMAT[batchCurrent]}
              palette={palette}
              textOverrides={{}}
              fontScale={fontScale}
              showRefunds={showRefunds}
              showHeader
              showFooter
              showChart
              showBars
              showBestDay
              commentInsights={commentInsights}
              selectedComments={[]}
            />
          </div>
        </div>
      )}
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
  fontScale: FontScale;
  showRefunds: boolean;
  bgOverride?: string;
  showHeader: boolean;
  showFooter: boolean;
  showChart: boolean;
  showBars: boolean;
  showBestDay: boolean;
  commentInsights: CommentInsights | null;
  selectedComments: SelectedComment[];
}

function TemplateRenderer({ templateId, templateRef, aggregates, goal, format, palette, textOverrides, fontScale, showRefunds, bgOverride, showHeader, showFooter, showChart, showBars, showBestDay, commentInsights, selectedComments }: RendererProps) {
  const shared = { ref: templateRef, aggregates, format, palette, textOverrides, fontScale, bgOverride };
  switch (templateId) {
    case 'progress': return <ProgressCard {...shared} goal={goal} showHeader={showHeader} showFooter={showFooter} />;
    case 'daily-activity': return <DailyActivityCard {...shared} showHeader={showHeader} showChart={showChart} showBars={showBars} showBestDay={showBestDay} />;
    case 'thank-you': return <ThankYouCard {...shared} />;
    case 'milestone': return <MilestoneCard {...shared} goal={goal} showHeader={showHeader} showFooter={showFooter} />;
    case 'donors-count': return <DonorsCountCard {...shared} />;
    case 'urgency': return <UrgencyCard {...shared} goal={goal} showHeader={showHeader} showFooter={showFooter} />;
    case 'top-donors': return <TopDonorsCard {...shared} mode="sum" />;
    case 'top-donors-count': return <TopDonorsCard {...shared} mode="count" />;
    case 'weekly-recap': return <WeeklyRecapCard {...shared} showHeader={showHeader} showFooter={showFooter} />;
    case 'speed': return <SpeedCard {...shared} showHeader={showHeader} showFooter={showFooter} />;
    case 'funds-flow': return <FundsFlowCard {...shared} showRefunds={showRefunds} showHeader={showHeader} showFooter={showFooter} />;
    case 'final-report': return <FinalReportCard {...shared} showHeader={showHeader} showFooter={showFooter} />;
    case 'concrete-ask': return <ConcreteAskCard {...shared} goal={goal} showHeader={showHeader} showFooter={showFooter} />;
    case 'emoji-cloud': return <EmojiCloudCard {...shared} commentInsights={commentInsights} />;
    case 'comments': return <CommentsCard {...shared} selectedComments={selectedComments} />;
  }
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <span className="text-sm text-gray-700">{label}</span>
      <div
        onClick={() => onChange(!value)}
        className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${value ? 'bg-indigo-600' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-1'}`} />
      </div>
    </label>
  );
}

// ─── Collapsible sidebar section ─────────────────────────────────────────────

function Collapsible({
  label, open, onToggle, children,
  badge, badgeColor, icon, purple,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
  badge?: string;
  badgeColor?: 'indigo' | 'gray';
  icon?: string;
  purple?: boolean;
}) {
  return (
    <div className={`rounded-xl border overflow-hidden ${purple ? 'bg-purple-50 border-purple-200' : 'bg-white border-gray-200'}`}>
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-4 text-left transition-colors ${purple ? 'hover:bg-purple-100' : 'hover:bg-gray-50'}`}
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-base leading-none">{icon}</span>}
          <span className={`text-sm font-semibold ${purple ? 'text-purple-900' : 'text-gray-700'}`}>{label}</span>
          {badge && (
            <span className={`text-xs font-medium ${badgeColor === 'indigo' ? 'text-indigo-600' : 'text-gray-400 font-mono'}`}>
              {badge}
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''} ${purple ? 'text-purple-400' : 'text-gray-400'}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className={`px-4 pb-4 pt-3 border-t ${purple ? 'border-purple-200' : 'border-gray-100'}`}>
          {children}
        </div>
      )}
    </div>
  );
}
