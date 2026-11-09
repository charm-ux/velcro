// sl-tooltip product checks against Shoelace 2.20.1's tooltip contract, plus the animation registry it is the first user
// of (@charm-ux/velcro/utilities/animation-registry, Shoelace's dist/utilities/animation-registry.js).
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';
import { buildFixtures, gotoBlank } from './support/fixtures.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/tooltip';
const docsDir = fileURLToPath(new URL('../../packages/docs/', import.meta.url));
const velcroDir = fileURLToPath(new URL('../../packages/velcro/', import.meta.url));

// The docs page's examples, in page order: the example's title, and the name of its files under examples/tooltip/.
const EXAMPLES = [
  ['Overview', 'basic'],
  ['Placement', 'placement'],
  ['Click Trigger', 'click-trigger'],
  ['Manual Trigger', 'manual-trigger'],
  ['Removing Arrows', 'removing-arrows'],
  ['HTML in Tooltips', 'html'],
  ['Setting a Maximum Width', 'max-width'],
  ['Hoisting', 'hoisting'],
];

const frameFor = (page, title) => page.frameLocator(`iframe.example[title="Tooltip example: ${title}"]`);

async function openExample(page, name = 'Overview') {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  const frame = frameFor(page, name);
  await expect(frame.locator('sl-tooltip').first()).toBeAttached();
  await frame.locator('body').evaluate(() => customElements.whenDefined('sl-tooltip'));
  await documentsLoaded(page);
  return { frame, requests };
}

// Appends markup to the example document (replacing earlier mounts) and waits for every sl-tooltip in it to render.
async function mount(frame, markup) {
  await frame.locator('body').evaluate(async (body, markup) => {
    document.getElementById('mount')?.remove();
    const host = document.createElement('div');
    host.id = 'mount';
    host.style.padding = '4rem';
    host.innerHTML = markup;
    body.append(host);
    await Promise.all([...host.querySelectorAll('sl-tooltip')].map(el => el.updateComplete));
  }, markup);
}

// Records the sl-* events of #t (the mounted tooltip) in its own `events` array.
const recordEvents = frame => frame.locator('#t').evaluate(el => {
  const events = (el.events = []);
  for (const type of ['sl-show', 'sl-after-show', 'sl-hide', 'sl-after-hide']) {
    el.addEventListener(type, e => events.push({ type, bubbles: e.bubbles, composed: e.composed, cancelable: e.cancelable }));
  }
});
const eventTypes = frame => frame.locator('#t').evaluate(el => el.events.map(e => e.type));
const state = frame => frame.locator('#t').evaluate(el => ({ open: el.open, hidden: el.body.hidden, active: el.popup.active }));

// Reads `open` of #t a fixed time after the next pointer event of type `type` on #b, timed in the page. A delay window
// (still closed before --show-delay, still open before --hide-delay) must not be timed from the test process: the action,
// a sleep and a state read are separate protocol round trips, and on a loaded runner (Firefox in CI) they alone can
// outlast the window. The probe's listener on #b runs before the tooltip's own listener on the host (the event bubbles
// from #b), so its timer starts first and, being shorter, fires first (HTML timer ordering).
const probeAfterPointer = (frame, type, delay) => frame.locator('#t').evaluate((el, [type, delay]) => {
  el.probed ??= {};
  el.querySelector('#b').addEventListener(type, () => setTimeout(() => { el.probed[type] = el.open; }, delay), { once: true });
}, [type, delay]);
const probed = frame => frame.locator('#t').evaluate(el => el.probed);

// Resolves Shoelace theme tokens in the example document to the computed value of a CSS property.
// The tooltip line height token is unitless, so it is resolved on a probe with the tooltip font size.
async function lineHeight(frame) {
  return frame.locator('body').evaluate(body => {
    const probe = document.createElement('div');
    probe.style.fontSize = 'var(--sl-tooltip-font-size)';
    probe.style.lineHeight = 'var(--sl-tooltip-line-height)';
    body.append(probe);
    const value = getComputedStyle(probe).lineHeight;
    probe.remove();
    return [value];
  });
}

async function tokens(frame, property, names) {
  return frame.locator('body').evaluate((body, [property, names]) => names.map(name => {
    const probe = document.createElement('div');
    probe.style.setProperty(property, `var(${name})`);
    body.append(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }), [property, names]);
}

test('docs page is prerendered with Velcro branding, prototype status, every Shoelace section and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Tooltip - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('without changing the shared core prefix');
  expect(html).toContain('@charm-ux/velcro/utilities/animation-registry');
  for (const [title] of EXAMPLES) expect(html).toContain(`title="Tooltip example: ${title}"`);
});

test('sl-tooltip registers as the exported class with no ch-* definitions; it renders Velcro\'s sl-popup', async ({ page }) => {
  const { frame } = await openExample(page);
  // The docs bundle is minified, so class names are checked in the class-only entry test below.
  const r = await frame.locator('sl-tooltip').first().evaluate(el => ({
    ctor: el.constructor === customElements.get('sl-tooltip'),
    popup: Boolean(customElements.get('sl-popup')),
    ch: ['ch-tooltip', 'ch-popup'].map(t => Boolean(customElements.get(t))),
    popupCtor: el.shadowRoot.querySelector('sl-popup').constructor === customElements.get('sl-popup'),
    marker: el.getAttributeNames().filter(n => !['id', 'content'].includes(n)),
  }));
  expect(r).toEqual({ ctor: true, popup: true, ch: [false, false], popupCtor: true, marker: [] });
});

test('structure, parts and ARIA follow Shoelace', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-tooltip id="t" content="Tip"><button>Target</button></sl-tooltip>');
  const read = () => frame.locator('#t').evaluate(el => {
    const root = el.shadowRoot;
    const base = root.querySelector('[part~="base"]');
    const body = root.querySelector('[part~="body"]');
    const anchor = root.querySelector('slot:not([name])');
    return {
      base: [base.localName, base.className, base.getAttribute('exportparts').replace(/\s+/g, ' ').trim(), base.getAttribute('placement'),
        base.getAttribute('distance'), base.getAttribute('skidding'), base.getAttribute('strategy'),
        ['flip', 'shift', 'arrow', 'hover-bridge'].map(a => base.hasAttribute(a))],
      body: [body.id, body.className, body.getAttribute('role'), body.getAttribute('aria-live'), body.hidden],
      anchor: [anchor.getAttribute('slot'), anchor.getAttribute('aria-describedby'), anchor === el.defaultSlot],
      content: root.querySelector('slot[name="content"]').textContent,
      members: [el.body === body, el.popup === base],
    };
  });
  expect(await read()).toEqual({
    // Lit's classMap pads the class list with spaces, as in Shoelace.
    base: ['sl-popup', ' tooltip ', 'popup:base__popup, arrow:base__arrow', 'top', '8', '0', 'absolute', [true, true, true, true]],
    body: ['tooltip', 'tooltip__body', 'tooltip', 'off', true],
    anchor: ['anchor', 'tooltip', true],
    content: 'Tip',
    members: [true, true],
  });
  await frame.locator('#t').evaluate(el => el.show());
  const open = await read();
  // After the first render, classMap writes the list without the padding.
  expect(open.base[1]).toBe('tooltip tooltip--open');
  expect(open.body.slice(3)).toEqual(['polite', false]);
});

test('computed styles match Shoelace: display contents, token colors, font, padding, radius, max-width, z-index and arrow', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-tooltip id="t" content="Tip" open><button>Target</button></sl-tooltip>');
  await frame.locator('#t').evaluate(el => new Promise(r => setTimeout(r, 50)));
  const r = await frame.locator('#t').evaluate(el => {
    const body = el.shadowRoot.querySelector('[part~="body"]');
    const popup = el.popup.shadowRoot.querySelector('[part~="popup"]');
    const arrow = el.popup.shadowRoot.querySelector('[part~="arrow"]');
    const s = getComputedStyle(body);
    return {
      host: getComputedStyle(el).display,
      body: [s.backgroundColor, s.color, s.fontFamily, s.fontSize, s.fontWeight, s.lineHeight, s.padding, s.borderRadius, s.maxWidth, s.width,
        s.textAlign, s.whiteSpace, s.pointerEvents, s.userSelect || s.webkitUserSelect, s.display],
      z: getComputedStyle(popup).zIndex,
      arrow: [getComputedStyle(arrow).backgroundColor, getComputedStyle(arrow).width],
      origin: getComputedStyle(popup).transformOrigin.split(' ').map(parseFloat),
      popupBox: [popup.getBoundingClientRect().width, popup.getBoundingClientRect().height],
      // The body's width is max-content: the width of its content laid out on one line, plus its padding.
      maxContent: (() => {
        const probe = body.cloneNode(true);
        probe.style.cssText = 'position: absolute; visibility: hidden; width: max-content; max-width: none';
        body.parentNode.append(probe);
        const w = getComputedStyle(probe).width;
        probe.remove();
        return w;
      })(),
    };
  });
  const [bg, color, font, size, weight, line, padding, radius, z, arrowSize] = await Promise.all([
    tokens(frame, 'background-color', ['--sl-tooltip-background-color']), tokens(frame, 'color', ['--sl-tooltip-color']),
    tokens(frame, 'font-family', ['--sl-tooltip-font-family']), tokens(frame, 'font-size', ['--sl-tooltip-font-size']),
    tokens(frame, 'font-weight', ['--sl-tooltip-font-weight']), lineHeight(frame),
    tokens(frame, 'padding', ['--sl-tooltip-padding']), tokens(frame, 'border-radius', ['--sl-tooltip-border-radius']),
    tokens(frame, 'z-index', ['--sl-z-index-tooltip']), tokens(frame, 'width', ['--sl-tooltip-arrow-size']),
  ]);
  const rootFontSize = await frame.locator('html').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  expect(r.host).toBe('contents');
  expect(r.body).toEqual([bg[0], color[0], font[0], size[0], weight[0], line[0], padding[0], radius[0], `${20 * rootFontSize}px`, r.maxContent,
    'start', 'normal', 'none', 'none', 'block']);
  expect(r.z).toBe(z[0]);
  expect(r.arrow[0]).toBe(bg[0]);
  // sl-popup draws the arrow as a rotated square whose side is twice the arrow size's diagonal (size * 0.7071).
  expect(parseFloat(r.arrow[1])).toBeCloseTo(parseFloat(arrowSize[0]) * 0.7071 * 2, 1);
  // The tooltip is above its target, so the popup scales from its bottom edge: transform-origin is bottom (center x).
  expect(r.origin[0]).toBeCloseTo(r.popupBox[0] / 2, 0);
  expect(r.origin[1]).toBeCloseTo(r.popupBox[1], 0);
});

test('hover: shows after --show-delay with sl-show then sl-after-show, and hides on mouse out after --hide-delay', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-tooltip id="t" content="Tip" style="--show-delay: 300ms; --hide-delay: 200ms"><button id="b">Target</button></sl-tooltip><p id="away">away</p>');
  await recordEvents(frame);
  await probeAfterPointer(frame, 'mouseover', 150);
  await frame.locator('#b').hover();
  await expect.poll(() => eventTypes(frame)).toEqual(['sl-show', 'sl-after-show']);
  expect(await probed(frame)).toEqual({ mouseover: false });
  expect(await state(frame)).toEqual({ open: true, hidden: false, active: true });
  await probeAfterPointer(frame, 'mouseout', 80);
  await frame.locator('#away').hover();
  await expect.poll(() => eventTypes(frame)).toEqual(['sl-show', 'sl-after-show', 'sl-hide', 'sl-after-hide']);
  expect(await probed(frame)).toEqual({ mouseover: false, mouseout: true });
  expect(await state(frame)).toEqual({ open: false, hidden: true, active: false });
  const events = await frame.locator('#t').evaluate(el => el.events);
  expect(events.every(e => e.bubbles && e.composed && !e.cancelable)).toBe(true);
});

test('focus shows and blur hides by default; trigger="click" toggles on click only; trigger="manual" ignores all of them', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-tooltip id="t" content="Tip"><button id="b">Target</button></sl-tooltip><button id="other">Other</button>');
  await frame.locator('#b').focus();
  await expect.poll(async () => (await state(frame)).open).toBe(true);
  await frame.locator('#other').focus();
  await expect.poll(async () => (await state(frame)).open).toBe(false);

  await mount(frame, '<sl-tooltip id="t" content="Tip" trigger="click"><button id="b">Target</button></sl-tooltip><button id="other">Other</button>');
  await frame.locator('#b').focus();
  await probeAfterPointer(frame, 'mouseover', 300);
  await frame.locator('#b').hover();
  await expect.poll(() => probed(frame)).toEqual({ mouseover: false });
  expect((await state(frame)).open).toBe(false);
  await frame.locator('#b').click();
  await expect.poll(async () => (await state(frame)).hidden).toBe(false);
  await frame.locator('#b').click();
  await expect.poll(async () => (await state(frame)).hidden).toBe(true);

  await mount(frame, '<sl-tooltip id="t" content="Tip" trigger="manual"><button id="b">Target</button></sl-tooltip>');
  await frame.locator('#b').click();
  await frame.locator('#b').focus();
  await frame.locator('body').evaluate(() => new Promise(r => setTimeout(r, 300)));
  expect((await state(frame)).open).toBe(false);
  await frame.locator('#t').evaluate(el => { el.open = true; });
  await expect.poll(async () => (await state(frame)).hidden).toBe(false);
});

test('upstream quirk: a tooltip rendered with open ignores Escape until it is opened again', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-tooltip id="t" content="Tip" trigger="manual" open><button id="b">Target</button></sl-tooltip><input id="field">');
  await expect.poll(async () => state(frame)).toEqual({ open: true, hidden: false, active: true });
  await frame.locator('#field').focus();
  await frame.locator('#field').press('Escape');
  await frame.locator('body').evaluate(() => new Promise(r => setTimeout(r, 300)));
  // The first render shows it without the open handler, so neither CloseWatcher nor the keydown listener is installed.
  expect(await state(frame)).toEqual({ open: true, hidden: false, active: true });
  // Once it is closed and opened again, Escape hides it.
  await frame.locator('#t').evaluate(async el => { await el.hide(); await el.show(); });
  await frame.locator('#field').press('Escape');
  await expect.poll(async () => state(frame)).toEqual({ open: false, hidden: true, active: false });
});

test('Escape hides an open tooltip from anywhere in the document', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-tooltip id="t" content="Tip" trigger="manual"><button id="b">Target</button></sl-tooltip><input id="field">');
  await frame.locator('#t').evaluate(el => el.show());
  await frame.locator('#field').focus();
  await frame.locator('#field').press('Escape');
  await expect.poll(async () => state(frame)).toEqual({ open: false, hidden: true, active: false });
});

test('disabled: triggers do not show it; becoming disabled hides an open tooltip (quirk: open set while disabled stays true)', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-tooltip id="t" content="Tip" disabled><button id="b">Target</button></sl-tooltip>');
  await recordEvents(frame);
  await frame.locator('#b').focus();
  await frame.locator('body').evaluate(() => new Promise(r => setTimeout(r, 300)));
  expect(await state(frame)).toEqual({ open: true, hidden: true, active: false });
  expect(await eventTypes(frame)).toEqual([]);
  await frame.locator('#t').evaluate(el => { el.disabled = false; });
  await frame.locator('body').evaluate(() => new Promise(r => setTimeout(r, 300)));
  expect(await state(frame)).toEqual({ open: true, hidden: true, active: false });

  await mount(frame, '<sl-tooltip id="t" content="Tip" open><button id="b">Target</button></sl-tooltip>');
  await recordEvents(frame);
  expect((await state(frame)).hidden).toBe(false);
  await frame.locator('#t').evaluate(el => { el.disabled = true; });
  await expect.poll(() => eventTypes(frame)).toEqual(['sl-hide', 'sl-after-hide']);
  expect(await state(frame)).toEqual({ open: false, hidden: true, active: false });
});

test('show() and hide() resolve after the after-events and resolve to undefined at once when already in that state', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-tooltip id="t" content="Tip" trigger="manual"><button>Target</button></sl-tooltip>');
  const r = await frame.locator('#t').evaluate(async el => {
    const seen = [];
    el.addEventListener('sl-after-show', () => seen.push('after-show'));
    el.addEventListener('sl-after-hide', () => seen.push('after-hide'));
    const shown = el.show();
    const again = el.show();
    await shown;
    seen.push('show resolved');
    const againValue = await again;
    await el.hide();
    seen.push('hide resolved');
    return { seen, againValue, hideAgain: await el.hide() };
  });
  expect(r).toEqual({ seen: ['after-show', 'show resolved', 'after-hide', 'hide resolved'], againValue: undefined, hideAgain: undefined });
});

test('properties: defaults, reflection, options reposition, and removing a reflected attribute restores its initial value', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-tooltip id="t"><button>Target</button></sl-tooltip>');
  const r = await frame.locator('#t').evaluate(async el => {
    const defaults = [el.content, el.placement, el.disabled, el.distance, el.open, el.skidding, el.trigger, el.hoist, el.dir, el.lang];
    el.trigger = 'manual';
    el.open = true;
    await el.updateComplete;
    const openAttr = el.getAttribute('open');
    el.disabled = true;
    el.placement = 'right-end';
    el.distance = 12;
    el.skidding = 4;
    el.hoist = true;
    el.content = 'Changed';
    await el.updateComplete;
    const base = el.popup;
    const reflected = [openAttr, el.getAttribute('disabled'), el.hasAttribute('placement'), el.hasAttribute('distance'), el.hasAttribute('hoist')];
    const rendered = [base.placement, base.distance, base.skidding, base.strategy, el.shadowRoot.querySelector('slot[name="content"]').textContent];
    // Becoming disabled hid the open tooltip; set open again so that removing the attribute restores false.
    el.open = true;
    await el.updateComplete;
    el.removeAttribute('disabled');
    el.removeAttribute('open');
    await el.updateComplete;
    return { defaults, reflected, rendered, restored: [el.disabled, el.open] };
  });
  expect(r).toEqual({
    defaults: ['', 'top', false, 8, false, 0, 'hover focus', false, undefined, undefined],
    reflected: ['', '', false, false, false],
    rendered: ['right-end', 12, 4, 'fixed', 'Changed'],
    restored: [false, false],
  });
});

test('the content slot takes precedence over the content attribute', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-tooltip id="t" content="attr" open><span slot="content">slotted</span><button>Target</button></sl-tooltip>');
  const r = await frame.locator('#t').evaluate(el => el.shadowRoot.querySelector('slot[name="content"]').assignedElements().map(e => e.textContent));
  expect(r).toEqual(['slotted']);
  await expect(frame.locator('#t [slot="content"]')).toBeVisible();
});

test('core extensions kept: fixed-placement and toggle() work; arrow and anchor are accepted but have no effect; no core events', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-tooltip id="t" content="Tip" trigger="manual"><button>Target</button></sl-tooltip><span id="elsewhere">x</span>');
  const r = await frame.locator('#t').evaluate(async el => {
    const core = [];
    for (const type of ['tooltip-show', 'tooltip-after-show', 'tooltip-hide', 'tooltip-after-hide']) el.addEventListener(type, () => core.push(type));
    const defaults = [el.fixedPlacement, el.arrow, el.anchor];
    el.fixedPlacement = true;
    await el.updateComplete;
    const fixed = [el.getAttribute('fixed-placement'), el.popup.strategy];
    el.fixedPlacement = false;
    el.arrow = false;
    el.anchor = 'elsewhere';
    await el.updateComplete;
    const after = [el.popup.strategy, el.getAttribute('arrow'), el.popup.arrow, el.popup.anchor ?? null];
    const shown = new Promise(r => el.addEventListener('sl-after-show', r, { once: true }));
    el.toggle();
    await shown;
    const toggledOpen = el.open;
    const hidden = new Promise(r => el.addEventListener('sl-after-hide', r, { once: true }));
    el.toggle();
    await hidden;
    return { defaults, fixed, after, toggled: [toggledOpen, el.open], core };
  });
  expect(r).toEqual({
    defaults: [false, undefined, undefined],
    fixed: ['', 'fixed'],
    after: ['absolute', null, true, null],
    toggled: [true, false],
    core: [],
  });
});

test('dir and lang are reactive, not reflected and undefined by default, as Shoelace\'s base element declares them', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-tooltip id="t" content="Tip"><button>Target</button></sl-tooltip>');
  const r = await frame.locator('#t').evaluate(async el => {
    const before = [el.dir, el.lang];
    el.dir = 'rtl';
    el.lang = 'de';
    await el.updateComplete;
    return { before, after: [el.dir, el.lang], attrs: [el.getAttribute('dir'), el.getAttribute('lang')] };
  });
  expect(r).toEqual({ before: [undefined, undefined], after: ['rtl', 'de'], attrs: [null, null] });
});

test('upstream quirks matched: hidden does not hide it; the target is not linked to the tooltip by aria-describedby', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-tooltip id="t" content="Tip" hidden><button id="b">Target</button></sl-tooltip>');
  await expect(frame.locator('#b')).toBeVisible();
  expect(await frame.locator('#b').getAttribute('aria-describedby')).toBe(null);
});

test('inherited core ready event: dispatched once on the element after the first update, not bubbling or composed', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('body').evaluate(async body => {
    const el = document.createElement('sl-tooltip');
    const seen = [];
    let bubbled = 0;
    el.addEventListener('ready', event => seen.push({ bubbles: event.bubbles, composed: event.composed }));
    body.addEventListener('ready', () => bubbled++);
    body.append(el);
    await el.updateComplete;
    el.content = 'x';
    await el.updateComplete;
    el.remove();
    return { seen, bubbled };
  });
  expect(r).toEqual({ seen: [{ bubbles: false, composed: false }], bubbled: 0 });
});

test.describe('animation registry', () => {
  let outDir;
  test.beforeAll(async () => {
    outDir = await buildFixtures({
      registry: "export * from '@charm-ux/velcro/utilities/animation-registry';",
      tooltip: "export { SlTooltip } from '@charm-ux/velcro/tooltip';",
      root: "export * from '@charm-ux/velcro';",
    });
  });

  // Loads the three entries and records every Element.animate() call on a tooltip's popup in window.calls.
  async function setup(page) {
    await gotoBlank(page, outDir);
    await page.evaluate(async () => {
      window.registry = await import('/registry.js');
      window.root = await import('/root.js');
      await import('/tooltip.js');
      window.calls = [];
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (keyframes, options) {
        if (this.getAttribute('part') === 'popup') window.calls.push({ keyframes: JSON.parse(JSON.stringify(keyframes)), duration: options.duration, easing: options.easing });
        return animate.call(this, keyframes, options);
      };
      document.body.innerHTML = '<sl-tooltip id="a" content="A" trigger="manual"><button>A</button></sl-tooltip>'
        + '<sl-tooltip id="b" content="B" trigger="manual"><button>B</button></sl-tooltip>';
      await Promise.all([...document.querySelectorAll('sl-tooltip')].map(el => el.updateComplete));
      window.cycle = async id => {
        const el = document.getElementById(id);
        window.calls = [];
        await el.show();
        await el.hide();
        return window.calls;
      };
    });
  }

  test('the public module exports exactly setDefaultAnimation, setAnimation and getAnimation; the package root does not', async ({ page }) => {
    await setup(page);
    const r = await page.evaluate(() => ({
      keys: Object.keys(window.registry).sort(),
      root: ['setDefaultAnimation', 'setAnimation', 'getAnimation', 'animateTo', 'stopAnimations', 'parseDuration'].filter(k => k in window.root),
    }));
    expect(r).toEqual({ keys: ['getAnimation', 'setAnimation', 'setDefaultAnimation'], root: [] });
  });

  test('the tooltip uses Shoelace\'s defaults; setDefaultAnimation through the public path changes them for every tooltip', async ({ page }) => {
    await setup(page);
    expect(await page.evaluate(() => window.cycle('a'))).toEqual([
      { keyframes: [{ opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1 }], duration: 150, easing: 'ease' },
      { keyframes: [{ opacity: 1, scale: 1 }, { opacity: 0, scale: 0.8 }], duration: 150, easing: 'ease' },
    ]);
    const r = await page.evaluate(async () => {
      window.registry.setDefaultAnimation('tooltip.show', { keyframes: [{ opacity: 0.25 }, { opacity: 1 }], options: { duration: 20, easing: 'linear' } });
      return [await window.cycle('a'), await window.cycle('b')];
    });
    for (const calls of r) {
      expect(calls[0]).toEqual({ keyframes: [{ opacity: 0.25 }, { opacity: 1 }], duration: 20, easing: 'linear' });
      expect(calls[1].duration).toBe(150);
    }
  });

  test('an element\'s own animation beats the default, only for that element; null and unknown names are empty animations', async ({ page }) => {
    await setup(page);
    const r = await page.evaluate(async () => {
      const { setAnimation, getAnimation } = window.registry;
      const a = document.getElementById('a');
      setAnimation(a, 'tooltip.show', { keyframes: [{ opacity: 0.5 }, { opacity: 1 }], options: { duration: 30 } });
      setAnimation(a, 'tooltip.hide', null);
      return {
        a: await window.cycle('a'),
        b: await window.cycle('b'),
        unknown: getAnimation(a, 'tooltip.nope', { dir: 'ltr' }),
        nullHide: getAnimation(a, 'tooltip.hide', { dir: 'ltr' }),
      };
    });
    expect(r.a[0]).toEqual({ keyframes: [{ opacity: 0.5 }, { opacity: 1 }], duration: 30 });
    expect(r.a[1]).toEqual({ keyframes: [], duration: 0 });
    expect(r.b.map(c => c.duration)).toEqual([150, 150]);
    expect(r.unknown).toEqual({ keyframes: [], options: { duration: 0 } });
    expect(r.nullHide).toEqual({ keyframes: [], options: { duration: 0 } });
  });

  test('rtlKeyframes are used when the tooltip\'s direction is rtl, for both the default and an element\'s own animation', async ({ page }) => {
    await setup(page);
    const r = await page.evaluate(async () => {
      const { setDefaultAnimation, setAnimation, getAnimation } = window.registry;
      setDefaultAnimation('tooltip.show', { keyframes: [{ opacity: 0.1 }, { opacity: 1 }], rtlKeyframes: [{ opacity: 0.9 }, { opacity: 1 }], options: { duration: 10 } });
      // As Shoelace's localization controller does, the direction is the host's dir property (not reflected), so a
      // direction set only through the property is used.
      document.getElementById('b').dir = 'rtl';
      const ltr = await window.cycle('a');
      const rtl = await window.cycle('b');
      const own = { keyframes: [{ opacity: 0.2 }], rtlKeyframes: [{ opacity: 0.8 }], options: { duration: 5 } };
      setAnimation(document.getElementById('a'), 'custom', own);
      const a = document.getElementById('a');
      // The property beats a conflicting attribute: the attribute says rtl, the property set afterwards says ltr.
      a.setAttribute('dir', 'rtl');
      a.dir = 'ltr';
      const conflict = [a.getAttribute('dir'), (await window.cycle('a'))[0].keyframes];
      // With no host direction, the document's dir is used (case-insensitively, as upstream lower-cases it).
      a.removeAttribute('dir');
      a.dir = '';
      document.documentElement.dir = 'RTL';
      await new Promise(r => setTimeout(r));
      const fromDocument = (await window.cycle('a'))[0].keyframes;
      document.documentElement.dir = '';
      return {
        bAttr: document.getElementById('b').hasAttribute('dir'), conflict, fromDocument,
        ltr: ltr[0].keyframes, rtl: rtl[0].keyframes,
        ownLtr: getAnimation(document.getElementById('a'), 'custom', { dir: 'ltr' }).keyframes,
        ownRtl: getAnimation(document.getElementById('a'), 'custom', { dir: 'rtl' }).keyframes,
      };
    });
    expect(r).toEqual({
      bAttr: false, conflict: ['rtl', [{ opacity: 0.1 }, { opacity: 1 }]], fromDocument: [{ opacity: 0.9 }, { opacity: 1 }],
      ltr: [{ opacity: 0.1 }, { opacity: 1 }], rtl: [{ opacity: 0.9 }, { opacity: 1 }],
      ownLtr: [{ opacity: 0.2 }], ownRtl: [{ opacity: 0.8 }],
    });
  });

  test('one registry module: the exports, the built components and the docs bundle share a single copy; internal/animate is not exported', () => {
    const pkg = JSON.parse(readFileSync(path.join(velcroDir, 'package.json'), 'utf8'));
    expect(pkg.exports['./utilities/animation-registry']).toEqual({
      types: './dist/utilities/animation-registry.d.ts', import: './dist/utilities/animation-registry.js',
    });
    expect(Object.keys(pkg.exports).filter(k => /internal|animate\b/.test(k))).toEqual([]);
    // In the built package, only dist/utilities/animation-registry.js holds the registry; the tooltip imports it.
    const files = readdirSync(path.join(velcroDir, 'dist'), { recursive: true }).filter(f => f.endsWith('.js'));
    const holders = files.filter(f => readFileSync(path.join(velcroDir, 'dist', f), 'utf8').includes('defaultAnimationRegistry'));
    expect(holders).toEqual([path.join('utilities', 'animation-registry.js')]);
    expect(readFileSync(path.join(velcroDir, 'dist/components/tooltip/tooltip.js'), 'utf8')).toContain("from '../../utilities/animation-registry.js'");
    // The docs site and its example documents load Velcro from one bundle (velcro.js), which contains the registry once:
    // only it reads `.rtlKeyframes` (a property access that survives minification; the docs page's prose names it too).
    for (const dir of ['dist/client', 'dist/static/_litro']) {
      const bundles = readdirSync(path.join(docsDir, dir), { recursive: true }).filter(f => f.endsWith('.js'))
        .filter(f => /\.rtlKeyframes\b/.test(readFileSync(path.join(docsDir, dir, f), 'utf8')));
      expect(bundles, dir).toEqual(['velcro.js']);
    }
  });
});

test.describe('class-only entry', () => {
  let bundle;

  test.beforeAll(async () => {
    const fromDocs = createRequire(path.join(docsDir, 'package.json'));
    const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
    const dir = mkdtempSync(path.join(tmpdir(), 'velcro-tooltip-class-'));
    try {
      const entry = path.join(dir, 'entry.js');
      writeFileSync(entry, `
        import { SlTooltip, VelcroTooltip } from '@charm-ux/velcro/tooltip/class';
        window.tooltipClass = { SlTooltip, VelcroTooltip };
      `);
      const out = await build({
        configFile: false, logLevel: 'silent', root: dir,
        plugins: [{
          name: 'velcro-package-exports',
          async resolveId(id) {
            if (!id.startsWith('@charm-ux/velcro/')) return null;
            return (await this.resolve(id, path.join(docsDir, 'app.ts'), { skipSelf: true })) ?? null;
          },
        }],
        build: { write: false, minify: false, rollupOptions: { input: entry, output: { format: 'es', codeSplitting: false } } },
      });
      bundle = (Array.isArray(out) ? out[0] : out).output.find(o => o.type === 'chunk').code;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('importing defines nothing; constructing a tooltip defines Velcro\'s sl-popup, so the tooltip shows', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.setContent('<!DOCTYPE html><html><body></body></html>');
    await page.addScriptTag({ type: 'module', content: bundle });
    await page.waitForFunction(() => Boolean(window.tooltipClass));
    const r = await page.evaluate(async () => {
      const { SlTooltip, VelcroTooltip } = window.tooltipClass;
      const tags = () => ['sl-tooltip', 'sl-popup'].map(t => customElements.get(t)?.name ?? null);
      const afterImport = tags();
      customElements.define('sl-tooltip', SlTooltip);
      const el = document.createElement('sl-tooltip');
      el.content = 'Tip';
      el.innerHTML = '<button>Target</button>';
      document.body.append(el);
      await el.updateComplete;
      await el.show();
      return { same: SlTooltip === VelcroTooltip, afterImport, afterConstruct: tags(), shown: !el.body.hidden && el.popup.active };
    });
    expect(r).toEqual({ same: true, afterImport: [null, null], afterConstruct: ['VelcroTooltip', 'VelcroPopup'], shown: true });
    expect(pageErrors).toEqual([]);
  });
});

test('every docs example renders in its own document', async ({ page }) => {
  await openDocs(page, PAGE);
  const titles = await page.locator('iframe.example').evaluateAll(frames => frames.map(f => f.title));
  expect(titles).toEqual(EXAMPLES.map(([t]) => `Tooltip example: ${t}`));
  for (const title of titles) {
    const frame = page.frameLocator(`iframe.example[title="${title}"]`);
    await expect(frame.locator('sl-tooltip').first()).toBeAttached();
    expect(await frame.locator('sl-tooltip').first().evaluate(async el => {
      await customElements.whenDefined('sl-tooltip');
      await el.updateComplete;
      return Boolean(el.shadowRoot?.querySelector('[part~="base"]'));
    })).toBe(true);
  }
});

test('Manual Trigger example: the button toggles the avatar\'s tooltip', async ({ page }) => {
  const { frame } = await openExample(page, 'Manual Trigger');
  await frame.locator('sl-button').click();
  await expect.poll(() => frame.locator('.manual-tooltip').evaluate(el => el.open && !el.body.hidden)).toBe(true);
  await frame.locator('sl-button').click();
  await expect.poll(() => frame.locator('.manual-tooltip').evaluate(el => el.open || !el.body.hidden)).toBe(false);
});

test('no upstream Shoelace runtime is requested or defined; all requests stay on the local origin', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  expect(await frame.locator('body').evaluate(() => Boolean(window.Shoelace || document.querySelector('script[src*="shoelace"]')))).toBe(false);
});

// The values that matter in a rendered example, which an HTML example and its React version must share.
const summarize = () => [...document.querySelectorAll('sl-tooltip')].map(el => ({
  content: el.content, slotted: el.querySelector('[slot="content"]')?.textContent ?? null, placement: el.placement, trigger: el.trigger,
  hoist: el.hoist, open: el.open, maxWidth: el.style.getPropertyValue('--max-width'), arrow: getComputedStyle(el).getPropertyValue('--sl-tooltip-arrow-size').trim(),
  target: el.querySelector(':scope > :not([slot])')?.localName ?? null, base: el.shadowRoot.querySelector('[part~="base"]').className,
}));

// Shoelace's React examples, ported in packages/docs/examples/tooltip/react/*.jsx (the files the docs page shows),
// bundled with React 19 and the generated wrappers, which are resolved through the package's real export map.
test.describe('React examples', () => {
  const reactDir = fileURLToPath(new URL('../../packages/docs/examples/tooltip/react/', import.meta.url));
  let bundle;

  test.beforeAll(async () => {
    const fromVelcro = createRequire(path.join(velcroDir, 'package.json'));
    const fromDocs = createRequire(path.join(docsDir, 'package.json'));
    const pkgDir = name => path.dirname(fromVelcro.resolve(`${name}/package.json`));
    const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
    const dir = mkdtempSync(path.join(tmpdir(), 'velcro-tooltip-react-'));
    try {
      for (const [, name] of EXAMPLES) {
        writeFileSync(path.join(dir, `${name}.jsx`), `${readFileSync(path.join(reactDir, `${name}.jsx`), 'utf8')}\nexport default App;\n`);
      }
      const entry = path.join(dir, 'entry.js');
      writeFileSync(entry, `
        import React from 'react';
        import { createRoot } from 'react-dom/client';
        import { VelcroTooltip } from '@charm-ux/velcro/react/VelcroTooltip.js';
        ${EXAMPLES.map(([, name], i) => `import App${i} from './${name}.jsx';`).join('\n')}
        const apps = { ${EXAMPLES.map(([, name], i) => `${JSON.stringify(name)}: App${i}`).join(', ')} };
        window.errors = [];
        addEventListener('error', e => window.errors.push(String(e.message)));
        addEventListener('unhandledrejection', e => window.errors.push(String(e.reason)));
        window.reactVersion = React.version;
        window.wrapper = VelcroTooltip;
        window.renderExample = name => {
          const host = document.createElement('div');
          document.body.append(host);
          createRoot(host).render(React.createElement(apps[name]));
        };
      `);
      const out = await build({
        configFile: false, logLevel: 'silent', root: dir,
        plugins: [{
          name: 'velcro-package-exports',
          async resolveId(id) {
            if (!id.startsWith('@charm-ux/velcro/')) return null;
            return (await this.resolve(id, path.join(docsDir, 'app.ts'), { skipSelf: true })) ?? null;
          },
        }],
        resolve: { alias: { react: pkgDir('react'), 'react-dom': pkgDir('react-dom') } },
        define: { 'process.env.NODE_ENV': '"production"' },
        build: { write: false, minify: false, rollupOptions: { input: entry, output: { format: 'es', codeSplitting: false } } },
      });
      bundle = (Array.isArray(out) ? out[0] : out).output.find(o => o.type === 'chunk').code;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  async function load(page) {
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.setContent('<!DOCTYPE html><html class="sl-theme-light"><body style="margin: 0"></body></html>');
    await page.addStyleTag({ content: readFileSync(path.join(velcroDir, 'themes/light.css'), 'utf8') });
    await page.addScriptTag({ type: 'module', content: bundle });
    await page.waitForFunction(() => typeof window.renderExample === 'function');
    return pageErrors;
  }

  const settle = () => Promise.all([...document.querySelectorAll('sl-tooltip')].map(el => el.updateComplete))
    .then(() => new Promise(resolve => setTimeout(resolve, 50)));

  test('every React example renders the same tooltips as the HTML example it belongs to; the manual one toggles', async ({ page }) => {
    test.setTimeout(150_000);
    const htmlPage = await page.context().newPage();
    watchNetwork(htmlPage);
    const expected = {};
    try {
      await openDocs(htmlPage, PAGE);
      await documentsLoaded(htmlPage);
      for (const [title, name] of EXAMPLES) {
        const frame = frameFor(htmlPage, title);
        await expect(frame.locator('sl-tooltip').first()).toBeAttached();
        await frame.locator('body').evaluate(async () => {
          await customElements.whenDefined('sl-tooltip');
          await Promise.all([...document.querySelectorAll('sl-tooltip')].map(el => el.updateComplete));
          await new Promise(resolve => setTimeout(resolve, 50));
        });
        expected[name] = await frame.locator('body').evaluate(summarize);
      }
    } finally {
      await htmlPage.close();
    }
    const pageErrors = await load(page);
    expect(await page.evaluate(() => window.reactVersion)).toBe('19.2.0');
    for (const [, name] of EXAMPLES) {
      await page.evaluate(n => { document.body.replaceChildren(); window.renderExample(n); }, name);
      await page.waitForFunction(() => document.querySelector('sl-tooltip'));
      await page.evaluate(settle);
      const actual = await page.evaluate(summarize);
      expect(actual.length, name).toBeGreaterThan(0);
      if (name === 'removing-arrows') {
        // Shoelace's React Removing Arrows snippet differs upstream: two tooltips (top and bottom) in a container that sets
        // the arrow size, where the HTML example has one tooltip that sets it itself. Both remove the arrow.
        expect(actual.map(t => t.placement), name).toEqual(['top', 'bottom']);
        for (const t of actual) expect({ ...t, placement: 'top' }, name).toEqual(expected[name][0]);
      } else {
        expect(actual, name).toEqual(expected[name]);
      }
    }
    // Manual Trigger: the React version toggles open through state.
    await page.evaluate(() => { document.body.replaceChildren(); window.renderExample('manual-trigger'); });
    await page.waitForFunction(() => document.querySelector('sl-tooltip'));
    await page.evaluate(settle);
    await page.locator('sl-button').click();
    await expect.poll(() => page.locator('sl-tooltip').evaluate(el => el.open && !el.body.hidden)).toBe(true);
    expect(await page.evaluate(() => window.errors)).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
