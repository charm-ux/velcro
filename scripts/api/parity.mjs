// Shoelace API parity: compares, per implemented component, every documented Shoelace 2.20.1 attribute/property, method,
// event, slot, part and CSS custom property with Velcro's manifest. The gaps (missing or mismatched) are a ledger that
// may only shrink. The generated report is one file per component, docs/api/parity/<name>.md (docs/api-parity.md explains
// them), so components are added without editing a shared report. Velcro's manifest is analyzed from the sources.
//   node scripts/api/parity.mjs report    rewrite docs/api/parity/<name>.md (also part of `pnpm sync`)
//   node scripts/api/parity.mjs summary   print the totals and the per-component counts
//   node scripts/api/parity.mjs ledger    rewrite the ledger, refusing to add an entry
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { readCatalog } from '../site/catalog.mjs';
import { analyzeVelcro, apiModel, customElements, readJson, repoRoot, shoelaceManifestPath } from './model.mjs';

export const ledgerPath = 'docs/api/api-parity-ledger.json';
export const reportPath = 'docs/api-parity.md';
export const reportDir = 'docs/api/parity';

const KINDS = [
  ['properties', 'property', p => p.name || p.attribute],
  ['methods', 'method', m => m.name],
  ['events', 'event', e => e.name],
  ['slots', 'slot', s => s.name || '(default)'],
  ['parts', 'part', p => p.name],
  ['cssProperties', 'css-property', p => p.name],
];
const FIELDS = {
  properties: ['attribute', 'type', 'default', 'reflects', 'readonly'],
  methods: ['signature'],
  events: ['type'],
  slots: [],
  parts: [],
  cssProperties: ['default'],
};

// Shoelace declares `dir` and `lang` once, on its base element (ShoelaceElement), and its manifest does not list them on the
// components. A Velcro component that declares them itself mirrors that base, so they are reported as inherited from it
// rather than as Velcro-only.
export const SHOELACE_BASE_PROPERTIES = Object.freeze(['dir', 'lang']);
export const SHOELACE_BASE_ORIGIN = "from Shoelace's base element (ShoelaceElement, not in its manifest)";

/** Formatting-only differences are not API differences: whitespace, quote style and union member order. */
export function normalize(field, value) {
  if (typeof value === 'boolean') return String(value);
  let v = String(value ?? '').replace(/\s+/g, ' ').trim().replace(/'/g, '"');
  if (field === 'type' && v.includes('|') && !/[{}()<>]/.test(v)) v = v.split('|').map(s => s.trim()).sort().join(' | ');
  return v;
}

export function compare(velcroManifest, shoelaceManifest, tags) {
  const velcro = customElements(velcroManifest);
  const shoelace = customElements(shoelaceManifest);
  const gaps = [];
  const extras = [];
  const counts = {};
  for (const tag of tags) {
    const up = shoelace.get(tag);
    const own = velcro.get(tag);
    const c = (counts[tag] = { compared: 0, matched: 0, missing: 0, mismatched: 0, velcroOnly: 0, inherited: 0 });
    if (!up || !own) {
      gaps.push(`${tag}: ${!up ? 'not in the Shoelace manifest' : 'not in the Velcro manifest'}`);
      continue;
    }
    const a = apiModel(up, { documentedOnly: true });
    const b = apiModel(own);
    for (const [section, label, key] of KINDS) {
      const theirs = new Map(a[section].map(x => [key(x), x]));
      const ours = new Map(b[section].map(x => [key(x), x]));
      for (const [name, item] of theirs) {
        c.compared++;
        const mine = ours.get(name);
        if (!mine) {
          c.missing++;
          gaps.push(`${tag} ${label} ${name}: missing`);
          continue;
        }
        const diffs = FIELDS[section].filter(f => {
          if ((section === 'events' || section === 'cssProperties') && !item[f]) return false;
          return normalize(f, item[f]) !== normalize(f, mine[f]);
        });
        if (diffs.length) c.mismatched++;
        else c.matched++;
        for (const f of diffs) {
          gaps.push(`${tag} ${label} ${name}: ${f} differs (shoelace ${JSON.stringify(normalize(f, item[f]))}, velcro ${JSON.stringify(normalize(f, mine[f]))})`);
        }
      }
      for (const [name, item] of ours) {
        if (theirs.has(name)) continue;
        const origin = item.origin || (section === 'properties' && SHOELACE_BASE_PROPERTIES.includes(name) ? SHOELACE_BASE_ORIGIN : item.origin);
        if (origin) c.inherited++;
        else c.velcroOnly++;
        extras.push({ tag, kind: label, name, origin });
      }
    }
  }
  return { gaps: gaps.sort(), extras, counts };
}

export function currentParity(root = repoRoot, velcroManifest = analyzeVelcro(root)) {
  const tags = readCatalog(root).map(c => c.tag);
  return compare(velcroManifest, readJson(shoelaceManifestPath, root), tags);
}

const COUNTS_HEAD = ['| Compared | Matching | Mismatched | Missing | Velcro-only | Inherited extras |', '| ---: | ---: | ---: | ---: | ---: | ---: |'];
const countsRow = c => `| ${c.compared} | ${c.matched} | ${c.mismatched} | ${c.missing} | ${c.velcroOnly} | ${c.inherited} |`;

/** One component's report: docs/api/parity/<name>.md. */
export function renderComponentReport(tag, { gaps, extras, counts }) {
  const lines = [
    `# \`${tag}\` Shoelace API parity`,
    '',
    '<!-- Generated by `pnpm sync` (scripts/api/parity.mjs) from the component sources and',
    '     docs/api/shoelace-2.20.1.custom-elements.json. Do not edit; a test fails when it is stale. -->',
    '',
    'How entries are compared: [docs/api-parity.md](../../api-parity.md).',
    '',
    ...COUNTS_HEAD,
    countsRow(counts[tag]),
    '',
  ];
  const mine = gaps.filter(g => g.startsWith(`${tag} `) || g.startsWith(`${tag}:`)).map(g => g.slice(tag.length + 1));
  const missing = mine.filter(g => g.endsWith(': missing'));
  const mismatched = mine.filter(g => !g.endsWith(': missing'));
  const ext = extras.filter(e => e.tag === tag);
  const list = (title, items) => {
    lines.push(`## ${title}`, '');
    if (!items.length) lines.push('- None.');
    for (const i of items) lines.push(`- ${i}`);
    lines.push('');
  };
  list('Missing', missing.map(g => `\`${g.replace(/: missing$/, '')}\``));
  list('Mismatched', mismatched.map(g => {
    const i = g.indexOf(': ');
    return `\`${g.slice(0, i)}\`: ${g.slice(i + 2)}`;
  }));
  list('Velcro-only (own)', ext.filter(e => !e.origin).map(e => `\`${e.kind} ${e.name}\``));
  list('Inherited extras', ext.filter(e => e.origin).map(e => `\`${e.kind} ${e.name}\` (${e.origin})`));
  return `${lines.join('\n').trimEnd()}\n`;
}

/** The expected report files, { 'docs/api/parity/<name>.md': text }, one per catalog component. */
export function renderReports(root = repoRoot, parity = currentParity(root)) {
  return Object.fromEntries(readCatalog(root).map(({ name, tag }) => [`${reportDir}/${name}.md`, renderComponentReport(tag, parity)]));
}

/** Problems with the committed reports (missing, stale or without a catalog component); the fix is `pnpm sync`. */
export function checkReports(root = repoRoot, parity) {
  const wanted = renderReports(root, parity ?? currentParity(root));
  const dir = path.join(root, reportDir);
  const present = existsSync(dir) ? readdirSync(dir).map(f => `${reportDir}/${f}`) : [];
  const problems = [];
  for (const f of present) if (!(f in wanted)) problems.push(`${f}: no catalog component (run \`pnpm sync\`)`);
  for (const [f, text] of Object.entries(wanted)) {
    const file = path.join(root, f);
    if (!existsSync(file)) problems.push(`${f}: missing (run \`pnpm sync\`)`);
    else if (readFileSync(file, 'utf8') !== text) problems.push(`${f}: stale (run \`pnpm sync\`)`);
  }
  return problems;
}

export function writeReports(root = repoRoot) {
  const wanted = renderReports(root);
  const dir = path.join(root, reportDir);
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir)) if (!(`${reportDir}/${f}` in wanted)) rmSync(path.join(dir, f));
  for (const [f, text] of Object.entries(wanted)) writeFileSync(path.join(root, f), text);
}

/** The totals across the catalog, printed on demand rather than committed (a committed total changes with every component). */
export function renderSummary({ counts }) {
  const total = k => Object.values(counts).reduce((n, c) => n + c[k], 0);
  return [
    `Totals: ${total('compared')} Shoelace entries compared, ${total('matched')} matching, ${total('mismatched')} mismatched, `
      + `${total('missing')} missing; ${total('velcroOnly')} Velcro-only and ${total('inherited')} inherited extras.`,
    '',
    `| Component ${COUNTS_HEAD[0]}`,
    `| --- ${COUNTS_HEAD[1]}`,
    ...Object.entries(counts).map(([tag, c]) => `| \`${tag}\` ${countsRow(c)}`),
    '',
  ].join('\n');
}

export function readLedger(root = repoRoot) {
  const file = path.join(root, ledgerPath);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).gaps : null;
}

if (import.meta.main) {
  const cmd = process.argv[2];
  const parity = currentParity();
  if (cmd === 'report') {
    writeReports();
  } else if (cmd === 'summary') {
    process.stdout.write(renderSummary(parity));
  } else if (cmd === 'ledger') {
    const previous = readLedger();
    const added = previous ? parity.gaps.filter(g => !previous.includes(g)) : [];
    if (added.length) {
      process.stderr.write(`parity: refusing to grow the ledger (${added.length} new gap(s)); fix them instead:\n`);
      for (const g of added) process.stderr.write(`  ${g}\n`);
      process.exit(1);
    }
    writeFileSync(path.join(repoRoot, ledgerPath), `${JSON.stringify({ gaps: parity.gaps }, null, 2)}\n`);
  } else {
    process.stderr.write('usage: node scripts/api/parity.mjs report|summary|ledger\n');
    process.exit(2);
  }
  process.stdout.write(`parity: ${parity.gaps.length} gap(s)\n`);
}
