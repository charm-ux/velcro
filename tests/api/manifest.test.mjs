// Velcro's Custom Elements Manifest, analyzed fresh from the current source (it is build output, never committed), must
// carry the full API: Velcro's own members and those inherited from @charm-ux/core, each with its origin. Checks that
// concern one component live in tests/api/components/<name>.mjs (one file per component, so adding a component never
// edits this file); each exports a function that registers its tests with this file's shared analysis.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { analyzeVelcro, customElements, repoRoot } from '../../scripts/api/model.mjs';
import { readCatalog } from '../../scripts/site/catalog.mjs';

const pkgDir = path.join(repoRoot, 'packages/velcro');
const manifest = analyzeVelcro();
const elements = customElements(manifest);
const componentChecks = readdirSync(new URL('./components/', import.meta.url)).filter(f => f.endsWith('.mjs')).sort();

test('per-component manifest checks belong to catalog components', () => {
  const names = readCatalog(repoRoot).map(c => c.name);
  for (const f of componentChecks) assert.ok(names.includes(f.replace(/\.mjs$/, '')), f);
});

for (const f of componentChecks) {
  const register = (await import(new URL(`./components/${f}`, import.meta.url))).default;
  assert.equal(typeof register, 'function', f);
  register(test, { manifest, elements, pkgDir });
}

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

test('inherited slots, parts and CSS custom properties are exactly what each class declares with @inheritedKept (measured in tests/product/inherited-api.spec.mjs)', async () => {
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

test('inherited core events a class declares with @inheritedEventDropped are not listed, and only those are dropped', async () => {
  const { droppedInheritedEvents, inheritanceDeclarations } = await import('../../packages/velcro/custom-elements-manifest.config.mjs');
  assert.ok(Object.keys(droppedInheritedEvents).length > 0);
  const byClass = new Map([...elements.values()].map(d => [d.name, d]));
  for (const [name, events] of Object.entries(droppedInheritedEvents)) {
    const listed = (byClass.get(name)?.events ?? []).map(e => e.name);
    for (const e of events) assert.ok(!listed.includes(e), `${name} ${e}`);
  }
  assert.throws(() => inheritanceDeclarations(path.join(repoRoot, 'tests/api/fixtures/bad-inheritance')), /@inheritedKept needs/);
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

test('the React wrapper fix manages hyphenated-attribute props as element properties, on one line or wrapped', async () => {
  const { fixWrapperSource } = await import(new URL('../../packages/velcro/custom-elements-manifest.config.mjs', import.meta.url));
  const generated = [
    'import { useEventListener } from "./react-utils.js";',
    'export const VelcroX = () => {',
    '  return React.createElement(',
    '    "sl-x",',
    '    {',
    '      ref: createForwardedRefHandler(ref, forwardedRef),',
    '      ...restProps,',
    '      size: size ?? undefined,',
    '      "snap-threshold": snapThreshold ?? props["snap-threshold"],',
    '      "maximum-fraction-digits":',
    '        maximumFractionDigits ?? props["maximum-fraction-digits"],',
    '      "help-text": helpText ?? props["help-text"],',
    '      disabled: disabled ? true : undefined,',
    '      tabindex: tabIndex,',
    '      style: { ...props.style },',
    '    },',
    '  );',
    '};',
    '',
  ].join('\n');
  const out = fixWrapperSource(generated);
  // Each is an element property now: none is passed to React as an attribute or a prop.
  assert.match(out, /useElementProps\(ref, \{ snapThreshold, maximumFractionDigits, helpText, disabled \}\);/);
  assert.doesNotMatch(out, /snap-threshold|maximum-fraction-digits|help-text/);
  assert.match(out, /\.\.\.\(tabIndex === undefined \? \{\} : \{ tabindex: tabIndex \}\),/);
  assert.match(out, /ref: createForwardedRefHandler\(ref, forwardedRef\),/);
});
