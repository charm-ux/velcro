// Site-only preparation: stage a fresh private deploy directory from the built static site, add the runtime notices,
// scan the exact staged bytes and outbound names with the repository's trusted engines, and record hashes.
// Not a general archive/image scanner: only an explicit text-only allowlist can be staged. Nothing is uploaded here.
// Any failure removes the partial directory and exits non-zero; messages carry codes only (no paths or contents).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, renameSync, rmSync, writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICONS_JSON_SHA256, LICENSE_SHA256, SPRITE_SHA256 } from '../../packages/velcro/scripts/build-icons.mjs';
import { scanDir } from '../security/gitleaks.mjs';
import { loadPolicy, scanText } from '../security/privacy.mjs';
import { componentPages, readCatalog } from './catalog.mjs';
import { generateRuntimeNotices } from './notices.mjs';
import { TESTED_EVIDENCE, readTestedEvidence } from './tested.mjs';

export class PrepareError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
const fail = code => { throw new PrepareError(code); };

// Sized for the icon assets (about 2,050 Bootstrap Icons SVGs, icons.json, their LICENSE and the 1.1 MB sprite sheet)
// on top of the pages and bundles.
export const LIMITS = Object.freeze({ maxEntries: 2400, maxFiles: 2300, maxFileBytes: 2 * 1024 * 1024, maxTotalBytes: 16 * 1024 * 1024, maxDepth: 6 });
const FIXED_REQUIRED = Object.freeze(['index.html', '_litro/app.js', '_litro/velcro.js', '_litro/velcro.css', 'THIRD_PARTY_NOTICES.md']);
// The fixed files plus one page per catalog entry. An unreadable or malformed catalog blocks (fail closed).
export function requiredFiles(repoRoot) {
  let catalog;
  try { catalog = readCatalog(repoRoot); } catch { return fail('catalog-invalid'); }
  return Object.freeze([...FIXED_REQUIRED, ...componentPages(catalog)]);
}
const SOURCE_NOTICES = 'THIRD_PARTY_NOTICES.md';
const RUNTIME_NOTICES = 'THIRD_PARTY_RUNTIME_NOTICES.md';
const SEGMENT = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/;

// Allowed text kinds by exact location. Everything else is rejected, never skipped.
function allowedKind(rel) {
  if (rel === SOURCE_NOTICES) return 'text';
  if (/^(?:[A-Za-z0-9_-]+\/)*index\.html$/.test(rel) && !rel.startsWith('_litro/')) return 'text';
  if (/^_litro\/(?:assets\/)?[A-Za-z0-9_.-]+\.(?:js|css)$/.test(rel) && !rel.endsWith('.map')) return 'closure';
  // Icon assets: the package's Bootstrap Icons (one SVG per icon, icons.json, LICENSE) and the sprite sheet. Plain
  // UTF-8 text, privacy- and secret-scanned like every other staged file.
  if (/^assets\/icons\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\.svg|icons\.json|LICENSE)$/.test(rel)) return 'text';
  if (rel === 'assets/images/sprite.svg') return 'text';
  return null;
}

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

// Icon assets must be exactly the Bootstrap Icons 1.11.3 release's: each icon SVG matches the package's SHA256SUMS, and
// icons.json, LICENSE and the sprite sheet match the hashes the package build pins. Unknown names or changed bytes block.
const ICON_SUMS = 'packages/velcro/assets/bootstrap-icons/SHA256SUMS';
export function checkIconAssets(staged, repoRoot) {
  const assets = staged.filter(f => f.rel.startsWith('assets/'));
  if (!assets.length) return;
  const expected = new Map([['assets/icons/icons.json', ICONS_JSON_SHA256], ['assets/icons/LICENSE', LICENSE_SHA256], ['assets/images/sprite.svg', SPRITE_SHA256]]);
  try {
    for (const line of readBounded(path.join(repoRoot, ICON_SUMS), 1024 * 1024).toString('utf8').split('\n').filter(Boolean)) {
      const m = /^([a-f0-9]{64}) {2}([a-z0-9]+(?:-[a-z0-9]+)*\.svg)$/.exec(line);
      if (!m) fail('icon-sums-invalid');
      expected.set(`assets/icons/${m[2]}`, m[1]);
    }
  } catch (e) {
    if (e instanceof PrepareError) throw e;
    fail('icon-sums-invalid');
  }
  for (const f of assets) if (expected.get(f.rel) !== sha256(f.bytes)) fail('icon-asset-mismatch');
}

function readBounded(full, max) {
  // O_NOFOLLOW refuses a symlink swapped in after the walk; fstat proves a regular file of bounded size.
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

function decodeText(bytes) {
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return fail('not-utf8'); }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(text)) fail('control-characters');
  return text;
}

/** Bounded, non-following walk of the build output. Returns [{rel, bytes}] for the allowlisted files only. */
export function collectSource(dir, closure, required) {
  if (!Array.isArray(required) || required.length === 0) fail('required-missing');
  let st;
  try { st = lstatSync(dir); } catch { return fail('source-missing'); }
  if (st.isSymbolicLink() || !st.isDirectory()) fail('source-not-directory');
  const staged = [];
  const omitted = [];
  let entries = 0;
  let total = 0;
  const walk = (current, rel, depth) => {
    if (depth > LIMITS.maxDepth) fail('too-deep');
    for (const name of readdirSync(current).sort()) {
      if (++entries > LIMITS.maxEntries) fail('too-many-entries');
      if (!SEGMENT.test(name)) fail('unsafe-name');
      const relPath = rel ? `${rel}/${name}` : name;
      const full = path.join(current, name);
      const s = lstatSync(full);
      if (s.isSymbolicLink()) fail('symlink');
      if (s.isDirectory()) { walk(full, relPath, depth + 1); continue; }
      if (!s.isFile()) fail('special-file');
      if (/\.map$/i.test(name)) fail('source-map');
      // Explicit, named omissions: build metadata and the duplicate of the root notices file.
      if (relPath === 'nitro.json') { omitted.push(relPath); continue; }
      if (relPath === `_litro/${SOURCE_NOTICES}`) { omitted.push(relPath); continue; }
      const kind = allowedKind(relPath);
      if (!kind) fail('unexpected-file');
      const bytes = readBounded(full, LIMITS.maxFileBytes);
      total += bytes.length;
      if (total > LIMITS.maxTotalBytes) fail('too-large');
      if (staged.length >= LIMITS.maxFiles) fail('too-many-files');
      const text = decodeText(bytes);
      if (/sourceMappingURL/.test(text)) fail('source-map-reference');
      staged.push({ rel: relPath, bytes, kind });
    }
  };
  walk(dir, '', 0);
  // The omitted duplicate may only be dropped when it really is a duplicate.
  if (omitted.includes(`_litro/${SOURCE_NOTICES}`)) {
    const root = staged.find(f => f.rel === SOURCE_NOTICES);
    const dup = readBounded(path.join(dir, '_litro', SOURCE_NOTICES), LIMITS.maxFileBytes);
    if (!root || !root.bytes.equals(dup)) fail('notice-duplicate-differs');
  }
  for (const req of required) if (!staged.some(f => f.rel === req)) fail('required-missing');
  // Every shipped bundle file must be exactly what the recorded closure describes, and nothing may be missing.
  const recorded = new Map((closure?.files ?? []).map(f => [`_litro/${f.file}`, f.sha256]));
  const bundle = staged.filter(f => f.kind === 'closure');
  for (const f of bundle) if (recorded.get(f.rel) !== sha256(f.bytes)) fail('closure-mismatch');
  for (const rel of recorded.keys()) if (!bundle.some(f => f.rel === rel)) fail('closure-file-missing');
  return { staged, omitted };
}

export function notFoundPage(base) {
  const home = `${base}/`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Page not found</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
<h1>Page not found</h1>
<p><a href="${home}">Back to the Velcro documentation</a></p>
</body>
</html>
`;
}

export function aggregateHash(files) {
  const lines = [...files].sort((a, b) => (a.rel < b.rel ? -1 : 1)).map(f => `${f.rel}\0${f.sha256}\0${f.size}\n`).join('');
  return sha256(Buffer.from(lines));
}

function treeFiles(dir) {
  const out = [];
  const walk = (cur, rel) => {
    for (const name of readdirSync(cur).sort()) {
      const full = path.join(cur, name);
      const relPath = rel ? `${rel}/${name}` : name;
      const s = lstatSync(full);
      if (s.isDirectory()) walk(full, relPath);
      else if (s.isFile()) { const b = readBounded(full, LIMITS.maxFileBytes); out.push({ rel: relPath, sha256: sha256(b), size: b.length }); }
      else fail('special-file');
    }
  };
  walk(dir, '');
  // Directory by directory is not full-path order when one name is a prefix of another ('button' and 'button-group': the
  // '/' after the first sorts after the '-' of the second), and callers compare this list with one sorted by full path.
  return out.sort((a, b) => (a.rel < b.rel ? -1 : 1));
}

/** Privacy rules over exact staged bytes and outbound names; logical labels, zero exclusions. */
export async function privacyScan(files, repoRoot, scan = scanText) {
  const policy = await loadPolicy(repoRoot);
  let findings = 0;
  for (const f of files) {
    const label = `site/${f.rel}`;
    let result;
    try { result = scan(f.text ?? decodeText(f.bytes), label, { policy }); } catch { return fail('privacy-scan-incomplete'); }
    findings += result.length;
  }
  if (findings > 0) fail('privacy-findings');
  return files.length;
}

export async function secretScan(dir, { scanner = scanDir } = {}) {
  let result;
  try { result = await scanner({ target: dir }); } catch { return fail('secret-scan-unavailable'); }
  if (!result || !Array.isArray(result.findings) || typeof result.version !== 'string' || result.excluded !== 0) fail('secret-scan-incomplete');
  if (result.findings.length > 0) fail('secret-findings');
  return result;
}

function git(root, ...args) {
  const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

/**
 * Prepare `<runDir>` (must not exist). On success it contains `site/` (the upload candidate) and `manifest.json`.
 * Returns the manifest. Any failure removes everything created and throws PrepareError/NoticeError.
 */
export async function prepareSite({ repoRoot, sourceDir, closurePath, runDir, base, expectSha, testedEvidencePath, requireClean = true, scanners = {} }) {
  if (!/^\/[A-Za-z0-9][A-Za-z0-9._~-]*(?:\/[A-Za-z0-9][A-Za-z0-9._~-]*)*$/.test(base ?? '')) fail('base-invalid');
  const sha = git(repoRoot, 'rev-parse', 'HEAD');
  if (!sha || !/^[0-9a-f]{40}$/.test(sha)) fail('source-sha-unknown');
  if (expectSha !== undefined && expectSha !== sha) fail('source-sha-mismatch');
  const dirty = git(repoRoot, 'status', '--porcelain', '--untracked-files=no');
  if (requireClean && (dirty === null || dirty !== '')) fail('source-tree-dirty');
  // Evidence that the browser checks passed on exact bytes; read before anything is staged. Missing, failed, stale or
  // malformed evidence blocks. Same source SHA is not treated as same generated bytes.
  if (typeof testedEvidencePath !== 'string') fail('tested-evidence-missing');
  const evidence = readTestedEvidence(testedEvidencePath);
  if (evidence.sourceSha !== sha) fail('tested-evidence-stale');
  if (evidence.base !== base) fail('tested-evidence-base');
  const partial = `${runDir}.partial`;
  try { lstatSync(runDir); fail('run-dir-exists'); } catch (e) { if (e instanceof PrepareError) throw e; }
  rmSync(partial, { recursive: true, force: true });
  mkdirSync(partial, { recursive: true, mode: 0o700 });
  try {
    // The closure is read once, bounded; that exact buffer is parsed and hashed, and re-compared after the scans.
    let closureBytes;
    let closure;
    try {
      closureBytes = readBounded(closurePath, 4 * 1024 * 1024);
      closure = JSON.parse(closureBytes.toString('utf8'));
    } catch (e) {
      if (e instanceof PrepareError) throw e;
      fail('closure-unreadable');
    }
    const closureSha = sha256(closureBytes);
    if (closureSha !== evidence.closureSha256) fail('tested-bytes-mismatch');
    const { staged, omitted } = collectSource(sourceDir, closure, requiredFiles(repoRoot));
    // Every byte about to be staged must be what the browser checks ran against, and nothing else may be present.
    const testedBy = new Map(evidence.files.map(f => [f.rel, f.sha256]));
    for (const f of staged) if (testedBy.get(f.rel) !== sha256(f.bytes)) fail('tested-bytes-mismatch');
    const accounted = new Set([...staged.map(f => f.rel), ...omitted]);
    if (accounted.size !== testedBy.size || [...testedBy.keys()].some(rel => !accounted.has(rel))) fail('tested-bytes-mismatch');
    const notices = generateRuntimeNotices(closure, { repoRoot, readLicense: scanners.readLicense });
    // Every mention of the decorate helper API in the shipped JavaScript must belong to a recorded, attributed copy or a reviewed
    // non-copy use. An extra or differently shaped copy blocks.
    const mentions = staged.filter(f => f.kind === 'closure' && f.rel.endsWith('.js'))
      .reduce((n, f) => n + (f.bytes.toString('utf8').split('Reflect.decorate').length - 1), 0);
    if (mentions !== notices.decorateMentions) fail('unattributed-compiler-helper');
    const generated = [
      { rel: '404.html', bytes: Buffer.from(notFoundPage(base)), kind: 'text' },
      { rel: RUNTIME_NOTICES, bytes: Buffer.from(notices.text), kind: 'text' },
      { rel: '.nojekyll', bytes: Buffer.alloc(0), kind: 'marker' },
    ];
    for (const g of generated) if (staged.some(f => f.rel === g.rel)) fail('generated-name-collision');
    const all = [...staged, ...generated];
    if (generated.find(g => g.rel === '.nojekyll').bytes.length !== 0) fail('marker-not-empty');
    const site = path.join(partial, 'site');
    for (const f of all) {
      const target = path.join(site, f.rel);
      mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
      writeFileSync(target, f.bytes, { flag: 'wx', mode: 0o600 });
    }
    await privacyScan(all.map(f => ({ rel: f.rel, bytes: f.bytes, text: f.kind === 'marker' ? '' : undefined })), repoRoot, scanners.privacy);
    // Gitleaks' stock path allowlist skips *.svg, and any skipped path blocks (excluded must be 0). So the secret scan
    // runs over a private mirror of exactly the staged bytes in which each .svg name gets a .txt suffix: every staged
    // byte is inspected, nothing is allowlisted. The mirror must be unchanged afterwards, like the site itself.
    const scanName = rel => (rel.endsWith('.svg') ? `${rel}.txt` : rel);
    const mirror = path.join(partial, 'secret-scan');
    for (const f of all) {
      const target = path.join(mirror, scanName(f.rel));
      mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
      writeFileSync(target, f.bytes, { flag: 'wx', mode: 0o600 });
    }
    const secrets = await secretScan(mirror, { scanner: scanners.secrets });
    const mirrored = all.map(f => ({ rel: scanName(f.rel), sha256: sha256(f.bytes), size: f.bytes.length })).sort((a, b) => (a.rel < b.rel ? -1 : 1));
    if (JSON.stringify(treeFiles(mirror)) !== JSON.stringify(mirrored)) fail('staged-bytes-changed');
    rmSync(mirror, { recursive: true, force: true });
    // After the scans, so that a planted secret in an icon is still reported as one.
    checkIconAssets(staged, repoRoot);
    // The closure that was evaluated must still be the closure on disk.
    let closureAfter;
    try { closureAfter = readBounded(closurePath, 4 * 1024 * 1024); } catch { fail('closure-changed'); }
    if (!closureAfter.equals(closureBytes)) fail('closure-changed');
    // The scanned bytes must still be the staged bytes.
    const after = treeFiles(site);
    const expected = all.map(f => ({ rel: f.rel, sha256: sha256(f.bytes), size: f.bytes.length })).sort((a, b) => (a.rel < b.rel ? -1 : 1));
    if (JSON.stringify(after) !== JSON.stringify(expected)) fail('staged-bytes-changed');
    const manifest = {
      schema: 1,
      status: 'passed',
      sourceSha: sha,
      base,
      files: after,
      aggregateSha256: aggregateHash(after),
      closureSha256: closureSha,
      testedEvidence: true,
      omitted,
      runtimePackages: notices.packages,
      checks: { privacyFiles: all.length, secretEngine: secrets.version, secretFindings: 0, secretExcluded: 0 },
    };
    writeFileSync(path.join(partial, 'manifest.json'), `${JSON.stringify(manifest, null, 1)}\n`, { mode: 0o600 });
    renameSync(partial, runDir);
    return manifest;
  } catch (error) {
    rmSync(partial, { recursive: true, force: true });
    throw error;
  }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i];
    if (!['--base', '--source', '--closure', '--out', '--expect-sha', '--tested'].includes(k) || argv[i + 1] === undefined) fail('usage');
    out[k.slice(2)] = argv[i + 1];
  }
  return out;
}

async function main(argv) {
  const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
  const args = parseArgs(argv);
  let runDir = args.out ? path.resolve(repoRoot, args.out) : null;
  if (!runDir) {
    const parent = path.join(repoRoot, '.airig/site');
    mkdirSync(parent, { recursive: true, mode: 0o700 });
    let n = 1;
    const name = () => path.join(parent, String(n).padStart(3, '0'));
    for (;;) { try { lstatSync(name()); n += 1; } catch { break; } }
    runDir = name();
  }
  const rel = path.relative(path.join(repoRoot, '.airig'), runDir);
  if (rel.startsWith('..') || path.isAbsolute(rel)) fail('out-not-private');
  mkdirSync(path.dirname(runDir), { recursive: true, mode: 0o700 });
  const base = args.base ?? '/velcro';
  const manifest = await prepareSite({
    repoRoot,
    sourceDir: path.resolve(repoRoot, args.source ?? 'packages/docs/dist/static-prefixed'),
    closurePath: path.resolve(repoRoot, args.closure ?? `packages/docs/dist/closure/client-closure${base.replaceAll('/', '-')}.json`),
    runDir,
    base,
    expectSha: args['expect-sha'],
    testedEvidencePath: path.resolve(repoRoot, args.tested ?? TESTED_EVIDENCE),
  });
  process.stdout.write(`site-prepare: passed ${manifest.files.length} files, aggregate ${manifest.aggregateSha256}, source ${manifest.sourceSha}\n`);
  process.stdout.write(`site-prepare: output ${path.relative(repoRoot, runDir).split(path.sep).join('/')}/site\n`);
}

if (import.meta.main) {
  main(process.argv.slice(2)).catch(error => {
    process.stderr.write(`site-prepare: blocked (${error?.code ?? 'internal-failure'})\n`);
    process.exitCode = 1;
  });
}
