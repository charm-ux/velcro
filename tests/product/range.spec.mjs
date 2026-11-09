import { readdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { bundleExamples, docsDir, loadBundle, loadExamples } from './support/bundle.mjs';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';
import { reactWrapperPage } from './support/react.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/range';
// Shoelace 2.20.1's range page has ten previews (the opening one, then Labels, Help Text, Min Max and Step, Disabled,
// Tooltip Placement, Disable the Tooltip, Custom Track Colors, Custom Track Offset and Custom Tooltip Formatter), all ported in
// Shoelace's order, each live and with a React version.
const ORDER = [
  ['basic', 'Default'], ['labels', 'Labels'], ['help-text', 'Help Text'], ['min-max-step', 'Min, Max, and Step'],
  ['disabled', 'Disabled'], ['tooltip-placement', 'Tooltip Placement'], ['disable-tooltip', 'Disable the Tooltip'],
  ['custom-track-colors', 'Custom Track Colors'], ['custom-track-offset', 'Custom Track Offset'],
  ['custom-tooltip-formatter', 'Custom Tooltip Formatter'],
];
const title = section => `Range example: ${section}`;

async function openExample(page) {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  const frame = page.frameLocator(`iframe.example[title="${title('Default')}"]`);
  await expect(frame.locator('sl-range')).toBeVisible();
  await documentsLoaded(page);
  return { frame, requests };
}

// Waits for every range in a frame, and returns per range: [label, helpText, value, min, max, step, disabled, tooltip, inline style].
const frameState = frame => frame.locator('body').evaluate(async () => {
  await customElements.whenDefined('sl-range');
  await Promise.all([...document.querySelectorAll('sl-range')].map(el => el.updateComplete));
  return [...document.querySelectorAll('sl-range')].map(el => [
    el.label, el.helpText, el.value, el.min, el.max, el.step, el.disabled, el.tooltip, el.getAttribute('style')?.replace(/\s+/g, ' ').trim() ?? '',
  ]);
});

// The package entries, in a top-level document of the test's own.
const ENTRY = `
  import '@charm-ux/velcro/range';
  window.loaded = true;
`;
const CLASS_ENTRY = `
  import { SlRange, VelcroRange } from '@charm-ux/velcro/range/class';
  window.rangeClass = { SlRange, VelcroRange };
  window.loaded = true;
`;

// Replaces the document with a range (id r) and waits for it. The events the range emits (sl-blur, sl-change, sl-focus, sl-input
// and sl-invalid, which does not bubble, so the listeners are capturing) are recorded as [type, value, bubbles, composed].
async function mount(page, attrs = '', inner = '') {
  await page.evaluate(async ([attrs, inner]) => {
    window.events = [];
    if (!window.listening) {
      window.listening = true;
      for (const type of ['sl-blur', 'sl-change', 'sl-focus', 'sl-input', 'sl-invalid']) {
        document.addEventListener(type, e => window.events.push([type, e.target.value, e.bubbles, e.composed]), true);
      }
    }
    document.body.innerHTML = `<sl-range id="r" ${attrs}>${inner}</sl-range>`;
    await document.querySelector('#r').updateComplete;
  }, [attrs, inner]);
}
const events = page => page.evaluate(() => window.events.splice(0));
const eventTypes = async page => (await events(page)).map(e => e[0]);
const state = page => page.evaluate(() => {
  const el = document.querySelector('#r');
  return {
    value: el.value,
    native: el.input.value,
    percent: el.input.style.getPropertyValue('--percent'),
    tooltip: el.output ? el.output.textContent.trim() : null,
    visible: el.shadowRoot.querySelector('.range').classList.contains('range--tooltip-visible'),
  };
});
const focus = page => page.evaluate(() => document.querySelector('#r').focus());
// The viewport point at `fraction` of the native control's width, vertically centered.
const point = (page, fraction) => page.evaluate(fraction => {
  const box = document.querySelector('#r').input.getBoundingClientRect();
  return [box.left + box.width * fraction, box.top + box.height / 2];
}, fraction);

test('docs page is prerendered with Velcro branding, prototype status, every ported section in order, the quirks and the gaps', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Range - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('without changing the shared core prefix');
  expect(html).toContain('was run locally in Chromium and WebKit only, and Firefox is covered only by the project&#39;s CI run');
  expect(html).toContain('Playwright&#39;s ARIA snapshot');
  expect(html).toContain('makes the next render throw a TypeError');
  expect(html).toContain('the range renders again once value is a number');
  expect(html).toContain('throws a TypeError from disconnectedCallback');
  expect(html).toContain('it hides on the mouse or touch release even though the range keeps the focus');
  expect(html).toContain('so they throw when called before the first render');
  expect(html).toContain('Changing min or max does not re-clamp value');
  expect(html).toContain('55.00000000000001%');
  expect(html).toContain('the inactive track is primary-100 in HTML and primary-200 in React');
  const positions = ORDER.map(([, section]) => html.indexOf(`title="${title(section)}"`));
  expect(positions.every(p => p > 0)).toBe(true);
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  // The API tables: Shoelace's attributes, methods, events, parts, slots and custom properties; ready is labelled as inherited.
  for (const name of ['name', 'value', 'label', 'help-text', 'disabled', 'min', 'max', 'step', 'tooltip', 'tooltipFormatter', 'form', 'defaultValue', 'validity', 'validationMessage', 'focus', 'blur', 'stepUp', 'stepDown', 'checkValidity', 'getForm', 'reportValidity', 'setCustomValidity', 'sl-blur', 'sl-change', 'sl-focus', 'sl-input', 'sl-invalid', 'form-control', 'form-control-label', 'form-control-input', 'form-control-help-text', 'base', 'input', 'tooltip', '--thumb-size', '--tooltip-offset', '--track-color-active', '--track-color-inactive', '--track-height', '--track-active-offset']) {
    expect(html).toContain(`data-name="${name}"`);
  }
  expect(html).toContain('Inherited from @charm-ux/core CharmElement');
  expect(html).toContain('<summary>React</summary>');
  expect(html).toContain('import { VelcroRange as SlRange } from &#39;@charm-ux/velcro/react/VelcroRange.js&#39;;');
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(await (await request.get('/')).text()).toContain('/components/range');
});

test('examples: Shoelace\'s order, live in their own documents, with a React version each; no Shoelace runtime is requested', async ({ page }) => {
  const { requests } = await openExample(page);
  const titles = await page.locator('iframe.example').evaluateAll(frames => frames.map(f => f.title));
  expect(titles).toEqual(ORDER.map(([, section]) => title(section)));
  const out = {};
  for (const [id, section] of ORDER) out[id] = await frameState(page.frameLocator(`iframe.example[title="${title(section)}"]`));
  const range = (overrides = {}) => [[overrides.label ?? '', overrides.helpText ?? '', 0, overrides.min ?? 0, overrides.max ?? 100, overrides.step ?? 1, overrides.disabled ?? false, overrides.tooltip ?? 'top', overrides.style ?? '']];
  expect(out.basic).toEqual(range());
  expect(out.labels).toEqual(range({ label: 'Volume' }));
  expect(out['help-text']).toEqual(range({ label: 'Volume', helpText: 'Controls the volume of the current song.' }));
  expect(out['min-max-step']).toEqual(range({ max: 10 }));
  expect(out.disabled).toEqual(range({ disabled: true }));
  expect(out['tooltip-placement']).toEqual(range({ tooltip: 'bottom' }));
  expect(out['disable-tooltip']).toEqual(range({ tooltip: 'none' }));
  expect(out['custom-track-colors']).toEqual(range({ style: '--track-color-active: var(--sl-color-primary-600); --track-color-inactive: var(--sl-color-primary-100);' }));
  expect(out['custom-track-offset']).toEqual(range({ min: -100, style: '--track-color-active: var(--sl-color-primary-600); --track-color-inactive: var(--sl-color-primary-100); --track-active-offset: 50%;' }));
  expect(out['custom-tooltip-formatter']).toEqual(range());
  const files = dir => readdirSync(path.join(docsDir, 'examples/range', dir)).filter(f => /\.(html|jsx)$/.test(f)).sort();
  expect(files('')).toEqual(ORDER.map(([id]) => `${id}.html`).sort());
  expect(files('react')).toEqual(ORDER.map(([id]) => `${id}.jsx`).sort());
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
});

test('Disabled, Tooltip Placement, Disable the Tooltip and Custom Tooltip Formatter examples: the inner control, the tooltip and the formatter', async ({ page }) => {
  await openExample(page);
  const read = (section, fn) => page.frameLocator(`iframe.example[title="${title(section)}"]`).locator('sl-range').evaluate(fn);
  const info = el => [el.input.disabled, el.shadowRoot.querySelector('.range').className.trim().split(/\s+/).filter(c => c !== 'range').join(' '), el.output ? el.output.textContent.trim() : null];
  expect(await read('Default', info)).toEqual([false, 'range--tooltip-top', '0']);
  expect(await read('Disabled', info)).toEqual([true, 'range--disabled range--tooltip-top', null]);
  expect(await read('Tooltip Placement', info)).toEqual([false, 'range--tooltip-bottom', '0']);
  expect(await read('Disable the Tooltip', info)).toEqual([false, '', null]);
  // The formatter is set by the example's script, and the tooltip follows the value.
  expect(await read('Custom Tooltip Formatter', el => [typeof el.tooltipFormatter, el.output.textContent.trim()])).toEqual(['function', 'Total - 0%']);
  expect(await read('Custom Tooltip Formatter', async el => {
    el.value = 42;
    await el.updateComplete;
    return el.output.textContent.trim();
  })).toBe('Total - 42%');
  // Custom Track Colors and Offset: the host's custom properties reach the control through inheritance, and --percent follows the value.
  const colors = await read('Custom Track Colors', el => {
    const probe = name => {
      const span = document.createElement('span');
      span.style.color = `var(${name})`;
      document.body.append(span);
      const color = getComputedStyle(span).color;
      span.remove();
      return color;
    };
    const style = getComputedStyle(el);
    return [style.getPropertyValue('--track-color-active') === style.getPropertyValue('--sl-color-primary-600'), style.getPropertyValue('--track-color-inactive') === style.getPropertyValue('--sl-color-primary-100'), probe('--sl-color-primary-600') !== probe('--sl-color-primary-100')];
  });
  expect(colors).toEqual([true, true, true]);
  expect(await read('Custom Track Offset', async el => {
    el.value = 50;
    await el.updateComplete;
    return [getComputedStyle(el).getPropertyValue('--track-active-offset'), el.input.style.getPropertyValue('--percent'), el.min];
  })).toEqual(['50%', '75%', -100]);
});

test('package entry: Shoelace\'s structure, attributes, defaults and styles', async ({ page }) => {
  const pageErrors = await loadBundle(page, ENTRY);
  await mount(page);
  const r = await page.evaluate(() => {
    const el = document.querySelector('#r');
    const control = el.shadowRoot.querySelector('.form-control');
    const input = el.shadowRoot.querySelector('input');
    const output = el.shadowRoot.querySelector('output');
    const attrs = node => Object.fromEntries([...node.attributes].map(a => [a.name, a.value]));
    const style = getComputedStyle(el);
    const inputStyle = getComputedStyle(input);
    return {
      shadow: [...el.shadowRoot.children].map(c => c.localName),
      wrapper: [attrs(control).part, [...control.classList], [...control.children].map(c => c.localName)],
      label: [attrs(control.children[0]), control.children[0].querySelector('slot').getAttribute('name')],
      inputWrapper: [attrs(control.children[1]), [...control.children[1].children].map(c => attrs(c))],
      base: [...control.children[1].firstElementChild.children].map(c => c.localName),
      input: attrs(input),
      output: [attrs(output), output.textContent.trim()],
      help: [attrs(control.children[2]), control.children[2].querySelector('slot').getAttribute('name')],
      properties: [el.name, el.value, el.label, el.helpText, el.disabled, el.min, el.max, el.step, el.tooltip, typeof el.tooltipFormatter, el.tooltipFormatter(7), el.form, el.defaultValue, el.title, el.input === input, el.output === output],
      reflected: [...el.attributes].map(a => a.name).filter(n => !n.startsWith('data-')).sort(),
      layout: [style.display, style.getPropertyValue('--thumb-size').trim(), style.getPropertyValue('--tooltip-offset').trim(), style.getPropertyValue('--track-height').trim(), style.getPropertyValue('--track-active-offset').trim(), getComputedStyle(el.shadowRoot.querySelector('.range')).position, inputStyle.height, inputStyle.borderRadius, inputStyle.width === getComputedStyle(el.shadowRoot.querySelector('.range')).width],
      tooltipStyle: (() => {
        const t = getComputedStyle(output);
        return [t.position, t.pointerEvents, t.opacity, t.left, t.top];
      })(),
    };
  });
  expect(r.shadow).toEqual(['div']);
  expect(r.wrapper).toEqual(['form-control', ['form-control', 'form-control--medium'], ['label', 'div', 'div']]);
  expect(r.label).toEqual([{ part: 'form-control-label', class: 'form-control__label', for: 'input', 'aria-hidden': 'true' }, 'label']);
  expect(r.inputWrapper).toEqual([
    { part: 'form-control-input', class: 'form-control-input' },
    [{ part: 'base', class: ' range range--tooltip-top ' }],
  ]);
  expect(r.base).toEqual(['input', 'output']);
  expect(r.input).toEqual({ part: 'input', id: 'input', class: 'range__control', title: '', type: 'range', name: '', min: '0', max: '100', step: '1', 'aria-describedby': 'help-text', style: '--percent: 0%;' });
  expect(r.output).toEqual([{ part: 'tooltip', class: 'range__tooltip' }, '0']);
  expect(r.help).toEqual([{ part: 'form-control-help-text', id: 'help-text', class: 'form-control__help-text', 'aria-hidden': 'true' }, 'help-text']);
  expect(r.properties).toEqual(['', 0, '', '', false, 0, 100, 1, 'top', 'function', '7', '', 0, '', true, true]);
  // As in Shoelace, only disabled and form are reflected (disabled is false, so only form="" appears).
  expect(r.reflected).toEqual(['form', 'id']);
  expect(r.layout).toEqual(['block', '20px', '10px', '6px', '0%', 'relative', '6px', '3px', true]);
  expect(r.tooltipStyle).toEqual(['absolute', 'none', '0', '0px', '-30px']);
  expect(pageErrors).toEqual([]);
});

test('label, help text and their slots: the slot content and the attributes drive the has-label and has-help-text classes and aria-hidden', async ({ page }) => {
  await loadBundle(page, ENTRY);
  const read = () => page.evaluate(() => {
    const el = document.querySelector('#r');
    const control = el.shadowRoot.querySelector('.form-control');
    const label = el.shadowRoot.querySelector('.form-control__label');
    const help = el.shadowRoot.querySelector('.form-control__help-text');
    return {
      classes: [...control.classList].filter(c => c.startsWith('form-control--')),
      aria: [label.getAttribute('aria-hidden'), help.getAttribute('aria-hidden')],
      display: [getComputedStyle(label).display, getComputedStyle(help).display],
      text: [label.textContent.trim(), help.textContent.trim()],
      assigned: [el.shadowRoot.querySelector('slot[name="label"]').assignedNodes().length, el.shadowRoot.querySelector('slot[name="help-text"]').assignedNodes().length],
    };
  });
  await mount(page);
  expect(await read()).toEqual({ classes: ['form-control--medium'], aria: ['true', 'true'], display: ['none', 'none'], text: ['', ''], assigned: [0, 0] });
  await mount(page, 'label="Volume" help-text="Controls the volume."');
  expect(await read()).toEqual({ classes: ['form-control--medium', 'form-control--has-label', 'form-control--has-help-text'], aria: ['false', 'false'], display: ['inline-block', 'block'], text: ['Volume', 'Controls the volume.'], assigned: [0, 0] });
  // The slotted content replaces the attribute's text, and also turns the has-* classes on.
  await mount(page, 'label="Attribute" help-text="Attribute help"', '<span slot="label">Slotted <b>label</b></span><span slot="help-text">Slotted help</span>');
  const slotted = await read();
  expect(slotted.classes).toEqual(['form-control--medium', 'form-control--has-label', 'form-control--has-help-text']);
  expect(slotted.assigned).toEqual([1, 1]);
  await mount(page, '', '<span slot="label">Only slotted</span><span slot="help-text">Only help</span>');
  const only = await read();
  expect([only.classes, only.aria, only.assigned]).toEqual([['form-control--medium', 'form-control--has-label', 'form-control--has-help-text'], ['false', 'false'], [1, 1]]);
  // Slot content added later turns the classes on too (the slot change re-renders the range).
  await mount(page);
  await page.evaluate(() => {
    const span = document.createElement('span');
    span.slot = 'label';
    span.textContent = 'Late';
    document.querySelector('#r').append(span);
  });
  await expect.poll(async () => (await read()).aria[0]).toBe('false');
});

test('value: set from the attribute or script, clamped when the range connects, and read back from the native input (min, max and step) after each update', async ({ page }) => {
  await loadBundle(page, ENTRY);
  const r = await page.evaluate(async () => {
    const out = {};
    const make = async html => {
      const holder = document.createElement('div');
      holder.innerHTML = html;
      document.body.append(holder);
      const el = holder.firstElementChild;
      await el.updateComplete;
      return el;
    };
    const el = await make('<sl-range value="30"></sl-range>');
    out.attribute = [el.value, el.defaultValue, el.input.value, el.getAttribute('value')];
    out.clampHigh = (await make('<sl-range value="150"></sl-range>')).value;
    out.clampLow = (await make('<sl-range min="10" max="20" value="5"></sl-range>')).value;
    el.value = 150;
    await el.updateComplete;
    out.scriptHigh = [el.value, el.input.value, el.output.textContent.trim()];
    el.value = -7;
    await el.updateComplete;
    out.scriptLow = el.value;
    el.step = 10;
    await el.updateComplete;
    el.value = 33;
    await el.updateComplete;
    out.step = [el.value, el.input.value];
    el.value = 2.5;
    await el.updateComplete;
    out.stepRounded = el.value;
    el.min = 20;
    await el.updateComplete;
    // Upstream quirk: changing min does not re-clamp the value property, so it keeps 0 while the control shows 20.
    out.minChanged = [el.value, el.input.value];
    el.value = 5;
    await el.updateComplete;
    out.newMin = el.value;
    el.setAttribute('value', '60');
    await el.updateComplete;
    out.changedAttribute = [el.value, el.defaultValue, el.input.value];
    return out;
  });
  expect(r.attribute).toEqual([30, 30, '30', '30']);
  expect(r.clampHigh).toBe(100);
  expect(r.clampLow).toBe(10);
  expect(r.scriptHigh).toEqual([100, '100', '100']);
  expect(r.scriptLow).toBe(0);
  expect(r.step).toEqual([30, '30']);
  expect(r.stepRounded).toBe(0);
  expect(r.minChanged).toEqual([0, '20']);
  expect(r.newMin).toBe(20);
  expect(r.changedAttribute).toEqual([60, 60, '60']);
});

test('attributes: disabled and form reflect; the others do not; disabled and form set to null or undefined get their initial value back once any attribute has been set', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'name="n" label="L" help-text="H" min="5" max="50" step="5" value="10" tooltip="bottom" disabled form="f"');
  const r = await page.evaluate(async () => {
    const el = document.querySelector('#r');
    const initial = [el.name, el.label, el.helpText, el.min, el.max, el.step, el.value, el.tooltip, el.disabled, el.form, el.input.disabled];
    el.name = 'n2';
    el.label = 'L2';
    el.helpText = 'H2';
    el.min = 6;
    el.max = 60;
    el.step = 3;
    el.value = 12;
    el.tooltip = 'top';
    el.disabled = false;
    el.form = 'g';
    await el.updateComplete;
    const attributes = ['name', 'label', 'help-text', 'min', 'max', 'step', 'value', 'tooltip', 'disabled', 'form'].map(a => el.getAttribute(a));
    el.disabled = true;
    el.form = null;
    await el.updateComplete;
    el.disabled = undefined;
    el.form = undefined;
    await el.updateComplete;
    const restored = [el.disabled, el.form, el.hasAttribute('disabled'), el.getAttribute('form')];
    // As in Shoelace, the initial values are recorded on the first attribute change. A range that never had an attribute gets
    // its first one from the first update, which writes the reflected form="" attribute, so it is restored too.
    const bare = document.createElement('sl-range');
    document.body.append(bare);
    await bare.updateComplete;
    bare.disabled = null;
    await bare.updateComplete;
    return { initial, attributes, restored, bare: bare.disabled };
  });
  expect(r.initial).toEqual(['n', 'L', 'H', 5, 50, 5, 10, 'bottom', true, 'f', true]);
  // The properties changed from script show in the attributes only for the reflected ones (disabled false removes its attribute).
  expect(r.attributes).toEqual(['n', 'L', 'H', '5', '50', '5', '10', 'bottom', null, 'g']);
  expect(r.restored).toEqual([false, '', false, '']);
  expect(r.bare).toBe(false);
});

test('keyboard: arrows move the value by step, Home and End go to min and max, each key emits sl-input then sl-change; the tooltip and the progress follow', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'value="50" step="5"');
  await focus(page);
  await expect.poll(() => eventTypes(page)).toEqual(['sl-focus']);
  const keys = [['ArrowRight', 55], ['ArrowUp', 60], ['ArrowLeft', 55], ['ArrowDown', 50], ['End', 100], ['ArrowRight', 100], ['Home', 0], ['ArrowLeft', 0], ['ArrowRight', 5]];
  for (const [key, expected] of keys) {
    await page.keyboard.press(key);
    await expect.poll(() => state(page).then(s => s.value)).toBe(expected);
    const s = await state(page);
    expect({ ...s, percent: undefined }).toEqual({ value: expected, native: String(expected), percent: undefined, tooltip: String(expected), visible: true });
    expect(s.percent).toMatch(/^[\d.]+%$/);
    expect(parseFloat(s.percent)).toBeCloseTo(expected, 6);
    // A key at the end of the range changes nothing and emits nothing.
    const changed = (await events(page)).map(e => e[0]);
    expect(changed).toEqual(expected === 100 && key === 'ArrowRight' || expected === 0 && key === 'ArrowLeft' ? [] : ['sl-input', 'sl-change']);
  }
  await page.evaluate(() => document.querySelector('#r').blur());
  await expect.poll(() => eventTypes(page)).toEqual(['sl-blur']);
});

test('events: sl-focus, sl-input, sl-change and sl-blur bubble, are composed and carry the value; setting value from script, stepUp() and stepDown() emit nothing', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'value="10"');
  await focus(page);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => state(page).then(s => s.value)).toBe(11);
  expect(await events(page)).toEqual([['sl-focus', 10, true, true], ['sl-input', 11, true, true], ['sl-change', 11, true, true]]);
  await page.evaluate(() => document.querySelector('#r').blur());
  await expect.poll(() => events(page)).toEqual([['sl-blur', 11, true, true]]);
  const quiet = await page.evaluate(async () => {
    const el = document.querySelector('#r');
    el.value = 40;
    await el.updateComplete;
    el.stepUp();
    el.stepUp();
    await el.updateComplete;
    const up = [el.value, el.input.value];
    el.stepDown();
    await el.updateComplete;
    return { up, down: el.value, events: window.events.splice(0), tooltip: el.output.textContent.trim(), percent: el.input.style.getPropertyValue('--percent') };
  });
  expect(quiet).toEqual({ up: [42, '42'], down: 41, events: [], tooltip: '41', percent: '41%' });
});

test('pointer: a click on the control sets the value at the pointer and emits sl-input then sl-change; pressing shows the tooltip and releasing hides it', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page);
  await page.mouse.click(...await point(page, 0.5));
  await expect.poll(() => state(page).then(s => s.value)).toBeGreaterThanOrEqual(45);
  const s = await state(page);
  expect(s.value).toBeLessThanOrEqual(55);
  expect(s.native).toBe(String(s.value));
  expect(s.tooltip).toBe(String(s.value));
  expect(parseFloat(s.percent)).toBeCloseTo(s.value, 6);
  await expect.poll(async () => (await page.evaluate(() => window.events)).map(e => e[0]).at(-1)).toBe('sl-change');
  // Whether a click focuses a range depends on the engine (WebKit does not), so sl-focus and sl-blur are left out.
  const types = (await eventTypes(page)).filter(type => type === 'sl-input' || type === 'sl-change');
  expect(types).toEqual(['sl-input', 'sl-change']);
  await expect.poll(() => state(page).then(x => x.visible)).toBe(false);
  await page.mouse.move(...await point(page, 0.8));
  await page.mouse.down();
  await expect.poll(() => state(page).then(x => x.visible)).toBe(true);
  await expect.poll(() => state(page).then(x => x.value)).toBeGreaterThanOrEqual(75);
  await page.mouse.up();
  await expect.poll(() => state(page).then(x => x.visible)).toBe(false);
});

test('upstream quirk: the tooltip hides on the mouse or touch release although the range keeps the focus, and keyboard changes do not bring it back', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'value="50"');
  await focus(page);
  await expect.poll(() => state(page).then(x => x.visible)).toBe(true);
  // Synthetic press and release on the base box, so that no engine's own focus handling for a click is involved.
  const dispatch = type => page.evaluate(type => {
    const base = document.querySelector('#r').shadowRoot.querySelector('.range');
    base.dispatchEvent(new Event(type, { bubbles: true, composed: true }));
    return document.querySelector('#r').shadowRoot.activeElement === document.querySelector('#r').input;
  }, type);
  for (const [down, up] of [['mousedown', 'mouseup'], ['touchstart', 'touchend']]) {
    expect(await dispatch(down)).toBe(true);
    await expect.poll(() => state(page).then(x => x.visible)).toBe(true);
    expect(await dispatch(up)).toBe(true);
    await expect.poll(() => state(page).then(x => x.visible)).toBe(false);
  }
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => state(page).then(x => x.value)).toBe(51);
  expect((await state(page)).visible).toBe(false);
  // The focus leaving and returning shows it again.
  await page.evaluate(() => document.querySelector('#r').blur());
  await focus(page);
  await expect.poll(() => state(page).then(x => x.visible)).toBe(true);
});

test('tooltip: shown on focus above (default) or below the control, hidden without focus, not rendered with tooltip="none" or when disabled, and following the formatter', async ({ page }) => {
  await loadBundle(page, ENTRY);
  const rects = () => page.evaluate(() => {
    const el = document.querySelector('#r');
    const input = el.input.getBoundingClientRect();
    const tooltip = el.output.getBoundingClientRect();
    return { above: tooltip.bottom <= input.top, below: tooltip.top >= input.bottom, opacity: getComputedStyle(el.output).opacity };
  });
  await mount(page, 'value="25"');
  expect(await rects()).toEqual({ above: true, below: false, opacity: '0' });
  await focus(page);
  await expect.poll(async () => (await rects()).opacity).toBe('1');
  expect(await rects()).toEqual({ above: true, below: false, opacity: '1' });
  await mount(page, 'value="25" tooltip="bottom"');
  await focus(page);
  await expect.poll(async () => (await rects()).opacity).toBe('1');
  expect(await rects()).toEqual({ above: false, below: true, opacity: '1' });
  await mount(page, 'tooltip="none"');
  await focus(page);
  expect(await page.evaluate(() => [document.querySelector('#r').output, document.querySelector('#r').shadowRoot.querySelectorAll('output').length])).toEqual([null, 0]);
  await mount(page, 'disabled');
  expect(await page.evaluate(() => [document.querySelector('#r').output, document.querySelector('#r').input.disabled])).toEqual([null, true]);
  // Switching tooltip or disabled at run time adds and removes the output.
  const toggled = await page.evaluate(async () => {
    const el = document.querySelector('#r');
    el.disabled = false;
    await el.updateComplete;
    const withTooltip = Boolean(el.output);
    el.tooltip = 'none';
    await el.updateComplete;
    const none = Boolean(el.output);
    el.tooltip = 'top';
    el.tooltipFormatter = value => `${value} dB`;
    el.value = 9;
    await el.updateComplete;
    const formatted = el.output.textContent.trim();
    el.tooltipFormatter = 'not a function';
    await el.updateComplete;
    return [withTooltip, none, formatted, el.output.textContent.trim()];
  });
  expect(toggled).toEqual([true, false, '9 dB', '9']);
});

test('tooltip position: centered over the thumb as Shoelace estimates it (within 2 px), mirrored in right-to-left', async ({ page }) => {
  await loadBundle(page, ENTRY);
  for (const [attrs, rtl] of [['', false], ['dir="rtl"', true]]) {
    for (const value of [0, 30, 100]) {
      await mount(page, `value="${value}" ${attrs}`);
      await focus(page);
      await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector('#r').output).opacity)).toBe('1');
      // Shoelace's estimate: the thumb's center is thumb/2 + (width - thumb) * fraction from the start edge.
      await expect.poll(() => page.evaluate(([value, rtl]) => {
        const el = document.querySelector('#r');
        const input = el.input.getBoundingClientRect();
        const tooltip = el.output.getBoundingClientRect();
        const thumb = 20;
        const offset = thumb / 2 + (input.width - thumb) * (value / 100);
        const expected = rtl ? input.right - offset : input.left + offset;
        return Math.abs(tooltip.left + tooltip.width / 2 - expected) <= 2;
      }, [value, rtl]), `value ${value}, rtl ${rtl}`).toBe(true);
    }
  }
});

test('right-to-left: the dir attribute or property sets the range--rtl class and the gradient direction, the arrows move by one step each way, and the document direction applies when the range has none', async ({ page }) => {
  await loadBundle(page, ENTRY);
  const read = () => page.evaluate(() => {
    const el = document.querySelector('#r');
    return [el.shadowRoot.querySelector('.range').classList.contains('range--rtl'), getComputedStyle(el.input).backgroundImage.includes('to left')];
  });
  await mount(page, 'value="50"');
  expect(await read()).toEqual([false, false]);
  await mount(page, 'dir="rtl" value="50"');
  expect(await read()).toEqual([true, true]);
  await focus(page);
  // The arrow keys are the native control's: each moves the value by one step and the two go opposite ways (which one
  // raises the value in right-to-left depends on the engine).
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => state(page).then(s => Math.abs(s.value - 50))).toBe(1);
  const afterLeft = (await state(page)).value;
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => state(page).then(s => s.value)).toBe(50);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => state(page).then(s => s.value)).toBe(100 - afterLeft);
  await mount(page, 'value="50"');
  await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
  await expect.poll(read).toEqual([true, true]);
  await page.evaluate(() => { document.documentElement.dir = 'ltr'; });
  await expect.poll(read).toEqual([false, false]);
  // A direction set by property only (no attribute) is Shoelace's source too; "RTL" is lower-cased.
  await page.evaluate(async () => {
    document.querySelector('#r').dir = 'RTL';
    await document.querySelector('#r').updateComplete;
  });
  expect((await read())[0]).toBe(true);
});

test('forms: name and value are submitted, disabled and nameless ranges are not, a form reset restores the value attribute, and the form attribute reaches a form elsewhere', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await page.evaluate(() => {
    document.body.innerHTML = `
      <form id="f">
        <sl-range id="a" name="a" value="20"></sl-range>
        <sl-range id="b" name="b" value="30" disabled></sl-range>
        <sl-range id="c" value="40"></sl-range>
        <button type="reset">Reset</button>
      </form>
      <sl-range id="d" name="d" value="70" form="f"></sl-range>`;
  });
  await page.evaluate(() => Promise.all([...document.querySelectorAll('sl-range')].map(el => el.updateComplete)));
  const read = () => page.evaluate(() => [...new FormData(document.querySelector('#f')).entries()]);
  expect(await read()).toEqual([['a', '20'], ['d', '70']]);
  await page.evaluate(async () => {
    const a = document.querySelector('#a');
    a.value = 90;
    document.querySelector('#d').value = 5;
    document.querySelector('#b').disabled = false;
    await a.updateComplete;
  });
  expect(await read()).toEqual([['a', '90'], ['b', '30'], ['d', '5']]);
  // The form's reset restores each range to the value its attribute had (the default value), without emitting sl-input or sl-change.
  await page.evaluate(() => { window.events = []; document.addEventListener('sl-change', e => window.events.push(e.type)); });
  await page.evaluate(async () => {
    const f = document.querySelector('#f');
    f.reset();
    await Promise.all([...document.querySelectorAll('sl-range')].map(el => el.updateComplete));
  });
  expect(await read()).toEqual([['a', '20'], ['b', '30'], ['d', '70']]);
  expect(await page.evaluate(() => window.events)).toEqual([]);
  expect(await page.evaluate(() => [document.querySelector('#a').getForm() === document.querySelector('#f'), document.querySelector('#d').getForm() === document.querySelector('#f'), document.querySelector('#a').defaultValue])).toEqual([true, true, 20]);
  // The form attribute is reflected, so the range outside the form carries it; the data-* validity attributes are set by the form controller.
  expect(await page.evaluate(() => [...document.querySelector('#a').getAttributeNames()].filter(n => n.startsWith('data-')).sort())).toEqual(['data-optional', 'data-valid']);
});

test('validation: setCustomValidity() makes the range invalid and checkValidity() and reportValidity() emit sl-invalid (not bubbling, not composed, cancelable); an empty message restores it; a disabled range passes checkValidity()', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'name="v"');
  const r = await page.evaluate(async () => {
    const el = document.querySelector('#r');
    const states = [[el.checkValidity(), el.validity.valid, el.validationMessage]];
    el.setCustomValidity('Nope');
    await el.updateComplete;
    states.push([el.validity.customError, el.validationMessage, el.hasAttribute('data-invalid'), el.hasAttribute('data-valid')]);
    const seen = [];
    el.addEventListener('sl-invalid', e => seen.push([e.bubbles, e.composed, e.cancelable]));
    states.push([el.checkValidity(), el.reportValidity()]);
    el.setCustomValidity('');
    await el.updateComplete;
    states.push([el.checkValidity(), el.validity.valid, el.hasAttribute('data-valid'), el.hasAttribute('data-invalid')]);
    el.setCustomValidity('Nope');
    el.disabled = true;
    await el.updateComplete;
    states.push([el.checkValidity(), seen.length]);
    return { states, seen };
  });
  expect(r.states).toEqual([
    [true, true, ''],
    [true, 'Nope', true, false],
    [false, false],
    [true, true, true, false],
    [true, 2],
  ]);
  expect(r.seen).toEqual([[false, false, true], [false, false, true]]);
  expect((await events(page)).filter(e => e[0] === 'sl-invalid').length).toBeGreaterThanOrEqual(2);
});

test('accessibility tree (Playwright ARIA snapshot): a slider named by its label, described by the help text, with its value; a disabled range is disabled', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'label="Volume" help-text="Controls the volume." value="40"');
  await expect(page.locator('#r')).toMatchAriaSnapshot(`
    - slider "Volume"
  `);
  expect(await page.evaluate(() => {
    const el = document.querySelector('#r');
    return [el.input.getAttribute('aria-describedby'), el.shadowRoot.querySelector('label').htmlFor, el.input.labels.length, el.input.value];
  })).toEqual(['help-text', 'input', 1, '40']);
  await mount(page, 'label="Volume" disabled');
  await expect(page.locator('#r')).toMatchAriaSnapshot(`
    - slider "Volume" [disabled]
  `);
});

test('dir and lang are reactive, not reflected and undefined by default, as Shoelace\'s base element declares them', async ({ page }) => {
  await loadBundle(page, ENTRY);
  const r = await page.evaluate(async () => {
    const el = document.createElement('sl-range');
    const defaults = [el.dir, el.lang];
    document.body.append(el);
    await el.updateComplete;
    el.dir = 'RTL';
    el.lang = 'ar';
    await el.updateComplete;
    return { defaults, afterSet: [el.dir, el.lang, el.hasAttribute('dir'), el.hasAttribute('lang')] };
  });
  expect(r).toEqual({ defaults: [undefined, undefined], afterSet: ['RTL', 'ar', false, false] });
});

test('core\'s ready event is kept (non-bubbling, once, on the first update) and Shoelace\'s events are not duplicated', async ({ page }) => {
  await loadBundle(page, ENTRY);
  const r = await page.evaluate(async () => {
    const el = document.createElement('sl-range');
    const seen = [];
    el.addEventListener('ready', e => seen.push(['ready', e.bubbles, e.composed]));
    document.body.append(el);
    await el.updateComplete;
    el.value = 4;
    el.label = 'Later';
    await el.updateComplete;
    return seen;
  });
  expect(r).toEqual([['ready', false, false]]);
});

test('upstream quirk: removing the value attribute sets value and defaultValue to null, and the next render throws; the other non-reflected attributes become null too', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'value="30" min="5" max="50" step="5" label="L" help-text="H" name="n" tooltip="bottom"');
  const r = await page.evaluate(async () => {
    const el = document.querySelector('#r');
    for (const a of ['min', 'max', 'step', 'label', 'help-text', 'name', 'tooltip']) el.removeAttribute(a);
    await el.updateComplete;
    const others = [el.min, el.max, el.step, el.label, el.helpText, el.name, el.tooltip];
    const inputAttrs = ['min', 'max', 'step'].map(a => el.input.hasAttribute(a));
    el.removeAttribute('value');
    const nulls = [el.value, el.defaultValue];
    let error = null;
    try {
      await el.updateComplete;
    } catch (e) {
      error = [e.name, /null/.test(e.message)];
    }
    // The failed render does not stop the range: a number value renders again.
    el.value = 7;
    await el.updateComplete;
    return { others, inputAttrs, nulls, error, recovered: [el.input.value, el.output.textContent.trim()] };
  });
  expect(r.others).toEqual([null, null, null, null, null, null, null]);
  expect(r.inputAttrs).toEqual([false, false, false]);
  expect(r.nulls).toEqual([null, null]);
  expect(r.error).toEqual(['TypeError', true]);
  expect(r.recovered).toEqual(['7', '7']);
});

test('upstream quirks: changing min does not re-clamp the value property (the control shows the clamped value, the form submits the property), and --percent carries floating-point noise', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await page.evaluate(async () => {
    document.body.innerHTML = '<form id="f"><sl-range id="r" name="r" value="10"></sl-range></form>';
    await document.querySelector('#r').updateComplete;
  });
  const r = await page.evaluate(async () => {
    const el = document.querySelector('#r');
    el.min = 20;
    await el.updateComplete;
    const clamped = [el.value, el.input.value, new FormData(document.querySelector('#f')).get('r'), el.output.textContent.trim()];
    el.value = 55;
    await el.updateComplete;
    return { clamped, percent: el.input.style.getPropertyValue('--percent'), after: [el.value, el.input.value] };
  });
  expect(r.clamped).toEqual([10, '20', '10', '10']);
  // (55 - 20) / (100 - 20) = 0.4375 here; the noisy value needs a zero minimum.
  expect(r.after).toEqual([55, '55']);
  expect(r.percent).toBe('43.75%');
  await page.evaluate(async () => {
    const el = document.querySelector('#r');
    el.min = 0;
    el.value = 56;
    await el.updateComplete;
    el.value = 55;
    await el.updateComplete;
  });
  expect(await page.evaluate(() => document.querySelector('#r').input.style.getPropertyValue('--percent'))).toBe('55.00000000000001%');
});

test('upstream quirk: methods that use the inner input throw before the first render, and a range disconnected before its first render throws from disconnectedCallback', async ({ page }) => {
  const pageErrors = await loadBundle(page, ENTRY);
  const r = await page.evaluate(async () => {
    const el = document.createElement('sl-range');
    const thrown = {};
    for (const name of ['focus', 'blur', 'stepUp', 'stepDown', 'checkValidity', 'reportValidity']) {
      try {
        el[name]();
        thrown[name] = null;
      } catch (e) {
        thrown[name] = e.name;
      }
    }
    for (const name of ['validity', 'validationMessage']) {
      try {
        void el[name];
        thrown[name] = null;
      } catch (e) {
        thrown[name] = e.name;
      }
    }
    // The error of a custom element reaction is reported to the window, not thrown to the caller.
    const reported = [];
    const listener = e => { reported.push(e.error?.name ?? e.message); e.preventDefault(); };
    window.addEventListener('error', listener);
    const early = document.createElement('sl-range');
    document.body.append(early);
    early.remove();
    window.removeEventListener('error', listener);
    return { thrown, reported };
  });
  expect(r.thrown).toEqual({ focus: 'TypeError', blur: 'TypeError', stepUp: 'TypeError', stepDown: 'TypeError', checkValidity: 'TypeError', reportValidity: 'TypeError', validity: 'TypeError', validationMessage: 'TypeError' });
  expect(r.reported.length).toBe(1);
  // The first-render promise of that element also rejects or resolves quietly; nothing else reaches the page.
  expect(pageErrors.filter(e => !/TypeError|not of type|not an object|null/.test(e))).toEqual([]);
});

test('class entry: SlRange is VelcroRange, nothing is registered on import, and the class works under another tag', async ({ page }) => {
  const pageErrors = await loadBundle(page, CLASS_ENTRY);
  const r = await page.evaluate(async () => {
    const { SlRange, VelcroRange } = window.rangeClass;
    const before = Boolean(customElements.get('sl-range'));
    customElements.define('my-range', VelcroRange);
    document.body.innerHTML = '<my-range label="Mine" value="3"></my-range>';
    const el = document.querySelector('my-range');
    await el.updateComplete;
    return { same: SlRange === VelcroRange, before, range: Boolean(customElements.get('sl-range')), value: el.input.value, label: el.shadowRoot.querySelector('label').textContent.trim() };
  });
  expect(r).toEqual({ same: true, before: false, range: false, value: '3', label: 'Mine' });
  expect(pageErrors).toEqual([]);
});

// Shoelace's React examples, ported in packages/docs/examples/range/react/*.jsx, bundled with React 19 and the generated wrapper.
test('React examples render the same ranges as the HTML examples', async ({ page }) => {
  const code = await bundleExamples('range', ORDER.map(([id]) => id));
  const pageErrors = await loadExamples(page, code);
  const r = await page.evaluate(async () => {
    const out = {};
    for (const name of ['basic', 'labels', 'help-text', 'min-max-step', 'disabled', 'tooltip-placement', 'disable-tooltip', 'custom-track-colors', 'custom-track-offset', 'custom-tooltip-formatter']) {
      window.renderExample(name);
      await customElements.whenDefined('sl-range');
      const el = document.querySelector(`#${name} sl-range`);
      await el.updateComplete;
      out[name] = [el.label, el.helpText, el.getAttribute('help-text'), el.min, el.max, el.step, el.disabled, el.tooltip, el.style.cssText, el.output ? el.output.textContent.trim() : null];
    }
    return out;
  });
  expect(r).toEqual({
    basic: ['', '', null, 0, 100, 1, false, 'top', '', '0'],
    labels: ['Volume', '', null, 0, 100, 1, false, 'top', '', '0'],
    'help-text': ['Volume', 'Controls the volume of the current song.', 'Controls the volume of the current song.', 0, 100, 1, false, 'top', '', '0'],
    'min-max-step': ['', '', null, 0, 10, 1, false, 'top', '', '0'],
    disabled: ['', '', null, 0, 100, 1, true, 'top', '', null],
    'tooltip-placement': ['', '', null, 0, 100, 1, false, 'bottom', '', '0'],
    'disable-tooltip': ['', '', null, 0, 100, 1, false, 'none', '', null],
    'custom-track-colors': ['', '', null, 0, 100, 1, false, 'top', '--track-color-active: var(--sl-color-primary-600); --track-color-inactive: var(--sl-color-primary-200);', '0'],
    'custom-track-offset': ['', '', null, -100, 100, 1, false, 'top', '--track-color-active: var(--sl-color-primary-600); --track-color-inactive: var(--sl-color-primary-200); --track-active-offset: 50%;', '0'],
    'custom-tooltip-formatter': ['', '', null, 0, 100, 1, false, 'top', '', 'Total - 0%'],
  });
  expect(pageErrors).toEqual([]);
});

test.describe('React wrapper', () => {
  const mountWrapper = reactWrapperPage(test);
  test('VelcroRange passes Shoelace\'s props through and calls onSlInput, onSlChange, onSlFocus and onSlBlur', async ({ page }) => {
    const errors = await mountWrapper(page);
    const r = await page.evaluate(async () => {
      window.seen = [];
      window.renderWrapper('VelcroRange', {
        label: 'Level', min: 0, max: 10, step: 2, value: 4, tooltip: 'bottom', name: 'level', tooltipFormatter: v => `L${v}`,
        onSlFocus: () => window.seen.push('focus'), onSlInput: e => window.seen.push(['input', e.target.value]),
        onSlChange: e => window.seen.push(['change', e.target.value]), onSlBlur: () => window.seen.push('blur'),
      });
      await customElements.whenDefined('sl-range');
      const el = document.querySelector('#wrapped');
      await el.updateComplete;
      el.focus();
      return [el.label, el.min, el.max, el.step, el.value, el.tooltip, el.name, el.output.textContent.trim()];
    });
    expect(r).toEqual(['Level', 0, 10, 2, 4, 'bottom', 'level', 'L4']);
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => page.evaluate(() => document.querySelector('#wrapped').value)).toBe(6);
    await page.evaluate(() => document.querySelector('#wrapped').blur());
    await expect.poll(() => page.evaluate(() => window.seen)).toEqual(['focus', ['input', 6], ['change', 6], 'blur']);
    expect(errors).toEqual([]);
  });
});
