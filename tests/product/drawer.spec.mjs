// sl-drawer product checks against Shoelace 2.20.1's drawer contract: the docs page and its examples, the element's
// structure, styles, behavior and events on a blank page, and its React wrapper. The internal focus-trap and scroll-lock
// modules it shares with the dialog are checked in dialog.spec.mjs.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { pressReceived, recordKeys } from './support/keys.mjs';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';
import { buildFixtures, gotoBlank } from './support/fixtures.mjs';
import { reactWrapperPage } from './support/react.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/drawer';
const docsDir = fileURLToPath(new URL('../../packages/docs/', import.meta.url));
const velcroDir = fileURLToPath(new URL('../../packages/velcro/', import.meta.url));
const theme = readFileSync(path.join(velcroDir, 'themes/light.css'), 'utf8');

// The docs page's examples, in Shoelace's order: the example's title and the name of its files under examples/drawer/.
// Every one has a React version in Shoelace's page.
const EXAMPLES = [
  ['Overview', 'overview'],
  ['Slide in From Start', 'placement-start'],
  ['Slide in From Top', 'placement-top'],
  ['Slide in From Bottom', 'placement-bottom'],
  ['Contained to an Element', 'contained'],
  ['Custom Size', 'custom-size'],
  ['Scrolling', 'scrolling'],
  ['Header Actions', 'header-actions'],
  ['Preventing the Drawer from Closing', 'deny-close'],
  ['Customizing Initial Focus', 'focus'],
];

const frameFor = (page, title) => page.frameLocator(`iframe.example[title="Drawer example: ${title}"]`);

async function openExample(page, name = 'Overview') {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  const frame = frameFor(page, name);
  await expect(frame.locator('sl-drawer').first()).toBeAttached();
  await frame.locator('body').evaluate(() => customElements.whenDefined('sl-drawer'));
  await documentsLoaded(page);
  return { frame, requests };
}

// The element on a blank, full-size page with the light theme: the registering entries of the drawer and the dialog (to
// check that they share one focus-trap stack) and the animation registry, built from the package.
let outDir;
test.beforeAll(async () => {
  outDir = await buildFixtures({
    drawer: "export * from '@charm-ux/velcro/drawer';",
    dialog: "export * from '@charm-ux/velcro/dialog';",
    registry: "export * from '@charm-ux/velcro/utilities/animation-registry';",
  });
});

async function blank(page, markup = '') {
  await gotoBlank(page, outDir);
  await page.addStyleTag({ content: theme });
  await page.evaluate(async markup => {
    document.documentElement.className = 'sl-theme-light';
    window.registry = await import('/registry.js');
    await import('/drawer.js');
    document.body.innerHTML = markup;
    await Promise.all([...document.querySelectorAll('sl-drawer')].map(el => el.updateComplete));
  }, markup);
}

// Records the sl-* events of #d in window.events; `cancel` lists the events to cancel.
const recordEvents = (page, cancel = []) => page.evaluate(cancel => {
  const el = document.getElementById('d');
  window.events = [];
  for (const type of ['sl-show', 'sl-after-show', 'sl-hide', 'sl-after-hide', 'sl-initial-focus', 'sl-request-close']) {
    el.addEventListener(type, e => {
      window.events.push({ type, bubbles: e.bubbles, composed: e.composed, cancelable: e.cancelable, detail: JSON.stringify(e.detail) });
      if (cancel.includes(type)) e.preventDefault();
    });
  }
}, cancel);
// sl-initial-focus is emitted in the animation frame after the show starts and sl-after-show when the 250 ms show
// animation ends; on a loaded machine the frame can come later than the animation, so the two may arrive in either order
// (in Shoelace too). The checks put sl-initial-focus right after the sl-show that precedes it.
const showOrder = (list, initial = 'sl-initial-focus', show = 'sl-show', key = e => (typeof e === 'string' ? e : e.type)) => {
  const out = list.filter(e => key(e) !== initial);
  for (const e of list.filter(e => key(e) === initial)) out.splice(out.findIndex(x => key(x) === show) + 1, 0, e);
  return out;
};
const eventTypes = page => page.evaluate(() => window.events.map(e => e.type)).then(showOrder);
const isOpen = page => page.evaluate(() => document.getElementById('d').open);
const panel = page => page.locator('#d .drawer__panel');
// The number of animations running on the panel (the show, hide and deny-close animations play there).
const panelAnimations = page => page.evaluate(() => document.getElementById('d').shadowRoot.querySelector('.drawer__panel').getAnimations().length);
const settled = page => page.evaluate(() => new Promise(resolve => setTimeout(resolve, 400)));
const keyboardRequests = page => page.evaluate(() => window.events.filter(e => e.type === 'sl-request-close' && JSON.parse(e.detail).source === 'keyboard').length);
// The deepest focused element's id, part or tag.
const deepActive = page => page.evaluate(() => {
  let el = document.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  return el.id || el.getAttribute('part') || el.localName;
});

test('docs page is prerendered with Velcro branding, prototype status, every Shoelace section, the quirks and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Drawer - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('without changing the shared core prefix');
  expect(html).toContain('@charm-ux/velcro/utilities/animation-registry');
  for (const [title] of EXAMPLES) expect(html).toContain(`title="Drawer example: ${title}"`);
  // Fixed-height preview frames: room for the open drawer, and no resize loop on the Scrolling example's 150vh content.
  expect(html.match(/<iframe class="example" style="min-height: 24rem; max-height: 24rem"/g)).toHaveLength(EXAMPLES.length);
  const examplesPart = html.slice(html.indexOf('id="examples"'), html.indexOf('id="attributes"'));
  expect([...examplesPart.matchAll(/<h3 id="([^"]+)"><!--lit-part-->([^<]+)<!--\/lit-part--><\/h3>/g)].map(m => m[1])).toEqual([
    'overview', 'slide-in-from-start', 'slide-in-from-top', 'slide-in-from-bottom', 'contained-to-an-element', 'custom-size',
    'scrolling', 'header-actions', 'preventing-the-drawer-from-closing', 'customizing-initial-focus',
  ]);
  expect(examplesPart).toContain('By default, drawers slide in from the end.');
  expect(examplesPart).toContain('Unlike normal drawers, contained drawers are not modal.');
  expect(examplesPart).toContain('Use the <code>--size</code> custom property to set the drawer');
  expect(examplesPart).toContain('drawers will not scroll with the page');
  expect(examplesPart).toContain('You can use <code>event.detail.source</code> to determine what triggered the request to close.');
  expect(examplesPart).toContain('add the <code>autofocus</code> attribute to it as shown below.');
  expect(html).toContain('canceling the <code>sl-initial-focus</code> event and setting focus yourself');
  expect(html).toContain('Drawers slide in from a container to expose additional options and information.');
  expect(html.match(/<summary>React<\/summary>/g)).toHaveLength(EXAMPLES.length);
  expect(html).toContain('import { VelcroDrawer as SlDrawer } from &#39;@charm-ux/velcro/react/VelcroDrawer.js&#39;;');
  expect(html).toContain('Inherited from @charm-ux/core CharmElement');
  for (const name of ['open', 'label', 'placement', 'contained', 'noHeader', 'modal', 'show', 'hide', 'sl-show', 'sl-after-show',
    'sl-hide', 'sl-after-hide', 'sl-initial-focus', 'sl-request-close', 'header-actions', 'footer', 'base', 'overlay', 'panel',
    'header', 'title', 'close-button', 'close-button__base', 'body', '--size', '--header-spacing', '--body-spacing', '--footer-spacing']) {
    expect(html, name).toContain(`data-name="${name}"`);
  }
  expect(html).toContain('data-name="ready"');
  // The quirks and limits the page lists are the ones the tests below pin.
  expect(html).toContain('A drawer rendered with open already set is shown at once');
  expect(html).toContain('a watcher that is spent by the first Escape');
  expect(html).toContain('Changing contained while the drawer is open moves the focus trap and the body scroll lock, but not the Escape handling');
  expect(html).toContain('panel keeps aria-modal=&quot;true&quot;');
  expect(html).toContain('The hidden attribute does not hide the drawer');
  expect(html).toContain('Removing an open drawer from the document releases its body scroll lock and its Escape handling, but not its focus trap');
  expect(html).toContain('a single zero-width no-break space (U+FEFF)');
  expect(html).toContain('The focus trap counts an &lt;a&gt; without href as tabbable');
  expect(html).toContain('passes a no-modal prop');
  expect(html).toContain('Observed, not compared');
  expect(html).toContain('Core has no drawer');
  expect(html).toContain('Shoelace&#39;s own drawer tests (9;');
  expect(html).toContain('there is no axe check');
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
  const home = await (await request.get('/')).text();
  expect(home).toContain('/components/drawer');
});

test('sl-drawer registers inside the example document as the exported class, with sl-icon-button and sl-icon, and no ch-* definitions', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  const info = await frame.locator('body').evaluate(() => {
    const ctor = customElements.get('sl-drawer');
    const el = document.querySelector('sl-drawer');
    return {
      baseName: ctor?.baseName,
      coreTags: ['ch-drawer', 'ch-push-pane'].map(t => customElements.get(t) !== undefined),
      viaConstructor: ctor ? new ctor().localName : null,
      instance: el instanceof ctor,
      deps: [customElements.get('sl-icon-button')?.baseName, customElements.get('sl-icon')?.baseName],
      attrs: el.getAttributeNames().sort(),
      delegatesFocus: el.shadowRoot.delegatesFocus,
    };
  });
  expect(info).toEqual({ baseName: 'drawer', coreTags: [false, false], viaConstructor: 'sl-drawer', instance: true, deps: ['icon-button', 'icon'], attrs: ['class', 'label', 'placement'], delegatesFocus: false });
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
});

test('closed: Shoelace\'s structure, parts, classes and ARIA; the base is hidden', async ({ page }) => {
  await blank(page, '<sl-drawer id="d" label="Title">Content<button slot="footer">Ok</button></sl-drawer>');
  const r = await page.evaluate(() => {
    const el = document.getElementById('d');
    const root = el.shadowRoot;
    const attrs = node => Object.fromEntries(node.getAttributeNames().filter(n => n !== 'class' && n !== 'style').map(n => [n, node.getAttribute(n)]));
    const classes = node => [...node.classList].sort();
    const base = root.querySelector('[part="base"]');
    const close = root.querySelector('[part="close-button"]');
    return {
      children: [...root.children].filter(n => n.localName !== 'style').map(n => n.localName),
      base: [base.localName, classes(base), base.hidden],
      baseChildren: [...base.children].map(n => `${n.localName}:${n.getAttribute('part')}`),
      overlay: attrs(root.querySelector('[part="overlay"]')),
      panel: attrs(root.querySelector('[part="panel"]')),
      panelChildren: [...root.querySelector('[part="panel"]').children].map(n => `${n.localName}:${n.getAttribute('part')}`),
      header: [...root.querySelector('[part="header"]').children].map(n => `${n.localName}:${n.getAttribute('part')}`),
      title: [attrs(root.querySelector('[part="title"]')), root.querySelector('slot[name="label"]').textContent],
      actions: [...root.querySelector('[part="header-actions"]').children].map(n => n.localName === 'slot' ? `slot:${n.name}` : n.localName),
      close: [attrs(close), classes(close)],
      body: [root.querySelector('[part="body"]').localName, attrs(root.querySelector('[part="body"]')), classes(root.querySelector('[part="body"]'))],
      footer: [root.querySelector('[part="footer"]').localName, root.querySelector('[part="footer"] > slot[name="footer"]') !== null],
      members: [el.drawer === base, el.panel === root.querySelector('.drawer__panel'), el.overlay === root.querySelector('.drawer__overlay')],
      modal: [typeof el.modal.activate, typeof el.modal.activateExternal, typeof el.modal.deactivateExternal, el.modal.isActive()],
    };
  });
  expect(r).toEqual({
    children: ['div'],
    base: ['div', ['drawer', 'drawer--end', 'drawer--fixed', 'drawer--has-footer'], true],
    baseChildren: ['div:overlay', 'div:panel'],
    overlay: { part: 'overlay', tabindex: '-1' },
    panel: { part: 'panel', role: 'dialog', 'aria-modal': 'true', 'aria-hidden': 'true', 'aria-labelledby': 'title', tabindex: '0' },
    panelChildren: ['header:header', 'slot:body', 'footer:footer'],
    header: ['h2:title', 'div:header-actions'],
    title: [{ part: 'title', id: 'title' }, ' Title '],
    actions: ['slot:header-actions', 'sl-icon-button'],
    close: [{ part: 'close-button', exportparts: 'base:close-button__base', name: 'x-lg', label: 'Close', library: 'system' }, ['drawer__close']],
    body: ['slot', { part: 'body' }, ['drawer__body']],
    footer: ['footer', true],
    members: [true, true, true],
    modal: ['function', 'function', 'function', false],
  });
  await expect(page.locator('#d .drawer')).toBeHidden();
});

test('show(): sl-show, sl-initial-focus, sl-after-show; the panel takes focus, is labelled and visible, and the page is scroll-locked', async ({ page }) => {
  await blank(page, '<button id="trigger">Open</button><sl-drawer id="d" label="Title">Content</sl-drawer>');
  await recordEvents(page);
  await page.locator('#trigger').focus();
  const resolved = await page.evaluate(() => document.getElementById('d').show());
  expect(resolved).toBeUndefined();
  await expect.poll(() => page.evaluate(() => window.events.length)).toBe(3);
  const events = showOrder(await page.evaluate(() => window.events));
  expect(events).toEqual([
    { type: 'sl-show', bubbles: true, composed: true, cancelable: false, detail: '{}' },
    { type: 'sl-initial-focus', bubbles: true, composed: true, cancelable: true, detail: '{}' },
    { type: 'sl-after-show', bubbles: true, composed: true, cancelable: false, detail: '{}' },
  ]);
  await expect(panel(page)).toBeVisible();
  await expect(panel(page)).toHaveRole('dialog');
  await expect(panel(page)).toHaveAccessibleName('Title');
  await expect(page.locator('#d [part="close-button"]').getByRole('button')).toHaveAccessibleName('Close');
  const r = await page.evaluate(() => {
    const el = document.getElementById('d');
    return {
      open: [el.open, el.hasAttribute('open'), el.modal.isActive()],
      classes: [...el.shadowRoot.querySelector('.drawer').classList].sort(),
      ariaHidden: el.shadowRoot.querySelector('.drawer__panel').getAttribute('aria-hidden'),
      focus: [document.activeElement === el, el.shadowRoot.activeElement?.className],
      lock: [document.documentElement.classList.contains('sl-scroll-lock'), getComputedStyle(document.body).overflow],
    };
  });
  expect(r).toEqual({ open: [true, true, true], classes: ['drawer', 'drawer--end', 'drawer--fixed', 'drawer--open'], ariaHidden: 'false', focus: [true, 'drawer__panel'], lock: [true, 'hidden'] });
  // A second show() resolves at once.
  expect(await page.evaluate(() => document.getElementById('d').show())).toBeUndefined();
  // hide(): sl-hide then sl-after-hide; the lock and the trap are released when the hide starts, and focus returns to
  // the trigger.
  const atHide = await page.evaluate(() => {
    window.events = [];
    const el = document.getElementById('d');
    el.addEventListener('sl-hide', () => queueMicrotask(() => { window.atHide = [document.documentElement.classList.contains('sl-scroll-lock'), el.modal.isActive()]; }), { once: true });
    return el.hide().then(() => window.atHide);
  });
  expect(atHide).toEqual([false, false]);
  expect(await eventTypes(page)).toEqual(['sl-hide', 'sl-after-hide']);
  await expect(page.locator('#trigger')).toBeFocused();
  expect(await page.evaluate(() => [document.documentElement.classList.contains('sl-scroll-lock'), document.getElementById('d').drawer.hidden, document.getElementById('d').modal.isActive()])).toEqual([false, true, false]);
  expect(await page.evaluate(() => document.getElementById('d').hide())).toBeUndefined();
});

test('setting open from script emits the same events; hide() and open = false are not cancelable', async ({ page }) => {
  await blank(page, '<sl-drawer id="d" label="Title">Content</sl-drawer>');
  await recordEvents(page, ['sl-hide', 'sl-show']);
  await page.evaluate(() => { document.getElementById('d').open = true; });
  await expect.poll(() => eventTypes(page)).toEqual(['sl-show', 'sl-initial-focus', 'sl-after-show']);
  await page.evaluate(() => { window.events = []; document.getElementById('d').open = false; });
  await expect.poll(() => eventTypes(page)).toEqual(['sl-hide', 'sl-after-hide']);
  expect(await isOpen(page)).toBe(false);
});

test('the close button, Escape and the overlay emit sl-request-close with their source and close the drawer', async ({ page }) => {
  await blank(page, '<sl-drawer id="d" label="Title">Content</sl-drawer>');
  await recordEvents(page);
  const requests = () => page.evaluate(() => window.events.filter(e => e.type === 'sl-request-close').map(e => [JSON.parse(e.detail).source, e.cancelable, e.bubbles, e.composed]));
  for (const [source, act] of [
    ['close-button', () => page.locator('#d [part="close-button"]').click()],
    ['keyboard', () => page.keyboard.press('Escape')],
    ['overlay', () => page.mouse.click(5, 5)],
  ]) {
    await page.evaluate(() => { window.events = []; return document.getElementById('d').show(); });
    await act();
    await expect.poll(() => eventTypes(page), source).toEqual(['sl-show', 'sl-initial-focus', 'sl-after-show', 'sl-request-close', 'sl-hide', 'sl-after-hide']);
    expect(await requests()).toEqual([[source, true, true, true]]);
    expect(await isOpen(page)).toBe(false);
  }
});

test('canceling sl-request-close keeps the drawer open and plays the deny-close animation on the panel', async ({ page }) => {
  await blank(page, '<sl-drawer id="d" label="Title">Content</sl-drawer>');
  await recordEvents(page, ['sl-request-close']);
  await page.evaluate(() => document.getElementById('d').show());
  await page.evaluate(() => {
    window.calls = [];
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      window.calls.push({ part: this.getAttribute('part'), keyframes: JSON.parse(JSON.stringify(keyframes)), duration: options.duration });
      return animate.call(this, keyframes, options);
    };
  });
  // The second Escape requests nothing where the browser has CloseWatcher (see the quirk below), so only one is pressed.
  for (const [i, act] of [() => page.locator('#d [part="close-button"]').click(), () => page.keyboard.press('Escape'), () => page.mouse.click(5, 5)].entries()) {
    await act();
    // Each canceled request plays the deny-close animation; the next one waits until it has ended.
    await expect.poll(async () => [await page.evaluate(() => window.calls.length), await panelAnimations(page)]).toEqual([i + 1, 0]);
  }
  expect(await isOpen(page)).toBe(true);
  expect(await page.evaluate(() => window.events.filter(e => e.type === 'sl-request-close').map(e => JSON.parse(e.detail).source))).toEqual(['close-button', 'keyboard', 'overlay']);
  expect(await page.evaluate(() => window.calls)).toEqual(Array(3).fill({ part: 'panel', keyframes: [{ scale: 1 }, { scale: 1.01 }, { scale: 1 }], duration: 250 }));
  await expect(panel(page)).toBeVisible();
});

test('focus is trapped: Tab and Shift+Tab cycle through the drawer\'s tabbable elements, including the panel and the close button', async ({ page }) => {
  await blank(page, '<button id="outside">Outside</button><sl-drawer id="d" label="Title"><button id="a">A</button><button id="b">B</button><button id="c" slot="footer">C</button></sl-drawer>');
  await page.evaluate(() => document.getElementById('d').show());
  await expect.poll(() => deepActive(page)).toBe('panel');
  for (const expected of ['base', 'a', 'b', 'c', 'panel', 'base']) {
    await page.keyboard.press('Tab');
    await expect.poll(() => deepActive(page)).toBe(expected);
  }
  await page.keyboard.press('Shift+Tab');
  await expect.poll(() => deepActive(page)).toBe('panel');
  // Focusing an element outside the drawer moves focus back in.
  await page.evaluate(() => document.getElementById('outside').focus());
  await expect.poll(() => deepActive(page)).not.toBe('outside');
});

test('autofocus: the autofocus element takes focus instead of the panel; canceling sl-initial-focus leaves focus alone', async ({ page }) => {
  await blank(page, '<sl-drawer id="d" label="Title"><input id="i" autofocus></sl-drawer><sl-drawer id="e" label="Other"><input id="j"></sl-drawer>');
  await page.evaluate(() => document.getElementById('d').show());
  await expect(page.locator('#i')).toBeFocused();
  expect(await page.locator('#i').getAttribute('autofocus')).toBe('');
  await page.evaluate(() => document.getElementById('d').hide());
  await page.evaluate(() => {
    const e = document.getElementById('e');
    e.addEventListener('sl-initial-focus', event => { event.preventDefault(); document.getElementById('j').focus(); });
    return e.show();
  });
  await expect(page.locator('#j')).toBeFocused();
});

test('computed styles match Shoelace\'s rules with the theme tokens; --size sets the panel\'s width or height', async ({ page }) => {
  await blank(page, '<sl-drawer id="d" label="Title" open>Content<button slot="footer">Ok</button></sl-drawer><div id="probe"></div>');
  const r = await page.evaluate(() => {
    const el = document.getElementById('d');
    const root = el.shadowRoot;
    const probe = document.getElementById('probe');
    const token = (prop, value) => { probe.style.setProperty(prop, value); const v = getComputedStyle(probe).getPropertyValue(prop); probe.style.removeProperty(prop); return v; };
    const cs = sel => getComputedStyle(root.querySelector(sel));
    const base = cs('.drawer');
    const overlay = cs('.drawer__overlay');
    const panelStyle = cs('.drawer__panel');
    return {
      host: getComputedStyle(el).display,
      base: [base.position, base.zIndex, base.top, base.left, base.width, base.height, base.pointerEvents, base.overflow],
      viewport: [`${innerWidth}px`, `${innerHeight}px`],
      expectedZ: token('z-index', 'var(--sl-z-index-drawer)'),
      overlay: [overlay.display, overlay.position, overlay.backgroundColor, overlay.pointerEvents],
      expectedOverlay: token('background-color', 'var(--sl-overlay-background-color)'),
      panel: [panelStyle.position, panelStyle.display, panelStyle.flexDirection, panelStyle.zIndex, panelStyle.width, panelStyle.backgroundColor, panelStyle.boxShadow, panelStyle.overflow, panelStyle.pointerEvents],
      expectedPanel: [token('width', '25rem'), token('background-color', 'var(--sl-panel-background-color)'), token('box-shadow', 'var(--sl-shadow-x-large)')],
      title: [cs('.drawer__title').fontSize, cs('.drawer__title').paddingTop],
      expectedTitle: [token('font-size', 'var(--sl-font-size-large)'), token('padding-top', 'var(--sl-spacing-large)')],
      body: [cs('.drawer__body').display, cs('.drawer__body').paddingTop, cs('.drawer__body').overflowY],
      footer: [cs('.drawer__footer').textAlign, cs('.drawer__footer').paddingTop],
    };
  });
  expect(r.host).toBe('contents');
  expect(r.base).toEqual(['fixed', r.expectedZ, '0px', '0px', ...r.viewport, 'none', 'hidden']);
  expect(r.overlay).toEqual(['block', 'fixed', r.expectedOverlay, 'all']);
  expect(r.panel).toEqual(['absolute', 'flex', 'column', '2', r.expectedPanel[0], r.expectedPanel[1], r.expectedPanel[2], 'auto', 'all']);
  expect(r.title).toEqual(r.expectedTitle);
  expect(r.body).toEqual(['block', r.expectedTitle[1], 'auto']);
  expect(r.footer).toEqual(['right', r.expectedTitle[1]]);
});

test('placement: the panel sits along the named edge, sized by --size across it and filling the edge; start and end follow the direction', async ({ page }) => {
  await blank(page, '<sl-drawer id="d" label="Title" open>Content</sl-drawer>');
  const boxes = await page.evaluate(async () => {
    const el = document.getElementById('d');
    el.style.setProperty('--size', '200px');
    const out = {};
    for (const dir of ['ltr', 'rtl']) {
      document.documentElement.dir = dir;
      for (const placement of ['top', 'end', 'bottom', 'start']) {
        el.placement = placement;
        await el.updateComplete;
        const b = el.panel.getBoundingClientRect();
        out[`${dir} ${placement}`] = [b.left, b.top, b.width, b.height].map(Math.round);
      }
    }
    document.documentElement.dir = '';
    return { out, w: innerWidth, h: innerHeight };
  });
  const { w, h } = boxes;
  expect(boxes.out).toEqual({
    'ltr top': [0, 0, w, 200], 'ltr end': [w - 200, 0, 200, h], 'ltr bottom': [0, h - 200, w, 200], 'ltr start': [0, 0, 200, h],
    'rtl top': [0, 0, w, 200], 'rtl end': [0, 0, 200, h], 'rtl bottom': [0, h - 200, w, 200], 'rtl start': [w - 200, 0, 200, h],
  });
  expect(await page.evaluate(() => [...document.getElementById('d').drawer.classList].filter(c => /--(top|end|bottom|start)$/.test(c)))).toEqual(['drawer--start']);
});

test('each placement plays its own show and hide animation; dir="rtl" picks the mirrored keyframes and adds drawer--rtl', async ({ page }) => {
  await blank(page, '<sl-drawer id="d" label="Title">Content</sl-drawer>');
  const r = await page.evaluate(async () => {
    const el = document.getElementById('d');
    const calls = [];
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      if (this.getAttribute('part') === 'panel') calls.push(keyframes.map(k => k.translate).join(' > '));
      return animate.call(this, keyframes, options);
    };
    for (const placement of ['top', 'end', 'bottom', 'start']) {
      el.placement = placement;
      await el.show();
      await el.hide();
    }
    el.dir = 'rtl';
    await el.updateComplete;
    const rtlClass = el.drawer.classList.contains('drawer--rtl');
    for (const placement of ['end', 'start']) {
      el.placement = placement;
      await el.show();
      await el.hide();
    }
    Element.prototype.animate = animate;
    return { calls, rtlClass };
  });
  expect(r).toEqual({
    calls: [
      '0 -100% > 0 0', '0 0 > 0 -100%', '100% > 0', '0 > 100%', '0 100% > 0 0', '0 0 > 0 100%', '-100% > 0', '0 > -100%',
      '-100% > 0', '0 > -100%', '100% > 0', '0 > 100%',
    ],
    rtlClass: true,
  });
});

test('contained: absolute in its positioned parent, no overlay, no focus trap, no scroll lock and no Escape; the close button still closes it', async ({ page }) => {
  await blank(page, '<button id="outside">Outside</button><div id="box" style="position: relative; width: 400px; height: 300px; margin: 50px"><sl-drawer id="d" label="Title" contained style="--size: 50%">Content</sl-drawer></div>');
  await recordEvents(page);
  await page.evaluate(() => document.getElementById('d').show());
  const r = await page.evaluate(() => {
    const el = document.getElementById('d');
    const b = el.panel.getBoundingClientRect();
    const box = document.getElementById('box').getBoundingClientRect();
    const base = getComputedStyle(el.drawer);
    return {
      classes: [...el.drawer.classList].sort(),
      base: [base.position, base.zIndex],
      overlay: getComputedStyle(el.overlay).display,
      panel: [b.left - box.left, b.top - box.top, b.width, b.height].map(Math.round),
      // Upstream quirk: the panel still says it is modal.
      ariaModal: el.panel.getAttribute('aria-modal'),
      state: [el.modal.isActive(), document.documentElement.classList.contains('sl-scroll-lock')],
    };
  });
  expect(r).toEqual({ classes: ['drawer', 'drawer--contained', 'drawer--end', 'drawer--open'], base: ['absolute', 'auto'], overlay: 'none', panel: [200, 0, 200, 300], ariaModal: 'true', state: [false, false] });
  // Focus is not trapped: the outside button keeps focus.
  await page.locator('#outside').focus();
  await settled(page);
  await expect(page.locator('#outside')).toBeFocused();
  await recordKeys(page);
  await pressReceived(page, page, 'Escape');
  await settled(page);
  expect(await isOpen(page)).toBe(true);
  expect(await page.evaluate(() => window.events.filter(e => e.type === 'sl-request-close').length)).toBe(0);
  await page.locator('#d [part="close-button"]').click();
  await expect.poll(() => isOpen(page)).toBe(false);
});

test('changing contained while open moves the focus trap and the scroll lock', async ({ page }) => {
  await blank(page, '<sl-drawer id="d" label="Title" contained>Content</sl-drawer>');
  const r = await page.evaluate(async () => {
    const el = document.getElementById('d');
    const state = () => [el.modal.isActive(), document.documentElement.classList.contains('sl-scroll-lock')];
    await el.show();
    const contained = state();
    el.contained = false;
    await el.updateComplete;
    const uncontained = state();
    el.contained = true;
    await el.updateComplete;
    return { contained, uncontained, again: state() };
  });
  expect(r).toEqual({ contained: [false, false], uncontained: [true, true], again: [false, false] });
});

test('no-header: no header or close button; the panel is labelled by aria-label', async ({ page }) => {
  await blank(page, '<sl-drawer id="d" label="Hidden title" no-header>Content</sl-drawer>');
  await page.evaluate(() => document.getElementById('d').show());
  const r = await page.evaluate(() => {
    const p = document.getElementById('d').shadowRoot.querySelector('.drawer__panel');
    return [p.querySelector('[part="header"]'), p.getAttribute('aria-label'), p.hasAttribute('aria-labelledby')];
  });
  expect(r).toEqual([null, 'Hidden title', false]);
  await expect(panel(page)).toHaveAccessibleName('Hidden title');
  await page.keyboard.press('Escape');
  await expect.poll(() => isOpen(page)).toBe(false);
});

test('slots: label replaces the label attribute; header-actions sit before the close button; footer adds the has-footer class', async ({ page }) => {
  await blank(page, '<sl-drawer id="d" label="Attr"><span slot="label" id="l">Slotted</span><button slot="header-actions" id="h">H</button>Content</sl-drawer>');
  await page.evaluate(() => document.getElementById('d').show());
  await expect(panel(page)).toHaveAccessibleName('Slotted');
  const r = await page.evaluate(async () => {
    const el = document.getElementById('d');
    const root = el.shadowRoot;
    const before = root.querySelector('.drawer').classList.contains('drawer--has-footer');
    const footer = document.createElement('button');
    footer.slot = 'footer';
    el.append(footer);
    await new Promise(resolve => setTimeout(resolve));
    await el.updateComplete;
    return {
      label: root.querySelector('slot[name="label"]').assignedElements().map(n => n.id),
      actions: root.querySelector('slot[name="header-actions"]').assignedElements().map(n => n.id),
      body: root.querySelector('slot[part="body"]').assignedNodes().map(n => n.textContent),
      hasFooter: [before, root.querySelector('.drawer').classList.contains('drawer--has-footer')],
    };
  });
  expect(r).toEqual({ label: ['l'], actions: ['h'], body: ['Content'], hasFooter: [false, true] });
});

test('properties: defaults, reflection, a removed reflected attribute restores the initial value', async ({ page }) => {
  await blank(page, '<sl-drawer id="d">Content</sl-drawer>');
  const r = await page.evaluate(async () => {
    const el = document.getElementById('d');
    const defaults = [el.open, el.label, el.placement, el.contained, el.noHeader, el.dir, el.lang];
    const attrs = el.getAttributeNames().sort();
    el.label = 'L';
    el.placement = 'top';
    el.contained = true;
    el.noHeader = true;
    await el.updateComplete;
    const reflected = [el.getAttribute('label'), el.getAttribute('placement'), el.getAttribute('contained'), el.getAttribute('no-header')];
    for (const name of ['label', 'placement', 'contained', 'no-header']) el.removeAttribute(name);
    await el.updateComplete;
    return { defaults, attrs, reflected, removed: [el.label, el.placement, el.contained, el.noHeader] };
  });
  expect(r).toEqual({
    defaults: [false, '', 'end', false, false, undefined, undefined],
    attrs: ['id', 'label', 'placement'],
    reflected: ['L', 'top', '', ''],
    removed: ['', 'end', false, false],
  });
});

test('the body scroll lock and the focus-trap stack are shared with the dialog: the newest open one owns the trap', async ({ page }) => {
  await blank(page, '<sl-drawer id="d" label="One">One</sl-drawer><sl-drawer id="e" label="Two">Two</sl-drawer><sl-dialog id="g" label="Three">Three</sl-dialog>');
  const r = await page.evaluate(async () => {
    await import('/dialog.js');
    const [d, e, g] = ['d', 'e', 'g'].map(id => document.getElementById(id));
    const lock = () => document.documentElement.classList.contains('sl-scroll-lock');
    await d.show();
    await e.show();
    await g.show();
    const all = [lock(), d.modal.isActive(), e.modal.isActive(), g.modal.isActive()];
    await g.hide();
    await e.hide();
    const one = [lock(), d.modal.isActive()];
    await d.hide();
    return { all, one, none: lock() };
  });
  expect(r).toEqual({ all: [true, false, false, true], one: [true, true], none: false });
});

test('upstream quirk: a drawer rendered open emits no show events, plays no animation, does not move focus or record a trigger, but traps focus and locks scrolling', async ({ page }) => {
  await gotoBlank(page, outDir);
  await page.addStyleTag({ content: theme });
  const r = await page.evaluate(async () => {
    await import('/drawer.js');
    const events = [];
    for (const type of ['sl-show', 'sl-after-show', 'sl-initial-focus']) document.addEventListener(type, () => events.push(type));
    window.animations = 0;
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) { window.animations++; return animate.apply(this, args); };
    document.body.innerHTML = '<button id="t">Trigger</button><sl-drawer id="d" label="Title" open>Content</sl-drawer><div style="position: relative"><sl-drawer id="c" label="Contained" contained open>Content</sl-drawer></div>';
    const el = document.getElementById('d');
    const contained = document.getElementById('c');
    await el.updateComplete;
    await contained.updateComplete;
    await new Promise(resolve => setTimeout(resolve, 400));
    const result = {
      events, animations: window.animations, open: el.open, hidden: [el.drawer.hidden, contained.drawer.hidden],
      active: [el.modal.isActive(), contained.modal.isActive()], lock: document.documentElement.classList.contains('sl-scroll-lock'), focus: document.activeElement === el,
    };
    Element.prototype.animate = animate;
    return result;
  });
  expect(r).toEqual({ events: [], animations: 0, open: true, hidden: [false, false], active: [true, false], lock: true, focus: false });
  // Focusing an element outside moves focus into the drawer (the trap is active); no trigger was recorded, so closing
  // returns focus nowhere: the outside button stays unfocused.
  await page.evaluate(() => document.getElementById('t').focus());
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).not.toBe('t');
  await page.keyboard.press('Escape');
  await expect.poll(() => isOpen(page)).toBe(false);
  await expect.poll(() => page.evaluate(() => document.getElementById('d').drawer.hidden)).toBe(true);
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 50)));
  expect(await page.evaluate(() => [document.activeElement === document.getElementById('t'), document.getElementById('c').open])).toEqual([false, true]);
});

test('upstream quirk: with CloseWatcher a canceled Escape spends the watcher; the keydown fallback keeps requesting; hide and show re-arm it', async ({ page }) => {
  await blank(page, '<sl-drawer id="d" label="Title">Content</sl-drawer>');
  await recordEvents(page, ['sl-request-close']);
  const hasWatcher = await page.evaluate(() => 'CloseWatcher' in window);
  await page.evaluate(() => document.getElementById('d').show());
  await page.keyboard.press('Escape');
  await expect.poll(() => keyboardRequests(page)).toBe(1);
  await expect.poll(() => panelAnimations(page), 'the deny-close animation has ended').toBe(0);
  await recordKeys(page);
  await pressReceived(page, page, 'Escape');
  // The window in which a wrong request could still arrive.
  await settled(page);
  expect(await isOpen(page)).toBe(true);
  // CloseWatcher (Chromium): the second Escape requests nothing. Keydown fallback (Firefox, WebKit): it requests again.
  expect(await keyboardRequests(page)).toBe(hasWatcher ? 1 : 2);
  // Hiding and showing again installs a new watcher (or listener): Escape requests a close again.
  await page.evaluate(async () => { const el = document.getElementById('d'); await el.hide(); await el.show(); });
  const before = await keyboardRequests(page);
  await page.keyboard.press('Escape');
  await expect.poll(() => keyboardRequests(page)).toBe(before + 1);
});

test('upstream quirk: changing contained while open does not update the Escape handling where the browser has CloseWatcher', async ({ page }) => {
  await blank(page, '<sl-drawer id="d" label="Title" contained>Content</sl-drawer>');
  await recordEvents(page);
  const hasWatcher = await page.evaluate(() => 'CloseWatcher' in window);
  // Opened contained, then made modal: with CloseWatcher Escape still requests nothing; the keydown fallback closes it.
  await page.evaluate(async () => { const el = document.getElementById('d'); await el.show(); el.contained = false; await el.updateComplete; });
  await recordKeys(page);
  const closed = () => page.evaluate(() => window.events.some(e => e.type === 'sl-after-hide'));
  await pressReceived(page, page, 'Escape');
  // A close is awaited to its end; where nothing should happen, the settle window lets a wrong request show up.
  if (hasWatcher) await settled(page);
  await expect.poll(async () => [await keyboardRequests(page), await isOpen(page), await closed()]).toEqual(hasWatcher ? [0, true, false] : [1, false, true]);
  await page.evaluate(async () => { const el = document.getElementById('d'); await el.hide(); window.events = []; });
  // Opened uncontained, then contained: with CloseWatcher Escape still closes it; the keydown fallback ignores it.
  await page.evaluate(async () => { const el = document.getElementById('d'); await el.show(); el.contained = true; await el.updateComplete; });
  await pressReceived(page, page, 'Escape');
  if (!hasWatcher) await settled(page);
  await expect.poll(async () => [await keyboardRequests(page), await isOpen(page), await closed()]).toEqual(hasWatcher ? [1, false, true] : [0, true, false]);
});

test('upstream quirk: the hidden attribute does not hide an open drawer', async ({ page }) => {
  await blank(page, '<sl-drawer id="d" label="Title" hidden>Content</sl-drawer>');
  await page.evaluate(() => document.getElementById('d').show());
  await expect(panel(page)).toBeVisible();
});

test('upstream quirk: removing an open drawer releases the lock and Escape handling but not the focus trap, and leaves open true', async ({ page }) => {
  await blank(page, '<button id="b1">One</button><button id="b2">Two</button><sl-drawer id="d" label="Title">Content</sl-drawer>');
  const r = await page.evaluate(async () => {
    const el = document.getElementById('d');
    const lock = () => document.documentElement.classList.contains('sl-scroll-lock');
    await el.show();
    const shown = [lock(), el.modal.isActive()];
    el.remove();
    const removed = [el.open, lock(), el.modal.isActive()];
    document.body.append(el);
    await el.updateComplete;
    window.requests = 0;
    el.addEventListener('sl-request-close', () => window.requests++);
    return { shown, removed, back: [el.open, lock(), el.modal.isActive(), el.drawer.hidden] };
  });
  expect(r).toEqual({ shown: [true, true], removed: [true, false, true], back: [true, false, true, false] });
  // The Escape handling is released: Escape requests nothing and the drawer stays open.
  await recordKeys(page);
  await pressReceived(page, page, 'Escape');
  await settled(page);
  expect(await page.evaluate(() => [window.requests, document.getElementById('d').open])).toEqual([0, true]);
  // Closing it releases the trap.
  await page.evaluate(() => document.getElementById('d').hide());
  expect(await page.evaluate(() => document.getElementById('d').modal.isActive())).toBe(false);
});

test('upstream quirk: a removed open drawer stays the active modal: the one beneath loses its trap, and Tab moves focus nowhere', async ({ page }) => {
  await blank(page, '<button id="b1">One</button><button id="b2">Two</button><sl-drawer id="under" label="Under"><button id="u">U</button></sl-drawer><sl-drawer id="d" label="Title">Content</sl-drawer>');
  const r = await page.evaluate(async () => {
    const [el, under] = ['d', 'under'].map(id => document.getElementById(id));
    window.removed = el;
    await under.show();
    await el.show();
    el.remove();
    return [el.modal.isActive(), under.modal.isActive()];
  });
  expect(r).toEqual([true, false]);
  // The drawer beneath does not pull focus back in, and Tab, taken by the removed drawer's trap, does not move focus.
  await page.evaluate(() => document.getElementById('b1').focus());
  await settled(page);
  expect(await deepActive(page)).toBe('b1');
  await recordKeys(page);
  await pressReceived(page, page, 'Tab');
  await settled(page);
  expect(await deepActive(page)).toBe('b1');
  // Once the removed drawer is hidden, the trap of the drawer beneath works again.
  await page.evaluate(() => window.removed.hide());
  expect(await page.evaluate(() => document.getElementById('under').modal.isActive())).toBe(true);
  await page.keyboard.press('Tab');
  await expect.poll(() => deepActive(page)).not.toBe('b1');
});

test('upstream quirk: an empty label renders a U+FEFF title, so the panel has no usable accessible name', async ({ page }) => {
  await blank(page, '<sl-drawer id="d">Content</sl-drawer>');
  await page.evaluate(() => document.getElementById('d').show());
  expect(await page.evaluate(() => document.getElementById('d').shadowRoot.querySelector('slot[name="label"]').textContent)).toBe(' \uFEFF ');
  await expect(panel(page)).toHaveAccessibleName(/^\s*\uFEFF?\s*$/);
});

test('inherited core ready event: dispatched once on the element after the first update (the base already hidden), not bubbling or composed', async ({ page }) => {
  await blank(page);
  const r = await page.evaluate(async () => {
    const el = document.createElement('sl-drawer');
    const seen = [];
    let bubbled = 0;
    el.addEventListener('ready', event => seen.push({ bubbles: event.bubbles, composed: event.composed, baseHidden: el.drawer.hidden }));
    document.body.addEventListener('ready', () => bubbled++);
    document.body.append(el);
    await el.updateComplete;
    el.label = 'x';
    await el.updateComplete;
    el.remove();
    return { seen, bubbled };
  });
  expect(r).toEqual({ seen: [{ bubbles: false, composed: false, baseHidden: true }], bubbled: 0 });
});

test('animation registry: Shoelace\'s eleven defaults; setAnimation changes one drawer only', async ({ page }) => {
  await blank(page, '<sl-drawer id="d" label="A">A</sl-drawer><sl-drawer id="e" label="B">B</sl-drawer>');
  const r = await page.evaluate(async () => {
    const { getAnimation, setAnimation } = window.registry;
    const d = document.getElementById('d');
    const names = ['Top', 'End', 'Bottom', 'Start'].flatMap(p => [`drawer.show${p}`, `drawer.hide${p}`])
      .concat(['drawer.denyClose', 'drawer.overlay.show', 'drawer.overlay.hide']);
    const defaults = Object.fromEntries(names.map(n => [n, JSON.parse(JSON.stringify(getAnimation(d, n, { dir: 'ltr' })))]));
    const rtl = Object.fromEntries(['drawer.showEnd', 'drawer.hideStart', 'drawer.showTop'].map(n => [n, JSON.parse(JSON.stringify(getAnimation(d, n, { dir: 'rtl' }).keyframes))]));
    window.calls = [];
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      window.calls.push([this.getRootNode().host.id, this.getAttribute('part'), options.duration]);
      return animate.call(this, keyframes, options);
    };
    setAnimation(d, 'drawer.showEnd', { keyframes: [{ opacity: 0 }, { opacity: 1 }], options: { duration: 17 } });
    for (const el of [d, document.getElementById('e')]) { await el.show(); await el.hide(); }
    Element.prototype.animate = animate;
    return { defaults, rtl, calls: window.calls };
  });
  const frames = (from, to) => [{ opacity: from[0], translate: from[1] }, { opacity: to[0], translate: to[1] }];
  const slide = (from, to, rtl) => ({ keyframes: frames(from, to), ...(rtl ? { rtlKeyframes: frames(...rtl) } : {}), options: { duration: 250, easing: 'ease' } });
  expect(r.defaults).toEqual({
    'drawer.showTop': slide([0, '0 -100%'], [1, '0 0']),
    'drawer.hideTop': slide([1, '0 0'], [0, '0 -100%']),
    'drawer.showEnd': slide([0, '100%'], [1, '0'], [[0, '-100%'], [1, '0']]),
    'drawer.hideEnd': slide([1, '0'], [0, '100%'], [[1, '0'], [0, '-100%']]),
    'drawer.showBottom': slide([0, '0 100%'], [1, '0 0']),
    'drawer.hideBottom': slide([1, '0 0'], [0, '0 100%']),
    'drawer.showStart': slide([0, '-100%'], [1, '0'], [[0, '100%'], [1, '0']]),
    'drawer.hideStart': slide([1, '0'], [0, '-100%'], [[1, '0'], [0, '100%']]),
    'drawer.denyClose': { keyframes: [{ scale: 1 }, { scale: 1.01 }, { scale: 1 }], options: { duration: 250 } },
    'drawer.overlay.show': { keyframes: [{ opacity: 0 }, { opacity: 1 }], options: { duration: 250 } },
    'drawer.overlay.hide': { keyframes: [{ opacity: 1 }, { opacity: 0 }], options: { duration: 250 } },
  });
  expect(r.rtl).toEqual({
    'drawer.showEnd': [{ opacity: 0, translate: '-100%' }, { opacity: 1, translate: '0' }],
    'drawer.hideStart': [{ opacity: 1, translate: '0' }, { opacity: 0, translate: '100%' }],
    'drawer.showTop': [{ opacity: 0, translate: '0 -100%' }, { opacity: 1, translate: '0 0' }],
  });
  expect(r.calls).toEqual([
    ['d', 'panel', 17], ['d', 'overlay', 250], ['d', 'overlay', 250], ['d', 'panel', 250],
    ['e', 'panel', 250], ['e', 'overlay', 250], ['e', 'overlay', 250], ['e', 'panel', 250],
  ]);
});

test('every docs example renders in its own document and opens and closes with its buttons', async ({ page }) => {
  await openDocs(page, PAGE);
  await documentsLoaded(page);
  const titles = await page.locator('iframe.example').evaluateAll(frames => frames.map(f => f.title));
  expect(titles).toEqual(EXAMPLES.map(([t]) => `Drawer example: ${t}`));
  for (const [title] of EXAMPLES) {
    // The open drawer is fixed in its frame, which the browser does not scroll into view for it; the frame is.
    await page.locator(`iframe.example[title="Drawer example: ${title}"]`).scrollIntoViewIfNeeded();
    const frame = frameFor(page, title);
    const drawer = frame.locator('sl-drawer');
    await drawer.evaluate(async el => { await customElements.whenDefined('sl-drawer'); await el.updateComplete; });
    await frame.locator('body > sl-button').click();
    await expect.poll(() => drawer.evaluate(el => el.open), title).toBe(true);
    await expect(drawer.locator('.drawer__panel')).toBeVisible();
    await drawer.evaluate(el => new Promise(resolve => el.open ? setTimeout(resolve, 350) : resolve()));
    await frame.locator('sl-drawer > sl-button[slot="footer"]').click();
    await expect.poll(() => drawer.evaluate(el => el.open), title).toBe(false);
    // The hide ends by focusing the trigger again (in a timeout queued just before sl-after-hide), which scrolls the page
    // to this frame; wait for the hide to finish and that timeout to run before moving on. Whether the click made the
    // button the trigger is the engine's choice, so focus itself is not asserted here.
    await expect.poll(() => drawer.evaluate(el => el.drawer.hidden), title).toBe(true);
    await drawer.evaluate(() => new Promise(resolve => setTimeout(resolve, 50)));
  }
});

test('placement examples: the panel slides in along the edge each example names', async ({ page }) => {
  await openDocs(page, PAGE);
  await documentsLoaded(page);
  const edges = {};
  for (const [title] of EXAMPLES.slice(0, 4)) {
    await page.locator(`iframe.example[title="Drawer example: ${title}"]`).scrollIntoViewIfNeeded();
    const frame = frameFor(page, title);
    const drawer = frame.locator('sl-drawer');
    await drawer.evaluate(async el => { await customElements.whenDefined('sl-drawer'); await el.updateComplete; });
    await frame.locator('body > sl-button').click();
    await drawer.evaluate(el => new Promise(resolve => setTimeout(resolve, 350)));
    edges[title] = await drawer.evaluate(el => {
      const b = el.panel.getBoundingClientRect();
      const near = (x, y) => Math.abs(x - y) < 1;
      const size = parseFloat(getComputedStyle(document.documentElement).fontSize) * 25;
      const vertical = el.placement === 'top' || el.placement === 'bottom';
      const edge = { top: near(b.top, 0), end: near(b.right, innerWidth), bottom: near(b.bottom, innerHeight), start: near(b.left, 0) }[el.placement];
      // Across the edge the panel fills the frame; along it, it is 25rem (--size) or the whole frame when that is smaller.
      const fills = vertical ? near(b.width, innerWidth) : near(b.height, innerHeight);
      const depth = vertical ? near(b.height, Math.min(size, innerHeight)) : near(b.width, Math.min(size, innerWidth));
      return [el.placement, edge, fills, depth];
    });
    await drawer.evaluate(el => el.hide());
  }
  expect(edges).toEqual({
    Overview: ['end', true, true, true],
    'Slide in From Start': ['start', true, true, true],
    'Slide in From Top': ['top', true, true, true],
    'Slide in From Bottom': ['bottom', true, true, true],
  });
});

test('Contained to an Element example: the drawer opens inside its box, without an overlay, and the button toggles it', async ({ page }) => {
  const { frame } = await openExample(page, 'Contained to an Element');
  await page.locator('iframe.example[title="Drawer example: Contained to an Element"]').scrollIntoViewIfNeeded();
  const drawer = frame.locator('sl-drawer');
  const toggle = frame.locator('body > sl-button');
  await toggle.click();
  await expect.poll(() => drawer.evaluate(el => el.open)).toBe(true);
  await drawer.evaluate(() => new Promise(resolve => setTimeout(resolve, 350)));
  const r = await drawer.evaluate(el => {
    const box = el.parentElement.getBoundingClientRect();
    const b = el.panel.getBoundingClientRect();
    return { inside: b.top >= box.top && b.bottom <= box.bottom && b.left >= box.left && b.right <= box.right, half: Math.round(b.width) === Math.round(el.parentElement.clientWidth / 2), overlay: getComputedStyle(el.overlay).display, active: el.modal.isActive() };
  });
  expect(r).toEqual({ inside: true, half: true, overlay: 'none', active: false });
  // The page outside stays usable: the toggle button is reachable and closes the drawer.
  await toggle.click();
  await expect.poll(() => drawer.evaluate(el => el.open)).toBe(false);
});

test('Customizing Initial Focus example: the autofocus input takes focus', async ({ page }) => {
  const { frame } = await openExample(page, 'Customizing Initial Focus');
  await frame.locator('body > sl-button').click();
  await expect.poll(() => frame.locator('sl-input').evaluate(el => document.activeElement === el)).toBe(true);
});

test('Preventing the Drawer from Closing example: an overlay click is denied; the close button closes', async ({ page }) => {
  const { frame } = await openExample(page, 'Preventing the Drawer from Closing');
  await page.locator('iframe.example[title="Drawer example: Preventing the Drawer from Closing"]').scrollIntoViewIfNeeded();
  const drawer = frame.locator('sl-drawer');
  await frame.locator('body > sl-button').click();
  await expect.poll(() => drawer.evaluate(el => el.open)).toBe(true);
  await drawer.evaluate(el => new Promise(resolve => setTimeout(resolve, 350)));
  await drawer.evaluate(el => el.overlay.click());
  await drawer.evaluate(() => new Promise(resolve => setTimeout(resolve, 350)));
  expect(await drawer.evaluate(el => el.open)).toBe(true);
  await drawer.locator('[part="close-button"]').click();
  await expect.poll(() => drawer.evaluate(el => el.open)).toBe(false);
});

test('no upstream Shoelace runtime is requested or defined; all requests stay on the local origin', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  expect(await frame.locator('body').evaluate(() => Boolean(window.Shoelace || document.querySelector('script[src*="shoelace"]')))).toBe(false);
});

test.describe('React', () => {
  const mount = reactWrapperPage(test);

  test('the wrapper passes label, placement, contained and open (set after the first render) and takes onSlShow, onSlAfterShow, onSlRequestClose, onSlHide and onSlAfterHide', async ({ page }) => {
    const errors = await mount(page);
    await page.evaluate(() => {
      window.reactEvents = [];
      const log = type => event => window.reactEvents.push([type, event.detail?.source ?? null]);
      window.props = open => ({ label: 'React', placement: 'start', contained: false, open, onSlShow: log('show'), onSlAfterShow: log('after-show'),
        onSlRequestClose: log('request-close'), onSlHide: log('hide'), onSlAfterHide: log('after-hide'), onSlInitialFocus: log('initial-focus') });
      window.renderWrapper('VelcroDrawer', window.props(false), 'Content');
    });
    await page.evaluate(() => document.getElementById('wrapped').updateComplete);
    await page.evaluate(() => window.renderWrapper('VelcroDrawer', window.props(true), 'Content'));
    const el = page.locator('#wrapped');
    await expect.poll(() => page.evaluate(() => window.reactEvents.map(e => e[0])).then(list => showOrder(list, 'initial-focus', 'show'))).toEqual(['show', 'initial-focus', 'after-show']);
    expect(await el.evaluate(e => [e.localName, e.label, e.placement, e.contained, e.open])).toEqual(['sl-drawer', 'React', 'start', false, true]);
    await el.locator('[part="close-button"]').click();
    await expect.poll(() => page.evaluate(() => window.reactEvents.slice(3))).toEqual([['request-close', 'close-button'], ['hide', null], ['after-hide', null]]);
    expect(await page.evaluate(() => window.errors)).toEqual([]);
    expect(errors).toEqual([]);
  });

  // Shoelace's React examples, ported in packages/docs/examples/drawer/react/*.jsx (the files the docs page shows), bundled
  // with React 19 and the generated wrappers, resolved through the package's real export map. Each one opens with its
  // button and closes with its footer button.
  test('every React example renders, opens and closes like its HTML example', async ({ page }) => {
    test.setTimeout(120_000);
    const reactDir = path.join(docsDir, 'examples/drawer/react');
    const fromVelcro = createRequire(path.join(velcroDir, 'package.json'));
    const fromDocs = createRequire(path.join(docsDir, 'package.json'));
    const pkgDir = name => path.dirname(fromVelcro.resolve(`${name}/package.json`));
    const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
    const dir = mkdtempSync(path.join(tmpdir(), 'velcro-drawer-react-'));
    let bundle;
    try {
      for (const [, name] of EXAMPLES) writeFileSync(path.join(dir, `${name}.jsx`), `${readFileSync(path.join(reactDir, `${name}.jsx`), 'utf8')}\nexport default App;\n`);
      const entry = path.join(dir, 'entry.js');
      writeFileSync(entry, `
        import React from 'react';
        import { flushSync } from 'react-dom';
        import { createRoot } from 'react-dom/client';
        ${EXAMPLES.map(([, name], i) => `import App${i} from './${name}.jsx';`).join('\n')}
        const apps = { ${EXAMPLES.map(([, name], i) => `${JSON.stringify(name)}: App${i}`).join(', ')} };
        window.errors = [];
        addEventListener('error', e => window.errors.push(String(e.message)));
        addEventListener('unhandledrejection', e => window.errors.push(String(e.reason)));
        let root;
        window.renderExample = name => {
          root?.unmount();
          document.body.replaceChildren();
          const host = document.createElement('div');
          document.body.append(host);
          root = createRoot(host);
          flushSync(() => root.render(React.createElement(apps[name])));
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
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.setContent('<!DOCTYPE html><html class="sl-theme-light"><body style="margin: 0"></body></html>');
    await page.addStyleTag({ content: theme });
    await page.addScriptTag({ type: 'module', content: bundle });
    await page.waitForFunction(() => typeof window.renderExample === 'function');
    const placements = { 'placement-start': 'start', 'placement-top': 'top', 'placement-bottom': 'bottom' };
    for (const [, name] of EXAMPLES) {
      await page.evaluate(n => window.renderExample(n), name);
      const drawer = page.locator('sl-drawer');
      await drawer.evaluate(async el => { await customElements.whenDefined('sl-drawer'); await el.updateComplete; });
      expect(await drawer.evaluate(el => [el.label, el.open, el.placement, el.contained]), name)
        .toEqual(['Drawer', false, placements[name] ?? 'end', name === 'contained']);
      await page.locator('body sl-button:not([slot])').last().click();
      await expect.poll(() => drawer.evaluate(el => el.open), name).toBe(true);
      await expect(drawer.locator('.drawer__panel'), name).toBeVisible();
      // Velcro's input wrapper sets autofocus as the input's property, which does not add the attribute the drawer looks
      // for, so the React version focuses the panel (the HTML version focuses the input). Listed on the docs page.
      if (name === 'focus') {
        expect(await page.evaluate(() => [document.querySelector('sl-input').autofocus, document.querySelector('sl-input').hasAttribute('autofocus')])).toEqual([true, false]);
        await expect.poll(() => page.evaluate(() => document.activeElement?.shadowRoot?.activeElement?.className)).toBe('drawer__panel');
      }
      if (name === 'custom-size') expect(await drawer.evaluate(el => getComputedStyle(el).getPropertyValue('--size').trim())).toBe('50vw');
      // Shoelace's React Contained example passes a no-modal prop the drawer does not have; React sets it as an attribute.
      if (name === 'contained') expect(await drawer.evaluate(el => [el.getAttribute('no-modal'), getComputedStyle(el).getPropertyValue('--size').trim()])).toEqual(['', '50%']);
      await drawer.evaluate(() => new Promise(resolve => setTimeout(resolve, 350)));
      await page.locator('sl-drawer > sl-button[slot="footer"]').click();
      await expect.poll(() => drawer.evaluate(el => el.open), name).toBe(false);
    }
    expect(await page.evaluate(() => window.errors)).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
