import { useRef, useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../context/AppContext';
import type { Aggregates, CommentInsights, TemplateType, CampaignDataset } from '../types';
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
import { buildReport, datasetsToItems } from '../utils/campaignAnalytics';
import { getPersonalComments } from '../utils/commentAnalyzer';
import { TEMPLATE_GROUPS as GROUPS } from '../utils/templateConfig';
import { ArrowLeftIcon, CheckIcon, ChevronDownIcon, XIcon } from '../icons';

const NATIVE = 1080;

export function GalleryPage() {
  const { t } = useTranslation('gallery');
  const { t: tCamp } = useTranslation('campaigns');
  const { state, dispatch, handleTemplateSelect, handleTemplatesSelect } = useAppContext();
  const { app } = state;
  // Selection (series, insertion order = export order) and open groups live in
  // app state so they survive the gallery ⇄ export round trip
  const selection = app.gallerySelection;
  const openGroups = useMemo(() => new Set(app.galleryOpenGroups), [app.galleryOpenGroups]);

  const setSelection = (next: TemplateType[]) =>
    dispatch({ type: 'GALLERY_UI', payload: { selection: next } });

  const toggleSelection = (id: TemplateType) => {
    setSelection(selection.includes(id) ? selection.filter((s) => s !== id) : [...selection, id]);
  };

  // Coming back with an active series: make sure its groups are visible
  useEffect(() => {
    if (selection.length === 0) return;
    const needed = GROUPS.filter((g) => g.ids.some((id) => selection.includes(id))).map((g) => g.id);
    const missing = needed.filter((id) => !openGroups.has(id));
    if (missing.length > 0) {
      dispatch({ type: 'GALLERY_UI', payload: { openGroups: [...openGroups, ...missing] } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  // Comment-based templates are only offered when there's actual comment data
  const previewComments: SelectedComment[] = useMemo(
    () => (app.donations ? getPersonalComments(app.donations, 3) : []),
    [app.donations],
  );

  if (!app.aggregates) return null;

  const hasEmojis = (app.commentInsights?.topEmojis.length ?? 0) > 0;
  const isMulti = (app.campaignDatasets?.length ?? 0) >= 2;
  const visibleIds = (ids: TemplateType[]) =>
    ids.filter((id) => {
      if (id === 'emoji-cloud') return hasEmojis;
      if (id === 'comments') return previewComments.length > 0;
      if (id === 'report' || id === 'campaigns-chart') return isMulti;
      return true;
    });

  function toggleGroup(id: string) {
    const next = new Set(openGroups);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    dispatch({ type: 'GALLERY_UI', payload: { openGroups: [...next] } });
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-900">{t('title')}</h2>
          {app.campaignDatasets && app.campaignDatasets.length >= 2 && (
            <span className="text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full px-3 py-1">
              {tCamp('multiModeBadge', { count: app.campaignDatasets.length })}
            </span>
          )}
        </div>
        <button
          onClick={() => dispatch({ type: 'GO_TO_STEP', payload: 'insights' })}
          className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800
                     bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm
                     hover:border-gray-300 transition-all"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          {t('backButton')}
        </button>
      </div>

      <div className="space-y-3">
        {GROUPS.map((group) => {
          const isOpen = openGroups.has(group.id);
          const ids = visibleIds(group.ids);
          if (ids.length === 0) return null;
          return (
            <div key={group.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{group.icon}</span>
                  <h3 className="text-base font-semibold text-gray-800">{t(group.labelKey)}</h3>
                  <span className="text-xs text-gray-400 font-medium">{ids.length}</span>
                </div>
                <ChevronDownIcon
                  className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isOpen && (
                <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 border-t border-gray-100">
                  {ids.map((id) => {
                    const selectedIdx = selection.indexOf(id);
                    return (
                      <div
                        key={id}
                        className={`group relative bg-gray-50 rounded-xl border text-left mt-4
                                   hover:shadow-md transition-all duration-150 overflow-hidden flex flex-col
                                   ${selectedIdx >= 0 ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-gray-100 hover:border-indigo-300'}`}
                      >
                        {/* Series checkbox — top-right, numbered by selection order */}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleSelection(id); }}
                          title={t('selectBar.toggleHint')}
                          className={`absolute top-2 right-2 z-10 w-7 h-7 rounded-full flex items-center justify-center
                                     text-xs font-bold shadow-sm border transition-all
                                     ${selectedIdx >= 0
                                       ? 'bg-indigo-600 border-indigo-600 text-white'
                                       : 'bg-white/90 border-gray-300 text-transparent hover:text-gray-300 hover:border-indigo-400'}`}
                        >
                          {selectedIdx >= 0 ? selectedIdx + 1 : <CheckIcon className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          // In selection mode a tile click toggles the series —
                          // an accidental click can't discard the selection
                          onClick={() => (selection.length > 0 ? toggleSelection(id) : handleTemplateSelect(id))}
                          className="text-left flex flex-col flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                        >
                          <TemplatePreview
                            id={id}
                            aggregates={app.aggregates!}
                            goal={app.goal}
                            commentInsights={app.commentInsights}
                            previewComments={previewComments}
                            campaignDatasets={app.campaignDatasets}
                          />
                          <div className="p-4 flex flex-col gap-1.5 flex-1">
                            <p className="font-semibold text-gray-900 text-sm">{t(`templates.${id}.name`)}</p>
                            <p className="text-xs text-gray-500 leading-relaxed">{t(`templates.${id}.description`)}</p>
                            <p className="mt-auto pt-1 text-xs font-semibold text-indigo-600 group-hover:text-indigo-700">
                              {selection.length > 0
                                ? selectedIdx >= 0
                                  ? t('selectBar.inSeries', { n: selectedIdx + 1 })
                                  : t('selectBar.addTile')
                                : t('useTemplate')}
                            </p>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Series bar — appears when templates are marked for the stack */}
      {selection.length > 0 && (
        <div className="sticky bottom-4 mt-6 z-20 flex justify-center animate-fade-in">
          <div className="flex items-center gap-3 bg-white border border-indigo-200 rounded-2xl shadow-lg px-4 py-3">
            <span className="text-sm text-gray-600">
              {t('selectBar.count', { count: selection.length })}
            </span>
            <button
              onClick={() => handleTemplatesSelect(selection)}
              className="px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors"
            >
              {t('selectBar.edit')}
            </button>
            <button
              onClick={() => setSelection([])}
              title={t('selectBar.clear')}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Responsive tile preview ──────────────────────────────────────────────────

interface TemplatePreviewProps {
  id: TemplateType;
  aggregates: Aggregates;
  goal?: number;
  commentInsights: CommentInsights | null;
  previewComments: SelectedComment[];
  campaignDatasets: CampaignDataset[] | null;
}

function TemplatePreview({ id, aggregates, goal, commentInsights, previewComments, campaignDatasets }: TemplatePreviewProps) {
  const { t: tCamp } = useTranslation('campaigns');
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  const crossItems = useMemo(
    () => (campaignDatasets && campaignDatasets.length >= 2 ? datasetsToItems(campaignDatasets) : null),
    [campaignDatasets],
  );
  const previewReport = useMemo(() => (crossItems ? buildReport(crossItems, { kind: 'all' }) : null), [crossItems]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) setScale(w / NATIVE);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-t-2xl overflow-hidden"
      style={{ paddingBottom: '100%' }}
    >
      {scale > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: NATIVE,
            height: NATIVE,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {id === 'progress' && <ProgressCard aggregates={aggregates} goal={goal} format="post" />}
          {id === 'daily-activity' && <DailyActivityCard aggregates={aggregates} format="post" />}
          {id === 'thank-you' && <ThankYouCard aggregates={aggregates} format="post" />}
          {id === 'milestone' && <MilestoneCard aggregates={aggregates} goal={goal} format="post" />}
          {id === 'donors-count' && <DonorsCountCard aggregates={aggregates} format="post" />}
          {id === 'urgency' && <UrgencyCard aggregates={aggregates} goal={goal} format="post" />}
          {id === 'top-donors' && <TopDonorsCard aggregates={aggregates} format="post" mode="sum" />}
          {id === 'top-donors-count' && <TopDonorsCard aggregates={aggregates} format="post" mode="count" />}
          {id === 'final-report' && <FinalReportCard aggregates={aggregates} format="post" />}
          {id === 'concrete-ask' && <ConcreteAskCard aggregates={aggregates} goal={goal} format="post" />}
          {id === 'emoji-cloud' && <EmojiCloudCard aggregates={aggregates} commentInsights={commentInsights} format="post" />}
          {id === 'comments' && <CommentsCard aggregates={aggregates} selectedComments={previewComments} format="post" />}
          {id === 'weekly-recap' && <WeeklyRecapCard aggregates={aggregates} format="post" />}
          {id === 'speed' && <SpeedCard aggregates={aggregates} format="post" />}
          {id === 'funds-flow' && <FundsFlowCard aggregates={aggregates} format="post" />}
          {id === 'report' && previewReport && <ReportCard report={previewReport} periodLabel={tCamp('report.labelAll')} format="post" />}
          {id === 'campaigns-chart' && crossItems && <CampaignsChartCard items={crossItems} format="post" />}
        </div>
      )}
    </div>
  );
}
