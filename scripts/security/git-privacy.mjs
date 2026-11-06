// Source-only Git publication guard. Trust this module and its adjacent engines
// separately from candidate content. No archive, binary, tag or submodule export.
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdtempSync, readFileSync, readSync, rmSync, writeFileSync } from 'node:fs';
import { devNull, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Deferred imports keep missing engines and malformed adjacent policy inside
// the same redacted, fail-closed error boundary as object/scanner failures.
let loadPolicy, scanText, parseRevisionRange, scanDir;

const trustedRoot = fileURLToPath(new URL('../../', import.meta.url));
const OID = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const ARCHIVE = /\.(?:zip|jar|war|ear|apk|aar|ipa|whl|egg|nupkg|vsix|xpi|crx|pptx|pptm|odt|ods|odp|odg|epub|tar|tgz|taz|tbz2?|tb2|txz|tzst|tlz4?|tsz|gz|gzip|bz2|bzip2|xz|zst|zstd|lz4?|lzma|lzo|sz|zz|br|z|7z|rar|cab|cpio|iso|dmg|xar|deb|rpm)$/i;
const protectedPath = name => /^(?:security\/|scripts\/|\.githooks\/|\.github\/|package\.json$|pnpm-(?:lock|workspace)\.yaml$|\.npmrc$|\.nvmrc$|\.gitignore$|tests\/)/.test(name)
  || /(?:^|\/)AGENTS\.md$/.test(name);
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL = 64 * 1024 * 1024;
const MAX_ENTRIES = 10000;
// Changed-file entries a published range may contain before the exact head
// needs owner approval. Full-history mode keeps only the hard caps above.
const APPROVAL_LIMIT = 1000;
const APPROVAL_ENV = 'VELCRO_HISTORY_APPROVED';
// Approved public-platform metadata, only for a raw historical committer role.
// This does not authenticate provenance or permit the platform as an author.
const platformCommitter = { name: 'GitHub', email: ['noreply', 'github.com'].join('@') };

const MESSAGES = {
  1: 'git-privacy: publication findings; details withheld',
  2: 'git-privacy: input, policy or scanner failure; details withheld',
  3: 'git-privacy: history scan exceeds 1,000 changed files; owner approval required',
};

class GuardError extends Error {
  constructor(code = 2) {
    super(MESSAGES[code] ?? MESSAGES[2]);
    this.code = code;
    this.stack = this.message;
  }
}
const fail = code => { throw new GuardError(code); };
const decode = buffer => new TextDecoder('utf-8', { fatal: true }).decode(buffer);

// Retain the proposed index (including git commit's temporary index), but no
// object substitutions, external diff, mailmap, injected config or alternate refs.
function environment(cwd, identity = false) {
  const env = { LANG: 'C', LC_ALL: 'C', GIT_NO_REPLACE_OBJECTS: '1',
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: devNull, GIT_ATTR_NOSYSTEM: '1', GIT_GRAFT_FILE: devNull,
    GIT_NO_LAZY_FETCH: '1' };
  for (const key of ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP']) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  if (process.env.GIT_INDEX_FILE) env.GIT_INDEX_FILE = path.resolve(cwd, process.env.GIT_INDEX_FILE);
  if (identity) {
    // git -c options propagate into hooks via these variables. Do not ignore a
    // user.name/user.email override that the actual commit will honor.
    for (const [key, value] of Object.entries(process.env)) {
      if (/^GIT_CONFIG_(?:PARAMETERS|COUNT|KEY_\d+|VALUE_\d+)$/.test(key)) env[key] = value;
    }
    for (const kind of ['AUTHOR', 'COMMITTER']) for (const field of ['NAME', 'EMAIL', 'DATE']) {
      const key = `GIT_${kind}_${field}`;
      if (process.env[key] !== undefined) env[key] = process.env[key];
    }
  }
  return env;
}

function repository(cwd) {
  const env = environment(cwd);
  function git(args, options = {}) {
    const result = spawnSync('git', ['-C', cwd, '-c', 'core.fsmonitor=false', '-c', 'core.pager=cat',
      '-c', 'core.commitGraph=false', '-c', 'log.mailmap=false', ...args], {
      env: options.identity ? environment(cwd, true) : env,
      input: options.input, timeout: 60000, maxBuffer: options.maxBuffer ?? MAX_TOTAL,
      stdio: ['pipe', 'pipe', 'pipe'], shell: false,
    });
    if (!result.error && result.status === 1 && options.missing) return Buffer.alloc(0);
    if (result.error || result.status !== 0 || result.signal) fail();
    return result.stdout;
  }
  const top = decode(git(['rev-parse', '--show-toplevel'])).trim();
  if (path.resolve(top) !== path.resolve(cwd)) fail();
  if (decode(git(['rev-parse', '--is-shallow-repository'])).trim() !== 'false') fail();
  const common = path.resolve(cwd, decode(git(['rev-parse', '--git-common-dir'])).trim());
  if (existsSync(path.join(common, 'info/grafts'))) fail();
  const resolve = revision => {
    const value = decode(git(['rev-parse', '--verify', '--end-of-options', `${revision}^{commit}`])).trim();
    if (!OID.test(value)) fail();
    return value;
  };
  return { git, resolve };
}

function checkIdentity(value, policy, role) {
  const match = /^(.*) <([^<>]+)> [0-9]+ [+-][0-9]{4}$/.exec(value);
  if (!match) fail(1);
  if (match[1] === policy.approvedIdentity.name && match[2] === policy.approvedIdentity.email) return;
  if (role === 'historical-committer' && match[1] === platformCommitter.name
    && match[2] === platformCommitter.email) return;
  fail(1);
}

function cleanText(text, label, policy) {
  if (scanText(text, label, { policy }).length) fail(1);
}

function pushInput() {
  const buffer = Buffer.alloc(65537);
  let length = 0;
  while (length < buffer.length) {
    const bytes = readSync(0, buffer, length, buffer.length - length, null);
    if (!bytes) break;
    length += bytes;
  }
  if (length > 65536) fail();
  return decode(buffer.subarray(0, length));
}

async function sourceScan(repo, policy, collect) {
  const scratch = mkdtempSync(path.join(tmpdir(), 'velcro-source-'));
  let total = 0;
  let entries = 0;
  let visits = 0;
  const blobs = new Set();
  const labels = new Set();
  function materialize(bytes) {
    total += bytes.length;
    if (bytes.length > MAX_BYTES || total > MAX_TOTAL || ++entries > MAX_ENTRIES) fail();
    // Numbered .txt names deliberately avoid the scanner's stock path filters.
    writeFileSync(path.join(scratch, `${entries}.txt`), bytes, { flag: 'wx', mode: 0o600 });
  }
  function blob(mode, oid, label, content) {
    if (++visits > MAX_ENTRIES) fail();
    cleanText('', label, policy);
    if (!['100644', '100755'].includes(mode) || !OID.test(oid)
      || ARCHIVE.test(label) || /(?:^|\/)\.gitleaksignore$/.test(label)) fail();
    // Paths can themselves contain credentials. Preserve their bytes as scan
    // content without using them as scanner-visible filenames or diagnostics.
    if (!labels.has(label)) { labels.add(label); materialize(Buffer.from(`source path: ${label}\n`)); }
    // Inspect every path, even if its blob was already inspected at another path.
    const bytes = content ?? repo.git(['cat-file', 'blob', oid], { maxBuffer: MAX_BYTES + 1 });
    cleanText(decode(bytes), label, policy);
    if (!blobs.has(oid)) { blobs.add(oid); materialize(bytes); }
  }
  try {
    collect({ blob, materialize });
    // Empty source still proves scanner availability and a completed real scan.
    if (!entries) materialize(Buffer.from('empty source\n'));
    const result = await scanDir({ target: scratch });
    if (result.excluded !== 0) fail();
    if (result.findings.length) fail(1);
    return { entries, bytes: total };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

// Raw `diff-tree -r -z` records: ":<old-mode> <new-mode> <old-oid> <new-oid> <status>\0<path>\0".
function treeDiff(repo, revisions) {
  const fields = decode(repo.git(['diff-tree', '-r', '-z', '--raw', '--no-abbrev', '--no-renames',
    '--no-commit-id', '--ignore-submodules=none', '--no-ext-diff', '--no-textconv', ...revisions])).split('\0');
  if (fields.at(-1) !== '') fail();
  fields.pop();
  if (fields.length % 2 || fields.length / 2 > MAX_ENTRIES) fail();
  const changes = new Map();
  for (let index = 0; index < fields.length; index += 2) {
    const match = /^:(\d{6}) (\d{6}) ([a-f0-9]+) ([a-f0-9]+) ([ADMT])$/.exec(fields[index]);
    const name = fields[index + 1];
    if (!match || !name || changes.has(name)) fail();
    // Deleted paths need no content scan: their bytes were checked when added.
    if (match[5] === 'D') { if (!/^0+$/.test(match[4])) fail(); continue; }
    changes.set(name, { mode: match[2], oid: match[4], name });
  }
  return changes;
}

// Every (mode, blob, path) a commit introduces relative to its parents. A root
// commit introduces its whole tree. A merge introduces exactly the paths whose
// result differs from every parent: content identical to some parent's path was
// already covered by that parent, while an evil merge's new content is not.
function introduced(repo, id, parents) {
  if (!parents.length) return treeDiff(repo, ['--root', id]);
  const [first, ...rest] = parents.map(parent => treeDiff(repo, [parent, id]));
  for (const other of rest) for (const name of first.keys()) if (!other.has(name)) first.delete(name);
  return first;
}

// Deduplicated changed-file entries for `tip` excluding commits reachable from
// `base` (the already verified published baseline); all ancestry without one.
function changedEntries(repo, tip, base) {
  const lines = decode(repo.git(['rev-list', '--parents', tip, ...(base ? [`^${base}`] : [])])).trim()
    .split('\n').filter(Boolean);
  if (lines.length > MAX_ENTRIES) fail();
  const entries = new Map();
  for (const line of lines) {
    const [id, ...parents] = line.split(' ');
    if (![id, ...parents].every(oid => OID.test(oid))) fail();
    for (const entry of introduced(repo, id, parents).values()) {
      entries.set(`${entry.mode} ${entry.oid}\0${entry.name}`, entry);
      if (entries.size > MAX_ENTRIES) fail();
    }
  }
  return { commits: lines.length, entries: [...entries.values()] };
}

function protectedChanges(repo, from, to) {
  const base = repo.resolve(from);
  const head = repo.resolve(to);
  const found = new Set();
  const check = revisions => {
    const names = decode(repo.git(['diff-tree', '--root', '--no-commit-id', '--name-only', '-r', '-z',
      '--no-renames', '--diff-merges=first-parent', ...revisions])).split('\0').filter(Boolean);
    for (const name of names) if (protectedPath(name)) found.add(name);
  };
  check([base, head]);
  const commits = decode(repo.git(['rev-list', head, `^${base}`])).trim().split('\n').filter(Boolean);
  if (commits.length > MAX_ENTRIES || commits.some(id => !OID.test(id))) fail();
  // A protected edit followed by a revert is still newly publishable history.
  for (const id of commits) check([id]);
  return found.size;
}

function reviewNotice(io, count) {
  io.stdout.write(count
    ? `git-privacy: human review required for ${count} protected path(s); merge/publication approval not granted\n`
    : 'git-privacy: no protected changes detected; merge/publication approval not granted\n');
}

function fetchedRef(repo, name, optional = false) {
  // Only direct, locally present commit OIDs are a known fetched baseline. No
  // network access, symbolic aliases, tag peeling or arbitrary caller baselines.
  if (decode(repo.git(['symbolic-ref', '-q', name], { missing: true })).trim()) fail();
  const oid = decode(repo.git(['rev-parse', '--verify', '--quiet', '--end-of-options', name], { missing: optional })).trim();
  if (!oid && optional) return null;
  if (!OID.test(oid) || repo.resolve(oid) !== oid) fail();
  return oid;
}

// One `cat-file --batch` read instead of a process per blob. Every response must
// be the requested OID, a blob and within the per-file bound.
function readBlobs(repo, oids) {
  const unique = [...new Set(oids)];
  const blobs = new Map();
  if (!unique.length) return blobs;
  const output = repo.git(['cat-file', '--batch'], { input: unique.map(oid => `${oid}\n`).join(''),
    maxBuffer: MAX_TOTAL + unique.length * 160 });
  let offset = 0;
  for (const oid of unique) {
    const end = output.indexOf(0x0a, offset);
    if (end < 0) fail();
    const match = /^([a-f0-9]+) blob (\d+)$/.exec(decode(output.subarray(offset, end)));
    if (!match || match[1] !== oid || Number(match[2]) > MAX_BYTES) fail();
    const start = end + 1;
    const stop = start + Number(match[2]);
    if (output.length < stop + 1 || output[stop] !== 0x0a) fail();
    blobs.set(oid, output.subarray(start, stop));
    offset = stop + 1;
  }
  if (offset !== output.length) fail();
  return blobs;
}

// Commit metadata and messages are always scanned across the tip's full
// ancestry (cheap). File content is scanned only where a commit changed it:
// in full-history mode (no base) across all ancestry under the hard caps; with
// a base, only for commits not reachable from that already verified published
// baseline, where more than APPROVAL_LIMIT entries need exact-head approval.
async function history(repo, oid, policy, { base, approval } = {}) {
  const commits = decode(repo.git(['rev-list', oid])).trim().split('\n');
  if (commits.length > MAX_ENTRIES || commits.some(id => !OID.test(id))) fail();
  const range = changedEntries(repo, oid, base);
  if (base && range.entries.length > APPROVAL_LIMIT && approval !== oid) fail(3);
  await sourceScan(repo, policy, ({ blob, materialize }) => {
    for (const id of commits) {
      const bytes = repo.git(['cat-file', 'commit', id], { maxBuffer: MAX_BYTES + 1 });
      const raw = decode(bytes);
      const split = raw.indexOf('\n\n');
      if (split < 0) fail();
      const headers = raw.slice(0, split).split('\n');
      for (const field of ['author', 'committer']) {
        const values = headers.filter(line => line.startsWith(`${field} `));
        if (values.length !== 1) fail();
        checkIdentity(values[0].slice(field.length + 1), policy,
          field === 'committer' ? 'historical-committer' : undefined);
      }
      // Other headers (including signatures/encoding) receive normal scanning.
      cleanText(headers.filter(line => !/^(?:author|committer) /.test(line)).join('\n'), 'metadata.txt', policy);
      cleanText(raw.slice(split + 2), 'message.txt', policy);
      materialize(bytes);
    }
    // Mode, archive and path checks run in blob() before any content is used.
    const contents = readBlobs(repo, range.entries.filter(entry => ['100644', '100755'].includes(entry.mode))
      .map(entry => entry.oid));
    for (const entry of range.entries) blob(entry.mode, entry.oid, entry.name, contents.get(entry.oid));
  });
  return { commits: commits.length, rangeCommits: range.commits, entries: range.entries.length };
}

function historyNotice(io, result) {
  io.stdout.write(`git-privacy: history metadata ${result.commits} commit(s); content ${result.entries} changed file entr${
    result.entries === 1 ? 'y' : 'ies'} in ${result.rangeCommits} commit(s)\n`);
}

export async function main(args, { cwd = process.cwd(), input, io = process, env = process.env } = {}) {
  try {
    ({ loadPolicy, scanText } = await import('./privacy.mjs'));
    ({ parseRevisionRange, scanDir } = await import('./gitleaks.mjs'));
    const policy = await loadPolicy(trustedRoot);
    const repo = repository(cwd);
    const [command, ...rest] = args;
    if (command === 'identity' && rest.length === 0) {
      const config = key => decode(repo.git(['config', '--local', '--get', key], { missing: true })).trim();
      if (config('user.useConfigOnly') !== 'true' || config('user.name') !== policy.approvedIdentity.name
        || config('user.email') !== policy.approvedIdentity.email) fail(1);
      for (const field of ['AUTHOR', 'COMMITTER']) {
        checkIdentity(decode(repo.git(['var', `GIT_${field}_IDENT`], { identity: true })).trim(), policy);
      }
    } else if (command === 'message' && rest.length === 1) {
      const stat = lstatSync(rest[0]);
      if (!stat.isFile() || stat.size > MAX_BYTES) fail();
      const bytes = readFileSync(rest[0]);
      cleanText(decode(bytes), 'message.txt', policy);
      await sourceScan(repo, policy, ({ materialize }) => materialize(bytes));
    } else if (command === 'staged' && rest.length === 0) {
      await sourceScan(repo, policy, ({ blob }) => {
        const records = decode(repo.git(['ls-files', '--stage', '-z'])).split('\0').filter(Boolean);
        if (records.length > MAX_ENTRIES) fail();
        for (const record of records) {
          const match = /^(\d+) ([a-f0-9]+) 0\t([\s\S]+)$/.exec(record);
          if (!match) fail();
          blob(match[1], match[2], match[3]);
        }
      });
    } else if (command === 'history' && rest.length <= 1) {
      const range = rest.length ? parseRevisionRange(rest[0]) : { to: 'HEAD' };
      // A range's lower bound must be already verified published history (the
      // fetched main or a PR base): its content is trusted, its metadata is not.
      const base = range.from ? repo.resolve(range.from) : undefined;
      const tip = repo.resolve(range.to);
      historyNotice(io, await history(repo, tip, policy, { base, approval: env[APPROVAL_ENV] }));
    } else if (command === 'pre-push' && rest.length <= 1) {
      if (rest.length && rest[0] !== 'origin') fail();
      // Include command-scope push configuration when rejecting configured mirror
      // mode, while object traversal below retains its scrubbed environment.
      const mirror = decode(repo.git(['config', '--bool', '--get', 'remote.origin.mirror'],
        { identity: true, missing: true })).trim();
      if (mirror === 'true') fail();
      const text = input ?? pushInput();
      if (Buffer.byteLength(text) > 65536) fail();
      const lines = text.trim().split('\n');
      // Routine PR flow: one feature branch only. Initial trust is established
      // manually with the same standalone full-ancestry checks, not a bypass flag.
      if (lines.length !== 1) fail();
      const fields = lines[0].split(' ');
      if (fields.length !== 4 || !fields[0].startsWith('refs/heads/') || fields[0] !== fields[2]
        || fields[2] === 'refs/heads/main' || !OID.test(fields[1]) || /^0+$/.test(fields[1])
        || !OID.test(fields[3]) || fields[1].length !== fields[3].length) fail();
      repo.git(['check-ref-format', fields[2]]);
      cleanText(fields[2], 'ref.txt', policy);
      if (repo.resolve(fields[1]) !== fields[1]) fail();
      const mainRef = 'refs/remotes/origin/main';
      const featureRef = `refs/remotes/origin/${fields[2].slice('refs/heads/'.length)}`;
      const base = fetchedRef(repo, mainRef);
      repo.git(['merge-base', '--is-ancestor', base, fields[1]]);
      const old = fetchedRef(repo, featureRef, true);
      if (/^0+$/.test(fields[3])) {
        if (old !== null) fail();
      } else {
        if (old !== fields[3]) fail();
        repo.git(['merge-base', '--is-ancestor', old, fields[1]]);
      }
      await sourceScan(repo, policy, ({ materialize }) => materialize(Buffer.from(`${fields[0]}\n${fields[2]}\n`)));
      const result = await history(repo, fields[1], policy, { base, approval: env[APPROVAL_ENV] });
      const count = protectedChanges(repo, base, fields[1]);
      if (fetchedRef(repo, mainRef) !== base || fetchedRef(repo, featureRef, true) !== old) fail();
      historyNotice(io, result);
      reviewNotice(io, count);
    } else if (command === 'policy' && rest.length === 2) {
      if (rest.some(id => !OID.test(id))) fail();
      reviewNotice(io, protectedChanges(repo, rest[0], rest[1]));
      return 0;
    } else fail();
    io.stdout.write('git-privacy: checks passed for the requested source scope\n');
    return 0;
  } catch (error) {
    const safe = error instanceof GuardError ? error : new GuardError();
    io.stderr.write(`${safe.message}\n`);
    return safe.code;
  }
}

if (typeof import.meta.main !== 'boolean') {
  process.stderr.write('git-privacy: supported pinned Node runtime required\n');
  process.exitCode = 2;
} else if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
