import { expect, test } from '@playwright/test';
import { docsReady, exampleFits } from './support/loaded.mjs';

// The docs app's readiness signal (data-docs-ready on <litro-outlet>, packages/docs/src/ready.ts), which the product
// specs wait on. A probe in the page records the state at the moment the signal appears (a mutation observer callback:
// a microtask, so no frame load or router step can run in between). Routes hold back the page module (the router imports
// it before it remounts the page) and, for longer, the Velcro bundle (every example frame runs it before its document
// loads, and the page's runtime is the same bundle), so the remount comes well after the first parse and the new frames
// are still loading for a while after the remount: a signal set before the remount, at the router's settle, or before
// the frames or the runtime have loaded is recorded with the problem it had. The negative controls set the signal early
// themselves and check the probe reports it. Further tests add a frame of their own whose document is held until the
// test releases it: added while the page settles, it must be waited for; removed by a navigation, it must not keep the
// abandoned wait alive.
const CHUNK_DELAY_MS = 300;
const BUNDLE_DELAY_MS = 1200;
const HELD_SCRIPT = '/_test/held-frame.js';
const INTENT_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'];

const probe = () => {
  if (window !== window.top) return;
  // Through shadow roots and into same-origin frame documents, as the app reads them.
  const framesIn = (root, found = []) => {
    for (const el of root.querySelectorAll('*')) {
      if (el.localName === 'iframe') {
        found.push(el);
        let doc = null;
        try {
          doc = el.contentDocument;
        } catch {}
        if (doc) framesIn(doc, found);
      }
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
      // Revealed: scrolled to the top of the viewport, or as far as the page scrolls. Firefox rounds the scroll position
      // to whole pixels, so a target revealed at the top can sit a fraction of a pixel above it.
      const top = findDeep(document, id)?.getBoundingClientRect().top;
      if (!(top > -1 && top < innerHeight)) found.push('fragment not revealed');
    }
    return found;
  };
  window.__signals = [];
  document.addEventListener('DOMContentLoaded', () => {
    const outlet = document.querySelector('litro-outlet');
    window.__prerendered = outlet.firstElementChild;
    let ready = false;
    const record = () => {
      const now = outlet.hasAttribute('data-docs-ready');
      if (now && !ready) window.__signals.push({ path: location.pathname, problems: problems(outlet) });
      ready = now;
    };
    new MutationObserver(record).observe(outlet, { attributes: true, attributeFilter: ['data-docs-ready'] });
    // A signal already present (set by another DOMContentLoaded listener that ran first) is recorded too.
    record();
  });
};

// Counts the reader-movement listeners on the top window (window.__intentListeners()), removed or aborted ones not.
const countIntentListeners = types => {
  if (window !== window.top) return;
  const watched = new Set(types);
  const active = [];
  const find = (type, listener, capture) => active.findIndex(l => l.type === type && l.listener === listener && l.capture === capture);
  const captureOf = options => (typeof options === 'boolean' ? options : Boolean(options?.capture));
  const { addEventListener: add, removeEventListener: remove } = EventTarget.prototype;
  EventTarget.prototype.addEventListener = function (type, listener, options) {
    const signal = typeof options === 'object' ? options?.signal : undefined;
    if (this === window && watched.has(type) && listener && !signal?.aborted) {
      const capture = captureOf(options);
      if (find(type, listener, capture) === -1) {
        const entry = { type, listener, capture };
        active.push(entry);
        signal?.addEventListener('abort', () => {
          const index = active.indexOf(entry);
          if (index !== -1) active.splice(index, 1);
        });
      }
    }
    return add.call(this, type, listener, options);
  };
  EventTarget.prototype.removeEventListener = function (type, listener, options) {
    if (this === window) {
      const index = find(type, listener, captureOf(options));
      if (index !== -1) active.splice(index, 1);
    }
    return remove.call(this, type, listener, options);
  };
  window.__intentListeners = () => active.length;
};

// Adds one frame of the test's own to the page at `path`, in the page component's shadow root ('page') or inside its
// first example's document ('nested'): when the router has mounted the page ('mount'), or when every example frame of
// the page has loaded ('loaded'). The frame runs the Velcro bundle, as an example does, and a script the test holds.
const addHeldFrame = ({ path, when, where, script }) => {
  if (window !== window.top) return;
  const srcdoc = `<!DOCTYPE html><script type="module" src="/_litro/velcro.js"></script><script src="${script}"></script>`;
  const loaded = frame => frame.contentDocument?.URL === 'about:srcdoc' && frame.contentDocument.readyState === 'complete';
  let added = false;
  const add = root => {
    const first = root.querySelector('iframe.example');
    const doc = where === 'nested' ? first.contentDocument : document;
    const frame = doc.createElement('iframe');
    frame.className = 'held';
    frame.srcdoc = srcdoc;
    (where === 'nested' ? doc.body : root).append(frame);
    added = true;
  };
  document.addEventListener('DOMContentLoaded', () => {
    const outlet = document.querySelector('litro-outlet');
    new MutationObserver(() => {
      if (added || location.pathname !== path || !outlet.hasAttribute('data-litro-settled') || outlet.children.length !== 1) return;
      const root = outlet.firstElementChild.shadowRoot;
      if (!root?.querySelector('iframe.example') || root.__heldWatch) return;
      if (when === 'mount') return add(root);
      root.__heldWatch = true;
      const addOnceLoaded = () => {
        if (!added && [...root.querySelectorAll('iframe.example')].every(loaded)) add(root);
      };
      root.addEventListener('load', addOnceLoaded, true); // frame load events do not leave the shadow root
      addOnceLoaded();
    }).observe(outlet, { childList: true, attributes: true, attributeFilter: ['data-litro-settled'] });
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

// Holds the added frame's script until release(); requested resolves once the frame has asked for it.
async function holdFrameScript(page) {
  let release;
  let requested;
  const released = new Promise(resolve => (release = resolve));
  const asked = new Promise(resolve => (requested = resolve));
  await page.route(url => url.pathname === HELD_SCRIPT, async route => {
    requested();
    await released;
    await route.fulfill({ contentType: 'text/javascript', body: 'window.heldScriptRan = true;' }).catch(() => {}); // the frame may be gone
  });
  return { release, requested: asked };
}

// The router's own navigation (LitroRouter.go): push the path, then a popstate. Returns whether the signal was cleared.
const navigate = (page, path) =>
  page.evaluate(to => {
    history.pushState(null, '', to);
    dispatchEvent(new PopStateEvent('popstate'));
    return !document.querySelector('litro-outlet').hasAttribute('data-docs-ready');
  }, path);

const signals = page => page.evaluate(() => window.__signals);

let held;
test.beforeEach(async ({ page }) => {
  held = await slowDown(page);
});

test('the signal waits for the remount, the fragment, the runtime and every example frame', async ({ page }) => {
  await page.addInitScript(probe);
  await page.goto('/components/button#forms');
  expect(await page.evaluate(() => document.readyState)).toBe('complete');
  await docsReady(page);
  expect(await signals(page)).toEqual([{ path: '/components/button', problems: [] }]);
  expect(held.chunks, 'the page module was held back').toBe(1);
  expect(held.bundles, 'the Velcro bundle was held back').toBeGreaterThan(0);
  // The same, read through Playwright: every current frame has a loaded example document.
  for (const frame of page.frames().slice(1)) {
    expect(await frame.evaluate(() => [document.URL, document.readyState])).toEqual(['about:srcdoc', 'complete']);
  }
});

test('a client-side navigation clears the signal until the next page is ready', async ({ page }) => {
  await page.addInitScript(probe);
  await page.goto('/components/button');
  await docsReady(page);
  expect(await navigate(page, '/components/card')).toBe(true);
  await docsReady(page);
  expect(await signals(page)).toEqual([
    { path: '/components/button', problems: [] },
    { path: '/components/card', problems: [] },
  ]);
});

// The probe records a signal present when its DOMContentLoaded listener attaches as well as one set later. Playwright
// does not define the order of separate init scripts, so both run from one script here, in each order: with the stray
// signal's listener first, the signal is already present when the probe attaches.
for (const order of ['probe first', 'stray signal first']) {
  test(`negative control: the probe reports a signal set before the remount (${order})`, async ({ page }) => {
    const stray = () => {
      if (window === window.top) document.addEventListener('DOMContentLoaded', () => document.querySelector('litro-outlet').setAttribute('data-docs-ready', ''));
    };
    const scripts = order === 'probe first' ? [probe, stray] : [stray, probe];
    await page.addInitScript({ content: scripts.map(script => `(${script})();`).join('\n') });
    await page.goto('/components/button');
    // The stray signal is up from the start, so wait for the app's own signal: the second one recorded.
    await expect.poll(() => page.evaluate(() => window.__signals.length), { timeout: 20_000 }).toBe(2);
    await docsReady(page);
    const [early, ...rest] = await signals(page);
    expect(early.problems).toEqual(expect.arrayContaining(['router not settled', 'prerendered page still mounted']));
    // The app clears the stray signal and sets its own once the page is ready.
    expect(rest).toEqual([{ path: '/components/button', problems: [] }]);
  });
}

test('negative control: the probe reports a signal set when the router settles, before the frames have loaded', async ({ page }) => {
  await page.addInitScript(probe);
  await page.addInitScript(() => {
    if (window !== window.top) return;
    document.addEventListener('DOMContentLoaded', () => {
      const outlet = document.querySelector('litro-outlet');
      // In a later task, once the app has seen the settled page too (it clears the signal for each new page).
      new MutationObserver(() => {
        if (outlet.hasAttribute('data-litro-settled')) setTimeout(() => outlet.setAttribute('data-docs-ready', ''));
      }).observe(outlet, { attributes: true, attributeFilter: ['data-litro-settled'] });
    });
  });
  await page.goto('/components/button', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => window.__signals.length), { timeout: 20_000 }).toBe(1);
  const [early] = await signals(page);
  expect(early.problems).toEqual(expect.arrayContaining([expect.stringMatching(/^\d+ of \d+ example frames loading$/)]));
});

// A frame can appear while the page settles (an example adding one, a later render), including in the last animation
// frames before the signal. The app reads the frame set again until it is all loaded; it must not publish on the set it
// saw first. The navigation comes after the document has loaded, so only the app's own frame reading is tested.
for (const where of ['page', 'nested']) {
  test(`the signal waits for a frame added (${where}) once the example frames have loaded`, async ({ page }) => {
    const frame = await holdFrameScript(page);
    await page.addInitScript(probe);
    await page.addInitScript(addHeldFrame, { path: '/components/card', when: 'loaded', where, script: HELD_SCRIPT });
    await page.goto('/components/button');
    await docsReady(page);
    expect(await navigate(page, '/components/card')).toBe(true);
    await frame.requested;
    // Every example frame has loaded, and a few animation frames have passed; the added frame is still held.
    await page.evaluate(async () => {
      for (let i = 0; i < 5; i++) await new Promise(resolve => requestAnimationFrame(resolve));
    });
    await expect(page.locator('litro-outlet')).not.toHaveAttribute('data-docs-ready');
    frame.release();
    await docsReady(page);
    expect(await page.evaluate(() => window.__signals.slice(1))).toEqual([{ path: '/components/card', problems: [] }]);
  });
}

// A navigation away while a frame is still loading abandons the wait: its listeners are removed, and the removed frame
// (which will never load) keeps nothing alive.
test('a page left while a frame is loading leaves no wait behind', async ({ page }) => {
  const frame = await holdFrameScript(page);
  await page.addInitScript(countIntentListeners, INTENT_EVENTS);
  await page.addInitScript(addHeldFrame, { path: '/components/card', when: 'mount', where: 'page', script: HELD_SCRIPT });
  await page.goto('/components/button');
  await docsReady(page);
  expect(await page.evaluate(() => window.__intentListeners())).toBe(0);
  await navigate(page, '/components/card');
  await frame.requested;
  // The card page is settling: its reader-movement listeners are up while it waits for the held frame.
  await expect.poll(() => page.evaluate(() => window.__intentListeners())).toBe(INTENT_EVENTS.length);
  await navigate(page, '/components/badge');
  await docsReady(page);
  expect(await page.evaluate(() => location.pathname)).toBe('/components/badge');
  expect(await page.evaluate(() => window.__intentListeners())).toBe(0);
  frame.release();
});

// The wait is bounded: a page that never finishes loading is not marked ready, and its listeners are removed.
test('a page that never finishes loading is not marked ready, and stops waiting', async ({ page }) => {
  const frame = await holdFrameScript(page);
  const warnings = [];
  page.on('console', message => {
    if (message.type() === 'warning') warnings.push(message.text());
  });
  await page.clock.install();
  await page.addInitScript(countIntentListeners, INTENT_EVENTS);
  await page.addInitScript(addHeldFrame, { path: '/components/card', when: 'mount', where: 'page', script: HELD_SCRIPT });
  // The held frame holds the document's load event too.
  await page.goto('/components/card', { waitUntil: 'domcontentloaded' });
  await frame.requested;
  await expect.poll(() => page.evaluate(() => window.__intentListeners())).toBe(INTENT_EVENTS.length);
  await page.clock.fastForward('01:01');
  await expect.poll(() => page.evaluate(() => window.__intentListeners())).toBe(0);
  await expect(page.locator('litro-outlet')).not.toHaveAttribute('data-docs-ready');
  await expect.poll(() => warnings.filter(text => /did not finish loading/.test(text)).length).toBe(1);
  frame.release();
});

// Once the fragment has been revealed, the app reveals it again when the page has loaded, for engines whose layout moves
// it away (no scroll anchoring), but never after the reader has scrolled. A reader can scroll without this window seeing
// any input event: dragging the scrollbar, find in page, or a scroll chained from inside an example (whose events stay
// in the example's document). The test scrolls the page directly, which sends no input event either.
test('the second reveal leaves a reader who scrolled without an input event where they are', async ({ page }) => {
  const frame = await holdFrameScript(page);
  await page.addInitScript(addHeldFrame, { path: '/components/button', when: 'mount', where: 'page', script: HELD_SCRIPT });
  await page.goto('/components/button#forms', { waitUntil: 'domcontentloaded' });
  await frame.requested;
  // The fragment has been revealed and the examples have loaded; the added frame is still held.
  await expect(page.locator('#forms')).toBeInViewport();
  await expect
    .poll(() => page.locator('iframe.example').evaluateAll(frames => frames.every(f => f.contentDocument?.URL === 'about:srcdoc' && f.contentDocument.readyState === 'complete')))
    .toBe(true);
  const before = await page.evaluate(() => scrollY);
  await page.evaluate(() => scrollBy(0, 400));
  const scrolled = await page.evaluate(() => scrollY);
  expect(scrolled).toBeGreaterThan(before + 100);
  await expect(page.locator('litro-outlet')).not.toHaveAttribute('data-docs-ready');
  frame.release();
  await docsReady(page);
  expect(await page.evaluate(() => scrollY)).toBe(scrolled);
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
  // The preload itself, in every engine.
  const preloads = await page.locator('head link[rel="modulepreload"]').evaluateAll(links => links.map(link => new URL(link.href).pathname));
  expect(preloads).toContain('/_litro/velcro.js');
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
