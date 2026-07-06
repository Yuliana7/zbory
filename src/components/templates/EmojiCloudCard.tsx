import { forwardRef } from 'react';
import type { Aggregates, CommentInsights } from '../../types';
import { DEFAULT_PALETTE, type Palette } from '../../utils/palettes';
import { rem } from '../../utils/units';
import { useTranslation } from 'react-i18next';
import { cardPadding } from '../../utils/units';

interface EmojiCloudCardProps {
  aggregates: Aggregates;
  commentInsights?: CommentInsights | null;
  format?: 'post' | 'story';
  palette?: Palette;
  textOverrides?: Record<string, string>;
  fontScale?: number;
  bgOverride?: string;
  safeZonePad?: boolean;
}

/** The emotions of the fundraiser: top emojis from donor comments, sized by frequency. */
export const EmojiCloudCard = forwardRef<HTMLDivElement, EmojiCloudCardProps>(
  ({ commentInsights, format = 'post', palette = DEFAULT_PALETTE, textOverrides = {}, fontScale = 1, bgOverride, safeZonePad }, ref) => {
    const { t } = useTranslation('templates');
    const isStory = format === 'story';
    const p = palette;
    const fz = (n: number) => rem(n * fontScale);
    const tx = (key: string) => textOverrides[key] ?? t(`emoji-cloud.${key}`);

    const emojis = commentInsights?.topEmojis ?? [];
    const maxCount = emojis[0]?.count || 1;

    return (
      <div
        ref={ref}
        style={{
          width: 1080,
          height: isStory ? 1920 : 1080,
          background: bgOverride ?? p.background,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: cardPadding(isStory, safeZonePad, '120px 80px'),
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
          color: p.primary,
          boxSizing: 'border-box',
          position: 'relative',
          overflow: 'hidden',
          textAlign: 'center',
        }}
      >
        {/* Glow */}
        <div
          style={{
            position: 'absolute',
            top: '45%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 900,
            height: 900,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${p.glowColor} 0%, transparent 65%)`,
            pointerEvents: 'none',
          }}
        />

        {/* Title */}
        <div
          style={{
            fontSize: fz(56),
            fontWeight: 800,
            letterSpacing: '-1px',
            marginBottom: isStory ? 100 : 64,
            background: `${p.accentGradient} text`,
            WebkitTextFillColor: 'transparent',
          }}
        >
          {tx('title')}
        </div>

        {/* Cloud */}
        <div
          data-sticker="cloud"
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: 48,
            flexWrap: 'wrap',
            marginBottom: isStory ? 100 : 64,
          }}
        >
          {emojis.length === 0 ? (
            <div style={{ fontSize: fz(32), color: p.secondary }}>{t('emoji-cloud.noDataLabel')}</div>
          ) : (
            emojis.map(({ emoji, count }, i) => {
              // Scale by relative frequency; the leader is huge, the rest legible
              const size = 90 + (count / maxCount) * 180;
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontSize: fz(size), lineHeight: 1 }}>{emoji}</span>
                  <span style={{ fontSize: fz(28), fontWeight: 700, color: p.secondary }}>×{count}</span>
                </div>
              );
            })
          )}
        </div>

        {/* Source line */}
        {commentInsights && commentInsights.totalWithComments > 0 && (
          <div style={{ fontSize: fz(26), color: p.secondary }}>
            {tx('fromCommentsLabel')} {commentInsights.totalWithComments}
          </div>
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
