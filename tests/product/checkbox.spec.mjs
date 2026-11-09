import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { pressReceived, recordKeys } from './support/keys.mjs';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/checkbox';

// The docs page's examples, in page order: the example's title, and the name of its files under examples/checkbox/.
const EXAMPLES = [
  ['Overview', 'basic'],
  ['Checked', 'checked'],
  ['Indeterminate', 'indeterminate'],
  ['Disabled', 'disabled'],
  ['Sizes', 'sizes'],
  ['Help Text', 'help-text'],
  ['Custom Validity', 'custom-validity'],
];

const frameFor = (page, title) => page.frameLocator(`iframe.example[title="Checkbox example: ${title}"]`);

async function openExample(page, name = 'Overview') {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  const frame = frameFor(page, name);
  await expect(frame.locator('sl-checkbox').first()).toBeVisible();
  await frame.locator('body').evaluate(() => customElements.whenDefined('sl-checkbox'));
  await documentsLoaded(page);
  return { frame, requests };
}

// Appends markup to the example document and waits for every sl-checkbox in it to render.
async function mount(frame, markup) {
  await frame.locator('body').evaluate(async (body, markup) => {
    const host = document.createElement('div');
    host.id = 'mount';
    host.innerHTML = markup;
    body.append(host);
    await Promise.all([...host.querySelectorAll('sl-checkbox')].map(el => el.updateComplete));
  }, markup);
}

// Resolves Shoelace theme tokens in the example document to the computed value of a CSS property, so the expected values
// come from the theme in the same engine (for example `rgb(...)` for a color token).
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

test('docs page is prerendered with Velcro branding, prototype status and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Checkbox - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('Not implemented or unverified');
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
});

test('sl-checkbox registers as the exported class with no core marker attribute and no ch-* definitions; its icons are Velcro\'s sl-icon', async ({ page }) => {
  const { frame, requests } = await openExample(page, 'Checked');
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
  const r = await frame.locator('#demo-checked').evaluate(el => {
    const icon = el.shadowRoot.querySelector('sl-icon');
    return {
      ctor: customElements.get('sl-checkbox') === el.constructor,
      attributes: el.getAttributeNames().sort(),
      chDefined: ['ch-checkbox', 'ch-icon'].filter(tag => customElements.get(tag)),
      icon: icon && { ctor: customElements.get('sl-icon') === icon.constructor, name: icon.name, library: icon.library, svg: Boolean(icon.shadowRoot.querySelector('svg')) },
    };
  });
  expect(r.ctor).toBe(true);
  // size and form reflect their initial values ('medium', ''), as in Shoelace; focusable is core's documented marker.
  expect(r.attributes).toEqual(['checked', 'data-optional', 'data-valid', 'focusable', 'form', 'id', 'size']);
  expect(r.chDefined).toEqual([]);
  expect(r.icon).toEqual({ ctor: true, name: 'check', library: 'system', svg: true });
});

test('structure and parts follow Shoelace for the unchecked, checked and indeterminate states', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-checkbox id="u">U</sl-checkbox><sl-checkbox id="c" checked>C</sl-checkbox><sl-checkbox id="i" indeterminate>I</sl-checkbox><sl-checkbox id="ci" checked indeterminate>CI</sl-checkbox>');
  const r = await frame.locator('body').evaluate(() => Object.fromEntries(['u', 'c', 'i', 'ci'].map(id => {
    const root = document.querySelector(`#${id}`).shadowRoot;
    return [id, {
      parts: [...root.querySelectorAll('[part]')].map(n => `${n.localName}:${n.getAttribute('part')}`),
      base: root.querySelector('[part="base"]').className.trim().split(/\s+/).sort().join(' '),
      input: (({ checked, indeterminate, type }) => ({ checked, indeterminate, type }))(root.querySelector('input')),
    }];
  })));
  const common = ['div:form-control-help-text'];
  expect(r.u).toEqual({ parts: ['label:base', 'span:control', 'div:label', ...common], base: 'checkbox checkbox--medium', input: { checked: false, indeterminate: false, type: 'checkbox' } });
  expect(r.c).toEqual({ parts: ['label:base', 'span:control control--checked', 'sl-icon:checked-icon', 'div:label', ...common], base: 'checkbox checkbox--checked checkbox--medium', input: { checked: true, indeterminate: false, type: 'checkbox' } });
  expect(r.i).toEqual({ parts: ['label:base', 'span:control control--indeterminate', 'sl-icon:indeterminate-icon', 'div:label', ...common], base: 'checkbox checkbox--indeterminate checkbox--medium', input: { checked: false, indeterminate: true, type: 'checkbox' } });
  // Checked wins over indeterminate for the icon, as in Shoelace; both state parts are set.
  expect(r.ci).toEqual({ parts: ['label:base', 'span:control control--checked control--indeterminate', 'sl-icon:checked-icon', 'div:label', ...common], base: 'checkbox checkbox--checked checkbox--indeterminate checkbox--medium', input: { checked: true, indeterminate: true, type: 'checkbox' } });
});

test('semantics: a labelled native checkbox with the help text as its description; indeterminate reads as mixed', async ({ page }) => {
  const { frame } = await openExample(page, 'Help Text');
  const control = frame.getByRole('checkbox', { name: 'Label' });
  await expect(control).toHaveCount(1);
  await expect(control).toHaveAttribute('aria-checked', 'false');
  await expect(control).toHaveAccessibleDescription('What should the user know about the checkbox?');
  await frame.locator('#demo-help-text [part~="control"]').click();
  await expect(frame.getByRole('checkbox', { name: 'Label', checked: true })).toHaveCount(1);
  await expect(control).toHaveAttribute('aria-checked', 'true');

  const indeterminate = await openExample(page, 'Indeterminate');
  const mixed = indeterminate.frame.getByRole('checkbox', { name: 'Indeterminate' });
  await expect(mixed).toBeChecked({ indeterminate: true });
});

test('computed styles match Shoelace: token sizes, colors, radius, label spacing and disabled opacity', async ({ page }) => {
  const { frame } = await openExample(page, 'Sizes');
  const sizes = await frame.locator('body').evaluate(() => ['small', 'medium', 'large'].map(size => {
    const root = document.querySelector(`#demo-${size}`).shadowRoot;
    const control = root.querySelector('[part~="control"]');
    const label = root.querySelector('[part~="label"]');
    const r = control.getBoundingClientRect();
    return { w: r.width, h: r.height, font: getComputedStyle(label).fontSize, lineHeight: getComputedStyle(label).lineHeight, gap: label.getBoundingClientRect().left - r.right };
  }));
  expect(sizes).toEqual([
    { w: 14, h: 14, font: '14px', lineHeight: '14px', gap: 7 },
    { w: 18, h: 18, font: '16px', lineHeight: '18px', gap: 8 },
    { w: 22, h: 22, font: '20px', lineHeight: '22px', gap: 10 },
  ]);
  const [border, background, primary, white] = await tokens(frame, 'color', ['--sl-input-border-color', '--sl-input-background-color', '--sl-color-primary-600', '--sl-color-neutral-0']);
  const unchecked = await frame.locator('#demo-medium').evaluate(el => {
    const s = getComputedStyle(el.shadowRoot.querySelector('[part~="control"]'));
    return { border: s.borderTopColor, width: s.borderTopWidth, style: s.borderTopStyle, background: s.backgroundColor, radius: s.borderTopLeftRadius, host: getComputedStyle(el).display };
  });
  expect(unchecked).toEqual({ border, width: '1px', style: 'solid', background, radius: '2px', host: 'inline-block' });

  for (const [title, id] of [['Checked', '#demo-checked'], ['Indeterminate', '#demo-indeterminate']]) {
    const { frame: f } = await openExample(page, title);
    const colors = await f.locator(id).evaluate(el => {
      const control = el.shadowRoot.querySelector('[part~="control"]');
      const s = getComputedStyle(control);
      const icon = control.querySelector('sl-icon').getBoundingClientRect();
      return { background: s.backgroundColor, border: s.borderTopColor, color: s.color, icon: [icon.width, icon.height] };
    });
    // The icon is --toggle-size wide and tall but, as a flex item of the bordered control, shrinks to its 16px content width.
    expect(colors, title).toEqual({ background: primary, border: primary, color: white, icon: [16, 18] });
  }

  const { frame: disabled } = await openExample(page, 'Disabled');
  expect(await disabled.locator('#demo-disabled').evaluate(el => {
    const s = getComputedStyle(el.shadowRoot.querySelector('[part~="base"]'));
    return { opacity: s.opacity, cursor: s.cursor };
  })).toEqual({ opacity: '0.5', cursor: 'not-allowed' });
});

test('pointer: clicking the control or the label toggles it and emits bubbling, composed sl-change and sl-input; hover darkens the border', async ({ page }) => {
  const { frame } = await openExample(page);
  const el = frame.locator('#demo-default');
  await el.evaluate(() => {
    window.__events = [];
    for (const type of ['sl-change', 'sl-input', 'change', 'input']) {
      document.addEventListener(type, e => window.__events.push(`${type}:${e.bubbles}:${e.composed}`));
    }
  });
  const [hoverBorder] = await tokens(frame, 'color', ['--sl-input-border-color-hover']);
  await el.locator('[part~="control"]').hover();
  // The border color has Shoelace's fast transition, so the hover color is polled.
  await expect.poll(() => el.evaluate(el => getComputedStyle(el.shadowRoot.querySelector('[part~="control"]')).borderTopColor)).toBe(hoverBorder);
  await el.locator('[part~="control"]').click();
  expect(await el.evaluate(el => el.checked)).toBe(true);
  await expect(el).toHaveAttribute('checked', '');
  await frame.getByText('Checkbox', { exact: true }).click();
  expect(await el.evaluate(el => el.checked)).toBe(false);
  // As in Shoelace: the inner checkbox's composed native input reaches the document; its change event does not.
  expect(await frame.locator('body').evaluate(() => window.__events)).toEqual([
    'sl-change:true:true', 'sl-input:true:true', 'input:true:true',
    'sl-change:true:true', 'sl-input:true:true', 'input:true:true',
  ]);
});

test('clicking an indeterminate checkbox checks it and clears indeterminate; script changes emit no events', async ({ page }) => {
  const { frame } = await openExample(page, 'Indeterminate');
  const el = frame.locator('#demo-indeterminate');
  await el.evaluate(el => {
    window.__events = [];
    for (const type of ['sl-change', 'sl-input']) el.addEventListener(type, () => window.__events.push(type));
  });
  await el.locator('[part~="control"]').click();
  expect(await el.evaluate(el => ({ checked: el.checked, indeterminate: el.indeterminate, attr: el.hasAttribute('indeterminate'), inner: el.shadowRoot.querySelector('input').indeterminate, events: window.__events })))
    .toEqual({ checked: true, indeterminate: false, attr: false, inner: false, events: ['sl-change', 'sl-input'] });
  const scripted = await el.evaluate(async el => {
    el.checked = false;
    el.indeterminate = true;
    await el.updateComplete;
    const input = el.shadowRoot.querySelector('input');
    return { inner: [input.checked, input.indeterminate], icon: el.shadowRoot.querySelector('sl-icon').getAttribute('part'), events: window.__events.length };
  });
  expect(scripted).toEqual({ inner: [false, true], icon: 'indeterminate-icon', events: 2 });
});

test('keyboard: Tab focuses with Shoelace\'s focus ring, Space toggles, Enter does not; sl-focus and sl-blur fire', async ({ page }) => {
  const { frame } = await openExample(page, 'Sizes');
  const small = frame.locator('#demo-small');
  await small.evaluate(el => {
    window.__events = [];
    for (const type of ['sl-focus', 'sl-blur', 'sl-change', 'sl-input']) el.addEventListener(type, () => window.__events.push(type));
  });
  await frame.locator('body').evaluate(body => {
    const start = document.createElement('button');
    start.id = 'start';
    start.textContent = 'start';
    body.prepend(start);
  });
  await frame.locator('#start').focus();
  await page.keyboard.press('Tab');
  await expect.poll(() => frame.locator('body').evaluate(() => document.activeElement?.id)).toBe('demo-small');
  const ring = await small.evaluate(el => {
    const control = getComputedStyle(el.shadowRoot.querySelector('[part~="control"]'));
    return { style: control.outlineStyle, width: control.outlineWidth, offset: control.outlineOffset };
  });
  expect(ring).toEqual({ style: 'solid', width: '3px', offset: '1px' });
  await page.keyboard.press('Space');
  await expect.poll(() => small.evaluate(el => el.checked)).toBe(true);
  // Checked + focus keeps the ring.
  expect(await small.evaluate(el => getComputedStyle(el.shadowRoot.querySelector('[part~="control"]')).outlineStyle)).toBe('solid');
  await recordKeys(frame.locator('body'));
  await pressReceived(page, frame.locator('body'), 'Enter');
  expect(await small.evaluate(el => el.checked)).toBe(true);
  await page.keyboard.press('Tab');
  await expect.poll(() => frame.locator('body').evaluate(() => document.activeElement?.id)).toBe('demo-medium');
  expect(await small.evaluate(() => window.__events)).toEqual(['sl-focus', 'sl-change', 'sl-input', 'sl-blur']);
});

test('disabled: clicks do not toggle, Tab skips it, and the inner checkbox is disabled', async ({ page }) => {
  const { frame } = await openExample(page, 'Disabled');
  const el = frame.locator('#demo-disabled');
  await el.evaluate(el => {
    window.__changes = 0;
    el.addEventListener('sl-change', () => window.__changes++);
  });
  await el.click({ force: true });
  expect(await el.evaluate(el => ({ checked: el.checked, changes: window.__changes, inner: el.shadowRoot.querySelector('input').disabled }))).toEqual({ checked: false, changes: 0, inner: true });
  await frame.locator('body').evaluate(body => {
    const start = document.createElement('button');
    start.id = 'start';
    start.textContent = 'start';
    body.prepend(start);
  });
  await frame.locator('#start').focus();
  await page.keyboard.press('Tab');
  // Tab moves the focus off the start button (to the next control, or out of the example's frame, whose activeElement
  // Firefox then leaves on the button), and not to the disabled control.
  await expect.poll(() => frame.locator('body').evaluate(() => (document.hasFocus() ? document.activeElement?.id : 'left the frame'))).not.toBe('start');
  expect(await frame.locator('body').evaluate(() => document.activeElement?.localName)).not.toBe('sl-checkbox');
});

test('forms: a checked checkbox submits name=value ("on" without value); unchecked and disabled submit nothing; reset restores defaultChecked', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, `
    <form id="f" action="about:blank">
      <sl-checkbox id="a" name="a" value="yes">A</sl-checkbox>
      <sl-checkbox id="b" name="b" checked>B</sl-checkbox>
      <sl-checkbox id="c" name="c">C</sl-checkbox>
      <sl-checkbox id="d" name="d" checked disabled>D</sl-checkbox>
    </form>`);
  const r = await frame.locator('#f').evaluate(async form => {
    const data = () => new URLSearchParams(new FormData(form)).toString();
    const initial = data();
    form.querySelector('#a').click();
    form.querySelector('#b').click();
    await form.querySelector('#b').updateComplete;
    const toggled = data();
    form.querySelector('#c').indeterminate = true;
    form.reset();
    await Promise.all([...form.querySelectorAll('sl-checkbox')].map(el => el.updateComplete));
    return {
      initial, toggled, afterReset: data(),
      checked: [...form.querySelectorAll('sl-checkbox')].map(el => el.checked),
      indeterminate: form.querySelector('#c').indeterminate,
      inElements: [...form.elements].some(e => e.localName === 'sl-checkbox'),
    };
  });
  expect(r).toEqual({ initial: 'b=on', toggled: 'a=yes', afterReset: 'b=on', checked: [false, true, false, true], indeterminate: true, inElements: false });
});

test('forms: a required checkbox blocks submit with a cancelable, non-bubbling sl-invalid and validity data attributes', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<form id="rf" action="about:blank"><sl-checkbox id="req" name="terms" required>Terms</sl-checkbox><button>Go</button></form>');
  const required = frame.locator('#req');
  await expect(required).toHaveAttribute('data-required', '');
  await expect(required).toHaveAttribute('data-invalid', '');
  await expect(required).not.toHaveAttribute('invalid', '');
  const r = await required.evaluate(el => {
    window.__invalid = [];
    window.__submitted = 0;
    el.addEventListener('sl-invalid', e => window.__invalid.push(`${e.bubbles}:${e.cancelable}`));
    el.closest('form').addEventListener('submit', e => { e.preventDefault(); window.__submitted++; });
    return { valid: el.checkValidity(), missing: el.validity.valueMissing, message: el.validationMessage.length > 0 };
  });
  expect(r).toEqual({ valid: false, missing: true, message: true });
  await frame.locator('#rf button').click();
  expect(await required.evaluate(() => [window.__invalid, window.__submitted])).toEqual([['false:true', 'false:true'], 0]);
  await expect(required).toHaveAttribute('data-user-invalid', '');
  await required.locator('[part~="control"]').click();
  await expect(required).toHaveAttribute('data-valid', '');
  await expect(required).toHaveAttribute('data-user-valid', '');
  await frame.locator('#rf button').click();
  expect(await required.evaluate(() => window.__submitted)).toBe(1);
});

test('Custom Validity example: the message blocks submission until the box is checked, then the form submits', async ({ page }) => {
  const { frame } = await openExample(page, 'Custom Validity');
  const el = frame.locator('#demo-custom-validity');
  await expect.poll(() => el.evaluate(el => el.validationMessage)).toBe('Don\'t forget to check me!');
  await expect(el).toHaveAttribute('data-invalid', '');
  const dialogs = [];
  page.on('dialog', dialog => { dialogs.push(dialog.message()); dialog.dismiss(); });
  await frame.locator('sl-button[type="submit"]').click();
  expect(dialogs).toEqual([]);
  await el.locator('[part~="control"]').click();
  expect(await el.evaluate(el => [el.validationMessage, el.validity.valid])).toEqual(['', true]);
  await frame.locator('sl-button[type="submit"]').click();
  await expect.poll(() => dialogs).toEqual(['All fields are valid!']);
});

test('forms (Shoelace parity): the form attribute finds an outside form, and a disabled fieldset does not disable the checkbox', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, `
    <form id="outside" action="about:blank"></form>
    <sl-checkbox id="remote" form="outside" name="remote" checked>Remote</sl-checkbox>
    <form id="fs" action="about:blank"><fieldset disabled><sl-checkbox id="in-fieldset" name="fs" checked>In fieldset</sl-checkbox></fieldset></form>`);
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
  await mount(frame, '<sl-checkbox id="p">P</sl-checkbox><sl-checkbox id="q" size="small" required>Q</sl-checkbox>');
  const r = await frame.locator('body').evaluate(async () => {
    const el = document.querySelector('#p');
    const defaults = { name: el.name, value: el.value, size: el.size, disabled: el.disabled, checked: el.checked, indeterminate: el.indeterminate, defaultChecked: el.defaultChecked, form: el.form, required: el.required, helpText: el.helpText, title: el.title };
    el.setAttribute('checked', '');
    await el.updateComplete;
    const afterAttr = { checked: el.checked, defaultChecked: el.defaultChecked };
    el.size = 'large';
    el.value = 'v';
    el.name = 'n';
    el.indeterminate = true;
    el.title = 't';
    await el.updateComplete;
    const input = el.shadowRoot.querySelector('input');
    const reflected = { size: el.getAttribute('size'), value: el.getAttribute('value'), name: el.getAttribute('name'), indeterminate: el.getAttribute('indeterminate'), inner: [input.name, input.value, input.title] };
    el.removeAttribute('size');
    await el.updateComplete;
    // The second element started with size="small": removing the attribute restores the initial 'medium', as in Shoelace.
    const q = document.querySelector('#q');
    q.removeAttribute('size');
    q.removeAttribute('required');
    await q.updateComplete;
    return { defaults, afterAttr, reflected, restored: el.size, q: [q.size, q.required] };
  });
  expect(r).toEqual({
    defaults: { name: '', value: undefined, size: 'medium', disabled: false, checked: false, indeterminate: false, defaultChecked: false, form: '', required: false, helpText: '', title: '' },
    afterAttr: { checked: true, defaultChecked: true },
    reflected: { size: 'large', value: null, name: null, indeterminate: '', inner: ['n', 'v', 't'] },
    restored: 'medium',
    q: ['medium', false],
  });
});

test('core extensions kept: readonly, label fallback, hide-label and error-message; invalid, label-position and autofocus have no effect', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, `
    <sl-checkbox id="ro" readonly>Read only</sl-checkbox>
    <sl-checkbox id="lbl" label="From attribute"></sl-checkbox>
    <sl-checkbox id="hidden" hide-label help-text="Help">Hidden label</sl-checkbox>
    <sl-checkbox id="err" error-message="Pick this">Error</sl-checkbox>
    <sl-checkbox id="before" label-position="start">Before</sl-checkbox>
    <sl-checkbox id="af" autofocus>Autofocus</sl-checkbox>`);
  expect(await frame.locator('#af').evaluate(el => [el.hasAttribute('autofocus'), el.shadowRoot.querySelector('input').hasAttribute('autofocus')])).toEqual([true, false]);
  const ro = frame.locator('#ro');
  await ro.evaluate(el => {
    window.__roEvents = [];
    el.addEventListener('sl-change', () => window.__roEvents.push('sl-change'));
  });
  await ro.locator('[part~="control"]').click();
  await ro.locator('input').focus();
  await recordKeys(frame.locator('body'));
  await pressReceived(page, frame.locator('body'), 'Space');
  expect(await ro.evaluate(el => ({ checked: el.checked, inner: el.shadowRoot.querySelector('input').checked, events: window.__roEvents }))).toEqual({ checked: false, inner: false, events: [] });
  await expect(frame.getByRole('checkbox', { name: 'From attribute' })).toHaveCount(1);
  const hidden = await frame.locator('#hidden').evaluate(el => ({
    label: el.shadowRoot.querySelector('[part~="label"]').getBoundingClientRect().width,
    help: el.shadowRoot.querySelector('[part~="form-control-help-text"]').getBoundingClientRect().width,
  }));
  expect(hidden).toEqual({ label: 1, help: 1 });
  await expect(frame.getByRole('checkbox', { name: 'Hidden label' })).toHaveAccessibleDescription('Help');
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
  // label-position has no effect: the label stays after the control.
  expect(await frame.locator('#before').evaluate(el => {
    const control = el.shadowRoot.querySelector('[part~="control"]').getBoundingClientRect().x;
    const label = el.shadowRoot.querySelector('[part~="label"]').getBoundingClientRect().x;
    return label > control;
  })).toBe(true);
});

test('dir and lang are reactive, not reflected and undefined by default, as Shoelace\'s base element declares them', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-checkbox id="dl">Lang</sl-checkbox><sl-checkbox id="attrs" dir="rtl" lang="de">Attrs</sl-checkbox>');
  const r = await frame.locator('body').evaluate(async () => {
    const el = document.querySelector('#dl');
    const attrs = document.querySelector('#attrs');
    const observed = customElements.get('sl-checkbox').observedAttributes.filter(a => a === 'dir' || a === 'lang');
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
    removed: [null, null],
  });
});

test('focus is not delegated, as in Shoelace: clicking the help text neither focuses the checkbox nor emits sl-focus', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-checkbox id="nf" help-text="Some help text">Label</sl-checkbox>');
  const el = frame.locator('#nf');
  await el.evaluate(el => {
    window.__nfEvents = [];
    el.addEventListener('sl-focus', () => window.__nfEvents.push('sl-focus'));
  });
  expect(await el.evaluate(el => el.shadowRoot.delegatesFocus)).toBe(false);
  await el.locator('[part~="form-control-help-text"]').click();
  expect(await frame.locator('body').evaluate(() => ({ active: document.activeElement?.localName, events: window.__nfEvents })))
    .toEqual({ active: 'body', events: [] });
  await el.evaluate(el => el.focus());
  expect(await el.evaluate(el => [document.activeElement === el, el.shadowRoot.activeElement?.localName, window.__nfEvents])).toEqual([true, 'input', ['sl-focus']]);
});

// The class-only entry (@charm-ux/velcro/checkbox/class), bundled alone through the package's real export map: no
// registering entry, no aggregate and no docs page. Shoelace's checkbox declares sl-icon in `static dependencies`, and its
// base element defines each missing dependency when a checkbox is constructed; Velcro's does the same.
test.describe('class-only entry', () => {
  const docsDir = fileURLToPath(new URL('../../packages/docs/', import.meta.url));
  const velcroDir = fileURLToPath(new URL('../../packages/velcro/', import.meta.url));
  let bundle;

  test.beforeAll(async () => {
    const fromDocs = createRequire(path.join(docsDir, 'package.json'));
    const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
    const dir = mkdtempSync(path.join(tmpdir(), 'velcro-checkbox-class-'));
    try {
      const entry = path.join(dir, 'entry.js');
      writeFileSync(entry, `
        import { SlCheckbox, VelcroCheckbox } from '@charm-ux/velcro/checkbox/class';
        import { SlIcon } from '@charm-ux/velcro/icon/class';
        window.checkboxClass = { SlCheckbox, VelcroCheckbox, SlIcon };
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

  async function load(page) {
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    const themeCss = readFileSync(path.join(velcroDir, 'themes/light.css'), 'utf8');
    await page.setContent('<!DOCTYPE html><html class="sl-theme-light"><body></body></html>');
    await page.addStyleTag({ content: themeCss });
    await page.addScriptTag({ type: 'module', content: bundle });
    await page.waitForFunction(() => Boolean(window.checkboxClass));
    return pageErrors;
  }

  test('importing defines nothing; constructing a checkbox defines Velcro\'s sl-icon, so the checked icon renders', async ({ page }) => {
    const pageErrors = await load(page);
    const r = await page.evaluate(async () => {
      const { SlCheckbox, VelcroCheckbox } = window.checkboxClass;
      const tags = () => ['sl-checkbox', 'sl-icon'].map(t => customElements.get(t)?.name ?? null);
      const afterImport = tags();
      customElements.define('sl-checkbox', SlCheckbox);
      const afterDefine = tags();
      const checkbox = document.createElement('sl-checkbox');
      checkbox.checked = true;
      document.body.append(checkbox);
      await checkbox.updateComplete;
      const icon = checkbox.shadowRoot.querySelector('[part="checked-icon"]');
      await icon.updateComplete;
      return {
        afterImport, afterDefine, afterConstruct: tags(), alias: SlCheckbox === VelcroCheckbox,
        iconClass: customElements.get('sl-icon') === icon.constructor && icon.constructor.baseName,
        name: icon.getAttribute('name'), library: icon.getAttribute('library'),
      };
    });
    expect(r).toEqual({
      afterImport: [null, null], afterDefine: ['VelcroCheckbox', null], afterConstruct: ['VelcroCheckbox', 'VelcroIcon'], alias: true,
      iconClass: 'icon', name: 'check', library: 'system',
    });
    await expect.poll(() => page.locator('sl-checkbox').evaluate(c => Boolean(c.shadowRoot.querySelector('sl-icon').shadowRoot?.querySelector('svg')))).toBe(true);
    expect(pageErrors).toEqual([]);
  });

  // The platform refuses to define one constructor under two names; Shoelace then defines an anonymous subclass.
  test('when the icon class is already defined under another tag, constructing a checkbox defines sl-icon as a subclass of it', async ({ page }) => {
    const pageErrors = await load(page);
    const r = await page.evaluate(async () => {
      const { SlCheckbox, SlIcon } = window.checkboxClass;
      customElements.define('my-icon', SlIcon);
      customElements.define('sl-checkbox', SlCheckbox);
      const checkbox = document.createElement('sl-checkbox');
      checkbox.indeterminate = true;
      document.body.append(checkbox);
      await checkbox.updateComplete;
      const defined = customElements.get('sl-icon');
      const icon = checkbox.shadowRoot.querySelector('sl-icon');
      return {
        myIcon: customElements.get('my-icon') === SlIcon,
        subclass: Boolean(defined) && defined !== SlIcon && defined.prototype instanceof SlIcon, icon: icon instanceof defined,
      };
    });
    expect(r).toEqual({ myIcon: true, subclass: true, icon: true });
    expect(pageErrors).toEqual([]);
  });

  test('an sl-icon another constructor already owns is left in place, without an error or a console warning', async ({ page }) => {
    const pageErrors = await load(page);
    const warnings = [];
    page.on('console', message => {
      if (message.type() === 'warning' || message.type() === 'error') warnings.push(message.text());
    });
    const r = await page.evaluate(async () => {
      class OtherIcon extends HTMLElement {}
      customElements.define('sl-icon', OtherIcon);
      customElements.define('sl-checkbox', window.checkboxClass.SlCheckbox);
      const checkbox = document.createElement('sl-checkbox');
      checkbox.checked = true;
      document.body.append(checkbox);
      await checkbox.updateComplete;
      return [customElements.get('sl-icon') === OtherIcon, checkbox.shadowRoot.querySelector('sl-icon') instanceof OtherIcon];
    });
    expect(r).toEqual([true, true]);
    expect(warnings).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});

test('upstream quirks matched: hidden does not hide it, aria-describedby and form="" are always set, aria-checked ignores indeterminate', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-checkbox id="h" hidden>Hidden</sl-checkbox><sl-checkbox id="plain">Plain</sl-checkbox><sl-checkbox id="mixed" indeterminate>Mixed</sl-checkbox>');
  expect(await frame.locator('#h').evaluate(el => getComputedStyle(el).display)).toBe('inline-block');
  expect(await frame.locator('#plain').evaluate(el => [el.shadowRoot.querySelector('input').getAttribute('aria-describedby'), el.getAttribute('form')])).toEqual(['help-text', '']);
  expect(await frame.locator('#mixed').evaluate(el => el.shadowRoot.querySelector('input').getAttribute('aria-checked'))).toBe('false');
});

test('inherited core ready event: dispatched once on the element after the first update, not bubbling or composed', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('body').evaluate(async body => {
    const el = document.createElement('sl-checkbox');
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
  await openDocs(page, PAGE);
  const titles = await page.locator('iframe.example').evaluateAll(frames => frames.map(f => f.title));
  expect(titles).toEqual(EXAMPLES.map(([t]) => `Checkbox example: ${t}`));
  for (const title of titles) {
    const frame = page.frameLocator(`iframe.example[title="${title}"]`);
    await expect(frame.locator('sl-checkbox').first()).toBeVisible();
    expect(await frame.locator('sl-checkbox').first().evaluate(el => Boolean(el.shadowRoot?.querySelector('[part~="base"]')))).toBe(true);
  }
});

test('no upstream Shoelace runtime is requested or defined; all requests stay on the local origin', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  expect(await frame.locator('body').evaluate(() => Boolean(window.Shoelace || document.querySelector('script[src*="shoelace"]')))).toBe(false);
});

// The values that matter in a rendered example, which an HTML example and its React version must share.
const summarize = () => [...document.querySelectorAll('sl-checkbox')].map(el => {
  const root = el.shadowRoot;
  const input = root.querySelector('input');
  return {
    text: el.textContent.trim(), checked: el.checked, indeterminate: el.indeterminate, disabled: el.disabled, size: el.size, helpText: el.helpText,
    inner: [input.checked, input.indeterminate, input.disabled], base: root.querySelector('[part="base"]').className,
    help: root.querySelector('[part="form-control-help-text"]').getAttribute('aria-hidden'), message: el.validationMessage,
  };
});

// Shoelace's React examples, ported in packages/docs/examples/checkbox/react/*.jsx (the files the docs page shows),
// bundled with React 19 and the generated wrappers, which are resolved through the package's real export map. Each one
// is rendered and compared with the HTML example it belongs to.
test.describe('React examples', () => {
  const reactDir = fileURLToPath(new URL('../../packages/docs/examples/checkbox/react/', import.meta.url));
  const velcroDir = fileURLToPath(new URL('../../packages/velcro/', import.meta.url));
  let bundle;

  test.beforeAll(async () => {
    const fromVelcro = createRequire(path.join(velcroDir, 'package.json'));
    const fromDocs = createRequire(fileURLToPath(new URL('../../packages/docs/package.json', import.meta.url)));
    const pkgDir = name => path.dirname(fromVelcro.resolve(`${name}/package.json`));
    const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
    const dir = mkdtempSync(path.join(tmpdir(), 'velcro-checkbox-react-'));
    try {
      // Each example file declares `App` without exporting it (as on Shoelace's page); the copy only appends the export.
      for (const [, name] of EXAMPLES) {
        writeFileSync(path.join(dir, `${name}.jsx`), `${readFileSync(path.join(reactDir, `${name}.jsx`), 'utf8')}\nexport default App;\n`);
      }
      const entry = path.join(dir, 'entry.js');
      // Examples render with a plain root.render(), as an application does, so React runs their effects after the
      // elements' first update (the Custom Validity example calls setCustomValidity() from an effect).
      writeFileSync(entry, `
        import React from 'react';
        import { flushSync } from 'react-dom';
        import { createRoot } from 'react-dom/client';
        import { VelcroCheckbox } from '@charm-ux/velcro/react/VelcroCheckbox.js';
        ${EXAMPLES.map(([, name], i) => `import App${i} from './${name}.jsx';`).join('\n')}
        const apps = { ${EXAMPLES.map(([, name], i) => `${JSON.stringify(name)}: App${i}`).join(', ')} };
        window.errors = [];
        addEventListener('error', e => window.errors.push(String(e.message)));
        addEventListener('unhandledrejection', e => window.errors.push(String(e.reason)));
        window.reactVersion = React.version;
        window.checkboxRef = React.createRef();
        let propsRoot;
        window.renderWithProps = props => {
          if (!propsRoot) {
            const host = document.createElement('div');
            document.body.append(host);
            propsRoot = createRoot(host);
          }
          flushSync(() => propsRoot.render(React.createElement(VelcroCheckbox, { ref: window.checkboxRef, ...props })));
        };
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
            return (await this.resolve(id, path.join(fileURLToPath(new URL('../../packages/docs/', import.meta.url)), 'app.ts'), { skipSelf: true })) ?? null;
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
    await page.setContent('<!DOCTYPE html><html><body style="margin: 0"></body></html>');
    await page.addScriptTag({ type: 'module', content: bundle });
    await page.waitForFunction(() => typeof window.renderExample === 'function');
    return pageErrors;
  }

  async function render(page, name) {
    await page.evaluate(n => {
      document.body.replaceChildren();
      window.renderExample(n);
    }, name);
    await page.waitForFunction(() => document.querySelector('sl-checkbox'));
    await page.evaluate(async () => {
      await customElements.whenDefined('sl-checkbox');
      await Promise.all([...document.querySelectorAll('sl-checkbox')].map(el => el.updateComplete));
      await new Promise(resolve => setTimeout(resolve, 50));
    });
  }

  test('every React example renders the same checkboxes as the HTML example it belongs to', async ({ page }) => {
    test.setTimeout(150_000);
    const htmlPage = await page.context().newPage();
    watchNetwork(htmlPage);
    const expected = {};
    try {
      await openDocs(htmlPage, PAGE);
      await documentsLoaded(htmlPage);
      for (const [title, name] of EXAMPLES) {
        const frame = frameFor(htmlPage, title);
        await expect(frame.locator('sl-checkbox').first()).toBeAttached();
        await frame.locator('body').evaluate(async () => {
          await customElements.whenDefined('sl-checkbox');
          await Promise.all([...document.querySelectorAll('sl-checkbox')].map(el => el.updateComplete));
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
      await render(page, name);
      const actual = await page.evaluate(summarize);
      expect(actual.length, name).toBeGreaterThan(0);
      if (name === 'help-text') {
        // Shoelace's React Help Text snippet keeps its upstream text, which says "switch" where the HTML example says
        // "checkbox"; only the help text differs.
        expect(actual.map(c => c.helpText), name).toEqual(['What should the user know about the switch?']);
        expect(actual.map(c => ({ ...c, helpText: '' })), name).toEqual(expected[name].map(c => ({ ...c, helpText: '' })));
      } else {
        expect(actual, name).toEqual(expected[name]);
      }
    }
    expect(expected['custom-validity'][0].message).toBe('Don\'t forget to check me!');
    expect(await page.evaluate(() => window.errors)).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('the wrapper passes properties and Shoelace\'s events: checked, indeterminate, size, helpText and onSlChange / onSlInput', async ({ page }) => {
    const pageErrors = await load(page);
    await page.evaluate(async () => {
      window.calls = [];
      window.props = {
        checked: false, indeterminate: true, size: 'large', helpText: 'Be sure', name: 'agree', value: 'yes', children: 'Agree',
        onSlChange: e => window.calls.push(`change:${e.target.checked}`), onSlInput: e => window.calls.push(`input:${e.target.checked}`),
      };
      window.renderWithProps(window.props);
      await customElements.whenDefined('sl-checkbox');
      await window.checkboxRef.current.updateComplete;
    });
    const read = () => page.evaluate(() => {
      const el = window.checkboxRef.current;
      const input = el.shadowRoot.querySelector('input');
      return { ctor: customElements.get('sl-checkbox') === el.constructor, checked: [el.checked, input.checked], indeterminate: [el.indeterminate, input.indeterminate], size: el.getAttribute('size'), help: el.helpText, name: input.name, value: input.value };
    });
    expect(await read()).toEqual({ ctor: true, checked: [false, false], indeterminate: [true, true], size: 'large', help: 'Be sure', name: 'agree', value: 'yes' });
    await page.locator('sl-checkbox [part~="control"]').click();
    expect(await page.evaluate(() => window.calls)).toEqual(['change:true', 'input:true']);
    expect((await read()).indeterminate).toEqual([false, false]);
    expect(pageErrors).toEqual([]);
  });
});
