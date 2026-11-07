// The root README's component summary must match the catalog: every tag listed and the count spelled correctly.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { readCatalog } from '../../scripts/site/catalog.mjs';

const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'twenty-one', 'twenty-two', 'twenty-three'];

test('the README lists every catalog component and gives the catalog count', () => {
  const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
  const catalog = readCatalog();
  const count = words[catalog.length];
  assert.ok(count, 'catalog larger than the number words this test knows');
  const line = readme.split('\n').find(l => /^- [a-z-]+ components, /.test(l));
  assert.ok(line, 'component summary line');
  assert.ok(line.startsWith(`- ${count} components, `), line.slice(0, 40));
  const listed = [...line.matchAll(/`(sl-[a-z-]+)`/g)].map(m => m[1]);
  assert.deepEqual(listed, catalog.map(c => c.tag).sort());
  assert.match(readme, new RegExp(`for each of the ${count}, as listed in \`packages/docs/catalog\\.jsonl\``));
});
