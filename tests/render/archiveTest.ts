import { saveCampaign, getCampaignMeta, archiveCampaign, unarchiveCampaign, buildProjectBackup, parseBackup, listCampaigns } from '../../src/utils/campaignStore';
import { archiveYear, archiveYears, inYear, matchesName, yearSummary, yearRecap, ownJarsFeeding, isArchived } from '../../src/utils/archive';
import { ownJarStamp, setOwnJarArchived } from '../../src/utils/ownJars';
import type { OwnJar, RawDonation } from '../../src/types';

let failures = 0;
const check = (label: string, ok: boolean) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failures++;
};

const raw: RawDonation[] = [
  { date: '03.07.2026 12:26', category: 'За посиланням', amount: '300.00', currency: 'UAH', additionalInfo: 'Від: Тест А', comment: '', balance: '500.00', balanceCurrency: 'UAH' },
  { date: '01.07.2026 09:53', category: 'За посиланням', amount: '200.00', currency: 'UAH', additionalInfo: 'Від: Тест Б', comment: '', balance: '200.00', balanceCurrency: 'UAH' },
];
const at = (y: number, m: number, d = 10) => new Date(y, m - 1, d, 12).getTime();

(async () => {
  // ── store ──
  const p = await saveCampaign({ name: 'На дрони', rawData: raw, fileName: null, goal: 400, friends: [{ id: 'f1', name: 'Оля', raised: 100 }, { id: 'f2', name: 'Назар', raised: 50 }] });
  check('store: a new project is active', !isArchived(p));
  const archived = await archiveCampaign(p.id, at(2026, 10, 14));
  check('store: archiving stamps the time and counts the helpers', archived?.archivedAt === at(2026, 10, 14) && archived.archive?.friendsCount === 2);
  check('store: archiving moves updatedAt (so a backup prefers it)', (archived?.updatedAt ?? 0) === at(2026, 10, 14));
  await saveCampaign({ id: p.id, name: 'На дрони', rawData: raw, fileName: null, goal: 400 });
  const afterSave = await getCampaignMeta(p.id);
  check('store: a later save (the cards’ style) keeps it archived', afterSave?.archivedAt === at(2026, 10, 14) && afterSave.archive?.friendsCount === 2);

  const backup = await buildProjectBackup(p.id, at(2026, 11, 1));
  const parsed = backup && parseBackup(JSON.stringify(backup));
  check('store: one project’s backup is a valid backup file', !!parsed && parsed.projects.length === 1 && parsed.projects[0].meta.archivedAt === at(2026, 10, 14));

  const back = await unarchiveCampaign(p.id, at(2026, 11, 2));
  check('store: «Повернути в активні» clears the archive fields', !!back && !back.archivedAt && !back.archive && back.updatedAt === at(2026, 11, 2));
  check('store: the list still has it', (await listCampaigns()).some((c) => c.id === p.id));

  // ── years, search, summary ──
  const meta = (id: string, name: string, archivedAt: number | undefined, total: number, friendsCount = 0) =>
    ({ id, name, fileName: null, createdAt: 0, updatedAt: 0, archivedAt, archive: archivedAt ? { friendsCount } : undefined, summary: { totalAmount: total, donationCount: total / 100, firstDate: '', lastDate: '', currentBalance: 0 } });
  const list = [
    meta('a', 'На авто для евакуації', at(2026, 10), 300000, 12),
    meta('b', 'На FPV-дрони', at(2026, 8), 150000, 6),
    meta('c', 'На генератор', at(2025, 5), 60000, 3),
    meta('d', 'Активний збір', undefined, 1000),
    meta('e', 'Перетин року', new Date(2026, 0, 1, 0, 30).getTime(), 1000),
  ];
  check('years: the year it was closed, on the local clock', archiveYear(list[4]) === 2026);
  check('years: every year with something closed, newest first', archiveYears(list).join() === '2026,2025');
  check('years: a year lists only its closed projects, newest first', inYear(list, 2026).map((c) => c.id).join() === 'a,b,e');
  check('years: «Усі роки» has every closed one and no active one', inYear(list, null).length === 4 && !inYear(list, null).some((c) => c.id === 'd'));
  check('search: any part, any case', matchesName('На FPV-дрони', 'fpv') && matchesName('На авто для евакуації', '  АВТО  для ') && !matchesName('На генератор', 'дрон'));
  check('search: an empty query matches everything', matchesName('Будь-що', '   '));
  const s = yearSummary(inYear(list, 2026));
  check('summary: total, count, donations and helpers of the year', s.total === 451000 && s.count === 3 && s.donations === 4510 && s.friends === 18);
  const fedProject = { ...meta('f', 'З банкою', at(2026, 10), 1000, 2), monobankJar: { id: 'L', title: 'З банкою', shortId: 'Main1' } };
  const own = (id: string, main?: string): OwnJar => ({ id, name: id, raised: 500, jarId: 'X'.repeat(16), addedAt: 0, archivedAt: at(2026, 10), ...(main ? { main: { shortId: main } } : {}) });
  const withOwn = yearSummary([fedProject], [own('mine', 'Main1'), own('elsewhere', 'Other'), own('unlinked')]);
  check('summary: own jars count as friendly jars, unless they feed a project already counted', withOwn.friends === 4 && withOwn.total === 1000);
  const recap = yearRecap(2026, [{ ...list[0], goal: 250000 }, { ...list[1], goal: 200000 }, list[4]]);
  check('recap: the year, its biggest project, and goals reached of goals set', recap.year === 2026 && recap.biggest?.name === 'На авто для евакуації' && recap.goals.set === 2 && recap.goals.reached === 1 && recap.total === 451000);
  check('recap: an empty year has no biggest project', yearRecap(2024, []).biggest === null && yearRecap(2024, []).count === 0);
  check('summary: totals by the month they were closed', s.byMonth[9] === 300000 && s.byMonth[7] === 150000 && s.byMonth[0] === 1000);

  // ── own jars ──
  const jar: OwnJar = { id: 'j', name: 'Моя банка', raised: 100, jarId: 'X'.repeat(16), addedAt: at(2026, 6), main: { shortId: 'Main1' } };
  check('own: jars that feed a project are found by its short id', ownJarsFeeding([jar, { ...jar, id: 'k', main: { shortId: 'Other' } }], 'Main1').map((j) => j.id).join() === 'j');
  check('own: no short id, nothing feeds it', ownJarsFeeding([jar], undefined).length === 0);
  const archivedJar = await setOwnJarArchived(jar, at(2026, 7));
  check('own: archiving a jar stamps it, and a backup sees it as newer', archivedJar.archivedAt === at(2026, 7) && ownJarStamp(archivedJar) > ownJarStamp(jar));
  check('own: an archived jar is no longer offered with its project', ownJarsFeeding([archivedJar], 'Main1').length === 0);
  const activeAgain = await setOwnJarArchived(archivedJar, null, at(2026, 8));
  check('own: back to active drops the stamp and counts as a change', !activeAgain.archivedAt && activeAgain.updatedAt === at(2026, 8));

  console.log(failures === 0 ? '\nAll archive checks passed.' : `\n${failures} check(s) FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
})();
