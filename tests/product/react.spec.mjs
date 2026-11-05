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
      import { VelcroBadge, VelcroButton, VelcroProgressRing } from 'velcro-react';
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
  await page.setContent('<!DOCTYPE html><html><body><div id="root"></div></body></html>');
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
  expect(s.button).toEqual({ variant: 'default', size: 'medium', disabled: false, href: null });
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
  expect(s.button).toEqual({ variant: 'default', size: 'medium', disabled: false, href: null });
  expect(s.errors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
