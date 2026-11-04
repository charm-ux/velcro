// Bounded outbound-text guard for explicit plain UTF-8 text inputs, such as a
// pull-request title/body or release notes saved as .txt or .md files.
//
//   node scripts/security/artifacts.mjs <path...>
//
// This is NOT artifact, bundle, archive, image or package certification, and it
// sends nothing anywhere. Each input is read once into a private in-memory
// snapshot; the privacy rules and the pinned Gitleaks scan inspect exactly those
// bytes (never the original path again), and the reported SHA-256 values bind the
// result to them. Unsupported or unreadable input fails closed.
//
// Exit codes: 0 fully inspected and clean, 1 findings, 2 input/infrastructure
// failure. Output is fixed text: rule names, logical labels, line numbers, counts
// and hashes. It never contains matched text, input paths, raw exceptions or
// environment. Pattern scanning cannot recognize all credentials or personal data.
import { createHash } from 'node:crypto';
import {
  closeSync,
  constants as fsConstants,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const trustedRoot = fileURLToPath(new URL('../../', import.meta.url));
const MiB = 1024 * 1024;

export const LIMITS = Object.freeze({
  maxInputs: 16,
  maxFileBytes: MiB,
  maxTotalBytes: 4 * MiB,
  maxPathChars: 4096,
  scanTimeoutMs: 60_000,
  scanOutputBytes: MiB,
});

const SUPPORTED_EXTENSIONS = new Set(['.txt', '.md']);
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;
const SCANNER_CODE = /^[a-z][a-z-]{0,39}$/;

// Fixed reasons only; nothing derived from input or exceptions is ever added.
const REASONS = {
  usage: 'usage error',
  'unsupported-type': 'input is not a supported .txt or .md file',
  'not-regular': 'input is not a regular file (directories, symlinks and special files are refused)',
  unreadable: 'input is missing or unreadable',
  'too-many': 'too many inputs',
  'too-large': 'input exceeds the size limit',
  empty: 'input is empty, so nothing could be inspected',
  'not-utf8': 'input is not valid UTF-8 text',
  'control-characters': 'input contains control characters; plain text only',
  duplicate: 'the same file was given more than once',
  changed: 'input changed while it was being read',
  platform: 'this platform cannot safely open inputs without following symlinks',
  policy: 'trusted privacy policy or engine unavailable',
  'scan-incomplete': 'refusing to report clean: the scan was not complete',
  scanner: 'pinned secret scanner failure',
  internal: 'unexpected internal error',
};

class OutboundError extends Error {
  constructor(reason, { input = null, detail = null } = {}) {
    const key = Object.hasOwn(REASONS, reason) ? reason : 'internal';
    const where = input === null ? '' : ` (input ${input})`;
    const extra = detail === null ? '' : ` [${detail}]`;
    super(`${REASONS[key]}${where}${extra}`);
    this.name = 'OutboundError';
    this.reason = key;
    // Never let a logged error disclose the module location.
    this.stack = `${this.name}: ${this.message}`;
  }
}

const USAGE = `usage:
  node scripts/security/artifacts.mjs <path...>

Inspects explicit plain UTF-8 text inputs (.txt or .md; for example a pull-request
title/body or release notes saved to a file). Options are not accepted; start a
path with ./ if it begins with "-". Up to ${LIMITS.maxInputs} inputs, ${LIMITS.maxFileBytes} bytes each and
${LIMITS.maxTotalBytes} bytes in total. Directories, symlinks, special files, archives,
images, binaries, empty, oversized, non-UTF-8 and unreadable inputs fail closed.
Exit codes: 0 fully inspected and clean, 1 findings, 2 failure.
This is not artifact certification and it never sends anything.
`;

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function countLines(text) {
  const parts = text.split(/\r\n|\n|\r/);
  return text.endsWith('\n') || text.endsWith('\r') ? parts.length - 1 : parts.length;
}

function validateArguments(args) {
  if (!Array.isArray(args) || args.length === 0) throw new OutboundError('usage');
  if (args.length > LIMITS.maxInputs) throw new OutboundError('too-many');
  args.forEach((arg, index) => {
    if (typeof arg !== 'string' || arg.length === 0 || arg.length > LIMITS.maxPathChars || arg.includes('\0') || arg.startsWith('-')) {
      throw new OutboundError('usage', { input: index + 1 });
    }
  });
}

// Reads one regular file into a private, bounded snapshot. The path is classified
// with lstat first and a special file is never opened, so a FIFO cannot block us.
// The open uses O_NOFOLLOW|O_NONBLOCK and the descriptor is re-checked.
function snapshotFile(arg, index, cwd, remainingBytes, seen) {
  const input = index + 1;
  if (!SUPPORTED_EXTENSIONS.has(path.extname(arg).toLowerCase())) throw new OutboundError('unsupported-type', { input });
  if (fsConstants.O_NOFOLLOW === undefined || fsConstants.O_NONBLOCK === undefined) throw new OutboundError('platform');
  const resolved = path.resolve(cwd, arg);
  let named;
  try {
    named = lstatSync(resolved);
  } catch {
    throw new OutboundError('unreadable', { input });
  }
  if (!named.isFile()) throw new OutboundError('not-regular', { input });
  const key = `${named.dev}:${named.ino}`;
  if (seen.has(key)) throw new OutboundError('duplicate', { input });
  seen.add(key);
  const limit = Math.min(LIMITS.maxFileBytes, remainingBytes);
  if (named.size > limit) throw new OutboundError('too-large', { input });
  if (named.size === 0) throw new OutboundError('empty', { input });

  let fd;
  try {
    fd = openSync(resolved, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | fsConstants.O_NONBLOCK);
  } catch {
    throw new OutboundError('unreadable', { input });
  }
  try {
    const opened = fstatSync(fd);
    if (!opened.isFile() || opened.dev !== named.dev || opened.ino !== named.ino) throw new OutboundError('changed', { input });
    if (opened.size > limit) throw new OutboundError('too-large', { input });
    // One byte of headroom detects growth past the bound without reading unboundedly.
    const buffer = Buffer.alloc(limit + 1);
    let length = 0;
    while (length < buffer.length) {
      let read;
      try {
        read = readSync(fd, buffer, length, buffer.length - length, null);
      } catch {
        throw new OutboundError('unreadable', { input });
      }
      if (read === 0) break;
      length += read;
    }
    if (length > limit) throw new OutboundError('too-large', { input });
    const final = fstatSync(fd);
    if (length !== opened.size || final.size !== opened.size || final.mtimeMs !== opened.mtimeMs || final.ctimeMs !== opened.ctimeMs) {
      throw new OutboundError('changed', { input });
    }
    if (length === 0) throw new OutboundError('empty', { input });
    return Buffer.from(buffer.subarray(0, length));
  } finally {
    closeSync(fd);
  }
}

function decodeSnapshot(bytes, index) {
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new OutboundError('not-utf8', { input: index + 1 });
  }
  if (CONTROL_CHARACTERS.test(text)) throw new OutboundError('control-characters', { input: index + 1 });
  return text;
}

async function loadEngines() {
  try {
    const privacy = await import('./privacy.mjs');
    const gitleaks = await import('./gitleaks.mjs');
    // The trusted policy comes from the engine's own checkout, never from cwd or inputs.
    const policy = await privacy.loadPolicy(trustedRoot);
    return { scanText: privacy.scanText, scanDir: gitleaks.scanDir, policy };
  } catch {
    throw new OutboundError('policy');
  }
}

function scannerFailure(error) {
  const code = typeof error?.code === 'string' && SCANNER_CODE.test(error.code) && error.name === 'SafeError' ? error.code : null;
  return new OutboundError('scanner', { detail: code });
}

// Materialize the snapshot under a fixed numbered .txt name in a private
// scratch directory so stock path exclusions cannot apply, scan that directory,
// and confirm the scanned bytes are still exactly the snapshot.
async function secretScan(scanDir, snapshot, input) {
  const scratch = mkdtempSync(path.join(tmpdir(), 'velcro-outbound-'));
  try {
    const dir = path.join(scratch, 'text');
    mkdirSync(dir, { mode: 0o700 });
    const file = path.join(dir, '1.txt');
    writeFileSync(file, snapshot, { flag: 'wx', mode: 0o600 });
    let result;
    try {
      result = await scanDir({ target: dir, timeoutMs: LIMITS.scanTimeoutMs, maxOutputBytes: LIMITS.scanOutputBytes });
    } catch (error) {
      throw scannerFailure(error);
    }
    if (!result || !Array.isArray(result.findings) || result.excluded !== 0) throw new OutboundError('scan-incomplete', { input });
    let scanned;
    try {
      scanned = readFileSync(file);
    } catch {
      throw new OutboundError('scan-incomplete', { input });
    }
    if (!scanned.equals(snapshot)) throw new OutboundError('scan-incomplete', { input });
    return result.findings.map((finding) => ({
      rule: `gitleaks:${finding.rule}`,
      line: Number.isSafeInteger(finding.line) && finding.line > 0 ? finding.line : 1,
    }));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/**
 * Inspect explicit text inputs. Resolves { findings, inputs } or throws
 * OutboundError. Nothing is reported clean unless every input was fully inspected.
 */
export async function inspectOutboundText(args, { cwd = process.cwd() } = {}) {
  validateArguments(args);
  // Phase 1: bounded private snapshots of every input; no engine is needed yet.
  const seen = new Set();
  let total = 0;
  const inputs = args.map((arg, index) => {
    const bytes = snapshotFile(arg, index, cwd, LIMITS.maxTotalBytes - total, seen);
    total += bytes.length;
    const text = decodeSnapshot(bytes, index);
    return { bytes, text, sha256: sha256(bytes) };
  });

  const { scanText, scanDir, policy } = await loadEngines();
  const findings = [];
  const summaries = [];
  for (const [index, entry] of inputs.entries()) {
    const label = `outbound/text-${index + 1}.txt`;
    let privacy;
    try {
      privacy = scanText(entry.text, label, { policy });
    } catch {
      throw new OutboundError('policy', { input: index + 1 });
    }
    const secrets = await secretScan(scanDir, entry.bytes, index + 1);
    for (const finding of privacy) findings.push({ label, rule: finding.rule, line: finding.line });
    for (const finding of secrets) findings.push({ label, rule: finding.rule, line: finding.line });
    summaries.push({
      label,
      bytes: entry.bytes.length,
      lines: countLines(entry.text),
      sha256: entry.sha256,
    });
  }
  return { findings, inputs: summaries, totalBytes: total };
}

export function formatReport({ findings, inputs, totalBytes }) {
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const lines = [];
  if (findings.length === 0) {
    lines.push(`artifacts: ${plural(inputs.length, 'text input')} (${plural(totalBytes, 'byte')}) fully inspected: no findings`);
    for (const input of inputs) {
      lines.push(`  ${input.label}  ${plural(input.bytes, 'byte')}  ${plural(input.lines, 'line')}  sha256 ${input.sha256}`);
    }
    const bundle = sha256(Buffer.from(inputs.map((input) => `${input.sha256}\n`).join('')));
    lines.push(`artifacts: ordered inputs sha256 ${bundle}`);
    lines.push('artifacts: this result applies only to exactly these bytes; any edit, reformat or different input needs a new scan');
  } else {
    lines.push(`artifacts: ${plural(findings.length, 'finding')}; matched text is never printed`);
    for (const finding of findings) lines.push(`  ${finding.label}:${finding.line} ${finding.rule}`);
    lines.push('artifacts: do not send this text; fix it and scan the exact final bytes again');
  }
  lines.push('artifacts: this tool sends nothing and is not archive, image or package certification');
  lines.push('artifacts: pattern scanning does not detect all credentials or personal data');
  return `${lines.join('\n')}\n`;
}

export async function main(argv, io = { stdout: process.stdout, stderr: process.stderr }, options = {}) {
  try {
    const report = await inspectOutboundText(argv, options);
    io.stdout.write(formatReport(report));
    return report.findings.length === 0 ? 0 : 1;
  } catch (error) {
    const safe = error instanceof OutboundError ? error : new OutboundError('internal');
    io.stderr.write(`artifacts: error: ${safe.message}; details withheld\n`);
    if (safe.reason === 'usage') io.stderr.write(USAGE);
    return 2;
  }
}

// Node 24 supplies actual main-module semantics; an older runtime must fail
// closed rather than treat a CLI invocation as a silent import.
if (typeof import.meta.main !== 'boolean') {
  process.stderr.write('artifacts: error: unsupported runtime; details withheld\n');
  process.exitCode = 2;
} else if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2));
}
