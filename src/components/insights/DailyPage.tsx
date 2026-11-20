import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../context/AppContext';
import type { Aggregates, Donation, Withdrawal } from '../../types';
import { addDays, changePct, cumulativePoints, dayDetail, dayKey, daysBetween, daysInRange, groupBy, periodDetail, previousRange, shortKey, summarize, unitsFor, weekHourGrid, type BarUnit, type DayAmount, type DayRow } from '../../utils/dailyBreakdown';
import { formatDateRange } from '../../utils/dateRange';
import { DateRangeField } from '../DateRangeField';
import { ArrowLeftIcon, ArrowRightIcon } from '../../icons';
import { CumulativeChart } from './CumulativeChart';
import { fmtUah } from '../../utils/friendJars';
import { StatTile, SubPage } from './SubPage';

const PRESETS = [7, 30, 90] as const;
const NO_EXTRA: DayAmount[] = [];
const time = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

interface DailyPageProps {
  aggregates: Aggregates;
  donations: Donation[];
  withdrawals: Withdrawal[];
  /** money known only by day (a year's friendly jars with no statement): in the bars and totals, not the donations */
  extra?: DayAmount[];
}

/** A bar's dates: a day, a week («6–12.10») or a month («жовт. 2026»). */
const barLabel = (r: DayRow, unit: BarUnit) =>
  unit === 'month'
    ? new Date(`${r.key}T12:00:00`).toLocaleDateString('uk-UA', { month: 'short', year: 'numeric' })
    : r.endKey && r.endKey !== r.key
      ? `${shortKey(r.key)}–${shortKey(r.endKey)}`
      : shortKey(r.key);

/** Bars of the range, a day, week or month each; a tap picks one. The whole column is the target,
 * however short its bar. Money with no donations behind it sits on top, lighter. */
export function RangeBars({
  rows,
  selected,
  onPick,
  maxBarWidth,
  unit = 'day',
}: {
  rows: DayRow[];
  selected: string | null;
  onPick: (row: DayRow) => void;
  maxBarWidth?: number;
  unit?: BarUnit;
}) {
  const { t } = useTranslation('insights');
  const maxAmount = Math.max(...rows.map((r) => r.amount), 1);
  const maxOut = Math.max(...rows.map((r) => r.withdrawn), 1);
  const anyOut = rows.some((r) => r.withdrawn > 0);
  const anyUntracked = rows.some((r) => (r.untracked ?? 0) > 0);
  const best = rows.reduce<DayRow | null>((top, r) => (r.amount > 0 && (!top || r.amount > top.amount) ? r : top), null);
  const label = (r: DayRow) => barLabel(r, unit);
  return (
    <>
      {/* the bars and their dates narrow together; the legend keeps the full width */}
      <div style={maxBarWidth ? { maxWidth: rows.length * maxBarWidth } : undefined}>
      <div className="flex gap-px">
        {rows.map((r) => {
          const isSelected = r.key === selected;
          return (
            <button
              key={r.key}
              onClick={() => onPick(r)}
              title={`${label(r)}: ${fmtUah(r.amount)} ₴${r.withdrawn ? ` · −${fmtUah(r.withdrawn)} ₴` : ''}`}
              aria-pressed={isSelected}
              aria-label={`${label(r)}: ${fmtUah(r.amount)} ₴`}
              className={`group flex-1 min-w-0 rounded-sm ${isSelected ? 'bg-indigo-50' : ''}`}
            >
              <span className="flex h-40 flex-col justify-end">
                {r.amount > 0 && (
                  <span className="flex flex-col overflow-hidden rounded-t" style={{ height: `${Math.max(2, (r.amount / maxAmount) * 100)}%` }}>
                    {(r.untracked ?? 0) > 0 && (
                      <span className={`block ${isSelected ? 'bg-indigo-300' : 'bg-indigo-200'}`} style={{ height: `${((r.untracked ?? 0) / r.amount) * 100}%` }} />
                    )}
                    <span
                      className={`block flex-1 transition-colors ${isSelected ? 'bg-indigo-700' : r === best ? 'bg-green-500' : 'bg-indigo-400 group-hover:bg-indigo-500'}`}
                    />
                  </span>
                )}
              </span>
              <span className="block h-px bg-gray-300" />
              {anyOut && (
                <span className="flex h-12 flex-col justify-start">
                  {r.withdrawn > 0 && <span className="block rounded-b bg-amber-400" style={{ height: `${Math.max(10, (r.withdrawn / maxOut) * 100)}%` }} />}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between mt-1.5 text-xs text-gray-400">
        <span>{unit === 'month' ? label(rows[0]) : shortKey(rows[0].key)}</span>
        {rows.length > 1 && <span>{unit === 'month' ? label(rows[rows.length - 1]) : shortKey(rows[rows.length - 1].endKey ?? rows[rows.length - 1].key)}</span>}
      </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-indigo-400" />{t(`daily.unitBar.${unit}`)}</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-500" />{t(`daily.unitBest.${unit}`)}</span>
        {anyUntracked && <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-indigo-200" />{t('daily.untracked')}</span>}
        {anyOut && <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-400" />{t('charts.withdrawalDay')}</span>}
      </div>
    </>
  );
}

function DayPanel({ dayId, donations, withdrawals, untracked = 0, onMove, canPrev, canNext }: { dayId: string; donations: Donation[]; withdrawals: Withdrawal[]; untracked?: number; onMove: (step: number) => void; canPrev: boolean; canNext: boolean }) {
  const { t } = useTranslation('insights');
  const d = useMemo(() => dayDetail(donations, withdrawals, dayId), [donations, withdrawals, dayId]);
  const maxHour = Math.max(...d.byHour, 1);
  const arrow = 'p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-30 transition-colors';
  const [y, m, day] = dayId.split('-').map(Number);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <button onClick={() => onMove(-1)} disabled={!canPrev} className={arrow} aria-label={t('daily.prevDay')}><ArrowLeftIcon className="w-4 h-4" /></button>
        <p className="text-sm font-semibold text-gray-900">{new Date(y, m - 1, day).toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <button onClick={() => onMove(1)} disabled={!canNext} className={arrow} aria-label={t('daily.nextDay')}><ArrowRightIcon className="w-4 h-4" /></button>
      </div>

      {untracked > 0 && <p className="mb-3 rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-900">{t('daily.untrackedDay', { amount: fmtUah(untracked) })}</p>}
      {d.count === 0 ? (
        untracked > 0 ? null : <p className="py-4 text-center text-sm text-gray-500">{t('daily.emptyDay')}</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 text-sm">
            {[
              [t('daily.raised'), `${fmtUah(d.amount)} ₴`],
              [t('daily.count'), fmtUah(d.count)],
              [t('daily.avg'), `${fmtUah(d.avg)} ₴`],
              [t('daily.biggest'), d.biggest ? `${fmtUah(d.biggest.amount)} ₴` : '—'],
              [t('daily.donors'), fmtUah(d.uniqueDonors)],
              [t('daily.activeHours'), fmtUah(d.activeHours)],
              [t('daily.span'), d.first && d.last ? `${time(d.first)}–${time(d.last)}` : '—'],
              [t('daily.peak'), d.peakHour !== null ? `${String(d.peakHour).padStart(2, '0')}:00` : '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-gray-500">{label}</dt>
                <dd className="font-semibold text-gray-900">{value}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-5 mb-2 text-xs font-medium text-gray-500">{t('daily.byHour')}</p>
          <div className="flex items-end gap-px h-20">
            {d.byHour.map((v, h) => (
              <div key={h} className="flex-1 h-full flex flex-col justify-end" title={`${String(h).padStart(2, '0')}:00 — ${fmtUah(v)} ₴`}>
                {v > 0 && <div className="rounded-t bg-indigo-400" style={{ height: `${Math.max(4, (v / maxHour) * 100)}%` }} />}
              </div>
            ))}
          </div>
          <div className="h-px bg-gray-300" />
          <div className="flex justify-between mt-1 text-xs text-gray-400"><span>00</span><span>12</span><span>23</span></div>

          {d.comments.length > 0 && (
            <>
              <p className="mt-5 mb-2 text-xs font-medium text-gray-500">{t('daily.comments')}</p>
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {d.comments.map((c, i) => (
                  <li key={i} className="text-sm text-gray-800">
                    <span className="text-xs text-gray-400 mr-2">{time(c.timestamp)} · {fmtUah(c.amount)} ₴</span>
                    {c.comment}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {d.withdrawals.length > 0 && (
        <p className="mt-4 text-sm text-amber-700">
          {t('daily.withdrawn')}: −{fmtUah(d.withdrawals.reduce((sum, w) => sum + w.amount, 0))} ₴
        </p>
      )}
    </div>
  );
}

/** A week or a month of the range: its totals, its days and its best one; «По днях» opens it day by day. */
function PeriodPanel({
  row,
  unit,
  donations,
  withdrawals,
  extra,
  onMove,
  canPrev,
  canNext,
  onDays,
}: {
  row: DayRow;
  unit: BarUnit;
  donations: Donation[];
  withdrawals: Withdrawal[];
  extra: DayAmount[];
  onMove: (step: number) => void;
  canPrev: boolean;
  canNext: boolean;
  onDays: () => void;
}) {
  const { t } = useTranslation('insights');
  const to = row.endKey ?? row.key;
  const p = useMemo(() => periodDetail(donations, withdrawals, row.key, to, extra), [donations, withdrawals, row.key, to, extra]);
  const arrow = 'p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-30 transition-colors';
  const maxDay = Math.max(...p.days.map((d) => d.amount), 1);
  const title = unit === 'month' ? new Date(`${row.key}T12:00:00`).toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' }) : formatDateRange(row.key, to);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <button onClick={() => onMove(-1)} disabled={!canPrev} className={arrow} aria-label={t(`daily.prevUnit.${unit}`)}><ArrowLeftIcon className="w-4 h-4" /></button>
        <p className="text-sm font-semibold text-gray-900 first-letter:uppercase">{title}</p>
        <button onClick={() => onMove(1)} disabled={!canNext} className={arrow} aria-label={t(`daily.nextUnit.${unit}`)}><ArrowRightIcon className="w-4 h-4" /></button>
      </div>
      {p.amount === 0 ? (
        <p className="py-4 text-center text-sm text-gray-500">{t(`daily.emptyUnit.${unit}`)}</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 text-sm">
            {[
              [t('daily.raised'), `${fmtUah(p.amount)} ₴`],
              [t('daily.count'), fmtUah(p.count)],
              [t('daily.avg'), p.count ? `${fmtUah(p.avg)} ₴` : '—'],
              [t('daily.biggest'), p.biggest ? `${fmtUah(p.biggest.amount)} ₴` : '—'],
              [t('daily.donors'), fmtUah(p.uniqueDonors)],
              [t('daily.activeDays'), `${p.activeDays} / ${p.days.length}`],
              [t('charts.bestDay'), p.best ? `${fmtUah(p.best.amount)} ₴ · ${shortKey(p.best.key)}` : '—'],
              [t('daily.comments'), fmtUah(p.comments)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-gray-500">{label}</dt>
                <dd className="font-semibold text-gray-900">{value}</dd>
              </div>
            ))}
          </dl>
          {p.untracked > 0 && <p className="mt-3 rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-900">{t('daily.untrackedPeriod', { amount: fmtUah(p.untracked) })}</p>}
          <p className="mt-5 mb-2 text-xs font-medium text-gray-500">{t('daily.byDay')}</p>
          <div className="flex items-end gap-px h-20">
            {p.days.map((d) => (
              <div key={d.key} className="flex-1 h-full flex flex-col justify-end" title={`${shortKey(d.key)} — ${fmtUah(d.amount)} ₴`}>
                {d.amount > 0 && <div className={`rounded-t ${d === p.best ? 'bg-green-500' : 'bg-indigo-400'}`} style={{ height: `${Math.max(4, (d.amount / maxDay) * 100)}%` }} />}
              </div>
            ))}
          </div>
          <div className="h-px bg-gray-300" />
          <div className="flex justify-between mt-1 text-xs text-gray-400"><span>{shortKey(row.key)}</span><span>{shortKey(to)}</span></div>
          {p.withdrawn > 0 && <p className="mt-4 text-sm text-amber-700">{t('daily.withdrawn')}: −{fmtUah(p.withdrawn)} ₴</p>}
        </>
      )}
      <button onClick={onDays} className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-800">
        {t(`daily.openDays.${unit}`)}
      </button>
    </div>
  );
}

/** When donations come in: weekday × hour, darker = more. A single hue, since this is only about size. */
function WeekHourMap({ grid }: { grid: number[][] }) {
  const { t } = useTranslation('insights');
  const max = Math.max(...grid.flat(), 1);
  const days = t('daily.weekdays', { returnObjects: true }) as unknown as string[];
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{t('daily.mapTitle')}</p>
      <p className="text-xs text-gray-500 mb-3">{t('daily.mapHint')}</p>
      <div className="space-y-px">
        {grid.map((row, i) => (
          <div key={i} className="flex items-center gap-px">
            <span className="w-6 shrink-0 text-[11px] text-gray-500">{days[i]}</span>
            {row.map((v, h) => (
              <div
                key={h}
                className="flex-1 h-4 rounded-[2px] bg-indigo-600"
                style={{ opacity: v > 0 ? 0.15 + 0.85 * (v / max) : 0.04 }}
                title={`${days[i]} ${String(h).padStart(2, '0')}:00 — ${fmtUah(v)} ₴`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1 pl-6 text-xs text-gray-400"><span>00</span><span>12</span><span>23</span></div>
    </div>
  );
}

/** The fundraiser day by day: any period, how it compares with the one before, and what happened on each day. */
export function DailyPage({ aggregates, donations, withdrawals, extra = NO_EXTRA }: DailyPageProps) {
  const { t } = useTranslation('insights');
  const { t: tc } = useTranslation();
  const { handleTemplateSelect } = useAppContext();
  const first = dayKey(aggregates.firstDate);
  const last = dayKey(aggregates.lastDate);
  const clampFrom = (key: string) => (key < first ? first : key);
  const [range, setRange] = useState(() => ({ from: clampFrom(addDays(last, -29)), to: last }));
  const [mode, setMode] = useState<'bars' | 'total'>('bars');

  const days = useMemo(() => daysInRange(donations, withdrawals, range.from, range.to, extra), [donations, withdrawals, range, extra]);
  // days up to a month, weeks up to about three months, months beyond; the user can pick another that fits
  const units = unitsFor(days.length);
  const [unitPick, setUnitPick] = useState<BarUnit | null>(null);
  const unit = unitPick && units.includes(unitPick) ? unitPick : units[0];
  const bars = useMemo(() => groupBy(days, unit), [days, unit]);
  const summary = useMemo(() => summarize(days), [days]);
  const before = useMemo(() => {
    const p = previousRange(range.from, range.to);
    return p.to < first ? null : summarize(daysInRange(donations, withdrawals, p.from, p.to, extra));
  }, [donations, withdrawals, range, first, extra]);
  const grid = useMemo(() => weekHourGrid(donations, range.from, range.to), [donations, range]);
  const points = useMemo(() => cumulativePoints(donations, days, extra), [donations, days, extra]);

  // the picked day (or the week or month holding it): the last one with money by default
  const lastActive = [...days].reverse().find((d) => d.amount > 0)?.key ?? range.to;
  const [picked, setPicked] = useState<string | null>(null);
  const selected = picked && picked >= range.from && picked <= range.to ? picked : lastActive;
  const barIndex = Math.max(0, bars.findIndex((b) => selected >= b.key && selected <= (b.endKey ?? b.key)));
  const bar = bars[barIndex];

  const setDays = (n: number) => setRange({ from: clampFrom(addDays(last, 1 - n)), to: last });
  const presetOn = (n: number) => range.to === last && range.from === clampFrom(addDays(last, 1 - n));
  const allOn = range.from === first && range.to === last;
  const chip = (on: boolean) => `px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${on ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`;

  const pct = before ? changePct(summary.amount, before.amount) : null;
  const pctCount = before ? changePct(summary.count, before.count) : null;
  const vs = (v: number | null) => (v === null ? undefined : t('daily.vsPrevious', { pct: `${v > 0 ? '+' : ''}${v}` }));

  return (
    <SubPage title={t('daily.title')}>
      <div className="mb-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((n) => (
            <button key={n} onClick={() => setDays(n)} aria-pressed={presetOn(n)} className={chip(presetOn(n))}>{t('daily.lastDays', { count: n })}</button>
          ))}
          <button onClick={() => setRange({ from: first, to: last })} aria-pressed={allOn} className={chip(allOn)}>{t('daily.allTime')}</button>
        </div>
        <div className="max-w-md">
          <DateRangeField label={tc('dateRange.period')} from={range.from} to={range.to} min={first} max={last} required onChange={(from, to) => setRange({ from, to })} />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label={t('daily.raised')} value={`${fmtUah(summary.amount)} ₴`} note={vs(pct)} />
        <StatTile label={t('daily.count')} value={fmtUah(summary.count)} note={vs(pctCount)} />
        <StatTile label={t('daily.activeDays')} value={`${summary.activeDays} / ${daysBetween(range.from, range.to)}`} note={t('daily.avgNote', { amount: fmtUah(summary.avg) })} />
        <StatTile label={t('charts.bestDay')} value={summary.best ? `${fmtUah(summary.best.amount)} ₴` : '—'} note={summary.best ? shortKey(summary.best.key) : undefined} />
      </div>

      <div className="mb-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit" role="tablist">
          {(['bars', 'total'] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${mode === m ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500'}`}
            >
              {t(`daily.mode.${m}`)}
            </button>
          ))}
        </div>
        {mode === 'bars' && (
          <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit" role="radiogroup" aria-label={t('daily.unitLabel')}>
            {(['day', 'week', 'month'] as const).map((u) => (
              <button
                key={u}
                role="radio"
                aria-checked={unit === u}
                disabled={!units.includes(u)}
                title={units.includes(u) ? undefined : t(`daily.unitTooMany.${u}`)}
                onClick={() => setUnitPick(u)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors disabled:opacity-40 ${unit === u ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500'}`}
              >
                {t(`daily.unit.${u}`)}
              </button>
            ))}
          </div>
        )}
        </div>
        {mode === 'bars' ? (
          <RangeBars rows={bars} unit={unit} selected={bar?.key ?? null} onPick={(r) => setPicked(r.key)} />
        ) : (
          <CumulativeChart aggregates={aggregates} datasets={null} points={points} bare />
        )}
      </div>

      <div className="mb-4">
        {unit === 'day' || !bar ? (
          <DayPanel
            dayId={selected}
            donations={donations}
            withdrawals={withdrawals}
            untracked={days.find((d) => d.key === selected)?.untracked}
            onMove={(step) => setPicked(addDays(selected, step))}
            canPrev={selected > range.from}
            canNext={selected < range.to}
          />
        ) : (
          <PeriodPanel
            row={bar}
            unit={unit}
            donations={donations}
            withdrawals={withdrawals}
            extra={extra}
            onMove={(step) => setPicked(bars[barIndex + step]?.key ?? selected)}
            canPrev={barIndex > 0}
            canNext={barIndex < bars.length - 1}
            onDays={() => {
              setRange({ from: bar.key, to: bar.endKey ?? bar.key });
              setUnitPick('day');
            }}
          />
        )}
      </div>

      <div className="mb-4"><WeekHourMap grid={grid} /></div>

      <button onClick={() => handleTemplateSelect('daily-activity', range)} className="btn-primary w-full sm:w-auto">
        {t('daily.makeCard')}
      </button>
    </SubPage>
  );
}
