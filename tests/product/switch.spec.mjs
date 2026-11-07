import { expect, test } from '@playwright/test';
import { documentsLoaded, watchNetwork } from './support/loaded.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/switch';

async function openExample(page, name = 'Overview') {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  // Litro's client router remounts the page component once after load, which reloads the iframe; wait for it to settle.
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  const frame = page.frameLocator(`iframe.example[title="Switch example: ${name}"]`);
  await expect(frame.locator('sl-switch').first()).toBeVisible();
  await frame.locator('body').evaluate(() => customElements.whenDefined('sl-switch'));
  await documentsLoaded(page);
  return { frame, requests };
}

// Appends markup to the example document and waits for every sl-switch in it to render.
async function mount(frame, markup) {
  await frame.locator('body').evaluate(async (body, markup) => {
    const host = document.createElement('div');
    host.id = 'mount';
    host.innerHTML = markup;
    body.append(host);
    await Promise.all([...host.querySelectorAll('sl-switch')].map(el => el.updateComplete));
  }, markup);
}

test('docs page is prerendered with Velcro branding, prototype status and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Switch - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Not implemented or unverified');
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
});

test('sl-switch registers as the exported class with no core marker attribute, no ch-* definitions and no sl-icon in its template', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
  const r = await frame.locator('#demo-default').evaluate(el => ({
    ctor: customElements.get('sl-switch') === el.constructor,
    // Core's base element would add its base-name marker attribute from a core scope; Velcro hosts carry none.
    attributes: el.getAttributeNames().sort(),
    chDefined: ['ch-switch', 'ch-icon'].filter(tag => customElements.get(tag)),
    // sl-icon is a Velcro component (registered by the package root), but the switch's template renders none.
    slIcon: Boolean(el.shadowRoot.querySelector('sl-icon')),
  }));
  expect(r.ctor).toBe(true);
  // size and form reflect their initial values ('medium', ''), as in Shoelace; focusable is core's documented marker.
  expect(r.attributes).toEqual(['data-optional', 'data-valid', 'focusable', 'form', 'id', 'size']);
  expect(r.chDefined).toEqual([]);
  expect(r.slIcon).toBe(false);
});

test('semantics: a labelled checkbox with role="switch", aria-checked and the help text as its description', async ({ page }) => {
  const { frame } = await openExample(page, 'Help text');
  const control = frame.getByRole('switch', { name: 'Label' });
  await expect(control).toHaveCount(1);
  await expect(control).toHaveAttribute('aria-checked', 'false');
  await expect(control).toHaveAccessibleDescription('What should the user know about the switch?');
  await frame.locator('#demo-help-text [part~="control"]').click();
  await expect(frame.getByRole('switch', { name: 'Label', checked: true })).toHaveCount(1);
  await expect(control).toHaveAttribute('aria-checked', 'true');
  const parts = await frame.locator('#demo-help-text').evaluate(el =>
    [...el.shadowRoot.querySelectorAll('[part]')].map(n => `${n.localName}:${n.getAttribute('part')}`));
  expect(parts).toEqual(['label:base', 'span:control', 'span:thumb', 'div:label', 'div:form-control-help-text']);
});

test('computed styles match Shoelace: token sizes, checked colors and the custom properties', async ({ page }) => {
  const { frame } = await openExample(page, 'Sizes');
  const sizes = await frame.locator('body').evaluate(() => ['small', 'medium', 'large'].map(size => {
    const control = document.querySelector(`#demo-${size}`).shadowRoot.querySelector('[part~="control"]');
    const thumb = control.querySelector('[part~="thumb"]');
    const label = control.parentElement.querySelector('[part~="label"]');
    return { w: control.getBoundingClientRect().width, h: control.getBoundingClientRect().height,
      thumb: thumb.getBoundingClientRect().width, font: getComputedStyle(label).fontSize };
  }));
  expect(sizes).toEqual([
    { w: 28, h: 14, thumb: 18, font: '14px' },
    { w: 36, h: 18, thumb: 22, font: '16px' },
    { w: 44, h: 22, thumb: 26, font: '20px' },
  ]);

  const checked = await openExample(page, 'Checked');
  const colors = await checked.frame.locator('#demo-checked').evaluate(el => {
    const control = getComputedStyle(el.shadowRoot.querySelector('[part~="control"]'));
    return { background: control.backgroundColor, border: control.borderColor };
  });
  expect(colors).toEqual({ background: 'rgb(2, 132, 199)', border: 'rgb(2, 132, 199)' });

  const custom = await openExample(page, 'Custom styles');
  const box = await custom.frame.locator('#demo-custom').evaluate(el => {
    const r = el.shadowRoot.querySelector('[part~="control"]').getBoundingClientRect();
    return { w: r.width, h: r.height };
  });
  expect(box).toEqual({ w: 80, h: 40 });
});

test('pointer: clicking the switch or its label toggles it and emits bubbling, composed sl-change and sl-input', async ({ page }) => {
  const { frame } = await openExample(page);
  const el = frame.locator('#demo-default');
  await el.evaluate(el => {
    window.__events = [];
    for (const type of ['sl-change', 'sl-input', 'change', 'input']) {
      document.addEventListener(type, e => window.__events.push(`${type}:${e.bubbles}:${e.composed}`));
    }
  });
  await el.locator('[part~="control"]').click();
  expect(await el.evaluate(el => el.checked)).toBe(true);
  await expect(el).toHaveAttribute('checked', '');
  await frame.getByText('Switch', { exact: true }).click();
  expect(await el.evaluate(el => el.checked)).toBe(false);
  // As in Shoelace: the inner checkbox's composed native input reaches the document; its change event does not.
  expect(await frame.locator('body').evaluate(() => window.__events)).toEqual([
    'sl-change:true:true', 'sl-input:true:true', 'input:true:true',
    'sl-change:true:true', 'sl-input:true:true', 'input:true:true',
  ]);
});

test('keyboard: Tab focuses with a visible ring, Space toggles, ArrowRight/ArrowLeft set on/off; sl-focus and sl-blur fire', async ({ page }) => {
  const { frame } = await openExample(page, 'Sizes');
  const small = frame.locator('#demo-small');
  await small.evaluate(el => {
    window.__events = [];
    for (const type of ['sl-focus', 'sl-blur', 'sl-change', 'sl-input']) el.addEventListener(type, () => window.__events.push(type));
  });
  // Start keyboard navigation inside the example document, from a button placed before the first switch.
  await frame.locator('body').evaluate(body => {
    const start = document.createElement('button');
    start.id = 'start';
    start.textContent = 'start';
    body.prepend(start);
  });
  await frame.locator('#start').focus();
  await page.keyboard.press('Tab');
  expect(await frame.locator('body').evaluate(() => document.activeElement?.id)).toBe('demo-small');
  // As in Shoelace, the focus ring is drawn on the thumb and the track darkens.
  const ring = await small.evaluate(el => {
    const thumb = getComputedStyle(el.shadowRoot.querySelector('[part~="thumb"]'));
    return { style: thumb.outlineStyle, width: thumb.outlineWidth, track: getComputedStyle(el.shadowRoot.querySelector('[part~="control"]')).backgroundColor };
  });
  expect(ring).toEqual({ style: 'solid', width: '3px', track: 'rgb(161, 161, 170)' });
  await page.keyboard.press('Space');
  expect(await small.evaluate(el => el.checked)).toBe(true);
  await page.keyboard.press('ArrowLeft');
  expect(await small.evaluate(el => el.checked)).toBe(false);
  await page.keyboard.press('ArrowRight');
  expect(await small.evaluate(el => el.checked)).toBe(true);
  await page.keyboard.press('Tab');
  expect(await frame.locator('body').evaluate(() => document.activeElement?.id)).toBe('demo-medium');
  expect(await small.evaluate(() => window.__events)).toEqual([
    'sl-focus', 'sl-change', 'sl-input', 'sl-change', 'sl-input', 'sl-change', 'sl-input', 'sl-blur',
  ]);
});

test('disabled: clicks do not toggle, Tab skips it, and its styles are dimmed', async ({ page }) => {
  const { frame } = await openExample(page, 'Disabled');
  const el = frame.locator('#demo-disabled');
  await el.evaluate(el => {
    window.__changes = 0;
    el.addEventListener('sl-change', () => window.__changes++);
  });
  await el.click({ force: true });
  expect(await el.evaluate(el => ({ checked: el.checked, changes: window.__changes, opacity: getComputedStyle(el.shadowRoot.querySelector('[part~="base"]')).opacity }))).toEqual({ checked: false, changes: 0, opacity: '0.5' });
  await frame.locator('body').evaluate(body => {
    const start = document.createElement('button');
    start.id = 'start';
    start.textContent = 'start';
    body.prepend(start);
  });
  await frame.locator('#start').focus();
  await page.keyboard.press('Tab');
  expect(await frame.locator('body').evaluate(() => document.activeElement?.localName)).not.toBe('sl-switch');
});

test('forms: a checked switch submits name=value ("on" without value); unchecked submits nothing; reset restores defaultChecked', async ({ page }) => {
  const { frame } = await openExample(page, 'Forms');
  const form = frame.locator('#demo-form');
  const result = frame.locator('#demo-form-result');
  await frame.locator('#demo-form-required').evaluate(el => el.click());
  await frame.locator('sl-button[type="submit"]').click();
  await expect(result).toHaveText('terms=on');
  await frame.locator('#demo-form-switch').evaluate(el => el.click());
  await frame.locator('sl-button[type="submit"]').click();
  await expect(result).toHaveText('notifications=email&terms=on');
  expect(await form.evaluate(form => [...form.elements].some(e => e.localName === 'sl-switch'))).toBe(false);
  await frame.locator('sl-button[type="reset"]').click();
  expect(await form.evaluate(() => [...document.querySelectorAll('sl-switch')].map(s => s.checked))).toEqual([false, false]);
});

test('forms: a required switch blocks submit with a cancelable, non-bubbling sl-invalid and validity data attributes', async ({ page }) => {
  const { frame } = await openExample(page, 'Forms');
  const required = frame.locator('#demo-form-required');
  await expect(required).toHaveAttribute('data-required', '');
  await expect(required).toHaveAttribute('data-invalid', '');
  // Core's invalid property is inert here, so the host gains no attribute Shoelace's switch lacks.
  await expect(required).not.toHaveAttribute('invalid', '');
  await required.evaluate(el => {
    window.__invalid = [];
    el.addEventListener('sl-invalid', e => window.__invalid.push(`${e.bubbles}:${e.cancelable}`));
  });
  await frame.locator('sl-button[type="submit"]').click();
  await expect(frame.locator('#demo-form-result')).toHaveText('none');
  expect(await required.evaluate(() => window.__invalid)).toEqual(['false:true']);
  await expect(required).toHaveAttribute('data-user-invalid', '');
  await required.locator('[part~="control"]').click();
  await expect(required).toHaveAttribute('data-valid', '');
});

test('forms (Shoelace parity): the form attribute finds an outside form, and a disabled fieldset does not disable the switch', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, `
    <form id="outside" action="about:blank"></form>
    <sl-switch id="remote" form="outside" name="remote" checked>Remote</sl-switch>
    <form id="fs" action="about:blank"><fieldset disabled><sl-switch id="in-fieldset" name="fs" checked>In fieldset</sl-switch></fieldset></form>`);
  const r = await frame.locator('body').evaluate(() => ({
    remote: new URLSearchParams(new FormData(document.querySelector('#outside'))).toString(),
    remoteForm: document.querySelector('#remote').getForm()?.id,
    fieldset: new URLSearchParams(new FormData(document.querySelector('#fs'))).toString(),
    fieldsetDisabled: document.querySelector('#in-fieldset').shadowRoot.querySelector('input').disabled,
  }));
  expect(r).toEqual({ remote: 'remote=on', remoteForm: 'outside', fieldset: 'fs=on', fieldsetDisabled: false });
});

test('properties: defaults, reflection, checked attribute sets defaultChecked, and removing a reflected attribute restores its initial value', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-switch id="p">P</sl-switch>');
  const r = await frame.locator('#p').evaluate(async el => {
    const defaults = { name: el.name, value: el.value, size: el.size, disabled: el.disabled, checked: el.checked, defaultChecked: el.defaultChecked, form: el.form, required: el.required, helpText: el.helpText, title: el.title };
    el.setAttribute('checked', '');
    await el.updateComplete;
    const afterAttr = { checked: el.checked, defaultChecked: el.defaultChecked };
    el.size = 'large';
    el.value = 'v';
    el.name = 'n';
    await el.updateComplete;
    const reflected = { size: el.getAttribute('size'), value: el.getAttribute('value'), name: el.getAttribute('name') };
    el.removeAttribute('size');
    await el.updateComplete;
    return { defaults, afterAttr, reflected, restored: el.size };
  });
  expect(r).toEqual({
    defaults: { name: '', value: undefined, size: 'medium', disabled: false, checked: false, defaultChecked: false, form: '', required: false, helpText: '', title: '' },
    afterAttr: { checked: true, defaultChecked: true },
    reflected: { size: 'large', value: null, name: null },
    restored: 'medium',
  });
});

test('core extensions kept: readonly, label fallback, hide-label and error-message; invalid, label-position and autofocus have no effect', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, `
    <sl-switch id="ro" readonly>Read only</sl-switch>
    <sl-switch id="lbl" label="From attribute"></sl-switch>
    <sl-switch id="hidden" hide-label help-text="Help">Hidden label</sl-switch>
    <sl-switch id="err" error-message="Pick this">Error</sl-switch>
    <sl-switch id="before" label-position="before">Before</sl-switch>
    <sl-switch id="after">After</sl-switch>
    <sl-switch id="af" autofocus>Autofocus</sl-switch>`);
  // autofocus is reflected on the host but, as in Shoelace, not passed to the inner checkbox.
  expect(await frame.locator('#af').evaluate(el => [el.hasAttribute('autofocus'), el.shadowRoot.querySelector('input').hasAttribute('autofocus')])).toEqual([true, false]);
  const ro = frame.locator('#ro');
  await ro.locator('[part~="control"]').click();
  await ro.evaluate(el => el.focus());
  expect(await frame.locator('body').evaluate(() => document.activeElement?.id)).toBe('ro');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  expect(await ro.evaluate(el => el.checked)).toBe(false);
  await expect(frame.getByRole('switch', { name: 'From attribute' })).toHaveCount(1);
  const hidden = await frame.locator('#hidden').evaluate(el => ({
    label: el.shadowRoot.querySelector('[part~="label"]').getBoundingClientRect().width,
    help: el.shadowRoot.querySelector('[part~="form-control-help-text"]').getBoundingClientRect().width,
  }));
  expect(hidden).toEqual({ label: 1, help: 1 });
  await expect(frame.getByRole('switch', { name: 'Hidden label' })).toHaveAccessibleDescription('Help');
  const err = await frame.locator('#err').evaluate(async el => {
    const before = { valid: el.validity.valid, message: el.validationMessage, invalid: el.invalid, data: el.hasAttribute('data-invalid'), text: el.shadowRoot.textContent.includes('Pick this') };
    el.errorMessage = '';
    await el.updateComplete;
    const after = { valid: el.validity.valid, invalid: el.invalid, data: el.hasAttribute('data-invalid') };
    el.invalid = true;
    await el.updateComplete;
    return { before, after, inert: { valid: el.validity.valid, data: el.hasAttribute('data-invalid') } };
  });
  expect(err).toEqual({
    before: { valid: false, message: 'Pick this', invalid: false, data: true, text: false },
    after: { valid: true, invalid: false, data: false },
    inert: { valid: true, data: false },
  });
  const order = await frame.locator('body').evaluate(() => ['#before', '#after'].map(id => {
    const el = document.querySelector(id);
    const control = el.shadowRoot.querySelector('[part~="control"]').getBoundingClientRect().x;
    const label = el.shadowRoot.querySelector('[part~="label"]').getBoundingClientRect().x;
    return label > control;
  }));
  expect(order).toEqual([true, true]);
});

test('dir and lang are reactive, not reflected and undefined by default, as Shoelace\'s base element declares them', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-switch id="dl">Lang</sl-switch><sl-switch id="attrs" dir="rtl" lang="de">Attrs</sl-switch>');
  const r = await frame.locator('body').evaluate(async () => {
    const el = document.querySelector('#dl');
    const attrs = document.querySelector('#attrs');
    const observed = customElements.get('sl-switch').observedAttributes.filter(a => a === 'dir' || a === 'lang');
    const defaults = [el.dir, el.lang];
    el.dir = 'auto';
    el.lang = 'fr';
    await el.updateComplete;
    const assigned = [el.dir, el.lang, el.getAttribute('dir'), el.getAttribute('lang')];
    const fromAttributes = [attrs.dir, attrs.lang];
    attrs.removeAttribute('dir');
    attrs.removeAttribute('lang');
    await attrs.updateComplete;
    return { observed, defaults, assigned, fromAttributes, removed: [attrs.dir, attrs.lang] };
  });
  expect(r).toEqual({
    observed: ['dir', 'lang'],
    defaults: [undefined, undefined],
    assigned: ['auto', 'fr', null, null],
    fromAttributes: ['rtl', 'de'],
    // not reflected, so not restored to an initial value (Shoelace restores reflected properties only)
    removed: [null, null],
  });
});

test('focus is not delegated, as in Shoelace: clicking the help text neither focuses the switch nor emits sl-focus', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-switch id="nf" help-text="Some help text">Label</sl-switch>');
  const el = frame.locator('#nf');
  await el.evaluate(el => {
    window.__nfEvents = [];
    el.addEventListener('sl-focus', () => window.__nfEvents.push('sl-focus'));
  });
  expect(await el.evaluate(el => el.shadowRoot.delegatesFocus)).toBe(false);
  await el.locator('[part~="form-control-help-text"]').click();
  expect(await frame.locator('body').evaluate(() => ({ active: document.activeElement?.localName, events: window.__nfEvents })))
    .toEqual({ active: 'body', events: [] });
  // focus() still focuses the inner checkbox
  await el.evaluate(el => el.focus());
  expect(await el.evaluate(el => [document.activeElement === el, el.shadowRoot.activeElement?.localName, window.__nfEvents])).toEqual([true, 'input', ['sl-focus']]);
});

test('upstream quirks matched: hidden does not hide it, ArrowLeft on an off switch emits sl-change, aria-describedby and form="" are always set', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-switch id="h" hidden>Hidden</sl-switch><sl-switch id="off">Off</sl-switch>');
  // Shoelace's :host { display: inline-block } outranks the user agent's [hidden] rule.
  expect(await frame.locator('#h').evaluate(el => getComputedStyle(el).display)).toBe('inline-block');
  const off = frame.locator('#off');
  await off.evaluate(el => {
    window.__offEvents = [];
    for (const t of ['sl-change', 'sl-input']) el.addEventListener(t, () => window.__offEvents.push(t));
  });
  // Focus through Playwright, not el.focus() inside the frame: Firefox does not let a frame's own script move the page's
  // focus into that frame, so the key press would go to the parent document. Playwright focuses from its own script world,
  // which does not see the element's focus() override, so it focuses the inner checkbox directly.
  await off.locator('input').focus();
  expect(await off.evaluate(el => [document.hasFocus(), document.activeElement === el, el.shadowRoot.activeElement?.localName])).toEqual([true, true, 'input']);
  await page.keyboard.press('ArrowLeft');
  expect(await off.evaluate(el => ({ checked: el.checked, events: window.__offEvents }))).toEqual({ checked: false, events: ['sl-change', 'sl-input'] });
  // Without help text the inner checkbox still points aria-describedby at the (empty) help text, and form="" is reflected.
  expect(await off.evaluate(el => [el.shadowRoot.querySelector('input').getAttribute('aria-describedby'), el.getAttribute('form')])).toEqual(['help-text', '']);
});

test('inherited core ready event: dispatched once on the element after the first update, not bubbling or composed', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('body').evaluate(async body => {
    const el = document.createElement('sl-switch');
    const seen = [];
    let bubbled = 0;
    el.addEventListener('ready', event => seen.push({ bubbles: event.bubbles, composed: event.composed }));
    body.addEventListener('ready', () => bubbled++);
    body.append(el);
    await el.updateComplete;
    el.checked = true;
    await el.updateComplete;
    el.remove();
    return { seen, bubbled };
  });
  expect(r).toEqual({ seen: [{ bubbles: false, composed: false }], bubbled: 0 });
});

test('every docs example renders in its own document', async ({ page }) => {
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  const titles = await page.locator('iframe.example').evaluateAll(frames => frames.map(f => f.title));
  expect(titles).toEqual(['Overview', 'Checked', 'Disabled', 'Sizes', 'Help text', 'Custom styles', 'Forms'].map(t => `Switch example: ${t}`));
  for (const title of titles) {
    const frame = page.frameLocator(`iframe.example[title="${title}"]`);
    await expect(frame.locator('sl-switch').first()).toBeVisible();
    expect(await frame.locator('sl-switch').first().evaluate(el => Boolean(el.shadowRoot?.querySelector('[part~="base"]')))).toBe(true);
  }
});

test('no upstream Shoelace runtime is requested or defined; all requests stay on the local origin', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  expect(await frame.locator('body').evaluate(() => Boolean(window.Shoelace || document.querySelector('script[src*="shoelace"]')))).toBe(false);
});
