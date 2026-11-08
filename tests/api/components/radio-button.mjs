// radio-button's manifest checks, run by tests/api/manifest.test.mjs against one fresh analysis of the sources.
import assert from 'node:assert/strict';

export default function (test, { elements }) {
  test('sl-radio-button: the internal checked property is not listed, as in Shoelace\'s manifest', () => {
    const button = elements.get('sl-radio-button');
    assert.equal(button.members.find(m => m.name === 'checked'), undefined);
    assert.deepEqual((button.attributes ?? []).filter(a => a.name === 'checked'), []);
  });
}
