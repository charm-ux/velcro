import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { devNull, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkExports, readCatalog } from '../../scripts/site/catalog.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = rel => readFileSync(join(root, rel), 'utf8');
const json = rel => JSON.parse(read(rel));

test('root package is private and pins tooling', () => {
  const pkg = json('package.json');
  assert.equal(pkg.private, true);
  assert.equal(pkg.packageManager, 'pnpm@9.15.9');
  assert.equal(pkg.engines.node, '24.22.1');
  assert.equal(pkg.devDependencies['@changesets/cli'], '2.29.8');
  assert.equal(pkg.devDependencies.tar, '7.5.22');
  assert.equal(pkg.devDependencies.typescript, '5.9.3');
  assert.equal(pkg.devDependencies['@playwright/test'], '1.64.1');
  assert.equal(pkg.devDependencies.plop, '3.1.2');
});

test('root scripts are limited and have no lifecycle or publish hooks', () => {
  const { scripts } = json('package.json');
  assert.match(scripts.test, /node --test/);
  assert.match(scripts.test, /tests/);
  assert.match(scripts.changeset, /changeset/);
  assert.match(scripts['changeset:status'], /changeset status/);
  assert.match(scripts['changeset:version'], /changeset version/);
  for (const [name, cmd] of Object.entries(scripts)) {
    assert.doesNotMatch(name, /^(pre|post)|^(prepare|prepublish|publish|release|version)$/);
    assert.doesNotMatch(cmd, /publish|changeset tag|npm version/);
  }
});

test('.nvmrc pins Node', () => {
  assert.equal(read('.nvmrc').trim(), '24.22.1');
});

test('workspace file lists packages', () => {
  assert.match(read('pnpm-workspace.yaml'), /packages\/\*/);
});

const catalog = readCatalog(root);
// The export contract follows the component catalog: fixed entries, ./<name> (and optionally ./<name>/class) per component.
const exportTargets = file => ({ types: `./dist/${file}.d.ts`, import: `./dist/${file}.js` });
const prototypeExports = {
  '.': { types: './dist/index.d.ts', import: './dist/index.js' },
  ...Object.fromEntries(catalog.map(c => [`./${c.name}`, exportTargets(`components/${c.name}/index`)])),
  './button/class': exportTargets('components/button/class'),
  './card/class': exportTargets('components/card/class'),
  './mutation-observer/class': exportTargets('components/mutation-observer/class'),
  './popup/class': exportTargets('components/popup/class'),
  './progress-bar/class': exportTargets('components/progress-bar/class'),
  './progress-ring/class': exportTargets('components/progress-ring/class'),
  './relative-time/class': exportTargets('components/relative-time/class'),
  './resize-observer/class': exportTargets('components/resize-observer/class'),
  './skeleton/class': exportTargets('components/skeleton/class'),
  './spinner/class': exportTargets('components/spinner/class'),
  './themes/dark.css': './themes/dark.css',
  './themes/light.css': './themes/light.css',
  './custom-elements.json': './custom-elements.json',
  './react': { types: './dist/react/index.d.ts', import: './dist/react/index.js' },
  './react/*': './dist/react/*',
  './package.json': './package.json',
};

function checkVelcroPackage(pkg) {
  assert.equal(pkg.name, '@charm-ux/velcro');
  assert.equal(pkg.version, '0.1.0');
  assert.equal(pkg.private, true);
  assert.equal(pkg.license, 'UNLICENSED');
  assert.equal(pkg.bin, undefined);
  assert.equal(pkg.module, undefined);
  // During local integration the original scaffold may still be present. The
  // product lane owns its manifest; the prototype export contract is bounded.
  if (pkg.exports !== undefined) {
    assert.equal(pkg.main, './dist/index.js');
    assert.equal(pkg.types, './dist/index.d.ts');
    assert.deepEqual(checkExports(pkg.exports, catalog), []);
    assert.deepEqual(Object.keys(pkg.exports).filter(k => k.endsWith('/class')).every(k => catalog.some(c => k === `./${c.name}/class`)), true);
    const files = ['dist', 'themes'];
    if (pkg.files?.includes('custom-elements.json')) files.push('custom-elements.json');
    if (pkg.files?.includes('THIRD_PARTY_NOTICES.md')) files.push('THIRD_PARTY_NOTICES.md');
    assert.deepEqual(pkg.files, files);
    assert.deepEqual(pkg.dependencies, { '@charm-ux/core': '0.5.2', lit: '3.3.3' });
  } else {
    for (const key of ['main', 'types', 'files']) assert.equal(pkg[key], undefined);
  }
  for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
    assert.doesNotMatch(name, /^(pre|post)|^(prepare|publish|release|version)$/);
    assert.doesNotMatch(command, /publish|changeset tag|npm version/);
  }
}

test('velcro prototype retains identity, privacy, license and publication locks', () => {
  checkVelcroPackage(json('packages/velcro/package.json'));
});

test('prototype exports are supported without weakening publication locks', () => {
  const prototype = { name: '@charm-ux/velcro', version: '0.1.0', private: true, license: 'UNLICENSED',
    main: './dist/index.js', types: './dist/index.d.ts', exports: prototypeExports,
    files: ['dist', 'themes'], dependencies: { '@charm-ux/core': '0.5.2', lit: '3.3.3' },
    scripts: { build: 'tsc -p tsconfig.json' } };
  checkVelcroPackage(prototype);
  checkVelcroPackage({ ...prototype, files: [...prototype.files, 'THIRD_PARTY_NOTICES.md'] });
  checkVelcroPackage({ ...prototype, files: [...prototype.files, 'custom-elements.json', 'THIRD_PARTY_NOTICES.md'] });
  for (const unsafe of [{ private: false }, { license: 'MIT' }, { version: '1.0.0' },
    { exports: { ...prototypeExports, './scratch': './.airig/private.txt' } },
    { files: ['.airig'] }, { scripts: { publish: 'npm publish' } }]) {
    assert.throws(() => checkVelcroPackage({ ...prototype, ...unsafe }));
  }
});

test('only the registering entries have side effects; class-only entries and the helper stay pure', () => {
  const { sideEffects } = json('packages/velcro/package.json');
  assert.deepEqual(sideEffects, ['./dist/index.js', './dist/components/*/index.js', '*.css']);
  assert.ok(!sideEffects.some(pattern => /class|registration|utilities/.test(pattern)));
});

test('changelog is heading-only', () => {
  assert.equal(read('packages/velcro/CHANGELOG.md').trim(), '# @charm-ux/velcro');
});

test('lockfile exists', () => {
  assert.ok(existsSync(join(root, 'pnpm-lock.yaml')));
});

test('gitignore ignores scratch and does not conceal tracked security files', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'velcro-ws-'));
  const env = { ...process.env, HOME: scratch, XDG_CONFIG_HOME: scratch, GIT_CONFIG_GLOBAL: devNull, GIT_CONFIG_SYSTEM: devNull, GIT_CONFIG_NOSYSTEM: '1' };
  const ignored = p => {
    const res = spawnSync('git', ['check-ignore', '--no-index', '-q', p], { cwd: root, env });
    assert.equal(res.error, undefined);
    assert.ok(res.status === 0 || res.status === 1, 'git check-ignore failed');
    return res.status === 0;
  };
  for (const p of ['.airig/x.md', '.worktrees/x/y', 'node_modules/x/y.js', 'dist/x.js', 'coverage/x', '.env', '.env.local', 'pkg.tgz', '.cache/x']) {
    assert.ok(ignored(p), `${p} should be ignored`);
  }
  for (const p of [
    'AGENTS.md', 'package.json', 'pnpm-lock.yaml', '.npmrc', '.nvmrc', '.gitignore', '.changeset/config.json',
    'security/policy.json', 'security/gitleaks-checksums.json', 'scripts/security/privacy.mjs', '.githooks/pre-commit',
    '.github/workflows/ci.yml', 'tests/security/privacy.test.mjs', 'docs/contributing.md', 'packages/velcro/package.json',
    'packages/velcro/CHANGELOG.md', 'packages/velcro/src/index.ts',
  ]) {
    assert.ok(!ignored(p), `${p} must not be ignored`);
  }
});

const SHA = /^sha512-[A-Za-z0-9+/]{86}==$/;
export function lockProblems(text) {
  const problems = [];
  if (/tarball:/.test(text)) problems.push('tarball endpoint');
  if (/https?:\/\//.test(text.replace(/https:\/\/registry\.npmjs\.org\//g, ''))) problems.push('non-public url');
  const res = text.split('\n').filter(l => /^\s+resolution:/.test(l));
  if (res.length === 0) problems.push('no resolutions');
  for (const l of res) {
    const m = /integrity: ([^,}\s]+)/.exec(l);
    if (!m || !SHA.test(m[1])) problems.push('weak or missing integrity');
  }
  return problems;
}

test('lockfile has no custom endpoints and only sha512 integrity', () => {
  assert.deepEqual(lockProblems(read('pnpm-lock.yaml')), []);
});

test('lockfile validator rejects bad inputs (negative controls)', () => {
  const host = ['feed', 'example', 'test'].join('.');
  const good = 'x@1:\n    resolution: {integrity: sha512-' + 'A'.repeat(86) + '==}\n';
  assert.deepEqual(lockProblems(good), []);
  assert.ok(lockProblems(good.replace('}', `, tarball: https://${host}/x.tgz}`)).includes('tarball endpoint'));
  assert.ok(lockProblems(good + `  # https://${host}/\n`).includes('non-public url'));
  assert.ok(lockProblems(good.replace(/sha512-A+==/, 'md5-' + 'A'.repeat(22) + '==')).includes('weak or missing integrity'));
  assert.ok(lockProblems(good.replace(/sha512-A+==/, 'sha1-' + 'A'.repeat(27) + '=')).includes('weak or missing integrity'));
  assert.ok(lockProblems('x@1:\n    resolution: {}\n').includes('weak or missing integrity'));
  assert.ok(lockProblems('').includes('no resolutions'));
});

test('.npmrc pins the public registry and carries no auth or other registries', () => {
  const lines = read('.npmrc').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  assert.deepEqual(lines, ['registry=https://registry.npmjs.org/']);
});

test('AGENTS.md documents the contributor policy', () => {
  const text = read('AGENTS.md');
  for (const re of [
    /worktree/i,
    /relative path/i,
    /\.airig/,
    /noreply/,
    /no bypass|never bypass|do not bypass/i,
    /--no-verify/,
    /human review/i,
    /privacy\.mjs/,
    /gitleaks\.mjs/,
    /git-privacy\.mjs/,
    /stop/i,
  ]) {
    assert.match(text, re);
  }
});

test('committed scaffold files contain no machine paths', () => {
  const home = ['/Us', 'ers/'].join('');
  const linux = ['/ho', 'me/'].join('');
  for (const f of ['AGENTS.md', '.gitignore', 'package.json', 'pnpm-workspace.yaml', '.changeset/config.json', '.changeset/README.md', 'packages/velcro/package.json']) {
    const t = read(f);
    assert.ok(!t.includes(home) && !t.includes(linux), f);
  }
});
