/**
 * Build-time capture of the client module closure for the site notices.
 *
 * A small Rollup/Vite hook: after the production client bundle is written it records which package (name, version,
 * declared license) every module that contributed code to an emitted chunk came from, plus the sha256 of every
 * emitted file. The record uses logical identifiers only (`<package>/<path inside package>`, `repo:<repo-relative
 * path>`, `virtual:<id>`): no absolute paths, no source text and no source maps. Virtual and injected helpers are
 * classified explicitly; anything unrecognised is kept as `unknown` so the notice generator can fail on it.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export interface ClosureModule {
  chunk: string;
  id: string;
  kind: 'package' | 'first-party' | 'virtual' | 'unknown';
  package?: string;
  rendered: number;
  /** Set when the module source carries a compiler-emitted `__decorate` helper (see inspectDecorate). */
  compilerHelper?: 'typescript-decorate' | 'unrecognized';
  /** For `unrecognized`: mentions of the decorate API and the whitespace-stripped sha256 of the module source, so a reviewed use can be pinned exactly. */
  decorateMentions?: number;
  decorateSha256?: string;
}
export type HelperInfo = { status: 'typescript-decorate' | 'unrecognized'; mentions: number; sha256: string };
export interface ClosureFile {
  schema: 1;
  files: { file: string; sha256: string; bytes: number }[];
  modules: ClosureModule[];
  packages: { name: string; version: string; license: string }[];
}

/** Virtual ids the bundler injects, mapped to the package whose code they carry. Anything else virtual is unknown. */
export const VIRTUAL_HELPERS: Readonly<Record<string, string>> = Object.freeze({
  'vite/preload-helper': 'vite',
  'vite/modulepreload-polyfill': 'vite',
  'vite/legacy-polyfills': 'vite',
  'rolldown/runtime': 'rolldown',
  'commonjsHelpers': 'vite',
});

// Whitespace-stripped sha256 of TypeScript's `typescript:decorate` emit helper text, taken from
// microsoft/TypeScript src/compiler/factory/emitHelpers.ts at commit d85767abfd83880cea17cea70f9913e9c4496dcc. The tsc output found in
// the shipped closure's modules is byte-identical to it apart from whitespace. Only this exact body is recognised.
export const TS_DECORATE_SHA256 = 'c8e8f11fb5c5b4a950edcaff55716a04cf063d74f532e9bb0f85fcbc97e59104';
const TS_DECORATE_HEAD = 'var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {';

/** Every `var __decorate = ... ;` definition (from its head up to the closing brace line) in a module's source. */
function decorateDefinitions(code: string): string[] {
  const found: string[] = [];
  let at = code.indexOf(TS_DECORATE_HEAD);
  while (at >= 0) {
    const end = code.indexOf('\n};', at);
    if (end < 0) break;
    found.push(code.slice(at, end + 3));
    at = code.indexOf(TS_DECORATE_HEAD, end);
  }
  return found;
}

/** Classify the compiler `__decorate` helper in a module's source: none, the pinned TypeScript body, or anything else. */
export function inspectDecorate(code: string): 'none' | 'typescript-decorate' | 'unrecognized' {
  return inspectDecorateInfo(code)?.status ?? 'none';
}
export function inspectDecorateInfo(code: string): HelperInfo | null {
  const mentions = code.split('Reflect.decorate').length - 1;
  if (mentions === 0) return null;
  const sha256 = createHash('sha256').update(code.replace(/\s+/g, '')).digest('hex');
  const forms = decorateDefinitions(code);
  const known = forms.filter(f => createHash('sha256').update(f.replace(/\s+/g, '')).digest('hex') === TS_DECORATE_SHA256);
  // Exactly one pinned definition, and no other mention of the helper's API.
  return { status: known.length === 1 && forms.length === 1 && mentions === 2 ? 'typescript-decorate' : 'unrecognized', mentions, sha256 };
}

export function stripQuery(id: string): string {
  return id.replace(/[?#].*$/, '');
}

type PackageInfo = { name: string; version: string; license: string };

export function classifyModule(
  rawId: string,
  repoRoot: string,
  readPackage: (dir: string) => PackageInfo | null,
): { kind: ClosureModule['kind']; id: string; pkg?: PackageInfo; virtualPackage?: string; virtualVersion?: string } {
  const id = stripQuery(rawId).split(path.sep).join('/');
  if (id.startsWith('\0')) {
    const bare = id.slice(1).replace(/\.m?js$/, '');
    // The bundler's transform helpers (for example decorators) are injected under the oxc runtime package's pnpm name.
    const oxc = /^@oxc-project\+runtime@(\d+\.\d+\.\d+)\/helpers\/[A-Za-z0-9_./-]+$/.exec(bare);
    if (oxc) return { kind: 'virtual', id: `virtual:${bare}`, virtualPackage: '@oxc-project/runtime', virtualVersion: oxc[1] };
    const owner = VIRTUAL_HELPERS[bare];
    return owner ? { kind: 'virtual', id: `virtual:${bare}`, virtualPackage: owner } : { kind: 'unknown', id: `virtual:${bare}` };
  }
  const marker = 'node_modules/';
  const at = id.lastIndexOf(marker);
  if (at >= 0) {
    const parts = id.slice(at + marker.length).split('/');
    const name = parts[0]?.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
    const depth = name?.startsWith('@') ? 2 : 1;
    const pkg = name ? readPackage(id.slice(0, at + marker.length) + name) : null;
    if (!pkg || pkg.name !== name) return { kind: 'unknown', id: `unresolved-package:${name ?? ''}` };
    return { kind: 'package', id: `${name}/${parts.slice(depth).join('/')}`, pkg };
  }
  const root = repoRoot.split(path.sep).join('/').replace(/\/$/, '');
  if (id.startsWith(`${root}/`)) return { kind: 'first-party', id: `repo:${id.slice(root.length + 1)}` };
  return { kind: 'unknown', id: 'outside-repository' };
}

function readPackageFromDisk(dir: string): PackageInfo | null {
  try {
    const p = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
    const license = typeof p.license === 'string' ? p.license : '';
    return typeof p.name === 'string' && typeof p.version === 'string' ? { name: p.name, version: p.version, license } : null;
  } catch {
    return null;
  }
}

export function buildClosure(
  chunks: { fileName: string; modules: Record<string, { renderedLength: number }> }[],
  files: ClosureFile['files'],
  repoRoot: string,
  readPackage: (dir: string) => PackageInfo | null = readPackageFromDisk,
  helpers: ReadonlyMap<string, HelperInfo> = new Map(),
): ClosureFile {
  const modules: ClosureModule[] = [];
  const packages = new Map<string, PackageInfo>();
  for (const chunk of chunks) {
    for (const [rawId, info] of Object.entries(chunk.modules)) {
      if (!(info.renderedLength > 0)) continue; // contributed no code to the shipped file
      const c = classifyModule(rawId, repoRoot, readPackage);
      const owner = c.pkg?.name ?? c.virtualPackage;
      const info2 = helpers.get(stripQuery(rawId));
      const compilerHelper = info2?.status;
      modules.push({ chunk: chunk.fileName, id: c.id, kind: c.kind, ...(owner ? { package: owner } : {}), rendered: info.renderedLength,
        ...(compilerHelper ? { compilerHelper } : {}),
        ...(info2 && compilerHelper === 'unrecognized' ? { decorateMentions: info2.mentions, decorateSha256: info2.sha256 } : {}) });
      if (c.pkg) packages.set(`${c.pkg.name}@${c.pkg.version}`, c.pkg);
      if (c.virtualPackage && c.virtualVersion) {
        packages.set(`${c.virtualPackage}@${c.virtualVersion}`, { name: c.virtualPackage, version: c.virtualVersion, license: '' });
      } else if (c.virtualPackage) {
        // The helper belongs to the build tool that ran; its version is read from the docs package's installed copy.
        const host = readPackage(path.join(repoRoot, 'packages/docs/node_modules', c.virtualPackage));
        if (host) packages.set(`${host.name}@${host.version}`, host);
      }
    }
  }
  modules.sort((a, b) => (a.chunk + a.id).localeCompare(b.chunk + b.id));
  return {
    schema: 1,
    files,
    modules,
    packages: [...packages.values()].sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`)),
  };
}

export function closurePlugin({ repoRoot, out }: { repoRoot: string; out: string }) {
  let isClient = true;
  const helperModules = new Map<string, HelperInfo>();
  const seen: { fileName: string; modules: Record<string, { renderedLength: number }> }[] = [];
  return {
    name: 'velcro-site-closure',
    apply: 'build' as const,
    configResolved(config: { build: { ssr: unknown } }) {
      isClient = !config.build.ssr;
    },
    transform(code: string, id: string) {
      if (!isClient || !code.includes('Reflect.decorate')) return null;
      const found = inspectDecorateInfo(code);
      if (found) helperModules.set(stripQuery(id), found);
      return null;
    },
    generateBundle(_options: unknown, bundle: Record<string, { type: string; fileName: string; modules?: Record<string, { renderedLength: number }> }>) {
      if (!isClient) return;
      seen.length = 0;
      for (const item of Object.values(bundle)) if (item.type === 'chunk' && item.modules) seen.push({ fileName: item.fileName, modules: item.modules });
    },
    writeBundle(options: { dir?: string }, bundle: Record<string, { fileName: string }>) {
      if (!isClient || !options.dir) return;
      const files = Object.values(bundle).map(item => {
        const bytes = readFileSync(path.join(options.dir as string, item.fileName));
        return { file: item.fileName, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
      }).sort((a, b) => a.file.localeCompare(b.file));
      mkdirSync(path.dirname(out), { recursive: true });
      writeFileSync(out, `${JSON.stringify(buildClosure(seen, files, repoRoot, readPackageFromDisk, helperModules), null, 1)}\n`);
    },
  };
}
