// The real prefixed docs build, as verify:product leaves it, must pass site preparation's file walk: only allowlisted
// files, every bundle file in the recorded closure, and icon assets that match the release hashes. The unit tests in
// tests/site use synthetic trees; this catches build changes (such as Vite copying public/ into the bundle directory)
// before the CI site preparation step does.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { checkIconAssets, collectSource, requiredFiles } from '../../scripts/site/prepare.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const docsDist = path.join(repoRoot, 'packages/docs/dist');

test('the real prefixed docs output passes site preparation\'s walk, closure and icon asset checks', () => {
  const closure = JSON.parse(readFileSync(path.join(docsDist, 'closure/client-closure-velcro.json'), 'utf8'));
  const { staged, omitted } = collectSource(path.join(docsDist, 'static-prefixed'), closure, requiredFiles(repoRoot));
  checkIconAssets(staged, repoRoot);
  const rels = staged.map(f => f.rel);
  // The public/ assets ship once, at the site root, and never again under the bundle directory.
  expect(rels).toContain('assets/images/sprite.svg');
  expect(rels).toContain('assets/icons/icons.json');
  expect(rels.filter(r => r.startsWith('_litro/') && !/\.(?:js|css)$/.test(r))).toEqual([]);
  expect(existsSync(path.join(docsDist, 'static-prefixed/_litro/assets/images'))).toBe(false);
  expect(existsSync(path.join(docsDist, 'client/assets/images'))).toBe(false);
  expect(omitted).toEqual(['nitro.json']);
});
