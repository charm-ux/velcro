// The vendored Shoelace translation modules (packages/velcro/src/translations) against their hash manifest: every file
// is byte-identical to Shoelace 2.20.1 except the listed one-line import adaptation, and every file is registered.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../../packages/velcro/src/translations/', import.meta.url));
const manifest = JSON.parse(readFileSync(path.join(dir, 'UPSTREAM.json'), 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const SHOELACE_CODES = ['ar', 'cs', 'da', 'de', 'de-ch', 'en', 'en-gb', 'es', 'fa', 'fi', 'fr', 'he', 'hr', 'hu', 'id', 'it',
  'ja', 'nb', 'nl', 'nn', 'pl', 'pt', 'ru', 'sl', 'sv', 'tr', 'uk', 'zh-cn', 'zh-tw'];

test('the manifest pins Shoelace 2.20.1 and lists all 29 translation modules', () => {
  assert.equal(manifest.project, 'shoelace-style/shoelace');
  assert.equal(manifest.version, '2.20.1');
  assert.equal(manifest.commit, 'fb59fda70ed737c92611051b49bc7e3a5fed5dc5');
  assert.equal(manifest.license, 'MIT');
  assert.deepEqual(Object.keys(manifest.files).sort(), SHOELACE_CODES.map(c => `src/translations/${c}.ts`).sort());
  const onDisk = readdirSync(dir).filter(f => f !== 'UPSTREAM.json').sort();
  assert.deepEqual(onDisk, SHOELACE_CODES.map(c => `${c}.ts`).sort());
});

test('unadapted translations are byte-identical to upstream', () => {
  const adapted = new Set(manifest.adapted.files);
  const plain = Object.keys(manifest.files).filter(f => !adapted.has(f));
  assert.equal(plain.length, 21);
  for (const rel of plain) {
    assert.equal(sha(readFileSync(path.join(dir, path.basename(rel)))), manifest.files[rel], rel);
  }
});

test('adapted translations differ from upstream only by the registry import line', () => {
  const { files, from, to } = manifest.adapted;
  assert.equal(from, "import { registerTranslation } from '@shoelace-style/localize';");
  assert.equal(to, "import { registerTranslation } from '../internal/localize.js';");
  assert.deepEqual(files, ['ar', 'cs', 'en', 'fi', 'hr', 'id', 'it', 'sl'].map(c => `src/translations/${c}.ts`));
  for (const rel of files) {
    const text = readFileSync(path.join(dir, path.basename(rel)), 'utf8');
    const lines = text.split('\n');
    assert.equal(lines[0], to, rel);
    assert.equal(lines.filter(line => line === to).length, 1, rel);
    assert.ok(!text.includes('@shoelace-style/localize'), rel);
    assert.equal(sha(Buffer.from([from, ...lines.slice(1)].join('\n'))), manifest.files[rel], rel);
  }
});

test('every translation registers itself and imports only the Velcro localization modules or a sibling', () => {
  for (const code of SHOELACE_CODES) {
    const text = readFileSync(path.join(dir, `${code}.ts`), 'utf8');
    assert.match(text, /^registerTranslation\(translation\);$/m, code);
    assert.match(text, /^export default translation;$/m, code);
    const specifiers = [...text.matchAll(/from '([^']+)'/g)].map(m => m[1]);
    for (const s of specifiers) {
      assert.ok(['../utilities/localize.js', '../internal/localize.js', './de.js', './en.js'].includes(s), `${code}: ${s}`);
    }
  }
});
