import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { DOCS, LEDGER, VENDOR, checkVendor, evaluate, keyResults, scoreboard } from '../../scripts/upstream-conformance.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const components = readdirSync(new URL(`../../${VENDOR}/src/components/`, import.meta.url)).sort();
const ledger = JSON.parse(readFileSync(new URL(`../../${LEDGER}`, import.meta.url), 'utf8'));

test('vendored Shoelace test files are byte-identical to the pinned upstream files', () => {
  assert.deepEqual(checkVendor(root), []);
  const manifest = JSON.parse(readFileSync(new URL(`../../${VENDOR}/UPSTREAM.json`, import.meta.url), 'utf8'));
  assert.equal(manifest.commit, 'fb59fda70ed737c92611051b49bc7e3a5fed5dc5');
  for (const c of components) assert.ok(manifest.files[`src/components/${c}/${c}.test.ts`], c);
  assert.ok(manifest.files['LICENSE.md']);
});

test('every vendored component has a Velcro registering entry', () => {
  const pkg = JSON.parse(readFileSync(new URL('../../packages/velcro/package.json', import.meta.url), 'utf8'));
  for (const c of components) assert.ok(pkg.exports[`./${c}`], c);
});

test('the ledger names known components with a title and a one-line reason per entry, and docs list them', () => {
  const docs = readFileSync(new URL(`../../${DOCS}`, import.meta.url), 'utf8');
  for (const [c, entries] of Object.entries(ledger)) {
    assert.ok(components.includes(c), c);
    assert.equal(new Set(entries.map(e => e.title)).size, entries.length, `duplicate titles in ${c}`);
    for (const e of entries) {
      assert.ok(e.title && e.reason.trim() && !e.reason.includes('\n'), `${c}: ${e.title}`);
      assert.ok(docs.includes(e.title.replaceAll('|', '\\|')), `docs miss ${c}: ${e.title}`);
    }
  }
});

const r = (component, title, passed, extra = {}) => ({ component, title, passed, skipped: false, ...extra });

test('gate passes only when failures equal the ledger exactly', () => {
  const board = scoreboard(keyResults([r('a', 'x', true), r('a', 'y', false, { reason: 'boom' }), r('b', 'z', true)]));
  const led = { a: [{ title: 'y', reason: 'known' }] };
  assert.equal(evaluate(board, led, ['a', 'b']).ok, true);
  // A new failure that is not ledgered.
  const worse = scoreboard(keyResults([r('a', 'x', false), r('a', 'y', false), r('b', 'z', true)]));
  assert.deepEqual(evaluate(worse, led, ['a', 'b']).unexpected, ['a: x']);
  // A ledgered test that now passes must be removed from the ledger.
  const better = scoreboard(keyResults([r('a', 'x', true), r('a', 'y', true), r('b', 'z', true)]));
  assert.deepEqual(evaluate(better, led, ['a', 'b']).fixed, ['a: y']);
});

test('gate fails on missing components, skips, unknown or malformed ledger entries', () => {
  const board = scoreboard(keyResults([r('a', 'x', true)]));
  assert.equal(evaluate(board, {}, ['a', 'b']).ok, false);
  assert.equal(evaluate(scoreboard([r('a', 'x', true, { skipped: true }), r('a', 'w', true)]), {}, ['a']).ok, false);
  assert.equal(evaluate(board, { c: [] }, ['a']).ok, false);
  assert.equal(evaluate(board, { a: [{ title: 'q' }] }, ['a']).ok, false);
  for (const bad of [null, [], 'x']) assert.equal(evaluate(board, bad, ['a']).ok, false);
});

test('repeated titles get stable occurrence suffixes', () => {
  const keyed = keyResults([r('a', 't', true), r('a', 't', false), r('b', 't', true)]);
  assert.deepEqual(keyed.map(k => k.title), ['t', 't [#2]', 't']);
});
