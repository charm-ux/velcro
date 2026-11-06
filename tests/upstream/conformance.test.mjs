import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { DOCS, INVENTORY, LEDGER, VENDOR, checkVendor, evaluate, keyResults, scoreboard } from '../../scripts/upstream-conformance.mjs';

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

const inventory = JSON.parse(readFileSync(new URL(`../../${INVENTORY}`, import.meta.url), 'utf8'));

test('the pinned inventory covers every vendored component, is unique, and contains every ledgered title', () => {
  assert.deepEqual(Object.keys(inventory).sort(), components);
  assert.equal(Object.values(inventory).flat().length, 277);
  for (const [c, titles] of Object.entries(inventory)) {
    assert.equal(new Set(titles).size, titles.length, c);
    for (const e of ledger[c] ?? []) assert.ok(titles.includes(e.title), `${c}: ${e.title}`);
  }
});

const r = (component, title, passed, extra = {}) => ({ component, title, passed, skipped: false, ...extra });

const inv = { a: ['x', 'y', 'w'], b: ['z'] };
const led = { a: [{ title: 'y', reason: 'known' }] };
const baseline = () => [r('a', 'x', true), r('a', 'y', false, { reason: 'boom' }), r('a', 'w', true), r('b', 'z', true)];
const gate = (results, ledgerArg = led, inventoryArg = inv) => evaluate(scoreboard(keyResults(results)), ledgerArg, inventoryArg, ['a', 'b']);

test('gate passes only when outcomes equal the inventory and failures equal the ledger exactly', () => {
  assert.equal(gate(baseline()).ok, true);
  const worse = baseline(); worse[0] = r('a', 'x', false);
  assert.deepEqual(gate(worse).unexpected, ['a: x']);
  const better = baseline(); better[1] = r('a', 'y', true);
  assert.deepEqual(gate(better).fixed, ['a: y']);
});

test('negative control: dropping one passing outcome fails although the component still has other results', () => {
  const dropped = baseline().filter(t => t.title !== 'w');
  const result = gate(dropped);
  assert.equal(result.ok, false);
  assert.deepEqual(result.problems, ['missing outcome for a: w']);
});

test('gate fails on extra or duplicated outcomes and on infrastructure failures, which cannot be ledgered', () => {
  assert.equal(gate([...baseline(), r('a', 'new', true)]).ok, false);
  const dup = scoreboard(baseline()); dup.a.titles.push('x');
  assert.equal(evaluate(dup, led, inv, ['a', 'b']).ok, false);
  const infra = [...baseline(), r('b', '(session error)', false, { infrastructure: true, reason: 'load failed' })];
  assert.match(gate(infra).problems.join('\n'), /infrastructure failure in b/);
  assert.equal(gate(infra, { ...led, b: [{ title: '(session error)', reason: 'x' }] }).ok, false);
});

test('gate fails on missing components, skips, unknown or malformed ledger and inventory entries', () => {
  assert.equal(gate(baseline().filter(t => t.component !== 'b')).ok, false);
  const skipped = baseline(); skipped[0] = r('a', 'x', true, { skipped: true });
  assert.equal(gate(skipped).ok, false);
  assert.equal(gate(baseline(), { ...led, c: [] }).ok, false);
  assert.equal(gate(baseline(), { a: [{ title: 'y' }] }).ok, false);
  assert.equal(gate(baseline(), { a: [{ title: 'nope', reason: 'r' }, { title: 'y', reason: 'k' }] }).ok, false);
  for (const bad of [null, [], 'x']) {
    assert.equal(gate(baseline(), bad).ok, false);
    assert.equal(gate(baseline(), led, bad).ok, false);
  }
  assert.equal(gate(baseline(), led, { a: ['x', 'y', 'w'] }).ok, false);
});

test('repeated titles get stable occurrence suffixes', () => {
  const keyed = keyResults([r('a', 't', true), r('a', 't', false), r('b', 't', true)]);
  assert.deepEqual(keyed.map(k => k.title), ['t', 't [#2]', 't']);
});
