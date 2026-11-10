// Production-output checks for both site layouts: the root build and the project-site build (prefix /velcro).
// Each layout is served by a loopback server on an ephemeral port that only answers under its own prefix, so a
// request that escapes to a root path shows up as a 404 or as a recorded request outside the prefix.
import { expect, test as baseTest } from '@playwright/test';
import { docsReady, documentsLoaded, openDocs, reloadDocs, watchNetwork } from './support/loaded.mjs';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCatalog } from '../../scripts/site/catalog.mjs';
import { startPreview } from '../../packages/docs/scripts/preview.mjs';
import { collectRequestFailures, LOAD_FAILED } from './request-failures.mjs';
import { guardCdn } from './support/cdn.mjs';

const dist = fileURLToPath(new URL('../../packages/docs/dist/', import.meta.url));
const layouts = [
  { name: 'root build', dir: 'static', base: '' },
  { name: 'project-site build', dir: 'static-prefixed', base: '/velcro' },
];

// Each layout's server is a worker fixture, started on the first test that needs it and closed when the worker ends (as a
// describe's beforeAll/afterAll did, once per worker). Not a beforeAll: Playwright keeps the tests of a file that has
// beforeAll/afterAll hooks in a few large groups (one per shard, see --shard), and a group runs whole and in order on one
// worker, so a few hundred tests here ran serially in one shard. Without the hooks each test is scheduled on its own.
const test = baseTest.extend({
  // The layout each describe block below tests (test.use).
  layout: [undefined, { option: true }],
  previews: [async ({}, use) => {
    const started = new Map();
    await use(({ dir, base }) => {
      if (!started.has(dir)) started.set(dir, startPreview({ port: 0, root: join(dist, dir), base }));
      return started.get(dir);
    });
    for (const pending of started.values()) {
      const server = await pending;
      await new Promise(resolve => server.close(resolve));
    }
  }, { scope: 'worker' }],
  origin: async ({ previews, layout }, use) => {
    const server = await previews(layout);
    await use(`http://${server.address().address}:${server.address().port}`);
  },
  url: async ({ origin, layout }, use) => { await use(route => `${origin}${layout.base}${route}`); },
});

// The icon page loads its CDN icon library examples only on request; no test here asks, and none reaches a CDN (support/cdn.mjs).
let cdnRequests = [];
test.beforeEach(async ({ page }) => { cdnRequests = guardCdn(page); });
test.afterEach(() => { expect(cdnRequests, 'no request reaches the CDN').toEqual([]); });

// One catalog (packages/docs/catalog.jsonl) drives the routes, the example selectors and the navigation clicks.
const catalog = readCatalog();
const components = catalog.map(c => c.name);
// Guide pages outside the catalog, linked from component pages.
const guides = ['/localization'];
const routes = ['/', ...guides, ...components.map(c => `/components/${c}`)];
const examples = Object.fromEntries(catalog.map(c => [`/components/${c.name}`, c.example]));
const tags = catalog.map(c => c.tag).join(', ');

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else yield path;
  }
}

for (const layout of layouts) {
  const { name, dir, base } = layout;
  test.describe(name, () => {
    test.use({ layout });

    for (const route of routes) {
      test(`${route}: renders on the client route and loads only prefixed assets`, async ({ page, browserName, origin, url }) => {
        watchNetwork(page);
        const seen = [];
        const failures = collectRequestFailures(page);
        const errors = [];
        page.on('request', request => seen.push(new URL(request.url())));
        // WebKit reports a ResizeObserver delivery that was deferred to the next frame as a window error. Velcro's resize-observer
        // example (not Shoelace's, which only logs) rewrites the count and size text from its sl-resize handler, which changes
        // the layout around the observed box and triggers it. It is the browser's defined, non-actionable notice, so only that
        // exact message is ignored, only in WebKit and only on that component's route; every other error still fails the test.
        const benign = message => browserName === 'webkit' && route === '/components/resize-observer'
          && message === 'ResizeObserver loop completed with undelivered notifications.';
        page.on('pageerror', error => benign(error.message) || errors.push(error.message));
        page.on('console', message => message.type() === 'error' && !benign(message.text()) && errors.push(message.text()));

        // Litro's router remounts the page once after load, which reloads the example iframe. The docs app's ready signal
        // is set only after the client router matched location.pathname to a route, rendered it and its frames loaded.
        await openDocs(page, url(route));
        await expect(page.locator('h1').first()).toBeVisible();
        if (examples[route]) {
          const frame = page.frameLocator('iframe.example').first();
          await expect(frame.locator(examples[route]).first()).toBeVisible();
          await frame.locator(examples[route]).first().evaluate((_el, selector) => customElements.whenDefined(document.querySelector(selector).localName), tags);
        }
        // This test checks every request the page made, so it also waits for the network to go quiet (an example can
        // fetch after its document has loaded). documentsLoaded, not Playwright's networkidle: WebKit can leave the
        // latter pending for good after the remount.
        await documentsLoaded(page);

        const own = seen.filter(u => u.origin === origin);
        expect(own.length).toBeGreaterThan(2);
        expect(own.filter(u => !u.pathname.startsWith(`${base}/`)).map(u => u.pathname)).toEqual([]);
        expect(own.some(u => u.pathname === `${base}/_litro/app.js`)).toBe(true);
        expect(failures()).toEqual([]);
        // Firefox also reports a script load that the router's remount cancelled (an excused abort above) as a console
        // error; only that exact report, for a URL whose request was such an abort, is set aside.
        const cancelled = failures.cancelled();
        expect(errors.filter(message => !cancelled.has(LOAD_FAILED.exec(message)?.[1]))).toEqual([]);
        // The page the client router rendered (it swaps in a client-rendered element; it does not hydrate the prerendered
        // one) carries the same prefixed links as the prerendered HTML.
        const hrefs = await page.locator('litro-outlet a[href]').evaluateAll(links => links.map(a => a.getAttribute('href')));
        expect(hrefs).toEqual(expect.arrayContaining(components.map(c => `${base}/components/${c}`)));
        expect(hrefs.filter(h => h.startsWith('/') && h !== `${base}/` && !h.startsWith(`${base}/components/`) && !guides.some(g => h === `${base}${g}`))).toEqual([]);
      });

      test(`${route}: a refresh on the deep link renders the same page`, async ({ page, url }) => {
        await openDocs(page, url(route));
        const title = await page.title();
        await reloadDocs(page);
        expect(await page.title()).toBe(title);
        expect(new URL(page.url()).pathname).toBe(`${base}${route === '/' ? '/' : route}`);
      });
    }

    // The navigation walk is split into one test per step, so each step has its own time budget (the config's 45 s): a
    // single test walking every component grew slower with each one until it timed out in CI. Every link is an ordinary
    // document navigation, so no client state carries from one step to the next and each test starts at the page the
    // step starts from.
    const prefixed = path => `${base}${path}`;
    // Wait for the new document's URL, then for its ready signal.
    const arrive = async (page, path) => {
      await page.waitForURL(u => u.pathname === prefixed(path));
      await docsReady(page);
      expect(new URL(page.url()).pathname).toBe(prefixed(path));
    };
    const sidebarLink = (page, title) => page.getByRole('navigation', { name: 'Components' }).getByRole('link', { name: title, exact: true });

    // Header -> first component, then every component through the docs sidebar.
    for (const [i, c] of catalog.entries()) {
      test(`navigation links reach /components/${c.name} and keep the prefix`, async ({ page, url }) => {
        if (i === 0) {
          await openDocs(page, url('/'));
          await page.locator('header nav').getByRole('link', { name: 'Components', exact: true }).click();
          await arrive(page, `/components/${c.name}`);
        } else {
          await openDocs(page, url(`/components/${catalog[i - 1].name}`));
        }
        await sidebarLink(page, c.title).click();
        await arrive(page, `/components/${c.name}`);
      });
    }

    // Previous/next links walk the catalog order.
    if (catalog.length > 1) {
      test('the previous link walks back through the catalog order and keeps the prefix', async ({ page, url }) => {
        await openDocs(page, url(`/components/${catalog.at(-1).name}`));
        await page.getByRole('navigation', { name: 'Previous and next' }).getByRole('link', { name: `Previous ${catalog.at(-2).title}` }).click();
        await arrive(page, `/components/${catalog.at(-2).name}`);
      });
    }

    test('the header Home link returns to the home page', async ({ page, url }) => {
      await openDocs(page, url(`/components/${(catalog.at(-2) ?? catalog[0]).name}`));
      await page.locator('header nav').getByRole('link', { name: 'Home', exact: true }).click();
      await arrive(page, '/');
    });

    // The landing showcase links every component page: one test per component, so each has its own time budget.
    for (const c of catalog) {
      test(`the landing showcase links /components/${c.name} with the prefix`, async ({ page, url }) => {
        await openDocs(page, url('/'));
        await expect(page.locator(`#showcase [data-component="${c.name}"] a[href="${base}/components/${c.name}"]`)).toHaveCount(1);
      });
    }

    test('prerendered HTML carries no root-absolute URL outside the prefix, including the example documents', async () => {
      const root = join(dist, dir);
      for (const file of files(root)) {
        if (!file.endsWith('.html')) continue;
        const text = readFileSync(file, 'utf8');
        const rootAbsolute = [...text.matchAll(/(?:href|src)=(?:\\?"|&quot;)(\/[^"&\\ ]*)/g)].map(m => m[1]);
        expect(rootAbsolute.filter(p => !(base ? p.startsWith(`${base}/`) : true)), file).toEqual([]);
      }
      const html = readFileSync(join(root, 'components/button/index.html'), 'utf8');
      expect(html).toContain(`${base}/_litro/velcro.js`);
      expect(html).toContain(`${base}/_litro/velcro.css`);
    });

    test('negative control: genuine failed requests are still reported', async ({ page, url }) => {
      const failures = collectRequestFailures(page);
      await page.route('**/_litro/refused.js', route => route.abort('connectionrefused'));
      await page.route('**/_litro/app.js', route => route.abort('aborted'));
      await page.route('**/_litro/missing.js', route => route.fulfill({ status: 500, body: '' }));
      await page.goto(url('/'), { waitUntil: 'load' }).catch(() => {});
      await page.evaluate(path => fetch(path), `${base}/_litro/missing.js`);
      await page.evaluate(path => fetch(path).catch(() => {}), `${base}/_litro/refused.js`);
      const reported = failures();
      expect(reported).toContain(`500 ${base}/_litro/missing.js`);
      expect(reported).toContain(`failed ${base}/_litro/refused.js`);
      expect(reported).toContain(`failed ${base}/_litro/app.js`);
    });

    test('paths outside the prefix are not served', async ({ request, origin }) => {
      if (!base) return;
      for (const path of ['/', '/components/button', '/_litro/app.js']) {
        expect((await request.get(`${origin}${path}`)).status()).toBe(404);
      }
      expect((await request.get(`${origin}${base}/_litro/app.js`)).status()).toBe(200);
    });
  });
}
