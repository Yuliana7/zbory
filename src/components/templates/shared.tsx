import { forwardRef, type ReactNode, type CSSProperties } from 'react';
import type { Aggregates } from '../../types';
import type { Palette } from '../../utils/palettes';
import { cardPadding } from '../../utils/units';

const fmtUA = (n: number) => new Intl.NumberFormat('uk-UA').format(Math.round(n));

interface CardShellProps {
  format: 'post' | 'post-4-5' | 'story';
  palette: Palette;
  bgOverride?: string;
  safeZonePad?: boolean;
  /** Story-format default padding — post format always gets a flat 80px. */
  storyPadding?: string;
  /** Horizontal padding used once safeZonePad kicks in. */
  safeZoneHorizontal?: string;
  /** Centers content both ways with centered text (thank-you/emoji-cloud style). */
  center?: boolean;
  children: ReactNode;
}

/**
 * The 1080-wide card frame every template renders into: size, background,
 * padding and base typography. Every template card wraps its content in this
 * instead of repeating the same outer <div> by hand.
 */
export const CardShell = forwardRef<HTMLDivElement, CardShellProps>(
  (
    { format, palette: p, bgOverride, safeZonePad, storyPadding = '100px 80px', safeZoneHorizontal = '80px', center, children },
    ref,
  ) => {
    const isStory = format === 'story';
    return (
      <div
        ref={ref}
        style={{
          width: 1080,
          height: format === 'post-4-5' ? 1350 : isStory ? 1920 : 1080,
          background: bgOverride ?? p.background,
          display: 'flex',
          flexDirection: 'column',
          ...(center ? { alignItems: 'center', justifyContent: 'center', textAlign: 'center' } as CSSProperties : null),
          padding: cardPadding(isStory, safeZonePad, storyPadding, safeZoneHorizontal),
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
          color: p.primary,
          boxSizing: 'border-box',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    );
  },
);

/** A soft radial-gradient blob used to decorate a card's background; position/size via `style`. */
export function GlowBlob({ palette: p, fade = 70, style }: { palette: Palette; fade?: number; style: CSSProperties }) {
  return (
    <div
      style={{
        position: 'absolute',
        borderRadius: '50%',
        background: `radial-gradient(circle, ${p.glowColor} 0%, transparent ${fade}%)`,
        pointerEvents: 'none',
        ...style,
      }}
    />
  );
}

/**
 * Keeps an amount and its ₴ sign on one line — without this the sign can
 * wrap onto its own row in the exported PNG.
 */
export function NoWrap({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <span style={{ whiteSpace: 'nowrap', ...style }}>{children}</span>;
}

/** UA flag accent bar pinned to the card's bottom edge — optional per card. */
export function UAFlagBar({ show = true, height = 8 }: { show?: boolean; height?: number }) {
  if (!show) return null;
  return (
    <div
      data-element="uaflag"
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height,
        background: 'linear-gradient(90deg, #005BBB 50%, #FFD500 50%)',
      }}
    />
  );
}

interface CardHeaderProps {
  palette: Palette;
  fz: (n: number) => string;
  title: string;
  /** Right-aligned slot, e.g. the campaign date range */
  right?: ReactNode;
  marginBottom?: number;
}

/** Standard template header: ₴ badge + title, no bordered box */
export function CardHeader({ palette: p, fz, title, right, marginBottom = 0 }: CardHeaderProps) {
  return (
    <div data-element="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            width: 56,
            height: 56,
            background: p.logoGradient,
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: fz(28),
            color: '#fff',
            flexShrink: 0,
          }}
        >
          ₴
        </div>
        <div style={{ fontSize: fz(28), fontWeight: 700, letterSpacing: '-0.5px' }}>{title}</div>
      </div>
      {right && (
        <div style={{ textAlign: 'right', color: p.secondary, fontSize: fz(20), maxWidth: 420 }}>
          {right}
        </div>
      )}
    </div>
  );
}

interface CardFooterProps {
  palette: Palette;
  fz: (n: number) => string;
  aggregates: Aggregates;
  labels: { collected: string; median: string; max: string };
}

/**
 * Standard Progress-category footer: Зібрано / Середній донат (median, the
 * honest "typical" value) / Найбільший — plain text row, no bordered box.
 */
export function CardFooter({ palette: p, fz, aggregates, labels }: CardFooterProps) {
  const stats = [
    { label: labels.collected, value: <NoWrap>{fmtUA(aggregates.totalAmount)} ₴</NoWrap> },
    { label: labels.median, value: <NoWrap>{fmtUA(aggregates.medianDonation)} ₴</NoWrap> },
    { label: labels.max, value: <NoWrap>{fmtUA(aggregates.maxDonation)} ₴</NoWrap> },
  ];
  return (
    <div
      data-element="footer"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        paddingTop: 40,
        borderTop: `1px solid ${p.cardBorder}`,
      }}
    >
      {stats.map((stat) => (
        <div key={stat.label} style={{ textAlign: 'center' }}>
          <div style={{ fontSize: fz(36), fontWeight: 700 }}>{stat.value}</div>
          <div style={{ fontSize: fz(20), color: p.secondary, marginTop: 4 }}>{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
