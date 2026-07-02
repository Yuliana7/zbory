import type { ManualRow, RawDonation } from '../types';
import { generateId } from './id';

const CSV_HEADERS =
  'Дата та час операції,Категорія операції,Сума,Валюта,Додаткова інформація,Коментар до платежу,Залишок,Валюта залишку';

function toDdMmYyyy(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}.${m}.${y}`;
}

function quoteField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Sorts rows oldest-to-newest and computes a cumulative running balance.
 * Helper jars have no withdrawals, so balance = running sum of all donations.
 */
function sortedWithBalance(rows: ManualRow[]): Array<ManualRow & { balance: string }> {
  const sorted = [...rows].sort((a, b) => {
    const da = `${a.date}T${a.time || '12:00'}`;
    const db = `${b.date}T${b.time || '12:00'}`;
    return da.localeCompare(db);
  });

  let running = 0;
  return sorted.map((row) => {
    running += parseFloat(row.amount) || 0;
    // User override takes priority; blank means use the running sum
    const balance = row.balance.trim() ? row.balance.trim() : running.toFixed(2);
    return { ...row, balance };
  });
}

/**
 * Converts manual rows to a CSV string matching the Monobank Jar export format.
 * Rows are output newest-first to match the original format.
 */
export function manualRowsToCSVString(rows: ManualRow[]): string {
  const withBalance = [...sortedWithBalance(rows)].reverse(); // newest-first

  const csvRows = withBalance.map((row) => {
    const dateTime = `${toDdMmYyyy(row.date)} ${row.time || '12:00'}`;
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

  return withBalance.map((row) => ({
    date: `${toDdMmYyyy(row.date)} ${row.time || '12:00'}`,
    category: row.category || 'За посиланням',
    amount: parseFloat(row.amount).toFixed(2),
    currency: 'UAH',
    additionalInfo: row.name ? `Від: ${row.name}` : '',
    comment: row.comment || '',
    balance: row.balance,
    balanceCurrency: 'UAH',
  }));
}

/**
 * Converts RawDonation[] (from parseCSV) back into ManualRow[] for editing.
 * Rows are reversed to oldest-first — the natural order for manual editing.
 * Name is extracted from "Від: X" additionalInfo; other formats leave name blank.
 * Category is stored silently so withdrawal rows survive a round-trip through the editor.
 */
export function rawDonationsToManualRows(rawData: RawDonation[]): ManualRow[] {
  return [...rawData].reverse().map((raw): ManualRow => {
    const [datePart = '', timePart = ''] = raw.date.split(' ');
    const [dd = '', mm = '', yyyy = ''] = datePart.split('.');

    let name = '';
    if (raw.additionalInfo.startsWith('Від:')) {
      name = raw.additionalInfo.substring(4).trim();
    }

    return {
      id: generateId(),
      date: yyyy && mm && dd ? `${yyyy}-${mm}-${dd}` : '',
      time: timePart,
      name,
      amount: raw.amount,
      category: raw.category || undefined,
      comment: raw.comment || '',
      balance: raw.balance || '',
    };
  });
}

/**
 * Triggers a browser download of a CSV file.
 * Prepends a UTF-8 BOM so Excel opens it correctly.
 */
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
