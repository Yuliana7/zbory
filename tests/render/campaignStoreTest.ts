import {
  saveCampaign,
  listCampaigns,
  getCampaignMeta,
  loadCampaignData,
  deleteCampaign,
  computeCampaignSummary,
} from '../../src/utils/campaignStore';
import type { RawDonation } from '../../src/types';

const assertEq = (label: string, actual: unknown, expected: unknown) => {
  const ok = actual === expected;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: got ${actual}${ok ? '' : `, expected ${expected}`}`);
  if (!ok) process.exitCode = 1;
};

// Newest-first, like a Monobank CSV; includes a withdrawal that must not count as a donation
const raw: RawDonation[] = [
  { date: '05.07.2026 15:00', category: 'Часткове зняття', amount: '200.00', currency: 'UAH', additionalInfo: 'На білу картку', comment: '', balance: '444.11', balanceCurrency: 'UAH' },
  { date: '03.07.2026 12:26', category: 'За посиланням', amount: '333.00', currency: 'UAH', additionalInfo: 'Від: Наталія Булейко', comment: 'Поповнення рахунку банки', balance: '644.11', balanceCurrency: 'UAH' },
  { date: '02.07.2026 10:52', category: 'За посиланням', amount: '200.00', currency: 'UAH', additionalInfo: 'Від: Любомира-Анна Климкович', comment: '', balance: '311.11', balanceCurrency: 'UAH' },
  { date: '01.07.2026 09:53', category: 'За посиланням', amount: '111.11', currency: 'UAH', additionalInfo: 'Від: Марта-Марія Плечій', comment: '❤️', balance: '111.11', balanceCurrency: 'UAH' },
];

(async () => {
  // ── summary math ──
  const summary = computeCampaignSummary(raw);
  assertEq('summary: total (donations only)', summary.totalAmount.toFixed(2), '644.11');
  assertEq('summary: count excludes withdrawal', summary.donationCount, 3);
  assertEq('summary: first date', summary.firstDate, '2026-07-01');
  assertEq('summary: last date', summary.lastDate, '2026-07-03');
  assertEq('summary: current balance from newest row', summary.currentBalance, 444.11);

  // ── create ──
  const created = await saveCampaign({ name: '  На дрони  ', rawData: raw, fileName: 'jar.csv', goal: 10000 });
  assertEq('create: name trimmed', created.name, 'На дрони');
  assertEq('create: createdAt = updatedAt', created.createdAt, created.updatedAt);

  await new Promise((r) => setTimeout(r, 5)); // distinct updatedAt so list order is deterministic
  const second = await saveCampaign({ name: 'Другий збір', rawData: raw.slice(1), fileName: null });
  assertEq('create: second campaign has its own id', second.id !== created.id, true);

  // ── list: most recently updated first ──
  let list = await listCampaigns();
  assertEq('list: two campaigns', list.length, 2);
  assertEq('list: newest first', list[0].id, second.id);

  // ── load: full rows round-trip ──
  const data = await loadCampaignData(created.id);
  assertEq('load: row count', data?.length, 4);
  assertEq('load: rows intact', data?.[3].additionalInfo, 'Від: Марта-Марія Плечій');
  assertEq('load: unknown id → null', await loadCampaignData('nope'), null);

  // ── update in place: keeps identity and createdAt, refreshes the rest ──
  await new Promise((r) => setTimeout(r, 5));
  const updated = await saveCampaign({ id: created.id, name: 'На дрони (оновлено)', rawData: raw.slice(0, 2), fileName: 'jar-v2.csv', goal: 20000 });
  assertEq('update: same id', updated.id, created.id);
  assertEq('update: createdAt preserved', updated.createdAt, created.createdAt);
  assertEq('update: updatedAt moved', updated.updatedAt > created.updatedAt, true);
  assertEq('update: summary recomputed', updated.summary.donationCount, 1);
  assertEq('update: goal replaced', (await getCampaignMeta(created.id))?.goal, 20000);
  list = await listCampaigns();
  assertEq('update: no duplicate in list', list.length, 2);
  assertEq('update: bumped to top of list', list[0].id, created.id);

  // ── delete removes meta and data ──
  await deleteCampaign(created.id);
  assertEq('delete: gone from list', (await listCampaigns()).length, 1);
  assertEq('delete: meta gone', await getCampaignMeta(created.id), null);
  assertEq('delete: data gone', await loadCampaignData(created.id), null);
})();
