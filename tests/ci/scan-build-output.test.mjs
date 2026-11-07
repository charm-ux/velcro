// The scan of the build output that CI shares between jobs as a workflow artifact (scripts/ci/scan-build-output.mjs).
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { scanBuildOutput } from '../../scripts/ci/scan-build-output.mjs';

const realRoot = path.resolve(new URL('../..', import.meta.url).pathname);
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'velcro-scan-'));
  mkdirSync(path.join(root, 'security'));
  copyFileSync(path.join(realRoot, 'security/policy.json'), path.join(root, 'security/policy.json'));
  for (const [file, text] of [['packages/velcro/dist/index.js', 'export {};\n'], ['packages/docs/dist/static/assets/icons/star.svg', '<svg/>\n'], ['packages/docs/dist/static/index.html', '<p>x</p>\n']]) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), text);
  }
  mkdirSync(path.join(root, '.airig/ci'), { recursive: true });
  return root;
}
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
    const n = await scanBuildOutput(root, { privacy: async files => { labels = files.map(f => f.rel); }, secrets: async dir => { mirrored = tree(dir); } });
    assert.equal(n, 3);
    assert.deepEqual(labels, ['velcro/index.js', 'docs/static/assets/icons/star.svg', 'docs/static/index.html']);
    assert.deepEqual(mirrored, ['docs/static/assets/icons/star.svg.txt=<svg/>', 'docs/static/index.html=<p>x</p>', 'velcro/index.js=export {};']);
    assert.deepEqual(readdirSync(path.join(root, '.airig/ci')), [], 'the mirror is removed');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the real privacy rules block a machine path planted in the output, before the secret scan runs', async () => {
  const root = fixture();
  try {
    // Generated at runtime, never committed.
    const planted = ['', 'home', 'u' + 'ser', 'project', 'x.js'].join('/');
    writeFileSync(path.join(root, 'packages/docs/dist/static/assets/icons/star.svg'), `<svg><!-- ${planted} --></svg>\n`);
    let secrets = false;
    await assert.rejects(scanBuildOutput(root, { secrets: async () => { secrets = true; } }), e => e.code === 'privacy-findings');
    assert.equal(secrets, false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a symlink or a missing shared tree blocks', async () => {
  const root = fixture();
  try {
    symlinkSync(path.join(root, 'security/policy.json'), path.join(root, 'packages/velcro/dist/link.json'));
    await assert.rejects(scanBuildOutput(root, { privacy: async () => {}, secrets: async () => {} }), /not-regular/);
    rmSync(path.join(root, 'packages/velcro/dist'), { recursive: true });
    await assert.rejects(scanBuildOutput(root, { privacy: async () => {}, secrets: async () => {} }), /ENOENT|not-directory/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
