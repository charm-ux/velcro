// Scans the build output that the CI build job shares with the later jobs as a workflow artifact, and stages exactly the
// scanned bytes for the upload. In a public repository a signed-in user can download workflow artifacts, so every shared
// byte gets the same checks site preparation applies to the published site: the privacy content rules over every file, and
// the secret scan over a private mirror in which each .svg name gets a .txt suffix (Gitleaks' stock path allowlist skips
// *.svg, and a skipped path blocks).
//
// The live dist trees are read once. Those in-memory bytes must match the build stage's digest; they are what is scanned;
// the mirror must still hold exactly them after the secret scan; and the upload is a fresh private staging tree written
// from them and read back to the same bytes and digest. A change to the live trees during the scan therefore cannot reach
// the upload, and the later jobs check the same digest on what they download. Bounded, non-following walk; only fixed
// status lines are printed, never a path, finding or value.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { privacyScan, secretScan } from '../site/prepare.mjs';
import { BuildOutputError, SHARED, buildDigest, collect, headSha } from './build-output.mjs';

export { LIMITS, SHARED } from './build-output.mjs';
// The upload staging tree, and where each shared tree goes in it: the artifact root holds velcro/dist and docs/dist, and
// is downloaded into packages/.
export const STAGING = '.airig/ci/product-build';
export const STAGED = Object.freeze(SHARED.map(([tree, label]) => [tree.replace(/^packages\//, ''), label]));

const fail = code => { throw new BuildOutputError(code); };
const same = (a, b) => a.length === b.length && a.every((f, i) => f.rel === b[i].rel && f.bytes.equals(b[i].bytes));
const inTree = (f, trees) => {
  const [tree, label] = trees.find(([, l]) => f.rel.startsWith(`${l}/`));
  return path.join(tree, f.rel.slice(label.length + 1));
};

export async function scanBuildOutput(root, { expectDigest, sourceSha = headSha(root), privacy = privacyScan, secrets = secretScan } = {}) {
  if (!/^[0-9a-f]{64}$/.test(expectDigest ?? '')) fail('no-digest');
  const files = collect(root);
  if (buildDigest(files, sourceSha) !== expectDigest) fail('digest-mismatch');
  await privacy(files, root);
  const mirror = mkdtempSync(path.join(root, '.airig/ci/build-scan-'));
  const mirrored = files.map(f => ({ ...f, rel: f.rel.endsWith('.svg') ? `${f.rel}.txt` : f.rel }));
  try {
    for (const f of mirrored) {
      const target = path.join(mirror, f.rel);
      mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
      writeFileSync(target, f.bytes, { flag: 'wx', mode: 0o600 });
    }
    await secrets(mirror);
    // The secret scan saw exactly the scanned bytes: nothing in the mirror changed, appeared or went away.
    const after = collect(mirror, SHARED.map(([, label]) => [label, label])).sort((a, b) => (a.rel < b.rel ? -1 : 1));
    const expected = [...mirrored].sort((a, b) => (a.rel < b.rel ? -1 : 1));
    if (!same(after, expected)) fail('mirror-changed');
  } finally { rmSync(mirror, { recursive: true, force: true }); }

  // Stage the scanned bytes, read them back and check them once more against the digest.
  const staging = path.join(root, STAGING);
  try { mkdirSync(staging, { mode: 0o700 }); } catch { fail('staging-exists'); }
  for (const f of files) {
    const target = path.join(staging, inTree(f, STAGED));
    mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
    writeFileSync(target, f.bytes, { flag: 'wx', mode: 0o600 });
  }
  const staged = collect(staging, STAGED);
  if (!same(staged, files) || buildDigest(staged, sourceSha) !== expectDigest) fail('staging-changed');
  return files.length;
}

if (import.meta.main) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  try {
    const argv = process.argv.slice(2);
    if (argv.length !== 2 || argv[0] !== '--expect-digest') fail('usage');
    mkdirSync(path.join(root, '.airig/ci'), { recursive: true, mode: 0o700 });
    const n = await scanBuildOutput(root, { expectDigest: argv[1] });
    process.stdout.write(`build output scan: passed (${n} files staged for upload)\n`);
  } catch (e) {
    // Only a bounded code from these scripts is printed; anything else is reported generically.
    const code = e instanceof BuildOutputError ? e.message : (typeof e?.code === 'string' && /^[a-z-]{1,40}$/.test(e.code) ? e.code : 'scan-failed');
    process.stdout.write(`build output scan: blocked (${code})\n`);
    process.exitCode = 1;
  }
}
