/*
 * Derived from @beatzball/create-litro 0.15.3, fullstack recipe template file `dist/recipes/fullstack/template/nitro.config.ts`
 * (Litro, Copyright 2026 beatzball, Apache License 2.0). See THIRD_PARTY_NOTICES.md.
 * Changes: adapted: server actions removed, catch-all handler registered explicitly, comments reduced.
 */
import { defineNitroConfig } from 'nitropack/config';
import type { Nitro } from 'nitropack';
import { resolve } from 'node:path';
import { ssrPreset, ssgPreset } from '@beatzball/litro/config';
import pagesPlugin from '@beatzball/litro/plugins';
import ssgPlugin from '@beatzball/litro/plugins/ssg';

// LITRO_MODE=static (litro generate) is the deployment target for the docs.
const mode = process.env.LITRO_MODE ?? 'server';

export default defineNitroConfig({
  ...(mode === 'static' ? ssgPreset() : ssrPreset()),
  srcDir: 'server',
  publicAssets: [
    { dir: '../dist/client', baseURL: '/_litro/', maxAge: 31536000 },
    { dir: '../public', baseURL: '/', maxAge: 0 },
  ],
  externals: { inline: ['@lit-labs/ssr', '@lit-labs/ssr-client'] },
  esbuild: {
    options: {
      tsconfigRaw: {
        compilerOptions: {
          experimentalDecorators: true,
          useDefineForClassFields: false,
        },
      },
    },
  },
  ignore: ['**/middleware/vite-dev.ts'],
  handlers: [
    {
      middleware: true,
      handler: resolve('./server/middleware/vite-dev.ts'),
      env: 'dev',
    },
    // Catch-all page renderer (the scaffold's `routes/[...].ts`, registered explicitly under a plain filename).
    { route: '/**', handler: resolve('./server/handlers/pages.ts') },
  ],
  hooks: {
    'build:before': async (nitro: Nitro) => {
      await pagesPlugin(nitro);
      await ssgPlugin(nitro);
    },
  },
  compatibilityDate: '2025-01-01',
});
