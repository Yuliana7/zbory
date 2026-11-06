import { renderToStaticMarkup } from 'react-dom/server';
import '../../src/i18n';
import type { Donation, FriendJar, Raffle } from '../../src/types';
import { RaffleCard } from '../../src/components/templates/RaffleCard';
import { normalizeDonations } from '../../src/utils/csvParser';
import { aggregateDonations } from '../../src/utils/dataAggregator';
import { biggestDonation, cleanRaffles, eligibleJars, periodText, raffleForCard, raffleKindOf, raffleParticipants } from '../../src/utils/raffles';
import { loadRawDonations } from './testFixture';

let failures = 0;
const check = (label: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : ` ${extra}`}`);
  if (!ok) failures++;
};

const don = (day: number, amount: number, donor?: string): Donation => ({ timestamp: new Date(2026, 10, day, 12), amount, donor, category: 'x' });
const ivan = [don(1, 200, 'Іван Петренко'), don(2, 150, 'іван петренко'), don(3, 1000, 'Іван Петренко')];
const list = [...ivan, don(1, 500, 'Оля'), don(2, 100, 'Тарас'), don(3, 300), don(3, 300), don(4, 250, '🐈')];
const raffle = (over: Partial<Raffle> = {}): Raffle => ({ id: 'r', kind: 'donors', prize: 'iPhone', ...over });

// ── who takes part ──
check('Ivan with three donations is one person', raffleParticipants(ivan, raffle()) === 1);
check('every anonymous donation counts on its own', raffleParticipants([don(1, 300), don(1, 300), don(1, 300, '🐈')], raffle()) === 3);
check('threshold: named once + each anonymous', raffleParticipants(list, raffle({ min: 200 })) === 5, String(raffleParticipants(list, raffle({ min: 200 }))));
check('the threshold is inclusive', raffleParticipants([don(1, 200, 'А')], raffle({ min: 200 })) === 1);
check('a known donor\'s donations add up to the threshold', raffleParticipants([don(1, 150, 'А'), don(2, 150, 'а')], raffle({ min: 200 })) === 1);
check('anonymous donations do not add up', raffleParticipants([don(1, 150), don(2, 150, '🐈')], raffle({ min: 200 })) === 0);
check('only donations in the period add up', raffleParticipants([don(1, 150, 'А'), don(5, 150, 'А')], raffle({ min: 200, from: '2026-11-01', to: '2026-11-02' })) === 0);
check('kopecks add up exactly', raffleParticipants([don(1, 100.1, 'А'), don(2, 99.9, 'А')], raffle({ min: 200 })) === 1);
check('no minimum: everyone', raffleParticipants(list, raffle()) === 6);
check('a period counts only its days', raffleParticipants(list, raffle({ min: 200, from: '2026-11-03', to: '2026-11-04' })) === 4);
check('a single day', raffleParticipants(list, raffle({ from: '2026-11-02', to: '2026-11-02' })) === 2);
check('what is outside the period does not help', raffleParticipants(ivan, raffle({ min: 200, from: '2026-11-02', to: '2026-11-02' })) === 0);
check('a day ends at midnight on the user\'s clock', raffleParticipants([{ ...don(2, 500, 'А'), timestamp: new Date(2026, 10, 2, 23, 59) }], raffle({ from: '2026-11-02', to: '2026-11-02' })) === 1);

// ── biggest donation ──
check('biggest: a known donor\'s total, one leader', JSON.stringify(biggestDonation(list, raffle())) === JSON.stringify({ amount: 1350, people: 1 }));
check('biggest: ties are counted', biggestDonation([don(1, 500, 'А'), don(2, 500, 'Б'), don(3, 500)], raffle())?.people === 3);
check('biggest: one person twice adds up', JSON.stringify(biggestDonation([don(1, 500, 'А'), don(2, 500, 'а')], raffle())) === JSON.stringify({ amount: 1000, people: 1 }));
check('biggest: a total ties with a single donation', biggestDonation([don(1, 300, 'А'), don(2, 300, 'А'), don(3, 600, 'Б'), don(3, 600)], raffle())?.people === 3);
check('biggest: anonymous donations stay separate', biggestDonation([don(1, 300), don(2, 300)], raffle())?.amount === 300);
check('biggest: within the period', biggestDonation(list, raffle({ from: '2026-11-01', to: '2026-11-02' }))?.amount === 500);
check('biggest: nothing in the period', biggestDonation(list, raffle({ from: '2026-12-01', to: '2026-12-02' })) === null);

// ── jars ──
const jars: FriendJar[] = [{ id: 'a', name: 'А', raised: 1000 }, { id: 'b', name: 'Б', raised: 7000 }, { id: 'c', name: 'В', raised: 5000 }, { id: 'd', name: 'Г', raised: 0 }];
check('jars: threshold, biggest first, inclusive', eligibleJars(jars, raffle({ kind: 'jars', min: 5000 })).map((f) => f.id).join() === 'b,c');
check('jars: no threshold → every jar that raised something', eligibleJars(jars, raffle({ kind: 'jars' })).length === 3);
check('jars: the list passed in stays as it was', jars[0].id === 'a' && eligibleJars(undefined, raffle()).length === 0);

// ── housekeeping ──
check('no prize → not a raffle', cleanRaffles([raffle({ prize: '  ' }), raffle({ prize: ' Книга ' })]).map((r) => r.prize).join() === 'Книга');
const several = [raffle({ id: '1', prize: 'А' }), raffle({ id: '2', prize: 'Б' }), raffle({ id: '3', kind: 'jars', prize: 'В' })];
check('card: the picked raffle, else the first of its kind', raffleForCard(several, 'donors', '2')?.prize === 'Б' && raffleForCard(several, 'donors', 'gone')?.prize === 'А' && raffleForCard(several, 'biggest', undefined) === undefined);
check('template → kind', raffleKindOf('raffle-jars') === 'jars' && raffleKindOf('progress') === null);
check('period text', periodText(raffle()) === null && periodText(raffle({ from: '2026-11-05', to: '2026-11-05' })) === '5.11' && periodText(raffle({ from: '2026-10-28', to: '2026-11-02' })) === '28.10–2.11');

// ── cards ──
const { donations, withdrawals, currentBalance } = normalizeDonations(loadRawDonations('tests/data/Zbir_short.csv'));
const aggregates = aggregateDonations(donations, withdrawals, currentBalance);
const strip = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\u00A0/g, ' ');
let html = strip(renderToStaticMarkup(<RaffleCard aggregates={aggregates} kind="donors" raffle={raffle({ min: 200, from: '2026-11-01', to: '2026-11-03' })} donations={list} />));
check('card: prize, number, condition and period', html.includes('iPhone') && html.includes('Учасників') && html.includes('Донат від 200 ₴') && html.includes('1.11–3.11'));
html = strip(renderToStaticMarkup(<RaffleCard aggregates={aggregates} kind="jars" raffle={raffle({ kind: 'jars', prize: 'Книга', min: 5000 })} friends={jars} />));
check('card: jars with a threshold', html.includes('Книга') && />?\s*2\s/.test(html) && html.includes('Зібрано від 5 000 ₴'));
html = strip(renderToStaticMarkup(<RaffleCard aggregates={aggregates} kind="jars" raffle={raffle({ kind: 'jars', prize: 'Книга' })} friends={jars} />));
check('card: jars with no threshold says so', html.includes('Усі банки друзів'));
html = strip(renderToStaticMarkup(<RaffleCard aggregates={aggregates} kind="biggest" raffle={raffle({ kind: 'biggest' })} donations={[don(1, 500, 'Секретне Імʼя'), don(2, 500, 'Б')]} />));
check('card: biggest shows the tie and the random pick', /500\s*₴/.test(html) && html.includes('Рівних') && html.includes('випадково'));
check('card: no names on it', !html.includes('Секретне'));
html = strip(renderToStaticMarkup(<RaffleCard aggregates={aggregates} kind="biggest" raffle={raffle({ kind: 'biggest' })} donations={[don(1, 500, 'А')]} />));
check('card: one leader, no talk of random', !html.includes('випадково') && html.includes('лідер'));
html = strip(renderToStaticMarkup(<RaffleCard aggregates={aggregates} kind="donors" />));
check('card: a deleted raffle does not break it', html.includes('Розіграш ще не додано'));

console.log(failures === 0 ? '\nAll raffle checks passed.' : `\n${failures} check(s) FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
