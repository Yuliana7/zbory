import { useTranslation } from 'react-i18next';
import type { Donation, FriendJar, Raffle } from '../../types';
import { fmtUah } from '../../utils/friendJars';
import { biggestDonation, eligibleJars, raffleParticipants } from '../../utils/raffles';

/** Where a raffle stands right now, for the organiser; a jar raffle also lists the jars in the running. */
export function RaffleStatus({ raffle, donations, friends }: { raffle: Raffle; donations: Donation[]; friends?: FriendJar[] }) {
  const { t } = useTranslation('insights');
  if (raffle.kind === 'donors') {
    return <p className="text-sm text-gray-700">{t('raffles.participants', { count: raffleParticipants(donations, raffle) })}</p>;
  }
  if (raffle.kind === 'biggest') {
    const biggest = biggestDonation(donations, raffle);
    if (!biggest) return <p className="text-sm text-gray-500">{t('raffles.noDonations')}</p>;
    return (
      <p className="text-sm text-gray-700">
        {t('raffles.biggest', { amount: fmtUah(biggest.amount) })}
        {biggest.people > 1 && ` · ${t('raffles.tied', { count: biggest.people })}`}
      </p>
    );
  }
  const jars = eligibleJars(friends, raffle);
  return (
    <details className="text-sm text-gray-700">
      <summary className="cursor-pointer">{t('raffles.jars', { count: jars.length })}</summary>
      {jars.length > 0 && (
        <ul className="mt-2 divide-y divide-gray-100">
          {jars.map((f) => (
            <li key={f.id} className="py-1.5 flex items-center justify-between gap-3">
              <span className="min-w-0 truncate">{f.name || '—'}</span>
              <span className="shrink-0 tabular-nums text-gray-500">{fmtUah(f.raised)} ₴</span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
