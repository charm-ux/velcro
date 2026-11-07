// Generates the default icon library's files (dist/assets/icons/<name>.svg, icons.json, LICENSE) from the pinned
// Bootstrap Icons 1.11.3 sprite in assets/bootstrap-icons. The source keeps one sprite instead of 2,050 files.
// Every input and output is checked: the sprite, LICENSE and icons.json must match their pinned SHA-256, and each
// generated icon must match the SHA-256 that SHA256SUMS records for the icon file in the upstream 1.11.3 release, so
// the output is byte-identical to the upstream files. Any mismatch, missing or extra icon fails the build and writes
// nothing.
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SPRITE_SHA256 = 'b000f622cba471181e4aa9b83e4ea38a069d0e0674cdc817148b21ef3dcd704b';
// The release's LICENSE, unmodified, and the generated icons.json index (see THIRD_PARTY_NOTICES.md).
export const LICENSE_SHA256 = '0fb3e11bd57e896c5a512afd64864d28a37de45d19835016c87ca1ad19ead969';
export const ICONS_JSON_SHA256 = '51f9cd91084b132871b7f10316644949e7a2c47bfab1cb1d1275bea890d3accf';
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const sha256 = data => createHash('sha256').update(data).digest('hex');

// Splits a symbol's minified content into its top-level elements.
function children(inner) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (const tag of inner.matchAll(/<(\/?)([a-zA-Z][\w:-]*)[^>]*?(\/?)>/g)) {
    const end = tag.index + tag[0].length;
    if (tag[1]) {
      if (--depth < 0) throw new Error('build-icons: unbalanced sprite symbol');
      if (depth === 0) out.push(inner.slice(start, end));
    } else if (tag[3]) {
      if (depth === 0) out.push(inner.slice(tag.index, end));
    } else if (depth++ === 0) start = tag.index;
  }
  if (depth !== 0 || out.join('') !== inner) throw new Error('build-icons: unexpected sprite symbol content');
  return out;
}

// Returns Map<name, svg text> in the layout of the upstream individual icon files.
export function iconsFromSprite(sprite, expectedSha = SPRITE_SHA256) {
  if (sha256(sprite) !== expectedSha) throw new Error('build-icons: sprite does not match its pinned SHA-256');
  const text = sprite.toString('utf8');
  const symbol = /<symbol class="bi bi-([^"]+)" viewBox="0 0 16 16" id="([^"]+)">([\s\S]*?)<\/symbol>/g;
  const icons = new Map();
  let m;
  let covered = 0;
  while ((m = symbol.exec(text))) {
    const [, name, id, inner] = m;
    if (name !== id || !NAME.test(name) || icons.has(name)) throw new Error('build-icons: unexpected sprite symbol name');
    const body = children(inner).map(child => `  ${child}`).join('\n');
    icons.set(name, `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-${name}" viewBox="0 0 16 16">\n${body}\n</svg>`);
    covered += m[0].length;
  }
  const wrapper = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"></svg>';
  if (covered + wrapper.length !== text.trimEnd().length) throw new Error('build-icons: sprite has content outside its symbols');
  return icons;
}

// Checks generated icons against SHA256SUMS lines (`<hex>  <name>.svg`): same names, same bytes.
export function verifyIcons(icons, sums) {
  const expected = new Map();
  for (const line of sums.split('\n').filter(Boolean)) {
    const m = /^([a-f0-9]{64}) {2}([a-z0-9-]+)\.svg$/.exec(line);
    if (!m || expected.has(m[2])) throw new Error('build-icons: malformed SHA256SUMS');
    expected.set(m[2], m[1]);
  }
  if (expected.size !== icons.size) throw new Error('build-icons: icon count does not match SHA256SUMS');
  for (const [name, svg] of icons) {
    if (expected.get(name) !== sha256(svg)) throw new Error(`build-icons: ${name}.svg does not match SHA256SUMS`);
  }
}

export function buildIcons({ source, target }) {
  const icons = iconsFromSprite(readFileSync(path.join(source, 'bootstrap-icons.svg')));
  verifyIcons(icons, readFileSync(path.join(source, 'SHA256SUMS'), 'utf8'));
  for (const [file, pinned] of [['icons.json', ICONS_JSON_SHA256], ['LICENSE', LICENSE_SHA256]]) {
    if (sha256(readFileSync(path.join(source, file))) !== pinned) throw new Error(`build-icons: ${file} does not match its pinned SHA-256`);
  }
  // Write into a sibling directory first, then swap, so a failure never leaves a partial icon set.
  const staging = `${target}.tmp`;
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });
  for (const [name, svg] of icons) writeFileSync(path.join(staging, `${name}.svg`), svg);
  for (const file of ['icons.json', 'LICENSE']) copyFileSync(path.join(source, file), path.join(staging, file));
  rmSync(target, { recursive: true, force: true });
  mkdirSync(path.dirname(target), { recursive: true });
  renameSync(staging, target);
  return icons.size;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pkg = fileURLToPath(new URL('..', import.meta.url));
  const count = buildIcons({ source: path.join(pkg, 'assets/bootstrap-icons'), target: path.join(pkg, 'dist/assets/icons') });
  console.log(`build-icons: ${count} icons generated and verified`);
}
