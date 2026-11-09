import { expect, test } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Self-test of the upstream conformance harness (tests/upstream/web-test-runner.config.mjs): its pointer guard moves the
// pointer to the bottom-right corner before the test framework is loaded, so before the first test of every file. The test
// runs web-test-runner with the harness's own runner page on a one-test file, in the engine of the current project. A
// listener added to that page ahead of everything else records every mousemove, and the test, as the first thing it does,
// checks that the last one is at the bottom-right corner: the move had been delivered before the test started. A control
// run with the guard cut out of the page must fail that same check, so the check cannot pass without the guard. Needs no
// built library or docs: the runner page only loads the theme file.
const root = fileURLToPath(new URL('../..', import.meta.url));
const harnessConfig = pathToFileURL(path.join(root, 'tests/upstream/web-test-runner.config.mjs')).href;

const RECORDER = 'window.__pointerMoves = []; addEventListener("mousemove", e => window.__pointerMoves.push({ x: e.clientX, y: e.clientY }), true);';
const PARKED_TEST = `
describe('pointer guard', () => {
  it('has parked the pointer in the bottom-right corner before the first test', () => {
    const moves = window.__pointerMoves;
    const last = moves[moves.length - 1];
    if (!last || last.x !== innerWidth - 1 || last.y !== innerHeight - 1) throw new Error('pointer not parked: ' + JSON.stringify(moves));
  });
});
`;

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

// Runs the one-test file through the harness's runner page; `withGuard: false` cuts the guard's script out of that page.
async function runHarness(product, withGuard) {
  const scratchRoot = path.join(root, '.airig', 'harness-selftest');
  mkdirSync(scratchRoot, { recursive: true });
  const dir = mkdtempSync(path.join(scratchRoot, 'run-'));
  try {
    writeFileSync(path.join(dir, 'pointer.test.js'), PARKED_TEST);
    const port = await freePort();
    writeFileSync(path.join(dir, 'config.mjs'), `
import real from ${JSON.stringify(harnessConfig)};
import { playwrightLauncher } from '@web/test-runner-playwright';
const guard = /<script type="module">\\s*\\/\\/ Harness guard \\(not upstream\\), generic[\\s\\S]*?<\\/script>/;
export default {
  ...real,
  port: ${port},
  files: [${JSON.stringify(path.relative(root, path.join(dir, 'pointer.test.js')))}],
  browsers: [playwrightLauncher({ product: ${JSON.stringify(product)} })],
  testRunnerHtml: framework => {
    const page = real.testRunnerHtml(framework);
    if (!guard.test(page)) throw new Error('the harness runner page has no pointer guard to cut out');
    const recorded = page.replace('<script>', '<script>' + ${JSON.stringify(RECORDER)} + '</script><script>');
    return ${withGuard} ? recorded : recorded.replace(guard, '<script type="module" src="' + framework + '"></script>');
  },
};
`);
    const run = spawnSync('pnpm', ['exec', 'web-test-runner', '--config', path.join(dir, 'config.mjs')], {
      cwd: root, encoding: 'utf8', timeout: 150000, env: { ...process.env, CI: 'true' },
    });
    return { status: run.status, output: `${run.stdout ?? ''}${run.stderr ?? ''}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('the harness parks the pointer before the first test starts, and the check fails without the guard', async ({ browserName }) => {
  test.setTimeout(240000);
  const guarded = await runHarness(browserName, true);
  expect(guarded.output).toContain('all tests passed');
  expect(guarded.status).toBe(0);
  const control = await runHarness(browserName, false);
  expect(control.output).toContain('pointer not parked');
  expect(control.status).not.toBe(0);
});
