import { readdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { bundleExamples, docsDir, loadBundle, loadExamples } from './support/bundle.mjs';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';
import { reactWrapperPage } from './support/react.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/breadcrumb-item';
const TITLE = 'Breadcrumb Item example: Default';

const ENTRY = `
  import '@charm-ux/velcro/breadcrumb';
  import '@charm-ux/velcro/breadcrumb-item';
  window.loaded = true;
`;
const CLASS_ENTRY = `
  import { SlBreadcrumbItem, VelcroBreadcrumbItem } from '@charm-ux/velcro/breadcrumb-item/class';
  window.itemClass = { SlBreadcrumbItem, VelcroBreadcrumbItem };
  window.loaded = true;
`;

// Replaces the document with `markup` and waits for every breadcrumb and item, including the label's slotchange.
async function mount(page, markup) {
  await page.evaluate(async markup => {
    document.body.innerHTML = markup;
    await Promise.all([...document.querySelectorAll('sl-breadcrumb, sl-breadcrumb-item')].map(el => el.updateComplete));
    await new Promise(r => setTimeout(r, 50));
  }, markup);
}

// The label element of item `id`: [tag, href, target, rel, type].
const label = (page, id) => page.evaluate(id => {
  const l = document.getElementById(id).shadowRoot.querySelector('[part="label"]');
  return [l.localName, l.getAttribute('href'), l.getAttribute('target'), l.getAttribute('rel'), l.getAttribute('type')];
}, id);

test('docs page is prerendered with Velcro branding, prototype status, the example, the quirks and the gaps', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Breadcrumb Item - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('without changing the shared core prefix');
  expect(html).toContain('was run locally in Chromium and WebKit only, and Firefox is covered only by the project&#39;s CI run');
  expect(html).toContain('an item with href but no label content stays a button');
  expect(html).toContain('without a target, the link has no rel attribute');
  expect(html).toContain(`title="${TITLE}"`);
  expect(html).toContain('data-name="href"');
  expect(html).toContain('data-name="rel"');
  expect(html).toContain('data-name="separator"');
  expect(html).toContain('Inherited from core');
  expect(html).toContain('<summary>React</summary>');
  expect(html).toContain('import { VelcroBreadcrumbItem as SlBreadcrumbItem } from &#39;@charm-ux/velcro/react/VelcroBreadcrumbItem.js&#39;;');
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(await (await request.get('/')).text()).toContain('/components/breadcrumb-item');
});

test('the example renders live in its own document with a React version; no Shoelace runtime is requested', async ({ page }) => {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  const frame = page.frameLocator(`iframe.example[title="${TITLE}"]`);
  await expect(frame.locator('sl-breadcrumb-item').first()).toBeVisible();
  await documentsLoaded(page);
  const items = await frame.locator('sl-breadcrumb-item').evaluateAll(items => items.map(i => [i.textContent.trim(), i.querySelector('[slot="prefix"]')?.getAttribute('name') ?? null, i.shadowRoot.querySelector('[part="base"]').classList.value.trim()]));
  expect(items).toEqual([
    ['Home', 'house', 'breadcrumb-item breadcrumb-item--has-prefix'],
    ['Clothing', null, 'breadcrumb-item'],
    ['Shirts', null, 'breadcrumb-item'],
  ]);
  expect(readdirSync(path.join(docsDir, 'examples/breadcrumb-item')).filter(f => f.endsWith('.html'))).toEqual(['basic.html']);
  expect(readdirSync(path.join(docsDir, 'examples/breadcrumb-item/react'))).toEqual(['basic.jsx']);
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
});

test('sl-breadcrumb-item registers as the exported class, alone (the item has no dependencies), with no core marker and no ch-* definitions', async ({ page }) => {
  const pageErrors = await loadBundle(page, `import '@charm-ux/velcro/breadcrumb-item'; window.loaded = true;`);
  const r = await page.evaluate(() => {
    const ctor = customElements.get('sl-breadcrumb-item');
    const el = document.createElement('sl-breadcrumb-item');
    document.body.append(el);
    return {
      name: ctor.name, baseName: ctor.baseName, tags: ['sl-breadcrumb', 'sl-icon'].map(t => customElements.get(t) ?? null),
      chDefined: ['ch-breadcrumb', 'ch-breadcrumb-item'].filter(t => customElements.get(t)), attrs: el.getAttributeNames(),
      observed: [...ctor.observedAttributes].sort(),
    };
  });
  expect(r).toEqual({ name: 'VelcroBreadcrumbItem', baseName: 'breadcrumb-item', tags: [null, null], chDefined: [], attrs: [], observed: ['dir', 'href', 'lang', 'rel', 'target'] });
  expect(pageErrors).toEqual([]);
});

test('class-only entry: importing defines nothing, and constructing an item defines nothing else', async ({ page }) => {
  const pageErrors = await loadBundle(page, CLASS_ENTRY);
  const r = await page.evaluate(() => {
    const { SlBreadcrumbItem, VelcroBreadcrumbItem } = window.itemClass;
    const tags = () => ['sl-breadcrumb-item', 'sl-breadcrumb', 'sl-icon'].map(t => customElements.get(t)?.name ?? null);
    const afterImport = tags();
    customElements.define('sl-breadcrumb-item', SlBreadcrumbItem);
    document.body.append(document.createElement('sl-breadcrumb-item'));
    return { afterImport, afterConstruct: tags(), alias: SlBreadcrumbItem === VelcroBreadcrumbItem };
  });
  expect(r).toEqual({ afterImport: [null, null, null], afterConstruct: ['VelcroBreadcrumbItem', null, null], alias: true });
  expect(pageErrors).toEqual([]);
});

test('defaults: a button label of type button, Shoelace\'s structure and parts, an aria-hidden separator container, and no property reflected', async ({ page }) => {
  const pageErrors = await loadBundle(page, ENTRY);
  await mount(page, '<sl-breadcrumb-item id="a">Alpha</sl-breadcrumb-item>');
  const r = await page.evaluate(() => {
    const el = document.getElementById('a');
    const base = el.shadowRoot.querySelector('[part="base"]');
    return {
      base: [base.localName, base.classList.value.trim()],
      children: [...base.children].map(c => [c.localName, c.getAttribute('part'), c.className, c.getAttribute('aria-hidden')]),
      props: [el.href, el.target, el.rel, el.defaultSlot === el.shadowRoot.querySelector('slot:not([name])')],
      attrs: el.getAttributeNames(),
      host: getComputedStyle(el).display,
    };
  });
  expect(r).toEqual({
    base: ['div', 'breadcrumb-item'],
    children: [
      ['span', 'prefix', 'breadcrumb-item__prefix', null],
      ['button', 'label', 'breadcrumb-item__label breadcrumb-item__label--button', null],
      ['span', 'suffix', 'breadcrumb-item__suffix', null],
      ['span', 'separator', 'breadcrumb-item__separator', 'true'],
    ],
    props: [undefined, undefined, 'noreferrer noopener', true],
    attrs: ['id'],
    host: 'inline-flex',
  });
  expect(await label(page, 'a')).toEqual(['button', null, null, null, 'button']);
  // Setting the properties reflects none of them.
  const attrs = await page.evaluate(async () => {
    const el = document.getElementById('a');
    el.href = '/x';
    el.target = '_blank';
    el.rel = 'external';
    await el.updateComplete;
    return el.getAttributeNames();
  });
  expect(attrs).toEqual(['id']);
  expect(pageErrors).toEqual([]);
});

test('href renders a link; target adds target and rel (default or supplied); changing href after the first render switches between link and button', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, `
    <sl-breadcrumb-item id="a" href="/a">A</sl-breadcrumb-item>
    <sl-breadcrumb-item id="b" href="/b" target="_blank">B</sl-breadcrumb-item>
    <sl-breadcrumb-item id="c" href="/c" target="_self" rel="external">C</sl-breadcrumb-item>
    <sl-breadcrumb-item id="d">D</sl-breadcrumb-item>`);
  expect(await label(page, 'a')).toEqual(['a', '/a', null, null, null]);
  expect(await label(page, 'b')).toEqual(['a', '/b', '_blank', 'noreferrer noopener', null]);
  expect(await label(page, 'c')).toEqual(['a', '/c', '_self', 'external', null]);
  await page.evaluate(async () => {
    const a = document.getElementById('a');
    const d = document.getElementById('d');
    a.removeAttribute('href');
    d.href = '/d';
    await Promise.all([a.updateComplete, d.updateComplete]);
    await new Promise(r => setTimeout(r, 50));
  });
  expect(await label(page, 'a')).toEqual(['button', null, null, null, 'button']);
  expect(await label(page, 'd')).toEqual(['a', '/d', null, null, null]);
});

test('upstream quirk: without a target, the link has no rel, even a supplied one', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, '<sl-breadcrumb-item id="a" href="/a" rel="external">A</sl-breadcrumb-item>');
  expect(await label(page, 'a')).toEqual(['a', '/a', null, null, null]);
});

test('upstream quirk: an item with href but no label content stays a button; adding content (a slotchange) makes it a link', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, '<sl-breadcrumb-item id="a" href="/a"></sl-breadcrumb-item>');
  expect(await label(page, 'a')).toEqual(['button', null, null, null, 'button']);
  await page.evaluate(async () => {
    document.getElementById('a').append(document.createElement('span'));
    await new Promise(r => setTimeout(r, 50));
  });
  expect(await label(page, 'a')).toEqual(['a', '/a', null, null, null]);
  // hrefChanged() and handleSlotChange() are public and recompute the label element.
  const r = await page.evaluate(async () => {
    const el = document.getElementById('a');
    el.innerHTML = '';
    const before = el.shadowRoot.querySelector('[part="label"]').localName;
    return [typeof el.hrefChanged, typeof el.handleSlotChange, before];
  });
  expect(r).toEqual(['function', 'function', 'a']);
});

test('an sl-dropdown among the default slot\'s elements renders a div label; href wins over it, and one in the suffix slot does not count', async ({ page }) => {
  await loadBundle(page, `${ENTRY}\nimport '@charm-ux/velcro/dropdown';`);
  await mount(page, `
    <sl-breadcrumb-item id="a"><sl-dropdown></sl-dropdown></sl-breadcrumb-item>
    <sl-breadcrumb-item id="b" href="/b"><sl-dropdown></sl-dropdown></sl-breadcrumb-item>
    <sl-breadcrumb-item id="c">C<sl-dropdown slot="suffix"></sl-dropdown></sl-breadcrumb-item>`);
  const classes = await page.evaluate(() => document.getElementById('a').shadowRoot.querySelector('[part="label"]').className);
  expect(classes).toBe('breadcrumb-item__label breadcrumb-item__label--drop-down');
  expect((await label(page, 'a'))[0]).toBe('div');
  expect((await label(page, 'b'))[0]).toBe('a');
  expect((await label(page, 'c'))[0]).toBe('button');
});

test('prefix and suffix: the --has-* classes add the spacing; the empty containers are still laid out as flex boxes (upstream quirk)', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, `
    <sl-breadcrumb-item id="a"><span slot="prefix">P</span>A<span slot="suffix">S</span></sl-breadcrumb-item>
    <sl-breadcrumb-item id="b">B</sl-breadcrumb-item>`);
  const r = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.margin = 'var(--sl-spacing-x-small)';
    document.body.append(probe);
    const space = getComputedStyle(probe).marginTop;
    probe.remove();
    const parts = id => {
      const root = document.getElementById(id).shadowRoot;
      const p = getComputedStyle(root.querySelector('[part="prefix"]'));
      const s = getComputedStyle(root.querySelector('[part="suffix"]'));
      return { className: root.querySelector('[part="base"]').classList.value.trim(), prefix: [p.display, p.marginInlineEnd], suffix: [s.display, s.marginInlineStart], prefixWidth: root.querySelector('[part="prefix"]').getBoundingClientRect().width };
    };
    return { space, a: parts('a'), b: parts('b') };
  });
  expect(r.a.className).toBe('breadcrumb-item breadcrumb-item--has-prefix breadcrumb-item--has-suffix');
  // Shoelace's inline-flex for a filled container computes to flex (a flex item of the inline-flex base); an empty one would
  // compute to none if the rule's display: none applied.
  expect(r.a.prefix).toEqual(['flex', r.space]);
  expect(r.a.suffix).toEqual(['flex', r.space]);
  expect(r.b).toEqual({ className: 'breadcrumb-item', prefix: ['flex', '0px'], suffix: ['flex', '0px'], prefixWidth: 0 });
  expect(r.space).toBe('8px');
});

test('Shoelace\'s styles: the label font and colors from the theme, primary on every item but the last, and the last item\'s separator hidden', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, '<sl-breadcrumb id="bc"><sl-breadcrumb-item id="a">A</sl-breadcrumb-item><sl-breadcrumb-item id="b">B</sl-breadcrumb-item></sl-breadcrumb>');
  const r = await page.evaluate(() => {
    const token = (prop, value) => {
      const probe = document.createElement('div');
      probe.style.setProperty(prop, value);
      document.body.append(probe);
      const out = getComputedStyle(probe).getPropertyValue(prop);
      probe.remove();
      return out;
    };
    const style = id => {
      const root = document.getElementById(id).shadowRoot;
      const base = getComputedStyle(root.querySelector('[part="base"]'));
      const l = getComputedStyle(root.querySelector('[part="label"]'));
      return { base: [base.fontFamily, base.fontSize, base.fontWeight, base.whiteSpace], label: [l.color, l.cursor, l.backgroundColor, l.borderTopStyle, l.paddingTop], separator: getComputedStyle(root.querySelector('[part="separator"]')).display };
    };
    return {
      expected: { font: [token('font-family', 'var(--sl-font-sans)'), token('font-size', 'var(--sl-font-size-small)'), token('font-weight', 'var(--sl-font-weight-semibold)')], primary: token('color', 'var(--sl-color-primary-600)'), neutral: token('color', 'var(--sl-color-neutral-600)') },
      a: style('a'), b: style('b'),
    };
  });
  expect(r.a.base).toEqual([...r.expected.font, 'nowrap']);
  expect(r.a.label).toEqual([r.expected.primary, 'pointer', 'rgba(0, 0, 0, 0)', 'none', '0px']);
  expect(r.b.label[0]).toBe(r.expected.neutral);
  // Shoelace's inline-flex computes to flex: the container is a flex item of the inline-flex base.
  expect([r.a.separator, r.b.separator]).toEqual(['flex', 'none']);
});

test('keyboard: Tab moves through the items\' buttons and links in order, with Shoelace\'s focus ring on :focus-visible', async ({ page, browserName }) => {
  await loadBundle(page, ENTRY);
  await mount(page, '<button id="before">before</button><sl-breadcrumb><sl-breadcrumb-item id="a" href="#a">A</sl-breadcrumb-item><sl-breadcrumb-item id="b">B</sl-breadcrumb-item></sl-breadcrumb>');
  await page.locator('#before').focus();
  const focused = () => page.evaluate(() => {
    const host = document.activeElement;
    const inner = host?.shadowRoot?.activeElement;
    return [host?.id, inner?.localName ?? null, inner ? getComputedStyle(inner).outlineStyle : null];
  });
  // WebKit on macOS moves focus to links only with Alt+Tab.
  const tab = browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';
  await page.keyboard.press(tab);
  expect(await focused()).toEqual(['a', 'a', 'solid']);
  await page.keyboard.press(tab);
  expect(await focused()).toEqual(['b', 'button', 'solid']);
});

test('dir and lang are reactive, not reflected and undefined by default; ready is the only core event and does not bubble', async ({ page }) => {
  await loadBundle(page, ENTRY);
  const r = await page.evaluate(async () => {
    const el = document.createElement('sl-breadcrumb-item');
    const defaults = [el.dir, el.lang];
    const seen = [];
    el.addEventListener('ready', e => seen.push([e.bubbles, e.composed]));
    document.body.append(el);
    await el.updateComplete;
    el.dir = 'rtl';
    el.lang = 'ar';
    await el.updateComplete;
    return { defaults, seen, afterSet: [el.dir, el.lang, el.hasAttribute('dir'), el.hasAttribute('lang')] };
  });
  expect(r).toEqual({ defaults: [undefined, undefined], seen: [[false, false]], afterSet: ['rtl', 'ar', false, false] });
});

test('the React example renders the same breadcrumb as the HTML example through the generated wrappers', async ({ page }) => {
  const code = await bundleExamples('breadcrumb-item', ['basic']);
  const pageErrors = await loadExamples(page, code);
  const r = await page.evaluate(async () => {
    window.renderExample('basic');
    await customElements.whenDefined('sl-breadcrumb');
    await new Promise(r => setTimeout(r, 100));
    return { items: [...document.querySelectorAll('#basic sl-breadcrumb-item')].map(i => [i.textContent.trim(), i.querySelector('[slot="prefix"]')?.getAttribute('name') ?? null, i.getAttribute('aria-current')]), errors: window.errors };
  });
  expect(r).toEqual({ items: [['Home', 'house', null], ['Clothing', null, null], ['Shirts', null, 'page']], errors: [] });
  expect(pageErrors).toEqual([]);
});

test.describe('React wrapper', () => {
  const mountWrapper = reactWrapperPage(test);
  test('VelcroBreadcrumbItem passes href, target and rel to the element', async ({ page }) => {
    const errors = await mountWrapper(page);
    const r = await page.evaluate(async () => {
      window.renderWrapper('VelcroBreadcrumbItem', { href: '/x', target: '_blank', rel: 'external' }, 'X');
      await customElements.whenDefined('sl-breadcrumb-item');
      await new Promise(r => setTimeout(r, 100));
      const l = document.querySelector('#wrapped').shadowRoot.querySelector('[part="label"]');
      return [l.localName, l.getAttribute('href'), l.getAttribute('target'), l.getAttribute('rel')];
    });
    expect(r).toEqual(['a', '/x', '_blank', 'external']);
    expect(errors).toEqual([]);
  });
});
