import { forwardRef } from 'react';
import type { Aggregates } from '../../types';
import { formatUkrainianDate } from '../../utils/dataAggregator';

interface ProgressCardProps {
  aggregates: Aggregates;
  goal?: number;
}

export const ProgressCard = forwardRef<HTMLDivElement, ProgressCardProps>(
  ({ aggregates, goal }, ref) => {
    const total = aggregates.totalAmount;
    const progressPct = goal ? Math.min(Math.round((total / goal) * 100), 100) : null;
    const formattedTotal = new Intl.NumberFormat('uk-UA').format(Math.round(total));
    const formattedGoal = goal
      ? new Intl.NumberFormat('uk-UA').format(Math.round(goal))
      : null;

    return (
      <div
        ref={ref}
        style={{
          width: 1080,
          height: 1080,
          background: 'linear-gradient(145deg, #0f172a 0%, #1e1b4b 60%, #0f172a 100%)',
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
        {/* Background accent circle */}
        <div
          style={{
            position: 'absolute',
            top: -200,
            right: -200,
            width: 700,
            height: 700,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
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
            background: 'radial-gradient(circle, rgba(251,191,36,0.08) 0%, transparent 70%)',
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
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                borderRadius: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
              }}
            >
              ₴
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px' }}>Збори</div>
              <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                Звіт про збір
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontSize: 20 }}>
            <div>{formatUkrainianDate(aggregates.firstDate)}</div>
            <div style={{ marginTop: 4 }}>— {formatUkrainianDate(aggregates.lastDate)}</div>
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 28, marginBottom: 16 }}>
            Зібрано
          </div>
          <div
            style={{
              fontSize: 112,
              fontWeight: 800,
              letterSpacing: '-3px',
              lineHeight: 1,
              background: 'linear-gradient(135deg, #ffffff 0%, #c7d2fe 100%)',
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
              color: 'rgba(255,255,255,0.6)',
              marginTop: 8,
              letterSpacing: '-1px',
            }}
          >
            гривень
          </div>

          {/* Progress bar */}
          {progressPct !== null && (
            <div style={{ marginTop: 56 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 22, color: 'rgba(255,255,255,0.6)' }}>
                  Ціль: {formattedGoal} ₴
                </span>
                <span
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: progressPct >= 100 ? '#4ade80' : '#fbbf24',
                  }}
                >
                  {progressPct}%
                </span>
              </div>
              <div
                style={{
                  height: 20,
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${progressPct}%`,
                    background:
                      progressPct >= 100
                        ? 'linear-gradient(90deg, #4ade80, #22c55e)'
                        : 'linear-gradient(90deg, #fbbf24, #f59e0b)',
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
            borderTop: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {[
            { label: 'Донатів', value: String(aggregates.donationCount) },
            {
              label: 'Середній',
              value: new Intl.NumberFormat('uk-UA').format(Math.round(aggregates.avgDonation)) + ' ₴',
            },
            {
              label: 'Найбільший',
              value: new Intl.NumberFormat('uk-UA').format(Math.round(aggregates.maxDonation)) + ' ₴',
            },
          ].map((stat) => (
            <div key={stat.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, fontWeight: 700 }}>{stat.value}</div>
              <div style={{ fontSize: 20, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* UA flag accent bar */}
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
