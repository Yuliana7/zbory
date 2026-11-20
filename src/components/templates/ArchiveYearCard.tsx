import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Aggregates, YearRecap } from '../../types';
import { DEFAULT_PALETTE, type Palette } from '../../utils/palettes';
import { rem } from '../../utils/units';
import { CardHeader, CardShell, GlowBlob, NoWrap, UAFlagBar } from './shared';

interface ArchiveYearCardProps {
  recap: YearRecap;
  /** the year's statements together: for the donors across all of them */
  aggregates?: Aggregates;
  format?: 'post' | 'post-4-5' | 'story';
  palette?: Palette;
  textOverrides?: Record<string, string>;
  fontScale?: number;
  bgOverride?: string;
  safeZonePad?: boolean;
  hidden?: Set<string>;
}

const fmt = (n: number) => new Intl.NumberFormat('uk-UA').format(Math.round(n));
// standalone month names, as Intl gives them for a month alone
const monthName = (i: number, style: 'long' | 'narrow') => new Date(2026, i, 15).toLocaleDateString('uk-UA', { month: style });

/** «Мій 2026»: a volunteer's year — what the projects closed that year raised together, how many there
 * were, how many people gave, the year month by month, the biggest project and the goals reached. */
export const ArchiveYearCard = forwardRef<HTMLDivElement, ArchiveYearCardProps>(
  ({ recap, aggregates, format = 'story', palette = DEFAULT_PALETTE, textOverrides = {}, fontScale = 1, bgOverride, safeZonePad, hidden = new Set() }, ref) => {
    const { t } = useTranslation('templates');
    const tx = (key: string) => textOverrides[key] ?? t(`archive-year.${key}`, { year: recap.year });
    const p = palette;
    const fz = (n: number) => rem(n * fontScale);
    const isStory = format === 'story';
    const isPost = format === 'post';
    const maxMonth = Math.max(1, ...recap.byMonth);
    const busiest = recap.byMonth.some((v) => v > 0) ? recap.byMonth.indexOf(Math.max(...recap.byMonth)) : null;

    const stats = [
      ...(recap.count > 0 ? [{ n: recap.count, label: tx('projectsLabel') }] : []),
      { n: recap.donations, label: tx('donationsLabel') },
      ...(aggregates && aggregates.uniqueDonors > 0 ? [{ n: aggregates.uniqueDonors, label: tx('donorsLabel') }] : []),
      ...(recap.friendJars > 0 ? [{ n: recap.friendJars, label: tx('friendsLabel') }] : []),
    ];

    return (
      <CardShell ref={ref} format={format} palette={p} bgOverride={bgOverride} safeZonePad={safeZonePad}>
        {!hidden.has('glow') && (
          <div data-element="glow">
            <GlowBlob palette={p} fade={65} style={{ top: -260, right: -260, width: 900, height: 900 }} />
          </div>
        )}

        {!hidden.has('header') && <CardHeader palette={p} fz={fz} title={tx('title')} />}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: isStory ? 64 : isPost ? 30 : 44 }}>
          {!hidden.has('hero') && (
            <div data-element="hero">
              <div
                style={{
                  fontSize: fz(isStory ? 136 : 104),
                  fontWeight: 900,
                  lineHeight: 1,
                  letterSpacing: '-4px',
                  background: `${p.accentGradient} text`,
                  WebkitTextFillColor: 'transparent',
                }}
              >
                <NoWrap>{fmt(recap.total)} ₴</NoWrap>
              </div>
              <div style={{ fontSize: fz(32), fontWeight: 600, color: p.secondary, marginTop: 14 }}>{tx('totalLabel')}</div>
            </div>
          )}

          {!hidden.has('stats') && (
            <div data-element="stats" style={{ display: 'flex', gap: 16 }}>
              {stats.map((s) => (
                <div
                  key={s.label}
                  style={{ flex: 1, background: p.cardBg, border: `1px solid ${p.cardBorder}`, borderRadius: 20, padding: isPost ? '20px 14px' : '28px 16px', textAlign: 'center' }}
                >
                  <div style={{ fontSize: fz(isStory ? 48 : 40), fontWeight: 800, color: p.primary }}>{fmt(s.n)}</div>
                  <div style={{ fontSize: fz(20), color: p.secondary, marginTop: 6 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {!hidden.has('months') && (
            <div data-element="months">
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: isStory ? 220 : isPost ? 110 : 160 }}>
                {recap.byMonth.map((v, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      borderRadius: 8,
                      height: v ? `${Math.max(6, (v / maxMonth) * 100)}%` : 6,
                      background: i === busiest ? p.accent : v ? p.chartLine : p.progressTrack,
                      opacity: i === busiest || !v ? 1 : 0.55,
                    }}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                {recap.byMonth.map((_, i) => (
                  <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: fz(20), color: i === busiest ? p.primary : p.secondary, fontWeight: i === busiest ? 700 : 400 }}>
                    {monthName(i, 'narrow')}
                  </div>
                ))}
              </div>
              {busiest !== null && (
                <div style={{ fontSize: fz(24), color: p.secondary, marginTop: 16 }}>
                  {tx('busiestLabel')} <span style={{ color: p.primary, fontWeight: 700 }}>{monthName(busiest, 'long')}</span>
                </div>
              )}
            </div>
          )}

          {!hidden.has('highlights') && (recap.biggest || recap.goals.set > 0) && (
            <div data-element="highlights" style={{ background: p.cardBg, border: `1px solid ${p.cardBorder}`, borderRadius: 24, padding: isPost ? '20px 28px' : '28px 32px' }}>
              {recap.biggest && (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 20 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: fz(20), color: p.secondary }}>{tx('biggestLabel')}</div>
                    <div style={{ fontSize: fz(30), fontWeight: 700, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recap.biggest.name}</div>
                  </div>
                  <div style={{ fontSize: fz(32), fontWeight: 800 }}>
                    <NoWrap>{fmt(recap.biggest.total)} ₴</NoWrap>
                  </div>
                </div>
              )}
              {recap.goals.set > 0 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    fontSize: fz(26),
                    marginTop: recap.biggest ? 18 : 0,
                    paddingTop: recap.biggest ? 18 : 0,
                    borderTop: recap.biggest ? `1px solid ${p.cardBorder}` : undefined,
                  }}
                >
                  <span style={{ color: p.secondary }}>{tx('goalsLabel')}</span>
                  <span style={{ fontWeight: 800, color: recap.goals.reached === recap.goals.set ? '#4ade80' : p.primary }}>
                    <NoWrap>
                      {recap.goals.reached} / {recap.goals.set}
                    </NoWrap>
                  </span>
                </div>
              )}
            </div>
          )}

          {!hidden.has('thanks') && !isPost && (
            <div data-element="thanks" style={{ fontSize: fz(30), lineHeight: 1.45, color: p.primary, textAlign: 'center', whiteSpace: 'pre-wrap' }}>
              {tx('thanks')}
            </div>
          )}
        </div>

        <UAFlagBar show={!hidden.has('uaflag')} />
      </CardShell>
    );
  },
);
