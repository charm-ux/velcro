import { expect } from '@playwright/test';

// The wait after Litro's client router has remounted a docs page (the remount replaces every example iframe): the router
// has settled, every current frame's document has loaded, and the network has been quiet for QUIET_MS.
//
// This stands in for Playwright's networkidle, which counts a frame idle only once every request it saw start there has
// reported finishing or failing. A load the remount cancels without a report kept that wait pending until the test
// timeout. Here, like request-failures.mjs, an unfinished request is excused only if its frame has since been detached or
// navigated to another document; any other unfinished request, a frame still loading, or ongoing network activity keeps
// the wait pending, and it fails at its own bound. Completion is not success: a resource that fails to load still
// completes its document, so request failures stay the business of the specs' own request checks.
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

export async function documentsLoaded(page, { timeout = BOUND_MS } = {}) {
  await expect(page.locator('litro-outlet')).toHaveAttribute('data-litro-settled', '');
  await expect
    .poll(() => pendingLoad(page), { message: 'every current frame has loaded and the network is quiet', timeout })
    .toEqual([]);
}
