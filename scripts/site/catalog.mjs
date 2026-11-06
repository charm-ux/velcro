// The component catalog: packages/docs/catalog.jsonl, one JSON object per line, sorted by name. It is the single list that
// drives the docs navigation, the home page, the required site pages and the browser routes. Read strictly: any unexpected
// shape, name, duplicate, ordering or size fails closed with a short code (never the offending content).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CATALOG_LIMITS = Object.freeze({ maxEntries: 64, maxBytes: 64 * 1024 });
export const CATALOG_PATH = 'packages/docs/catalog.jsonl';
const NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const TAG = /^sl-[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const TITLE = /^[A-Za-z0-9][A-Za-z0-9 .-]{0,59}$/;
// Title Case, as in Shoelace's docs: every space-separated word starts with a capital letter or a digit.
const TITLE_CASE = /^[A-Z0-9][^ ]*(?: [A-Z0-9][^ ]*)*$/;
const SELECTOR = /^[#.]?[A-Za-z][A-Za-z0-9_-]{0,79}$/;
const KEYS = ['example', 'name', 'tag', 'title'];

export class CatalogError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
const fail = code => { throw new CatalogError(code); };

export const defaultRoot = fileURLToPath(new URL('../../', import.meta.url));

/** Parses catalog text. Returns frozen entries [{ name, title, tag, example }] in file order. */
export function parseCatalog(text) {
  if (typeof text !== 'string' || text.length === 0) fail('catalog-empty');
  if (Buffer.byteLength(text) > CATALOG_LIMITS.maxBytes) fail('catalog-too-large');
  if (!text.endsWith('\n') || text.includes('\r')) fail('catalog-format');
  const lines = text.slice(0, -1).split('\n');
  if (lines.length > CATALOG_LIMITS.maxEntries) fail('catalog-too-many');
  const entries = [];
  const seen = new Set();
  for (const line of lines) {
    let value;
    try { value = JSON.parse(line); } catch { return fail('catalog-json'); }
    if (value === null || typeof value !== 'object' || Array.isArray(value)) fail('catalog-shape');
    const keys = Object.keys(value).sort();
    if (keys.length !== KEYS.length || keys.some((k, i) => k !== KEYS[i])) fail('catalog-shape');
    const { name, title, tag, example } = value;
    if (![name, title, tag, example].every(v => typeof v === 'string')) fail('catalog-shape');
    if (name.length > 40 || !NAME.test(name)) fail('catalog-name');
    if (!TITLE.test(title) || !TITLE_CASE.test(title)) fail('catalog-title');
    if (!TAG.test(tag) || tag !== `sl-${name}`) fail('catalog-tag');
    if (!SELECTOR.test(example)) fail('catalog-example');
    if (seen.has(name)) fail('catalog-duplicate');
    if (entries.length > 0 && !(entries[entries.length - 1].name < name)) fail('catalog-unsorted');
    seen.add(name);
    entries.push(Object.freeze({ name, title, tag, example }));
  }
  return Object.freeze(entries);
}

export function readCatalog(root = defaultRoot) {
  const file = path.join(root, CATALOG_PATH);
  let text;
  try {
    const st = statSync(file);
    if (!st.isFile() || st.size > CATALOG_LIMITS.maxBytes) fail('catalog-unreadable');
    text = readFileSync(file, 'utf8');
  } catch (e) {
    if (e instanceof CatalogError) throw e;
    return fail('catalog-unreadable');
  }
  return parseCatalog(text);
}

/** Site pages every build must contain for this catalog. */
export const componentPages = catalog => catalog.map(c => `components/${c.name}/index.html`);

const listDirs = dir => {
  try { return readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort(); } catch { return []; }
};
const listFiles = dir => {
  try { return readdirSync(dir, { withFileTypes: true }).filter(e => e.isFile()).map(e => e.name).sort(); } catch { return []; }
};

const target = file => ({ types: `./dist/${file}.d.ts`, import: `./dist/${file}.js` });

/**
 * Helper modules that Shoelace publishes inside a component's directory (dist/components/<name>/<util>.js) and that
 * Velcro exports at the matching entry point ./<name>/<util>. Each is required once its component is in the catalog;
 * no other ./<name>/<something> subpath is allowed.
 */
export const UTILITY_EXPORTS = Object.freeze({ include: Object.freeze(['request']) });

/**
 * Export contract of packages/velcro: the fixed entries, ./<name> with exact targets for every catalog entry,
 * ./<name>/class (exact targets) only for a catalog component, and the utility modules of UTILITY_EXPORTS (exact
 * targets, required) for their catalog component. Any other key or target is a problem.
 */
export function checkExports(exportsMap, catalog) {
  const problems = [];
  if (exportsMap === null || typeof exportsMap !== 'object' || Array.isArray(exportsMap)) return ['package.json: exports missing'];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const fixed = { '.': target('index'), './themes/dark.css': './themes/dark.css', './themes/light.css': './themes/light.css',
    './custom-elements.json': './custom-elements.json', './react': { types: './dist/react/index.d.ts', import: './dist/react/index.js' },
    './react/*': './dist/react/*', './package.json': './package.json' };
  const names = new Set(catalog.map(c => c.name));
  for (const [key, value] of Object.entries(fixed)) if (!same(exportsMap[key], value)) problems.push(`package.json: export ${key} is missing or has wrong targets`);
  for (const name of names) {
    if (!Object.hasOwn(exportsMap, `./${name}`)) problems.push(`${name}: missing package export`);
    else if (!same(exportsMap[`./${name}`], target(`components/${name}/index`))) problems.push(`${name}: wrong package export targets`);
    const cls = `./${name}/class`;
    if (Object.hasOwn(exportsMap, cls) && !same(exportsMap[cls], target(`components/${name}/class`))) problems.push(`${name}: wrong class export targets`);
    for (const util of UTILITY_EXPORTS[name] ?? []) {
      const key = `./${name}/${util}`;
      if (!Object.hasOwn(exportsMap, key)) problems.push(`${name}: missing ${util} utility export`);
      else if (!same(exportsMap[key], target(`components/${name}/${util}`))) problems.push(`${name}: wrong ${util} utility export targets`);
    }
  }
  for (const key of Object.keys(exportsMap)) {
    const m = /^\.\/([a-z0-9-]+)(?:\/(class|[a-z0-9-]+))?$/.exec(key);
    const allowed = m && names.has(m[1]) && (m[2] === undefined || m[2] === 'class' || (UTILITY_EXPORTS[m[1]] ?? []).includes(m[2]));
    if (Object.hasOwn(fixed, key) || allowed) continue;
    problems.push(`package.json: unexpected export ${key}`);
  }
  return problems;
}

/**
 * Coverage gate: returns a list of problems (empty means complete). Every component directory needs a catalog entry and
 * every entry needs its component directory, docs page, example using its tag, product spec, package export and barrel line.
 */
export function checkCoverage(root = defaultRoot) {
  const problems = [];
  let catalog;
  try { catalog = readCatalog(root); } catch (e) { return [`catalog: ${e.code ?? 'unreadable'}`]; }
  const dirs = listDirs(path.join(root, 'packages/velcro/src/components'));
  const names = new Set(catalog.map(c => c.name));
  for (const d of dirs) if (!names.has(d)) problems.push(`${d}: component has no catalog entry`);
  let exportsMap = {};
  try { exportsMap = JSON.parse(readFileSync(path.join(root, 'packages/velcro/package.json'), 'utf8')).exports ?? {}; } catch { problems.push('package.json: unreadable'); }
  problems.push(...checkExports(exportsMap, catalog));
  for (const f of listFiles(path.join(root, 'packages/docs/pages/components'))) {
    if (f.endsWith('.ts') && !names.has(f.slice(0, -3))) problems.push(`${f.slice(0, -3)}: docs page has no catalog entry`);
  }
  let barrel = [];
  try { barrel = readFileSync(path.join(root, 'packages/velcro/src/index.ts'), 'utf8').split('\n'); } catch { problems.push('src/index.ts: unreadable'); }
  for (const { name, tag, example } of catalog) {
    if (!dirs.includes(name)) problems.push(`${name}: catalog entry has no component directory`);
    if (!existsSync(path.join(root, `packages/docs/pages/components/${name}.ts`))) problems.push(`${name}: missing docs page`);
    const exDir = path.join(root, `packages/docs/examples/${name}`);
    const uses = listFiles(exDir).filter(f => f.endsWith('.html')).some(f => {
      try { return new RegExp(`<${tag}[\\s>/]`).test(readFileSync(path.join(exDir, f), 'utf8')); } catch { return false; }
    });
    if (!uses) problems.push(`${name}: no docs example uses <${tag}>`);
    const sources = listFiles(exDir).filter(f => f.endsWith('.html')).map(f => { try { return readFileSync(path.join(exDir, f), 'utf8'); } catch { return ''; } });
    let matcher = null;
    if (example.startsWith('#')) matcher = new RegExp(`\\sid=(?:"${example.slice(1)}"|'${example.slice(1)}')`);
    else if (/^[A-Za-z][A-Za-z0-9-]*$/.test(example)) matcher = new RegExp(`<${example}[\\s>/]`);
    if (!matcher) problems.push(`${name}: example selector ${example} is unsupported`);
    else if (!sources.some(t => matcher.test(t))) problems.push(`${name}: example selector ${example} matches nothing in its examples`);
    if (!existsSync(path.join(root, `tests/product/${name}.spec.mjs`))) problems.push(`${name}: missing product spec`);
    if (!barrel.includes(`export * from './components/${name}/index.js';`)) problems.push(`${name}: missing index export`);
  }
  return problems;
}

if (import.meta.main) {
  const problems = checkCoverage();
  for (const p of problems) process.stderr.write(`catalog: ${p}\n`);
  process.exitCode = problems.length ? 1 : 0;
}
