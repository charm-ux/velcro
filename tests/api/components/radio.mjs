// radio's manifest checks, run by tests/api/manifest.test.mjs against one fresh analysis of the sources.
import assert from 'node:assert/strict';
import { apiModel } from '../../../scripts/api/model.mjs';

export default function (test, { elements }) {
  test('sl-radio: checked is a property only, as at runtime; the manifest and API table list no checked attribute', () => {
    const radio = elements.get('sl-radio');
    assert.equal(radio.members.find(m => m.name === 'checked').attribute, undefined);
    assert.deepEqual(radio.attributes.filter(a => a.name === 'checked' || a.fieldName === 'checked'), []);
    const row = apiModel(radio).properties.find(p => p.name === 'checked');
    assert.equal(row.attribute, '');
    assert.match(row.description, /property only/);
  });

  test('sl-radio: autofocus is the platform property (core\'s reactive one is not used): no own member, no reflection claim of its own', () => {
    const radio = elements.get('sl-radio');
    const member = radio.members.find(m => m.name === 'autofocus');
    assert.ok(member?.inheritedFrom, 'autofocus is not redeclared by the radio');
  });
}
