// Showcase gate: the landing page renders one live snippet per catalog component (packages/docs/showcase/<name>.html).
// A catalog component without a snippet, a snippet that does not use the component's tag, or a stray snippet fails here
// (in verify:source) and in the docs build, which runs the same check.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { readCatalog } from '../../scripts/site/catalog.mjs';
import { showcaseProblems } from '../../packages/docs/scripts/showcase.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const dir = path.join(root, 'packages/docs/showcase');

test('every catalog component has a showcase snippet that uses its tag, and there are no strays', () => {
  const files = readdirSync(dir).filter(f => f.endsWith('.html')).sort();
  assert.deepEqual(showcaseProblems(readCatalog(root), files, f => readFileSync(path.join(dir, f), 'utf8')), []);
  assert.equal(files.length, readCatalog(root).length);
});

const alpha = [{ name: 'alpha', tag: 'sl-alpha' }];
const negatives = [
  ['a missing snippet', [], {}, 'alpha: missing showcase/alpha.html'],
  ['a snippet without the tag', ['alpha.html'], { 'alpha.html': '<sl-other></sl-other>' }, 'alpha: showcase does not use <sl-alpha>'],
  ['a tag that only shares a prefix', ['alpha.html'], { 'alpha.html': '<sl-alphabet></sl-alphabet>' }, 'alpha: showcase does not use <sl-alpha>'],
  ['a stray snippet', ['alpha.html', 'ghost.html'], { 'alpha.html': '<sl-alpha></sl-alpha>', 'ghost.html': '' }, 'ghost.html: showcase file has no catalog entry'],
];
for (const [label, files, texts, expected] of negatives) {
  test(`showcase gate fails for ${label}`, () => {
    assert.ok(showcaseProblems(alpha, files, f => texts[f]).includes(expected), expected);
  });
}

test('the showcase gate passes a complete synthetic catalog', () => {
  assert.deepEqual(showcaseProblems(alpha, ['alpha.html'], () => '<sl-alpha>x</sl-alpha>'), []);
});
