#!/usr/bin/env node
// Retakes the screenshots used by the README and the user guide.
//
//   npx playwright install webkit      (once)
//   npm run docs:screenshots           (writes to docs/screenshots)
//   npm run docs:screenshots -- --out some/folder
//
// It starts its own dev server and drives the real app in WebKit at iPhone size. Everything shown is made
// up: the fundraisers come from tests/data, the helpers and raffles from seed() below, and Monobank is
// faked, so no token or network is needed. The repo is public: keep real names, jars and links out of here.
//
// Screens changed? Update the steps at the bottom, then look through the results before committing.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { webkit } from 'playwright';
import { createServer } from 'vite';

const outFlag = process.argv.indexOf('--out');
const OUT = resolve(outFlag > -1 ? process.argv[outFlag + 1] : 'docs/screenshots');
mkdirSync(OUT, { recursive: true });

const server = await createServer({ server: { port: 5199 }, logLevel: 'error' });
await server.listen();
const APP = server.resolvedUrls.local[0];
const browser = await webkit.launch();
let pageErrors = 0;
const phone = { viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Europe/Kyiv', locale: 'uk-UA',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' };
const stub = async (ctx) => {
  await ctx.route('https://api.monobank.ua/**', async (r) => {
    const url = r.request().url();
    const json = (b) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
    if (url.includes('client-info')) return json({ jars: [
      { id: 'demo1', sendId: 'jar/DemoMain01', title: 'На тепловізор', description: '', currencyCode: 980, balance: 2698000, goal: 6000000 },
      { id: 'demo2', sendId: 'jar/DemoMain02', title: 'На дрони', description: '', currencyCode: 980, balance: 1240000, goal: 3000000 },
      { id: 'demo3', sendId: 'jar/DemoMain03', title: 'Валютна банка', description: '', currencyCode: 840, balance: 50000, goal: 0 } ] });
    if (url.includes('/personal/statement/')) return json([{ id: 'new1', time: Math.floor(Date.now() / 1000) - 3600, description: 'Від: Ганна Литвин', comment: 'Тримайтесь!', amount: 50000, balance: 2748000, hold: false }]);
    if (url.includes('/bank/jar/')) { const id = url.split('/').pop(); const a = { DemoLongJarAAAAAAAAAAAAAAAAAAAAA1: 560000, DemoLongJarAAAAAAAAAAAAAAAAAAAAA2: 320000, DemoLongJarAAAAAAAAAAAAAAAAAAAAA4: 95000, DemoLongJarAAAAAAAAAAAAAAAAAAAAA5: 170000 }[id] ?? 100000; return json({ amount: a, goal: 0, title: 'Банка', ownerName: 'Демо', currency: 980, closed: false, jarId: 'DemoHelper1' }); }
    return json({});
  });
};
const seed = async (page) => page.evaluate(async () => {
  const NOW = Date.now(), DAY = 864e5;
  const store = await import('/zbory/src/utils/campaignStore.ts');
  const parser = await import('/zbory/src/utils/csvParser.ts');
  const ts = await import('/zbory/src/utils/timestamps.ts');
  const load = async (f) => { const csv = await (await fetch(`/zbory/tests/data/${f}`)).text(); const raw = ts.withTimestamps(await parser.parseCSV(new File([csv], 'x.csv', { type: 'text/csv' }))); const shift = Math.floor(NOW / 1000) - 8 * 3600 - Math.max(...raw.map((r) => r.ts)); return raw.map((r) => ({ ...r, ts: r.ts + shift })); };
  const h = (...p) => p.map(([d, raised]) => ({ at: NOW - d * DAY, raised }));
  const friends = [
    { id: 'f1', name: 'Оля К.', raised: 400, target: 1000, updatedAt: NOW - 11 * DAY },
    { id: 'f2', name: 'Назар В.', raised: 1100, target: 1000, jarId: 'DemoLongJarAAAAAAAAAAAAAAAAAAAAA3', closed: true, parentJar: 'DemoMain01', syncedAt: NOW - 6 * DAY, updatedAt: NOW - 6 * DAY, history: h([20, 200], [12, 700], [6, 1100]) },
    { id: 'f3', name: 'Соломія Г.', raised: 950, jarId: 'DemoLongJarAAAAAAAAAAAAAAAAAAAAA4', parentJar: 'DemoMain01', syncedAt: NOW - 7 * DAY, updatedAt: NOW - 7 * DAY, history: h([15, 300], [7, 950]) },
    { id: 'f4', name: 'Богдан Л.', raised: 1500, target: 2500, jarId: 'DemoLongJarAAAAAAAAAAAAAAAAAAAAA5', parentJar: 'DemoMain01', syncedAt: NOW - DAY, updatedAt: NOW - DAY, history: h([18, 200], [12, 600], [7, 1000], [3, 1300], [1, 1500]) },
    { id: 'f5', name: 'Марія С.', raised: 3200, target: 3000, jarId: 'DemoLongJarAAAAAAAAAAAAAAAAAAAAA2', parentJar: 'DemoMain01', syncedAt: NOW - DAY, updatedAt: NOW - 2 * DAY, history: h([20, 500], [13, 1500], [8, 2300], [2, 3200]) },
    { id: 'f6', name: 'Ірина Д.', raised: 5000, target: 8000, jarId: 'DemoLongJarAAAAAAAAAAAAAAAAAAAAA1', parentJar: 'DemoMain01', syncedAt: NOW - DAY, updatedAt: NOW - DAY, history: h([21, 600], [17, 1500], [12, 2600], [8, 3500], [4, 4300], [1, 5000]) },
  ];
  const raffles = [
    { id: 'r3', kind: 'biggest', prize: 'Шеврон з підписом бригади' },
    { id: 'r2', kind: 'jars', prize: 'Книга з автографом', min: 3000 },
    { id: 'r1', kind: 'donors', prize: 'Павербанк', min: 200 },
  ];
  await store.saveCampaign({ name: 'На тепловізор', rawData: await load('Zbir_long.csv'), fileName: null, goal: 60000, friends, raffles, monobankJar: { id: 'demo1', title: 'На тепловізор', shortId: 'DemoMain01' }, monobankSyncedAt: NOW - 3 * 3600e3 });
  const themes = await import('/zbory/src/utils/themeStore.ts');
  const { DEFAULT_SHARED_STYLE } = await import('/zbory/src/utils/exportStack.ts');
  const { PALETTES: PALETTES } = await import('/zbory/src/utils/palettes.ts').catch(() => ({}));
  if (themes.saveTheme) { const list = PALETTES ?? []; for (const [i, name] of ['Звітний', 'Для сторіс'].entries()) await themes.saveTheme({ name, style: { ...DEFAULT_SHARED_STYLE, palette: list[i + 1] ?? DEFAULT_SHARED_STYLE.palette } }).catch((e) => console.log('theme', e)); }
  await store.saveCampaign({ name: 'На дрони', rawData: await load('Zbir_short.csv'), fileName: null, goal: 10000 });
  localStorage.setItem('zbory.friendsAutoRefresh', '0');
  localStorage.setItem('zbory.lastBackupAt', String(NOW - 2 * DAY));
});
const newPage = async (opts) => { const ctx = await browser.newContext(opts); await stub(ctx); const page = await ctx.newPage(); page.on('pageerror', (e) => { pageErrors++; console.error('page error:', e.message); }); return { ctx, page }; };
const later = async (page) => { const b = page.getByRole('button', { name: 'Пізніше' }); if (await b.count()) await b.first().click().catch(() => {}); };
const shot = async (page, name, opts = {}) => { await page.waitForTimeout(250); await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 78, ...opts }); console.log('shot', name); };
const home = async (page) => { await page.locator('header button').first().click(); await page.waitForTimeout(700); await later(page); };
const openProject = async (page, name = 'На тепловізор') => { await page.locator('li', { hasText: name }).getByRole('button', { name: 'Аналітика' }).click(); await page.waitForTimeout(900); };
const toY = async (page, text) => { await page.evaluate((t) => { const e = [...document.querySelectorAll('main p, main button, main h2, main h3')].find((x) => x.textContent.trim().startsWith(t)); if (e) window.scrollTo(0, Math.max(0, e.getBoundingClientRect().top + scrollY - 90)); }, text); await page.waitForTimeout(300); };
const top = (page) => page.evaluate(() => window.scrollTo(0, 0));

const { page } = await newPage(phone);
await page.goto(APP); await page.waitForTimeout(1300);
await seed(page);
await page.reload(); await page.waitForTimeout(1700); await later(page);

// step 1
await shot(page, '04-projects');
await page.locator('li', { hasText: 'На тепловізор' }).getByRole('button', { name: 'Редагувати' }).click(); await page.waitForTimeout(350);
await shot(page, '05-edit-menu');
await page.getByRole('button', { name: 'Закрити' }).click(); await page.waitForTimeout(250);
await page.getByRole('tab', { name: /Новий збір/ }).click(); await page.waitForTimeout(350);
await shot(page, '01-start');
await page.getByRole('button', { name: /Monobank API/ }).first().click(); await page.waitForTimeout(500);
await page.locator('input[type=password]').fill('demo-token-not-real'); await page.waitForTimeout(150);
await shot(page, '16-monobank-token');
await page.getByRole('button', { name: 'Показати мої банки' }).click(); await page.waitForTimeout(700);
await shot(page, '17-monobank-jars');
await page.getByRole('button', { name: 'Далі' }).click(); await page.waitForTimeout(450);
await shot(page, '18-monobank-range');
await page.getByRole('button', { name: 'Скасувати' }).click(); await page.waitForTimeout(500);
await page.reload(); await page.waitForTimeout(1500); await later(page);

// raffles and friends editors
await page.locator('li', { hasText: 'На тепловізор' }).getByRole('button', { name: 'Редагувати' }).click(); await page.waitForTimeout(300);
await page.getByRole('dialog').getByRole('button', { name: 'Розіграші' }).click(); await page.waitForTimeout(800);
await shot(page, '28-raffles');
await page.getByRole('button', { name: 'Готово' }).click(); await page.waitForTimeout(800); await later(page);
await page.locator('li', { hasText: 'На тепловізор' }).getByRole('button', { name: 'Редагувати' }).click(); await page.waitForTimeout(300);
await page.getByRole('dialog').getByRole('button', { name: 'Друзі збору' }).click(); await page.waitForTimeout(800);
await page.getByRole('button', { name: 'Додати за посиланням' }).click(); await page.waitForTimeout(300);
await page.locator('main textarea').fill('https://send.monobank.ua/jar/…'); await page.waitForTimeout(150);
await shot(page, '24-friends-editor');
await page.getByRole('button', { name: 'Готово' }).click(); await page.waitForTimeout(800); await later(page);

// step 2
await openProject(page); await top(page);
await shot(page, '06-analytics');
await toY(page, 'Друзі збору'); await shot(page, '07-analytics-friends');
await toY(page, 'Розіграші'); await shot(page, '32-analytics-raffles');
await page.evaluate(() => { const c = [...document.querySelectorAll('main p')].find((p) => p.textContent.includes('Хто тримає збір')); if (c) window.scrollTo(0, c.getBoundingClientRect().top + scrollY - 120); }); await page.waitForTimeout(300);
await shot(page, '08-analytics-audience');

await top(page); await page.waitForTimeout(200);
await page.evaluate(() => localStorage.setItem('zbory.monobankToken', 'demo'));
await page.reload(); await page.waitForTimeout(1500); await later(page); await openProject(page);
await page.locator('main button', { hasText: /^Оновити$/ }).first().click(); await page.waitForTimeout(1500);
await top(page); await shot(page, '25-renew-report');

// friends page, jar chart
await toY(page, 'Друзі збору');
await page.getByRole('button', { name: 'Детальніше' }).first().click(); await page.waitForTimeout(700);
await top(page); await shot(page, '26-friends-page');
await page.locator('li button', { hasText: 'Ірина Д.' }).click(); await page.waitForTimeout(500);
await shot(page, '27-jar-chart');
await page.getByRole('dialog').getByRole('button', { name: 'Закрити' }).click(); await page.waitForTimeout(250);
await page.getByText('До аналітики').click(); await page.waitForTimeout(500);

// day by day
await page.getByRole('button', { name: 'Детальніше' }).last().click(); await page.waitForTimeout(800);
await top(page); await shot(page, '29-daily');
await page.evaluate(() => { const c = [...document.querySelectorAll('main p')].find((p) => p.textContent.trim() === 'По годинах'); window.scrollTo(0, c.getBoundingClientRect().top + scrollY - 340); }); await page.waitForTimeout(300);
await shot(page, '30-daily-day');
await page.getByText('До аналітики').click(); await page.waitForTimeout(500);

// step 3
await top(page);
await page.getByRole('button', { name: 'Шаблони' }).last().click(); await page.waitForTimeout(600);
await shot(page, '09-gallery');
await page.getByRole('button', { name: /Друзі збору/ }).first().click(); await page.waitForTimeout(600);
await toY(page, '🤝'); await shot(page, '10-gallery-friends');
await page.getByRole('button', { name: /Друзі збору/ }).first().click(); await page.waitForTimeout(300);
await page.getByRole('button', { name: /Розіграші/ }).first().click(); await page.waitForTimeout(600);
await toY(page, '🎁'); await shot(page, '31-gallery-raffles');
await page.getByRole('button', { name: /Розіграші/ }).first().click(); await page.waitForTimeout(300);

// step 4
const tile = async (name) => { const g = name.group; await page.getByRole('button', { name: g }).first().click(); await page.waitForTimeout(400); await page.locator('main button', { hasText: name.title }).first().click(); await page.waitForTimeout(1100); await top(page); await page.waitForTimeout(350); };
const back = async () => { await page.getByRole('button', { name: 'До галереї' }).click(); await page.waitForTimeout(500); };
await tile({ group: /Прогрес/, title: 'Картка прогресу' });
await shot(page, '11-export');
await back(); await page.getByRole('button', { name: /Прогрес/ }).first().click(); await page.waitForTimeout(250);
await tile({ group: /Активність/, title: 'Який донат типовий' });
await shot(page, '33-card-donation-stats');
await back(); await page.getByRole('button', { name: /Активність/ }).first().click(); await page.waitForTimeout(250);
await tile({ group: /Розіграші/, title: 'Учасники розіграшу' });
await shot(page, '34-card-raffle');
await back(); await page.getByRole('button', { name: /Розіграші/ }).first().click(); await page.waitForTimeout(250);
await tile({ group: /Друзі збору/, title: 'Рейтинг друзів-помічників' });
await page.getByRole('button', { name: /^Друзі збору/ }).last().click().catch(() => {}); await page.waitForTimeout(400);
await page.evaluate(() => { const c = [...document.querySelectorAll('main p')].find((p) => p.textContent.trim() === 'Показувати на картці'); if (c) window.scrollTo(0, c.getBoundingClientRect().top + scrollY - 260); }); await page.waitForTimeout(400);
await shot(page, '12-export-friends');
await top(page); await page.waitForTimeout(200);
await page.evaluate(() => { navigator.canShare = () => true; navigator.share = async ({ files }) => { window.__file = files[0]; }; });
await page.getByRole('button', { name: /Завантажити PNG/ }).click();
await page.waitForFunction(() => window.__file, null, { timeout: 30000 });
// the exported PNG itself, as a JPEG: a PNG this size is too heavy for a README
const card = await page.evaluate(async () => {
  const img = await createImageBitmap(window.__file);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext('2d').drawImage(img, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.82).split(',')[1];
});
writeFileSync(`${OUT}/card-friends-leaderboard.jpg`, Buffer.from(card, 'base64'));
console.log('shot card-friends-leaderboard');

// scrolled, elements editor
await page.getByRole('button', { name: 'Теми' }).click(); await page.waitForTimeout(400);
await page.evaluate(() => { const b = [...document.querySelectorAll('main button')].find((x) => x.textContent.trim().startsWith('Теми')); window.scrollTo(0, b.getBoundingClientRect().top + scrollY - 250); }); await page.waitForTimeout(450);
await shot(page, '15-export-themes');
await page.getByRole('button', { name: 'Теми' }).click(); await page.waitForTimeout(250);
await page.getByRole('button', { name: 'Редагувати елементи' }).click(); await page.waitForTimeout(600);
await page.locator('[data-overlay-element="list"]').click(); await page.waitForTimeout(250);
await page.locator('.screen-overlay input[type=range]').evaluate((el) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '0.85'); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); }); await page.waitForTimeout(300);
await shot(page, '35-element-editor');
await page.locator('.screen-overlay').getByRole('button', { name: 'Скасувати' }).click(); await page.waitForTimeout(200);
await page.locator('.screen-overlay').getByRole('button', { name: 'Готово' }).click(); await page.waitForTimeout(400);

// background
const photo = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 1080; c.height = 1920; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 1920); g.addColorStop(0, '#1e3a5f'); g.addColorStop(0.55, '#c2613a'); g.addColorStop(1, '#2b1b3d'); x.fillStyle = g; x.fillRect(0, 0, 1080, 1920); x.fillStyle = 'rgba(255,214,140,.9)'; x.beginPath(); x.arc(760, 1000, 130, 0, 7); x.fill(); x.fillStyle = '#17121f'; x.beginPath(); x.moveTo(0, 1500); for (let i = 0; i <= 12; i++) x.lineTo(i * 90, 1420 - (i % 3) * 70 - (i % 2) * 40); x.lineTo(1080, 1920); x.lineTo(0, 1920); x.fill(); return c.toDataURL('image/jpeg', 0.85).split(',')[1]; });
await page.getByRole('button', { name: 'Фон та стиль' }).click(); await page.waitForTimeout(400);
await page.locator('input[type=file]').first().setInputFiles({ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(photo, 'base64') }); await page.waitForTimeout(1200);
await page.evaluate(() => { const b = [...document.querySelectorAll('main button')].find((x) => x.textContent.trim().startsWith('Фон та стиль')); window.scrollTo(0, b.getBoundingClientRect().top + scrollY - 250); }); await page.waitForTimeout(450);
await shot(page, '13-export-background');
await top(page); await page.waitForTimeout(400);
await shot(page, '20-export-with-photo');
await page.getByRole('button', { name: 'Редагувати позицію' }).click(); await page.waitForTimeout(700);
await shot(page, '14-background-editor');
await page.locator('.screen-overlay').getByRole('button', { name: 'Готово' }).click(); await page.waitForTimeout(400);

// desktop
const { page: d } = await newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1, serviceWorkers: 'block', timezoneId: 'Europe/Kyiv', locale: 'uk-UA' });
await d.goto(APP); await d.waitForTimeout(1300);
await seed(d); await d.reload(); await d.waitForTimeout(1700);
await shot(d, '22-desktop-projects');
await openProject(d); await shot(d, '23-desktop-analytics');
await d.getByRole('button', { name: 'Шаблони' }).last().click(); await d.waitForTimeout(500);
await d.getByRole('button', { name: /Друзі збору/ }).first().click(); await d.waitForTimeout(500);
await d.locator('main button', { hasText: 'Рейтинг друзів-помічників' }).first().click(); await d.waitForTimeout(1200);
await shot(d, '21-desktop-export');
await browser.close();
await server.close();
if (pageErrors > 0) {
  console.error(`${pageErrors} page error(s): check the screenshots before using them`);
  process.exit(1);
}
console.log(`Done: ${OUT}`);
process.exit(0);
