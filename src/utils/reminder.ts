// A daily reminder as a calendar event. There is no server to send notifications, but every phone
// already has a calendar that can. Times are "floating" (no time zone), so it follows the device.

const pad = (n: number) => String(n).padStart(2, '0');
const stamp = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const escapeText = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');

/** iCalendar lines stop at 75 bytes and go on after a space; Cyrillic letters take two bytes each. */
function fold(line: string): string {
  const bytes = new TextEncoder();
  const parts: string[] = [];
  let part = '';
  let size = 0;
  for (const ch of line) {
    const n = bytes.encode(ch).length;
    if (size + n > 74) {
      parts.push(part);
      part = ' ';
      size = 1;
    }
    part += ch;
    size += n;
  }
  parts.push(part);
  return parts.join('\r\n');
}

export interface ReminderOptions {
  /** "HH:MM" on the device's clock */
  time: string;
  title: string;
  details: string;
  url: string;
  now?: Date;
}

/** One event repeating daily, starting at the next time that clock time comes around. */
export function buildReminderIcs({ time, title, details, url, now = new Date() }: ReminderOptions): string {
  const [h, m] = time.split(':').map(Number);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
  if (start.getTime() <= now.getTime()) start.setDate(start.getDate() + 1);
  const utc = now.toISOString().replace(/[-:]|\.\d{3}/g, '');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Zbory//Reminder//UK',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:daily-reminder@zbory',
    `DTSTAMP:${utc}`,
    `DTSTART:${stamp(start)}`,
    'DURATION:PT10M',
    'RRULE:FREQ=DAILY',
    'TRANSP:TRANSPARENT',
    `SUMMARY:${escapeText(title)}`,
    `DESCRIPTION:${escapeText(`${details}\n${url}`)}`,
    `URL:${url}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(title)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ]
    .map(fold)
    .join('\r\n');
}
