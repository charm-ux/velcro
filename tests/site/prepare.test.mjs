import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { LIMITS, PrepareError, aggregateHash, prepareSite } from '../../scripts/site/prepare.mjs';
import { writeTestedEvidence } from '../../scripts/site/tested.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const tmp = mkdtempSync(path.join(tmpdir(), 'velcro-site-'));
after(() => rmSync(tmp, { recursive: true, force: true }));
const sha = b => createHash('sha256').update(b).digest('hex');
const MIT = 'MIT License\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY\n';
const readLicense = (_r, name) => (name === 'a-pkg' ? MIT : null);
let counter = 0;
const HEAD = execFileSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

// Build a synthetic but structurally complete site plus its closure record.
function fixture(mutate = () => {}) {
  const dir = path.join(tmp, `case-${counter++}`);
  const src = path.join(dir, 'static');
  const files = {
    'index.html': '<!doctype html><a href="/velcro/components/button">button</a>\n',
    'components/badge/index.html': '<p>badge</p>\n',
    'components/button/index.html': '<p>button</p>\n',
    'components/divider/index.html': '<p>divider</p>\n',
    'components/spinner/index.html': '<p>spinner</p>\n',
    '_litro/app.js': 'export const a = 1;\n',
    '_litro/velcro.js': 'export const v = 1;\n',
    '_litro/velcro.css': 'body{margin:0}\n',
    '_litro/assets/chunk-abc123.js': 'export const c = 1;\n',
    'THIRD_PARTY_NOTICES.md': '# source notices\n',
    '_litro/THIRD_PARTY_NOTICES.md': '# source notices\n',
    'nitro.json': '{"date":"x"}\n',
  };
  const ctx = { dir, src, files, closure: null };
  mutate.before?.(ctx);
  for (const [rel, text] of Object.entries(ctx.files)) {
    mkdirSync(path.dirname(path.join(src, rel)), { recursive: true });
    writeFileSync(path.join(src, rel), text);
  }
  ctx.closure ??= {
    schema: 1,
    files: Object.entries(ctx.files).filter(([r]) => r.startsWith('_litro/') && /\.(js|css)$/.test(r))
      .map(([r, t]) => ({ file: r.slice(7), sha256: sha(Buffer.from(t)), bytes: Buffer.byteLength(t) })),
    modules: [{ chunk: 'app.js', id: 'a-pkg/index.js', kind: 'package', package: 'a-pkg', rendered: 3 }],
    packages: [{ name: 'a-pkg', version: '1.0.0', license: 'MIT' }],
  };
  mutate.after?.(ctx);
  const closurePath = path.join(dir, 'closure.json');
  writeFileSync(closurePath, JSON.stringify(ctx.closure));
  // Evidence as verify:product would leave it: the exact bytes the browser checks ran against.
  const evidenceRoot = path.join(dir, 'evidence-root');
  const evidencePath = path.join(evidenceRoot, '.airig/product/tested-prefixed.json');
  writeTestedEvidence(evidenceRoot, { files: Object.entries(ctx.files).map(([rel, t]) => ({ rel, sha256: sha(Buffer.from(t)), size: Buffer.byteLength(t) })).sort((a, b) => (a.rel < b.rel ? -1 : 1)), closureSha256: sha(readFileSync(closurePath)) }, HEAD);
  return { ...ctx, closurePath, evidencePath, runDir: path.join(dir, 'run') };
}
const run = (f, extra = {}) => prepareSite({ repoRoot, sourceDir: f.src, closurePath: f.closurePath, runDir: f.runDir, base: '/velcro', testedEvidencePath: f.evidencePath, requireClean: false, scanners: { readLicense }, ...extra });
const blocked = async (f, code, extra) => {
  await assert.rejects(run(f, extra), e => { assert.ok(e instanceof PrepareError || e.code, String(e)); assert.equal(e.code, code); return true; });
  assert.ok(!existsSync(f.runDir) && !existsSync(`${f.runDir}.partial`), 'no partial output may remain');
};
const leaf = (fn) => ({ before: c => fn(c) });

test('a complete site stages with exactly the allowlisted files, notices, 404, .nojekyll and recorded hashes', async () => {
  const f = fixture();
  const m = await run(f);
  const staged = readdirSync(path.join(f.runDir, 'site'), { recursive: true, withFileTypes: true }).filter(e => e.isFile())
    .map(e => path.relative(path.join(f.runDir, 'site'), path.join(e.parentPath, e.name)).split(path.sep).join('/')).sort();
  assert.deepEqual(staged, ['.nojekyll', '404.html', 'THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_RUNTIME_NOTICES.md', '_litro/app.js',
    '_litro/assets/chunk-abc123.js', '_litro/velcro.css', '_litro/velcro.js', 'components/badge/index.html', 'components/button/index.html', 'components/divider/index.html', 'components/spinner/index.html', 'index.html']);
  assert.equal(readFileSync(path.join(f.runDir, 'site/.nojekyll')).length, 0);
  assert.match(readFileSync(path.join(f.runDir, 'site/404.html'), 'utf8'), /href="\/velcro\/"/);
  assert.deepEqual(m.omitted, ['_litro/THIRD_PARTY_NOTICES.md', 'nitro.json']);
  assert.equal(m.aggregateSha256, aggregateHash(m.files));
  for (const e of m.files) assert.equal(e.sha256, sha(readFileSync(path.join(f.runDir, 'site', e.rel))));
  assert.equal(m.checks.secretFindings, 0);
  assert.equal(m.checks.secretExcluded, 0);
  assert.match(m.sourceSha, /^[0-9a-f]{40}$/);
  assert.equal(JSON.parse(readFileSync(path.join(f.runDir, 'manifest.json'), 'utf8')).status, 'passed');
});

test('an existing run directory is never reused', async () => {
  const f = fixture();
  mkdirSync(f.runDir);
  await assert.rejects(run(f), e => e.code === 'run-dir-exists');
});

test('symlinks, special files, maps and unexpected formats are rejected, not skipped', async () => {
  await blocked(fixture({ after: c => symlinkSync('index.html', path.join(c.src, 'link.html')) }), 'symlink');
  await blocked(fixture({ after: c => symlinkSync('components', path.join(c.src, 'dirlink')) }), 'symlink');
  const fifo = fixture();
  spawnSync('mkfifo', [path.join(fifo.src, 'pipe.html')]);
  await blocked(fifo, 'special-file');
  for (const name of ['_litro/app.js.map', 'assets.map']) {
    await blocked(fixture(leaf(c => { c.files[name] = '{}\n'; })), 'source-map');
  }
  await blocked(fixture(leaf(c => { c.files['_litro/app.js'] += '//# sourceMappingURL=app.js.map\n'; })), 'source-map-reference');
  for (const name of ['logo.png', 'bundle.zip', 'font.woff2', 'a.tgz', 'x.svg', 'data.json', 'readme.txt', '_litro/x.mjs', 'sub/page.html']) {
    await blocked(fixture(leaf(c => { c.files[name] = 'text\n'; })), 'unexpected-file');
  }
  await blocked(fixture(leaf(c => { c.files['.env'] = 'x\n'; })), 'unsafe-name');
  await blocked(fixture(leaf(c => { c.files['sp ace.html'] = 'x\n'; })), 'unsafe-name');
});

test('binary or control-character content in an allowed name is rejected', async () => {
  const f = fixture();
  writeFileSync(path.join(f.src, 'index.html'), Buffer.from([0x3c, 0x00, 0x3e]));
  await blocked(f, 'control-characters');
  const g = fixture();
  writeFileSync(path.join(g.src, 'index.html'), Buffer.from([0xff, 0xfe, 0xfa]));
  await blocked(g, 'not-utf8');
});

test('bounds: entry count, file size and total size', async () => {
  await blocked(fixture(leaf(c => { for (let i = 0; i <= LIMITS.maxEntries; i++) c.files[`d${i}/index.html`] = 'x\n'; })), 'too-many-entries');
  await blocked(fixture(leaf(c => { c.files['big/index.html'] = 'a'.repeat(LIMITS.maxFileBytes + 1); })), 'file-too-large');
  await blocked(fixture(leaf(c => { for (let i = 0; i < 9; i++) c.files[`p${i}/index.html`] = 'a'.repeat(LIMITS.maxFileBytes - 10); })), 'too-large');
  await blocked(fixture(leaf(c => { c.files['a/b/c/d/e/f/g/h/index.html'] = 'x\n'; })), 'too-deep');
});

test('required routes and assets, closure agreement and notice duplicates are enforced', async () => {
  await blocked(fixture(leaf(c => { delete c.files['components/spinner/index.html']; })), 'required-missing');
  await blocked(fixture(leaf(c => { delete c.files['components/badge/index.html']; })), 'required-missing');
  await blocked(fixture(leaf(c => { delete c.files['components/divider/index.html']; })), 'required-missing');
  await blocked(fixture(leaf(c => { delete c.files['_litro/velcro.css']; })), 'required-missing');
  await blocked(fixture({ after: c => { c.files['_litro/app.js'] = 'tampered\n'; writeFileSync(path.join(c.src, '_litro/app.js'), 'tampered\n'); } }), 'closure-mismatch');
  await blocked(fixture({ after: c => { c.closure.files.push({ file: 'gone.js', sha256: sha(Buffer.from('x')), bytes: 1 }); } }), 'closure-file-missing');
  await blocked(fixture(leaf(c => { c.files['_litro/THIRD_PARTY_NOTICES.md'] = '# different\n'; })), 'notice-duplicate-differs');
});

test('notice failure blocks staging', async () => {
  await blocked(fixture({ after: c => { c.closure.packages[0].license = 'GPL-3.0'; } }), 'unrecognized-license:a-pkg@1.0.0');
  const f = fixture();
  await blocked(f, 'missing-license:a-pkg@1.0.0', { scanners: { readLicense: () => null } });
});

test('privacy findings in content or names block staging (sensitive values generated at runtime)', async () => {
  const homePath = ['', 'Users', 'someone', 'project'].join('/');
  await blocked(fixture(leaf(c => { c.files['index.html'] += `<p>${homePath}</p>\n`; })), 'privacy-findings');
  const mail = `${'person'}@${'example'}.${'org'}`;
  await blocked(fixture(leaf(c => { c.files['components/button/index.html'] = `<p>${mail}</p>\n`; })), 'privacy-findings');
  const m = fixture();
  await blocked(m, 'privacy-scan-incomplete', { scanners: { readLicense, privacy: () => { throw new Error('boom'); } } });
});

test('real pinned secret scanner blocks a planted credential and the control passes (generated at runtime)', async () => {
  const token = `ghp_${'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'}`;
  const bad = fixture(leaf(c => { c.files['index.html'] += `<script>const t = "${token}";</script>\n`; }));
  await assert.rejects(run(bad), e => ['secret-findings', 'privacy-findings'].includes(e.code));
  assert.ok(!existsSync(bad.runDir) && !existsSync(`${bad.runDir}.partial`));
  // Isolate the secret engine: privacy stubbed clean, the real engine must still find it.
  const only = fixture(leaf(c => { c.files['index.html'] += `<script>const t = "${token}";</script>\n`; }));
  await blocked(only, 'secret-findings', { scanners: { readLicense, privacy: () => [] } });
  const clean = fixture();
  assert.equal((await run(clean)).checks.secretFindings, 0);
});

test('secret engine failures, exclusions and incomplete results all block', async () => {
  const f = () => fixture();
  await blocked(f(), 'secret-scan-unavailable', { scanners: { readLicense, secrets: async () => { throw new Error('missing'); } } });
  await blocked(f(), 'secret-scan-incomplete', { scanners: { readLicense, secrets: async () => ({ findings: [], version: '8.30.1', excluded: 1 }) } });
  await blocked(f(), 'secret-scan-incomplete', { scanners: { readLicense, secrets: async () => ({ findings: [] }) } });
  await blocked(f(), 'secret-findings', { scanners: { readLicense, secrets: async () => ({ findings: [{}], version: '8.30.1', excluded: 0 }) } });
});

test('a scanner that mutates the staged tree is detected (scan binds to the exact bytes)', async () => {
  const f = fixture();
  await blocked(f, 'staged-bytes-changed', { scanners: { readLicense, secrets: async ({ target }) => {
    writeFileSync(path.join(target, 'index.html'), 'changed after scan start\n');
    return { findings: [], version: '8.30.1', excluded: 0 };
  } } });
});

test('source SHA binding: mismatch and a dirty tree block', async () => {
  const f = fixture();
  await blocked(f, 'source-sha-mismatch', { expectSha: '0'.repeat(40) });
  const head = execFileSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  assert.equal((await run(fixture(), { expectSha: head })).sourceSha, head);
  // A temporary repository with an uncommitted tracked change.
  const repo = path.join(tmp, 'repo');
  mkdirSync(path.join(repo, 'security'), { recursive: true });
  writeFileSync(path.join(repo, 'security/policy.json'), readFileSync(path.join(repoRoot, 'security/policy.json')));
  const g = (...a) => execFileSync('git', ['-C', repo, '-c', 'user.name=t', '-c', `user.email=${['t', 'users.noreply.github.com'].join('@')}`, ...a], { encoding: 'utf8' });
  g('init', '-q'); g('add', 'security/policy.json'); g('commit', '-qm', 'x');
  writeFileSync(path.join(repo, 'security/policy.json'), `${readFileSync(path.join(repo, 'security/policy.json'), 'utf8')} `);
  const d = fixture();
  await assert.rejects(prepareSite({ repoRoot: repo, sourceDir: d.src, closurePath: d.closurePath, runDir: d.runDir, base: '/velcro', testedEvidencePath: d.evidencePath, scanners: { readLicense } }), e => e.code === 'source-tree-dirty');
  await blocked(fixture(), 'base-invalid', { base: '/velcro/' });
});

test('the CLI reports codes only and refuses output outside ignored private scratch', () => {
  const r = spawnSync(process.execPath, ['scripts/site/prepare.mjs', '--out', path.join(tmp, 'outside')], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /^site-prepare: blocked \([a-z-]+\)\n$/);
  assert.doesNotMatch(`${r.stdout}${r.stderr}`, new RegExp(['Users', 'home', 'node_modules'].join('|')));
});

// --- Binding to the browser-tested bytes ------------------------------------------------------------------------------
const resign = c => { // rewrite the closure record so it agrees with the (tampered) files: only the tested-bytes binding can catch it
  c.closure.files = Object.entries(readdirSync(path.join(c.src, '_litro'), { recursive: true, withFileTypes: true }))
    .map(([, e]) => e).filter(e => e.isFile() && /\.(js|css)$/.test(e.name))
    .map(e => { const full = path.join(e.parentPath, e.name); return { file: path.relative(path.join(c.src, '_litro'), full).split(path.sep).join('/'), sha256: sha(readFileSync(full)), bytes: readFileSync(full).length }; });
  writeFileSync(c.closurePath, JSON.stringify(c.closure));
};

test('preparation requires successful tested evidence: missing, malformed, failed, stale or wrong-base evidence blocks', async () => {
  const missing = fixture(); rmSync(missing.evidencePath);
  await blocked(missing, 'tested-evidence-missing');
  const bad = fixture(); writeFileSync(bad.evidencePath, '{ not json');
  await blocked(bad, 'tested-evidence-missing');
  const failed = fixture(); writeFileSync(failed.evidencePath, JSON.stringify({ ...JSON.parse(readFileSync(failed.evidencePath, 'utf8')), status: 'failed' }));
  await blocked(failed, 'tested-evidence-invalid');
  const stale = fixture(); writeFileSync(stale.evidencePath, JSON.stringify({ ...JSON.parse(readFileSync(stale.evidencePath, 'utf8')), sourceSha: '1'.repeat(40) }));
  await blocked(stale, 'tested-evidence-stale');
  const nosha = fixture(); writeFileSync(nosha.evidencePath, JSON.stringify({ ...JSON.parse(readFileSync(nosha.evidencePath, 'utf8')), sourceSha: null }));
  await blocked(nosha, 'tested-evidence-invalid');
  await blocked(fixture(), 'tested-evidence-missing', { testedEvidencePath: undefined });
  await blocked(fixture(), 'tested-evidence-base', { base: '/other' });
});

test('an asset changed after verification (closure record kept consistent) blocks', async () => {
  const f = fixture();
  writeFileSync(path.join(f.src, '_litro/assets/chunk-abc123.js'), 'export const c = 2; // changed after the browser checks\n');
  resign(f);
  await blocked(f, 'tested-bytes-mismatch');
});

test('an HTML file changed after verification blocks', async () => {
  const f = fixture();
  writeFileSync(path.join(f.src, 'components/button/index.html'), '<p>changed after the browser checks</p>\n');
  await blocked(f, 'tested-bytes-mismatch');
  const g = fixture();
  writeFileSync(path.join(g.src, 'index.html'), `${readFileSync(path.join(g.src, 'index.html'), 'utf8')}<!-- late -->\n`);
  await blocked(g, 'tested-bytes-mismatch');
});

test('a changed closure record, or a file added or removed after verification, blocks', async () => {
  const f = fixture();
  const c = JSON.parse(readFileSync(f.closurePath, 'utf8'));
  c.modules.push({ chunk: 'app.js', id: 'repo:packages/docs/extra.ts', kind: 'first-party', rendered: 1 });
  writeFileSync(f.closurePath, JSON.stringify(c));
  await blocked(f, 'tested-bytes-mismatch');
  const added = fixture(); writeFileSync(path.join(added.src, 'components/button/extra.html'), 'x\n');
  await assert.rejects(run(added), e => ['tested-bytes-mismatch', 'unexpected-file'].includes(e.code));
  const gone = fixture(); rmSync(path.join(gone.src, 'nitro.json'));
  await blocked(gone, 'tested-bytes-mismatch');
});

test('a closure record replaced while the scanners run is detected, and the manifest cannot claim another closure', async () => {
  const f = fixture();
  await blocked(f, 'closure-changed', { scanners: { readLicense, secrets: async () => {
    writeFileSync(f.closurePath, JSON.stringify({ ...JSON.parse(readFileSync(f.closurePath, 'utf8')), packages: [{ name: 'a-pkg', version: '1.0.0', license: 'MIT' }, { name: 'other', version: '1.0.0', license: 'MIT' }] }));
    return { findings: [], version: '8.30.1', excluded: 0 };
  } } });
  const ok = fixture();
  const m = await run(ok);
  assert.equal(m.closureSha256, sha(readFileSync(ok.closurePath)), 'manifest hash is of the evaluated closure bytes');
});

test('an oversized closure record is rejected by the bound', async () => {
  const f = fixture();
  writeFileSync(f.closurePath, Buffer.alloc(4 * 1024 * 1024 + 1, 0x20));
  await blocked(f, 'file-too-large');
});

// --- compiler-emitted helper copies in the shipped bytes -----------------------------------------------------------------
test('an unattributed decorate helper copy in the shipped JavaScript blocks (closure and tested evidence consistent)', async () => {
  await blocked(fixture(leaf(c => { c.files['_litro/assets/chunk-abc123.js'] += 'function d(){return typeof Reflect.decorate=="function"&&Reflect.decorate(1)}\n'; })), 'unattributed-compiler-helper');
  await blocked(fixture(leaf(c => { c.files['_litro/app.js'] += 'const k = Reflect.decorate;\n'; })), 'unattributed-compiler-helper');
});

test('recorded, attributed copies pass only when the shipped mention count matches exactly', async () => {
  const copy = 'var d=function(e){return typeof Reflect.decorate==`function`?Reflect.decorate(e):e};\n';
  const withCarrier = { after: c => {
    c.closure.modules.push({ chunk: 'app.js', id: 'repo:packages/velcro/dist/b.js', kind: 'first-party', rendered: 1, compilerHelper: 'typescript-decorate' });
  }, before: c => { c.files['_litro/app.js'] += copy; } };
  const ok = await run(fixture(withCarrier));
  assert.ok(ok.runtimePackages.some(p => p.kind === 'compiler-helper'));
  await blocked(fixture({ ...withCarrier, before: c => { c.files['_litro/app.js'] += copy + copy; } }), 'unattributed-compiler-helper');
  await blocked(fixture({ after: withCarrier.after }), 'unattributed-compiler-helper'); // recorded carrier, but no copy shipped
});

test('evidence from a dirty source is not accepted', async () => {
  const f = fixture();
  writeFileSync(f.evidencePath, JSON.stringify({ ...JSON.parse(readFileSync(f.evidencePath, 'utf8')), cleanSource: false }));
  await blocked(f, 'tested-evidence-invalid');
});
