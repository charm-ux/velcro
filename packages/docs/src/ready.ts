/**
 * The docs page readiness signal: `data-docs-ready` on <litro-outlet>. Browser-only; loaded by app-main.ts.
 *
 * Litro's client router replaces the prerendered page with a freshly rendered page component once after load. That
 * remount replaces every example iframe, so the prerendered frames and anything read from them before the remount are
 * gone. The router marks the outlet `data-litro-settled` when it has rendered, which says nothing about the new frames.
 *
 * The signal is set once, for the page component the router mounted last, when all of these hold:
 * - the router has settled and the outlet holds only that page component, visible (the remount has finished);
 * - the page component has rendered and the fragment (location.hash) has been revealed;
 * - the document has loaded and the docs page's Velcro runtime has been evaluated;
 * - every iframe the page holds at that moment (through nested shadow roots and same-origin frame documents) has loaded
 *   the document it names, and still does two animation frames later (see settle);
 * - the fragment has been revealed again if the page has moved under it and the reader has not moved (see settle).
 * It is removed as soon as the outlet's page changes or a navigation to another path starts, and set again for the next
 * page. Waiting stops (listeners and all) when the page is replaced, or after SETTLE_LIMIT_MS without the signal: a page
 * that has not loaded by then is never marked ready.
 */
export const READY_ATTRIBUTE = 'data-docs-ready';
const SETTLED_ATTRIBUTE = 'data-litro-settled';
const SETTLE_LIMIT_MS = 60_000;
// How often the frame set is read again while a frame is loading: frames can be added or removed without a load event.
const RECHECK_MS = 100;
// Events that mean the reader is moving around the page themselves.
const INTENT_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;

class Abandoned extends Error {}

// Resolves with `promise`, or rejects with Abandoned once `signal` aborts.
function until<T>(promise: PromiseLike<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) return reject(new Abandoned());
    const abandon = () => reject(new Abandoned());
    signal.addEventListener('abort', abandon, { once: true });
    promise.then(
      value => {
        signal.removeEventListener('abort', abandon);
        resolve(value);
      },
      error => {
        signal.removeEventListener('abort', abandon);
        reject(error);
      }
    );
  });
}

const nextFrame = (signal: AbortSignal) => until(new Promise<void>(resolve => requestAnimationFrame(() => resolve())), signal);

const documentLoaded = (signal: AbortSignal) =>
  document.readyState === 'complete'
    ? Promise.resolve()
    : until(new Promise<void>(resolve => addEventListener('load', () => resolve(), { once: true, signal })), signal);

function sameOriginDocument(frame: HTMLIFrameElement): Document | null {
  try {
    return frame.contentDocument;
  } catch {
    return null;
  }
}

// Every iframe in `root`, through open shadow roots and into same-origin frame documents (an example can add its own).
function framesIn(root: ParentNode, found: HTMLIFrameElement[] = []): HTMLIFrameElement[] {
  for (const el of root.querySelectorAll('*')) {
    // Elements of a frame document are instances of that document's own HTMLIFrameElement: compare the name.
    if (el.localName === 'iframe') {
      found.push(el as HTMLIFrameElement);
      const doc = sameOriginDocument(el as HTMLIFrameElement);
      if (doc) framesIn(doc, found);
    }
    if (el.shadowRoot) framesIn(el.shadowRoot, found);
  }
  return found;
}

const framesOf = (page: Element) => (page.shadowRoot ? framesIn(page.shadowRoot, framesIn(page)) : framesIn(page));

// A frame has loaded once its document is complete. A frame whose element names a document (src or srcdoc) has not
// started loading it while it still shows the initial about:blank. A cross-origin document cannot be read; such a frame
// counts as loaded once its load event has been seen (`sawLoad`). A frame removed from the page is no longer read.
function frameLoaded(frame: HTMLIFrameElement, sawLoad: WeakSet<HTMLIFrameElement>): boolean {
  let doc: Document | null;
  try {
    doc = frame.contentDocument;
  } catch {
    return sawLoad.has(frame);
  }
  if (!doc) return !frame.isConnected || sawLoad.has(frame);
  const named = frame.hasAttribute('srcdoc') || Boolean(frame.getAttribute('src'));
  return !(named && doc.URL === 'about:blank') && doc.readyState === 'complete';
}

const scrollPosition = () => `${scrollX},${scrollY}`;

export function trackReadiness(outlet: Element, { reveal, runtime }: { reveal: () => void; runtime: Promise<unknown> }): void {
  let current: Element | null = null;
  let stop: AbortController | null = null;
  let path = '';
  const retired = new WeakSet<Element>();
  const pathOf = () => location.pathname + location.search;

  const reset = () => {
    stop?.abort();
    stop = null;
    if (current) retired.add(current);
    current = null;
    outlet.removeAttribute(READY_ATTRIBUTE);
  };

  const settle = async (page: Element & { updateComplete?: Promise<unknown> }, signal: AbortSignal) => {
    await until(Promise.resolve(page.updateComplete), signal);
    await nextFrame(signal);
    await nextFrame(signal);
    reveal();
    // Example frames size themselves to their content as they load, which moves everything below them. Engines with
    // scroll anchoring move the scroll position to keep the revealed fragment in place; engines without it (WebKit)
    // leave the scroll position, and the fragment, where they were. So the fragment is revealed again at the end only
    // if the scroll position is still the one the reveal left and the reader has not interacted with the page since. A
    // reader scrolling by any means (including from inside an example, whose events never reach this window) moves it.
    const revealedAt = scrollPosition();
    let moved = false;
    for (const type of INTENT_EVENTS) {
      addEventListener(type, () => (moved = true), { capture: true, passive: true, signal });
    }
    await documentLoaded(signal);
    await until(runtime, signal);
    // Wait until every frame the page holds has loaded, reading the frame set again after each load (a load can add
    // frames) and every RECHECK_MS (frames can be added or removed at any time), and once more two animation frames
    // after they all had: the signal is set in the same task as that final reading.
    const sawLoad = new WeakSet<HTMLIFrameElement>();
    const watching = new WeakSet<HTMLIFrameElement>();
    let wake = () => {};
    for (;;) {
      const frames = framesOf(page);
      const loading = frames.filter(frame => !frameLoaded(frame, sawLoad));
      if (loading.length === 0) {
        await nextFrame(signal);
        await nextFrame(signal);
        if (framesOf(page).every(frame => frameLoaded(frame, sawLoad))) break;
        continue;
      }
      for (const frame of loading) {
        if (watching.has(frame)) continue;
        watching.add(frame);
        frame.addEventListener('load', () => (sawLoad.add(frame), wake()), { signal });
      }
      let timer: ReturnType<typeof setTimeout> | undefined;
      await until(
        new Promise<void>(resolve => {
          wake = resolve;
          timer = setTimeout(resolve, RECHECK_MS);
        }),
        signal
      ).finally(() => clearTimeout(timer));
    }
    if (!moved && scrollPosition() === revealedAt) reveal();
    outlet.setAttribute(READY_ATTRIBUTE, '');
  };

  // The router appends the new page hidden, removes the old one, shows the new one and marks the outlet settled, all in
  // one task; this runs after it (a mutation observer callback), so it sees either the old page or the finished remount.
  const check = () => {
    const children = [...outlet.children];
    const page =
      outlet.hasAttribute(SETTLED_ATTRIBUTE) && children.length === 1 && !children[0].hasAttribute('hidden') && !retired.has(children[0])
        ? children[0]
        : null;
    if (page && page === current) return;
    reset();
    if (!page) return;
    current = page;
    path = pathOf();
    const run = new AbortController();
    stop = run;
    const limit = setTimeout(() => {
      console.warn(`docs: ${location.pathname} did not finish loading within ${SETTLE_LIMIT_MS / 1000} s; it is not marked ${READY_ATTRIBUTE}`);
      run.abort();
    }, SETTLE_LIMIT_MS);
    settle(page, run.signal)
      .catch(error => {
        if (!(error instanceof Abandoned)) throw error;
      })
      .finally(() => {
        clearTimeout(limit);
        run.abort(); // removes every listener this run added
      });
  };

  new MutationObserver(check).observe(outlet, { childList: true, attributes: true, attributeFilter: [SETTLED_ATTRIBUTE] });
  // A client-side navigation to another path (the router's go() or back/forward across pushed entries) starts with a
  // popstate, well before the router mounts the next page: the current page is no longer the ready one.
  addEventListener('popstate', () => {
    if (current && pathOf() !== path) reset();
  });
  check();
}
