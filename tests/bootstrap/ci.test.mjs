import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const gate = new URL('../../scripts/ci-gate.mjs', import.meta.url);
const workflow = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
const product = readFileSync(new URL('../../.github/workflows/product.yml', import.meta.url), 'utf8');
// A job's body, up to the next job of the same file (comment lines between jobs are dropped first).
const jobOf = (text, name) => new RegExp(`\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [a-z-]+:\\n|$)`).exec(text.replace(/^ {2}#.*\n/gm, ''))?.[1] ?? '';
// The run script of a named step in a job body.
const stepRun = (body, name) => {
  const at = body.indexOf(`- name: ${name}`);
  return at < 0 ? undefined : /\brun: \|\n((?:\s{10}.*\n?)+)/.exec(body.slice(at))?.[1];
};
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
  const good = { verify: { result: 'success' }, product: { result: 'success' }, site: { result: 'success' }, security: { result: 'success' } };
  assert.equal(run(good), 0);
  for (const job of ['verify', 'product', 'site', 'security']) {
    for (const result of ['failure', 'cancelled', 'skipped', 'pending', '', null, undefined]) {
      assert.equal(run({ ...good, [job]: { result } }), 1);
    }
    const { [job]: _omitted, ...missing } = good;
    assert.equal(run(missing), 1);
    assert.equal(run({ ...good, [job]: 'success' }), 1);
    assert.equal(run({ ...good, [job]: null }), 1);
  }
  assert.equal(run({ verify: { result: 'success' } }), 1);
  assert.equal(run([good.verify, good.product, good.site, good.security]), 1);
  assert.equal(run({}), 1);
  assert.equal(run({ ...good, extra: { result: 'success' } }), 1);
});

test('workflow is pinned, read-only, full-history and has an always-running aggregate', () => {
  const text = workflow;
  assert.match(text, /contents: read/);
  assert.match(text, /fetch-depth: 0/);
  assert.match(text, /persist-credentials: false/);
  assert.match(text, /if: \$\{\{ always\(\) \}\}/);
  assert.match(text, /needs: \[verify, product, site, security\]/);
  assert.match(text, /--frozen-lockfile/);
  assert.match(text, /registry\.npmjs\.org/);
  assert.match(jobOf(text, 'product'), /^ {4}uses: \.\/\.github\/workflows\/product\.yml\n {4}with:\n {6}ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}$/m);
  assert.doesNotMatch(text, /\bpaths(-ignore)?:|\n {2}product:\n {4}if:/);
  assert.doesNotMatch(text, /upload-artifact|pull_request_target|secrets\./);
  assert.match(text, /Report protected changes requiring independent human review/);
  assert.doesNotMatch(text, /Block protected policy changes|continue-on-error/);
  for (const match of text.matchAll(/uses: (\S+)/g)) assert.match(match[1], /^(?:\.\/\.github\/workflows\/product\.yml|[\w.-]+\/[\w.-]+@[a-f0-9]{40})$/);
});

test('product workflow: one build, every engine in N shards (1..N), the upstream gate, all on the build digest', () => {
  const text = product;
  assert.match(text, /^on:\n {2}workflow_call:\n/m);
  assert.doesNotMatch(text, /^ {2}(?:push|pull_request|pull_request_target|workflow_dispatch|schedule):/m, 'reusable only');
  assert.match(text, /\npermissions:\n {2}contents: read\n/);
  assert.doesNotMatch(text, /: write|id-token|secrets\.|continue-on-error|\|\| true/);
  for (const match of text.matchAll(/uses: (\S+)/g)) assert.match(match[1], /^[\w.-]+\/[\w.-]+@[a-f0-9]{40}$/, match[1]);
  const jobs = [...text.replace(/^ {2}#.*\n/gm, '').matchAll(/\n {2}([a-z-]+):\n/g)].map(m => m[1]);
  assert.deepEqual(jobs, ['build', 'browser', 'upstream']);
  for (const name of jobs) {
    const body = jobOf(text, name);
    assert.doesNotMatch(body, /^ {4}if:/m, `${name} is never skipped`);
    assert.match(body, /ref: \$\{\{ inputs\.ref \}\}\n\s+persist-credentials: false/);
    assert.match(body, /pnpm install --frozen-lockfile --prefer-offline --registry=https:\/\/registry\.npmjs\.org\//);
    assert.match(body, /uses: actions\/cache@[a-f0-9]{40}\n\s+with:\n\s+path: \$\{\{ steps\.pnpm-store\.outputs\.path \}\}\n\s+key: pnpm-store-\$\{\{ runner\.os \}\}-\$\{\{ hashFiles\('pnpm-lock\.yaml'\) \}\}/);
  }
  const build = jobOf(text, 'build');
  const browser = jobOf(text, 'browser');
  const upstream = jobOf(text, 'upstream');
  // Build once: the build stage, its digest as the job output, the scan, then the single upload of the output.
  assert.match(text, /outputs:\n {6}digest:\n {8}description: [^\n]+\n {8}value: \$\{\{ jobs\.build\.outputs\.digest \}\}/);
  assert.match(build, /outputs:\n {6}digest: \$\{\{ steps\.build\.outputs\.digest \}\}/);
  const at = s => build.indexOf(s);
  assert.ok(at('pnpm verify:product --stage build') > 0);
  assert.ok(at('pnpm verify:product --stage build') < at('node scripts/ci/scan-build-output.mjs'));
  assert.ok(at('node scripts/ci/scan-build-output.mjs') < at('actions/upload-artifact@'));
  // The scan checks the build digest and stages exactly the scanned bytes; only that staging tree is uploaded.
  assert.match(build, /env:\n\s+DIGEST: \$\{\{ steps\.build\.outputs\.digest \}\}\n\s+run: node scripts\/ci\/scan-build-output\.mjs --expect-digest "\$DIGEST"\n/);
  assert.equal([...text.matchAll(/upload-artifact|upload-pages/g)].length, 1, 'only the build job uploads, once');
  assert.match(build, /name: product-build\n\s+path: \.airig\/ci\/product-build\n\s+if-no-files-found: error\n\s+include-hidden-files: true\n\s+retention-days: 1\n/);
  // Every later job downloads that output and checks the build digest; nothing rebuilds it.
  for (const [name, body] of [['browser', browser], ['upstream', upstream]]) {
    assert.match(body, /needs: build\n/);
    assert.match(body, /uses: actions\/download-artifact@[a-f0-9]{40}\n\s+with:\n\s+name: product-build\n\s+path: packages\n/);
    assert.match(body, /DIGEST: \$\{\{ needs\.build\.outputs\.digest \}\}/);
    assert.match(body, /--expect-digest "\$DIGEST"/);
    assert.doesNotMatch(body, /--stage build|run build|build:prefixed|scan-build-output/, `${name} never rebuilds`);
  }
  // The matrix covers each engine once and shards 1..N of the same N the shard argument uses; no leg is dropped early.
  const matrix = /strategy:\n {6}fail-fast: false\n {6}matrix:\n {8}engine: \[([^\]]*)\]\n {8}shard: \[([^\]]*)\]\n/.exec(browser);
  assert.ok(matrix, 'fail-fast off, exactly the engine and shard axes');
  assert.deepEqual(matrix[1].split(', '), ['chromium', 'firefox', 'webkit']);
  const shards = matrix[2].split(', ').map(Number);
  const total = Number(/SHARD: \$\{\{ matrix\.shard \}\}\/(\d+)\n/.exec(browser)?.[1]);
  assert.deepEqual(shards, Array.from({ length: total }, (_, i) => i + 1));
  // Four shards per engine keep each shard's test step within about four minutes on the hosted runners.
  assert.equal(total, 4);
  assert.match(browser, new RegExp(`name: browser \\(\\$\\{\\{ matrix\\.engine \\}\\}, shard \\$\\{\\{ matrix\\.shard \\}\\} of ${total}\\)`));
  assert.doesNotMatch(browser, /include:|exclude:/);
  assert.match(browser, /pnpm verify:product --stage browser --engine "\$ENGINE" --shard "\$SHARD" --expect-digest "\$DIGEST"/);
  assert.match(browser, /ENGINE: \$\{\{ matrix\.engine \}\}/);
  assert.match(browser, /key: playwright-\$\{\{ runner\.os \}\}-\$\{\{ matrix\.engine \}\}-\$\{\{ hashFiles\('pnpm-lock\.yaml'\) \}\}/);
  assert.match(upstream, /pnpm verify:product --stage upstream --expect-digest "\$DIGEST"/);
  assert.match(upstream, /key: playwright-\$\{\{ runner\.os \}\}-chromium-\$\{\{ hashFiles\('pnpm-lock\.yaml'\) \}\}/);
  for (const body of [browser, upstream]) {
    assert.match(body, /^ {4}env:\n {6}PLAYWRIGHT_BROWSERS_PATH: \$\{\{ github\.workspace \}\}\/\.airig\/ms-playwright\n/m);
    assert.match(body, /uses: actions\/cache@[a-f0-9]{40}\n\s+with:\n\s+path: \.airig\/ms-playwright\n/);
    assert.match(body, /DEBIAN_FRONTEND: noninteractive/);
    assert.equal([...body.matchAll(/timeout-minutes: 12/g)].length, 2, 'each browser install step is bounded');
    assert.match(body, /Acquire::Retries "5"[\s\S]*Acquire::http::Timeout "30"[\s\S]*Acquire::https::Timeout "30"/);
    assert.match(body, /80-velcro-ci/);
    assert.match(body, /for attempt in 1 2; do\n\s+code=0\n\s+timeout -k 10 330 pnpm exec playwright install-deps "\$ENGINE"/);
    assert.equal([...body.matchAll(/timeout -k 10 480 pnpm exec playwright install "\$ENGINE"/g)].length, 1);
  }
});

test('CI records evidence only after every product job, then checks site preparation without uploading', () => {
  const site = jobOf(workflow, 'site');
  assert.match(site, /^ {4}needs: product\n/m);
  assert.doesNotMatch(site, /^ {4}if:/m);
  const at = s => site.indexOf(s);
  assert.ok(at('actions/download-artifact@') > 0);
  assert.match(site, /DIGEST: \$\{\{ needs\.product\.outputs\.digest \}\}/);
  assert.ok(at('actions/download-artifact@') < at('pnpm verify:product --stage evidence --expect-digest "$DIGEST"'));
  assert.ok(at('pnpm verify:product --stage evidence') < at('scripts/site/prepare.mjs'));
  assert.doesNotMatch(site, /--stage build|run build|build:prefixed/, 'no rebuild between the browser checks and preparation');
});

const stepCases = [
  ['browser verification', jobOf(product, 'browser'), 'Product verification (one engine, one shard)', 'product', 'product.log', 'verify:product: webkit passed 1\n'],
  ['upstream gate', jobOf(product, 'upstream'), "Upstream conformance (Shoelace's own tests against the built library)", 'upstream', 'upstream.log', 'verify:product: webkit passed 1\n'],
  ['CI evidence', jobOf(workflow, 'site'), 'Record the tested-bytes evidence', 'evidence', 'evidence.log', 'verify:product: webkit passed 1\n'],
];
for (const [label, body, name, prefix, log, published] of stepCases) {
  test(`${label} step keeps all command output private and still blocks on failure`, () => {
    const script = stepRun(body, name);
    assert.ok(script, 'actual step must be testable');
    assert.doesNotMatch(script, /^\s*pnpm verify:product\s*$/m);
    for (const code of [0, 3]) {
      const dir = mkdtempSync(path.join(tmpdir(), 'velcro-ci-'));
      try {
        mkdirSync(path.join(dir, 'bin'));
        mkdirSync(path.join(dir, '.airig/ci'), { recursive: true });
        // Sensitive-looking text is generated at runtime, never committed.
        const secret = ['', 'home', 'u' + 'ser', 'work'].join('/');
        writeFileSync(path.join(dir, 'bin/pnpm'),
          `#!/bin/sh\necho "cwd ${secret}"\necho "verify:product: webkit passed 1"\necho "SyntaxError at ${secret}/x.mjs:1" >&2\nexit ${code}\n`, { mode: 0o755 });
        const r = spawnSync('sh', ['-e', '-c', script], { cwd: dir, encoding: 'utf8',
          env: { ...process.env, ENGINE: 'webkit', SHARD: '1/4', DIGEST: 'a'.repeat(64), PATH: `${path.join(dir, 'bin')}${path.delimiter}${process.env.PATH}` } });
        const out = `${r.stdout}${r.stderr}`;
        assert.equal(r.status, code === 0 ? 0 : 1);
        assert.equal(out.trim(), code === 0 ? `${prefix}: passed` : `${published}${prefix}: blocked; private evidence retained`);
        assert.match(readFileSync(path.join(dir, '.airig/ci', log), 'utf8'), /SyntaxError/);
      } finally { rmSync(dir, { recursive: true, force: true }); }
    }
  });
}

test('build step publishes only the digest, keeps all command output private and blocks on failure or a missing digest', () => {
  const script = stepRun(jobOf(product, 'build'), 'Build the library and the docs once');
  assert.ok(script, 'actual build step must be testable');
  const digest = 'b'.repeat(64);
  for (const [code, digestLine, status, expected] of [
    [0, `verify:product: build digest ${digest}`, 0, `product build: passed (build digest ${digest})`],
    [0, 'verify:product: build digest short', 1, 'product build: blocked (no build digest)'],
    [0, `verify:product: tested digest ${digest}`, 1, 'product build: blocked (no build digest)'],
    [3, '', 1, 'verify:product: webkit passed 1\nproduct build: blocked; private evidence retained'],
  ]) {
    const dir = mkdtempSync(path.join(tmpdir(), 'velcro-ci-'));
    try {
      mkdirSync(path.join(dir, 'bin'));
      const secret = ['', 'home', 'u' + 'ser', 'work'].join('/');
      writeFileSync(path.join(dir, 'bin/pnpm'),
        `#!/bin/sh\necho "cwd ${secret}"\necho "verify:product: webkit passed 1"\necho "${digestLine}"\necho "SyntaxError at ${secret}/x.mjs:1" >&2\nexit ${code}\n`, { mode: 0o755 });
      const r = spawnSync('sh', ['-e', '-c', script], { cwd: dir, encoding: 'utf8',
        env: { ...process.env, GITHUB_OUTPUT: path.join(dir, 'output'), PATH: `${path.join(dir, 'bin')}${path.delimiter}${process.env.PATH}` } });
      const out = `${r.stdout}${r.stderr}`;
      assert.equal(r.status, status, out);
      assert.equal(out.trim(), expected);
      const output = (() => { try { return readFileSync(path.join(dir, 'output'), 'utf8'); } catch { return ''; } })();
      assert.equal(output, status === 0 ? `digest=${digest}\n` : '');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});

// The install steps of the product jobs, run for real against stand-in commands. Raw installer output (which can carry
// runner paths, URLs and package-manager stacks) must stay in the private log; only fixed status lines may be printed.
for (const file of ['browser', 'upstream']) {
  const body = jobOf(product, file);
  const stepScript = name => {
    const script = stepRun(body, name);
    assert.ok(script, `${file}: ${name}`);
    return script;
  };
  const deps = stepScript('Install system dependencies for the engine (disposable runner)');
  const browsers = stepScript('Install the engine (disposable runner; a no-op on a cache hit)');
  // Stand-ins: sudo swallows its input, apt-config names a directory, timeout passes the command through, and pnpm prints
  // runtime-generated sensitive-looking text to both streams, then behaves as scripted (exit codes per call in $PNPM_CODES).
  const run = (script, codes) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'velcro-install-'));
    try {
      mkdirSync(path.join(dir, 'bin'));
      const secret = ['', 'home', 'u' + 'ser', 'work'].join('/') + '/' + ['tok', Math.random().toString(36).slice(2, 10)].join('-');
      const put = (name, body) => writeFileSync(path.join(dir, 'bin', name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
      put('sudo', 'cat > sink');
      put('apt-config', `echo "d='${dir}/apt/'"`);
      put('timeout', 'if [ "$1" = "-k" ]; then shift 2; fi; shift; "$@"');
      writeFileSync(path.join(dir, 'codes'), codes.join('\n') + '\n');
      put('pnpm', ['n=$([ -f count ] && cat count || echo 0); n=$((n+1)); echo $n > count', `echo "raw ${secret}"`, `echo "stack ${secret}" >&2`, 'code=$(sed -n "${n}p" codes)', 'exit ${code:-0}'].join('\n'));
      const r = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', script], { cwd: dir, encoding: 'utf8',
        env: { ...process.env, ENGINE: 'webkit', PATH: `${path.join(dir, 'bin')}${path.delimiter}${process.env.PATH}` } });
      const out = `${r.stdout}${r.stderr}`;
      assert.doesNotMatch(out, new RegExp(secret.replaceAll(/[.*+?^${}()|[\]\\/]/g, '\\$&')), 'raw installer output leaked');
      assert.doesNotMatch(out, /\braw\b|\bstack\b/);
      return { status: r.status, out: out.trim() };
    } finally { rmSync(dir, { recursive: true, force: true }); }
  };
  test(`${file}: dependency install prints only fixed status lines (success, retry, exit code, timeout)`, () => {
    assert.deepEqual(run(deps, [0]), { status: 0, out: 'browser system dependencies: passed' });
    assert.deepEqual(run(deps, [1, 0]), { status: 0, out: 'browser system dependencies: attempt 1 failed (exit code 1)\nbrowser system dependencies: passed' });
    assert.deepEqual(run(deps, [1, 100]), { status: 1, out: 'browser system dependencies: attempt 1 failed (exit code 1)\nbrowser system dependencies: attempt 2 failed (exit code 100)\nbrowser system dependencies: blocked; private evidence retained' });
    assert.deepEqual(run(deps, [124, 137]), { status: 1, out: 'browser system dependencies: attempt 1 timed out\nbrowser system dependencies: attempt 2 timed out\nbrowser system dependencies: blocked; private evidence retained' });
  });
  test(`${file}: browser install prints only fixed status lines (success, exit code, timeout)`, () => {
    assert.deepEqual(run(browsers, [0]), { status: 0, out: 'browser setup: passed' });
    assert.deepEqual(run(browsers, [2]), { status: 1, out: 'browser setup: failed (exit code 2)\nbrowser setup: blocked; private evidence retained' });
    assert.deepEqual(run(browsers, [124]), { status: 1, out: 'browser setup: timed out\nbrowser setup: blocked; private evidence retained' });
  });
}

// Budget order for the browser run: Playwright's global timeout < the wrapper's kill of the browser step < the CI step bound < the job.
test('product timeouts are ordered: global timeout < wrapper bound < step bound < job bound', () => {
  const minutes = (text, re) => Number(re.exec(text)?.[1]);
  const config = readFileSync(new URL('../product/playwright.config.mjs', import.meta.url), 'utf8');
  const wrapper = readFileSync(new URL('../../scripts/verify-product.mjs', import.meta.url), 'utf8');
  const global = minutes(config, /globalTimeout: (\d+) \* 60 \* 1000/);
  const kill = minutes(wrapper, /(\d+) \* 60 \* 1000\);/);
  const browser = jobOf(product, 'browser');
  const step = minutes(browser, /- name: Product verification[^\n]*\n\s+timeout-minutes: (\d+)/);
  const job = minutes(browser, /^ {4}timeout-minutes: (\d+)/m);
  assert.ok(global < kill && kill < step && step < job, `${global} < ${kill} < ${step} < ${job}`);
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
  // edited: retargeting a PR's base re-runs every job against the new base.
  assert.match(workflow, /\n {2}pull_request:\n(?: {4}#.*\n)* {4}types: \[opened, synchronize, reopened, labeled, edited\]\n/);
  assert.doesNotMatch(workflow, /github\.event\.action (?:==|!=) 'edited'|github\.event\.changes/, 'no job may be skipped on edits');
  assert.doesNotMatch(workflow, /git-privacy\.mjs history HEAD/);
  const script = /\n {8}run: \|\n((?: {10}.*\n?)+)/.exec(step)?.[1];
  assert.ok(script, 'actual history step must be testable');
  const dir = mkdtempSync(path.join(tmpdir(), 'velcro-ci-'));
  try {
    mkdirSync(path.join(dir, 'bin'));
    writeFileSync(path.join(dir, 'bin/node'), '#!/bin/sh\nprintf "%s\\n" "$*"\n', { mode: 0o755 });
    // `git rev-parse` of the fetched main and `git merge-base --is-ancestor <base> refs/remotes/origin/main`.
    writeFileSync(path.join(dir, 'bin/git'), [
      '#!/bin/sh',
      'if [ "$*" = "rev-parse --verify refs/remotes/origin/main^{commit}" ]; then echo "$MAIN"; exit 0; fi',
      '[ "$1 $2 $4" = "merge-base --is-ancestor refs/remotes/origin/main" ] || exit 9',
      '[ "$3" = "$ANCESTOR" ]', '',
    ].join('\n'), { mode: 0o755 });
    const main = 'd'.repeat(40);
    const invoke = (event, base, ancestor = base) => spawnSync('sh', ['-e', '-c', script], { cwd: dir, encoding: 'utf8', env: { ...process.env,
      EVENT_NAME: event, BASE_OID: base, HEAD_OID: head, ANCESTOR: ancestor, MAIN: main,
      PATH: `${path.join(dir, 'bin')}${path.delimiter}${process.env.PATH}` } }).stdout.trim().split('\n');
    const trusted = '.airig/trusted/scripts/security/git-privacy.mjs history';
    const budget = `${trusted} ${main}..${head}`;
    assert.deepEqual(invoke('push', 'a'.repeat(40)), [`${trusted} ${'a'.repeat(40)}..${head}`]);
    // No usable base (new branch, first push, force push): full-history mode under the hard caps.
    assert.deepEqual(invoke('push', '0'.repeat(40)), [`${trusted} ${head}`]);
    assert.deepEqual(invoke('push', ''), [`${trusted} ${head}`]);
    assert.deepEqual(invoke('push', 'a'.repeat(40), 'none'), [`${trusted} ${head}`]);
    // Every PR meets the budget against the fetched main first, whatever its event base.
    assert.deepEqual(invoke('pull_request', 'a'.repeat(40)), [budget, `${trusted} ${'a'.repeat(40)}..${head}`]);
    assert.deepEqual(invoke('pull_request', 'e'.repeat(40), 'none'), [budget, `${trusted} ${head}`]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
