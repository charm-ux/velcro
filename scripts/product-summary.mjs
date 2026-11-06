// Bounded, redacted public summary of a failed Playwright JSON report: engine counts and, per failing test, the engine, spec
// file and line, title and the failure category only. Error messages and their values never leave the private log.
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

export function redactLine(text, root) {
  let s = String(text ?? '').replace(ANSI, '').replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ');
  if (root) s = s.split(root).join('<repo>');
  s = s.replace(ABS_PATH, '<path>').replace(/\b[A-Za-z0-9_-]{32,}\b/g, '<token>').replace(/\s+/g, ' ').trim();
  if (s.length > MAX_LINE) s = `${s.slice(0, MAX_LINE - 3)}...`;
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

const firstLine = t => {
  const results = Array.isArray(t.results) ? t.results : [];
  for (const r of [...results].reverse()) {
    const message = r?.error?.message ?? r?.errors?.[0]?.message;
    if (typeof message === 'string') return category(message);
  }
  return 'no error recorded';
};

// Returns the summary lines (without the "verify:product:" prefix handling; the caller adds it).
export function summarizeReport(report, { root } = {}) {
  const tests = [];
  for (const s of Array.isArray(report?.suites) ? report.suites : []) walk(s, tests);
  const per = Object.fromEntries(ENGINES.map(e => [e, { passed: 0, failed: 0, flaky: 0, skipped: 0 }]));
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
  const lines = ENGINES.map(e => `${e} passed ${per[e].passed}, failed ${per[e].failed}, flaky ${per[e].flaky}, skipped ${per[e].skipped}`);
  // Skipped and interrupted tests (for example after the global timeout) are listed after the failures, by title only.
  bad.push(...skipped);
  const failingEngines = ENGINES.filter(e => per[e].failed || per[e].flaky);
  for (const { spec, test } of bad.slice(0, MAX_FAILURES)) {
    const where = `${redactLine(spec.file, root)}:${Number.isInteger(spec.line) ? spec.line : 0}`;
    lines.push(redactLine(`${test.projectName} ${where} ${spec.title} | ${test.status === 'skipped' ? 'skipped or interrupted' : firstLine(test)}`, root));
  }
  if (bad.length > MAX_FAILURES) lines.push(`... ${bad.length - MAX_FAILURES} more failing tests not listed`);
  return { lines, failingEngines };
}
