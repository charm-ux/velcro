import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { DOCS, PIN, RECORDS, VENDOR, checkBaseline, checkVendor, declaredTests, evaluate, keyResults, readBaseline, readInventory,
  readLedger, readRecords, readSharedPins, scoreboard, skipBinding, updateRecords, upstreamSkips, vendoredComponents }
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

// 2d4b1bf is the last main commit with tests/upstream/inventory.json and known-failures.json.
const LEGACY = '2d4b1bfc56bc521032a6d82ee5c325b9f669cd6b';

// Problems with a read of the legacy baseline. The expected component set comes from the legacy commit's own vendored test
// directories, not from what the reader returned, so a read that comes back empty or short cannot pass. The legacy
// components must all still be current; components added after the legacy commit are new relative to it and are not in it.
function legacyReadProblems(legacy, listed) {
  const problems = [];
  if (!listed.length) problems.push('no legacy component directories were listed');
  const read = Object.keys(legacy.records).sort();
  if (read.join('\n') !== [...listed].sort().join('\n')) problems.push(`the legacy read has [${read}], but the legacy commit vendors [${listed}]`);
  for (const c of listed) if (!components.includes(c)) problems.push(`${c}: a legacy component is no longer vendored`);
  problems.push(...checkBaseline(records, readSharedPins(root), legacy));
  for (const c of read) if (records[c] && JSON.stringify(legacy.records[c].files) !== JSON.stringify(records[c].files)) problems.push(`${c}: pins differ from the legacy commit's`);
  return problems;
}

const legacyListing = () => {
  const listing = spawnSync('git', ['-C', root, 'ls-tree', '-d', '--name-only', LEGACY, `${VENDOR}/src/components/`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  return listing.status === 0 ? listing.stdout.split('\n').filter(Boolean).map(p => path.basename(p)) : [];
};

test('the baseline is read from the records, or from the single inventory and ledger files before them', t => {
  const legacy = readBaseline(root, LEGACY);
  if (!legacy) return t.skip('legacy commit not available in this clone');
  assert.deepEqual(legacyReadProblems(legacy, legacyListing()), []);
  assert.equal(readBaseline(root, 'refs/heads/no-such-ref-velcro'), null);
});

test('negative control: a legacy read that comes back empty or short fails the self-test instead of passing vacuously', t => {
  const legacy = readBaseline(root, LEGACY);
  if (!legacy) return t.skip('legacy commit not available in this clone');
  const listed = legacyListing();
  assert.deepEqual(legacyReadProblems(legacy, listed), []);
  // What a missing UPSTREAM.json or inventory.json yields: no records at all.
  assert.ok(legacyReadProblems({ records: {}, shared: {} }, listed).length > 0);
  // A read that lost one component.
  const [dropped, ...rest] = Object.keys(legacy.records).sort();
  assert.ok(legacyReadProblems({ ...legacy, records: Object.fromEntries(rest.map(c => [c, legacy.records[c]])) }, listed)
    .some(p => p.includes('the legacy read has')), dropped);
  // A listing that failed is not an expected set of nothing.
  assert.ok(legacyReadProblems({ records: {}, shared: {} }, []).includes('no legacy component directories were listed'));
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
  assert.deepEqual(run('suite > x', { a: { skipped: ['suite > x'], declared: ['suite > x', 'other > x', 'y', 'extra'] } }).problems,
    ['upstream skips in a cannot be bound to the inventory', 'skipped test in a: suite > x'], 'the scan must declare exactly the inventory');
  // A scan that sees only part of the inventory binds a skip only through the per-skip identity checks (next test).
  assert.equal(run('suite > x', { a: { skipped: ['suite > x'], declared: ['suite > x', 'other > x', 'y'] } }).ok, true,
    'tests the scan cannot see do not block an unambiguous literal skip');
  // A scan with a dynamic title binds a skip only through the per-skip identity checks (next test).
  assert.equal(run('suite > x', { a: { skipped: ['suite > x'], declared: ['suite > x', 'other > x', 'y', null] } }).ok, true,
    'a dynamic title elsewhere does not block an unambiguous literal skip');
  // The real vendored files: color-picker's, icon's, radio-group's and tab-group's own it.skip are the only upstream skips.
  // Icon's and tab-group's are bound by the exact comparison; radio-group's file has dynamic titles (template-literal
  // describes) and color-picker's runs Shoelace's form-control helper tests the scan cannot see, so each of their skips is
  // bound alone.
  const real = upstreamSkips(root, components);
  assert.deepEqual(Object.keys(real), ['color-picker', 'icon', 'radio-group', 'tab-group']);
  assert.deepEqual(real['color-picker'].skipped, ['<sl-color-picker> > should emit sl-focus when rendered as a dropdown and focused']);
  assert.ok(!real['color-picker'].declared.includes(null));
  assert.ok(real['color-picker'].declared.every(t => inventory['color-picker'].includes(t)));
  assert.ok(real['color-picker'].declared.length < inventory['color-picker'].length);
  const skippedPicker = real['color-picker'].skipped[0];
  const pickerRun = evaluate(scoreboard(keyResults(inventory['color-picker'].map(t => r('color-picker', t, true, t === skippedPicker ? { skipped: true } : {})))),
    {}, { 'color-picker': inventory['color-picker'] }, ['color-picker'], { 'color-picker': real['color-picker'] });
  assert.deepEqual(pickerRun.problems, []);
  assert.deepEqual(real['tab-group'].skipped, [
    '<sl-tab-group> > scrolling behavior > does not show scroll buttons if placement is start',
    '<sl-tab-group> > scrolling behavior > does not show scroll buttons if placement is end',
    '<sl-tab-group> > scrolling behavior > does scroll on scroll button click',
  ]);
  assert.deepEqual([...real['tab-group'].declared].sort(), [...inventory['tab-group']].sort());
  assert.deepEqual(real.icon.skipped, ["<sl-icon> > svg sprite sheets > Should produce an error if the icon doesn't exist."]);
  assert.deepEqual([...real.icon.declared].sort(), [...inventory.icon].sort());
  assert.deepEqual(real['radio-group'].skipped, ['when the value changes > should sync up radios and radio buttons if defined after radio group']);
  assert.ok(real['radio-group'].declared.includes(null));
  const skippedGroup = real['radio-group'].skipped[0];
  const groupRun = evaluate(scoreboard(keyResults(inventory['radio-group'].map(t => r('radio-group', t, true, t === skippedGroup ? { skipped: true } : {})))),
    {}, { 'radio-group': inventory['radio-group'] }, ['radio-group'], { 'radio-group': real['radio-group'] });
  assert.deepEqual(groupRun.problems, []);
});

test('with dynamic titles in the scan, or a scan that sees only part of the inventory, a skip binds only when its identity is literal, unique and inventoried', () => {
  // The inventory holds the runner's titles, including tests the scan cannot name (dynamic titles, recorded as null)
  // and tests it cannot see at all (generated by a helper outside the vendored file).
  const inventory = { a: ['suite > x', 'suite > y', 'generated > g1', 'generated > g2'], b: ['z'] };
  const run = (skippedTitles, skips, inv = inventory) => {
    const skipped = new Set([skippedTitles].flat());
    const results = inv.a.map(t => r('a', t.replace(/ \[#\d+\]$/, ''), true, skipped.has(t) ? { skipped: true } : {}));
    return evaluate(scoreboard(keyResults([...results, r('b', 'z', true)])), {}, inv, ['a', 'b'], skips);
  };
  const dyn = (skipped, declared = ['suite > x', 'suite > y', null]) => ({ a: { skipped, declared } });
  const unbound = (...titles) => ['upstream skips in a cannot be bound to the inventory', ...titles.map(t => `skipped test in a: ${t}`)];
  assert.equal(run('suite > x', dyn(['suite > x'])).ok, true, 'an unambiguous literal skip binds');
  assert.deepEqual(run('suite > x', {}).problems, ['skipped test in a: suite > x'], 'still only upstream skips');

  // (1) Every literal title of the scan is in the inventory.
  assert.deepEqual(run('suite > x', dyn(['suite > x'], ['suite > x', 'suite > y', 'suite > extra', null])).problems, unbound('suite > x'));

  // (2) The skipped title appears exactly once in the whole inventory (a generated test of the same name is reported as
  // its [#2] occurrence) and exactly once in the vendored file; a skipped title missing from the inventory fails too.
  const repeated = { ...inventory, a: [...inventory.a, 'suite > x [#2]'] };
  assert.deepEqual(run('suite > x', dyn(['suite > x']), repeated).problems, unbound('suite > x'));
  assert.deepEqual(run('suite > x [#2]', dyn(['suite > x [#2]'], ['suite > x', 'suite > x [#2]', 'suite > y', null]), repeated).problems,
    unbound('suite > x [#2]'));
  assert.deepEqual(run('suite > x', dyn(['suite > x'], ['suite > x', 'suite > x', 'suite > y', null])).problems, unbound('suite > x'));
  assert.equal(run('suite > x', dyn(['suite > x', 'suite > gone'], ['suite > x', 'suite > y', 'suite > gone', null])).ok, false);

  // (3) The run's skipped set equals the bound set exactly: a bound skip that ran instead, or another skipped test, fails.
  assert.deepEqual(run([], dyn(['suite > x'])).problems, ['upstream skip not reported skipped in a: suite > x']);
  assert.deepEqual(run(['suite > x', 'suite > y'], dyn(['suite > x'])).problems, ['skipped test in a: suite > y']);
  assert.deepEqual(run(['suite > x', 'generated > g1'], dyn(['suite > x'])).problems, ['skipped test in a: generated > g1']);

  // (4) A skip with a generated or template title (null in the scan) never binds.
  assert.deepEqual(run('suite > x', dyn([null, 'suite > x'])).problems, unbound('suite > x'));
  assert.deepEqual(run('generated > g1', dyn([null])).problems, unbound('generated > g1'));

  // (5) A scan without dynamic titles that sees only part of the inventory (tests a helper outside the file generates)
  // binds through the same per-skip checks: the skip must be reported, and a literal title outside the inventory still
  // fails. A scan that declares exactly the inventory keeps the exact comparison: an exactly bound skip that ran is not
  // reported.
  assert.equal(run('suite > x', dyn(['suite > x'], ['suite > x', 'suite > y'])).ok, true);
  assert.deepEqual(run([], dyn(['suite > x'], ['suite > x', 'suite > y'])).problems, ['upstream skip not reported skipped in a: suite > x']);
  assert.deepEqual(run('suite > x', dyn(['suite > x'], ['suite > x', 'suite > extra'])).problems, unbound('suite > x'));
  assert.deepEqual(run('generated > g1', dyn(['suite > x'], ['suite > x', 'suite > y'])).problems,
    ['skipped test in a: generated > g1', 'upstream skip not reported skipped in a: suite > x']);
  // Partial means every literal title of the scan is inventoried: a shorter scan with a literal outside the inventory
  // does not bind.
  assert.deepEqual(run('suite > x', dyn(['suite > x'], ['suite > x', 'suite > extra'])).problems, unbound('suite > x'));
  assert.equal(skipBinding({ skipped: ['suite > x'], declared: ['suite > x', 'suite > extra'] }, inventory.a), 'unbound');
  assert.equal(skipBinding({ skipped: ['suite > x'], declared: ['suite > x', 'suite > y'] }, inventory.a), 'per-skip');

  // (6) A skip binds only to a title the scan itself saw marked it.skip, never to a test reachable only through a shared
  // helper (here 'generated > g1', which a helper such as Shoelace's runFormControlBaseTests would add): the scan does not
  // declare it, so naming it as a skip does not bind, and a helper test reported skipped fails even beside a bound skip.
  const partialScan = ['suite > x', 'suite > y'];
  assert.equal(skipBinding({ skipped: ['generated > g1'], declared: partialScan }, inventory.a), 'unbound');
  assert.deepEqual(run('generated > g1', dyn(['generated > g1'], partialScan)).problems, unbound('generated > g1'));
  assert.deepEqual(run('generated > g1', dyn(['suite > x', 'generated > g1'], partialScan)).problems, unbound('generated > g1'));
  assert.deepEqual(run(['suite > x', 'generated > g2'], dyn(['suite > x'], partialScan)).problems, ['skipped test in a: generated > g2']);
  // A helper test with the same title as the scan's skip is reported as its [#2] occurrence, which makes the skip ambiguous.
  const helperTwin = { ...inventory, a: [...inventory.a, 'suite > x [#2]'] };
  assert.deepEqual(run('suite > x', dyn(['suite > x'], partialScan), helperTwin).problems, unbound('suite > x'));
  assert.equal(run([], dyn(['suite > x'], inventory.a)).ok, true);
  assert.equal(run('suite > x', dyn(['suite > x'], inventory.a)).ok, true);
});

// Before this change a scan without dynamic titles that saw only part of the inventory never bound its skips; the
// partial-scan rule must change that outcome for color-picker only. Carousel is listed because it is a candidate for the
// same helper pattern; it binds nothing while it has no vendored file or no it.skip.
test('the partial-scan rule changes no binding outcome except color-picker\'s', () => {
  const real = upstreamSkips(root, components);
  const before = (bound, expected) => {
    const now = skipBinding(bound, expected);
    return now === 'per-skip' && !bound.declared.includes(null) ? 'unbound' : now;
  };
  const table = when => Object.fromEntries(components.filter(c => inventory[c]).map(c => [c, when(real[c], inventory[c])]));
  const was = table(before);
  const is = table(skipBinding);
  assert.deepEqual(Object.keys(is).filter(c => is[c] !== was[c]), ['color-picker']);
  assert.deepEqual([was['color-picker'], is['color-picker']], ['unbound', 'per-skip']);
  const named = ['icon', 'radio-group', 'tab-group', 'carousel'];
  assert.deepEqual(Object.fromEntries(named.map(c => [c, [was[c] ?? 'none', is[c] ?? 'none']])), {
    icon: ['exact', 'exact'],
    'radio-group': ['per-skip', 'per-skip'],
    'tab-group': ['exact', 'exact'],
    carousel: [was.carousel ?? 'none', was.carousel ?? 'none'],
  });
  assert.equal(is.carousel ?? 'none', 'none');
  for (const c of Object.keys(is).filter(c => !['color-picker', 'icon', 'radio-group', 'tab-group'].includes(c))) {
    assert.equal(is[c], 'none', `${c} has no upstream skip`);
  }
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
