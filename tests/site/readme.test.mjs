// The root README points to the component catalog instead of copying it: a component list or count in the README would
// go stale with every component added (and make parallel component branches edit the same line).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { readCatalog } from '../../scripts/site/catalog.mjs';

test('the README names the catalog as the component list and lists no component or count itself', () => {
  const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
  assert.match(readme, /the components listed in the catalog, `packages\/docs\/catalog\.jsonl`/);
  assert.match(readme, /`\/components\/<name>` for each catalog component/);
  for (const { tag } of readCatalog()) assert.ok(!readme.includes(`\`${tag}\``), `README lists ${tag}`);
  assert.doesNotMatch(readme, /\b(twenty|thirty|forty|fifty)(-[a-z]+)? components\b|\b\d+ components\b(?! library)/i);
});
