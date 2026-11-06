// The vendored @shoelace-style/animations data (packages/velcro/src/components/animation/presets/presets.ts) must be
// exactly the published package Shoelace 2.20.1 resolves: the record SOURCE.json beside it pins the package, version,
// npm's sha512 integrity and every tarball file's sha256, plus the canonical digest of the package's data, derived
// from the tarball with `node scripts/vendor/shoelace-animations.mjs verify <tarball>`. These tests tie the vendored data
// to that recorded digest; the record itself is re-checked against the published tarball only by running `verify`
// offline on an acquired tarball (the tarball is not committed).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  fileLines,
  parseDataModule,
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

// Builds a gzipped tarball under package/ from { path: text } at runtime; returns its path, its sha512 integrity and the
// sha256 of each file, so a test can hand verifyTarball a record that matches it up to a chosen stage.
async function fakeTarball(name, files, { symlink } = {}) {
  const { create } = await import('tar');
  const root = path.join(tmp, name);
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, 'package', file)), { recursive: true });
    writeFileSync(path.join(root, 'package', file), text);
  }
  if (symlink) symlinkSync('package.json', path.join(root, 'package', symlink));
  const tarball = path.join(tmp, `${name}.tgz`);
  await create({ gzip: true, file: tarball, cwd: root, portable: true }, ['package']);
  const integrity = `sha512-${createHash('sha512').update(readFileSync(tarball)).digest('base64')}`;
  const hashes = Object.fromEntries(Object.entries(files).map(([file, text]) => [file, createHash('sha256').update(text).digest('hex')]));
  return { tarball, integrity, hashes, root };
}

// Top-level code in a fake package writes this marker; verification must never run it.
const marker = path.join(tmp, 'tarball-code-ran');
const pkgJson = JSON.stringify({ name: '@shoelace-style/animations', version: '1.2.0', type: 'module' });
const hostile = {
  'package.json': pkgJson,
  'dist/index.js': `import { writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(marker)}, 'ran');\nexport * from './attention_seekers/bounce.js';\n`,
  'dist/attention_seekers/bounce.js': "export const bounce = [{ offset: 0 }];\nexport const easings = { linear: 'linear' };\n",
};

test('a tampered tarball is rejected on its integrity alone: nothing is read further, extracted or run', async () => {
  const { tarball, root } = await fakeTarball('tampered', hostile);
  const scratch = () => readdirSync(tmpdir()).filter(name => name.startsWith('velcro-animations-')).length;
  const before = scratch();
  assert.deepEqual(await verifyTarball(tarball), [
    `tarball integrity ${(await fakeTarball('tampered-again', hostile)).integrity} is not the recorded ${INTEGRITY}`,
  ]);
  assert.equal(existsSync(marker), false, 'the tarball\'s code did not run');
  assert.equal(scratch(), before, 'nothing was extracted');
  // The marker is a working tripwire: running the fake's entry point does write it.
  await import(pathToFileURL(path.join(root, 'package/dist/index.js')).href);
  assert.equal(existsSync(marker), true);
  rmSync(marker);
});

test('past the integrity check the archive is still untrusted: each stage stops verification, and no code runs', async () => {
  const record = readRecord();
  // Matching integrity but other files: stops at the file hashes, before any data is read.
  const other = await fakeTarball('other-files', hostile);
  const fileProblems = await verifyTarball(other.tarball, { ...record, integrity: other.integrity });
  assert.ok(fileProblems.some(p => p.startsWith('file dist/LICENSE: missing')), 'missing files are reported');
  assert.ok(fileProblems.some(p => p.startsWith('file dist/index.js: ')), 'changed files are reported');
  assert.ok(fileProblems.every(p => p.startsWith('file ')), fileProblems.join('\n'));
  // Matching integrity and files: the data is parsed, never run, so code is rejected rather than executed.
  const matched = async (name, files) => {
    const fake = await fakeTarball(name, files);
    return verifyTarball(fake.tarball, { ...record, integrity: fake.integrity, files: fake.hashes });
  };
  assert.deepEqual(await matched('code-in-index', hostile), ['tarball data: dist/index.js: statement at 0 is not `export * | { <names> } from \'./<file>.js\'`']);
  assert.match((await matched('code-in-module', {
    ...hostile,
    'dist/index.js': "export * from './attention_seekers/bounce.js';\n",
    'dist/attention_seekers/bounce.js': `export const bounce = (await import('node:fs')).writeFileSync(${JSON.stringify(marker)}, 'ran');\n`,
  }))[0], /^tarball data: dist\/attention_seekers\/bounce\.js bounce: \w+ is not a literal$/);
  assert.equal(existsSync(marker), false, 'no tarball code ran');
  // Plain data that differs from the package's is reported against the record and the vendored copy.
  const data = await matched('other-data', {
    'package.json': pkgJson,
    'dist/index.js': "export * from './attention_seekers/bounce.js';\nexport { easings } from './easings/easings.js';\n",
    'dist/attention_seekers/bounce.js': 'export const bounce = [{ offset: 0 }];\n',
    'dist/easings/easings.js': "export const easings = { linear: 'linear' };\nexport const unused = 1;\n",
  });
  assert.equal(data.length, 2, data.join('\n'));
  assert.match(data[0], /^tarball data \{"animations":1,"easings":1,"sha256":"[0-9a-f]{64}"\} != recorded /);
  assert.match(data[1], /^vendored data \{"animations":98,"easings":29,/);
  // Links and other non-file entries are refused.
  const linked = await fakeTarball('linked', { 'package.json': pkgJson }, { symlink: 'link.json' });
  assert.deepEqual(await verifyTarball(linked.tarball, { ...record, integrity: linked.integrity }), ['tarball archive: unsupported tar entry type "2" for "package/link.json"']);
});

test('the data parser reads the vendored module to the same data as importing it', async () => {
  const parsed = Object.fromEntries(await parseDataModule(readFileSync(VENDORED_PATH, 'utf8'), 'presets.ts'));
  assert.deepEqual(presetsDigest(parsed), await vendoredDigest());
  await assert.rejects(parseDataModule('export const a = [{ ...b }];', 'x.js'), /not a plain property/);
  await assert.rejects(parseDataModule('export let a = 1;', 'x.js'), /is not `export const/);
  await assert.rejects(parseDataModule('export const a = `x${1}`;', 'x.js'), /TemplateExpression is not a literal/);
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
