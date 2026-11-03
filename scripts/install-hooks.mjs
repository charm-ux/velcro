// Explicit opt-in only: core.hooksPath is shared by this repository's worktrees.
import { spawnSync } from 'node:child_process';
import { lstatSync, readFileSync } from 'node:fs';
import { devNull } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installedBinary, verifyExecutable } from './security/gitleaks.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
export function checkHooks() {
  const expected = {
    'pre-commit': "output=$(node scripts/security/git-privacy.mjs identity 2>&1) && output=$(node scripts/security/git-privacy.mjs staged 2>&1) || { echo 'hook: required check failed' >&2; exit 1; }\n",
    'commit-msg': `output=$(node scripts/security/git-privacy.mjs message "$1" 2>&1) || { echo 'hook: required check failed' >&2; exit 1; }\n`,
    'pre-push': `if output=$(node scripts/security/git-privacy.mjs pre-push "$1" 2>&1); then printf '%s\\n' "$output"; else echo 'hook: required check failed' >&2; exit 1; fi\n`,
  };
  for (const [name, text] of Object.entries(expected)) {
    const file = path.join(root, '.githooks', name);
    const stat = lstatSync(file);
    if (!stat.isFile() || !(stat.mode & 0o111) || readFileSync(file, 'utf8') !== text) throw new Error('invalid hooks');
  }
}

if (import.meta.main) {
  try {
    if (process.argv.slice(2).join(' ') !== '--local') throw new Error('explicit opt-in required');
    checkHooks();
    verifyExecutable(installedBinary());
    const env = { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: devNull, GIT_NO_REPLACE_OBJECTS: '1', GIT_NO_LAZY_FETCH: '1' };
    for (const key of ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP']) {
      if (process.env[key] !== undefined) env[key] = process.env[key];
    }
    const top = spawnSync('git', ['-C', root, 'rev-parse', '--show-toplevel'],
      { env, encoding: 'utf8', stdio: 'pipe', timeout: 10000 });
    if (top.error || top.status !== 0 || path.resolve(top.stdout.trim()) !== path.resolve(root)) throw new Error('wrong repository');
    // Installation is after manual initial trust, never a prerequisite for
    // creating the first reviewed public main. No fetch or trust marker is made.
    const anchor = spawnSync('git', ['-C', root, 'rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main'],
      { env, encoding: 'utf8', stdio: 'pipe', timeout: 10000 });
    const oid = anchor.stdout?.trim();
    const symbolic = spawnSync('git', ['-C', root, 'symbolic-ref', '-q', 'refs/remotes/origin/main'],
      { env, stdio: 'pipe', timeout: 10000 });
    if (anchor.error || anchor.status !== 0 || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(oid)
      || symbolic.error || symbolic.status !== 1) throw new Error('trusted baseline unavailable');
    const type = spawnSync('git', ['-C', root, 'cat-file', '-t', oid],
      { env, encoding: 'utf8', stdio: 'pipe', timeout: 10000 });
    if (type.error || type.status !== 0 || type.stdout.trim() !== 'commit') throw new Error('trusted baseline unavailable');
    const result = spawnSync('git', ['-C', root, 'config', '--local', 'core.hooksPath', '.githooks'],
      { env, stdio: 'pipe', timeout: 10000 });
    if (result.error || result.status !== 0) throw new Error('configuration failed');
    process.stdout.write('hooks: repository-local opt-in installed; applies to all worktrees\n');
  } catch {
    process.stderr.write('hooks: refused; require --local, complete hooks, pinned scanner and existing trusted main baseline\n');
    process.exitCode = 2;
  }
}
