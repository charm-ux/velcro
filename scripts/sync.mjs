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
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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
 * Problems with the committed package.json (empty means current). It must be exactly the rendered canonical file, except
 * that the export lines may appear in any order (a union merge appends both sides' lines at one place). A duplicated,
 * missing, extra or reformatted line is a problem.
 */
export function checkPackageJson(root = repoRoot) {
  const text = readFileSync(path.join(root, PACKAGE_JSON), 'utf8');
  let pkg;
  try { pkg = JSON.parse(text); } catch { return [`${PACKAGE_JSON}: not valid JSON`]; }
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

export function writePackageJson(root = repoRoot) {
  const file = path.join(root, PACKAGE_JSON);
  writeFileSync(file, renderPackageJson(JSON.parse(readFileSync(file, 'utf8')), velcroExports(root)));
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
  const [cmd, arg] = process.argv.slice(2);
  const say = m => process.stdout.write(`sync: ${m}\n`);
  if (cmd === undefined) {
    await writeDerived();
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
