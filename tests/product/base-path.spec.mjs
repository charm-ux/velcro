// Production-output checks for both site layouts: the root build and the project-site build (prefix /velcro).
// Each layout is served by a loopback server on an ephemeral port that only answers under its own prefix, so a
// request that escapes to a root path shows up as a 404 or as a recorded request outside the prefix.
import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startPreview } from '../../packages/docs/scripts/preview.mjs';

const dist = fileURLToPath(new URL('../../packages/docs/dist/', import.meta.url));
const layouts = [
  { name: 'root build', dir: 'static', base: '' },
  { name: 'project-site build', dir: 'static-prefixed', base: '/velcro' },
];
const components = ['badge', 'button', 'divider', 'spinner'];
const routes = ['/', ...components.map(c => `/components/${c}`)];
const examples = { '/components/badge': '#demo-default', '/components/button': '#demo-primary', '/components/divider': '#demo-horizontal', '/components/spinner': 'sl-spinner' };

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
        const failures = [];
        const errors = [];
        page.on('request', request => seen.push(new URL(request.url())));
        page.on('response', response => {
          if (response.status() >= 400) failures.push(`${response.status()} ${new URL(response.url()).pathname}`);
        });
        page.on('requestfailed', request => failures.push(`failed ${new URL(request.url()).pathname}`));
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => message.type() === 'error' && errors.push(message.text()));

        // networkidle: Litro's router remounts the page once after load, which reloads the example iframe.
        await page.goto(url(route), { waitUntil: 'networkidle' });
        // data-litro-settled is set only after the client router matched location.pathname to a route and rendered it.
        await expect(page.locator('litro-outlet')).toHaveAttribute('data-litro-settled', '');
        await expect(page.locator('h1').first()).toBeVisible();
        if (examples[route]) {
          const frame = page.frameLocator('iframe.example');
          await expect(frame.locator(examples[route]).first()).toBeVisible();
          await frame.locator(examples[route]).first().evaluate(() => customElements.whenDefined(document.querySelector('sl-badge, sl-button, sl-divider, sl-spinner').localName));
        }
        await page.waitForLoadState('networkidle');

        const own = seen.filter(u => u.origin === origin);
        expect(own.length).toBeGreaterThan(2);
        expect(own.filter(u => !u.pathname.startsWith(`${base}/`)).map(u => u.pathname)).toEqual([]);
        expect(own.some(u => u.pathname === `${base}/_litro/app.js`)).toBe(true);
        expect(failures).toEqual([]);
        expect(errors).toEqual([]);
        // The page the client router rendered (it swaps in a client-rendered element; it does not hydrate the prerendered
        // one) carries the same prefixed links as the prerendered HTML.
        const hrefs = await page.locator('litro-outlet a[href]').evaluateAll(links => links.map(a => a.getAttribute('href')));
        expect(hrefs).toEqual(expect.arrayContaining(components.map(c => `${base}/components/${c}`)));
        expect(hrefs.filter(h => h.startsWith('/') && h !== `${base}/` && !h.startsWith(`${base}/components/`))).toEqual([]);
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
      await page.goto(url('/'), { waitUntil: 'networkidle' });
      for (const [label, route] of [['Badge', '/components/badge'], ['Button', '/components/button'], ['Divider', '/components/divider'], ['Spinner', '/components/spinner'], ['Home', '/']]) {
        await page.locator('header nav').getByRole('link', { name: label }).click();
        await page.waitForLoadState('networkidle');
        await expect(page.locator('litro-outlet')).toHaveAttribute('data-litro-settled', '');
        expect(new URL(page.url()).pathname).toBe(`${base}${route === '/' ? '/' : route}`);
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

    test('paths outside the prefix are not served', async ({ request }) => {
      if (!base) return;
      for (const path of ['/', '/components/button', '/_litro/app.js']) {
        expect((await request.get(`${origin}${path}`)).status()).toBe(404);
      }
      expect((await request.get(`${origin}${base}/_litro/app.js`)).status()).toBe(200);
    });
  });
}
