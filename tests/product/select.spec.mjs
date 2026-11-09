import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';
import { reactWrapperPage } from './support/react.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/select';
// Shoelace 2.20.1's select page has sixteen examples, in this order; all but the last two have a React version.
const ORDER = [
  ['basic', 'Default', 'default'], ['labels', 'Labels', 'labels'], ['help-text', 'Help Text', 'help-text'],
  ['placeholders', 'Placeholders', 'placeholders'], ['clearable', 'Clearable', 'clearable'], ['filled', 'Filled Selects', 'filled'],
  ['pill', 'Pill', 'pill'], ['disabled', 'Disabled', 'disabled'], ['multiple', 'Multiple', 'multiple'],
  ['initial-value', 'Setting Initial Values', 'initial-value'], ['grouping', 'Grouping Options', 'grouping'], ['sizes', 'Sizes', 'sizes'],
  ['placement', 'Placement', 'placement'], ['prefix-suffix', 'Prefix &amp; Suffix', 'prefix-suffix'], ['custom-tags', 'Custom Tags', 'custom-tags'],
  ['lazy-loading', 'Lazy loading options', 'lazy-loading'],
];
const NO_REACT = ['custom-tags', 'lazy-loading'];
const SECTIONS = ORDER.map(([, section]) => section.replace('&amp;', '&'));
const title = section => `Select example: ${section}`;
const docsDir = fileURLToPath(new URL('../../packages/docs/', import.meta.url));
const velcroDir = fileURLToPath(new URL('../../packages/velcro/', import.meta.url));

async function openPage(page) {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  const frame = page.frameLocator(`iframe.example[title="${title('Default')}"]`);
  await expect(frame.locator('#demo-default')).toBeVisible();
  await frame.locator('body').evaluate(() => customElements.whenDefined('sl-select'));
  await documentsLoaded(page);
  return { frame, requests, example: section => page.frameLocator(`iframe.example[title="${title(section)}"]`) };
}

// Top-level documents made by the test, with the theme and a bundle of the package entries through the package's real export
// map (no docs page, no aggregate and no iframe), where focus and key presses behave the same in every engine.
const SELECT_ENTRY = `
  import '@charm-ux/velcro/select';
  import '@charm-ux/velcro/option';
  import * as registry from '@charm-ux/velcro/utilities/animation-registry';
  window.selectModules = { registry };
`;
const SELECT_ONLY_ENTRY = `
  import '@charm-ux/velcro/select';
  window.selectModules = {};
`;
const CLASS_ENTRY = `
  import { SlSelect, VelcroSelect } from '@charm-ux/velcro/select/class';
  import { SlOption } from '@charm-ux/velcro/option/class';
  window.selectClass = { SlSelect, VelcroSelect, SlOption };
`;
const bundles = new Map();

async function bundleOf(source) {
  if (bundles.has(source)) return bundles.get(source);
  const fromDocs = createRequire(path.join(docsDir, 'package.json'));
  const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
  const dir = mkdtempSync(path.join(tmpdir(), 'velcro-select-entry-'));
  try {
    const entry = path.join(dir, 'entry.js');
    writeFileSync(entry, source);
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
    const code = (Array.isArray(out) ? out[0] : out).output.find(o => o.type === 'chunk').code;
    bundles.set(source, code);
    return code;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function loadBundle(page, source = SELECT_ENTRY) {
  const code = await bundleOf(source);
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  const themeCss = readFileSync(path.join(velcroDir, 'themes/light.css'), 'utf8');
  await page.setContent('<!DOCTYPE html><html class="sl-theme-light" lang="en"><body></body></html>');
  await page.addStyleTag({ content: themeCss });
  await page.addScriptTag({ type: 'module', content: code });
  await page.waitForFunction(() => Boolean(window.selectModules || window.selectClass));
  return pageErrors;
}

// Replaces the body with the markup and waits for every select and option in it to render.
async function mount(page, markup) {
  await page.evaluate(async markup => {
    document.body.innerHTML = markup;
    const all = [...document.querySelectorAll('sl-select, sl-option')];
    await Promise.all(all.map(el => el.updateComplete));
    // The select reads its options in a task after it connects (as Shoelace's does).
    await new Promise(r => setTimeout(r));
    await Promise.all(all.map(el => el.updateComplete));
  }, markup);
}

const OPTIONS = '<sl-option value="option-1">Option 1</sl-option><sl-option value="option-2">Option 2</sl-option><sl-option value="option-3">Option 3</sl-option>';

// Records the types of the select's events, in dispatch order, in window.log (their flags are checked in their own test).
const record = (page, selector = 'sl-select') => page.evaluate(selector => {
  window.log = [];
  const el = document.querySelector(selector);
  for (const type of ['sl-change', 'sl-input', 'sl-clear', 'sl-focus', 'sl-blur', 'sl-show', 'sl-after-show', 'sl-hide', 'sl-after-hide', 'sl-invalid']) {
    el.addEventListener(type, e => window.log.push(type));
  }
}, selector);
const log = page => page.evaluate(() => window.log);
// Opening focuses the highlighted option in the next animation frame (the display input then emits sl-blur) and emits
// sl-after-show when the show animation ends. The two are scheduled independently, here as in Shoelace: when that frame comes
// late, as in WebKit on a loaded runner, it runs only after the animation has ended and sl-after-show comes first. This reads
// the log with each such pair after an sl-show in one order; waiting for both also keeps the next key or click from landing
// before the option has the focus.
const openLog = page => page.evaluate(() => window.log.map((type, i, l) => {
  if (l[i - 1] === 'sl-show' && type === 'sl-after-show' && l[i + 1] === 'sl-blur') return 'sl-blur';
  if (l[i - 2] === 'sl-show' && type === 'sl-blur' && l[i - 1] === 'sl-after-show') return 'sl-after-show';
  return type;
}));

test('docs page is prerendered with Velcro branding, prototype status, every Shoelace section, the quirks and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Select - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('without changing the shared core prefix');
  for (const section of SECTIONS) expect(html).toContain(`title="${title(section).replace('&', '&amp;')}"`);
  const examplesPart = html.slice(html.indexOf('id="examples"'), html.indexOf('id="attributes"'));
  expect([...examplesPart.matchAll(/<h3 id="([^"]+)"><!--lit-part-->([^<]+)<!--\/lit-part--><\/h3>/g)].map(m => [m[1], m[2]])).toEqual(ORDER.map(([id, t]) => [id, t]));
  expect(html).toContain('Selects allow you to choose items from a menu of predefined options.');
  expect(html.match(/<summary>React<\/summary>/g)).toHaveLength(ORDER.length - NO_REACT.length);
  expect(html).toContain('import { VelcroSelect as SlSelect } from &#39;@charm-ux/velcro/react/VelcroSelect.js&#39;;');
  expect(html).toContain('Inherited from core');
  for (const name of ['value', 'defaultValue', 'size', 'multiple', 'maxOptionsVisible', 'getTag', 'sl-change', 'sl-after-hide', 'combobox', 'display-input', 'listbox', 'tag__remove-button__base', 'expand-icon', 'show', 'getForm', 'ready']) {
    expect(html).toContain(`data-name="${name}"`);
  }
  expect(html).toContain('The hidden attribute does not hide the select');
  expect(html).toContain('A select never starts open');
  expect(html).toContain('show() on a select that is already open closes it');
  expect(html).toContain('so the select emits sl-blur when it opens');
  expect(html).toContain('Disabling a select emits sl-hide and sl-after-hide even when it is already closed');
  expect(html).toContain('The keyboard does not skip disabled options');
  expect(html).toContain('The placeholder only counts as visible for a multiple select');
  expect(html).toContain('The value property is not reflected');
  expect(html).toContain('was run locally in Chromium and WebKit, and Firefox is covered only by the project&#39;s CI run');
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
  const home = await (await request.get('/')).text();
  expect(home).toContain('/components/select');
});

test('the examples render in their own documents in Shoelace\'s order, with every example file present', async ({ page }) => {
  const { requests, example } = await openPage(page);
  const titles = await page.locator('iframe.example').evaluateAll(frames => frames.map(f => f.title));
  expect(titles).toEqual(SECTIONS.map(title));
  const counts = [];
  for (const section of SECTIONS) counts.push(await example(section).locator('sl-select').count());
  expect(counts).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 3, 1, 4]);
  const files = dir => readdirSync(path.join(docsDir, 'examples/select', dir)).filter(f => /\.(html|jsx)$/.test(f)).sort();
  expect(files('')).toEqual(ORDER.map(([, , f]) => `${f}.html`).sort());
  expect(files('react')).toEqual(ORDER.filter(([, , f]) => !NO_REACT.includes(f)).map(([, , f]) => `${f}.jsx`).sort());
  // The initial values and the custom tags example render their selection.
  const initial = await example('Setting Initial Values').locator('sl-select').evaluate(el => el.updateComplete.then(() => el.value));
  expect(initial).toEqual(['option-1', 'option-2']);
  const custom = example('Custom Tags').locator('sl-select');
  await expect.poll(() => custom.evaluate(el => [...el.shadowRoot.querySelectorAll('.select__tags sl-tag')].map(t => t.textContent.trim()))).toEqual(['Email', 'Phone']);
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
});

test('the lazy loading example: options added later are selected from the value attribute, and the form data follows', async ({ page }) => {
  const { example } = await openPage(page);
  const frame = example('Lazy loading options');
  const values = () => frame.locator('sl-select').evaluateAll(els => els.map(el => el.value));
  expect(await values()).toEqual(['', '', ['bar', 'baz'], []]);
  for (const button of await frame.locator('sl-button[type="button"]').all()) await button.click();
  // The value follows the options' order in the document, and the new option is appended last.
  await expect.poll(values).toEqual(['foo', 'foo', ['bar', 'baz', 'foo'], ['foo']]);
  await frame.locator('sl-button[type="submit"]').click();
  await expect.poll(() => frame.locator('#lazy-options-example-form-data').textContent()).toBe(JSON.stringify({
    'select-1': 'foo', 'select-2': 'foo', 'select-3': ['bar', 'baz', 'foo'], 'select-4': 'foo',
  }, null, 2));
});

test('registration: the select entry defines sl-select with sl-popup, sl-tag, sl-icon-button and sl-icon, not sl-option; no core marker or ch-* definitions', async ({ page }) => {
  const pageErrors = await loadBundle(page, SELECT_ONLY_ENTRY);
  const r = await page.evaluate(() => ({
    defined: ['sl-select', 'sl-popup', 'sl-tag', 'sl-icon-button', 'sl-icon', 'sl-option'].map(t => customElements.get(t)?.name ?? null),
    ch: ['ch-select', 'ch-option'].map(t => Boolean(customElements.get(t))),
  }));
  expect(r).toEqual({ defined: ['VelcroSelect', 'VelcroPopup', 'VelcroTag', 'VelcroIconButton', 'VelcroIcon', null], ch: [false, false] });
  await mount(page, `<sl-select>${OPTIONS}</sl-select>`);
  expect(await page.locator('sl-select').evaluate(el => [el.getAttributeNames().sort(), el.shadowRoot.querySelector('select')])).toEqual([['data-optional', 'data-valid', 'focusable', 'form', 'placement', 'size'], null]);
  expect(pageErrors).toEqual([]);
});

test('structure: Shoelace\'s parts, a combobox labelled by the label and described by the help text, and a listbox of options', async ({ page }) => {
  const pageErrors = await loadBundle(page);
  await mount(page, `<sl-select label="Choose" help-text="Pick one" clearable value="option-2">${OPTIONS}</sl-select>`);
  const r = await page.locator('sl-select').evaluate(el => {
    const root = el.shadowRoot;
    const parts = [...root.querySelectorAll('[part]')].map(n => n.getAttribute('part'));
    const input = root.querySelector('[part="display-input"]');
    const listbox = root.querySelector('[part="listbox"]');
    return {
      parts,
      input: ['role', 'aria-controls', 'aria-expanded', 'aria-haspopup', 'aria-labelledby', 'aria-describedby', 'aria-disabled', 'tabindex', 'readonly'].map(a => input.getAttribute(a)),
      inputValue: input.value,
      listbox: ['role', 'aria-expanded', 'aria-multiselectable', 'aria-labelledby', 'tabindex'].map(a => listbox.getAttribute(a)),
      hidden: listbox.hidden,
      popup: root.querySelector('sl-popup').className.trim().split(/\s+/),
      options: [...el.querySelectorAll('sl-option')].map(o => [o.getAttribute('role'), o.getAttribute('aria-selected'), o.selected]),
    };
  });
  expect(r.parts).toEqual(['form-control', 'form-control-label', 'form-control-input', 'combobox', 'prefix', 'display-input', 'clear-button', 'suffix', 'expand-icon', 'listbox', 'form-control-help-text']);
  expect(r.input).toEqual(['combobox', 'listbox', 'false', 'listbox', 'label', 'help-text', 'false', '0', '']);
  expect(r.inputValue).toBe('Option 2');
  expect(r.listbox).toEqual(['listbox', 'false', 'false', 'label', '-1']);
  expect(r.popup).toEqual(['select', 'select--standard', 'select--bottom', 'select--medium']);
  expect(r.options).toEqual([['option', 'false', false], ['option', 'true', true], ['option', 'false', false]]);
  await expect(page.getByRole('combobox', { name: 'Choose' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Choose' })).toHaveAccessibleDescription('Pick one');
  await expect(page.getByRole('combobox', { name: 'Choose' })).toHaveAttribute('aria-expanded', 'false');
  expect(pageErrors).toEqual([]);
});

test('pointer: a click on the combobox opens the listbox; a click on an option selects it, emits sl-input then sl-change and closes', async ({ page }) => {
  const pageErrors = await loadBundle(page);
  await mount(page, `<sl-select label="Choose">${OPTIONS}</sl-select>`);
  await record(page);
  await page.locator('sl-select').evaluate(el => el.shadowRoot.querySelector('[part="combobox"]').getBoundingClientRect());
  await page.locator('sl-select [part="combobox"]').click();
  // Opening moves the focus to the highlighted option (Shoelace focuses it), so the display input emits sl-blur.
  await expect.poll(() => openLog(page)).toEqual(['sl-focus', 'sl-show', 'sl-blur', 'sl-after-show']);
  expect(await page.evaluate(() => document.activeElement?.localName)).toBe('sl-option');
  const combobox = page.getByRole('combobox', { name: 'Choose' });
  await expect(combobox).toHaveAttribute('aria-expanded', 'true');
  expect(await page.locator('sl-select').evaluate(el => [el.open, el.hasAttribute('open'), el.shadowRoot.querySelector('[part="listbox"]').hidden])).toEqual([true, true, false]);
  await page.getByRole('option', { name: 'Option 3' }).click();
  // The focus returns to the display input (sl-focus) before the input and change events, which follow the update.
  await expect.poll(() => openLog(page)).toEqual(['sl-focus', 'sl-show', 'sl-blur', 'sl-after-show', 'sl-focus', 'sl-hide', 'sl-input', 'sl-change', 'sl-after-hide']);
  expect(await page.locator('sl-select').evaluate(el => [el.value, el.open, el.shadowRoot.querySelector('[part="display-input"]').value, el.getAttribute('value')])).toEqual(['option-3', false, 'Option 3', null]);
  // A click on the option already selected changes nothing and emits no input or change.
  await page.locator('sl-select [part="combobox"]').click();
  await expect(combobox).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => openLog(page).then(l => l.slice(9))).toEqual(['sl-show', 'sl-blur', 'sl-after-show']);
  await page.evaluate(() => (window.log = []));
  await page.getByRole('option', { name: 'Option 3' }).click();
  await expect.poll(() => log(page)).toEqual(['sl-focus', 'sl-hide', 'sl-after-hide']);
  // A click outside closes it.
  await page.locator('sl-select [part="combobox"]').click();
  await expect(combobox).toHaveAttribute('aria-expanded', 'true');
  await page.mouse.click(5, 300);
  await expect(combobox).toHaveAttribute('aria-expanded', 'false');
  expect(pageErrors).toEqual([]);
});

test('keyboard: Tab focuses without opening; Enter, Space and the arrows open; the arrows, Home and End move the highlight; Enter selects; Escape closes', async ({ page }) => {
  const pageErrors = await loadBundle(page);
  await mount(page, `<button id="before">before</button><sl-select label="Choose" value="option-2">${OPTIONS}</sl-select>`);
  await record(page);
  const state = () => page.locator('sl-select').evaluate(el => [el.open, el.value, [...el.querySelectorAll('sl-option')].map(o => o.current)]);
  await page.locator('#before').focus();
  await page.keyboard.press('Tab');
  await expect.poll(() => log(page)).toEqual(['sl-focus']);
  expect((await state())[0]).toBe(false);
  await page.keyboard.press('ArrowDown');
  await expect.poll(state).toEqual([true, 'option-2', [false, true, false]]);
  await expect.poll(() => openLog(page)).toEqual(['sl-focus', 'sl-show', 'sl-blur', 'sl-after-show']);
  await page.keyboard.press('ArrowDown');
  await expect.poll(state).toEqual([true, 'option-2', [false, false, true]]);
  await page.keyboard.press('ArrowDown');
  await expect.poll(state).toEqual([true, 'option-2', [true, false, false]]);
  await page.keyboard.press('End');
  await expect.poll(state).toEqual([true, 'option-2', [false, false, true]]);
  await page.keyboard.press('Home');
  await expect.poll(state).toEqual([true, 'option-2', [true, false, false]]);
  await page.keyboard.press('ArrowUp');
  await expect.poll(state).toEqual([true, 'option-2', [false, false, true]]);
  await page.evaluate(() => (window.log = []));
  await page.keyboard.press('Enter');
  await expect.poll(state).toEqual([false, 'option-3', [false, false, true]]);
  await expect.poll(() => log(page)).toEqual(['sl-focus', 'sl-hide', 'sl-input', 'sl-change', 'sl-after-hide']);
  // Space opens too; Escape closes without changing the value and keeps the focus.
  // (Escape waits for the open to finish, sl-blur included: the option focus that opening schedules for the next frame would
  // otherwise run after Escape returned the focus to the display input, in Shoelace as here.)
  await page.evaluate(() => (window.log = []));
  await page.keyboard.press(' ');
  await expect.poll(() => openLog(page)).toEqual(['sl-show', 'sl-blur', 'sl-after-show']);
  await page.keyboard.press('Escape');
  await expect.poll(state).toEqual([false, 'option-3', [false, false, true]]);
  expect(await page.evaluate(() => document.activeElement?.localName)).toBe('sl-select');
  // (Enter waits for the close to finish: reopening during the hide animation ends with the listbox hidden while open.)
  await expect.poll(() => openLog(page)).toEqual(['sl-show', 'sl-blur', 'sl-after-show', 'sl-focus', 'sl-hide', 'sl-after-hide']);
  // Type to select moves the highlight to the first option whose label starts with the typed text.
  await page.evaluate(() => (window.log = []));
  await page.keyboard.press('Enter');
  await expect.poll(() => openLog(page)).toEqual(['sl-show', 'sl-blur', 'sl-after-show']);
  expect((await state())[0]).toBe(true);
  await page.keyboard.type('option 1');
  await expect.poll(() => state().then(s => s[2])).toEqual([true, false, false]);
  await page.keyboard.press('Enter');
  await expect.poll(state).toEqual([false, 'option-1', [true, false, false]]);
  expect(pageErrors).toEqual([]);
});

test('multiple: the value is an array, tags show the selection up to max-options-visible then +n, a tag\'s remove button deselects it, and the clear button empties it', async ({ page }) => {
  const pageErrors = await loadBundle(page);
  await mount(page, `<sl-select label="Choose" multiple clearable max-options-visible="2" value="option-1 option-2 option-3">${OPTIONS}</sl-select>`);
  await record(page);
  const state = () => page.locator('sl-select').evaluate(el => ({
    value: el.value,
    display: el.shadowRoot.querySelector('[part="display-input"]').value,
    tags: [...el.shadowRoot.querySelectorAll('[part="tags"] sl-tag')].map(t => [t.textContent.trim(), t.removable, t.getAttribute('part')]),
  }));
  expect(await state()).toEqual({
    value: ['option-1', 'option-2', 'option-3'], display: '3 options selected',
    tags: [['Option 1', true, 'tag'], ['Option 2', true, 'tag'], ['+1', false, null]],
  });
  expect(await page.locator('sl-select').evaluate(el => el.shadowRoot.querySelector('[part="listbox"]').getAttribute('aria-multiselectable'))).toBe('true');
  await page.locator('sl-select').evaluate(el => el.shadowRoot.querySelector('[part="tags"] sl-tag').shadowRoot.querySelector('sl-icon-button').click());
  await expect.poll(state).toEqual({ value: ['option-2', 'option-3'], display: '2 options selected', tags: [['Option 2', true, 'tag'], ['Option 3', true, 'tag']] });
  await expect.poll(() => log(page)).toEqual(['sl-input', 'sl-change']);
  // Clicking an option toggles it and keeps the listbox open.
  await page.locator('sl-select').evaluate(el => el.show());
  await page.getByRole('option', { name: 'Option 1' }).click();
  await expect.poll(state).toEqual({ value: ['option-1', 'option-2', 'option-3'], display: '3 options selected', tags: [['Option 1', true, 'tag'], ['Option 2', true, 'tag'], ['+1', false, null]] });
  expect(await page.locator('sl-select').evaluate(el => el.open)).toBe(true);
  await page.evaluate(() => (window.log = []));
  await page.locator('sl-select [part="clear-button"]').click();
  await expect.poll(state).toEqual({ value: [], display: 'No options selected', tags: [] });
  await expect.poll(() => log(page)).toEqual(['sl-clear', 'sl-input', 'sl-change']);
  expect(await page.locator('sl-select').evaluate(el => el.shadowRoot.querySelector('[part="clear-button"]'))).toBe(null);
  expect(pageErrors).toEqual([]);
});

test('forms: the name and value are added to the form data (one entry per selected option), required blocks submit (requestSubmit dispatches no submit event to later listeners), and reset restores the value attribute', async ({ page }) => {
  const pageErrors = await loadBundle(page);
  await mount(page, `
    <form id="f">
      <sl-select name="one" value="option-2">${OPTIONS}</sl-select>
      <sl-select name="many" multiple value="option-1 option-3">${OPTIONS}</sl-select>
      <sl-select name="needed" required>${OPTIONS}</sl-select>
    </form>
    <sl-select name="outside" form="f" value="option-1">${OPTIONS}</sl-select>`);
  const r = await page.evaluate(async () => {
    const form = document.querySelector('#f');
    const data = () => [...new FormData(form)];
    const [one, many, needed] = form.querySelectorAll('sl-select');
    const first = data();
    const valid = [form.checkValidity(), needed.checkValidity(), needed.validity.valueMissing, needed.hasAttribute('data-invalid'), needed.hasAttribute('data-user-invalid')];
    let invalidEvents = 0;
    needed.addEventListener('sl-invalid', () => invalidEvents++);
    form.reportValidity();
    // The form control controller's own submit listener (added first) stops an invalid form's submit event.
    const submits = [];
    form.addEventListener('submit', e => { submits.push(invalidEvents); e.preventDefault(); });
    form.requestSubmit();
    const blocked = [submits.length, invalidEvents];
    needed.value = 'option-3';
    one.value = 'option-1';
    many.value = ['option-2'];
    await Promise.all([one, many, needed].map(el => el.updateComplete));
    await new Promise(r => setTimeout(r));
    const second = [data(), needed.checkValidity(), needed.hasAttribute('data-valid'), one.getAttribute('value')];
    form.requestSubmit();
    const submitted = submits.length;
    form.reset();
    await Promise.all([one, many, needed].map(el => el.updateComplete));
    return { first, valid, blocked, submitted, second, reset: [one.value, many.value, needed.value], inElements: [...form.elements].some(e => e.localName === 'sl-select') };
  });
  // An empty select is submitted with an empty value, as in Shoelace.
  expect(r.first).toEqual([['one', 'option-2'], ['many', 'option-1'], ['many', 'option-3'], ['needed', ''], ['outside', 'option-1']]);
  expect(r.valid).toEqual([false, false, true, true, false]);
  // reportValidity() emitted sl-invalid once; the blocked requestSubmit() reported again (a second sl-invalid) and no submit
  // event reached the later listener. Once valid, requestSubmit() dispatches it.
  expect(r.blocked).toEqual([0, 2]);
  expect(r.submitted).toBe(1);
  expect(r.second).toEqual([[['one', 'option-1'], ['many', 'option-2'], ['needed', 'option-3'], ['outside', 'option-1']], true, true, 'option-2']);
  expect(r.reset).toEqual(['option-2', ['option-1', 'option-3'], '']);
  expect(r.inElements).toBe(false);
  expect(pageErrors).toEqual([]);
});

test('properties: Shoelace\'s defaults and reflection; the value attribute sets defaultValue; setting value selects options without events; a value no option has selects nothing', async ({ page }) => {
  const pageErrors = await loadBundle(page);
  await mount(page, `<sl-select>${OPTIONS}</sl-select>`);
  await record(page);
  const r = await page.locator('sl-select').evaluate(async el => {
    const defaults = ['name', 'value', 'defaultValue', 'size', 'placeholder', 'multiple', 'maxOptionsVisible', 'disabled', 'clearable', 'open', 'hoist', 'filled', 'pill', 'label', 'placement', 'helpText', 'form', 'required', 'dir', 'lang']
      .map(p => [p, el[p]]);
    const types = [typeof el.getTag, typeof el.show, typeof el.hide, typeof el.checkValidity, typeof el.getForm, typeof el.reportValidity, typeof el.setCustomValidity, typeof el.focus, typeof el.blur];
    el.size = 'large'; el.multiple = true; el.disabled = true; el.filled = true; el.pill = true; el.placement = 'top'; el.form = 'x'; el.required = true;
    el.name = 'n'; el.label = 'L'; el.helpText = 'H'; el.placeholder = 'P'; el.clearable = true; el.hoist = true; el.maxOptionsVisible = 1;
    await el.updateComplete;
    const reflected = el.getAttributeNames().sort();
    el.multiple = false; el.disabled = false; el.required = false; el.form = '';
    el.setAttribute('value', 'option-1');
    await el.updateComplete;
    const attr = [el.defaultValue, el.value, [...el.querySelectorAll('sl-option')].map(o => o.selected)];
    el.value = 'option-3';
    await el.updateComplete;
    const prop = [el.value, el.getAttribute('value'), [...el.querySelectorAll('sl-option')].map(o => o.selected)];
    el.value = 'nothing';
    await el.updateComplete;
    return { defaults, types, reflected, attr, prop, missing: [el.value, el.shadowRoot.querySelector('[part="display-input"]').value] };
  });
  expect(r.defaults).toEqual([
    ['name', ''], ['value', ''], ['defaultValue', ''], ['size', 'medium'], ['placeholder', ''], ['multiple', false], ['maxOptionsVisible', 3],
    ['disabled', false], ['clearable', false], ['open', false], ['hoist', false], ['filled', false], ['pill', false], ['label', ''],
    ['placement', 'bottom'], ['helpText', ''], ['form', ''], ['required', false], ['dir', undefined], ['lang', undefined],
  ]);
  expect(r.types).toEqual(Array(9).fill('function'));
  // The form control controller's data attributes (a disabled control is valid) and core's focusable marker come along.
  expect(r.reflected).toEqual(['data-required', 'data-valid', 'disabled', 'filled', 'focusable', 'form', 'multiple', 'pill', 'placement', 'required', 'size']);
  expect(r.attr).toEqual(['option-1', 'option-1', [true, false, false]]);
  expect(r.prop).toEqual(['option-3', 'option-1', [false, false, true]]);
  // Shoelace selects nothing for a value no option has, and the value property becomes the empty string.
  expect(r.missing).toEqual(['', '']);
  // No input or change event for any of these. Upstream quirk: disabling the closed select ran the close sequence anyway.
  await expect.poll(() => log(page)).toEqual(['sl-hide', 'sl-after-hide']);
  expect(pageErrors).toEqual([]);
});

test('removing a reflected attribute restores the value the property held at the first attribute change (Shoelace\'s base element): the defaults for markup; a removed Boolean attribute gives false', async ({ page }) => {
  const pageErrors = await loadBundle(page);
  await mount(page, `<sl-select size="large" placement="top" form="f" disabled required multiple filled pill hide-label label-position="start">${OPTIONS}</sl-select>`);
  const r = await page.locator('sl-select').evaluate(async el => {
    const popup = () => el.shadowRoot.querySelector('sl-popup').className.trim().split(/\s+/).sort();
    const before = [el.size, el.placement, el.form, el.disabled, el.required, el.multiple, el.filled, el.pill, el.hideLabel, el.labelPosition];
    for (const name of ['size', 'placement', 'form', 'disabled', 'required', 'multiple', 'filled', 'pill', 'hide-label', 'label-position']) el.removeAttribute(name);
    await el.updateComplete;
    return {
      before,
      after: [el.size, el.placement, el.form, el.disabled, el.required, el.multiple, el.filled, el.pill, el.hideLabel, el.labelPosition],
      attributes: ['size', 'placement', 'form', 'disabled', 'required', 'multiple', 'filled', 'pill', 'hide-label', 'label-position'].map(a => el.getAttribute(a)),
      popup: popup(),
      inputDisabled: el.shadowRoot.querySelector('[part="display-input"]').disabled,
    };
  });
  expect(r.before).toEqual(['large', 'top', 'f', true, true, true, true, true, true, 'start']);
  // label-position has no initial value (core declares none), so removing it leaves null.
  expect(r.after).toEqual(['medium', 'bottom', '', false, false, false, false, false, false, null]);
  // The restored values are reflected again; the Boolean ones are absent.
  expect(r.attributes).toEqual(['medium', 'bottom', '', null, null, null, null, null, null, null]);
  expect(r.popup).toEqual(['select', 'select--bottom', 'select--medium', 'select--standard']);
  expect(r.inputDisabled).toBe(false);
  expect(pageErrors).toEqual([]);
});

test('removing a reflected attribute of a select created from script restores the values assigned before its first attribute change, not the declared defaults', async ({ page }) => {
  const pageErrors = await loadBundle(page);
  const r = await page.evaluate(async () => {
    const el = document.createElement('sl-select');
    el.size = 'small';
    el.placement = 'top';
    document.body.append(el);
    await el.updateComplete;
    el.setAttribute('size', 'large');
    el.setAttribute('placement', 'bottom');
    await el.updateComplete;
    const set = [el.size, el.placement];
    el.removeAttribute('size');
    el.removeAttribute('placement');
    await el.updateComplete;
    return { set, removed: [el.size, el.placement, el.getAttribute('size'), el.getAttribute('placement')] };
  });
  expect(r).toEqual({ set: ['large', 'bottom'], removed: ['small', 'top', 'small', 'top'] });
  expect(pageErrors).toEqual([]);
});

test('event flags: every event bubbles and is composed and is not cancelable, except sl-invalid, which does not bubble and is cancelable', async ({ page }) => {
  const pageErrors = await loadBundle(page);
  await mount(page, `<form><sl-select required clearable>${OPTIONS}</sl-select></form>`);
  await page.locator('sl-select').evaluate(el => {
    window.flags = {};
    for (const type of ['sl-change', 'sl-input', 'sl-clear', 'sl-focus', 'sl-blur', 'sl-show', 'sl-after-show', 'sl-hide', 'sl-after-hide', 'sl-invalid']) {
      el.addEventListener(type, e => (window.flags[type] ??= [e.bubbles, e.composed, e.cancelable, e.target === el]));
    }
  });
  await page.locator('sl-select [part="combobox"]').click();
  await expect.poll(() => page.evaluate(() => Boolean(window.flags['sl-after-show']))).toBe(true);
  await page.getByRole('option', { name: 'Option 2' }).click();
  await expect.poll(() => page.evaluate(() => Boolean(window.flags['sl-after-hide']))).toBe(true);
  await page.locator('sl-select [part="clear-button"]').click();
  await expect.poll(() => page.evaluate(() => Boolean(window.flags['sl-clear']))).toBe(true);
  await page.locator('sl-select').evaluate(el => { el.blur(); el.closest('form').reportValidity(); });
  const flags = await page.evaluate(() => window.flags);
  const regular = [true, true, false, true];
  expect(flags).toEqual({
    'sl-focus': regular, 'sl-show': regular, 'sl-blur': regular, 'sl-after-show': regular, 'sl-hide': regular, 'sl-input': regular,
    'sl-change': regular, 'sl-after-hide': regular, 'sl-clear': regular, 'sl-invalid': [false, false, true, true],
  });
  expect(pageErrors).toEqual([]);
});

test('disabled: no opening by pointer or keyboard, the display input is disabled, and disabling an open select closes it', async ({ page }) => {
  const pageErrors = await loadBundle(page);
  await mount(page, `<sl-select label="Choose" disabled>${OPTIONS}</sl-select>`);
  await page.locator('sl-select').click({ force: true });
  const r = await page.locator('sl-select').evaluate(async el => {
    const input = el.shadowRoot.querySelector('[part="display-input"]');
    const first = [el.open, input.disabled, input.getAttribute('aria-disabled'), el.shadowRoot.querySelector('sl-popup').classList.contains('select--disabled')];
    const shown = await el.show();
    el.disabled = false;
    await el.updateComplete;
    await el.show();
    el.disabled = true;
    await el.updateComplete;
    await new Promise(r => el.addEventListener('sl-after-hide', r, { once: true }));
    return { first, shown, after: [el.open, el.shadowRoot.querySelector('[part="listbox"]').hidden] };
  });
  expect(r).toEqual({ first: [false, true, 'true', true], shown: undefined, after: [false, true] });
  await expect(page.getByRole('combobox', { name: 'Choose' })).toBeDisabled();
  expect(pageErrors).toEqual([]);
});

test('computed styles: Shoelace\'s sizes, border, radius, colors, the pill radius, the filled background and the focus ring', async ({ page }) => {
  const pageErrors = await loadBundle(page);
  await mount(page, `
    <sl-select id="s" size="small">${OPTIONS}</sl-select><sl-select id="m">${OPTIONS}</sl-select><sl-select id="l" size="large">${OPTIONS}</sl-select>
    <sl-select id="pill" pill>${OPTIONS}</sl-select><sl-select id="filled" filled>${OPTIONS}</sl-select>`);
  const r = await page.evaluate(() => {
    const probe = decl => {
      const p = document.createElement('div');
      p.style.cssText = decl;
      document.body.append(p);
      const cs = getComputedStyle(p);
      const out = { height: cs.height, radius: cs.borderTopLeftRadius, bg: cs.backgroundColor, border: cs.borderTopColor, width: cs.borderTopWidth, font: cs.fontSize };
      p.remove();
      return out;
    };
    const read = id => {
      const box = document.getElementById(id).shadowRoot.querySelector('[part="combobox"]');
      const cs = getComputedStyle(box);
      return { height: `${box.getBoundingClientRect().height}px`, radius: cs.borderTopLeftRadius, bg: cs.backgroundColor, border: cs.borderTopColor, width: cs.borderTopWidth, font: cs.fontSize, style: cs.borderTopStyle };
    };
    return {
      sizes: ['s', 'm', 'l'].map(read),
      expected: ['small', 'medium', 'large'].map(s => probe(`height: var(--sl-input-height-${s}); border-radius: var(--sl-input-border-radius-${s}); background-color: var(--sl-input-background-color); border: solid var(--sl-input-border-width) var(--sl-input-border-color); font-size: var(--sl-input-font-size-${s})`)),
      pill: [read('pill').radius, probe('border-radius: var(--sl-input-height-medium)').radius],
      filled: [read('filled').bg, read('filled').width, probe('background-color: var(--sl-input-filled-background-color)').bg],
    };
  });
  for (const [i, size] of r.sizes.entries()) {
    expect(size.style).toBe('solid');
    expect({ ...size, style: undefined }).toEqual({ ...r.expected[i], style: undefined });
  }
  expect(r.pill[0]).toBe(r.pill[1]);
  expect(r.filled).toEqual([r.filled[2], '0px', r.filled[2]]);
  await page.locator('#m').evaluate(el => el.focus());
  // The focus styles take effect after the --sl-transition-fast transition.
  const ring = () => page.evaluate(() => {
    const box = document.getElementById('m').shadowRoot.querySelector('[part="combobox"]');
    const p = document.createElement('div');
    p.style.cssText = 'box-shadow: 0 0 0 var(--sl-focus-ring-width) var(--sl-input-focus-ring-color); border-color: var(--sl-input-border-color-focus)';
    document.body.append(p);
    const expected = [getComputedStyle(p).boxShadow, getComputedStyle(p).borderTopColor];
    p.remove();
    return [[getComputedStyle(box).boxShadow, getComputedStyle(box).borderTopColor], expected];
  });
  await expect.poll(async () => { const [actual, expected] = await ring(); return JSON.stringify(actual) === JSON.stringify(expected); }).toBe(true);
  expect(pageErrors).toEqual([]);
});

test('the listbox: an sl-popup with Shoelace\'s settings, the width of the combobox, and the show and hide animations from the registry, whose rtl variant follows dir', async ({ page }) => {
  const pageErrors = await loadBundle(page);
  await mount(page, `<sl-select style="width: 300px" placement="top" hoist>${OPTIONS}</sl-select>`);
  const r = await page.locator('sl-select').evaluate(async el => {
    const popup = el.shadowRoot.querySelector('sl-popup');
    const settings = [popup.placement, popup.strategy, popup.flip, popup.shift, popup.sync, popup.autoSize, popup.autoSizePadding, popup.active];
    const { registry } = window.selectModules;
    const defaults = [registry.getAnimation(el, 'select.show', { dir: 'ltr' }), registry.getAnimation(el, 'select.hide', { dir: 'ltr' })];
    registry.setAnimation(el, 'select.show', { keyframes: [{ opacity: 0 }, { opacity: 1 }], options: { duration: 50 } });
    const animations = [];
    const original = popup.popup.animate.bind(popup.popup);
    popup.popup.animate = (k, o) => { animations.push([k.length, o.duration]); return original(k, o); };
    await el.show();
    const widths = [Math.round(popup.popup.getBoundingClientRect().width), Math.round(el.shadowRoot.querySelector('[part="combobox"]').getBoundingClientRect().width)];
    await el.hide();
    // The rtlKeyframes variant follows the select's own dir property.
    registry.setAnimation(el, 'select.hide', { keyframes: [{ opacity: 1 }, { opacity: 0 }], rtlKeyframes: [{ opacity: 1 }, { opacity: 0.5 }, { opacity: 0 }], options: { duration: 30 } });
    el.dir = 'rtl';
    await el.show();
    await el.hide();
    return { settings, defaults, animations, widths, active: popup.active };
  });
  expect(r.settings).toEqual(['top', 'fixed', true, true, 'width', 'vertical', 10, false]);
  expect(r.defaults).toEqual([
    { keyframes: [{ opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1 }], options: { duration: 100, easing: 'ease' } },
    { keyframes: [{ opacity: 1, scale: 1 }, { opacity: 0, scale: 0.9 }], options: { duration: 100, easing: 'ease' } },
  ]);
  expect(r.animations).toEqual([[2, 50], [2, 100], [2, 50], [3, 30]]);
  expect(r.widths[0]).toBe(r.widths[1]);
  expect(r.active).toBe(false);
  expect(pageErrors).toEqual([]);
});

test('core extensions kept: hide-label hides the label and help text visually; error-message sets a custom validity; invalid, label-position and readonly have no effect', async ({ page }) => {
  const pageErrors = await loadBundle(page);
  await mount(page, `<sl-select label="Choose" help-text="Help" hide-label error-message="Bad" invalid label-position="start" readonly>${OPTIONS}</sl-select>`);
  const r = await page.locator('sl-select').evaluate(async el => {
    await el.updateComplete;
    const label = el.shadowRoot.querySelector('[part="form-control-label"]');
    const help = el.shadowRoot.querySelector('[part="form-control-help-text"]');
    const hidden = [label.getBoundingClientRect().width <= 1, help.getBoundingClientRect().width <= 1];
    const validity = [el.checkValidity(), el.validationMessage];
    el.errorMessage = '';
    await el.updateComplete;
    return { hidden, validity, cleared: el.checkValidity(), attrs: ['invalid', 'label-position', 'readonly', 'hide-label'].map(a => el.getAttribute(a)) };
  });
  expect(r).toEqual({ hidden: [true, true], validity: [false, 'Bad'], cleared: true, attrs: ['', 'start', '', ''] });
  await expect(page.getByRole('combobox', { name: 'Choose' })).toBeVisible();
  // readonly has no effect: the select still opens.
  await page.locator('sl-select [part="combobox"]').click();
  await expect.poll(() => page.locator('sl-select').evaluate(el => el.open)).toBe(true);
  expect(pageErrors).toEqual([]);
});

test('upstream quirk: disabling a closed select emits sl-hide and sl-after-hide; enabling it emits nothing', async ({ page }) => {
  const pageErrors = await loadBundle(page);
  await mount(page, `<sl-select>${OPTIONS}</sl-select>`);
  await record(page);
  await page.locator('sl-select').evaluate(async el => {
    el.disabled = true;
    await el.updateComplete;
  });
  await expect.poll(() => log(page)).toEqual(['sl-hide', 'sl-after-hide']);
  await page.locator('sl-select').evaluate(async el => {
    el.disabled = false;
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 300));
  });
  expect(await log(page)).toEqual(['sl-hide', 'sl-after-hide']);
  expect(await page.locator('sl-select').evaluate(el => el.open)).toBe(false);
  expect(pageErrors).toEqual([]);
});

test('upstream quirks: hidden does not hide it; it never starts open; show() on an open select closes it; the placeholder class is set only for a multiple select', async ({ page }) => {
  const pageErrors = await loadBundle(page);
  await mount(page, `<sl-select id="h" hidden>${OPTIONS}</sl-select><sl-select id="o" open>${OPTIONS}</sl-select>
    <sl-select id="p" placeholder="Pick">${OPTIONS}</sl-select><sl-select id="pm" multiple placeholder="Pick">${OPTIONS}</sl-select>`);
  const r = await page.evaluate(async () => {
    const h = document.getElementById('h');
    const o = document.getElementById('o');
    const hidden = [getComputedStyle(h).display, h.getBoundingClientRect().height > 0];
    const open = [o.open, o.hasAttribute('open'), o.shadowRoot.querySelector('sl-popup').active];
    await o.show();
    const opened = o.open;
    const second = await o.show();
    await new Promise(r => o.addEventListener('sl-after-hide', r, { once: true }));
    const closed = await o.hide();
    const cls = id => document.getElementById(id).shadowRoot.querySelector('sl-popup').classList.contains('select--placeholder-visible');
    const shown = id => document.getElementById(id).shadowRoot.querySelector('[part="display-input"]').placeholder;
    return { hidden, open, opened, second, after: o.open, closed, placeholder: [cls('p'), cls('pm'), shown('p'), shown('pm')] };
  });
  expect(r).toEqual({ hidden: ['block', true], open: [false, false, false], opened: true, second: undefined, after: false, closed: undefined, placeholder: [false, true, 'Pick', 'Pick'] });
  expect(pageErrors).toEqual([]);
});

test('upstream quirk: the keyboard highlights disabled options, and Enter on one neither selects it nor closes the listbox; a click on one is ignored', async ({ page }) => {
  const pageErrors = await loadBundle(page);
  await mount(page, `<button id="before">before</button><sl-select label="Choose"><sl-option value="a">Alpha</sl-option><sl-option value="b" disabled>Beta</sl-option><sl-option value="c">Gamma</sl-option></sl-select>`);
  await page.locator('#before').focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => page.locator('sl-select').evaluate(el => el.open)).toBe(true);
  await page.keyboard.press('ArrowDown');
  const state = () => page.locator('sl-select').evaluate(el => [el.open, el.value, [...el.querySelectorAll('sl-option')].map(o => o.current)]);
  await expect.poll(state).toEqual([true, '', [false, true, false]]);
  await page.keyboard.press('Enter');
  await expect.poll(state).toEqual([true, '', [false, true, false]]);
  await page.keyboard.type('b');
  await expect.poll(state).toEqual([true, '', [false, true, false]]);
  // Forced: Playwright waits for an aria-disabled element to be enabled before it clicks.
  await page.getByRole('option', { name: 'Beta' }).click({ force: true });
  expect(await state()).toEqual([true, '', [false, true, false]]);
  expect(await page.locator('sl-option[disabled]').getAttribute('aria-disabled')).toBe('true');
  expect(pageErrors).toEqual([]);
});

test('localized text: the multiple display label and the clear button label come from the localization module', async ({ page }) => {
  const pageErrors = await loadBundle(page);
  await mount(page, `<sl-select multiple clearable value="option-1">${OPTIONS}</sl-select><sl-select id="two" multiple placeholder="x">${OPTIONS}</sl-select>`);
  const r = await page.locator('sl-select').first().evaluate(el => [el.shadowRoot.querySelector('[part="display-input"]').value, el.shadowRoot.querySelector('[part="clear-button"]').getAttribute('aria-label'),
    document.getElementById('two').shadowRoot.querySelector('[part="display-input"]').value]);
  expect(r).toEqual(['1 option selected', 'Clear entry', '']);
  expect(pageErrors).toEqual([]);
});

test('dir and lang are reactive, not reflected and undefined by default; the inherited core ready event fires once without bubbling', async ({ page }) => {
  const pageErrors = await loadBundle(page);
  const r = await page.evaluate(async () => {
    const seen = [];
    document.addEventListener('ready', () => seen.push('document'));
    const el = document.createElement('sl-select');
    el.addEventListener('ready', e => seen.push([e.bubbles, e.composed]));
    document.body.append(el);
    await el.updateComplete;
    const before = [el.dir, el.lang];
    el.dir = 'rtl';
    el.lang = 'de';
    await el.updateComplete;
    return { before, after: [el.dir, el.lang, el.hasAttribute('dir'), el.hasAttribute('lang')], seen };
  });
  expect(r).toEqual({ before: [undefined, undefined], after: ['rtl', 'de', false, false], seen: [[false, false]] });
  expect(pageErrors).toEqual([]);
});

test('focus is not delegated, as in Shoelace: clicking the help text neither focuses the control nor emits sl-focus; focus() and blur() act on the display input', async ({ page }) => {
  const pageErrors = await loadBundle(page);
  await mount(page, `<sl-select help-text="Help">${OPTIONS}</sl-select>`);
  await record(page);
  await page.locator('sl-select [part="form-control-help-text"]').click();
  expect(await log(page)).toEqual([]);
  const r = await page.locator('sl-select').evaluate(el => {
    el.focus();
    const focused = el.shadowRoot.activeElement?.getAttribute('part');
    el.blur();
    return [focused, el.shadowRoot.activeElement];
  });
  expect(r).toEqual(['display-input', null]);
  expect(await log(page)).toEqual(['sl-focus', 'sl-blur']);
  expect(pageErrors).toEqual([]);
});

// The class-only entry (@charm-ux/velcro/select/class), bundled alone. Shoelace's select declares sl-icon, sl-popup and sl-tag
// in `static dependencies`, and its base element defines each missing dependency when a select is constructed.
test.describe('class-only entry', () => {
  test('importing defines nothing; constructing a select defines Velcro\'s sl-icon, sl-popup and sl-tag, not sl-icon-button (the tag defines it when one is constructed) or sl-option', async ({ page }) => {
    const pageErrors = await loadBundle(page, CLASS_ENTRY);
    const r = await page.evaluate(async () => {
      const { SlSelect, VelcroSelect } = window.selectClass;
      const tags = () => ['sl-select', 'sl-icon', 'sl-popup', 'sl-tag', 'sl-icon-button', 'sl-option'].map(t => customElements.get(t)?.name ?? null);
      const afterImport = tags();
      customElements.define('sl-select', SlSelect);
      const el = document.createElement('sl-select');
      el.multiple = true;
      document.body.append(el);
      await el.updateComplete;
      const afterConstruct = tags();
      return { afterImport, afterConstruct, alias: SlSelect === VelcroSelect };
    });
    expect(r).toEqual({
      afterImport: [null, null, null, null, null, null],
      afterConstruct: ['VelcroSelect', 'VelcroIcon', 'VelcroPopup', 'VelcroTag', null, null],
      alias: true,
    });
    expect(pageErrors).toEqual([]);
  });
});

// Shoelace's React examples, ported in packages/docs/examples/select/react/*.jsx, bundled with React 19 and the generated
// wrappers, which are resolved through the package's real export map.
test.describe('React examples', () => {
  const names = ORDER.map(([, , f]) => f).filter(f => !NO_REACT.includes(f));
  let bundle;

  test.beforeAll(async () => {
    const fromVelcro = createRequire(path.join(velcroDir, 'package.json'));
    const fromDocs = createRequire(path.join(docsDir, 'package.json'));
    const pkgDir = name => path.dirname(fromVelcro.resolve(`${name}/package.json`));
    const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
    const dir = mkdtempSync(path.join(tmpdir(), 'velcro-select-react-'));
    try {
      for (const name of names) {
        writeFileSync(path.join(dir, `${name}.jsx`), `${readFileSync(path.join(docsDir, `examples/select/react/${name}.jsx`), 'utf8')}\nexport default App;\n`);
      }
      const entry = path.join(dir, 'entry.js');
      writeFileSync(entry, `
        import React from 'react';
        import { flushSync } from 'react-dom';
        import { createRoot } from 'react-dom/client';
        ${names.map((n, i) => `import App${i} from './${n}.jsx';`).join('\n')}
        const apps = { ${names.map((n, i) => `'${n}': App${i}`).join(', ')} };
        window.errors = [];
        addEventListener('error', e => window.errors.push(String(e.message)));
        addEventListener('unhandledrejection', e => window.errors.push(String(e.reason)));
        window.renderExample = name => {
          const host = document.createElement('div');
          host.id = name;
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

  test('render the same selects as the HTML examples, through the generated wrappers', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    const themeCss = readFileSync(path.join(velcroDir, 'themes/light.css'), 'utf8');
    await page.setContent('<!DOCTYPE html><html class="sl-theme-light"><body style="margin: 0"></body></html>');
    await page.addStyleTag({ content: themeCss });
    await page.addScriptTag({ type: 'module', content: bundle });
    await page.waitForFunction(() => typeof window.renderExample === 'function');
    const r = await page.evaluate(async names => {
      const out = {};
      for (const name of names) {
        window.renderExample(name);
        await customElements.whenDefined('sl-select');
        const selects = [...document.querySelectorAll(`#${name} sl-select`)];
        await Promise.all(selects.map(s => s.updateComplete));
        await new Promise(r => setTimeout(r));
        await Promise.all(selects.map(s => s.updateComplete));
        out[name] = selects.map(s => [s.querySelectorAll('sl-option').length, s.size, s.multiple, s.disabled, s.label, JSON.stringify(s.value)]);
      }
      return { out, errors: window.errors };
    }, names);
    expect(r.out).toEqual({
      default: [[6, 'medium', false, false, '', '""']],
      labels: [[3, 'medium', false, false, 'Select one', '""']],
      'help-text': [[3, 'medium', false, false, 'Experience', '""']],
      placeholders: [[3, 'medium', false, false, '', '""']],
      clearable: [[3, 'medium', false, false, '', '""']],
      filled: [[3, 'medium', false, false, '', '""']],
      pill: [[3, 'medium', false, false, '', '""']],
      disabled: [[3, 'medium', false, true, '', '""']],
      multiple: [[6, 'medium', true, false, 'Select a Few', '["option-1","option-2","option-3"]']],
      'initial-value': [[3, 'medium', true, false, '', '["option-1","option-2"]']],
      grouping: [[6, 'medium', false, false, '', '""']],
      sizes: [[3, 'small', false, false, '', '""'], [3, 'medium', false, false, '', '""'], [3, 'large', false, false, '', '""']],
      placement: [[3, 'medium', false, false, '', '""']],
      'prefix-suffix': [[3, 'small', false, false, '', '""'], [3, 'medium', false, false, '', '""'], [3, 'large', false, false, '', '""']],
    });
    expect(r.errors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});

test.describe('React wrapper', () => {
  const mountReact = reactWrapperPage(test);

  test('passes Shoelace\'s props and calls onSlChange and onSlInput after a selection, with the select as the event target', async ({ page }) => {
    const errors = await mountReact(page);
    const r = await page.evaluate(async () => {
      const seen = [];
      const on = e => seen.push([e.type, e.target === document.querySelector('#wrapped'), e.target.value]);
      window.renderWrapper('VelcroSelect', { label: 'Wrapped', size: 'small', pill: true, clearable: true, value: 'b', onSlChange: on, onSlInput: on },
        '<sl-option value="a">A</sl-option><sl-option value="b">B</sl-option>');
      const el = document.querySelector('#wrapped');
      await customElements.whenDefined('sl-select');
      await el.updateComplete;
      await new Promise(r => setTimeout(r));
      await el.updateComplete;
      const first = [el.label, el.size, el.pill, el.clearable, el.value];
      el.shadowRoot.querySelector('[part="clear-button"]').click();
      await el.updateComplete;
      await el.updateComplete;
      return { first, seen };
    });
    expect(r).toEqual({ first: ['Wrapped', 'small', true, true, 'b'], seen: [['sl-input', true, ''], ['sl-change', true, '']] });
    expect(errors).toEqual([]);
  });
});

test('no upstream Shoelace runtime is requested or defined; no request leaves the local origin', async ({ page }) => {
  const { frame, requests } = await openPage(page);
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  expect(await frame.locator('body').evaluate(() => Boolean(window.Shoelace || document.querySelector('script[src*="shoelace"]')))).toBe(false);
});
