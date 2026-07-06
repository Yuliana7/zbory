import { useRef, useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../context/AppContext';
import type { Aggregates, CommentInsights, TemplateType } from '../types';
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
import { getPersonalComments } from '../utils/commentAnalyzer';

const NATIVE = 1080;

interface TemplateGroup {
  id: string;
  labelKey: string;
  icon: string;
  ids: TemplateType[];
}

const GROUPS: TemplateGroup[] = [
  { id: 'progress', labelKey: 'groups.progress', icon: '📊', ids: ['progress', 'milestone', 'urgency', 'concrete-ask', 'funds-flow', 'final-report'] },
  { id: 'activity', labelKey: 'groups.activity', icon: '📈', ids: ['daily-activity', 'weekly-recap', 'speed'] },
  { id: 'people',   labelKey: 'groups.people',   icon: '🫂', ids: ['thank-you', 'donors-count', 'top-donors', 'top-donors-count', 'emoji-cloud', 'comments'] },
];

export function GalleryPage() {
  const { t } = useTranslation('gallery');
  const { state, dispatch, handleTemplateSelect } = useAppContext();
  const { app } = state;
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set());

  // Comment-based templates are only offered when there's actual comment data
  const previewComments: SelectedComment[] = useMemo(
    () => (app.donations ? getPersonalComments(app.donations, 3) : []),
    [app.donations],
  );

  if (!app.aggregates) return null;

  const hasEmojis = (app.commentInsights?.topEmojis.length ?? 0) > 0;
  const visibleIds = (ids: TemplateType[]) =>
    ids.filter((id) => {
      if (id === 'emoji-cloud') return hasEmojis;
      if (id === 'comments') return previewComments.length > 0;
      return true;
    });

  function toggleGroup(id: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">{t('title')}</h2>
        <button
          onClick={() => dispatch({ type: 'GO_TO_STEP', payload: 'insights' })}
          className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800
                     bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm
                     hover:border-gray-300 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t('backButton')}
        </button>
      </div>

      <div className="space-y-3">
        {GROUPS.map((group) => {
          const isOpen = openGroups.has(group.id);
          const ids = visibleIds(group.ids);
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
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isOpen && (
                <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 border-t border-gray-100">
                  {ids.map((id) => (
                    <button
                      key={id}
                      onClick={() => handleTemplateSelect(id)}
                      className="group bg-gray-50 rounded-xl border border-gray-100 text-left mt-4
                                 hover:border-indigo-300 hover:shadow-md transition-all duration-150 overflow-hidden
                                 flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                      <TemplatePreview
                        id={id}
                        aggregates={app.aggregates!}
                        goal={app.goal}
                        commentInsights={app.commentInsights}
                        previewComments={previewComments}
                      />
                      <div className="p-4 flex flex-col gap-1.5 flex-1">
                        <p className="font-semibold text-gray-900 text-sm">{t(`templates.${id}.name`)}</p>
                        <p className="text-xs text-gray-500 leading-relaxed">{t(`templates.${id}.description`)}</p>
                        <p className="mt-auto pt-1 text-xs font-semibold text-indigo-600 group-hover:text-indigo-700">
                          {t('useTemplate')}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
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
}

function TemplatePreview({ id, aggregates, goal, commentInsights, previewComments }: TemplatePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

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
        </div>
      )}
    </div>
  );
}
