// sl-range's manifest checks, run by tests/api/manifest.test.mjs against one fresh analysis of the sources.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export default function (test, { elements, pkgDir }) {
  test('sl-range lists Shoelace\'s attributes (only disabled and form reflected), its methods, its five events, two slots, seven parts and six custom properties', () => {
    const range = elements.get('sl-range');
    assert.deepEqual(range.attributes.map(a => a.name).sort(), ['dir', 'disabled', 'form', 'help-text', 'label', 'lang', 'max', 'min', 'name', 'step', 'title', 'tooltip', 'value']);
    const defaults = Object.fromEntries(range.attributes.map(a => [a.name, a.default]));
    assert.deepEqual(
      [defaults.name, defaults.value, defaults.label, defaults['help-text'], defaults.disabled, defaults.min, defaults.max, defaults.step, defaults.tooltip, defaults.form, defaults.title],
      ["''", '0', "''", "''", 'false', '0', '100', '1', "'top'", "''", "''"],
    );
    const reflected = range.members.filter(m => m.kind === 'field' && m.reflects).map(m => m.name).sort();
    assert.deepEqual(reflected, ['disabled', 'form']);
    assert.equal(range.attributes.find(a => a.name === 'tooltip').type.text, "'top' | 'bottom' | 'none'");
    const publicFields = range.members.filter(m => m.kind === 'field' && m.privacy === 'public' && !m.static).map(m => m.name).sort();
    assert.deepEqual(publicFields, ['defaultValue', 'dir', 'disabled', 'form', 'helpText', 'input', 'label', 'lang', 'max', 'min', 'name', 'output', 'step', 'title', 'tooltip', 'tooltipFormatter', 'validationMessage', 'validity', 'value']);
    assert.equal(range.members.find(m => m.name === 'tooltipFormatter').type.text, '(value: number) => string');
    const methods = range.members.filter(m => m.kind === 'method' && m.privacy === 'public' && !m.static).map(m => m.name).sort();
    assert.deepEqual(methods, ['blur', 'checkValidity', 'focus', 'getForm', 'handleDisabledChange', 'handleValueChange', 'reportValidity', 'setCustomValidity', 'stepDown', 'stepUp', 'syncRange']);
    assert.deepEqual((range.events ?? []).map(e => e.name).sort(), ['ready', 'sl-blur', 'sl-change', 'sl-focus', 'sl-input', 'sl-invalid']);
    assert.equal(range.events.find(e => e.name === 'ready').inheritedFrom.package, '@charm-ux/core');
    assert.deepEqual(range.slots.map(s => s.name).sort(), ['help-text', 'label']);
    assert.deepEqual(range.cssParts.map(p => p.name).sort(), ['base', 'form-control', 'form-control-help-text', 'form-control-input', 'form-control-label', 'input', 'tooltip']);
    assert.deepEqual(range.cssProperties.map(p => p.name).sort(), ['--thumb-size', '--tooltip-offset', '--track-active-offset', '--track-color-active', '--track-color-inactive', '--track-height']);
  });

  test('the range type test assigns a string-typed direction, as Shoelace declares dir: string', () => {
    const source = readFileSync(path.join(pkgDir, 'type-tests/range-dir.tsx'), 'utf8');
    assert.match(source, /declare const direction: string;/);
    assert.match(source, /^range\.dir = direction;$/m);
    assert.equal(source.match(/@ts-expect-error/g)?.length, 4);
  });
}
