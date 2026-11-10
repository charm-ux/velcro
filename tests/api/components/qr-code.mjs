// sl-qr-code's manifest checks, run by tests/api/manifest.test.mjs against one fresh analysis of the sources.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export default function (test, { elements, pkgDir }) {
  test('sl-qr-code lists Shoelace\'s attributes (none reflected) with their types and defaults, the canvas field, generate(), no events but core\'s ready, and the base part', () => {
    const code = elements.get('sl-qr-code');
    assert.deepEqual(code.attributes.map(a => a.name).sort(), ['background', 'dir', 'error-correction', 'fill', 'label', 'lang', 'radius', 'size', 'value']);
    assert.deepEqual(code.members.filter(m => m.kind === 'field' && m.reflects).map(m => m.name), []);
    const attrs = Object.fromEntries(code.attributes.map(a => [a.name, [a.type?.text, a.default, a.fieldName]]));
    assert.deepEqual(attrs.value, ['string', "''", 'value']);
    assert.deepEqual(attrs.label, ['string', "''", 'label']);
    assert.deepEqual(attrs.size, ['number', '128', 'size']);
    assert.deepEqual(attrs.fill, ['string', "'black'", 'fill']);
    assert.deepEqual(attrs.background, ['string', "'white'", 'background']);
    assert.deepEqual(attrs.radius, ['number', '0', 'radius']);
    assert.deepEqual(attrs['error-correction'], ["'L' | 'M' | 'Q' | 'H'", "'H'", 'errorCorrection']);
    const canvas = code.members.find(m => m.name === 'canvas');
    assert.deepEqual([canvas.kind, canvas.privacy ?? 'public', canvas.type?.text], ['field', 'public', 'HTMLElement']);
    const methods = code.members.filter(m => m.kind === 'method' && (m.privacy ?? 'public') === 'public' && !m.static).map(m => m.name).sort();
    assert.deepEqual(methods, ['generate']);
    assert.deepEqual((code.events ?? []).map(e => e.name), ['ready']);
    assert.equal(code.events[0].inheritedFrom.package, '@charm-ux/core');
    assert.deepEqual(code.slots ?? [], []);
    assert.deepEqual(code.cssParts.map(p => p.name), ['base']);
    assert.deepEqual(code.cssProperties ?? [], []);
  });

  test('the QR code type test assigns a string-typed direction, as Shoelace declares dir: string', () => {
    const source = readFileSync(path.join(pkgDir, 'type-tests/qr-code-dir.tsx'), 'utf8');
    assert.match(source, /declare const direction: string;/);
    assert.match(source, /^code\.dir = direction;$/m);
    assert.equal(source.match(/@ts-expect-error/g)?.length, 4);
  });
}
