// Runtime check of the generated React wrappers in React 19 (dist/react, built by the library build): omitted props keep
// the element's defaults (React 19 assigns any prop it is given, including undefined, to the element property), and
// supplied values set, update and clear the properties. The wrappers are bundled with Vite for the browser.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const velcroDir = fileURLToPath(new URL('../../packages/velcro/', import.meta.url));
const fromVelcro = createRequire(path.join(velcroDir, 'package.json'));
const fromDocs = createRequire(fileURLToPath(new URL('../../packages/docs/package.json', import.meta.url)));
const pkgDir = name => path.dirname(fromVelcro.resolve(`${name}/package.json`));

let bundle;
test.beforeAll(async () => {
  const { build } = await import(fromDocs.resolve('vite'));
  const dir = mkdtempSync(path.join(tmpdir(), 'velcro-react-'));
  try {
    const entry = path.join(dir, 'entry.js');
    writeFileSync(entry, `
      import React from 'react';
      import { flushSync } from 'react-dom';
      import { createRoot } from 'react-dom/client';
      import { VelcroBadge, VelcroButton, VelcroMutationObserver, VelcroPopup, VelcroProgressRing } from 'velcro-react';
      window.errors = [];
      addEventListener('error', e => window.errors.push(String(e.message)));
      addEventListener('unhandledrejection', e => window.errors.push(String(e.reason)));
      window.reactVersion = React.version;
      window.slFocus = 0;
      const root = createRoot(document.getElementById('root'));
      window.renderScenario = p => flushSync(() => root.render(React.createElement(React.Fragment, null,
        React.createElement(VelcroProgressRing, { id: 'ring', ...p.ring }),
        React.createElement(VelcroBadge, { id: 'badge', ...p.badge }, 'Badge'),
        React.createElement(VelcroButton, { id: 'button', ...p.button, onSlFocus: () => { window.slFocus++; } }, 'Go'))));
      window.mutations = [];
      const observerRoot = createRoot(document.getElementById('observer-root'));
      window.renderObserver = p => flushSync(() => observerRoot.render(React.createElement(VelcroMutationObserver,
        { id: 'observer', ...p, onSlMutation: e => window.mutations.push(e.detail.mutationList.map(r => [r.type, r.attributeName])) },
        React.createElement('p', { id: 'observed-child' }, 'text'))));
      window.repositions = 0;
      const popupRoot = createRoot(document.getElementById('popup-root'));
      window.renderPopup = p => flushSync(() => popupRoot.render(React.createElement(VelcroPopup,
        { id: 'popup', active: true, ...p, onSlReposition: () => { window.repositions++; } },
        React.createElement('span', { slot: 'anchor', style: { display: 'inline-block', width: '100px', height: '40px' } }),
        React.createElement('div', { style: { width: '80px', height: '20px' } }))));
    `);
    const out = await build({
      configFile: false, logLevel: 'silent', root: dir,
      resolve: { alias: { react: pkgDir('react'), 'react-dom': pkgDir('react-dom'), 'velcro-react': path.join(velcroDir, 'dist/react/index.js') } },
      define: { 'process.env.NODE_ENV': '"production"' },
      build: { write: false, minify: false, rollupOptions: { input: entry, output: { format: 'es', inlineDynamicImports: true } } },
    });
    bundle = (Array.isArray(out) ? out[0] : out).output.find(o => o.type === 'chunk').code;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

async function mount(page) {
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.setContent('<!DOCTYPE html><html><body><div id="root"></div><div id="observer-root"></div><div id="popup-root"></div></body></html>');
  await page.addScriptTag({ type: 'module', content: bundle });
  await page.waitForFunction(() => typeof window.renderScenario === 'function');
  return pageErrors;
}

const state = page => page.evaluate(async () => {
  const ring = document.getElementById('ring');
  const badge = document.getElementById('badge');
  const button = document.getElementById('button');
  await Promise.all([ring.updateComplete, badge.updateComplete, button.updateComplete]);
  return {
    ring: { label: ring.label, value: ring.value, aria: ring.shadowRoot.querySelector('[part~="base"]')?.getAttribute('aria-label') },
    badge: { variant: badge.variant, pill: badge.pill, cls: badge.shadowRoot.querySelector('[part~="base"]')?.className.trim().split(/\s+/).sort() },
    button: { variant: button.variant, size: button.size, disabled: Boolean(button.disabled), href: button.href ?? null },
    toggle: { pressed: Boolean(button.pressed), expanded: Boolean(button.expanded) },
    errors: window.errors,
  };
});

test('React 19 wrappers keep element defaults when props are omitted', async ({ page }) => {
  const pageErrors = await mount(page);
  expect(await page.evaluate(() => window.reactVersion)).toBe('19.2.0');
  await page.evaluate(() => window.renderScenario({ ring: { value: 50 }, badge: {}, button: {} }));
  const s = await state(page);
  expect(s.ring).toEqual({ label: '', value: 50, aria: 'Progress' });
  expect(s.badge.variant).toBe('primary');
  expect(s.badge.pill).toBe(false);
  expect(s.badge.cls).toContain('badge--primary');
  expect(s.button).toEqual({ variant: 'default', size: 'medium', disabled: false, href: '' });
  expect(s.errors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('React 19 wrappers set, update and clear supplied props and forward events', async ({ page }) => {
  const pageErrors = await mount(page);
  await page.evaluate(() => window.renderScenario({ ring: { value: 10, label: 'Uploading' }, badge: { variant: 'danger', pill: true }, button: { variant: 'primary', disabled: true } }));
  let s = await state(page);
  expect(s.ring).toEqual({ label: 'Uploading', value: 10, aria: 'Uploading' });
  expect(s.badge).toMatchObject({ variant: 'danger', pill: true });
  expect(s.badge.cls).toContain('badge--danger');
  expect(s.button).toMatchObject({ variant: 'primary', disabled: true });

  await page.evaluate(() => window.renderScenario({ ring: { value: 75, label: 'Almost' }, badge: { variant: 'success', pill: false }, button: { variant: 'success', disabled: false } }));
  s = await state(page);
  expect(s.ring).toEqual({ label: 'Almost', value: 75, aria: 'Almost' });
  expect(s.badge).toMatchObject({ variant: 'success', pill: false });
  expect(s.button).toMatchObject({ variant: 'success', disabled: false });

  await page.locator('#button').focus();
  await expect.poll(() => page.evaluate(() => window.slFocus)).toBe(1);
  expect(s.errors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('React 19 wrappers restore element defaults when a supplied prop is removed', async ({ page }) => {
  const pageErrors = await mount(page);
  await page.evaluate(() => window.renderScenario({ ring: { value: 5, label: 'Saving' }, badge: { variant: 'danger', pill: true }, button: { size: 'large', disabled: true } }));
  await page.evaluate(() => window.renderScenario({ ring: { value: 5 }, badge: {}, button: {} }));
  const s = await state(page);
  expect(s.ring).toEqual({ label: '', value: 5, aria: 'Progress' });
  expect(s.badge).toMatchObject({ variant: 'primary', pill: false });
  expect(s.badge.cls).toContain('badge--primary');
  expect(s.button).toEqual({ variant: 'default', size: 'medium', disabled: false, href: '' });
  expect(s.errors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('React 19 wrappers never touch props omitted on both renders: element-managed state survives re-renders', async ({ page }) => {
  const pageErrors = await mount(page);
  await page.evaluate(() => window.renderScenario({ ring: { value: 1 }, badge: {}, button: { toggle: true } }));
  // Uncontrolled toggle: the click sets pressed on the element itself.
  await page.locator('#button').click();
  expect((await state(page)).toggle.pressed).toBe(true);
  // State the element (or other code) sets directly, not through props.
  await page.evaluate(() => { document.getElementById('button').expanded = true; });
  // Parent re-renders with unchanged props, then with an unrelated prop change.
  await page.evaluate(() => window.renderScenario({ ring: { value: 1 }, badge: {}, button: { toggle: true } }));
  await page.evaluate(() => window.renderScenario({ ring: { value: 2 }, badge: { variant: 'success' }, button: { toggle: true, size: 'small' } }));
  const s = await state(page);
  expect(s.toggle).toEqual({ pressed: true, expanded: true });
  expect(s.button.size).toBe('small');
  // A supplied value that does not change is not re-assigned over element state.
  await page.locator('#button').click();
  await page.evaluate(() => window.renderScenario({ ring: { value: 2 }, badge: { variant: 'success' }, button: { toggle: true, size: 'small' } }));
  expect((await state(page)).toggle.pressed).toBe(false);
  expect(s.errors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('React 19 wrapper for the mutation observer sets its props and forwards sl-mutation with the record list', async ({ page }) => {
  const pageErrors = await mount(page);
  await page.evaluate(() => window.renderObserver({ attr: 'title' }));
  await page.evaluate(async () => { await document.getElementById('observer').updateComplete; });
  expect(await page.evaluate(() => document.getElementById('observer').attr)).toBe('title');
  await page.evaluate(() => document.getElementById('observed-child').setAttribute('title', 'one'));
  await expect.poll(() => page.evaluate(() => window.mutations)).toEqual([[['attributes', 'title']]]);
  // The disabled prop stops the observer; removing it starts it again.
  await page.evaluate(() => window.renderObserver({ attr: 'title', disabled: true }));
  await page.evaluate(async () => { await document.getElementById('observer').updateComplete; });
  await page.evaluate(() => document.getElementById('observed-child').setAttribute('title', 'two'));
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.mutations.length)).toBe(1);
  await page.evaluate(() => window.renderObserver({ attr: 'title' }));
  await page.evaluate(async () => { await document.getElementById('observer').updateComplete; });
  await page.evaluate(() => document.getElementById('observed-child').setAttribute('title', 'three'));
  await expect.poll(() => page.evaluate(() => window.mutations.length)).toBe(2);
  expect(await page.evaluate(() => window.errors)).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('React 19 wrapper for the popup sets camelCase props whose attribute is hyphenated as element properties', async ({ page }) => {
  const pageErrors = await mount(page);
  const read = () => page.evaluate(async () => {
    const el = document.getElementById('popup');
    await el.updateComplete;
    const keys = ['arrowPadding', 'arrowPlacement', 'autoSize', 'autoSizePadding', 'flipFallbackPlacements', 'flipFallbackStrategy',
      'flipPadding', 'shiftPadding'];
    // The wrapper always passes `style`, so that attribute is left out.
    return { props: Object.fromEntries(keys.map(k => [k, el[k] ?? null])), attrs: el.getAttributeNames().filter(n => n !== 'style').sort() };
  });
  const supplied = { arrowPadding: 4, arrowPlacement: 'start', autoSize: 'vertical', autoSizePadding: 3, flipFallbackPlacements: 'right bottom',
    flipFallbackStrategy: 'initial', flipPadding: 2, shiftPadding: 5 };
  await page.evaluate(p => window.renderPopup(p), supplied);
  // Set as properties: numbers stay numbers, a string flipFallbackPlacements is not split (as with Shoelace's wrapper), and
  // only the reflected attributes appear.
  expect(await read()).toEqual({ props: supplied, attrs: ['active', 'data-current-placement', 'id', 'placement', 'strategy'] });
  await expect.poll(() => page.evaluate(() => window.repositions)).toBeGreaterThan(0);
  // Removing the props restores the element's defaults.
  await page.evaluate(() => window.renderPopup({}));
  expect((await read()).props).toEqual({ arrowPadding: 10, arrowPlacement: 'anchor', autoSize: null, autoSizePadding: 0, flipFallbackPlacements: '',
    flipFallbackStrategy: 'best-fit', flipPadding: 0, shiftPadding: 0 });
  // A hyphenated spelling is still passed through as an attribute.
  await page.evaluate(() => window.renderPopup({ 'arrow-padding': '7' }));
  expect((await read()).props.arrowPadding).toBe(7);
  expect(await page.evaluate(() => window.errors)).toEqual([]);
  expect(pageErrors).toEqual([]);
});
