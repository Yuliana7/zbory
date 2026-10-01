import { forwardRef } from 'react';
import type { Aggregates, FriendJar } from '../../types';
import { computeFriendStats } from '../../utils/friendJars';
import { DEFAULT_PALETTE, type Palette } from '../../utils/palettes';
import { rem } from '../../utils/units';
import { useTranslation } from 'react-i18next';
import { CardHeader, NoWrap, UAFlagBar, CardShell, GlowBlob } from './shared';

interface FriendsLeaderboardCardProps {
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

const MEDALS = ['🥇', '🥈', '🥉'];

export const FriendsLeaderboardCard = forwardRef<HTMLDivElement, FriendsLeaderboardCardProps>(
  ({ aggregates, friends = [], format = 'story', palette = DEFAULT_PALETTE, textOverrides = {}, fontScale = 1, bgOverride, safeZonePad, hidden = new Set() }, ref) => {
    const { t } = useTranslation('templates');
    const isStory = format === 'story';
    const p = palette;
    const fz = (n: number) => rem(n * fontScale);
    const tx = (key: string) => textOverrides[key] ?? t(`friends-leaderboard.${key}`);
    const fmt = (n: number) => new Intl.NumberFormat('uk-UA').format(Math.round(n));

    const { ranked, total } = computeFriendStats(friends, aggregates.totalAmount);
    const maxRows = isStory ? 7 : 4;
    const rows = ranked.slice(0, maxRows);
    const rest = ranked.length - rows.length;
    const top = rows[0]?.raised ?? 1;

    return (
      <CardShell ref={ref} format={format} palette={p} bgOverride={bgOverride} safeZonePad={safeZonePad}>
        {!hidden.has('glow') && (
          <div data-element="glow">
            <GlowBlob palette={p} style={{ top: -200, right: -200, width: 700, height: 700 }} />
          </div>
        )}

        {!hidden.has('header') && <CardHeader palette={p} fz={fz} title={tx('title')} marginBottom={isStory ? 60 : 40} />}

        {!hidden.has('list') && (
          <div data-element="list" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: isStory ? 28 : 20 }}>
            {rows.map((f, i) => (
              <div
                key={f.id}
                style={{
                  background: p.cardBg,
                  border: `1px solid ${p.cardBorder}`,
                  borderRadius: 24,
                  padding: '26px 32px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ width: 56, textAlign: 'center', fontSize: fz(36), fontWeight: 700, color: p.secondary, flexShrink: 0 }}>
                    {MEDALS[i] ?? i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, fontSize: fz(32), fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.name || '—'}
                  </div>
                  <div style={{ fontSize: fz(32), fontWeight: 800, color: p.accent, flexShrink: 0 }}>
                    <NoWrap>{fmt(f.raised)} ₴</NoWrap>
                  </div>
                </div>
                <div style={{ height: 10, background: p.progressTrack, borderRadius: 5, overflow: 'hidden', marginTop: 18 }}>
                  <div style={{ height: '100%', width: `${(f.raised / top) * 100}%`, background: p.chartLine, borderRadius: 5 }} />
                </div>
              </div>
            ))}
            {rest > 0 && (
              <div style={{ textAlign: 'center', fontSize: fz(24), color: p.secondary }}>
                {t('friends-leaderboard.more', { n: rest })}
              </div>
            )}
          </div>
        )}

        {!hidden.has('totalLine') && (
          <div
            data-element="totalLine"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              paddingTop: 36,
              marginTop: 36,
              borderTop: `1px solid ${p.cardBorder}`,
            }}
          >
            <div style={{ fontSize: fz(26), color: p.secondary }}>{tx('totalLabel')}</div>
            <div style={{ fontSize: fz(44), fontWeight: 800 }}>
              <NoWrap>{fmt(total)} ₴</NoWrap>
            </div>
          </div>
        )}
        <UAFlagBar show={!hidden.has('uaflag')} />
      </CardShell>
    );
  },
);
