import { forwardRef } from 'react';
import type { Aggregates } from '../../types';
import { findBestDay, formatCurrency, formatUkrainianDate } from '../../utils/dataAggregator';

interface DailyActivityCardProps {
  aggregates: Aggregates;
  format?: 'post' | 'story';
}

export const DailyActivityCard = forwardRef<HTMLDivElement, DailyActivityCardProps>(
  ({ aggregates, format = 'story' }, ref) => {
    const isPost = format === 'post';
    const bestDay = findBestDay(aggregates);

    // Build chart data from cumulative (max 30 points for readability)
    const cumulative = aggregates.cumulative;
    const step = Math.max(1, Math.floor(cumulative.length / 30));
    const chartPoints = cumulative.filter((_, i) => i % step === 0 || i === cumulative.length - 1);

    // SVG dimensions for the chart area — shorter in post (1:1) mode
    const svgW = 920;
    const svgH = isPost ? 300 : 520;
    const padX = 40;
    const padY = 40;

    const maxVal = chartPoints[chartPoints.length - 1]?.total || 1;
    const minVal = 0;

    const toSvgX = (i: number) =>
      padX + (i / (chartPoints.length - 1)) * (svgW - padX * 2);
    const toSvgY = (val: number) =>
      padY + (1 - (val - minVal) / (maxVal - minVal)) * (svgH - padY * 2);

    const linePath = chartPoints
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toSvgX(i)} ${toSvgY(p.total)}`)
      .join(' ');

    const areaPath =
      linePath +
      ` L ${toSvgX(chartPoints.length - 1)} ${svgH - padY} L ${toSvgX(0)} ${svgH - padY} Z`;

    // Format label on x-axis: show only start, mid, end dates
    const labelIndices = [0, Math.floor(chartPoints.length / 2), chartPoints.length - 1];
    const formatShort = (dateStr: string) => {
      const d = new Date(dateStr);
      return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    // Daily donation bar data (by day map, last 14 days or all if fewer)
    const dayEntries = Array.from(aggregates.byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14);
    const maxDayAmount = Math.max(...dayEntries.map(([, v]) => v.amount), 1);

    return (
      <div
        ref={ref}
        style={{
          width: 1080,
          height: isPost ? 1080 : 1920,
          background: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 40%, #0f172a 100%)',
          display: 'flex',
          flexDirection: 'column',
          padding: '80px',
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
          color: '#ffffff',
          boxSizing: 'border-box',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative circle */}
        <div
          style={{
            position: 'absolute',
            top: -300,
            right: -300,
            width: 900,
            height: 900,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 65%)',
            pointerEvents: 'none',
          }}
        />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 60 }}>
          <div
            style={{
              width: 64,
              height: 64,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
            }}
          >
            ₴
          </div>
          <div>
            <div style={{ fontSize: 32, fontWeight: 700 }}>Збори</div>
            <div style={{ fontSize: 22, color: 'rgba(255,255,255,0.5)' }}>Активність збору</div>
          </div>
        </div>

        {/* Total */}
        <div style={{ marginBottom: isPost ? 32 : 60 }}>
          <div style={{ fontSize: 26, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
            Загальна сума
          </div>
          <div
            style={{
              fontSize: 96,
              fontWeight: 800,
              letterSpacing: '-2px',
              lineHeight: 1,
              background: 'linear-gradient(135deg, #ffffff 0%, #c7d2fe 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {new Intl.NumberFormat('uk-UA').format(Math.round(aggregates.totalAmount))} ₴
          </div>
        </div>

        {/* Cumulative chart */}
        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 24,
            padding: isPost ? '24px' : '32px',
            marginBottom: isPost ? 24 : 40,
          }}
        >
          <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>
            Наростаючий підсумок
          </div>
          <svg
            width={svgW}
            height={svgH}
            viewBox={`0 0 ${svgW} ${svgH}`}
            style={{ display: 'block', overflow: 'visible' }}
          >
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Area fill */}
            <path d={areaPath} fill="url(#areaGrad)" />
            {/* Line */}
            <path d={linePath} fill="none" stroke="#6366f1" strokeWidth="4" strokeLinecap="round" />
            {/* End dot */}
            {chartPoints.length > 0 && (
              <circle
                cx={toSvgX(chartPoints.length - 1)}
                cy={toSvgY(chartPoints[chartPoints.length - 1].total)}
                r="8"
                fill="#a5b4fc"
              />
            )}
            {/* X-axis labels */}
            {labelIndices.map((idx) => {
              if (idx >= chartPoints.length) return null;
              return (
                <text
                  key={idx}
                  x={toSvgX(idx)}
                  y={svgH - 4}
                  textAnchor="middle"
                  fontSize="20"
                  fill="rgba(255,255,255,0.35)"
                >
                  {formatShort(chartPoints[idx].date)}
                </text>
              );
            })}
          </svg>
        </div>

        {/* Daily bars (last 14 days) — story only, not enough height in post */}
        {!isPost && <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 24,
            padding: '32px',
            marginBottom: 40,
          }}
        >
          <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.5)', marginBottom: 24 }}>
            Останні 14 днів
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
                        : 'rgba(99,102,241,0.5)',
                      borderRadius: '4px 4px 0 0',
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>}

        {/* Best day callout */}
        {bestDay && (
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
            <span style={{ fontSize: 56 }}>🔥</span>
            <div>
              <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.5)' }}>Найкращий день</div>
              <div style={{ fontSize: 40, fontWeight: 700, marginTop: 4 }}>
                {formatUkrainianDate(new Date(bestDay.date))}
              </div>
              <div style={{ fontSize: 28, color: '#fbbf24', marginTop: 4 }}>
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
            borderTop: '1px solid rgba(255,255,255,0.1)',
            marginTop: 'auto',
          }}
        >
          {[
            { label: 'Донатів', value: String(aggregates.donationCount) },
            { label: 'Середній', value: new Intl.NumberFormat('uk-UA').format(Math.round(aggregates.avgDonation)) + ' ₴' },
          ].map((stat) => (
            <div key={stat.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 44, fontWeight: 700 }}>{stat.value}</div>
              <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* UA flag bar */}
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
