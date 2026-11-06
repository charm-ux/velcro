// The vendored @shoelace-style/animations data (packages/velcro/src/components/animation/presets/presets.ts) must be
// exactly the published package Shoelace 2.20.1 resolves: the record SOURCE.json beside it pins the package, version,
// npm's sha512 integrity and every tarball file's sha256, plus the canonical digest of the package's data, derived
// from the tarball with `node scripts/vendor/shoelace-animations.mjs verify <tarball>`.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  fileLines,
  presetsDigest,
  readRecord,
  RECORD_PATH,
  VENDORED_PATH,
  vendoredDigest,
  verifyTarball,
} from '../../scripts/vendor/shoelace-animations.mjs';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const tmp = mkdtempSync(path.join(tmpdir(), 'velcro-presets-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

// Shoelace 2.20.1's package-lock.json resolves @shoelace-style/animations to 1.2.0 with this integrity.
const INTEGRITY = 'sha512-avvo1xxkLbv2dgtabdewBbqcJfV0e0zCwFqkPMnHFGbJbBHorRFfMAHh1NG9ymmXn0jW95ibUVH03E1NYXD6Gw==';

test('SOURCE.json pins @shoelace-style/animations 1.2.0 at npm\'s published integrity, with every tarball file', () => {
  const record = readRecord();
  assert.equal(record.package, '@shoelace-style/animations');
  assert.equal(record.version, '1.2.0');
  assert.equal(record.integrity, INTEGRITY);
  assert.deepEqual(record.data, { sha256: record.data.sha256, animations: 98, easings: 29 });
  assert.equal(Object.keys(record.files).length, 105);
  for (const f of ['package.json', 'LICENSE.md', 'dist/LICENSE', 'dist/index.js', 'dist/easings/easings.js', 'dist/attention_seekers/bounce.js']) {
    assert.ok(record.files[f], f);
  }
  assert.deepEqual(Object.keys(record.files), Object.keys(record.files).sort());
  assert.deepEqual(JSON.parse(readFileSync(RECORD_PATH, 'utf8')).files, fileLines(record.files));
  assert.doesNotMatch(readFileSync(RECORD_PATH, 'utf8'), /https?:|registry|\.tgz/i);
});

test('the vendored data is exactly the package\'s data (names and values)', async () => {
  assert.deepEqual(await vendoredDigest(), readRecord().data);
});

test('the digest changes when any value, name or entry changes, and only then', async () => {
  const source = readFileSync(VENDORED_PATH, 'utf8');
  const expected = readRecord().data;
  const variant = async (name, edit) => {
    const file = path.join(tmp, `${name}.ts`);
    const changed = edit(source);
    assert.notEqual(changed, source, name);
    writeFileSync(file, changed);
    return vendoredDigest(file);
  };
  assert.notDeepEqual(await variant('value', s => s.replace("transform: 'translate3d(0, -30px, 0) scaleY(1.1)'", "transform: 'translate3d(0, -31px, 0) scaleY(1.1)'")), expected);
  assert.notDeepEqual(await variant('offset', s => s.replace('{ offset: 0.43,', '{ offset: 0.44,')), expected);
  assert.notDeepEqual(await variant('easing', s => s.replace("easeInOutCubic: 'cubic-bezier(0.645, 0.045, 0.355, 1)'", "easeInOutCubic: 'cubic-bezier(0.645, 0.045, 0.355, 0.9)'")), expected);
  assert.notDeepEqual(await variant('name', s => s.replace('export const bounce:', 'export const bounced:')), expected);
  assert.notDeepEqual(await variant('extra', s => `${s}\nexport const extra: Keyframe[] = [];\n`), expected);
  // Formatting, comments and property order are not data.
  assert.deepEqual(await variant('format', s => `// note\n${s.replace("{ offset: 0, easing: 'cubic-bezier(0.215, 0.61, 0.355, 1)', transform: 'translate3d(0, 0, 0)' }", "{ transform: 'translate3d(0, 0, 0)', offset: 0, easing: 'cubic-bezier(0.215, 0.61, 0.355, 1)' }")}`), expected);
  assert.throws(() => presetsDigest({ bounce: [] }), /no easings table/);
  assert.throws(() => presetsDigest({ easings: {}, bounce: {} }), /not a keyframe list/);
});

test('tarball verification fails closed on another tarball', async () => {
  const { create } = await import('tar');
  const pkg = path.join(tmp, 'fake', 'package');
  mkdirSync(path.join(pkg, 'dist'), { recursive: true });
  writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: '@shoelace-style/animations', version: '1.2.0', type: 'module' }));
  writeFileSync(path.join(pkg, 'dist/index.js'), "export const bounce = [{ offset: 0 }];\nexport const easings = { linear: 'linear' };\n");
  const tarball = path.join(tmp, 'fake.tgz');
  await create({ gzip: true, file: tarball, cwd: path.join(tmp, 'fake'), portable: true }, ['package']);
  const problems = await verifyTarball(tarball);
  assert.match(problems[0], /^tarball integrity sha512-\S+ is not the recorded sha512-avvo1/);
  assert.ok(problems.some(p => p.startsWith('file dist/LICENSE: missing')), 'missing files are reported');
  assert.ok(problems.some(p => p.startsWith('tarball data ')), 'the data digest is compared');
  assert.ok(problems.some(p => p.startsWith('vendored data ')), 'the vendored copy is compared with the tarball');
});

test('the vendored file, the notices and the docs name the package, version and integrity', () => {
  const header = readFileSync(VENDORED_PATH, 'utf8').split('\nexport ')[0];
  assert.match(header, /@shoelace-style\/animations 1\.2\.0/);
  assert.ok(header.includes(INTEGRITY), 'presets.ts header');
  assert.match(header, /SOURCE\.json/);
  for (const f of ['THIRD_PARTY_NOTICES.md', 'packages/velcro/THIRD_PARTY_NOTICES.md', 'packages/docs/public/THIRD_PARTY_NOTICES.md']) {
    assert.ok(readFileSync(path.join(repoRoot, f), 'utf8').includes(INTEGRITY), f);
  }
});
