import { forwardRef } from 'react';
import type { Aggregates, FriendJar } from '../../types';
import { closedFriends, friendBar, friendProgress, visibleFriends } from '../../utils/friendJars';
import { DEFAULT_PALETTE, type Palette } from '../../utils/palettes';
import { rem } from '../../utils/units';
import { useTranslation } from 'react-i18next';
import { CardHeader, NoWrap, UAFlagBar, CardShell, GlowBlob } from './shared';
import { FriendCardRow, REACHED_TEXT } from './FriendCardRow';

interface FriendsClosedCardProps {
  aggregates: Aggregates;
  friends?: FriendJar[];
  /** closed helpers the user switched off for this card */
  hiddenFriendIds?: string[];
  format?: 'post' | 'post-4-5' | 'story';
  palette?: Palette;
  textOverrides?: Record<string, string>;
  fontScale?: number;
  bgOverride?: string;
  safeZonePad?: boolean;
  hidden?: Set<string>;
}

/** A wrap-up of the helper jars that are closed: how many, what they raised together, each one's final
 * amount and whether it hit its target. Open jars never appear here — that is the leaderboard's job. */
export const FriendsClosedCard = forwardRef<HTMLDivElement, FriendsClosedCardProps>(
  ({ friends = [], hiddenFriendIds, format = 'story', palette = DEFAULT_PALETTE, textOverrides = {}, fontScale = 1, bgOverride, safeZonePad, hidden = new Set() }, ref) => {
    const { t } = useTranslation('templates');
    const isStory = format === 'story';
    const p = palette;
    const fz = (n: number) => rem(n * fontScale);
    const tx = (key: string) => textOverrides[key] ?? t(`friends-closed.${key}`);
    const fmt = (n: number) => new Intl.NumberFormat('uk-UA').format(Math.round(n));

    // Only closed jars, minus what the user switched off; the numbers describe exactly what is shown
    const listed = visibleFriends(closedFriends(friends), hiddenFriendIds);
    const total = listed.reduce((sum, f) => sum + f.raised, 0);
    const targeted = listed.filter((f) => friendProgress(f).pct !== null);
    const reachedCount = targeted.filter((f) => friendProgress(f).reached).length;
    // a row with a target carries an extra line, so a post fits fewer rows
    const maxRows = isStory ? 6 : targeted.length > 0 ? 2 : 3;
    const rows = listed.slice(0, maxRows);
    const rest = listed.length - rows.length;

    return (
      <CardShell ref={ref} format={format} palette={p} bgOverride={bgOverride} safeZonePad={safeZonePad}>
        {!hidden.has('glow') && (
          <div data-element="glow">
            <GlowBlob palette={p} style={{ top: -200, right: -200, width: 700, height: 700 }} />
            <GlowBlob palette={p} style={{ bottom: -150, left: -150, width: 500, height: 500 }} />
          </div>
        )}

        {!hidden.has('header') && <CardHeader palette={p} fz={fz} title={tx('title')} marginBottom={isStory ? 48 : 28} />}

        {!hidden.has('hero') && (
          <div data-element="hero" style={{ marginBottom: isStory ? 44 : 28 }}>
            <div style={{ fontSize: fz(isStory ? 120 : 84), fontWeight: 800, lineHeight: 1, letterSpacing: -2 }}>
              <NoWrap>{fmt(total)} ₴</NoWrap>
            </div>
            <div style={{ marginTop: 14, fontSize: fz(30), color: p.secondary, fontWeight: 600 }}>
              {t('friends-closed.closedCount', { count: listed.length })} · {tx('heroLabel')}
            </div>
          </div>
        )}

        {!hidden.has('list') && (
          <div data-element="list" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: isStory ? 24 : 16 }}>
            {rows.map((f) => (
              <FriendCardRow key={f.id} friend={f} bar={friendBar(f, listed)} palette={p} fz={fz} fmt={fmt} targetLabel={tx('targetLabel')} />
            ))}
            {rest > 0 && (
              <div style={{ textAlign: 'center', fontSize: fz(24), color: p.secondary }}>{t('friends-closed.more', { n: rest })}</div>
            )}
          </div>
        )}

        {!hidden.has('reachedLine') && targeted.length > 0 && (
          <div data-element="reachedLine" style={{ marginTop: 24, textAlign: 'center', fontSize: fz(28), fontWeight: 600, color: p.secondary }}>
            🎯 {tx('reachedLabel')}:{' '}
            <span style={{ color: reachedCount > 0 ? REACHED_TEXT : p.primary, fontWeight: 800 }}>
              {t('friends-closed.reachedOf', { reached: reachedCount, total: targeted.length })}
            </span>
          </div>
        )}

        {!hidden.has('thanks') && (
          <div
            data-element="thanks"
            style={{ marginTop: 28, paddingTop: 28, borderTop: `1px solid ${p.cardBorder}`, textAlign: 'center', fontSize: fz(30), fontWeight: 600, color: p.secondary }}
          >
            {tx('thanks')}
          </div>
        )}
        <UAFlagBar show={!hidden.has('uaflag')} />
      </CardShell>
    );
  },
);
