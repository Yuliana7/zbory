import { forwardRef } from 'react';
import type { Aggregates, Donation, FriendJar, Raffle, RaffleKind } from '../../types';
import { biggestDonation, eligibleJars, periodText, raffleParticipants } from '../../utils/raffles';
import { DEFAULT_PALETTE, type Palette } from '../../utils/palettes';
import { rem } from '../../utils/units';
import { useTranslation } from 'react-i18next';
import { CardHeader, NoWrap, UAFlagBar, CardShell, GlowBlob } from './shared';

interface RaffleCardProps {
  kind: RaffleKind;
  raffle?: Raffle;
  /** every donation of the project: a raffle has its own period, whatever the card's dates are */
  donations?: Donation[];
  friends?: FriendJar[];
  aggregates: Aggregates;
  format?: 'post' | 'post-4-5' | 'story';
  palette?: Palette;
  textOverrides?: Record<string, string>;
  fontScale?: number;
  bgOverride?: string;
  safeZonePad?: boolean;
  hidden?: Set<string>;
}

/** Where a raffle stands: the prize, the headline number, and what it takes to be in. */
export const RaffleCard = forwardRef<HTMLDivElement, RaffleCardProps>(
  ({ kind, raffle, donations = [], friends, format = 'story', palette = DEFAULT_PALETTE, textOverrides = {}, fontScale = 1, bgOverride, safeZonePad, hidden = new Set() }, ref) => {
    const { t } = useTranslation('templates');
    const isStory = format === 'story';
    const p = palette;
    const fz = (n: number) => rem(n * fontScale);
    const ns = `raffle-${kind}`;
    const tx = (key: string) => textOverrides[key] ?? t(`${ns}.${key}`);
    const fmt = (n: number) => new Intl.NumberFormat('uk-UA').format(Math.round(n));

    const biggest = raffle && kind === 'biggest' ? biggestDonation(donations, raffle) : null;
    const hero = !raffle
      ? '—'
      : kind === 'donors'
        ? fmt(raffleParticipants(donations, raffle))
        : kind === 'jars'
          ? fmt(eligibleJars(friends, raffle).length)
          : biggest
            ? `${fmt(biggest.amount)} ₴`
            : '—';

    const period = raffle ? periodText(raffle) : null;
    const parts: string[] = [];
    if (raffle?.min && kind === 'donors') parts.push(t('raffle-common.fromDonation', { amount: fmt(raffle.min) }));
    if (raffle?.min && kind === 'jars') parts.push(t('raffle-common.fromRaised', { amount: fmt(raffle.min) }));
    if (raffle && !raffle.min && kind === 'jars') parts.push(t('raffle-common.allJars'));
    if (period && kind !== 'jars') parts.push(period);

    return (
      <CardShell ref={ref} format={format} palette={p} bgOverride={bgOverride} safeZonePad={safeZonePad}>
        {!hidden.has('glow') && (
          <div data-element="glow">
            <GlowBlob palette={p} style={{ top: -200, right: -200, width: 700, height: 700 }} />
            <GlowBlob palette={p} style={{ bottom: -150, left: -150, width: 500, height: 500 }} />
          </div>
        )}

        {!hidden.has('header') && <CardHeader palette={p} fz={fz} title={tx('title')} />}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: isStory ? 64 : 40 }}>
          {!hidden.has('prize') && (
            <div data-element="prize">
              <div style={{ fontSize: fz(30), fontWeight: 600, color: p.secondary, marginBottom: 12 }}>{tx('prizeLabel')}</div>
              <div style={{ fontSize: fz(isStory ? 76 : 60), fontWeight: 800, lineHeight: 1.1, letterSpacing: '-1px' }}>{raffle?.prize ?? t('raffle-common.noRaffle')}</div>
            </div>
          )}

          {!hidden.has('hero') && (
            <div data-element="hero">
              <div style={{ fontSize: fz(30), fontWeight: 600, color: p.secondary, marginBottom: 12 }}>{tx('heroLabel')}</div>
              <div
                style={{
                  fontSize: fz(isStory ? 190 : 140),
                  fontWeight: 900,
                  lineHeight: 1,
                  letterSpacing: '-4px',
                  background: `${p.accentGradient} text`,
                  WebkitTextFillColor: 'transparent',
                }}
              >
                <NoWrap>{hero}</NoWrap>
              </div>
            </div>
          )}

          {!hidden.has('competition') && biggest && (
            <div data-element="competition" style={{ fontSize: fz(34), fontWeight: 600, lineHeight: 1.3 }}>
              {biggest.people > 1 ? (
                <>
                  <div>{tx('tiedLabel')}: <span style={{ fontWeight: 800 }}>{fmt(biggest.people)}</span></div>
                  <div style={{ marginTop: 8, color: p.secondary, fontSize: fz(28) }}>{tx('randomLabel')}</div>
                </>
              ) : (
                <div style={{ color: p.secondary, fontSize: fz(28) }}>{tx('soloLabel')}</div>
              )}
            </div>
          )}
        </div>

        {!hidden.has('condition') && parts.length > 0 && (
          <div data-element="condition" style={{ paddingTop: 32, borderTop: `1px solid ${p.cardBorder}`, fontSize: fz(30), fontWeight: 600, color: p.secondary }}>
            {parts.join(' · ')}
          </div>
        )}
        <UAFlagBar show={!hidden.has('uaflag')} />
      </CardShell>
    );
  },
);
