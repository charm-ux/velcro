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
  assert.match(job, /playwright install-deps chromium firefox webkit/);
  assert.match(job, /playwright install chromium firefox webkit/);
  assert.match(job, /DEBIAN_FRONTEND: noninteractive/);
  assert.equal([...job.matchAll(/timeout-minutes: 12/g)].length, 2, 'each browser install step is bounded');
  assert.match(job, /Acquire::Retries "5"[\s\S]*Acquire::http::Timeout "30"[\s\S]*Acquire::https::Timeout "30"/);
  assert.match(job, /80-velcro-ci/);
  assert.match(job, /for attempt in 1 2; do\n\s+code=0\n\s+timeout -k 10 330 pnpm exec playwright install-deps chromium firefox webkit/);
  assert.equal([...job.matchAll(/timeout -k 10 480 pnpm exec playwright install chromium/g)].length, 1);
  assert.match(job, /--frozen-lockfile/);
  assert.match(job, /pnpm verify:product/);
  assert.doesNotMatch(text, /\bpaths(-ignore)?:|\n {2}product:\n {4}if:/);
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
        `#!/bin/sh\necho "cwd ${secret}"\necho "verify:product: webkit passed 1"\necho "SyntaxError at ${secret}/x.mjs:1" >&2\nexit ${code}\n`, { mode: 0o755 });
      const r = spawnSync('sh', ['-e', '-c', script], { cwd: dir, encoding: 'utf8',
        env: { ...process.env, PATH: `${path.join(dir, 'bin')}${path.delimiter}${process.env.PATH}` } });
      const out = `${r.stdout}${r.stderr}`;
      assert.equal(r.status, code === 0 ? 0 : 1);
      assert.equal(out.trim(), code === 0 ? 'product: passed' : 'verify:product: webkit passed 1\nproduct: blocked; private evidence retained');
      assert.match(readFileSync(path.join(dir, '.airig/ci/product.log'), 'utf8'), /SyntaxError/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});

// The install steps of both workflows, run for real against stand-in commands. Raw installer output (which can carry runner
// paths, URLs and package-manager stacks) must stay in the private log; only fixed status lines may be printed.
for (const file of ['ci.yml', 'pages.yml']) {
  const text = readFileSync(new URL(`../../.github/workflows/${file}`, import.meta.url), 'utf8');
  const stepScript = name => {
    const at = text.indexOf(`- name: ${name}`);
    assert.ok(at > 0, `${file}: ${name}`);
    return /\brun: \|\n((?:\s{10}.*\n?)+)/.exec(text.slice(at))?.[1];
  };
  const deps = stepScript('Install system dependencies for Chromium, Firefox and WebKit (disposable runner)');
  const browsers = stepScript('Install Chromium, Firefox and WebKit (disposable runner)');
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
        env: { ...process.env, PATH: `${path.join(dir, 'bin')}${path.delimiter}${process.env.PATH}` } });
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
