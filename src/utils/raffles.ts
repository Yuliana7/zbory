import type { Donation, FriendJar, Raffle, RaffleKind, TemplateType } from '../types';
import { dayKey } from './dailyBreakdown';
import { isAnonymousDonor, normalizeDonorKey } from './dataAggregator';
import { generateId } from './id';

export const RAFFLE_KINDS: RaffleKind[] = ['donors', 'jars', 'biggest'];

export const RAFFLE_TEMPLATES: Record<RaffleKind, TemplateType> = {
  donors: 'raffle-donors',
  jars: 'raffle-jars',
  biggest: 'raffle-biggest',
};

export const raffleKindOf = (id: TemplateType): RaffleKind | null =>
  RAFFLE_KINDS.find((kind) => RAFFLE_TEMPLATES[kind] === id) ?? null;

export const newRaffle = (kind: RaffleKind = 'donors'): Raffle => ({ id: generateId(), kind, prize: '' });

/** A raffle without a prize isn't one yet; it stays out of the project and the cards. */
export const cleanRaffles = (raffles: Raffle[]): Raffle[] =>
  raffles.map((r) => ({ ...r, prize: r.prize.trim() })).filter((r) => r.prize !== '');

/** The period counted, on the user's clock; an empty end is open. */
const inPeriod = (d: Donation, r: Raffle) => {
  const key = dayKey(d.timestamp);
  return (!r.from || key >= r.from) && (!r.to || key <= r.to);
};

/** What each person gave within the raffle's period: a named donor's donations add up, because they can
 * be told apart; every anonymous donation stands alone, since there is no telling who is behind it.
 * In kopecks, so that sums of decimal amounts compare exactly. */
function contributions(donations: Donation[], raffle: Raffle): number[] {
  const named = new Map<string, number>();
  const anonymous: number[] = [];
  for (const d of donations) {
    if (!inPeriod(d, raffle)) continue;
    const kopecks = Math.round(d.amount * 100);
    if (isAnonymousDonor(d.donor)) anonymous.push(kopecks);
    else {
      const key = normalizeDonorKey(d.donor!);
      named.set(key, (named.get(key) ?? 0) + kopecks);
    }
  }
  return [...named.values(), ...anonymous];
}

/** Who qualifies: everyone whose contribution in the period reaches the minimum. */
export function raffleParticipants(donations: Donation[], raffle: Raffle): number {
  const min = Math.round((raffle.min ?? 0) * 100);
  return contributions(donations, raffle).filter((amount) => amount >= min).length;
}

export interface BiggestDonation {
  amount: number;
  /** how many people gave exactly that much */
  people: number;
}

/** The largest contribution of the period and how many people match it. Null if nobody donated. */
export function biggestDonation(donations: Donation[], raffle: Raffle): BiggestDonation | null {
  const all = contributions(donations, raffle);
  if (all.length === 0) return null;
  const top = Math.max(...all);
  return { amount: top / 100, people: all.filter((amount) => amount === top).length };
}

/** The helper jars in the running, biggest first: all that raised anything, or those that reached the minimum. */
export function eligibleJars(friends: FriendJar[] | undefined, raffle: Raffle): FriendJar[] {
  return (friends ?? []).filter((f) => f.raised > 0 && f.raised >= (raffle.min ?? 0)).sort((a, b) => b.raised - a.raised);
}

/** The raffle a card shows: the one picked for it, else the first of its kind. */
export function raffleForCard(raffles: Raffle[] | undefined, kind: RaffleKind, id: string | undefined): Raffle | undefined {
  const ofKind = (raffles ?? []).filter((r) => r.kind === kind);
  return ofKind.find((r) => r.id === id) ?? ofKind[0];
}

export const hasRaffle = (raffles: Raffle[] | undefined, kind: RaffleKind) => (raffles ?? []).some((r) => r.kind === kind);

/** "5.11" or "5–7.11" or "28.10–2.11" for a period; null for the whole fundraiser. */
export function periodText(raffle: Raffle): string | null {
  const short = (key: string) => {
    const [, m, d] = key.split('-').map(Number);
    return `${d}.${String(m).padStart(2, '0')}`;
  };
  if (!raffle.from && !raffle.to) return null;
  if (raffle.from && raffle.to) return raffle.from === raffle.to ? short(raffle.from) : `${short(raffle.from)}–${short(raffle.to)}`;
  return short((raffle.from ?? raffle.to)!);
}
