import { useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../context/AppContext';
import type { Aggregates, TemplateType } from '../types';
import { ProgressCard } from '../components/templates/ProgressCard';
import { DailyActivityCard } from '../components/templates/DailyActivityCard';
import { ThankYouCard } from '../components/templates/ThankYouCard';
import { MilestoneCard } from '../components/templates/MilestoneCard';
import { DonorsCountCard } from '../components/templates/DonorsCountCard';
import { UrgencyCard } from '../components/templates/UrgencyCard';
import { TopDonorsCard } from '../components/templates/TopDonorsCard';
import { WeeklyRecapCard } from '../components/templates/WeeklyRecapCard';
import { SpeedCard } from '../components/templates/SpeedCard';

const NATIVE = 1080;

interface TemplateGroup {
  label: string;
  icon: string;
  ids: TemplateType[];
}

const GROUPS: TemplateGroup[] = [
  { label: 'Прогрес', icon: '📊', ids: ['progress', 'milestone', 'urgency'] },
  { label: 'Активність', icon: '📈', ids: ['daily-activity', 'weekly-recap', 'speed'] },
  { label: 'Люди', icon: '💛', ids: ['thank-you', 'donors-count', 'top-donors'] },
];

export function GalleryPage() {
  const { t } = useTranslation('gallery');
  const { state, dispatch, handleTemplateSelect } = useAppContext();
  const { app } = state;

  if (!app.aggregates) return null;

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

      <div className="space-y-10">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">{group.icon}</span>
              <h3 className="text-lg font-semibold text-gray-700">{group.label}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {group.ids.map((id) => (
                <button
                  key={id}
                  onClick={() => handleTemplateSelect(id)}
                  className="group bg-white rounded-2xl border border-gray-100 shadow-sm text-left
                             hover:border-indigo-300 hover:shadow-lg transition-all duration-150 overflow-hidden
                             flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <TemplatePreview id={id} aggregates={app.aggregates!} goal={app.goal} />
                  <div className="p-5 flex flex-col gap-2 flex-1">
                    <p className="font-semibold text-gray-900 text-base">{t(`templates.${id}.name`)}</p>
                    <p className="text-sm text-gray-500 leading-relaxed">{t(`templates.${id}.description`)}</p>
                    <p className="mt-auto text-sm font-semibold text-indigo-600 group-hover:text-indigo-700">
                      {t('useTemplate')}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Responsive tile preview ──────────────────────────────────────────────────

interface TemplatePreviewProps {
  id: TemplateType;
  aggregates: Aggregates;
  goal?: number;
}

function TemplatePreview({ id, aggregates, goal }: TemplatePreviewProps) {
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
          {id === 'top-donors' && <TopDonorsCard aggregates={aggregates} format="post" />}
          {id === 'weekly-recap' && <WeeklyRecapCard aggregates={aggregates} format="post" />}
          {id === 'speed' && <SpeedCard aggregates={aggregates} format="post" />}
        </div>
      )}
    </div>
  );
}
