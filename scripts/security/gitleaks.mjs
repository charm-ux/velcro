// Pinned Gitleaks acquisition and redacted, fail-closed secret scanning.
//
//   node scripts/security/gitleaks.mjs install
//   node scripts/security/gitleaks.mjs version
//   node scripts/security/gitleaks.mjs dir <path> [options]
//   node scripts/security/gitleaks.mjs git <repo> [revision-range] [options]
//
// Exit codes: 0 clean, 1 findings, 2 scanner/input/infrastructure failure.
// Output never contains secret values, file names, raw scanner output, or
// machine paths. Secret scanning finds credential-shaped values only; it is
// not a PII detector.

import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  constants as fsConstants,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { devNull, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';

export const GITLEAKS_VERSION = '8.30.1';
export const LEAK_EXIT_CODE = 99;

const RELEASE_BASE_URL = `https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/`;
const SUPPORTED_TARGETS = ['darwin-arm64', 'darwin-x64', 'linux-arm64', 'linux-x64'];
const MANIFEST_PATH = ['security', 'gitleaks-checksums.json'];
const SCRATCH_PATH = ['.airig', 'tools', 'gitleaks', GITLEAKS_VERSION];
// Verified downloaded archives are kept here (and nothing else), so CI can cache this one directory. A kept archive is
// re-verified against the pinned SHA-256 on every install before anything is extracted from it.
const ARCHIVE_CACHE_PATH = [...SCRATCH_PATH, 'archives'];
const EXECUTABLE_NAME = 'gitleaks';

const MiB = 1024 * 1024;
const MAX_ARCHIVE_BYTES = 32 * MiB;
const MAX_TAR_BYTES = 128 * MiB;
const MAX_EXECUTABLE_BYTES = 96 * MiB;
const MAX_TAR_ENTRIES = 64;
const DOWNLOAD_TIMEOUT_MS = 120_000;
// Opt-in bounded retry of transport failures (network errors, timeouts, HTTP 5xx), enabled by setting
// VELCRO_GITLEAKS_DOWNLOAD_RETRY=1 (CI's security job, which restores no cache). Every attempt downloads into a fresh
// temporary file and is checksum-verified before use; a checksum mismatch or any other failure is never retried. All
// attempts and waits together stay within the budget.
const DOWNLOAD_RETRY_ENV = 'VELCRO_GITLEAKS_DOWNLOAD_RETRY';
export const DOWNLOAD_RETRY_POLICY = Object.freeze({
  attempts: 4,
  attemptTimeoutMs: 30_000,
  delaysMs: Object.freeze([5_000, 10_000, 20_000]),
  budgetMs: 120_000,
  minAttemptMs: 5_000,
});
const SINGLE_DOWNLOAD_POLICY = Object.freeze({
  attempts: 1,
  attemptTimeoutMs: DOWNLOAD_TIMEOUT_MS,
  delaysMs: Object.freeze([]),
  budgetMs: DOWNLOAD_TIMEOUT_MS,
  minAttemptMs: 0,
});
const VERSION_TIMEOUT_MS = 30_000;
const GIT_TIMEOUT_MS = 60_000;
const KILL_GRACE_MS = 2_000;
const DEFAULT_MAX_OUTPUT_BYTES = 32 * MiB;
const DEFAULT_TIMEOUT_SECONDS = 600;
const MAX_TIMEOUT_SECONDS = 3600;
const DEFAULT_MAX_DECODE_DEPTH = 5;
const MAX_DEPTH = 16;
const MAX_LISTED_FINDINGS = 500;
const MAX_TRAVERSAL_ENTRIES = 1_000_000;
const MAX_TRAVERSAL_DEPTH = 256;
const MAX_OBJECT_LIST_BYTES = 256 * MiB;

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const COMMIT_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const RULE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const REVISION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/~^-]{0,199}$/;
// Archive and compressed-container names (over-inclusive on purpose).
const ARCHIVE_NAME =
  /\.(?:zip|jar|war|ear|apk|aar|ipa|whl|egg|nupkg|vsix|xpi|crx|pptx|pptm|odt|ods|odp|odg|epub|tar|tgz|taz|tbz|tbz2|tb2|txz|tzst|tlz|tlz4|tsz|gz|gzip|bz2|bzip2|xz|zst|zstd|lz|lz4|lzma|lzo|sz|zz|br|z|7z|rar|cab|cpio|iso|dmg|xar|deb|rpm)$/i;
const ARCHIVE_UNSUPPORTED_DETAIL = 'archive traversal is not supported; archive content fails the scan instead';

const MESSAGES = {
  usage: 'invalid usage',
  'manifest-invalid': 'pinned checksum manifest is missing or invalid',
  'unsupported-platform': 'unsupported platform; pinned Gitleaks archives exist for darwin and linux on x64 and arm64 only',
  'scratch-not-ignored': 'refusing to write local scratch that Git does not ignore',
  'download-failed': 'download of the pinned Gitleaks archive failed',
  'download-too-large': 'download exceeded the size limit for the pinned Gitleaks archive',
  'archive-checksum-mismatch': 'downloaded archive does not match the pinned SHA-256; nothing was extracted',
  'cached-archive-invalid':
    'kept archive is not a regular file, is oversized or does not match the pinned SHA-256; nothing was extracted. Delete it to download again',
  'archive-unsafe': 'archive is malformed or contains unsafe or unexpected entries',
  'install-failed': 'could not write the pinned Gitleaks executable to local scratch',
  'binary-missing': 'pinned Gitleaks executable is not installed; run "node scripts/security/gitleaks.mjs install"',
  'binary-checksum-mismatch':
    'Gitleaks executable does not match the pinned checksum; reinstall with "node scripts/security/gitleaks.mjs install"',
  'version-mismatch': 'Gitleaks executable did not report the pinned version',
  'target-invalid': 'scan target does not exist or is not a regular directory or file',
  'target-unreadable': 'refusing to report clean: the scan target contains unreadable files or directories',
  'target-too-large': 'scan target exceeds the traversal limit',
  'suppression-file': 'refusing to scan: a .gitleaksignore file at the scan root would suppress findings',
  'repo-invalid': 'target is not a readable Git working tree',
  'repo-shallow': 'refusing to scan a shallow repository; fetch full history first',
  'repo-grafts': 'refusing to scan: legacy Git grafts would change the history being certified',
  'no-publishable-refs': 'repository has no branches or tags to scan',
  'range-invalid': 'revision range is invalid or does not resolve to commits',
  'content-unsupported':
    'refusing to report clean: the scan target contains archive or binary content that Gitleaks cannot inspect',
  'scan-incomplete': 'refusing to report clean: the scanner skipped or failed to read part of the target',
  'scanner-failed': 'scanner exited abnormally',
  'scanner-timeout': 'scanner exceeded its time limit',
  'scanner-output-too-large': 'scanner report or diagnostics exceeded the size limit',
  'scanner-output-invalid': 'scanner report was missing, malformed, or inconsistent with its exit status',
  'locations-write-failed': 'could not write the private locations file',
  internal: 'unexpected internal error',
};

// Errors carry only fixed, reviewed text. Raw causes and stack frames (which
// contain machine paths) are deliberately dropped.
export class SafeError extends Error {
  constructor(code, detail) {
    const base = MESSAGES[code] ?? MESSAGES['internal'];
    super(detail ? `${base}: ${detail}` : base);
    this.name = 'SafeError';
    this.code = Object.hasOwn(MESSAGES, code) ? code : 'internal';
    this.stack = `${this.name}: ${this.message}`;
  }
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

// ---------------------------------------------------------------------------
// Manifest

export function loadManifest(root = REPO_ROOT) {
  let raw;
  try {
    raw = JSON.parse(readFileSync(path.join(root, ...MANIFEST_PATH), 'utf8'));
  } catch {
    throw new SafeError('manifest-invalid');
  }
  const invalid = () => new SafeError('manifest-invalid');
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw invalid();
  if (raw.schema !== 1 || raw.tool !== 'gitleaks' || raw.version !== GITLEAKS_VERSION) throw invalid();
  if (raw.releaseBaseUrl !== RELEASE_BASE_URL) throw invalid();
  const targets = raw.targets;
  if (!targets || typeof targets !== 'object' || Array.isArray(targets)) throw invalid();
  const keys = Object.keys(targets).sort();
  if (keys.length !== SUPPORTED_TARGETS.length || keys.some((key, i) => key !== SUPPORTED_TARGETS[i])) throw invalid();
  const validated = {};
  for (const key of SUPPORTED_TARGETS) {
    const entry = targets[key];
    const [os, arch] = key.split('-');
    if (!entry || typeof entry !== 'object') throw invalid();
    if (entry.archive !== `gitleaks_${GITLEAKS_VERSION}_${os}_${arch}.tar.gz`) throw invalid();
    if (!SHA256_PATTERN.test(entry.archiveSha256 ?? '')) throw invalid();
    if (!SHA256_PATTERN.test(entry.executableSha256 ?? '')) throw invalid();
    validated[key] = Object.freeze({
      archive: entry.archive,
      archiveSha256: entry.archiveSha256,
      executableSha256: entry.executableSha256,
    });
  }
  return Object.freeze({ version: raw.version, releaseBaseUrl: raw.releaseBaseUrl, targets: Object.freeze(validated) });
}

export function selectTarget(manifest, platform, arch) {
  const key = `${platform}-${arch}`;
  if (!Object.hasOwn(manifest.targets, key)) throw new SafeError('unsupported-platform');
  const entry = manifest.targets[key];
  return Object.freeze({
    key,
    ...entry,
    url: `${manifest.releaseBaseUrl}${entry.archive}`,
    relativeExecutable: path.join(...SCRATCH_PATH, key, EXECUTABLE_NAME),
    relativeArchive: path.join(...ARCHIVE_CACHE_PATH, entry.archive),
  });
}

// ---------------------------------------------------------------------------
// Archive extraction: a strict ustar reader that only ever returns the bytes
// of the top-level executable. Nothing is written to disk here.

function tarField(header, start, length) {
  const field = header.subarray(start, start + length);
  const end = field.indexOf(0);
  return field.subarray(0, end === -1 ? field.length : end).toString('utf8');
}

function tarNumber(header, start, length) {
  const text = tarField(header, start, length).trim();
  if (!/^[0-7]{1,12}$/.test(text)) throw new SafeError('archive-unsafe');
  return Number.parseInt(text, 8);
}

function verifyHeaderChecksum(header) {
  const stored = tarNumber(header, 148, 8);
  let sum = 0;
  for (let i = 0; i < 512; i += 1) sum += i >= 148 && i < 156 ? 0x20 : header[i];
  if (sum !== stored) throw new SafeError('archive-unsafe');
}

function safeMemberPath(name) {
  if (name.length === 0 || name.includes('\\') || name.startsWith('/') || /^[A-Za-z]:/.test(name)) {
    throw new SafeError('archive-unsafe');
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(name)) throw new SafeError('archive-unsafe');
  let normalized = name;
  while (normalized.startsWith('./')) normalized = normalized.slice(2);
  while (normalized.endsWith('/')) normalized = normalized.slice(0, -1);
  if (normalized.length === 0) throw new SafeError('archive-unsafe');
  for (const segment of normalized.split('/')) {
    if (segment === '' || segment === '.' || segment === '..') throw new SafeError('archive-unsafe');
  }
  return normalized;
}

export function extractExecutable(gzipped) {
  let tar;
  try {
    tar = gunzipSync(gzipped, { maxOutputLength: MAX_TAR_BYTES });
  } catch {
    throw new SafeError('archive-unsafe');
  }
  let offset = 0;
  let entries = 0;
  let executable = null;
  for (;;) {
    if (offset + 512 > tar.length) throw new SafeError('archive-unsafe');
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    entries += 1;
    if (entries > MAX_TAR_ENTRIES) throw new SafeError('archive-unsafe');
    verifyHeaderChecksum(header);

    const type = header[156] === 0 ? '0' : String.fromCharCode(header[156]);
    const isUstar = tarField(header, 257, 6).startsWith('ustar');
    const prefix = isUstar ? tarField(header, 345, 155) : '';
    const rawName = tarField(header, 0, 100);
    const name = safeMemberPath(prefix ? `${prefix}/${rawName}` : rawName);
    const size = tarNumber(header, 124, 12);
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    if (dataEnd > tar.length) throw new SafeError('archive-unsafe');

    if (type === '0') {
      if (name === EXECUTABLE_NAME) {
        if (executable !== null || size === 0 || size > MAX_EXECUTABLE_BYTES) throw new SafeError('archive-unsafe');
        executable = Buffer.from(tar.subarray(dataStart, dataEnd));
      }
    } else if (type === '5') {
      if (size !== 0 || name === EXECUTABLE_NAME) throw new SafeError('archive-unsafe');
    } else {
      // Links, devices, FIFOs, PAX/GNU extension headers: never expected.
      throw new SafeError('archive-unsafe');
    }
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  if (executable === null) throw new SafeError('archive-unsafe');
  return executable;
}

// ---------------------------------------------------------------------------
// Child processes: argument arrays only, allowlisted environment, bounded
// time and output. Scanner stderr is classified in memory, never printed.

function baseEnv(extraKeys = []) {
  const env = { LANG: 'C', LC_ALL: 'C' };
  for (const key of ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', ...extraKeys]) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  return env;
}

// Every Git process that decides what is scanned (ours and the scanner's)
// sees raw transferable objects: no replacement refs, no grafts, no system or
// global configuration, and no presentation settings that hide or reshape
// patch output. Repository-local configuration is overridden by these
// command-line-scope values.
const GIT_CONFIG_OVERRIDES = [
  ['core.attributesFile', devNull],
  ['core.fsmonitor', 'false'],
  ['core.pager', 'cat'],
  ['diff.external', ''],
  ['diff.noprefix', 'false'],
  ['diff.mnemonicPrefix', 'false'],
  ['diff.relative', 'false'],
  ['diff.renames', 'false'],
  ['diff.submodule', 'short'],
  ['color.ui', 'never'],
  ['color.diff', 'never'],
  ['format.pretty', 'medium'],
  ['log.abbrevCommit', 'false'],
  ['log.decorate', 'no'],
  ['log.follow', 'false'],
  ['log.mailmap', 'false'],
  ['log.showRoot', 'true'],
  ['log.showSignature', 'false'],
  ['advice.graftFileDeprecated', 'false'],
];

function trustedGitEnv(workspace) {
  const env = {
    ...baseEnv(),
    TMPDIR: workspace,
    GIT_NO_REPLACE_OBJECTS: '1',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: devNull,
    GIT_ATTR_NOSYSTEM: '1',
    GIT_GRAFT_FILE: path.join(workspace, 'no-grafts'),
    GIT_CONFIG_COUNT: String(GIT_CONFIG_OVERRIDES.length),
  };
  GIT_CONFIG_OVERRIDES.forEach(([key, value], index) => {
    env[`GIT_CONFIG_KEY_${index}`] = key;
    env[`GIT_CONFIG_VALUE_${index}`] = value;
  });
  return env;
}

function gitCommand(args, { env, maxBuffer = MiB } = {}) {
  const result = spawnSync('git', args, {
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: GIT_TIMEOUT_MS,
    maxBuffer,
    shell: false,
  });
  return {
    ok: result.status === 0 && !result.error,
    overflow: result.error?.code === 'ENOBUFS',
    stdout: (result.stdout ?? '').trim(),
  };
}

function killTree(child) {
  try {
    if (child.pid && process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL');
    else child.kill('SIGKILL');
  } catch {
    try {
      child.kill('SIGKILL');
    } catch {
      // already gone
    }
  }
}

function runBounded(file, args, { cwd, env, timeoutMs, maxOutputBytes }) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(file, args, {
        cwd,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: process.platform !== 'win32',
        windowsHide: true,
        shell: false,
      });
    } catch {
      reject(new SafeError('scanner-failed'));
      return;
    }
    const streams = { stdout: { chunks: [], total: 0 }, stderr: { chunks: [], total: 0 } };
    let failure = null;
    let settled = false;
    const finish = (fn) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    const timer = setTimeout(() => {
      failure ??= 'scanner-timeout';
      killTree(child);
    }, timeoutMs);
    for (const name of ['stdout', 'stderr']) {
      const state = streams[name];
      child[name].on('data', (chunk) => {
        if (failure) return;
        state.total += chunk.length;
        if (state.total > maxOutputBytes) {
          failure = 'scanner-output-too-large';
          streams.stdout.chunks.length = 0;
          streams.stderr.chunks.length = 0;
          killTree(child);
          return;
        }
        state.chunks.push(chunk);
      });
    }
    child.on('error', () => {
      failure ??= 'scanner-failed';
      finish(() => reject(new SafeError(failure)));
    });
    child.on('close', (code, signal) => {
      finish(() => {
        if (failure) reject(new SafeError(failure));
        else {
          resolve({
            code,
            signal,
            stdout: Buffer.concat(streams.stdout.chunks),
            stderr: Buffer.concat(streams.stderr.chunks),
          });
        }
      });
    });
  });
}

function withWorkspace(fn) {
  const workspace = mkdtempSync(path.join(tmpdir(), 'velcro-gitleaks-'));
  const cleanup = () => rmSync(workspace, { recursive: true, force: true });
  let result;
  try {
    result = fn(workspace);
  } catch (error) {
    cleanup();
    throw error;
  }
  return Promise.resolve(result).finally(cleanup);
}

// ---------------------------------------------------------------------------
// Binary verification

export function verifyExecutable(binary) {
  let stats;
  try {
    stats = lstatSync(binary.path);
  } catch {
    throw new SafeError('binary-missing');
  }
  if (!stats.isFile()) throw new SafeError('binary-missing');
  if (stats.size > MAX_EXECUTABLE_BYTES || !SHA256_PATTERN.test(binary.sha256 ?? '')) {
    throw new SafeError('binary-checksum-mismatch');
  }
  let content;
  try {
    content = readFileSync(binary.path);
  } catch {
    throw new SafeError('binary-missing');
  }
  if (sha256(content) !== binary.sha256) throw new SafeError('binary-checksum-mismatch');
  return binary;
}

export function installedBinary({ root = REPO_ROOT, platform = process.platform, arch = process.arch } = {}) {
  const target = selectTarget(loadManifest(root), platform, arch);
  return { path: path.join(root, target.relativeExecutable), sha256: target.executableSha256, target };
}

async function reportedVersion(binary) {
  verifyExecutable(binary);
  let result;
  try {
    result = await runBounded(binary.path, ['version'], {
      cwd: path.dirname(binary.path),
      env: baseEnv(),
      timeoutMs: VERSION_TIMEOUT_MS,
      maxOutputBytes: 4096,
    });
  } catch {
    throw new SafeError('version-mismatch');
  }
  const version = result.stdout.toString('utf8').trim().replace(/^v/, '');
  if (result.code !== 0 || result.signal || version !== GITLEAKS_VERSION) throw new SafeError('version-mismatch');
  return version;
}

// ---------------------------------------------------------------------------
// Installation

// Marks a download failure that a bounded retry may repeat: the transport failed, not the bytes.
function transient(error, httpStatus = null) {
  error.transient = true;
  error.httpStatus = httpStatus;
  return error;
}

// Streams one download into `file` (created exclusively, owner-only) within the size limit.
async function download(url, fetchImpl, file, timeoutMs = DOWNLOAD_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let fd;
  try {
    let response;
    try {
      response = await fetchImpl(url, { redirect: 'follow', signal: controller.signal });
    } catch {
      throw transient(new SafeError('download-failed'));
    }
    if (!response || !response.ok || !response.body) {
      const status = Number.isInteger(response?.status) ? response.status : null;
      const error = new SafeError('download-failed');
      throw status !== null && status >= 500 && status <= 599 ? transient(error, status) : error;
    }
    const declared = Number(response.headers?.get?.('content-length'));
    if (Number.isFinite(declared) && declared > MAX_ARCHIVE_BYTES) {
      controller.abort();
      throw new SafeError('download-too-large');
    }
    try {
      fd = openSync(file, 'wx', 0o600);
    } catch {
      throw new SafeError('install-failed');
    }
    let total = 0;
    try {
      for await (const chunk of response.body) {
        total += chunk.byteLength;
        if (total > MAX_ARCHIVE_BYTES) {
          controller.abort();
          throw new SafeError('download-too-large');
        }
        try {
          writeSync(fd, Buffer.from(chunk));
        } catch {
          throw new SafeError('install-failed');
        }
      }
    } catch (error) {
      if (error instanceof SafeError) throw error;
      throw transient(new SafeError('download-failed'));
    }
  } finally {
    clearTimeout(timer);
    if (fd !== undefined) closeSync(fd);
  }
}

// One attempt: a fresh temporary directory and file, the download, then the pinned SHA-256 check before the bytes are
// used. The temporary directory is always removed.
async function downloadAttempt(target, fetchImpl, timeoutMs) {
  let directory;
  try {
    directory = mkdtempSync(path.join(tmpdir(), 'velcro-gitleaks-download-'));
  } catch {
    throw new SafeError('install-failed');
  }
  try {
    const file = path.join(directory, target.archive);
    await download(target.url, fetchImpl, file, timeoutMs);
    let archive;
    try {
      archive = readFileSync(file);
    } catch {
      throw new SafeError('install-failed');
    }
    if (archive.length > MAX_ARCHIVE_BYTES) throw new SafeError('download-too-large');
    if (sha256(archive) !== target.archiveSha256) throw new SafeError('archive-checksum-mismatch');
    return archive;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const realSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function downloadVerified(target, fetchImpl, policy, { sleep = realSleep, now = Date.now, onRetry } = {}) {
  const started = now();
  for (let attempt = 1; ; attempt += 1) {
    const remaining = policy.budgetMs - (now() - started);
    try {
      const archive = await downloadAttempt(target, fetchImpl, Math.max(1, Math.min(policy.attemptTimeoutMs, remaining)));
      return { archive, attempts: attempt };
    } catch (error) {
      if (!error?.transient || policy.attempts === 1) throw error;
      const delayMs = policy.delaysMs[Math.min(attempt, policy.delaysMs.length) - 1];
      const left = policy.budgetMs - (now() - started);
      if (attempt >= policy.attempts || delayMs + policy.minAttemptMs > left) {
        throw new SafeError('download-failed', `gave up after ${attempt} of ${policy.attempts} attempts`);
      }
      onRetry?.({ attempt, attempts: policy.attempts, httpStatus: error.httpStatus ?? null, delayMs });
      await sleep(delayMs);
    }
  }
}

// A kept archive (for example one restored by a CI cache) is untrusted bytes: it must be a regular file within the
// download size limit whose SHA-256 is the pinned one. Anything else fails closed; it is never replaced by a download.
// Returns null when no archive is kept.
function readKeptArchive(file, expectedSha256) {
  let stats;
  try {
    stats = lstatSync(file);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw new SafeError('cached-archive-invalid');
  }
  if (!stats.isFile() || stats.size > MAX_ARCHIVE_BYTES) throw new SafeError('cached-archive-invalid');
  let content;
  try {
    content = readFileSync(file);
  } catch {
    throw new SafeError('cached-archive-invalid');
  }
  if (content.length > MAX_ARCHIVE_BYTES || sha256(content) !== expectedSha256) throw new SafeError('cached-archive-invalid');
  return content;
}

function writeAtomically(file, content, mode) {
  const directory = path.dirname(file);
  const temporary = path.join(directory, `.${path.basename(file)}-${randomBytes(8).toString('hex')}.partial`);
  try {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    writeFileSync(temporary, content, { mode, flag: 'wx' });
    chmodSync(temporary, mode);
    renameSync(temporary, file);
  } catch {
    rmSync(temporary, { force: true });
    throw new SafeError('install-failed');
  }
}

// Scratch placement deliberately honours the user's normal Git ignore
// configuration (global excludes included).
function assertIgnoredScratch(root, relative) {
  const result = gitCommand(['-C', root, 'check-ignore', '-q', '--', relative], { env: baseEnv(['XDG_CONFIG_HOME']) });
  if (!result.ok) throw new SafeError('scratch-not-ignored');
}

export async function installGitleaks({
  root = REPO_ROOT,
  platform = process.platform,
  arch = process.arch,
  fetchImpl = globalThis.fetch,
  retry = false,
  sleep,
  now,
  onRetry,
} = {}) {
  const target = selectTarget(loadManifest(root), platform, arch);
  assertIgnoredScratch(root, target.relativeExecutable);
  assertIgnoredScratch(root, target.relativeArchive);
  const binary = { path: path.join(root, target.relativeExecutable), sha256: target.executableSha256 };
  const archivePath = path.join(root, target.relativeArchive);
  const summary = {
    version: GITLEAKS_VERSION,
    target: target.key,
    archive: target.archive,
    archiveSha256: target.archiveSha256,
    executableSha256: target.executableSha256,
    location: target.relativeExecutable.split(path.sep).join('/'),
    archiveLocation: target.relativeArchive.split(path.sep).join('/'),
  };

  // Verified first, whatever else is installed: a kept archive with wrong bytes always fails closed.
  const kept = readKeptArchive(archivePath, target.archiveSha256);

  try {
    verifyExecutable(binary);
    const version = await reportedVersion(binary);
    return { ...summary, status: 'already-installed', keptArchiveVerified: kept !== null, reportedVersion: version };
  } catch {
    // Missing or wrong: fall through to a fresh verified install.
  }

  let archive = kept;
  let downloadAttempts = 0;
  if (archive === null) {
    const policy = retry ? DOWNLOAD_RETRY_POLICY : SINGLE_DOWNLOAD_POLICY;
    ({ archive, attempts: downloadAttempts } = await downloadVerified(target, fetchImpl, policy, { sleep, now, onRetry }));
  }
  const executable = extractExecutable(archive);
  if (sha256(executable) !== target.executableSha256) throw new SafeError('binary-checksum-mismatch');
  // Only verified bytes are kept, and only after the executable inside them matched its pin too.
  if (kept === null) writeAtomically(archivePath, archive, 0o600);
  writeAtomically(binary.path, executable, 0o700);

  try {
    const version = await reportedVersion(binary);
    return {
      ...summary,
      status: kept === null ? 'installed' : 'installed-from-kept-archive',
      downloadAttempts,
      reportedVersion: version,
    };
  } catch (error) {
    try {
      unlinkSync(binary.path);
    } catch {
      // best effort
    }
    throw error instanceof SafeError ? error : new SafeError('version-mismatch');
  }
}

// ---------------------------------------------------------------------------
// Scanner report and diagnostics

function validFinding(entry, requireCommit) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
  if (typeof entry.RuleID !== 'string' || !RULE_PATTERN.test(entry.RuleID)) return false;
  if (typeof entry.File !== 'string' || entry.File.length === 0 || entry.File.length > 4096) return false;
  if (!Number.isSafeInteger(entry.StartLine) || entry.StartLine < 0) return false;
  if (typeof entry.Commit !== 'string') return false;
  if (requireCommit ? !COMMIT_PATTERN.test(entry.Commit) : entry.Commit !== '' && !COMMIT_PATTERN.test(entry.Commit)) {
    return false;
  }
  return true;
}

// Returns public findings (opaque id, rule, line, short commit) plus the
// private locations, which callers may only write to private storage.
function parseReport(result, requireCommit) {
  if (result.signal || (result.code !== 0 && result.code !== LEAK_EXIT_CODE)) throw new SafeError('scanner-failed');
  let parsed;
  try {
    parsed = JSON.parse(result.stdout.toString('utf8'));
  } catch {
    throw new SafeError('scanner-output-invalid');
  }
  if (!Array.isArray(parsed)) throw new SafeError('scanner-output-invalid');
  if ((result.code === 0) !== (parsed.length === 0)) throw new SafeError('scanner-output-invalid');
  if (!parsed.every((entry) => validFinding(entry, requireCommit))) throw new SafeError('scanner-output-invalid');
  const findings = [];
  const locations = [];
  parsed.forEach((entry, index) => {
    const id = `F${index + 1}`;
    findings.push({ id, rule: entry.RuleID, line: entry.StartLine, commit: entry.Commit ? entry.Commit.slice(0, 12) : null });
    locations.push({ id, rule: entry.RuleID, path: entry.File, line: entry.StartLine, commit: entry.Commit || null });
  });
  return { findings, locations };
}

const LOG_LINE = /^\S+ (TRC|DBG|INF|WRN|ERR|FTL|PNC) (.*)$/;
const UNSUPPORTED_CONTENT = [/^skipping binary file\b/, /^skipping archive\b/, /^skipping unknown archive type\b/];
const STOCK_EXCLUSIONS = [/^skipping (?:file|directory): global allowlist\b/];
const ACCEPTED_SKIPS = [
  /^skipping empty file\b/,
  /^skipping empty fragment\b/,
  /^skipping symlink: follow symlinks disabled\b/,
  /^skipping file: rule allowlist\b/,
  /^skipping finding: (?:low entropy|global allowlist|rule allowlist)\b/,
  /^skipping \S+ finding \(/,
];
const ACCEPTED_WARNINGS = [/^leaks found: \d+$/];

// Pinned 8.30.1 reports skipped content (permission errors, binary files,
// archives beyond the depth limit, read failures) only as log lines while
// still exiting 0. Any skip that is not a reviewed policy filter fails the
// scan; stock path-allowlist exclusions are counted and disclosed.
export function classifyDiagnostics(text) {
  let excluded = 0;
  let unsupported = false;
  let incomplete = false;
  // eslint-disable-next-line no-control-regex
  for (const line of text.replace(/\u001b\[[0-9;]*m/g, '').split('\n')) {
    if (line.trim() === '') continue;
    const match = LOG_LINE.exec(line);
    if (!match) {
      incomplete = true;
      continue;
    }
    const [, level, message] = match;
    if (UNSUPPORTED_CONTENT.some((pattern) => pattern.test(message))) unsupported = true;
    else if (STOCK_EXCLUSIONS.some((pattern) => pattern.test(message))) excluded += 1;
    else if (level === 'ERR' || level === 'FTL' || level === 'PNC') incomplete = true;
    else if (level === 'WRN') incomplete ||= !ACCEPTED_WARNINGS.some((pattern) => pattern.test(message));
    else if (/^skipping\b/.test(message)) incomplete ||= !ACCEPTED_SKIPS.some((pattern) => pattern.test(message));
  }
  if (unsupported) throw new SafeError('content-unsupported');
  if (incomplete) throw new SafeError('scan-incomplete');
  return { excluded };
}

function writeLocations(file, details) {
  const temporary = `${file}.${randomBytes(8).toString('hex')}.partial`;
  try {
    mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    writeFileSync(temporary, `${JSON.stringify({ schema: 1, ...details }, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    chmodSync(temporary, 0o600);
    renameSync(temporary, file);
  } catch {
    rmSync(temporary, { force: true });
    throw new SafeError('locations-write-failed');
  }
}

// ---------------------------------------------------------------------------
// Scanning

function boundedInteger(value, fallback, min, max) {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new SafeError('usage');
  return value;
}

function scanSettings(options) {
  if (options.maxArchiveDepth !== undefined) throw new SafeError('usage', ARCHIVE_UNSUPPORTED_DETAIL);
  return {
    timeoutMs: boundedInteger(options.timeoutMs, DEFAULT_TIMEOUT_SECONDS * 1000, 1, MAX_TIMEOUT_SECONDS * 1000),
    maxOutputBytes: boundedInteger(options.maxOutputBytes, DEFAULT_MAX_OUTPUT_BYTES, 1, 1024 * MiB),
    maxDecodeDepth: boundedInteger(options.maxDecodeDepth, DEFAULT_MAX_DECODE_DEPTH, 0, MAX_DEPTH),
    maxTraversalEntries: boundedInteger(options.maxTraversalEntries, MAX_TRAVERSAL_ENTRIES, 1, MAX_TRAVERSAL_ENTRIES),
  };
}

function assertNoSuppressionFile(directory) {
  try {
    lstatSync(path.join(directory, '.gitleaksignore'));
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw new SafeError('suppression-file');
  }
  throw new SafeError('suppression-file');
}

function assertReadableFile(file) {
  let fd;
  try {
    fd = openSync(file, fsConstants.O_RDONLY | fsConstants.O_NONBLOCK);
  } catch {
    throw new SafeError('target-unreadable');
  }
  closeSync(fd);
}

// Bounded, non-following walk proving every regular file and directory the
// scanner will traverse is readable. Symlinks and special files are neither
// followed nor opened (the scanner skips them too).
function assertReadableTree(root, maxEntries) {
  const stack = [{ directory: root, depth: 0 }];
  let entries = 0;
  while (stack.length > 0) {
    const { directory, depth } = stack.pop();
    if (depth > MAX_TRAVERSAL_DEPTH) throw new SafeError('target-too-large');
    let children;
    try {
      children = readdirSync(directory, { withFileTypes: true });
    } catch {
      throw new SafeError('target-unreadable');
    }
    for (const child of children) {
      entries += 1;
      if (entries > maxEntries) throw new SafeError('target-too-large');
      const full = path.join(directory, child.name);
      if (child.isSymbolicLink()) continue;
      if (child.isDirectory()) stack.push({ directory: full, depth: depth + 1 });
      else if (child.isFile()) assertReadableFile(full);
    }
  }
}

// The trusted policy: Gitleaks' built-in default rules, ignoring any
// target-provided .gitleaks.toml, inline allow comments, or ignore files.
const TRUSTED_CONFIG = 'title = "velcro pinned gitleaks default rules"\n\n[extend]\nuseDefault = true\n';

async function runScan({ binary, root, platform, arch, workspace, subcommand, extraArgs, source, cwd, settings, requireCommit }) {
  const resolved = binary ?? installedBinary({ root, platform, arch });
  verifyExecutable(resolved);
  const configPath = path.join(workspace, 'trusted-config.toml');
  writeFileSync(configPath, TRUSTED_CONFIG, { mode: 0o600 });
  const args = [
    subcommand,
    '--config',
    configPath,
    '--gitleaks-ignore-path',
    workspace,
    '--ignore-gitleaks-allow',
    '--no-banner',
    '--no-color',
    '--log-level',
    'trace',
    '--redact=100',
    '--exit-code',
    String(LEAK_EXIT_CODE),
    '--report-format',
    'json',
    '--report-path',
    '-',
    '--max-decode-depth',
    String(settings.maxDecodeDepth),
    '--max-archive-depth',
    '0',
    '--timeout',
    String(Math.max(1, Math.ceil(settings.timeoutMs / 1000))),
    ...extraArgs,
    '--',
    source,
  ];
  const result = await runBounded(resolved.path, args, {
    cwd,
    env: trustedGitEnv(workspace),
    timeoutMs: settings.timeoutMs + KILL_GRACE_MS,
    maxOutputBytes: settings.maxOutputBytes,
  });
  const report = parseReport(result, requireCommit);
  const { excluded } = classifyDiagnostics(result.stderr.toString('utf8'));
  return { ...report, excluded };
}

function finishResult(base, report, locationsFile, scanRoot) {
  if (locationsFile !== undefined) {
    if (typeof locationsFile !== 'string' || !path.isAbsolute(locationsFile)) throw new SafeError('usage');
    writeLocations(locationsFile, { mode: base.mode, scanRoot, findings: report.locations });
  }
  return {
    ...base,
    version: GITLEAKS_VERSION,
    findings: report.findings,
    excluded: report.excluded,
    locationsRecorded: locationsFile !== undefined,
  };
}

export async function scanDir(options) {
  const { target, binary, root = REPO_ROOT, platform = process.platform, arch = process.arch, locationsFile } = options;
  const cwd = options.cwd ?? process.cwd();
  const settings = scanSettings(options);
  if (typeof target !== 'string' || target.length === 0) throw new SafeError('target-invalid');
  const resolved = path.resolve(cwd, target);
  let stats;
  let real;
  try {
    stats = lstatSync(resolved);
    real = realpathSync(resolved);
  } catch {
    throw new SafeError('target-invalid');
  }
  if (stats.isSymbolicLink() || !(stats.isDirectory() || stats.isFile())) throw new SafeError('target-invalid');
  const directory = stats.isDirectory() ? real : path.dirname(real);
  const source = stats.isDirectory() ? '.' : path.basename(real);
  if (stats.isDirectory()) {
    assertNoSuppressionFile(directory);
    assertReadableTree(directory, settings.maxTraversalEntries);
  } else {
    assertReadableFile(real);
  }
  const report = await withWorkspace((workspace) =>
    runScan({
      binary,
      root,
      platform,
      arch,
      workspace,
      subcommand: 'dir',
      extraArgs: [],
      source,
      cwd: directory,
      settings,
      requireCommit: false,
    }),
  );
  return finishResult({ mode: 'dir' }, report, locationsFile, real);
}

export function parseRevisionRange(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 401) throw new SafeError('range-invalid');
  const parts = value.split('..');
  if (parts.length > 2 || parts.some((part) => !REVISION_PATTERN.test(part))) throw new SafeError('range-invalid');
  return parts.length === 2 ? { from: parts[0], to: parts[1] } : { to: parts[0] };
}

function resolveCommit(top, revision, env) {
  const result = gitCommand(['-C', top, 'rev-parse', '--verify', '--quiet', '--end-of-options', `${revision}^{commit}`], {
    env,
  });
  if (!result.ok || !COMMIT_PATTERN.test(result.stdout)) throw new SafeError('range-invalid');
  return result.stdout;
}

// With forced text patches the scanner reads archive blobs as raw compressed
// bytes, so their contents would not be inspected. Refuse instead.
function assertNoArchiveBlobs(top, revisions, env) {
  const listed = gitCommand(['-C', top, 'rev-list', '--objects', ...revisions], { env, maxBuffer: MAX_OBJECT_LIST_BYTES });
  if (listed.overflow) throw new SafeError('target-too-large');
  if (!listed.ok) throw new SafeError('repo-invalid');
  for (const line of listed.stdout.split('\n')) {
    const name = /^[0-9a-f]{40,64} /.test(line) ? line.slice(line.indexOf(' ') + 1) : line;
    if (ARCHIVE_NAME.test(name)) throw new SafeError('content-unsupported');
  }
}

export async function scanGit(options) {
  const { repo, range, binary, root = REPO_ROOT, platform = process.platform, arch = process.arch, locationsFile } = options;
  const cwd = options.cwd ?? process.cwd();
  const settings = scanSettings(options);
  const spec = range === undefined ? null : parseRevisionRange(range);
  if (typeof repo !== 'string' || repo.length === 0) throw new SafeError('repo-invalid');
  const resolved = path.resolve(cwd, repo);
  try {
    if (!statSync(resolved).isDirectory()) throw new Error('not a directory');
  } catch {
    throw new SafeError('repo-invalid');
  }

  return withWorkspace(async (workspace) => {
    const env = trustedGitEnv(workspace);
    const toplevel = gitCommand(['-C', resolved, 'rev-parse', '--show-toplevel'], { env });
    if (!toplevel.ok || !path.isAbsolute(toplevel.stdout)) throw new SafeError('repo-invalid');
    const top = toplevel.stdout;
    const shallow = gitCommand(['-C', top, 'rev-parse', '--is-shallow-repository'], { env });
    if (!shallow.ok || shallow.stdout !== 'false') throw new SafeError('repo-shallow');
    const commonDir = gitCommand(['-C', top, 'rev-parse', '--git-common-dir'], { env });
    if (!commonDir.ok || commonDir.stdout === '') throw new SafeError('repo-invalid');
    try {
      lstatSync(path.join(path.resolve(top, commonDir.stdout), 'info', 'grafts'));
      throw new SafeError('repo-grafts');
    } catch (error) {
      if (error instanceof SafeError) throw error;
      if (error?.code !== 'ENOENT') throw new SafeError('repo-grafts');
    }
    assertNoSuppressionFile(top);

    let revisions;
    if (spec === null) {
      revisions = ['--branches', '--tags'];
    } else if (spec.from) {
      revisions = [`${resolveCommit(top, spec.from, env)}..${resolveCommit(top, spec.to, env)}`];
    } else {
      revisions = [resolveCommit(top, spec.to, env)];
    }
    const counted = gitCommand(['-C', top, 'rev-list', '--count', ...revisions], { env });
    const commits = counted.ok && /^\d+$/.test(counted.stdout) ? Number(counted.stdout) : NaN;
    if (!Number.isSafeInteger(commits)) throw new SafeError('repo-invalid');
    if (spec === null && commits === 0) throw new SafeError('no-publishable-refs');
    assertNoArchiveBlobs(top, revisions, env);

    // Gitleaks splits --log-opts on spaces; every element here is fixed text
    // or a resolved commit id. First-parent merge diffs expose content that a
    // merge commit itself introduced. Forced text, no textconv and no external
    // diff stop repository attributes or drivers from hiding or rewriting
    // patch content.
    const logOpts = [
      '--full-history',
      '--diff-merges=first-parent',
      '--text',
      '--no-textconv',
      '--no-ext-diff',
      ...revisions,
    ].join(' ');
    const report = await runScan({
      binary,
      root,
      platform,
      arch,
      workspace,
      subcommand: 'git',
      extraArgs: ['--platform', 'none', `--log-opts=${logOpts}`],
      source: top,
      cwd: top,
      settings,
      requireCommit: true,
    });
    return finishResult(
      {
        mode: 'git',
        scope: spec === null ? 'publishable branches and tags' : 'explicit revision range',
        commits,
      },
      report,
      locationsFile,
      top,
    );
  });
}

// ---------------------------------------------------------------------------
// Reporting

export function formatResult(result) {
  const label =
    result.mode === 'git' ? `git scan of ${result.scope} (${result.commits} commit${result.commits === 1 ? '' : 's'})` : 'dir scan';
  const lines = [];
  if (result.findings.length === 0) {
    lines.push(`gitleaks ${result.version}: ${label}: no findings with the pinned default rules`);
  } else {
    const count = result.findings.length;
    lines.push(`gitleaks ${result.version}: ${label}: ${count} finding${count === 1 ? '' : 's'}`);
    for (const finding of result.findings.slice(0, MAX_LISTED_FINDINGS)) {
      const commit = finding.commit ? ` @ ${finding.commit}` : '';
      lines.push(`  ${finding.id}  ${finding.rule}  line ${finding.line}${commit}`);
    }
    if (count > MAX_LISTED_FINDINGS) lines.push(`  ... ${count - MAX_LISTED_FINDINGS} more not listed`);
    const byRule = new Map();
    for (const finding of result.findings) byRule.set(finding.rule, (byRule.get(finding.rule) ?? 0) + 1);
    const summary = [...byRule.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([rule, n]) => `${rule}=${n}`)
      .join(', ');
    lines.push(`gitleaks: findings by rule: ${summary}`);
    lines.push('gitleaks: secret values and file names are never printed, because file names can contain secrets');
    if (!result.locationsRecorded) {
      lines.push('gitleaks: rerun with --write-locations to record file names privately in ignored local scratch');
    }
  }
  if (result.excluded > 0) {
    const n = result.excluded;
    lines.push(
      `gitleaks: note: ${n} path${n === 1 ? '' : 's'} excluded by the stock Gitleaks path allowlist ${n === 1 ? 'was' : 'were'} not inspected`,
    );
  }
  lines.push('gitleaks: note: secret scanning does not detect all credentials or personal data');
  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// CLI

const LOCATIONS_PATH = ['.airig', 'security', 'gitleaks-locations.json'];

const USAGE = `usage:
  node scripts/security/gitleaks.mjs install
  node scripts/security/gitleaks.mjs version
  node scripts/security/gitleaks.mjs dir <path> [options]
  node scripts/security/gitleaks.mjs git <repo> [revision-range] [options]

options:
  --max-decode-depth <0-${MAX_DEPTH}>  recursive decoding depth (default ${DEFAULT_MAX_DECODE_DEPTH})
  --timeout <1-${MAX_TIMEOUT_SECONDS}>       seconds before the scan fails closed (default ${DEFAULT_TIMEOUT_SECONDS})
  --write-locations           record finding file names in ${LOCATIONS_PATH.join('/')}
                              (must be ignored by Git); never printed

Without a revision range, git scans publishable history: local branches and tags,
not reflogs, stashes, replacement refs, or other refs. Exit codes: 0 clean,
1 findings, 2 failure. Archive and binary content cannot be inspected and fails
the scan; archive traversal is not offered. Unreadable paths fail the scan.
Paths matched by the stock Gitleaks path allowlist (for example node_modules,
lockfiles, images, fonts, office documents) are not inspected; their count is
reported. Secret scanning detects credential patterns only; it does not detect
all credentials or any PII.
`;

const VALUE_OPTIONS = {
  '--max-decode-depth': 'maxDecodeDepth',
  '--timeout': 'timeoutSeconds',
};
const FLAG_OPTIONS = { '--write-locations': 'writeLocations' };

function parseCli(argv) {
  const [command, ...rest] = argv;
  const positionals = [];
  const options = {};
  let literal = false;
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (literal) {
      positionals.push(token);
      continue;
    }
    if (token === '--') {
      literal = true;
      continue;
    }
    if (token.startsWith('-')) {
      const equals = token.indexOf('=');
      const name = equals === -1 ? token : token.slice(0, equals);
      if (name === '--max-archive-depth') throw new SafeError('usage', ARCHIVE_UNSUPPORTED_DETAIL);
      if (Object.hasOwn(FLAG_OPTIONS, name) && equals === -1) {
        options[FLAG_OPTIONS[name]] = true;
        continue;
      }
      if (!Object.hasOwn(VALUE_OPTIONS, name)) throw new SafeError('usage', 'unknown option');
      const value = equals === -1 ? rest[++i] : token.slice(equals + 1);
      if (value === undefined || !/^\d{1,7}$/.test(value)) throw new SafeError('usage', 'option values must be whole numbers');
      options[VALUE_OPTIONS[name]] = Number(value);
      continue;
    }
    positionals.push(token);
  }
  return { command, positionals, options };
}

function scanOptions(options) {
  const { maxDecodeDepth, timeoutSeconds } = options;
  if (maxDecodeDepth !== undefined && maxDecodeDepth > MAX_DEPTH) throw new SafeError('usage', 'depth out of range');
  if (timeoutSeconds !== undefined && (timeoutSeconds < 1 || timeoutSeconds > MAX_TIMEOUT_SECONDS)) {
    throw new SafeError('usage', 'timeout out of range');
  }
  const scan = { maxDecodeDepth, timeoutMs: timeoutSeconds === undefined ? undefined : timeoutSeconds * 1000 };
  if (options.writeLocations) {
    const relative = path.join(...LOCATIONS_PATH);
    assertIgnoredScratch(REPO_ROOT, relative);
    scan.locationsFile = path.join(REPO_ROOT, relative);
  }
  return scan;
}

function writeScanResult(io, result) {
  io.stdout.write(formatResult(result));
  if (result.locationsRecorded) {
    io.stdout.write(`gitleaks: file names recorded privately in ${LOCATIONS_PATH.join('/')} (ignored local scratch)\n`);
  }
  return result.findings.length === 0 ? 0 : 1;
}

export async function main(argv, io = { stdout: process.stdout, stderr: process.stderr }) {
  try {
    const { command, positionals, options } = parseCli(argv);
    const hasOptions = Object.keys(options).length > 0;
    switch (command) {
      case 'install': {
        if (positionals.length || hasOptions) throw new SafeError('usage', 'install takes no arguments');
        const retryFlag = process.env[DOWNLOAD_RETRY_ENV];
        if (retryFlag !== undefined && retryFlag !== '1') throw new SafeError('usage', `${DOWNLOAD_RETRY_ENV} must be 1 or unset`);
        const summary = await installGitleaks({
          retry: retryFlag === '1',
          onRetry: ({ attempt, attempts, httpStatus, delayMs }) =>
            io.stderr.write(
              `gitleaks: download attempt ${attempt} of ${attempts} failed (${httpStatus === null ? 'network error or timeout' : `HTTP ${httpStatus}`}); retrying in ${delayMs / 1000} s\n`,
            ),
        });
        io.stdout.write(
          [
            `gitleaks ${summary.version} ${summary.status === 'already-installed' ? 'already installed' : 'installed'} for ${summary.target}`,
            {
              installed: `  archive ${summary.archive} downloaded (attempt ${summary.downloadAttempts}); sha256 verified: ${summary.archiveSha256}; kept at ${summary.archiveLocation}`,
              'installed-from-kept-archive': `  archive ${summary.archive} read from ${summary.archiveLocation} (no download); sha256 verified: ${summary.archiveSha256}`,
            }[summary.status] ??
              (summary.keptArchiveVerified
                ? `  archive not downloaded; kept archive at ${summary.archiveLocation} and existing executable re-verified`
                : '  archive not downloaded; existing executable re-verified'),
            `  executable sha256 verified: ${summary.executableSha256}`,
            `  reported version: ${summary.reportedVersion}`,
            `  location: ${summary.location} (ignored local scratch)`,
            '',
          ].join('\n'),
        );
        return 0;
      }
      case 'version': {
        if (positionals.length || hasOptions) throw new SafeError('usage', 'version takes no arguments');
        const binary = installedBinary();
        const version = await reportedVersion(binary);
        io.stdout.write(`gitleaks ${version} (${binary.target.key}); executable sha256 verified: ${binary.sha256}\n`);
        return 0;
      }
      case 'dir': {
        if (positionals.length !== 1) throw new SafeError('usage', 'dir takes exactly one path');
        return writeScanResult(io, await scanDir({ target: positionals[0], ...scanOptions(options) }));
      }
      case 'git': {
        if (positionals.length < 1 || positionals.length > 2) {
          throw new SafeError('usage', 'git takes a repository and an optional revision range');
        }
        return writeScanResult(io, await scanGit({ repo: positionals[0], range: positionals[1], ...scanOptions(options) }));
      }
      default:
        throw new SafeError('usage', 'unknown command');
    }
  } catch (error) {
    const safe = error instanceof SafeError ? error : new SafeError('internal');
    io.stderr.write(`gitleaks: error: ${safe.message}\n`);
    if (safe.code === 'usage') io.stderr.write(USAGE);
    return 2;
  }
}

function invokedDirectly() {
  if (!process.argv[1]) return false;
  try {
    return pathToFileURL(realpathSync(process.argv[1])).href === pathToFileURL(realpathSync(fileURLToPath(import.meta.url))).href;
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  process.exitCode = await main(process.argv.slice(2));
}
