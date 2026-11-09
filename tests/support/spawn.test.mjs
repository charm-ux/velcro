import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { settleAll, spawnAsync } from './spawn.mjs';

// A worker that writes into the shared fixture only after a real subprocess has run for a while, like the Git and
// guard runs of the parallel test groups. It records when it finished.
function slowWriter(dir, name, log) {
  return (async () => {
    const result = await spawnAsync(process.execPath, ['-e',
      'setTimeout(() => require("node:fs").writeFileSync(process.argv[1], "done\\n"), 300)', path.join(dir, name)]);
    log.push(name);
    assert.equal(result.status, 0, 'the sibling worker found its fixture');
    return name;
  })();
}

function failing(message, delay = 0) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), delay));
}

test('settleAll keeps the input order of the values', async () => {
  const late = new Promise(resolve => setTimeout(() => resolve('late'), 50));
  assert.deepEqual(await settleAll([late, 'plain', Promise.resolve('early')]), ['late', 'plain', 'early']);
});

test('a failing worker does not release fixture cleanup while siblings still use the fixture', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'velcro-settle-'));
  const finished = [];
  let seenAtFailure;
  try {
    await settleAll([failing('first worker failed'), slowWriter(dir, 'sibling.txt', finished)]);
    assert.fail('the failing worker must reject the group');
  } catch (error) {
    // The cleanup below runs only now: the sibling has already finished with its fixture.
    assert.equal(error.message, 'first worker failed');
    seenAtFailure = { finished: [...finished], written: existsSync(path.join(dir, 'sibling.txt')) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  assert.deepEqual(seenAtFailure, { finished: ['sibling.txt'], written: true });
});

test('Promise.all, by contrast, releases cleanup while a sibling is still running', async () => {
  // The hazard settleAll exists for, shown on a fixture that is kept until the sibling is done.
  const dir = mkdtempSync(path.join(tmpdir(), 'velcro-settle-'));
  const finished = [];
  const sibling = slowWriter(dir, 'sibling.txt', finished);
  try {
    await assert.rejects(Promise.all([failing('first worker failed'), sibling]), /first worker failed/);
    assert.deepEqual(finished, [], 'Promise.all rejected before the sibling finished');
    await sibling;
    assert.deepEqual(finished, ['sibling.txt']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('nested groups drain before their failure reaches the outer group', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'velcro-settle-'));
  const finished = [];
  let seenAtFailure;
  try {
    await settleAll([
      slowWriter(dir, 'outer.txt', finished),
      settleAll([failing('inner worker failed'), slowWriter(dir, 'inner.txt', finished)]),
    ]);
    assert.fail('the inner failure must reject the outer group');
  } catch (error) {
    assert.equal(error.message, 'inner worker failed');
    seenAtFailure = [...finished].sort();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  assert.deepEqual(seenAtFailure, ['inner.txt', 'outer.txt']);
});

test('settleAll rethrows the first failure in input order, not in time', async () => {
  await assert.rejects(settleAll([failing('first by position', 100), failing('first in time', 0), 'value']),
    /first by position/);
});

test('spawnAsync reports results with the spawnSync shape', async () => {
  const [missing, exited, piped, timedOut, flooded] = await settleAll([
    spawnAsync(path.join(tmpdir(), 'velcro-missing-executable'), [], { encoding: 'utf8' }),
    spawnAsync(process.execPath, ['-e', 'process.stderr.write("why"); process.exit(7)'], { encoding: 'utf8' }),
    spawnAsync(process.execPath, ['-e', 'process.stdin.pipe(process.stdout)'], { input: 'fixture input', encoding: 'utf8' }),
    spawnAsync(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], { timeout: 200 }),
    spawnAsync(process.execPath, ['-e', 'process.stdout.write("x".repeat(64)); setTimeout(() => {}, 30000)'], { maxBuffer: 16 }),
  ]);
  // A process that never started: no status, the start error kept (spawnSync: status null, error ENOENT).
  assert.equal(missing.status, null);
  assert.equal(missing.error?.code, 'ENOENT');
  assert.deepEqual([exited.status, exited.signal, exited.stderr, exited.error], [7, null, 'why', undefined]);
  assert.deepEqual([piped.status, piped.stdout], [0, 'fixture input']);
  assert.deepEqual([timedOut.status, timedOut.signal, timedOut.error?.code], [null, 'SIGTERM', 'ETIMEDOUT']);
  assert.deepEqual([flooded.status, flooded.signal, flooded.error?.code], [null, 'SIGTERM', 'ENOBUFS']);
  assert.ok(Buffer.isBuffer(flooded.stdout), 'without an encoding the output stays a Buffer');
});

test('spawnAsync timeout is a hard bound even when a grandchild keeps the output pipes open', async () => {
  const started = Date.now();
  const result = await spawnAsync('sh', ['-c', 'sleep 5 & wait'], { timeout: 200, encoding: 'utf8' });
  assert.deepEqual([result.status, result.signal, result.error?.code], [null, 'SIGTERM', 'ETIMEDOUT']);
  assert.ok(Date.now() - started < 4000, 'the result did not wait for the grandchild');
});
