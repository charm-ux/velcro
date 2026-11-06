// The aggregate-timeout path, exercised with a short hermetic timeout: Playwright must stop the run, still write a parseable
// JSON report, and the product summary must be able to describe it (no browser is launched; the test needs none).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizeReport } from '../../scripts/product-summary.mjs';

const require = createRequire(import.meta.url);
const cli = require.resolve('@playwright/test/cli');
// The fixture lives in the temp directory, where the bare package name cannot be resolved; import the resolved module instead.
const playwrightTest = pathToFileURL(path.join(path.dirname(require.resolve('@playwright/test')), 'index.mjs')).href;

test('a run that exceeds the global timeout stops, fails and leaves a report the summary can read', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'velcro-gt-'));
  try {
    writeFileSync(path.join(dir, 'config.mjs'), `export default { testDir: '.', testMatch: '*.spec.mjs', globalTimeout: 3000, timeout: 60000, reporter: 'json', projects: [{ name: 'chromium' }, { name: 'firefox' }, { name: 'webkit' }] };\n`);
    const marker = path.join(dir, 'started.marker');
    writeFileSync(path.join(dir, 'slow.spec.mjs'), `import { writeFileSync } from 'node:fs';\nimport { test } from ${JSON.stringify(playwrightTest)};\ntest('hangs', async () => { writeFileSync(${JSON.stringify(marker)}, 'started'); await new Promise(resolve => setTimeout(resolve, 30000)); });\n`);
    const started = Date.now();
    const report = path.join(dir, 'report.json');
    const r = spawnSync(process.execPath, [cli, 'test', '-c', path.join(dir, 'config.mjs')], {
      cwd: path.dirname(path.dirname(cli)), encoding: 'utf8', timeout: 60000,
      env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: report },
    });
    assert.notEqual(r.status, 0);
    assert.ok(!r.error, 'the subprocess itself must not time out');
    assert.ok(Date.now() - started < 30000, 'the global timeout stopped the run well before the test finished');
    assert.ok(existsSync(marker), 'the hanging test really started (the spec loaded and ran)');
    const parsed = JSON.parse(readFileSync(report, 'utf8'));
    const errors = parsed.errors.map(e => String(e.message));
    assert.ok(errors.some(m => /Timed out waiting 3s for the test suite to run/.test(m)), 'the global-timeout error is in the report');
    assert.ok(!errors.some(m => /Cannot find|ERR_MODULE_NOT_FOUND|Error: Unknown|SyntaxError/.test(m)), 'no collection or module-resolution error');
    const { lines } = summarizeReport(parsed);
    // The interrupted hanging test is in the report (as skipped), in each of the three engines.
    assert.deepEqual(lines.slice(0, 3), ['chromium', 'firefox', 'webkit'].map(e => `${e} passed 0, failed 0, flaky 0, skipped 1`));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
