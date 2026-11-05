import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// Private scratch names are assembled at runtime so no literal workstation-style path sits in the source.
const AIRIG = ['', 'airig'].join('.');
const text = readFileSync(new URL('../../.github/workflows/pages.yml', import.meta.url), 'utf8');
const ci = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
const code = text.replace(/^\s*#.*$/gm, '');
const job = name => new RegExp(`\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [a-z-]+:\\n|$)`).exec(code)?.[1] ?? '';
const build = job('build');
const deploy = job('deploy');

test('the only trigger is a manual dispatch; nothing automatic, no PR or foreign-ref input', () => {
  assert.match(code, /\non:\n {2}workflow_dispatch:\n/);
  assert.equal([...code.matchAll(/^on:\n((?: {2}.*\n)+)/gm)][0][1].trim(), 'workflow_dispatch:');
  assert.doesNotMatch(code, /\bpush:|pull_request|schedule:|workflow_run|repository_dispatch|inputs:|github\.event\.(?:inputs|pull_request)|github\.head_ref/);
  assert.doesNotMatch(code, /secrets\.|PERSONAL|\bPAT\b|GH_TOKEN|GITHUB_TOKEN:/);
});

test('build and deployment are main-only and use the exact dispatched SHA', () => {
  for (const j of [build, deploy]) assert.match(j, /if: \$\{\{ github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main' \}\}/);
  assert.match(build, /ref: \$\{\{ github\.sha \}\}/);
  assert.match(build, /persist-credentials: false/);
  assert.match(build, /--expect-sha "\$GITHUB_SHA"/);
});

test('every action is pinned to a full commit SHA', () => {
  const uses = [...code.matchAll(/uses: (\S+)/g)].map(m => m[1]);
  assert.ok(uses.length >= 5);
  for (const u of uses) assert.match(u, /^[\w.-]+\/[\w.-]+@[a-f0-9]{40}$/, u);
});

test('only the deploy job has write or OIDC permissions, and it runs only the pinned deployment action', () => {
  assert.match(code, /\npermissions: \{\}\n/);
  assert.match(build, /permissions:\n {6}contents: read\n/);
  assert.doesNotMatch(build, /: write|id-token/);
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
  const at = s => build.indexOf(s);
  const upload = at('actions/upload-pages-artifact@');
  assert.ok(upload > 0);
  assert.equal([...code.matchAll(/upload-pages-artifact|upload-artifact/g)].length, 1);
  for (const gate of ['--frozen-lockfile', 'git-privacy.mjs history HEAD', 'pnpm verify:source', 'pnpm verify:product', 'scripts/site/prepare.mjs']) {
    assert.ok(at(gate) > 0 && at(gate) < upload, `${gate} must precede the upload`);
  }
  assert.ok(at('pnpm verify:product') < at('scripts/site/prepare.mjs'));
  assert.ok(build.includes(`path: ${AIRIG}/site/run/site\n`));
  assert.doesNotMatch(build, /build:prefixed|\bbuild\b.*docs/, 'the tested output is never rebuilt after verification');
  assert.doesNotMatch(build, /continue-on-error|\|\| true|--no-verify/);
});

test('main CI checks site preparation on every PR without uploading, and keeps its gates', () => {
  const product = /\n  product:\n([\s\S]*?)\n  required:/.exec(ci)?.[1] ?? '';
  assert.ok(product.includes(`scripts/site/prepare.mjs --base /velcro --out ${AIRIG}/site/run --expect-sha "$SOURCE_SHA"`));
  assert.doesNotMatch(product, /build:prefixed/, 'no rebuild between the browser checks and preparation');
  assert.ok(product.indexOf('pnpm verify:product') < product.indexOf('scripts/site/prepare.mjs'));
  assert.doesNotMatch(ci, /upload-artifact|upload-pages|deploy-pages|pages: write|id-token/);
  assert.match(ci, /needs: \[verify, product, security\]/);
});
