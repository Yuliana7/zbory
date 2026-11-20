import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Aggregates } from '../../types';
import { formatUkrainianDate } from '../../utils/dataAggregator';
import { daysApart, milestones } from '../../utils/archiveStats';
import { DEFAULT_PALETTE, type Palette } from '../../utils/palettes';
import { rem } from '../../utils/units';
import { CardHeader, CardShell, GlowBlob, NoWrap, UAFlagBar } from './shared';

interface ArchiveJourneyCardProps {
  aggregates: Aggregates;
  goal?: number;
  format?: 'post' | 'post-4-5' | 'story';
  palette?: Palette;
  textOverrides?: Record<string, string>;
  fontScale?: number;
  bgOverride?: string;
  safeZonePad?: boolean;
  hidden?: Set<string>;
}

const fmt = (n: number) => new Intl.NumberFormat('uk-UA').format(Math.round(n));

/** «Як ми збирали»: a finished project's running total, with the day each quarter of the goal (or of the
 * final total, when there was no goal) was reached. */
export const ArchiveJourneyCard = forwardRef<HTMLDivElement, ArchiveJourneyCardProps>(
  ({ aggregates, goal, format = 'story', palette = DEFAULT_PALETTE, textOverrides = {}, fontScale = 1, bgOverride, safeZonePad, hidden = new Set() }, ref) => {
    const { t } = useTranslation('templates');
    const tx = (key: string) => textOverrides[key] ?? t(`archive-journey.${key}`);
    const p = palette;
    const fz = (n: number) => rem(n * fontScale);
    const isStory = format === 'story';
    const total = aggregates.totalAmount;
    const marks = milestones(aggregates.cumulative, goal || total);
    const pct = goal ? Math.round((total / goal) * 100) : null;

    // the chart: days across, money up; the goal line when there is one
    const cum = aggregates.cumulative;
    const W = 920;
    const H = format === 'post' ? 300 : format === 'post-4-5' ? 440 : 620;
    const padY = 24;
    const first = cum[0]?.date ?? '';
    const span = Math.max(1, cum.length ? daysApart(first, cum[cum.length - 1].date) : 1);
    const top = Math.max(goal ?? 0, cum[cum.length - 1]?.total ?? 1);
    const x = (date: string) => 12 + (daysApart(first, date) / span) * (W - 24);
    const y = (v: number) => H - padY - (v / top) * (H - padY * 2);
    const line = cum.length ? [`M ${x(first)} ${y(0)}`, ...cum.map((c) => `L ${x(c.date).toFixed(1)} ${y(c.total).toFixed(1)}`)].join(' ') : '';
    const area = cum.length ? `${line} L ${x(cum[cum.length - 1].date)} ${y(0)} Z` : '';
    const totalOn = (date: string) => cum.find((c) => c.date === date)?.total ?? 0;
    const gradId = 'journey-area';

    return (
      <CardShell ref={ref} format={format} palette={p} bgOverride={bgOverride} safeZonePad={safeZonePad}>
        {!hidden.has('glow') && (
          <div data-element="glow">
            <GlowBlob palette={p} style={{ top: -220, left: -220, width: 760, height: 760 }} />
          </div>
        )}

        {!hidden.has('header') && (
          <CardHeader
            palette={p}
            fz={fz}
            title={tx('title')}
            right={`${formatUkrainianDate(aggregates.firstDate)} — ${formatUkrainianDate(aggregates.lastDate)}`}
          />
        )}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: isStory ? 64 : 36 }}>
          {!hidden.has('hero') && (
            <div data-element="hero">
              <div
                style={{
                  fontSize: fz(isStory ? 120 : 96),
                  fontWeight: 800,
                  letterSpacing: '-3px',
                  lineHeight: 1,
                  background: `${p.accentGradient} text`,
                  WebkitTextFillColor: 'transparent',
                }}
              >
                <NoWrap>{fmt(total)} ₴</NoWrap>
              </div>
              <div style={{ fontSize: fz(30), color: p.secondary, marginTop: 12 }}>
                {goal ? (
                  <>
                    {tx('goalLabel')} <NoWrap>{fmt(goal)} ₴</NoWrap> · <span style={{ color: p.accent, fontWeight: 700 }}>{pct}%</span>
                  </>
                ) : (
                  tx('currencyLabel')
                )}
              </div>
            </div>
          )}

          {!hidden.has('chart') && cum.length > 1 && (
            <svg data-element="chart" width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
              <defs>
                <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={p.chartLine} stopOpacity="0.35" />
                  <stop offset="100%" stopColor={p.chartLine} stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <path d={area} fill={`url(#${gradId})`} />
              {goal && <line x1={0} x2={W} y1={y(goal)} y2={y(goal)} stroke="#4ade80" strokeWidth="3" strokeDasharray="12 10" />}
              <path d={line} fill="none" stroke={p.chartLine} strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
              {marks.map((m) => (
                <circle key={m.pct} cx={x(m.date)} cy={y(totalOn(m.date))} r="13" fill={m.pct === 100 && goal ? '#4ade80' : p.accent} stroke={p.background.startsWith('#') ? p.background : '#fff'} strokeWidth="5" />
              ))}
            </svg>
          )}

          {!hidden.has('milestones') && marks.length > 0 && (
            <div data-element="milestones">
              <div style={{ fontSize: fz(24), color: p.secondary, marginBottom: 16 }}>{tx('milestonesLabel')}</div>
              <div style={{ display: 'flex', gap: 16 }}>
                {marks.map((m) => (
                  <div
                    key={m.pct}
                    style={{ flex: 1, background: p.cardBg, border: `1px solid ${p.cardBorder}`, borderRadius: 20, padding: '22px 12px', textAlign: 'center' }}
                  >
                    <div style={{ fontSize: fz(40), fontWeight: 800, color: m.pct === 100 && goal ? '#4ade80' : p.accent }}>{m.pct}%</div>
                    <div style={{ fontSize: fz(22), color: p.primary, marginTop: 6 }}>
                      <NoWrap>
                        {m.day}-й {tx('dayWord')}
                      </NoWrap>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <UAFlagBar show={!hidden.has('uaflag')} />
      </CardShell>
    );
  },
);
