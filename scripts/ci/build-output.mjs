// The build output that the CI build job shares with every later job (browser shards, upstream conformance, evidence) as
// one workflow artifact: both dist trees, complete, plus the files the build derives outside them that the later checks
// read from the checkout (the custom elements manifest, the package root barrel and the two notice copies; scripts/sync.mjs,
// ignored by git). `buildDigest` binds that whole output (every file's logical path, size and SHA-256, so additions,
// removals and changes all count) to the source commit it was built from, which also binds the tracked inputs the checks
// read from the checkout (the specs, the examples, the component records). Bounded, non-following walk; errors are fixed
// codes only.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { readBounded } from '../site/tested.mjs';

// Shared trees and single files (relative to the repository root) and the logical label each gets (no "dist" segment: not
// a source path). A label is never inside another label, so a mirror or staging tree keeps every entry apart.
export const SHARED = Object.freeze([['packages/velcro/dist', 'velcro'], ['packages/docs/dist', 'docs'],
  ['packages/velcro/custom-elements.json', 'velcro-derived/custom-elements.json'],
  ['packages/velcro/src/index.ts', 'velcro-derived/src/index.ts'],
  ['packages/velcro/THIRD_PARTY_NOTICES.md', 'velcro-derived/THIRD_PARTY_NOTICES.md'],
  ['packages/docs/public/THIRD_PARTY_NOTICES.md', 'docs-derived/public/THIRD_PARTY_NOTICES.md']]);
export const LIMITS = Object.freeze({ maxEntries: 12000, maxFileBytes: 4 * 1024 * 1024, maxTotalBytes: 96 * 1024 * 1024, maxDepth: 10 });

export class BuildOutputError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
const fail = code => { throw new BuildOutputError(code); };

// Every regular file under the shared trees of `root` (and each shared single file), in a fixed order, with its bytes.
// `trees` maps a directory or file under `root` to its label; the staged upload uses the same labels under a different root.
export function collect(root, trees = SHARED) {
  const files = [];
  let entries = 0;
  let total = 0;
  const walk = (dir, rel, depth, tree) => {
    if (depth > LIMITS.maxDepth) fail('too-deep');
    for (const name of readdirSync(dir).sort()) {
      if (++entries > LIMITS.maxEntries) fail('too-many-entries');
      const full = path.join(dir, name);
      const relPath = `${rel}/${name}`;
      const st = lstatSync(full);
      if (st.isDirectory()) { walk(full, relPath, depth + 1, tree); continue; }
      if (!st.isFile()) fail('not-regular');
      const bytes = readBounded(full, LIMITS.maxFileBytes);
      total += bytes.length;
      if (total > LIMITS.maxTotalBytes) fail('too-large');
      files.push({ tree, rel: relPath, bytes });
    }
  };
  for (const [tree, label] of trees) {
    const dir = path.join(root, tree);
    let st;
    try { st = lstatSync(dir); } catch { fail('missing-tree'); }
    if (st.isFile()) {
      if (++entries > LIMITS.maxEntries) fail('too-many-entries');
      const bytes = readBounded(dir, LIMITS.maxFileBytes);
      total += bytes.length;
      if (total > LIMITS.maxTotalBytes) fail('too-large');
      files.push({ tree, rel: label, bytes });
      continue;
    }
    if (!st.isDirectory()) fail('not-regular');
    walk(dir, label, 0, tree);
  }
  if (!files.length) fail('empty');
  return files;
}

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function buildDigest(files, sourceSha) {
  if (!/^[0-9a-f]{40}$/.test(sourceSha ?? '')) fail('no-source');
  const inventory = files.map(f => [f.rel, f.bytes.length, sha256(f.bytes)]);
  return sha256(JSON.stringify({ schema: 1, source: sourceSha, files: inventory }));
}

export function headSha(root) {
  const r = spawnSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  const sha = r.status === 0 ? r.stdout.trim() : '';
  return /^[0-9a-f]{40}$/.test(sha) ? sha : '';
}
