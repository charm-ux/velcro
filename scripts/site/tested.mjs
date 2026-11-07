// Evidence that the exact prefixed site output (every file, HTML included) and its closure record are the bytes the
// browser checks ran against. verify:product captures them before the checks, compares after, and only then writes the
// evidence; site preparation refuses to stage anything that does not match it. Private, bounded, codes-only errors.
import { createHash } from 'node:crypto';
import {
  closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, renameSync, rmSync, writeFileSync,
} from 'node:fs';
import path from 'node:path';

export const TESTED_EVIDENCE = '.airig/product/tested-prefixed.json';
export const TESTED_SITE_DIR = 'packages/docs/dist/static-prefixed';
export const TESTED_CLOSURE = 'packages/docs/dist/closure/client-closure-velcro.json';
export const TESTED_BASE = '/velcro';
// maxEntries covers the docs site's icon assets (about 2,050 SVG files) on top of the pages and bundles.
export const TESTED_LIMITS = Object.freeze({ maxEntries: 2600, maxFileBytes: 2 * 1024 * 1024, maxTotalBytes: 16 * 1024 * 1024, maxDepth: 8, maxEvidenceBytes: 2 * 1024 * 1024 });

export class TestedError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
const fail = code => { throw new TestedError(code); };
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function readBounded(full, max) {
  const fd = openSync(full, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const st = fstatSync(fd);
    if (!st.isFile()) fail('special-file');
    if (st.size > max) fail('file-too-large');
    const buf = Buffer.alloc(st.size);
    let n = 0;
    while (n < st.size) {
      const r = readSync(fd, buf, n, st.size - n, n);
      if (r === 0) fail('short-read');
      n += r;
    }
    return buf;
  } finally { closeSync(fd); }
}

/** Bounded non-following walk: [{rel, sha256, size}] sorted by path. Anything but regular files and directories fails. */
export function snapshotTree(dir) {
  const files = [];
  let entries = 0;
  let total = 0;
  const walk = (cur, rel, depth) => {
    if (depth > TESTED_LIMITS.maxDepth) fail('too-deep');
    for (const name of readdirSync(cur).sort()) {
      if (++entries > TESTED_LIMITS.maxEntries) fail('too-many-entries');
      const full = path.join(cur, name);
      const relPath = rel ? `${rel}/${name}` : name;
      const st = lstatSync(full);
      if (st.isDirectory()) { walk(full, relPath, depth + 1); continue; }
      if (!st.isFile()) fail('not-regular');
      const bytes = readBounded(full, TESTED_LIMITS.maxFileBytes);
      total += bytes.length;
      if (total > TESTED_LIMITS.maxTotalBytes) fail('too-large');
      files.push({ rel: relPath, sha256: sha256(bytes), size: bytes.length });
    }
  };
  const root = lstatSync(dir);
  if (!root.isDirectory()) fail('not-directory');
  walk(dir, '', 0);
  return files;
}

export function snapshotTested(root) {
  return {
    files: snapshotTree(path.join(root, TESTED_SITE_DIR)),
    closureSha256: sha256(readBounded(path.join(root, TESTED_CLOSURE), TESTED_LIMITS.maxFileBytes)),
  };
}

export function sameSnapshot(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function clearTestedEvidence(root) {
  rmSync(path.join(root, TESTED_EVIDENCE), { force: true });
}

export function writeTestedEvidence(root, snapshot, sourceSha) {
  const target = path.join(root, TESTED_EVIDENCE);
  mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  const evidence = { schema: 1, status: 'passed', sourceSha, base: TESTED_BASE, cleanSource: true, files: snapshot.files, closureSha256: snapshot.closureSha256 };
  const tmp = `${target}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(evidence)}\n`, { mode: 0o600 });
  renameSync(tmp, target);
  return evidence;
}

/** Parse and validate evidence; any malformed, failed or oversized file blocks. */
export function readTestedEvidence(evidencePath) {
  let evidence;
  try { evidence = JSON.parse(readBounded(evidencePath, TESTED_LIMITS.maxEvidenceBytes).toString('utf8')); } catch { return fail('tested-evidence-missing'); }
  const ok = evidence && evidence.schema === 1 && evidence.status === 'passed' && /^[0-9a-f]{40}$/.test(evidence.sourceSha ?? '')
    && evidence.base === TESTED_BASE && evidence.cleanSource === true && /^[0-9a-f]{64}$/.test(evidence.closureSha256 ?? '') && Array.isArray(evidence.files)
    && evidence.files.length > 0 && evidence.files.length <= TESTED_LIMITS.maxEntries
    && evidence.files.every(f => typeof f?.rel === 'string' && /^[0-9a-f]{64}$/.test(f.sha256) && Number.isInteger(f.size));
  if (!ok) fail('tested-evidence-invalid');
  return evidence;
}
