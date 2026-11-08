import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { docsReady, documentsLoaded, pendingLoad, watchNetwork } from './support/loaded.mjs';

// Controls for the post-remount wait in support/loaded.mjs, on a synthetic page served by a route. As on the docs
// site, the example iframe is added inside a shadow root after the page has loaded, and the page carries the docs app's
// ready signal. Each control holds one request open and then releases it.
const ORIGIN = 'https://example.com';
const fixture = afterLoad => `<!doctype html><title>fixture</title><litro-outlet data-docs-ready></litro-outlet>
<docs-page></docs-page><script>addEventListener('load', () => { ${afterLoad} });</script>`;
const SHADOW_FRAME = `const root = document.querySelector('docs-page').attachShadow({ mode: 'open' });
  const frame = document.createElement('iframe');
  frame.className = 'example';
  frame.srcdoc = '<link rel="stylesheet" href="${ORIGIN}/held.css"><p>example</p>';
  root.append(frame);`;
const LATE_FETCH = `fetch('${ORIGIN}/held.json');`;

async function serve(page, html) {
  let release;
  const requested = new Promise(resolve => {
    page.route(`${ORIGIN}/**`, route => {
      const { pathname } = new URL(route.request().url());
      if (pathname === '/fixture') return route.fulfill({ contentType: 'text/html', body: html });
      release = () => route.fulfill({ contentType: pathname.endsWith('.css') ? 'text/css' : 'application/json', body: pathname.endsWith('.css') ? '' : '{}' });
      resolve();
    });
  });
  await page.goto(`${ORIGIN}/fixture`, { waitUntil: 'load' });
  await requested;
  return () => release();
}

test.beforeEach(({ page }) => watchNetwork(page));

test('waits for an example frame inside a shadow root until its document has loaded', async ({ page }) => {
  const release = await serve(page, fixture(SHADOW_FRAME));
  expect(await page.evaluate(() => document.readyState)).toBe('complete');
  await expect.poll(() => pendingLoad(page)).toContain('frame interactive');
  await expect(documentsLoaded(page, { timeout: 1500 })).rejects.toThrow('every current frame has loaded');
  release();
  await documentsLoaded(page);
  expect(await page.frames()[1].evaluate(() => document.readyState)).toBe('complete');
});

test('waits for a request started after load until it has finished', async ({ page }) => {
  const release = await serve(page, fixture(LATE_FETCH));
  expect(await pendingLoad(page)).toEqual(['1 request(s) open']);
  await expect(documentsLoaded(page, { timeout: 1500 })).rejects.toThrow('every current frame has loaded');
  // The request ends after its release, and the wait then needs 500 ms of quiet.
  const released = Date.now();
  release();
  await documentsLoaded(page);
  expect(Date.now() - released).toBeGreaterThanOrEqual(500);
});

test('refuses a page it did not watch from the start', async ({ browser }) => {
  const context = await browser.newContext();
  const unwatched = await context.newPage();
  await expect(pendingLoad(unwatched)).rejects.toThrow('call watchNetwork(page) before the page loads');
  await context.close();
});

// When docsReady reaches its bound, its failure describes the page's state in its own words and counts only: whatever
// the page supplies (an exception's message, a property's value) stays out of the test output. Each page here plants a
// marker generated for this run where the description reads the page, and the failure must not contain it.
const PLANTS = {
  'an exception thrown while the page is read': marker => { document.querySelector = () => { throw new Error(marker); }; },
  'a document state the page made up': marker => { Object.defineProperty(document, 'readyState', { get: () => marker }); },
  'counts and flags the page made up': marker => {
    const outlet = document.querySelector('litro-outlet');
    Object.defineProperty(outlet, 'children', { get: () => ({ length: marker }) });
    outlet.hasAttribute = () => marker;
  },
};
for (const [plant, script] of Object.entries(PLANTS)) {
  test(`a docsReady failure reports only state, never page content: ${plant}`, async ({ page }) => {
    const marker = `marker-${randomUUID()}`;
    await page.setContent('<!doctype html><title>fixture</title><litro-outlet><docs-page></docs-page></litro-outlet>');
    await page.evaluate(script, marker);
    const error = await docsReady(page, { timeout: 200 }).then(() => null, e => e);
    expect(error?.message).toContain('Page state at the bound: ');
    expect(error.message).not.toContain(marker);
  });
}
