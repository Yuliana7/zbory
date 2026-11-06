import { forwardRef } from 'react';
import type { Aggregates, FriendJar } from '../../types';
import { computeFriendStats } from '../../utils/friendJars';
import { DEFAULT_PALETTE, type Palette } from '../../utils/palettes';
import { rem } from '../../utils/units';
import { useTranslation } from 'react-i18next';
import { CardHeader, NoWrap, UAFlagBar, CardShell, GlowBlob } from './shared';
import { REACHED_BAR, REACHED_TEXT } from './FriendCardRow';

interface FriendsStatsCardProps {
  aggregates: Aggregates;
  friends?: FriendJar[];
  format?: 'post' | 'post-4-5' | 'story';
  palette?: Palette;
  textOverrides?: Record<string, string>;
  fontScale?: number;
  bgOverride?: string;
  safeZonePad?: boolean;
  hidden?: Set<string>;
}

/** All helper jars at a glance, the same numbers as the bar on the analytics page: how many jars there
 * are, what they raised and what they set out to raise. Without any target the bar and the target stay off. */
export const FriendsStatsCard = forwardRef<HTMLDivElement, FriendsStatsCardProps>(
  ({ aggregates, friends = [], format = 'story', palette = DEFAULT_PALETTE, textOverrides = {}, fontScale = 1, bgOverride, safeZonePad, hidden = new Set() }, ref) => {
    const { t } = useTranslation('templates');
    const isStory = format === 'story';
    const p = palette;
    const fz = (n: number) => rem(n * fontScale);
    const tx = (key: string) => textOverrides[key] ?? t(`friends-stats.${key}`);
    const fmt = (n: number) => new Intl.NumberFormat('uk-UA').format(Math.round(n));

    const { ranked, total, targetsTotal, targetsProgress } = computeFriendStats(friends, aggregates.totalAmount);
    const reached = targetsProgress !== null && targetsProgress >= 1;

    const stat = (label: string, value: string) => (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: fz(26), color: p.secondary }}>{label}</div>
        <div style={{ marginTop: 8, fontSize: fz(48), fontWeight: 800 }}>
          <NoWrap>{value}</NoWrap>
        </div>
      </div>
    );

    return (
      <CardShell ref={ref} format={format} palette={p} bgOverride={bgOverride} safeZonePad={safeZonePad}>
        {!hidden.has('glow') && (
          <div data-element="glow">
            <GlowBlob palette={p} style={{ top: -200, right: -200, width: 700, height: 700 }} />
            <GlowBlob palette={p} style={{ bottom: -150, left: -150, width: 500, height: 500 }} />
          </div>
        )}

        {!hidden.has('header') && <CardHeader palette={p} fz={fz} title={tx('title')} />}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {!hidden.has('hero') && (
            <div data-element="hero">
              <div style={{ fontSize: fz(30), fontWeight: 600, color: p.secondary, marginBottom: 16 }}>{tx('heroLabel')}</div>
              <div
                style={{
                  fontSize: fz(isStory ? 150 : 120),
                  fontWeight: 900,
                  lineHeight: 1,
                  letterSpacing: '-4px',
                  background: `${p.accentGradient} text`,
                  WebkitTextFillColor: 'transparent',
                }}
              >
                <NoWrap>{fmt(total)} ₴</NoWrap>
              </div>
            </div>
          )}

          {/* the bar is full at 100%; the number may go past it */}
          {!hidden.has('targetBar') && targetsProgress !== null && (
            <div data-element="targetBar" style={{ marginTop: 52 }}>
              <div style={{ height: 32, background: p.progressTrack, borderRadius: 16, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(1, targetsProgress) * 100}%`,
                    background: reached ? REACHED_BAR : p.chartLine,
                    borderRadius: 16,
                  }}
                />
              </div>
              <div style={{ marginTop: 16, textAlign: 'right', fontSize: fz(40), fontWeight: 800, color: reached ? REACHED_TEXT : p.primary }}>
                {Math.round(targetsProgress * 100)}%
              </div>
            </div>
          )}
        </div>

        {!hidden.has('stats') && (
          <div data-element="stats" style={{ display: 'flex', gap: 32, paddingTop: 36, borderTop: `1px solid ${p.cardBorder}` }}>
            {stat(tx('jarsLabel'), fmt(ranked.length))}
            {targetsProgress !== null && stat(tx('targetLabel'), `${fmt(targetsTotal)} ₴`)}
          </div>
        )}
        <UAFlagBar show={!hidden.has('uaflag')} />
      </CardShell>
    );
  },
);
