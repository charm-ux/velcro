import { spawnSync } from 'node:child_process';
import { constants } from 'node:fs';
import { lstat, open, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

// Pattern-based publication protection, not universal PII or secret recognition.
// Callers must trust the policy independently of the candidate content. Identity
// context accepts only one exact approved identity, not arbitrary message text.
// Node 24 required. CLI: files <path...>, repository-root-relative even from a
// nested cwd; policy must equal the separately trusted module's policy. Exit
// codes: 0 clean, 1 findings, 2 policy/input/scanner failure. UTF-8 text only:
// binary, archives, special files and symlinks are refused, never silently skipped.
// Bounds: 8 MiB/file, 64 MiB total, 10,000 entries/findings, 64 traversal levels,
// 4 decoding rounds, 16 exact exceptions and 64 forbidden directory names.
// Deep escaping fails closed. Ambiguous bare slash-root routes and scp-style Git
// addresses remain conservative findings; some fragment/tilde URL routes may too.
// Default-ignorable and format code points are removed in bounded variants, not
// from source files. Original labels stay strictly redacted. Bare dotted config
// values remain findings; only clear unquoted JS declaration expressions can be
// exempted, never quoted identifying literals. The sole policy exception is
// exact Node shebang syntax; artifact namespaces need separate caller review.
const moduleRoot = fileURLToPath(new URL('../../', import.meta.url));
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 64 * 1024 * 1024;
const MAX_ENTRIES = 10000;
const MAX_DEPTH = 64;
const RULES = new Set(['machine-path', 'email', 'private-endpoint', 'private-identifier',
  'unsafe-filename', 'runtime-path']);
const standardShebang = ['#!', 'usr', 'bin', 'env node'].join('/');
const machinePath = /(?:file:\/\/(?:\/|[a-z0-9_.-]+\/)|(?:^|[^a-z0-9./])(?:\/(?:Users|home|root|tmp|private|var|etc|usr|opt|mnt|media|Volumes|Applications|Library|workspace|workspaces|srv|proc|sys|dev|run)(?![a-z0-9_.-])|\/[a-z]\/(?:Users|home)\/|[a-z]:[\\/]|\\\\[a-z0-9_.$?-]+[\\/][a-z0-9_$.-]+|\/\/[a-z0-9_.-]+\/[a-z0-9_$.-]+|~(?:[a-z0-9_.-]+)?[\\/]|\$(?:HOME|USERPROFILE|HOMEPATH)(?:[\\/]|\b)|\$\{(?:HOME|USERPROFILE|HOMEPATH)\}[\\/]|\$env:(?:USERPROFILE|HOMEPATH|HOME|LOCALAPPDATA|APPDATA)[\\/]|%(?:USERPROFILE|HOMEPATH|HOME|LOCALAPPDATA|APPDATA)%[\\/]))/i;
// Explicit filesystem syntax never acquires web-route semantics, even when
// embedded in a URL path. Only ambiguous slash-root routes need URL masking.
const explicitLocation = /\bfile:\/\/(?:\/|[a-z0-9_.-]+\/)|(?<![a-z0-9])(?:[a-z]:[\\/]|\\\\[a-z0-9_.$?-]+[\\/][a-z0-9_$.-]+|~(?:[a-z0-9_.-]+)?[\\/]|\$(?:HOME|USERPROFILE|HOMEPATH)[\\/]|\$\{(?:HOME|USERPROFILE|HOMEPATH)\}[\\/]|\$env:(?:USERPROFILE|HOMEPATH|HOME|LOCALAPPDATA|APPDATA)[\\/]|%(?:USERPROFILE|HOMEPATH|HOME|LOCALAPPDATA|APPDATA)%[\\/])/i;
const emailPattern = /(?<![a-z0-9.!#$%&'*+\/=?^_`{|}~-])[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}(?![a-z0-9-])|\bmailto:[a-z0-9_.+-]+@[a-z0-9_-]+/i;
const privateHost = /(?<![a-z0-9_.-])(?:localh[o]st|[a-z0-9_-]+(?:\.[a-z0-9_-]+)*\.(?:local|internal|lan|corp|localh[o]st|home|intranet))\b|(?<![0-9a-f:])(?:\[?::[1](?![0-9a-f:])\]?|\[?(?:f[cd][0-9a-f]{2}|fe[89ab][0-9a-f]):[0-9a-f:]+\]?)/i;
const identifierKey = /(?:^|[._$-])(?:user[_-]?name|host[_-]?name|computer[_-]?name|machine[_-]?name)$/i;
// Match the complete ordinary/prefixed/property key before inspecting its suffix.
// Do not make a leading property dot or environment prefix an accidental waiver.
// Inspect the RHS in a lookahead so an unrelated wrapper assignment cannot
// consume and hide an identifying assignment nested inside its value.
const identifierAssignment = /(?<![a-z0-9_$.-])(?:--)?([a-z_$][a-z0-9_$.-]*)["']?\s*[:=]\s*(?=(["']?)([a-z0-9_.-]+))/gi;
const declarationPrefix = /(?:^|[;{}])\s*(?:export\s+)?(?:const|let|var)\s+$/;
// This is a deliberately small expression recognizer, not a JS parser: a plain
// declaration RHS with member/index/optional access or an empty call, ending the
// statement. Config-shaped dotted values without that context remain findings.
const dynamicExpression = /^[a-z_$][\w$]*(?:\s*(?:\?\.|\.)\s*[a-z_$][\w$]*|\s*(?:\?\.)?\[\s*(?:"[\w$]+"|'[\w$]+'|\d+)\s*\]|\s*\(\s*\))+\s*;?\s*$/i;

function hasPrivateIdentifier(text) {
  for (const assignment of text.matchAll(identifierAssignment)) {
    const [, key, quote] = assignment;
    if (!identifierKey.test(key)) continue;
    // A quoted value is a literal even on a property, prefixed environment key,
    // or declaration. Only a clear unquoted declaration can use expression rules.
    if (quote) return true;
    const before = text.slice(0, assignment.index);
    const rhs = text.slice(assignment.index + assignment[0].length);
    if (/^[a-z_$][\w$]*$/i.test(key) && declarationPrefix.test(before)
      && dynamicExpression.test(rhs)) continue;
    return true;
  }
  return false;
}

function failure() {
  const error = new Error('privacy: scanner, policy or input failure');
  // Even a caller logging the entire error must not disclose the module location.
  error.stack = error.message;
  return error;
}

function keys(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && isDeepStrictEqual(Object.keys(value).sort(), [...expected].sort());
}

function validatePolicy(policy) {
  if (!keys(policy, ['version', 'approvedIdentity', 'forbiddenDirectories', 'exceptions'])
    || policy.version !== 1 || !keys(policy.approvedIdentity, ['name', 'email'])) throw failure();
  const { name, email } = policy.approvedIdentity;
  if (typeof name !== 'string' || !/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/i.test(name)
    || typeof email !== 'string'
    || !new RegExp(`^[0-9]+\\+${name}@users\\.noreply\\.github\\.com$`, 'i').test(email)) throw failure();
  const dirs = policy.forbiddenDirectories;
  if (!Array.isArray(dirs) || dirs.length > 64 || !dirs.includes('.airig') || !dirs.includes('.worktrees')
    || new Set(dirs).size !== dirs.length
    || dirs.some(d => typeof d !== 'string' || !/^\.?[a-z0-9][a-z0-9_-]*$/.test(d))) throw failure();
  if (!Array.isArray(policy.exceptions) || policy.exceptions.length > 16) throw failure();
  for (const exception of policy.exceptions) {
    if (!keys(exception, ['path', 'rule', 'line', 'text', 'purpose'])
      || typeof exception.path !== 'string'
      || !/^(?:[a-z0-9_-]+\/)*[a-z0-9_.-]+\.mjs$/.test(exception.path)
      || exception.path.split('/').some(p => p === '.' || p === '..' || dirs.includes(p))
      || exception.rule !== 'machine-path' || exception.line !== 1
      || exception.text !== standardShebang
      || typeof exception.purpose !== 'string' || !exception.purpose.trim()
      || exception.purpose.length > 240) throw failure();
  }
  return policy;
}

function parsePolicy(text) {
  const policy = validatePolicy(JSON.parse(text));
  // JSON.parse silently overwrites duplicate keys. Compare normalized token
  // streams to reject hidden metadata while permitting whitespace and escapes.
  const tokens = value => (value.match(/"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}\[\],:]/g) ?? [])
    .map(token => /^(?:"|-?\d)/.test(token) ? JSON.stringify(JSON.parse(token)) : token);
  if (!isDeepStrictEqual(tokens(text), tokens(JSON.stringify(policy)))) throw failure();
  return policy;
}

async function checkedPath(root, target) {
  const relative = path.relative(root, target);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw failure();
  let current = root;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if ((await lstat(current)).isSymbolicLink()) throw failure();
  }
  return lstat(target);
}

async function readText(root, target) {
  const stat = await checkedPath(root, target);
  if (!stat.isFile() || stat.size > MAX_BYTES) throw failure();
  const handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== stat.dev || opened.ino !== stat.ino || opened.size > MAX_BYTES) throw failure();
    // A bounded read also prevents a growing file from defeating the initial stat.
    const buffer = Buffer.alloc(Math.min(MAX_BYTES, opened.size) + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > MAX_BYTES) throw failure();
    const final = await handle.stat();
    const named = await checkedPath(root, target);
    if (final.size !== length || final.mtimeMs !== opened.mtimeMs
      || final.ctimeMs !== opened.ctimeMs || named.dev !== opened.dev || named.ino !== opened.ino) throw failure();
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, length));
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(text)) throw failure();
    return text;
  } finally {
    await handle.close();
  }
}

/** Load and validate the trusted repository policy. All errors are redacted. */
export async function loadPolicy(root) {
  try {
    const resolved = await realpath(root);
    return parsePolicy(await readText(resolved, path.join(resolved, 'security/policy.json')));
  } catch {
    throw failure();
  }
}

// Default policy follows the installed module, never the caller's arbitrary cwd.
// Loading is deferred so a malformed policy is catchable by CLI error handling.
let defaultPolicy;
async function getDefaultPolicy() {
  defaultPolicy ??= await loadPolicy(moduleRoot);
  return defaultPolicy;
}

function decode(text) {
  // Consume each escape once, left to right. In particular a backslash pair must
  // not expose a UNC host's first character to a later simple-escape replacement
  // in the same round. Unicode/hex-produced backslashes also wait until next round.
  let result = text.replace(/\\(?:u\{([0-9a-f]{1,6})\}|u([0-9a-f]{4})|x([0-9a-f]{2})|([\\/])|([nrtbfv0"']))/gi,
    (match, a, b, c, keep, separator) => {
      if (keep !== undefined) return keep;
      if (separator !== undefined) return ' ';
      const code = Number.parseInt(a || b || c, 16);
      return code <= 0x10ffff ? String.fromCodePoint(code) : match;
    });
  result = result.replace(/(?:%[0-9a-f]{2})+/gi, match => {
    try { return decodeURIComponent(match); } catch { return match; }
  });
  result = result.replace(/&#(?:x([0-9a-f]{1,6})|([0-9]{1,7}));|&(sol|bsol|colon|commat|period|dollar|tilde);/gi,
    (match, hex, decimal, named) => {
      if (named) return { sol: '/', bsol: '\\', colon: ':', commat: '@', period: '.', dollar: '$', tilde: '~' }[named.toLowerCase()];
      const code = Number.parseInt(hex || decimal, hex ? 16 : 10);
      return code <= 0x10ffff ? String.fromCodePoint(code) : match;
    });
  const decodeBase64 = token => {
    if (token.length < 12) return token;
    const bytes = Buffer.from(token, 'base64');
    if (bytes.toString('base64').replace(/=+$/, '') !== token.replaceAll('-', '+').replaceAll('_', '/').replace(/=+$/, '')) return token;
    const decoded = bytes.toString('utf8');
    return /^[\t\r\n -~]+$/.test(decoded) ? decoded : token;
  };
  result = result.replace(/(?<![a-z0-9+/_-])[a-z0-9+/_-]{12,}={0,2}(?![a-z0-9+/_=-])/gi, token => {
    const whole = decodeBase64(token);
    if (whole !== token) return whole;
    // Generated IDs often prepend a short label using base64-alphabet delimiters.
    return token.split(/([-_/])/).map(decodeBase64).join('');
  });
  return result;
}

function variants(text) {
  const result = [text];
  for (let depth = 0; depth < 4; depth++) {
    // Keep the original for matching/redacting labels, and add normalized
    // variants for obfuscated content without rejecting ordinary Unicode source.
    const next = decode(result.at(-1)).replace(/[\p{Default_Ignorable_Code_Point}\p{Cf}]/gu, '');
    if (next === result.at(-1)) return result;
    result.push(next);
  }
  if (decode(result.at(-1)).replace(/[\p{Default_Ignorable_Code_Point}\p{Cf}]/gu, '') !== result.at(-1)) throw failure();
  return result;
}

function contentRules(text) {
  const rules = [];
  // Public URL paths and network-path public URLs are not local filesystem paths.
  // Only syntactically explicit URL authorities/routes receive web semantics.
  // Queries, fragments, backslashes and adjacent markup/data delimiters remain
  // visible to the machine-path rule, including after percent/entity decoding.
  const withoutWebURLs = text.replace(/\bhttps?:\/\/(?:[a-z0-9-]+(?:\.[a-z0-9-]+)*|\[[0-9a-f:]+\])(?::\d{1,5})?(?=[/?#\s"'<>;,|)\]}]|$)(?:\/[^\s"'<>?#;,|)\]}\\]*)?/gi, ' ')
    .replace(/(?<![:a-z0-9])\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?=[:/?#\s"'<>;,|)\]}]|$)(?::\d{1,5})?(?:\/[^\s"'<>?#;,|)\]}\\]*)?/gi, ' ');
  if (machinePath.test(withoutWebURLs) || explicitLocation.test(text)) rules.push('machine-path');
  if (emailPattern.test(text)) rules.push('email');
  if (privateHost.test(text) || /\bhttps?:\/\/[a-z0-9_-]+(?=[:/\s"'<>]|$)/i.test(text)
    || /\bhttps?:\/\/127(?:\.\d{1,3}){0,2}(?=[:/?#\s"'<>]|$)/i.test(text)
    || [...text.matchAll(/\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g)]
    .some(([, a, b, c, d]) => [a, b, c, d].every(n => +n <= 255)
      && (+a === 10 || +a === 127 || +a === 0 || (+a === 192 && +b === 168)
        || (+a === 172 && +b >= 16 && +b <= 31) || (+a === 169 && +b === 254)
        || (+a === 100 && +b >= 64 && +b <= 127)))) rules.push('private-endpoint');
  if (hasPrivateIdentifier(text)) rules.push('private-identifier');
  return rules;
}

function labelRules(label, policy) {
  if (typeof label !== 'string' || !label || label.length > 1024) return ['unsafe-filename'];
  const rules = new Set();
  for (const variant of variants(label)) {
    if (variant.startsWith('/') || variant.includes('\\') || variant.split('/').some(p => p === '..' || p === '.' || !p)
      || !/^[a-z0-9_.@+\-/]+$/i.test(variant) || contentRules(variant).length
      || variant.split('/').some(p => /^\.env(?:\.|$)|^id_(?:rsa|dsa|ecdsa|ed25519)(?:\.|$)|\.(?:pem|key)$/i.test(p))) rules.add('unsafe-filename');
    if (variant.split('/').some(p => policy.forbiddenDirectories.includes(p.toLowerCase()))) rules.add('runtime-path');
  }
  return [...rules];
}

/** Return only rule, redacted repository-relative path, and 1-based line.
 * options.policy is an independently trusted loaded policy; context: 'identity'
 * permits only the exact approved name/email/Name <email> metadata value.
 */
export function scanText(text, label, options = {}) {
  // Synchronous callers should supply their already-loaded trusted policy.
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw failure();
  const policy = validatePolicy(options.policy ?? defaultPolicy);
  if (typeof text !== 'string' || Buffer.byteLength(text) > MAX_BYTES
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(text)) throw failure();
  const unsafe = labelRules(label, policy);
  const safePath = unsafe.length ? '[redacted]' : label;
  const findings = unsafe.map(rule => ({ rule, path: safePath, line: 1 }));
  const { name, email } = policy.approvedIdentity;
  const exactIdentity = options.context === 'identity'
    && [name, email, `${name} <${email}>`].includes(text);
  let policyMetadata = false;
  let policyLines;
  if (label === 'security/policy.json') {
    try {
      const candidate = parsePolicy(text);
      policyMetadata = isDeepStrictEqual(candidate, policy);
      if (!policyMetadata && isDeepStrictEqual(candidate.approvedIdentity, policy.approvedIdentity)) {
        // A valid candidate policy is data, never the active scanning policy.
        // Mask only exact identity-object and standard interpreter metadata in
        // this schema, retaining original lines and scanning every other value.
        let masked = text.replace(/("(?:\\.|[^"\\])*")\s*:\s*(\{[^{}]*\})/g, (match, key, value) =>
          JSON.parse(key) === 'approvedIdentity'
            ? match.slice(0, -value.length) + value.replace(/[^\r\n]/g, ' ') : match);
        masked = masked.replace(/("(?:\\.|[^"\\])*")\s*:\s*("(?:\\.|[^"\\])*")/g, (match, key, value) =>
          JSON.parse(key) === 'text' && JSON.parse(value) === standardShebang
            ? match.slice(0, -value.length) + ' '.repeat(value.length) : match);
        policyLines = masked.split(/\r\n|\n|\r/);
      }
    } catch { /* malformed or unsupported policy never grants metadata exemptions */ }
  }
  const lines = text.split(/\r\n|\n|\r/);
  lines.forEach((original, index) => {
    const rules = new Set();
    for (const variant of variants(policyLines?.[index] ?? original)) {
      // Remove only the approved metadata value, not the rest of the policy.
      let checked = exactIdentity || policyMetadata ? variant.replaceAll(email, '') : variant;
      if (policyMetadata) {
        for (const exception of policy.exceptions) checked = checked.replaceAll(exception.text, '');
      }
      for (const rule of contentRules(checked)) rules.add(rule);
    }
    for (const rule of rules) {
      if (policy.exceptions.some(e => e.path === label && e.rule === rule
        && e.line === index + 1 && e.text === original)) continue;
      findings.push({ rule, path: safePath, line: index + 1 });
    }
  });
  return findings;
}

/** Format untrusted finding objects without ever trusting their rule/path text. */
export function formatFindings(findings) {
  if (!Array.isArray(findings)) throw failure();
  return findings.map(f => {
    const rule = RULES.has(f?.rule) ? f.rule : 'unsafe-filename';
    let label = '[redacted]';
    try {
      const policy = defaultPolicy;
      if (policy && labelRules(f?.path, policy).length === 0) label = f.path;
    } catch { /* fail to a redacted label */ }
    const line = Number.isSafeInteger(f?.line) && f.line > 0 ? f.line : 1;
    return `${label}:${line} ${rule}`;
  }).join('\n');
}

async function main(args) {
  if (args[0] !== 'files' || args.length < 2 || args.slice(1).some(a => !a || a.startsWith('-'))) throw failure();
  const git = spawnSync('git', ['-C', process.cwd(), 'rev-parse', '--show-toplevel'], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 10000, maxBuffer: 65536,
  });
  if (git.error || git.status !== 0 || !git.stdout.trim()) throw failure();
  const root = await realpath(git.stdout.trim());
  const policy = await getDefaultPolicy();
  // A trusted scanner invoked from a candidate checkout must never silently
  // adopt candidate policy. Task 6 may run this module from its trusted base:
  // candidate policy changes require separate review, and fail here with code 2.
  if (!isDeepStrictEqual(await loadPolicy(root), policy)) throw failure();
  const findings = [];
  const seen = new Set();
  let entries = 0;
  let totalBytes = 0;
  async function visit(target, depth = 0) {
    if (depth > MAX_DEPTH || ++entries > MAX_ENTRIES) throw failure();
    const stat = await checkedPath(root, target);
    if (seen.has(target)) return;
    seen.add(target);
    const label = path.relative(root, target).split(path.sep).join('/');
    if (stat.isDirectory()) {
      if (label) findings.push(...scanText('', label, { policy }));
      for (const entry of (await readdir(target)).sort()) await visit(path.join(target, entry), depth + 1);
    } else if (stat.isFile()) {
      if (totalBytes + stat.size > MAX_TOTAL_BYTES) throw failure();
      const text = await readText(root, target);
      totalBytes += Buffer.byteLength(text);
      if (totalBytes > MAX_TOTAL_BYTES) throw failure();
      const found = scanText(text, label, { policy });
      if (findings.length + found.length > MAX_ENTRIES) throw failure();
      for (const finding of found) findings.push(finding);
    }
    else throw failure();
  }
  for (const input of args.slice(1)) {
    if (input.split(/[\\/]/).includes('..')) throw failure();
    // Deliberately Git-style: all CLI input paths are repository-root-relative,
    // even when invoked from a subdirectory. Absolute contained paths also work.
    await visit(path.resolve(root, input));
  }
  if (findings.length) {
    process.stdout.write(`${formatFindings(findings)}\n`);
    return 1;
  }
  process.stdout.write('privacy: clean\n');
  return 0;
}

// Node 24 supplies actual main-module semantics, independent of symlink spelling.
// An unsupported runtime must fail rather than treating a CLI call as an import.
if (typeof import.meta.main !== 'boolean') throw failure();
if (import.meta.main) {
  try { process.exitCode = await main(process.argv.slice(2)); }
  catch { process.stderr.write('privacy: scanner, policy or input failure\n'); process.exitCode = 2; }
} else {
  // Imported engine defaults to the policy adjacent to this module; failures are
  // blocking rather than silently falling back to an empty allowlist.
  await getDefaultPolicy();
}
