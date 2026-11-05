// Runtime third-party notices for the documentation site, generated from the captured production client closure.
// Fails closed: any package without a recognised license and a retained text, any unknown or virtual module that is
// not explicitly accounted for, and any first-party module outside the known locations stops generation.
// Errors carry a short code only (never a path or file content). No registry endpoint, author/contact field or
// filesystem path from package metadata is ever copied into the output.
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TS_DECORATE_SHA256 } from '../../packages/docs/closure-plugin.ts';

export class NoticeError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

const here = path.dirname(fileURLToPath(import.meta.url));
export const ALLOWED_SPDX = Object.freeze(['MIT', 'BSD-3-Clause', 'Apache-2.0']);
export const FIRST_PARTY_PREFIXES = Object.freeze(['repo:packages/docs/', 'repo:packages/velcro/dist/']);

// A text must look like the license it is filed under; this is a sanity fingerprint, not a legal classifier.
const FINGERPRINTS = {
  MIT: [/Permission is hereby granted, free of charge/, /THE SOFTWARE IS PROVIDED "AS IS"/],
  'BSD-3-Clause': [/Redistribution and use in source and binary forms/, /Neither the name of/],
  'Apache-2.0': [/Apache License/, /Version 2\.0, January 2004/, /END OF TERMS AND CONDITIONS/],
};

// Curated texts apply to one exact name@version only. A new version fails until a person re-reviews it.
export const CURATED = Object.freeze({
  '@charm-ux/core@0.5.2': {
    spdx: 'MIT',
    file: path.join(here, 'curated/charm-ux-core-0.5.2.MIT.txt'),
    provenance:
      'Curated fallback, not a verbatim upstream file: neither the published 0.5.2 package nor its tag contains a LICENSE file. '
      + 'The standard MIT text is used with the owner\'s explicit approval and credits charm-ux, as the official tagged README '
      + '(upstream commit 288ebbda291edfee09200bafb9bce7d99d823d09, "MIT © charm-ux") does. No year or other holder is asserted.',
  },
});

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const squash = text => text.replace(/\s+/g, '');

// Helper code the bundler injects without an installed package of that name. Coverage is bound to ONE exact helper id
// (which carries the runtime version), to the helper body actually embedded in the installed bundler, and to the exact
// upstream license files retrieved at pinned tags. Any other helper, version or body fails closed.
//
// Evidence (retrieved read-only, retained privately with hashes): oxc-project/oxc tag crates_v0.139.0 (commit
// 69b2dfc1810e6ad9d5508ae9a20bc773ba5aa18d), npm/runtime/src/helpers/decorate.js (sha256 fb44571b…14a6a) begins "Copy from
// https://github.com/microsoft/TypeScript/blob/d85767abfd83880cea17cea70f9913e9c4496dcc/src/compiler/factory/emitHelpers.ts#L730-L742".
// That TypeScript file is Apache-2.0 (no copyright line and no NOTICE file in the tree). The oxc repository at the tag is MIT.
// The package README also credits @babel/runtime generally; that is NOT assumed to apply to this function and is not claimed.
export const HELPERS = Object.freeze({
  '@oxc-project+runtime@0.139.0/helpers/esm/decorate': {
    package: '@oxc-project/runtime',
    version: '0.139.0',
    // Whitespace-stripped text of the helper as embedded by the installed bundler (rolldown), between its region markers.
    embeddedSha256: 'f961c53e8a7ad8326629ad6d3c629c2fe649be093d57a55a77cc812a2e76fa12',
    // Whitespace-stripped sha256 of the module source the bundler handed to the build (recorded in the closure): binds the shipped module itself.
    moduleSha256: 'cd7539eddeba0b902817c2063d520e182c69ffb4915e101103f8980d5c34170c',
    // The bytes are injected from this installed bundler's own dist, so its LICENSE is the redistributor's text. It ships no other notice file.
    redistributor: { name: 'rolldown', version: '1.1.5', sha256: '23ecfff35a5a2e80d92142f75228912c3b1abc4b5a8337a821ff4397e2f9f734' },
    texts: [
      {
        spdx: 'Apache-2.0',
        file: path.join(here, 'curated/typescript-d85767a-Apache-2.0.LICENSE.txt'),
        sha256: '527adf9d4c760f7367c2aeffed6a89afba8ba40ea1b0efbc8f56496ad30ea9cf',
        retrievedSha256: 'a7d00bfd54525bc694b6e32f64c7ebcf5e6b7ae3657be5cc12767bce74654a47',
        label: 'Microsoft TypeScript, LICENSE.txt at commit d85767abfd83880cea17cea70f9913e9c4496dcc (words unchanged; only line endings and trailing spaces normalized so the repository whitespace check passes; the file contains no copyright line; retrieved file sha256 a7d00bfd54525bc694b6e32f64c7ebcf5e6b7ae3657be5cc12767bce74654a47)',
      },
      {
        spdx: 'MIT',
        file: path.join(here, 'curated/oxc-crates_v0.139.0-MIT.LICENSE.txt'),
        sha256: '95ced5ecf1133fbf41d409b5555c86c344f83f3b019926057ddbc07cfdcc27b3',
        label: 'oxc project, LICENSE at tag crates_v0.139.0 (verbatim)',
      },
    ],
    provenance:
      'Bundler-injected `__decorate` helper (helper id @oxc-project+runtime@0.139.0/helpers/esm/decorate). The oxc runtime source copies it '
      + 'from the Microsoft TypeScript compiler\'s emit helpers (commit d85767abfd83880cea17cea70f9913e9c4496dcc), which is Apache-2.0, so that '
      + 'license text is included; the oxc project\'s own MIT license and the installed rolldown 1.1.5 LICENSE (the bundler whose dist injects the bytes; no other notice file ships in it) are included as redistributor texts. No copyright line is '
      + 'asserted beyond the verbatim texts, and no Babel attribution is claimed for this function. Coverage applies only to this exact helper, '
      + 'version and embedded body; the license files shipped inside the published runtime package could not be retrieved or compared.',
  },
});

/** Bodies (whitespace removed) of a helper as embedded in every installed bundler copy; [] if none is found. */
export function readEmbeddedHelpers(repoRoot, helperId) {
  const base = path.join(repoRoot, 'node_modules/.pnpm');
  if (!existsSync(base)) return [];
  const marker = `//#region \\0${helperId}.js\n`;
  const found = [];
  for (const d of readdirSync(base).filter(n => /^rolldown@\d/.test(n)).sort()) {
    const dist = path.join(base, d, 'node_modules/rolldown/dist');
    const files = [];
    try {
      for (const f of readdirSync(dist)) if (f.endsWith('.mjs')) files.push(path.join(dist, f));
      for (const f of readdirSync(path.join(dist, 'shared'))) if (f.endsWith('.mjs')) files.push(path.join(dist, 'shared', f));
    } catch { continue; }
    for (const f of files) {
      try {
        if (lstatSync(f).size > 16 * 1024 * 1024) continue;
        const text = readFileSync(f, 'utf8');
        let at = text.indexOf(marker);
        while (at >= 0) {
          const start = at + marker.length;
          const end = text.indexOf('//#endregion', start);
          if (end > start) found.push(squash(text.slice(start, end)));
          at = text.indexOf(marker, start);
        }
      } catch { /* unreadable candidate */ }
    }
  }
  return found;
}

// Reviewed non-copy uses of the decorate API: Lit tests for `Reflect.decorate` as a feature check. Pinned to exact package, version,
// module and source hash; the module's text is Lit's own BSD-3-Clause code (covered by that package's entry), not a helper copy.
export const DECORATE_API_USES = Object.freeze({
  '@lit/reactive-element@2.1.2/decorators/base.js': { sha256: '24c78da6b8d4210c698f037e6b05c71f53938ce17e03a90ae14dd0dfdfbca53a', mentions: 1 },
});

// Only the package's own license section is the required text; the rest of this file lists unrelated bundled tools.
const SECTION_END = Object.freeze({ vite: /\n# Licenses of bundled dependencies\n/ });

function pnpmDirs(repoRoot, name, version) {
  const base = path.join(repoRoot, 'node_modules/.pnpm');
  if (!existsSync(base)) return [];
  const prefix = `${name.replace('/', '+')}@${version}`;
  return readdirSync(base)
    .filter(d => d === prefix || d.startsWith(`${prefix}_`))
    .sort()
    .map(d => path.join(base, d, 'node_modules', name));
}

/** Default disk reader: the license file of the exact installed name@version, or null. */
export function readInstalledLicense(repoRoot, name, version) {
  for (const dir of pnpmDirs(repoRoot, name, version)) {
    try {
      const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
      if (pkg.name !== name || pkg.version !== version) continue;
      const files = readdirSync(dir).filter(f => /^licen[cs]e(\.(md|txt))?$/i.test(f)).sort();
      if (files.length !== 1) continue;
      const full = path.join(dir, files[0]);
      if (!lstatSync(full).isFile()) continue;
      return readFileSync(full, 'utf8');
    } catch { /* try the next candidate */ }
  }
  return null;
}

function normalize(text) {
  return text.replace(/\r\n?/g, '\n').replace(/\s+$/, '') + '\n';
}

function resolveText(pkg, { repoRoot, readLicense, helperModules, helperRecords = [], readHelpers }) {
  const key = `${pkg.name}@${pkg.version}`;
  const curated = CURATED[key];
  if (curated) {
    if (pkg.license !== '' && pkg.license !== curated.spdx) throw new NoticeError(`license-mismatch:${key}`);
    return { parts: [{ spdx: curated.spdx, text: readFileSync(curated.file, 'utf8') }], provenance: curated.provenance, kind: 'curated' };
  }
  if (helperModules.length > 0) {
    // Helper-only package: every module must be a pinned helper, of this exact version, whose embedded body still matches.
    const parts = [];
    const notes = [];
    for (const id of [...new Set(helperModules)].sort()) {
      const helper = HELPERS[id];
      if (!helper || helper.package !== pkg.name || helper.version !== pkg.version) throw new NoticeError(`unverified-helper:${id}`);
      const own = helperRecords.filter(m => String(m.id).replace(/^virtual:/, '') === id);
      if (own.length === 0 || own.some(m => m.decorateSha256 !== helper.moduleSha256)) throw new NoticeError(`unverified-helper-source:${id}`);
      const embedded = readHelpers(repoRoot, id);
      if (embedded.length === 0 || !embedded.every(body => sha256(Buffer.from(body)) === helper.embeddedSha256)) {
        throw new NoticeError(`unverified-helper-source:${id}`);
      }
      const rd = helper.redistributor;
      const rdText = readLicense(repoRoot, rd.name, rd.version);
      if (rdText === null || sha256(Buffer.from(rdText)) !== rd.sha256) throw new NoticeError(`unverified-helper-source:${id}`);
      parts.push({ spdx: 'MIT', text: rdText, label: `${rd.name} ${rd.version}, LICENSE of the installed bundler that injects this helper (verbatim)` });
      for (const t of helper.texts) {
        const bytes = readFileSync(t.file);
        if (sha256(bytes) !== t.sha256) throw new NoticeError(`curated-text-changed:${id}`);
        parts.push({ spdx: t.spdx, text: bytes.toString('utf8'), label: t.label });
      }
      notes.push(helper.provenance);
    }
    return { parts, provenance: notes.join(' '), kind: 'helper' };
  }
  if (pkg.name === '@oxc-project/runtime') throw new NoticeError(`unverified-helper:${key}`);
  if (!ALLOWED_SPDX.includes(pkg.license)) throw new NoticeError(`unrecognized-license:${key}`);
  let text = readLicense(repoRoot, pkg.name, pkg.version);
  if (text === null) throw new NoticeError(`missing-license:${key}`);
  const end = SECTION_END[pkg.name];
  if (end) {
    const cut = end.exec(text);
    if (!cut) throw new NoticeError(`unexpected-license-layout:${key}`);
    text = text.slice(0, cut.index);
  }
  return { parts: [{ spdx: pkg.license, text }], provenance: 'The license file shipped in the installed package, verbatim.', kind: 'package' };
}

function fence(text) {
  const longest = Math.max(2, ...[...text.matchAll(/`+/g)].map(m => m[0].length));
  return '`'.repeat(longest + 1);
}

/**
 * @param closure parsed client closure (see packages/docs/closure-plugin.ts)
 * @returns {{ text: string, packages: {name,version,spdx,kind}[] }}
 */
export function generateRuntimeNotices(closure, { repoRoot, readLicense = readInstalledLicense, readHelpers = readEmbeddedHelpers } = {}) {
  if (!closure || closure.schema !== 1 || !Array.isArray(closure.modules) || !Array.isArray(closure.packages)) throw new NoticeError('closure-malformed');
  if (closure.modules.length === 0 || closure.packages.length === 0) throw new NoticeError('closure-empty');
  for (const m of closure.modules) {
    if (m.kind === 'unknown') throw new NoticeError('closure-unknown-module');
    if (m.kind === 'first-party' && !FIRST_PARTY_PREFIXES.some(p => typeof m.id === 'string' && m.id.startsWith(p))) {
      throw new NoticeError('closure-unknown-first-party');
    }
    if ((m.kind === 'package' || m.kind === 'virtual')
      && !closure.packages.some(p => p.name === m.package)) throw new NoticeError('closure-package-missing');
  }
  const seen = new Set();
  const entries = [];
  for (const pkg of closure.packages) {
    if (typeof pkg?.name !== 'string' || typeof pkg.version !== 'string' || typeof pkg.license !== 'string'
      || !/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/.test(pkg.name) || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(pkg.version)) {
      throw new NoticeError('closure-malformed');
    }
    const key = `${pkg.name}@${pkg.version}`;
    if (seen.has(key)) throw new NoticeError('closure-duplicate');
    seen.add(key);
    // A helper-only package: EVERY contributing module must be a pinned virtual helper; an ordinary module mixed in blocks.
    const own = pkg.name === '@oxc-project/runtime' ? closure.modules.filter(m => m.package === pkg.name) : [];
    if (own.some(m => m.kind !== 'virtual')) throw new NoticeError(`unverified-helper:${key}`);
    const helperModules = own.map(m => String(m.id).replace(/^virtual:/, ''));
    const resolved = resolveText(pkg, { repoRoot, readLicense, helperModules, helperRecords: own, readHelpers });
    const parts = resolved.parts.map(part => {
      const text = normalize(part.text);
      if (!FINGERPRINTS[part.spdx].every(re => re.test(text))) throw new NoticeError(`license-text-mismatch:${key}`);
      return { spdx: part.spdx, text, label: part.label };
    });
    entries.push({ name: pkg.name, version: pkg.version, parts, spdx: [...new Set(parts.map(x => x.spdx))].join(' AND '),
      provenance: resolved.provenance, kind: resolved.kind });
  }
  // Compiler-emitted `__decorate` copies inside ordinary modules (tsc output of Velcro, core and Litro). The closure cannot see
  // helpers inlined in module files, so each module's source was classified at build time; anything not the pinned body blocks.
  const carriers = new Map();
  let carrierCopies = 0;
  let apiMentions = 0;
  for (const m of closure.modules) {
    if (m.compilerHelper === undefined || m.kind === 'virtual') continue; // virtual helpers are governed by HELPERS (id, body and module hashes)
    if (m.compilerHelper === 'unrecognized') {
      const owner = closure.packages.find(p => p.name === m.package);
      const key = owner ? `${owner.name}@${owner.version}${String(m.id).slice(owner.name.length)}` : '';
      const use = DECORATE_API_USES[key];
      if (!use || use.sha256 !== m.decorateSha256 || use.mentions !== m.decorateMentions) throw new NoticeError('unrecognized-compiler-helper');
      apiMentions += use.mentions;
      continue;
    }
    if (m.compilerHelper !== 'typescript-decorate') throw new NoticeError('closure-malformed');
    const owner = closure.packages.find(p => p.name === m.package);
    const label = m.kind === 'package' && owner ? `${owner.name} ${owner.version}`
      : m.kind === 'first-party' ? 'Velcro first-party compiled output' : null;
    if (!label) throw new NoticeError('closure-malformed');
    carriers.set(label, (carriers.get(label) ?? 0) + 1);
    carrierCopies += 1;
  }
  if (carriers.size > 0) {
    const ts = HELPERS['@oxc-project+runtime@0.139.0/helpers/esm/decorate'].texts[0];
    const bytes = readFileSync(ts.file);
    if (sha256(bytes) !== ts.sha256) throw new NoticeError('curated-text-changed:typescript-decorate');
    let workspaceTs = 'version not recorded';
    try { workspaceTs = `typescript ${JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).devDependencies.typescript}, the workspace compiler`; } catch { /* keep default */ }
    const list = [...carriers].sort(([a], [b]) => a.localeCompare(b))
      .map(([label, n]) => `${label} (${n} module${n === 1 ? '' : 's'}${label.startsWith('Velcro') ? `; emitted by ${workspaceTs}` : '; emitting compiler version not recorded in the package and not asserted'})`).join('; ');
    entries.push({
      name: 'Microsoft TypeScript emit helper `__decorate`', version: 'commit d85767a',
      parts: [{ spdx: 'Apache-2.0', text: normalize(bytes.toString('utf8')), label: ts.label }], spdx: 'Apache-2.0', kind: 'compiler-helper',
      provenance: `Compiler-emitted helper compiled into ${carrierCopies} shipped module${carrierCopies === 1 ? '' : 's'}: ${list}. In every one the helper body `
        + `equals (whitespace removed, sha256 ${TS_DECORATE_SHA256}) TypeScript's \`typescript:decorate\` emit helper at commit d85767abfd83880cea17cea70f9913e9c4496dcc, `
        + 'so the TypeScript license text applies to those copies as well as to the bundler-injected copy. No copyright line is asserted beyond the verbatim text.',
    });
  }
  entries.sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`));

  const groups = new Map();
  for (const e of entries) {
    for (const part of e.parts) {
      const g = `${part.spdx}\n${part.text}`;
      if (!groups.has(g)) groups.set(g, { spdx: part.spdx, text: part.text, label: part.label, members: [] });
      groups.get(g).members.push(e);
    }
  }
  const out = [];
  out.push('# Third-party runtime notices', '',
    'Generated for the Velcro documentation site from the module closure of its production client bundle. It lists the',
    `${entries.length} packages whose code is included in the shipped JavaScript, with the license text each one requires.`,
    'It is separate from THIRD_PARTY_NOTICES.md, which covers material copied or adapted into Velcro source. Velcro itself',
    'is private and UNLICENSED; nothing here relicenses it. Coverage is limited to the packages listed here.', '',
    '## Included packages', '');
  for (const e of entries) out.push(`- ${e.name} ${e.version}: ${e.spdx}`);
  out.push('', '## License texts', '');
  let n = 0;
  for (const g of groups.values()) {
    n += 1;
    const f = fence(g.text);
    out.push(`### ${n}. ${g.spdx}`, '', `Applies to: ${g.members.map(m => `${m.name} ${m.version}`).join(', ')}.`, '');
    if (g.label) out.push(`Text source: ${g.label}.`, '');
    for (const m of g.members) if (m.kind !== 'package') out.push(`Provenance for ${m.name} ${m.version}: ${m.provenance}`, '');
    out.push(`${f}text`, g.text.replace(/\n$/, ''), f, '');
  }
  const injected = closure.modules.filter(m => m.kind === 'virtual' && m.package === '@oxc-project/runtime').length;
  return {
    text: `${out.join('\n').replace(/\n+$/, '')}\n`,
    packages: entries.map(e => ({ name: e.name, version: e.version, spdx: e.spdx, kind: e.kind })),
    // Mentions of the decorate API the shipped JavaScript must contain, all accounted for: two per helper copy (compiled-in or
    // bundler-injected: the feature test and the call) plus the reviewed non-copy uses.
    decorateMentions: 2 * (carrierCopies + injected) + apiMentions,
  };
}
