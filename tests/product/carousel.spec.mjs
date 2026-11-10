import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { buildFixtures, gotoBlank } from './support/fixtures.mjs';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/carousel';
// Shoelace 2.20.1's carousel page has twelve examples, in this order; every one is live and has a React version.
const ORDER = [
  ['basic', 'Default'], ['pagination', 'Pagination'], ['navigation', 'Navigation'], ['loop', 'Looping'], ['autoplay', 'Autoplay'],
  ['mouse-dragging', 'Mouse Dragging'], ['slides-per-page', 'Multiple Slides Per View'], ['dynamic', 'Adding and Removing Slides'],
  ['vertical', 'Vertical Scrolling'], ['aspect-ratio', 'Aspect Ratio'], ['scroll-hint', 'Scroll Hint'], ['gallery', 'Gallery Example'],
];
const SECTIONS = ORDER.map(([, section]) => section);
const title = section => `Carousel example: ${section}`;
const docsDir = fileURLToPath(new URL('../../packages/docs/', import.meta.url));
const velcroDir = fileURLToPath(new URL('../../packages/velcro/', import.meta.url));

async function openPage(page, section = 'Default') {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  // WebKit does not run requestAnimationFrame in an iframe that is out of view, and the carousel scrolls from one, so a carousel
  // whose frame loaded below the fold starts at the wrong slide (as Shoelace's would). The frame is scrolled into view and its
  // document loaded again there, so the examples start where a reader sees them start.
  const iframe = page.locator(`iframe.example[title="${title(section)}"]`);
  await iframe.scrollIntoViewIfNeeded();
  const inner = await (await iframe.elementHandle()).contentFrame();
  const navigated = page.waitForEvent('framenavigated', f => f === inner);
  await inner.evaluate(() => location.reload());
  await navigated;
  await inner.waitForLoadState('load');
  const frame = page.frameLocator(`iframe.example[title="${title(section)}"]`);
  await expect(frame.locator('sl-carousel').first()).toBeVisible();
  await frame.locator('body').evaluate(() => Promise.all(['sl-carousel', 'sl-carousel-item', 'sl-icon'].map(t => customElements.whenDefined(t))));
  // Rendering only: a test that reads the requests waits for the network to go quiet itself (documentsLoaded).
  return { frame, requests };
}

// Appends markup to the example document and waits for every carousel in it to render.
async function mount(frame, markup) {
  await frame.locator('body').evaluate(async (body, markup) => {
    document.querySelector('#mount')?.remove();
    const host = document.createElement('div');
    host.id = 'mount';
    host.innerHTML = markup;
    body.append(host);
    host.scrollIntoView({ block: 'center' });
    await Promise.all([...host.querySelectorAll('sl-carousel, sl-carousel-item')].map(el => el.updateComplete));
  }, markup);
}

const SLIDES = (n, itemAttrs = '') => Array.from({ length: n }, (_, i) => `<sl-carousel-item ${itemAttrs}>Slide ${i + 1}</sl-carousel-item>`).join('');
const CAROUSEL = (attrs = '', n = 5) => `<sl-carousel id="c" ${attrs}>${SLIDES(n)}</sl-carousel>`;

// The carousel in the example document, read through its public API and DOM.
const state = (frame, selector = '#c') => frame.locator(selector).evaluate(el => {
  const slides = [...el.children].filter(c => c.localName === 'sl-carousel-item');
  const real = slides.filter(s => !s.hasAttribute('data-clone'));
  const box = el.scrollContainer.getBoundingClientRect();
  const nearest = slides.map(s => { const r = s.getBoundingClientRect(); return Math.abs(el.orientation === 'vertical' ? r.top - box.top : r.left - box.left); });
  return {
    active: el.activeSlide,
    activeClasses: real.map(s => s.classList.contains('--is-active')),
    slides: real.length,
    clones: slides.length - real.length,
    // The slide that sits at the start of the scroll container (what is in view at the start edge).
    atStart: slides.findIndex((_, i) => nearest[i] === Math.min(...nearest)),
    pages: el.shadowRoot.querySelectorAll('[part~="pagination-item"]').length,
    currentPage: [...el.shadowRoot.querySelectorAll('[part~="pagination-item"]')].findIndex(b => b.getAttribute('aria-selected') === 'true'),
  };
});

// The carousel has stopped scrolling and the slide at `index` (counting clones) sits at the start edge of the scroll container. The two
// conditions are separate polls on separate lines, so a failure names the one that did not hold (a failing run's summary gives only the
// matcher and the line): `toBe(false)` below is "still scrolling" (aria-busy), `toBeLessThan(2)` is "slide not at the start edge".
const isScrolling = (frame, selector) => frame.locator(selector).evaluate(el => el.scrolling);
// Only the scrolling axis is compared: slides are centered on the other one.
const startOffset = (frame, selector, index) => frame.locator(selector).evaluate((el, i) => {
  const slides = [...el.children].filter(c => c.localName === 'sl-carousel-item');
  const box = el.scrollContainer.getBoundingClientRect();
  const r = slides[i].getBoundingClientRect();
  return Math.abs(el.orientation === 'vertical' ? r.top - box.top : r.left - box.left);
}, index);
const settle = async (frame, selector, index) => {
  await expect.poll(() => isScrolling(frame, selector), { timeout: 8000 }).toBe(false);
  await expect.poll(() => startOffset(frame, selector, index), { timeout: 8000 }).toBeLessThan(2);
  // Not scrolling any more once aligned: the first poll can pass before the scroll (which starts in an animation frame) has begun.
  await expect.poll(() => isScrolling(frame, selector), { timeout: 8000 }).toBe(false);
};

// The opening example loops, so after loading it scrolls to its first slide (the second child, after the leading clone). Its slide state
// (the --in-view class, aria-hidden, inert) and its active slide are final once the intersection observer has reported that slide in
// view. The wait is on that report and not on the scroll ending: in Firefox, once the example's frame has been reloaded (openPage reloads
// it), the example's `scrolling` state (aria-busy) does not return to false, as with Shoelace 2.20.1's own carousel in the same fixture
// (see the docs page), so nothing else about the opening example depends on it. Mounted carousels, which do settle there, use `settle`.
const openingExampleReady = frame => expect.poll(() => frame.locator('#demo-default').evaluate(el => {
  const first = el.children[1];
  return first.classList.contains('--in-view') && first.getAttribute('aria-hidden') === 'false' && !first.hasAttribute('inert') && el.activeSlide === 0;
}), { timeout: 8000 }).toBe(true);

test('docs page is prerendered with Velcro branding, prototype status, every Shoelace section, the keyboard, the quirks and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Carousel - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('without changing the shared core prefix');
  expect(html).toContain('id="keyboard"');
  expect(html).toContain('sl-slide-change');
  for (const section of SECTIONS) expect(html).toContain(`title="${title(section)}"`);
  const positions = SECTIONS.map(section => html.indexOf(`title="${title(section)}"`));
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(html).not.toMatch(/images\.unsplash\.com|\/assets\/examples\/carousel/);
  expect(await (await request.get('/')).text()).toContain('/components/carousel');
  const item = await (await request.get('/components/carousel-item')).text();
  expect(item).toContain('<title>Carousel Item - Velcro</title>');
  expect(item).toContain('title="Carousel Item example: Overview"');
});

test('the examples render in their own documents in Shoelace\'s order, with their React versions, and make no request outside the site', async ({ page }) => {
  const { requests } = await openPage(page);
  await documentsLoaded(page);
  const titles = await page.locator('iframe.example').evaluateAll(frames => frames.map(f => f.title));
  expect(titles).toEqual(SECTIONS.map(title));
  const counts = [];
  for (const section of SECTIONS) {
    const frame = page.frameLocator(`iframe.example[title="${title(section)}"]`);
    counts.push(await frame.locator('sl-carousel-item:not([data-clone])').count());
  }
  expect(counts).toEqual([5, 5, 5, 5, 5, 5, 6, 3, 5, 5, 5, 5]);
  const ids = await page.locator('h3[id]').evaluateAll(hs => hs.map(h => h.id));
  expect(ids.filter(id => ORDER.some(([known]) => known === id))).toEqual(ORDER.map(([id]) => id));
  const files = dir => readdirSync(path.join(docsDir, 'examples/carousel', dir)).filter(f => /\.(html|jsx)$/.test(f)).sort();
  expect(files('')).toEqual(ORDER.map(([id]) => `${id}.html`).sort());
  expect(files('react')).toEqual(ORDER.map(([id]) => `${id}.jsx`).sort());
  expect(await page.locator('details.react-example').count()).toBe(ORDER.length);
  expect(requests.filter(url => /shoelace|unsplash/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  // Every placeholder image decoded: the data: URLs are valid images.
  const broken = await page.locator('iframe.example').evaluateAll(async frames => {
    const out = [];
    for (const f of frames) for (const img of f.contentDocument.querySelectorAll('img')) if (!img.complete || img.naturalWidth === 0) out.push(f.title);
    return out;
  });
  expect(broken).toEqual([]);
});

test('sl-carousel and sl-carousel-item register as the exported classes, with sl-icon, no core marker and no ch-* definitions', async ({ page }) => {
  const { frame, requests } = await openPage(page);
  await documentsLoaded(page);
  await openingExampleReady(frame);
  const info = await frame.locator('#demo-default').evaluate(el => {
    const ctor = customElements.get('sl-carousel');
    const item = customElements.get('sl-carousel-item');
    return {
      baseName: ctor.baseName, itemBaseName: item.baseName, instance: el instanceof ctor, viaConstructor: new ctor().localName,
      itemViaConstructor: new item().localName, icon: customElements.get('sl-icon')?.baseName ?? null,
      chDefined: ['ch-carousel', 'ch-carousel-item', 'ch-icon'].filter(t => customElements.get(t)),
      attrs: el.getAttributeNames().sort(),
      observed: [...ctor.observedAttributes].sort(),
      itemObserved: [...item.observedAttributes].sort(),
      itemAttrs: el.querySelector('sl-carousel-item:not([data-clone])').getAttributeNames().sort(),
    };
  });
  expect(info).toEqual({
    baseName: 'carousel', itemBaseName: 'carousel-item', instance: true, viaConstructor: 'sl-carousel', itemViaConstructor: 'sl-carousel-item',
    icon: 'icon', chDefined: [], attrs: ['aria-label', 'id', 'loop', 'mouse-dragging', 'navigation', 'pagination', 'role'],
    observed: ['autoplay', 'autoplay-interval', 'dir', 'lang', 'loop', 'mouse-dragging', 'navigation', 'orientation', 'pagination', 'slides-per-move', 'slides-per-page'],
    itemObserved: ['dir', 'lang'],
    itemAttrs: ['aria-hidden', 'aria-labelledby', 'class', 'id', 'role'],
  });
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
});

test('default example: Shoelace\'s structure and parts, the host\'s role and label, the slides\' roles, ids and ARIA, two clones, the pagination dots, aria-busy settling (not in Firefox)', async ({ page, browserName }) => {
  const { frame } = await openPage(page);
  await openingExampleReady(frame);
  const r = await frame.locator('#demo-default').evaluate(el => {
    const root = el.shadowRoot;
    const outline = node => [node.localName, node.getAttribute('part')?.trim() ?? null, node.getAttribute('role'), [...node.children].map(c => outline(c))];
    const slides = [...el.children];
    const container = root.querySelector('#scroll-container');
    return {
      outline: outline(root.querySelector('[part="base"]')),
      baseClasses: root.querySelector('[part="base"]').className,
      container: { classes: container.className.trim(), busy: container.getAttribute('aria-busy'), atomic: container.getAttribute('aria-atomic'), tabindex: container.getAttribute('tabindex'), style: container.getAttribute('style') },
      host: { role: el.getAttribute('role'), label: el.getAttribute('aria-label') },
      slideCount: slides.length,
      clones: slides.map(s => s.getAttribute('data-clone')),
      roles: slides.map(s => s.getAttribute('role')),
      ids: slides.map(s => s.id),
      labelledBy: slides.map(s => s.getAttribute('aria-labelledby')),
      labels: slides.map(s => s.getAttribute('aria-label')),
      pagination: [...root.querySelectorAll('[part~="pagination-item"]')].map(b => [b.id, b.getAttribute('aria-controls'), b.getAttribute('aria-selected'), b.getAttribute('aria-label'), b.getAttribute('tabindex'), b.className.trim()]),
      navigation: [...root.querySelectorAll('[part~="navigation-button"]')].map(b => [b.getAttribute('aria-label'), b.getAttribute('aria-controls'), b.getAttribute('aria-disabled'), b.className.trim(), b.querySelector('sl-icon').getAttribute('name'), b.querySelector('sl-icon').getAttribute('library')]),
    };
  });
  const item = (part, children = []) => ['button', part, null, children];
  const icon = ['slot', null, null, [['sl-icon', null, null, []]]];
  expect(r.outline).toEqual(['div', 'base', null, [
    ['div', 'scroll-container', null, [['slot', null, null, []]]],
    ['div', 'navigation', null, [item('navigation-button navigation-button--previous', [icon]), item('navigation-button navigation-button--next', [icon])]],
    ['div', 'pagination', 'tablist', [0, 1, 2, 3, 4].map(i => ['button', i === 0 ? 'pagination-item pagination-item--active' : 'pagination-item', 'tab', []])],
  ]]);
  expect(r.baseClasses).toBe('carousel');
  expect(r.container.classes.split(/\s+/).sort()).toEqual(['carousel__slides', 'carousel__slides--horizontal']);
  // aria-busy mirrors the scrolling state. It returns to false once the example has scrolled to its first slide, except in Firefox, where
  // after the frame's reload it does not (see openingExampleReady): there it is only checked to be a boolean string. It is asserted in
  // every engine on a mounted carousel in the navigation test.
  expect(r.container).toMatchObject({ atomic: 'true', tabindex: '0', style: '--slides-per-page: 1;' });
  expect(['true', 'false']).toContain(r.container.busy);
  if (browserName !== 'firefox') {
    await expect.poll(() => frame.locator('#demo-default').evaluate(el => el.scrollContainer.getAttribute('aria-busy')), { timeout: 8000 }).toBe('false');
  }
  expect(r.host).toEqual({ role: 'region', label: 'Carousel' });
  expect(r.slideCount).toBe(7);
  expect(r.clones).toEqual(['4', null, null, null, null, null, '0']);
  expect(r.roles).toEqual(Array(7).fill('tabpanel'));
  expect(r.ids).toEqual(['slide-5', 'slide-1', 'slide-2', 'slide-3', 'slide-4', 'slide-5', 'slide-1']);
  expect(r.labelledBy).toEqual(['tab-5', 'tab-1', 'tab-2', 'tab-3', 'tab-4', 'tab-5', 'tab-1']);
  expect(r.labels).toEqual(Array(7).fill(null));
  expect(r.pagination).toEqual([
    ['tab-1', 'slide-1', 'true', 'Slide 1', '0', 'carousel__pagination-item carousel__pagination-item--active'],
    ['tab-2', 'slide-2', 'false', 'Go to slide 2 of 5', '-1', 'carousel__pagination-item'],
    ['tab-3', 'slide-3', 'false', 'Go to slide 3 of 5', '-1', 'carousel__pagination-item'],
    ['tab-4', 'slide-4', 'false', 'Go to slide 4 of 5', '-1', 'carousel__pagination-item'],
    ['tab-5', 'slide-5', 'false', 'Go to slide 5 of 5', '-1', 'carousel__pagination-item'],
  ]);
  expect(r.navigation).toEqual([
    ['Previous slide', 'scroll-container', 'false', 'carousel__navigation-button carousel__navigation-button--previous', 'chevron-left', 'system'],
    ['Next slide', 'scroll-container', 'false', 'carousel__navigation-button carousel__navigation-button--next', 'chevron-right', 'system'],
  ]);
});

test('properties: defaults, attribute and property reflection, and the slides-per-move clamp', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, `${CAROUSEL('', 3)}<sl-carousel id="attrs" loop navigation pagination autoplay autoplay-interval="1234" slides-per-page="2" slides-per-move="5" orientation="vertical" mouse-dragging>${SLIDES(4)}</sl-carousel>`);
  const r = await frame.locator('body').evaluate(async () => {
    const plain = document.querySelector('#c');
    const attrs = document.querySelector('#attrs');
    const read = el => ({ loop: el.loop, navigation: el.navigation, pagination: el.pagination, autoplay: el.autoplay, interval: el.autoplayInterval, perPage: el.slidesPerPage, perMove: el.slidesPerMove, orientation: el.orientation, drag: el.mouseDragging });
    const out = { defaults: read(plain), attrs: read(attrs), plainAttrs: plain.getAttributeNames().sort() };
    plain.loop = true; plain.navigation = true; plain.pagination = true; plain.autoplay = true; plain.mouseDragging = true;
    plain.autoplayInterval = 50000; plain.orientation = 'vertical';
    await plain.updateComplete;
    out.reflected = plain.getAttributeNames().sort();
    out.interval = plain.getAttribute('autoplay-interval');
    out.orientationAttr = plain.getAttribute('orientation');
    plain.removeAttribute('loop');
    plain.autoplay = false;
    await plain.updateComplete;
    out.removed = { loop: plain.loop, autoplay: plain.autoplay, attrs: plain.getAttributeNames().sort() };
    // slides-per-move is lowered to slides-per-page when either changes, never raised again.
    plain.slidesPerPage = 3;
    plain.slidesPerMove = 3;
    await plain.updateComplete;
    out.three = [plain.slidesPerPage, plain.slidesPerMove];
    plain.slidesPerPage = 2;
    await plain.updateComplete;
    out.lowered = [plain.slidesPerPage, plain.slidesPerMove];
    plain.slidesPerPage = 3;
    await plain.updateComplete;
    out.notRaised = [plain.slidesPerPage, plain.slidesPerMove];
    plain.slidesPerMove = 9;
    await plain.updateComplete;
    out.clamped = [plain.slidesPerPage, plain.slidesPerMove];
    // dir and lang are plain reactive properties, not reflected.
    plain.dir = 'rtl'; plain.lang = 'fr';
    await plain.updateComplete;
    out.dirLang = [plain.dir, plain.lang, plain.hasAttribute('dir'), plain.hasAttribute('lang')];
    return out;
  });
  expect(r.defaults).toEqual({ loop: false, navigation: false, pagination: false, autoplay: false, interval: 3000, perPage: 1, perMove: 1, orientation: 'horizontal', drag: false });
  expect(r.attrs).toEqual({ loop: true, navigation: true, pagination: true, autoplay: true, interval: 1234, perPage: 2, perMove: 2, orientation: 'vertical', drag: true });
  expect(r.plainAttrs).toEqual(['aria-label', 'id', 'role']);
  expect(r.reflected).toEqual(['aria-label', 'autoplay', 'id', 'loop', 'mouse-dragging', 'navigation', 'pagination', 'role']);
  // Only the five Boolean properties reflect; the number and orientation properties do not.
  expect(r.interval).toBeNull();
  expect(r.orientationAttr).toBeNull();
  expect(r.removed).toEqual({ loop: false, autoplay: false, attrs: ['aria-label', 'id', 'mouse-dragging', 'navigation', 'pagination', 'role'] });
  expect(r.three).toEqual([3, 3]);
  expect(r.lowered).toEqual([2, 2]);
  expect(r.notRaised).toEqual([3, 2]);
  expect(r.clamped).toEqual([3, 3]);
  expect(r.dirLang).toEqual(['rtl', 'fr', false, false]);
});

test('upstream quirk: nothing is restored when a reflected property is set to null (the carousel skips the base element\'s restore)', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-carousel id="c" loop pagination><sl-carousel-item>A</sl-carousel-item></sl-carousel>');
  const r = await frame.locator('#c').evaluate(async el => {
    el.loop = null;
    el.pagination = null;
    await el.updateComplete;
    return { loop: el.loop, pagination: el.pagination, attrs: el.getAttributeNames().sort() };
  });
  expect(r).toEqual({ loop: null, pagination: null, attrs: ['aria-label', 'id', 'role'] });
});

test('navigation without loop: next, previous and goToSlide clamp, the active slide, classes and sl-slide-change follow, and nothing is emitted while a carousel first renders and settles', async ({ page }) => {
  const { frame } = await openPage(page);
  // The listener is on the document, before any carousel exists, so a first-render emission would be recorded. The event bubbles and
  // is composed, so the document sees it from every carousel.
  await frame.locator('body').evaluate(() => {
    window.changes = [];
    document.addEventListener('sl-slide-change', e => window.changes.push({ id: e.target.id, index: e.detail.index, text: e.detail.slide.textContent.trim(), same: e.detail.slide === e.target.children[e.detail.index], bubbles: e.bubbles, composed: e.composed, cancelable: e.cancelable }));
  });
  // A looping carousel is mounted too: it scrolls to its first slide and synchronizes the active slide after it renders.
  await mount(frame, '<sl-carousel id="c" navigation pagination>' + SLIDES(4) + '</sl-carousel><sl-carousel id="looped" loop>' + SLIDES(3) + '</sl-carousel>');
  await settle(frame, '#looped', 1);
  expect(await state(frame)).toMatchObject({ active: 0, slides: 4, clones: 0, pages: 4, currentPage: 0 });
  expect(await state(frame, '#looped')).toMatchObject({ active: 0, slides: 3, clones: 2 });
  expect(await frame.locator('body').evaluate(() => window.changes)).toEqual([]);
  await frame.locator('#c').evaluate(el => el.next('auto'));
  await settle(frame, '#c', 1);
  expect(await state(frame)).toMatchObject({ active: 1, activeClasses: [false, true, false, false], currentPage: 1 });
  // aria-busy follows the scrolling state: false again once the scroll has ended.
  expect(await frame.locator('#c').evaluate(el => el.scrollContainer.getAttribute('aria-busy'))).toBe('false');
  await frame.locator('#c').evaluate(el => el.goToSlide(3, 'auto'));
  await settle(frame, '#c', 3);
  expect(await state(frame)).toMatchObject({ active: 3, currentPage: 3 });
  // Clamped at the end and at the start.
  await frame.locator('#c').evaluate(el => el.next('auto'));
  await settle(frame, '#c', 3);
  expect(await state(frame)).toMatchObject({ active: 3 });
  await frame.locator('#c').evaluate(el => el.goToSlide(-5, 'auto'));
  await settle(frame, '#c', 0);
  expect(await state(frame)).toMatchObject({ active: 0 });
  await frame.locator('#c').evaluate(el => el.previous('auto'));
  await settle(frame, '#c', 0);
  expect(await state(frame)).toMatchObject({ active: 0 });
  const changes = await frame.locator('body').evaluate(() => window.changes);
  expect(changes).toEqual([
    { id: 'c', index: 1, text: 'Slide 2', same: true, bubbles: true, composed: true, cancelable: false },
    { id: 'c', index: 3, text: 'Slide 4', same: true, bubbles: true, composed: true, cancelable: false },
    { id: 'c', index: 0, text: 'Slide 1', same: true, bubbles: true, composed: true, cancelable: false },
  ]);
});

test('the navigation buttons and pagination dots move the carousel; an unavailable button is only aria-disabled and stays focusable (upstream quirk)', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-carousel id="c" navigation pagination>' + SLIDES(3) + '</sl-carousel>');
  const buttons = () => frame.locator('#c').evaluate(el => [...el.shadowRoot.querySelectorAll('[part~="navigation-button"]')].map(b => [b.getAttribute('aria-disabled'), b.classList.contains('carousel__navigation-button--disabled'), b.hasAttribute('disabled'), b.tabIndex, getComputedStyle(b).opacity, getComputedStyle(b).cursor]));
  expect(await buttons()).toEqual([['true', true, false, 0, '0.5', 'not-allowed'], ['false', false, false, 0, '1', 'pointer']]);
  await frame.locator('#c').evaluate(el => el.shadowRoot.querySelector('[part~="navigation-button--previous"]').click());
  expect(await state(frame)).toMatchObject({ active: 0 });
  await frame.locator('#c').evaluate(el => el.shadowRoot.querySelector('[part~="navigation-button--next"]').click());
  await settle(frame, '#c', 1);
  expect(await buttons()).toEqual([['false', false, false, 0, '1', 'pointer'], ['false', false, false, 0, '1', 'pointer']]);
  await frame.locator('#c').evaluate(el => el.shadowRoot.querySelectorAll('[part~="pagination-item"]')[2].click());
  await settle(frame, '#c', 2);
  expect(await state(frame)).toMatchObject({ active: 2, currentPage: 2 });
  expect(await buttons()).toEqual([['false', false, false, 0, '1', 'pointer'], ['true', true, false, 0, '0.5', 'not-allowed']]);
  await frame.locator('#c').evaluate(el => el.shadowRoot.querySelector('[part~="navigation-button--next"]').click());
  expect(await state(frame)).toMatchObject({ active: 2 });
  // Focus: the disabled-looking button can still hold it.
  await frame.locator('#c [part~="navigation-button--next"]').focus();
  await expect(frame.locator('#c [part~="navigation-button--next"]')).toBeFocused();
  expect(await frame.locator('#c').evaluate(el => el.shadowRoot.querySelector('[part~="navigation-button--next"]').getAttribute('aria-disabled'))).toBe('true');
  await frame.locator('#c').evaluate(el => el.shadowRoot.querySelectorAll('[part~="pagination-item"]')[0].click());
  await settle(frame, '#c', 0);
  expect(await state(frame)).toMatchObject({ active: 0, currentPage: 0 });
});

test('loop: clones are real children, the active slide wraps, previous from the first goes to the last and next from the last to the first', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-carousel id="c" loop pagination navigation>' + SLIDES(4) + '</sl-carousel>');
  const kids = () => frame.locator('#c').evaluate(el => ({ children: el.children.length, all: el.querySelectorAll('sl-carousel-item').length, clones: [...el.children].map(c => c.getAttribute('data-clone')), text: [...el.children].map(c => c.textContent.trim()) }));
  expect(await kids()).toEqual({ children: 6, all: 6, clones: ['3', null, null, null, null, '0'], text: ['Slide 4', 'Slide 1', 'Slide 2', 'Slide 3', 'Slide 4', 'Slide 1'] });
  // With loop the first slide starts at the second child, after the leading clone.
  await settle(frame, '#c', 1);
  expect(await state(frame)).toMatchObject({ active: 0, slides: 4, clones: 2 });
  const buttons = await frame.locator('#c').evaluate(el => [...el.shadowRoot.querySelectorAll('[part~="navigation-button"]')].map(b => b.getAttribute('aria-disabled')));
  expect(buttons).toEqual(['false', 'false']);
  // Each wrap is waited for until it has come to rest on the real slide, past the clone it scrolls to: previous from the first slide
  // scrolls to the leading clone, and the observer's report from there jumps to the real last slide (the fifth child). Acting before
  // that report has been delivered loses the next move to the jump (an upstream quirk, tested below), and polling activeSlide
  // alone does not wait for it: goToSlide sets activeSlide at once, before the scroll has started.
  await frame.locator('#c').evaluate(el => el.previous('auto'));
  await settle(frame, '#c', 4);
  await expect.poll(() => frame.locator('#c').evaluate(el => el.activeSlide)).toBe(3);
  expect(await state(frame)).toMatchObject({ active: 3, currentPage: 3 });
  // Next from the last slide scrolls to the trailing clone, and the jump brings it back to the real first slide (the second child).
  await frame.locator('#c').evaluate(el => el.next('auto'));
  await settle(frame, '#c', 1);
  await expect.poll(() => frame.locator('#c').evaluate(el => el.activeSlide)).toBe(0);
  expect(await state(frame)).toMatchObject({ active: 0, currentPage: 0 });
  // Turning loop off removes the clones; turning it on adds them again.
  await frame.locator('#c').evaluate(async el => { el.loop = false; await el.updateComplete; });
  expect(await kids()).toMatchObject({ children: 4 });
  await frame.locator('#c').evaluate(async el => { el.loop = true; await el.updateComplete; });
  expect(await kids()).toMatchObject({ children: 6 });
});

test('keyboard: arrows, Home and End move the carousel, keys are prevented, right-to-left reverses the arrows, focus follows to the active dot', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-carousel id="c" pagination>' + SLIDES(4) + '</sl-carousel><sl-carousel id="rtl" dir="rtl">' + SLIDES(4) + '</sl-carousel>');
  const key = (selector, key) => frame.locator(selector).evaluate((el, key) => {
    const target = el.scrollContainer;
    const event = new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  }, key);
  expect(await key('#c', 'ArrowRight')).toBe(true);
  await settle(frame, '#c', 1);
  expect(await key('#c', 'ArrowDown')).toBe(true);
  await settle(frame, '#c', 2);
  expect(await key('#c', 'ArrowLeft')).toBe(true);
  await settle(frame, '#c', 1);
  expect(await key('#c', 'ArrowUp')).toBe(true);
  await settle(frame, '#c', 0);
  // Prevented even where nothing moves.
  expect(await key('#c', 'ArrowLeft')).toBe(true);
  expect(await key('#c', 'End')).toBe(true);
  await settle(frame, '#c', 3);
  expect(await key('#c', 'Home')).toBe(true);
  await settle(frame, '#c', 0);
  expect(await key('#c', 'a')).toBe(false);
  expect(await key('#c', 'PageDown')).toBe(false);
  // RTL: Left is next, Right is previous.
  expect(await frame.locator('#rtl').evaluate(el => [el.dir, el.getAttribute('dir')])).toEqual(['rtl', 'rtl']);
  expect(await key('#rtl', 'ArrowLeft')).toBe(true);
  await expect.poll(() => frame.locator('#rtl').evaluate(el => el.activeSlide)).toBe(1);
  expect(await key('#rtl', 'ArrowRight')).toBe(true);
  await expect.poll(() => frame.locator('#rtl').evaluate(el => el.activeSlide)).toBe(0);
  // Focus in the pagination follows the active dot after a key press.
  const focus = await frame.locator('#c').evaluate(async el => {
    const dots = el.shadowRoot.querySelectorAll('[part~="pagination-item"]');
    dots[0].focus();
    dots[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true, cancelable: true }));
    await el.updateComplete;
    await new Promise(r => setTimeout(r));
    return [...dots].findIndex(d => el.shadowRoot.activeElement === d);
  });
  expect(focus).toBe(1);
});

// Real key presses go to the focused element of the top-level page, in every engine; an example's iframe would first need the frame itself
// to hold focus, which Firefox does not give it from a script focus() or a click on slotted content. So this check runs in a page of
// its own, with the carousel loaded from the package entries, like the bundle checks below.
test('keyboard from a real key press: arrow keys on the focused scroll container change the slide', async ({ page }) => {
  const pageErrors = await loadBundle(page, ENTRY);
  await page.evaluate(async markup => {
    document.body.innerHTML = markup;
    await document.querySelector('#c').updateComplete;
  }, CAROUSEL('', 3));
  await page.locator('#c #scroll-container').focus();
  await expect(page.locator('#c #scroll-container')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await settle(page, '#c', 1);
  await page.keyboard.press('End');
  await settle(page, '#c', 2);
  await page.keyboard.press('Home');
  await settle(page, '#c', 0);
  expect(pageErrors).toEqual([]);
});

test('slides-per-page and slides-per-move: the page count, the move size, snap points and the last full page', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-carousel id="c" navigation pagination slides-per-page="2" slides-per-move="2">' + SLIDES(6) + '</sl-carousel><sl-carousel id="one" pagination slides-per-page="3">' + SLIDES(5) + '</sl-carousel>');
  const r = await frame.locator('body').evaluate(() => {
    const c = document.querySelector('#c');
    const slides = [...c.children];
    return {
      pages: c.shadowRoot.querySelectorAll('[part~="pagination-item"]').length,
      style: c.scrollContainer.getAttribute('style'),
      snap: slides.map(s => s.style.getPropertyValue('scroll-snap-align')),
      onePages: document.querySelector('#one').shadowRoot.querySelectorAll('[part~="pagination-item"]').length,
      widths: slides.slice(0, 2).map(s => Math.round(s.getBoundingClientRect().width)),
      container: Math.round(c.scrollContainer.getBoundingClientRect().width),
    };
  });
  expect(r.pages).toBe(3);
  expect(r.style).toBe('--slides-per-page: 2;');
  expect(r.snap).toEqual(['', 'none', '', 'none', '', 'none']);
  // Three slides per page over five slides: three pages (0-2, 1-3, 2-4) when moving by one.
  expect(r.onePages).toBe(3);
  expect(Math.abs(r.widths[0] * 2 + 16 - r.container)).toBeLessThanOrEqual(2);
  await frame.locator('#c').evaluate(el => el.next('auto'));
  await settle(frame, '#c', 2);
  expect(await state(frame)).toMatchObject({ active: 2, currentPage: 1 });
  await frame.locator('#c').evaluate(el => el.next('auto'));
  await settle(frame, '#c', 4);
  expect(await state(frame)).toMatchObject({ active: 4, currentPage: 2 });
  // The last page is full, so going further is clamped.
  await frame.locator('#c').evaluate(el => el.goToSlide(5, 'auto'));
  await settle(frame, '#c', 4);
  expect(await state(frame)).toMatchObject({ active: 4 });
  await frame.locator('#c').evaluate(el => el.previous('auto'));
  await settle(frame, '#c', 2);
  expect(await state(frame)).toMatchObject({ active: 2 });
  // Changing slides-per-page re-lays out and re-initializes; the snap points follow slides-per-move.
  await frame.locator('#c').evaluate(async el => { el.slidesPerMove = 1; await el.updateComplete; });
  expect((await frame.locator('#c').evaluate(el => [...el.children].map(s => s.style.getPropertyValue('scroll-snap-align')))).every(v => v === '')).toBe(true);
});

test('slides added or removed are picked up: the dots, the ids and the active slide follow; a removed active slide moves the carousel back into range', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-carousel id="c" navigation pagination>' + SLIDES(3) + '</sl-carousel>');
  const info = () => frame.locator('#c').evaluate(el => ({
    pages: el.shadowRoot.querySelectorAll('[part~="pagination-item"]').length,
    ids: [...el.children].map(s => s.id), labels: [...el.children].map(s => s.getAttribute('aria-labelledby')), active: el.activeSlide,
  }));
  expect(await info()).toEqual({ pages: 3, ids: ['slide-1', 'slide-2', 'slide-3'], labels: ['tab-1', 'tab-2', 'tab-3'], active: 0 });
  await frame.locator('#c').evaluate(async el => {
    const slide = document.createElement('sl-carousel-item');
    slide.textContent = 'Slide 4';
    el.append(slide);
    await new Promise(r => setTimeout(r));
    await el.updateComplete;
  });
  expect(await info()).toEqual({ pages: 4, ids: ['slide-1', 'slide-2', 'slide-3', 'slide-4'], labels: ['tab-1', 'tab-2', 'tab-3', 'tab-4'], active: 0 });
  await frame.locator('#c').evaluate(el => el.goToSlide(3, 'auto'));
  await settle(frame, '#c', 3);
  await frame.locator('#c').evaluate(async el => {
    el.lastElementChild.remove();
    await new Promise(r => setTimeout(r));
    await el.updateComplete;
  });
  await expect.poll(() => info()).toMatchObject({ pages: 3, active: 2 });
  await settle(frame, '#c', 2);
  // Text changes and attribute changes inside a slide are not a slide change: nothing is re-initialized.
  const stable = await frame.locator('#c').evaluate(async el => {
    el.children[0].setAttribute('id', 'mine');
    el.children[0].textContent = 'Changed';
    await new Promise(r => setTimeout(r));
    return el.children[0].id;
  });
  expect(stable).toBe('mine');
});

test('the dynamic example: the buttons add and remove slides and the carousel follows', async ({ page }) => {
  const { frame } = await openPage(page, 'Adding and Removing Slides');
  const count = () => frame.locator('.dynamic-carousel').evaluate(el => ({ slides: el.querySelectorAll('sl-carousel-item').length, pages: el.shadowRoot.querySelectorAll('[part~="pagination-item"]').length, removeDisabled: document.querySelector('#dynamic-remove').disabled }));
  expect(await count()).toEqual({ slides: 3, pages: 3, removeDisabled: false });
  await frame.locator('#dynamic-add').click();
  await expect.poll(count).toEqual({ slides: 4, pages: 4, removeDisabled: false });
  await frame.locator('#dynamic-remove').click();
  await frame.locator('#dynamic-remove').click();
  await expect.poll(count).toEqual({ slides: 2, pages: 2, removeDisabled: false });
  await frame.locator('#dynamic-remove').click();
  await expect.poll(count).toEqual({ slides: 1, pages: 1, removeDisabled: true });
});

test('vertical orientation: the vertical layout classes, scrolling on the block axis, and ArrowDown and ArrowUp', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-carousel id="c" orientation="vertical" pagination style="max-height: 320px">' + SLIDES(4) + '</sl-carousel>');
  const r = await frame.locator('#c').evaluate(el => {
    const c = el.scrollContainer;
    const style = getComputedStyle(c);
    return { classes: c.className.trim().split(/\s+/).sort(), flow: style.gridAutoFlow, snap: style.scrollSnapType, overflowX: style.overflowX, canScrollY: c.scrollHeight > c.clientHeight, canScrollX: c.scrollWidth > c.clientWidth + 1 };
  });
  expect(r).toEqual({ classes: ['carousel__slides', 'carousel__slides--vertical'], flow: 'row', snap: 'y mandatory', overflowX: 'hidden', canScrollY: true, canScrollX: false });
  await frame.locator('#c').evaluate(el => el.next('auto'));
  await settle(frame, '#c', 1);
  expect(await frame.locator('#c').evaluate(el => [el.scrollContainer.scrollTop > 0, el.scrollContainer.scrollLeft])).toEqual([true, 0]);
  await frame.locator('#c').evaluate(el => el.scrollContainer.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true, cancelable: true })));
  await settle(frame, '#c', 2);
  await frame.locator('#c').evaluate(el => el.scrollContainer.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, composed: true, cancelable: true })));
  await settle(frame, '#c', 1);
  expect(await state(frame)).toMatchObject({ active: 1, currentPage: 1 });
});

// A timer witness for the autoplay checks. The autoplay controller starts its timer with `window.setInterval(tick, interval)` and
// stops it with `clearInterval`. For the three marker intervals (1234, 2345 and the default 3000) the witness records the call
// instead of starting a real timer, so the test sees exactly which interval was configured, can fire a tick by hand and can see
// when the timer is cleared: no checks depend on elapsed time. Any other interval goes to the real timer.
const TIMER_WITNESS = `(markers) => {
  const real = { setInterval: window.setInterval.bind(window), clearInterval: window.clearInterval.bind(window) };
  const timers = new Map();
  let last = 1e9;
  window.setInterval = (fn, ms, ...args) => {
    if (!markers.includes(ms)) return real.setInterval(fn, ms, ...args);
    timers.set(++last, { fn, ms });
    return last;
  };
  window.clearInterval = id => { if (timers.has(id)) timers.delete(id); else real.clearInterval(id); };
  return timers;
}`;

test('autoplay starts a timer with the configured interval, advances on each tick, pauses while the pointer is over it, it holds focus or it is touched, stops when turned off and does not restart on reconnect or on an interval change (upstream quirks)', async ({ page }) => {
  const { frame } = await openPage(page);
  const r = await frame.locator('body').evaluate(async (body, { witness, slides }) => {
    const timers = new Function(`return (${witness})`)()([1234, 2345, 3000]);
    const intervals = () => [...timers.values()].map(t => t.ms).sort((a, b) => a - b);
    const idOf = ms => [...timers].find(([, t]) => t.ms === ms)?.[0] ?? null;
    const host = document.createElement('div');
    host.innerHTML = `<sl-carousel id="a" autoplay autoplay-interval="1234" loop>${slides}</sl-carousel><sl-carousel id="d" autoplay loop>${slides}</sl-carousel><sl-carousel id="off" loop autoplay-interval="2345">${slides}</sl-carousel>`;
    body.append(host);
    const [a, d, off] = [...host.children];
    await Promise.all([a.updateComplete, d.updateComplete, off.updateComplete]);
    const out = { started: intervals() };
    const seen = [];
    a.addEventListener('sl-slide-change', e => seen.push(e.detail.index));
    // One tick per step: the callback the controller registered runs next(), and the change is emitted from the update.
    const tick = async ms => { timers.get(idOf(ms)).fn(); await a.updateComplete; return seen.length; };
    out.sequence = [];
    for (let i = 0; i < 4; i++) { await tick(1234); out.sequence.push(seen.at(-1)); }
    // Paused: a tick while the pointer is over the carousel, focus is inside it or it is touched changes nothing; after the end it advances again.
    const guarded = async (start, end) => {
      start();
      const before = seen.length;
      const during = await tick(1234);
      end();
      const after = await tick(1234);
      return [during - before, after - before];
    };
    out.hover = await guarded(() => a.dispatchEvent(new MouseEvent('mouseenter')), () => a.dispatchEvent(new MouseEvent('mouseleave')));
    out.focus = await guarded(() => a.dispatchEvent(new FocusEvent('focusin', { bubbles: true })), () => a.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
    out.touch = await guarded(() => a.dispatchEvent(new Event('touchstart')), () => a.dispatchEvent(new Event('touchend')));
    // Two interactions: still paused after the first ends, and running after the second.
    a.dispatchEvent(new MouseEvent('mouseenter'));
    a.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    a.dispatchEvent(new MouseEvent('mouseleave'));
    const beforeBoth = seen.length;
    const stillPaused = (await tick(1234)) - beforeBoth;
    a.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    out.both = [stillPaused, (await tick(1234)) - beforeBoth];
    // The other carousels are unaffected: the default interval is 3000 milliseconds.
    out.defaultInterval = timers.get(idOf(3000)) !== undefined;
    // Changing the interval does not restart the running timer: the same timer stays, and no new one is started.
    const id = idOf(1234);
    a.autoplayInterval = 2345;
    await a.updateComplete;
    out.intervalChange = { sameTimer: idOf(1234) === id, started: intervals() };
    // Turning autoplay off clears the timer; turning it on again starts one with the interval then set.
    a.autoplay = false;
    await a.updateComplete;
    out.turnedOff = intervals();
    a.autoplay = true;
    await a.updateComplete;
    out.turnedOn = intervals();
    // Moving the element in the document clears the timer and nothing starts it again, although autoplay is still set.
    host.append(a);
    await a.updateComplete;
    out.reconnected = { timers: intervals(), autoplay: a.autoplay };
    // A carousel without autoplay has no timer; setting it starts one with the interval it has (2345 here).
    out.beforeEnable = intervals();
    off.autoplay = true;
    await off.updateComplete;
    out.afterEnable = intervals();
    host.remove();
    return out;
  }, { witness: TIMER_WITNESS, slides: SLIDES(3) });
  // The configured interval: 1234 for the carousel that set it and the default 3000 for the one that did not.
  expect(r.started).toEqual([1234, 3000]);
  expect(r.sequence).toEqual([1, 2, 0, 1]);
  expect(r.hover).toEqual([0, 1]);
  expect(r.focus).toEqual([0, 1]);
  expect(r.touch).toEqual([0, 1]);
  expect(r.both).toEqual([0, 1]);
  expect(r.defaultInterval).toBe(true);
  expect(r.intervalChange).toEqual({ sameTimer: true, started: [1234, 3000] });
  expect(r.turnedOff).toEqual([3000]);
  expect(r.turnedOn).toEqual([2345, 3000]);
  // Disconnecting stopped the timer; only the other carousel's remains.
  expect(r.reconnected).toEqual({ timers: [3000], autoplay: true });
  expect(r.beforeEnable).toEqual([3000]);
  expect(r.afterEnable).toEqual([2345, 3000]);
});

// The real timer end to end, with no witness: the carousel advances by itself, each slide in turn. The wait is on the changes
// themselves, with a generous deadline.
test('autoplay advances through the slides by itself with the browser\'s own timer', async ({ page }) => {
  const { frame } = await openPage(page);
  // The listener is on the document before the carousel exists, so no change is missed.
  await frame.locator('body').evaluate(() => {
    window.seen = [];
    document.addEventListener('sl-slide-change', e => window.seen.push(e.detail.index));
  });
  await mount(frame, '<sl-carousel id="c" autoplay autoplay-interval="80" loop>' + SLIDES(3) + '</sl-carousel>');
  const seen = await frame.locator('body').evaluate(async () => {
    await new Promise((resolve, reject) => {
      const end = Date.now() + 8000;
      const t = setInterval(() => { if (window.seen.length >= 4) { clearInterval(t); resolve(); } else if (Date.now() > end) { clearInterval(t); reject(new Error('timed out')); } }, 20);
    });
    return window.seen.slice(0, 4);
  });
  expect(seen).toEqual([1, 2, 0, 1]);
});

test('mouse dragging: with mouse-dragging a drag moves the carousel and snaps to the next slide, the click that ends a long drag is prevented, and without it a drag does nothing', async ({ page }) => {
  const { frame } = await openPage(page, 'Mouse Dragging');
  await mount(frame, '<sl-carousel id="c" mouse-dragging>' + SLIDES(3) + '</sl-carousel><sl-carousel id="plain">' + SLIDES(3) + '</sl-carousel>');
  await frame.locator('body').evaluate(() => {
    window.clicks = [];
    window.movement = 0;
    document.addEventListener('click', e => window.clicks.push(e.defaultPrevented));
    document.addEventListener('pointermove', e => { window.movement += Math.abs(e.movementX || 0); }, true);
  });
  const drag = async selector => {
    await frame.locator(selector).scrollIntoViewIfNeeded();
    const box = await frame.locator(selector).boundingBox();
    const y = box.y + box.height / 2;
    // Seven tenths of the width: past the halfway point, so every engine snaps to the next slide.
    await page.mouse.move(box.x + box.width * 0.9, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.6, y, { steps: 5 });
    await page.mouse.move(box.x + box.width * 0.2, y, { steps: 5 });
    await expect.poll(() => frame.locator(selector).evaluate(el => el.dragging)).toBe(selector === '#c');
    await page.mouse.up();
  };
  await drag('#c');
  // Shoelace's drag scrolls by the pointer events' movementX. Where an engine reports none for real pointer moves (the WebKit
  // build Playwright ships), the carousel enters and leaves the dragging state, restores the snapping and clears the click, but
  // does not scroll: matched, not worked around. The expectation follows what the engine reports.
  const moves = await frame.locator('body').evaluate(() => window.movement > 0);
  await expect.poll(() => frame.locator('#c').evaluate(el => [el.dragging, el.scrolling]), { timeout: 8000 }).toEqual([false, false]);
  expect(await frame.locator('#c').evaluate(el => el.scrollContainer.style.scrollSnapType)).toBe('');
  if (moves) {
    await expect.poll(() => frame.locator('#c').evaluate(el => el.activeSlide), { timeout: 8000 }).toBe(1);
    await settle(frame, '#c', 1);
  } else {
    expect(await frame.locator('#c').evaluate(el => [el.activeSlide, el.scrollContainer.scrollLeft])).toEqual([0, 0]);
  }
  // The click that ends a drag longer than ten pixels is prevented; a plain click afterwards is not.
  expect(await frame.locator('body').evaluate(() => window.clicks)).toEqual([true]);
  const box = await frame.locator('#c').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  expect(await frame.locator('body').evaluate(() => window.clicks)).toEqual([true, false]);
  const before = await frame.locator('#plain').evaluate(el => [el.activeSlide, el.scrollContainer.scrollLeft]);
  await drag('#plain');
  expect(await frame.locator('#plain').evaluate(el => [el.activeSlide, el.dragging, el.scrollContainer.scrollLeft])).toEqual([before[0], false, before[1]]);
});

test('the mouse dragging example: the switch turns mouse-dragging on and off', async ({ page }) => {
  const { frame } = await openPage(page, 'Mouse Dragging');
  const drag = () => frame.locator('.mouse-dragging sl-carousel').evaluate(el => el.mouseDragging);
  expect(await drag()).toBe(false);
  await frame.locator('.mouse-dragging sl-switch').click();
  await expect.poll(drag).toBe(true);
  await frame.locator('.mouse-dragging sl-switch').click();
  await expect.poll(drag).toBe(false);
});

test('--aspect-ratio, --scroll-hint and --slide-gap shape the scroll container and the slides', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-carousel id="c">' + SLIDES(3) + '</sl-carousel><sl-carousel id="square" style="--aspect-ratio: 1 / 1; --scroll-hint: 10%; --slide-gap: 40px">' + SLIDES(3) + '</sl-carousel>');
  const r = await frame.locator('body').evaluate(() => {
    const measure = id => {
      const el = document.querySelector(id);
      const c = el.scrollContainer;
      const style = getComputedStyle(c);
      const slides = [...el.children].map(s => s.getBoundingClientRect());
      return { ratio: Math.round((c.clientWidth / c.clientHeight) * 100) / 100, padding: [style.paddingLeft, style.paddingRight], hint: Math.round(c.clientWidth * 0.1), gap: Math.round(slides[1].left - slides[0].right), slideWidth: Math.round(slides[0].width), content: Math.round(c.clientWidth) };
    };
    return { plain: measure('#c'), square: measure('#square') };
  });
  expect(r.plain.ratio).toBeCloseTo(16 / 9, 1);
  expect(r.plain.padding).toEqual(['0px', '0px']);
  expect(r.plain.gap).toBe(16);
  expect(r.square.ratio).toBeCloseTo(1, 1);
  expect(r.square.padding.every(p => Math.abs(parseFloat(p) - r.square.hint) <= 1)).toBe(true);
  expect(r.square.gap).toBe(40);
});

test('right-to-left: the default icons swap, the carousel scrolls to the same slides, and a direction set only as a property is honored', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-carousel id="c" dir="rtl" navigation pagination>' + SLIDES(3) + '</sl-carousel><sl-carousel id="prop" navigation>' + SLIDES(3) + '</sl-carousel>');
  const icons = selector => frame.locator(selector).evaluate(el => [...el.shadowRoot.querySelectorAll('sl-icon')].map(i => i.getAttribute('name')));
  expect(await icons('#c')).toEqual(['chevron-right', 'chevron-left']);
  expect(await icons('#prop')).toEqual(['chevron-left', 'chevron-right']);
  await frame.locator('#prop').evaluate(async el => { el.dir = 'rtl'; await el.updateComplete; });
  expect(await icons('#prop')).toEqual(['chevron-right', 'chevron-left']);
  // In a right-to-left carousel the slide starts at the right edge (and the scroll offset is negative); wait on the geometry, since
  // the active slide is set before the scroll happens.
  const atRightEdge = index => frame.locator('#c').evaluate((el, i) => {
    const box = el.scrollContainer.getBoundingClientRect();
    return !el.scrolling && el.activeSlide === i && Math.abs(el.children[i].getBoundingClientRect().right - box.right) <= 1 && el.scrollContainer.scrollLeft < 0;
  }, index);
  await frame.locator('#c').evaluate(el => el.next('auto'));
  await expect.poll(() => atRightEdge(1)).toBe(true);
  await frame.locator('#c').evaluate(el => el.goToSlide(2, 'auto'));
  await expect.poll(() => atRightEdge(2)).toBe(true);
  expect(await frame.locator('#c').evaluate(el => el.shadowRoot.querySelector('[part~="navigation-button--next"]').getAttribute('aria-disabled'))).toBe('true');
});

test('text comes from the localization: a registered translation and a lang attribute translate the host label, the slide labels, the dots and the buttons', async ({ page }) => {
  const outDir = await buildFixtures({ carousel: "import '@charm-ux/velcro/carousel';\nimport '@charm-ux/velcro/carousel-item';\nimport '@charm-ux/velcro/translations/de';" });
  await gotoBlank(page, outDir);
  const r = await page.evaluate(async () => {
    await import('/carousel.js');
    const slides = n => Array.from({ length: n }, (_, i) => `<sl-carousel-item>S${i}</sl-carousel-item>`).join('');
    document.body.innerHTML = `<sl-carousel id="c" lang="de" navigation pagination>${slides(2)}</sl-carousel><sl-carousel id="plain" navigation pagination>${slides(2)}</sl-carousel>`;
    const els = [...document.querySelectorAll('sl-carousel')];
    await Promise.all(els.map(el => el.updateComplete));
    const read = el => ({
      host: el.getAttribute('aria-label'), slides: [...el.children].map(s => s.getAttribute('aria-label') ?? s.getAttribute('aria-labelledby')),
      dots: [...el.shadowRoot.querySelectorAll('[part~="pagination-item"]')].map(b => b.getAttribute('aria-label')),
      buttons: [...el.shadowRoot.querySelectorAll('[part~="navigation-button"]')].map(b => b.getAttribute('aria-label')),
    });
    return { de: read(els[0]), plain: read(els[1]) };
  });
  expect(r.de).toEqual({ host: 'Karussell', slides: ['tab-1', 'tab-2'], dots: ['Folie 1', 'Zu Folie 2 von 2 gehen'], buttons: ['Vorherige Folie', 'Nächste Folie'] });
  expect(r.plain).toEqual({ host: 'Carousel', slides: ['tab-1', 'tab-2'], dots: ['Slide 1', 'Go to slide 2 of 2'], buttons: ['Previous slide', 'Next slide'] });
});

test('slots: previous-icon and next-icon replace the default chevrons', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-carousel id="c" navigation><span slot="previous-icon" id="prev">P</span><span slot="next-icon" id="next">N</span>' + SLIDES(2) + '</sl-carousel>');
  const r = await frame.locator('#c').evaluate(el => ({
    prev: el.shadowRoot.querySelector('slot[name="previous-icon"]').assignedElements().map(e => e.id),
    next: el.shadowRoot.querySelector('slot[name="next-icon"]').assignedElements().map(e => e.id),
    visible: ['#prev', '#next'].map(s => el.querySelector(s).getBoundingClientRect().width > 0),
    defaultSlot: el.shadowRoot.querySelector('#scroll-container slot').assignedElements().map(e => e.localName),
  }));
  expect(r).toEqual({ prev: ['prev'], next: ['next'], visible: [true, true], defaultSlot: ['sl-carousel-item', 'sl-carousel-item'] });
});

test('upstream quirk: the hidden attribute does not hide a carousel or a carousel item', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-carousel id="c" hidden><sl-carousel-item id="i" hidden>One</sl-carousel-item></sl-carousel>');
  const r = await frame.locator('body').evaluate(() => ['#c', '#i'].map(s => { const el = document.querySelector(s); return [getComputedStyle(el).display, el.getClientRects().length > 0]; }));
  expect(r).toEqual([['flex', true], ['flex', true]]);
});

test('upstream quirk: on connect the host role and label and each slide\'s role, label, id and aria-hidden are overwritten', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, `
    <sl-carousel id="c" role="list" aria-label="Mine">
      <sl-carousel-item id="mine" role="note" aria-label="Own label">One</sl-carousel-item>
      <sl-carousel-item>Two</sl-carousel-item>
    </sl-carousel>
    <sl-carousel id="p" pagination>
      <sl-carousel-item id="mine2" role="note" aria-label="Own label">One</sl-carousel-item>
      <sl-carousel-item>Two</sl-carousel-item>
    </sl-carousel>`);
  const r = await frame.locator('body').evaluate(() => {
    const read = el => ({ id: el.id, role: el.getAttribute('role'), label: el.getAttribute('aria-label'), labelledBy: el.getAttribute('aria-labelledby') });
    return { host: read(document.querySelector('#c')), plain: [...document.querySelector('#c').children].map(read), paged: [...document.querySelector('#p').children].map(read) };
  });
  expect(r.host).toMatchObject({ role: 'region', label: 'Carousel' });
  // Without pagination a slide keeps its id and gets role="group" and the "Slide n" label.
  expect(r.plain).toEqual([{ id: 'mine', role: 'group', label: 'Slide 1', labelledBy: null }, { id: '', role: 'group', label: 'Slide 2', labelledBy: null }]);
  // With pagination its id is replaced, it becomes a tab panel labelled by its dot and loses the label.
  expect(r.paged).toEqual([{ id: 'slide-1', role: 'tabpanel', label: null, labelledBy: 'tab-1' }, { id: 'slide-2', role: 'tabpanel', label: null, labelledBy: 'tab-2' }]);
});

test('upstream quirk: aria-hidden and inert follow what is in view and replace the page\'s; the ARIA references between the dots and the slides cross a shadow boundary and cannot resolve; looped clones repeat the ids', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-carousel id="c" pagination>' + SLIDES(3, 'aria-hidden="true"') + '</sl-carousel><sl-carousel id="l" pagination loop>' + SLIDES(2) + '</sl-carousel>');
  await expect.poll(() => frame.locator('#c').evaluate(el => [...el.children].map(s => [s.getAttribute('aria-hidden'), s.hasAttribute('inert'), s.classList.contains('--in-view')])))
    .toEqual([['false', false, true], ['true', true, false], ['true', true, false]]);
  const r = await frame.locator('body').evaluate(() => {
    const c = document.querySelector('#c');
    const dot = c.shadowRoot.querySelector('[part~="pagination-item"]');
    return {
      controls: dot.getAttribute('aria-controls'),
      fromShadow: c.shadowRoot.getElementById(dot.getAttribute('aria-controls')),
      fromDocument: document.getElementById(c.children[0].getAttribute('aria-labelledby')),
      // Every carousel with pagination writes slide-1, slide-2 ...: the two carousels here and the clone repeat slide-1.
      sharedSlide1: [...document.querySelectorAll('[id="slide-1"]')].filter(e => e.closest('#c, #l')).length,
      cloneIds: [...document.querySelector('#l').children].map(s => [s.id, s.getAttribute('data-clone')]),
    };
  });
  expect(r.controls).toBe('slide-1');
  expect(r.fromShadow).toBeNull();
  expect(r.fromDocument).toBeNull();
  expect(r.sharedSlide1).toBe(3);
  expect(r.cloneIds).toEqual([['slide-2', '1'], ['slide-1', null], ['slide-2', null], ['slide-1', '0']]);
});

test('the active slide gets the --is-active class only once it changes (upstream quirk: none has it after the first render)', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, CAROUSEL('', 3));
  expect(await state(frame)).toMatchObject({ active: 0, activeClasses: [false, false, false] });
  await frame.locator('#c').evaluate(el => el.next('auto'));
  await settle(frame, '#c', 1);
  expect(await state(frame)).toMatchObject({ active: 1, activeClasses: [false, true, false] });
  await frame.locator('#c').evaluate(el => el.previous('auto'));
  await settle(frame, '#c', 0);
  expect(await state(frame)).toMatchObject({ active: 0, activeClasses: [true, false, false] });
});

test('upstream quirk: a go-to before the intersection observer\'s first report makes the active slide go to the target, back to the first slide, then to the target again', async ({ page }) => {
  const { frame } = await openPage(page);
  // As a gallery thumbnail click right after the carousel renders: goToSlide(3) before the observer has reported any slide in view. Its
  // first report sees the carousel still at its start and sets the first slide active (a pending go-to does not hold it back); the
  // scroll's end sets slide 3 again. Shoelace 2.20.1's own build does the same in each engine (A/B in the same fixture).
  const beforeFirstReport = await frame.locator('body').evaluate(async body => {
    document.querySelector('#mount')?.remove();
    const host = document.createElement('div');
    host.id = 'mount';
    host.innerHTML = '<sl-carousel id="c" navigation loop>' + [1, 2, 3, 4, 5].map(i => `<sl-carousel-item>Slide ${i}</sl-carousel-item>`).join('') + '</sl-carousel>';
    body.prepend(host);
    const el = host.firstElementChild;
    window.slideChanges = [];
    el.addEventListener('sl-slide-change', e => window.slideChanges.push(e.detail.index));
    await el.updateComplete;
    const beforeReport = !el.querySelector('.--in-view');
    el.goToSlide(3);
    return beforeReport;
  });
  expect(beforeFirstReport).toBe(true);
  await settle(frame, '#c', 4);
  await expect.poll(() => frame.locator('#c').evaluate(el => el.activeSlide)).toBe(3);
  const seen = await frame.locator('body').evaluate(() => window.slideChanges);
  // 3, then 0 from the observer's first report, and 3 again at rest. Chromium also reports the slides passed on the way back up
  // (3, 0, 1, 2, 3), so only these positions are asserted, each on its own line.
  expect(seen[0]).toBe(3);
  expect(seen[1]).toBe(0);
  expect(seen.at(-1)).toBe(3);
});

test('upstream quirk: a move made after a looping wrap\'s scroll has ended, but before the observer has reported the clone it reached, is replaced by the jump to the real slide', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-carousel id="c" loop pagination navigation>' + SLIDES(4) + '</sl-carousel>');
  await settle(frame, '#c', 1);
  // previous() from the first slide scrolls to the leading clone. Its scroll end creates an intersection observer, whose first report is
  // computed in the next frame, after that frame's animation-frame callbacks, and delivered after it. next() is called in such a
  // callback: it sets slide 0 and schedules its scroll, then the report (made at the clone) sets slide 3 and schedules the jump to
  // the real last slide, which runs after next()'s scroll. So the carousel comes to rest on slide 3, not 0. Shoelace 2.20.1's own
  // build does the same (A/B in the same fixture). This is how the loop test above lost its next() when it did not wait.
  await frame.locator('#c').evaluate(el => {
    window.slideChanges = [];
    el.addEventListener('sl-slide-change', e => window.slideChanges.push(e.detail.index));
    el.scrollContainer.addEventListener('scrollend', () => requestAnimationFrame(() => el.next('auto')), { once: true });
    el.previous('auto');
  });
  await expect.poll(() => frame.locator('body').evaluate(() => window.slideChanges.length)).toBe(3);
  await settle(frame, '#c', 4);
  await expect.poll(() => frame.locator('#c').evaluate(el => el.activeSlide)).toBe(3);
  expect(await frame.locator('body').evaluate(() => window.slideChanges)).toEqual([3, 0, 3]);
});

test('a carousel removed before its first update, or after it, reports no error and is gone', async ({ page }) => {
  const { frame } = await openPage(page);
  const r = await frame.locator('body').evaluate(async body => {
    const errors = [];
    const on = e => { errors.push(String(e.message)); e.preventDefault(); };
    window.addEventListener('error', on);
    const early = document.createElement('sl-carousel');
    body.append(early);
    early.remove();
    await new Promise(resolve => setTimeout(resolve));
    const late = document.createElement('sl-carousel');
    body.append(late);
    await late.updateComplete;
    late.remove();
    await new Promise(resolve => setTimeout(resolve));
    window.removeEventListener('error', on);
    return { errors, removed: !early.isConnected && !late.isConnected };
  });
  expect(r).toEqual({ errors: [], removed: true });
});

test('ready is emitted once on the first update and does not bubble (a Velcro extension from core)', async ({ page }) => {
  const { frame } = await openPage(page);
  const r = await frame.locator('body').evaluate(async body => {
    const seen = [];
    const el = document.createElement('sl-carousel');
    el.addEventListener('ready', e => seen.push([e.bubbles, e.composed, e.target === el]));
    document.addEventListener('ready', e => seen.push(['document', e.target.localName]));
    body.append(el);
    await el.updateComplete;
    el.requestUpdate();
    await el.updateComplete;
    el.remove();
    return seen;
  });
  expect(r).toEqual([[false, false, true]]);
});

test('an empty carousel does nothing: no slides, no pages, no errors from the methods', async ({ page }) => {
  const { frame } = await openPage(page);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await mount(frame, '<sl-carousel id="c" navigation pagination loop></sl-carousel>');
  const r = await frame.locator('#c').evaluate(async el => {
    el.next(); el.previous(); el.goToSlide(3);
    await new Promise(r => setTimeout(r, 100));
    return { active: el.activeSlide, pages: el.shadowRoot.querySelectorAll('[part~="pagination-item"]').length, children: el.children.length };
  });
  expect(r).toEqual({ active: 0, pages: 0, children: 0 });
  expect(errors).toEqual([]);
});

test('a carousel item on its own: a flex container around one default slot, with the aspect ratio and snap alignment, and images forced to fill it', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-carousel-item id="i" style="--aspect-ratio: 2 / 1; width: 200px"><img id="img" width="10" height="10" alt="" src="data:image/svg+xml,%3Csvg xmlns=%27http:%2F%2Fwww.w3.org%2F2000%2Fsvg%27 viewBox=%270 0 10 10%27/%3E"></sl-carousel-item>');
  const r = await frame.locator('#i').evaluate(el => {
    const style = getComputedStyle(el);
    const img = el.querySelector('#img').getBoundingClientRect();
    const box = el.getBoundingClientRect();
    return {
      shadow: [...el.shadowRoot.children].filter(n => n.localName !== 'style').map(n => n.localName + (n.name ? `[${n.name}]` : '')),
      display: [style.display, style.flexDirection, style.alignItems, style.justifyContent], snap: [style.scrollSnapAlign, style.scrollSnapStop],
      ratio: Math.round((box.width / box.height) * 10) / 10, fit: getComputedStyle(el.querySelector('#img')).objectFit, imgFills: [Math.round(img.width), Math.round(img.height)], box: [Math.round(box.width), Math.round(box.height)],
    };
  });
  expect(r.shadow).toEqual(['slot']);
  expect(r.display).toEqual(['flex', 'column', 'center', 'center']);
  expect(r.snap).toEqual(['start', 'always']);
  expect(r.ratio).toBe(2);
  expect(r.fit).toBe('cover');
  expect(r.imgFills).toEqual(r.box);
});

test('the aspect ratio example: the select changes the carousel\'s --aspect-ratio', async ({ page }) => {
  const { frame } = await openPage(page, 'Aspect Ratio');
  const ratio = () => frame.locator('sl-carousel.aspect-ratio').evaluate(el => Math.round((el.scrollContainer.clientWidth / el.scrollContainer.clientHeight) * 10) / 10);
  expect(await ratio()).toBe(1.5);
  await frame.locator('sl-select[name="aspect"]').evaluate(async el => { el.value = '1/1'; el.dispatchEvent(new CustomEvent('sl-change', { bubbles: true, composed: true })); });
  await expect.poll(ratio).toBe(1);
  expect(await frame.locator('sl-carousel.aspect-ratio').evaluate(el => el.style.getPropertyValue('--aspect-ratio'))).toBe('1/1');
});

test('the gallery example: clicking a thumbnail goes to its slide and the thumbnail of the active slide is highlighted', async ({ page }) => {
  const { frame } = await openPage(page, 'Gallery Example');
  const active = () => frame.locator('.thumbnails__image').evaluateAll(imgs => imgs.map(i => i.classList.contains('active')));
  expect(await active()).toEqual([true, false, false, false, false]);
  await frame.locator('.thumbnails__image').nth(2).click();
  await expect.poll(active).toEqual([false, false, true, false, false]);
  await expect.poll(() => frame.locator('.carousel-thumbnails').evaluate(el => [el.activeSlide, el.scrolling])).toEqual([2, false]);
  await frame.locator('.carousel-thumbnails').evaluate(el => el.next('auto'));
  await expect.poll(active).toEqual([false, false, false, true, false]);
});

test('the other examples render the carousels their text describes', async ({ page }) => {
  await openPage(page);
  const describe = async section => page.frameLocator(`iframe.example[title="${title(section)}"]`).locator('sl-carousel').first().evaluate(el => ({
    loop: el.loop, navigation: el.navigation, pagination: el.pagination, autoplay: el.autoplay, drag: el.mouseDragging, perPage: el.slidesPerPage, perMove: el.slidesPerMove, orientation: el.orientation,
    hint: el.style.getPropertyValue('--scroll-hint'),
  }));
  const base = { loop: false, navigation: false, pagination: false, autoplay: false, drag: false, perPage: 1, perMove: 1, orientation: 'horizontal', hint: '' };
  expect(await describe('Default')).toEqual({ ...base, loop: true, navigation: true, pagination: true, drag: true });
  expect(await describe('Pagination')).toEqual({ ...base, pagination: true });
  expect(await describe('Navigation')).toEqual({ ...base, navigation: true });
  expect(await describe('Looping')).toEqual({ ...base, loop: true, navigation: true, pagination: true });
  expect(await describe('Autoplay')).toEqual({ ...base, loop: true, pagination: true, autoplay: true });
  expect(await describe('Multiple Slides Per View')).toEqual({ ...base, navigation: true, pagination: true, perPage: 2, perMove: 2 });
  expect(await describe('Vertical Scrolling')).toEqual({ ...base, pagination: true, orientation: 'vertical' });
  expect(await describe('Scroll Hint')).toEqual({ ...base, pagination: true, hint: '10%' });
});

// Bundles of the package entries through the package's real export map, loaded into top-level documents made by the test.
const ENTRY = `
  import '@charm-ux/velcro/carousel';
  import '@charm-ux/velcro/carousel-item';
  window.loaded = true;
`;
const CLASS_ENTRY = `
  import { SlCarousel, VelcroCarousel } from '@charm-ux/velcro/carousel/class';
  import { SlCarouselItem, VelcroCarouselItem } from '@charm-ux/velcro/carousel-item/class';
  window.carouselClasses = { SlCarousel, VelcroCarousel, SlCarouselItem, VelcroCarouselItem };
  window.loaded = true;
`;
const bundles = new Map();

async function build(entries, extra = {}) {
  const fromDocs = createRequire(path.join(docsDir, 'package.json'));
  const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
  const dir = mkdtempSync(path.join(tmpdir(), 'velcro-carousel-'));
  try {
    for (const [name, source] of Object.entries(entries)) writeFileSync(path.join(dir, name), source);
    const out = await build({
      configFile: false, logLevel: 'silent', root: dir,
      plugins: [{
        name: 'velcro-package-exports',
        async resolveId(id) {
          if (!id.startsWith('@charm-ux/velcro/')) return null;
          return (await this.resolve(id, path.join(docsDir, 'app.ts'), { skipSelf: true })) ?? null;
        },
      }],
      ...extra,
      build: { write: false, minify: false, rollupOptions: { input: path.join(dir, 'entry.js'), output: { format: 'es', codeSplitting: false } } },
    });
    return (Array.isArray(out) ? out[0] : out).output.find(o => o.type === 'chunk').code;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function loadBundle(page, source) {
  if (!bundles.has(source)) bundles.set(source, await build({ 'entry.js': source }));
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.setContent('<!DOCTYPE html><html class="sl-theme-light" lang="en"><body></body></html>');
  await page.addStyleTag({ content: readFileSync(path.join(velcroDir, 'themes/light.css'), 'utf8') });
  await page.addScriptTag({ type: 'module', content: bundles.get(source) });
  await page.waitForFunction(() => window.loaded === true);
  return pageErrors;
}

test('registering entries define sl-carousel, sl-carousel-item and sl-icon through the package exports, and the carousel works from the bundle', async ({ page }) => {
  const pageErrors = await loadBundle(page, ENTRY);
  const r = await page.evaluate(async () => {
    document.body.innerHTML = '<sl-carousel id="c" navigation pagination><sl-carousel-item>A</sl-carousel-item><sl-carousel-item>B</sl-carousel-item></sl-carousel>';
    const el = document.querySelector('#c');
    await el.updateComplete;
    el.next('auto');
    await new Promise(resolve => { const t = setInterval(() => { if (el.activeSlide === 1 && !el.scrolling) { clearInterval(t); resolve(); } }, 20); });
    return { tags: ['sl-carousel', 'sl-carousel-item', 'sl-icon'].map(t => customElements.get(t)?.name ?? null), active: el.activeSlide, icons: el.shadowRoot.querySelectorAll('sl-icon').length };
  });
  expect(r).toEqual({ tags: ['VelcroCarousel', 'VelcroCarouselItem', 'VelcroIcon'], active: 1, icons: 2 });
  expect(pageErrors).toEqual([]);
});

test('class-only entries: importing defines nothing; constructing a carousel defines Velcro\'s sl-icon but not the item', async ({ page }) => {
  const pageErrors = await loadBundle(page, CLASS_ENTRY);
  const r = await page.evaluate(() => {
    const { SlCarousel, VelcroCarousel, SlCarouselItem, VelcroCarouselItem } = window.carouselClasses;
    const tags = () => ['sl-carousel', 'sl-carousel-item', 'sl-icon'].map(t => customElements.get(t)?.name ?? null);
    const afterImport = tags();
    customElements.define('sl-carousel', SlCarousel);
    document.body.append(document.createElement('sl-carousel'));
    return { afterImport, afterConstruct: tags(), aliases: [SlCarousel === VelcroCarousel, SlCarouselItem === VelcroCarouselItem] };
  });
  expect(r).toEqual({ afterImport: [null, null, null], afterConstruct: ['VelcroCarousel', null, 'VelcroIcon'], aliases: [true, true] });
  expect(pageErrors).toEqual([]);
});

// Shoelace's carousel imports its scrollend polyfill for its side effect; a bundler drops such an import from a module the
// package marks side-effect free, so the polyfill module is listed in the package's sideEffects (the tab group's copy).
test('bundles of the class-only and registering entries keep Shoelace\'s scrollend polyfill', async () => {
  for (const source of [CLASS_ENTRY, ENTRY]) {
    if (!bundles.has(source)) bundles.set(source, await build({ 'entry.js': source }));
    const code = bundles.get(source);
    expect(code).toMatch(/["']onscrollend["'] in window/);
    expect(code).toContain('touchcancel');
  }
});

// Shoelace's React examples, ported in packages/docs/examples/carousel/react/*.jsx, bundled with React 19 and the generated
// wrappers, which are resolved through the package's real export map.
// The title is short on purpose: CI's public failure summary is cut at 200 characters, and a long title pushes the failing line
// number out of it. Every property is asserted on its own line for the same reason.
test('React examples render through the generated wrappers with the HTML examples\' props; the dynamic, drag and gallery ones work', async ({ page }) => {
  const names = ORDER.map(([id]) => id);
  const fromVelcro = createRequire(path.join(velcroDir, 'package.json'));
  const pkgDir = name => path.dirname(fromVelcro.resolve(`${name}/package.json`));
  const entries = Object.fromEntries(names.map(n => [`${n}.jsx`, `${readFileSync(path.join(docsDir, `examples/carousel/react/${n}.jsx`), 'utf8')}\nexport default App;\n`]));
  entries['entry.js'] = `
    import React from 'react';
    import { flushSync } from 'react-dom';
    import { createRoot } from 'react-dom/client';
    ${names.map((n, i) => `import App${i} from './${n}.jsx';`).join('\n')}
    const apps = { ${names.map((n, i) => `'${n}': App${i}`).join(', ')} };
    window.errors = [];
    addEventListener('error', e => window.errors.push(String(e.message)));
    window.renderExample = name => {
      const host = document.createElement('div');
      host.id = name;
      document.body.prepend(host);
      window.scrollTo(0, 0);
      flushSync(() => createRoot(host).render(React.createElement(apps[name])));
    };
    window.loaded = true;
  `;
  const code = await build(entries, { resolve: { alias: { react: pkgDir('react'), 'react-dom': pkgDir('react-dom') } }, define: { 'process.env.NODE_ENV': '"production"' } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.setContent('<!DOCTYPE html><html class="sl-theme-light"><body style="margin: 0; width: 800px"></body></html>');
  await page.addStyleTag({ content: readFileSync(path.join(velcroDir, 'themes/light.css'), 'utf8') });
  await page.addScriptTag({ type: 'module', content: code });
  await page.waitForFunction(() => window.loaded === true);
  const r = await page.evaluate(async names => {
    const out = {};
    for (const name of names) {
      window.renderExample(name);
      await Promise.all(['sl-carousel', 'sl-carousel-item'].map(t => customElements.whenDefined(t)));
      const carousel = document.querySelector(`#${name} sl-carousel`);
      await carousel.updateComplete;
      out[name] = [carousel.querySelectorAll('sl-carousel-item:not([data-clone])').length, carousel.loop, carousel.navigation, carousel.pagination, carousel.autoplay, carousel.mouseDragging, carousel.slidesPerPage, carousel.orientation];
    }
    // Adding and removing slides.
    const until = (predicate, ms = 5000) => new Promise((resolve, reject) => {
      const end = Date.now() + ms;
      const t = setInterval(() => { if (predicate()) { clearInterval(t); resolve(); } else if (Date.now() > end) { clearInterval(t); reject(new Error('timed out')); } }, 20);
    });
    const dynamic = document.querySelector('#dynamic');
    const count = () => dynamic.querySelectorAll('sl-carousel-item:not([data-clone])').length;
    const buttons = [...dynamic.querySelectorAll('sl-button')];
    const before = count();
    buttons[0].click();
    await until(() => count() === 4);
    const added = count();
    buttons[1].click();
    await until(() => count() === 3);
    buttons[1].click();
    await until(() => count() === 2);
    out.dynamicCounts = [before, added, count()];
    // The mouse dragging switch.
    const drag = document.querySelector('#mouse-dragging');
    const toggle = drag.querySelector('sl-switch');
    toggle.checked = true;
    toggle.dispatchEvent(new CustomEvent('sl-input', { bubbles: true, composed: true }));
    await until(() => drag.querySelector('sl-carousel').mouseDragging === true);
    out.dragOn = drag.querySelector('sl-carousel').mouseDragging;
    return { out, errors: window.errors };
  }, names);
  // As on Shoelace's page, the React version of the opening example has only pagination and mouse-dragging, and the vertical one has loop.
  expect(r.out.basic).toEqual([5, false, false, true, false, true, 1, 'horizontal']);
  expect(r.out.pagination).toEqual([5, false, false, true, false, false, 1, 'horizontal']);
  expect(r.out.navigation).toEqual([5, false, true, false, false, false, 1, 'horizontal']);
  expect(r.out.loop).toEqual([5, true, true, true, false, false, 1, 'horizontal']);
  expect(r.out.autoplay).toEqual([5, true, false, true, true, false, 1, 'horizontal']);
  expect(r.out['mouse-dragging']).toEqual([5, false, true, false, false, false, 1, 'horizontal']);
  expect(r.out['slides-per-page']).toEqual([6, false, true, true, false, false, 2, 'horizontal']);
  expect(r.out.dynamic).toEqual([3, false, true, true, false, false, 1, 'horizontal']);
  expect(r.out.vertical).toEqual([5, true, false, true, false, false, 1, 'vertical']);
  expect(r.out['aspect-ratio']).toEqual([5, false, true, true, false, false, 1, 'horizontal']);
  expect(r.out['scroll-hint']).toEqual([5, false, false, true, false, false, 1, 'horizontal']);
  expect(r.out.gallery).toEqual([5, true, true, false, false, false, 1, 'horizontal']);
  expect(r.out.dynamicCounts).toEqual([3, 4, 2]);
  expect(r.out.dragOn).toBe(true);
  // The gallery: a thumbnail click goes to the slide, and the slide change highlights the thumbnail. The test acts on the carousel only
  // once its intersection observer has reported the first slide (the second child, after the leading clone) in view, as for the opening
  // example of the docs page, and not on the scroll ending. That report is not held back by a go-to scroll that is pending: after a
  // click that lands before it, activeSlide goes 3, then 0 (the observer sees the carousel still at its start), then back to 3 when
  // the scroll ends, while the thumbnails show what React last rendered, so a snapshot taken at the wrong moment pairs the highlighted
  // thumbnail 3 with activeSlide 0 (seen on WebKit). After the click what is asserted is the state the carousel comes to rest in,
  // each property on its own line. The reads are polls because activeSlide follows the scroll's end by one observer report and the
  // thumbnail follows activeSlide by one render.
  const gallery = page.locator('#gallery sl-carousel');
  await expect.poll(() => gallery.evaluate(el => {
    const first = el.children[1];
    return first.classList.contains('--in-view') && first.getAttribute('aria-hidden') === 'false' && !first.hasAttribute('inert') && el.activeSlide === 0;
  })).toBe(true);
  await page.locator('#gallery .thumbnails__image').nth(3).evaluate(img => img.click());
  await settle(page, '#gallery sl-carousel', 4);
  const highlighted = () => page.locator('#gallery .thumbnails__image').evaluateAll(imgs => imgs.map(i => i.classList.contains('active')));
  await expect.poll(highlighted).toEqual([false, false, false, true, false]);
  await expect.poll(() => gallery.evaluate(el => el.activeSlide)).toBe(3);
  await expect.poll(() => gallery.evaluate(el => el.scrolling)).toBe(false);
  expect(r.errors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
