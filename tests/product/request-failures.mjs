// Collects failed requests and HTTP errors for a page. Litro's client router remounts the page once after load, which
// reloads every example iframe and aborts that frame's in-flight module requests. Those aborts (net::ERR_ABORTED on a
// subframe request whose frame was detached or navigated afterwards) are expected and are not counted. Everything else
// still counts: any other error text, any aborted main-frame request, any aborted request from a frame that stayed put,
// and any HTTP error status.
export function collectRequestFailures(page) {
  const failures = [];
  const aborted = [];
  const navigations = new Map();
  const startedAt = new Map();
  const navCount = frame => navigations.get(frame) ?? 0;

  page.on('framenavigated', frame => navigations.set(frame, navCount(frame) + 1));
  page.on('request', request => startedAt.set(request, navCount(request.frame())));
  page.on('response', response => {
    if (response.status() >= 400) failures.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  page.on('requestfailed', request => {
    const entry = `failed ${new URL(request.url()).pathname}`;
    const frame = request.frame();
    if (request.failure()?.errorText === 'net::ERR_ABORTED' && frame !== page.mainFrame()) aborted.push({ entry, frame, request });
    else failures.push(entry);
  });

  // Call once the page has settled; a frame navigation can commit after the request it aborted has failed.
  return () => {
    const unexplained = aborted
      .filter(({ frame, request }) => !(frame.isDetached() || navCount(frame) > startedAt.get(request)))
      .map(({ entry }) => entry);
    return [...failures, ...unexplained];
  };
}
