#!/usr/bin/env node
// Bundles each render-test suite with esbuild and runs it against testData/.
// These are server-render smoke tests: they assert template markup, insight
// math, caption/moment generation and the balance recalculation logic.
import { execSync } from 'node:child_process';
import { readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDir = dirname(fileURLToPath(import.meta.url));
const root = join(testsDir, '..', '..');
const outDir = mkdtempSync(join(tmpdir(), 'zbory-tests-'));

// Fixtures are Monobank CSVs, whose clock text is Kyiv time, and the app shows times in the
// user's own zone — so suites that assert hours/days run pinned to Kyiv time. Suites about
// time handling itself are written to hold in ANY zone; `--tz-matrix` (npm run test:tz) runs
// exactly those under several zones to prove it.
const TZ_AGNOSTIC = /^(timestamps|merge|monobankApi)Test\./;
const ZONES = ['Europe/Kyiv', 'UTC', 'Europe/Warsaw', 'America/New_York', 'Asia/Tokyo', 'Pacific/Auckland'];
const matrix = process.argv.includes('--tz-matrix');

const allSuites = readdirSync(testsDir).filter((f) => /Test\.tsx?$/.test(f));
const suites = matrix ? allSuites.filter((f) => TZ_AGNOSTIC.test(f)) : allSuites;
const runs = matrix ? ZONES : [process.env.TZ || 'Europe/Kyiv'];
let failed = false;

for (const tz of runs) {
  if (matrix) console.log(`\n######## TZ=${tz} ########`);
  for (const suite of suites) {
    const outFile = join(outDir, suite.replace(/\.tsx?$/, '.cjs'));
    console.log(`\n━━ ${suite} ━━`);
    try {
      execSync(
        `./node_modules/.bin/esbuild ${join(testsDir, suite)} --bundle --platform=node --format=cjs --loader:.json=json --jsx=automatic --outfile=${outFile}`,
        { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] },
      );
      execSync(`node ${outFile}`, { cwd: root, stdio: 'inherit', env: { ...process.env, TZ: tz } });
    } catch {
      failed = true;
    }
  }
}

rmSync(outDir, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
