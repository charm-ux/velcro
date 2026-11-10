// How the product specs wait for docs pages (tests/product/support/loaded.mjs). A docs page is ready when the docs app
// sets its ready signal (openDocs / reloadDocs / docsReady). Playwright's networkidle can stay pending for good in
// WebKit, and the router's data-litro-settled marker is set before the example frames have loaded, so neither is a
// wait. Waiting for the network to go quiet (watchNetwork + documentsLoaded) is only for specs that check the requests a
// page made; a spec that checks rendering only must not use it.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const productDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'product');
// The helpers' own controls exercise the waits directly.
const HELPER_CONTROLS = new Set(['loaded.spec.mjs']);
// The files that hold product test bodies: every spec (a per-item split such as <name>.inherited-api.spec.mjs included) and
// every support module that registers tests (support/inherited-api.mjs holds the inherited-API test bodies).
export function productSources(dir) {
  const read = names => names.sort().map(name => ({ name, text: readFileSync(join(dir, name), 'utf8') }));
  const support = existsSync(join(dir, 'support')) ? readdirSync(join(dir, 'support')).filter(name => name.endsWith('.mjs')).map(name => `support/${name}`) : [];
  return [
    ...read(readdirSync(dir).filter(name => name.endsWith('.spec.mjs'))),
    ...read(support).filter(({ text }) => /^\s*test\(/m.test(text)),
  ];
}
const specs = productSources(productDir);

// A scratch product directory: an ordinary spec, a per-item split spec, a support module that registers the split spec's
// tests (with the given body) and a plain helper that registers none.
function splitFixture(body) {
  const dir = mkdtempSync(join(tmpdir(), 'velcro-split-'));
  mkdirSync(join(dir, 'support'));
  writeFileSync(join(dir, 'alpha.spec.mjs'), "import { test } from '@playwright/test';\ntest('a', () => {});\n");
  writeFileSync(join(dir, 'beta.inherited-api.spec.mjs'), "import { register } from './support/split.mjs';\nregister('sl-beta');\n");
  writeFileSync(join(dir, 'support/split.mjs'), `import { test } from '@playwright/test';\nimport { readCatalog } from './c.mjs';\nconst catalog = readCatalog();\nexport function register(tag) {\n${body}\n}\n`);
  writeFileSync(join(dir, 'support/plain.mjs'), 'export const helper = () => 1;\n');
  return dir;
}

const NETWORK_IDLE = /['"`]networkidle['"`]/;
const SETTLED_WAIT = /toHaveAttribute\(\s*['"`]data-litro-settled['"`]|waitForSelector\([^)]*data-litro-settled/;
const NETWORK_WAIT = /\b(watchNetwork|documentsLoaded)\s*\(/;
const RECORDS_REQUESTS = /\.on\(\s*['"`]request(finished|failed)?['"`]/;
// A key action (page.keyboard.press/type/down/up/insertText, or a locator's press/pressSequentially) is followed by the
// next key, or by a one-shot read of the state, before the state the key produces has been awaited. Most key handlers
// change the state while the key event is dispatched, but some only start the change (a Lit update, an animation frame,
// an animation, a timer), and a loaded runner can deliver the next key or read before it lands: the select's keyboard spec
// failed in WebKit that way. After each key, await the state it produces (expect.poll, or a locator assertion such as
// toBeFocused or toHaveValue); for a key whose effect is that nothing changes, await the whole press (support/keys.mjs:
// pressReceived) and then read. A fixed sleep between the key and the read is not a wait, so the check looks past it.
// It reads one statement per line: a key in a braced loop body, in a helper or on a line with other statements is not
// checked, and neither is whether a poll waits for every effect of the key (an ordering race, as in that select spec).
const KEY_ACTION = /\.(?:keyboard\.(?:press|type|down|up|insertText)|press|pressSequentially)\(/;
// A read whose value is used once: an expect, a declaration, a push into a collector, a condition or a return of an awaited
// value. expect.poll and locator assertions take no awaited argument, so they do not match.
const ONE_SHOT_READ = /^expect\(.*\bawait\b|^await expect\(.*\bawait\b|^(?:const|let)\s+[^=]+=\s*await\b|\.push\(.*\bawait\b|^(?:if|while|return)\b.*\bawait\b|^assert[.(].*\bawait\b/;
// A sleep from the test process or in the page.
const SLEEP = /^await\s.*(?:waitForTimeout\(|setTimeout\()/;
function keyThenUnawaited(text) {
  const statements = text.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('//'));
  const found = [];
  statements.forEach((line, i) => {
    // A loop whose whole body is one key action presses the next key straight after the previous one.
    if (/^for\s*\(.*\)\s*await\s/.test(line) && KEY_ACTION.test(line.replace(/^for\s*\(.*?\)\s*await/, '.'))) found.push(line);
    if (!line.startsWith('await ') || !KEY_ACTION.test(line)) return;
    let k = i + 1;
    while (SLEEP.test(statements[k] ?? '')) k++;
    const next = statements[k] ?? '';
    if ((next.startsWith('await ') && KEY_ACTION.test(next)) || ONE_SHOT_READ.test(next)) found.push(`${line} -> ${next}`);
  });
  return found;
}
// A pointer move (hover, mouse.move/down/up) whose next statements sleep a fixed time from the test process. That sleep
// is not a window measured from the pointer event: the action, the sleep and the state read are separate protocol round
// trips, which on a loaded runner can outlast a hover delay by themselves (Firefox in CI saw an sl-tooltip close before
// its 200 ms --hide-delay, read about 80 ms after the pointer left). Time the window in the page from the pointer event
// instead (tooltip.spec.mjs: probeAfterPointer), or poll for the outcome.
const POINTER_THEN_SLEEP = /(?:\.hover\(|\.mouse\.(?:move|down|up)\()[^;]*\);(?:\s*\/\/[^\n]*)*\s*await [^;]*(?:waitForTimeout\(|setTimeout\(\s*\w+\s*,)/;

test('the product specs are found', () => {
  assert.ok(specs.length > 20, `${specs.length} product specs`);
});

test('no product spec waits for networkidle or for the router settled marker', () => {
  const offending = specs.filter(({ text }) => NETWORK_IDLE.test(text) || SETTLED_WAIT.test(text)).map(({ name }) => name);
  assert.deepEqual(offending, []);
});

test('only specs that record the requests a page made wait for the network to go quiet', () => {
  const offending = specs
    .filter(({ name, text }) => !HELPER_CONTROLS.has(name) && NETWORK_WAIT.test(text) && !RECORDS_REQUESTS.test(text))
    .map(({ name }) => name);
  assert.deepEqual(offending, []);
});

// A spec helper (a top-level function) that waits for the network to go quiet makes every test that opens a page through
// it wait, although only the tests that read the requests need it; its bound adds to the page's own waits and can use up a
// test's time on a loaded runner (tab-panel.spec.mjs:203 timed out that way). The tests that read the requests call
// documentsLoaded in their own body. A top-level hook (test.beforeEach and the like) runs for every test, so it counts as
// a helper, and so does an exported function or constant (a support module that registers tests, such as
// support/inherited-api.mjs, is scanned too).
function networkWaitsInHelpers(text) {
  let context = 'top';
  const found = [];
  for (const line of text.split('\n')) {
    if (/^(?:export\s+)?(?:async\s+)?function\b|^(?:export\s+)?(?:const|let)\s|^test\.(?:before|after)(?:Each|All)\b/.test(line)) context = 'helper';
    else if (/^(?:test|for)\b/.test(line)) context = 'test';
    if (context === 'helper' && /\bdocumentsLoaded\s*\(/.test(line) && !/^import\b/.test(line)) found.push(line.trim());
  }
  return found;
}

test('only a test body waits for the network to go quiet, not a spec helper that every test calls', () => {
  const offending = specs
    .filter(({ name }) => !HELPER_CONTROLS.has(name))
    .flatMap(({ name, text }) => networkWaitsInHelpers(text).map(found => `${name}: ${found}`));
  assert.deepEqual(offending, []);
});

test('the helper network-wait check recognizes the patterns it guards', () => {
  const flagged = [
    "async function openExample(page) {\n  await openDocs(page, PAGE);\n  await documentsLoaded(page);\n  return {};\n}",
    "const open = async page => {\n  await openDocs(page, PAGE);\n  await documentsLoaded(page);\n};",
    "function openPage(page) {\n  return openDocs(page, PAGE).then(() => documentsLoaded(page));\n}",
    "test.beforeEach(async ({ page }) => {\n  await openDocs(page, PAGE);\n  await documentsLoaded(page);\n});",
    "test.beforeAll(async ({ browser }) => {\n  await documentsLoaded(await browser.newPage());\n});",
    "export async function openExample(page) {\n  await openDocs(page, PAGE);\n  await documentsLoaded(page);\n}",
    "export const open = async page => {\n  await documentsLoaded(page);\n};",
  ];
  const allowed = [
    "import { documentsLoaded } from './support/loaded.mjs';\nasync function openExample(page) {\n  await openDocs(page, PAGE);\n}\ntest('requests', async ({ page }) => {\n  await openExample(page);\n  await documentsLoaded(page);\n});",
    "test.describe('pages', () => {\n  test('x', async ({ page }) => {\n    await documentsLoaded(page);\n  });\n});",
    "for (const route of routes) {\n  test(route, async ({ page }) => {\n    await documentsLoaded(page);\n  });\n}",
  ];
  assert.deepEqual(flagged.map(text => networkWaitsInHelpers(text).length > 0), flagged.map(() => true));
  assert.deepEqual(allowed.map(text => networkWaitsInHelpers(text).length), allowed.map(() => 0));
});

test('no product spec times a hover window with a sleep from the test process', () => {
  const offending = specs.filter(({ text }) => POINTER_THEN_SLEEP.test(text)).map(({ name }) => name);
  assert.deepEqual(offending, []);
});

test('the hover-window check recognizes the patterns it guards', () => {
  const flagged = [
    "await frame.locator('#b').hover();\n  await frame.locator('body').evaluate(() => new Promise(r => setTimeout(r, 80)));\n  expect(x).toBe(true);",
    "await page.mouse.move(10, 20);\n  await page.waitForTimeout(150);",
    "await target.hover({ force: true });\n  // a comment\n  await frame.locator('body').evaluate(() => new Promise(resolve => setTimeout(resolve, 300)));",
  ];
  const allowed = [
    "await probeAfterPointer(frame, 'mouseout', 80);\n  await frame.locator('#away').hover();\n  await expect.poll(() => eventTypes(frame)).toEqual([]);",
    "await frame.locator('#b').click();\n  await page.waitForTimeout(100);",
    "await frame.locator('#b').hover();\n  await expect.poll(() => state(frame)).toEqual({ open: true });",
  ];
  assert.deepEqual(flagged.map(text => POINTER_THEN_SLEEP.test(text)), [true, true, true]);
  assert.deepEqual(allowed.map(text => POINTER_THEN_SLEEP.test(text)), [false, false, false]);
});

test('no product spec presses a key and then the next key, or reads the state, before awaiting the state the key produced', () => {
  const offending = specs.flatMap(({ name, text }) => keyThenUnawaited(text).map(found => `${name}: ${found}`));
  assert.deepEqual(offending, []);
});

test('the key-wait check recognizes the patterns it guards', () => {
  const flagged = [
    "await page.keyboard.press('ArrowDown');\n  await page.keyboard.press('ArrowDown');",
    "await page.keyboard.press('Enter');\n  // a comment\n  expect(await state()).toEqual([true]);",
    "await frame.locator('#a input').pressSequentially('ab');\n  const events = await el.evaluate(() => window.events);",
    "await page.keyboard.type('abc');\n  await page.keyboard.press('Backspace');",
    "await page.keyboard.press('Tab');\n  seen.push(await active());",
    "for (const key of ['ArrowUp', 'ArrowDown']) await page.keyboard.press(key);",
    "await page.keyboard.down('Shift');\n  await page.keyboard.up('Shift');",
    "for (const key of ['ArrowRight', 'ArrowLeft']) {\n    await page.keyboard.press(key);\n    steps.push([key, await focusedTab(page), await activeTab(page)]);\n  }",
    "await page.keyboard.press('Tab');\n  if (!(await host.evaluate(el => el.shadowRoot.activeElement !== null))) await host.locator('.divider').focus();",
    "await page.keyboard.press('Tab');\n  await page.waitForTimeout(150);\n  expect((await state(page)).open).toBe(true);",
    "await page.keyboard.press('Escape');\n  await frame.locator('body').evaluate(() => new Promise(r => setTimeout(r, 300)));\n  expect(await state(frame)).toEqual({ open: true });",
    "await page.keyboard.press('Enter');\n  await expect(await page.locator('#d').getAttribute('open')).toBe('');",
    "await page.keyboard.press('Enter');\n  return await state(page);",
  ];
  const allowed = [
    "await page.keyboard.press('ArrowDown');\n  await expect.poll(state).toEqual([true]);\n  await page.keyboard.press('ArrowDown');",
    "await page.keyboard.press('Tab');\n  await expect(page.locator('#b')).toBeFocused();",
    "await pressReceived(page, page, 'Escape');\n  expect(await state()).toEqual([false]);",
    "for (const key of ['ArrowUp', 'ArrowDown']) await pressReceived(page, page, key);",
    "const press = async key => { await page.keyboard.press(key); await expect.poll(position).toBe(1); };\n  await press('Home');",
    "await page.locator('#b').click();\n  expect(await state()).toEqual([true]);",
    "await pressReceived(page, page, 'Tab');\n  await page.waitForTimeout(150);\n  expect(await state()).toEqual([true]);",
    "await page.keyboard.press('Tab');\n  await expect.poll(() => active(page)).toBe('content');\n  await page.waitForTimeout(150);\n  expect((await state(page)).open).toBe(true);",
  ];
  assert.deepEqual(flagged.map(text => keyThenUnawaited(text).length > 0), flagged.map(() => true));
  assert.deepEqual(allowed.map(text => keyThenUnawaited(text).length), allowed.map(() => 0));
});

test('a split spec and the support module that registers its tests are scanned, and a networkidle wait there is flagged', () => {
  const dir = splitFixture("test(`${tag} x`, async ({ page }) => {\n  await page.goto('/', { waitUntil: 'networkidle' });\n});");
  try {
    const sources = productSources(dir);
    assert.deepEqual(sources.map(s => s.name), ['alpha.spec.mjs', 'beta.inherited-api.spec.mjs', 'support/split.mjs']);
    assert.deepEqual(sources.filter(({ text }) => NETWORK_IDLE.test(text) || SETTLED_WAIT.test(text)).map(({ name }) => name), ['support/split.mjs']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
  // A network-quiet wait in a helper of the support module is flagged there too.
  const helperDir = splitFixture("  const open = async page => {\n    await openDocs(page, '/');\n    await documentsLoaded(page);\n  };\n  test(`${tag} y`, async ({ page }) => open(page));");
  try {
    const offending = productSources(helperDir).flatMap(({ name, text }) => networkWaitsInHelpers(text).map(found => `${name}: ${found}`));
    assert.deepEqual(offending, ['support/split.mjs: await documentsLoaded(page);']);
  } finally { rmSync(helperDir, { recursive: true, force: true }); }
  // The real tree: every per-component split spec and the inherited-API support module are read.
  const names = specs.map(s => s.name);
  assert.ok(names.includes('support/inherited-api.mjs'));
  assert.ok(names.filter(n => n.endsWith('.inherited-api.spec.mjs')).length > 0);
});
