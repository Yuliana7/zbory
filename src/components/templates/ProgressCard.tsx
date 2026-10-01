import { forwardRef } from 'react';
import type { Aggregates, FriendJar } from '../../types';
import { computeFriendStats, formatSharePct } from '../../utils/friendJars';
import { formatUkrainianDate } from '../../utils/dataAggregator';
import { DEFAULT_PALETTE, type Palette } from '../../utils/palettes';
import { rem } from '../../utils/units';
import { useTranslation } from 'react-i18next';
import { CardHeader, CardFooter, NoWrap, UAFlagBar, CardShell, GlowBlob } from './shared';

interface ProgressCardProps {
  aggregates: Aggregates;
  goal?: number;
  friends?: FriendJar[];
  format?: 'post' | 'post-4-5' | 'story';
  palette?: Palette;
  textOverrides?: Record<string, string>;
  fontScale?: number;
  bgOverride?: string;
  safeZonePad?: boolean;
  hidden?: Set<string>;
}

export const ProgressCard = forwardRef<HTMLDivElement, ProgressCardProps>(
  ({ aggregates, goal, friends, format = 'story', palette = DEFAULT_PALETTE, textOverrides = {}, fontScale = 1, bgOverride, safeZonePad, hidden = new Set() }, ref) => {
    const { t } = useTranslation('templates');
    const p = palette;
    const fz = (n: number) => rem(n * fontScale);
    const tx = (key: string, fallback?: string) => textOverrides[key] ?? fallback ?? t(`progress.${key}`);

    const defaultDateRange = `${formatUkrainianDate(aggregates.firstDate)} — ${formatUkrainianDate(aggregates.lastDate)}`;

    const total = aggregates.totalAmount;
    const progressPct = goal ? Math.round((total / goal) * 100) : null;
    const barWidthPct = progressPct !== null ? Math.min(progressPct, 100) : null;
    const formattedTotal = new Intl.NumberFormat('uk-UA').format(Math.round(total));
    const formattedGoal = goal
      ? new Intl.NumberFormat('uk-UA').format(Math.round(goal))
      : null;

    const barColor =
      progressPct === null
        ? ''
        : progressPct > 100
          ? 'linear-gradient(90deg, #22d3ee, #06b6d4)'
          : progressPct === 100
            ? 'linear-gradient(90deg, #4ade80, #22c55e)'
            : 'linear-gradient(90deg, #fbbf24, #f59e0b)';

    const pctLabel =
      progressPct === null
        ? ''
        : progressPct > 100
          ? `${progressPct}% ${t('progress.targetSurplus')}`
          : `${progressPct}%`;

    const friendStats = computeFriendStats(friends, total);
    const friendPct = formatSharePct(friendStats.share);

    return (
      <CardShell ref={ref} format={format} palette={p} bgOverride={bgOverride} safeZonePad={safeZonePad}>
        {!hidden.has('glow') && (
          <div data-element="glow">
            <GlowBlob palette={p} style={{ top: -200, right: -200, width: 700, height: 700 }} />
            <GlowBlob palette={p} style={{ bottom: -150, left: -150, width: 500, height: 500 }} />
          </div>
        )}

        {/* Header */}
        {!hidden.has('header') && (
          <CardHeader palette={p} fz={fz} title={tx('title')} right={tx('dateRange', defaultDateRange)} />
        )}

        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {!hidden.has('hero') && (
          <div data-element="hero">
            <div style={{ color: p.secondary, fontSize: fz(28), marginBottom: 16 }}>
              {tx('collectedLabel')}
            </div>
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
              {formattedTotal}
            </div>
            <div
              style={{
                fontSize: fz(48),
                fontWeight: 600,
                color: p.secondary,
                marginTop: 8,
                letterSpacing: '-1px',
              }}
            >
              {tx('currencyLabel')}
            </div>
          </div>
          )}

          {!hidden.has('friendsLine') && friendStats.total > 0 && (
            <div data-element="friendsLine" style={{ marginTop: 28, fontSize: fz(28), color: p.secondary }}>
              {tx('friendsLabel')}: <NoWrap><b style={{ color: p.primary }}>{new Intl.NumberFormat('uk-UA').format(Math.round(friendStats.total))} ₴</b> ({friendPct}%)</NoWrap>
            </div>
          )}

          {!hidden.has('progressBar') && progressPct !== null && (
            <div data-element="progressBar" style={{ marginTop: 56 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: fz(22), color: p.secondary, whiteSpace: 'nowrap' }}>
                  {tx('goalLabel')}: <NoWrap>{formattedGoal} ₴</NoWrap>
                </span>
                <span
                  style={{
                    fontSize: fz(22),
                    fontWeight: 700,
                    color: progressPct > 100 ? '#22d3ee' : progressPct === 100 ? '#4ade80' : '#fbbf24',
                  }}
                >
                  {pctLabel}
                </span>
              </div>
              <div
                style={{
                  height: 20,
                  background: p.progressTrack,
                  borderRadius: 10,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${barWidthPct}%`,
                    background: barColor,
                    borderRadius: 10,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer stats */}
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
