// Bounded, redacted public summary of a failed Playwright JSON report: engine counts and, per failing test, the engine, spec
// file and line, title, the failure category and the line of the failing assertion when it is in that same spec file; for a
// test timeout whose pending call is in a spec helper, an extra line with the helper's path under tests/product/support and
// its line. Error messages and their values never leave the private log.
import path from 'node:path';
import { scanText } from './security/privacy.mjs';

export const MAX_FAILURES = 40;
export const MAX_LINE = 200;
const ENGINES = ['chromium', 'firefox', 'webkit'];
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;
// Absolute filesystem paths (POSIX and Windows); web routes such as /components/button are left alone.
const ABS_PATH = /(?:[A-Za-z]:\\[^\s'"`)\]]*|\/(?:Users|home|root|var|tmp|private|opt|runner|workspace|mnt|etc|usr|proc|snap|Library)\/[^\s'"`)\]]*)/g;

function walk(suite, out) {
  for (const spec of suite?.specs ?? []) for (const test of spec.tests ?? []) out.push({ spec, test });
  for (const child of suite?.suites ?? []) walk(child, out);
}

export function redactLine(text, root, maxLine = MAX_LINE) {
  let s = String(text ?? '').replace(ANSI, '').replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ');
  if (root) s = s.split(root).join('<repo>');
  s = s.replace(ABS_PATH, '<path>').replace(/\b[A-Za-z0-9_-]{32,}\b/g, '<token>').replace(/\s+/g, ' ').trim();
  if (s.length > maxLine) s = `${s.slice(0, maxLine - 3)}...`;
  try { if (scanText(s, 'summary.txt').length) return '[redacted]'; } catch { return '[redacted]'; }
  return s;
}

// Safe assertion metadata only: the matcher name or the error class, never a message, value, diff, locator or page content.
const MATCHER = /^Error: expect\((?:received|locator|page|response)\)\.((?:not\.)?[A-Za-z]+)\(/;
const NAMED = /^([A-Z][A-Za-z]*(?:Error|Exception))\b/;
function category(message) {
  const text = message.replace(ANSI, '').split('\n').map(l => l.trim()).find(Boolean) ?? '';
  const matcher = MATCHER.exec(text);
  if (matcher) return `matcher ${matcher[1]}`;
  if (/^Test timeout of \d+ms exceeded/.test(text)) return 'test timeout';
  if (/^(?:Error: )?expect\(/.test(text)) return 'assertion';
  const named = NAMED.exec(text.replace(/^Error: /, '')) ?? NAMED.exec(text);
  if (named) return `error ${named[1]}`;
  if (/^Error\b/.test(text)) return 'error Error';
  return 'failure';
}

// The failing line, only for a location in the test's own spec file (a repository file named by its base name): the first
// error's own location, else the first later error's (a test timeout's first error has none; a later one names the call
// that was still pending).
const base = file => String(file ?? '').split(/[\\/]/).pop();
const inSpec = (loc, specFile) => loc && Number.isInteger(loc.line) && loc.line > 0 && base(specFile) && base(loc.file) === base(specFile);
const atLine = (errors, specFile) => {
  const loc = errors.map(e => e?.location).find(l => inSpec(l, specFile));
  return loc ? `, line ${loc.line}` : '';
};
const firstLine = (t, specFile) => {
  const results = Array.isArray(t.results) ? t.results : [];
  for (const r of [...results].reverse()) {
    const errors = [r?.error, ...(Array.isArray(r?.errors) ? r.errors : [])].filter(Boolean);
    if (typeof errors[0]?.message === 'string') return `${category(errors[0].message)}${atLine(errors, specFile)}`;
  }
  return 'no error recorded';
};

// A test timeout whose pending call is in a product spec helper (tests/product/support) has no line in its spec file. The
// helper's repository-relative path and line are reported on an extra line: the path only when, relative to the checkout
// root, it is a plain file name directly in tests/product/support, and nothing of the source or of any value.
const SUPPORT_FILE = /^tests\/product\/support\/[a-z0-9][a-z0-9-]*\.mjs$/;
const supportLine = (t, root) => {
  if (!root) return null;
  const results = Array.isArray(t.results) ? t.results : [];
  for (const r of [...results].reverse()) {
    const errors = [r?.error, ...(Array.isArray(r?.errors) ? r.errors : [])].filter(Boolean);
    if (typeof errors[0]?.message !== 'string') continue;
    if (category(errors[0].message) !== 'test timeout') return null;
    for (const loc of errors.map(e => e?.location)) {
      if (!loc || typeof loc.file !== 'string' || !Number.isInteger(loc.line) || loc.line <= 0) continue;
      const relative = path.relative(root, loc.file).split(path.sep).join('/');
      if (SUPPORT_FILE.test(relative)) return `${relative}:${loc.line}`;
    }
    return null;
  }
  return null;
};

// Returns the summary lines (without the "verify:product:" prefix handling; the caller adds it).
export function summarizeReport(report, { root, engines = ENGINES } = {}) {
  const tests = [];
  for (const s of Array.isArray(report?.suites) ? report.suites : []) walk(s, tests);
  const per = Object.fromEntries(engines.map(e => [e, { passed: 0, failed: 0, flaky: 0, skipped: 0 }]));
  const bad = [];
  const skipped = [];
  for (const { spec, test } of tests) {
    const e = per[test.projectName];
    if (!e) continue;
    if (test.status === 'expected') e.passed++;
    else if (test.status === 'skipped') { e.skipped++; skipped.push({ spec, test }); }
    else if (test.status === 'flaky') { e.flaky++; bad.push({ spec, test }); }
    else { e.failed++; bad.push({ spec, test }); }
  }
  const lines = engines.map(e => `${e} passed ${per[e].passed}, failed ${per[e].failed}, flaky ${per[e].flaky}, skipped ${per[e].skipped}`);
  // Skipped and interrupted tests (for example after the global timeout) are listed after the failures, by title only.
  bad.push(...skipped);
  const failingEngines = engines.filter(e => per[e].failed || per[e].flaky);
  for (const { spec, test } of bad.slice(0, MAX_FAILURES)) {
    const where = `${redactLine(spec.file, root)}:${Number.isInteger(spec.line) ? spec.line : 0}`;
    const first = test.status === 'skipped' ? 'skipped or interrupted' : firstLine(test, spec.file);
    lines.push(redactLine(`${test.projectName} ${where} ${spec.title} | ${first}`, root));
    const support = first === 'test timeout' ? supportLine(test, root) : null;
    if (support) lines.push(redactLine(`${test.projectName} ${support} | pending call of the test timeout above`, root));
  }
  if (bad.length > MAX_FAILURES) lines.push(`... ${bad.length - MAX_FAILURES} more failing tests not listed`);
  return { lines, failingEngines };
}
