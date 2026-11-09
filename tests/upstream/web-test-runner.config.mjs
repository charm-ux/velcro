// Runs Shoelace 2.20.1's own component test files (vendored unmodified under shoelace-2.20.1/) against Velcro in
// Chromium. Test files are never edited: a resolver plugin redirects each test's Shoelace entry import to Velcro.
// '../../../dist/shoelace.js' is Shoelace's whole library, so it maps to Velcro's package root (which registers every
// component, including the one under test through its own entry): tests such as the switch's also render <sl-button>.
// A test's own './<name>.js' maps to Velcro's registering entry for that component alone. A test's bare 'lit' import
// (the animation test builds its fixtures with lit's `html`) and a test's 'lit/decorators.js' import (the dropdown test
// defines a custom element with `@customElement`) map to the lit that Velcro itself loads, which the workspace root cannot
// resolve on its own.
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esbuildPlugin } from '@web/dev-server-esbuild';
import { playwrightLauncher } from '@web/test-runner-playwright';
import { defaultReporter } from '@web/test-runner';
import { writeFileSync } from 'node:fs';
import { serveDocsImage } from './docs-images.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const vendor = 'tests/upstream/shoelace-2.20.1';
const components = readdirSync(new URL('./shoelace-2.20.1/src/components/', import.meta.url)).sort();
// Optional single-component filter, e.g. VELCRO_UPSTREAM_ONLY=button.
const only = process.env.VELCRO_UPSTREAM_ONLY;
// Browsers are parameterized for a later Firefox/WebKit lane; the gate and its ledger currently cover Chromium only.
const products = (process.env.VELCRO_UPSTREAM_BROWSERS || 'chromium').split(',');

const velcroLitFile = createRequire(new URL('../../packages/velcro/package.json', import.meta.url)).resolve('lit');
const velcroLit = `/${path.relative(root, velcroLitFile).split(path.sep).join('/')}`;
// lit's own decorators entry, next to its index, so a test's decorators come from the same lit copy as its `LitElement`.
const velcroLitDecorators = `/${path.relative(root, path.join(path.dirname(velcroLitFile), 'decorators.js')).split(path.sep).join('/')}`;

// The utilities Velcro publishes (./utilities/<name> in its export map): only these are resolved for a test's
// '../../utilities/<name>.js', so a built-but-unpublished module can never stand in for one of Shoelace's.
const publishedUtilities = new Set(Object.keys(JSON.parse(readFileSync(new URL('../../packages/velcro/package.json', import.meta.url), 'utf8')).exports)
  .flatMap(key => key.match(/^\.\/utilities\/([a-z-]+)$/)?.slice(1) ?? []));

const velcroEntries = {
  name: 'velcro-upstream-resolver',
  resolveImport({ source, context }) {
    const importer = decodeURIComponent(context.path);
    const match = importer.match(new RegExp(`/${vendor}/src/components/([a-z-]+)/\\1\\.test\\.ts$`));
    if (!match) return undefined;
    const name = match[1];
    if (source === '../../../dist/shoelace.js') return '/packages/velcro/dist/index.js';
    if (source === `./${name}.js`) return `/packages/velcro/dist/components/${name}/index.js`;
    const utility = source.match(/^\.\.\/\.\.\/utilities\/([a-z-]+)\.js$/);
    if (utility && publishedUtilities.has(utility[1])) return `/packages/velcro/dist/utilities/${utility[1]}.js`;
    if (source === 'lit') return velcroLit;
    if (source === 'lit/decorators.js') return velcroLitDecorators;
    return undefined;
  }
};

// Upstream's sprite sheet tests load '/docs/assets/images/sprite.svg', a file Shoelace's docs build generates from
// Bootstrap Icons in its own web root. Velcro's docs site ships the same Bootstrap Icons sprite at
// packages/docs/public/assets/images/sprite.svg, so that one path is served from there. Upstream's animated image tests
// load '/docs/assets/images/walk.gif' and '/docs/assets/images/tie.webp', Shoelace's own demo images. Velcro neither ships
// nor commits binary files, so those two exact names are served from two small synthetic stand-ins (docs-images.json, base64
// text, decoded in docs-images.mjs) with the content type of their extension. The lookup is by exact name only; any other
// path under that directory, or one with a further segment or a '..', falls through to the normal server. Nothing else is
// rewritten.
const upstreamDocsAssets = (ctx, next) => {
  if (ctx.path === '/docs/assets/images/sprite.svg') ctx.url = '/packages/docs/public/assets/images/sprite.svg';
  if (serveDocsImage(ctx)) return undefined;
  return next();
};

// Writes every test outcome (component, suite path, title, passed, short reason) as JSON for the scoreboard.
function jsonReporter(file) {
  return {
    onTestRunFinished({ sessions }) {
      const results = [];
      for (const session of sessions) {
        const component = session.testFile.match(/components\/([a-z-]+)\//)?.[1] ?? 'unknown';
        const walk = (suite, trail) => {
          for (const t of suite.tests ?? []) {
            const reason = t.error ? String(t.error.message ?? t.error).split('\n')[0].slice(0, 200) : undefined;
            results.push({ component, title: [...trail, t.name].join(' > '), passed: t.passed, skipped: t.skipped, reason });
          }
          for (const s of suite.suites ?? []) walk(s, [...trail, s.name]);
        };
        if (session.testResults) walk(session.testResults, []);
        // Load, runtime and runner failures are infrastructure problems, never ledgerable assertion failures.
        for (const e of session.errors ?? []) {
          results.push({ component, title: '(session error)', passed: false, skipped: false, infrastructure: true,
            reason: String(e.message ?? e).split('\n')[0].slice(0, 200) });
        }
        if (session.status !== 'FINISHED') {
          results.push({ component, title: '(session did not finish)', passed: false, skipped: false, infrastructure: true,
            reason: String(session.status) });
        }
      }
      writeFileSync(file, JSON.stringify(results, null, 2));
    }
  };
}

export default {
  rootDir: root,
  port: Number(process.env.VELCRO_PRODUCT_PORT || 4620),
  files: components.filter(name => !only || name === only).map(name => `${vendor}/src/components/${name}/${name}.test.ts`),
  reporters: [defaultReporter(), ...(process.env.VELCRO_UPSTREAM_JSON ? [jsonReporter(process.env.VELCRO_UPSTREAM_JSON)] : [])],
  nodeResolve: { exportConditions: ['production', 'default'] },
  concurrentBrowsers: 1,
  concurrency: 4,
  // Upstream's own mocha settings (3s timeout, one retry).
  testFramework: { config: { timeout: 3000, retries: 1 } },
  middleware: [upstreamDocsAssets],
  plugins: [velcroEntries, esbuildPlugin({ ts: true, target: 'es2020' })],
  browsers: products.map(product => playwrightLauncher({ product })),
  // Mirrors upstream's runner page, with Velcro's light theme in place of Shoelace's.
  testRunnerHtml: testFramework => `
    <html lang="en-US">
      <head></head>
      <body>
        <link rel="stylesheet" href="/packages/velcro/themes/light.css">
        <script>
          window.process = {env: { NODE_ENV: "production" }}
          // Harness guard (not upstream): a real form submission would reload the runner page and discard every
          // result in the file. The listener runs last, after any test listener, so tests observe the same events;
          // form.submit() fires no submit event, so making it a no-op cannot make a submit assertion pass.
          window.addEventListener('submit', event => event.preventDefault());
          HTMLFormElement.prototype.submit = function () {};
          // Harness guard (not upstream): a failing sinon assertion carries a spy that structuredClone cannot copy,
          // which stops the runner from reporting any result for the file. Only that failure path is changed.
          const nativeClone = window.structuredClone;
          const plain = (value, seen = new WeakSet()) => {
            if (typeof value === 'function') return '[function]';
            if (value === null || typeof value !== 'object') return value;
            if (seen.has(value)) return '[circular]';
            seen.add(value);
            if (Array.isArray(value)) return value.map(v => plain(v, seen));
            const out = {};
            for (const key of Object.keys(value)) out[key] = plain(value[key], seen);
            return out;
          };
          window.structuredClone = (value, options) => {
            try { return nativeClone(value, options); } catch { return nativeClone(plain(value), options); }
          };
        </script>
        <script type="module">
          // Harness guard (not upstream), generic: it runs in the runner page of every test file and knows no component.
          // It parks the pointer in the bottom-right corner before the test framework is loaded, so before any test.
          // A page's pointer rests at (0,0) until something moves it, and (0,0) is a vertex of the clip-path triangle
          // that sl-menu-item draws over the viewport while a submenu is open (its cursor variables default to 0). Chrome's
          // delayed hover update then sends a mouseover to the item, whose handler takes the focus back from the
          // submenu a key press had just opened, and two menu item tests fail (only where the pointer is known at (0,0),
          // as on CI's headless Linux Chromium). A/B evidence: Shoelace 2.20.1 built from its own source and run in this
          // runner page fails the same two tests with the pointer at (0,0) and passes with it anywhere else, with
          // boxes identical to Velcro's; Velcro behaves identically. See docs/conformance.md and the menu item docs
          // page ("Upstream quirks matched"). The tests start only after the move, and no assertion is touched.
          import { sendMouse } from '@web/test-runner-commands';
          (async () => {
            try { await sendMouse({ type: 'move', position: [799, 599] }); } finally {
              const framework = document.createElement('script');
              framework.type = 'module';
              framework.src = '${testFramework}';
              document.body.append(framework);
            }
          })();
        </script>
      </body>
    </html>
  `,
};
