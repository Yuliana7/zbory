import Papa from 'papaparse';
import type { RawDonation, Donation, Withdrawal } from '../types';

export interface NormalizeResult {
  donations: Donation[];
  withdrawals: Withdrawal[];
  currentBalance: number;
}

/**
 * Parses Ukrainian CSV format from Monobank Jar
 * OR statement file provided by monobank support team
 * Expected columns:
 * - Дата та час операції / Дата та час
 * - Категорія операції / Категорія
 * - Сума
 * - Валюта
 * - Додаткова інформація / Опис
 * - Коментар до платежу / Коментар
 * - Залишок
 * - Валюта залишку
 */
export function parseCSV(file: File): Promise<RawDonation[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (results) => {
        try {
          const rawDonations: RawDonation[] = (results.data as Record<string, string>[]).map((row) => ({
            date: row['Дата та час операції'] || row['Дата та час'] || '',
            category: row['Категорія операції'] || row['Категорія'] || '',
            amount: row['Сума'] || '0',
            currency: row['Валюта'] || 'UAH',
            additionalInfo: row['Додаткова інформація'] || row['Опис'] || '',
            comment: row['Коментар до платежу'] || row['Коментар'] || '',
            balance: row['Залишок'] || '0',
            balanceCurrency: row['Валюта залишку'] || 'UAH',
          }));

          resolve(rawDonations);
        } catch {
          reject(new Error('Помилка при обробці CSV файлу'));
        }
      },
      error: (error) => {
        reject(new Error(`Помилка при читанні CSV: ${error.message}`));
      },
    });
  });
}

const WITHDRAWAL_CATEGORIES = new Set(['Часткове зняття']);

/**
 * Normalizes raw donation data, separating donations from partial withdrawals.
 * currentBalance is taken from the most-recent row's Залишок (CSV is newest-first).
 */
export function normalizeDonations(rawDonations: RawDonation[]): NormalizeResult {
  const donations: Donation[] = [];
  const withdrawals: Withdrawal[] = [];

  // The CSV is sorted newest-first, so the first row's Залишок is the current balance.
  let currentBalance = 0;
  const firstWithBalance = rawDonations.find((r) => r.balance && r.balance !== '0');
  if (firstWithBalance) {
    currentBalance = parseUkrainianNumber(firstWithBalance.balance);
  }

  for (const raw of rawDonations) {
    try {
      const timestamp = parseUkrainianDate(raw.date);
      if (!timestamp || isNaN(timestamp.getTime())) {
        console.warn('Invalid date:', raw.date);
        continue;
      }

      const amount = parseUkrainianNumber(raw.amount);
      if (isNaN(amount) || amount <= 0) {
        console.warn('Invalid amount:', raw.amount);
        continue;
      }

      if (WITHDRAWAL_CATEGORIES.has(raw.category)) {
        withdrawals.push({
          timestamp,
          amount,
          destination: raw.additionalInfo || undefined,
          balanceAfter: parseUkrainianNumber(raw.balance),
        });
      } else {
        donations.push({
          timestamp,
          amount,
          donor: extractDonorName(raw.additionalInfo),
          category: raw.category,
          comment: raw.comment || undefined,
        });
      }
    } catch (error) {
      console.error('Error normalizing row:', error, raw);
    }
  }

  return { donations, withdrawals, currentBalance };
}

/**
 * Parses Ukrainian date format: "DD.MM.YYYY HH:mm"
 */
export function parseUkrainianDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  try {
    // Split date and time
    const [datePart, timePart] = dateStr.split(' ');
    if (!datePart) return null;

    // Parse date: DD.MM.YYYY
    const [day, month, year] = datePart.split('.').map(Number);

    // Parse time: HH:mm (optional)
    let hours = 0;
    let minutes = 0;
    if (timePart) {
      const [h, m] = timePart.split(':').map(Number);
      hours = h || 0;
      minutes = m || 0;
    }

    // JavaScript Date: month is 0-indexed
    const date = new Date(year, month - 1, day, hours, minutes);

    return date;
  } catch {
    return null;
  }
}

/**
 * Parses Ukrainian number format (comma as decimal separator)
 * Examples: "2000.00" -> 2000, "1,500.50" -> 1500.5
 */
function parseUkrainianNumber(numStr: string): number {
  if (!numStr) return 0;

  // Remove any spaces and replace comma with dot if needed
  const cleaned = numStr.toString().trim().replace(',', '.');
  return parseFloat(cleaned);
}

/**
 * Extracts donor name from additional info field
 * Format examples:
 * - "Від: Назар Гнідь" -> "Назар Гнідь"
 * - "З чорної картки" -> "Власний внесок" (self-donation from owner's card)
 * - "З залізної картки" -> "Власний внесок" (self-donation)
 * - "🐈" -> "🐈" (anonymous emoji donors)
 */
function extractDonorName(info: string): string | undefined {
  if (!info) return undefined;

  // Check if it's a self-donation from owner's card (Monobank card types)
  // Pattern: "З [card type] картки" (From [card type] card)
  if (/З\s+(чорної|залізної|білої|platinum|iron|black|white)\s+картки/i.test(info)) {
    return 'Власний внесок';
  }

  // Check if it starts with "Від:" (From:)
  if (info.startsWith('Від:')) {
    const name = info.substring(4).trim();
    return name || undefined;
  }

  // Check if it's an emoji or very short (likely anonymous)
  if (info.length <= 10 && /[\p{Emoji}]/u.test(info)) {
    return info;
  }

  // If it's a technical note (like "Поповнення рахунку"), skip it
  if (info.includes('рахунк') || info.includes('Поповнення')) {
    return undefined;
  }

  return undefined;
}

/**
 * Validates if a file is a valid CSV
 */
export function isValidCSVFile(file: File): boolean {
  const validTypes = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
  const validExtensions = ['.csv'];

  const hasValidType = validTypes.includes(file.type);
  const hasValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

  return hasValidType || hasValidExtension;
}

/**
 * Formats file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
