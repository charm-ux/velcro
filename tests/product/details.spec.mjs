// sl-details product checks against Shoelace 2.20.1's details contract, through the docs page's examples.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';
import { buildFixtures, gotoBlank } from './support/fixtures.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/details';
const docsDir = fileURLToPath(new URL('../../packages/docs/', import.meta.url));
const velcroDir = fileURLToPath(new URL('../../packages/velcro/', import.meta.url));

// The docs page's examples, in Shoelace's order: the example's title and the name of its files under examples/details/.
const EXAMPLES = [
  ['Overview', 'basic'],
  ['Disabled', 'disabled'],
  ['Customizing the Summary Icon', 'custom-icons'],
  ['Grouping Details', 'grouping'],
];
// Shoelace's page has React versions of the first three.
const REACT_EXAMPLES = EXAMPLES.slice(0, 3);

const frameFor = (page, title) => page.frameLocator(`iframe.example[title="Details example: ${title}"]`);

async function openExample(page, name = 'Overview') {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  const frame = frameFor(page, name);
  await expect(frame.locator('sl-details').first()).toBeAttached();
  await frame.locator('body').evaluate(() => customElements.whenDefined('sl-details'));
  await documentsLoaded(page);
  return { frame, requests };
}

// Appends markup to the example document (replacing earlier mounts) and waits for every sl-details in it to render.
async function mount(frame, markup) {
  await frame.locator('body').evaluate(async (body, markup) => {
    document.getElementById('mount')?.remove();
    const host = document.createElement('div');
    host.id = 'mount';
    host.innerHTML = markup;
    body.append(host);
    await Promise.all([...host.querySelectorAll('sl-details')].map(el => el.updateComplete));
  }, markup);
}

// Records the sl-* events of #d in its own `events` array; `cancel` lists the events to cancel.
const recordEvents = (frame, cancel = []) => frame.locator('#d').evaluate((el, cancel) => {
  const events = (el.events = []);
  for (const type of ['sl-show', 'sl-after-show', 'sl-hide', 'sl-after-hide']) {
    el.addEventListener(type, e => {
      events.push({ type, bubbles: e.bubbles, composed: e.composed, cancelable: e.cancelable, target: e.target === el });
      if (cancel.includes(type)) e.preventDefault();
    });
  }
}, cancel);
const eventTypes = frame => frame.locator('#d').evaluate(el => el.events.map(e => e.type));
const header = frame => frame.locator('#d').locator('.details__header');

// The computed values of a probe element styled with the given declarations (written with the theme tokens).
async function probe(frame, declarations, properties) {
  return frame.locator('body').evaluate((body, { declarations, properties }) => {
    const p = document.createElement('div');
    p.style.cssText = declarations;
    body.append(p);
    const cs = getComputedStyle(p);
    const out = Object.fromEntries(properties.map(name => [name, cs.getPropertyValue(name)]));
    p.remove();
    return out;
  }, { declarations, properties });
}

test('docs page is prerendered with Velcro branding, prototype status, every Shoelace section, the quirks and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Details - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('without changing the shared core prefix');
  expect(html).toContain('@charm-ux/velcro/utilities/animation-registry');
  for (const [title] of EXAMPLES) expect(html).toContain(`title="Details example: ${title}"`);
  // The sections are all there, in Shoelace's order (before the API tables), each with its intro text.
  const examplesPart = html.slice(html.indexOf('id="examples"'), html.indexOf('id="attributes"'));
  expect([...examplesPart.matchAll(/<h3 id="([^"]+)"><!--lit-part-->([^<]+)<!--\/lit-part--><\/h3>/g)].map(m => m[1]))
    .toEqual(['overview', 'disabled', 'custom-icons', 'grouping']);
  expect(examplesPart).toContain('Use the <code>disabled</code> attribute to prevent the details from expanding.');
  expect(examplesPart).toContain('Use the <code>expand-icon</code> and <code>collapse-icon</code> slots');
  expect(examplesPart).toContain('simulate a group or "accordion" where only one is shown at a time');
  expect(html).toContain('Details show a brief summary and expand to show additional content.');
  // Three React versions, as in Shoelace's page; the wrapper is imported under Shoelace's name.
  expect(html.match(/<summary>React<\/summary>/g)).toHaveLength(REACT_EXAMPLES.length);
  expect(html).toContain('import { VelcroDetails as SlDetails } from &#39;@charm-ux/velcro/react/VelcroDetails.js&#39;;');
  // The API tables: Shoelace's members, plus the core ready event labelled as inherited.
  expect(html).toContain('Inherited from @charm-ux/core CharmElement');
  for (const name of ['open', 'summary', 'disabled', 'show', 'hide', 'sl-show', 'sl-after-show', 'sl-hide', 'sl-after-hide',
    'expand-icon', 'collapse-icon', 'base', 'header', 'summary-icon', 'content']) {
    expect(html).toContain(`data-name="${name}"`);
  }
  expect(html).toContain('data-name="ready"');
  // The quirks and limits the page lists are the ones the tests below pin.
  expect(html).toContain('The hidden attribute does not hide the details');
  expect(html).toContain('never settles');
  expect(html).toContain('interrupts a hide animation');
  expect(html).toContain('The document&#39;s direction is a snapshot, not a live read');
  expect(html).toContain('it throws on import when another constructor already owns sl-icon');
  expect(html).not.toContain('accessibility-tree check is Playwright');
  expect(html).toContain('expandIconSlot');
  expect(html).toContain('Shoelace&#39;s own details tests (11, including two axe accessibility checks');
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
  const home = await (await request.get('/')).text();
  expect(home).toContain('/components/details');
});

test('sl-details registers inside the example document as the exported class, with sl-icon, no core marker and no ch-* definitions', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  const info = await frame.locator('body').evaluate(() => {
    const ctor = customElements.get('sl-details');
    const el = document.querySelector('sl-details');
    return {
      baseName: ctor?.baseName,
      coreTags: ['ch-details', 'ch-accordion-item'].map(t => customElements.get(t) !== undefined),
      viaConstructor: ctor ? new ctor().localName : null,
      instance: el instanceof ctor,
      icon: customElements.get('sl-icon')?.baseName,
      attrs: el.getAttributeNames().sort(),
    };
  });
  expect(info).toEqual({ baseName: 'details', coreTags: [false, false], viaConstructor: 'sl-details', instance: true, icon: 'icon', attrs: ['id', 'summary'] });
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
});

test('closed: a native details around a summary header and a body region, with Shoelace\'s parts, classes and ARIA', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-details id="d" summary="Toggle Me">Content</sl-details>');
  const r = await frame.locator('#d').evaluate(el => {
    const root = el.shadowRoot;
    const attrs = node => Object.fromEntries(node.getAttributeNames().filter(n => n !== 'class' && n !== 'style').map(n => [n, node.getAttribute(n)]));
    const classes = node => [...node.classList].sort();
    const base = root.querySelector('[part="base"]');
    const head = root.querySelector('[part="header"]');
    const summarySlot = root.querySelector('slot[name="summary"]');
    const iconPart = root.querySelector('[part="summary-icon"]');
    const body = root.querySelector('.details__body');
    const content = root.querySelector('[part="content"]');
    return {
      children: [...root.children].filter(n => n.localName !== 'style').map(n => n.localName),
      base: [base.localName, classes(base), base.open],
      baseChildren: [...base.children].map(n => n.localName),
      head: [head.localName, classes(head), attrs(head)],
      headChildren: [...head.children].map(n => `${n.localName}:${n.getAttribute('part')}`),
      summarySlot: [classes(summarySlot), summarySlot.textContent],
      iconPart: [iconPart.localName, classes(iconPart), [...iconPart.children].map(n => `${n.localName}[${n.getAttribute('name')}]`)],
      icons: [...iconPart.querySelectorAll('sl-icon')].map(i => [i.getAttribute('library'), i.getAttribute('name')]),
      body: [body.localName, classes(body), attrs(body), body.style.height],
      content: [content.localName, content.id, classes(content), content.getAttribute('name')],
      members: [el.details === base, el.header === head, el.body === body, el.expandIconSlot],
      observer: el.detailsObserver instanceof MutationObserver,
      light: el.textContent,
    };
  });
  expect(r).toEqual({
    children: ['details'],
    base: ['details', ['details'], false],
    baseChildren: ['summary', 'div'],
    head: ['summary', ['details__header'], {
      part: 'header', id: 'header', role: 'button', 'aria-expanded': 'false', 'aria-controls': 'content', 'aria-disabled': 'false', tabindex: '0',
    }],
    headChildren: ['slot:summary', 'span:summary-icon'],
    summarySlot: [['details__summary'], 'Toggle Me'],
    iconPart: ['span', ['details__summary-icon'], ['slot[expand-icon]', 'slot[collapse-icon]']],
    icons: [['system', 'chevron-right'], ['system', 'chevron-right']],
    body: ['div', ['details__body'], { role: 'region', 'aria-labelledby': 'header' }, '0px'],
    content: ['slot', 'content', ['details__content'], null],
    // Upstream quirk: the expandIconSlot query matches a class the template does not have.
    members: [true, true, true, null],
    observer: true,
    light: 'Content',
  });
  await expect(header(frame)).toHaveRole('button');
  await expect(header(frame)).toHaveAccessibleName('Toggle Me');
});

test('open: the summary, icon, body and native element follow the open state; the content is visible', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-details id="d" summary="Toggle Me" open><p id="inner">Content</p></sl-details>');
  const r = await frame.locator('#d').evaluate(el => {
    const root = el.shadowRoot;
    return {
      base: [root.querySelector('.details').open, [...root.querySelector('.details').classList].sort()],
      expanded: root.querySelector('.details__header').getAttribute('aria-expanded'),
      height: root.querySelector('.details__body').style.height,
      visible: el.querySelector('#inner').getBoundingClientRect().height > 0,
    };
  });
  expect(r).toEqual({ base: [true, ['details', 'details--open']], expanded: 'true', height: 'auto', visible: true });
});

test('a closed details shows only its header: the body is 0 high, opens to the content\'s height with a click and closes again', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-details id="d" summary="Toggle Me"><div style="height: 200px"></div></sl-details>');
  const heights = () => frame.locator('#d').evaluate(el => [getComputedStyle(el.body).height, Math.round(el.getBoundingClientRect().height)]);
  const [bodyClosed, hostClosed] = await heights();
  expect(bodyClosed).toBe('0px');
  await header(frame).click();
  await expect.poll(() => frame.locator('#d').evaluate(e => e.open && e.body.style.height === 'auto')).toBe(true);
  const [, hostOpen] = await heights();
  // 200 + the content's 16px padding top and bottom.
  expect(hostOpen - hostClosed).toBe(232);
  await header(frame).click();
  await expect.poll(() => frame.locator('#d').evaluate(e => !e.open && !e.details.open)).toBe(true);
  expect((await heights())[1]).toBe(hostClosed);
});

test('computed styles match Shoelace: block host, token border, radius, background, header flex and padding, content padding, icon rotation', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-details id="d" summary="Toggle Me">Content</sl-details>');
  const read = () => frame.locator('#d').evaluate(el => {
    const q = s => getComputedStyle(el.shadowRoot.querySelector(s));
    const base = q('.details');
    const head = q('.details__header');
    const content = q('.details__content');
    const icon = q('.details__summary-icon');
    return {
      host: [getComputedStyle(el).display, getComputedStyle(el).boxSizing],
      base: [base.borderTopStyle, base.borderTopWidth, base.borderTopColor, base.borderTopLeftRadius, base.backgroundColor, base.opacity],
      head: [head.display, head.alignItems, head.cursor, head.paddingTop, head.paddingRight, head.paddingBottom, head.paddingLeft],
      summary: [q('.details__summary').display, q('.details__summary').flexGrow, q('.details__summary').alignItems],
      icon: [icon.display, icon.alignItems, icon.flexGrow, icon.flexShrink, icon.transitionProperty, icon.transitionDuration, icon.rotate],
      content: [content.display, content.paddingTop, content.paddingRight, content.paddingBottom, content.paddingLeft],
      bodyOverflow: q('.details__body').overflowY,
    };
  });
  const tokens = await probe(frame,
    'border: solid 1px var(--sl-color-neutral-200); border-radius: var(--sl-border-radius-medium); background-color: var(--sl-color-neutral-0); padding: var(--sl-spacing-medium); transition: var(--sl-transition-medium) rotate ease;',
    ['border-top-color', 'border-top-left-radius', 'background-color', 'padding-top', 'transition-duration']);
  const r = await read();
  expect(r).toEqual({
    host: ['block', 'border-box'],
    base: ['solid', '1px', tokens['border-top-color'], tokens['border-top-left-radius'], tokens['background-color'], '1'],
    head: ['flex', 'center', 'pointer', tokens['padding-top'], tokens['padding-top'], tokens['padding-top'], tokens['padding-top']],
    summary: ['flex', '1', 'center'],
    icon: ['flex', 'center', '0', '0', 'rotate', tokens['transition-duration'], 'none'],
    content: ['block', tokens['padding-top'], tokens['padding-top'], tokens['padding-top'], tokens['padding-top']],
    bodyOverflow: 'hidden',
  });
  expect(tokens['padding-top']).toBe('16px');
  // Open: the icon turns a quarter turn (once its transition has run), and the slots swap.
  await frame.locator('#d').evaluate(el => el.show());
  const turned = await probe(frame, 'rotate: 90deg', ['rotate']);
  await expect.poll(() => frame.locator('#d').evaluate(el => getComputedStyle(el.shadowRoot.querySelector('.details__summary-icon')).rotate)).toBe(turned.rotate);
});

test('the expand icon shows while closed and the collapse icon while open', async ({ page }) => {
  const { frame } = await openExample(page, 'Customizing the Summary Icon');
  const el = frame.locator('.custom-icons');
  const slots = () => el.evaluate(e => ['expand-icon', 'collapse-icon'].map(n => getComputedStyle(e.shadowRoot.querySelector(`slot[name="${n}"]`)).display));
  expect(await slots()).toEqual(['contents', 'none']);
  await el.evaluate(e => e.show());
  expect(await slots()).toEqual(['none', 'contents']);
  // The slotted icons are the example's own sl-icons, and the part's rotate is overridden to none by the page.
  expect(await el.evaluate(e => [...e.querySelectorAll('[slot]')].map(i => [i.localName, i.slot, i.getAttribute('name')])))
    .toEqual([['sl-icon', 'expand-icon', 'plus-square'], ['sl-icon', 'collapse-icon', 'dash-square']]);
  expect(await el.evaluate(e => getComputedStyle(e.shadowRoot.querySelector('[part="summary-icon"]')).rotate)).toBe('none');
});

test('a click toggles: sl-show then sl-after-show, sl-hide then sl-after-hide, bubbling and composed, cancelable only for the first of each', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-details id="d" summary="Toggle Me">Content</sl-details>');
  await recordEvents(frame);
  await header(frame).click();
  await expect.poll(() => eventTypes(frame)).toEqual(['sl-show', 'sl-after-show']);
  expect(await frame.locator('#d').evaluate(el => [el.open, el.getAttribute('open'), el.shadowRoot.querySelector('.details__header').getAttribute('aria-expanded'),
    el.shadowRoot.activeElement === el.header])).toEqual([true, '', 'true', true]);
  await header(frame).click();
  await expect.poll(() => eventTypes(frame)).toEqual(['sl-show', 'sl-after-show', 'sl-hide', 'sl-after-hide']);
  expect(await frame.locator('#d').evaluate(el => [el.open, el.hasAttribute('open'), el.details.open, el.header.getAttribute('aria-expanded')])).toEqual([false, false, false, 'false']);
  expect(await frame.locator('#d').evaluate(el => el.events)).toEqual([
    { type: 'sl-show', bubbles: true, composed: true, cancelable: true, target: true },
    { type: 'sl-after-show', bubbles: true, composed: true, cancelable: false, target: true },
    { type: 'sl-hide', bubbles: true, composed: true, cancelable: true, target: true },
    { type: 'sl-after-hide', bubbles: true, composed: true, cancelable: false, target: true },
  ]);
});

test('setting open from script emits the same events as the summary; a details rendered open emits none (quirk)', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-details id="d" summary="Toggle Me">Content</sl-details>');
  await recordEvents(frame);
  await frame.locator('#d').evaluate(el => { el.open = true; });
  await expect.poll(() => eventTypes(frame)).toEqual(['sl-show', 'sl-after-show']);
  await frame.locator('#d').evaluate(el => { el.removeAttribute('open'); });
  await expect.poll(() => eventTypes(frame)).toEqual(['sl-show', 'sl-after-show', 'sl-hide', 'sl-after-hide']);
  const initial = await frame.locator('body').evaluate(async body => {
    const el = document.createElement('sl-details');
    const seen = [];
    for (const type of ['sl-show', 'sl-after-show', 'sl-hide', 'sl-after-hide']) el.addEventListener(type, () => seen.push(type));
    el.summary = 'Open';
    el.open = true;
    el.textContent = 'Content';
    body.append(el);
    await el.updateComplete;
    await new Promise(resolve => setTimeout(resolve, 400));
    const result = { seen, open: el.open, height: el.body.style.height, native: el.details.open };
    el.remove();
    return result;
  });
  expect(initial).toEqual({ seen: [], open: true, height: 'auto', native: true });
});

test('show() and hide() resolve after the after-events and resolve to undefined at once when already in that state or disabled', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-details id="d" summary="Toggle Me">Content</sl-details>');
  const r = await frame.locator('#d').evaluate(async el => {
    const seen = [];
    el.addEventListener('sl-after-show', () => seen.push('after-show'));
    el.addEventListener('sl-after-hide', () => seen.push('after-hide'));
    const hideClosed = await el.hide();
    const shown = el.show();
    const again = el.show();
    const value = await shown;
    seen.push('show resolved');
    const againValue = await again;
    await el.hide();
    seen.push('hide resolved');
    el.disabled = true;
    return { seen, hideClosed, value, againValue, disabledShow: await el.show(), disabledOpen: el.open };
  });
  expect(r).toEqual({ seen: ['after-show', 'show resolved', 'after-hide', 'hide resolved'], hideClosed: undefined, value: undefined, againValue: undefined,
    disabledShow: undefined, disabledOpen: false });
});

test('canceling sl-show or sl-hide keeps the state, emits no after event and the show() or hide() promise never settles (quirk)', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-details id="d" summary="Toggle Me">Content</sl-details>');
  await recordEvents(frame, ['sl-show']);
  await header(frame).click();
  await expect.poll(() => eventTypes(frame)).toEqual(['sl-show']);
  const pending = (id, call) => frame.locator(id).evaluate(async (el, call) => {
    const outcome = await Promise.race([el[call]().then(() => 'settled'), new Promise(resolve => setTimeout(() => resolve('pending'), 700))]);
    return [outcome, el.open, el.details.open, el.events.map(e => e.type)];
  }, call);
  expect(await pending('#d', 'show')).toEqual(['pending', false, false, ['sl-show', 'sl-show']]);
  // Canceling sl-hide on an open details.
  await mount(frame, '<sl-details id="d" summary="Toggle Me" open>Content</sl-details>');
  await recordEvents(frame, ['sl-hide']);
  await header(frame).click();
  await expect.poll(() => eventTypes(frame)).toEqual(['sl-hide']);
  expect(await pending('#d', 'hide')).toEqual(['pending', true, true, ['sl-hide', 'sl-hide']]);
  expect(await frame.locator('#d').evaluate(el => el.shadowRoot.querySelector('.details__header').getAttribute('aria-expanded'))).toBe('true');
});

test('keyboard: Enter and Space toggle on key down; ArrowDown and ArrowRight open; ArrowUp and ArrowLeft close', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-details id="d" summary="Toggle Me">Content</sl-details>');
  const open = () => frame.locator('#d').evaluate(el => el.open);
  // Brings the details to the wanted state and waits until no toggle is in flight (the native element follows the animation).
  const settle = want => frame.locator('#d').evaluate(async (el, want) => {
    if (el.open !== want) await (want ? el.show() : el.hide());
    while (el.open ? el.body.style.height !== 'auto' : el.details.open) await new Promise(resolve => setTimeout(resolve, 20));
  }, want);
  await header(frame).focus();
  await page.keyboard.press('Enter');
  await expect.poll(open).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(open).toBe(false);
  // Space acts on key down; the key up is not asserted, because engines differ in what the native summary does with it.
  await settle(false);
  await page.keyboard.down(' ');
  await expect.poll(open).toBe(true);
  await page.keyboard.up(' ');
  for (const [key, from, expected] of [['ArrowDown', false, true], ['ArrowRight', false, true], ['ArrowUp', true, false], ['ArrowLeft', true, false]]) {
    await settle(from);
    await header(frame).focus();
    await page.keyboard.press(key);
    await expect.poll(open, key).toBe(expected);
  }
  // An arrow key that does not change the state leaves it as it is, and so does any other key.
  await settle(false);
  await header(frame).focus();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('a');
  expect(await open()).toBe(false);
  expect(await frame.locator('#d').evaluate(el => el.getBoundingClientRect().height < 100)).toBe(true);
});

test('disabled: the summary is aria-disabled and out of the tab order, clicks and keys do nothing, the methods return at once; open can still be set (quirk)', async ({ page }) => {
  const { frame } = await openExample(page, 'Disabled');
  const el = frame.locator('sl-details');
  const state = () => el.evaluate(e => {
    const head = e.shadowRoot.querySelector('.details__header');
    return [e.open, e.disabled, e.hasAttribute('disabled'), head.getAttribute('aria-disabled'), head.getAttribute('tabindex'),
      [...e.shadowRoot.querySelector('.details').classList].sort()];
  });
  expect(await state()).toEqual([false, true, true, 'true', '-1', ['details', 'details--disabled']]);
  expect(await el.evaluate(e => {
    const cs = getComputedStyle(e.shadowRoot.querySelector('.details'));
    return [cs.opacity, getComputedStyle(e.shadowRoot.querySelector('.details__header')).cursor];
  })).toEqual(['0.5', 'not-allowed']);
  await el.evaluate(e => { e.events = []; for (const t of ['sl-show', 'sl-hide']) e.addEventListener(t, () => e.events.push(t)); });
  // Playwright refuses to click an aria-disabled element unless forced.
  await el.locator('.details__header').click({ force: true });
  await el.evaluate(e => e.header.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })));
  await el.evaluate(e => e.header.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })));
  expect(await el.evaluate(e => [e.open, e.events])).toEqual([false, []]);
  expect(await el.evaluate(async e => [await e.show(), await e.hide()])).toEqual([undefined, undefined]);
  // The property is not guarded: it opens the details, with its events.
  await el.evaluate(e => { e.open = true; });
  await expect.poll(() => el.evaluate(e => [e.open, e.events, e.body.style.height])).toEqual([true, ['sl-show'], 'auto']);
  expect(await state()).toEqual([true, true, true, 'true', '-1', ['details', 'details--disabled', 'details--open']]);
});

test('properties: defaults, reflection, null restores the initial value, summary is not reflected', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-details id="d" summary="Summary">Content</sl-details>');
  const r = await frame.locator('#d').evaluate(async el => {
    const defaults = [el.open, el.disabled, el.summary, el.dir, el.lang];
    el.open = true;
    el.disabled = true;
    el.summary = 'Changed';
    await el.updateComplete;
    const reflected = [el.getAttribute('open'), el.getAttribute('disabled'), el.getAttribute('summary'), el.shadowRoot.querySelector('slot[name="summary"]').textContent];
    el.disabled = null;
    el.open = null;
    await el.updateComplete;
    const restored = [el.open, el.disabled, el.hasAttribute('open'), el.hasAttribute('disabled')];
    el.setAttribute('open', '');
    el.setAttribute('disabled', '');
    await el.updateComplete;
    el.removeAttribute('disabled');
    el.removeAttribute('open');
    await el.updateComplete;
    return { defaults, reflected, restored, removed: [el.open, el.disabled] };
  });
  expect(r).toEqual({
    defaults: [false, false, 'Summary', undefined, undefined],
    // The summary attribute is the property's own attribute, not a reflection: setting the property leaves it as written.
    reflected: ['', '', 'Summary', 'Changed'],
    restored: [false, false, false, false],
    removed: [false, false],
  });
});

test('dir and lang are reactive, not reflected and undefined by default, as Shoelace\'s base element declares them', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-details id="d" summary="Toggle Me">Content</sl-details><sl-details id="e" summary="Toggle Me" dir="rtl" lang="ar">Content</sl-details>');
  const r = await frame.locator('#d').evaluate(async el => {
    const other = document.getElementById('e');
    const initial = [el.dir, el.lang, other.dir, other.lang];
    el.dir = 'rtl';
    el.lang = 'fr';
    await el.updateComplete;
    const afterSet = [el.dir, el.lang, el.hasAttribute('dir'), el.hasAttribute('lang'), el.shadowRoot.querySelector('.details').classList.contains('details--rtl')];
    el.dir = 'anything';
    await el.updateComplete;
    const anything = [el.dir, el.shadowRoot.querySelector('.details').classList.contains('details--rtl')];
    return { initial, afterSet, anything, observed: customElements.get('sl-details').observedAttributes.filter(n => n === 'dir' || n === 'lang').sort() };
  });
  expect(r).toEqual({ initial: [undefined, undefined, 'rtl', 'ar'], afterSet: ['rtl', 'fr', false, false, true], anything: ['anything', false], observed: ['dir', 'lang'] });
});

test('right to left: the default icons are chevron-left and the arrow keys keep their direction (quirk)', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-details id="d" summary="Toggle Me" dir="rtl">Content</sl-details>');
  const r = await frame.locator('#d').evaluate(el => ({
    icons: [...el.shadowRoot.querySelectorAll('sl-icon')].map(i => i.getAttribute('name')),
    cls: el.shadowRoot.querySelector('.details').classList.contains('details--rtl'),
  }));
  expect(r).toEqual({ icons: ['chevron-left', 'chevron-left'], cls: true });
  await frame.locator('#d').evaluate(el => el.show());
  await header(frame).focus();
  await page.keyboard.press('ArrowLeft');
  // The native element closes when the hide animation ends; pressing before that would interrupt it (see the quirk test below).
  await expect.poll(() => frame.locator('#d').evaluate(el => el.open || el.details.open)).toBe(false);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => frame.locator('#d').evaluate(el => el.open)).toBe(true);
  const turned = await probe(frame, 'rotate: -90deg', ['rotate']);
  await expect.poll(() => frame.locator('#d').evaluate(el => getComputedStyle(el.shadowRoot.querySelector('.details__summary-icon')).rotate)).toBe(turned.rotate);
});

test('slots: the summary slot replaces the summary attribute text; the default slot is the content', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-details id="d" summary="Attribute"><b slot="summary">Slotted</b><i id="body">Body</i></sl-details>');
  const r = await frame.locator('#d').evaluate(el => {
    const slot = el.shadowRoot.querySelector('slot[name="summary"]');
    return {
      assigned: slot.assignedNodes().map(n => n.textContent),
      content: [...el.shadowRoot.querySelector('[part="content"]').assignedElements()].map(n => n.id),
    };
  });
  expect(r).toEqual({ assigned: ['Slotted'], content: ['body'] });
  await expect(header(frame)).toHaveAccessibleName('Slotted');
});

test('upstream quirks matched: hidden does not hide it, expandIconSlot is always null, a reconnected details no longer follows its inner element', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-details id="d" summary="Toggle Me" hidden>Content</sl-details><sl-details id="f" summary="Other">Content</sl-details>');
  expect(await frame.locator('#d').evaluate(el => [getComputedStyle(el).display, el.getBoundingClientRect().height > 0, el.expandIconSlot])).toEqual(['block', true, null]);
  // The observer opens the details when the inner <details> element opens natively (find in page, for example) ...
  await frame.locator('#f').evaluate(el => { el.details.open = true; });
  await expect.poll(() => frame.locator('#f').evaluate(el => el.open)).toBe(true);
  // ... but not after the element has been removed and added back.
  await frame.locator('#d').evaluate(async el => {
    const parent = el.parentElement;
    el.remove();
    parent.append(el);
    await el.updateComplete;
    el.details.open = true;
  });
  await frame.locator('body').evaluate(() => new Promise(resolve => setTimeout(resolve, 200)));
  expect(await frame.locator('#d').evaluate(el => [el.open, el.details.open])).toEqual([false, true]);
});

test('a show that interrupts a hide animation ends closed (quirk); a hide that interrupts a show closes as asked', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-details id="d" summary="Toggle Me" open>Content</sl-details><sl-details id="e" summary="Other">Content</sl-details>');
  const r = await frame.locator('body').evaluate(async () => {
    const settle = () => new Promise(resolve => setTimeout(resolve, 700));
    const d = document.getElementById('d');
    d.open = false;
    await d.updateComplete;
    d.open = true;
    await d.updateComplete;
    await settle();
    const e = document.getElementById('e');
    e.open = true;
    await e.updateComplete;
    e.open = false;
    await e.updateComplete;
    await settle();
    return { reopened: [d.open, d.details.open], reclosed: [e.open, e.details.open] };
  });
  expect(r).toEqual({ reopened: [false, false], reclosed: [false, false] });
});

// Shoelace's click handler calls header.focus() after toggling. Whether a script's header.click() then leaves the header
// focused is the browser's decision: it does in Chromium and WebKit; in Firefox it did not in CI, so the call itself is what
// is asserted everywhere and the resulting focus only where it holds.
test('clicking the summary calls header.focus(), even for a script click', async ({ page, browserName }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-details id="d" summary="A">Content</sl-details>');
  expect(await frame.locator('#d').evaluate(el => document.activeElement === el)).toBe(false);
  const calls = await frame.locator('#d').evaluate(el => {
    let count = 0;
    const focus = el.header.focus;
    el.header.focus = function (...args) {
      count++;
      return focus.apply(this, args);
    };
    el.header.click();
    return count;
  });
  expect(calls).toBe(1);
  if (browserName !== 'firefox') {
    expect(await frame.locator('#d').evaluate(el => el.shadowRoot.activeElement === el.header)).toBe(true);
    expect(await frame.locator('#d').evaluate(el => document.activeElement === el)).toBe(true);
  }
});

test('a script click on a disabled details does not call header.focus() or take focus', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-details id="e" summary="B" disabled>Content</sl-details>');
  const calls = await frame.locator('#e').evaluate(el => {
    let count = 0;
    const focus = el.header.focus;
    el.header.focus = function (...args) {
      count++;
      return focus.apply(this, args);
    };
    el.header.click();
    return count;
  });
  expect(calls).toBe(0);
  expect(await frame.locator('#e').evaluate(el => el.shadowRoot.activeElement === el.header)).toBe(false);
  expect(await frame.locator('#e').evaluate(el => document.activeElement === el)).toBe(false);
});

test('inherited core ready event: dispatched once on the element after the first update, not bubbling or composed', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('body').evaluate(async body => {
    const el = document.createElement('sl-details');
    const seen = [];
    let bubbled = 0;
    el.addEventListener('ready', event => seen.push({ bubbles: event.bubbles, composed: event.composed }));
    body.addEventListener('ready', () => bubbled++);
    body.append(el);
    await el.updateComplete;
    el.summary = 'x';
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
      details: "export { SlDetails } from '@charm-ux/velcro/details';",
    });
  });

  // Loads the entries and records every Element.animate() call on a details' body in window.calls.
  async function setup(page) {
    await gotoBlank(page, outDir);
    await page.evaluate(async () => {
      window.registry = await import('/registry.js');
      await import('/details.js');
      window.calls = [];
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (keyframes, options) {
        if (this.classList.contains('details__body')) window.calls.push({ keyframes: JSON.parse(JSON.stringify(keyframes)), duration: options.duration, easing: options.easing });
        return animate.call(this, keyframes, options);
      };
      document.body.innerHTML = '<sl-details id="a" summary="A">Content A</sl-details><sl-details id="b" summary="B">Content B</sl-details>';
      await Promise.all([...document.querySelectorAll('sl-details')].map(el => el.updateComplete));
      window.cycle = async id => {
        const el = document.getElementById(id);
        window.calls = [];
        await el.show();
        await el.hide();
        return window.calls;
      };
    });
  }

  test('the details uses Shoelace\'s defaults, with height auto resolved to pixels; setDefaultAnimation changes them for every details', async ({ page }) => {
    await setup(page);
    const calls = await page.evaluate(() => window.cycle('a'));
    expect(calls).toHaveLength(2);
    const px = /^\d+(\.\d+)?px$/;
    expect(calls[0].keyframes.map(k => [k.height === '0' || k.height === '0px' ? '0' : px.test(k.height) ? 'px' : k.height, k.opacity])).toEqual([['0', '0'], ['px', '1']]);
    expect(calls[1].keyframes.map(k => [k.height === '0' || k.height === '0px' ? '0' : px.test(k.height) ? 'px' : k.height, k.opacity])).toEqual([['px', '1'], ['0', '0']]);
    expect([calls[0].duration, calls[0].easing, calls[1].duration, calls[1].easing]).toEqual([250, 'linear', 250, 'linear']);
    const r = await page.evaluate(async () => {
      window.registry.setDefaultAnimation('details.show', { keyframes: [{ opacity: 0.25 }, { opacity: 1 }], options: { duration: 20, easing: 'ease-in' } });
      return [await window.cycle('a'), await window.cycle('b')];
    });
    for (const c of r) {
      expect(c[0]).toEqual({ keyframes: [{ opacity: 0.25 }, { opacity: 1 }], duration: 20, easing: 'ease-in' });
      expect(c[1].duration).toBe(250);
    }
  });

  test('an element\'s own animation beats the default, only for that element; null is an empty animation', async ({ page }) => {
    await setup(page);
    const r = await page.evaluate(async () => {
      const { setAnimation } = window.registry;
      setAnimation(document.getElementById('a'), 'details.show', { keyframes: [{ opacity: 0.5 }, { opacity: 1 }], options: { duration: 30 } });
      setAnimation(document.getElementById('a'), 'details.hide', null);
      return { a: await window.cycle('a'), b: await window.cycle('b') };
    });
    expect(r.a[0]).toEqual({ keyframes: [{ opacity: 0.5 }, { opacity: 1 }], duration: 30 });
    expect(r.a[1]).toEqual({ keyframes: [], duration: 0 });
    expect(r.b.map(c => c.duration)).toEqual([250, 250]);
  });

  test('the direction picks rtlKeyframes: the details\' own dir (attribute or property) beats the document, an empty one defers to it, lower-cased', async ({ page }) => {
    await setup(page);
    const r = await page.evaluate(async () => {
      const task = () => new Promise(resolve => setTimeout(resolve));
      window.registry.setDefaultAnimation('details.show', { keyframes: [{ opacity: 0.1 }, { opacity: 1 }], rtlKeyframes: [{ opacity: 0.2 }, { opacity: 1 }], options: { duration: 5 } });
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
      // The property beats the document; an empty property defers to it. The observer needs a task to record the document.
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

  test('the document direction is the localization snapshot, as in Shoelace: a change in the same task as show() is not seen until the observer runs', async ({ page }) => {
    await setup(page);
    const r = await page.evaluate(async () => {
      const task = () => new Promise(resolve => setTimeout(resolve));
      const { setDefaultAnimation } = window.registry;
      setDefaultAnimation('details.show', { keyframes: [{ opacity: 0.1 }, { opacity: 1 }], rtlKeyframes: [{ opacity: 0.2 }, { opacity: 1 }], options: { duration: 5 } });
      setDefaultAnimation('details.hide', { keyframes: [{ opacity: 1 }, { opacity: 0.3 }], rtlKeyframes: [{ opacity: 1 }, { opacity: 0.4 }], options: { duration: 5 } });
      document.documentElement.dir = 'ltr';
      await task();
      const el = document.getElementById('a');
      // Queued in sl-show, this runs before show()'s continuation reads the direction; the document observer's callback,
      // which refreshes the snapshot, is queued behind that continuation.
      el.addEventListener('sl-show', () => queueMicrotask(() => { document.documentElement.dir = 'rtl'; }), { once: true });
      window.calls = [];
      await el.show();
      const shown = window.calls.map(c => c.keyframes.map(k => k.opacity));
      window.calls = [];
      await el.hide();
      const hidden = window.calls.map(c => c.keyframes.map(k => k.opacity));
      document.documentElement.dir = 'ltr';
      await task();
      return { shown, hidden };
    });
    // Shown with the stale ltr snapshot; hidden after the observer refreshed it to rtl.
    expect(r).toEqual({ shown: [[0.1, 1]], hidden: [[1, 0.4]] });
  });

  test('the render follows the same snapshot: the chevrons and class change when the observer has run, not in the same task', async ({ page }) => {
    await setup(page);
    const r = await page.evaluate(async () => {
      const task = () => new Promise(resolve => setTimeout(resolve));
      const el = document.getElementById('a');
      const view = () => ({
        icons: [...el.shadowRoot.querySelectorAll('sl-icon')].map(i => i.getAttribute('name')),
        rtl: el.shadowRoot.querySelector('.details').classList.contains('details--rtl'),
      });
      document.documentElement.dir = 'ltr';
      await task();
      // The update is queued first; the observer's notification is queued by the mutation after it, so the render that
      // the property change causes still sees the ltr snapshot.
      el.summary = 'Changed';
      document.documentElement.dir = 'rtl';
      await el.updateComplete;
      const sameTask = view();
      await task();
      await el.updateComplete;
      const afterObserver = view();
      document.documentElement.dir = 'ltr';
      await task();
      return { sameTask, afterObserver };
    });
    expect(r).toEqual({
      sameTask: { icons: ['chevron-right', 'chevron-right'], rtl: false },
      afterObserver: { icons: ['chevron-left', 'chevron-left'], rtl: true },
    });
  });
});

test.describe('class-only entry', () => {
  let bundle;

  test.beforeAll(async () => {
    const fromDocs = createRequire(path.join(docsDir, 'package.json'));
    const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
    const dir = mkdtempSync(path.join(tmpdir(), 'velcro-details-class-'));
    try {
      const entry = path.join(dir, 'entry.js');
      writeFileSync(entry, `
        import { SlDetails, VelcroDetails } from '@charm-ux/velcro/details/class';
        window.detailsClass = { SlDetails, VelcroDetails };
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

  test('importing defines nothing; constructing a details defines Velcro\'s sl-icon, so the default icons render', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.setContent('<!DOCTYPE html><html><body></body></html>');
    await page.addScriptTag({ type: 'module', content: bundle });
    await page.waitForFunction(() => Boolean(window.detailsClass));
    const r = await page.evaluate(async () => {
      const { SlDetails, VelcroDetails } = window.detailsClass;
      const tags = () => ['sl-details', 'sl-icon'].map(t => customElements.get(t)?.name ?? null);
      const afterImport = tags();
      customElements.define('sl-details', SlDetails);
      const el = document.createElement('sl-details');
      el.summary = 'Toggle Me';
      document.body.append(el);
      await el.updateComplete;
      await el.show();
      return { same: SlDetails === VelcroDetails, afterImport, afterConstruct: tags(), open: el.open, icons: el.shadowRoot.querySelectorAll('sl-icon').length };
    });
    expect(r).toEqual({ same: true, afterImport: [null, null], afterConstruct: ['VelcroDetails', 'VelcroIcon'], open: true, icons: 2 });
    expect(pageErrors).toEqual([]);
  });

  test('another constructor that owns sl-icon is left in place', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.setContent('<!DOCTYPE html><html><body></body></html>');
    await page.addScriptTag({ type: 'module', content: bundle });
    await page.waitForFunction(() => Boolean(window.detailsClass));
    const r = await page.evaluate(async () => {
      class Foreign extends HTMLElement {}
      customElements.define('sl-icon', Foreign);
      const { SlDetails } = window.detailsClass;
      customElements.define('sl-details', SlDetails);
      const el = document.createElement('sl-details');
      document.body.append(el);
      await el.updateComplete;
      return { owner: customElements.get('sl-icon') === Foreign, rendered: el.shadowRoot.querySelector('sl-icon') instanceof Foreign };
    });
    expect(r).toEqual({ owner: true, rendered: true });
    expect(pageErrors).toEqual([]);
  });
});

test('every docs example renders in its own document', async ({ page }) => {
  await openDocs(page, PAGE);
  const titles = await page.locator('iframe.example').evaluateAll(frames => frames.map(f => f.title));
  expect(titles).toEqual(EXAMPLES.map(([t]) => `Details example: ${t}`));
  for (const title of titles) {
    const frame = page.frameLocator(`iframe.example[title="${title}"]`);
    await expect(frame.locator('sl-details').first()).toBeAttached();
    expect(await frame.locator('sl-details').first().evaluate(async el => {
      await customElements.whenDefined('sl-details');
      await el.updateComplete;
      return Boolean(el.shadowRoot?.querySelector('[part="base"]'));
    })).toBe(true);
  }
});

test('Grouping Details example: opening one closes the others', async ({ page }) => {
  const { frame } = await openExample(page, 'Grouping Details');
  const states = () => frame.locator('sl-details').evaluateAll(list => list.map(el => el.open));
  expect(await states()).toEqual([true, false, false]);
  await frame.locator('sl-details').nth(1).locator('.details__header').click();
  await expect.poll(states).toEqual([false, true, false]);
  await frame.locator('sl-details').nth(2).locator('.details__header').click();
  await expect.poll(states).toEqual([false, false, true]);
  // The group example's own rules: a small gap between all but the last.
  const gap = (await probe(frame, 'margin-bottom: var(--sl-spacing-2x-small)', ['margin-bottom']))['margin-bottom'];
  expect(gap).not.toBe('0px');
  expect(await frame.locator('sl-details').evaluateAll(list => list.map(el => getComputedStyle(el).marginBottom))).toEqual([gap, gap, '0px']);
});

test('no upstream Shoelace runtime is requested or defined; all requests stay on the local origin', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  expect(await frame.locator('body').evaluate(() => Boolean(window.Shoelace || document.querySelector('script[src*="shoelace"]')))).toBe(false);
});

// The values that matter in a rendered example, which an HTML example and its React version must share. Opens the details
// that can open and reports the icon's rotation once its transition has run.
const summarize = async () => {
  const out = [];
  for (const el of document.querySelectorAll('sl-details')) {
    await el.updateComplete;
    const entry = {
      summary: el.summary, disabled: el.disabled, open: el.open, text: el.textContent.replace(/\s+/g, ' ').trim(),
      icons: [...el.querySelectorAll('[slot$="-icon"]')].map(i => `${i.localName}:${i.slot}:${i.getAttribute('name')}`),
    };
    await el.show();
    await new Promise(resolve => setTimeout(resolve, 450));
    entry.openedByShow = el.open;
    entry.rotate = getComputedStyle(el.shadowRoot.querySelector('[part="summary-icon"]')).rotate;
    out.push(entry);
  }
  return out;
};

// Shoelace's React examples, ported in packages/docs/examples/details/react/*.jsx (the files the docs page shows), bundled
// with React 19 and the generated wrappers, which are resolved through the package's real export map.
test.describe('React examples', () => {
  const reactDir = fileURLToPath(new URL('../../packages/docs/examples/details/react/', import.meta.url));
  let bundle;

  test.beforeAll(async () => {
    const fromVelcro = createRequire(path.join(velcroDir, 'package.json'));
    const fromDocs = createRequire(path.join(docsDir, 'package.json'));
    const pkgDir = name => path.dirname(fromVelcro.resolve(`${name}/package.json`));
    const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
    const dir = mkdtempSync(path.join(tmpdir(), 'velcro-details-react-'));
    try {
      for (const [, name] of REACT_EXAMPLES) {
        writeFileSync(path.join(dir, `${name}.jsx`), `${readFileSync(path.join(reactDir, `${name}.jsx`), 'utf8')}\nexport default App;\n`);
      }
      const entry = path.join(dir, 'entry.js');
      writeFileSync(entry, `
        import React from 'react';
        import { createRoot } from 'react-dom/client';
        import { VelcroDetails } from '@charm-ux/velcro/react/VelcroDetails.js';
        ${REACT_EXAMPLES.map(([, name], i) => `import App${i} from './${name}.jsx';`).join('\n')}
        const apps = { ${REACT_EXAMPLES.map(([, name], i) => `${JSON.stringify(name)}: App${i}`).join(', ')} };
        window.errors = [];
        addEventListener('error', e => window.errors.push(String(e.message)));
        addEventListener('unhandledrejection', e => window.errors.push(String(e.reason)));
        window.reactVersion = React.version;
        window.wrapper = VelcroDetails;
        window.renderExample = name => {
          const host = document.createElement('div');
          document.body.append(host);
          createRoot(host).render(React.createElement(apps[name]));
        };
        window.renderEvents = () => {
          const host = document.createElement('div');
          document.body.append(host);
          window.reactEvents = [];
          const log = type => event => window.reactEvents.push([type, event.target.open]);
          createRoot(host).render(React.createElement(VelcroDetails, { summary: 'Events', onSlShow: log('show'), onSlAfterShow: log('after-show'),
            onSlHide: log('hide'), onSlAfterHide: log('after-hide') }, 'Content'));
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

  test('every React example renders the same details as the HTML example it belongs to', async ({ page }) => {
    test.setTimeout(150_000);
    const htmlPage = await page.context().newPage();
    watchNetwork(htmlPage);
    const expected = {};
    try {
      await openDocs(htmlPage, PAGE);
      await documentsLoaded(htmlPage);
      for (const [title, name] of REACT_EXAMPLES) {
        const frame = frameFor(htmlPage, title);
        await expect(frame.locator('sl-details').first()).toBeAttached();
        await frame.locator('body').evaluate(() => customElements.whenDefined('sl-details'));
        expected[name] = await frame.locator('body').evaluate(summarize);
      }
    } finally {
      await htmlPage.close();
    }
    const pageErrors = await load(page);
    expect(await page.evaluate(() => window.reactVersion)).toBe('19.2.0');
    for (const [, name] of REACT_EXAMPLES) {
      await page.evaluate(n => { document.body.replaceChildren(); window.renderExample(n); }, name);
      await page.waitForFunction(() => document.querySelector('sl-details'));
      const actual = await page.evaluate(summarize);
      expect(actual.length, name).toBeGreaterThan(0);
      expect(actual, name).toEqual(expected[name]);
    }
    expect(await page.evaluate(() => window.errors)).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('the wrapper passes the properties and takes onSlShow, onSlAfterShow, onSlHide and onSlAfterHide', async ({ page }) => {
    const pageErrors = await load(page);
    await page.evaluate(() => window.renderEvents());
    const el = page.locator('sl-details');
    await expect(el).toBeAttached();
    await page.evaluate(() => customElements.whenDefined('sl-details'));
    await el.locator('.details__header').click();
    await expect.poll(() => page.evaluate(() => window.reactEvents.map(e => e[0]))).toEqual(['show', 'after-show']);
    await el.locator('.details__header').click();
    await expect.poll(() => page.evaluate(() => window.reactEvents.map(e => e[0]))).toEqual(['show', 'after-show', 'hide', 'after-hide']);
    expect(await page.evaluate(() => window.reactEvents.map(e => e[1]))).toEqual([true, true, false, false]);
    expect(await el.evaluate(e => e.summary)).toBe('Events');
    expect(await page.evaluate(() => window.errors)).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
