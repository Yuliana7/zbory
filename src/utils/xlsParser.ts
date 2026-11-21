import * as XLSX from 'xlsx';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** One cell as the text a CSV would hold: a date serial becomes "DD.MM.YYYY HH:mm:ss" (the clock as written, Kyiv). */
function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    return `${pad2(v.getUTCDate())}.${pad2(v.getUTCMonth() + 1)}.${v.getUTCFullYear()} ${pad2(v.getUTCHours())}:${pad2(v.getUTCMinutes())}:${pad2(v.getUTCSeconds())}`;
  }
  return String(v).trim();
}

/**
 * Reads a Monobank statement saved as Excel (.xls / .xlsx): the first sheet, with the header row
 * found by its «Сума» column, so a title above the table doesn't matter. Rows come back keyed by
 * header, like the CSV ones. Dates stored as real Excel dates are read as the clock they show.
 */
export async function readSpreadsheetRows(file: File): Promise<Record<string, string>[]> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, UTC: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '', blankrows: false });
  const headerAt = grid.findIndex((r) => r.some((c) => cellText(c) === 'Сума'));
  if (headerAt < 0) throw new Error('Не знайшов таблицю виписки у файлі');
  const headers = grid[headerAt].map(cellText);
  return grid.slice(headerAt + 1).map((r) => {
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (h) row[h] = cellText(r[i]);
    });
    return row;
  });
}
