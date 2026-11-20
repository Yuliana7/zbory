import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Aggregates, Donation } from '../../types';
import { loyalty, sizeBands } from '../../utils/archiveStats';
import { DEFAULT_PALETTE, type Palette } from '../../utils/palettes';
import { rem } from '../../utils/units';
import { CardHeader, CardShell, GlowBlob, NoWrap, UAFlagBar } from './shared';

interface ArchiveSupportersCardProps {
  aggregates: Aggregates;
  donations: Donation[];
  format?: 'post' | 'post-4-5' | 'story';
  palette?: Palette;
  textOverrides?: Record<string, string>;
  fontScale?: number;
  bgOverride?: string;
  safeZonePad?: boolean;
  hidden?: Set<string>;
}

const fmt = (n: number) => new Intl.NumberFormat('uk-UA').format(Math.round(n));

/** «Наші донатори»: how many people gave, how many came back, which donation sizes carried the money,
 * and (removable, for privacy) who gave most. */
export const ArchiveSupportersCard = forwardRef<HTMLDivElement, ArchiveSupportersCardProps>(
  ({ donations, format = 'story', palette = DEFAULT_PALETTE, textOverrides = {}, fontScale = 1, bgOverride, safeZonePad, hidden = new Set() }, ref) => {
    const { t } = useTranslation('templates');
    const tx = (key: string) => textOverrides[key] ?? t(`archive-supporters.${key}`);
    const p = palette;
    const fz = (n: number) => rem(n * fontScale);
    const isStory = format === 'story';
    const people = loyalty(donations);
    const bands = sizeBands(donations).filter((b) => b.count > 0);
    const top = people.top.slice(0, format === 'post' ? 3 : 5);
    const band = (key: string) => tx(`${key}Label`);

    return (
      <CardShell ref={ref} format={format} palette={p} bgOverride={bgOverride} safeZonePad={safeZonePad}>
        {!hidden.has('glow') && (
          <div data-element="glow">
            <GlowBlob palette={p} style={{ top: -200, right: -200, width: 700, height: 700 }} />
          </div>
        )}

        {!hidden.has('header') && <CardHeader palette={p} fz={fz} title={tx('title')} />}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: isStory ? 64 : 32 }}>
          {!hidden.has('hero') && (
            <div data-element="hero" style={{ display: 'flex', alignItems: 'flex-end', gap: 48 }}>
              <div>
                <div
                  style={{
                    fontSize: fz(isStory ? 150 : 110),
                    fontWeight: 900,
                    lineHeight: 0.9,
                    letterSpacing: '-5px',
                    background: `${p.accentGradient} text`,
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {fmt(people.named)}
                </div>
                <div style={{ fontSize: fz(30), fontWeight: 600, color: p.secondary, marginTop: 14 }}>{tx('donorsLabel')}</div>
              </div>
              {people.returning > 0 && (
                <div data-element="returning" style={{ paddingBottom: 4 }}>
                  <div style={{ fontSize: fz(isStory ? 72 : 56), fontWeight: 800, color: p.primary, lineHeight: 1 }}>{fmt(people.returning)}</div>
                  <div style={{ fontSize: fz(24), color: p.secondary, marginTop: 10, maxWidth: 380 }}>
                    {tx('returningLabel')} · <NoWrap style={{ color: p.accent, fontWeight: 700 }}>{Math.round(people.returningShare * 100)}%</NoWrap> {tx('shareLabel')}
                  </div>
                </div>
              )}
            </div>
          )}

          {!hidden.has('bands') && bands.length > 0 && (
            <div data-element="bands" style={{ background: p.cardBg, border: `1px solid ${p.cardBorder}`, borderRadius: 24, padding: isStory ? '36px 36px 20px' : '26px 32px 10px' }}>
              <div style={{ fontSize: fz(24), color: p.secondary, marginBottom: 22 }}>{tx('bandsLabel')}</div>
              {bands.map((b) => (
                <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
                  <div style={{ width: 210, fontSize: fz(24), color: p.primary, flexShrink: 0 }}>{band(b.key)}</div>
                  <div style={{ flex: 1, height: 18, background: p.progressTrack, borderRadius: 9, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${b.amountShare * 100}%`, background: p.chartLine, borderRadius: 9 }} />
                  </div>
                  <div style={{ width: 96, textAlign: 'right', fontSize: fz(28), fontWeight: 800, color: p.primary }}>{Math.round(b.amountShare * 100)}%</div>
                </div>
              ))}
            </div>
          )}

          {!hidden.has('top') && top.length > 0 && (
            <div data-element="top">
              <div style={{ fontSize: fz(24), color: p.secondary, marginBottom: 14 }}>{tx('topLabel')}</div>
              {top.map((d, i) => (
                <div
                  key={d.name}
                  style={{ display: 'flex', alignItems: 'baseline', gap: 20, padding: '12px 0', borderTop: i ? `1px solid ${p.cardBorder}` : undefined }}
                >
                  <div style={{ width: 36, fontSize: fz(24), color: p.secondary }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0, fontSize: fz(30), fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                  <div style={{ fontSize: fz(30), fontWeight: 800 }}>
                    <NoWrap>{fmt(d.amount)} ₴</NoWrap>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <UAFlagBar show={!hidden.has('uaflag')} />
      </CardShell>
    );
  },
);
