import { forwardRef } from 'react';
import type { Aggregates } from '../../types';
import { DEFAULT_PALETTE, type Palette } from '../../utils/palettes';

interface SpeedCardProps {
  aggregates: Aggregates;
  format?: 'post' | 'story';
  palette?: Palette;
  textOverrides?: Record<string, string>;
}

export const SpeedCard = forwardRef<HTMLDivElement, SpeedCardProps>(
  ({ aggregates, format = 'story', palette = DEFAULT_PALETTE, textOverrides = {} }, ref) => {
    const isStory = format === 'story';
    const p = palette;
    const tx = (key: string, def: string) => textOverrides[key] ?? def;

    const fmt = (n: number) => new Intl.NumberFormat('uk-UA').format(Math.round(n));

    // Build 24-hour distribution
    const hours = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      count: aggregates.byHour.get(h) ?? 0,
    }));
    const maxCount = Math.max(...hours.map(h => h.count), 1);

    const peakHour = hours.reduce((a, b) => b.count > a.count ? b : a);

    const svgW = 920;
    const svgH = isStory ? 360 : 280;
    const barW = Math.floor(svgW / 24) - 4;
    const barMaxH = svgH - 48;

    // Recent 7-day totals for activity indicator
    const recentDays = Array.from(aggregates.byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7);
    const recentTotal = recentDays.reduce((s, [, v]) => s + v.amount, 0);
    const recentCount = recentDays.reduce((s, [, v]) => s + v.count, 0);

    const formatHour = (h: number) => `${String(h).padStart(2, '0')}:00`;

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
            <div style={{ fontSize: 18, color: p.secondary }}>{tx('subtitle', 'Активність кампанії')}</div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 24, marginBottom: isStory ? 60 : 40 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 24, color: p.secondary, marginBottom: 8 }}>
              {tx('totalLabel', 'Зібрано за 7 днів')}
            </div>
            <div
              style={{
                fontSize: isStory ? 72 : 64,
                fontWeight: 900,
                letterSpacing: '-2px',
                lineHeight: 1,
                background: `${p.accentGradient} text`,
                WebkitTextFillColor: 'transparent',
              }}
            >
              {fmt(recentTotal)} ₴
            </div>
          </div>
          <div
            style={{
              background: p.cardBg,
              border: `1px solid ${p.cardBorder}`,
              borderRadius: 20,
              padding: '24px 32px',
              textAlign: 'center',
              minWidth: 180,
            }}
          >
            <div style={{ fontSize: 48, fontWeight: 800, color: p.primary }}>{recentCount}</div>
            <div style={{ fontSize: 20, color: p.secondary, marginTop: 6 }}>
              {tx('donationsLabel', 'донатів')}
            </div>
          </div>
        </div>

        {/* Hourly chart */}
        <div
          style={{
            background: p.cardBg,
            border: `1px solid ${p.cardBorder}`,
            borderRadius: 24,
            padding: '32px',
            marginBottom: isStory ? 40 : 32,
            flex: isStory ? 0 : 1,
          }}
        >
          <div style={{ fontSize: 24, color: p.secondary, marginBottom: 20 }}>
            {tx('hourlyLabel', 'Погодинна активність')}
          </div>
          <svg
            width={svgW}
            height={svgH}
            viewBox={`0 0 ${svgW} ${svgH}`}
            style={{ display: 'block' }}
          >
            {hours.map(({ hour, count }) => {
              const bh = Math.max(count > 0 ? 6 : 0, (count / maxCount) * barMaxH);
              const x = hour * (barW + 4) + 2;
              const y = svgH - 40 - bh;
              const isPeak = hour === peakHour.hour;
              return (
                <g key={hour}>
                  <rect
                    x={x}
                    y={y}
                    width={barW}
                    height={bh}
                    rx={3}
                    fill={isPeak ? '#fbbf24' : p.chartLine}
                    opacity={isPeak ? 1 : 0.65}
                  />
                  {hour % 6 === 0 && (
                    <text
                      x={x + barW / 2}
                      y={svgH - 6}
                      textAnchor="middle"
                      fontSize="20"
                      fill={p.secondary}
                    >
                      {String(hour).padStart(2, '0')}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Peak hour callout */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(251,191,36,0.12), rgba(245,158,11,0.06))',
            border: '1px solid rgba(251,191,36,0.3)',
            borderRadius: 20,
            padding: '28px 32px',
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            marginBottom: isStory ? 40 : 0,
          }}
        >
          <span style={{ fontSize: 48 }}>⚡</span>
          <div>
            <div style={{ fontSize: 22, color: p.secondary }}>{tx('peakLabel', 'Пік активності')}</div>
            <div style={{ fontSize: 36, fontWeight: 700, color: p.primary, marginTop: 4 }}>
              {formatHour(peakHour.hour)} — {formatHour(peakHour.hour + 1)} · {peakHour.count} донатів
            </div>
          </div>
        </div>

        {isStory && (
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
              { label: 'Всього за кампанію', value: fmt(aggregates.totalAmount) + ' ₴' },
              { label: 'Донатів', value: String(aggregates.donationCount) },
            ].map((s) => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 36, fontWeight: 700 }}>{s.value}</div>
                <div style={{ fontSize: 20, color: p.secondary, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

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
