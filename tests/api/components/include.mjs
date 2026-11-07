// include's manifest checks, run by tests/api/manifest.test.mjs against one fresh analysis of the sources.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export default function (test, { manifest, elements, pkgDir }) {
  test('sl-include lists only Shoelace\'s API plus core\'s ready event, with no slot, part or custom property', () => {
    const include = elements.get('sl-include');
    assert.deepEqual(include.events.map(e => e.name).sort(), ['ready', 'sl-error', 'sl-load']);
    assert.equal(include.events.find(e => e.name === 'ready').inheritedFrom.package, '@charm-ux/core');
    assert.equal(include.events.find(e => e.name === 'sl-error').type.text, '{ status: number }');
    assert.deepEqual(include.attributes.map(a => a.name).sort(), ['allow-scripts', 'dir', 'lang', 'mode', 'src']);
    assert.deepEqual(include.slots ?? [], []);
    assert.deepEqual(include.cssParts ?? [], []);
    assert.deepEqual(include.cssProperties ?? [], []);
    // Nothing reflects (as in Shoelace), and dir and lang are declared as Shoelace's base element declares them.
    for (const member of include.members.filter(m => m.kind === 'field')) assert.notEqual(member.reflects, true, member.name);
    for (const name of ['dir', 'lang']) assert.equal(include.attributes.find(a => a.name === name).inheritedFrom, undefined, name);
    // The public methods are Shoelace's: handleSrcChange (public upstream, undescribed) and the private executeScript.
    assert.equal(include.members.find(m => m.name === 'handleSrcChange').privacy ?? 'public', 'public');
    assert.equal(include.members.find(m => m.name === 'executeScript').privacy, 'private');
  });

  test('the request helper module is exported and documented in the manifest as requestInclude', () => {
    const mod = manifest.modules.find(m => m.path === 'src/components/include/request.ts');
    assert.ok(mod, 'request module');
    assert.deepEqual(mod.exports.map(e => e.name), ['requestInclude']);
  });

  test('the sl-include type test covers dir, the React wrapper props and the request helper', () => {
    const source = readFileSync(path.join(pkgDir, 'type-tests/include.tsx'), 'utf8');
    assert.match(source, /^element\.dir = direction;$/m);
    for (const prop of ['src', 'mode', 'allowScripts', 'onSlLoad', 'onSlError']) assert.match(source, new RegExp(`\\b${prop}:`), prop);
    assert.match(source, /requestInclude\('\/fragment\.html', 'no-cors'\)/);
    assert.equal(source.match(/@ts-expect-error/g)?.length, 2);
  });
}
