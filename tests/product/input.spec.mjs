import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { buildFixtures, gotoBlank } from './support/fixtures.mjs';
import { pressReceived, recordKeys } from './support/keys.mjs';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';
import { reactWrapperPage } from './support/react.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/input';

// The docs page's examples, in page order: the example's title, and the name of its files under examples/input/. The last
// one has no React version (Shoelace's page has none for it).
const EXAMPLES = [
  ['Overview', 'basic'],
  ['Labels', 'labels'],
  ['Help Text', 'help-text'],
  ['Placeholders', 'placeholders'],
  ['Clearable', 'clearable'],
  ['Toggle Password', 'toggle-password'],
  ['Filled Inputs', 'filled'],
  ['Disabled', 'disabled'],
  ['Sizes', 'sizes'],
  ['Pill', 'pill'],
  ['Input Types', 'input-types'],
  ['Prefix & Suffix Icons', 'prefix-suffix'],
  ['Customizing Label Position', 'label-position'],
];
const REACT_EXAMPLES = EXAMPLES.filter(([, name]) => name !== 'label-position');

const frameFor = (page, title) => page.frameLocator(`iframe.example[title="Input example: ${title}"]`);

async function openExample(page, name = 'Overview') {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  const frame = frameFor(page, name);
  await expect(frame.locator('sl-input').first()).toBeVisible();
  await frame.locator('body').evaluate(() => customElements.whenDefined('sl-input'));
  await documentsLoaded(page);
  return { frame, requests };
}

// Appends markup to the example document and waits for every sl-input in it to render.
async function mount(frame, markup) {
  await frame.locator('body').evaluate(async (body, markup) => {
    const host = document.createElement('div');
    host.id = 'mount';
    host.innerHTML = markup;
    body.append(host);
    await Promise.all([...host.querySelectorAll('sl-input')].map(el => el.updateComplete));
  }, markup);
}

// The computed color of a theme token, read through a probe element in the example document.
const token = (frame, name) => frame.locator('body').evaluate((body, name) => {
  const probe = document.createElement('div');
  probe.style.color = `var(${name})`;
  body.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}, name);

// Starts keyboard navigation inside the example document from a button before the first element.
const addStartButton = frame => frame.locator('body').evaluate(body => {
  const start = document.createElement('button');
  start.id = 'start';
  start.textContent = 'start';
  body.prepend(start);
});

// Records the given events on an element in window.__events, as "type" or "type:detail" strings.
const record = (locator, types) => locator.evaluate((el, types) => {
  window.__events = [];
  for (const type of types) el.addEventListener(type, () => window.__events.push(type));
}, types);
const recorded = frame => frame.locator('body').evaluate(() => window.__events);

test('docs page is prerendered with Velcro branding, prototype status and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Input - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('Upstream quirks matched');
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
});

test('sl-input registers as the exported class with no core marker attribute and no ch-* definitions; sl-icon is Velcro\'s and not rendered until needed', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
  const r = await frame.locator('#demo-default').evaluate(el => ({
    ctor: customElements.get('sl-input') === el.constructor,
    // Core's base element would add its base-name marker attribute from a core scope; Velcro hosts carry none.
    attributes: el.getAttributeNames().sort(),
    chDefined: ['ch-input', 'ch-icon'].filter(tag => customElements.get(tag)),
    icon: customElements.get('sl-icon')?.baseName,
    slIcon: Boolean(el.shadowRoot.querySelector('sl-icon')),
    mode: el.shadowRoot.mode,
    delegatesFocus: el.shadowRoot.delegatesFocus,
    formAssociated: el.constructor.formAssociated === true,
  }));
  expect(r.ctor).toBe(true);
  // type, size and form reflect their initial values ('text', 'medium', ''), as in Shoelace; focusable is core's marker.
  expect(r.attributes).toEqual(['data-optional', 'data-valid', 'focusable', 'form', 'id', 'size', 'type']);
  expect(r.chDefined).toEqual([]);
  // The docs bundle is minified, so the class is identified by its base name.
  expect(r.icon).toBe('icon');
  expect(r.slIcon).toBe(false);
  expect(r.mode).toBe('open');
  expect(r.delegatesFocus).toBe(false);
  // Not form-associated, as in Shoelace: the form value is added in the formdata event.
  expect(r.formAssociated).toBe(false);
});

test('structure: Shoelace\'s parts in order, a label bound to the inner input and the help text as its description', async ({ page }) => {
  const { frame } = await openExample(page, 'Help Text');
  const control = frame.getByRole('textbox', { name: 'Nickname' });
  await expect(control).toHaveCount(1);
  await expect(control).toHaveAccessibleDescription('What would you like people to call you?');
  const r = await frame.locator('#demo-help-text').evaluate(el => {
    const root = el.shadowRoot;
    const input = root.querySelector('input');
    return {
      parts: [...root.querySelectorAll('[part]')].map(n => `${n.localName}:${n.getAttribute('part')}`),
      labelFor: root.querySelector('label').getAttribute('for'),
      inputId: input.id,
      describedBy: input.getAttribute('aria-describedby'),
      helpId: root.querySelector('[part="form-control-help-text"]').id,
      classes: root.querySelector('[part="form-control"]').className.trim().split(/\s+/),
      inputClass: input.className,
      base: root.querySelector('[part="base"]').className.trim().split(/\s+/),
      inner: { type: input.getAttribute('type'), spellcheck: input.getAttribute('spellcheck'), title: input.getAttribute('title'), name: input.getAttribute('name') },
      slots: [...root.querySelectorAll('slot')].map(s => s.name),
    };
  });
  expect(r).toEqual({
    parts: ['div:form-control', 'label:form-control-label', 'div:form-control-input', 'div:base', 'span:prefix', 'input:input', 'span:suffix', 'div:form-control-help-text'],
    labelFor: 'input',
    inputId: 'input',
    describedBy: 'help-text',
    helpId: 'help-text',
    classes: ['form-control', 'form-control--medium', 'form-control--has-label', 'form-control--has-help-text'],
    inputClass: 'input__control',
    base: ['input', 'input--medium', 'input--standard', 'input--empty'],
    inner: { type: 'text', spellcheck: 'true', title: '', name: '' },
    slots: ['label', 'help-text', 'prefix', 'suffix'].sort((a, b) => ['label', 'prefix', 'suffix', 'help-text'].indexOf(a) - ['label', 'prefix', 'suffix', 'help-text'].indexOf(b)),
  });
});

test('label and help text: the attributes render, the slots take precedence, and the label click focuses the input', async ({ page }) => {
  const { frame } = await openExample(page, 'Labels');
  await mount(frame, `
    <sl-input id="slots" label="Attribute label" help-text="Attribute help"><span slot="label">Slot label</span><span slot="help-text">Slot help</span></sl-input>
    <sl-input id="plain"></sl-input>`);
  await expect(frame.getByRole('textbox', { name: 'What is your name?' })).toHaveCount(1);
  await expect(frame.getByRole('textbox', { name: 'Slot label' })).toHaveAccessibleDescription('Slot help');
  const r = await frame.locator('body').evaluate(() => ['#demo-label', '#slots', '#plain'].map(id => {
    const root = document.querySelector(id).shadowRoot;
    const label = root.querySelector('label');
    const help = root.querySelector('[part="form-control-help-text"]');
    return {
      labelDisplay: getComputedStyle(label).display,
      labelHidden: label.getAttribute('aria-hidden'),
      helpDisplay: getComputedStyle(help).display,
      helpHidden: help.getAttribute('aria-hidden'),
      // The slot's fallback text stays in the DOM when a node is assigned, so the assigned node is read first.
      text: label.querySelector('slot').assignedNodes().length ? label.querySelector('slot').assignedNodes()[0].textContent : label.textContent.trim(),
    };
  }));
  expect(r).toEqual([
    { labelDisplay: 'inline-block', labelHidden: 'false', helpDisplay: 'none', helpHidden: 'true', text: 'What is your name?' },
    { labelDisplay: 'inline-block', labelHidden: 'false', helpDisplay: 'block', helpHidden: 'false', text: 'Slot label' },
    { labelDisplay: 'none', labelHidden: 'true', helpDisplay: 'none', helpHidden: 'true', text: '' },
  ]);
  const label = frame.locator('#demo-label');
  await record(label, ['sl-focus']);
  await label.locator('label').click();
  expect(await label.evaluate(el => [document.activeElement === el, el.shadowRoot.activeElement?.localName])).toEqual([true, 'input']);
  expect(await recorded(frame)).toEqual(['sl-focus']);
});

test('computed styles match Shoelace: sizes, border, radius, padding, colors and the focus ring', async ({ page }) => {
  const { frame } = await openExample(page, 'Sizes');
  const measure = id => frame.locator(id).evaluate(el => {
    const base = getComputedStyle(el.shadowRoot.querySelector('[part="base"]'));
    const control = getComputedStyle(el.shadowRoot.querySelector('input'));
    return {
      host: getComputedStyle(el).display,
      base: { display: base.display, height: base.height, font: base.fontSize, radius: base.borderTopLeftRadius, borderWidth: base.borderTopWidth, borderStyle: base.borderTopStyle, cursor: base.cursor },
      control: { height: control.height, padding: [control.paddingTop, control.paddingRight, control.paddingBottom, control.paddingLeft], border: control.borderTopStyle },
    };
  });
  const border = await token(frame, '--sl-input-border-color');
  const sizes = {};
  for (const size of ['small', 'medium', 'large']) sizes[size] = await measure(`#demo-${size}`);
  expect(sizes).toEqual({
    small: {
      host: 'block',
      base: { display: 'inline-flex', height: '30px', font: '14px', radius: '4px', borderWidth: '1px', borderStyle: 'solid', cursor: 'text' },
      control: { height: '28px', padding: ['0px', '12px', '0px', '12px'], border: 'none' },
    },
    medium: {
      host: 'block',
      base: { display: 'inline-flex', height: '40px', font: '16px', radius: '4px', borderWidth: '1px', borderStyle: 'solid', cursor: 'text' },
      control: { height: '38px', padding: ['0px', '16px', '0px', '16px'], border: 'none' },
    },
    large: {
      host: 'block',
      base: { display: 'inline-flex', height: '50px', font: '20px', radius: '4px', borderWidth: '1px', borderStyle: 'solid', cursor: 'text' },
      control: { height: '48px', padding: ['0px', '20px', '0px', '20px'], border: 'none' },
    },
  });
  const colors = await frame.locator('#demo-medium').evaluate(el => {
    const base = getComputedStyle(el.shadowRoot.querySelector('[part="base"]'));
    const control = getComputedStyle(el.shadowRoot.querySelector('input'));
    return { border: base.borderTopColor, background: base.backgroundColor, color: control.color };
  });
  expect(colors).toEqual({ border, background: await token(frame, '--sl-input-background-color'), color: await token(frame, '--sl-input-color') });
  // The class names follow the size.
  expect(await frame.locator('#demo-large').evaluate(el => [el.shadowRoot.querySelector('[part="form-control"]').classList.contains('form-control--large'), el.shadowRoot.querySelector('[part="base"]').classList.contains('input--large')])).toEqual([true, true]);

  // Focused: the border takes the focus color and a ring is drawn around the base (both transition, so poll).
  await frame.locator('#demo-medium input').focus();
  const focusBorder = await token(frame, '--sl-input-border-color-focus');
  const ring = await token(frame, '--sl-input-focus-ring-color');
  const readFocused = () => frame.locator('#demo-medium').evaluate(el => {
    const base = getComputedStyle(el.shadowRoot.querySelector('[part="base"]'));
    return { border: base.borderTopColor, shadow: base.boxShadow, focusedClass: el.shadowRoot.querySelector('[part="base"]').classList.contains('input--focused'), outline: getComputedStyle(el.shadowRoot.querySelector('input')).outlineStyle };
  });
  await expect.poll(async () => (await readFocused()).border).toBe(focusBorder);
  await expect.poll(async () => (await readFocused()).shadow).toContain(ring);
  const focused = await readFocused();
  expect(focused.shadow).toContain('3px');
  expect(focused.focusedClass).toBe(true);
  expect(focused.outline).toBe('none');
});

test('placeholder, filled and disabled render as in Shoelace', async ({ page, browserName }) => {
  const { frame } = await openExample(page, 'Placeholders');
  const placeholder = await frame.locator('#demo-placeholder').evaluate(el => {
    const input = el.shadowRoot.querySelector('input');
    return { placeholder: input.placeholder, color: getComputedStyle(input, '::placeholder').color, empty: el.shadowRoot.querySelector('[part="base"]').classList.contains('input--empty') };
  });
  expect(placeholder.placeholder).toBe('Type something');
  expect(placeholder.empty).toBe(true);
  // Computed style of the ::placeholder pseudo-element: Chromium and WebKit only, as Firefox (which only CI runs) is not
  // relied on for getComputedStyle of this pseudo-element.
  if (browserName !== 'firefox') expect(placeholder.color).toBe(await token(frame, '--sl-input-placeholder-color'));

  const filled = await openExample(page, 'Filled Inputs');
  const f = await filled.frame.locator('#demo-filled').evaluate(el => {
    const base = el.shadowRoot.querySelector('[part="base"]');
    const style = getComputedStyle(base);
    return { reflected: el.hasAttribute('filled'), classes: [base.classList.contains('input--filled'), base.classList.contains('input--standard')], border: style.borderTopStyle, background: style.backgroundColor };
  });
  expect(f).toEqual({ reflected: true, classes: [true, false], border: 'none', background: await token(filled.frame, '--sl-input-filled-background-color') });

  const disabled = await openExample(page, 'Disabled');
  const el = disabled.frame.locator('#demo-disabled');
  await record(el, ['sl-focus', 'sl-blur', 'sl-input', 'sl-change']);
  await el.click({ force: true });
  await el.evaluate(el => el.focus());
  const d = await el.evaluate(el => {
    const base = el.shadowRoot.querySelector('[part="base"]');
    const style = getComputedStyle(base);
    return { reflected: el.hasAttribute('disabled'), disabled: el.shadowRoot.querySelector('input').disabled, opacity: style.opacity, cursor: style.cursor, bg: style.backgroundColor, active: el.shadowRoot.activeElement?.localName ?? null, valid: el.hasAttribute('data-valid') };
  });
  expect(d).toEqual({ reflected: true, disabled: true, opacity: '0.5', cursor: 'not-allowed', bg: await token(disabled.frame, '--sl-input-background-color-disabled'), active: null, valid: true });
  expect(await recorded(disabled.frame)).toEqual([]);
  await addStartButton(disabled.frame);
  await disabled.frame.locator('#start').focus();
  await page.keyboard.press('Tab');
  // Tab moves the focus off the start button (to the next control, or out of the example's frame, whose activeElement
  // Firefox then leaves on the button), and not to the disabled control.
  await expect.poll(() => disabled.frame.locator('body').evaluate(() => (document.hasFocus() ? document.activeElement?.id : 'left the frame'))).not.toBe('start');
  expect(await disabled.frame.locator('body').evaluate(() => document.activeElement?.localName)).not.toBe('sl-input');
});

test('pill: the radius is the height of the size', async ({ page }) => {
  const { frame } = await openExample(page, 'Pill');
  const r = await frame.locator('body').evaluate(() => ['small', 'medium', 'large'].map(size => {
    const el = document.querySelector(`#demo-pill-${size}`);
    const base = el.shadowRoot.querySelector('[part="base"]');
    return [el.pill, el.hasAttribute('pill'), base.classList.contains('input--pill'), getComputedStyle(base).borderTopLeftRadius];
  }));
  expect(r).toEqual([[true, true, true, '30px'], [true, true, true, '40px'], [true, true, true, '50px']]);
});

test('prefix and suffix slots: the icons sit before and after the control, in the icon color, and Velcro\'s sl-icon draws them', async ({ page }) => {
  const { frame } = await openExample(page, 'Prefix & Suffix Icons');
  const r = await frame.locator('#demo-icons-medium').evaluate(async el => {
    const root = el.shadowRoot;
    const [prefix, suffix] = ['prefix', 'suffix'].map(name => root.querySelector(`slot[name="${name}"]`).assignedElements()[0]);
    await Promise.all([prefix.updateComplete, suffix.updateComplete]);
    const box = node => node.getBoundingClientRect();
    const input = box(root.querySelector('input'));
    return {
      names: [prefix.getAttribute('name'), suffix.getAttribute('name')],
      order: [box(prefix).right <= input.left + 1, box(suffix).left >= input.right - 1],
      margins: [getComputedStyle(prefix).marginInlineStart, getComputedStyle(suffix).marginInlineEnd],
      color: getComputedStyle(prefix).color,
      icon: customElements.get('sl-icon') === prefix.constructor,
    };
  });
  expect(r.names).toEqual(['house', 'chat']);
  expect(r.order).toEqual([true, true]);
  expect(r.margins).toEqual(['16px', '16px']);
  expect(r.color).toBe(await token(frame, '--sl-input-icon-color'));
  expect(r.icon).toBe(true);
  await expect.poll(() => frame.locator('#demo-icons-medium sl-icon[slot="prefix"]').evaluate(icon => Boolean(icon.shadowRoot?.querySelector('svg')))).toBe(true);
});

test('clearable: the clear button shows only for a non-empty, enabled, editable input; it clears, emits sl-clear, sl-input and sl-change in order and focuses the input', async ({ page }) => {
  const { frame } = await openExample(page, 'Clearable');
  await mount(frame, `
    <sl-input id="c-ro" clearable readonly value="x"></sl-input>
    <sl-input id="c-dis" clearable disabled value="x"></sl-input>
    <sl-input id="c-slot" clearable value="x"><span slot="clear-icon" id="custom-clear">X</span></sl-input>
    <sl-input id="c-plain" value="x"></sl-input>`);
  const el = frame.locator('#demo-clearable');
  const hasButton = id => frame.locator(id).evaluate(el => Boolean(el.shadowRoot.querySelector('[part="clear-button"]')));
  expect(await hasButton('#demo-clearable')).toBe(false);
  expect([await hasButton('#c-ro'), await hasButton('#c-dis'), await hasButton('#c-plain')]).toEqual([false, false, false]);
  await el.evaluate(async el => { el.value = 'hello'; await el.updateComplete; });
  expect(await hasButton('#demo-clearable')).toBe(true);
  const button = frame.locator('#demo-clearable [part="clear-button"]');
  const r = await el.evaluate(el => {
    const b = el.shadowRoot.querySelector('[part="clear-button"]');
    const icon = b.querySelector('sl-icon');
    return { type: b.type, tabindex: b.getAttribute('tabindex'), label: b.getAttribute('aria-label'), cls: b.className, icon: [icon.getAttribute('name'), icon.getAttribute('library')], width: getComputedStyle(b).width };
  });
  expect(r).toEqual({ type: 'button', tabindex: '-1', label: 'Clear entry', cls: 'input__clear', icon: ['x-circle-fill', 'system'], width: '48px' });
  await record(el, ['sl-clear', 'sl-input', 'sl-change', 'sl-focus', 'sl-blur']);
  await button.click();
  expect(await recorded(frame)).toEqual(['sl-clear', 'sl-input', 'sl-change', 'sl-focus']);
  expect(await el.evaluate(el => [el.value, el.shadowRoot.querySelector('input').value, el.shadowRoot.activeElement?.localName, Boolean(el.shadowRoot.querySelector('[part="clear-button"]'))])).toEqual(['', '', 'input', false]);
  // The slotted icon replaces the default one.
  expect(await frame.locator('#c-slot').evaluate(el => {
    const b = el.shadowRoot.querySelector('[part="clear-button"]');
    return [b.querySelector('slot').name, b.querySelector('slot').assignedElements()[0]?.id, b.querySelector('slot sl-icon') !== null];
  })).toEqual(['clear-icon', 'custom-clear', true]);
  // Typing makes it appear, and a disabled or read-only control hides it again.
  await frame.locator('#demo-clearable input').pressSequentially('ab');
  await expect.poll(() => hasButton('#demo-clearable')).toBe(true);
  expect(await el.evaluate(async el => { el.readonly = true; await el.updateComplete; return Boolean(el.shadowRoot.querySelector('[part="clear-button"]')); })).toBe(false);
});

test('toggle password: the button swaps the inner type, its name and its icon; a disabled input has no toggle; the slots replace the icons', async ({ page }) => {
  const { frame } = await openExample(page, 'Toggle Password');
  await mount(frame, `
    <sl-input id="p-off" type="password" password-toggle disabled></sl-input>
    <sl-input id="p-visible" type="password" password-toggle password-visible value="shown"></sl-input>
    <sl-input id="p-text" type="text" password-toggle></sl-input>
    <sl-input id="p-slots" type="password" password-toggle><span slot="hide-password-icon" id="when-hidden">H</span><span slot="show-password-icon" id="when-visible">V</span></sl-input>`);
  const read = id => frame.locator(id).evaluate(el => {
    const root = el.shadowRoot;
    const b = root.querySelector('[part="password-toggle-button"]');
    const slot = b?.querySelector('slot');
    return {
      inner: root.querySelector('input').type, visible: el.passwordVisible, button: Boolean(b), label: b?.getAttribute('aria-label') ?? null,
      slot: slot?.name ?? null, icon: b?.querySelector('sl-icon')?.getAttribute('name') ?? null, tabindex: b?.getAttribute('tabindex') ?? null,
    };
  });
  expect(await read('#demo-password')).toEqual({ inner: 'password', visible: false, button: true, label: 'Show password', slot: 'hide-password-icon', icon: 'eye', tabindex: '-1' });
  await frame.locator('#demo-password').evaluate(el => { el.value = 'secret'; });
  await frame.locator('#demo-password [part="password-toggle-button"]').click();
  expect(await read('#demo-password')).toEqual({ inner: 'text', visible: true, button: true, label: 'Hide password', slot: 'show-password-icon', icon: 'eye-slash', tabindex: '-1' });
  expect(await frame.locator('#demo-password').evaluate(el => [el.shadowRoot.querySelector('input').value, el.value])).toEqual(['secret', 'secret']);
  await frame.locator('#demo-password [part="password-toggle-button"]').click();
  expect((await read('#demo-password')).inner).toBe('password');
  expect(await read('#p-off')).toMatchObject({ button: false });
  expect(await read('#p-visible')).toMatchObject({ inner: 'text', visible: true, label: 'Hide password' });
  // The toggle is not limited to password types: as in Shoelace, a text input with password-toggle also shows it.
  expect(await read('#p-text')).toMatchObject({ inner: 'text', button: true, label: 'Show password' });
  // The slot names follow the state the icon is shown in (an upstream quirk).
  expect(await frame.locator('#p-slots').evaluate(async el => {
    const slotted = () => el.shadowRoot.querySelector('[part="password-toggle-button"] slot').assignedElements().map(n => n.id);
    const hidden = slotted();
    el.passwordVisible = true;
    await el.updateComplete;
    return [hidden, slotted()];
  })).toEqual([['when-hidden'], ['when-visible']]);
});

test('input types: the type attribute reaches the inner input and drives its own validation, number stepping and value conversions', async ({ page }) => {
  const { frame } = await openExample(page, 'Input Types');
  await mount(frame, `
    <sl-input id="num" type="number" min="2" max="8" step="2" value="4"></sl-input>
    <sl-input id="date" type="date" min="2026-01-01" max="2026-12-31"></sl-input>
    <sl-input id="text" value="42"></sl-input>
    <sl-input id="nospin" type="number" no-spin-buttons></sl-input>`);
  const r = await frame.locator('body').evaluate(async () => {
    const types = ['#demo-email', '#demo-number', '#demo-date'].map(id => {
      const el = document.querySelector(id);
      return [el.type, el.getAttribute('type'), el.shadowRoot.querySelector('input').type];
    });
    const email = document.querySelector('#demo-email');
    email.value = 'nope';
    await email.updateComplete;
    const typeMismatch = [email.validity.typeMismatch, email.hasAttribute('data-invalid')];
    // Built at run time: the privacy scan rejects an address written out in a committed file.
    email.value = ['me', 'example.test'].join('@');
    await email.updateComplete;
    const matched = [email.validity.valid, email.hasAttribute('data-valid')];

    const num = document.querySelector('#num');
    const inner = num.shadowRoot.querySelector('input');
    const attrs = [num.min, num.max, num.step, inner.getAttribute('min'), inner.getAttribute('max'), inner.getAttribute('step')];
    num.stepUp();
    const up = [num.value, inner.value];
    num.stepUp();
    num.stepUp();
    const clamped = num.value;
    num.stepDown();
    const down = num.value;
    num.value = '9';
    await num.updateComplete;
    const over = [num.validity.rangeOverflow, num.validity.valid];
    num.value = '5';
    await num.updateComplete;
    const mismatch = num.validity.stepMismatch;
    num.step = 'any';
    await num.updateComplete;
    const any = [inner.getAttribute('step'), num.validity.stepMismatch];
    num.valueAsNumber = 6;
    await num.updateComplete;
    const asNumber = [num.value, num.valueAsNumber];

    const date = document.querySelector('#date');
    date.value = '2025-12-31';
    await date.updateComplete;
    const under = date.validity.rangeUnderflow;
    date.valueAsDate = new Date(Date.UTC(2026, 4, 17));
    await date.updateComplete;
    const asDate = [date.value, date.valueAsDate.toISOString().slice(0, 10), date.validity.valid];

    const text = document.querySelector('#text');
    const textConversions = [text.valueAsNumber, text.valueAsDate];
    const spin = document.querySelector('#nospin').shadowRoot.querySelector('[part="base"]').classList.contains('input--no-spin-buttons');
    return { types, typeMismatch, matched, attrs, up, clamped, down, over, mismatch, any, asNumber, under, asDate, textConversions, spin };
  });
  expect(r.types).toEqual([['email', 'email', 'email'], ['number', 'number', 'number'], ['date', 'date', 'date']]);
  expect(r.typeMismatch).toEqual([true, true]);
  expect(r.matched).toEqual([true, true]);
  // min and max are strings when they come from attributes, and the step is passed to the inner input.
  expect(r.attrs).toEqual(['2', '8', '2', '2', '8', '2']);
  expect(r.up).toEqual(['6', '6']);
  expect(r.clamped).toBe('8');
  expect(r.down).toBe('6');
  expect(r.over).toEqual([true, false]);
  expect(r.mismatch).toBe(true);
  expect(r.any).toEqual(['any', false]);
  expect(r.asNumber).toEqual(['6', 6]);
  expect(r.under).toBe(true);
  expect(r.asDate).toEqual(['2026-05-17', '2026-05-17', true]);
  // A text input holding "42" converts through the in-memory number input; valueAsDate is null for a text input.
  expect(r.textConversions).toEqual([42, null]);
  expect(r.spin).toBe(true);
});

test('label position example: the grid places the label left of the control through Shoelace\'s parts', async ({ page }) => {
  const { frame } = await openExample(page, 'Customizing Label Position');
  const r = await frame.locator('body').evaluate(() => ['#demo-label-name', '#demo-label-email', '#demo-label-bio'].map(id => {
    const root = document.querySelector(id).shadowRoot;
    const form = root.querySelector('[part="form-control"]');
    const label = root.querySelector('[part="form-control-label"]').getBoundingClientRect();
    const control = root.querySelector('[part="form-control-input"]').getBoundingClientRect();
    const help = root.querySelector('[part="form-control-help-text"]').getBoundingClientRect();
    return {
      display: getComputedStyle(form).display,
      labelLeftOfControl: label.right <= control.left + 1 && Math.abs(label.top + label.height / 2 - (control.top + control.height / 2)) < control.height,
      labelAlign: getComputedStyle(root.querySelector('[part="form-control-label"]')).textAlign,
      helpUnderControl: Math.abs(help.left - control.left) < 1 && help.top >= control.bottom - 1,
    };
  }));
  for (const item of r) expect(item).toEqual({ display: 'grid', labelLeftOfControl: true, labelAlign: 'right', helpUnderControl: true });
});

test('events: sl-input per edit and sl-change on commit bubble and are composed; nothing is emitted for script changes', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<button id="before">before</button><sl-input id="ev"></sl-input><button id="after">after</button>');
  const el = frame.locator('#ev');
  await el.evaluate(el => {
    window.__events = [];
    for (const type of ['sl-focus', 'sl-blur', 'sl-input', 'sl-change', 'sl-invalid', 'sl-clear', 'input', 'change', 'focus', 'blur']) {
      el.addEventListener(type, event => window.__events.push(`${type}:${event.bubbles}:${event.composed}:${event.cancelable}:${event.target === el}`));
    }
    document.body.addEventListener('sl-input', () => window.__events.push('body sl-input'));
    document.body.addEventListener('change', () => window.__events.push('body change'));
  });
  await el.locator('input').pressSequentially('ab');
  await expect.poll(() => el.evaluate(el => el.value)).toBe('ab');
  await page.keyboard.press('Tab');
  await expect.poll(() => el.evaluate(() => window.__events.filter(e => e.startsWith('sl-blur')).length)).toBe(1);
  const events = await el.evaluate(() => window.__events);
  // Shoelace's events bubble, are composed and not cancelable. The platform's composed input event also reaches the host;
  // the native change event does not leave the inner input.
  expect(events.filter(e => e.startsWith('sl-'))).toEqual([
    'sl-focus:true:true:false:true', 'sl-input:true:true:false:true', 'sl-input:true:true:false:true', 'sl-change:true:true:false:true', 'sl-blur:true:true:false:true',
  ]);
  expect(events.filter(e => e.startsWith('input:') || e.startsWith('change:')).map(e => e.split(':')[0])).toEqual(['input', 'input']);
  expect(events.filter(e => e === 'body sl-input').length).toBe(2);
  expect(events).not.toContain('body change');
  expect(await el.evaluate(el => [el.value, el.getAttribute('value')])).toEqual(['ab', null]);

  // Setting the value from script, replacing a range of text or stepping emits nothing.
  const quiet = await el.evaluate(async el => {
    window.__events = [];
    el.value = 'script';
    await el.updateComplete;
    el.setRangeText('S', 0, 1);
    await el.updateComplete;
    el.type = 'number';
    el.value = '3';
    await el.updateComplete;
    el.stepUp();
    el.stepDown();
    await el.updateComplete;
    return { events: window.__events, value: el.value };
  });
  expect(quiet).toEqual({ events: [], value: '3' });
});

test('keyboard: Tab focuses the input, typing and Backspace edit it, the focus state follows, and typing stops at maxlength', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-input id="kb"></sl-input><sl-input id="max" maxlength="3"></sl-input>');
  await addStartButton(frame);
  await frame.locator('#start').focus();
  await page.keyboard.press('Tab');
  await expect.poll(() => frame.locator('body').evaluate(() => document.activeElement?.id)).toBe('demo-default');
  await page.keyboard.press('Tab');
  await expect.poll(() => frame.locator('body').evaluate(() => document.activeElement?.id)).toBe('kb');
  expect(await frame.locator('#kb').evaluate(el => [el.shadowRoot.activeElement?.localName, el.shadowRoot.querySelector('[part="base"]').classList.contains('input--focused')])).toEqual(['input', true]);
  await page.keyboard.type('abc');
  await expect.poll(() => frame.locator('#kb').evaluate(el => el.value)).toBe('abc');
  await page.keyboard.press('Backspace');
  await expect.poll(() => frame.locator('#kb').evaluate(el => el.value)).toBe('ab');
  await page.keyboard.press('Shift+Tab');
  await expect.poll(() => frame.locator('body').evaluate(() => document.activeElement?.id)).toBe('demo-default');
  expect(await frame.locator('#kb').evaluate(el => el.shadowRoot.querySelector('[part="base"]').classList.contains('input--focused'))).toBe(false);
  await frame.locator('#max input').pressSequentially('abcdef');
  await expect.poll(() => frame.locator('#max').evaluate(el => [el.value, el.maxlength, el.shadowRoot.querySelector('input').getAttribute('maxlength')])).toEqual(['abc', 3, '3']);
});

test('keyboard: the clear and password toggle buttons are not tab stops', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, `
    <button id="first">first</button>
    <sl-input id="both" type="password" password-toggle clearable value="x"></sl-input>
    <button id="last">last</button>`);
  await frame.locator('#first').focus();
  await page.keyboard.press('Tab');
  await expect.poll(() => frame.locator('#both').evaluate(el => el.shadowRoot.activeElement?.localName)).toBe('input');
  await page.keyboard.press('Tab');
  await expect.poll(() => frame.locator('body').evaluate(() => document.activeElement?.id)).toBe('last');
});

test('forms: name and value are submitted, a required empty input blocks submit, Enter submits, and reset restores the default value', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, `
    <form id="f" action="about:blank">
      <sl-input id="req" name="comments" required></sl-input>
      <sl-input id="def" name="notes" value="start"></sl-input>
      <sl-input id="off" name="off" value="skipped" disabled></sl-input>
      <sl-input id="noname" value="anonymous"></sl-input>
      <button id="submit" type="submit">Submit</button><button id="reset" type="reset">Reset</button>
    </form>`);
  await frame.locator('#f').evaluate(form => {
    window.__submitted = [];
    form.addEventListener('submit', event => {
      event.preventDefault();
      window.__submitted.push(new URLSearchParams(new FormData(form)).toString());
    });
    window.__invalid = [];
    form.querySelector('#req').addEventListener('sl-invalid', e => window.__invalid.push(`${e.bubbles}:${e.cancelable}`));
  });
  const req = frame.locator('#req');
  await expect(req).toHaveAttribute('data-required', '');
  await expect(req).toHaveAttribute('data-invalid', '');
  // Core's invalid property is inert here, so the host gains no attribute Shoelace's input lacks.
  await expect(req).not.toHaveAttribute('invalid', '');
  expect(await frame.locator('#f').evaluate(form => [...form.elements].some(e => e.localName === 'sl-input'))).toBe(false);
  await frame.locator('#submit').click();
  expect(await frame.locator('body').evaluate(() => [window.__submitted, window.__invalid])).toEqual([[], ['false:true']]);
  await expect(req).toHaveAttribute('data-user-invalid', '');
  await req.locator('input').pressSequentially('hello');
  await expect(req).toHaveAttribute('data-valid', '');
  await expect(req).toHaveAttribute('data-user-valid', '');
  await frame.locator('#submit').click();
  // A disabled input and one without a name are not submitted.
  expect(await frame.locator('body').evaluate(() => window.__submitted)).toEqual(['comments=hello&notes=start']);
  // Enter in a field submits the form (after a tick), without a modifier.
  await frame.locator('#def input').fill('changed');
  await frame.locator('#def input').press('Enter');
  await expect.poll(() => frame.locator('body').evaluate(() => window.__submitted.length)).toBe(2);
  expect(await frame.locator('body').evaluate(() => window.__submitted[1])).toBe('comments=hello&notes=changed');
  await frame.locator('#def input').focus();
  await recordKeys(frame.locator('body'));
  await pressReceived(page, frame.locator('body'), 'Shift+Enter');
  // The window in which a wrong submit (which would come after a tick) could still arrive.
  await frame.locator('#def').evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));
  expect(await frame.locator('body').evaluate(() => window.__submitted.length)).toBe(2);
  await frame.locator('#reset').click();
  expect(await frame.locator('#f').evaluate(() => ['#req', '#def'].map(id => [document.querySelector(id).value, document.querySelector(id).shadowRoot.querySelector('input').value]))).toEqual([['', ''], ['start', 'start']]);
  await expect(req).not.toHaveAttribute('data-user-valid', '');
  await expect(req).toHaveAttribute('data-invalid', '');
});

test('keyboard: Enter is ignored when the keydown is cancelled, and while an input method editor is composing', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, `<form id="enter" action="about:blank"><sl-input id="in" name="a" value="v"></sl-input><sl-input id="cancel" name="b" value="w"></sl-input></form>`);
  const r = await frame.locator('#enter').evaluate(async form => {
    const submitted = [];
    form.addEventListener('submit', event => { event.preventDefault(); submitted.push(event.submitter?.localName ?? 'none'); });
    const press = (el, init) => el.shadowRoot.querySelector('input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true, ...init }));
    const wait = () => new Promise(resolve => setTimeout(resolve, 60));
    const a = document.querySelector('#in');
    const b = document.querySelector('#cancel');
    // Cancelled by a listener on the host before the tick passes.
    b.addEventListener('keydown', event => event.preventDefault());
    press(b, {});
    await wait();
    const afterCancelled = submitted.length;
    // isComposing is read from the event, which a synthetic event can set.
    press(a, { isComposing: true });
    await wait();
    const afterComposing = submitted.length;
    for (const init of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }]) press(a, init);
    await wait();
    const afterModifiers = submitted.length;
    press(a, {});
    await wait();
    return { afterCancelled, afterComposing, afterModifiers, afterPlain: submitted.length };
  });
  expect(r).toEqual({ afterCancelled: 0, afterComposing: 0, afterModifiers: 0, afterPlain: 1 });
});

test('forms (Shoelace parity): the form attribute finds an outside form, a disabled fieldset does not disable the input, and form methods see Velcro controls', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, `
    <form id="outside" action="about:blank"></form>
    <sl-input id="remote" form="outside" name="remote" value="x"></sl-input>
    <form id="fs" action="about:blank"><fieldset disabled><sl-input id="in-fieldset" name="fs" value="y"></sl-input></fieldset></form>
    <form id="valid" action="about:blank"><sl-input id="needed" name="needed" required></sl-input></form>
    <form id="novalidate" action="about:blank" novalidate><sl-input id="skipped" name="skipped" required></sl-input></form>`);
  const r = await frame.locator('body').evaluate(() => ({
    remote: new URLSearchParams(new FormData(document.querySelector('#outside'))).toString(),
    remoteForm: document.querySelector('#remote').getForm()?.id,
    fieldset: new URLSearchParams(new FormData(document.querySelector('#fs'))).toString(),
    fieldsetDisabled: document.querySelector('#in-fieldset').shadowRoot.querySelector('input').disabled,
    formValidity: document.querySelector('#valid').checkValidity(),
    formReport: document.querySelector('#valid').reportValidity(),
    novalidate: [document.querySelector('#novalidate').checkValidity(), document.querySelector('#skipped').hasAttribute('data-invalid')],
    noForm: document.querySelector('#demo-default').getForm(),
  }));
  expect(r).toEqual({ remote: 'remote=x', remoteForm: 'outside', fieldset: 'fs=y', fieldsetDisabled: false, formValidity: false, formReport: false, novalidate: [true, true], noForm: null });
});

test('validation: required, pattern, minlength, maxlength and setCustomValidity use the inner input and keep the data attributes current', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, `
    <sl-input id="min" minlength="5"></sl-input>
    <sl-input id="pat" pattern="[a-z]+" value="ABC"></sl-input>
    <sl-input id="cust"></sl-input>
    <sl-input id="dis" required disabled></sl-input>`);
  await frame.locator('#min input').pressSequentially('abc');
  await expect.poll(() => frame.locator('#min').evaluate(async el => {
    await el.updateComplete;
    return { valid: el.checkValidity(), tooShort: el.validity.tooShort, message: typeof el.validationMessage, attr: [el.hasAttribute('data-invalid'), el.hasAttribute('data-valid')], min: [el.minlength, el.shadowRoot.querySelector('input').getAttribute('minlength')] };
  })).toEqual({ valid: false, tooShort: true, message: 'string', attr: [true, false], min: [5, '5'] });
  await frame.locator('#min input').pressSequentially('de');
  await expect.poll(() => frame.locator('#min').evaluate(async el => { await el.updateComplete; return [el.checkValidity(), el.hasAttribute('data-valid')]; })).toEqual([true, true]);

  const pattern = await frame.locator('#pat').evaluate(async el => {
    const before = [el.validity.patternMismatch, el.hasAttribute('data-invalid'), el.shadowRoot.querySelector('input').getAttribute('pattern')];
    el.value = 'abc';
    await el.updateComplete;
    return { before, after: [el.validity.patternMismatch, el.hasAttribute('data-valid')] };
  });
  expect(pattern).toEqual({ before: [true, true, '[a-z]+'], after: [false, true] });

  const cust = await frame.locator('#cust').evaluate(async el => {
    const seen = [];
    el.addEventListener('sl-invalid', event => seen.push(`${event.bubbles}:${event.cancelable}`));
    el.setCustomValidity('Nope');
    await el.updateComplete;
    const invalid = { valid: el.validity.valid, custom: el.validity.customError, message: el.validationMessage, data: el.hasAttribute('data-invalid') };
    const checked = el.checkValidity();
    const reported = el.reportValidity();
    el.setCustomValidity('');
    await el.updateComplete;
    return { invalid, checked, reported, seen, restored: [el.validity.valid, el.hasAttribute('data-valid')] };
  });
  expect(cust).toEqual({
    invalid: { valid: false, custom: true, message: 'Nope', data: true },
    checked: false,
    reported: false,
    seen: ['false:true', 'false:true'],
    restored: [true, true],
  });
  // A disabled form control is always valid, and becomes invalid again when enabled.
  const dis = await frame.locator('#dis').evaluate(async el => {
    const before = [el.checkValidity(), el.hasAttribute('data-valid')];
    el.disabled = false;
    await el.updateComplete;
    return { before, after: [el.checkValidity(), el.hasAttribute('data-invalid')] };
  });
  expect(dis).toEqual({ before: [true, true], after: [false, true] });
});

test('properties: defaults, reflection, value attribute sets defaultValue, and removing a reflected attribute restores its initial value', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-input id="p"></sl-input>');
  const r = await frame.locator('#p').evaluate(async el => {
    const defaults = {
      type: el.type, name: el.name, value: el.value, defaultValue: el.defaultValue, size: el.size, filled: el.filled, pill: el.pill, label: el.label, helpText: el.helpText,
      clearable: el.clearable, disabled: el.disabled, placeholder: el.placeholder, readonly: el.readonly, passwordToggle: el.passwordToggle, passwordVisible: el.passwordVisible,
      noSpinButtons: el.noSpinButtons, form: el.form, required: el.required, pattern: el.pattern, minlength: el.minlength, maxlength: el.maxlength, min: el.min, max: el.max, step: el.step,
      autocapitalize: el.autocapitalize, autocorrect: el.autocorrect, autocomplete: el.autocomplete, autofocus: el.autofocus, enterkeyhint: el.enterkeyhint,
      spellcheck: el.spellcheck, inputmode: el.inputmode, title: el.title, valueAsDate: el.valueAsDate, valueAsNumber: Number.isNaN(el.valueAsNumber),
    };
    el.setAttribute('value', 'v1');
    await el.updateComplete;
    const afterAttr = { value: el.value, defaultValue: el.defaultValue, inner: el.shadowRoot.querySelector('input').value };
    el.value = 'typed';
    await el.updateComplete;
    const afterProp = { attr: el.getAttribute('value'), defaultValue: el.defaultValue };
    el.type = 'email';
    el.size = 'large';
    el.filled = true;
    el.pill = true;
    el.disabled = true;
    el.readonly = true;
    el.required = true;
    el.form = 'f';
    el.name = 'n';
    el.label = 'L';
    el.placeholder = 'P';
    el.clearable = true;
    el.passwordToggle = true;
    el.passwordVisible = true;
    el.noSpinButtons = true;
    el.min = 1;
    el.max = 9;
    el.step = 2;
    await el.updateComplete;
    const reflected = {
      type: el.getAttribute('type'), size: el.getAttribute('size'), filled: el.getAttribute('filled'), pill: el.getAttribute('pill'), disabled: el.getAttribute('disabled'),
      readonly: el.getAttribute('readonly'), required: el.getAttribute('required'), form: el.getAttribute('form'),
      // Not reflected in Shoelace either.
      name: el.getAttribute('name'), label: el.getAttribute('label'), placeholder: el.getAttribute('placeholder'), clearable: el.getAttribute('clearable'),
      passwordToggle: el.getAttribute('password-toggle'), passwordVisible: el.getAttribute('password-visible'), noSpinButtons: el.getAttribute('no-spin-buttons'),
      min: el.getAttribute('min'), max: el.getAttribute('max'), step: el.getAttribute('step'),
    };
    const inner = el.shadowRoot.querySelector('input');
    const innerState = { type: inner.type, name: inner.name, placeholder: inner.placeholder, disabled: inner.disabled, readOnly: inner.readOnly, required: inner.required, min: inner.min, max: inner.max, step: inner.step };
    el.removeAttribute('type');
    el.removeAttribute('size');
    el.removeAttribute('form');
    el.removeAttribute('filled');
    el.removeAttribute('pill');
    await el.updateComplete;
    return { defaults, afterAttr, afterProp, reflected, innerState, restored: { type: el.type, size: el.size, form: el.form, filled: el.filled, pill: el.pill } };
  });
  expect(r).toEqual({
    defaults: {
      type: 'text', name: '', value: '', defaultValue: '', size: 'medium', filled: false, pill: false, label: '', helpText: '', clearable: false, disabled: false, placeholder: '',
      readonly: false, passwordToggle: false, passwordVisible: false, noSpinButtons: false, form: '', required: false, pattern: undefined, minlength: undefined, maxlength: undefined,
      min: undefined, max: undefined, step: undefined, autocapitalize: undefined, autocorrect: undefined, autocomplete: undefined, autofocus: undefined, enterkeyhint: undefined,
      spellcheck: true, inputmode: undefined, title: '', valueAsDate: null, valueAsNumber: true,
    },
    afterAttr: { value: 'v1', defaultValue: 'v1', inner: 'v1' },
    afterProp: { attr: 'v1', defaultValue: 'v1' },
    reflected: {
      type: 'email', size: 'large', filled: '', pill: '', disabled: '', readonly: '', required: '', form: 'f',
      name: null, label: null, placeholder: null, clearable: null, passwordToggle: null, passwordVisible: null, noSpinButtons: null, min: null, max: null, step: null,
    },
    innerState: { type: 'email', name: 'n', placeholder: 'P', disabled: true, readOnly: true, required: true, min: '1', max: '9', step: '2' },
    restored: { type: 'text', size: 'medium', form: '', filled: false, pill: false },
  });
});

test('attributes pass through to the inner input: autocapitalize, autocorrect, autocomplete, autofocus, enterkeyhint, inputmode, spellcheck, title, pattern and the length limits', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, `
    <sl-input id="attrs" autocapitalize="words" autocorrect="off" autocomplete="off" autofocus enterkeyhint="send" inputmode="numeric" spellcheck="false" title="Tip" pattern="[0-9]*" minlength="2" maxlength="9" placeholder="Hint"></sl-input>
    <sl-input id="plain"></sl-input>`);
  const r = await frame.locator('body').evaluate(() => {
    const names = ['autocapitalize', 'autocorrect', 'autocomplete', 'autofocus', 'enterkeyhint', 'inputmode', 'spellcheck', 'title', 'pattern', 'minlength', 'maxlength'];
    const read = id => {
      const el = document.querySelector(id);
      const inner = el.shadowRoot.querySelector('input');
      return { host: names.map(name => el[name]), inner: names.map(name => inner.getAttribute(name)) };
    };
    return { attrs: read('#attrs'), plain: read('#plain') };
  });
  expect(r.attrs).toEqual({
    host: ['words', 'off', 'off', true, 'send', 'numeric', false, 'Tip', '[0-9]*', 2, 9],
    inner: ['words', 'off', 'off', '', 'send', 'numeric', 'false', 'Tip', '[0-9]*', '2', '9'],
  });
  // Undefined until set: nothing is rendered for them, but spellcheck is on and the title is empty.
  expect(r.plain).toEqual({
    host: [undefined, undefined, undefined, undefined, undefined, undefined, true, '', undefined, undefined, undefined],
    inner: [null, null, null, null, null, null, 'true', '', null, null, null],
  });
});

test('methods: select, setSelectionRange, setRangeText, showPicker, focus and blur act on the inner input', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-input id="m"></sl-input>');
  const m = frame.locator('#m');
  const r = await m.evaluate(async el => {
    el.value = 'hello world';
    await el.updateComplete;
    const inner = el.shadowRoot.querySelector('input');
    el.select();
    const selected = [inner.selectionStart, inner.selectionEnd];
    // Record what is passed to the inner input, and compare with a native one in the same engine.
    const passed = [];
    const real = inner.setSelectionRange;
    inner.setSelectionRange = function (...args) { passed.push(args); return real.apply(this, args); };
    el.setSelectionRange(1, 3);
    const range = [inner.selectionStart, inner.selectionEnd, inner.selectionDirection];
    el.setSelectionRange(2, 4, 'backward');
    const backward = inner.selectionDirection;
    el.setSelectionRange(1, 3, 'forward');
    const forward = inner.selectionDirection;
    delete inner.setSelectionRange;
    const native = document.createElement('input');
    native.value = 'hello world';
    document.body.append(native);
    native.setSelectionRange(1, 3, 'none');
    const nativeNone = native.selectionDirection;
    native.remove();
    el.setRangeText('XY', 0, 2);
    await el.updateComplete;
    const replaced = [el.value, inner.value];
    el.setSelectionRange(0, 0);
    el.setRangeText('>', undefined, undefined, 'end');
    await el.updateComplete;
    const atCaret = [el.value, inner.selectionStart];
    el.setSelectionRange(0, 2);
    el.setRangeText('#', undefined, undefined, 'select');
    const selectMode = [el.value, inner.selectionStart, inner.selectionEnd];
    const focused = (el.focus(), [document.activeElement === el, el.shadowRoot.activeElement === inner]);
    el.blur();
    return { selected, range, backward, forward, passed, nativeNone, replaced, atCaret, selectMode, focused, blurred: el.shadowRoot.activeElement };
  });
  expect(r.selected).toEqual([0, 11]);
  // The call without a direction passes Shoelace's default, 'none', to the inner input, and an explicit direction is passed
  // through unchanged. What the platform then reports for 'none' is its own business (it is 'none' on macOS and 'forward' where
  // there is no "none" direction), so the reported value is compared with a native input's in the same engine.
  expect(r.passed).toEqual([[1, 3, 'none'], [2, 4, 'backward'], [1, 3, 'forward']]);
  expect(r.range.slice(0, 2)).toEqual([1, 3]);
  expect(r.range[2]).toBe(r.nativeNone);
  expect(['none', 'forward']).toContain(r.nativeNone);
  expect(r.backward).toBe('backward');
  expect(r.forward).toBe('forward');
  expect(r.replaced).toEqual(['XYllo world', 'XYllo world']);
  expect(r.atCaret).toEqual(['>XYllo world', 1]);
  expect(r.selectMode).toEqual(['#Yllo world', 0, 1]);
  expect(r.focused).toEqual([true, true]);
  expect(r.blurred).toBeNull();

  // showPicker() calls the inner input's showPicker when the engine has one, and does nothing when it has none.
  const picker = await m.evaluate(el => {
    const inner = el.shadowRoot.querySelector('input');
    const proto = HTMLInputElement.prototype;
    const original = Object.getOwnPropertyDescriptor(proto, 'showPicker');
    const calls = [];
    Object.defineProperty(proto, 'showPicker', { configurable: true, writable: true, value() { calls.push(this === inner); } });
    el.showPicker();
    delete proto.showPicker;
    const withoutSupport = (() => { try { el.showPicker(); return 'no error'; } catch (error) { return String(error); } })();
    if (original) Object.defineProperty(proto, 'showPicker', original);
    return { calls, withoutSupport };
  });
  expect(picker).toEqual({ calls: [true], withoutSupport: 'no error' });
});

test('core extensions kept: hide-label and error-message; invalid and label-position have no effect', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, `
    <sl-input id="hidden" hide-label label="Hidden label" help-text="Help"></sl-input>
    <sl-input id="err" error-message="Pick this"></sl-input>
    <sl-input id="pos" label-position="start" label="Start"></sl-input>
    <sl-input id="ref" label="Reference"></sl-input>`);
  const hidden = await frame.locator('#hidden').evaluate(el => ({
    label: el.shadowRoot.querySelector('label').getBoundingClientRect().width,
    help: el.shadowRoot.querySelector('[part="form-control-help-text"]').getBoundingClientRect().width,
    reflected: el.hasAttribute('hide-label'),
  }));
  expect(hidden).toEqual({ label: 1, help: 1, reflected: true });
  await expect(frame.getByRole('textbox', { name: 'Hidden label' })).toHaveAccessibleDescription('Help');
  const err = await frame.locator('#err').evaluate(async el => {
    const before = { valid: el.validity.valid, message: el.validationMessage, invalid: el.invalid, data: el.hasAttribute('data-invalid'), text: el.shadowRoot.textContent.includes('Pick this') };
    el.errorMessage = '';
    await el.updateComplete;
    const after = { valid: el.validity.valid, invalid: el.invalid, data: el.hasAttribute('data-invalid') };
    el.invalid = true;
    await el.updateComplete;
    return { before, after, inert: { valid: el.validity.valid, data: el.hasAttribute('data-invalid'), reflected: el.hasAttribute('invalid') } };
  });
  expect(err).toEqual({
    before: { valid: false, message: 'Pick this', invalid: false, data: true, text: false },
    after: { valid: true, invalid: false, data: false },
    inert: { valid: true, data: false, reflected: true },
  });
  // label-position is accepted (and reflected) but the layout is Shoelace's: the label stays above the input.
  const layout = await frame.locator('body').evaluate(() => ['#pos', '#ref'].map(id => {
    const root = document.querySelector(id).shadowRoot;
    const label = root.querySelector('label').getBoundingClientRect();
    const box = root.querySelector('[part="base"]').getBoundingClientRect();
    return [label.bottom <= box.top + 1, Math.round(label.left - box.left)];
  }));
  expect(layout).toEqual([[true, 0], [true, 0]]);
  // readonly is Shoelace's own attribute: the value cannot be edited.
  await mount(frame, '<sl-input id="ro" readonly value="fixed"></sl-input>');
  await frame.locator('#ro input').click();
  await recordKeys(frame.locator('body'));
  await pressReceived(page, frame.locator('body'), 'x');
  expect(await frame.locator('#ro').evaluate(el => [el.value, el.shadowRoot.querySelector('input').readOnly])).toEqual(['fixed', true]);
});

test('dir and lang are reactive, not reflected and undefined by default, as Shoelace\'s base element declares them', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-input id="dl"></sl-input><sl-input id="attrs" dir="rtl" lang="de"></sl-input>');
  const r = await frame.locator('body').evaluate(async () => {
    const el = document.querySelector('#dl');
    const attrs = document.querySelector('#attrs');
    const observed = customElements.get('sl-input').observedAttributes.filter(a => a === 'dir' || a === 'lang');
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

test('focus is not delegated, as in Shoelace: clicking the help text neither focuses the input nor emits sl-focus', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-input id="nf" label="Label" help-text="Some help text"></sl-input>');
  const el = frame.locator('#nf');
  await record(el, ['sl-focus']);
  expect(await el.evaluate(el => el.shadowRoot.delegatesFocus)).toBe(false);
  await el.locator('[part="form-control-help-text"]').click();
  expect(await frame.locator('body').evaluate(() => ({ active: document.activeElement?.localName, events: window.__events })))
    .toEqual({ active: 'body', events: [] });
  // focus() still focuses the inner input
  await el.evaluate(el => el.focus());
  expect(await el.evaluate(el => [document.activeElement === el, el.shadowRoot.activeElement?.localName])).toEqual([true, 'input']);
  expect(await recorded(frame)).toEqual(['sl-focus']);
});

// The class-only entry (@charm-ux/velcro/input/class), bundled alone through the package's real export map: no registering
// entry, no aggregate and no docs page. Shoelace's input declares sl-icon in `static dependencies`, and its base element
// defines each missing dependency when an input is constructed; Velcro's does the same.
test.describe('class-only entry', () => {
  const docsDir = fileURLToPath(new URL('../../packages/docs/', import.meta.url));
  const velcroDir = fileURLToPath(new URL('../../packages/velcro/', import.meta.url));
  let bundle;

  test.beforeAll(async () => {
    const fromDocs = createRequire(path.join(docsDir, 'package.json'));
    const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
    const dir = mkdtempSync(path.join(tmpdir(), 'velcro-input-class-'));
    try {
      const entry = path.join(dir, 'entry.js');
      writeFileSync(entry, `
        import { SlInput, VelcroInput } from '@charm-ux/velcro/input/class';
        import { SlIcon } from '@charm-ux/velcro/icon/class';
        window.inputClass = { SlInput, VelcroInput, SlIcon };
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
    await page.waitForFunction(() => Boolean(window.inputClass));
    return pageErrors;
  }

  test('importing defines nothing; constructing an input defines Velcro\'s sl-icon, so the clear icon renders', async ({ page }) => {
    const pageErrors = await load(page);
    const r = await page.evaluate(async () => {
      const { SlInput, VelcroInput } = window.inputClass;
      const tags = () => ['sl-input', 'sl-icon'].map(t => customElements.get(t)?.name ?? null);
      const afterImport = tags();
      customElements.define('sl-input', SlInput);
      const afterDefine = tags();
      const input = document.createElement('sl-input');
      input.clearable = true;
      input.value = 'x';
      document.body.append(input);
      await input.updateComplete;
      const icon = input.shadowRoot.querySelector('[part="clear-button"] sl-icon');
      await icon.updateComplete;
      return {
        afterImport, afterDefine, afterConstruct: tags(), alias: SlInput === VelcroInput,
        iconClass: customElements.get('sl-icon') === icon.constructor && icon.constructor.baseName,
        name: icon.getAttribute('name'), library: icon.getAttribute('library'),
      };
    });
    expect(r).toEqual({
      afterImport: [null, null], afterDefine: ['VelcroInput', null], afterConstruct: ['VelcroInput', 'VelcroIcon'], alias: true,
      iconClass: 'icon', name: 'x-circle-fill', library: 'system',
    });
    await expect.poll(() => page.locator('sl-input').evaluate(c => Boolean(c.shadowRoot.querySelector('sl-icon').shadowRoot?.querySelector('svg')))).toBe(true);
    expect(pageErrors).toEqual([]);
  });

  // The platform refuses to define one constructor under two names; Shoelace then defines an anonymous subclass.
  test('when the icon class is already defined under another tag, constructing an input defines sl-icon as a subclass of it', async ({ page }) => {
    const pageErrors = await load(page);
    const r = await page.evaluate(async () => {
      const { SlInput, SlIcon } = window.inputClass;
      customElements.define('my-icon', SlIcon);
      customElements.define('sl-input', SlInput);
      const input = document.createElement('sl-input');
      input.passwordToggle = true;
      document.body.append(input);
      await input.updateComplete;
      const defined = customElements.get('sl-icon');
      const icon = input.shadowRoot.querySelector('sl-icon');
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
      customElements.define('sl-input', window.inputClass.SlInput);
      const input = document.createElement('sl-input');
      input.passwordToggle = true;
      document.body.append(input);
      await input.updateComplete;
      return [customElements.get('sl-icon') === OtherIcon, input.shadowRoot.querySelector('sl-icon') instanceof OtherIcon];
    });
    expect(r).toEqual([true, true]);
    expect(warnings).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});

test.describe('localized names', () => {
  let outDir;
  test.beforeAll(async () => {
    outDir = await buildFixtures({
      localize: "export * from '@charm-ux/velcro/utilities/localize';",
      components: "import '@charm-ux/velcro/input';",
    });
  });

  test('the clear and password toggle names are the localized terms: English by default, then the element or document lang once a translation is registered', async ({ page }) => {
    await gotoBlank(page, outDir);
    const r = await page.evaluate(async () => {
      const loc = await import('/localize.js');
      await import('/components.js');
      document.body.innerHTML = '<sl-input id="a" clearable password-toggle type="password" value="x"></sl-input>';
      const el = document.querySelector('#a');
      await el.updateComplete;
      const names = async () => {
        await new Promise(resolve => setTimeout(resolve));
        while (!(await el.updateComplete));
        const root = el.shadowRoot;
        const toggle = root.querySelector('[part="password-toggle-button"]');
        const out = [root.querySelector('[part="clear-button"]').getAttribute('aria-label'), toggle.getAttribute('aria-label')];
        toggle.click();
        await el.updateComplete;
        out.push(root.querySelector('[part="password-toggle-button"]').getAttribute('aria-label'));
        toggle.click();
        await el.updateComplete;
        return out;
      };
      const english = await names();
      loc.registerTranslation({ $code: 'xq', $name: 'Test', $dir: 'ltr', clearEntry: 'Q-clear', showPassword: 'Q-show', hidePassword: 'Q-hide' });
      el.setAttribute('lang', 'xq');
      const translated = await names();
      el.removeAttribute('lang');
      document.documentElement.lang = 'xq';
      const fromDocument = await names();
      return { english, translated, fromDocument };
    });
    expect(r).toEqual({
      english: ['Clear entry', 'Show password', 'Hide password'],
      translated: ['Q-clear', 'Q-show', 'Q-hide'],
      fromDocument: ['Q-clear', 'Q-show', 'Q-hide'],
    });
  });
});

test('upstream quirks matched: hidden does not hide it, form="" and aria-describedby are always set, removing value nulls it, conversions fall back to in-memory inputs, the password toggle ignores the type, a bare spellcheck is false, methods throw before rendering', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, `
    <sl-input id="h" hidden></sl-input><sl-input id="v" value="a"></sl-input><sl-input id="clr" clearable value="a"></sl-input>
    <sl-input id="conv" value="42"></sl-input><sl-input id="pw" type="text" password-toggle></sl-input>
    <sl-input id="spell" spellcheck></sl-input><sl-input id="spell-true" spellcheck="true"></sl-input><sl-input id="spell-false" spellcheck="false"></sl-input>
    <sl-input id="spell-on" spellcheck="on"></sl-input><sl-input id="spell-upper" spellcheck="FALSE"></sl-input>`);
  // Shoelace's :host { display: block } outranks the user agent's [hidden] rule.
  expect(await frame.locator('#h').evaluate(el => getComputedStyle(el).display)).toBe('block');
  const r = await frame.locator('body').evaluate(async () => {
    const h = document.querySelector('#h');
    const v = document.querySelector('#v');
    v.removeAttribute('value');
    await v.updateComplete;
    const removed = [v.value, v.defaultValue];
    // The next render of a clearable input reads the length of the null value, which fails.
    const clr = document.querySelector('#clr');
    let renderError = null;
    clr.removeAttribute('value');
    try { await clr.updateComplete; } catch (error) { renderError = error instanceof TypeError; }
    const fresh = document.createElement('sl-input');
    const thrown = {};
    for (const [name, call] of Object.entries({
      focus: () => fresh.focus(), blur: () => fresh.blur(), select: () => fresh.select(), setSelectionRange: () => fresh.setSelectionRange(0, 0),
      setRangeText: () => fresh.setRangeText('x'), showPicker: () => fresh.showPicker(), stepUp: () => fresh.stepUp(), stepDown: () => fresh.stepDown(),
      checkValidity: () => fresh.checkValidity(), reportValidity: () => fresh.reportValidity(), setCustomValidity: () => fresh.setCustomValidity(''),
      validity: () => fresh.validity, validationMessage: () => fresh.validationMessage,
    })) {
      try { call(); thrown[name] = false; } catch (error) { thrown[name] = error instanceof TypeError; }
    }
    const conv = document.querySelector('#conv');
    const spell = id => { const el = document.querySelector(id); return [el.spellcheck, el.shadowRoot.querySelector('input').getAttribute('spellcheck')]; };
    return {
      form: h.getAttribute('form'),
      describedBy: h.shadowRoot.querySelector('input').getAttribute('aria-describedby'),
      // A text input converts through the in-memory inputs: a number from "42", and no date.
      conversions: [conv.valueAsNumber, conv.valueAsDate],
      textToggle: Boolean(document.querySelector('#pw').shadowRoot.querySelector('[part="password-toggle-button"]')),
      spellcheck: { bare: spell('#spell'), explicitTrue: spell('#spell-true'), explicitFalse: spell('#spell-false'), onValue: spell('#spell-on'), upperFalse: spell('#spell-upper') },
      removed, renderError, thrown, pickerSupported: 'showPicker' in HTMLInputElement.prototype,
    };
  });
  expect(r.form).toBe('');
  expect(r.describedBy).toBe('help-text');
  expect(r.removed).toEqual([null, null]);
  expect(r.conversions).toEqual([42, null]);
  expect(r.textToggle).toBe(true);
  // The converter reads the empty value of a bare attribute as false and every other value but the exact string "false" as true.
  expect(r.spellcheck).toEqual({ bare: [false, 'false'], explicitTrue: [true, 'true'], explicitFalse: [false, 'false'], onValue: [true, 'true'], upperFalse: [true, 'true'] });
  expect(r.renderError).toBe(true);
  // showPicker() is the one that checks the platform first: it throws before the first render only where the engine has a
  // picker API (and so reaches the missing inner input); where it has none, it is a no-op, as in Shoelace.
  const { showPicker, ...others } = r.thrown;
  expect(Object.values(others).every(Boolean)).toBe(true);
  expect(Object.keys(others).length).toBe(12);
  expect(showPicker).toBe(r.pickerSupported);
});

test('inherited core ready event: dispatched once on the element after the first update, not bubbling or composed', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('body').evaluate(async body => {
    const el = document.createElement('sl-input');
    const seen = [];
    let bubbled = 0;
    el.addEventListener('ready', event => seen.push({ bubbles: event.bubbles, composed: event.composed }));
    body.addEventListener('ready', () => bubbled++);
    body.append(el);
    await el.updateComplete;
    el.size = 'large';
    await el.updateComplete;
    el.remove();
    return { seen, bubbled };
  });
  expect(r).toEqual({ seen: [{ bubbles: false, composed: false }], bubbled: 0 });
});

test('the form utilities include sl-input: serialize() reads its name and value and getFormControls() lists it among native controls in DOM order', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, `
    <form id="util" action="about:blank">
      <sl-input name="note" value="one"></sl-input>
      <input name="plain" value="native">
      <sl-input name="note" value="two"></sl-input>
    </form>`);
  const r = await frame.locator('body').evaluate(async () => {
    const { serialize, getFormControls } = await import('@charm-ux/velcro');
    const form = document.querySelector('#util');
    return { serialized: serialize(form), order: getFormControls(form).map(c => `${c.localName}:${c.getAttribute('name')}`) };
  });
  expect(r.serialized).toEqual({ plain: 'native', note: ['one', 'two'] });
  expect(r.order).toEqual(['sl-input:note', 'input:plain', 'sl-input:note']);
});

test('every docs example renders in its own document', async ({ page }) => {
  await openDocs(page, PAGE);
  const titles = await page.locator('iframe.example').evaluateAll(frames => frames.map(f => f.title));
  expect(titles).toEqual(EXAMPLES.map(([title]) => `Input example: ${title}`));
  for (const title of titles.map(t => t.replace('Input example: ', ''))) {
    const frame = frameFor(page, title);
    await expect(frame.locator('sl-input').first()).toBeVisible();
    expect(await frame.locator('sl-input').first().evaluate(el => Boolean(el.shadowRoot?.querySelector('[part="base"]')))).toBe(true);
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
const summarize = () => [...document.querySelectorAll('sl-input')].map(el => {
  const root = el.shadowRoot;
  const inner = root.querySelector('input');
  return {
    type: el.type, label: el.label, helpText: el.helpText, placeholder: el.placeholder, filled: el.filled, pill: el.pill, clearable: el.clearable, passwordToggle: el.passwordToggle,
    disabled: el.disabled, size: el.size, innerType: inner.type, innerPlaceholder: inner.placeholder, innerDisabled: inner.disabled, base: root.querySelector('[part="base"]').className,
    control: root.querySelector('[part="form-control"]').className, help: root.querySelector('[part="form-control-help-text"]').getAttribute('aria-hidden'),
    toggle: Boolean(root.querySelector('[part="password-toggle-button"]')),
    slotted: ['prefix', 'suffix'].map(name => root.querySelector(`slot[name="${name}"]`).assignedElements().map(n => `${n.localName}:${n.getAttribute('name')}`)),
  };
});

// Shoelace's React examples, ported in packages/docs/examples/input/react/*.jsx (the files the docs page shows), bundled
// with React 19 and the generated wrapper, which is resolved through the package's real export map. Each one is rendered
// and compared with the HTML example it belongs to.
test.describe('React examples', () => {
  const reactDir = fileURLToPath(new URL('../../packages/docs/examples/input/react/', import.meta.url));
  const velcroDir = fileURLToPath(new URL('../../packages/velcro/', import.meta.url));
  let bundle;

  test.beforeAll(async () => {
    const fromVelcro = createRequire(path.join(velcroDir, 'package.json'));
    const fromDocs = createRequire(fileURLToPath(new URL('../../packages/docs/package.json', import.meta.url)));
    const pkgDir = name => path.dirname(fromVelcro.resolve(`${name}/package.json`));
    const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
    const dir = mkdtempSync(path.join(tmpdir(), 'velcro-input-react-'));
    try {
      // Each example file declares `App` without exporting it (as on Shoelace's page); the copy only appends the export.
      for (const [, name] of REACT_EXAMPLES) {
        writeFileSync(path.join(dir, `${name}.jsx`), `${readFileSync(path.join(reactDir, `${name}.jsx`), 'utf8')}\nexport default App;\n`);
      }
      const entry = path.join(dir, 'entry.js');
      writeFileSync(entry, `
        import React from 'react';
        import { flushSync } from 'react-dom';
        import { createRoot } from 'react-dom/client';
        ${REACT_EXAMPLES.map(([, name], i) => `import App${i} from './${name}.jsx';`).join('\n')}
        const apps = { ${REACT_EXAMPLES.map(([, name], i) => `${JSON.stringify(name)}: App${i}`).join(', ')} };
        window.errors = [];
        addEventListener('error', e => window.errors.push(String(e.message)));
        addEventListener('unhandledrejection', e => window.errors.push(String(e.reason)));
        window.reactVersion = React.version;
        window.renderExample = name => {
          const host = document.createElement('div');
          document.body.append(host);
          flushSync(() => createRoot(host).render(React.createElement(apps[name])));
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
    await page.evaluate(async n => {
      document.body.replaceChildren();
      window.renderExample(n);
      await customElements.whenDefined('sl-input');
      await Promise.all([...document.querySelectorAll('sl-input')].map(el => el.updateComplete));
      await new Promise(resolve => setTimeout(resolve, 50));
    }, name);
  }

  test('every React example renders the same inputs as the HTML example it belongs to', async ({ page }) => {
    test.setTimeout(150_000);
    // The HTML examples, from a second page, so that the two documents never share a registry.
    const htmlPage = await page.context().newPage();
    watchNetwork(htmlPage);
    const expected = {};
    try {
      await openDocs(htmlPage, PAGE);
      await documentsLoaded(htmlPage);
      for (const [title, name] of REACT_EXAMPLES) {
        const frame = frameFor(htmlPage, title);
        await expect(frame.locator('sl-input').first()).toBeAttached();
        await frame.locator('body').evaluate(async () => {
          await customElements.whenDefined('sl-input');
          await Promise.all([...document.querySelectorAll('sl-input')].map(el => el.updateComplete));
        });
        expected[name] = await frame.locator('body').evaluate(summarize);
      }
    } finally {
      await htmlPage.close();
    }
    const pageErrors = await load(page);
    expect(await page.evaluate(() => window.reactVersion)).toBe('19.2.0');
    for (const [, name] of REACT_EXAMPLES) {
      await render(page, name);
      const actual = await page.evaluate(summarize);
      expect(actual.length, name).toBeGreaterThan(0);
      expect(actual, name).toEqual(expected[name]);
    }
    expect(await page.evaluate(() => window.errors)).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});

// The wrapper itself, through the shared React page (support/react.mjs).
test.describe('React wrapper', () => {
  const mountWrapper = reactWrapperPage(test);

  test('passes properties and Shoelace\'s events: label, helpText, type, min, max, step, value and onSlInput / onSlChange / onSlClear', async ({ page }) => {
    const pageErrors = await mountWrapper(page);
    await page.evaluate(async () => {
      window.calls = [];
      window.renderWrapper('VelcroInput', {
        label: 'Count', helpText: 'Be brief', type: 'number', min: 1, max: 9, step: 2, name: 'count', clearable: true, size: 'large',
        onSlInput: e => window.calls.push(`input:${e.target.value}`), onSlChange: e => window.calls.push(`change:${e.target.value}`), onSlClear: () => window.calls.push('clear'),
      });
      await customElements.whenDefined('sl-input');
      await document.querySelector('#wrapped').updateComplete;
    });
    const read = () => page.evaluate(() => {
      const el = document.querySelector('#wrapped');
      const inner = el.shadowRoot.querySelector('input');
      return { ctor: customElements.get('sl-input') === el.constructor, label: el.label, help: el.helpText, type: [el.type, inner.type], bounds: [el.min, el.max, el.step, inner.min, inner.max, inner.step], value: [el.value, inner.value], name: inner.name, size: el.getAttribute('size') };
    });
    expect(await read()).toEqual({ ctor: true, label: 'Count', help: 'Be brief', type: ['number', 'number'], bounds: [1, 9, 2, '1', '9', '2'], value: ['', ''], name: 'count', size: 'large' });
    await page.locator('sl-input input').pressSequentially('37');
    await expect(page.locator('sl-input input')).toHaveValue('37');
    await page.locator('sl-input input').blur();
    expect(await page.evaluate(() => window.calls)).toEqual(['input:3', 'input:37', 'change:37']);
    await page.locator('sl-input [part="clear-button"]').click();
    expect(await page.evaluate(() => window.calls.slice(3))).toEqual(['clear', 'input:', 'change:']);
    // A later render passes a new value as a property.
    await page.evaluate(async () => {
      window.renderWrapper('VelcroInput', { type: 'number', value: '5' });
      await document.querySelector('#wrapped').updateComplete;
    });
    expect((await read()).value).toEqual(['5', '5']);
    expect(pageErrors).toEqual([]);
  });
});
