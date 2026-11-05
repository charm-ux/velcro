import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateReport } from '../../scripts/verify-product.mjs';

const startedAt = Date.parse('2026-01-01T00:00:00Z');
const mk = (n = 8, over = {}) => ({
  stats: { startTime: '2026-01-01T00:00:01Z', expected: n, unexpected: 0, flaky: 0, skipped: 0 },
  errors: [],
  suites: [{ specs: Array.from({ length: n }, () => ({ tests: [{ projectName: 'chromium', status: 'expected', results: [{ status: 'passed' }] }] })) }],
  ...over,
});
const ev = r => evaluateReport(r, { startedAt });

test('accepts a fresh all-passing Chromium run of at least eight tests', () => {
  assert.equal(ev(mk(8)).ok, true);
  assert.equal(ev(mk(9)).ok, true);
});

test('rejects empty, short, stale, malformed, failing, flaky and skipped reports', () => {
  assert.equal(ev(mk(0)).ok, false);
  assert.equal(ev(mk(7)).ok, false);
  assert.equal(evaluateReport(mk(8), { startedAt: Date.parse('2026-01-02T00:00:00Z') }).ok, false);
  for (const bad of [null, [], {}, { stats: {} }, 'x', mk(8, { suites: 'no' })]) assert.equal(ev(bad).ok, false);
  assert.equal(ev(mk(8, { errors: [{}] })).ok, false);
  for (const k of ['unexpected', 'flaky', 'skipped']) {
    const r = mk(8); r.stats[k] = 1; assert.equal(ev(r).ok, false, k);
  }
  const r = mk(8); r.suites[0].specs[0].tests[0].status = 'skipped'; assert.equal(ev(r).ok, false);
  const f = mk(8); f.suites[0].specs[0].tests[0].projectName = 'firefox'; assert.equal(ev(f).ok, false);
  const t = mk(8); t.suites[0].specs[0].tests[0].results.push({ status: 'passed' }); assert.equal(ev(t).ok, false);
  const s = mk(8); delete s.stats.startTime; assert.equal(ev(s).ok, false);
});

test('report must carry the expected errors array and config forbids focused tests', () => {
  const r = mk(8); delete r.errors; assert.equal(ev(r).ok, false);
  assert.equal(ev(mk(8, { errors: 'none' })).ok, false);
  const config = readFileSync(new URL('./playwright.config.mjs', import.meta.url), 'utf8');
  assert.match(config, /forbidOnly: true/);
});

// Subprocess negative controls against a throwaway fixture root (copy of the CLI).
const realRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const SENTINEL = 'sentinel-private-value';
// The fake project-site build leaves a small output tree and its closure record, as the real one does.
const PREFIXED_BUILD = `case "$*" in *"@velcro/docs run build:prefixed"*)
  mkdir -p packages/docs/dist/static-prefixed/_litro packages/docs/dist/closure
  echo '<p>page</p>' > packages/docs/dist/static-prefixed/index.html
  echo 'export {}' > packages/docs/dist/static-prefixed/_litro/app.js
  echo '{"schema":1}' > packages/docs/dist/closure/client-closure-velcro.json ;;
esac
`;
function fixture(setup) {
  const dir = mkdtempSync(path.join(tmpdir(), 'velcro-vp-'));
  mkdirSync(path.join(dir, 'scripts'));
  mkdirSync(path.join(dir, 'bin'));
  copyFileSync(path.join(realRoot, 'scripts/verify-product.mjs'), path.join(dir, 'scripts/verify-product.mjs'));
  mkdirSync(path.join(dir, 'scripts/site'));
  copyFileSync(path.join(realRoot, 'scripts/site/tested.mjs'), path.join(dir, 'scripts/site/tested.mjs'));
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ packageManager: 'pnpm@9.15.9' }));
  writeFileSync(path.join(dir, '.gitignore'), '.airig/\nnode_modules/\ncalls.log\n*.marker\npackages/docs/dist/\n');
  spawnSync('git', ['init', '-q'], { cwd: dir });
  // Fake pnpm: reports the pinned version; other behavior is supplied per case.
  writeFileSync(path.join(dir, 'bin/pnpm'), '#!/bin/sh\nif [ "$1" = "--version" ]; then echo 9.15.9; fi\n' + PREFIXED_BUILD + (setup?.shim ?? ''), { mode: 0o755 });
  setup?.prepare?.(dir);
  return dir;
}
// Hermetic stand-in: the report cases must not need an installed browser.
function stubPlaywright(dir) {
  const pkg = path.join(dir, 'node_modules/@playwright/test');
  mkdirSync(pkg, { recursive: true });
  writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: '@playwright/test', type: 'module', exports: './index.js' }));
  writeFileSync(path.join(pkg, 'index.js'), 'export const chromium = { executablePath: () => process.execPath };\n');
}
function runCli(dir, expectFail = true, extraEnv = {}) {
  const r = spawnSync(process.execPath, [path.join(dir, 'scripts/verify-product.mjs')], {
    cwd: dir, encoding: 'utf8', timeout: 60000,
    env: { ...process.env, ...extraEnv, PATH: `${path.join(dir, 'bin')}${path.delimiter}${process.env.PATH}` },
  });
  const out = `${r.stdout}${r.stderr}`;
  if (expectFail) assert.notEqual(r.status, 0, out); else assert.equal(r.status, 0, out);
  assert.doesNotMatch(out, new RegExp(dir.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'path leaked');
  assert.doesNotMatch(out, /\n\s+at |Error:|ENOENT|EACCES|ENOTDIR|SyntaxError|JSON|\/(Users|home|var|tmp|private)\//, 'raw error leaked');
  assert.doesNotMatch(out, new RegExp(SENTINEL));
  return out;
}
const INTERNAL = /^verify:product: blocked; unexpected internal failure \(details withheld\)\n$/;
const REPORT = /^(verify:product: (library-build|docs-build-prefixed|docs-typecheck|docs-build|browser-tests) passed\n){5}verify:product: malformed report\n$/;
const cleanup = dir => { try { chmodSync(path.join(dir, '.airig'), 0o700); } catch {} rmSync(dir, { recursive: true, force: true }); };
function negative(name, setup, expected) {
  test(`CLI fails safely: ${name}`, () => {
    const dir = fixture(setup);
    try {
      const out = runCli(dir);
      if (expected) assert.match(out, expected);
    } finally { cleanup(dir); }
  });
}

negative('scratch parent is a file', { prepare: d => writeFileSync(path.join(d, '.airig'), SENTINEL) }, INTERNAL);
negative('manifest is malformed', { prepare: d => writeFileSync(path.join(d, 'package.json'), `{ ${SENTINEL}`) }, INTERNAL);
negative('manifest is missing', { prepare: d => rmSync(path.join(d, 'package.json')) }, INTERNAL);
negative('manifest is unreadable', { prepare: d => chmodSync(path.join(d, 'package.json'), 0o000) }, INTERNAL);
negative('private log cannot be written', {
  shim: `if [ "$1" = "--version" ]; then chmod 500 .airig/product/run-*; fi\necho ${SENTINEL} >&2\n`,
}, INTERNAL);
negative('browser report is unreadable', {
  prepare: d => stubPlaywright(d),
  shim: `if [ "$1" = exec ]; then echo ${SENTINEL} > "$PLAYWRIGHT_JSON_OUTPUT_NAME"; chmod 000 "$PLAYWRIGHT_JSON_OUTPUT_NAME"; fi\n`,
}, REPORT);
negative('browser report is malformed', {
  prepare: d => stubPlaywright(d),
  shim: `if [ "$1" = exec ]; then echo '{ ${SENTINEL}' > "$PLAYWRIGHT_JSON_OUTPUT_NAME"; fi\n`,
}, REPORT);

// Orchestration order: fake docs typecheck fails until a prior fake docs build left its marker.
const orderShim = `case "$*" in
  *"@charm-ux/velcro run build"*) echo library >> calls.log ;;
  *"@velcro/docs run build:prefixed"*) echo "prefixed LITRO_BASE_PATH=[$LITRO_BASE_PATH]" >> calls.log; touch prefixed.marker ;;
  *"@velcro/docs run build"*) echo "build LITRO_BASE_PATH=[$LITRO_BASE_PATH]" >> calls.log; [ -f prefixed.marker ] || exit 1; touch generated.marker ;;
  *"@velcro/docs run typecheck"*) echo "typecheck LITRO_BASE_PATH=[$LITRO_BASE_PATH]" >> calls.log; [ -f generated.marker ] || exit 1 ;;
  *"run test:upstream --no-build"*) echo upstream >> calls.log; [ -z "$UPSTREAM_FAIL" ] || exit 1 ;;
  *"exec playwright"*) echo browser >> calls.log
    node -e 'const t=[];for(let i=0;i<8;i++)t.push({projectName:"chromium",status:"expected",results:[{status:"passed"}]});
      require("fs").writeFileSync(process.env.PLAYWRIGHT_JSON_OUTPUT_NAME,JSON.stringify({errors:[],suites:[{specs:t.map(x=>({tests:[x]}))}],
      stats:{startTime:new Date().toISOString(),expected:8,unexpected:0,flaky:0,skipped:0}}))' ;;
esac
`;

// The prefixed build must be the project build (pinned /velcro) and run before the root build and typecheck (both pinned
// empty), whatever LITRO_BASE_PATH the caller's shell already has.
for (const [label, inherited] of [['unset', {}], ['empty', { LITRO_BASE_PATH: '' }], ['another prefix', { LITRO_BASE_PATH: '/other' }]]) {
  test(`CLI runs library build, prefixed then root docs builds with pinned base paths, typecheck, then browser (inherited LITRO_BASE_PATH: ${label})`, () => {
    const dir = fixture({ prepare: stubPlaywright, shim: orderShim });
    try {
      const out = runCli(dir, false, inherited);
      assert.deepEqual(readFileSync(path.join(dir, 'calls.log'), 'utf8').trim().split('\n'),
        ['library', 'prefixed LITRO_BASE_PATH=[/velcro]', 'build LITRO_BASE_PATH=[]', 'typecheck LITRO_BASE_PATH=[]', 'browser', 'upstream']);
      assert.match(out, /tests 8, passed 8, failed 0, flaky 0, skipped 0\nverify:product: upstream-conformance passed\nverify:product: passed \(Chromium only\)\n/);
    } finally { cleanup(dir); }
  });
}

test('CLI fails without evidence when the upstream conformance gate fails', () => {
  const dir = fixture({ prepare: d => { stubPlaywright(d); gitInit(d); }, shim: orderShim });
  try {
    const out = runCli(dir, true, { UPSTREAM_FAIL: '1' });
    assert.match(out, /upstream-conformance failed/);
    assert.doesNotMatch(out, /verify:product: passed/);
    assert.throws(() => readFileSync(path.join(dir, EVIDENCE)), /ENOENT/);
  } finally { cleanup(dir); }
});

test('CLI stops before typecheck when the docs build fails', () => {
  const dir = fixture({ prepare: stubPlaywright, shim: orderShim.replace('touch generated.marker', 'exit 1') });
  try {
    runCli(dir);
    assert.deepEqual(readFileSync(path.join(dir, 'calls.log'), 'utf8').trim().split('\n'), ['library', 'prefixed LITRO_BASE_PATH=[/velcro]', 'build LITRO_BASE_PATH=[]']);
  } finally { cleanup(dir); }
});

// --- tested-bytes evidence -----------------------------------------------------------------------------------------------
const EVIDENCE = '.airig/product/tested-prefixed.json';
const gitInit = dir => {
  writeFileSync(path.join(dir, 'tracked.txt'), 'original\n');
  const g = (...a) => spawnSync('git', ['-C', dir, '-c', 'user.name=t', '-c', `user.email=${['t', 'users.noreply.github.com'].join('@')}`, ...a]);
  g('add', '-A'); g('commit', '-qm', 'x');
};
test('a fully passing run leaves evidence of exactly the tested files and closure, bound to the commit', () => {
  const dir = fixture({ prepare: d => { stubPlaywright(d); gitInit(d); }, shim: orderShim });
  try {
    runCli(dir, false);
    const ev = JSON.parse(readFileSync(path.join(dir, EVIDENCE), 'utf8'));
    assert.equal(ev.status, 'passed');
    assert.equal(ev.base, '/velcro');
    assert.equal(ev.cleanSource, true);
    assert.match(ev.sourceSha, /^[0-9a-f]{40}$/);
    assert.deepEqual(ev.files.map(f => f.rel), ['_litro/app.js', 'index.html']);
    assert.match(ev.closureSha256, /^[0-9a-f]{64}$/);
  } finally { cleanup(dir); }
});

test('stale evidence is invalidated before a run and none exists after a failed run', () => {
  for (const shim of [orderShim.replace('echo browser >> calls.log', 'echo browser >> calls.log; exit 1'), orderShim.replace('touch generated.marker', 'exit 1')]) {
    const dir = fixture({ prepare: d => { stubPlaywright(d); mkdirSync(path.join(d, '.airig/product'), { recursive: true }); writeFileSync(path.join(d, EVIDENCE), '{"stale":true}'); }, shim });
    try {
      runCli(dir);
      assert.throws(() => readFileSync(path.join(dir, EVIDENCE)), /ENOENT/);
    } finally { cleanup(dir); }
  }
});

test('a tested asset or HTML file changed during the browser checks fails the run and leaves no evidence', () => {
  for (const target of ['packages/docs/dist/static-prefixed/_litro/app.js', 'packages/docs/dist/static-prefixed/index.html']) {
    const dir = fixture({ prepare: d => { stubPlaywright(d); gitInit(d); }, shim: orderShim.replace('echo browser >> calls.log', `echo browser >> calls.log; echo changed >> ${target}`) });
    try {
      const out = runCli(dir);
      assert.match(out, /blocked \(tested site changed during verification\)/);
      assert.throws(() => readFileSync(path.join(dir, EVIDENCE)), /ENOENT/);
    } finally { cleanup(dir); }
  }
});

test('a missing project-site output or closure record stops the run before the browser', () => {
  const dir = fixture({ prepare: stubPlaywright, shim: orderShim.replace('touch prefixed.marker', 'touch prefixed.marker; rm -rf packages/docs/dist') });
  try {
    const out = runCli(dir);
    assert.match(out, /blocked \(tested site could not be captured\)/);
    assert.doesNotMatch(readFileSync(path.join(dir, 'calls.log'), 'utf8'), /browser/);
  } finally { cleanup(dir); }
});

test('source that was dirty at any boundary leaves no publication evidence, even if reverted before the end (the run itself still passes)', () => {
  const cases = {
    'tracked file changed during the build, restored before the browser checks': {
      shim: orderShim.replace('touch prefixed.marker', 'touch prefixed.marker; echo dirty > tracked.txt').replace('echo browser >> calls.log', 'echo browser >> calls.log; echo original > tracked.txt'),
    },
    'tracked file changed before the run, restored during the browser checks': {
      shim: orderShim.replace('echo browser >> calls.log', 'echo browser >> calls.log; echo original > tracked.txt'),
      dirty: d => writeFileSync(path.join(d, 'tracked.txt'), 'dirty\n'),
    },
    'untracked non-ignored source present at the start': { shim: orderShim, dirty: d => writeFileSync(path.join(d, 'extra-source.ts'), 'x\n') },
    'untracked source added during the browser checks': { shim: orderShim.replace('echo browser >> calls.log', 'echo browser >> calls.log; echo x > late-source.ts') },
  };
  for (const [label, c] of Object.entries(cases)) {
    const dir = fixture({ prepare: d => { stubPlaywright(d); gitInit(d); c.dirty?.(d); }, shim: c.shim });
    try {
      const out = runCli(dir, false);
      assert.match(out, /verify:product: passed \(Chromium only\)\nverify:product: note: source was not clean and unchanged at every boundary; no publication evidence recorded\n$/, label);
      assert.throws(() => readFileSync(path.join(dir, EVIDENCE)), /ENOENT/, label);
    } finally { cleanup(dir); }
  }
});

test('ignored build output does not make the source dirty, and a run outside a git commit leaves no evidence', () => {
  const clean = fixture({ prepare: d => { stubPlaywright(d); gitInit(d); }, shim: orderShim });
  try {
    runCli(clean, false);
    assert.ok(readFileSync(path.join(clean, EVIDENCE), 'utf8').includes('"cleanSource":true'));
  } finally { cleanup(clean); }
  const none = fixture({ prepare: stubPlaywright, shim: orderShim });
  try {
    runCli(none, false);
    assert.throws(() => readFileSync(path.join(none, EVIDENCE)), /ENOENT/);
  } finally { cleanup(none); }
});
