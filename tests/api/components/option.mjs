// option's manifest checks, run by tests/api/manifest.test.mjs against one fresh analysis of the sources.
import assert from 'node:assert/strict';

export default function (test, { elements }) {
  test('sl-option lists Shoelace\'s API plus core\'s ready event', () => {
    const option = elements.get('sl-option');
    assert.deepEqual(option.attributes.map(a => a.name).sort(), ['dir', 'disabled', 'lang', 'value']);
    assert.deepEqual((option.events ?? []).map(e => e.name), ['ready']);
    assert.deepEqual(option.slots.map(s => s.name).sort(), ['', 'prefix', 'suffix']);
    assert.deepEqual(option.cssParts.map(p => p.name).sort(), ['base', 'checked-icon', 'label', 'prefix', 'suffix']);
    const reflected = option.members.filter(m => m.kind === 'field' && m.reflects).map(m => m.name).sort();
    assert.deepEqual(reflected, ['disabled', 'value']);
  });
}
