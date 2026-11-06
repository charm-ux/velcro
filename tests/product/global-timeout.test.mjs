// The aggregate-timeout path, exercised with a short hermetic timeout: Playwright must stop the run, still write a parseable
// JSON report, and the product summary must be able to describe it (no browser is launched; the test needs none).
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizeReport } from '../../scripts/product-summary.mjs';

const cli = createRequire(import.meta.url).resolve('@playwright/test/cli');

test('a run that exceeds the global timeout stops, fails and leaves a report the summary can read', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'velcro-gt-'));
  try {
    writeFileSync(path.join(dir, 'config.mjs'), `export default { testDir: '.', testMatch: '*.spec.mjs', globalTimeout: 3000, timeout: 60000, reporter: 'json', projects: [{ name: 'chromium' }, { name: 'firefox' }, { name: 'webkit' }] };\n`);
    writeFileSync(path.join(dir, 'slow.spec.mjs'), `import { test } from '@playwright/test';\ntest('hangs', async () => { await new Promise(resolve => setTimeout(resolve, 30000)); });\n`);
    const started = Date.now();
    const report = path.join(dir, 'report.json');
    const r = spawnSync(process.execPath, [cli, 'test', '-c', path.join(dir, 'config.mjs')], {
      cwd: path.dirname(path.dirname(cli)), encoding: 'utf8', timeout: 60000,
      env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: report },
    });
    assert.notEqual(r.status, 0);
    assert.ok(Date.now() - started < 30000, 'the global timeout stopped the run well before the test finished');
    const parsed = JSON.parse(readFileSync(report, 'utf8'));
    const { lines } = summarizeReport(parsed);
    assert.equal(lines.length >= 3, true);
    assert.match(lines[0], /^chromium passed 0, failed \d, flaky 0, skipped \d$/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
