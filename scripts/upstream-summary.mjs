// Bounded, closed-vocabulary public summary of a failed upstream-conformance run (scripts/upstream-conformance.mjs).
// The raw runner output stays in ignored scratch; this reads only the `test:upstream: ` result lines of that private log and
// prints, per finding, a fixed outcome word and two names that are checked before they are shown: a component only if it
// is in the catalog, a test title only if it is exactly a title in that component's pinned (vendored) inventory and
// survives the same redaction as the browser summary. Anything else is the literal 'unlisted component' or 'unlisted title'.
// Every word printed is a constant from the tables below, chosen by which table row matched; none is sliced or echoed from
// the log. A line that matches no row is 'blocked: internal' and nothing of it is copied. Messages, reasons, values, stack
// traces, paths and file names are never copied. At most MAX_FINDINGS finding lines are printed, then a '+N more' count.
import { redactLine } from './product-summary.mjs';

export const MAX_FINDINGS = 20;
/** The longest test title that is printed. Higher than the browser summary's MAX_LINE, because a title is printed only when
 * it is exactly a pinned inventory title and some upstream titles (sl-breadcrumb's nested describes) run past 200
 * characters; a longer title is 'unlisted title' rather than cut, so a printed title is always the whole of it. */
export const MAX_TITLE = 300;
/** The public CI log keeps only the first PUBLIC_LINE characters of each line (the workflows' `substr($0, 1, 300)`), and
 * verify-product writes each summary line after PUBLIC_PREFIX. A finding whose whole public line would be longer names
 * its test as 'unlisted title' instead, so the workflow never cuts a printed title. */
export const PUBLIC_LINE = 300;
export const PUBLIC_PREFIX = 'verify:product: ';
/** The outcome of one test: failed (an inventoried test failed, not ledgered), unexpected (an outcome the records do not
 * expect: not in the inventory, repeated, a known failure that now passes or a new known failure), missing (an inventoried
 * test with no outcome) or skipped-mismatch (a skip upstream does not declare, or one it declares that was not reported). */
export const OUTCOMES = Object.freeze(['failed', 'unexpected', 'missing', 'skipped-mismatch']);
/** Component-level problems that carry no test title. */
export const PROBLEMS = Object.freeze(['infrastructure', 'no-results', 'records']);
/** Why the run was blocked before or after the tests (from the script's own fixed messages, never their details), or
 * 'internal' for any result line no table row matches. */
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
// Result lines of a run that carry nothing to report: a component's counts, the totals and the success line.
const BENIGN = [/^[a-z][a-z0-9]*(?:-[a-z0-9]+)* \d+ passed, \d+ failed$/, /^total \d+, passed \d+, failed \d+; /, /^passed \(/];
const PREFIX = 'test:upstream: ';
const squash = s => s.replace(/\s+/g, ' ').trim();
// A title shaped like a path is never shown, whatever the inventory says (the exact titles of PATH_TITLES_PRINTED below
// are the only exception): a backslash; a slash that starts a path (at the start or after anything that is not a letter,
// digit or underscore: a space, quote, bracket, colon, dot, tilde, ...); or two or more slashes (a relative path such as
// a/b/c). A single slash between words ('focus/blur') is ordinary text.
const PATHY = /\\|(?:^|\W)\/|\/.*\//;
/** Exact inventory titles that are printed although they are path-shaped. Each is a public Shoelace 2.20.1 test title,
 * vendored unchanged, that names one of Shoelace's own demo image paths ('docs/assets/images/walk.gif'), so it cannot be
 * renamed and PATHY alone would withhold it. Exact strings only, never a pattern: a title is printed through this list only
 * when it is character for character one of these (and still in the component's inventory and through the same redaction),
 * so a one-character variant, or any other title with two or more slashes, stays withheld. A test fails if an entry is not
 * a real inventory title or is not path-shaped. Adding one is a protected change. */
export const PATH_TITLES_PRINTED = Object.freeze([
  '<sl-animated-image> > should load a docs/assets/images/walk.gif without errors',
  '<sl-animated-image> > should play docs/assets/images/walk.gif on click',
  '<sl-animated-image> > should pause and resume docs/assets/images/walk.gif on click',
  '<sl-animated-image> > should load a docs/assets/images/tie.webp without errors',
  '<sl-animated-image> > should play docs/assets/images/tie.webp on click',
  '<sl-animated-image> > should pause and resume docs/assets/images/tie.webp on click',
]);
const PRINTED_PATH_TITLES = new Set(PATH_TITLES_PRINTED);

/** The title when it is safe to print: unchanged by redaction (no path, token, control character or flagged text). */
function shownTitle(inventory, component, title) {
  const list = inventory?.[component];
  if (!Array.isArray(list) || !list.includes(title)) return null;
  if (PATHY.test(title) && !PRINTED_PATH_TITLES.has(title)) return null;
  const shown = redactLine(title, undefined, MAX_TITLE);
  return shown === squash(title) && shown !== '' ? shown : null;
}

function classify(text) {
  for (const [word, re] of TITLED) { const m = re.exec(text); if (m) return { kind: 'test', word, component: m[1], title: m[2] }; }
  for (const [word, re] of UNTITLED) { const m = re.exec(text); if (m) return { kind: 'test', word, component: m[1], title: null }; }
  for (const [word, re] of COMPONENT_PROBLEMS) { const m = re.exec(text); if (m) return { kind: 'problem', word, component: m[1] }; }
  for (const [word, re] of BLOCKED_RULES) if (re.test(text)) return { kind: 'blocked', word };
  if (BENIGN.some(re => re.test(text))) return null;
  return { kind: 'blocked', word: 'internal' };
}

/**
 * Summarizes the private log text of a failed `test:upstream` run. `inventory` is { component: [title] } (the vendored
 * records) and `catalog` a Set of catalog component names. Returns { lines, findings } where `lines` carry no prefix.
 */
export function summarizeUpstream(log, { inventory = {}, catalog = new Set() } = {}) {
  const found = [];
  for (const raw of String(log ?? '').split('\n')) {
    if (!raw.startsWith(PREFIX)) continue;
    const f = classify(raw.slice(PREFIX.length).replace(/\r$/, ''));
    // A blocked word says all there is to say about it, so a repeat adds nothing.
    if (f && !(f.kind === 'blocked' && found.some(g => g.kind === 'blocked' && g.word === f.word))) found.push(f);
  }
  // A failed gate with nothing to report is itself unexpected: say so with the same fixed word.
  if (!found.length) found.push({ kind: 'blocked', word: 'internal' });
  const name = c => (catalog.has(c) ? c : 'unlisted component');
  const order = { blocked: 0, problem: 1, test: 2 };
  const key = f => (f.kind === 'test' ? OUTCOMES.indexOf(f.word) : f.kind === 'problem' ? PROBLEMS.indexOf(f.word) : BLOCKED.indexOf(f.word));
  const sorted = found.map((f, i) => ({ f, i })).sort((a, b) => order[a.f.kind] - order[b.f.kind] || key(a.f) - key(b.f) || a.i - b.i).map(x => x.f);
  const text = f => {
    if (f.kind === 'blocked') return `upstream blocked: ${f.word}`;
    if (f.kind === 'problem') return `upstream problem ${f.word}: ${name(f.component)}`;
    const title = f.title === null ? null : shownTitle(inventory, f.component, f.title);
    const line = `upstream ${f.word}: ${name(f.component)}: ${title ?? 'unlisted title'}`;
    return PUBLIC_PREFIX.length + line.length <= PUBLIC_LINE ? line : `upstream ${f.word}: ${name(f.component)}: unlisted title`;
  };
  const lines = [];
  for (const f of sorted.slice(0, MAX_FINDINGS)) lines.push(text(f));
  if (sorted.length > MAX_FINDINGS) lines.push(`upstream: +${sorted.length - MAX_FINDINGS} more`);
  return { lines, findings: sorted.length };
}
