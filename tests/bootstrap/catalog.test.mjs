// Coverage gate: every component must ship its Litro docs page, example, product spec and package/barrel exports.
// It runs in verify:source (node --test, zero skips allowed), so adding a component without them fails verification.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import { fileURLToPath } from 'node:url';
import { CATALOG_LIMITS, CatalogError, checkCoverage, parseCatalog, readCatalog } from '../../scripts/site/catalog.mjs';
import { requiredFiles } from '../../scripts/site/prepare.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const tmp = mkdtempSync(path.join(tmpdir(), 'velcro-catalog-'));
after(() => rmSync(tmp, { recursive: true, force: true }));
let n = 0;

test('the repository is complete: every component directory and catalog entry has all required pieces', () => {
  const catalog = readCatalog(root);
  assert.ok(catalog.length >= 4, 'catalog must not be empty');
  assert.deepEqual(checkCoverage(root), []);
});

// A minimal synthetic repository layout holding one complete component, `alpha`.
function fixture(mutate = () => {}) {
  const dir = path.join(tmp, `repo-${n++}`);
  const put = (rel, text) => {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), text);
  };
  put('packages/docs/catalog.jsonl', '{"name":"alpha","title":"Alpha","tag":"sl-alpha","example":"#demo-default"}\n');
  put('packages/velcro/src/components/alpha/index.ts', 'export {};\n');
  put('packages/velcro/src/index.ts', "export * from './components/alpha/index.js';\n");
  put('packages/velcro/package.json', JSON.stringify({ exports: { '.': {}, './alpha': {} } }));
  put('packages/docs/pages/components/alpha.ts', 'export {};\n');
  put('packages/docs/examples/alpha/basic.html', '<sl-alpha id="demo-default"></sl-alpha>\n');
  put('tests/product/alpha.spec.mjs', 'export {};\n');
  mutate({ dir, put, remove: rel => rmSync(path.join(dir, rel), { recursive: true, force: true }) });
  return dir;
}

test('the synthetic fixture itself passes, so each negative below fails for its own reason', () => {
  assert.deepEqual(checkCoverage(fixture()), []);
});

const negatives = [
  ['a component directory without a catalog entry', ({ put }) => put('packages/velcro/src/components/beta/index.ts', 'export {};\n'), 'beta: component has no catalog entry'],
  ['a catalog entry without a component directory', ({ remove }) => remove('packages/velcro/src/components/alpha'), 'alpha: catalog entry has no component directory'],
  ['a missing docs page', ({ remove }) => remove('packages/docs/pages/components/alpha.ts'), 'alpha: missing docs page'],
  ['a missing example', ({ remove }) => remove('packages/docs/examples/alpha'), 'alpha: no docs example uses <sl-alpha>'],
  ['an example that does not use the tag', ({ put }) => put('packages/docs/examples/alpha/basic.html', '<sl-other></sl-other>\n'), 'alpha: no docs example uses <sl-alpha>'],
  ['a tag that only shares a prefix', ({ put }) => put('packages/docs/examples/alpha/basic.html', '<sl-alphabet></sl-alphabet>\n'), 'alpha: no docs example uses <sl-alpha>'],
  ['a missing product spec', ({ remove }) => remove('tests/product/alpha.spec.mjs'), 'alpha: missing product spec'],
  ['a missing package export', ({ put }) => put('packages/velcro/package.json', JSON.stringify({ exports: { '.': {} } })), 'alpha: missing package export'],
  ['a missing barrel export', ({ put }) => put('packages/velcro/src/index.ts', ''), 'alpha: missing index export'],
  ['a missing catalog file', ({ remove }) => remove('packages/docs/catalog.jsonl'), 'catalog: catalog-unreadable'],
];
for (const [label, mutate, expected] of negatives) {
  test(`gate fails for ${label}`, () => {
    assert.ok(checkCoverage(fixture(mutate)).includes(expected), expected);
  });
}

test('catalog parsing fails closed on every malformed shape', () => {
  const ok = '{"name":"a","title":"A","tag":"sl-a","example":"#x"}\n';
  assert.equal(parseCatalog(ok)[0].name, 'a');
  const bad = (text, code) => assert.throws(() => parseCatalog(text), e => e instanceof CatalogError && e.code === code, code);
  bad('', 'catalog-empty');
  bad(ok.trimEnd(), 'catalog-format');
  bad(ok.replace('\n', '\r\n'), 'catalog-format');
  bad(`${ok}\n`, 'catalog-json');
  bad('[1]\n', 'catalog-shape');
  bad('null\n', 'catalog-shape');
  bad('{"name":"a"}\n', 'catalog-shape');
  bad('{"name":"a","title":"A","tag":"sl-a","example":"#x","extra":"y"}\n', 'catalog-shape');
  bad('{"name":1,"title":"A","tag":"sl-a","example":"#x"}\n', 'catalog-shape');
  for (const name of ['A', 'a_b', '../a', 'a-', '-a', 'a--b', '1a', '']) bad(ok.replace('"name":"a"', `"name":${JSON.stringify(name)}`), 'catalog-name');
  bad(ok.replace('"title":"A"', '"title":"<b>"'), 'catalog-title');
  bad(ok.replace('"tag":"sl-a"', '"tag":"ch-a"'), 'catalog-tag');
  bad(ok.replace('"#x"', '"a b"'), 'catalog-example');
  bad(ok + ok, 'catalog-duplicate');
  bad('{"name":"b","title":"B","tag":"sl-b","example":"#x"}\n' + ok, 'catalog-unsorted');
  const many = Array.from({ length: CATALOG_LIMITS.maxEntries + 1 }, (_, i) => {
    const name = `c${String(i).padStart(3, '0')}`;
    return JSON.stringify({ name, title: name, tag: `sl-${name}`, example: '#x' });
  }).join('\n') + '\n';
  bad(many, 'catalog-too-many');
  bad(`${ok}${' '.repeat(CATALOG_LIMITS.maxBytes)}`, 'catalog-too-large');
});

test('site preparation requires one page per catalog entry and fails closed on a bad catalog', () => {
  const required = requiredFiles(root);
  for (const c of readCatalog(root)) assert.ok(required.includes(`components/${c.name}/index.html`));
  assert.ok(required.includes('index.html') && required.includes('_litro/velcro.js'));
  const dir = fixture(({ put }) => put('packages/docs/catalog.jsonl', 'not json\n'));
  assert.throws(() => requiredFiles(dir), e => e.code === 'catalog-invalid');
  assert.throws(() => requiredFiles(path.join(tmp, 'missing')), e => e.code === 'catalog-invalid');
});

test('the catalog file is sorted, one entry per line', () => {
  const lines = readFileSync(path.join(root, 'packages/docs/catalog.jsonl'), 'utf8').split('\n').filter(Boolean);
  const names = lines.map(l => JSON.parse(l).name);
  assert.deepEqual(names, [...names].sort());
});
