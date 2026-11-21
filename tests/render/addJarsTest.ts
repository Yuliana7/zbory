import type { OwnJar, RawDonation } from '../../src/types';
import { jarChoices } from '../../src/utils/addJars';
import { renewProjects, renewableProjects } from '../../src/utils/renewProjects';
import { archiveCampaign, listCampaigns, loadCampaignData, saveCampaign, type CampaignMeta } from '../../src/utils/campaignStore';
import { createPacer, type MonoJar } from '../../src/utils/monobankApi';

let failures = 0;
const check = (label: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : ` ${extra}`}`);
  if (!ok) failures++;
};

// made-up ids only: the repo is public
const mono = (id: string, over: Partial<MonoJar> = {}): MonoJar => ({ id, sendId: `jar/${id}`, title: id, description: '', currencyCode: 980, balance: 100000, goal: 0, ...over });
const meta = (id: string, monoId?: string, archivedAt?: number) =>
  ({ id, name: id, fileName: null, createdAt: 0, updatedAt: 0, summary: { totalAmount: 0, donationCount: 0, firstDate: '', lastDate: '', currentBalance: 0 }, ...(monoId ? { monobankJar: { id: monoId, title: id } } : null), ...(archivedAt ? { archivedAt } : null) }) as CampaignMeta;
const own = (id: string, over: Partial<OwnJar> = {}): OwnJar => ({ id, name: id, raised: 0, jarId: '', addedAt: 0, ...over });

(async () => {
  // ── the picker ──
  const jars = [
    mono('Fr1', { sendId: '', title: 'ЗБІР НА ТРАНСПОРТ', goal: 1000000 }),
    mono('Main1'),
    mono('Main2'),
    mono('Fr2', { sendId: '' }),
    mono('Usd', { currencyCode: 840 }),
    mono('Fr3', { sendId: '' }),
  ];
  const choices = jarChoices(
    jars,
    [meta('p1', 'Main1'), meta('p2', 'Main2', 5)],
    [own('o1', { monoId: 'Fr2' }), own('byLink', { name: 'Збір на транспорт', target: 10000, jarId: 'Long1' }), own('arch', { monoId: 'Fr3', archivedAt: 9 })],
  );
  const by = (id: string) => choices.find((c) => c.jar.id === id)!;
  check('picker: main jars first, then friendly', choices.slice(0, 3).every((c) => c.kind === 'main') && choices.slice(3).every((c) => c.kind === 'friendly'));
  check('picker: an empty send id is friendly', by('Fr1').kind === 'friendly' && by('Main1').kind === 'main');
  check('picker: already a project (active or archived) is marked', by('Main1').added === 'active' && by('Main2').added === 'archive');
  check('picker: already a friendly jar (by its client-info id) is marked, in the archive too', by('Fr2').added === 'active' && by('Fr3').added === 'archive');
  check('picker: a jar tracked by link with the same name and goal is offered to merge', by('Fr1').match?.id === 'byLink' && by('Fr2').match === null);
  check('picker: hryvnia jars only', !by('Usd').usable && by('Main1').usable);
  check('picker: nothing in common → new', by('Fr1').added === null);

  // ── «Оновити все» for main jars ──
  const row = (date: string, amount: string, balance: string): RawDonation => ({ date, category: 'За посиланням', amount, currency: 'UAH', additionalInfo: 'Від: Тест', comment: '', balance, balanceCurrency: 'UAH' });
  const a = await saveCampaign({ name: 'Основна А', rawData: [row('01.11.2026 10:00', '100.00', '100.00')], fileName: null, goal: 5000, monobankJar: { id: 'JarA', title: 'А' }, friends: [{ id: 'f', name: 'Оля', raised: 10 }] });
  const b = await saveCampaign({ name: 'Основна Б', rawData: [row('02.11.2026 10:00', '50.00', '50.00')], fileName: null, monobankJar: { id: 'JarB', title: 'Б' } });
  const c = await saveCampaign({ name: 'Без Monobank', rawData: [row('03.11.2026 10:00', '20.00', '20.00')], fileName: null });
  const d = await saveCampaign({ name: 'Закрита', rawData: [row('04.11.2026 10:00', '20.00', '20.00')], fileName: null, monobankJar: { id: 'JarD', title: 'Д' } });
  await archiveCampaign(d.id);
  const all = await listCampaigns();
  check('renew all: active projects linked to a jar only', renewableProjects(all).map((m) => m.name).sort().join() === 'Основна А,Основна Б');

  // a fake Monobank: JarA gets one new donation, JarB nothing new
  const calls: string[] = [];
  let clock = Date.UTC(2026, 10, 20, 12);
  const at = (s: string) => Math.floor(new Date(s).getTime() / 1000);
  const statements: Record<string, unknown[]> = {
    JarA: [
      { id: 'n1', time: at('2026-11-05T09:00:00Z'), description: 'Від: Нова', amount: 30000, balance: 40000 },
      { id: 'o1', time: at('2026-11-01T08:00:00Z'), description: 'Від: Тест', amount: 10000, balance: 10000 },
    ],
    JarB: [],
  };
  const deps = {
    fetch: (async (url: string) => {
      const jar = decodeURIComponent(String(url).split('/personal/statement/')[1].split('/')[0]);
      calls.push(jar);
      return new Response(JSON.stringify(statements[jar] ?? []), { status: 200 });
    }) as unknown as typeof fetch,
    sleep: async (ms: number) => {
      clock += ms;
    },
    now: () => clock,
    pacer: createPacer(),
  };
  const progress: string[] = [];
  const started = clock;
  const res = await renewProjects(all, 'tok', { deps, now: () => clock, onProgress: (p) => progress.push(`${p.index + 1}/${p.total}`) });
  check('renew all: one statement per linked active project, none for the archived or unlinked', calls.sort().join() === 'JarA,JarB', calls.join());
  check('renew all: new donations merged in and reported', res.updated.length === 1 && res.updated[0].name === 'Основна А' && res.updated[0].added === 1 && res.unchanged.join() === 'Основна Б');
  const after = await loadCampaignData(a.id);
  const metaA = (await listCampaigns()).find((m) => m.id === a.id)!;
  check('renew all: the rows grow; goal, friends and link stay; the read is stamped', after!.rawData.length === 2 && metaA.goal === 5000 && after!.friends.length === 1 && after!.monobankJar?.id === 'JarA' && (metaA.monobankSyncedAt ?? 0) >= started && (metaA.monobankSyncedAt ?? 0) <= clock, JSON.stringify({ rows: after!.rawData.length, goal: metaA.goal, friends: after!.friends.length, jar: after!.monobankJar?.id, synced: metaA.monobankSyncedAt, clock }));
  check('renew all: progress counts the projects', progress.includes('1/2') && progress.includes('2/2'));
  check('renew all: the unlinked project is untouched', (await loadCampaignData(c.id))!.rawData.length === 1);
  void b;

  // a refused token stops the run
  const refusing = { ...deps, fetch: (async () => new Response('{}', { status: 403 })) as unknown as typeof fetch, pacer: createPacer() };
  const refused = await renewProjects(await listCampaigns(), 'bad', { deps: refusing, now: () => clock });
  check('renew all: a refused token stops it and says so', refused.tokenRefused && refused.updated.length === 0 && refused.failed.length === 0);

  // «Повернути в активні»: an unarchived project is renewed again
  const { unarchiveCampaign } = await import('../../src/utils/campaignStore');
  await unarchiveCampaign(d.id);
  check('renew all: a project back from the archive is renewed again', renewableProjects(await listCampaigns()).some((m) => m.id === d.id));

  console.log(failures === 0 ? '\nAll add-jar checks passed.' : `\n${failures} check(s) FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
})();
