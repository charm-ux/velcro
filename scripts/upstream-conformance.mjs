// Runs Shoelace 2.20.1's own test files (tests/upstream/shoelace-2.20.1, vendored unmodified) against Velcro in Chromium.
// Writes a machine-readable scoreboard under ignored .airig/upstream/, regenerates docs/conformance.md with --write-docs,
// and gates the result against tests/upstream/known-failures.json: any failure not in the ledger fails, and so does any
// ledgered test that now passes (the ledger may only shrink). Raw runner output stays in the ignored scratch folder.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const VENDOR = 'tests/upstream/shoelace-2.20.1';
export const LEDGER = 'tests/upstream/known-failures.json';
export const DOCS = 'docs/conformance.md';

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}

// Returns a list of problems: vendored files must match the recorded upstream hashes exactly, with nothing extra or missing.
export function checkVendor(root) {
  const base = path.join(root, VENDOR);
  const manifest = JSON.parse(readFileSync(path.join(base, 'UPSTREAM.json'), 'utf8'));
  const problems = [];
  if (manifest.version !== '2.20.1' || manifest.commit !== 'fb59fda70ed737c92611051b49bc7e3a5fed5dc5') problems.push('pin changed');
  const actual = walk(base).map(f => path.relative(base, f).split(path.sep).join('/')).filter(f => f !== 'UPSTREAM.json').sort();
  const expected = Object.keys(manifest.files).sort();
  if (actual.join('\n') !== expected.join('\n')) problems.push('vendored file set differs from UPSTREAM.json');
  for (const f of expected) {
    const file = path.join(base, f);
    if (!existsSync(file)) continue;
    const hash = createHash('sha256').update(readFileSync(file)).digest('hex');
    if (hash !== manifest.files[f]) problems.push(`modified: ${f}`);
  }
  return problems;
}

// Repeated titles within a component (shared helper suites registered after an await have no suite path) get an
// occurrence suffix so every test has a stable, unique key.
export function keyResults(results) {
  const seen = new Map();
  return results.map(r => {
    const k = `${r.component}\u0000${r.title}`;
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    return { ...r, title: n === 1 ? r.title : `${r.title} [#${n}]` };
  });
}

export function scoreboard(results) {
  const board = {};
  for (const r of results) {
    const c = (board[r.component] ??= { passed: 0, failed: 0, skipped: 0, failures: [] });
    if (r.skipped) c.skipped++;
    else if (r.passed) c.passed++;
    else { c.failed++; c.failures.push({ title: r.title, reason: r.reason ?? '' }); }
  }
  return Object.fromEntries(Object.keys(board).sort().map(k => [k, board[k]]));
}

// Compares a run with the ledger. Returns { ok, unexpected, fixed, problems }.
export function evaluate(board, ledger, components) {
  const problems = [];
  const unexpected = [];
  const fixed = [];
  if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) return { ok: false, unexpected, fixed, problems: ['malformed ledger'] };
  for (const [component, entries] of Object.entries(ledger)) {
    if (!components.includes(component)) problems.push(`ledger names unknown component ${component}`);
    if (!Array.isArray(entries)) { problems.push(`malformed ledger entry for ${component}`); continue; }
    for (const e of entries) {
      if (!e || typeof e.title !== 'string' || typeof e.reason !== 'string' || !e.reason.trim()) problems.push(`malformed ledger entry for ${component}`);
    }
  }
  for (const component of components) {
    const result = board[component];
    if (!result || result.passed + result.failed === 0) { problems.push(`no results for ${component}`); continue; }
    if (result.skipped) problems.push(`skipped tests in ${component}`);
    const known = new Set((Array.isArray(ledger[component]) ? ledger[component] : []).map(e => e.title));
    const failing = new Set(result.failures.map(f => f.title));
    for (const f of result.failures) if (!known.has(f.title)) unexpected.push(`${component}: ${f.title}`);
    for (const t of known) if (!failing.has(t)) fixed.push(`${component}: ${t}`);
  }
  return { ok: !problems.length && !unexpected.length && !fixed.length, unexpected, fixed, problems };
}

export function renderDocs(board, ledger) {
  const total = Object.values(board).reduce((a, c) => ({ passed: a.passed + c.passed, failed: a.failed + c.failed }), { passed: 0, failed: 0 });
  const lines = [
    '# Shoelace conformance',
    '',
    'Velcro runs Shoelace 2.20.1\'s own component test files, vendored unmodified in',
    `\`${VENDOR}/\` (upstream commit \`fb59fda70ed737c92611051b49bc7e3a5fed5dc5\`, MIT), against`,
    'Velcro\'s components in Chromium. A resolver plugin points each test\'s Shoelace import at Velcro\'s',
    'registering entry for that component; no test is edited or skipped. Run it with `pnpm test:upstream`.',
    '',
    'Every failing test is listed in `tests/upstream/known-failures.json` with a one-line reason. The',
    '`verify:product` gate fails on any failure that is not in that ledger and on any ledgered test that now',
    'passes, so the ledger can only shrink. This page is regenerated by `pnpm test:upstream -- --write-docs`.',
    '',
    'Shoelace 2.20.1 ships no test file for resize-observer, so it has no row here.',
    '',
    `Totals: ${total.passed + total.failed} tests, ${total.passed} passed, ${total.failed} failed.`,
    '',
    '| Component | Tests | Passed | Failed |',
    '| --- | ---: | ---: | ---: |',
    ...Object.entries(board).map(([c, r]) => `| ${c} | ${r.passed + r.failed} | ${r.passed} | ${r.failed} |`),
    '',
    '## Failing tests',
    ''
  ];
  for (const [c, r] of Object.entries(board)) {
    if (!r.failed) continue;
    lines.push(`### ${c}`, '');
    const reasons = new Map((ledger?.[c] ?? []).map(e => [e.title, e.reason]));
    for (const f of r.failures) lines.push(`- ${f.title.replaceAll('|', '\\|')}: ${(reasons.get(f.title) ?? f.reason).replaceAll('|', '\\|')}`);
    lines.push('');
  }
  lines.push('Harness notes: the runner page loads Velcro\'s light theme where upstream loads Shoelace\'s, uses upstream\'s',
    'mocha settings (3 s timeout, one retry), and adds two guards so one failure cannot discard a whole file\'s',
    'results: real form submission and navigation by `form.submit()` are suppressed, and an assertion that carries a',
    'sinon spy is reported instead of crashing the runner. Neither guard can turn a failing assertion into a pass.', '');
  return lines.join('\n');
}

function main() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const args = new Set(process.argv.slice(2));
  const say = m => process.stdout.write(`test:upstream: ${m}\n`);
  const fail = m => { process.stderr.write(`test:upstream: ${m}\n`); process.exitCode = 1; };
  const vendorProblems = checkVendor(root);
  if (vendorProblems.length) return fail(`vendored upstream files changed (${vendorProblems.join('; ')})`);
  const ignored = spawnSync('git', ['-C', root, 'check-ignore', '-q', '--', '.airig/upstream/evidence'], { stdio: 'pipe' });
  if (ignored.status !== 0) return fail('scratch not ignored');
  mkdirSync(path.join(root, '.airig/upstream'), { recursive: true, mode: 0o700 });
  const scratch = mkdtempSync(path.join(root, '.airig/upstream/run-'));
  const run = (label, file, argv, env = {}) => {
    const r = spawnSync(file, argv, { cwd: root, env: { ...process.env, ...env }, encoding: 'utf8', timeout: 900000,
      maxBuffer: 64 * 1024 * 1024, shell: false });
    writeFileSync(path.join(scratch, `${label}.log`), `${r.stdout ?? ''}${r.stderr ?? ''}`, { mode: 0o600 });
    return r;
  };
  if (!args.has('--no-build')) {
    const b = run('library-build', 'pnpm', ['--filter', '@charm-ux/velcro', 'run', 'build']);
    if (b.status !== 0) return fail('library build failed; evidence retained in ignored scratch');
  }
  const json = path.join(scratch, 'results.json');
  const startedAt = Date.now();
  const r = run('web-test-runner', 'pnpm', ['exec', 'web-test-runner', '--config', 'tests/upstream/web-test-runner.config.mjs'],
    { VELCRO_UPSTREAM_JSON: json });
  if (r.error || r.signal) return fail('runner did not complete; evidence retained in ignored scratch');
  if (!existsSync(json) || statSync(json).mtimeMs < startedAt) return fail('missing or stale results');
  const components = readdirSync(path.join(root, VENDOR, 'src/components')).sort();
  const board = scoreboard(keyResults(JSON.parse(readFileSync(json, 'utf8'))));
  writeFileSync(path.join(root, '.airig/upstream/scoreboard.json'), `${JSON.stringify(board, null, 2)}\n`, { mode: 0o600 });
  const ledgerFile = path.join(root, LEDGER);
  if (args.has('--write-ledger')) {
    const ledger = Object.fromEntries(Object.entries(board).filter(([, b]) => b.failed)
      .map(([c, b]) => [c, b.failures.map(f => ({ title: f.title, reason: f.reason || 'fails' }))]));
    writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  }
  const ledger = JSON.parse(readFileSync(ledgerFile, 'utf8'));
  if (args.has('--write-docs')) writeFileSync(path.join(root, DOCS), renderDocs(board, ledger));
  let passed = 0, failed = 0;
  for (const [c, b] of Object.entries(board)) { passed += b.passed; failed += b.failed; say(`${c} ${b.passed} passed, ${b.failed} failed`); }
  say(`total ${passed + failed}, passed ${passed}, failed ${failed}; scoreboard in ignored .airig/upstream/`);
  const result = evaluate(board, ledger, components);
  for (const p of result.problems) say(`problem: ${p}`);
  for (const u of result.unexpected) say(`unexpected failure: ${u}`);
  for (const f of result.fixed) say(`now passes, remove from ledger: ${f}`);
  if (!result.ok) return fail('blocked (results differ from tests/upstream/known-failures.json)');
  say('passed (every failure is ledgered and every ledgered test still fails)');
}

if (import.meta.main) {
  try {
    main();
  } catch {
    process.stderr.write('test:upstream: blocked; unexpected internal failure (details withheld)\n');
    process.exitCode = 1;
  }
}
