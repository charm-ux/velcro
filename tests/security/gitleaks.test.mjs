import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { devNull, homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { settleAll, spawnAsync, TEST_CONCURRENCY } from '../support/spawn.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const scriptPath = path.join(repoRoot, 'scripts', 'security', 'gitleaks.mjs');
const manifestPath = path.join(repoRoot, 'security', 'gitleaks-checksums.json');

const scanner = await import(pathToFileURL(scriptPath).href);

const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
const ROOT_SKIP = isRoot ? 'file permissions cannot deny access to root' : false;

const scratchRoots = [];
after(() => {
  for (const dir of scratchRoots) {
    try {
      execFileSync('chmod', ['-R', 'u+rwx', dir], { stdio: 'ignore' });
    } catch {
      // best effort before removal
    }
    rmSync(dir, { recursive: true, force: true });
  }
});

function scratch(label) {
  const dir = mkdtempSync(path.join(tmpdir(), `velcro-gitleaks-${label}-`));
  scratchRoots.push(dir);
  return dir;
}

const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

// A GitHub-token-shaped value with a random body, assembled at runtime so no
// reusable secret-looking literal is committed.
function syntheticToken() {
  let body = '';
  for (const byte of randomBytes(36)) body += ALPHANUMERIC[byte % ALPHANUMERIC.length];
  return ['gh', 'p_'].join('') + body;
}

function syntheticEmail() {
  return [`private.person.${randomBytes(3).toString('hex')}`, 'example.invalid'].join('@');
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function forbiddenFragments(...extra) {
  return [homedir(), tmpdir(), ...extra].filter((value) => typeof value === 'string' && value.length > 0);
}

// Never pass hostile output to assertion helpers that echo the actual value.
function assertExcludes(output, values, context) {
  for (const value of values) {
    assert.ok(!output.includes(value), `${context}: output contains a forbidden value`);
  }
}

function assertIncludes(output, expected, context) {
  assert.ok(output.includes(expected), `${context}: expected text missing`);
}

async function runCli(args, options = {}) {
  const result = await spawnAsync(process.execPath, [options.script ?? scriptPath, ...args], {
    cwd: options.cwd ?? repoRoot,
    encoding: 'utf8',
    env: { ...process.env, ...options.env },
    timeout: options.timeout ?? 120_000,
  });
  return { code: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '', output: `${result.stdout}${result.stderr}` };
}

async function withEnv(overrides, fn) {
  const previous = {};
  for (const [key, value] of Object.entries(overrides)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const gitEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: devNull,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Velcro Test',
  GIT_AUTHOR_EMAIL: ['test', 'example.invalid'].join('@'),
  GIT_COMMITTER_NAME: 'Velcro Test',
  GIT_COMMITTER_EMAIL: ['test', 'example.invalid'].join('@'),
};

async function git(cwd, ...args) {
  return await gitWithInput(cwd, undefined, ...args);
}

// Like execFileSync: resolves to the trimmed output and rejects when Git does not succeed.
async function gitWithInput(cwd, input, ...args) {
  const result = await spawnAsync('git', ['-c', 'commit.gpgsign=false', '-c', 'init.defaultBranch=main', ...args], {
    cwd,
    env: gitEnv,
    encoding: 'utf8',
    input,
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
  });
  if (result.error || result.status !== 0) throw result.error ?? new Error(`fixture Git operation failed (${args[0]})`);
  return result.stdout.trim();
}

async function initRepo(label) {
  const dir = scratch(label);
  await git(dir, 'init', '-q');
  return dir;
}

async function commitFile(repo, name, content, message) {
  mkdirSync(path.dirname(path.join(repo, name)), { recursive: true });
  writeFileSync(path.join(repo, name), content);
  await git(repo, 'add', '--', name);
  await git(repo, 'commit', '-q', '-m', message);
  return await git(repo, 'rev-parse', 'HEAD');
}

// Builds a commit object outside any branch, without touching the index,
// working tree, or stash machinery.
async function detachedCommit(repo, parent, files, message) {
  const entries = await settleAll(Object.entries(files).map(async ([name, content]) => {
    const blob = await gitWithInput(repo, content, 'hash-object', '-w', '--stdin');
    return `100644 blob ${blob}\t${name}`;
  }));
  const tree = await gitWithInput(repo, `${entries.join('\n')}\n`, 'mktree');
  return await git(repo, 'commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', message);
}

// ---------------------------------------------------------------------------
// Minimal ustar builder for hostile-archive tests.

function octal(value, width) {
  return value.toString(8).padStart(width - 1, '0') + '\0';
}

function tarHeader({ name, size = 0, type = '0', linkname = '', mode = 0o644, prefix = '' }) {
  const header = Buffer.alloc(512, 0);
  header.write(name, 0, 100, 'utf8');
  header.write(octal(mode, 8), 100, 8, 'ascii');
  header.write(octal(0, 8), 108, 8, 'ascii');
  header.write(octal(0, 8), 116, 8, 'ascii');
  header.write(octal(size, 12), 124, 12, 'ascii');
  header.write(octal(0, 12), 136, 12, 'ascii');
  header.fill(0x20, 148, 156);
  header.write(type, 156, 1, 'ascii');
  header.write(linkname, 157, 100, 'utf8');
  header.write('ustar\u000000', 257, 8, 'binary');
  header.write(prefix, 345, 155, 'utf8');
  let sum = 0;
  for (const byte of header) sum += byte;
  header.write(octal(sum, 7) + ' ', 148, 8, 'ascii');
  return header;
}

function tarArchive(entries, { gzip = true, terminate = true } = {}) {
  const blocks = [];
  for (const entry of entries) {
    const data = Buffer.from(entry.data ?? '');
    blocks.push(entry.header ?? tarHeader({ ...entry, size: entry.size ?? data.length }));
    if (data.length > 0) {
      blocks.push(data);
      const pad = (512 - (data.length % 512)) % 512;
      if (pad) blocks.push(Buffer.alloc(pad, 0));
    }
  }
  if (terminate) blocks.push(Buffer.alloc(1024, 0));
  const tar = Buffer.concat(blocks);
  return gzip ? gzipSync(tar) : tar;
}

const standardEntries = (exe = 'binary-bytes') => [
  { name: 'LICENSE', data: 'license text' },
  { name: 'README.md', data: 'readme text' },
  { name: 'gitleaks', data: exe, mode: 0o755 },
];

// ---------------------------------------------------------------------------
// Fake scanner executables exercise the process-handling paths without any
// production bypass: callers pass an explicit binary and its expected hash.

function fakeScanner(dir, body) {
  const file = path.join(dir, `fake-scanner-${randomBytes(4).toString('hex')}`);
  writeFileSync(file, `#!${process.execPath}\n${body}\n`);
  chmodSync(file, 0o755);
  return { path: file, sha256: sha256(readFileSync(file)) };
}

function fakeReportBody({ exit = 0, stdout = '[]', stderr = '', record = null, marker = null, sleep = false, signal = false }) {
  return [
    "const fs = require('node:fs');",
    marker ? `fs.writeFileSync(${JSON.stringify(marker)}, 'ran');` : '',
    record
      ? `fs.writeFileSync(${JSON.stringify(record)}, JSON.stringify({ argv: process.argv.slice(2), env: process.env, config: (() => { const i = process.argv.indexOf('--config'); return i > 0 ? fs.readFileSync(process.argv[i + 1], 'utf8') : null; })(), cwd: process.cwd() }));`
      : '',
    stderr ? `fs.writeSync(2, ${JSON.stringify(stderr)});` : '',
    sleep ? 'setInterval(() => {}, 1000);' : '',
    signal ? "process.kill(process.pid, 'SIGKILL');" : '',
    sleep || signal ? '' : `process.stdout.write(${JSON.stringify(stdout)}, () => process.exit(${exit}));`,
  ].join('\n');
}

function diag(level, message) {
  return `2:04AM ${level} ${message}\n`;
}

function findingJson(overrides = {}) {
  return {
    RuleID: 'github-pat',
    Description: 'GitHub Personal Access Token',
    StartLine: 3,
    EndLine: 3,
    Match: 'REDACTED',
    Secret: 'REDACTED',
    File: 'nested/settings.txt',
    Commit: '',
    Author: '',
    Email: '',
    Message: '',
    Tags: [],
    Fingerprint: 'nested/settings.txt:github-pat:3',
    ...overrides,
  };
}

async function expectSafeError(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof scanner.SafeError, `expected SafeError, got ${error?.constructor?.name}`);
    assert.equal(error.code, code);
    return true;
  });
}

// ---------------------------------------------------------------------------

const OFFICIAL_ARCHIVE_SHA256 = {
  'darwin-arm64': 'b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5',
  'darwin-x64': 'dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709',
  'linux-arm64': 'e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080',
  'linux-x64': '551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb',
};

describe('pinned manifest', () => {
  test('pins Gitleaks 8.30.1 official archives for supported Darwin/Linux targets only', async () => {
    const manifest = scanner.loadManifest(repoRoot);
    assert.equal(manifest.version, '8.30.1');
    assert.deepEqual(Object.keys(manifest.targets).sort(), Object.keys(OFFICIAL_ARCHIVE_SHA256).sort());
    for (const [key, expected] of Object.entries(OFFICIAL_ARCHIVE_SHA256)) {
      const target = manifest.targets[key];
      const [os, arch] = key.split('-');
      assert.equal(target.archive, `gitleaks_8.30.1_${os}_${arch}.tar.gz`);
      assert.equal(target.archiveSha256, expected);
      assert.match(target.executableSha256, /^[0-9a-f]{64}$/);
    }
    const raw = JSON.parse(readFileSync(manifestPath, 'utf8'));
    assert.equal(raw.releaseBaseUrl, 'https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/');
  });

  test('download URLs point at the official release for the selected target', async () => {
    const manifest = scanner.loadManifest(repoRoot);
    const target = scanner.selectTarget(manifest, 'linux', 'arm64');
    assert.equal(
      target.url,
      'https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_arm64.tar.gz',
    );
    assert.equal(target.key, 'linux-arm64');
  });

  for (const [platform, arch] of [
    ['win32', 'x64'],
    ['linux', 'ia32'],
    ['freebsd', 'x64'],
    ['linux', 'arm'],
  ]) {
    test(`unsupported target ${platform}-${arch} fails clearly`, async () => {
      const manifest = scanner.loadManifest(repoRoot);
      assert.throws(
        () => scanner.selectTarget(manifest, platform, arch),
        (error) => error instanceof scanner.SafeError && error.code === 'unsupported-platform',
      );
    });
  }

  test('malformed or tampered manifests are rejected', async () => {
    const good = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const cases = [
      '{ not json',
      JSON.stringify({ ...good, version: '8.30.2' }),
      JSON.stringify({ ...good, releaseBaseUrl: 'https://example.invalid/gitleaks/' }),
      JSON.stringify({ ...good, targets: { ...good.targets, 'linux-x64': { ...good.targets['linux-x64'], archiveSha256: 'abc' } } }),
      JSON.stringify({ ...good, targets: { ...good.targets, 'linux-x64': { ...good.targets['linux-x64'], archive: '../evil.tar.gz' } } }),
      JSON.stringify({ ...good, targets: { ...good.targets, 'win32-x64': good.targets['linux-x64'] } }),
    ];
    for (const content of cases) {
      const root = scratch('manifest');
      mkdirSync(path.join(root, 'security'));
      writeFileSync(path.join(root, 'security', 'gitleaks-checksums.json'), content);
      assert.throws(
        () => scanner.loadManifest(root),
        (error) => error instanceof scanner.SafeError && error.code === 'manifest-invalid',
      );
    }
  });
});

describe('archive extraction', () => {
  test('selects only the top-level gitleaks executable', async () => {
    const exe = randomBytes(2048);
    const result = scanner.extractExecutable(tarArchive(standardEntries(exe)));
    assert.ok(Buffer.isBuffer(result));
    assert.equal(sha256(result), sha256(exe));
  });

  test('accepts a leading ./ on the executable entry', async () => {
    const result = scanner.extractExecutable(tarArchive([{ name: './gitleaks', data: 'x', mode: 0o755 }]));
    assert.equal(result.toString(), 'x');
  });

  const hostile = {
    'absolute path': [...standardEntries(), { name: ['', 'scratch', 'evil'].join('/'), data: 'x' }],
    'parent traversal': [{ name: '../evil', data: 'x' }, ...standardEntries()],
    'nested traversal': [...standardEntries(), { name: 'docs/../../evil', data: 'x' }],
    'backslash traversal': [...standardEntries(), { name: '..\\evil', data: 'x' }],
    'drive-letter path': [...standardEntries(), { name: ['C', 'evil'].join(':'), data: 'x' }],
    'traversal via prefix field': [...standardEntries(), { name: 'evil', prefix: '..', data: 'x' }],
    'symlink executable': [{ name: 'gitleaks', type: '2', linkname: ['', 'elsewhere', 'tool'].join('/') }],
    'hardlink entry': [...standardEntries(), { name: 'other', type: '1', linkname: 'gitleaks' }],
    'pax header': [{ name: 'PaxHeader', type: 'x', data: '30 path=../../escaped/gitleaks\n' }, ...standardEntries()],
    'device entry': [...standardEntries(), { name: 'dev', type: '3' }],
    'duplicate executable': [...standardEntries(), { name: 'gitleaks', data: 'second', mode: 0o755 }],
    'missing executable': [{ name: 'LICENSE', data: 'x' }],
    'nested-only executable': [{ name: 'bin/gitleaks', data: 'x', mode: 0o755 }],
    'executable is a directory': [{ name: 'gitleaks/', type: '5' }],
  };
  for (const [label, entries] of Object.entries(hostile)) {
    test(`rejects archive with ${label}`, async () => {
      assert.throws(
        () => scanner.extractExecutable(tarArchive(entries)),
        (error) => error instanceof scanner.SafeError && error.code === 'archive-unsafe',
      );
    });
  }

  test('rejects corrupt header checksum, truncation, and non-gzip input', async () => {
    const corrupt = tarHeader({ name: 'gitleaks', size: 1 });
    corrupt[0] = 'h'.charCodeAt(0);
    const samples = [
      tarArchive([{ name: 'gitleaks', header: corrupt, data: 'x' }]),
      gzipSync(tarArchive(standardEntries('y'.repeat(4096)), { gzip: false }).subarray(0, 2048)),
      Buffer.from('definitely not gzip'),
    ];
    for (const sample of samples) {
      assert.throws(
        () => scanner.extractExecutable(sample),
        (error) => error instanceof scanner.SafeError && error.code === 'archive-unsafe',
      );
    }
  });
});

async function installRoot(label, manifestOverride) {
  const root = await initRepo(label);
  mkdirSync(path.join(root, 'security'));
  if (manifestOverride) {
    writeFileSync(path.join(root, 'security', 'gitleaks-checksums.json'), JSON.stringify(manifestOverride));
  } else {
    copyFileSync(manifestPath, path.join(root, 'security', 'gitleaks-checksums.json'));
  }
  return root;
}

async function ignoredRoot(label, manifestOverride) {
  const root = await installRoot(label, manifestOverride);
  writeFileSync(path.join(root, '.gitignore'), '.airig/\n');
  return root;
}

function listFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true });
}

// Ambient user Git configuration must not decide these tests: run the
// installer with an empty, test-owned home.
function isolatedHome(globalIgnore) {
  const home = scratch('home');
  if (globalIgnore !== undefined) {
    mkdirSync(path.join(home, '.config', 'git'), { recursive: true });
    writeFileSync(path.join(home, '.config', 'git', 'ignore'), globalIgnore);
  }
  return { HOME: home, XDG_CONFIG_HOME: path.join(home, '.config') };
}

function syntheticInstallManifest(executable) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const archive = tarArchive(standardEntries(executable));
  manifest.targets['linux-x64'] = {
    ...manifest.targets['linux-x64'],
    archiveSha256: sha256(archive),
    executableSha256: sha256(Buffer.from(executable)),
  };
  return { manifest, archive };
}

function fakeVersionExecutable(version) {
  return `#!${process.execPath}\nif (process.argv[2] === 'version') process.stdout.write(${JSON.stringify(`${version}\n`)});\n`;
}

describe('install transport (mocked)', () => {
  test('checksum mismatch fails before any extraction or install', async () => {
    const root = await ignoredRoot('install-mismatch');
    const calls = [];
    const fetchImpl = async (url) => {
      calls.push(url);
      return new Response(tarArchive(standardEntries('not the pinned binary')), { status: 200 });
    };
    await expectSafeError(
      scanner.installGitleaks({ root, platform: 'linux', arch: 'x64', fetchImpl }),
      'archive-checksum-mismatch',
    );
    assert.equal(calls.length, 1);
    assert.equal(
      String(calls[0]),
      'https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz',
    );
    const installed = listFiles(path.join(root, '.airig')).filter((entry) => entry.endsWith('gitleaks'));
    assert.deepEqual(installed, []);
    const kept = listFiles(path.join(root, '.airig')).filter((entry) => entry.endsWith('.tar.gz'));
    assert.deepEqual(kept, [], 'unverified download bytes must never be kept');
  });

  test('network errors are reported without echoing raw transport detail', async () => {
    const root = await ignoredRoot('install-network');
    const hostileDetail = `${syntheticToken()} at ${path.join(homedir(), 'private', 'file')}`;
    const fetchImpl = async () => {
      throw new Error(hostileDetail);
    };
    await assert.rejects(scanner.installGitleaks({ root, platform: 'darwin', arch: 'arm64', fetchImpl }), (error) => {
      assert.equal(error.code, 'download-failed');
      assertExcludes(`${error.message}\n${error.stack}`, [hostileDetail, homedir()], 'network error');
      return true;
    });
  });

  test('HTTP failures fail closed', async () => {
    const root = await ignoredRoot('install-http');
    const fetchImpl = async () => new Response('missing', { status: 404 });
    await expectSafeError(scanner.installGitleaks({ root, platform: 'linux', arch: 'arm64', fetchImpl }), 'download-failed');
  });

  test('oversized streamed downloads are aborted', async () => {
    const root = await ignoredRoot('install-oversize');
    const chunk = new Uint8Array(1024 * 1024);
    let sent = 0;
    const body = new ReadableStream({
      pull(controller) {
        if (sent++ > 200) controller.close();
        else controller.enqueue(chunk);
      },
    });
    const fetchImpl = async () => new Response(body, { status: 200 });
    await expectSafeError(scanner.installGitleaks({ root, platform: 'linux', arch: 'x64', fetchImpl }), 'download-too-large');
    assert.ok(sent < 200, 'download continued after exceeding the limit');
  });

  test('a declared oversized Content-Length is rejected before reading the body', async () => {
    const root = await ignoredRoot('install-content-length');
    let pulled = 0;
    const body = new ReadableStream({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new Uint8Array(16));
      },
    });
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-length': String(1024 * 1024 * 1024) }),
      body,
    });
    await expectSafeError(scanner.installGitleaks({ root, platform: 'linux', arch: 'x64', fetchImpl }), 'download-too-large');
    assert.ok(pulled <= 1, 'body was consumed despite an oversized declared length');
  });

  test('refuses to install into a scratch location Git does not ignore', async () => {
    const root = await installRoot('install-unignored');
    let called = false;
    const fetchImpl = async () => {
      called = true;
      return new Response('x');
    };
    await withEnv(isolatedHome(), () =>
      expectSafeError(scanner.installGitleaks({ root, platform: 'linux', arch: 'x64', fetchImpl }), 'scratch-not-ignored'),
    );
    assert.equal(called, false);
  });

  test('install honours the normal user ignore configuration', async () => {
    const root = await installRoot('install-global-ignore');
    let called = false;
    const fetchImpl = async () => {
      called = true;
      return new Response('missing', { status: 404 });
    };
    await withEnv(isolatedHome('.airig/\n'), () =>
      expectSafeError(scanner.installGitleaks({ root, platform: 'linux', arch: 'x64', fetchImpl }), 'download-failed'),
    );
    assert.equal(called, true, 'globally ignored scratch should have been accepted');
  });

  test('unsupported platform fails before any download', async () => {
    const root = await ignoredRoot('install-unsupported');
    let called = false;
    const fetchImpl = async () => {
      called = true;
      return new Response('x');
    };
    await expectSafeError(scanner.installGitleaks({ root, platform: 'win32', arch: 'x64', fetchImpl }), 'unsupported-platform');
    assert.equal(called, false);
  });

  test('verified archive installs atomically, then reinstall is idempotent', async () => {
    const executable = fakeVersionExecutable('8.30.1');
    const { manifest, archive } = syntheticInstallManifest(executable);
    const root = await ignoredRoot('install-happy', manifest);
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return new Response(archive, { status: 200 });
    };
    const first = await scanner.installGitleaks({ root, platform: 'linux', arch: 'x64', fetchImpl });
    assert.equal(first.status, 'installed');
    assert.equal(first.reportedVersion, '8.30.1');
    const location = path.join(root, first.location);
    assert.equal(sha256(readFileSync(location)), sha256(Buffer.from(executable)));
    assert.equal(statSync(location).mode & 0o777, 0o700);
    assert.deepEqual(
      listFiles(path.dirname(location)).filter((name) => name.includes('partial')),
      [],
      'temporary install file left behind',
    );
    const second = await scanner.installGitleaks({ root, platform: 'linux', arch: 'x64', fetchImpl });
    assert.equal(second.status, 'already-installed');
    assert.equal(calls, 1);
  });

  // The kept archive is what CI caches (.airig/tools/gitleaks/<version>/archives): a restore is untrusted bytes.
  const keptArchive = (root) =>
    path.join(root, scanner.selectTarget(scanner.loadManifest(root), 'linux', 'x64').relativeArchive);
  const installedExecutable = (root) =>
    path.join(root, scanner.selectTarget(scanner.loadManifest(root), 'linux', 'x64').relativeExecutable);
  const noFetch = (calls) => async () => {
    calls.push('fetch');
    return new Response('unexpected', { status: 500 });
  };

  test('a miss downloads, verifies and keeps exactly the pinned archive in the cached directory', async () => {
    const executable = fakeVersionExecutable('8.30.1');
    const { manifest, archive } = syntheticInstallManifest(executable);
    const root = await ignoredRoot('install-keep', manifest);
    const calls = [];
    const fetchImpl = async (url) => {
      calls.push(String(url));
      return new Response(archive, { status: 200 });
    };
    const first = await scanner.installGitleaks({ root, platform: 'linux', arch: 'x64', fetchImpl });
    assert.equal(first.status, 'installed');
    assert.equal(calls.length, 1);
    assert.equal(first.archiveLocation, '.airig/tools/gitleaks/8.30.1/archives/gitleaks_8.30.1_linux_x64.tar.gz');
    const kept = keptArchive(root);
    assert.equal(sha256(readFileSync(kept)), manifest.targets['linux-x64'].archiveSha256);
    assert.equal(statSync(kept).mode & 0o777, 0o600);
    assert.deepEqual(readdirSync(path.dirname(kept)), [path.basename(kept)], 'only the archive is kept there');
    // A fresh runner (no executable) with the restored archive installs without any download.
    rmSync(installedExecutable(root));
    const second = await scanner.installGitleaks({ root, platform: 'linux', arch: 'x64', fetchImpl: noFetch(calls) });
    assert.equal(second.status, 'installed-from-kept-archive');
    assert.equal(second.reportedVersion, '8.30.1');
    assert.equal(calls.length, 1, 'a kept archive is never re-downloaded');
    assert.equal(sha256(readFileSync(installedExecutable(root))), sha256(Buffer.from(executable)));
    const third = await scanner.installGitleaks({ root, platform: 'linux', arch: 'x64', fetchImpl: noFetch(calls) });
    assert.equal(third.status, 'already-installed');
    assert.equal(third.keptArchiveVerified, true);
    assert.equal(calls.length, 1);
  });

  test('a restored archive with the pinned bytes installs without a download', async () => {
    const executable = fakeVersionExecutable('8.30.1');
    const { manifest, archive } = syntheticInstallManifest(executable);
    const root = await ignoredRoot('install-restored-good', manifest);
    mkdirSync(path.dirname(keptArchive(root)), { recursive: true });
    writeFileSync(keptArchive(root), archive);
    const calls = [];
    const result = await scanner.installGitleaks({ root, platform: 'linux', arch: 'x64', fetchImpl: noFetch(calls) });
    assert.equal(result.status, 'installed-from-kept-archive');
    assert.deepEqual(calls, []);
    assert.equal(sha256(readFileSync(installedExecutable(root))), sha256(Buffer.from(executable)));
  });

  test('a restored archive with wrong bytes fails closed: no extraction, no download, no install', async () => {
    const executable = fakeVersionExecutable('8.30.1');
    const { manifest } = syntheticInstallManifest(executable);
    const root = await ignoredRoot('install-restored-bad', manifest);
    mkdirSync(path.dirname(keptArchive(root)), { recursive: true });
    // A well-formed archive whose executable would even run: only the pinned archive hash decides.
    const wrong = tarArchive(standardEntries(fakeVersionExecutable('8.30.1') + '// tampered\n'));
    writeFileSync(keptArchive(root), wrong);
    const calls = [];
    await expectSafeError(
      scanner.installGitleaks({ root, platform: 'linux', arch: 'x64', fetchImpl: noFetch(calls) }),
      'cached-archive-invalid',
    );
    assert.deepEqual(calls, [], 'wrong kept bytes are never replaced by a download');
    assert.equal(existsSync(installedExecutable(root)), false);
    assert.equal(sha256(readFileSync(keptArchive(root))), sha256(wrong), 'the evidence is left in place');
  });

  test('wrong kept bytes fail closed even when a verified executable is already installed', async () => {
    const executable = fakeVersionExecutable('8.30.1');
    const { manifest, archive } = syntheticInstallManifest(executable);
    const root = await ignoredRoot('install-restored-bad-installed', manifest);
    await scanner.installGitleaks({ root, platform: 'linux', arch: 'x64', fetchImpl: async () => new Response(archive) });
    writeFileSync(keptArchive(root), Buffer.concat([archive, Buffer.from('x')]));
    const calls = [];
    await expectSafeError(
      scanner.installGitleaks({ root, platform: 'linux', arch: 'x64', fetchImpl: noFetch(calls) }),
      'cached-archive-invalid',
    );
    assert.deepEqual(calls, []);
  });

  for (const [label, place] of [
    ['a symlink to the pinned bytes', (file, archive, dir) => {
      writeFileSync(path.join(dir, 'elsewhere.tar.gz'), archive);
      symlinkSync(path.join(dir, 'elsewhere.tar.gz'), file);
    }],
    ['a directory', (file) => mkdirSync(file)],
    ['an oversized file', (file) => writeFileSync(file, Buffer.alloc(32 * 1024 * 1024 + 1))],
  ]) {
    test(`a kept archive that is ${label} fails closed`, async () => {
      const executable = fakeVersionExecutable('8.30.1');
      const { manifest, archive } = syntheticInstallManifest(executable);
      const root = await ignoredRoot('install-restored-odd', manifest);
      mkdirSync(path.dirname(keptArchive(root)), { recursive: true });
      place(keptArchive(root), archive, scratch('install-restored-elsewhere'));
      const calls = [];
      await expectSafeError(
        scanner.installGitleaks({ root, platform: 'linux', arch: 'x64', fetchImpl: noFetch(calls) }),
        'cached-archive-invalid',
      );
      assert.deepEqual(calls, []);
      assert.equal(existsSync(installedExecutable(root)), false);
    });
  }

  test('an executable reporting the wrong version is rolled back', async () => {
    const executable = fakeVersionExecutable('8.30.0');
    const { manifest, archive } = syntheticInstallManifest(executable);
    const root = await ignoredRoot('install-wrong-version', manifest);
    const fetchImpl = async () => new Response(archive, { status: 200 });
    await expectSafeError(scanner.installGitleaks({ root, platform: 'linux', arch: 'x64', fetchImpl }), 'version-mismatch');
    const target = scanner.selectTarget(scanner.loadManifest(root), 'linux', 'x64');
    assert.equal(existsSync(path.join(root, target.relativeExecutable)), false);
  });
});

// The security job's opt-in retry: transport failures only, a fresh temporary file per attempt, the pinned checksum
// before use, and both an attempt cap and a total time cap. A fake clock and sleep stand in for real waiting.
describe('install download retry (mocked)', () => {
  const policy = scanner.DOWNLOAD_RETRY_POLICY;
  const fakeTime = () => {
    let clock = 0;
    const sleeps = [];
    return {
      now: () => clock,
      sleep: async (ms) => {
        sleeps.push(ms);
        clock += ms;
      },
      advance: (ms) => {
        clock += ms;
      },
      sleeps,
    };
  };
  // Runs an install with TMPDIR pointed at a test-owned directory, recording what each attempt saw there.
  async function install(label, responses, { retry = true, manifestBytes, perAttemptMs = 0 } = {}) {
    const executable = fakeVersionExecutable('8.30.1');
    const { manifest, archive } = manifestBytes ?? syntheticInstallManifest(executable);
    const root = await ignoredRoot(label, manifest);
    const temp = scratch(`${label}-tmp`);
    const time = fakeTime();
    const seen = [];
    const retries = [];
    let calls = 0;
    const fetchImpl = async () => {
      seen.push(readdirSync(temp, { recursive: true }).sort());
      time.advance(perAttemptMs);
      const next = responses[Math.min(calls, responses.length - 1)];
      calls += 1;
      return next(archive);
    };
    const run = () =>
      scanner.installGitleaks({ root, platform: 'linux', arch: 'x64', fetchImpl, retry, sleep: time.sleep, now: time.now,
        onRetry: (info) => retries.push(info) });
    let result;
    let error;
    try {
      result = await withEnv({ TMPDIR: temp, TMP: temp, TEMP: temp }, run);
    } catch (caught) {
      error = caught;
    }
    return { result, error, calls: () => calls, seen, retries, sleeps: time.sleeps, leftover: readdirSync(temp), root };
  }
  const ok = (archive) => new Response(archive, { status: 200 });
  const status = (code) => () => new Response('unavailable', { status: code });
  const networkError = () => {
    throw new Error('socket hang up');
  };

  test('a 504 is retried after a backoff, and the next verified download installs', async () => {
    const run = await install('retry-504', [status(504), ok]);
    assert.equal(run.error, undefined);
    assert.equal(run.result.status, 'installed');
    assert.equal(run.result.downloadAttempts, 2);
    assert.equal(run.calls(), 2);
    assert.deepEqual(run.retries, [{ attempt: 1, attempts: 4, httpStatus: 504, delayMs: policy.delaysMs[0] }]);
    assert.deepEqual(run.sleeps, [policy.delaysMs[0]]);
  });

  test('network errors are retried too', async () => {
    const run = await install('retry-network', [networkError, networkError, ok]);
    assert.equal(run.error, undefined);
    assert.equal(run.result.downloadAttempts, 3);
    assert.deepEqual(run.retries.map((r) => r.httpStatus), [null, null]);
    assert.deepEqual(run.sleeps, policy.delaysMs.slice(0, 2));
  });

  test('a checksum mismatch is a hard failure and is never retried', async () => {
    const wrong = () => new Response(tarArchive(standardEntries('not the pinned binary')), { status: 200 });
    const run = await install('retry-mismatch', [wrong, ok]);
    assert.equal(run.error?.code, 'archive-checksum-mismatch');
    assert.equal(run.calls(), 1);
    assert.deepEqual(run.retries, []);
    assert.deepEqual(run.sleeps, []);
    assert.equal(existsSync(path.join(run.root, '.airig', 'tools')) ? listFiles(path.join(run.root, '.airig', 'tools')).filter((f) => f.endsWith('.tar.gz')).length : 0, 0);
  });

  test('a 5xx followed by a mismatch fails on the mismatch without another attempt', async () => {
    const wrong = () => new Response(tarArchive(standardEntries('not the pinned binary')), { status: 200 });
    const run = await install('retry-then-mismatch', [status(503), wrong, ok]);
    assert.equal(run.error?.code, 'archive-checksum-mismatch');
    assert.equal(run.calls(), 2);
  });

  for (const code of [400, 403, 404, 429]) {
    test(`HTTP ${code} is not a transport failure and is not retried`, async () => {
      const run = await install(`retry-${code}`, [status(code), ok]);
      assert.equal(run.error?.code, 'download-failed');
      assert.equal(run.calls(), 1);
      assert.deepEqual(run.sleeps, []);
    });
  }

  test('the attempt cap: at most four attempts, then a fixed failure', async () => {
    const run = await install('retry-cap', [status(504)]);
    assert.equal(run.error?.code, 'download-failed');
    assert.match(run.error.message, /gave up after 4 of 4 attempts$/);
    assert.equal(run.calls(), policy.attempts);
    assert.deepEqual(run.sleeps, [...policy.delaysMs]);
    assert.ok(run.sleeps.reduce((a, b) => a + b, 0) <= policy.budgetMs);
  });

  test('the time cap: no attempt starts once the remaining budget cannot hold a backoff and an attempt', async () => {
    // Each failing attempt runs into its 30 s timeout: 30 + 5 + 30 + 10 + 30 = 105 s, and a 20 s backoff plus a minimal
    // attempt no longer fit in the 120 s budget, so the fourth attempt never starts.
    const run = await install('retry-time-cap', [status(502)], { perAttemptMs: policy.attemptTimeoutMs });
    assert.equal(run.error?.code, 'download-failed');
    assert.match(run.error.message, /gave up after 3 of 4 attempts$/);
    assert.equal(run.calls(), 3);
    assert.deepEqual(run.sleeps, policy.delaysMs.slice(0, 2));
    assert.ok(policy.budgetMs <= 120_000 && policy.attempts <= 4);
  });

  test('without the opt-in a transport failure is not retried (other jobs keep the single download)', async () => {
    const run = await install('retry-off', [status(504), ok], { retry: false });
    assert.equal(run.error?.code, 'download-failed');
    assert.doesNotMatch(run.error.message, /attempts/);
    assert.equal(run.calls(), 1);
    assert.deepEqual(run.sleeps, []);
  });

  test('every attempt writes a fresh temporary file, and none is left behind', async () => {
    const run = await install('retry-temp', [status(500), networkError, status(504), ok]);
    assert.equal(run.error, undefined);
    assert.equal(run.seen.length, 4);
    const dirs = run.seen.map((entries) => {
      // Exactly one fresh, still-empty attempt directory (the file is created only once a response arrives).
      assert.equal(entries.length, 1, JSON.stringify(entries));
      assert.match(entries[0], /^velcro-gitleaks-download-/);
      return entries[0];
    });
    assert.equal(new Set(dirs).size, 4, 'each attempt has its own directory');
    assert.deepEqual(run.leftover, [], 'temporary attempt files are removed');
    // Failed attempts are cleaned up too.
    const failed = await install('retry-temp-failed', [status(503)]);
    assert.equal(failed.error?.code, 'download-failed');
    assert.deepEqual(failed.leftover, []);
  });

  // A rejected response whose error body trickles forever: every attempt must abort its request and cancel the body
  // before the next attempt starts and before the installer gives up.
  function stallingTransport(statusFor) {
    const attempts = [];
    const fetchImpl = async (_url, { signal }) => {
      const attempt = { signal, cancelled: false, chunks: 0, priorSettled: attempts.every((a) => a.signal.aborted && a.cancelled) };
      attempts.push(attempt);
      let timer;
      const body = new ReadableStream({
        pull(controller) {
          return new Promise((resolve) => {
            timer = setTimeout(() => {
              attempt.chunks += 1;
              controller.enqueue(new TextEncoder().encode('.'));
              resolve();
            }, 20);
          });
        },
        cancel() {
          clearTimeout(timer);
          attempt.cancelled = true;
        },
      });
      return new Response(body, { status: statusFor(attempts.length) });
    };
    return { attempts, fetchImpl };
  }
  async function stalledInstall(label, statusFor, retry = true) {
    const executable = fakeVersionExecutable('8.30.1');
    const { manifest } = syntheticInstallManifest(executable);
    const root = await ignoredRoot(label, manifest);
    const transport = stallingTransport(statusFor);
    const time = fakeTime();
    const started = performance.now();
    let error;
    try {
      await scanner.installGitleaks({ root, platform: 'linux', arch: 'x64', fetchImpl: transport.fetchImpl, retry, sleep: time.sleep, now: time.now });
    } catch (caught) {
      error = caught;
    }
    const elapsed = performance.now() - started;
    const chunksAtExit = transport.attempts.map((a) => a.chunks);
    await new Promise((resolve) => setTimeout(resolve, 100));
    return { error, elapsed, attempts: transport.attempts, chunksAtExit, sleeps: time.sleeps };
  }
  const settled = (attempts) => attempts.every((a) => a.signal.aborted && a.cancelled);

  test('a 5xx with a never-ending error body is aborted before each retry and before giving up', async () => {
    const run = await stalledInstall('retry-stalled-5xx', () => 504);
    assert.equal(run.error?.code, 'download-failed');
    assert.match(run.error.message, /gave up after 4 of 4 attempts$/);
    assert.equal(run.attempts.length, 4);
    assert.ok(run.attempts.every((a) => a.priorSettled), 'each attempt starts only after earlier ones were aborted and cancelled');
    assert.ok(settled(run.attempts), 'the final attempt is aborted and cancelled too');
    assert.ok(run.elapsed < 5_000, `the installer did not wait on the error bodies (${Math.round(run.elapsed)} ms)`);
    assert.deepEqual(run.attempts.map((a) => a.chunks), run.chunksAtExit, 'no body kept transferring after the installer returned');
    assert.deepEqual(run.sleeps, [...scanner.DOWNLOAD_RETRY_POLICY.delaysMs]);
  });

  test('a 4xx with a never-ending error body is aborted at once and not retried', async () => {
    const run = await stalledInstall('retry-stalled-4xx', () => 404);
    assert.equal(run.error?.code, 'download-failed');
    assert.equal(run.attempts.length, 1);
    assert.ok(settled(run.attempts));
    assert.deepEqual(run.attempts.map((a) => a.chunks), run.chunksAtExit);
    assert.deepEqual(run.sleeps, []);
  });

  test('without the opt-in a rejected response with a never-ending body is aborted too', async () => {
    const run = await stalledInstall('retry-stalled-off', () => 503, false);
    assert.equal(run.error?.code, 'download-failed');
    assert.equal(run.attempts.length, 1);
    assert.ok(settled(run.attempts));
    assert.deepEqual(run.attempts.map((a) => a.chunks), run.chunksAtExit);
  });

  test('with real fetch, a 504 whose body never ends has its connection closed before each retry and at exit', async () => {
    const requests = [];
    const server = createServer((request, reply) => {
      const entry = { closed: false, priorClosed: requests.every((r) => r.closed) };
      requests.push(entry);
      reply.writeHead(504, { 'content-type': 'text/plain' });
      const timer = setInterval(() => reply.write('.'), 20);
      reply.on('close', () => {
        clearInterval(timer);
        entry.closed = true;
      });
    });
    const loopback = ['127', '0', '0', '1'].join('.');
    await new Promise((resolve) => server.listen(0, loopback, resolve));
    const local = `http://${loopback}:${server.address().port}/archive`;
    const executable = fakeVersionExecutable('8.30.1');
    const { manifest } = syntheticInstallManifest(executable);
    const root = await ignoredRoot('retry-real-socket', manifest);
    const time = fakeTime();
    // A stand-in sleep that also yields long enough for a close to reach the server.
    const sleep = async (ms) => {
      await time.sleep(ms);
      await new Promise((resolve) => setTimeout(resolve, 100));
    };
    let error;
    try {
      await scanner.installGitleaks({ root, platform: 'linux', arch: 'x64', fetchImpl: (_url, init) => fetch(local, init), retry: true, sleep, now: time.now });
    } catch (caught) {
      error = caught;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
    assert.equal(error?.code, 'download-failed');
    assert.equal(requests.length, 4);
    assert.ok(requests.every((r) => r.priorClosed), 'every retry starts after the previous connection closed');
    assert.ok(requests.every((r) => r.closed), 'the last connection closed when the installer gave up');
  });

  test('the CLI accepts only VELCRO_GITLEAKS_DOWNLOAD_RETRY=1 or unset', async () => {
    const result = await runCli(['install'], { env: { VELCRO_GITLEAKS_DOWNLOAD_RETRY: 'yes' } });
    assert.equal(result.code, 2);
    assert.match(result.stderr, /VELCRO_GITLEAKS_DOWNLOAD_RETRY must be 1 or unset/);
  });
});

describe('scanner process handling (fake executables)', () => {
  const dir = scratch('fake');
  const target = scratch('fake-target');
  writeFileSync(path.join(target, 'readme.txt'), 'nothing here\n');

  test('clean report with exit 0 yields zero findings', async () => {
    const binary = fakeScanner(dir, fakeReportBody({ exit: 0, stdout: '[]\n' }));
    const result = await scanner.scanDir({ target, binary });
    assert.equal(result.findings.length, 0);
    const text = scanner.formatResult(result);
    assertIncludes(text, 'no findings', 'clean summary');
    assertIncludes(text, 'does not detect all', 'limitation note');
  });

  test('findings never expose file names, prefixes, or archive members', async () => {
    const token = syntheticToken();
    const email = syntheticEmail();
    const report = [
      findingJson({ Match: token, Secret: token, Line: `key = ${token}`, Author: 'Private Person', Email: email }),
      findingJson({ RuleID: 'generic-api-key', File: `${token}.txt`, StartLine: 9 }),
      findingJson({ File: `${email}/notes/${token}`, StartLine: 1 }),
      findingJson({ File: `bundle.tar.gz!${email}/.env`, StartLine: 2 }),
      findingJson({ File: path.join(homedir(), 'leaky', 'notes.txt'), StartLine: 4 }),
    ];
    const binary = fakeScanner(dir, fakeReportBody({ exit: scanner.LEAK_EXIT_CODE, stdout: JSON.stringify(report) }));
    const nested = path.join(target, 'nested');
    mkdirSync(nested, { recursive: true });
    const result = await scanner.scanDir({ target: path.relative(process.cwd(), nested) || '.', binary });
    assert.equal(result.findings.length, 5);
    const text = scanner.formatResult(result);
    const forbidden = [token, email, 'Private Person', 'nested', 'settings.txt', 'bundle.tar.gz', ...forbiddenFragments(target)];
    assertExcludes(text, forbidden, 'formatted findings');
    assertExcludes(JSON.stringify(result), forbidden, 'structured findings');
    assert.deepEqual(
      result.findings.map((finding) => Object.keys(finding).sort()),
      Array(5).fill(['commit', 'id', 'line', 'rule']),
    );
    assert.deepEqual(
      result.findings.map((finding) => finding.id),
      ['F1', 'F2', 'F3', 'F4', 'F5'],
    );
    assertIncludes(text, 'F1  github-pat  line 3', 'opaque location');
    assertIncludes(text, 'F2  generic-api-key  line 9', 'opaque location');
    assertIncludes(text, '5 findings', 'count');
    assertIncludes(text, '--write-locations', 'locating hint');
  });

  test('locations are recorded only in a caller-chosen private file', async () => {
    const token = syntheticToken();
    const report = [findingJson({ File: `${token}.txt`, StartLine: 2 })];
    const binary = fakeScanner(dir, fakeReportBody({ exit: scanner.LEAK_EXIT_CODE, stdout: JSON.stringify(report) }));
    const locationsFile = path.join(scratch('locations'), 'private', 'locations.json');
    const result = await scanner.scanDir({ target, binary, locationsFile });
    assert.equal(result.locationsRecorded, true);
    assertExcludes(JSON.stringify(result), [token, locationsFile], 'structured result');
    assert.equal(statSync(locationsFile).mode & 0o777, 0o600);
    const recorded = JSON.parse(readFileSync(locationsFile, 'utf8'));
    assert.equal(recorded.findings.length, 1);
    assert.equal(recorded.findings[0].id, 'F1');
    assert.equal(recorded.findings[0].path, `${token}.txt`);
    assert.equal(recorded.findings[0].line, 2);
  });

  const malformed = {
    'null entry': [null],
    'number entry': [7],
    'string entry': ['finding'],
    'array entry': [[]],
    'empty object': [{}],
    'missing rule': [findingJson({ RuleID: undefined })],
    'rule with spaces': [findingJson({ RuleID: 'bad rule' })],
    'non-string file': [findingJson({ File: 5 })],
    'empty file': [findingJson({ File: '' })],
    'negative line': [findingJson({ StartLine: -1 })],
    'fractional line': [findingJson({ StartLine: 1.5 })],
    'string line': [findingJson({ StartLine: '3' })],
    'malformed commit': [findingJson({ Commit: 'not-a-commit' })],
    'numeric commit': [findingJson({ Commit: 5 })],
  };
  for (const [label, report] of Object.entries(malformed)) {
    test(`malformed report entry (${label}) fails closed`, async () => {
      const token = syntheticToken();
      const withToken = report.map((entry) => (entry && typeof entry === 'object' && !Array.isArray(entry) ? { ...entry, Secret: token } : entry));
      const binary = fakeScanner(dir, fakeReportBody({ exit: scanner.LEAK_EXIT_CODE, stdout: JSON.stringify(withToken) }));
      await assert.rejects(scanner.scanDir({ target, binary }), (error) => {
        assert.equal(error.code, 'scanner-output-invalid');
        assertExcludes(`${error.message}\n${error.stack}`, [token], 'malformed entry');
        return true;
      });
    });
  }

  const failures = {
    'generic error exit 1': { body: fakeReportBody({ exit: 1, stdout: '[]' }), code: 'scanner-failed' },
    'unknown flag exit 126': { body: fakeReportBody({ exit: 126, stdout: '' }), code: 'scanner-failed' },
    'arbitrary exit 7': { body: fakeReportBody({ exit: 7, stdout: '[]' }), code: 'scanner-failed' },
    'clean exit with findings': {
      body: fakeReportBody({ exit: 0, stdout: JSON.stringify([findingJson()]) }),
      code: 'scanner-output-invalid',
    },
    'leak exit without findings': { body: fakeReportBody({ exit: 99, stdout: '[]' }), code: 'scanner-output-invalid' },
    'invalid JSON': { body: fakeReportBody({ exit: 0, stdout: 'not json' }), code: 'scanner-output-invalid' },
    'non-array JSON': { body: fakeReportBody({ exit: 0, stdout: '{}' }), code: 'scanner-output-invalid' },
    'empty output': { body: fakeReportBody({ exit: 0, stdout: '' }), code: 'scanner-output-invalid' },
    'killed by signal': { body: fakeReportBody({ signal: true }), code: 'scanner-failed' },
  };
  for (const [label, { body, code }] of Object.entries(failures)) {
    test(`fails closed on ${label}`, async () => {
      const binary = fakeScanner(dir, body);
      await expectSafeError(scanner.scanDir({ target, binary }), code);
    });
  }

  test('raw scanner stderr and stdout never reach error messages', async () => {
    const token = syntheticToken();
    const binary = fakeScanner(
      dir,
      `process.stderr.write(${JSON.stringify(`${token} ${homedir()}`)}); process.stdout.write(${JSON.stringify(`garbage ${token}`)}, () => process.exit(1));`,
    );
    await assert.rejects(scanner.scanDir({ target, binary }), (error) => {
      assertExcludes(`${error.message}\n${error.stack}`, [token, homedir()], 'scanner error');
      return true;
    });
  });

  test('times out and fails closed', async () => {
    const binary = fakeScanner(dir, fakeReportBody({ sleep: true }));
    const started = Date.now();
    await expectSafeError(scanner.scanDir({ target, binary, timeoutMs: 500 }), 'scanner-timeout');
    assert.ok(Date.now() - started < 15_000, 'timeout was not enforced promptly');
  });

  test('oversized scanner output fails closed', async () => {
    const binary = fakeScanner(dir, `process.stdout.write('['.repeat(1 << 20), () => process.exit(0));`);
    await expectSafeError(scanner.scanDir({ target, binary, maxOutputBytes: 64 * 1024 }), 'scanner-output-too-large');
  });

  test('oversized scanner diagnostics fail closed', async () => {
    const binary = fakeScanner(dir, fakeReportBody({ exit: 0, stderr: diag('TRC', 'scanning path path=x').repeat(20_000) }));
    await expectSafeError(scanner.scanDir({ target, binary, maxOutputBytes: 64 * 1024 }), 'scanner-output-too-large');
  });

  test('a binary that does not match its pinned hash is never executed', async () => {
    const marker = path.join(dir, `ran-${randomBytes(4).toString('hex')}`);
    const binary = fakeScanner(dir, fakeReportBody({ marker }));
    await expectSafeError(scanner.scanDir({ target, binary: { ...binary, sha256: '0'.repeat(64) } }), 'binary-checksum-mismatch');
    assert.equal(existsSync(marker), false);
  });

  test('missing and symlinked binaries fail closed', async () => {
    await expectSafeError(
      scanner.scanDir({ target, binary: { path: path.join(dir, 'does-not-exist'), sha256: '0'.repeat(64) } }),
      'binary-missing',
    );
    const real = fakeScanner(dir, fakeReportBody({ exit: 0 }));
    const link = path.join(dir, `link-${randomBytes(4).toString('hex')}`);
    symlinkSync(real.path, link);
    await expectSafeError(scanner.scanDir({ target, binary: { path: link, sha256: real.sha256 } }), 'binary-missing');
  });

  test('archive traversal is not offered through the API', async () => {
    const binary = fakeScanner(dir, fakeReportBody({ exit: 0 }));
    await expectSafeError(scanner.scanDir({ target, binary, maxArchiveDepth: 1 }), 'usage');
  });

  function assertTrustedGitEnv(env) {
    const gitKeys = Object.keys(env).filter((key) => key.startsWith('GIT_'));
    const allowed = /^(?:GIT_NO_REPLACE_OBJECTS|GIT_CONFIG_NOSYSTEM|GIT_CONFIG_GLOBAL|GIT_ATTR_NOSYSTEM|GIT_GRAFT_FILE|GIT_CONFIG_COUNT|GIT_CONFIG_(?:KEY|VALUE)_\d+)$/;
    for (const key of gitKeys) assert.ok(allowed.test(key), `unexpected Git variable ${key}`);
    assert.equal(env.GIT_NO_REPLACE_OBJECTS, '1');
    assert.equal(env.GIT_CONFIG_NOSYSTEM, '1');
    assert.equal(env.GIT_CONFIG_GLOBAL, devNull);
    assert.equal(env.GIT_ATTR_NOSYSTEM, '1');
    assert.ok(env.GIT_GRAFT_FILE && !existsSync(env.GIT_GRAFT_FILE), 'graft file must point at a missing path');
    const count = Number(env.GIT_CONFIG_COUNT);
    const config = {};
    for (let i = 0; i < count; i += 1) config[env[`GIT_CONFIG_KEY_${i}`]] = env[`GIT_CONFIG_VALUE_${i}`];
    const expected = {
      'core.attributesFile': devNull,
      'core.fsmonitor': 'false',
      'diff.external': '',
      'diff.noprefix': 'false',
      'diff.mnemonicPrefix': 'false',
      'diff.relative': 'false',
      'diff.renames': 'false',
      'color.ui': 'never',
      'color.diff': 'never',
      'format.pretty': 'medium',
      'log.abbrevCommit': 'false',
      'log.decorate': 'no',
      'log.showRoot': 'true',
      'log.showSignature': 'false',
      'advice.graftFileDeprecated': 'false',
    };
    for (const [key, value] of Object.entries(expected)) assert.equal(config[key], value, `config ${key}`);
  }

  test('dir scans run hardened with a trusted config and a scrubbed environment', async () => {
    const record = path.join(dir, `record-${randomBytes(4).toString('hex')}.json`);
    const binary = fakeScanner(dir, fakeReportBody({ exit: 0, record }));
    await withEnv(
      {
        GITLEAKS_CONFIG: path.join(target, 'hostile.toml'),
        GITLEAKS_CONFIG_TOML: '[extend]\nuseDefault = false\n',
        GIT_DIR: path.join(target, 'elsewhere'),
        GIT_EXTERNAL_DIFF: 'hostile',
      },
      () => scanner.scanDir({ target, binary, maxDecodeDepth: 2, timeoutMs: 30_000 }),
    );
    const seen = JSON.parse(readFileSync(record, 'utf8'));
    const { argv } = seen;
    assert.equal(argv[0], 'dir');
    const flag = (name) => argv[argv.indexOf(name) + 1];
    for (const name of ['--no-banner', '--ignore-gitleaks-allow', '--config', '--gitleaks-ignore-path']) {
      assert.ok(argv.includes(name), `missing ${name}`);
    }
    assert.ok(argv.includes('--redact') || argv.includes('--redact=100'), 'missing --redact');
    assert.equal(flag('--report-format'), 'json');
    assert.equal(flag('--report-path'), '-');
    assert.equal(flag('--exit-code'), String(scanner.LEAK_EXIT_CODE));
    assert.equal(flag('--max-decode-depth'), '2');
    assert.equal(flag('--max-archive-depth'), '0');
    assert.equal(flag('--log-level'), 'trace');
    assert.equal(flag('--timeout'), '30');
    assert.equal(argv.includes('--follow-symlinks'), false);
    assert.equal(argv.includes('--baseline-path'), false);
    assert.equal(argv.includes('--max-target-megabytes'), false);
    assert.equal(argv.at(-2), '--');
    assert.equal(argv.at(-1), '.');
    assert.match(seen.config, /useDefault\s*=\s*true/);
    assert.doesNotMatch(seen.config, /allowlist|disabledRules/i);
    assert.equal(seen.env.GITLEAKS_CONFIG, undefined);
    assert.equal(seen.env.GITLEAKS_CONFIG_TOML, undefined);
    assertTrustedGitEnv(seen.env);
    const workspace = path.dirname(flag('--config'));
    assert.equal(seen.env.TMPDIR, workspace, 'scanner temp files must land in the private workspace');
    assert.equal(realpathSync(seen.cwd), realpathSync(target));
    assert.equal(existsSync(workspace), false, 'private workspace not removed');
  });

  test('git scans default to publishable refs with forced text and no drivers', async () => {
    const repo = await initRepo('fake-git');
    await commitFile(repo, 'a.txt', 'a\n', 'first');
    await git(repo, 'tag', 'v0');
    const record = path.join(dir, `record-${randomBytes(4).toString('hex')}.json`);
    const binary = fakeScanner(dir, fakeReportBody({ exit: 0, record }));
    const result = await withEnv({ GIT_DIR: path.join(dir, 'elsewhere') }, () => scanner.scanGit({ repo, binary }));
    assert.equal(result.commits, 1);
    const { argv, env } = JSON.parse(readFileSync(record, 'utf8'));
    assert.equal(argv[0], 'git');
    const flag = (name) => argv[argv.indexOf(name) + 1];
    assert.equal(flag('--platform'), 'none');
    assert.equal(flag('--max-archive-depth'), '0');
    const logOpts = argv.find((arg) => arg.startsWith('--log-opts='));
    assert.ok(logOpts, 'missing --log-opts');
    const opts = logOpts.slice('--log-opts='.length).split(' ');
    for (const required of ['--branches', '--tags', '--diff-merges=first-parent', '--text', '--no-textconv', '--no-ext-diff']) {
      assert.ok(opts.includes(required), `missing ${required}`);
    }
    for (const forbidden of ['--all', '--reflog', '-g', '--walk-reflogs', '--remotes']) {
      assert.equal(opts.includes(forbidden), false, `must not use ${forbidden}`);
    }
    assertTrustedGitEnv(env);
    assert.equal(argv.at(-2), '--');
  });

  test('git ranges are resolved to full commit ids before reaching the scanner', async () => {
    const repo = await initRepo('fake-range');
    const first = await commitFile(repo, 'a.txt', 'a\n', 'first');
    const second = await commitFile(repo, 'b.txt', 'b\n', 'second');
    const record = path.join(dir, `record-${randomBytes(4).toString('hex')}.json`);
    const binary = fakeScanner(dir, fakeReportBody({ exit: 0, record }));
    const result = await scanner.scanGit({ repo, range: 'HEAD~1..main', binary });
    assert.equal(result.commits, 1);
    const { argv } = JSON.parse(readFileSync(record, 'utf8'));
    const logOpts = argv.find((arg) => arg.startsWith('--log-opts='));
    const opts = logOpts.slice('--log-opts='.length).split(' ');
    assert.ok(opts.includes(`${first}..${second}`), 'range not resolved to commit ids');
    assert.equal(opts.includes('--branches'), false);
  });
});

describe('scanner diagnostics classification (fake executables)', { concurrency: TEST_CONCURRENCY }, () => {
  const dir = scratch('diag');
  const target = scratch('diag-target');
  writeFileSync(path.join(target, 'readme.txt'), 'nothing here\n');

  test('benign trace and debug lines are accepted', async () => {
    const stderr = [
      '\u001b[90m2:04AM\u001b[0m DBG using gitleaks config from `--config`\n',
      diag('DBG', 'extending config with default config'),
      diag('TRC', 'scanning path path=readme.txt'),
      diag('DBG', 'skipping empty file path=empty.txt'),
      diag('DBG', 'skipping symlink: follow symlinks disabled path=link'),
      diag('TRC', 'skipping finding: low entropy entropy=2.1 finding=x path=readme.txt rule-id=generic-api-key'),
      diag('TRC', 'skipping finding: rule allowlist allowed-stopword=x path=readme.txt rule-id=generic-api-key'),
      diag('TRC', 'skipping finding: global allowlist path=readme.txt'),
      diag('TRC', 'skipping generic-api-key finding (x), github-pat rule takes precedence (y)'),
      diag('DBG', 'segment found: original=[1,2] pos=[1,2]: "a" -> "b" decoder=percent'),
      diag('INF', 'scanned ~13 bytes (13 bytes) in 1ms'),
      diag('INF', 'no leaks found'),
    ].join('');
    const binary = fakeScanner(dir, fakeReportBody({ exit: 0, stderr }));
    const result = await scanner.scanDir({ target, binary });
    assert.equal(result.findings.length, 0);
    assert.equal(result.excluded, 0);
  });

  test('stock allowlist exclusions are counted and disclosed, not hidden', async () => {
    const stderr = [
      diag('TRC', 'skipping file: global allowlist allowed-path=x path=img.png'),
      diag('DBG', 'skipping directory: global allowlist path=node_modules'),
      diag('TRC', 'skipping file: global allowlist allowed-path=x path=pnpm-lock.yaml'),
    ].join('');
    const binary = fakeScanner(dir, fakeReportBody({ exit: 0, stderr }));
    const result = await scanner.scanDir({ target, binary });
    assert.equal(result.excluded, 3);
    const text = scanner.formatResult(result);
    assertIncludes(text, '3 paths excluded by the stock Gitleaks path allowlist', 'exclusion disclosure');
    assertExcludes(text, ['img.png', 'node_modules', 'pnpm-lock'], 'exclusion disclosure');
  });

  test('a leak summary warning accompanies findings without failing', async () => {
    const binary = fakeScanner(
      dir,
      fakeReportBody({ exit: scanner.LEAK_EXIT_CODE, stdout: JSON.stringify([findingJson()]), stderr: diag('WRN', 'leaks found: 1') }),
    );
    const result = await scanner.scanDir({ target, binary });
    assert.equal(result.findings.length, 1);
  });

  const failing = {
    'permission-denied directory': [diag('WRN', 'skipping directory error="permission denied" path=locked'), 'scan-incomplete'],
    'permission-denied file': [diag('WRN', 'skipping file: permission denied path=locked.txt'), 'scan-incomplete'],
    'walk error': [diag('WRN', 'skipping error="boom" path=x'), 'scan-incomplete'],
    'read error': [diag('ERR', 'could read compressed file path=x.gz'), 'scan-incomplete'],
    'binary file skipped': [diag('DBG', 'skipping binary file mime_type=application/pdf path=x.txt'), 'content-unsupported'],
    'archive skipped': [diag('TRC', 'skipping archive: exceeds max archive depth max_archive_depth=0 path=a.zip'), 'content-unsupported'],
    'unknown archive skipped': [diag('WRN', 'skipping unknown archive type path=a.foo'), 'content-unsupported'],
    'oversized fragment skipped': [diag('DBG', 'skipping fragment: size size=9 max-size=1'), 'scan-incomplete'],
    'fingerprint suppression': [diag('DBG', 'skipping finding: fingerprint'), 'scan-incomplete'],
    'allow-comment suppression': [diag('TRC', "skipping finding: 'gitleaks:allow' signature"), 'scan-incomplete'],
    'config path skip': [diag('TRC', 'skipping file: matches config or baseline path'), 'scan-incomplete'],
    'unexpected warning': [diag('WRN', 'something unexpected'), 'scan-incomplete'],
    'fatal line': [diag('FTL', 'boom'), 'scan-incomplete'],
    'git stderr': [diag('ERR', '[git] fatal: bad object'), 'scan-incomplete'],
    'unparseable line': ['this is not a log line\n', 'scan-incomplete'],
  };
  for (const [label, [stderr, code]] of Object.entries(failing)) {
    test(`clean exit with ${label} fails closed`, async () => {
      const token = syntheticToken();
      const binary = fakeScanner(dir, fakeReportBody({ exit: 0, stderr: stderr.replace(/\n$/, ` extra=${token}\n`) }));
      await assert.rejects(scanner.scanDir({ target, binary }), (error) => {
        assert.equal(error.code, code);
        assertExcludes(`${error.message}\n${error.stack}`, [token], 'diagnostic failure');
        return true;
      });
    });
  }
});

describe('dir target completeness (fake executables)', { skip: ROOT_SKIP, concurrency: TEST_CONCURRENCY }, () => {
  const dir = scratch('walk');

  async function expectRefusedWithoutRunning(target, code, options = {}) {
    const marker = path.join(dir, `ran-${randomBytes(4).toString('hex')}`);
    const binary = fakeScanner(dir, fakeReportBody({ exit: 0, marker }));
    await expectSafeError(scanner.scanDir({ target, binary, ...options }), code);
    assert.equal(existsSync(marker), false, 'scanner ran on an incomplete target');
  }

  test('an unreadable nested file fails closed', async () => {
    const target = scratch('walk-file');
    mkdirSync(path.join(target, 'deep', 'er'), { recursive: true });
    writeFileSync(path.join(target, 'deep', 'er', 'secret.txt'), 'x\n');
    chmodSync(path.join(target, 'deep', 'er', 'secret.txt'), 0);
    await expectRefusedWithoutRunning(target, 'target-unreadable');
  });

  test('an unreadable subtree fails closed', async () => {
    const target = scratch('walk-dir');
    mkdirSync(path.join(target, 'locked'));
    writeFileSync(path.join(target, 'locked', 'secret.txt'), 'x\n');
    chmodSync(path.join(target, 'locked'), 0);
    await expectRefusedWithoutRunning(target, 'target-unreadable');
  });

  test('an unreadable explicit file target fails closed', async () => {
    const target = path.join(scratch('walk-explicit'), 'secret.txt');
    writeFileSync(target, 'x\n');
    chmodSync(target, 0);
    await expectRefusedWithoutRunning(target, 'target-unreadable');
  });

  test('traversal is bounded', async () => {
    const target = scratch('walk-bound');
    for (let i = 0; i < 6; i += 1) writeFileSync(path.join(target, `f${i}.txt`), 'x\n');
    await expectRefusedWithoutRunning(target, 'target-too-large', { maxTraversalEntries: 3 });
  });

  test('symlinks and special files are neither followed nor opened', { timeout: 20_000 }, async () => {
    const target = scratch('walk-special');
    writeFileSync(path.join(target, 'ok.txt'), 'x\n');
    const outside = path.join(scratch('walk-outside'), 'locked.txt');
    writeFileSync(outside, 'x\n');
    chmodSync(outside, 0);
    symlinkSync(outside, path.join(target, 'link.txt'));
    execFileSync('mkfifo', [path.join(target, 'pipe')]);
    const binary = fakeScanner(dir, fakeReportBody({ exit: 0 }));
    const result = await scanner.scanDir({ target, binary });
    assert.equal(result.findings.length, 0);
  });
});

describe('CLI input validation', { concurrency: TEST_CONCURRENCY }, () => {
  const cleanDir = scratch('cli-clean');
  writeFileSync(path.join(cleanDir, 'ok.txt'), 'ok\n');

  function assertSafeFailure(result, context) {
    assert.equal(result.code, 2, `${context}: expected exit 2`);
    assertExcludes(result.output, forbiddenFragments(cleanDir), context);
  }

  test('usage errors exit 2', async () => {
    assertSafeFailure(await runCli([]), 'no command');
    assertSafeFailure(await runCli(['frobnicate']), 'unknown command');
    assertSafeFailure(await runCli(['dir']), 'missing dir target');
    assertSafeFailure(await runCli(['dir', cleanDir, 'extra']), 'extra argument');
    assertSafeFailure(await runCli(['dir', cleanDir, '--unknown']), 'unknown option');
    assertSafeFailure(await runCli(['git']), 'missing repo');
    assertSafeFailure(await runCli(['install', '--write-locations']), 'install flag');
  });

  for (const value of ['-1', 'abc', '999', '1.5', '']) {
    test(`rejects decode depth value ${JSON.stringify(value)}`, async () => {
      assertSafeFailure(await runCli(['dir', cleanDir, '--max-decode-depth', value]), 'decode depth');
    });
  }

  test('archive traversal is explicitly unsupported', async () => {
    for (const args of [
      ['dir', cleanDir, '--max-archive-depth', '2'],
      ['dir', cleanDir, '--max-archive-depth=0'],
      ['git', repoRoot, '--max-archive-depth', '1'],
    ]) {
      const result = await runCli(args);
      assertSafeFailure(result, 'archive depth');
      assertIncludes(result.stderr, 'archive', 'archive explanation');
    }
  });

  test('rejects timeout values outside the bounded range', async () => {
    for (const value of ['0', '-5', '100000', 'soon']) {
      assertSafeFailure(await runCli(['dir', cleanDir, '--timeout', value]), 'timeout');
    }
  });

  test('nonexistent targets fail without echoing the path', async () => {
    const missing = path.join(cleanDir, 'missing', 'deeper');
    const result = await runCli(['dir', missing]);
    assertSafeFailure(result, 'missing dir');
    assertExcludes(result.output, [missing], 'missing dir');
  });

  test('shell metacharacters in inputs are never interpreted', async () => {
    const marker = path.join(cleanDir, 'pwned');
    const hostile = `$(touch ${marker})`;
    assertSafeFailure(await runCli(['dir', hostile]), 'hostile dir');
    const repo = await initRepo('cli-hostile');
    await commitFile(repo, 'a.txt', 'a\n', 'first');
    assertSafeFailure(await runCli(['git', repo, `HEAD;touch ${marker}`]), 'hostile range');
    assertSafeFailure(await runCli(['git', hostile]), 'hostile repo');
    assert.equal(existsSync(marker), false);
  });

  test('unsafe or reflog revision ranges are rejected', async () => {
    const repo = await initRepo('cli-ranges');
    await commitFile(repo, 'a.txt', 'a\n', 'first');
    await commitFile(repo, 'b.txt', 'b\n', 'second');
    for (const range of [
      '--output=evil',
      '-p',
      'HEAD@{1}',
      '@{-1}',
      'main:a.txt',
      'HEAD~1..HEAD..main',
      'HEAD main',
      'does-not-exist',
      'HEAD..does-not-exist',
      '--all',
    ]) {
      const result = await runCli(['git', repo, range]);
      assert.equal(result.code, 2, `range ${JSON.stringify(range)} should be rejected`);
      assertExcludes(result.output, [repo], 'range rejection');
    }
  });

  test('suppression files in the target refuse the scan', async () => {
    const dirTarget = scratch('cli-ignorefile');
    writeFileSync(path.join(dirTarget, 'ok.txt'), 'ok\n');
    writeFileSync(path.join(dirTarget, '.gitleaksignore'), 'anything\n');
    const result = await runCli(['dir', dirTarget]);
    assert.equal(result.code, 2);
    assertIncludes(result.stderr, '.gitleaksignore', 'suppression explanation');

    const repo = await initRepo('cli-ignorefile-git');
    await commitFile(repo, 'a.txt', 'a\n', 'first');
    writeFileSync(path.join(repo, '.gitleaksignore'), 'anything\n');
    assert.equal((await runCli(['git', repo])).code, 2);
  });

  test('symlinked dir target is refused', async () => {
    const link = path.join(scratch('cli-link'), 'link');
    symlinkSync(cleanDir, link);
    assertSafeFailure(await runCli(['dir', link]), 'symlink target');
  });

  test('non-repositories, shallow clones, and repositories without refs fail closed', async () => {
    assertSafeFailure(await runCli(['git', cleanDir]), 'not a repository');

    const empty = await initRepo('cli-empty');
    assertSafeFailure(await runCli(['git', empty]), 'no publishable refs');

    const source = await initRepo('cli-shallow-source');
    await commitFile(source, 'a.txt', 'a\n', 'first');
    await commitFile(source, 'b.txt', 'b\n', 'second');
    const shallow = path.join(scratch('cli-shallow'), 'clone');
    await git(path.dirname(shallow), 'clone', '-q', '--depth', '1', pathToFileURL(source).href, shallow);
    assertSafeFailure(await runCli(['git', shallow]), 'shallow clone');
  });

  test('legacy grafts are refused', async () => {
    const repo = await initRepo('cli-grafts');
    const first = await commitFile(repo, 'a.txt', 'a\n', 'first');
    await commitFile(repo, 'b.txt', 'b\n', 'second');
    mkdirSync(path.join(repo, '.git', 'info'), { recursive: true });
    writeFileSync(path.join(repo, '.git', 'info', 'grafts'), `${first}\n`);
    const result = await runCli(['git', repo]);
    assertSafeFailure(result, 'grafts');
    assertIncludes(result.stderr, 'grafts', 'grafts explanation');
  });

  test('archive blobs in scanned history are refused rather than reported clean', async () => {
    const repo = await initRepo('cli-git-archive');
    const base = await commitFile(repo, 'a.txt', 'a\n', 'first');
    mkdirSync(path.join(repo, 'fixtures'));
    writeFileSync(path.join(repo, 'fixtures', 'bundle.tar.gz'), tarArchive([{ name: 'inner.txt', data: 'x\n' }]));
    await git(repo, 'add', '--', 'fixtures/bundle.tar.gz');
    await git(repo, 'commit', '-q', '-m', 'add archive');
    await git(repo, 'rm', '-q', '--', 'fixtures/bundle.tar.gz');
    await git(repo, 'commit', '-q', '-m', 'remove archive');
    for (const args of [['git', repo], ['git', repo, `${base}..main`]]) {
      const result = await runCli(args);
      assertSafeFailure(result, 'archive history');
      assertIncludes(result.stderr, 'archive', 'archive explanation');
      assertExcludes(result.output, ['bundle.tar.gz', 'fixtures'], 'archive history');
    }
  });

  test('--write-locations refuses a scratch location Git does not ignore', async () => {
    const root = scratch('cli-locations-unignored');
    mkdirSync(path.join(root, 'scripts', 'security'), { recursive: true });
    mkdirSync(path.join(root, 'security'));
    copyFileSync(scriptPath, path.join(root, 'scripts', 'security', 'gitleaks.mjs'));
    copyFileSync(manifestPath, path.join(root, 'security', 'gitleaks-checksums.json'));
    const result = await runCli(['dir', cleanDir, '--write-locations'], { script: path.join(root, 'scripts', 'security', 'gitleaks.mjs') });
    assertSafeFailure(result, 'unignored locations');
  });
});

describe('CLI binary integrity', { concurrency: TEST_CONCURRENCY }, () => {
  function relocatedLayout() {
    const root = scratch('layout');
    mkdirSync(path.join(root, 'scripts', 'security'), { recursive: true });
    mkdirSync(path.join(root, 'security'), { recursive: true });
    copyFileSync(scriptPath, path.join(root, 'scripts', 'security', 'gitleaks.mjs'));
    copyFileSync(manifestPath, path.join(root, 'security', 'gitleaks-checksums.json'));
    return { root, script: path.join(root, 'scripts', 'security', 'gitleaks.mjs') };
  }

  const cleanDir = scratch('integrity-target');
  writeFileSync(path.join(cleanDir, 'ok.txt'), 'ok\n');

  test('missing binary fails closed with an install hint', async () => {
    const { script } = relocatedLayout();
    const result = await runCli(['dir', cleanDir], { script });
    assert.equal(result.code, 2);
    assertIncludes(result.stderr, 'gitleaks.mjs install', 'install hint');
    assertExcludes(result.output, forbiddenFragments(), 'missing binary');
  });

  test('a wrong binary at the pinned location is never executed', async () => {
    const { root, script } = relocatedLayout();
    const manifest = scanner.loadManifest(root);
    const target = scanner.selectTarget(manifest, process.platform, process.arch);
    const location = path.join(root, target.relativeExecutable);
    mkdirSync(path.dirname(location), { recursive: true });
    const marker = path.join(root, 'wrong-binary-ran');
    writeFileSync(location, `#!${process.execPath}\nrequire('node:fs').writeFileSync(${JSON.stringify(marker)}, 'x');\n`);
    chmodSync(location, 0o755);
    for (const args of [['dir', cleanDir], ['version']]) {
      const result = await runCli(args, { script });
      assert.equal(result.code, 2);
      assertIncludes(result.stderr, 'checksum', 'checksum explanation');
      assertExcludes(result.output, forbiddenFragments(), 'wrong binary');
    }
    assert.equal(existsSync(marker), false);
  });

  test('malformed manifest is an infrastructure failure', async () => {
    const { root, script } = relocatedLayout();
    writeFileSync(path.join(root, 'security', 'gitleaks-checksums.json'), '{');
    const result = await runCli(['dir', cleanDir], { script });
    assert.equal(result.code, 2);
  });
});

// ---------------------------------------------------------------------------
// Real pinned scanner. Run `node scripts/security/gitleaks.mjs install` first.
// Set VELCRO_REQUIRE_GITLEAKS=1 (as CI must) to turn a missing binary into a failure.

function realBinaryState() {
  try {
    const manifest = scanner.loadManifest(repoRoot);
    const target = scanner.selectTarget(manifest, process.platform, process.arch);
    const location = path.join(repoRoot, target.relativeExecutable);
    if (!existsSync(location)) return { available: false, reason: 'pinned gitleaks is not installed' };
    return { available: true, location, target };
  } catch (error) {
    return { available: false, reason: error?.code ?? 'unavailable' };
  }
}

const real = realBinaryState();
const requireReal = process.env.VELCRO_REQUIRE_GITLEAKS === '1';

test('real scanner availability', { skip: !real.available && !requireReal ? real.reason : false }, async () => {
  assert.ok(real.available, `required real scanner missing: ${real.reason}`);
});

function tokenLine(token = syntheticToken()) {
  return `token = "${token}"\n`;
}

// These suites change no process-wide state and every test owns its scratch files, so their tests run concurrently.
describe('real pinned scanner', { skip: real.available ? false : real.reason, concurrency: TEST_CONCURRENCY }, () => {
  test('version reports the pinned release with a verified checksum', async () => {
    const result = await runCli(['version']);
    assert.equal(result.code, 0);
    assertIncludes(result.stdout, 'gitleaks 8.30.1', 'version');
    assertIncludes(result.stdout, 'sha256 verified', 'checksum evidence');
  });

  test('install is idempotent and re-verifies the existing executable', async () => {
    const result = await runCli(['install']);
    assert.equal(result.code, 0);
    assertIncludes(result.stdout, '8.30.1', 'install version');
    assertIncludes(result.stdout, 'verified', 'install verification');
    assertExcludes(result.output, forbiddenFragments(repoRoot), 'install output');
  });

  test('dir: rejects a synthesized token without printing it or its file name', async () => {
    const token = syntheticToken();
    const dir = scratch('real-dir-leak');
    mkdirSync(path.join(dir, 'conf'));
    writeFileSync(path.join(dir, 'conf', 'settings.txt'), `first line\n${tokenLine(token)}`);
    const result = await runCli(['dir', dir]);
    assert.equal(result.code, 1);
    assertIncludes(result.stdout, 'F1  github-pat  line 2', 'opaque finding');
    assertExcludes(result.output, [token, 'settings.txt', 'conf/', ...forbiddenFragments(dir)], 'dir leak output');
  });

  test('dir: credential- and email-shaped file names are never echoed', async () => {
    const token = syntheticToken();
    const email = syntheticEmail();
    const dir = scratch('real-dir-names');
    writeFileSync(path.join(dir, `${token}.txt`), tokenLine());
    mkdirSync(path.join(dir, email));
    writeFileSync(path.join(dir, email, 'notes.txt'), tokenLine());
    const result = await runCli(['dir', dir]);
    assert.equal(result.code, 1);
    assertIncludes(result.stdout, '2 findings', 'both findings');
    assertExcludes(result.output, [token, email, 'notes.txt'], 'hostile file names');
  });

  test('dir: accepts a clean fixture', async () => {
    const dir = scratch('real-dir-clean');
    writeFileSync(path.join(dir, 'readme.md'), '# Clean\n\nImport from `@charm-ux/velcro`.\n');
    const result = await runCli(['dir', dir]);
    assert.equal(result.code, 0);
    assertIncludes(result.stdout, 'no findings', 'clean summary');
  });

  test('dir: scans an explicit single file target', async () => {
    const file = path.join(scratch('real-dir-single'), 'single.txt');
    writeFileSync(file, tokenLine());
    assert.equal((await runCli(['dir', file])).code, 1);
  });

  test('dir: inline allow comments cannot suppress findings', async () => {
    const token = syntheticToken();
    const dir = scratch('real-dir-allow');
    writeFileSync(path.join(dir, 'a.txt'), `token = "${token}" # gitleaks:allow\n`);
    const result = await runCli(['dir', dir]);
    assert.equal(result.code, 1);
    assertIncludes(result.stdout, 'github-pat', 'allow-commented rule');
    assertExcludes(result.output, [token], 'allow comment output');
  });

  test('dir: a target .gitleaks.toml cannot disable default rules', async () => {
    const token = syntheticToken();
    const dir = scratch('real-dir-config');
    writeFileSync(path.join(dir, 'a.txt'), `${token}\n`);
    writeFileSync(
      path.join(dir, '.gitleaks.toml'),
      '[extend]\nuseDefault = true\ndisabledRules = ["github-pat", "generic-api-key"]\n',
    );
    const result = await runCli(['dir', dir]);
    assert.equal(result.code, 1);
    assertIncludes(result.stdout, 'github-pat', 'disabled rule still applied');
    assertExcludes(result.output, [token], 'config override output');
  });

  test('dir: decode depth finds encoded tokens and is configurable', async () => {
    const token = syntheticToken();
    const dir = scratch('real-dir-decode');
    writeFileSync(path.join(dir, 'blob.txt'), `data: ${Buffer.from(`token = "${token}"`).toString('base64')}\n`);
    const encoded = await runCli(['dir', dir]);
    assert.equal(encoded.code, 1);
    assertExcludes(encoded.output, [token], 'decoded output');
    assert.equal((await runCli(['dir', dir, '--max-decode-depth', '0'])).code, 0);
  });

  test('dir: archives are refused rather than reported clean', async () => {
    for (const name of ['bundle.tar.gz', 'bundle.tgz', 'bundle.zip']) {
      const dir = scratch('real-dir-archive');
      writeFileSync(path.join(dir, 'ok.txt'), 'ok\n');
      writeFileSync(path.join(dir, name), tarArchive([{ name: 'inner/settings.txt', data: tokenLine() }]));
      const result = await runCli(['dir', dir]);
      assert.equal(result.code, 2, `${name} should be refused`);
      assertIncludes(result.stderr, 'archive or binary', 'unsupported content explanation');
      assertExcludes(result.output, [name], 'archive name');
    }
  });

  test('dir: binary-typed files are refused rather than reported clean', async () => {
    const dir = scratch('real-dir-binary');
    writeFileSync(path.join(dir, 'looks-like-text.txt'), `%PDF-1.4\n${tokenLine()}`);
    const result = await runCli(['dir', dir]);
    assert.equal(result.code, 2);
    assertIncludes(result.stderr, 'archive or binary', 'unsupported content explanation');
  });

  test('dir: stock allowlisted paths are disclosed as not inspected', async () => {
    const dir = scratch('real-dir-allowlisted');
    mkdirSync(path.join(dir, 'node_modules', 'pkg'), { recursive: true });
    writeFileSync(path.join(dir, 'node_modules', 'pkg', 'index.js'), tokenLine());
    writeFileSync(path.join(dir, 'ok.txt'), 'ok\n');
    const result = await runCli(['dir', dir]);
    assert.equal(result.code, 0);
    assertIncludes(result.stdout, '1 path excluded by the stock Gitleaks path allowlist', 'exclusion disclosure');
    assertExcludes(result.output, ['node_modules'], 'exclusion disclosure');
  });

  test('dir: unreadable files and subtrees fail closed', { skip: ROOT_SKIP }, async () => {
    const fileCase = scratch('real-dir-unreadable-file');
    writeFileSync(path.join(fileCase, 'ok.txt'), 'ok\n');
    writeFileSync(path.join(fileCase, 'locked.txt'), tokenLine());
    chmodSync(path.join(fileCase, 'locked.txt'), 0);
    const dirCase = scratch('real-dir-unreadable-dir');
    mkdirSync(path.join(dirCase, 'locked'));
    writeFileSync(path.join(dirCase, 'locked', 'a.txt'), tokenLine());
    chmodSync(path.join(dirCase, 'locked'), 0);
    for (const target of [fileCase, dirCase, path.join(fileCase, 'locked.txt')]) {
      const result = await runCli(['dir', target]);
      assert.equal(result.code, 2);
      assertIncludes(result.stderr, 'unreadable', 'unreadable explanation');
      assertExcludes(result.output, ['locked'], 'unreadable output');
    }
  });

  test('dir: --write-locations records names only in ignored scratch', async () => {
    const root = scratch('real-locations');
    await git(root, 'init', '-q');
    writeFileSync(path.join(root, '.gitignore'), '.airig/\n');
    mkdirSync(path.join(root, 'scripts', 'security'), { recursive: true });
    mkdirSync(path.join(root, 'security'));
    const script = path.join(root, 'scripts', 'security', 'gitleaks.mjs');
    copyFileSync(scriptPath, script);
    copyFileSync(manifestPath, path.join(root, 'security', 'gitleaks-checksums.json'));
    const binary = path.join(root, real.target.relativeExecutable);
    mkdirSync(path.dirname(binary), { recursive: true });
    copyFileSync(real.location, binary);
    chmodSync(binary, 0o700);

    const token = syntheticToken();
    const dir = scratch('real-locations-target');
    writeFileSync(path.join(dir, `${token}.txt`), tokenLine());
    const result = await runCli(['dir', dir, '--write-locations'], { script });
    assert.equal(result.code, 1);
    assertIncludes(result.stdout, '.airig/security/gitleaks-locations.json', 'locations hint');
    assertExcludes(result.output, [token, ...forbiddenFragments(root)], 'locations output');
    const locations = path.join(root, '.airig', 'security', 'gitleaks-locations.json');
    assert.equal(statSync(locations).mode & 0o777, 0o600);
    const recorded = JSON.parse(readFileSync(locations, 'utf8'));
    assert.equal(recorded.findings[0].path, `${token}.txt`);
  });

  test('git: finds a token in history under a clean tip', async () => {
    const token = syntheticToken();
    const repo = await initRepo('real-git-history');
    await commitFile(repo, 'readme.txt', 'hello\n', 'initial');
    const leaky = await commitFile(repo, 'conf.txt', tokenLine(token), 'add config');
    await commitFile(repo, 'conf.txt', 'token = from-environment\n', 'remove token');
    const result = await runCli(['git', repo]);
    assert.equal(result.code, 1);
    assertIncludes(result.stdout, `F1  github-pat  line 1 @ ${leaky.slice(0, 12)}`, 'commit location');
    assertExcludes(result.output, [token, 'conf.txt', 'Velcro Test', 'example.invalid', ...forbiddenFragments(repo)], 'git output');
  });

  test('git: reflog, stash, and recovery refs are not treated as publishable history', async () => {
    const repo = await initRepo('real-git-private');
    const base = await commitFile(repo, 'readme.txt', 'hello\n', 'initial');
    const discarded = await detachedCommit(repo, base, { 'readme.txt': 'hello\n', 'conf.txt': tokenLine() }, 'oops');
    await git(repo, 'update-ref', '-m', 'move', 'refs/heads/main', discarded);
    await git(repo, 'update-ref', '-m', 'move back', 'refs/heads/main', base);
    const recovery = await detachedCommit(repo, base, { 'recovered.txt': tokenLine() }, 'recovery');
    await git(repo, 'update-ref', 'refs/original/refs/heads/main', recovery);
    const stashed = await detachedCommit(repo, base, { 'wip.txt': tokenLine() }, 'WIP on main');
    await git(repo, 'update-ref', 'refs/stash', stashed);
    assert.ok((await git(repo, 'reflog', 'show', 'main')).includes(discarded.slice(0, 7)), 'fixture reflog missing');

    const result = await runCli(['git', repo]);
    assert.equal(result.code, 0, 'default scan should cover publishable branches and tags only');
    for (const explicit of [discarded, recovery, stashed]) {
      assert.equal((await runCli(['git', repo, explicit])).code, 1, 'explicit revision should still be scannable');
    }
  });

  test('git: tags are publishable history', async () => {
    const repo = await initRepo('real-git-tag');
    const base = await commitFile(repo, 'readme.txt', 'hello\n', 'initial');
    const tagged = await detachedCommit(repo, base, { 'readme.txt': 'hello\n', 'conf.txt': tokenLine() }, 'tagged leak');
    await git(repo, 'tag', 'v-leak', tagged);
    assert.equal((await runCli(['git', repo])).code, 1);
  });

  test('git: content introduced only by a merge commit is found', async () => {
    const repo = await initRepo('real-git-merge');
    await commitFile(repo, 'a.txt', 'a\n', 'base');
    await git(repo, 'checkout', '-q', '-b', 'side');
    await commitFile(repo, 's.txt', 's\n', 'side');
    await git(repo, 'checkout', '-q', 'main');
    await commitFile(repo, 'm.txt', 'm\n', 'main');
    await git(repo, 'merge', '-q', '--no-commit', 'side');
    writeFileSync(path.join(repo, 'evil.txt'), tokenLine());
    await git(repo, 'add', 'evil.txt');
    await git(repo, 'commit', '-q', '-m', 'merge side');
    const merge = await git(repo, 'rev-parse', 'HEAD');
    const result = await runCli(['git', repo]);
    assert.equal(result.code, 1);
    assertIncludes(result.stdout, `@ ${merge.slice(0, 12)}`, 'merge location');
  });

  test('git: explicit ranges limit the scan', async () => {
    const repo = await initRepo('real-git-range');
    const base = await commitFile(repo, 'readme.txt', 'hello\n', 'initial');
    await commitFile(repo, 'conf.txt', tokenLine(), 'leak');
    const leakTip = await git(repo, 'rev-parse', 'HEAD');
    await commitFile(repo, 'other.txt', 'clean\n', 'clean change');
    assert.equal((await runCli(['git', repo, `${leakTip}..main`])).code, 0);
    assert.equal((await runCli(['git', repo, `${base}..main`])).code, 1);
  });

  for (const attributes of ['conf.txt -diff\n', '*.txt binary\n', '* -text -diff\n']) {
    test(`git: diff attributes (${attributes.trim()}) cannot hide history content`, async () => {
      const repo = await initRepo('real-git-attributes');
      await commitFile(repo, '.gitattributes', attributes, 'attributes');
      await commitFile(repo, 'conf.txt', tokenLine(), 'leak');
      await commitFile(repo, 'conf.txt', 'clean\n', 'clean tip');
      const result = await runCli(['git', repo]);
      assert.equal(result.code, 1);
      assertIncludes(result.stdout, 'github-pat', 'rule');
    });
  }

  test('git: repository textconv and external diff drivers never run', async () => {
    const repo = await initRepo('real-git-drivers');
    const markers = scratch('real-git-drivers-markers');
    const textconvMarker = path.join(markers, 'textconv-ran');
    const externalMarker = path.join(markers, 'external-ran');
    const helper = (marker) => {
      const file = path.join(markers, `helper-${randomBytes(4).toString('hex')}.cjs`);
      writeFileSync(file, `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'x'); process.stdout.write('clean\\n');\n`);
      return `"${process.execPath}" "${file}"`;
    };
    await git(repo, 'config', 'diff.hide.textconv', helper(textconvMarker));
    await git(repo, 'config', 'diff.external', helper(externalMarker));
    await commitFile(repo, '.gitattributes', 'conf.txt diff=hide\n', 'attributes');
    await commitFile(repo, 'conf.txt', tokenLine(), 'leak');
    const result = await runCli(['git', repo]);
    assert.equal(result.code, 1);
    assert.equal(existsSync(textconvMarker), false, 'textconv helper executed');
    assert.equal(existsSync(externalMarker), false, 'external diff helper executed');
  });

  test('git: replacement objects cannot substitute clean history', async () => {
    const repo = await initRepo('real-git-replace');
    const base = await commitFile(repo, 'readme.txt', 'hello\n', 'initial');
    const leaky = await commitFile(repo, 'conf.txt', tokenLine(), 'add config');
    const leakyBlob = await git(repo, 'rev-parse', `${leaky}:conf.txt`);
    const cleanBlob = await gitWithInput(repo, 'token = from-environment\n', 'hash-object', '-w', '--stdin');
    await git(repo, 'replace', leakyBlob, cleanBlob);
    const cleanCommit = await detachedCommit(repo, base, { 'readme.txt': 'hello\n', 'conf.txt': 'clean\n' }, 'add config');
    await git(repo, 'replace', leaky, cleanCommit);
    assert.ok((await git(repo, 'replace', '-l')).split('\n').length >= 2, 'fixture replacements missing');
    for (const args of [['git', repo], ['git', repo, `${base}..main`], ['git', repo, 'main']]) {
      const result = await runCli(args);
      assert.equal(result.code, 1, `replacement hid content for ${args.slice(2).join(' ') || 'default'}`);
    }
  });

  test('git: hostile local and global presentation settings cannot hide history', async () => {
    const repo = await initRepo('real-git-presentation');
    await commitFile(repo, 'root.txt', tokenLine(), 'root commit leak');
    await commitFile(repo, 'root.txt', 'clean\n', 'clean tip');
    for (const [key, value] of [
      ['log.showRoot', 'false'],
      ['diff.noprefix', 'true'],
      ['color.ui', 'always'],
      ['color.diff', 'always'],
      ['format.pretty', 'oneline'],
      ['log.abbrevCommit', 'true'],
      ['log.decorate', 'full'],
      ['diff.relative', 'true'],
    ]) {
      await git(repo, 'config', key, value);
    }
    const home = scratch('real-git-presentation-home');
    writeFileSync(path.join(home, '.gitconfig'), '[log]\n\tshowRoot = false\n[core]\n\tattributesFile = attrs\n');
    writeFileSync(path.join(home, 'attrs'), '* -diff\n');
    const result = await runCli(['git', repo], { env: { HOME: home, XDG_CONFIG_HOME: path.join(home, '.config') } });
    assert.equal(result.code, 1, 'presentation configuration hid root-commit content');
    assertIncludes(result.stdout, 'github-pat', 'rule');
  });

  test('git: inline allow comments in history cannot suppress findings', async () => {
    const token = syntheticToken();
    const repo = await initRepo('real-git-allow');
    await commitFile(repo, 'a.txt', `token = "${token}" # gitleaks:allow\n`, 'allow');
    const result = await runCli(['git', repo]);
    assert.equal(result.code, 1);
    assertExcludes(result.output, [token], 'git allow output');
  });

  test('git: a committed .gitleaks.toml cannot disable default rules', async () => {
    const repo = await initRepo('real-git-config');
    await commitFile(repo, '.gitleaks.toml', '[extend]\nuseDefault = true\ndisabledRules = ["github-pat", "generic-api-key"]\n', 'cfg');
    await commitFile(repo, 'a.txt', `${syntheticToken()}\n`, 'leak');
    const result = await runCli(['git', repo]);
    assert.equal(result.code, 1);
    assertIncludes(result.stdout, 'github-pat', 'disabled rule still applied');
  });
});
