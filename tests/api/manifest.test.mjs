// The committed Custom Elements Manifest must be exactly what the analyzer produces from the current source, and it
// must carry the full API: Velcro's own members and those inherited from @charm-ux/core, each with its origin.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import { customElements, readJson, repoRoot, velcroManifestPath } from '../../scripts/api/model.mjs';
import { readCatalog } from '../../scripts/site/catalog.mjs';

const pkgDir = path.join(repoRoot, 'packages/velcro');
const tmp = mkdtempSync(path.join(tmpdir(), 'velcro-cem-'));
after(() => rmSync(tmp, { recursive: true, force: true }));
const manifest = readJson(velcroManifestPath);
const elements = customElements(manifest);

test('the committed manifest matches a fresh analysis of the source (run `pnpm --filter @charm-ux/velcro run analyze`)', () => {
  const cli = path.join(pkgDir, 'node_modules/@custom-elements-manifest/analyzer/cem.js');
  // The analyzer joins --outdir onto its working directory, so it must be relative.
  const r = spawnSync(process.execPath, [cli, 'analyze', '--outdir', path.relative(pkgDir, tmp)], { cwd: pkgDir,
    encoding: 'utf8', timeout: 300000, env: { ...process.env, VELCRO_CEM_REACT_OUTDIR: path.join(tmp, 'react') } });
  assert.equal(r.status, 0, 'analyzer failed');
  const fresh = readFileSync(path.join(tmp, 'custom-elements.json'), 'utf8');
  assert.equal(fresh, readFileSync(path.join(repoRoot, velcroManifestPath), 'utf8'));
});

test('every catalog component is in the manifest with its sl- tag, status and core superclass', () => {
  const catalog = readCatalog(repoRoot);
  assert.equal(elements.size, catalog.length);
  for (const { tag } of catalog) {
    const decl = elements.get(tag);
    assert.ok(decl, `${tag} missing`);
    assert.equal(decl.customElement, true);
    assert.equal(decl.status, 'prototype', tag);
    assert.equal(decl.superclass?.package, '@charm-ux/core', tag);
  }
});

test('inherited core members, attributes and events are present and name their core class and package', () => {
  const button = elements.get('sl-button');
  // sl-button redeclares disabled with Shoelace's default; toggle is a core extension it inherits unchanged.
  const toggle = button.members.find(m => m.name === 'toggle');
  assert.deepEqual(toggle.inheritedFrom && { name: toggle.inheritedFrom.name, package: toggle.inheritedFrom.package },
    { name: 'CoreButton', package: '@charm-ux/core' });
  const autofocus = button.attributes.find(a => a.name === 'autofocus');
  assert.equal(autofocus.inheritedFrom.name, 'CharmFocusableElement');
  const variant = button.members.find(m => m.name === 'variant');
  assert.equal(variant.inheritedFrom, undefined, 'own members carry no inheritedFrom');
  assert.equal(variant.reflects, true);
  for (const [tag, decl] of elements) {
    const ready = decl.events.find(e => e.name === 'ready');
    assert.equal(ready?.inheritedFrom?.package, '@charm-ux/core', `${tag}: inherited ready event`);
    for (const key of ['members', 'attributes', 'events']) {
      for (const item of decl[key] ?? []) {
        if (item.inheritedFrom) assert.equal(item.inheritedFrom.package, '@charm-ux/core', `${tag} ${key} ${item.name}`);
      }
    }
  }
});

test('sl-switch documents its core extensions truthfully: inert ones say so and no label slot is advertised', () => {
  const sw = elements.get('sl-switch');
  const member = name => sw.members.find(m => m.name === name);
  for (const name of ['invalid', 'labelPosition', 'autofocus']) {
    assert.match(member(name).description, /^Velcro extension \(core\), inert:/, name);
    assert.equal(member(name).inheritedFrom, undefined, `${name} is redeclared with the switch's own description`);
  }
  for (const name of ['readonly', 'label', 'hideLabel', 'errorMessage']) {
    assert.match(member(name).description, /^Velcro extension \(core\):/, name);
  }
  const text = JSON.stringify(sw);
  assert.doesNotMatch(text, /`label` slot/);
  assert.deepEqual(sw.slots.map(s => s.name).sort(), ['', 'help-text']);
  // dir and lang as Shoelace's base element declares them; core's computed dir is not inherited.
  for (const name of ['dir', 'lang']) {
    const attr = sw.attributes.find(a => a.name === name);
    assert.ok(attr, name);
    assert.equal(attr.inheritedFrom, undefined, name);
    assert.equal(member(name).reflects, undefined, `${name} does not reflect`);
  }
});

test('inherited slots, parts and CSS custom properties are exactly the per-component kept list (measured in tests/product/inherited-api.spec.mjs)', async () => {
  const { keptInherited } = await import('../../packages/velcro/custom-elements-manifest.config.mjs');
  for (const [tag, decl] of elements) {
    for (const key of ['slots', 'cssParts', 'cssProperties']) {
      const inherited = (decl[key] ?? []).filter(item => item.inheritedFrom);
      assert.deepEqual(inherited.map(i => i.name).sort(), [...(keptInherited[decl.name]?.[key] ?? [])].sort(), `${tag} ${key}`);
      for (const item of inherited) assert.equal(item.inheritedFrom.package, '@charm-ux/core', `${tag} ${key} ${item.name}`);
    }
  }
  // sl-button no longer applies core's button styles, so none of core's --button-* properties are listed.
  assert.ok(!(elements.get('sl-button').cssProperties ?? []).some(p => p.inheritedFrom));
  assert.deepEqual(elements.get('sl-button').cssParts.map(p => p.name).sort(),
    ['base', 'button-control', 'caret', 'label', 'prefix', 'spinner', 'suffix']);
});

test('the package ships the manifest and the React wrappers', () => {
  const pkg = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
  assert.equal(pkg.customElements, 'custom-elements.json');
  assert.ok(pkg.files.includes('custom-elements.json'));
  assert.equal(pkg.exports['./custom-elements.json'], './custom-elements.json');
  assert.equal(pkg.exports['./react/*'], './dist/react/*');
  assert.match(pkg.scripts.build, /tsc -p tsconfig\.json && pnpm run analyze && tsc -p tsconfig\.react\.json/);
});

test('the React wrapper type test checks Shoelace props, rejects bad values and pins the known gaps', () => {
  const source = readFileSync(path.join(pkgDir, 'type-tests/react-button.tsx'), 'utf8');
  for (const prop of ['variant', 'size', 'caret', 'disabled', 'loading', 'outline', 'pill', 'circle', 'type', 'name', 'value', 'href', 'target', 'rel', 'form', 'formAction', 'formEnctype', 'formMethod', 'formNoValidate', 'formTarget', 'onSlBlur', 'onSlFocus', 'onSlInvalid']) {
    assert.match(source, new RegExp(`\\b${prop}[:,]`), prop);
  }
  // Only the two bad-value checks remain; the Shoelace gaps they used to pin (rel, form*, sl-invalid) are implemented.
  assert.equal(source.match(/@ts-expect-error/g)?.length, 2);
  const jsx = readFileSync(path.join(pkgDir, 'type-tests/jsx-intrinsic.tsx'), 'utf8');
  assert.match(jsx, /useRef<VelcroButton>\(null\)/);
  assert.match(jsx, /<sl-button ref=\{hookRef\}/);
  assert.match(jsx, /<sl-button ref=\{objectRef\}/);
  assert.equal(jsx.match(/@ts-expect-error/g)?.length, 2);
  const config = JSON.parse(readFileSync(path.join(pkgDir, 'tsconfig.react.json'), 'utf8'));
  assert.deepEqual(config.include, ['dist/react/*.d.ts', 'type-tests/*.tsx']);
  assert.equal(config.compilerOptions.strict, true);
  assert.equal(config.compilerOptions.skipLibCheck, false);
});
