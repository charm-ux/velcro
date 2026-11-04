import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { TESTED_LIMITS, readTestedEvidence, sameSnapshot, snapshotTree } from '../../scripts/site/tested.mjs';

const tmp = mkdtempSync(path.join(tmpdir(), 'velcro-tested-'));
after(() => rmSync(tmp, { recursive: true, force: true }));
let n = 0;
const dir = files => {
  const d = path.join(tmp, `d${n++}`);
  for (const [rel, text] of Object.entries(files)) { mkdirSync(path.dirname(path.join(d, rel)), { recursive: true }); writeFileSync(path.join(d, rel), text); }
  return d;
};
const code = fn => { try { fn(); } catch (e) { return e.code; } return 'no-error'; };

test('snapshots are deterministic, content-sensitive and sensitive to additions', () => {
  const a = snapshotTree(dir({ 'x.html': '1', 'a/b.js': '2' }));
  assert.ok(sameSnapshot(a, snapshotTree(dir({ 'a/b.js': '2', 'x.html': '1' }))));
  assert.ok(!sameSnapshot(a, snapshotTree(dir({ 'x.html': '1', 'a/b.js': '3' }))));
  assert.ok(!sameSnapshot(a, snapshotTree(dir({ 'x.html': '1', 'a/b.js': '2', 'c': '' }))));
});

test('snapshots reject links and enforce bounds', () => {
  const d = dir({ 'x.html': '1' });
  symlinkSync('x.html', path.join(d, 'l.html'));
  assert.equal(code(() => snapshotTree(d)), 'not-regular');
  assert.equal(code(() => snapshotTree(dir({ 'big.js': 'a'.repeat(TESTED_LIMITS.maxFileBytes + 1) }))), 'file-too-large');
  assert.equal(code(() => snapshotTree(dir(Object.fromEntries(Array.from({ length: TESTED_LIMITS.maxEntries + 1 }, (_, i) => [`f${i}`, 'x']))))), 'too-many-entries');
});

test('evidence must be valid, passed and bounded', () => {
  const bad = path.join(tmp, 'bad.json');
  writeFileSync(bad, '[]');
  assert.equal(code(() => readTestedEvidence(bad)), 'tested-evidence-invalid');
  assert.equal(code(() => readTestedEvidence(path.join(tmp, 'absent.json'))), 'tested-evidence-missing');
  writeFileSync(bad, 'x'.repeat(TESTED_LIMITS.maxEvidenceBytes + 1));
  assert.equal(code(() => readTestedEvidence(bad)), 'tested-evidence-missing');
});
