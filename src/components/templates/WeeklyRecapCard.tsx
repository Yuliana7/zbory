import { forwardRef } from 'react';
import type { Aggregates } from '../../types';
import { DEFAULT_PALETTE, type Palette } from '../../utils/palettes';

interface WeeklyRecapCardProps {
  aggregates: Aggregates;
  format?: 'post' | 'story';
  palette?: Palette;
  textOverrides?: Record<string, string>;
}

const UA_DAYS = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export const WeeklyRecapCard = forwardRef<HTMLDivElement, WeeklyRecapCardProps>(
  ({ aggregates, format = 'story', palette = DEFAULT_PALETTE, textOverrides = {} }, ref) => {
    const isStory = format === 'story';
    const p = palette;
    const tx = (key: string, def: string) => textOverrides[key] ?? def;

    const fmt = (n: number) => new Intl.NumberFormat('uk-UA').format(Math.round(n));

    const sortedDates = Array.from(aggregates.byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b));

    const thisWeek = sortedDates.slice(-7);
    const prevWeek = sortedDates.slice(-14, -7);

    const thisWeekTotal = thisWeek.reduce((s, [, v]) => s + v.amount, 0);
    const prevWeekTotal = prevWeek.reduce((s, [, v]) => s + v.amount, 0);

    const delta =
      prevWeekTotal > 0
        ? Math.round(((thisWeekTotal - prevWeekTotal) / prevWeekTotal) * 100)
        : null;

    const maxBar = Math.max(...thisWeek.map(([, v]) => v.amount), 1);

    const svgW = 920;
    const svgH = isStory ? 400 : 300;
    const barW = Math.floor((svgW - 40) / Math.max(thisWeek.length, 1)) - 12;
    const barMaxH = svgH - 60;

    return (
      <div
        ref={ref}
        style={{
          width: 1080,
          height: isStory ? 1920 : 1080,
          background: p.background,
          display: 'flex',
          flexDirection: 'column',
          padding: isStory ? '100px 80px' : '80px',
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
          color: p.primary,
          boxSizing: 'border-box',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Glow */}
        <div
          style={{
            position: 'absolute',
            top: -200,
            right: -200,
            width: 700,
            height: 700,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${p.glowColor} 0%, transparent 70%)`,
            pointerEvents: 'none',
          }}
        />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: isStory ? 72 : 56 }}>
          <div
            style={{
              width: 56,
              height: 56,
              background: p.logoGradient,
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              color: '#fff',
            }}
          >
            ₴
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{tx('title', 'Збори')}</div>
            <div style={{ fontSize: 18, color: p.secondary }}>{tx('subtitle', 'Тижневий звіт')}</div>
          </div>
        </div>

        {/* This week total */}
        <div style={{ marginBottom: isStory ? 60 : 40 }}>
          <div style={{ fontSize: 26, color: p.secondary, marginBottom: 8 }}>
            {tx('thisWeekLabel', 'Цей тиждень')}
          </div>
          <div
            style={{
              fontSize: isStory ? 100 : 80,
              fontWeight: 900,
              letterSpacing: '-3px',
              lineHeight: 1,
              background: `${p.accentGradient} text`,
              WebkitTextFillColor: 'transparent',
            }}
          >
            {fmt(thisWeekTotal)} ₴
          </div>

          {delta !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: delta >= 0 ? '#4ade80' : '#f87171',
                }}
              >
                {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}%
              </span>
              <span style={{ fontSize: 24, color: p.secondary }}>
                {tx('prevWeekLabel', 'vs минулий тиждень')} ({fmt(prevWeekTotal)} ₴)
              </span>
            </div>
          )}
        </div>

        {/* Bar chart */}
        <div
          style={{
            background: p.cardBg,
            border: `1px solid ${p.cardBorder}`,
            borderRadius: 24,
            padding: '32px',
            marginBottom: isStory ? 40 : 32,
          }}
        >
          {thisWeek.length > 0 ? (
            <svg
              width={svgW}
              height={svgH}
              viewBox={`0 0 ${svgW} ${svgH}`}
              style={{ display: 'block' }}
            >
              {thisWeek.map(([date, val], i) => {
                const bh = Math.max(8, (val.amount / maxBar) * barMaxH);
                const x = 20 + i * (barW + 12);
                const y = svgH - 40 - bh;
                const isMax = val.amount === maxBar;
                const dayOfWeek = new Date(date).getDay();
                return (
                  <g key={date}>
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={bh}
                      rx={6}
                      fill={isMax ? '#fbbf24' : p.chartLine}
                      opacity={isMax ? 1 : 0.7}
                    />
                    <text
                      x={x + barW / 2}
                      y={svgH - 8}
                      textAnchor="middle"
                      fontSize="22"
                      fill={p.secondary}
                    >
                      {UA_DAYS[dayOfWeek]}
                    </text>
                  </g>
                );
              })}
            </svg>
          ) : (
            <div style={{ textAlign: 'center', color: p.secondary, fontSize: 28, padding: '40px 0' }}>
              Недостатньо даних
            </div>
          )}
        </div>

        {/* Best day */}
        {thisWeek.length > 0 && (() => {
          const best = thisWeek.reduce((a, b) => b[1].amount > a[1].amount ? b : a);
          const d = new Date(best[0]);
          return (
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(251,191,36,0.12), rgba(245,158,11,0.06))',
                border: '1px solid rgba(251,191,36,0.3)',
                borderRadius: 20,
                padding: '28px 32px',
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                marginBottom: isStory ? 40 : 32,
              }}
            >
              <span style={{ fontSize: 48 }}>🔥</span>
              <div>
                <div style={{ fontSize: 22, color: p.secondary }}>{tx('bestDayLabel', 'Найкращий день тижня')}</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: p.primary, marginTop: 4 }}>
                  {UA_DAYS[d.getDay()]} — {fmt(best[1].amount)} ₴
                </div>
              </div>
            </div>
          );
        })()}

        {/* Footer */}
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
            { label: tx('donationsLabel', 'Донатів за тиждень'), value: String(thisWeek.reduce((s, [, v]) => s + v.count, 0)) },
            { label: 'Всього за кампанію', value: fmt(aggregates.totalAmount) + ' ₴' },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, fontWeight: 700 }}>{s.value}</div>
              <div style={{ fontSize: 20, color: p.secondary, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 8,
            background: 'linear-gradient(90deg, #005BBB 50%, #FFD500 50%)',
          }}
        />
      </div>
    );
  }
);
