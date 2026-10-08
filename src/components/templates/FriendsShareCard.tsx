import { forwardRef } from 'react';
import type { Aggregates, FriendJar } from '../../types';
import { computeFriendStats, formatSharePct } from '../../utils/friendJars';
import { DEFAULT_PALETTE, type Palette } from '../../utils/palettes';
import { rem } from '../../utils/units';
import { useTranslation } from 'react-i18next';
import { CardHeader, NoWrap, UAFlagBar, CardShell, GlowBlob } from './shared';

interface FriendsShareCardProps {
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

export const FriendsShareCard = forwardRef<HTMLDivElement, FriendsShareCardProps>(
  ({ aggregates, friends = [], format = 'story', palette = DEFAULT_PALETTE, textOverrides = {}, fontScale = 1, bgOverride, safeZonePad, hidden = new Set() }, ref) => {
    const { t } = useTranslation('templates');
    const isStory = format === 'story';
    const p = palette;
    const fz = (n: number) => rem(n * fontScale);
    const tx = (key: string) => textOverrides[key] ?? t(`friends-share.${key}`);
    const fmt = (n: number) => new Intl.NumberFormat('uk-UA').format(Math.round(n));

    const { ranked, total, share } = computeFriendStats(friends, aggregates.totalAmount);

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
              <div
                style={{
                  fontSize: fz(isStory ? 240 : 190),
                  fontWeight: 900,
                  lineHeight: 0.9,
                  letterSpacing: '-8px',
                  background: `${p.accentGradient} text`,
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {formatSharePct(share)}%
              </div>
              <div style={{ fontSize: fz(44), fontWeight: 600, color: p.secondary, marginTop: 20, letterSpacing: '-1px' }}>
                {tx('heroLabel')}
              </div>
            </div>
          )}

          {!hidden.has('amounts') && (
            <div data-element="amounts" style={{ marginTop: 56, fontSize: fz(40), fontWeight: 700 }}>
              <NoWrap>{fmt(total)} ₴</NoWrap>{' '}
              <span style={{ color: p.secondary, fontWeight: 500 }}>{tx('ofLabel')}</span>{' '}
              <NoWrap>{fmt(aggregates.totalAmount)} ₴</NoWrap>
            </div>
          )}

          {!hidden.has('shareBar') && (
            <div data-element="shareBar" style={{ marginTop: 36, height: 28, background: p.progressTrack, borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${share * 100}%`, background: p.chartLine, borderRadius: 14 }} />
            </div>
          )}
        </div>

        {!hidden.has('count') && (
          <div
            data-element="count"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              paddingTop: 36,
              borderTop: `1px solid ${p.cardBorder}`,
            }}
          >
            <div style={{ fontSize: fz(26), color: p.secondary }}>{tx('countLabel')}</div>
            <div style={{ fontSize: fz(44), fontWeight: 800 }}>{ranked.filter((f) => f.raised > 0).length}</div>
          </div>
        )}
        <UAFlagBar show={!hidden.has('uaflag')} />
      </CardShell>
    );
  },
);
