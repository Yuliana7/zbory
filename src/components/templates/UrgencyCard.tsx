import { forwardRef } from 'react';
import type { Aggregates } from '../../types';
import { DEFAULT_PALETTE, type Palette } from '../../utils/palettes';

interface UrgencyCardProps {
  aggregates: Aggregates;
  goal?: number;
  format?: 'post' | 'story';
  palette?: Palette;
  textOverrides?: Record<string, string>;
}

export const UrgencyCard = forwardRef<HTMLDivElement, UrgencyCardProps>(
  ({ aggregates, goal, format = 'story', palette = DEFAULT_PALETTE, textOverrides = {} }, ref) => {
    const isStory = format === 'story';
    const p = palette;
    const fs = (n: number) => isStory ? Math.round(n * 1.55) : n;
    const tx = (key: string, def: string) => textOverrides[key] ?? def;

    const fmt = (n: number) => new Intl.NumberFormat('uk-UA').format(Math.round(n));

    const total = aggregates.totalAmount;
    const remaining = goal ? Math.max(goal - total, 0) : null;
    const progressPct = goal ? Math.min((total / goal) * 100, 100) : null;
    const barWidthPct = progressPct ?? 0;

    const remainingFormatted = remaining !== null ? fmt(remaining) : null;
    const goalFormatted = goal ? fmt(goal) : null;

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
            left: '50%',
            transform: 'translateX(-50%)',
            width: 800,
            height: 800,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${p.glowColor} 0%, transparent 65%)`,
            pointerEvents: 'none',
          }}
        />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: isStory ? 80 : 60 }}>
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
            <div style={{ fontSize: 18, color: p.secondary }}>{tx('subtitle', 'Останній ривок!')}</div>
          </div>
        </div>

        {/* Hero */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {remainingFormatted !== null ? (
            <>
              <div style={{ fontSize: 28, color: p.secondary, marginBottom: 12 }}>
                {tx('remainingLabel', 'Залишилось до цілі')}
              </div>
              <div
                style={{
                  fontSize: isStory ? 120 : 108,
                  fontWeight: 900,
                  letterSpacing: '-4px',
                  lineHeight: 1,
                  background: `${p.accentGradient} text`,
                  // background: p.accentGradient,
                  // WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  marginBottom: 8,
                }}
              >
                {remainingFormatted}
              </div>
              <div style={{ fontSize: 48, fontWeight: 600, color: p.secondary, letterSpacing: '-1px', marginBottom: 56 }}>
                гривень
              </div>
            </>
          ) : (
            <div
              style={{
                fontSize: 80,
                fontWeight: 900,
                lineHeight: 1,
                background: `${p.accentGradient} text`,
                WebkitTextFillColor: 'transparent',
                marginBottom: 56,
              }}
            >
              Підтримай збір!
            </div>
          )}

          {/* Progress bar */}
          <div style={{ marginBottom: 56 }}>
            {goalFormatted && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 22, color: p.secondary }}>
                  {tx('collectedLabel', 'Зібрано:')} {fmt(total)} ₴
                </span>
                <span style={{ fontSize: 22, color: p.secondary }}>
                  {tx('goalLabel', 'Ціль:')} {goalFormatted} ₴
                </span>
              </div>
            )}
            <div
              style={{
                height: 24,
                background: p.progressTrack,
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${barWidthPct}%`,
                  background: p.accentGradient,
                  borderRadius: 12,
                }}
              />
            </div>
            {progressPct !== null && (
              <div style={{ textAlign: 'right', marginTop: 8, fontSize: 22, fontWeight: 700, color: p.accent }}>
                {Math.round(progressPct)}%
              </div>
            )}
          </div>

          {/* Call to action */}
          <div
            style={{
              background: p.cardBg,
              border: `1px solid ${p.cardBorder}`,
              borderRadius: 24,
              padding: '36px 48px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 40, fontWeight: 800, color: p.primary, lineHeight: 1.2 }}>
              {tx('callToAction', '🔥 Підтримай прямо зараз!')}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            paddingTop: 40,
            borderTop: `1px solid ${p.cardBorder}`,
          }}
        >
          {[
            { label: 'Зібрано', value: fmt(total) + ' ₴' },
            { label: 'Донатів', value: String(aggregates.donationCount) },
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
