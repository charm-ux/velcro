import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const port = 4321;
const outputDir = process.env.VELCRO_PRODUCT_OUT
  ? process.env.VELCRO_PRODUCT_OUT + '/artifacts'
  : fileURLToPath(new URL('../../.airig/product/test-results', import.meta.url));

// Build first, in this order: `pnpm --filter @velcro/docs run build:prefixed`, then `pnpm --filter @velcro/docs run build`
// (the prefixed helper consumes dist/static, so the root build must come last), or run `pnpm verify:product`, which does both.
// This serves the static production output only.
// The root site is served here; base-path.spec.mjs starts its own loopback servers on ephemeral ports for both layouts.
export default defineConfig({
  testDir: fileURLToPath(new URL('.', import.meta.url)),
  testMatch: '*.spec.mjs',
  outputDir,
  forbidOnly: true,
  reporter: 'list',
  // webServer.port makes Playwright set baseURL itself.
  use: { trace: 'off' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'node packages/docs/scripts/preview.mjs',
    cwd: root,
    env: { PORT: String(port), LITRO_BASE_PATH: '' },
    port,
    reuseExistingServer: false,
  },
});
