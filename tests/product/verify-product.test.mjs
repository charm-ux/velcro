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
function fixture(setup) {
  const dir = mkdtempSync(path.join(tmpdir(), 'velcro-vp-'));
  mkdirSync(path.join(dir, 'scripts'));
  mkdirSync(path.join(dir, 'bin'));
  copyFileSync(path.join(realRoot, 'scripts/verify-product.mjs'), path.join(dir, 'scripts/verify-product.mjs'));
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ packageManager: 'pnpm@9.15.9' }));
  writeFileSync(path.join(dir, '.gitignore'), '.airig/\n');
  spawnSync('git', ['init', '-q'], { cwd: dir });
  // Fake pnpm: reports the pinned version; other behavior is supplied per case.
  writeFileSync(path.join(dir, 'bin/pnpm'), '#!/bin/sh\nif [ "$1" = "--version" ]; then echo 9.15.9; fi\n' + (setup?.shim ?? ''), { mode: 0o755 });
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
function runCli(dir, expectFail = true) {
  const r = spawnSync(process.execPath, [path.join(dir, 'scripts/verify-product.mjs')], {
    cwd: dir, encoding: 'utf8', timeout: 60000,
    env: { ...process.env, PATH: `${path.join(dir, 'bin')}${path.delimiter}${process.env.PATH}` },
  });
  const out = `${r.stdout}${r.stderr}`;
  if (expectFail) assert.notEqual(r.status, 0, out); else assert.equal(r.status, 0, out);
  assert.doesNotMatch(out, new RegExp(dir.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'path leaked');
  assert.doesNotMatch(out, /\n\s+at |Error:|ENOENT|EACCES|ENOTDIR|SyntaxError|JSON|\/(Users|home|var|tmp|private)\//, 'raw error leaked');
  assert.doesNotMatch(out, new RegExp(SENTINEL));
  return out;
}
const INTERNAL = /^verify:product: blocked; unexpected internal failure \(details withheld\)\n$/;
const REPORT = /^(verify:product: (library-build|docs-typecheck|docs-build|browser-tests) passed\n){4}verify:product: malformed report\n$/;
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
  *"@velcro/docs run build"*) echo build >> calls.log; touch generated.marker ;;
  *"@velcro/docs run typecheck"*) echo typecheck >> calls.log; [ -f generated.marker ] || exit 1 ;;
  *"exec playwright"*) echo browser >> calls.log
    node -e 'const t=[];for(let i=0;i<8;i++)t.push({projectName:"chromium",status:"expected",results:[{status:"passed"}]});
      require("fs").writeFileSync(process.env.PLAYWRIGHT_JSON_OUTPUT_NAME,JSON.stringify({errors:[],suites:[{specs:t.map(x=>({tests:[x]}))}],
      stats:{startTime:new Date().toISOString(),expected:8,unexpected:0,flaky:0,skipped:0}}))' ;;
esac
`;

test('CLI runs library build, docs build, typecheck, then browser; real positive fixture succeeds', () => {
  const dir = fixture({ prepare: stubPlaywright, shim: orderShim });
  try {
    const out = runCli(dir, false);
    assert.deepEqual(readFileSync(path.join(dir, 'calls.log'), 'utf8').trim().split('\n'),
      ['library', 'build', 'typecheck', 'browser']);
    assert.match(out, /tests 8, passed 8, failed 0, flaky 0, skipped 0\nverify:product: passed \(Chromium only\)\n$/);
  } finally { cleanup(dir); }
});

test('CLI stops before typecheck when the docs build fails', () => {
  const dir = fixture({ prepare: stubPlaywright, shim: orderShim.replace('touch generated.marker', 'exit 1') });
  try {
    runCli(dir);
    assert.deepEqual(readFileSync(path.join(dir, 'calls.log'), 'utf8').trim().split('\n'), ['library', 'build']);
  } finally { cleanup(dir); }
});
