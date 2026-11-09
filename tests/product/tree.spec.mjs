// sl-tree product checks against Shoelace 2.20.1's tree contract, through the docs page's examples.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';
import { buildFixtures, gotoBlank } from './support/fixtures.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/tree';
const docsDir = fileURLToPath(new URL('../../packages/docs/', import.meta.url));
const velcroDir = fileURLToPath(new URL('../../packages/velcro/', import.meta.url));

// The docs page's examples, in Shoelace's order: the example's title and the name of its files under examples/tree/.
const EXAMPLES = [
  ['Overview', 'default'],
  ['Selection Modes', 'selection-modes'],
  ['Showing Indent Guides', 'indent-guides'],
  ['Lazy Loading', 'lazy-loading'],
  ['Customizing the Expand and Collapse Icons', 'custom-icons'],
  ['With Icons', 'with-icons'],
];

const frameFor = (page, title) => page.frameLocator(`iframe.example[title="Tree example: ${title}"]`);

async function openExample(page, name = 'Overview') {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  const frame = frameFor(page, name);
  await expect(frame.locator('sl-tree').first()).toBeAttached();
  await frame.locator('body').evaluate(() => Promise.all([customElements.whenDefined('sl-tree'), customElements.whenDefined('sl-tree-item')]));
  await documentsLoaded(page);
  return { frame, requests };
}

// Mounts markup in the example document (replacing earlier mounts) and waits for every tree and item in it to render.
async function mount(frame, markup) {
  await frame.locator('body').evaluate(async (body, markup) => {
    document.getElementById('mount')?.remove();
    const host = document.createElement('div');
    host.id = 'mount';
    host.innerHTML = markup;
    body.append(host);
    const all = () => [...host.querySelectorAll('sl-tree, sl-tree-item')];
    await Promise.all(all().map(el => el.updateComplete));
    await new Promise(resolve => setTimeout(resolve));
    await Promise.all(all().map(el => el.updateComplete));
  }, markup);
}

// A tree with a nested branch (one disabled child), a second branch and a leaf. Nothing is expanded.
const FIXTURE = `
  <sl-tree id="t">
    <sl-tree-item id="a">Alpha
      <sl-tree-item id="a1">A1</sl-tree-item>
      <sl-tree-item id="a2">A2</sl-tree-item>
      <sl-tree-item id="a3" disabled>A3</sl-tree-item>
    </sl-tree-item>
    <sl-tree-item id="b">Bravo
      <sl-tree-item id="b1">B1</sl-tree-item>
      <sl-tree-item id="b2">B2</sl-tree-item>
    </sl-tree-item>
    <sl-tree-item id="c">Charlie</sl-tree-item>
  </sl-tree>`;

// Expands an item from script and waits until the animation is over (its children are laid out at their full height).
const expandAndWait = (frame, id) => frame.locator(`#${id}`).evaluate(el => new Promise(resolve => {
  el.addEventListener('sl-after-expand', () => resolve(), { once: true });
  el.expanded = true;
}));
const label = (frame, id) => frame.locator(`#${id}`).locator('.tree-item__label').first();
const expandButton = (frame, id) => frame.locator(`#${id}`).locator('.tree-item__expand-button').first();

// Records the sl-selection-change events of #t in its own `events` array (the selected ids, in the order given).
const recordSelection = frame => frame.locator('#t').evaluate(el => {
  const events = (el.events = []);
  el.addEventListener('sl-selection-change', e => events.push({
    ids: e.detail.selection.map(item => item.id), bubbles: e.bubbles, composed: e.composed, cancelable: e.cancelable, target: e.target === el,
  }));
});
const selectionEvents = frame => frame.locator('#t').evaluate(el => el.events);
const selectedIds = frame => frame.locator('#t').evaluate(el => [...el.querySelectorAll('sl-tree-item')].filter(i => i.selected).map(i => i.id));
const focusedId = frame => frame.locator('body').evaluate(() => document.activeElement?.id ?? null);
const setTree = (frame, props) => frame.locator('#t').evaluate(async (el, props) => {
  Object.assign(el, props);
  await el.updateComplete;
  await new Promise(resolve => setTimeout(resolve));
  await Promise.all([...el.querySelectorAll('sl-tree-item')].map(i => i.updateComplete));
}, props);

test('docs page is prerendered with Velcro branding, prototype status, every Shoelace section, the quirks and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Tree - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('without changing the shared core prefix');
  for (const [title] of EXAMPLES) expect(html).toContain(`title="Tree example: ${title}"`);
  const examplesPart = html.slice(html.indexOf('id="examples"'), html.indexOf('id="attributes"'));
  expect([...examplesPart.matchAll(/<h3 id="([^"]+)"><!--lit-part-->([^<]+)<!--\/lit-part--><\/h3>/g)].map(m => m[1]))
    .toEqual(['overview', 'selection-modes', 'indent-guides', 'lazy-loading', 'custom-icons', 'with-icons']);
  expect(examplesPart).toContain('Use <code>leaf</code> to only allow leaf nodes to be selected.');
  expect(examplesPart).toContain('Indent guides can be drawn by setting <code>--indent-guide-width</code>.');
  expect(examplesPart).toContain('The item will remain in a loading state until its content is changed.');
  expect(examplesPart).toContain('override the <code>rotate</code> property on the <code>expand-button</code> part');
  expect(examplesPart).toContain('Decorative icons can be used before labels to provide hints for each node.');
  expect(html).toContain('Trees allow you to display a hierarchical list of selectable');
  // Six React versions, as in Shoelace's page; the wrappers are imported under Shoelace's names.
  expect(html.match(/<summary>React<\/summary>/g)).toHaveLength(EXAMPLES.length);
  expect(html).toContain('import { VelcroTree as SlTree } from &#39;@charm-ux/velcro/react/VelcroTree.js&#39;;');
  expect(html).toContain('import { VelcroTreeItem as SlTreeItem } from &#39;@charm-ux/velcro/react/VelcroTreeItem.js&#39;;');
  // The API tables: Shoelace's members, plus the core ready event labelled as inherited.
  expect(html).toContain('Inherited from @charm-ux/core CharmElement');
  for (const name of ['selection', 'sl-selection-change', 'expand-icon', 'collapse-icon', 'base', '--indent-size', '--indent-guide-color',
    '--indent-guide-offset', '--indent-guide-style', '--indent-guide-width']) {
    expect(html).toContain(`data-name="${name}"`);
  }
  expect(html).toContain('data-name="ready"');
  // The quirks and limits the page lists are the ones the tests below pin.
  expect(html).toContain('The default --indent-size is the large spacing token');
  expect(html).toContain('ArrowRight does not stop at an end node');
  expect(html).toContain('throws a TypeError from the key handler');
  expect(html).toContain('Setting selected from script emits nothing');
  expect(html).toContain('the tree has two tab stops');
  expect(html).toContain('typing a letter does nothing');
  expect(html).toContain('Shoelace&#39;s own tree tests (38');
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
  const home = await (await request.get('/')).text();
  expect(home).toContain('/components/tree');
});

test('sl-tree registers inside the example document as the exported class, with the items, no core marker and no ch-* definitions', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  const info = await frame.locator('body').evaluate(() => {
    const ctor = customElements.get('sl-tree');
    const el = document.querySelector('sl-tree');
    return {
      baseName: ctor?.baseName,
      coreTags: ['ch-tree', 'ch-tree-item'].map(t => customElements.get(t) !== undefined),
      viaConstructor: ctor ? new ctor().localName : null,
      instance: el instanceof ctor,
      item: customElements.get('sl-tree-item')?.baseName,
      dependencies: ['sl-checkbox', 'sl-icon', 'sl-spinner'].map(t => customElements.get(t)?.baseName),
      attrs: el.getAttributeNames().sort(),
    };
  });
  expect(info).toEqual({
    baseName: 'tree', coreTags: [false, false], viaConstructor: 'sl-tree', instance: true, item: 'tree-item',
    dependencies: ['checkbox', 'icon', 'spinner'], attrs: ['aria-multiselectable', 'id', 'role', 'tabindex'],
  });
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
});

test('structure: a base wrapper with the default slot and the two hidden icon slots, and Shoelace\'s public queries', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('sl-tree').first().evaluate(async el => {
    await el.updateComplete;
    const base = el.shadowRoot.querySelector('[part="base"]');
    return {
      base: [base.localName, base.className, base.getAttribute('part')],
      children: [...base.children].map(c => [c.localName, c.hidden, c.getAttribute('aria-hidden'), [...c.children].map(s => `${s.localName}:${s.getAttribute('name')}`)]),
      queries: [el.defaultSlot, el.expandedIconSlot, el.collapsedIconSlot].map(s => s?.localName + ':' + s?.getAttribute('name')),
      roles: [el.getAttribute('role'), el.getAttribute('tabindex'), el.getAttribute('aria-multiselectable')],
    };
  });
  expect(r).toEqual({
    base: ['div', 'tree', 'base'],
    children: [['slot', false, null, []], ['span', true, 'true', ['slot:expand-icon']], ['span', true, 'true', ['slot:collapse-icon']]],
    queries: ['slot:null', 'slot:expand-icon', 'slot:collapse-icon'],
    roles: ['tree', '0', 'false'],
  });
});

test('computed styles match Shoelace: block host with a zero font size, the indent custom properties and the large indent size (quirk)', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('sl-tree').first().evaluate(el => {
    const cs = getComputedStyle(el);
    const probe = document.createElement('div');
    probe.style.cssText = 'margin-left: var(--sl-spacing-large); padding-left: var(--sl-spacing-medium)';
    document.body.append(probe);
    const p = getComputedStyle(probe);
    const expected = { large: p.marginLeft, medium: p.paddingLeft };
    probe.remove();
    return {
      display: cs.display, fontSize: cs.fontSize, boxSizing: cs.boxSizing,
      indentSize: cs.getPropertyValue('--indent-size'),
      offset: cs.getPropertyValue('--indent-guide-offset').trim(), style: cs.getPropertyValue('--indent-guide-style').trim(), width: cs.getPropertyValue('--indent-guide-width').trim(),
      expected,
    };
  });
  expect(r.display).toBe('block');
  expect(r.fontSize).toBe('0px');
  expect(r.boxSizing).toBe('border-box');
  expect([r.offset, r.style, r.width]).toEqual(['0', 'solid', '0']);
  // The documented default is the medium spacing; the stylesheet uses the large one (and these two differ in the theme).
  expect(r.expected.large).not.toBe(r.expected.medium);
  expect(r.indentSize.trim()).toBe('1.25rem');
  expect(r.expected.large).toBe('20px');
});

test('properties: selection defaults to single, is not reflected, follows its attribute; dir and lang are undefined and not reflected', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-tree id="t"><sl-tree-item>One</sl-tree-item></sl-tree><sl-tree id="u" selection="multiple"><sl-tree-item>Two</sl-tree-item></sl-tree>');
  const r = await frame.locator('body').evaluate(async () => {
    const t = document.getElementById('t');
    const u = document.getElementById('u');
    const out = { initial: [t.selection, u.selection], dirLang: [t.dir, t.lang, t.hasAttribute('dir'), t.hasAttribute('lang')] };
    t.selection = 'leaf';
    await t.updateComplete;
    out.afterSet = [t.selection, t.hasAttribute('selection')];
    t.setAttribute('selection', 'multiple');
    await t.updateComplete;
    out.afterAttribute = t.selection;
    t.dir = 'rtl';
    t.lang = 'fr';
    await t.updateComplete;
    out.reflected = [t.hasAttribute('dir'), t.hasAttribute('lang')];
    out.observed = ['selection', 'dir', 'lang'].every(a => customElements.get('sl-tree').observedAttributes.includes(a));
    return out;
  });
  expect(r).toEqual({
    initial: ['single', 'multiple'], dirLang: [undefined, undefined, false, false], afterSet: ['leaf', false], afterAttribute: 'multiple',
    reflected: [false, false], observed: true,
  });
});

test('aria-multiselectable follows selection; role and tabindex replace what the page gave (quirk)', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-tree id="t" role="list" tabindex="3" aria-multiselectable="true"><sl-tree-item>One</sl-tree-item></sl-tree>');
  const read = () => frame.locator('#t').evaluate(el => [el.getAttribute('role'), el.getAttribute('tabindex'), el.getAttribute('aria-multiselectable')]);
  // aria-multiselectable is rewritten on the first update (selection is "changed" from undefined to single).
  expect(await read()).toEqual(['tree', '0', 'false']);
  await setTree(frame, { selection: 'multiple' });
  expect(await read()).toEqual(['tree', '0', 'true']);
  await setTree(frame, { selection: 'leaf' });
  expect(await read()).toEqual(['tree', '0', 'false']);
  await setTree(frame, { selection: 'single' });
  expect(await read()).toEqual(['tree', '0', 'false']);
});

test('single selection: a click on an item selects only it and emits sl-selection-change once, bubbling and composed; clicking it again emits nothing', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, FIXTURE);
  await recordSelection(frame);
  await label(frame, 'a').click();
  await expect.poll(() => selectedIds(frame)).toEqual(['a']);
  await expect.poll(() => selectionEvents(frame)).toEqual([{ ids: ['a'], bubbles: true, composed: true, cancelable: false, target: true }]);
  expect(await frame.locator('#t').evaluate(el => [...el.querySelectorAll('sl-tree-item')].map(i => i.getAttribute('aria-selected')))).toEqual(['true', 'false', 'false', 'false', 'false', 'false', 'false', 'false']);
  // Quirk: in single mode a click on a branch selects it and does not toggle it.
  expect(await frame.locator('#a').evaluate(el => [el.expanded, el.hasAttribute('expanded')])).toEqual([false, false]);
  await label(frame, 'c').click();
  await expect.poll(() => selectedIds(frame)).toEqual(['c']);
  await expect.poll(() => selectionEvents(frame).then(e => e.map(x => x.ids))).toEqual([['a'], ['c']]);
  await label(frame, 'c').click();
  // The event is emitted after the items have updated: give a repeat (which would be emitted) the time it would need.
  await frame.locator('#c').evaluate(el => el.updateComplete);
  await frame.locator('body').evaluate(() => new Promise(resolve => setTimeout(resolve, 50)));
  expect((await selectionEvents(frame)).map(x => x.ids)).toEqual([['a'], ['c']]);
});

test('the expand button toggles an item without selecting it, and a disabled item ignores clicks', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, FIXTURE);
  await recordSelection(frame);
  await frame.locator('#a').evaluate(el => {
    el.events = [];
    for (const type of ['sl-expand', 'sl-after-expand', 'sl-collapse', 'sl-after-collapse']) {
      el.addEventListener(type, e => el.events.push({ type, bubbles: e.bubbles, composed: e.composed, cancelable: e.cancelable }));
    }
  });
  await expandButton(frame, 'a').click();
  await expect.poll(() => frame.locator('#a').evaluate(el => el.events.map(e => e.type))).toEqual(['sl-expand', 'sl-after-expand']);
  expect(await frame.locator('#a').evaluate(el => [el.expanded, el.getAttribute('aria-expanded'), el.hasAttribute('expanded')])).toEqual([true, 'true', true]);
  expect(await frame.locator('#a').evaluate(el => el.events.every(e => e.bubbles && e.composed && !e.cancelable))).toBe(true);
  await expandButton(frame, 'a').click();
  await expect.poll(() => frame.locator('#a').evaluate(el => el.events.map(e => e.type))).toEqual(['sl-expand', 'sl-after-expand', 'sl-collapse', 'sl-after-collapse']);
  expect(await frame.locator('#a').evaluate(el => [el.expanded, el.getAttribute('aria-expanded')])).toEqual([false, 'false']);
  // Nothing was selected by any of that.
  expect(await selectedIds(frame)).toEqual([]);
  expect(await selectionEvents(frame)).toEqual([]);
  // A disabled item: neither its label nor its button does anything.
  await expandAndWait(frame, 'a');
  // Playwright treats the item as disabled (aria-disabled), so the click is forced.
  await label(frame, 'a3').click({ force: true });
  await frame.locator('#a3').evaluate(el => el.updateComplete);
  expect(await selectedIds(frame)).toEqual([]);
  expect(await selectionEvents(frame)).toEqual([]);
});

test('leaf selection: a click on a branch only toggles it, with no selection and no event; a click on a leaf selects it (quirk)', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, FIXTURE);
  await setTree(frame, { selection: 'leaf' });
  await recordSelection(frame);
  await label(frame, 'a').click();
  await expect.poll(() => frame.locator('#a').evaluate(el => el.expanded)).toBe(true);
  expect(await selectedIds(frame)).toEqual([]);
  await label(frame, 'a').click();
  await expect.poll(() => frame.locator('#a').evaluate(el => el.expanded)).toBe(false);
  await label(frame, 'c').click();
  await expect.poll(() => selectedIds(frame)).toEqual(['c']);
  expect((await selectionEvents(frame)).map(e => e.ids)).toEqual([['c']]);
});

test('multiple selection: items show checkboxes, a parent follows its enabled children (indeterminate in between) and the event lists the selected items in document order', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, FIXTURE);
  await setTree(frame, { selection: 'multiple' });
  await recordSelection(frame);
  expect(await frame.locator('#t').evaluate(el => [...el.querySelectorAll('sl-tree-item')].map(i => [i.selectable, Boolean(i.shadowRoot.querySelector('sl-checkbox.tree-item__checkbox'))]).flat().every(Boolean))).toBe(true);
  expect(await frame.locator('#t').evaluate(el => el.getAttribute('aria-multiselectable'))).toBe('true');
  await expandAndWait(frame, 'a');
  const state = () => frame.locator('#t').evaluate(el => ['a', 'a1', 'a2', 'a3'].map(id => { const i = el.querySelector('#' + id); return [i.selected, i.indeterminate]; }));
  await label(frame, 'a1').click();
  await expect.poll(() => state()).toEqual([[false, true], [true, false], [false, false], [false, false]]);
  await label(frame, 'a2').click();
  // Both enabled children are selected, so the parent is; the disabled child does not count.
  await expect.poll(() => state()).toEqual([[true, false], [true, false], [true, false], [false, false]]);
  await expect.poll(() => selectionEvents(frame).then(e => e.map(x => x.ids))).toEqual([['a1'], ['a', 'a1', 'a2']]);
  // The checkbox in the item follows (it is Velcro's sl-checkbox, driven through checked and indeterminate).
  expect(await frame.locator('#a').evaluate(async el => { const c = el.shadowRoot.querySelector('sl-checkbox'); await c.updateComplete; return [c.checked, c.indeterminate, c.disabled]; })).toEqual([true, false, false]);
  expect(await frame.locator('#a3').evaluate(el => el.shadowRoot.querySelector('sl-checkbox').disabled)).toBe(true);
  // Clicking the selected parent clears it and its enabled descendants; clicking it again selects them (never the disabled one).
  await label(frame, 'a').click();
  await expect.poll(() => state()).toEqual([[false, false], [false, false], [false, false], [false, false]]);
  await label(frame, 'a').click();
  await expect.poll(() => state()).toEqual([[true, false], [true, false], [true, false], [false, false]]);
  await expect.poll(() => selectionEvents(frame).then(e => e.map(x => x.ids))).toEqual([['a1'], ['a', 'a1', 'a2'], [], ['a', 'a1', 'a2']]);
});

test('multiple selection: switching to it propagates a selected parent to its children and sets the parent state (initial sync)', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, FIXTURE.replace('id="a"', 'id="a" selected').replace('id="b1"', 'id="b1" selected'));
  await setTree(frame, { selection: 'multiple' });
  await expect.poll(() => frame.locator('#t').evaluate(el => ['a', 'a1', 'a2', 'a3', 'b', 'b1', 'b2'].map(id => { const i = el.querySelector('#' + id); return [i.selected, i.indeterminate]; })))
    .toEqual([[true, false], [true, false], [true, false], [true, false], [false, true], [true, false], [false, false]]);
});

test('multiple selection: selecting a lazy item also expands it, which starts the lazy load (quirk)', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-tree id="t"><sl-tree-item id="lz" lazy>Lazy</sl-tree-item></sl-tree>');
  await setTree(frame, { selection: 'multiple' });
  await frame.locator('#lz').evaluate(el => { el.events = []; el.addEventListener('sl-lazy-load', () => el.events.push('sl-lazy-load')); });
  await label(frame, 'lz').click();
  await expect.poll(() => frame.locator('#lz').evaluate(el => [el.selected, el.expanded, el.loading, el.events])).toEqual([true, true, true, ['sl-lazy-load']]);
  expect(await frame.locator('#lz').evaluate(el => el.getAttribute('aria-busy'))).toBe('true');
});

test('script changes of selected emit no sl-selection-change and do not deselect others in single mode (quirk)', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, FIXTURE);
  await recordSelection(frame);
  await frame.locator('#t').evaluate(async el => {
    el.querySelector('#a').selected = true;
    el.querySelector('#c').selected = true;
    await el.querySelector('#c').updateComplete;
    await new Promise(resolve => setTimeout(resolve, 50));
  });
  expect(await selectedIds(frame)).toEqual(['a', 'c']);
  expect(await selectionEvents(frame)).toEqual([]);
  expect(await frame.locator('#t').evaluate(el => el.selectedItems.map(i => i.id))).toEqual(['a', 'c']);
  // The next selection through the tree reads the whole set, so a click on a third item replaces both.
  await label(frame, 'b').click();
  await expect.poll(() => selectedIds(frame)).toEqual(['b']);
  await expect.poll(() => selectionEvents(frame).then(e => e.map(x => x.ids))).toEqual([['b']]);
});

test('keyboard: arrows, Home and End move focus through the focusable items; Right and Left expand and collapse; Enter and Space select; a letter does nothing', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, FIXTURE);
  await recordSelection(frame);
  // Focusing the tree moves focus to its first item.
  await frame.locator('#t').focus();
  expect(await focusedId(frame)).toBe('a');
  const press = async key => { await page.keyboard.press(key); return focusedId(frame); };
  expect(await press('ArrowDown')).toBe('b');
  expect(await press('ArrowDown')).toBe('c');
  expect(await press('ArrowDown')).toBe('c');
  expect(await press('ArrowUp')).toBe('b');
  expect(await press('Home')).toBe('a');
  expect(await press('ArrowUp')).toBe('a');
  expect(await press('End')).toBe('c');
  expect(await press('Home')).toBe('a');
  // No type-ahead in Shoelace's tree.
  expect(await press('KeyB')).toBe('a');
  // Right expands a collapsed branch and keeps focus; on an expanded one it moves to the next focusable item.
  expect(await press('ArrowRight')).toBe('a');
  expect(await frame.locator('#a').evaluate(el => el.expanded)).toBe(true);
  expect(await press('ArrowRight')).toBe('a1');
  // Quirk: on a leaf Right moves to the next item (it does not stop at an end node), and Left to the previous one (not the parent).
  expect(await press('ArrowRight')).toBe('a2');
  expect(await press('ArrowLeft')).toBe('a1');
  expect(await press('ArrowRight')).toBe('a2');
  // The disabled child is skipped in both directions.
  expect(await press('ArrowDown')).toBe('b');
  expect(await press('ArrowUp')).toBe('a2');
  expect(await press('ArrowDown')).toBe('b');
  // Left on an expanded branch collapses it.
  expect(await press('ArrowUp')).toBe('a2');
  expect(await press('Home')).toBe('a');
  expect(await press('ArrowLeft')).toBe('a');
  expect(await frame.locator('#a').evaluate(el => el.expanded)).toBe(false);
  // Enter and Space select the focused item.
  expect(await press('ArrowDown')).toBe('b');
  await page.keyboard.press('Enter');
  await expect.poll(() => selectedIds(frame)).toEqual(['b']);
  expect(await press('End')).toBe('c');
  await page.keyboard.press('Space');
  await expect.poll(() => selectedIds(frame)).toEqual(['c']);
  expect((await selectionEvents(frame)).map(e => e.ids)).toEqual([['b'], ['c']]);
  // The tab stop moved with focus.
  expect(await frame.locator('#t').evaluate(el => [el.tabIndex, ...[...el.querySelectorAll('sl-tree-item')].map(i => i.tabIndex)])).toEqual([-1, -1, -1, -1, -1, -1, -1, -1, 0]);
});

test('keyboard: the arrows swap in right-to-left text, and the keys leave a nested input alone', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, FIXTURE.replace('Charlie', 'Charlie <input id="field">'));
  await setTree(frame, { dir: 'rtl' });
  await frame.locator('#t').focus();
  expect(await focusedId(frame)).toBe('a');
  await page.keyboard.press('ArrowRight');
  expect(await frame.locator('#a').evaluate(el => el.expanded)).toBe(false);
  await page.keyboard.press('ArrowLeft');
  expect(await frame.locator('#a').evaluate(el => el.expanded)).toBe(true);
  await page.keyboard.press('ArrowRight');
  expect(await frame.locator('#a').evaluate(el => el.expanded)).toBe(false);
  // A key pressed in a text field inside an item is not handled (not even prevented), so the caret keeps working.
  await frame.locator('#field').evaluate(el => {
    window.keys = [];
    document.addEventListener('keydown', e => window.keys.push([e.key, e.defaultPrevented]));
    el.focus();
  });
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Home');
  expect(await focusedId(frame)).toBe('field');
  expect(await frame.locator('body').evaluate(() => window.keys)).toEqual([['ArrowDown', false], ['Home', false]]);
});

test('keyboard: Enter with focus on an element inside the tree that is not an item throws a TypeError after preventing the key (quirk); the arrows still work', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-tree id="t"><sl-tree-item id="x">X <button id="btn" type="button">Button</button></sl-tree-item><sl-tree-item id="y">Y</sl-tree-item></sl-tree>');
  // The error is recorded in the example document itself: its `error` event carries the thrown object, so the check is of the
  // type (in that document's realm), not of an engine's message wording or of how an engine reports an error from a frame.
  await frame.locator('#btn').evaluate(el => {
    window.uncaught = [];
    window.addEventListener('error', event => window.uncaught.push({ typeError: event.error instanceof TypeError }));
    window.clicks = 0;
    el.addEventListener('click', () => window.clicks++);
    el.focus();
  });
  expect(await focusedId(frame)).toBe('btn');
  await page.keyboard.press('Enter');
  await expect.poll(() => frame.locator('body').evaluate(() => window.uncaught)).toEqual([{ typeError: true }]);
  // The key's default action was prevented before the throw: the button was not activated.
  expect(await frame.locator('body').evaluate(() => window.clicks)).toBe(0);
  // From there the arrows move to an item: no item has focus, so ArrowDown goes to the first one.
  await page.keyboard.press('ArrowDown');
  expect(await focusedId(frame)).toBe('x');
  expect(await frame.locator('body').evaluate(() => window.uncaught)).toEqual([{ typeError: true }]);
});

test('roving tabindex: focus moves the tab stop to the item, and leaving the tree leaves both the tree and the last item as tab stops (quirk)', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, FIXTURE + '<button id="out" type="button">Out</button>');
  const stops = () => frame.locator('#t').evaluate(el => [el.tabIndex, ...[...el.querySelectorAll('sl-tree-item')].map(i => i.tabIndex)]);
  expect(await stops()).toEqual([0, -1, -1, -1, -1, -1, -1, -1, -1]);
  await frame.locator('#t').focus();
  await page.keyboard.press('ArrowDown');
  expect(await focusedId(frame)).toBe('b');
  expect(await stops()).toEqual([-1, -1, -1, -1, -1, 0, -1, -1, -1]);
  await frame.locator('#out').focus();
  expect(await stops()).toEqual([0, -1, -1, -1, -1, 0, -1, -1, -1]);
  // Focusing the tree again returns to the last focused item.
  await frame.locator('#t').focus();
  expect(await focusedId(frame)).toBe('b');
});

test('the expand-icon and collapse-icon slots: the tree clones each icon into every item, keeping an item\'s own icon and initializing items added later', async ({ page }) => {
  const { frame } = await openExample(page, 'Customizing the Expand and Collapse Icons');
  const r = await frame.locator('sl-tree').evaluate(async tree => {
    await tree.updateComplete;
    const items = [...tree.querySelectorAll('sl-tree-item')];
    await Promise.all(items.map(i => i.updateComplete));
    const icons = item => ['expand', 'collapse'].map(status => [...item.children].filter(c => c.slot === `${status}-icon`).map(c => [c.localName, c.getAttribute('name'), c.hasAttribute('data-default'), c.hasAttribute('id')]));
    return { count: items.length, perItem: [...new Set(items.map(i => JSON.stringify(icons(i))))], tree: [...tree.children].filter(c => c.slot).map(c => [c.slot, c.getAttribute('name'), c.hasAttribute('data-default')]) };
  });
  expect(r.count).toBe(15);
  expect(r.perItem).toEqual([JSON.stringify([[['sl-icon', 'plus-square', true, false]], [['sl-icon', 'dash-square', true, false]]])]);
  expect(r.tree).toEqual([['expand-icon', 'plus-square', false], ['collapse-icon', 'dash-square', false]]);
  // Items added later are initialized by the tree (its observer or its slot change), and an item's own icon is left alone.
  const added = await frame.locator('sl-tree').evaluate(async tree => {
    const item = document.createElement('sl-tree-item');
    item.textContent = 'New';
    tree.append(item);
    const own = document.createElement('sl-tree-item');
    own.innerHTML = 'Own <sl-icon slot="expand-icon" name="heart" id="own-icon"></sl-icon>';
    tree.append(own);
    for (let i = 0; i < 50 && !(item.querySelector('[slot=expand-icon]') && own.querySelector('[slot=collapse-icon]')); i++) await new Promise(resolve => setTimeout(resolve, 20));
    const names = el => [...el.children].filter(c => c.slot).map(c => `${c.slot}:${c.getAttribute('name')}:${c.hasAttribute('data-default')}`);
    return { item: names(item), own: names(own) };
  });
  expect(added.item).toEqual(['expand-icon:plus-square:true', 'collapse-icon:dash-square:true']);
  expect(added.own).toEqual(['expand-icon:heart:false', 'collapse-icon:dash-square:true']);
});

test('the expand button rotates a quarter turn when expanded, and the Customizing example turns that off with its rule on the expand-button part', async ({ page }) => {
  const { frame } = await openExample(page);
  const rotate = (f, selector) => f.locator('sl-tree-item').first().evaluate(async (el, selector) => {
    el.expanded = true;
    await el.updateComplete;
    await new Promise(resolve => setTimeout(resolve, 400));
    return getComputedStyle(el.shadowRoot.querySelector(selector)).rotate;
  }, selector);
  expect(await rotate(frame, '[part="expand-button"]')).toBe('90deg');
  const custom = frameFor(page, 'Customizing the Expand and Collapse Icons');
  await expect(custom.locator('sl-tree-item').first()).toBeAttached();
  expect(await rotate(custom, '[part="expand-button"]')).toBe('none');
});

test('the Indent Guides example draws the guide with its custom property on the nested items\' group', async ({ page }) => {
  const { frame } = await openExample(page, 'Showing Indent Guides');
  const r = await frame.locator('sl-tree').evaluate(async tree => {
    const first = tree.querySelector('sl-tree-item');
    await first.updateComplete;
    const group = first.shadowRoot.querySelector('.tree-item__children');
    const before = getComputedStyle(group, '::before');
    return { custom: getComputedStyle(tree).getPropertyValue('--indent-guide-width').trim(), width: before.borderInlineEndWidth, style: before.borderInlineEndStyle, expanded: [...tree.querySelectorAll('sl-tree-item')].filter(i => i.expanded).length };
  });
  expect(r).toEqual({ custom: '1px', width: '1px', style: 'solid', expanded: 2 });
});

test('Lazy Loading example: expanding the item shows the spinner and emits sl-lazy-load; the loaded children appear, lazy is removed and the item expands', async ({ page }) => {
  const { frame } = await openExample(page, 'Lazy Loading');
  // The example removes the lazy attribute once its content is loaded, so the item is found by position, not by [lazy].
  const item = frame.locator('sl-tree-item').first();
  await expect(item).toBeAttached();
  await item.evaluate(el => { el.events = []; for (const t of ['sl-lazy-load', 'sl-expand', 'sl-after-expand', 'sl-lazy-change']) el.addEventListener(t, () => el.events.push(t)); });
  expect(await item.evaluate(el => [el.lazy, el.isLeaf, el.getAttribute('aria-expanded')])).toEqual([true, false, 'false']);
  await item.locator('.tree-item__expand-button').first().click();
  await expect.poll(() => item.evaluate(el => [el.loading, el.getAttribute('aria-busy'), Boolean(el.shadowRoot.querySelector('sl-spinner'))])).toEqual([true, 'true', true]);
  expect(await item.evaluate(el => el.events)).toEqual(['sl-lazy-load']);
  // The example's script appends four items after a second and clears lazy.
  await expect.poll(() => item.evaluate(el => [el.loading, el.lazy, el.querySelectorAll('sl-tree-item').length, el.getAttribute('aria-busy'), Boolean(el.shadowRoot.querySelector('sl-spinner'))]), { timeout: 15000 })
    .toEqual([false, false, 4, 'false', false]);
  await expect.poll(() => item.evaluate(el => el.events)).toEqual(['sl-lazy-load', 'sl-lazy-change', 'sl-expand', 'sl-after-expand']);
  expect(await item.evaluate(el => [el.expanded, el.getAttribute('aria-expanded'), el.isLeaf, el.getChildrenItems().map(i => i.textContent.trim())])).toEqual([true, 'true', false, ['Birch', 'Cedar', 'Maple', 'Pine']]);
});

test('Selection Modes example: the select\'s value becomes the tree\'s selection and clears the selected items', async ({ page }) => {
  const { frame } = await openExample(page, 'Selection Modes');
  await frame.locator('#selection-mode').evaluate(el => customElements.whenDefined('sl-select').then(() => el.updateComplete));
  const r = await frame.locator('body').evaluate(async () => {
    const select = document.querySelector('#selection-mode');
    const tree = document.querySelector('.tree-selectable');
    const items = [...tree.querySelectorAll('sl-tree-item')];
    const out = { initial: [select.value, tree.selection, items.length] };
    for (const mode of ['multiple', 'leaf', 'single']) {
      items[0].selected = true;
      select.value = mode;
      await select.updateComplete;
      select.dispatchEvent(new CustomEvent('sl-change', { bubbles: true, composed: true }));
      await tree.updateComplete;
      await Promise.all(items.map(i => i.updateComplete));
      out[mode] = [tree.selection, items.some(i => i.selected), items.every(i => i.selectable === (mode === 'multiple'))];
    }
    return out;
  });
  expect(r).toEqual({ initial: ['single', 'single', 9], multiple: ['multiple', false, true], leaf: ['leaf', false, true], single: ['single', false, true] });
  // The three options are the ones in Shoelace's example.
  expect(await frame.locator('#selection-mode sl-option').evaluateAll(list => list.map(o => [o.value, o.textContent.trim()]))).toEqual([['single', 'Single'], ['multiple', 'Multiple'], ['leaf', 'Leaf']]);
});

test('With Icons example renders its folders and files with their icons', async ({ page }) => {
  const { frame } = await openExample(page, 'With Icons');
  const r = await frame.locator('sl-tree').evaluate(async tree => {
    const items = [...tree.querySelectorAll('sl-tree-item')];
    await Promise.all(items.map(i => i.updateComplete));
    return { tree: tree.className, items: items.length, expanded: items.filter(i => i.expanded).map(i => i.firstElementChild.getAttribute('name')), icons: items.map(i => i.querySelector(':scope > sl-icon:not([slot])').getAttribute('name')) };
  });
  expect(r.tree).toBe('tree-with-icons');
  expect(r.items).toBe(9);
  expect(r.expanded).toEqual(['folder']);
  expect(r.icons).toEqual(['folder', 'folder', 'image', 'image', 'image', 'folder', 'file', 'file-pdf', 'file-bar-graph']);
});

test('inherited core ready event: dispatched once on the tree after its first update, not bubbling or composed', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('body').evaluate(async body => {
    const el = document.createElement('sl-tree');
    const seen = [];
    let bubbled = 0;
    el.addEventListener('ready', event => seen.push({ bubbles: event.bubbles, composed: event.composed }));
    body.addEventListener('ready', () => bubbled++);
    body.append(el);
    await el.updateComplete;
    el.selection = 'leaf';
    await el.updateComplete;
    el.remove();
    return { seen, bubbled };
  });
  expect(r).toEqual({ seen: [{ bubbles: false, composed: false }], bubbled: 0 });
});

test.describe('class-only entry', () => {
  let bundle;

  test.beforeAll(async () => {
    const fromDocs = createRequire(path.join(docsDir, 'package.json'));
    const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
    const dir = mkdtempSync(path.join(tmpdir(), 'velcro-tree-class-'));
    try {
      const entry = path.join(dir, 'entry.js');
      writeFileSync(entry, `
        import { SlTree, VelcroTree } from '@charm-ux/velcro/tree/class';
        window.treeClass = { SlTree, VelcroTree };
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

  test('importing defines nothing, and the tree has no dependencies to define: constructing it registers no other tag', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.setContent('<!DOCTYPE html><html><body></body></html>');
    await page.addScriptTag({ type: 'module', content: bundle });
    await page.waitForFunction(() => Boolean(window.treeClass));
    const r = await page.evaluate(async () => {
      const { SlTree, VelcroTree } = window.treeClass;
      const tags = () => ['sl-tree', 'sl-tree-item', 'sl-checkbox', 'sl-icon', 'sl-spinner'].map(t => customElements.get(t)?.name ?? null);
      const afterImport = tags();
      customElements.define('sl-tree', SlTree);
      const el = document.createElement('sl-tree');
      document.body.append(el);
      await el.updateComplete;
      return { same: SlTree === VelcroTree, afterImport, afterConstruct: tags(), role: el.getAttribute('role'), base: Boolean(el.shadowRoot.querySelector('[part="base"]')) };
    });
    expect(r).toEqual({ same: true, afterImport: [null, null, null, null, null], afterConstruct: ['VelcroTree', null, null, null, null], role: 'tree', base: true });
    expect(pageErrors).toEqual([]);
  });
});

test('every docs example renders in its own document', async ({ page }) => {
  await openDocs(page, PAGE);
  const titles = await page.locator('iframe.example').evaluateAll(frames => frames.map(f => f.title));
  expect(titles).toEqual(EXAMPLES.map(([t]) => `Tree example: ${t}`));
  for (const title of titles) {
    const frame = page.frameLocator(`iframe.example[title="${title}"]`);
    await expect(frame.locator('sl-tree').first()).toBeAttached();
    expect(await frame.locator('sl-tree').first().evaluate(async el => {
      await customElements.whenDefined('sl-tree');
      await el.updateComplete;
      return Boolean(el.shadowRoot?.querySelector('[part="base"]')) && el.querySelector('sl-tree-item')?.shadowRoot?.querySelector('[part="base"]') !== null;
    })).toBe(true);
  }
});

test('no upstream Shoelace runtime is requested or defined; all requests stay on the local origin', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  expect(await frame.locator('body').evaluate(() => Boolean(window.Shoelace || document.querySelector('script[src*="shoelace"]')))).toBe(false);
});

// The values that matter in a rendered example, which an HTML example and its React version must share: each tree's
// selection and its items' own label, state and decorative icons, in document order, with their depth.
const summarize = async () => {
  const out = [];
  for (const tree of document.querySelectorAll('sl-tree')) {
    await tree.updateComplete;
    const items = [...tree.querySelectorAll('sl-tree-item')];
    await Promise.all(items.map(i => i.updateComplete));
    out.push({
      selection: tree.selection,
      icons: [...tree.children].filter(c => c.slot).map(c => `${c.localName}:${c.slot}:${c.getAttribute('name')}`),
      items: items.map(i => ({
        depth: (() => { let d = 0; for (let p = i.parentElement; p && p !== tree; p = p.parentElement) d++; return d; })(),
        text: [...i.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ').replace(/\s+/g, ' ').trim(),
        expanded: i.expanded, selected: i.selected, disabled: i.disabled, lazy: i.lazy,
        icons: [...i.children].filter(c => c.localName === 'sl-icon' && !c.hasAttribute('data-default')).map(c => `${c.slot}:${c.getAttribute('name')}`),
      })),
    });
  }
  return out;
};

// Shoelace's React examples, ported in packages/docs/examples/tree/react/*.jsx (the files the docs page shows), bundled with
// React 19 and the generated wrappers, which are resolved through the package's real export map.
test.describe('React examples', () => {
  const reactDir = fileURLToPath(new URL('../../packages/docs/examples/tree/react/', import.meta.url));
  let bundle;

  test.beforeAll(async () => {
    const fromVelcro = createRequire(path.join(velcroDir, 'package.json'));
    const fromDocs = createRequire(path.join(docsDir, 'package.json'));
    const pkgDir = name => path.dirname(fromVelcro.resolve(`${name}/package.json`));
    const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
    const dir = mkdtempSync(path.join(tmpdir(), 'velcro-tree-react-'));
    try {
      for (const [, name] of EXAMPLES) {
        writeFileSync(path.join(dir, `${name}.jsx`), `${readFileSync(path.join(reactDir, `${name}.jsx`), 'utf8')}\nexport default App;\n`);
      }
      const entry = path.join(dir, 'entry.js');
      writeFileSync(entry, `
        import React from 'react';
        import { createRoot } from 'react-dom/client';
        import { VelcroTree } from '@charm-ux/velcro/react/VelcroTree.js';
        import { VelcroTreeItem } from '@charm-ux/velcro/react/VelcroTreeItem.js';
        ${EXAMPLES.map(([, name], i) => `import App${i} from './${name}.jsx';`).join('\n')}
        const apps = { ${EXAMPLES.map(([, name], i) => `${JSON.stringify(name)}: App${i}`).join(', ')} };
        window.errors = [];
        addEventListener('error', e => window.errors.push(String(e.message)));
        addEventListener('unhandledrejection', e => window.errors.push(String(e.reason)));
        const consoleError = console.error;
        console.error = (...args) => { window.errors.push(args.map(String).join(' ').slice(0, 300)); consoleError(...args); };
        window.reactVersion = React.version;
        window.renderExample = name => {
          const host = document.createElement('div');
          document.body.append(host);
          createRoot(host).render(React.createElement(apps[name]));
        };
        window.renderEvents = () => {
          const host = document.createElement('div');
          document.body.append(host);
          window.reactEvents = [];
          createRoot(host).render(React.createElement(VelcroTree, { id: 'wrapped', selection: 'multiple', onSlSelectionChange: event => window.reactEvents.push([event.target.id, event.detail.selection.map(i => i.id)]) },
            React.createElement(VelcroTreeItem, { id: 'one', expanded: true }, 'One', React.createElement(VelcroTreeItem, { id: 'two' }, 'Two')),
            React.createElement(VelcroTreeItem, { id: 'three', disabled: true }, 'Three')));
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

  async function load(page) {
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.setContent('<!DOCTYPE html><html class="sl-theme-light"><body style="margin: 0"></body></html>');
    await page.addStyleTag({ content: readFileSync(path.join(velcroDir, 'themes/light.css'), 'utf8') });
    await page.addScriptTag({ type: 'module', content: bundle });
    await page.waitForFunction(() => typeof window.renderExample === 'function');
    return pageErrors;
  }

  test('every React example renders the same tree as the HTML example it belongs to (With Icons is a different tree in Shoelace\'s React version)', async ({ page }) => {
    test.setTimeout(150_000);
    const htmlPage = await page.context().newPage();
    watchNetwork(htmlPage);
    const expected = {};
    try {
      await openDocs(htmlPage, PAGE);
      await documentsLoaded(htmlPage);
      for (const [title, name] of EXAMPLES) {
        const frame = frameFor(htmlPage, title);
        await expect(frame.locator('sl-tree').first()).toBeAttached();
        await frame.locator('body').evaluate(() => customElements.whenDefined('sl-tree-item'));
        expected[name] = await frame.locator('body').evaluate(summarize);
      }
    } finally {
      await htmlPage.close();
    }
    const pageErrors = await load(page);
    expect(await page.evaluate(() => window.reactVersion)).toBe('19.2.0');
    for (const [, name] of EXAMPLES) {
      await page.evaluate(n => { document.body.replaceChildren(); window.renderExample(n); }, name);
      await page.waitForFunction(() => document.querySelector('sl-tree-item'));
      await page.evaluate(() => customElements.whenDefined('sl-tree-item'));
      const actual = await page.evaluate(summarize);
      expect(actual.length, name).toBeGreaterThan(0);
      if (name === 'with-icons') {
        expect(actual[0].items.map(i => i.text)).toEqual(['Root', 'Folder 1', 'File 1 - 1', 'File 1 - 2', 'File 1 - 3', 'Folder 2', 'File 2 - 1', 'File 2 - 2', 'File 1']);
        expect(actual[0].items.filter(i => i.disabled).map(i => i.text)).toEqual(['File 1 - 2']);
      } else {
        expect(actual, name).toEqual(expected[name]);
      }
    }
    expect(await page.evaluate(() => window.errors)).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('the wrapper passes selection to the tree and takes onSlSelectionChange; the Indent Guides React example sets the custom property through style', async ({ page }) => {
    const pageErrors = await load(page);
    await page.evaluate(() => window.renderEvents());
    const tree = page.locator('sl-tree');
    await expect(tree).toBeAttached();
    await page.evaluate(() => customElements.whenDefined('sl-tree-item'));
    await expect.poll(() => tree.evaluate(el => [el.selection, el.getAttribute('aria-multiselectable')])).toEqual(['multiple', 'true']);
    await page.locator('#one').locator('.tree-item__label').first().click();
    await expect.poll(() => page.evaluate(() => window.reactEvents)).toEqual([['wrapped', ['one', 'two']]]);
    await page.evaluate(() => { document.body.replaceChildren(); window.renderExample('indent-guides'); });
    await expect(page.locator('sl-tree')).toBeAttached();
    expect(await page.locator('sl-tree').evaluate(el => [el.className, getComputedStyle(el).getPropertyValue('--indent-guide-width').trim()])).toEqual(['tree-with-lines', '1px']);
    expect(await page.evaluate(() => window.errors)).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
