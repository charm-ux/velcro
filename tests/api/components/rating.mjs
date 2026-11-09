// sl-rating's manifest checks, run by tests/api/manifest.test.mjs against one fresh analysis of the sources.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export default function (test, { elements, pkgDir }) {
  test('sl-rating lists Shoelace\'s attributes (only readonly and disabled reflected), focus and blur, sl-change and the typed sl-hover, the base part and four custom properties', () => {
    const rating = elements.get('sl-rating');
    assert.deepEqual(rating.attributes.map(a => a.name).sort(), ['dir', 'disabled', 'getSymbol', 'label', 'lang', 'max', 'precision', 'readonly', 'value']);
    const defaults = Object.fromEntries(rating.attributes.map(a => [a.name, a.default]));
    assert.deepEqual([defaults.label, defaults.value, defaults.max, defaults.precision, defaults.readonly, defaults.disabled], ["''", '0', '5', '1', 'false', 'false']);
    const reflected = rating.members.filter(m => m.kind === 'field' && m.reflects).map(m => m.name).sort();
    assert.deepEqual(reflected, ['disabled', 'readonly']);
    assert.equal(rating.attributes.find(a => a.name === 'getSymbol').type.text, '(value: number) => string');
    const methods = rating.members.filter(m => m.kind === 'method' && m.privacy === 'public' && !m.static).map(m => m.name).sort();
    assert.deepEqual(methods, ['blur', 'focus', 'handleHoverValueChange', 'handleIsHoveringChange']);
    assert.deepEqual((rating.events ?? []).map(e => e.name).sort(), ['ready', 'sl-change', 'sl-hover']);
    assert.equal(rating.events.find(e => e.name === 'sl-hover').type.text, "{ phase: 'start' | 'move' | 'end', value: number }");
    assert.equal(rating.events.find(e => e.name === 'ready').inheritedFrom.package, '@charm-ux/core');
    assert.deepEqual(rating.slots ?? [], []);
    assert.deepEqual(rating.cssParts.map(p => p.name), ['base']);
    assert.deepEqual(rating.cssProperties.map(p => p.name).sort(), ['--symbol-color', '--symbol-color-active', '--symbol-size', '--symbol-spacing']);
  });

  test('the rating type test assigns a string-typed direction, as Shoelace declares dir: string', () => {
    const source = readFileSync(path.join(pkgDir, 'type-tests/rating-dir.tsx'), 'utf8');
    assert.match(source, /declare const direction: string;/);
    assert.match(source, /^rating\.dir = direction;$/m);
    assert.equal(source.match(/@ts-expect-error/g)?.length, 3);
  });
}
