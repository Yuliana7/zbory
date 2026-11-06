import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FriendJar } from '../../types';
import { fmtUah } from '../../utils/friendJars';
import { burndown, forecast, leftToTarget } from '../../utils/friendInsights';
import { XIcon } from '../../icons';

const W = 560;
const H = 240;
const PAD = { top: 12, right: 12, bottom: 24, left: 52 };
const day = (ms: number) => new Date(ms).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });
const compact = (n: number) => (n >= 1000 ? `${Math.round(n / 100) / 10} тис` : `${Math.round(n)}`);

/** One helper's jar over time. With a target: how much is left, going down to zero, and where the recent
 * pace would take it. Without one there is nothing to burn down, so it shows the amount growing. */
export function JarChartModal({ friend: f, now, onClose }: { friend: FriendJar; now: number; onClose: () => void }) {
  const { t } = useTranslation('insights');
  const hasTarget = !!f.target;
  const points = burndown(f, now);
  const eta = f.closed ? null : forecast(f, now);
  const [picked, setPicked] = useState<number | null>(null);

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
  const lastAt = Math.max(eta ?? 0, points[points.length - 1].at);
  const span = Math.max(1, lastAt - firstAt);
  const top = Math.max(...points.map((p) => p.value), f.target ?? 0, 1);
  const px = (at: number) => PAD.left + ((at - firstAt) / span) * (W - PAD.left - PAD.right);
  const py = (v: number) => H - PAD.bottom - (v / top) * (H - PAD.top - PAD.bottom);
  const line = points.map((p) => `${px(p.at)},${py(p.value)}`).join(' ');
  const last = points[points.length - 1];
  const shown = picked === null ? last : points[picked];

  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(px(p.at) - x) < Math.abs(px(points[best].at) - x)) best = i;
    });
    setPicked(best);
  };

  return (
    <div
      className="fixed inset-0 z-[300] bg-black/40 flex items-end sm:items-center justify-center sm:p-4 animate-fade-in"
      style={{ paddingTop: 'var(--safe-top)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={f.name || '—'}
        className="sheet-panel w-full sm:max-w-xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 overflow-y-auto overscroll-contain"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 1.25rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          <h3 className="min-w-0 truncate text-base font-semibold text-gray-900">{f.name || '—'}</h3>
          <button onClick={onClose} aria-label={t('jarChart.close')} className="-m-1 p-1 text-gray-400 hover:text-gray-700">
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-gray-500">
          {hasTarget
            ? t('jarChart.summary', { raised: fmtUah(f.raised), target: fmtUah(f.target!), left: fmtUah(leftToTarget(f)) })
            : t('jarChart.summaryNoTarget', { raised: fmtUah(f.raised) })}
        </p>

        {points.length < 2 ? (
          <p className="py-8 text-center text-sm text-gray-500">{t('jarChart.tooFew')}</p>
        ) : (
          <>
            <p className="mb-1 text-sm text-gray-900">
              <span className="font-semibold">{fmtUah(shown.value)} ₴</span>{' '}
              <span className="text-gray-500">{t(hasTarget ? 'jarChart.leftOn' : 'jarChart.raisedOn', { date: day(shown.at) })}</span>
            </p>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full touch-none" role="img" aria-label={t(hasTarget ? 'jarChart.titleLeft' : 'jarChart.titleRaised')} onPointerDown={pick} onPointerMove={pick}>
              {[0, 0.5, 1].map((f2) => (
                <g key={f2}>
                  <line x1={PAD.left} x2={W - PAD.right} y1={py(top * f2)} y2={py(top * f2)} stroke={f2 === 0 ? '#d1d5db' : '#f3f4f6'} strokeWidth={1} />
                  <text x={PAD.left - 6} y={py(top * f2)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="#6b7280">{compact(top * f2)}</text>
                </g>
              ))}
              <text x={PAD.left} y={H - 6} fontSize={11} fill="#6b7280">{day(firstAt)}</text>
              <text x={W - PAD.right} y={H - 6} textAnchor="end" fontSize={11} fill="#6b7280">{day(lastAt)}</text>
              <line x1={px(shown.at)} x2={px(shown.at)} y1={PAD.top} y2={H - PAD.bottom} stroke="#e5e7eb" strokeWidth={1} />
              {eta && hasTarget && <line x1={px(last.at)} y1={py(last.value)} x2={px(eta)} y2={py(0)} stroke="#a5b4fc" strokeWidth={2} strokeDasharray="6 6" strokeLinecap="round" />}
              <polyline points={line} fill="none" stroke="#6366f1" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {points.map((p, i) => (
                <circle key={i} cx={px(p.at)} cy={py(p.value)} r={p === shown ? 5 : 3.5} fill="#6366f1" stroke="#fff" strokeWidth={2} />
              ))}
            </svg>
            {eta && hasTarget && (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-indigo-500" />{t('jarChart.actual')}</span>
                <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-indigo-300" />{t('jarChart.forecast', { date: new Date(eta).toLocaleDateString('uk-UA') })}</span>
              </div>
            )}
            <p className="mt-3 text-xs text-gray-500">{t('jarChart.note')}</p>

            <ul className="mt-4 pt-3 border-t border-gray-100 divide-y divide-gray-100 text-sm max-h-48 overflow-y-auto">
              {[...points].reverse().map((p, i, list) => {
                const before = list[i + 1];
                const change = before ? p.raised - before.raised : null;
                return (
                  <li key={p.at} className="py-1.5 flex items-center justify-between gap-3">
                    <span className="text-gray-500">{new Date(p.at).toLocaleDateString('uk-UA')}</span>
                    <span className="text-gray-900 tabular-nums">
                      {change !== null && change !== 0 && <span className="mr-3 text-xs text-gray-500">{change > 0 ? '+' : '−'}{fmtUah(Math.abs(change))} ₴</span>}
                      {fmtUah(p.raised)} ₴
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
