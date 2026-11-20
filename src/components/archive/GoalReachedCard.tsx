import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArchiveIcon, CheckIcon } from '../../icons';

const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;
const snoozeKey = (id: string) => `zbory.closeSnooze.${id}`;
const snoozedUntil = (id: string) => {
  try {
    return Number(localStorage.getItem(snoozeKey(id)) ?? 0) + SNOOZE_MS;
  } catch {
    return 0;
  }
};

/** Once a project reaches its goal: an offer to close it and move it to the archive. «Ще збираємо»
 * hides the offer for a few days (donations often keep coming after the goal). */
export function GoalReachedCard({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { t } = useTranslation('archive');
  const [hidden, setHidden] = useState(() => snoozedUntil(projectId) > Date.now());
  if (hidden) return null;
  const snooze = () => {
    try {
      localStorage.setItem(snoozeKey(projectId), String(Date.now()));
    } catch {
      /* private mode: it is hidden until the page reloads */
    }
    setHidden(true);
  };
  return (
    <section className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5 space-y-3 animate-fade-in">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
          <CheckIcon className="h-5 w-5" />
        </span>
        <h3 className="text-base font-bold text-emerald-900">{t('reached.title')}</h3>
      </div>
      <p className="text-sm leading-relaxed text-emerald-900">{t('reached.text')}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button onClick={onClose} className="btn-primary flex items-center justify-center gap-2 sm:flex-1">
          <ArchiveIcon className="h-4 w-4" />
          {t('reached.close')}
        </button>
        <button onClick={snooze} className="rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-emerald-900 hover:bg-emerald-100 transition-colors">
          {t('reached.later')}
        </button>
      </div>
    </section>
  );
}
