import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const script = path.join(repoRoot, 'scripts', 'security', 'artifacts.mjs');
const targetKey = `${process.platform}-${process.arch}`;
const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;

const scratchDirs = [];
after(() => {
  for (const dir of scratchDirs) rmSync(dir, { recursive: true, force: true });
});

function scratch(label) {
  const dir = mkdtempSync(path.join(tmpdir(), `velcro-artifacts-${label}-`));
  scratchDirs.push(dir);
  return dir;
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

// Sensitive-looking values are assembled at runtime so no such literal is committed.
function syntheticToken() {
  let body = '';
  for (const byte of randomBytes(36)) body += ALPHANUMERIC[byte % ALPHANUMERIC.length];
  return ['gh', 'p_'].join('') + body;
}
const syntheticPath = () => ['', 'Users', `fixture-${randomBytes(3).toString('hex')}`, 'project'].join('/');
const syntheticEmail = () => [`private.person.${randomBytes(3).toString('hex')}`, 'example.invalid'].join('@');
const syntheticEndpoint = () => `http://${['10', '0', '0', '12'].join('.')}:8080/status`;

function write(dir, name, content) {
  const file = path.join(dir, name);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
  return file;
}

function forbiddenFragments(dir, ...extra) {
  const values = [tmpdir(), homedir(), repoRoot, dir, ...extra];
  for (const value of [tmpdir(), dir]) {
    try {
      values.push(realpathSync(value));
    } catch {
      // not resolvable
    }
  }
  return values.filter((value) => typeof value === 'string' && value.length > 2);
}

// Never pass hostile output to assertion helpers that echo the actual value.
function assertNoLeak(output, values, context) {
  for (const value of values) assert.ok(!output.includes(value), `${context}: output contains a forbidden value`);
}

function run(args, { cwd, entry = script, extra = [], timeout = 120_000, env = process.env } = {}) {
  const dir = cwd ?? scratch('cwd');
  const result = spawnSync(process.execPath, [entry, ...args], { cwd: dir, encoding: 'utf8', timeout, env });
  assert.equal(result.error, undefined, 'subprocess did not complete');
  assert.equal(result.signal, null, 'subprocess was killed');
  assertNoLeak(`${result.stdout}${result.stderr}`, forbiddenFragments(dir, ...extra), 'CLI output');
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, output: `${result.stdout}${result.stderr}` };
}

// ---------------------------------------------------------------------------

describe('clean text', () => {
  test('public URLs and prose pass with exact byte hashes and counts', () => {
    const dir = scratch('clean');
    const body = 'Fix the outbound guard.\n\nSee https://example.com/docs/guide and https://github.com/example-org/example-repo/pull/1\n';
    const file = write(dir, 'pr-body.md', body);
    const result = run([file], { cwd: dir, extra: ['pr-body'] });
    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
    assert.ok(result.stdout.includes('fully inspected: no findings'));
    assert.ok(result.stdout.includes(`sha256 ${sha256(Buffer.from(body))}`));
    assert.ok(result.stdout.includes(`${Buffer.byteLength(body)} bytes`));
    assert.ok(result.stdout.includes('3 lines'));
    assert.ok(result.stdout.includes('sends nothing'));
    assert.ok(result.stdout.includes('does not detect all credentials or personal data'));
  });

  test('relative paths, .txt, several inputs and a private scratch directory work', () => {
    const dir = scratch('multi');
    write(dir, '.airig/title.txt', 'Add a bounded outbound text guard\n');
    write(dir, 'notes.MD', '# Release notes\n\nPublic docs: https://example.com/\n');
    const result = run(['.airig/title.txt', './notes.MD'], { cwd: dir, extra: ['title', 'notes'] });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /2 text inputs/);
    assert.ok(result.stdout.includes('outbound/text-1.txt'));
    assert.ok(result.stdout.includes('outbound/text-2.txt'));
    assert.ok(!result.stdout.includes('.airig'));
    assert.match(result.stdout, /ordered inputs sha256 [0-9a-f]{64}/);
  });

  test('hash covers exact bytes: CRLF and BOM are preserved', () => {
    const dir = scratch('bytes');
    const lf = Buffer.from('same words\nsecond line\n');
    const crlf = Buffer.from('same words\r\nsecond line\r\n');
    const bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), lf]);
    const hashes = new Set();
    for (const [name, bytes] of [
      ['a.txt', lf],
      ['b.txt', crlf],
      ['c.txt', bom],
    ]) {
      const result = run([write(dir, name, bytes)], { cwd: dir });
      assert.equal(result.status, 0);
      assert.ok(result.stdout.includes(`sha256 ${sha256(bytes)}`));
      hashes.add(sha256(bytes));
    }
    assert.equal(hashes.size, 3);
    const again = run([path.join(dir, 'a.txt')], { cwd: dir });
    assert.ok(again.stdout.includes(`sha256 ${sha256(lf)}`), 'hash is deterministic');
  });
});

describe('findings', () => {
  const cases = {
    'machine path': { rule: 'machine-path', make: () => `Reproduce in ${syntheticPath()}/build\n` },
    email: { rule: 'email', make: () => `Contact ${syntheticEmail()} for details\n` },
    'private endpoint': { rule: 'private-endpoint', make: () => `Health check at ${syntheticEndpoint()}\n` },
  };
  for (const [name, { rule, make }] of Object.entries(cases)) {
    test(`${name} is a finding with a logical label and line, never the value`, () => {
      const dir = scratch('finding');
      const value = make();
      const sensitive = value.trim().split(' ').find((word) => /[/@]/.test(word)) ?? value;
      const text = `clean first line\n${value}`;
      const file = write(dir, 'body.md', text);
      const result = run([file], { cwd: dir, extra: [sensitive, 'body.md'] });
      assert.equal(result.status, 1);
      assert.ok(result.stdout.includes(`outbound/text-1.txt:2 ${rule}`));
      assert.ok(!result.stdout.includes('no findings'));
      assert.equal(result.stderr, '');
      assert.ok(!result.stdout.includes(sha256(Buffer.from(text))), 'no hash is offered for a rejected text');
    });
  }

  test('a real pinned Gitleaks positive is reported by rule and line only', () => {
    const dir = scratch('token');
    const token = syntheticToken();
    const file = write(dir, 'release.txt', `Release notes\nthe token is ${token}\n`);
    const result = run([file], { cwd: dir, extra: [token, 'release.txt'] });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /outbound\/text-1\.txt:2 gitleaks:[a-z0-9-]+/);
    assert.ok(!result.stdout.includes('no findings'));
  });

  test('findings are attributed to the right input and every input is still inspected', () => {
    const dir = scratch('attrib');
    const token = syntheticToken();
    const a = write(dir, 'a.md', 'fine\n');
    const b = write(dir, 'b.md', `leak ${token}\n`);
    const c = write(dir, 'c.md', `mail ${syntheticEmail()}\n`);
    const result = run([a, b, c], { cwd: dir, extra: [token] });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /outbound\/text-2\.txt:1 gitleaks:/);
    assert.match(result.stdout, /outbound\/text-3\.txt:1 email/);
    assert.ok(!result.stdout.includes('outbound/text-1.txt:'));
  });
});

describe('stock path exclusions cannot hide text', () => {
  for (const name of ['package-lock.txt', 'node_modules/pkg/notes.md', 'vendor/CHANGELOG.md', 'yarn.lock.txt', 'go.sum.md', 'dist/notes.txt']) {
    test(`a secret in an input named ${name} is still found`, () => {
      const dir = scratch('exclusion');
      const token = syntheticToken();
      const file = write(dir, name, `value ${token}\n`);
      const result = run([file], { cwd: dir, extra: [token] });
      assert.equal(result.status, 1);
      assert.match(result.stdout, /outbound\/text-1\.txt:1 gitleaks:/);
    });
  }
});

describe('input failures are closed', () => {
  function expectFailure(args, reasonText, { cwd, extra = [] } = {}) {
    const result = run(args, { cwd, extra });
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '', 'no partial success output');
    assert.ok(result.stderr.includes(reasonText), `expected reason: ${reasonText}`);
    assert.ok(result.stderr.includes('details withheld'));
    return result;
  }

  test('inputs are required and options/bypass flags are rejected', () => {
    const dir = scratch('usage');
    const file = write(dir, 'ok.txt', 'fine\n');
    expectFailure([], 'usage error', { cwd: dir });
    for (const flag of ['--skip', '--no-gitleaks', '--allow', '-h', '--', '--ignore-privacy=1']) {
      expectFailure([flag, file], 'usage error', { cwd: dir });
    }
    expectFailure([file, ''], 'usage error', { cwd: dir });
  });

  test('unsupported types fail without being read', () => {
    const dir = scratch('types');
    for (const name of ['image.png', 'bundle.zip', 'package.tgz', 'archive.tar.gz', 'data.json', 'noextension', 'script.mjs', '.md', 'text.txt.png']) {
      expectFailure([write(dir, name, 'plain words\n')], 'not a supported .txt or .md file', { cwd: dir });
    }
  });

  test('directories, symlinks, missing and special files fail closed', () => {
    const dir = scratch('special');
    mkdirSync(path.join(dir, 'folder.md'));
    expectFailure([path.join(dir, 'folder.md')], 'not a regular file', { cwd: dir });
    const real = write(dir, 'real.txt', 'fine\n');
    symlinkSync(real, path.join(dir, 'link.txt'));
    expectFailure([path.join(dir, 'link.txt')], 'not a regular file', { cwd: dir });
    symlinkSync(dir, path.join(dir, 'dirlink.md'));
    expectFailure([path.join(dir, 'dirlink.md')], 'not a regular file', { cwd: dir });
    symlinkSync(path.join(dir, 'nowhere.txt'), path.join(dir, 'dangling.txt'));
    expectFailure([path.join(dir, 'dangling.txt')], 'not a regular file', { cwd: dir });
    expectFailure([path.join(dir, 'missing.txt')], 'missing or unreadable', { cwd: dir });
  });

  test('a FIFO is rejected without opening it (no blocking)', () => {
    const dir = scratch('fifo');
    const fifo = path.join(dir, 'pipe.txt');
    const made = spawnSync('mkfifo', [fifo]);
    assert.equal(made.status, 0, 'fixture FIFO creation failed');
    const started = Date.now();
    const result = run([fifo], { cwd: dir, timeout: 30_000 });
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.ok(result.stderr.includes('not a regular file'));
    assert.ok(Date.now() - started < 20_000);
  });

  test('empty, oversized, non-UTF-8 and control-character files fail', () => {
    const dir = scratch('content');
    expectFailure([write(dir, 'empty.txt', '')], 'empty', { cwd: dir });
    expectFailure([write(dir, 'big.txt', Buffer.alloc(1024 * 1024 + 1, 0x61))], 'exceeds the size limit', { cwd: dir });
    expectFailure([write(dir, 'latin1.txt', Buffer.from([0x68, 0x69, 0xe9, 0x0a]))], 'not valid UTF-8', { cwd: dir });
    expectFailure([write(dir, 'overlong.txt', Buffer.from([0xc0, 0xaf, 0x0a]))], 'not valid UTF-8', { cwd: dir });
    expectFailure([write(dir, 'nul.txt', Buffer.from('a\0b\n'))], 'control characters', { cwd: dir });
    expectFailure([write(dir, 'escape.md', 'color \u001b[31mred\n')], 'control characters', { cwd: dir });
  });

  test('a file at exactly the per-file limit is accepted', () => {
    const dir = scratch('limit');
    const bytes = Buffer.alloc(1024 * 1024, 0x61);
    const result = run([write(dir, 'limit.txt', bytes)], { cwd: dir });
    assert.equal(result.status, 0);
    assert.ok(result.stdout.includes(`sha256 ${sha256(bytes)}`));
  });

  test('count, total-size and duplicate bounds fail before any success output', () => {
    const dir = scratch('bounds');
    const files = Array.from({ length: 17 }, (_, i) => write(dir, `f${i}.txt`, `file ${i}\n`));
    expectFailure(files, 'too many inputs', { cwd: dir });
    const large = Array.from({ length: 5 }, (_, i) => write(dir, `large${i}.txt`, Buffer.alloc(900 * 1024, 0x62 + i)));
    expectFailure(large, 'exceeds the size limit', { cwd: dir });
    expectFailure([files[0], files[0]], 'more than once', { cwd: dir });
    linkSync(files[1], path.join(dir, 'hardlink.txt'));
    expectFailure([files[1], path.join(dir, 'hardlink.txt')], 'more than once', { cwd: dir });
  });

  test('one bad input fails the whole run even when others are clean or sensitive', () => {
    const dir = scratch('mixed');
    const good = write(dir, 'good.txt', 'fine words\n');
    const sensitive = write(dir, 'sensitive.txt', `mail ${syntheticEmail()}\n`);
    const result = expectFailure([good, sensitive, path.join(dir, 'absent.txt')], 'missing or unreadable', { cwd: dir });
    assert.ok(result.stderr.includes('input 3'));
    assert.ok(!result.output.includes('no findings'));
    assert.ok(!result.output.includes('email'));
  });

  test('an unreadable file fails closed', { skip: isRoot ? 'permissions do not deny root' : false }, () => {
    const dir = scratch('perm');
    const file = write(dir, 'secret.txt', 'fine words\n');
    chmodSync(file, 0o000);
    try {
      expectFailure([file], 'missing or unreadable', { cwd: dir });
    } finally {
      chmodSync(file, 0o600);
    }
  });
});

describe('safe errors', () => {
  test('hostile file names never appear in any output', () => {
    const dir = scratch('names');
    const hostile = `jane.doe.${randomBytes(3).toString('hex')}`;
    const name = `${hostile}-${['gh', 'p_'].join('')}name.md`;
    const clean = write(dir, name, 'fine words\n');
    const ok = run([clean], { cwd: dir, extra: [hostile, name] });
    assert.equal(ok.status, 0);
    const bad = run([path.join(dir, `${hostile}.png`), clean], { cwd: dir, extra: [hostile, name] });
    assert.equal(bad.status, 2);
    const missing = run([path.join(dir, `${hostile}-missing.md`)], { cwd: dir, extra: [hostile] });
    assert.equal(missing.status, 2);
  });

  test('stack traces and exception text are never printed', () => {
    const dir = scratch('traces');
    const result = run([path.join(dir, 'missing.txt')], { cwd: dir });
    assert.equal(result.status, 2);
    assert.ok(!/\bat\s+\S+\s+\(|node:internal|ENOENT|Error:/.test(result.output));
    assert.ok(!result.output.includes('.mjs'));
  });
});

// ---------------------------------------------------------------------------
// Hermetic tool roots: a copy of the engines with a controlled scanner, so
// scanner failure paths are tested without altering the real scanner.

const MANIFEST = JSON.parse(readFileSync(path.join(repoRoot, 'security', 'gitleaks-checksums.json'), 'utf8'));

function toolRoot(label, { policy } = {}) {
  const root = scratch(`tool-${label}`);
  mkdirSync(path.join(root, 'scripts', 'security'), { recursive: true });
  mkdirSync(path.join(root, 'security'), { recursive: true });
  for (const name of ['artifacts.mjs', 'privacy.mjs', 'gitleaks.mjs']) {
    copyFileSync(path.join(repoRoot, 'scripts', 'security', name), path.join(root, 'scripts', 'security', name));
  }
  copyFileSync(path.join(repoRoot, 'security', 'gitleaks-checksums.json'), path.join(root, 'security', 'gitleaks-checksums.json'));
  if (policy === undefined) copyFileSync(path.join(repoRoot, 'security', 'policy.json'), path.join(root, 'security', 'policy.json'));
  else writeFileSync(path.join(root, 'security', 'policy.json'), policy);
  return { root, entry: path.join(root, 'scripts', 'security', 'artifacts.mjs') };
}

function binaryPath(root) {
  return path.join(root, '.airig', 'tools', 'gitleaks', '8.30.1', targetKey, 'gitleaks');
}

// Install a fake scanner and pin its hash in this tool root's own manifest copy.
function installFake(root, body) {
  const file = binaryPath(root);
  mkdirSync(path.dirname(file), { recursive: true });
  const content = `#!${process.execPath}\n${body}\n`;
  writeFileSync(file, content, { mode: 0o755 });
  chmodSync(file, 0o755);
  const manifest = structuredClone(MANIFEST);
  manifest.targets[targetKey].executableSha256 = sha256(Buffer.from(content));
  writeFileSync(path.join(root, 'security', 'gitleaks-checksums.json'), JSON.stringify(manifest));
}

function fakeBody({ exit = 0, stdout = '[]', stderr = '', before = '' }) {
  return [
    "const fs = require('node:fs');",
    before,
    stderr ? `fs.writeSync(2, ${JSON.stringify(stderr)});` : '',
    `process.stdout.write(${JSON.stringify(stdout)}, () => process.exit(${exit}));`,
  ].join('\n');
}

function expectScannerFailure(label, body, text) {
  const tool = toolRoot(label);
  installFake(tool.root, body);
  const dir = scratch('input');
  const file = write(dir, 'body.md', 'fine words\n');
  const result = run([file], { cwd: dir, entry: tool.entry, extra: [tool.root] });
  assert.equal(result.status, 2, label);
  assert.equal(result.stdout, '', `${label}: no success output`);
  assert.ok(result.stderr.includes(text), `${label}: expected ${text}`);
  assert.ok(!result.output.includes('no findings'));
  return result;
}

describe('scanner and policy failures never look clean', () => {
  test('a controlled fake scanner reporting no findings gives a clean result (positive control)', () => {
    const tool = toolRoot('control');
    installFake(tool.root, fakeBody({ exit: 0, stdout: '[]' }));
    const dir = scratch('input');
    const result = run([write(dir, 'body.md', 'fine words\n')], { cwd: dir, entry: tool.entry, extra: [tool.root] });
    assert.equal(result.status, 0);
    assert.ok(result.stdout.includes('no findings'));
  });

  test('missing scanner fails with exit 2', () => {
    const tool = toolRoot('missing');
    const dir = scratch('input');
    const result = run([write(dir, 'body.md', 'fine words\n')], { cwd: dir, entry: tool.entry, extra: [tool.root] });
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.ok(result.stderr.includes('pinned secret scanner failure'));
    assert.ok(result.stderr.includes('binary-missing'));
  });

  test('corrupt scanner (checksum mismatch) fails with exit 2', () => {
    const tool = toolRoot('corrupt');
    const file = binaryPath(tool.root);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `#!${process.execPath}\nprocess.stdout.write('[]');\n`, { mode: 0o755 });
    const dir = scratch('input');
    const result = run([write(dir, 'body.md', 'fine words\n')], { cwd: dir, entry: tool.entry, extra: [tool.root] });
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.ok(result.stderr.includes('binary-checksum-mismatch'));
  });

  test('a malformed or missing trusted policy fails with exit 2', () => {
    for (const [label, policy] of [
      ['bad', '{"version":1}'],
      ['junk', 'not json'],
      ['absent', undefined],
    ]) {
      const tool = toolRoot(`policy-${label}`, { policy });
      if (policy === undefined) rmSync(path.join(tool.root, 'security', 'policy.json'));
      installFake(tool.root, fakeBody({}));
      const dir = scratch('input');
      const result = run([write(dir, 'body.md', 'fine words\n')], { cwd: dir, entry: tool.entry, extra: [tool.root] });
      assert.equal(result.status, 2, label);
      assert.equal(result.stdout, '');
      assert.ok(result.stderr.includes('trusted privacy policy or engine unavailable'));
    }
  });

  test('abnormal exits, malformed reports and skipped content are failures', () => {
    expectScannerFailure('exit1', fakeBody({ exit: 1, stdout: '[]' }), 'scanner-failed');
    expectScannerFailure('garbage', fakeBody({ exit: 0, stdout: 'not json' }), 'scanner-output-invalid');
    expectScannerFailure('leak-no-findings', fakeBody({ exit: 99, stdout: '[]' }), 'scanner-output-invalid');
    expectScannerFailure('empty-output', fakeBody({ exit: 0, stdout: '' }), 'scanner-output-invalid');
    expectScannerFailure('binary-skip', fakeBody({ stderr: '1:00AM WRN skipping binary file: x\n' }), 'content-unsupported');
    expectScannerFailure('error-line', fakeBody({ stderr: '1:00AM ERR failed to read\n' }), 'scan-incomplete');
  });

  test('a non-zero stock exclusion count is a failure, never a clean pass', () => {
    const result = expectScannerFailure(
      'exclusion',
      fakeBody({ stderr: '1:00AM DBG skipping file: global allowlist\n' }),
      'refusing to report clean',
    );
    assert.ok(result.stderr.includes('input 1'));
  });

  test('a scanner killed by a signal or crashing in silence fails', () => {
    expectScannerFailure('signal', "process.kill(process.pid, 'SIGKILL');", 'scanner-failed');
    expectScannerFailure('throws', "throw new Error('boom');", 'scanner-failed');
  });

  test('scanner findings print only rule and line, not scanner-provided file or secret fields', () => {
    const tool = toolRoot('findings');
    const marker = `marker-${randomBytes(4).toString('hex')}`;
    const finding = { RuleID: 'github-pat', StartLine: 1, File: `${marker}/1.txt`, Commit: '', Match: marker, Secret: marker };
    installFake(tool.root, fakeBody({ exit: 99, stdout: JSON.stringify([finding]) }));
    const dir = scratch('input');
    const result = run([write(dir, 'body.md', 'fine words\n')], { cwd: dir, entry: tool.entry, extra: [tool.root, marker] });
    assert.equal(result.status, 1);
    assert.ok(result.stdout.includes('outbound/text-1.txt:1 gitleaks:github-pat'));
  });
});

describe('byte snapshots', () => {
  test('the scanner sees exactly the snapshot bytes under a numbered .txt name, not the original path', () => {
    const tool = toolRoot('materialize');
    const record = path.join(scratch('record'), 'seen.json');
    const probe =
      'const names = fs.readdirSync(process.cwd()); ' +
      `fs.writeFileSync(${JSON.stringify(record)}, JSON.stringify({ names, content: names.map((n) => fs.readFileSync(n, 'utf8')), args: process.argv.slice(2) }));`;
    installFake(tool.root, fakeBody({ before: probe }));
    const dir = scratch('input');
    const body = 'snapshot words\nsecond line\n';
    const file = write(dir, 'package-lock.md', body);
    const result = run([file], { cwd: dir, entry: tool.entry, extra: [tool.root, 'package-lock'] });
    assert.equal(result.status, 0);
    const seen = JSON.parse(readFileSync(record, 'utf8'));
    assert.deepEqual(seen.names, ['1.txt']);
    assert.deepEqual(seen.content, [body]);
    assert.ok(!seen.args.some((arg) => arg.includes('package-lock') || arg.includes(dir)));
    assert.ok(result.stdout.includes(`sha256 ${sha256(Buffer.from(body))}`));
  });

  test('mutating the original after it was snapshotted cannot change what is hashed or reported', () => {
    const tool = toolRoot('mutate-original');
    const dir = scratch('input');
    const original = 'original approved words\n';
    const file = write(dir, 'body.md', original);
    const replacement = `mail ${syntheticEmail()}\n`;
    installFake(tool.root, fakeBody({ before: `fs.writeFileSync(${JSON.stringify(file)}, ${JSON.stringify(replacement)});` }));
    const result = run([file], { cwd: dir, entry: tool.entry, extra: [tool.root] });
    assert.equal(result.status, 0);
    assert.ok(result.stdout.includes(`sha256 ${sha256(Buffer.from(original))}`));
    assert.equal(readFileSync(file, 'utf8'), replacement, 'fixture mutated the original path during the scan');
  });

  test('scratch bytes that change during the scan are not reported clean', () => {
    const tool = toolRoot('mutate-scratch');
    installFake(tool.root, fakeBody({ before: "fs.writeFileSync('1.txt', 'different bytes\\n');" }));
    const dir = scratch('input');
    const result = run([write(dir, 'body.md', 'fine words\n')], { cwd: dir, entry: tool.entry, extra: [tool.root] });
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.ok(result.stderr.includes('refusing to report clean'));
  });

  test('scratch material is removed after clean and failed runs', () => {
    const tool = toolRoot('cleanup');
    const tmp = scratch('tmp');
    const dir = scratch('input');
    const file = write(dir, 'body.md', 'fine words\n');
    for (const body of [fakeBody({}), fakeBody({ exit: 1, stdout: '[]' })]) {
      installFake(tool.root, body);
      const result = run([file], { cwd: dir, entry: tool.entry, extra: [tool.root], env: { ...process.env, TMPDIR: tmp } });
      assert.ok(result.status === 0 || result.status === 2);
      assert.deepEqual(readdirSync(tmp), [], 'outbound scratch was removed');
    }
  });
});
