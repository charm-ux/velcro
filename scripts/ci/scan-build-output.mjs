// Scans the build output that the CI build job shares with the browser shards as a workflow artifact, before the upload.
// In a public repository a signed-in user can download workflow artifacts, so every shared byte gets the same checks
// site preparation applies to the published site: the privacy content rules over every file, and the secret scan over a
// private mirror in which each .svg name gets a .txt suffix (Gitleaks' stock path allowlist skips *.svg, and a skipped
// path blocks). Bounded, non-following walk; only fixed status lines are printed, never a path, finding or value.
import { lstatSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readBounded } from '../site/tested.mjs';
import { privacyScan, secretScan } from '../site/prepare.mjs';

// Shared trees and the logical label prefix each gets in the scan (no "dist" segment: the label is not a source path).
export const SHARED = Object.freeze([['packages/velcro/dist', 'velcro'], ['packages/docs/dist', 'docs']]);
export const LIMITS = Object.freeze({ maxEntries: 12000, maxFileBytes: 4 * 1024 * 1024, maxTotalBytes: 96 * 1024 * 1024, maxDepth: 10 });

class ScanError extends Error {}
const fail = code => { throw new ScanError(code); };

export function collect(root) {
  const files = [];
  let entries = 0;
  let total = 0;
  const walk = (dir, rel, depth) => {
    if (depth > LIMITS.maxDepth) fail('too-deep');
    for (const name of readdirSync(dir).sort()) {
      if (++entries > LIMITS.maxEntries) fail('too-many-entries');
      const full = path.join(dir, name);
      const relPath = `${rel}/${name}`;
      const st = lstatSync(full);
      if (st.isDirectory()) { walk(full, relPath, depth + 1); continue; }
      if (!st.isFile()) fail('not-regular');
      const bytes = readBounded(full, LIMITS.maxFileBytes);
      total += bytes.length;
      if (total > LIMITS.maxTotalBytes) fail('too-large');
      files.push({ rel: relPath, bytes });
    }
  };
  for (const [tree, label] of SHARED) {
    const dir = path.join(root, tree);
    if (!lstatSync(dir).isDirectory()) fail('not-directory');
    walk(dir, label, 0);
  }
  if (!files.length) fail('empty');
  return files;
}

export async function scanBuildOutput(root, { privacy = privacyScan, secrets = secretScan } = {}) {
  const files = collect(root);
  await privacy(files, root);
  const mirror = mkdtempSync(path.join(root, '.airig/ci/build-scan-'));
  try {
    for (const f of files) {
      const target = path.join(mirror, f.rel.endsWith('.svg') ? `${f.rel}.txt` : f.rel);
      mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
      writeFileSync(target, f.bytes, { flag: 'wx', mode: 0o600 });
    }
    await secrets(mirror);
  } finally { rmSync(mirror, { recursive: true, force: true }); }
  return files.length;
}

if (import.meta.main) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  try {
    mkdirSync(path.join(root, '.airig/ci'), { recursive: true, mode: 0o700 });
    const n = await scanBuildOutput(root);
    process.stdout.write(`build output scan: passed (${n} files)\n`);
  } catch (e) {
    // Only a bounded code from these scripts is printed; anything else is reported generically.
    const code = e instanceof ScanError ? e.message : (typeof e?.code === 'string' && /^[a-z-]{1,40}$/.test(e.code) ? e.code : 'scan-failed');
    process.stdout.write(`build output scan: blocked (${code})\n`);
    process.exitCode = 1;
  }
}
