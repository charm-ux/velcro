// Runs Shoelace 2.20.1's own component test files (vendored unmodified under shoelace-2.20.1/) against Velcro in
// Chromium. Test files are never edited: a resolver plugin redirects each test's Shoelace entry import
// ('../../../dist/shoelace.js', or its own './<name>.js') to Velcro's registering entry for that component.
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { esbuildPlugin } from '@web/dev-server-esbuild';
import { playwrightLauncher } from '@web/test-runner-playwright';
import { defaultReporter } from '@web/test-runner';
import { writeFileSync } from 'node:fs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const vendor = 'tests/upstream/shoelace-2.20.1';
const components = readdirSync(new URL('./shoelace-2.20.1/src/components/', import.meta.url)).sort();
// Optional single-component filter, e.g. VELCRO_UPSTREAM_ONLY=button.
const only = process.env.VELCRO_UPSTREAM_ONLY;
// Browsers are parameterized for a later Firefox/WebKit lane; the gate and its ledger currently cover Chromium only.
const products = (process.env.VELCRO_UPSTREAM_BROWSERS || 'chromium').split(',');

const velcroEntries = {
  name: 'velcro-upstream-resolver',
  resolveImport({ source, context }) {
    const importer = decodeURIComponent(context.path);
    const match = importer.match(new RegExp(`/${vendor}/src/components/([a-z-]+)/\\1\\.test\\.ts$`));
    if (!match) return undefined;
    const name = match[1];
    if (source === '../../../dist/shoelace.js' || source === `./${name}.js`) {
      return `/packages/velcro/dist/components/${name}/index.js`;
    }
    return undefined;
  }
};

// Upstream's sprite sheet tests load '/docs/assets/images/sprite.svg', a file Shoelace's docs build generates from
// Bootstrap Icons in its own web root. Velcro's docs site ships the same Bootstrap Icons sprite at
// packages/docs/public/assets/images/sprite.svg, so that one path is served from there. Nothing else is rewritten.
const upstreamDocsAssets = (ctx, next) => {
  if (ctx.path === '/docs/assets/images/sprite.svg') ctx.url = '/packages/docs/public/assets/images/sprite.svg';
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
        <script type="module" src="${testFramework}"></script>
      </body>
    </html>
  `,
};
