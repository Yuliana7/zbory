import { useRef, useState, useLayoutEffect, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../context/AppContext';
import type { TemplateType, Donation, Aggregates, CommentInsights, CardState, SharedStyle } from '../types';
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
import { ReportCard } from '../components/templates/ReportCard';
import { CampaignsChartCard } from '../components/templates/CampaignsChartCard';
import { analyzeCampaigns, buildReport, datasetsToItems, type ReportPeriod } from '../utils/campaignAnalytics';
import { exportToPNG, renderToPNGDataUrl, dataUrlToBytes } from '../utils/exportPNG';
import { aggregateDonations, formatUkrainianDate } from '../utils/dataAggregator';
import { generateCaption } from '../utils/captionGenerator';
import { getPersonalComments } from '../utils/commentAnalyzer';
import { createZip } from '../utils/zip';
import { PALETTES, DEFAULT_PALETTE } from '../utils/palettes';
import {
  TEMPLATE_TEXT_FIELDS,
  TEMPLATE_SUPPORTS_DATE_RANGE,
  TEMPLATE_REQUIRES_GOAL,
  TEMPLATE_DEFAULT_FORMAT,
  TEMPLATE_HAS_HEADER,
  TEMPLATE_HAS_FOOTER,
  TEMPLATE_STICKERS,
  TEMPLATE_GROUPS,
} from '../utils/templateConfig';

type Format = 'post' | 'story';

const FORMAT_DIMS: Record<Format, { width: number; height: number; label: string }> = {
  post: { width: 1080, height: 1080, label: '1080×1080' },
  story: { width: 1080, height: 1920, label: '1080×1920' },
};

const DEFAULT_SHARED_STYLE: SharedStyle = {
  palette: DEFAULT_PALETTE,
  bgImage: null,
  bgColor: null,
  bgTransparent: false,
  bgBrightness: 1,
  bgOpacity: 1,
  bgZoom: 1,
  bgOffsetX: 0,
  bgOffsetY: 0,
  bgRotate: 0,
  fontScale: 1,
};

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function makeCard(templateId: TemplateType, personalComments: Array<{ text: string }>): CardState {
  return {
    templateId,
    format: TEMPLATE_DEFAULT_FORMAT[templateId],
    textOverrides: {},
    showHeader: true,
    showFooter: true,
    showChart: true,
    showBars: true,
    showBestDay: true,
    showRefunds: false,
    dateFrom: '',
    dateTo: '',
    selectedCommentKeys:
      templateId === 'comments' ? personalComments.slice(0, 3).map((c) => c.text) : [],
    captionText: null,
    styleOverride: null,
    touched: false,
  };
}

/**
 * Builds the card list for a template id sequence, reusing previously edited
 * cards (matched by template, consumed in order) so adding/removing/reordering
 * templates never discards edits.
 */
function mergeCards(
  ids: TemplateType[],
  existing: CardState[],
  personalComments: Array<{ text: string }>,
): CardState[] {
  const pool = [...existing];
  return ids.map((id) => {
    const idx = pool.findIndex((c) => c.templateId === id);
    if (idx >= 0) return pool.splice(idx, 1)[0];
    return makeCard(id, personalComments);
  });
}

function filterAggregates(
  donations: Donation[],
  fullAggregates: Aggregates,
  dateFrom: string,
  dateTo: string,
): Aggregates {
  if (!dateFrom && !dateTo) return fullAggregates;
  const from = dateFrom ? new Date(dateFrom).getTime() : 0;
  const to = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : Infinity;
  const filtered = donations.filter((d) => {
    const ts = d.timestamp.getTime();
    return ts >= from && ts <= to;
  });
  if (filtered.length === 0) return fullAggregates;
  try {
    return aggregateDonations(filtered);
  } catch {
    return fullAggregates;
  }
}

export function ExportPage() {
  const { state } = useAppContext();
  const { app } = state;
  if (!app.selectedTemplates?.length || !app.aggregates || !app.donations) return null;
  return <ExportPageInner />;
}

function ExportPageInner() {
  const { t } = useTranslation(['export', 'templates', 'gallery']);
  const { state, dispatch } = useAppContext();
  const { app } = state;

  // These are guaranteed non-null by the guard in ExportPage
  const stackIds = app.selectedTemplates!;
  const fullAggregates = app.aggregates!;
  const donations = app.donations!;
  const commentInsights: CommentInsights | null = app.commentInsights;

  const personalComments = useMemo(() => getPersonalComments(donations), [donations]);

  // Multi-campaign data for the report/comparison templates (null in single mode)
  const crossItems = useMemo(
    () => (app.campaignDatasets && app.campaignDatasets.length >= 2 ? datasetsToItems(app.campaignDatasets) : null),
    [app.campaignDatasets],
  );
  const crossQuarters = useMemo(() => (crossItems ? analyzeCampaigns(crossItems).quarters : []), [crossItems]);

  // ── Stack state — restored from context so gallery ⇄ export keeps edits ──
  const [cards, setCards] = useState<CardState[]>(() =>
    mergeCards(stackIds, app.stackCards ?? [], personalComments),
  );
  const [current, setCurrent] = useState(0);
  const safeCurrent = Math.min(current, cards.length - 1);
  const card = cards[safeCurrent];
  const templateId = card.templateId;

  // Re-merge when the selection changes while mounted (e.g. "+ додати шаблон")
  const idsKey = stackIds.join(',');
  const prevIdsKey = useRef(idsKey);
  useEffect(() => {
    if (prevIdsKey.current === idsKey) return;
    prevIdsKey.current = idsKey;
    setCards((prev) => mergeCards(stackIds, prev, personalComments));
  }, [idsKey, stackIds, personalComments]);

  // ── Shared style (series-wide) with optional per-card override ──
  // Restored from context — losing it on a gallery round-trip silently
  // reverted linked cards to the default style on export.
  const [sharedStyle, setSharedStyle] = useState<SharedStyle>(
    () => app.stackStyle ?? DEFAULT_SHARED_STYLE,
  );

  // Mirror edits into context so they survive navigating away
  useEffect(() => {
    dispatch({ type: 'STACK_UPDATED', payload: { cards, style: sharedStyle } });
  }, [cards, sharedStyle, dispatch]);

  const updateCard = useCallback((patch: Partial<CardState>) => {
    setCards((prev) => prev.map((c, i) => (i === safeCurrent ? { ...c, ...patch, touched: true } : c)));
  }, [safeCurrent]);

  const style = card.styleOverride ?? sharedStyle;
  const styleUnlinked = card.styleOverride !== null;

  const patchStyle = (patch: Partial<SharedStyle>) => {
    if (card.styleOverride) {
      updateCard({ styleOverride: { ...card.styleOverride, ...patch } });
    } else {
      setSharedStyle((prev) => ({ ...prev, ...patch }));
    }
  };

  const styleBadge =
    cards.length > 1 ? (styleUnlinked ? t('stack.ownStyleBadge') : t('stack.sharedBadge')) : undefined;

  // Latest style/patch accessible from non-React event listeners (wheel)
  const styleRef = useRef(style);
  styleRef.current = style;
  const patchStyleRef = useRef(patchStyle);
  patchStyleRef.current = patchStyle;

  // ── Page-level state ──
  const [scale, setScale] = useState(0.5);
  const [goal, setGoal] = useState(app.goal ? String(app.goal) : '');
  const [isExporting, setIsExporting] = useState(false);
  const [showSafeZones, setShowSafeZones] = useState(false);
  const [captionCopied, setCaptionCopied] = useState(false);
  const [allCaptionsCopied, setAllCaptionsCopied] = useState(false);
  const [availableStickers, setAvailableStickers] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  // Picker categories mirror the gallery; first one open by default
  const [addGroupsOpen, setAddGroupsOpen] = useState<Set<string>>(
    () => new Set([TEMPLATE_GROUPS[0].id]),
  );
  // Sidebar sections
  const [formatOpen, setFormatOpen] = useState(true);
  const [bgOpen, setBgOpen] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [refundsOpen, setRefundsOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [textEditorOpen, setTextEditorOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [captionOpen, setCaptionOpen] = useState(false);
  const [stickersOpen, setStickersOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  const templateRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const previewClipRef = useRef<HTMLDivElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const touchStartX = useRef<number | null>(null);
  const bgDrag = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  // ── ZIP export of the whole stack ──
  const [zipQueue, setZipQueue] = useState<number[]>([]);
  const zipResults = useRef<{ name: string; data: Uint8Array }[]>([]);
  const zipRef = useRef<HTMLDivElement>(null);
  const zipInnerRef = useRef<HTMLDivElement>(null);
  const zipCurrentIdx = zipQueue.length > 0 ? zipQueue[0] : null;

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) =>
      patchStyle({ bgImage: ev.target?.result as string, bgTransparent: false, bgColor: null });
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const dims = FORMAT_DIMS[card.format];

  const campaignMin = toDateInput(fullAggregates.firstDate);
  const campaignMax = toDateInput(fullAggregates.lastDate);

  const filteredAggregates = useMemo(
    () => filterAggregates(donations, fullAggregates, card.dateFrom, card.dateTo),
    [donations, fullAggregates, card.dateFrom, card.dateTo],
  );

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

  // Wheel over the preview zooms the background photo (non-passive to prevent page scroll)
  useEffect(() => {
    const el = previewClipRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!styleRef.current.bgImage) return;
      e.preventDefault();
      const next = Math.min(3, Math.max(1, styleRef.current.bgZoom + (e.deltaY < 0 ? 0.08 : -0.08)));
      patchStyleRef.current({ bgZoom: Math.round(next * 100) / 100 });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const goPrev = useCallback(() => setCurrent((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(() => setCurrent((i) => Math.min(cards.length - 1, i + 1)), [cards.length]);

  // ←/→ navigate the deck (unless the user is typing)
  useEffect(() => {
    if (cards.length < 2) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cards.length, goPrev, goNext]);

  const goalValue = goal ? parseFloat(goal.replace(/\s/g, '').replace(',', '.')) : undefined;

  const commentsFor = useCallback(
    (c: CardState): SelectedComment[] => {
      const keys = new Set(c.selectedCommentKeys);
      return personalComments
        .filter((pc) => keys.has(pc.text))
        .slice(0, 5)
        .map((pc) => ({ text: pc.text, donor: pc.donor }));
    },
    [personalComments],
  );

  const selectedComments = useMemo(() => commentsFor(card), [commentsFor, card]);

  // Live caption: recomputes with the data until the user edits it;
  // "regenerate" simply drops the edited copy
  const captionFor = useCallback(
    (c: CardState): string =>
      c.captionText ??
      generateCaption(c.templateId, filterAggregates(donations, fullAggregates, c.dateFrom, c.dateTo), t, {
        goal: goalValue,
        linkUrl: c.textOverrides.linkUrl,
        comments: commentsFor(c),
      }),
    [donations, fullAggregates, t, goalValue, commentsFor],
  );
  const captionValue = captionFor(card);

  const handleCopyCaption = async () => {
    try {
      await navigator.clipboard.writeText(captionValue);
      setCaptionCopied(true);
      setTimeout(() => setCaptionCopied(false), 2000);
    } catch (err) {
      console.error('Clipboard write failed:', err);
    }
  };

  const handleCopyAllCaptions = async () => {
    const bundle = cards
      .map((c, i) => `${i + 1}/${cards.length}\n${captionFor(c)}`)
      .join('\n\n———\n\n');
    try {
      await navigator.clipboard.writeText(bundle);
      setAllCaptionsCopied(true);
      setTimeout(() => setAllCaptionsCopied(false), 2000);
    } catch (err) {
      console.error('Clipboard write failed:', err);
    }
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
  }, [templateId, card, goalValue, filteredAggregates, selectedComments]);

  const handleStickerExport = async (stickerId: string) => {
    const el = templateRef.current?.querySelector<HTMLElement>(`[data-sticker="${stickerId}"]`);
    if (!el) return;
    try {
      await exportToPNG(el, `zbory-${templateId}-${stickerId}.png`, el.offsetWidth, el.offsetHeight);
    } catch (err) {
      console.error('Sticker export failed:', err);
    }
  };

  const handleExport = async () => {
    const exportEl = exportRef.current ?? templateRef.current;
    if (!exportEl) return;
    setIsExporting(true);
    try {
      const filename = `zbory-${templateId}-${card.format}-${Date.now()}.png`;
      await exportToPNG(exportEl, filename, dims.width, dims.height);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // ── ZIP export: renders each card offscreen with its own saved state ──
  useEffect(() => {
    if (zipCurrentIdx === null) return;
    let cancelled = false;
    const zipCard = cards[zipCurrentIdx];
    const run = async () => {
      // Give the offscreen card a beat to lay out and paint
      await new Promise((r) => setTimeout(r, 150));
      const el = zipRef.current;
      if (!el || cancelled) return;
      const d = FORMAT_DIMS[zipCard.format];
      try {
        const dataUrl = await renderToPNGDataUrl(el, d.width, d.height);
        zipResults.current.push({
          name: `${zipCurrentIdx + 1}-zbory-${zipCard.templateId}-${zipCard.format}.png`,
          data: dataUrlToBytes(dataUrl),
        });
      } catch (err) {
        console.error(`ZIP export failed for ${zipCard.templateId}:`, err);
      }
      if (cancelled) return;
      setZipQueue((q) => {
        const rest = q.slice(1);
        if (rest.length === 0 && zipResults.current.length > 0) {
          const blob = createZip(zipResults.current);
          zipResults.current = [];
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- driven by the queue head only
  }, [zipCurrentIdx]);

  const startZipExport = () => {
    if (zipQueue.length > 0) return;
    zipResults.current = [];
    setZipQueue(cards.map((_, i) => i));
  };

  const handleRemoveCard = () => {
    if (cards.length <= 1) return;
    const newIds = cards.map((c) => c.templateId).filter((_, i) => i !== safeCurrent);
    dispatch({ type: 'GALLERY_UI', payload: { selection: newIds } });
    dispatch({ type: 'TEMPLATES_SELECTED', payload: newIds });
    setCurrent(Math.max(0, safeCurrent - 1));
  };

  const handleAddTemplate = (id: TemplateType) => {
    const newIds = [...cards.map((c) => c.templateId), id];
    dispatch({ type: 'GALLERY_UI', payload: { selection: newIds } });
    dispatch({ type: 'TEMPLATES_SELECTED', payload: newIds });
    setCurrent(newIds.length - 1);
    setAddOpen(false);
  };

  // Same categories as the template gallery, with data-gated templates hidden
  const addableGroups = useMemo(() => {
    const available = (id: TemplateType) => {
      if (id === 'emoji-cloud') return (commentInsights?.topEmojis.length ?? 0) > 0;
      if (id === 'comments') return personalComments.length > 0;
      if (id === 'report' || id === 'campaigns-chart') return crossItems != null;
      return true;
    };
    return TEMPLATE_GROUPS.map((g) => ({ ...g, ids: g.ids.filter(available) })).filter(
      (g) => g.ids.length > 0,
    );
  }, [commentInsights, personalComments, crossItems]);

  const previewW = Math.round(dims.width * effectiveScale);
  const previewH = Math.round(dims.height * effectiveScale);

  const textFields = TEMPLATE_TEXT_FIELDS[templateId];
  const supportsDateRange = TEMPLATE_SUPPORTS_DATE_RANGE[templateId];
  const requiresGoal = TEMPLATE_REQUIRES_GOAL[templateId];
  const showGoal = requiresGoal || templateId === 'progress' || templateId === 'final-report';

  const hasHeaderToggle = TEMPLATE_HAS_HEADER[templateId];
  const hasFooterToggle = TEMPLATE_HAS_FOOTER[templateId];
  const hasLayoutSection = hasHeaderToggle || hasFooterToggle || templateId === 'daily-activity';

  const zipCard = zipCurrentIdx !== null ? cards[zipCurrentIdx] : null;

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
        <div className="text-sm font-medium text-gray-700">
          {t(`templateNames.${templateId}`)}
          {cards.length > 1 && (
            <span className="ml-2 text-gray-400">{t('stack.cardOf', { current: safeCurrent + 1, total: cards.length })}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-8 items-start" style={{ position: 'relative' }}>
        {/* Preview */}
        <div
          ref={previewContainerRef}
          className="bg-gray-100 rounded-2xl p-6 flex flex-col items-center justify-center gap-4"
          style={{ minHeight: previewH + 48, position: 'sticky', top: '0px', zIndex: 100 }}
          onTouchStart={(e) => {
            // With a background photo, touch on the preview drags the photo instead
            if (style.bgImage) return;
            touchStartX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (touchStartX.current === null) return;
            const delta = e.changedTouches[0].clientX - touchStartX.current;
            touchStartX.current = null;
            if (Math.abs(delta) < 60) return;
            if (delta > 0) goPrev();
            else goNext();
          }}
        >
          <div
            ref={previewClipRef}
            style={{
              width: previewW,
              height: previewH,
              overflow: 'hidden',
              borderRadius: 8,
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              flexShrink: 0,
              cursor: style.bgImage ? (bgDrag.current ? 'grabbing' : 'grab') : undefined,
              touchAction: style.bgImage ? 'none' : undefined,
              userSelect: style.bgImage ? 'none' : undefined,
            }}
            onPointerDown={(e) => {
              if (!style.bgImage) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              bgDrag.current = {
                startX: e.clientX,
                startY: e.clientY,
                baseX: style.bgOffsetX,
                baseY: style.bgOffsetY,
              };
            }}
            onPointerMove={(e) => {
              if (!bgDrag.current) return;
              // Screen px → % of the card (the img translate % is relative to card size)
              const dxPct = ((e.clientX - bgDrag.current.startX) / previewW) * 100;
              const dyPct = ((e.clientY - bgDrag.current.startY) / previewH) * 100;
              patchStyle({
                bgOffsetX: Math.round(Math.min(100, Math.max(-100, bgDrag.current.baseX + dxPct))),
                bgOffsetY: Math.round(Math.min(100, Math.max(-100, bgDrag.current.baseY + dyPct))),
              });
            }}
            onPointerUp={() => { bgDrag.current = null; }}
            onPointerCancel={() => { bgDrag.current = null; }}
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
              <CardCanvas
                card={card}
                style={style}
                aggregates={filteredAggregates}
                goal={goalValue}
                commentInsights={commentInsights}
                crossItems={crossItems}
                selectedComments={selectedComments}
                safeZonePad={showSafeZones}
                exRef={exportRef}
                templateRef={templateRef}
              />

              {/* Instagram story safe zones — preview only, never exported
                  (the overlay is a sibling of exportRef, outside the capture) */}
              {card.format === 'story' && showSafeZones && (
                <>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 250, background: 'rgba(244,63,94,0.14)', borderBottom: '3px dashed rgba(244,63,94,0.55)', pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 310, background: 'rgba(244,63,94,0.14)', borderTop: '3px dashed rgba(244,63,94,0.55)', pointerEvents: 'none' }} />
                </>
              )}
            </div>
          </div>

          {/* Stack navigation */}
          <div className="flex items-center gap-3">
            {cards.length > 1 && (
              <>
                <button
                  onClick={goPrev}
                  disabled={safeCurrent === 0}
                  className="p-2 rounded-full bg-white border border-gray-200 text-gray-500 shadow-sm hover:text-gray-800 hover:border-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="flex items-center gap-2">
                  {cards.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrent(i)}
                      title={t(`templateNames.${c.templateId}`)}
                      className={`relative w-3 h-3 rounded-full transition-all ${
                        i === safeCurrent ? 'bg-indigo-600 scale-125' : c.touched ? 'bg-indigo-300' : 'bg-gray-300 hover:bg-gray-400'
                      }`}
                    />
                  ))}
                </div>
                <button
                  onClick={goNext}
                  disabled={safeCurrent === cards.length - 1}
                  className="p-2 rounded-full bg-white border border-gray-200 text-gray-500 shadow-sm hover:text-gray-800 hover:border-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
            <button
              onClick={() => setAddOpen(true)}
              title={t('stack.addTemplate')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white border border-dashed border-gray-300 text-gray-500 text-xs font-medium shadow-sm hover:text-indigo-700 hover:border-indigo-400 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('stack.addTemplate')}
            </button>
            {cards.length > 1 && (
              <button
                onClick={handleRemoveCard}
                title={t('stack.removeCard')}
                className="p-2 rounded-full bg-white border border-gray-200 text-gray-400 shadow-sm hover:text-red-500 hover:border-red-300 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Format — per card */}
          <Collapsible label={t('format.label')} open={formatOpen} onToggle={() => setFormatOpen(o => !o)}>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden shadow-sm w-fit">
              {(['post', 'story'] as Format[]).map((f) => (
                <button
                  key={f}
                  onClick={() => updateCard({ format: f })}
                  className={`px-4 py-2 text-xs font-medium transition-colors ${card.format === f ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                >
                  {f === 'post' ? t('format.postShort') : t('format.storyShort')}
                </button>
              ))}
            </div>
            {card.format === 'story' && (
              <div className="mt-3">
                <ToggleRow label={t('safeZones.toggle')} value={showSafeZones} onChange={setShowSafeZones} />
                <p className="mt-1 text-xs text-gray-400">{t('safeZones.hint')}</p>
              </div>
            )}
          </Collapsible>

          {/* Background + palette — shared, or per-card when unlinked */}
          <Collapsible
            label={t('background.label')}
            badge={styleBadge}
            badgeColor="indigo"
            open={bgOpen}
            onToggle={() => setBgOpen(o => !o)}
          >
            <div className="space-y-4">
              {cards.length > 1 && (
                <div className="pb-1 border-b border-gray-100">
                  <ToggleRow
                    label={t('stack.unlinkStyle')}
                    value={styleUnlinked}
                    onChange={(v) => updateCard({ styleOverride: v ? { ...sharedStyle } : null })}
                  />
                  <p className="mt-1 text-xs text-gray-400">{t('stack.unlinkHint')}</p>
                </div>
              )}

              {/* Palette swatches */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">{t('palette.label')}</p>
                <div className="grid grid-cols-4 gap-2">
                  {PALETTES.map((pal) => (
                    <button
                      key={pal.id}
                      onClick={() => patchStyle({ palette: pal })}
                      title={pal.name}
                      className={`relative rounded-lg overflow-hidden h-10 transition-all ${style.palette.id === pal.id
                        ? 'ring-2 ring-indigo-500 ring-offset-1 scale-105'
                        : 'hover:ring-1 hover:ring-gray-300'
                        }`}
                      style={{ background: pal.background }}
                    >
                      <span className="absolute inset-0 flex items-end justify-start p-1" style={{ color: pal.primary, fontSize: 8, fontWeight: 600, opacity: 0.85 }}>
                        {pal.name}
                      </span>
                      {style.palette.id === pal.id && (
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
                    onClick={() => patchStyle({ bgTransparent: !style.bgTransparent, bgImage: null, bgColor: null })}
                    title={t('background.transparent')}
                    className={`w-10 h-10 rounded-lg border-2 overflow-hidden transition-all ${style.bgTransparent ? 'border-indigo-500 scale-105' : 'border-gray-200 hover:border-gray-400'}`}
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
                    <input type="color" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" value={style.bgColor ?? '#ffffff'} onChange={(e) => patchStyle({ bgColor: e.target.value, bgImage: null, bgTransparent: false })} />
                    <div className="w-full h-full" style={{ background: style.bgColor ?? 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }} />
                  </label>
                  <button
                    onClick={() => bgInputRef.current?.click()}
                    title={t('background.uploadPhoto')}
                    className={`w-10 h-10 rounded-lg border-2 overflow-hidden flex items-center justify-center transition-all ${style.bgImage ? 'border-indigo-500' : 'border-gray-200 hover:border-gray-400'}`}
                    style={style.bgImage ? { backgroundImage: `url(${style.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
                  >
                    {!style.bgImage && <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                  </button>
                  <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
                </div>
                {style.bgImage && (
                  <div className="mt-3 space-y-3">
                    <p className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-2.5 py-1.5">
                      {t('background.dragHint')}
                    </p>
                    <div>
                      <div className="flex justify-between text-[11px] text-gray-500 mb-1"><span>{t('background.brightness')}</span><span>{Math.round(style.bgBrightness * 100)}%</span></div>
                      <input type="range" min={0.1} max={1.5} step={0.05} value={style.bgBrightness} onChange={e => patchStyle({ bgBrightness: parseFloat(e.target.value) })} className="w-full accent-indigo-600" />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-gray-500 mb-1"><span>{t('background.opacity')}</span><span>{Math.round(style.bgOpacity * 100)}%</span></div>
                      <input type="range" min={0.05} max={1} step={0.05} value={style.bgOpacity} onChange={e => patchStyle({ bgOpacity: parseFloat(e.target.value) })} className="w-full accent-indigo-600" />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-gray-500 mb-1"><span>{t('background.zoom')}</span><span>{Math.round(style.bgZoom * 100)}%</span></div>
                      <input type="range" min={1} max={3} step={0.05} value={style.bgZoom} onChange={e => patchStyle({ bgZoom: parseFloat(e.target.value) })} className="w-full accent-indigo-600" />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-gray-500 mb-1"><span>{t('background.offsetX')}</span><span>{style.bgOffsetX}%</span></div>
                      <input type="range" min={-100} max={100} step={1} value={style.bgOffsetX} onChange={e => patchStyle({ bgOffsetX: parseInt(e.target.value, 10) })} className="w-full accent-indigo-600" />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-gray-500 mb-1"><span>{t('background.offsetY')}</span><span>{style.bgOffsetY}%</span></div>
                      <input type="range" min={-100} max={100} step={1} value={style.bgOffsetY} onChange={e => patchStyle({ bgOffsetY: parseInt(e.target.value, 10) })} className="w-full accent-indigo-600" />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-gray-500 mb-1"><span>{t('background.rotate')}</span><span>{style.bgRotate}°</span></div>
                      <input type="range" min={0} max={360} step={1} value={style.bgRotate} onChange={e => patchStyle({ bgRotate: parseInt(e.target.value, 10) })} className="w-full accent-indigo-600" />
                    </div>
                  </div>
                )}
                {(style.bgImage || style.bgColor || style.bgTransparent) && (
                  <button onClick={() => patchStyle({ bgImage: null, bgColor: null, bgTransparent: false, bgBrightness: 1, bgOpacity: 1, bgZoom: 1, bgOffsetX: 0, bgOffsetY: 0, bgRotate: 0 })} className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline">
                    {t('background.reset')}
                  </button>
                )}
              </div>
            </div>
          </Collapsible>

          {/* Font scale — shared, or per-card when unlinked */}
          <Collapsible
            label={t('fontScale.label')}
            badge={`${style.fontScale.toFixed(2)}×${styleBadge ? ` · ${styleBadge}` : ''}`}
            open={fontOpen}
            onToggle={() => setFontOpen(o => !o)}
          >
            <input type="range" min={0.75} max={2.5} step={0.05} value={style.fontScale} onChange={(e) => patchStyle({ fontScale: parseFloat(e.target.value) })} className="w-full accent-indigo-600" />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>0.75×</span><span>1×</span><span>2.5×</span>
            </div>
          </Collapsible>

          {/* Date range — per card, conditional */}
          {supportsDateRange && (
            <Collapsible
              label={t('dateRange.label')}
              badge={(card.dateFrom || card.dateTo) ? t('dateRange.filtered', { count: filteredAggregates.donationCount }) : undefined}
              badgeColor="indigo"
              open={dateOpen}
              onToggle={() => setDateOpen(o => !o)}
            >
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t('dateRange.from')}</label>
                  <input type="date" value={card.dateFrom} min={campaignMin} max={card.dateTo || campaignMax} onChange={e => updateCard({ dateFrom: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t('dateRange.to')}</label>
                  <input type="date" value={card.dateTo} min={card.dateFrom || campaignMin} max={campaignMax} onChange={e => updateCard({ dateTo: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>
                {(card.dateFrom || card.dateTo) && (
                  <button onClick={() => updateCard({ dateFrom: '', dateTo: '' })} className="text-xs text-gray-400 hover:text-gray-600 underline">{t('dateRange.reset')}</button>
                )}
              </div>
            </Collapsible>
          )}

          {/* Refunds — per card, conditional */}
          {templateId === 'funds-flow' && filteredAggregates.impliedRefunds > 500 && (
            <Collapsible label={t('refundsPanel.title')} icon="↩️" open={refundsOpen} onToggle={() => setRefundsOpen(o => !o)} purple>
              <p className="text-xs text-purple-700 leading-relaxed mb-3">
                {t('refundsPanel.description', { amount: new Intl.NumberFormat('uk-UA').format(Math.round(filteredAggregates.impliedRefunds)) })}
              </p>
              <label className="flex items-center gap-3 cursor-pointer group">
                <div onClick={() => updateCard({ showRefunds: !card.showRefunds })} className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${card.showRefunds ? 'bg-purple-600' : 'bg-gray-300'}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${card.showRefunds ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
                <span className="text-xs font-medium text-purple-800 group-hover:text-purple-900">{t('refundsPanel.toggle')}</span>
              </label>
              <p className="text-xs text-purple-500 italic mt-2">{t('refundsPanel.note')}</p>
            </Collapsible>
          )}

          {/* Template sections — per card, conditional */}
          {hasLayoutSection && (
            <Collapsible label={t('layout.label')} open={layoutOpen} onToggle={() => setLayoutOpen(o => !o)}>
              <div className="space-y-3">
                {hasHeaderToggle && (
                  <ToggleRow label={t('layout.header')} value={card.showHeader} onChange={(v) => updateCard({ showHeader: v })} />
                )}
                {hasFooterToggle && (
                  <ToggleRow label={t('layout.footer')} value={card.showFooter} onChange={(v) => updateCard({ showFooter: v })} />
                )}
                {templateId === 'daily-activity' && (
                  <>
                    <ToggleRow label={t('layout.chart')} value={card.showChart} onChange={(v) => updateCard({ showChart: v })} />
                    {card.format === 'story' && (
                      <ToggleRow label={t('layout.bars')} value={card.showBars} onChange={(v) => updateCard({ showBars: v })} />
                    )}
                    <ToggleRow label={t('layout.bestDay')} value={card.showBestDay} onChange={(v) => updateCard({ showBestDay: v })} />
                  </>
                )}
              </div>
            </Collapsible>
          )}

          {/* Goal — global, conditional */}
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

          {/* Report period — multi-campaign report card only */}
          {templateId === 'report' && crossItems && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <label className="block text-xs text-gray-500 mb-1.5">{t('campaigns:report.periodLabel')}</label>
              <select
                value={card.textOverrides['periodKey'] ?? 'all'}
                onChange={(e) => updateCard({ textOverrides: { ...card.textOverrides, periodKey: e.target.value } })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">{t('campaigns:report.periodAll')}</option>
                {[...new Set(crossQuarters.map((q) => q.year))].sort((a, b) => b - a).map((y) => (
                  <option key={y} value={`y-${y}`}>{t('campaigns:report.periodYear', { year: y })}</option>
                ))}
                {[...crossQuarters].sort((a, b) => b.year - a.year || b.quarter - a.quarter).map((q) => (
                  <option key={`${q.year}-${q.quarter}`} value={`q-${q.year}-${q.quarter}`}>
                    {t('campaigns:report.periodQuarter', { quarter: q.quarter, year: q.year })}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Text editor — per card */}
          <Collapsible label={t('textEditor.label')} open={textEditorOpen} onToggle={() => setTextEditorOpen(o => !o)}>
            <div className="space-y-3">
              {textFields.map((field) => {
                const defaultValue =
                  field.key === 'achievedLabel' && templateId === 'milestone'
                    ? t(`templates:milestone.${milestoneAchievedKey}`)
                    : field.key === 'dateRange'
                      ? `${formatUkrainianDate(filteredAggregates.firstDate)} — ${formatUkrainianDate(filteredAggregates.lastDate)}`
                      : t(`templates:${templateId}.${field.key}`);
                const currentValue = card.textOverrides[field.key] ?? defaultValue;
                const setOverride = (value: string) =>
                  updateCard({ textOverrides: { ...card.textOverrides, [field.key]: value } });
                return (
                  <div key={field.key}>
                    <label className="block text-xs text-gray-500 mb-1">{t(`fieldLabels.${templateId}.${field.key}`)}</label>
                    {field.multiline ? (
                      <textarea value={currentValue} onChange={e => setOverride(e.target.value)} placeholder={t('textEditor.defaultPlaceholder')} rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none" />
                    ) : (
                      <input type="text" value={currentValue} onChange={e => setOverride(e.target.value)} placeholder={t('textEditor.defaultPlaceholder')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                    )}
                  </div>
                );
              })}
              {Object.keys(card.textOverrides).length > 0 && (
                <button onClick={() => updateCard({ textOverrides: {} })} className="text-xs text-gray-400 hover:text-gray-600 underline">{t('textEditor.reset')}</button>
              )}
            </div>
          </Collapsible>

          {/* Comment picker — per card, only for «Слова підтримки» */}
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
                      const checked = card.selectedCommentKeys.includes(c.text);
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
                              updateCard({
                                selectedCommentKeys: checked
                                  ? card.selectedCommentKeys.filter((k) => k !== c.text)
                                  : [...card.selectedCommentKeys, c.text],
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

          {/* Caption for the post — per card */}
          <Collapsible label={t('caption.label')} open={captionOpen} onToggle={() => setCaptionOpen(o => !o)}>
            <textarea
              value={captionValue}
              onChange={(e) => updateCard({ captionText: e.target.value })}
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
              {card.captionText !== null && (
                <button
                  onClick={() => updateCard({ captionText: null })}
                  title={t('caption.regenerate')}
                  className="px-3 py-2 text-sm font-medium border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  ↺
                </button>
              )}
            </div>
            {cards.length > 1 && (
              <button
                onClick={handleCopyAllCaptions}
                className={`mt-2 w-full px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  allCaptionsCopied
                    ? 'bg-green-100 border-green-200 text-green-700'
                    : 'border-indigo-200 text-indigo-700 hover:bg-indigo-50'
                }`}
              >
                {allCaptionsCopied ? t('caption.copied') : t('stack.copyAllCaptions', { count: cards.length })}
              </button>
            )}
          </Collapsible>

          {/* Sticker export — per card, conditional */}
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

          {/* Download current card */}
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

          {/* Download whole stack as ZIP */}
          {cards.length > 1 && (
            <button
              onClick={startZipExport}
              disabled={zipQueue.length > 0}
              className="w-full border-2 border-indigo-600 text-indigo-700 hover:bg-indigo-50 disabled:opacity-60
                         font-semibold rounded-xl py-3.5 px-6 flex items-center justify-center gap-3 transition-colors"
            >
              {zipQueue.length > 0
                ? t('stack.exporting', { left: zipQueue.length })
                : t('stack.downloadAll', { count: cards.length })}
            </button>
          )}
        </div>
      </div>

      {/* Add-template modal */}
      {addOpen && (
        <div
          className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center p-4"
          onClick={() => setAddOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-80 max-h-[70vh] overflow-y-auto p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-gray-800 mb-3">{t('stack.addTemplate')}</p>
            <div className="space-y-2">
              {addableGroups.map((group) => {
                const isOpen = addGroupsOpen.has(group.id);
                return (
                  <div key={group.id} className="border border-gray-100 rounded-xl overflow-hidden">
                    <button
                      onClick={() =>
                        setAddGroupsOpen((prev) => {
                          const next = new Set(prev);
                          if (next.has(group.id)) next.delete(group.id);
                          else next.add(group.id);
                          return next;
                        })
                      }
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors"
                    >
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        <span className="text-sm leading-none">{group.icon}</span>
                        {t(`gallery:${group.labelKey}`)}
                        <span className="text-gray-300 normal-case">{group.ids.length}</span>
                      </span>
                      <svg
                        className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {isOpen && (
                      <div className="pb-1 px-1 space-y-0.5">
                        {group.ids.map((id) => (
                          <button
                            key={id}
                            onClick={() => handleAddTemplate(id)}
                            className="w-full flex items-center justify-between px-3 py-2 text-sm text-left rounded-lg
                                       text-gray-700 hover:bg-indigo-50 hover:text-indigo-800 transition-colors"
                          >
                            {t(`templateNames.${id}`)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Offscreen ZIP renderer — one card at a time, with its own saved state */}
      {zipCard && (
        <div style={{ position: 'fixed', left: -12000, top: 0 }} aria-hidden>
          <div
            ref={zipRef}
            style={{
              width: FORMAT_DIMS[zipCard.format].width,
              height: FORMAT_DIMS[zipCard.format].height,
              overflow: 'hidden',
            }}
          >
            <CardCanvas
              card={zipCard}
              style={zipCard.styleOverride ?? sharedStyle}
              aggregates={filterAggregates(donations, fullAggregates, zipCard.dateFrom, zipCard.dateTo)}
              goal={goalValue}
              commentInsights={commentInsights}
              crossItems={crossItems}
              selectedComments={commentsFor(zipCard)}
              safeZonePad={showSafeZones}
              templateRef={zipInnerRef}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Card canvas: background + template, the exact node captured for PNG ─────

interface CardCanvasProps {
  card: CardState;
  style: SharedStyle;
  aggregates: Aggregates;
  goal?: number;
  commentInsights: CommentInsights | null;
  crossItems: ReturnType<typeof datasetsToItems> | null;
  selectedComments: SelectedComment[];
  safeZonePad: boolean;
  templateRef: React.RefObject<HTMLDivElement>;
  exRef?: React.RefObject<HTMLDivElement>;
}

function CardCanvas({ card, style, aggregates, goal, commentInsights, crossItems, selectedComments, safeZonePad, templateRef, exRef }: CardCanvasProps) {
  const dims = FORMAT_DIMS[card.format];
  // Image is rendered as a separate overlay (with filter/transform controls),
  // so the template itself gets 'transparent' when an image is active.
  const bgOverride = style.bgTransparent || style.bgImage ? 'transparent' : style.bgColor ?? undefined;

  return (
    <div
      ref={exRef}
      style={{
        position: 'relative',
        width: dims.width,
        height: dims.height,
        overflow: 'hidden',
        // palette bg shows through semi-transparent image when opacity < 1
        background: style.bgImage ? style.palette.background : undefined,
      }}
    >
      {style.bgImage && (
        <img
          src={style.bgImage}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            transform: `translate(${style.bgOffsetX}%, ${style.bgOffsetY}%) scale(${style.bgZoom}) rotate(${style.bgRotate}deg)`,
            filter: `brightness(${style.bgBrightness})`,
            opacity: style.bgOpacity,
          }}
        />
      )}
      <TemplateRenderer
        templateId={card.templateId}
        templateRef={templateRef}
        aggregates={aggregates}
        goal={goal}
        format={card.format}
        palette={style.palette}
        textOverrides={card.textOverrides}
        fontScale={style.fontScale}
        showRefunds={card.showRefunds}
        bgOverride={bgOverride}
        showHeader={card.showHeader}
        showFooter={card.showFooter}
        showChart={card.showChart}
        showBars={card.showBars}
        showBestDay={card.showBestDay}
        safeZonePad={safeZonePad}
        commentInsights={commentInsights}
        crossItems={crossItems}
        selectedComments={selectedComments}
      />
    </div>
  );
}

// ─── Template renderer ────────────────────────────────────────────────────────

interface RendererProps {
  templateId: TemplateType;
  templateRef: React.RefObject<HTMLDivElement>;
  aggregates: Aggregates;
  goal?: number;
  format: Format;
  palette: SharedStyle['palette'];
  textOverrides: Record<string, string>;
  fontScale: number;
  showRefunds: boolean;
  bgOverride?: string;
  showHeader: boolean;
  showFooter: boolean;
  showChart: boolean;
  showBars: boolean;
  showBestDay: boolean;
  safeZonePad?: boolean;
  commentInsights: CommentInsights | null;
  crossItems: ReturnType<typeof datasetsToItems> | null;
  selectedComments: SelectedComment[];
}

function TemplateRenderer({ templateId, templateRef, aggregates, goal, format, palette, textOverrides, fontScale, showRefunds, bgOverride, showHeader, showFooter, showChart, showBars, showBestDay, safeZonePad, commentInsights, crossItems, selectedComments }: RendererProps) {
  const { t: tCamp } = useTranslation('campaigns');
  // Report period rides in textOverrides (key 'periodKey') so it survives
  // card persistence and batch export without a new CardState field.
  const periodKey = textOverrides['periodKey'] ?? 'all';
  const period: ReportPeriod = useMemo(() => {
    const [kind, year, quarter] = periodKey.split('-');
    if (kind === 'y') return { kind: 'year', year: Number(year) };
    if (kind === 'q') return { kind: 'quarter', year: Number(year), quarter: Number(quarter) };
    return { kind: 'all' };
  }, [periodKey]);
  const report = useMemo(
    () => (templateId === 'report' && crossItems ? buildReport(crossItems, period) : null),
    [templateId, crossItems, period],
  );
  const periodLabel =
    period.kind === 'all'
      ? tCamp('report.labelAll')
      : period.kind === 'year'
        ? tCamp('report.labelYear', { year: period.year })
        : tCamp('report.labelQuarter', { quarter: period.quarter, year: period.year });

  const shared = { ref: templateRef, aggregates, format, palette, textOverrides, fontScale, bgOverride, safeZonePad };
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
    case 'report': return report ? <ReportCard {...shared} report={report} periodLabel={periodLabel} /> : null;
    case 'campaigns-chart': return crossItems ? <CampaignsChartCard {...shared} items={crossItems} /> : null;
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
