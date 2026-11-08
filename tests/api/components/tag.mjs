// tag's manifest checks, run by tests/api/manifest.test.mjs against one fresh analysis of the sources.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export default function (test, { elements, pkgDir }) {
  test('sl-tag lists Shoelace\'s API plus core\'s ready event', () => {
    const tag = elements.get('sl-tag');
    assert.deepEqual(tag.attributes.map(a => a.name).sort(), ['dir', 'lang', 'pill', 'removable', 'size', 'variant']);
    assert.deepEqual((tag.events ?? []).map(e => e.name).sort(), ['ready', 'sl-remove']);
    assert.equal(tag.events.find(e => e.name === 'ready').inheritedFrom.package, '@charm-ux/core');
    assert.equal(tag.events.find(e => e.name === 'sl-remove').inheritedFrom, undefined);
    assert.deepEqual(tag.slots.map(s => s.name), ['']);
    assert.deepEqual(tag.cssParts.map(p => p.name), ['base', 'content', 'remove-button', 'remove-button__base']);
    assert.equal(tag.cssProperties, undefined);
    const reflected = tag.members.filter(m => m.kind === 'field' && m.reflects).map(m => m.name).sort();
    assert.deepEqual(reflected, ['pill', 'size', 'variant']);
    for (const name of ['dir', 'lang']) assert.equal(tag.members.find(m => m.name === name).reflects, undefined, `${name} does not reflect`);
  });

  test('the sl-tag type test assigns a string-typed direction and pins the six variants and three sizes', () => {
    const source = readFileSync(path.join(pkgDir, 'type-tests/tag.tsx'), 'utf8');
    assert.match(source, /declare const direction: string;/);
    assert.match(source, /^element\.dir = direction;$/m);
    assert.equal(source.match(/@ts-expect-error/g)?.length, 4);
  });
}
