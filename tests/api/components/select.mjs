// select's manifest checks, run by tests/api/manifest.test.mjs against one fresh analysis of the sources.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export default function (test, { elements, pkgDir }) {
  test('sl-select lists Shoelace\'s API, the core extras and core\'s ready event', () => {
    const select = elements.get('sl-select');
    const events = (select.events ?? []).map(e => e.name).sort();
    assert.deepEqual(events, ['ready', 'sl-after-hide', 'sl-after-show', 'sl-blur', 'sl-change', 'sl-clear', 'sl-focus', 'sl-hide', 'sl-input', 'sl-invalid', 'sl-show']);
    assert.equal(select.events.find(e => e.name === 'ready').inheritedFrom.package, '@charm-ux/core');
    assert.deepEqual(select.slots.map(s => s.name).sort(), ['', 'clear-icon', 'expand-icon', 'help-text', 'label', 'prefix', 'suffix']);
    assert.deepEqual(select.cssParts.map(p => p.name).sort(), ['clear-button', 'combobox', 'display-input', 'expand-icon', 'form-control', 'form-control-help-text',
      'form-control-input', 'form-control-label', 'listbox', 'prefix', 'suffix', 'tag', 'tag__base', 'tag__content', 'tag__remove-button',
      'tag__remove-button__base', 'tags']);
    const value = select.attributes.find(a => a.name === 'value');
    assert.equal(value.fieldName, 'defaultValue');
    const valueMember = select.members.find(m => m.name === 'value');
    assert.equal(valueMember.type, undefined, 'value has no manifest type, as in Shoelace');
    assert.equal(select.members.find(m => m.name === 'size').type.text, "'small' | 'medium' | 'large'");
    const reflected = select.members.filter(m => m.kind === 'field' && m.reflects).map(m => m.name).sort();
    assert.deepEqual(reflected, ['autofocus', 'disabled', 'filled', 'form', 'hideLabel', 'invalid', 'labelPosition', 'multiple', 'open', 'pill', 'placement', 'readonly', 'required', 'size']);
    for (const name of ['dir', 'lang']) assert.equal(select.members.find(m => m.name === name).reflects, undefined, `${name} does not reflect`);
  });

  test('the sl-select type test assigns a string-typed direction and pins the value, size and placement types', () => {
    const source = readFileSync(path.join(pkgDir, 'type-tests/select.tsx'), 'utf8');
    assert.match(source, /declare const direction: string;/);
    assert.match(source, /^element\.dir = direction;$/m);
    assert.equal(source.match(/@ts-expect-error/g)?.length, 4);
  });
}
