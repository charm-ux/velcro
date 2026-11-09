import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';
import { reactWrapperPage } from './support/react.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/option';
// Shoelace 2.20.1's option page has three examples, in this order; the last has no React version.
const ORDER = [['basic', 'Default', 'default'], ['disabled', 'Disabled', 'disabled'], ['prefix-suffix', 'Prefix &amp; Suffix', 'prefix-suffix']];
const SECTIONS = ORDER.map(([, section]) => section.replace('&amp;', '&'));
const title = section => `Option example: ${section}`;
const docsDir = fileURLToPath(new URL('../../packages/docs/', import.meta.url));
const velcroDir = fileURLToPath(new URL('../../packages/velcro/', import.meta.url));

async function openPage(page) {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  const frame = page.frameLocator(`iframe.example[title="${title('Default')}"]`);
  await expect(frame.locator('sl-select').first()).toBeVisible();
  await frame.locator('body').evaluate(() => customElements.whenDefined('sl-option'));
  // Rendering only: a test that reads the requests waits for the network to go quiet itself (documentsLoaded).
  return { frame, requests, example: section => page.frameLocator(`iframe.example[title="${title(section)}"]`) };
}

// Top-level documents made by the test, with the theme and a bundle of the package entries through the package's real export map.
const OPTION_ENTRY = `
  import '@charm-ux/velcro/option';
  window.optionModules = {};
`;
const SELECT_ENTRY = `
  import '@charm-ux/velcro/option';
  import '@charm-ux/velcro/select';
  window.optionModules = {};
`;
const CLASS_ENTRY = `
  import { SlOption, VelcroOption } from '@charm-ux/velcro/option/class';
  window.optionClass = { SlOption, VelcroOption };
`;
const bundles = new Map();

async function bundleOf(source) {
  if (bundles.has(source)) return bundles.get(source);
  const fromDocs = createRequire(path.join(docsDir, 'package.json'));
  const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
  const dir = mkdtempSync(path.join(tmpdir(), 'velcro-option-entry-'));
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

async function loadBundle(page, source = OPTION_ENTRY) {
  const code = await bundleOf(source);
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  const themeCss = readFileSync(path.join(velcroDir, 'themes/light.css'), 'utf8');
  await page.setContent('<!DOCTYPE html><html class="sl-theme-light" lang="en"><body></body></html>');
  await page.addStyleTag({ content: themeCss });
  await page.addScriptTag({ type: 'module', content: code });
  await page.waitForFunction(() => Boolean(window.optionModules || window.optionClass));
  return pageErrors;
}

async function mount(page, markup) {
  await page.evaluate(async markup => {
    document.body.innerHTML = markup;
    const all = [...document.querySelectorAll('sl-select, sl-option')];
    await Promise.all(all.map(el => el.updateComplete));
    await new Promise(r => setTimeout(r));
    await Promise.all(all.map(el => el.updateComplete));
  }, markup);
}

test('docs page is prerendered with Velcro branding, prototype status, every Shoelace section, the quirks and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Option - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('without changing the shared core prefix');
  const examplesPart = html.slice(html.indexOf('id="examples"'), html.indexOf('id="attributes"'));
  expect([...examplesPart.matchAll(/<h3 id="([^"]+)"><!--lit-part-->([^<]+)<!--\/lit-part--><\/h3>/g)].map(m => [m[1], m[2]])).toEqual(ORDER.map(([id, t]) => [id, t]));
  expect(html).toContain('Options define the selectable items within various form controls such as select.');
  expect(html.match(/<summary>React<\/summary>/g)).toHaveLength(2);
  expect(html).toContain('import { VelcroOption as SlOption } from &#39;@charm-ux/velcro/react/VelcroOption.js&#39;;');
  for (const name of ['value', 'disabled', 'getTextLabel', '(default)', 'prefix', 'suffix', 'checked-icon', 'base', 'label', 'ready']) {
    expect(html).toContain(`data-name="${name}"`);
  }
  expect(html).toContain('The hidden attribute does not hide the option');
  expect(html).toContain('A value containing spaces is not rejected');
  expect(html).toContain('getTextLabel() reads only the option&#39;s direct children');
  expect(html).toContain('A disabled option is still reached by the select&#39;s keyboard navigation');
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
  const home = await (await request.get('/')).text();
  expect(home).toContain('/components/option');
});

test('the examples render in their own documents in Shoelace\'s order, with every example file present', async ({ page }) => {
  const { requests, example } = await openPage(page);
  await documentsLoaded(page);
  const titles = await page.locator('iframe.example').evaluateAll(frames => frames.map(f => f.title));
  expect(titles).toEqual(SECTIONS.map(title));
  const counts = [];
  for (const section of SECTIONS) counts.push(await example(section).locator('sl-option').count());
  expect(counts).toEqual([3, 3, 3]);
  expect(await example('Disabled').locator('sl-option[disabled]').evaluateAll(els => els.map(e => e.value))).toEqual(['option-2']);
  const icons = await example('Prefix & Suffix').locator('sl-option').first().evaluate(el => [...el.children].map(c => [c.localName, c.slot]));
  expect(icons).toEqual([['sl-icon', 'prefix'], ['sl-icon', 'suffix']]);
  const files = dir => readdirSync(path.join(docsDir, 'examples/option', dir)).filter(f => /\.(html|jsx)$/.test(f)).sort();
  expect(files('')).toEqual(ORDER.map(([, , f]) => `${f}.html`).sort());
  expect(files('react')).toEqual(['default.jsx', 'disabled.jsx']);
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
});

test('registration: the option entry defines sl-option and sl-icon only, with no core marker and no ch-* definitions', async ({ page }) => {
  const pageErrors = await loadBundle(page);
  const r = await page.evaluate(() => ['sl-option', 'sl-icon', 'sl-select', 'ch-option'].map(t => customElements.get(t)?.name ?? null));
  expect(r).toEqual(['VelcroOption', 'VelcroIcon', null, null]);
  // The host carries only Shoelace's own attributes: no core marker (an option is not one of core's focusable elements).
  await mount(page, '<sl-option value="a">Alpha</sl-option>');
  expect(await page.locator('sl-option').evaluate(el => el.getAttributeNames().sort())).toEqual(['aria-disabled', 'aria-selected', 'role', 'value']);
  expect(pageErrors).toEqual([]);
});

test('structure: a base part with the check icon and the prefix, label and suffix slots; role, aria-selected and aria-disabled on the host', async ({ page }) => {
  const pageErrors = await loadBundle(page);
  await mount(page, '<sl-option value="a">Alpha</sl-option><sl-option value="b" disabled>Beta</sl-option>');
  const r = await page.locator('sl-option').first().evaluate(el => {
    const root = el.shadowRoot;
    const icon = root.querySelector('[part="checked-icon"]');
    return {
      parts: [...root.querySelectorAll('[part]')].map(n => [n.localName, n.getAttribute('part'), n.getAttribute('name')]),
      icon: [icon.getAttribute('name'), icon.getAttribute('library'), icon.getAttribute('aria-hidden'), getComputedStyle(icon).visibility],
      base: root.querySelector('[part="base"]').className.trim(),
      host: ['role', 'aria-selected', 'aria-disabled', 'tabindex'].map(a => el.getAttribute(a)),
      other: ['role', 'aria-selected', 'aria-disabled'].map(a => el.nextElementSibling.getAttribute(a)),
    };
  });
  expect(r).toEqual({
    parts: [['div', 'base', null], ['sl-icon', 'checked-icon', 'check'], ['slot', 'prefix', 'prefix'], ['slot', 'label', null], ['slot', 'suffix', 'suffix']],
    icon: ['check', 'system', 'true', 'hidden'],
    base: 'option',
    host: ['option', 'false', 'false', null],
    other: ['option', 'false', 'true'],
  });
  expect(pageErrors).toEqual([]);
});

test('in a select: the selected option shows its check and aria-selected, the current one is highlighted in the primary color, and hover uses the neutral background', async ({ page }) => {
  const pageErrors = await loadBundle(page, SELECT_ENTRY);
  await mount(page, '<sl-select value="b"><sl-option value="a">Alpha</sl-option><sl-option value="b">Beta</sl-option><sl-option value="c">Gamma</sl-option></sl-select>');
  await page.locator('sl-select').evaluate(el => el.show());
  const read = () => page.evaluate(() => {
    const probe = decl => {
      const p = document.createElement('div');
      p.style.cssText = decl;
      document.body.append(p);
      const out = [getComputedStyle(p).backgroundColor, getComputedStyle(p).color];
      p.remove();
      return out;
    };
    return {
      options: [...document.querySelectorAll('sl-option')].map(o => {
        const base = o.shadowRoot.querySelector('[part="base"]');
        return [o.getAttribute('aria-selected'), getComputedStyle(o.shadowRoot.querySelector('[part="checked-icon"]')).visibility, base.className.trim().split(/\s+/).sort().join(' '), getComputedStyle(base).backgroundColor, getComputedStyle(base).color];
      }),
      current: probe('background-color: var(--sl-color-primary-600); color: var(--sl-color-neutral-0)'),
      hover: probe('background-color: var(--sl-color-neutral-100); color: var(--sl-color-neutral-1000)'),
    };
  });
  const r = await read();
  expect(r.options[1].slice(0, 3)).toEqual(['true', 'visible', 'option option--current option--selected']);
  expect(r.options[1].slice(3)).toEqual(r.current);
  expect(r.options[0].slice(0, 3)).toEqual(['false', 'hidden', 'option']);
  await page.locator('sl-option[value="c"]').hover();
  await expect.poll(() => read().then(x => x.options[2].slice(2))).toEqual(['option option--hover', ...r.hover]);
  expect(pageErrors).toEqual([]);
});

test('properties: Shoelace\'s defaults; value and disabled reflect and removing their attributes restores the first values; dir and lang are not reflected; ready fires once without bubbling', async ({ page }) => {
  const pageErrors = await loadBundle(page);
  const r = await page.evaluate(async () => {
    const seen = [];
    const el = document.createElement('sl-option');
    el.addEventListener('ready', e => seen.push([e.bubbles, e.composed]));
    document.body.append(el);
    await el.updateComplete;
    const defaults = [el.value, el.disabled, el.dir, el.lang, el.current, el.selected];
    el.value = 'v';
    el.disabled = true;
    el.dir = 'rtl';
    el.lang = 'de';
    await el.updateComplete;
    const attrs = ['value', 'disabled', 'dir', 'lang', 'aria-disabled'].map(a => el.getAttribute(a));
    el.removeAttribute('value');
    el.removeAttribute('disabled');
    await el.updateComplete;
    return { defaults, attrs, removed: [el.value, el.disabled, el.getAttribute('aria-disabled')], seen };
  });
  expect(r).toEqual({
    defaults: ['', false, undefined, undefined, false, false],
    attrs: ['v', '', null, null, 'true'],
    removed: ['', false, 'false'],
    seen: [[false, false]],
  });
  expect(pageErrors).toEqual([]);
});

test('upstream quirks: spaces in a value become underscores with a console error, non-strings become strings, and getTextLabel() reads only the direct children', async ({ page }) => {
  const pageErrors = await loadBundle(page);
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await mount(page, '<sl-option id="a" value="two words">A</sl-option><sl-option id="b"><sl-icon slot="prefix" name="gear"></sl-icon> Plain <b>bold <i>nested</i></b> <span slot="suffix">Suffix</span></sl-option>');
  const r = await page.evaluate(async () => {
    const a = document.getElementById('a');
    const b = document.getElementById('b');
    const fromSpaces = [a.value, a.getAttribute('value')];
    a.value = 42;
    await a.updateComplete;
    return { fromSpaces, number: [a.value, typeof a.value], label: b.getTextLabel() };
  });
  expect(r).toEqual({ fromSpaces: ['two_words', 'two_words'], number: ['42', 'string'], label: 'Plain bold nested' });
  expect(errors).toEqual(['Option values cannot include a space. All spaces have been replaced with underscores. JSHandle@node']);
  expect(pageErrors).toEqual([]);
});

test('upstream quirks: hidden does not hide an option, which can still be selected; the keyboard reaches a disabled option but cannot select it', async ({ page }) => {
  const pageErrors = await loadBundle(page, SELECT_ENTRY);
  await mount(page, '<button id="before">before</button><sl-select><sl-option value="a" hidden>Alpha</sl-option><sl-option value="b" disabled>Beta</sl-option><sl-option value="c">Gamma</sl-option></sl-select>');
  const hidden = await page.locator('sl-option[value="a"]').evaluate(el => [getComputedStyle(el).display, el.getBoundingClientRect().height]);
  expect(hidden).toEqual(['block', 0]);
  await page.locator('sl-select').evaluate(el => el.show());
  expect(await page.locator('sl-option[value="a"]').evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThan(0);
  await page.locator('sl-option[value="a"]').click();
  await expect.poll(() => page.locator('sl-select').evaluate(el => [el.value, el.open])).toEqual(['a', false]);
  await page.locator('#before').focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => page.locator('sl-select').evaluate(el => el.open)).toBe(true);
  await page.keyboard.press('ArrowDown');
  const state = () => page.locator('sl-select').evaluate(el => [el.value, el.open, [...el.querySelectorAll('sl-option')].map(o => o.current)]);
  await expect.poll(state).toEqual(['a', true, [false, true, false]]);
  await page.keyboard.press('Enter');
  await expect.poll(state).toEqual(['a', true, [false, true, false]]);
  expect(pageErrors).toEqual([]);
});

test('a label change tells the closest select to refresh its display label', async ({ page }) => {
  const pageErrors = await loadBundle(page, SELECT_ENTRY);
  await mount(page, '<sl-select value="a"><sl-option value="a">Alpha</sl-option></sl-select>');
  await page.locator('sl-option').evaluate(el => (el.textContent = 'Renamed'));
  await expect.poll(() => page.locator('sl-select').evaluate(el => el.shadowRoot.querySelector('[part="display-input"]').value)).toBe('Renamed');
  expect(pageErrors).toEqual([]);
});

test.describe('class-only entry', () => {
  test('importing defines nothing; constructing an option defines Velcro\'s sl-icon, so the check icon renders', async ({ page }) => {
    const pageErrors = await loadBundle(page, CLASS_ENTRY);
    const r = await page.evaluate(async () => {
      const { SlOption, VelcroOption } = window.optionClass;
      const tags = () => ['sl-option', 'sl-icon'].map(t => customElements.get(t)?.name ?? null);
      const afterImport = tags();
      customElements.define('sl-option', SlOption);
      const el = document.createElement('sl-option');
      document.body.append(el);
      await el.updateComplete;
      return { afterImport, afterConstruct: tags(), alias: SlOption === VelcroOption, icon: el.shadowRoot.querySelector('sl-icon') instanceof customElements.get('sl-icon') };
    });
    expect(r).toEqual({ afterImport: [null, null], afterConstruct: ['VelcroOption', 'VelcroIcon'], alias: true, icon: true });
    expect(pageErrors).toEqual([]);
  });
});

test.describe('React examples', () => {
  const names = ['default', 'disabled'];
  let bundle;

  test.beforeAll(async () => {
    const fromVelcro = createRequire(path.join(velcroDir, 'package.json'));
    const fromDocs = createRequire(path.join(docsDir, 'package.json'));
    const pkgDir = name => path.dirname(fromVelcro.resolve(`${name}/package.json`));
    const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
    const dir = mkdtempSync(path.join(tmpdir(), 'velcro-option-react-'));
    try {
      for (const name of names) {
        writeFileSync(path.join(dir, `${name}.jsx`), `${readFileSync(path.join(docsDir, `examples/option/react/${name}.jsx`), 'utf8')}\nexport default App;\n`);
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

  test('render the same options as the HTML examples, through the generated wrappers', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.setContent('<!DOCTYPE html><html class="sl-theme-light"><body></body></html>');
    await page.addScriptTag({ type: 'module', content: bundle });
    await page.waitForFunction(() => typeof window.renderExample === 'function');
    const r = await page.evaluate(async names => {
      const out = {};
      for (const name of names) {
        window.renderExample(name);
        await customElements.whenDefined('sl-option');
        const options = [...document.querySelectorAll(`#${name} sl-option`)];
        await Promise.all(options.map(o => o.updateComplete));
        out[name] = options.map(o => [o.value, o.disabled, o.getTextLabel()]);
      }
      return { out, errors: window.errors };
    }, names);
    expect(r.out).toEqual({
      default: [['option-1', false, 'Option 1'], ['option-2', false, 'Option 2'], ['option-3', false, 'Option 3']],
      disabled: [['option-1', false, 'Option 1'], ['option-2', true, 'Option 2'], ['option-3', false, 'Option 3']],
    });
    expect(r.errors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});

test.describe('React wrapper', () => {
  const mountReact = reactWrapperPage(test);

  test('passes Shoelace\'s props to the option', async ({ page }) => {
    const errors = await mountReact(page);
    const r = await page.evaluate(async () => {
      window.renderWrapper('VelcroOption', { value: 'x', disabled: true }, 'Wrapped');
      const el = document.querySelector('#wrapped');
      await customElements.whenDefined('sl-option');
      await el.updateComplete;
      return [el.value, el.disabled, el.getAttribute('aria-disabled'), el.getTextLabel()];
    });
    expect(r).toEqual(['x', true, 'true', 'Wrapped']);
    expect(errors).toEqual([]);
  });
});

test('no upstream Shoelace runtime is requested or defined; no request leaves the local origin', async ({ page }) => {
  const { frame, requests } = await openPage(page);
  await documentsLoaded(page);
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  expect(await frame.locator('body').evaluate(() => Boolean(window.Shoelace || document.querySelector('script[src*="shoelace"]')))).toBe(false);
});
