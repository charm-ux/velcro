import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { RECORDS, VENDOR, readRecords, vendoredComponents } from '../../scripts/upstream-conformance.mjs';

// 'button' and 'button-group': by file name 'button-group.json' sorts before 'button.json' ('-' is before '.'), by component
// name 'button' comes first. The records and the vendored components must come back in the same, component-name order.
test('records are read in component-name order, as the vendored components are, when one name prefixes another', () => {
  const scratch = mkdtempSync(path.join(tmpdir(), 'velcro-records-order-'));
  try {
    const names = ['button-group', 'button', 'tab-group', 'tab', 'tab-panel'];
    mkdirSync(path.join(scratch, RECORDS), { recursive: true });
    for (const name of names) {
      mkdirSync(path.join(scratch, VENDOR, 'src/components', name), { recursive: true });
      writeFileSync(path.join(scratch, RECORDS, `${name}.json`), `${JSON.stringify({ files: {}, tests: [], knownFailures: [] })}\n`);
    }
    const expected = [...names].sort();
    assert.deepEqual(vendoredComponents(scratch), expected);
    assert.deepEqual(Object.keys(readRecords(scratch)), expected);
    assert.deepEqual(Object.keys(readRecords(scratch)), vendoredComponents(scratch));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
