// Derived lists. Everything that used to be edited by hand for each new component is computed from the catalog
// (packages/docs/catalog.jsonl) and the component folders, so a component branch adds its own files and one catalog line
// and nothing else that another branch also edits.
//
//   node scripts/sync.mjs            write the committed derived files (`pnpm sync`)
//   node scripts/sync.mjs check      fail when a committed derived file is stale (also tests/bootstrap/sync.test.mjs)
//   node scripts/sync.mjs barrel     write the package root barrel, packages/velcro/src/index.ts (build only, ignored)
//   node scripts/sync.mjs notices <copy>
//                                    write a shipped copy of the assembled third-party notices (build only, ignored)
//
// Committed and derived: the package export map (packages/velcro/package.json) and the per-component API parity
// reports (docs/api/parity/<name>.md, written by scripts/api/parity.mjs). The export map is written one entry per line
// and checked as a set, because .gitattributes merges package.json with git's union driver: two branches that each add
// a component keep both export lines instead of conflicting, in whatever order the merge leaves them.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODULE_EXPORTS, PACKAGE_OWNER, readCatalog } from './site/catalog.mjs';

export const repoRoot = fileURLToPath(new URL('../', import.meta.url));
export const PACKAGE_JSON = 'packages/velcro/package.json';
export const BARREL = 'packages/velcro/src/index.ts';
export const NOTICES = 'THIRD_PARTY_NOTICES.md';
export const NOTICE_COPIES = Object.freeze(['packages/velcro/THIRD_PARTY_NOTICES.md', 'packages/docs/public/THIRD_PARTY_NOTICES.md']);
export const NOTICE_MARKER = '<!-- component notices: packages/velcro/src/components/<name>/NOTICE.md -->';
const COMPONENTS = 'packages/velcro/src/components';

const target = file => ({ types: `./dist/${file}.d.ts`, import: `./dist/${file}.js` });

/**
 * The package export map, in canonical order: the root, then each catalog component (./<name>, ./<name>/class when the
 * component has a class.ts, then the module exports it owns), then the package-owned module exports, then the fixed
 * tail. scripts/site/catalog.mjs (checkExports) remains the allowlist; this only computes the entries it requires.
 */
export function velcroExports(root = repoRoot) {
  const out = { '.': target('index') };
  const modules = Object.entries(MODULE_EXPORTS);
  for (const { name } of readCatalog(root)) {
    out[`./${name}`] = target(`components/${name}/index`);
    if (existsSync(path.join(root, COMPONENTS, name, 'class.ts'))) out[`./${name}/class`] = target(`components/${name}/class`);
    for (const [key, [owner, file]] of modules) if (owner === name) out[key] = target(file);
  }
  for (const [key, [owner, file]] of modules) if (owner === PACKAGE_OWNER) out[key] = target(file);
  Object.assign(out, {
    './themes/dark.css': './themes/dark.css',
    './themes/light.css': './themes/light.css',
    './custom-elements.json': './custom-elements.json',
    './react': { types: './dist/react/index.d.ts', import: './dist/react/index.js' },
    './react/*': './dist/react/*',
    './package.json': './package.json',
  });
  return out;
}

const inline = value => (typeof value === 'string' ? JSON.stringify(value)
  : `{ ${Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ')} }`);
const EXPORTS_OPEN = '  "exports": {';
const EXPORTS_CLOSE = '  },';
const PLACEHOLDER = 'velcro-sync-exports-placeholder';

/** package.json text with `exports` replaced by the given map, written one entry per line. */
export function renderPackageJson(pkg, exportsMap) {
  const text = `${JSON.stringify({ ...pkg, exports: PLACEHOLDER }, null, 2)}\n`;
  const lines = Object.entries(exportsMap).map(([k, v], i, all) => `    ${JSON.stringify(k)}: ${inline(v)}${i < all.length - 1 ? ',' : ''}`);
  return text.replace(`"exports": "${PLACEHOLDER}"`, () => ['"exports": {', ...lines, '  }'].join('\n'));
}

/**
 * The keys that appear more than once in one object of a JSON text, as "path.key" (JSON.parse keeps only the last). A union
 * merge leaves both sides' lines when two branches edit the same line, which is how a key gets duplicated.
 */
export function duplicateKeys(text) {
  const dups = [];
  const stack = []; // per open container: { keys: Set|null (array), path, expectKey, last }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const top = stack.at(-1);
    if (ch === '"') {
      let j = i + 1;
      while (text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      const str = JSON.parse(text.slice(i, j + 1));
      if (top?.keys && top.expectKey) {
        if (top.keys.has(str)) dups.push([...top.path, str].map(k => JSON.stringify(k)).join(' > '));
        top.keys.add(str);
        top.last = str;
        top.expectKey = false;
      }
      i = j;
    } else if (ch === '{' || ch === '[') {
      const parent = top?.keys ? [...top.path, top.last] : top ? [...top.path, '[]'] : [];
      stack.push({ keys: ch === '{' ? new Set() : null, path: parent, expectKey: ch === '{', last: null });
    } else if (ch === '}' || ch === ']') {
      stack.pop();
    } else if (ch === ',' && top?.keys) {
      top.expectKey = true;
    }
  }
  return dups;
}

const UNION_DAMAGE = 'a union merge kept both sides of an edited line; resolve it by hand (`pnpm sync` cannot tell which side is right)';

/**
 * Problems with the committed package.json (empty means current). It must be exactly the rendered canonical file, except
 * that the export lines may appear in any order (a union merge appends both sides' lines at one place). A duplicated,
 * missing, extra or reformatted line is a problem; a duplicated key anywhere is reported as union-merge damage, which
 * `pnpm sync` refuses to rewrite.
 */
export function checkPackageJson(root = repoRoot) {
  const text = readFileSync(path.join(root, PACKAGE_JSON), 'utf8');
  let pkg;
  try { pkg = JSON.parse(text); } catch { return [`${PACKAGE_JSON}: not valid JSON`]; }
  const dups = duplicateKeys(text);
  if (dups.length) return [`${PACKAGE_JSON}: duplicate keys ${dups.join(', ')}: ${UNION_DAMAGE}`];
  const wanted = renderPackageJson(pkg, velcroExports(root));
  const lines = text.split('\n');
  const open = lines.indexOf(EXPORTS_OPEN);
  const close = lines.indexOf(EXPORTS_CLOSE, open);
  if (open < 0 || close < 0) return [`${PACKAGE_JSON}: exports block not found (run \`pnpm sync\`)`];
  const order = Object.keys(velcroExports(root));
  const key = line => /^ {4}("(?:[^"\\]|\\.)*"):/.exec(line)?.[1];
  const body = lines.slice(open + 1, close).map(l => l.replace(/,$/, ''));
  const rank = l => { const k = key(l); return k === undefined ? -1 : order.indexOf(JSON.parse(k)); };
  if (body.some(l => rank(l) < 0)) return [`${PACKAGE_JSON}: unexpected export line (run \`pnpm sync\`)`];
  const sorted = body.sort((a, b) => rank(a) - rank(b)).map((l, i, all) => (i < all.length - 1 ? `${l},` : l));
  const normalized = [...lines.slice(0, open + 1), ...sorted, ...lines.slice(close)].join('\n');
  return normalized === wanted ? [] : [`${PACKAGE_JSON}: exports are stale (run \`pnpm sync\`)`];
}

/** Writes the export map. Refuses a file with duplicate keys: re-rendering would silently keep the last of them. */
export function writePackageJson(root = repoRoot) {
  const file = path.join(root, PACKAGE_JSON);
  const text = readFileSync(file, 'utf8');
  const dups = duplicateKeys(text);
  if (dups.length) throw new Error(`${PACKAGE_JSON}: duplicate keys ${dups.join(', ')}: ${UNION_DAMAGE}`);
  writeFileSync(file, renderPackageJson(JSON.parse(text), velcroExports(root)));
}

/** The package root: registers every catalog component through its own entry. */
export function renderBarrel(root = repoRoot) {
  return [
    '// Generated from packages/docs/catalog.jsonl by scripts/sync.mjs at build time; not committed. Do not edit.',
    ...readCatalog(root).map(({ name }) => `export * from './components/${name}/index.js';`),
    '',
  ].join('\n');
}

/**
 * THIRD_PARTY_NOTICES.md as shipped: the root file with its component marker replaced by every component's NOTICE.md
 * fragment (a Markdown list of the Shoelace material that component uses), in catalog order. Fragments belong to catalog
 * components only. The package and the site ship this text byte for byte.
 */
export function assembleNotices(root = repoRoot) {
  const text = readFileSync(path.join(root, NOTICES), 'utf8');
  const lines = text.split('\n');
  const at = lines.indexOf(NOTICE_MARKER);
  if (at < 0 || lines.lastIndexOf(NOTICE_MARKER) !== at) throw new Error(`${NOTICES}: needs exactly one component notice marker`);
  const fragments = [];
  for (const { name } of readCatalog(root)) {
    const file = path.join(root, COMPONENTS, name, 'NOTICE.md');
    if (!existsSync(file)) continue;
    const fragment = readFileSync(file, 'utf8').trimEnd();
    if (!/^- /.test(fragment) || fragment.includes(NOTICE_MARKER) || /^#/m.test(fragment)) {
      throw new Error(`${COMPONENTS}/${name}/NOTICE.md: must be a Markdown list, without headings`);
    }
    fragments.push(...fragment.split('\n'));
  }
  return [...lines.slice(0, at), ...fragments, ...lines.slice(at + 1)].join('\n');
}

const CITE = /THIRD_PARTY_NOTICES\.md/;
const walkFiles = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walkFiles(path.join(dir, e.name)) : [path.join(dir, e.name)]);

/**
 * Problems with the provenance of the component sources (empty means none):
 * - every TypeScript file of a catalog component (but its index.ts and class.ts re-export entries) states its
 *   provenance in its first 900 bytes: it cites THIRD_PARTY_NOTICES.md for the Shoelace material it adapts, or it says
 *   that it includes no Shoelace source; a header that says it adapts, copies or ports something must cite the notices;
 * - a component's NOTICE.md names at least one file, and only files in its own folder;
 * - every component file the shipped notices name (the root file and every fragment) exists, and a named source file
 *   cites THIRD_PARTY_NOTICES.md in its header, unless the notice marks it "(written for Velcro" on the same line. So a
 *   file the notices say adapts Shoelace material cannot drop that citation, and no notice names a missing file.
 */
export function checkProvenance(root = repoRoot) {
  const problems = [];
  const header = rel => readFileSync(path.join(root, rel), 'utf8').slice(0, 900);
  for (const { name } of readCatalog(root)) {
    const dir = path.join(root, COMPONENTS, name);
    for (const file of existsSync(dir) ? walkFiles(dir) : []) {
      if (!file.endsWith('.ts') || ['index.ts', 'class.ts'].includes(path.basename(file))) continue;
      const rel = path.relative(root, file).split(path.sep).join('/');
      const h = header(rel);
      if (!/THIRD_PARTY_NOTICES\.md|No Shoelace source is included|written for Velcro/.test(h)) problems.push(`${rel}: no provenance statement in its header`);
      else if (/\b(adapted|copied|ported) from\b/i.test(h) && !CITE.test(h)) problems.push(`${rel}: adapts upstream material but does not cite ${NOTICES}`);
    }
    const fragment = path.join(dir, 'NOTICE.md');
    if (!existsSync(fragment)) continue;
    const named = [...readFileSync(fragment, 'utf8').matchAll(/`(packages\/velcro\/src\/[^`]+)`/g)].map(m => m[1]);
    if (!named.length) problems.push(`${COMPONENTS}/${name}/NOTICE.md: names no file`);
    for (const p of named) if (!p.startsWith(`${COMPONENTS}/${name}/`)) problems.push(`${COMPONENTS}/${name}/NOTICE.md: names another folder's file ${p}`);
  }
  let notices;
  try { notices = assembleNotices(root); } catch (e) { return [...problems, e.message]; }
  for (const line of notices.split('\n')) {
    for (const m of line.matchAll(/`(packages\/velcro\/src\/components\/[^`<>*]+)`( \(written for Velcro)?/g)) {
      const rel = m[1];
      if (!existsSync(path.join(root, rel))) { problems.push(`${NOTICES}: names a missing file ${rel}`); continue; }
      if (/\.(ts|css)$/.test(rel) && !m[2] && !CITE.test(header(rel))) problems.push(`${rel}: named in the notices but its header does not cite ${NOTICES}`);
    }
  }
  return problems;
}

/** Problems with the committed derived files; the fix for every one of them is `pnpm sync`. */
export async function checkDerived(root = repoRoot) {
  const problems = [...checkPackageJson(root)];
  const { checkReports } = await import('./api/parity.mjs');
  problems.push(...checkReports(root));
  return problems;
}

export async function writeDerived(root = repoRoot) {
  writePackageJson(root);
  const { writeReports } = await import('./api/parity.mjs');
  writeReports(root);
}

if (import.meta.main) {
  // `pnpm sync -- check` passes a literal `--` through to the script.
  const argv = process.argv.slice(2);
  const [cmd, arg] = argv[0] === '--' ? argv.slice(1) : argv;
  const say = m => process.stdout.write(`sync: ${m}\n`);
  if (cmd === undefined) {
    try {
      await writeDerived();
    } catch (e) {
      process.stderr.write(`sync: ${e.message}\n`);
      process.exit(1);
    }
    say('wrote the export map and the API parity reports');
  } else if (cmd === 'check') {
    const problems = await checkDerived();
    for (const p of problems) process.stderr.write(`sync: ${p}\n`);
    if (problems.length) process.exitCode = 1;
    else say('derived files are current');
  } else if (cmd === 'barrel') {
    writeFileSync(path.join(repoRoot, BARREL), renderBarrel());
  } else if (cmd === 'notices' && NOTICE_COPIES.includes(arg)) {
    writeFileSync(path.join(repoRoot, arg), assembleNotices());
  } else {
    process.stderr.write(`usage: node scripts/sync.mjs [check | barrel | notices ${NOTICE_COPIES.join('|')}]\n`);
    process.exitCode = 2;
  }
}
