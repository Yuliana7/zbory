import { useRef, useState, useLayoutEffect, useMemo, useEffect, useCallback } from 'react';
import { revealInput } from '../../utils/revealInput';
import { readBackgroundImage } from '../../utils/imageResize';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../context/AppContext';
import type { TemplateType, Aggregates, CommentInsights, CardState } from '../../types';
import type { SelectedComment } from '../../components/templates/CommentsCard';
import { analyzeCampaigns, datasetsToItems } from '../../utils/campaignAnalytics';
import { exportToPNG } from '../../utils/exportPNG';
import { formatUkrainianDate } from '../../utils/dataAggregator';
import { getPersonalComments } from '../../utils/commentAnalyzer';
import { type Format, FORMAT_DIMS, toDateInput, filterAggregates, donationsInRange } from '../../utils/exportStack';
import { useCardStack } from './hooks/useCardStack';
import { PREVIEW_MIN_SCALE, PREVIEW_PAD, PREVIEW_PAD_MIN, useCollapsingPreview } from './hooks/useCollapsingPreview';
import { useZipExport } from './hooks/useZipExport';
import {
  TEMPLATE_TEXT_FIELDS,
  TEMPLATE_SUPPORTS_DATE_RANGE,
  TEMPLATE_REQUIRES_GOAL,
  TEMPLATE_REMOVABLE_ELEMENTS,
  offeredFor,
  groupsFor,
} from '../../utils/templateConfig';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  DownloadIcon,
  EditIcon,
  PlusIcon,
  SpinnerIcon,
  TrashIcon,
} from '../../icons';
import { CardCanvas } from './CardCanvas';
import { ownJarLink } from '../../utils/ownJars';
import { ToggleRow } from './shared';
import { FormatPanel } from './panels/FormatPanel';
import { BackgroundPanel } from './panels/BackgroundPanel';
import { ThemesPanel } from './panels/ThemesPanel';
import { FriendsPanel } from './panels/FriendsPanel';
import { RafflePanel } from './panels/RafflePanel';
import { hasRaffle, raffleKindOf } from '../../utils/raffles';
import { BackgroundEditorOverlay } from './panels/BackgroundEditorOverlay';
import { FontScalePanel } from './panels/FontScalePanel';
import { DateRangePanel } from './panels/DateRangePanel';
import { RefundsPanel } from './panels/RefundsPanel';
import { ElementsEditorOverlay } from './panels/ElementsEditorOverlay';
import { GoalPanel } from './panels/GoalPanel';
import { ReportPeriodPanel } from './panels/ReportPeriodPanel';
import { TextEditorPanel } from './panels/TextEditorPanel';
import { CommentPickerPanel } from './panels/CommentPickerPanel';
import { AddTemplateModal } from './panels/AddTemplateModal';
import { stableViewportHeight } from '../../utils/stableViewport';

// Below the xl breakpoint the page is one column and the preview is pinned to the top
const SINGLE_COLUMN_MAX = 1280;
const PREVIEW_GAP = 16;

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

  const {
    cards,
    setCurrent,
    safeCurrent,
    card,
    sharedStyle,
    updateCard,
    style,
    styleUnlinked,
    patchStyle,
    applyTheme,
    goPrev,
    goNext,
    removeCurrentCard,
    addTemplate,
  } = useCardStack(stackIds, app, dispatch, personalComments);
  const templateId = card.templateId;

  const styleBadge =
    cards.length > 1 ? (styleUnlinked ? t('stack.ownStyleBadge') : t('stack.sharedBadge')) : undefined;

  // ── Page-level state ──
  const [scale, setScale] = useState(0.5);
  const [goal, setGoal] = useState(app.goal ? String(app.goal) : '');
  const [isExporting, setIsExporting] = useState(false);
  const [showSafeZones, setShowSafeZones] = useState(false);
  const [elementsEditorOpen, setElementsEditorOpen] = useState(false);
  const [backgroundEditorOpen, setBackgroundEditorOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  // Picker categories mirror the gallery; first one open by default
  const [addGroupsOpen, setAddGroupsOpen] = useState<Set<string>>(
    () => new Set([groupsFor(!!app.ownJar)[0].id]),
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
  const previewTopRef = useRef<HTMLDivElement>(null);
  const previewNavRef = useRef<HTMLDivElement>(null);
  const previewBgRef = useRef<HTMLDivElement>(null);
  const previewSpacerRef = useRef<HTMLDivElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const touchStartX = useRef<number | null>(null);

  const { zipQueue, zipRef, zipInnerRef, zipCard, startZipExport } = useZipExport(cards);

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    patchStyle({ bgImage: await readBackgroundImage(file), bgTransparent: false, bgColor: null });
  };

  const dims = FORMAT_DIMS[card.format];

  const campaignMin = toDateInput(fullAggregates.firstDate);

  const rangeCount = useMemo(
    () => (card.dateFrom || card.dateTo ? donationsInRange(donations, card.dateFrom, card.dateTo).length : donations.length),
    [donations, card.dateFrom, card.dateTo],
  );
  const filteredAggregates = useMemo(
    () => filterAggregates(donations, fullAggregates, card.dateFrom, card.dateTo),
    [donations, fullAggregates, card.dateFrom, card.dateTo],
  );

  useLayoutEffect(() => {
    const calculate = () => {
      if (!previewContainerRef.current) return;
      const containerW = previewContainerRef.current.clientWidth - 2 * PREVIEW_PAD;
      // not innerHeight: it changes as Safari's toolbar hides and shows during a scroll, and the card
      // would jump in size mid-collapse
      const containerH = stableViewportHeight() * 0.65;
      const scaleW = containerW / dims.width;
      const scaleH = containerH / dims.height;
      setScale(Math.min(scaleW, scaleH, 0.55));
    };
    calculate();
    window.addEventListener('resize', calculate);
    return () => window.removeEventListener('resize', calculate);
  }, [dims]);

  const [singleColumn, setSingleColumn] = useState(() => window.innerWidth < SINGLE_COLUMN_MAX);
  useEffect(() => {
    const onResize = () => setSingleColumn(window.innerWidth < SINGLE_COLUMN_MAX);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const fullCardH = Math.ceil(dims.height * scale);
  useCollapsingPreview(
    { box: previewContainerRef, spacer: previewSpacerRef, marker: previewTopRef, background: previewBgRef, card: previewClipRef, nav: previewNavRef },
    fullCardH,
    singleColumn,
  );

  // Any text field focused in the controls must end up below the pinned preview
  // and above the keyboard (see revealInput).
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) revealInput(el);
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);

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
      if (key === 'linkUrl' && app.ownJar?.shortId) return ownJarLink(app.ownJar.shortId);
      if (key === 'achievedLabel' && templateId === 'milestone') return t(`templates:milestone.${milestoneAchievedKey}`);
      if (key === 'dateRange') return `${formatUkrainianDate(filteredAggregates.firstDate)} — ${formatUkrainianDate(filteredAggregates.lastDate)}`;
      return t(`templates:${templateId}.${key}`);
    },
    [app.activeCampaignName, app.ownJar, templateId, milestoneAchievedKey, filteredAggregates, t],
  );

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

  const handleAddTemplate = (id: TemplateType) => {
    addTemplate(id);
    setAddOpen(false);
  };

  // Same categories as the template gallery, with data-gated templates hidden
  const hasFriends = (app.friends ?? []).some((f) => f.raised > 0);
  const hasClosedFriends = (app.friends ?? []).some((f) => f.closed && f.raised > 0);
  const addableGroups = useMemo(() => {
    const available = (id: TemplateType) => {
      if (!offeredFor(id, !!app.ownJar)) return false;
      if (app.ownJar) return true;
      if (id === 'emoji-cloud') return (commentInsights?.topEmojis.length ?? 0) > 0;
      if (id === 'comments') return personalComments.length > 0;
      if (id === 'report' || id === 'campaigns-chart') return crossItems != null;
      if (id === 'friends-leaderboard' || id === 'friends-stats') return hasFriends;
      if (id === 'friends-closed') return hasClosedFriends;
      const raffleKind = raffleKindOf(id);
      if (raffleKind) return hasRaffle(app.raffles, raffleKind);
      return true;
    };
    return groupsFor(!!app.ownJar).map((g) => ({ ...g, ids: g.ids.filter(available) })).filter(
      (g) => g.ids.length > 0,
    );
  }, [commentInsights, personalComments, crossItems, hasFriends, hasClosedFriends, app.raffles, app.ownJar]);

  // Ceil, not round: previewClipRef clips the scaled-down card at exactly
  // these pixel dimensions. Rounding down even by a fraction of a pixel made
  // the clip box marginally smaller than the true scaled content, which the
  // live compositor would crop right at the edge (most visible on trailing
  // glyphs like emoji, whose visual ink often extends past their advance box)
  // — exports/screenshots render the native, unscaled card and never hit this.
  const previewW = Math.ceil(dims.width * scale);

  const textFields = TEMPLATE_TEXT_FIELDS[templateId];
  // a friendly jar has one total and no donations to pick a period from
  const supportsDateRange = TEMPLATE_SUPPORTS_DATE_RANGE[templateId] && !app.ownJar;
  const requiresGoal = TEMPLATE_REQUIRES_GOAL[templateId];
  const showGoal = requiresGoal || templateId === 'progress' || templateId === 'final-report' || templateId === 'friendly-jar';

  const removableElements = TEMPLATE_REMOVABLE_ELEMENTS[templateId];
  const cardRaffleKind = raffleKindOf(templateId);
  const cardRaffles = cardRaffleKind ? (app.raffles ?? []).filter((r) => r.kind === cardRaffleKind) : [];

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
      friends={app.friends}
      raffles={app.raffles}
      donations={donations}
      commentInsights={commentInsights}
      crossItems={crossItems}
      selectedComments={overrides?.selectedComments ?? commentsFor(c)}
      activeCampaignName={app.activeCampaignName}
      ownJar={app.ownJar}
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

      {/* flex on a single column: a sticky child can then travel the whole column (in a grid it stays
          within its own row). overflowAnchor none: Chrome must not "correct" the scroll while the
          preview changes size. */}
      <div
        className="flex flex-col xl:grid xl:grid-cols-[1fr_340px] gap-8 items-stretch xl:items-start"
        style={{ position: 'relative', overflowAnchor: 'none' }}
      >
        {/* Where the preview sits before it pins — marks the start of its collapse */}
        <div ref={previewTopRef} className="xl:hidden -mb-8" style={{ height: 0 }} />

        {/* Preview. Collapsing moves nothing else on the page. Only what is visibly there takes touches
            (pointer-events on the background, card and nav): everything else keeps its full size in the
            layout and would otherwise sit invisibly over the controls behind it. See useCollapsingPreview. */}
        <div
          ref={previewContainerRef}
          className={`relative flex flex-col items-center pointer-events-none ${singleColumn ? 'preview-collapse' : 'justify-center'}`}
          style={{ position: 'sticky', top: 'var(--safe-top)', zIndex: 100, padding: PREVIEW_PAD }}
        >
          <div ref={previewBgRef} data-pinned-preview className="preview-bg absolute inset-x-0 top-0 h-full bg-gray-100 rounded-2xl pointer-events-auto" />
          <div
          className="relative flex flex-col items-center"
          onTouchStart={(e) => {
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
            className="preview-card pointer-events-auto"
            style={{
              width: previewW,
              height: fullCardH,
              overflow: 'hidden',
              borderRadius: 8,
              transformOrigin: 'top center',
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: dims.width,
                height: dims.height,
                // zoom, not transform: scale() — zoom makes the browser
                // actually re-layout/re-paint this subtree at the final
                // size instead of rasterizing at native 1080px and visually
                // transforming it after the fact. The transform+overflow:
                // hidden combination was leaving stale/partial paints in
                // Firefox (clipped emoji glyphs) that a forced reflow only
                // fixed momentarily — zoom sidesteps that bug category
                // entirely rather than working around it.
                zoom: scale,
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

          {/* Stack navigation fades as the collapse starts. Wraps onto extra lines instead of
              overflowing the preview box once enough cards make the dots row too wide. */}
          <div ref={previewNavRef} className="preview-nav w-full pointer-events-auto" style={{ paddingTop: PREVIEW_GAP }}>
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
                    onClick={removeCurrentCard}
                    title={t('stack.removeCard')}
                    className="p-2 rounded-full bg-white border border-gray-200 text-gray-400 shadow-sm hover:text-red-500 hover:border-red-300 transition-all"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
          </div>
        </div>

        <div ref={previewSpacerRef} className="xl:hidden -mt-8" aria-hidden="true" />

        {/* Sidebar. On a single column it is at least a screen tall minus the collapsed preview, so
            a short list of controls can still scroll the preview all the way down. */}
        <div className="space-y-4" style={singleColumn ? { minHeight: `calc(100vh - ${Math.ceil(fullCardH * PREVIEW_MIN_SCALE) + 2 * PREVIEW_PAD_MIN + 32}px)` } : undefined}>
          <FormatPanel
            open={openSections.has('format')}
            onToggle={() => toggleSection('format')}
            format={card.format}
            onFormatChange={(f: Format) => updateCard({ format: f })}
            showSafeZones={showSafeZones}
            onShowSafeZonesChange={setShowSafeZones}
          />

          <button
            onClick={() => setElementsEditorOpen(true)}
            className="w-full flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-4 text-left text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <EditIcon className="w-4 h-4 text-gray-400" />
            {t('layout.editButton')}
          </button>

          {/* its own switch, so changing just this card's font size doesn't mean opening the background panel */}
          {cards.length > 1 && (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <ToggleRow
                label={t('stack.unlinkStyle')}
                value={styleUnlinked}
                onChange={(v) => updateCard({ styleOverride: v ? { ...sharedStyle } : null })}
              />
              <p className="mt-1 text-xs text-gray-400">{t('stack.unlinkHint')}</p>
            </div>
          )}

          <ThemesPanel
            open={openSections.has('themes')}
            onToggle={() => toggleSection('themes')}
            style={style}
            onApplyTheme={applyTheme}
          />

          <BackgroundPanel
            open={openSections.has('background')}
            onToggle={() => toggleSection('background')}
            style={style}
            onPatchStyle={patchStyle}
            styleBadge={styleBadge}
            bgInputRef={bgInputRef}
            onBgUpload={handleBgUpload}
            onEditPosition={() => setBackgroundEditorOpen(true)}
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
              rangeCount={rangeCount}
              onChange={(dateFrom, dateTo) => updateCard({ dateFrom, dateTo })}
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

          {showGoal && (
            <GoalPanel
              open={openSections.has('goal')}
              onToggle={() => toggleSection('goal')}
              goal={goal}
              onGoalChange={setGoal}
              requiresGoal={requiresGoal}
            />
          )}

          {(templateId === 'friends-leaderboard' || templateId === 'friends-closed') && (
            <FriendsPanel
              open={openSections.has('friends')}
              onToggle={() => toggleSection('friends')}
              count={(app.friends ?? []).filter((f) => f.raised > 0).length}
              closedOnly={templateId === 'friends-closed'}
              hiddenFriendIds={card.hiddenFriendIds ?? []}
              onHiddenFriendIdsChange={(ids) => updateCard({ hiddenFriendIds: ids })}
            />
          )}

          {cardRaffles.length > 1 && (
            <RafflePanel
              open={openSections.has('raffle')}
              onToggle={() => toggleSection('raffle')}
              raffles={cardRaffles}
              selectedId={card.raffleId}
              onSelect={(raffleId) => updateCard({ raffleId })}
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

      {/* Full-screen tap-to-remove editor */}
      {elementsEditorOpen && (
        <ElementsEditorOverlay
          card={card}
          elements={removableElements}
          dims={dims}
          aggregates={filteredAggregates}
          selectedComments={selectedComments}
          renderCard={renderCard}
          onChange={updateCard}
          onClose={() => setElementsEditorOpen(false)}
        />
      )}

      {/* Full-screen background editor */}
      {backgroundEditorOpen && style.bgImage && (
        <BackgroundEditorOverlay
          card={card}
          style={style}
          onPatchStyle={patchStyle}
          dims={dims}
          aggregates={filteredAggregates}
          selectedComments={selectedComments}
          renderCard={renderCard}
          onClose={() => setBackgroundEditorOpen(false)}
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
