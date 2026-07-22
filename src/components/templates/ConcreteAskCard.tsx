import { forwardRef } from 'react';
import type { Aggregates } from '../../types';
import { defaultAskUnit } from '../../utils/dataAggregator';
import { DEFAULT_PALETTE, type Palette } from '../../utils/palettes';
import { rem } from '../../utils/units';
import { useTranslation } from 'react-i18next';
import { CardHeader, CardFooter, NoWrap, UAFlagBar } from './shared';
import { cardPadding } from '../../utils/units';

interface ConcreteAskCardProps {
  aggregates: Aggregates;
  goal?: number;
  format?: 'post' | 'post-4-5' | 'story';
  palette?: Palette;
  textOverrides?: Record<string, string>;
  fontScale?: number;
  bgOverride?: string;
  safeZonePad?: boolean;
  showHeader?: boolean;
  showFooter?: boolean;
  showUAFlag?: boolean;
}

/**
 * Turns the abstract remaining sum into a countable ask:
 * "Ще 42 донати по 100 ₴ — і збір закрито".
 */
export const ConcreteAskCard = forwardRef<HTMLDivElement, ConcreteAskCardProps>(
  ({ aggregates, goal, format = 'post', palette = DEFAULT_PALETTE, textOverrides = {}, fontScale = 1, bgOverride, safeZonePad, showHeader = true, showFooter = true, showUAFlag = true }, ref) => {
    const { t } = useTranslation('templates');
    const isStory = format === 'story';
    const p = palette;
    const fz = (n: number) => rem(n * fontScale);
    const tx = (key: string, fallback?: string) => textOverrides[key] ?? fallback ?? t(`concrete-ask.${key}`);

    const fmt = (n: number) => new Intl.NumberFormat('uk-UA').format(Math.round(n));

    const total = aggregates.totalAmount;
    const remaining = goal ? Math.max(goal - total, 0) : 0;
    const progressPct = goal ? Math.min((total / goal) * 100, 100) : 0;

    const unitDefault = defaultAskUnit(aggregates.medianDonation);
    const unit = parseFloat(tx('unitAmount', String(unitDefault))) || unitDefault;
    const askCount = unit > 0 ? Math.ceil(remaining / unit) : 0;

    const goalReached = !!goal && remaining === 0;

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
            top: -200,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 800,
            height: 800,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${p.glowColor} 0%, transparent 65%)`,
            pointerEvents: 'none',
          }}
        />

        {/* Header */}
        {showHeader && (
          <CardHeader palette={p} fz={fz} title={tx('title')} marginBottom={isStory ? 80 : 56} />
        )}

        {/* Hero */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div data-sticker="hero">
            {!goal ? (
              <div
                style={{
                  fontSize: fz(80),
                  fontWeight: 900,
                  lineHeight: 1.05,
                  background: `${p.accentGradient} text`,
                  WebkitTextFillColor: 'transparent',
                  marginBottom: 40,
                }}
              >
                {tx('noGoal')}
              </div>
            ) : goalReached ? (
              <div
                style={{
                  fontSize: fz(88),
                  fontWeight: 900,
                  lineHeight: 1.05,
                  background: `${p.accentGradient} text`,
                  WebkitTextFillColor: 'transparent',
                  marginBottom: 40,
                }}
              >
                {tx('goalReached')}
              </div>
            ) : (
              <>
                <div
                  style={{
                    fontSize: fz(96),
                    fontWeight: 900,
                    letterSpacing: '-3px',
                    lineHeight: 1.05,
                    background: `${p.accentGradient} text`,
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {tx('askPrefix')} {fmt(askCount)} {tx('donationsWord')}
                </div>
                <div style={{ fontSize: fz(52), fontWeight: 700, color: p.primary, marginTop: 16, letterSpacing: '-1px' }}>
                  <NoWrap>{tx('unitPrefix')} {fmt(unit)} ₴</NoWrap> {tx('closingLine')}
                </div>
                <div style={{ fontSize: fz(26), color: p.secondary, marginTop: 24 }}>
                  {tx('remainingLabel')} <NoWrap>{fmt(remaining)} ₴</NoWrap>
                </div>
              </>
            )}
          </div>

          {/* Progress bar */}
          {!!goal && (
            <div style={{ marginTop: 56 }}>
              <div style={{ height: 24, background: p.progressTrack, borderRadius: 12, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${progressPct}%`,
                    background: p.accentGradient,
                    borderRadius: 12,
                  }}
                />
              </div>
              <div style={{ textAlign: 'right', marginTop: 8, fontSize: fz(22), fontWeight: 700, color: p.accent }}>
                {Math.round((total / goal) * 100)}%
              </div>
            </div>
          )}

          {/* Jar link */}
          {textOverrides.linkUrl?.trim() && (
            <div
              style={{
                marginTop: 40,
                background: p.cardBg,
                border: `1px solid ${p.cardBorder}`,
                borderRadius: 24,
                padding: '32px 44px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: fz(34), fontWeight: 800, color: p.primary, lineHeight: 1.2, overflowWrap: 'break-word' }}>
                🔗 {textOverrides.linkUrl.trim()}
              </div>
            </div>
          )}
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

        <UAFlagBar show={showUAFlag} />
      </div>
    );
  }
);
