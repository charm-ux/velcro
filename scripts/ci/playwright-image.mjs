// Checks, inside a CI browser job, that the official Playwright container image the job runs in (pinned by digest in
// .github/workflows/product.yml) matches the lockfile's Playwright. The installed @playwright/test, playwright and
// playwright-core must be exactly the lockfile's @playwright/test version. The image must record that same version: its
// build marks it with Playwright's own `mark-docker-image`, which writes the driver version and the image name into
// `.docker-info` in its browsers directory; a missing, malformed or different record stops the job. As further evidence,
// every build that version's own installer would place for the engine (`install --dry-run`, which never downloads) must be
// complete in the image. Nothing is downloaded on a mismatch. (tests/bootstrap/ci.test.mjs separately requires the
// workflow's image tag to name the lockfile's version.) Only fixed status lines are printed, never a path, URL or tool
// output.
import { spawnSync } from 'node:child_process';
import { closeSync, fstatSync, lstatSync, openSync, readFileSync, readSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ENGINES = Object.freeze(['chromium', 'firefox', 'webkit']);
// Where the official image keeps its engine builds (its PLAYWRIGHT_BROWSERS_PATH), and the image name its version record
// must carry for a version (the Ubuntu 24.04 flavour the jobs use).
export const IMAGE_BROWSERS_PATH = '/ms-playwright';
export const imageName = version => `mcr.microsoft.com/playwright:v${version}-noble`;
const RECORD_MAX_BYTES = 4096;

export class ImageError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
const fail = code => { throw new ImageError(code); };
const EXACT = /^\d+\.\d+\.\d+$/;

// The root importer's @playwright/test entry in pnpm-lock.yaml (lockfile v9 layout), read without a YAML dependency. The
// specifier must be the exact version it resolved to.
export function lockedPlaywright(lockText) {
  const importer = /\nimporters:\n\n {2}\.:\n((?: {4,}\S.*\n)+)/.exec(lockText)?.[1] ?? '';
  const entry = /^ {6}'@playwright\/test':\n {8}specifier: (\S+)\n {8}version: (\S+)\n/m.exec(importer);
  if (!entry || !EXACT.test(entry[2]) || entry[1] !== entry[2]) fail('lockfile');
  return entry[2];
}

function versionOf(require, name) {
  let file;
  let version;
  try {
    file = require.resolve(`${name}/package.json`);
    version = JSON.parse(readFileSync(file, 'utf8')).version;
  } catch { fail('not-installed'); }
  return { file, version };
}

// The lockfile's Playwright version, after checking the installed packages are exactly it.
export function installedPlaywright(root) {
  const locked = lockedPlaywright(readFileSync(path.join(root, 'pnpm-lock.yaml'), 'utf8'));
  const test = versionOf(createRequire(path.join(root, 'package.json')), '@playwright/test');
  const runner = versionOf(createRequire(test.file), 'playwright');
  const core = versionOf(createRequire(runner.file), 'playwright-core');
  if ([test, runner, core].some(p => p.version !== locked)) fail('version-mismatch');
  return { version: locked, cli: createRequire(path.join(root, 'package.json')).resolve('@playwright/test/cli') };
}

// The image's own version record (`.docker-info`): a small regular JSON file holding exactly the lockfile's version as
// `driverVersion` and the official image name for it as `dockerImageName`.
export function imageVersion(browsersPath, version) {
  const file = path.join(browsersPath, '.docker-info');
  let text;
  try {
    if (!lstatSync(file).isFile()) fail('image-version-malformed');
    const fd = openSync(file, 'r');
    try {
      const size = fstatSync(fd).size;
      if (size > RECORD_MAX_BYTES) fail('image-version-malformed');
      const bytes = Buffer.alloc(size);
      if (readSync(fd, bytes, 0, size, 0) !== size) fail('image-version-malformed');
      text = bytes.toString('utf8');
    } finally { closeSync(fd); }
  } catch (e) {
    if (e instanceof ImageError) throw e;
    fail('image-version-missing');
  }
  let record;
  try { record = JSON.parse(text); } catch { fail('image-version-malformed'); }
  if (!record || typeof record !== 'object' || Array.isArray(record) || typeof record.driverVersion !== 'string'
    || typeof record.dockerImageName !== 'string') fail('image-version-malformed');
  if (record.driverVersion !== version || record.dockerImageName !== imageName(version)) fail('image-version-mismatch');
  return record.driverVersion;
}

const isDir = p => { try { return lstatSync(p).isDirectory(); } catch { return false; } };
const isFile = p => { try { return lstatSync(p).isFile(); } catch { return false; } };

// The engine builds the installed Playwright expects for `engine`, each of which must be a complete build directory directly
// in `browsersPath` (Playwright writes INSTALLATION_COMPLETE last). Returns the build directory names.
export function checkImage({ root, engine, browsersPath, run = spawnSync }) {
  if (!ENGINES.includes(engine)) fail('engine');
  if (typeof browsersPath !== 'string' || !path.isAbsolute(browsersPath)) fail('browsers-path');
  const { version, cli } = installedPlaywright(root);
  imageVersion(browsersPath, version);
  const dry = run(process.execPath, [cli, 'install', '--dry-run', engine], { cwd: root, encoding: 'utf8', timeout: 60_000,
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browsersPath }, stdio: ['ignore', 'pipe', 'pipe'] });
  if (dry.status !== 0 || typeof dry.stdout !== 'string') fail('dry-run-failed');
  const locations = [...dry.stdout.matchAll(/^ +Install location: +(\S.*?)\s*$/gm)].map(m => m[1]);
  if (!locations.length) fail('no-engine-builds');
  const builds = [];
  for (const location of locations) {
    const name = path.basename(location);
    if (path.dirname(location) !== browsersPath || !/^[a-z][a-z_]*-\d+$/.test(name)) fail('engine-outside-image');
    if (!isDir(location) || !isFile(path.join(location, 'INSTALLATION_COMPLETE'))) fail('engine-missing');
    if (!builds.includes(name)) builds.push(name);
  }
  if (!builds.some(name => name.startsWith(`${engine}-`))) fail('no-engine-builds');
  return { version, builds };
}

if (import.meta.main) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  try {
    const argv = process.argv.slice(2);
    if (argv.length !== 1) fail('usage');
    // The job must use the image's own builds, never a cache or download elsewhere.
    if (process.env.PLAYWRIGHT_BROWSERS_PATH !== IMAGE_BROWSERS_PATH) fail('browsers-path');
    const { version, builds } = checkImage({ root, engine: argv[0], browsersPath: IMAGE_BROWSERS_PATH });
    process.stdout.write(`playwright image: passed (Playwright ${version}; ${builds.join(', ')})\n`);
  } catch (e) {
    const code = e instanceof ImageError ? e.message : 'check-failed';
    process.stdout.write(`playwright image: blocked (${code})\n`);
    process.exitCode = 1;
  }
}
