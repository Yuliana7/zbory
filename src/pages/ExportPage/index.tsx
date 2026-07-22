import { useRef, useState, useLayoutEffect, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../context/AppContext';
import type { TemplateType, Aggregates, CommentInsights, CardState, SharedStyle } from '../../types';
import type { SelectedComment } from '../../components/templates/CommentsCard';
import { analyzeCampaigns, datasetsToItems } from '../../utils/campaignAnalytics';
import { exportToPNG, renderToPNGDataUrl, dataUrlToBytes } from '../../utils/exportPNG';
import { formatUkrainianDate } from '../../utils/dataAggregator';
import { generateCaption } from '../../utils/captionGenerator';
import { getPersonalComments } from '../../utils/commentAnalyzer';
import { createZip } from '../../utils/zip';
import {
  type Format,
  FORMAT_DIMS,
  DEFAULT_SHARED_STYLE,
  toDateInput,
  mergeCards,
  filterAggregates,
} from '../../utils/exportStack';
import {
  TEMPLATE_TEXT_FIELDS,
  TEMPLATE_SUPPORTS_DATE_RANGE,
  TEMPLATE_REQUIRES_GOAL,
  TEMPLATE_HAS_HEADER,
  TEMPLATE_HAS_FOOTER,
  TEMPLATE_STICKERS,
  TEMPLATE_GROUPS,
} from '../../utils/templateConfig';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  DownloadIcon,
  PlusIcon,
  SpinnerIcon,
  TrashIcon,
} from '../../icons';
import { CardCanvas } from './CardCanvas';
import { FormatPanel } from './panels/FormatPanel';
import { BackgroundPanel } from './panels/BackgroundPanel';
import { FontScalePanel } from './panels/FontScalePanel';
import { DateRangePanel } from './panels/DateRangePanel';
import { RefundsPanel } from './panels/RefundsPanel';
import { LayoutPanel } from './panels/LayoutPanel';
import { GoalPanel } from './panels/GoalPanel';
import { ReportPeriodPanel } from './panels/ReportPeriodPanel';
import { TextEditorPanel } from './panels/TextEditorPanel';
import { CommentPickerPanel } from './panels/CommentPickerPanel';
import { CaptionPanel } from './panels/CaptionPanel';
import { StickersPanel } from './panels/StickersPanel';
import { AddTemplateModal } from './panels/AddTemplateModal';

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

  // ── Stack data lives in AppContext (app.stackCards/app.stackStyle) — no
  // local mirror copy, so there's nothing to fall out of sync on a gallery
  // ⇄ export round trip. mergeCards reconciles against the current template
  // selection every render (cheap: it matches existing card objects by
  // templateId), so edits dispatched into context show up immediately.
  const cards = useMemo(
    () => mergeCards(stackIds, app.stackCards ?? [], personalComments),
    [stackIds, personalComments, app.stackCards],
  );
  const [current, setCurrent] = useState(0);
  const safeCurrent = Math.min(current, cards.length - 1);
  const card = cards[safeCurrent];
  const templateId = card.templateId;
  const sharedStyle = app.stackStyle ?? DEFAULT_SHARED_STYLE;

  // Persist the reconciled card list into context on mount and whenever the
  // template selection changes while mounted (e.g. "+ додати шаблон"), guarded
  // by idsKey so per-keystroke edits (which also change app.stackCards) don't
  // re-trigger this.
  const idsKey = stackIds.join(',');
  const prevIdsKey = useRef<string | null>(null);
  useEffect(() => {
    if (prevIdsKey.current === idsKey) return;
    prevIdsKey.current = idsKey;
    dispatch({ type: 'STACK_UPDATED', payload: { cards, style: sharedStyle } });
  }, [idsKey, cards, sharedStyle, dispatch]);

  const updateCard = useCallback((patch: Partial<CardState>) => {
    const nextCards = cards.map((c, i) => (i === safeCurrent ? { ...c, ...patch, touched: true } : c));
    dispatch({ type: 'STACK_UPDATED', payload: { cards: nextCards, style: sharedStyle } });
  }, [cards, safeCurrent, sharedStyle, dispatch]);

  const style = card.styleOverride ?? sharedStyle;
  const styleUnlinked = card.styleOverride !== null;

  const patchStyle = (patch: Partial<SharedStyle>) => {
    if (card.styleOverride) {
      updateCard({ styleOverride: { ...card.styleOverride, ...patch } });
    } else {
      dispatch({ type: 'STACK_UPDATED', payload: { cards, style: { ...sharedStyle, ...patch } } });
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
  // Sidebar sections — which <Collapsible> panels are expanded
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set(['format']));
  const toggleSection = useCallback((id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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

  // Default value shown in the text editor before the user overrides a field.
  // "title" defaults to the saved campaign's name (e.g. "FVP fundraiser") once
  // the project has been saved to the library; unsaved projects keep each
  // template's own default title text.
  const textDefaultFor = useCallback(
    (key: string): string => {
      if (key === 'title' && app.activeCampaignName) return app.activeCampaignName;
      if (key === 'achievedLabel' && templateId === 'milestone') return t(`templates:milestone.${milestoneAchievedKey}`);
      if (key === 'dateRange') return `${formatUkrainianDate(filteredAggregates.firstDate)} — ${formatUkrainianDate(filteredAggregates.lastDate)}`;
      return t(`templates:${templateId}.${key}`);
    },
    [app.activeCampaignName, templateId, milestoneAchievedKey, filteredAggregates, t],
  );

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

  // Renders a card's canvas — shared by the live preview and the offscreen ZIP
  // renderer so a new per-card field only needs wiring into CardCanvas once.
  // `overrides` lets the live preview reuse its memoized aggregates/comments
  // instead of recomputing them (aggregation over large campaigns isn't cheap).
  const renderCard = (
    c: CardState,
    refs: { templateRef: React.RefObject<HTMLDivElement>; exRef?: React.RefObject<HTMLDivElement> },
    overrides?: { aggregates?: Aggregates; selectedComments?: SelectedComment[] },
  ) => (
    <CardCanvas
      card={c}
      style={c.styleOverride ?? sharedStyle}
      aggregates={overrides?.aggregates ?? filterAggregates(donations, fullAggregates, c.dateFrom, c.dateTo)}
      goal={goalValue}
      commentInsights={commentInsights}
      crossItems={crossItems}
      selectedComments={overrides?.selectedComments ?? commentsFor(c)}
      activeCampaignName={app.activeCampaignName}
      safeZonePad={showSafeZones}
      {...refs}
    />
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => dispatch({ type: 'GO_TO_STEP', payload: 'gallery' })}
          className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800
                     bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm
                     hover:border-gray-300 transition-all"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          {t('backButton')}
        </button>
        <div className="flex items-center gap-3">
          <div className="text-sm font-medium text-gray-700">
            {t(`templateNames.${templateId}`)}
            {cards.length > 1 && (
              <span className="ml-2 text-gray-400">{t('stack.cardOf', { current: safeCurrent + 1, total: cards.length })}</span>
            )}
          </div>
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
              {renderCard(card, { exRef: exportRef, templateRef }, { aggregates: filteredAggregates, selectedComments })}

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

          {/* Stack navigation — wraps onto extra lines instead of overflowing
              the preview box once enough cards make the dots row too wide */}
          <div className="flex flex-wrap items-center justify-center gap-3 max-w-full">
            {cards.length > 1 && (
              <>
                <button
                  onClick={goPrev}
                  disabled={safeCurrent === 0}
                  className="p-2 rounded-full bg-white border border-gray-200 text-gray-500 shadow-sm hover:text-gray-800 hover:border-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ArrowLeftIcon className="w-4 h-4" />
                </button>
                <div className="flex flex-wrap items-center justify-center gap-2 max-w-[240px]">
                  {cards.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrent(i)}
                      title={t(`templateNames.${c.templateId}`)}
                      className={`relative w-3 h-3 rounded-full transition-all ${i === safeCurrent ? 'bg-indigo-600 scale-125' : c.touched ? 'bg-indigo-300' : 'bg-gray-300 hover:bg-gray-400'
                        }`}
                    />
                  ))}
                </div>
                <button
                  onClick={goNext}
                  disabled={safeCurrent === cards.length - 1}
                  className="p-2 rounded-full bg-white border border-gray-200 text-gray-500 shadow-sm hover:text-gray-800 hover:border-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ArrowRightIcon className="w-4 h-4" />
                </button>
              </>
            )}
            {/* Grouped into one flex item so add/delete wrap onto line 2 together, never split */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setAddOpen(true)}
                title={t('stack.addTemplate')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white border border-dashed border-gray-300 text-gray-500 text-xs font-medium shadow-sm hover:text-indigo-700 hover:border-indigo-400 transition-all"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                {t('stack.addTemplate')}
              </button>
              {cards.length > 1 && (
                <button
                  onClick={handleRemoveCard}
                  title={t('stack.removeCard')}
                  className="p-2 rounded-full bg-white border border-gray-200 text-gray-400 shadow-sm hover:text-red-500 hover:border-red-300 transition-all"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <FormatPanel
            open={openSections.has('format')}
            onToggle={() => toggleSection('format')}
            format={card.format}
            onFormatChange={(f: Format) => updateCard({ format: f })}
            showSafeZones={showSafeZones}
            onShowSafeZonesChange={setShowSafeZones}
          />

          <BackgroundPanel
            open={openSections.has('background')}
            onToggle={() => toggleSection('background')}
            style={style}
            onPatchStyle={patchStyle}
            styleBadge={styleBadge}
            multiCard={cards.length > 1}
            styleUnlinked={styleUnlinked}
            onToggleUnlink={(v) => updateCard({ styleOverride: v ? { ...sharedStyle } : null })}
            bgInputRef={bgInputRef}
            onBgUpload={handleBgUpload}
          />

          <FontScalePanel
            open={openSections.has('font')}
            onToggle={() => toggleSection('font')}
            fontScale={style.fontScale}
            onFontScaleChange={(v) => patchStyle({ fontScale: v })}
            styleBadge={styleBadge}
          />

          {supportsDateRange && (
            <DateRangePanel
              open={openSections.has('date')}
              onToggle={() => toggleSection('date')}
              dateFrom={card.dateFrom}
              dateTo={card.dateTo}
              campaignMin={campaignMin}
              campaignMax={campaignMax}
              filteredCount={filteredAggregates.donationCount}
              onFromChange={(v) => updateCard({ dateFrom: v })}
              onToChange={(v) => updateCard({ dateTo: v })}
              onReset={() => updateCard({ dateFrom: '', dateTo: '' })}
            />
          )}

          {templateId === 'funds-flow' && filteredAggregates.impliedRefunds > 500 && (
            <RefundsPanel
              open={openSections.has('refunds')}
              onToggle={() => toggleSection('refunds')}
              impliedRefunds={filteredAggregates.impliedRefunds}
              showRefunds={card.showRefunds}
              onShowRefundsChange={(v) => updateCard({ showRefunds: v })}
            />
          )}

          {hasLayoutSection && (
            <LayoutPanel
              open={openSections.has('layout')}
              onToggle={() => toggleSection('layout')}
              isDailyActivity={templateId === 'daily-activity'}
              format={card.format}
              hasHeaderToggle={hasHeaderToggle}
              hasFooterToggle={hasFooterToggle}
              showHeader={card.showHeader}
              onShowHeaderChange={(v) => updateCard({ showHeader: v })}
              showFooter={card.showFooter}
              onShowFooterChange={(v) => updateCard({ showFooter: v })}
              showUAFlag={card.showUAFlag}
              onShowUAFlagChange={(v) => updateCard({ showUAFlag: v })}
              showChart={card.showChart}
              onShowChartChange={(v) => updateCard({ showChart: v })}
              showBars={card.showBars}
              onShowBarsChange={(v) => updateCard({ showBars: v })}
              showBestDay={card.showBestDay}
              onShowBestDayChange={(v) => updateCard({ showBestDay: v })}
            />
          )}

          {showGoal && (
            <GoalPanel
              open={openSections.has('goal')}
              onToggle={() => toggleSection('goal')}
              goal={goal}
              onGoalChange={setGoal}
              requiresGoal={requiresGoal}
            />
          )}

          {templateId === 'report' && crossItems && (
            <ReportPeriodPanel
              periodKey={card.textOverrides['periodKey'] ?? 'all'}
              onChange={(key) => updateCard({ textOverrides: { ...card.textOverrides, periodKey: key } })}
              quarters={crossQuarters}
            />
          )}

          <TextEditorPanel
            open={openSections.has('textEditor')}
            onToggle={() => toggleSection('textEditor')}
            templateId={templateId}
            textFields={textFields}
            textOverrides={card.textOverrides}
            onSetOverride={(key, value) => updateCard({ textOverrides: { ...card.textOverrides, [key]: value } })}
            onReset={() => updateCard({ textOverrides: {} })}
            defaultFor={textDefaultFor}
          />

          {templateId === 'comments' && (
            <CommentPickerPanel
              open={openSections.has('comments')}
              onToggle={() => toggleSection('comments')}
              personalComments={personalComments}
              selectedKeys={card.selectedCommentKeys}
              selectedCount={selectedComments.length}
              onToggleComment={(text) => {
                const checked = card.selectedCommentKeys.includes(text);
                updateCard({
                  selectedCommentKeys: checked
                    ? card.selectedCommentKeys.filter((k) => k !== text)
                    : [...card.selectedCommentKeys, text],
                });
              }}
            />
          )}

          <CaptionPanel
            open={openSections.has('caption')}
            onToggle={() => toggleSection('caption')}
            captionValue={captionValue}
            onCaptionChange={(v) => updateCard({ captionText: v })}
            isEdited={card.captionText !== null}
            onRegenerate={() => updateCard({ captionText: null })}
            onCopy={handleCopyCaption}
            copied={captionCopied}
            multiCard={cards.length > 1}
            cardCount={cards.length}
            onCopyAll={handleCopyAllCaptions}
            allCopied={allCaptionsCopied}
          />

          {availableStickers.length > 0 && (
            <StickersPanel
              open={openSections.has('stickers')}
              onToggle={() => toggleSection('stickers')}
              availableStickers={availableStickers}
              onExport={handleStickerExport}
            />
          )}

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
                <SpinnerIcon className="w-5 h-5 animate-spin" />
                {t('exporting')}
              </>
            ) : (
              <>
                <DownloadIcon className="w-5 h-5" />
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
        <AddTemplateModal
          groups={addableGroups}
          openGroupIds={addGroupsOpen}
          onToggleGroup={(id) =>
            setAddGroupsOpen((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
          onSelect={handleAddTemplate}
          onClose={() => setAddOpen(false)}
        />
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
            {renderCard(zipCard, { templateRef: zipInnerRef })}
          </div>
        </div>
      )}
    </div>
  );
}
