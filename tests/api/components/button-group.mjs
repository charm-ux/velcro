// button-group's manifest checks, run by tests/api/manifest.test.mjs against one fresh analysis of the sources.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

export default function (test, { elements, pkgDir }) {
  test('sl-button-group declares the four core extras itself, as Velcro extensions: vertical and split say they are inert', () => {
    const group = elements.get('sl-button-group');
    assert.deepEqual(group.attributes.map(a => a.name).sort(), ['dir', 'label', 'lang', 'select', 'split', 'toolbar', 'vertical']);
    for (const name of ['vertical', 'split', 'select', 'toolbar']) {
      const attribute = group.attributes.find(a => a.name === name);
      const member = group.members.find(m => m.name === name);
      assert.equal(attribute.inheritedFrom, undefined, `${name} is declared by the group, not inherited from core's description`);
      assert.equal(member.inheritedFrom, undefined, name);
      assert.equal(member.reflects, true, `${name} still reflects`);
      assert.match(member.description, /^Velcro extension \(core\)/, name);
      assert.match(attribute.description, /^Velcro extension \(core\)/, name);
    }
    for (const name of ['vertical', 'split']) {
      const { description } = group.members.find(m => m.name === name);
      assert.match(description, /inert/, name);
      assert.match(description, /without\s+effect/, name);
      // Core's wording promises an effect the group does not have.
      assert.doesNotMatch(description, /Vertically stacks|removing gap and border radius/, name);
    }
    for (const name of ['select', 'toolbar']) assert.doesNotMatch(group.members.find(m => m.name === name).description, /inert/, name);
  });

  test('the button-group notice fragment names every ported example file, the React snippets included', () => {
    const root = path.join(pkgDir, '../..');
    const notice = readFileSync(path.join(pkgDir, 'src/components/button-group/NOTICE.md'), 'utf8');
    const globs = [...notice.matchAll(/`([^`]*packages\/docs\/examples\/button-group\/[^`]*)`/g)].map(m => new RegExp(`^${m[1].replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`));
    const examples = dir => readdirSync(path.join(root, dir), { withFileTypes: true })
      .flatMap(e => (e.isDirectory() ? examples(`${dir}/${e.name}`) : [`${dir}/${e.name}`]));
    const files = examples('packages/docs/examples/button-group');
    assert.ok(files.some(f => f.endsWith('.jsx')) && files.some(f => f.endsWith('.html')));
    for (const file of files) assert.ok(globs.some(g => g.test(file)), `${file} is not covered by the notice fragment`);
  });
}
