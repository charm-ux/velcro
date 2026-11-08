// Bundles of the package's entries (and of the docs' React examples) for the specs that need a top-level document of their own,
// through the package's real export map (the same approach as tests/product/support/react.mjs, which renders one wrapper).
//
//   import { loadBundle, bundleExamples } from './support/bundle.mjs';
//   const pageErrors = await loadBundle(page, `import '@charm-ux/velcro/menu'; window.loaded = true;`);
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const docsDir = fileURLToPath(new URL('../../../packages/docs/', import.meta.url));
export const velcroDir = fileURLToPath(new URL('../../../packages/velcro/', import.meta.url));
const fromVelcro = createRequire(path.join(velcroDir, 'package.json'));
const fromDocs = createRequire(path.join(docsDir, 'package.json'));
const pkgDir = name => path.dirname(fromVelcro.resolve(`${name}/package.json`));
const bundles = new Map();

/** Bundles { 'entry.js': source, ... } with Vite; `@charm-ux/velcro/*` resolves through the package's export map. */
export async function build(entries, extra = {}) {
  const { build: viteBuild } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
  const dir = mkdtempSync(path.join(tmpdir(), 'velcro-bundle-'));
  try {
    for (const [name, source] of Object.entries(entries)) writeFileSync(path.join(dir, name), source);
    const out = await viteBuild({
      configFile: false, logLevel: 'silent', root: dir,
      plugins: [{
        name: 'velcro-package-exports',
        async resolveId(id) {
          if (!id.startsWith('@charm-ux/velcro/')) return null;
          return (await this.resolve(id, path.join(docsDir, 'app.ts'), { skipSelf: true })) ?? null;
        },
      }],
      ...extra,
      build: { write: false, minify: false, rollupOptions: { input: path.join(dir, 'entry.js'), output: { format: 'es', codeSplitting: false } } },
    });
    return (Array.isArray(out) ? out[0] : out).output.find(o => o.type === 'chunk').code;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Loads a bundle of `source` (which sets `window.loaded = true`) into a fresh top-level document with the light theme; returns the page errors. */
export async function loadBundle(page, source) {
  if (!bundles.has(source)) bundles.set(source, await build({ 'entry.js': source }));
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.setContent('<!DOCTYPE html><html class="sl-theme-light" lang="en"><body></body></html>');
  await page.addStyleTag({ content: readFileSync(path.join(velcroDir, 'themes/light.css'), 'utf8') });
  await page.addScriptTag({ type: 'module', content: bundles.get(source) });
  await page.waitForFunction(() => window.loaded === true);
  return pageErrors;
}

/**
 * Bundles docs React examples (packages/docs/examples/<dir>/react/<name>.jsx, which declare `App` without exporting it, as on
 * Shoelace's pages) with React 19 and the generated wrappers; `window.renderExample(name)` renders one into its own <div id=name>.
 */
export async function bundleExamples(dir, names) {
  const entries = Object.fromEntries(names.map(n => [`${n}.jsx`, `${readFileSync(path.join(docsDir, `examples/${dir}/react/${n}.jsx`), 'utf8')}\nexport default App;\n`]));
  entries['entry.js'] = `
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
    window.loaded = true;
  `;
  return build(entries, { resolve: { alias: { react: pkgDir('react'), 'react-dom': pkgDir('react-dom') } }, define: { 'process.env.NODE_ENV': '"production"' } });
}

/** Loads a bundle from bundleExamples into a fresh document with the light theme; returns the page errors. */
export async function loadExamples(page, code) {
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.setContent('<!DOCTYPE html><html class="sl-theme-light" lang="en"><body style="margin: 0"></body></html>');
  await page.addStyleTag({ content: readFileSync(path.join(velcroDir, 'themes/light.css'), 'utf8') });
  await page.addScriptTag({ type: 'module', content: code });
  await page.waitForFunction(() => window.loaded === true);
  return pageErrors;
}
