// Build output derived from the catalog and the component sources (never committed): after `verify:product`'s builds,
// the package root barrel, the shipped Custom Elements Manifest and both shipped notice copies must be exactly what the
// sources produce. The source-level checks are in tests/bootstrap/sync.test.mjs and tests/product/notices.test.mjs.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { analyzeVelcro, velcroManifestPath } from '../../scripts/api/model.mjs';
import { BARREL, NOTICE_COPIES, assembleNotices, renderBarrel } from '../../scripts/sync.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = rel => readFileSync(path.join(root, rel), 'utf8');

test('the built barrel registers exactly the catalog components', () => {
  expect(read(BARREL)).toBe(renderBarrel(root));
});

test('the shipped manifest is a fresh analysis of the sources', () => {
  expect(JSON.parse(read(velcroManifestPath))).toEqual(analyzeVelcro(root));
});

test('the package and site ship the assembled notices byte for byte', () => {
  const notices = assembleNotices(root);
  for (const copy of NOTICE_COPIES) expect(read(copy), copy).toBe(notices);
  expect(read('packages/docs/dist/static/THIRD_PARTY_NOTICES.md')).toBe(notices);
});
