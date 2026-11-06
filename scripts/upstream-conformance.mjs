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
export const INVENTORY = 'tests/upstream/inventory.json';

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
    const c = (board[r.component] ??= { passed: 0, failed: 0, skipped: 0, skips: [], failures: [], titles: [], infrastructure: [] });
    if (r.infrastructure) { c.infrastructure.push(r.reason ?? r.title); continue; }
    c.titles.push(r.title);
    if (r.skipped) { c.skipped++; c.skips.push(r.title); }
    else if (r.passed) c.passed++;
    else { c.failed++; c.failures.push({ title: r.title, reason: r.reason ?? '' }); }
  }
  return Object.fromEntries(Object.keys(board).sort().map(k => [k, board[k]]));
}

// Reads a string literal starting at `i`. Returns { value, end }; value is null for a template literal with `${`.
function readString(src, i) {
  const quote = src[i];
  let value = '';
  let dynamic = false;
  for (let j = i + 1; j < src.length; j++) {
    const ch = src[j];
    if (ch === '\\') { value += src[j + 1]; j++; continue; }
    if (ch === quote) return { value: dynamic ? null : value, end: j + 1 };
    if (quote === '`' && ch === '$' && src[j + 1] === '{') {
      dynamic = true;
      let depth = 0;
      for (j += 1; j < src.length; j++) {
        if (src[j] === '{') depth++;
        else if (src[j] === '}' && --depth === 0) break;
      }
      continue;
    }
    value += ch;
  }
  throw new Error('upstream-conformance: unterminated string in a vendored test file');
}

// Every `it(...)` / `it.skip(...)` in a test file, in declaration order, with its full title (the enclosing describe
// titles and its own, joined with ' > ' as the runner reports them; null when any of them is not a plain literal) and
// whether it is skipped. A small scanner, not a parser: callers must check the result against the inventory.
export function declaredTests(src) {
  const tests = [];
  const stack = [];
  let depth = 0;
  let pending;
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '/' && src[i + 1] === '/') { const n = src.indexOf('\n', i); i = n < 0 ? src.length : n; continue; }
    if (ch === '/' && src[i + 1] === '*') { const n = src.indexOf('*/', i + 2); i = n < 0 ? src.length : n + 2; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { i = readString(src, i).end; continue; }
    if (ch === '{') {
      depth++;
      if (pending !== undefined) { stack.push({ title: pending, depth }); pending = undefined; }
      i++;
      continue;
    }
    if (ch === '}') {
      if (stack.length && stack.at(-1).depth === depth) stack.pop();
      depth--;
      i++;
      continue;
    }
    const call = /^(describe|it)(\.skip|\.only)?\s*\(\s*/.exec(src.slice(i, i + 64));
    if (call && !/[\w$.]/.test(src[i - 1] ?? '')) {
      const at = i + call[0].length;
      const literal = /['"`]/.test(src[at]) ? readString(src, at) : { value: null, end: at };
      if (call[1] === 'describe') pending = literal.value;
      else {
        const parts = [...stack.map(s => s.title), literal.value];
        tests.push({ title: parts.includes(null) ? null : parts.join(' > '), skip: call[2] === '.skip' });
      }
      i = literal.end;
      continue;
    }
    i++;
  }
  return tests;
}

// The tests that upstream itself marks `it.skip(...)` in a vendored (hash-pinned) test file, per component, as full
// runner identities (suite path, and the [#n] suffix of a repeated title), with every declared identity so the caller
// can check the scan against the inventory. Only these may be reported as skipped: Velcro never skips a test, and
// editing a vendored file breaks its pinned hash.
export function upstreamSkips(root, components) {
  const skips = {};
  for (const name of components) {
    const file = path.join(root, VENDOR, 'src/components', name, `${name}.test.ts`);
    if (!existsSync(file)) continue;
    const seen = new Map();
    const declared = declaredTests(readFileSync(file, 'utf8')).map(t => {
      if (t.title === null) return t;
      const n = (seen.get(t.title) ?? 0) + 1;
      seen.set(t.title, n);
      return { ...t, title: n === 1 ? t.title : `${t.title} [#${n}]` };
    });
    if (declared.some(t => t.skip)) {
      skips[name] = { skipped: declared.filter(t => t.skip).map(t => t.title), declared: declared.map(t => t.title) };
    }
  }
  return skips;
}

const malformedList = (value, ok) => !value || typeof value !== 'object' || Array.isArray(value)
  || Object.values(value).some(v => !Array.isArray(v) || !v.every(ok));

// Compares a run with the pinned inventory and the ledger. Returns { ok, unexpected, fixed, problems }.
// The inventory lists every expected test title per component (repeated titles carry their [#n] suffix): any missing or
// extra outcome fails, infrastructure (load/session) failures always fail and can never be ledgered, and only assertion
// failures of inventoried tests may be ledgered. A skipped outcome fails unless upstream itself skips that exact test
// (`skips`, from upstreamSkips: full identity, suite path and occurrence included), and only when the scan of that
// vendored file declares exactly the inventoried tests, so the skip is bound to the right one.
export function evaluate(board, ledger, inventory, components, skips = {}) {
  const problems = [];
  const unexpected = [];
  const fixed = [];
  if (malformedList(ledger, e => e && typeof e.title === 'string' && typeof e.reason === 'string' && e.reason.trim())) {
    return { ok: false, unexpected, fixed, problems: ['malformed ledger'] };
  }
  if (malformedList(inventory, t => typeof t === 'string')) return { ok: false, unexpected, fixed, problems: ['malformed inventory'] };
  const names = [...new Set([...components, ...Object.keys(inventory), ...Object.keys(board), ...Object.keys(ledger)])].sort();
  for (const component of names) {
    if (!components.includes(component)) { problems.push(`unknown component ${component}`); continue; }
    const expected = inventory[component];
    if (!expected?.length) { problems.push(`no inventory for ${component}`); continue; }
    if (new Set(expected).size !== expected.length) problems.push(`duplicate inventory titles in ${component}`);
    const result = board[component];
    if (!result) { problems.push(`no results for ${component}`); continue; }
    for (const reason of result.infrastructure) problems.push(`infrastructure failure in ${component}: ${reason}`);
    const bound = skips[component];
    const boundOk = bound && bound.declared.length === expected.length && !bound.declared.includes(null)
      && [...bound.declared].sort().every((t, n) => t === [...expected].sort()[n]);
    if (bound && !boundOk) problems.push(`upstream skips in ${component} cannot be bound to the inventory`);
    const allowed = new Set(boundOk ? bound.skipped : []);
    for (const t of result.skips ?? []) {
      if (!allowed.has(t)) problems.push(`skipped test in ${component}: ${t}`);
    }
    if (result.skipped !== (result.skips?.length ?? 0)) problems.push(`skipped tests in ${component}`);
    const want = new Set(expected);
    const seen = new Set();
    for (const t of result.titles) {
      if (seen.has(t)) problems.push(`duplicate outcome in ${component}: ${t}`);
      seen.add(t);
      if (!want.has(t)) problems.push(`outcome not in inventory for ${component}: ${t}`);
    }
    for (const t of expected) if (!seen.has(t)) problems.push(`missing outcome for ${component}: ${t}`);
    const entries = ledger[component] ?? [];
    for (const e of entries) if (!want.has(e.title)) problems.push(`ledger title not in inventory for ${component}: ${e.title}`);
    const known = new Set(entries.map(e => e.title));
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
    'registering entry for that component; no test is edited, and Velcro skips none. A test that upstream itself',
    'marks `it.skip` in its vendored file is reported as skipped, and the gate allows only those (listed below).',
    'Run it with `pnpm test:upstream`.',
    '',
    'The complete pinned list of expected tests per component (repeated titles carry a `[#n]` suffix) is',
    '`tests/upstream/inventory.json`; a run must report exactly those outcomes, with nothing missing or extra.',
    'Every failing test is listed in `tests/upstream/known-failures.json` with a one-line reason. The',
    '`verify:product` gate fails on any missing or extra outcome, on any load or session (infrastructure) failure,',
    'which can never be ledgered, on any failure that is not in the ledger and on any ledgered test that now',
    'passes, so the ledger can only shrink. This page is regenerated by `pnpm test:upstream -- --write-docs`.',
    '',
    'The gate covers Chromium only. The runner config takes a browser list (`VELCRO_UPSTREAM_BROWSERS`) so a',
    'later Firefox and WebKit lane can reuse it.',
    '',
    'Shoelace 2.20.1 ships no test file for resize-observer, so it has no row here.',
    '',
    `Totals: ${total.passed + total.failed} tests, ${total.passed} passed, ${total.failed} failed.`,
    '',
    '| Component | Tests | Passed | Failed |',
    '| --- | ---: | ---: | ---: |',
    ...Object.entries(board).map(([c, r]) => `| ${c} | ${r.passed + r.failed} | ${r.passed} | ${r.failed} |`),
    '',
    ...(Object.values(board).some(r => r.skipped) ? [
      '## Skipped upstream', '',
      'Skipped in the vendored upstream file itself (`it.skip`), not counted above:', '',
      ...Object.entries(board).flatMap(([c, r]) => (r.skips ?? []).map(t => `- ${c}: \`${t}\``)),
      ''] : []),
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
    'sinon spy is reported instead of crashing the runner. Neither guard can turn a failing assertion into a pass.',
    'Upstream\'s icon sprite sheet tests load `/docs/assets/images/sprite.svg`, which Shoelace\'s docs build generates',
    'from Bootstrap Icons; the runner serves that one path from the same Bootstrap Icons sprite that Velcro\'s docs',
    'site ships (`packages/docs/public/assets/images/sprite.svg`).', '',
    '## Dependency note: inflation override', '',
    'The test runner\'s dev server pulls in `inflation` through `co-body` (range `^2.0.0`). The root `package.json`',
    'pins it to 2.0.0 with a pnpm override because the published integrity hash of 2.1.0 is falsely reported by',
    'the repository privacy scanner (an opaque base64 hash, not workstation data; the same value appears in',
    'Shoelace\'s own lockfile). This is an interim workaround: it affects development and test tooling only, not',
    'Velcro\'s package dependencies, but it holds back normal updates of that package. The intended fix is a narrow',
    'scanner change that recognizes validated lockfile integrity fields, which needs separate human review as a',
    'protected change; remove the override once that lands.', '');
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
  const summary = Object.fromEntries(Object.entries(board).map(([c, { titles, ...rest }]) => [c, rest]));
  writeFileSync(path.join(root, '.airig/upstream/scoreboard.json'), `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 });
  const ledgerFile = path.join(root, LEDGER);
  if (args.has('--write-ledger')) {
    const ledger = Object.fromEntries(Object.entries(board).filter(([, b]) => b.failed)
      .map(([c, b]) => [c, b.failures.map(f => ({ title: f.title, reason: f.reason || 'fails' }))]));
    writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  }
  const inventoryFile = path.join(root, INVENTORY);
  if (args.has('--write-inventory')) {
    if (Object.values(board).some(b => b.infrastructure.length)) return fail('refusing to write an inventory from a run with infrastructure failures');
    writeFileSync(inventoryFile, `${JSON.stringify(Object.fromEntries(Object.entries(board).map(([c, b]) => [c, b.titles])), null, 2)}\n`);
  }
  const ledger = JSON.parse(readFileSync(ledgerFile, 'utf8'));
  const inventory = JSON.parse(readFileSync(inventoryFile, 'utf8'));
  if (args.has('--write-docs')) writeFileSync(path.join(root, DOCS), renderDocs(board, ledger));
  let passed = 0, failed = 0;
  for (const [c, b] of Object.entries(board)) { passed += b.passed; failed += b.failed; say(`${c} ${b.passed} passed, ${b.failed} failed`); }
  say(`total ${passed + failed}, passed ${passed}, failed ${failed}; scoreboard in ignored .airig/upstream/`);
  const result = evaluate(board, ledger, inventory, components, upstreamSkips(root, components));
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
