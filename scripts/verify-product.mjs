// Raw build/browser output stays private in a fresh ignored folder; only counts and status are printed.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MIN_TESTS = 8;

function collect(suite, out) {
  for (const spec of suite?.specs ?? []) {
    for (const t of spec.tests ?? []) out.push(t);
  }
  for (const child of suite?.suites ?? []) collect(child, out);
}

// Returns { ok, counts, reason }. Fails closed on anything unexpected or stale.
export function evaluateReport(report, { startedAt, minTests = MIN_TESTS } = {}) {
  const fail = reason => ({ ok: false, reason, counts: null });
  if (report === null || typeof report !== 'object' || Array.isArray(report)) return fail('malformed report');
  const stats = report.stats;
  if (!stats || typeof stats !== 'object') return fail('malformed report');
  for (const k of ['expected', 'unexpected', 'flaky', 'skipped']) {
    if (!Number.isInteger(stats[k]) || stats[k] < 0) return fail('malformed report');
  }
  const started = Date.parse(stats.startTime);
  if (Number.isNaN(started) || typeof startedAt !== 'number' || started < startedAt) return fail('stale report');
  if (!Array.isArray(report.suites) || !Array.isArray(report.errors)) return fail('malformed report');
  if (report.errors.length > 0) return fail('report errors');
  const tests = [];
  for (const s of report.suites) collect(s, tests);
  const bad = tests.filter(t => t.status !== 'expected' || t.projectName !== 'chromium'
    || !Array.isArray(t.results) || t.results.length !== 1 || t.results[0].status !== 'passed');
  const counts = { total: tests.length, passed: stats.expected, failed: stats.unexpected,
    flaky: stats.flaky, skipped: stats.skipped };
  if (tests.length < minTests || stats.expected !== tests.length) return { ok: false, reason: 'too few or inconsistent tests', counts };
  if (stats.unexpected || stats.flaky || stats.skipped || bad.length) return { ok: false, reason: 'failures, flakes or skips', counts };
  return { ok: true, counts };
}

function main() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const fail = msg => { process.stderr.write(`verify:product: ${msg}\n`); process.exitCode = 1; };
  const ignored = spawnSync('git', ['-C', root, 'check-ignore', '-q', '--', '.airig/product/evidence'], { stdio: 'pipe' });
  if (ignored.status !== 0) return fail('scratch not ignored');
  mkdirSync(path.join(root, '.airig/product'), { recursive: true, mode: 0o700 });
  const scratch = mkdtempSync(path.join(root, '.airig/product/run-'));
  const startedAt = Date.now();
  const step = (label, args, env = {}) => {
    const r = spawnSync('pnpm', args, { cwd: root, env: { ...process.env, ...env }, encoding: 'utf8',
      timeout: 900000, maxBuffer: 64 * 1024 * 1024, shell: false });
    writeFileSync(path.join(scratch, `${label}.log`), `${r.stdout ?? ''}${r.stderr ?? ''}`, { mode: 0o600 });
    const good = !r.error && !r.signal && r.status === 0;
    process.stdout.write(`verify:product: ${label} ${good ? 'passed' : 'failed; evidence retained in ignored scratch'}\n`);
    return good;
  };
  const version = spawnSync('pnpm', ['--version'], { encoding: 'utf8' }).stdout?.trim();
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (`pnpm@${version}` !== pkg.packageManager) return fail('pinned pnpm required');

  if (!step('library-build', ['--filter', '@charm-ux/velcro', 'run', 'build'])) return fail('blocked');
  // The SSG build generates the ignored route/manifest type inputs the typecheck needs.
  if (!step('docs-build', ['--filter', '@velcro/docs', 'run', 'build'])) return fail('blocked');
  if (!step('docs-typecheck', ['--filter', '@velcro/docs', 'run', 'typecheck'])) return fail('blocked');

  const probe = spawnSync(process.execPath, ['--input-type=module', '-e',
    "import { chromium } from '@playwright/test'; process.stdout.write(chromium.executablePath())"],
  { cwd: root, encoding: 'utf8' });
  if (probe.status !== 0 || !probe.stdout || !existsSync(probe.stdout.trim())) {
    return fail('Chromium is not installed. Run `pnpm exec playwright install chromium` (add `--with-deps` on Linux) and retry; it is never installed automatically.');
  }

  const reportFile = path.join(scratch, 'report.json');
  const ok = step('browser-tests', ['exec', 'playwright', 'test', '-c', 'tests/product/playwright.config.mjs',
    '--project=chromium', '--reporter=json', '--output', path.join(scratch, 'artifacts')],
  { PLAYWRIGHT_JSON_OUTPUT_NAME: reportFile, VELCRO_PRODUCT_OUT: scratch });
  if (!ok) return fail('blocked');
  if (!existsSync(reportFile) || statSync(reportFile).mtimeMs < startedAt) return fail('missing or stale report');
  let result;
  try { result = evaluateReport(JSON.parse(readFileSync(reportFile, 'utf8')), { startedAt }); } catch { return fail('malformed report'); }
  const c = result.counts;
  if (c) process.stdout.write(`verify:product: tests ${c.total}, passed ${c.passed}, failed ${c.failed}, flaky ${c.flaky}, skipped ${c.skipped}\n`);
  if (!result.ok) return fail(`blocked (${result.reason})`);
  process.stdout.write('verify:product: passed (Chromium only)\n');
}

if (import.meta.main) {
  try {
    main();
  } catch {
    process.stderr.write('verify:product: blocked; unexpected internal failure (details withheld)\n');
    process.exitCode = 1;
  }
}
