import { forwardRef } from 'react';
import type { Aggregates } from '../../types';
import { DEFAULT_PALETTE, type Palette } from '../../utils/palettes';
import { rem } from '../../utils/units';
import { useTranslation } from 'react-i18next';
import { CardHeader, CardFooter, NoWrap } from './shared';
import { cardPadding } from '../../utils/units';

interface MilestoneCardProps {
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

export const MilestoneCard = forwardRef<HTMLDivElement, MilestoneCardProps>(
  ({ aggregates, goal, format = 'story', palette = DEFAULT_PALETTE, textOverrides = {}, fontScale = 1, bgOverride, safeZonePad, showHeader = true, showFooter = true }, ref) => {
    const { t } = useTranslation('templates');
    const isStory = format === 'story';
    const p = palette;
    const fz = (n: number) => rem(n * fontScale);
    const tx = (key: string, fallback?: string) => textOverrides[key] ?? fallback ?? t(`milestone.${key}`);

    const total = aggregates.totalAmount;
    const progressPct = goal ? (total / goal) * 100 : null;
    const displayPct = progressPct !== null ? Math.round(progressPct) : null;
    const barWidthPct = progressPct !== null ? Math.min(progressPct, 100) : null;

    const formattedTotal = new Intl.NumberFormat('uk-UA').format(Math.round(total));
    const formattedGoal = goal ? new Intl.NumberFormat('uk-UA').format(Math.round(goal)) : null;

    const achievedKey =
      progressPct === null
        ? 'achievedLabel_noGoal'
        : progressPct >= 100
        ? 'achievedLabel_100'
        : progressPct >= 75
        ? 'achievedLabel_75'
        : progressPct >= 50
        ? 'achievedLabel_50'
        : progressPct >= 25
        ? 'achievedLabel_25'
        : 'achievedLabel_0';
    const defaultAchieved = t(`milestone.${achievedKey}`);

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
        {/* Glow */}
        <div
          style={{
            position: 'absolute',
            top: '40%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 900,
            height: 900,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${p.glowColor} 0%, transparent 65%)`,
            pointerEvents: 'none',
          }}
        />

        {/* Header — top left with the ₴ icon */}
        {showHeader && <CardHeader palette={p} fz={fz} title={tx('title')} />}

        {/* Main — centered */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
        {displayPct !== null ? (
          <div
            data-sticker="hero"
            style={{
              fontSize: fz(200),
              fontWeight: 900,
              lineHeight: 0.9,
              letterSpacing: '-8px',
              background: `${p.accentGradient} text`,
              WebkitTextFillColor: 'transparent',
              marginBottom: 24,
            }}
          >
            {displayPct}%
          </div>
        ) : (
          <div
            style={{
              fontSize: fz(96),
              fontWeight: 900,
              lineHeight: 1,
              background: `${p.accentGradient} text`,
              WebkitTextFillColor: 'transparent',
              marginBottom: 24,
            }}
          >
            {tx('ongoingLabel')}
          </div>
        )}

        {/* Achieved label */}
        <div
          style={{
            fontSize: fz(44),
            fontWeight: 700,
            color: p.primary,
            marginBottom: 48,
            lineHeight: 1.2,
          }}
        >
          {tx('achievedLabel', defaultAchieved)}
        </div>

        {/* Progress bar */}
        {barWidthPct !== null && (
          <div style={{ width: '100%', marginBottom: 48 }}>
            <div
              style={{
                height: 16,
                background: p.progressTrack,
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${barWidthPct}%`,
                  background: p.accentGradient,
                  borderRadius: 8,
                  transition: 'width 0.3s',
                }}
              />
            </div>
          </div>
        )}

        {/* Collected / goal line */}
        <div style={{ fontSize: fz(28), color: p.secondary }}>
          {tx('collectedLabel')}{' '}
          <NoWrap style={{ fontWeight: 800, color: p.primary }}>{formattedTotal} ₴</NoWrap>
          {formattedGoal && (
            <>
              {' · '}
              {tx('goalLabel')}{' '}
              <NoWrap style={{ fontWeight: 800, color: p.primary }}>{formattedGoal} ₴</NoWrap>
            </>
          )}
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
