// Derived lists (scripts/sync.mjs). The committed derived files must be current, and two branches that each add a
// component the documented way (docs/contributing.md, "Adding a component") must merge with each other in either
// order without a conflict, leaving a tree that passes the same source gates.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { devNull, tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkCoverage, checkExports, readCatalog } from '../../scripts/site/catalog.mjs';
import { PACKAGE_JSON, assembleNotices, checkDerived, checkPackageJson, renderBarrel, renderPackageJson, velcroExports }
  from '../../scripts/sync.mjs';
import { checkVendor, readInventory } from '../../scripts/upstream-conformance.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

test('the committed derived files are current (the fix is `pnpm sync`)', async () => {
  assert.deepEqual(await checkDerived(root), []);
  const pkg = JSON.parse(readFileSync(path.join(root, PACKAGE_JSON), 'utf8'));
  assert.deepEqual(checkExports(pkg.exports, readCatalog(root)), []);
  assert.doesNotMatch(pkg.description, /sl-|button|badge/, 'the package description lists no component');
  const barrel = renderBarrel(root).split('\n').filter(l => l.startsWith('export'));
  assert.deepEqual(barrel, readCatalog(root).map(c => `export * from './components/${c.name}/index.js';`));
});

test('the export map check accepts any line order and rejects anything else that differs', () => {
  const scratch = mkdtempSync(path.join(tmpdir(), 'velcro-sync-'));
  try {
    for (const f of ['packages/docs/catalog.jsonl', 'packages/velcro/src/components', PACKAGE_JSON]) {
      cpSync(path.join(root, f), path.join(scratch, f), { recursive: true });
    }
    const file = path.join(scratch, PACKAGE_JSON);
    const canonical = readFileSync(file, 'utf8');
    const lines = canonical.split('\n');
    const at = key => lines.findIndex(l => l.startsWith(`    "${key}":`));
    const write = text => { writeFileSync(file, text); return checkPackageJson(scratch); };
    assert.deepEqual(write(canonical), []);
    // A union merge leaves both sides' lines at one place, out of order.
    const swapped = [...lines];
    [swapped[at('./badge')], swapped[at('./visually-hidden')]] = [`${lines[at('./visually-hidden')]}`, lines[at('./badge')]];
    assert.deepEqual(write(swapped.join('\n')), []);
    const stale = [`${PACKAGE_JSON}: exports are stale (run \`pnpm sync\`)`];
    assert.deepEqual(write(lines.filter((_, i) => i !== at('./badge')).join('\n')), stale, 'a missing export');
    assert.deepEqual(write([...lines.slice(0, at('./badge') + 1), lines[at('./badge')], ...lines.slice(at('./badge') + 1)].join('\n')),
      stale, 'a duplicated export');
    assert.deepEqual(write(canonical.replace('"./badge": { "types"', '"./badge": {  "types"')), stale, 'reformatted');
    // Only the export map is derived; the rest must keep the canonical JSON formatting (so the next sync is a no-op).
    assert.deepEqual(write(canonical.replace('"private": true', '"private":true')), stale, 'a reformatted field');
    assert.deepEqual(write(canonical.replace('"./badge":', '"./badge-x":')), [`${PACKAGE_JSON}: unexpected export line (run \`pnpm sync\`)`]);
    assert.deepEqual(write(canonical.replace('{\n', '{\n,')), [`${PACKAGE_JSON}: not valid JSON`]);
    // The renderer round-trips: every export on its own line, the rest as JSON.stringify writes it.
    const pkg = JSON.parse(canonical);
    assert.equal(renderPackageJson(pkg, velcroExports(scratch)), canonical);
    assert.deepEqual(JSON.parse(canonical).exports, velcroExports(scratch));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

// --- Two parallel component branches -------------------------------------------------------------------------------

// A synthetic identity for the scratch repository only, assembled at runtime (no address is committed).
const fixtureEmail = ['velcro-test', 'example.invalid'].join('@');
const gitEnv = { ...process.env, GIT_CONFIG_GLOBAL: devNull, GIT_CONFIG_SYSTEM: devNull, GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'velcro-test', GIT_AUTHOR_EMAIL: fixtureEmail, GIT_COMMITTER_NAME: 'velcro-test', GIT_COMMITTER_EMAIL: fixtureEmail };
const git = (dir, ...args) => {
  const r = spawnSync('git', ['-c', 'init.defaultBranch=main', '-c', 'commit.gpgsign=false', '-c', `core.hooksPath=${devNull}`, ...args],
    { cwd: dir, env: gitEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
};
const ok = (dir, ...args) => {
  const r = git(dir, ...args);
  assert.equal(r.status, 0, `git ${args[0]} failed`);
  return r.out;
};

// The repository as it is now (tracked files plus this branch's new ones), committed into a scratch repository.
function scratchRepo({ attributes = true } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'velcro-merge-'));
  const files = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
    .stdout.split('\0').filter(f => f && existsSync(path.join(root, f)));
  for (const f of files) cpSync(path.join(root, f), path.join(dir, f), { recursive: true });
  if (!attributes) rmSync(path.join(dir, '.gitattributes'));
  ok(dir, 'init', '-q');
  ok(dir, 'add', '-A');
  ok(dir, 'commit', '-qm', 'base');
  return dir;
}

const put = (dir, rel, text) => {
  mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  writeFileSync(path.join(dir, rel), text);
};
const pascal = name => name.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('');

// Adds a component the documented way: its own files, one catalog line (inserted in order, as the generator does),
// its changeset, then `pnpm sync`'s export map. Returns the paths the branch changed.
async function addComponent(dir, name) {
  const tag = `sl-${name}`;
  const cls = `Velcro${pascal(name)}`;
  const header = '// Adapted from Shoelace v2.20.1; see THIRD_PARTY_NOTICES.md.\n';
  put(dir, `packages/velcro/src/components/${name}/${name}.ts`, `${header}/**\n * @tag ${tag}\n */\nexport class ${cls} {}\n`);
  put(dir, `packages/velcro/src/components/${name}/class.ts`, `export * from './${name}.js';\nexport { ${cls} as Sl${pascal(name)} } from './${name}.js';\n`);
  put(dir, `packages/velcro/src/components/${name}/index.ts`, "export * from './class.js';\n");
  put(dir, `packages/velcro/src/components/${name}/NOTICE.md`, `- Also used in: \`packages/velcro/src/components/${name}/${name}.ts\`.\n`);
  put(dir, `packages/docs/pages/components/${name}.ts`, 'export {};\n');
  put(dir, `packages/docs/examples/${name}/basic.html`, `<${tag} id="demo-default"></${tag}>\n`);
  put(dir, `packages/docs/showcase/${name}.html`, `<${tag}></${tag}>\n`);
  put(dir, `tests/product/${name}.spec.mjs`, 'export {};\n');
  put(dir, `tests/product/${name}.probe.json`, '{ "content": "x" }\n');
  put(dir, `tests/api/components/${name}.mjs`, 'export default function () {}\n');
  put(dir, `docs/api/parity/${name}.md`, `# \`${tag}\` Shoelace API parity\n`);
  const upstream = `src/components/${name}/${name}.test.ts`;
  const test = `describe('<${tag}>', () => { it('works', () => {}); });\n`;
  put(dir, `tests/upstream/shoelace-2.20.1/${upstream}`, test);
  put(dir, `tests/upstream/components/${name}.json`, `${JSON.stringify({
    files: { [upstream]: createHash('sha256').update(test).digest('hex') }, tests: [`<${tag}> > works`], knownFailures: [],
  }, null, 2)}\n`);
  put(dir, `.changeset/add-${name}.md`, `---\n'@charm-ux/velcro': minor\n---\n\nAdd ${tag}.\n`);
  const catalog = path.join(dir, 'packages/docs/catalog.jsonl');
  const lines = readFileSync(catalog, 'utf8').split('\n').filter(Boolean);
  lines.push(JSON.stringify({ name, title: pascal(name).replace(/(?<=[a-z])(?=[A-Z])/g, ' '), tag, example: '#demo-default' }));
  lines.sort((a, b) => (JSON.parse(a).name < JSON.parse(b).name ? -1 : 1));
  writeFileSync(catalog, `${lines.join('\n')}\n`);
  const { writePackageJson } = await import('../../scripts/sync.mjs');
  writePackageJson(dir);
  ok(dir, 'add', '-A');
  ok(dir, 'commit', '-qm', `add ${tag}`);
  return ok(dir, 'diff', '--name-only', 'main', 'HEAD').split('\n').filter(Boolean);
}

// Two names that land between the same two existing catalog entries (tab-panel < tag < textarea < visually-hidden),
// so their catalog lines and export lines are inserted at the same place: the case a plain line merge conflicts on.
const NAMES = ['tag', 'textarea'];

test('two branches that each add a component touch only their own files, the catalog, the export map and a changeset', async () => {
  const dir = scratchRepo();
  try {
    for (const name of NAMES) {
      ok(dir, 'checkout', '-qb', name, 'main');
      const shared = (await addComponent(dir, name)).filter(f => !f.includes(`/${name}/`) && !f.includes(`/${name}.`)
        && !f.endsWith(`/add-${name}.md`));
      assert.deepEqual(shared, ['packages/docs/catalog.jsonl', PACKAGE_JSON], name);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

for (const [ours, theirs] of [NAMES, [...NAMES].reverse()]) {
  test(`merging ${theirs} into ${ours} is clean and the merged tree passes the source gates`, async () => {
    const dir = scratchRepo();
    try {
      for (const name of NAMES) {
        ok(dir, 'checkout', '-qb', name, 'main');
        await addComponent(dir, name);
      }
      ok(dir, 'checkout', '-q', ours);
      const merge = git(dir, 'merge', '--no-edit', theirs);
      assert.equal(merge.status, 0, 'merge conflicted');
      assert.equal(ok(dir, 'status', '--porcelain'), '');
      const names = readCatalog(dir).map(c => c.name);
      for (const name of NAMES) assert.ok(names.includes(name), name);
      assert.deepEqual(checkCoverage(dir), []);
      assert.deepEqual(checkPackageJson(dir), []);
      const pkg = JSON.parse(readFileSync(path.join(dir, PACKAGE_JSON), 'utf8'));
      assert.deepEqual(checkExports(pkg.exports, readCatalog(dir)), []);
      for (const name of NAMES) {
        assert.ok(pkg.exports[`./${name}/class`], name);
        assert.ok(assembleNotices(dir).includes(`packages/velcro/src/components/${name}/${name}.ts`), name);
        assert.ok(renderBarrel(dir).includes(`./components/${name}/index.js`), name);
        assert.deepEqual(readInventory(dir)[name], [`<sl-${name}> > works`]);
      }
      assert.deepEqual(checkVendor(dir), []);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

test('negative control: without the union merge attributes the same two branches conflict', async () => {
  const dir = scratchRepo({ attributes: false });
  try {
    for (const name of NAMES) {
      ok(dir, 'checkout', '-qb', name, 'main');
      await addComponent(dir, name);
    }
    ok(dir, 'checkout', '-q', NAMES[0]);
    const merge = git(dir, 'merge', '--no-edit', NAMES[1]);
    assert.notEqual(merge.status, 0);
    const conflicted = ok(dir, 'diff', '--name-only', '--diff-filter=U').split('\n').filter(Boolean).sort();
    assert.deepEqual(conflicted, ['packages/docs/catalog.jsonl', PACKAGE_JSON]);
    git(dir, 'merge', '--abort');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
