// Provenance check for the vendored copy of @shoelace-style/animations
// (packages/velcro/src/components/animation/presets/presets.ts), against the record in SOURCE.json beside it.
//
//   node scripts/vendor/shoelace-animations.mjs check            vendored data == the record's data digest (no network)
//   node scripts/vendor/shoelace-animations.mjs verify <tarball> the npm tarball's sha512 == the record's integrity,
//                                                              its files == the record's per-file sha256, and its data
//                                                              digest == the record's and the vendored copy's
//
// Acquire the tarball the way the project's installs do (the configured registry or the local offline store), into
// ignored scratch; never commit it or where it came from. The data digest is the sha256 of a canonical JSON form of
// every exported animation and the easings table: object keys sorted recursively, array order kept. It covers names
// and values, not formatting, comments or the type annotations the vendored copy adds.
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const presetsDir = path.join(repoRoot, 'packages/velcro/src/components/animation/presets');
export const RECORD_PATH = path.join(presetsDir, 'SOURCE.json');
export const VENDORED_PATH = path.join(presetsDir, 'presets.ts');

const sha256 = data => createHash('sha256').update(data).digest('hex');

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`non-finite number ${value}`);
  return JSON.stringify(value);
}

/** The canonical digest of a module namespace shaped like @shoelace-style/animations. */
export function presetsDigest(namespace) {
  const { easings, ...animations } = namespace;
  if (!easings || typeof easings !== 'object') throw new Error('no easings table');
  for (const [name, frames] of Object.entries(animations)) {
    if (!Array.isArray(frames)) throw new Error(`${name} is not a keyframe list`);
  }
  return {
    sha256: sha256(canonical({ animations, easings })),
    animations: Object.keys(animations).length,
    easings: Object.keys(easings).length,
  };
}

export function readRecord(file = RECORD_PATH) {
  const record = JSON.parse(readFileSync(file, 'utf8'));
  const problems = [];
  if (record.package !== '@shoelace-style/animations') problems.push('package');
  if (!/^\d+\.\d+\.\d+$/.test(record.version ?? '')) problems.push('version');
  if (!/^sha512-[A-Za-z0-9+/]{86}==$/.test(record.integrity ?? '')) problems.push('integrity');
  if (!/^[0-9a-f]{64}$/.test(record.data?.sha256 ?? '')) problems.push('data.sha256');
  // `files` lists "<path>  <sha256>" lines, like sha256sum output with the columns swapped.
  const files = Array.isArray(record.files) ? record.files.map(line => /^(\S+)  ([0-9a-f]{64})$/.exec(line)) : [null];
  if (!files.every(Boolean)) problems.push('files');
  if (problems.length) throw new Error(`SOURCE.json: malformed ${problems.join(', ')}`);
  return { ...record, files: Object.fromEntries(files.map(([, file, hash]) => [file, hash])) };
}

/** The `files` lines of a record for a map of tarball path -> sha256. */
export const fileLines = files => Object.keys(files).sort().map(file => `${file}  ${files[file]}`);

export async function vendoredDigest(file = VENDORED_PATH) {
  return presetsDigest(await import(pathToFileURL(file).href));
}

function* walk(dir, base = dir) {
  for (const name of readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full, base);
    else yield path.relative(base, full).split(path.sep).join('/');
  }
}

/** Verifies an npm tarball against the record; returns the list of problems (empty when it matches). */
export async function verifyTarball(tarball, record = readRecord()) {
  const problems = [];
  const bytes = readFileSync(tarball);
  const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
  if (integrity !== record.integrity) problems.push(`tarball integrity ${integrity} is not the recorded ${record.integrity}`);
  const { extract } = await import('tar');
  const dir = mkdtempSync(path.join(tmpdir(), 'velcro-animations-'));
  try {
    await extract({ file: tarball, cwd: dir, strict: true });
    const root = path.join(dir, 'package');
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    if (pkg.name !== record.package || pkg.version !== record.version) {
      problems.push(`tarball is ${pkg.name}@${pkg.version}, not ${record.package}@${record.version}`);
    }
    const files = Object.fromEntries([...walk(root)].map(f => [f, sha256(readFileSync(path.join(root, f)))]));
    const names = new Set([...Object.keys(files), ...Object.keys(record.files)]);
    for (const name of [...names].sort()) {
      if (files[name] !== record.files[name]) problems.push(`file ${name}: ${files[name] ?? 'missing'} != ${record.files[name] ?? 'unrecorded'}`);
    }
    const derived = presetsDigest(await import(pathToFileURL(path.join(root, 'dist/index.js')).href));
    if (canonical(derived) !== canonical(record.data)) problems.push(`tarball data ${canonical(derived)} != recorded ${canonical(record.data)}`);
    const vendored = await vendoredDigest();
    if (canonical(vendored) !== canonical(derived)) problems.push(`vendored data ${canonical(vendored)} != tarball ${canonical(derived)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, tarball] = process.argv.slice(2);
  const record = readRecord();
  let problems;
  if (mode === 'check') {
    const vendored = await vendoredDigest();
    problems = canonical(vendored) === canonical(record.data) ? [] : [`vendored data ${canonical(vendored)} != recorded ${canonical(record.data)}`];
  } else if (mode === 'verify' && tarball) {
    problems = await verifyTarball(tarball, record);
  } else {
    console.error('usage: node scripts/vendor/shoelace-animations.mjs check | verify <tarball>');
    process.exit(2);
  }
  for (const p of problems) console.error(`shoelace-animations: ${p}`);
  console.log(`shoelace-animations: ${problems.length ? 'MISMATCH' : 'matches'} ${record.package}@${record.version} (${record.integrity})`);
  process.exit(problems.length ? 1 : 0);
}
