// dialog's manifest checks, run by tests/api/manifest.test.mjs against one fresh analysis of the sources.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export default function (test, { elements, pkgDir }) {
  test('sl-dialog lists Shoelace\'s API plus core\'s ready event; open, label and no-header reflect', () => {
    const dialog = elements.get('sl-dialog');
    assert.equal(dialog.superclass.name, 'CharmElement');
    assert.deepEqual(dialog.attributes.map(a => a.name).sort(), ['dir', 'label', 'lang', 'no-header', 'open']);
    assert.deepEqual((dialog.events ?? []).map(e => e.name).sort(),
      ['ready', 'sl-after-hide', 'sl-after-show', 'sl-hide', 'sl-initial-focus', 'sl-request-close', 'sl-show']);
    assert.equal(dialog.events.find(e => e.name === 'ready').inheritedFrom.package, '@charm-ux/core');
    assert.equal(dialog.events.find(e => e.name === 'sl-request-close').type.text, "{ source: 'close-button' | 'keyboard' | 'overlay' }");
    assert.deepEqual(dialog.slots.map(s => s.name).sort(), ['', 'footer', 'header-actions', 'label']);
    assert.deepEqual(dialog.cssParts.map(p => p.name).sort(),
      ['base', 'body', 'close-button', 'close-button__base', 'footer', 'header', 'header-actions', 'overlay', 'panel', 'title']);
    assert.deepEqual(dialog.cssProperties.map(p => p.name).sort(), ['--body-spacing', '--footer-spacing', '--header-spacing', '--width']);
    const reflected = dialog.members.filter(m => m.kind === 'field' && m.reflects).map(m => m.name).sort();
    assert.deepEqual(reflected, ['label', 'noHeader', 'open']);
    const modal = dialog.members.find(m => m.name === 'modal');
    assert.equal(modal.default, 'new Modal(this)');
    assert.match(modal.description, /activateExternal\(\)/);
    const methods = dialog.members.filter(m => m.kind === 'method' && (m.privacy ?? 'public') === 'public').map(m => m.name).sort();
    assert.deepEqual(methods, ['handleOpenChange', 'hide', 'show']);
  });

  test('the sl-dialog type test assigns a string-typed direction and pins the property and event types', () => {
    const source = readFileSync(path.join(pkgDir, 'type-tests/dialog.tsx'), 'utf8');
    assert.match(source, /declare const direction: string;/);
    assert.match(source, /^element\.dir = direction;$/m);
    assert.match(source, /onSlRequestClose:/);
    assert.equal(source.match(/@ts-expect-error/g)?.length, 4);
  });
}
