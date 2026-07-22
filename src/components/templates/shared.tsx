import type { ReactNode, CSSProperties } from 'react';
import type { Aggregates } from '../../types';
import type { Palette } from '../../utils/palettes';

const fmtUA = (n: number) => new Intl.NumberFormat('uk-UA').format(Math.round(n));

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
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom }}>
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
