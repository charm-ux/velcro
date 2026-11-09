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
  .map(name => ({ name, text: readFileSync(join(productDir, name), 'utf8') }));

const NETWORK_IDLE = /['"`]networkidle['"`]/;
const SETTLED_WAIT = /toHaveAttribute\(\s*['"`]data-litro-settled['"`]|waitForSelector\([^)]*data-litro-settled/;
const NETWORK_WAIT = /\b(watchNetwork|documentsLoaded)\s*\(/;
const RECORDS_REQUESTS = /\.on\(\s*['"`]request(finished|failed)?['"`]/;
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
