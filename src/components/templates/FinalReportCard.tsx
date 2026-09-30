import { forwardRef } from 'react';
import type { Aggregates } from '../../types';
import { findBestDay, formatUkrainianDate, getCampaignDuration } from '../../utils/dataAggregator';
import { DEFAULT_PALETTE, type Palette } from '../../utils/palettes';
import { rem } from '../../utils/units';
import { useTranslation } from 'react-i18next';
import { CardHeader, CardFooter, NoWrap, UAFlagBar, CardShell, GlowBlob } from './shared';

interface FinalReportCardProps {
  aggregates: Aggregates;
  format?: 'post' | 'post-4-5' | 'story';
  palette?: Palette;
  textOverrides?: Record<string, string>;
  fontScale?: number;
  bgOverride?: string;
  safeZonePad?: boolean;
  hidden?: Set<string>;
}

/** The campaign wrap-up post: totals, duration, best day, funds flow, thanks. */
export const FinalReportCard = forwardRef<HTMLDivElement, FinalReportCardProps>(
  ({ aggregates, format = 'post', palette = DEFAULT_PALETTE, textOverrides = {}, fontScale = 1, bgOverride, safeZonePad, hidden = new Set() }, ref) => {
    const { t } = useTranslation('templates');
    const isStory = format === 'story';
    const p = palette;
    const fz = (n: number) => rem(n * fontScale);
    const tx = (key: string) => textOverrides[key] ?? t(`final-report.${key}`);

    const fmt = (n: number) => new Intl.NumberFormat('uk-UA').format(Math.round(n));

    const duration = getCampaignDuration(aggregates) + 1;
    const bestDay = findBestDay(aggregates);
    const hasWithdrawals = aggregates.totalWithdrawn > 0;

    const stats = [
      { label: tx('daysLabel'), value: <>{duration}</> },
      { label: tx('donationsLabel'), value: <>{fmt(aggregates.donationCount)}</> },
      ...(bestDay
        ? [{ label: tx('bestDayLabel'), value: <NoWrap>{fmt(bestDay.amount)} ₴</NoWrap> }]
        : []),
    ];

    return (
      <CardShell ref={ref} format={format} palette={p} bgOverride={bgOverride} safeZonePad={safeZonePad}>
        {!hidden.has('glow') && (
          <div data-element="glow">
            <GlowBlob palette={p} fade={65} style={{ top: '35%', left: '50%', transform: 'translate(-50%, -50%)', width: 900, height: 900 }} />
          </div>
        )}

        {/* Header */}
        {!hidden.has('header') && (
          <CardHeader
            palette={p}
            fz={fz}
            title={tx('title')}
            right={`${formatUkrainianDate(aggregates.firstDate)} — ${formatUkrainianDate(aggregates.lastDate)}`}
          />
        )}

        {/* Main */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: isStory ? 64 : 44 }}>
          {/* Hero total */}
          {!hidden.has('hero') && (
          <div data-element="hero">
            <div
              style={{
                fontSize: fz(112),
                fontWeight: 800,
                letterSpacing: '-3px',
                lineHeight: 1,
                background: `${p.accentGradient} text`,
                WebkitTextFillColor: 'transparent',
              }}
            >
              {fmt(aggregates.totalAmount)}
            </div>
            <div style={{ fontSize: fz(48), fontWeight: 600, color: p.secondary, marginTop: 8, letterSpacing: '-1px' }}>
              {tx('currencyLabel')}
            </div>
          </div>
          )}

          {/* Stats grid */}
          {!hidden.has('statsGrid') && (
          <div data-element="statsGrid" style={{ display: 'flex', gap: 24 }}>
            {stats.map((s) => (
              <div
                key={s.label}
                style={{
                  flex: 1,
                  background: p.cardBg,
                  border: `1px solid ${p.cardBorder}`,
                  borderRadius: 20,
                  padding: '28px 24px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: fz(40), fontWeight: 800, color: p.primary }}>{s.value}</div>
                <div style={{ fontSize: fz(20), color: p.secondary, marginTop: 6 }}>{s.label}</div>
              </div>
            ))}
          </div>
          )}

          {/* Funds flow line — only when money was actually spent */}
          {!hidden.has('fundsFlowLine') && hasWithdrawals && (
            <div data-element="fundsFlowLine" style={{ fontSize: fz(26), color: p.secondary, textAlign: 'center' }}>
              {tx('spentLabel')}{' '}
              <NoWrap style={{ fontWeight: 800, color: '#f59e0b' }}>{fmt(aggregates.totalWithdrawn)} ₴</NoWrap>
              {' · '}
              {tx('balanceLabel')}{' '}
              <NoWrap style={{ fontWeight: 800, color: '#4ade80' }}>{fmt(aggregates.currentBalance)} ₴</NoWrap>
            </div>
          )}

          {/* Thank-you message */}
          {!hidden.has('thankYouMessage') && (
          <div
            data-element="thankYouMessage"
            style={{
              fontSize: fz(32),
              lineHeight: 1.45,
              color: p.primary,
              textAlign: 'center',
              whiteSpace: 'pre-wrap',
            }}
          >
            {tx('message')}
          </div>
          )}
        </div>

        {/* Footer */}
        {!hidden.has('footer') && (
          <CardFooter
            palette={p}
            fz={fz}
            aggregates={aggregates}
            labels={{ collected: tx('statCollected'), median: tx('statMedian'), max: tx('statMax') }}
          />
        )}

        <UAFlagBar show={!hidden.has('uaflag')} />
      </CardShell>
    );
  }
);
