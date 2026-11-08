// sl-alert product checks against Shoelace 2.20.1's alert contract: structure, styles, open/close and its events, the
// auto-hide timer and countdown, the toast stack (positioned by the themes' utility rules), the quirks matched, the
// kept core extensions, the class-only entry, the docs examples and their React versions.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';
import { buildFixtures, gotoBlank } from './support/fixtures.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/alert';
const docsDir = fileURLToPath(new URL('../../packages/docs/', import.meta.url));
const velcroDir = fileURLToPath(new URL('../../packages/velcro/', import.meta.url));

// The docs page's examples, in page order: the example's title, the name of its files under examples/alert/, and whether
// Shoelace's page has a React version of it.
const EXAMPLES = [
  ['Default', 'basic', true],
  ['Variants', 'variants', true],
  ['Closable', 'closable', true],
  ['Without Icons', 'without-icons', true],
  ['Duration', 'duration', true],
  ['Countdown', 'countdown', true],
  ['Toast Notifications', 'toast', true],
  ['Creating Toasts Imperatively', 'toast-imperative', false],
];
const VARIANTS = ['primary', 'success', 'neutral', 'warning', 'danger'];

const frameFor = (page, title) => page.frameLocator(`iframe.example[title="Alert example: ${title}"]`);

async function openExample(page, name = 'Default') {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  const frame = frameFor(page, name);
  await expect(frame.locator('sl-alert').first()).toBeAttached();
  await frame.locator('body').evaluate(() => customElements.whenDefined('sl-alert'));
  await documentsLoaded(page);
  return { frame, requests };
}

// Appends markup to the example document (replacing earlier mounts) and waits for every sl-alert in it to render.
async function mount(frame, markup) {
  await frame.locator('body').evaluate(async (body, markup) => {
    document.getElementById('mount')?.remove();
    const host = document.createElement('div');
    host.id = 'mount';
    host.innerHTML = markup;
    body.append(host);
    await Promise.all([...host.querySelectorAll('sl-alert')].map(el => el.updateComplete));
  }, markup);
}

// Records the sl-* and core alert-* events of #a (the mounted alert) in its own `events` array.
const recordEvents = frame => frame.locator('#a').evaluate(el => {
  const events = (el.events = []);
  for (const type of ['sl-show', 'sl-after-show', 'sl-hide', 'sl-after-hide', 'alert-show', 'alert-after-show', 'alert-hide', 'alert-after-hide']) {
    el.addEventListener(type, e => events.push({ type, bubbles: e.bubbles, composed: e.composed, cancelable: e.cancelable, detail: e.detail }));
  }
});
const eventTypes = frame => frame.locator('#a').evaluate(el => el.events.map(e => e.type));

// Resolves Shoelace theme tokens in the example document to the computed value of a CSS property.
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

test('docs page is prerendered with Velcro branding, prototype status, every Shoelace section, the quirks and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Alert - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('without changing the shared core prefix');
  expect(html).toContain('The Toast Stack');
  expect(html).toContain('.sl-toast-stack {');
  for (const [title] of EXAMPLES) expect(html).toContain(`title="Alert example: ${title}"`);
});

test('sl-alert registers as the exported class with sl-icon-button and sl-icon, no core marker and no ch-* definitions', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('#demo-default').evaluate(el => ({
    ctor: el.constructor === customElements.get('sl-alert'),
    deps: ['sl-icon-button', 'sl-icon'].map(t => Boolean(customElements.get(t))),
    ch: ['ch-alert', 'ch-icon', 'ch-button'].map(t => Boolean(customElements.get(t))),
    marker: el.getAttributeNames().filter(n => !['id', 'open', 'variant'].includes(n)),
  }));
  expect(r).toEqual({ ctor: true, deps: [true, true], ch: [false, false, false], marker: [] });
});

test('structure, parts and ARIA follow Shoelace: a role="alert" base with the icon and message parts, the hidden timer, no close button or countdown by default', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('#demo-default').evaluate(el => {
    const root = el.shadowRoot;
    const base = root.querySelector('[part~="base"]');
    return {
      base: [base.localName, base.className.trim().split(/\s+/).sort(), base.getAttribute('role'), base.getAttribute('aria-hidden'), base.hidden],
      children: [...base.children].map(c => [c.localName, c.getAttribute('part'), c.className, c.getAttribute('role'), c.getAttribute('aria-live')]),
      slots: [...root.querySelectorAll('slot')].map(s => s.name),
      timer: root.querySelector('.alert__timer').textContent,
      same: el.base === base,
    };
  });
  expect(r).toEqual({
    base: ['div', ['alert', 'alert--has-icon', 'alert--open', 'alert--primary'], 'alert', 'false', false],
    children: [
      ['div', 'icon', 'alert__icon', null, null],
      ['div', 'message', 'alert__message', null, 'polite'],
      ['div', null, 'alert__timer', 'timer', null],
    ],
    slots: ['icon', ''],
    timer: 'Infinity',
    same: true,
  });
  await mount(frame, '<sl-alert id="a">Closed</sl-alert>');
  expect(await frame.locator('#a').evaluate(el => [el.base.hidden, el.base.getAttribute('aria-hidden'), el.base.classList.contains('alert--has-icon')]))
    .toEqual([true, 'true', false]);
  await expect(frame.locator('#a')).toBeHidden();
});

test('computed styles match Shoelace: display contents, the panel colors, border, radius, font, padding and the variants\' top border', async ({ page }) => {
  const { frame } = await openExample(page, 'Variants');
  const [panelBg, panelBorder, radius, font, small, large, neutral700, spacingLarge, borderWidth, ...variantColors] = await Promise.all([
    tokens(frame, 'background-color', ['--sl-panel-background-color']),
    tokens(frame, 'border-color', ['--sl-panel-border-color']),
    tokens(frame, 'border-radius', ['--sl-border-radius-medium']),
    tokens(frame, 'font-family', ['--sl-font-sans']),
    tokens(frame, 'font-size', ['--sl-font-size-small']),
    tokens(frame, 'font-size', ['--sl-font-size-large']),
    tokens(frame, 'color', ['--sl-color-neutral-700']),
    tokens(frame, 'padding-top', ['--sl-spacing-large']),
    tokens(frame, 'width', ['--sl-panel-border-width']),
    ...VARIANTS.map(v => tokens(frame, 'color', [`--sl-color-${v}-600`])),
  ]).then(all => all.map(([v]) => v));
  const styles = await frame.locator('sl-alert').evaluateAll(els => els.map(el => {
    const base = getComputedStyle(el.base);
    const icon = getComputedStyle(el.shadowRoot.querySelector('[part~="icon"]'));
    const message = getComputedStyle(el.shadowRoot.querySelector('[part~="message"]'));
    return {
      host: getComputedStyle(el).display, display: base.display, bg: base.backgroundColor, border: [base.borderRightColor, base.borderRightWidth, base.borderTopWidth],
      top: base.borderTopColor, radius: base.borderTopLeftRadius, font: [base.fontFamily, base.fontSize, base.color], icon: [icon.color, icon.fontSize], padding: message.paddingTop,
    };
  }));
  expect(styles).toHaveLength(5);
  const px = v => parseFloat(v);
  styles.forEach((s, i) => {
    expect(s).toEqual({
      host: 'contents', display: 'flex', bg: panelBg, border: [panelBorder, borderWidth, `${px(borderWidth) * 3}px`],
      top: variantColors[i], radius, font: [font, small, neutral700], icon: [variantColors[i], large], padding: spacingLarge,
    });
  });
});

test('show() and hide() emit sl-show, sl-after-show, sl-hide and sl-after-hide (bubbling, composed, not cancelable), resolve after them, and resolve at once when already in that state', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-alert id="a">Message</sl-alert>');
  await recordEvents(frame);
  const r = await frame.locator('#a').evaluate(async el => {
    const shown = await el.show();
    const afterShow = [el.open, el.base.hidden, el.events.length];
    const again = await el.show();
    const hidden = await el.hide();
    const afterHide = [el.open, el.base.hidden, el.getAttribute('open')];
    const hideAgain = await el.hide();
    return { shown, again, hidden, hideAgain, afterShow, afterHide, events: el.events };
  });
  const flags = { bubbles: true, composed: true, cancelable: false, detail: {} };
  expect(r).toEqual({
    shown: undefined, again: undefined, hidden: undefined, hideAgain: undefined,
    afterShow: [true, false, 2], afterHide: [false, true, null],
    events: ['sl-show', 'sl-after-show', 'sl-hide', 'sl-after-hide'].map(type => ({ type, ...flags })),
  });
  // Setting the property or the attribute does the same.
  await frame.locator('#a').evaluate(async el => {
    el.events.length = 0;
    el.setAttribute('open', '');
    await new Promise(resolve => el.addEventListener('sl-after-show', resolve, { once: true }));
    el.open = false;
    await new Promise(resolve => el.addEventListener('sl-after-hide', resolve, { once: true }));
  });
  expect(await eventTypes(frame)).toEqual(['sl-show', 'sl-after-show', 'sl-hide', 'sl-after-hide']);
});

test('hiding blurs the focused element inside the alert (Shoelace\'s blurActiveElement); focus elsewhere is left alone', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<button id="outside">Outside</button><sl-alert id="a" open><button id="inside">Inside</button></sl-alert>');
  // Focus through Playwright, which also focuses the example's frame (a script focus() in an unfocused frame does not
  // move document.activeElement in every engine).
  await frame.locator('#inside').focus();
  const r = await frame.locator('#a').evaluate(async el => {
    const before = document.activeElement.id;
    await el.hide();
    return { before, after: document.activeElement === document.body };
  });
  expect(r).toEqual({ before: 'inside', after: true });
  await frame.locator('#a').evaluate(el => el.show());
  await frame.locator('#outside').focus();
  expect(await frame.locator('#a').evaluate(async el => {
    await el.hide();
    return document.activeElement.id;
  })).toBe('outside');
});

test('closable: an sl-icon-button with the x-lg system icon, the localized Close label and the exported base part; clicking it closes the alert', async ({ page }) => {
  const { frame } = await openExample(page, 'Closable');
  const alert = frame.locator('sl-alert');
  const r = await alert.evaluate(el => {
    const button = el.shadowRoot.querySelector('[part~="close-button"]');
    return [button.localName, button.className, button.getAttribute('exportparts'), button.name, button.library, button.label,
      button.constructor === customElements.get('sl-icon-button'), el.base.classList.contains('alert--closable')];
  });
  expect(r).toEqual(['sl-icon-button', 'alert__close-button', 'base:close-button__base', 'x-lg', 'system', 'Close', true, true]);
  await expect(alert.locator('sl-icon-button [part~="base"]')).toHaveAccessibleName('Close');
  await expect(alert.locator('sl-icon-button [part~="base"]')).toHaveRole('button');
  await alert.locator('sl-icon-button').click();
  await expect.poll(() => alert.evaluate(el => [el.open, el.base.hidden])).toEqual([false, true]);
  // The example reopens it two seconds after it hides.
  await expect.poll(() => alert.evaluate(el => el.open)).toBe(true);
  // Toggling closable at runtime adds and removes the button.
  expect(await alert.evaluate(async el => {
    el.closable = false;
    await el.updateComplete;
    return [el.shadowRoot.querySelector('sl-icon-button'), el.hasAttribute('closable')];
  })).toEqual([null, false]);
});

test('duration: the alert hides itself; hovering pauses the timer and leaving resumes it with the time left (upstream quirk: not a restart)', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-alert id="a" duration="1000">Message</sl-alert>');
  await recordEvents(frame);
  const r = await frame.locator('#a').evaluate(async el => {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const t0 = performance.now();
    await el.show();
    await new Promise(resolve => el.addEventListener('sl-hide', resolve, { once: true }));
    const plain = performance.now() - t0;
    // Paused: nothing happens while the pointer is over the base. The timer starts at sl-show.
    const started = new Promise(resolve => el.addEventListener('sl-show', () => resolve(performance.now()), { once: true }));
    el.show();
    const ts = await started;
    await wait(500);
    el.base.dispatchEvent(new MouseEvent('mouseenter'));
    const ran = performance.now() - ts;
    await wait(1200);
    const stillOpen = el.open;
    const t1 = performance.now();
    el.base.dispatchEvent(new MouseEvent('mouseleave'));
    await new Promise(resolve => el.addEventListener('sl-hide', resolve, { once: true }));
    return { plain, stillOpen, ran, resumed: performance.now() - t1 };
  });
  expect(r.plain).toBeGreaterThanOrEqual(950);
  expect(r.stillOpen).toBe(true);
  // What was left (the remaining time counts down in 100 ms steps, so up to 100 ms more than 1000 - ran); a restart would
  // take the full 1000 ms.
  expect(r.resumed).toBeLessThan(1000 - r.ran + 250);
  expect(r.resumed).toBeGreaterThan(1000 - r.ran - 250);
  expect(r.resumed).toBeLessThan(850);
});

test('countdown: the elapsed bar animates from 100% to 0 over the duration; ltr adds alert__countdown--ltr; the base gets alert--has-countdown', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-alert id="a" duration="5000" countdown="ltr">Message</sl-alert>');
  const r = await frame.locator('#a').evaluate(async el => {
    await el.show();
    const bar = el.shadowRoot.querySelector('.alert__countdown');
    const elapsed = el.countdownElement;
    const anim = elapsed.getAnimations()[0];
    const timing = anim.effect.getTiming();
    const keyframes = anim.effect.getKeyframes().map(k => k.width);
    const timer = Number(el.shadowRoot.querySelector('[role="timer"]').textContent);
    return { bar: bar.className.trim().split(/\s+/), classes: el.base.classList.contains('alert--has-countdown'), timing: [timing.duration, timing.easing], keyframes, timer, elapsed: elapsed.className };
  });
  expect(r.bar).toEqual(['alert__countdown', 'alert__countdown--ltr']);
  expect(r).toMatchObject({ classes: true, timing: [5000, 'linear'], keyframes: ['100%', '0px'], elapsed: 'alert__countdown-elapsed' });
  expect(r.timer).toBeLessThanOrEqual(5000);
  expect(r.timer).toBeGreaterThan(4000);
});

test('upstream quirk: an alert in markup with open, a finite duration and countdown does not render, because its first update throws', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('body').evaluate(async body => {
    const host = document.createElement('div');
    host.innerHTML = '<sl-alert open duration="3000" countdown="rtl">Message</sl-alert>';
    const el = host.firstElementChild;
    let error = null;
    body.append(host);
    try {
      await el.updateComplete;
    } catch (e) {
      error = e.name;
    }
    const base = el.shadowRoot.querySelector('[part~="base"]');
    host.remove();
    return { error, base };
  });
  expect(r).toEqual({ error: 'TypeError', base: null });
});

test('upstream quirk: setting countdown and a finite duration in one update of an open alert throws the same way', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-alert id="a" open>Message</sl-alert>');
  const r = await frame.locator('#a').evaluate(async el => {
    el.countdown = 'rtl';
    el.duration = 5000;
    let error = null;
    try {
      await el.updateComplete;
    } catch (e) {
      error = e.name;
    }
    return { error, bar: el.shadowRoot.querySelector('.alert__countdown') };
  });
  expect(r).toEqual({ error: 'TypeError', bar: null });
});

test('upstream quirk: removing the duration attribute sets duration to null, which hides an open alert at once', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-alert id="a" duration="100000">Message</sl-alert>');
  const r = await frame.locator('#a').evaluate(async el => {
    await el.show();
    const hid = new Promise(resolve => el.addEventListener('sl-hide', resolve, { once: true }));
    el.removeAttribute('duration');
    const t = performance.now();
    await hid;
    return { duration: el.duration, ms: performance.now() - t };
  });
  expect(r.duration).toBe(null);
  expect(r.ms).toBeLessThan(1000);
});

test('toast(): moves the alert into a body-level .sl-toast-stack positioned by the theme, shows it, and on hide removes it and the empty stack before resolving', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-alert id="a" closable>Toast</sl-alert>');
  const r = await frame.locator('#a').evaluate(async el => {
    const done = el.toast();
    await new Promise(resolve => el.addEventListener('sl-after-show', resolve, { once: true }));
    const stack = document.querySelector('.sl-toast-stack');
    const cs = getComputedStyle(stack);
    const probe = document.createElement('div');
    probe.style.zIndex = 'var(--sl-z-index-toast)';
    document.body.append(probe);
    const z = getComputedStyle(probe).zIndex;
    probe.remove();
    const shown = {
      parent: el.parentElement === stack, inBody: stack.parentElement === document.body, open: el.open,
      style: [cs.position, cs.top, cs.zIndex === z, cs.width, cs.maxHeight, cs.overflowY, cs.maxWidth],
      shadow: getComputedStyle(el.base).boxShadow !== 'none', margin: getComputedStyle(el.base).marginTop,
    };
    await el.hide();
    const resolved = await Promise.race([done.then(() => 'resolved'), new Promise(resolve => setTimeout(() => resolve('pending'), 500))]);
    return { shown, resolved, connected: el.isConnected, stack: document.querySelectorAll('.sl-toast-stack').length };
  });
  expect(r.shown.parent && r.shown.inBody && r.shown.open).toBe(true);
  expect(r.shown.style.slice(0, 3)).toEqual(['fixed', '0px', true]);
  expect(r.shown.style[3]).toBe(`${28 * 16}px`);
  expect(r.shown.style.slice(5)).toEqual(['auto', '100%']);
  expect(r.shown.shadow).toBe(true);
  expect(r.shown.margin).not.toBe('0px');
  expect(r).toMatchObject({ resolved: 'resolved', connected: false, stack: 0 });
});

test('toast(): toasts stack in one shared stack, which stays until the last one is gone; a stored alert can be toasted again', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-alert id="a">One</sl-alert><sl-alert id="b">Two</sl-alert>');
  const r = await frame.locator('body').evaluate(async () => {
    const a = document.getElementById('a');
    const b = document.getElementById('b');
    const shown = el => new Promise(resolve => el.addEventListener('sl-after-show', resolve, { once: true }));
    const pa = a.toast();
    await shown(a);
    const pb = b.toast();
    await shown(b);
    const stacks = document.querySelectorAll('.sl-toast-stack');
    const order = [...stacks[0].children].map(c => c.id);
    await a.hide();
    await pa;
    const afterOne = [document.querySelectorAll('.sl-toast-stack').length, b.parentElement === stacks[0]];
    await b.hide();
    await pb;
    const afterBoth = document.querySelectorAll('.sl-toast-stack').length;
    const again = a.toast();
    await shown(a);
    const reused = [a.parentElement.className, a.open];
    await a.hide();
    await again;
    return { stacks: stacks.length, order, afterOne, afterBoth, reused, end: document.querySelectorAll('.sl-toast-stack').length };
  });
  expect(r).toEqual({ stacks: 1, order: ['a', 'b'], afterOne: [1, true], afterBoth: 0, reused: ['sl-toast-stack', true], end: 0 });
});

test('upstream quirk: calling toast() twice on a shown toast makes its hide throw a NotFoundError from the second listener', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-alert id="a">Twice</sl-alert>');
  const r = await frame.locator('#a').evaluate(async el => {
    const errors = [];
    const onError = e => { errors.push(e.error?.name ?? String(e.message)); e.preventDefault(); };
    window.addEventListener('error', onError);
    el.toast();
    await new Promise(resolve => el.addEventListener('sl-after-show', resolve, { once: true }));
    el.toast();
    await el.hide();
    await new Promise(resolve => setTimeout(resolve, 50));
    window.removeEventListener('error', onError);
    return { errors, connected: el.isConnected, stacks: document.querySelectorAll('.sl-toast-stack').length };
  });
  expect(r).toEqual({ errors: ['NotFoundError'], connected: false, stacks: 0 });
});

test('both themes carry Shoelace\'s utility rules for the toast stack and scroll lock', () => {
  for (const name of ['light', 'dark']) {
    const css = readFileSync(path.join(velcroDir, `themes/${name}.css`), 'utf8');
    expect(css, name).toContain('.sl-toast-stack {');
    expect(css, name).toContain('.sl-toast-stack sl-alert::part(base) {');
    expect(css, name).toContain('.sl-scroll-lock {');
    expect(css, name).not.toContain('/* _utility.css */');
  }
});

test('upstream quirks matched: hidden does not hide an open alert; a variant outside the list gets no variant class or color', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-alert id="a" open hidden>Hidden attribute</sl-alert><sl-alert id="b" open variant="info"><span slot="icon">!</span>Unknown</sl-alert>');
  await expect(frame.locator('#a')).toBeVisible();
  const [panelBorder] = await tokens(frame, 'border-color', ['--sl-panel-border-color']);
  const r = await frame.locator('#b').evaluate(el => ({
    variant: [el.variant, el.getAttribute('variant')],
    classes: [...el.base.classList].filter(c => c.startsWith('alert--')).sort(),
    top: getComputedStyle(el.base).borderTopColor,
    icon: getComputedStyle(el.shadowRoot.querySelector('[part~="icon"]')).color === getComputedStyle(el.base).color,
  }));
  expect(r).toEqual({ variant: ['info', 'info'], classes: ['alert--has-icon', 'alert--open'], top: panelBorder, icon: true });
});

test('properties: Shoelace\'s defaults and reflection; removing a reflected attribute restores its first-render value', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-alert id="a">Message</sl-alert>');
  const r = await frame.locator('#a').evaluate(async el => {
    const defaults = [el.open, el.closable, el.variant, el.duration, el.countdown];
    el.closable = true;
    el.variant = 'danger';
    el.countdown = 'ltr';
    await el.updateComplete;
    el.open = true;
    el.duration = 100000;
    await el.updateComplete;
    const attrs = ['open', 'closable', 'variant', 'countdown', 'duration'].map(a => el.getAttribute(a));
    el.removeAttribute('variant');
    el.removeAttribute('countdown');
    el.removeAttribute('closable');
    await el.updateComplete;
    const restored = [el.variant, el.countdown, el.closable, el.getAttribute('variant')];
    const observed = customElements.get('sl-alert').observedAttributes.slice().sort();
    await el.hide();
    return { defaults, attrs, restored, observed };
  });
  expect(r).toEqual({
    defaults: [false, false, 'primary', Infinity, undefined],
    attrs: ['', '', 'danger', 'ltr', null],
    // countdown had no value at the first attribute change, so removing it leaves null (no countdown), as in Shoelace.
    restored: ['primary', null, false, 'primary'],
    observed: ['closable', 'closelabel', 'countdown', 'dir', 'dismissible', 'duration', 'heading', 'lang', 'open', 'politeness', 'variant'],
  });
});

test('core extensions kept: toggle() works; dismissible, closeLabel, heading and politeness are accepted without effect; no core events', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-alert id="a" dismissible closelabel="Dismiss" heading="Title" politeness="assertive">Message</sl-alert>');
  await recordEvents(frame);
  const r = await frame.locator('#a').evaluate(async el => {
    const props = [el.dismissible, el.closeLabel, el.heading, el.politeness, el.getAttribute('dismissible')];
    el.toggle();
    await new Promise(resolve => el.addEventListener('sl-after-show', resolve, { once: true }));
    const opened = el.open;
    const root = el.shadowRoot;
    const markup = {
      button: root.querySelector('sl-icon-button'), heading: root.textContent.includes('Title'),
      live: root.querySelector('[part~="message"]').getAttribute('aria-live'),
    };
    el.toggle();
    await new Promise(resolve => el.addEventListener('sl-after-hide', resolve, { once: true }));
    return { props, opened, closed: el.open, markup };
  });
  expect(r).toEqual({ props: [true, 'Dismiss', 'Title', 'assertive', ''], opened: true, closed: false, markup: { button: null, heading: false, live: 'polite' } });
  expect(await eventTypes(frame)).toEqual(['sl-show', 'sl-after-show', 'sl-hide', 'sl-after-hide']);
});

test('dir and lang are reactive, not reflected and undefined by default, as Shoelace\'s base element declares them', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-alert id="a">Message</sl-alert>');
  const r = await frame.locator('#a').evaluate(async el => {
    const before = [el.dir, el.lang];
    el.dir = 'rtl';
    el.lang = 'de';
    await el.updateComplete;
    return { before, after: [el.dir, el.lang], attrs: [el.getAttribute('dir'), el.getAttribute('lang')] };
  });
  expect(r).toEqual({ before: [undefined, undefined], after: ['rtl', 'de'], attrs: [null, null] });
});

test('animations: Shoelace\'s alert.show and alert.hide default keyframes and easing run on the base', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-alert id="a">Message</sl-alert>');
  const r = await frame.locator('#a').evaluate(async el => {
    const seen = [];
    const animate = el.base.animate.bind(el.base);
    el.base.animate = (keyframes, options) => {
      seen.push({ keyframes: keyframes.map(k => [k.opacity, k.scale]), duration: options.duration, easing: options.easing });
      return animate(keyframes, options);
    };
    await el.show();
    await el.hide();
    return seen;
  });
  // A reduced-motion preference turns the duration to 0 (animateTo), so the keyframes are what is compared.
  expect(r.map(a => a.keyframes)).toEqual([[[0, 0.8], [1, 1]], [[1, 1], [0, 0.8]]]);
  expect(r.map(a => a.easing)).toEqual(['ease', 'ease']);
});

test.describe('animation direction', () => {
  let outDir;
  test.beforeAll(async () => {
    outDir = await buildFixtures({
      registry: "export * from '@charm-ux/velcro/utilities/animation-registry';",
      alert: "export { SlAlert } from '@charm-ux/velcro/alert';",
    });
  });

  // Loads the entries, gives #a its own show and hide animations with distinct ltr and rtl keyframes, and records the
  // keyframes of every Element.animate() call on an alert's base in window.calls.
  async function setup(page) {
    await gotoBlank(page, outDir);
    await page.evaluate(async () => {
      window.registry = await import('/registry.js');
      await import('/alert.js');
      window.calls = [];
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (keyframes, options) {
        if (this.classList.contains('alert')) window.calls.push(JSON.parse(JSON.stringify(keyframes))[0].opacity);
        return animate.call(this, keyframes, options);
      };
      document.documentElement.dir = 'ltr';
      document.body.innerHTML = '<sl-alert id="a">Message</sl-alert>';
      const el = document.getElementById('a');
      await el.updateComplete;
      const { setAnimation } = window.registry;
      setAnimation(el, 'alert.show', { keyframes: [{ opacity: 0.1 }, { opacity: 1 }], rtlKeyframes: [{ opacity: 0.9 }, { opacity: 1 }], options: { duration: 10 } });
      setAnimation(el, 'alert.hide', { keyframes: [{ opacity: 0.2 }, { opacity: 0 }], rtlKeyframes: [{ opacity: 0.8 }, { opacity: 0 }], options: { duration: 10 } });
      await new Promise(r => setTimeout(r));
    });
  }

  test('the document direction is the controller\'s snapshot, as in Shoelace: a change in the same task as show() is not seen until the observer runs', async ({ page }) => {
    await setup(page);
    const r = await page.evaluate(async () => {
      const el = document.getElementById('a');
      // Queued in sl-show, this runs before show()'s continuation reads the direction; the document observer's
      // callback, which refreshes the snapshot, is queued behind that continuation.
      el.addEventListener('sl-show', () => queueMicrotask(() => { document.documentElement.dir = 'rtl'; }), { once: true });
      await el.show();
      const shown = window.calls.slice();
      window.calls = [];
      await el.hide();
      const hidden = window.calls.slice();
      document.documentElement.dir = 'ltr';
      await new Promise(r => setTimeout(r));
      return { shown, hidden };
    });
    // Shown with the stale ltr snapshot; hidden after the observer refreshed it to rtl.
    expect(r).toEqual({ shown: [0.1], hidden: [0.8] });
  });

  test('the host\'s dir property (not reflected) beats the document; with no host direction the document snapshot is used, lower-cased', async ({ page }) => {
    await setup(page);
    const r = await page.evaluate(async () => {
      const el = document.getElementById('a');
      const cycle = async () => {
        window.calls = [];
        await el.show();
        await el.hide();
        return window.calls.slice();
      };
      el.dir = 'rtl';
      const property = [el.hasAttribute('dir'), await cycle()];
      el.dir = '';
      document.documentElement.dir = 'RTL';
      await new Promise(r => setTimeout(r));
      const fromDocument = await cycle();
      document.documentElement.dir = 'ltr';
      await new Promise(r => setTimeout(r));
      return { property, fromDocument, ltr: await cycle() };
    });
    expect(r).toEqual({ property: [false, [0.9, 0.8]], fromDocument: [0.9, 0.8], ltr: [0.1, 0.2] });
  });
});

test('inherited core ready event: dispatched once on the element after the first update, not bubbling or composed', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('body').evaluate(async body => {
    const el = document.createElement('sl-alert');
    const seen = [];
    let bubbled = 0;
    el.addEventListener('ready', event => seen.push({ bubbles: event.bubbles, composed: event.composed }));
    body.addEventListener('ready', () => bubbled++);
    body.append(el);
    await el.updateComplete;
    el.variant = 'danger';
    await el.updateComplete;
    el.remove();
    return { seen, bubbled };
  });
  expect(r).toEqual({ seen: [{ bubbles: false, composed: false }], bubbled: 0 });
});

test('accessibility tree (Playwright ARIA snapshot): an open alert is an alert with its text; a closable one adds a Close button; a closed one is not exposed', async ({ page }) => {
  const { frame } = await openExample(page, 'Closable');
  await expect(frame.locator('sl-alert')).toMatchAriaSnapshot(`
    - alert:
      - text: You can close this alert any time!
      - button "Close"
  `);
  await mount(frame, '<sl-alert id="a">Closed</sl-alert>');
  await expect(frame.locator('#a').getByRole('alert')).toHaveCount(0);
  await expect(frame.locator('#a').getByText('Closed')).toBeHidden();
});

test('keyboard: the close button is a tab stop and Enter closes the alert; Escape does nothing', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<button id="before">before</button><sl-alert id="a" open closable>Message</sl-alert>');
  await frame.locator('#before').focus();
  await page.keyboard.press('Tab');
  expect(await frame.locator('#a').evaluate(el => el.shadowRoot.activeElement?.localName ?? null)).toBe('sl-icon-button');
  await page.keyboard.press('Escape');
  expect(await frame.locator('#a').evaluate(el => el.open)).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(() => frame.locator('#a').evaluate(el => [el.open, el.base.hidden])).toEqual([false, true]);
});

test.describe('class-only entry', () => {
  let bundle;

  test.beforeAll(async () => {
    const fromDocs = createRequire(path.join(docsDir, 'package.json'));
    const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
    const dir = mkdtempSync(path.join(tmpdir(), 'velcro-alert-class-'));
    try {
      const entry = path.join(dir, 'entry.js');
      writeFileSync(entry, `
        import { SlAlert, VelcroAlert } from '@charm-ux/velcro/alert/class';
        window.alertClass = { SlAlert, VelcroAlert };
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

  test('importing defines nothing; constructing an alert defines Velcro\'s sl-icon-button, which defines sl-icon, so the close button renders', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.setContent('<!DOCTYPE html><html><body></body></html>');
    await page.addScriptTag({ type: 'module', content: bundle });
    await page.waitForFunction(() => Boolean(window.alertClass));
    const r = await page.evaluate(async () => {
      const { SlAlert, VelcroAlert } = window.alertClass;
      const tags = () => ['sl-alert', 'sl-icon-button', 'sl-icon'].map(t => customElements.get(t)?.name ?? null);
      const afterImport = tags();
      customElements.define('sl-alert', SlAlert);
      const el = document.createElement('sl-alert');
      el.closable = true;
      el.textContent = 'Message';
      document.body.append(el);
      await el.updateComplete;
      await el.show();
      const button = el.shadowRoot.querySelector('sl-icon-button');
      await button.updateComplete;
      return { same: SlAlert === VelcroAlert, afterImport, afterConstruct: tags(), icon: Boolean(button.shadowRoot.querySelector('sl-icon')) };
    });
    expect(r).toEqual({ same: true, afterImport: [null, null, null], afterConstruct: ['VelcroAlert', 'VelcroIconButton', 'VelcroIcon'], icon: true });
    expect(pageErrors).toEqual([]);
  });
});

test('the examples render in their own documents in Shoelace\'s order', async ({ page }) => {
  await openDocs(page, PAGE);
  const titles = await page.locator('iframe.example').evaluateAll(frames => frames.map(f => f.title));
  expect(titles).toEqual(EXAMPLES.map(([t]) => `Alert example: ${t}`));
  for (const title of titles) {
    const frame = page.frameLocator(`iframe.example[title="${title}"]`);
    await expect(frame.locator('sl-button, sl-alert').first()).toBeAttached();
    expect(await frame.locator('body').evaluate(async () => {
      await customElements.whenDefined('sl-alert');
      const alerts = [...document.querySelectorAll('sl-alert')];
      await Promise.all(alerts.map(el => el.updateComplete));
      return alerts.every(el => Boolean(el.shadowRoot?.querySelector('[part~="base"]')));
    })).toBe(true);
  }
});

test('Duration and Countdown examples: the button shows the alert; Toast examples: the buttons make toasts in the stack', async ({ page }) => {
  const { frame } = await openExample(page, 'Duration');
  await frame.locator('sl-button').click();
  await expect.poll(() => frame.locator('sl-alert').evaluate(el => el.open && !el.base.hidden)).toBe(true);
  const countdown = frameFor(page, 'Countdown');
  await countdown.locator('sl-button').click();
  await expect.poll(() => countdown.locator('sl-alert').evaluate(el => el.open && el.countdownElement.getAnimations().length)).toBe(1);
  const toast = frameFor(page, 'Toast Notifications');
  await toast.locator('sl-button[variant="success"]').click();
  await expect.poll(() => toast.locator('body').evaluate(() => [...document.querySelectorAll('.sl-toast-stack sl-alert')].map(a => [a.variant, a.open]))).toEqual([['success', true]]);
  const imperative = frameFor(page, 'Creating Toasts Imperatively');
  await imperative.locator('sl-button').click();
  await imperative.locator('sl-button').click();
  await expect.poll(() => imperative.locator('body').evaluate(() => [...document.querySelectorAll('.sl-toast-stack sl-alert')].map(a => a.textContent.trim()))).toEqual(['This is custom toast #1', 'This is custom toast #2']);
});

test('no upstream Shoelace runtime is requested or defined; all requests stay on the local origin', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  expect(await frame.locator('body').evaluate(() => Boolean(window.Shoelace || document.querySelector('script[src*="shoelace"]')))).toBe(false);
});

// The values that matter in a rendered example, which an HTML example and its React version must share. Shoelace's React
// examples pass duration="3000" as a string, which the wrapper sets as the property as given (a string that compares as
// a number), so the duration is compared as a number.
const summarize = () => [...document.querySelectorAll('sl-alert')].map(el => ({
  variant: el.variant, open: el.open, closable: el.closable, duration: Number(el.duration), countdown: el.countdown ?? null,
  icon: el.querySelector('[slot="icon"]')?.getAttribute('name') ?? null, text: el.textContent.replace(/\s+/g, ''),
  base: el.shadowRoot.querySelector('[part~="base"]').className.trim().split(/\s+/).sort(),
}));

// Shoelace's React examples, ported in packages/docs/examples/alert/react/*.jsx (the files the docs page shows),
// bundled with React 19 and the generated wrappers, which are resolved through the package's real export map.
test.describe('React examples', () => {
  const reactDir = fileURLToPath(new URL('../../packages/docs/examples/alert/react/', import.meta.url));
  const REACT = EXAMPLES.filter(([, , react]) => react);
  let bundle;

  test.beforeAll(async () => {
    const fromVelcro = createRequire(path.join(velcroDir, 'package.json'));
    const fromDocs = createRequire(path.join(docsDir, 'package.json'));
    const pkgDir = name => path.dirname(fromVelcro.resolve(`${name}/package.json`));
    const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
    const dir = mkdtempSync(path.join(tmpdir(), 'velcro-alert-react-'));
    try {
      for (const [, name] of REACT) {
        writeFileSync(path.join(dir, `${name}.jsx`), `${readFileSync(path.join(reactDir, `${name}.jsx`), 'utf8')}\nexport default App;\n`);
      }
      const entry = path.join(dir, 'entry.js');
      writeFileSync(entry, `
        import React from 'react';
        import { createRoot } from 'react-dom/client';
        ${REACT.map(([, name], i) => `import App${i} from './${name}.jsx';`).join('\n')}
        const apps = { ${REACT.map(([, name], i) => `${JSON.stringify(name)}: App${i}`).join(', ')} };
        window.errors = [];
        addEventListener('error', e => window.errors.push(String(e.message)));
        addEventListener('unhandledrejection', e => window.errors.push(String(e.reason)));
        window.reactVersion = React.version;
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

  const settle = () => customElements.whenDefined('sl-alert')
    .then(() => Promise.all([...document.querySelectorAll('sl-alert')].map(el => el.updateComplete)))
    .then(() => new Promise(resolve => setTimeout(resolve, 50)));

  for (const [title, name] of REACT) {
    test(`React ${title} example renders the same alerts as the HTML example`, async ({ page }) => {
      const htmlPage = await page.context().newPage();
      watchNetwork(htmlPage);
      let expected;
      try {
        await openDocs(htmlPage, PAGE);
        const frame = frameFor(htmlPage, title);
        await expect(frame.locator('sl-alert').first()).toBeAttached();
        await frame.locator('body').evaluate(settle);
        expected = await frame.locator('body').evaluate(summarize);
      } finally {
        await htmlPage.close();
      }
      const pageErrors = await load(page);
      expect(await page.evaluate(() => window.reactVersion)).toBe('19.2.0');
      await page.evaluate(n => window.renderExample(n), name);
      await page.waitForFunction(() => document.querySelector('sl-alert'));
      await page.evaluate(settle);
      const actual = await page.evaluate(summarize);
      if (name === 'countdown') {
        // Shoelace's React Countdown snippet differs upstream: duration="3000" where the HTML example has 10000.
        expect(actual.map(a => a.duration)).toEqual([3000]);
        expect(actual.map(a => ({ ...a, duration: 10000 }))).toEqual(expected);
      } else {
        expect(actual).toEqual(expected);
      }
      expect(await page.evaluate(() => window.errors)).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  }

  test('React Duration example opens through state; React Toast buttons make toasts in the stack', async ({ page }) => {
    const pageErrors = await load(page);
    await page.evaluate(() => window.renderExample('duration'));
    await page.waitForFunction(() => document.querySelector('sl-alert'));
    await page.evaluate(settle);
    await page.locator('sl-button').click();
    await expect.poll(() => page.locator('sl-alert').evaluate(el => el.open && !el.base.hidden)).toBe(true);
    await page.evaluate(() => { document.body.replaceChildren(); window.renderExample('toast'); });
    await page.waitForFunction(() => document.querySelector('sl-alert'));
    await page.evaluate(settle);
    await page.locator('sl-button[variant="warning"]').click();
    await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('.sl-toast-stack sl-alert')].map(a => [a.variant, a.open]))).toEqual([['warning', true]]);
    expect(await page.evaluate(() => window.errors)).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
