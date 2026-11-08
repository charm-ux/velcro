// menu-label's manifest checks, run by tests/api/manifest.test.mjs against one fresh analysis of the sources.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export default function (test, { elements, pkgDir }) {
  test('sl-menu-label lists only Shoelace\'s API plus core\'s ready event, with one default slot and the base part', () => {
    const label = elements.get('sl-menu-label');
    assert.deepEqual((label.events ?? []).map(e => e.name), ['ready']);
    assert.equal(label.events[0].inheritedFrom.package, '@charm-ux/core');
    assert.deepEqual(label.slots.map(s => s.name), ['']);
    assert.deepEqual(label.cssParts.map(p => p.name), ['base']);
    assert.deepEqual(label.cssProperties ?? [], []);
    assert.deepEqual(label.attributes.map(a => a.name).sort(), ['dir', 'lang']);
    // Nothing reflects (as in Shoelace), and dir and lang are declared as Shoelace's base element declares them.
    for (const member of label.members.filter(m => m.kind === 'field')) assert.notEqual(member.reflects, true, member.name);
    for (const name of ['dir', 'lang']) assert.equal(label.attributes.find(a => a.name === name).inheritedFrom, undefined, name);
  });

  test('the sl-menu-label dir type test assigns a string-typed direction, as Shoelace declares dir: string', () => {
    const source = readFileSync(path.join(pkgDir, 'type-tests/menu-label-dir.tsx'), 'utf8');
    assert.match(source, /declare const direction: string;/);
    assert.match(source, /^element\.dir = direction;$/m);
    assert.equal(source.match(/@ts-expect-error/g)?.length, 1);
  });
}
