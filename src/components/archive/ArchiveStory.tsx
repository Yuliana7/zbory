import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Aggregates, Donation } from '../../types';
import type { CampaignMeta } from '../../utils/campaignStore';
import { analyzeComments } from '../../utils/commentAnalyzer';
import { formatDateRange } from '../../utils/dateRange';
import { fmtUah } from '../../utils/friendJars';
import {
  bestMoments,
  compareToOthers,
  daysApart,
  loyalty,
  milestones,
  rhythm,
  sizeBands,
  type Milestone,
  type SizeBandKey,
} from '../../utils/archiveStats';

/** The archive page's story of a closed project: how it grew, who gave, where the money went, and how
 * it compares with the user's other closed projects. Read-only, all from the saved statement. */

const card = 'rounded-2xl border border-gray-200 bg-white shadow-sm';
const dayMonth = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });
// 2 Nov 2026 is a Monday: weekday names from the platform, Monday first
const weekday = (i: number, style: 'short' | 'long') => new Date(2026, 10, 2 + i).toLocaleDateString('uk-UA', { weekday: style });
const hourRange = (h: number) => `${String(h).padStart(2, '0')}:00–${String((h + 1) % 24).padStart(2, '0')}:00`;
const pctOf = (share: number) => Math.round(share * 100);

const BAND_COLORS: Record<SizeBandKey, string> = { small: 'bg-indigo-200', medium: 'bg-indigo-400', large: 'bg-indigo-700' };

interface GrowthProps {
  aggregates: Aggregates;
  donations: Donation[];
  goal?: number;
}

/** «Як збиралося»: the running total with the quarters of the goal marked, the record moments and the weekly rhythm. */
export function GrowthSection({ aggregates, donations, goal }: GrowthProps) {
  const { t } = useTranslation('archive');
  const total = aggregates.totalAmount;
  const target = goal || total;
  const marks = useMemo(() => milestones(aggregates.cumulative, target), [aggregates.cumulative, target]);
  const moments = useMemo(() => bestMoments(donations), [donations]);
  const beat = useMemo(() => rhythm(donations), [donations]);
  const m75 = marks.find((m) => m.pct === 75);
  const m100 = marks.find((m) => m.pct === 100);
  const maxWeekday = Math.max(1, ...beat.weekdays);

  const records = [
    moments.bestDay && { label: t('story.recordDay'), value: `${fmtUah(moments.bestDay.amount)} ₴`, note: dayMonth(moments.bestDay.date) },
    moments.bestHour && {
      label: t('story.recordHour'),
      value: `${fmtUah(moments.bestHour.amount)} ₴`,
      note: `${dayMonth(moments.bestHour.date)}, ${hourRange(moments.bestHour.hour)}`,
    },
    moments.streak.days > 1 && {
      label: t('story.streak'),
      value: t('story.streakDays', { count: moments.streak.days }),
      note: formatDateRange(moments.streak.from, moments.streak.to),
    },
  ].filter((r): r is { label: string; value: string; note: string } => !!r);

  return (
    <section className={`${card} p-4 space-y-4`}>
      <h3 className="text-sm font-semibold text-gray-900">{t('page.howItWent')}</h3>

      <GrowthChart cumulative={aggregates.cumulative} goal={goal} marks={marks} label={t('story.chartLabel')} />

      {marks.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-600">{goal ? t('story.toGoal') : t('story.toTotal')}</p>
          <ol className="grid grid-cols-4 gap-2">
            {marks.map((m) => (
              <li key={m.pct} className="rounded-xl bg-indigo-50 px-2 py-2 text-center">
                <p className="text-sm font-bold text-indigo-700">{m.pct}%</p>
                <p className="text-xs text-gray-700">{t('story.onDay', { day: m.day })}</p>
                <p className="text-[11px] text-gray-500">{dayMonth(m.date)}</p>
              </li>
            ))}
          </ol>
          {goal && m75 && m100 && (
            <p className="text-sm text-gray-700">{t('story.lastQuarter', { count: m100.day - m75.day + 1 })}</p>
          )}
        </div>
      )}

      {records.length > 0 && (
        <dl className="divide-y divide-gray-100 border-t border-gray-100">
          {records.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-3 py-2.5">
              <dt className="min-w-0">
                <span className="block text-sm text-gray-900">{r.label}</span>
                <span className="block text-xs text-gray-500">{r.note}</span>
              </dt>
              <dd className="shrink-0 text-sm font-bold text-gray-900">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="space-y-2 border-t border-gray-100 pt-3">
        <p className="text-sm text-gray-700">
          {t('story.rhythm', { weekday: weekday(beat.bestWeekday, 'long'), hours: hourRange(beat.bestHour) })}
        </p>
        <div role="img" aria-label={t('story.byWeekday')} className="grid grid-cols-7 gap-1.5">
          {beat.weekdays.map((v, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="flex h-12 w-full items-end">
                <div
                  className={`w-full rounded-t ${i === beat.bestWeekday ? 'bg-indigo-600' : 'bg-indigo-200'}`}
                  style={{ height: `${Math.max(v ? 4 : 2, Math.round((v / maxWeekday) * 48))}px` }}
                />
              </div>
              <span className="text-[11px] text-gray-500">{weekday(i, 'short')}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** The running total as an area, with a dashed goal line and a dot where each quarter was crossed. */
function GrowthChart({ cumulative, goal, marks, label }: { cumulative: Aggregates['cumulative']; goal?: number; marks: Milestone[]; label: string }) {
  if (cumulative.length < 2) return null;
  const W = 320;
  const H = 120;
  const pad = 6;
  const first = cumulative[0].date;
  const span = Math.max(1, daysApart(first, cumulative[cumulative.length - 1].date));
  const top = Math.max(goal ?? 0, cumulative[cumulative.length - 1].total);
  const x = (date: string) => pad + (daysApart(first, date) / span) * (W - pad * 2);
  const y = (v: number) => H - pad - (v / top) * (H - pad * 2);
  const line = [`M ${x(first)} ${y(0)}`, ...cumulative.map((c) => `L ${x(c.date).toFixed(1)} ${y(c.total).toFixed(1)}`)].join(' ');
  const area = `${line} L ${x(cumulative[cumulative.length - 1].date)} ${y(0)} Z`;
  const totalOn = (date: string) => cumulative.find((c) => c.date === date)?.total ?? 0;
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
      <path d={area} className="fill-indigo-100" />
      {goal && <line x1={pad} x2={W - pad} y1={y(goal)} y2={y(goal)} className="stroke-green-500" strokeWidth="1" strokeDasharray="4 3" />}
      <path d={line} fill="none" className="stroke-indigo-500" strokeWidth="2" strokeLinejoin="round" />
      {marks.map((m) => (
        <circle key={m.pct} cx={x(m.date)} cy={y(totalOn(m.date))} r="3.5" className={m.pct === 100 && goal ? 'fill-green-500' : 'fill-indigo-600'} stroke="white" strokeWidth="1.5" />
      ))}
    </svg>
  );
}

/** «Донатори»: what size the donations were, who came back, who gave most, what they wrote. */
export function SupportersSection({ donations }: { donations: Donation[] }) {
  const { t } = useTranslation('archive');
  const bands = useMemo(() => sizeBands(donations).filter((b) => b.count > 0), [donations]);
  const people = useMemo(() => loyalty(donations), [donations]);
  const comments = useMemo(() => analyzeComments(donations), [donations]);
  const lead = [...bands].sort((a, b) => b.amountShare - a.amountShare)[0];

  return (
    <section className={`${card} p-4 space-y-4`}>
      <h3 className="text-sm font-semibold text-gray-900">{t('story.supporters')}</h3>

      <div className="space-y-2.5">
        <p className="text-sm text-gray-700">{t('story.bandsLead', { pct: pctOf(lead.amountShare), band: t(`story.bandPhrase.${lead.key}`) })}</p>
        <div role="img" aria-label={t('story.bandsLabel')} className="flex h-3 overflow-hidden rounded-full bg-gray-100">
          {bands.map((b) => (
            <div key={b.key} className={BAND_COLORS[b.key]} style={{ width: `${b.amountShare * 100}%` }} />
          ))}
        </div>
        <ul className="space-y-1.5">
          {bands.map((b) => (
            <li key={b.key} className="flex items-center gap-2 text-sm">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${BAND_COLORS[b.key]}`} />
              <span className="min-w-0 flex-1 text-gray-900">{t(`story.band.${b.key}`)}</span>
              <span className="shrink-0 text-xs text-gray-500">{t('story.bandCount', { count: b.count })}</span>
              <span className="w-12 shrink-0 text-right font-semibold text-gray-900">{pctOf(b.amountShare)}%</span>
            </li>
          ))}
        </ul>
      </div>

      {people.named > 0 && (
        <div className="space-y-2 border-t border-gray-100 pt-3">
          {people.returning > 0 && (
            <p className="text-sm text-gray-700">
              {t('story.returning', { count: people.returning, pct: pctOf(people.returningShare) })}
              {people.mostLoyal && <> {t('story.mostLoyal', { name: people.mostLoyal.name, count: people.mostLoyal.count })}</>}
            </p>
          )}
          <p className="pt-1 text-xs font-medium text-gray-600">{t('story.topTitle')}</p>
          <ol className="space-y-1.5">
            {people.top.map((p, i) => (
              <li key={p.name} className="flex items-baseline gap-2 text-sm">
                <span className="w-4 shrink-0 text-xs text-gray-500">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-gray-900">{p.name}</span>
                {p.count > 1 && <span className="shrink-0 text-xs text-gray-500">{t('story.bandCount', { count: p.count })}</span>}
                <span className="shrink-0 font-semibold text-gray-900">{fmtUah(p.amount)} ₴</span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-gray-500">{t('story.namesNote', { n: people.anonymous })}</p>
        </div>
      )}

      {comments.totalWithComments > 0 && (
        <p className="flex flex-wrap items-baseline gap-x-2 border-t border-gray-100 pt-3 text-sm text-gray-700">
          {t('story.comments', { count: comments.totalWithComments })}
          {comments.topEmojis.length > 0 && <span className="text-base">{comments.topEmojis.slice(0, 6).map((e) => e.emoji).join(' ')}</span>}
        </p>
      )}
    </section>
  );
}

/** «Рух коштів»: shown only when money was taken out of the jar. */
export function MoneySection({ aggregates }: { aggregates: Aggregates }) {
  const { t } = useTranslation('archive');
  if (aggregates.totalWithdrawn <= 0) return null;
  const rows = [
    { label: t('story.moneyRaised'), value: aggregates.totalAmount },
    { label: t('story.moneyOut'), value: aggregates.totalWithdrawn },
    { label: t('story.moneyLeft'), value: aggregates.currentBalance },
    ...(aggregates.impliedRefunds > 0 ? [{ label: t('story.moneyRefunds'), value: aggregates.impliedRefunds }] : []),
  ];
  const out = Math.min(1, aggregates.totalWithdrawn / Math.max(1, aggregates.totalAmount));
  return (
    <section className={`${card} p-4 space-y-3`}>
      <h3 className="text-sm font-semibold text-gray-900">{t('story.money')}</h3>
      <div className="flex h-3 overflow-hidden rounded-full bg-green-200" role="img" aria-label={t('story.moneyBar', { pct: pctOf(out) })}>
        <div className="bg-amber-500" style={{ width: `${out * 100}%` }} />
      </div>
      <dl className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="text-gray-700">{r.label}</dt>
            <dd className="font-semibold text-gray-900">{fmtUah(r.value)} ₴</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** One line on how this project did next to the user's other closed ones. */
export function CompareSection({ meta, archived }: { meta: CampaignMeta; archived: CampaignMeta[] }) {
  const { t } = useTranslation('archive');
  const c = useMemo(() => compareToOthers(meta, archived), [meta, archived]);
  if (!c) return null;
  const size =
    c.ratio >= 1.05
      ? t('story.compareMore', { x: c.ratio.toLocaleString('uk-UA', { maximumFractionDigits: 1 }) })
      : c.ratio <= 0.95
        ? t('story.compareLess', { pct: pctOf(c.ratio) })
        : t('story.compareSame');
  return (
    <section className={`${card} p-4 space-y-1.5`}>
      <h3 className="text-sm font-semibold text-gray-900">{t('story.compare', { count: c.others })}</h3>
      <p className="text-sm text-gray-700">{size}</p>
      {c.dayDiff !== 0 && (
        <p className="text-sm text-gray-700">
          {c.dayDiff < 0 ? t('story.compareShorter', { count: -c.dayDiff }) : t('story.compareLonger', { count: c.dayDiff })}
        </p>
      )}
    </section>
  );
}
