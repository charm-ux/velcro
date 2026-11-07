// Normalized API model of a custom element declaration from a Custom Elements Manifest. The docs API tables and the
// Shoelace API parity check both read it, so a page and the parity report always describe the same API.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
// Built by the package's `analyze` step and ignored: it is derived from the component sources, so it is never committed.
export const velcroManifestPath = 'packages/velcro/custom-elements.json';
export const shoelaceManifestPath = 'docs/api/shoelace-2.20.1.custom-elements.json';

export const readJson = (rel, root = repoRoot) => JSON.parse(readFileSync(path.join(root, rel), 'utf8'));

const analyzed = new Map();
/**
 * Velcro's Custom Elements Manifest analyzed from the current sources (the package's own analyzer configuration) into a
 * temporary directory, so source checks never depend on a build. Cached per process.
 */
export function analyzeVelcro(root = repoRoot) {
  if (analyzed.has(root)) return analyzed.get(root);
  const pkgDir = path.join(root, 'packages/velcro');
  const out = mkdtempSync(path.join(tmpdir(), 'velcro-cem-'));
  try {
    const cem = path.join(pkgDir, 'node_modules/@custom-elements-manifest/analyzer/cem.js');
    // The analyzer joins --outdir to its working directory, so it takes a relative path. Bounded: a stuck analyzer fails
    // the check instead of hanging it, and it never reads stdin.
    const res = spawnSync(process.execPath, [cem, 'analyze', '--outdir', path.relative(pkgDir, out)], {
      cwd: pkgDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000, killSignal: 'SIGKILL',
      env: { ...process.env, VELCRO_CEM_REACT_OUTDIR: path.join(out, 'react') },
    });
    if (res.error || res.status !== 0) throw new Error(`manifest analyzer failed (${res.error?.code ?? `exit ${res.status}`})`);
    const manifest = JSON.parse(readFileSync(path.join(out, 'custom-elements.json'), 'utf8'));
    analyzed.set(root, manifest);
    return manifest;
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

export function customElements(manifest) {
  const out = new Map();
  for (const mod of manifest.modules ?? []) {
    for (const decl of mod.declarations ?? []) if (decl.tagName) out.set(decl.tagName, decl);
  }
  return out;
}

/** "from @charm-ux/core CoreButton" for inherited entries, '' for the element's own API. */
export function origin(item) {
  const from = item?.inheritedFrom;
  if (!from) return '';
  return `from ${[from.package, from.name].filter(Boolean).join(' ')}`;
}

const isPublic = m => !m.static && m.privacy !== 'private' && m.privacy !== 'protected' && !/^[_#]/.test(m.name);
const text = t => t?.text ?? '';
const signature = m => `(${(m.parameters ?? []).map(p => `${p.rest ? '...' : ''}${p.name}${p.optional ? '?' : ''}: ${text(p.type) || 'unknown'}`).join(', ')}) => ${text(m.return?.type) || 'void'}`;

/**
 * Sections of an element's public API: properties (with their attribute), methods, events, slots, parts and CSS custom
 * properties. `documentedOnly` keeps only described members, the rule Shoelace's own docs use for its API tables.
 */
export function apiModel(decl, { documentedOnly = false } = {}) {
  const members = (decl.members ?? []).filter(m => isPublic(m) && (!documentedOnly || m.description));
  const fields = members.filter(m => m.kind === 'field');
  const attrs = decl.attributes ?? [];
  const properties = fields.map(f => {
    const attr = attrs.find(a => a.fieldName === f.name);
    return {
      name: f.name,
      attribute: f.attribute ?? attr?.name ?? '',
      type: text(f.type) || text(attr?.type),
      default: f.default ?? attr?.default ?? '',
      reflects: Boolean(f.reflects),
      readonly: Boolean(f.readonly),
      description: f.description ?? attr?.description ?? '',
      origin: origin(f),
    };
  });
  for (const a of attrs) {
    if (a.fieldName && properties.some(p => p.name === a.fieldName)) continue;
    if (properties.some(p => p.attribute === a.name)) continue;
    if (documentedOnly && !a.description) continue;
    properties.push({ name: a.fieldName ?? '', attribute: a.name, type: text(a.type), default: a.default ?? '',
      reflects: false, readonly: false, description: a.description ?? '', origin: origin(a) });
  }
  const byName = (a, b) => (a.name || a.attribute).localeCompare(b.name || b.attribute);
  return {
    properties: properties.sort(byName),
    methods: members.filter(m => m.kind === 'method')
      .map(m => ({ name: m.name, signature: signature(m), description: m.description ?? '', origin: origin(m) })).sort(byName),
    events: (decl.events ?? []).filter(e => e.name)
      .map(e => ({ name: e.name, type: text(e.type), description: e.description ?? '', origin: origin(e) })).sort(byName),
    slots: (decl.slots ?? []).map(s => ({ name: s.name ?? '', description: s.description ?? '', origin: origin(s) })).sort(byName),
    parts: (decl.cssParts ?? []).map(p => ({ name: p.name, description: p.description ?? '', origin: origin(p) })).sort(byName),
    cssProperties: (decl.cssProperties ?? [])
      .map(p => ({ name: p.name, default: p.default ?? '', description: p.description ?? '', origin: origin(p) })).sort(byName),
  };
}
