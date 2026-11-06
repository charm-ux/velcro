// Production-output checks for both site layouts: the root build and the project-site build (prefix /velcro).
// Each layout is served by a loopback server on an ephemeral port that only answers under its own prefix, so a
// request that escapes to a root path shows up as a 404 or as a recorded request outside the prefix.
import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCatalog } from '../../scripts/site/catalog.mjs';
import { startPreview } from '../../packages/docs/scripts/preview.mjs';
import { collectRequestFailures } from './request-failures.mjs';

const dist = fileURLToPath(new URL('../../packages/docs/dist/', import.meta.url));
const layouts = [
  { name: 'root build', dir: 'static', base: '' },
  { name: 'project-site build', dir: 'static-prefixed', base: '/velcro' },
];
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

for (const { name, dir, base } of layouts) {
  test.describe(name, () => {
    let server;
    let origin;
    test.beforeAll(async () => {
      server = await startPreview({ port: 0, root: join(dist, dir), base });
      origin = `http://${server.address().address}:${server.address().port}`;
    });
    test.afterAll(() => new Promise(resolve => server.close(resolve)));

    const url = route => `${origin}${base}${route}`;

    for (const route of routes) {
      test(`${route}: renders on the client route and loads only prefixed assets`, async ({ page }) => {
        const seen = [];
        const failures = collectRequestFailures(page);
        const errors = [];
        page.on('request', request => seen.push(new URL(request.url())));
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => message.type() === 'error' && errors.push(message.text()));

        // networkidle: Litro's router remounts the page once after load, which reloads the example iframe.
        await page.goto(url(route), { waitUntil: 'networkidle' });
        // data-litro-settled is set only after the client router matched location.pathname to a route and rendered it.
        await expect(page.locator('litro-outlet')).toHaveAttribute('data-litro-settled', '');
        await expect(page.locator('h1').first()).toBeVisible();
        if (examples[route]) {
          const frame = page.frameLocator('iframe.example').first();
          await expect(frame.locator(examples[route]).first()).toBeVisible();
          await frame.locator(examples[route]).first().evaluate((_el, selector) => customElements.whenDefined(document.querySelector(selector).localName), tags);
        }
        await page.waitForLoadState('networkidle');

        const own = seen.filter(u => u.origin === origin);
        expect(own.length).toBeGreaterThan(2);
        expect(own.filter(u => !u.pathname.startsWith(`${base}/`)).map(u => u.pathname)).toEqual([]);
        expect(own.some(u => u.pathname === `${base}/_litro/app.js`)).toBe(true);
        expect(failures()).toEqual([]);
        expect(errors).toEqual([]);
        // The page the client router rendered (it swaps in a client-rendered element; it does not hydrate the prerendered
        // one) carries the same prefixed links as the prerendered HTML.
        const hrefs = await page.locator('litro-outlet a[href]').evaluateAll(links => links.map(a => a.getAttribute('href')));
        expect(hrefs).toEqual(expect.arrayContaining(components.map(c => `${base}/components/${c}`)));
        expect(hrefs.filter(h => h.startsWith('/') && h !== `${base}/` && !h.startsWith(`${base}/components/`) && !guides.some(g => h === `${base}${g}`))).toEqual([]);
      });

      test(`${route}: a refresh on the deep link renders the same page`, async ({ page }) => {
        await page.goto(url(route), { waitUntil: 'networkidle' });
        const title = await page.title();
        await page.reload({ waitUntil: 'networkidle' });
        await expect(page.locator('litro-outlet')).toHaveAttribute('data-litro-settled', '');
        expect(await page.title()).toBe(title);
        expect(new URL(page.url()).pathname).toBe(`${base}${route === '/' ? '/' : route}`);
      });
    }

    test('navigation links reach every route and keep the prefix', async ({ page }) => {
      const arrive = async route => {
        await page.waitForLoadState('networkidle');
        await expect(page.locator('litro-outlet')).toHaveAttribute('data-litro-settled', '');
        expect(new URL(page.url()).pathname).toBe(`${base}${route === '/' ? '/' : route}`);
      };
      await page.goto(url('/'), { waitUntil: 'networkidle' });
      // Header -> first component, then every component through the docs sidebar, then back home through the header.
      await page.locator('header nav').getByRole('link', { name: 'Components', exact: true }).click();
      await arrive(`/components/${catalog[0].name}`);
      for (const c of catalog) {
        await page.getByRole('navigation', { name: 'Components' }).getByRole('link', { name: c.title, exact: true }).click();
        await arrive(`/components/${c.name}`);
      }
      // Previous/next links walk the catalog order.
      if (catalog.length > 1) {
        await page.getByRole('navigation', { name: 'Previous and next' }).getByRole('link', { name: `Previous ${catalog.at(-2).title}` }).click();
        await arrive(`/components/${catalog.at(-2).name}`);
      }
      await page.locator('header nav').getByRole('link', { name: 'Home', exact: true }).click();
      await arrive('/');
      // The landing showcase links every component page.
      for (const c of catalog) {
        await expect(page.locator(`#showcase [data-component="${c.name}"] a[href="${base}/components/${c.name}"]`)).toHaveCount(1);
      }
    });

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

    test('negative control: genuine failed requests are still reported', async ({ page }) => {
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

    test('paths outside the prefix are not served', async ({ request }) => {
      if (!base) return;
      for (const path of ['/', '/components/button', '/_litro/app.js']) {
        expect((await request.get(`${origin}${path}`)).status()).toBe(404);
      }
      expect((await request.get(`${origin}${base}/_litro/app.js`)).status()).toBe(200);
    });
  });
}
