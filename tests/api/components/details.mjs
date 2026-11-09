// details' manifest checks, run by tests/api/manifest.test.mjs against one fresh analysis of the sources.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export default function (test, { elements, pkgDir }) {
  test('sl-details lists Shoelace\'s API plus core\'s ready event; open and disabled reflect', () => {
    const details = elements.get('sl-details');
    assert.deepEqual(details.attributes.map(a => a.name).sort(), ['dir', 'disabled', 'lang', 'open', 'summary']);
    assert.deepEqual((details.events ?? []).map(e => e.name).sort(), ['ready', 'sl-after-hide', 'sl-after-show', 'sl-hide', 'sl-show']);
    assert.equal(details.events.find(e => e.name === 'ready').inheritedFrom.package, '@charm-ux/core');
    for (const name of ['sl-show', 'sl-after-show', 'sl-hide', 'sl-after-hide']) {
      assert.equal(details.events.find(e => e.name === name).inheritedFrom, undefined, name);
    }
    assert.deepEqual(details.slots.map(s => s.name).sort(), ['', 'collapse-icon', 'expand-icon', 'summary']);
    assert.deepEqual(details.cssParts.map(p => p.name).sort(), ['base', 'content', 'header', 'summary', 'summary-icon']);
    assert.equal(details.cssProperties, undefined);
    const reflected = details.members.filter(m => m.kind === 'field' && m.reflects).map(m => m.name).sort();
    assert.deepEqual(reflected, ['disabled', 'open']);
    for (const name of ['dir', 'lang', 'summary']) assert.equal(details.members.find(m => m.name === name).reflects, undefined, `${name} does not reflect`);
    const methods = details.members.filter(m => m.kind === 'method' && (m.privacy ?? 'public') === 'public').map(m => m.name).sort();
    assert.deepEqual(methods, ['handleOpenChange', 'hide', 'show']);
  });

  test('the sl-details type test assigns a string-typed direction and pins the boolean and string properties', () => {
    const source = readFileSync(path.join(pkgDir, 'type-tests/details.tsx'), 'utf8');
    assert.match(source, /declare const direction: string;/);
    assert.match(source, /^element\.dir = direction;$/m);
    assert.equal(source.match(/@ts-expect-error/g)?.length, 4);
  });
}
