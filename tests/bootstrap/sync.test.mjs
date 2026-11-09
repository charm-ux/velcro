// Derived lists (scripts/sync.mjs). The committed derived files must be current, and two branches that each add a
// component the documented way (docs/contributing.md, "Adding a component") must merge with each other in either
// order without a conflict, leaving a tree that passes the same source gates. The merges run with local git, which
// applies .gitattributes; a hosted merge may not (docs/contributing.md, "Parallel component branches").
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { devNull, tmpdir } from 'node:os';
import path from 'node:path';
import test, { describe } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkCoverage, checkExports, readCatalog } from '../../scripts/site/catalog.mjs';
import { analyzeVelcro, customElements } from '../../scripts/api/model.mjs';
import { checkReports, currentParity, readLedger } from '../../scripts/api/parity.mjs';
import { PACKAGE_JSON, assembleNotices, checkDerived, checkPackageJson, checkProvenance, duplicateKeys, renderBarrel,
  renderPackageJson, velcroExports, writePackageJson } from '../../scripts/sync.mjs';
import { checkBaseline, checkVendor, readBaseline, readInventory, readRecords, readSharedPins }
  from '../../scripts/upstream-conformance.mjs';
import { settleAll, spawnAsync, TEST_CONCURRENCY } from '../support/spawn.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

// Every test works on the checkout read-only or on its own scratch repository, so the tests run concurrently.
describe('derived lists', { concurrency: TEST_CONCURRENCY }, () => {
  test('the committed derived files are current (the fix is `pnpm sync`)', async () => {
    assert.deepEqual(await checkDerived(root), []);
    const pkg = JSON.parse(readFileSync(path.join(root, PACKAGE_JSON), 'utf8'));
    assert.deepEqual(checkExports(pkg.exports, readCatalog(root)), []);
    assert.doesNotMatch(pkg.description, /sl-|button|badge/, 'the package description lists no component');
    const barrel = renderBarrel(root).split('\n').filter(l => l.startsWith('export'));
    assert.deepEqual(barrel, readCatalog(root).map(c => `export * from './components/${c.name}/index.js';`));
  });

  test('the export map check accepts any line order and rejects anything else that differs', async () => {
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
      // A union merge of two edits to one line keeps both: a duplicated key anywhere is reported as such, and `pnpm sync`
      // refuses to pick a side (re-rendering would silently keep the last).
      const damage = keys => [`${PACKAGE_JSON}: duplicate keys ${keys}: a union merge kept both sides of an edited line; resolve it by hand (\`pnpm sync\` cannot tell which side is right)`];
      assert.deepEqual(write([...lines.slice(0, at('./badge') + 1), lines[at('./badge')], ...lines.slice(at('./badge') + 1)].join('\n')),
        damage('"exports" > "./badge"'), 'a duplicated export');
      const version = lines.findIndex(l => l.startsWith('  "version":'));
      const twoVersions = [...lines.slice(0, version + 1), '  "version": "9.9.9",', ...lines.slice(version + 1)].join('\n');
      assert.deepEqual(write(twoVersions), damage('"version"'), 'a duplicated field outside the export map');
      assert.throws(() => writePackageJson(scratch), /duplicate keys "version"/);
      assert.equal(readFileSync(file, 'utf8'), twoVersions, '`pnpm sync` leaves the damaged file for a person to resolve');
      assert.deepEqual(duplicateKeys('{"a":{"b":1,"c":"}","b":2},"d":[{"a":1,"a":2}],"e\\"":1,"e\\"":2}'),
        ['"a" > "b"', '"d" > "[]" > "a"', '"e\\""']);
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

  test('`pnpm sync -- check` (pnpm passes the `--` through) checks, and an unknown command is a usage error', async () => {
    const run = (...args) => spawnAsync(process.execPath, [path.join(root, 'scripts/sync.mjs'), ...args],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
    for (const args of [['check'], ['--', 'check']]) {
      const r = await run(...args);
      assert.equal(r.status, 0, args.join(' '));
      assert.match(r.stdout, /derived files are current/);
    }
    assert.equal((await run('nonsense')).status, 2);
  });

  // --- Two parallel component branches -------------------------------------------------------------------------------

  // A synthetic identity for the scratch repository only, assembled at runtime (no address is committed).
  const fixtureEmail = ['velcro-test', 'example.invalid'].join('@');
  const gitEnv = { ...process.env, GIT_CONFIG_GLOBAL: devNull, GIT_CONFIG_SYSTEM: devNull, GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'velcro-test', GIT_AUTHOR_EMAIL: fixtureEmail, GIT_COMMITTER_NAME: 'velcro-test', GIT_COMMITTER_EMAIL: fixtureEmail };
  const git = async (dir, ...args) => {
    const r = await spawnAsync('git', ['-c', 'init.defaultBranch=main', '-c', 'commit.gpgsign=false', '-c', `core.hooksPath=${devNull}`, ...args],
      { cwd: dir, env: gitEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 });
    return { status: r.status, out: `${r.stdout}${r.stderr}` };
  };
  const ok = async (dir, ...args) => {
    const r = await git(dir, ...args);
    assert.equal(r.status, 0, `git ${args[0]} failed`);
    return r.out;
  };

  // The repository as it is now (tracked files plus this branch's new ones), committed into a scratch repository as `full`;
  // `main` is that tree without two real catalog components (their own files, catalog lines and export lines removed).
  // Each component branch adds one of them back the documented way, so the pair is source-valid by construction: the
  // merged tree must come out as the real tree and pass the real source gates.
  const NAMES = ['progress-bar', 'progress-ring'];
  const owned = name => f => f.split('/').some(seg => seg === name || seg.startsWith(`${name}.`));

  async function scratchRepo({ attributes = true } = {}) {
    const dir = mkdtempSync(path.join(tmpdir(), 'velcro-merge-'));
    const files = (await spawnAsync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }))
      .stdout.split('\0').filter(f => f && existsSync(path.join(root, f)));
    for (const f of files) cpSync(path.join(root, f), path.join(dir, f), { recursive: true });
    if (!attributes) rmSync(path.join(dir, '.gitattributes'));
    await ok(dir, 'init', '-q');
    // `pnpm sync` analyzes the sources, so the scratch tree uses this checkout's installed dependencies (never committed).
    for (const nm of ['node_modules', 'packages/velcro/node_modules']) symlinkSync(path.join(root, nm), path.join(dir, nm), 'dir');
    writeFileSync(path.join(dir, '.git/info/exclude'), '/node_modules\n/packages/velcro/node_modules\n');
    await ok(dir, 'add', '-A');
    await ok(dir, 'commit', '-qm', 'full');
    await ok(dir, 'tag', 'full');
    for (const name of NAMES) for (const f of files.filter(owned(name))) rmSync(path.join(dir, f));
    editCatalog(dir, lines => lines.filter(l => !NAMES.includes(JSON.parse(l).name)));
    writePackageJson(dir);
    await ok(dir, 'add', '-A');
    await ok(dir, 'commit', '-qm', 'main without the two components');
    return dir;
  }

  function editCatalog(dir, edit) {
    const catalog = path.join(dir, 'packages/docs/catalog.jsonl');
    writeFileSync(catalog, `${edit(readFileSync(catalog, 'utf8').split('\n').filter(Boolean)).join('\n')}\n`);
  }

  // Adds a component back the documented way (docs/contributing.md): its own files, one catalog line (inserted in order, as
  // the generator does), its changeset, then `pnpm sync`. Returns the paths the branch changed.
  async function addComponent(dir, name) {
    const files = (await ok(dir, 'ls-tree', '-r', '--name-only', 'full')).split('\n').filter(f => f && owned(name)(f));
    await ok(dir, 'checkout', 'full', '--', ...files);
    const line = readFileSync(path.join(root, 'packages/docs/catalog.jsonl'), 'utf8').split('\n').find(l => l && JSON.parse(l).name === name);
    editCatalog(dir, lines => [...lines, line].sort((a, b) => (JSON.parse(a).name < JSON.parse(b).name ? -1 : 1)));
    writeFileSync(path.join(dir, `.changeset/add-${name}.md`), `---\n'@charm-ux/velcro': minor\n---\n\nAdd sl-${name}.\n`);
    const sync = await spawnAsync(process.execPath, [path.join(dir, 'scripts/sync.mjs')], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
    assert.equal(sync.status, 0, `pnpm sync failed: ${sync.stderr}`);
    await ok(dir, 'add', '-A');
    await ok(dir, 'commit', '-qm', `add sl-${name}`);
    return (await ok(dir, 'diff', '--name-only', 'main', 'HEAD')).split('\n').filter(Boolean);
  }

  async function branches(dir) {
    for (const name of NAMES) {
      await ok(dir, 'checkout', '-qb', name, 'main');
      await addComponent(dir, name);
    }
  }

  test('two branches that each add a component touch only their own files, the catalog, the export map and a changeset', async () => {
    const dir = await scratchRepo();
    try {
      for (const name of NAMES) {
        await ok(dir, 'checkout', '-qb', name, 'main');
        const changed = await addComponent(dir, name);
        assert.ok(changed.filter(owned(name)).length >= 8, `${name}: its own files`);
        assert.deepEqual(changed.filter(f => !owned(name)(f) && f !== `.changeset/add-${name}.md`),
          ['packages/docs/catalog.jsonl', PACKAGE_JSON], name);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  for (const [ours, theirs] of [NAMES, [...NAMES].reverse()]) {
    test(`merging ${theirs} into ${ours} is clean and the merged tree is the real tree and passes the source gates`, async () => {
      const dir = await scratchRepo();
      try {
        await branches(dir);
        await ok(dir, 'checkout', '-q', ours);
        const merge = await git(dir, 'merge', '--no-edit', theirs);
        assert.equal(merge.status, 0, 'merge conflicted');
        assert.equal(await ok(dir, 'status', '--porcelain'), '');
        // Apart from the two changesets, the merged tree is the real one; the two union-merged files may differ in line
        // order only.
        const differ = (await ok(dir, 'diff', '--name-only', 'full', 'HEAD')).split('\n').filter(Boolean);
        const kept = differ.filter(f => !NAMES.some(n => f === `.changeset/add-${n}.md`));
        const real = await settleAll(kept.map(f => ok(dir, 'show', `full:${f}`)));
        assert.deepEqual(kept.filter((f, index) => {
          const a = real[index].split('\n').sort().join('\n');
          return a !== readFileSync(path.join(dir, f), 'utf8').split('\n').sort().join('\n');
        }), []);
        // The source gates, run on the merged tree.
        assert.deepEqual(checkCoverage(dir), []);
        assert.deepEqual(checkPackageJson(dir), []);
        const pkg = JSON.parse(readFileSync(path.join(dir, PACKAGE_JSON), 'utf8'));
        assert.deepEqual(checkExports(pkg.exports, readCatalog(dir)), []);
        assert.deepEqual(checkProvenance(dir), []);
        assert.equal(renderBarrel(dir), renderBarrel(root));
        assert.equal(assembleNotices(dir), assembleNotices(root));
        assert.deepEqual(checkVendor(dir), []);
        assert.deepEqual(checkBaseline(readRecords(dir), readSharedPins(dir), readBaseline(root)), []);
        for (const name of NAMES) assert.ok(readInventory(dir)[name].length > 0, name);
        // The manifest, the API parity reports and the parity ledger, analyzed from the merged sources.
        const manifest = analyzeVelcro(dir);
        assert.deepEqual(manifest, analyzeVelcro(root));
        const tags = [...customElements(manifest).keys()];
        for (const { tag } of readCatalog(dir)) assert.ok(tags.includes(tag), tag);
        const parity = currentParity(dir, manifest);
        assert.deepEqual(checkReports(dir, parity), []);
        assert.deepEqual(parity.gaps.filter(g => !readLedger(dir).includes(g)), []);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }

  test('negative control: without the union merge attributes the same two branches conflict', async () => {
    const dir = await scratchRepo({ attributes: false });
    try {
      await branches(dir);
      await ok(dir, 'checkout', '-q', NAMES[0]);
      const merge = await git(dir, 'merge', '--no-edit', NAMES[1]);
      assert.notEqual(merge.status, 0);
      const conflicted = (await ok(dir, 'diff', '--name-only', '--diff-filter=U')).split('\n').filter(Boolean).sort();
      assert.deepEqual(conflicted, ['packages/docs/catalog.jsonl', PACKAGE_JSON]);
      await git(dir, 'merge', '--abort');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
