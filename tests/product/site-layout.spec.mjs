// Docs layout: narrow viewports and fragment links into the page's shadow root.
import { expect, test } from '@playwright/test';
import { guardCdn } from './support/cdn.mjs';
import { documentsLoaded } from './support/loaded.mjs';

// The icon page loads its CDN icon library examples only on request; no test here asks, and none reaches a CDN (support/cdn.mjs).
let cdnRequests = [];
test.beforeEach(async ({ page }) => { cdnRequests = guardCdn(page); });
test.afterEach(() => { expect(cdnRequests, 'no request reaches the CDN').toEqual([]); });

const settle = async page => {
  await expect(page.locator('litro-outlet')).toHaveAttribute('data-litro-settled', '');
  await documentsLoaded(page);
};

for (const fontSize of ['16px', '24px']) {
  test(`previous/next links fit a 320px viewport (root font size ${fontSize})`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 320, height: 640 } });
    const page = await context.newPage();
    await page.goto('/components/button', { waitUntil: 'networkidle' });
    await settle(page);
    await page.addStyleTag({ content: `html { font-size: ${fontSize} !important; }` });
    const pager = page.getByRole('navigation', { name: 'Previous and next' });
    const links = pager.getByRole('link');
    await expect(links).toHaveCount(2);
    const viewport = await page.evaluate(() => document.documentElement.clientWidth);
    for (const link of await links.all()) {
      const box = await link.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport);
    }
    const pagerBox = await pager.boundingBox();
    expect(pagerBox.x + pagerBox.width).toBeLessThanOrEqual(viewport);
    await context.close();
  });
}

for (const [route, id] of [['/components/button', 'attributes'], ['/components/card', 'not-implemented'], ['/', 'showcase']]) {
  test(`a direct load of ${route}#${id} scrolls to the section in the page's shadow root`, async ({ page }) => {
    await page.goto(`${route}#${id}`, { waitUntil: 'networkidle' });
    await settle(page);
    const target = page.locator(`#${id}`);
    await expect(target).toBeInViewport();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });
}

test('a hash change after load also scrolls to the section', async ({ page }) => {
  await page.goto('/components/button', { waitUntil: 'networkidle' });
  await settle(page);
  await page.evaluate(() => { location.hash = '#events'; });
  await expect(page.locator('#events')).toBeInViewport();
});

test('example iframes grow to their content: the last card example on the card page is fully visible', async ({ page }) => {
  await page.goto('/components/card', { waitUntil: 'networkidle' });
  await settle(page);
  const iframe = page.locator('iframe.example').first();
  const frame = page.frameLocator('iframe.example').first();
  const last = frame.locator('sl-card').last();
  await last.evaluate(el => customElements.whenDefined('sl-card').then(() => el.updateComplete));
  await expect.poll(async () => {
    const [outer, inner] = await Promise.all([iframe.boundingBox(), last.boundingBox()]);
    return inner.y >= outer.y && inner.y + inner.height <= outer.y + outer.height && inner.x + inner.width <= outer.x + outer.width;
  }).toBe(true);
  // No inner scrolling either: the example document fits its frame.
  expect(await frame.locator('html').evaluate(d => d.scrollHeight <= window.innerHeight + 1)).toBe(true);
});

test('example iframes follow content size changes', async ({ page }) => {
  await page.goto('/components/badge', { waitUntil: 'networkidle' });
  await settle(page);
  const iframe = page.locator('iframe.example').first();
  const before = (await iframe.boundingBox()).height;
  await page.frameLocator('iframe.example').first().locator('body').evaluate(b => {
    const tall = document.createElement('div');
    tall.style.height = '400px';
    b.append(tall);
  });
  await expect.poll(async () => (await iframe.boundingBox()).height).toBeGreaterThan(before + 350);
});

for (const fontSize of ['16px', '24px']) {
  for (const route of ['/', '/components/button']) {
    test(`${route} at 320px (root font ${fontSize}): no horizontal overflow; brand, primary nav and theme control are usable`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 320, height: 640 } });
      const page = await context.newPage();
      await page.goto(route, { waitUntil: 'networkidle' });
      await settle(page);
      await page.addStyleTag({ content: `html { font-size: ${fontSize} !important; }` });
      const viewport = await page.evaluate(() => document.documentElement.clientWidth);
      expect(viewport).toBe(320);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport);
      const inside = async locator => {
        const box = await locator.boundingBox();
        expect(box, 'rendered').not.toBeNull();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport);
      };
      const brand = page.locator('header.site .brand');
      const select = page.getByRole('combobox', { name: 'Color theme' });
      const nav = page.locator('header nav');
      for (const l of [brand, select, nav, nav.getByRole('link', { name: 'Home' }), nav.getByRole('link', { name: 'Components' })]) {
        await expect(l).toBeVisible();
        await inside(l);
      }
      await select.selectOption('dark');
      expect(await page.evaluate(() => document.documentElement.className)).toBe('sl-theme-dark');
      if (route === '/') {
        const tiles = page.locator('#showcase [data-component]');
        for (const tile of await tiles.all()) await inside(tile);
        await inside(page.locator('.install'));
        await nav.getByRole('link', { name: 'Components' }).click();
        await expect(page).toHaveURL(/\/components\//);
      } else {
        await nav.getByRole('link', { name: 'Home' }).click();
        await expect(page).toHaveURL(/\/$/);
      }
      await context.close();
    });
  }
}

test('no page overflows a 320px viewport horizontally at a 24px root font', async ({ browser }) => {
  const { readCatalog } = await import('../../scripts/site/catalog.mjs');
  const context = await browser.newContext({ viewport: { width: 320, height: 640 } });
  const page = await context.newPage();
  for (const route of ['/', ...readCatalog().map(c => `/components/${c.name}`)]) {
    await page.goto(route, { waitUntil: 'networkidle' });
    await settle(page);
    await page.addStyleTag({ content: 'html { font-size: 24px !important; }' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth), route).toBeLessThanOrEqual(320);
  }
  await context.close();
});
