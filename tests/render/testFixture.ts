import { readFileSync } from 'node:fs';
import Papa from 'papaparse';
import type { RawDonation } from '../../src/types';

/**
 * Loads a testData/*.csv fixture the same way parseCSV() does in the app —
 * mirrors both the standard Monobank Jar export headers and the alternate
 * "statement from the support team" headers (see src/utils/csvParser.ts).
 */
export function loadRawDonations(csvPath: string): RawDonation[] {
  const csvText = readFileSync(csvPath, 'utf-8').replace(/^\uFEFF/, '');
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  return (parsed.data as Record<string, string>[]).map((row) => ({
    date: row['Дата та час операції'] || row['Дата та час'] || '',
    category: row['Категорія операції'] || row['Категорія'] || '',
    amount: row['Сума'] || '0',
    currency: row['Валюта'] || 'UAH',
    additionalInfo: row['Додаткова інформація'] || row['Опис'] || '',
    comment: row['Коментар до платежу'] || row['Коментар'] || '',
    balance: row['Залишок'] || '0',
    balanceCurrency: row['Валюта залишку'] || 'UAH',
  }));
}
