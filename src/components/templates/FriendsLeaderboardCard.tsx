import { forwardRef } from 'react';
import type { Aggregates, FriendJar } from '../../types';
import { computeFriendStats, friendBar, friendProgress, visibleFriends } from '../../utils/friendJars';
import { DEFAULT_PALETTE, type Palette } from '../../utils/palettes';
import { rem } from '../../utils/units';
import { useTranslation } from 'react-i18next';
import { CardHeader, NoWrap, UAFlagBar, CardShell, GlowBlob } from './shared';

interface FriendsLeaderboardCardProps {
  aggregates: Aggregates;
  friends?: FriendJar[];
  /** helpers the user switched off for this card */
  hiddenFriendIds?: string[];
  format?: 'post' | 'post-4-5' | 'story';
  palette?: Palette;
  textOverrides?: Record<string, string>;
  fontScale?: number;
  bgOverride?: string;
  safeZonePad?: boolean;
  hidden?: Set<string>;
}

// Same greens the progress card uses for a reached goal
const REACHED_BAR = 'linear-gradient(90deg, #4ade80, #22c55e)';
const REACHED_TEXT = '#4ade80';

export const FriendsLeaderboardCard = forwardRef<HTMLDivElement, FriendsLeaderboardCardProps>(
  ({ aggregates, friends = [], hiddenFriendIds, format = 'story', palette = DEFAULT_PALETTE, textOverrides = {}, fontScale = 1, bgOverride, safeZonePad, hidden = new Set() }, ref) => {
    const { t } = useTranslation('templates');
    const isStory = format === 'story';
    const p = palette;
    const fz = (n: number) => rem(n * fontScale);
    const tx = (key: string) => textOverrides[key] ?? t(`friends-leaderboard.${key}`);
    const fmt = (n: number) => new Intl.NumberFormat('uk-UA').format(Math.round(n));

    // Everything listed, minus what the user switched off for this card; the total and the
    // "reached" count describe exactly what is shown, so the card adds up on its own.
    const listed = visibleFriends(computeFriendStats(friends, aggregates.totalAmount).ranked, hiddenFriendIds);
    const total = listed.reduce((sum, f) => sum + f.raised, 0);
    const targeted = listed.filter((f) => friendProgress(f).pct !== null);
    const reachedCount = targeted.filter((f) => friendProgress(f).reached).length;
    // A row with a target carries an extra line (percentage + target), so a post fits fewer rows
    const maxRows = isStory ? 7 : targeted.length > 0 ? 3 : 4;
    const rows = listed.slice(0, maxRows);
    const rest = listed.length - rows.length;

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
            {rows.map((f, i) => {
              const bar = friendBar(f, listed);
              return (
                <div
                  key={f.id}
                  style={{
                    background: p.cardBg,
                    border: `1px solid ${bar.reached ? 'rgba(74, 222, 128, 0.55)' : p.cardBorder}`,
                    borderRadius: 24,
                    padding: '26px 32px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div style={{ width: 56, textAlign: 'center', fontSize: fz(36), fontWeight: 700, color: p.secondary, flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 14, fontSize: fz(32), fontWeight: 700 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{f.name || '—'}</span>
                      {bar.reached && (
                        <span
                          data-reached
                          style={{
                            width: fz(36),
                            height: fz(36),
                            borderRadius: '50%',
                            background: '#22c55e',
                            color: '#fff',
                            fontSize: fz(24),
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: fz(32), fontWeight: 800, color: p.accent, flexShrink: 0 }}>
                      <NoWrap>{fmt(f.raised)} ₴</NoWrap>
                    </div>
                  </div>
                  {bar.mode !== 'none' && (
                    <div style={{ height: 10, background: p.progressTrack, borderRadius: 5, overflow: 'hidden', marginTop: 18 }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${bar.fill * 100}%`,
                          background: bar.reached ? REACHED_BAR : p.chartLine,
                          borderRadius: 5,
                        }}
                      />
                    </div>
                  )}
                  {bar.pct !== null && f.target && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: fz(22), color: p.secondary }}>
                      <span style={{ fontWeight: 700, color: bar.reached ? REACHED_TEXT : p.primary }}>
                        <NoWrap>{fmt(bar.pct)}%</NoWrap>
                      </span>
                      <NoWrap>
                        {tx('targetLabel')} {fmt(f.target)} ₴
                      </NoWrap>
                    </div>
                  )}
                </div>
              );
            })}
            {rest > 0 && (
              <div style={{ textAlign: 'center', fontSize: fz(24), color: p.secondary }}>
                {t('friends-leaderboard.more', { n: rest })}
              </div>
            )}
          </div>
        )}

        {!hidden.has('reachedLine') && targeted.length > 0 && (
          <div
            data-element="reachedLine"
            style={{ marginTop: 28, textAlign: 'center', fontSize: fz(28), fontWeight: 600, color: p.secondary }}
          >
            🎯 {tx('reachedLabel')}:{' '}
            <span style={{ color: reachedCount > 0 ? REACHED_TEXT : p.primary, fontWeight: 800 }}>
              {t('friends-leaderboard.reachedOf', { reached: reachedCount, total: targeted.length })}
            </span>
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
