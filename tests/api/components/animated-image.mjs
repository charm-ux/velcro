// sl-animated-image's manifest checks, run by tests/api/manifest.test.mjs against one fresh analysis of the sources.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export default function (test, { elements, pkgDir }) {
  test('sl-animated-image lists Shoelace\'s attributes (only play reflected), its public fields and watch handlers, sl-load and sl-error, two slots, the control-box part and two custom properties', () => {
    const image = elements.get('sl-animated-image');
    assert.deepEqual(image.attributes.map(a => a.name).sort(), ['alt', 'dir', 'lang', 'play', 'src']);
    const reflected = image.members.filter(m => m.kind === 'field' && m.reflects).map(m => m.name).sort();
    assert.deepEqual(reflected, ['play']);
    const types = Object.fromEntries(image.attributes.map(a => [a.name, a.type.text]));
    assert.deepEqual([types.src, types.alt, types.play], ['string', 'string', 'boolean']);
    // Shoelace gives none of them a default: they are undefined until set.
    assert.deepEqual(image.attributes.filter(a => a.default !== undefined).map(a => a.name), []);
    const fields = Object.fromEntries(image.members.filter(m => m.kind === 'field' && m.privacy === 'public').map(m => [m.name, m.type?.text]));
    assert.equal(fields.animatedImage, 'HTMLImageElement');
    assert.equal(fields.frozenFrame, 'string');
    assert.equal(fields.isLoaded, 'boolean');
    assert.equal(image.members.find(m => m.name === 'isLoaded').default, 'false');
    const methods = image.members.filter(m => m.kind === 'method' && m.privacy === 'public' && !m.static).map(m => m.name).sort();
    assert.deepEqual(methods, ['handlePlayChange', 'handleSrcChange']);
    assert.deepEqual((image.events ?? []).map(e => e.name).sort(), ['ready', 'sl-error', 'sl-load']);
    assert.equal(image.events.find(e => e.name === 'ready').inheritedFrom.package, '@charm-ux/core');
    assert.deepEqual(image.slots.map(s => s.name).sort(), ['pause-icon', 'play-icon']);
    assert.deepEqual(image.cssParts.map(p => p.name), ['control-box']);
    assert.deepEqual(image.cssProperties.map(p => p.name).sort(), ['--control-box-size', '--icon-size']);
  });

  test('the animated image type test assigns a string-typed direction, as Shoelace declares dir: string', () => {
    const source = readFileSync(path.join(pkgDir, 'type-tests/animated-image-dir.tsx'), 'utf8');
    assert.match(source, /declare const direction: string;/);
    assert.match(source, /^image\.dir = direction;$/m);
    assert.equal(source.match(/@ts-expect-error/g)?.length, 3);
  });
}
