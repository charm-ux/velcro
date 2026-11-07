import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { DOCS, PIN, RECORDS, VENDOR, checkBaseline, checkVendor, declaredTests, evaluate, keyResults, readBaseline, readInventory,
  readLedger, readRecords, readSharedPins, scoreboard, updateRecords, upstreamSkips, vendoredComponents }
  from '../../scripts/upstream-conformance.mjs';
import { readCatalog } from '../../scripts/site/catalog.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const components = vendoredComponents(root);
const records = readRecords(root);
const ledger = readLedger(root);
const inventory = readInventory(root);

test('vendored Shoelace test files are byte-identical to the pinned upstream files', () => {
  assert.deepEqual(checkVendor(root), []);
  const manifest = JSON.parse(readFileSync(new URL(`../../${VENDOR}/UPSTREAM.json`, import.meta.url), 'utf8'));
  assert.equal(manifest.commit, PIN.commit);
  assert.equal(PIN.commit, 'fb59fda70ed737c92611051b49bc7e3a5fed5dc5');
  assert.ok(manifest.files['LICENSE.md']);
  assert.ok(!Object.keys(manifest.files).some(f => f.startsWith('src/components/')), 'component test files are pinned in their records');
  for (const c of components) assert.ok(records[c].files[`src/components/${c}/${c}.test.ts`], c);
});

test('the vendor check fails on an edited, extra or unpinned file, a foreign pin and a conflicting pin', () => {
  const scratch = mkdtempSync(path.join(tmpdir(), 'velcro-upstream-'));
  try {
    const copy = () => {
      rmSync(path.join(scratch, 'tests'), { recursive: true, force: true });
      cpSync(path.join(root, 'tests/upstream'), path.join(scratch, 'tests/upstream'), { recursive: true });
    };
    const record = name => path.join(scratch, RECORDS, `${name}.json`);
    const edit = (name, change) => {
      const value = JSON.parse(readFileSync(record(name), 'utf8'));
      change(value);
      writeFileSync(record(name), JSON.stringify(value));
    };
    copy();
    assert.deepEqual(checkVendor(scratch), []);
    writeFileSync(path.join(scratch, VENDOR, 'src/components/badge/badge.test.ts'), '// edited\n', { flag: 'a' });
    assert.deepEqual(checkVendor(scratch), ['modified: src/components/badge/badge.test.ts']);
    copy();
    writeFileSync(path.join(scratch, VENDOR, 'src/components/badge/extra.ts'), '');
    assert.deepEqual(checkVendor(scratch), ['vendored file set differs from the pinned hashes']);
    copy();
    rmSync(record('badge'));
    assert.deepEqual(checkVendor(scratch), ['no record for badge', 'vendored file set differs from the pinned hashes']);
    copy();
    writeFileSync(record('nope'), '{"files":{}}');
    assert.deepEqual(checkVendor(scratch), ['record without a vendored component: nope']);
    copy();
    edit('badge', v => { v.files['src/components/card/card.test.ts'] = records.card.files['src/components/card/card.test.ts']; });
    assert.deepEqual(checkVendor(scratch), ["record for badge pins another component's file"]);
    copy();
    edit('badge', v => { v.files['LICENSE.md'] = '0'.repeat(64); });
    assert.deepEqual(checkVendor(scratch), ['conflicting pins: LICENSE.md', 'modified: LICENSE.md']);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test('every vendored component is a catalog component with a registering entry', () => {
  const pkg = JSON.parse(readFileSync(new URL('../../packages/velcro/package.json', import.meta.url), 'utf8'));
  const names = readCatalog(root).map(c => c.name);
  for (const c of components) {
    assert.ok(names.includes(c), c);
    assert.ok(pkg.exports[`./${c}`], c);
  }
});

test('records are well formed: known failures name inventory titles with a one-line reason', () => {
  assert.deepEqual(Object.keys(records), components);
  for (const [c, record] of Object.entries(records)) {
    assert.deepEqual(Object.keys(record), ['files', 'tests', 'knownFailures'], c);
    const entries = record.knownFailures;
    assert.ok(Array.isArray(entries), c);
    assert.equal(new Set(entries.map(e => e.title)).size, entries.length, `duplicate titles in ${c}`);
    for (const e of entries) {
      assert.ok(e.title && e.reason.trim() && !e.reason.includes('\n'), `${c}: ${e.title}`);
      assert.ok(record.tests.includes(e.title), `${c}: ${e.title}`);
    }
  }
  const docs = readFileSync(new URL(`../../${DOCS}`, import.meta.url), 'utf8');
  assert.match(docs, /tests\/upstream\/components\/<name>\.json/);
  assert.doesNotMatch(docs, /^\| [a-z-]+ \| \d/m, 'the conformance page carries no per-component table');
});

test('each inventory is unique and lists every test its vendored file declares with a literal title', () => {
  assert.deepEqual(Object.keys(inventory).sort(), components);
  for (const [c, titles] of Object.entries(inventory)) {
    assert.ok(titles.length > 0, c);
    assert.equal(new Set(titles).size, titles.length, c);
    const source = readFileSync(path.join(root, VENDOR, 'src/components', c, `${c}.test.ts`), 'utf8');
    const seen = new Map();
    for (const { title } of declaredTests(source)) {
      if (title === null) continue;
      const n = (seen.get(title) ?? 0) + 1;
      seen.set(title, n);
      const key = n === 1 ? title : `${title} [#${n}]`;
      assert.ok(titles.includes(key), `${c}: declared test missing from the inventory: ${key}`);
    }
  }
});

// The literal-title scan cannot see generated titles (template literals, loops, the shared form-control helper), so the
// inventory is also held to the baseline (the merge base with origin/main): while a component's vendored files are
// unchanged, its inventory may not change and its known failures may only shrink.
const baseRecords = readBaseline(root);

test('the records equal the baseline\'s wherever the vendored files are unchanged', () => {
  assert.ok(baseRecords, 'origin/main is required for the inventory baseline (fetch it)');
  assert.deepEqual(checkBaseline(records, readSharedPins(root), baseRecords), []);
});

test('the baseline is read from the records, or from the single inventory and ledger files before them', t => {
  // 2d4b1bf is the last main commit with tests/upstream/inventory.json and known-failures.json.
  const legacy = readBaseline(root, '2d4b1bfc56bc521032a6d82ee5c325b9f669cd6b');
  if (!legacy) return t.skip('legacy commit not available in this clone');
  // The legacy commit has the components that existed then; later components are new relative to it and are not in it.
  const legacyComponents = Object.keys(legacy.records).sort();
  assert.deepEqual(legacyComponents, components.filter(c => legacyComponents.includes(c)));
  assert.deepEqual(checkBaseline(records, readSharedPins(root), legacy), []);
  for (const c of legacyComponents) assert.deepEqual(legacy.records[c].files, records[c].files, c);
  assert.equal(readBaseline(root, 'refs/heads/no-such-ref-velcro'), null);
});

test('negative control: a run that stops generating tests cannot regenerate a shorter inventory past the gates', () => {
  // badge's vendored file generates part of its suite from a loop with a template-literal title.
  const c = 'badge';
  const source = readFileSync(path.join(root, VENDOR, 'src/components', c, `${c}.test.ts`), 'utf8');
  const literal = new Set(declaredTests(source).map(d => d.title).filter(Boolean));
  const generated = records[c].tests.filter(t => !literal.has(t));
  assert.ok(generated.length >= 5, 'badge has generated tests');
  // The run reports every literal test and none of the generated ones.
  const board = { [c]: { titles: records[c].tests.filter(t => literal.has(t)), failures: [] } };
  // 1. The writer refuses to drop the titles.
  const refused = updateRecords(records, board, components, { inventory: true });
  assert.deepEqual(refused.problems, [`${c}: the run would remove ${generated.length} inventory title(s), e.g. ${generated[0]}`]);
  // 2. Forced, the shortened inventory agrees with the shortened run and passes the literal-title check, but the
  //    baseline check blocks it because badge.test.ts did not change.
  const forced = updateRecords(records, board, components, { inventory: true, allowRemoval: true });
  assert.deepEqual(forced.problems, []);
  const shortened = { ...records, ...forced.records };
  assert.deepEqual(checkBaseline(shortened, readSharedPins(root), baseRecords),
    [`${c}: test inventory differs from the baseline although its vendored files are unchanged`]);
  // 3. Changing the pinned test file (re-vendoring) is what lifts the constraint for that component.
  const revendored = { ...shortened, [c]: { ...shortened[c], files: { [`src/components/${c}/${c}.test.ts`]: 'f'.repeat(64) } } };
  assert.deepEqual(checkBaseline(revendored, readSharedPins(root), baseRecords), []);
});

test('the baseline check fails on an added known failure, a removed record and a missing baseline', () => {
  const failing = { ...records, card: { ...records.card, knownFailures: [{ title: records.card.tests[0], reason: 'regressed' }] } };
  assert.deepEqual(checkBaseline(failing, readSharedPins(root), baseRecords), [`card: known failure added: ${records.card.tests[0]}`]);
  const { card, ...withoutCard } = records;
  assert.ok(card);
  assert.deepEqual(checkBaseline(withoutCard, readSharedPins(root), baseRecords), ['card: record removed']);
  // A changed shared helper may change any generated suite, so it lifts the constraint for every component.
  const shared = { ...readSharedPins(root), 'LICENSE.md': '0'.repeat(64) };
  assert.deepEqual(checkBaseline(failing, shared, baseRecords), []);
  assert.deepEqual(checkBaseline(records, readSharedPins(root), null), ['no baseline (fetch origin/main)']);
  // The writer only removes with the flag, and writes known failures as reported.
  const board = { card: { titles: records.card.tests, failures: [{ title: records.card.tests[0], reason: '' }] } };
  assert.deepEqual(updateRecords(records, board, components, { ledger: true }).records.card.knownFailures,
    [{ title: records.card.tests[0], reason: 'fails' }]);
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

test('a skip passes only when the vendored upstream file itself marks that exact test it.skip', () => {
  const nested = { a: ['suite > x', 'other > x', 'y', 'y [#2]'], b: ['z'] };
  const run = (skippedTitle, skips) => {
    const results = nested.a.map(t => r('a', t.replace(/ \[#\d+\]$/, ''), true, t === skippedTitle ? { skipped: true } : {}));
    return evaluate(scoreboard(keyResults([...results, r('b', 'z', true)])), {}, nested, ['a', 'b'], skips);
  };
  const bound = skipped => ({ a: { skipped, declared: nested.a } });
  assert.equal(run('suite > x', bound(['suite > x'])).ok, true);
  assert.deepEqual(run('suite > x', {}).problems, ['skipped test in a: suite > x']);
  assert.equal(run('suite > x', { b: { skipped: ['suite > x'], declared: ['z'] } }).ok, false, 'another component does not cover it');
  assert.equal(run('other > x', bound(['suite > x'])).ok, false, 'the same title in another suite is a different test');
  assert.equal(run('y [#2]', bound(['y'])).ok, false, 'a repeated title is bound to its occurrence');
  assert.equal(run('y [#2]', bound(['y [#2]'])).ok, true);
  assert.deepEqual(run('suite > x', { a: { skipped: ['suite > x'], declared: ['suite > x', 'other > x', 'y'] } }).problems,
    ['upstream skips in a cannot be bound to the inventory', 'skipped test in a: suite > x'], 'the scan must declare exactly the inventory');
  assert.equal(run('suite > x', { a: { skipped: ['suite > x'], declared: ['suite > x', 'other > x', 'y', null] } }).ok, false, 'a dynamic title fails closed');
  // The real vendored files: icon's own it.skip is the only upstream skip, bound to its full identity.
  const real = upstreamSkips(root, components);
  assert.deepEqual(Object.keys(real), ['icon']);
  assert.deepEqual(real.icon.skipped, ["<sl-icon> > svg sprite sheets > Should produce an error if the icon doesn't exist."]);
  assert.deepEqual([...real.icon.declared].sort(), [...inventory.icon].sort());
});

test('the declaration scan follows describe nesting and ignores comments, strings and dynamic titles', () => {
  const src = `
    // it('commented out', () => {});
    describe('outer', () => {
      const s = '} it("in a string") {';
      /* describe('in a comment', () => { */
      it('a', () => { if (x) { y(); } });
      describe("inner \\" quoted", async () => {
        it.skip('b', () => {});
        it(\`c\`, () => {});
      });
      it(\`d \${n}\`, () => {});
      it.only('e', () => {});
      notit('f', () => {});
    });
    it('top', () => {});`;
  assert.deepEqual(declaredTests(src), [
    { title: 'outer > a', skip: false },
    { title: 'outer > inner " quoted > b', skip: true },
    { title: 'outer > inner " quoted > c', skip: false },
    { title: null, skip: false },
    { title: 'outer > e', skip: false },
    { title: 'top', skip: false },
  ]);
});

test('repeated titles get stable occurrence suffixes', () => {
  const keyed = keyResults([r('a', 't', true), r('a', 't', false), r('b', 't', true)]);
  assert.deepEqual(keyed.map(k => k.title), ['t', 't [#2]', 't']);
});
