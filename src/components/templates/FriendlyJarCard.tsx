import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { OwnJar } from '../../types';
import { DEFAULT_PALETTE, type Palette } from '../../utils/palettes';
import { rem } from '../../utils/units';
import { goalPct, ownJarLink } from '../../utils/ownJars';
import { CardHeader, CardShell, GlowBlob, NoWrap, UAFlagBar } from './shared';

interface FriendlyJarCardProps {
  jar: OwnJar;
  /** the card's goal: the jar's own unless changed in the editor */
  goal?: number;
  format?: 'post' | 'post-4-5' | 'story';
  palette?: Palette;
  textOverrides?: Record<string, string>;
  fontScale?: number;
  bgOverride?: string;
  safeZonePad?: boolean;
  hidden?: Set<string>;
}

const fmt = (n: number) => new Intl.NumberFormat('uk-UA').format(Math.round(n));

/** A friendly jar's own card: what it raised towards its goal, the fundraiser it is part of, and the
 * link to give. Everything comes from the jar's public numbers; there are no donations behind it. */
export const FriendlyJarCard = forwardRef<HTMLDivElement, FriendlyJarCardProps>(
  ({ jar, goal, format = 'story', palette = DEFAULT_PALETTE, textOverrides = {}, fontScale = 1, bgOverride, safeZonePad, hidden = new Set() }, ref) => {
    const { t } = useTranslation('templates');
    const p = palette;
    const fz = (n: number) => rem(n * fontScale);
    const tx = (key: string, fallback?: string) => textOverrides[key] ?? fallback ?? t(`friendly-jar.${key}`);
    const isStory = format === 'story';

    const pct = goalPct(jar.raised, goal);
    const left = goal ? Math.max(0, goal - jar.raised) : 0;
    const main = jar.main?.title ? jar.main : null;
    const mainPct = main ? goalPct(main.raised ?? 0, main.goal) : null;
    const link = (textOverrides.linkUrl ?? (jar.shortId ? ownJarLink(jar.shortId) : '')).trim();

    return (
      <CardShell ref={ref} format={format} palette={p} bgOverride={bgOverride} safeZonePad={safeZonePad}>
        {!hidden.has('glow') && (
          <div data-element="glow">
            <GlowBlob palette={p} style={{ top: -220, right: -220, width: 720, height: 720 }} />
            <GlowBlob palette={p} style={{ bottom: -160, left: -160, width: 520, height: 520 }} />
          </div>
        )}

        {!hidden.has('header') && <CardHeader palette={p} fz={fz} title={tx('title', jar.name || undefined)} />}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: isStory ? 64 : 40 }}>
          {!hidden.has('hero') && (
            <div data-element="hero">
              <div style={{ color: p.secondary, fontSize: fz(28), marginBottom: 12 }}>{tx('collectedLabel')}</div>
              <div
                style={{
                  fontSize: fz(isStory ? 128 : 104),
                  fontWeight: 800,
                  letterSpacing: '-3px',
                  lineHeight: 1,
                  background: `${p.accentGradient} text`,
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {fmt(jar.raised)} ₴
              </div>
            </div>
          )}

          {!hidden.has('progressBar') && pct !== null && (
            <div data-element="progressBar">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 14, fontSize: fz(24), color: p.secondary }}>
                <span>
                  {tx('goalLabel')}: <NoWrap style={{ color: p.primary, fontWeight: 700 }}>{fmt(goal!)} ₴</NoWrap>
                </span>
                <span style={{ fontWeight: 700, color: p.accent }}>{pct}%</span>
              </div>
              <div style={{ height: 20, background: p.progressTrack, borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: p.accentGradient, borderRadius: 10 }} />
              </div>
              <div style={{ marginTop: 14, fontSize: fz(26), color: p.secondary }}>
                {left > 0 ? (
                  <>
                    {tx('leftLabel')} <NoWrap style={{ color: p.primary, fontWeight: 800 }}>{fmt(left)} ₴</NoWrap>
                  </>
                ) : (
                  <span style={{ color: p.primary, fontWeight: 700 }}>{tx('reachedLabel')}</span>
                )}
              </div>
            </div>
          )}

          {!hidden.has('mainJar') && main && (
            <div
              data-element="mainJar"
              style={{ background: p.cardBg, border: `1px solid ${p.cardBorder}`, borderRadius: 28, padding: isStory ? '40px 44px' : '30px 36px' }}
            >
              <div style={{ fontSize: fz(22), color: p.secondary, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 12 }}>{tx('mainLabel')}</div>
              <div style={{ fontSize: fz(36), fontWeight: 800, color: p.primary, lineHeight: 1.2 }}>{main.title}</div>
              {main.ownerName && <div style={{ marginTop: 6, fontSize: fz(24), color: p.secondary }}>{main.ownerName}</div>}
              {main.raised !== undefined && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: fz(24), color: p.secondary, marginBottom: mainPct !== null ? 10 : 0 }}>
                    {tx('mainRaisedLabel')} <NoWrap style={{ color: p.primary, fontWeight: 700 }}>{fmt(main.raised)} ₴</NoWrap>
                    {main.goal ? (
                      <>
                        {' '}
                        {tx('ofLabel')} <NoWrap>{fmt(main.goal)} ₴</NoWrap>
                      </>
                    ) : null}
                  </div>
                  {mainPct !== null && (
                    <div style={{ height: 12, background: p.progressTrack, borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, mainPct)}%`, background: p.accentGradient, borderRadius: 6 }} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!hidden.has('linkBox') && link && (
            <div data-element="linkBox" style={{ textAlign: 'center', fontSize: fz(30), fontWeight: 700, color: p.primary, overflowWrap: 'anywhere' }}>
              🔗 {link}
            </div>
          )}
        </div>

        <UAFlagBar show={!hidden.has('uaflag')} />
      </CardShell>
    );
  },
);
