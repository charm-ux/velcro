import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const port = 4321;
const outputDir = process.env.VELCRO_PRODUCT_OUT
  ? process.env.VELCRO_PRODUCT_OUT + '/artifacts'
  : fileURLToPath(new URL('../../.airig/product/test-results', import.meta.url));

// Run `pnpm --filter @velcro/docs build` first; this serves the static production output only.
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
    env: { PORT: String(port) },
    port,
    reuseExistingServer: false,
  },
});
