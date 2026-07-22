import { forwardRef } from 'react';
import type { Aggregates } from '../../types';
import { findBestDay, formatUkrainianDate, getCampaignDuration } from '../../utils/dataAggregator';
import { DEFAULT_PALETTE, type Palette } from '../../utils/palettes';
import { rem } from '../../utils/units';
import { useTranslation } from 'react-i18next';
import { CardHeader, CardFooter, NoWrap } from './shared';
import { cardPadding } from '../../utils/units';

interface FinalReportCardProps {
  aggregates: Aggregates;
  format?: 'post' | 'post-4-5' | 'story';
  palette?: Palette;
  textOverrides?: Record<string, string>;
  fontScale?: number;
  bgOverride?: string;
  safeZonePad?: boolean;
  showHeader?: boolean;
  showFooter?: boolean;
}

/** The campaign wrap-up post: totals, duration, best day, funds flow, thanks. */
export const FinalReportCard = forwardRef<HTMLDivElement, FinalReportCardProps>(
  ({ aggregates, format = 'post', palette = DEFAULT_PALETTE, textOverrides = {}, fontScale = 1, bgOverride, safeZonePad, showHeader = true, showFooter = true }, ref) => {
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
            top: '35%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 900,
            height: 900,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${p.glowColor} 0%, transparent 65%)`,
            pointerEvents: 'none',
          }}
        />

        {/* Header */}
        {showHeader && (
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
          <div>
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

          {/* Stats grid */}
          <div data-sticker="statsGrid" style={{ display: 'flex', gap: 24 }}>
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

          {/* Funds flow line — only when money was actually spent */}
          {hasWithdrawals && (
            <div style={{ fontSize: fz(26), color: p.secondary, textAlign: 'center' }}>
              {tx('spentLabel')}{' '}
              <NoWrap style={{ fontWeight: 800, color: '#f59e0b' }}>{fmt(aggregates.totalWithdrawn)} ₴</NoWrap>
              {' · '}
              {tx('balanceLabel')}{' '}
              <NoWrap style={{ fontWeight: 800, color: '#4ade80' }}>{fmt(aggregates.currentBalance)} ₴</NoWrap>
            </div>
          )}

          {/* Thank-you message */}
          <div
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
        </div>

        {/* Footer */}
        {showFooter && (
          <CardFooter
            palette={p}
            fz={fz}
            aggregates={aggregates}
            labels={{ collected: tx('statCollected'), median: tx('statMedian'), max: tx('statMax') }}
          />
        )}

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
