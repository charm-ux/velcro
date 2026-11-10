import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/carousel-item';
const docsDir = fileURLToPath(new URL('../../packages/docs/', import.meta.url));

async function openExample(page, name = 'Overview') {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  // WebKit does not run requestAnimationFrame in an iframe that is out of view, and the carousel scrolls from one, so the
  // example frame is scrolled into view and its document loaded again there before it is used.
  const iframe = page.locator(`iframe.example[title="Carousel Item example: ${name}"]`);
  await iframe.scrollIntoViewIfNeeded();
  const inner = await (await iframe.elementHandle()).contentFrame();
  const navigated = page.waitForEvent('framenavigated', f => f === inner);
  await inner.evaluate(() => location.reload());
  await navigated;
  await inner.waitForLoadState('load');
  const frame = page.frameLocator(`iframe.example[title="Carousel Item example: ${name}"]`);
  await expect(frame.locator('sl-carousel').first()).toBeVisible();
  await frame.locator('body').evaluate(() => Promise.all(['sl-carousel', 'sl-carousel-item'].map(t => customElements.whenDefined(t))));
  await documentsLoaded(page);
  return { frame, requests };
}

// Appends markup to the example document and waits for every carousel item in it to render.
async function mount(frame, markup) {
  await frame.locator('body').evaluate(async (body, markup) => {
    document.querySelector('#mount')?.remove();
    const host = document.createElement('div');
    host.id = 'mount';
    host.innerHTML = markup;
    body.append(host);
    host.scrollIntoView({ block: 'center' });
    await Promise.all([...host.querySelectorAll('sl-carousel-item')].map(el => el.updateComplete));
  }, markup);
}

test('docs page is prerendered with Velcro branding, prototype status, the quirks and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Carousel Item - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('without changing the shared core prefix');
  expect(html).toContain('title="Carousel Item example: Overview"');
  expect(html).toContain('/components/carousel');
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(html).not.toMatch(/images\.unsplash\.com|\/assets\/examples\/carousel/);
  expect(await (await request.get('/')).text()).toContain('/components/carousel-item');
});

test('the overview example is Shoelace\'s: a carousel with pagination and five slides, each with an image, and no request leaves the site', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  const r = await frame.locator('#demo-default').evaluate(el => ({
    pagination: el.pagination, slides: [...el.children].map(s => [s.localName, s.querySelector('img') !== null, s.querySelector('img').naturalWidth > 0]),
    alts: [...el.querySelectorAll('img')].every(i => i.alt.startsWith('Placeholder illustration')),
  }));
  expect(r.pagination).toBe(true);
  expect(r.slides).toEqual(Array(5).fill(['sl-carousel-item', true, true]));
  expect(r.alts).toBe(true);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  expect(requests.filter(url => /shoelace|unsplash/i.test(url))).toEqual([]);
  // The page's React example is the same markup as the carousel page's pagination one.
  expect(readFileSync(`${docsDir}examples/carousel-item/react/basic.jsx`, 'utf8')).toBe(readFileSync(`${docsDir}examples/carousel/react/pagination.jsx`, 'utf8'));
  expect(await page.locator('details.react-example').count()).toBe(1);
});

test('sl-carousel-item registers as the exported class with no core marker and no ch-* definitions, and observes only dir and lang', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  const r = await frame.locator('body').evaluate(async () => {
    const ctor = customElements.get('sl-carousel-item');
    const item = document.createElement('sl-carousel-item');
    document.body.append(item);
    await item.updateComplete;
    const out = {
      baseName: ctor.baseName, viaConstructor: new ctor().localName, observed: [...ctor.observedAttributes],
      attributes: item.getAttributeNames(), chDefined: ['ch-carousel-item', 'ch-carousel'].filter(t => customElements.get(t)),
      before: [item.dir, item.lang],
    };
    item.dir = 'rtl'; item.lang = 'de';
    await item.updateComplete;
    out.after = [item.dir, item.lang, item.hasAttribute('dir'), item.hasAttribute('lang')];
    item.remove();
    return out;
  });
  expect(r).toEqual({
    baseName: 'carousel-item', viaConstructor: 'sl-carousel-item', observed: ['dir', 'lang'], attributes: [], chDefined: [],
    before: [undefined, undefined], after: ['rtl', 'de', false, false],
  });
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
});

test('structure and styles: one default slot, a flex column that centers its content, the aspect ratio and the snap alignment, and images forced to fill it', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-carousel-item id="i" style="--aspect-ratio: 2 / 1; width: 200px"><img id="img" width="10" height="10" alt="" src="data:image/svg+xml,%3Csvg xmlns=%27http:%2F%2Fwww.w3.org%2F2000%2Fsvg%27 viewBox=%270 0 10 10%27/%3E"></sl-carousel-item><sl-carousel-item id="plain">Plain</sl-carousel-item>');
  const r = await frame.locator('body').evaluate(() => {
    const el = document.querySelector('#i');
    const style = getComputedStyle(el);
    const img = el.querySelector('#img').getBoundingClientRect();
    const box = el.getBoundingClientRect();
    const plain = getComputedStyle(document.querySelector('#plain'));
    return {
      shadow: [...el.shadowRoot.children].filter(n => n.localName !== 'style').map(n => n.localName + (n.name ? `[${n.name}]` : '') + (n.getAttribute('part') ? `(${n.getAttribute('part')})` : '')),
      display: [style.display, style.flexDirection, style.alignItems, style.justifyContent], snap: [style.scrollSnapAlign, style.scrollSnapStop],
      ratio: Math.round((box.width / box.height) * 10) / 10, fit: getComputedStyle(el.querySelector('#img')).objectFit, imgFills: [Math.round(img.width), Math.round(img.height)], box: [Math.round(box.width), Math.round(box.height)],
      maxHeight: plain.maxHeight, boxSizing: plain.boxSizing, assigned: el.shadowRoot.querySelector('slot').assignedElements().map(n => n.id),
    };
  });
  expect(r.shadow).toEqual(['slot']);
  expect(r.display).toEqual(['flex', 'column', 'center', 'center']);
  expect(r.snap).toEqual(['start', 'always']);
  expect(r.ratio).toBe(2);
  expect(r.fit).toBe('cover');
  expect(r.imgFills).toEqual(r.box);
  expect(r.maxHeight).toBe('100%');
  expect(r.boxSizing).toBe('border-box');
  expect(r.assigned).toEqual(['img']);
});

test('upstream quirk: the hidden attribute does not hide a carousel item, and an image always fills it whatever its own size', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-carousel-item id="i" hidden style="width: 120px">One</sl-carousel-item><sl-carousel-item id="j" style="width: 300px"><img id="img" alt="" style="width: 20px !important; height: 20px" src="data:image/svg+xml,%3Csvg xmlns=%27http:%2F%2Fwww.w3.org%2F2000%2Fsvg%27 viewBox=%270 0 10 10%27/%3E"></sl-carousel-item>');
  const r = await frame.locator('body').evaluate(() => {
    const i = document.querySelector('#i');
    const j = document.querySelector('#j');
    const img = j.querySelector('#img');
    return { display: getComputedStyle(i).display, rects: i.getClientRects().length > 0, imgWidth: Math.round(img.getBoundingClientRect().width), itemWidth: Math.round(j.getBoundingClientRect().width) };
  });
  expect(r).toEqual({ display: 'flex', rects: true, imgWidth: 300, itemWidth: 300 });
});

test('an item outside a carousel is inert: it writes no attributes of its own and emits no events but ready', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('body').evaluate(async () => {
    const seen = [];
    const item = document.createElement('sl-carousel-item');
    for (const type of ['ready', 'sl-slide-change', 'sl-change', 'sl-show']) item.addEventListener(type, e => seen.push([e.type, e.bubbles]));
    document.body.append(item);
    await item.updateComplete;
    const out = { attributes: item.getAttributeNames(), role: item.getAttribute('role'), tabindex: item.getAttribute('tabindex'), seen };
    item.remove();
    return out;
  });
  expect(r).toEqual({ attributes: [], role: null, tabindex: null, seen: [['ready', false]] });
});
