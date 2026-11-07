// Raw build/browser output stays private in a fresh ignored folder; only counts, status and (on browser failures) the bounded,
// redacted metadata lines of scripts/product-summary.mjs are printed.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { summarizeReport } from './product-summary.mjs';
import { clearTestedEvidence, sameSnapshot, snapshotTested, writeTestedEvidence } from './site/tested.mjs';

export const MIN_TESTS = 8;
export const ENGINES = ['chromium', 'firefox', 'webkit'];

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
  const perEngine = Object.fromEntries(ENGINES.map(e => [e, tests.filter(t => t.projectName === e).length]));
  const bad = tests.filter(t => t.status !== 'expected' || !ENGINES.includes(t.projectName)
    || !Array.isArray(t.results) || t.results.length !== 1 || t.results[0].status !== 'passed');
  const counts = { total: tests.length, passed: stats.expected, failed: stats.unexpected,
    flaky: stats.flaky, skipped: stats.skipped, perEngine };
  const even = ENGINES.every(e => perEngine[e] === perEngine[ENGINES[0]]);
  if (!even || ENGINES.some(e => perEngine[e] < minTests) || stats.expected !== tests.length) return { ok: false, reason: 'too few or inconsistent tests', counts };
  if (stats.unexpected || stats.flaky || stats.skipped || bad.length) return { ok: false, reason: 'failures, flakes or skips', counts };
  return { ok: true, counts };
}

// Publication evidence needs a clean, unchanged source tree at every boundary. Ignored build output does not count; tracked
// changes and non-ignored untracked files do. Any git failure counts as dirty. Local development runs are unaffected apart
// from not leaving evidence.
function sourceState(root) {
  const head = spawnSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  const status = spawnSync('git', ['-C', root, 'status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const sha = head.status === 0 ? head.stdout.trim() : '';
  const clean = status.status === 0 && status.stdout === '' && /^[0-9a-f]{40}$/.test(sha);
  return { clean, sha };
}

function main() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const fail = msg => { process.stderr.write(`verify:product: ${msg}\n`); process.exitCode = 1; };
  const ignored = spawnSync('git', ['-C', root, 'check-ignore', '-q', '--', '.airig/product/evidence'], { stdio: 'pipe' });
  if (ignored.status !== 0) return fail('scratch not ignored');
  mkdirSync(path.join(root, '.airig/product'), { recursive: true, mode: 0o700 });
  const scratch = mkdtempSync(path.join(root, '.airig/product/run-'));
  const startedAt = Date.now();
  const step = (label, args, env = {}, timeout = 900000) => {
    const r = spawnSync('pnpm', args, { cwd: root, env: { ...process.env, ...env }, encoding: 'utf8',
      timeout, maxBuffer: 64 * 1024 * 1024, shell: false });
    writeFileSync(path.join(scratch, `${label}.log`), `${r.stdout ?? ''}${r.stderr ?? ''}`, { mode: 0o600 });
    const good = !r.error && !r.signal && r.status === 0;
    process.stdout.write(`verify:product: ${label} ${good ? 'passed' : 'failed; evidence retained in ignored scratch'}\n`);
    return good;
  };
  // Evidence from an earlier run must never survive into this one; it is written again only after every check passed.
  clearTestedEvidence(root);
  const sources = [sourceState(root)];
  const version = spawnSync('pnpm', ['--version'], { encoding: 'utf8' }).stdout?.trim();
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (`pnpm@${version}` !== pkg.packageManager) return fail('pinned pnpm required');

  if (!step('library-build', ['--filter', '@charm-ux/velcro', 'run', 'build'])) return fail('blocked');
  // The SSG build generates the ignored route/manifest type inputs the typecheck needs.
  // The project-site build runs first: it leaves dist/static-prefixed and then the root build restores dist/static.
  // LITRO_BASE_PATH is pinned in every docs step (the browser tests mount the project build at /velcro; the root steps
  // need it empty), so a value or an empty string inherited from the caller's shell cannot change what is tested.
  if (!step('docs-build-prefixed', ['--filter', '@velcro/docs', 'run', 'build:prefixed'], { LITRO_BASE_PATH: '/velcro' })) return fail('blocked');
  // Capture the exact bytes the browser checks will test (every file of the project-site output plus its closure record).
  sources.push(sourceState(root));
  let tested;
  try { tested = snapshotTested(root); } catch { return fail('blocked (tested site could not be captured)'); }
  if (!step('docs-build', ['--filter', '@velcro/docs', 'run', 'build'], { LITRO_BASE_PATH: '' })) return fail('blocked');
  if (!step('docs-typecheck', ['--filter', '@velcro/docs', 'run', 'typecheck'], { LITRO_BASE_PATH: '' })) return fail('blocked');

  for (const engine of ENGINES) {
    const probe = spawnSync(process.execPath, ['--input-type=module', '-e',
      `import { ${engine} } from '@playwright/test'; process.stdout.write(${engine}.executablePath())`],
    { cwd: root, encoding: 'utf8' });
    if (probe.status !== 0 || !probe.stdout || !existsSync(probe.stdout.trim())) {
      return fail(`${engine} is not installed. Run \`pnpm exec playwright install chromium firefox webkit\` (add \`--with-deps\` on Linux) and retry; browsers are never installed automatically.`);
    }
  }

  const reportFile = path.join(scratch, 'report.json');
  const ok = step('browser-tests', ['exec', 'playwright', 'test', '-c', 'tests/product/playwright.config.mjs',
    ...ENGINES.map(e => `--project=${e}`), '--reporter=json', '--output', path.join(scratch, 'artifacts')],
  { PLAYWRIGHT_JSON_OUTPUT_NAME: reportFile, VELCRO_PRODUCT_OUT: scratch }, 30 * 60 * 1000);
  // Public, bounded and redacted; the raw log stays in ignored scratch.
  const publish = () => {
    try {
      const { lines } = summarizeReport(JSON.parse(readFileSync(reportFile, 'utf8')), { root });
      for (const line of lines) process.stdout.write(`verify:product: ${line}\n`);
    } catch { process.stdout.write('verify:product: no readable report to summarize\n'); }
  };
  if (!ok) { publish(); return fail('blocked'); }
  if (!existsSync(reportFile) || statSync(reportFile).mtimeMs < startedAt) return fail('missing or stale report');
  let result;
  try { result = evaluateReport(JSON.parse(readFileSync(reportFile, 'utf8')), { startedAt }); } catch { return fail('malformed report'); }
  const c = result.counts;
  if (c) {
    process.stdout.write(`verify:product: tests ${c.total}, passed ${c.passed}, failed ${c.failed}, flaky ${c.flaky}, skipped ${c.skipped}\n`);
    process.stdout.write(`verify:product: per engine ${ENGINES.map(e => `${e} ${c.perEngine[e]}`).join(', ')}\n`);
  }
  if (!result.ok) { publish(); return fail(`blocked (${result.reason})`); }
  // Shoelace's own test files against the built library; gated by tests/upstream/known-failures.json.
  if (!step('upstream-conformance', ['run', 'test:upstream', '--no-build'])) return fail('blocked (upstream conformance differs from the known-failures ledger)');
  // Success evidence only if the tested bytes are still exactly the captured bytes.
  let after;
  try { after = snapshotTested(root); } catch { return fail('blocked (tested site could not be re-read)'); }
  if (!sameSnapshot(tested, after)) return fail('blocked (tested site changed during verification)');
  sources.push(sourceState(root));
  const evidenceOk = sources.every(x => x.clean && x.sha === sources[0].sha);
  if (evidenceOk) writeTestedEvidence(root, tested, sources[0].sha);
  process.stdout.write('verify:product: passed (Chromium, Firefox and WebKit)\n');
  if (!evidenceOk) process.stdout.write('verify:product: note: source was not clean and unchanged at every boundary; no publication evidence recorded\n');
}

if (import.meta.main) {
  try {
    main();
  } catch {
    process.stderr.write('verify:product: blocked; unexpected internal failure (details withheld)\n');
    process.exitCode = 1;
  }
}
