import { forwardRef } from 'react';
import type { Aggregates } from '../../types';
import { DEFAULT_PALETTE, type Palette } from '../../utils/palettes';
import { rem } from '../../utils/units';
import { useTranslation } from 'react-i18next';
import { CardHeader, NoWrap, UAFlagBar, CardShell, GlowBlob } from './shared';

interface DonationStatsCardProps {
  aggregates: Aggregates;
  format?: 'post' | 'post-4-5' | 'story';
  palette?: Palette;
  textOverrides?: Record<string, string>;
  fontScale?: number;
  bgOverride?: string;
  safeZonePad?: boolean;
  hidden?: Set<string>;
}

/** What donations look like: the median as the headline (the mean is pulled up by a few big ones), the
 * most frequent, mean, largest and smallest amounts, where the middle half sits, and the split by size. */
export const DonationStatsCard = forwardRef<HTMLDivElement, DonationStatsCardProps>(
  ({ aggregates: a, format = 'story', palette = DEFAULT_PALETTE, textOverrides = {}, fontScale = 1, bgOverride, safeZonePad, hidden = new Set() }, ref) => {
    const { t } = useTranslation('templates');
    const isStory = format === 'story';
    const p = palette;
    const fz = (n: number) => rem(n * fontScale);
    const tx = (key: string) => textOverrides[key] ?? t(`donation-stats.${key}`);
    const fmt = (n: number) => new Intl.NumberFormat('uk-UA').format(Math.round(n));

    const tiles = [
      [tx('modeLabel'), a.modeDonation],
      [tx('meanLabel'), a.avgDonation],
      [tx('maxLabel'), a.maxDonation],
      [tx('minLabel'), a.minDonation],
    ] as const;
    const total = a.smallDonations + a.mediumDonations + a.largeDonations;
    const sizes = [
      [t('donation-stats.small'), a.smallDonations],
      [t('donation-stats.medium'), a.mediumDonations],
      [t('donation-stats.large'), a.largeDonations],
    ] as const;
    const gap = isStory ? 44 : 28;

    return (
      <CardShell ref={ref} format={format} palette={p} bgOverride={bgOverride} safeZonePad={safeZonePad}>
        {!hidden.has('glow') && (
          <div data-element="glow">
            <GlowBlob palette={p} style={{ top: -200, right: -200, width: 700, height: 700 }} />
            <GlowBlob palette={p} style={{ bottom: -150, left: -150, width: 500, height: 500 }} />
          </div>
        )}

        {!hidden.has('header') && <CardHeader palette={p} fz={fz} title={tx('title')} />}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap }}>
          {!hidden.has('hero') && (
            <div data-element="hero">
              <div style={{ fontSize: fz(30), fontWeight: 600, color: p.secondary, marginBottom: 12 }}>{tx('heroLabel')}</div>
              <div
                style={{
                  fontSize: fz(isStory ? 170 : 120),
                  fontWeight: 900,
                  lineHeight: 1,
                  letterSpacing: '-4px',
                  background: `${p.accentGradient} text`,
                  WebkitTextFillColor: 'transparent',
                }}
              >
                <NoWrap>{fmt(a.medianDonation)} ₴</NoWrap>
              </div>
            </div>
          )}

          {!hidden.has('stats') && (
            <div data-element="stats" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: isStory ? 20 : 14 }}>
              {tiles.map(([label, value]) => (
                <div key={label} style={{ background: p.cardBg, border: `1px solid ${p.cardBorder}`, borderRadius: 20, padding: isStory ? '24px 28px' : '16px 24px' }}>
                  <div style={{ fontSize: fz(24), color: p.secondary }}>{label}</div>
                  <div style={{ marginTop: 6, fontSize: fz(isStory ? 48 : 40), fontWeight: 800 }}>
                    <NoWrap>{fmt(value)} ₴</NoWrap>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!hidden.has('range') && (
            <div data-element="range" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 24 }}>
              <div style={{ fontSize: fz(26), color: p.secondary }}>{tx('rangeLabel')}</div>
              <div style={{ fontSize: fz(34), fontWeight: 800 }}>
                <NoWrap>{t('donation-stats.rangeValue', { from: fmt(a.p25Donation), to: fmt(a.p75Donation) })}</NoWrap>
              </div>
            </div>
          )}

          {!hidden.has('sizes') && total > 0 && (
            <div data-element="sizes">
              <div style={{ fontSize: fz(26), color: p.secondary, marginBottom: 14 }}>{tx('sizesLabel')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: isStory ? 16 : 10 }}>
                {sizes.map(([label, count]) => {
                  const share = count / total;
                  return (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                      <div style={{ width: 230, flexShrink: 0, fontSize: fz(26), fontWeight: 600 }}>{label}</div>
                      <div style={{ flex: 1, height: 20, background: p.progressTrack, borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${share * 100}%`, background: p.chartLine, borderRadius: 10 }} />
                      </div>
                      <div style={{ width: 90, flexShrink: 0, textAlign: 'right', fontSize: fz(26), fontWeight: 700 }}>{Math.round(share * 100)}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <UAFlagBar show={!hidden.has('uaflag')} />
      </CardShell>
    );
  },
);
