import type { ManualRow, RawDonation } from '../types';
import { generateId } from './id';
import { saveBlob } from './download';
import { rowTimestamp, unixToKyivWallClock } from './timestamps';

const CSV_HEADERS =
  'Дата та час операції,Категорія операції,Сума,Валюта,Додаткова інформація,Коментар до платежу,Залишок,Валюта залишку';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** A date and time as typed in the editor (the user's own clock) → Unix seconds. */
function localToUnix(isoDate: string, time: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  const [h, mi] = (time || '12:00').split(':').map(Number);
  return Math.floor(new Date(y, m - 1, d, h || 0, mi || 0).getTime() / 1000);
}

function quoteField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

// Some exports use a comma decimal separator (e.g. "2938,11"); normalize to a dot
// so numeric <input> fields in the editor render and parse correctly.
function normalizeDecimal(value: string): string {
  return value.trim().replace(',', '.');
}

export function sortChronologically(rows: ManualRow[]): ManualRow[] {
  return [...rows].sort((a, b) => {
    const da = `${a.date}T${a.time || '12:00'}`;
    const db = `${b.date}T${b.time || '12:00'}`;
    return da.localeCompare(db);
  });
}

/**
 * Computes the running balance for every row, oldest-to-newest.
 * A non-empty balance is treated as an authoritative baseline (banks can apply
 * hidden refunds/corrections that never appear as separate transactions), so
 * all later rows accumulate from the most recent baseline instead of a plain
 * running sum of amounts.
 */
export function computeBalances(rows: ManualRow[]): Map<string, string> {
  let running = 0;
  const map = new Map<string, string>();
  for (const row of sortChronologically(rows)) {
    const override = parseFloat(row.balance);
    if (row.balance.trim() !== '' && !isNaN(override)) {
      running = override;
    } else {
      running += parseFloat(row.amount) || 0;
    }
    map.set(row.id, running.toFixed(2));
  }
  return map;
}

function sortedWithBalance(rows: ManualRow[]): Array<ManualRow & { balance: string }> {
  const balances = computeBalances(rows);
  return sortChronologically(rows).map((row) => ({ ...row, balance: balances.get(row.id)! }));
}

/**
 * Converts manual rows to a CSV string matching the Monobank Jar export format.
 * Rows are output newest-first to match the original format.
 */
export function manualRowsToCSVString(rows: ManualRow[]): string {
  const withBalance = [...sortedWithBalance(rows)].reverse(); // newest-first

  const csvRows = withBalance.map((row) => {
    // CSV clock text is Kyiv time, whatever the user's own zone is
    const dateTime = unixToKyivWallClock(localToUnix(row.date, row.time));
    const amount = parseFloat(row.amount).toFixed(2);
    const donorInfo = row.name ? `Від: ${row.name}` : '';
    return [
      dateTime,
      row.category || 'За посиланням',
      amount,
      'UAH',
      quoteField(donorInfo),
      quoteField(row.comment || ''),
      row.balance,
      'UAH',
    ].join(',');
  });

  return [CSV_HEADERS, ...csvRows].join('\n');
}

/**
 * Converts manual rows to RawDonation[] for the data pipeline.
 * Produces the same structure as parseCSV() so normalizeDonations() works unchanged.
 */
export function manualRowsToRawDonations(rows: ManualRow[]): RawDonation[] {
  const withBalance = [...sortedWithBalance(rows)].reverse(); // newest-first

  return withBalance.map((row) => {
    const ts = localToUnix(row.date, row.time);
    return {
      ts,
      date: unixToKyivWallClock(ts),
      category: row.category || 'За посиланням',
      amount: parseFloat(row.amount).toFixed(2),
      currency: 'UAH',
      additionalInfo: row.name ? `Від: ${row.name}` : '',
      comment: row.comment || '',
      balance: row.balance,
      balanceCurrency: 'UAH',
    };
  });
}

/**
 * Converts RawDonation[] (from parseCSV) back into ManualRow[] for editing.
 * Rows are reversed to oldest-first — the natural order for manual editing.
 * Name is extracted from "Від: X" additionalInfo; other formats leave name blank.
 * Category is stored silently so withdrawal rows survive a round-trip through the editor.
 */
export function rawDonationsToManualRows(rawData: RawDonation[]): ManualRow[] {
  return [...rawData].reverse().map((raw): ManualRow => {
    // Date and time are shown on the user's own clock, derived from the row's instant
    const ts = rowTimestamp(raw);
    const local = ts === null ? null : new Date(ts * 1000);

    let name = '';
    if (raw.additionalInfo.startsWith('Від:')) {
      name = raw.additionalInfo.substring(4).trim();
    }

    return {
      id: generateId(),
      date: local ? `${local.getFullYear()}-${pad2(local.getMonth() + 1)}-${pad2(local.getDate())}` : '',
      time: local ? `${pad2(local.getHours())}:${pad2(local.getMinutes())}` : '',
      name,
      amount: normalizeDecimal(raw.amount),
      category: raw.category || undefined,
      comment: raw.comment || '',
      balance: raw.balance ? normalizeDecimal(raw.balance) : '',
    };
  });
}

/**
 * Triggers a browser download of a CSV file.
 * Prepends a UTF-8 BOM so Excel opens it correctly.
 */
export function downloadCSV(content: string, filename: string): Promise<void> {
  return saveBlob(new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' }), filename);
}
