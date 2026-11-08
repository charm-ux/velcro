import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// Private scratch names are assembled at runtime so no literal workstation-style path sits in the source.
const AIRIG = ['', 'airig'].join('.');
const text = readFileSync(new URL('../../.github/workflows/pages.yml', import.meta.url), 'utf8');
const ci = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
const code = text.replace(/^\s*#.*$/gm, '');
const job = name => new RegExp(`\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [a-z-]+:\\n|$)`).exec(code)?.[1] ?? '';
const checks = job('checks');
const product = job('product');
const build = job('build');
const deploy = job('deploy');

const EXACT_TRIGGERS = 'push:\n    branches:\n      - main\n  workflow_dispatch:';
const triggerProblems = source => {
  const found = [...source.matchAll(/^on:\n((?: {2}.*\n)+)/gm)][0]?.[1].trimEnd().replace(/^ {2}/, '');
  const problems = [];
  if (found !== EXACT_TRIGGERS) problems.push('trigger set is not exactly push to main + workflow_dispatch');
  if (/pull_request|schedule:|workflow_run|repository_dispatch|inputs:|tags:|paths(-ignore)?:|branches-ignore:|github\.event\.(?:inputs|pull_request)|github\.head_ref/.test(source)) {
    problems.push('forbidden trigger, filter or input');
  }
  if (/secrets\.|PERSONAL|\bPAT\b|GH_TOKEN|GITHUB_TOKEN:/.test(source)) problems.push('secret or token');
  return problems;
};

test('triggers are exactly push to main (no filters) plus manual dispatch; no PR, schedule, input or secret', () => {
  assert.deepEqual(triggerProblems(code), []);
});

test('the trigger check rejects forbidden variants', () => {
  const mutate = to => code.replace(/^on:\n(?: {2}.*\n)+/m, `on:\n${to}\n`);
  const variants = {
    'a pull_request trigger': `  ${EXACT_TRIGGERS}\n  pull_request:`,
    'a pull_request_target trigger': `  ${EXACT_TRIGGERS}\n  pull_request_target:`,
    'a branches wildcard': '  push:\n    branches:\n      - "*"\n  workflow_dispatch:',
    'a double-star branches wildcard': '  push:\n    branches:\n      - "**"\n  workflow_dispatch:',
    'push to another branch': '  push:\n    branches:\n      - release\n  workflow_dispatch:',
    'push to main and another branch': '  push:\n    branches:\n      - main\n      - dev\n  workflow_dispatch:',
    'push without a branch filter': '  push:\n  workflow_dispatch:',
    'a push tags trigger': '  push:\n    branches:\n      - main\n    tags:\n      - v*\n  workflow_dispatch:',
    'a paths filter': '  push:\n    branches:\n      - main\n    paths:\n      - docs/**\n  workflow_dispatch:',
    'a schedule': `  ${EXACT_TRIGGERS}\n  schedule:\n    - cron: "0 0 * * *"`,
    'workflow_run': `  ${EXACT_TRIGGERS}\n  workflow_run:`,
    'repository_dispatch': `  ${EXACT_TRIGGERS}\n  repository_dispatch:`,
    'a dispatch input': '  push:\n    branches:\n      - main\n  workflow_dispatch:\n    inputs:\n      ref:',
    'no manual dispatch': '  push:\n    branches:\n      - main',
    'only a manual dispatch': '  workflow_dispatch:',
  };
  for (const [name, to] of Object.entries(variants)) assert.notDeepEqual(triggerProblems(mutate(to)), [], name);
  assert.notDeepEqual(triggerProblems(`${code}\n  token: \${{ secrets.X }}\n`), [], 'a secret');
});

test('every job is a main-only push/dispatch job and uses the exact SHA', () => {
  assert.deepEqual([...code.slice(code.indexOf('\njobs:\n')).matchAll(/\n {2}([a-z-]+):\n/g)].map(m => m[1]), ['checks', 'product', 'build', 'deploy']);
  for (const j of [checks, product, build, deploy]) assert.match(j, /if: \$\{\{ \(github\.event_name == 'push' \|\| github\.event_name == 'workflow_dispatch'\) && github\.ref == 'refs\/heads\/main' \}\}/);
  for (const j of [checks, build]) {
    assert.match(j, /ref: \$\{\{ github\.sha \}\}/);
    assert.match(j, /persist-credentials: false/);
  }
  assert.match(product, /uses: \.\/\.github\/workflows\/product\.yml\n {4}with:\n {6}ref: \$\{\{ github\.sha \}\}\n/);
  assert.match(build, /--expect-sha "\$GITHUB_SHA"/);
});

test('every action is pinned to a full commit SHA', () => {
  const uses = [...code.matchAll(/uses: (\S+)/g)].map(m => m[1]);
  assert.ok(uses.length >= 5);
  for (const u of uses) assert.match(u, /^(?:\.\/\.github\/workflows\/product\.yml|[\w.-]+\/[\w.-]+@[a-f0-9]{40})$/, u);
});

test('only the deploy job has write or OIDC permissions, and it runs only the pinned deployment action', () => {
  assert.match(code, /\npermissions: \{\}\n/);
  for (const j of [checks, product, build]) {
    assert.match(j, /permissions:\n {6}contents: read\n/);
    assert.doesNotMatch(j, /: write|id-token/);
  }
  assert.equal([...code.matchAll(/\b[a-z-]+: write/g)].length, 2, 'exactly pages and id-token');
  assert.match(deploy, /pages: write\n\s+id-token: write/);
  assert.deepEqual([...deploy.matchAll(/uses: (\S+)/g)].map(m => m[1].split('@')[0]), ['actions/deploy-pages']);
  assert.doesNotMatch(deploy, /\brun:|pnpm|npm|node |checkout/);
  assert.match(deploy, /needs: build/);
  assert.match(deploy, /environment:\n\s+name: github-pages/);
});

test('deployment concurrency never cancels a running deployment', () => {
  assert.match(code, /concurrency:\n {2}group: pages-deployment\n {2}cancel-in-progress: false/);
});

test('verification and site preparation come strictly before the single artifact upload', () => {
  // The upload job needs the checks (history scan, source verification) and every product job (product.yml).
  assert.match(build, /^ {4}needs: \[checks, product\]\n/m);
  for (const gate of ['--frozen-lockfile', 'git-privacy.mjs history HEAD', 'pnpm verify:source']) assert.ok(checks.includes(gate), `checks runs ${gate}`);
  assert.match(checks, /fetch-depth: 0/);
  const at = s => build.indexOf(s);
  const upload = at('actions/upload-pages-artifact@');
  assert.ok(upload > 0);
  assert.equal([...code.matchAll(/upload-pages-artifact|upload-artifact/g)].length, 1);
  for (const gate of ['--frozen-lockfile', 'actions/download-artifact@', 'pnpm verify:product --stage evidence --expect-digest "$DIGEST"', 'scripts/site/prepare.mjs']) {
    assert.ok(at(gate) > 0 && at(gate) < upload, `${gate} must precede the upload`);
  }
  assert.match(build, /DIGEST: \$\{\{ needs\.product\.outputs\.digest \}\}/);
  assert.ok(at('actions/download-artifact@') < at('pnpm verify:product --stage evidence'));
  assert.ok(at('pnpm verify:product --stage evidence') < at('scripts/site/prepare.mjs'));
  assert.ok(build.includes(`path: ${AIRIG}/site/run/site\n`));
  assert.doesNotMatch(build, /build:prefixed|\bbuild\b.*docs|--stage build|run build/, 'the tested output is never rebuilt after verification');
  assert.doesNotMatch(code, /continue-on-error|\|\| true|--no-verify/);
});

test('main CI checks site preparation on every PR without uploading, and keeps its gates', () => {
  const site = /\n  site:\n([\s\S]*?)\n  required:/.exec(ci)?.[1] ?? '';
  assert.ok(site.includes(`scripts/site/prepare.mjs --base /velcro --out ${AIRIG}/site/run --expect-sha "$SOURCE_SHA"`));
  assert.doesNotMatch(site, /build:prefixed|--stage build/, 'no rebuild between the browser checks and preparation');
  assert.ok(site.indexOf('pnpm verify:product --stage evidence') < site.indexOf('scripts/site/prepare.mjs'));
  assert.doesNotMatch(ci, /upload-artifact|upload-pages|deploy-pages|pages: write|id-token/);
  assert.match(ci, /needs: \[verify, product, site, security\]/);
});

// Pages runs only on main, so its caches are main-scope entries that pull requests and merge groups cannot write; the
// installer still re-verifies a restored archive against the pinned SHA-256 (layout checked in ci.test.mjs).
test('the pinned Gitleaks archive cache precedes each install, and the deploy job restores nothing', () => {
  for (const [name, body] of [['checks', checks], ['build', build]]) {
    const cache = body.indexOf('- name: Cache the pinned Gitleaks archive');
    const install = body.indexOf('- run: node scripts/security/gitleaks.mjs install');
    assert.ok(cache > 0 && cache < install, `${name}: cache step before the install`);
    assert.ok(body.includes(`path: ${AIRIG}/tools/gitleaks/`), `${name}: only the installer's archive directory`);
  }
  assert.ok(build.indexOf('gitleaks.mjs install') < build.indexOf('actions/upload-pages-artifact@'));
  assert.doesNotMatch(deploy, /actions\/cache|gitleaks/);
});
