import { forwardRef } from 'react';
import type { Aggregates } from '../../types';
import { formatUkrainianDate } from '../../utils/dataAggregator';
import { DEFAULT_PALETTE, type Palette } from '../../utils/palettes';
import { rem } from '../../utils/units';
import { useTranslation } from 'react-i18next';
import { CardHeader, CardFooter, NoWrap } from './shared';
import { cardPadding } from '../../utils/units';

interface ProgressCardProps {
  aggregates: Aggregates;
  goal?: number;
  format?: 'post' | 'story';
  palette?: Palette;
  textOverrides?: Record<string, string>;
  fontScale?: number;
  bgOverride?: string;
  safeZonePad?: boolean;
  showHeader?: boolean;
  showFooter?: boolean;
}

export const ProgressCard = forwardRef<HTMLDivElement, ProgressCardProps>(
  ({ aggregates, goal, format = 'story', palette = DEFAULT_PALETTE, textOverrides = {}, fontScale = 1, bgOverride, safeZonePad, showHeader = true, showFooter = true }, ref) => {
    const { t } = useTranslation('templates');
    const isStory = format === 'story';
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

    return (
      <div
        ref={ref}
        style={{
          width: 1080,
          height: isStory ? 1920 : 1080,
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
        <div
          style={{
            position: 'absolute',
            bottom: -150,
            left: -150,
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${p.glowColor} 0%, transparent 70%)`,
            pointerEvents: 'none',
          }}
        />

        {/* Header */}
        {showHeader && (
          <CardHeader palette={p} fz={fz} title={tx('title')} right={tx('dateRange', defaultDateRange)} />
        )}

        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div data-sticker="hero">
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

          {progressPct !== null && (
            <div data-sticker="progressBar" style={{ marginTop: 56 }}>
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
