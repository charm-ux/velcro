// sl-menu's and sl-menu-item's manifest checks, run by tests/api/manifest.test.mjs against one fresh analysis of the sources.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export default function (test, { elements, pkgDir }) {
  test('sl-menu lists sl-select (with the menu item as detail) and core\'s ready event, one default slot, no parts and no attributes beyond dir and lang', () => {
    const menu = elements.get('sl-menu');
    assert.deepEqual((menu.events ?? []).map(e => e.name).sort(), ['ready', 'sl-select']);
    assert.equal(menu.events.find(e => e.name === 'sl-select').type.text, '{ item: SlMenuItem }');
    assert.equal(menu.events.find(e => e.name === 'ready').inheritedFrom.package, '@charm-ux/core');
    assert.deepEqual(menu.slots.map(s => s.name), ['']);
    assert.deepEqual(menu.cssParts ?? [], []);
    assert.deepEqual(menu.cssProperties ?? [], []);
    assert.deepEqual(menu.attributes.map(a => a.name).sort(), ['dir', 'lang']);
    for (const member of menu.members.filter(m => m.kind === 'field')) assert.notEqual(member.reflects, true, member.name);
  });

  test('sl-menu-item lists Shoelace\'s attributes (checked, loading and disabled reflect), slots, parts and --submenu-offset, and only core\'s ready event', () => {
    const item = elements.get('sl-menu-item');
    assert.deepEqual(item.attributes.map(a => a.name).sort(), ['checked', 'dir', 'disabled', 'lang', 'loading', 'type', 'value']);
    const reflects = item.members.filter(m => m.kind === 'field' && m.reflects).map(m => m.name).sort();
    assert.deepEqual(reflects, ['checked', 'disabled', 'loading']);
    assert.deepEqual(item.slots.map(s => s.name).sort(), ['', 'prefix', 'submenu', 'suffix']);
    assert.deepEqual(item.cssParts.map(p => p.name).sort(),
      ['base', 'checked-icon', 'label', 'prefix', 'spinner', 'spinner__base', 'submenu-icon', 'suffix']);
    assert.deepEqual(item.cssProperties.map(p => [p.name, p.default]), [['--submenu-offset', '-2px']]);
    assert.deepEqual((item.events ?? []).map(e => e.name), ['ready']);
    assert.equal(item.attributes.find(a => a.name === 'type').type.text, "'normal' | 'checkbox'");
  });

  test('the menu dir type test assigns a string-typed direction to both, as Shoelace declares dir: string', () => {
    const source = readFileSync(path.join(pkgDir, 'type-tests/menu-dir.tsx'), 'utf8');
    assert.match(source, /declare const direction: string;/);
    assert.match(source, /^menu\.dir = direction;$/m);
    assert.match(source, /^item\.dir = direction;$/m);
    assert.equal(source.match(/@ts-expect-error/g)?.length, 2);
  });
}
