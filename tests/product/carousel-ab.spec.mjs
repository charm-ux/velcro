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
  const frame = page.frameLocator(`iframe.example[title="${title(section)}"]`);
  await expect(frame.locator('sl-carousel').first()).toBeVisible();
  await frame.locator('body').evaluate(() => Promise.all(['sl-carousel', 'sl-carousel-item', 'sl-icon'].map(t => customElements.whenDefined(t))));
  await documentsLoaded(page);
  // The library under test is the one the frame runs.
  const running = await frame.locator('body').evaluate(() => window.abLibrary === 'shoelace' ? 'shoelace' : customElements.get('sl-carousel').baseName === 'carousel' ? 'velcro' : 'unknown');
  expect(running).toBe(lib);
  return frame;
}

for (const [lib, how] of [['velcro', 'reload'], ['velcro', 'srcdoc'], ['shoelace', 'srcdoc']]) {
  for (const run of [1, 2, 3]) test(`carousel A/B (${lib}, ${how}) #${run}: the opening docs example's aria-busy returns to false after it loads`, async ({ page }) => {
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

  test(`carousel A/B (${lib}, ${how}): a go-to before the first intersection report makes activeSlide go 3, then 0, then back to 3`, async ({ page }) => {
    const frame = await openPage(page, lib, how, 'Gallery Example');
    const r = await frame.locator('body').evaluate(async body => {
      const host = document.createElement('div');
      host.innerHTML = `<sl-carousel id="ab" navigation loop>${[1, 2, 3, 4, 5].map(i => `<sl-carousel-item>Slide ${i}</sl-carousel-item>`).join('')}</sl-carousel>`;
      body.prepend(host);
      const el = host.firstElementChild;
      const seen = [];
      el.addEventListener('sl-slide-change', e => seen.push(e.detail.index));
      await el.updateComplete;
      // What a thumbnail click does, before the intersection observer has reported anything.
      const beforeReport = !el.querySelector('.--in-view');
      el.goToSlide(3);
      const end = Date.now() + 6000;
      let quietSince = Date.now();
      let last = '';
      while (Date.now() < end) {
        await new Promise(resolve => setTimeout(resolve, 50));
        const now = `${el.activeSlide}|${el.scrolling}|${seen.length}`;
        if (now !== last) { last = now; quietSince = Date.now(); }
        if (!el.scrolling && Date.now() - quietSince > 1000) break;
      }
      return { beforeReport, seen, active: el.activeSlide, scrolling: el.scrolling };
    });
    console.log(`${test.info().project.name} ${lib} ${how} bounce: ${JSON.stringify(r)}`);
    expect(r.beforeReport).toBe(true);
    expect(r.active).toBe(3);
    expect(r.scrolling).toBe(false);
    // The bounce: 3 first, then 0 (the observer's first report, from the start position), and 3 again at rest. Engines can
    // report slides passed on the way back up (Chromium: 3, 0, 1, 2, 3).
    expect(r.seen[0]).toBe(3);
    expect(r.seen[1]).toBe(0);
    expect(r.seen.at(-1)).toBe(3);
  });
}
