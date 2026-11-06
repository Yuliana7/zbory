import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isIOS, saveBlob } from '../../utils/download';
import { buildReminderIcs } from '../../utils/reminder';

const KEY = 'zbory.reminderTime';
const DEFAULT_TIME = '21:00';

const readTime = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

/** Opt-in: pick a time and hand the calendar a daily event. The calendar does the reminding; the app
 * only remembers the chosen time to show it. */
export function ReminderCard() {
  const { t } = useTranslation('insights');
  const [added, setAdded] = useState(readTime);
  const [open, setOpen] = useState(!!added);
  const [time, setTime] = useState(added ?? DEFAULT_TIME);

  const ics = () =>
    buildReminderIcs({
      time,
      title: t('reminder.event'),
      details: t('reminder.details'),
      url: `${location.origin}${import.meta.env.BASE_URL}`,
    });

  const remember = () => {
    setAdded(time);
    try {
      localStorage.setItem(KEY, time);
    } catch {
      /* only the note below is lost */
    }
  };

  const saveFile = () => {
    void saveBlob(new Blob([ics()], { type: 'text/calendar;charset=utf-8' }), 'zbory-reminder.ics');
    remember();
  };

  const add = () => {
    // The iOS share sheet would only file it away; opening the event offers «Add to Calendar».
    if (isIOS()) {
      remember();
      location.href = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics())}`;
    } else {
      saveFile();
    }
  };

  return (
    <div className="mt-4 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <label className="flex items-center justify-between gap-3 cursor-pointer">
        <span className="text-sm font-semibold text-gray-700">{t('reminder.title')}</span>
        <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} className="w-5 h-5 shrink-0 accent-indigo-600" />
      </label>
      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-gray-500">{t('reminder.hint')}</p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-gray-500 mb-1">{t('reminder.time')}</span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <button onClick={add} disabled={!time} className="btn-primary disabled:opacity-50">{t('reminder.add')}</button>
          </div>
          {isIOS() && (
            <button onClick={saveFile} disabled={!time} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
              {t('reminder.saveFile')}
            </button>
          )}
          {added && <p className="text-xs text-gray-500">{t('reminder.added', { time: added })}</p>}
        </div>
      )}
    </div>
  );
}
