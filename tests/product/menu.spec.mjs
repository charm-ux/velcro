import { readdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { bundleExamples, docsDir, loadBundle, loadExamples } from './support/bundle.mjs';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';
import { reactWrapperPage } from './support/react.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/menu';
// Shoelace 2.20.1's menu page has three examples (the opening one, In Dropdowns and Submenus), all ported in Shoelace's order, each
// live and with a React version. In Dropdowns uses Velcro's sl-dropdown.
const ORDER = [['basic', 'Default'], ['dropdowns', 'In Dropdowns'], ['submenus', 'Submenus']];
const title = section => `Menu example: ${section}`;

async function openExample(page, section = 'Default') {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  const frame = page.frameLocator(`iframe.example[title="${title(section)}"]`);
  // The menu of the dropdown example is hidden until the dropdown opens, so that example waits for its trigger.
  await expect(frame.locator(section === 'In Dropdowns' ? 'sl-button' : 'sl-menu').first()).toBeVisible();
  await frame.locator('body').evaluate(async () => {
    await Promise.all(['sl-menu', 'sl-menu-item', 'sl-divider', 'sl-dropdown', 'sl-button'].map(t => customElements.whenDefined(t)));
    await Promise.all([...document.querySelectorAll('sl-menu, sl-menu-item, sl-dropdown, sl-button')].map(el => el.updateComplete));
  });
  await documentsLoaded(page);
  return { frame, requests };
}

// The package entries, in a top-level document of the test's own.
const ENTRY = `
  import '@charm-ux/velcro/menu';
  import '@charm-ux/velcro/menu-item';
  import '@charm-ux/velcro/menu-label';
  import '@charm-ux/velcro/divider';
  window.loaded = true;
`;
const CLASS_ENTRY = `
  import { SlMenu, VelcroMenu } from '@charm-ux/velcro/menu/class';
  window.menuClass = { SlMenu, VelcroMenu };
  window.loaded = true;
`;

const ITEMS = `
  <sl-menu-item value="one">One</sl-menu-item>
  <sl-menu-item value="two">Two</sl-menu-item>
  <sl-menu-item value="three">Three</sl-menu-item>
  <sl-divider></sl-divider>
  <sl-menu-item value="four">Four</sl-menu-item>`;

// Replaces the document with a menu (id m), waits for it and its items to render, and records every sl-select on it.
async function mount(page, markup = ITEMS, attrs = '') {
  await page.evaluate(async ([markup, attrs]) => {
    document.body.innerHTML = `<button id="before">before</button><sl-menu id="m" ${attrs}>${markup}</sl-menu><button id="after">after</button>`;
    const menu = document.querySelector('#m');
    await Promise.all([...document.querySelectorAll('sl-menu, sl-menu-item')].map(el => el.updateComplete));
    await new Promise(r => setTimeout(r, 50));
    window.selects = [];
    menu.addEventListener('sl-select', e => window.selects.push({
      value: e.detail.item.value, bubbles: e.bubbles, composed: e.composed, cancelable: e.cancelable, detailKeys: Object.keys(e.detail), target: e.target.id,
    }));
  }, [markup, attrs]);
}

const selects = page => page.evaluate(() => window.selects);
const focused = page => page.evaluate(() => document.activeElement?.value ?? document.activeElement?.id ?? document.activeElement?.localName);
const tabindexes = page => page.evaluate(() => [...document.querySelectorAll('#m > sl-menu-item, #m > [role^="menuitem"]')].map(i => i.getAttribute('tabindex')));

test('docs page is prerendered with Velcro branding, prototype status, the keyboard, the quirks, the gaps and every ported section in order', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Menu - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('without changing the shared core prefix');
  expect(html).toContain('id="keyboard"');
  // The page states what is missing: the dropdown example, and the type-to-select its own source lacks.
  expect(html).toContain('In Dropdowns');
  expect(html).toContain('Menus work really well when used inside');
  expect(html).not.toContain('does not implement sl-dropdown');
  expect(html).not.toContain('is not ported');
  expect(html).toContain('pressing a letter key does nothing');
  expect(html).toContain('was run locally in Chromium and WebKit only, and Firefox is covered only by the project&#39;s CI run');
  expect(html).toContain('Playwright&#39;s ARIA snapshot');
  // The keyboard acts from the tab-stop item, not the focused one: stated in the keyboard text and listed as a quirk.
  expect(html).toContain("the keys act from the menu's current item, the one that holds the tab stop");
  expect(html).toContain('The keys act on the tab-stop item, not on the focused one.');
  const positions = ORDER.map(([, section]) => html.indexOf(`title="${title(section)}"`));
  expect(positions.every(p => p > 0)).toBe(true);
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  // The API tables: the event, the default slot and no parts or CSS properties of Shoelace's menu; ready is labelled as inherited.
  expect(html).toContain('data-name="sl-select"');
  expect(html).toContain('(default)');
  expect(html).toContain('Inherited from core');
  expect(html).toContain('<summary>React</summary>');
  expect(html).toContain('import { VelcroMenuItem as SlMenuItem } from &#39;@charm-ux/velcro/react/VelcroMenuItem.js&#39;;');
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(await (await request.get('/')).text()).toContain('/components/menu');
});

test('examples: Shoelace\'s order, live in their own documents, with a React version each; no Shoelace runtime is requested', async ({ page }) => {
  const { requests } = await openExample(page);
  const titles = await page.locator('iframe.example').evaluateAll(frames => frames.map(f => f.title));
  expect(titles).toEqual(ORDER.map(([, section]) => title(section)));
  const counts = [];
  for (const [, section] of ORDER) {
    counts.push(await page.frameLocator(`iframe.example[title="${title(section)}"]`).locator('sl-menu-item').count());
  }
  // The submenu example has seven items at the top and six nested ones; each count includes the nested items.
  expect(counts).toEqual([6, 3, 13]);
  const files = dir => readdirSync(path.join(docsDir, 'examples/menu', dir)).filter(f => /\.(html|jsx)$/.test(f)).sort();
  expect(files('')).toEqual(ORDER.map(([id]) => `${id}.html`).sort());
  expect(files('react')).toEqual(ORDER.map(([id]) => `${id}.jsx`).sort());
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
});

test('sl-menu registers as the exported class, with the base name menu, no core marker and no ch-* definitions', async ({ page }) => {
  const { frame } = await openExample(page);
  const info = await frame.locator('sl-menu').first().evaluate(el => {
    const ctor = customElements.get('sl-menu');
    return {
      baseName: ctor.baseName, instance: el instanceof ctor, viaConstructor: new ctor().localName,
      chDefined: ['ch-menu', 'ch-menu-item'].filter(t => customElements.get(t)),
      attrs: el.getAttributeNames().sort(), observed: [...ctor.observedAttributes].sort(),
    };
  });
  expect(info).toEqual({ baseName: 'menu', instance: true, viaConstructor: 'sl-menu', chDefined: [], attrs: ['role', 'style'], observed: ['dir', 'lang'] });
});

test('the class-only entry defines nothing, and a menu has no dependencies to define when it is constructed', async ({ page }) => {
  const pageErrors = await loadBundle(page, CLASS_ENTRY);
  const r = await page.evaluate(() => {
    const { SlMenu, VelcroMenu } = window.menuClass;
    const afterImport = ['sl-menu', 'sl-menu-item', 'sl-divider'].map(t => customElements.get(t)?.name ?? null);
    customElements.define('sl-menu', SlMenu);
    document.body.append(document.createElement('sl-menu'));
    return { afterImport, afterConstruct: ['sl-menu', 'sl-menu-item', 'sl-divider'].map(t => customElements.get(t)?.name ?? null), alias: SlMenu === VelcroMenu };
  });
  // A menu has no dependencies of its own (its items, labels and dividers are separate components), as in Shoelace.
  expect(r).toEqual({ afterImport: [null, null, null], afterConstruct: ['VelcroMenu', null, null], alias: true });
  expect(pageErrors).toEqual([]);
});

test('structure: one slot with no parts inside a block host with the panel styling, role="menu" and roving tab stops (the first item only)', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('sl-menu').first().evaluate(el => {
    const cs = getComputedStyle(el);
    const probe = document.createElement('div');
    probe.style.cssText = 'padding: var(--sl-spacing-x-small) 0; border: solid var(--sl-panel-border-width) var(--sl-panel-border-color); border-radius: var(--sl-border-radius-medium); background: var(--sl-panel-background-color)';
    document.body.append(probe);
    const want = getComputedStyle(probe);
    const expected = [want.paddingTop, want.borderTopWidth, want.borderTopColor, want.borderTopLeftRadius, want.backgroundColor];
    probe.remove();
    return {
      role: el.getAttribute('role'),
      shadow: [...el.shadowRoot.children].map(c => [c.localName, c.getAttribute('part'), c.getAttribute('name')]),
      display: cs.display, position: cs.position, overflow: cs.overflow, boxSizing: cs.boxSizing, overscroll: cs.overscrollBehavior,
      painted: [cs.paddingTop, cs.borderTopWidth, cs.borderTopColor, cs.borderTopLeftRadius, cs.backgroundColor],
      expected,
      width: el.getBoundingClientRect().width,
      items: [...el.querySelectorAll('sl-menu-item')].map(i => [i.getAttribute('role'), i.getAttribute('aria-disabled'), i.getAttribute('tabindex')]),
      divider: el.querySelector('sl-divider').getAttribute('role'),
    };
  });
  expect(r.role).toBe('menu');
  expect(r.shadow).toEqual([['slot', null, null]]);
  expect([r.display, r.position, r.overflow, r.boxSizing, r.overscroll]).toEqual(['block', 'relative', 'auto', 'border-box', 'none']);
  expect(r.painted).toEqual(r.expected);
  expect(r.painted[0]).toBe('8px');
  expect(r.width).toBe(200);
  expect(r.items.map(i => i[0])).toEqual(Array(6).fill('menuitem'));
  expect(r.items.map(i => i[1])).toEqual(Array(6).fill('false'));
  // Roving tab index: the first item only.
  expect(r.items.map(i => i[2])).toEqual(['0', '-1', '-1', '-1', '-1', '-1']);
  expect(r.divider).toBe('separator');
});

// Playwright's ARIA snapshot is computed by Playwright from the DOM (roles, names, aria-hidden, hidden and inert content),
// not read from the browser's native accessibility tree, and no screen reader is involved.
test('accessibility tree (Playwright ARIA snapshot): a menu of menuitems with a separator, checkbox items checked or not, and disabled items', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, `
    <sl-menu-item>Undo</sl-menu-item><sl-divider></sl-divider>
    <sl-menu-item type="checkbox" checked>Autosave</sl-menu-item><sl-menu-item type="checkbox">Wrap</sl-menu-item>
    <sl-menu-item disabled>Delete</sl-menu-item>`);
  await expect(page.locator('#m')).toMatchAriaSnapshot(`
    - menu:
      - menuitem "Undo"
      - separator
      - menuitemcheckbox "Autosave" [checked]
      - menuitemcheckbox "Wrap"
      - menuitem "Delete" [disabled]
  `);
});

test('clicking an item emits sl-select from the menu with the item as detail; the event bubbles, is composed, and cannot be cancelled', async ({ page }) => {
  const pageErrors = await loadBundle(page, ENTRY);
  await mount(page);
  await page.locator('#m sl-menu-item[value="two"]').click();
  await page.locator('#m sl-menu-item[value="four"]').click();
  expect(await selects(page)).toEqual([
    { value: 'two', bubbles: true, composed: true, cancelable: false, detailKeys: ['item'], target: 'm' },
    { value: 'four', bubbles: true, composed: true, cancelable: false, detailKeys: ['item'], target: 'm' },
  ]);
  // The detail is the item element itself, and the event reaches an ancestor.
  const same = await page.evaluate(async () => {
    const seen = [];
    document.body.addEventListener('sl-select', e => seen.push(e.detail.item === document.querySelector('#m sl-menu-item[value="one"]')));
    document.querySelector('#m sl-menu-item[value="one"]').click();
    return seen;
  });
  expect(same).toEqual([true]);
  // A click on the divider, on the menu's padding or on text inside an item (a nested element) behaves as expected.
  await page.locator('#m sl-divider').click();
  await page.evaluate(() => { document.querySelector('#m sl-menu-item[value="three"]').innerHTML = '<span id="inner">Three</span>'; });
  await page.locator('#inner').click();
  expect((await selects(page)).map(s => s.value)).toEqual(['two', 'four', 'one', 'three']);
  expect(pageErrors).toEqual([]);
});

test('keyboard: Down and Up move through the items and wrap, Home and End jump, Enter and Space select the current item', async ({ page }) => {
  const pageErrors = await loadBundle(page, ENTRY);
  await mount(page);
  await page.locator('#m sl-menu-item[value="one"]').focus();
  expect(await focused(page)).toBe('one');
  await page.keyboard.press('ArrowDown');
  expect(await focused(page)).toBe('two');
  expect(await tabindexes(page)).toEqual(['-1', '0', '-1', '-1']);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  expect(await focused(page)).toBe('four');
  // The divider is skipped, and Down on the last item wraps to the first.
  await page.keyboard.press('ArrowDown');
  expect(await focused(page)).toBe('one');
  await page.keyboard.press('ArrowUp');
  expect(await focused(page)).toBe('four');
  await page.keyboard.press('Home');
  expect(await focused(page)).toBe('one');
  await page.keyboard.press('End');
  expect(await focused(page)).toBe('four');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Space');
  expect((await selects(page)).map(s => s.value)).toEqual(['four', 'three']);
  // The handled keys are consumed by the menu: they do not reach the page.
  await page.evaluate(() => {
    window.keys = [];
    document.body.addEventListener('keydown', e => window.keys.push(e.key));
  });
  for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', 'Space']) await page.keyboard.press(key);
  await page.keyboard.press('a');
  expect(await page.evaluate(() => window.keys)).toEqual(['a']);
  expect(pageErrors).toEqual([]);
});

test('upstream quirk: the keys act on the tab-stop item, not the focused one; hovering focuses an item without moving the tab stop', async ({ page }) => {
  const pageErrors = await loadBundle(page, ENTRY);
  await mount(page);
  expect(await tabindexes(page)).toEqual(['0', '-1', '-1', '-1']);
  // Hovering gives the third item focus (its mouseover handler calls focus()), but the tab stop stays on the first item.
  await page.locator('#m sl-menu-item[value="three"]').hover();
  expect(await focused(page)).toBe('three');
  expect(await tabindexes(page)).toEqual(['0', '-1', '-1', '-1']);
  // Enter clicks the tab-stop item, not the hovered, focused one.
  await page.keyboard.press('Enter');
  expect((await selects(page)).map(s => s.value)).toEqual(['one']);
  // Down moves from the tab-stop item (one to two), not from the focused item (three to four).
  await page.keyboard.press('ArrowDown');
  expect(await focused(page)).toBe('two');
  expect(await tabindexes(page)).toEqual(['-1', '0', '-1', '-1']);
  // A mouse press does move the tab stop; the keys then act from that item.
  await page.locator('#m sl-menu-item[value="four"]').hover();
  expect(await focused(page)).toBe('four');
  expect(await tabindexes(page)).toEqual(['-1', '0', '-1', '-1']);
  await page.mouse.down();
  await page.mouse.up();
  expect(await tabindexes(page)).toEqual(['-1', '-1', '-1', '0']);
  expect(pageErrors).toEqual([]);
});

test('upstream quirk: there is no type-to-select; letter keys do nothing, although Shoelace\'s page promises it', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page);
  await page.locator('#m sl-menu-item[value="one"]').focus();
  for (const key of ['t', 'f', 'T']) await page.keyboard.press(key);
  expect(await focused(page)).toBe('one');
  expect(await selects(page)).toEqual([]);
  expect(await tabindexes(page)).toEqual(['0', '-1', '-1', '-1']);
});

test('Enter, Space and a click select nothing on a disabled item, which the arrow keys still reach; with no items the keys do nothing', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, `<sl-menu-item value="a">A</sl-menu-item><sl-menu-item value="b" disabled>B</sl-menu-item><sl-menu-item value="c">C</sl-menu-item>`);
  await page.locator('#m sl-menu-item[value="a"]').focus();
  await page.keyboard.press('ArrowDown');
  // Arrow navigation includes disabled items (only inert items are skipped); Enter and Space on one select nothing.
  expect(await focused(page)).toBe('b');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  expect(await selects(page)).toEqual([]);
  await page.locator('#m sl-menu-item[value="b"]').click({ force: true });
  expect(await selects(page)).toEqual([]);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  expect((await selects(page)).map(s => s.value)).toEqual(['c']);
  // With no item holding the tab stop (a menu holding only a non-item), Enter and the arrow keys do nothing and throw nothing.
  const errors = await page.evaluate(async () => {
    const menu = document.createElement('sl-menu');
    menu.innerHTML = '<p id="p" tabindex="0">text</p>';
    document.body.append(menu);
    await menu.updateComplete;
    const out = [];
    addEventListener('error', e => out.push(e.message));
    const before = window.selects.length;
    for (const key of ['Enter', ' ', 'ArrowDown', 'Home']) {
      menu.querySelector('#p').dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }));
    }
    return { out, selects: window.selects.length - before, items: menu.getAllItems().length, current: menu.getCurrentItem() ?? null };
  });
  expect(errors).toEqual({ out: [], selects: 0, items: 0, current: null });
});

test('checkbox items are toggled by the menu before sl-select is emitted, and a click on a loading item still selects it (upstream quirk)', async ({ page }) => {
  const pageErrors = await loadBundle(page, ENTRY);
  await mount(page, `<sl-menu-item type="checkbox" value="c1">C1</sl-menu-item><sl-menu-item type="checkbox" value="c2" checked>C2</sl-menu-item><sl-menu-item value="l" loading>L</sl-menu-item>`);
  await page.evaluate(() => {
    window.seenChecked = [];
    document.querySelector('#m').addEventListener('sl-select', e => window.seenChecked.push([e.detail.item.value, e.detail.item.checked]));
  });
  await page.locator('#m sl-menu-item[value="c1"]').click();
  await page.locator('#m sl-menu-item[value="c2"]').click();
  await page.locator('#m sl-menu-item[value="c2"]').click();
  await page.locator('#m sl-menu-item[value="l"]').click();
  expect(await page.evaluate(() => window.seenChecked)).toEqual([['c1', true], ['c2', false], ['c2', true], ['l', false]]);
  const state = await page.evaluate(async () => {
    const items = [...document.querySelectorAll('#m sl-menu-item')];
    await Promise.all(items.map(i => i.updateComplete));
    return items.map(i => [i.checked, i.getAttribute('aria-checked'), i.hasAttribute('checked')]);
  });
  expect(state).toEqual([[true, 'true', true], [true, 'true', true], [false, null, false]]);
  expect(pageErrors).toEqual([]);
});

test('a click inside a submenu is handled only by the nearest menu; the outer menu emits nothing of its own and a click on the parent item selects nothing', async ({ page }) => {
  const pageErrors = await loadBundle(page, ENTRY);
  await mount(page, `<sl-menu-item value="top">Top</sl-menu-item>
    <sl-menu-item value="parent">Parent<sl-menu slot="submenu" id="inner"><sl-menu-item value="child">Child</sl-menu-item></sl-menu></sl-menu-item>`);
  await page.evaluate(() => {
    window.inner = [];
    document.querySelector('#inner').addEventListener('sl-select', e => window.inner.push(e.detail.item.value));
  });
  // Open the submenu with the keyboard, then click the nested item.
  await page.locator('#m > sl-menu-item[value="parent"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#m sl-menu-item[value="child"]')).toBeVisible();
  await page.locator('#m sl-menu-item[value="child"]').click();
  // The inner menu's event bubbles through the outer menu: one event in total, not two.
  expect(await selects(page)).toEqual([expect.objectContaining({ value: 'child', target: 'inner' })]);
  expect(await page.evaluate(() => window.inner)).toEqual(['child']);
  // The click on a nested item closes the submenu.
  await expect(page.locator('#m sl-menu-item[value="child"]')).toBeHidden();
  // A click on the parent item itself does nothing: the submenu controller stops it before it reaches the menu.
  await page.locator('#m > sl-menu-item[value="parent"]').click({ position: { x: 10, y: 10 } });
  expect((await selects(page)).map(s => s.value)).toEqual(['child']);
  expect(pageErrors).toEqual([]);
});

test('items are the sl-menu-item elements and elements with a menu item role, minus inert ones; a menuitemradio is navigated to but its click is not handled (upstream quirk)', async ({ page }) => {
  const pageErrors = await loadBundle(page, ENTRY);
  await mount(page, `<sl-menu-item value="a">A</sl-menu-item><sl-menu-item value="hidden" inert>Hidden</sl-menu-item>
    <div role="menuitem" id="m-div" tabindex="-1">Div item</div><div role="menuitemradio" id="m-radio" tabindex="-1">Radio item</div><p id="para">Not an item</p>`);
  const r = await page.evaluate(() => {
    const menu = document.querySelector('#m');
    return { all: menu.getAllItems().map(i => i.id || i.value), current: menu.getCurrentItem()?.value };
  });
  expect(r).toEqual({ all: ['a', 'm-div', 'm-radio'], current: 'a' });
  await page.locator('#m sl-menu-item[value="a"]').focus();
  await page.keyboard.press('ArrowDown');
  expect(await focused(page)).toBe('m-div');
  await page.keyboard.press('ArrowDown');
  expect(await focused(page)).toBe('m-radio');
  await page.keyboard.press('ArrowDown');
  expect(await focused(page)).toBe('a');
  await page.locator('#m-div').click();
  expect(await selects(page)).toEqual([expect.objectContaining({ target: 'm' })]);
  await page.locator('#m-radio').click();
  await page.locator('#para').click();
  expect(await selects(page)).toHaveLength(1);
  expect(pageErrors).toEqual([]);
});

test('role="menu" is written on every connect, replacing the page\'s role; the roving tab stop resets to the first item when the slotted content changes, and a mouse press makes an item the tab stop', async ({ page }) => {
  const pageErrors = await loadBundle(page, ENTRY);
  await mount(page, ITEMS, 'role="listbox"');
  expect(await page.locator('#m').getAttribute('role')).toBe('menu');
  expect(await tabindexes(page)).toEqual(['0', '-1', '-1', '-1']);
  // A mouse press on an item gives it the tab stop (before the click); focusing by script does not.
  await page.locator('#m sl-menu-item[value="three"]').focus();
  expect(await tabindexes(page)).toEqual(['0', '-1', '-1', '-1']);
  await page.locator('#m sl-menu-item[value="three"]').dispatchEvent('mousedown');
  expect(await tabindexes(page)).toEqual(['-1', '-1', '0', '-1']);
  await page.locator('#m sl-menu-item[value="two"]').dispatchEvent('mousedown');
  expect(await tabindexes(page)).toEqual(['-1', '0', '-1', '-1']);
  // Adding an element (any slotchange) resets the tab stop to the first item.
  await page.evaluate(() => document.querySelector('#m').insertAdjacentHTML('beforeend', '<sl-menu-item value="five">Five</sl-menu-item>'));
  await expect.poll(() => tabindexes(page)).toEqual(['0', '-1', '-1', '-1', '-1']);
  // The helpers: setCurrentItem moves the tab stop, getCurrentItem reads it, and the item is then focusable by script.
  const r = await page.evaluate(() => {
    const menu = document.querySelector('#m');
    const items = menu.getAllItems();
    menu.setCurrentItem(items[3]);
    const out = { current: menu.getCurrentItem().value, tabs: items.map(i => i.getAttribute('tabindex')) };
    items[3].focus();
    return { ...out, active: document.activeElement.value };
  });
  expect(r).toEqual({ current: 'four', tabs: ['-1', '-1', '-1', '0', '-1'], active: 'four' });
  // Disconnecting and reconnecting the menu writes the role again.
  const role = await page.evaluate(() => {
    const menu = document.querySelector('#m');
    menu.removeAttribute('role');
    const host = menu.parentElement;
    menu.remove();
    host.append(menu);
    return menu.getAttribute('role');
  });
  expect(role).toBe('menu');
  expect(pageErrors).toEqual([]);
});

test('dir and lang are reactive, not reflected and undefined by default, as Shoelace\'s base element declares them; ready is the only core event and does not bubble', async ({ page }) => {
  await loadBundle(page, ENTRY);
  const r = await page.evaluate(async () => {
    const el = document.createElement('sl-menu');
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

// Shoelace's React examples, ported in packages/docs/examples/menu/react/*.jsx, bundled with React 19 and the generated wrappers.
test('In Dropdowns example: the trigger opens the menu in the dropdown, a selection reports the item through sl-select and closes the panel', async ({ page }) => {
  const { frame } = await openExample(page, 'In Dropdowns');
  const dropdown = frame.locator('sl-dropdown');
  await frame.locator('body').evaluate(() => {
    window.selected = [];
    document.querySelector('sl-menu').addEventListener('sl-select', e => window.selected.push(e.detail.item.value));
  });
  await expect(frame.locator('sl-menu')).toBeHidden();
  await frame.locator('sl-button').click();
  await expect(dropdown).toHaveAttribute('open', '');
  await expect(frame.locator('sl-menu')).toBeVisible();
  await frame.locator('sl-menu-item', { hasText: 'Copy' }).click();
  await expect(dropdown).not.toHaveAttribute('open', '');
  expect(await frame.locator('body').evaluate(() => window.selected)).toEqual(['copy']);
});

test('React examples render the same menus as the HTML examples through the generated wrappers, and onSlSelect receives the item', async ({ page }) => {
  const code = await bundleExamples('menu', ORDER.map(([id]) => id));
  const pageErrors = await loadExamples(page, code);
  const r = await page.evaluate(async () => {
    const out = {};
    for (const name of ['basic', 'dropdowns', 'submenus']) {
      window.renderExample(name);
      await customElements.whenDefined('sl-menu');
      await new Promise(r => setTimeout(r, 100));
      const menu = document.querySelector(`#${name} sl-menu`);
      if (name === 'dropdowns') {
        const dropdown = document.querySelector('#dropdowns sl-dropdown');
        out[name] = { values: [...menu.querySelectorAll(':scope > sl-menu-item')].map(i => i.value), trigger: dropdown.querySelector('[slot="trigger"]').textContent.trim(), inPanel: menu.parentElement === dropdown };
        continue;
      }
      out[name] = {
        values: [...menu.querySelectorAll(':scope > sl-menu-item')].map(i => i.value),
        nested: [...menu.querySelectorAll('sl-menu[slot="submenu"]')].length,
        dividers: menu.querySelectorAll(':scope > sl-divider').length,
        width: menu.getBoundingClientRect().width,
        role: menu.getAttribute('role'),
      };
    }
    return { out, errors: window.errors };
  });
  expect(r.out.basic).toEqual({ values: ['undo', 'redo', 'cut', 'copy', 'paste', 'delete'], nested: 0, dividers: 1, width: 200, role: 'menu' });
  expect(r.out.dropdowns).toEqual({ values: ['cut', 'copy', 'paste'], trigger: 'Edit', inPanel: true });
  expect(r.out.submenus).toEqual({ values: ['undo', 'redo', 'cut', 'copy', 'paste', '', ''], nested: 2, dividers: 2, width: 200, role: 'menu' });
  expect(r.errors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test.describe('React wrapper', () => {
  const mountWrapper = reactWrapperPage(test);
  test('VelcroMenu passes style and children through, and onSlSelect is called with the event whose detail.item is the clicked item', async ({ page }) => {
    const errors = await mountWrapper(page);
    await page.evaluate(async () => {
      window.calls = [];
      window.renderWrapper('VelcroMenu', { style: { maxWidth: '200px' }, onSlSelect: e => window.calls.push([e.detail.item.value, e.target.id]) },
        '<sl-menu-item value="a">A</sl-menu-item><sl-menu-item value="b">B</sl-menu-item>');
      await customElements.whenDefined('sl-menu');
      await customElements.whenDefined('sl-menu-item');
      await new Promise(r => setTimeout(r, 100));
    });
    await page.locator('#wrapped sl-menu-item[value="b"]').click();
    const r = await page.evaluate(() => ({ calls: window.calls, role: document.querySelector('#wrapped').getAttribute('role'), width: document.querySelector('#wrapped').style.maxWidth }));
    expect(r).toEqual({ calls: [['b', 'wrapped']], role: 'menu', width: '200px' });
    expect(errors).toEqual([]);
  });
});
