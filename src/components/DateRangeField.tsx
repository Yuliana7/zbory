import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { DayPicker, type DateRange, type Matcher } from 'react-day-picker';
import { uk } from 'react-day-picker/locale';
import 'react-day-picker/style.css';
import { CalendarIcon } from '../icons';
import { dateToIso, formatDateRange, isoToDate } from '../utils/dateRange';

interface DateRangeFieldProps {
  label: string;
  /** YYYY-MM-DD, or '' for an open end */
  from: string;
  to: string;
  /** first and last day that can be picked (YYYY-MM-DD); days outside are greyed out */
  min?: string;
  max?: string;
  /** shown in the field while no range is set */
  placeholder?: string;
  /** a range must always be set: the sheet offers no «Очистити» */
  required?: boolean;
  disabled?: boolean;
  onChange: (from: string, to: string) => void;
}

/** One field for a date range. Tapping it opens a bottom sheet with a range calendar: the first tap
 * picks the start, the second the end (tapping an earlier day swaps them, so a range can never run
 * backwards), and a tap after that starts over. Nothing changes until «Готово». A native date input
 * was used before, but iOS ignores its min/max, so «До» could be set before «Від». */
export function DateRangeField({ label, from, to, min, max, placeholder, required, disabled, onChange }: DateRangeFieldProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<DateRange | undefined>(undefined);
  const open = draft !== undefined;

  const text = formatDateRange(from, to);
  const startEditing = () =>
    setDraft({ from: from ? isoToDate(from) : undefined, to: to ? isoToDate(to) : from ? isoToDate(from) : undefined });
  const close = () => setDraft(undefined);
  const apply = () => {
    if (draft?.from) onChange(dateToIso(draft.from), dateToIso(draft.to ?? draft.from));
    close();
  };
  const clear = () => {
    onChange('', '');
    close();
  };

  const minDate = min ? isoToDate(min) : undefined;
  const maxDate = max ? isoToDate(max) : undefined;
  const outside: Matcher[] = [];
  if (minDate) outside.push({ before: minDate });
  if (maxDate) outside.push({ after: maxDate });

  const hint = !draft?.from ? t('dateRange.pickStart') : !draft.to ? t('dateRange.pickEnd') : formatDateRange(dateToIso(draft.from), dateToIso(draft.to));

  return (
    <>
      <button
        type="button"
        onClick={startEditing}
        disabled={disabled}
        aria-haspopup="dialog"
        className="relative flex w-full min-w-0 h-14 items-center gap-3 px-3 rounded-lg border border-gray-300 bg-white text-left
                   disabled:bg-gray-50 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-medium text-gray-500">{label}</span>
          <span className={`block truncate text-base ${text ? 'text-gray-900' : 'text-gray-400'}`}>{text || placeholder}</span>
        </span>
        <CalendarIcon className="w-5 h-5 shrink-0 text-gray-400" />
      </button>

      {open &&
        createPortal(
          <div
            className="screen-overlay z-[300] bg-black/40 flex items-end sm:items-center justify-center sm:p-4 animate-fade-in text-left"
            style={{ paddingTop: 'var(--safe-top)' }}
            onClick={close}
          >
            <div
              role="dialog"
              aria-label={label}
              className="sheet-panel w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 overflow-y-auto overscroll-contain"
              style={{ paddingBottom: 'calc(var(--safe-bottom) + var(--toolbar-gap) + 1.25rem)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-semibold text-gray-900">{label}</h3>
              <p className="mt-0.5 text-sm text-gray-500" aria-live="polite">{hint}</p>

              <div className="zb-calendar mt-3 flex justify-center">
                <DayPicker
                  mode="range"
                  locale={uk}
                  selected={draft}
                  onSelect={(r) => setDraft(r ?? { from: undefined })}
                  resetOnSelect
                  disabled={outside}
                  startMonth={minDate}
                  endMonth={maxDate}
                  defaultMonth={draft.to ?? draft.from ?? maxDate}
                />
              </div>

              <div className="mt-4 flex gap-3">
                {!required && (from || to) && (
                  <button type="button" onClick={clear} className="btn-secondary flex-1 px-3">
                    {t('dateRange.clear')}
                  </button>
                )}
                <button type="button" onClick={close} className="btn-secondary flex-1 px-3">
                  {t('dateRange.cancel')}
                </button>
                <button type="button" onClick={apply} disabled={!draft.from} className="btn-primary flex-1 px-3">
                  {t('dateRange.done')}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
