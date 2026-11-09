import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { IMAGE_BROWSERS_PATH, ImageError, checkImage, installedPlaywright, lockedPlaywright } from '../../scripts/ci/playwright-image.mjs';

const gate = new URL('../../scripts/ci-gate.mjs', import.meta.url);
const workflow = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
const product = readFileSync(new URL('../../.github/workflows/product.yml', import.meta.url), 'utf8');
// The analysis jobs' shared condition: skipped only on a pull request title or body edit.
const RUN_CONDITION = "${{ github.event_name != 'pull_request' || github.event.action != 'edited' || github.event.changes.base }}";
// A job's body, up to the next job of the same file (comment lines between jobs are dropped first).
const jobOf = (text, name) => new RegExp(`\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [a-z-]+:\\n|$)`).exec(text.replace(/^ {2}#.*\n/gm, ''))?.[1] ?? '';
// The run script of a named step in a job body.
const stepRun = (body, name) => {
  const at = body.indexOf(`- name: ${name}`);
  return at < 0 ? undefined : /\brun: \|\n((?:\s{10}.*\n?)+)/.exec(body.slice(at))?.[1];
};
const inlineAggregate = /node --input-type=module -e '([\s\S]*?)'/.exec(workflow)?.[1];
// Runs the workflow's inline aggregate and the local oracle with the same environment; they must agree.
const aggregate = (value, extra = {}) => {
  const env = { ...process.env, VELCRO_CI_NEEDS: JSON.stringify(value), ...extra };
  for (const key of ['VELCRO_CI_CARRY', 'VELCRO_CI_PRIOR', 'VELCRO_CI_HEAD', 'VELCRO_CI_PR', 'VELCRO_CI_BASE', 'VELCRO_CI_RUN']) if (!(key in extra)) delete env[key];
  const options = { env, encoding: 'utf8' };
  const script = spawnSync(process.execPath, [gate.pathname], options).status;
  const actual = spawnSync(process.execPath, ['--input-type=module', '-e', inlineAggregate], options).status;
  assert.equal(actual, script, 'workflow aggregate and local oracle diverged');
  return script;
};
test('aggregate requires every named job and only successful results', () => {
  assert.ok(inlineAggregate, 'actual workflow aggregate must be testable');
  const run = value => aggregate(value);
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
  // Skipped jobs never pass outside the title/body-edit mode, even with a successful earlier run on record.
  const skipped = { verify: { result: 'skipped' }, product: { result: 'skipped' }, site: { result: 'skipped' }, security: { result: 'skipped' } };
  assert.equal(run(skipped), 1);
});

// A title or body edit: the analysis jobs are skipped and the aggregate repeats the newest full run of ci.yml for the
// same head, PR and base branch (by run number, never completion time). Everything else blocks.
test('title/body-edit aggregate repeats only the newest full run for the same head, PR and base', () => {
  const head = 'c'.repeat(40);
  const runId = '4242';
  const skipped = { verify: { result: 'skipped' }, product: { result: 'skipped' }, site: { result: 'skipped' }, security: { result: 'skipped' } };
  const wfRun = (overrides = {}) => ({ id: 17, run_number: 5, path: '.github/workflows/ci.yml', event: 'pull_request',
    head_sha: head, display_title: 'CI pr 7 into main (full)', status: 'completed', conclusion: 'success', ...overrides });
  const dir = mkdtempSync(path.join(tmpdir(), 'velcro-carry-'));
  try {
    let n = 0;
    const carry = (needs, listing, extra = {}) => {
      const file = path.join(dir, `prior-${n++}.json`);
      writeFileSync(file, typeof listing === 'string' ? listing : JSON.stringify(listing));
      return aggregate(needs, { VELCRO_CI_CARRY: 'true', VELCRO_CI_PRIOR: file, VELCRO_CI_HEAD: head, VELCRO_CI_PR: '7',
        VELCRO_CI_BASE: 'main', VELCRO_CI_RUN: runId, ...extra });
    };
    const list = (...runs) => ({ total_count: runs.length, workflow_runs: runs });
    assert.equal(carry(skipped, list(wfRun())), 0);
    // The newest full run by run number decides, whatever its completion time or the listing order.
    const newerFailed = wfRun({ id: 18, run_number: 6, conclusion: 'failure' });
    assert.equal(carry(skipped, list(wfRun(), newerFailed)), 1);
    assert.equal(carry(skipped, list(newerFailed, wfRun())), 1);
    assert.equal(carry(skipped, list(wfRun({ id: 16, run_number: 4, conclusion: 'failure' }), wfRun())), 0);
    // An older approved run that finishes after a newer failed one never revives success.
    assert.equal(carry(skipped, list(wfRun({ updated_at: '2026-01-02T00:00:00Z' }), { ...newerFailed, updated_at: '2026-01-01T00:00:00Z' })), 1);
    // A newer full run still pending (a retarget, push or label run) blocks, even with an earlier success.
    for (const status of ['queued', 'in_progress', 'waiting', 'requested', 'pending']) {
      assert.equal(carry(skipped, list(wfRun(), wfRun({ id: 18, run_number: 6, status, conclusion: null }))), 1, status);
    }
    // A re-run attempt of the newest full run in progress blocks; its completed success counts.
    assert.equal(carry(skipped, list(wfRun({ run_attempt: 2, status: 'in_progress', conclusion: null }))), 1);
    // While a re-run is in progress the run may still show the previous attempt's conclusion: only status counts.
    assert.equal(carry(skipped, list(wfRun({ run_attempt: 2, status: 'in_progress', conclusion: 'success' }))), 1);
    assert.equal(carry(skipped, list(wfRun({ run_attempt: 2, status: 'queued', conclusion: 'success' }))), 1);
    assert.equal(carry(skipped, list(wfRun({ run_attempt: 2 }))), 0);
    for (const conclusion of ['failure', 'cancelled', 'skipped', 'neutral', 'timed_out', 'action_required', 'stale', null]) {
      assert.equal(carry(skipped, list(wfRun({ conclusion }))), 1, String(conclusion));
    }
    // Evidence for another base branch, another PR, a repeat run, another workflow, event or head is not evidence here,
    // and never hides the absence of evidence for this PR and base.
    for (const other of [
      { display_title: 'CI pr 7 into release (full)' }, { display_title: 'CI pr 8 into main (full)' },
      { display_title: 'CI pr 7 into main (repeat)' }, { display_title: 'CI pr 7 into main' }, { display_title: 'Fix the title' },
      { path: '.github/workflows/pages.yml' }, { path: '.github/workflows/ci.yml@main' }, { event: 'push' }, { event: 'merge_group' },
      { head_sha: 'd'.repeat(40) }, { id: Number(runId) }, { id: '17' }, { run_number: '5' }, { run_number: null },
    ]) {
      assert.equal(carry(skipped, list(wfRun(other))), 1, JSON.stringify(other));
      // A newer failed run for another base, PR or mode does not shadow this PR's own success either.
      assert.equal(carry(skipped, list(wfRun(), wfRun({ id: 19, run_number: 9, conclusion: 'failure', ...other }))), 0, JSON.stringify(other));
    }
    // Retargeted: the earlier base's success never stands for the new base, and the new base's pending run blocks.
    assert.equal(carry(skipped, list(wfRun()), { VELCRO_CI_BASE: 'release' }), 1);
    assert.equal(carry(skipped, list(wfRun(), wfRun({ id: 18, run_number: 6, display_title: 'CI pr 7 into release (full)', status: 'in_progress', conclusion: null })),
      { VELCRO_CI_BASE: 'release' }), 1);
    assert.equal(carry(skipped, list(wfRun(), wfRun({ id: 18, run_number: 6, display_title: 'CI pr 7 into release (full)' })),
      { VELCRO_CI_BASE: 'release' }), 0);
    // The same head in another PR is not this PR's evidence.
    assert.equal(carry(skipped, list(wfRun()), { VELCRO_CI_PR: '8' }), 1);
    // No full run, an unreadable listing, or malformed inputs block.
    assert.equal(carry(skipped, list()), 1);
    assert.equal(carry(skipped, { check_runs: [wfRun()] }), 1);
    assert.equal(carry(skipped, ''), 1);
    assert.equal(carry(skipped, '{'), 1);
    for (const extra of [{ VELCRO_CI_HEAD: '' }, { VELCRO_CI_HEAD: head.toUpperCase() }, { VELCRO_CI_RUN: '' }, { VELCRO_CI_PR: '' },
      { VELCRO_CI_PR: '07' }, { VELCRO_CI_BASE: '' }]) {
      assert.equal(carry(skipped, list(wfRun({ head_sha: extra.VELCRO_CI_HEAD ?? head })), extra), 1, JSON.stringify(extra));
    }
    // Every expected job must have been skipped: a job that ran (whatever its result) or a missing job blocks.
    for (const job of ['verify', 'product', 'site', 'security']) {
      for (const result of ['success', 'failure', 'cancelled', '', null]) {
        assert.equal(carry({ ...skipped, [job]: { result } }, list(wfRun())), 1, `${job} ${result}`);
      }
      const { [job]: _omitted, ...missing } = skipped;
      assert.equal(carry(missing, list(wfRun())), 1);
    }
    assert.equal(carry({ ...skipped, extra: { result: 'skipped' } }, list(wfRun())), 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
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
  // Only the aggregate may read anything beyond contents, and only check runs; nothing may write.
  assert.doesNotMatch(text, /: write|write-all|read-all/);
  assert.deepEqual([...text.matchAll(/^ {4}permissions:\n((?: {6}.*\n)+)/gm)].map(m => m[1]), ['      actions: read\n']);
  assert.match(jobOf(text, 'required'), /^ {4}permissions:\n {6}actions: read\n/m);
  assert.doesNotMatch(text, /\bpaths(-ignore)?:/);
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
  assert.match(upstream, /pnpm verify:product --stage upstream --expect-digest "\$DIGEST"/);
});

// The browser and upstream jobs run in the official Playwright image, pinned by digest and tagged with the lockfile's
// Playwright version: no apt, no engine download, no engine cache. Each checks the image against the lockfile in the job.
test('product browser jobs run in the official Playwright image for the lockfile version, pinned by digest', () => {
  const locked = lockedPlaywright(readFileSync(new URL('../../pnpm-lock.yaml', import.meta.url), 'utf8'));
  const pinned = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).devDependencies['@playwright/test'];
  assert.equal(locked, pinned, 'the lockfile resolves the pinned @playwright/test');
  const image = `mcr.microsoft.com/playwright:v${locked.replaceAll('.', '\\.')}-noble@sha256:[0-9a-f]{64}`;
  const container = new RegExp(`^ {4}container:\\n {6}image: (${image})\\n {6}options: --init --user 1001 --shm-size=2g\\n {4}env:\\n {6}PLAYWRIGHT_BROWSERS_PATH: /ms-playwright\\n`, 'm');
  const images = [];
  for (const [name, engine] of [['browser', '${{ matrix.engine }}'], ['upstream', 'chromium']]) {
    const body = jobOf(product, name);
    const match = container.exec(body);
    assert.ok(match, `${name}: the pinned image for Playwright ${locked}, a non-root user and the image's browsers path`);
    images.push(match[1]);
    assert.equal([...body.matchAll(/^ {4}container:/gm)].length, 1);
    // The image is checked against the lockfile's Playwright after the install and before any browser runs.
    const check = `- name: Check the image against the lockfile's Playwright\n        env:\n          ENGINE: ${engine}\n        run: node scripts/ci/playwright-image.mjs "$ENGINE"\n`;
    assert.ok(body.includes(check), `${name}: image check step`);
    assert.ok(body.indexOf('Public frozen dependency install') < body.indexOf(check));
    assert.ok(body.indexOf(check) < body.indexOf('pnpm verify:product --stage'));
  }
  assert.equal(images[0], images[1], 'one image for every browser job');
  assert.equal([...product.matchAll(/^ {4}container:/gm)].length, 2, 'only the browser and upstream jobs use the image');
  assert.equal([...product.matchAll(/mcr\.microsoft\.com\//g)].length, 2);
  assert.doesNotMatch(jobOf(product, 'build'), /container:|PLAYWRIGHT_BROWSERS_PATH/, 'the build and its scans run on the runner, as before');
  // Nothing installs system packages or engines at run time, and no engine cache can shadow the image's builds.
  const code = product.replace(/^\s*#.*\n/gm, '');
  assert.doesNotMatch(code, /\bapt(?:-get|-config)?\b|\bsudo\b|install-deps|--with-deps|playwright install|ms-playwright[^\n]*airig|\.airig\/ms-playwright|key: playwright-/);
  assert.doesNotMatch(product, /options:[^\n]*(?:--privileged|--ipc|--cap-add|--network|--pid|-v |--volume|--user (?:0|root)\b)/);
});

// The in-job image check, against a stand-in install (packages, lockfile and the installer's dry run) and image directory.
test('image check: installed Playwright equals the lockfile and every expected engine build is complete in the image', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'velcro-image-'));
  try {
    const root = path.join(dir, 'repo');
    const image = path.join(dir, 'ms-playwright');
    const lock = v => `lockfileVersion: '9.0'\n\nimporters:\n\n  .:\n    devDependencies:\n      '@changesets/cli':\n        specifier: 2.29.8\n        version: 2.29.8\n      '@playwright/test':\n        specifier: ${v}\n        version: ${v}\n\npackages:\n`;
    const pkg = (name, version, exports) => {
      mkdirSync(path.join(root, 'node_modules', name), { recursive: true });
      writeFileSync(path.join(root, 'node_modules', name, 'package.json'), JSON.stringify({ name, version, ...(exports ? { exports } : {}) }));
    };
    const setup = ({ locked = '1.64.1', test = '1.64.1', runner = '1.64.1', core = '1.64.1' } = {}) => {
      rmSync(root, { recursive: true, force: true });
      mkdirSync(root, { recursive: true });
      writeFileSync(path.join(root, 'package.json'), '{"name":"stand-in","private":true}');
      writeFileSync(path.join(root, 'pnpm-lock.yaml'), lock(locked));
      pkg('@playwright/test', test, { './package.json': './package.json', './cli': './cli.js' });
      writeFileSync(path.join(root, 'node_modules/@playwright/test/cli.js'), '');
      pkg('playwright', runner);
      pkg('playwright-core', core);
    };
    const build = (name, complete = true) => {
      mkdirSync(path.join(image, name), { recursive: true });
      if (complete) writeFileSync(path.join(image, name, 'INSTALLATION_COMPLETE'), '');
    };
    // The installer's dry run, as Playwright prints it: one block per build, the location under PLAYWRIGHT_BROWSERS_PATH.
    const dryRun = (names, status = 0) => (cmd, args, options) => {
      assert.equal(cmd, process.execPath);
      assert.deepEqual(args.slice(1), ['install', '--dry-run', args[3]]);
      assert.ok(args[0].endsWith(path.join('@playwright', 'test', 'cli.js')));
      const at = options.env.PLAYWRIGHT_BROWSERS_PATH;
      return { status, stdout: names.map(n => `Build ${n}\n  Install location:    ${n.startsWith('/') ? n : path.join(at, n)}\n  Download url:        https://example.invalid/${n}.zip\n`).join('\n') };
    };
    const check = (engine, run, browsersPath = image) => {
      try { return checkImage({ root, engine, browsersPath, run }); } catch (e) { assert.ok(e instanceof ImageError, e.stack); return e.code; }
    };
    setup();
    build('chromium-1248'); build('chromium_headless_shell-1248'); build('ffmpeg-1013'); build('webkit-2370');
    const chromium = ['chromium-1248', 'ffmpeg-1013', 'chromium_headless_shell-1248'];
    assert.deepEqual(check('chromium', dryRun(chromium)), { version: '1.64.1', builds: chromium });
    assert.deepEqual(check('webkit', dryRun(['webkit-2370', 'ffmpeg-1013'])), { version: '1.64.1', builds: ['webkit-2370', 'ffmpeg-1013'] });
    // An image built for another Playwright version names other revisions: nothing is downloaded, the job stops.
    assert.equal(check('chromium', dryRun(['chromium-1249', 'ffmpeg-1013', 'chromium_headless_shell-1249'])), 'engine-missing');
    assert.equal(check('firefox', dryRun(['firefox-1555', 'ffmpeg-1013'])), 'engine-missing');
    build('firefox-1555', false);
    assert.equal(check('firefox', dryRun(['firefox-1555', 'ffmpeg-1013'])), 'engine-missing', 'an incomplete build is missing');
    assert.equal(check('chromium', dryRun(['/elsewhere/chromium-1248'])), 'engine-outside-image');
    assert.equal(check('chromium', dryRun(['ffmpeg-1013'])), 'no-engine-builds', 'the engine itself must be among the builds');
    assert.equal(check('chromium', dryRun([])), 'no-engine-builds');
    assert.equal(check('chromium', dryRun(chromium, 1)), 'dry-run-failed');
    assert.equal(check('edge', dryRun(chromium)), 'engine');
    assert.equal(check('chromium', dryRun(chromium), 'relative/path'), 'browsers-path');
    // The installed packages must all be exactly the lockfile's version, and the lockfile must pin it exactly.
    for (const [versions, code] of [[{ core: '1.64.0' }, 'version-mismatch'], [{ runner: '1.65.0' }, 'version-mismatch'],
      [{ test: '1.64.0' }, 'version-mismatch'], [{ locked: '1.64.0' }, 'version-mismatch'], [{ locked: '^1.64.1' }, 'lockfile']]) {
      setup(versions);
      assert.equal(check('chromium', dryRun(chromium)), code, JSON.stringify(versions));
    }
    setup();
    rmSync(path.join(root, 'node_modules/playwright-core'), { recursive: true });
    assert.equal(check('chromium', dryRun(chromium)), 'not-installed');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('image check: the real installer and lockfile, against an image directory built from its own dry run', () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const dir = mkdtempSync(path.join(tmpdir(), 'velcro-image-'));
  try {
    const { cli } = installedPlaywright(root);
    const dry = spawnSync(process.execPath, [cli, 'install', '--dry-run', 'firefox'], { cwd: root, encoding: 'utf8',
      env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: dir } });
    assert.equal(dry.status, 0);
    const names = [...dry.stdout.matchAll(/Install location: +(\S+)/g)].map(m => path.basename(m[1]));
    assert.ok(names.some(n => /^firefox-\d+$/.test(n)), 'the dry run names the firefox build');
    assert.throws(() => checkImage({ root, engine: 'firefox', browsersPath: dir }), { code: 'engine-missing' });
    for (const n of names) {
      mkdirSync(path.join(dir, n));
      writeFileSync(path.join(dir, n, 'INSTALLATION_COMPLETE'), '');
    }
    const version = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).devDependencies['@playwright/test'];
    assert.deepEqual(checkImage({ root, engine: 'firefox', browsersPath: dir }), { version, builds: names });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('image check prints only fixed status lines and requires the image\'s browsers path', () => {
  const script = fileURLToPath(new URL('../../scripts/ci/playwright-image.mjs', import.meta.url));
  for (const [env, args, out] of [
    [{ PLAYWRIGHT_BROWSERS_PATH: path.join(tmpdir(), 'elsewhere') }, ['chromium'], 'playwright image: blocked (browsers-path)'],
    [{ PLAYWRIGHT_BROWSERS_PATH: '' }, ['chromium'], 'playwright image: blocked (browsers-path)'],
    [{ PLAYWRIGHT_BROWSERS_PATH: IMAGE_BROWSERS_PATH }, [], 'playwright image: blocked (usage)'],
    [{ PLAYWRIGHT_BROWSERS_PATH: IMAGE_BROWSERS_PATH }, ['edge'], 'playwright image: blocked (engine)'],
  ]) {
    const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: { ...process.env, ...env } });
    assert.equal(r.status, 1);
    assert.equal(`${r.stdout}${r.stderr}`.trim(), out);
  }
});

test('CI records evidence only after every product job, then checks site preparation without uploading', () => {
  const site = jobOf(workflow, 'site');
  assert.match(site, /^ {4}needs: product\n/m);
  // Its only condition is the shared title/body-edit skip (tested below); otherwise it runs whenever product succeeded.
  assert.deepEqual([...site.matchAll(/^ {4}if: (.*)$/gm)].map(m => m[1]), [RUN_CONDITION]);
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

// Evaluates the GitHub Actions expression subset these workflows use, with GitHub's semantics: single-quoted string
// literals, `format()`, context paths (a missing property is null), `!`, `==`/`!=` (strings compare case-insensitively, other
// mixed types compare as numbers, so null and '' are equal), and `&&`/`||`, which return an operand value, plus
// parentheses. Precedence: `!` > comparison > `&&` > `||`. Anything else is rejected.
function evaluate(expression, context) {
  const tokens = expression.match(/'[^']*'|[A-Za-z_][\w-]*(?:\.[A-Za-z_][\w-]*)*|==|!=|&&|\|\||!|\(|\)|,|\S/g);
  let at = 0;
  const truthy = v => !(v === false || v === null || v === undefined || v === '' || v === 0 || Number.isNaN(v));
  const number = v => (v === null || v === undefined ? 0 : typeof v === 'boolean' ? Number(v) : typeof v === 'string' ? (v.trim() === '' ? 0 : Number(v)) : NaN);
  const equal = (a, b) => {
    if (typeof a === 'string' && typeof b === 'string') return a.toLowerCase() === b.toLowerCase();
    if ((a !== null && typeof a === 'object') || (b !== null && typeof b === 'object')) return a === b;
    return number(a) === number(b);
  };
  const primary = () => {
    const token = tokens[at++];
    assert.ok(token !== undefined, 'unexpected end of expression');
    if (token === '(') { const value = or(); assert.equal(tokens[at++], ')'); return value; }
    if (token === '!') return !truthy(primary());
    if (/^'[^']*'$/.test(token)) return token.slice(1, -1);
    if (token === 'true' || token === 'false') return token === 'true';
    // format('…{0}…', a, b): GitHub's string formatting; values render as strings, numbers in decimal.
    if (token === 'format' && tokens[at] === '(') {
      at++;
      const values = [or()];
      while (tokens[at] === ',') { at++; values.push(or()); }
      assert.equal(tokens[at++], ')');
      const [template, ...rest] = values;
      assert.equal(typeof template, 'string');
      return template.replace(/\{(\d+)\}/g, (_, i) => { assert.ok(Number(i) < rest.length); return String(rest[Number(i)] ?? ''); });
    }
    assert.match(token, /^(?:github|vars|needs|inputs)(?:\.[A-Za-z_][\w-]*)+$/, `unsupported expression token ${token}`);
    return token.split('.').reduce((node, key) => (node == null || !Object.hasOwn(node, key) ? null : node[key]), context);
  };
  const comparison = () => {
    const left = primary();
    if (tokens[at] !== '==' && tokens[at] !== '!=') return left;
    const operator = tokens[at++];
    const same = equal(left, primary());
    return operator === '==' ? same : !same;
  };
  const and = () => { let value = comparison(); while (tokens[at] === '&&') { at++; const right = comparison(); value = truthy(value) ? right : value; } return value; };
  const or = () => { let value = and(); while (tokens[at] === '||') { at++; const right = and(); value = truthy(value) ? value : right; } return value; };
  const result = or();
  assert.equal(at, tokens.length, 'unsupported expression shape');
  return result;
}
const truthy = v => !(v === false || v === null || v === undefined || v === '' || v === 0);

// The workflow's event shapes: push, merge_group and every pull_request action it subscribes to.
const head = 'c'.repeat(40);
const prEvent = (action, extra = {}) => ({ event_name: 'pull_request', repository_owner: 'fixture-org',
  event: { action, pull_request: { head: { sha: head }, base: { sha: 'b'.repeat(40) } }, ...extra } });
// GitHub's merge_group payload, with the base and branch of a real queue run (#36): the branch is named after the base
// the group was built on (base_sha), not the pull request head.
const queueBase = 'b48b57e7f68bbded8b47d0a2a5702ce07be097b6';
const mergeGroupEvent = { event_name: 'merge_group', sha: head,
  event: { action: 'checks_requested', merge_group: { head_sha: head, head_ref: `refs/heads/gh-readonly-queue/main/pr-36-${queueBase}`,
    base_sha: queueBase, base_ref: 'refs/heads/main', head_commit: { id: head } } } };
assert.equal(mergeGroupEvent.event.merge_group.head_ref, 'refs/heads/gh-readonly-queue/main/pr-36-b48b57e7f68bbded8b47d0a2a5702ce07be097b6');
const pushEvent = { event_name: 'push', sha: head, event: { before: 'a'.repeat(40) } };

test('a title or body edit skips every analysis job and only then switches the aggregate to the earlier result', () => {
  const conditions = ['verify', 'security', 'product', 'site'].map(job => [...jobOf(workflow, job).matchAll(/^ {4}if: \$\{\{ (.*) \}\}$/gm)].map(m => m[1]));
  for (const found of conditions) assert.deepEqual(found, [RUN_CONDITION.slice(4, -3)], 'one identical job condition');
  assert.match(jobOf(workflow, 'required'), /^ {4}if: \$\{\{ always\(\) \}\}\n/m);
  const carry = /VELCRO_CI_CARRY: \$\{\{ (.*) \}\}/.exec(jobOf(workflow, 'required'))?.[1] ?? '';
  const runs = github => truthy(evaluate(RUN_CONDITION.slice(4, -3), { github }));
  const carries = github => evaluate(carry, { github });
  const cases = [
    [pushEvent, true], [mergeGroupEvent, true],
    ...['opened', 'synchronize', 'reopened', 'labeled'].map(action => [prEvent(action), true]),
    // A retarget re-runs everything, also when the title changed with it.
    [prEvent('edited', { changes: { base: { ref: { from: 'other' }, sha: { from: 'f'.repeat(40) } } } }), true],
    [prEvent('edited', { changes: { base: { ref: { from: 'other' } }, title: { from: 'old' } } }), true],
    [prEvent('edited', { changes: { title: { from: 'old' } } }), false],
    [prEvent('edited', { changes: { body: { from: 'old' } } }), false],
    [prEvent('edited', { changes: { title: { from: 'old' }, body: { from: '' } } }), false],
    [prEvent('edited', { changes: {} }), false],
    [prEvent('edited'), false],
  ];
  for (const [github, expected] of cases) {
    const label = `${github.event_name} ${github.event.action ?? ''} ${JSON.stringify(github.event.changes ?? null)}`;
    assert.equal(runs(github), expected, label);
    // The aggregate repeats an earlier result exactly when the analysis jobs are skipped.
    assert.equal(carries(github), expected ? '' : 'true', label);
  }
  // In carry mode the aggregate reads the PR head; nothing else in the run changes.
  const required = jobOf(workflow, 'required');
  assert.match(required, /VELCRO_CI_HEAD: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  assert.match(required, /VELCRO_CI_PR: \$\{\{ github\.event\.pull_request\.number \}\}/);
  assert.match(required, /VELCRO_CI_BASE: \$\{\{ github\.event\.pull_request\.base\.ref \}\}/);
  assert.match(required, /gh api "repos\/\$REPO\/actions\/workflows\/ci\.yml\/runs\?head_sha=\$VELCRO_CI_HEAD&event=pull_request&per_page=100"/);
});

// The run name binds a pull request run to its PR, base branch and mode; the aggregate's evidence lookup relies on it.
test('a pull request run is named for its PR, base branch and mode, as the aggregate expects', async () => {
  const { fullRunTitle } = await import(gate.href);
  const name = /^run-name: \$\{\{ (.*) \}\}$/m.exec(workflow)?.[1] ?? '';
  assert.ok(name, 'run-name must be testable');
  const pr = (action, changes) => ({ ...prEvent(action, changes ? { changes } : {}),
    event: { ...prEvent(action, changes ? { changes } : {}).event,
      pull_request: { number: 7, head: { sha: head }, base: { sha: 'b'.repeat(40), ref: 'main' } } } });
  for (const action of ['opened', 'synchronize', 'reopened', 'labeled']) assert.equal(evaluate(name, { github: pr(action) }), fullRunTitle(7, 'main'));
  assert.equal(evaluate(name, { github: pr('edited', { base: { ref: { from: 'release' } } }) }), fullRunTitle(7, 'main'));
  assert.equal(evaluate(name, { github: pr('edited', { title: { from: 'old' } }) }), 'CI pr 7 into main (repeat)');
  assert.equal(evaluate(name, { github: pr('edited', { body: { from: 'old' } }) }), 'CI pr 7 into main (repeat)');
  assert.equal(evaluate(name, { github: pushEvent }), `CI push ${head}`);
  assert.equal(evaluate(name, { github: mergeGroupEvent }), `CI merge_group ${head}`);
  // The aggregate builds the same title from its environment.
  assert.match(inlineAggregate, /const title = `CI pr \$\{pr\} into \$\{base\} \(full\)`;/);
});

test('the aggregate reads the earlier result only in carry mode and fails closed when it cannot', () => {
  const script = stepRun(jobOf(workflow, 'required'), 'Require every expected job to succeed');
  assert.ok(script, 'actual aggregate step must be testable');
  const skipped = { verify: { result: 'skipped' }, product: { result: 'skipped' }, site: { result: 'skipped' }, security: { result: 'skipped' } };
  const good = { verify: { result: 'success' }, product: { result: 'success' }, site: { result: 'success' }, security: { result: 'success' } };
  const listing = { total_count: 1, workflow_runs: [{ id: 17, run_number: 5, path: '.github/workflows/ci.yml', event: 'pull_request',
    head_sha: head, display_title: 'CI pr 7 into main (full)', status: 'completed', conclusion: 'success' }] };
  const run = (carry, needs, ghCode) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'velcro-required-'));
    try {
      mkdirSync(path.join(dir, 'bin'));
      writeFileSync(path.join(dir, 'listing.json'), JSON.stringify(listing));
      writeFileSync(path.join(dir, 'bin/gh'), `#!/bin/sh\necho "$*" >> "${dir}/gh.log"\ncat "${dir}/listing.json"\nexit ${ghCode}\n`, { mode: 0o755 });
      const r = spawnSync('sh', ['-e', '-c', script], { cwd: dir, encoding: 'utf8', env: { ...process.env, RUNNER_TEMP: dir,
        VELCRO_CI_NEEDS: JSON.stringify(needs), VELCRO_CI_CARRY: carry, VELCRO_CI_HEAD: head, VELCRO_CI_PR: '7', VELCRO_CI_BASE: 'main',
        VELCRO_CI_RUN: '4242', REPO: 'fixture-org/fixture', PATH: `${path.join(dir, 'bin')}${path.delimiter}${process.env.PATH}` } });
      const calls = (() => { try { return readFileSync(path.join(dir, 'gh.log'), 'utf8').trim().split('\n'); } catch { return []; } })();
      return { status: r.status, out: `${r.stdout}${r.stderr}`.trim(), calls };
    } finally { rmSync(dir, { recursive: true, force: true }); }
  };
  assert.deepEqual(run('', good, 0), { status: 0, out: 'required: passed', calls: [] });
  assert.deepEqual(run('', skipped, 0), { status: 1, out: 'required: blocked', calls: [] });
  const call = [`api repos/fixture-org/fixture/actions/workflows/ci.yml/runs?head_sha=${head}&event=pull_request&per_page=100`];
  // The repeated result names the run it came from.
  assert.deepEqual(run('true', skipped, 0), { status: 0, out: 'required: repeats run 17\nrequired: passed', calls: call });
  assert.deepEqual(run('true', good, 0), { status: 1, out: 'required: repeats run 17\nrequired: blocked', calls: call });
  // A failed lookup blocks (the partial output is discarded).
  assert.deepEqual(run('true', skipped, 1), { status: 1, out: 'required: blocked', calls: call });
});

test('security scans the published range and only the configured approver label approves its exact head', () => {
  const job = /\n  security:\n([\s\S]*?)\n  product:/.exec(workflow)?.[1] ?? '';
  const step = /- name: Trusted source and history scan\n([\s\S]*?)(?=\n {6}(?:#|- ))/.exec(job)?.[1] ?? '';
  const base = /BASE_OID: \$\{\{ (.*) \}\}/.exec(step)?.[1] ?? '';
  const headOid = /HEAD_OID: \$\{\{ (.*) \}\}/.exec(step)?.[1] ?? '';
  assert.equal(base, 'github.event.pull_request.base.sha || github.event.merge_group.base_sha || github.event.before');
  assert.equal(headOid, 'github.event.pull_request.head.sha || github.event.merge_group.head_sha || github.sha');
  // Each event maps to its own base..head: the PR, the merge group (main plus the squashed PR), the previous main tip.
  assert.deepEqual([prEvent('synchronize'), mergeGroupEvent, pushEvent].map(github => [evaluate(base, { github }), evaluate(headOid, { github })]),
    [['b'.repeat(40), head], [queueBase, head], ['a'.repeat(40), head]]);
  // Engines come from the base, never the candidate: the merge group's base is main (or the group ahead of it).
  const trusted = /- uses: actions\/checkout@[a-f0-9]{40}\n {8}with:\n {10}ref: \$\{\{ (.*) \}\}\n {10}path: \.airig\/trusted\n/.exec(job)?.[1] ?? '';
  assert.equal(trusted, 'github.event.pull_request.base.sha || github.event.merge_group.base_sha || github.sha');
  assert.equal(evaluate(trusted, { github: mergeGroupEvent }), queueBase);
  assert.equal(evaluate(trusted, { github: prEvent('opened') }), 'b'.repeat(40));
  // Protected changes are reported for PRs and merge groups alike.
  const policy = /- name: Report protected changes requiring independent human review\n {8}if: \$\{\{ (.*) \}\}\n {8}env:\n {10}BASE_OID: \$\{\{ (.*) \}\}\n {10}HEAD_OID: \$\{\{ (.*) \}\}\n/.exec(job);
  assert.ok(policy, 'policy step must be testable');
  assert.equal(evaluate(policy[1], { github: mergeGroupEvent }), true);
  assert.equal(evaluate(policy[1], { github: prEvent('opened') }), true);
  assert.equal(evaluate(policy[1], { github: pushEvent }), false);
  assert.deepEqual([evaluate(policy[2], { github: mergeGroupEvent }), evaluate(policy[3], { github: mergeGroupEvent })], [queueBase, head]);
  const approval = /VELCRO_HISTORY_APPROVED: \$\{\{ (.*) \}\}/.exec(step)?.[1] ?? '';
  assert.doesNotMatch(approval, /repository_owner/, 'an organization owner is never the labeling user');
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
    { github: event({ event: { ...event().event, action: 'edited', changes: { title: { from: 'old' } } } }), vars: approver },
    { github: event({ event: { ...event().event, label: { name: 'history-scan-approved-later' } } }), vars: approver },
    { github: event({ event_name: 'push' }), vars: approver },
    // A merge group has no approval channel, even when its sender is the approver.
    { github: { ...mergeGroupEvent, event: { ...mergeGroupEvent.event, sender: { login: 'approver-fixture' } } }, vars: approver },
  ];
  for (const context of rejected) assert.equal(evaluate(approval, context), '', 'approval must stay empty');
  // edited: retargeting a PR's base re-runs every job against the new base (the job condition is tested above).
  assert.match(workflow, /\n {2}pull_request:\n(?: {4}#.*\n)* {4}types: \[opened, synchronize, reopened, labeled, edited\]\n/);
  assert.match(workflow, /\n {2}merge_group:\n {4}types: \[checks_requested\]\n/);
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
    const trustedGuard = '.airig/trusted/scripts/security/git-privacy.mjs history';
    const budget = `${trustedGuard} ${main}..${head}`;
    assert.deepEqual(invoke('push', 'a'.repeat(40)), [`${trustedGuard} ${'a'.repeat(40)}..${head}`]);
    // No usable base (new branch, first push, force push): full-history mode under the hard caps.
    assert.deepEqual(invoke('push', '0'.repeat(40)), [`${trustedGuard} ${head}`]);
    assert.deepEqual(invoke('push', ''), [`${trustedGuard} ${head}`]);
    assert.deepEqual(invoke('push', 'a'.repeat(40), 'none'), [`${trustedGuard} ${head}`]);
    // Every PR meets the budget against the fetched main first, whatever its event base.
    assert.deepEqual(invoke('pull_request', 'a'.repeat(40)), [budget, `${trustedGuard} ${'a'.repeat(40)}..${head}`]);
    assert.deepEqual(invoke('pull_request', 'e'.repeat(40), 'none'), [budget, `${trustedGuard} ${head}`]);
    // A PR based on the fetched main tip: its event range is the budget range, scanned once.
    assert.deepEqual(invoke('pull_request', main), [budget]);
    // A merge group on main: base..head is main..head, the budget range, scanned once (capped, never approved).
    assert.deepEqual(invoke('merge_group', main), [budget]);
    // A merge group on an older main ancestor: budget, then its own base..head.
    assert.deepEqual(invoke('merge_group', 'a'.repeat(40)), [budget, `${trustedGuard} ${'a'.repeat(40)}..${head}`]);
    // A merge group queued behind another group (its base is not on main yet): budget, then full history.
    assert.deepEqual(invoke('merge_group', 'f'.repeat(40), 'none'), [budget, `${trustedGuard} ${head}`]);
    // Any other event never gets the budget step.
    assert.deepEqual(invoke('workflow_dispatch', '0'.repeat(40)), [`${trustedGuard} ${head}`]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// The pinned Gitleaks archive is cached so a release-CDN outage does not fail every job. The key is the pinned version and
// the pinned archive SHA-256 of the runners' target (linux-x64), exact key only, and the cached path is exactly the
// directory where the installer keeps verified archives (it re-verifies a restored one before extracting anything).
test('every candidate-scope Gitleaks install restores the pinned archive by version and SHA-256; security never does and alone retries', async () => {
  const gitleaks = await import(new URL('../../scripts/security/gitleaks.mjs', import.meta.url).href);
  const target = gitleaks.selectTarget(gitleaks.loadManifest(), 'linux', 'x64');
  const dir = path.posix.dirname(target.relativeArchive.split(path.sep).join('/'));
  assert.equal(dir, `.airig/tools/gitleaks/${gitleaks.GITLEAKS_VERSION}/archives`);
  const key = `gitleaks-${gitleaks.GITLEAKS_VERSION}-linux-x64-${target.archiveSha256}`;
  const escape = value => value.replaceAll(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const cached = new RegExp(`- name: Cache the pinned Gitleaks archive\\n {8}uses: actions/cache@[a-f0-9]{40}\\n {8}with:\\n {10}path: ${escape(dir)}\\n {10}key: ${escape(key)}$`);
  const pages = readFileSync(new URL('../../.github/workflows/pages.yml', import.meta.url), 'utf8');
  const expected = { ci: ['verify', 'site'], product: ['build'], pages: ['checks', 'build'] };
  for (const [name, text] of Object.entries({ ci: workflow, product, pages })) {
    const installs = [];
    for (const job of [...text.replace(/^ {2}#.*\n/gm, '').matchAll(/\n {2}([a-z-]+):\n/g)].map(m => m[1])) {
      const body = jobOf(text, job);
      if (name === 'ci' && job === 'security') {
        assert.doesNotMatch(body, /actions\/cache/, 'security restores no cache over its base-owned engines');
        // Only the security job opts in to the installer's bounded transport retry.
        assert.match(body, /\n {6}- name: Install the base-owned Gitleaks \(bounded download retry\)\n {8}env:\n {10}VELCRO_GITLEAKS_DOWNLOAD_RETRY: '1'\n {8}run: node \.airig\/trusted\/scripts\/security\/gitleaks\.mjs install\n/);
        continue;
      }
      const steps = body.split(/(?=\n {6}- )/);
      steps.forEach((step, i) => {
        if (!/gitleaks\.mjs install/.test(step)) return;
        installs.push(job);
        assert.match(step, /^\n {6}- run: node scripts\/security\/gitleaks\.mjs install\n?/, `${name} ${job}: the candidate-scope install`);
        assert.match(steps[i - 1] ?? '', cached, `${name} ${job}: the pinned archive cache directly before the install`);
        assert.match(body, /^ {4}runs-on: ubuntu-24\.04\n/m, `${name} ${job}: the cache key names the linux-x64 target`);
      });
    }
    assert.deepEqual(installs, expected[name], name);
    // Exact key only, and no other cache ever covers the installer's scratch.
    assert.equal([...text.matchAll(/Cache the pinned Gitleaks archive/g)].length, expected[name].length, name);
    assert.equal([...text.matchAll(/path: \.airig\/tools/g)].length, expected[name].length, name);
    assert.doesNotMatch(text, /restore-keys: gitleaks|actions\/cache\/(?:save|restore)@/, name);
    assert.equal([...text.matchAll(/VELCRO_GITLEAKS_DOWNLOAD_RETRY/g)].length, name === 'ci' ? 1 : 0, `${name}: retry only in security`);
  }
});

// Covers the committed workflows only: a future PR's workflow changes are protected changes for human review.
test('the committed workflows request no status or check writes, and only CI defines the required job', () => {
  const dir = new URL('../../.github/workflows/', import.meta.url);
  const files = readdirSync(dir).filter(name => /\.ya?ml$/.test(name)).sort();
  assert.deepEqual(files, ['ci.yml', 'pages.yml', 'product.yml']);
  for (const name of files) {
    const text = readFileSync(new URL(name, dir), 'utf8');
    // `agent-approvals` is a commit status any source may set: no workflow token may be able to set it.
    assert.doesNotMatch(text, /statuses:|checks: write|write-all|agent-approvals/, name);
    const jobs = [...text.replace(/^ {2}#.*\n/gm, '').matchAll(/\n {2}([a-z-]+):\n/g)].map(m => m[1]);
    if (name !== 'ci.yml') assert.ok(!jobs.includes('required'), `${name} must not define a job named required`);
  }
});
