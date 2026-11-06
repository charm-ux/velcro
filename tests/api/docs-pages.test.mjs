// Component pages render their API tables from the Custom Elements Manifest instead of hand-written tables, and the
// docs data generated for them is exactly the manifest's API model. The rendered tables are checked against the
// manifest in the browser (tests/product/api-reference.spec.mjs).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { apiModel, customElements, readJson, repoRoot, velcroManifestPath } from '../../scripts/api/model.mjs';
import { readCatalog } from '../../scripts/site/catalog.mjs';

const catalog = readCatalog(repoRoot);
const API_IDS = ['attributes', 'methods', 'events', 'slots', 'parts', 'css-properties'];

test('every component page renders apiReference for its own tag and hand-writes no API section', () => {
  for (const { name, tag } of catalog) {
    const source = readFileSync(path.join(repoRoot, 'packages/docs/pages/components', `${name}.ts`), 'utf8');
    const calls = [...source.matchAll(/\bapiReference\('([^']+)'/g)].map(m => m[1]);
    assert.deepEqual(calls, [tag], name);
    for (const id of API_IDS) assert.doesNotMatch(source, new RegExp(`<h2 id="${id}"`), `${name}: hand-written ${id}`);
    assert.doesNotMatch(source, /<table/, `${name}: hand-written table`);
  }
});

test('the docs API data generator emits the manifest model of every catalog component', async () => {
  const generator = readFileSync(path.join(repoRoot, 'packages/docs/scripts/generate-examples.mjs'), 'utf8');
  assert.match(generator, /apiModel\(decl\)/);
  const elements = customElements(readJson(velcroManifestPath));
  const button = apiModel(elements.get('sl-button'));
  assert.ok(button.properties.some(p => p.name === 'toggle' && p.origin === 'from @charm-ux/core CoreButton'));
  assert.ok(button.properties.some(p => p.name === 'variant' && p.origin === '' && p.reflects && p.attribute === 'variant'));
  assert.ok(button.methods.some(m => m.name === 'click'));
  for (const { tag } of catalog) {
    const model = apiModel(elements.get(tag));
    // sl-switch and sl-popup declare dir themselves, as Shoelace's base element does (not core's computed direction).
    const dirOrigin = ['sl-switch', 'sl-popup'].includes(tag) ? (o => o === '') : (o => o.startsWith('from @charm-ux/core'));
    assert.ok(model.properties.some(p => p.name === 'dir' && dirOrigin(p.origin)), `${tag}: dir origin`);
  }
});
