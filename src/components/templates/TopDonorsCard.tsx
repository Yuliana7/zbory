import { forwardRef } from 'react';
import type { Aggregates } from '../../types';
import { DEFAULT_PALETTE, type Palette } from '../../utils/palettes';

interface TopDonorsCardProps {
  aggregates: Aggregates;
  format?: 'post' | 'story';
  palette?: Palette;
  textOverrides?: Record<string, string>;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export const TopDonorsCard = forwardRef<HTMLDivElement, TopDonorsCardProps>(
  ({ aggregates, format = 'story', palette = DEFAULT_PALETTE, textOverrides = {} }, ref) => {
    const isStory = format === 'story';
    const p = palette;
    const tx = (key: string, def: string) => textOverrides[key] ?? def;

    const fmt = (n: number) => new Intl.NumberFormat('uk-UA').format(Math.round(n));

    const donors = aggregates.topDonors.slice(0, isStory ? 7 : 5);
    const maxAmount = donors[0]?.amount || 1;

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
        <div style={{ marginBottom: isStory ? 72 : 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
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
              <div style={{ fontSize: 18, color: p.secondary }}>{tx('subtitle', 'Наші герої 💛')}</div>
            </div>
          </div>
        </div>

        {/* Donors list */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {donors.length === 0 ? (
            <div style={{ textAlign: 'center', color: p.secondary, fontSize: 32, marginTop: 80 }}>
              Немає даних про донорів
            </div>
          ) : (
            donors.map((donor, i) => {
              const barPct = (donor.amount / maxAmount) * 100;
              const isTop3 = i < 3;
              return (
                <div
                  key={donor.name}
                  style={{
                    background: isTop3 ? p.cardBg : 'transparent',
                    border: `1px solid ${isTop3 ? p.cardBorder : 'transparent'}`,
                    borderRadius: 20,
                    padding: '24px 28px',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Bar background */}
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${barPct}%`,
                      background: p.chartArea,
                      borderRadius: 20,
                    }}
                  />

                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div style={{ fontSize: isTop3 ? 44 : 32, width: 56, textAlign: 'center', flexShrink: 0 }}>
                      {MEDALS[i] ?? `${i + 1}.`}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: isTop3 ? 32 : 28,
                          fontWeight: 700,
                          color: p.primary,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {donor.name || tx('anonymousLabel', 'Анонімно')}
                      </div>
                      {donor.count > 1 && (
                        <div style={{ fontSize: 20, color: p.secondary, marginTop: 4 }}>
                          {donor.count} {tx('donationsLabel', 'донати')}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: isTop3 ? 32 : 28, fontWeight: 800, color: p.accent }}>
                        {fmt(donor.amount)} ₴
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            paddingTop: 40,
            borderTop: `1px solid ${p.cardBorder}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: 24, color: p.secondary }}>
            {tx('totalDonorsLabel', 'Усього підтримали:')}
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, color: p.primary }}>
            {aggregates.donationCount}
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
