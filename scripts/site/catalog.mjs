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
    if (!TITLE.test(title)) fail('catalog-title');
    if (!TAG.test(tag)) fail('catalog-tag');
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
  let barrel = [];
  try { barrel = readFileSync(path.join(root, 'packages/velcro/src/index.ts'), 'utf8').split('\n'); } catch { problems.push('src/index.ts: unreadable'); }
  for (const { name, tag } of catalog) {
    if (!dirs.includes(name)) problems.push(`${name}: catalog entry has no component directory`);
    if (!existsSync(path.join(root, `packages/docs/pages/components/${name}.ts`))) problems.push(`${name}: missing docs page`);
    const exDir = path.join(root, `packages/docs/examples/${name}`);
    const uses = listFiles(exDir).filter(f => f.endsWith('.html')).some(f => {
      try { return new RegExp(`<${tag}[\\s>/]`).test(readFileSync(path.join(exDir, f), 'utf8')); } catch { return false; }
    });
    if (!uses) problems.push(`${name}: no docs example uses <${tag}>`);
    if (!existsSync(path.join(root, `tests/product/${name}.spec.mjs`))) problems.push(`${name}: missing product spec`);
    if (!Object.hasOwn(exportsMap, `./${name}`)) problems.push(`${name}: missing package export`);
    if (!barrel.includes(`export * from './components/${name}/index.js';`)) problems.push(`${name}: missing index export`);
  }
  return problems;
}

if (import.meta.main) {
  const problems = checkCoverage();
  for (const p of problems) process.stderr.write(`catalog: ${p}\n`);
  process.exitCode = problems.length ? 1 : 0;
}
