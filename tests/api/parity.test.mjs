// Shoelace API parity gate: the gaps between Shoelace 2.20.1's documented API and Velcro's manifest must equal the
// committed ledger, which may only shrink, and the committed report must be current.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { compare, currentParity, ledgerPath, normalize, readLedger, renderReport, reportPath } from '../../scripts/api/parity.mjs';
import { customElements, readJson, repoRoot, shoelaceManifestPath } from '../../scripts/api/model.mjs';
import { readCatalog } from '../../scripts/site/catalog.mjs';
import { SHOELACE } from '../../scripts/api/shoelace-subset.mjs';

const parity = currentParity();
const ledger = readLedger();

test('the gaps equal the ledger: a new gap fails, and a closed gap must be removed from the ledger', () => {
  assert.ok(Array.isArray(ledger), 'ledger missing');
  assert.deepEqual(parity.gaps.filter(g => !ledger.includes(g)), [], 'new gaps (fix them; the ledger may not grow)');
  assert.deepEqual(ledger.filter(g => !parity.gaps.includes(g)), [], 'closed gaps (run `node scripts/api/parity.mjs ledger`)');
});

test('the ledger only shrinks relative to origin/main', () => {
  const r = spawnSync('git', ['-C', repoRoot, 'show', `origin/main:${ledgerPath}`], { encoding: 'utf8' });
  const exists = spawnSync('git', ['-C', repoRoot, 'cat-file', '-e', 'origin/main'], { encoding: 'utf8' });
  assert.equal(exists.status, 0, 'origin/main is required as the ledger baseline');
  if (r.status !== 0) {
    // The ledger is introduced by this change; there is no earlier ledger on main to compare with.
    assert.match(r.stderr, /does not exist|exists on disk, but not in/);
    return;
  }
  const base = JSON.parse(r.stdout).gaps;
  assert.deepEqual(ledger.filter(g => !base.includes(g)), [], 'entries added to the ledger');
});

test('docs/api-parity.md is the current generated report (run `node scripts/api/parity.mjs report`)', () => {
  assert.equal(readFileSync(path.join(repoRoot, reportPath), 'utf8'), renderReport(parity));
});

test('the Shoelace subset covers exactly the catalog components and carries its provenance', () => {
  const upstream = readJson(shoelaceManifestPath);
  const tags = readCatalog(repoRoot).map(c => c.tag).sort();
  assert.deepEqual([...customElements(upstream).keys()].sort(), tags);
  const p = upstream['x-provenance'];
  assert.equal(p.version, '2.20.1');
  assert.equal(p.commit, SHOELACE.commit);
  assert.equal(p.license, 'MIT');
  assert.match(p.notice, /A Beautiful Site, LLC/);
  const notices = readFileSync(path.join(repoRoot, 'THIRD_PARTY_NOTICES.md'), 'utf8');
  assert.ok(notices.includes(shoelaceManifestPath), 'THIRD_PARTY_NOTICES.md lists the subset');
});

test('normalization ignores only whitespace, quote style and union order', () => {
  assert.equal(normalize('type', "'b' |  'a'"), normalize('type', '"a" | "b"'));
  assert.notEqual(normalize('type', 'string'), normalize('type', 'string | undefined'));
  assert.notEqual(normalize('default', "''"), normalize('default', ''));
  assert.equal(normalize('reflects', true), 'true');
});

test('the comparison detects missing and mismatched entries and reports extras with their origin', () => {
  const el = (tag, extra) => ({ modules: [{ declarations: [{ tagName: tag, customElement: true, ...extra }] }] });
  const up = el('sl-x', {
    members: [
      { kind: 'field', name: 'a', attribute: 'a', type: { text: 'string' }, default: "''", reflects: true, description: 'A.' },
      { kind: 'field', name: 'b', attribute: 'b', type: { text: 'number' }, description: 'B.' },
      { kind: 'field', name: 'internal', type: { text: 'number' } },
      { kind: 'method', name: 'go', return: { type: { text: 'void' } }, description: 'Go.' },
    ],
    events: [{ name: 'sl-x', description: 'X.' }],
    slots: [{ name: '', description: 'Default.' }],
    cssParts: [{ name: 'base' }],
    cssProperties: [{ name: '--c', default: '1px' }],
  });
  const ours = el('sl-x', {
    members: [
      { kind: 'field', name: 'a', attribute: 'a', type: { text: 'string' }, default: "''", reflects: false },
      { kind: 'field', name: 'dir', attribute: 'dir', inheritedFrom: { name: 'CharmElement', package: '@charm-ux/core' } },
      { kind: 'field', name: 'own' },
    ],
    events: [{ name: 'sl-x' }],
    cssParts: [{ name: 'base' }],
    cssProperties: [{ name: '--c', default: '2px' }],
  });
  const r = compare(ours, up, ['sl-x']);
  assert.deepEqual(r.gaps, [
    'sl-x css-property --c: default differs (shoelace "1px", velcro "2px")',
    'sl-x method go: missing',
    'sl-x property a: reflects differs (shoelace "true", velcro "false")',
    'sl-x property b: missing',
    'sl-x slot (default): missing',
  ]);
  assert.deepEqual(r.extras.map(e => `${e.kind} ${e.name} ${e.origin}`), ['property dir from @charm-ux/core CharmElement', 'property own ']);
  assert.deepEqual(r.counts['sl-x'], { compared: 7, matched: 2, missing: 3, mismatched: 2, velcroOnly: 1, inherited: 1 });
});
