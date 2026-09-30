import { forwardRef } from 'react';
import type { Aggregates } from '../../types';
import { DEFAULT_PALETTE, type Palette } from '../../utils/palettes';
import { rem } from '../../utils/units';
import { useTranslation } from 'react-i18next';
import { CardHeader, CardFooter, NoWrap, UAFlagBar, CardShell, GlowBlob } from './shared';

interface MilestoneCardProps {
  aggregates: Aggregates;
  goal?: number;
  format?: 'post' | 'post-4-5' | 'story';
  palette?: Palette;
  textOverrides?: Record<string, string>;
  fontScale?: number;
  bgOverride?: string;
  safeZonePad?: boolean;
  hidden?: Set<string>;
}

export const MilestoneCard = forwardRef<HTMLDivElement, MilestoneCardProps>(
  ({ aggregates, goal, format = 'story', palette = DEFAULT_PALETTE, textOverrides = {}, fontScale = 1, bgOverride, safeZonePad, hidden = new Set() }, ref) => {
    const { t } = useTranslation('templates');
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
      <CardShell ref={ref} format={format} palette={p} bgOverride={bgOverride} safeZonePad={safeZonePad}>
        {!hidden.has('glow') && (
          <div data-element="glow">
            <GlowBlob palette={p} fade={65} style={{ top: '40%', left: '50%', transform: 'translate(-50%, -50%)', width: 900, height: 900 }} />
          </div>
        )}

        {/* Header — top left with the ₴ icon */}
        {!hidden.has('header') && <CardHeader palette={p} fz={fz} title={tx('title')} />}

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
        {!hidden.has('hero') && (displayPct !== null ? (
          <div
            data-element="hero"
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
        ))}

        {/* Achieved label */}
        {!hidden.has('achievedLabel') && (
        <div
          data-element="achievedLabel"
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
        )}

        {/* Progress bar */}
        {!hidden.has('progressBar') && barWidthPct !== null && (
          <div data-element="progressBar" style={{ width: '100%', marginBottom: 48 }}>
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
        {!hidden.has('collectedGoalLine') && (
        <div data-element="collectedGoalLine" style={{ fontSize: fz(28), color: p.secondary }}>
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
