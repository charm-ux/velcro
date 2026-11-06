import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const gate = new URL('../../scripts/ci-gate.mjs', import.meta.url);
const workflow = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
test('aggregate requires every named job and only successful results', () => {
  const inline = /node --input-type=module -e '([\s\S]*?)'/.exec(workflow)?.[1];
  assert.ok(inline, 'actual workflow aggregate must be testable');
  const run = value => {
    const options = { env: { ...process.env, VELCRO_CI_NEEDS: JSON.stringify(value) }, encoding: 'utf8' };
    const script = spawnSync(process.execPath, [gate.pathname], options).status;
    const actual = spawnSync(process.execPath, ['--input-type=module', '-e', inline], options).status;
    assert.equal(actual, script, 'workflow aggregate and local oracle diverged');
    return script;
  };
  const good = { verify: { result: 'success' }, product: { result: 'success' }, security: { result: 'success' } };
  assert.equal(run(good), 0);
  for (const job of ['verify', 'product', 'security']) {
    for (const result of ['failure', 'cancelled', 'skipped', 'pending', '', null, undefined]) {
      assert.equal(run({ ...good, [job]: { result } }), 1);
    }
    const { [job]: _omitted, ...missing } = good;
    assert.equal(run(missing), 1);
    assert.equal(run({ ...good, [job]: 'success' }), 1);
    assert.equal(run({ ...good, [job]: null }), 1);
  }
  assert.equal(run({ verify: { result: 'success' } }), 1);
  assert.equal(run([good.verify, good.product, good.security]), 1);
  assert.equal(run({}), 1);
  assert.equal(run({ ...good, extra: { result: 'success' } }), 1);
});

test('workflow is pinned, read-only, full-history and has an always-running aggregate', () => {
  const text = workflow;
  assert.match(text, /contents: read/);
  assert.match(text, /fetch-depth: 0/);
  assert.match(text, /persist-credentials: false/);
  assert.match(text, /if: \$\{\{ always\(\) \}\}/);
  assert.match(text, /needs: \[verify, product, security\]/);
  assert.match(text, /--frozen-lockfile/);
  assert.match(text, /registry\.npmjs\.org/);
  const job = /\n  product:\n([\s\S]*?)\n  required:/.exec(text)?.[1] ?? '';
  assert.match(job, /playwright install --with-deps chromium/);
  assert.match(job, /--frozen-lockfile/);
  assert.match(job, /pnpm verify:product/);
  assert.doesNotMatch(text, /\bpaths(-ignore)?:|\n {2}product:\n {4}if:/);
  assert.doesNotMatch(text, /firefox|webkit/i);
  assert.doesNotMatch(text, /upload-artifact|pull_request_target|secrets\./);
  assert.match(text, /Report protected changes requiring independent human review/);
  assert.doesNotMatch(text, /Block protected policy changes|continue-on-error/);
  for (const match of text.matchAll(/uses: (\S+)/g)) assert.match(match[1], /@[a-f0-9]{40}$/);
});

test('product step keeps all command output private and still blocks on failure', () => {
  const job = /\n  product:\n([\s\S]*?)\n  required:/.exec(workflow)?.[1] ?? '';
  const script = /- name: Product verification[^\n]*\n\s+run: \|\n((?:\s{10}.*\n?)+)/.exec(job)?.[1];
  assert.ok(script, 'actual product step must be testable');
  assert.doesNotMatch(script, /^\s*pnpm verify:product\s*$/m);
  for (const code of [0, 3]) {
    const dir = mkdtempSync(path.join(tmpdir(), 'velcro-ci-'));
    try {
      mkdirSync(path.join(dir, 'bin'));
      // Sensitive-looking text is generated at runtime, never committed.
      const secret = ['', 'home', 'u' + 'ser', 'work'].join('/');
      writeFileSync(path.join(dir, 'bin/pnpm'),
        `#!/bin/sh\necho "cwd ${secret}"\necho "SyntaxError at ${secret}/x.mjs:1" >&2\nexit ${code}\n`, { mode: 0o755 });
      const r = spawnSync('sh', ['-e', '-c', script], { cwd: dir, encoding: 'utf8',
        env: { ...process.env, PATH: `${path.join(dir, 'bin')}${path.delimiter}${process.env.PATH}` } });
      const out = `${r.stdout}${r.stderr}`;
      assert.equal(r.status, code === 0 ? 0 : 1);
      assert.equal(out.trim(), code === 0 ? 'product: passed' : 'product: blocked; private evidence retained');
      assert.match(readFileSync(path.join(dir, '.airig/ci/product.log'), 'utf8'), /SyntaxError/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});

// Evaluates the approval expression's GitHub Actions grammar subset exactly:
// `term && term ... || ''`, where a term is a context path or `a == b` / `a != b`
// over context paths and single-quoted literals. Comparison is case-insensitive
// and missing values are '' like GitHub's; anything else is rejected.
function evaluate(expression, context) {
  const value = token => {
    if (/^'[^']*'$/.test(token)) return token.slice(1, -1);
    assert.match(token, /^[a-z_]+(?:\.[a-z_]+)*$/i, 'unsupported expression token');
    return token.split('.').reduce((node, key) => (node == null ? undefined : node[key]), context) ?? '';
  };
  const term = text => {
    const comparison = /^(\S+) (==|!=) (\S+)$/.exec(text);
    if (!comparison) return value(text);
    const same = String(value(comparison[1])).toLowerCase() === String(value(comparison[3])).toLowerCase();
    return comparison[2] === '==' ? same : !same;
  };
  const alternatives = expression.split(' || ');
  assert.equal(alternatives.length, 2, 'unsupported expression shape');
  let result = true;
  for (const part of alternatives[0].split(' && ')) { result = term(part); if (!result) break; }
  return result || value(alternatives[1]);
}

test('security scans the published range and only the configured approver label approves its exact head', () => {
  const job = /\n  security:\n([\s\S]*?)\n  product:/.exec(workflow)?.[1] ?? '';
  const step = /- name: Trusted source and history scan\n([\s\S]*?)(?=\n {6}(?:#|- ))/.exec(job)?.[1] ?? '';
  assert.match(step, /BASE_OID: \$\{\{ github\.event\.pull_request\.base\.sha \|\| github\.event\.before \}\}/);
  assert.match(step, /HEAD_OID: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
  const approval = /VELCRO_HISTORY_APPROVED: \$\{\{ (.*) \}\}/.exec(step)?.[1] ?? '';
  assert.doesNotMatch(approval, /repository_owner/, 'an organization owner is never the labeling user');
  const head = 'c'.repeat(40);
  // An organization-owned repository: the owner login is the organization.
  const event = (overrides = {}) => ({
    event_name: 'pull_request', repository_owner: 'fixture-org',
    event: { action: 'labeled', label: { name: 'history-scan-approved' }, sender: { login: 'approver-fixture' },
      pull_request: { head: { sha: head } } },
    ...overrides,
  });
  const approver = { VELCRO_HISTORY_APPROVER: 'approver-fixture' };
  assert.equal(evaluate(approval, { github: event(), vars: approver }), head);
  const rejected = [
    { github: event(), vars: {} },
    { github: event(), vars: { VELCRO_HISTORY_APPROVER: '' } },
    { github: event({ event: { ...event().event, sender: { login: 'other-fixture' } } }), vars: approver },
    { github: event({ event: { ...event().event, sender: { login: 'fixture-org' } } }), vars: approver },
    { github: event({ event: { ...event().event, sender: { login: '' } } }), vars: { VELCRO_HISTORY_APPROVER: '' } },
    { github: event({ event: { ...event().event, action: 'synchronize' } }), vars: approver },
    { github: event({ event: { ...event().event, label: { name: 'history-scan-approved-later' } } }), vars: approver },
    { github: event({ event_name: 'push' }), vars: approver },
  ];
  for (const context of rejected) assert.equal(evaluate(approval, context), '', 'approval must stay empty');
  assert.match(workflow, /\n {2}pull_request:\n(?: {4}#.*\n)? {4}types: \[opened, synchronize, reopened, labeled\]\n/);
  assert.doesNotMatch(workflow, /git-privacy\.mjs history HEAD/);
  const script = /\n {8}run: \|\n((?: {10}.*\n?)+)/.exec(step)?.[1];
  assert.ok(script, 'actual history step must be testable');
  const dir = mkdtempSync(path.join(tmpdir(), 'velcro-ci-'));
  try {
    mkdirSync(path.join(dir, 'bin'));
    writeFileSync(path.join(dir, 'bin/node'), '#!/bin/sh\nprintf "%s\\n" "$*"\n', { mode: 0o755 });
    // `git merge-base --is-ancestor <base> refs/remotes/origin/main`, answered by the fixture.
    writeFileSync(path.join(dir, 'bin/git'), '#!/bin/sh\n[ "$1 $2 $4" = "merge-base --is-ancestor refs/remotes/origin/main" ] || exit 9\n[ "$3" = "$ANCESTOR" ]\n', { mode: 0o755 });
    const invoke = (base, ancestor = base) => spawnSync('sh', ['-e', '-c', script], { cwd: dir, encoding: 'utf8', env: { ...process.env,
      BASE_OID: base, HEAD_OID: head, ANCESTOR: ancestor, PATH: `${path.join(dir, 'bin')}${path.delimiter}${process.env.PATH}` } }).stdout.trim();
    const trusted = '.airig/trusted/scripts/security/git-privacy.mjs history';
    assert.equal(invoke('a'.repeat(40)), `${trusted} ${'a'.repeat(40)}..${head}`);
    // A base that is not the fetched main or its ancestor (PR into another branch, force push): full history.
    assert.equal(invoke('a'.repeat(40), 'none'), `${trusted} ${head}`);
    // No usable base (new branch, first push): full-history mode under the hard caps.
    assert.equal(invoke('0'.repeat(40)), `${trusted} ${head}`);
    assert.equal(invoke(''), `${trusted} ${head}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
