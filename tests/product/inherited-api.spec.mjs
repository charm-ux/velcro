// Per-component rule for the inherited template-bound API in the manifest: an inherited core CSS custom property is
// listed exactly when it still has an effect on the Velcro element (core's styles are kept and their selector still
// matches the Velcro template), and an inherited core slot or part is listed exactly when the Velcro template renders
// it. Measured in the browser (support/inherited-api.mjs): each candidate is set on the host and every computed style in
// the shadow tree and of the slotted content is compared, in the default state, with each reflected boolean attribute
// set, and under real :hover, :active (pointer held) and :focus-visible (keyboard modality) interaction in each of those.
//
// Where each component's tests are registered: a component whose core superclass has CSS custom property candidates runs
// them from its own file, tests/product/<name>.inherited-api.spec.mjs, and every other element from this spec. Measuring
// the candidates is most of this check's time (minutes per engine), and CI's shards (--shard) split the tests in file
// order: when all of them were here, one shard of each engine got them all and was the slowest leg of every run. In a
// file named after the component they sit next to its own spec, so the shards spread them with the rest of the suite.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { coreCandidates, elements, inheritedApiTests } from './support/inherited-api.mjs';
import { readCatalog } from '../../scripts/site/catalog.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const productDir = path.join(root, 'tests/product');
const catalog = readCatalog(root);
const SUFFIX = '.inherited-api.spec.mjs';
const ownSpec = tag => {
  const entry = catalog.find(c => c.tag === tag);
  return entry ? path.join(productDir, `${entry.name}${SUFFIX}`) : null;
};

test('probe files belong to catalog components and hold only content, attributes and a note', () => {
  const names = catalog.map(c => c.name);
  for (const f of readdirSync(productDir).filter(f => f.endsWith('.probe.json'))) {
    expect(names, f).toContain(f.replace(/\.probe\.json$/, ''));
    const probe = JSON.parse(readFileSync(path.join(productDir, f), 'utf8'));
    expect(Object.keys(probe).every(k => ['content', 'attrs', 'fixed', 'note'].includes(k)), f).toBe(true);
    expect(typeof probe.content, f).toBe('string');
    if ('fixed' in probe) {
      expect(Array.isArray(probe.fixed) && probe.fixed.every(a => typeof a === 'string'), f).toBe(true);
      expect(typeof probe.note, f).toBe('string');
    }
  }
});

test('a component has its own inherited-API spec exactly when it has candidates, and that spec registers only its own tests', () => {
  const files = readdirSync(productDir).filter(f => f.endsWith(SUFFIX)).sort();
  const expected = catalog.filter(c => elements.has(c.tag) && coreCandidates(c.tag).length > 0).map(c => `${c.name}${SUFFIX}`).sort();
  expect(files, `add or remove tests/product/<name>${SUFFIX} (it calls inheritedApiTests('<tag>'))`).toEqual(expected);
  for (const f of files) {
    const { tag } = catalog.find(c => `${c.name}${SUFFIX}` === f);
    const calls = [...readFileSync(path.join(productDir, f), 'utf8').matchAll(/\binheritedApiTests\(\s*(['"`])(.*?)\1\s*\)/g)].map(m => m[2]);
    expect(calls, f).toEqual([tag]);
  }
});

// Every other element: no own spec, so its tests are registered here.
for (const tag of elements.keys()) {
  const own = ownSpec(tag);
  if (!own || !existsSync(own)) inheritedApiTests(tag);
}
