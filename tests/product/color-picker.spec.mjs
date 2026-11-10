import { readdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { bundleExamples, docsDir, loadBundle, loadExamples } from './support/bundle.mjs';
import { pressReceived, recordKeys } from './support/keys.mjs';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';
import { reactWrapperPage } from './support/react.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/color-picker';
// Shoelace 2.20.1's color picker page has seven previews (the opening one, then Initial Value, Opacity, Formats, Swatches,
// Sizes and Inline), all ported in Shoelace's order, each live and with a React version.
const ORDER = [
  ['basic', 'Default'], ['initial-value', 'Initial Value'], ['opacity', 'Opacity'], ['formats', 'Formats'],
  ['swatches', 'Swatches'], ['sizes', 'Sizes'], ['inline', 'Inline'],
];
const title = section => `Color Picker example: ${section}`;

async function openExample(page) {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  const frame = page.frameLocator(`iframe.example[title="${title('Default')}"]`);
  await expect(frame.locator('sl-color-picker')).toBeVisible();
  await documentsLoaded(page);
  return { frame, requests };
}

// Waits for every color picker in a frame and returns per picker: [label, value, format, opacity, inline, size, swatches].
const frameState = frame => frame.locator('body').evaluate(async () => {
  await customElements.whenDefined('sl-color-picker');
  await Promise.all([...document.querySelectorAll('sl-color-picker')].map(el => el.updateComplete));
  return [...document.querySelectorAll('sl-color-picker')].map(el => [
    el.label, el.value, el.format, el.opacity, el.inline, el.size,
    el.shadowRoot.querySelectorAll('[part~="swatch"]').length,
  ]);
});

// The package entries, in a top-level document of the test's own.
const ENTRY = `
  import '@charm-ux/velcro/color-picker';
  window.loaded = true;
`;
const CLASS_ENTRY = `
  import { SlColorPicker, VelcroColorPicker } from '@charm-ux/velcro/color-picker/class';
  window.pickerClass = { SlColorPicker, VelcroColorPicker };
  window.loaded = true;
`;
const DE_ENTRY = `
  import '@charm-ux/velcro/color-picker';
  import '@charm-ux/velcro/translations/de';
  window.loaded = true;
`;

// Replaces the document with a color picker (id c) and waits for it and its inner input; returns nothing. The events
// below are recorded by one document listener, attached before the picker is connected.
async function mount(page, attrs = 'label="Select a color"', wrap = html => html) {
  await page.evaluate(async ([attrs, markup]) => {
    window.events = [];
    if (!window.listening) {
      window.listening = true;
      for (const type of ['sl-change', 'sl-input', 'sl-focus', 'sl-blur']) {
        document.addEventListener(type, e => window.events.push([type, e.target.value]));
      }
    }
    document.body.innerHTML = markup.replace('PICKER', `<sl-color-picker id="c" ${attrs}></sl-color-picker>`);
    const el = document.querySelector('#c');
    // sl-invalid does not bubble (as in Shoelace), so it is recorded on the element.
    el.addEventListener('sl-invalid', e => window.events.push(['sl-invalid:own', e.target.value]));
    await el.updateComplete;
    await el.shadowRoot.querySelector('sl-input').updateComplete;
  }, [attrs, wrap('PICKER')]);
}
const events = page => page.evaluate(() => window.events.splice(0));
const picker = (page, fn, arg) => page.evaluate(([source, arg]) => {
  const el = document.querySelector('#c');
  // eslint-disable-next-line no-new-func
  return new Function('el', 'root', 'arg', `return (${source})(el, root, arg);`)(el, el.shadowRoot, arg);
}, [fn.toString(), arg]);
const settle = page => page.evaluate(async () => {
  const el = document.querySelector('#c');
  await el.updateComplete;
  await el.shadowRoot.querySelector('sl-input').updateComplete;
});
// The color input's text and whether all of it is selected (the native input is in the sl-input's shadow root).
const inputText = page => picker(page, (el, root) => root.querySelector('[part="input"]').value);
const allSelected = page => picker(page, (el, root) => {
  const native = root.querySelector('[part="input"]').shadowRoot.querySelector('input');
  return native.value.length > 0 && native.selectionStart === 0 && native.selectionEnd === native.value.length;
});
const token = (page, name) => page.evaluate(name => {
  const probe = document.createElement('span');
  probe.style.color = `var(${name})`;
  document.body.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}, name);

test('docs page is prerendered with Velcro branding, prototype status, every ported section in order, the quirks and the gaps', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Color Picker - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('without changing the shared core prefix');
  expect(html).toContain('was run locally in Chromium and WebKit only, and Firefox is covered only by the project&#39;s CI run');
  expect(html).toContain('the adapter is an interim implementation of the same rules');
  expect(html).toContain('Enter on a swatch applies its color without emitting sl-change or sl-input');
  expect(html).toContain('cycling through all four formats can drift');
  const positions = ORDER.map(([, section]) => html.indexOf(`title="${title(section)}"`));
  expect(positions.every(p => p > 0)).toBe(true);
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  // The API tables: Shoelace's attributes, methods, events, slot, parts and custom properties; ready is labelled as inherited.
  for (const name of ['value', 'label', 'format', 'inline', 'size', 'name', 'disabled', 'hoist', 'opacity',
    'uppercase', 'noFormatToggle', 'defaultValue', 'swatches', 'form', 'required', 'focus', 'blur', 'getFormattedValue', 'checkValidity', 'getForm',
    'reportValidity', 'setCustomValidity', 'sl-blur', 'sl-change', 'sl-focus', 'sl-input', 'sl-invalid', 'base', 'trigger',
    'swatches', 'grid-handle', 'hue-slider', 'opacity-slider-handle', 'format-button__caret', 'eye-dropper-button__base',
    '--grid-width', '--grid-height', '--grid-handle-size', '--slider-height', '--slider-handle-size', '--swatch-size']) {
    expect(html, name).toContain(`data-name="${name}"`);
  }
  expect(html).toContain('Inherited from core');
  expect(html).toContain('<summary>React</summary>');
  expect(html).toContain('import { VelcroColorPicker as SlColorPicker } from &#39;@charm-ux/velcro/react/VelcroColorPicker.js&#39;;');
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(await (await request.get('/')).text()).toContain('/components/color-picker');
});

test('examples: Shoelace\'s order, live in their own documents, with a React version each; no Shoelace runtime is requested', async ({ page }) => {
  const { requests } = await openExample(page);
  const titles = await page.locator('iframe.example').evaluateAll(frames => frames.map(f => f.title));
  expect(titles).toEqual(ORDER.map(([, section]) => title(section)));
  const out = {};
  for (const [id, section] of ORDER) out[id] = await frameState(page.frameLocator(`iframe.example[title="${title(section)}"]`));
  const L = 'Select a color';
  expect(out).toEqual({
    basic: [[L, '', 'hex', false, false, 'medium', 0]],
    'initial-value': [[L, '#4a90e2', 'hex', false, false, 'medium', 0]],
    opacity: [[L, '#f5a623ff', 'hex', true, false, 'medium', 0]],
    // Each value is rewritten in its format from the parsed color.
    formats: [[L, '#4a90e2', 'hex', false, false, 'medium', 0], [L, 'rgb(80, 227, 194)', 'rgb', false, false, 'medium', 0],
      [L, 'hsl(290, 87%, 47%)', 'hsl', false, false, 'medium', 0], [L, 'hsv(55, 89%, 97%)', 'hsv', false, false, 'medium', 0]],
    swatches: [[L, '', 'hex', false, false, 'medium', 16]],
    sizes: [[L, '', 'hex', false, false, 'small', 0], [L, '', 'hex', false, false, 'medium', 0], [L, '', 'hex', false, false, 'large', 0]],
    inline: [[L, '', 'hex', false, true, 'medium', 0]],
  });
  const files = dir => readdirSync(path.join(docsDir, 'examples/color-picker', dir)).filter(f => /\.(html|jsx)$/.test(f)).sort();
  expect(files('')).toEqual(ORDER.map(([id]) => `${id}.html`).sort());
  expect(files('react')).toEqual(ORDER.map(([id]) => `${id}.jsx`).sort());
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
});

test('Sizes and Inline examples: the trigger sizes follow the input heights; the inline picker shows the grid without a dropdown', async ({ page }) => {
  await openExample(page);
  const sizes = await page.frameLocator(`iframe.example[title="${title('Sizes')}"]`).locator('body').evaluate(async () => {
    await customElements.whenDefined('sl-color-picker');
    const pickers = [...document.querySelectorAll('sl-color-picker')];
    await Promise.all(pickers.map(el => el.updateComplete));
    const height = name => {
      const probe = document.createElement('div');
      probe.style.height = `var(${name})`;
      document.body.append(probe);
      const h = getComputedStyle(probe).height;
      probe.remove();
      return h;
    };
    return {
      triggers: pickers.map(el => [getComputedStyle(el.shadowRoot.querySelector('[part="trigger"]')).width, getComputedStyle(el.shadowRoot.querySelector('[part="trigger"]')).height]),
      tokens: ['--sl-input-height-small', '--sl-input-height-medium', '--sl-input-height-large'].map(height),
    };
  });
  expect(sizes.triggers).toEqual(sizes.tokens.map(h => [h, h]));
  const inline = await page.frameLocator(`iframe.example[title="${title('Inline')}"]`).locator('sl-color-picker').evaluate(el => ({
    dropdown: Boolean(el.shadowRoot.querySelector('sl-dropdown')),
    trigger: Boolean(el.shadowRoot.querySelector('[part="trigger"]')),
    grid: getComputedStyle(el.shadowRoot.querySelector('[part="grid"]')).height,
    width: getComputedStyle(el.shadowRoot.querySelector('[part="base"]')).width,
    tabindex: el.shadowRoot.querySelector('[part="base"]').getAttribute('tabindex'),
  }));
  expect(inline).toEqual({ dropdown: false, trigger: false, grid: '200px', width: '280px', tabindex: '0' });
});

test('package entry: Shoelace\'s structure, accessibility attributes, localized labels and styles', async ({ page }) => {
  const pageErrors = await loadBundle(page, ENTRY);
  await mount(page, 'label="Select a color" value="#4a90e2" swatches="red; #00ff00; not-a-color"');
  const r = await picker(page, (el, root) => {
    const base = root.querySelector('[part="base"]');
    const trigger = root.querySelector('[part="trigger"]');
    const hue = root.querySelector('[part~="hue-slider-handle"]');
    const input = root.querySelector('[part="input"]');
    return {
      shadow: [...root.children].map(c => [c.localName, c.getAttribute('class')]),
      dropdown: [...root.querySelector('sl-dropdown').children].map(c => [c.localName, c.getAttribute('part'), c.getAttribute('slot')]),
      trigger: [trigger.localName, trigger.getAttribute('type'), trigger.style.color, trigger.textContent.trim(), trigger.querySelector('sl-visually-hidden') !== null],
      base: ['aria-disabled', 'aria-labelledby', 'tabindex'].map(a => base.getAttribute(a)),
      grid: [root.querySelector('[part="grid-handle"]').getAttribute('role'), root.querySelector('[part="grid-handle"]').getAttribute('aria-label'), root.querySelector('[part="grid-handle"]').getAttribute('tabindex')],
      hue: ['role', 'aria-label', 'aria-orientation', 'aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'tabindex'].map(a => hue.getAttribute(a)),
      opacity: root.querySelector('[part~="opacity-slider"]') === null,
      preview: [root.querySelector('[part="preview"]').getAttribute('aria-label'), root.querySelector('[part="preview"]').getAttribute('type')],
      input: [input.localName, input.value, input.getAttribute('aria-label'), input.getAttribute('autocomplete'), input.type],
      format: [root.querySelector('[part="format-button"]').getAttribute('aria-label'), root.querySelector('[part="format-button"]').textContent.trim()],
      swatches: [...root.querySelectorAll('[part="swatch"]')].map(s => [s.getAttribute('aria-label'), s.getAttribute('role'), s.getAttribute('tabindex'), s.firstElementChild.style.backgroundColor]),
      queries: [el.base === base, el.trigger === trigger, el.input === input, el.dropdown === root.querySelector('sl-dropdown'), el.previewButton === root.querySelector('[part="preview"]')],
      host: [getComputedStyle(el).display, ...['--grid-width', '--grid-height', '--grid-handle-size', '--slider-height', '--slider-handle-size', '--swatch-size'].map(p => getComputedStyle(el).getPropertyValue(p).trim())],
      reflected: [...el.attributes].map(a => a.name).sort(),
      properties: [el.value, el.defaultValue, el.format, el.size, el.inline, el.opacity, el.uppercase, el.noFormatToggle, el.disabled, el.required, el.hoist, el.name, el.form],
      panelWidth: getComputedStyle(base).width,
    };
  });
  expect(r).toEqual({
    shadow: [['sl-dropdown', 'color-dropdown']],
    dropdown: [['button', 'trigger', 'trigger'], ['div', 'base', null]],
    trigger: ['button', 'button', 'rgb(74, 144, 226)', 'Select a color', true],
    base: ['false', 'label', '-1'],
    grid: ['application', 'HSV', '0'],
    hue: ['slider', 'hue', 'horizontal', '0', '360', '212', '0'],
    opacity: true,
    preview: ['Copy', 'button'],
    input: ['sl-input', '#4a90e2', 'Current value', 'off', 'text'],
    format: ['Toggle color format', 'hex'],
    // Shoelace skips (and logs) a swatch it cannot parse.
    // The aria-label is the swatch as written, with the spaces around it.
    swatches: [['red', 'button', '0', 'rgb(255, 0, 0)'], [' #00ff00', 'button', '0', 'rgb(0, 255, 0)']],
    queries: [true, true, true, true, true],
    host: ['inline-block', '280px', '200px', '16px', '15px', '17px', '25px'],
    // `form` and `size` are reflected with their defaults; the form controller adds the data-* validity attributes.
    reflected: ['data-optional', 'data-valid', 'form', 'id', 'label', 'size', 'swatches', 'value'],
    properties: ['#4a90e2', '#4a90e2', 'hex', 'medium', false, false, false, false, false, false, false, '', ''],
    panelWidth: '280px',
  });
  expect(pageErrors).toEqual([]);
});

test('lang selects the translated labels of the copy button, the input and the format toggle', async ({ page }) => {
  await loadBundle(page, DE_ENTRY);
  await mount(page, 'lang="de"');
  expect(await picker(page, (el, root) => [
    root.querySelector('[part="preview"]').getAttribute('aria-label'),
    root.querySelector('[part="input"]').getAttribute('aria-label'),
    root.querySelector('[part="format-button"]').getAttribute('aria-label'),
  ])).toEqual(['Kopieren', 'Aktueller Wert', 'Farbformat umschalten']);
});

test('the trigger opens the panel; the panel and trigger use the theme\'s panel, border and focus tokens', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'label="Select a color" value="#ff0000"');
  await page.evaluate(() => document.querySelector('#c').shadowRoot.querySelector('[part="trigger"]').click());
  await expect.poll(() => picker(page, (el, root) => root.querySelector('sl-dropdown').open)).toBe(true);
  const r = await picker(page, (el, root) => {
    const panel = root.querySelector('sl-dropdown').shadowRoot.querySelector('[part~="panel"]');
    const panelStyle = getComputedStyle(panel);
    return {
      visible: root.querySelector('[part="base"]').getBoundingClientRect().height > 0,
      panel: [panelStyle.backgroundColor, panelStyle.borderTopStyle, panelStyle.overflow],
      grid: getComputedStyle(root.querySelector('[part="grid"]')).backgroundColor,
    };
  });
  expect(r).toEqual({ visible: true, panel: [await token(page, '--sl-panel-background-color'), 'solid', 'visible'], grid: 'rgb(255, 0, 0)' });
});

test('keyboard: the grid handle and the sliders step by 1 (10 with Shift), Home and End reach the slider ends; each change emits sl-change and sl-input', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'label="Select a color" inline opacity value="hsv(180, 50%, 50%)" format="hsv"');
  await events(page);
  await recordKeys(page);
  const value = () => picker(page, el => el.value);
  // Focuses the part, presses the key and awaits the value it leaves. A key that leaves the value as it is has nothing to
  // await but its own press.
  const press = async (part, key, expected) => {
    const before = await value();
    await picker(page, (el, root, part) => root.querySelector(`[part~="${part}"]`).focus(), part);
    if (expected === before) {
      await pressReceived(page, page, key);
      expect(await value()).toBe(expected);
    } else {
      await page.keyboard.press(key);
      await expect.poll(value, `${key} on the ${part}`).toBe(expected);
    }
  };
  await press('grid-handle', 'ArrowRight', 'hsva(180, 51%, 50%, 1.00)');
  await press('grid-handle', 'Shift+ArrowUp', 'hsva(180, 51%, 60%, 1.00)');
  await press('grid-handle', 'Home', 'hsva(180, 51%, 60%, 1.00)');
  await press('grid-handle', 'End', 'hsva(180, 51%, 60%, 1.00)');
  await press('hue-slider-handle', 'Shift+ArrowLeft', 'hsva(170, 51%, 60%, 1.00)');
  await press('hue-slider-handle', 'ArrowLeft', 'hsva(169, 51%, 60%, 1.00)');
  await press('hue-slider-handle', 'Home', 'hsva(0, 51%, 60%, 1.00)');
  await press('opacity-slider-handle', 'Shift+ArrowLeft', 'hsva(0, 51%, 60%, 0.90)');
  await press('opacity-slider-handle', 'Home', 'hsva(0, 51%, 60%, 0.00)');
  await press('opacity-slider-handle', 'End', 'hsva(0, 51%, 60%, 1.00)');
  const changes = (await events(page)).filter(e => e[0] === 'sl-change' || e[0] === 'sl-input');
  // One sl-change and one sl-input per key that changed the value (Home and End on the grid change nothing).
  expect(changes.filter(e => e[0] === 'sl-change').length).toBe(8);
  expect(changes.filter(e => e[0] === 'sl-input').length).toBe(8);
  expect(await picker(page, (el, root) => root.querySelector('[part~="hue-slider-handle"]').getAttribute('aria-valuenow'))).toBe('0');
});

test('pointer: dragging the grid emits sl-input while moving and one sl-change at the end; a hue click moves the hue', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'label="Select a color" inline value="#ff0000"');
  await events(page);
  const box = await picker(page, (el, root) => {
    const r = root.querySelector('[part="grid"]').getBoundingClientRect();
    return [r.left, r.top, r.width, r.height];
  });
  const [x, y, w, h] = box;
  await page.mouse.move(x + w * 0.5, y + h * 0.5);
  await page.mouse.down();
  await page.mouse.move(x + w * 0.25, y + h * 0.25, { steps: 3 });
  await page.mouse.move(x, y + h, { steps: 2 });
  await page.mouse.up();
  await settle(page);
  const seen = await events(page);
  expect(seen.filter(e => e[0] === 'sl-change')).toEqual([['sl-change', '#000000']]);
  expect(seen.filter(e => e[0] === 'sl-input').length).toBeGreaterThan(1);
  expect(await picker(page, (el, root) => root.querySelector('[part="grid-handle"]').classList.contains('color-picker__grid-handle--dragging'))).toBe(false);
  // A press half way across the grid and a quarter of the way down (saturation 50%, brightness 75%), then the middle of the
  // hue slider (180 degrees). The press is well inside the grid on purpose: the grid's top corners are rounded (4px) and
  // Firefox hit-tests a press against the rounded shape, so a press 1px from a corner lands outside it, reaches the
  // picker's base instead of the grid and changes nothing (Chromium and WebKit hit-test the whole box).
  const press = [x + w / 2, y + h / 4];
  expect(await picker(page, (el, root, [px, py]) => root.elementFromPoint(px, py).getAttribute('part'), press)).toBe('grid');
  await page.mouse.click(...press);
  const hue = await picker(page, (el, root) => {
    const r = root.querySelector('[part~="hue-slider"]').getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  });
  await page.mouse.click(...hue);
  await settle(page);
  expect(await picker(page, (el, root) => root.querySelector('[part~="hue-slider-handle"]').getAttribute('aria-valuenow'))).toBe('180');
  expect(await picker(page, el => el.getFormattedValue('hsv'))).toBe('hsv(180, 50%, 75%)');
  expect(await picker(page, el => el.getFormattedValue('hsl'))).toBe('hsl(180, 43%, 56%)');
});

test('the input: a parsable color (any format, a wrapping hue or a CSS name) is applied in the picker\'s format on Enter; an unparsable one is reverted', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'label="Select a color" inline format="rgb" uppercase value="#000"');
  await events(page);
  await recordKeys(page);
  // Replaces the input's text with `text`, commits it with Enter and awaits the value and the input showing `expected`, and
  // the selection of that text that Enter leaves.
  const type = async (text, expected) => {
    await picker(page, (el, root) => root.querySelector('[part="input"]').focus());
    await pressReceived(page, page, 'ControlOrMeta+a');
    await expect.poll(() => allSelected(page), 'the text is selected').toBe(true);
    await page.keyboard.type(text);
    await expect.poll(() => inputText(page), 'the text is typed').toBe(text);
    await page.keyboard.press('Enter');
    await expect.poll(() => picker(page, (el, root) => [el.value, root.querySelector('[part="input"]').value]), `${text} is applied`).toEqual([expected, expected]);
    // Enter also selects the input's text, from a timer: wait for it, or it can land in the middle of the next typing.
    await expect.poll(() => allSelected(page), 'the applied text is selected').toBe(true);
  };
  await type('rebeccapurple', 'RGB(102, 51, 153)');
  await type('hsl(120, 100%, 25%)', 'RGB(0, 128, 0)');
  // A hue outside 0 to 360 wraps around, as TinyColor reads it.
  await type('hsl(400, 100%, 50%)', 'RGB(255, 170, 0)');
  await type('hsl(-30, 100%, 50%)', 'RGB(255, 0, 128)');
  await type('#abc', 'RGB(170, 187, 204)');
  const changes = (await events(page)).filter(e => e[0] === 'sl-change');
  expect(changes).toEqual([['sl-change', 'RGB(102, 51, 153)'], ['sl-change', 'RGB(0, 128, 0)'], ['sl-change', 'RGB(255, 170, 0)'],
    ['sl-change', 'RGB(255, 0, 128)'], ['sl-change', 'RGB(170, 187, 204)']]);
  // An unparsable entry: the commit (on blur) leaves the value and puts it back in the input.
  await picker(page, (el, root) => root.querySelector('[part="input"]').focus());
  await pressReceived(page, page, 'ControlOrMeta+a');
  await expect.poll(() => allSelected(page), 'the text is selected').toBe(true);
  await page.keyboard.type('nope');
  await expect.poll(() => inputText(page), 'the text is typed').toBe('nope');
  await picker(page, (el, root) => root.querySelector('[part="preview"]').focus());
  await settle(page);
  expect(await picker(page, (el, root) => [el.value, root.querySelector('[part="input"]').value])).toEqual(['RGB(170, 187, 204)', 'RGB(170, 187, 204)']);
});

test('the format toggle cycles hex, rgb, hsl and hsv and emits sl-change and sl-input; a full cycle drifts (upstream quirk); no-format-toggle removes it; getFormattedValue', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'label="Select a color" inline value="#4a90e2"');
  await events(page);
  expect(await picker(page, el => ['hex', 'hexa', 'rgb', 'rgba', 'hsl', 'hsla', 'hsv', 'hsva'].map(f => el.getFormattedValue(f)))).toEqual([
    '#4a90e2', '#4a90e2ff', 'rgb(74, 144, 226)', 'rgba(74, 144, 226, 1.00)', 'hsl(212, 72%, 59%)', 'hsla(212, 72%, 59%, 1.00)', 'hsv(212, 67%, 89%)', 'hsva(212, 67%, 89%, 1.00)',
  ]);
  const values = [];
  for (let i = 0; i < 4; i++) {
    await picker(page, (el, root) => root.querySelector('[part="format-button"]').click());
    await settle(page);
    values.push(await picker(page, (el, root) => [el.format, el.value, root.querySelector('[part="format-button"]').textContent.trim()]));
  }
  expect(values).toEqual([
    ['rgb', 'rgb(74, 144, 226)', 'rgb'], ['hsl', 'hsl(212, 72%, 59%)', 'hsl'], ['hsv', 'hsv(212, 67%, 89%)', 'hsv'], ['hex', '#4b92e3', 'hex'],
  ]);
  expect((await events(page)).filter(e => e[0] !== 'sl-focus' && e[0] !== 'sl-blur').map(e => e[0])).toEqual(Array(4).fill(['sl-change', 'sl-input']).flat());
  await mount(page, 'label="Select a color" inline no-format-toggle');
  expect(await picker(page, (el, root) => root.querySelector('[part="format-button"]'))).toBe(null);
});

test('a swatch click sets the color and emits sl-change and sl-input; Enter on a swatch sets it without events (upstream quirk); a disabled picker ignores both', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'label="Select a color" inline swatches="#d0021b; rgb(0, 0, 255)"');
  await events(page);
  await picker(page, (el, root) => root.querySelectorAll('[part="swatch"]')[0].click());
  await settle(page);
  expect(await picker(page, el => el.value)).toBe('#d0021b');
  expect((await events(page)).filter(e => e[0] === 'sl-change' || e[0] === 'sl-input')).toEqual([['sl-change', '#d0021b'], ['sl-input', '#d0021b']]);
  await picker(page, (el, root) => root.querySelectorAll('[part="swatch"]')[1].focus());
  await recordKeys(page);
  await pressReceived(page, page, 'Enter');
  await settle(page);
  expect(await picker(page, el => el.value)).toBe('#0000ff');
  expect((await events(page)).filter(e => e[0] === 'sl-change' || e[0] === 'sl-input')).toEqual([]);
  await mount(page, 'label="Select a color" inline disabled value="#ffffff" swatches="#d0021b"');
  await events(page);
  const disabled = await picker(page, (el, root) => {
    const swatch = root.querySelector('[part="swatch"]');
    swatch.click();
    swatch.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    return [el.value, swatch.getAttribute('tabindex'), root.querySelector('[part="grid-handle"]').getAttribute('tabindex'),
      root.querySelector('[part="base"]').getAttribute('aria-disabled'), getComputedStyle(root.querySelector('[part="base"]')).opacity];
  });
  expect(disabled).toEqual(['#ffffff', null, null, 'true', '0.5']);
  expect(await events(page)).toEqual([]);
});

test('sl-focus and sl-blur: once when the focus enters and leaves the picker, not when it moves between its own controls', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'label="Select a color" inline');
  await picker(page, (el, root) => root.querySelector('[part="grid-handle"]').focus());
  await picker(page, (el, root) => root.querySelector('[part~="hue-slider-handle"]').focus());
  await picker(page, (el, root) => root.querySelector('[part="input"]').focus());
  await picker(page, (el, root) => root.querySelector('[part="preview"]').focus());
  await picker(page, el => el.blur());
  expect((await events(page)).map(e => e[0])).toEqual(['sl-focus', 'sl-blur']);
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  // focus() focuses the trigger in the dropdown and the base when inline.
  await mount(page, 'label="Select a color"');
  expect(await picker(page, (el, root) => { el.focus(); return root.activeElement === root.querySelector('[part="trigger"]'); })).toBe(true);
  await mount(page, 'label="Select a color" inline');
  expect(await picker(page, (el, root) => { el.focus(); return root.activeElement === root.querySelector('[part="base"]'); })).toBe(true);
});

test('upstream quirk: without opacity, a value with alpha is rewritten without it but still drawn transparent', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'label="Select a color" value="#ff000080"');
  expect(await picker(page, (el, root) => [el.value, root.querySelector('[part="trigger"]').style.color, root.querySelector('[part="preview"]').style.getPropertyValue('--preview-color')]))
    .toEqual(['#ff0000', 'rgba(255, 0, 0, 0.5)', '#ff000080']);
});

test('upstream quirk: an unparsable value is kept as the value while the input shows the previous color', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'label="Select a color" inline value="#00ff00"');
  await picker(page, el => { el.value = 'not a color'; });
  await settle(page);
  expect(await picker(page, (el, root) => [el.value, root.querySelector('[part="input"]').value])).toEqual(['not a color', '#00ff00']);
  expect(await events(page)).toEqual([]);
});

test('emptying the input and committing it clears the value, empties the trigger and emits sl-change and sl-input', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'label="Select a color" inline value="#0000ff"');
  await events(page);
  await recordKeys(page);
  await picker(page, (el, root) => root.querySelector('[part="input"]').focus());
  await pressReceived(page, page, 'ControlOrMeta+a');
  await expect.poll(() => allSelected(page), 'the text is selected').toBe(true);
  await page.keyboard.press('Backspace');
  await expect.poll(() => inputText(page), 'the text is deleted').toBe('');
  await picker(page, (el, root) => root.querySelector('[part="preview"]').focus());
  await settle(page);
  expect(await picker(page, (el, root) => [el.value, root.querySelector('[part="grid"]').style.backgroundColor])).toEqual(['', 'rgb(255, 0, 0)']);
  expect((await events(page)).filter(e => e[0] === 'sl-change' || e[0] === 'sl-input')).toEqual([['sl-change', ''], ['sl-input', '']]);
  await mount(page, 'label="Select a color" value="#0000ff"');
  await picker(page, el => { el.value = ''; });
  await settle(page);
  expect(await picker(page, (el, root) => root.querySelector('[part="trigger"]').classList.contains('color-dropdown__trigger--empty'))).toBe(true);
});

test('upstream quirk: changing inline after the first render throws from that update, and the picker still renders the new layout', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'label="Select a color" value="#0000ff"');
  const r = await picker(page, async (el, root) => {
    let error = null;
    el.inline = true;
    try {
      await el.updateComplete;
    } catch (e) {
      error = e.constructor.name;
    }
    await root.querySelector('sl-input').updateComplete;
    el.value = '#00ff00';
    await el.updateComplete;
    return [error, Boolean(root.querySelector('sl-dropdown')), root.querySelector('[part="input"]').value, el.checkValidity()];
  });
  expect(r).toEqual(['TypeError', false, '#00ff00', true]);
});

test('upstream quirk: in the dropdown, the panel\'s aria-labelledby names no element; inline, it names the visually hidden label', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'label="Select a color"');
  expect(await picker(page, (el, root) => [root.querySelector('[part="base"]').getAttribute('aria-labelledby'), root.getElementById('label')])).toEqual(['label', null]);
  await mount(page, 'inline');
  await picker(page, async el => {
    el.innerHTML = '<span slot="label">Brand color</span>';
    await el.updateComplete;
  });
  expect(await picker(page, (el, root) => {
    const label = root.getElementById('label');
    return [label.localName, label.querySelector('slot').assignedNodes()[0].textContent];
  })).toEqual(['sl-visually-hidden', 'Brand color']);
  await expect(page.locator('#c').getByRole('application')).toHaveAccessibleName('HSV');
});

test('form: the value is submitted under its name, reset restores the value attribute, required blocks an empty submit', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'name="color" value="#112233"', html => `<form id="f">${html}<button>Submit</button></form>`);
  const r = await page.evaluate(async () => {
    const form = document.querySelector('#f');
    const el = document.querySelector('#c');
    const data = () => Object.fromEntries(new FormData(form));
    const out = [data()];
    el.value = '#445566';
    await el.updateComplete;
    out.push(data());
    form.reset();
    await el.updateComplete;
    out.push(el.value, data());
    el.disabled = true;
    await el.updateComplete;
    out.push(data());
    return out;
  });
  expect(r).toEqual([{ color: '#112233' }, { color: '#445566' }, '#112233', { color: '#112233' }, {}]);
  await mount(page, 'name="color" required', html => `<form id="f">${html}</form>`);
  await events(page);
  const required = await page.evaluate(async () => {
    const el = document.querySelector('#c');
    const out = [el.checkValidity(), el.validity.valueMissing, el.hasAttribute('data-invalid'), el.getForm() === document.querySelector('#f')];
    out.push(document.querySelector('#f').checkValidity());
    el.value = '#abcdef';
    await el.updateComplete;
    await el.shadowRoot.querySelector('sl-input').updateComplete;
    out.push(el.checkValidity());
    el.setCustomValidity('Pick another');
    out.push(el.checkValidity(), el.validationMessage);
    return out;
  });
  expect(required).toEqual([false, true, true, true, false, true, false, 'Pick another']);
  // The form's and the picker's own checkValidity() each emit one sl-invalid while the picker is empty; the custom error another.
  expect((await events(page)).filter(e => e[0] === 'sl-invalid:own').length).toBe(3);
});

test('reportValidity on an invalid dropdown picker opens the dropdown and emits sl-invalid', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'required');
  await events(page);
  const result = await picker(page, el => el.reportValidity());
  expect(result).toBe(false);
  await expect.poll(() => picker(page, (el, root) => root.querySelector('sl-dropdown').open)).toBe(true);
  expect((await events(page)).filter(e => e[0] === 'sl-invalid:own').length).toBe(1);
});

test('reflected properties set to null or undefined get the values they had before their attributes were applied; the value attribute tracks defaultValue', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'size="large" value="#123456"');
  const r = await picker(page, async el => {
    el.size = null;
    el.disabled = undefined;
    el.setAttribute('value', '#654321');
    await el.updateComplete;
    return [el.size, el.disabled, el.getAttribute('size'), el.defaultValue, el.value];
  });
  // Recorded on the first attribute change, before the attribute values are applied: the defaults, as in Shoelace.
  expect(r).toEqual(['medium', false, 'medium', '#654321', '#654321']);
});

test('class-only entry: defines no tag of its own; constructing the class defines its dependencies', async ({ page }) => {
  const pageErrors = await loadBundle(page, CLASS_ENTRY);
  const r = await page.evaluate(async () => {
    const { SlColorPicker, VelcroColorPicker } = window.pickerClass;
    const tags = ['sl-color-picker', 'sl-button-group', 'sl-button', 'sl-dropdown', 'sl-popup', 'sl-icon', 'sl-input', 'sl-visually-hidden'];
    const before = tags.map(t => Boolean(customElements.get(t)));
    customElements.define('my-color-picker', VelcroColorPicker);
    document.body.innerHTML = '<my-color-picker></my-color-picker>';
    await document.querySelector('my-color-picker').updateComplete;
    return { same: SlColorPicker === VelcroColorPicker, before, after: tags.map(t => Boolean(customElements.get(t))) };
  });
  expect(r).toEqual({ same: true, before: Array(8).fill(false), after: [false, true, true, true, true, true, true, true] });
  expect(pageErrors).toEqual([]);
});

// Shoelace's React examples, ported in packages/docs/examples/color-picker/react/*.jsx, bundled with React 19 and the generated wrapper.
test('React examples render the same color pickers as the HTML examples', async ({ page }) => {
  const code = await bundleExamples('color-picker', ORDER.map(([id]) => id));
  const pageErrors = await loadExamples(page, code);
  const r = await page.evaluate(async names => {
    const out = {};
    for (const name of names) {
      window.renderExample(name);
      await customElements.whenDefined('sl-color-picker');
      const pickers = [...document.querySelectorAll(`#${name} sl-color-picker`)];
      await Promise.all(pickers.map(el => el.updateComplete));
      out[name] = pickers.map(el => [el.label, el.value, el.format, el.opacity, el.inline, el.size, el.shadowRoot.querySelectorAll('[part~="swatch"]').length]);
    }
    return { out, errors: window.errors.splice(0) };
  }, ORDER.map(([id]) => id));
  const L = 'Select a color';
  expect(r.out).toEqual({
    basic: [[L, '', 'hex', false, false, 'medium', 0]],
    'initial-value': [[L, '#4a90e2', 'hex', false, false, 'medium', 0]],
    // As in Shoelace's React version: no initial value with opacity, and no labels on the formats.
    opacity: [[L, '', 'hex', true, false, 'medium', 0]],
    formats: [['', '#4a90e2', 'hex', false, false, 'medium', 0], ['', 'rgb(80, 227, 194)', 'rgb', false, false, 'medium', 0],
      ['', 'hsl(290, 87%, 47%)', 'hsl', false, false, 'medium', 0], ['', 'hsv(55, 89%, 97%)', 'hsv', false, false, 'medium', 0]],
    swatches: [[L, '', 'hex', false, false, 'medium', 16]],
    sizes: [[L, '', 'hex', false, false, 'small', 0], [L, '', 'hex', false, false, 'medium', 0], [L, '', 'hex', false, false, 'large', 0]],
    inline: [[L, '', 'hex', false, true, 'medium', 0]],
  });
  expect(r.errors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test.describe('React wrapper', () => {
  const mountWrapper = reactWrapperPage(test);
  test('VelcroColorPicker passes Shoelace\'s props through and calls onSlChange and onSlInput', async ({ page }) => {
    const errors = await mountWrapper(page);
    const r = await page.evaluate(async () => {
      window.seen = [];
      window.renderWrapper('VelcroColorPicker', { label: 'Brand', value: '#336699', format: 'rgb', inline: true, swatches: ['#ff0000'], onSlChange: e => window.seen.push(['change', e.target.value]), onSlInput: e => window.seen.push(['input', e.target.value]) });
      await customElements.whenDefined('sl-color-picker');
      const el = document.querySelector('#wrapped');
      await el.updateComplete;
      el.shadowRoot.querySelector('[part="swatch"]').click();
      await el.updateComplete;
      return [el.label, el.value, el.format, el.inline, window.seen];
    });
    expect(r).toEqual(['Brand', 'rgb(255, 0, 0)', 'rgb', true, [['change', 'rgb(255, 0, 0)'], ['input', 'rgb(255, 0, 0)']]]);
    expect(errors).toEqual([]);
  });
});
