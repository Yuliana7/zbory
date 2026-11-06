import { buildReminderIcs } from '../../src/utils/reminder';

let failures = 0;
const check = (label: string, ok: boolean) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failures++;
};

const base = { title: 'Оновити банки, друзів; «Збори»', details: 'Відкрийте застосунок, щоб записати свіжі суми банок друзів сьогодні.', url: 'https://example.org/zbory/' };
const ics = buildReminderIcs({ ...base, time: '21:30', now: new Date(2026, 10, 6, 12, 0) });
const unfolded = ics.replace(/\r\n /g, '');

check('every line ends in CRLF', ics.endsWith('\r\n') && !/[^\r]\n/.test(ics));
check('repeats daily with an alert at the time', ics.includes('RRULE:FREQ=DAILY') && ics.includes('TRIGGER:PT0M'));
check('later today: starts today, in floating time', ics.includes('DTSTART:20261106T213000\r\n'));
check('already past: starts tomorrow', buildReminderIcs({ ...base, time: '09:00', now: new Date(2026, 10, 6, 12, 0) }).includes('DTSTART:20261107T090000'));
check('crosses a month', buildReminderIcs({ ...base, time: '09:00', now: new Date(2026, 10, 30, 12, 0) }).includes('DTSTART:20261201T090000'));
check('text is escaped', unfolded.includes('SUMMARY:Оновити банки\\, друзів\\; «Збори»'));
check('the link is in the description and the event', unfolded.includes('\\nhttps://example.org/zbory/') && unfolded.includes('URL:https://example.org/zbory/'));
const bytes = new TextEncoder();
check('no line is over 75 bytes', ics.split('\r\n').every((l) => bytes.encode(l).length <= 75));
check('the same event when added again', ics.includes('UID:daily-reminder@zbory'));

console.log(failures === 0 ? '\nAll reminder checks passed.' : `\n${failures} check(s) FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
