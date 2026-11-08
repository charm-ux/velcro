// Bounded, closed-vocabulary public summary of a failed upstream-conformance run (scripts/upstream-conformance.mjs).
// The raw runner output stays in ignored scratch; this reads only the `test:upstream: ` result lines of that private log and
// prints, per finding, a fixed outcome word and two names that are checked before they are shown: a component only if it
// is in the catalog, a test title only if it is exactly a title in that component's pinned (vendored) inventory and
// survives the same redaction as the browser summary. Anything else is the literal 'unlisted component' or 'unlisted title'.
// Messages, reasons, values, stack traces, paths and file names are never copied; a line that is not recognized is counted
// as 'problem other'. At most MAX_FINDINGS finding lines are printed, then a '+N more' count.
import { redactLine } from './product-summary.mjs';

export const MAX_FINDINGS = 20;
/** The outcome of one test: failed (an inventoried test failed, not ledgered), unexpected (an outcome the records do not
 * expect: not in the inventory, repeated, a known failure that now passes or a new known failure), missing (an inventoried
 * test with no outcome) or skipped-mismatch (a skip upstream does not declare, or one it declares that was not reported). */
export const OUTCOMES = Object.freeze(['failed', 'unexpected', 'missing', 'skipped-mismatch']);
/** Component-level problems that carry no test title. */
export const PROBLEMS = Object.freeze(['infrastructure', 'no-results', 'records', 'other']);
/** Why the run was blocked before or after the tests (from the script's own fixed messages, never their details). */
export const BLOCKED = Object.freeze(['vendor-changed', 'scratch', 'library-build', 'runner-incomplete', 'results-missing',
  'records-drift', 'results-differ', 'internal']);

const COMP = '([a-z][a-z0-9]*(?:-[a-z0-9]+)*)';
const rules = list => list.map(([word, body]) => [word, new RegExp(`^${body}$`)]);
const TITLED = rules([
  ['failed', `unexpected failure: ${COMP}: (.*)`],
  ['unexpected', `now passes, remove from ledger: ${COMP}: (.*)`],
  ['unexpected', `problem: outcome not in inventory for ${COMP}: (.*)`],
  ['unexpected', `problem: duplicate outcome in ${COMP}: (.*)`],
  ['unexpected', `problem: ${COMP}: known failure added: (.*)`],
  ['missing', `problem: missing outcome for ${COMP}: (.*)`],
  ['skipped-mismatch', `problem: skipped test in ${COMP}: (.*)`],
  ['skipped-mismatch', `problem: upstream skip not reported skipped in ${COMP}: (.*)`],
]);
const UNTITLED = rules([
  ['skipped-mismatch', `problem: skipped tests in ${COMP}`],
  ['skipped-mismatch', `problem: upstream skips in ${COMP} cannot be bound to the inventory`],
]);
const COMPONENT_PROBLEMS = rules([
  ['infrastructure', `problem: infrastructure failure in ${COMP}(?::.*)?`],
  ['no-results', `problem: no results for ${COMP}`],
  ['records', `problem: (?:no inventory for|duplicate inventory titles in|unknown component|ledger title not in inventory for) ${COMP}(?::.*)?`],
  ['records', `problem: ${COMP}: (?:record removed|test inventory differs from the baseline although its vendored files are unchanged)`],
]);
// The script's own fixed failure messages; only the start of each is matched, so what follows (file names, details) is dropped.
const BLOCKED_RULES = [
  ['vendor-changed', /^vendored upstream files changed/],
  ['scratch', /^scratch not ignored/],
  ['library-build', /^library build failed/],
  ['runner-incomplete', /^runner did not complete/],
  ['results-missing', /^missing or stale results/],
  ['records-drift', /^blocked \(the component records differ from the baseline/],
  ['results-differ', /^blocked \(results differ from the component records/],
  ['internal', /^blocked; unexpected internal failure/],
];
const BENIGN = [/^[a-z][a-z0-9]*(?:-[a-z0-9]+)* \d+ passed, \d+ failed$/, /^passed \(/];
const TOTALS = /^total (\d{1,7}), passed (\d{1,7}), failed (\d{1,7}); /;
const PREFIX = 'test:upstream: ';
const squash = s => s.replace(/\s+/g, ' ').trim();
// A path-like title is never shown, whatever the inventory says: a backslash, or a slash that starts a path (at the start,
// after a space or quote, or after a home or parent marker). A slash between words ('focus/blur') is ordinary text.
const PATHY = /\\|(?:^|[\s'"`(=])\/|[~]\/|\.\.\//;

/** The title when it is safe to print: unchanged by redaction (no path, token, control character or flagged text). */
function shownTitle(inventory, component, title) {
  const list = inventory?.[component];
  if (!Array.isArray(list) || !list.includes(title)) return null;
  if (PATHY.test(title)) return null;
  const shown = redactLine(title);
  return shown === squash(title) && shown !== '' ? shown : null;
}

function classify(text) {
  for (const [word, re] of TITLED) { const m = re.exec(text); if (m) return { kind: 'test', word, component: m[1], title: m[2] }; }
  for (const [word, re] of UNTITLED) { const m = re.exec(text); if (m) return { kind: 'test', word, component: m[1], title: null }; }
  for (const [word, re] of COMPONENT_PROBLEMS) { const m = re.exec(text); if (m) return { kind: 'problem', word, component: m[1] }; }
  for (const [word, re] of BLOCKED_RULES) if (re.test(text)) return { kind: 'blocked', word };
  if (BENIGN.some(re => re.test(text))) return null;
  return { kind: 'problem', word: 'other', component: null };
}

/**
 * Summarizes the private log text of a failed `test:upstream` run. `inventory` is { component: [title] } (the vendored
 * records) and `catalog` a Set of catalog component names. Returns { lines, findings } where `lines` carry no prefix.
 */
export function summarizeUpstream(log, { inventory = {}, catalog = new Set() } = {}) {
  const found = [];
  let totals = null;
  for (const raw of String(log ?? '').split('\n')) {
    if (!raw.startsWith(PREFIX)) continue;
    const text = raw.slice(PREFIX.length).replace(/\r$/, '');
    const t = TOTALS.exec(text);
    if (t) { totals = { total: +t[1], passed: +t[2], failed: +t[3] }; continue; }
    const f = classify(text);
    if (f) found.push(f);
  }
  const name = c => (c !== null && catalog.has(c) ? c : 'unlisted component');
  const order = { blocked: 0, problem: 1, test: 2 };
  const key = f => (f.kind === 'test' ? OUTCOMES.indexOf(f.word) : f.kind === 'problem' ? PROBLEMS.indexOf(f.word) : BLOCKED.indexOf(f.word));
  const sorted = found.map((f, i) => ({ f, i })).sort((a, b) => order[a.f.kind] - order[b.f.kind] || key(a.f) - key(b.f) || a.i - b.i).map(x => x.f);
  const text = f => {
    if (f.kind === 'blocked') return `upstream blocked: ${f.word}`;
    if (f.kind === 'problem') return `upstream problem ${f.word}: ${name(f.component)}`;
    const title = f.title === null ? null : shownTitle(inventory, f.component, f.title);
    return `upstream ${f.word}: ${name(f.component)}: ${title ?? 'unlisted title'}`;
  };
  const lines = [];
  if (totals) lines.push(`upstream: total ${totals.total}, passed ${totals.passed}, failed ${totals.failed}`);
  if (!sorted.length) lines.push('upstream: no recognized result lines (details withheld)');
  for (const f of sorted.slice(0, MAX_FINDINGS)) lines.push(text(f));
  if (sorted.length > MAX_FINDINGS) lines.push(`upstream: +${sorted.length - MAX_FINDINGS} more`);
  return { lines, findings: sorted.length };
}
