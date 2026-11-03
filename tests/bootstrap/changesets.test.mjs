import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { devNull, tmpdir } from 'node:os';
import { delimiter, dirname, join, relative } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cli = join(root, 'node_modules', '@changesets', 'cli', 'bin.js');
const config = JSON.parse(readFileSync(join(root, '.changeset', 'config.json'), 'utf8'));
const dirs = [];

const snapshot = () =>
  readdirSync(join(root, '.changeset')).sort().map(f =>
    f + ':' + createHash('sha256').update(readFileSync(join(root, '.changeset', f))).digest('hex'));
const before = snapshot();

after(() => dirs.forEach(d => rmSync(d, { recursive: true, force: true })));

const tmp = prefix => {
  const d = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(d);
  return d;
};
const write = (file, data) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n');
};

// Shims named like package managers record any invocation and fail, so a publish attempt is detectable and harmless.
const shimDir = tmp('velcro-shim-');
const marker = join(shimDir, 'invoked.log');
for (const name of ['npm', 'pnpm', 'yarn', 'npx']) {
  const body = `require('node:fs').appendFileSync(${JSON.stringify(marker)}, ${JSON.stringify(name)} + ' ' + process.argv.slice(2).join(' ') + '\\n');\nprocess.exit(99);\n`;
  write(join(shimDir, name), `#!${process.execPath}\n${body}`);
  chmodSync(join(shimDir, name), 0o755);
}
const gitDir = (process.env.PATH ?? '').split(delimiter).find(d => d && existsSync(join(d, 'git')));
assert.ok(gitDir, 'git must be on PATH');
const emptyRc = join(shimDir, 'empty.npmrc');
write(emptyRc, '');
const attempts = () => (existsSync(marker) ? readFileSync(marker, 'utf8') : '');

// Isolated environment: no user/global npm config, no tokens, unreachable registry.
const fixtureEmail = ['fixture', 'example.invalid'].join('@');
const isolatedEnv = home => ({
  PATH: [shimDir, dirname(process.execPath), gitDir].join(delimiter),
  HOME: home,
  CI: '1',
  GIT_CONFIG_GLOBAL: devNull,
  GIT_CONFIG_SYSTEM: devNull,
  GIT_AUTHOR_NAME: 'fixture', GIT_AUTHOR_EMAIL: fixtureEmail,
  GIT_COMMITTER_NAME: 'fixture', GIT_COMMITTER_EMAIL: fixtureEmail,
  NPM_CONFIG_USERCONFIG: emptyRc,
  NPM_CONFIG_GLOBALCONFIG: emptyRc,
  npm_config_registry: ['http:', '', [127, 0, 0, 1].join('.') + ':9/'].join('/'),
});

function fixture(changesets = {}, { cfg = config, pkgs } = {}) {
  const dir = tmp('velcro-cs-');
  write(join(dir, 'package.json'), { name: 'fixture-root', private: true, version: '0.0.0' });
  write(join(dir, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'\n");
  write(join(dir, '.changeset', 'config.json'), cfg);
  const list = pkgs ?? [
    ['lib', '@fixture/lib', '0.1.0', true],
    ['app', '@fixture/app', '1.0.0', true],
  ];
  for (const [d, name, version, priv] of list) {
    write(join(dir, 'packages', d, 'package.json'), { name, version, ...(priv ? { private: true } : {}) });
    write(join(dir, 'packages', d, 'CHANGELOG.md'), `# ${name}\n`);
  }
  for (const [name, body] of Object.entries(changesets)) write(join(dir, '.changeset', `${name}.md`), body);
  const git = (...a) => {
    const res = spawnSync('git', a, { cwd: dir, encoding: 'utf8', env: isolatedEnv(dir) });
    assertOk(res);
    return res;
  };
  git('init', '-q');
  git('add', '-A');
  git('commit', '-q', '-m', 'fixture');
  return { dir, git };
}

const run = (dir, args) =>
  spawnSync(process.execPath, [cli, ...args], { cwd: dir, encoding: 'utf8', env: isolatedEnv(dir), timeout: 60000 });

function assertOk(res) {
  assert.equal(res.error, undefined, 'spawn error');
  assert.equal(res.signal, null, 'terminated by signal');
  assert.equal(res.status, 0, 'subprocess failed: ' + (res.stderr || '').split('\n')[0]);
}
const pkgVersion = (dir, p) => JSON.parse(readFileSync(join(dir, 'packages', p, 'package.json'), 'utf8')).version;
const changelog = (dir, p) => readFileSync(join(dir, 'packages', p, 'CHANGELOG.md'), 'utf8');

test('config versions private packages without tagging or committing', () => {
  assert.deepEqual(config.privatePackages, { version: true, tag: false });
  assert.equal(config.commit, false);
  assert.equal(config.access, 'restricted');
});

test('installed CLI is available', () => {
  assert.ok(existsSync(cli), 'changesets CLI must be installed');
});

test('negative controls: failure, spawn error and publication attempts are not safe', () => {
  const { dir } = fixture();
  const bad = run(dir, ['no-such-command']);
  assert.notEqual(bad.status, 0);
  assert.throws(() => assertOk(bad));
  assert.throws(() => assertOk({ error: new Error('x'), status: null, signal: null }));
  assert.throws(() => assertOk({ status: 0, signal: 'SIGTERM' }));

  // A non-private package must reach the npm shim; proving attempted publication is detected.
  rmSync(marker, { force: true });
  const { dir: pub } = fixture({}, { pkgs: [['lib', '@fixture/lib', '0.1.0', false]] });
  run(pub, ['publish']);
  assert.match(attempts(), /^npm /m, 'instrumentation must observe a publish attempt');
  rmSync(marker, { force: true });
});

test('isolated environment has no inherited registry or auth', () => {
  const env = isolatedEnv(join(shimDir, 'home'));
  assert.ok(!Object.keys(env).some(k => /token|_authtoken|_password|^_auth$/i.test(k)));
  assert.equal(readFileSync(emptyRc, 'utf8'), '');
  assert.match(env.npm_config_registry, /^http:\/\/127\.0\.0\.1:9\/$/);
});

test('version bumps only the named package and writes a changelog entry', () => {
  const { dir } = fixture({ 'one-minor': '---\n"@fixture/lib": minor\n---\n\nAdd a thing\n' });
  assertOk(run(dir, ['version']));
  assert.equal(pkgVersion(dir, 'lib'), '0.2.0');
  assert.equal(pkgVersion(dir, 'app'), '1.0.0');
  const log = changelog(dir, 'lib');
  assert.match(log, /^# @fixture\/lib\n\n## 0\.2\.0\n/);
  assert.match(log, /Add a thing/);
  assert.doesNotMatch(log, /unreleased/i);
  assert.equal(changelog(dir, 'app'), '# @fixture/app\n');
  assert.ok(!existsSync(join(dir, '.changeset', 'one-minor.md')));
  assert.equal(attempts(), '');
});

test('packages version independently with their own bump types', () => {
  const { dir } = fixture({
    a: '---\n"@fixture/lib": patch\n---\n\nFix lib\n',
    b: '---\n"@fixture/app": major\n---\n\nBreak app\n',
  });
  assertOk(run(dir, ['version']));
  assert.equal(pkgVersion(dir, 'lib'), '0.1.1');
  assert.equal(pkgVersion(dir, 'app'), '2.0.0');
});

test('version creates no tag and no unreleased placeholder', () => {
  const { dir, git } = fixture({ x: '---\n"@fixture/lib": minor\n---\n\nAdd\n' });
  assertOk(run(dir, ['version']));
  assert.equal(git('tag', '--list').stdout.trim(), '');
  for (const p of ['lib', 'app']) assert.doesNotMatch(changelog(dir, p), /unreleased/i);
  assert.equal(attempts(), '');
});

test('publish of private packages is a successful no-op: no tag, no package-manager call', () => {
  const { dir, git } = fixture();
  const res = run(dir, ['publish']);
  assertOk(res);
  assert.match(res.stdout + res.stderr, /No unpublished projects to publish/);
  assert.equal(git('tag', '--list').stdout.trim(), '');
  assert.equal(attempts(), '');
});

test('tag detection works: enabling private tagging would create a tag (negative control)', () => {
  const cfg = { ...config, privatePackages: { version: true, tag: true } };
  const { dir, git } = fixture({}, { cfg });
  assertOk(run(dir, ['publish']));
  assert.notEqual(git('tag', '--list').stdout.trim(), '', 'control config should tag');
  assert.equal(attempts(), '');
});

test('fixtures ran outside the repository and real changesets are unchanged', () => {
  for (const d of dirs) assert.ok(relative(root, d).startsWith('..'), 'fixture inside repo');
  assert.deepEqual(snapshot(), before);
  assert.ok(before.some(e => e.startsWith('config.json:')));
});

test('root package.json has no version/publish lifecycle', () => {
  const { scripts } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.ok(!Object.keys(scripts).some(k => /publish|release|^version$/.test(k)));
});
