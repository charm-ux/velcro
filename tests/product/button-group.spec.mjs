import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/button-group';
const velcroDir = fileURLToPath(new URL('../../packages/velcro/', import.meta.url));

// The docs page's examples, in page order: the example's title, and the name of its files under examples/button-group/.
const EXAMPLES = [
  ['Overview', 'basic'],
  ['Button sizes', 'sizes'],
  ['Theme buttons', 'theme-buttons'],
  ['Pill buttons', 'pill'],
  ['Dropdowns in button groups', 'dropdown'],
  ['Split buttons', 'split'],
  ['Tooltips in button groups', 'tooltips'],
  ['Toolbar example', 'toolbar'],
];

const frameFor = (page, title) => page.frameLocator(`iframe.example[title="Button Group example: ${title}"]`);

async function openPage(page) {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  await documentsLoaded(page);
  for (const [title] of EXAMPLES) {
    const frame = frameFor(page, title);
    await expect(frame.locator('sl-button-group').first()).toBeAttached();
    await frame.locator('body').evaluate(async () => {
      await Promise.all(['sl-button-group', 'sl-button'].map(tag => customElements.whenDefined(tag)));
      await Promise.all([...document.querySelectorAll('sl-button-group, sl-button')].map(el => el.updateComplete));
    });
    // Every slotted button has been given its data attributes (the slot change that sets them runs after the first update).
    await expect
      .poll(() => frame.locator('body').evaluate(() => [...document.querySelectorAll('sl-button')].every(b => b.hasAttribute('data-sl-button-group__button'))))
      .toBe(true);
  }
  return { frame: frameFor(page, 'Overview'), requests };
}

// Appends markup to the example document and waits for the first update and the slot change of every group in it.
async function mount(frame, markup) {
  await frame.locator('body').evaluate(async (body, markup) => {
    const host = document.createElement('div');
    host.className = 'mount';
    host.innerHTML = markup;
    body.append(host);
    await Promise.all([...host.querySelectorAll('sl-button-group, sl-button')].map(el => el.updateComplete));
    await new Promise(resolve => setTimeout(resolve, 50));
  }, markup);
}

// What the document says about every group in it: its label and role, the slotted elements and, for every sl-button,
// the attributes and data attributes that matter (hover and focus are transient and left out).
function summarize() {
  const dataOf = el => el.getAttributeNames().filter(n => n.startsWith('data-sl-button-group__') && !/--(hover|focus)$/.test(n)).sort();
  const buttonOf = b => ({
    text: b.textContent.trim(),
    variant: b.getAttribute('variant'),
    size: b.getAttribute('size'),
    pill: b.hasAttribute('pill'),
    caret: b.hasAttribute('caret'),
    data: dataOf(b),
    icon: b.querySelector('sl-icon')?.getAttribute('name') ?? null,
  });
  return [...document.querySelectorAll('sl-button-group')].map(group => ({
    label: group.label,
    role: group.shadowRoot.querySelector('[part="base"]').getAttribute('role'),
    slotted: [...group.children].map(el => ({ tag: el.localName, content: el.content ?? null, data: dataOf(el), buttons: [...el.querySelectorAll('sl-button')].concat(el.localName === 'sl-button' ? [el] : []).map(buttonOf) })),
  }));
}

test('docs page is prerendered with Velcro branding, prototype status, the quirks and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Button Group - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('sl-dropdown');
  expect(html).toContain('sl-radio-button');
  // The API table says the two core attributes that do nothing are inert, and does not repeat core's wording for them.
  expect(html.match(/Velcro extension \(core\), inert/g)?.length).toBe(2);
  expect(html).not.toMatch(/Vertically stacks the buttons|removing gap and border radius/);
  // The React note names the two ports that differ from Shoelace's snippets beyond imports.
  expect(html).toMatch(/two ports add what Shoelace(?:'|&#39;)s HTML example has[^<]*<code>SlVisuallyHidden<\/code>/);
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
  expect(await (await request.get('/')).text()).toContain('/components/button-group');
});

test('sl-button-group registers as the exported class with no core marker and no ch-* definitions; only Shoelace\'s attribute, dir and lang plus the core extras are observed', async ({ page }) => {
  const { frame, requests } = await openPage(page);
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
  const r = await frame.locator('#demo-default').evaluate(el => ({
    ctor: customElements.get('sl-button-group') === el.constructor,
    baseName: el.constructor.baseName,
    attributes: el.getAttributeNames().sort(),
    chDefined: ['ch-button-group', 'ch-button'].filter(tag => customElements.get(tag)),
    observed: [...customElements.get('sl-button-group').observedAttributes].sort(),
    hasUpdated: el.hasUpdated,
  }));
  expect(r.ctor).toBe(true);
  expect(r.baseName).toBe('button-group');
  // No `button-group` marker attribute (core's scope would add one), and no reflected attribute at all.
  expect(r.attributes).toEqual(['id', 'label']);
  expect(r.chDefined).toEqual([]);
  // Shoelace's own list is dir, lang and label; select, split, toolbar and vertical are inherited from core.
  expect(r.observed).toEqual(['dir', 'label', 'lang', 'select', 'split', 'toolbar', 'vertical']);
  expect(r.hasUpdated).toBe(true);
});

test('structure: one default slot inside the base div, with the group role, the label and Shoelace\'s part, classes and nothing else', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-button-group id="nolabel"><sl-button>A</sl-button></sl-button-group>');
  const r = await frame.locator('body').evaluate(() => {
    const describe = el => {
      const nodes = [...el.shadowRoot.children].filter(n => n.localName !== 'style');
      const base = nodes[0];
      return {
        top: nodes.map(n => n.localName),
        part: base.getAttribute('part'),
        classes: [...base.classList],
        attributes: base.getAttributeNames().sort(),
        role: base.getAttribute('role'),
        label: base.getAttribute('aria-label'),
        inner: [...base.children].map(n => n.localName),
        slotName: base.querySelector('slot').name,
        slotAttributes: base.querySelector('slot').getAttributeNames(),
        slotIsDefaultSlot: base.querySelector('slot') === el.defaultSlot,
        assigned: el.defaultSlot.assignedElements().map(n => n.localName),
      };
    };
    return { labelled: describe(document.querySelector('#demo-default')), plain: describe(document.querySelector('#nolabel')) };
  });
  expect(r.labelled).toEqual({
    top: ['div'], part: 'base', classes: ['button-group'], attributes: ['aria-label', 'class', 'part', 'role'],
    role: 'group', label: 'Alignment', inner: ['slot'], slotName: '', slotAttributes: [], slotIsDefaultSlot: true, assigned: ['sl-button', 'sl-button', 'sl-button'],
  });
  // Upstream quirk: the label attribute is always written, so a group without a label has an empty aria-label.
  expect(r.plain).toMatchObject({ role: 'group', label: '', attributes: ['aria-label', 'class', 'part', 'role'], assigned: ['sl-button'] });
});

test('computed styles match Shoelace: inline-block host, flex nowrap base, border-box, and hidden does not hide the host', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, `<sl-button-group id="wrap" label="Wide" style="width: 20px"><sl-button>Long label one</sl-button><sl-button>Long label two</sl-button></sl-button-group>
    <sl-button-group id="hid" label="Hidden" hidden><sl-button>Hidden</sl-button></sl-button-group>`);
  const r = await frame.locator('body').evaluate(() => {
    const info = el => {
      const base = el.shadowRoot.querySelector('[part="base"]');
      return { host: getComputedStyle(el).display, hostBox: getComputedStyle(el).boxSizing, base: getComputedStyle(base).display, wrap: getComputedStyle(base).flexWrap, baseBox: getComputedStyle(base).boxSizing, boxes: el.getClientRects().length };
    };
    const wrap = document.querySelector('#wrap');
    const buttons = [...wrap.children].map(b => b.getBoundingClientRect());
    return {
      group: info(document.querySelector('#demo-default')),
      hidden: info(document.querySelector('#hid')),
      // flex-wrap: nowrap keeps the buttons on one line even when the group is narrower than they are.
      oneLine: buttons[0].top === buttons[1].top,
    };
  });
  expect(r.group).toEqual({ host: 'inline-block', hostBox: 'border-box', base: 'flex', wrap: 'nowrap', baseBox: 'border-box', boxes: 1 });
  // Upstream quirk: the host's own display: inline-block outranks the browser's [hidden] rule.
  expect(r.hidden).toMatchObject({ host: 'inline-block', boxes: 1 });
  expect(r.oneLine).toBe(true);
});

test('upstream quirk: hidden on the group is a no-op while an element inside the shadow root with [hidden] would be hidden', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-button-group id="hid" label="Hidden" hidden><sl-button>Hidden</sl-button></sl-button-group>');
  const r = await frame.locator('#hid').evaluate(el => {
    const base = el.shadowRoot.querySelector('[part="base"]');
    const before = getComputedStyle(base).display;
    // Shoelace's shared component styles include `[hidden] { display: none !important }` for the shadow content.
    base.hidden = true;
    return { before, withHidden: getComputedStyle(base).display, host: getComputedStyle(el).display };
  });
  expect(r).toEqual({ before: 'flex', withHidden: 'none', host: 'inline-block' });
});

test('data attributes: every example\'s buttons get data-sl-button-group__button and first, inner or last by position, also through a wrapper', async ({ page }) => {
  await openPage(page);
  const summaries = {};
  for (const [title, name] of EXAMPLES) summaries[name] = await frameFor(page, title).locator('body').evaluate(summarize);

  const first = ['data-sl-button-group__button', 'data-sl-button-group__button--first'];
  const inner = ['data-sl-button-group__button', 'data-sl-button-group__button--inner'];
  const last = ['data-sl-button-group__button', 'data-sl-button-group__button--last'];
  const positions = group => group.slotted.map(s => (s.buttons.length === 1 ? s.buttons[0].data : null));
  const plain = n => Array.from({ length: n }, () => []);

  // Direct buttons: the attributes are on the buttons, in order.
  for (const name of ['basic', 'sizes', 'theme-buttons', 'pill']) {
    for (const group of summaries[name]) {
      expect(group.role).toBe('group');
      expect(group.label).toBe('Alignment');
      expect(positions(group)).toEqual([first, inner, last]);
    }
  }
  expect(summaries.basic).toHaveLength(1);
  expect(summaries.sizes.map(g => g.slotted[0].buttons[0].size)).toEqual(['small', 'medium', 'large']);
  expect(summaries['theme-buttons'].map(g => g.slotted[0].buttons[0].variant)).toEqual(['primary', 'success', 'neutral', 'warning', 'danger']);
  expect(summaries.pill.every(g => g.slotted.every(s => s.buttons[0].pill))).toBe(true);

  // Through a wrapper (sl-dropdown holds the trigger button, sl-tooltip wraps the tooltip buttons): the wrapper gets nothing, the button inside it gets the attributes of the wrapper's position.
  const dropdown = summaries.dropdown[0];
  expect(dropdown.label).toBe('Example Button Group');
  expect(dropdown.slotted.map(s => s.tag)).toEqual(['sl-button', 'sl-button', 'sl-dropdown']);
  expect(dropdown.slotted.map(s => s.data)).toEqual([first, inner, []]);
  expect(dropdown.slotted[2].buttons).toHaveLength(1);
  expect(dropdown.slotted[2].buttons[0]).toMatchObject({ text: 'Dropdown', caret: true, data: last });
  expect(dropdown.slotted.slice(0, 2).map(s => s.data)).toEqual([first, inner]);

  const split = summaries.split[0];
  expect(split.slotted.map(s => s.tag)).toEqual(['sl-button', 'sl-dropdown']);
  expect(split.slotted[0].buttons[0]).toMatchObject({ text: 'Save', variant: 'primary', data: first });
  expect(split.slotted[1].buttons[0]).toMatchObject({ text: 'More options', variant: 'primary', caret: true, data: last });
  expect(split.slotted[1].data).toEqual([]);

  const tooltips = summaries.tooltips[0];
  expect(tooltips.slotted.map(s => s.tag)).toEqual(['sl-tooltip', 'sl-tooltip', 'sl-tooltip']);
  expect(tooltips.slotted.map(s => s.content)).toEqual(["I'm on the left", "I'm in the middle", "I'm on the right"]);
  expect(tooltips.slotted.map(s => s.buttons[0].data)).toEqual([first, inner, last]);
  expect(tooltips.slotted.map(s => s.data)).toEqual(plain(3));

  const toolbar = summaries.toolbar;
  expect(toolbar.map(g => g.label)).toEqual(['History', 'Formatting', 'Alignment']);
  expect(toolbar.map(g => g.slotted.map(s => s.content))).toEqual([['Undo', 'Redo'], ['Bold', 'Italic', 'Underline'], ['Align Left', 'Align Center', 'Align Right']]);
  expect(toolbar.map(g => g.slotted.map(s => s.buttons[0].icon))).toEqual([
    ['arrow-counterclockwise', 'arrow-clockwise'], ['type-bold', 'type-italic', 'type-underline'], ['justify-left', 'justify', 'justify-right'],
  ]);
  expect(toolbar.map(g => g.slotted.map(s => s.buttons[0].data))).toEqual([[first, last], [first, inner, last], [first, inner, last]]);
});

test('the buttons\' own styles follow the data attributes: square joins between buttons, one pixel overlap, rounded ends, a divider between solid buttons', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-button-group id="one" label="One"><sl-button>Only</sl-button></sl-button-group>');
  const r = await frame.locator('body').evaluate(() => {
    const radiiOf = el => {
      const c = getComputedStyle(el.shadowRoot.querySelector('.button'));
      return [c.borderTopLeftRadius, c.borderBottomLeftRadius, c.borderTopRightRadius, c.borderBottomRightRadius].map(v => parseFloat(v) > 0);
    };
    const marginOf = el => getComputedStyle(el).marginLeft;
    const buttons = [...document.querySelectorAll('#demo-default sl-button')];
    const after = el => getComputedStyle(el.shadowRoot.querySelector('.button'), '::after').content === '""';
    const only = document.querySelector('#one sl-button');
    const frames = buttons.map(b => b.getBoundingClientRect());
    return {
      radii: buttons.map(radiiOf),
      margins: buttons.map(marginOf),
      only: radiiOf(only),
      overlap: frames.slice(1).map((f, i) => Math.round(frames[i].right - f.left)),
      dividers: buttons.map(after),
    };
  });
  // [top-left, bottom-left, top-right, bottom-right] is rounded?
  expect(r.radii).toEqual([[true, true, false, false], [false, false, false, false], [false, false, true, true]]);
  // The pill example: the same joins, with the rounded ends fully rounded.
  const pill = await frameFor(page, 'Pill buttons').locator('body').evaluate(() => [...document.querySelectorAll('#demo-medium sl-button')].map(el => {
    const c = getComputedStyle(el.shadowRoot.querySelector('.button'));
    return [c.borderTopLeftRadius, c.borderBottomLeftRadius, c.borderTopRightRadius, c.borderBottomRightRadius].map(parseFloat);
  }));
  const fullyRounded = 40;
  expect(pill).toEqual([[fullyRounded, fullyRounded, 0, 0], [0, 0, 0, 0], [0, 0, fullyRounded, fullyRounded]]);
  expect(r.only).toEqual([true, true, true, true]);
  expect(r.margins).toEqual(['0px', '-1px', '-1px']);
  expect(r.overlap).toEqual([1, 1]);
  // The divider is drawn on solid-variant buttons that are not first, and never on default ones.
  expect(r.dividers).toEqual([false, false, false]);
  const primary = await frameFor(page, 'Theme buttons').locator('#demo-primary').evaluate(group => [...group.children].map(el => getComputedStyle(el.shadowRoot.querySelector('.button'), '::after').content === '""'));
  expect(primary).toEqual([false, true, true]);
});

test('sizes and variants of the examples come from the button\'s tokens: heights 30, 40 and 50 pixels and five different variant backgrounds', async ({ page }) => {
  await openPage(page);
  const sizes = await frameFor(page, 'Button sizes').locator('body').evaluate(() => [...document.querySelectorAll('sl-button-group')].map(g => [...g.children].map(b => Math.round(b.shadowRoot.querySelector('.button').getBoundingClientRect().height))));
  expect(sizes).toEqual([[30, 30, 30], [40, 40, 40], [50, 50, 50]]);
  const variants = await frameFor(page, 'Theme buttons').locator('body').evaluate(() =>
    [...document.querySelectorAll('sl-button-group')].map(g => [...g.children].map(b => getComputedStyle(b.shadowRoot.querySelector('.button')).backgroundColor)));
  for (const colors of variants) expect(new Set(colors).size).toBe(1);
  expect(new Set(variants.map(c => c[0])).size).toBe(5);
});

test('hover and focus tracking: real hover and focus toggle the data attributes and raise the button\'s z-index, and moving on clears them', async ({ page }) => {
  const { frame } = await openPage(page);
  const buttons = frame.locator('#demo-default sl-button');
  const state = i => buttons.nth(i).evaluate(el => ({ hover: el.hasAttribute('data-sl-button-group__button--hover'), focus: el.hasAttribute('data-sl-button-group__button--focus'), z: getComputedStyle(el).zIndex }));
  expect(await state(0)).toEqual({ hover: false, focus: false, z: 'auto' });
  await buttons.nth(0).hover();
  expect(await state(0)).toEqual({ hover: true, focus: false, z: '1' });
  // The pointer moves to the next button: mouseout clears the first, mouseover sets the second.
  await buttons.nth(1).hover();
  expect(await state(0)).toEqual({ hover: false, focus: false, z: 'auto' });
  expect(await state(1)).toMatchObject({ hover: true, focus: false });
  // Focus through Playwright, not el.focus() inside the frame: Firefox does not let a frame's own script move the page's
  // focus into that frame, so no focusin or focusout is dispatched there and the group sees no focus at all. Playwright
  // focuses from its own script world, which does not see the button's focus() override, so it focuses the inner button.
  await buttons.nth(2).locator('.button').focus();
  expect(await buttons.nth(2).evaluate(el => [document.hasFocus(), el.shadowRoot.activeElement?.localName])).toEqual([true, 'button']);
  expect(await state(2)).toMatchObject({ focus: true, z: '2' });
  await buttons.nth(1).locator('.button').focus();
  expect(await state(2)).toMatchObject({ focus: false });
  expect(await state(1)).toMatchObject({ focus: true, z: '2' });
  await buttons.nth(1).locator('.button').blur();
  expect(await state(1)).toMatchObject({ focus: false });
});

test('hover and focus tracking works through a wrapper element, and events from elements with no button are ignored', async ({ page }) => {
  const { frame } = await openPage(page);
  const r = await frame.locator('body').evaluate(async () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = '<sl-button-group id="w" label="W"><span id="s1"><sl-button id="b1">One</sl-button></span><span id="plain">No button</span><span id="s3"><sl-button id="b3">Three</sl-button></span></sl-button-group>';
    document.body.append(wrapper);
    const w = wrapper.firstElementChild;
    await w.updateComplete;
    await new Promise(resolve => setTimeout(resolve, 50));
    const b1 = w.querySelector('#b1');
    const out = {};
    // An event aimed at the wrapper finds the button inside it; one aimed at a slotted element with no button finds nothing.
    w.querySelector('#s1').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    out.wrapperHover = b1.hasAttribute('data-sl-button-group__button--hover');
    w.querySelector('#s1').dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    out.wrapperHoverOff = b1.hasAttribute('data-sl-button-group__button--hover');
    w.querySelector('#plain').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    out.plainAttributes = w.querySelector('#plain').getAttributeNames();
    out.anyHover = [...w.querySelectorAll('[data-sl-button-group__button--hover]')].length;
    out.dataOnPlain = w.querySelector('#plain').getAttributeNames().filter(n => n.startsWith('data-'));
    // The middle slotted element has no button but still counts for the position of the others.
    out.positions = ['#b1', '#b3'].map(sel => w.querySelector(sel).getAttributeNames().filter(n => n.startsWith('data-sl-button-group__button')).sort());
    wrapper.remove();
    return out;
  });
  expect(r.wrapperHover).toBe(true);
  expect(r.wrapperHoverOff).toBe(false);
  expect(r.plainAttributes).toEqual(['id']);
  expect(r.anyHover).toBe(0);
  expect(r.dataOnPlain).toEqual([]);
  expect(r.positions).toEqual([
    ['data-sl-button-group__button', 'data-sl-button-group__button--first'],
    ['data-sl-button-group__button', 'data-sl-button-group__button--last'],
  ]);
});

test('upstream quirk: only the first button in a slotted element is styled, and text nodes do not count as slotted elements', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-button-group id="q" label="Q">text before<span id="multi"><sl-button id="m1">One</sl-button><sl-button id="m2">Two</sl-button></span>between<sl-button id="after">After</sl-button></sl-button-group>');
  const r = await frame.locator('body').evaluate(() => {
    const data = id => document.querySelector(`#q #${id}`).getAttributeNames().filter(n => n.startsWith('data-sl-button-group__button')).sort();
    return { m1: data('m1'), m2: data('m2'), after: data('after') };
  });
  expect(r.m1).toEqual(['data-sl-button-group__button', 'data-sl-button-group__button--first']);
  expect(r.m2).toEqual([]);
  expect(r.after).toEqual(['data-sl-button-group__button', 'data-sl-button-group__button--last']);
});

test('upstream quirk: the attributes are only recomputed on a slot change, and a button that leaves the group keeps them', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, `<sl-button-group id="q" label="Q"><span id="wrap"><sl-button id="inside">Inside</sl-button></span><sl-button id="direct">Direct</sl-button></sl-button-group>
    <sl-button-group id="q2" label="Other"><sl-button id="other">Other</sl-button></sl-button-group>`);
  const r = await frame.locator('body').evaluate(async () => {
    const data = el => el.getAttributeNames().filter(n => n.startsWith('data-sl-button-group__button')).sort();
    const settle = () => new Promise(resolve => setTimeout(resolve, 50));
    const group = document.querySelector('#q');
    const out = { initial: [data(document.querySelector('#inside')), data(document.querySelector('#direct'))] };
    // A button added inside the slotted wrapper does not change the group's slotted elements: no slot change, no attributes.
    const added = document.createElement('sl-button');
    added.textContent = 'Added';
    document.querySelector('#wrap').append(added);
    await added.updateComplete;
    await settle();
    out.addedInWrapper = data(added);
    // A new slotted element is a slot change: every slotted element is recomputed, so the positions shift.
    const extra = document.createElement('sl-button');
    extra.id = 'extra';
    extra.textContent = 'Extra';
    group.prepend(extra);
    await extra.updateComplete;
    await settle();
    out.afterPrepend = { extra: data(extra), inside: data(document.querySelector('#inside')), direct: data(document.querySelector('#direct')) };
    // Hover and focus are set while the button is in the group; leaving does not clear anything.
    const direct = document.querySelector('#direct');
    direct.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    direct.remove();
    document.querySelector('#q2').append(direct);
    out.movedOut = data(direct);
    await settle();
    out.afterMove = { direct: data(direct), other: data(document.querySelector('#other')), left: data(document.querySelector('#inside')), extra: data(document.querySelector('#extra')) };
    return out;
  });
  const bare = ['data-sl-button-group__button'];
  expect(r.initial).toEqual([[...bare, 'data-sl-button-group__button--first'], [...bare, 'data-sl-button-group__button--last']]);
  expect(r.addedInWrapper).toEqual([]);
  expect(r.afterPrepend.extra).toEqual([...bare, 'data-sl-button-group__button--first']);
  expect(r.afterPrepend.inside).toEqual([...bare, 'data-sl-button-group__button--inner']);
  expect(r.afterPrepend.direct).toEqual([...bare, 'data-sl-button-group__button--last']);
  // Removed from the first group with its last and hover attributes intact.
  expect(r.movedOut).toEqual([...bare, 'data-sl-button-group__button--hover', 'data-sl-button-group__button--last']);
  // The button's own attributes are recomputed only by the group it is slotted into (here the last of two). The group it
  // left recomputes the buttons that stayed (a slot change), so `inside` is now the last one.
  expect(r.afterMove.direct).toEqual([...bare, 'data-sl-button-group__button--hover', 'data-sl-button-group__button--last']);
  expect(r.afterMove.other).toEqual([...bare, 'data-sl-button-group__button--first']);
  expect(r.afterMove.left).toEqual([...bare, 'data-sl-button-group__button--last']);
  expect(r.afterMove.extra).toEqual([...bare, 'data-sl-button-group__button--first']);
});

test('label, disableRole and ARIA: label is not reflected and feeds aria-label, disableRole switches the role to presentation, both without an attribute', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-button-group id="l"><sl-button>A</sl-button></sl-button-group>');
  const r = await frame.locator('#l').evaluate(async el => {
    const base = () => el.shadowRoot.querySelector('[part="base"]');
    const out = { defaults: { label: el.label, disableRole: el.disableRole, role: base().getAttribute('role'), aria: base().getAttribute('aria-label') } };
    el.label = 'Formatting';
    await el.updateComplete;
    out.property = { aria: base().getAttribute('aria-label'), attribute: el.getAttribute('label') };
    el.setAttribute('label', 'From attribute');
    await el.updateComplete;
    out.attribute = { label: el.label, aria: base().getAttribute('aria-label') };
    el.removeAttribute('label');
    await el.updateComplete;
    // Not reflected, so not restored either: a removed attribute leaves null, and null renders as an empty value.
    out.removed = { label: el.label, aria: base().getAttribute('aria-label') };
    el.disableRole = true;
    await el.updateComplete;
    out.presentation = { role: base().getAttribute('role'), attributes: el.getAttributeNames().sort(), hasAttributeDisableRole: el.hasAttribute('disablerole') || el.hasAttribute('disable-role') };
    el.disableRole = false;
    await el.updateComplete;
    out.group = base().getAttribute('role');
    return out;
  });
  expect(r.defaults).toEqual({ label: '', disableRole: false, role: 'group', aria: '' });
  expect(r.property).toEqual({ aria: 'Formatting', attribute: null });
  expect(r.attribute).toEqual({ label: 'From attribute', aria: 'From attribute' });
  expect(r.removed).toEqual({ label: null, aria: '' });
  expect(r.presentation).toEqual({ role: 'presentation', attributes: ['id'], hasAttributeDisableRole: false });
  expect(r.group).toBe('group');
});

test('dir and lang are reactive, not reflected and undefined by default, as Shoelace\'s base element declares them', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-button-group id="dl"><sl-button>A</sl-button></sl-button-group><sl-button-group id="attrs" dir="rtl" lang="de"><sl-button>A</sl-button></sl-button-group>');
  const r = await frame.locator('body').evaluate(async () => {
    const el = document.querySelector('#dl');
    const attrs = document.querySelector('#attrs');
    const defaults = [el.dir, el.lang];
    await el.updateComplete;
    el.dir = 'auto';
    const updateRequestedByDir = el.isUpdatePending;
    await el.updateComplete;
    el.lang = 'fr';
    const updateRequestedByLang = el.isUpdatePending;
    await el.updateComplete;
    const assigned = [el.dir, el.lang, el.getAttribute('dir'), el.getAttribute('lang')];
    // Shoelace declares `dir: string`: any string is stored and returned as set, not normalized to ltr or rtl.
    el.dir = 'sideways';
    const anyString = el.dir;
    const fromAttributes = [attrs.dir, attrs.lang];
    attrs.removeAttribute('dir');
    attrs.removeAttribute('lang');
    await attrs.updateComplete;
    return { defaults, updateRequestedByDir, updateRequestedByLang, assigned, anyString, fromAttributes, removed: [attrs.dir, attrs.lang] };
  });
  expect(r).toEqual({
    defaults: [undefined, undefined],
    updateRequestedByDir: true,
    updateRequestedByLang: true,
    assigned: ['auto', 'fr', null, null],
    anyString: 'sideways',
    fromAttributes: ['rtl', 'de'],
    removed: [null, null],
  });
});

test('removing a reflected attribute restores the initial value recorded at the first attribute change (only the core extras reflect)', async ({ page }) => {
  const { frame } = await openPage(page);
  const r = await frame.locator('body').evaluate(async body => {
    const make = () => {
      const el = document.createElement('sl-button-group');
      el.innerHTML = '<sl-button>A</sl-button>';
      return el;
    };
    // `select` assigned before the first attribute change is the initial value; removing the attribute restores it.
    const early = make();
    early.select = 'multiple';
    body.append(early);
    await early.updateComplete;
    early.setAttribute('label', 'first change');
    early.removeAttribute('select');
    await early.updateComplete;
    // `select` assigned after the first attribute change is not recorded, so removing the attribute leaves null.
    const late = make();
    late.setAttribute('label', 'first change');
    body.append(late);
    await late.updateComplete;
    late.select = 'single';
    await late.updateComplete;
    const lateReflected = late.getAttribute('select');
    late.removeAttribute('select');
    await late.updateComplete;
    const out = {
      early: { select: early.select, attribute: early.getAttribute('select') },
      late: { reflected: lateReflected, select: late.select, attribute: late.getAttribute('select') },
    };
    early.remove();
    late.remove();
    return out;
  });
  expect(r.early).toEqual({ select: 'multiple', attribute: 'multiple' });
  expect(r.late).toEqual({ reflected: 'single', select: null, attribute: null });
});

test('inherited core ready event: dispatched once after the first update, not bubbling or composed; the group emits no other event', async ({ page }) => {
  const { frame } = await openPage(page);
  await frame.locator('body').evaluate(async body => {
    const seen = [];
    let bubbled = 0;
    const others = [];
    const el = document.createElement('sl-button-group');
    el.innerHTML = '<sl-button id="ev1">A</sl-button><sl-button>B</sl-button>';
    el.addEventListener('ready', event => seen.push({ bubbles: event.bubbles, composed: event.composed, target: event.target === el }));
    body.addEventListener('ready', event => { if (event.target === el) bubbled++; });
    const names = ['change', 'sl-change', 'sl-input', 'sl-focus', 'sl-blur', 'sl-invalid', 'sl-hide', 'sl-show', 'sl-select'];
    for (const name of names) el.addEventListener(name, event => { if (event.target === el) others.push(name); });
    body.append(el);
    await el.updateComplete;
    el.label = 'later';
    el.disableRole = true;
    await el.updateComplete;
    el.querySelector('#ev1').click();
    await new Promise(resolve => setTimeout(resolve, 50));
    window.readyProbe = { el, seen, bubbled: () => bubbled, others };
  });
  // The button gets focus and loses it through Playwright, not el.focus() inside the frame: Firefox does not let a frame's
  // own script move the page's focus into that frame, so the button would emit no sl-focus or sl-blur at all.
  await frame.locator('#ev1 .button').focus();
  await frame.locator('body').evaluate(() => {
    window.readyProbe.fromButton = [];
    window.readyProbe.el.addEventListener('sl-blur', event => window.readyProbe.fromButton.push(event.target.id));
  });
  await frame.locator('#ev1 .button').blur();
  const r = await frame.locator('body').evaluate(async () => {
    await new Promise(resolve => setTimeout(resolve, 50));
    const { el, seen, bubbled, others, fromButton } = window.readyProbe;
    el.remove();
    delete window.readyProbe;
    return { seen, bubbled: bubbled(), others, fromButton };
  });
  // The buttons' own events bubble through the group (target is the button), which is not the group emitting them.
  expect(r.seen).toEqual([{ bubbles: false, composed: false, target: true }]);
  expect(r.bubbled).toBe(0);
  expect(r.others).toEqual([]);
  expect(r.fromButton).toEqual(['ev1']);
});

test('Velcro extension select: single or multiple makes the slotted sl-button elements toggle buttons, single keeps one pressed', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, `<sl-button-group id="single" label="Single" select="single"><sl-button id="s1">A</sl-button><sl-button id="s2">B</sl-button><sl-button id="s3">C</sl-button></sl-button-group>
    <sl-button-group id="multiple" label="Multiple" select="multiple"><sl-button id="m1">A</sl-button><sl-button id="m2">B</sl-button></sl-button-group>
    <sl-button-group id="off" label="Off"><sl-button id="o1">A</sl-button></sl-button-group>`);
  const r = await frame.locator('body').evaluate(async () => {
    const q = id => document.querySelector(`#${id}`);
    const pressed = ids => ids.map(id => q(id).pressed === true);
    const settle = async (...ids) => { await Promise.all(ids.map(id => q(id).updateComplete)); await new Promise(resolve => setTimeout(resolve, 20)); };
    const out = {
      toggle: ['s1', 'm1', 'o1'].map(id => q(id).hasAttribute('toggle')),
      reflected: [q('single').getAttribute('select'), q('multiple').select, q('off').select],
    };
    q('s1').click();
    await settle('s1', 's2', 's3');
    out.singleFirst = pressed(['s1', 's2', 's3']);
    q('s2').click();
    await settle('s1', 's2', 's3');
    out.singleSecond = pressed(['s1', 's2', 's3']);
    q('s2').click();
    await settle('s1', 's2', 's3');
    out.singleOff = pressed(['s1', 's2', 's3']);
    q('m1').click();
    q('m2').click();
    await settle('m1', 'm2');
    out.multiple = pressed(['m1', 'm2']);
    out.aria = [q('m1').shadowRoot.querySelector('.button').getAttribute('aria-pressed'), q('m1').shadowRoot.querySelector('.button').getAttribute('aria-pressed')];
    q('o1').click();
    await settle('o1');
    out.off = pressed(['o1']);
    return out;
  });
  expect(r.toggle).toEqual([true, true, false]);
  expect(r.reflected).toEqual(['single', 'multiple', undefined]);
  expect(r.singleFirst).toEqual([true, false, false]);
  expect(r.singleSecond).toEqual([false, true, false]);
  expect(r.singleOff).toEqual([false, false, false]);
  expect(r.multiple).toEqual([true, true]);
  expect(r.aria).toEqual(['true', 'true']);
  expect(r.off).toEqual([false]);
});

test('Velcro extensions set after the buttons are slotted: toggle and the roving tab index wait for the next slot change, and the single-select reset needs select at connect time (as in core)', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-button-group id="late" label="Late"><sl-button id="l1">A</sl-button><sl-button id="l2">B</sl-button></sl-button-group>');
  const r = await frame.locator('#late').evaluate(async group => {
    const settle = async () => { await group.updateComplete; await new Promise(resolve => setTimeout(resolve, 50)); };
    const state = () => ({
      toggle: [...group.children].map(b => b.hasAttribute('toggle')),
      tabindex: [...group.children].map(b => b.getAttribute('tabindex')),
      role: group.shadowRoot.querySelector('[part="base"]').getAttribute('role'),
    });
    group.setAttribute('select', 'single');
    group.setAttribute('toolbar', '');
    await settle();
    const before = state();
    const extra = document.createElement('sl-button');
    extra.id = 'l3';
    extra.textContent = 'C';
    group.append(extra);
    await extra.updateComplete;
    await settle();
    const after = state();
    // `select` was set after the group connected, so core's single-select reset is not listening: both stay pressed.
    group.querySelector('#l1').click();
    group.querySelector('#l2').click();
    await settle();
    return { before, after, pressed: [...group.children].map(b => b.pressed === true) };
  });
  expect(r.before).toEqual({ toggle: [false, false], tabindex: [null, null], role: 'toolbar' });
  expect(r.after).toEqual({ toggle: [true, true, true], tabindex: ['0', '-1', '-1'], role: 'toolbar' });
  expect(r.pressed).toEqual([true, true, false]);
});

test('Velcro extension toolbar: role toolbar, a roving tab index and arrow keys that move focus between the slotted buttons, also in nested groups', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, `<sl-button-group id="bar" label="Bar" toolbar><sl-button id="t1">A</sl-button><sl-button id="t2">B</sl-button><sl-button id="t3">C</sl-button></sl-button-group>
    <div id="outer"><sl-button-group id="parent" label="Parent" toolbar><sl-button-group id="child" label="Child"><sl-button id="c1">X</sl-button><sl-button id="c2">Y</sl-button></sl-button-group></sl-button-group></div>
    <sl-button-group id="plain" label="Plain"><sl-button id="p1">A</sl-button><sl-button id="p2">B</sl-button></sl-button-group>`);
  const read = () => frame.locator('body').evaluate(() => {
    const q = id => document.querySelector(`#${id}`);
    return {
      role: ['bar', 'parent', 'child', 'plain'].map(id => q(id).shadowRoot.querySelector('[part="base"]').getAttribute('role')),
      tabindex: ['t1', 't2', 't3', 'p1', 'p2'].map(id => q(id).getAttribute('tabindex')),
      active: document.activeElement?.id ?? null,
      focusedInside: ['t1', 't2', 't3'].find(id => q(id).matches(':focus-within') || q(id).shadowRoot.activeElement) ?? null,
    };
  });
  const first = await read();
  expect(first.role).toEqual(['toolbar', 'toolbar', 'toolbar', 'group']);
  expect(first.tabindex).toEqual(['0', '-1', '-1', null, null]);
  await frame.locator('#t1 .button').focus();
  await frame.locator('#t1').press('ArrowRight');
  await expect.poll(async () => (await read()).focusedInside).toBe('t2');
  expect((await read()).tabindex).toEqual(['-1', '0', '-1', null, null]);
  await frame.locator('#t2').press('ArrowDown');
  await expect.poll(async () => (await read()).focusedInside).toBe('t3');
  await frame.locator('#t3').press('ArrowRight');
  await expect.poll(async () => (await read()).focusedInside).toBe('t1');
  await frame.locator('#t1').press('ArrowLeft');
  await expect.poll(async () => (await read()).focusedInside).toBe('t3');
  // A group without toolbar leaves the arrow keys alone.
  const prevented = await frame.locator('#p1').evaluate(el => {
    el.focus();
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true, cancelable: true });
    el.shadowRoot.querySelector('.button').dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(false);
  // Core's `toolbar` is applied to nested groups by the parent's slot change.
  expect(await frame.locator('#child').evaluate(el => el.hasAttribute('toolbar'))).toBe(true);
});

test('Velcro extension toolbar keeps its arrow keys after the group is moved in the document', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-button-group id="bar" label="Bar" toolbar><sl-button id="t1">A</sl-button><sl-button id="t2">B</sl-button></sl-button-group>');
  await frame.locator('#bar').evaluate(el => { const parent = el.parentElement; el.remove(); parent.append(el); });
  await frame.locator('#t1 .button').focus();
  const prevented = await frame.locator('#t1').evaluate(el => {
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true, cancelable: true });
    el.shadowRoot.querySelector('.button').dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(true);
});

test('removing the toolbar extension releases it: the role, the arrow keys, the roving tab index (the buttons\' own tabindex comes back) and the toolbar attribute given to nested groups', async ({ page }) => {
  const { frame } = await openPage(page);
  // Attributed in the markup, so the reflected-property snapshot has nothing recorded for toolbar and removing it sticks.
  await mount(frame, `<sl-button-group id="bar" label="Bar" toolbar><sl-button id="t1">A</sl-button><sl-button id="t2">B</sl-button><sl-button id="t3" tabindex="3">C</sl-button></sl-button-group>
    <sl-button-group id="parent" label="Parent" toolbar><sl-button-group id="child" label="Child"><sl-button id="c1">X</sl-button></sl-button-group></sl-button-group>
    <sl-button-group id="own" label="Own" toolbar><sl-button-group id="kept" label="Kept" toolbar><sl-button id="k1">X</sl-button></sl-button-group></sl-button-group>`);
  const read = () => frame.locator('body').evaluate(() => {
    const q = id => document.querySelector(`#${id}`);
    return {
      role: ['bar', 'parent', 'child', 'own', 'kept'].map(id => q(id).shadowRoot.querySelector('[part="base"]').getAttribute('role')),
      tabindex: ['t1', 't2', 't3'].map(id => q(id).getAttribute('tabindex')),
      toolbar: ['bar', 'parent', 'child', 'own', 'kept'].map(id => q(id).hasAttribute('toolbar')),
      property: q('bar').toolbar ?? null,
      active: document.activeElement?.id ?? null,
    };
  });
  expect(await read()).toMatchObject({ role: ['toolbar', 'toolbar', 'toolbar', 'toolbar', 'toolbar'], tabindex: ['0', '-1', '-1'], toolbar: [true, true, true, true, true] });
  // The arrow keys move focus while it is a toolbar.
  await frame.locator('#t1 .button').focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await read()).active).toBe('t2');
  await frame.locator('#t1 .button').focus();

  await frame.locator('body').evaluate(async () => {
    for (const id of ['bar', 'parent', 'own']) document.querySelector(`#${id}`).removeAttribute('toolbar');
    await Promise.all(['bar', 'parent', 'child', 'own', 'kept'].map(id => document.querySelector(`#${id}`).updateComplete));
    await new Promise(resolve => setTimeout(resolve, 50));
  });
  // Neutral Shoelace group again: role group, the buttons' tabindex as before (none, and the author's own 3), arrow keys left alone.
  // `child` only had toolbar because `parent` gave it; `kept` had its own toolbar attribute and keeps it.
  expect(await read()).toMatchObject({ role: ['group', 'group', 'group', 'group', 'toolbar'], tabindex: [null, null, '3'], toolbar: [false, false, false, false, true], property: false });
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await read()).active).toBe('t1');
  const prevented = await frame.locator('#t1').evaluate(el => {
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true, cancelable: true });
    el.shadowRoot.querySelector('.button').dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(false);
});

test('removing the select extension releases it: the toggle attribute the group wrote goes, a button\'s own toggle stays, and the group stops un-pressing', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, `<sl-button-group id="sel" label="Select" select="single"><sl-button id="s1">A</sl-button><sl-button id="s2" toggle>B</sl-button><sl-button id="s3">C</sl-button></sl-button-group>`);
  const read = () => frame.locator('body').evaluate(() => {
    const q = id => document.querySelector(`#${id}`);
    return { toggle: ['s1', 's2', 's3'].map(id => q(id).hasAttribute('toggle')), pressed: ['s1', 's2', 's3'].map(id => q(id).pressed === true), select: q('sel').select ?? null };
  });
  const click = id => frame.locator('body').evaluate(async (_, id) => {
    const el = document.querySelector(`#${id}`);
    el.click();
    await el.updateComplete;
    await new Promise(resolve => setTimeout(resolve, 20));
  }, id);
  expect(await read()).toEqual({ toggle: [true, true, true], pressed: [false, false, false], select: 'single' });
  await click('s1');
  await click('s2');
  // While it is set, one button is pressed at a time.
  expect((await read()).pressed).toEqual([false, true, false]);

  await frame.locator('body').evaluate(async () => {
    document.querySelector('#sel').removeAttribute('select');
    await document.querySelector('#sel').updateComplete;
    await new Promise(resolve => setTimeout(resolve, 20));
  });
  expect(await read()).toEqual({ toggle: [false, true, false], pressed: [false, true, false], select: null });
  // s1 and s3 are plain buttons again. s2 still toggles (its own attribute), and nothing un-presses the others.
  await click('s1');
  await click('s3');
  expect((await read()).pressed).toEqual([false, true, false]);
  await click('s2');
  expect((await read()).pressed).toEqual([false, false, false]);

  // Setting it again: the group connected with select, so the single-select listener that removing it took off comes back
  // (on the next slot change the group also writes toggle to the buttons again). Pressing one un-presses the others.
  await frame.locator('body').evaluate(async () => {
    const group = document.querySelector('#sel');
    group.setAttribute('select', 'single');
    await group.updateComplete;
    const extra = document.createElement('sl-button');
    extra.id = 's4';
    extra.textContent = 'D';
    group.append(extra);
    await extra.updateComplete;
    await new Promise(resolve => setTimeout(resolve, 50));
  });
  expect(await read()).toEqual({ toggle: [true, true, true], pressed: [false, false, false], select: 'single' });
  await click('s1');
  expect((await read()).pressed).toEqual([true, false, false]);
  await click('s3');
  expect((await read()).pressed).toEqual([false, false, true]);
});

test('setting select again puts back only the listener that was active when the group connected: a group that connected without select, or that was moved while it was off, stays without one (as in core)', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, `<sl-button-group id="late" label="Late"><sl-button id="a1">A</sl-button><sl-button id="a2">B</sl-button></sl-button-group>
    <div id="home"><sl-button-group id="moved" label="Moved" select="single"><sl-button id="m1">A</sl-button><sl-button id="m2">B</sl-button></sl-button-group></div>`);
  const r = await frame.locator('body').evaluate(async () => {
    const settle = async el => { await el.updateComplete; await new Promise(resolve => setTimeout(resolve, 50)); };
    const addButton = async (group, id) => {
      const extra = document.createElement('sl-button');
      extra.id = id;
      extra.textContent = id;
      group.append(extra);
      await extra.updateComplete;
      await settle(group);
    };
    const pressed = ids => ids.map(id => document.querySelector(`#${id}`).pressed === true);

    // Connected neutral: select on, off, on again, each with a slot change. There never was a listener.
    const late = document.querySelector('#late');
    late.setAttribute('select', 'single');
    await addButton(late, 'a3');
    late.removeAttribute('select');
    await settle(late);
    late.setAttribute('select', 'single');
    await addButton(late, 'a4');
    document.querySelector('#a1').click();
    document.querySelector('#a2').click();
    await settle(late);

    // Connected with select, taken off, then moved in the document while it is off: core takes its listeners off on
    // disconnect and installs the selection one on connect only with select set, so setting it again adds none.
    const moved = document.querySelector('#moved');
    moved.removeAttribute('select');
    await settle(moved);
    document.querySelector('#home').after(moved);
    await settle(moved);
    moved.setAttribute('select', 'single');
    await addButton(moved, 'm3');
    document.querySelector('#m1').click();
    document.querySelector('#m2').click();
    await settle(moved);
    return { late: pressed(['a1', 'a2', 'a3', 'a4']), moved: pressed(['m1', 'm2', 'm3']), toggles: ['a1', 'a2', 'a4', 'm1', 'm2', 'm3'].map(id => document.querySelector(`#${id}`).hasAttribute('toggle')) };
  });
  // Both buttons stay pressed: the toggle attributes are back (the next slot change wrote them) but nothing un-presses.
  expect(r.toggles).toEqual([true, true, true, true, true, true]);
  expect(r.late).toEqual([true, true, false, false]);
  expect(r.moved).toEqual([true, true, false]);
});

test('a toolbar set and removed in the same turn leaves a neutral group neutral: role group, the buttons\' tabindex untouched and the arrow keys not handled', async ({ page }) => {
  const { frame } = await openPage(page);
  // Labelled and never attributed with toolbar: the reflected-property snapshot records nothing for it.
  await mount(frame, '<sl-button-group id="turn" label="Turn"><sl-button id="n1">A</sl-button><sl-button id="n2" tabindex="4">B</sl-button></sl-button-group>');
  const r = await frame.locator('#turn').evaluate(async group => {
    const settle = async () => { await group.updateComplete; await new Promise(resolve => setTimeout(resolve, 50)); };
    // Lit reports the value from before the first change of the turn (none), yet core adds its key handler on the set.
    group.setAttribute('toolbar', '');
    group.removeAttribute('toolbar');
    await settle();
    const extra = document.createElement('sl-button');
    extra.id = 'n3';
    group.append(extra);
    await extra.updateComplete;
    await settle();
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true, cancelable: true });
    group.querySelector('#n1').shadowRoot.querySelector('.button').dispatchEvent(event);
    return {
      role: group.shadowRoot.querySelector('[part="base"]').getAttribute('role'),
      attribute: group.hasAttribute('toolbar'),
      property: group.toolbar,
      tabindex: [...group.children].map(b => b.getAttribute('tabindex')),
      prevented: event.defaultPrevented,
    };
  });
  expect(r).toEqual({ role: 'group', attribute: false, property: false, tabindex: [null, '4', null], prevented: false });
});

test('core\'s vertical and split are accepted but change nothing; core\'s position attribute, parts and properties do not exist, and tooltips keep their distance', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, `<sl-button-group id="plain" label="Plain"><sl-button id="a">A</sl-button><sl-button id="b">B</sl-button></sl-button-group>
    <sl-button-group id="odd" label="Odd" vertical split><sl-button id="c">A</sl-button><sl-button id="d">B</sl-button></sl-button-group>
    <sl-button-group id="tip" label="Tip"><sl-tooltip id="tooltip">T</sl-tooltip><sl-button>A</sl-button></sl-button-group>`);
  const r = await frame.locator('body').evaluate(() => {
    const q = id => document.querySelector(`#${id}`);
    const layout = id => {
      const el = q(id);
      const base = el.shadowRoot.querySelector('[part="base"]');
      const rects = [...el.children].filter(c => c.localName === 'sl-button').map(c => c.getBoundingClientRect());
      return {
        direction: getComputedStyle(base).flexDirection,
        sameRow: rects.every(rect => rect.top === rects[0].top),
        part: base.getAttribute('part'),
        childAttributes: [...el.children].filter(c => c.localName === 'sl-button').map(c => c.getAttributeNames().filter(n => ['button-group-button-position', 'vertical', 'split', 'toggle', 'tabindex'].includes(n))),
      };
    };
    return {
      plain: layout('plain'),
      odd: layout('odd'),
      oddProps: { vertical: q('odd').vertical, split: q('odd').split, attributes: [q('odd').hasAttribute('vertical'), q('odd').hasAttribute('split')] },
      oddData: [...q('odd').children].map(c => c.getAttributeNames().filter(n => n.startsWith('data-sl-button-group__button')).sort().length > 0),
      tooltipDistance: q('tooltip').distance ?? null,
      cssProps: ['--button-group-gap', '--button-group-divider-color'].map(p => getComputedStyle(q('plain')).getPropertyValue(p)),
    };
  });
  expect(r.plain.direction).toBe('row');
  expect(r.odd).toEqual({ direction: 'row', sameRow: true, part: 'base', childAttributes: [[], []] });
  expect(r.plain.childAttributes).toEqual([[], []]);
  expect(r.oddProps).toEqual({ vertical: true, split: true, attributes: [true, true] });
  expect(r.oddData).toEqual([true, true]);
  // Shoelace's default distance: the group does not change its tooltips' distance as core's group does.
  expect(r.tooltipDistance).toBe(8);
  expect(r.cssProps).toEqual(['', '']);
});

test('no upstream Shoelace runtime is requested or defined; all requests stay on the local origin', async ({ page }) => {
  const { frame, requests } = await openPage(page);
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  expect(await frame.locator('body').evaluate(() => Boolean(window.Shoelace || document.querySelector('script[src*="shoelace"]')))).toBe(false);
});

test('the toolbar example\'s icons render and its CSS spaces the groups', async ({ page }) => {
  await openPage(page);
  const frame = frameFor(page, 'Toolbar example');
  await expect.poll(() => frame.locator('body').evaluate(() => [...document.querySelectorAll('sl-icon')].filter(i => i.shadowRoot?.querySelector('svg')).length)).toBe(8);
  const margins = await frame.locator('body').evaluate(() => [...document.querySelectorAll('sl-button-group')].map(g => getComputedStyle(g).marginRight));
  expect(margins).toEqual(['8px', '8px', '0px']);
});

// Shoelace's React examples, ported in packages/docs/examples/button-group/react/*.jsx (the files the docs page shows),
// bundled with React 19 and the generated wrappers, which are resolved through the package's real export map. Each one
// is rendered and compared with the HTML example it belongs to.
test.describe('React examples', () => {
  const reactDir = fileURLToPath(new URL('../../packages/docs/examples/button-group/react/', import.meta.url));
  let bundle;

  test.beforeAll(async () => {
    const fromVelcro = createRequire(path.join(velcroDir, 'package.json'));
    const fromDocs = createRequire(fileURLToPath(new URL('../../packages/docs/package.json', import.meta.url)));
    const pkgDir = name => path.dirname(fromVelcro.resolve(`${name}/package.json`));
    const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
    const dir = mkdtempSync(path.join(tmpdir(), 'velcro-button-group-react-'));
    try {
      // Each example file declares `App` without exporting it (as on Shoelace's page); the copy only appends the export.
      for (const [, name] of EXAMPLES) {
        writeFileSync(path.join(dir, `${name}.jsx`), `${readFileSync(path.join(reactDir, `${name}.jsx`), 'utf8')}\nexport default App;\n`);
      }
      const entry = path.join(dir, 'entry.js');
      writeFileSync(entry, `
        import React from 'react';
        import { flushSync } from 'react-dom';
        import { createRoot } from 'react-dom/client';
        import { VelcroButton } from '@charm-ux/velcro/react/VelcroButton.js';
        import { VelcroButtonGroup } from '@charm-ux/velcro/react/VelcroButtonGroup.js';
        ${EXAMPLES.map(([, name], i) => `import App${i} from './${name}.jsx';`).join('\n')}
        const apps = { ${EXAMPLES.map(([, name], i) => `${JSON.stringify(name)}: App${i}`).join(', ')} };
        window.errors = [];
        addEventListener('error', e => window.errors.push(String(e.message)));
        addEventListener('unhandledrejection', e => window.errors.push(String(e.reason)));
        window.reactVersion = React.version;
        // One root that is rendered again with another label, with a ref that React fills with the element.
        window.groupRef = React.createRef();
        let refRoot;
        window.renderWithRef = label => {
          if (!refRoot) {
            const host = document.createElement('div');
            document.body.append(host);
            refRoot = createRoot(host);
          }
          flushSync(() => refRoot.render(React.createElement(VelcroButtonGroup, { ref: window.groupRef, label },
            React.createElement(VelcroButton, null, 'One'), React.createElement(VelcroButton, null, 'Two'))));
        };
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

  async function load(page) {
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.setContent('<!DOCTYPE html><html><body style="margin: 0"></body></html>');
    await page.addScriptTag({ type: 'module', content: bundle });
    await page.waitForFunction(() => typeof window.renderExample === 'function');
    return pageErrors;
  }

  async function render(page, name) {
    await page.evaluate(async n => {
      document.body.replaceChildren();
      window.renderExample(n);
      await customElements.whenDefined('sl-button-group');
      await Promise.all([...document.querySelectorAll('sl-button-group, sl-button')].map(el => el.updateComplete));
      await new Promise(resolve => setTimeout(resolve, 50));
    }, name);
  }

  test('every React example renders the same groups, buttons and data attributes as the HTML example it belongs to', async ({ page }) => {
    test.setTimeout(150_000);
    // The HTML examples, from a second page, so that the two documents never share a registry.
    const htmlPage = await page.context().newPage();
    watchNetwork(htmlPage);
    const expected = {};
    try {
      await openPage(htmlPage);
      for (const [title, name] of EXAMPLES) expected[name] = await frameFor(htmlPage, title).locator('body').evaluate(summarize);
    } finally {
      await htmlPage.close();
    }
    const pageErrors = await load(page);
    expect(await page.evaluate(() => window.reactVersion)).toBe('19.2.0');
    for (const [, name] of EXAMPLES) {
      await render(page, name);
      const actual = await page.evaluate(summarize);
      expect(actual.length, name).toBeGreaterThan(0);
      expect(actual, name).toEqual(expected[name]);
    }
    expect(await page.evaluate(() => window.errors)).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('the wrapper passes label as a property: the first render sets the element\'s label and aria-label', async ({ page }) => {
    const pageErrors = await load(page);
    await render(page, 'basic');
    const r = await page.evaluate(() => {
      const group = document.querySelector('sl-button-group');
      return { label: group.label, aria: group.shadowRoot.querySelector('[part="base"]').getAttribute('aria-label'), ctor: customElements.get('sl-button-group') === group.constructor };
    });
    expect(r).toEqual({ label: 'Alignment', aria: 'Alignment', ctor: true });
    expect(pageErrors).toEqual([]);
  });

  test('a ref given to the wrapper is filled with the rendered sl-button-group, and a new label prop reaches that same element', async ({ page }) => {
    const pageErrors = await load(page);
    const r = await page.evaluate(async () => {
      const read = el => ({ label: el.label, aria: el.shadowRoot.querySelector('[part="base"]').getAttribute('aria-label') });
      window.renderWithRef('First');
      await customElements.whenDefined('sl-button-group');
      const el = window.groupRef.current;
      await el?.updateComplete;
      const groups = [...document.querySelectorAll('sl-button-group')];
      const first = { tag: el?.localName ?? null, isTheRenderedGroup: groups.length === 1 && groups[0] === el, ...(el ? read(el) : {}) };
      window.renderWithRef('Second');
      await el.updateComplete;
      return { first, second: { sameElement: window.groupRef.current === el, count: document.querySelectorAll('sl-button-group').length, ...read(el) } };
    });
    expect(r.first).toEqual({ tag: 'sl-button-group', isTheRenderedGroup: true, label: 'First', aria: 'First' });
    expect(r.second).toEqual({ sameElement: true, count: 1, label: 'Second', aria: 'Second' });
    expect(pageErrors).toEqual([]);
  });
});
