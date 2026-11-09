// sl-dropdown's manifest checks, run by tests/api/manifest.test.mjs against one fresh analysis of the sources.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export default function (test, { elements, pkgDir }) {
  test('sl-dropdown lists Shoelace\'s four events and core\'s ready event, the default and trigger slots, four parts, and no custom properties', () => {
    const dropdown = elements.get('sl-dropdown');
    assert.deepEqual((dropdown.events ?? []).map(e => e.name).sort(), ['ready', 'sl-after-hide', 'sl-after-show', 'sl-hide', 'sl-show']);
    assert.equal(dropdown.events.find(e => e.name === 'ready').inheritedFrom.package, '@charm-ux/core');
    assert.deepEqual(dropdown.slots.map(s => s.name).sort(), ['', 'trigger']);
    assert.deepEqual(dropdown.cssParts.map(p => p.name).sort(), ['base', 'base__popup', 'panel', 'trigger']);
    assert.deepEqual(dropdown.cssProperties ?? [], []);
  });

  test('sl-dropdown lists Shoelace\'s attributes, and only open, placement, disabled, stay-open-on-select and sync reflect', () => {
    const dropdown = elements.get('sl-dropdown');
    assert.deepEqual(dropdown.attributes.map(a => a.name).sort(),
      ['dir', 'disabled', 'distance', 'hoist', 'lang', 'open', 'placement', 'skidding', 'stay-open-on-select', 'sync']);
    const reflects = dropdown.members.filter(m => m.kind === 'field' && m.reflects).map(m => m.name).sort();
    assert.deepEqual(reflects, ['disabled', 'open', 'placement', 'stayOpenOnSelect', 'sync']);
    assert.equal(dropdown.attributes.find(a => a.name === 'placement').default, "'bottom-start'");
    assert.equal(dropdown.attributes.find(a => a.name === 'sync').type.text, "'width' | 'height' | 'both' | undefined");
  });

  test('the dropdown dir type test assigns a string-typed direction, as Shoelace declares dir: string', () => {
    const source = readFileSync(path.join(pkgDir, 'type-tests/dropdown-dir.tsx'), 'utf8');
    assert.match(source, /declare const direction: string;/);
    assert.match(source, /^dropdown\.dir = direction;$/m);
    assert.equal(source.match(/@ts-expect-error a number is not a direction/g)?.length, 1);
  });
}
