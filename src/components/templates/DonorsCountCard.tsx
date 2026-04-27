import { forwardRef } from 'react';
import type { Aggregates } from '../../types';
import { DEFAULT_PALETTE, type Palette } from '../../utils/palettes';

interface DonorsCountCardProps {
  aggregates: Aggregates;
  format?: 'post' | 'story';
  palette?: Palette;
  textOverrides?: Record<string, string>;
}

export const DonorsCountCard = forwardRef<HTMLDivElement, DonorsCountCardProps>(
  ({ aggregates, format = 'post', palette = DEFAULT_PALETTE, textOverrides = {} }, ref) => {
    const isStory = format === 'story';
    const p = palette;
    const tx = (key: string, def: string) => textOverrides[key] ?? def;

    const fmt = (n: number) => new Intl.NumberFormat('uk-UA').format(Math.round(n));

    const total = aggregates.smallDonations + aggregates.mediumDonations + aggregates.largeDonations;
    const smallPct = total > 0 ? (aggregates.smallDonations / total) * 100 : 0;
    const medPct = total > 0 ? (aggregates.mediumDonations / total) * 100 : 0;
    const largePct = total > 0 ? (aggregates.largeDonations / total) * 100 : 0;

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
            <div style={{ fontSize: 18, color: p.secondary }}>{tx('subtitle', 'Наша спільнота')}</div>
          </div>
        </div>

        {/* Hero number */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div
            style={{
              fontSize: isStory ? 200 : 160,
              fontWeight: 900,
              lineHeight: 0.9,
              letterSpacing: '-6px',
              background: p.accentGradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: 20,
            }}
          >
            {fmt(aggregates.donationCount)}
          </div>
          <div style={{ fontSize: 48, fontWeight: 600, color: p.secondary, letterSpacing: '-1px' }}>
            {tx('donorsLabel', 'людини підтримали збір')}
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 40 }}>
          {[
            { label: tx('avgLabel', 'Середній донат'), value: fmt(aggregates.avgDonation) + ' ₴' },
            { label: tx('maxLabel', 'Найбільший'), value: fmt(aggregates.maxDonation) + ' ₴' },
            { label: tx('totalLabel', 'Зібрано'), value: fmt(aggregates.totalAmount) + ' ₴' },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                flex: 1,
                background: p.cardBg,
                border: `1px solid ${p.cardBorder}`,
                borderRadius: 20,
                padding: '24px 20px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 30, fontWeight: 800, color: p.primary }}>{s.value}</div>
              <div style={{ fontSize: 18, color: p.secondary, marginTop: 6 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Distribution bars */}
        <div
          style={{
            background: p.cardBg,
            border: `1px solid ${p.cardBorder}`,
            borderRadius: 20,
            padding: '28px 32px',
          }}
        >
          {[
            { label: tx('smallLabel', 'до 100 ₴'), pct: smallPct, count: aggregates.smallDonations },
            { label: tx('mediumLabel', '100–1000 ₴'), pct: medPct, count: aggregates.mediumDonations },
            { label: tx('largeLabel', 'понад 1000 ₴'), pct: largePct, count: aggregates.largeDonations },
          ].map((row) => (
            <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
              <div style={{ width: 180, fontSize: 20, color: p.secondary, flexShrink: 0 }}>{row.label}</div>
              <div
                style={{
                  flex: 1,
                  height: 14,
                  background: p.progressTrack,
                  borderRadius: 7,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${row.pct}%`,
                    background: p.chartLine,
                    borderRadius: 7,
                  }}
                />
              </div>
              <div style={{ width: 80, textAlign: 'right', fontSize: 20, fontWeight: 700, color: p.primary }}>
                {row.count}
              </div>
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
