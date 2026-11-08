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
