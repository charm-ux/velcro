// sl-tree-item product checks against Shoelace 2.20.1's tree item contract, through the docs page's examples.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';
import { buildFixtures, gotoBlank } from './support/fixtures.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/tree-item';
const docsDir = fileURLToPath(new URL('../../packages/docs/', import.meta.url));
const velcroDir = fileURLToPath(new URL('../../packages/velcro/', import.meta.url));

// The docs page's examples, in Shoelace's order: the example's title and the name of its files under examples/tree-item/.
const EXAMPLES = [
  ['Overview', 'default'],
  ['Nested tree items', 'nested'],
  ['Selected', 'selected'],
  ['Expanded', 'expanded'],
];

const frameFor = (page, title) => page.frameLocator(`iframe.example[title="Tree Item example: ${title}"]`);

async function openExample(page, name = 'Overview') {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  const frame = frameFor(page, name);
  await expect(frame.locator('sl-tree-item').first()).toBeAttached();
  await frame.locator('body').evaluate(() => Promise.all([customElements.whenDefined('sl-tree'), customElements.whenDefined('sl-tree-item')]));
  // Rendering only: a test that reads the requests waits for the network to go quiet itself (documentsLoaded).
  return { frame, requests };
}

// Mounts markup in the example document (replacing earlier mounts) and waits for every item in it to render.
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

// Records the sl-* events of the element with the given id in its own `events` array (their types, in order).
const record = (frame, id, types = ['sl-expand', 'sl-after-expand', 'sl-collapse', 'sl-after-collapse', 'sl-lazy-change', 'sl-lazy-load']) =>
  frame.locator(`#${id}`).evaluate((el, types) => {
    el.events = [];
    for (const type of types) el.addEventListener(type, () => el.events.push(type));
  }, types);
const events = (frame, id) => frame.locator(`#${id}`).evaluate(el => el.events);

test('docs page is prerendered with Velcro branding, prototype status, every Shoelace section, the quirks and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Tree Item - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('without changing the shared core prefix');
  expect(html).toContain('@charm-ux/velcro/utilities/animation-registry');
  for (const [title] of EXAMPLES) expect(html).toContain(`title="Tree Item example: ${title}"`);
  const examplesPart = html.slice(html.indexOf('id="examples"'), html.indexOf('id="attributes"'));
  expect([...examplesPart.matchAll(/<h3 id="([^"]+)"><!--lit-part-->([^<]+)<!--\/lit-part--><\/h3>/g)].map(m => m[1]))
    .toEqual(['overview', 'nested', 'selected', 'expanded']);
  expect(examplesPart).toContain('A tree item can contain other tree items.');
  expect(examplesPart).toContain('Use the <code>selected</code> attribute to select a tree item initially.');
  expect(examplesPart).toContain('Use the <code>expanded</code> attribute to expand a tree item initially.');
  expect(html).toContain('A tree item serves as a hierarchical node that lives inside a');
  expect(html.match(/<summary>React<\/summary>/g)).toHaveLength(EXAMPLES.length);
  expect(html).toContain('import { VelcroTreeItem as SlTreeItem } from &#39;@charm-ux/velcro/react/VelcroTreeItem.js&#39;;');
  expect(html).toContain('Inherited from @charm-ux/core CharmElement');
  for (const name of ['expanded', 'selected', 'disabled', 'lazy', 'getChildrenItems', 'sl-expand', 'sl-after-expand', 'sl-collapse',
    'sl-after-collapse', 'sl-lazy-change', 'sl-lazy-load', 'expand-icon', 'collapse-icon', 'base', 'item', 'item--disabled', 'item--expanded',
    'item--indeterminate', 'item--selected', 'indentation', 'expand-button', 'spinner', 'spinner__base', 'label', 'children', 'checkbox',
    'checkbox__base', 'checkbox__control', 'checkbox__control--checked', 'checkbox__control--indeterminate', 'checkbox__checked-icon',
    'checkbox__indeterminate-icon', 'checkbox__label']) {
    expect(html).toContain(`data-name="${name}"`);
  }
  expect(html).toContain('data-name="ready"');
  expect(html).toContain('A leaf can be expanded');
  expect(html).toContain('A lazy load ends when the children slot changes');
  expect(html).toContain('isLeaf is worked out when the item first renders');
  expect(html).toContain('stays null');
  expect(html).toContain('Shoelace&#39;s own tree item tests (13');
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
  const home = await (await request.get('/')).text();
  expect(home).toContain('/components/tree-item');
});

test('sl-tree-item registers inside the example document as the exported class, with its checkbox, icon and spinner, no core marker and no ch-* definitions', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  await documentsLoaded(page);
  const info = await frame.locator('body').evaluate(() => {
    const ctor = customElements.get('sl-tree-item');
    const el = document.querySelector('sl-tree-item');
    return {
      baseName: ctor?.baseName,
      coreTags: ['ch-tree-item', 'ch-tree'].map(t => customElements.get(t) !== undefined),
      viaConstructor: ctor ? new ctor().localName : null,
      instance: el instanceof ctor,
      dependencies: ['sl-checkbox', 'sl-icon', 'sl-spinner'].map(t => customElements.get(t)?.baseName),
      attrs: el.getAttributeNames().sort(),
    };
  });
  expect(info).toEqual({
    baseName: 'tree-item', coreTags: [false, false], viaConstructor: 'sl-tree-item', instance: true,
    dependencies: ['checkbox', 'icon', 'spinner'], attrs: ['aria-disabled', 'aria-expanded', 'aria-selected', 'role', 'tabindex'],
  });
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
});

test('structure: a base wrapper around the item row (indentation, expand button, label) and a children group, with Shoelace\'s parts and classes', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-tree-item id="p" expanded selected>Parent<sl-tree-item id="q">Child</sl-tree-item></sl-tree-item>');
  const r = await frame.locator('#p').evaluate(el => {
    const root = el.shadowRoot;
    const base = root.querySelector('[part="base"]');
    const row = root.querySelector('.tree-item__item');
    const button = root.querySelector('.tree-item__expand-button');
    const group = root.querySelector('.tree-item__children');
    const parts = [...root.querySelectorAll('[part]')].map(e => e.getAttribute('part').split(/\s+/).filter(Boolean).join(' '));
    return {
      base: [base.localName, [...base.classList].sort(), base.children.length, [...base.children].map(c => c.className)],
      row: [row.localName, row.getAttribute('part').split(/\s+/).filter(Boolean), [...row.children].map(c => [...c.classList].join(' ') || c.localName)],
      button: [button.getAttribute('aria-hidden'), button.getAttribute('part'), [...button.querySelectorAll('slot')].map(s => s.name), [...button.querySelectorAll('sl-icon')].map(i => [i.getAttribute('library'), i.getAttribute('name')])],
      label: [root.querySelector('slot.tree-item__label').getAttribute('part'), root.querySelector('slot.tree-item__label').name],
      group: [group.getAttribute('part'), group.getAttribute('role'), group.hidden, group.style.height, group.children[0].name],
      parts,
      queries: [el.defaultSlot?.localName, el.childrenSlot?.name, el.itemElement?.className, el.childrenContainer?.className, el.expandButtonSlot?.name],
      nestedSlot: el.querySelector('#q').getAttribute('slot'),
      topSlot: el.hasAttribute('slot'),
    };
  });
  expect(r.base).toEqual(['div', ['tree-item', 'tree-item--expanded', 'tree-item--has-expand-button', 'tree-item--selected'], 2, ['tree-item__item', 'tree-item__children']]);
  expect(r.row).toEqual(['div', ['item', 'item--expanded', 'item--selected'], ['tree-item__indentation', 'tree-item__expand-button tree-item__expand-button--visible', 'tree-item__label']]);
  expect(r.button).toEqual(['true', 'expand-button', ['expand-icon', 'collapse-icon'], [['system', 'chevron-right'], ['system', 'chevron-right']]]);
  expect(r.label).toEqual(['label', '']);
  expect(r.group).toEqual(['children', 'group', false, 'auto', 'children']);
  expect(r.parts).toEqual(['base', 'item item--expanded item--selected', 'indentation', 'expand-button', 'label', 'children']);
  expect(r.queries).toEqual(['slot', 'children', 'tree-item__item', 'tree-item__children', 'expand-icon']);
  expect(r.nestedSlot).toBe('children');
  expect(r.topSlot).toBe(false);
});

test('ARIA: role, tabindex, aria-selected and aria-disabled on every item, aria-expanded on a branch only, and a nested item is given slot="children" (quirk)', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-tree-item id="p">Parent<sl-tree-item id="q" slot="other" disabled>Child</sl-tree-item></sl-tree-item><sl-tree-item id="leaf" selected role="button" tabindex="4">Leaf</sl-tree-item>');
  const read = id => frame.locator(`#${id}`).evaluate(el => Object.fromEntries(['role', 'tabindex', 'aria-selected', 'aria-disabled', 'aria-expanded', 'aria-busy', 'slot'].map(a => [a, el.getAttribute(a)])));
  expect(await read('p')).toEqual({ role: 'treeitem', tabindex: '-1', 'aria-selected': 'false', 'aria-disabled': 'false', 'aria-expanded': 'false', 'aria-busy': null, slot: null });
  expect(await read('q')).toEqual({ role: 'treeitem', tabindex: '-1', 'aria-selected': 'false', 'aria-disabled': 'true', 'aria-expanded': null, 'aria-busy': null, slot: 'children' });
  // role and tabindex replace what the page gave, on connect.
  expect(await read('leaf')).toEqual({ role: 'treeitem', tabindex: '-1', 'aria-selected': 'true', 'aria-disabled': 'false', 'aria-expanded': null, 'aria-busy': null, slot: null });
  await frame.locator('#p').evaluate(async el => { el.expanded = true; el.querySelector('#q').disabled = false; el.querySelector('#q').selected = true; await el.updateComplete; await el.querySelector('#q').updateComplete; });
  expect(await frame.locator('#p').evaluate(el => el.getAttribute('aria-expanded'))).toBe('true');
  expect(await frame.locator('#q').evaluate(el => [el.getAttribute('aria-disabled'), el.getAttribute('aria-selected')])).toEqual(['false', 'true']);
});

test('properties: defaults, reflection and their attributes; null is not restored (quirk); dir and lang are undefined and not reflected', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-tree-item id="p">Parent</sl-tree-item><sl-tree-item id="q" expanded selected disabled lazy>Q</sl-tree-item>');
  const r = await frame.locator('body').evaluate(async () => {
    const p = document.getElementById('p');
    const q = document.getElementById('q');
    const props = el => [el.expanded, el.selected, el.disabled, el.lazy];
    const out = { initial: [props(p), props(q)], state: [p.indeterminate, p.isLeaf, p.loading, p.selectable], dirLang: [p.dir, p.lang, p.hasAttribute('dir'), p.hasAttribute('lang')] };
    p.expanded = true; p.selected = true; p.disabled = true; p.lazy = true;
    await p.updateComplete;
    out.reflected = p.getAttributeNames().filter(a => ['expanded', 'selected', 'disabled', 'lazy'].includes(a)).sort();
    p.removeAttribute('expanded'); p.removeAttribute('lazy');
    await p.updateComplete;
    out.removed = props(p);
    // Quirk: unlike other components, null is not turned back into the initial value; the attribute is removed.
    q.expanded = null; q.selected = null; q.disabled = null; q.lazy = null;
    await q.updateComplete;
    out.nulled = [props(q), q.getAttributeNames().filter(a => ['expanded', 'selected', 'disabled', 'lazy'].includes(a))];
    p.dir = 'rtl'; p.lang = 'fr';
    await p.updateComplete;
    out.dirReflected = [p.hasAttribute('dir'), p.hasAttribute('lang')];
    out.observed = ['expanded', 'selected', 'disabled', 'lazy', 'dir', 'lang'].every(a => customElements.get('sl-tree-item').observedAttributes.includes(a));
    return out;
  });
  expect(r).toEqual({
    initial: [[false, false, false, false], [true, true, true, true]], state: [false, true, false, false], dirLang: [undefined, undefined, false, false],
    reflected: ['disabled', 'expanded', 'lazy', 'selected'], removed: [false, true, true, false], nulled: [[null, null, null, null], []],
    dirReflected: [false, false], observed: true,
  });
});

test('expanding and collapsing emits sl-expand then sl-after-expand and sl-collapse then sl-after-collapse, bubbling and composed, not cancelable', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-tree-item id="p">Parent<sl-tree-item>Child</sl-tree-item></sl-tree-item>');
  await frame.locator('#p').evaluate(el => {
    el.log = [];
    for (const type of ['sl-expand', 'sl-after-expand', 'sl-collapse', 'sl-after-collapse']) {
      el.addEventListener(type, e => el.log.push({ type, bubbles: e.bubbles, composed: e.composed, cancelable: e.cancelable, target: e.target === el }));
    }
  });
  const hidden = () => frame.locator('#p').evaluate(el => [el.childrenContainer.hidden, el.childrenContainer.style.height]);
  expect(await hidden()).toEqual([true, '0px']);
  await frame.locator('#p').evaluate(el => { el.expanded = true; });
  await expect.poll(() => frame.locator('#p').evaluate(el => el.log.map(e => e.type))).toEqual(['sl-expand', 'sl-after-expand']);
  expect(await hidden()).toEqual([false, 'auto']);
  await frame.locator('#p').evaluate(el => { el.expanded = false; });
  await expect.poll(() => frame.locator('#p').evaluate(el => el.log.map(e => e.type))).toEqual(['sl-expand', 'sl-after-expand', 'sl-collapse', 'sl-after-collapse']);
  expect(await hidden()).toEqual([true, 'auto']);
  expect(await frame.locator('#p').evaluate(el => el.log.every(e => e.bubbles && e.composed && !e.cancelable && e.target))).toBe(true);
});

test('an item rendered with expanded set shows its children with no animation and emits nothing (quirk)', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('body').evaluate(async body => {
    const host = document.createElement('div');
    const log = [];
    for (const type of ['sl-expand', 'sl-after-expand', 'sl-collapse', 'sl-after-collapse', 'sl-lazy-change', 'sl-lazy-load']) host.addEventListener(type, () => log.push(type));
    host.innerHTML = '<sl-tree-item id="p" expanded lazy>Parent<sl-tree-item>Child</sl-tree-item></sl-tree-item>';
    body.append(host);
    const p = host.firstElementChild;
    await p.updateComplete;
    await new Promise(resolve => setTimeout(resolve, 400));
    const out = { log, hidden: p.childrenContainer.hidden, height: p.childrenContainer.style.height, expanded: p.getAttribute('aria-expanded'), loading: p.loading };
    host.remove();
    return out;
  });
  expect(r).toEqual({ log: [], hidden: false, height: 'auto', expanded: 'true', loading: false });
});

test('a leaf can be expanded: the events and the animation run, but aria-expanded stays off (quirk)', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-tree-item id="leaf">Leaf</sl-tree-item>');
  await record(frame, 'leaf');
  expect(await frame.locator('#leaf').evaluate(el => [el.isLeaf, el.hasAttribute('aria-expanded')])).toEqual([true, false]);
  await frame.locator('#leaf').evaluate(el => { el.expanded = true; });
  await expect.poll(() => events(frame, 'leaf')).toEqual(['sl-expand', 'sl-after-expand']);
  expect(await frame.locator('#leaf').evaluate(el => [el.expanded, el.hasAttribute('aria-expanded'), el.shadowRoot.querySelector('.tree-item').classList.contains('tree-item--expanded'), el.shadowRoot.querySelector('.tree-item').classList.contains('tree-item--has-expand-button')])).toEqual([true, false, true, false]);
  await frame.locator('#leaf').evaluate(el => { el.expanded = false; });
  await expect.poll(() => events(frame, 'leaf')).toEqual(['sl-expand', 'sl-after-expand', 'sl-collapse', 'sl-after-collapse']);
});

test('lazy: expanding shows the spinner and asks for the content; the item stays loading until its children change, then expands', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-tree-item id="lz" lazy>Lazy</sl-tree-item>');
  await record(frame, 'lz');
  const state = () => frame.locator('#lz').evaluate(el => ({
    loading: el.loading, busy: el.getAttribute('aria-busy'), expanded: el.getAttribute('aria-expanded'), spinner: Boolean(el.shadowRoot.querySelector('sl-spinner[part="spinner"]')),
    button: el.shadowRoot.querySelector('.tree-item').classList.contains('tree-item--has-expand-button'), isLeaf: el.isLeaf,
  }));
  // aria-busy is written only when loading changes, from the second update on.
  expect(await state()).toEqual({ loading: false, busy: null, expanded: 'false', spinner: false, button: true, isLeaf: false });
  await frame.locator('#lz').evaluate(el => { el.expanded = true; });
  await expect.poll(state).toEqual({ loading: true, busy: 'true', expanded: 'true', spinner: true, button: false, isLeaf: false });
  expect(await events(frame, 'lz')).toEqual(['sl-lazy-load']);
  // The item is left loading when nothing changes.
  await frame.locator('body').evaluate(() => new Promise(resolve => setTimeout(resolve, 300)));
  expect((await state()).loading).toBe(true);
  expect(await events(frame, 'lz')).toEqual(['sl-lazy-load']);
  await frame.locator('#lz').evaluate(el => { const child = document.createElement('sl-tree-item'); child.textContent = 'Loaded'; el.append(child); });
  await expect.poll(() => events(frame, 'lz')).toEqual(['sl-lazy-load', 'sl-expand', 'sl-after-expand']);
  expect(await state()).toEqual({ loading: false, busy: 'false', expanded: 'true', spinner: false, button: true, isLeaf: false });
  // sl-lazy-change follows a change of lazy, from the second update on.
  await frame.locator('#lz').evaluate(el => { el.lazy = false; });
  await expect.poll(() => events(frame, 'lz')).toEqual(['sl-lazy-load', 'sl-expand', 'sl-after-expand', 'sl-lazy-change']);
});

test('lazy: a load that ends after the user collapsed the item still expands it (quirk); removing lazy from an item without children leaves its expand button (quirk)', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-tree-item id="lz" lazy>Lazy</sl-tree-item><sl-tree-item id="nolazy" lazy>No children</sl-tree-item>');
  await record(frame, 'lz');
  await frame.locator('#lz').evaluate(el => { el.expanded = true; });
  await expect.poll(() => frame.locator('#lz').evaluate(el => el.loading)).toBe(true);
  await frame.locator('#lz').evaluate(el => { el.expanded = false; });
  await expect.poll(() => events(frame, 'lz')).toEqual(['sl-lazy-load', 'sl-collapse', 'sl-after-collapse']);
  await frame.locator('#lz').evaluate(el => { const child = document.createElement('sl-tree-item'); child.textContent = 'Late'; el.append(child); });
  await expect.poll(() => events(frame, 'lz')).toEqual(['sl-lazy-load', 'sl-collapse', 'sl-after-collapse', 'sl-expand', 'sl-after-expand']);
  expect(await frame.locator('#lz').evaluate(el => [el.expanded, el.getAttribute('aria-expanded'), el.childrenContainer.hidden, el.loading])).toEqual([false, 'false', false, false]);
  // isLeaf is not recomputed when lazy changes.
  await frame.locator('#nolazy').evaluate(async el => { el.lazy = false; await el.updateComplete; });
  expect(await frame.locator('#nolazy').evaluate(el => [el.isLeaf, el.getAttribute('aria-expanded'), el.shadowRoot.querySelector('.tree-item').classList.contains('tree-item--has-expand-button')])).toEqual([false, 'false', true]);
});

test('getChildrenItems returns the nested items in order, and without the disabled ones when asked', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-tree-item id="p">P<sl-tree-item id="a">A</sl-tree-item><sl-tree-item id="b" disabled>B<sl-tree-item id="b1">B1</sl-tree-item></sl-tree-item><div>not an item</div><sl-tree-item id="c">C</sl-tree-item></sl-tree-item>');
  const r = await frame.locator('#p').evaluate(el => ({
    all: el.getChildrenItems().map(i => i.id), enabled: el.getChildrenItems({ includeDisabled: false }).map(i => i.id),
    explicit: el.getChildrenItems({ includeDisabled: true }).map(i => i.id), none: el.querySelector('#c').getChildrenItems(),
  }));
  expect(r).toEqual({ all: ['a', 'b', 'c'], enabled: ['a', 'c'], explicit: ['a', 'b', 'c'], none: [] });
});

test('multiple selection draws Velcro\'s checkbox with the exported parts, following selected, indeterminate and disabled', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-tree-item id="p">P</sl-tree-item>');
  expect(await frame.locator('#p').evaluate(el => el.shadowRoot.querySelector('sl-checkbox'))).toBeNull();
  const read = () => frame.locator('#p').evaluate(async el => {
    await el.updateComplete;
    const box = el.shadowRoot.querySelector('sl-checkbox');
    await box.updateComplete;
    return [box.checked, box.indeterminate, box.disabled, box.getAttribute('tabindex'), box.getAttribute('part'), box.className, getComputedStyle(box).pointerEvents,
      box.getAttribute('exportparts').split(/[\s,]+/).filter(Boolean)];
  });
  await frame.locator('#p').evaluate(el => { el.selectable = true; });
  expect(await read()).toEqual([false, false, false, '-1', 'checkbox', 'tree-item__checkbox', 'none', [
    'base:checkbox__base', 'control:checkbox__control', 'control--checked:checkbox__control--checked', 'control--indeterminate:checkbox__control--indeterminate',
    'checked-icon:checkbox__checked-icon', 'indeterminate-icon:checkbox__indeterminate-icon', 'label:checkbox__label']]);
  await frame.locator('#p').evaluate(el => { el.selected = true; el.disabled = true; });
  expect((await read()).slice(0, 3)).toEqual([true, false, true]);
  await frame.locator('#p').evaluate(el => { el.selected = false; el.disabled = false; el.indeterminate = true; });
  expect((await read()).slice(0, 3)).toEqual([false, true, false]);
  // Changing selected clears indeterminate unless it changed in the same update (Shoelace's willUpdate).
  await frame.locator('#p').evaluate(async el => { el.selected = true; await el.updateComplete; });
  expect(await frame.locator('#p').evaluate(el => el.indeterminate)).toBe(false);
  await frame.locator('#p').evaluate(async el => { el.selected = false; el.indeterminate = true; await el.updateComplete; });
  expect(await frame.locator('#p').evaluate(el => el.indeterminate)).toBe(true);
});

test('computed styles match Shoelace: the row, the selection mark, the disabled look, the expand button and the indentation', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, `
    <sl-tree id="t"><sl-tree-item id="a" expanded selected>A<sl-tree-item id="a1">A1</sl-tree-item></sl-tree-item><sl-tree-item id="b" disabled>B</sl-tree-item></sl-tree>`);
  await frame.locator('#a').evaluate(async el => { await new Promise(resolve => setTimeout(resolve, 400)); await el.updateComplete; });
  const r = await frame.locator('body').evaluate(() => {
    const css = (el, p) => getComputedStyle(el).getPropertyValue(p).trim();
    const part = (id, selector) => document.getElementById(id).shadowRoot.querySelector(selector);
    const probe = document.createElement('div');
    probe.style.cssText = 'background-color: var(--sl-color-neutral-100); border-left: solid 3px var(--sl-color-primary-600); color: var(--sl-color-neutral-600); padding: var(--sl-spacing-x-small); font-size: var(--sl-font-size-medium); width: var(--sl-spacing-large)';
    document.body.append(probe);
    const expected = { neutral100: css(probe, 'background-color'), primary600: css(probe, 'border-left-color'), neutral600: css(probe, 'color'), xSmall: css(probe, 'padding-left'), medium: css(probe, 'font-size'), large: css(probe, 'width') };
    probe.remove();
    return {
      expected,
      host: [css(document.getElementById('a'), 'display'), css(document.getElementById('a'), 'outline-style')],
      base: ['display', 'flex-direction', 'cursor', 'position'].map(p => css(part('a', '.tree-item'), p)),
      row: ['display', 'align-items', 'border-inline-start-width', 'border-inline-start-style'].map(p => css(part('a', '.tree-item__item'), p)),
      selectedRow: [css(part('a', '.tree-item__item'), 'background-color'), css(part('a', '.tree-item__item'), 'border-inline-start-color')],
      plainRow: [css(part('a1', '.tree-item__item'), 'background-color'), css(part('a1', '.tree-item__item'), 'border-inline-start-color')],
      disabledRow: [css(part('b', '.tree-item__item'), 'opacity'), css(part('b', '.tree-item__item'), 'cursor'), css(part('b', '.tree-item__item'), 'outline-style')],
      button: ['width', 'height', 'box-sizing', 'padding-left', 'color', 'display', 'rotate'].map(p => css(part('a', '.tree-item__expand-button'), p)),
      label: ['font-size', 'display', 'align-items'].map(p => css(part('a', '.tree-item__label'), p)),
      indentation: [css(part('a', '.tree-item__indentation'), 'width'), css(part('a1', '.tree-item__indentation'), 'width')],
      children: [css(part('a', '.tree-item__children'), 'font-size'), css(part('a', '.tree-item__children'), 'display'), css(part('a', '.tree-item__children'), 'position')],
    };
  });
  expect(r.host).toEqual(['block', 'none']);
  expect(r.base).toEqual(['flex', 'column', 'pointer', 'relative']);
  expect(r.row).toEqual(['flex', 'center', '3px', 'solid']);
  expect(r.selectedRow).toEqual([r.expected.neutral100, r.expected.primary600]);
  // Not selected: no background and a transparent mark. A disabled item is dimmed, not-allowed and never gets the selection look.
  expect(r.plainRow[0]).toBe('rgba(0, 0, 0, 0)');
  expect(r.plainRow[1]).toBe('rgba(0, 0, 0, 0)');
  expect(r.disabledRow).toEqual(['0.5', 'not-allowed', 'none']);
  expect(r.button).toEqual(['16px', '16px', 'content-box', r.expected.xSmall, r.expected.neutral600, 'flex', '90deg']);
  expect(r.label).toEqual([r.expected.medium, 'flex', 'center']);
  // The tree's font size is 0, so the top level is not indented and each level adds the indent size (the large spacing).
  expect(r.indentation).toEqual(['0px', r.expected.large]);
  expect(r.children).toEqual([r.expected.large, 'block', 'relative']);
});

test('right to left: the item\'s own dir gives chevron-left icons, the rtl class and a quarter turn the other way when expanded', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-tree-item id="r" dir="rtl" expanded>R<sl-tree-item>S</sl-tree-item></sl-tree-item><sl-tree-item id="l" expanded>L<sl-tree-item>M</sl-tree-item></sl-tree-item>');
  await frame.locator('#r').evaluate(() => new Promise(resolve => setTimeout(resolve, 400)));
  const read = id => frame.locator(`#${id}`).evaluate(el => ({
    icons: [...el.shadowRoot.querySelectorAll('.tree-item__expand-button sl-icon')].map(i => i.getAttribute('name')),
    rtl: el.shadowRoot.querySelector('.tree-item').classList.contains('tree-item--rtl'),
    rotate: getComputedStyle(el.shadowRoot.querySelector('.tree-item__expand-button')).rotate,
  }));
  expect(await read('r')).toEqual({ icons: ['chevron-left', 'chevron-left'], rtl: true, rotate: '-90deg' });
  expect(await read('l')).toEqual({ icons: ['chevron-right', 'chevron-right'], rtl: false, rotate: '90deg' });
  // The property works like the attribute (it is read live), and changing it re-renders.
  await frame.locator('#l').evaluate(async el => { el.dir = 'rtl'; await el.updateComplete; });
  expect((await read('l')).icons).toEqual(['chevron-left', 'chevron-left']);
});

test('the Selected and Expanded examples render the states they describe, and the other examples render closed and unselected', async ({ page }) => {
  await openDocs(page, PAGE);
  await documentsLoaded(page);
  const states = async title => {
    const frame = frameFor(page, title);
    await expect(frame.locator('sl-tree-item').first()).toBeAttached();
    return frame.locator('body').evaluate(async () => {
      await customElements.whenDefined('sl-tree-item');
      const items = [...document.querySelectorAll('sl-tree-item')];
      await Promise.all(items.map(i => i.updateComplete));
      const own = i => [...i.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
      return items.map(i => ({ text: own(i), expanded: i.expanded, selected: i.selected, ariaSelected: i.getAttribute('aria-selected'), ariaExpanded: i.getAttribute('aria-expanded') }));
    });
  };
  const selected = await states('Selected');
  expect(selected.length).toBe(6);
  expect(selected.filter(s => s.selected).map(s => [s.text, s.ariaSelected])).toEqual([['Item 1', 'true']]);
  const expanded = await states('Expanded');
  expect(expanded.length).toBe(9);
  expect(expanded.filter(s => s.expanded).map(s => [s.text, s.ariaExpanded])).toEqual([['Item 1', 'true'], ['Item A', 'true']]);
  for (const [title, count] of [['Overview', 6], ['Nested tree items', 9]]) {
    const items = await states(title);
    expect(items.length, title).toBe(count);
    expect(items.filter(s => s.expanded || s.selected), title).toEqual([]);
  }
});

test('inherited core ready event: dispatched once on the item after its first update, not bubbling or composed', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('body').evaluate(async body => {
    const el = document.createElement('sl-tree-item');
    const seen = [];
    let bubbled = 0;
    el.addEventListener('ready', event => seen.push({ bubbles: event.bubbles, composed: event.composed }));
    body.addEventListener('ready', () => bubbled++);
    body.append(el);
    await el.updateComplete;
    el.selected = true;
    await el.updateComplete;
    el.remove();
    return { seen, bubbled };
  });
  expect(r).toEqual({ seen: [{ bubbles: false, composed: false }], bubbled: 0 });
});

test.describe('animation registry', () => {
  let outDir;
  test.beforeAll(async () => {
    outDir = await buildFixtures({
      registry: "export * from '@charm-ux/velcro/utilities/animation-registry';",
      item: "export { SlTreeItem } from '@charm-ux/velcro/tree-item';",
    });
  });

  // Loads the entries and records every Element.animate() call on a tree item's children group in window.calls.
  async function setup(page) {
    await gotoBlank(page, outDir);
    await page.evaluate(async () => {
      window.registry = await import('/registry.js');
      await import('/item.js');
      window.calls = [];
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (keyframes, options) {
        if (this.classList.contains('tree-item__children')) window.calls.push({ keyframes: JSON.parse(JSON.stringify(keyframes)), duration: options.duration, easing: options.easing });
        return animate.call(this, keyframes, options);
      };
      document.body.innerHTML = '<sl-tree-item id="a">A<sl-tree-item>A1</sl-tree-item></sl-tree-item><sl-tree-item id="b">B<sl-tree-item>B1</sl-tree-item></sl-tree-item>';
      await Promise.all([...document.querySelectorAll('sl-tree-item')].map(el => el.updateComplete));
      const after = (el, type) => new Promise(resolve => el.addEventListener(type, resolve, { once: true }));
      window.cycle = async id => {
        const el = document.getElementById(id);
        window.calls = [];
        const expanded = after(el, 'sl-after-expand');
        el.expanded = true;
        await expanded;
        const collapsed = after(el, 'sl-after-collapse');
        el.expanded = false;
        await collapsed;
        return window.calls;
      };
    });
  }

  test('the item uses Shoelace\'s defaults, with height auto resolved to pixels; setDefaultAnimation changes them for every item', async ({ page }) => {
    await setup(page);
    const calls = await page.evaluate(() => window.cycle('a'));
    expect(calls).toHaveLength(2);
    const px = /^\d+(\.\d+)?px$/;
    const shape = c => c.keyframes.map(k => [k.height === '0' || k.height === '0px' ? '0' : px.test(k.height) ? 'px' : k.height, k.opacity, k.overflow]);
    expect(shape(calls[0])).toEqual([['0', '0', 'hidden'], ['px', '1', 'hidden']]);
    expect(shape(calls[1])).toEqual([['px', '1', 'hidden'], ['0', '0', 'hidden']]);
    expect([calls[0].duration, calls[0].easing, calls[1].duration, calls[1].easing]).toEqual([250, 'cubic-bezier(0.4, 0.0, 0.2, 1)', 200, 'cubic-bezier(0.4, 0.0, 0.2, 1)']);
    const r = await page.evaluate(async () => {
      window.registry.setDefaultAnimation('tree-item.expand', { keyframes: [{ opacity: 0.25 }, { opacity: 1 }], options: { duration: 20, easing: 'ease-in' } });
      return [await window.cycle('a'), await window.cycle('b')];
    });
    for (const c of r) {
      expect(c[0]).toEqual({ keyframes: [{ opacity: 0.25 }, { opacity: 1 }], duration: 20, easing: 'ease-in' });
      expect(c[1].duration).toBe(200);
    }
  });

  test('an element\'s own animation beats the default, only for that element; null is an empty animation', async ({ page }) => {
    await setup(page);
    const r = await page.evaluate(async () => {
      const { setAnimation } = window.registry;
      setAnimation(document.getElementById('a'), 'tree-item.expand', { keyframes: [{ opacity: 0.5 }, { opacity: 1 }], options: { duration: 30 } });
      setAnimation(document.getElementById('a'), 'tree-item.collapse', null);
      return { a: await window.cycle('a'), b: await window.cycle('b') };
    });
    expect(r.a[0]).toEqual({ keyframes: [{ opacity: 0.5 }, { opacity: 1 }], duration: 30 });
    expect(r.a[1]).toEqual({ keyframes: [], duration: 0 });
    expect(r.b.map(c => c.duration)).toEqual([250, 200]);
  });

  test('the direction picks rtlKeyframes: the item\'s own dir (attribute or property) beats the document, an empty one defers to it, lower-cased', async ({ page }) => {
    await setup(page);
    const r = await page.evaluate(async () => {
      const task = () => new Promise(resolve => setTimeout(resolve));
      window.registry.setDefaultAnimation('tree-item.expand', { keyframes: [{ opacity: 0.1 }, { opacity: 1 }], rtlKeyframes: [{ opacity: 0.2 }, { opacity: 1 }], options: { duration: 5 } });
      const first = async id => (await window.cycle(id))[0].keyframes[0].opacity;
      const a = document.getElementById('a');
      const b = document.getElementById('b');
      document.documentElement.dir = 'ltr';
      await task();
      const ltr = await first('a');
      a.setAttribute('dir', 'rtl');
      const attribute = await first('a');
      a.removeAttribute('dir');
      b.dir = 'rtl';
      const property = [b.hasAttribute('dir'), await first('b')];
      document.documentElement.dir = 'ltr';
      await task();
      b.dir = 'RTL';
      const upper = await first('b');
      b.dir = 'ltr';
      document.documentElement.dir = 'RTL';
      await task();
      const hostWins = await first('b');
      b.dir = '';
      const documentDir = await first('b');
      document.documentElement.dir = 'ltr';
      await task();
      return { ltr, attribute, property, upper, hostWins, documentDir, back: await first('b') };
    });
    expect(r).toEqual({ ltr: 0.1, attribute: 0.2, property: [false, 0.2], upper: 0.2, hostWins: 0.1, documentDir: 0.2, back: 0.1 });
  });
});

test.describe('class-only entry', () => {
  let bundle;

  test.beforeAll(async () => {
    const fromDocs = createRequire(path.join(docsDir, 'package.json'));
    const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
    const dir = mkdtempSync(path.join(tmpdir(), 'velcro-tree-item-class-'));
    try {
      const entry = path.join(dir, 'entry.js');
      writeFileSync(entry, `
        import { SlTreeItem, VelcroTreeItem } from '@charm-ux/velcro/tree-item/class';
        window.itemClass = { SlTreeItem, VelcroTreeItem };
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

  test('importing defines nothing; constructing an item defines Velcro\'s sl-checkbox, sl-icon and sl-spinner, so they render', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.setContent('<!DOCTYPE html><html><body></body></html>');
    await page.addScriptTag({ type: 'module', content: bundle });
    await page.waitForFunction(() => Boolean(window.itemClass));
    const r = await page.evaluate(async () => {
      const { SlTreeItem, VelcroTreeItem } = window.itemClass;
      const tags = () => ['sl-tree-item', 'sl-checkbox', 'sl-icon', 'sl-spinner'].map(t => customElements.get(t)?.name ?? null);
      const afterImport = tags();
      customElements.define('sl-tree-item', SlTreeItem);
      const el = document.createElement('sl-tree-item');
      el.selectable = true;
      el.loading = true;
      document.body.append(el);
      await el.updateComplete;
      return {
        same: SlTreeItem === VelcroTreeItem, afterImport, afterConstruct: tags(),
        rendered: [el.shadowRoot.querySelector('sl-checkbox'), el.shadowRoot.querySelector('sl-icon'), el.shadowRoot.querySelector('sl-spinner')].map(e => e?.constructor.name),
      };
    });
    expect(r).toEqual({
      same: true, afterImport: [null, null, null, null], afterConstruct: ['VelcroTreeItem', 'VelcroCheckbox', 'VelcroIcon', 'VelcroSpinner'],
      rendered: ['VelcroCheckbox', 'VelcroIcon', 'VelcroSpinner'],
    });
    expect(pageErrors).toEqual([]);
  });

  test('another constructor that owns sl-checkbox, sl-icon or sl-spinner is left in place', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.setContent('<!DOCTYPE html><html><body></body></html>');
    await page.addScriptTag({ type: 'module', content: bundle });
    await page.waitForFunction(() => Boolean(window.itemClass));
    const r = await page.evaluate(async () => {
      const foreign = {};
      for (const tag of ['sl-checkbox', 'sl-icon', 'sl-spinner']) {
        foreign[tag] = class extends HTMLElement {};
        customElements.define(tag, foreign[tag]);
      }
      const { SlTreeItem } = window.itemClass;
      customElements.define('sl-tree-item', SlTreeItem);
      const el = document.createElement('sl-tree-item');
      el.selectable = true;
      el.loading = true;
      document.body.append(el);
      await el.updateComplete;
      return Object.fromEntries(['sl-checkbox', 'sl-icon', 'sl-spinner'].map(tag => [tag, [customElements.get(tag) === foreign[tag], el.shadowRoot.querySelector(tag) instanceof foreign[tag]]]));
    });
    expect(r).toEqual({ 'sl-checkbox': [true, true], 'sl-icon': [true, true], 'sl-spinner': [true, true] });
    expect(pageErrors).toEqual([]);
  });
});

test('every docs example renders in its own document', async ({ page }) => {
  await openDocs(page, PAGE);
  const titles = await page.locator('iframe.example').evaluateAll(frames => frames.map(f => f.title));
  expect(titles).toEqual(EXAMPLES.map(([t]) => `Tree Item example: ${t}`));
  for (const title of titles) {
    const frame = page.frameLocator(`iframe.example[title="${title}"]`);
    await expect(frame.locator('sl-tree-item').first()).toBeAttached();
    expect(await frame.locator('sl-tree-item').first().evaluate(async el => {
      await customElements.whenDefined('sl-tree-item');
      await el.updateComplete;
      return Boolean(el.shadowRoot?.querySelector('[part="base"]'));
    })).toBe(true);
  }
});

test('no upstream Shoelace runtime is requested or defined; all requests stay on the local origin', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  await documentsLoaded(page);
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  expect(await frame.locator('body').evaluate(() => Boolean(window.Shoelace || document.querySelector('script[src*="shoelace"]')))).toBe(false);
});

// The values that matter in a rendered example, which an HTML example and its React version must share: each item's
// depth, own label and state, in document order.
const summarize = async () => {
  const out = [];
  for (const tree of document.querySelectorAll('sl-tree')) {
    await tree.updateComplete;
    const items = [...tree.querySelectorAll('sl-tree-item')];
    await Promise.all(items.map(i => i.updateComplete));
    out.push(items.map(i => ({
      depth: (() => { let d = 0; for (let p = i.parentElement; p && p !== tree; p = p.parentElement) d++; return d; })(),
      text: [...i.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ').replace(/\s+/g, ' ').trim(),
      expanded: i.expanded, selected: i.selected, ariaSelected: i.getAttribute('aria-selected'), ariaExpanded: i.getAttribute('aria-expanded'),
    })));
  }
  return out;
};

// Shoelace's React examples, ported in packages/docs/examples/tree-item/react/*.jsx, bundled with React 19 and the generated
// wrappers, which are resolved through the package's real export map.
test.describe('React examples', () => {
  const reactDir = fileURLToPath(new URL('../../packages/docs/examples/tree-item/react/', import.meta.url));
  let bundle;

  test.beforeAll(async () => {
    const fromVelcro = createRequire(path.join(velcroDir, 'package.json'));
    const fromDocs = createRequire(path.join(docsDir, 'package.json'));
    const pkgDir = name => path.dirname(fromVelcro.resolve(`${name}/package.json`));
    const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
    const dir = mkdtempSync(path.join(tmpdir(), 'velcro-tree-item-react-'));
    try {
      for (const [, name] of EXAMPLES) {
        writeFileSync(path.join(dir, `${name}.jsx`), `${readFileSync(path.join(reactDir, `${name}.jsx`), 'utf8')}\nexport default App;\n`);
      }
      const entry = path.join(dir, 'entry.js');
      writeFileSync(entry, `
        import React from 'react';
        import { createRoot } from 'react-dom/client';
        import { VelcroTreeItem } from '@charm-ux/velcro/react/VelcroTreeItem.js';
        ${EXAMPLES.map(([, name], i) => `import App${i} from './${name}.jsx';`).join('\n')}
        const apps = { ${EXAMPLES.map(([, name], i) => `${JSON.stringify(name)}: App${i}`).join(', ')} };
        window.errors = [];
        addEventListener('error', e => window.errors.push(String(e.message)));
        addEventListener('unhandledrejection', e => window.errors.push(String(e.reason)));
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
          const log = type => event => window.reactEvents.push([type, event.target.id, event.target.expanded]);
          createRoot(host).render(React.createElement(VelcroTreeItem, { id: 'wrapped', expanded: false, selected: true, onSlExpand: log('expand'), onSlAfterExpand: log('after-expand'),
            onSlCollapse: log('collapse'), onSlAfterCollapse: log('after-collapse'), onSlLazyLoad: log('lazy-load') }, 'Item', React.createElement(VelcroTreeItem, null, 'Child')));
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

  test('every React example renders the same tree as the HTML example it belongs to', async ({ page }) => {
    test.setTimeout(150_000);
    const htmlPage = await page.context().newPage();
    watchNetwork(htmlPage);
    const expected = {};
    try {
      await openDocs(htmlPage, PAGE);
      await documentsLoaded(htmlPage);
      for (const [title, name] of EXAMPLES) {
        const frame = frameFor(htmlPage, title);
        await expect(frame.locator('sl-tree-item').first()).toBeAttached();
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
      expect(actual[0].length, name).toBeGreaterThan(0);
      expect(actual, name).toEqual(expected[name]);
    }
    expect(await page.evaluate(() => window.errors)).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('the wrapper passes the properties and takes onSlExpand, onSlAfterExpand, onSlCollapse and onSlAfterCollapse', async ({ page }) => {
    const pageErrors = await load(page);
    await page.evaluate(() => window.renderEvents());
    const el = page.locator('#wrapped');
    await expect(el).toBeAttached();
    await page.evaluate(() => customElements.whenDefined('sl-tree-item'));
    expect(await el.evaluate(item => [item.selected, item.expanded])).toEqual([true, false]);
    // A tree item toggles when its tree handles a click; on its own, script sets expanded.
    await el.evaluate(item => { item.expanded = true; });
    await expect.poll(() => page.evaluate(() => window.reactEvents.map(e => e[0]))).toEqual(['expand', 'after-expand']);
    await el.evaluate(item => { item.expanded = false; });
    await expect.poll(() => page.evaluate(() => window.reactEvents.map(e => e[0]))).toEqual(['expand', 'after-expand', 'collapse', 'after-collapse']);
    expect(await page.evaluate(() => window.reactEvents.map(e => e[1]))).toEqual(['wrapped', 'wrapped', 'wrapped', 'wrapped']);
    expect(await page.evaluate(() => window.errors)).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
