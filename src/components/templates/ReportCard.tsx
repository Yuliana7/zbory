import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReportStats } from '../../utils/campaignAnalytics';
import { DEFAULT_PALETTE, type Palette } from '../../utils/palettes';
import { rem, cardPadding } from '../../utils/units';
import { NoWrap, CardHeader } from './shared';

interface ReportCardProps {
  report: ReportStats;
  periodLabel: string; // «за К3 2026 року», «за 2026 рік», «за весь час»
  format?: 'post' | 'story';
  palette?: Palette;
  textOverrides?: Record<string, string>;
  fontScale?: number;
  bgOverride?: string;
  safeZonePad?: boolean;
}

const fmtUA = (n: number) => new Intl.NumberFormat('uk-UA').format(Math.round(n));
const fmtDate = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;

/** Cross-campaign report («Звіти»): totals for a quarter / year / all time as one shareable image. */
export const ReportCard = forwardRef<HTMLDivElement, ReportCardProps>(
  ({ report, periodLabel, format = 'story', palette = DEFAULT_PALETTE, textOverrides = {}, fontScale = 1, bgOverride, safeZonePad }, ref) => {
    const { t } = useTranslation('templates');
    const isStory = format === 'story';
    const p = palette;
    const fz = (n: number) => rem(n * fontScale);
    const tx = (key: string) => textOverrides[key] ?? t(`report.${key}`);

    const maxCampaign = Math.max(...report.topCampaigns.map((c) => c.amount), 1);

    return (
      <div
        ref={ref}
        style={{
          width: 1080,
          height: isStory ? 1920 : 1080,
          background: bgOverride ?? p.background,
          display: 'flex',
          flexDirection: 'column',
          padding: cardPadding(isStory, safeZonePad, '100px 80px'),
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
          color: p.primary,
          boxSizing: 'border-box',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
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

        <CardHeader
          palette={p}
          fz={fz}
          title={tx('title')}
          right={
            report.firstDate && report.lastDate ? (
              <NoWrap>{`${fmtDate(report.firstDate)} — ${fmtDate(report.lastDate)}`}</NoWrap>
            ) : undefined
          }
        />

        {/* Hero: total for the period */}
        <div data-sticker="report-hero" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div
            style={{
              fontSize: fz(isStory ? 116 : 96),
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: '-4px',
              background: `${p.accentGradient} text`,
              WebkitTextFillColor: 'transparent',
              marginBottom: 24,
            }}
          >
            <NoWrap>{fmtUA(report.totalAmount)} ₴</NoWrap>
          </div>
          <div style={{ fontSize: fz(42), fontWeight: 600, color: p.secondary, letterSpacing: '-1px' }}>
            {periodLabel}
          </div>
        </div>

        {/* Stats grid */}
        <div data-sticker="report-stats" style={{ display: 'flex', gap: 20, marginBottom: isStory ? 48 : 36 }}>
          {[
            { label: tx('campaigns'), value: fmtUA(report.campaignCount) },
            { label: tx('donations'), value: fmtUA(report.donationCount) },
            { label: tx('donors'), value: fmtUA(report.uniqueDonors) },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                flex: 1,
                background: p.cardBg,
                border: `1px solid ${p.cardBorder}`,
                borderRadius: 20,
                padding: '28px 20px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: fz(44), fontWeight: 800, color: p.primary }}>{s.value}</div>
              <div style={{ fontSize: fz(20), color: p.secondary, marginTop: 8 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Biggest jars of the period */}
        {report.topCampaigns.length > 0 && (
          <div
            data-sticker="report-top"
            style={{
              background: p.cardBg,
              border: `1px solid ${p.cardBorder}`,
              borderRadius: 20,
              padding: '32px 36px',
              marginBottom: isStory ? 48 : 36,
            }}
          >
            <div style={{ fontSize: fz(22), fontWeight: 700, color: p.secondary, marginBottom: 20, textTransform: 'uppercase', letterSpacing: '1px' }}>
              {tx('topTitle')}
            </div>
            {report.topCampaigns.map((c) => (
              <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
                <div
                  style={{
                    width: 300,
                    fontSize: fz(24),
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    flexShrink: 0,
                  }}
                >
                  {c.name}
                </div>
                <div style={{ flex: 1, height: 16, background: p.progressTrack, borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(c.amount / maxCampaign) * 100}%`, background: p.chartLine, borderRadius: 8 }} />
                </div>
                <div style={{ width: 180, textAlign: 'right', fontSize: fz(24), fontWeight: 800 }}>
                  <NoWrap>{fmtUA(c.amount)} ₴</NoWrap>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Thank-you line */}
        <div style={{ fontSize: fz(30), fontWeight: 600, color: p.accent, textAlign: 'center', marginBottom: 20 }}>
          {tx('thanks')}
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
  },
);
