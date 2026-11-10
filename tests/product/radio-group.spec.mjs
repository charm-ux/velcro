import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { pressReceived, recordKeys } from './support/keys.mjs';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/radio-group';

// The docs page's examples, in page order: the example's title, and the name of its files under examples/radio-group/.
const EXAMPLES = [
  ['Overview', 'overview'],
  ['Help Text', 'help-text'],
  ['Radio Buttons', 'radio-buttons'],
  ['Disabling Options', 'disabling-options'],
  ['Sizing Options', 'sizing-options'],
  ['Validation', 'validation'],
  ['Custom Validity', 'custom-validity'],
];

const frameFor = (page, title) => page.frameLocator(`iframe.example[title="Radio Group example: ${title}"]`);

async function openExample(page, title = 'Overview') {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  const frame = frameFor(page, title);
  await expect(frame.locator('sl-radio-group').first()).toBeAttached();
  await settle(frame.locator('body'));
  // Rendering only: a test that reads the requests waits for the network to go quiet itself (documentsLoaded).
  return { frame, requests };
}

// Waits for every group and radio in the document to render and for the groups' radio synchronisation.
async function settle(locator) {
  await locator.evaluate(async () => {
    await Promise.all(['sl-radio-group', 'sl-radio', 'sl-radio-button'].map(tag => customElements.whenDefined(tag)));
    const all = () => [...document.querySelectorAll('sl-radio-group, sl-radio, sl-radio-button, sl-button-group')];
    await Promise.all(all().map(el => el.updateComplete));
    await new Promise(resolve => setTimeout(resolve, 50));
    await Promise.all(all().map(el => el.updateComplete));
  });
}

// Appends markup to the example document and waits for it to render.
async function mount(frame, markup) {
  await frame.locator('body').evaluate((body, markup) => {
    document.querySelector('#mount')?.remove();
    const host = document.createElement('div');
    host.id = 'mount';
    host.innerHTML = markup;
    body.append(host);
  }, markup);
  await settle(frame.locator('body'));
}

const radios = (frame, selector = '#mount sl-radio-group') => frame.locator(selector).first().evaluate(group =>
  [...group.querySelectorAll('sl-radio, sl-radio-button')].map(r => `${r.value}:${r.checked}`));

const GROUP = `
  <sl-radio-group label="Pick" name="pick" value="b">
    <sl-radio value="a">A</sl-radio>
    <sl-radio value="b">B</sl-radio>
    <sl-radio value="c" disabled>C</sl-radio>
    <sl-radio value="d">D</sl-radio>
  </sl-radio-group>`;

test('docs page is prerendered with Velcro branding, prototype status, the quirks, explicit limits and the React examples', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Radio Group - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('Not implemented or unverified');
  expect(html.match(/<summary>React<\/summary>/g)).toHaveLength(EXAMPLES.length);
  for (const [title] of EXAMPLES) expect(html).toContain(`title="Radio Group example: ${title}"`);
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
});

test('sl-radio-group registers as the exported class with no core marker, tab stop or ch-* definitions; sl-button-group is registered too', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  await documentsLoaded(page);
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
  const r = await frame.locator('#demo-default').evaluate(el => ({
    ctor: customElements.get('sl-radio-group') === el.constructor,
    buttonGroup: Boolean(customElements.get('sl-button-group')),
    attributes: el.getAttributeNames().sort(),
    chDefined: ['ch-radio-group', 'ch-radio', 'ch-icon'].filter(tag => customElements.get(tag)),
    delegatesFocus: el.shadowRoot.delegatesFocus,
    internals: 'formAssociated' in el.constructor ? el.constructor.formAssociated : undefined,
  }));
  expect(r.ctor).toBe(true);
  expect(r.buttonGroup).toBe(true);
  // value reflects; the validity data attributes come from Shoelace's form control controller. focusable is core's marker
  // for every Velcro form control (see the docs page).
  // form reflects its empty default (form=""), as in Shoelace.
  expect(r.attributes).toEqual(['data-optional', 'data-valid', 'focusable', 'form', 'id', 'label', 'name', 'size', 'value']);
  expect(r.chDefined).toEqual([]);
  expect(r.delegatesFocus).toBe(false);
  expect(r.internals).toBe(false);
});

test('structure: a radiogroup fieldset with Shoelace\'s parts, label, hidden error region and validation input, and the help text', async ({ page }) => {
  const { frame } = await openExample(page, 'Help Text');
  const s = await frame.locator('sl-radio-group').evaluate(el => {
    const root = el.shadowRoot;
    const fieldset = root.querySelector('fieldset');
    return {
      parts: [...root.querySelectorAll('[part]')].map(n => `${n.localName}:${n.getAttribute('part')}`),
      fieldset: ['role', 'aria-labelledby', 'aria-describedby', 'aria-errormessage'].map(a => fieldset.getAttribute(a)),
      classes: [...fieldset.classList].sort(),
      label: root.querySelector('#label').textContent.trim(),
      labelHidden: root.querySelector('#label').getAttribute('aria-hidden'),
      help: root.querySelector('#help-text').textContent.trim(),
      live: root.querySelector('#error-message').getAttribute('aria-live'),
      input: (i => [i.type, i.tabIndex, i.hidden, i.required])(root.querySelector('.radio-group__validation-input')),
      slots: [...root.querySelectorAll('slot')].map(n => n.name || '(default)'),
      buttonGroup: root.querySelector('sl-button-group') !== null,
    };
  });
  expect(s.parts).toEqual(['fieldset:form-control', 'label:form-control-label', 'div:form-control-input', 'div:form-control-help-text']);
  expect(s.fieldset).toEqual(['radiogroup', 'label', 'help-text', 'error-message']);
  expect(s.classes).toEqual(['form-control', 'form-control--has-help-text', 'form-control--has-label', 'form-control--medium', 'form-control--radio-group']);
  expect(s.label).toBe('Select an option');
  expect(s.labelHidden).toBe('false');
  expect(s.help).toBe('Choose the most appropriate option.');
  expect(s.live).toBe('assertive');
  expect(s.input).toEqual(['text', -1, true, false]);
  expect(s.slots).toEqual(['label', '(default)', 'help-text']);
  expect(s.buttonGroup).toBe(false);
});

test('radio buttons are wrapped in an sl-button-group with role presentation, disableRole and the button-group parts', async ({ page }) => {
  const { frame } = await openExample(page, 'Radio Buttons');
  const s = await frame.locator('sl-radio-group').evaluate(el => {
    const group = el.shadowRoot.querySelector('sl-button-group');
    return {
      part: group.getAttribute('part'),
      exportparts: group.getAttribute('exportparts'),
      role: group.getAttribute('role'),
      disableRole: group.disableRole,
      baseRole: group.shadowRoot.querySelector('[part="base"]').getAttribute('role'),
      slotted: group.querySelector('slot').assignedElements({ flatten: true }).map(b => b.localName),
      positions: [...el.querySelectorAll('sl-radio-button')].map(b => ['first', 'inner', 'last'].find(p => b.hasAttribute(`data-sl-button-group__button--${p}`))),
      radio: [...el.querySelectorAll('sl-radio-button')].every(b => b.hasAttribute('data-sl-button-group__button--radio')),
    };
  });
  expect(s).toEqual({
    part: 'button-group', exportparts: 'base:button-group__base', role: 'presentation', disableRole: true, baseRole: 'presentation',
    slotted: ['sl-radio-button', 'sl-radio-button', 'sl-radio-button'], positions: ['first', 'inner', 'last'], radio: true,
  });
});

test('value checks the matching radio, sets each radio\'s size and gives the first radio the tab stop when none is checked', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, `${GROUP}<sl-radio-group id="none" size="large"><sl-radio value="x" size="small">X</sl-radio><sl-radio value="y">Y</sl-radio></sl-radio-group>`);
  expect(await radios(frame)).toEqual(['a:false', 'b:true', 'c:false', 'd:false']);
  const none = await frame.locator('#none').evaluate(el => [...el.querySelectorAll('sl-radio')].map(r => [r.checked, r.size, r.getAttribute('tabindex')]));
  expect(none).toEqual([[false, 'large', '0'], [false, 'large', '-1']]);
  // Setting value from script checks the matching radio and unchecks the others.
  await frame.locator('#mount sl-radio-group').first().evaluate(async el => { el.value = 'd'; await el.updateComplete; });
  expect(await radios(frame)).toEqual(['a:false', 'b:false', 'c:false', 'd:true']);
});

test('a click selects a radio, emits sl-change then sl-input (bubbling, composed) once per change, and ignores disabled radios', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, GROUP);
  const group = frame.locator('#mount sl-radio-group');
  await group.evaluate(el => {
    window.__events = [];
    for (const type of ['sl-change', 'sl-input']) el.addEventListener(type, e => window.__events.push(`${type}:${el.value}:${e.bubbles}:${e.composed}`));
  });
  await frame.locator('#mount sl-radio[value="a"]').click();
  expect(await radios(frame)).toEqual(['a:true', 'b:false', 'c:false', 'd:false']);
  await frame.locator('#mount sl-radio[value="a"]').click();
  await frame.locator('#mount sl-radio[value="c"]').click({ force: true });
  expect(await radios(frame)).toEqual(['a:true', 'b:false', 'c:false', 'd:false']);
  expect(await group.evaluate(el => el.value)).toBe('a');
  expect(await frame.locator('body').evaluate(() => window.__events)).toEqual(['sl-change:a:true:true', 'sl-input:a:true:true']);
});

test('keyboard: Tab reaches the checked radio, arrows move and wrap the selection skipping disabled radios, Space selects', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, `<button id="start">start</button>${GROUP}<button id="end">end</button>`);
  const group = frame.locator('#mount sl-radio-group');
  await group.evaluate(el => {
    window.__events = [];
    el.addEventListener('sl-change', () => window.__events.push(el.value));
  });
  await frame.locator('#start').focus();
  const active = () => frame.locator('body').evaluate(() => document.activeElement?.getAttribute('value') ?? document.activeElement?.id);
  await page.keyboard.press('Tab');
  await expect.poll(active).toBe('b');
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => active()).toBe('d');
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => active()).toBe('a');
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => active()).toBe('d');
  await page.keyboard.press('ArrowUp');
  await expect.poll(() => active()).toBe('b');
  expect(await radios(frame)).toEqual(['a:false', 'b:true', 'c:false', 'd:false']);
  expect(await frame.locator('#mount sl-radio').evaluateAll(rs => rs.map(r => r.getAttribute('tabindex')))).toEqual(['-1', '0', '-1', '-1']);
  expect(await frame.locator('body').evaluate(() => window.__events)).toEqual(['d', 'a', 'd', 'b']);
  await recordKeys(frame.locator('body'));
  await pressReceived(page, frame.locator('body'), 'Space');
  expect(await frame.locator('body').evaluate(() => window.__events)).toEqual(['d', 'a', 'd', 'b']);
  await page.keyboard.press('Tab');
  await expect.poll(() => active()).toBe('end');
});

test('keyboard with radio buttons: arrows move the checked state and focus the inner button', async ({ page }) => {
  const { frame } = await openExample(page, 'Radio Buttons');
  const group = frame.locator('sl-radio-group');
  // A real click gives the example's document focus first (Firefox does not move focus inside an unfocused frame).
  await frame.locator('body').click({ position: { x: 1, y: 1 } });
  await frame.locator('sl-radio-button[value="1"]').evaluate(el => el.focus());
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => radios(frame, 'sl-radio-group')).toEqual(['1:false', '2:true', '3:false']);
  expect(await group.evaluate(el => [el.value, document.activeElement?.getAttribute('value'), document.activeElement?.shadowRoot.activeElement?.localName])).toEqual(['2', '2', 'button']);
  expect(await frame.locator('sl-radio-button[value="2"]').evaluate(el => el.shadowRoot.querySelector('button').getAttribute('aria-checked'))).toBe('true');
});

test('clicking the label focuses the checked radio, or the first enabled one; focus() does the same', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, `${GROUP}<sl-radio-group id="other" label="Other"><sl-radio value="x" disabled>X</sl-radio><sl-radio value="y">Y</sl-radio></sl-radio-group>`);
  // A real click gives the example's document focus first (Firefox does not move focus inside an unfocused frame).
  await frame.locator('body').click({ position: { x: 1, y: 1 } });
  await frame.locator('#mount sl-radio-group').first().evaluate(el => el.shadowRoot.querySelector('#label').click());
  expect(await frame.locator('body').evaluate(() => document.activeElement?.getAttribute('value'))).toBe('b');
  await frame.locator('#other').evaluate(el => el.focus());
  expect(await frame.locator('body').evaluate(() => document.activeElement?.getAttribute('value'))).toBe('y');
});

test('size: the group\'s size applies to its radios and to the form control classes, and changes follow', async ({ page }) => {
  const { frame } = await openExample(page, 'Sizing Options');
  const sizes = () => frame.locator('sl-radio-group').evaluate(el => [el.size, ...[...el.querySelectorAll('sl-radio')].map(r => r.size),
    [...el.shadowRoot.querySelector('fieldset').classList].find(c => /--(small|medium|large)$/.test(c))]);
  expect(await sizes()).toEqual(['medium', 'medium', 'medium', 'medium', 'form-control--medium']);
  await frame.locator('sl-radio[value="large"]').click();
  await expect.poll(sizes).toEqual(['large', 'large', 'large', 'large', 'form-control--large']);
  await frame.locator('sl-radio[value="small"]').click();
  await expect.poll(sizes).toEqual(['small', 'small', 'small', 'small', 'form-control--small']);
});

test('forms: the value is submitted under name, required blocks submission until a radio is chosen, reset restores defaultValue', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, `<form id="f"><sl-radio-group name="pick" value="b" required><sl-radio value="a">A</sl-radio><sl-radio value="b">B</sl-radio></sl-radio-group>
    <sl-radio-group id="req" name="req" required><sl-radio value="x">X</sl-radio></sl-radio-group></form>`);
  const r = await frame.locator('#f').evaluate(async form => {
    const [group, req] = form.querySelectorAll('sl-radio-group');
    const out = { initial: [...new FormData(form)], valid: form.checkValidity(), reqValidity: [req.validity.valueMissing, req.validationMessage !== ''] };
    out.attrs = ['data-required', 'data-invalid', 'data-user-invalid'].map(a => req.hasAttribute(a));
    req.value = 'x';
    group.value = 'a';
    await Promise.all([group.updateComplete, req.updateComplete]);
    out.after = [...new FormData(form)];
    out.validAfter = form.checkValidity();
    form.reset();
    await Promise.all([group.updateComplete, req.updateComplete]);
    out.reset = [group.value, req.value, [...group.querySelectorAll('sl-radio')].map(x => x.checked)];
    return out;
  });
  // An empty value is still added to the form data, as in Shoelace.
  expect(r.initial).toEqual([['pick', 'b'], ['req', '']]);
  expect(r.valid).toBe(false);
  expect(r.reqValidity).toEqual([true, true]);
  expect(r.attrs).toEqual([true, true, false]);
  expect(r.after).toEqual([['pick', 'a'], ['req', 'x']]);
  expect(r.validAfter).toBe(true);
  expect(r.reset).toEqual(['b', '', [false, true]]);
});

test('custom validity: setCustomValidity() makes the group invalid with that message, fires sl-invalid on checkValidity(), and clears with an empty string', async ({ page }) => {
  const { frame } = await openExample(page, 'Custom Validity');
  const r = await frame.locator('sl-radio-group').evaluate(async el => {
    await new Promise(resolve => setTimeout(resolve, 50));
    const events = [];
    el.addEventListener('sl-invalid', e => events.push([e.bubbles, e.cancelable]));
    const out = { initial: [el.validity.customError, el.validationMessage, el.checkValidity()], events };
    await el.updateComplete;
    out.live = el.shadowRoot.querySelector('#error-message').textContent;
    el.setCustomValidity('');
    out.cleared = [el.validity.valid, el.validationMessage, el.checkValidity()];
    return out;
  });
  expect(r.initial).toEqual([true, 'You must choose the last option', false]);
  expect(r.events).toEqual([[false, true]]);
  expect(r.live).toBe('You must choose the last option');
  expect(r.cleared).toEqual([true, '', true]);
  // The example's sl-change handler updates the validity.
  await frame.locator('sl-radio[value="3"]').click();
  expect(await frame.locator('sl-radio-group').evaluate(el => el.validity.valid)).toBe(true);
});

test('upstream quirk: reportValidity() with a custom message leaves the live region empty; with only required it shows the browser message', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-radio-group id="q1"><sl-radio value="a">A</sl-radio></sl-radio-group><sl-radio-group id="q2" required><sl-radio value="a">A</sl-radio></sl-radio-group>');
  const r = await frame.locator('#mount').evaluate(async host => {
    const [custom, required] = host.querySelectorAll('sl-radio-group');
    custom.setCustomValidity('Nope');
    const live = el => el.shadowRoot.querySelector('#error-message').textContent;
    await custom.updateComplete;
    const afterSet = live(custom);
    const results = [custom.reportValidity(), required.reportValidity()];
    await Promise.all([custom.updateComplete, required.updateComplete]);
    return { afterSet, results, custom: live(custom), required: live(required), expected: required.validationMessage };
  });
  expect(r.afterSet).toBe('Nope');
  expect(r.results).toEqual([false, false]);
  expect(r.custom).toBe('');
  expect(r.required).toBe(r.expected);
  expect(r.required).not.toBe('');
});

test('upstream quirks: required is met by a value that matches no radio and name defaults to "option"; a required group draws the asterisk', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<form><sl-radio-group required value="zzz" label="L"><sl-radio value="a">A</sl-radio></sl-radio-group></form>');
  const r = await frame.locator('#mount form').evaluate(form => {
    const el = form.querySelector('sl-radio-group');
    const label = el.shadowRoot.querySelector('#label');
    return { valid: el.checkValidity(), checked: el.querySelector('sl-radio').checked, data: [...new FormData(form)], name: el.name,
      after: getComputedStyle(label, '::after').content };
  });
  expect(r).toEqual({ valid: true, checked: false, data: [['option', 'zzz']], name: 'option', after: '"*"' });
});

test('upstream quirk: defaultValue is taken again on every connect, so a moved group resets to the value it had when it moved', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, `<form id="f">${GROUP}</form><div id="other"></div>`);
  const r = await frame.locator('#f').evaluate(async form => {
    const el = form.querySelector('sl-radio-group');
    el.value = 'a';
    form.append(el);
    await el.updateComplete;
    el.value = 'd';
    await el.updateComplete;
    form.reset();
    await el.updateComplete;
    return [el.defaultValue, el.value];
  });
  expect(r).toEqual(['a', 'a']);
});

test('upstream quirk: a radio\'s own size is replaced by the group\'s only on a slot change or a size change', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, GROUP);
  const r = await frame.locator('#mount sl-radio-group').evaluate(async el => {
    const radio = el.querySelector('sl-radio');
    radio.size = 'large';
    await radio.updateComplete;
    const kept = radio.size;
    el.size = 'small';
    await el.updateComplete;
    await new Promise(resolve => setTimeout(resolve, 20));
    return [kept, radio.size];
  });
  expect(r).toEqual(['large', 'small']);
});

test('computed styles match Shoelace: block host, borderless fieldset, label and help text sizes, and hidden does not hide the group', async ({ page }) => {
  const { frame } = await openExample(page, 'Help Text');
  const s = await frame.locator('sl-radio-group').evaluate(el => {
    const root = el.shadowRoot;
    const token = name => {
      const probe = document.createElement('div');
      probe.style.fontSize = `var(${name})`;
      document.body.append(probe);
      const v = getComputedStyle(probe).fontSize;
      probe.remove();
      return v;
    };
    const fieldset = getComputedStyle(root.querySelector('fieldset'));
    const label = getComputedStyle(root.querySelector('#label'));
    const help = getComputedStyle(root.querySelector('#help-text'));
    el.hidden = true;
    const hiddenDisplay = getComputedStyle(el).display;
    el.hidden = false;
    return {
      host: getComputedStyle(el).display,
      fieldset: [fieldset.borderTopStyle, fieldset.paddingTop, fieldset.marginTop],
      label: [label.display, label.fontSize === token('--sl-input-label-font-size-medium'), label.paddingTop],
      help: [help.fontSize === token('--sl-input-help-text-font-size-medium'), help.marginTop],
      hiddenDisplay,
    };
  });
  expect(s).toEqual({
    host: 'block', fieldset: ['none', '0px', '0px'], label: ['inline-block', true, '0px'], help: [true, '4px'], hiddenDisplay: 'block',
  });
});

test('radio buttons get Shoelace\'s button group look: joined borders, rounded ends and the checked primary background', async ({ page }) => {
  const { frame } = await openExample(page, 'Radio Buttons');
  const s = await frame.locator('sl-radio-group').evaluate(el => {
    const probe = document.createElement('div');
    probe.style.backgroundColor = 'var(--sl-color-primary-600)';
    document.body.append(probe);
    const primary = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return [...el.querySelectorAll('sl-radio-button')].map(b => {
      const button = getComputedStyle(b.shadowRoot.querySelector('button'));
      return [button.borderTopLeftRadius !== '0px', button.borderTopRightRadius !== '0px', button.backgroundColor === primary];
    });
  });
  expect(s).toEqual([[true, false, true], [false, false, false], [false, true, false]]);
});

test('dir and lang are reactive, not reflected and undefined by default; removing a reflected attribute restores its initial value', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, GROUP);
  const r = await frame.locator('#mount sl-radio-group').evaluate(async el => {
    const before = [el.dir, el.lang];
    el.dir = 'rtl';
    el.lang = 'de';
    await el.updateComplete;
    const after = [el.dir, el.lang, el.hasAttribute('dir'), el.hasAttribute('lang')];
    el.removeAttribute('size');
    el.removeAttribute('value');
    await el.updateComplete;
    return { before, after, restored: [el.size, el.value] };
  });
  expect(r.before).toEqual([undefined, undefined]);
  expect(r.after).toEqual(['rtl', 'de', false, false]);
  // The initial values are recorded at the first attribute change, before value was set from its attribute, so value
  // goes back to '' (as in Shoelace).
  expect(r.restored).toEqual(['medium', '']);
});

test('inherited core ready event: dispatched once after the first update, not bubbling or composed', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('body').evaluate(async body => {
    const events = [];
    const el = document.createElement('sl-radio-group');
    el.addEventListener('ready', e => events.push([e.bubbles, e.composed]));
    body.append(el);
    await el.updateComplete;
    el.size = 'large';
    await el.updateComplete;
    return events;
  });
  expect(r).toEqual([[false, false]]);
});

test('Velcro extension disabled: disables every radio, re-enables exactly the ones it disabled, and leaves the group out of form data', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, `<form id="f">${GROUP}</form>`);
  const r = await frame.locator('#f').evaluate(async form => {
    const el = form.querySelector('sl-radio-group');
    const state = () => [...el.querySelectorAll('sl-radio')].map(x => x.disabled);
    el.disabled = true;
    await el.updateComplete;
    const on = [state(), [...new FormData(form)], el.hasAttribute('disabled')];
    el.disabled = false;
    await el.updateComplete;
    return { on, off: [state(), [...new FormData(form)]] };
  });
  expect(r.on).toEqual([[true, true, true, true], [], true]);
  expect(r.off).toEqual([[false, false, true, false], [['pick', 'b']]]);
});

test('Velcro extension disabled survives radio syncs: a group disabled in markup, a size change or an added radio, then enabled', async ({ page }) => {
  const { frame } = await openExample(page);
  // Disabled in markup: the initial slot change syncs the radios after the group has disabled them.
  await mount(frame, '<sl-radio-group id="g1" disabled value="a"><sl-radio value="a">A</sl-radio><sl-radio value="b" disabled>B</sl-radio><sl-radio value="c">C</sl-radio></sl-radio-group>');
  const markup = await frame.locator('#g1').evaluate(async el => {
    const state = () => [...el.querySelectorAll('sl-radio')].map(x => x.disabled);
    const on = state();
    el.disabled = false;
    await el.updateComplete;
    return { on, off: state() };
  });
  expect(markup).toEqual({ on: [true, true, true], off: [false, true, false] });
  // Disable, change the size (which syncs the radios), add a radio, then enable.
  await mount(frame, GROUP);
  const later = await frame.locator('#mount sl-radio-group').evaluate(async el => {
    const settle = async () => {
      await el.updateComplete;
      await new Promise(resolve => setTimeout(resolve, 30));
      await Promise.all([el, ...el.querySelectorAll('sl-radio')].map(x => x.updateComplete));
    };
    const state = () => [...el.querySelectorAll('sl-radio')].map(x => x.disabled);
    el.disabled = true;
    await settle();
    el.size = 'small';
    await settle();
    const added = document.createElement('sl-radio');
    added.value = 'e';
    added.textContent = 'E';
    el.append(added);
    await settle();
    const on = state();
    el.disabled = false;
    await settle();
    return { on, off: state() };
  });
  expect(later).toEqual({ on: [true, true, true, true, true], off: [false, false, true, false, false] });
});

test('Velcro extension disabled: a disabled group is barred from validation, directly and through the form, and enabling it restores its validity', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, `<form id="f">
    <sl-radio-group id="req" disabled required label="Required" name="req"><sl-radio value="a">A</sl-radio></sl-radio-group>
    <sl-radio-group id="custom" label="Custom" name="custom" value="a"><sl-radio value="a">A</sl-radio></sl-radio-group>
  </form>`);
  const r = await frame.locator('#f').evaluate(async form => {
    const settle = async () => {
      await new Promise(resolve => setTimeout(resolve, 30));
      await Promise.all([...form.querySelectorAll('sl-radio-group, sl-radio')].map(x => x.updateComplete));
    };
    await settle();
    const req = form.querySelector('#req');
    const custom = form.querySelector('#custom');
    const invalid = [];
    for (const el of [req, custom]) el.addEventListener('sl-invalid', () => invalid.push(el.id));
    const input = el => el.shadowRoot.querySelector('input');
    const snapshot = () => [req, custom].map(el => ({
      valid: el.validity.valid, message: el.validationMessage, check: el.checkValidity(), report: el.reportValidity(),
      attrs: ['data-valid', 'data-invalid'].map(a => el.hasAttribute(a)), inputHidden: input(el).hidden,
    }));
    custom.setCustomValidity('Choose another option');
    custom.disabled = true;
    await settle();
    const disabled = { each: snapshot(), form: [form.checkValidity(), form.reportValidity()], data: [...new FormData(form)],
      invalid: invalid.splice(0) };
    req.disabled = false;
    custom.disabled = false;
    await settle();
    const attrsOnEnable = [req, custom].map(el => el.hasAttribute('data-invalid'));
    const enabled = { attrsOnEnable, each: [req, custom].map(el => [el.validity.valid, el.validity.valueMissing, el.validity.customError]),
      form: form.checkValidity(), customCheck: custom.checkValidity(), invalid: invalid.splice(0) };
    // Hide the native validation bubbles again.
    for (const el of [req, custom]) input(el).hidden = true;
    return { disabled, enabled };
  });
  const exempt = { valid: true, message: '', check: true, report: true, attrs: [true, false], inputHidden: true };
  expect(r.disabled).toEqual({ each: [exempt, exempt], form: [true, true], data: [], invalid: [] });
  expect(r.enabled).toEqual({
    attrsOnEnable: [true, true], each: [[false, true, false], [false, false, true]], form: false, customCheck: false,
    invalid: ['req', 'custom'],
  });
});

test('Velcro extension disabled: the arrow keys and Space are ignored by a disabled group (no error)', async ({ page }) => {
  const { frame } = await openExample(page);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await mount(frame, GROUP);
  await frame.locator('body').click({ position: { x: 1, y: 1 } });
  await frame.locator('#mount sl-radio-group').evaluate(async el => { el.disabled = true; await el.updateComplete; });
  await frame.locator('#mount sl-radio[value="b"]').evaluate(el => el.focus());
  await recordKeys(frame.locator('body'));
  for (const key of ['ArrowDown', 'ArrowUp', 'Space']) await pressReceived(page, frame.locator('body'), key);
  expect(await radios(frame)).toEqual(['a:false', 'b:true', 'c:false', 'd:false']);
  expect(errors).toEqual([]);
});

test('Velcro extensions readonly, hide-label and error-message: no value change, visually hidden label, custom validity', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, `<button id="start">start</button>${GROUP}`);
  const group = frame.locator('#mount sl-radio-group');
  await group.evaluate(async el => { el.readonly = true; el.hideLabel = true; el.errorMessage = 'Bad'; await el.updateComplete; });
  await frame.locator('#mount sl-radio[value="a"]').click();
  await frame.locator('#mount sl-radio[value="b"]').focus();
  await recordKeys(frame.locator('body'));
  await pressReceived(page, frame.locator('body'), 'ArrowDown');
  const r = await group.evaluate(el => {
    const label = el.shadowRoot.querySelector('#label');
    return { value: el.value, radiosReadonly: [...el.querySelectorAll('sl-radio')].every(x => x.readonly),
      clip: getComputedStyle(label).position, width: label.getBoundingClientRect().width, valid: el.validity.customError, message: el.validationMessage };
  });
  expect(r).toEqual({ value: 'b', radiosReadonly: true, clip: 'absolute', width: 1, valid: true, message: 'Bad' });
});

test('core\'s layout, invalid and label-position are accepted and reflected but change nothing', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, GROUP);
  const r = await frame.locator('#mount sl-radio-group').evaluate(async el => {
    const html = () => el.shadowRoot.innerHTML.replace(/<!--[^>]*-->/g, '');
    const before = [html(), [...el.querySelectorAll('sl-radio')].map(x => x.vertical)];
    el.layout = 'horizontal-stacked';
    el.invalid = true;
    el.labelPosition = 'start';
    await el.updateComplete;
    return { same: before[0] === html(), vertical: [...el.querySelectorAll('sl-radio')].map(x => x.vertical), before: before[1],
      attrs: ['layout', 'invalid', 'label-position'].map(a => el.hasAttribute(a)) };
  });
  expect(r.same).toBe(true);
  expect(r.vertical).toEqual(r.before);
  expect(r.attrs).toEqual([true, true, true]);
});

test('autofocus is the platform\'s property, as in Shoelace: it reflects synchronously, is not observed, and an upgraded autofocus attribute stays', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-radio-group id="af" autofocus><sl-radio value="a">A</sl-radio></sl-radio-group>');
  const r = await frame.locator('#af').evaluate(async el => {
    const upgraded = [el.autofocus, el.hasAttribute('autofocus')];
    const observed = el.constructor.observedAttributes.includes('autofocus');
    el.autofocus = false;
    const sync = el.hasAttribute('autofocus');
    el.autofocus = true;
    const syncOn = el.hasAttribute('autofocus');
    const pending = el.isUpdatePending;
    // Built before upgrade: core's constructor default does not remove the attribute.
    const fresh = document.createElement('div');
    fresh.innerHTML = '<sl-radio-group autofocus></sl-radio-group>';
    const created = fresh.firstElementChild;
    document.body.append(fresh);
    await created.updateComplete;
    const kept = [created.autofocus, created.hasAttribute('autofocus')];
    fresh.remove();
    return { upgraded, observed, sync, syncOn, pending, kept };
  });
  expect(r).toEqual({ upgraded: [true, true], observed: false, sync: false, syncOn: true, pending: false, kept: [true, true] });
});

test('value: a group without a value reflects value="" after its first update, as Shoelace\'s class field does', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-radio-group id="nv"><sl-radio value="a">A</sl-radio></sl-radio-group>');
  const r = await frame.locator('#nv').evaluate(el => [el.getAttribute('value'), el.value, el.matches('[value=""]')]);
  expect(r).toEqual(['', '', true]);
  const created = await frame.locator('body').evaluate(async body => {
    const el = document.createElement('sl-radio-group');
    body.append(el);
    await el.updateComplete;
    const attrs = el.getAttributeNames().sort();
    el.remove();
    return attrs;
  });
  expect(created).toEqual(['data-optional', 'data-valid', 'focusable', 'form', 'size', 'value']);
});

test('watch hooks run as Shoelace\'s @watch decorators do: value (from the first update) before size (after it), with the previous and current values', async ({ page }) => {
  const { frame } = await openExample(page);
  const calls = await frame.locator('body').evaluate(async body => {
    const calls = [];
    const Base = customElements.get('sl-radio-group');
    class Traced extends Base {
      handleValueChange(...args) {
        calls.push(['value', args, [...this.querySelectorAll('sl-radio')].map(r => r.checked)]);
        super.handleValueChange(...args);
      }
      handleSizeChange(...args) {
        calls.push(['size', args, [...this.querySelectorAll('sl-radio')].map(r => r.size)]);
        super.handleSizeChange(...args);
      }
    }
    customElements.define('velcro-traced-radio-group', Traced);
    const host = document.createElement('div');
    host.innerHTML = '<velcro-traced-radio-group value="a"><sl-radio value="a">A</sl-radio><sl-radio value="b">B</sl-radio></velcro-traced-radio-group>';
    body.append(host);
    const el = host.firstElementChild;
    await el.updateComplete;
    await new Promise(resolve => setTimeout(resolve, 30));
    calls.push('first update done');
    el.value = 'b';
    el.size = 'large';
    await el.updateComplete;
    calls.push('batched update done');
    host.remove();
    return calls;
  });
  expect(calls).toEqual([
    ['value', [undefined, 'a'], [false, false]],
    'first update done',
    ['value', ['a', 'b'], [true, false]],
    ['size', ['medium', 'large'], ['medium', 'medium']],
    'batched update done',
  ]);
});

test('every example renders its groups and radios and none requests the Shoelace runtime', async ({ page }) => {
  const { requests } = await openExample(page);
  await documentsLoaded(page);
  for (const [title] of EXAMPLES) {
    const frame = frameFor(page, title);
    await expect(frame.locator('sl-radio-group').first()).toBeVisible();
    expect(await frame.locator('sl-radio-group').first().evaluate(el => Boolean(el.shadowRoot?.querySelector('[part="form-control"]')))).toBe(true);
  }
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
});

test('the validation example blocks submission until an option is chosen, then submits', async ({ page }) => {
  const { frame } = await openExample(page, 'Validation');
  const dialogs = [];
  page.on('dialog', dialog => { dialogs.push(dialog.message()); void dialog.dismiss(); });
  await frame.locator('sl-button[type="submit"]').click();
  expect(dialogs).toEqual([]);
  expect(await frame.locator('sl-radio-group').evaluate(el => el.hasAttribute('data-user-invalid'))).toBe(true);
  await frame.locator('sl-radio[value="2"]').click();
  await frame.locator('sl-button[type="submit"]').click();
  await expect.poll(() => dialogs).toEqual(['All fields are valid!']);
});

// Shoelace's React examples, ported in packages/docs/examples/radio-group/react/*.jsx (the files the docs page shows),
// bundled with React 19 and the generated wrappers, resolved through the package's real export map.
test.describe('React examples', () => {
  const velcroDir = fileURLToPath(new URL('../../packages/velcro/', import.meta.url));
  const reactDir = fileURLToPath(new URL('../../packages/docs/examples/radio-group/react/', import.meta.url));
  const NAMES = EXAMPLES.map(([, name]) => name);
  let bundle;

  test.beforeAll(async () => {
    const fromVelcro = createRequire(path.join(velcroDir, 'package.json'));
    const fromDocs = createRequire(fileURLToPath(new URL('../../packages/docs/package.json', import.meta.url)));
    const pkgDir = name => path.dirname(fromVelcro.resolve(`${name}/package.json`));
    const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
    const dir = mkdtempSync(path.join(tmpdir(), 'velcro-radio-group-react-'));
    try {
      // Each example file declares `App` without exporting it (as on Shoelace's page); the copy only appends the export.
      for (const name of NAMES) {
        writeFileSync(path.join(dir, `${name}.jsx`), `${readFileSync(path.join(reactDir, `${name}.jsx`), 'utf8')}\nexport default App;\n`);
      }
      const entry = path.join(dir, 'entry.js');
      writeFileSync(entry, `
        import React from 'react';
        import { flushSync } from 'react-dom';
        import { createRoot } from 'react-dom/client';
        ${NAMES.map((name, i) => `import App${i} from './${name}.jsx';`).join('\n')}
        const apps = { ${NAMES.map((name, i) => `${JSON.stringify(name)}: App${i}`).join(', ')} };
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

  async function mountReact(page, name) {
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.setContent('<!DOCTYPE html><html><body style="margin: 0"></body></html>');
    await page.addScriptTag({ type: 'module', content: bundle });
    await page.waitForFunction(() => typeof window.renderExample === 'function');
    await page.evaluate(n => window.renderExample(n), name);
    await settle(page.locator('body'));
    return pageErrors;
  }

  const state = page => page.evaluate(() => [...document.querySelectorAll('sl-radio-group')].map(g =>
    [g.value, g.size, g.label, ...[...g.querySelectorAll('sl-radio, sl-radio-button')].map(r => `${r.localName}:${r.value}:${r.checked}:${r.disabled}`)]));

  const expected = {
    overview: [['1', 'medium', 'Select an option', 'sl-radio:1:true:false', 'sl-radio:2:false:false', 'sl-radio:3:false:false']],
    'help-text': [['1', 'medium', 'Select an option', 'sl-radio:1:true:false', 'sl-radio:2:false:false', 'sl-radio:3:false:false']],
    'radio-buttons': [['1', 'medium', 'Select an option', 'sl-radio-button:1:true:false', 'sl-radio-button:2:false:false', 'sl-radio-button:3:false:false']],
    'disabling-options': [['1', 'medium', 'Select an option', 'sl-radio:1:true:false', 'sl-radio:2:false:true', 'sl-radio:3:false:false']],
    'sizing-options': [['medium', 'medium', 'Select an option', 'sl-radio:small:false:false', 'sl-radio:medium:true:false', 'sl-radio:large:false:false']],
    validation: [['', 'medium', 'Select an option', 'sl-radio:1:false:false', 'sl-radio:2:false:false', 'sl-radio:3:false:false']],
    'custom-validity': [['1', 'medium', 'Select an option', 'sl-radio:1:true:false', 'sl-radio:2:false:false', 'sl-radio:3:false:false']],
  };
  for (const name of NAMES) {
    test(`${name}: renders the same group and checked radios as the HTML example, without errors`, async ({ page }) => {
      const pageErrors = await mountReact(page, name);
      expect(await page.evaluate(() => window.reactVersion)).toBe('19.2.0');
      expect(await state(page)).toEqual(expected[name]);
      expect(await page.evaluate(() => window.errors)).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  }

  test('sizing options: choosing a size through onSlChange re-renders the group at that size', async ({ page }) => {
    await mountReact(page, 'sizing-options');
    // The wrapper sets value as a property; sl-radio does not reflect it, so the radios are found by position.
    await page.locator('sl-radio').nth(2).click();
    await expect.poll(() => state(page)).toEqual([['large', 'large', 'Select an option', 'sl-radio:small:false:false', 'sl-radio:medium:false:false', 'sl-radio:large:true:false']]);
    expect(await page.evaluate(() => [...document.querySelectorAll('sl-radio')].map(r => r.size))).toEqual(['large', 'large', 'large']);
  });

  test('custom validity: the effect sets the message and choosing the last option clears it', async ({ page }) => {
    await mountReact(page, 'custom-validity');
    expect(await page.evaluate(() => document.querySelector('sl-radio-group').validationMessage)).toBe('You must choose this option');
    await page.locator('sl-radio').nth(2).click();
    await expect.poll(() => page.evaluate(() => document.querySelector('sl-radio-group').validity.valid)).toBe(true);
  });
});
