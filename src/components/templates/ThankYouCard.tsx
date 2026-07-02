import { forwardRef } from 'react';
import type { Aggregates } from '../../types';
import { generateThankYouMessage } from '../../utils/insightGenerator';
import { DEFAULT_PALETTE, type Palette } from '../../utils/palettes';
import { rem } from '../../utils/units';
import { useTranslation } from 'react-i18next';

interface ThankYouCardProps {
  aggregates: Aggregates;
  format?: 'post' | 'story';
  palette?: Palette;
  textOverrides?: Record<string, string>;
  fontScale?: number;
  bgOverride?: string;
}

export const ThankYouCard = forwardRef<HTMLDivElement, ThankYouCardProps>(
  ({ aggregates, format = 'story', palette = DEFAULT_PALETTE, textOverrides = {}, fontScale = 1, bgOverride }, ref) => {
    const { t } = useTranslation('templates');
    const { t: tInsights } = useTranslation('insights');
    const isStory = format === 'story';
    const p = palette;
    const fz = (n: number) => rem(n * fontScale);
    const tx = (key: string, fallback?: string) => textOverrides[key] ?? fallback ?? t(`thank-you.${key}`);

    const message = tx('message', generateThankYouMessage(aggregates.totalAmount, aggregates.donationCount, tInsights));
    const formattedTotal = new Intl.NumberFormat('uk-UA').format(Math.round(aggregates.totalAmount));

    return (
      <div
        ref={ref}
        style={{
          width: 1080,
          height: isStory ? 1920 : 1080,
          background: bgOverride ?? p.background,
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
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 800,
            height: 800,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${p.glowColor} 0%, transparent 65%)`,
            pointerEvents: 'none',
          }}
        />

        {[
          { top: 40, left: 40 },
          { top: 40, right: 40 },
          { bottom: 40, left: 40 },
          { bottom: 40, right: 40 },
        ].map((pos, i) => (
          <div
            key={i}
            style={{ position: 'absolute', width: 40, height: 40, ...pos, opacity: 0.3 }}
          >
            <div
              style={{
                width: '100%',
                height: 3,
                background: p.accent,
                position: 'absolute',
                top: i < 2 ? 0 : 'auto',
                bottom: i >= 2 ? 0 : 'auto',
              }}
            />
            <div
              style={{
                height: '100%',
                width: 3,
                background: p.accent,
                position: 'absolute',
                left: i % 2 === 0 ? 0 : 'auto',
                right: i % 2 === 1 ? 0 : 'auto',
              }}
            />
          </div>
        ))}

        <div style={{ fontSize: fz(80), lineHeight: 1, marginBottom: 32 }}>💙💛</div>

        <div
          style={{
            fontSize: fz(96),
            fontWeight: 900,
            letterSpacing: '8px',
            textTransform: 'uppercase',
            background: `${p.accentGradient} text`,
            WebkitTextFillColor: 'transparent',
            lineHeight: 1,
            marginBottom: 24,
          }}
        >
          {tx('title')}
        </div>

        <div style={{ fontSize: fz(72), fontWeight: 800, letterSpacing: '-2px', color: p.primary, marginBottom: 8 }}>
          {formattedTotal} ₴
        </div>
        <div style={{ fontSize: fz(30), color: p.secondary, marginBottom: 48 }}>
          {tx('amountLabel')}
        </div>

        <div
          style={{
            fontSize: fz(32),
            lineHeight: 1.5,
            color: p.secondary,
            maxWidth: 840,
            marginBottom: 64,
          }}
        >
          {message}
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 16,
            background: p.cardBg,
            border: `1px solid ${p.cardBorder}`,
            borderRadius: 100,
            padding: '20px 48px',
          }}
        >
          <span style={{ fontSize: fz(28), color: p.secondary }}>{tx('donorsLabel')}</span>
          <span style={{ fontSize: fz(40), fontWeight: 800, color: p.accent }}>
            {aggregates.donationCount}
          </span>
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 56,
            fontSize: fz(22),
            color: p.secondary,
            letterSpacing: '2px',
          }}
        >
          {tx('branding')}
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
