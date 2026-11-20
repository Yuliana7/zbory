import { buildReport } from '../../src/utils/campaignAnalytics';
import { renameCampaign, setArchivedGoalReached, saveCampaign, getCampaignMeta, archiveCampaign, unarchiveCampaign, buildProjectBackup, parseBackup, listCampaigns } from '../../src/utils/campaignStore';
import { archiveYear, archiveYears, goalsUnsaid, inYear, matchesName, yearSummary, yearRecap, ownJarsFeeding, isArchived } from '../../src/utils/archive';
import { listOwnJars, renameOwnJar, ownJarDataset, ownJarStamp, setOwnJarArchived, setOwnJarGoalReached, setOwnJarStatement } from '../../src/utils/ownJars';
import type { OwnJar, RawDonation } from '../../src/types';
import { draftFromStatement, importToArchive, knownSignatures, nameFromFile } from '../../src/utils/archiveImport';

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
  const q = await saveCampaign({ name: 'Без цілі', rawData: raw, fileName: null });
  check('store: closing with no goal keeps the user’s word on it', (await archiveCampaign(q.id, at(2026, 10, 14), { goalReached: true }))?.archive?.goalReached === true);
  check('store: not said, not stored', (await archiveCampaign(q.id, at(2026, 10, 14)))?.archive?.goalReached === undefined);
  check('store: said later, on the archive page', (await setArchivedGoalReached(q.id, false))?.archive?.goalReached === false && (await getCampaignMeta(q.id))?.archive?.friendsCount === 0);
  check('store: and taken back', (await setArchivedGoalReached(q.id, undefined))?.archive?.goalReached === undefined);
  const renamed = await renameCampaign(q.id, '  Генератор для лікарні  ', at(2026, 11));
  check('rename: a closed project keeps its record, takes the new name', renamed?.name === 'Генератор для лікарні' && renamed.archivedAt !== undefined && renamed.updatedAt === at(2026, 11));
  check('rename: a blank name changes nothing', (await renameCampaign(q.id, '   ')) === null && (await getCampaignMeta(q.id))?.name === 'Генератор для лікарні');
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
  check('summary: own jars count as friendly jars, unless they feed a project already counted', withOwn.friends === 4);
  check('summary: own jars’ money joins the year, except a jar feeding one of its projects', withOwn.total === 2000 && withOwn.byMonth[9] === 2000, `${withOwn.total}`);
  const withStatement = { ...own('stated', 'Other'), statement: raw, statementAddedAt: 1 };
  check('summary: an own jar’s statement brings its donations', yearSummary([], [withStatement]).donations === raw.length);
  const ownRecap = yearRecap(2026, [], [{ ...own('big'), raised: 9000, target: 5000 }, own('small')]);
  check('recap: own jars alone — the biggest, goals, no projects', ownRecap.count === 0 && ownRecap.total === 9500 && ownRecap.biggest?.name === 'big' && ownRecap.goals.reached === 1 && ownRecap.goals.set === 1);
  const recap = yearRecap(2026, [{ ...list[0], goal: 250000 }, { ...list[1], goal: 200000 }, list[4]]);
  check('recap: the year, its biggest project, and goals reached of goals set', recap.year === 2026 && recap.biggest?.name === 'На авто для евакуації' && recap.goals.set === 2 && recap.goals.reached === 1 && recap.total === 451000);

  const said = yearRecap(2026, [{ ...list[0], archive: { friendsCount: 0, goalReached: true } }, { ...list[1], archive: { friendsCount: 0, goalReached: false } }, list[4]], [{ ...own('mine-no-goal'), goalReached: true }, own('silent')]);
  check('recap: with no goal, the user’s word counts; no word, not counted', said.goals.set === 3 && said.goals.reached === 2, JSON.stringify(said.goals));
  check('recap: own jars with no statement are listed for the totals', said.unstated.map((u) => u.name).join() === 'mine-no-goal,silent' && said.unstated[0].amount === 500);
  check('recap: every jar of the year counted, own jars on their own too', said.jars === 5 && yearRecap(2026, [{ ...list[0], monobankJar: { id: 'L', title: '', shortId: 'M' } }], [{ ...own('fed'), main: { shortId: 'M' } }]).jars === 1);
  const withStatementRecap = yearRecap(2026, [], [{ ...own('stated'), statement: raw }]);
  check('recap: an own jar with a statement is not among them', withStatementRecap.unstated.length === 0);
  const unsaid = goalsUnsaid(
    [{ ...list[0] }, { ...list[1], goal: 100 }, { ...list[4], archive: { friendsCount: 0, goalReached: false } }],
    [own('no-word'), { ...own('has-goal'), target: 10 }, { ...own('said'), goalReached: true }],
  );
  check('unsaid: jars with no goal and no word, projects and own jars', unsaid.map((u) => `${u.kind}:${u.name}`).join() === 'project:На авто для евакуації,ownJar:no-word', unsaid.map((u) => u.name).join());
  const saidJar = await setOwnJarGoalReached(own('x'), true, at(2026, 11));
  check('unsaid: an own jar’s word is kept, and counts as a change', saidJar.goalReached === true && saidJar.updatedAt === at(2026, 11) && (await setOwnJarGoalReached(saidJar, undefined)).goalReached === undefined);
  const rj = await renameOwnJar(own('old'), ' Нова назва ', at(2026, 12));
  check('rename: an own jar, trimmed; blank keeps the old name', rj.name === 'Нова назва' && rj.updatedAt === at(2026, 12) && (await renameOwnJar(rj, '  ')).name === 'Нова назва');
  const items = [{ meta: list[0] as never, rawData: raw }];
  const plain = buildReport(items, { kind: 'year', year: 2026 });
  const plus = buildReport(items, { kind: 'year', year: 2026 }, [{ name: 'Без виписки', amount: 4000, closedAt: at(2026, 9) }, { name: 'Інший рік', amount: 999, closedAt: at(2025, 9) }]);
  check('report: jars known only by total join the jars and money of their period', plus.totalAmount === plain.totalAmount + 4000 && plus.campaignCount === plain.campaignCount + 1 && plus.donationCount === plain.donationCount && plus.topCampaigns[0].name === 'Без виписки');
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
  const stated = await setOwnJarStatement(archivedJar, raw, at(2026, 9));
  check('statement: kept with the jar, and a backup sees it as newer', stated.statement?.length === 2 && ownJarStamp(stated) > ownJarStamp(archivedJar) && stated.archivedAt === archivedJar.archivedAt);
  check('statement: the jar’s statement as a dataset for cards', ownJarDataset(stated)?.id === 'own:j' && ownJarDataset(stated)?.rawData === raw && ownJarDataset(archivedJar) === null);
  const unstated = await setOwnJarStatement(stated, null, at(2026, 10));
  check('statement: taken away, and that counts as a change', !unstated.statement && !unstated.statementAddedAt && unstated.updatedAt === at(2026, 10));

  // ── closed jars from statements ──
  check('import: a name to edit from the file name', nameFromFile('Jar_statement_31.08.2026_185648.csv') === 'Jar statement 31.08.2026 185648');
  const known = knownSignatures(await listCampaigns(), await listOwnJars());
  const again = draftFromStatement('dup.csv', raw, known);
  check('import: a statement the app already holds is marked and left out', again?.duplicate === true && again.skip === true);
  const other: RawDonation[] = raw.map((r) => ({ ...r, date: r.date.replace('07.2026', '03.2025') }));
  const fresh = draftFromStatement('Banka_dlia_Oli.csv', other, known)!;
  check('import: a new statement is taken, closed on its last donation', !fresh.duplicate && !fresh.skip && fresh.closedOn === '2025-03-03' && fresh.summary.donationCount === 2);
  check('import: a file without donations is no draft', draftFromStatement('x.csv', [], known) === null);
  const years = await importToArchive(
    [{ ...fresh, name: '  Банка для Олі  ', goal: '1 000', goalReached: false }, { ...fresh, key: 'p', name: 'Старий збір', closedOn: '2024-12-30', goalReached: true }, { ...again!, name: 'skipped' }],
    'ownJar',
    at(2026, 11),
  );
  const jars = (await listOwnJars()).filter((j) => j.name === 'Банка для Олі' || j.name === 'Старий збір');
  const olia = jars.find((j) => j.name === 'Банка для Олі');
  check('import: own jars filed under the closing year, skipped ones not added', years.join() === '2025,2024' && jars.length === 2 && !(await listOwnJars()).some((j) => j.name === 'skipped'));
  check('import: an imported jar is closed, unlinked, carries its statement, goal and amount', !!olia && olia.closed === true && olia.jarId === '' && olia.statement === other && olia.target === 1000 && olia.raised === 500 && archiveYear(olia) === 2025);
  check('import: with a goal its numbers decide; with none, the user’s word is kept', olia?.goalReached === undefined && jars.find((j) => j.name === 'Старий збір')?.goalReached === true);
  const projYears = await importToArchive([{ ...fresh, key: 'q', name: 'Минулий збір' }], 'project', at(2026, 11));
  const proj = (await listCampaigns()).find((c) => c.name === 'Минулий збір');
  check('import: as a main jar, it is an archived project', projYears.join() === '2025' && !!proj && isArchived(proj) && archiveYear(proj) === 2025);
  const knownNow = knownSignatures(await listCampaigns(), await listOwnJars());
  check('import: once in, the same statement is known', draftFromStatement('again.csv', other, knownNow)?.duplicate === true);

  console.log(failures === 0 ? '\nAll archive checks passed.' : `\n${failures} check(s) FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
})();
