import { forwardRef } from 'react';
import type { Aggregates } from '../../types';
import { DEFAULT_PALETTE, type Palette } from '../../utils/palettes';
import { rem } from '../../utils/units';
import { useTranslation } from 'react-i18next';
import { cardPadding } from '../../utils/units';

export interface SelectedComment {
  text: string;
  donor?: string;
}

interface CommentsCardProps {
  aggregates: Aggregates;
  selectedComments?: SelectedComment[];
  format?: 'post' | 'post-4-5' | 'story';
  palette?: Palette;
  textOverrides?: Record<string, string>;
  fontScale?: number;
  bgOverride?: string;
  safeZonePad?: boolean;
}

/** Words of support: quote bubbles with comments the volunteer hand-picked. */
export const CommentsCard = forwardRef<HTMLDivElement, CommentsCardProps>(
  ({ selectedComments = [], format = 'story', palette = DEFAULT_PALETTE, textOverrides = {}, fontScale = 1, bgOverride, safeZonePad }, ref) => {
    const { t } = useTranslation('templates');
    const isStory = format === 'story';
    const p = palette;
    const fz = (n: number) => rem(n * fontScale);
    const tx = (key: string) => textOverrides[key] ?? t(`comments.${key}`);

    return (
      <div
        ref={ref}
        style={{
          width: 1080,
          height: format === 'post-4-5' ? 1350 : isStory ? 1920 : 1080,
          background: bgOverride ?? p.background,
          display: 'flex',
          flexDirection: 'column',
          padding: cardPadding(isStory, safeZonePad, '110px 90px', '90px'),
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
            right: -200,
            width: 700,
            height: 700,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${p.glowColor} 0%, transparent 70%)`,
            pointerEvents: 'none',
          }}
        />

        {/* Title */}
        <div
          style={{
            fontSize: fz(52),
            fontWeight: 800,
            letterSpacing: '-1px',
            marginBottom: isStory ? 80 : 48,
            background: `${p.accentGradient} text`,
            WebkitTextFillColor: 'transparent',
          }}
        >
          {tx('title')}
        </div>

        {/* Quotes */}
        <div
          data-sticker="quotes"
          style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: isStory ? 44 : 32 }}
        >
          {selectedComments.length === 0 ? (
            <div style={{ textAlign: 'center', color: p.secondary, fontSize: fz(30), lineHeight: 1.5 }}>
              {t('comments.emptyHint')}
            </div>
          ) : (
            selectedComments.map((c, i) => (
              <div
                key={i}
                style={{
                  background: p.cardBg,
                  border: `1px solid ${p.cardBorder}`,
                  borderRadius: 28,
                  padding: '36px 44px',
                  // Alternate alignment for a chat-like rhythm
                  alignSelf: i % 2 === 0 ? 'flex-start' : 'flex-end',
                  maxWidth: '88%',
                }}
              >
                <div style={{ fontSize: fz(34), lineHeight: 1.4, color: p.primary, overflowWrap: 'break-word' }}>
                  «{c.text}»
                </div>
                {c.donor && (
                  <div style={{ fontSize: fz(24), color: p.secondary, marginTop: 14 }}>— {c.donor}</div>
                )}
              </div>
            ))
          )}
        </div>

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
