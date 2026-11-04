// Builds the static site for a project-site prefix and keeps it apart from the root build:
// `LITRO_BASE_PATH=/velcro` (or the first argument) is validated, the normal build runs with it, and the output moves
// from dist/static to dist/static-prefixed. The files inside are laid out for the site root; the host adds the prefix.
// Caveat: it replaces any root build in dist/static, and a failed build leaves partial output there. Build the root site after it.
import { spawnSync } from 'node:child_process';
import { renameSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseSiteBase } from '../site-base.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
let base;
try {
  base = parseSiteBase(process.argv[2] ?? process.env.LITRO_BASE_PATH ?? '/velcro');
} catch (error) {
  process.stderr.write(`build:prefixed: ${error.message}\n`);
  process.exit(1);
}
if (!base) {
  process.stderr.write('build:prefixed: a non-empty base path is required; use `build` for the root site.\n');
  process.exit(1);
}

const result = spawnSync('pnpm', ['run', 'build'], { cwd: root, stdio: 'inherit', env: { ...process.env, LITRO_BASE_PATH: base } });
if (result.error || result.status !== 0) process.exit(result.status ?? 1);

rmSync(`${root}dist/static-prefixed`, { recursive: true, force: true });
renameSync(`${root}dist/static`, `${root}dist/static-prefixed`);
process.stdout.write(`build:prefixed: dist/static-prefixed built for base ${base}\n`);
