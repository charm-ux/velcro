// sl-dialog product checks against Shoelace 2.20.1's dialog contract: the docs page and its examples, the element's
// structure, styles, behavior and events on a blank page, the internal modal modules it uses, and its React wrapper.
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

const PAGE = '/components/dialog';
const docsDir = fileURLToPath(new URL('../../packages/docs/', import.meta.url));
const velcroDir = fileURLToPath(new URL('../../packages/velcro/', import.meta.url));
const theme = readFileSync(path.join(velcroDir, 'themes/light.css'), 'utf8');

// The docs page's examples, in Shoelace's order: the example's title and the name of its files under examples/dialog/.
// Every one has a React version in Shoelace's page.
const EXAMPLES = [
  ['Overview', 'overview'],
  ['Custom Width', 'custom-width'],
  ['Scrolling', 'scrolling'],
  ['Header Actions', 'header-actions'],
  ['Preventing the Dialog from Closing', 'deny-close'],
  ['Customizing Initial Focus', 'focus'],
];

const frameFor = (page, title) => page.frameLocator(`iframe.example[title="Dialog example: ${title}"]`);

async function openExample(page, name = 'Overview') {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  const frame = frameFor(page, name);
  await expect(frame.locator('sl-dialog').first()).toBeAttached();
  await frame.locator('body').evaluate(() => customElements.whenDefined('sl-dialog'));
  // Rendering only: a test that reads the requests waits for the network to go quiet itself (documentsLoaded).
  return { frame, requests };
}

// The element on a blank, full-size page with the light theme: the registering entry, the animation registry and the
// internal modules the dialog uses, built from the package (the internals through velcro-internal:).
let outDir;
test.beforeAll(async () => {
  outDir = await buildFixtures({
    dialog: "export * from '@charm-ux/velcro/dialog';",
    registry: "export * from '@charm-ux/velcro/utilities/animation-registry';",
    modal: "export { default } from 'velcro-internal:internal/modal';",
    scroll: "export * from 'velcro-internal:internal/scroll';",
    tabbable: "export * from 'velcro-internal:internal/tabbable';",
    active: "export * from 'velcro-internal:internal/active-elements';",
    blur: "export * from 'velcro-internal:internal/close-active-element';",
  });
});

async function blank(page, markup = '') {
  await gotoBlank(page, outDir);
  await page.addStyleTag({ content: theme });
  await page.evaluate(async markup => {
    document.documentElement.className = 'sl-theme-light';
    window.registry = await import('/registry.js');
    await import('/dialog.js');
    document.body.innerHTML = markup;
    await Promise.all([...document.querySelectorAll('sl-dialog')].map(el => el.updateComplete));
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
const panel = page => page.locator('#d .dialog__panel');
// The number of animations running on the panel (the show, hide and deny-close animations play there).
const panelAnimations = page => page.evaluate(() => document.getElementById('d').shadowRoot.querySelector('.dialog__panel').getAnimations().length);
const settled = page => page.evaluate(() => new Promise(resolve => setTimeout(resolve, 400)));

test('docs page is prerendered with Velcro branding, prototype status, every Shoelace section, the quirks and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Dialog - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('without changing the shared core prefix');
  expect(html).toContain('@charm-ux/velcro/utilities/animation-registry');
  for (const [title] of EXAMPLES) expect(html).toContain(`title="Dialog example: ${title}"`);
  // Fixed-height preview frames: room for the open dialog, and no resize loop on the Scrolling example's 150vh content.
  expect(html.match(/<iframe class="example" style="min-height: 24rem; max-height: 24rem"/g)).toHaveLength(EXAMPLES.length);
  const examplesPart = html.slice(html.indexOf('id="examples"'), html.indexOf('id="attributes"'));
  expect([...examplesPart.matchAll(/<h3 id="([^"]+)"><!--lit-part-->([^<]+)<!--\/lit-part--><\/h3>/g)].map(m => m[1]))
    .toEqual(['overview', 'custom-width', 'scrolling', 'header-actions', 'preventing-the-dialog-from-closing', 'customizing-initial-focus']);
  expect(examplesPart).toContain('Use the <code>--width</code> custom property to set the dialog');
  expect(examplesPart).toContain('dialogs will not scroll with the page');
  expect(examplesPart).toContain('You can use <code>event.detail.source</code> to determine what triggered the request to close.');
  expect(examplesPart).toContain('add the <code>autofocus</code> attribute to it as shown below.');
  expect(html).toContain('canceling the <code>sl-initial-focus</code> event and setting focus yourself');
  expect(html).toContain('appear above the page and require the user');
  expect(html.match(/<summary>React<\/summary>/g)).toHaveLength(EXAMPLES.length);
  expect(html).toContain('import { VelcroDialog as SlDialog } from &#39;@charm-ux/velcro/react/VelcroDialog.js&#39;;');
  expect(html).toContain('Inherited from @charm-ux/core CharmElement');
  for (const name of ['open', 'label', 'noHeader', 'modal', 'show', 'hide', 'sl-show', 'sl-after-show', 'sl-hide', 'sl-after-hide',
    'sl-initial-focus', 'sl-request-close', 'header-actions', 'footer', 'base', 'overlay', 'panel', 'header', 'title',
    'close-button', 'close-button__base', 'body', '--width', '--header-spacing', '--body-spacing', '--footer-spacing']) {
    expect(html, name).toContain(`data-name="${name}"`);
  }
  expect(html).toContain('data-name="ready"');
  // The quirks and limits the page lists are the ones the tests below pin.
  expect(html).toContain('A dialog rendered with open already set is shown at once');
  expect(html).toContain('The hidden attribute does not hide the dialog');
  expect(html).toContain('Removing an open dialog from the document releases its focus trap');
  expect(html).toContain('a single zero-width no-break space (U+FEFF)');
  expect(html).toContain('a watcher that is spent by the first Escape');
  expect(html).toContain('Observed, not compared');
  expect(html).toContain('The focus trap counts an &lt;a&gt; without href as tabbable');
  expect(html).toContain('Shoelace&#39;s own dialog tests (10, including the focus cycling inside a shadow root');
  expect(html).toContain('there is no axe check');
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
  const home = await (await request.get('/')).text();
  expect(home).toContain('/components/dialog');
});

test('sl-dialog registers inside the example document as the exported class, with sl-icon-button and sl-icon, and no ch-* definitions', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  await documentsLoaded(page);
  const info = await frame.locator('body').evaluate(() => {
    const ctor = customElements.get('sl-dialog');
    const el = document.querySelector('sl-dialog');
    return {
      baseName: ctor?.baseName,
      coreTags: ['ch-dialog'].map(t => customElements.get(t) !== undefined),
      viaConstructor: ctor ? new ctor().localName : null,
      instance: el instanceof ctor,
      deps: [customElements.get('sl-icon-button')?.baseName, customElements.get('sl-icon')?.baseName],
      attrs: el.getAttributeNames().sort(),
      delegatesFocus: el.shadowRoot.delegatesFocus,
    };
  });
  expect(info).toEqual({ baseName: 'dialog', coreTags: [false], viaConstructor: 'sl-dialog', instance: true, deps: ['icon-button', 'icon'], attrs: ['class', 'label'], delegatesFocus: false });
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
});

test('closed: Shoelace\'s structure, parts, classes and ARIA; the base is hidden', async ({ page }) => {
  await blank(page, '<sl-dialog id="d" label="Title">Content<button slot="footer">Ok</button></sl-dialog>');
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
      body: [attrs(root.querySelector('[part="body"]')), root.querySelector('[part="body"] > slot:not([name])') !== null],
      footer: [root.querySelector('[part="footer"]').localName, root.querySelector('[part="footer"] > slot[name="footer"]') !== null],
      members: [el.dialog === base, el.panel === root.querySelector('.dialog__panel'), el.overlay === root.querySelector('.dialog__overlay')],
      modal: [typeof el.modal.activate, typeof el.modal.activateExternal, typeof el.modal.deactivateExternal, el.modal.isActive()],
    };
  });
  expect(r).toEqual({
    children: ['div'],
    base: ['div', ['dialog', 'dialog--has-footer'], true],
    baseChildren: ['div:overlay', 'div:panel'],
    overlay: { part: 'overlay', tabindex: '-1' },
    panel: { part: 'panel', role: 'dialog', 'aria-modal': 'true', 'aria-hidden': 'true', 'aria-labelledby': 'title', tabindex: '-1' },
    panelChildren: ['header:header', 'div:body', 'footer:footer'],
    header: ['h2:title', 'div:header-actions'],
    title: [{ part: 'title', id: 'title' }, ' Title '],
    actions: ['slot:header-actions', 'sl-icon-button'],
    close: [{ part: 'close-button', exportparts: 'base:close-button__base', name: 'x-lg', label: 'Close', library: 'system' }, ['dialog__close']],
    body: [{ part: 'body', tabindex: '-1' }, true],
    footer: ['footer', true],
    members: [true, true, true],
    modal: ['function', 'function', 'function', false],
  });
  await expect(page.locator('#d .dialog')).toBeHidden();
});

test('show(): sl-show, sl-initial-focus, sl-after-show; the panel takes focus, is labelled and visible, and the page is scroll-locked', async ({ page }) => {
  await blank(page, '<button id="trigger">Open</button><sl-dialog id="d" label="Title">Content</sl-dialog>');
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
      classes: [...el.shadowRoot.querySelector('.dialog').classList].sort(),
      ariaHidden: el.shadowRoot.querySelector('.dialog__panel').getAttribute('aria-hidden'),
      focus: [document.activeElement === el, el.shadowRoot.activeElement?.className],
      lock: [document.documentElement.classList.contains('sl-scroll-lock'), getComputedStyle(document.body).overflow],
    };
  });
  expect(r).toEqual({ open: [true, true, true], classes: ['dialog', 'dialog--open'], ariaHidden: 'false', focus: [true, 'dialog__panel'], lock: [true, 'hidden'] });
  // A second show() resolves at once.
  expect(await page.evaluate(() => document.getElementById('d').show())).toBeUndefined();
  // hide(): sl-hide then sl-after-hide, the lock is released and focus returns to the trigger.
  await page.evaluate(() => { window.events = []; return document.getElementById('d').hide(); });
  expect(await eventTypes(page)).toEqual(['sl-hide', 'sl-after-hide']);
  await expect(page.locator('#trigger')).toBeFocused();
  expect(await page.evaluate(() => [document.documentElement.classList.contains('sl-scroll-lock'), document.getElementById('d').dialog.hidden, document.getElementById('d').modal.isActive()])).toEqual([false, true, false]);
  expect(await page.evaluate(() => document.getElementById('d').hide())).toBeUndefined();
});

test('setting open from script emits the same events; hide() and open = false are not cancelable', async ({ page }) => {
  await blank(page, '<sl-dialog id="d" label="Title">Content</sl-dialog>');
  await recordEvents(page, ['sl-hide', 'sl-show']);
  await page.evaluate(() => { document.getElementById('d').open = true; });
  await expect.poll(() => eventTypes(page)).toEqual(['sl-show', 'sl-initial-focus', 'sl-after-show']);
  await page.evaluate(() => { window.events = []; document.getElementById('d').open = false; });
  await expect.poll(() => eventTypes(page)).toEqual(['sl-hide', 'sl-after-hide']);
  expect(await isOpen(page)).toBe(false);
});

test('the close button, Escape and the overlay emit sl-request-close with their source and close the dialog', async ({ page }) => {
  await blank(page, '<sl-dialog id="d" label="Title">Content</sl-dialog>');
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

test('canceling sl-request-close keeps the dialog open and plays the deny-close animation on the panel', async ({ page }) => {
  await blank(page, '<sl-dialog id="d" label="Title">Content</sl-dialog>');
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
  for (const [i, act] of [() => page.locator('#d [part="close-button"]').click(), () => page.keyboard.press('Escape'), () => page.mouse.click(5, 5)].entries()) {
    await act();
    // Each canceled request plays the deny-close animation; the next one waits until it has ended.
    await expect.poll(async () => [await page.evaluate(() => window.calls.length), await panelAnimations(page)]).toEqual([i + 1, 0]);
  }
  expect(await isOpen(page)).toBe(true);
  expect(await page.evaluate(() => window.events.filter(e => e.type === 'sl-request-close').map(e => JSON.parse(e.detail).source))).toEqual(['close-button', 'keyboard', 'overlay']);
  expect(await page.evaluate(() => window.calls)).toEqual(Array(3).fill({ part: 'panel', keyframes: [{ scale: 1 }, { scale: 1.02 }, { scale: 1 }], duration: 250 }));
  await expect(panel(page)).toBeVisible();
});

test('focus is trapped: Tab and Shift+Tab cycle through the dialog\'s tabbable elements, including the close button', async ({ page }) => {
  await blank(page, '<button id="outside">Outside</button><sl-dialog id="d" label="Title"><button id="a">A</button><button id="b">B</button><button id="c" slot="footer">C</button></sl-dialog>');
  await page.evaluate(() => document.getElementById('d').show());
  const active = () => page.evaluate(() => {
    let el = document.activeElement;
    while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
    return el.id || el.getAttribute('part') || el.localName;
  });
  for (const expected of ['base', 'a', 'b', 'c', 'base']) {
    await page.keyboard.press('Tab');
    await expect.poll(active).toBe(expected);
  }
  await page.keyboard.press('Shift+Tab');
  await expect.poll(() => active()).toBe('c');
  // Focusing an element outside the dialog moves focus back in.
  await page.evaluate(() => document.getElementById('outside').focus());
  await expect.poll(active).not.toBe('outside');
});

test('autofocus: the autofocus element takes focus instead of the panel; canceling sl-initial-focus leaves focus alone', async ({ page }) => {
  await blank(page, '<sl-dialog id="d" label="Title"><input id="i" autofocus></sl-dialog><sl-dialog id="e" label="Other"><input id="j"></sl-dialog>');
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

test('computed styles match Shoelace\'s rules with the theme tokens; --width sets the panel width', async ({ page }) => {
  await blank(page, '<sl-dialog id="d" label="Title" open>Content<button slot="footer">Ok</button></sl-dialog><div id="probe"></div>');
  const r = await page.evaluate(() => {
    const el = document.getElementById('d');
    const root = el.shadowRoot;
    const probe = document.getElementById('probe');
    const token = (prop, value) => { probe.style.setProperty(prop, value); const v = getComputedStyle(probe).getPropertyValue(prop); probe.style.removeProperty(prop); return v; };
    const cs = sel => getComputedStyle(root.querySelector(sel));
    const base = cs('.dialog');
    const overlay = cs('.dialog__overlay');
    const panelStyle = cs('.dialog__panel');
    return {
      host: getComputedStyle(el).display,
      base: [base.position, base.display, base.alignItems, base.justifyContent, base.zIndex, base.top, base.left],
      expectedZ: token('z-index', 'var(--sl-z-index-dialog)'),
      overlay: [overlay.position, overlay.backgroundColor],
      expectedOverlay: token('background-color', 'var(--sl-overlay-background-color)'),
      panel: [panelStyle.display, panelStyle.flexDirection, panelStyle.zIndex, panelStyle.width, panelStyle.backgroundColor, panelStyle.borderTopLeftRadius, panelStyle.boxShadow],
      expectedPanel: [token('width', '31rem'), token('background-color', 'var(--sl-panel-background-color)'), token('border-top-left-radius', 'var(--sl-border-radius-medium)'), token('box-shadow', 'var(--sl-shadow-x-large)')],
      title: [cs('.dialog__title').fontSize, cs('.dialog__title').paddingTop],
      expectedTitle: [token('font-size', 'var(--sl-font-size-large)'), token('padding-top', 'var(--sl-spacing-large)')],
      body: [cs('.dialog__body').paddingTop, cs('.dialog__body').overflowY],
      footer: [cs('.dialog__footer').textAlign, cs('.dialog__footer').paddingTop],
    };
  });
  expect(r.host).toBe('contents');
  expect(r.base).toEqual(['fixed', 'flex', 'center', 'center', r.expectedZ, '0px', '0px']);
  expect(r.overlay).toEqual(['fixed', r.expectedOverlay]);
  expect(r.panel).toEqual(['flex', 'column', '2', ...r.expectedPanel]);
  expect(r.title).toEqual(r.expectedTitle);
  expect(r.body).toEqual([r.expectedTitle[1], 'auto']);
  expect(r.footer).toEqual(['right', r.expectedTitle[1]]);
  const width = await page.evaluate(() => {
    const el = document.getElementById('d');
    el.style.setProperty('--width', '300px');
    return getComputedStyle(el.shadowRoot.querySelector('.dialog__panel')).width;
  });
  expect(width).toBe('300px');
});

test('no-header: no header or close button; the panel is labelled by aria-label', async ({ page }) => {
  await blank(page, '<sl-dialog id="d" label="Hidden title" no-header>Content</sl-dialog>');
  await page.evaluate(() => document.getElementById('d').show());
  const r = await page.evaluate(() => {
    const p = document.getElementById('d').shadowRoot.querySelector('.dialog__panel');
    return [p.querySelector('[part="header"]'), p.getAttribute('aria-label'), p.hasAttribute('aria-labelledby')];
  });
  expect(r).toEqual([null, 'Hidden title', false]);
  await expect(panel(page)).toHaveAccessibleName('Hidden title');
  await page.keyboard.press('Escape');
  await expect.poll(() => isOpen(page)).toBe(false);
});

test('slots: label replaces the label attribute; header-actions sit before the close button; footer adds the has-footer class', async ({ page }) => {
  await blank(page, '<sl-dialog id="d" label="Attr"><span slot="label" id="l">Slotted</span><button slot="header-actions" id="h">H</button>Content</sl-dialog>');
  await page.evaluate(() => document.getElementById('d').show());
  await expect(panel(page)).toHaveAccessibleName('Slotted');
  const r = await page.evaluate(async () => {
    const el = document.getElementById('d');
    const root = el.shadowRoot;
    const before = root.querySelector('.dialog').classList.contains('dialog--has-footer');
    const footer = document.createElement('button');
    footer.slot = 'footer';
    el.append(footer);
    await new Promise(resolve => setTimeout(resolve));
    await el.updateComplete;
    return {
      label: root.querySelector('slot[name="label"]').assignedElements().map(n => n.id),
      actions: root.querySelector('slot[name="header-actions"]').assignedElements().map(n => n.id),
      hasFooter: [before, root.querySelector('.dialog').classList.contains('dialog--has-footer')],
    };
  });
  expect(r).toEqual({ label: ['l'], actions: ['h'], hasFooter: [false, true] });
});

test('properties: defaults, reflection, a removed reflected attribute restores the initial value', async ({ page }) => {
  await blank(page, '<sl-dialog id="d">Content</sl-dialog>');
  const r = await page.evaluate(async () => {
    const el = document.getElementById('d');
    const defaults = [el.open, el.label, el.noHeader, el.dir, el.lang];
    el.label = 'L';
    el.noHeader = true;
    await el.updateComplete;
    const reflected = [el.getAttribute('label'), el.getAttribute('no-header')];
    el.removeAttribute('label');
    el.removeAttribute('no-header');
    await el.updateComplete;
    return { defaults, reflected, removed: [el.label, el.noHeader] };
  });
  expect(r).toEqual({ defaults: [false, '', false, undefined, undefined], reflected: ['L', ''], removed: ['', false] });
});

test('the body scroll lock is counted per dialog: it stays while any dialog is open; the newest open dialog owns the focus trap', async ({ page }) => {
  await blank(page, '<sl-dialog id="d" label="One">One</sl-dialog><sl-dialog id="e" label="Two">Two</sl-dialog>');
  const r = await page.evaluate(async () => {
    const [d, e] = ['d', 'e'].map(id => document.getElementById(id));
    const lock = () => document.documentElement.classList.contains('sl-scroll-lock');
    await d.show();
    await e.show();
    const both = [lock(), d.modal.isActive(), e.modal.isActive()];
    await e.hide();
    const one = [lock(), d.modal.isActive()];
    await d.hide();
    return { both, one, none: lock() };
  });
  expect(r).toEqual({ both: [true, false, true], one: [true, true], none: false });
});

test('upstream quirk: a dialog rendered open emits no show events, plays no animation, does not move focus or record a trigger, but traps focus and locks scrolling', async ({ page }) => {
  await gotoBlank(page, outDir);
  await page.addStyleTag({ content: theme });
  const r = await page.evaluate(async () => {
    await import('/dialog.js');
    const events = [];
    for (const type of ['sl-show', 'sl-after-show', 'sl-initial-focus']) document.addEventListener(type, () => events.push(type));
    window.animations = 0;
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) { window.animations++; return animate.apply(this, args); };
    document.body.innerHTML = '<button id="t">Trigger</button><sl-dialog id="d" label="Title" open>Content</sl-dialog>';
    const el = document.getElementById('d');
    await el.updateComplete;
    await new Promise(resolve => setTimeout(resolve, 400));
    const result = { events, animations: window.animations, open: el.open, hidden: el.dialog.hidden, active: el.modal.isActive(), lock: document.documentElement.classList.contains('sl-scroll-lock'), focus: document.activeElement === el };
    Element.prototype.animate = animate;
    return result;
  });
  expect(r).toEqual({ events: [], animations: 0, open: true, hidden: false, active: true, lock: true, focus: false });
  // Focusing an element outside moves focus into the dialog (the trap is active); no trigger was recorded, so closing
  // returns focus nowhere: the outside button stays unfocused.
  await page.evaluate(() => document.getElementById('t').focus());
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).not.toBe('t');
  await page.keyboard.press('Escape');
  await expect.poll(() => isOpen(page)).toBe(false);
  await expect.poll(() => page.evaluate(() => document.getElementById('d').dialog.hidden)).toBe(true);
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 50)));
  expect(await page.evaluate(() => document.activeElement === document.getElementById('t'))).toBe(false);
});

test('upstream quirk: with CloseWatcher a canceled Escape spends the watcher; the keydown fallback keeps requesting; hide and show re-arm it', async ({ page }) => {
  await blank(page, '<sl-dialog id="d" label="Title">Content</sl-dialog>');
  await recordEvents(page, ['sl-request-close']);
  const hasWatcher = await page.evaluate(() => 'CloseWatcher' in window);
  const keyboardRequests = () => page.evaluate(() => window.events.filter(e => e.type === 'sl-request-close' && JSON.parse(e.detail).source === 'keyboard').length);
  await page.evaluate(() => document.getElementById('d').show());
  await page.keyboard.press('Escape');
  await expect.poll(keyboardRequests).toBe(1);
  await expect.poll(() => panelAnimations(page), 'the deny-close animation has ended').toBe(0);
  await recordKeys(page);
  await pressReceived(page, page, 'Escape');
  // The window in which a wrong request could still arrive.
  await settled(page);
  expect(await isOpen(page)).toBe(true);
  // CloseWatcher (Chromium): the second Escape requests nothing. Keydown fallback (Firefox, WebKit): it requests again.
  expect(await keyboardRequests()).toBe(hasWatcher ? 1 : 2);
  // Hiding and showing again installs a new watcher (or listener): Escape requests a close again.
  await page.evaluate(async () => { const el = document.getElementById('d'); await el.hide(); await el.show(); });
  const before = await keyboardRequests();
  await page.keyboard.press('Escape');
  await expect.poll(keyboardRequests).toBe(before + 1);
});

test('upstream quirk: the hidden attribute does not hide an open dialog', async ({ page }) => {
  await blank(page, '<sl-dialog id="d" label="Title" hidden>Content</sl-dialog>');
  await page.evaluate(() => document.getElementById('d').show());
  await expect(panel(page)).toBeVisible();
});

test('upstream quirk: removing an open dialog releases the trap, lock and Escape handling but leaves open true; adding it back does not restore them', async ({ page }) => {
  await blank(page, '<sl-dialog id="d" label="Title">Content</sl-dialog>');
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
    return { shown, removed, back: [el.open, lock(), el.modal.isActive(), el.dialog.hidden] };
  });
  expect(r).toEqual({ shown: [true, true], removed: [true, false, false], back: [true, false, false, false] });
  // The Escape handling is released too: Escape requests nothing and the dialog stays open.
  await recordKeys(page);
  await pressReceived(page, page, 'Escape');
  await settled(page);
  expect(await page.evaluate(() => [window.requests, document.getElementById('d').open])).toEqual([0, true]);
});

test('upstream quirk: an empty label renders a U+FEFF title, so the panel has no usable accessible name', async ({ page }) => {
  await blank(page, '<sl-dialog id="d">Content</sl-dialog>');
  await page.evaluate(() => document.getElementById('d').show());
  expect(await page.evaluate(() => document.getElementById('d').shadowRoot.querySelector('slot[name="label"]').textContent)).toBe(' \uFEFF ');
  await expect(panel(page)).toHaveAccessibleName(/^\s*\uFEFF?\s*$/);
});

test('inherited core ready event: dispatched once on the element after the first update (the base already hidden), not bubbling or composed', async ({ page }) => {
  await blank(page);
  const r = await page.evaluate(async () => {
    const el = document.createElement('sl-dialog');
    const seen = [];
    let bubbled = 0;
    el.addEventListener('ready', event => seen.push({ bubbles: event.bubbles, composed: event.composed, baseHidden: el.dialog.hidden }));
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

test('animation registry: Shoelace\'s five defaults; setAnimation changes one dialog only', async ({ page }) => {
  await blank(page, '<sl-dialog id="d" label="A">A</sl-dialog><sl-dialog id="e" label="B">B</sl-dialog>');
  const r = await page.evaluate(async () => {
    const { getAnimation, setAnimation } = window.registry;
    const d = document.getElementById('d');
    const names = ['dialog.show', 'dialog.hide', 'dialog.denyClose', 'dialog.overlay.show', 'dialog.overlay.hide'];
    const defaults = Object.fromEntries(names.map(n => [n, JSON.parse(JSON.stringify(getAnimation(d, n, { dir: 'ltr' })))]));
    window.calls = [];
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      window.calls.push([this.closest?.('sl-dialog')?.id ?? this.getRootNode().host.id, this.getAttribute('part'), options.duration]);
      return animate.call(this, keyframes, options);
    };
    setAnimation(d, 'dialog.show', { keyframes: [{ opacity: 0 }, { opacity: 1 }], options: { duration: 17 } });
    for (const el of [d, document.getElementById('e')]) { await el.show(); await el.hide(); }
    Element.prototype.animate = animate;
    return { defaults, calls: window.calls };
  });
  expect(r.defaults).toEqual({
    'dialog.show': { keyframes: [{ opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1 }], options: { duration: 250, easing: 'ease' } },
    'dialog.hide': { keyframes: [{ opacity: 1, scale: 1 }, { opacity: 0, scale: 0.8 }], options: { duration: 250, easing: 'ease' } },
    'dialog.denyClose': { keyframes: [{ scale: 1 }, { scale: 1.02 }, { scale: 1 }], options: { duration: 250 } },
    'dialog.overlay.show': { keyframes: [{ opacity: 0 }, { opacity: 1 }], options: { duration: 250 } },
    'dialog.overlay.hide': { keyframes: [{ opacity: 1 }, { opacity: 0 }], options: { duration: 250 } },
  });
  expect(r.calls).toEqual([
    ['d', 'panel', 17], ['d', 'overlay', 250], ['d', 'overlay', 250], ['d', 'panel', 250],
    ['e', 'panel', 250], ['e', 'overlay', 250], ['e', 'overlay', 250], ['e', 'panel', 250],
  ]);
});

test.describe('internal modal modules', () => {
  test('tabbable: the boundary and list of tabbable elements, through shadow roots and slots, skipping disabled, hidden and negative tabindex', async ({ page }) => {
    await gotoBlank(page, outDir);
    const r = await page.evaluate(async () => {
      const { getTabbableElements, getTabbableBoundary } = await import('/tabbable.js');
      document.body.innerHTML = `<div id="root"><button id="a">A</button><button id="x" disabled>X</button><input id="h" type="hidden">
        <span id="n" tabindex="-1">N</span><div id="s"></div><a id="l" href="#">L</a><a id="nl">No href</a><div id="hide" hidden><button>Hidden</button></div>
        <textarea id="t"></textarea></div>`;
      const host = document.getElementById('s');
      host.attachShadow({ mode: 'open' }).innerHTML = '<button id="inner">Inner</button><slot></slot>';
      const slotted = document.createElement('button');
      slotted.id = 'slotted';
      host.append(slotted);
      const root = document.getElementById('root');
      const ids = list => list.map(el => el.id);
      const { start, end } = getTabbableBoundary(root);
      return { all: ids(getTabbableElements(root)), boundary: [start?.id, end?.id] };
    });
    // Upstream quirk: an <a> without href ("nl") is listed, as Shoelace's helper lists it.
    expect(r).toEqual({ all: ['a', 'inner', 'slotted', 'l', 'nl', 't'], boundary: ['a', 't'] });
  });

  test('active-elements: the deepest active element through shadow roots, and every active element on the way', async ({ page }) => {
    await gotoBlank(page, outDir);
    const r = await page.evaluate(async () => {
      const { activeElements, getDeepestActiveElement } = await import('/active.js');
      document.body.innerHTML = '<div id="host"></div>';
      const host = document.getElementById('host');
      host.attachShadow({ mode: 'open' }).innerHTML = '<button id="inner">Inner</button>';
      host.shadowRoot.getElementById('inner').focus();
      return { deepest: getDeepestActiveElement().id, chain: [...activeElements()].map(el => el.id) };
    });
    expect(r).toEqual({ deepest: 'inner', chain: ['host', 'inner'] });
  });

  test('scroll: the lock is counted per element; it adds sl-scroll-lock and the scrollbar size, and is removed with the last one', async ({ page }) => {
    await gotoBlank(page, outDir);
    const r = await page.evaluate(async () => {
      const { lockBodyScrolling, unlockBodyScrolling } = await import('/scroll.js');
      const html = document.documentElement;
      const [a, b] = [document.createElement('div'), document.createElement('div')];
      const state = () => [html.classList.contains('sl-scroll-lock'), html.style.getPropertyValue('--sl-scroll-lock-size') !== ''];
      lockBodyScrolling(a);
      lockBodyScrolling(a);
      lockBodyScrolling(b);
      const locked = state();
      unlockBodyScrolling(a);
      const one = state();
      unlockBodyScrolling(b);
      return { locked, one, none: state() };
    });
    expect(r).toEqual({ locked: [true, true], one: [true, true], none: [false, false] });
  });

  test('modal: Tab wraps inside the active modal only; activateExternal suspends the trap until deactivateExternal; the newest modal is the active one', async ({ page }) => {
    await gotoBlank(page, outDir);
    await page.evaluate(async () => {
      const { default: Modal } = await import('/modal.js');
      document.body.innerHTML = '<button id="out">Out</button><div id="m1"><button id="a">A</button><button id="b">B</button></div><div id="m2"><button id="c">C</button></div>';
      window.m1 = new Modal(document.getElementById('m1'));
      window.m2 = new Modal(document.getElementById('m2'));
      window.m1.activate();
      document.getElementById('a').focus();
    });
    const active = () => page.evaluate(() => document.activeElement.id);
    await page.keyboard.press('Tab');
    await expect.poll(() => active()).toBe('b');
    await page.keyboard.press('Tab');
    await expect.poll(() => active()).toBe('a');
    await page.keyboard.press('Shift+Tab');
    await expect.poll(() => active()).toBe('b');
    expect(await page.evaluate(() => { window.m2.activate(); return [window.m1.isActive(), window.m2.isActive()]; })).toEqual([false, true]);
    await page.evaluate(() => document.getElementById('c').focus());
    await page.keyboard.press('Tab');
    await expect.poll(() => active()).toBe('c');
    await page.evaluate(() => { window.m2.deactivate(); window.m1.activateExternal(); document.getElementById('out').focus(); });
    expect(await active()).toBe('out');
    await page.evaluate(() => { window.m1.deactivateExternal(); document.getElementById('b').focus(); });
    await page.keyboard.press('Tab');
    await expect.poll(() => active()).toBe('a');
    await page.evaluate(() => window.m1.deactivate());
  });

  test('blurActiveElement blurs the active element only when it is inside the given element', async ({ page }) => {
    await gotoBlank(page, outDir);
    const r = await page.evaluate(async () => {
      const { blurActiveElement } = await import('/blur.js');
      document.body.innerHTML = '<div id="in"><button id="a">A</button></div><button id="b">B</button>';
      document.getElementById('b').focus();
      blurActiveElement(document.getElementById('in'));
      const outside = document.activeElement.id;
      document.getElementById('a').focus();
      blurActiveElement(document.getElementById('in'));
      return { outside, inside: document.activeElement === document.body };
    });
    expect(r).toEqual({ outside: 'b', inside: true });
  });
});

test('every docs example renders in its own document and opens and closes with its buttons', async ({ page }) => {
  await openDocs(page, PAGE);
  await documentsLoaded(page);
  const titles = await page.locator('iframe.example').evaluateAll(frames => frames.map(f => f.title));
  expect(titles).toEqual(EXAMPLES.map(([t]) => `Dialog example: ${t}`));
  for (const [title] of EXAMPLES) {
    // The open dialog is fixed in its frame, which the browser does not scroll into view for it; the frame is.
    await page.locator(`iframe.example[title="Dialog example: ${title}"]`).scrollIntoViewIfNeeded();
    const frame = frameFor(page, title);
    const dialog = frame.locator('sl-dialog');
    await dialog.evaluate(async el => { await customElements.whenDefined('sl-dialog'); await el.updateComplete; });
    await frame.locator('body > sl-button').click();
    await expect.poll(() => dialog.evaluate(el => el.open), title).toBe(true);
    await expect(dialog.locator('.dialog__panel')).toBeVisible();
    await dialog.evaluate(el => new Promise(resolve => el.open ? setTimeout(resolve, 350) : resolve()));
    await frame.locator('sl-dialog > sl-button[slot="footer"]').click();
    await expect.poll(() => dialog.evaluate(el => el.open), title).toBe(false);
    // The hide ends by focusing the trigger again (in a timeout queued just before sl-after-hide), which scrolls the page
    // to this frame; wait for the hide to finish and that timeout to run before moving on. Whether the click made the
    // button the trigger is the engine's choice, so focus itself is not asserted here.
    await expect.poll(() => dialog.evaluate(el => el.dialog.hidden), title).toBe(true);
    await dialog.evaluate(() => new Promise(resolve => setTimeout(resolve, 50)));
  }
});

test('Customizing Initial Focus example: the autofocus input takes focus', async ({ page }) => {
  const { frame } = await openExample(page, 'Customizing Initial Focus');
  await frame.locator('body > sl-button').click();
  await expect.poll(() => frame.locator('sl-input').evaluate(el => document.activeElement === el)).toBe(true);
});

test('Preventing the Dialog from Closing example: an overlay click is denied; the close button closes', async ({ page }) => {
  const { frame } = await openExample(page, 'Preventing the Dialog from Closing');
  await page.locator('iframe.example[title="Dialog example: Preventing the Dialog from Closing"]').scrollIntoViewIfNeeded();
  const dialog = frame.locator('sl-dialog');
  await frame.locator('body > sl-button').click();
  await expect.poll(() => dialog.evaluate(el => el.open)).toBe(true);
  await dialog.evaluate(el => new Promise(resolve => setTimeout(resolve, 350)));
  await dialog.evaluate(el => el.overlay.click());
  await dialog.evaluate(() => new Promise(resolve => setTimeout(resolve, 350)));
  expect(await dialog.evaluate(el => el.open)).toBe(true);
  await dialog.locator('[part="close-button"]').click();
  await expect.poll(() => dialog.evaluate(el => el.open)).toBe(false);
});

test('no upstream Shoelace runtime is requested or defined; all requests stay on the local origin', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  await documentsLoaded(page);
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  expect(await frame.locator('body').evaluate(() => Boolean(window.Shoelace || document.querySelector('script[src*="shoelace"]')))).toBe(false);
});

test.describe('React', () => {
  const mount = reactWrapperPage(test);

  test('the wrapper passes label and open (set after the first render) and takes onSlShow, onSlAfterShow, onSlRequestClose, onSlHide and onSlAfterHide', async ({ page }) => {
    const errors = await mount(page);
    await page.evaluate(() => {
      window.reactEvents = [];
      const log = type => event => window.reactEvents.push([type, event.detail?.source ?? null]);
      window.props = open => ({ label: 'React', open, onSlShow: log('show'), onSlAfterShow: log('after-show'), onSlRequestClose: log('request-close'),
        onSlHide: log('hide'), onSlAfterHide: log('after-hide'), onSlInitialFocus: log('initial-focus') });
      window.renderWrapper('VelcroDialog', window.props(false), 'Content');
    });
    await page.evaluate(() => document.getElementById('wrapped').updateComplete);
    await page.evaluate(() => window.renderWrapper('VelcroDialog', window.props(true), 'Content'));
    const el = page.locator('#wrapped');
    await expect.poll(() => page.evaluate(() => window.reactEvents.map(e => e[0])).then(list => showOrder(list, 'initial-focus', 'show'))).toEqual(['show', 'initial-focus', 'after-show']);
    expect(await el.evaluate(e => [e.localName, e.label, e.open])).toEqual(['sl-dialog', 'React', true]);
    await el.locator('[part="close-button"]').click();
    await expect.poll(() => page.evaluate(() => window.reactEvents.slice(3))).toEqual([['request-close', 'close-button'], ['hide', null], ['after-hide', null]]);
    expect(await page.evaluate(() => window.errors)).toEqual([]);
    expect(errors).toEqual([]);
  });

  // Shoelace's React examples, ported in packages/docs/examples/dialog/react/*.jsx (the files the docs page shows), bundled
  // with React 19 and the generated wrappers, resolved through the package's real export map. Each one opens with its
  // button and closes with its footer button.
  test('every React example renders, opens and closes like its HTML example', async ({ page }) => {
    test.setTimeout(120_000);
    const reactDir = path.join(docsDir, 'examples/dialog/react');
    const fromVelcro = createRequire(path.join(velcroDir, 'package.json'));
    const fromDocs = createRequire(path.join(docsDir, 'package.json'));
    const pkgDir = name => path.dirname(fromVelcro.resolve(`${name}/package.json`));
    const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
    const dir = mkdtempSync(path.join(tmpdir(), 'velcro-dialog-react-'));
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
    for (const [, name] of EXAMPLES) {
      await page.evaluate(n => window.renderExample(n), name);
      const dialog = page.locator('sl-dialog');
      await dialog.evaluate(async el => { await customElements.whenDefined('sl-dialog'); await el.updateComplete; });
      expect(await dialog.evaluate(el => [el.label, el.open]), name).toEqual(['Dialog', false]);
      await page.locator('body sl-button:not([slot])').last().click();
      await expect.poll(() => dialog.evaluate(el => el.open), name).toBe(true);
      await expect(dialog.locator('.dialog__panel'), name).toBeVisible();
      // Velcro's input wrapper sets autofocus as the input's property, which does not add the attribute the dialog looks
      // for, so the React version focuses the panel (the HTML version focuses the input). Listed on the docs page.
      if (name === 'focus') {
        expect(await page.evaluate(() => [document.querySelector('sl-input').autofocus, document.querySelector('sl-input').hasAttribute('autofocus')])).toEqual([true, false]);
        await expect.poll(() => page.evaluate(() => document.activeElement?.shadowRoot?.activeElement?.className)).toBe('dialog__panel');
      }
      if (name === 'custom-width') expect(await dialog.evaluate(el => getComputedStyle(el).getPropertyValue('--width').trim())).toBe('50vw');
      await dialog.evaluate(() => new Promise(resolve => setTimeout(resolve, 350)));
      await page.locator('sl-dialog > sl-button[slot="footer"]').click();
      await expect.poll(() => dialog.evaluate(el => el.open), name).toBe(false);
    }
    expect(await page.evaluate(() => window.errors)).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
