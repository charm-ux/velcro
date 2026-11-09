import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/menu-label';
const TITLE = 'Menu Label example: Menu labels in a menu';

async function openExample(page) {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  const frame = page.frameLocator(`iframe.example[title="${TITLE}"]`);
  await expect(frame.locator('sl-menu-label').first()).toBeVisible();
  await frame.locator('body').evaluate(async () => {
    await Promise.all(['sl-menu-label', 'sl-menu', 'sl-menu-item'].map(t => customElements.whenDefined(t)));
    await Promise.all([...document.querySelectorAll('sl-menu, sl-menu-item, sl-menu-label')].map(el => el.updateComplete));
  });
  await documentsLoaded(page);
  return { frame, requests };
}

// Appends markup to the example document and waits for every sl-menu-label in it to render.
async function mount(frame, markup) {
  await frame.locator('body').evaluate(async (body, markup) => {
    const host = document.createElement('div');
    host.id = 'mount';
    host.innerHTML = markup;
    body.append(host);
    await Promise.all([...host.querySelectorAll('sl-menu-label')].map(el => el.updateComplete));
  }, markup);
}

test('docs page is prerendered with Velcro branding, prototype status, the quirk and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Menu Label - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('without changing the shared core prefix');
  expect(html).toContain('with live sl-menu and sl-menu-item elements');
  expect(html).toContain('does not hide the label');
  // The verification wording says which engines ran locally and that Firefox is CI-only, and the accessibility-tree check is named for what it is.
  expect(html).toContain('was run locally in Chromium and WebKit only, and Firefox is covered only by the project&#39;s CI run');
  expect(html).toContain('Playwright&#39;s ARIA snapshot');
  expect(html).not.toMatch(/screen reader reads it/);
  // The ready event is the only event, labelled as inherited; the API tables list the base part and the default slot.
  expect(html).toContain('Inherited from core');
  expect(html).toContain('data-name="base"');
  expect(html).toContain('(default)');
  expect(html).toContain('<summary>React</summary>');
  expect(html).toContain('import { VelcroMenuLabel as SlMenuLabel } from &#39;@charm-ux/velcro/react/VelcroMenuLabel.js&#39;;');
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
  const home = await (await request.get('/')).text();
  expect(home).toContain('/components/menu-label');
});

test('sl-menu-label registers inside the example document as the exported class, with no core marker and no ch-* definitions', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  // The docs page loads the same runtime through its client entry (app-main.ts) into its own, separate registry.
  expect(await page.evaluate(() => customElements.whenDefined('sl-menu-label').then(ctor => typeof ctor))).toBe('function');
  const info = await frame.locator('body').evaluate(() => {
    const ctor = customElements.get('sl-menu-label');
    const el = document.querySelector('sl-menu-label');
    return {
      baseName: ctor?.baseName,
      coreTag: customElements.get('ch-menu-label') !== undefined,
      viaConstructor: ctor ? new ctor().localName : null,
      instance: el instanceof ctor,
      attrs: el.getAttributeNames(),
    };
  });
  expect(info).toEqual({ baseName: 'menu-label', coreTag: false, viaConstructor: 'sl-menu-label', instance: true, attrs: [] });
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
});

test('structure: one slot carrying the base part and the menu-label class, with the text assigned to it, and nothing else', async ({ page }) => {
  const { frame } = await openExample(page);
  const info = await frame.locator('sl-menu-label').first().evaluate(el => {
    const slot = el.shadowRoot.querySelector('slot');
    return {
      children: [...el.shadowRoot.children].filter(n => n.localName !== 'style').map(n => n.localName),
      slots: [...el.shadowRoot.querySelectorAll('slot')].map(s => s.name),
      parts: [...el.shadowRoot.querySelectorAll('[part]')].map(n => `${n.localName}:${n.getAttribute('part')}:${n.className}`),
      assigned: slot.assignedNodes().map(n => n.textContent),
      text: el.textContent,
    };
  });
  expect(info).toEqual({ children: ['slot'], slots: [''], parts: ['slot:base:menu-label'], assigned: ['Fruits'], text: 'Fruits' });
  expect(await frame.locator('sl-menu-label').first().evaluate(el => el.shadowRoot.querySelector('[part="base"]').getBoundingClientRect().height)).toBeGreaterThan(0);
});

test('computed styles match Shoelace: block host, inline-block base with the label font, color and padding from the theme tokens', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('sl-menu-label').first().evaluate(el => {
    const base = el.shadowRoot.querySelector('[part="base"]');
    const cs = getComputedStyle(base);
    // What each token resolves to in this document, measured on a probe so the test does not hard-code the theme.
    const probe = document.createElement('div');
    probe.style.cssText = 'font-family: var(--sl-font-sans); font-size: var(--sl-font-size-small); font-weight: var(--sl-font-weight-semibold); color: var(--sl-color-neutral-500); padding: var(--sl-spacing-2x-small) var(--sl-spacing-x-large); letter-spacing: var(--sl-letter-spacing-normal)';
    document.body.append(probe);
    const want = getComputedStyle(probe);
    const expected = { fontFamily: want.fontFamily, fontSize: want.fontSize, fontWeight: want.fontWeight, color: want.color, padding: want.padding, letterSpacing: want.letterSpacing };
    probe.remove();
    const lineHeight = Number.parseFloat(getComputedStyle(el).getPropertyValue('--sl-line-height-normal'));
    return {
      host: { display: getComputedStyle(el).display, boxSizing: getComputedStyle(el).boxSizing },
      base: {
        display: cs.display,
        fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight, color: cs.color, padding: cs.padding, letterSpacing: cs.letterSpacing,
        lineHeight: cs.lineHeight,
        userSelect: cs.userSelect || cs.webkitUserSelect,
      },
      expected,
      tokenLineHeight: lineHeight,
      height: base.getBoundingClientRect().height,
    };
  });
  expect(r.host).toEqual({ display: 'block', boxSizing: 'border-box' });
  expect(r.base.display).toBe('inline-block');
  expect(r.base.userSelect).toBe('none');
  expect({ ...r.base, lineHeight: undefined, userSelect: undefined, display: undefined }).toEqual({ ...r.expected, lineHeight: undefined, userSelect: undefined, display: undefined });
  expect(r.base.padding).toBe('4px 28px');
  expect(r.base.fontSize).toBe('14px');
  expect(r.base.fontWeight).toBe('500');
  // line-height is 1.8 of the 14px font; the box adds 4px of padding above and below.
  expect(r.tokenLineHeight).toBe(1.8);
  expect(Number.parseFloat(r.base.lineHeight)).toBeCloseTo(25.2, 1);
  expect(r.height).toBeCloseTo(33.2, 1);
});

test('the theme tokens drive the label: overriding them on the host or an ancestor changes the label', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-menu-label id="t" style="--sl-color-neutral-500: rgb(255, 0, 0); --sl-spacing-x-large: 10px; --sl-font-weight-semibold: 700">Tokens</sl-menu-label>');
  const r = await frame.locator('#t').evaluate(el => {
    const cs = getComputedStyle(el.shadowRoot.querySelector('[part="base"]'));
    return { color: cs.color, padding: cs.padding, weight: cs.fontWeight };
  });
  expect(r).toEqual({ color: 'rgb(255, 0, 0)', padding: '4px 10px', weight: '700' });
});

test('::part(base) from the page styles the label, and the label aligns with the menu items in the example', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('body').evaluate(() => {
    const [first, second] = document.querySelectorAll('sl-menu-label');
    const item = document.querySelector('sl-menu-item');
    const sheet = new CSSStyleSheet();
    sheet.replaceSync('sl-menu-label#styled::part(base) { text-transform: uppercase; }');
    document.adoptedStyleSheets = [sheet];
    first.id = 'styled';
    const left = el => el.getBoundingClientRect().left;
    return {
      uppercase: getComputedStyle(first.shadowRoot.querySelector('[part="base"]')).textTransform,
      untouched: getComputedStyle(second.shadowRoot.querySelector('[part="base"]')).textTransform,
      labelPadding: getComputedStyle(first.shadowRoot.querySelector('[part="base"]')).paddingLeft,
      itemLabelStart: item.shadowRoot.querySelector('.menu-item__label').getBoundingClientRect().left - left(item),
      hostWidth: first.getBoundingClientRect().width,
      menuWidth: first.parentElement.getBoundingClientRect().width,
    };
  });
  expect(r.uppercase).toBe('uppercase');
  expect(r.untouched).toBe('none');
  expect(r.labelPadding).toBe('28px');
  // Shoelace's design: an item's label starts after the item's 4px padding (--sl-spacing-2x-small) and its 1.5em check mark
  // column (24px at the 16px item font), which is exactly where the label's 28px start padding puts the label's own text.
  expect(r.itemLabelStart).toBe(parseFloat(r.labelPadding));
  // The host is a block, so it fills the 200px menu (less its 1px borders) while its base shrinks to the text.
  expect(r.hostWidth).toBe(r.menuWidth - 2);
});

test('long text wraps inside the label and the host grows with it', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<div style="width: 120px"><sl-menu-label id="short">Fruits</sl-menu-label><sl-menu-label id="long">A rather long group label that cannot fit on one line</sl-menu-label></div>');
  const r = await frame.locator('body').evaluate(() => {
    const box = id => {
      const el = document.querySelector(`#${id}`);
      return { host: el.getBoundingClientRect().height, base: el.shadowRoot.querySelector('[part="base"]').getBoundingClientRect().width };
    };
    return { short: box('short'), long: box('long') };
  });
  expect(r.long.host).toBeGreaterThan(r.short.host * 2);
  expect(r.long.base).toBeLessThanOrEqual(120);
  // The short label's base shrinks to its text; the long one fills the line.
  expect(r.short.base).toBeLessThan(120);
});

test('slotted content: elements and text nodes are assigned to the default slot and follow later changes', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-menu-label id="c">Plain <em>emphasis</em></sl-menu-label>');
  const r = await frame.locator('#c').evaluate(async el => {
    const slot = el.shadowRoot.querySelector('slot');
    const first = slot.assignedNodes().map(n => n.nodeName);
    el.append(' and more');
    await el.updateComplete;
    return { first, after: slot.assignedNodes().map(n => n.nodeName), text: el.innerText };
  });
  expect(r.first).toEqual(['#text', 'EM']);
  expect(r.after).toEqual(['#text', 'EM', '#text']);
  expect(r.text).toContain('Plain emphasis and more');
});

test('upstream quirk: the hidden attribute does not hide the label, because the host\'s own display: block outranks the browser rule', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-menu-label id="h" hidden>Hidden?</sl-menu-label>');
  const r = await frame.locator('#h').evaluate(async el => {
    const before = { display: getComputedStyle(el).display, boxes: el.getClientRects().length, hidden: el.hidden };
    // A page rule at author level does hide it; only the browser's default rule loses.
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
  expect(r.before).toEqual({ display: 'block', boxes: 1, hidden: true });
  expect(r.withInline).toBe('none');
  expect(r.baseHidden).toBe('none');
  await expect(frame.locator('#h')).toBeVisible();
});

test('semantics: no role, no ARIA, no focus stop and no relationship to the following items (DOM attributes and properties)', async ({ page }) => {
  const { frame } = await openExample(page);
  const info = await frame.locator('sl-menu-label').first().evaluate(el => ({
    attrs: el.getAttributeNames(),
    role: el.getAttribute('role'),
    tabIndex: el.tabIndex,
    ariaLabel: el.ariaLabel,
    shadowAria: [...el.shadowRoot.querySelectorAll('*')].flatMap(n => n.getAttributeNames().filter(a => a === 'role' || a.startsWith('aria-'))),
  }));
  // Shoelace supplies none of these; a page that wants a group label adds its own role or aria-label.
  expect(info).toEqual({ attrs: [], role: null, tabIndex: -1, ariaLabel: null, shadowAria: [] });
});

// Playwright's ARIA snapshot is computed by Playwright from the DOM (roles, names, aria-hidden, hidden and inert content),
// not read from the browser's native accessibility tree, and no screen reader is involved. It is a real accessibility-tree
// query, unlike text or visibility locators, which see aria-hidden content.
test('accessibility tree (Playwright ARIA snapshot): the labels are plain text between the items, and aria-hidden removes them', async ({ page }) => {
  const { frame } = await openExample(page);
  const menu = frame.locator('sl-menu');
  // In the real menu the labels are plain text between menu items (no role, no group name), around the separator.
  await expect(menu).toMatchAriaSnapshot(`
    - menu:
      - text: Fruits
      - menuitem "Apple"
      - menuitem "Banana"
      - menuitem "Orange"
      - separator
      - text: Vegetables
      - menuitem "Broccoli"
      - menuitem "Carrot"
      - menuitem "Zucchini"
  `);
  // On its own, each label is exactly its text.
  await expect(frame.locator('sl-menu-label').first()).toMatchAriaSnapshot('- text: Fruits');
  await expect(frame.locator('sl-menu-label').nth(1)).toMatchAriaSnapshot('- text: Vegetables');
  // Sensitivity: the same assertion style fails once an ancestor is aria-hidden, while the text is still in the DOM and visible.
  await mount(frame, '<div id="hide" aria-hidden="true"><sl-menu-label>Hidden label</sl-menu-label></div><div id="show"><sl-menu-label>Shown label</sl-menu-label></div>');
  await expect(frame.locator('#show')).toMatchAriaSnapshot('- text: Shown label');
  expect(await frame.locator('#hide').ariaSnapshot()).toBe('');
  await expect(frame.locator('#hide sl-menu-label')).toBeVisible();
  await expect(frame.locator('#hide sl-menu-label')).toHaveText('Hidden label');
});

test('user-select: the label cannot be selected as text, as in Shoelace (a double click on its text selects nothing)', async ({ page }) => {
  const { frame } = await openExample(page);
  // The same gesture on plain text selects the word, so the empty selection below comes from the label's style.
  const selection = () => frame.locator('body').evaluate(() => getSelection()?.toString());
  await mount(frame, '<p id="plain" style="margin: 0; padding: 8px 28px">Apple banana</p>');
  await frame.locator('#plain').dblclick({ position: { x: 40, y: 16 } });
  expect(await selection()).toBe('Apple');
  await frame.locator('body').evaluate(() => getSelection().removeAllRanges());
  await frame.locator('sl-menu-label').first().dblclick({ position: { x: 40, y: 16 } });
  expect(await selection()).toBe('');
});

test('dir and lang are reactive, not reflected and undefined by default, as Shoelace\'s base element declares them', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-menu-label id="dl">Lang</sl-menu-label><sl-menu-label id="attrs" dir="rtl" lang="de">Attrs</sl-menu-label>');
  const r = await frame.locator('body').evaluate(async () => {
    const el = document.querySelector('#dl');
    const attrs = document.querySelector('#attrs');
    const ctor = customElements.get('sl-menu-label');
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
    el.dir = '';
    const emptyString = el.dir;
    const fromAttributes = [attrs.dir, attrs.lang];
    attrs.removeAttribute('dir');
    attrs.removeAttribute('lang');
    await attrs.updateComplete;
    return { observed: [...ctor.observedAttributes].sort(), defaults, updateRequestedByDir, updateRequestedByLang, assigned, anyString, emptyString, fromAttributes, removed: [attrs.dir, attrs.lang] };
  });
  expect(r).toEqual({
    // Shoelace's list is dir and lang only: the menu label has no attribute of its own.
    observed: ['dir', 'lang'],
    defaults: [undefined, undefined],
    updateRequestedByDir: true,
    updateRequestedByLang: true,
    assigned: ['auto', 'fr', null, null],
    anyString: 'sideways',
    emptyString: '',
    fromAttributes: ['rtl', 'de'],
    removed: [null, null],
  });
});

test('no properties, methods or Shoelace events of its own; only the inherited core ready event, once, not bubbling or composed', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('body').evaluate(async body => {
    const el = document.createElement('sl-menu-label');
    const seen = [];
    let bubbled = 0;
    el.addEventListener('ready', event => seen.push({ bubbles: event.bubbles, composed: event.composed }));
    body.addEventListener('ready', () => bubbled++);
    el.textContent = 'Late';
    body.append(el);
    await el.updateComplete;
    el.dir = 'rtl';
    await el.updateComplete;
    // Own enumerable members declared by Velcro's class (the prototype and static side), beyond the base element's.
    const own = Object.getOwnPropertyNames(customElements.get('sl-menu-label').prototype).filter(n => n !== 'constructor').sort();
    el.remove();
    return { seen, bubbled, own };
  });
  expect(r.seen).toEqual([{ bubbles: false, composed: false }]);
  expect(r.bubbled).toBe(0);
  // Only the base element's dir and lang accessors, the private store behind dir, and render.
  expect(r.own).toEqual(['dir', 'lang', 'render'].sort());
});

test('the example renders two labels and a divider in a live menu in its own document', async ({ page }) => {
  await openDocs(page, PAGE);
  const titles = await page.locator('iframe.example').evaluateAll(frames => frames.map(f => f.title));
  expect(titles).toEqual([TITLE]);
  const frame = page.frameLocator('iframe.example');
  await expect(frame.locator('sl-menu-label').first()).toBeVisible();
  await expect(frame.locator('sl-menu-label')).toHaveText(['Fruits', 'Vegetables']);
  await expect(frame.locator('sl-divider')).toHaveCount(1);
  await expect(frame.locator('sl-menu-item')).toHaveText(['Apple', 'Banana', 'Orange', 'Broccoli', 'Carrot', 'Zucchini']);
  expect(await frame.locator('sl-menu-item').evaluateAll(items => items.map(i => i.value))).toEqual(['apple', 'banana', 'orange', 'broccoli', 'carrot', 'zucchini']);
  expect(await frame.locator('sl-menu-label').first().evaluate(el => Boolean(el.shadowRoot?.querySelector('[part~="base"]')))).toBe(true);
  // The menu has the 200px limit of Shoelace's example.
  expect(await frame.locator('sl-menu').evaluate(el => [el.getBoundingClientRect().width, el.getAttribute('role')])).toEqual([200, 'menu']);
});

// Shoelace's React example, ported in packages/docs/examples/menu-label/react/basic.jsx (the file the docs page shows),
// bundled with React 19 and the generated wrappers, which are resolved through the package's real export map.
test.describe('React example', () => {
  const velcroDir = fileURLToPath(new URL('../../packages/velcro/', import.meta.url));
  const docsDir = fileURLToPath(new URL('../../packages/docs/', import.meta.url));
  let bundle;

  test.beforeAll(async () => {
    const fromVelcro = createRequire(path.join(velcroDir, 'package.json'));
    const fromDocs = createRequire(path.join(docsDir, 'package.json'));
    const pkgDir = name => path.dirname(fromVelcro.resolve(`${name}/package.json`));
    const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
    const dir = mkdtempSync(path.join(tmpdir(), 'velcro-menu-label-react-'));
    try {
      // The example declares `App` without exporting it (as on Shoelace's page); the copy only appends the export.
      writeFileSync(path.join(dir, 'basic.jsx'), `${readFileSync(path.join(docsDir, 'examples/menu-label/react/basic.jsx'), 'utf8')}\nexport default App;\n`);
      const entry = path.join(dir, 'entry.js');
      writeFileSync(entry, `
        import React from 'react';
        import { flushSync } from 'react-dom';
        import { createRoot } from 'react-dom/client';
        import App from './basic.jsx';
        window.errors = [];
        addEventListener('error', e => window.errors.push(String(e.message)));
        addEventListener('unhandledrejection', e => window.errors.push(String(e.reason)));
        window.renderExample = () => {
          const host = document.createElement('div');
          document.body.append(host);
          flushSync(() => createRoot(host).render(React.createElement(App)));
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

  test('renders the same menu as the HTML example, through the generated wrappers, with the theme tokens applied', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    const themeCss = readFileSync(path.join(velcroDir, 'themes/light.css'), 'utf8');
    await page.setContent('<!DOCTYPE html><html class="sl-theme-light"><body style="margin: 0"></body></html>');
    await page.addStyleTag({ content: themeCss });
    await page.addScriptTag({ type: 'module', content: bundle });
    await page.waitForFunction(() => typeof window.renderExample === 'function');
    await page.evaluate(async () => {
      window.renderExample();
      await Promise.all(['sl-menu-label', 'sl-menu', 'sl-menu-item'].map(t => customElements.whenDefined(t)));
      await Promise.all([...document.querySelectorAll('sl-menu-label, sl-menu-item')].map(el => el.updateComplete));
    });
    const r = await page.evaluate(() => {
      const labels = [...document.querySelectorAll('sl-menu-label')];
      const cs = getComputedStyle(labels[0].shadowRoot.querySelector('[part="base"]'));
      return {
        labels: labels.map(l => l.textContent),
        dividers: document.querySelectorAll('sl-divider').length,
        items: [...document.querySelectorAll('sl-menu-item')].map(i => i.value),
        menuWidth: labels[0].parentElement.getBoundingClientRect().width,
        base: { display: cs.display, padding: cs.padding, fontSize: cs.fontSize, fontWeight: cs.fontWeight },
        errors: window.errors,
      };
    });
    expect(r).toEqual({
      labels: ['Fruits', 'Vegetables'],
      dividers: 1,
      items: ['apple', 'banana', 'orange', 'broccoli', 'carrot', 'zucchini'],
      menuWidth: 200,
      base: { display: 'inline-block', padding: '4px 28px', fontSize: '14px', fontWeight: '500' },
      errors: [],
    });
    expect(pageErrors).toEqual([]);
  });
});

test('no upstream Shoelace runtime is requested or defined; all requests stay on the local origin', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  expect(await frame.locator('body').evaluate(() => Boolean(window.Shoelace || document.querySelector('script[src*="shoelace"]')))).toBe(false);
});
