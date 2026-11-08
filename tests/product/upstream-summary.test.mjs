import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { readCatalog } from '../../scripts/site/catalog.mjs';
import { evaluate, readInventory, resultLines, vendoredComponents } from '../../scripts/upstream-conformance.mjs';
import { BLOCKED, MAX_FINDINGS, OUTCOMES, PROBLEMS, summarizeUpstream } from '../../scripts/upstream-summary.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const inventory = { alpha: ['<sl-alpha> > one', '<sl-alpha> > two', '<sl-alpha> > three'], beta: ['<sl-beta> > only'] };
const catalog = new Set(['alpha', 'beta']);
const log = lines => lines.map(l => `test:upstream: ${l}`).join('\n');
const summarize = (lines, over = {}) => summarizeUpstream(log(lines), { inventory, catalog, ...over });
// Synthetic sensitive strings are built at run time, never committed whole.
const secret = () => ['gh', 'p_'].join('') + 'a'.repeat(36);
const absolute = () => ['', 'Users', 'someone', 'project', 'file.mjs'].join('/');

test('upstream summary: the lines the gate prints for real evaluate() results map to the fixed outcome words', () => {
  const board = {
    alpha: { passed: 1, failed: 1, skipped: 1, skips: ['<sl-alpha> > two'], failures: [{ title: '<sl-alpha> > one', reason: '' }],
      titles: ['<sl-alpha> > one', '<sl-alpha> > two', '<sl-alpha> > extra', '<sl-alpha> > extra'], infrastructure: [] },
    beta: { passed: 0, failed: 0, skipped: 0, skips: [], failures: [], titles: [], infrastructure: ['page error'] },
  };
  const result = evaluate(board, { alpha: [{ title: '<sl-alpha> > three', reason: 'x' }] }, inventory, ['alpha', 'beta']);
  const { lines } = summarizeUpstream(log(resultLines(result)), { inventory, catalog });
  assert.deepEqual(lines, [
    'upstream problem infrastructure: beta',
    'upstream failed: alpha: <sl-alpha> > one',
    'upstream unexpected: alpha: unlisted title', // outcome not in the inventory
    'upstream unexpected: alpha: unlisted title', // the same title reported twice
    'upstream unexpected: alpha: unlisted title',
    'upstream unexpected: alpha: <sl-alpha> > three', // a known failure that now passes
    'upstream missing: alpha: <sl-alpha> > three',
    'upstream missing: beta: <sl-beta> > only',
    'upstream skipped-mismatch: alpha: <sl-alpha> > two',
  ]);
});

test('upstream summary: every outcome, problem and blocked word is from the fixed lists and the source still prints what is matched', () => {
  const lines = summarize([
    'problem: skipped tests in alpha', 'problem: upstream skips in alpha cannot be bound to the inventory', 'problem: no results for beta',
    'problem: no inventory for alpha', 'problem: alpha: record removed', 'problem: something new', 'problem: no baseline (fetch origin/main)',
    'unexpected failure: alpha: <sl-alpha> > one',
  ]).lines;
  for (const l of lines) {
    const m = /^upstream (?:(failed|unexpected|missing|skipped-mismatch): |problem ([a-z-]+): |blocked: ([a-z-]+)$)/.exec(l);
    assert.ok(m, l);
    if (m[1]) assert.ok(OUTCOMES.includes(m[1]));
    if (m[2]) assert.ok(PROBLEMS.includes(m[2]));
    if (m[3]) assert.ok(BLOCKED.includes(m[3]));
  }
  assert.deepEqual(lines, [
    'upstream blocked: internal', // 'something new' and 'no baseline' match no row; one word covers both
    'upstream problem no-results: beta', 'upstream problem records: alpha', 'upstream problem records: alpha',
    'upstream failed: alpha: <sl-alpha> > one', 'upstream skipped-mismatch: alpha: unlisted title', 'upstream skipped-mismatch: alpha: unlisted title',
  ]);
  // The blocked words come from the script's own fixed failure messages; keep them in step with the script.
  const source = readFileSync(new URL('../../scripts/upstream-conformance.mjs', import.meta.url), 'utf8');
  const messages = { 'vendor-changed': 'vendored upstream files changed', scratch: 'scratch not ignored', 'library-build': 'library build failed',
    'runner-incomplete': 'runner did not complete', 'results-missing': 'missing or stale results',
    'records-drift': 'blocked (the component records differ from the baseline', 'results-differ': 'blocked (results differ from the component records',
    internal: 'blocked; unexpected internal failure' };
  assert.deepEqual(Object.keys(messages).sort(), [...BLOCKED].sort());
  for (const [word, text] of Object.entries(messages)) {
    assert.ok(source.includes(text), `${word}: the script no longer prints "${text}"`);
    assert.deepEqual(summarizeUpstream(`test:upstream: ${text} (details)`, { inventory, catalog }).lines, [`upstream blocked: ${word}`]);
  }
});

test('upstream summary: at most 20 finding lines, then a +N more count', () => {
  const many = Array.from({ length: 57 }, () => 'problem: missing outcome for alpha: <sl-alpha> > one');
  const { lines, findings } = summarize([...many, 'total 100, passed 43, failed 57; scoreboard in ignored .airig/upstream/']);
  assert.equal(findings, 57);
  assert.equal(lines.length, MAX_FINDINGS + 1);
  assert.equal(lines.at(-1), 'upstream: +37 more');
  assert.ok(lines.slice(0, MAX_FINDINGS).every(l => l.startsWith('upstream missing: alpha: ')));
  // Totals and per-component counts are never printed: only findings and the +N more line are ever lines.
  assert.deepEqual(summarize(['total 100, passed 43, failed 57; scoreboard in ignored .airig/upstream/', 'alpha 43 passed, 57 failed',
    'unexpected failure: alpha: <sl-alpha> > one']).lines, ['upstream failed: alpha: <sl-alpha> > one']);
  assert.equal(summarize(many.slice(0, MAX_FINDINGS)).lines.length, MAX_FINDINGS);
  assert.ok(!summarize(many.slice(0, MAX_FINDINGS)).lines.some(l => l.includes('more')));
  // The workflow shows the first 90 lines of 300 characters: a summary always fits.
  for (const l of summarize(many).lines) assert.ok(l.length < 300);
});

test('upstream summary: a component is named only if it is in the catalog, a title only if it is exactly an inventory title', () => {
  const out = summarize([
    'unexpected failure: alpha: <sl-alpha> > one',
    'unexpected failure: alpha: <sl-alpha> > One',
    'unexpected failure: alpha: <sl-beta> > only',
    'unexpected failure: gamma: <sl-alpha> > one',
    'unexpected failure: beta: <sl-beta> > only',
  ]).lines;
  assert.deepEqual(out, [
    'upstream failed: alpha: <sl-alpha> > one',
    'upstream failed: alpha: unlisted title',
    'upstream failed: alpha: unlisted title',
    'upstream failed: unlisted component: unlisted title',
    'upstream failed: beta: <sl-beta> > only',
  ]);
  // A vendored component that is not (yet) in the catalog is not named, but its pinned title is still exact-matched.
  assert.deepEqual(summarize(['unexpected failure: beta: <sl-beta> > only'], { catalog: new Set(['alpha']) }).lines,
    ['upstream failed: unlisted component: <sl-beta> > only']);
});

test('upstream summary: a title with a path or a secret-like string is never printed, in the log or even in the inventory', () => {
  const bad = [`<sl-alpha> > opens ${absolute()}`, `<sl-alpha> > key ${secret()}`, `<sl-alpha> > reads ${['~', '.config', 'x'].join('/')}`, '<sl-alpha> > ../up',
    ['<sl-alpha> > C:', 'Users', 'someone'].join('\\'),
    '<sl-alpha> > reads ./config/example.txt', `<sl-alpha> > reads [${['', 'data', 'example.txt'].join('/')}]`, `<sl-alpha> > in {${['', 'a'].join('/')}}`,
    '<sl-alpha> > reads data/sub/example.txt', `<sl-alpha> > opens ${['file:', '', '', 'data', 'x'].join('/')}`,
    `<sl-alpha> > opens ${['https:', '', 'host', 'x'].join('/')}`, `<sl-alpha> > at ${['"', 'b'].join('/')}`, `<sl-alpha> > under ${['', 'etc', 'hosts'].join('/')}`, `<sl-alpha> > ${'x'.repeat(40)}`, '<sl-alpha> > control\u0007char'];
  for (const title of bad) {
    // Not in the inventory: unlisted.
    const fromLog = summarize([`unexpected failure: alpha: ${title}`, `problem: missing outcome for alpha: ${title}`, `problem: outcome not in inventory for alpha: ${title}`]).lines;
    assert.deepEqual(fromLog, ['upstream failed: alpha: unlisted title', 'upstream unexpected: alpha: unlisted title', 'upstream missing: alpha: unlisted title']);
    // Exactly in a (poisoned) inventory: still withheld by the redaction check.
    const poisoned = summarize([`unexpected failure: alpha: ${title}`], { inventory: { alpha: [title] } }).lines;
    assert.deepEqual(poisoned, ['upstream failed: alpha: unlisted title']);
    for (const line of [...fromLog, ...poisoned]) {
      assert.doesNotMatch(line, /someone|Users|etc.hosts|\.config|\.\.\/|example\.txt|file:|https:|ghp_|xxxx|\u0007/);
    }
  }
  // A path or token anywhere else in the line, a component name that is not a name, and a message never come out.
  const out = summarize([
    `problem: infrastructure failure in alpha: ${secret()} at ${absolute()}`,
    `unexpected failure: ../${secret()}: <sl-alpha> > one`,
    `vendored upstream files changed (modified: ${absolute()})`,
    `refusing to write ${absolute()}`,
    `at ${absolute()}:12:3`,
  ]).lines.join('\n');
  assert.doesNotMatch(out, /someone|Users|ghp_|aaaa|file\.mjs/);
});

test('upstream summary: ordinary slash text in a title is still printed', () => {
  const titles = ['<sl-alpha> > toggles focus data attribute on focus/blur', '<sl-alpha> > formats dates for Europe/Berlin', '<sl-alpha> > a & b'];
  for (const title of titles) {
    assert.deepEqual(summarize([`unexpected failure: alpha: ${title}`], { inventory: { alpha: [title] } }).lines, [`upstream failed: alpha: ${title}`]);
  }
});

test('upstream summary: a result line no table row matches is "blocked: internal" and nothing of it is echoed', () => {
  const unknown = [
    `blocked (something nobody wrote ${secret()} ${absolute()})`,
    `blocked (a new failure reason ${secret()})`,
    `problem: brand new problem in alpha: <sl-alpha> > one ${absolute()}`,
    'problem: no baseline (fetch origin/main)',
    `unexpected failure: ${secret()}`,
    `unexpected failure ${secret()}: alpha: <sl-alpha> > one`,
    `Error: ${secret()}`,
    '__proto__', 'constructor: alpha', 'alpha: <sl-alpha> > one', '',
    // The prefix match is anchored: a known message that is not at the start of the line is not that message.
    ' vendored upstream files changed', `see: vendored upstream files changed ${absolute()}`, 'x library build failed',
  ];
  const { lines, findings } = summarize(unknown);
  assert.deepEqual(lines, ['upstream blocked: internal']);
  assert.equal(findings, 1);
  assert.doesNotMatch(lines.join('\n'), /nobody|someone|Users|ghp_|aaaa|alpha|brand|vendored|library|baseline|__proto__|constructor|Error|reason/);
  // Each line on its own is the same single fixed line.
  for (const line of unknown) assert.deepEqual(summarize([line]).lines, ['upstream blocked: internal'], line);
  // A word named inside a message is never taken from it: the table row that matched decides.
  assert.deepEqual(summarize(['blocked (results differ from the component records; verdict: library-build, vendor-changed)']).lines,
    ['upstream blocked: results-differ']);
  // Known and unknown lines together: the known ones keep their own words and the unknown ones add one internal line.
  assert.deepEqual(summarize(['unexpected failure: alpha: <sl-alpha> > one', `blocked (new ${secret()})`, 'vendored upstream files changed (x)', 'whatever']).lines,
    ['upstream blocked: vendor-changed', 'upstream blocked: internal', 'upstream failed: alpha: <sl-alpha> > one']);
});

test('upstream summary: no result lines, other output and a malformed log are handled without printing anything from them', () => {
  const none = ['upstream blocked: internal'];
  assert.deepEqual(summarizeUpstream('', { inventory, catalog }).lines, none);
  assert.deepEqual(summarizeUpstream(`> velcro test:upstream ${absolute()}\nError: ${secret()}\n    at x (${absolute()})\n`, { inventory, catalog }).lines, none);
  for (const value of [undefined, null, 5, {}]) assert.deepEqual(summarizeUpstream(value, { inventory, catalog }).lines, none);
  assert.deepEqual(summarizeUpstream('test:upstream: alpha 3 passed, 0 failed\ntest:upstream: passed (every failure is ledgered)\n', { inventory, catalog }).lines, none);
  assert.deepEqual(summarizeUpstream(log(['unexpected failure: alpha: <sl-alpha> > one']), { inventory: undefined, catalog: new Set(['alpha']) }).lines,
    ['upstream failed: alpha: unlisted title']);
  assert.deepEqual(summarizeUpstream(`test:upstream: unexpected failure: alpha: <sl-alpha> > one\r\n`, { inventory, catalog }).lines, ['upstream failed: alpha: <sl-alpha> > one']);
});

test('upstream summary: every real inventory title is printable, so a real failure is named', () => {
  const real = readInventory(root);
  const names = new Set(readCatalog(root).map(c => c.name));
  const withheld = [];
  let n = 0;
  for (const [component, titles] of Object.entries(real)) {
    for (const title of titles) {
      n++;
      const { lines } = summarizeUpstream(log([`unexpected failure: ${component}: ${title}`]), { inventory: real, catalog: names });
      if (!lines[0].endsWith(`: ${title.replace(/\s+/g, ' ').trim()}`)) withheld.push(`${component}: ${title}`);
    }
  }
  assert.ok(n > 600);
  assert.deepEqual(withheld, []);
  // Every vendored component with a catalog entry is named.
  for (const c of vendoredComponents(root)) if (names.has(c)) {
    assert.ok(summarizeUpstream(log([`problem: no results for ${c}`]), { inventory: real, catalog: names }).lines[0].endsWith(`: ${c}`));
  }
});
