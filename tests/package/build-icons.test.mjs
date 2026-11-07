// The default icon library's files are generated from one pinned sprite; these checks keep the generator exact.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildIcons, iconsFromSprite, verifyIcons } from '../../packages/velcro/scripts/build-icons.mjs';

const source = fileURLToPath(new URL('../../packages/velcro/assets/bootstrap-icons/', import.meta.url));
const sprite = readFileSync(path.join(source, 'bootstrap-icons.svg'));
const sums = readFileSync(path.join(source, 'SHA256SUMS'), 'utf8');
const sha256 = data => createHash('sha256').update(data).digest('hex');

function scratch(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'velcro-icons-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('the pinned sprite generates all 2,050 upstream icon files byte for byte, with icons.json and LICENSE', t => {
  const dir = scratch(t);
  const target = path.join(dir, 'icons');
  assert.equal(buildIcons({ source, target }), 2050);
  const files = readdirSync(target).sort();
  assert.equal(files.length, 2052);
  const lines = files.filter(f => f.endsWith('.svg')).map(f => `${sha256(readFileSync(path.join(target, f)))}  ${f}`);
  assert.deepEqual(lines, sums.trimEnd().split('\n').sort((a, b) => a.slice(66).localeCompare(b.slice(66))));
  assert.match(readFileSync(path.join(target, 'alarm.svg'), 'utf8'), /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="16" height="16" fill="currentColor" class="bi bi-alarm" viewBox="0 0 16 16">\n {2}<path [^\n]+\/>\n {2}<path [^\n]+\/>\n<\/svg>$/);
  assert.deepEqual(readFileSync(path.join(target, 'LICENSE')), readFileSync(path.join(source, 'LICENSE')));
  assert.deepEqual(readFileSync(path.join(target, 'icons.json')), readFileSync(path.join(source, 'icons.json')));
});

test('a sprite that differs by one byte from its pinned hash is rejected', () => {
  const tampered = Buffer.from(sprite);
  tampered[tampered.indexOf('M8.5')] = 0x4c; // 'M' -> 'L'
  assert.throws(() => iconsFromSprite(tampered), /pinned SHA-256/);
});

test('generated icons must match SHA256SUMS exactly: changed hash, missing, extra and malformed lines fail', () => {
  const icons = iconsFromSprite(sprite);
  const lines = sums.trimEnd().split('\n');
  const changed = lines.map(l => (l.endsWith('  alarm.svg') ? `${'0'.repeat(64)}  alarm.svg` : l));
  assert.throws(() => verifyIcons(icons, changed.join('\n')), /alarm\.svg does not match/);
  assert.throws(() => verifyIcons(icons, lines.slice(1).join('\n')), /count/);
  assert.throws(() => verifyIcons(icons, [...lines, `${'1'.repeat(64)}  extra.svg`].join('\n')), /count/);
  assert.throws(() => verifyIcons(icons, [...lines.slice(1), `${'1'.repeat(64)}  ../x.svg`].join('\n')), /malformed/);
  assert.throws(() => verifyIcons(icons, [...lines.slice(1), lines[1]].join('\n')), /malformed/);
  const renamed = new Map([...icons].map(([name, svg]) => [name === 'alarm' ? 'alarn' : name, svg]));
  assert.throws(() => verifyIcons(renamed, sums), /alarn\.svg does not match/);
});

test('content outside the symbols, malformed symbols and odd names are rejected even with a matching hash', () => {
  const wrap = body => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">${body}</svg>`);
  const ok = '<symbol class="bi bi-a" viewBox="0 0 16 16" id="a"><path d="M0 0"/></symbol>';
  const accept = data => iconsFromSprite(data, sha256(data));
  assert.equal(accept(wrap(ok)).get('a'), '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-a" viewBox="0 0 16 16">\n  <path d="M0 0"/>\n</svg>');
  assert.throws(() => accept(wrap(`${ok}<script>alert(1)</script>`)), /outside its symbols/);
  assert.throws(() => accept(wrap('<symbol class="bi bi-a" viewBox="0 0 16 16" id="a">text<path d="M0 0"/></symbol>')), /unexpected sprite symbol content/);
  assert.throws(() => accept(wrap('<symbol class="bi bi-a" viewBox="0 0 16 16" id="a"><g><path d="M0 0"/></symbol>')), /unexpected sprite symbol content/);
  assert.throws(() => accept(wrap('<symbol class="bi bi-a" viewBox="0 0 16 16" id="b"><path d="M0 0"/></symbol>')), /name/);
  assert.throws(() => accept(wrap('<symbol class="bi bi-A/b" viewBox="0 0 16 16" id="A/b"><path d="M0 0"/></symbol>')), /name/);
  assert.throws(() => accept(wrap(`${ok}${ok}`)), /name/);
});

test('a failed build leaves the previous output untouched', t => {
  const dir = scratch(t);
  const bad = path.join(dir, 'source');
  cpSync(source, bad, { recursive: true });
  writeFileSync(path.join(bad, 'SHA256SUMS'), sums.replace(/^[a-f0-9]{64}/, '0'.repeat(64)));
  const target = path.join(dir, 'icons');
  buildIcons({ source, target });
  writeFileSync(path.join(target, 'marker'), 'previous');
  assert.throws(() => buildIcons({ source: bad, target }), /does not match SHA256SUMS/);
  assert.equal(readFileSync(path.join(target, 'marker'), 'utf8'), 'previous');
  assert.equal(readdirSync(target).length, 2053);
});
