import { useRef, useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import type { TemplateType } from '../types';
import { ProgressCard } from '../components/templates/ProgressCard';
import { DailyActivityCard } from '../components/templates/DailyActivityCard';
import { ThankYouCard } from '../components/templates/ThankYouCard';

interface TemplateMeta {
  id: TemplateType;
  name: string;
  description: string;
}

const TEMPLATES: TemplateMeta[] = [
  {
    id: 'progress',
    name: 'Картка прогресу',
    description: 'Сума зібраного, прогрес до цілі та мотивуючий заголовок',
  },
  {
    id: 'daily-activity',
    name: 'Активність за днями',
    description: 'Графік надходжень і найактивніший день збору',
  },
  {
    id: 'thank-you',
    name: 'Подяка донатерам',
    description: 'Тепле повідомлення з підсумком і кількістю учасників',
  },
];

const NATIVE = 1080;

export function GalleryPage() {
  const { state, dispatch, handleTemplateSelect } = useAppContext();
  const { app } = state;

  if (!app.aggregates) return null;

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Оберіть шаблон</h2>
        <button
          onClick={() => dispatch({ type: 'GO_TO_STEP', payload: 'insights' })}
          className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800
                     bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm
                     hover:border-gray-300 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Назад до аналітики
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {TEMPLATES.map((tpl) => (
          <button
            key={tpl.id}
            onClick={() => handleTemplateSelect(tpl.id)}
            className="group bg-white rounded-2xl border border-gray-100 shadow-sm text-left
                       hover:border-indigo-300 hover:shadow-lg transition-all duration-150 overflow-hidden
                       flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <TemplatePreview id={tpl.id} aggregates={app.aggregates!} goal={app.goal} />
            <div className="p-5 flex flex-col gap-2 flex-1">
              <p className="font-semibold text-gray-900 text-base">{tpl.name}</p>
              <p className="text-sm text-gray-500 leading-relaxed">{tpl.description}</p>
              <p className="mt-auto text-sm font-semibold text-indigo-600 group-hover:text-indigo-700">
                Використати шаблон →
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Responsive tile preview ──────────────────────────────────────────────────

import type { Aggregates } from '../types';

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
        </div>
      )}
    </div>
  );
}
