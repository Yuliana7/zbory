import * as XLSX from 'xlsx';
import { parseCSV, normalizeDonations, isValidCSVFile } from '../../src/utils/csvParser';

const check = (label: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : ` ${extra}`}`);
  if (!ok) process.exitCode = 1;
};

// The layout of a statement saved as Excel (made-up donors): its own column order, «Кешбек» and «RRN»
const HEADER = ['Дата та час', 'Категорія', 'Опис', 'Сума', 'Валюта', 'Кешбек', 'Залишок', 'RRN', 'Коментар'];
const ROWS: (string | number)[][] = [
  ['01.08.2026 09:14:29', 'За посиланням', 'Від: Тест Один', 1000, 'UAH', '', 10000, '053036680017', ''],
  ['31.07.2026 21:16:51', 'Разові поповнення', 'З Чорної картки', 250, 'UAH', '', 9000, '052606093087', 'Від пана Тест'],
  ['30.07.2026 22:44:49', 'За посиланням', 'Від: \n🐈', 127.32, 'UAH', '', 8750, '051794892027', 'Lili'],
];

const book = (rows: unknown[][], bookType: 'biff8' | 'xlsx') => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Виписка');
  return new File([XLSX.write(wb, { type: 'array', bookType })], `Jar_statement.${bookType === 'xlsx' ? 'xlsx' : 'xls'}`);
};

const run = async () => {
  for (const type of ['biff8', 'xlsx'] as const) {
    const raw = await parseCSV(book([HEADER, ...ROWS], type));
    const { donations, currentBalance } = normalizeDonations(raw);
    const tag = type === 'xlsx' ? '.xlsx' : '.xls';
    check(`${tag}: every row is read`, raw.length === 3, String(raw.length));
    check(`${tag}: balance is the newest row's`, currentBalance === 10000, String(currentBalance));
    check(`${tag}: amounts, incl. decimals`, donations.map((d) => d.amount).join() === '1000,250,127.32');
    check(`${tag}: donors, self top-up and the emoji`, donations.map((d) => d.donor).join() === 'Тест Один,Власний внесок,🐈', donations.map((d) => d.donor).join());
    check(`${tag}: comment kept`, donations[2].comment === 'Lili');
    check(`${tag}: clock text is Kyiv time (06:14:29 UTC in summer)`, raw[0].ts === Date.UTC(2026, 7, 1, 6, 14, 29) / 1000, String(raw[0].ts));
  }

  // A title above the table, and real Excel date cells instead of text
  const titled = [['Виписка по банці'], [], HEADER, [new Date(Date.UTC(2026, 7, 1, 9, 14, 29)), ...ROWS[0].slice(1)]];
  const raw = await parseCSV(book(titled, 'xlsx'));
  check('title row above the table is skipped', raw.length === 1, String(raw.length));
  check('a real date cell reads as the clock it shows', raw[0].date === '01.08.2026 09:14:29', raw[0].date);

  let threw = false;
  try {
    await parseCSV(book([['щось', 'інше'], [1, 2]], 'xlsx'));
  } catch {
    threw = true;
  }
  check('a sheet that is not a statement is rejected', threw);

  check('file type: .xls and .xlsx accepted', isValidCSVFile(new File([], 'a.XLS')) && isValidCSVFile(new File([], 'a.xlsx')));
  check('file type: other files refused', !isValidCSVFile(new File([], 'a.pdf', { type: 'application/pdf' })));
};

void run();
