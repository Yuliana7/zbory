import { forwardRef } from 'react';
import type { Aggregates } from '../../types';
import { DEFAULT_PALETTE, type Palette } from '../../utils/palettes';
import { rem } from '../../utils/units';
import { useTranslation } from 'react-i18next';
import { NoWrap, UAFlagBar, CardShell, GlowBlob } from './shared';

interface DonorsCountCardProps {
  aggregates: Aggregates;
  format?: 'post' | 'post-4-5' | 'story';
  palette?: Palette;
  textOverrides?: Record<string, string>;
  fontScale?: number;
  bgOverride?: string;
  safeZonePad?: boolean;
  hidden?: Set<string>;
}

export const DonorsCountCard = forwardRef<HTMLDivElement, DonorsCountCardProps>(
  ({ aggregates, format = 'story', palette = DEFAULT_PALETTE, textOverrides = {}, fontScale = 1, bgOverride, safeZonePad, hidden = new Set() }, ref) => {
    const { t } = useTranslation('templates');
    const isStory = format === 'story';
    const p = palette;
    const fz = (n: number) => rem(n * fontScale);
    const tx = (key: string) => textOverrides[key] ?? t(`donors-count.${key}`);

    const fmt = (n: number) => new Intl.NumberFormat('uk-UA').format(Math.round(n));

    const total = aggregates.smallDonations + aggregates.mediumDonations + aggregates.largeDonations;
    const smallPct = total > 0 ? (aggregates.smallDonations / total) * 100 : 0;
    const medPct = total > 0 ? (aggregates.mediumDonations / total) * 100 : 0;
    const largePct = total > 0 ? (aggregates.largeDonations / total) * 100 : 0;

    return (
      <CardShell ref={ref} format={format} palette={p} bgOverride={bgOverride} safeZonePad={safeZonePad}>
        {!hidden.has('glow') && (
          <div data-element="glow">
            <GlowBlob palette={p} style={{ top: -200, right: -200, width: 700, height: 700 }} />
          </div>
        )}

        {/* Header */}
        {!hidden.has('header') && (
        <div data-element="header" style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: isStory ? 80 : 60 }}>
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
        )}

        {/* Hero number */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {!hidden.has('hero') && (
          <div data-element="hero">
            <div
              style={{
                fontSize: fz(160),
                fontWeight: 900,
                lineHeight: 0.9,
                letterSpacing: '-6px',
                background: `${p.accentGradient} text`,
                WebkitTextFillColor: 'transparent',
                marginBottom: 20,
              }}
            >
              {fmt(aggregates.uniqueDonors)}
            </div>
            <div style={{ fontSize: fz(48), fontWeight: 600, color: p.secondary, letterSpacing: '-1px' }}>
              {tx('donorsLabel')}
            </div>
          </div>
          )}
          {/* Anonymous donations matter too — not everyone is a Monobank user */}
          {!hidden.has('anonymousLine') && aggregates.anonymousDonations > 0 && (
            <div data-element="anonymousLine" style={{ fontSize: fz(30), fontWeight: 600, color: p.accent, marginTop: 20 }}>
              + {fmt(aggregates.anonymousDonations)} {tx('anonymousLabel')}
            </div>
          )}
        </div>

        {/* Stats row */}
        {!hidden.has('statsRow') && (
        <div data-element="statsRow" style={{ display: 'flex', gap: 20, marginBottom: 40 }}>
          {[
            { label: tx('avgLabel'), value: fmt(aggregates.avgDonation) + ' ₴' },
            { label: tx('maxLabel'), value: fmt(aggregates.maxDonation) + ' ₴' },
            { label: tx('totalLabel'), value: fmt(aggregates.totalAmount) + ' ₴' },
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
              <div style={{ fontSize: fz(30), fontWeight: 800, color: p.primary }}><NoWrap>{s.value}</NoWrap></div>
              <div style={{ fontSize: fz(18), color: p.secondary, marginTop: 6 }}>{s.label}</div>
            </div>
          ))}
        </div>
        )}

        {/* Distribution bars */}
        {!hidden.has('distribution') && (
        <div
          data-element="distribution"
          style={{
            background: p.cardBg,
            border: `1px solid ${p.cardBorder}`,
            borderRadius: 20,
            padding: '28px 32px',
          }}
        >
          {[
            { label: tx('smallLabel'), pct: smallPct, count: aggregates.smallDonations },
            { label: tx('mediumLabel'), pct: medPct, count: aggregates.mediumDonations },
            { label: tx('largeLabel'), pct: largePct, count: aggregates.largeDonations },
          ].map((row) => (
            <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
              <div style={{ width: 180, fontSize: fz(20), color: p.secondary, flexShrink: 0 }}>{row.label}</div>
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
              <div style={{ width: 80, textAlign: 'right', fontSize: fz(20), fontWeight: 700, color: p.primary }}>
                {row.count}
              </div>
            </div>
          ))}
        </div>
        )}

        <UAFlagBar show={!hidden.has('uaflag')} />
      </CardShell>
    );
  }
);
