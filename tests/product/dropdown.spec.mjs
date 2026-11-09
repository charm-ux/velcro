import { readdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { bundleExamples, docsDir, loadBundle, loadExamples } from './support/bundle.mjs';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';
import { reactWrapperPage } from './support/react.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/dropdown';
// Shoelace 2.20.1's dropdown page: the opening example, then Getting the Selected Item (two examples), Placement, Distance,
// Skidding, Submenus and Hoisting. Every example is ported live with a React version.
const ORDER = [
  ['basic', 'Default'], ['selection', 'Getting the Selected Item'], ['selection-click', 'Getting the Selected Item (click listeners)'],
  ['placement', 'Placement'], ['distance', 'Distance'], ['skidding', 'Skidding'], ['submenus', 'Submenus'], ['hoisting', 'Hoisting'],
];
const title = section => `Dropdown example: ${section}`;

async function openExample(page, section = 'Default') {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  const frame = page.frameLocator(`iframe.example[title="${title(section)}"]`);
  await expect(frame.locator('sl-dropdown').first()).toBeVisible();
  await frame.locator('body').evaluate(async () => {
    await Promise.all(['sl-dropdown', 'sl-button', 'sl-menu', 'sl-menu-item', 'sl-popup'].map(t => customElements.whenDefined(t)));
    await Promise.all([...document.querySelectorAll('sl-dropdown, sl-button, sl-menu, sl-menu-item')].map(el => el.updateComplete));
  });
  await documentsLoaded(page);
  return { frame, requests };
}

// The package entries, in a top-level document of the test's own: the dropdown entry registers sl-dropdown and sl-popup only.
const ENTRY = `
  import '@charm-ux/velcro/dropdown';
  import '@charm-ux/velcro/button';
  import '@charm-ux/velcro/menu';
  import '@charm-ux/velcro/menu-item';
  import '@charm-ux/velcro/divider';
  window.loaded = true;
`;
const CLASS_ENTRY = `
  import { SlDropdown, VelcroDropdown } from '@charm-ux/velcro/dropdown/class';
  window.dropdownClass = { SlDropdown, VelcroDropdown };
  window.loaded = true;
`;

const MENU = `<sl-menu id="menu"><sl-menu-item value="one">One</sl-menu-item><sl-menu-item value="two">Two</sl-menu-item><sl-menu-item value="three" disabled>Three</sl-menu-item></sl-menu>`;
const TRIGGER = `<sl-button slot="trigger" id="trigger" caret>Toggle</sl-button>`;

// Replaces the document with a dropdown (id d) between two buttons, waits for it to render, and records its four events.
async function mount(page, { attrs = '', trigger = TRIGGER, panel = MENU, style = '' } = {}) {
  await page.evaluate(async ([attrs, trigger, panel, style]) => {
    document.body.innerHTML = `<button id="before">before</button><div id="box" style="${style}"><sl-dropdown id="d" ${attrs}>${trigger}${panel}</sl-dropdown></div><button id="after">after</button><div id="blank" style="height: 300px"></div>`;
    const els = () => [...document.querySelectorAll('sl-dropdown, sl-button, sl-menu, sl-menu-item, sl-popup')];
    await Promise.all(els().map(el => el.updateComplete));
    await new Promise(r => setTimeout(r, 50));
    window.log = [];
    const d = document.querySelector('#d');
    for (const name of ['sl-show', 'sl-after-show', 'sl-hide', 'sl-after-hide']) {
      d.addEventListener(name, e => window.log.push([name, e.target.id, e.bubbles, e.composed, e.cancelable, JSON.stringify(e.detail)]));
    }
  }, [attrs, trigger, panel, style]);
}

const log = page => page.evaluate(() => window.log.map(e => e[0]));
const state = page => page.evaluate(() => {
  const d = document.querySelector('#d');
  return { open: d.open, attr: d.hasAttribute('open'), panelHidden: d.panel.hidden, popupActive: d.popup.active, expanded: document.querySelector('#trigger')?.button?.getAttribute('aria-expanded') ?? null };
});
const active = page => page.evaluate(() => document.activeElement?.value || document.activeElement?.id || document.activeElement?.localName);
const openIt = async page => {
  await page.evaluate(() => document.querySelector('#d').show());
};

test('docs page is prerendered with Velcro branding, prototype status, the keyboard, the quirks, the gaps and every ported section in order', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Dropdown - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('id="keyboard"');
  expect(html).toContain('id="animations"');
  expect(html).toContain('without changing the shared core prefix');
  expect(html).toContain('was run locally in Chromium and WebKit only, and Firefox is covered only by the project&#39;s CI run');
  expect(html).toContain('Playwright&#39;s ARIA snapshot');
  expect(html).toContain('19 tests');
  expect(html).toContain('the page gives every preview a body with room for the open panel');
  // The React examples differ from Shoelace's snippets in more than imports for exactly two examples, and the page says so.
  expect(html).toContain('apart from two examples that are adapted further (hoisting and submenus');
  expect(html).toContain('the submenus example passes style as an object');
  expect(html).toContain('the rest of that snippet, including the css constant and the fragment it carries, is kept as Shoelace wrote it');
  expect(html).not.toContain('drops the unused css constant');
  expect(html).toContain('which React rejects');
  expect(html).toContain('the hoisting example adds position: relative to its class');
  expect(html).not.toContain('only its import lines differ (see below)');
  // The CloseWatcher and never-settling show() quirks are listed.
  expect(html).toContain('Where the browser has the CloseWatcher API (for example Chromium)');
  expect(html).toContain('the promise show() returned never settles');
  // Shoelace's headings, in order (the opening example and the second selection example have none).
  const headings = ['selection', 'placement', 'distance', 'skidding', 'submenus', 'hoisting'].map(id => html.indexOf(`<h3 id="${id}">`));
  expect(headings.every(p => p > 0)).toBe(true);
  expect([...headings].sort((a, b) => a - b)).toEqual(headings);
  const positions = ORDER.map(([, section]) => html.indexOf(`title="${title(section)}"`));
  expect(positions.every(p => p > 0)).toBe(true);
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  expect(html).toContain('as a UX best practice, avoid using more than one level of submenu');
  // The API tables: the four events, both slots, the parts and the properties; ready is labelled as inherited.
  for (const name of ['sl-show', 'sl-after-show', 'sl-hide', 'sl-after-hide', 'open', 'placement', 'stayOpenOnSelect', 'containingElement', 'distance', 'skidding', 'hoist', 'sync', 'show', 'hide', 'reposition', 'trigger', 'panel', 'popup', 'base', 'base__popup']) {
    expect(html, name).toContain(`data-name="${name}"`);
  }
  expect(html).toContain('(default)');
  expect(html).toContain('Inherited from core');
  expect(html).toContain('<summary>React</summary>');
  expect(html).toContain('import { VelcroDropdown as SlDropdown } from &#39;@charm-ux/velcro/react/VelcroDropdown.js&#39;;');
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(await (await request.get('/')).text()).toContain('/components/dropdown');
});

test('examples: Shoelace\'s order, live in their own documents with room for the panel, a React version each; no Shoelace runtime is requested', async ({ page }) => {
  const { requests } = await openExample(page);
  const titles = await page.locator('iframe.example').evaluateAll(frames => frames.map(f => f.title));
  expect(titles).toEqual(ORDER.map(([, section]) => title(section)));
  const counts = [];
  for (const [, section] of ORDER) {
    counts.push(await page.frameLocator(`iframe.example[title="${title(section)}"]`).locator('sl-dropdown').count());
  }
  expect(counts).toEqual([1, 1, 1, 1, 1, 1, 1, 2]);
  const files = dir => readdirSync(path.join(docsDir, 'examples/dropdown', dir)).filter(f => /\.(html|jsx)$/.test(f)).sort();
  expect(files('')).toEqual(ORDER.map(([id]) => `${id}.html`).sort());
  expect(files('react')).toEqual(ORDER.map(([id]) => `${id}.jsx`).sort());
  // The page-local style: a body that is tall enough for the open panel.
  const heights = await page.locator('iframe.example').evaluateAll(frames => frames.map(f => f.getBoundingClientRect().height));
  expect(heights.every(h => h >= 400)).toBe(true);
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
});

test('Default example: opens from the trigger with the menu, a checkbox, a disabled item, prefix and suffix icons, and the panel is positioned under the trigger', async ({ page }) => {
  const { frame } = await openExample(page, 'Default');
  const dropdown = frame.locator('sl-dropdown');
  await frame.locator('sl-button').click();
  await expect(dropdown).toHaveAttribute('open', '');
  await expect.poll(() => dropdown.evaluate(el => el.popup.popup.getAnimations().length)).toBe(0);
  const r = await dropdown.evaluate(el => {
    const trigger = el.querySelector('sl-button').getBoundingClientRect();
    const panel = el.querySelector('sl-menu').getBoundingClientRect();
    const items = [...el.querySelectorAll('sl-menu-item')];
    return {
      placement: el.popup.getAttribute('data-current-placement'),
      gap: Math.round(panel.top - trigger.bottom), left: Math.round(panel.left - trigger.left),
      items: items.length, checked: items.filter(i => i.checked).length, disabled: items.filter(i => i.disabled).length,
      icons: [...el.querySelectorAll('sl-icon')].map(i => i.slot),
      panelHidden: el.panel.hidden, expanded: el.querySelector('sl-button').button.getAttribute('aria-expanded'),
    };
  });
  expect(r).toEqual({ placement: 'bottom-start', gap: 0, left: 0, items: 7, checked: 1, disabled: 1, icons: ['prefix', 'suffix'], panelHidden: false, expanded: 'true' });
});

test('Getting the Selected Item examples: the menu\'s sl-select reports the item, a click listener sees each item, and the panel closes with the focus back on the trigger', async ({ page }) => {
  const logs = [];
  page.on('console', m => logs.push(m.text()));
  await openExample(page, 'Getting the Selected Item');
  const first = page.frameLocator(`iframe.example[title="${title('Getting the Selected Item')}"]`);
  await first.locator('sl-button').click();
  await first.locator('sl-menu-item[value="copy"]').click();
  await expect.poll(() => logs.filter(l => l === 'copy').length).toBe(1);
  await expect(first.locator('sl-dropdown')).not.toHaveAttribute('open', '');
  expect(await first.locator('sl-dropdown').evaluate(el => document.activeElement === el.querySelector('sl-button'))).toBe(true);
  const second = page.frameLocator(`iframe.example[title="${title('Getting the Selected Item (click listeners)')}"]`);
  await second.locator('sl-button').click();
  await second.locator('sl-menu-item[value="paste"]').click();
  await expect.poll(() => logs.filter(l => l === 'paste').length).toBe(1);
  expect(logs.filter(l => ['cut', 'copy', 'paste'].includes(l))).toEqual(['copy', 'paste']);
});

test('Placement, Distance and Skidding examples set the attributes Shoelace\'s examples set, and the panel follows them', async ({ page }) => {
  await openExample(page, 'Placement');
  const read = async section => {
    const frame = page.frameLocator(`iframe.example[title="${title(section)}"]`);
    await frame.locator('sl-button').click();
    const dropdown = frame.locator('sl-dropdown');
    await expect(dropdown).toHaveAttribute('open', '');
    await expect.poll(() => dropdown.evaluate(el => el.popup.popup.getAnimations().length)).toBe(0);
    return dropdown.evaluate(el => {
      const trigger = el.querySelector('sl-button').getBoundingClientRect();
      const panel = el.querySelector('sl-menu').getBoundingClientRect();
      return { attrs: ['placement', 'distance', 'skidding'].map(n => el.getAttribute(n)), above: Math.round(trigger.top - panel.bottom), below: Math.round(panel.top - trigger.bottom), left: Math.round(panel.left - trigger.left) };
    });
  };
  expect(await read('Placement')).toEqual({ attrs: ['top-start', null, null], above: 0, below: expect.any(Number), left: 0 });
  expect(await read('Distance')).toEqual({ attrs: ['bottom-start', '30', null], above: expect.any(Number), below: 30, left: 0 });
  expect(await read('Skidding')).toEqual({ attrs: ['bottom-start', null, '30'], above: expect.any(Number), below: 0, left: 30 });
});

test('Submenus example: the nested menus open from the items inside the dropdown\'s panel', async ({ page }) => {
  const { frame } = await openExample(page, 'Submenus');
  await frame.locator('sl-button').click();
  await expect(frame.locator('sl-dropdown')).toHaveAttribute('open', '');
  const find = frame.locator('sl-menu-item', { hasText: 'Find' }).first();
  await find.hover();
  await expect(frame.locator('sl-menu[slot="submenu"]').first()).toBeVisible();
  expect(await frame.locator('sl-dropdown').evaluate(el => el.hasAttribute('open'))).toBe(true);
});

test('Hoisting example: the hoisted panel is positioned with the fixed strategy and escapes the clipping container; the other one is clipped', async ({ page }) => {
  const { frame } = await openExample(page, 'Hoisting');
  const dropdowns = frame.locator('sl-dropdown');
  const info = async index => {
    const dropdown = dropdowns.nth(index);
    await dropdown.locator('sl-button').click();
    await expect(dropdown).toHaveAttribute('open', '');
    await expect.poll(() => dropdown.evaluate(el => el.popup.popup.getAnimations().length)).toBe(0);
    return dropdown.evaluate(el => {
      const container = el.closest('.dropdown-hoist').getBoundingClientRect();
      const panel = el.querySelector('sl-menu').getBoundingClientRect();
      const x = panel.left + 10, y = panel.bottom - 5;
      const hit = el.ownerDocument.elementFromPoint(x, y);
      const hitInPanel = el.contains(hit);
      const menu = el.querySelector('sl-menu');
      return { strategy: getComputedStyle(el.popup.popup).position, hoist: el.hasAttribute('hoist'), overflowsContainer: panel.bottom > container.bottom, scrolls: menu.scrollHeight > menu.clientHeight, hitInPanel };
    });
  };
  // Without hoist the panel is cut down to the clipping container (the popup's vertical auto-size) and its menu scrolls.
  expect(await info(0)).toEqual({ strategy: 'absolute', hoist: false, overflowsContainer: false, scrolls: true, hitInPanel: true });
  await page.keyboard.press('Escape');
  const hoisted = await info(1);
  expect(hoisted.strategy).toBe('fixed');
  expect(hoisted.hoist).toBe(true);
  expect(hoisted.overflowsContainer).toBe(true);
  expect(hoisted.scrolls).toBe(false);
  expect(hoisted.hitInPanel).toBe(true);
});

test('React Hoisting example (with the position: relative its port adds): the hoisted panel is fixed and escapes the clipping container; the other one is clipped and its menu scrolls; without it the clipping does not happen', async ({ page }) => {
  const code = await bundleExamples('dropdown', ['hoisting']);
  const pageErrors = await loadExamples(page, code);
  await page.evaluate(async () => {
    window.renderExample('hoisting');
    await customElements.whenDefined('sl-dropdown');
    await new Promise(resolve => setTimeout(resolve, 100));
  });
  const dropdowns = page.locator('#hoisting sl-dropdown');
  const info = async index => {
    const dropdown = dropdowns.nth(index);
    await dropdown.locator('sl-button').click();
    await expect(dropdown).toHaveAttribute('open', '');
    await expect.poll(() => dropdown.evaluate(el => el.popup.popup.getAnimations().length)).toBe(0);
    const result = await dropdown.evaluate(el => {
      const container = el.closest('.dropdown-hoist').getBoundingClientRect();
      const menu = el.querySelector('sl-menu');
      const panel = menu.getBoundingClientRect();
      const hit = el.ownerDocument.elementFromPoint(panel.left + 10, panel.bottom - 5);
      return { strategy: getComputedStyle(el.popup.popup).position, hoist: el.hoist, overflowsContainer: panel.bottom > container.bottom, scrolls: menu.scrollHeight > menu.clientHeight, hitInPanel: el.contains(hit) };
    });
    await page.keyboard.press('Escape');
    await expect(dropdown).not.toHaveAttribute('open', '');
    await expect.poll(() => page.evaluate(() => document.querySelector('#hoisting sl-dropdown').popup.popup.getAnimations().length)).toBe(0);
    return result;
  };
  expect(await info(0)).toEqual({ strategy: 'absolute', hoist: false, overflowsContainer: false, scrolls: true, hitInPanel: true });
  const hoisted = await info(1);
  expect(hoisted).toMatchObject({ strategy: 'fixed', hoist: true, overflowsContainer: true, scrolls: false, hitInPanel: true });
  // Shoelace's React snippet lacks position: relative; without it the container is not the panel's containing block.
  await page.evaluate(() => { const style = document.querySelector('#hoisting style'); style.textContent = style.textContent.replace('position: relative;', ''); });
  expect(await info(0)).toMatchObject({ strategy: 'absolute', hoist: false, overflowsContainer: true });
  expect(pageErrors).toEqual([]);
});

test('sl-dropdown registers as the exported class, with the base name dropdown, its dependency sl-popup, no core marker and no ch-* definitions', async ({ page }) => {
  const { frame } = await openExample(page);
  const info = await frame.locator('sl-dropdown').evaluate(el => {
    const ctor = customElements.get('sl-dropdown');
    return {
      baseName: ctor.baseName, instance: el instanceof ctor, viaConstructor: new ctor().localName,
      popup: customElements.get('sl-popup')?.baseName,
      chDefined: ['ch-dropdown', 'ch-popup', 'ch-menu'].filter(t => customElements.get(t)),
      observed: [...ctor.observedAttributes].sort(),
      // No core base-name marker attribute (core writes one only for a tag in its own scope): the host has only the reflected placement.
      attrs: el.getAttributeNames().sort(),
    };
  });
  expect(info).toEqual({
    baseName: 'dropdown', instance: true, viaConstructor: 'sl-dropdown', popup: 'popup', chDefined: [], attrs: ['placement'],
    observed: ['dir', 'disabled', 'distance', 'hoist', 'lang', 'open', 'placement', 'skidding', 'stay-open-on-select', 'sync'],
  });
});

test('the class-only entry defines nothing, and constructing a dropdown defines its dependency sl-popup (and leaves a tag that is already defined alone)', async ({ page }) => {
  const pageErrors = await loadBundle(page, CLASS_ENTRY);
  const r = await page.evaluate(() => {
    const { SlDropdown, VelcroDropdown } = window.dropdownClass;
    const afterImport = ['sl-dropdown', 'sl-popup'].map(t => customElements.get(t)?.name ?? null);
    customElements.define('sl-dropdown', SlDropdown);
    document.body.append(document.createElement('sl-dropdown'));
    return { afterImport, afterConstruct: ['sl-dropdown', 'sl-popup'].map(t => customElements.get(t)?.name ?? null), alias: SlDropdown === VelcroDropdown };
  });
  expect(r).toEqual({ afterImport: [null, null], afterConstruct: ['VelcroDropdown', 'VelcroPopup'], alias: true });
  expect(pageErrors).toEqual([]);
});

test('defaults, reflection and restoring a reflected property\'s initial value; distance, skidding and hoist are not reflected', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page);
  const r = await page.evaluate(async () => {
    const d = document.querySelector('#d');
    const defaults = { open: d.open, placement: d.placement, disabled: d.disabled, stay: d.stayOpenOnSelect, distance: d.distance, skidding: d.skidding, hoist: d.hoist, sync: d.sync, containing: d.containingElement === d, dir: d.dir, lang: d.lang };
    d.placement = 'top-end';
    d.disabled = true;
    d.stayOpenOnSelect = true;
    d.sync = 'width';
    d.distance = 8;
    d.skidding = 9;
    d.hoist = true;
    await d.updateComplete;
    const reflected = d.getAttributeNames().sort();
    for (const n of ['placement', 'disabled', 'stay-open-on-select', 'sync']) d.removeAttribute(n);
    d.setAttribute('distance', '3');
    await d.updateComplete;
    const fromAttribute = d.distance;
    d.removeAttribute('distance');
    await d.updateComplete;
    return { defaults, reflected, fromAttribute, restored: { placement: d.placement, disabled: d.disabled, stay: d.stayOpenOnSelect, sync: d.sync, distance: d.distance, hoist: d.hoist } };
  });
  expect(r.defaults).toEqual({ open: false, placement: 'bottom-start', disabled: false, stay: false, distance: 0, skidding: 0, hoist: false, sync: undefined, containing: true, dir: undefined, lang: undefined });
  // Exactly the reflected properties that were set write attributes (and `id`, which the test gave the element); distance, skidding and
  // hoist write none, and there is no marker attribute from the core base element.
  expect(r.reflected).toEqual(['disabled', 'id', 'placement', 'stay-open-on-select', 'sync']);
  // Reflected properties go back to their initial value, as Shoelace's base element does; `sync` started undefined, so it is null
  // after its attribute is removed, and the non-reflected distance is set to null by the attribute change, as upstream.
  expect(r.fromAttribute).toBe(3);
  expect(r.restored).toEqual({ placement: 'bottom-start', disabled: false, stay: false, sync: null, distance: null, hoist: true });
});

test('structure and computed styles: an sl-popup base around the trigger slot and the panel slot, and the panel looks like Shoelace\'s', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, { attrs: 'placement="top" distance="5" skidding="6" hoist sync="width"' });
  const closed = await page.evaluate(() => {
    const d = document.querySelector('#d');
    const root = d.shadowRoot;
    const popup = root.querySelector('sl-popup');
    return {
      children: [...root.children].filter(c => c.localName !== 'style').map(c => c.localName),
      popup: { part: popup.getAttribute('part'), exportparts: popup.getAttribute('exportparts'), id: popup.id, cls: popup.className.trim(), placement: popup.placement, distance: popup.distance, skidding: popup.skidding, strategy: popup.strategy, flip: popup.flip, shift: popup.shift, autoSize: popup.autoSize, padding: popup.autoSizePadding, sync: popup.sync, active: popup.active },
      trigger: { name: d.trigger.name, slot: d.trigger.slot, part: d.trigger.getAttribute('part'), cls: d.trigger.className },
      panel: { name: d.panel.name, part: d.panel.getAttribute('part'), hidden: d.panel.hidden, pointer: getComputedStyle(d.panel).pointerEvents },
      wrapper: [d.panel.parentElement.getAttribute('aria-hidden'), d.panel.parentElement.getAttribute('aria-labelledby')],
      host: [getComputedStyle(d).display, getComputedStyle(d).boxSizing],
      queries: [d.popup === popup, d.trigger.localName, d.panel.localName],
      z: getComputedStyle(d.popup.popup).zIndex, token: getComputedStyle(document.documentElement).getPropertyValue('--sl-z-index-dropdown').trim(),
    };
  });
  expect(closed.children).toEqual(['sl-popup']);
  expect(closed.popup).toEqual({ part: 'base', exportparts: 'popup:base__popup', id: 'dropdown', cls: 'dropdown', placement: 'top', distance: 5, skidding: 6, strategy: 'fixed', flip: true, shift: true, autoSize: 'vertical', padding: 10, sync: 'width', active: false });
  expect(closed.trigger).toEqual({ name: 'trigger', slot: 'anchor', part: 'trigger', cls: 'dropdown__trigger' });
  expect(closed.panel).toEqual({ name: '', part: 'panel', hidden: true, pointer: 'none' });
  expect(closed.wrapper).toEqual(['true', 'dropdown']);
  expect(closed.host).toEqual(['inline-block', 'border-box']);
  expect(closed.queries).toEqual([true, 'slot', 'slot']);
  expect(closed.z).toBe(closed.token);
  await openIt(page);
  await expect.poll(() => page.evaluate(() => document.querySelector('#d').popup.popup.getAnimations().length)).toBe(0);
  const open = await page.evaluate(() => {
    const d = document.querySelector('#d');
    const panel = getComputedStyle(d.panel);
    const menu = document.querySelector('#menu');
    const root = getComputedStyle(document.documentElement);
    const token = n => root.getPropertyValue(n).trim();
    return {
      cls: d.popup.className, wrapper: d.panel.parentElement.getAttribute('aria-hidden'), pointer: panel.pointerEvents, display: panel.display,
      font: [panel.fontFamily, panel.fontSize, panel.fontWeight, panel.boxShadow, panel.borderRadius],
      expected: [token('--sl-font-sans'), token('--sl-font-size-medium'), token('--sl-font-weight-normal')],
      menuMax: [getComputedStyle(menu).maxWidth, getComputedStyle(menu).maxHeight],
      synced: Math.round(d.popup.popup.getBoundingClientRect().width) === Math.round(document.querySelector('#trigger').getBoundingClientRect().width),
      origin: getComputedStyle(d.popup.popup).transformOrigin,
    };
  });
  expect(open.cls).toBe('dropdown dropdown--open');
  expect(open.wrapper).toBe('false');
  expect(open.pointer).toBe('all');
  expect(open.display).toBe('block');
  expect(open.font[0]).toMatch(/^-apple-system.*sans-serif/);
  expect(open.expected[0]).toMatch(/^-apple-system.*sans-serif/);
  expect(open.font[1]).toBe('16px');
  expect(open.font[2]).toBe('400');
  expect(open.font[3]).not.toBe('none');
  expect(open.font[4]).toBe('4px');
  // The popup's vertical auto-size sets only the available height, so the slotted menu's max-width variable is unset.
  expect(open.menuMax[0]).toBe('none');
  expect(open.menuMax[1]).toMatch(/^\d+(\.\d+)?px$/);
  expect(open.synced).toBe(true);
});

test('accessibility tree (Playwright ARIA snapshot): a collapsed then expanded trigger button, and the panel\'s menu', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page);
  // Playwright's snapshot shows [expanded] only when it is true.
  await expect(page.locator('#d')).toMatchAriaSnapshot(`
    - button "Toggle"
  `);
  await openIt(page);
  await expect(page.locator('#d')).toMatchAriaSnapshot(`
    - button "Toggle" [expanded]
    - menu:
      - menuitem "One"
      - menuitem "Two"
      - menuitem "Three" [disabled]
  `);
  const attrs = await page.evaluate(() => {
    const inner = document.querySelector('#trigger').button;
    return { host: [document.querySelector('#trigger').getAttribute('aria-expanded'), document.querySelector('#trigger').getAttribute('aria-haspopup')], inner: [inner.getAttribute('aria-haspopup'), inner.getAttribute('aria-expanded')] };
  });
  // The attributes go on the inner button, not on the slotted sl-button.
  expect(attrs).toEqual({ host: [null, null], inner: ['true', 'true'] });
  // Nothing links the trigger to the panel with aria-controls.
  expect(await page.evaluate(() => [document.querySelector('#trigger').button.hasAttribute('aria-controls'), document.querySelector('#d').hasAttribute('aria-controls')])).toEqual([false, false]);
});

test('events: show() and hide() emit sl-show, sl-after-show, sl-hide and sl-after-hide in order, each bubbling, composed, not cancelable and with an empty detail; a state that already holds returns at once', async ({ page }) => {
  const pageErrors = await loadBundle(page, ENTRY);
  await mount(page);
  const r = await page.evaluate(async () => {
    const d = document.querySelector('#d');
    const first = await d.show();
    const opened = [d.open, d.hasAttribute('open'), d.panel.hidden, d.popup.active];
    const again = await d.show();
    const midLog = window.log.map(e => e[0]);
    const hid = await d.hide();
    const closed = [d.open, d.hasAttribute('open'), d.panel.hidden, d.popup.active];
    const hidAgain = await d.hide();
    return { first, again, hid, hidAgain, opened, closed, midLog, log: window.log };
  });
  expect(r.first).toBeUndefined();
  expect(r.again).toBeUndefined();
  expect(r.opened).toEqual([true, true, false, true]);
  expect(r.closed).toEqual([false, false, true, false]);
  expect(r.midLog).toEqual(['sl-show', 'sl-after-show']);
  expect(r.log).toEqual([
    ['sl-show', 'd', true, true, false, '{}'], ['sl-after-show', 'd', true, true, false, '{}'],
    ['sl-hide', 'd', true, true, false, '{}'], ['sl-after-hide', 'd', true, true, false, '{}'],
  ]);
  // Setting the property or the attribute has the same effect as the methods.
  await page.evaluate(() => { window.log.length = 0; document.querySelector('#d').open = true; });
  await expect.poll(() => log(page)).toEqual(['sl-show', 'sl-after-show']);
  await page.evaluate(() => document.querySelector('#d').removeAttribute('open'));
  await expect.poll(() => log(page)).toEqual(['sl-show', 'sl-after-show', 'sl-hide', 'sl-after-hide']);
  expect(pageErrors).toEqual([]);
});

test('a dropdown that is open when it first renders emits no events, shows its panel and is positioned', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, { attrs: 'open' });
  expect(await log(page)).toEqual([]);
  expect(await state(page)).toMatchObject({ open: true, attr: true, panelHidden: false, popupActive: true });
  const placed = await page.evaluate(() => {
    const t = document.querySelector('#trigger').getBoundingClientRect();
    const m = document.querySelector('#menu').getBoundingClientRect();
    return Math.round(m.top - t.bottom);
  });
  expect(placed).toBe(0);
});

test('keyboard: Enter and Space toggle the panel and keep the focus on the trigger; the cancelled keydown does not click it', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page);
  await page.evaluate(() => { window.clicks = 0; document.querySelector('#trigger').addEventListener('click', () => window.clicks++); document.querySelector('#trigger').focus(); });
  await page.keyboard.press('Enter');
  await expect.poll(() => log(page)).toEqual(['sl-show', 'sl-after-show']);
  expect(await active(page)).toBe('trigger');
  await page.keyboard.press('Enter');
  await expect.poll(() => log(page)).toHaveLength(4);
  await page.keyboard.press('Space');
  await expect.poll(() => log(page)).toHaveLength(6);
  expect((await state(page)).open).toBe(true);
  expect(await active(page)).toBe('trigger');
  // Neither key produced a click on the slotted trigger.
  expect(await page.evaluate(() => window.clicks)).toBe(0);
  // Space's keyup is cancelled (for Firefox), another key's is not.
  const cancelled = await page.evaluate(() => ['\u0020', 'a'].map(key => {
    const e = new KeyboardEvent('keyup', { key, bubbles: true, composed: true, cancelable: true });
    document.querySelector('#trigger').dispatchEvent(e);
    return e.defaultPrevented;
  }));
  expect(cancelled).toEqual([true, false]);
});

test('keyboard: Arrow Down and Home open the panel and focus the first item, Arrow Up and End the last one, and the arrows act only when there is a menu', async ({ page }) => {
  await loadBundle(page, ENTRY);
  const cases = [['ArrowDown', 'one'], ['Home', 'one'], ['ArrowUp', 'three'], ['End', 'three']];
  for (const [key, value] of cases) {
    await mount(page);
    await page.evaluate(() => document.querySelector('#trigger').focus());
    await page.keyboard.press(key);
    await expect.poll(() => active(page), key).toBe(value);
    expect((await state(page)).open).toBe(true);
  }
  // An empty menu is found: the dropdown opens and nothing is focused.
  await mount(page, { panel: '<sl-menu id="menu"></sl-menu>' });
  await page.evaluate(() => document.querySelector('#trigger').focus());
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => state(page).then(s => s.open)).toBe(true);
  await page.waitForTimeout(100);
  expect(await active(page)).toBe('trigger');
  // No menu: the arrow does nothing (and an open dropdown stays as it is).
  await mount(page, { panel: '<div id="content">Panel</div>' });
  await page.evaluate(() => document.querySelector('#trigger').focus());
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(150);
  expect((await state(page)).open).toBe(false);
  // A menu that is not a direct child of the dropdown is not found (an upstream quirk).
  await mount(page, { panel: `<div>${MENU}</div>` });
  await page.evaluate(() => document.querySelector('#trigger').focus());
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(150);
  expect((await state(page)).open).toBe(false);
});

test('Escape closes an open panel and returns the focus to the trigger, from the trigger and from inside the menu', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page);
  await page.evaluate(() => document.querySelector('#trigger').focus());
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => active(page)).toBe('one');
  await expect.poll(() => log(page)).toEqual(['sl-show', 'sl-after-show']);
  await page.keyboard.press('Escape');
  await expect.poll(() => log(page)).toEqual(['sl-show', 'sl-after-show', 'sl-hide', 'sl-after-hide']);
  expect(await active(page)).toBe('trigger');
  // From the trigger.
  await openIt(page);
  await page.evaluate(() => document.querySelector('#trigger').focus());
  await page.keyboard.press('Escape');
  await expect.poll(() => state(page).then(s => s.open)).toBe(false);
  expect(await active(page)).toBe('trigger');
});

test('Tab from a menu item closes the panel, cancels the Tab and focuses the trigger; Tab from the trigger leaves the panel open', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page);
  await page.evaluate(() => document.querySelector('#trigger').focus());
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => active(page)).toBe('one');
  await page.keyboard.press('Tab');
  await expect.poll(() => state(page).then(s => s.open)).toBe(false);
  expect(await active(page)).toBe('trigger');
  await expect.poll(() => log(page).then(l => l.includes('sl-after-hide'))).toBe(true);
  // Focus on the trigger (inside the containing element): Tab does not close the panel.
  await openIt(page);
  await page.evaluate(() => document.querySelector('#trigger').focus());
  await page.keyboard.press('Tab');
  await page.waitForTimeout(150);
  expect((await state(page)).open).toBe(true);
});

test('Tab to an element outside the dropdown closes it from a timeout; focus moving to content inside the containing element does not', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, { panel: '<div id="content" tabindex="0">Panel</div>' });
  await openIt(page);
  await page.evaluate(() => document.querySelector('#content').focus());
  await page.keyboard.press('Tab');
  await expect.poll(() => state(page).then(s => s.open)).toBe(false);
  expect(await active(page)).toBe('after');
  await expect.poll(() => log(page).then(l => l.includes('sl-after-hide'))).toBe(true);
  await openIt(page);
  await page.evaluate(() => document.querySelector('#trigger').focus());
  await page.keyboard.press('Tab');
  await page.waitForTimeout(150);
  expect((await state(page)).open).toBe(true);
  expect(await active(page)).toBe('content');
});

test('a mouse press outside the dropdown closes it; a press inside the panel does not; clicking the trigger toggles and focuses it when opening', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page);
  await page.locator('#trigger').click();
  await expect.poll(() => log(page)).toEqual(['sl-show', 'sl-after-show']);
  expect(await active(page)).toBe('trigger');
  await page.locator('#menu').click({ position: { x: 2, y: 2 } });
  await page.waitForTimeout(100);
  expect((await state(page)).open).toBe(true);
  await page.locator('#blank').click();
  await expect.poll(() => state(page).then(s => s.open)).toBe(false);
  await page.locator('#trigger').click();
  await expect.poll(() => state(page).then(s => s.open)).toBe(true);
  await page.locator('#trigger').click();
  await expect.poll(() => state(page).then(s => s.open)).toBe(false);
  await expect.poll(() => log(page).then(l => l.length)).toBe(8);
  // Showing from the trigger's click handler focuses the trigger; hiding from it leaves the focus where it is.
  const focus = await page.evaluate(async () => {
    const d = document.querySelector('#d');
    document.querySelector('#before').focus();
    d.handleTriggerClick();
    const afterShow = document.activeElement.id;
    await new Promise(resolve => d.addEventListener('sl-after-show', resolve, { once: true }));
    document.querySelector('#before').focus();
    d.handleTriggerClick();
    return [afterShow, document.activeElement.id];
  });
  expect(focus).toEqual(['trigger', 'before']);
});

test('selecting a menu item closes the panel and focuses the trigger, unless stay-open-on-select is set; a disabled item selects nothing', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page);
  await page.evaluate(() => { window.selects = []; document.querySelector('#d').addEventListener('sl-select', e => window.selects.push(e.detail.item.value)); });
  await openIt(page);
  await page.locator('sl-menu-item[value="three"]').click({ force: true });
  await page.waitForTimeout(100);
  expect((await state(page)).open).toBe(true);
  await page.locator('sl-menu-item[value="two"]').click();
  await expect.poll(() => state(page).then(s => s.open)).toBe(false);
  expect(await active(page)).toBe('trigger');
  expect(await page.evaluate(() => window.selects)).toEqual(['two']);
  await mount(page, { attrs: 'stay-open-on-select' });
  await page.evaluate(() => { window.selects = []; document.querySelector('#d').addEventListener('sl-select', e => window.selects.push(e.detail.item.value)); });
  await openIt(page);
  await page.locator('sl-menu-item[value="one"]').click();
  await page.waitForTimeout(150);
  expect((await state(page)).open).toBe(true);
  expect(await page.evaluate(() => window.selects)).toEqual(['one']);
});

test('only an sl-select event whose target is an sl-menu closes the dropdown', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, { panel: '<div id="content"><sl-menu id="menu"><sl-menu-item value="one">One</sl-menu-item></sl-menu></div>' });
  await openIt(page);
  await page.evaluate(() => document.querySelector('#content').dispatchEvent(new CustomEvent('sl-select', { bubbles: true, composed: true, detail: { item: null } })));
  await page.waitForTimeout(150);
  expect((await state(page)).open).toBe(true);
  await page.evaluate(() => document.querySelector('#menu').dispatchEvent(new CustomEvent('sl-select', { bubbles: true, composed: true, detail: { item: null } })));
  await expect.poll(() => state(page).then(s => s.open)).toBe(false);
});

test('placement, distance, skidding, sync and hoist reach the panel\'s position', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await page.setViewportSize({ width: 800, height: 700 });
  const geometry = async attrs => {
    await mount(page, { attrs, style: 'margin: 250px 200px' });
    await openIt(page);
    await expect.poll(() => page.evaluate(() => document.querySelector('#d').popup.popup.getAnimations().length)).toBe(0);
    return page.evaluate(() => {
      const t = document.querySelector('#trigger').getBoundingClientRect();
      const m = document.querySelector('#d').popup.popup.getBoundingClientRect();
      return { above: Math.round(t.top - m.bottom), below: Math.round(m.top - t.bottom), left: Math.round(m.left - t.left), right: Math.round(t.right - m.right), width: Math.round(m.width), triggerWidth: Math.round(t.width), strategy: getComputedStyle(document.querySelector('#d').popup.popup).position };
    });
  };
  expect(await geometry('')).toMatchObject({ below: 0, left: 0, strategy: 'absolute' });
  expect(await geometry('placement="top-end"')).toMatchObject({ above: 0, right: 0 });
  expect(await geometry('distance="12" skidding="7"')).toMatchObject({ below: 12, left: 7 });
  expect(await geometry('hoist')).toMatchObject({ below: 0, strategy: 'fixed' });
  const synced = await geometry('sync="width"');
  expect(synced.width).toBe(synced.triggerWidth);
});

test('animations: dropdown.show and dropdown.hide come from the registry, and a custom animation for one element is used', async ({ page }) => {
  await loadBundle(page, ENTRY + `
    import { getAnimation, setAnimation } from '@charm-ux/velcro/utilities/animation-registry';
    window.registry = { getAnimation, setAnimation };
  `);
  await mount(page);
  const defaults = await page.evaluate(() => {
    const d = document.querySelector('#d');
    return ['dropdown.show', 'dropdown.hide'].map(n => window.registry.getAnimation(d, n, { dir: 'ltr' }));
  });
  expect(defaults).toEqual([
    { keyframes: [{ opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1 }], options: { duration: 100, easing: 'ease' } },
    { keyframes: [{ opacity: 1, scale: 1 }, { opacity: 0, scale: 0.9 }], options: { duration: 100, easing: 'ease' } },
  ]);
  const seen = await page.evaluate(async () => {
    const d = document.querySelector('#d');
    window.registry.setAnimation(d, 'dropdown.show', { keyframes: [{ opacity: 0 }, { opacity: 1 }], options: { duration: 321 } });
    let duration = null;
    d.addEventListener('sl-show', () => setTimeout(() => { duration = d.popup.popup.getAnimations().map(a => a.effect.getTiming().duration); }, 10));
    await d.show();
    return duration;
  });
  expect(seen).toEqual([321]);
});

test('an upstream quirk: a disabled dropdown cannot be opened, emits nothing and its show() promise never settles, and disabling an open one does not close it', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, { attrs: 'disabled' });
  await page.evaluate(() => { document.querySelector('#d').open = true; });
  await expect.poll(() => state(page).then(s => s.open)).toBe(false);
  await page.locator('#trigger').click();
  await page.waitForTimeout(150);
  expect(await state(page)).toMatchObject({ open: false, panelHidden: true });
  expect(await log(page)).toEqual([]);
  // The promise show() returns waits for sl-after-show, which never comes.
  const settled = await page.evaluate(() => Promise.race([document.querySelector('#d').show().then(() => 'settled'), new Promise(resolve => setTimeout(() => resolve('pending'), 300))]));
  expect(settled).toBe('pending');
  await mount(page);
  await openIt(page);
  await page.evaluate(() => { document.querySelector('#d').disabled = true; });
  await page.waitForTimeout(150);
  expect((await state(page)).open).toBe(true);
});

test('an upstream quirk: where CloseWatcher exists the panel\'s own Escape handler is not attached and the keydown reaches the page; without it the panel stops the keydown; either way the panel closes and the trigger is focused', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page);
  const hasWatcher = await page.evaluate(() => 'CloseWatcher' in window);
  await page.evaluate(() => {
    window.escapes = 0;
    document.body.addEventListener('keydown', e => { if (e.key === 'Escape') window.escapes++; });
    document.querySelector('#trigger').focus();
  });
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => active(page)).toBe('one');
  await expect.poll(() => log(page)).toEqual(['sl-show', 'sl-after-show']);
  await page.keyboard.press('Escape');
  await expect.poll(() => state(page).then(s => s.open)).toBe(false);
  expect(await active(page)).toBe('trigger');
  // The keydown is seen by a listener above the dropdown only where the watcher, not the panel's handler, closes the panel.
  expect(await page.evaluate(() => window.escapes)).toBe(hasWatcher ? 1 : 0);
});

test('an upstream quirk: removing an open dropdown closes it with sl-hide and sl-after-hide on the detached element, and putting it back leaves it closed', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page);
  await openIt(page);
  await page.evaluate(() => { window.log.length = 0; window.node = document.querySelector('#d'); window.node.remove(); });
  await expect.poll(() => log(page)).toEqual(['sl-hide', 'sl-after-hide']);
  await page.evaluate(() => document.querySelector('#box').append(window.node));
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => [window.node.open, window.node.hasAttribute('open')])).toEqual([false, false]);
});

test('an upstream quirk: showing the dropdown again while it is still closing leaves open true with the panel hidden', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page);
  await openIt(page);
  const r = await page.evaluate(async () => {
    const d = document.querySelector('#d');
    window.log.length = 0;
    void d.hide();
    await new Promise(resolve => setTimeout(resolve, 20));
    void d.show();
    await new Promise(resolve => setTimeout(resolve, 500));
    return { log: window.log.map(e => e[0]), open: d.open, panelHidden: d.panel.hidden, popupActive: d.popup.active };
  });
  // The closing handler finishes after the opening one has started, and hides the panel it was closing.
  expect(r).toEqual({ log: ['sl-hide', 'sl-show', 'sl-after-hide', 'sl-after-show'], open: true, panelHidden: true, popupActive: false });
});

test('an upstream quirk: without a containing element an outside mouse press no longer closes the dropdown', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page);
  await openIt(page);
  await page.evaluate(() => { document.querySelector('#d').containingElement = undefined; });
  await page.locator('#blank').click();
  await page.waitForTimeout(150);
  expect((await state(page)).open).toBe(true);
});

test('an upstream quirk: aria-haspopup and aria-expanded go on the slotted element itself unless it is an sl-button or sl-icon-button (a wrapper around a button gets them, not the button), and a trigger with nothing tabbable gets none', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, { trigger: '<span slot="trigger" id="trigger"><button id="inner">Inner</button></span>' });
  await openIt(page);
  const wrapped = await page.evaluate(() => ['#trigger', '#inner'].map(s => [document.querySelector(s).getAttribute('aria-haspopup'), document.querySelector(s).getAttribute('aria-expanded')]));
  expect(wrapped).toEqual([['true', 'true'], [null, null]]);
  await mount(page, { trigger: '<span slot="trigger" id="trigger">Plain text</span>' });
  await openIt(page);
  expect(await page.evaluate(() => document.querySelector('#trigger').getAttributeNames())).toEqual(['slot', 'id']);
});

test('dir and lang are reactive, not reflected and undefined by default, as Shoelace\'s base element declares them; ready is the only core event and does not bubble', async ({ page }) => {
  await loadBundle(page, ENTRY);
  const r = await page.evaluate(async () => {
    const el = document.createElement('sl-dropdown');
    const defaults = [el.dir, el.lang];
    const seen = [];
    el.addEventListener('ready', e => seen.push([e.bubbles, e.composed]));
    let bubbled = 0;
    document.body.addEventListener('ready', () => bubbled++);
    document.body.append(el);
    await el.updateComplete;
    el.dir = 'rtl';
    el.lang = 'ar';
    await el.updateComplete;
    const afterSet = [el.dir, el.lang, el.hasAttribute('dir'), el.hasAttribute('lang')];
    el.setAttribute('dir', 'ltr');
    await el.updateComplete;
    return { defaults, seen, bubbled, afterSet, fromAttribute: el.dir };
  });
  expect(r).toEqual({ defaults: [undefined, undefined], seen: [[false, false]], bubbled: 0, afterSet: ['rtl', 'ar', false, false], fromAttribute: 'ltr' });
});

// Shoelace's React examples, ported in packages/docs/examples/dropdown/react/*.jsx, bundled with React 19 and the generated wrappers.
test('React examples render the same dropdowns as the HTML examples through the generated wrappers; onSlSelect and onClick receive the item', async ({ page }) => {
  const logs = [];
  page.on('console', m => logs.push(m.text()));
  const code = await bundleExamples('dropdown', ORDER.map(([id]) => id));
  const pageErrors = await loadExamples(page, code);
  const r = await page.evaluate(async () => {
    const out = {};
    for (const name of ['basic', 'selection', 'selection-click', 'placement', 'distance', 'skidding', 'submenus', 'hoisting']) {
      window.renderExample(name);
      await customElements.whenDefined('sl-dropdown');
      await new Promise(r => setTimeout(r, 100));
      const dropdowns = [...document.querySelectorAll(`#${name} sl-dropdown`)];
      out[name] = {
        count: dropdowns.length,
        props: dropdowns.map(d => ['placement', 'distance', 'skidding', 'hoist'].map(n => d[n])),
        items: dropdowns[0].querySelectorAll('sl-menu-item').length,
        trigger: dropdowns[0].querySelector('[slot="trigger"]').textContent.trim(),
      };
    }
    return { out, errors: window.errors };
  });
  expect(r.out.basic).toEqual({ count: 1, props: [['bottom-start', 0, 0, false]], items: 7, trigger: 'Dropdown' });
  expect(r.out.placement.props).toEqual([['top-start', 0, 0, false]]);
  expect(r.out.distance.props).toEqual([['bottom-start', 30, 0, false]]);
  expect(r.out.skidding.props).toEqual([['bottom-start', 0, 30, false]]);
  expect(r.out.hoisting).toMatchObject({ count: 2, props: [['bottom-start', 0, 0, false], ['bottom-start', 0, 0, true]] });
  expect(r.out.submenus.items).toBe(13);
  expect(r.errors).toEqual([]);
  await page.locator('#selection sl-button').click();
  await page.locator('#selection sl-menu-item', { hasText: 'Cut' }).click();
  await page.locator('#selection-click sl-button').click();
  await page.locator('#selection-click sl-menu-item', { hasText: 'Paste' }).click();
  await expect.poll(() => logs.filter(l => ['cut', 'paste'].includes(l))).toEqual(['cut', 'paste']);
  expect(pageErrors).toEqual([]);
});

test.describe('React wrapper', () => {
  const mountWrapper = reactWrapperPage(test);
  test('React rejects a string style (the page\'s error handler sees it and nothing renders), which is why the Submenus port passes an object where Shoelace\'s snippet has style="max-width: 200px;"', async ({ page }) => {
    await mountWrapper(page);
    const rejected = await page.evaluate(async () => {
      try {
        window.renderWrapper('VelcroMenu', { style: 'max-width: 200px;' }, '<sl-menu-item>A</sl-menu-item>');
      } catch (e) {
        window.errors.push(String(e.message));
      }
      await new Promise(resolve => setTimeout(resolve, 150));
      return { errors: window.errors.length, rendered: Boolean(document.querySelector('#wrapped')) };
    });
    expect(rejected.errors).toBeGreaterThan(0);
    expect(rejected.rendered).toBe(false);
    // The same wrapper with an object renders and applies the width.
    const errors = await mountWrapper(page);
    const accepted = await page.evaluate(async () => {
      window.renderWrapper('VelcroMenu', { style: { maxWidth: '200px' } }, '<sl-menu-item>A</sl-menu-item>');
      await new Promise(resolve => setTimeout(resolve, 100));
      return { errors: window.errors.length, width: document.querySelector('#wrapped')?.style.maxWidth };
    });
    expect(accepted).toEqual({ errors: 0, width: '200px' });
    expect(errors).toEqual([]);
  });

  test('VelcroDropdown passes its props through, reflects open, and calls onSlShow, onSlAfterShow, onSlHide and onSlAfterHide', async ({ page }) => {
    const errors = await mountWrapper(page);
    await page.evaluate(async () => {
      window.calls = [];
      const on = name => e => window.calls.push([name, e.target.id]);
      window.renderWrapper('VelcroDropdown', { placement: 'top-start', distance: 30, hoist: true, stayOpenOnSelect: true, onSlShow: on('show'), onSlAfterShow: on('after-show'), onSlHide: on('hide'), onSlAfterHide: on('after-hide') },
        '<sl-button slot="trigger">T</sl-button><sl-menu><sl-menu-item value="a">A</sl-menu-item></sl-menu>');
      await customElements.whenDefined('sl-dropdown');
      await new Promise(r => setTimeout(r, 100));
    });
    const props = await page.evaluate(() => { const d = document.querySelector('#wrapped'); return [d.placement, d.distance, d.hoist, d.stayOpenOnSelect]; });
    expect(props).toEqual(['top-start', 30, true, true]);
    await page.evaluate(async () => { const d = document.querySelector('#wrapped'); await d.show(); await d.hide(); });
    expect(await page.evaluate(() => window.calls)).toEqual([['show', 'wrapped'], ['after-show', 'wrapped'], ['hide', 'wrapped'], ['after-hide', 'wrapped']]);
    expect(errors).toEqual([]);
  });
});
