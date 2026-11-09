// The manifest build looks through a Velcro-local typing class (sl-textarea's CoreTextAreaTyping, sl-input's CoreInputTyping
// and sl-tooltip's CoreTooltipTyping, which only loosen the types of inherited members) and reports the core class it extends as the
// component's superclass. That step must change the output for such a component only: every other component's
// superclass stays what its source says, and the step touches nothing but `superclass`. Both are checked here, on
// fixtures of the plugin and on the analysis of the current sources.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { velcroInheritance } from '../../packages/velcro/custom-elements-manifest.config.mjs';
import { analyzeVelcro, repoRoot } from '../../scripts/api/model.mjs';

const CORE = '@charm-ux/core';
const run = manifest => {
  const out = structuredClone(manifest);
  velcroInheritance().packageLinkPhase({ customElementsManifest: out });
  return out;
};
const declsOf = manifest => Object.fromEntries(manifest.modules.flatMap(m => m.declarations ?? []).map(d => [d.name, d]));
const withoutSuperclass = manifest => {
  const copy = structuredClone(manifest);
  for (const m of copy.modules) for (const d of m.declarations ?? []) delete d.superclass;
  return copy;
};

// Names that exist in core's own manifest, which the plugin reads (CoreButton, CoreTextArea and CharmElement).
const fixture = () => ({
  modules: [
    { path: 'src/components/a/a.ts', declarations: [
      { kind: 'class', name: 'ImportsCore', customElement: true, tagName: 'sl-a', superclass: { name: 'CoreButton', package: `${CORE}/dist/components/button/button.js` }, members: [{ name: 'x', kind: 'field', type: { text: 'string' } }] },
      { kind: 'class', name: 'ExtendsElement', customElement: true, tagName: 'sl-b', superclass: { name: 'ImportsCore', module: '/src/components/a/a.js' } },
      { kind: 'class', name: 'ExtendsUnrelated', customElement: true, tagName: 'sl-c', superclass: { name: 'Plain', module: '/src/components/a/a.js' } },
      { kind: 'class', name: 'ExtendsNothing', customElement: true, tagName: 'sl-d' },
      { kind: 'class', name: 'ExtendsExternal', customElement: true, tagName: 'sl-e', superclass: { name: 'Plain', package: 'some-package' } },
      { kind: 'class', name: 'Plain', superclass: { name: 'NotACoreClass', package: 'some-package' } },
    ] },
    { path: 'src/components/t/t.ts', declarations: [
      { kind: 'class', name: 'Typed', customElement: true, tagName: 'sl-t', superclass: { name: 'Typing', module: '/src/components/t/typing.js' }, members: [{ name: 'y', kind: 'field' }] },
      { kind: 'class', name: 'Typing', superclass: { name: 'CoreTextArea', package: `${CORE}/dist/components/text-area/text-area.js` }, members: [{ name: 'y', kind: 'field', type: { text: 'any' } }] },
    ] },
  ],
});

test('a component extending a local typing class reports the core class it extends; nothing else changes', () => {
  const before = fixture();
  const after = run(before);
  assert.deepEqual(declsOf(after).Typed.superclass, { name: 'CoreTextArea', package: CORE });
  // The typing class itself is not a component and is left as analyzed.
  assert.deepEqual(declsOf(after).Typing.superclass, { name: 'CoreTextArea', package: `${CORE}/dist/components/text-area/text-area.js` });
  // Only `superclass` differs: the run changed no member, attribute, event, slot or part of any declaration.
  assert.deepEqual(withoutSuperclass(after), withoutSuperclass(before));
});

test('every other superclass shape is unchanged by the typing-class step (apart from the existing core package normalisation)', () => {
  const after = declsOf(run(fixture()));
  // A superclass imported from core: only the package is normalised to '@charm-ux/core', as before this step existed.
  assert.deepEqual(after.ImportsCore.superclass, { name: 'CoreButton', package: CORE });
  // Another component, a class that does not extend core, an external package and no superclass at all.
  assert.deepEqual(after.ExtendsElement.superclass, { name: 'ImportsCore', module: '/src/components/a/a.js' });
  assert.deepEqual(after.ExtendsUnrelated.superclass, { name: 'Plain', module: '/src/components/a/a.js' });
  assert.deepEqual(after.ExtendsExternal.superclass, { name: 'Plain', package: 'some-package' });
  assert.equal('superclass' in after.ExtendsNothing, false);
});

// The real sources: each component's superclass in the analyzed manifest is what its `extends` clause names. A component
// that extends a class imported from core must report that class; only a component that extends a class of its own folder
// (a typing class) may report something else, and it must be listed here, so a second typing class is a conscious change.
// `declared` lists the loosened `declare <name>: any;` fields; `accessors` the loosened accessor pairs (an inherited core
// accessor cannot be redeclared as a field, so it is overridden by a get/set pair typed `any` that only forwards to core's).
const TYPING_CLASS_COMPONENTS = {
  'sl-input': { typingClass: 'CoreInputTyping', coreClass: 'CoreInput', declared: ['max', 'min', 'step'], accessors: [] },
  'sl-select': { typingClass: 'CoreSelectTyping', coreClass: 'CoreSelect', declared: ['size'], accessors: ['value'] },
  'sl-textarea': { typingClass: 'CoreTextAreaTyping', coreClass: 'CoreTextArea', declared: ['autocomplete', 'resize'], accessors: [] },
  'sl-tooltip': { typingClass: 'CoreTooltipTyping', coreClass: 'CoreTooltip', declared: ['popup'], accessors: ['placement'] },
};

test('on the current sources every component reports the superclass its source extends, except the listed typing-class components', () => {
  const manifest = analyzeVelcro();
  const pkgDir = path.join(repoRoot, 'packages/velcro');
  const seen = [];
  for (const mod of manifest.modules) {
    for (const decl of mod.declarations ?? []) {
      if (!decl.tagName) continue;
      const source = readFileSync(path.join(pkgDir, mod.path), 'utf8');
      const base = source.match(new RegExp(`export class ${decl.name} extends (\\w+)`))?.[1];
      assert.ok(base, `${decl.tagName}: no "extends" clause found for ${decl.name} in ${mod.path}`);
      const imported = [...source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'([^']+)'/g)]
        .flatMap(([, names, from]) => names.split(',').map(n => n.trim().split(/\s+as\s+/)).filter(([original, alias]) => (alias ?? original) === base).map(() => from))[0];
      assert.ok(imported, `${decl.tagName}: ${base} is not imported by ${mod.path}`);
      if (imported.startsWith(`${CORE}/`)) {
        assert.deepEqual(decl.superclass, { name: base, package: CORE }, `${decl.tagName} extends core's ${base}`);
        assert.equal(TYPING_CLASS_COMPONENTS[decl.tagName], undefined, `${decl.tagName} is listed as a typing-class component but extends core directly`);
      } else {
        seen.push(decl.tagName);
        const expected = TYPING_CLASS_COMPONENTS[decl.tagName];
        assert.ok(expected, `${decl.tagName} extends the local class ${base}; add it to TYPING_CLASS_COMPONENTS if it is a typing class`);
        assert.equal(base, expected.typingClass);
        assert.deepEqual(decl.superclass, { name: expected.coreClass, package: CORE }, `${decl.tagName} reports core's ${expected.coreClass}`);
        // The typing class itself extends that core class and declares nothing that is not a loosened core member.
        const typing = readFileSync(path.join(path.dirname(path.join(pkgDir, mod.path)), imported.replace(/\.js$/, '.ts')), 'utf8');
        assert.match(typing, new RegExp(`class ${expected.typingClass} extends ${expected.coreClass} \\{`));
        assert.deepEqual([...typing.matchAll(/^\s+declare (\w+): any;$/gm)].map(m => m[1]).sort(), expected.declared);
        const body = typing.slice(typing.indexOf(`class ${expected.typingClass} `));
        const getters = [...body.matchAll(/^\s+public override get (\w+)\(\): any \{\n\s+return super\.\1;\n\s+\}$/gm)].map(m => m[1]);
        const setters = [...body.matchAll(/^\s+public override set (\w+)\(value: any\) \{\n\s+super\.\1 = value;\n\s+\}$/gm)].map(m => m[1]);
        assert.deepEqual([getters.sort(), setters.sort()], [expected.accessors, expected.accessors]);
        // Nothing else: every member line of the class body is a comment, a loosened declaration or part of those pairs.
        const members = body.split('\n').slice(1).filter(l => /^  \S/.test(l) && !/^  (\/\/|\/\*\*|\}|declare \w+: any;|public override (get|set) \w+\()/.test(l));
        assert.deepEqual(members, [], `${expected.typingClass} declares only loosened core members`);
      }
    }
  }
  assert.deepEqual(seen.sort(), Object.keys(TYPING_CLASS_COMPONENTS).sort());
});
