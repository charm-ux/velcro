import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const copies = ['packages/velcro/THIRD_PARTY_NOTICES.md', 'packages/docs/public/THIRD_PARTY_NOTICES.md'];

test('third-party notices keep the upstream license texts and package/site copies match the root file', () => {
  const root = read('THIRD_PARTY_NOTICES.md');
  assert.match(root, /Copyright \(c\) 2020 A Beautiful Site, LLC/);
  assert.match(root, /Permission is hereby granted, free of charge/);
  assert.match(root, /Version 2\.0, January 2004/);
  assert.match(root, /Copyright 2026 beatzball/);
  assert.match(root, /UNLICENSED/);
  for (const copy of copies) assert.equal(read(copy), root, `${copy} is out of sync`);
});

test('notice scope is source-only and the bundled-dependency release gate is explicit', () => {
  const root = read('THIRD_PARTY_NOTICES.md');
  assert.match(root, /covers only material copied or adapted into this repository's source/);
  assert.match(root, /NOT a complete\s+inventory of third-party code bundled into built artifacts/);
  assert.match(root, /Release gate \(mandatory\)/);
  assert.match(root, /before any package, CDN or site artifact is published, uploaded or deployed/i);
  assert.match(root, /complete\s+license inventory and the required notices for every dependency bundled/);
  assert.doesNotMatch(root, /retains the notices that upstream licenses require for material adapted or copied into this repository\. Nothing/);
  assert.doesNotMatch(root, /so the built site must keep this file available/);
  assert.doesNotMatch(root, /deployed today|No built artifact is published/i, 'shipped notices must not state a time-bound release fact');
  assert.match(root, /never certifies an artifact/);
  assert.match(root, /THIRD_PARTY_RUNTIME_NOTICES\.md/);
});

test('the velcro package ships its notice', () => {
  assert.ok(JSON.parse(read('packages/velcro/package.json')).files.includes('THIRD_PARTY_NOTICES.md'));
});

test('copied or adapted upstream files carry a provenance header', () => {
  const files = [
    'packages/docs/app.ts',
    'packages/docs/app-main.ts',
    'packages/docs/server/middleware/vite-dev.ts',
    'packages/docs/server/handlers/pages.ts',
    'packages/docs/nitro.config.ts',
    'packages/docs/vite.config.ts',
    'packages/velcro/src/components/badge/badge.ts',
    'packages/velcro/src/components/badge/badge.styles.ts',
    'packages/velcro/src/components/button/button.ts',
    'packages/velcro/src/components/divider/divider.ts',
    'packages/velcro/src/components/divider/divider.styles.ts',
    'packages/velcro/src/components/progress-bar/progress-bar.ts',
    'packages/velcro/src/components/progress-bar/progress-bar.styles.ts',
    'packages/velcro/src/components/spinner/spinner.ts',
    'packages/velcro/src/components/spinner/spinner.styles.ts',
    'packages/velcro/themes/light.css',
  ];
  for (const file of files) assert.match(read(file).slice(0, 900), /THIRD_PARTY_NOTICES\.md/, file);
  assert.doesNotMatch(read('packages/docs/app.ts'), /verify-scaffolded-apps\.mjs. fails the build/);
});
