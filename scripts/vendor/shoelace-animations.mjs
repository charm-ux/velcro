// Provenance check for the vendored copy of @shoelace-style/animations
// (packages/velcro/src/components/animation/presets/presets.ts), against the record in SOURCE.json beside it.
//
//   node scripts/vendor/shoelace-animations.mjs check            vendored data == the record's data digest (no network)
//   node scripts/vendor/shoelace-animations.mjs verify <tarball> the npm tarball's sha512 == the record's integrity,
//                                                              its files == the record's per-file sha256, and its data
//                                                              digest == the record's and the vendored copy's
//
// Acquire the tarball the way the project's installs do (the configured registry or the local offline store), into
// ignored scratch; never commit it or where it came from. The data digest is the sha256 of a canonical JSON form of
// every exported animation and the easings table: object keys sorted recursively, array order kept. It covers names
// and values, not formatting, comments or the type annotations the vendored copy adds.
//
// `verify` treats the tarball as untrusted: it checks the sha512 of the bytes first and stops on a mismatch, then reads
// the archive in memory (nothing is extracted or written) and stops if any entry, the package name or version, or any
// file's sha256 differs. It never imports or runs the package's code: the data is parsed from the files' source as
// plain literals, and any other statement is rejected. The repository test (tests/api/animation-presets.test.mjs) ties
// the vendored data to the recorded digest; only `verify` re-checks the record against the published tarball.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const presetsDir = path.join(repoRoot, 'packages/velcro/src/components/animation/presets');
export const RECORD_PATH = path.join(presetsDir, 'SOURCE.json');
export const VENDORED_PATH = path.join(presetsDir, 'presets.ts');

const sha256 = data => createHash('sha256').update(data).digest('hex');

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`non-finite number ${value}`);
  return JSON.stringify(value);
}

/** The canonical digest of a module namespace shaped like @shoelace-style/animations. */
export function presetsDigest(namespace) {
  const { easings, ...animations } = namespace;
  if (!easings || typeof easings !== 'object') throw new Error('no easings table');
  for (const [name, frames] of Object.entries(animations)) {
    if (!Array.isArray(frames)) throw new Error(`${name} is not a keyframe list`);
  }
  return {
    sha256: sha256(canonical({ animations, easings })),
    animations: Object.keys(animations).length,
    easings: Object.keys(easings).length,
  };
}

export function readRecord(file = RECORD_PATH) {
  const record = JSON.parse(readFileSync(file, 'utf8'));
  const problems = [];
  if (record.package !== '@shoelace-style/animations') problems.push('package');
  if (!/^\d+\.\d+\.\d+$/.test(record.version ?? '')) problems.push('version');
  if (!/^sha512-[A-Za-z0-9+/]{86}==$/.test(record.integrity ?? '')) problems.push('integrity');
  if (!/^[0-9a-f]{64}$/.test(record.data?.sha256 ?? '')) problems.push('data.sha256');
  // `files` lists "<path>  <sha256>" lines, like sha256sum output with the columns swapped.
  const files = Array.isArray(record.files) ? record.files.map(line => /^(\S+)  ([0-9a-f]{64})$/.exec(line)) : [null];
  if (!files.every(Boolean)) problems.push('files');
  if (problems.length) throw new Error(`SOURCE.json: malformed ${problems.join(', ')}`);
  return { ...record, files: Object.fromEntries(files.map(([, file, hash]) => [file, hash])) };
}

/** The `files` lines of a record for a map of tarball path -> sha256. */
export const fileLines = files => Object.keys(files).sort().map(file => `${file}  ${files[file]}`);

export async function vendoredDigest(file = VENDORED_PATH) {
  return presetsDigest(await import(pathToFileURL(file).href));
}

/** Reads a (gzipped) tar archive in memory: regular files under `package/` only, as path -> bytes. */
export function readTarball(bytes) {
  const tar = gunzipSync(bytes);
  const files = new Map();
  const text = (offset, length) => tar.subarray(offset, offset + length).toString('utf8').replace(/\0.*$/s, '');
  let paxPath;
  for (let offset = 0; offset + 512 <= tar.length; ) {
    if (tar.subarray(offset, offset + 512).every(b => b === 0)) break;
    const size = Number.parseInt(text(offset + 124, 12).trim() || '0', 8);
    const type = text(offset + 156, 1) || '0';
    const prefix = text(offset + 257, 6) === 'ustar' ? text(offset + 345, 155) : '';
    const headerName = prefix ? `${prefix}/${text(offset, 100)}` : text(offset, 100);
    if (!Number.isSafeInteger(size) || size < 0 || offset + 512 + size > tar.length) throw new Error('truncated or malformed tar entry');
    const body = tar.subarray(offset + 512, offset + 512 + size);
    offset += 512 + Math.ceil(size / 512) * 512;
    if (type === 'x') {
      paxPath = /(?:^|\n)\d+ path=([^\n]*)\n/.exec(body.toString('utf8'))?.[1];
      continue;
    }
    if (type === 'g') continue;
    const name = paxPath ?? headerName;
    paxPath = undefined;
    if (type === '5') continue;
    if (type !== '0') throw new Error(`unsupported tar entry type ${JSON.stringify(type)} for ${JSON.stringify(name)}`);
    const parts = name.split('/');
    if (parts[0] !== 'package' || parts.length < 2 || parts.some(part => part === '' || part === '.' || part === '..')) {
      throw new Error(`unexpected tar entry path ${JSON.stringify(name)}`);
    }
    const file = parts.slice(1).join('/');
    if (files.has(file)) throw new Error(`duplicate tar entry ${JSON.stringify(name)}`);
    files.set(file, body);
  }
  return files;
}

/** The literal value of an expression node; anything that is not plain data throws. */
function literal(ts, node, where) {
  switch (node.kind) {
    case ts.SyntaxKind.StringLiteral:
    case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
      return node.text;
    case ts.SyntaxKind.NumericLiteral:
      return Number(node.text);
    case ts.SyntaxKind.PrefixUnaryExpression:
      if (node.operator === ts.SyntaxKind.MinusToken && node.operand.kind === ts.SyntaxKind.NumericLiteral) return -Number(node.operand.text);
      break;
    case ts.SyntaxKind.TrueKeyword:
      return true;
    case ts.SyntaxKind.FalseKeyword:
      return false;
    case ts.SyntaxKind.NullKeyword:
      return null;
    case ts.SyntaxKind.ArrayLiteralExpression:
      return node.elements.map(element => literal(ts, element, where));
    case ts.SyntaxKind.ObjectLiteralExpression:
      return Object.fromEntries(node.properties.map(property => {
        const key = property.name;
        if (property.kind !== ts.SyntaxKind.PropertyAssignment || !key ||
          ![ts.SyntaxKind.Identifier, ts.SyntaxKind.StringLiteral, ts.SyntaxKind.NumericLiteral].includes(key.kind)) {
          throw new Error(`${where}: object member is not a plain property`);
        }
        return [key.kind === ts.SyntaxKind.NumericLiteral ? String(Number(key.text)) : key.text, literal(ts, property.initializer, where)];
      }));
  }
  throw new Error(`${where}: ${ts.SyntaxKind[node.kind]} is not a literal`);
}

/** The exports of a data-only module: every statement must be `export const <name>[: type] = <literal>;`. */
export async function parseDataModule(source, where) {
  const ts = (await import('typescript')).default;
  const file = ts.createSourceFile(where, source, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  const exports = [];
  for (const statement of file.statements) {
    const declarations = statement.declarationList?.declarations;
    if (statement.kind !== ts.SyntaxKind.VariableStatement ||
      !statement.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) || statement.modifiers.length !== 1 ||
      !(statement.declarationList.flags & ts.NodeFlags.Const) || declarations.length !== 1 ||
      declarations[0].name.kind !== ts.SyntaxKind.Identifier || !declarations[0].initializer) {
      throw new Error(`${where}: statement at ${statement.pos} is not \`export const <name> = <literal>\``);
    }
    exports.push([declarations[0].name.text, literal(ts, declarations[0].initializer, `${where} ${declarations[0].name.text}`)]);
  }
  return exports;
}

/** The package's data, parsed (never run) from dist/index.js's `export * | { <names> } from './<file>.js'` lines and those files. */
export async function parsePackageData(files) {
  const ts = (await import('typescript')).default;
  const index = files.get('dist/index.js');
  if (!index) throw new Error('dist/index.js is missing');
  const exports = [];
  for (const statement of ts.createSourceFile('dist/index.js', index.toString('utf8'), ts.ScriptTarget.Latest, false, ts.ScriptKind.JS).statements) {
    const target = statement.moduleSpecifier?.text;
    const clause = statement.exportClause;
    const named = clause?.kind === ts.SyntaxKind.NamedExports && clause.elements.every(e => !e.propertyName && !e.isTypeOnly)
      ? clause.elements.map(e => e.name.text) : undefined;
    if (statement.kind !== ts.SyntaxKind.ExportDeclaration || statement.isTypeOnly || (clause && !named) || statement.modifiers?.length ||
      !/^\.\/[\w-]+(\/[\w-]+)*\.js$/.test(target ?? '')) {
      throw new Error(`dist/index.js: statement at ${statement.pos} is not \`export * | { <names> } from './<file>.js'\``);
    }
    const file = `dist/${target.slice(2)}`;
    if (!files.has(file)) throw new Error(`dist/index.js: ${target} is missing`);
    const moduleExports = await parseDataModule(files.get(file).toString('utf8'), file);
    for (const name of named ?? []) {
      if (!moduleExports.some(([exported]) => exported === name)) throw new Error(`dist/index.js: ${target} does not export ${name}`);
    }
    exports.push(...moduleExports.filter(([name]) => !named || named.includes(name)));
  }
  const names = exports.map(([name]) => name);
  const duplicate = names.find((name, i) => names.indexOf(name) !== i);
  if (duplicate) throw new Error(`export ${duplicate} is declared twice`);
  return Object.fromEntries(exports);
}

/**
 * Verifies an npm tarball against the record; returns the list of problems (empty when it matches). It stops at the
 * first stage that fails (integrity, archive, package identity and files, data), and it never runs the package's code.
 */
export async function verifyTarball(tarball, record = readRecord()) {
  const bytes = readFileSync(tarball);
  const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
  if (integrity !== record.integrity) return [`tarball integrity ${integrity} is not the recorded ${record.integrity}`];
  let files;
  try {
    files = readTarball(bytes);
  } catch (error) {
    return [`tarball archive: ${error.message}`];
  }
  const problems = [];
  let pkg = {};
  try {
    pkg = JSON.parse(files.get('package.json')?.toString('utf8') ?? 'null') ?? {};
  } catch {
    problems.push('package.json is not JSON');
  }
  if (pkg.name !== record.package || pkg.version !== record.version) {
    problems.push(`tarball is ${pkg.name}@${pkg.version}, not ${record.package}@${record.version}`);
  }
  const hashes = Object.fromEntries([...files].map(([file, body]) => [file, sha256(body)]));
  for (const name of [...new Set([...Object.keys(hashes), ...Object.keys(record.files)])].sort()) {
    if (hashes[name] !== record.files[name]) problems.push(`file ${name}: ${hashes[name] ?? 'missing'} != ${record.files[name] ?? 'unrecorded'}`);
  }
  if (problems.length) return problems;
  let derived;
  try {
    derived = presetsDigest(await parsePackageData(files));
  } catch (error) {
    return [`tarball data: ${error.message}`];
  }
  if (canonical(derived) !== canonical(record.data)) problems.push(`tarball data ${canonical(derived)} != recorded ${canonical(record.data)}`);
  const vendored = await vendoredDigest();
  if (canonical(vendored) !== canonical(derived)) problems.push(`vendored data ${canonical(vendored)} != tarball ${canonical(derived)}`);
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, tarball] = process.argv.slice(2);
  const record = readRecord();
  let problems;
  if (mode === 'check') {
    const vendored = await vendoredDigest();
    problems = canonical(vendored) === canonical(record.data) ? [] : [`vendored data ${canonical(vendored)} != recorded ${canonical(record.data)}`];
  } else if (mode === 'verify' && tarball) {
    problems = await verifyTarball(tarball, record);
  } else {
    console.error('usage: node scripts/vendor/shoelace-animations.mjs check | verify <tarball>');
    process.exit(2);
  }
  for (const p of problems) console.error(`shoelace-animations: ${p}`);
  console.log(`shoelace-animations: ${problems.length ? 'MISMATCH' : 'matches'} ${record.package}@${record.version} (${record.integrity})`);
  process.exit(problems.length ? 1 : 0);
}
