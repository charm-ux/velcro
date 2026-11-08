import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, readFileSync, copyFileSync, chmodSync, symlinkSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir, devNull } from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { installedBinary } from '../../scripts/security/gitleaks.mjs';
import { spawnAsync, TEST_CONCURRENCY } from '../support/spawn.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const script = path.join(root, 'scripts/security/git-privacy.mjs');
const policy = JSON.parse(readFileSync(path.join(root, 'security/policy.json'), 'utf8'));
const dirs = [];
after(() => dirs.forEach(dir => rmSync(dir, { recursive: true, force: true })));
const identity = policy.approvedIdentity;
const env = { ...process.env, GIT_CONFIG_GLOBAL: devNull, GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: identity.name, GIT_AUTHOR_EMAIL: identity.email,
  GIT_COMMITTER_NAME: identity.name, GIT_COMMITTER_EMAIL: identity.email };
async function git(repo, args, input, extra = {}) {
  const result = await spawnAsync('git', ['-C', repo, '-c', 'commit.gpgsign=false', ...args],
    { env: { ...env, ...extra }, input, encoding: 'utf8' });
  assert.equal(result.status, 0, 'fixture Git operation failed');
  return result.stdout.trim();
}
async function fixture() {
  const repo = mkdtempSync(path.join(tmpdir(), 'velcro-guard-'));
  dirs.push(repo);
  await git(repo, ['init', '-q', '-b', 'main']);
  await git(repo, ['config', 'user.useConfigOnly', 'true']);
  await git(repo, ['config', 'user.name', identity.name]);
  await git(repo, ['config', 'user.email', identity.email]);
  return repo;
}
async function commit(repo, content = 'clean\n', extra = {}) {
  writeFileSync(path.join(repo, 'source.txt'), content);
  await git(repo, ['add', '--', 'source.txt']);
  await git(repo, ['commit', '-q', '-m', 'fixture change'], undefined, extra);
  return await git(repo, ['rev-parse', 'HEAD']);
}
async function scan(repo, args, { input, extra, executable = script, notice } = {}) {
  const result = await spawnAsync(process.execPath, [executable, ...args], {
    cwd: repo, env: { ...env, VELCRO_HISTORY_APPROVED: undefined, ...extra }, input, encoding: 'utf8', timeout: 120000,
  });
  const output = `${result.stdout}${result.stderr}`;
  assert.ok(!output.includes(repo), 'diagnostic exposed fixture location');
  if (notice) assert.ok(output.includes(notice), 'expected sanitized notice missing');
  return { status: result.status, output };
}
const run = async (repo, args, options) => (await scan(repo, args, options)).status;
const unsafe = () => ['', 'ho' + 'me', 'fixture-person', 'private'].join('/');

// Every test builds its own temporary repositories, so the tests of this file run concurrently.
describe('git publication guard', { concurrency: TEST_CONCURRENCY }, () => {
  test('staged scans exact blobs, not the clean working copy', async () => {
    const repo = await fixture();
    await commit(repo);
    writeFileSync(path.join(repo, 'source.txt'), unsafe());
    await git(repo, ['add', '--', 'source.txt']);
    writeFileSync(path.join(repo, 'source.txt'), 'clean\n');
    assert.equal(await run(repo, ['staged']), 1);
  });

  test('alternate proposed index is honored', async () => {
    const repo = await fixture();
    await commit(repo);
    const index = path.join(repo, 'proposed-index');
    await git(repo, ['read-tree', 'HEAD'], undefined, { GIT_INDEX_FILE: index });
    const blob = await git(repo, ['hash-object', '-w', '--stdin'], unsafe());
    await git(repo, ['update-index', '--cacheinfo', `100644,${blob},source.txt`], undefined, { GIT_INDEX_FILE: index });
    assert.equal(await run(repo, ['staged'], { extra: { GIT_INDEX_FILE: index } }), 1);
  });

  test('full history rejects dirty ancestors despite a clean tip and replacement refs', async () => {
    const repo = await fixture();
    const bad = await commit(repo, unsafe());
    const clean = await commit(repo);
    await git(repo, ['replace', '--graft', clean]);
    assert.equal(await run(repo, ['history', clean]), 1);
    assert.equal(await run(repo, ['history']), 1);
    // A range's base is already verified published history: its file content is
    // not rescanned (owner decision), but its commit metadata still is.
    // The base must be the fetched main or its ancestor.
    assert.equal(await run(repo, ['history', `${bad}..${clean}`]), 2);
    await git(repo, ['update-ref', 'refs/remotes/origin/main', clean]);
    assert.equal(await run(repo, ['history', `${bad}..${clean}`]), 0);
    const metadata = await fixture();
    const unapproved = await commit(metadata, 'clean\n', { GIT_AUTHOR_NAME: 'Unapproved Fixture' });
    await git(metadata, ['update-ref', 'refs/remotes/origin/main', unapproved]);
    assert.equal(await run(metadata, ['history', `${unapproved}..${await commit(metadata, 'next\n')}`]), 1);
  });

  test('clean local staged code is distinct from non-publishable development ancestry', async () => {
    const repo = await fixture();
    await commit(repo, unsafe());
    await commit(repo);
    assert.equal(await run(repo, ['identity']), 0);
    assert.equal(await run(repo, ['staged']), 0);
    assert.equal(await run(repo, ['history', await git(repo, ['rev-parse', 'HEAD'])]), 1);
  });

  test('raw author and committer must both match approved metadata', async () => {
    await Promise.all(['AUTHOR', 'COMMITTER'].map(async kind => {
      const repo = await fixture();
      const oid = await commit(repo, 'clean\n', { [`GIT_${kind}_NAME`]: 'Unapproved Fixture' });
      assert.equal(await run(repo, ['history', oid]), 1);
    }));
  });

  test('identity rejects environment overrides and inferred configuration', async () => {
    const repo = await fixture();
    assert.equal(await run(repo, ['identity']), 0);
    assert.equal(await run(repo, ['identity'], { extra: { GIT_AUTHOR_NAME: 'Unapproved Fixture' } }), 1);
    assert.equal(await run(repo, ['identity'], { extra: { GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'user.name', GIT_CONFIG_VALUE_0: 'Unapproved Fixture',
      GIT_AUTHOR_NAME: undefined, GIT_COMMITTER_NAME: undefined } }), 1);
    await git(repo, ['config', '--unset', 'user.useConfigOnly']);
    assert.equal(await run(repo, ['identity']), 1);
  });

  test('message footer findings and errors are redacted', async () => {
    const repo = await fixture();
    const message = path.join(repo, 'message.txt');
    writeFileSync(message, `change\n\nCo-authored-by: ${['fixture', 'example.invalid'].join('@')}\n`);
    assert.equal(await run(repo, ['message', message]), 1);
    assert.equal(await run(repo, ['message', path.join(repo, 'missing')]), 2);
  });

  async function prFixture() {
    const repo = await fixture();
    const base = await commit(repo);
    // Simulate an already fetched trusted ref without any remote or fetch.
    await git(repo, ['update-ref', 'refs/remotes/origin/main', base]);
    await git(repo, ['checkout', '-q', '-b', 'feature/guard']);
    return { repo, base };
  }
  const feature = 'refs/heads/feature/guard';
  const zero = '0'.repeat(40);
  const proposed = (tip, old = zero, ref = feature) => `${ref} ${tip} ${ref} ${old}\n`;

  test('PR feature creation scans supplied OID, not the current named ref', async () => {
    const { repo, base } = await prFixture();
    const good = await commit(repo, 'good feature\n');
    const bad = await commit(repo, unsafe());
    assert.equal(await run(repo, ['pre-push', 'origin'], { input: proposed(good) }), 0);
    assert.equal(await run(repo, ['pre-push'], { input: proposed(bad) }), 1);
    await git(repo, ['update-ref', feature, good]);
    assert.equal(await run(repo, ['pre-push'], { input: proposed(bad) }), 1);
    assert.equal(await run(repo, ['pre-push'], { input: proposed(good) }), 0);
    assert.equal(await run(repo, ['pre-push', 'other'], { input: proposed(good) }), 2);
    await git(repo, ['update-ref', '-d', 'refs/remotes/origin/main']);
    assert.equal(await run(repo, ['pre-push'], { input: proposed(good) }), 2);
    // Standalone initial-export data checks do not require a nonexistent remote.
    assert.equal(await run(repo, ['history', good]), 0);
    assert.equal(await run(repo, ['history', base]), 0);
  });

  test('PR feature update requires exact known fetched old OID and fast-forward', async () => {
    const { repo, base } = await prFixture();
    const old = await commit(repo, 'previous feature\n');
    const next = await commit(repo, 'next feature\n');
    assert.equal(await run(repo, ['pre-push'], { input: proposed(next, old) }), 2);
    await git(repo, ['update-ref', 'refs/remotes/origin/feature/guard', old]);
    assert.equal(await run(repo, ['pre-push'], { input: proposed(next, old) }), 0);
    assert.equal(await run(repo, ['pre-push'], { input: proposed(next, base) }), 2);
    assert.equal(await run(repo, ['pre-push'], { input: proposed(next) }), 2);
    const sibling = await git(repo, ['commit-tree', await git(repo, ['rev-parse', `${next}^{tree}`]), '-p', base, '-m', 'sibling fixture']);
    assert.equal(await run(repo, ['pre-push'], { input: proposed(sibling, old) }), 2);
  });

  test('routine push rejects direct main, deletion, bulk, invalid refs and unknown anchors', async () => {
    const { repo, base } = await prFixture();
    const tip = await commit(repo, 'feature tip\n');
    for (const input of [proposed(tip, zero, 'refs/heads/main'), proposed(tip, base, 'refs/heads/main'),
      proposed(zero, tip), proposed(tip) + proposed(tip, zero, 'refs/heads/feature/other'),
      proposed(tip, zero, 'refs/tags/example'), proposed(tip, zero, 'refs/heads/feature..bad')]) {
      assert.equal(await run(repo, ['pre-push'], { input }), 2);
    }
    assert.equal(await run(repo, ['pre-push'], { input: '' }), 2);
    await git(repo, ['config', 'remote.origin.mirror', 'true']);
    assert.equal(await run(repo, ['pre-push'], { input: proposed(tip) }), 2);
    await git(repo, ['config', '--unset', 'remote.origin.mirror']);
    assert.equal(await run(repo, ['pre-push'], { input: proposed(tip), extra: {
      GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'remote.origin.mirror', GIT_CONFIG_VALUE_0: 'true' } }), 2);
    await git(repo, ['tag', '-a', '-m', 'not a fetched main commit', 'fixture-tag', base]);
    await git(repo, ['update-ref', 'refs/remotes/origin/main', await git(repo, ['rev-parse', 'fixture-tag'])]);
    assert.equal(await run(repo, ['pre-push'], { input: proposed(tip) }), 2);
    await git(repo, ['update-ref', 'refs/remotes/origin/main', tip]);
    assert.equal(await run(repo, ['pre-push'], { input: proposed(base) }), 2);
    await git(repo, ['update-ref', '-d', 'refs/remotes/origin/main']);
    await git(repo, ['symbolic-ref', 'refs/remotes/origin/main', feature]);
    assert.equal(await run(repo, ['pre-push'], { input: proposed(tip) }), 2);
  });

  test('PR ref names are valid Git names and scanned as publication data', async () => {
    const { repo } = await prFixture();
    const tip = await commit(repo, 'feature tip\n');
    assert.equal(await run(repo, ['pre-push'], { input: proposed(tip, zero, 'refs/heads/feature/pr.1_test') }), 0);
    const identifying = ['fixture', 'example.invalid'].join('@');
    assert.equal(await run(repo, ['pre-push'], { input: proposed(tip, zero, `refs/heads/${identifying}`) }), 1);
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const token = ['gh', 'p_'].join('') + [...randomBytes(36)].map(byte => alphabet[byte % alphabet.length]).join('');
    assert.equal(await run(repo, ['pre-push'], { input: proposed(tip, zero, `refs/heads/${token}`) }), 1);
  });

  test('PR creation still refuses unsafe ancestry and unapproved proposed author', async () => {
    const { repo } = await prFixture();
    await commit(repo, unsafe());
    const clean = await commit(repo);
    assert.equal(await run(repo, ['pre-push'], { input: proposed(clean) }), 1);
    const other = await prFixture();
    const wrong = await commit(other.repo, 'other clean\n', { GIT_AUTHOR_NAME: 'Unapproved Fixture' });
    assert.equal(await run(other.repo, ['pre-push'], { input: proposed(wrong) }), 1);
  });

  test('binary, archive, symlink, runtime files, and grafts fail closed', async () => {
    for (const [name, content] of [['image.txt', Buffer.from([0, 1, 2])], ['bundle.zip', 'text'], ['.airig/private.txt', 'text']]) {
      const repo = await fixture();
      mkdirSync(path.dirname(path.join(repo, name)), { recursive: true });
      writeFileSync(path.join(repo, name), content);
      await git(repo, ['add', '-f', '--', name]);
      assert.ok(await run(repo, ['staged']) !== 0);
    }
    const linkRepo = await fixture();
    symlinkSync('source.txt', path.join(linkRepo, 'link.txt'));
    await git(linkRepo, ['add', '--', 'link.txt']);
    assert.equal(await run(linkRepo, ['staged']), 2);
    const repo = await fixture();
    await commit(repo);
    writeFileSync(path.join(repo, '.git/info/grafts'), '');
    assert.equal(await run(repo, ['history']), 2);
  });

  test('clean staged/history require a real scanner; missing scanner is not clean', async () => {
    const repo = await fixture();
    await commit(repo);
    assert.equal(await run(repo, ['staged']), 0);
    assert.equal(await run(repo, ['history']), 0);
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

  test('missing or corrupted pinned scanner blocks clean source', async () => {
    const repo = await fixture();
    await commit(repo);
    const executable = installLayout(repo);
    assert.equal(await run(repo, ['staged'], { executable }), 2);
    const destination = installedBinary({ root: repo });
    mkdirSync(path.dirname(destination.path), { recursive: true });
    writeFileSync(destination.path, 'not a scanner');
    assert.equal(await run(repo, ['history'], { executable }), 2);
    writeFileSync(path.join(repo, 'security/policy.json'), '{');
    assert.equal(await run(repo, ['staged'], { executable }), 2);
    rmSync(path.join(repo, 'scripts/security/privacy.mjs'));
    assert.equal(await run(repo, ['staged'], { executable }), 2);
    const pr = await prFixture();
    const tip = await commit(pr.repo, 'clean feature\n');
    const missingScanner = installLayout(pr.repo);
    assert.equal(await run(pr.repo, ['pre-push'], { input: proposed(tip), executable: missingScanner }), 2);
  });

  test('secrets in staged content or commit messages block with the real scanner', async () => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const token = ['gh', 'p_'].join('') + [...randomBytes(36)].map(byte => alphabet[byte % alphabet.length]).join('');
    const repo = await fixture();
    writeFileSync(path.join(repo, 'pnpm-lock.yaml'), `token = "${token}"\n`);
    await git(repo, ['add', '--', 'pnpm-lock.yaml']);
    assert.equal(await run(repo, ['staged']), 1);
    const message = path.join(repo, 'message.txt');
    writeFileSync(message, `change\n\ntoken = "${token}"\n`);
    assert.equal(await run(repo, ['message', message]), 1);
    const named = await fixture();
    const filename = `${token}.txt`;
    writeFileSync(path.join(named, filename), 'clean\n');
    await git(named, ['add', '--', filename]);
    assert.equal(await run(named, ['staged']), 1);
  });

  test('actual executable hooks block unsafe commits and tolerate no missing guard', async () => {
    const repo = await fixture();
    // Private development ancestry is deliberately dirty; a clean local change
    // must still pass pre-commit while its proposed public ancestry remains blocked.
    await commit(repo, unsafe());
    installLayout(repo, true);
    await git(repo, ['config', 'core.hooksPath', path.join(root, '.githooks')]);
    writeFileSync(path.join(repo, 'source.txt'), 'clean\n');
    await git(repo, ['add', '--', 'source.txt']);
    await git(repo, ['commit', '-q', '-m', 'clean hook fixture']);
    assert.equal(await run(repo, ['history', await git(repo, ['rev-parse', 'HEAD'])]), 1);
    writeFileSync(path.join(repo, 'source.txt'), unsafe());
    await git(repo, ['add', '--', 'source.txt']);
    const result = await spawnAsync('git', ['-C', repo, 'commit', '-q', '-m', 'unsafe hook fixture'],
      { env, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.ok(!`${result.stdout}${result.stderr}`.includes(repo), 'hook output exposed a location');
    rmSync(path.join(repo, 'scripts/security/git-privacy.mjs'));
    const missing = await spawnAsync('git', ['-C', repo, 'commit', '-q', '-m', 'missing guard fixture'],
      { env, encoding: 'utf8' });
    assert.notEqual(missing.status, 0);
    assert.ok(!`${missing.stdout}${missing.stderr}`.includes(repo), 'missing guard error exposed a location');
  });

  test('pre-push hook preserves sanitized review notices without using or echoing the remote URL', async () => {
    const { repo } = await prFixture();
    installLayout(repo, true);
    writeFileSync(path.join(repo, 'AGENTS.md'), 'Privacy rules remain mandatory.\n');
    await git(repo, ['add', '--', 'AGENTS.md']);
    await git(repo, ['commit', '-q', '-m', 'protected hook fixture']);
    const tip = await git(repo, ['rev-parse', 'HEAD']);
    const remoteURL = `https://${['fixture', 'example.invalid'].join('@')}/project`;
    const result = await spawnAsync('sh', [path.join(root, '.githooks/pre-push'), 'origin', remoteURL], {
      cwd: repo, env, input: proposed(tip), encoding: 'utf8' });
    assert.equal(result.status, 0);
    const output = `${result.stdout}${result.stderr}`;
    assert.ok(output.includes('human review required'), 'native hook must report the separate review gate');
    assert.ok(!output.includes(remoteURL) && !output.includes(repo), 'hook exposed private invocation data');
  });

  test('hook installer is explicit, repository-local, and refuses incomplete hook sets', async () => {
    const repo = await fixture();
    installLayout(repo, true);
    const installer = path.join(repo, 'scripts/install-hooks.mjs');
    copyFileSync(path.join(root, 'scripts/install-hooks.mjs'), installer);
    const invoke = async (args, extra = {}) => (await spawnAsync(process.execPath, [installer, ...args], { cwd: repo,
      env: { ...env, ...extra }, encoding: 'utf8' })).status;
    assert.equal(await invoke([]), 2);
    assert.equal(await invoke(['--local']), 2);
    mkdirSync(path.join(repo, '.githooks'));
    for (const name of ['pre-commit', 'commit-msg', 'pre-push']) {
      const target = path.join(repo, '.githooks', name);
      copyFileSync(path.join(root, '.githooks', name), target);
      chmodSync(target, 0o755);
    }
    assert.equal(await invoke(['--local']), 2);
    const base = await commit(repo);
    await git(repo, ['update-ref', 'refs/remotes/origin/main', base]);
    assert.equal(await invoke(['--local'], { GIT_DIR: path.join(await fixture(), '.git') }), 0);
    assert.equal(await git(repo, ['config', '--local', '--get', 'core.hooksPath']), '.githooks');
    rmSync(path.join(repo, '.githooks/pre-push'));
    assert.equal(await invoke(['--local']), 2);
  });

  test('protected PR changes require human review but are not privacy findings or push blockers', async () => {
    const { repo, base } = await prFixture();
    mkdirSync(path.join(repo, '.github/workflows'), { recursive: true });
    writeFileSync(path.join(repo, '.github/workflows/ci.yml'), 'changed\n');
    await git(repo, ['add', '--', '.github/workflows/ci.yml']);
    await git(repo, ['commit', '-q', '-m', 'protected fixture']);
    const head = await git(repo, ['rev-parse', 'HEAD']);
    const notice = 'human review required';
    assert.equal(await run(repo, ['policy', base, head], { notice }), 0);
    assert.equal(await run(repo, ['pre-push'], { input: proposed(head), notice }), 0);
    await git(repo, ['rm', '--', '.github/workflows/ci.yml']);
    await git(repo, ['commit', '-q', '-m', 'restore protected fixture']);
    assert.equal(await run(repo, ['policy', base, await git(repo, ['rev-parse', 'HEAD'])], { notice }), 0);
  });

  test('candidate policy changes keep trusted content rules and do not exempt arbitrary metadata', async () => {
    const { repo } = await prFixture();
    mkdirSync(path.join(repo, 'security'));
    const candidate = { ...policy, forbiddenDirectories: [...policy.forbiddenDirectories, 'extra-private'] };
    writeFileSync(path.join(repo, 'security/policy.json'), JSON.stringify(candidate, null, 2));
    await git(repo, ['add', '--', 'security/policy.json']);
    await git(repo, ['commit', '-q', '-m', 'candidate policy fixture']);
    assert.equal(await run(repo, ['pre-push'], { input: proposed(await git(repo, ['rev-parse', 'HEAD'])), notice: 'human review required' }), 0);
    candidate.forbiddenDirectories = candidate.forbiddenDirectories.filter(name => name !== '.cache');
    writeFileSync(path.join(repo, 'security/policy.json'), JSON.stringify(candidate, null, 2));
    mkdirSync(path.join(repo, '.cache'));
    writeFileSync(path.join(repo, '.cache/private.txt'), 'clean-looking text\n');
    await git(repo, ['add', '-f', '--', 'security/policy.json', '.cache/private.txt']);
    await git(repo, ['commit', '-q', '-m', 'attempt candidate weakening']);
    assert.equal(await run(repo, ['pre-push'], { input: proposed(await git(repo, ['rev-parse', 'HEAD'])) }), 1);
  });

  test('canonical platform committer exception is historical and role-specific', async () => {
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
    // Each case has its own repository: run them together.
    await Promise.all([...cases.map(async ([extra, expected]) => {
      const repo = await fixture();
      const tip = await commit(repo, 'clean\n', extra);
      assert.equal(await run(repo, ['history', tip]), expected);
      assert.equal(await run(repo, ['identity'], { extra }), 1);
    }), (async () => {
      const repo = await fixture();
      const message = path.join(repo, 'message.txt');
      writeFileSync(message, `platform contact ${platform.email}\n`);
      assert.equal(await run(repo, ['message', message]), 1);
    })()]);
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
  async function writeFiles(repo, files) {
    for (const [name, content] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(repo, name)), { recursive: true });
      writeFileSync(path.join(repo, name), content);
    }
    await git(repo, ['add', '--', ...Object.keys(files)]);
  }
  async function commitFiles(repo, files, message = 'fixture change') {
    await writeFiles(repo, files);
    await git(repo, ['commit', '-q', '-m', message]);
    return await git(repo, ['rev-parse', 'HEAD']);
  }

  test('unchanged files are not rescanned and identical path/blob pairs are deduplicated', async () => {
    const repo = await fixture();
    const files = { 'source.txt': 'clean 0\n' };
    for (let index = 0; index < 5; index += 1) files[`stable/file-${index}.txt`] = `stable ${index}\n`;
    await commitFiles(repo, files);
    for (let index = 1; index <= 4; index += 1) await commit(repo, `clean ${index}\n`);
    // Reverting to earlier content is the same path/blob pair: not counted twice.
    const tip = await commit(repo, 'clean 1\n');
    const full = await scan(repo, ['history', tip]);
    assert.equal(full.status, 0);
    // Six root files plus four new source.txt versions; a full-tree walk would visit 36.
    assert.deepEqual(counted(full.output), { entries: 10, commits: 6 });
    const { repo: pr, base } = await prFixture();
    await commitFiles(pr, files);
    const head = await commit(pr, 'clean 9\n');
    const push = await scan(pr, ['pre-push'], { input: proposed(head) });
    assert.equal(push.status, 0);
    // Only the new range counts: five stable files and two source.txt versions.
    assert.deepEqual(counted(push.output), { entries: 7, commits: 2 });
    assert.deepEqual(counted((await scan(pr, ['history', `${base}..${head}`])).output), { entries: 7, commits: 2 });
  });

  test('secrets in old or later commits of the published range are caught', async () => {
    // Three independent repositories: run them together.
    await Promise.all([
      (async () => {
        const early = await prFixture();
        await commitFiles(early.repo, { 'notes.txt': `token = "${secretToken()}"\n` });
        await commitFiles(early.repo, { 'notes.txt': 'cleaned up\n' });
        const earlyTip = await commit(early.repo, 'later clean change\n');
        assert.equal(await run(early.repo, ['pre-push'], { input: proposed(earlyTip) }), 1);
        assert.equal(await run(early.repo, ['history', `${early.base}..${earlyTip}`]), 1);
        assert.equal(await run(early.repo, ['history', earlyTip]), 1);
      })(),
      (async () => {
        const late = await prFixture();
        await commitFiles(late.repo, { 'notes.txt': 'clean notes\n' });
        const lateTip = await commitFiles(late.repo, { 'notes.txt': `clean notes\ntoken = "${secretToken()}"\n` });
        assert.equal(await run(late.repo, ['pre-push'], { input: proposed(lateTip) }), 1);
        assert.equal(await run(late.repo, ['history', lateTip]), 1);
      })(),
      (async () => {
        // Negative control: the same shape without a secret passes.
        const control = await prFixture();
        await commitFiles(control.repo, { 'notes.txt': 'clean notes\n' });
        const controlTip = await commitFiles(control.repo, { 'notes.txt': 'clean notes\nmore\n' });
        assert.equal(await run(control.repo, ['pre-push'], { input: proposed(controlTip) }), 0);
      })(),
    ]);
  });

  test('a secret in any commit message is caught, including outside the content range', async () => {
    const { repo } = await prFixture();
    await writeFiles(repo, { 'notes.txt': 'clean\n' });
    await git(repo, ['commit', '-q', '-m', `change\n\ntoken = "${secretToken()}"\n`]);
    const tip = await commit(repo, 'later clean change\n');
    assert.equal(await run(repo, ['pre-push'], { input: proposed(tip) }), 1);
    assert.equal(await run(repo, ['history', tip]), 1);
    // A message in the already published baseline is still metadata to scan.
    const baseline = await fixture();
    await writeFiles(baseline, { 'source.txt': 'clean\n' });
    await git(baseline, ['commit', '-q', '-m', `base\n\ntoken = "${secretToken()}"\n`]);
    await git(baseline, ['update-ref', 'refs/remotes/origin/main', await git(baseline, ['rev-parse', 'HEAD'])]);
    await git(baseline, ['checkout', '-q', '-b', 'feature/guard']);
    const feature = await commit(baseline, 'clean feature\n');
    assert.equal(await run(baseline, ['pre-push'], { input: proposed(feature) }), 1);
  });

  test('merges scan only content found in no parent, so an evil merge is caught', async () => {
    const { repo, base } = await prFixture();
    await commitFiles(repo, { 'shared.txt': 'feature side\n', 'feature.txt': 'feature only\n' });
    const feature = await git(repo, ['rev-parse', 'HEAD']);
    await git(repo, ['checkout', '-q', 'main']);
    const mainTip = await commitFiles(repo, { 'shared.txt': 'main side\n', 'main.txt': 'main only\n' });
    await git(repo, ['update-ref', 'refs/remotes/origin/main', mainTip]);
    await git(repo, ['checkout', '-q', 'feature/guard']);
    // Clean resolution: main.txt equals a parent and is not rescanned; the
    // resolved shared.txt differs from both parents and is.
    const tree = await mergeTree(repo, feature, { 'shared.txt': 'resolved\n', 'main.txt': 'main only\n' });
    const clean = await git(repo, ['commit-tree', tree, '-p', feature, '-p', mainTip, '-m', 'merge main']);
    const result = await scan(repo, ['pre-push'], { input: proposed(clean) });
    assert.equal(result.status, 0);
    // Range: feature commit (shared.txt, feature.txt) + merge (resolved shared.txt).
    assert.deepEqual(counted(result.output), { entries: 3, commits: 2 });
    for (const files of [{ 'shared.txt': `token = "${secretToken()}"\n`, 'main.txt': 'main only\n' },
      { 'main.txt': 'main only\n', 'extra.txt': `token = "${secretToken()}"\n` }]) {
      const evil = await git(repo, ['commit-tree', await mergeTree(repo, feature, { 'shared.txt': 'resolved\n', ...files }),
        '-p', feature, '-p', mainTip, '-m', 'merge main']);
      assert.equal(await run(repo, ['pre-push'], { input: proposed(evil) }), 1);
      assert.equal(await run(repo, ['history', `${base}..${evil}`]), 1);
      assert.equal(await run(repo, ['history', evil]), 1);
    }
  });

  async function mergeTree(repo, from, files) {
    const index = path.join(repo, '.git', `merge-index-${randomBytes(4).toString('hex')}`);
    await git(repo, ['read-tree', from], undefined, { GIT_INDEX_FILE: index });
    for (const [name, content] of Object.entries(files)) {
      const blob = await git(repo, ['hash-object', '-w', '--stdin'], content);
      await git(repo, ['update-index', '--add', '--cacheinfo', `100644,${blob},${name}`], undefined, { GIT_INDEX_FILE: index });
    }
    const tree = await git(repo, ['write-tree'], undefined, { GIT_INDEX_FILE: index });
    rmSync(index, { force: true });
    return tree;
  }

  test('a published range over 1,000 changed files needs exact-head owner approval', async () => {
    const { repo, base } = await prFixture();
    const bulk = {};
    for (let index = 0; index < 1000; index += 1) bulk[`bulk/file-${String(index).padStart(4, '0')}.txt`] = `bulk ${index}\n`;
    const atLimit = await commitFiles(repo, bulk);
    assert.equal(await run(repo, ['pre-push'], { input: proposed(atLimit) }), 0);
    const over = await commitFiles(repo, { 'bulk/file-1000.txt': 'bulk 1000\n' });
    const notice = 'history scan exceeds 1,000 changed files; owner approval required';
    // These checks only read the fixture: run them together, then check each result.
    const wrongApprovals = [atLimit, base, over.slice(0, 12), over.toUpperCase(), `${over}\n`, '1'];
    const approved = { VELCRO_HISTORY_APPROVED: over };
    const [unapprovedPush, unapprovedHistory, wrongResults, approvedPush] = await Promise.all([
      run(repo, ['pre-push'], { input: proposed(over), notice }),
      run(repo, ['history', `${base}..${over}`], { notice }),
      Promise.all(wrongApprovals.map(async wrong => {
        const extra = { VELCRO_HISTORY_APPROVED: wrong };
        return Promise.all([run(repo, ['pre-push'], { input: proposed(over), extra, notice }),
          run(repo, ['history', `${base}..${over}`], { extra, notice })]);
      })),
      run(repo, ['pre-push'], { input: proposed(over), extra: approved }),
    ]);
    assert.equal(unapprovedPush, 3);
    assert.equal(unapprovedHistory, 3);
    for (const [push, history] of wrongResults) {
      assert.equal(push, 3);
      assert.equal(history, 3);
    }
    assert.equal(approvedPush, 0);
    // Approval names one head: the next head is blocked again.
    const next = await commit(repo, 'next\n');
    assert.equal(await run(repo, ['pre-push'], { input: proposed(next), extra: approved, notice }), 3);
    // Approval never clears findings.
    const secret = await commitFiles(repo, { 'notes.txt': `token = "${secretToken()}"\n` });
    assert.equal(await run(repo, ['pre-push'], { input: proposed(secret), extra: { VELCRO_HISTORY_APPROVED: secret } }), 1);
    // Full-history mode is not a published range and keeps only the hard caps.
    assert.equal(await run(repo, ['history', next]), 0);
  });

  test('content inherited from outside the range is scanned unless the base tip has it', async () => {
    // Main: A adds a forbidden value, B cleans it. The feature branched from A
    // never touches the file, and a merge with B keeps the feature's version.
    const repo = await fixture();
    const a = await commitFiles(repo, { 'notes.txt': `token = "${secretToken()}"\n` });
    const b = await commitFiles(repo, { 'notes.txt': 'cleaned\n' });
    await git(repo, ['update-ref', 'refs/remotes/origin/main', b]);
    await git(repo, ['checkout', '-q', '-b', 'feature/guard', a]);
    const f = await commitFiles(repo, { 'other.txt': 'clean feature\n' });
    const kept = await git(repo, ['commit-tree', `${f}^{tree}`, '-p', f, '-p', b, '-m', 'merge main keeping ours']);
    assert.equal(await run(repo, ['history', `${b}..${kept}`]), 1);
    assert.equal(await run(repo, ['pre-push'], { input: proposed(kept) }), 1);
    // The unmerged feature tip carries the same unscanned inherited value.
    assert.equal(await run(repo, ['history', `${b}..${f}`]), 1);
    // Taking the base's cleaned file in the merge does not hide the feature
    // commit, which itself still carries the value.
    const taken = await git(repo, ['commit-tree', await mergeTree(repo, f, { 'notes.txt': 'cleaned\n' }), '-p', f, '-p', b, '-m', 'merge main']);
    assert.equal(await run(repo, ['pre-push'], { input: proposed(taken) }), 1);
    // Control: a feature from the cleaned base passes and counts only its own change.
    const fresh = await fixture();
    await commitFiles(fresh, { 'notes.txt': `token = "${secretToken()}"\n` });
    const base = await commitFiles(fresh, { 'notes.txt': 'cleaned\n' });
    await git(fresh, ['update-ref', 'refs/remotes/origin/main', base]);
    await git(fresh, ['checkout', '-q', '-b', 'feature/guard']);
    const tip = await commitFiles(fresh, { 'other.txt': 'clean feature\n' });
    const clean = await scan(fresh, ['pre-push'], { input: proposed(tip) });
    assert.equal(clean.status, 0);
    assert.deepEqual(counted(clean.output), { entries: 1, commits: 1 });
  });

  test('an explicit range base must be the fetched main or its ancestor', async () => {
    const { repo, base } = await prFixture();
    const tip = await commit(repo, 'feature\n');
    assert.equal(await run(repo, ['history', `${base}..${tip}`]), 0);
    // A caller-chosen base past main cannot hide the range.
    assert.equal(await run(repo, ['history', `${tip}..${tip}`]), 2);
    await git(repo, ['symbolic-ref', 'refs/remotes/origin/main', 'refs/heads/main']);
    assert.equal(await run(repo, ['history', `${base}..${tip}`]), 2);
    await git(repo, ['symbolic-ref', '--delete', 'refs/remotes/origin/main']);
    assert.equal(await run(repo, ['history', `${base}..${tip}`]), 2);
    assert.equal(await run(repo, ['history', tip]), 0);
  });

  test('range edge cases: symlink, gitlink, mode-only, octopus and unrelated roots', async () => {
    const blocked = async (files, mode) => {
      const { repo, base } = await prFixture();
      const sha = await git(repo, ['hash-object', '-w', '--stdin'], files);
      await git(repo, ['update-index', '--add', '--cacheinfo', `${mode},${mode === '160000' ? base : sha},entry`]);
      await git(repo, ['commit', '-q', '-m', 'fixture entry']);
      const tip = await git(repo, ['rev-parse', 'HEAD']);
      assert.equal(await run(repo, ['pre-push'], { input: proposed(tip) }), 2);
      assert.equal(await run(repo, ['history', `${base}..${tip}`]), 2);
    };
    // Each case builds its own repository: run them together.
    await Promise.all([
      blocked('source.txt', '120000'),
      blocked('', '160000'),
      (async () => {
        const mode = await prFixture();
        await git(mode.repo, ['update-index', '--chmod=+x', 'source.txt']);
        await git(mode.repo, ['commit', '-q', '-m', 'mode only']);
        const modeTip = await git(mode.repo, ['rev-parse', 'HEAD']);
        const modeResult = await scan(mode.repo, ['pre-push'], { input: proposed(modeTip) });
        assert.equal(modeResult.status, 0);
        assert.deepEqual(counted(modeResult.output), { entries: 1, commits: 1 });
      })(),
      (async () => {
        // Octopus: content in no parent is scanned; content equal to a parent is not.
        const { repo, base } = await prFixture();
        const sides = [];
        for (const name of ['one', 'two', 'three']) {
          await git(repo, ['checkout', '-q', '-B', `side-${name}`, base]);
          sides.push(await commitFiles(repo, { [`${name}.txt`]: `${name}\n` }));
        }
        await git(repo, ['checkout', '-q', 'feature/guard']);
        const octopusTree = files => mergeTree(repo, sides[0], { 'two.txt': 'two\n', 'three.txt': 'three\n', ...files });
        const octopus = async files => git(repo, ['commit-tree', await octopusTree(files), ...sides.flatMap(side => ['-p', side]), '-m', 'octopus']);
        const cleanOctopus = await scan(repo, ['pre-push'], { input: proposed(await octopus({})) });
        assert.equal(cleanOctopus.status, 0);
        assert.deepEqual(counted(cleanOctopus.output), { entries: 3, commits: 4 });
        const evil = await octopus({ 'extra.txt': `token = "${secretToken()}"\n` });
        assert.equal(await run(repo, ['pre-push'], { input: proposed(evil) }), 1);
        assert.equal(await run(repo, ['history', `${base}..${evil}`]), 1);
      })(),
      (async () => {
        // Unrelated root in range: carries a value, later deletes it, then merged.
        const unrelated = await prFixture();
        await git(unrelated.repo, ['checkout', '-q', '--orphan', 'stray']);
        await git(unrelated.repo, ['rm', '-q', '-r', '--cached', '.']);
        const root = await commitFiles(unrelated.repo, { 'stray.txt': `token = "${secretToken()}"\n` });
        await git(unrelated.repo, ['rm', '-q', '--', 'stray.txt']);
        await git(unrelated.repo, ['commit', '-q', '-m', 'remove stray']);
        const removed = await git(unrelated.repo, ['rev-parse', 'HEAD']);
        assert.equal(await git(unrelated.repo, ['rev-parse', `${removed}^`]), root);
        await git(unrelated.repo, ['checkout', '-q', '-f', 'feature/guard']);
        const head = await git(unrelated.repo, ['rev-parse', 'HEAD']);
        const joined = await git(unrelated.repo, ['commit-tree', `${head}^{tree}`, '-p', head, '-p', removed, '-m', 'join']);
        assert.equal(await run(unrelated.repo, ['pre-push'], { input: proposed(joined) }), 1);
        assert.equal(await run(unrelated.repo, ['history', `${unrelated.base}..${joined}`]), 1);
      })(),
    ]);
  });

  // The real CI history step, run with this engine as the trusted copy: every PR
  // meets the 1,000-entry budget against the fetched main, so targeting (or
  // retargeting from) a branch that is not main cannot skip the approval.
  test('CI history step enforces the main publication budget whatever the PR base', async () => {
    const workflow = readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');
    const step = /- name: Trusted source and history scan\n([\s\S]*?)(?=\n {6}(?:#|- )|\n\n)/.exec(workflow)?.[1] ?? '';
    const script = /\n {8}run: \|\n((?: {10}.*\n?)+)/.exec(step)?.[1];
    assert.ok(script, 'actual history step must be testable');
    const { repo, base } = await prFixture();
    mkdirSync(path.join(repo, '.airig/trusted/scripts/security'), { recursive: true });
    symlinkSync(path.join(root, 'scripts/security/git-privacy.mjs'), path.join(repo, '.airig/trusted/scripts/security/git-privacy.mjs'));
    // An intermediate target branch that is not part of main.
    await git(repo, ['checkout', '-q', '-b', 'target']);
    const target = await commit(repo, 'target change\n');
    await git(repo, ['checkout', '-q', '-b', 'large']);
    const bulk = {};
    for (let index = 0; index <= 1000; index += 1) bulk[`bulk/file-${String(index).padStart(4, '0')}.txt`] = `bulk ${index}\n`;
    const head = await commitFiles(repo, bulk);
    const step$ = async (event, baseOid, approved = '') => {
      const result = await spawnAsync('sh', ['-e', '-c', script], { cwd: repo, encoding: 'utf8', timeout: 300000, env: { ...env,
        EVENT_NAME: event, BASE_OID: baseOid, HEAD_OID: head, VELCRO_HISTORY_APPROVED: approved,
        PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH}` } });
      const output = `${result.stdout}${result.stderr}`;
      assert.ok(!output.includes(repo), 'diagnostic exposed fixture location');
      return { status: result.status, output };
    };
    const notice = 'history scan exceeds 1,000 changed files; owner approval required';
    // The step only reads the fixture, so its runs are independent: start them together, then check each.
    const wrongApprovals = [target, base];
    const [unapproved, wrongResults, approvedTarget, retargeted, approvedMain, group, groupTarget, push] = await Promise.all([
      step$('pull_request', target),
      Promise.all(wrongApprovals.map(wrong => step$('pull_request', target, wrong))),
      step$('pull_request', target, head),
      step$('pull_request', base),
      step$('pull_request', base, head),
      step$('merge_group', base),
      step$('merge_group', target),
      step$('push', '0'.repeat(40)),
    ]);
    // Non-qualifying base (PR into `target`): fails closed without approval...
    assert.equal(unapproved.status, 3);
    assert.ok(unapproved.output.includes(notice));
    for (const wrong of wrongResults) assert.equal(wrong.status, 3);
    // ...and passes only with exact-head approval (budget, then full history).
    assert.equal(approvedTarget.status, 0);
    // After a retarget to main the same head is still capped.
    assert.equal(retargeted.status, 3);
    assert.equal(approvedMain.status, 0);
    // A merge group (main plus the squashed PR) meets the same budget; the workflow never approves one (tests/bootstrap/ci.test.mjs).
    assert.equal(group.status, 3);
    assert.ok(group.output.includes(notice));
    assert.equal(groupTarget.status, 3);
    // A push has no PR budget step; full-history mode stays uncapped.
    assert.equal(push.status, 0);
  });
});
