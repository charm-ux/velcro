import { expect, test } from '@playwright/test';

const PAGE = '/components/popup';
const TITLES = {
  overview: 'Popup example: Overview',
  external: 'Popup example: External Anchors',
  flip: 'Popup example: Flip',
  shift: 'Popup example: Shift',
  'auto-size': 'Popup example: Auto-size',
  'hover-bridge': 'Popup example: Hover Bridge',
  virtual: 'Popup example: Virtual Elements',
  activating: 'Popup example: Activating',
  placement: 'Popup example: Placement',
  distance: 'Popup example: Distance',
  skidding: 'Popup example: Skidding',
  arrows: 'Popup example: Arrows',
  sync: "Popup example: Syncing with the Anchor's Dimensions",
  strategy: 'Popup example: Positioning Strategy',
  'flip-fallbacks': 'Popup example: Flip Fallbacks',
};
const IDS = {
  overview: '#demo-default',
  external: '#demo-external',
  flip: '#demo-flip',
  shift: '#demo-shift',
  'auto-size': '#demo-auto-size',
  'hover-bridge': '#demo-hover-bridge',
  virtual: '#demo-virtual',
  activating: '#demo-activating',
  placement: '#demo-placement',
  distance: '#demo-distance',
  skidding: '#demo-skidding',
  arrows: '#demo-arrows',
  sync: '#demo-sync',
  strategy: '#demo-strategy',
  'flip-fallbacks': '#demo-flip-fallbacks',
};

async function openExample(page, which = 'overview') {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  // Litro's client router remounts the page component once after load, which reloads the iframes; wait for it to settle.
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  const frame = page.frameLocator(`iframe[title="${TITLES[which]}"]`);
  await expect(frame.locator(IDS[which])).toBeAttached();
  await frame.locator(IDS[which]).evaluate(() => customElements.whenDefined('sl-popup'));
  await page.waitForLoadState('networkidle');
  return { frame, requests };
}

// Runs `body` (the text of an async function body) inside the example document, with helpers in scope:
//   make(attrs, { anchor, content, anchorStyle, parent }) creates a 100x40 anchor (slotted unless `anchor` is 'external')
//     and an 80x20 box, connects an <sl-popup> with the given attributes and returns { el, anchor, box, events } once
//     positioned; `events` counts sl-reposition events;
//   settle() waits for the positioner (two animation frames after a microtask turn);
//   rect(node) returns { x, y, w, h } of a node's border box, rounded to 0.01px.
const run = (frame, body) =>
  frame.locator('body').evaluate(async (_, src) => {
    const raf = () => new Promise(resolve => requestAnimationFrame(() => resolve()));
    const settle = async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
      await raf();
      await raf();
    };
    const round = n => Math.round(n * 100) / 100;
    const rect = node => {
      const r = node.getBoundingClientRect();
      return { x: round(r.x), y: round(r.y), w: round(r.width), h: round(r.height) };
    };
    const make = async (attrs = {}, { anchor = 'slot', anchorStyle = '', parent = document.body } = {}) => {
      const el = document.createElement('sl-popup');
      for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
      const a = document.createElement('span');
      a.style.cssText = `display: inline-block; width: 100px; height: 40px; margin: 200px 0 0 300px; ${anchorStyle}`;
      const box = document.createElement('div');
      box.style.cssText = 'width: 80px; height: 20px; background: red;';
      if (anchor === 'slot') {
        a.slot = 'anchor';
        el.append(a);
      } else {
        a.id = `anchor-${Math.random().toString(36).slice(2)}`;
        parent.append(a);
        el.setAttribute('anchor', a.id);
      }
      el.append(box);
      const events = { count: 0 };
      el.addEventListener('sl-reposition', () => events.count++);
      parent.append(el);
      await el.updateComplete;
      await settle();
      return { el, anchor: a, box, events };
    };
    // eslint-disable-next-line no-new-func
    return new Function('make', 'settle', 'rect', `return (async () => { ${src} })()`)(make, settle, rect);
  }, body);

test('docs page is prerendered with Velcro branding, prototype status and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Popup - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('sl-reposition');
  expect(html).toContain('hover-bridge');
  expect(html).toContain('composed-offset-position');
  expect(html).toContain('without changing the shared core prefix');
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
  const home = await (await request.get('/')).text();
  expect(home).toContain('/components/popup');
});

test('sl-popup registers inside the example document (the docs page registers its own copy separately), as the exported class', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  expect(await page.evaluate(() => customElements.whenDefined('sl-popup').then(ctor => typeof ctor))).toBe('function');
  const info = await frame.locator('body').evaluate(() => {
    const ctor = customElements.get('sl-popup');
    return { defined: ctor !== undefined, baseName: ctor?.baseName, viaConstructor: ctor ? new ctor().localName : null };
  });
  expect(info).toEqual({ defined: true, baseName: 'popup', viaConstructor: 'sl-popup' });
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
});

test('structure: Shoelace\'s shadow markup, parts, host attributes and display: contents host', async ({ page }) => {
  const { frame } = await openExample(page);
  const info = await frame.locator('#demo-default').evaluate(async el => {
    const shape = () => ({
      children: [...el.shadowRoot.children].filter(n => n.localName !== 'style').map(n => `${n.localName}.${n.className.trim()}`),
      parts: [...el.shadowRoot.querySelectorAll('[part]')].map(n => n.getAttribute('part')),
      slots: [...el.shadowRoot.querySelectorAll('slot')].map(s => s.name),
    });
    const before = shape();
    el.arrow = true;
    await el.updateComplete;
    const arrow = el.shadowRoot.querySelector('[part="arrow"]');
    const withArrow = { ...shape(), arrow: arrow && { className: arrow.className, role: arrow.getAttribute('role'), parent: arrow.parentElement.className.trim() } };
    el.arrow = false;
    await el.updateComplete;
    return {
      before,
      withArrow,
      host: { display: getComputedStyle(el).display, boxes: el.getClientRects().length, role: el.getAttribute('role') },
      attrs: el.getAttributeNames().sort(),
      placement: el.getAttribute('data-current-placement'),
    };
  });
  expect(info.before).toEqual({
    children: ['slot.', 'span.popup-hover-bridge', 'div.popup popup--active'],
    parts: ['hover-bridge', 'popup'],
    slots: ['anchor', ''],
  });
  expect(info.withArrow.arrow).toEqual({ className: 'popup__arrow', role: 'presentation', parent: 'popup popup--active popup--has-arrow' });
  expect(info.host).toEqual({ display: 'contents', boxes: 0, role: null });
  // Only Shoelace's reflected attributes appear (active, placement and strategy, which reflect their defaults), plus the
  // positioner's output.
  expect(info.attrs).toEqual(['active', 'data-current-placement', 'id', 'placement', 'strategy']);
  expect(info.placement).toBe('top');
});

test('defaults match Shoelace', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(frame, `
    const el = document.createElement('sl-popup');
    const keys = ['anchor', 'active', 'placement', 'strategy', 'distance', 'skidding', 'arrow', 'arrowPlacement', 'arrowPadding', 'flip',
      'flipFallbackPlacements', 'flipFallbackStrategy', 'flipBoundary', 'flipPadding', 'shift', 'shiftBoundary', 'shiftPadding', 'autoSize',
      'sync', 'autoSizeBoundary', 'autoSizePadding', 'hoverBridge'];
    return Object.fromEntries(keys.map(k => [k, el[k] === undefined ? '<undefined>' : el[k]]));
  `);
  expect(r).toEqual({
    anchor: '<undefined>', active: false, placement: 'top', strategy: 'absolute', distance: 0, skidding: 0, arrow: false,
    arrowPlacement: 'anchor', arrowPadding: 10, flip: false, flipFallbackPlacements: '', flipFallbackStrategy: 'best-fit',
    flipBoundary: '<undefined>', flipPadding: 0, shift: false, shiftBoundary: '<undefined>', shiftPadding: 0, autoSize: '<undefined>',
    sync: '<undefined>', autoSizeBoundary: '<undefined>', autoSizePadding: 0, hoverBridge: false,
  });
});

test('overview example: the controls change placement, distance, skidding, active and arrow', async ({ page }) => {
  const { frame } = await openExample(page);
  const geometry = () => frame.locator('#demo-default').evaluate(el => {
    const a = el.querySelector('[slot="anchor"]').getBoundingClientRect();
    const p = el.popup.getBoundingClientRect();
    return { placement: el.getAttribute('data-current-placement'), gapTop: Math.round(a.top - p.bottom), gapBottom: Math.round(p.top - a.bottom),
      centerOffset: Math.round(p.left + p.width / 2 - (a.left + a.width / 2)), visible: p.width > 0 };
  });
  // The anchor is 150px plus a 2px border on each side.
  await expect.poll(geometry).toEqual({ placement: 'top', gapTop: 0, gapBottom: -204, centerOffset: 0, visible: true });
  await frame.locator('select[name="placement"]').selectOption('bottom');
  await frame.locator('input[name="distance"]').fill('12');
  await frame.locator('input[name="skidding"]').fill('7');
  await expect.poll(geometry).toEqual({ placement: 'bottom', gapTop: -216, gapBottom: 12, centerOffset: 7, visible: true });
  await frame.locator('sl-switch[name="arrow"]').click();
  await expect(frame.locator('#demo-default')).toHaveJSProperty('arrow', true);
  expect(await frame.locator('#demo-default').evaluate(el => !!el.shadowRoot.querySelector('[part="arrow"]'))).toBe(true);
  await frame.locator('sl-switch[name="active"]').click();
  await expect.poll(() => frame.locator('#demo-default').evaluate(el => ({
    active: el.hasAttribute('active'), display: getComputedStyle(el.popup).display, placement: el.getAttribute('data-current-placement') }))).toEqual({
    active: false, display: 'none', placement: null });
});

test('each of the twelve placements, with distance and skidding, positions like Floating UI does for Shoelace', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(frame, `
    const out = {};
    for (const placement of ['top', 'top-start', 'top-end', 'bottom', 'bottom-start', 'bottom-end', 'right', 'right-start', 'right-end', 'left', 'left-start', 'left-end']) {
      const { el, anchor, box } = await make({ active: '', placement, distance: '10', skidding: '5' });
      const a = rect(anchor);
      const p = rect(el.popup);
      out[placement] = { dx: p.x - a.x, dy: p.y - a.y, current: el.getAttribute('data-current-placement'), w: p.w, h: p.h };
      el.remove();
    }
    return out;
  `);
  // Anchor 100x40, popup 80x20. Skidding moves along the cross axis; distance moves away from the anchor.
  expect(r).toEqual({
    top: { dx: 15, dy: -30, current: 'top', w: 80, h: 20 },
    'top-start': { dx: 5, dy: -30, current: 'top-start', w: 80, h: 20 },
    'top-end': { dx: 25, dy: -30, current: 'top-end', w: 80, h: 20 },
    bottom: { dx: 15, dy: 50, current: 'bottom', w: 80, h: 20 },
    'bottom-start': { dx: 5, dy: 50, current: 'bottom-start', w: 80, h: 20 },
    'bottom-end': { dx: 25, dy: 50, current: 'bottom-end', w: 80, h: 20 },
    right: { dx: 110, dy: 15, current: 'right', w: 80, h: 20 },
    'right-start': { dx: 110, dy: 5, current: 'right-start', w: 80, h: 20 },
    'right-end': { dx: 110, dy: 25, current: 'right-end', w: 80, h: 20 },
    left: { dx: -90, dy: 15, current: 'left', w: 80, h: 20 },
    'left-start': { dx: -90, dy: 5, current: 'left-start', w: 80, h: 20 },
    'left-end': { dx: -90, dy: 25, current: 'left-end', w: 80, h: 20 },
  });
});

test('position is correct with the default 8px body margin and inside a positioned, scrolled container', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(frame, `
    const out = {};
    const body = await make({ active: '', placement: 'bottom' });
    out.body = { dx: rect(body.el.popup).x - rect(body.anchor).x, dy: rect(body.el.popup).y - rect(body.anchor).y };
    body.el.remove();
    const scroller = document.createElement('div');
    scroller.style.cssText = 'position: relative; height: 150px; overflow: auto; margin: 30px; border: 3px solid;';
    document.body.append(scroller);
    const inner = await make({ active: '', placement: 'right' }, { parent: scroller, anchorStyle: 'margin: 100px 0 200px 20px' });
    scroller.scrollTop = 40;
    await settle();
    out.scrolled = { dx: rect(inner.el.popup).x - rect(inner.anchor).x, dy: rect(inner.el.popup).y - rect(inner.anchor).y };
    const fixed = await make({ active: '', placement: 'left', strategy: 'fixed' }, { parent: scroller });
    out.fixed = { dx: rect(fixed.el.popup).x - rect(fixed.anchor).x, dy: rect(fixed.el.popup).y - rect(fixed.anchor).y,
      position: getComputedStyle(fixed.el.popup).position, className: fixed.el.popup.className.trim() };
    scroller.remove();
    return out;
  `);
  expect(r).toEqual({
    body: { dx: 10, dy: 40 },
    scrolled: { dx: 100, dy: 10 },
    fixed: { dx: -80, dy: 10, position: 'fixed', className: 'popup popup--active popup--fixed' },
  });
});

test('anchors: slot, id, element reference, a <slot> (its first assigned element) and a virtual element', async ({ page }) => {
  const { frame } = await openExample(page, 'external');
  const external = await frame.locator('#demo-external').evaluate(el => {
    const a = document.getElementById('external-anchor').getBoundingClientRect();
    const p = el.popup.getBoundingClientRect();
    return { gap: Math.round(a.top - p.bottom), center: Math.round(p.left + p.width / 2 - (a.left + a.width / 2)) };
  });
  expect(external).toEqual({ gap: 0, center: 0 });
  const r = await run(frame, `
    const out = {};
    const { el, anchor } = await make({ active: '', placement: 'bottom-start' }, { anchor: 'external' });
    const other = document.createElement('div');
    other.style.cssText = 'width: 30px; height: 30px; margin-left: 50px;';
    document.body.append(other);
    el.anchor = other;
    await el.updateComplete;
    await settle();
    out.element = { dx: rect(el.popup).x - rect(other).x, dy: rect(el.popup).y - rect(other).y };
    el.anchor = { getBoundingClientRect: () => new DOMRect(40, 60, 0, 0) };
    await el.updateComplete;
    await settle();
    out.virtual = { x: rect(el.popup).x, y: rect(el.popup).y };
    el.remove(); anchor.remove(); other.remove();

    // A <slot> anchor resolves to the first element assigned to it.
    const host = document.createElement('div');
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<sl-popup active placement="bottom-start"><slot slot="anchor"></slot><div style="width: 10px; height: 10px"></div></sl-popup>';
    host.innerHTML = '<b style="display: inline-block; width: 60px; height: 20px; margin-left: 70px">x</b>';
    document.body.append(host);
    const popup = root.querySelector('sl-popup');
    await popup.updateComplete;
    await settle();
    const b = host.querySelector('b');
    out.slot = { dx: rect(popup.popup).x - rect(b).x, dy: rect(popup.popup).y - rect(b).y };
    host.remove();
    return out;
  `);
  expect(r).toEqual({ element: { dx: 0, dy: 30 }, virtual: { x: 40, y: 60 }, slot: { dx: 0, dy: 20 } });
});

test('virtual element example: the popup follows the pointer while active', async ({ page }) => {
  const { frame } = await openExample(page, 'virtual');
  await frame.locator('sl-switch').click();
  await frame.locator('body').evaluate(() => document.addEventListener('mousemove', e => (window.__pointer = [e.clientX, e.clientY])));
  const iframe = await page.locator(`iframe[title="${TITLES.virtual}"]`).boundingBox();
  await page.mouse.move(iframe.x + 30, iframe.y + 40);
  await page.mouse.move(iframe.x + 60, iframe.y + 70, { steps: 3 });
  await expect.poll(() => frame.locator('#demo-virtual').evaluate(el => {
    const p = el.popup.getBoundingClientRect();
    return { at: [p.x, p.y].join() === window.__pointer.join(), placement: el.getAttribute('data-current-placement') };
  })).toEqual({ at: true, placement: 'right-start' });
});

test('arrow: each arrow-placement, the static side, padding, and RTL start and end from the dir attribute or property', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(frame, `
    const out = {};
    for (const [label, attrs] of [
      ['top anchor', { placement: 'top' }],
      ['top start', { placement: 'top', 'arrow-placement': 'start', 'arrow-padding': '4' }],
      ['top end', { placement: 'top', 'arrow-placement': 'end' }],
      ['top center', { placement: 'top', 'arrow-placement': 'center' }],
      ['right anchor', { placement: 'right' }],
      ['rtl start', { placement: 'top', 'arrow-placement': 'start', dir: 'rtl' }],
      ['rtl end', { placement: 'top', 'arrow-placement': 'end', dir: 'rtl' }],
      ['rtl property start', { placement: 'top', 'arrow-placement': 'start' }],
    ]) {
      const { el } = await make({ active: '', arrow: '', ...attrs });
      if (label === 'rtl property start') {
        el.dir = 'rtl'; // the property only: no attribute, so the element's CSS direction stays ltr
        await el.updateComplete;
        el.reposition();
        await settle();
      }
      const s = el.shadowRoot.querySelector('.popup__arrow').style;
      out[label] = { top: s.top, right: s.right, bottom: s.bottom, left: s.left };
      el.remove();
    }
    return out;
  `);
  const side = 'calc(var(--arrow-size-diagonal) * -1)';
  // The arrow box is 2 * 6px * 0.7071 = 8.485px wide, centered on the anchor's center: 40 - 4.243 and 10 - 4.243. The
  // engine stores these lengths rounded to its layout unit, so they are compared numerically.
  const arrowBox = 2 * 6 * 0.7071;
  expect(parseFloat(r['top anchor'].left)).toBeCloseTo(40 - arrowBox / 2, 1);
  expect(parseFloat(r['right anchor'].top)).toBeCloseTo(10 - arrowBox / 2, 1);
  expect(r['top anchor'].left).toMatch(/^[\d.]+px$/);
  expect(r['right anchor'].top).toMatch(/^[\d.]+px$/);
  r['top anchor'].left = r['right anchor'].top = '<anchor-centered>';
  expect(r).toEqual({
    'top anchor': { top: '', right: '', bottom: side, left: '<anchor-centered>' },
    'top start': { top: '', right: '', bottom: side, left: 'calc(4px - var(--arrow-padding-offset))' },
    'top end': { top: '', right: 'calc(10px - var(--arrow-padding-offset))', bottom: side, left: '' },
    'top center': { top: '', right: '', bottom: side, left: 'calc(50% - var(--arrow-size-diagonal))' },
    'right anchor': { top: '<anchor-centered>', right: '', bottom: '', left: side },
    'rtl start': { top: '', right: 'calc(10px - var(--arrow-padding-offset))', bottom: side, left: '' },
    'rtl end': { top: '', right: '', bottom: side, left: 'calc(10px - var(--arrow-padding-offset))' },
    'rtl property start': { top: '', right: 'calc(10px - var(--arrow-padding-offset))', bottom: side, left: '' },
  });
});

test('sync matches the anchor\'s width, height or both, and clears when removed', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(frame, `
    const { el } = await make({ active: '', sync: 'width' });
    const out = { width: { w: rect(el.popup).w, h: rect(el.popup).h } };
    for (const sync of ['height', 'both']) {
      el.sync = sync;
      await el.updateComplete; await settle();
      out[sync] = { w: rect(el.popup).w, h: rect(el.popup).h };
    }
    el.sync = undefined;
    await el.updateComplete; await settle();
    out.none = { w: rect(el.popup).w, h: rect(el.popup).h, style: el.popup.style.width + '|' + el.popup.style.height };
    el.remove();
    return out;
  `);
  expect(r).toEqual({ width: { w: 100, h: 20 }, height: { w: 80, h: 40 }, both: { w: 100, h: 40 }, none: { w: 80, h: 20, style: '|' } });
});

test('flip example: the popup flips to the bottom when the top is clipped, and stays when flip is off', async ({ page }) => {
  const { frame } = await openExample(page, 'flip');
  const placement = () => frame.locator('#demo-flip').getAttribute('data-current-placement');
  await expect.poll(placement).toBe('top');
  await frame.locator('.popup-flip .overflow').evaluate(el => (el.scrollTop = 120));
  await expect.poll(placement).toBe('bottom');
  await frame.locator('sl-switch').click();
  await expect.poll(placement).toBe('top');
});

test('flip fallback placements and strategy', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(frame, `
    const scroller = document.createElement('div');
    scroller.style.cssText = 'position: relative; width: 400px; height: 60px; overflow: hidden;';
    document.body.append(scroller);
    const out = {};
    for (const [label, attrs] of [
      ['opposite', {}],
      ['fallbacks', { 'flip-fallback-placements': 'bottom right left' }],
      ['initial', { 'flip-fallback-placements': 'bottom', 'flip-fallback-strategy': 'initial' }],
    ]) {
      const { el } = await make({ active: '', flip: '', placement: 'top', ...attrs }, { parent: scroller, anchorStyle: 'margin: 10px 0 0 150px' });
      out[label] = { current: el.getAttribute('data-current-placement'), fallbacks: el.flipFallbackPlacements };
      el.remove();
    }
    scroller.remove();
    return out;
  `);
  // Neither top nor bottom fits in the 60px-high clip; 'best-fit' picks the first fallback that fits (right), 'initial' keeps top.
  expect(r).toEqual({
    opposite: { current: 'top', fallbacks: '' },
    fallbacks: { current: 'right', fallbacks: ['bottom', 'right', 'left'] },
    initial: { current: 'top', fallbacks: ['bottom'] },
  });
});

test('shift example: the popup is shifted inside the container by shift-padding, and overflows when shift is off', async ({ page }) => {
  const { frame } = await openExample(page, 'shift');
  const offset = () => frame.locator('#demo-shift').evaluate(el => Math.round(el.popup.getBoundingClientRect().left - el.closest('.overflow').getBoundingClientRect().left));
  // Container border 2px + shift-padding 10px.
  await expect.poll(offset).toBe(12);
  await frame.locator('sl-switch').click();
  // Anchor at 2 + 10, 150 wide plus a 2px border each side; the 300px popup is centered on it.
  await expect.poll(offset).toBe(2 + 10 + 77 - 150);
});

test('auto-size example: sets the available-size custom properties on the host, and removes them when turned off', async ({ page }) => {
  const { frame } = await openExample(page, 'auto-size');
  const vars = () => frame.locator('#demo-auto-size').evaluate(el => ({
    w: el.style.getPropertyValue('--auto-size-available-width'), h: el.style.getPropertyValue('--auto-size-available-height'),
    boxH: Math.round(el.querySelector('.box').getBoundingClientRect().height) }));
  // Unscrolled, 250px (the anchor's top margin) less 10px padding is available above the anchor.
  await expect.poll(async () => (await vars()).h).toBe('240px');
  // Scrolled by 100px, less than the box's 200px is available, and the box shrinks to it.
  await frame.locator('.popup-auto-size .overflow').evaluate(el => (el.scrollTop = 100));
  await expect.poll(async () => (await vars()).h).toBe('140px');
  const before = await vars();
  expect(before.w).toMatch(/^\d+(\.\d+)?px$/);
  expect(before.boxH).toBe(140);
  await frame.locator('sl-switch').click();
  await expect.poll(vars).toEqual({ w: '', h: '', boxH: 200 });

  const r = await run(frame, `
    const { el } = await make({ active: '', 'auto-size': 'vertical' });
    const out = { vertical: [el.style.getPropertyValue('--auto-size-available-width'), el.style.getPropertyValue('--auto-size-available-height') !== ''] };
    el.active = false;
    await el.updateComplete; await settle();
    out.inactive = [el.style.getPropertyValue('--auto-size-available-height'), el.getAttribute('data-current-placement')];
    el.remove();
    return out;
  `);
  expect(r).toEqual({ vertical: ['', true], inactive: ['', null] });
});

test('hover bridge example: drawn only while active, and its corners span the gap', async ({ page }) => {
  const { frame } = await openExample(page, 'hover-bridge');
  const bridge = () => frame.locator('#demo-hover-bridge').evaluate(el => {
    const css = n => el.style.getPropertyValue(`--hover-bridge-${n}`);
    const a = el.querySelector('[slot="anchor"]').getBoundingClientRect();
    const p = el.popup.getBoundingClientRect();
    const span = el.shadowRoot.querySelector('[part="hover-bridge"]');
    return { visible: span.classList.contains('popup-hover-bridge--visible'), position: getComputedStyle(span).position,
      topLeftY: css('top-left-y') === `${p.bottom}px`, bottomLeftY: css('bottom-left-y') === `${a.top}px` };
  });
  await expect.poll(bridge).toEqual({ visible: true, position: 'fixed', topLeftY: true, bottomLeftY: true });
  await frame.locator('sl-switch[name="hover-bridge"]').click();
  await expect.poll(async () => (await bridge()).visible).toBe(false);
});

test('sl-reposition bubbles and is composed, and (upstream quirk) fires before the new position is applied', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(frame, `
    const { el, events } = await make({ active: '', placement: 'top' });
    const seen = [];
    document.addEventListener('sl-reposition', e => seen.push({ bubbles: e.bubbles, composed: e.composed, cancelable: e.cancelable,
      target: e.target === el, top: el.popup.style.top, placement: el.getAttribute('data-current-placement') }), { once: true });
    const before = el.popup.style.top;
    const count = events.count;
    el.placement = 'bottom';
    await el.updateComplete; await settle();
    const out = { seen: seen[0], before, after: el.popup.style.top, fired: events.count > count, first: count > 0 };
    el.remove();
    return out;
  `);
  expect(r.first).toBe(true);
  expect(r.fired).toBe(true);
  expect(r.seen).toEqual({ bubbles: true, composed: true, cancelable: false, target: true, top: r.before, placement: 'top' });
  expect(r.after).not.toBe(r.before);
});

test('reposition() is public, returns nothing, and does nothing while inactive or without an anchor', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(frame, `
    const { el, events } = await make({ placement: 'top' });
    const inactive = [el.reposition(), events.count];
    el.active = true;
    await el.updateComplete; await settle();
    const count = events.count;
    const active = [el.reposition() === undefined, events.count === count + 1];
    const lone = document.createElement('sl-popup');
    lone.active = true;
    document.body.append(lone);
    await lone.updateComplete;
    let loneEvents = 0;
    lone.addEventListener('sl-reposition', () => loneEvents++);
    lone.reposition();
    el.remove(); lone.remove();
    return { inactive, active, loneEvents };
  `);
  expect(r).toEqual({ inactive: [undefined, 0], active: [true, true], loneEvents: 0 });
});

test('upstream quirk: removing placement or strategy restores the value recorded at the first observed attribute change', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(frame, `
    const el = document.createElement('sl-popup');
    el.placement = 'left'; // assigned before the first update, which reflects it: that first attribute change records 'left'
    document.body.append(el);
    await el.updateComplete;
    el.setAttribute('placement', 'right');
    await el.updateComplete;
    el.removeAttribute('placement');
    await el.updateComplete;
    const placement = [el.placement, el.getAttribute('placement')];
    el.removeAttribute('strategy');
    el.setAttribute('strategy', 'fixed');
    await el.updateComplete;
    el.removeAttribute('strategy');
    await el.updateComplete;
    const strategy = [el.strategy, el.getAttribute('strategy')];
    el.setAttribute('active', '');
    await el.updateComplete;
    el.removeAttribute('active');
    await el.updateComplete;
    const active = [el.active, el.hasAttribute('active')];
    el.remove();
    return { placement, strategy, active };
  `);
  expect(r).toEqual({ placement: ['left', 'left'], strategy: ['absolute', 'absolute'], active: [false, false] });
});

test('deactivating and disconnecting stop the positioner; reconnecting an active popup starts it again', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(frame, `
    const { el, anchor, events } = await make({ active: '', placement: 'top' }, { anchor: 'external' });
    const out = {};
    const grow = async () => { anchor.style.width = (parseFloat(anchor.style.width || 100) + 10) + 'px'; await settle(); await settle(); };
    let c = events.count; await grow(); out.active = events.count > c;
    el.active = false; await el.updateComplete; await settle();
    c = events.count; await grow(); out.inactive = events.count - c;
    el.active = true; await el.updateComplete; await settle();
    el.remove(); await settle();
    c = events.count; await grow(); out.removed = events.count - c;
    document.body.append(el); await el.updateComplete; await settle();
    c = events.count; await grow(); out.reconnected = events.count > c;
    el.remove(); anchor.remove();
    return out;
  `);
  expect(r).toEqual({ active: true, inactive: 0, removed: 0, reconnected: true });
});

test("core's dismissible behaviour is absent: Escape and window scroll leave an active popup alone", async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(frame, `
    const { el, anchor } = await make({ active: '', placement: 'top' }, { anchor: 'external' });
    let escapedTo = null;
    document.addEventListener('keydown', e => (escapedTo = e.key), { once: true });
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    window.dispatchEvent(new Event('scroll'));
    await el.updateComplete; await settle();
    const out = { escapedTo, active: el.active, open: 'open' in el, display: getComputedStyle(el.popup).display };
    el.remove(); anchor.remove();
    return out;
  `);
  expect(r).toEqual({ escapedTo: 'Escape', active: true, open: false, display: 'block' });
});

test('upstream quirk: the arrow uses --sl-color-neutral-1000 by default, not the documented neutral-0; --arrow-color overrides it', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(frame, `
    const { el } = await make({ active: '', arrow: '' });
    const probe = (value) => { const d = document.createElement('div'); d.style.background = value; document.body.append(d);
      const c = getComputedStyle(d).backgroundColor; d.remove(); return c; };
    const arrow = el.shadowRoot.querySelector('[part="arrow"]');
    const out = { arrow: getComputedStyle(arrow).backgroundColor, neutral1000: probe('var(--sl-color-neutral-1000)'), neutral0: probe('var(--sl-color-neutral-0)') };
    el.style.setProperty('--arrow-color', 'rgb(1, 2, 3)');
    out.custom = getComputedStyle(arrow).backgroundColor;
    el.remove();
    return out;
  `);
  expect(r.arrow).toBe(r.neutral1000);
  expect(r.arrow).not.toBe(r.neutral0);
  expect(r.custom).toBe('rgb(1, 2, 3)');
});

test('upstream quirk: flipFallbackPlacements assigned as a string property is not split into placements', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(frame, `
    const scroller = document.createElement('div');
    scroller.style.cssText = 'position: relative; width: 400px; height: 60px; overflow: hidden;';
    document.body.append(scroller);
    const out = {};
    for (const how of ['attribute', 'property']) {
      const el = document.createElement('sl-popup');
      if (how === 'attribute') el.setAttribute('flip-fallback-placements', 'right');
      else el.flipFallbackPlacements = 'right';
      for (const [k, v] of Object.entries({ active: '', flip: '', placement: 'top' })) el.setAttribute(k, v);
      el.innerHTML = '<span slot="anchor" style="display: inline-block; width: 100px; height: 40px; margin: 10px 0 0 150px"></span><div style="width: 80px; height: 20px"></div>';
      scroller.append(el);
      await el.updateComplete;
      await new Promise(r => setTimeout(r, 50));
      out[how] = { value: el.flipFallbackPlacements, current: el.getAttribute('data-current-placement') };
      el.remove();
    }
    scroller.remove();
    return out;
  `);
  expect(r.attribute).toEqual({ value: ['right'], current: 'right' });
  expect(r.property.value).toBe('right');
  expect(r.property.current).not.toBe('right');
});

test('dir and lang are Shoelace\'s plain reactive properties: undefined by default, set from the attribute, never reflected', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(frame, `
    const el = document.createElement('sl-popup');
    document.body.append(el);
    await el.updateComplete;
    const out = { initial: [el.dir, el.lang] };
    el.dir = 'rtl';
    el.lang = 'de';
    await el.updateComplete;
    out.setByProperty = [el.dir, el.lang, el.hasAttribute('dir'), el.hasAttribute('lang'), getComputedStyle(el).direction];
    el.setAttribute('dir', 'ltr');
    el.setAttribute('lang', 'fr');
    out.setByAttribute = [el.dir, el.lang];
    el.remove();
    return out;
  `);
  expect(r).toEqual({ initial: [undefined, undefined], setByProperty: ['rtl', 'de', false, false, 'ltr'], setByAttribute: ['ltr', 'fr'] });
});

test('absolute strategy: a popup slotted into a shadow tree is positioned against the positioned element around the slot', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(frame, `
    const host = document.createElement('div');
    host.attachShadow({ mode: 'open' }).innerHTML = '<div style="position: relative; margin: 30px 0 0 50px; padding: 7px"><slot></slot></div>';
    document.body.append(host);
    const out = {};
    for (const strategy of ['absolute', 'fixed']) {
      const { el, anchor } = await make({ active: '', placement: 'bottom', strategy }, { parent: host });
      out[strategy] = { dx: rect(el.popup).x - rect(anchor).x, dy: rect(el.popup).y - rect(anchor).y };
      // Outside a computation the popup's offsetParent is the native (retargeted) one.
      out[strategy].nativeOutside = el.popup.offsetParent === Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent').get.call(el.popup);
      el.remove();
    }
    // Arrow middleware: the arrow is measured against the same offset parent.
    const { el, anchor } = await make({ active: '', placement: 'bottom', arrow: '', distance: '8' }, { parent: host });
    const arrow = el.shadowRoot.querySelector('[part="arrow"]').getBoundingClientRect();
    const a = anchor.getBoundingClientRect();
    out.arrowCenterOffset = Math.abs(Math.round(arrow.x + arrow.width / 2 - (a.x + a.width / 2)));
    host.remove();
    return out;
  `);
  // Centered under the 100x40 anchor: the 80px box is 10px in, and directly below it.
  expect(r).toEqual({ absolute: { dx: 10, dy: 40, nativeOutside: true }, fixed: { dx: 10, dy: 40, nativeOutside: true }, arrowCenterOffset: 0 });
});

test('an sl-reposition listener that changes the direction affects the next computation, not the current one (as in Shoelace)', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(frame, `
    const { el, anchor } = await make({ active: '', placement: 'top-start' });
    const left = () => Math.round(el.popup.getBoundingClientRect().left - anchor.getBoundingClientRect().left);
    const out = { ltr: left() };
    el.addEventListener('sl-reposition', () => (el.style.direction = 'rtl'), { once: true });
    el.reposition();
    await settle();
    out.listenerChangedDirection = left();
    el.reposition();
    await settle();
    out.next = left();
    el.remove();
    return out;
  `);
  // top-start aligns the 80px box with the anchor's start edge: left in ltr, right (100 - 80) in rtl.
  expect(r).toEqual({ ltr: 0, listenerChangedDirection: 0, next: 20 });
});

test('upstream quirk: active set to false and back to true before an update starts a second auto-update', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(frame, `
    const normal = await make({ active: '' });
    const toggled = await make({ active: '' });
    toggled.el.active = false;
    toggled.el.active = true;
    await toggled.el.updateComplete;
    await settle();
    const scroll = () => {
      const before = [normal.events.count, toggled.events.count];
      window.dispatchEvent(new Event('scroll'));
      return [normal.events.count - before[0], toggled.events.count - before[1]];
    };
    const out = { bothActive: scroll() };
    toggled.el.active = false;
    await toggled.el.updateComplete;
    await settle();
    out.toggledInactive = scroll();
    normal.el.remove();
    toggled.el.remove();
    return out;
  `);
  // Each auto-update repositions on a window scroll; the inactive popup's leaked one returns early, without an event.
  expect(r).toEqual({ bothActive: [1, 2], toggledInactive: [1, 0] });
});

test('ported examples: activating, placement, distance, skidding, arrows, sync, strategy and flip fallbacks', async ({ page }) => {
  const geometry = (frame, id) => frame.locator(id).evaluate(el => {
    const a = el.querySelector('[slot="anchor"]').getBoundingClientRect();
    const p = el.popup.getBoundingClientRect();
    return { placement: el.getAttribute('data-current-placement'), gapTop: Math.round(a.top - p.bottom),
      centerX: Math.round(p.left + p.width / 2 - (a.left + a.width / 2)), w: Math.round(p.width), h: Math.round(p.height),
      display: getComputedStyle(el.popup).display };
  });

  let { frame } = await openExample(page, 'activating');
  await expect.poll(() => geometry(frame, IDS.activating)).toMatchObject({ placement: 'top', gapTop: 0, display: 'block' });
  await frame.locator('sl-switch').click();
  await expect.poll(() => geometry(frame, IDS.activating)).toMatchObject({ placement: null, display: 'none' });

  ({ frame } = await openExample(page, 'placement'));
  await frame.locator('select').selectOption('left-end');
  await expect.poll(() => geometry(frame, IDS.placement)).toMatchObject({ placement: 'left-end' });

  ({ frame } = await openExample(page, 'distance'));
  await frame.locator('input[type="range"]').fill('20');
  await expect.poll(() => geometry(frame, IDS.distance)).toMatchObject({ placement: 'top', gapTop: 20, centerX: 0 });

  ({ frame } = await openExample(page, 'skidding'));
  await frame.locator('input[type="range"]').fill('-30');
  await expect.poll(() => geometry(frame, IDS.skidding)).toMatchObject({ placement: 'top', gapTop: 0, centerX: -30 });

  ({ frame } = await openExample(page, 'arrows'));
  const arrowState = () => frame.locator(IDS.arrows).evaluate(el => {
    const arrow = el.shadowRoot.querySelector('[part="arrow"]');
    return { placement: el.getAttribute('data-current-placement'), arrowPlacement: el.arrowPlacement, arrow: !!arrow,
      color: arrow && getComputedStyle(arrow).backgroundColor === getComputedStyle(el.querySelector('.box')).backgroundColor };
  });
  await expect.poll(arrowState).toEqual({ placement: 'top', arrowPlacement: 'anchor', arrow: true, color: true });
  await frame.locator('select[name="placement"]').selectOption('bottom-start');
  await frame.locator('select[name="arrow-placement"]').selectOption('end');
  await expect.poll(arrowState).toEqual({ placement: 'bottom-start', arrowPlacement: 'end', arrow: true, color: true });
  await frame.locator('sl-switch[name="arrow"]').click();
  await expect.poll(arrowState).toEqual({ placement: 'bottom-start', arrowPlacement: 'end', arrow: false, color: null });

  ({ frame } = await openExample(page, 'sync'));
  // The anchor is 150px plus a 2px border on each side.
  await expect.poll(() => geometry(frame, IDS.sync)).toMatchObject({ w: 154, h: 50 });
  await frame.locator('select').selectOption('both');
  await expect.poll(() => geometry(frame, IDS.sync)).toMatchObject({ w: 154, h: 154 });
  await frame.locator('select').selectOption('');
  await expect.poll(() => geometry(frame, IDS.sync)).toMatchObject({ w: 50, h: 50 });

  ({ frame } = await openExample(page, 'strategy'));
  const strategy = () => frame.locator(IDS.strategy).evaluate(el => {
    const container = el.closest('.overflow').getBoundingClientRect();
    const p = el.popup.getBoundingClientRect();
    const hit = document.elementFromPoint(p.left + p.width / 2, p.top + p.height / 2);
    return { strategy: el.strategy, position: getComputedStyle(el.popup).position, aboveContainer: p.top < container.top,
      visible: hit === el.querySelector('.box') };
  });
  // Scrolled so that the anchor's top is near the container's top: the popup is above the container, where only the fixed
  // one is visible; the absolute one is clipped by the container.
  await frame.locator('.popup-strategy .overflow').evaluate(el => (el.scrollTop = 130));
  await expect.poll(strategy).toEqual({ strategy: 'fixed', position: 'fixed', aboveContainer: true, visible: true });
  await frame.locator('sl-switch').click();
  await expect.poll(strategy).toEqual({ strategy: 'absolute', position: 'absolute', aboveContainer: true, visible: false });

  ({ frame } = await openExample(page, 'flip-fallbacks'));
  const placement = () => frame.locator(IDS['flip-fallbacks']).getAttribute('data-current-placement');
  await expect.poll(placement).toBe('top');
  await frame.locator('.popup-flip-fallbacks .overflow').evaluate(el => (el.scrollTop = 220));
  await expect.poll(placement).toBe('right');
});
