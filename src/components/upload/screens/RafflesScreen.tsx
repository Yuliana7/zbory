import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../../context/AppContext';
import type { Raffle, RaffleKind } from '../../../types';
import { dayKey } from '../../../utils/dailyBreakdown';
import { RAFFLE_KINDS, cleanRaffles, newRaffle } from '../../../utils/raffles';
import { PlusIcon, TrashIcon } from '../../../icons';
import { DateRangeField } from '../../DateRangeField';
import { RaffleStatus } from '../../insights/RaffleStatus';
import { ScreenShell } from './ScreenShell';

const INPUT =
  'w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-base text-gray-900 ' +
  'focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent placeholder:text-gray-400';
const chip = (on: boolean) =>
  `px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${on ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`;

/** The project's raffles: the prize, who is in the running, and where each one stands. Changes save as
 * you leave a field, so there is nothing to forget. */
export function RafflesScreen({ onDone, backLabel }: { onDone: () => void; backLabel?: string }) {
  const { t } = useTranslation('insights');
  const { t: tUpload } = useTranslation('upload');
  const { t: tc } = useTranslation();
  const { state, handleRafflesChange } = useAppContext();
  const { app } = state;
  const [rows, setRows] = useState<Raffle[]>(app.raffles ?? []);
  const saved = useRef(JSON.stringify(cleanRaffles(app.raffles ?? [])));
  const first = app.aggregates ? dayKey(app.aggregates.firstDate) : undefined;
  const last = app.aggregates ? dayKey(app.aggregates.lastDate) : (app.donations?.length ? dayKey(app.donations[0].timestamp) : undefined);

  const persist = (list: Raffle[] = rows) => {
    const clean = cleanRaffles(list);
    const text = JSON.stringify(clean);
    if (text === saved.current) return;
    saved.current = text;
    void handleRafflesChange(clean);
  };
  const leave = () => {
    persist();
    onDone();
  };

  const patch = (id: string, change: Partial<Raffle>, saveNow = false) => {
    const next = rows.map((r) => (r.id === id ? { ...r, ...change } : r));
    setRows(next);
    if (saveNow) persist(next);
  };
  const remove = (id: string) => {
    const next = rows.filter((r) => r.id !== id);
    setRows(next);
    persist(next);
  };

  return (
    <ScreenShell
      wide
      title={t('raffles.title')}
      backLabel={backLabel ?? tUpload('focus.back')}
      onBack={leave}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRows((rs) => [...rs, newRaffle()])}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-600 text-sm font-medium transition-colors"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            {t('raffles.add')}
          </button>
          <button onClick={leave} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors">
            {tUpload('focus.done')}
          </button>
        </div>
      }
    >
      <div onBlur={() => persist()} className="space-y-4">
        <p className="text-xs text-gray-400">{t('raffles.hint')}</p>
        {rows.length === 0 && <p className="py-4 text-center text-sm text-gray-500">{t('raffles.empty')}</p>}
        {/* the newest shows first, as in the friends editor */}
        {[...rows].reverse().map((r) => {
          const usesPeriod = r.kind !== 'jars';
          const usesMin = r.kind !== 'biggest';
          const hasPeriod = !!(r.from || r.to);
          return (
            <div key={r.id} className="rounded-xl border border-gray-200 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={r.prize}
                  onChange={(e) => patch(r.id, { prize: e.target.value })}
                  placeholder={t('raffles.prizePlaceholder')}
                  aria-label={t('raffles.prizePlaceholder')}
                  className={INPUT}
                />
                <button onClick={() => remove(r.id)} aria-label={t('raffles.remove')} title={t('raffles.remove')} className="shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('raffles.kindLabel')}>
                {RAFFLE_KINDS.map((kind: RaffleKind) => (
                  <button key={kind} onClick={() => patch(r.id, { kind }, true)} aria-pressed={r.kind === kind} className={chip(r.kind === kind)}>
                    {t(`raffles.kind.${kind}`)}
                  </button>
                ))}
              </div>

              {usesMin && (
                <label className="block">
                  <span className="block text-xs font-medium text-gray-500 mb-1">{t(`raffles.min.${r.kind}`)}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={r.min ?? ''}
                    onChange={(e) => {
                      const min = Number(e.target.value.replace(/\D/g, ''));
                      patch(r.id, { min: min > 0 ? min : undefined });
                    }}
                    placeholder={t('raffles.noMin')}
                    className={INPUT}
                  />
                </label>
              )}

              {usesPeriod && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => patch(r.id, { from: undefined, to: undefined }, true)} aria-pressed={!hasPeriod} className={chip(!hasPeriod)}>
                      {t('raffles.wholePeriod')}
                    </button>
                    <button onClick={() => !hasPeriod && patch(r.id, { from: last, to: last }, true)} aria-pressed={hasPeriod} className={chip(hasPeriod)}>
                      {t('raffles.datePeriod')}
                    </button>
                  </div>
                  {hasPeriod && (
                    <DateRangeField
                      label={tc('dateRange.period')}
                      from={r.from ?? ''}
                      to={r.to ?? ''}
                      min={first}
                      required
                      onChange={(from, to) => patch(r.id, { from, to }, true)}
                    />
                  )}
                </div>
              )}

              {r.prize.trim() ? (
                <div className="pt-2 border-t border-gray-100">
                  <RaffleStatus raffle={r} donations={app.donations ?? []} friends={app.friends} />
                </div>
              ) : (
                <p className="text-xs text-gray-400">{t('raffles.needsPrize')}</p>
              )}
            </div>
          );
        })}
      </div>
    </ScreenShell>
  );
}
