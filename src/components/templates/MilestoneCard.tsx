import { forwardRef } from 'react';
import type { Aggregates } from '../../types';
import { DEFAULT_PALETTE, type Palette } from '../../utils/palettes';

interface MilestoneCardProps {
  aggregates: Aggregates;
  goal?: number;
  format?: 'post' | 'story';
  palette?: Palette;
  textOverrides?: Record<string, string>;
}

export const MilestoneCard = forwardRef<HTMLDivElement, MilestoneCardProps>(
  ({ aggregates, goal, format = 'story', palette = DEFAULT_PALETTE, textOverrides = {} }, ref) => {
    const isStory = format === 'story';
    const p = palette;
    const fs = (n: number) => isStory ? Math.round(n * 1.6) : n;
    const tx = (key: string, def: string) => textOverrides[key] ?? def;

    const total = aggregates.totalAmount;
    const progressPct = goal ? (total / goal) * 100 : null;
    const displayPct = progressPct !== null ? Math.round(progressPct) : null;
    const barWidthPct = progressPct !== null ? Math.min(progressPct, 100) : null;

    const formattedTotal = new Intl.NumberFormat('uk-UA').format(Math.round(total));
    const formattedGoal = goal ? new Intl.NumberFormat('uk-UA').format(Math.round(goal)) : null;

    const defaultAchieved =
      progressPct === null
        ? 'Збір іде повним ходом!'
        : progressPct >= 100
        ? 'Ціль досягнуто! 🎉'
        : progressPct >= 75
        ? 'Ми на фінішній прямій!'
        : progressPct >= 50
        ? 'Половину пройдено!'
        : progressPct >= 25
        ? 'Вже чверть шляху!'
        : 'Збір розпочато!';

    const stars = ['✦', '✧', '✦', '✧', '✦', '✧', '✦', '✧'];

    return (
      <div
        ref={ref}
        style={{
          width: 1080,
          height: isStory ? 1920 : 1080,
          background: p.background,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: isStory ? '120px 80px' : '80px',
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
          color: p.primary,
          boxSizing: 'border-box',
          position: 'relative',
          overflow: 'hidden',
          textAlign: 'center',
        }}
      >
        {/* Glow */}
        <div
          style={{
            position: 'absolute',
            top: '40%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 900,
            height: 900,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${p.glowColor} 0%, transparent 65%)`,
            pointerEvents: 'none',
          }}
        />

        {/* Decorative stars ring */}
        <div style={{ display: 'flex', gap: 24, marginBottom: 48, opacity: 0.5 }}>
          {stars.map((s, i) => (
            <span key={i} style={{ fontSize: fs(28), color: p.accent }}>{s}</span>
          ))}
        </div>

        {/* Title */}
        <div style={{ fontSize: fs(36), color: p.secondary, marginBottom: 8, letterSpacing: '2px', textTransform: 'uppercase' }}>
          {tx('title', 'Збори')}
        </div>

        {/* Big percentage — already story-aware, no extra scale needed */}
        {displayPct !== null ? (
          <div
            style={{
              fontSize: isStory ? 240 : 200,
              fontWeight: 900,
              lineHeight: 0.9,
              letterSpacing: '-8px',
              background: `${p.accentGradient} text`,
              WebkitTextFillColor: 'transparent',
              marginBottom: 24,
            }}
          >
            {displayPct}%
          </div>
        ) : (
          <div
            style={{
              fontSize: isStory ? 130 : 96,
              fontWeight: 900,
              lineHeight: 1,
              background: `${p.accentGradient} text`,
              WebkitTextFillColor: 'transparent',
              marginBottom: 24,
            }}
          >
            Збір іде!
          </div>
        )}

        {/* Achieved label */}
        <div
          style={{
            fontSize: fs(44),
            fontWeight: 700,
            color: p.primary,
            marginBottom: 48,
            lineHeight: 1.2,
          }}
        >
          {tx('achievedLabel', defaultAchieved)}
        </div>

        {/* Subtitle */}
        <div style={{ fontSize: fs(28), color: p.secondary, marginBottom: 56 }}>
          {tx('subtitle', 'Дякуємо кожному, хто долучився!')}
        </div>

        {/* Progress bar */}
        {barWidthPct !== null && (
          <div style={{ width: '100%', marginBottom: 48 }}>
            <div
              style={{
                height: 16,
                background: p.progressTrack,
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${barWidthPct}%`,
                  background: p.accentGradient,
                  borderRadius: 8,
                  transition: 'width 0.3s',
                }}
              />
            </div>
          </div>
        )}

        {/* Stats row */}
        <div
          style={{
            display: 'flex',
            gap: 32,
            width: '100%',
          }}
        >
          <div
            style={{
              flex: 1,
              background: p.cardBg,
              border: `1px solid ${p.cardBorder}`,
              borderRadius: 20,
              padding: '28px 24px',
            }}
          >
            <div style={{ fontSize: fs(20), color: p.secondary, marginBottom: 8 }}>
              {tx('collectedLabel', 'Зібрано')}
            </div>
            <div style={{ fontSize: fs(36), fontWeight: 800, color: p.primary }}>{formattedTotal} ₴</div>
          </div>
          {formattedGoal && (
            <div
              style={{
                flex: 1,
                background: p.cardBg,
                border: `1px solid ${p.cardBorder}`,
                borderRadius: 20,
                padding: '28px 24px',
              }}
            >
              <div style={{ fontSize: fs(20), color: p.secondary, marginBottom: 8 }}>
                {tx('goalLabel', 'Ціль')}
              </div>
              <div style={{ fontSize: fs(36), fontWeight: 800, color: p.primary }}>{formattedGoal} ₴</div>
            </div>
          )}
          <div
            style={{
              flex: 1,
              background: p.cardBg,
              border: `1px solid ${p.cardBorder}`,
              borderRadius: 20,
              padding: '28px 24px',
            }}
          >
            <div style={{ fontSize: fs(20), color: p.secondary, marginBottom: 8 }}>
              {tx('donationsLabel', 'Донатів')}
            </div>
            <div style={{ fontSize: fs(36), fontWeight: 800, color: p.primary }}>
              {aggregates.donationCount}
            </div>
          </div>
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
