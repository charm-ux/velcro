// switch's manifest checks, run by tests/api/manifest.test.mjs against one fresh analysis of the sources.
import assert from 'node:assert/strict';

export default function (test, { elements }) {
  test('sl-switch documents its core extensions truthfully: inert ones say so and no label slot is advertised', () => {
    const sw = elements.get('sl-switch');
    const member = name => sw.members.find(m => m.name === name);
    for (const name of ['invalid', 'labelPosition', 'autofocus']) {
      assert.match(member(name).description, /^Velcro extension \(core\), inert:/, name);
      assert.equal(member(name).inheritedFrom, undefined, `${name} is redeclared with the switch's own description`);
    }
    for (const name of ['readonly', 'label', 'hideLabel', 'errorMessage']) {
      assert.match(member(name).description, /^Velcro extension \(core\):/, name);
    }
    const text = JSON.stringify(sw);
    assert.doesNotMatch(text, /`label` slot/);
    assert.deepEqual(sw.slots.map(s => s.name).sort(), ['', 'help-text']);
    // dir and lang as Shoelace's base element declares them; core's computed dir is not inherited.
    for (const name of ['dir', 'lang']) {
      const attr = sw.attributes.find(a => a.name === name);
      assert.ok(attr, name);
      assert.equal(attr.inheritedFrom, undefined, name);
      assert.equal(member(name).reflects, undefined, `${name} does not reflect`);
    }
  });

  test('VelcroSwitch declares the inherited core events it never emits', async () => {
    const { droppedInheritedEvents } = await import('../../../packages/velcro/custom-elements-manifest.config.mjs');
    assert.deepEqual(droppedInheritedEvents.VelcroSwitch, ['change', 'input']);
  });
}
