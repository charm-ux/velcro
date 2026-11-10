// sl-color-picker's manifest checks, run by tests/api/manifest.test.mjs against one fresh analysis of the sources.
import assert from 'node:assert/strict';

export default function (test, { elements }) {
  test('sl-color-picker lists Shoelace\'s attributes (inline, size, disabled, form and required reflected), methods, events, the label slot, parts and custom properties', () => {
    const picker = elements.get('sl-color-picker');
    assert.deepEqual(picker.attributes.map(a => a.name).sort(), ['dir', 'disabled', 'form', 'format', 'hoist', 'inline', 'label', 'lang',
      'name', 'no-format-toggle', 'opacity', 'required', 'size', 'swatches', 'uppercase', 'value']);
    const defaults = Object.fromEntries(picker.attributes.map(a => [a.name, a.default]));
    assert.deepEqual([defaults.value, defaults.format, defaults.size, defaults.swatches, defaults.inline, defaults.opacity],
      ["''", "'hex'", "'medium'", "''", 'false', 'false']);
    const reflected = picker.members.filter(m => m.kind === 'field' && m.reflects).map(m => m.name).sort();
    assert.deepEqual(reflected, ['disabled', 'form', 'inline', 'required', 'size']);
    assert.equal(picker.attributes.find(a => a.name === 'swatches').type.text, 'string | string[]');
    const methods = picker.members.filter(m => m.kind === 'method' && m.privacy === 'public' && !m.static).map(m => m.name).sort();
    assert.deepEqual(methods, ['blur', 'checkValidity', 'focus', 'getForm', 'getFormattedValue', 'handleFormatChange',
      'handleOpacityChange', 'handleValueChange', 'reportValidity', 'setCustomValidity']);
    assert.deepEqual((picker.events ?? []).map(e => e.name).sort(), ['ready', 'sl-blur', 'sl-change', 'sl-focus', 'sl-input', 'sl-invalid']);
    assert.equal(picker.events.find(e => e.name === 'ready').inheritedFrom.package, '@charm-ux/core');
    assert.deepEqual((picker.slots ?? []).map(s => s.name), ['label']);
    assert.equal(picker.cssParts.length, 26);
    assert.deepEqual(picker.cssProperties.map(p => p.name).sort(), ['--grid-handle-size', '--grid-height', '--grid-width',
      '--slider-handle-size', '--slider-height', '--swatch-size']);
  });
}
