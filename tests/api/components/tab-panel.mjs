// tab-panel's manifest checks, run by tests/api/manifest.test.mjs against one fresh analysis of the sources.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export default function (test, { elements, pkgDir }) {
  test('sl-tab-panel lists only Shoelace\'s API plus core\'s ready event: core\'s tab events, custom properties and part are not advertised', () => {
    const panel = elements.get('sl-tab-panel');
    assert.deepEqual((panel.events ?? []).map(e => e.name), ['ready']);
    assert.equal(panel.events[0].inheritedFrom.package, '@charm-ux/core');
    assert.deepEqual(panel.slots.map(s => s.name), ['']);
    assert.deepEqual(panel.cssParts.map(p => p.name), ['base']);
    assert.deepEqual(panel.cssProperties.map(p => p.name), ['--padding']);
    assert.deepEqual(panel.attributes.map(a => a.name).sort(), ['active', 'dir', 'lang', 'name']);
    // core's internal visible and tab are not declared members; dir and lang are declared as Shoelace's base element does.
    const names = panel.members.map(m => m.name);
    assert.ok(!names.includes('visible') && !names.includes('tab'));
    for (const name of ['dir', 'lang']) {
      assert.equal(panel.attributes.find(a => a.name === name).inheritedFrom, undefined, name);
      assert.equal(panel.members.find(m => m.name === name).reflects, undefined, `${name} does not reflect`);
    }
  });

  test('the sl-tab-panel dir type test assigns a string-typed direction, as Shoelace declares dir: string', () => {
    const source = readFileSync(path.join(pkgDir, 'type-tests/tab-panel-dir.tsx'), 'utf8');
    assert.match(source, /declare const direction: string;/);
    assert.match(source, /^element\.dir = direction;$/m);
    assert.equal(source.match(/@ts-expect-error/g)?.length, 1);
  });

  test('VelcroTabPanel declares the inherited core events it never emits', async () => {
    const { droppedInheritedEvents } = await import('../../../packages/velcro/custom-elements-manifest.config.mjs');
    assert.deepEqual(droppedInheritedEvents.VelcroTabPanel, ['tab-show', 'tab-hide', 'tab-after-show', 'tab-after-hide']);
  });
}
