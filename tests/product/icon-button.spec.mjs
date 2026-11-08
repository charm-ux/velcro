import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { documentsLoaded, watchNetwork } from './support/loaded.mjs';
import { reactWrapperPage } from './support/react.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/icon-button';
// Shoelace 2.20.1's icon button page has six examples, in this order. The tooltip one needs sl-tooltip, which Velcro lacks, so it is
// source only (no iframe, no React version); the other five are live and each has a React version.
const ORDER = [['basic', 'Default'], ['sizes', 'Sizes'], ['colors', 'Colors'], ['link-buttons', 'Link Buttons'], ['tooltip', 'Icon Button with Tooltip'], ['disabled', 'Disabled']];
const SECTIONS = ORDER.filter(([id]) => id !== 'tooltip').map(([, section]) => section);
const title = section => `Icon Button example: ${section}`;
const docsDir = fileURLToPath(new URL('../../packages/docs/', import.meta.url));
const velcroDir = fileURLToPath(new URL('../../packages/velcro/', import.meta.url));

async function openPage(page) {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  // Litro's client router remounts the page component once after load, which reloads the iframes; wait for it to settle.
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  await expect(page.locator('litro-outlet')).toHaveAttribute('data-litro-settled', '');
  const frame = page.frameLocator(`iframe.example[title="${title('Default')}"]`);
  await expect(frame.locator('sl-icon-button').first()).toBeVisible();
  await frame.locator('body').evaluate(() => customElements.whenDefined('sl-icon-button'));
  await documentsLoaded(page);
  return { frame, requests, example: section => page.frameLocator(`iframe.example[title="${title(section)}"]`) };
}

// Appends markup to the example document and waits for every sl-icon-button in it to render.
async function mount(frame, markup) {
  await frame.locator('body').evaluate(async (body, markup) => {
    const host = document.createElement('div');
    host.className = 'mount';
    host.innerHTML = markup;
    body.append(host);
    await Promise.all([...host.querySelectorAll('sl-icon-button')].map(el => el.updateComplete));
  }, markup);
}

test('docs page is prerendered with Velcro branding, prototype status, every Shoelace section, the quirks and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Icon Button - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('without changing the shared core prefix');
  for (const section of SECTIONS) expect(html).toContain(`title="${title(section)}"`);
  // The six sections are all there, in Shoelace's order (before the API tables), each with its intro text.
  const examplesPart = html.slice(html.indexOf('id="examples"'), html.indexOf('id="attributes"'));
  expect([...examplesPart.matchAll(/<h3 id="([^"]+)"><!--lit-part-->([^<]+)<!--\/lit-part--><\/h3>/g)].map(m => [m[1], m[2]])).toEqual(ORDER);
  expect(examplesPart).toContain('Use the <code>disabled</code> attribute to disable the icon button.');
  expect(examplesPart).toContain('Use the <code>href</code> attribute to convert the button to a link.');
  expect(examplesPart).toContain("inherit their parent element's <code>font-size</code>");
  // The tooltip example needs sl-tooltip, which Velcro lacks: source only, no iframe and no React version.
  expect(html).toContain('id="tooltip"');
  expect(html).toContain('Velcro has no <code>sl-tooltip</code> yet');
  expect(html).not.toContain(`title="${title('Icon Button with Tooltip')}"`);
  expect(html).toContain('&lt;sl-tooltip content=&quot;Settings&quot;&gt;');
  expect(html).toContain('does not hide the icon button');
  expect(html).toContain('throws a TypeError');
  expect(html).toContain('HTMLLinkElement');
  expect(html).toContain('was run locally in Chromium and WebKit only, and Firefox is covered only by the project&#39;s CI run');
  expect(html).toContain('Playwright&#39;s ARIA snapshot');
  // The API tables: Shoelace's members, plus the core ready event labelled as inherited.
  expect(html).toContain('Inherited from core');
  for (const name of ['name', 'library', 'src', 'href', 'target', 'download', 'label', 'disabled', 'click', 'focus', 'blur', 'sl-focus', 'sl-blur', 'base']) {
    expect(html).toContain(`data-name="${name}"`);
  }
  expect(html.match(/<summary>React<\/summary>/g)).toHaveLength(SECTIONS.length);
  expect(html).toContain('&lt;sl-icon-button name=&quot;gear&quot; label=&quot;Settings&quot; disabled&gt;&lt;/sl-icon-button&gt;');
  expect(html).toContain('const App = () =&gt; &lt;SlIconButton name=&quot;gear&quot; label=&quot;Settings&quot; disabled /&gt;;');
  expect(html).toContain('import { VelcroIconButton as SlIconButton } from &#39;@charm-ux/velcro/react/VelcroIconButton.js&#39;;');
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
  const home = await (await request.get('/')).text();
  expect(home).toContain('/components/icon-button');
});

test('sl-icon-button registers inside the example document as the exported class, with sl-icon, no core marker and no ch-* definitions', async ({ page }) => {
  const { frame, requests } = await openPage(page);
  const info = await frame.locator('body').evaluate(() => {
    const ctor = customElements.get('sl-icon-button');
    const el = document.querySelector('sl-icon-button');
    return {
      baseName: ctor?.baseName,
      coreTag: customElements.get('ch-icon-button') !== undefined,
      viaConstructor: ctor ? new ctor().localName : null,
      instance: el instanceof ctor,
      icon: customElements.get('sl-icon')?.baseName,
      attrs: el.getAttributeNames().sort(),
    };
  });
  expect(info).toEqual({ baseName: 'icon-button', coreTag: false, viaConstructor: 'sl-icon-button', instance: true, icon: 'icon', attrs: ['id', 'label', 'name'] });
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
});

test('default: a base part that is a native button around the aria-hidden gear sl-icon', async ({ page }) => {
  const { frame } = await openPage(page);
  const r = await frame.locator('#demo-default').evaluate(async el => {
    const icon = el.shadowRoot.querySelector('sl-icon');
    await icon.updateComplete;
    const base = el.shadowRoot.querySelector('[part="base"]');
    return {
      children: [...el.shadowRoot.children].filter(n => n.localName !== 'style').map(n => `${n.localName}:${n.getAttribute('part')}`),
      attrs: Object.fromEntries(base.getAttributeNames().map(n => [n, n === 'class' ? [...base.classList].join(' ') : base.getAttribute(n)])),
      icon: Object.fromEntries(icon.getAttributeNames().map(n => [n, icon.getAttribute(n)])),
      drawn: Boolean(icon.shadowRoot.querySelector('svg')),
      anchors: el.shadowRoot.querySelectorAll('a').length,
      button: el.button === base,
    };
  });
  expect(r).toEqual({
    children: ['button:base'],
    attrs: { part: 'base', class: 'icon-button', type: 'button', role: 'button', 'aria-disabled': 'false', 'aria-label': 'Settings', tabindex: '0' },
    // sl-icon reflects its own library, which defaults to 'default'.
    icon: { class: 'icon-button__icon', name: 'gear', library: 'default', 'aria-hidden': 'true' },
    drawn: true, anchors: 0, button: true,
  });
});

test('computed styles match Shoelace: inline-block host, a padded flex button drawn from the theme tokens, sized by the inherited font-size', async ({ page }) => {
  const { frame, example } = await openPage(page);
  const read = el => {
    const base = el.shadowRoot.querySelector('[part="base"]');
    const cs = getComputedStyle(base);
    const box = el.getBoundingClientRect();
    const icon = el.shadowRoot.querySelector('sl-icon').getBoundingClientRect();
    return {
      host: [getComputedStyle(el).display, getComputedStyle(el).color],
      base: {
        display: cs.display, alignItems: cs.alignItems, flex: cs.flexGrow + cs.flexShrink + cs.flexBasis, background: cs.backgroundColor,
        borderWidth: cs.borderTopWidth, radius: cs.borderTopLeftRadius, padding: cs.paddingTop + ' ' + cs.paddingLeft, color: cs.color,
        cursor: cs.cursor, fontSize: cs.fontSize, transition: cs.transitionProperty + ' ' + cs.transitionDuration, opacity: cs.opacity,
      },
      box: [box.width, box.height], icon: [icon.width, icon.height],
    };
  };
  const probe = await frame.locator('body').evaluate(() => {
    const p = document.createElement('div');
    p.style.cssText = 'color: var(--sl-color-neutral-600); border-radius: var(--sl-border-radius-medium); padding: var(--sl-spacing-x-small); transition: var(--sl-transition-x-fast) color';
    document.body.append(p);
    const cs = getComputedStyle(p);
    const out = { color: cs.color, radius: cs.borderTopLeftRadius, padding: cs.paddingTop, duration: cs.transitionDuration };
    p.remove();
    return out;
  });
  const normal = await frame.locator('#demo-default').evaluate(read);
  expect(normal.host).toEqual(['inline-block', probe.color]);
  expect(normal.base).toEqual({
    display: 'flex', alignItems: 'center', flex: '00auto', background: 'rgba(0, 0, 0, 0)', borderWidth: '0px',
    radius: probe.radius, padding: `${probe.padding} ${probe.padding}`, color: probe.color, cursor: 'pointer', fontSize: '16px',
    transition: `color ${probe.duration}`, opacity: '1',
  });
  // flex: 0 0 auto is the `flex` value above (grow, shrink and basis concatenated).
  expect(probe.duration).toBe('0.05s');
  expect(probe.padding).toBe('8px');
  // A 16px icon in 8px of padding on every side.
  expect(normal.icon).toEqual([16, 16]);
  expect(normal.box).toEqual([32, 32]);
  // The Sizes example: the icon scales with the parent's font-size, the padding does not.
  const sizes = await example('Sizes').locator('sl-icon-button').evaluateAll((els, source) => els.map(el => new Function(`return (${source})`)()(el)), read.toString());
  expect(sizes.map(s => [s.icon[0], s.box[0], s.base.fontSize])).toEqual([[24, 40, '24px'], [32, 48, '32px'], [40, 56, '40px']]);
});

test('the theme tokens drive the icon button: overriding them on the host changes the color, the padding and the radius', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-icon-button id="t" name="gear" label="Settings" style="--sl-color-neutral-600: rgb(255, 0, 0); --sl-border-radius-medium: 9px; --sl-spacing-x-small: 3px"></sl-icon-button>');
  const r = await frame.locator('#t').evaluate(el => {
    const cs = getComputedStyle(el.shadowRoot.querySelector('[part="base"]'));
    return { color: cs.color, radius: cs.borderTopLeftRadius, padding: cs.paddingTop, box: el.getBoundingClientRect().width };
  });
  expect(r).toEqual({ color: 'rgb(255, 0, 0)', radius: '9px', padding: '3px', box: 22 });
});

test('hover and focus-visible take the primary color and the focus ring, active the darker primary; the colors are Shoelace\'s tokens', async ({ page }) => {
  const { frame } = await openPage(page);
  const want = await frame.locator('body').evaluate(() => {
    const p = document.createElement('div');
    p.style.cssText = 'color: var(--sl-color-primary-600); outline: var(--sl-focus-ring); outline-offset: var(--sl-focus-ring-offset); background: var(--sl-color-primary-700)';
    document.body.append(p);
    const cs = getComputedStyle(p);
    const out = { hover: cs.color, active: cs.backgroundColor, ring: [cs.outlineStyle, cs.outlineWidth, cs.outlineColor, cs.outlineOffset] };
    p.remove();
    return out;
  });
  const el = frame.locator('#demo-default');
  const colors = () => el.evaluate(e => getComputedStyle(e.shadowRoot.querySelector('[part="base"]')).color);
  const neutral = await colors();
  const box = await el.boundingBox();
  await el.hover();
  await expect.poll(colors).toBe(want.hover);
  await el.page().mouse.down();
  await expect.poll(colors).toBe(want.active);
  await el.page().mouse.up();
  await el.page().mouse.move(0, 0);
  await expect.poll(colors).toBe(neutral);
  expect(box.width).toBe(32);
  // Keyboard focus: the primary color and the ring, with the browser's own outline removed on plain :focus. A real Tab from
  // the button before it, because engines differ on whether a script's focus() counts as keyboard modality.
  await mount(frame, '<div id="tab"><button id="before">before</button><sl-icon-button id="after" name="gear" label="After"></sl-icon-button></div>');
  const after = frame.locator('#after');
  await frame.locator('#before').focus();
  await el.page().keyboard.press('Tab');
  expect(await after.evaluate(e => e.shadowRoot.activeElement === e.button)).toBe(true);
  const afterColor = () => after.evaluate(e => getComputedStyle(e.shadowRoot.querySelector('[part="base"]')).color);
  await expect.poll(afterColor).toBe(want.hover);
  const ring = await after.evaluate(e => {
    const cs = getComputedStyle(e.shadowRoot.querySelector('[part="base"]'));
    return [cs.outlineStyle, cs.outlineWidth, cs.outlineColor, cs.outlineOffset];
  });
  expect(ring).toEqual(want.ring);
  expect(want.ring[0]).toBe('solid');
});

test('the disabled button: native disabled, half opacity, not-allowed cursor, no hover color, no click from the pointer or click()', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<div id="d"><sl-icon-button name="gear" label="Settings" disabled></sl-icon-button></div>');
  const el = frame.locator('#d sl-icon-button');
  await el.evaluate(e => {
    window.clicks = 0;
    e.addEventListener('click', () => window.clicks++);
    window.rootClicks = 0;
    document.addEventListener('click', () => window.rootClicks++);
  });
  const r = await el.evaluate(e => {
    const base = e.shadowRoot.querySelector('[part="base"]');
    const cs = getComputedStyle(base);
    return {
      attrs: Object.fromEntries(base.getAttributeNames().map(n => [n, n === 'class' ? [...base.classList].join(' ') : base.getAttribute(n)])), disabled: base.disabled,
      opacity: cs.opacity, cursor: cs.cursor, reflected: e.getAttribute('disabled'),
    };
  });
  expect(r).toEqual({
    attrs: { part: 'base', class: 'icon-button icon-button--disabled', type: 'button', role: 'button', 'aria-disabled': 'true', 'aria-label': 'Settings', tabindex: '-1', disabled: '' },
    disabled: true, opacity: '0.5', cursor: 'not-allowed', reflected: '',
  });
  const color = () => el.evaluate(e => getComputedStyle(e.shadowRoot.querySelector('[part="base"]')).color);
  const before = await color();
  const box = await el.boundingBox();
  const page2 = el.page();
  await page2.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page2.mouse.down();
  await page2.mouse.up();
  await el.evaluate(e => e.click());
  await expect.poll(color).toBe(before);
  expect(await el.evaluate(() => [window.clicks, window.rootClicks])).toEqual([0, 0]);
});

test('click(): the inner button is clicked once, so the click is retargeted to the host, bubbles and is composed', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<div id="c"><sl-icon-button name="gear" label="Settings"></sl-icon-button></div>');
  const r = await frame.locator('#c').evaluate(async wrap => {
    const el = wrap.querySelector('sl-icon-button');
    const seen = [];
    wrap.addEventListener('click', e => seen.push({ target: e.target === el, composed: e.composed, bubbles: e.bubbles, trusted: e.isTrusted }));
    el.click();
    // Enter and Space on the focused inner button also click it (real key presses are in the next test).
    return seen;
  });
  expect(r).toEqual([{ target: true, composed: true, bubbles: true, trusted: false }]);
});

test('keyboard: Enter and Space on the focused button click it; a pointer click clicks it once', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<div id="k"><sl-icon-button name="gear" label="Settings"></sl-icon-button></div>');
  const el = frame.locator('#k sl-icon-button');
  await el.evaluate(e => { window.kc = 0; e.addEventListener('click', () => window.kc++); e.focus(); });
  await el.page().keyboard.press('Enter');
  await el.page().keyboard.press('Space');
  await expect.poll(() => el.evaluate(() => window.kc)).toBe(2);
  await el.click();
  expect(await el.evaluate(() => window.kc)).toBe(3);
});

test('focus(), blur() and sl-focus / sl-blur: the inner button is focused, the events bubble, are composed and uncancelable with an empty detail', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<div id="f"><sl-icon-button name="gear" label="Settings"></sl-icon-button></div>');
  const r = await frame.locator('#f').evaluate(async wrap => {
    const el = wrap.querySelector('sl-icon-button');
    const log = [];
    const record = e => log.push({ type: e.type, target: e.target === el, bubbles: e.bubbles, composed: e.composed, cancelable: e.cancelable, detail: e.detail, ctor: e.constructor.name });
    wrap.addEventListener('sl-focus', record);
    wrap.addEventListener('sl-blur', record);
    const state = () => [document.activeElement === el, el.shadowRoot.activeElement === el.button, [...el.button.classList].join(' ')];
    const initial = state();
    el.focus();
    await el.updateComplete;
    const focused = state();
    el.blur();
    await el.updateComplete;
    const blurred = state();
    // The options pass straight to the inner button.
    let received;
    const nativeFocus = el.button.focus;
    el.button.focus = options => { received = options; nativeFocus.call(el.button); };
    el.focus({ preventScroll: true });
    el.button.focus = nativeFocus;
    await el.updateComplete;
    return { initial, focused, blurred, received, log };
  });
  expect(r.initial).toEqual([false, false, 'icon-button']);
  expect(r.focused).toEqual([true, true, 'icon-button icon-button--focused']);
  expect(r.blurred).toEqual([false, false, 'icon-button']);
  expect(r.received).toEqual({ preventScroll: true });
  const base = { target: true, bubbles: true, composed: true, cancelable: false, detail: {}, ctor: 'CustomEvent' };
  expect(r.log).toEqual([{ type: 'sl-focus', ...base }, { type: 'sl-blur', ...base }, { type: 'sl-focus', ...base }]);
});

test('link buttons example: an anchor with the href, target, noreferrer noopener rel and label; no request until it is clicked', async ({ page }) => {
  const { example, requests } = await openPage(page);
  const frame = example('Link Buttons');
  await expect(frame.locator('sl-icon-button')).toBeVisible();
  const r = await frame.locator('sl-icon-button').evaluate(el => {
    const a = el.shadowRoot.querySelector('[part="base"]');
    return {
      tag: a.localName, attrs: Object.fromEntries(a.getAttributeNames().map(n => [n, n === 'class' ? [...a.classList].join(' ') : a.getAttribute(n)])),
      href: a.href, buttons: el.shadowRoot.querySelectorAll('button').length, button: el.button === a,
    };
  });
  expect(r).toEqual({
    tag: 'a',
    attrs: { part: 'base', class: 'icon-button', href: 'https://example.com', target: '_blank', rel: 'noreferrer noopener', 'aria-disabled': 'false', 'aria-label': 'Settings', tabindex: '0' },
    href: 'https://example.com/', buttons: 0, button: true,
  });
  expect(requests.some(url => url.startsWith('https://example.com'))).toBe(false);
});

test('links: rel only with a target; download is written as set; an enabled link click is left alone; a disabled link click is cancelled and stopped', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, `<div id="l">
    <sl-icon-button id="plain" name="gear" label="Plain" href="#plain"></sl-icon-button>
    <sl-icon-button id="dl" name="gear" label="Download" href="data:text/plain,hi" download="hi.txt"></sl-icon-button>
    <sl-icon-button id="off" name="gear" label="Off" href="#off" disabled></sl-icon-button>
    <sl-icon-button id="tgt" name="gear" label="Target" href="#tgt" target="_self"></sl-icon-button>
  </div>`);
  const attrs = id => frame.locator(id).evaluate(el => {
    const a = el.shadowRoot.querySelector('[part="base"]');
    return Object.fromEntries(a.getAttributeNames().filter(n => n !== 'part').map(n => [n, n === 'class' ? [...a.classList].join(' ') : a.getAttribute(n)]));
  });
  expect(await attrs('#plain')).toEqual({ class: 'icon-button', href: '#plain', 'aria-disabled': 'false', 'aria-label': 'Plain', tabindex: '0' });
  expect(await attrs('#dl')).toEqual({ class: 'icon-button', href: 'data:text/plain,hi', download: 'hi.txt', 'aria-disabled': 'false', 'aria-label': 'Download', tabindex: '0' });
  expect(await attrs('#tgt')).toMatchObject({ target: '_self', rel: 'noreferrer noopener' });
  // Upstream quirk: the disabled link keeps its href and is an anchor: it gets aria-disabled and tabindex -1, but neither the
  // disabled attribute nor the icon-button--disabled class, so it is not drawn as disabled.
  expect(await attrs('#off')).toEqual({ class: 'icon-button', href: '#off', 'aria-disabled': 'true', 'aria-label': 'Off', tabindex: '-1' });
  expect(await frame.locator('#off').evaluate(el => {
    const a = el.shadowRoot.querySelector('[part="base"]');
    const cs = getComputedStyle(a);
    return [a.localName, 'disabled' in a, cs.opacity, cs.cursor];
  })).toEqual(['a', false, '1', 'pointer']);
  // Each anchor gets a listener after the component's own, which records what the component did to the click and then cancels
  // it, so no navigation happens (a hash change in a srcdoc frame reloads it in some engines). The hosts count their clicks.
  await frame.locator('body').evaluate(() => {
    window.counts = { plain: 0, off: 0 };
    window.seen = [];
    for (const id of ['plain', 'off']) {
      const host = document.getElementById(id);
      host.addEventListener('click', () => window.counts[id]++);
      host.shadowRoot.querySelector('a').addEventListener('click', e => { window.seen.push([id, e.defaultPrevented, e.cancelBubble]); e.preventDefault(); });
    }
  });
  await frame.locator('#plain').click();
  const box = await frame.locator('#off').boundingBox();
  await frame.locator('#off').page().mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await frame.locator('#off').evaluate(el => el.click());
  // The disabled link's click is cancelled and stopped at the anchor (the enabled one's is neither): its host never sees it.
  expect(await frame.locator('body').evaluate(() => [window.counts, window.seen])).toEqual([
    { plain: 1, off: 0 }, [['plain', false, false], ['off', true, true], ['off', true, true]],
  ]);
  // Upstream quirk: a disabled link still takes the hover color, as the :not(.icon-button--disabled) guard sees no such class.
  const primary = await frame.locator('body').evaluate(() => {
    const p = document.createElement('div');
    p.style.color = 'var(--sl-color-primary-600)';
    document.body.append(p);
    const color = getComputedStyle(p).color;
    p.remove();
    return color;
  });
  await frame.locator('#off').hover();
  await expect.poll(() => frame.locator('#off').evaluate(el => getComputedStyle(el.shadowRoot.querySelector('[part="base"]')).color)).toBe(primary);
  // Upstream quirk: a disabled link is still an anchor that script can focus.
  const focused = await frame.locator('#off').evaluate(async el => {
    // The earlier pointer click may have focused it already.
    el.blur();
    const events = [];
    el.addEventListener('sl-focus', () => events.push('sl-focus'));
    el.focus();
    return [el.shadowRoot.activeElement === el.button, events];
  });
  expect(focused).toEqual([true, ['sl-focus']]);
});

test('disabled example: the host has disabled, the inner native button is disabled, half opacity, not-allowed cursor, and a button named Settings', async ({ page }) => {
  const { example } = await openPage(page);
  const frame = example('Disabled');
  const el = frame.locator('sl-icon-button');
  await expect(el).toBeVisible();
  const r = await el.evaluate(e => {
    const base = e.shadowRoot.querySelector('[part="base"]');
    const cs = getComputedStyle(base);
    return {
      host: [e.disabled, e.getAttribute('disabled')], base: [base.localName, base.disabled, base.getAttribute('aria-disabled'), base.getAttribute('tabindex'), base.getAttribute('aria-label')],
      look: [cs.opacity, cs.cursor], classes: [...base.classList].join(' '),
    };
  });
  expect(r).toEqual({
    host: [true, ''], base: ['button', true, 'true', '-1', 'Settings'], look: ['0.5', 'not-allowed'], classes: 'icon-button icon-button--disabled',
  });
  await expect(frame.locator('body')).toMatchAriaSnapshot('- button "Settings" [disabled]');
  // It cannot be focused or clicked by the pointer: the example's own button swallows both.
  await el.evaluate(e => { window.disabledClicks = 0; e.addEventListener('click', () => window.disabledClicks++); });
  const box = await el.boundingBox();
  await el.page().mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  expect(await el.evaluate(e => [window.disabledClicks, e.shadowRoot.activeElement])).toEqual([0, null]);
});

test('upstream quirk: the hidden attribute does not hide the icon button, because the host\'s own display: inline-block outranks the browser rule', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-icon-button id="h" hidden name="gear" label="Settings"></sl-icon-button>');
  const r = await frame.locator('#h').evaluate(el => {
    const before = { display: getComputedStyle(el).display, boxes: el.getClientRects().length, hidden: el.hidden };
    el.style.display = 'none';
    const withInline = getComputedStyle(el).display;
    el.style.display = '';
    // The shadow tree's own [hidden] rule applies to elements inside it, not to the host.
    const base = el.shadowRoot.querySelector('[part="base"]');
    base.hidden = true;
    const baseHidden = getComputedStyle(base).display;
    base.hidden = false;
    return { before, withInline, baseHidden };
  });
  expect(r).toEqual({ before: { display: 'inline-block', boxes: 1, hidden: true }, withInline: 'none', baseHidden: 'none' });
  await expect(frame.locator('#h')).toBeVisible();
});

test('upstream quirk: click(), focus() and blur() throw a TypeError until the first render has made the inner button', async ({ page }) => {
  const { frame } = await openPage(page);
  const r = await frame.locator('body').evaluate(async body => {
    const attempt = (el, method) => { try { el[method](); return 'ok'; } catch (e) { return e.constructor.name; } };
    const detached = document.createElement('sl-icon-button');
    const beforeConnect = ['click', 'focus', 'blur'].map(m => attempt(detached, m));
    body.append(detached);
    // Connected, but the first update has not run yet.
    const beforeRender = ['click', 'focus', 'blur'].map(m => attempt(detached, m));
    await detached.updateComplete;
    const afterRender = ['click', 'focus', 'blur'].map(m => attempt(detached, m));
    detached.remove();
    return { beforeConnect, beforeRender, afterRender };
  });
  expect(r).toEqual({ beforeConnect: ['TypeError', 'TypeError', 'TypeError'], beforeRender: ['TypeError', 'TypeError', 'TypeError'], afterRender: ['ok', 'ok', 'ok'] });
});

// Playwright's ARIA snapshot is computed by Playwright from the DOM (roles, names, aria-hidden, hidden and inert content),
// not read from the browser's native accessibility tree, and no screen reader is involved.
test('accessibility tree (Playwright ARIA snapshot): one named button or link per icon button; no label gives a button with an empty name (quirk)', async ({ page }) => {
  const { frame, example } = await openPage(page);
  await expect(frame.locator('body')).toMatchAriaSnapshot('- button "Settings"');
  await expect(example('Sizes').locator('body')).toMatchAriaSnapshot(`
    - button "Edit"
    - button "Edit"
    - button "Edit"
  `);
  await expect(example('Colors').locator('body')).toMatchAriaSnapshot(`
    - button "Bold"
    - button "Italic"
    - button "Underline"
  `);
  await expect(example('Link Buttons').locator('body')).toMatchAriaSnapshot('- link "Settings"');
  await mount(frame, '<div id="unnamed"><sl-icon-button name="gear"></sl-icon-button></div><div id="off"><sl-icon-button name="gear" label="Off" disabled></sl-icon-button></div><div id="removed"><sl-icon-button name="gear" label="Gone"></sl-icon-button></div>');
  expect(await frame.locator('#unnamed sl-icon-button').evaluate(el => el.shadowRoot.querySelector('[part="base"]').getAttribute('aria-label'))).toBe('');
  await expect(frame.locator('#unnamed sl-icon-button [part="base"]')).toHaveRole('button');
  await expect(frame.locator('#unnamed sl-icon-button [part="base"]')).toHaveAccessibleName('');
  await expect(frame.locator('#off')).toMatchAriaSnapshot('- button "Off" [disabled]');
  // The icon is aria-hidden, so it adds no name.
  await expect(frame.locator('#demo-default [part="base"]')).toHaveAccessibleName('Settings');
  // Removing the label attribute sets label to null, which the attribute binding writes as an empty string.
  const removed = await frame.locator('#removed sl-icon-button').evaluate(async el => {
    el.removeAttribute('label');
    await el.updateComplete;
    return [el.label, el.shadowRoot.querySelector('[part="base"]').getAttribute('aria-label')];
  });
  expect(removed).toEqual([null, '']);
  await expect(frame.locator('#removed sl-icon-button [part="base"]')).toHaveAccessibleName('');
});

test('icon attributes: name, library and src go to the inner sl-icon, which draws them; unset ones are not written', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, `<div id="ia">
    <sl-icon-button id="n" name="pencil" label="n"></sl-icon-button>
    <sl-icon-button id="s" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M0 0h16v16H0z'/%3E%3C/svg%3E" label="s"></sl-icon-button>
    <sl-icon-button id="lib" library="system" name="chevron-down" label="lib"></sl-icon-button>
  </div>`);
  const r = await frame.locator('#ia').evaluate(async wrap => {
    const out = {};
    for (const el of wrap.querySelectorAll('sl-icon-button')) {
      const icon = el.shadowRoot.querySelector('sl-icon');
      await icon.updateComplete;
      for (let i = 0; i < 50 && !icon.shadowRoot.querySelector('svg'); i++) await new Promise(resolve => setTimeout(resolve, 20));
      out[el.id] = { attrs: icon.getAttributeNames().sort(), drawn: Boolean(icon.shadowRoot.querySelector('svg')), props: [icon.name, icon.library, icon.src?.slice(0, 15)] };
    }
    // A later change reaches the icon.
    const el = wrap.querySelector('#n');
    el.name = 'gear';
    el.library = 'default';
    await el.updateComplete;
    out.changed = el.shadowRoot.querySelector('sl-icon').getAttribute('name') + el.shadowRoot.querySelector('sl-icon').getAttribute('library');
    el.name = undefined;
    await el.updateComplete;
    out.cleared = el.shadowRoot.querySelector('sl-icon').hasAttribute('name');
    return out;
  });
  // sl-icon reflects its own library (default), so it is written even though the icon button was given none.
  expect(r.n).toEqual({ attrs: ['aria-hidden', 'class', 'library', 'name'], drawn: true, props: ['pencil', 'default', undefined] });
  expect(r.s.attrs).toEqual(['aria-hidden', 'class', 'library', 'src']);
  expect(r.s.drawn).toBe(true);
  expect(r.lib).toEqual({ attrs: ['aria-hidden', 'class', 'library', 'name'], drawn: true, props: ['chevron-down', 'system', undefined] });
  expect(r.changed).toBe('geardefault');
  expect(r.cleared).toBe(false);
});

test('colors example: ::part(base) from the page sets the color, and its :hover and :active rules outrank the component\'s', async ({ page }) => {
  const { example } = await openPage(page);
  const frame = example('Colors');
  const first = frame.locator('sl-icon-button').first();
  const colors = () => first.evaluate(e => getComputedStyle(e.shadowRoot.querySelector('[part="base"]')).color);
  await expect(first).toBeVisible();
  expect(await colors()).toBe('rgb(176, 0, 145)');
  await first.hover();
  await expect.poll(colors).toBe('rgb(201, 19, 170)');
  await first.page().mouse.down();
  await expect.poll(colors).toBe('rgb(150, 0, 119)');
  await first.page().mouse.up();
  expect(await frame.locator('sl-icon-button').evaluateAll(els => els.map(e => e.label))).toEqual(['Bold', 'Italic', 'Underline']);
});

test('dir and lang are reactive, not reflected and undefined by default; the observed attributes are Shoelace\'s', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-icon-button id="dl"></sl-icon-button><sl-icon-button id="attrs" dir="rtl" lang="de"></sl-icon-button>');
  const r = await frame.locator('body').evaluate(async () => {
    const el = document.querySelector('#dl');
    const attrs = document.querySelector('#attrs');
    const ctor = customElements.get('sl-icon-button');
    const defaults = [el.dir, el.lang];
    el.dir = 'auto';
    const updateRequestedByDir = el.isUpdatePending;
    await el.updateComplete;
    el.lang = 'fr';
    const updateRequestedByLang = el.isUpdatePending;
    await el.updateComplete;
    const assigned = [el.dir, el.lang, el.getAttribute('dir'), el.getAttribute('lang')];
    el.dir = 'sideways';
    const anyString = el.dir;
    const fromAttributes = [attrs.dir, attrs.lang];
    attrs.removeAttribute('dir');
    attrs.removeAttribute('lang');
    await attrs.updateComplete;
    return { observed: [...ctor.observedAttributes].sort(), defaults, updateRequestedByDir, updateRequestedByLang, assigned, anyString, fromAttributes, removed: [attrs.dir, attrs.lang] };
  });
  expect(r).toEqual({
    observed: ['dir', 'disabled', 'download', 'href', 'label', 'lang', 'library', 'name', 'src', 'target'],
    defaults: [undefined, undefined],
    updateRequestedByDir: true,
    updateRequestedByLang: true,
    assigned: ['auto', 'fr', null, null],
    anyString: 'sideways',
    fromAttributes: ['rtl', 'de'],
    removed: [null, null],
  });
});

test('properties: Shoelace\'s defaults, only disabled reflects, and the inherited core ready event fires once without bubbling', async ({ page }) => {
  const { frame } = await openPage(page);
  const r = await frame.locator('body').evaluate(async body => {
    const el = document.createElement('sl-icon-button');
    const seen = [];
    let bubbled = 0;
    el.addEventListener('ready', event => seen.push({ bubbles: event.bubbles, composed: event.composed }));
    body.addEventListener('ready', () => bubbled++);
    const defaults = { name: el.name, library: el.library, src: el.src, href: el.href, target: el.target, download: el.download, label: el.label, disabled: el.disabled };
    body.append(el);
    await el.updateComplete;
    Object.assign(el, { name: 'gear', library: 'system', src: 'x.svg', href: '#h', target: '_top', download: 'f', label: 'L' });
    await el.updateComplete;
    const withoutDisabled = el.getAttributeNames().sort();
    el.disabled = true;
    await el.updateComplete;
    const withDisabled = el.getAttributeNames().sort();
    el.removeAttribute('disabled');
    await el.updateComplete;
    const afterRemoval = [el.disabled, el.hasAttribute('disabled')];
    el.disabled = true;
    await el.updateComplete;
    el.disabled = false;
    await el.updateComplete;
    const afterFalse = el.hasAttribute('disabled');
    const own = Object.getOwnPropertyNames(customElements.get('sl-icon-button').prototype).filter(n => n !== 'constructor').sort();
    el.remove();
    return { defaults, withoutDisabled, withDisabled, afterRemoval, afterFalse, seen, bubbled, own };
  });
  expect(r.defaults).toEqual({ name: undefined, library: undefined, src: undefined, href: undefined, target: undefined, download: undefined, label: '', disabled: false });
  expect(r.withoutDisabled).toEqual([]);
  expect(r.withDisabled).toEqual(['disabled']);
  expect(r.afterRemoval).toEqual([false, false]);
  expect(r.afterFalse).toBe(false);
  expect(r.seen).toEqual([{ bubbles: false, composed: false }]);
  expect(r.bubbled).toBe(0);
  // Shoelace's members, the base element's dir and lang accessors, and the lifecycle hooks this class overrides.
  expect(r.own).toEqual(['attributeChangedCallback', 'blur', 'button', 'click', 'dir', 'disabled', 'download', 'focus', 'handleBlur', 'handleClick',
    'handleFocus', 'hasFocus', 'href', 'label', 'lang', 'library', 'name', 'render', 'src', 'target', 'willUpdate'].sort());
});

test('the examples render in their own documents in Shoelace\'s order', async ({ page }) => {
  const { requests } = await openPage(page);
  const titles = await page.locator('iframe.example').evaluateAll(frames => frames.map(f => f.title));
  expect(titles).toEqual(SECTIONS.map(title));
  const counts = [];
  for (const section of SECTIONS) counts.push(await page.frameLocator(`iframe.example[title="${title(section)}"]`).locator('sl-icon-button').count());
  expect(counts).toEqual([1, 3, 3, 1, 1]);
  // The sections follow Shoelace's order on the page, the tooltip one (source only) between Link Buttons and Disabled.
  const ids = await page.locator('h3[id]').evaluateAll(hs => hs.map(h => h.id));
  expect(ids.filter(id => ORDER.some(([known]) => known === id))).toEqual(ORDER.map(([id]) => id));
  // Every example file of Shoelace's page is present: the six HTML ones and the five React ones (none for the tooltip).
  const files = dir => readdirSync(path.join(docsDir, 'examples/icon-button', dir)).filter(f => /\.(html|jsx)$/.test(f)).sort();
  expect(files('')).toEqual(ORDER.map(([id]) => `${id}.html`).sort());
  expect(files('react')).toEqual(ORDER.filter(([id]) => id !== 'tooltip').map(([id]) => `${id}.jsx`).sort());
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
});

// Shoelace's React examples, ported in packages/docs/examples/icon-button/react/*.jsx (the files the docs page shows), bundled
// with React 19 and the generated wrappers, which are resolved through the package's real export map.
test.describe('React examples', () => {
  const names = ['basic', 'sizes', 'colors', 'link-buttons', 'disabled'];
  let bundle;

  test.beforeAll(async () => {
    const fromVelcro = createRequire(path.join(velcroDir, 'package.json'));
    const fromDocs = createRequire(path.join(docsDir, 'package.json'));
    const pkgDir = name => path.dirname(fromVelcro.resolve(`${name}/package.json`));
    const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
    const dir = mkdtempSync(path.join(tmpdir(), 'velcro-icon-button-react-'));
    try {
      // Each example declares `App` without exporting it (as on Shoelace's page); the copies only append the export.
      for (const name of names) {
        writeFileSync(path.join(dir, `${name}.jsx`), `${readFileSync(path.join(docsDir, `examples/icon-button/react/${name}.jsx`), 'utf8')}\nexport default App;\n`);
      }
      const entry = path.join(dir, 'entry.js');
      writeFileSync(entry, `
        import React from 'react';
        import { flushSync } from 'react-dom';
        import { createRoot } from 'react-dom/client';
        ${names.map((n, i) => `import App${i} from './${n}.jsx';`).join('\n')}
        const apps = { ${names.map((n, i) => `'${n}': App${i}`).join(', ')} };
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

  test('render the same icon buttons as the HTML examples, through the generated wrapper, with the theme tokens applied', async ({ page }) => {
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
        await customElements.whenDefined('sl-icon-button');
        const buttons = [...document.querySelectorAll(`#${name} sl-icon-button`)];
        await Promise.all(buttons.map(b => b.updateComplete));
        out[name] = buttons.map(b => {
          const base = b.shadowRoot.querySelector('[part="base"]');
          return [base.localName, base.getAttribute('aria-label'), b.name, b.getBoundingClientRect().width, base.getAttribute('href'), base.getAttribute('target'), b.hasAttribute('disabled'), Boolean(base.disabled)];
        });
      }
      const colored = getComputedStyle(document.querySelector('#colors sl-icon-button').shadowRoot.querySelector('[part="base"]')).color;
      return { out, colored, errors: window.errors };
    }, names);
    expect(r.out).toEqual({
      basic: [['button', 'Settings', 'gear', 32, null, null, false, false]],
      sizes: [['button', 'Edit', 'pencil', 40, null, null, false, false], ['button', 'Edit', 'pencil', 48, null, null, false, false], ['button', 'Edit', 'pencil', 56, null, null, false, false]],
      colors: [['button', 'Bold', 'type-bold', 32, null, null, false, false], ['button', 'Italic', 'type-italic', 32, null, null, false, false], ['button', 'Underline', 'type-underline', 32, null, null, false, false]],
      'link-buttons': [['a', 'Settings', 'gear', 32, 'https://example.com', '_blank', false, false]],
      disabled: [['button', 'Settings', 'gear', 32, null, null, true, true]],
    });
    expect(r.colored).toBe('rgb(176, 0, 145)');
    expect(r.errors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});

test.describe('React wrapper', () => {
  const mount = reactWrapperPage(test);

  test('passes Shoelace\'s props and calls onSlFocus and onSlBlur', async ({ page }) => {
    const errors = await mount(page);
    const r = await page.evaluate(async () => {
      const seen = [];
      window.renderWrapper('VelcroIconButton', {
        name: 'gear', label: 'Wrapped', href: '#wrapped-link', target: '_self', download: 'w.txt', disabled: false,
        onSlFocus: e => seen.push(e.type), onSlBlur: e => seen.push(e.type),
      });
      const el = document.querySelector('#wrapped');
      await customElements.whenDefined('sl-icon-button');
      await el.updateComplete;
      el.focus();
      el.blur();
      const base = el.shadowRoot.querySelector('[part="base"]');
      const link = [base.localName, base.getAttribute('href'), base.getAttribute('target'), base.getAttribute('download'), base.getAttribute('aria-label')];
      window.renderWrapper('VelcroIconButton', { name: 'gear', label: 'Off', disabled: true });
      await el.updateComplete;
      return { seen, link, disabled: [el.disabled, el.hasAttribute('disabled'), el.shadowRoot.querySelector('[part="base"]').localName] };
    });
    expect(r).toEqual({
      seen: ['sl-focus', 'sl-blur'], link: ['a', '#wrapped-link', '_self', 'w.txt', 'Wrapped'], disabled: [true, true, 'button'],
    });
    expect(errors).toEqual([]);
  });
});

test('no upstream Shoelace runtime is requested or defined; no request leaves the local origin', async ({ page }) => {
  const { frame, requests } = await openPage(page);
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  expect(await frame.locator('body').evaluate(() => Boolean(window.Shoelace || document.querySelector('script[src*="shoelace"]')))).toBe(false);
});

// The class-only entry (@charm-ux/velcro/icon-button/class), bundled alone through the package's real export map: no
// registering entry, no aggregate and no docs page. Shoelace's icon button declares sl-icon in `static dependencies`, and its
// base element defines each missing dependency when an icon button is constructed; Velcro's does the same.
test.describe('class-only entry', () => {
  let bundle;

  test.beforeAll(async () => {
    const fromDocs = createRequire(path.join(docsDir, 'package.json'));
    const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
    const dir = mkdtempSync(path.join(tmpdir(), 'velcro-icon-button-class-'));
    try {
      const entry = path.join(dir, 'entry.js');
      writeFileSync(entry, `
        import { SlIconButton, VelcroIconButton } from '@charm-ux/velcro/icon-button/class';
        import { SlIcon } from '@charm-ux/velcro/icon/class';
        window.iconButtonClass = { SlIconButton, VelcroIconButton, SlIcon };
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

  async function load(page) {
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    const themeCss = readFileSync(path.join(velcroDir, 'themes/light.css'), 'utf8');
    await page.setContent('<!DOCTYPE html><html class="sl-theme-light"><body></body></html>');
    await page.addStyleTag({ content: themeCss });
    await page.addScriptTag({ type: 'module', content: bundle });
    await page.waitForFunction(() => Boolean(window.iconButtonClass));
    return pageErrors;
  }

  test('importing defines nothing; constructing an icon button defines Velcro\'s sl-icon, so the icon renders', async ({ page }) => {
    const pageErrors = await load(page);
    const r = await page.evaluate(async () => {
      const { SlIconButton, VelcroIconButton } = window.iconButtonClass;
      const tags = () => ['sl-icon-button', 'sl-icon'].map(t => customElements.get(t)?.name ?? null);
      const afterImport = tags();
      customElements.define('sl-icon-button', SlIconButton);
      const afterDefine = tags();
      const button = document.createElement('sl-icon-button');
      button.library = 'system';
      button.name = 'chevron-down';
      button.label = 'Settings';
      document.body.append(button);
      await button.updateComplete;
      const icon = button.shadowRoot.querySelector('sl-icon');
      await icon.updateComplete;
      return {
        afterImport, afterDefine, afterConstruct: tags(), alias: SlIconButton === VelcroIconButton,
        iconClass: customElements.get('sl-icon') === icon.constructor && icon.constructor.baseName,
        name: icon.getAttribute('name'),
      };
    });
    expect(r).toEqual({
      afterImport: [null, null], afterDefine: ['VelcroIconButton', null], afterConstruct: ['VelcroIconButton', 'VelcroIcon'], alias: true,
      iconClass: 'icon', name: 'chevron-down',
    });
    await expect.poll(() => page.locator('sl-icon-button').evaluate(b => Boolean(b.shadowRoot.querySelector('sl-icon').shadowRoot?.querySelector('svg')))).toBe(true);
    const box = await page.locator('sl-icon-button').evaluate(b => b.shadowRoot.querySelector('sl-icon').getBoundingClientRect().width);
    expect(box).toBeGreaterThan(0);
    expect(pageErrors).toEqual([]);
  });

  // The platform refuses to define one constructor under two names; Shoelace then defines an anonymous subclass.
  test('when the icon class is already defined under another tag, constructing an icon button defines sl-icon as a subclass of it', async ({ page }) => {
    const pageErrors = await load(page);
    const r = await page.evaluate(async () => {
      const { SlIconButton, SlIcon } = window.iconButtonClass;
      customElements.define('my-icon', SlIcon);
      customElements.define('sl-icon-button', SlIconButton);
      const button = document.createElement('sl-icon-button');
      button.library = 'system';
      button.name = 'chevron-down';
      document.body.append(button);
      await button.updateComplete;
      const defined = customElements.get('sl-icon');
      const icon = button.shadowRoot.querySelector('sl-icon');
      await icon.updateComplete;
      return {
        button: button instanceof SlIconButton, myIcon: customElements.get('my-icon') === SlIcon,
        subclass: Boolean(defined) && defined !== SlIcon && defined.prototype instanceof SlIcon, icon: icon instanceof defined,
      };
    });
    expect(r).toEqual({ button: true, myIcon: true, subclass: true, icon: true });
    await expect.poll(() => page.locator('sl-icon-button').evaluate(b => Boolean(b.shadowRoot.querySelector('sl-icon').shadowRoot?.querySelector('svg')))).toBe(true);
    expect(pageErrors).toEqual([]);
  });

  test('an sl-icon another constructor already owns is left in place, without an error', async ({ page }) => {
    const pageErrors = await load(page);
    const r = await page.evaluate(async () => {
      class OtherIcon extends HTMLElement {}
      customElements.define('sl-icon', OtherIcon);
      customElements.define('sl-icon-button', window.iconButtonClass.SlIconButton);
      const button = document.createElement('sl-icon-button');
      document.body.append(button);
      await button.updateComplete;
      const icon = button.shadowRoot.querySelector('sl-icon');
      return [customElements.get('sl-icon') === OtherIcon, icon instanceof OtherIcon];
    });
    expect(r).toEqual([true, true]);
    expect(pageErrors).toEqual([]);
  });
});
