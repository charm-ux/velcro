// radio-group's manifest checks, run by tests/api/manifest.test.mjs against one fresh analysis of the sources.
import assert from 'node:assert/strict';

export default function (test, { elements }) {
  test('sl-radio-group: autofocus is the platform property (core\'s reactive one is not used): no own member', () => {
    const group = elements.get('sl-radio-group');
    const member = group.members.find(m => m.name === 'autofocus');
    assert.ok(member?.inheritedFrom, 'autofocus is not redeclared by the radio group');
  });

  test('sl-radio-group: value reflects with an empty default, as in Shoelace', () => {
    const group = elements.get('sl-radio-group');
    const value = group.members.find(m => m.name === 'value');
    assert.equal(value.reflects, true);
    assert.equal(value.default, "''");
  });
}
