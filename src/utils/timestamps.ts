import type { RawDonation } from '../types';

// Every donation row carries `ts`: the Unix time (seconds) of the operation. That
// instant is the single source of truth — rows from different sources (a CSV, the
// Monobank API, manual entry) are compared by it, and what the user sees is that
// instant shown in their own local time.
//
// Monobank's CSV only has clock text ("06.10.2026 16:00") with no zone. It is
// always Kyiv time, wherever the user is (verified against the API's own Unix
// times), so that is the zone assumed when reading it, and the zone used when
// writing the same text back. The API gives the instant directly.

const pad2 = (n: number) => String(n).padStart(2, '0');

const KYIV_TZ = (() => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: 'Europe/Kyiv' });
    return 'Europe/Kyiv';
  } catch {
    return 'Europe/Kiev'; // the name older ICU versions know
  }
})();

const kyivFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: KYIV_TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** The wall-clock time in Kyiv at a given instant. */
export function kyivParts(unixMs: number) {
  const p: Record<string, string> = {};
  for (const part of kyivFormat.formatToParts(new Date(unixMs))) p[part.type] = part.value;
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour % 24, minute: +p.minute, second: +p.second };
}

/** Kyiv's offset from UTC at a given instant, in ms (DST included). */
const kyivOffsetMs = (unixMs: number) => {
  const k = kyivParts(unixMs);
  return Date.UTC(k.year, k.month - 1, k.day, k.hour, k.minute, k.second) - Math.floor(unixMs / 1000) * 1000;
};

/** The instant (Unix ms) at which Kyiv's wall clock shows the given date and time. */
export function kyivWallToUnixMs(year: number, month: number, day: number, hour = 0, minute = 0, second = 0) {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  // The offset depends on the instant, so check it again at the corrected one (DST edges)
  return guess - kyivOffsetMs(guess - kyivOffsetMs(guess));
}

/** "06.10.2026 16:00" (or with ":ss") read as Kyiv time → Unix seconds; null if it isn't a date. */
export function kyivWallClockToUnix(text: string): number | null {
  const [datePart, timePart = '00:00'] = text.trim().split(/\s+/);
  const [day, month, year] = (datePart ?? '').split('.').map(Number);
  const [hour, minute, second = 0] = timePart.split(':').map(Number);
  const parts = [day, month, year, hour, minute, second];
  if (parts.some((n) => !Number.isFinite(n)) || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return Math.floor(kyivWallToUnixMs(year, month, day, hour, minute, second) / 1000);
}

/** Unix seconds → "06.10.2026 16:00", the clock text a Monobank CSV has (Kyiv time). */
export function unixToKyivWallClock(unixSec: number): string {
  const k = kyivParts(unixSec * 1000);
  return `${pad2(k.day)}.${pad2(k.month)}.${k.year} ${pad2(k.hour)}:${pad2(k.minute)}`;
}

/** The instant of a row: its stored `ts`, or — for rows saved before `ts` existed — read from its clock text. */
export function rowTimestamp(row: RawDonation): number | null {
  return row.ts ?? kyivWallClockToUnix(row.date);
}

/** Fills in `ts` where it is missing. Returns the same array when nothing needed filling. */
export function withTimestamps(rows: RawDonation[]): RawDonation[] {
  if (rows.every((r) => r.ts !== undefined)) return rows;
  return rows.map((r) => {
    if (r.ts !== undefined) return r;
    const ts = kyivWallClockToUnix(r.date);
    return ts === null ? r : { ...r, ts };
  });
}
