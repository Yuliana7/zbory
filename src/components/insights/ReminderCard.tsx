import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isIOS, saveBlob } from '../../utils/download';
import { APP_URL, REMINDER_MINUTES, buildReminderIcs, reminderFile } from '../../utils/reminder';

const KEY = 'zbory.reminderTime';
const DEFAULT_TIME = '21:00';
const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));

const readTime = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

const SELECT = 'px-3 py-2 rounded-lg border border-gray-300 bg-white text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500';

/** Opt-in: pick a time and hand the calendar a daily event. The calendar does the reminding; the app
 * only remembers the chosen time to show it. The button is a plain link to a built file (see
 * vite.config.ts): that is what makes an iPhone offer «Add to Calendar», and it needs a real tap on a real link. */
export function ReminderCard() {
  const { t } = useTranslation('insights');
  const [added, setAdded] = useState(readTime);
  const [open, setOpen] = useState(!!added);
  const start = (added ?? DEFAULT_TIME).split(':');
  const [hour, setHour] = useState(HOURS.includes(start[0]) ? start[0] : '21');
  const [minute, setMinute] = useState(REMINDER_MINUTES.includes(start[1]) ? start[1] : '00');
  const time = `${hour}:${minute}`;

  const remember = () => {
    setAdded(time);
    try {
      localStorage.setItem(KEY, time);
    } catch {
      /* only the note below is lost */
    }
  };

  const saveFile = () => {
    const ics = buildReminderIcs({ time, title: t('reminder.event'), details: t('reminder.details'), url: APP_URL });
    void saveBlob(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), 'zbory-reminder.ics');
    remember();
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
            <div>
              <span className="block text-xs font-medium text-gray-500 mb-1">{t('reminder.time')}</span>
              <div className="flex items-center gap-1">
                <select value={hour} onChange={(e) => setHour(e.target.value)} aria-label={t('reminder.hour')} className={SELECT}>
                  {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
                <span aria-hidden="true">:</span>
                <select value={minute} onChange={(e) => setMinute(e.target.value)} aria-label={t('reminder.minute')} className={SELECT}>
                  {REMINDER_MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <a href={`${import.meta.env.BASE_URL}${reminderFile(time)}`} target="_blank" rel="noopener" onClick={remember} className="btn-primary">
              {t('reminder.add')}
            </a>
          </div>
          {isIOS() && (
            <button onClick={saveFile} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
              {t('reminder.saveFile')}
            </button>
          )}
          {added && <p className="text-xs text-gray-500">{t('reminder.added', { time: added })}</p>}
        </div>
      )}
    </div>
  );
}
