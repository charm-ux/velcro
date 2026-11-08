// input's manifest checks, run by tests/api/manifest.test.mjs against one fresh analysis of the sources.
import assert from 'node:assert/strict';

export default function (test, { elements }) {
  test('sl-input documents its core extensions truthfully: inert ones say so, the core start/end slots and datalist are not advertised', () => {
    const input = elements.get('sl-input');
    const member = name => input.members.find(m => m.name === name);
    for (const name of ['invalid', 'labelPosition']) {
      assert.match(member(name).description, /^Velcro extension \(core\), inert:/, name);
      assert.equal(member(name).inheritedFrom, undefined, `${name} is redeclared with the input's own description`);
    }
    for (const name of ['hideLabel', 'errorMessage']) {
      assert.match(member(name).description, /^Velcro extension \(core\):/, name);
    }
    assert.deepEqual(input.slots.map(s => s.name).sort(),
      ['clear-icon', 'help-text', 'hide-password-icon', 'label', 'prefix', 'show-password-icon', 'suffix']);
    assert.deepEqual(input.cssParts.map(p => p.name).sort(), [
      'base', 'clear-button', 'form-control', 'form-control-help-text', 'form-control-input', 'form-control-label', 'input',
      'password-toggle-button', 'prefix', 'suffix',
    ]);
    // Shoelace's own types, which the core input declares differently (see core-typing.ts); autocorrect is pinned too.
    const type = name => member(name).type.text;
    assert.equal(type('min'), 'number | string');
    assert.equal(type('max'), 'number | string');
    assert.equal(type('step'), "number | 'any'");
    assert.equal(type('autocorrect'), "'off' | 'on'");
    // dir and lang as Shoelace's base element declares them; core's computed dir is not inherited.
    for (const name of ['dir', 'lang']) {
      const attr = input.attributes.find(a => a.name === name);
      assert.ok(attr, name);
      assert.equal(attr.inheritedFrom, undefined, name);
      assert.equal(member(name).reflects, undefined, `${name} does not reflect`);
    }
  });

  test('VelcroInput declares the inherited core events it never emits', async () => {
    const { droppedInheritedEvents } = await import('../../../packages/velcro/custom-elements-manifest.config.mjs');
    assert.deepEqual(droppedInheritedEvents.VelcroInput, ['change', 'input']);
  });
}
