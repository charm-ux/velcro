import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { productPort } from './support/port.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const port = productPort();
const outputDir = process.env.VELCRO_PRODUCT_OUT
  ? process.env.VELCRO_PRODUCT_OUT + '/artifacts'
  : fileURLToPath(new URL('../../.airig/product/test-results', import.meta.url));

// Build first, in this order: `pnpm --filter @velcro/docs run build:prefixed`, then `pnpm --filter @velcro/docs run build`
// (the prefixed helper consumes dist/static, so the root build must come last), or run `pnpm verify:product`, which does both.
// VELCRO_PRODUCT_PORT (integer 1024-65535, default 4321) moves the preview so separate worktrees can verify in parallel.
// This serves the static production output only.
// The root site is served here; base-path.spec.mjs starts its own loopback servers on ephemeral ports for both layouts.
export default defineConfig({
  testDir: fileURLToPath(new URL('.', import.meta.url)),
  testMatch: '*.spec.mjs',
  outputDir,
  forbidOnly: true,
  // Hangs must fail fast and visibly: a stuck test fails after 45 s (specs that need more say so with test.setTimeout), and the
  // whole run stops at 20 min. A normal run takes well under half of that. scripts/verify-product.mjs kills the browser step only
  // at 22 min, so Playwright writes its JSON report (and verify:product prints its summary) first; the CI step bound is 35 min and
  // the product job's 45 min covers installs, builds and the upstream gate as well. global-timeout.test.mjs exercises the
  // stop-and-report path with a short timeout.
  // The runner has 4 vCPUs but Playwright would use half of them; the static preview and the example iframes tolerate 4 workers.
  workers: process.env.CI ? 4 : undefined,
  timeout: 45000,
  globalTimeout: 20 * 60 * 1000,
  reporter: 'list',
  // webServer.port makes Playwright set baseURL itself.
  use: { trace: 'off' },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  webServer: {
    command: 'node packages/docs/scripts/preview.mjs',
    cwd: root,
    env: { PORT: String(port), LITRO_BASE_PATH: '' },
    port,
    reuseExistingServer: false,
  },
});
