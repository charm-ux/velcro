import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, readFileSync, copyFileSync, chmodSync, symlinkSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir, devNull } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { installedBinary } from '../../scripts/security/gitleaks.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const script = path.join(root, 'scripts/security/git-privacy.mjs');
const policy = JSON.parse(readFileSync(path.join(root, 'security/policy.json'), 'utf8'));
const dirs = [];
after(() => dirs.forEach(dir => rmSync(dir, { recursive: true, force: true })));
const identity = policy.approvedIdentity;
const env = { ...process.env, GIT_CONFIG_GLOBAL: devNull, GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: identity.name, GIT_AUTHOR_EMAIL: identity.email,
  GIT_COMMITTER_NAME: identity.name, GIT_COMMITTER_EMAIL: identity.email };
function git(repo, args, input, extra = {}) {
  const result = spawnSync('git', ['-C', repo, '-c', 'commit.gpgsign=false', ...args],
    { env: { ...env, ...extra }, input, encoding: 'utf8' });
  assert.equal(result.status, 0, 'fixture Git operation failed');
  return result.stdout.trim();
}
function fixture() {
  const repo = mkdtempSync(path.join(tmpdir(), 'velcro-guard-'));
  dirs.push(repo);
  git(repo, ['init', '-q', '-b', 'main']);
  git(repo, ['config', 'user.useConfigOnly', 'true']);
  git(repo, ['config', 'user.name', identity.name]);
  git(repo, ['config', 'user.email', identity.email]);
  return repo;
}
function commit(repo, content = 'clean\n', extra = {}) {
  writeFileSync(path.join(repo, 'source.txt'), content);
  git(repo, ['add', '--', 'source.txt']);
  git(repo, ['commit', '-q', '-m', 'fixture change'], undefined, extra);
  return git(repo, ['rev-parse', 'HEAD']);
}
function scan(repo, args, { input, extra, executable = script, notice } = {}) {
  const result = spawnSync(process.execPath, [executable, ...args], {
    cwd: repo, env: { ...env, VELCRO_HISTORY_APPROVED: undefined, ...extra }, input, encoding: 'utf8', timeout: 120000,
  });
  const output = `${result.stdout}${result.stderr}`;
  assert.ok(!output.includes(repo), 'diagnostic exposed fixture location');
  if (notice) assert.ok(output.includes(notice), 'expected sanitized notice missing');
  return { status: result.status, output };
}
const run = (repo, args, options) => scan(repo, args, options).status;
const unsafe = () => ['', 'ho' + 'me', 'fixture-person', 'private'].join('/');

test('staged scans exact blobs, not the clean working copy', () => {
  const repo = fixture();
  commit(repo);
  writeFileSync(path.join(repo, 'source.txt'), unsafe());
  git(repo, ['add', '--', 'source.txt']);
  writeFileSync(path.join(repo, 'source.txt'), 'clean\n');
  assert.equal(run(repo, ['staged']), 1);
});

test('alternate proposed index is honored', () => {
  const repo = fixture();
  commit(repo);
  const index = path.join(repo, 'proposed-index');
  git(repo, ['read-tree', 'HEAD'], undefined, { GIT_INDEX_FILE: index });
  const blob = git(repo, ['hash-object', '-w', '--stdin'], unsafe());
  git(repo, ['update-index', '--cacheinfo', `100644,${blob},source.txt`], undefined, { GIT_INDEX_FILE: index });
  assert.equal(run(repo, ['staged'], { extra: { GIT_INDEX_FILE: index } }), 1);
});

test('full history rejects dirty ancestors despite a clean tip and replacement refs', () => {
  const repo = fixture();
  const bad = commit(repo, unsafe());
  const clean = commit(repo);
  git(repo, ['replace', '--graft', clean]);
  assert.equal(run(repo, ['history', clean]), 1);
  assert.equal(run(repo, ['history']), 1);
  // A range's base is already verified published history: its file content is
  // not rescanned (owner decision), but its commit metadata still is.
  // The base must be the fetched main or its ancestor.
  assert.equal(run(repo, ['history', `${bad}..${clean}`]), 2);
  git(repo, ['update-ref', 'refs/remotes/origin/main', clean]);
  assert.equal(run(repo, ['history', `${bad}..${clean}`]), 0);
  const metadata = fixture();
  const unapproved = commit(metadata, 'clean\n', { GIT_AUTHOR_NAME: 'Unapproved Fixture' });
  git(metadata, ['update-ref', 'refs/remotes/origin/main', unapproved]);
  assert.equal(run(metadata, ['history', `${unapproved}..${commit(metadata, 'next\n')}`]), 1);
});

test('clean local staged code is distinct from non-publishable development ancestry', () => {
  const repo = fixture();
  commit(repo, unsafe());
  commit(repo);
  assert.equal(run(repo, ['identity']), 0);
  assert.equal(run(repo, ['staged']), 0);
  assert.equal(run(repo, ['history', git(repo, ['rev-parse', 'HEAD'])]), 1);
});

test('raw author and committer must both match approved metadata', () => {
  for (const kind of ['AUTHOR', 'COMMITTER']) {
    const repo = fixture();
    const oid = commit(repo, 'clean\n', { [`GIT_${kind}_NAME`]: 'Unapproved Fixture' });
    assert.equal(run(repo, ['history', oid]), 1);
  }
});

test('identity rejects environment overrides and inferred configuration', () => {
  const repo = fixture();
  assert.equal(run(repo, ['identity']), 0);
  assert.equal(run(repo, ['identity'], { extra: { GIT_AUTHOR_NAME: 'Unapproved Fixture' } }), 1);
  assert.equal(run(repo, ['identity'], { extra: { GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'user.name', GIT_CONFIG_VALUE_0: 'Unapproved Fixture',
    GIT_AUTHOR_NAME: undefined, GIT_COMMITTER_NAME: undefined } }), 1);
  git(repo, ['config', '--unset', 'user.useConfigOnly']);
  assert.equal(run(repo, ['identity']), 1);
});

test('message footer findings and errors are redacted', () => {
  const repo = fixture();
  const message = path.join(repo, 'message.txt');
  writeFileSync(message, `change\n\nCo-authored-by: ${['fixture', 'example.invalid'].join('@')}\n`);
  assert.equal(run(repo, ['message', message]), 1);
  assert.equal(run(repo, ['message', path.join(repo, 'missing')]), 2);
});

function prFixture() {
  const repo = fixture();
  const base = commit(repo);
  // Simulate an already fetched trusted ref without any remote or fetch.
  git(repo, ['update-ref', 'refs/remotes/origin/main', base]);
  git(repo, ['checkout', '-q', '-b', 'feature/guard']);
  return { repo, base };
}
const feature = 'refs/heads/feature/guard';
const zero = '0'.repeat(40);
const proposed = (tip, old = zero, ref = feature) => `${ref} ${tip} ${ref} ${old}\n`;

test('PR feature creation scans supplied OID, not the current named ref', () => {
  const { repo, base } = prFixture();
  const good = commit(repo, 'good feature\n');
  const bad = commit(repo, unsafe());
  assert.equal(run(repo, ['pre-push', 'origin'], { input: proposed(good) }), 0);
  assert.equal(run(repo, ['pre-push'], { input: proposed(bad) }), 1);
  git(repo, ['update-ref', feature, good]);
  assert.equal(run(repo, ['pre-push'], { input: proposed(bad) }), 1);
  assert.equal(run(repo, ['pre-push'], { input: proposed(good) }), 0);
  assert.equal(run(repo, ['pre-push', 'other'], { input: proposed(good) }), 2);
  git(repo, ['update-ref', '-d', 'refs/remotes/origin/main']);
  assert.equal(run(repo, ['pre-push'], { input: proposed(good) }), 2);
  // Standalone initial-export data checks do not require a nonexistent remote.
  assert.equal(run(repo, ['history', good]), 0);
  assert.equal(run(repo, ['history', base]), 0);
});

test('PR feature update requires exact known fetched old OID and fast-forward', () => {
  const { repo, base } = prFixture();
  const old = commit(repo, 'previous feature\n');
  const next = commit(repo, 'next feature\n');
  assert.equal(run(repo, ['pre-push'], { input: proposed(next, old) }), 2);
  git(repo, ['update-ref', 'refs/remotes/origin/feature/guard', old]);
  assert.equal(run(repo, ['pre-push'], { input: proposed(next, old) }), 0);
  assert.equal(run(repo, ['pre-push'], { input: proposed(next, base) }), 2);
  assert.equal(run(repo, ['pre-push'], { input: proposed(next) }), 2);
  const sibling = git(repo, ['commit-tree', git(repo, ['rev-parse', `${next}^{tree}`]), '-p', base, '-m', 'sibling fixture']);
  assert.equal(run(repo, ['pre-push'], { input: proposed(sibling, old) }), 2);
});

test('routine push rejects direct main, deletion, bulk, invalid refs and unknown anchors', () => {
  const { repo, base } = prFixture();
  const tip = commit(repo, 'feature tip\n');
  for (const input of [proposed(tip, zero, 'refs/heads/main'), proposed(tip, base, 'refs/heads/main'),
    proposed(zero, tip), proposed(tip) + proposed(tip, zero, 'refs/heads/feature/other'),
    proposed(tip, zero, 'refs/tags/example'), proposed(tip, zero, 'refs/heads/feature..bad')]) {
    assert.equal(run(repo, ['pre-push'], { input }), 2);
  }
  assert.equal(run(repo, ['pre-push'], { input: '' }), 2);
  git(repo, ['config', 'remote.origin.mirror', 'true']);
  assert.equal(run(repo, ['pre-push'], { input: proposed(tip) }), 2);
  git(repo, ['config', '--unset', 'remote.origin.mirror']);
  assert.equal(run(repo, ['pre-push'], { input: proposed(tip), extra: {
    GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'remote.origin.mirror', GIT_CONFIG_VALUE_0: 'true' } }), 2);
  git(repo, ['tag', '-a', '-m', 'not a fetched main commit', 'fixture-tag', base]);
  git(repo, ['update-ref', 'refs/remotes/origin/main', git(repo, ['rev-parse', 'fixture-tag'])]);
  assert.equal(run(repo, ['pre-push'], { input: proposed(tip) }), 2);
  git(repo, ['update-ref', 'refs/remotes/origin/main', tip]);
  assert.equal(run(repo, ['pre-push'], { input: proposed(base) }), 2);
  git(repo, ['update-ref', '-d', 'refs/remotes/origin/main']);
  git(repo, ['symbolic-ref', 'refs/remotes/origin/main', feature]);
  assert.equal(run(repo, ['pre-push'], { input: proposed(tip) }), 2);
});

test('PR ref names are valid Git names and scanned as publication data', () => {
  const { repo } = prFixture();
  const tip = commit(repo, 'feature tip\n');
  assert.equal(run(repo, ['pre-push'], { input: proposed(tip, zero, 'refs/heads/feature/pr.1_test') }), 0);
  const identifying = ['fixture', 'example.invalid'].join('@');
  assert.equal(run(repo, ['pre-push'], { input: proposed(tip, zero, `refs/heads/${identifying}`) }), 1);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const token = ['gh', 'p_'].join('') + [...randomBytes(36)].map(byte => alphabet[byte % alphabet.length]).join('');
  assert.equal(run(repo, ['pre-push'], { input: proposed(tip, zero, `refs/heads/${token}`) }), 1);
});

test('PR creation still refuses unsafe ancestry and unapproved proposed author', () => {
  const { repo } = prFixture();
  commit(repo, unsafe());
  const clean = commit(repo);
  assert.equal(run(repo, ['pre-push'], { input: proposed(clean) }), 1);
  const other = prFixture();
  const wrong = commit(other.repo, 'other clean\n', { GIT_AUTHOR_NAME: 'Unapproved Fixture' });
  assert.equal(run(other.repo, ['pre-push'], { input: proposed(wrong) }), 1);
});

test('binary, archive, symlink, runtime files, and grafts fail closed', () => {
  for (const [name, content] of [['image.txt', Buffer.from([0, 1, 2])], ['bundle.zip', 'text'], ['.airig/private.txt', 'text']]) {
    const repo = fixture();
    mkdirSync(path.dirname(path.join(repo, name)), { recursive: true });
    writeFileSync(path.join(repo, name), content);
    git(repo, ['add', '-f', '--', name]);
    assert.ok(run(repo, ['staged']) !== 0);
  }
  const linkRepo = fixture();
  symlinkSync('source.txt', path.join(linkRepo, 'link.txt'));
  git(linkRepo, ['add', '--', 'link.txt']);
  assert.equal(run(linkRepo, ['staged']), 2);
  const repo = fixture();
  commit(repo);
  writeFileSync(path.join(repo, '.git/info/grafts'), '');
  assert.equal(run(repo, ['history']), 2);
});

test('clean staged/history require a real scanner; missing scanner is not clean', () => {
  const repo = fixture();
  commit(repo);
  assert.equal(run(repo, ['staged']), 0);
  assert.equal(run(repo, ['history']), 0);
});

function installLayout(repo, binary = false) {
  for (const name of ['scripts/security/git-privacy.mjs', 'scripts/security/privacy.mjs',
    'scripts/security/gitleaks.mjs', 'security/policy.json', 'security/gitleaks-checksums.json']) {
    mkdirSync(path.dirname(path.join(repo, name)), { recursive: true });
    copyFileSync(path.join(root, name), path.join(repo, name));
  }
  if (binary) {
    const source = installedBinary();
    const destination = installedBinary({ root: repo });
    mkdirSync(path.dirname(destination.path), { recursive: true });
    copyFileSync(source.path, destination.path);
    chmodSync(destination.path, 0o700);
  }
  return path.join(repo, 'scripts/security/git-privacy.mjs');
}

test('missing or corrupted pinned scanner blocks clean source', () => {
  const repo = fixture();
  commit(repo);
  const executable = installLayout(repo);
  assert.equal(run(repo, ['staged'], { executable }), 2);
  const destination = installedBinary({ root: repo });
  mkdirSync(path.dirname(destination.path), { recursive: true });
  writeFileSync(destination.path, 'not a scanner');
  assert.equal(run(repo, ['history'], { executable }), 2);
  writeFileSync(path.join(repo, 'security/policy.json'), '{');
  assert.equal(run(repo, ['staged'], { executable }), 2);
  rmSync(path.join(repo, 'scripts/security/privacy.mjs'));
  assert.equal(run(repo, ['staged'], { executable }), 2);
  const pr = prFixture();
  const tip = commit(pr.repo, 'clean feature\n');
  const missingScanner = installLayout(pr.repo);
  assert.equal(run(pr.repo, ['pre-push'], { input: proposed(tip), executable: missingScanner }), 2);
});

test('secrets in staged content or commit messages block with the real scanner', () => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const token = ['gh', 'p_'].join('') + [...randomBytes(36)].map(byte => alphabet[byte % alphabet.length]).join('');
  const repo = fixture();
  writeFileSync(path.join(repo, 'pnpm-lock.yaml'), `token = "${token}"\n`);
  git(repo, ['add', '--', 'pnpm-lock.yaml']);
  assert.equal(run(repo, ['staged']), 1);
  const message = path.join(repo, 'message.txt');
  writeFileSync(message, `change\n\ntoken = "${token}"\n`);
  assert.equal(run(repo, ['message', message]), 1);
  const named = fixture();
  const filename = `${token}.txt`;
  writeFileSync(path.join(named, filename), 'clean\n');
  git(named, ['add', '--', filename]);
  assert.equal(run(named, ['staged']), 1);
});

test('actual executable hooks block unsafe commits and tolerate no missing guard', () => {
  const repo = fixture();
  // Private development ancestry is deliberately dirty; a clean local change
  // must still pass pre-commit while its proposed public ancestry remains blocked.
  commit(repo, unsafe());
  installLayout(repo, true);
  git(repo, ['config', 'core.hooksPath', path.join(root, '.githooks')]);
  writeFileSync(path.join(repo, 'source.txt'), 'clean\n');
  git(repo, ['add', '--', 'source.txt']);
  git(repo, ['commit', '-q', '-m', 'clean hook fixture']);
  assert.equal(run(repo, ['history', git(repo, ['rev-parse', 'HEAD'])]), 1);
  writeFileSync(path.join(repo, 'source.txt'), unsafe());
  git(repo, ['add', '--', 'source.txt']);
  const result = spawnSync('git', ['-C', repo, 'commit', '-q', '-m', 'unsafe hook fixture'],
    { env, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.ok(!`${result.stdout}${result.stderr}`.includes(repo), 'hook output exposed a location');
  rmSync(path.join(repo, 'scripts/security/git-privacy.mjs'));
  const missing = spawnSync('git', ['-C', repo, 'commit', '-q', '-m', 'missing guard fixture'],
    { env, encoding: 'utf8' });
  assert.notEqual(missing.status, 0);
  assert.ok(!`${missing.stdout}${missing.stderr}`.includes(repo), 'missing guard error exposed a location');
});

test('pre-push hook preserves sanitized review notices without using or echoing the remote URL', () => {
  const { repo } = prFixture();
  installLayout(repo, true);
  writeFileSync(path.join(repo, 'AGENTS.md'), 'Privacy rules remain mandatory.\n');
  git(repo, ['add', '--', 'AGENTS.md']);
  git(repo, ['commit', '-q', '-m', 'protected hook fixture']);
  const tip = git(repo, ['rev-parse', 'HEAD']);
  const remoteURL = `https://${['fixture', 'example.invalid'].join('@')}/project`;
  const result = spawnSync('sh', [path.join(root, '.githooks/pre-push'), 'origin', remoteURL], {
    cwd: repo, env, input: proposed(tip), encoding: 'utf8' });
  assert.equal(result.status, 0);
  const output = `${result.stdout}${result.stderr}`;
  assert.ok(output.includes('human review required'), 'native hook must report the separate review gate');
  assert.ok(!output.includes(remoteURL) && !output.includes(repo), 'hook exposed private invocation data');
});

test('hook installer is explicit, repository-local, and refuses incomplete hook sets', () => {
  const repo = fixture();
  installLayout(repo, true);
  const installer = path.join(repo, 'scripts/install-hooks.mjs');
  copyFileSync(path.join(root, 'scripts/install-hooks.mjs'), installer);
  const invoke = (args, extra = {}) => spawnSync(process.execPath, [installer, ...args], { cwd: repo, env: { ...env, ...extra },
    encoding: 'utf8' }).status;
  assert.equal(invoke([]), 2);
  assert.equal(invoke(['--local']), 2);
  mkdirSync(path.join(repo, '.githooks'));
  for (const name of ['pre-commit', 'commit-msg', 'pre-push']) {
    const target = path.join(repo, '.githooks', name);
    copyFileSync(path.join(root, '.githooks', name), target);
    chmodSync(target, 0o755);
  }
  assert.equal(invoke(['--local']), 2);
  const base = commit(repo);
  git(repo, ['update-ref', 'refs/remotes/origin/main', base]);
  assert.equal(invoke(['--local'], { GIT_DIR: path.join(fixture(), '.git') }), 0);
  assert.equal(git(repo, ['config', '--local', '--get', 'core.hooksPath']), '.githooks');
  rmSync(path.join(repo, '.githooks/pre-push'));
  assert.equal(invoke(['--local']), 2);
});

test('protected PR changes require human review but are not privacy findings or push blockers', () => {
  const { repo, base } = prFixture();
  mkdirSync(path.join(repo, '.github/workflows'), { recursive: true });
  writeFileSync(path.join(repo, '.github/workflows/ci.yml'), 'changed\n');
  git(repo, ['add', '--', '.github/workflows/ci.yml']);
  git(repo, ['commit', '-q', '-m', 'protected fixture']);
  const head = git(repo, ['rev-parse', 'HEAD']);
  const notice = 'human review required';
  assert.equal(run(repo, ['policy', base, head], { notice }), 0);
  assert.equal(run(repo, ['pre-push'], { input: proposed(head), notice }), 0);
  git(repo, ['rm', '--', '.github/workflows/ci.yml']);
  git(repo, ['commit', '-q', '-m', 'restore protected fixture']);
  assert.equal(run(repo, ['policy', base, git(repo, ['rev-parse', 'HEAD'])], { notice }), 0);
});

test('candidate policy changes keep trusted content rules and do not exempt arbitrary metadata', () => {
  const { repo } = prFixture();
  mkdirSync(path.join(repo, 'security'));
  const candidate = { ...policy, forbiddenDirectories: [...policy.forbiddenDirectories, 'extra-private'] };
  writeFileSync(path.join(repo, 'security/policy.json'), JSON.stringify(candidate, null, 2));
  git(repo, ['add', '--', 'security/policy.json']);
  git(repo, ['commit', '-q', '-m', 'candidate policy fixture']);
  assert.equal(run(repo, ['pre-push'], { input: proposed(git(repo, ['rev-parse', 'HEAD'])), notice: 'human review required' }), 0);
  candidate.forbiddenDirectories = candidate.forbiddenDirectories.filter(name => name !== '.cache');
  writeFileSync(path.join(repo, 'security/policy.json'), JSON.stringify(candidate, null, 2));
  mkdirSync(path.join(repo, '.cache'));
  writeFileSync(path.join(repo, '.cache/private.txt'), 'clean-looking text\n');
  git(repo, ['add', '-f', '--', 'security/policy.json', '.cache/private.txt']);
  git(repo, ['commit', '-q', '-m', 'attempt candidate weakening']);
  assert.equal(run(repo, ['pre-push'], { input: proposed(git(repo, ['rev-parse', 'HEAD'])) }), 1);
});

test('canonical platform committer exception is historical and role-specific', () => {
  const platform = { name: 'GitHub', email: ['noreply', 'github.com'].join('@') };
  const cases = [
    [{ GIT_COMMITTER_NAME: platform.name, GIT_COMMITTER_EMAIL: platform.email }, 0],
    [{ GIT_AUTHOR_NAME: platform.name, GIT_AUTHOR_EMAIL: platform.email }, 1],
    [{ GIT_COMMITTER_NAME: 'Other Fixture', GIT_COMMITTER_EMAIL: platform.email }, 1],
    [{ GIT_COMMITTER_NAME: platform.name, GIT_COMMITTER_EMAIL: ['other', 'github.com'].join('@') }, 1],
    [{ GIT_COMMITTER_NAME: identity.name, GIT_COMMITTER_EMAIL: platform.email }, 1],
    [{ GIT_COMMITTER_NAME: platform.name, GIT_COMMITTER_EMAIL: identity.email }, 1],
    [{ GIT_COMMITTER_NAME: platform.name.toLowerCase(), GIT_COMMITTER_EMAIL: platform.email }, 1],
    [{ GIT_COMMITTER_NAME: platform.name, GIT_COMMITTER_EMAIL: platform.email.toUpperCase() }, 1],
  ];
  for (const [extra, expected] of cases) {
    const repo = fixture();
    const tip = commit(repo, 'clean\n', extra);
    assert.equal(run(repo, ['history', tip]), expected);
    assert.equal(run(repo, ['identity'], { extra }), 1);
  }
  const repo = fixture();
  const message = path.join(repo, 'message.txt');
  writeFileSync(message, `platform contact ${platform.email}\n`);
  assert.equal(run(repo, ['message', message]), 1);
});

// Changed-only history scanning (owner decision): each commit's content is
// scanned only where it differs from its parent(s); metadata always is.
const secretToken = () => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return ['gh', 'p_'].join('') + [...randomBytes(36)].map(byte => alphabet[byte % alphabet.length]).join('');
};
const counted = output => {
  const match = /content (\d+) changed file entr(?:y|ies) in (\d+) commit\(s\)/.exec(output);
  assert.ok(match, 'history must report its changed-file count');
  return { entries: Number(match[1]), commits: Number(match[2]) };
};
function writeFiles(repo, files) {
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(repo, name)), { recursive: true });
    writeFileSync(path.join(repo, name), content);
  }
  git(repo, ['add', '--', ...Object.keys(files)]);
}
function commitFiles(repo, files, message = 'fixture change') {
  writeFiles(repo, files);
  git(repo, ['commit', '-q', '-m', message]);
  return git(repo, ['rev-parse', 'HEAD']);
}

test('unchanged files are not rescanned and identical path/blob pairs are deduplicated', () => {
  const repo = fixture();
  const files = { 'source.txt': 'clean 0\n' };
  for (let index = 0; index < 5; index += 1) files[`stable/file-${index}.txt`] = `stable ${index}\n`;
  commitFiles(repo, files);
  for (let index = 1; index <= 4; index += 1) commit(repo, `clean ${index}\n`);
  // Reverting to earlier content is the same path/blob pair: not counted twice.
  const tip = commit(repo, 'clean 1\n');
  const full = scan(repo, ['history', tip]);
  assert.equal(full.status, 0);
  // Six root files plus four new source.txt versions; a full-tree walk would visit 36.
  assert.deepEqual(counted(full.output), { entries: 10, commits: 6 });
  const { repo: pr, base } = prFixture();
  commitFiles(pr, files);
  const head = commit(pr, 'clean 9\n');
  const push = scan(pr, ['pre-push'], { input: proposed(head) });
  assert.equal(push.status, 0);
  // Only the new range counts: five stable files and two source.txt versions.
  assert.deepEqual(counted(push.output), { entries: 7, commits: 2 });
  assert.deepEqual(counted(scan(pr, ['history', `${base}..${head}`]).output), { entries: 7, commits: 2 });
});

test('secrets in old or later commits of the published range are caught', () => {
  const early = prFixture();
  commitFiles(early.repo, { 'notes.txt': `token = "${secretToken()}"\n` });
  commitFiles(early.repo, { 'notes.txt': 'cleaned up\n' });
  const earlyTip = commit(early.repo, 'later clean change\n');
  assert.equal(run(early.repo, ['pre-push'], { input: proposed(earlyTip) }), 1);
  assert.equal(run(early.repo, ['history', `${early.base}..${earlyTip}`]), 1);
  assert.equal(run(early.repo, ['history', earlyTip]), 1);
  const late = prFixture();
  commitFiles(late.repo, { 'notes.txt': 'clean notes\n' });
  const lateTip = commitFiles(late.repo, { 'notes.txt': `clean notes\ntoken = "${secretToken()}"\n` });
  assert.equal(run(late.repo, ['pre-push'], { input: proposed(lateTip) }), 1);
  assert.equal(run(late.repo, ['history', lateTip]), 1);
  // Negative control: the same shape without a secret passes.
  const control = prFixture();
  commitFiles(control.repo, { 'notes.txt': 'clean notes\n' });
  const controlTip = commitFiles(control.repo, { 'notes.txt': 'clean notes\nmore\n' });
  assert.equal(run(control.repo, ['pre-push'], { input: proposed(controlTip) }), 0);
});

test('a secret in any commit message is caught, including outside the content range', () => {
  const { repo } = prFixture();
  writeFiles(repo, { 'notes.txt': 'clean\n' });
  git(repo, ['commit', '-q', '-m', `change\n\ntoken = "${secretToken()}"\n`]);
  const tip = commit(repo, 'later clean change\n');
  assert.equal(run(repo, ['pre-push'], { input: proposed(tip) }), 1);
  assert.equal(run(repo, ['history', tip]), 1);
  // A message in the already published baseline is still metadata to scan.
  const baseline = fixture();
  writeFiles(baseline, { 'source.txt': 'clean\n' });
  git(baseline, ['commit', '-q', '-m', `base\n\ntoken = "${secretToken()}"\n`]);
  git(baseline, ['update-ref', 'refs/remotes/origin/main', git(baseline, ['rev-parse', 'HEAD'])]);
  git(baseline, ['checkout', '-q', '-b', 'feature/guard']);
  const feature = commit(baseline, 'clean feature\n');
  assert.equal(run(baseline, ['pre-push'], { input: proposed(feature) }), 1);
});

test('merges scan only content found in no parent, so an evil merge is caught', () => {
  const { repo, base } = prFixture();
  commitFiles(repo, { 'shared.txt': 'feature side\n', 'feature.txt': 'feature only\n' });
  const feature = git(repo, ['rev-parse', 'HEAD']);
  git(repo, ['checkout', '-q', 'main']);
  const mainTip = commitFiles(repo, { 'shared.txt': 'main side\n', 'main.txt': 'main only\n' });
  git(repo, ['update-ref', 'refs/remotes/origin/main', mainTip]);
  git(repo, ['checkout', '-q', 'feature/guard']);
  // Clean resolution: main.txt equals a parent and is not rescanned; the
  // resolved shared.txt differs from both parents and is.
  const tree = mergeTree(repo, feature, { 'shared.txt': 'resolved\n', 'main.txt': 'main only\n' });
  const clean = git(repo, ['commit-tree', tree, '-p', feature, '-p', mainTip, '-m', 'merge main']);
  const result = scan(repo, ['pre-push'], { input: proposed(clean) });
  assert.equal(result.status, 0);
  // Range: feature commit (shared.txt, feature.txt) + merge (resolved shared.txt).
  assert.deepEqual(counted(result.output), { entries: 3, commits: 2 });
  for (const files of [{ 'shared.txt': `token = "${secretToken()}"\n`, 'main.txt': 'main only\n' },
    { 'main.txt': 'main only\n', 'extra.txt': `token = "${secretToken()}"\n` }]) {
    const evil = git(repo, ['commit-tree', mergeTree(repo, feature, { 'shared.txt': 'resolved\n', ...files }),
      '-p', feature, '-p', mainTip, '-m', 'merge main']);
    assert.equal(run(repo, ['pre-push'], { input: proposed(evil) }), 1);
    assert.equal(run(repo, ['history', `${base}..${evil}`]), 1);
    assert.equal(run(repo, ['history', evil]), 1);
  }
});

function mergeTree(repo, from, files) {
  const index = path.join(repo, '.git', `merge-index-${randomBytes(4).toString('hex')}`);
  git(repo, ['read-tree', from], undefined, { GIT_INDEX_FILE: index });
  for (const [name, content] of Object.entries(files)) {
    const blob = git(repo, ['hash-object', '-w', '--stdin'], content);
    git(repo, ['update-index', '--add', '--cacheinfo', `100644,${blob},${name}`], undefined, { GIT_INDEX_FILE: index });
  }
  const tree = git(repo, ['write-tree'], undefined, { GIT_INDEX_FILE: index });
  rmSync(index, { force: true });
  return tree;
}

test('a published range over 1,000 changed files needs exact-head owner approval', () => {
  const { repo, base } = prFixture();
  const bulk = {};
  for (let index = 0; index < 1000; index += 1) bulk[`bulk/file-${String(index).padStart(4, '0')}.txt`] = `bulk ${index}\n`;
  const atLimit = commitFiles(repo, bulk);
  assert.equal(run(repo, ['pre-push'], { input: proposed(atLimit) }), 0);
  const over = commitFiles(repo, { 'bulk/file-1000.txt': 'bulk 1000\n' });
  const notice = 'history scan exceeds 1,000 changed files; owner approval required';
  assert.equal(run(repo, ['pre-push'], { input: proposed(over), notice }), 3);
  assert.equal(run(repo, ['history', `${base}..${over}`], { notice }), 3);
  for (const wrong of [atLimit, base, over.slice(0, 12), over.toUpperCase(), `${over}\n`, '1']) {
    const extra = { VELCRO_HISTORY_APPROVED: wrong };
    assert.equal(run(repo, ['pre-push'], { input: proposed(over), extra, notice }), 3);
    assert.equal(run(repo, ['history', `${base}..${over}`], { extra, notice }), 3);
  }
  const approved = { VELCRO_HISTORY_APPROVED: over };
  assert.equal(run(repo, ['pre-push'], { input: proposed(over), extra: approved }), 0);
  // Approval names one head: the next head is blocked again.
  const next = commit(repo, 'next\n');
  assert.equal(run(repo, ['pre-push'], { input: proposed(next), extra: approved, notice }), 3);
  // Approval never clears findings.
  const secret = commitFiles(repo, { 'notes.txt': `token = "${secretToken()}"\n` });
  assert.equal(run(repo, ['pre-push'], { input: proposed(secret), extra: { VELCRO_HISTORY_APPROVED: secret } }), 1);
  // Full-history mode is not a published range and keeps only the hard caps.
  assert.equal(run(repo, ['history', next]), 0);
});

test('content inherited from outside the range is scanned unless the base tip has it', () => {
  // Main: A adds a forbidden value, B cleans it. The feature branched from A
  // never touches the file, and a merge with B keeps the feature's version.
  const repo = fixture();
  const a = commitFiles(repo, { 'notes.txt': `token = "${secretToken()}"\n` });
  const b = commitFiles(repo, { 'notes.txt': 'cleaned\n' });
  git(repo, ['update-ref', 'refs/remotes/origin/main', b]);
  git(repo, ['checkout', '-q', '-b', 'feature/guard', a]);
  const f = commitFiles(repo, { 'other.txt': 'clean feature\n' });
  const kept = git(repo, ['commit-tree', `${f}^{tree}`, '-p', f, '-p', b, '-m', 'merge main keeping ours']);
  assert.equal(run(repo, ['history', `${b}..${kept}`]), 1);
  assert.equal(run(repo, ['pre-push'], { input: proposed(kept) }), 1);
  // The unmerged feature tip carries the same unscanned inherited value.
  assert.equal(run(repo, ['history', `${b}..${f}`]), 1);
  // Taking the base's cleaned file in the merge does not hide the feature
  // commit, which itself still carries the value.
  const taken = git(repo, ['commit-tree', mergeTree(repo, f, { 'notes.txt': 'cleaned\n' }), '-p', f, '-p', b, '-m', 'merge main']);
  assert.equal(run(repo, ['pre-push'], { input: proposed(taken) }), 1);
  // Control: a feature from the cleaned base passes and counts only its own change.
  const fresh = fixture();
  commitFiles(fresh, { 'notes.txt': `token = "${secretToken()}"\n` });
  const base = commitFiles(fresh, { 'notes.txt': 'cleaned\n' });
  git(fresh, ['update-ref', 'refs/remotes/origin/main', base]);
  git(fresh, ['checkout', '-q', '-b', 'feature/guard']);
  const tip = commitFiles(fresh, { 'other.txt': 'clean feature\n' });
  const clean = scan(fresh, ['pre-push'], { input: proposed(tip) });
  assert.equal(clean.status, 0);
  assert.deepEqual(counted(clean.output), { entries: 1, commits: 1 });
});

test('an explicit range base must be the fetched main or its ancestor', () => {
  const { repo, base } = prFixture();
  const tip = commit(repo, 'feature\n');
  assert.equal(run(repo, ['history', `${base}..${tip}`]), 0);
  // A caller-chosen base past main cannot hide the range.
  assert.equal(run(repo, ['history', `${tip}..${tip}`]), 2);
  git(repo, ['symbolic-ref', 'refs/remotes/origin/main', 'refs/heads/main']);
  assert.equal(run(repo, ['history', `${base}..${tip}`]), 2);
  git(repo, ['symbolic-ref', '--delete', 'refs/remotes/origin/main']);
  assert.equal(run(repo, ['history', `${base}..${tip}`]), 2);
  assert.equal(run(repo, ['history', tip]), 0);
});

test('range edge cases: symlink, gitlink, mode-only, octopus and unrelated roots', () => {
  const blocked = (files, mode) => {
    const { repo, base } = prFixture();
    const sha = git(repo, ['hash-object', '-w', '--stdin'], files);
    git(repo, ['update-index', '--add', '--cacheinfo', `${mode},${mode === '160000' ? base : sha},entry`]);
    git(repo, ['commit', '-q', '-m', 'fixture entry']);
    const tip = git(repo, ['rev-parse', 'HEAD']);
    assert.equal(run(repo, ['pre-push'], { input: proposed(tip) }), 2);
    assert.equal(run(repo, ['history', `${base}..${tip}`]), 2);
  };
  blocked('source.txt', '120000');
  blocked('', '160000');
  const mode = prFixture();
  git(mode.repo, ['update-index', '--chmod=+x', 'source.txt']);
  git(mode.repo, ['commit', '-q', '-m', 'mode only']);
  const modeTip = git(mode.repo, ['rev-parse', 'HEAD']);
  const modeResult = scan(mode.repo, ['pre-push'], { input: proposed(modeTip) });
  assert.equal(modeResult.status, 0);
  assert.deepEqual(counted(modeResult.output), { entries: 1, commits: 1 });
  // Octopus: content in no parent is scanned; content equal to a parent is not.
  const { repo, base } = prFixture();
  const sides = ['one', 'two', 'three'].map(name => {
    git(repo, ['checkout', '-q', '-B', `side-${name}`, base]);
    return commitFiles(repo, { [`${name}.txt`]: `${name}\n` });
  });
  git(repo, ['checkout', '-q', 'feature/guard']);
  const octopusTree = files => mergeTree(repo, sides[0], { 'two.txt': 'two\n', 'three.txt': 'three\n', ...files });
  const octopus = files => git(repo, ['commit-tree', octopusTree(files), ...sides.flatMap(side => ['-p', side]), '-m', 'octopus']);
  const cleanOctopus = scan(repo, ['pre-push'], { input: proposed(octopus({})) });
  assert.equal(cleanOctopus.status, 0);
  assert.deepEqual(counted(cleanOctopus.output), { entries: 3, commits: 4 });
  const evil = octopus({ 'extra.txt': `token = "${secretToken()}"\n` });
  assert.equal(run(repo, ['pre-push'], { input: proposed(evil) }), 1);
  assert.equal(run(repo, ['history', `${base}..${evil}`]), 1);
  // Unrelated root in range: carries a value, later deletes it, then merged.
  const unrelated = prFixture();
  git(unrelated.repo, ['checkout', '-q', '--orphan', 'stray']);
  git(unrelated.repo, ['rm', '-q', '-r', '--cached', '.']);
  const root = commitFiles(unrelated.repo, { 'stray.txt': `token = "${secretToken()}"\n` });
  git(unrelated.repo, ['rm', '-q', '--', 'stray.txt']);
  git(unrelated.repo, ['commit', '-q', '-m', 'remove stray']);
  const removed = git(unrelated.repo, ['rev-parse', 'HEAD']);
  assert.equal(git(unrelated.repo, ['rev-parse', `${removed}^`]), root);
  git(unrelated.repo, ['checkout', '-q', '-f', 'feature/guard']);
  const head = git(unrelated.repo, ['rev-parse', 'HEAD']);
  const joined = git(unrelated.repo, ['commit-tree', `${head}^{tree}`, '-p', head, '-p', removed, '-m', 'join']);
  assert.equal(run(unrelated.repo, ['pre-push'], { input: proposed(joined) }), 1);
  assert.equal(run(unrelated.repo, ['history', `${unrelated.base}..${joined}`]), 1);
});
