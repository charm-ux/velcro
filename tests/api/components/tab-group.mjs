// tab-group's manifest checks, run by tests/api/manifest.test.mjs against one fresh analysis of the sources.
import assert from 'node:assert/strict';

export default function (test, { elements }) {
  test('sl-tab-group lists Shoelace\'s API plus core\'s ready event; nothing is reflected', () => {
    const group = elements.get('sl-tab-group');
    assert.deepEqual(group.attributes.map(a => a.name).sort(), ['activation', 'dir', 'fixed-scroll-controls', 'lang', 'no-scroll-controls', 'placement']);
    assert.deepEqual((group.events ?? []).map(e => e.name).sort(), ['ready', 'sl-tab-hide', 'sl-tab-show']);
    assert.equal(group.events.find(e => e.name === 'ready').inheritedFrom.package, '@charm-ux/core');
    assert.deepEqual(group.slots.map(s => s.name).sort(), ['', 'nav']);
    assert.deepEqual(group.cssParts.map(p => p.name).sort(), ['base', 'nav', 'tabs', 'active-tab-indicator', 'body', 'scroll-button', 'scroll-button--start', 'scroll-button--end', 'scroll-button__base'].sort());
    assert.deepEqual(group.cssProperties.map(p => p.name), ['--indicator-color', '--track-color', '--track-width']);
    assert.deepEqual(group.members.filter(m => m.kind === 'field' && m.reflects).map(m => m.name), []);
    const methods = group.members.filter(m => m.kind === 'method' && (m.privacy ?? 'public') === 'public').map(m => m.name).sort();
    assert.deepEqual(methods, ['show', 'syncIndicator', 'updateScrollControls']);
  });
}
