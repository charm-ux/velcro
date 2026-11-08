import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/tab';
const docsDir = fileURLToPath(new URL('../../packages/docs/', import.meta.url));
const velcroDir = fileURLToPath(new URL('../../packages/velcro/', import.meta.url));

async function openPage(page) {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  const frame = page.frameLocator('iframe.example[title="Tab example: Overview"]');
  await expect(frame.locator('#demo-default')).toBeVisible();
  await frame.locator('body').evaluate(async () => {
    await Promise.all(['sl-tab-group', 'sl-tab', 'sl-tab-panel'].map(t => customElements.whenDefined(t)));
    while (!document.querySelector('sl-tab[active]')) await new Promise(r => setTimeout(r, 20));
  });
  await documentsLoaded(page);
  return { frame, requests };
}

// Appends markup (outside the example's tab group) and waits for every sl-tab in it to render.
async function mount(frame, markup) {
  await frame.locator('body').evaluate(async (body, markup) => {
    const host = document.createElement('div');
    host.className = 'mount';
    host.innerHTML = markup;
    body.append(host);
    await Promise.all([...host.querySelectorAll('sl-tab')].map(el => el.updateComplete));
  }, markup);
}

test('docs page is prerendered with Velcro branding, prototype status, the example, the quirks and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Tab - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('without changing the shared core prefix');
  expect(html).toContain('title="Tab example: Overview"');
  expect(html).toContain('tab group examples');
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(await (await request.get('/')).text()).toContain('/components/tab');
});

test('sl-tab registers as the exported class, with sl-icon-button and sl-icon; the observed attributes are Shoelace\'s (plus tabindex), without core\'s selected', async ({ page }) => {
  const { frame, requests } = await openPage(page);
  const info = await frame.locator('#demo-default').evaluate(el => {
    const ctor = customElements.get('sl-tab');
    return {
      baseName: ctor.baseName, instance: el instanceof ctor, viaConstructor: new ctor().localName,
      deps: ['sl-icon-button', 'sl-icon'].map(t => customElements.get(t)?.baseName ?? null),
      chDefined: ['ch-tab', 'ch-tabs'].filter(t => customElements.get(t)),
      attrs: el.getAttributeNames().sort(),
      observed: [...ctor.observedAttributes].sort(),
    };
  });
  expect(info).toEqual({
    baseName: 'tab', instance: true, viaConstructor: 'sl-tab', deps: ['icon-button', 'icon'], chDefined: [],
    attrs: ['active', 'aria-controls', 'aria-disabled', 'aria-selected', 'id', 'panel', 'role', 'slot', 'tabindex'],
    observed: ['active', 'closable', 'dir', 'disabled', 'lang', 'panel', 'tabindex'],
  });
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
});

test('structure: a base div with the tab classes around the default slot; closable adds an sl-icon-button close button with Shoelace\'s parts, icon, localized label and tabindex -1', async ({ page }) => {
  const { frame } = await openPage(page);
  const r = await frame.locator('body').evaluate(() => {
    const describe = el => {
      const base = el.shadowRoot.querySelector('[part="base"]');
      const button = base.querySelector('sl-icon-button');
      return {
        children: [...el.shadowRoot.children].filter(n => n.localName !== 'style').map(n => n.localName),
        base: [base.localName, base.className.trim().split(/\s+/)],
        content: [...base.children].map(n => n.localName),
        button: button && [button.getAttribute('part'), button.getAttribute('exportparts'), button.name, button.library, button.label, button.getAttribute('tabindex'), [...button.classList]],
      };
    };
    const tabs = [...document.querySelectorAll('sl-tab')];
    return tabs.map(describe);
  });
  expect(r[0]).toEqual({ children: ['div'], base: ['div', ['tab', 'tab--active']], content: ['slot'], button: null });
  expect(r[2]).toEqual({ children: ['div'], base: ['div', ['tab', 'tab--closable']], content: ['slot', 'sl-icon-button'],
    button: ['close-button', 'base:close-button__base', 'x-lg', 'system', 'Close', '-1', ['tab__close-button']] });
  expect(r[3].base).toEqual(['div', ['tab', 'tab--disabled']]);
});

test('computed styles match Shoelace: neutral text, the primary color when active, half opacity when disabled, Shoelace\'s padding and font', async ({ page }) => {
  const { frame } = await openPage(page);
  const r = await frame.locator('body').evaluate(() => {
    const probe = decl => { const p = document.createElement('div'); p.style.cssText = decl; document.body.append(p); const cs = getComputedStyle(p); const out = { color: cs.color, padding: cs.padding, font: [cs.fontFamily, cs.fontSize, cs.fontWeight], radius: cs.borderTopLeftRadius, inlineEnd: cs.paddingRight }; p.remove(); return out; };
    const base = sel => getComputedStyle(document.querySelector(sel).shadowRoot.querySelector('[part="base"]'));
    const read = sel => { const cs = base(sel); return { display: cs.display, color: cs.color, opacity: cs.opacity, cursor: cs.cursor, padding: cs.padding, paddingRight: cs.paddingRight, whiteSpace: cs.whiteSpace, font: [cs.fontFamily, cs.fontSize, cs.fontWeight], radius: cs.borderTopLeftRadius }; };
    return {
      host: getComputedStyle(document.querySelector('#demo-default')).display,
      active: read('sl-tab[panel="general"]'), inactive: read('sl-tab[panel="custom"]'), closable: read('sl-tab[panel="closable"]'), disabled: read('sl-tab[panel="disabled"]'),
      primary: probe('color: var(--sl-color-primary-600)').color, neutral: probe('color: var(--sl-color-neutral-600)').color,
      expected: probe('padding: var(--sl-spacing-medium) var(--sl-spacing-large); font-family: var(--sl-font-sans); font-size: var(--sl-font-size-small); font-weight: var(--sl-font-weight-semibold); border-radius: var(--sl-border-radius-medium)'),
      small: probe('padding-right: var(--sl-spacing-small)').inlineEnd,
    };
  });
  // The host is display: inline-block, as in Shoelace; in a tab group's flex nav it is blockified.
  expect(r.host).toBe('block');
  expect(r.active).toMatchObject({ display: 'inline-flex', color: r.primary, opacity: '1', cursor: 'pointer', padding: r.expected.padding, whiteSpace: 'nowrap', font: r.expected.font, radius: r.expected.radius });
  expect(r.inactive.color).toBe(r.neutral);
  expect(r.closable.paddingRight).toBe(r.small);
  expect(r.disabled).toMatchObject({ opacity: '0.5', cursor: 'not-allowed', color: r.neutral });
});

test('properties: Shoelace\'s defaults, reflection and ARIA; removing a reflected attribute restores the first-render value; core\'s selected is inert; ready fires once without bubbling', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-tab id="t">Tab</sl-tab>');
  const r = await frame.locator('#t').evaluate(async el => {
    const defaults = [el.panel, el.active, el.closable, el.disabled, el.tabIndex, el.dir, el.lang, el.getAttribute('role'), el.getAttribute('aria-selected'), el.getAttribute('aria-disabled'), el.getAttribute('tabindex')];
    el.panel = 'p';
    el.active = true;
    el.closable = true;
    el.disabled = true;
    await el.updateComplete;
    const reflected = ['panel', 'active', 'closable', 'disabled', 'tabindex', 'aria-selected', 'aria-disabled'].map(a => el.getAttribute(a));
    for (const a of ['panel', 'active', 'closable', 'disabled', 'tabindex']) el.removeAttribute(a);
    await el.updateComplete;
    const restored = [el.panel, el.active, el.closable, el.disabled, el.tabIndex, el.getAttribute('tabindex')];
    el.selected = true;
    await el.updateComplete;
    const selected = [el.hasAttribute('selected'), el.getAttribute('aria-selected')];
    const fresh = document.createElement('sl-tab');
    const seen = [];
    fresh.addEventListener('ready', e => seen.push([e.bubbles, e.composed]));
    let bubbled = 0;
    document.body.addEventListener('ready', () => bubbled++);
    document.body.append(fresh);
    await fresh.updateComplete;
    fresh.active = true;
    await fresh.updateComplete;
    fresh.remove();
    return { defaults, reflected, restored, selected, seen, bubbled };
  });
  expect(r.defaults).toEqual(['', false, false, false, 0, undefined, undefined, 'tab', 'false', 'false', '0']);
  // A disabled tab that is active keeps tabindex 0.
  expect(r.reflected).toEqual(['p', '', '', '', '0', 'true', 'true']);
  // The values recorded at the first attribute change (the defaults here) come back, tabindex included.
  expect(r.restored).toEqual(['', false, false, false, 0, '0']);
  expect(r.selected).toEqual([false, 'false']);
  expect(r.seen).toEqual([[false, false]]);
  expect(r.bubbled).toBe(0);
});

test('removing a reflected attribute restores a value assigned before the first render, not the default; a removed Boolean attribute gives false', async ({ page }) => {
  const { frame } = await openPage(page);
  const r = await frame.locator('body').evaluate(async body => {
    const el = document.createElement('sl-tab');
    el.panel = 'early';
    el.closable = true;
    body.append(el);
    await el.updateComplete;
    const before = [el.getAttribute('panel'), el.hasAttribute('closable')];
    el.removeAttribute('panel');
    el.removeAttribute('closable');
    await el.updateComplete;
    return { before, after: [el.panel, el.closable, el.getAttribute('panel'), el.hasAttribute('closable')] };
  });
  expect(r).toEqual({ before: ['early', true], after: ['early', false, 'early', false] });
});

test('upstream quirk: the transition names the undefined --transition-speed, so the tab has no transition', async ({ page }) => {
  const { frame } = await openPage(page);
  const r = await frame.locator('#demo-default').evaluate(el => {
    const cs = getComputedStyle(el.shadowRoot.querySelector('[part="base"]'));
    return [cs.getPropertyValue('--transition-speed'), cs.transitionDuration, cs.transitionProperty];
  });
  expect(r).toEqual(['', '0s', 'all']);
});

test('upstream quirks: role, aria-selected and aria-disabled replace the page\'s values; a disabled active tab keeps tabindex 0; enabling sets tabindex 0', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-tab id="q" role="button" aria-selected="mixed" aria-disabled="mixed" active disabled>Q</sl-tab><sl-tab id="e" disabled tabindex="-1">E</sl-tab>');
  const r = await frame.locator('body').evaluate(async () => {
    const q = document.querySelector('#q');
    const e = document.querySelector('#e');
    const before = [q.getAttribute('role'), q.getAttribute('aria-selected'), q.getAttribute('aria-disabled'), q.getAttribute('tabindex'), e.getAttribute('tabindex')];
    e.disabled = false;
    await e.updateComplete;
    return { before, enabled: e.getAttribute('tabindex') };
  });
  expect(r).toEqual({ before: ['tab', 'true', 'true', '0', '-1'], enabled: '0' });
});

test('upstream quirk: the generated id is sl-tab-<n>, written at render; an id the page set is kept, and a removed one is regenerated at the next render', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-tab id="kept">K</sl-tab><sl-tab class="gen">G</sl-tab>');
  const r = await frame.locator('body').evaluate(async () => {
    const gen = document.querySelector('.gen');
    const generated = gen.id;
    const unconnected = document.createElement('sl-tab');
    gen.removeAttribute('id');
    gen.active = true;
    await gen.updateComplete;
    const next = document.createElement('sl-tab');
    document.body.append(next);
    await next.updateComplete;
    const n = s => Number(s.replace('sl-tab-', ''));
    return { kept: document.querySelector('#kept') !== null, pattern: /^sl-tab-\d+$/.test(generated), regenerated: gen.id === generated, skipped: n(next.id) - n(generated) >= 2, unconnected: unconnected.id };
  });
  expect(r).toEqual({ kept: true, pattern: true, regenerated: true, skipped: true, unconnected: '' });
});

test('the close button emits sl-close once, from the tab, bubbling and composed, not cancelable, with an empty detail; the click does not select the tab', async ({ page }) => {
  const { frame } = await openPage(page);
  const r = await frame.locator('body').evaluate(async () => {
    const tab = document.querySelector('sl-tab[closable]');
    const log = [];
    document.addEventListener('sl-close', e => log.push([e.target === tab, e.bubbles, e.composed, e.cancelable, JSON.stringify(e.detail)]));
    let clicks = 0;
    tab.addEventListener('click', () => clicks++);
    tab.shadowRoot.querySelector('sl-icon-button').click();
    await new Promise(r => setTimeout(r, 20));
    return { log, clicks, active: tab.active, connected: tab.isConnected };
  });
  expect(r).toEqual({ log: [[true, true, true, false, '{}']], clicks: 0, active: false, connected: true });
});

test('dir and lang are reactive, not reflected and undefined by default', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-tab id="dl" closable></sl-tab>');
  const r = await frame.locator('#dl').evaluate(async el => {
    const defaults = [el.dir, el.lang];
    el.dir = 'sideways';
    el.lang = 'de';
    await el.updateComplete;
    return { defaults, assigned: [el.dir, el.lang, el.getAttribute('dir'), el.getAttribute('lang')] };
  });
  expect(r).toEqual({ defaults: [undefined, undefined], assigned: ['sideways', 'de', null, null] });
});

test('accessibility tree (Playwright ARIA snapshot): the closable tab holds a Close button, which is also part of the tab\'s name', async ({ page }) => {
  const { frame } = await openPage(page);
  await expect(frame.locator('sl-tab[closable]')).toMatchAriaSnapshot(`
    - tab "Closable Close":
      - text: Closable
      - button "Close"
  `);
});

// The class-only entry, bundled alone. Shoelace's tab declares sl-icon-button in `static dependencies`, and its base element
// defines it when a tab is constructed; Velcro's does the same (and the icon button defines sl-icon in turn).
test('class-only entry: importing defines nothing; constructing a tab defines Velcro\'s sl-icon-button; another owner of the tag is left in place', async ({ page }) => {
  const fromDocs = createRequire(path.join(docsDir, 'package.json'));
  const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
  const dir = mkdtempSync(path.join(tmpdir(), 'velcro-tab-class-'));
  let code;
  try {
    writeFileSync(path.join(dir, 'entry.js'), `import { SlTab, VelcroTab } from '@charm-ux/velcro/tab/class';\nwindow.tabClass = { SlTab, VelcroTab };\n`);
    const out = await build({
      configFile: false, logLevel: 'silent', root: dir,
      plugins: [{ name: 'velcro-package-exports', async resolveId(id) { return id.startsWith('@charm-ux/velcro/') ? (await this.resolve(id, path.join(docsDir, 'app.ts'), { skipSelf: true })) ?? null : null; } }],
      build: { write: false, minify: false, rollupOptions: { input: path.join(dir, 'entry.js'), output: { format: 'es', codeSplitting: false } } },
    });
    code = (Array.isArray(out) ? out[0] : out).output.find(o => o.type === 'chunk').code;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  for (const preowned of [false, true]) {
    await page.goto('about:blank');
    await page.setContent('<!DOCTYPE html><html class="sl-theme-light" lang="en"><body></body></html>');
    await page.addStyleTag({ content: readFileSync(path.join(velcroDir, 'themes/light.css'), 'utf8') });
    await page.addScriptTag({ type: 'module', content: code });
    await page.waitForFunction(() => Boolean(window.tabClass));
    const r = await page.evaluate(async preowned => {
      const { SlTab, VelcroTab } = window.tabClass;
      if (preowned) customElements.define('sl-icon-button', class Other extends HTMLElement {});
      const tags = () => ['sl-tab', 'sl-icon-button', 'sl-icon'].map(t => customElements.get(t)?.name ?? null);
      const afterImport = tags();
      customElements.define('sl-tab', SlTab);
      const tab = document.createElement('sl-tab');
      tab.closable = true;
      document.body.append(tab);
      await tab.updateComplete;
      return { afterImport, afterConstruct: tags(), alias: SlTab === VelcroTab, label: tab.shadowRoot.querySelector('sl-icon-button').getAttribute('label') };
    }, preowned);
    expect(r).toEqual(preowned
      ? { afterImport: [null, 'Other', null], afterConstruct: ['VelcroTab', 'Other', null], alias: true, label: 'Close' }
      : { afterImport: [null, null, null], afterConstruct: ['VelcroTab', 'VelcroIconButton', 'VelcroIcon'], alias: true, label: 'Close' });
  }
  expect(pageErrors).toEqual([]);
});

test('no upstream Shoelace runtime is requested or defined; no request leaves the local origin', async ({ page }) => {
  const { frame, requests } = await openPage(page);
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  expect(await frame.locator('body').evaluate(() => Boolean(window.Shoelace))).toBe(false);
});
