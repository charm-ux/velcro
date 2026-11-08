// Raw build/browser output stays private in a fresh ignored folder; only counts, status and (on browser failures) the bounded,
// redacted metadata lines of scripts/product-summary.mjs (and, for the upstream gate, the fixed-vocabulary lines of
// scripts/upstream-summary.mjs) are printed.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDigest, collect as collectBuild } from './ci/build-output.mjs';
import { summarizeReport } from './product-summary.mjs';
import { readCatalog } from './site/catalog.mjs';
import { readInventory } from './upstream-conformance.mjs';
import { summarizeUpstream } from './upstream-summary.mjs';
import { clearTestedEvidence, sameSnapshot, snapshotTested, writeTestedEvidence } from './site/tested.mjs';

export const MIN_TESTS = 8;
export const ENGINES = ['chromium', 'firefox', 'webkit'];

function collect(suite, out) {
  for (const spec of suite?.specs ?? []) {
    for (const t of spec.tests ?? []) out.push(t);
  }
  for (const child of suite?.suites ?? []) collect(child, out);
}

// Returns { ok, counts, reason }. Fails closed on anything unexpected or stale. `engines` is the set the run was asked for
// (one engine for a CI shard); a test of any other engine fails the report.
export function evaluateReport(report, { startedAt, minTests = MIN_TESTS, engines = ENGINES } = {}) {
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
  const perEngine = Object.fromEntries(engines.map(e => [e, tests.filter(t => t.projectName === e).length]));
  const bad = tests.filter(t => t.status !== 'expected' || !engines.includes(t.projectName)
    || !Array.isArray(t.results) || t.results.length !== 1 || t.results[0].status !== 'passed');
  const counts = { total: tests.length, passed: stats.expected, failed: stats.unexpected,
    flaky: stats.flaky, skipped: stats.skipped, perEngine };
  const even = engines.every(e => perEngine[e] === perEngine[engines[0]]);
  if (!even || engines.some(e => perEngine[e] < minTests) || stats.expected !== tests.length) return { ok: false, reason: 'too few or inconsistent tests', counts };
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

// Stages. Without arguments the whole verification runs here, as it does locally. CI splits it across jobs that test the
// same bytes: `--stage build` builds once from a clean, unchanged source and prints the build digest (scripts/ci/
// build-output.mjs: every file of both dist trees, bound to the source commit); each `--stage browser --engine <e> --shard
// <i>/<n>` and `--stage upstream` job checks that digest, and a clean source, on the build job's output (passed as a workflow
// artifact) before and after its checks, without rebuilding; `--stage evidence` checks it too and records the publication
// evidence for the prefixed site in it. Only a job that needs every browser shard and the upstream job to have succeeded may
// run the evidence stage.
export const STAGES = ['build', 'browser', 'upstream', 'evidence'];
export function parseArgs(argv) {
  const usage = () => { throw new Error('usage'); };
  const opts = {};
  for (let i = 0; i < argv.length; i += 2) {
    const [k, v] = [argv[i], argv[i + 1]];
    if (!['--stage', '--engine', '--shard', '--expect-digest'].includes(k) || v === undefined || k.slice(2) in opts) usage();
    opts[k.slice(2)] = v;
  }
  if (!Object.keys(opts).length) return { stage: 'all' };
  const { stage, engine, shard, 'expect-digest': digest } = opts;
  if (!STAGES.includes(stage)) usage();
  if (stage === 'build') return (engine || shard || digest) ? usage() : { stage };
  if (!/^[0-9a-f]{64}$/.test(digest ?? '')) usage();
  if (stage !== 'browser') return (engine || shard) ? usage() : { stage, digest };
  const m = /^([1-9]\d?)\/([1-9]\d?)$/.exec(shard ?? '');
  if (!ENGINES.includes(engine) || !m || +m[1] > +m[2]) usage();
  return { stage, digest, engine, shard: `${m[1]}/${m[2]}` };
}

// The build digest of the current output, or null when the source is not clean or the output cannot be read.
function currentBuild(root) {
  const state = sourceState(root);
  if (!state.clean) return null;
  try { return buildDigest(collectBuild(root), state.sha); } catch { return null; }
}

function main() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const fail = msg => { process.stderr.write(`verify:product: ${msg}\n`); process.exitCode = 1; };
  let args;
  try { args = parseArgs(process.argv.slice(2)); } catch { return fail('usage: [--stage build | --stage browser --engine <chromium|firefox|webkit> --shard <i>/<n> --expect-digest <sha256> | --stage upstream --expect-digest <sha256> | --stage evidence --expect-digest <sha256>]'); }
  const { stage } = args;
  const engines = stage === 'browser' ? [args.engine] : ENGINES;
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

  let tested;
  if (stage === 'all' || stage === 'build') {
    if (!step('library-build', ['--filter', '@charm-ux/velcro', 'run', 'build'])) return fail('blocked');
    // The SSG build generates the ignored route/manifest type inputs the typecheck needs.
    // The project-site build runs first: it leaves dist/static-prefixed and then the root build restores dist/static.
    // LITRO_BASE_PATH is pinned in every docs step (the browser tests mount the project build at /velcro; the root steps
    // need it empty), so a value or an empty string inherited from the caller's shell cannot change what is tested.
    if (!step('docs-build-prefixed', ['--filter', '@velcro/docs', 'run', 'build:prefixed'], { LITRO_BASE_PATH: '/velcro' })) return fail('blocked');
    // Capture the exact bytes the browser checks will test (every file of the project-site output plus its closure record).
    sources.push(sourceState(root));
    try { tested = snapshotTested(root); } catch { return fail('blocked (tested site could not be captured)'); }
    if (!step('docs-build', ['--filter', '@velcro/docs', 'run', 'build'], { LITRO_BASE_PATH: '' })) return fail('blocked');
    if (!step('docs-typecheck', ['--filter', '@velcro/docs', 'run', 'typecheck'], { LITRO_BASE_PATH: '' })) return fail('blocked');
    if (stage === 'build') {
      let after;
      try { after = snapshotTested(root); } catch { return fail('blocked (tested site could not be re-read)'); }
      if (!sameSnapshot(tested, after)) return fail('blocked (tested site changed during the build)');
      // What the later jobs test must be what this commit builds: the build may not change or add a source file.
      sources.push(sourceState(root));
      if (!sources.every(x => x.clean && x.sha === sources[0].sha)) return fail('blocked (source not clean and unchanged across the build)');
      let digest;
      try { digest = buildDigest(collectBuild(root), sources[0].sha); } catch { return fail('blocked (build output could not be read)'); }
      process.stdout.write(`verify:product: build digest ${digest}\n`);
      return;
    }
  } else {
    // A later CI stage: the build job's whole output, unchanged, on a clean checkout of the same commit, or nothing runs.
    if (!sources[0].clean) return fail('blocked (source not clean)');
    if (currentBuild(root) !== args.digest) return fail('blocked (build output differs from the build stage output)');
    try { tested = snapshotTested(root); } catch { return fail('blocked (tested site could not be captured)'); }
  }

  // When a stage ends, the tested site must still be exactly the captured bytes and, in CI, the whole build output and the
  // source must still match the build digest.
  const unchanged = () => {
    let after;
    try { after = snapshotTested(root); } catch { return false; }
    return sameSnapshot(tested, after) && (stage === 'all' || currentBuild(root) === args.digest);
  };

  if (stage === 'all' || stage === 'browser') {
    for (const engine of engines) {
      const probe = spawnSync(process.execPath, ['--input-type=module', '-e',
        `import { ${engine} } from '@playwright/test'; process.stdout.write(${engine}.executablePath())`],
      { cwd: root, encoding: 'utf8' });
      if (probe.status !== 0 || !probe.stdout || !existsSync(probe.stdout.trim())) {
        return fail(`${engine} is not installed. Run \`pnpm exec playwright install ${engines.join(' ')}\` (add \`--with-deps\` on Linux) and retry; browsers are never installed automatically.`);
      }
    }

    const reportFile = path.join(scratch, 'report.json');
    const ok = step('browser-tests', ['exec', 'playwright', 'test', '-c', 'tests/product/playwright.config.mjs',
      ...engines.map(e => `--project=${e}`), ...(args.shard ? [`--shard=${args.shard}`] : []), '--reporter=json', '--output', path.join(scratch, 'artifacts')],
    { PLAYWRIGHT_JSON_OUTPUT_NAME: reportFile, VELCRO_PRODUCT_OUT: scratch }, 30 * 60 * 1000);
    // Public, bounded and redacted; the raw log stays in ignored scratch.
    const publish = () => {
      try {
        const { lines } = summarizeReport(JSON.parse(readFileSync(reportFile, 'utf8')), { root, engines });
        for (const line of lines) process.stdout.write(`verify:product: ${line}\n`);
      } catch { process.stdout.write('verify:product: no readable report to summarize\n'); }
    };
    if (!ok) { publish(); return fail('blocked'); }
    if (!existsSync(reportFile) || statSync(reportFile).mtimeMs < startedAt) return fail('missing or stale report');
    let result;
    try { result = evaluateReport(JSON.parse(readFileSync(reportFile, 'utf8')), { startedAt, engines }); } catch { return fail('malformed report'); }
    const c = result.counts;
    if (c) {
      process.stdout.write(`verify:product: tests ${c.total}, passed ${c.passed}, failed ${c.failed}, flaky ${c.flaky}, skipped ${c.skipped}\n`);
      process.stdout.write(`verify:product: per engine ${engines.map(e => `${e} ${c.perEngine[e]}`).join(', ')}\n`);
    }
    if (!result.ok) { publish(); return fail(`blocked (${result.reason})`); }
    if (stage === 'browser') {
      if (!unchanged()) return fail('blocked (tested site changed during verification)');
      process.stdout.write(`verify:product: passed (${args.engine}, shard ${args.shard})\n`);
      return;
    }
  }
  if (stage === 'all' || stage === 'upstream') {
    // Shoelace's own test files against the built library; gated by the component records in tests/upstream/components/.
    if (!step('upstream-conformance', ['run', 'test:upstream', '--no-build'])) {
      // Public, bounded and closed-vocabulary: names are checked against the catalog and the pinned inventory first.
      try {
        const log = readFileSync(path.join(scratch, 'upstream-conformance.log'), 'utf8');
        const { lines } = summarizeUpstream(log, { inventory: readInventory(root), catalog: new Set(readCatalog(root).map(c => c.name)) });
        for (const line of lines) process.stdout.write(`verify:product: ${line}\n`);
      } catch { process.stdout.write('verify:product: no readable upstream result to summarize\n'); }
      return fail('blocked (upstream conformance differs from the component records in tests/upstream/components/)');
    }
    if (stage === 'upstream') {
      if (!unchanged()) return fail('blocked (tested site changed during verification)');
      process.stdout.write('verify:product: passed (upstream conformance)\n');
      return;
    }
  }
  // Success evidence only if the tested bytes are still exactly the captured bytes.
  if (!unchanged()) return fail('blocked (tested site changed during verification)');
  sources.push(sourceState(root));
  const evidenceOk = sources.every(x => x.clean && x.sha === sources[0].sha);
  if (evidenceOk) writeTestedEvidence(root, tested, sources[0].sha);
  if (stage === 'evidence') {
    if (!evidenceOk) return fail('blocked (source not clean and unchanged; no evidence recorded)');
    process.stdout.write('verify:product: evidence recorded for the tested site\n');
    return;
  }
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
