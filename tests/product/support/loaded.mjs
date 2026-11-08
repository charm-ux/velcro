import { expect } from '@playwright/test';

// Waits for docs pages. Litro's client router remounts a docs page once after load, which replaces every example iframe.
//
// docsReady(page) waits for the docs app's own readiness signal, `data-docs-ready` on <litro-outlet> (set by
// packages/docs/src/ready.ts): the remount has finished, the fragment has been revealed, the document and the Velcro
// runtime have loaded, and every example frame of the current page has loaded its document. openDocs(page, url) and
// reloadDocs(page) load or reload a docs page and wait for that signal. Use them instead of Playwright's
// networkidle, which WebKit can leave pending for good after the remount, and instead of the router's
// data-litro-settled marker, which is set before the new example frames have loaded.
//
// documentsLoaded(page) additionally waits until every current frame's document has loaded and the network has been
// quiet for QUIET_MS, for checks of the requests a page made (an example can fetch after its document has loaded). An
// unfinished request is excused only if its frame has since been detached or navigated to another document; any other
// unfinished request, a frame still loading, or ongoing network activity keeps the wait pending, and it fails at its own
// bound. Completion is not success: a resource that fails to load still completes its document, so request failures stay
// the business of the specs' own request checks.
//
// Frames are read through Playwright, not the DOM: the example iframes are inside the page components' shadow roots.
// Call watchNetwork(page) before the page loads (the specs do it in beforeEach); documentsLoaded refuses a page it did
// not watch from the start.
const QUIET_MS = 500;
const BOUND_MS = 20_000;
const FRAME_READ_MS = 2_000;
const watched = new WeakMap();

export function watchNetwork(page) {
  if (watched.has(page)) return;
  const navigations = new Map();
  const startedIn = new Map();
  const unfinished = new Set();
  let lastActivity = Date.now();
  const navCount = frame => navigations.get(frame) ?? 0;
  const frameOf = request => {
    try {
      return request.frame();
    } catch {
      return undefined; // a service worker's request has no frame
    }
  };
  page.on('framenavigated', frame => navigations.set(frame, navCount(frame) + 1));
  page.on('request', request => {
    lastActivity = Date.now();
    const frame = frameOf(request);
    startedIn.set(request, { frame, document: frame ? navCount(frame) : 0 });
    unfinished.add(request);
  });
  const ended = request => {
    lastActivity = Date.now();
    unfinished.delete(request);
  };
  page.on('requestfinished', ended);
  page.on('requestfailed', ended);
  const replaced = request => {
    const { frame, document } = startedIn.get(request);
    return Boolean(frame) && (frame.isDetached() || navCount(frame) > document);
  };
  watched.set(page, () => ({
    open: [...unfinished].filter(request => !replaced(request)).length,
    quietFor: Date.now() - lastActivity,
  }));
}

// A frame's document state, or 'unanswered' if it does not answer within FRAME_READ_MS. A frame whose element names a
// document (src or srcdoc) has not started loading it while it still shows about:blank.
async function frameState(frame) {
  const read = frame
    .evaluate(() => {
      const element = window.frameElement;
      const named = Boolean(element && (element.hasAttribute('srcdoc') || element.getAttribute('src')));
      return named && document.URL === 'about:blank' ? 'not started' : document.readyState;
    })
    .catch(() => 'unreadable');
  let timer;
  const late = new Promise(resolve => { timer = setTimeout(() => resolve('unanswered'), FRAME_READ_MS); });
  try {
    return await Promise.race([read, late]);
  } finally {
    clearTimeout(timer);
  }
}

// What is still keeping the page from having loaded, as counts only (never URLs): [] once it has.
export async function pendingLoad(page) {
  const network = watched.get(page);
  if (!network) throw new Error('documentsLoaded: call watchNetwork(page) before the page loads');
  const pending = [];
  for (const frame of page.frames()) {
    if (frame.isDetached()) continue;
    const state = await frameState(frame);
    if (state !== 'complete') pending.push(`${frame === page.mainFrame() ? 'page' : 'frame'} ${state}`);
  }
  const { open, quietFor } = network();
  if (open > 0) pending.push(`${open} request(s) open`);
  else if (quietFor < QUIET_MS) pending.push('network active');
  return pending;
}

export async function docsReady(page, { timeout = BOUND_MS } = {}) {
  await expect(page.locator('litro-outlet'), 'the docs page has remounted and its example frames have loaded')
    .toHaveAttribute('data-docs-ready', '', { timeout });
}

export async function openDocs(page, url) {
  await page.goto(url);
  await docsReady(page);
}

export async function reloadDocs(page) {
  await page.reload();
  await docsReady(page);
}

// An example iframe sizes itself to its content (packages/docs/src/example.ts), on the example document's next
// ResizeObserver delivery. Until then, content a test has just added can lie below the frame's bottom edge: a pointer
// action aimed at it scrolls the example document to reveal it, and when the frame then grows the document scrolls back,
// moving the target from under the pointer. Playwright's actionability checks catch that for ordinary actions; a forced
// action (on a disabled control) skips them. exampleFits(frame) waits until the example document fits its frame (no
// vertical scroll range left), so the target cannot move under a pointer action for that reason.
export async function exampleFits(frame, { timeout } = {}) {
  await expect
    .poll(() => frame.locator('html').evaluate(root => root.scrollHeight <= innerHeight), { message: 'the example frame has grown to fit its content', timeout })
    .toBe(true);
}

export async function documentsLoaded(page, { timeout = BOUND_MS } = {}) {
  await docsReady(page, { timeout });
  await expect
    .poll(() => pendingLoad(page), { message: 'every current frame has loaded and the network is quiet', timeout })
    .toEqual([]);
}
