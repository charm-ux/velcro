import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { NOTICE_COPIES, NOTICE_MARKER, assembleNotices, checkProvenance } from '../../scripts/sync.mjs';
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
  // copies are compared byte for byte in tests/product/derived-output.spec.mjs).
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
    'packages/velcro/src/internal/modal.ts',
    'packages/velcro/src/internal/tabbable.ts',
    'packages/velcro/src/internal/active-elements.ts',
    'packages/velcro/src/internal/scroll.ts',
    'packages/velcro/src/internal/offset.ts',
    'packages/velcro/src/internal/close-active-element.ts',
    'packages/velcro/src/utilities/animation.ts',
    'packages/velcro/themes/light.css',
    'packages/velcro/themes/dark.css',
  ];
  for (const file of files) assert.match(read(file).slice(0, 900), /THIRD_PARTY_NOTICES\.md/, file);
  assert.doesNotMatch(read('packages/docs/app.ts'), /verify-scaffolded-apps\.mjs. fails the build/);
});

test('every component source file states its provenance, and every file the notices name exists and cites them', () => {
  // scripts/sync.mjs checkProvenance: component headers, NOTICE.md scope, and the files the shipped notices name.
  assert.deepEqual(checkProvenance(repo), []);
  const cited = assembleNotices(repo).split('\n').flatMap(l => [...l.matchAll(/`(packages\/velcro\/src\/components\/[^`<>*]+\.ts)`(?! \(written for Velcro)/g)].map(m => m[1]));
  assert.ok(cited.length >= 30, `${cited.length} component files named by the notices must cite them`);
});

test('negative controls: a dropped citation, a missing named file and a fragment outside its folder are problems', () => {
  const scratch = mkdtempSync(path.join(tmpdir(), 'velcro-provenance-'));
  try {
    for (const f of ['THIRD_PARTY_NOTICES.md', 'packages/docs/catalog.jsonl', COMPONENTS]) cpSync(path.join(repo, f), path.join(scratch, f), { recursive: true });
    assert.deepEqual(checkProvenance(scratch), []);
    const badge = `${COMPONENTS}/badge/badge.ts`;
    const original = readFileSync(path.join(scratch, badge), 'utf8');
    // The notices still say badge.ts adapts Shoelace material, so a header that claims otherwise is caught.
    writeFileSync(path.join(scratch, badge), `// Badge, written for Velcro.\n${original.replace(/^(\/\/.*\n)+/, '')}`);
    assert.deepEqual(checkProvenance(scratch), [`${badge}: named in the notices but its header does not cite THIRD_PARTY_NOTICES.md`]);
    writeFileSync(path.join(scratch, badge), original.replace(/THIRD_PARTY_NOTICES\.md/g, 'the notices'));
    assert.ok(checkProvenance(scratch).includes(`${badge}: no provenance statement in its header`));
    writeFileSync(path.join(scratch, badge), original);
    writeFileSync(path.join(scratch, `${COMPONENTS}/badge/NOTICE.md`), `- \`${COMPONENTS}/badge/gone.ts\` adapts Shoelace's badge.\n`);
    assert.deepEqual(checkProvenance(scratch), [`THIRD_PARTY_NOTICES.md: names a missing file ${COMPONENTS}/badge/gone.ts`]);
    writeFileSync(path.join(scratch, `${COMPONENTS}/badge/NOTICE.md`), `- \`${COMPONENTS}/card/card.ts\` adapts Shoelace's card.\n`);
    assert.deepEqual(checkProvenance(scratch), [`${COMPONENTS}/badge/NOTICE.md: names another folder's file ${COMPONENTS}/card/card.ts`]);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
