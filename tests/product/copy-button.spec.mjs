import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';
import { reactWrapperPage } from './support/react.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/copy-button';
// Shoelace 2.20.1's copy button page has eight examples, in this order; every one is live and has a React version.
const ORDER = [
  ['basic', 'Default'], ['custom-labels', 'Custom Labels'], ['custom-icons', 'Custom Icons'],
  ['copying-values-from-other-elements', 'Copying Values From Other Elements'], ['handling-errors', 'Handling Errors'], ['disabled', 'Disabled'],
  ['changing-feedback-duration', 'Changing Feedback Duration'], ['custom-styles', 'Custom Styles'],
];
const FILES = ['basic', 'custom-labels', 'custom-icons', 'from', 'errors', 'disabled', 'feedback-duration', 'custom-styles'];
const SECTIONS = ORDER.map(([, section]) => section);
const title = section => `Copy Button example: ${section}`;
const docsDir = fileURLToPath(new URL('../../packages/docs/', import.meta.url));
const velcroDir = fileURLToPath(new URL('../../packages/velcro/', import.meta.url));

async function openPage(page) {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  const frame = page.frameLocator(`iframe.example[title="${title('Default')}"]`);
  await expect(frame.locator('sl-copy-button').first()).toBeVisible();
  await frame.locator('body').evaluate(() => customElements.whenDefined('sl-copy-button'));
  await documentsLoaded(page);
  return { frame, requests, example: section => page.frameLocator(`iframe.example[title="${title(section)}"]`) };
}

test('docs page is prerendered with Velcro branding, prototype status, every Shoelace section, the quirks and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Copy Button - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('without changing the shared core prefix');
  for (const section of SECTIONS) expect(html).toContain(`title="${title(section)}"`);
  // The sections are all there, in Shoelace's order (before the API tables); the first has no heading text of its own.
  const examplesPart = html.slice(html.indexOf('id="examples"'), html.indexOf('id="attributes"'));
  expect([...examplesPart.matchAll(/<h3 id="([^"]+)"><!--lit-part-->([^<]+)<!--\/lit-part--><\/h3>/g)].map(m => [m[1], m[2]])).toEqual(ORDER);
  expect(examplesPart).toContain('You can customize the labels using the <code>copy-label</code>, <code>success-label</code>, and <code>error-label</code> attributes.');
  expect(examplesPart).toContain('Use the <code>copy-icon</code>, <code>success-icon</code>, and <code>error-icon</code> slots');
  expect(examplesPart).toContain('To copy data from an attribute, use <code>from="id[attr]"</code>');
  expect(examplesPart).toContain('the <code>sl-error</code> event will be emitted.');
  expect(examplesPart).toContain('Copy buttons can be disabled by adding the <code>disabled</code> attribute.');
  expect(examplesPart).toContain('using the <code>feedback-duration</code> attribute.');
  expect(examplesPart).toContain('You can customize the button to your liking with CSS.');
  expect(html).toContain('Copies data to the clipboard when the user clicks the button.');
  // The API tables: Shoelace's members, plus the core ready event labelled as inherited.
  expect(html).toContain('Inherited from core');
  for (const name of ['value', 'from', 'disabled', 'copyLabel', 'successLabel', 'errorLabel', 'feedbackDuration', 'tooltipPlacement', 'hoist', 'sl-copy', 'sl-error',
    'copy-icon', 'success-icon', 'error-icon', 'button', 'tooltip__base', 'tooltip__base__popup', 'tooltip__base__arrow', 'tooltip__body', '--success-color', '--error-color']) {
    expect(html).toContain(`data-name="${name}"`);
  }
  expect(html).toContain('data-name="ready"');
  expect(html.match(/<summary>React<\/summary>/g)).toHaveLength(SECTIONS.length);
  expect(html).toContain('&lt;sl-copy-button id=&quot;demo-default&quot; value=&quot;Velcro rocks!&quot;&gt;&lt;/sl-copy-button&gt;');
  expect(html).toContain('&lt;sl-copy-button from=&quot;my-link[href]&quot;&gt;&lt;/sl-copy-button&gt;');
  expect(html).toContain('import { VelcroCopyButton as SlCopyButton } from &#39;@charm-ux/velcro/react/VelcroCopyButton.js&#39;;');
  expect(html).toContain('feedbackDuration={250}');
  // The quirks and limits the page lists are the ones the tests below pin.
  expect(html).toContain('The hidden attribute does not hide the copy button');
  expect(html).toContain('A from that names no element reports the error and carries on');
  expect(html).toContain('The from syntax is two string tests, not a parser');
  expect(html).toContain('always use the left-to-right keyframes');
  expect(html).toContain('The button has no accessible name of its own');
  expect(html).toContain('was run locally in Chromium and WebKit only, and Firefox is covered only by the project&#39;s CI run');
  expect(html).toContain('Playwright&#39;s ARIA snapshot');
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
  const home = await (await request.get('/')).text();
  expect(home).toContain('/components/copy-button');
});

test('sl-copy-button registers inside the example document as the exported class, with sl-tooltip, sl-popup and sl-icon, no core marker and no ch-* definitions', async ({ page }) => {
  const { frame, requests } = await openPage(page);
  const info = await frame.locator('body').evaluate(() => {
    const ctor = customElements.get('sl-copy-button');
    const el = document.querySelector('sl-copy-button');
    return {
      baseName: ctor?.baseName,
      coreTag: customElements.get('ch-copy-button') !== undefined,
      viaConstructor: ctor ? new ctor().localName : null,
      instance: el instanceof ctor,
      tooltip: customElements.get('sl-tooltip')?.baseName,
      popup: customElements.get('sl-popup')?.baseName,
      icon: customElements.get('sl-icon')?.baseName,
      attrs: el.getAttributeNames().sort(),
      observed: [...ctor.observedAttributes].sort(),
    };
  });
  expect(info).toEqual({
    baseName: 'copy-button', coreTag: false, viaConstructor: 'sl-copy-button', instance: true, tooltip: 'tooltip', popup: 'popup', icon: 'icon', attrs: ['id', 'value'],
    observed: ['copy-label', 'dir', 'disabled', 'error-label', 'feedback-duration', 'from', 'hoist', 'lang', 'success-label', 'tooltip-placement', 'value'],
  });
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
});

test('no upstream Shoelace runtime is requested or defined; no request leaves the local origin', async ({ page }) => {
  const { frame, requests } = await openPage(page);
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  expect(await frame.locator('body').evaluate(() => Boolean(window.Shoelace || document.querySelector('script[src*="shoelace"]')))).toBe(false);
});

test('the examples render in their own documents in Shoelace\'s order, and every example file of Shoelace\'s page is present', async ({ page }) => {
  const { requests, example } = await openPage(page);
  const titles = await page.locator('iframe.example').evaluateAll(frames => frames.map(f => f.title));
  expect(titles).toEqual(SECTIONS.map(title));
  const counts = [];
  for (const section of SECTIONS) {
    await expect(example(section).locator('sl-copy-button').first()).toBeVisible();
    counts.push(await example(section).locator('sl-copy-button').count());
  }
  expect(counts).toEqual([1, 1, 1, 3, 1, 1, 1, 1]);
  const ids = await page.locator('h3[id]').evaluateAll(hs => hs.map(h => h.id));
  expect(ids.filter(id => ORDER.some(([known]) => known === id))).toEqual(ORDER.map(([id]) => id));
  const files = dir => readdirSync(path.join(docsDir, 'examples/copy-button', dir)).filter(f => /\.(html|jsx)$/.test(f)).sort();
  expect(files('')).toEqual(FILES.map(f => `${f}.html`).sort());
  expect(files('react')).toEqual(FILES.map(f => `${f}.jsx`).sort());
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
});

test('the examples carry Shoelace\'s markup: labels, custom icons, the three from forms, the missing id, disabled, the duration and the custom styles', async ({ page }) => {
  const { example } = await openPage(page);
  const read = (section, selector) => example(section).locator(selector).evaluateAll(els => els.map(el => ({
    value: el.getAttribute('value'), from: el.getAttribute('from'), disabled: el.hasAttribute('disabled'), copyLabel: el.getAttribute('copy-label'),
    successLabel: el.getAttribute('success-label'), errorLabel: el.getAttribute('error-label'), duration: el.getAttribute('feedback-duration'),
    slots: [...el.children].map(c => `${c.localName}[${c.getAttribute('slot')}=${c.getAttribute('name')}]`),
  })));
  const blank = { value: null, from: null, disabled: false, copyLabel: null, successLabel: null, errorLabel: null, duration: null, slots: [] };
  expect(await read('Default', 'sl-copy-button')).toEqual([{ ...blank, value: 'Velcro rocks!' }]);
  expect(await read('Custom Labels', 'sl-copy-button')).toEqual([{ ...blank, value: 'Custom labels are easy', copyLabel: 'Click to copy', successLabel: 'You did it!', errorLabel: 'Whoops, your browser doesn\'t support this!' }]);
  expect(await read('Custom Icons', 'sl-copy-button')).toEqual([{ ...blank, value: 'Copied from a custom button', slots: ['sl-icon[copy-icon=clipboard]', 'sl-icon[success-icon=clipboard-check]', 'sl-icon[error-icon=clipboard-x]'] }]);
  expect((await read('Copying Values From Other Elements', 'sl-copy-button')).map(b => b.from)).toEqual(['my-phone', 'my-input.value', 'my-link[href]']);
  expect(await read('Handling Errors', 'sl-copy-button')).toEqual([{ ...blank, from: 'i-do-not-exist' }]);
  expect(await read('Disabled', 'sl-copy-button')).toEqual([{ ...blank, value: 'You can\'t copy me', disabled: true }]);
  expect(await read('Changing Feedback Duration', 'sl-copy-button')).toEqual([{ ...blank, value: 'Velcro rocks!', duration: '250' }]);
  expect(await read('Custom Styles', 'sl-copy-button')).toEqual([{ ...blank, value: 'I\'m so stylish', slots: ['sl-icon[copy-icon=asterisk]', 'sl-icon[success-icon=check-lg]', 'sl-icon[error-icon=x-lg]'] }]);
});

// Runs a self-contained function in a document: `target` is a page, or a locator in a frame (its body), and the function gets only `arg`.
const inDocument = (target, fn, arg) => (target.evaluateAll
  ? target.evaluate((_element, { source, arg }) => new Function(`return (${source})`)()(arg), { source: fn.toString(), arg })
  : target.evaluate(fn, arg));

// Replaces the example document's clipboard with a recording stub, so every engine runs the same code path (a real clipboard needs
// a permission that only Chromium grants without a prompt). `mode` is 'ok', 'reject' (writeText rejects) or 'missing' (no clipboard).
async function stubClipboard(target, mode = 'ok') {
  await inDocument(target, mode => {
    window.copied = [];
    const writeText = async text => {
      window.copied.push(text);
      if (mode === 'reject') throw new DOMException('denied', 'NotAllowedError');
    };
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: mode === 'missing' ? undefined : { writeText } });
  }, mode);
}

// Records every sl-copy and sl-error that reaches the document.
async function recordEvents(target) {
  await inDocument(target, () => {
    window.events = [];
    for (const type of ['sl-copy', 'sl-error']) {
      document.addEventListener(type, e => window.events.push({ type, id: e.target.id, bubbles: e.bubbles, composed: e.composed, cancelable: e.cancelable, detail: e.detail }));
    }
  });
}

// Top-level documents made by the test, with the theme and a bundle of the package entries through the package's real export map
// (so there is no docs page, no aggregate and no iframe), where focus and key presses behave the same in every engine.
const ENTRY = `
  import '@charm-ux/velcro/copy-button';
  import '@charm-ux/velcro/translations/es';
  import * as registry from '@charm-ux/velcro/utilities/animation-registry';
  import * as localize from '@charm-ux/velcro/utilities/localize';
  window.copyModules = { registry, localize };
`;
const CLASS_ENTRY = `
  import { SlCopyButton, VelcroCopyButton } from '@charm-ux/velcro/copy-button/class';
  import { SlTooltip } from '@charm-ux/velcro/tooltip/class';
  import { SlPopup } from '@charm-ux/velcro/popup/class';
  import { SlIcon } from '@charm-ux/velcro/icon/class';
  window.copyClass = { SlCopyButton, VelcroCopyButton, SlTooltip, SlPopup, SlIcon };
`;
const bundles = new Map();

async function bundleOf(source) {
  if (bundles.has(source)) return bundles.get(source);
  const fromDocs = createRequire(path.join(docsDir, 'package.json'));
  const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
  const dir = mkdtempSync(path.join(tmpdir(), 'velcro-copy-button-entry-'));
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

async function loadBundle(page, source) {
  const code = await bundleOf(source);
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  const themeCss = readFileSync(path.join(velcroDir, 'themes/light.css'), 'utf8');
  await page.setContent('<!DOCTYPE html><html class="sl-theme-light" lang="en"><body></body></html>');
  await page.addStyleTag({ content: themeCss });
  await page.addScriptTag({ type: 'module', content: code });
  await page.waitForFunction(() => Boolean(window.copyModules || window.copyClass));
  return pageErrors;
}

// A top-level document with the copy button's bundle, the clipboard stub and the event recorder.
async function openTop(page, mode = 'ok') {
  const pageErrors = await loadBundle(page, ENTRY);
  await stubClipboard(page, mode);
  await recordEvents(page);
  return pageErrors;
}

async function mount(page, markup) {
  await page.evaluate(async markup => {
    document.body.innerHTML = markup;
    await Promise.all([...document.querySelectorAll('sl-copy-button')].map(el => el.updateComplete));
  }, markup);
}

const stateOf = (page, selector = '#c') => page.evaluate(selector => {
  const el = document.querySelector(selector);
  return { status: el.status, copying: el.isCopying, hidden: [el.copyIcon.hidden, el.successIcon.hidden, el.errorIcon.hidden], tip: el.tooltip.content };
}, selector);
const REST = { status: 'rest', copying: false, hidden: [false, true, true] };
const settled = (page, selector = '#c') => expect.poll(() => page.evaluate(selector => document.querySelector(selector).isCopying, selector), { timeout: 15000 }).toBe(false);
const copiedAndEvents = page => page.evaluate(() => ({ copied: window.copied, events: window.events.map(e => e.type) }));

test.describe('top-level documents', () => {
  test('default: a tooltip around the button with the three icon slots, the first one visible, and no role or ARIA attributes on the host', async ({ page }) => {
    const pageErrors = await openTop(page);
    await mount(page, '<sl-copy-button id="c" value="Velcro rocks!"></sl-copy-button>');
    const r = await page.locator('#c').evaluate(el => {
      const attrsOf = n => Object.fromEntries(n.getAttributeNames().map(name => [name, name === 'class' ? [...n.classList].join(' ') : n.getAttribute(name)]));
      const tooltip = el.shadowRoot.querySelector('sl-tooltip');
      const button = tooltip.querySelector('button');
      return {
        children: [...el.shadowRoot.children].filter(n => n.localName !== 'style').map(n => n.localName),
        tooltip: attrsOf(tooltip),
        tooltipChildren: [...tooltip.children].map(n => n.localName),
        button: attrsOf(button),
        buttonChildren: [...button.children].map(n => `${n.localName}:${n.getAttribute('name')}:${n.getAttribute('part')}:${n.hidden}`),
        icons: [...button.querySelectorAll('sl-icon')].map(i => [i.getAttribute('library'), i.getAttribute('name')]),
        display: [...button.querySelectorAll('slot')].map(s => getComputedStyle(s).display),
        queries: [el.tooltip === tooltip, el.copyIcon === button.children[0], el.successIcon === button.children[1], el.errorIcon === button.children[2]],
        hostAttrs: el.getAttributeNames().sort(),
        aria: [el.getAttribute('role'), button.getAttribute('role'), ...el.getAttributeNames().filter(n => n.startsWith('aria-')), ...button.getAttributeNames().filter(n => n.startsWith('aria-'))],
        exportparts: tooltip.getAttribute('exportparts').split(',').map(s => s.trim()),
      };
    });
    expect(r).toEqual({
      children: ['sl-tooltip'],
      tooltip: { class: 'copy-button', content: 'Copy', placement: 'top', exportparts: r.tooltip.exportparts },
      tooltipChildren: ['button'],
      button: { class: 'copy-button__button', part: 'button', type: 'button' },
      buttonChildren: ['slot:copy-icon:copy-icon:false', 'slot:success-icon:success-icon:true', 'slot:error-icon:error-icon:true'],
      icons: [['system', 'copy'], ['system', 'check'], ['system', 'x-lg']],
      // The slots are inline-flex in the styles; as items of the button's flex container they compute to flex.
      display: ['flex', 'none', 'none'],
      queries: [true, true, true, true],
      hostAttrs: ['id', 'value'],
      aria: [null, null],
      exportparts: ['base:tooltip__base', 'base__popup:tooltip__base__popup', 'base__arrow:tooltip__base__arrow', 'body:tooltip__body'],
    });
    expect(await stateOf(page)).toEqual({ ...REST, tip: 'Copy' });
    expect(pageErrors).toEqual([]);
  });

  test('properties: Shoelace\'s defaults, the attributes that set them, and only disabled reflects; dir and lang are reactive, undefined and not reflected', async ({ page }) => {
    await openTop(page);
    const r = await page.evaluate(async () => {
      const read = el => ({
        value: el.value, from: el.from, disabled: el.disabled, copyLabel: el.copyLabel, successLabel: el.successLabel, errorLabel: el.errorLabel,
        feedbackDuration: el.feedbackDuration, tooltipPlacement: el.tooltipPlacement, hoist: el.hoist, lang: el.lang, dir: el.dir, isCopying: el.isCopying, status: el.status,
      });
      const plain = document.createElement('sl-copy-button');
      document.body.append(plain);
      await plain.updateComplete;
      const defaults = read(plain);
      const tipDefaults = [plain.tooltip.placement, plain.tooltip.hoist, plain.tooltip.disabled, plain.tooltip.content];
      const holder = document.createElement('div');
      holder.innerHTML = '<sl-copy-button value="a" from="b" copy-label="c" success-label="d" error-label="e" feedback-duration="250" tooltip-placement="left" hoist disabled lang="fr" dir="rtl"></sl-copy-button>';
      document.body.append(holder);
      const set = holder.firstElementChild;
      await set.updateComplete;
      const fromAttributes = read(set);
      const tipSet = [set.tooltip.placement, set.tooltip.hoist, set.tooltip.disabled, set.tooltip.content];
      // Properties do not reflect, except disabled; lang and dir are not reflected either.
      plain.value = 'v';
      plain.from = 'f';
      plain.copyLabel = 'l';
      plain.feedbackDuration = 5;
      plain.tooltipPlacement = 'bottom';
      plain.hoist = true;
      plain.disabled = true;
      plain.lang = 'de';
      plain.dir = 'rtl';
      await plain.updateComplete;
      const reflected = plain.getAttributeNames().sort();
      const read2 = [plain.lang, plain.dir, plain.tooltip.placement, plain.tooltip.hoist, plain.tooltip.disabled, plain.tooltip.content];
      plain.disabled = false;
      await plain.updateComplete;
      return { defaults, tipDefaults, fromAttributes, tipSet, reflected, read2, afterFalse: plain.hasAttribute('disabled') };
    });
    expect(r.defaults).toEqual({
      value: '', from: '', disabled: false, copyLabel: '', successLabel: '', errorLabel: '', feedbackDuration: 1000, tooltipPlacement: 'top', hoist: false,
      lang: undefined, dir: undefined, isCopying: false, status: 'rest',
    });
    expect(r.tipDefaults).toEqual(['top', false, false, 'Copy']);
    expect(r.fromAttributes).toEqual({
      value: 'a', from: 'b', disabled: true, copyLabel: 'c', successLabel: 'd', errorLabel: 'e', feedbackDuration: 250, tooltipPlacement: 'left', hoist: true,
      lang: 'fr', dir: 'rtl', isCopying: false, status: 'rest',
    });
    expect(r.tipSet).toEqual(['left', true, true, 'c']);
    expect(r.reflected).toEqual(['disabled']);
    expect(r.read2).toEqual(['de', 'rtl', 'bottom', true, true, 'l']);
    expect(r.afterFalse).toBe(false);
  });

  test('removing a reflected attribute restores the value the property had before its attributes were applied; null assigned to disabled is restored the same way', async ({ page }) => {
    await openTop(page);
    const r = await page.evaluate(async () => {
      const holder = document.createElement('div');
      holder.innerHTML = '<sl-copy-button id="p" value="x" disabled></sl-copy-button>';
      document.body.append(holder);
      const parsed = holder.firstElementChild;
      await parsed.updateComplete;
      const withAttribute = [parsed.disabled, parsed.hasAttribute('disabled')];
      parsed.removeAttribute('disabled');
      await parsed.updateComplete;
      const afterRemoval = [parsed.disabled, parsed.hasAttribute('disabled')];
      parsed.disabled = null;
      await parsed.updateComplete;
      const afterNull = [parsed.disabled, parsed.hasAttribute('disabled')];
      // Created from script with no attribute change first: nothing was recorded, so null stays null (as in Shoelace).
      const created = document.createElement('sl-copy-button');
      document.body.append(created);
      await created.updateComplete;
      created.disabled = null;
      await created.updateComplete;
      return { withAttribute, afterRemoval, afterNull, created: created.disabled };
    });
    expect(r).toEqual({ withAttribute: [true, true], afterRemoval: [false, false], afterNull: [false, false], created: null });
  });

  test('the ready event is emitted once, on the first update, and does not bubble', async ({ page }) => {
    await openTop(page);
    const r = await page.evaluate(async () => {
      const seen = [];
      let bubbled = 0;
      document.body.addEventListener('ready', () => bubbled++);
      const el = document.createElement('sl-copy-button');
      el.addEventListener('ready', e => seen.push({ bubbles: e.bubbles, composed: e.composed }));
      document.body.append(el);
      await el.updateComplete;
      el.value = 'x';
      await el.updateComplete;
      return { seen, bubbled };
    });
    expect(r).toEqual({ seen: [{ bubbles: false, composed: false }], bubbled: 0 });
  });

  test('a click copies value through navigator.clipboard.writeText, emits sl-copy from the host, shows the success feedback and then restores the rest state', async ({ page }) => {
    const pageErrors = await openTop(page);
    await mount(page, '<sl-copy-button id="c" value="Velcro rocks!" feedback-duration="1500"></sl-copy-button>');
    expect(await stateOf(page)).toEqual({ ...REST, tip: 'Copy' });
    await page.locator('#c button').click();
    await expect.poll(() => stateOf(page)).toEqual({ status: 'success', copying: true, hidden: [true, false, true], tip: 'Copied' });
    expect(await page.evaluate(() => window.copied)).toEqual(['Velcro rocks!']);
    // sl-copy bubbles, is composed, not cancelable, and its detail is { value }.
    expect(await page.evaluate(() => window.events)).toEqual([{ type: 'sl-copy', id: 'c', bubbles: true, composed: true, cancelable: false, detail: { value: 'Velcro rocks!' } }]);
    await settled(page);
    expect(await stateOf(page)).toEqual({ ...REST, tip: 'Copy' });
    expect(await page.evaluate(() => window.events.length)).toBe(1);
    expect(pageErrors).toEqual([]);
  });

  test('the success icon slot and the error icon slot show the slotted custom icons while their state lasts', async ({ page }) => {
    await openTop(page);
    await mount(page, `<sl-copy-button id="c" value="v" feedback-duration="1500">
      <sl-icon slot="copy-icon" name="clipboard"></sl-icon><sl-icon slot="success-icon" name="clipboard-check"></sl-icon><sl-icon slot="error-icon" name="clipboard-x"></sl-icon>
    </sl-copy-button>`);
    const assigned = () => page.locator('#c').evaluate(el => [el.copyIcon, el.successIcon, el.errorIcon].map(s => [s.hidden, s.assignedElements().map(n => n.getAttribute('name'))]));
    expect(await assigned()).toEqual([[false, ['clipboard']], [true, ['clipboard-check']], [true, ['clipboard-x']]]);
    await page.locator('#c button').click();
    await expect.poll(assigned).toEqual([[true, ['clipboard']], [false, ['clipboard-check']], [true, ['clipboard-x']]]);
    await settled(page);
    expect(await assigned()).toEqual([[false, ['clipboard']], [true, ['clipboard-check']], [true, ['clipboard-x']]]);
    // An error shows the error icon instead.
    await page.locator('#c').evaluate(el => { el.value = ''; });
    await page.locator('#c button').click();
    await expect.poll(assigned).toEqual([[true, ['clipboard']], [true, ['clipboard-check']], [false, ['clipboard-x']]]);
    await settled(page);
  });

  test('errors: an empty value, a rejected write and a missing clipboard each emit sl-error from the host and show the error feedback; nothing is copied for an empty value', async ({ page }) => {
    for (const [mode, value, copied] of [['ok', '', []], ['reject', 'x', ['x']], ['missing', 'x', []]]) {
      const pageErrors = await openTop(page, mode);
      await mount(page, `<sl-copy-button id="c" value="${value}" feedback-duration="1500"></sl-copy-button>`);
      await page.locator('#c button').click();
      await expect.poll(() => stateOf(page), { message: mode }).toEqual({ status: 'error', copying: true, hidden: [true, true, false], tip: 'Error' });
      expect(await page.evaluate(() => window.copied), mode).toEqual(copied);
      expect(await page.evaluate(() => window.events), mode).toEqual([{ type: 'sl-error', id: 'c', bubbles: true, composed: true, cancelable: false, detail: {} }]);
      await settled(page);
      expect(await stateOf(page), mode).toEqual({ ...REST, tip: 'Copy' });
      expect(pageErrors, mode).toEqual([]);
    }
  });

  test('clicks are ignored while the feedback shows, and work again after it', async ({ page }) => {
    await openTop(page);
    await mount(page, '<sl-copy-button id="c" value="v" feedback-duration="1500"></sl-copy-button>');
    await page.locator('#c button').click();
    await expect.poll(() => stateOf(page)).toMatchObject({ status: 'success', copying: true });
    await page.locator('#c button').click();
    await page.locator('#c button').click();
    expect(await copiedAndEvents(page)).toEqual({ copied: ['v'], events: ['sl-copy'] });
    await settled(page);
    await page.locator('#c button').click();
    await settled(page);
    expect(await copiedAndEvents(page)).toEqual({ copied: ['v', 'v'], events: ['sl-copy', 'sl-copy'] });
  });

  test('disabled: the inner button is disabled, the tooltip is disabled, a click copies nothing, and the styles are half opacity with the not-allowed cursor', async ({ page }) => {
    await openTop(page);
    await mount(page, '<sl-copy-button id="c" value="v" disabled></sl-copy-button><sl-copy-button id="d" value="v"></sl-copy-button>');
    const r = await page.evaluate(() => {
      const read = el => {
        const button = el.shadowRoot.querySelector('button');
        const cs = getComputedStyle(button);
        return { disabled: button.disabled, tooltip: el.tooltip.disabled, opacity: cs.opacity, cursor: cs.cursor };
      };
      return [read(document.querySelector('#c')), read(document.querySelector('#d'))];
    });
    expect(r).toEqual([{ disabled: true, tooltip: true, opacity: '0.5', cursor: 'not-allowed' }, { disabled: false, tooltip: false, opacity: '1', cursor: 'pointer' }]);
    await page.locator('#c').click({ force: true });
    await page.locator('#c').evaluate(el => el.click());
    await page.locator('#c').evaluate(el => el.shadowRoot.querySelector('button').click());
    expect(await copiedAndEvents(page)).toEqual({ copied: [], events: [] });
    expect(await stateOf(page)).toEqual({ ...REST, tip: 'Copy' });
    // Enabling it again makes it work.
    await page.locator('#c').evaluate(el => { el.disabled = false; });
    await page.locator('#c button').click();
    await settled(page);
    expect(await copiedAndEvents(page)).toEqual({ copied: ['v'], events: ['sl-copy'] });
  });

  test('labels: copy-label, success-label and error-label are the tooltip text for each state', async ({ page }) => {
    await openTop(page);
    await mount(page, '<sl-copy-button id="c" value="v" feedback-duration="1500" copy-label="Click to copy" success-label="You did it!" error-label="Whoops"></sl-copy-button>');
    expect((await stateOf(page)).tip).toBe('Click to copy');
    await page.locator('#c button').click();
    await expect.poll(() => stateOf(page)).toMatchObject({ status: 'success', tip: 'You did it!' });
    await settled(page);
    expect((await stateOf(page)).tip).toBe('Click to copy');
    await page.locator('#c').evaluate(el => { el.value = ''; });
    await page.locator('#c button').click();
    await expect.poll(() => stateOf(page)).toMatchObject({ status: 'error', tip: 'Whoops' });
    await settled(page);
    expect((await stateOf(page)).tip).toBe('Click to copy');
  });

  test('quirk: the tooltip text is written onto the tooltip, so a copy-label changed during the feedback replaces the success label and the old label comes back afterwards', async ({ page }) => {
    await openTop(page);
    await mount(page, '<sl-copy-button id="c" value="v" feedback-duration="1500" copy-label="First"></sl-copy-button>');
    await page.locator('#c button').click();
    await expect.poll(() => stateOf(page)).toMatchObject({ status: 'success', tip: 'Copied' });
    await page.locator('#c').evaluate(async el => { el.copyLabel = 'Second'; await el.updateComplete; });
    expect((await stateOf(page)).tip).toBe('Second');
    await settled(page);
    expect((await stateOf(page)).tip).toBe('First');
    // The template's own label is up to date again once the label changes (or the element renders a new label).
    await page.locator('#c').evaluate(async el => { el.copyLabel = 'Third'; await el.updateComplete; });
    expect((await stateOf(page)).tip).toBe('Third');
  });

  test('default labels are the localization module\'s copy, copied and error terms, in the element\'s language and the document\'s', async ({ page }) => {
    await openTop(page);
    await mount(page, '<sl-copy-button id="c" value="v" lang="es" feedback-duration="1500"></sl-copy-button><sl-copy-button id="d" value="v"></sl-copy-button>');
    expect((await stateOf(page)).tip).toBe('Copiar');
    await page.locator('#c button').click();
    await expect.poll(() => stateOf(page)).toMatchObject({ status: 'success', tip: 'Copiado' });
    await settled(page);
    expect((await stateOf(page)).tip).toBe('Copiar');
    await page.locator('#c').evaluate(el => { el.value = ''; });
    await page.locator('#c button').click();
    await expect.poll(() => stateOf(page)).toMatchObject({ status: 'error', tip: 'Error' });
    await settled(page);
    // The document language applies to the other button, re-rendered when <html lang> changes.
    expect((await stateOf(page, '#d')).tip).toBe('Copy');
    await page.evaluate(() => { document.documentElement.lang = 'es'; });
    await expect.poll(() => page.evaluate(() => document.querySelector('#d').tooltip.content)).toBe('Copiar');
  });

  test('from: the element\'s text content, an attribute (id[attr]) and a property (id.prop); from wins over value', async ({ page }) => {
    await openTop(page);
    await mount(page, `
      <span id="phone">+1 (234) 456-7890</span><sl-copy-button id="t1" from="phone" value="ignored" feedback-duration="1"></sl-copy-button>
      <input id="inp" value="User input"><sl-copy-button id="t2" from="inp.value" feedback-duration="1"></sl-copy-button>
      <a id="link" href="https://example.com/">L</a><sl-copy-button id="t3" from="link[href]" feedback-duration="1"></sl-copy-button>
      <sl-copy-button id="t4" from="link.href" feedback-duration="1"></sl-copy-button>
      <sl-copy-button id="t5" from="" value="own value" feedback-duration="1"></sl-copy-button>`);
    for (const id of ['t1', 't2', 't3', 't4', 't5']) {
      await page.locator(`#${id} button`).click();
      await settled(page, `#${id}`);
    }
    expect(await copiedAndEvents(page)).toEqual({
      copied: ['+1 (234) 456-7890', 'User input', 'https://example.com/', 'https://example.com/', 'own value'], events: Array(5).fill('sl-copy'),
    });
  });

  // Each case mounts a button with the given attributes next to the extra markup, clicks it and reports what was copied and which
  // events were emitted, in order.
  async function run(page, attrs, extra = '', setup = () => {}) {
    await mount(page, `${extra}<sl-copy-button id="c" feedback-duration="1" ${attrs}></sl-copy-button>`);
    await page.evaluate(setup);
    await page.evaluate(() => { window.copied = []; window.events = []; });
    await page.locator('#c button').click();
    await settled(page);
    return copiedAndEvents(page);
  }

  test('quirk: a from that names no element emits sl-error and then still copies value; with no value it reports the error a second time', async ({ page }) => {
    await openTop(page);
    expect(await run(page, 'from="nope" value="V"')).toEqual({ copied: ['V'], events: ['sl-error', 'sl-copy'] });
    expect(await run(page, 'from="nope"')).toEqual({ copied: [], events: ['sl-error', 'sl-error'] });
    // An element whose text, attribute or property is empty is an error too (once: the missing-value check).
    expect(await run(page, 'from="e"', '<span id="e"></span>')).toEqual({ copied: [], events: ['sl-error'] });
    expect(await run(page, 'from="a[nope]"', '<a id="a" href="#">x</a>')).toEqual({ copied: [], events: ['sl-error'] });
    expect(await run(page, 'from="a.nope"', '<a id="a" href="#">x</a>')).toEqual({ copied: [], events: ['sl-error'] });
  });

  test('quirk: from is two string tests: a dot splits at every dot and only the first two parts are used, and brackets anywhere make the field an attribute read, also after a dot split', async ({ page }) => {
    await openTop(page);
    const props = () => { const el = document.querySelector('#x'); el.b = 'bee'; el.c = 'cee'; el.zero = 0; el.five = 5; el.no = false; };
    expect(await run(page, 'from="x.b.c"', '<div id="x" data-q="attr"></div>', props)).toEqual({ copied: ['bee'], events: ['sl-copy'] });
    // Falsy property values are errors; other values are passed on as they are (the browser stringifies them).
    expect(await run(page, 'from="x.zero"', '<div id="x"></div>', props)).toEqual({ copied: [], events: ['sl-error'] });
    expect(await run(page, 'from="x.no"', '<div id="x"></div>', props)).toEqual({ copied: [], events: ['sl-error'] });
    expect(await run(page, 'from="x.five"', '<div id="x"></div>', props)).toEqual({ copied: [5], events: ['sl-copy'] });
    // Bracket form without a dot splits at "[" and reads the attribute.
    expect(await run(page, 'from="x[data-q]"', '<div id="x" data-q="attr"></div>')).toEqual({ copied: ['attr'], events: ['sl-copy'] });
    // With a dot and brackets the dot split gives the id and the field ("x" and "b[]"), and the brackets make the field an attribute read:
    // the element has a property b ("bee") and an attribute "b[]", and the attribute is what is copied.
    expect(await run(page, 'from="x.b[]"', '<div id="x" b[]="attr-value"></div>', props)).toEqual({ copied: ['attr-value'], events: ['sl-copy'] });
    // With the property only, the attribute read finds nothing: an error, although the property has a value.
    expect(await run(page, 'from="x.b[]"', '<div id="x"></div>', props)).toEqual({ copied: [], events: ['sl-error'] });
    // from="x[data.q]" has a dot: it looks for the id "x[data" (an element with another id is not found) and reads its attribute "q]".
    expect(await run(page, 'from="x[data.q]"', '<div id="x" data.q="dotted"></div>')).toEqual({ copied: [], events: ['sl-error', 'sl-error'] });
    expect(await run(page, 'from="x[data.q]"', '<div id="x[data" q]="bracket attr"></div>')).toEqual({ copied: ['bracket attr'], events: ['sl-copy'] });
    // Whitespace is trimmed only in the property and attribute forms: a plain id with a space does not match.
    expect(await run(page, 'from=" x.b "', '<div id="x"></div>', props)).toEqual({ copied: ['bee'], events: ['sl-copy'] });
    expect(await run(page, 'from=" x[data-q] "', '<div id="x" data-q="attr"></div>')).toEqual({ copied: ['attr'], events: ['sl-copy'] });
    expect(await run(page, 'from=" x"', '<div id="x">text</div>')).toEqual({ copied: [], events: ['sl-error', 'sl-error'] });
    // An id that contains a dot cannot be referenced.
    expect(await run(page, 'from="a.b"', '<div id="a.b">text</div>')).toEqual({ copied: [], events: ['sl-error', 'sl-error'] });
  });

  test('quirk: from is looked up in the button\'s own tree (the shadow root that holds it), not always in the document', async ({ page }) => {
    await openTop(page);
    await mount(page, '<span id="outer">from the document</span><div id="host"></div><sl-copy-button id="c" from="outer" feedback-duration="1"></sl-copy-button>');
    const inside = await page.evaluate(async () => {
      const root = document.querySelector('#host').attachShadow({ mode: 'open' });
      root.innerHTML = '<span id="inner">from the shadow root</span><span id="outer">shadow outer</span><sl-copy-button id="s1" from="inner" feedback-duration="1"></sl-copy-button><sl-copy-button id="s2" from="outer" feedback-duration="1"></sl-copy-button><sl-copy-button id="s3" from="missing" feedback-duration="1"></sl-copy-button>';
      await Promise.all([...root.querySelectorAll('sl-copy-button')].map(el => el.updateComplete));
      return true;
    });
    expect(inside).toBe(true);
    for (const selector of ['#s1', '#s2', '#s3', '#c']) {
      await page.locator(`${selector} button`).click();
      await expect.poll(() => page.evaluate(() => [...document.querySelector('#host').shadowRoot.querySelectorAll('sl-copy-button'), document.querySelector('#c')].every(el => !el.isCopying))).toBe(true);
    }
    // s1 and s2 find the elements of their own tree (s2's "outer" is the shadow root's span, not the document's); s3 finds nothing and,
    // with no value, reports the error twice; the button in the document finds the document's span.
    expect(await page.evaluate(() => ({ copied: window.copied, events: window.events.map(e => e.type) }))).toEqual({
      copied: ['from the shadow root', 'shadow outer', 'from the document'], events: ['sl-copy', 'sl-copy', 'sl-error', 'sl-error', 'sl-copy'],
    });
  });

  test('feedback-duration: the length of time the feedback stays (default 1000 ms), read when a copy starts', async ({ page }) => {
    await openTop(page);
    await mount(page, '<sl-copy-button id="c" value="v" feedback-duration="1500"></sl-copy-button><sl-copy-button id="d" value="v"></sl-copy-button><sl-copy-button id="e" value="v" feedback-duration="1"></sl-copy-button>');
    const timing = await page.evaluate(async () => {
      const measure = async el => {
        const started = performance.now();
        el.shadowRoot.querySelector('button').click();
        await new Promise(resolve => {
          const tick = () => (el.isCopying ? setTimeout(tick, 10) : resolve());
          setTimeout(tick, 10);
        });
        return performance.now() - started;
      };
      // 100 ms out and 100 ms in on each side of the wait.
      return [await measure(document.querySelector('#c')), await measure(document.querySelector('#d')), await measure(document.querySelector('#e'))];
    });
    // The bounds are one-sided and far apart, so a slow machine cannot fail them: the wait is at least the duration plus the animations.
    expect(timing[0]).toBeGreaterThan(1500 + 300);
    expect(timing[1]).toBeGreaterThan(1000 + 300);
    expect(timing[2]).toBeLessThan(timing[0]);
  });

  test('hoist and tooltip-placement are passed to the tooltip; the tooltip\'s parts are exported as tooltip__*', async ({ page }) => {
    await openTop(page);
    await mount(page, '<sl-copy-button id="c" value="v" tooltip-placement="bottom" hoist></sl-copy-button>');
    await page.addStyleTag({ content: 'sl-copy-button::part(tooltip__body) { color: rgb(1, 2, 3); } sl-copy-button::part(tooltip__base) { outline-color: rgb(4, 5, 6); }' });
    const r = await page.locator('#c').evaluate(el => {
      const tooltip = el.shadowRoot.querySelector('sl-tooltip');
      const tipRoot = tooltip.shadowRoot;
      return {
        placement: [tooltip.placement, tooltip.getAttribute('placement')],
        hoist: [tooltip.hoist, tooltip.hasAttribute('hoist')],
        body: getComputedStyle(tipRoot.querySelector('[part~="body"]')).color,
        base: getComputedStyle(tipRoot.querySelector('[part~="base"]')).outlineColor,
      };
    });
    expect(r).toEqual({ placement: ['bottom', 'bottom'], hoist: [true, true], body: 'rgb(1, 2, 3)', base: 'rgb(4, 5, 6)' });
  });

  // What a probe element with the given declarations (written with the theme tokens) computes to, for the listed CSS properties.
  const probe = (page, declarations, properties) => page.evaluate(({ declarations, properties }) => {
    const p = document.createElement('div');
    p.style.cssText = declarations;
    document.body.append(p);
    const cs = getComputedStyle(p);
    const out = Object.fromEntries(properties.map(name => [name, cs.getPropertyValue(name)]));
    p.remove();
    return out;
  }, { declarations, properties });

  test('styles: the host is an inline-block, the button is a borderless flex item with the theme\'s radius, padding, color and transition', async ({ page }) => {
    await openTop(page);
    await mount(page, '<div style="font-size: 20px; color: rgb(10, 20, 30)"><sl-copy-button id="c" value="v"></sl-copy-button></div>');
    const r = await page.locator('#c').evaluate(el => {
      const button = el.shadowRoot.querySelector('button');
      const cs = getComputedStyle(button);
      const host = getComputedStyle(el);
      const slot = getComputedStyle(el.copyIcon);
      return {
        host: [host.display, host.boxSizing], flex: [cs.flexGrow, cs.flexShrink, cs.flexBasis], display: cs.display, alignItems: cs.alignItems,
        background: cs.backgroundColor, border: [cs.borderTopStyle, cs.borderTopWidth], radius: cs.borderTopLeftRadius, fontSize: cs.fontSize, color: cs.color,
        padding: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft], cursor: cs.cursor, transition: [cs.transitionProperty, cs.transitionDuration],
        boxSizing: cs.boxSizing, slot: [slot.display, slot.boxSizing],
      };
    });
    const radius = await probe(page, 'border-radius: var(--sl-border-radius-medium)', ['border-top-left-radius']);
    const padding = await probe(page, 'padding: var(--sl-spacing-x-small)', ['padding-top']);
    const transition = await probe(page, 'transition: var(--sl-transition-x-fast) color', ['transition-property', 'transition-duration']);
    expect(r).toEqual({
      host: ['inline-block', 'border-box'], flex: ['0', '0', 'auto'], display: 'flex', alignItems: 'center', background: 'rgba(0, 0, 0, 0)', border: ['none', '0px'],
      radius: radius['border-top-left-radius'], fontSize: '20px', color: 'rgb(10, 20, 30)', padding: Array(4).fill(padding['padding-top']), cursor: 'pointer',
      transition: [transition['transition-property'], transition['transition-duration']], boxSizing: 'border-box', slot: ['flex', 'border-box'],
    });
    // The values the tokens have in the light theme: 8px padding (x-small is 0.5rem), a 50 ms transition and a rounded corner.
    expect(padding['padding-top']).toBe('8px');
    expect(transition['transition-duration']).toBe('0.05s');
    expect(radius['border-top-left-radius']).not.toBe('0px');
  });

  test('styles: success and error colors are --success-color and --error-color (the theme\'s success and danger 600), and a custom property overrides them', async ({ page }) => {
    await openTop(page);
    await mount(page, '<sl-copy-button id="c" value="v" feedback-duration="1500"></sl-copy-button><sl-copy-button id="d" value="v" feedback-duration="1500" style="--success-color: rgb(1, 2, 3); --error-color: rgb(4, 5, 6)"></sl-copy-button>');
    const color = selector => page.locator(selector).evaluate(el => getComputedStyle(el.shadowRoot.querySelector('button')).color);
    const success = await probe(page, 'color: var(--sl-color-success-600)', ['color']);
    const danger = await probe(page, 'color: var(--sl-color-danger-600)', ['color']);
    expect(success.color).not.toBe(danger.color);
    for (const id of ['c', 'd']) {
      await page.locator(`#${id} button`).click();
      await expect.poll(() => page.locator(`#${id}`).evaluate(el => el.status)).toBe('success');
      // The color transition takes 50 ms; wait for it to end.
      await expect.poll(() => color(`#${id}`)).toBe(id === 'c' ? success.color : 'rgb(1, 2, 3)');
      await settled(page, `#${id}`);
      await page.locator(`#${id}`).evaluate(el => { el.value = ''; });
      await page.locator(`#${id} button`).click();
      await expect.poll(() => page.locator(`#${id}`).evaluate(el => el.status)).toBe('error');
      await expect.poll(() => color(`#${id}`)).toBe(id === 'c' ? danger.color : 'rgb(4, 5, 6)');
      await settled(page, `#${id}`);
    }
  });

  test('keyboard: the inner button is the one tab stop, Enter and Space copy, and the focus ring is the theme\'s focus ring', async ({ page }) => {
    const pageErrors = await openTop(page);
    await mount(page, '<button id="before">before</button><sl-copy-button id="c" value="v" feedback-duration="1"></sl-copy-button><button id="after">after</button>');
    const active = () => page.evaluate(() => {
      let el = document.activeElement;
      const path = [];
      while (el) {
        path.push(el.id || el.localName);
        el = el.shadowRoot?.activeElement ?? null;
      }
      return path.join('>');
    });
    await page.locator('#before').focus();
    await page.keyboard.press('Tab');
    await expect.poll(active).toBe('c>button');
    const ring = await page.locator('#c').evaluate(el => {
      const cs = getComputedStyle(el.shadowRoot.querySelector('button'));
      return [cs.outlineStyle, cs.outlineWidth, cs.outlineColor, cs.outlineOffset];
    });
    const want = await probe(page, 'outline: var(--sl-focus-ring); outline-offset: var(--sl-focus-ring-offset)', ['outline-style', 'outline-width', 'outline-color', 'outline-offset']);
    expect(ring).toEqual([want['outline-style'], want['outline-width'], want['outline-color'], want['outline-offset']]);
    expect(ring[0]).toBe('solid');
    await page.keyboard.press('Enter');
    await settled(page);
    expect((await copiedAndEvents(page)).copied).toEqual(['v']);
    await page.keyboard.press('Space');
    await settled(page);
    expect(await copiedAndEvents(page)).toEqual({ copied: ['v', 'v'], events: ['sl-copy', 'sl-copy'] });
    await page.keyboard.press('Tab');
    await expect.poll(active).toBe('after');
    await page.keyboard.press('Shift+Tab');
    await expect.poll(active).toBe('c>button');
    expect(pageErrors).toEqual([]);
  });

  test('accessibility tree (Playwright ARIA snapshot): a button with no accessible name, as in Shoelace; a disabled button is disabled', async ({ page }) => {
    await openTop(page);
    await mount(page, '<sl-copy-button id="c" value="v"></sl-copy-button><sl-copy-button id="d" value="v" disabled></sl-copy-button>');
    await expect(page.locator('#c')).toMatchAriaSnapshot('- button');
    await expect(page.locator('#d')).toMatchAriaSnapshot('- button [disabled]');
    expect(await page.getByRole('button', { name: /./ }).count()).toBe(0);
  });

  test('quirk: the hidden attribute does not hide the copy button, because the host\'s own display outranks it', async ({ page }) => {
    await openTop(page);
    await mount(page, '<sl-copy-button id="c" value="v" hidden></sl-copy-button>');
    const r = await page.locator('#c').evaluate(el => ({ display: getComputedStyle(el).display, width: el.getBoundingClientRect().width, hidden: el.hidden }));
    expect(r.display).toBe('inline-block');
    expect(r.width).toBeGreaterThan(0);
    expect(r.hidden).toBe(true);
    await expect(page.locator('#c button')).toBeVisible();
  });

  // Every recorded call of an icon slot's animate(), in order, with the registry's keyframes and options.
  const spyAnimations = page => page.evaluate(() => {
    window.animations = [];
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      const part = this.getAttribute('part');
      if (['copy-icon', 'success-icon', 'error-icon'].includes(part)) window.animations.push({ part, keyframes: JSON.parse(JSON.stringify(keyframes)), options: { ...options } });
      return animate.call(this, keyframes, options);
    };
  });

  test('animations: copy.out then copy.in with the registry defaults, the two slots in turn; the left-to-right keyframes are used even in a right-to-left page, and reduced motion is not honored', async ({ page }) => {
    const pageErrors = await openTop(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mount(page, '<sl-copy-button id="c" value="v" feedback-duration="1" dir="rtl"></sl-copy-button>');
    await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
    await spyAnimations(page);
    await page.locator('#c button').click();
    await settled(page);
    const out = { keyframes: [{ scale: '1', opacity: '1' }, { scale: '.25', opacity: '0' }], options: { duration: 100 } };
    const into = { keyframes: [{ scale: '.25', opacity: '.25' }, { scale: '1', opacity: '1' }], options: { duration: 100 } };
    expect(await page.evaluate(() => window.animations)).toEqual([
      { part: 'copy-icon', ...out }, { part: 'success-icon', ...into }, { part: 'success-icon', ...out }, { part: 'copy-icon', ...into },
    ]);
    expect(pageErrors).toEqual([]);
  });

  test('animations: setAnimation changes one element\'s copy.in and copy.out, and an error runs the same animations on the error slot', async ({ page }) => {
    const pageErrors = await openTop(page);
    await mount(page, '<sl-copy-button id="c" value="" feedback-duration="1"></sl-copy-button><sl-copy-button id="d" value="" feedback-duration="1"></sl-copy-button>');
    await page.evaluate(() => {
      const { setAnimation } = window.copyModules.registry;
      const el = document.querySelector('#c');
      setAnimation(el, 'copy.in', { keyframes: [{ opacity: 0.5 }, { opacity: 1 }], rtlKeyframes: [{ opacity: 0.9 }, { opacity: 1 }], options: { duration: 20 } });
      setAnimation(el, 'copy.out', { keyframes: [{ opacity: 1 }, { opacity: 0.4 }], rtlKeyframes: [{ opacity: 1 }, { opacity: 0.8 }], options: { duration: 30 } });
      // A right-to-left element and page still get the left-to-right keyframes.
      el.dir = 'rtl';
      document.documentElement.dir = 'rtl';
    });
    await spyAnimations(page);
    await page.locator('#c button').click();
    await settled(page);
    const first = await page.evaluate(() => window.animations);
    await page.evaluate(() => { window.animations = []; });
    await page.locator('#d button').click();
    await settled(page, '#d');
    const second = await page.evaluate(() => window.animations);
    expect(first.map(a => [a.part, a.keyframes[0].opacity ?? a.keyframes[0].scale, a.options.duration])).toEqual([
      ['copy-icon', 1, 30], ['error-icon', 0.5, 20], ['error-icon', 1, 30], ['copy-icon', 0.5, 20],
    ]);
    // The other element keeps the registry defaults.
    expect(second.map(a => [a.part, a.options.duration])).toEqual([['copy-icon', 100], ['error-icon', 100], ['error-icon', 100], ['copy-icon', 100]]);
    expect(pageErrors).toEqual([]);
  });
});

test.describe('class-only entry', () => {
  test('importing defines nothing; constructing a copy button defines Velcro\'s sl-icon and sl-tooltip, and the tooltip defines sl-popup', async ({ page }) => {
    const pageErrors = await loadBundle(page, CLASS_ENTRY);
    const r = await page.evaluate(async () => {
      const { SlCopyButton, VelcroCopyButton } = window.copyClass;
      const tags = () => ['sl-copy-button', 'sl-tooltip', 'sl-popup', 'sl-icon'].map(t => customElements.get(t)?.name ?? null);
      const afterImport = tags();
      customElements.define('sl-copy-button', SlCopyButton);
      const afterDefine = tags();
      const el = document.createElement('sl-copy-button');
      const afterCreate = tags();
      el.value = 'v';
      document.body.append(el);
      await el.updateComplete;
      await el.tooltip.updateComplete;
      const icon = el.shadowRoot.querySelector('sl-icon');
      await icon.updateComplete;
      return {
        afterImport, afterDefine, afterCreate, afterRender: tags(), alias: SlCopyButton === VelcroCopyButton,
        tooltip: el.tooltip instanceof customElements.get('sl-tooltip'),
      };
    });
    expect(r).toEqual({
      afterImport: [null, null, null, null], afterDefine: ['VelcroCopyButton', null, null, null], afterCreate: ['VelcroCopyButton', 'VelcroTooltip', null, 'VelcroIcon'],
      afterRender: ['VelcroCopyButton', 'VelcroTooltip', 'VelcroPopup', 'VelcroIcon'], alias: true, tooltip: true,
    });
    // The default copy icon is drawn from the system library once the icon has loaded it.
    await expect.poll(() => page.locator('sl-copy-button').evaluate(el => Boolean(el.shadowRoot.querySelector('sl-icon').shadowRoot?.querySelector('svg')))).toBe(true);
    expect(pageErrors).toEqual([]);
  });

  test('when the tooltip class is already defined under another tag, constructing a copy button defines sl-tooltip as a subclass of it', async ({ page }) => {
    const pageErrors = await loadBundle(page, CLASS_ENTRY);
    const r = await page.evaluate(async () => {
      const { SlCopyButton, SlTooltip } = window.copyClass;
      customElements.define('my-tooltip', SlTooltip);
      customElements.define('sl-copy-button', SlCopyButton);
      const el = document.createElement('sl-copy-button');
      el.value = 'v';
      document.body.append(el);
      await el.updateComplete;
      const defined = customElements.get('sl-tooltip');
      await el.tooltip.updateComplete;
      return {
        mine: customElements.get('my-tooltip') === SlTooltip, subclass: Boolean(defined) && defined !== SlTooltip && defined.prototype instanceof SlTooltip,
        tooltip: el.tooltip instanceof defined, content: el.tooltip.content,
      };
    });
    expect(r).toEqual({ mine: true, subclass: true, tooltip: true, content: 'Copy' });
    expect(pageErrors).toEqual([]);
  });

  test('an sl-tooltip another constructor already owns is left in place, without an error, and receives the copy button\'s properties', async ({ page }) => {
    const pageErrors = await loadBundle(page, CLASS_ENTRY);
    const r = await page.evaluate(async () => {
      class OtherTooltip extends HTMLElement {}
      customElements.define('sl-tooltip', OtherTooltip);
      customElements.define('sl-copy-button', window.copyClass.SlCopyButton);
      const el = document.createElement('sl-copy-button');
      el.value = 'v';
      el.tooltipPlacement = 'left';
      document.body.append(el);
      await el.updateComplete;
      const tooltip = el.shadowRoot.querySelector('sl-tooltip');
      return [customElements.get('sl-tooltip') === OtherTooltip, tooltip instanceof OtherTooltip, el.tooltip === tooltip, tooltip.getAttribute('content'), tooltip.getAttribute('placement')];
    });
    expect(r).toEqual([true, true, true, 'Copy', 'left']);
    expect(pageErrors).toEqual([]);
  });
});

test('a real click in the Default example copies the text; the page\'s writeText call is recorded in every engine, and in Chromium it reaches the real clipboard, which is read back', async ({ page, context, browserName }) => {
  if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const { frame } = await openPage(page);
  // Record the call and still forward it, so the real clipboard is written where the engine allows it.
  await frame.locator('body').evaluate((_body, forward) => {
    const original = navigator.clipboard.writeText.bind(navigator.clipboard);
    window.copied = [];
    window.events = [];
    navigator.clipboard.writeText = text => { window.copied.push(text); return forward ? original(text) : Promise.resolve(); };
    document.addEventListener('sl-copy', e => window.events.push(e.detail));
  }, browserName === 'chromium');
  await frame.locator('#demo-default button').click();
  await expect.poll(() => frame.locator('body').evaluate(() => window.events)).toEqual([{ value: 'Velcro rocks!' }]);
  expect(await frame.locator('body').evaluate(() => window.copied)).toEqual(['Velcro rocks!']);
  if (browserName === 'chromium') expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('Velcro rocks!');
});

test('the Copying Values From Other Elements example copies the span\'s text, the input\'s value and the link\'s href', async ({ page }) => {
  const { example } = await openPage(page);
  const frame = example('Copying Values From Other Elements');
  await expect(frame.locator('sl-copy-button').nth(2)).toBeVisible();
  await frame.locator('body').evaluate(async () => {
    await customElements.whenDefined('sl-input');
    await Promise.all([...document.querySelectorAll('sl-copy-button, sl-input')].map(el => el.updateComplete));
  });
  await stubClipboard(frame.locator('body'));
  for (const [i] of [0, 1, 2].entries()) {
    await frame.locator('sl-copy-button').nth(i).locator('button').click();
    await expect.poll(() => frame.locator('sl-copy-button').nth(i).evaluate(el => el.isCopying), { timeout: 15000 }).toBe(false);
  }
  expect(await frame.locator('body').evaluate(() => window.copied)).toEqual(['+1 (234) 456-7890', 'User input', 'https://example.com/']);
});

test('the Handling Errors example reports an error and the Disabled example copies nothing', async ({ page }) => {
  const { example } = await openPage(page);
  const errors = example('Handling Errors');
  await expect(errors.locator('sl-copy-button')).toBeVisible();
  await stubClipboard(errors.locator('body'));
  await recordEvents(errors.locator('body'));
  await errors.locator('sl-copy-button button').click();
  await expect.poll(() => errors.locator('sl-copy-button').evaluate(el => el.status)).toBe('error');
  // No id and no value: the error is reported twice (see the quirk on the page).
  expect(await errors.locator('body').evaluate(() => [window.copied, window.events.map(e => e.type)])).toEqual([[], ['sl-error', 'sl-error']]);
  const disabled = example('Disabled');
  await expect(disabled.locator('sl-copy-button')).toBeVisible();
  await stubClipboard(disabled.locator('body'));
  await recordEvents(disabled.locator('body'));
  await disabled.locator('sl-copy-button').click({ force: true });
  expect(await disabled.locator('body').evaluate(() => [window.copied, window.events.length])).toEqual([[], 0]);
  expect(await disabled.locator('sl-copy-button').evaluate(el => [el.disabled, el.hasAttribute('disabled')])).toEqual([true, true]);
});

test('the Custom Styles example styles the button part: its background, border and radius come from the page\'s rules', async ({ page }) => {
  const { example } = await openPage(page);
  const frame = example('Custom Styles');
  await expect(frame.locator('sl-copy-button')).toBeVisible();
  const r = await frame.locator('sl-copy-button').evaluate(el => {
    const cs = getComputedStyle(el.shadowRoot.querySelector('button'));
    return { background: cs.backgroundColor, border: [cs.borderTopWidth, cs.borderTopColor, cs.borderRightColor], radius: cs.borderTopLeftRadius, color: cs.color };
  });
  expect(r).toEqual({ background: 'rgb(255, 20, 147)', border: ['4px', 'rgb(255, 122, 193)', 'rgb(173, 0, 92)'], radius: '0px', color: 'rgb(255, 255, 255)' });
});

// Shoelace's React examples, ported in packages/docs/examples/copy-button/react/*.jsx (the files the docs page shows), bundled
// with React 19 and the generated wrappers, which are resolved through the package's real export map.
test.describe('React examples', () => {
  let bundle;

  test.beforeAll(async () => {
    const fromVelcro = createRequire(path.join(velcroDir, 'package.json'));
    const fromDocs = createRequire(path.join(docsDir, 'package.json'));
    const pkgDir = name => path.dirname(fromVelcro.resolve(`${name}/package.json`));
    const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
    const dir = mkdtempSync(path.join(tmpdir(), 'velcro-copy-button-react-'));
    try {
      // Each example declares `App` without exporting it (as on Shoelace's page); the copies only append the export.
      for (const name of FILES) {
        writeFileSync(path.join(dir, `${name}.jsx`), `${readFileSync(path.join(docsDir, `examples/copy-button/react/${name}.jsx`), 'utf8')}\nexport default App;\n`);
      }
      const entry = path.join(dir, 'entry.js');
      writeFileSync(entry, `
        import React from 'react';
        import { flushSync } from 'react-dom';
        import { createRoot } from 'react-dom/client';
        ${FILES.map((n, i) => `import App${i} from './${n}.jsx';`).join('\n')}
        const apps = { ${FILES.map((n, i) => `'${n}': App${i}`).join(', ')} };
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

  test('render the same copy buttons as the HTML examples, through the generated wrappers, with the theme tokens applied', async ({ page }) => {
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
        await customElements.whenDefined('sl-copy-button');
        const buttons = [...document.querySelectorAll(`#${name} sl-copy-button`)];
        await Promise.all(buttons.map(b => b.updateComplete));
        out[name] = buttons.map(b => ({
          value: b.value, from: b.from, disabled: b.disabled, labels: [b.copyLabel, b.successLabel, b.errorLabel], duration: b.feedbackDuration,
          slotted: [...b.children].map(c => `${c.localName}:${c.getAttribute('slot')}:${c.name ?? c.getAttribute('name')}`), tip: b.tooltip.content, box: b.getBoundingClientRect().width > 0,
        }));
      }
      const input = document.querySelector('#from sl-input');
      await customElements.whenDefined('sl-input');
      await input.updateComplete;
      const styled = document.querySelector('#custom-styles sl-copy-button');
      const cs = getComputedStyle(styled.shadowRoot.querySelector('button'));
      return { out, input: [input.id, input.value], styled: [styled.className, cs.backgroundColor, cs.borderTopWidth], styles: document.querySelectorAll('#custom-styles style').length, errors: window.errors };
    }, FILES);
    const blank = { value: '', from: '', disabled: false, labels: ['', '', ''], duration: 1000, slotted: [], box: true };
    expect(r.out).toEqual({
      basic: [{ ...blank, value: 'Velcro rocks!', tip: 'Copy' }],
      'custom-labels': [{ ...blank, value: 'Custom labels are easy', labels: ['Click to copy', 'You did it!', 'Whoops, your browser doesn\'t support this!'], tip: 'Click to copy' }],
      'custom-icons': [{ ...blank, value: 'Copied from a custom button', tip: 'Copy', slotted: ['sl-icon:copy-icon:clipboard', 'sl-icon:success-icon:clipboard-check', 'sl-icon:error-icon:clipboard-x'] }],
      from: ['my-phone', 'my-input.value', 'my-link[href]'].map(from => ({ ...blank, from, tip: 'Copy' })),
      errors: [{ ...blank, from: 'i-do-not-exist', tip: 'Copy' }],
      disabled: [{ ...blank, value: 'You can\'t copy me', disabled: true, tip: 'Copy' }],
      'feedback-duration': [{ ...blank, value: 'Velcro rocks!', duration: 250, tip: 'Copy' }],
      'custom-styles': [{ ...blank, value: 'I\'m so stylish', tip: 'Copy' }],
    });
    expect(r.input).toEqual(['my-input', 'User input']);
    expect(r.styled).toEqual(['custom-styles', 'rgb(255, 20, 147)', '4px']);
    expect(r.styles).toBe(1);
    expect(r.errors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});

test.describe('React wrapper', () => {
  const mountWrapper = reactWrapperPage(test);

  test('passes Shoelace\'s props and calls onSlCopy and onSlError', async ({ page }) => {
    const errors = await mountWrapper(page);
    await stubClipboard(page);
    const r = await page.evaluate(async () => {
      const seen = [];
      window.renderWrapper('VelcroCopyButton', {
        value: 'Wrapped', copyLabel: 'Take it', successLabel: 'Taken', errorLabel: 'Nope', feedbackDuration: 20, tooltipPlacement: 'left', hoist: true,
        onSlCopy: e => seen.push([e.type, e.detail.value]), onSlError: e => seen.push([e.type]),
      });
      const el = document.querySelector('#wrapped');
      await customElements.whenDefined('sl-copy-button');
      await el.updateComplete;
      const props = [el.value, el.copyLabel, el.successLabel, el.errorLabel, el.feedbackDuration, el.tooltipPlacement, el.hoist, el.tooltip.content];
      el.shadowRoot.querySelector('button').click();
      await new Promise(resolve => { const tick = () => (el.isCopying ? setTimeout(tick, 10) : resolve()); setTimeout(tick, 10); });
      el.value = '';
      el.shadowRoot.querySelector('button').click();
      await new Promise(resolve => { const tick = () => (el.isCopying ? setTimeout(tick, 10) : resolve()); setTimeout(tick, 10); });
      return { props, seen, copied: window.copied };
    });
    expect(r.props).toEqual(['Wrapped', 'Take it', 'Taken', 'Nope', 20, 'left', true, 'Take it']);
    expect(r.seen).toEqual([['sl-copy', 'Wrapped'], ['sl-error']]);
    expect(r.copied).toEqual(['Wrapped']);
    expect(errors).toEqual([]);
  });
});
