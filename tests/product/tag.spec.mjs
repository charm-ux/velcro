import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';
import { reactWrapperPage } from './support/react.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/tag';
// Shoelace 2.20.1's tag page has four examples, in this order; every one is live and has a React version.
const ORDER = [['basic', 'Default'], ['sizes', 'Sizes'], ['pill', 'Pill'], ['removable', 'Removable']];
const SECTIONS = ORDER.map(([, section]) => section);
const title = section => `Tag example: ${section}`;
const docsDir = fileURLToPath(new URL('../../packages/docs/', import.meta.url));
const velcroDir = fileURLToPath(new URL('../../packages/velcro/', import.meta.url));

async function openPage(page) {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  const frame = page.frameLocator(`iframe.example[title="${title('Default')}"]`);
  await expect(frame.locator('sl-tag').first()).toBeVisible();
  await frame.locator('body').evaluate(() => customElements.whenDefined('sl-tag'));
  await documentsLoaded(page);
  return { frame, requests, example: section => page.frameLocator(`iframe.example[title="${title(section)}"]`) };
}

// Appends markup to the example document and waits for every sl-tag in it to render.
async function mount(frame, markup) {
  await frame.locator('body').evaluate(async (body, markup) => {
    const host = document.createElement('div');
    host.className = 'mount';
    host.innerHTML = markup;
    body.append(host);
    await Promise.all([...host.querySelectorAll('sl-tag')].map(el => el.updateComplete));
  }, markup);
}

// The computed values of a tag's inner `base` span that the tag's styles set, as strings comparable across engines.
const readBase = el => {
  const base = el.shadowRoot.querySelector('[part="base"]');
  const cs = getComputedStyle(base);
  const box = el.getBoundingClientRect();
  return {
    host: getComputedStyle(el).display,
    display: cs.display, alignItems: cs.alignItems, whiteSpace: cs.whiteSpace, userSelect: cs.userSelect || cs.webkitUserSelect, boxSizing: cs.boxSizing,
    borderStyle: cs.borderTopStyle, borderWidth: cs.borderTopWidth, background: cs.backgroundColor, borderColor: cs.borderTopColor, color: cs.color,
    fontSize: cs.fontSize, lineHeight: cs.lineHeight, radius: cs.borderTopLeftRadius, padding: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft],
    height: cs.height, box: [box.width, box.height],
  };
};

// What a probe element with the given declarations (written with the theme tokens) computes to, for the listed CSS properties
// (kebab-case names), for comparing against the tag.
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
  expect(html).toContain('<title>Tag - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('without changing the shared core prefix');
  for (const section of SECTIONS) expect(html).toContain(`title="${title(section)}"`);
  // The four sections are all there, in Shoelace's order (before the API tables), each with its intro text.
  const examplesPart = html.slice(html.indexOf('id="examples"'), html.indexOf('id="attributes"'));
  expect([...examplesPart.matchAll(/<h3 id="([^"]+)"><!--lit-part-->([^<]+)<!--\/lit-part--><\/h3>/g)].map(m => [m[1], m[2]])).toEqual(ORDER);
  expect(examplesPart).toContain('Use the <code>size</code> attribute to change a tag\'s size.');
  expect(examplesPart).toContain('Use the <code>pill</code> attribute to give tags rounded edges.');
  expect(examplesPart).toContain('Use the <code>removable</code> attribute to add a remove button to the tag.');
  expect(html).toContain('Tags are used as labels to organize things or to indicate a selection.');
  // The API tables: Shoelace's members, plus the core ready event labelled as inherited.
  expect(html).toContain('Inherited from core');
  for (const name of ['variant', 'size', 'pill', 'removable', 'sl-remove', 'base', 'content', 'remove-button', 'remove-button__base']) {
    expect(html).toContain(`data-name="${name}"`);
  }
  expect(html).toContain('data-name="ready"');
  expect(html.match(/<summary>React<\/summary>/g)).toHaveLength(SECTIONS.length);
  expect(html).toContain('&lt;sl-tag variant=&quot;success&quot;&gt;Success&lt;/sl-tag&gt;');
  expect(html).toContain('&lt;sl-tag size=&quot;small&quot; removable&gt;Small&lt;/sl-tag&gt;');
  expect(html).toContain('<SlTag variant="success">Success</SlTag>'.replace(/[<>"]/g, c => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]));
  expect(html).toContain('import { VelcroTag as SlTag } from &#39;@charm-ux/velcro/react/VelcroTag.js&#39;;');
  expect(html).toContain('onSlRemove={handleRemove}');
  // The quirks and limits the page lists are the ones the tests below pin.
  expect(html).toContain('The hidden attribute does not hide the tag');
  expect(html).toContain('variant=&quot;text&quot; is accepted');
  expect(html).toContain('cannot be reached with the Tab key');
  expect(html).toContain('Removing a reflected attribute does not restore the declared default');
  expect(html).toContain('was run locally in Chromium and WebKit only, and Firefox is covered only by the project&#39;s CI run');
  expect(html).toContain('Playwright&#39;s ARIA snapshot');
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
  const home = await (await request.get('/')).text();
  expect(home).toContain('/components/tag');
});

test('sl-tag registers inside the example document as the exported class, with sl-icon-button and sl-icon, no core marker and no ch-* definitions', async ({ page }) => {
  const { frame, requests } = await openPage(page);
  const info = await frame.locator('body').evaluate(() => {
    const ctor = customElements.get('sl-tag');
    const el = document.querySelector('sl-tag');
    return {
      baseName: ctor?.baseName,
      coreTag: customElements.get('ch-tag') !== undefined,
      viaConstructor: ctor ? new ctor().localName : null,
      instance: el instanceof ctor,
      iconButton: customElements.get('sl-icon-button')?.baseName,
      icon: customElements.get('sl-icon')?.baseName,
      attrs: el.getAttributeNames().sort(),
    };
  });
  expect(info).toEqual({ baseName: 'tag', coreTag: false, viaConstructor: 'sl-tag', instance: true, iconButton: 'icon-button', icon: 'icon', attrs: ['id', 'size', 'variant'] });
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
});

test('default: a base span with the tag classes around the content slot, no remove button, no role and no ARIA attributes', async ({ page }) => {
  const { frame } = await openPage(page);
  const r = await frame.locator('#demo-default').evaluate(el => {
    const base = el.shadowRoot.querySelector('[part="base"]');
    const slot = base.querySelector('slot');
    return {
      children: [...el.shadowRoot.children].filter(n => n.localName !== 'style').map(n => `${n.localName}:${n.getAttribute('part')}`),
      baseChildren: [...base.children].map(n => n.localName),
      attrs: Object.fromEntries(base.getAttributeNames().map(n => [n, n === 'class' ? [...base.classList].join(' ') : base.getAttribute(n)])),
      rawClass: base.getAttribute('class'),
      slot: Object.fromEntries(slot.getAttributeNames().map(n => [n, slot.getAttribute(n)])),
      assigned: slot.assignedNodes().map(n => n.textContent),
      hostAttrs: el.getAttributeNames().sort(),
      removeButtons: el.shadowRoot.querySelectorAll('sl-icon-button').length,
      aria: [el.getAttribute('role'), base.getAttribute('role'), ...el.getAttributeNames().filter(n => n.startsWith('aria-'))],
    };
  });
  expect(r).toEqual({
    children: ['span:base'],
    baseChildren: ['slot'],
    attrs: { part: 'base', class: 'tag tag--primary tag--medium' },
    // The class attribute is Lit's classMap output, which Shoelace's own test pins: a space before and after.
    rawClass: ' tag tag--primary tag--medium ',
    slot: { part: 'content', class: 'tag__content' },
    assigned: ['Primary'],
    hostAttrs: ['id', 'size', 'variant'],
    removeButtons: 0,
    aria: [null, null],
  });
});

test('the five variants of the Default example draw Shoelace\'s theme tokens: background -50, border -200, text -800', async ({ page }) => {
  const { frame } = await openPage(page);
  const variants = ['primary', 'success', 'neutral', 'warning', 'danger'];
  const tags = await frame.locator('sl-tag').evaluateAll(els => els.map(el => [el.variant, el.textContent, el.getAttribute('variant')]));
  expect(tags).toEqual([['primary', 'Primary', 'primary'], ['success', 'Success', 'success'], ['neutral', 'Neutral', 'neutral'], ['warning', 'Warning', 'warning'], ['danger', 'Danger', 'danger']]);
  const read = await frame.locator('sl-tag').evaluateAll((els, source) => els.map(el => new Function(`return (${source})`)()(el)), readBase.toString());
  for (const [i, variant] of variants.entries()) {
    const want = await probe(frame, `background-color: var(--sl-color-${variant}-50); border-color: var(--sl-color-${variant}-200); border-style: solid; color: var(--sl-color-${variant}-800)`, ['background-color', 'border-top-color', 'color']);
    expect(read[i].background, variant).toBe(want['background-color']);
    expect(read[i].borderColor, variant).toBe(want['border-top-color']);
    expect(read[i].color, variant).toBe(want.color);
  }
  // The five colors are all different from each other (a theme that is missing would make them equal).
  expect(new Set(read.map(r => r.background)).size).toBe(5);
  // The layout is the same for all of them: an inline-block host around a flex base, a 1px solid border, no wrapping.
  for (const r of read) {
    expect([r.host, r.display, r.alignItems, r.whiteSpace, r.userSelect, r.boxSizing, r.borderStyle, r.borderWidth]).toEqual(['inline-block', 'flex', 'center', 'nowrap', 'none', 'border-box', 'solid', '1px']);
  }
});

test('sizes: small, medium and large take the input height times 0.8, the button font size, the input radius and the matching padding', async ({ page }) => {
  const { example } = await openPage(page);
  const frame = example('Sizes');
  const read = await frame.locator('sl-tag').evaluateAll((els, source) => els.map(el => new Function(`return (${source})`)()(el)), readBase.toString());
  const sizes = ['small', 'medium', 'large'];
  expect(await frame.locator('sl-tag').evaluateAll(els => els.map(el => [el.size, el.getAttribute('size'), el.shadowRoot.querySelector('[part="base"]').className]))).toEqual([
    ['small', 'small', ' tag tag--neutral tag--small '], ['medium', 'medium', ' tag tag--neutral tag--medium '], ['large', 'large', ' tag tag--neutral tag--large '],
  ]);
  const pad = { small: 'x-small', medium: 'small', large: 'medium' };
  for (const [i, size] of sizes.entries()) {
    const want = await probe(frame, `box-sizing: border-box; height: calc(var(--sl-input-height-${size}) * 0.8); font-size: var(--sl-button-font-size-${size}); line-height: calc(var(--sl-input-height-${size}) - var(--sl-input-border-width) * 2); border-radius: var(--sl-input-border-radius-${size}); padding: 0 var(--sl-spacing-${pad[size]})`, ['height', 'font-size', 'line-height', 'border-top-left-radius', 'padding-right', 'padding-left']);
    expect(read[i].height, size).toBe(want.height);
    expect(read[i].fontSize, size).toBe(want['font-size']);
    expect(read[i].lineHeight, size).toBe(want['line-height']);
    expect(read[i].radius, size).toBe(want['border-top-left-radius']);
    expect(read[i].padding, size).toEqual(['0px', want['padding-right'], '0px', want['padding-left']]);
  }
  // The values those tokens have in the light theme: 0.8 of 30, 40 and 50px, the 12, 14 and 16px button text, and 8, 12 and 16px horizontal padding (x-small, small and medium spacing).
  expect(read.map(r => r.box[1])).toEqual([24, 32, 40]);
  expect(read.map(r => r.fontSize)).toEqual(['12px', '14px', '16px']);
  expect(read.map(r => r.padding[1])).toEqual(['8px', '12px', '16px']);
  expect(read.map(r => r.lineHeight)).toEqual(['28px', '38px', '48px']);
});

test('pill: the radius is the pill token on every size, and nothing else changes', async ({ page }) => {
  const { example } = await openPage(page);
  const frame = example('Pill');
  const rows = await frame.locator('sl-tag').evaluateAll(els => els.map(el => [el.pill, el.hasAttribute('pill'), el.getAttribute('pill'), el.shadowRoot.querySelector('[part="base"]').className]));
  expect(rows).toEqual([
    [true, true, '', ' tag tag--neutral tag--small tag--pill '], [true, true, '', ' tag tag--neutral tag--medium tag--pill '], [true, true, '', ' tag tag--neutral tag--large tag--pill '],
  ]);
  const radii = await frame.locator('sl-tag').evaluateAll(els => els.map(el => getComputedStyle(el.shadowRoot.querySelector('[part="base"]')).borderTopLeftRadius));
  const pill = await probe(frame, 'border-radius: var(--sl-border-radius-pill); height: 10px', ['border-top-left-radius']);
  const radius = pill['border-top-left-radius'];
  expect(radii).toEqual([radius, radius, radius]);
  // 9999px is the token's value; the browser may serialize the used radius, so compare through the probe and a floor.
  expect(Number.parseFloat(radius)).toBeGreaterThan(1000);
  expect(await frame.locator('sl-tag').evaluateAll(els => els.map(el => el.getBoundingClientRect().height))).toEqual([24, 32, 40]);
});

test('removable example: a remove button that is an sl-icon-button, with the x-lg system icon, the localized Remove label, tabindex -1 and the exported base part', async ({ page }) => {
  const { example } = await openPage(page);
  const frame = example('Removable');
  const r = await frame.locator('sl-tag').first().evaluate(async el => {
    const button = el.shadowRoot.querySelector('sl-icon-button');
    await button.updateComplete;
    const icon = button.shadowRoot.querySelector('sl-icon');
    await icon.updateComplete;
    return {
      baseClass: el.shadowRoot.querySelector('[part="base"]').className,
      baseChildren: [...el.shadowRoot.querySelector('[part="base"]').children].map(n => `${n.localName}${n.getAttribute('part') ? ':' + n.getAttribute('part') : ''}`),
      attrs: Object.fromEntries(button.getAttributeNames().map(n => [n, button.getAttribute(n)])),
      props: [button.name, button.library, button.label, button.constructor.baseName],
      iconDrawn: Boolean(icon.shadowRoot.querySelector('svg')),
      removable: [el.removable, el.hasAttribute('removable'), el.getAttribute('removable')],
      hostAttrs: el.getAttributeNames().sort(),
    };
  });
  expect(r).toEqual({
    baseClass: ' tag tag--neutral tag--small tag--removable ',
    baseChildren: ['slot:content', 'sl-icon-button:remove-button'],
    attrs: { part: 'remove-button', exportparts: 'base:remove-button__base', name: 'x-lg', library: 'system', label: 'Remove', class: 'tag__remove', tabindex: '-1' },
    props: ['x-lg', 'system', 'Remove', 'icon-button'],
    iconDrawn: true,
    // removable is a property only: an attribute sets it, but the property never writes the attribute back.
    removable: [true, true, ''],
    hostAttrs: ['removable', 'size', 'variant'],
  });
});

test('removable example: clicking the remove button emits sl-remove once, from the tag, bubbling and composed, uncancelable, with an empty detail; the example fades the tag and restores it', async ({ page }) => {
  const { example } = await openPage(page);
  const frame = example('Removable');
  await frame.locator('body').evaluate(body => {
    window.removed = [];
    body.addEventListener('sl-remove', e => window.removed.push({ target: e.target.getAttribute('size'), bubbles: e.bubbles, composed: e.composed, cancelable: e.cancelable, detail: e.detail, type: e.constructor.name, trusted: e.isTrusted }));
  });
  const second = frame.locator('sl-tag').nth(1);
  const opacity = () => second.evaluate(el => getComputedStyle(el).opacity);
  expect(await opacity()).toBe('1');
  await second.locator('sl-icon-button').click();
  expect(await frame.locator('body').evaluate(() => window.removed)).toEqual([
    { target: 'medium', bubbles: true, composed: true, cancelable: false, detail: {}, type: 'CustomEvent', trusted: false },
  ]);
  // The example's listener sets the tag's opacity to 0 (a transition of the medium duration), then back to 1 after two seconds.
  await expect.poll(opacity).toBe('0');
  expect(await second.evaluate(el => el.isConnected && el.style.opacity)).toBe('0');
  await expect.poll(opacity, { timeout: 8000 }).toBe('1');
  // The tag never removes itself.
  expect(await frame.locator('sl-tag').count()).toBe(3);
  // A pointer click on the tag's text (the padding left of the remove button) does not emit.
  const box = await second.boundingBox();
  await second.page().mouse.click(box.x + 4, box.y + box.height / 2);
  expect((await frame.locator('body').evaluate(() => window.removed)).length).toBe(1);
});

test('the remove button: click() on it emits, a click on the tag\'s content or border does not, and removable toggles the button at runtime', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<div id="r"><sl-tag id="t" variant="primary">Label</sl-tag></div>');
  const r = await frame.locator('#t').evaluate(async el => {
    const log = [];
    el.addEventListener('sl-remove', () => log.push('remove'));
    const buttons = () => el.shadowRoot.querySelectorAll('sl-icon-button').length;
    const none = buttons();
    // Clicks on the content and the base do nothing.
    el.shadowRoot.querySelector('[part="base"]').click();
    el.shadowRoot.querySelector('[part="content"]').click();
    el.click();
    const afterContentClicks = log.length;
    el.removable = true;
    await el.updateComplete;
    const withButton = buttons();
    el.shadowRoot.querySelector('sl-icon-button').click();
    el.shadowRoot.querySelector('sl-icon-button').click();
    const afterRemoveClicks = log.length;
    el.removable = false;
    await el.updateComplete;
    const gone = buttons();
    // removable is not reflected: an attribute sets the property, removing it sets false, and the property never writes the attribute.
    el.setAttribute('removable', '');
    await el.updateComplete;
    const viaAttribute = [el.removable, buttons()];
    el.removeAttribute('removable');
    await el.updateComplete;
    return { none, afterContentClicks, withButton, afterRemoveClicks, gone, viaAttribute, afterRemoval: [el.removable, buttons(), el.hasAttribute('removable')] };
  });
  expect(r).toEqual({
    none: 0, afterContentClicks: 0, withButton: 1, afterRemoveClicks: 2, gone: 0, viaAttribute: [true, 1], afterRemoval: [false, 0, false],
  });
});

test('the remove button\'s look: no padding, the tag margin before it, the color of the icon button host until the tag is pressed, then the variant\'s -600 color (a rule on sl-icon-button)', async ({ page }) => {
  const { frame } = await openPage(page);
  const variants = ['primary', 'success', 'neutral', 'warning', 'danger'];
  await mount(frame, `<div id="v">${variants.map(v => `<sl-tag id="v-${v}" variant="${v}" removable>${v}</sl-tag>`).join(' ')}</div>`);
  const hostColor = await probe(frame, 'color: var(--sl-color-neutral-600)', ['color']);
  const margin = await probe(frame, 'margin-inline-start: var(--sl-spacing-x-small)', ['margin-inline-start']);
  for (const v of variants) {
    const el = frame.locator(`#v-${v}`);
    const state = () => el.evaluate(tag => {
      const button = tag.shadowRoot.querySelector('sl-icon-button');
      const base = button.shadowRoot.querySelector('[part="base"]');
      const cs = getComputedStyle(base);
      return { host: getComputedStyle(button).color, base: cs.color, padding: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft], margin: getComputedStyle(button).marginInlineStart };
    });
    const rest = await state();
    // The base part's own `color: inherit` and `padding: 0` come from the tag's ::part(base) rule, which outranks the icon button's own rules.
    expect(rest, v).toEqual({ host: hostColor.color, base: hostColor.color, padding: ['0px', '0px', '0px', '0px'], margin: margin['margin-inline-start'] });
    expect(rest.margin).toBe('8px');
    // The icon button's own hover color (primary-600) never shows: the tag's ::part(base) rule outranks it.
    await el.locator('sl-icon-button').hover();
    expect((await state()).base, v).toBe(hostColor.color);
    // A press anywhere on the tag (:active) recolors the remove button through `.tag--<variant>:active > sl-icon-button`.
    const want = await probe(frame, `color: var(--sl-color-${v}-600)`, ['color']);
    const box = await el.boundingBox();
    await el.page().mouse.move(box.x + 3, box.y + box.height / 2);
    await el.page().mouse.down();
    await expect.poll(async () => (await state()).base, { message: v }).toBe(want.color);
    expect((await state()).host).toBe(want.color);
    await el.page().mouse.up();
    await el.page().mouse.move(0, 0);
    await expect.poll(async () => (await state()).base, { message: v }).toBe(hostColor.color);
  }
});

test('upstream quirk: the hidden attribute does not hide the tag, because the host\'s own display: inline-block outranks the browser rule', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<div id="h"><sl-tag hidden>Hidden</sl-tag></div>');
  const r = await frame.locator('#h sl-tag').evaluate(el => {
    const before = { display: getComputedStyle(el).display, boxes: el.getClientRects().length, hidden: el.hidden };
    const base = el.shadowRoot.querySelector('[part="base"]');
    base.hidden = true;
    const baseHidden = getComputedStyle(base).display;
    base.hidden = false;
    // An inline style does hide it.
    el.style.display = 'none';
    const withInline = getComputedStyle(el).display;
    el.style.display = '';
    return { before, baseHidden, withInline };
  });
  expect(r).toEqual({ before: { display: 'inline-block', boxes: 1, hidden: true }, baseHidden: 'none', withInline: 'none' });
  await expect(frame.locator('#h sl-tag')).toBeVisible();
});

test('upstream quirk: variant="text" is accepted and given a tag--text class that no rule styles: no background, the border and text in the inherited color, and no pressed color for the remove button', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<div id="q" style="color: rgb(10, 20, 30)"><sl-tag id="text" variant="text" removable>Text</sl-tag> <sl-tag id="neutral" variant="neutral">Neutral</sl-tag></div>');
  const hostColor = await probe(frame, 'color: var(--sl-color-neutral-600)', ['color']);
  const r = await frame.locator('#q').evaluate(async (wrap, source) => {
    const read = new Function(`return (${source})`)();
    const text = wrap.querySelector('#text');
    const neutral = wrap.querySelector('#neutral');
    const cls = text.shadowRoot.querySelector('[part="base"]').className;
    return { cls, text: read(text), neutral: read(neutral), property: [text.variant, text.getAttribute('variant')] };
  }, readBase.toString());
  expect(r.cls).toBe(' tag tag--text tag--medium tag--removable ');
  expect(r.property).toEqual(['text', 'text']);
  expect(r.text.background).toBe('rgba(0, 0, 0, 0)');
  expect(r.text.color).toBe('rgb(10, 20, 30)');
  expect(r.text.borderColor).toBe('rgb(10, 20, 30)');
  expect(r.text.borderStyle).toBe('solid');
  expect(r.text.borderWidth).toBe('1px');
  // The size rules still apply to it.
  expect(r.text.box[1]).toBe(32);
  expect(r.neutral.background).not.toBe('rgba(0, 0, 0, 0)');
  // Pressing it recolors nothing: there is no `.tag--text:active` rule.
  const el = frame.locator('#text');
  const buttonColor = () => el.evaluate(tag => getComputedStyle(tag.shadowRoot.querySelector('sl-icon-button').shadowRoot.querySelector('[part="base"]')).color);
  const box = await el.boundingBox();
  await el.page().mouse.move(box.x + 3, box.y + box.height / 2);
  await el.page().mouse.down();
  expect(await buttonColor()).toBe(hostColor.color);
  await el.page().mouse.up();
  await el.page().mouse.move(0, 0);
});

test('upstream quirk: a variant or size outside the documented lists is kept as given and gets no class: no colors, or no height, font size and padding', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<div id="u" style="color: rgb(10, 20, 30)"><sl-tag id="bad" variant="info" size="huge">Odd</sl-tag></div>');
  const r = await frame.locator('#bad').evaluate(async (el, source) => {
    const read = new Function(`return (${source})`)();
    return { props: [el.variant, el.size, el.getAttribute('variant'), el.getAttribute('size')], cls: el.shadowRoot.querySelector('[part="base"]').className, look: read(el) };
  }, readBase.toString());
  expect(r.props).toEqual(['info', 'huge', 'info', 'huge']);
  expect(r.cls).toBe(' tag ');
  expect(r.look.background).toBe('rgba(0, 0, 0, 0)');
  expect(r.look.borderColor).toBe('rgb(10, 20, 30)');
  expect(r.look.padding).toEqual(['0px', '0px', '0px', '0px']);
  // Without a size class there is no fixed height: the box is the content's.
  expect(r.look.height).not.toBe('32px');
  expect(r.look.box[1]).toBeLessThan(32);
});

// Playwright's ARIA snapshot is computed by Playwright from the DOM (roles, names, aria-hidden, hidden and inert content),
// not read from the browser's native accessibility tree, and no screen reader is involved.
test('accessibility tree (Playwright ARIA snapshot): a tag is plain text; a removable one adds a button named Remove', async ({ page }) => {
  const { frame, example } = await openPage(page);
  await expect(frame.locator('#demo-default')).toMatchAriaSnapshot('- text: Primary');
  await expect(example('Sizes').locator('sl-tag').nth(1)).toMatchAriaSnapshot('- text: Medium');
  await expect(example('Removable').locator('sl-tag').first()).toMatchAriaSnapshot(`
    - text: Small
    - button "Remove"
  `);
  await expect(example('Removable').locator('sl-tag').first().locator('sl-icon-button [part="base"]')).toHaveAccessibleName('Remove');
  await expect(example('Removable').locator('sl-tag').first().locator('sl-icon-button [part="base"]')).toHaveRole('button');
});

test('the remove button label is the localization module\'s remove term, in the tag\'s own language, and follows a language change', async ({ page }) => {
  const errors = await loadBundle(page, TAG_ENTRY);
  const r = await page.evaluate(async () => {
    const { registerTranslation } = window.tagModules.localize;
    const { en } = window.tagModules;
    registerTranslation({ ...en, $code: 'xq', $name: 'Test', $dir: 'ltr', remove: 'Entfernen-xq' });
    registerTranslation({ ...en, $code: 'xq-yy', $name: 'Test YY', $dir: 'ltr', remove: 'Entfernen-xq-yy' });
    document.body.innerHTML = '<sl-tag id="a" lang="xq" removable>A</sl-tag><sl-tag id="b" lang="xq-yy" removable>B</sl-tag><sl-tag id="c" removable>C</sl-tag><div lang="xq"><sl-tag id="d" removable>D</sl-tag></div>';
    const label = id => document.querySelector(`#${id}`).shadowRoot.querySelector('sl-icon-button').label;
    await Promise.all([...document.querySelectorAll('sl-tag')].map(el => el.updateComplete));
    const first = [label('a'), label('b'), label('c'), label('d')];
    // A language change on the tag re-renders it.
    const b = document.querySelector('#b');
    b.lang = 'xq';
    await b.updateComplete;
    const afterTagLang = label('b');
    b.removeAttribute('lang');
    await b.updateComplete;
    // The document language applies to a tag with no lang of its own; an ancestor's lang does not count (only the tag's and the document's do).
    document.documentElement.lang = 'xq-yy';
    for (let i = 0; i < 100 && label('c') !== 'Entfernen-xq-yy'; i++) await new Promise(resolve => setTimeout(resolve, 20));
    const afterDocument = [label('c'), label('d'), label('a')];
    document.documentElement.lang = 'en';
    return { first, afterTagLang, afterDocument };
  });
  expect(r.first).toEqual(['Entfernen-xq', 'Entfernen-xq-yy', 'Remove', 'Remove']);
  expect(r.afterTagLang).toBe('Entfernen-xq');
  expect(r.afterDocument).toEqual(['Entfernen-xq-yy', 'Entfernen-xq-yy', 'Entfernen-xq']);
  expect(errors).toEqual([]);
});

test('dir and lang are reactive, not reflected and undefined by default; the observed attributes are Shoelace\'s', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-tag id="dl"></sl-tag><sl-tag id="attrs" dir="rtl" lang="de"></sl-tag>');
  const r = await frame.locator('body').evaluate(async () => {
    const el = document.querySelector('#dl');
    const attrs = document.querySelector('#attrs');
    const ctor = customElements.get('sl-tag');
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
    observed: ['dir', 'lang', 'pill', 'removable', 'size', 'variant'],
    defaults: [undefined, undefined],
    updateRequestedByDir: true,
    updateRequestedByLang: true,
    assigned: ['auto', 'fr', null, null],
    anyString: 'sideways',
    fromAttributes: ['rtl', 'de'],
    removed: [null, null],
  });
});

test('properties: Shoelace\'s defaults; variant, size and pill reflect and removing their attributes restores the first-render values (the defaults here); removable does not reflect; ready fires once without bubbling', async ({ page }) => {
  const { frame } = await openPage(page);
  const r = await frame.locator('body').evaluate(async body => {
    const el = document.createElement('sl-tag');
    const seen = [];
    let bubbled = 0;
    el.addEventListener('ready', event => seen.push({ bubbles: event.bubbles, composed: event.composed }));
    body.addEventListener('ready', () => bubbled++);
    const defaults = { variant: el.variant, size: el.size, pill: el.pill, removable: el.removable };
    const initialAttrs = el.getAttributeNames();
    body.append(el);
    await el.updateComplete;
    const rendered = el.getAttributeNames().sort();
    el.variant = 'danger';
    el.size = 'large';
    el.pill = true;
    el.removable = true;
    await el.updateComplete;
    const reflected = Object.fromEntries(el.getAttributeNames().sort().map(n => [n, el.getAttribute(n)]));
    el.removeAttribute('variant');
    el.removeAttribute('size');
    el.removeAttribute('pill');
    await el.updateComplete;
    const restored = { variant: el.variant, size: el.size, pill: el.pill, attrs: el.getAttributeNames().sort(), cls: el.shadowRoot.querySelector('[part="base"]').className.trim().split(/\s+/).sort().join(' ') };
    // `pill = false` removes the attribute; the attribute written by a parser or by script sets the property.
    el.pill = true;
    await el.updateComplete;
    el.pill = false;
    await el.updateComplete;
    const pillOff = el.hasAttribute('pill');
    el.setAttribute('variant', 'success');
    el.setAttribute('size', 'small');
    el.setAttribute('pill', '');
    await el.updateComplete;
    const fromAttributes = [el.variant, el.size, el.pill];
    const proto = customElements.get('sl-tag').prototype;
    const own = [...new Set([proto, Object.getPrototypeOf(proto)].flatMap(p => Object.getOwnPropertyNames(p)))]
      .filter(n => n !== 'constructor').sort();
    el.remove();
    return { defaults, initialAttrs, rendered, reflected, restored, pillOff, fromAttributes, seen, bubbled, own };
  });
  expect(r.defaults).toEqual({ variant: 'neutral', size: 'medium', pill: false, removable: false });
  // The reflected properties write their defaults to the attributes on the first update, as in Shoelace; removable is not written.
  expect(r.initialAttrs).toEqual([]);
  expect(r.rendered).toEqual(['size', 'variant']);
  expect(r.reflected).toEqual({ pill: '', size: 'large', variant: 'danger' });
  expect(r.restored).toEqual({ variant: 'neutral', size: 'medium', pill: false, attrs: ['size', 'variant'], cls: 'tag tag--medium tag--neutral tag--removable' });
  expect(r.pillOff).toBe(false);
  expect(r.fromAttributes).toEqual(['success', 'small', true]);
  expect(r.seen).toEqual([{ bubbles: false, composed: false }]);
  expect(r.bubbled).toBe(0);
  // Component and compatibility-mixin members: ownership can move without changing the element's API.
  expect(r.own).toEqual(['attributeChangedCallback', 'dir', 'handleRemoveClick', 'lang', 'pill', 'removable', 'render', 'size', 'variant', 'willUpdate']);
});

// Shoelace's base element records the reflected properties' values the first time any attribute of the element changes, and
// restores that record when a reflected attribute is later removed (its value then being null). The record is not the declared
// default: it is whatever the properties held at that first attribute change, which for an element created from script is the
// first time Lit reflects them, after the first update.
test('removing a reflected attribute restores the values the properties held at the first attribute change, not the declared defaults; a removed pill attribute is false', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<div id="parsed"><sl-tag variant="danger" size="large" pill>Parsed</sl-tag></div>');
  const r = await frame.locator('body').evaluate(async body => {
    const state = el => ({ variant: el.variant, size: el.size, pill: el.pill, attrs: el.getAttributeNames().sort() });

    // Created from script with the properties assigned before the first render: the first render's reflection is the first
    // attribute change, so these values are the record.
    const early = document.createElement('sl-tag');
    early.variant = 'danger';
    early.size = 'large';
    early.pill = true;
    body.append(early);
    await early.updateComplete;
    const earlyFirst = state(early);
    early.variant = 'success';
    early.size = 'small';
    await early.updateComplete;
    early.removeAttribute('variant');
    early.removeAttribute('size');
    await early.updateComplete;
    const earlyRestored = state(early);
    // pill: a Boolean attribute that is removed gives false, never null, so nothing is restored.
    early.removeAttribute('pill');
    await early.updateComplete;
    const earlyPill = state(early);

    // Created from script, rendered with the defaults first, then assigned: the record is the defaults.
    const late = document.createElement('sl-tag');
    body.append(late);
    await late.updateComplete;
    late.variant = 'danger';
    late.size = 'large';
    await late.updateComplete;
    late.removeAttribute('variant');
    late.removeAttribute('size');
    await late.updateComplete;
    const lateRestored = state(late);

    // Written in markup (the attributes are there when the element is created): the first attribute change is handled
    // while the properties still hold their defaults, so the record is the defaults, not the attribute values.
    const parsed = document.querySelector('#parsed sl-tag');
    await parsed.updateComplete;
    const parsedFirst = state(parsed);
    parsed.removeAttribute('variant');
    parsed.removeAttribute('size');
    await parsed.updateComplete;
    const parsedRestored = state(parsed);

    early.remove();
    late.remove();
    return { earlyFirst, earlyRestored, earlyPill, lateRestored, parsedFirst, parsedRestored };
  });
  expect(r.earlyFirst).toEqual({ variant: 'danger', size: 'large', pill: true, attrs: ['pill', 'size', 'variant'] });
  expect(r.earlyRestored).toEqual({ variant: 'danger', size: 'large', pill: true, attrs: ['pill', 'size', 'variant'] });
  expect(r.earlyPill).toEqual({ variant: 'danger', size: 'large', pill: false, attrs: ['size', 'variant'] });
  expect(r.lateRestored).toEqual({ variant: 'neutral', size: 'medium', pill: false, attrs: ['size', 'variant'] });
  expect(r.parsedFirst).toEqual({ variant: 'danger', size: 'large', pill: true, attrs: ['pill', 'size', 'variant'] });
  // The pill attribute was left in place, so pill is still true; only variant and size were removed and restored.
  expect(r.parsedRestored).toEqual({ variant: 'neutral', size: 'medium', pill: true, attrs: ['pill', 'size', 'variant'] });
});

test('the examples render in their own documents in Shoelace\'s order', async ({ page }) => {
  const { requests } = await openPage(page);
  const titles = await page.locator('iframe.example').evaluateAll(frames => frames.map(f => f.title));
  expect(titles).toEqual(SECTIONS.map(title));
  const counts = [];
  for (const section of SECTIONS) counts.push(await page.frameLocator(`iframe.example[title="${title(section)}"]`).locator('sl-tag').count());
  expect(counts).toEqual([5, 3, 3, 3]);
  const ids = await page.locator('h3[id]').evaluateAll(hs => hs.map(h => h.id));
  expect(ids.filter(id => ORDER.some(([known]) => known === id))).toEqual(ORDER.map(([id]) => id));
  // Every example file of Shoelace's page is present: the four HTML ones and the four React ones.
  const files = dir => readdirSync(path.join(docsDir, 'examples/tag', dir)).filter(f => /\.(html|jsx)$/.test(f)).sort();
  expect(files('')).toEqual(ORDER.map(([id]) => `${id}.html`).sort());
  expect(files('react')).toEqual(ORDER.map(([id]) => `${id}.jsx`).sort());
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
});

// Shoelace's React examples, ported in packages/docs/examples/tag/react/*.jsx (the files the docs page shows), bundled with
// React 19 and the generated wrappers, which are resolved through the package's real export map.
test.describe('React examples', () => {
  const names = ORDER.map(([id]) => id);
  let bundle;

  test.beforeAll(async () => {
    const fromVelcro = createRequire(path.join(velcroDir, 'package.json'));
    const fromDocs = createRequire(path.join(docsDir, 'package.json'));
    const pkgDir = name => path.dirname(fromVelcro.resolve(`${name}/package.json`));
    const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
    const dir = mkdtempSync(path.join(tmpdir(), 'velcro-tag-react-'));
    try {
      // Each example declares `App` without exporting it (as on Shoelace's page); the copies only append the export.
      for (const name of names) {
        writeFileSync(path.join(dir, `${name}.jsx`), `${readFileSync(path.join(docsDir, `examples/tag/react/${name}.jsx`), 'utf8')}\nexport default App;\n`);
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

  test('render the same tags as the HTML examples, through the generated wrapper, with the theme tokens applied; the removable one reports sl-remove', async ({ page }) => {
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
        await customElements.whenDefined('sl-tag');
        const tags = [...document.querySelectorAll(`#${name} sl-tag`)];
        await Promise.all(tags.map(t => t.updateComplete));
        out[name] = tags.map(t => [t.variant, t.size, t.pill, t.removable, t.textContent, t.getBoundingClientRect().height, t.shadowRoot.querySelectorAll('sl-icon-button').length]);
      }
      const colored = getComputedStyle(document.querySelector('#basic sl-tag').shadowRoot.querySelector('[part="base"]')).backgroundColor;
      // The removable example: a click on the remove button reaches the React handler, which fades the tag.
      const medium = document.querySelectorAll('#removable sl-tag')[1];
      medium.shadowRoot.querySelector('sl-icon-button').click();
      const faded = medium.style.opacity;
      return { out, colored, faded, errors: window.errors };
    }, names);
    expect(r.out).toEqual({
      basic: [['primary', 'medium', false, false, 'Primary', 32, 0], ['success', 'medium', false, false, 'Success', 32, 0], ['neutral', 'medium', false, false, 'Neutral', 32, 0],
        ['warning', 'medium', false, false, 'Warning', 32, 0], ['danger', 'medium', false, false, 'Danger', 32, 0]],
      sizes: [['neutral', 'small', false, false, 'Small', 24, 0], ['neutral', 'medium', false, false, 'Medium', 32, 0], ['neutral', 'large', false, false, 'Large', 40, 0]],
      pill: [['neutral', 'small', true, false, 'Small', 24, 0], ['neutral', 'medium', true, false, 'Medium', 32, 0], ['neutral', 'large', true, false, 'Large', 40, 0]],
      removable: [['neutral', 'small', false, true, 'Small', 24, 1], ['neutral', 'medium', false, true, 'Medium', 32, 1], ['neutral', 'large', false, true, 'Large', 40, 1]],
    });
    expect(r.colored).not.toBe('rgba(0, 0, 0, 0)');
    expect(r.faded).toBe('0');
    expect(r.errors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});

test.describe('React wrapper', () => {
  const mount = reactWrapperPage(test);

  test('passes Shoelace\'s props and calls onSlRemove, with the tag as the event target', async ({ page }) => {
    const errors = await mount(page);
    const r = await page.evaluate(async () => {
      const seen = [];
      window.renderWrapper('VelcroTag', { variant: 'danger', size: 'large', pill: true, removable: true, onSlRemove: e => seen.push([e.type, e.target === document.querySelector('#wrapped')]) }, 'Wrapped');
      const el = document.querySelector('#wrapped');
      await customElements.whenDefined('sl-tag');
      await el.updateComplete;
      el.shadowRoot.querySelector('sl-icon-button').click();
      const first = [el.variant, el.size, el.pill, el.removable, el.shadowRoot.querySelector('[part="base"]').className, el.textContent];
      window.renderWrapper('VelcroTag', { variant: 'success', size: 'small', pill: false, removable: false }, 'Wrapped');
      await el.updateComplete;
      return { seen, first, second: [el.variant, el.size, el.pill, el.removable, el.shadowRoot.querySelectorAll('sl-icon-button').length] };
    });
    expect(r).toEqual({
      seen: [['sl-remove', true]],
      first: ['danger', 'large', true, true, ' tag tag--danger tag--large tag--pill tag--removable ', 'Wrapped'],
      second: ['success', 'small', false, false, 0],
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

// Top-level documents made by the test, with the theme and a bundle of the package entries through the package's real export map
// (so there is no docs page, no aggregate and no iframe), where script focus() and key presses behave the same in every engine.
const TAG_ENTRY = `
  import '@charm-ux/velcro/tag';
  import * as localize from '@charm-ux/velcro/utilities/localize';
  import en from '@charm-ux/velcro/translations/en';
  window.tagModules = { localize, en };
`;
const CLASS_ENTRY = `
  import { SlTag, VelcroTag } from '@charm-ux/velcro/tag/class';
  import { SlIconButton } from '@charm-ux/velcro/icon-button/class';
  import { SlIcon } from '@charm-ux/velcro/icon/class';
  window.tagClass = { SlTag, VelcroTag, SlIconButton, SlIcon };
`;
const bundles = new Map();

async function bundleOf(source) {
  if (bundles.has(source)) return bundles.get(source);
  const fromDocs = createRequire(path.join(docsDir, 'package.json'));
  const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
  const dir = mkdtempSync(path.join(tmpdir(), 'velcro-tag-entry-'));
  try {
    const entry = path.join(dir, 'entry.js');
    writeFileSync(entry, source);
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
    const code = (Array.isArray(out) ? out[0] : out).output.find(o => o.type === 'chunk').code;
    bundles.set(source, code);
    return code;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function loadBundle(page, source) {
  const code = await bundleOf(source);
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  const themeCss = readFileSync(path.join(velcroDir, 'themes/light.css'), 'utf8');
  await page.setContent('<!DOCTYPE html><html class="sl-theme-light" lang="en"><body></body></html>');
  await page.addStyleTag({ content: themeCss });
  await page.addScriptTag({ type: 'module', content: code });
  await page.waitForFunction(() => Boolean(window.tagModules || window.tagClass));
  return pageErrors;
}

test.describe('top-level documents', () => {
  test('keyboard: the remove button is not a tab stop (tabindex -1 on the sl-icon-button), the tag is not focusable, Tab walks past both, and once the button has focus Enter and Space press it while Delete and Backspace do nothing', async ({ page }) => {
    const pageErrors = await loadBundle(page, TAG_ENTRY);
    await page.evaluate(async () => {
      document.body.innerHTML = '<button id="before">before</button><sl-tag id="t" removable>Label</sl-tag><sl-icon-button id="control" name="gear" label="Control"></sl-icon-button><button id="after">after</button>';
      await document.querySelector('#t').updateComplete;
      window.log = [];
      document.querySelector('#t').addEventListener('sl-remove', () => window.log.push('sl-remove'));
    });
    const active = () => page.evaluate(() => {
      let el = document.activeElement;
      const path = [];
      while (el) {
        path.push(el.id || el.localName);
        el = el.shadowRoot?.activeElement ?? null;
      }
      return path.join('>');
    });
    await page.locator('#before').focus();
    expect(await active()).toBe('before');
    // The standalone icon button is a tab stop (Tab reaches the inner button): this is the positive control that Tab does enter shadow trees.
    await page.keyboard.press('Tab');
    await expect.poll(active).toBe('control>button');
    await page.keyboard.press('Shift+Tab');
    await expect.poll(active).toBe('before');
    expect(await page.evaluate(() => window.log)).toEqual([]);
    // The tag itself and its remove button cannot be focused from script as tab stops either: the tag has no tabindex.
    expect(await page.evaluate(() => {
      const tag = document.querySelector('#t');
      tag.focus();
      return [document.activeElement === tag, tag.hasAttribute('tabindex'), tag.shadowRoot.querySelector('sl-icon-button').getAttribute('tabindex')];
    })).toEqual([false, false, '-1']);
    // Nothing handles Delete or Backspace: neither a key press with the remove button focused (by script) nor keydown events
    // dispatched on the tag, its remove button and the document emit sl-remove.
    await page.evaluate(() => document.querySelector('#t').shadowRoot.querySelector('sl-icon-button').focus());
    expect(await active()).toBe('t>sl-icon-button>button');
    await page.keyboard.press('Delete');
    await page.keyboard.press('Backspace');
    await page.evaluate(() => {
      const tag = document.querySelector('#t');
      const button = tag.shadowRoot.querySelector('sl-icon-button');
      for (const target of [tag, button, document.body]) {
        for (const key of ['Delete', 'Backspace']) target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }));
      }
    });
    expect(await page.evaluate(() => window.log)).toEqual([]);
    // Once something has put focus on the button (script here; a pointer press does it too), it is a native button: Enter and
    // Space activate it. Only Tab cannot reach it.
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => window.log)).toEqual(['sl-remove']);
    await page.keyboard.press('Space');
    expect(await page.evaluate(() => window.log)).toEqual(['sl-remove', 'sl-remove']);
    expect(pageErrors).toEqual([]);
  });

  test('a pointer click on the remove button emits sl-remove once, from the tag', async ({ page }) => {
    const pageErrors = await loadBundle(page, TAG_ENTRY);
    await page.evaluate(async () => {
      document.body.innerHTML = '<sl-tag id="t" removable>Label</sl-tag>';
      await document.querySelector('#t').updateComplete;
      window.log = [];
      document.querySelector('#t').addEventListener('sl-remove', e => window.log.push([e.type, e.target.id]));
    });
    await page.locator('#t sl-icon-button').click();
    expect(await page.evaluate(() => window.log)).toEqual([['sl-remove', 't']]);
    expect(pageErrors).toEqual([]);
  });
});

// The class-only entry (@charm-ux/velcro/tag/class), bundled alone: no registering entry, no aggregate and no docs page. Shoelace's
// tag declares sl-icon-button in `static dependencies`, and its base element defines each missing dependency when a tag is
// constructed; Velcro's does the same (and the icon button defines sl-icon in turn).
test.describe('class-only entry', () => {
  test('importing defines nothing; constructing a tag defines Velcro\'s sl-icon-button, and its remove button defines sl-icon, so the icon renders', async ({ page }) => {
    const pageErrors = await loadBundle(page, CLASS_ENTRY);
    const r = await page.evaluate(async () => {
      const { SlTag, VelcroTag } = window.tagClass;
      const tags = () => ['sl-tag', 'sl-icon-button', 'sl-icon'].map(t => customElements.get(t)?.name ?? null);
      const afterImport = tags();
      customElements.define('sl-tag', SlTag);
      const afterDefine = tags();
      const tag = document.createElement('sl-tag');
      tag.removable = true;
      tag.textContent = 'Label';
      document.body.append(tag);
      await tag.updateComplete;
      const afterConstruct = tags();
      const button = tag.shadowRoot.querySelector('sl-icon-button');
      await button.updateComplete;
      const icon = button.shadowRoot.querySelector('sl-icon');
      await icon.updateComplete;
      return {
        afterImport, afterDefine, afterConstruct, alias: SlTag === VelcroTag,
        classes: [button instanceof customElements.get('sl-icon-button'), icon instanceof customElements.get('sl-icon')],
        name: icon.getAttribute('name'),
      };
    });
    expect(r).toEqual({
      afterImport: [null, null, null], afterDefine: ['VelcroTag', null, null], afterConstruct: ['VelcroTag', 'VelcroIconButton', 'VelcroIcon'], alias: true,
      classes: [true, true], name: 'x-lg',
    });
    await expect.poll(() => page.locator('sl-tag').evaluate(t => Boolean(t.shadowRoot.querySelector('sl-icon-button').shadowRoot.querySelector('sl-icon').shadowRoot?.querySelector('svg')))).toBe(true);
    const box = await page.locator('sl-tag').evaluate(t => t.shadowRoot.querySelector('sl-icon-button').shadowRoot.querySelector('sl-icon').getBoundingClientRect().width);
    expect(box).toBeGreaterThan(0);
    expect(pageErrors).toEqual([]);
  });

  // The platform refuses to define one constructor under two names; Shoelace then defines an anonymous subclass.
  test('when the icon button class is already defined under another tag, constructing a tag defines sl-icon-button as a subclass of it', async ({ page }) => {
    const pageErrors = await loadBundle(page, CLASS_ENTRY);
    const r = await page.evaluate(async () => {
      const { SlTag, SlIconButton } = window.tagClass;
      customElements.define('my-icon-button', SlIconButton);
      customElements.define('sl-tag', SlTag);
      const tag = document.createElement('sl-tag');
      tag.removable = true;
      document.body.append(tag);
      await tag.updateComplete;
      const defined = customElements.get('sl-icon-button');
      const button = tag.shadowRoot.querySelector('sl-icon-button');
      await button.updateComplete;
      return {
        tag: tag instanceof SlTag, mine: customElements.get('my-icon-button') === SlIconButton,
        subclass: Boolean(defined) && defined !== SlIconButton && defined.prototype instanceof SlIconButton, button: button instanceof defined,
        label: button.label,
      };
    });
    expect(r).toEqual({ tag: true, mine: true, subclass: true, button: true, label: 'Remove' });
    expect(pageErrors).toEqual([]);
  });

  test('an sl-icon-button another constructor already owns is left in place, without an error, and receives the remove button\'s properties', async ({ page }) => {
    const pageErrors = await loadBundle(page, CLASS_ENTRY);
    const r = await page.evaluate(async () => {
      class OtherButton extends HTMLElement {}
      customElements.define('sl-icon-button', OtherButton);
      customElements.define('sl-tag', window.tagClass.SlTag);
      const tag = document.createElement('sl-tag');
      tag.removable = true;
      document.body.append(tag);
      await tag.updateComplete;
      const button = tag.shadowRoot.querySelector('sl-icon-button');
      return [customElements.get('sl-icon-button') === OtherButton, button instanceof OtherButton, button.getAttribute('name'), button.getAttribute('label')];
    });
    expect(r).toEqual([true, true, 'x-lg', 'Remove']);
    expect(pageErrors).toEqual([]);
  });
});
