import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Aggregates, Donation } from '../../types';
import { formatUkrainianDate, getCampaignDuration } from '../../utils/dataAggregator';
import { bestMoments } from '../../utils/archiveStats';
import { DEFAULT_PALETTE, type Palette } from '../../utils/palettes';
import { rem } from '../../utils/units';
import { CardHeader, CardShell, GlowBlob, NoWrap, UAFlagBar } from './shared';

interface ArchiveNumbersCardProps {
  aggregates: Aggregates;
  donations: Donation[];
  format?: 'post' | 'post-4-5' | 'story';
  palette?: Palette;
  textOverrides?: Record<string, string>;
  fontScale?: number;
  bgOverride?: string;
  safeZonePad?: boolean;
  hidden?: Set<string>;
}

const fmt = (n: number) => new Intl.NumberFormat('uk-UA').format(Math.round(n));

/** «Збір у цифрах»: the total, then a grid of big numbers — days, donations, donors, the record day,
 * the typical donation, the longest run of days in a row. The square post shows the first four. */
export const ArchiveNumbersCard = forwardRef<HTMLDivElement, ArchiveNumbersCardProps>(
  ({ aggregates, donations, format = 'story', palette = DEFAULT_PALETTE, textOverrides = {}, fontScale = 1, bgOverride, safeZonePad, hidden = new Set() }, ref) => {
    const { t } = useTranslation('templates');
    const tx = (key: string) => textOverrides[key] ?? t(`archive-numbers.${key}`);
    const p = palette;
    const fz = (n: number) => rem(n * fontScale);
    const isStory = format === 'story';
    const moments = bestMoments(donations);

    const tiles = [
      { label: tx('daysLabel'), value: fmt(getCampaignDuration(aggregates)) },
      { label: tx('donationsLabel'), value: fmt(aggregates.donationCount) },
      { label: tx('donorsLabel'), value: fmt(aggregates.uniqueDonors) },
      ...(moments.bestDay ? [{ label: tx('bestDayLabel'), value: `${fmt(moments.bestDay.amount)} ₴` }] : []),
      { label: tx('medianLabel'), value: `${fmt(aggregates.medianDonation)} ₴` },
      ...(moments.streak.days > 1 ? [{ label: tx('streakLabel'), value: fmt(moments.streak.days) }] : []),
    ].slice(0, format === 'post' ? 4 : 6);

    return (
      <CardShell ref={ref} format={format} palette={p} bgOverride={bgOverride} safeZonePad={safeZonePad}>
        {!hidden.has('glow') && (
          <div data-element="glow">
            <GlowBlob palette={p} fade={65} style={{ top: '30%', left: '50%', transform: 'translate(-50%, -50%)', width: 900, height: 900 }} />
          </div>
        )}

        {!hidden.has('header') && (
          <CardHeader
            palette={p}
            fz={fz}
            title={tx('title')}
            right={`${formatUkrainianDate(aggregates.firstDate)} — ${formatUkrainianDate(aggregates.lastDate)}`}
          />
        )}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: isStory ? 72 : 40 }}>
          {!hidden.has('hero') && (
            <div data-element="hero">
              <div style={{ fontSize: fz(30), color: p.secondary, marginBottom: 10 }}>{tx('totalLabel')}</div>
              <div
                style={{
                  fontSize: fz(isStory ? 130 : 104),
                  fontWeight: 900,
                  lineHeight: 1,
                  letterSpacing: '-4px',
                  background: `${p.accentGradient} text`,
                  WebkitTextFillColor: 'transparent',
                }}
              >
                <NoWrap>{fmt(aggregates.totalAmount)} ₴</NoWrap>
              </div>
            </div>
          )}

          {!hidden.has('grid') && (
            <div data-element="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {tiles.map((s) => (
                <div
                  key={s.label}
                  style={{ background: p.cardBg, border: `1px solid ${p.cardBorder}`, borderRadius: 24, padding: isStory ? '40px 32px' : '28px 28px' }}
                >
                  <div style={{ fontSize: fz(isStory ? 64 : 52), fontWeight: 800, color: p.primary, lineHeight: 1.05 }}>
                    <NoWrap>{s.value}</NoWrap>
                  </div>
                  <div style={{ fontSize: fz(24), color: p.secondary, marginTop: 10 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <UAFlagBar show={!hidden.has('uaflag')} />
      </CardShell>
    );
  },
);
