// Collects failed requests and HTTP errors for a page. Litro's client router remounts the page once after load, which
// reloads every example iframe and aborts that frame's in-flight requests. Those aborts (a cancelled subframe request whose
// frame was detached or navigated afterwards) are expected and are not counted. Engines name the cancellation differently:
// net::ERR_ABORTED in Chromium, NS_BINDING_ABORTED in Firefox. Everything else still counts: any other error text, any
// aborted main-frame request, any aborted request from a frame that stayed put, and any HTTP error status.
// `failures.cancelled()` returns the URLs of the requests the remount cut off (excused aborts, and requests of a replaced
// frame that never finished), for callers that also check console errors: Firefox reports a cancelled script load as a
// console error too (see LOAD_FAILED).
const ABORTED = new Set(['net::ERR_ABORTED', 'NS_BINDING_ABORTED']);

// Firefox's console report of a script or module load that did not complete (the URL is in typographic quotes).
export const LOAD_FAILED = /^Loading failed for the (?:module|<script>) with source \u201c(.+)\u201d\.$/;

export function collectRequestFailures(page) {
  const failures = [];
  const aborted = [];
  const navigations = new Map();
  const startedAt = new Map();
  const unfinished = new Set();
  const navCount = frame => navigations.get(frame) ?? 0;

  page.on('framenavigated', frame => navigations.set(frame, navCount(frame) + 1));
  page.on('request', request => { startedAt.set(request, navCount(request.frame())); unfinished.add(request); });
  page.on('requestfinished', request => unfinished.delete(request));
  page.on('response', response => {
    if (response.status() >= 400) failures.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  page.on('requestfailed', request => {
    unfinished.delete(request);
    const entry = `failed ${new URL(request.url()).pathname}`;
    const frame = request.frame();
    if (ABORTED.has(request.failure()?.errorText) && frame !== page.mainFrame()) aborted.push({ entry, frame, request });
    else failures.push(entry);
  });

  const replaced = ({ frame, request }) => frame.isDetached() || navCount(frame) > startedAt.get(request);
  // Call once the page has settled; a frame navigation can commit after the request it aborted has failed.
  const collected = () => [...failures, ...aborted.filter(entry => !replaced(entry)).map(({ entry }) => entry)];
  collected.cancelled = () => new Set([...aborted.filter(replaced).map(({ request }) => request.url()),
    ...[...unfinished].filter(request => replaced({ frame: request.frame(), request })).map(request => request.url())]);
  return collected;
}
