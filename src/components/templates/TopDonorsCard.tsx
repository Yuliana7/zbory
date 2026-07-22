import { forwardRef } from 'react';
import type { Aggregates } from '../../types';
import { DEFAULT_PALETTE, type Palette } from '../../utils/palettes';
import { rem } from '../../utils/units';
import { useTranslation } from 'react-i18next';
import { NoWrap } from './shared';
import { cardPadding } from '../../utils/units';

interface TopDonorsCardProps {
  aggregates: Aggregates;
  format?: 'post' | 'post-4-5' | 'story';
  palette?: Palette;
  textOverrides?: Record<string, string>;
  fontScale?: number;
  bgOverride?: string;
  safeZonePad?: boolean;
  /** 'sum' ranks by total amount; 'count' ranks by number of donations */
  mode?: 'sum' | 'count';
}

const MEDALS = ['🥇', '🥈', '🥉'];

export const TopDonorsCard = forwardRef<HTMLDivElement, TopDonorsCardProps>(
  ({ aggregates, format = 'story', palette = DEFAULT_PALETTE, textOverrides = {}, fontScale = 1, mode = 'sum', bgOverride, safeZonePad }, ref) => {
    const { t } = useTranslation('templates');
    const isStory = format === 'story';
    const p = palette;
    const fz = (n: number) => rem(n * fontScale);
    const ns = mode === 'count' ? 'top-donors-count' : 'top-donors';
    const tx = (key: string) => textOverrides[key] ?? t(`${ns}.${key}`);

    const fmt = (n: number) => new Intl.NumberFormat('uk-UA').format(Math.round(n));

    const ranked = mode === 'count' ? aggregates.topDonorsByCount : aggregates.topDonors;
    const donors = ranked.slice(0, isStory ? 7 : 5);
    const maxMetric = (mode === 'count' ? donors[0]?.count : donors[0]?.amount) || 1;

    return (
      <div
        ref={ref}
        style={{
          width: 1080,
          height: format === 'post-4-5' ? 1350 : isStory ? 1920 : 1080,
          background: bgOverride ?? p.background,
          display: 'flex',
          flexDirection: 'column',
          padding: cardPadding(isStory, safeZonePad, '100px 80px'),
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
                fontSize: fz(28),
                color: '#fff',
              }}
            >
              ₴
            </div>
            <div style={{ fontSize: fz(28), fontWeight: 700 }}>{tx('title')}</div>
          </div>
        </div>

        {/* Donors list */}
        <div data-sticker="list" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {donors.length === 0 ? (
            <div style={{ textAlign: 'center', color: p.secondary, fontSize: fz(32), marginTop: 80 }}>
              {tx('noDataLabel')}
            </div>
          ) : (
            donors.map((donor, i) => {
              const metric = mode === 'count' ? donor.count : donor.amount;
              const barPct = (metric / maxMetric) * 100;
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
                    <div style={{ fontSize: fz(isTop3 ? 44 : 32), width: 56, textAlign: 'center', flexShrink: 0 }}>
                      {MEDALS[i] ?? `${i + 1}.`}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: fz(isTop3 ? 32 : 28),
                          fontWeight: 700,
                          color: p.primary,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {donor.name}
                      </div>
                      {mode === 'sum' && donor.count > 1 && (
                        <div style={{ fontSize: fz(20), color: p.secondary, marginTop: 4 }}>
                          {donor.count} {tx('donationsLabel')}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: fz(isTop3 ? 32 : 28), fontWeight: 800, color: p.accent }}>
                        {mode === 'count' ? (
                          <NoWrap>{donor.count} {tx('donationsLabel')}</NoWrap>
                        ) : (
                          <NoWrap>{fmt(donor.amount)} ₴</NoWrap>
                        )}
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
          <div style={{ fontSize: fz(24), color: p.secondary }}>
            {tx('totalDonorsLabel')}
          </div>
          <div style={{ fontSize: fz(36), fontWeight: 800, color: p.primary }}>
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
