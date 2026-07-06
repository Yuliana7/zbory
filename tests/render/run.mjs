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

const suites = readdirSync(testsDir).filter((f) => /Test\.tsx?$/.test(f));
let failed = false;

for (const suite of suites) {
  const outFile = join(outDir, suite.replace(/\.tsx?$/, '.cjs'));
  console.log(`\n━━ ${suite} ━━`);
  try {
    execSync(
      `./node_modules/.bin/esbuild ${join(testsDir, suite)} --bundle --platform=node --format=cjs --loader:.json=json --jsx=automatic --outfile=${outFile}`,
      { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] },
    );
    execSync(`node ${outFile}`, { cwd: root, stdio: 'inherit' });
  } catch {
    failed = true;
  }
}

rmSync(outDir, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
