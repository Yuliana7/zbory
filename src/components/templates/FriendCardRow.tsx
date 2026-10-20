import type { FriendJar } from '../../types';
import type { FriendBar } from '../../utils/friendJars';
import type { Palette } from '../../utils/palettes';
import { NoWrap } from './shared';

// Same greens the progress card uses for a reached goal
export const REACHED_BAR = 'linear-gradient(90deg, #4ade80, #22c55e)';
export const REACHED_TEXT = '#4ade80';

interface FriendCardRowProps {
  friend: FriendJar;
  bar: FriendBar;
  palette: Palette;
  fz: (n: number) => string;
  fmt: (n: number) => string;
  /** medal/number in front of the name; omit for a list without ranking */
  rank?: string | number;
  /** the word before the target amount ("ціль") */
  targetLabel: string;
  /** a small tag after the name for a closed jar; omit to show none */
  closedLabel?: string;
}

/** One helper as a card row: name (with a ✓ once the target is reached), amount, a bar and the
 * percentage of the target. Shared by the leaderboard and the closed-jars card. */
export function FriendCardRow({ friend: f, bar, palette: p, fz, fmt, rank, targetLabel, closedLabel }: FriendCardRowProps) {
  return (
    <div
      style={{
        background: p.cardBg,
        border: `1px solid ${bar.reached ? 'rgba(74, 222, 128, 0.55)' : p.cardBorder}`,
        borderRadius: 24,
        padding: '26px 32px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {rank !== undefined && (
          <div style={{ width: 56, textAlign: 'center', fontSize: fz(36), fontWeight: 700, color: p.secondary, flexShrink: 0 }}>{rank}</div>
        )}
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
          {f.closed && closedLabel && (
            <span
              data-closed
              style={{ flexShrink: 0, fontSize: fz(20), fontWeight: 600, color: p.secondary, border: `1px solid ${p.cardBorder}`, borderRadius: 999, padding: '4px 14px' }}
            >
              {closedLabel}
            </span>
          )}
        </div>
        <div style={{ fontSize: fz(32), fontWeight: 800, color: p.accent, flexShrink: 0 }}>
          <NoWrap>{fmt(f.raised)} ₴</NoWrap>
        </div>
      </div>
      {bar.mode !== 'none' && (
        <div style={{ height: 10, background: p.progressTrack, borderRadius: 5, overflow: 'hidden', marginTop: 18 }}>
          <div style={{ height: '100%', width: `${bar.fill * 100}%`, background: bar.reached ? REACHED_BAR : p.chartLine, borderRadius: 5 }} />
        </div>
      )}
      {bar.pct !== null && f.target && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: fz(22), color: p.secondary }}>
          <span style={{ fontWeight: 700, color: bar.reached ? REACHED_TEXT : p.primary }}>
            <NoWrap>{fmt(bar.pct)}%</NoWrap>
          </span>
          <NoWrap>
            {targetLabel} {fmt(f.target)} ₴
          </NoWrap>
        </div>
      )}
    </div>
  );
}
