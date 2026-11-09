import { readdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { bundleExamples, docsDir, loadBundle, loadExamples } from './support/bundle.mjs';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';
import { reactWrapperPage } from './support/react.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/menu-item';
// Shoelace 2.20.1's menu item page has six examples, in this order; every one is live and has a React version.
const ORDER = [
  ['basic', 'Default'], ['prefix-suffix', 'Prefix & Suffix'], ['disabled', 'Disabled'], ['loading', 'Loading'],
  ['checkbox', 'Checkbox Menu Items'], ['value-selection', 'Value & Selection'],
];
const title = section => `Menu Item example: ${section}`;

async function openExample(page, section = 'Default') {
  const requests = [];
  const logs = [];
  page.on('request', request => requests.push(request.url()));
  page.on('console', message => logs.push(message.text()));
  await openDocs(page, PAGE);
  const frame = page.frameLocator(`iframe.example[title="${title(section)}"]`);
  await expect(frame.locator('sl-menu-item').first()).toBeVisible();
  await frame.locator('body').evaluate(async () => {
    await Promise.all(['sl-menu', 'sl-menu-item', 'sl-divider', 'sl-icon'].map(t => customElements.whenDefined(t)));
    await Promise.all([...document.querySelectorAll('sl-menu, sl-menu-item')].map(el => el.updateComplete));
  });
  await documentsLoaded(page);
  return { frame, requests, logs };
}

const ENTRY = `
  import '@charm-ux/velcro/menu';
  import '@charm-ux/velcro/menu-item';
  import '@charm-ux/velcro/divider';
  window.loaded = true;
`;
const CLASS_ENTRY = `
  import { SlMenuItem, VelcroMenuItem } from '@charm-ux/velcro/menu-item/class';
  window.menuItemClass = { SlMenuItem, VelcroMenuItem };
  window.loaded = true;
`;

const CLASS_ENTRY_WITH_ICON = `
  import { SlMenuItem } from '@charm-ux/velcro/menu-item/class';
  import { VelcroIcon } from '@charm-ux/velcro/icon/class';
  window.menuItemClass = { SlMenuItem };
  window.iconClass = { VelcroIcon };
  window.loaded = true;
`;

// Replaces the document with a menu (id m), waits for it and its items to render, and records every sl-select on it.
async function mount(page, markup, attrs = '') {
  await page.evaluate(async ([markup, attrs]) => {
    document.body.innerHTML = `<button id="before">before</button><sl-menu id="m" ${attrs}>${markup}</sl-menu><button id="after">after</button>`;
    const menu = document.querySelector('#m');
    await Promise.all([...document.querySelectorAll('sl-menu, sl-menu-item')].map(el => el.updateComplete));
    await new Promise(r => setTimeout(r, 50));
    window.selects = [];
    menu.addEventListener('sl-select', e => window.selects.push(e.detail.item.value));
  }, [markup, attrs]);
}

const SUBMENU = `
  <sl-menu-item value="plain">Plain</sl-menu-item>
  <sl-menu-item value="parent" id="parent">Parent
    <sl-menu slot="submenu" id="inner"><sl-menu-item value="child-1">Child 1</sl-menu-item><sl-menu-item value="child-2">Child 2</sl-menu-item></sl-menu>
  </sl-menu-item>
  <sl-menu-item value="other">Other</sl-menu-item>`;
const open = page => page.locator('#parent').evaluate(el => el.shadowRoot.querySelector('sl-popup')?.active ?? null);
const focused = page => page.evaluate(() => document.activeElement?.value ?? document.activeElement?.id ?? document.activeElement?.localName);

test('docs page is prerendered with Velcro branding, prototype status, every Shoelace section in order, the keyboard, the quirks and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Menu Item - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('the safe triangle has a vertex at the top-left corner of the viewport');
  expect(html).toContain('Not implemented or unverified');
  // The part's description says "not yet implemented" as Shoelace's does, although the chevron is rendered (a listed quirk).
  expect(html).toContain('The submenu icon, visible only when the menu item has a submenu (not yet implemented)');
  expect(html).toContain('without changing the shared core prefix');
  expect(html).toContain('id="keyboard"');
  expect(html).toContain('A loading item still emits click');
  expect(html).toContain('was run locally in Chromium and WebKit only, and Firefox is covered only by the project&#39;s CI run');
  expect(html).toContain('Playwright&#39;s ARIA snapshot');
  const positions = ORDER.map(([, section]) => html.indexOf(`title="${title(section).replace('&', '&amp;')}"`));
  expect(positions.every(p => p > 0)).toBe(true);
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  for (const name of ['checked', 'disabled', 'loading', 'type', 'value']) expect(html).toContain(`data-name="${name}"`);
  for (const name of ['base', 'checked-icon', 'prefix', 'label', 'suffix', 'spinner', 'spinner__base', 'submenu-icon']) expect(html).toContain(`data-name="${name}"`);
  expect(html).toContain('data-name="--submenu-offset"');
  expect(html).toContain('Inherited from core');
  expect(html).toContain('<summary>React</summary>');
  expect(html).toContain('import { VelcroMenuItem as SlMenuItem } from &#39;@charm-ux/velcro/react/VelcroMenuItem.js&#39;;');
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(await (await request.get('/')).text()).toContain('/components/menu-item');
});

test('the examples render in their own documents in Shoelace\'s order, with a React version each; no Shoelace runtime is requested', async ({ page }) => {
  const { requests } = await openExample(page);
  const titles = await page.locator('iframe.example').evaluateAll(frames => frames.map(f => f.title));
  expect(titles).toEqual(ORDER.map(([, section]) => title(section)));
  const counts = [];
  for (const [, section] of ORDER) counts.push(await page.frameLocator(`iframe.example[title="${title(section)}"]`).locator('sl-menu-item').count());
  expect(counts).toEqual([7, 3, 3, 3, 3, 6]);
  const files = dir => readdirSync(path.join(docsDir, 'examples/menu-item', dir)).filter(f => /\.(html|jsx)$/.test(f)).sort();
  expect(files('')).toEqual(ORDER.map(([id]) => `${id}.html`).sort());
  expect(files('react')).toEqual(ORDER.map(([id]) => `${id}.jsx`).sort());
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
});

test('sl-menu-item registers as the exported class, with sl-icon, sl-popup and sl-spinner, no core marker and no ch-* definitions', async ({ page }) => {
  const { frame } = await openExample(page);
  const info = await frame.locator('sl-menu-item').first().evaluate(el => {
    const ctor = customElements.get('sl-menu-item');
    return {
      baseName: ctor.baseName, instance: el instanceof ctor, viaConstructor: new ctor().localName,
      deps: ['sl-icon', 'sl-popup', 'sl-spinner'].map(t => customElements.get(t)?.baseName ?? null),
      chDefined: ['ch-menu-item', 'ch-icon', 'ch-popup'].filter(t => customElements.get(t)),
      attrs: el.getAttributeNames().sort(), observed: [...ctor.observedAttributes].sort(),
    };
  });
  expect(info).toEqual({
    baseName: 'menu-item', instance: true, viaConstructor: 'sl-menu-item', deps: ['icon', 'popup', 'spinner'], chDefined: [],
    attrs: ['aria-disabled', 'role', 'tabindex'], observed: ['checked', 'dir', 'disabled', 'lang', 'loading', 'type', 'value'],
  });
});

test('class-only entry: importing defines nothing; constructing a menu item defines Velcro\'s sl-icon, sl-popup and sl-spinner, but not sl-menu', async ({ page }) => {
  const pageErrors = await loadBundle(page, CLASS_ENTRY);
  const r = await page.evaluate(() => {
    const { SlMenuItem, VelcroMenuItem } = window.menuItemClass;
    const tags = () => ['sl-menu-item', 'sl-icon', 'sl-popup', 'sl-spinner', 'sl-menu'].map(t => customElements.get(t)?.name ?? null);
    const afterImport = tags();
    customElements.define('sl-menu-item', SlMenuItem);
    document.body.append(document.createElement('sl-menu-item'));
    return { afterImport, afterConstruct: tags(), alias: SlMenuItem === VelcroMenuItem };
  });
  expect(r).toEqual({
    afterImport: [null, null, null, null, null],
    afterConstruct: ['VelcroMenuItem', 'VelcroIcon', 'VelcroPopup', 'VelcroSpinner', null],
    alias: true,
  });
  expect(pageErrors).toEqual([]);
});

// The constructor's dependency handling, through the class-only entry (the registering entry's own clash cases are in
// registration-clash.spec.mjs).
test('class-only entry: a dependency tag owned by another constructor is left alone when an item is constructed, and existing items upgrade', async ({ page }) => {
  const pageErrors = await loadBundle(page, CLASS_ENTRY, {
    beforeScript: () => {
      class OtherIcon extends HTMLElement {}
      customElements.define('sl-icon', OtherIcon);
      window.OtherIcon = OtherIcon;
      // An item that exists before the class is defined is upgraded by the definition itself.
      document.body.innerHTML = '<sl-menu-item id="early" type="checkbox" checked>Early</sl-menu-item>';
    },
  });
  const r = await page.evaluate(async () => {
    customElements.define('sl-menu-item', window.menuItemClass.SlMenuItem);
    const early = document.getElementById('early');
    await early.updateComplete;
    const late = document.createElement('sl-menu-item');
    document.body.append(late);
    await late.updateComplete;
    const name = tag => customElements.get(tag)?.name ?? null;
    return {
      iconIsOther: customElements.get('sl-icon') === window.OtherIcon,
      tags: ['sl-menu-item', 'sl-popup', 'sl-spinner'].map(name),
      earlyChecked: early.checked, earlyAria: early.getAttribute('aria-checked'),
      checkIcon: early.shadowRoot.querySelector('[part="checked-icon"] sl-icon') instanceof window.OtherIcon,
      lateRole: late.getAttribute('role'),
    };
  });
  expect(r).toEqual({
    iconIsOther: true, tags: ['VelcroMenuItem', 'VelcroPopup', 'VelcroSpinner'], earlyChecked: true, earlyAria: 'true', checkIcon: true, lateRole: 'menuitem',
  });
  expect(pageErrors).toEqual([]);
});

test('class-only entry: a dependency class already registered under another tag gets an anonymous subclass under the dependency tag when an item is constructed', async ({ page }) => {
  const pageErrors = await loadBundle(page, CLASS_ENTRY_WITH_ICON);
  const r = await page.evaluate(async () => {
    const { VelcroIcon } = window.iconClass;
    customElements.define('alt-icon', VelcroIcon);
    customElements.define('sl-menu-item', window.menuItemClass.SlMenuItem);
    const item = document.createElement('sl-menu-item');
    item.type = 'checkbox';
    item.checked = true;
    document.body.append(item);
    await item.updateComplete;
    const icon = customElements.get('sl-icon');
    return {
      altStillOwns: customElements.get('alt-icon') === VelcroIcon,
      subclass: [icon !== VelcroIcon, Object.getPrototypeOf(icon) === VelcroIcon, icon.baseName],
      popup: customElements.get('sl-popup')?.name, spinner: customElements.get('sl-spinner')?.name,
      rendered: item.shadowRoot.querySelector('[part="checked-icon"] sl-icon') instanceof icon,
    };
  });
  expect(r).toEqual({ altStillOwns: true, subclass: [true, true, 'icon'], popup: 'VelcroPopup', spinner: 'VelcroSpinner', rendered: true });
  expect(pageErrors).toEqual([]);
});

test('defaults: value "", not disabled or loading, role menuitem, aria-disabled "false", no aria-checked, no tabindex of its own, and Shoelace\'s structure and parts', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('sl-menu-item').first().evaluate(el => {
    const root = el.shadowRoot;
    const outline = node => [node.localName, node.getAttribute('part'), node.getAttribute('name'), [...node.children].map(outline)];
    const base = root.querySelector('[part="base"]');
    return {
      props: [el.type, el.checked, el.value, el.loading, el.disabled, el.dir, el.lang],
      attrs: el.getAttributeNames().sort(),
      aria: [el.getAttribute('role'), el.getAttribute('aria-disabled'), el.getAttribute('aria-checked')],
      outline: outline(base),
      baseId: base.id, baseClass: base.className.trim().split(/\s+/).sort(),
      check: (({ name, library, ariaHidden }) => ({ name, library, ariaHidden }))({
        name: root.querySelector('[part="checked-icon"] sl-icon').getAttribute('name'), library: root.querySelector('[part="checked-icon"] sl-icon').getAttribute('library'),
        ariaHidden: root.querySelector('[part="checked-icon"] sl-icon').getAttribute('aria-hidden'),
      }),
      chevron: root.querySelector('[part="submenu-icon"] sl-icon').getAttribute('name'),
      popup: root.querySelector('sl-popup'), submenuSlotHidden: root.querySelector('slot[name="submenu"]').hidden,
      spinner: root.querySelector('sl-spinner'),
      display: getComputedStyle(el).display, tabIndex: el.getAttribute('tabindex'),
    };
  });
  expect(r.props).toEqual(['normal', false, '', false, false, undefined, undefined]);
  expect(r.aria).toEqual(['menuitem', 'false', null]);
  expect(r.attrs).toEqual(['aria-disabled', 'role', 'tabindex']);
  expect(r.tabIndex).toBe('0');
  expect(r.outline).toEqual(['div', 'base', null, [
    ['span', 'checked-icon', null, [['sl-icon', null, 'check', []]]],
    ['slot', 'prefix', 'prefix', []],
    ['slot', 'label', null, []],
    ['slot', 'suffix', 'suffix', []],
    ['span', 'submenu-icon', null, [['sl-icon', null, 'chevron-right', []]]],
    ['slot', null, 'submenu', []],
  ]]);
  expect(r.baseId).toBe('anchor');
  expect(r.baseClass).toEqual(['menu-item']);
  expect(r.check).toEqual({ name: 'check', library: 'system', ariaHidden: 'true' });
  expect(r.chevron).toBe('chevron-right');
  expect(r.popup).toBeNull();
  expect(r.submenuSlotHidden).toBe(true);
  expect(r.spinner).toBeNull();
  expect(r.display).toBe('block');
});

test('type, checked and disabled drive role, aria-checked and aria-disabled, and the check mark is shown only when checked', async ({ page }) => {
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await loadBundle(page, ENTRY);
  await mount(page, `<sl-menu-item id="a" type="checkbox" checked>A</sl-menu-item><sl-menu-item id="b" type="checkbox">B</sl-menu-item><sl-menu-item id="c" disabled>C</sl-menu-item>`);
  const state = id => page.locator(`#${id}`).evaluate(el => ({
    role: el.getAttribute('role'), checked: el.getAttribute('aria-checked'), disabled: el.getAttribute('aria-disabled'),
    check: getComputedStyle(el.shadowRoot.querySelector('.menu-item__check')).visibility, cls: el.shadowRoot.querySelector('.menu-item').classList.contains('menu-item--checked'),
  }));
  expect(await state('a')).toEqual({ role: 'menuitemcheckbox', checked: 'true', disabled: 'false', check: 'visible', cls: true });
  expect(await state('b')).toEqual({ role: 'menuitemcheckbox', checked: 'false', disabled: 'false', check: 'hidden', cls: false });
  expect(await state('c')).toEqual({ role: 'menuitem', checked: null, disabled: 'true', check: 'hidden', cls: false });
  const after = await page.evaluate(async () => {
    const [a, b, c] = ['a', 'b', 'c'].map(id => document.getElementById(id));
    b.checked = true;
    a.type = 'normal';
    c.disabled = false;
    await Promise.all([a, b, c].map(i => i.updateComplete));
    return { a: [a.getAttribute('role'), a.getAttribute('aria-checked'), a.checked], b: [b.getAttribute('aria-checked'), b.hasAttribute('checked')], c: c.getAttribute('aria-disabled') };
  });
  // Upstream quirk: changing the type of a checked item to normal drops aria-checked but leaves checked set (no reset, no error);
  // the item is still drawn checked.
  expect(after).toEqual({ a: ['menuitem', null, true], b: ['true', true], c: 'false' });
  expect(await page.locator('#a').evaluate(el => el.shadowRoot.querySelector('.menu-item').classList.contains('menu-item--checked'))).toBe(true);
  expect(errors.filter(e => e.includes('type="checkbox"'))).toEqual([]);
});

test('upstream quirk: checked on an item that is not a checkbox is reset to false and logged with console.error, before the first render too', async ({ page }) => {
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await loadBundle(page, ENTRY);
  const r = await page.evaluate(async () => {
    const el = document.createElement('sl-menu-item');
    el.setAttribute('checked', '');
    document.body.append(el);
    await el.updateComplete;
    const fromAttribute = [el.checked, el.hasAttribute('checked'), el.getAttribute('aria-checked'), el.getAttribute('role')];
    el.checked = true;
    await el.updateComplete;
    return { fromAttribute, afterProperty: [el.checked, el.hasAttribute('checked')] };
  });
  expect(r).toEqual({ fromAttribute: [false, false, null, 'menuitem'], afterProperty: [false, false] });
  expect(errors.filter(e => e.includes('type="checkbox"')).length).toBe(2);
});

test('reflected properties: checked, loading and disabled reflect, and removing the attribute sets the property to false; type and value do not reflect', async ({ page }) => {
  await loadBundle(page, ENTRY);
  const r = await page.evaluate(async () => {
    const el = document.createElement('sl-menu-item');
    document.body.append(el);
    await el.updateComplete;
    el.type = 'checkbox';
    el.value = 'v';
    el.checked = true;
    el.loading = true;
    el.disabled = true;
    await el.updateComplete;
    const reflected = ['type', 'value', 'checked', 'loading', 'disabled'].map(a => el.getAttribute(a));
    for (const a of ['checked', 'loading', 'disabled']) el.removeAttribute(a);
    await el.updateComplete;
    return { reflected, restored: [el.checked, el.loading, el.disabled, el.getAttribute('aria-disabled'), el.getAttribute('aria-checked')] };
  });
  expect(r.reflected).toEqual([null, null, '', '', '']);
  expect(r.restored).toEqual([false, false, false, 'false', 'false']);
});

test('loading renders the spinner with its part and the base part re-exported, dims the content and shows the wait cursor; a loading item still emits click and sl-select (upstream quirk)', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, `<sl-menu-item value="x">X</sl-menu-item><sl-menu-item id="l" value="l" loading>Loading</sl-menu-item>`);
  const r = await page.locator('#l').evaluate(el => {
    const spinner = el.shadowRoot.querySelector('sl-spinner');
    return {
      part: spinner.getAttribute('part'), exportparts: spinner.getAttribute('exportparts'), cursor: getComputedStyle(el.shadowRoot.querySelector('.menu-item')).cursor,
      labelOpacity: getComputedStyle(el.shadowRoot.querySelector('.menu-item__label')).opacity, spinnerOpacity: getComputedStyle(spinner).opacity,
    };
  });
  expect(r).toEqual({ part: 'spinner', exportparts: 'base:spinner__base', cursor: 'wait', labelOpacity: '0.5', spinnerOpacity: '1' });
  await page.evaluate(() => { window.clicks = 0; document.querySelector('#l').addEventListener('click', () => window.clicks++); });
  await page.locator('#l').click();
  expect(await page.evaluate(() => [window.clicks, window.selects])).toEqual([1, ['l']]);
});

test('a disabled item suppresses its clicks (listeners added later on it are not called either) and is dimmed with the not-allowed cursor', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, `<sl-menu-item id="d" value="d" disabled>D</sl-menu-item><sl-menu-item id="e" value="e">E</sl-menu-item>`);
  const style = await page.locator('#d').evaluate(el => {
    const cs = getComputedStyle(el.shadowRoot.querySelector('.menu-item'));
    return { opacity: cs.opacity, cursor: cs.cursor };
  });
  expect(style).toEqual({ opacity: '0.5', cursor: 'not-allowed' });
  await page.evaluate(() => {
    window.clicks = [];
    for (const id of ['d', 'e']) document.getElementById(id).addEventListener('click', () => window.clicks.push(id));
  });
  await page.locator('#d').click({ force: true });
  await page.evaluate(() => document.getElementById('d').click());
  await page.locator('#e').click();
  expect(await page.evaluate(() => [window.clicks, window.selects])).toEqual([['e'], ['e']]);
  // Removing disabled makes it selectable again.
  await page.evaluate(() => { document.getElementById('d').disabled = false; });
  await page.locator('#d').click();
  expect(await page.evaluate(() => window.selects)).toEqual(['e', 'd']);
});

test('getTextLabel returns the text nodes of the default slot only; a change of the label emits a bubbling, non-composed slotchange from the item, the first label does not', async ({ page }) => {
  await loadBundle(page, ENTRY);
  const r = await page.evaluate(async () => {
    document.body.innerHTML = '<sl-menu id="m"><sl-menu-item id="t">Text</sl-menu-item><sl-menu-item id="w"><span>Wrapped</span></sl-menu-item><sl-menu-item id="s">  spaced  </sl-menu-item></sl-menu>';
    const [t, w, s] = ['t', 'w', 's'].map(id => document.getElementById(id));
    await Promise.all([t, w, s].map(i => i.updateComplete));
    await new Promise(r => setTimeout(r, 50));
    const events = [];
    for (const el of [t, w]) el.addEventListener('slotchange', e => events.push([el.id, e.bubbles, e.composed, e.cancelable, e.target === el]));
    const outer = [];
    document.getElementById('m').addEventListener('slotchange', e => outer.push(e.target.id || e.target.localName));
    const labels = [t.getTextLabel(), w.getTextLabel(), s.getTextLabel()];
    t.textContent = 'New text';
    w.querySelector('span').textContent = 'Changed in an element';
    await new Promise(r => setTimeout(r, 100));
    return { labels, events, outer, after: t.getTextLabel() };
  });
  expect(r.labels).toEqual(['Text', '', '  spaced  ']);
  expect(r.after).toBe('New text');
  // Only the text change is a label change; the element's inner text is not counted.
  expect(r.events).toEqual([['t', true, false, false, true]]);
  expect(r.outer).toContain('t');
});

test('hovering an item focuses it and the mouseover does not propagate; an inert item is not displayed', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, `<sl-menu-item value="a">A</sl-menu-item><sl-menu-item value="b">B</sl-menu-item><sl-menu-item value="hidden" inert>Hidden</sl-menu-item>`);
  await page.evaluate(() => { window.over = []; document.body.addEventListener('mouseover', e => window.over.push(e.target.localName)); });
  await page.locator('#m sl-menu-item[value="b"]').hover();
  expect(await focused(page)).toBe('b');
  expect(await page.evaluate(() => window.over)).toEqual([]);
  await page.locator('#m sl-menu-item[value="a"]').hover();
  expect(await focused(page)).toBe('a');
  expect(await page.locator('#m sl-menu-item[value="hidden"]').evaluate(el => getComputedStyle(el).display)).toBe('none');
});

test('prefix and suffix content sit around the label with the spacing of Shoelace\'s styles; the prefix, label and suffix are laid out in a row', async ({ page }) => {
  const { frame } = await openExample(page, 'Prefix & Suffix');
  const r = await frame.locator('sl-menu-item').nth(1).evaluate(el => {
    const root = el.shadowRoot;
    const rect = sel => root.querySelector(sel).getBoundingClientRect();
    const prefix = el.querySelector('[slot="prefix"]').getBoundingClientRect();
    const suffix = el.querySelector('[slot="suffix"]').getBoundingClientRect();
    return {
      prefixAssigned: root.querySelector('slot[name="prefix"]').assignedElements().map(e => e.localName),
      suffixAssigned: root.querySelector('slot[name="suffix"]').assignedElements().map(e => e.localName),
      order: [prefix.left < rect('.menu-item__label').left, rect('.menu-item__label').right <= suffix.left],
      prefixMargin: getComputedStyle(el.querySelector('[slot="prefix"]')).marginInlineEnd,
      suffixMargin: getComputedStyle(el.querySelector('[slot="suffix"]')).marginInlineStart,
    };
  });
  expect(r).toEqual({ prefixAssigned: ['sl-icon'], suffixAssigned: ['sl-badge'], order: [true, true], prefixMargin: '8px', suffixMargin: '8px' });
});

// Playwright's ARIA snapshot is computed by Playwright from the DOM, not read from the browser's native accessibility tree.
test('accessibility tree (Playwright ARIA snapshot): the default example\'s menu items, checkbox and disabled item', async ({ page }) => {
  const { frame } = await openExample(page);
  await expect(frame.locator('sl-menu')).toMatchAriaSnapshot(`
    - menu:
      - menuitem "Option 1"
      - menuitem "Option 2"
      - menuitem "Option 3"
      - separator
      - menuitemcheckbox "Checkbox" [checked]
      - menuitem "Disabled" [disabled]
      - separator
      - menuitem "Prefix Icon"
      - menuitem "Suffix Icon"
  `);
});

test('submenus: the slot="submenu" popup is rendered, aria-haspopup and aria-expanded follow it, the chevron shows, and hovering the parent opens it after a short delay', async ({ page }) => {
  const pageErrors = await loadBundle(page, ENTRY);
  // The menu is narrow so that the submenu has room on the right and is not flipped to the left.
  await mount(page, SUBMENU, 'style="max-width: 200px"');
  const r = await page.evaluate(() => {
    const el = document.getElementById('parent');
    const base = el.shadowRoot.querySelector('.menu-item');
    return {
      popup: Boolean(el.shadowRoot.querySelector('sl-popup')), hidden: el.shadowRoot.querySelector('slot[name="submenu"]').hidden,
      haspopup: base.getAttribute('aria-haspopup'), expanded: base.getAttribute('aria-expanded'), isSubmenu: el.isSubmenu(),
      plain: document.querySelector('[value="plain"]').isSubmenu(), chevron: getComputedStyle(el.shadowRoot.querySelector('.menu-item__chevron')).visibility,
      plainChevron: getComputedStyle(document.querySelector('[value="plain"]').shadowRoot.querySelector('.menu-item__chevron')).visibility,
      placement: el.shadowRoot.querySelector('sl-popup').placement, strategy: el.shadowRoot.querySelector('sl-popup').strategy,
    };
  });
  expect(r).toEqual({ popup: true, hidden: false, haspopup: '', expanded: null, isSubmenu: true, plain: false, chevron: 'visible', plainChevron: 'hidden', placement: 'right-start', strategy: 'fixed' });
  expect(await open(page)).toBe(false);
  // The 100 ms delay, checked without a race: the mouseover is dispatched and the state read in the same browser task, so the
  // item's timer cannot have fired yet whatever the machine's load; then the state is polled until the timer opens it.
  const sameTask = await page.evaluate(() => {
    const popup = document.getElementById('parent').shadowRoot.querySelector('sl-popup');
    document.getElementById('parent').dispatchEvent(new MouseEvent('mouseover', { bubbles: true, composed: true }));
    return popup.active;
  });
  expect(sameTask).toBe(false);
  await expect.poll(() => open(page)).toBe(true);
  await page.locator('#after').focus();
  await expect.poll(() => open(page)).toBe(false);
  // The real pointer opens it too, with the submenu to the right of the parent.
  await page.locator('#parent').hover({ position: { x: 20, y: 8 } });
  await expect.poll(() => open(page)).toBe(true);
  const geometry = () => page.evaluate(() => {
    const parent = document.getElementById('parent').getBoundingClientRect();
    const inner = document.getElementById('inner').getBoundingClientRect();
    return { rightOf: inner.left >= parent.right - 4 && inner.width > 0, expanded: document.getElementById('parent').shadowRoot.querySelector('.menu-item').getAttribute('aria-expanded') };
  });
  // Upstream quirk: aria-haspopup and aria-expanded are boolean attributes, so they are present with an empty value (which
  // ARIA reads as false) when true and absent when false.
  await expect.poll(geometry).toEqual({ rightOf: true, expanded: '' });
  await page.locator('#after').focus();
  await expect.poll(() => page.locator('#parent').evaluate(el => el.shadowRoot.querySelector('.menu-item').hasAttribute('aria-expanded'))).toBe(false);
  expect(pageErrors).toEqual([]);
});

test('upstream quirk: in a submenu, a click on a nested item closes it only because of its role; without the role the tagName comparison never matches and the submenu stays open', async ({ page }) => {
  const pageErrors = await loadBundle(page, ENTRY);
  await mount(page, SUBMENU, 'style="max-width: 200px"');
  const openViaKeyboard = async () => {
    await page.locator('#parent').focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => open(page)).toBe(true);
  };
  // Control: a nested item with its role intact closes the submenu when it is clicked.
  await openViaKeyboard();
  await page.locator('[value="child-1"]').click();
  await expect.poll(() => open(page)).toBe(false);
  // Without the role the item's tag name ('SL-MENU-ITEM') still does not match the lower-case 'sl-menu-item', so it stays open.
  await page.evaluate(() => document.querySelector('[value="child-2"]').removeAttribute('role'));
  await openViaKeyboard();
  await page.locator('[value="child-2"]').click();
  await page.waitForTimeout(250);
  expect(await open(page)).toBe(true);
  expect(pageErrors).toEqual([]);
});

test('upstream quirk: aria-disabled and aria-checked are written by the item on its first update and whenever the property changes, replacing what the page wrote', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, `
    <sl-menu-item id="a" aria-disabled="true">A</sl-menu-item>
    <sl-menu-item id="b" type="checkbox" aria-checked="true">B</sl-menu-item>
    <sl-menu-item id="c" disabled aria-disabled="false">C</sl-menu-item>`);
  const r = await page.evaluate(async () => {
    const [a, b, c] = ['a', 'b', 'c'].map(id => document.getElementById(id));
    const aria = () => [a.getAttribute('aria-disabled'), b.getAttribute('aria-checked'), c.getAttribute('aria-disabled')];
    const first = aria();
    // Between property changes nothing watches the attributes, so a value the page writes now stays.
    a.setAttribute('aria-disabled', 'true');
    b.setAttribute('aria-checked', 'true');
    await a.updateComplete;
    const written = aria();
    // The next property change writes them again, replacing the page's value.
    a.disabled = true;
    b.checked = true;
    await Promise.all([a.updateComplete, b.updateComplete]);
    a.disabled = false;
    b.checked = false;
    await Promise.all([a.updateComplete, b.updateComplete]);
    return { first, written, after: aria() };
  });
  expect(r).toEqual({ first: ['false', 'false', 'true'], written: ['true', 'true', 'true'], after: ['false', 'false', 'true'] });
});

test('submenu keyboard: Right, Enter and Space open it at once and focus the first nested item; Left returns to the parent; Escape and Tab close it', async ({ page }) => {
  const pageErrors = await loadBundle(page, ENTRY);
  await mount(page, SUBMENU);
  for (const key of ['ArrowRight', 'Enter', 'Space']) {
    await page.locator('#parent').focus();
    await page.keyboard.press(key);
    await expect.poll(() => focused(page)).toBe('child-1');
    expect(await open(page)).toBe(true);
    // Left: focus goes back to the parent and the submenu closes.
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => focused(page)).toBe('parent');
    expect(await open(page)).toBe(false);
  }
  // None of these selected anything: Enter and Space on the parent open the submenu instead of selecting.
  expect(await page.evaluate(() => window.selects)).toEqual([]);
  // Down inside the submenu moves between nested items without leaving it.
  await page.locator('#parent').focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => focused(page)).toBe('child-1');
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => focused(page)).toBe('child-2');
  expect(await open(page)).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(() => open(page)).toBe(false);
  await page.locator('#parent').focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => focused(page)).toBe('child-1');
  expect(await open(page)).toBe(true);
  await page.keyboard.press('Tab');
  await expect.poll(() => open(page)).toBe(false);
  // Enter on a nested item selects it and closes the submenu.
  await page.locator('#parent').focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => focused(page)).toBe('child-1');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.selects)).toEqual(['child-1']);
  await expect.poll(() => open(page)).toBe(false);
  expect(pageErrors).toEqual([]);
});

// The safe triangle's custom properties default to 0 and only a mousemove on the item sets the cursor ones, so until the
// pointer has moved over the item, the triangle drawn over the viewport while a submenu is open has a vertex at 0,0. A page's
// pointer rests there when nothing has moved it, so Chrome's hover update then sends a mouseover to the item, whose handler
// focuses it (the upstream conformance runner parks the pointer elsewhere for this reason; see docs/conformance.md).
test('upstream quirk: until the pointer has moved, an open submenu\'s safe triangle has a vertex at 0,0, so the item and not the page is at that corner', async ({ page }) => {
  const pageErrors = await loadBundle(page, ENTRY);
  // The menu is narrow so the submenu opens to its right: the triangle then has area on the page, and 0,0 is a corner of it.
  await mount(page, SUBMENU, 'style="max-width: 200px"');
  const probe = () => page.evaluate(() => {
    const parent = document.querySelector('#parent');
    const hit = document.elementFromPoint(0, 0);
    return {
      hit: hit?.id || hit?.localName,
      clip: getComputedStyle(parent.shadowRoot.querySelector('[part="base"]'), '::after').clipPath,
      cursor: ['x', 'y'].map(axis => parent.style.getPropertyValue(`--safe-triangle-cursor-${axis}`)),
    };
  });
  // Closed: no triangle, and the page is at the corner.
  expect((await probe()).hit).toBe('html');
  await page.locator('#parent').focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => open(page)).toBe(true);
  // Open, with no pointer move yet: the cursor variables are unset (so 0), and the item is what is at 0,0.
  await expect.poll(async () => (await probe()).clip).toMatch(/^polygon\(0(px)? 0(px)?, (?!0(px)? 0(px)?,)/);
  const opened = await probe();
  expect(opened.cursor).toEqual(['', '']);
  expect(opened.hit).toBe('parent');
  // A pointer move over the item sets the cursor variables, the triangle leaves 0,0 and the page is at the corner again.
  const box = await page.locator('#parent').boundingBox();
  await page.mouse.move(box.x + 20, box.y + 10);
  await expect.poll(async () => (await probe()).cursor).toEqual([expect.stringMatching(/^[1-9]\d*(\.\d+)?px$/), expect.stringMatching(/^[1-9]\d*(\.\d+)?px$/)]);
  await expect.poll(async () => (await probe()).hit).toBe('html');
  expect((await probe()).clip).not.toMatch(/^polygon\(0(px)? 0(px)?,/);
  expect(pageErrors).toEqual([]);
});

test('a click on the parent item does nothing; focus leaving the item and its submenu closes the submenu; a disabled parent has no submenu behavior', async ({ page }) => {
  const pageErrors = await loadBundle(page, ENTRY);
  await mount(page, SUBMENU);
  await page.locator('#parent').click({ position: { x: 20, y: 8 } });
  expect(await page.evaluate(() => window.selects)).toEqual([]);
  await expect.poll(() => open(page)).toBe(true);
  await page.locator('#after').focus();
  await expect.poll(() => open(page)).toBe(false);
  // Disabling the parent removes the submenu listeners: the keyboard does not open it, and the click is suppressed.
  await page.evaluate(async () => { document.getElementById('parent').disabled = true; await document.getElementById('parent').updateComplete; });
  await page.locator('#parent').focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => open(page)).toBe(false);
  await page.locator('#parent').click({ force: true });
  expect(await page.evaluate(() => window.selects)).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('the value & selection example logs the selected value (with the checked state for checkbox items), and the checkbox example starts with its checked states', async ({ page }) => {
  const { frame, logs } = await openExample(page, 'Value & Selection');
  await frame.locator('sl-menu-item[value="opt-2"]').click();
  await frame.locator('sl-menu-item[value="opt-4"]').click();
  await frame.locator('sl-menu-item[value="opt-4"]').click();
  await frame.locator('sl-menu-item[value="opt-5"]').click();
  await expect.poll(() => logs.filter(l => l.startsWith('Selected value')).length).toBe(4);
  expect(logs.filter(l => l.startsWith('Selected value'))).toEqual([
    'Selected value: opt-2', 'Selected value: opt-4 (checked)', 'Selected value: opt-4 (unchecked)', 'Selected value: opt-5 (checked)',
  ]);
  expect(await frame.locator('sl-menu-item[type="checkbox"]').evaluateAll(items => items.map(i => i.checked))).toEqual([false, true, false]);
  const checkedExample = await openExample(page, 'Checkbox Menu Items');
  expect(await checkedExample.frame.locator('sl-menu-item').evaluateAll(items => items.map(i => [i.getAttribute('role'), i.checked]))).toEqual([
    ['menuitemcheckbox', false], ['menuitemcheckbox', true], ['menuitemcheckbox', false],
  ]);
});

test('dir and lang are reactive, not reflected and undefined by default; the chevron points left under dir="rtl" (set as an attribute) and the item adds its rtl class', async ({ page }) => {
  await loadBundle(page, ENTRY);
  const r = await page.evaluate(async () => {
    const el = document.createElement('sl-menu-item');
    el.innerHTML = 'Item<sl-menu slot="submenu"><sl-menu-item>Nested</sl-menu-item></sl-menu>';
    const defaults = [el.dir, el.lang];
    document.body.append(el);
    await el.updateComplete;
    const ltr = el.shadowRoot.querySelector('[part="submenu-icon"] sl-icon').getAttribute('name');
    el.setAttribute('dir', 'rtl');
    await el.updateComplete;
    const rtl = [el.shadowRoot.querySelector('[part="submenu-icon"] sl-icon').getAttribute('name'), el.shadowRoot.querySelector('.menu-item').classList.contains('menu-item--rtl')];
    // A direction set only through the property is seen too, as in Shoelace (its controller reads the property).
    el.removeAttribute('dir');
    el.dir = 'rtl';
    await el.updateComplete;
    return { defaults, ltr, rtl, reflected: el.hasAttribute('dir'), propertyOnly: el.shadowRoot.querySelector('[part="submenu-icon"] sl-icon').getAttribute('name') };
  });
  expect(r).toEqual({ defaults: [undefined, undefined], ltr: 'chevron-right', rtl: ['chevron-left', true], reflected: false, propertyOnly: 'chevron-left' });
});

test('React examples render the same menus as the HTML examples through the generated wrappers; the value example calls onSlSelect with the item', async ({ page }) => {
  const code = await bundleExamples('menu-item', ORDER.map(([id]) => id));
  const pageErrors = await loadExamples(page, code);
  const logs = [];
  const errorLogs = [];
  page.on('console', m => { if (m.type() === 'log') logs.push(m.text()); if (m.type() === 'error') errorLogs.push(m.text()); });
  const r = await page.evaluate(async names => {
    const out = {};
    for (const name of names) {
      window.renderExample(name);
      await customElements.whenDefined('sl-menu-item');
      await new Promise(r => setTimeout(r, 100));
      const items = [...document.querySelectorAll(`#${name} sl-menu-item`)];
      out[name] = items.map(i => [i.type, i.checked, i.disabled, i.loading, i.value]);
    }
    return { out, errors: window.errors };
  }, ORDER.map(([id]) => id));
  expect(r.out.basic).toEqual([['normal', false, false, false, ''], ['normal', false, false, false, ''], ['normal', false, false, false, ''], ['checkbox', true, false, false, ''], ['normal', false, true, false, ''], ['normal', false, false, false, ''], ['normal', false, false, false, '']]);
  expect(r.out.disabled.map(i => i[2])).toEqual([false, true, false]);
  expect(r.out.loading.map(i => i[3])).toEqual([false, true, false]);
  expect(r.out.checkbox.map(i => [i[0], i[1]])).toEqual([['checkbox', false], ['checkbox', true], ['checkbox', false]]);
  expect(r.out['prefix-suffix']).toHaveLength(3);
  expect(r.out['value-selection'].map(i => i[4])).toEqual(['opt-1', 'opt-2', 'opt-3']);
  // Shoelace's handler (ported unchanged) sets item.checked = !item.checked on plain items. The item resets it to false and
  // logs the upstream console error each time, then the handler logs the value.
  expect(errorLogs).toEqual([]);
  await page.locator('#value-selection sl-menu-item').nth(2).click();
  await expect.poll(() => logs).toContain('Selected value: opt-3');
  await page.locator('#value-selection sl-menu-item').nth(0).click();
  await expect.poll(() => logs).toContain('Selected value: opt-1');
  expect(errorLogs.filter(t => t.startsWith('The checked attribute can only be used on menu items with type="checkbox"'))).toHaveLength(2);
  expect(errorLogs).toHaveLength(2);
  expect(await page.evaluate(() => [...document.querySelectorAll('#value-selection sl-menu-item')].map(i => [i.checked, i.hasAttribute('checked'), i.hasAttribute('aria-checked')]))).toEqual([[false, false, false], [false, false, false], [false, false, false]]);
  expect(await page.evaluate(() => window.errors)).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test.describe('React wrapper', () => {
  const mountWrapper = reactWrapperPage(test);
  test('VelcroMenuItem passes type, checked, value, loading and disabled to the element, and removing a prop restores its default', async ({ page }) => {
    const errors = await mountWrapper(page);
    const r = await page.evaluate(async () => {
      window.renderWrapper('VelcroMenuItem', { type: 'checkbox', checked: true, value: 'v', loading: true, disabled: true }, 'Item');
      await customElements.whenDefined('sl-menu-item');
      const el = document.querySelector('#wrapped');
      await el.updateComplete;
      const set = [el.type, el.checked, el.value, el.loading, el.disabled, el.getAttribute('role'), el.getAttribute('aria-checked'), el.getAttribute('aria-disabled')];
      window.renderWrapper('VelcroMenuItem', { value: 'v' }, 'Item');
      await el.updateComplete;
      return { set, after: [el.type, el.checked, el.loading, el.disabled, el.getAttribute('role')] };
    });
    expect(r.set).toEqual(['checkbox', true, 'v', true, true, 'menuitemcheckbox', 'true', 'true']);
    expect(r.after).toEqual(['normal', false, false, false, 'menuitem']);
    expect(errors).toEqual([]);
  });
});
