import { readdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { bundleExamples, docsDir, loadBundle, loadExamples } from './support/bundle.mjs';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';
import { reactWrapperPage } from './support/react.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/breadcrumb';
// Shoelace 2.20.1's breadcrumb page has seven previews (the opening one, Breadcrumb Links, Custom Separators, Prefixes,
// Suffixes and the two of With Dropdowns), all ported in Shoelace's order, each live and with a React version.
const ORDER = [
  ['basic', 'Default'], ['links', 'Breadcrumb Links'], ['separators', 'Custom Separators'], ['prefixes', 'Prefixes'],
  ['suffixes', 'Suffixes'], ['dropdowns', 'With Dropdowns'], ['dropdowns-suffix', 'With Dropdowns: in a suffix'],
];
const title = section => `Breadcrumb example: ${section}`;

async function openExample(page, section = 'Default') {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  const frame = page.frameLocator(`iframe.example[title="${title(section)}"]`);
  await expect(frame.locator('sl-breadcrumb-item').first()).toBeVisible();
  await frame.locator('body').evaluate(async () => {
    await Promise.all(['sl-breadcrumb', 'sl-breadcrumb-item', 'sl-icon'].map(t => customElements.whenDefined(t)));
    await Promise.all([...document.querySelectorAll('sl-breadcrumb, sl-breadcrumb-item, sl-dropdown, sl-button')].map(el => el.updateComplete));
    await new Promise(r => setTimeout(r, 50));
  });
  // Rendering only: a test that reads the requests waits for the network to go quiet itself (documentsLoaded).
  return { frame, requests };
}

// The package entries, in a top-level document of the test's own.
const ENTRY = `
  import '@charm-ux/velcro/breadcrumb';
  import '@charm-ux/velcro/breadcrumb-item';
  window.loaded = true;
`;
const CLASS_ENTRY = `
  import { SlBreadcrumb, VelcroBreadcrumb } from '@charm-ux/velcro/breadcrumb/class';
  window.breadcrumbClass = { SlBreadcrumb, VelcroBreadcrumb };
  window.loaded = true;
`;

const ITEMS = `<sl-breadcrumb-item id="i1">One</sl-breadcrumb-item><sl-breadcrumb-item id="i2">Two</sl-breadcrumb-item><sl-breadcrumb-item id="i3">Three</sl-breadcrumb-item>`;

// Replaces the document with a breadcrumb (id b) and waits for it, its items and the separator clones.
async function mount(page, markup = ITEMS, attrs = '') {
  await page.evaluate(async ([markup, attrs]) => {
    document.body.innerHTML = `<sl-breadcrumb id="b" ${attrs}>${markup}</sl-breadcrumb>`;
    await Promise.all([...document.querySelectorAll('sl-breadcrumb, sl-breadcrumb-item')].map(el => el.updateComplete));
    await new Promise(r => setTimeout(r, 50));
  }, [markup, attrs]);
}

// Each item's separators in its light DOM ([tag, name, data-default, ids]) and its aria-current.
const itemState = page => page.evaluate(() => [...document.querySelectorAll('#b > sl-breadcrumb-item')].map(item => ({
  id: item.id,
  separators: [...item.querySelectorAll(':scope > [slot="separator"]')].map(s => [s.localName, s.getAttribute('name') ?? s.textContent, s.hasAttribute('data-default'), [s, ...s.querySelectorAll('*')].filter(e => e.id).length]),
  current: item.getAttribute('aria-current'),
})));

test('docs page is prerendered with Velcro branding, prototype status, every ported section in order, the quirks and the gaps', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Breadcrumb - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('without changing the shared core prefix');
  expect(html).toContain('was run locally in Chromium and WebKit only, and Firefox is covered only by the project&#39;s CI run');
  expect(html).toContain('Playwright&#39;s ARIA snapshot');
  expect(html).toContain('has no translation term for breadcrumbs');
  expect(html).toContain('the &lt;nav&gt; has aria-label=&quot;&quot; and no accessible name');
  expect(html).toContain('replacing the separator slot&#39;s content later leaves the items&#39; old separators in place');
  expect(html).toContain('the React version of With Dropdowns places the dropdown in the item&#39;s suffix slot');
  const positions = ORDER.map(([, section]) => html.indexOf(`title="${title(section)}"`));
  expect(positions.every(p => p > 0)).toBe(true);
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  // The API tables: label, the two slots, the base part; ready is labelled as inherited.
  expect(html).toContain('data-name="label"');
  expect(html).toContain('data-name="separator"');
  expect(html).toContain('(default)');
  expect(html).toContain('Inherited from core');
  expect(html).toContain('<summary>React</summary>');
  expect(html).toContain('import { VelcroBreadcrumb as SlBreadcrumb } from &#39;@charm-ux/velcro/react/VelcroBreadcrumb.js&#39;;');
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(await (await request.get('/')).text()).toContain('/components/breadcrumb');
});

test('examples: Shoelace\'s order, live in their own documents, with a React version each; no Shoelace runtime is requested', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  await documentsLoaded(page);
  const titles = await page.locator('iframe.example').evaluateAll(frames => frames.map(f => f.title));
  expect(titles).toEqual(ORDER.map(([, section]) => title(section)));
  const counts = [];
  for (const [, section] of ORDER) {
    counts.push(await page.frameLocator(`iframe.example[title="${title(section)}"]`).locator('sl-breadcrumb-item').count());
  }
  expect(counts).toEqual([4, 4, 9, 3, 3, 4, 4]);
  // The opening example: four buttons with Shoelace's labels, the last is the current page.
  const labels = await frame.locator('sl-breadcrumb-item').evaluateAll(items => items.map(i => [i.shadowRoot.querySelector('[part="label"]').localName, i.textContent.trim(), i.getAttribute('aria-current')]));
  expect(labels).toEqual([['button', 'Catalog', null], ['button', 'Clothing', null], ['button', 'Women\'s', null], ['button', 'Shirts & Tops', 'page']]);
  const files = dir => readdirSync(path.join(docsDir, 'examples/breadcrumb', dir)).filter(f => /\.(html|jsx)$/.test(f)).sort();
  expect(files('')).toEqual(ORDER.map(([id]) => `${id}.html`).sort());
  expect(files('react')).toEqual(ORDER.map(([id]) => `${id}.jsx`).sort());
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
});

test('Breadcrumb Links, Custom Separators, Prefixes and Suffixes examples: links, the three separators, and the prefix and suffix icons', async ({ page }) => {
  await openExample(page);
  const links = await page.frameLocator(`iframe.example[title="${title('Breadcrumb Links')}"]`).locator('sl-breadcrumb-item').evaluateAll(items => items.map(i => {
    const label = i.shadowRoot.querySelector('[part="label"]');
    return [label.localName, label.getAttribute('href'), label.hasAttribute('target'), label.hasAttribute('rel')];
  }));
  expect(links).toEqual([
    ['a', 'https://example.com/home', false, false],
    ['a', 'https://example.com/home/services', false, false],
    ['a', 'https://example.com/home/services/digital', false, false],
    ['a', 'https://example.com/home/services/digital/web-design', false, false],
  ]);
  const separators = await page.frameLocator(`iframe.example[title="${title('Custom Separators')}"]`).locator('sl-breadcrumb').evaluateAll(crumbs => crumbs.map(b => [...b.querySelectorAll('sl-breadcrumb-item')].map(i => {
    const s = i.querySelector('[slot="separator"]');
    return `${s.localName}:${s.getAttribute('name') ?? s.textContent}`;
  })));
  expect(separators).toEqual([['sl-icon:dot', 'sl-icon:dot', 'sl-icon:dot'], ['sl-icon:arrow-right', 'sl-icon:arrow-right', 'sl-icon:arrow-right'], ['span:/', 'span:/', 'span:/']]);
  const prefix = await page.frameLocator(`iframe.example[title="${title('Prefixes')}"]`).locator('sl-breadcrumb-item').first().evaluate(i => [i.querySelector('[slot="prefix"]').getAttribute('name'), i.shadowRoot.querySelector('[part="base"]').classList.value.trim()]);
  expect(prefix).toEqual(['house', 'breadcrumb-item breadcrumb-item--has-prefix']);
  const suffix = await page.frameLocator(`iframe.example[title="${title('Suffixes')}"]`).locator('sl-breadcrumb-item').last().evaluate(i => [i.querySelector('[slot="suffix"]').getAttribute('name'), i.shadowRoot.querySelector('[part="base"]').classList.value.trim()]);
  expect(suffix).toEqual(['shield-lock', 'breadcrumb-item breadcrumb-item--has-suffix']);
});

test('With Dropdowns examples: an item holding a dropdown renders a div label; the dropdown opens its menu, in the default slot and in a suffix', async ({ page }) => {
  await openExample(page);
  for (const [section, index, label] of [['With Dropdowns', 1, 'div'], ['With Dropdowns: in a suffix', 3, 'button']]) {
    const frame = page.frameLocator(`iframe.example[title="${title(section)}"]`);
    const item = frame.locator('sl-breadcrumb-item').nth(index);
    expect(await item.evaluate(i => i.shadowRoot.querySelector('[part="label"]').localName)).toBe(label);
    await expect(frame.locator('sl-menu')).toBeHidden();
    await frame.locator('sl-button').click();
    await expect(frame.locator('sl-dropdown')).toHaveAttribute('open', '');
    await expect(frame.locator('sl-menu')).toBeVisible();
    await expect(frame.locator('sl-menu-item[checked]')).toHaveText('Web Design');
  }
});

test('sl-breadcrumb registers as the exported class with sl-icon, with the base name breadcrumb, no core marker and no ch-* definitions', async ({ page }) => {
  const { frame } = await openExample(page);
  const info = await frame.locator('sl-breadcrumb').first().evaluate(el => {
    const ctor = customElements.get('sl-breadcrumb');
    return {
      baseName: ctor.baseName, instance: el instanceof ctor, viaConstructor: new ctor().localName,
      icon: customElements.get('sl-icon')?.baseName,
      chDefined: ['ch-breadcrumb', 'ch-breadcrumb-item'].filter(t => customElements.get(t)),
      attrs: el.getAttributeNames().sort(), observed: [...ctor.observedAttributes].sort(),
    };
  });
  expect(info).toEqual({ baseName: 'breadcrumb', instance: true, viaConstructor: 'sl-breadcrumb', icon: 'icon', chDefined: [], attrs: [], observed: ['dir', 'label', 'lang'] });
});

test('the breadcrumb entry registers sl-breadcrumb and sl-icon but not sl-breadcrumb-item', async ({ page }) => {
  const pageErrors = await loadBundle(page, `import '@charm-ux/velcro/breadcrumb'; window.loaded = true;`);
  const tags = await page.evaluate(() => ['sl-breadcrumb', 'sl-icon', 'sl-breadcrumb-item'].map(t => customElements.get(t)?.name ?? null));
  expect(tags).toEqual(['VelcroBreadcrumb', 'VelcroIcon', null]);
  expect(pageErrors).toEqual([]);
});

test('class-only entry: importing defines nothing; constructing a breadcrumb defines Velcro\'s sl-icon, but not sl-breadcrumb-item', async ({ page }) => {
  const pageErrors = await loadBundle(page, CLASS_ENTRY);
  const r = await page.evaluate(() => {
    const { SlBreadcrumb, VelcroBreadcrumb } = window.breadcrumbClass;
    const tags = () => ['sl-breadcrumb', 'sl-icon', 'sl-breadcrumb-item'].map(t => customElements.get(t)?.name ?? null);
    const afterImport = tags();
    customElements.define('sl-breadcrumb', SlBreadcrumb);
    document.body.append(document.createElement('sl-breadcrumb'));
    return { afterImport, afterConstruct: tags(), alias: SlBreadcrumb === VelcroBreadcrumb };
  });
  expect(r).toEqual({ afterImport: [null, null, null], afterConstruct: ['VelcroBreadcrumb', 'VelcroIcon', null], alias: true });
  expect(pageErrors).toEqual([]);
});

test('class-only entry: an sl-icon tag owned by another constructor is left alone when a breadcrumb is constructed, and it renders that element', async ({ page }) => {
  const pageErrors = await loadBundle(page, CLASS_ENTRY, {
    beforeScript: () => {
      class OtherIcon extends HTMLElement {}
      customElements.define('sl-icon', OtherIcon);
      window.OtherIcon = OtherIcon;
    },
  });
  const r = await page.evaluate(async () => {
    customElements.define('sl-breadcrumb', window.breadcrumbClass.SlBreadcrumb);
    const el = document.createElement('sl-breadcrumb');
    document.body.append(el);
    await el.updateComplete;
    return { iconIsOther: customElements.get('sl-icon') === window.OtherIcon, rendered: el.shadowRoot.querySelector('sl-icon') instanceof window.OtherIcon };
  });
  expect(r).toEqual({ iconIsOther: true, rendered: true });
  expect(pageErrors).toEqual([]);
});

test('defaults: Shoelace\'s structure and part, a chevron separator cloned into every item, aria-current on the last item, and an empty aria-label (upstream quirk)', async ({ page }) => {
  const pageErrors = await loadBundle(page, ENTRY);
  await mount(page);
  const r = await page.evaluate(() => {
    const el = document.querySelector('#b');
    const nav = el.shadowRoot.querySelector('[part="base"]');
    const wrapper = el.shadowRoot.querySelector('span');
    const fallback = el.shadowRoot.querySelector('slot[name="separator"] > sl-icon');
    const cs = getComputedStyle(nav);
    return {
      shadow: [...el.shadowRoot.children].map(c => [c.localName, c.getAttribute('part'), c.className]),
      nav: [nav.localName, nav.getAttribute('aria-label'), nav.hasAttribute('aria-label')],
      wrapper: [wrapper.hidden, wrapper.getAttribute('aria-hidden'), getComputedStyle(wrapper).display],
      fallback: [fallback.getAttribute('name'), fallback.getAttribute('library')],
      slots: [el.defaultSlot === el.shadowRoot.querySelector('slot:not([name])'), el.separatorSlot.name],
      label: [el.label, el.hasAttribute('label')],
      layout: [getComputedStyle(el).display, cs.display, cs.alignItems, cs.flexWrap],
      separatorDisplay: [...el.querySelectorAll('sl-breadcrumb-item')].map(i => getComputedStyle(i.shadowRoot.querySelector('[part="separator"]')).display),
    };
  });
  expect(r).toEqual({
    shadow: [['nav', 'base', 'breadcrumb'], ['span', null, '']],
    nav: ['nav', '', true],
    wrapper: [true, 'true', 'none'],
    fallback: ['chevron-right', 'system'],
    slots: [true, 'separator'],
    label: ['', false],
    layout: ['inline', 'flex', 'center', 'wrap'],
    // The separator container is a flex item of the item's inline-flex base, so its inline-flex computes to flex.
    separatorDisplay: ['flex', 'flex', 'none'],
  });
  expect(await itemState(page)).toEqual([
    { id: 'i1', separators: [['sl-icon', 'chevron-right', true, 0]], current: null },
    { id: 'i2', separators: [['sl-icon', 'chevron-right', true, 0]], current: null },
    { id: 'i3', separators: [['sl-icon', 'chevron-right', true, 0]], current: 'page' },
  ]);
  expect(pageErrors).toEqual([]);
});

test('label is rendered as the nav\'s aria-label and is not reflected', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, ITEMS, 'label="Site"');
  const r = await page.evaluate(async () => {
    const el = document.querySelector('#b');
    const fromAttribute = el.shadowRoot.querySelector('nav').getAttribute('aria-label');
    el.label = 'Path';
    await el.updateComplete;
    return [fromAttribute, el.shadowRoot.querySelector('nav').getAttribute('aria-label'), el.getAttribute('label')];
  });
  expect(r).toEqual(['Site', 'Path', 'Site']);
});

test('accessibility tree (Playwright ARIA snapshot): a navigation landmark with its label and a button or link per item; the separators are hidden', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, `<sl-breadcrumb-item href="/catalog">Catalog</sl-breadcrumb-item><sl-breadcrumb-item>Docs</sl-breadcrumb-item><sl-breadcrumb-item>Page</sl-breadcrumb-item>`, 'label="Breadcrumbs"');
  await expect(page.locator('#b')).toMatchAriaSnapshot(`
    - navigation "Breadcrumbs":
      - link "Catalog":
        - /url: /catalog
      - button "Docs"
      - button "Page"
  `);
});

test('custom separators: only the first element in the separator slot is cloned (ids removed); an item\'s own separator is left alone (upstream quirk: the first element only)', async ({ page }) => {
  const pageErrors = await loadBundle(page, ENTRY);
  await mount(page, `
    <span slot="separator" id="sep">/<b id="inner">.</b></span><span slot="separator" id="second">|</span>
    <sl-breadcrumb-item id="i1">One</sl-breadcrumb-item>
    <sl-breadcrumb-item id="i2">Two<span slot="separator" id="own">&gt;</span></sl-breadcrumb-item>
    <sl-breadcrumb-item id="i3">Three</sl-breadcrumb-item>`);
  expect(await itemState(page)).toEqual([
    { id: 'i1', separators: [['span', '/.', true, 0]], current: null },
    { id: 'i2', separators: [['span', '>', false, 1]], current: null },
    { id: 'i3', separators: [['span', '/.', true, 0]], current: 'page' },
  ]);
  expect(pageErrors).toEqual([]);
});

test('upstream quirk: replacing the separator slot\'s content does not update the items until the default slot changes', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page);
  await page.evaluate(async () => {
    document.querySelector('#b').insertAdjacentHTML('afterbegin', '<span slot="separator">/</span>');
    await new Promise(r => setTimeout(r, 100));
  });
  expect((await itemState(page)).map(i => i.separators[0][1])).toEqual(['chevron-right', 'chevron-right', 'chevron-right']);
  await page.evaluate(async () => {
    document.querySelector('#b').insertAdjacentHTML('beforeend', '<sl-breadcrumb-item id="i4">Four</sl-breadcrumb-item>');
    await new Promise(r => setTimeout(r, 100));
  });
  // The default clones are replaced, not added to.
  expect(await itemState(page)).toEqual([
    { id: 'i1', separators: [['span', '/', true, 0]], current: null },
    { id: 'i2', separators: [['span', '/', true, 0]], current: null },
    { id: 'i3', separators: [['span', '/', true, 0]], current: null },
    { id: 'i4', separators: [['span', '/', true, 0]], current: 'page' },
  ]);
});

test('aria-current follows the last item when items are added or removed; other children get no separator and are never current (upstream quirk)', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page);
  await page.evaluate(async () => {
    document.querySelector('#i3').remove();
    await new Promise(r => setTimeout(r, 100));
  });
  expect((await itemState(page)).map(i => [i.id, i.current])).toEqual([['i1', null], ['i2', 'page']]);
  const other = await page.evaluate(async () => {
    const b = document.querySelector('#b');
    b.insertAdjacentHTML('beforeend', '<a id="plain" href="#x">Plain</a>');
    await new Promise(r => setTimeout(r, 100));
    const plain = document.querySelector('#plain');
    return [plain.getAttribute('aria-current'), plain.querySelectorAll('[slot="separator"]').length, document.querySelector('#i2').getAttribute('aria-current')];
  });
  expect(other).toEqual([null, 0, 'page']);
});

test('right-to-left: dir="rtl" (attribute or property) and a document direction change regenerate the default separators with chevron-left', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, ITEMS, 'dir="rtl"');
  const names = () => itemState(page).then(items => items.map(i => i.separators.map(s => s[1]).join()));
  expect(await names()).toEqual(['chevron-left', 'chevron-left', 'chevron-left']);
  // The property alone (dir is not reflected) is enough, as in Shoelace.
  await page.evaluate(async () => {
    const b = document.querySelector('#b');
    b.removeAttribute('dir');
    await new Promise(r => setTimeout(r, 100));
  });
  expect(await names()).toEqual(['chevron-right', 'chevron-right', 'chevron-right']);
  await page.evaluate(async () => {
    const b = document.querySelector('#b');
    b.dir = 'rtl';
    await new Promise(r => setTimeout(r, 100));
  });
  expect(await names()).toEqual(['chevron-left', 'chevron-left', 'chevron-left']);
  expect(await page.evaluate(() => document.querySelector('#b').hasAttribute('dir'))).toBe(false);
  // The document's direction, when the breadcrumb has none of its own.
  await page.evaluate(async () => {
    document.querySelector('#b').dir = '';
    await new Promise(r => setTimeout(r, 100));
    document.documentElement.dir = 'rtl';
    await new Promise(r => setTimeout(r, 100));
  });
  expect(await names()).toEqual(['chevron-left', 'chevron-left', 'chevron-left']);
  await page.evaluate(async () => {
    document.documentElement.dir = 'ltr';
    await new Promise(r => setTimeout(r, 100));
  });
  expect(await names()).toEqual(['chevron-right', 'chevron-right', 'chevron-right']);
});

test('dir and lang are reactive, not reflected and undefined by default, as Shoelace\'s base element declares them; ready is the only core event and does not bubble', async ({ page }) => {
  await loadBundle(page, ENTRY);
  const r = await page.evaluate(async () => {
    const el = document.createElement('sl-breadcrumb');
    const defaults = [el.dir, el.lang];
    const seen = [];
    el.addEventListener('ready', e => seen.push([e.bubbles, e.composed]));
    let bubbled = 0;
    document.body.addEventListener('ready', () => bubbled++);
    document.body.append(el);
    await el.updateComplete;
    el.dir = 'RTL';
    el.lang = 'ar';
    await el.updateComplete;
    const afterSet = [el.dir, el.lang, el.hasAttribute('dir'), el.hasAttribute('lang')];
    el.setAttribute('dir', 'ltr');
    await el.updateComplete;
    return { defaults, seen, bubbled, afterSet, fromAttribute: el.dir };
  });
  expect(r).toEqual({ defaults: [undefined, undefined], seen: [[false, false]], bubbled: 0, afterSet: ['RTL', 'ar', false, false], fromAttribute: 'ltr' });
});

// Shoelace's React examples, ported in packages/docs/examples/breadcrumb/react/*.jsx, bundled with React 19 and the generated wrappers.
test('React examples render the same breadcrumbs as the HTML examples through the generated wrappers', async ({ page }) => {
  const code = await bundleExamples('breadcrumb', ORDER.map(([id]) => id));
  const pageErrors = await loadExamples(page, code);
  const r = await page.evaluate(async () => {
    const out = {};
    for (const name of ['basic', 'links', 'separators', 'prefixes', 'suffixes', 'dropdowns', 'dropdowns-suffix']) {
      window.renderExample(name);
      await customElements.whenDefined('sl-breadcrumb');
      await new Promise(r => setTimeout(r, 100));
      out[name] = [...document.querySelectorAll(`#${name} sl-breadcrumb`)].map(b => [...b.querySelectorAll(':scope > sl-breadcrumb-item')].map(i => {
        const s = i.querySelector(':scope > [slot="separator"]');
        return [i.shadowRoot.querySelector('[part="label"]').localName, i.getAttribute('aria-current'), `${s.localName}:${s.getAttribute('name') ?? s.textContent}`];
      }));
    }
    return { out, errors: window.errors };
  });
  const chevrons = labels => labels.map((l, i) => [l, i === labels.length - 1 ? 'page' : null, 'sl-icon:chevron-right']);
  expect(r.out.basic).toEqual([chevrons(['button', 'button', 'button', 'button'])]);
  expect(r.out.links).toEqual([chevrons(['a', 'a', 'a', 'a'])]);
  expect(r.out.separators.map(b => b.map(i => i[2]))).toEqual([['sl-icon:dot', 'sl-icon:dot', 'sl-icon:dot'], ['sl-icon:arrow-right', 'sl-icon:arrow-right', 'sl-icon:arrow-right'], ['span:/', 'span:/', 'span:/']]);
  expect(r.out.prefixes).toEqual([chevrons(['button', 'button', 'button'])]);
  expect(r.out.suffixes).toEqual([chevrons(['button', 'button', 'button'])]);
  // As in Shoelace's React version, the first dropdown example puts the dropdown in the suffix slot, so its item is a button.
  expect(r.out.dropdowns).toEqual([chevrons(['button', 'button', 'button', 'button'])]);
  expect(r.out['dropdowns-suffix']).toEqual([chevrons(['button', 'button', 'button', 'button'])]);
  expect(r.errors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test.describe('React wrapper', () => {
  const mountWrapper = reactWrapperPage(test);
  test('VelcroBreadcrumb passes label and children through, and the items get their separators', async ({ page }) => {
    const errors = await mountWrapper(page);
    const r = await page.evaluate(async () => {
      window.renderWrapper('VelcroBreadcrumb', { label: 'Trail' }, '<sl-breadcrumb-item>A</sl-breadcrumb-item><sl-breadcrumb-item>B</sl-breadcrumb-item>');
      await customElements.whenDefined('sl-breadcrumb');
      await customElements.whenDefined('sl-breadcrumb-item');
      await new Promise(r => setTimeout(r, 100));
      const el = document.querySelector('#wrapped');
      return [el.label, el.shadowRoot.querySelector('nav').getAttribute('aria-label'), [...el.querySelectorAll('sl-breadcrumb-item')].map(i => [i.querySelectorAll('[slot="separator"]').length, i.getAttribute('aria-current')])];
    });
    expect(r).toEqual(['Trail', 'Trail', [[1, null], [1, 'page']]]);
    expect(errors).toEqual([]);
  });
});
