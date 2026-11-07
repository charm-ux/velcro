// A React 19 page for one component's wrapper checks, so a component's own spec (tests/product/<name>.spec.mjs) tests
// its generated wrapper without editing the shared tests/product/react.spec.mjs. The wrappers (dist/react, built by the
// library build) are bundled with Vite; `window.renderWrapper(name, props, html)` renders wrapper `name` (for example
// 'VelcroTag') as #wrapped with the props and optional inner HTML, or clears it when `name` is null.
//
//   import { reactWrapperPage } from './support/react.mjs';
//   const mount = reactWrapperPage(test);
//   test('...', async ({ page }) => { const errors = await mount(page); ... });
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const velcroDir = fileURLToPath(new URL('../../../packages/velcro/', import.meta.url));
const fromVelcro = createRequire(path.join(velcroDir, 'package.json'));
const fromDocs = createRequire(fileURLToPath(new URL('../../../packages/docs/package.json', import.meta.url)));
const pkgDir = name => path.dirname(fromVelcro.resolve(`${name}/package.json`));

export async function buildWrapperBundle() {
  const { build } = await import(fromDocs.resolve('vite'));
  const dir = mkdtempSync(path.join(tmpdir(), 'velcro-react-'));
  try {
    const entry = path.join(dir, 'entry.js');
    writeFileSync(entry, `
      import React from 'react';
      import { flushSync } from 'react-dom';
      import { createRoot } from 'react-dom/client';
      import * as wrappers from 'velcro-react';
      window.errors = [];
      addEventListener('error', e => window.errors.push(String(e.message)));
      addEventListener('unhandledrejection', e => window.errors.push(String(e.reason)));
      window.reactVersion = React.version;
      const root = createRoot(document.getElementById('wrapper-root'));
      window.renderWrapper = (name, props = {}, html) => flushSync(() => root.render(name ? React.createElement(wrappers[name],
        { id: 'wrapped', ...props, ...(html === undefined ? {} : { dangerouslySetInnerHTML: { __html: html } }) }) : null));
    `);
    const out = await build({
      configFile: false, logLevel: 'silent', root: dir,
      resolve: { alias: { react: pkgDir('react'), 'react-dom': pkgDir('react-dom'), 'velcro-react': path.join(velcroDir, 'dist/react/index.js') } },
      define: { 'process.env.NODE_ENV': '"production"' },
      build: { write: false, minify: false, rollupOptions: { input: entry, output: { format: 'es', inlineDynamicImports: true } } },
    });
    return (Array.isArray(out) ? out[0] : out).output.find(o => o.type === 'chunk').code;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Registers a beforeAll that bundles the wrappers; returns mount(page), which loads them and returns the page errors. */
export function reactWrapperPage(test) {
  let bundle;
  test.beforeAll(async () => { bundle = await buildWrapperBundle(); });
  return async page => {
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.setContent('<!DOCTYPE html><html><body><div id="wrapper-root"></div></body></html>');
    await page.addScriptTag({ type: 'module', content: bundle });
    await page.waitForFunction(() => typeof window.renderWrapper === 'function');
    return pageErrors;
  };
}
