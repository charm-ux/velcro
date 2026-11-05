import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const pkgDir = path.join(root, 'packages/velcro');
const requireFromRoot = createRequire(path.join(root, 'package.json'));
const plopBin = path.join(path.dirname(requireFromRoot.resolve('plop/package.json')), 'bin/plop.js');

// Runs the real generator against a copy of the plopfile, templates, barrel and catalog in ignored scratch, laid out like the
// repository (<repo>/packages/velcro, <repo>/packages/docs, <repo>/tests/product). Returns the package directory.
function scratch() {
  mkdirSync(path.join(root, '.airig'), { recursive: true });
  const repo = mkdtempSync(path.join(root, '.airig/generator-'));
  const dir = path.join(repo, 'packages/velcro');
  mkdirSync(dir, { recursive: true });
  mkdirSync(path.join(repo, 'packages/docs'), { recursive: true });
  writeFileSync(path.join(repo, 'packages/docs/catalog.jsonl'),
    '{"name":"button","title":"Button","tag":"sl-button","example":"#demo-primary"}\n{"name":"spinner","title":"Spinner","tag":"sl-spinner","example":"sl-spinner"}\n');
  cpSync(path.join(pkgDir, 'plopfile.mjs'), path.join(dir, 'plopfile.mjs'));
  cpSync(path.join(pkgDir, 'plop-templates'), path.join(dir, 'plop-templates'), { recursive: true });
  mkdirSync(path.join(dir, 'src/utilities'), { recursive: true });
  cpSync(path.join(pkgDir, 'src/utilities/registration.ts'), path.join(dir, 'src/utilities/registration.ts'));
  writeFileSync(path.join(dir, 'src/index.ts'), "export * from './components/button/index.js';\n");
  return dir;
}

function generate(dir, name) {
  const r = spawnSync(process.execPath, [plopBin, '--plopfile', path.join(dir, 'plopfile.mjs'), '--dest', dir,
    'Velcro component', '--', '--name', name], { cwd: dir, encoding: 'utf8', timeout: 120000 });
  assert.equal(r.status, 0, 'generator failed');
  return `${r.stdout}${r.stderr}`;
}

const read = (dir, rel) => readFileSync(path.join(dir, rel), 'utf8');
const walk = d => readdirSync(d, { withFileTypes: true, recursive: true }).filter(e => e.isFile())
  .map(e => path.join(e.parentPath, e.name));

test('generator output uses the native helper and class-only alias shape, never the global prefix', () => {
  const dir = scratch();
  generate(dir, 'divider');
  const base = 'src/components/divider';
  assert.deepEqual(readdirSync(path.join(dir, base)).sort(), ['class.ts', 'divider.styles.ts', 'divider.ts', 'index.ts']);

  const cls = read(dir, `${base}/class.ts`);
  assert.match(cls, /^export \* from '\.\/divider\.js';$/m);
  assert.match(cls, /^export \{ VelcroDivider as SlDivider \} from '\.\/divider\.js';$/m);
  assert.doesNotMatch(cls.replace(/^\/\/.*$/gm, ''), /defineVelcroComponent|customElements|registration/);

  const index = read(dir, `${base}/index.ts`);
  const code = index.replace(/^\/\/.*$/gm, '');
  assert.match(code, /^import \{ defineVelcroComponent \} from '\.\.\/\.\.\/utilities\/registration\.js';$/m);
  assert.match(code, /^import \{ VelcroDivider \} from '\.\/class\.js';$/m);
  assert.match(code, /^export \* from '\.\/class\.js';$/m);
  assert.match(code, /^defineVelcroComponent\(VelcroDivider\);$/m);

  for (const file of walk(path.join(dir, 'src/components/divider'))) {
    const code = readFileSync(file, 'utf8').replace(/^\s*(\/\/|\*|\/\*\*).*$/gm, '');
    assert.doesNotMatch(code, /updateProject|registerComponent|utilities\/project|prefix\s*:/, path.basename(file));
  }
});

test('generated scaffold type-checks against core and the helper', () => {
  const dir = scratch();
  generate(dir, 'divider');
  mkdirSync(path.join(dir, 'node_modules/@charm-ux'), { recursive: true });
  symlinkSync(path.join(pkgDir, 'node_modules/@charm-ux/core'), path.join(dir, 'node_modules/@charm-ux/core'), 'dir');
  symlinkSync(path.join(pkgDir, 'node_modules/lit'), path.join(dir, 'node_modules/lit'), 'dir');
  writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}\n');
  const tsc = requireFromRoot.resolve('typescript/bin/tsc');
  const r = spawnSync(process.execPath, [tsc, '--noEmit', '--strict', '--module', 'nodenext', '--moduleResolution', 'nodenext',
    '--target', 'es2022', '--lib', 'es2022,dom', '--skipLibCheck', '--experimentalDecorators', '--useDefineForClassFields', 'false',
    'src/components/divider/index.ts'], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, 'scaffold did not type-check');
});

test('repeat generation adds the barrel export once and never overwrites existing files', () => {
  const dir = scratch();
  generate(dir, 'divider');
  const files = ['divider.ts', 'divider.styles.ts', 'index.ts', 'class.ts'].map(f => `src/components/divider/${f}`);
  for (const f of files) writeFileSync(path.join(dir, f), `// hand edited ${f}\n`);
  generate(dir, 'divider');
  for (const f of files) assert.equal(read(dir, f), `// hand edited ${f}\n`);
  const lines = read(dir, 'src/index.ts').split('\n').filter(Boolean);
  assert.deepEqual(lines, [
    "export * from './components/button/index.js';",
    "export * from './components/divider/index.js';",
  ]);
  assert.ok(existsSync(path.join(dir, 'src/components/divider/class.ts')));
});

test('generator also scaffolds the docs page, an example, a failing spec skeleton and a sorted catalog entry', () => {
  const dir = scratch();
  const repo = path.join(dir, '../..');
  generate(dir, 'divider');
  const lines = read(repo, 'packages/docs/catalog.jsonl').split('\n').filter(Boolean).map(l => JSON.parse(l));
  assert.deepEqual(lines.map(l => l.name), ['button', 'divider', 'spinner']);
  assert.deepEqual(lines[1], { name: 'divider', title: 'Divider', tag: 'sl-divider', example: '#demo-default' });

  const page = read(repo, 'packages/docs/pages/components/divider.ts');
  assert.match(page, /@customElement\('page-components-divider'\)/);
  assert.match(page, /examples\['divider\/basic'\]/);
  assert.match(read(repo, 'packages/docs/examples/divider/basic.html'), /<sl-divider id="demo-default"><\/sl-divider>/);

  // The skeleton must not pass: no fixme/skip, no assertion that can succeed, and it throws.
  const spec = read(repo, 'tests/product/divider.spec.mjs');
  assert.match(spec, /throw new Error\(/);
  assert.doesNotMatch(spec, /\.(skip|fixme)|expect\(/);
});

test('repeat generation leaves the catalog, page, example and spec untouched', () => {
  const dir = scratch();
  const repo = path.join(dir, '../..');
  generate(dir, 'divider');
  const files = ['packages/docs/pages/components/divider.ts', 'packages/docs/examples/divider/basic.html', 'tests/product/divider.spec.mjs'];
  for (const f of files) writeFileSync(path.join(repo, f), `// hand edited ${f}\n`);
  const catalog = read(repo, 'packages/docs/catalog.jsonl');
  generate(dir, 'divider');
  for (const f of files) assert.equal(read(repo, f), `// hand edited ${f}\n`);
  assert.equal(read(repo, 'packages/docs/catalog.jsonl'), catalog);
});
