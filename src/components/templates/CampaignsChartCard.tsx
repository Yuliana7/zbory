import { forwardRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { RawDonation } from '../../types';
import type { CampaignMeta } from '../../utils/campaignStore';
import { analyzeCampaigns } from '../../utils/campaignAnalytics';
import { DEFAULT_PALETTE, type Palette } from '../../utils/palettes';
import { rem, cardPadding } from '../../utils/units';
import { NoWrap, CardHeader } from './shared';

interface CampaignsChartCardProps {
  items: Array<{ meta: CampaignMeta; rawData: RawDonation[] }>;
  format?: 'post' | 'post-4-5' | 'story';
  palette?: Palette;
  textOverrides?: Record<string, string>;
  fontScale?: number;
  bgOverride?: string;
  safeZonePad?: boolean;
}

const LINE_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];
const fmtUA = (n: number) => new Intl.NumberFormat('uk-UA').format(Math.round(n));

/** Multi-campaign template: cumulative curves aligned by campaign day + per-jar totals. */
export const CampaignsChartCard = forwardRef<HTMLDivElement, CampaignsChartCardProps>(
  ({ items, format = 'story', palette = DEFAULT_PALETTE, textOverrides = {}, fontScale = 1, bgOverride, safeZonePad }, ref) => {
    const { t } = useTranslation('templates');
    const isStory = format === 'story';
    const p = palette;
    const fz = (n: number) => rem(n * fontScale);
    const tx = (key: string) => textOverrides[key] ?? t(`campaigns-chart.${key}`);

    const stats = useMemo(() => analyzeCampaigns(items), [items]);
    const maxDays = Math.max(...stats.campaigns.map((c) => c.days), 1);
    const maxTotal = Math.max(...stats.campaigns.map((c) => c.totalAmount), 1);

    const W = 920;
    const H = isStory ? 620 : 420;
    const px = (day: number) => (day / Math.max(maxDays - 1, 1)) * W;
    const py = (v: number) => H - (v / maxTotal) * H;

    return (
      <div
        ref={ref}
        style={{
          width: 1080,
          height: format === 'post-4-5' ? 1350 : isStory ? 1920 : 1080,
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

        <CardHeader palette={p} fz={fz} title={tx('title')} marginBottom={isStory ? 70 : 50} />

        {/* Aligned cumulative curves */}
        <div
          data-sticker="chart"
          style={{
            background: p.cardBg,
            border: `1px solid ${p.cardBorder}`,
            borderRadius: 24,
            padding: '40px 36px',
          }}
        >
          <svg viewBox={`-10 -10 ${W + 20} ${H + 20}`} style={{ width: '100%', display: 'block' }}>
            {[0.25, 0.5, 0.75].map((f) => (
              <line key={f} x1={0} x2={W} y1={py(maxTotal * f)} y2={py(maxTotal * f)} stroke={p.progressTrack} strokeWidth={2} />
            ))}
            {stats.campaigns.map((c, i) => (
              <polyline
                key={c.meta.id}
                fill="none"
                stroke={LINE_COLORS[i % LINE_COLORS.length]}
                strokeWidth={7}
                strokeLinejoin="round"
                strokeLinecap="round"
                points={c.cumulativeByDay.map((v, day) => `${px(day)},${py(v)}`).join(' ')}
              />
            ))}
          </svg>
        </div>

        {/* Legend with totals */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: isStory ? 28 : 18 }}>
          {stats.campaigns.map((c, i) => (
            <div
              key={c.meta.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 24,
                background: p.cardBg,
                border: `1px solid ${p.cardBorder}`,
                borderRadius: 20,
                padding: '24px 32px',
              }}
            >
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: LINE_COLORS[i % LINE_COLORS.length], flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: fz(30), fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.meta.name}
              </div>
              <div style={{ fontSize: fz(30), fontWeight: 800 }}>
                <NoWrap>{fmtUA(c.totalAmount)} ₴</NoWrap>
              </div>
            </div>
          ))}
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
