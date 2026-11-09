import { expect, test } from '@playwright/test';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/split-panel';
const PANELS = '<div slot="start" style="height: 100%">a</div><div slot="end" style="height: 100%">b</div>';

async function openExample(page, name = 'Overview') {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  const frame = page.frameLocator(`iframe.example[title="Split Panel example: ${name}"]`);
  await expect(frame.locator('sl-split-panel').first()).toBeVisible();
  await frame.locator('body').evaluate(() => customElements.whenDefined('sl-split-panel'));
  // Rendering only: a test that reads the requests waits for the network to go quiet itself (documentsLoaded).
  return { frame, requests };
}

// Appends a split panel with a fixed size to the example document (as the first thing in the body, so it is easy to scroll to)
// and returns its locator; mounting again with the same id replaces it. `attrs` are set as attributes; the host is 400px wide and 120px high unless `style` says otherwise.
async function mount(frame, attrs = {}, { style = 'width: 400px; height: 120px;', content = PANELS, id = 'probe' } = {}) {
  await frame.locator('body').evaluate(async (body, { attrs, style, content, id }) => {
    body.querySelector(`#${id}`)?.remove();
    const el = document.createElement('sl-split-panel');
    el.id = id;
    el.style.cssText = style;
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    el.innerHTML = content;
    body.prepend(el);
    await el.updateComplete;
    // Let the first ResizeObserver report settle.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, { attrs, style, content, id });
  return frame.locator(`#${id}`);
}

const state = host => host.evaluate(el => {
  // The panel slots are display: contents, so the slotted elements are the boxes in the grid.
  const start = el.querySelector('[slot="start"]').getBoundingClientRect();
  const end = el.querySelector('[slot="end"]').getBoundingClientRect();
  const divider = el.shadowRoot.querySelector('.divider').getBoundingClientRect();
  return { position: el.position, positionInPixels: el.positionInPixels, start: [start.left, start.top, start.width, start.height], divider: [divider.left, divider.top, divider.width, divider.height], end: [end.left, end.top, end.width, end.height] };
});

// A real mouse drag along the host's main axis, from `from` to `to` pixels measured from the host's start edge.
async function drag(page, host, from, to, { vertical = false, steps = 6, release = true } = {}) {
  await host.scrollIntoViewIfNeeded();
  const box = await host.boundingBox();
  const at = v => (vertical ? { x: box.x + box.width / 2, y: box.y + v } : { x: box.x + v, y: box.y + box.height / 2 });
  const a = at(from);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  const b = at(to);
  await page.mouse.move(b.x, b.y, { steps });
  if (release) await page.mouse.up();
  await host.evaluate(el => el.updateComplete);
}

const position = host => host.evaluate(el => el.position);
// Values that come from the pointer's coordinates can be off by a fraction in engines that round page coordinates (WebKit does),
// so they are compared to within half a unit. Values the component snaps or clamps are compared exactly.
const near = (actual, expected) => expect(actual).toBeCloseTo(expected, 0);

test('docs page is prerendered with Velcro branding, prototype status, quirks and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Split Panel - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('sl-reposition');
  expect(html).toContain('position-in-pixels');
  expect(html).toContain('without changing the shared core prefix');
  expect(html).toContain('Redimensionner');
  expect(html).toContain('registered by importing @charm-ux/velcro/translations/');
  expect(html).not.toContain('not public package exports yet');
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
  const home = await (await request.get('/')).text();
  expect(home).toContain('/components/split-panel');
});

test('sl-split-panel registers inside the example document, and separately in the docs page through the client entry', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  await documentsLoaded(page);
  expect(await page.evaluate(() => customElements.whenDefined('sl-split-panel').then(ctor => typeof ctor))).toBe('function');
  expect(await frame.locator('body').evaluate(() => customElements.get('sl-split-panel') !== undefined)).toBe(true);
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
});

test('every ported example renders two panels and a divider, each with the documented attributes', async ({ page }) => {
  await openDocs(page, PAGE);
  const titles = await page.locator('iframe.example').evaluateAll(frames => frames.map(f => f.title));
  expect(titles).toHaveLength(13);
  const attrs = {};
  for (const title of titles) {
    const frame = page.frameLocator(`iframe.example[title="${title}"]`);
    const panels = frame.locator('sl-split-panel');
    await expect(panels.first(), title).toBeVisible();
    attrs[title] = await panels.evaluateAll(async els => {
      await Promise.all(els.map(el => el.updateComplete));
      return els.map(el => ({
        attrs: Object.fromEntries(['position', 'position-in-pixels', 'vertical', 'snap', 'disabled'].filter(a => el.hasAttribute(a)).map(a => [a, el.getAttribute(a)])),
        divider: !!el.shadowRoot.querySelector('[part~="divider"][role="separator"]'),
        // Both panels are slotted with content that has a size.
        sized: [...el.children].filter(c => c.slot === 'start' || c.slot === 'end').every(c => c.getBoundingClientRect().width > 0 && c.getBoundingClientRect().height > 0),
      }));
    });
  }
  expect(attrs['Split Panel example: Overview']).toEqual([{ attrs: { position: '50', snap: '' }, divider: true, sized: true }]);
  expect(attrs['Split Panel example: Initial Position'][0].attrs.position).toBe('75');
  expect(attrs['Split Panel example: Initial Position in Pixels'][0].attrs['position-in-pixels']).toBe('150');
  expect(attrs['Split Panel example: Vertical'][0].attrs.vertical).toBe('');
  expect(attrs['Split Panel example: Snapping'][0].attrs.snap).toBe('100px 50%');
  expect(attrs['Split Panel example: Snapping to repeated intervals'][0].attrs.snap).toBe('repeat(100px) 50%');
  expect(attrs['Split Panel example: Disabled'][0].attrs.disabled).toBe('');
  expect(attrs['Split Panel example: Nested Split Panels']).toHaveLength(2);
  for (const list of Object.values(attrs)) for (const item of list) expect(item).toMatchObject({ divider: true, sized: true });
});

test('shadow structure, parts, slots, divider semantics and default state', async ({ page }) => {
  const { frame } = await openExample(page);
  const host = await mount(frame);
  const info = await host.evaluate(el => {
    const root = el.shadowRoot;
    const divider = root.querySelector('.divider');
    return {
      parts: [...root.querySelectorAll('[part]')].map(n => `${n.localName}.${n.className}[${n.getAttribute('part')}]`),
      slots: [...root.querySelectorAll('slot')].map(s => s.name),
      divider: { role: divider.getAttribute('role'), tabindex: divider.getAttribute('tabindex'), now: divider.getAttribute('aria-valuenow'), min: divider.getAttribute('aria-valuemin'), max: divider.getAttribute('aria-valuemax'), label: divider.getAttribute('aria-label') },
      hostAttrs: el.getAttributeNames().filter(n => n !== 'style' && n !== 'id').sort(),
      hostRole: el.getAttribute('role'),
      hostTabIndex: el.tabIndex,
      props: { position: el.position, vertical: el.vertical, disabled: el.disabled, primary: el.primary, snap: el.snap, snapThreshold: el.snapThreshold, positionInPixels: el.positionInPixels, lang: el.lang },
      divRef: el.divider === divider,
      display: getComputedStyle(el).display,
    };
  });
  expect(info).toEqual({
    parts: ['slot.start[panel start]', 'div.divider[divider]', 'slot.end[panel end]'],
    slots: ['start', 'divider', 'end'],
    divider: { role: 'separator', tabindex: '0', now: '50', min: '0', max: '100', label: 'Resize' },
    hostAttrs: ['position', 'snap'],
    hostRole: null,
    hostTabIndex: -1,
    props: { position: 50, vertical: false, disabled: false, primary: undefined, snap: '', snapThreshold: 12, positionInPixels: 200, lang: undefined },
    divRef: true,
    display: 'grid',
  });
  const s = await state(host);
  // 400px wide: the start panel is 50% minus half the 4px divider, the divider is 4px, the end panel takes the rest.
  expect(s.start[2]).toBe(198);
  expect(s.divider[2]).toBe(4);
  expect(s.end[2]).toBe(198);
  expect(s.start[3]).toBe(120);
});

test('the divider is a named separator with value semantics and is the split panel\'s only tab stop', async ({ page }) => {
  const { frame } = await openExample(page);
  const host = await mount(frame);
  const separator = frame.getByRole('separator', { name: 'Resize' });
  await expect(separator.first()).toBeVisible();
  await expect(separator.first()).toHaveAttribute('aria-valuenow', '50');
  await host.locator('.divider').focus();
  expect(await host.evaluate(el => el.shadowRoot.activeElement?.className)).toBe('divider');
  await page.keyboard.press('Tab');
  expect(await host.evaluate(el => el.shadowRoot.activeElement)).toBeNull();
  await page.keyboard.press('Shift+Tab');
  expect(await host.evaluate(el => el.shadowRoot.activeElement?.className)).toBe('divider');
});

test('properties: defaults, attribute reflection, types, and restore of the initial value when a reflected attribute is removed', async ({ page }) => {
  const { frame } = await openExample(page);
  const host = await mount(frame);
  const r = await host.evaluate(async el => {
    const out = {};
    const settle = () => el.updateComplete;
    out.observed = [...customElements.get('sl-split-panel').observedAttributes].sort();
    el.setAttribute('position', '25');
    await settle();
    out.attrPosition = [el.position, typeof el.position, el.positionInPixels];
    el.position = 40;
    await settle();
    out.propPosition = [el.getAttribute('position'), el.positionInPixels];
    el.removeAttribute('position');
    await settle();
    out.removedPosition = [el.position, el.getAttribute('position')];
    el.setAttribute('vertical', '');
    el.setAttribute('disabled', '');
    await settle();
    out.booleans = [el.vertical, el.disabled];
    el.removeAttribute('vertical');
    el.removeAttribute('disabled');
    await settle();
    out.removedBooleans = [el.vertical, el.disabled, el.hasAttribute('vertical'), el.hasAttribute('disabled')];
    el.vertical = true;
    el.disabled = true;
    await settle();
    out.reflectedBooleans = [el.getAttribute('vertical'), el.getAttribute('disabled')];
    el.vertical = false;
    el.disabled = false;
    await settle();
    el.setAttribute('snap-threshold', '30');
    el.setAttribute('primary', 'end');
    await settle();
    out.others = [el.snapThreshold, typeof el.snapThreshold, el.primary, el.hasAttribute('primary'), el.hasAttribute('snap-threshold')];
    el.setAttribute('snap', '10% 100px');
    await settle();
    out.snapString = [el.snap, typeof el.snap];
    el.removeAttribute('snap');
    await settle();
    out.snapRemoved = [el.snap, el.hasAttribute('snap')];
    el.setAttribute('position-in-pixels', '100');
    await settle();
    out.pixels = [el.positionInPixels, el.position, el.getAttribute('position'), el.hasAttribute('position-in-pixels')];
    return out;
  });
  expect(r).toEqual({
    observed: ['dir', 'disabled', 'lang', 'position', 'position-in-pixels', 'primary', 'snap', 'snap-threshold', 'vertical'],
    attrPosition: [25, 'number', 100],
    propPosition: ['40', 160],
    removedPosition: [50, '50'],
    booleans: [true, true],
    removedBooleans: [false, false, false, false],
    reflectedBooleans: ['', ''],
    others: [30, 'number', 'end', true, true],
    snapString: ['10% 100px', 'string'],
    snapRemoved: ['', false],
    pixels: [100, 25, '25', true],
  });
});

test('position-in-pixels sets the position from the measured size; positionInPixels follows position', async ({ page }) => {
  const { frame } = await openExample(page);
  const host = await mount(frame, { 'position-in-pixels': '100' });
  expect(await position(host)).toBe(25);
  let s = await state(host);
  expect(s.positionInPixels).toBe(100);
  expect(s.start[2]).toBe(98);
  await host.evaluate(async el => { el.positionInPixels = 300; await el.updateComplete; });
  s = await state(host);
  expect(s.position).toBe(75);
  expect(s.start[2]).toBe(298);
  await host.evaluate(async el => { el.position = 10; await el.updateComplete; });
  expect((await state(host)).positionInPixels).toBe(40);
});

test('sl-reposition: bubbles, is composed, not cancelable, has an empty detail, and fires for every position change, including the first update', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('body').evaluate(async body => {
    const el = document.createElement('sl-split-panel');
    el.style.cssText = 'width: 400px; height: 100px';
    el.innerHTML = '<div slot="start">a</div><div slot="end">b</div>';
    const seen = [];
    body.addEventListener('sl-reposition', event => seen.push({ type: event.type, target: event.target === el, bubbles: event.bubbles, composed: event.composed, cancelable: event.cancelable, detail: event.detail, position: el.position }));
    body.prepend(el);
    await el.updateComplete;
    const first = seen.splice(0);
    el.position = 30;
    await el.updateComplete;
    const afterProperty = seen.splice(0).map(e => e.position);
    el.setAttribute('position', '60');
    await el.updateComplete;
    const afterAttribute = seen.splice(0).map(e => e.position);
    el.position = 60;
    await el.updateComplete;
    const unchanged = seen.splice(0).length;
    el.positionInPixels = 100;
    await el.updateComplete;
    const afterPixels = seen.splice(0).map(e => e.position);
    el.remove();
    return { first, afterProperty, afterAttribute, unchanged, afterPixels };
  });
  expect(r.first).toEqual([{ type: 'sl-reposition', target: true, bubbles: true, composed: true, cancelable: false, detail: {}, position: 50 }]);
  expect(r.afterProperty).toEqual([30]);
  expect(r.afterAttribute).toEqual([60]);
  expect(r.unchanged).toBe(0);
  expect(r.afterPixels).toEqual([25]);
});

test('vertical: rows instead of columns, panels stacked, host dimensions from the main axis', async ({ page }) => {
  const { frame } = await openExample(page);
  const host = await mount(frame, { vertical: '' }, { style: 'width: 300px; height: 400px;' });
  const s = await state(host);
  expect(s.start.slice(2)).toEqual([300, 198]);
  expect(s.divider.slice(2)).toEqual([300, 4]);
  expect(s.end.slice(2)).toEqual([300, 198]);
  const styles = await host.evaluate(el => ({ cols: el.style.gridTemplateColumns, rows: el.style.gridTemplateRows.replace(/\s+/g, ' ').trim() }));
  expect(styles.cols).toBe('');
  expect(styles.rows).toContain('var(--divider-width)');
  // Changing orientation re-measures the host along the new axis.
  await host.evaluate(async el => { el.vertical = false; await el.updateComplete; });
  expect((await state(host)).start[2]).toBe(148);
  expect(await host.evaluate(el => el.style.gridTemplateRows)).toBe('');
  expect(await position(host)).toBe(50);
});

test('keyboard: arrows move 1%, shift moves 10%, Home/End jump, Enter collapses and restores, keys are clamped to 0-100', async ({ page }) => {
  const { frame } = await openExample(page);
  const host = await mount(frame);
  const divider = host.locator('.divider');
  await divider.focus();
  const press = async key => { await page.keyboard.press(key); await host.evaluate(el => el.updateComplete); return position(host); };
  expect(await press('ArrowRight')).toBe(51);
  expect(await press('ArrowLeft')).toBe(50);
  expect(await press('Shift+ArrowLeft')).toBe(40);
  expect(await press('Shift+ArrowRight')).toBe(50);
  // Up and down do not move a horizontal panel, but (as upstream) every accepted key is prevented first, so the page
  // cannot be scrolled with them while the divider has focus.
  await host.evaluate(() => { window.keydownDefaultPrevented = []; document.addEventListener('keydown', event => window.keydownDefaultPrevented.push([event.key, event.defaultPrevented])); });
  expect(await press('ArrowUp')).toBe(50);
  expect(await press('ArrowDown')).toBe(50);
  expect(await host.evaluate(() => window.keydownDefaultPrevented)).toEqual([['ArrowUp', true], ['ArrowDown', true]]);
  expect(await press('Home')).toBe(0);
  expect(await press('ArrowLeft')).toBe(0);
  expect(await press('End')).toBe(100);
  expect(await press('ArrowRight')).toBe(100);
  await host.evaluate(async el => { el.position = 35; await el.updateComplete; });
  // Enter collapses the start panel; Enter again restores the earlier position.
  expect(await press('Enter')).toBe(0);
  await page.waitForTimeout(100);
  expect(await press('Enter')).toBe(35);
  expect(await press('Enter')).toBe(0);
  await page.waitForTimeout(100);
  // Any other position change forgets the collapsed state: the next Enter collapses again instead of restoring.
  expect(await press('ArrowRight')).toBe(1);
  expect(await press('Enter')).toBe(0);
});

test('keyboard: arrows are inverted for an end primary panel, and vertical panels use up and down', async ({ page }) => {
  const { frame } = await openExample(page);
  const end = await mount(frame, { primary: 'end' });
  await end.locator('.divider').focus();
  const press = async (host, key) => { await page.keyboard.press(key); await host.evaluate(el => el.updateComplete); return position(host); };
  expect(await press(end, 'ArrowRight')).toBe(49);
  expect(await press(end, 'ArrowLeft')).toBe(50);
  expect(await press(end, 'Shift+ArrowLeft')).toBe(60);
  expect(await press(end, 'Home')).toBe(100);
  expect(await press(end, 'End')).toBe(0);
  const vertical = await mount(frame, { vertical: '' }, { style: 'width: 300px; height: 300px;' });
  await vertical.locator('.divider').focus();
  expect(await press(vertical, 'ArrowDown')).toBe(51);
  expect(await press(vertical, 'ArrowUp')).toBe(50);
  expect(await press(vertical, 'ArrowRight')).toBe(50);
  expect(await press(vertical, 'ArrowLeft')).toBe(50);
  expect(await press(vertical, 'Shift+ArrowDown')).toBe(60);
});

test('disabled: not focusable, ignores keys and dragging, shows the not-allowed cursor, and keeps the position changeable from code', async ({ page }) => {
  const { frame } = await openExample(page);
  const host = await mount(frame, { disabled: '' });
  const divider = host.locator('.divider');
  const info = await host.evaluate(el => {
    const d = el.shadowRoot.querySelector('.divider');
    return { tabindex: d.hasAttribute('tabindex'), ariaDisabled: d.hasAttribute('aria-disabled'), cursor: getComputedStyle(d).cursor };
  });
  expect(info).toEqual({ tabindex: false, ariaDisabled: false, cursor: 'not-allowed' });
  // Calling focus() on the divider does nothing without a tabindex.
  expect(await host.evaluate(el => { el.shadowRoot.querySelector('.divider').focus(); return el.shadowRoot.activeElement; })).toBeNull();
  await page.keyboard.press('ArrowRight');
  expect(await position(host)).toBe(50);
  // A key event sent straight to the divider is ignored and not prevented.
  const prevented = await host.evaluate(el => {
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    el.shadowRoot.querySelector('.divider').dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(false);
  expect(await position(host)).toBe(50);
  await drag(page, host, 200, 300);
  expect(await position(host)).toBe(50);
  await host.evaluate(async el => { el.position = 20; await el.updateComplete; });
  expect((await state(host)).start[2]).toBe(78);
  // Enabling it again restores the tab stop and dragging.
  await host.evaluate(async el => { el.disabled = false; await el.updateComplete; });
  expect(await divider.getAttribute('tabindex')).toBe('0');
  await drag(page, host, 80, 200);
  near(await position(host), 50);
});

test('mouse drag: moves the divider to the pointer (horizontal, vertical, end primary), clamps at the edges, and a press alone does not move it', async ({ page }) => {
  const { frame } = await openExample(page);
  const host = await mount(frame);
  // A press away from the divider's centre, inside its hit area, without moving: nothing happens (upstream quirk).
  await host.scrollIntoViewIfNeeded();
  const box = await host.boundingBox();
  await page.mouse.move(box.x + 205, box.y + 60);
  await page.mouse.down();
  await page.mouse.up();
  expect(await position(host)).toBe(50);
  await drag(page, host, 200, 100);
  near(await position(host), 25);
  near((await state(host)).start[2], 98);
  // Clamping: drag past each edge of the host, to 1px inside the example frame's own edges. Past the frame, Firefox sends
  // the pointer moves of a press that started in the frame to the parent document (Chromium and WebKit keep them in the
  // frame), and the drag listens on the frame's document.
  const edges = await host.evaluate(el => {
    const left = el.getBoundingClientRect().left;
    return { before: 1 - left, after: document.documentElement.clientWidth - 1 - left, width: el.getBoundingClientRect().width };
  });
  expect(edges.before).toBeLessThan(0);
  expect(edges.after).toBeGreaterThan(edges.width);
  await drag(page, host, 100, edges.after);
  expect(await position(host)).toBe(100);
  await drag(page, host, 398, edges.before);
  expect(await position(host)).toBe(0);
  const end = await mount(frame, { primary: 'end', position: '25' });
  await drag(page, end, 300, 250);
  // The position is measured from the end edge when the end panel is primary.
  near(await position(end), 37.5);
  const vertical = await mount(frame, { vertical: '' }, { style: 'width: 300px; height: 400px;' });
  await drag(page, vertical, 200, 100, { vertical: true });
  near(await position(vertical), 25);
});

test('dragging emits sl-reposition continuously and stops when the pointer is released', async ({ page }) => {
  const { frame } = await openExample(page);
  const host = await mount(frame);
  await host.evaluate(el => { window.__events = 0; el.addEventListener('sl-reposition', () => window.__events++); });
  await drag(page, host, 200, 120, { steps: 8 });
  const moved = await frame.locator('body').evaluate(() => window.__events);
  expect(moved).toBeGreaterThan(3);
  // After release, further pointer movement does nothing.
  const box = await host.boundingBox();
  await page.mouse.move(box.x + 300, box.y + 20);
  await page.mouse.move(box.x + 350, box.y + 20);
  expect(await frame.locator('body').evaluate(() => window.__events)).toBe(moved);
  near(await position(host), 30);
});

test('snap: pixel and percentage points, snap-threshold, and a custom function', async ({ page }) => {
  const { frame } = await openExample(page);
  const host = await mount(frame, { snap: '100px 50%' });
  // Within the default 12px threshold of 100px: snaps; of 50% (200px): snaps; elsewhere: free.
  await drag(page, host, 200, 108);
  expect((await state(host)).positionInPixels).toBe(100);
  await drag(page, host, 100, 190);
  expect((await state(host)).positionInPixels).toBe(200);
  await drag(page, host, 200, 150);
  near((await state(host)).positionInPixels, 150);
  await host.evaluate(async el => { el.snapThreshold = 60; await el.updateComplete; });
  await drag(page, host, 150, 150);
  expect((await state(host)).positionInPixels).toBe(100);
  // A function receives pos, size, snapThreshold, isRtl and vertical, and returns the pixel position; null keeps the pointer's.
  const calls = await host.evaluate(async el => {
    const seen = [];
    el.snap = args => { seen.push(args); return args.pos < args.size / 2 ? 100 : args.size - 100; };
    await el.updateComplete;
    window.__seen = seen;
    return typeof el.snap;
  });
  expect(calls).toBe('function');
  await drag(page, host, 100, 120);
  expect((await state(host)).positionInPixels).toBe(100);
  await drag(page, host, 100, 330);
  expect((await state(host)).positionInPixels).toBe(300);
  const last = await frame.locator('body').evaluate(() => { const a = window.__seen.at(-1); return { keys: Object.keys(a).sort(), size: a.size, snapThreshold: a.snapThreshold, isRtl: a.isRtl, vertical: a.vertical }; });
  expect(last).toEqual({ keys: ['isRtl', 'pos', 'size', 'snapThreshold', 'vertical'], size: 400, snapThreshold: 60, isRtl: false, vertical: false });
  // null means no snapping; clearing it with null or '' restores free dragging.
  await host.evaluate(async el => { el.snap = () => null; await el.updateComplete; });
  await drag(page, host, 300, 123);
  near((await state(host)).positionInPixels, 123);
  await host.evaluate(async el => { el.snap = '100px'; el.snap = null; await el.updateComplete; });
  expect(await host.evaluate(el => [el.snap, el.getAttribute('snap')])).toEqual(['', '']);
  await drag(page, host, 123, 105);
  near((await state(host)).positionInPixels, 105);
});

test('snap: repeat() intervals, with the upstream parsing quirks', async ({ page }) => {
  const { frame } = await openExample(page);
  const pixels = async (attrs, from, to) => {
    const host = await mount(frame, attrs);
    await drag(page, host, from, to);
    return (await state(host)).positionInPixels;
  };
  // repeat(100px) snaps every 100px, and so does the documented repeat(100px) 50%.
  expect(await pixels({ snap: 'repeat(100px)', position: '25' }, 100, 188)).toBe(200);
  expect(await pixels({ snap: 'repeat(100px) 50%', position: '25' }, 100, 292)).toBe(300);
  // Percentage intervals work when the whole string ends in a percentage.
  expect(await pixels({ snap: 'repeat(25%)', position: '25' }, 100, 190)).toBe(200);
  // Quirk: the unit comes from the end of the whole string, so repeat(10%) 100px repeats every 10px, not every 40px.
  expect(await pixels({ snap: 'repeat(10%) 100px', position: '25' }, 100, 158)).toBe(160);
  // Quirk: a repeat() that is not first never snaps (its interval parses as NaN); the other values still do.
  near(await pixels({ snap: '10% repeat(10px)', position: '25' }, 100, 158), 158);
  expect(await pixels({ snap: '10% repeat(10px)', position: '25' }, 100, 45)).toBe(40);
});

test('dir="rtl": the columns mirror (the start panel is on the right), the position is measured from the left edge, and the snap function gets isRtl', async ({ page }) => {
  const { frame } = await openExample(page);
  const ltr = await mount(frame, { position: '25' }, { id: 'ltr' });
  const rtl = await mount(frame, { dir: 'rtl', position: '25' }, { id: 'rtl' });
  const l = await state(ltr);
  expect(l.start[0]).toBeLessThan(l.end[0]);
  expect([l.start[2], l.end[2]]).toEqual([98, 298]);
  const r = await state(rtl);
  expect(r.start[0]).toBeGreaterThan(r.end[0]);
  // Shoelace swaps the template in right-to-left, so the 25% track is the left-hand (end) panel.
  expect([r.start[2], r.end[2]]).toEqual([298, 98]);
  expect(await rtl.evaluate(el => [el.position, el.dir])).toEqual([25, 'rtl']);
  await rtl.evaluate(async el => {
    window.__rtl = [];
    el.snap = args => { window.__rtl.push(args.isRtl); return null; };
    await el.updateComplete;
  });
  await drag(page, rtl, 100, 60);
  near(await position(rtl), 15);
  expect(await frame.locator('body').evaluate(() => [...new Set(window.__rtl)])).toEqual([true]);
  // Keyboard keys are not mirrored.
  await rtl.locator('.divider').focus();
  const beforeKey = await position(rtl);
  await page.keyboard.press('ArrowRight');
  await rtl.evaluate(el => el.updateComplete);
  expect(await position(rtl)).toBe(beforeKey + 1);
  // A dir attribute on an ancestor is not seen by the component (Shoelace reads the host's dir and then the document's, nothing in between).
  const inherited = await frame.locator('body').evaluate(async body => {
    const wrap = document.createElement('div');
    wrap.dir = 'rtl';
    wrap.innerHTML = '<sl-split-panel style="width: 400px; height: 100px" position="25"><div slot="start">a</div><div slot="end">b</div></sl-split-panel>';
    body.prepend(wrap);
    const el = wrap.firstElementChild;
    await el.updateComplete;
    const start = el.firstElementChild.getBoundingClientRect();
    const end = el.lastElementChild.getBoundingClientRect();
    const out = { startRightOfEnd: start.left > end.left, template: el.style.gridTemplateColumns.replace(/\s+/g, ' ').trim().split(' ')[0] };
    wrap.remove();
    return out;
  });
  // The grid itself mirrors (CSS direction is inherited), but the template was built for left-to-right.
  expect(inherited.startRightOfEnd).toBe(true);
  expect(inherited.template).toMatch(/^clamp\(/);
});

test('min and max: --min and --max constrain the primary (start) panel', async ({ page }) => {
  const { frame } = await openExample(page);
  const host = await mount(frame, {}, { style: 'width: 400px; height: 100px; --min: 150px; --max: calc(100% - 150px);' });
  await drag(page, host, 200, 10);
  let s = await state(host);
  expect(s.start[2]).toBe(150);
  expect(s.end[2]).toBe(246);
  await drag(page, host, 152, 399);
  s = await state(host);
  expect(s.start[2]).toBe(250);
  // --min and --max size the primary (start) track, and the 4px divider comes out of the rest: the end panel is 146px,
  // not the 150px the example's text promises (upstream quirk, listed on the docs page).
  expect(s.end[2]).toBe(146);
  // The reported position is not clamped by the CSS: that is only layout.
  expect(s.position).toBeGreaterThan(90);
});

test('primary panel: the primary panel keeps its pixel size when the host resizes; without one both scale', async ({ page }) => {
  const { frame } = await openExample(page);
  const proportional = await mount(frame, { position: '25' });
  await proportional.evaluate(async el => { el.style.width = '800px'; await new Promise(r => setTimeout(r, 200)); await el.updateComplete; });
  expect(await position(proportional)).toBe(25);
  expect((await state(proportional)).start[2]).toBe(198);
  const start = await mount(frame, { primary: 'start', position: '25' });
  await start.evaluate(async el => { el.style.width = '800px'; await new Promise(r => setTimeout(r, 300)); await el.updateComplete; });
  let s = await state(start);
  expect(s.positionInPixels).toBe(100);
  expect(s.position).toBe(12.5);
  expect(s.start[2]).toBe(98);
  expect(s.end[2]).toBe(698);
  const end = await mount(frame, { primary: 'end', position: '25' });
  await end.evaluate(async el => { el.style.width = '800px'; await new Promise(r => setTimeout(r, 300)); await el.updateComplete; });
  s = await state(end);
  expect(s.positionInPixels).toBe(100);
  expect(s.end[2]).toBe(98);
  expect(s.start[2]).toBe(698);
  // A resize with a primary panel emits sl-reposition, because the position changed.
  const events = await end.evaluate(async el => {
    let n = 0;
    el.addEventListener('sl-reposition', () => n++);
    el.style.width = '500px';
    await new Promise(r => setTimeout(r, 300));
    return n;
  });
  expect(events).toBeGreaterThan(0);
  // The primary attribute can also be set after the fact.
  await start.evaluate(async el => { el.primary = 'end'; await el.updateComplete; });
  expect(await start.evaluate(el => el.primary)).toBe('end');
});

test('examples: the primary-panel select drives the primary property, and the custom snap function example snaps to 100px from each edge', async ({ page }) => {
  const primary = await openExample(page, 'Setting the Primary Panel');
  const panel = primary.frame.locator('.split-panel-primary sl-split-panel');
  expect(await panel.evaluate(el => el.primary)).toBeUndefined();
  await primary.frame.locator('.split-panel-primary select').selectOption('end');
  expect(await panel.evaluate(el => [el.primary, el.getAttribute('primary')])).toEqual(['end', null]);
  await primary.frame.locator('.split-panel-primary select').selectOption('');
  expect(await panel.evaluate(el => el.primary)).toBe('');
  const fn = await openExample(page, 'Using a Custom Snap Function');
  const snapPanel = fn.frame.locator('.split-panel-snapping-fn sl-split-panel');
  expect(await snapPanel.evaluate(el => typeof el.snap)).toBe('function');
  const width = (await snapPanel.boundingBox()).width;
  await drag(page, snapPanel, width / 2, 130);
  expect((await state(snapPanel)).positionInPixels).toBe(100);
  await drag(page, snapPanel, 100, width - 120);
  expect((await state(snapPanel)).positionInPixels).toBe(width - 100);
});

test('a split panel shown after being hidden recomputes from the position-in-pixels attribute (upstream quirk)', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('body').evaluate(async body => {
    const wrap = document.createElement('div');
    wrap.style.display = 'none';
    wrap.innerHTML = '<sl-split-panel id="hidden-one" position-in-pixels="100" style="width: 400px; height: 100px"><div slot="start">a</div><div slot="end">b</div></sl-split-panel>' +
      '<sl-split-panel id="hidden-two" style="width: 400px; height: 100px"><div slot="start">a</div><div slot="end">b</div></sl-split-panel>';
    body.prepend(wrap);
    const [one, two] = wrap.querySelectorAll('sl-split-panel');
    await one.updateComplete;
    await two.updateComplete;
    // The size was 0 when they connected, so a pixel position divides by 0 and the position becomes Infinity.
    const hidden = { one: one.position, two: two.position };
    two.positionInPixels = 100;
    wrap.style.display = '';
    await new Promise(resolve => setTimeout(resolve, 300));
    await one.updateComplete;
    await two.updateComplete;
    const shown = { one: one.position, onePixels: one.positionInPixels, two: two.position };
    wrap.remove();
    return { hidden, shown };
  });
  expect(r.hidden).toEqual({ one: Infinity, two: 50 });
  expect(r.shown.one).toBe(25);
  expect(r.shown.onePixels).toBe(100);
  // The property alone is lost: the attribute is absent, so the position becomes 0.
  expect(r.shown.two).toBe(0);
});

test('slots: a custom divider handle is slotted and nested split panels work independently', async ({ page }) => {
  const { frame } = await openExample(page, 'A styled divider');
  const host = frame.locator('sl-split-panel');
  const handle = await host.evaluate(el => {
    const slot = el.shadowRoot.querySelector('slot[name="divider"]');
    const assigned = slot.assignedElements();
    return { count: assigned.length, tag: assigned[0]?.localName, insideDivider: !!slot.closest('.divider'), width: el.shadowRoot.querySelector('.divider').getBoundingClientRect().width };
  });
  expect(handle).toEqual({ count: 1, tag: 'svg', insideDivider: true, width: 2 });
  // ::part(divider) styles apply, and keyboard focus recolors the divider through the shadow styles.
  const color = () => host.evaluate(el => getComputedStyle(el.shadowRoot.querySelector('.divider')).backgroundColor);
  expect(await color()).toBe('rgb(219, 39, 119)');
  // Keyboard focus, as in the focus test below: Tab first, so the last interaction is a keyboard one (Firefox does not
  // always treat script focus as :focus-visible otherwise), then script focus if Tab landed elsewhere.
  await page.keyboard.press('Tab');
  if (!(await host.evaluate(el => el.shadowRoot.activeElement !== null))) await host.locator('.divider').focus();
  await page.keyboard.press('ArrowRight');
  expect(await host.evaluate(el => [document.hasFocus(), el.shadowRoot.activeElement?.classList.contains('divider')])).toEqual([true, true]);
  expect(await color()).toBe('rgb(2, 132, 199)');
  const nested = await openExample(page, 'Nested Split Panels');
  const panels = nested.frame.locator('sl-split-panel');
  await expect(panels).toHaveCount(2);
  const outer = panels.first();
  const inner = panels.last();
  const innerBefore = await inner.evaluate(el => el.position);
  const outerWidth = (await outer.boundingBox()).width;
  await drag(page, outer, outerWidth / 2, outerWidth / 4);
  expect(await position(outer)).toBeCloseTo(25, 0);
  expect(await inner.evaluate(el => el.position)).toBe(innerBefore);
  // Measured in the panel's own document: Playwright's bounding box crosses the iframe boundary, and Firefox lays out in
  // 1/60 px units, so the fractional frame offset can leave that height a fraction off 400 although the panel is 400px.
  expect(await inner.evaluate(el => el.getBoundingClientRect().height)).toBe(400);
  await drag(page, inner, 200, 100, { vertical: true });
  expect(await position(inner)).toBeCloseTo(25, 0);
  expect(await position(outer)).toBeCloseTo(25, 0);
});

test('keyboard focus shows the divider in the primary colour; a mouse press does not focus it (upstream quirk)', async ({ page }) => {
  const { frame } = await openExample(page);
  const background = host => host.evaluate(el => getComputedStyle(el.shadowRoot.querySelector('.divider')).backgroundColor);
  // Mouse: the press prevents the mousedown default (to stop text selection), which also stops it from focusing the
  // divider, so there is no focus and the colour does not change.
  const clicked = await mount(frame, {}, { id: 'clicked' });
  expect(await background(clicked)).toBe('rgb(228, 228, 231)');
  await clicked.locator('.divider').click();
  expect(await clicked.evaluate(el => el.shadowRoot.activeElement)).toBeNull();
  expect(await background(clicked)).toBe('rgb(228, 228, 231)');
  // Keyboard: Tab (or, when the page started elsewhere, script focus after a key press) matches :focus-visible.
  const host = await mount(frame);
  await page.keyboard.press('Tab');
  const focused = await host.evaluate(el => el.matches(':focus-within') || el.shadowRoot.activeElement !== null);
  if (!focused) await host.locator('.divider').focus();
  await page.keyboard.press('ArrowRight');
  expect(await background(host)).toBe('rgb(2, 132, 199)');
  const outline = await host.evaluate(el => getComputedStyle(el.shadowRoot.querySelector('.divider')).outlineStyle);
  expect(outline).toBe('none');
});

test('cursors and hit area follow the orientation; the divider width and hit area are CSS custom properties', async ({ page }) => {
  const { frame } = await openExample(page);
  const horizontal = await mount(frame, {}, { style: 'width: 400px; height: 120px; --divider-width: 10px; --divider-hit-area: 30px;' });
  const h = await horizontal.evaluate(el => {
    const d = el.shadowRoot.querySelector('.divider');
    const after = getComputedStyle(d, '::after');
    return { cursor: getComputedStyle(d).cursor, width: d.getBoundingClientRect().width, hit: [after.width, after.height, after.position] };
  });
  expect(h.cursor).toBe('col-resize');
  expect(h.width).toBe(10);
  expect(h.hit).toEqual(['30px', '120px', 'absolute']);
  const vertical = await mount(frame, { vertical: '' }, { style: 'width: 300px; height: 300px;' });
  const v = await vertical.evaluate(el => {
    const d = el.shadowRoot.querySelector('.divider');
    const after = getComputedStyle(d, '::after');
    return { cursor: getComputedStyle(d).cursor, hit: [after.width, after.height], flex: getComputedStyle(el).flexDirection };
  });
  expect(v).toEqual({ cursor: 'row-resize', hit: ['300px', '12px'], flex: 'column' });
});

test('dark theme: the divider follows the theme tokens', async ({ page }) => {
  const { frame } = await openExample(page);
  const host = await mount(frame);
  const light = await host.evaluate(el => getComputedStyle(el.shadowRoot.querySelector('.divider')).backgroundColor);
  await frame.locator('html').evaluate(el => { el.classList.remove('sl-theme-light'); el.classList.add('sl-theme-dark'); });
  const dark = await host.evaluate(el => getComputedStyle(el.shadowRoot.querySelector('.divider')).backgroundColor);
  expect(light).toBe('rgb(228, 228, 231)');
  expect(dark).not.toBe(light);
});

test('forced colors: the divider keeps a visible outline', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  const { frame } = await openExample(page);
  const emulated = await frame.locator('body').evaluate(() => matchMedia('(forced-colors: active)').matches);
  expect(emulated, 'forced colors are emulated in every engine of the product suite').toBe(true);
  const host = await mount(frame);
  const outline = await host.evaluate(el => {
    const cs = getComputedStyle(el.shadowRoot.querySelector('.divider'));
    return [cs.outlineStyle, cs.outlineWidth];
  });
  expect(outline).toEqual(['solid', '1px']);
});

test('the hidden attribute does not hide the host (as in Shoelace, whose :host rule beats the UA one); core extras: ready event once, dir property', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('body').evaluate(async body => {
    const el = document.createElement('sl-split-panel');
    const events = [];
    el.addEventListener('ready', event => events.push({ bubbles: event.bubbles, composed: event.composed }));
    body.prepend(el);
    await el.updateComplete;
    el.position = 10;
    await el.updateComplete;
    const out = { events, hidden: null, dir: el.dir };
    el.hidden = true;
    await el.updateComplete;
    out.hidden = getComputedStyle(el).display;
    el.remove();
    return out;
  });
  expect(r.events).toEqual([{ bubbles: false, composed: false }]);
  // Shoelace's `:host { display: grid }` outranks the user agent's `[hidden] { display: none }`, so the element stays visible.
  expect(r.hidden).toBe('grid');
  expect(r.dir).toBe('ltr');
});

test('core base styles do not leak into the divider part: no focus outline offset from --focus-outline-offset, and the host box-sizing is inherited', async ({ page }) => {
  const { frame } = await openExample(page);
  await frame.locator('head').evaluate(head => {
    const style = document.createElement('style');
    style.id = 'leak-probe';
    // The custom focus outline is an author style on the part; the width and border are for the box-sizing check.
    style.textContent = '#probe::part(divider):focus-visible { outline: 3px solid red; } #box::part(divider) { width: 4px; border: 1px solid; }';
    head.append(style);
  });
  // Core's `*:focus-visible { outline-offset: var(--focus-outline-offset) }` would reach the divider with this token set.
  const host = await mount(frame, {}, { style: 'width: 400px; height: 120px; --focus-outline-offset: 8px;' });
  await page.keyboard.press('Tab');
  const focused = await host.evaluate(el => el.shadowRoot.activeElement !== null);
  if (!focused) await host.locator('.divider').focus();
  await page.keyboard.press('ArrowRight');
  const focus = await host.evaluate(el => {
    const cs = getComputedStyle(el.shadowRoot.querySelector('.divider'));
    return [cs.outlineStyle, cs.outlineWidth, cs.outlineOffset];
  });
  // Shoelace does not read the token: the offset stays at its initial value.
  expect(focus).toEqual(['solid', '3px', '0px']);
  const width = async style => {
    const box = await mount(frame, {}, { id: 'box', style });
    return box.evaluate(el => el.shadowRoot.querySelector('.divider').getBoundingClientRect().width);
  };
  // The part inherits the host's box-sizing: border-box keeps the 4px, content-box adds the 2px border.
  expect(await width('width: 400px; height: 120px;')).toBe(4);
  expect(await width('width: 400px; height: 120px; box-sizing: content-box;')).toBe(6);
  await frame.locator('#leak-probe').evaluate(el => el.remove());
});

test('moving the element in the DOM keeps resizing and measuring working', async ({ page }) => {
  const { frame } = await openExample(page);
  const host = await mount(frame, { primary: 'start', position: '25' });
  await host.evaluate(async el => {
    const parent = el.parentElement;
    el.remove();
    parent.append(el);
    await el.updateComplete;
    await new Promise(resolve => setTimeout(resolve, 200));
  });
  await host.evaluate(async el => { el.style.width = '800px'; await new Promise(r => setTimeout(r, 300)); });
  expect((await state(host)).positionInPixels).toBe(100);
  await drag(page, await frame.locator('#probe'), 100, 300);
  near(await position(host), 37.5);
});

// Chromium gets real touch input through the DevTools protocol. Playwright cannot inject a touch move in Firefox or WebKit,
// so there the test dispatches the sequence a touch produces: pointerdown and touchstart on the divider, then touch-type
// pointer events. The same end position is required in every engine.
test('touch: dragging the divider with a touch moves it (real touch input in Chromium, its event sequence elsewhere)', async ({ page, browserName }) => {
  const { frame } = await openExample(page);
  const host = await mount(frame);
  await host.scrollIntoViewIfNeeded();
  const moves = [190, 170, 150, 130, 110, 100];
  if (browserName === 'chromium') {
    const box = await host.boundingBox();
    const session = await page.context().newCDPSession(page);
    const touch = (type, x) => session.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: box.y + 60 }] });
    await touch('touchStart', box.x + 200);
    for (const dx of moves) await touch('touchMove', box.x + dx);
    await touch('touchEnd', 0);
  } else {
    await host.evaluate((el, moves) => {
      const divider = el.shadowRoot.querySelector('.divider');
      const box = el.getBoundingClientRect();
      const init = { bubbles: true, composed: true, cancelable: true };
      const pointer = (type, dx) => divider.dispatchEvent(new PointerEvent(type, { ...init, pointerType: 'touch', pointerId: 2, isPrimary: true, clientX: box.left + dx, clientY: box.top + 60 }));
      pointer('pointerdown', 200);
      divider.dispatchEvent(new Event('touchstart', init));
      for (const dx of moves) pointer('pointermove', dx);
      pointer('pointerup', moves.at(-1));
    }, moves);
  }
  await host.evaluate(el => el.updateComplete);
  near(await position(host), 25);
});

test('no upstream Shoelace runtime is requested or defined; all requests stay on the local origin', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  await documentsLoaded(page);
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  expect(await frame.locator('body').evaluate(() => Boolean(window.Shoelace || document.querySelector('script[src*="shoelace"]')))).toBe(false);
});
