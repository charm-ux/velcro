// The icon docs page registers third-party icon libraries that load from jsDelivr, but only when the reader asks for them.
// Tests never reach the CDN. guardCdn records any request to it without intercepting anything; the specs assert that it
// stays empty. stubCdn answers CDN requests locally with a small generated SVG (CORS-enabled, like the CDN) and records
// them; install it only after the page has settled. Once a route exists, Playwright turns off the HTTP cache, and WebKit
// then requests the sprite sheet once per <use> (about 2000 times on the icon page). It also leaves the requests of the
// example frames the client router replaced unfinished, so the page never reaches network idle.
export const CDN_HOST = 'cdn.jsdelivr.net';

export function guardCdn(page) {
  const requests = [];
  page.on('request', request => { if (new URL(request.url()).hostname === CDN_HOST) requests.push(request.url()); });
  return requests;
}

export async function stubCdn(page) {
  const requests = [];
  await page.route(url => url.hostname === CDN_HOST, route => {
    requests.push(route.request().url());
    return route.fulfill({
      status: 200,
      headers: { 'content-type': 'image/svg+xml', 'access-control-allow-origin': '*' },
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M0 0h16v16H0z"/></svg>',
    });
  });
  return requests;
}
