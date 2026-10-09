import { parseGoal } from '../../src/utils/goal';

let failures = 0;
const check = (label: string, ok: boolean) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failures++;
};

check('goal: plain number', parseGoal('100000') === 100000);
check('goal: spaces and separators are ignored', parseGoal('100 000') === 100000 && parseGoal('100,000') === 100000);
check('goal: empty → null', parseGoal('') === null && parseGoal('   ') === null);
check('goal: zero, negative, garbage → null', parseGoal('0') === null && parseGoal('-5') === null && parseGoal('abc') === null);

console.log(failures === 0 ? '\nAll goal checks passed.' : `\n${failures} check(s) FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
