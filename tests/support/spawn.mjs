// Shared by the slow subprocess-heavy test files: an asynchronous stand-in for spawnSync, so independent tests in one
// file can run their subprocesses at the same time instead of blocking the event loop one after another.
import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';

// How many tests of one suite may run at once. Each test owns its own temporary fixtures; suites that change
// process-wide state (process.env, the working directory) stay serial.
export const TEST_CONCURRENCY = Math.max(2, Math.min(8, availableParallelism()));

// Same inputs and result shape as spawnSync for the options these tests use: cwd, env, input, encoding, timeout,
// maxBuffer and stdio. `status` is null and `signal` is set when the process was killed (including on timeout);
// `error` is set when it could not be started, timed out or exceeded maxBuffer.
export function spawnAsync(file, args = [], options = {}) {
  // maxBuffer defaults to spawnSync's 1 MiB, so an unexpectedly large output fails the same way.
  const { input, encoding, timeout, maxBuffer = 1024 * 1024, stdio, ...rest } = options;
  return new Promise((resolve) => {
    const stdin = input === undefined ? (stdio?.[0] ?? 'ignore') : 'pipe';
    const child = spawn(file, args, { ...rest, stdio: [stdin, stdio?.[1] ?? 'pipe', stdio?.[2] ?? 'pipe'] });
    const out = [];
    const err = [];
    let error;
    let timer;
    const kill = (reason) => {
      error ??= reason;
      child.kill('SIGTERM');
    };
    // Like spawnSync, the bound applies to stdout and stderr separately.
    const collect = (chunks) => {
      let size = 0;
      return (chunk) => {
        size += chunk.length;
        if (size > maxBuffer) kill(Object.assign(new Error('maxBuffer exceeded'), { code: 'ENOBUFS' }));
        else chunks.push(chunk);
      };
    };
    child.stdout?.on('data', collect(out));
    child.stderr?.on('data', collect(err));
    if (timeout) timer = setTimeout(() => kill(Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' })), timeout);
    child.on('error', (caught) => {
      error ??= caught;
    });
    child.on('close', (status, signal) => {
      clearTimeout(timer);
      const decode = (chunks) => {
        const buffer = Buffer.concat(chunks);
        return encoding && encoding !== 'buffer' ? buffer.toString(encoding) : buffer;
      };
      // A process that never started has no exit status (spawnSync reports null, not the negative errno).
      const started = child.pid !== undefined;
      resolve({ pid: child.pid, status: started ? status : null, signal, stdout: decode(out), stderr: decode(err), error });
    });
    if (input !== undefined) {
      // A child that exits without reading its input must not fail the caller (EPIPE).
      child.stdin.on('error', () => {});
      child.stdin.end(input);
    }
  });
}
