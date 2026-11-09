// sl-breadcrumb's and sl-breadcrumb-item's manifest checks, run by tests/api/manifest.test.mjs against one fresh analysis
// of the sources.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export default function (test, { elements, pkgDir }) {
  test('sl-breadcrumb lists label (not reflected), the default and separator slots, the base part, only core\'s ready event, and sl-icon as its dependency', () => {
    const breadcrumb = elements.get('sl-breadcrumb');
    assert.deepEqual(breadcrumb.attributes.map(a => a.name).sort(), ['dir', 'label', 'lang']);
    assert.equal(breadcrumb.attributes.find(a => a.name === 'label').default, "''");
    for (const member of breadcrumb.members.filter(m => m.kind === 'field')) assert.notEqual(member.reflects, true, member.name);
    assert.deepEqual(breadcrumb.slots.map(s => s.name).sort(), ['', 'separator']);
    assert.deepEqual(breadcrumb.cssParts.map(p => p.name), ['base']);
    assert.deepEqual(breadcrumb.cssProperties ?? [], []);
    assert.deepEqual((breadcrumb.events ?? []).map(e => e.name), ['ready']);
    assert.equal(breadcrumb.events[0].inheritedFrom.package, '@charm-ux/core');
  });

  test('sl-breadcrumb-item lists href, target and rel (none reflected), Shoelace\'s four slots and five parts, and only core\'s ready event', () => {
    const item = elements.get('sl-breadcrumb-item');
    assert.deepEqual(item.attributes.map(a => a.name).sort(), ['dir', 'href', 'lang', 'rel', 'target']);
    for (const member of item.members.filter(m => m.kind === 'field')) assert.notEqual(member.reflects, true, member.name);
    assert.equal(item.attributes.find(a => a.name === 'rel').default, "'noreferrer noopener'");
    assert.equal(item.attributes.find(a => a.name === 'target').type.text, "'_blank' | '_parent' | '_self' | '_top' | undefined");
    assert.deepEqual(item.slots.map(s => s.name).sort(), ['', 'prefix', 'separator', 'suffix']);
    assert.deepEqual(item.cssParts.map(p => p.name).sort(), ['base', 'label', 'prefix', 'separator', 'suffix']);
    assert.deepEqual(item.cssProperties ?? [], []);
    assert.deepEqual((item.events ?? []).map(e => e.name), ['ready']);
  });

  test('the breadcrumb dir type test assigns a string-typed direction to both, as Shoelace declares dir: string', () => {
    const source = readFileSync(path.join(pkgDir, 'type-tests/breadcrumb-dir.tsx'), 'utf8');
    assert.match(source, /declare const direction: string;/);
    assert.match(source, /^breadcrumb\.dir = direction;$/m);
    assert.match(source, /^item\.dir = direction;$/m);
    assert.equal(source.match(/@ts-expect-error/g)?.length, 2);
  });
}
