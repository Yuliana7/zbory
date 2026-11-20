import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fmtUah } from '../../utils/friendJars';
import { GoalReachedQuestion } from './GoalReachedQuestion';

export interface UnsaidGoal {
  kind: 'project' | 'ownJar';
  id: string;
  name: string;
  total: number;
}

/** Before «Мій рік»: the year's closed jars with no goal and no word on it, so «Цілей досягнуто» counts
 * them. Answers are kept; «Пропустити» goes on without them (they stay out of the count). */
export function YearGoalsSheet({
  year,
  items,
  onDone,
  onCancel,
}: {
  year: number;
  items: UnsaidGoal[];
  onDone: (answers: Map<string, boolean>) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation('archive');
  const [answers, setAnswers] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const answer = (id: string, v: boolean | undefined) =>
    setAnswers((prev) => {
      const next = new Map(prev);
      if (v === undefined) next.delete(id);
      else next.set(id, v);
      return next;
    });

  return (
    <div
      className="screen-overlay z-[300] bg-black/40 flex items-end sm:items-center justify-center sm:p-4 animate-fade-in text-left"
      style={{ paddingTop: 'var(--safe-top)' }}
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="year-goals-title"
        className="sheet-panel w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 space-y-4 overflow-y-auto overscroll-contain"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + var(--toolbar-gap) + 1.25rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 id="year-goals-title" className="text-lg font-bold text-gray-900">
            {t('yearGoals.title', { year })}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">{t('yearGoals.text')}</p>
        </div>

        <ul className="space-y-2">
          {items.map((it) => (
            <li key={`${it.kind}:${it.id}`} className="rounded-xl bg-gray-50 px-3.5 py-3 space-y-2">
              <p className="text-sm">
                <span className="font-semibold text-gray-900 [overflow-wrap:anywhere]">{it.name}</span>{' '}
                <span className="whitespace-nowrap text-gray-600">· {fmtUah(it.total)} ₴</span>
                {it.kind === 'ownJar' && <span className="block text-xs text-gray-500">{t('yearGoals.ownJar')}</span>}
              </p>
              <GoalReachedQuestion value={answers.get(`${it.kind}:${it.id}`)} onChange={(v) => answer(`${it.kind}:${it.id}`, v)} />
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2">
          <button onClick={() => onDone(answers)} className="btn-primary">
            {t('yearGoals.continue')}
          </button>
          <button onClick={() => onDone(new Map())} className="btn-secondary">
            {t('yearGoals.skip')}
          </button>
        </div>
      </div>
    </div>
  );
}
