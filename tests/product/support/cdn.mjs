// The icon docs page registers third-party icon libraries that load from jsDelivr. Tests never reach the CDN: every
// request to it is answered here with a small generated SVG (CORS-enabled, like the CDN) and recorded.
export const CDN_HOST = 'cdn.jsdelivr.net';

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
