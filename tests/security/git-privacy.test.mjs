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
function run(repo, args, { input, extra, executable = script, notice } = {}) {
  const result = spawnSync(process.execPath, [executable, ...args], {
    cwd: repo, env: { ...env, ...extra }, input, encoding: 'utf8', timeout: 120000,
  });
  const output = `${result.stdout}${result.stderr}`;
  assert.ok(!output.includes(repo), 'diagnostic exposed fixture location');
  if (notice) assert.ok(output.includes(notice), 'expected sanitized notice missing');
  return result.status;
}
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

test('history rejects dirty ancestors despite a clean tip and replacement refs', () => {
  const repo = fixture();
  const bad = commit(repo, unsafe());
  const clean = commit(repo);
  git(repo, ['replace', '--graft', clean]);
  assert.equal(run(repo, ['history', clean]), 1);
  assert.equal(run(repo, ['history', `${bad}..${clean}`]), 1);
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
