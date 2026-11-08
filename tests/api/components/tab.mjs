// tab's manifest checks, run by tests/api/manifest.test.mjs against one fresh analysis of the sources.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export default function (test, { elements, pkgDir }) {
  test('sl-tab lists Shoelace\'s API plus core\'s ready event and the inert selected property; core\'s slots, part and custom properties are not advertised', () => {
    const tab = elements.get('sl-tab');
    assert.deepEqual(tab.attributes.map(a => a.name).sort(), ['active', 'closable', 'dir', 'disabled', 'lang', 'panel']);
    assert.deepEqual((tab.events ?? []).map(e => e.name).sort(), ['ready', 'sl-close']);
    assert.equal(tab.events.find(e => e.name === 'ready').inheritedFrom.package, '@charm-ux/core');
    assert.deepEqual(tab.slots.map(s => s.name), ['']);
    assert.deepEqual(tab.cssParts.map(p => p.name), ['base', 'close-button', 'close-button__base']);
    assert.equal(tab.cssProperties, undefined);
    const reflected = tab.members.filter(m => m.kind === 'field' && m.reflects).map(m => m.name).sort();
    assert.deepEqual(reflected, ['active', 'closable', 'disabled', 'panel']);
    const selected = tab.members.find(m => m.name === 'selected');
    assert.equal(selected.attribute, undefined);
    assert.equal(selected.inheritedFrom, undefined);
    assert.match(selected.description, /Velcro extension/);
    assert.ok(!tab.members.some(m => m.name === 'tabPanel'));
  });

  test('the sl-tab and sl-tab-group type test assigns a string-typed direction and pins placement and activation', () => {
    const source = readFileSync(path.join(pkgDir, 'type-tests/tab.tsx'), 'utf8');
    assert.match(source, /declare const direction: string;/);
    assert.match(source, /^tab\.dir = direction;$/m);
    assert.match(source, /^group\.dir = direction;$/m);
    assert.equal(source.match(/@ts-expect-error/g)?.length, 3);
  });
}
