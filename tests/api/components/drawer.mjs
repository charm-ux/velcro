// drawer's manifest checks, run by tests/api/manifest.test.mjs against one fresh analysis of the sources.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export default function (test, { elements, pkgDir }) {
  test('sl-drawer lists Shoelace\'s API plus core\'s ready event; open, label, placement, contained and no-header reflect', () => {
    const drawer = elements.get('sl-drawer');
    assert.equal(drawer.superclass.name, 'CharmElement');
    assert.deepEqual(drawer.attributes.map(a => a.name).sort(), ['contained', 'dir', 'label', 'lang', 'no-header', 'open', 'placement']);
    assert.deepEqual((drawer.events ?? []).map(e => e.name).sort(),
      ['ready', 'sl-after-hide', 'sl-after-show', 'sl-hide', 'sl-initial-focus', 'sl-request-close', 'sl-show']);
    assert.equal(drawer.events.find(e => e.name === 'ready').inheritedFrom.package, '@charm-ux/core');
    assert.equal(drawer.events.find(e => e.name === 'sl-request-close').type.text, "{ source: 'close-button' | 'keyboard' | 'overlay' }");
    assert.deepEqual(drawer.slots.map(s => s.name).sort(), ['', 'footer', 'header-actions', 'label']);
    assert.deepEqual(drawer.cssParts.map(p => p.name).sort(),
      ['base', 'body', 'close-button', 'close-button__base', 'footer', 'header', 'header-actions', 'overlay', 'panel', 'title']);
    assert.deepEqual(drawer.cssProperties.map(p => p.name).sort(), ['--body-spacing', '--footer-spacing', '--header-spacing', '--size']);
    const reflected = drawer.members.filter(m => m.kind === 'field' && m.reflects).map(m => m.name).sort();
    assert.deepEqual(reflected, ['contained', 'label', 'noHeader', 'open', 'placement']);
    const placement = drawer.members.find(m => m.name === 'placement');
    assert.equal(placement.type.text, "'top' | 'end' | 'bottom' | 'start'");
    assert.equal(placement.default, "'end'");
    const modal = drawer.members.find(m => m.name === 'modal');
    assert.equal(modal.default, 'new Modal(this)');
    assert.match(modal.description, /activateExternal\(\)/);
    const methods = drawer.members.filter(m => m.kind === 'method' && (m.privacy ?? 'public') === 'public').map(m => m.name).sort();
    assert.deepEqual(methods, ['handleNoModalChange', 'handleOpenChange', 'hide', 'show']);
  });

  test('the sl-drawer type test assigns a string-typed direction and pins the property and event types', () => {
    const source = readFileSync(path.join(pkgDir, 'type-tests/drawer.tsx'), 'utf8');
    assert.match(source, /declare const direction: string;/);
    assert.match(source, /^element\.dir = direction;$/m);
    assert.match(source, /onSlRequestClose:/);
    assert.equal(source.match(/@ts-expect-error/g)?.length, 7);
  });
}
