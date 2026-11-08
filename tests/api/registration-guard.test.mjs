// Guard: every tag Velcro registers goes through `defineVelcroComponent` (packages/velcro/src/utilities/registration.ts),
// which registers it as Shoelace 2.20.1's `ShoelaceElement.define` does: a tag that is already defined is left alone
// (with Shoelace's version-mismatch warning) and a class the platform refuses is defined as an anonymous subclass, so
// importing a registering entry never throws on a tag clash. This fails when a component entry or class registers a tag
// in any other (strict) way, or when the helper module exports a second registration function.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const velcroSrc = fileURLToPath(new URL('../../packages/velcro/src/', import.meta.url));
const componentsDir = path.join(velcroSrc, 'components');
const components = readdirSync(componentsDir, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort();

// Ways to define a custom element other than the Shoelace-equivalent helper: the native registry, core's scope
// registration and its project-wide configuration.
const STRICT = [/\bcustomElements\s*\.\s*define\s*\(/, /\bregisterComponent\s*\(/, /\bupdateProject\s*\(/];
// Line and block comments are not code; strip them so documentation may name these calls.
const code = source => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

test('the guard finds the component entries it checks', () => {
  assert.ok(components.length > 30, `${components.length} components`);
  for (const name of ['avatar', 'button', 'checkbox', 'icon-button', 'input', 'radio', 'radio-group', 'tab', 'tab-group', 'tag', 'tooltip']) {
    assert.ok(components.includes(name), name);
  }
});

test('the registration module exports one registration function and no strict variant', () => {
  const source = code(readFileSync(path.join(velcroSrc, 'utilities', 'registration.ts'), 'utf8'));
  const functions = [...source.matchAll(/^export\s+(?:async\s+)?function\s+(\w+)/gm)].map(m => m[1]);
  const values = [...source.matchAll(/^export\s+(?:const|let|var|class)\s+(\w+)/gm)].map(m => m[1]);
  assert.deepEqual(functions, ['defineVelcroComponent']);
  assert.deepEqual(values, []);
  // It never throws on a clash: the only throw is the TypeError for a constructor without a usable baseName.
  assert.deepEqual([...source.matchAll(/\bthrow\s+new\s+(\w+)/g)].map(m => m[1]), ['TypeError']);
});

for (const name of components) {
  test(`${name}: the entry registers every tag with defineVelcroComponent and no strict call`, () => {
    const source = code(readFileSync(path.join(componentsDir, name, 'index.ts'), 'utf8'));
    assert.match(source, /\bdefineVelcroComponent\(/, `${name}/index.ts does not register its class`);
    for (const pattern of STRICT) assert.doesNotMatch(source, pattern, `${name}/index.ts registers a tag with ${pattern}`);
  });

  test(`${name}: the component sources register no tag with a strict call`, () => {
    const dir = path.join(componentsDir, name);
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.ts') || file === 'index.ts') continue;
      const source = code(readFileSync(path.join(dir, file), 'utf8'));
      for (const pattern of STRICT) assert.doesNotMatch(source, pattern, `${name}/${file} registers a tag with ${pattern}`);
    }
  });
}
