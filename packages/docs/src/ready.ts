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
 * - every iframe in the page component (through nested shadow roots) has loaded the document it names, and the
 *   fragment has been revealed again unless the reader has moved since (see settle).
 * It is removed as soon as the outlet's page changes or a navigation to another path starts, and set again for the next
 * page. Example frames added later (on request) are not waited for.
 */
export const READY_ATTRIBUTE = 'data-docs-ready';
const SETTLED_ATTRIBUTE = 'data-litro-settled';
// Events that mean the reader is moving around the page themselves.
const INTENT_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;

const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

const documentLoaded = () =>
  document.readyState === 'complete' ? Promise.resolve() : new Promise<void>(resolve => addEventListener('load', () => resolve(), { once: true }));

function framesIn(root: Element | ShadowRoot, found: HTMLIFrameElement[] = []): HTMLIFrameElement[] {
  for (const el of root.querySelectorAll('*')) {
    if (el instanceof HTMLIFrameElement) found.push(el);
    if (el.shadowRoot) framesIn(el.shadowRoot, found);
  }
  return found;
}

// A frame has loaded once its document is complete. A frame whose element names a document (src or srcdoc) has not
// started loading it while it still shows the initial about:blank. A cross-origin document cannot be read; its frame's
// load event is the only report. A frame removed from the page will not load; the page is then being replaced anyway.
function frameLoaded(frame: HTMLIFrameElement): Promise<void> {
  const state = (): 'loaded' | 'loading' | 'opaque' => {
    let doc: Document | null = null;
    try {
      doc = frame.contentDocument;
    } catch {
      return 'opaque';
    }
    if (!doc) return frame.isConnected ? 'opaque' : 'loaded';
    const named = frame.hasAttribute('srcdoc') || Boolean(frame.getAttribute('src'));
    return named && doc.URL === 'about:blank' ? 'loading' : doc.readyState === 'complete' ? 'loaded' : 'loading';
  };
  if (state() === 'loaded') return Promise.resolve();
  return new Promise(resolve => {
    const onLoad = () => {
      if (state() === 'loading') return;
      frame.removeEventListener('load', onLoad);
      resolve();
    };
    frame.addEventListener('load', onLoad);
  });
}

export function trackReadiness(outlet: Element, { reveal, runtime }: { reveal: () => void; runtime: Promise<unknown> }): void {
  let current: Element | null = null;
  let generation = 0;
  let path = '';
  const retired = new WeakSet<Element>();
  const pathOf = () => location.pathname + location.search;

  const reset = () => {
    generation++;
    if (current) retired.add(current);
    current = null;
    outlet.removeAttribute(READY_ATTRIBUTE);
  };

  const settle = async (page: Element & { updateComplete?: Promise<unknown> }, run: number) => {
    await page.updateComplete;
    await nextFrame();
    await nextFrame();
    if (run !== generation) return;
    reveal();
    // Example frames size themselves to their content as they load, which moves everything below them. Engines without
    // scroll anchoring (WebKit) leave the fragment where it was, so reveal it again once they have loaded and sized
    // themselves, unless the reader has scrolled or interacted in the meantime.
    let moved = false;
    const onIntent = () => {
      moved = true;
    };
    for (const type of INTENT_EVENTS) addEventListener(type, onIntent, { capture: true, passive: true });
    try {
      await documentLoaded();
      await runtime;
      const frames = page.shadowRoot ? framesIn(page.shadowRoot, framesIn(page)) : framesIn(page);
      await Promise.all(frames.map(frameLoaded));
      await nextFrame();
      await nextFrame();
    } finally {
      for (const type of INTENT_EVENTS) removeEventListener(type, onIntent, { capture: true });
    }
    if (run !== generation) return;
    if (!moved) reveal();
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
    void settle(page, generation);
  };

  new MutationObserver(check).observe(outlet, { childList: true, attributes: true, attributeFilter: [SETTLED_ATTRIBUTE] });
  // A client-side navigation to another path (the router's go() or back/forward across pushed entries) starts with a
  // popstate, well before the router mounts the next page: the current page is no longer the ready one.
  addEventListener('popstate', () => {
    if (current && pathOf() !== path) reset();
  });
  check();
}
