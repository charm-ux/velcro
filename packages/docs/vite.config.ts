/*
 * Derived from @beatzball/create-litro 0.15.3, fullstack recipe template file `dist/recipes/fullstack/template/vite.config.ts`
 * (Litro, Copyright 2026 beatzball, Apache License 2.0). See THIRD_PARTY_NOTICES.md.
 * Changes: adapted: actions plugin removed, build-time base path and closure-capture plugin added, second `velcro` entry and CSS asset naming added, comments reduced.
 */
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { closurePlugin } from './closure-plugin.js';
import { siteBase } from './site-base.js';

const docsRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  // The asset directory must match publicAssets.baseURL in nitro.config.ts; siteBase (LITRO_BASE_PATH) is the
  // project-site prefix the host adds in front of the emitted layout. Empty means the site root.
  base: `${siteBase}/_litro/`,
  // Records the client module/package closure (logical ids and hashes only) for the site notices; never ships.
  // One file per base path, because the root and project-site builds emit different chunks.
  plugins: [closurePlugin({ repoRoot: fileURLToPath(new URL('../..', import.meta.url)), out: `${docsRoot}dist/closure/client-closure${siteBase.replaceAll('/', '-')}.json` })],
  define: { __SITE_BASE__: JSON.stringify(siteBase) },
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
      // Keep the `velcro` entry's exports (Vite drops entry exports in app builds by default): example documents
      // import them through an import map.
      preserveEntrySignatures: 'exports-only',
      output: {
        entryFileNames: '[name].js',
        assetFileNames: asset => (asset.names?.some(n => n.endsWith('.css')) ? '[name][extname]' : 'assets/[name]-[hash][extname]'),
      },
    },
  },
});
