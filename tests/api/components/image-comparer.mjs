// sl-image-comparer's manifest checks, run by tests/api/manifest.test.mjs against one fresh analysis of the sources.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export default function (test, { elements, pkgDir }) {
  test('sl-image-comparer lists Shoelace\'s reflected position, the base and handle queries, sl-change, three slots, five parts and two custom properties', () => {
    const comparer = elements.get('sl-image-comparer');
    assert.deepEqual(comparer.attributes.map(a => a.name).sort(), ['dir', 'lang', 'position']);
    const position = comparer.members.find(m => m.name === 'position');
    assert.deepEqual([position.type.text, position.default, position.reflects, position.attribute], ['number', '50', true, 'position']);
    const reflected = comparer.members.filter(m => m.kind === 'field' && m.reflects).map(m => m.name);
    assert.deepEqual(reflected, ['position']);
    const fields = comparer.members.filter(m => m.kind === 'field' && m.privacy === 'public' && !m.static).map(m => m.name).sort();
    assert.deepEqual(fields, ['base', 'dir', 'handle', 'lang', 'position']);
    const methods = comparer.members.filter(m => m.kind === 'method' && m.privacy === 'public' && !m.static).map(m => m.name);
    assert.deepEqual(methods, ['handlePositionChange']);
    assert.deepEqual((comparer.events ?? []).map(e => e.name).sort(), ['ready', 'sl-change']);
    assert.equal(comparer.events.find(e => e.name === 'ready').inheritedFrom.package, '@charm-ux/core');
    assert.deepEqual(comparer.slots.map(s => s.name).sort(), ['after', 'before', 'handle']);
    assert.deepEqual(comparer.cssParts.map(p => p.name).sort(), ['after', 'base', 'before', 'divider', 'handle']);
    assert.deepEqual(comparer.cssProperties.map(p => p.name).sort(), ['--divider-width', '--handle-size']);
  });

  test('the image comparer type test assigns a string-typed direction, as Shoelace declares dir: string', () => {
    const source = readFileSync(path.join(pkgDir, 'type-tests/image-comparer-dir.tsx'), 'utf8');
    assert.match(source, /declare const direction: string;/);
    assert.match(source, /^comparer\.dir = direction;$/m);
    assert.equal(source.match(/@ts-expect-error/g)?.length, 2);
  });
}
