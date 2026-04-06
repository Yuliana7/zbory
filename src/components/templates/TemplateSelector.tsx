import type { TemplateType } from '../../types';

interface TemplateMeta {
  id: TemplateType;
  icon: string;
  name: string;
  description: string;
  badge?: string;
  badgeColor?: string;
}

const TEMPLATES: TemplateMeta[] = [
  {
    id: 'progress',
    icon: '🟪',
    name: 'Картка прогресу',
    description: 'Загальна сума, прогрес-бар, ціль (опційно)'
  },
  {
    id: 'daily-activity',
    icon: '📱',
    name: 'Активність за днями',
    description: 'Графік донатів, найкращий день'
  },
  {
    id: 'thank-you',
    icon: '💛',
    name: 'Подяка донатерам',
    description: 'Кількість донатерів, сума, теплий тон'
  },
];

interface TemplateSelectorProps {
  onSelect: (template: TemplateType) => void;
}

export function TemplateSelector({ onSelect }: TemplateSelectorProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
        Оберіть шаблон
      </h3>
      {TEMPLATES.map((tpl) => (
        <button
          key={tpl.id}
          onClick={() => onSelect(tpl.id)}
          className="w-full text-left bg-white rounded-xl p-4 border border-gray-100 shadow-sm
                     hover:border-indigo-300 hover:shadow-md transition-all duration-150 group"
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none">{tpl.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">
                  {tpl.name}
                </p>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{tpl.description}</p>
            </div>
            <svg
              className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors mt-1 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>
      ))}
    </div>
  );
}
