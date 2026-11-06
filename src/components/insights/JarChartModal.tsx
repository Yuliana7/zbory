import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FriendJar } from '../../types';
import { fmtUah } from '../../utils/friendJars';
import { dayKey, shortKey } from '../../utils/dailyBreakdown';
import { forecast, jarDays, jarTimeline } from '../../utils/friendInsights';
import { XIcon } from '../../icons';
import { RangeBars } from './DailyPage';

const W = 560;
const H = 240;
const PAD = { top: 12, right: 12, bottom: 24, left: 52 };
const MAX_BAR = 56;
const compact = (n: number) => (n >= 1000 ? `${Math.round(n / 100) / 10} тис` : `${Math.round(n)}`);

/** One helper's jar over time, the way the main jar is shown: the amount growing towards its target,
 * where the recent pace would take it, and what each recorded day added. */
export function JarChartModal({ friend: f, now, onClose }: { friend: FriendJar; now: number; onClose: () => void }) {
  const { t } = useTranslation('insights');
  const points = useMemo(() => jarTimeline(f, now), [f, now]);
  const days = useMemo(() => jarDays(points), [points]);
  const eta = f.closed ? null : forecast(f, now);
  const [picked, setPicked] = useState<string | null>(null);
  const selected = days.find((d) => d.key === picked) ?? days[days.length - 1];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const firstAt = points[0].at;
  const lastPoint = points[points.length - 1];
  const lastAt = Math.max(eta ?? 0, lastPoint.at);
  const span = Math.max(1, lastAt - firstAt);
  const top = Math.max(...points.map((p) => p.raised), f.target ?? 0, 1);
  const px = (at: number) => PAD.left + ((at - firstAt) / span) * (W - PAD.left - PAD.right);
  const py = (v: number) => H - PAD.bottom - (v / top) * (H - PAD.top - PAD.bottom);
  const firstDay = dayKey(new Date(firstAt));
  const lastDay = dayKey(new Date(lastAt));

  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * W;
    let best = days[0];
    for (const d of days) if (Math.abs(px(d.at) - x) < Math.abs(px(best.at) - x)) best = d;
    setPicked(best.key);
  };

  const changeText = (d: (typeof days)[number]) => {
    if (d.change === null) return t('jarChart.firstRecord');
    const sign = d.change < 0 ? '−' : '+';
    const amount = fmtUah(Math.abs(d.change));
    const text = d.span > 1 ? t('jarChart.changeOver', { amount, count: d.span }) : t('jarChart.changeOn', { amount });
    return text.replace('+', sign);
  };

  return (
    <div
      className="screen-overlay z-[300] bg-black/40 flex items-end sm:items-center justify-center sm:p-4 animate-fade-in"
      style={{ paddingTop: 'var(--safe-top)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={f.name || '—'}
        className="sheet-panel w-full sm:max-w-xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 overflow-y-auto overscroll-contain"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + var(--toolbar-gap) + 1.25rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          <h3 className="min-w-0 truncate text-base font-semibold text-gray-900">{f.name || '—'}</h3>
          <button onClick={onClose} aria-label={t('jarChart.close')} className="-m-1 p-1 text-gray-400 hover:text-gray-700">
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-gray-500">
          {f.target
            ? t('jarChart.summary', { raised: fmtUah(f.raised), target: fmtUah(f.target), left: fmtUah(Math.max(0, f.target - f.raised)) })
            : t('jarChart.summaryNoTarget', { raised: fmtUah(f.raised) })}
        </p>

        {points.length < 2 ? (
          <p className="py-8 text-center text-sm text-gray-500">{t('jarChart.tooFew')}</p>
        ) : (
          <>
            <p className="mb-1 text-sm text-gray-900">
              <span className="font-semibold">{fmtUah(selected.raised)} ₴</span>{' '}
              <span className="text-gray-500">
                {t('jarChart.raisedOn', { date: shortKey(selected.key) })} · {changeText(selected)}
              </span>
            </p>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full touch-pan-y" role="img" aria-label={t('jarChart.titleRaised')} onPointerDown={pick} onPointerMove={pick}>
              {[0, 0.5, 1].map((share) => (
                <g key={share}>
                  <line x1={PAD.left} x2={W - PAD.right} y1={py(top * share)} y2={py(top * share)} stroke={share === 0 ? '#d1d5db' : '#f3f4f6'} strokeWidth={1} />
                  <text x={PAD.left - 6} y={py(top * share)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="#6b7280">{compact(top * share)}</text>
                </g>
              ))}
              <text x={PAD.left} y={H - 6} fontSize={11} fill="#6b7280">{shortKey(firstDay)}</text>
              {lastDay !== firstDay && <text x={W - PAD.right} y={H - 6} textAnchor="end" fontSize={11} fill="#6b7280">{shortKey(lastDay)}</text>}
              {f.target && <line x1={PAD.left} x2={W - PAD.right} y1={py(f.target)} y2={py(f.target)} stroke="#6b7280" strokeWidth={1} strokeDasharray="2 4" />}
              <line x1={px(selected.at)} x2={px(selected.at)} y1={PAD.top} y2={H - PAD.bottom} stroke="#e5e7eb" strokeWidth={1} />
              {eta && f.target && <line x1={px(lastPoint.at)} y1={py(lastPoint.raised)} x2={px(eta)} y2={py(f.target)} stroke="#a5b4fc" strokeWidth={2} strokeDasharray="6 6" strokeLinecap="round" />}
              <polyline points={points.map((p) => `${px(p.at)},${py(p.raised)}`).join(' ')} fill="none" stroke="#6366f1" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {points.map((p) => (
                <circle key={p.at} cx={px(p.at)} cy={py(p.raised)} r={p.at === selected.at ? 5 : 3.5} fill="#6366f1" stroke="#fff" strokeWidth={2} />
              ))}
            </svg>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-indigo-500" />{t('jarChart.raised')}</span>
              {f.target && <span className="flex items-center gap-1.5"><span className="w-4 border-t border-dotted border-gray-500" />{t('jarChart.target', { amount: fmtUah(f.target) })}</span>}
              {eta && <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-indigo-300" />{t('jarChart.forecast', { date: new Date(eta).toLocaleDateString('uk-UA') })}</span>}
            </div>

            <p className="mt-5 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('jarChart.days')}</p>
            {/* a few days shouldn't stretch into slabs across the sheet */}
            <div style={{ maxWidth: days.length * MAX_BAR }}>
              <RangeBars
                rows={days.map((d) => ({ key: d.key, amount: Math.max(0, d.change ?? 0), count: 0, withdrawn: 0 }))}
                selected={selected.key}
                onPick={(row) => setPicked(row.key)}
              />
            </div>
            <ul className="mt-3 divide-y divide-gray-100 text-sm max-h-48 overflow-y-auto">
              {[...days].reverse().map((d) => (
                <li key={d.key}>
                  <button
                    onClick={() => setPicked(d.key)}
                    aria-pressed={d.key === selected.key}
                    className={`w-full py-1.5 px-1 rounded flex items-center justify-between gap-3 text-left ${d.key === selected.key ? 'bg-indigo-50' : ''}`}
                  >
                    <span className="text-gray-500">{shortKey(d.key)}</span>
                    <span className="text-gray-900 tabular-nums">
                      <span className="mr-3 text-xs text-gray-500">{changeText(d)}</span>
                      {fmtUah(d.raised)} ₴
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-gray-500">{t('jarChart.note')}</p>
          </>
        )}
      </div>
    </div>
  );
}
