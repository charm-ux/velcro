// Builds small browser fixtures from the BUILT library (`pnpm --filter @charm-ux/velcro run build` first) with the
// docs package's pinned Vite, into ignored scratch, and serves them to Playwright pages through routes.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const docsDir = path.join(root, 'packages/docs');
const velcroDir = path.join(root, 'packages/velcro');
export const ORIGIN = 'http://fixture.test';

// `@charm-ux/velcro...` ids resolve through the real package `exports`; `velcro-internal:<name>` reaches built internals.
function resolvePlugin() {
  return {
    name: 'velcro-fixture-resolve',
    async resolveId(id) {
      if (id.startsWith('velcro-internal:')) return path.join(velcroDir, 'dist', `${id.slice('velcro-internal:'.length)}.js`);
      if (id === '@charm-ux/velcro' || id.startsWith('@charm-ux/velcro/')) {
        const r = await this.resolve(id, path.join(docsDir, 'app.ts'), { skipSelf: true });
        return r ?? null;
      }
      if (id.startsWith('core-internal:')) {
        const r = await this.resolve(`@charm-ux/core/dist/${id.slice('core-internal:'.length)}.js`,
          path.join(velcroDir, 'dist/index.js'), { skipSelf: true });
        return r ?? null;
      }
      return null;
    },
  };
}

/** `entries` maps a fixture name to module source. Returns the output directory of the built `<name>.js` files. */
export async function buildFixtures(entries) {
  const base = path.join(root, '.airig/product-fixtures');
  mkdirSync(base, { recursive: true, mode: 0o700 });
  const dir = mkdtempSync(path.join(base, 'run-'));
  const srcDir = path.join(dir, 'src');
  mkdirSync(srcDir);
  const input = {};
  for (const [name, source] of Object.entries(entries)) {
    const file = path.join(srcDir, `${name}.js`);
    writeFileSync(file, source);
    input[name] = file;
  }
  const { build } = await import(pathToFileURL(createRequire(path.join(docsDir, 'package.json')).resolve('vite')).href);
  await build({
    root: dir,
    configFile: false,
    logLevel: 'silent',
    plugins: [resolvePlugin()],
    resolve: { conditions: ['browser', 'module', 'import', 'default'] },
    build: {
      outDir: path.join(dir, 'out'),
      emptyOutDir: true,
      sourcemap: false,
      minify: false,
      rollupOptions: { input, preserveEntrySignatures: 'strict', output: { entryFileNames: '[name].js', chunkFileNames: 'chunks/[name]-[hash].js' } },
    },
  });
  return path.join(dir, 'out');
}

/** Opens a blank page at ORIGIN that serves built modules (`import('/name.js')`); other requests are aborted. */
export async function openFixturePage(page, outDir) {
  await page.route(`${ORIGIN}/**`, route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') {
      return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' });
    }
    const file = path.join(outDir, url.pathname);
    if (!file.startsWith(outDir + path.sep)) return route.abort();
    try {
      return route.fulfill({ contentType: 'text/javascript', body: readFileSync(file) });
    } catch {
      return route.fulfill({ status: 404, body: '' });
    }
  });
  await page.route(url => !url.href.startsWith(ORIGIN), route => route.abort());
}

export async function gotoBlank(page, outDir) {
  await openFixturePage(page, outDir);
  await page.goto(`${ORIGIN}/`);
}
