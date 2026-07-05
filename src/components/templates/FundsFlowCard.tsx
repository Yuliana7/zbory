import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Aggregates } from '../../types';
import { formatUkrainianDate } from '../../utils/dataAggregator';
import { DEFAULT_PALETTE, type Palette } from '../../utils/palettes';
import { rem } from '../../utils/units';
import { CardHeader, CardFooter, NoWrap } from './shared';

interface FundsFlowCardProps {
  aggregates: Aggregates;
  format?: 'post' | 'story';
  palette?: Palette;
  textOverrides?: Record<string, string>;
  fontScale?: number;
  bgOverride?: string;
  showRefunds?: boolean;
  showHeader?: boolean;
  showFooter?: boolean;
}

export const FundsFlowCard = forwardRef<HTMLDivElement, FundsFlowCardProps>(
  ({ aggregates, format = 'post', palette = DEFAULT_PALETTE, textOverrides = {}, fontScale = 1, showRefunds = false, bgOverride, showHeader = true, showFooter = true }, ref) => {
    const { t } = useTranslation('templates');
    const isStory = format === 'story';
    const p = palette;
    const fz = (n: number) => rem(n * fontScale);
    const tx = (key: string, fallback?: string) => textOverrides[key] ?? fallback ?? t(`funds-flow.${key}`);

    const defaultDateRange = `${formatUkrainianDate(aggregates.firstDate)} — ${formatUkrainianDate(aggregates.lastDate)}`;

    const { totalRaised, totalWithdrawn, currentBalance, impliedRefunds } = aggregates;

    const fmt = (n: number) => new Intl.NumberFormat('uk-UA').format(Math.round(n));

    // When refunds are hidden, we display the "clean" total = balance + spent,
    // so the card is internally consistent: displayed total = balance + spent (+ refunds if shown).
    const displayedTotal = showRefunds ? totalRaised : currentBalance + totalWithdrawn;

    const hasWithdrawals = totalWithdrawn > 0;
    const spentPct = displayedTotal > 0 ? (totalWithdrawn / displayedTotal) * 100 : 0;
    const balancePct = displayedTotal > 0 ? (currentBalance / displayedTotal) * 100 : 100;
    const refundPct = showRefunds && displayedTotal > 0 ? (impliedRefunds / displayedTotal) * 100 : 0;

    return (
      <div
        ref={ref}
        style={{
          width: 1080,
          height: isStory ? 1920 : 1080,
          background: bgOverride ?? p.background,
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
        {/* Background glows */}
        <div style={{ position: 'absolute', top: -200, right: -200, width: 700, height: 700, borderRadius: '50%', background: `radial-gradient(circle, ${p.glowColor} 0%, transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -150, left: -150, width: 500, height: 500, borderRadius: '50%', background: `radial-gradient(circle, ${p.glowColor} 0%, transparent 70%)`, pointerEvents: 'none' }} />

        {/* Header */}
        {showHeader && (
          <CardHeader palette={p} fz={fz} title={tx('title')} right={tx('dateRange', defaultDateRange)} />
        )}

        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: isStory ? 80 : 60 }}>

          {/* Total raised — hero number */}
          <div>
            <div style={{ color: p.secondary, fontSize: fz(28), marginBottom: 12 }}>{tx('raisedLabel')}</div>
            <div style={{ fontSize: fz(100), fontWeight: 800, letterSpacing: '-3px', lineHeight: 1, background: `${p.accentGradient} text`, WebkitTextFillColor: 'transparent' }}>
              {fmt(displayedTotal)}
            </div>
            <div style={{ fontSize: fz(44), fontWeight: 600, color: p.secondary, marginTop: 8, letterSpacing: '-1px' }}>
              {tx('currencyLabel')}
            </div>
          </div>

          {/* Proportional flow bar */}
          <div>
            <div
              style={{
                height: 24,
                borderRadius: 12,
                overflow: 'hidden',
                display: 'flex',
                background: p.progressTrack,
              }}
            >
              {/* Balance portion — still in jar */}
              {balancePct > 0 && (
                <div style={{ width: `${balancePct}%`, background: 'linear-gradient(90deg, #4ade80, #22c55e)', flexShrink: 0 }} />
              )}
              {/* Spent portion */}
              {spentPct > 0 && (
                <div style={{ width: `${spentPct}%`, background: 'linear-gradient(90deg, #f59e0b, #d97706)', flexShrink: 0 }} />
              )}
              {/* Refunds portion */}
              {refundPct > 0 && (
                <div style={{ width: `${refundPct}%`, background: 'linear-gradient(90deg, #a78bfa, #7c3aed)', flexShrink: 0 }} />
              )}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 32, marginTop: 20, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, background: '#4ade80', flexShrink: 0 }} />
                <span style={{ fontSize: fz(20), color: p.secondary }}>{tx('balanceLabel')}</span>
              </div>
              {hasWithdrawals && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, background: '#f59e0b', flexShrink: 0 }} />
                  <span style={{ fontSize: fz(20), color: p.secondary }}>{tx('spentLabel')}</span>
                </div>
              )}
              {showRefunds && impliedRefunds > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, background: '#a78bfa', flexShrink: 0 }} />
                  <span style={{ fontSize: fz(20), color: p.secondary }}>{tx('refundsLabel')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Stat breakdown cards */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {/* Balance card */}
            <div style={{ flex: 1, minWidth: 200, background: 'rgba(74,222,128,0.12)', borderRadius: 20, padding: '28px 32px', border: '1px solid rgba(74,222,128,0.25)' }}>
              <div style={{ fontSize: fz(20), color: '#4ade80', marginBottom: 10, fontWeight: 600 }}>{tx('balanceLabel')}</div>
              <div style={{ fontSize: fz(52), fontWeight: 800, letterSpacing: '-1px', color: '#4ade80' }}><NoWrap>{fmt(currentBalance)} ₴</NoWrap></div>
            </div>

            {/* Spent card — shown only if withdrawals exist, otherwise show "no withdrawals" note */}
            {hasWithdrawals ? (
              <div style={{ flex: 1, minWidth: 200, background: 'rgba(245,158,11,0.12)', borderRadius: 20, padding: '28px 32px', border: '1px solid rgba(245,158,11,0.25)' }}>
                <div style={{ fontSize: fz(20), color: '#f59e0b', marginBottom: 10, fontWeight: 600 }}>{tx('spentLabel')}</div>
                <div style={{ fontSize: fz(52), fontWeight: 800, letterSpacing: '-1px', color: '#f59e0b' }}><NoWrap>{fmt(totalWithdrawn)} ₴</NoWrap></div>
              </div>
            ) : (
              <div style={{ flex: 1, minWidth: 200, background: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: '28px 32px', border: `1px solid ${p.cardBorder}` }}>
                <div style={{ fontSize: fz(20), color: p.secondary, marginBottom: 10, fontWeight: 600 }}>{tx('spentLabel')}</div>
                <div style={{ fontSize: fz(24), color: p.secondary, lineHeight: 1.4 }}>{tx('noWithdrawalsNote')}</div>
              </div>
            )}

            {/* Refunds card — only shown when the volunteer explicitly opts in */}
            {showRefunds && impliedRefunds > 0 && (
              <div style={{ flex: 1, minWidth: 200, background: 'rgba(167,139,250,0.12)', borderRadius: 20, padding: '28px 32px', border: '1px solid rgba(167,139,250,0.25)' }}>
                <div style={{ fontSize: fz(20), color: '#a78bfa', marginBottom: 10, fontWeight: 600 }}>{tx('refundsLabel')}</div>
                <div style={{ fontSize: fz(52), fontWeight: 800, letterSpacing: '-1px', color: '#a78bfa' }}><NoWrap>{fmt(impliedRefunds)} ₴</NoWrap></div>
              </div>
            )}
          </div>
        </div>

        {/* Footer stats */}
        {showFooter && (
          <CardFooter
            palette={p}
            fz={fz}
            aggregates={aggregates}
            labels={{ collected: tx('statCollected'), median: tx('statMedian'), max: tx('statMax') }}
          />
        )}

        {/* UA flag accent */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 8, background: 'linear-gradient(90deg, #005BBB 50%, #FFD500 50%)' }} />
      </div>
    );
  },
);
