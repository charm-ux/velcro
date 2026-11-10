// Diagnostic A/B (temporary): Shoelace 2.20.1's own carousel, built from its source with esbuild (only its localization
// package stubbed), against Velcro's, in the same docs page fixture. The Shoelace build replaces the docs examples'
// /_litro/velcro.js; everything else (page, theme, frames, steps) is identical. Each test asserts the behavior seen on
// Velcro, so a test that fails for one library and passes for the other is a difference.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const bundleFile = process.env.VELCRO_AB_SHOELACE || fileURLToPath(new URL('./carousel-ab.shoelace.js', import.meta.url));
const title = section => `Carousel example: ${section}`;

async function openPage(page, lib, how, section) {
  if (lib === 'shoelace') {
    const body = readFileSync(bundleFile, 'utf8');
    await page.route(url => url.pathname === '/_ab/shoelace.js', route => route.fulfill({ status: 200, contentType: 'text/javascript', body }));
  }
  await openDocs(page, '/components/carousel');
  const iframe = page.locator(`iframe.example[title="${title(section)}"]`);
  await iframe.scrollIntoViewIfNeeded();
  const inner = await (await iframe.elementHandle()).contentFrame();
  const navigated = page.waitForEvent('framenavigated', f => f === inner);
  // The example document is loaded again, in view, with the library under test: for Shoelace its script and import map point
  // at the Shoelace build instead of /_litro/velcro.js; for Velcro the document is unchanged.
  // With 'reload' (Velcro only) the frame is reloaded as carousel.spec.mjs does.
  if (how === 'reload') await inner.evaluate(() => location.reload());
  else await iframe.evaluate((f, lib) => {
    f.srcdoc = lib === 'shoelace' ? f.srcdoc.replaceAll('/_litro/velcro.js', '/_ab/shoelace.js') : f.srcdoc;
  }, lib);
  await navigated;
  await inner.waitForLoadState('load');
  // With 'srcdoc+reload' the document set above is then reloaded, as carousel.spec.mjs reloads the example frame.
  if (how === 'srcdoc+reload') {
    const again = page.waitForEvent('framenavigated', f => f === inner);
    await inner.evaluate(() => location.reload());
    await again;
    await inner.waitForLoadState('load');
  }
  const frame = page.frameLocator(`iframe.example[title="${title(section)}"]`);
  await expect(frame.locator('sl-carousel').first()).toBeVisible();
  await frame.locator('body').evaluate(() => Promise.all(['sl-carousel', 'sl-carousel-item', 'sl-icon'].map(t => customElements.whenDefined(t))));
  await documentsLoaded(page);
  // The library under test is the one the frame runs.
  const running = await frame.locator('body').evaluate(() => window.abLibrary === 'shoelace' ? 'shoelace' : customElements.get('sl-carousel').baseName === 'carousel' ? 'velcro' : 'unknown');
  expect(running).toBe(lib);
  return frame;
}

// Round 2: in round 1 (CI Firefox) the opening example did not settle only with 'reload' (2 of 3), and settled with 'srcdoc' for both
// libraries (3 of 3 each); the go-to tests passed for both in every engine. So both libraries now get the reload too, five runs each.
for (const [lib, how] of [['velcro', 'reload'], ['velcro', 'srcdoc+reload'], ['shoelace', 'srcdoc+reload']]) {
  for (const run of [1, 2, 3, 4, 5]) test(`carousel A/B (${lib}, ${how}) #${run}: the opening docs example's aria-busy returns to false after it loads`, async ({ page }) => {
    const frame = await openPage(page, lib, how, 'Default');
    // The intersection observer has reported the first slide (after the leading clone) in view.
    await expect.poll(() => frame.locator('#demo-default').evaluate(el => {
      const first = el.children[1];
      return first.classList.contains('--in-view') && first.getAttribute('aria-hidden') === 'false' && !first.hasAttribute('inert') && el.activeSlide === 0;
    }), { timeout: 8000 }).toBe(true);
    const busy = await frame.locator('#demo-default').evaluate(async el => {
      const end = Date.now() + 8000;
      while (Date.now() < end && el.scrollContainer.getAttribute('aria-busy') !== 'false') await new Promise(r => setTimeout(r, 50));
      return { busy: el.scrollContainer.getAttribute('aria-busy'), scrolling: el.scrolling, left: el.scrollContainer.scrollLeft, active: el.activeSlide };
    });
    console.log(`${test.info().project.name} ${lib} ${how} opening: ${JSON.stringify(busy)}`);
    expect(busy.scrolling).toBe(false);
    expect(busy.busy).toBe('false');
    expect(busy.active).toBe(0);
  });
}
