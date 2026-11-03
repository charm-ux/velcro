// Raw subprocess output is private evidence, never workflow diagnostics.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkHooks } from './install-hooks.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
try {
  const pkg = JSON.parse((await import('node:fs')).readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (process.versions.node !== pkg.engines.node) throw new Error('runtime mismatch');
  const ignored = spawnSync('git', ['-C', root, 'check-ignore', '-q', '--', '.airig/verify/evidence'], { stdio: 'pipe' });
  if (ignored.status !== 0 || ignored.error) throw new Error('scratch not ignored');
  mkdirSync(path.join(root, '.airig/verify'), { recursive: true, mode: 0o700 });
  const scratch = mkdtempSync(path.join(root, '.airig/verify/run-'));
  function run(label, file, args, extra = {}) {
    const result = spawnSync(file, args, { cwd: root, env: { ...process.env, VELCRO_REQUIRE_GITLEAKS: '1' },
      timeout: 600000, maxBuffer: 32 * 1024 * 1024, encoding: 'utf8', shell: false });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    writeFileSync(path.join(scratch, `${label}.log`), output, { mode: 0o600 });
    if (result.error || result.signal || result.status !== 0 || (extra.tests &&
      (!/^# tests [1-9][0-9]*$/m.test(output) || !/^# skipped 0$/m.test(output)
        || !/^# todo 0$/m.test(output) || /# SKIP\b/.test(output)))) {
      process.stdout.write(`verify: ${label} failed; evidence retained in ignored scratch\n`);
      throw new Error('check failed');
    }
    process.stdout.write(`verify: ${label} passed\n`);
    return output.trim();
  }
  const version = run('pnpm', 'pnpm', ['--version']);
  if (`pnpm@${version}` !== pkg.packageManager) throw new Error('package manager mismatch');
  checkHooks();
  process.stdout.write('verify: hook files complete (installation is separate opt-in)\n');
  run('scanner', process.execPath, ['scripts/security/gitleaks.mjs', 'version']);
  run('tests', process.execPath, ['--test', '--test-reporter=tap', 'tests/**/*.test.mjs'], { tests: true });
  run('staged', process.execPath, ['scripts/security/git-privacy.mjs', 'staged']);
  process.stdout.write('verify: local checks passed; no publication or human approval implied\n');
} catch {
  process.stderr.write('verify: blocked; required check or pinned tool unavailable/unsuccessful\n');
  process.exitCode = 1;
}
