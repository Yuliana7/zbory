import { forwardRef } from 'react';
import type { Aggregates } from '../../types';
import { DEFAULT_PALETTE, type Palette } from '../../utils/palettes';
import { rem } from '../../utils/units';
import { useTranslation } from 'react-i18next';
import { CardHeader, CardFooter, NoWrap, UAFlagBar, CardShell, GlowBlob } from './shared';

interface UrgencyCardProps {
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

export const UrgencyCard = forwardRef<HTMLDivElement, UrgencyCardProps>(
  ({ aggregates, goal, format = 'story', palette = DEFAULT_PALETTE, textOverrides = {}, fontScale = 1, bgOverride, safeZonePad, hidden = new Set() }, ref) => {
    const { t } = useTranslation('templates');
    const isStory = format === 'story';
    const p = palette;
    const fz = (n: number) => rem(n * fontScale);
    const tx = (key: string) => textOverrides[key] ?? t(`urgency.${key}`);

    const fmt = (n: number) => new Intl.NumberFormat('uk-UA').format(Math.round(n));

    const total = aggregates.totalAmount;
    const remaining = goal ? Math.max(goal - total, 0) : null;
    const progressPct = goal ? Math.min((total / goal) * 100, 100) : null;
    const barWidthPct = progressPct ?? 0;

    const remainingFormatted = remaining !== null ? fmt(remaining) : null;
    const goalFormatted = goal ? fmt(goal) : null;

    return (
      <CardShell ref={ref} format={format} palette={p} bgOverride={bgOverride} safeZonePad={safeZonePad}>
        {!hidden.has('glow') && (
          <div data-element="glow">
            <GlowBlob palette={p} fade={65} style={{ top: -200, left: '50%', transform: 'translateX(-50%)', width: 800, height: 800 }} />
          </div>
        )}

        {/* Header */}
        {!hidden.has('header') && (
          <CardHeader palette={p} fz={fz} title={tx('title')} marginBottom={isStory ? 80 : 60} />
        )}

        {/* Hero */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {!hidden.has('hero') && (remainingFormatted !== null ? (
            <div data-element="hero">
              <div style={{ fontSize: fz(28), color: p.secondary, marginBottom: 12 }}>
                {tx('remainingLabel')}
              </div>
              <div
                style={{
                  fontSize: fz(108),
                  fontWeight: 900,
                  letterSpacing: '-4px',
                  lineHeight: 1,
                  background: `${p.accentGradient} text`,
                  WebkitTextFillColor: 'transparent',
                  marginBottom: 8,
                }}
              >
                {remainingFormatted}
              </div>
              <div style={{ fontSize: fz(48), fontWeight: 600, color: p.secondary, letterSpacing: '-1px', marginBottom: 56 }}>
                {tx('currencyLabel')}
              </div>
            </div>
          ) : (
            <div
              style={{
                fontSize: fz(80),
                fontWeight: 900,
                lineHeight: 1,
                background: `${p.accentGradient} text`,
                WebkitTextFillColor: 'transparent',
                marginBottom: 56,
              }}
            >
              {tx('ctaNoGoal')}
            </div>
          ))}

          {/* Progress bar */}
          {!hidden.has('progressBar') && (
          <div data-element="progressBar" style={{ marginBottom: 56 }}>
            {goalFormatted && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: fz(22), color: p.secondary }}>
                  {tx('collectedLabel')} <NoWrap>{fmt(total)} ₴</NoWrap>
                </span>
                <span style={{ fontSize: fz(22), color: p.secondary }}>
                  {tx('goalLabel')} <NoWrap>{goalFormatted} ₴</NoWrap>
                </span>
              </div>
            )}
            <div
              style={{
                height: 24,
                background: p.progressTrack,
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${barWidthPct}%`,
                  background: p.accentGradient,
                  borderRadius: 12,
                }}
              />
            </div>
            {progressPct !== null && (
              <div style={{ textAlign: 'right', marginTop: 8, fontSize: fz(22), fontWeight: 700, color: p.accent }}>
                {Math.round(progressPct)}%
              </div>
            )}
          </div>
          )}

          {/* Jar link — rendered only when the volunteer pasted a URL */}
          {!hidden.has('linkBox') && textOverrides.linkUrl?.trim() && (
            <div
              data-element="linkBox"
              style={{
                background: p.cardBg,
                border: `1px solid ${p.cardBorder}`,
                borderRadius: 24,
                padding: '36px 48px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: fz(36),
                  fontWeight: 800,
                  color: p.primary,
                  lineHeight: 1.2,
                  overflowWrap: 'break-word',
                }}
              >
                🔗 {textOverrides.linkUrl.trim()}
              </div>
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
