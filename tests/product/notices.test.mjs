import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { NOTICE_COPIES, NOTICE_MARKER, assembleNotices } from '../../scripts/sync.mjs';
import { readCatalog } from '../../scripts/site/catalog.mjs';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const read = file => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
const COMPONENTS = 'packages/velcro/src/components';

test('third-party notices keep the upstream license texts; the shipped copies are assembled at build time', () => {
  const root = read('THIRD_PARTY_NOTICES.md');
  assert.match(root, /Copyright \(c\) 2020 A Beautiful Site, LLC/);
  assert.match(root, /Permission is hereby granted, free of charge/);
  assert.match(root, /Version 2\.0, January 2004/);
  assert.match(root, /Copyright 2026 beatzball/);
  assert.match(root, /UNLICENSED/);
  assert.equal(root.split('\n').filter(l => l === NOTICE_MARKER).length, 1, 'one component notice marker');
  // The package and site copies are the root file plus every component's NOTICE.md (built, never committed; the built
  // copies are compared byte for byte in tests/product/notices.spec.mjs).
  const shipped = assembleNotices(repo);
  assert.ok(!shipped.includes(NOTICE_MARKER));
  for (const line of root.split('\n').filter(l => l !== NOTICE_MARKER)) assert.ok(shipped.includes(line), line);
  for (const { name } of readCatalog(repo)) {
    const fragment = path.join(repo, COMPONENTS, name, 'NOTICE.md');
    if (existsSync(fragment)) assert.ok(shipped.includes(readFileSync(fragment, 'utf8').trimEnd()), name);
  }
  assert.deepEqual(NOTICE_COPIES, ['packages/velcro/THIRD_PARTY_NOTICES.md', 'packages/docs/public/THIRD_PARTY_NOTICES.md']);
  assert.match(read('packages/velcro/package.json'), /sync\.mjs notices packages\/velcro\/THIRD_PARTY_NOTICES\.md/);
  assert.match(read('packages/docs/package.json'), /sync\.mjs notices packages\/docs\/public\/THIRD_PARTY_NOTICES\.md/);
});

test('component notice fragments are inserted in catalog order and must be plain list entries', () => {
  const scratch = mkdtempSync(path.join(tmpdir(), 'velcro-notices-'));
  try {
    const put = (rel, text) => {
      mkdirSync(path.dirname(path.join(scratch, rel)), { recursive: true });
      writeFileSync(path.join(scratch, rel), text);
    };
    put('THIRD_PARTY_NOTICES.md', `# Notices\n\n- Root entry.\n${NOTICE_MARKER}\n- Last entry.\n`);
    put('packages/docs/catalog.jsonl', ['zeta', 'alpha', 'mid'].map(n => JSON.stringify({ name: n, title: n[0].toUpperCase() + n.slice(1), tag: `sl-${n}`, example: '#x' })).join('\n') + '\n');
    put(`${COMPONENTS}/zeta/NOTICE.md`, '- Zeta entry.\n  Continued.\n');
    put(`${COMPONENTS}/alpha/NOTICE.md`, '- Alpha entry.\n');
    put(`${COMPONENTS}/orphan/NOTICE.md`, '- Not in the catalog.\n');
    assert.equal(assembleNotices(scratch), '# Notices\n\n- Root entry.\n- Alpha entry.\n- Zeta entry.\n  Continued.\n- Last entry.\n');
    put(`${COMPONENTS}/mid/NOTICE.md`, '## Heading\n');
    assert.throws(() => assembleNotices(scratch), /must be a Markdown list/);
    put(`${COMPONENTS}/mid/NOTICE.md`, '- ok\n');
    put('THIRD_PARTY_NOTICES.md', '# Notices\n');
    assert.throws(() => assembleNotices(scratch), /exactly one component notice marker/);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
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
  // Shared files that copy or adapt upstream material. Component files are covered below by rule, not by list.
  const files = [
    'packages/docs/app.ts',
    'packages/docs/app-main.ts',
    'packages/docs/server/middleware/vite-dev.ts',
    'packages/docs/server/handlers/pages.ts',
    'packages/docs/nitro.config.ts',
    'packages/docs/vite.config.ts',
    'packages/velcro/src/internal/form.ts',
    'packages/velcro/src/internal/composed-offset-parent.ts',
    'packages/velcro/src/internal/drag.ts',
    'packages/velcro/src/internal/math.ts',
    'packages/velcro/src/utilities/animation.ts',
    'packages/velcro/themes/light.css',
    'packages/velcro/themes/dark.css',
  ];
  for (const file of files) assert.match(read(file).slice(0, 900), /THIRD_PARTY_NOTICES\.md/, file);
  assert.doesNotMatch(read('packages/docs/app.ts'), /verify-scaffolded-apps\.mjs. fails the build/);
});

test('every component source file states its provenance in its header', () => {
  // Each catalog component's TypeScript files (but the index.ts and class.ts re-export entries) either point to
  // THIRD_PARTY_NOTICES.md for the Shoelace material they adapt, or state that they include no Shoelace source.
  const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
  let checked = 0;
  for (const { name } of readCatalog(repo)) {
    for (const file of walk(path.join(repo, COMPONENTS, name))) {
      if (!file.endsWith('.ts') || ['index.ts', 'class.ts'].includes(path.basename(file))) continue;
      const rel = path.relative(repo, file).split(path.sep).join('/');
      const header = readFileSync(file, 'utf8').slice(0, 900);
      assert.match(header, /THIRD_PARTY_NOTICES\.md|No Shoelace source is included|written for Velcro/, rel);
      if (/\b(adapted|copied|ported) from\b/i.test(header)) assert.match(header, /THIRD_PARTY_NOTICES\.md/, rel);
      checked++;
    }
  }
  assert.ok(checked >= 40, `${checked} component files checked`);
  // A component's notice fragment names files in its own folder only.
  for (const { name } of readCatalog(repo)) {
    const fragment = path.join(repo, COMPONENTS, name, 'NOTICE.md');
    if (!existsSync(fragment)) continue;
    const paths = [...readFileSync(fragment, 'utf8').matchAll(/`(packages\/velcro\/src\/[^`]+)`/g)].map(m => m[1]);
    assert.ok(paths.length > 0, `${name}/NOTICE.md names the files it covers`);
    for (const p of paths) assert.ok(p.startsWith(`${COMPONENTS}/${name}/`), `${name}/NOTICE.md: ${p}`);
  }
});
