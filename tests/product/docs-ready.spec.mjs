import { expect, test } from '@playwright/test';
import { docsReady, exampleFits } from './support/loaded.mjs';

// The docs app's readiness signal (data-docs-ready on <litro-outlet>, packages/docs/src/ready.ts), which the product
// specs wait on. A probe in the page records the state at the moment the signal appears (a mutation observer callback:
// a microtask, so no frame load or router step can run in between). Routes hold back the page module (the router imports
// it before it remounts the page) and, for longer, the Velcro bundle (every example frame runs it before its document
// loads, and the page's runtime is the same bundle), so the remount comes well after the first parse and the new frames
// are still loading for a while after the remount: a signal set before the remount, at the router's settle, or before
// the frames or the runtime have loaded is recorded with the problem it had. The negative control sets the signal
// early itself and checks the probe reports it.
const CHUNK_DELAY_MS = 300;
const BUNDLE_DELAY_MS = 1200;

const probe = () => {
  if (window !== window.top) return;
  const framesIn = (root, found = []) => {
    for (const el of root.querySelectorAll('*')) {
      if (el instanceof HTMLIFrameElement) found.push(el);
      if (el.shadowRoot) framesIn(el.shadowRoot, found);
    }
    return found;
  };
  const findDeep = (root, id) => {
    const direct = root.getElementById(id);
    if (direct) return direct;
    for (const el of root.querySelectorAll('*')) {
      const found = el.shadowRoot && findDeep(el.shadowRoot, id);
      if (found) return found;
    }
    return null;
  };
  const problems = outlet => {
    const found = [];
    if (document.readyState !== 'complete') found.push('document not loaded');
    if (!outlet.hasAttribute('data-litro-settled')) found.push('router not settled');
    const pages = [...outlet.children];
    if (pages.length !== 1) return [...found, `${pages.length} page elements`];
    const [page] = pages;
    if (page === window.__prerendered || window.__prerendered?.isConnected) found.push('prerendered page still mounted');
    if (page.hasAttribute('hidden')) found.push('page hidden');
    if (!customElements.get('sl-badge')) found.push('Velcro runtime not loaded');
    const frames = page.shadowRoot ? framesIn(page.shadowRoot) : [];
    if (frames.length === 0) found.push('no example frames');
    const loading = frames.filter(f => f.contentDocument?.URL !== 'about:srcdoc' || f.contentDocument.readyState !== 'complete');
    if (loading.length) found.push(`${loading.length} of ${frames.length} example frames loading`);
    if (frames.some(f => !f.contentWindow?.customElements.get('sl-badge'))) found.push('example runtime not loaded');
    const id = location.hash.slice(1);
    if (id) {
      const target = findDeep(document, id);
      const top = target?.getBoundingClientRect().top;
      if (!(top >= 0 && top < innerHeight)) found.push('fragment not revealed');
    }
    return found;
  };
  window.__signals = [];
  document.addEventListener('DOMContentLoaded', () => {
    const outlet = document.querySelector('litro-outlet');
    window.__prerendered = outlet.firstElementChild;
    let ready = false;
    new MutationObserver(() => {
      const now = outlet.hasAttribute('data-docs-ready');
      if (now && !ready) window.__signals.push({ path: location.pathname, problems: problems(outlet) });
      ready = now;
    }).observe(outlet, { attributes: true, attributeFilter: ['data-docs-ready'] });
  });
};

// Counts the requests it held back, so a test can show the slowdown applied.
async function slowDown(page) {
  const held = { chunks: 0, bundles: 0 };
  const later = ms => new Promise(resolve => setTimeout(resolve, ms));
  // The page component's module.
  const assets = '/_litro/assets/';
  const chunk = url => url.pathname.startsWith(assets) && /^(?:button|card)-[^/]*\.js$/.test(url.pathname.slice(assets.length));
  await page.route(chunk, async route => {
    held.chunks++;
    await later(CHUNK_DELAY_MS);
    await route.continue();
  });
  // The Velcro bundle, whichever document requests it (WebKit may serve a frame's request from one already in flight).
  await page.route(url => url.pathname === '/_litro/velcro.js', async route => {
    held.bundles++;
    await later(BUNDLE_DELAY_MS);
    await route.continue();
  });
  return held;
}

let held;
test.beforeEach(async ({ page }) => {
  await page.addInitScript(probe);
  held = await slowDown(page);
});

test('the signal waits for the remount, the fragment, the runtime and every example frame', async ({ page }) => {
  await page.goto('/components/button#forms');
  expect(await page.evaluate(() => document.readyState)).toBe('complete');
  await docsReady(page);
  expect(await page.evaluate(() => window.__signals)).toEqual([{ path: '/components/button', problems: [] }]);
  expect(held.chunks, 'the page module was held back').toBe(1);
  expect(held.bundles, 'the Velcro bundle was held back').toBeGreaterThan(0);
  // The same, read through Playwright: every current frame has a loaded example document.
  for (const frame of page.frames().slice(1)) {
    expect(await frame.evaluate(() => [document.URL, document.readyState])).toEqual(['about:srcdoc', 'complete']);
  }
});

test('a client-side navigation clears the signal until the next page is ready', async ({ page }) => {
  await page.goto('/components/button');
  await docsReady(page);
  // The router's own navigation (LitroRouter.go): push the path, then a popstate.
  const cleared = await page.evaluate(() => {
    history.pushState(null, '', '/components/card');
    dispatchEvent(new PopStateEvent('popstate'));
    return !document.querySelector('litro-outlet').hasAttribute('data-docs-ready');
  });
  expect(cleared).toBe(true);
  await docsReady(page);
  expect(await page.evaluate(() => window.__signals)).toEqual([
    { path: '/components/button', problems: [] },
    { path: '/components/card', problems: [] },
  ]);
});

test('negative control: the probe reports a signal set before the remount', async ({ page }) => {
  await page.addInitScript(() => {
    if (window === window.top) document.addEventListener('DOMContentLoaded', () => document.querySelector('litro-outlet').setAttribute('data-docs-ready', ''));
  });
  await page.goto('/components/button');
  // The stray signal is up from the start, so wait for the app's own signal: the second one recorded.
  await expect.poll(() => page.evaluate(() => window.__signals.length), { timeout: 20_000 }).toBe(2);
  await docsReady(page);
  const [early, ...rest] = await page.evaluate(() => window.__signals);
  expect(early.problems).toEqual(expect.arrayContaining(['router not settled', 'prerendered page still mounted']));
  // The app clears the stray signal and sets its own once the page is ready.
  expect(rest).toEqual([{ path: '/components/button', problems: [] }]);
});

// Every example frame loads the same Velcro bundle as the page. WebKit attaches a later request for it to one already in
// flight; with the page's own request attached to a prerendered frame's, the remount removing that frame cancelled it and
// the page's runtime import failed ("Importing a module script failed"), so the page never became ready. The page now
// starts its request from <head> (src/theme.ts). The routes above hold the bundle's requests open across the remount.
test('the page runtime survives the remount cancelling the prerendered frames\' requests', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/components/badge');
  await docsReady(page);
  expect(await page.evaluate(() => Boolean(customElements.get('sl-badge')))).toBe(true);
  expect(errors).toEqual([]);
});

// exampleFits (support/loaded.mjs): content a test adds to an example document is only reachable without the document
// scrolling under the pointer once the frame has grown to fit it.
test('exampleFits waits until the example frame has grown to new content, and not before', async ({ page }) => {
  await page.goto('/components/badge');
  await docsReady(page);
  const iframe = page.locator('iframe.example').first();
  const frame = page.frameLocator('iframe.example').first();
  const grow = () => frame.locator('body').evaluate(body => {
    const tall = document.createElement('div');
    tall.style.height = '600px';
    body.append(tall);
    return document.documentElement.scrollHeight > innerHeight;
  });
  // Right after the append the frame is still at its old height; exampleFits resolves only once it has grown.
  expect(await grow()).toBe(true);
  await exampleFits(frame);
  const [outer, content] = await Promise.all([iframe.boundingBox(), frame.locator('html').evaluate(root => root.getBoundingClientRect().height)]);
  expect(outer.height).toBeGreaterThanOrEqual(content);
  // Negative control: a frame held below its content never fits, and exampleFits fails at its bound.
  await iframe.evaluate(el => { el.style.maxHeight = '50px'; });
  await expect(exampleFits(frame, { timeout: 1000 })).rejects.toThrow(/fit its content/);
});
