/*
 * Derived from @beatzball/create-litro 0.15.3, fullstack recipe template file `dist/recipes/fullstack/template/vite.config.ts`
 * (Litro, Copyright 2026 beatzball, Apache License 2.0). See THIRD_PARTY_NOTICES.md.
 * Changes: adapted: actions plugin removed, second `velcro` entry and CSS asset naming added, comments reduced.
 */
import { defineConfig } from 'vite';

export default defineConfig({
  // Must match publicAssets.baseURL in nitro.config.ts.
  base: '/_litro/',
  resolve: {
    conditions: ['browser', 'module', 'import', 'default'],
  },
  build: {
    outDir: 'dist/client',
    sourcemap: false,
    rollupOptions: {
      // `app` is Litro's hydration/router bundle; `velcro` is the browser-only Velcro runtime that the
      // isolated example documents load. Keeping it a separate entry keeps it out of server rendering.
      input: { app: 'app.ts', velcro: 'velcro-entry.ts' },
      output: {
        entryFileNames: '[name].js',
        assetFileNames: asset => (asset.names?.some(n => n.endsWith('.css')) ? '[name][extname]' : 'assets/[name]-[hash][extname]'),
      },
    },
  },
});
