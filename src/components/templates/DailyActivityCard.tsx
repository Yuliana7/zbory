import { forwardRef } from 'react';
import type { Aggregates } from '../../types';
import { findBestDay, formatCurrency, formatUkrainianDate } from '../../utils/dataAggregator';
import { DEFAULT_PALETTE, type Palette } from '../../utils/palettes';
import { rem } from '../../utils/units';
import { useTranslation } from 'react-i18next';
import { CardHeader, NoWrap } from './shared';

interface DailyActivityCardProps {
  aggregates: Aggregates;
  format?: 'post' | 'story';
  palette?: Palette;
  textOverrides?: Record<string, string>;
  fontScale?: number;
  bgOverride?: string;
  showHeader?: boolean;
  showChart?: boolean;
  showBars?: boolean;
  showBestDay?: boolean;
}

export const DailyActivityCard = forwardRef<HTMLDivElement, DailyActivityCardProps>(
  ({ aggregates, format = 'story', palette = DEFAULT_PALETTE, textOverrides = {}, fontScale = 1, bgOverride, showHeader = true, showChart = true, showBars = true, showBestDay = true }, ref) => {
    const { t } = useTranslation('templates');
    const isPost = format === 'post';
    const p = palette;
    const fz = (n: number) => rem(n * fontScale);
    const tx = (key: string, fallback?: string) => textOverrides[key] ?? fallback ?? t(`daily-activity.${key}`);

    const bestDay = findBestDay(aggregates);

    const cumulative = aggregates.cumulative;
    const step = Math.max(1, Math.floor(cumulative.length / 30));
    const chartPoints = cumulative.filter((_, i) => i % step === 0 || i === cumulative.length - 1);

    const svgW = 870;
    const svgH = isPost ? 300 : 520;
    const padX = 40;
    const padY = 40;

    const maxVal = chartPoints[chartPoints.length - 1]?.total || 1;

    const toSvgX = (i: number) =>
      padX + (i / (chartPoints.length - 1)) * (svgW - padX * 2);
    const toSvgY = (val: number) =>
      padY + (1 - val / maxVal) * (svgH - padY * 2);

    const linePath = chartPoints
      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${toSvgX(i)} ${toSvgY(pt.total)}`)
      .join(' ');

    const areaPath =
      linePath +
      ` L ${toSvgX(chartPoints.length - 1)} ${svgH - padY} L ${toSvgX(0)} ${svgH - padY} Z`;

    const labelIndices = [0, Math.floor(chartPoints.length / 2), chartPoints.length - 1];
    const formatShort = (dateStr: string) => {
      const d = new Date(dateStr);
      return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    const dayEntries = Array.from(aggregates.byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14);
    const maxDayAmount = Math.max(...dayEntries.map(([, v]) => v.amount), 1);

    const gradId = `areaGrad-${p.id}`;

    return (
      <div
        ref={ref}
        style={{
          width: 1080,
          height: isPost ? 1080 : 1920,
          background: bgOverride ?? p.background,
          display: 'flex',
          flexDirection: 'column',
          padding: '80px',
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
          color: p.primary,
          boxSizing: 'border-box',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -300,
            right: -300,
            width: 900,
            height: 900,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${p.glowColor} 0%, transparent 65%)`,
            pointerEvents: 'none',
          }}
        />

        {/* Header */}
        {showHeader && <CardHeader palette={p} fz={fz} title={tx('title')} marginBottom={60} />}

        {/* Total */}
        <div style={{ marginBottom: isPost ? 32 : 60 }}>
          <div style={{ fontSize: fz(26), color: p.secondary, marginBottom: 8 }}>
            {tx('totalLabel')}
          </div>
          <div
            style={{
              fontSize: fz(96),
              fontWeight: 800,
              letterSpacing: '-2px',
              lineHeight: 1,
              background: `${p.accentGradient} text`,
              WebkitTextFillColor: 'transparent',
            }}
          >
            <NoWrap>{new Intl.NumberFormat('uk-UA').format(Math.round(aggregates.totalAmount))} ₴</NoWrap>
          </div>
        </div>

        {/* Cumulative chart */}
        {showChart && (
        <div
          style={{
            background: p.cardBg,
            borderRadius: 24,
            padding: isPost ? '24px' : '32px',
            marginBottom: isPost ? 24 : 40,
          }}
        >
          <div style={{ fontSize: fz(24), color: p.secondary, marginBottom: 16 }}>
            {tx('chartLabel')}
          </div>
          <svg
            width={svgW}
            height={svgH}
            viewBox={`0 0 ${svgW} ${svgH}`}
            style={{ display: 'block', overflow: 'visible' }}
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={p.chartLine} stopOpacity="0.35" />
                <stop offset="100%" stopColor={p.chartLine} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={areaPath} fill={`url(#${gradId})`} />
            <path d={linePath} fill="none" stroke={p.chartLine} strokeWidth="4" strokeLinecap="round" />
            {chartPoints.length > 0 && (
              <circle
                cx={toSvgX(chartPoints.length - 1)}
                cy={toSvgY(chartPoints[chartPoints.length - 1].total)}
                r="8"
                fill={p.accent}
              />
            )}
            {labelIndices.map((idx) => {
              if (idx >= chartPoints.length) return null;
              return (
                <text
                  key={idx}
                  x={toSvgX(idx)}
                  y={svgH - 4}
                  textAnchor="middle"
                  fontSize="20"
                  fill={p.secondary}
                >
                  {formatShort(chartPoints[idx].date)}
                </text>
              );
            })}
          </svg>
        </div>
        )}

        {/* Daily bars — story only */}
        {showBars && !isPost && (
          <div
            style={{
              background: p.cardBg,
              borderRadius: 24,
              padding: '32px',
              marginBottom: 40,
            }}
          >
            <div style={{ fontSize: fz(24), color: p.secondary, marginBottom: 24 }}>
              {tx('barsLabel')}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 120 }}>
              {dayEntries.map(([date, val]) => {
                const barH = Math.max(8, (val.amount / maxDayAmount) * 100);
                const isMax = val.amount === maxDayAmount;
                return (
                  <div
                    key={date}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      height: '100%',
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: `${barH}%`,
                        background: isMax
                          ? 'linear-gradient(180deg, #fbbf24, #f59e0b)'
                          : p.chartArea,
                        borderRadius: '4px 4px 0 0',
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Best day callout */}
        {showBestDay && bestDay && (
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(245,158,11,0.08))',
              border: '1px solid rgba(251,191,36,0.3)',
              borderRadius: 24,
              padding: '36px',
              marginBottom: 40,
              display: 'flex',
              alignItems: 'center',
              gap: 28,
            }}
          >
            <span style={{ fontSize: fz(56) }}>🔥</span>
            <div>
              <div style={{ fontSize: fz(24), color: p.secondary }}>{tx('bestDayLabel')}</div>
              <div style={{ fontSize: fz(40), fontWeight: 700, marginTop: 4, color: p.primary }}>
                {formatUkrainianDate(new Date(bestDay.date))}
              </div>
              <div style={{ fontSize: fz(28), color: '#fbbf24', marginTop: 4 }}>
                {formatCurrency(bestDay.amount)}
              </div>
            </div>
          </div>
        )}

        {/* Footer stats */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            paddingTop: 40,
            borderTop: `1px solid ${p.cardBorder}`,
            marginTop: 'auto',
          }}
        >
          {[
            { label: tx('statDonations'), value: String(aggregates.donationCount) },
            {
              label: tx('statAverage'),
              value: new Intl.NumberFormat('uk-UA').format(Math.round(aggregates.avgDonation)) + ' ₴',
            },
          ].map((stat) => (
            <div key={stat.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: fz(44), fontWeight: 700 }}><NoWrap>{stat.value}</NoWrap></div>
              <div style={{ fontSize: fz(24), color: p.secondary, marginTop: 4 }}>{stat.label}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 10,
            background: 'linear-gradient(90deg, #005BBB 50%, #FFD500 50%)',
          }}
        />
      </div>
    );
  }
);
