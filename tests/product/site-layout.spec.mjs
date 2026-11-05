// Docs layout: narrow viewports and fragment links into the page's shadow root.
import { expect, test } from '@playwright/test';

const settle = async page => {
  await expect(page.locator('litro-outlet')).toHaveAttribute('data-litro-settled', '');
  await page.waitForLoadState('networkidle');
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
