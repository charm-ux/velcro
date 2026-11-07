// Coverage gate: every component must ship its Litro docs page, example, product spec and package/barrel exports.
// It runs in verify:source (node --test, zero skips allowed), so adding a component without them fails verification.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import { fileURLToPath } from 'node:url';
import { CATALOG_LIMITS, CatalogError, MODULE_EXPORTS, checkCoverage, checkExports, parseCatalog, readCatalog } from '../../scripts/site/catalog.mjs';
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

const tgt = f => ({ types: `./dist/${f}.d.ts`, import: `./dist/${f}.js` });
const baseExports = names => ({
  '.': tgt('index'),
  ...Object.fromEntries(names.map(x => [`./${x}`, tgt(`components/${x}/index`)])),
  './themes/dark.css': './themes/dark.css',
  './themes/light.css': './themes/light.css',
  './custom-elements.json': './custom-elements.json',
  './react': { types: './dist/react/index.d.ts', import: './dist/react/index.js' },
  './react/*': './dist/react/*',
  './package.json': './package.json',
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
  put('packages/velcro/package.json', JSON.stringify({ exports: baseExports(['alpha']) }));
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
  ['a missing package export', ({ put }) => put('packages/velcro/package.json', JSON.stringify({ exports: baseExports([]) })), 'alpha: missing package export'],
  ['wrong package export targets', ({ put }) => put('packages/velcro/package.json', JSON.stringify({ exports: { ...baseExports(['alpha']), './alpha': tgt('components/zzz/index') } })), 'alpha: wrong package export targets'],
  ['a stray export', ({ put }) => put('packages/velcro/package.json', JSON.stringify({ exports: { ...baseExports(['alpha']), './scratch': './x.txt' } })), 'package.json: unexpected export ./scratch'],
  ['a class export for a non-component', ({ put }) => put('packages/velcro/package.json', JSON.stringify({ exports: { ...baseExports(['alpha']), './ghost/class': tgt('components/ghost/class') } })), 'package.json: unexpected export ./ghost/class'],
  ['wrong class export targets', ({ put }) => put('packages/velcro/package.json', JSON.stringify({ exports: { ...baseExports(['alpha']), './alpha/class': tgt('components/alpha/index') } })), 'alpha: wrong class export targets'],
  ['a module export whose component is not in the catalog', ({ put }) => put('packages/velcro/package.json', JSON.stringify({ exports: { ...baseExports(['alpha']), './utilities/animation': tgt('utilities/animation') } })), 'package.json: unexpected export ./utilities/animation'],
  ['an unlisted module export', ({ put }) => put('packages/velcro/package.json', JSON.stringify({ exports: { ...baseExports(['alpha']), './alpha/internal': tgt('components/alpha/internal') } })), 'package.json: unexpected export ./alpha/internal'],
  ['an orphan docs page', ({ put }) => put('packages/docs/pages/components/orphan.ts', 'export {};\n'), 'orphan: docs page has no catalog entry'],
  ['an example selector that matches nothing', ({ put }) => put('packages/docs/catalog.jsonl', '{"name":"alpha","title":"Alpha","tag":"sl-alpha","example":"#nope"}\n'), 'alpha: example selector #nope matches nothing in its examples'],
  ['an unsupported example selector', ({ put }) => put('packages/docs/catalog.jsonl', '{"name":"alpha","title":"Alpha","tag":"sl-alpha","example":".cls"}\n'), 'alpha: example selector .cls is unsupported'],
  ['a missing barrel export', ({ put }) => put('packages/velcro/src/index.ts', ''), 'alpha: missing index export'],
  ['a missing catalog file', ({ remove }) => remove('packages/docs/catalog.jsonl'), 'catalog: catalog-unreadable'],
];
for (const [label, mutate, expected] of negatives) {
  test(`gate fails for ${label}`, () => {
    assert.ok(checkCoverage(fixture(mutate)).includes(expected), expected);
  });
}

// Non-registering modules Shoelace publishes are exported by exact key (MODULE_EXPORTS): required while their component
// is in the catalog, with exact targets, and never admitted by the ./<name>/class pattern.
const includeCatalog = [{ name: 'include' }];
const includeExports = { ...baseExports(['include']), './include/request': tgt('components/include/request') };
test('the module export table lists exactly the animation modules and the include helper, by full key', () => {
  assert.deepEqual(Object.entries(MODULE_EXPORTS), [
    ['./animation/animations', ['animation', 'components/animation/animations']],
    ['./include/request', ['include', 'components/include/request']],
    ['./utilities/animation', ['animation', 'utilities/animation']],
  ]);
  assert.equal(Object.isFrozen(MODULE_EXPORTS), true);
});
test('a module export is required, exact, and allowed only by its full key and only with its component', () => {
  assert.deepEqual(checkExports(includeExports, includeCatalog), []);
  const { './include/request': _omitted, ...without } = includeExports;
  assert.deepEqual(checkExports(without, includeCatalog), ['include: missing module export ./include/request']);
  assert.deepEqual(checkExports({ ...includeExports, './include/request': tgt('components/include/index') }, includeCatalog), ['include: wrong module export targets for ./include/request']);
  assert.deepEqual(checkExports({ ...includeExports, './include/request': './dist/components/include/request.js' }, includeCatalog), ['include: wrong module export targets for ./include/request']);
  assert.deepEqual(checkExports({ ...includeExports, './include/request': { import: './dist/components/include/request.js', types: './dist/components/include/request.d.ts', default: './x.js' } }, includeCatalog), ['include: wrong module export targets for ./include/request']);
  // Other subpaths of the owner, deeper paths and other components' look-alikes are unexpected.
  for (const key of ['./include/other', './include/request/extra', './include/request.js', './include/Request', './include/class/request']) {
    assert.deepEqual(checkExports({ ...includeExports, [key]: tgt('components/include/other') }, includeCatalog), [`package.json: unexpected export ${key}`], key);
  }
  assert.deepEqual(checkExports({ ...baseExports(['alpha']), './alpha/request': tgt('components/alpha/request') }, [{ name: 'alpha' }]), ['package.json: unexpected export ./alpha/request']);
  // Without its component in the catalog the entry is neither required nor allowed.
  assert.deepEqual(checkExports(baseExports(['alpha']), [{ name: 'alpha' }]), []);
  assert.deepEqual(checkExports({ ...baseExports(['alpha']), './include/request': tgt('components/include/request') }, [{ name: 'alpha' }]), ['package.json: unexpected export ./include/request']);
  assert.deepEqual(checkExports(includeExports, [{ name: 'alpha' }]), ['alpha: missing package export', 'package.json: unexpected export ./include', 'package.json: unexpected export ./include/request']);
});
test('object prototype names are not export keys or components: nothing is admitted, nothing throws', () => {
  // A catalog entry whose name is an Object.prototype property still needs its own export, and gains no module export.
  assert.deepEqual(checkExports(baseExports([]), [{ name: 'constructor' }]), ['constructor: missing package export']);
  assert.deepEqual(checkExports({ ...baseExports(['constructor']), './constructor/request': tgt('components/constructor/request') }, [{ name: 'constructor' }]), ['package.json: unexpected export ./constructor/request']);
  // JSON.parse keeps __proto__ as an own key; it is no allowed export either.
  const polluted = JSON.parse('{"./__proto__": {}, "./constructor": {}, "./toString/class": {}}');
  assert.deepEqual(checkExports({ ...baseExports([]), ...polluted }, []).sort(),
    ['package.json: unexpected export ./__proto__', 'package.json: unexpected export ./constructor', 'package.json: unexpected export ./toString/class']);
});

test('a complete additional component passes the combined source contracts', () => {
  const dir = fixture(({ put }) => {
    put('packages/docs/catalog.jsonl', '{"name":"alpha","title":"Alpha","tag":"sl-alpha","example":"#demo-default"}\n{"name":"beta-box","title":"Beta Box","tag":"sl-beta-box","example":"sl-beta-box"}\n');
    put('packages/velcro/src/components/beta-box/index.ts', 'export {};\n');
    put('packages/velcro/src/index.ts', "export * from './components/alpha/index.js';\nexport * from './components/beta-box/index.js';\n");
    put('packages/velcro/package.json', JSON.stringify({ exports: { ...baseExports(['alpha', 'beta-box']), './beta-box/class': tgt('components/beta-box/class') } }));
    put('packages/docs/pages/components/beta-box.ts', 'export {};\n');
    put('packages/docs/examples/beta-box/basic.html', '<sl-beta-box></sl-beta-box>\n');
    put('tests/product/beta-box.spec.mjs', 'export {};\n');
  });
  assert.deepEqual(checkCoverage(dir), []);
  assert.deepEqual(checkExports(JSON.parse(readFileSync(path.join(dir, 'packages/velcro/package.json'), 'utf8')).exports, readCatalog(dir)), []);
});

test('module exports are accepted only for a catalog component and only with their exact targets', () => {
  const catalog = [{ name: 'animation', title: 'Animation', tag: 'sl-animation', example: '#x' }];
  const ok = { ...baseExports(['animation']), './animation/animations': tgt('components/animation/animations'), './utilities/animation': tgt('utilities/animation') };
  assert.deepEqual(checkExports(ok, catalog), []);
  assert.deepEqual(Object.keys(MODULE_EXPORTS).sort(), ['./animation/animations', './include/request', './utilities/animation']);
  const { './utilities/animation': _omitted, ...without } = ok;
  assert.deepEqual(checkExports(without, catalog), ['animation: missing module export ./utilities/animation']);
  assert.deepEqual(checkExports({ ...ok, './utilities/animation': tgt('components/animation/index') }, catalog),
    ['animation: wrong module export targets for ./utilities/animation']);
  assert.deepEqual(checkExports({ ...ok, './animation/animations': './dist/components/animation/animations.js' }, catalog),
    ['animation: wrong module export targets for ./animation/animations']);
  assert.deepEqual(checkExports({ ...ok, './utilities/registration': tgt('utilities/registration') }, catalog),
    ['package.json: unexpected export ./utilities/registration']);
});

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
  bad(ok.replace('"title":"A"', '"title":"Progress bar"'), 'catalog-title');
  bad(ok.replace('"title":"A"', '"title":"a"'), 'catalog-title');
  bad(ok.replace('"title":"A"', '"title":"A  B"'), 'catalog-title');
  bad(ok.replace('"tag":"sl-a"', '"tag":"ch-a"'), 'catalog-tag');
  bad(ok.replace('"tag":"sl-a"', '"tag":"sl-b"'), 'catalog-tag');
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
