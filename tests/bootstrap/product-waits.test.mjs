// How the product specs wait for docs pages (tests/product/support/loaded.mjs). A docs page is ready when the docs app
// sets its ready signal (openDocs / reloadDocs / docsReady). Playwright's networkidle can stay pending for good in
// WebKit, and the router's data-litro-settled marker is set before the example frames have loaded, so neither is a
// wait. Waiting for the network to go quiet (watchNetwork + documentsLoaded) is only for specs that check the requests a
// page made; a spec that checks rendering only must not use it.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const productDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'product');
// The helpers' own controls exercise the waits directly.
const HELPER_CONTROLS = new Set(['loaded.spec.mjs']);
const specs = readdirSync(productDir)
  .filter(name => name.endsWith('.spec.mjs'))
  .sort()
  .map(name => ({ name, text: readFileSync(join(productDir, name), 'utf8') }))
  // A support module that registers tests (support/inherited-api.mjs) holds test bodies too, so it is read like a spec.
  .concat(readdirSync(join(productDir, 'support'))
    .filter(name => name.endsWith('.mjs'))
    .sort()
    .map(name => ({ name: `support/${name}`, text: readFileSync(join(productDir, 'support', name), 'utf8') }))
    .filter(({ text }) => /^\s*test\(/m.test(text)));

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
  assert.ok(specs.some(({ name }) => name === 'support/inherited-api.mjs'), 'the support module that registers tests is read');
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
