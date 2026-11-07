// The scan of the build output that CI shares between jobs as a workflow artifact (scripts/ci/scan-build-output.mjs).
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { buildDigest, collect } from '../../scripts/ci/build-output.mjs';
import { STAGING, scanBuildOutput } from '../../scripts/ci/scan-build-output.mjs';

const realRoot = path.resolve(new URL('../..', import.meta.url).pathname);
// The files the build derives outside the dist trees (scripts/sync.mjs) that the later jobs read from the checkout.
const DERIVED = [['packages/velcro/custom-elements.json', '{"schemaVersion":"1"}\n'], ['packages/velcro/src/index.ts', 'export {};\n'],
  ['packages/velcro/THIRD_PARTY_NOTICES.md', '# Notices\n'], ['packages/docs/public/THIRD_PARTY_NOTICES.md', '# Notices\n']];
const DERIVED_LABELS = ['velcro-derived/custom-elements.json={"schemaVersion":"1"}', 'velcro-derived/src/index.ts=export {};',
  'velcro-derived/THIRD_PARTY_NOTICES.md=# Notices', 'docs-derived/public/THIRD_PARTY_NOTICES.md=# Notices'];
const DERIVED_STAGED = ['velcro/custom-elements.json={"schemaVersion":"1"}', 'velcro/src/index.ts=export {};',
  'velcro/THIRD_PARTY_NOTICES.md=# Notices', 'docs/public/THIRD_PARTY_NOTICES.md=# Notices'];
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'velcro-scan-'));
  mkdirSync(path.join(root, 'security'));
  copyFileSync(path.join(realRoot, 'security/policy.json'), path.join(root, 'security/policy.json'));
  for (const [file, text] of [['packages/velcro/dist/index.js', 'export {};\n'], ['packages/docs/dist/static/assets/icons/star.svg', '<svg/>\n'], ['packages/docs/dist/static/index.html', '<p>x</p>\n'], ...DERIVED]) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), text);
  }
  mkdirSync(path.join(root, '.airig/ci'), { recursive: true });
  return root;
}
const SHA = 'a'.repeat(40);
// The build stage's digest of the fixture's output as it is now.
const built = root => buildDigest(collect(root), SHA);
const scan = (root, opts = {}) => scanBuildOutput(root, { sourceSha: SHA, privacy: async () => {}, secrets: async () => {}, ...opts, expectDigest: 'expectDigest' in opts ? opts.expectDigest : built(root) });
const tree = dir => {
  const out = [];
  const walk = (d, rel) => { for (const n of readdirSync(d, { withFileTypes: true })) n.isDirectory() ? walk(path.join(d, n.name), `${rel}${n.name}/`) : out.push(`${rel}${n.name}=${readFileSync(path.join(d, n.name), 'utf8').trim()}`); };
  walk(dir, '');
  return out.sort();
};

test('every shared file is privacy-scanned under a logical label and secret-scanned with .svg names mirrored as .txt', async () => {
  const root = fixture();
  try {
    let labels;
    let mirrored;
    const n = await scan(root, { privacy: async files => { labels = files.map(f => f.rel); }, secrets: async dir => { mirrored = tree(dir); } });
    assert.equal(n, 7);
    assert.deepEqual(labels, ['velcro/index.js', 'docs/static/assets/icons/star.svg', 'docs/static/index.html',
      ...DERIVED_LABELS.map(l => l.split('=')[0])]);
    assert.deepEqual(mirrored, ['docs/static/assets/icons/star.svg.txt=<svg/>', 'docs/static/index.html=<p>x</p>', 'velcro/index.js=export {};', ...DERIVED_LABELS].sort());
    assert.deepEqual(readdirSync(path.join(root, '.airig/ci')), ['product-build'], 'the mirror is removed; only the upload staging remains');
    // Downloaded into packages/, the staging tree puts every derived file back where the checks read it.
    assert.deepEqual(tree(path.join(root, STAGING)), ['docs/dist/static/assets/icons/star.svg=<svg/>', 'docs/dist/static/index.html=<p>x</p>', 'velcro/dist/index.js=export {};', ...DERIVED_STAGED].sort());
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the real privacy rules block a machine path planted in the output, before the secret scan runs', async () => {
  const root = fixture();
  try {
    // Generated at runtime, never committed.
    const planted = ['', 'home', 'u' + 'ser', 'project', 'x.js'].join('/');
    writeFileSync(path.join(root, 'packages/docs/dist/static/assets/icons/star.svg'), `<svg><!-- ${planted} --></svg>\n`);
    let secrets = false;
    await assert.rejects(scan(root, { privacy: undefined, secrets: async () => { secrets = true; } }), e => e.code === 'privacy-findings');
    assert.equal(secrets, false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a symlink or a missing shared tree blocks', async () => {
  const root = fixture();
  try {
    symlinkSync(path.join(root, 'security/policy.json'), path.join(root, 'packages/velcro/dist/link.json'));
    await assert.rejects(scan(root, { expectDigest: 'b'.repeat(64) }), /not-regular/);
    rmSync(path.join(root, 'packages/velcro/dist'), { recursive: true });
    await assert.rejects(scan(root, { expectDigest: 'b'.repeat(64) }), /missing-tree/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a missing or symlinked derived file blocks', async () => {
  for (const [file] of DERIVED) {
    const root = fixture();
    try {
      rmSync(path.join(root, file));
      await assert.rejects(scan(root, { expectDigest: 'b'.repeat(64) }), /missing-tree/, file);
      symlinkSync(path.join(root, 'security/policy.json'), path.join(root, file));
      await assert.rejects(scan(root, { expectDigest: 'b'.repeat(64) }), /not-regular/, file);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test('the upload is staged from exactly the scanned bytes: changes to the live trees during the scan do not reach it', async () => {
  const root = fixture();
  try {
    const live = file => path.join(root, 'packages', file);
    const secrets = async () => {
      writeFileSync(live('velcro/dist/index.js'), 'export const late = 1;\n');
      writeFileSync(live('docs/dist/static/late.js'), 'export {};\n');
    };
    let scanned;
    await scan(root, { privacy: async files => { scanned = files.map(f => `${f.rel}=${f.bytes.toString('utf8').trim()}`).sort(); }, secrets });
    const derived = new Map(DERIVED_STAGED.map((l, i) => [l, DERIVED_LABELS[i]]));
    const staged = tree(path.join(root, STAGING)).map(l => derived.get(l) ?? l.replace(/^(velcro|docs)\/dist\//, '$1/')).sort();
    assert.deepEqual(staged, scanned);
    assert.deepEqual(staged, ['docs/static/assets/icons/star.svg=<svg/>', 'docs/static/index.html=<p>x</p>', 'velcro/index.js=export {};', ...DERIVED_LABELS].sort());
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the secret scan must leave its mirror exactly as written: a changed, added or removed file blocks', async () => {
  for (const [name, change] of [
    ['changed', dir => writeFileSync(path.join(dir, 'velcro/index.js'), 'export const other = 1;\n')],
    ['added', dir => writeFileSync(path.join(dir, 'docs/extra.txt'), 'x\n')],
    ['removed', dir => rmSync(path.join(dir, 'docs/static/index.html'))],
  ]) {
    const root = fixture();
    try {
      await assert.rejects(scan(root, { secrets: async dir => change(dir) }), /mirror-changed/, name);
      assert.throws(() => readdirSync(path.join(root, STAGING)), /ENOENT/, `${name}: nothing staged`);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test('output that differs from the build digest, or a different commit, blocks before anything is scanned or staged', async () => {
  for (const [name, change, sha] of [
    ['library changed', root => writeFileSync(path.join(root, 'packages/velcro/dist/index.js'), 'export const x = 1;\n'), SHA],
    ['docs file added', root => writeFileSync(path.join(root, 'packages/docs/dist/static/new.html'), '<p>n</p>\n'), SHA],
    ['manifest changed', root => writeFileSync(path.join(root, 'packages/velcro/custom-elements.json'), '{}\n'), SHA],
    ['site notices changed', root => writeFileSync(path.join(root, 'packages/docs/public/THIRD_PARTY_NOTICES.md'), '# Other\n'), SHA],
    ['another commit', () => {}, 'c'.repeat(40)],
  ]) {
    const root = fixture();
    try {
      const expectDigest = built(root);
      change(root);
      let scanned = false;
      await assert.rejects(scan(root, { expectDigest, sourceSha: sha, privacy: async () => { scanned = true; } }), /digest-mismatch/, name);
      assert.equal(scanned, false, name);
      assert.throws(() => readdirSync(path.join(root, STAGING)), /ENOENT/, `${name}: nothing staged`);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test('an existing staging tree or a missing digest blocks', async () => {
  const root = fixture();
  try {
    mkdirSync(path.join(root, STAGING));
    await assert.rejects(scan(root), /staging-exists/);
    await assert.rejects(scan(root, { expectDigest: undefined }), /no-digest/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
