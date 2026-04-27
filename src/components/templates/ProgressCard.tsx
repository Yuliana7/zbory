import { forwardRef } from 'react';
import type { Aggregates } from '../../types';
import { formatUkrainianDate } from '../../utils/dataAggregator';
import { DEFAULT_PALETTE, type Palette } from '../../utils/palettes';

interface ProgressCardProps {
  aggregates: Aggregates;
  goal?: number;
  format?: 'post' | 'story';
  palette?: Palette;
  textOverrides?: Record<string, string>;
}

export const ProgressCard = forwardRef<HTMLDivElement, ProgressCardProps>(
  ({ aggregates, goal, format = 'post', palette = DEFAULT_PALETTE, textOverrides = {} }, ref) => {
    const isStory = format === 'story';
    const p = palette;

    const tx = (key: string, def: string) => textOverrides[key] ?? def;

    const total = aggregates.totalAmount;
    const progressPct = goal ? Math.round((total / goal) * 100) : null;
    const barWidthPct = progressPct !== null ? Math.min(progressPct, 100) : null;
    const formattedTotal = new Intl.NumberFormat('uk-UA').format(Math.round(total));
    const formattedGoal = goal
      ? new Intl.NumberFormat('uk-UA').format(Math.round(goal))
      : null;

    const barColor =
      progressPct === null
        ? ''
        : progressPct > 100
        ? 'linear-gradient(90deg, #22d3ee, #06b6d4)'
        : progressPct === 100
        ? 'linear-gradient(90deg, #4ade80, #22c55e)'
        : 'linear-gradient(90deg, #fbbf24, #f59e0b)';

    const pctLabel =
      progressPct === null
        ? ''
        : progressPct > 100
        ? `${progressPct}% — мету перевиконано! 🎉`
        : `${progressPct}%`;

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
        <div
          style={{
            position: 'absolute',
            bottom: -150,
            left: -150,
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${p.glowColor} 0%, transparent 70%)`,
            pointerEvents: 'none',
          }}
        />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px' }}>
                {tx('title', 'Збори')}
              </div>
              <div style={{ fontSize: 18, color: p.secondary, marginTop: 2 }}>
                {tx('subtitle', 'Звіт про збір')}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right', color: p.secondary, fontSize: 20 }}>
            <div>{formatUkrainianDate(aggregates.firstDate)}</div>
            <div style={{ marginTop: 4 }}>— {formatUkrainianDate(aggregates.lastDate)}</div>
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ color: p.secondary, fontSize: 28, marginBottom: 16 }}>
            {tx('collectedLabel', 'Зібрано')}
          </div>
          <div
            style={{
              fontSize: 112,
              fontWeight: 800,
              letterSpacing: '-3px',
              lineHeight: 1,
              background: p.accentGradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {formattedTotal}
          </div>
          <div
            style={{
              fontSize: 48,
              fontWeight: 600,
              color: p.secondary,
              marginTop: 8,
              letterSpacing: '-1px',
            }}
          >
            {tx('currencyLabel', 'гривень')}
          </div>

          {progressPct !== null && (
            <div style={{ marginTop: 56 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 22, color: p.secondary }}>
                  {tx('goalLabel', 'Ціль:')} {formattedGoal} ₴
                </span>
                <span
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: progressPct > 100 ? '#22d3ee' : progressPct === 100 ? '#4ade80' : '#fbbf24',
                  }}
                >
                  {pctLabel}
                </span>
              </div>
              <div
                style={{
                  height: 20,
                  background: p.progressTrack,
                  borderRadius: 10,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${barWidthPct}%`,
                    background: barColor,
                    borderRadius: 10,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer stats */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            paddingTop: 40,
            borderTop: `1px solid ${p.cardBorder}`,
          }}
        >
          {[
            { label: tx('statDonations', 'Донатів'), value: String(aggregates.donationCount) },
            {
              label: tx('statAverage', 'Середній'),
              value: new Intl.NumberFormat('uk-UA').format(Math.round(aggregates.avgDonation)) + ' ₴',
            },
            {
              label: tx('statMax', 'Найбільший'),
              value: new Intl.NumberFormat('uk-UA').format(Math.round(aggregates.maxDonation)) + ' ₴',
            },
          ].map((stat) => (
            <div key={stat.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, fontWeight: 700 }}>{stat.value}</div>
              <div style={{ fontSize: 20, color: p.secondary, marginTop: 4 }}>{stat.label}</div>
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
