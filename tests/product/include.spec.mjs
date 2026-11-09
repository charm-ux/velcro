import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { buildFixtures } from './support/fixtures.mjs';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';

const PAGE = '/components/include';
const loopback = ['127', '0', '0', '1'].join('.');

// ---- the documentation page and its examples (the production build, served by the product server) ----

async function openExample(page, name = 'Overview') {
  watchNetwork(page);
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  const frame = page.frameLocator(`iframe.example[title="Include example: ${name}"]`);
  await frame.locator('body').evaluate(() => customElements.whenDefined('sl-include'));
  // Rendering only: a test that reads the requests waits for the network to go quiet itself (documentsLoaded).
  return { frame, requests };
}

test('docs page is prerendered with Velcro branding, prototype status, the quirks, the request helper and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Include - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('@charm-ux/velcro/include/request');
  expect(html).toContain('Be sure you trust the content you are including');
  expect(html).toContain('without changing the shared core prefix');
  // The example documents are same-site: no Shoelace host is requested or linked.
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(html).not.toMatch(/(src|href)=(&quot;|")[^"&]*shoelace/i);
  expect(await (await request.get('/')).text()).toContain('/components/include');
  // The fixture the examples include is served by the site itself.
  const fixture = await request.get('/include-fixtures/hello/');
  expect(fixture.ok()).toBe(true);
  expect(await fixture.text()).toContain('comes from another HTML document');
});

test('sl-include registers as the exported class with no core marker attribute, one slot and no ch-* definition', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  await documentsLoaded(page);
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
  const r = await frame.locator('#demo-default').evaluate(async el => {
    await el.updateComplete;
    return {
      ctor: customElements.get('sl-include') === el.constructor,
      baseName: el.constructor.baseName,
      attributes: el.getAttributeNames().sort(),
      children: [...el.shadowRoot.children].filter(n => n.localName !== 'style').map(n => n.localName),
      slotName: el.shadowRoot.querySelector('slot').name,
      display: getComputedStyle(el).display,
      boxSizing: getComputedStyle(el).boxSizing,
      chDefined: ['ch-include'].filter(tag => customElements.get(tag)),
    };
  });
  expect(r.ctor).toBe(true);
  expect(r.baseName).toBe('include');
  expect(r.attributes).toEqual(['id', 'src']);
  expect(r.children).toEqual(['slot']);
  expect(r.slotName).toBe('');
  expect(r.display).toBe('block');
  // The styles are Shoelace's: block display and border-box sizing on the host, nothing else.
  expect(r.boxSizing).toBe('border-box');
  expect(r.chDefined).toEqual([]);
});

test('overview: the fixture is requested once from the site, inserted into the light DOM, and its script stays inert', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  await documentsLoaded(page);
  const include = frame.locator('#demo-default');
  await expect(include).toContainText('comes from another HTML document');
  // The fixture is requested from the site itself (a router remount reloads the iframe, so it may be requested again).
  const fixtureRequests = requests.filter(url => url.includes('/include-fixtures/'));
  expect(fixtureRequests.length).toBeGreaterThan(0);
  expect(fixtureRequests.every(url => new URL(url).origin === new URL(page.url()).origin && new URL(url).pathname.endsWith('/include-fixtures/hello/'))).toBe(true);
  const r = await include.evaluate(el => ({
    scripts: el.querySelectorAll('script').length,
    status: el.querySelector('.include-script-status').textContent,
    lightChildren: [...el.children].map(c => c.localName),
    shadowText: el.shadowRoot.textContent.trim().length,
  }));
  expect(r.scripts).toBe(1);
  expect(r.status).toContain('has not run');
  expect(r.lightChildren).toEqual(['p', 'p', 'p', 'script']);
  expect(r.shadowText).toBe(0);
});

test('allow-scripts example: the included script is re-created, copied attribute for attribute, and runs', async ({ page }) => {
  const { frame } = await openExample(page, 'Allowing Scripts');
  const include = frame.locator('#demo-scripts');
  await expect(include.locator('.include-script-status')).toContainText('The script in this file ran');
  expect(await include.evaluate(el => el.querySelectorAll('script').length)).toBe(1);
});

test('events example: sl-load is reported for the loaded include and the button makes a second include report sl-error 404', async ({ page }) => {
  const { frame } = await openExample(page, 'Listening for Events');
  const log = frame.locator('#demo-log');
  await expect(log).toHaveText('demo-events: sl-load');
  const missing = page.waitForResponse(response => response.url().endsWith('/include-fixtures/missing/'));
  await frame.locator('#demo-include-missing').click();
  expect((await missing).status()).toBe(404);
  await expect(log).toHaveText('demo-events: sl-load\ndemo-missing: sl-error, status 404');
  // The failed request left the (empty) include as it was.
  expect(await frame.locator('#demo-missing').evaluate(el => el.innerHTML)).toBe('');
});

// ---- behavior, in a blank page that serves the built library and answers /fx/* itself ----
// Both servers listen on the loopback address: the page's origin (`site`, which serves the built library and a blank page)
// and a second origin (`other`, which answers CORS requests as a real server would). They share an address space, so the
// browser's private-network rules do not interfere with the CORS checks being tested.
let outDir;
let site;
let siteServer;
let other;
let otherServer;
const otherLog = [];
// `serve` answers every /fx/* request (same-origin and cross-origin) from `routes`: a path maps to a response
// description, or to a function(route) for control. `log` lists "<origin><path>" in request order.
async function serve(page, routes = {}) {
  const log = [];
  const state = { routes, log };
  await page.route(url => url.pathname.startsWith('/fx/') && url.origin === site, async route => {
    const url = new URL(route.request().url());
    log.push(`${url.origin === site ? '' : url.origin}${url.pathname}`);
    const def = state.routes[url.pathname];
    if (typeof def === 'function') return def(route);
    if (def === 'abort') return route.abort('connectionrefused');
    if (!def) return route.fulfill({ status: 404, contentType: 'text/html', body: 'not found' });
    return route.fulfill({ status: 200, contentType: 'text/html', ...def });
  });
  return state;
}

async function prepare(page) {
  await page.route(url => url.origin !== site && url.origin !== other, route => route.abort());
  await page.route(url => url.origin === other, route => route.continue());
  await page.goto(`${site}/`);
  await page.evaluate(async () => {
    await import('/root.js');
    window.mk = (attrs = {}, inner = '', parent = document.body) => {
      const el = document.createElement('sl-include');
      el.events = [];
      for (const type of ['sl-load', 'sl-error']) {
        el.addEventListener(type, e => el.events.push({ type, detail: JSON.parse(JSON.stringify(e.detail)), bubbles: e.bubbles, composed: e.composed, cancelable: e.cancelable, atTarget: e.eventPhase === Event.AT_TARGET }));
      }
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      el.innerHTML = inner;
      parent.append(el);
      window.last = el;
      return el;
    };
    window.quiet = () => new Promise(resolve => setTimeout(resolve, 150));
  });
  await page.evaluate(origin => { window.otherOrigin = origin; }, other);
}

const events = page => page.evaluate(() => window.last.events);
const waitForEvents = (page, n) => expect.poll(() => page.evaluate(() => window.last.events.length)).toBe(n);
const quiet = page => page.evaluate(() => window.quiet());

test.describe('behavior in a blank page', () => {
  test.beforeAll(async () => {
    otherServer = createServer((req, res) => {
      otherLog.push(`${req.url} ${req.headers['sec-fetch-mode']}`);
      const headers = { 'content-type': 'text/html' };
      if (req.url !== '/fx/closed') headers['access-control-allow-origin'] = '*';
      res.writeHead(200, headers).end(req.url.slice('/fx/'.length));
    });
    await new Promise(resolve => otherServer.listen(0, loopback, resolve));
    other = `http://${loopback}:${otherServer.address().port}`;
    outDir = await buildFixtures({
      root: "export * from '@charm-ux/velcro';",
      request: "export * from '@charm-ux/velcro/include/request';",
      includeClass: "export * from '@charm-ux/velcro/include/class';",
    });
    siteServer = createServer((req, res) => {
      const pathname = new URL(req.url, 'http://site.invalid').pathname;
      if (pathname === '/') return res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><html><body></body></html>');
      const file = path.join(outDir, pathname);
      if (!file.startsWith(outDir + path.sep)) return res.writeHead(403).end();
      try {
        res.writeHead(200, { 'content-type': 'text/javascript' }).end(readFileSync(file));
      } catch {
        res.writeHead(404).end('not found');
      }
    });
    await new Promise(resolve => siteServer.listen(0, loopback, resolve));
    site = `http://${loopback}:${siteServer.address().port}`;
  });

  test.afterAll(async () => {
    await Promise.all([siteServer, otherServer].map(server => new Promise(resolve => server.close(resolve))));
  });

  test.beforeEach(async ({ page }) => {
    otherLog.length = 0;
    await prepare(page);
  });

  test('a successful request replaces all children, emits sl-load once (bubbling, composed, not cancelable, empty detail) and no sl-error', async ({ page }) => {
    const server = await serve(page, { '/fx/a': { body: '<p id="inc">Loaded</p>' } });
    await page.evaluate(() => mk({ src: '/fx/a' }, '<b>fallback</b>text'));
    await waitForEvents(page, 1);
    await quiet(page);
    expect(await events(page)).toEqual([{ type: 'sl-load', detail: {}, bubbles: true, composed: true, cancelable: false, atTarget: true }]);
    expect(await page.evaluate(() => window.last.innerHTML)).toBe('<p id="inc">Loaded</p>');
    expect(server.log).toEqual(['/fx/a']);
  });

  test('the properties have Shoelace\'s defaults and none of them reflects', async ({ page }) => {
    await serve(page, { '/fx/m': { body: 'ok' } });
    await page.evaluate(() => mk({ src: '/fx/m' }));
    await waitForEvents(page, 1);
    expect(await page.evaluate(() => [window.last.mode, window.last.allowScripts, window.last.src, window.last.getAttributeNames()])).toEqual(['cors', false, '/fx/m', ['src']]);
  });

  test('a response that is not ok emits sl-error with its status and leaves the earlier content in place', async ({ page }) => {
    const server = await serve(page, { '/fx/ok': { body: '<p>First</p>' }, '/fx/gone': { status: 410, body: 'gone' } });
    await page.evaluate(() => mk({ src: '/fx/ok' }));
    await waitForEvents(page, 1);
    await page.evaluate(() => { window.last.src = '/fx/gone'; });
    await waitForEvents(page, 2);
    expect(await events(page)).toEqual([
      { type: 'sl-load', detail: {}, bubbles: true, composed: true, cancelable: false, atTarget: true },
      { type: 'sl-error', detail: { status: 410 }, bubbles: true, composed: true, cancelable: false, atTarget: true },
    ]);
    expect(await page.evaluate(() => window.last.innerHTML)).toBe('<p>First</p>');
    expect(server.log).toEqual(['/fx/ok', '/fx/gone']);
  });

  test('a failed network request emits sl-error with status -1', async ({ page }) => {
    await serve(page, { '/fx/refused': 'abort' });
    await page.evaluate(() => mk({ src: '/fx/refused' }, 'kept'));
    await waitForEvents(page, 1);
    expect(await events(page)).toEqual([{ type: 'sl-error', detail: { status: -1 }, bubbles: true, composed: true, cancelable: false, atTarget: true }]);
    expect(await page.evaluate(() => window.last.innerHTML)).toBe('kept');
  });

  test('upstream quirk: responses are cached by src for the page life, so includes share one request and a failure keeps failing without a new request', async ({ page }) => {
    const server = await serve(page, { '/fx/shared': { body: '<i>shared</i>' }, '/fx/flaky': { status: 503, body: 'down' }, '/fx/refused': 'abort' });
    await page.evaluate(() => { mk({ src: '/fx/shared' }); mk({ src: '/fx/shared' }); });
    await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('sl-include')].every(el => el.events.length === 1))).toBe(true);
    expect(server.log).toEqual(['/fx/shared']);

    // A 503 is cached; when the server recovers a new include for the same src still reports the 503 and requests nothing.
    await page.evaluate(() => mk({ src: '/fx/flaky' }));
    await waitForEvents(page, 1);
    server.routes['/fx/flaky'] = { body: '<i>recovered</i>' };
    await page.evaluate(() => mk({ src: '/fx/flaky' }));
    await waitForEvents(page, 1);
    expect(await events(page)).toEqual([{ type: 'sl-error', detail: { status: 503 }, bubbles: true, composed: true, cancelable: false, atTarget: true }]);
    expect(await page.evaluate(() => window.last.innerHTML)).toBe('');
    expect(server.log.filter(p => p === '/fx/flaky')).toHaveLength(1);

    // A rejected request stays rejected too.
    await page.evaluate(() => mk({ src: '/fx/refused' }));
    await waitForEvents(page, 1);
    server.routes['/fx/refused'] = { body: 'back' };
    await page.evaluate(() => mk({ src: '/fx/refused' }));
    await waitForEvents(page, 1);
    expect((await events(page))[0].detail).toEqual({ status: -1 });
    expect(server.log.filter(p => p === '/fx/refused')).toHaveLength(1);
  });

  test('upstream quirk: the cache key is src alone, so a cached src ignores mode', async ({ page }) => {
    const server = await serve(page, { '/fx/k': route => route.fulfill({ status: 200, contentType: 'text/html', body: 'k', headers: { 'access-control-allow-origin': '*' } }) });
    await page.evaluate(() => mk({ src: '/fx/k', mode: 'same-origin' }));
    await waitForEvents(page, 1);
    // A second request for the same src with another mode is never made: the request log shows one request, and the second include
    // gets the cached success.
    await page.evaluate(() => mk({ src: '/fx/k', mode: 'no-cors' }));
    await waitForEvents(page, 1);
    expect((await events(page))[0].type).toBe('sl-load');
    expect(server.log).toEqual(['/fx/k']);
    // Across origins the difference would show: a fresh no-cors request to the other origin ends in sl-error 0 (see the modes test),
    // but after a cors success for that src the no-cors include loads from the cache and the other server sees one request.
    await page.evaluate(() => mk({ src: window.otherOrigin + '/fx/cache-open', mode: 'cors' }));
    await waitForEvents(page, 1);
    await page.evaluate(() => mk({ src: window.otherOrigin + '/fx/cache-open', mode: 'no-cors' }));
    await waitForEvents(page, 1);
    expect(await events(page)).toMatchObject([{ type: 'sl-load' }]);
    expect(otherLog).toEqual(['/fx/cache-open cors']);
  });

  test('modes: cors needs the other server to allow it, no-cors is opaque across origins (sl-error 0) but readable on the same origin, same-origin refuses another origin', async ({ page }) => {
    // A real second origin (a loopback server on its own port): the browser enforces CORS on it, which it does not do for responses a test fulfills itself.
    await serve(page, { '/fx/same': { body: 'same' }, '/fx/same-no-cors': { body: 'readable' } });
    const outcome = async attrs => {
      await page.evaluate(attrs => mk(attrs), attrs);
      await waitForEvents(page, 1);
      return page.evaluate(() => ({ ...window.last.events[0], html: window.last.innerHTML }));
    };
    const plain = e => [e.type, e.detail.status ?? null, e.html];
    expect(plain(await outcome({ src: `${other}/fx/open` }))).toEqual(['sl-load', null, 'open']);
    expect(plain(await outcome({ src: `${other}/fx/closed` }))).toEqual(['sl-error', -1, '']); // no CORS header: the browser refuses it
    expect(plain(await outcome({ src: `${other}/fx/opaque`, mode: 'no-cors' }))).toEqual(['sl-error', 0, '']);
    // The opaque response is what ends in status 0, not the mode: a fresh (uncached) same-origin no-cors request is a basic response.
    expect(plain(await outcome({ src: '/fx/same-no-cors', mode: 'no-cors' }))).toEqual(['sl-load', null, 'readable']);
    expect(plain(await outcome({ src: '/fx/same', mode: 'same-origin' }))).toEqual(['sl-load', null, 'same']);
    expect(plain(await outcome({ src: `${other}/fx/cross-same`, mode: 'same-origin' }))).toEqual(['sl-error', -1, '']);
    // The default mode is cors and the mode property is what the request is made with; the same-origin request to the other origin was refused before it was sent.
    expect(otherLog).toEqual(['/fx/open cors', '/fx/closed cors', '/fx/opaque no-cors']);
    // The opaque failure was cached with the src: a default (cors) include for it reports status 0 without a request.
    expect(plain(await outcome({ src: `${other}/fx/opaque` }))).toEqual(['sl-error', 0, '']);
    expect(otherLog).toHaveLength(3);
  });

  test('only src starts a request: mode and allow-scripts changes do nothing, and allow-scripts only applies to content loaded afterwards', async ({ page }) => {
    const script = (n) => ({ body: `<p>${n}</p><script id="s${n}">window.ran = (window.ran ?? []).concat('${n}')</script>` });
    const server = await serve(page, { '/fx/one': script(1), '/fx/two': script(2), '/fx/three': script(3) });
    await page.evaluate(() => mk({ src: '/fx/one' }));
    await waitForEvents(page, 1);
    await page.evaluate(() => { window.last.mode = 'same-origin'; window.last.allowScripts = true; });
    await quiet(page);
    expect(server.log).toEqual(['/fx/one']);
    expect(await page.evaluate(() => [window.ran ?? [], window.last.events.length])).toEqual([[], 1]);
    // The next src runs its scripts (allow-scripts is now set); the scripts that were already inserted stay inert.
    await page.evaluate(() => { window.last.src = '/fx/two'; });
    await waitForEvents(page, 2);
    expect(await page.evaluate(() => window.ran)).toEqual(['2']);
    await page.evaluate(() => { window.last.allowScripts = false; window.last.src = '/fx/three'; });
    await waitForEvents(page, 3);
    expect(await page.evaluate(() => [window.ran, window.last.allowScripts])).toEqual([['2'], false]);
  });

  test('allow-scripts: scripts are re-created in place with their attributes and run in document order; without it none run', async ({ page }) => {
    await serve(page, { '/fx/s': { body: '<script data-a="1" id="first">window.order = [1]</script><div><script type="text/javascript" data-b="2">window.order.push(2)</script></div>' } });
    await page.evaluate(() => mk({ src: '/fx/s', 'allow-scripts': '' }));
    await waitForEvents(page, 1);
    const r = await page.evaluate(() => ({
      order: window.order,
      scripts: [...window.last.querySelectorAll('script')].map(s => [s.id, s.dataset.a ?? null, s.dataset.b ?? null, s.type, s.parentElement.localName, s.textContent]),
    }));
    expect(r.order).toEqual([1, 2]);
    expect(r.scripts).toEqual([['first', '1', null, '', 'sl-include', 'window.order = [1]'], ['', null, '2', 'text/javascript', 'div', 'window.order.push(2)']]);
  });

  test('upstream quirk: a response for a superseded src is dropped without sl-load or sl-error, whether it is ok or not', async ({ page }) => {
    let release;
    const held = new Promise(resolve => { release = resolve; });
    const server = await serve(page, {
      '/fx/slow': async route => { await held; await route.fulfill({ status: 200, contentType: 'text/html', body: '<p>slow</p>' }); },
      '/fx/fast': { body: '<p>fast</p>' },
    });
    await page.evaluate(() => mk({ src: '/fx/slow' }));
    await expect.poll(() => server.log.length).toBe(1);
    await page.evaluate(() => { window.last.src = '/fx/fast'; });
    await waitForEvents(page, 1);
    release();
    await quiet(page);
    await quiet(page);
    expect(await events(page)).toEqual([{ type: 'sl-load', detail: {}, bubbles: true, composed: true, cancelable: false, atTarget: true }]);
    expect(await page.evaluate(() => window.last.innerHTML)).toBe('<p>fast</p>');
    // The superseded response was still cached: another include for the slow src loads without a new request.
    await page.evaluate(() => mk({ src: '/fx/slow' }));
    await waitForEvents(page, 1);
    expect(server.log).toEqual(['/fx/slow', '/fx/fast']);
  });

  // The stale-src check runs after the request settles with a response; a request that rejects goes straight to the catch.
  test('upstream quirk: a superseded request that is rejected still emits sl-error -1 after the newer content loaded, a stale error response does not', async ({ page }) => {
    let releaseDoomed;
    let releaseBad;
    const doomed = new Promise(resolve => { releaseDoomed = resolve; });
    const bad = new Promise(resolve => { releaseBad = resolve; });
    const server = await serve(page, {
      '/fx/doomed': async route => { await doomed; await route.abort('connectionreset'); },
      '/fx/bad': async route => { await bad; await route.fulfill({ status: 500, contentType: 'text/html', body: 'bad' }); },
      '/fx/fast': { body: '<p>fast</p>' },
    });
    // A request that is rejected after src moved on: the newer file loads (sl-load), and then sl-error -1 follows for the old src.
    await page.evaluate(() => mk({ src: '/fx/doomed' }));
    await expect.poll(() => server.log.length).toBe(1);
    await page.evaluate(() => { window.last.src = '/fx/fast'; });
    await waitForEvents(page, 1);
    expect((await events(page)).map(e => e.type)).toEqual(['sl-load']);
    releaseDoomed();
    await waitForEvents(page, 2);
    expect((await events(page)).map(e => [e.type, e.detail])).toEqual([['sl-load', {}], ['sl-error', { status: -1 }]]);
    expect(await page.evaluate(() => [window.last.src, window.last.innerHTML])).toEqual(['/fx/fast', '<p>fast</p>']);
    // An error response for a superseded src is silent (the stale-src check comes before the ok check), and keeps the content.
    await page.evaluate(() => mk({ src: '/fx/bad' }));
    await expect.poll(() => server.log.length).toBe(3);
    await page.evaluate(() => { window.last.src = '/fx/fast'; });
    await waitForEvents(page, 1);
    releaseBad();
    await quiet(page);
    await quiet(page);
    expect((await events(page)).map(e => e.type)).toEqual(['sl-load']);
    expect(await page.evaluate(() => window.last.innerHTML)).toBe('<p>fast</p>');
  });

  test('upstream quirk: src A, then B, then A again is not stale: the first request for A completes it, so A is inserted and sl-load is emitted once per request', async ({ page }) => {
    let release;
    const held = new Promise(resolve => { release = resolve; });
    const server = await serve(page, {
      '/fx/a': async route => { await held; await route.fulfill({ status: 200, contentType: 'text/html', body: '<p>a</p>' }); },
      '/fx/b': { body: '<p>b</p>' },
    });
    await page.evaluate(() => mk({ src: '/fx/a' }));
    await expect.poll(() => server.log.length).toBe(1);
    await page.evaluate(() => { window.last.src = '/fx/b'; });
    await waitForEvents(page, 1);
    // The second request for a joins the cached, still pending request, so the server sees no new request.
    await page.evaluate(async () => { window.last.src = '/fx/a'; await window.last.updateComplete; });
    release();
    await waitForEvents(page, 3);
    await quiet(page);
    expect((await events(page)).map(e => e.type)).toEqual(['sl-load', 'sl-load', 'sl-load']);
    expect(await page.evaluate(() => [window.last.src, window.last.innerHTML])).toEqual(['/fx/a', '<p>a</p>']);
    expect(server.log).toEqual(['/fx/a', '/fx/b']);
  });

  test('upstream quirk: removing src requests "null", removing mode breaks the next request with sl-error -1, removing allow-scripts sets false', async ({ page }) => {
    const server = await serve(page, { '/fx/null': { body: '<p>the null file</p>' }, '/fx/next': { body: 'never requested' } });
    await page.evaluate(() => mk({ src: '/fx/first', mode: 'cors', 'allow-scripts': '' }));
    await waitForEvents(page, 1);
    expect((await events(page))[0].detail).toEqual({ status: 404 });
    // A relative "null" resolves against the document, which is the page origin root.
    await page.route(`${site}/null`, route => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>the null file</p>' }));
    await page.evaluate(() => { window.last.removeAttribute('src'); });
    await waitForEvents(page, 2);
    expect(await page.evaluate(() => [window.last.src, window.last.innerHTML])).toEqual([null, '<p>the null file</p>']);
    await page.evaluate(() => { window.last.removeAttribute('allow-scripts'); });
    expect(await page.evaluate(() => window.last.allowScripts)).toBe(false);
    await page.evaluate(() => { window.last.removeAttribute('mode'); });
    expect(await page.evaluate(() => window.last.mode)).toBe(null);
    await page.evaluate(() => { window.last.src = '/fx/next'; });
    await waitForEvents(page, 3);
    expect((await events(page))[2]).toMatchObject({ type: 'sl-error', detail: { status: -1 } });
    expect(server.log).toEqual(['/fx/first']);
    // The failed request for /fx/next was cached: a healthy include for it fails the same way, without a request.
    await page.evaluate(() => mk({ src: '/fx/next', mode: 'cors' }));
    await waitForEvents(page, 1);
    expect((await events(page))[0]).toMatchObject({ type: 'sl-error', detail: { status: -1 } });
    expect(server.log).toEqual(['/fx/first']);
  });

  test('sl-load and sl-error from an include nested in included content bubble to the outer include (hence the eventPhase check)', async ({ page }) => {
    await serve(page, { '/fx/outer': { body: '<sl-include id="inner" src="/fx/inner"></sl-include>' }, '/fx/inner': { body: '<em>inner</em>' } });
    await page.evaluate(() => mk({ src: '/fx/outer' }));
    await waitForEvents(page, 2);
    const all = await events(page);
    // The outer include's own event comes first; the inner include's event (target: the inner element) bubbles to it later.
    expect(all.map(e => [e.type, e.atTarget])).toEqual([['sl-load', true], ['sl-load', false]]);
    expect(await page.evaluate(() => window.last.querySelector('#inner').innerHTML)).toBe('<em>inner</em>');
  });

  test('nothing is requested for an include without a src, or until a detached include is connected', async ({ page }) => {
    const server = await serve(page, { '/fx/late': { body: 'late' } });
    await page.evaluate(() => mk());
    await quiet(page);
    await page.evaluate(() => { const el = document.createElement('sl-include'); el.src = '/fx/late'; window.detached = el; });
    await quiet(page);
    expect(server.log).toEqual([]);
    await page.evaluate(() => document.body.append(window.detached));
    await expect.poll(() => page.evaluate(() => window.detached.innerHTML)).toBe('late');
    expect(server.log).toEqual(['/fx/late']);
  });

  test('a src set as a property after upgrade and a src set by the attribute behave the same, and the properties keep Shoelace defaults', async ({ page }) => {
    await serve(page, { '/fx/p': { body: 'p' } });
    const r = await page.evaluate(() => {
      const el = document.createElement('sl-include');
      return { src: el.src, mode: el.mode, allowScripts: el.allowScripts, dir: el.dir, lang: el.lang, reflectedMode: el.hasAttribute('mode'), proto: Object.getOwnPropertyNames(el.constructor.prototype).sort() };
    });
    expect(r).toMatchObject({ mode: 'cors', allowScripts: false, reflectedMode: false });
    expect(r.src).toBeUndefined();
    expect(r.dir).toBeUndefined();
    expect(r.lang).toBeUndefined();
    expect(r.proto).toEqual(expect.arrayContaining(['handleSrcChange', 'render', 'executeScript']));
    await page.evaluate(() => { mk().src = '/fx/p'; });
    await waitForEvents(page, 1);
    expect(await page.evaluate(() => window.last.getAttributeNames())).toEqual([]);
  });

  test('upstream quirk: the hidden attribute does not hide an include (display: block on the host wins, and the [hidden] rule is inside the shadow root)', async ({ page }) => {
    await serve(page, { '/fx/h': { body: '<p>x</p>' } });
    const r = await page.evaluate(async () => {
      const el = mk({ src: '/fx/h' });
      await el.updateComplete;
      const before = getComputedStyle(el).display;
      el.hidden = true;
      return { before, after: getComputedStyle(el).display };
    });
    expect(r).toEqual({ before: 'block', after: 'block' });
  });

  test('the ready event of the core base element is emitted once, non-bubbling, after the first render', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const el = document.createElement('sl-include');
      const seen = [];
      el.addEventListener('ready', e => seen.push([e.bubbles, e.composed]));
      document.body.append(el);
      await el.updateComplete;
      el.lang = 'en';
      await el.updateComplete;
      return seen;
    });
    expect(r).toEqual([[false, false]]);
  });

  test('requestInclude is exported at @charm-ux/velcro/include/request, shares the elements\' cache and is not on the package root or ./include', async ({ page }) => {
    const server = await serve(page, { '/fx/util': { body: '<u>util</u>' }, '/fx/missing-util': { status: 404, body: 'nope' } });
    const r = await page.evaluate(async () => {
      const util = await import('/request.js');
      const root = await import('/root.js');
      const cls = await import('/includeClass.js');
      const first = await util.requestInclude('/fx/util');
      const again = await util.requestInclude('/fx/util', 'same-origin');
      const bad = await util.requestInclude('/fx/missing-util');
      return { first, same: JSON.stringify(first) === JSON.stringify(again), bad, utilExports: Object.keys(util).sort(), rootHas: 'requestInclude' in root, classHas: 'requestInclude' in cls };
    });
    expect(r.first).toEqual({ ok: true, status: 200, html: '<u>util</u>' });
    expect(r.same).toBe(true);
    expect(r.bad).toEqual({ ok: false, status: 404, html: 'nope' });
    expect(r.utilExports).toEqual(['requestInclude']);
    expect(r.rootHas).toBe(false);
    expect(r.classHas).toBe(false);
    // An element for a src the helper already requested makes no request of its own.
    await page.evaluate(() => mk({ src: '/fx/util' }));
    await waitForEvents(page, 1);
    expect(await page.evaluate(() => window.last.innerHTML)).toBe('<u>util</u>');
    expect(server.log).toEqual(['/fx/util', '/fx/missing-util']);
  });
});
