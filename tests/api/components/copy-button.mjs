// copy-button's manifest checks, run by tests/api/manifest.test.mjs against one fresh analysis of the sources.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export default function (test, { elements, pkgDir }) {
  test('sl-copy-button lists Shoelace\'s API plus core\'s ready event', () => {
    const button = elements.get('sl-copy-button');
    assert.deepEqual(button.attributes.map(a => a.name).sort(), [
      'copy-label', 'dir', 'disabled', 'error-label', 'feedback-duration', 'from', 'hoist', 'lang', 'success-label', 'tooltip-placement', 'value',
    ]);
    assert.deepEqual((button.events ?? []).map(e => e.name).sort(), ['ready', 'sl-copy', 'sl-error']);
    assert.equal(button.events.find(e => e.name === 'ready').inheritedFrom.package, '@charm-ux/core');
    for (const name of ['sl-copy', 'sl-error']) assert.equal(button.events.find(e => e.name === name).inheritedFrom, undefined);
    // The sl-copy payload is typed, so the generated React callback keeps it (sl-error's detail is empty and stays untyped).
    assert.equal(button.events.find(e => e.name === 'sl-copy').type.text, '{ value: string }');
    assert.deepEqual(button.slots.map(s => s.name).sort(), ['copy-icon', 'error-icon', 'success-icon']);
    assert.deepEqual(button.cssParts.map(p => p.name).sort(), [
      'button', 'copy-icon', 'error-icon', 'success-icon', 'tooltip__base', 'tooltip__base__arrow', 'tooltip__base__popup', 'tooltip__body',
    ]);
    assert.deepEqual(button.cssProperties.map(p => p.name).sort(), ['--error-color', '--success-color']);
    const reflected = button.members.filter(m => m.kind === 'field' && m.reflects).map(m => m.name).sort();
    assert.deepEqual(reflected, ['disabled']);
    for (const name of ['dir', 'lang']) assert.equal(button.members.find(m => m.name === name).reflects, undefined, `${name} does not reflect`);
    const types = Object.fromEntries(button.attributes.map(a => [a.name, [a.type.text, a.default]]));
    assert.deepEqual(types['feedback-duration'], ['number', '1000']);
    assert.deepEqual(types['tooltip-placement'], ['\'top\' | \'right\' | \'bottom\' | \'left\'', '\'top\'']);
    assert.deepEqual(types.hoist, ['boolean', 'false']);
  });

  test('the sl-copy-button type test assigns a string-typed direction and pins the placements, the sl-copy detail type and the wrapper\'s event props', () => {
    const source = readFileSync(path.join(pkgDir, 'type-tests/copy-button.tsx'), 'utf8');
    assert.match(source, /declare const direction: string;/);
    assert.match(source, /^element\.dir = direction;$/m);
    assert.equal(source.match(/@ts-expect-error/g)?.length, 5);
    assert.match(source, /const copied: string = event\.detail\.value;/);
    assert.match(source, /@ts-expect-error the copied value is a string, not a number\n\s*const wrong: number = event\.detail\.value;/);
  });
}
