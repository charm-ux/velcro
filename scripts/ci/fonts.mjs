// Gives a CI browser job in the official Playwright container image the default fonts the hosted Ubuntu 24.04 runners have.
// The image ships no DejaVu fonts, so fontconfig resolves `sans-serif` and `system-ui` to WenQuanYi Zen Hei (a large CJK
// collection) and `serif` and `monospace` to other fallbacks, where the hosted runners (and the jobs before the image)
// resolve them to DejaVu Sans, DejaVu Serif and DejaVu Sans Mono. That changes text metrics in every engine and slows WebKit.
// The fonts come from Ubuntu 24.04's own packages, pinned here by size and SHA-256 (the values Ubuntu's signed archive index
// lists for them); a download that does not match is never used. Each package is unpacked with `dpkg-deb -x` into a
// temporary directory (no apt, no root, no maintainer scripts). Its regular `.ttf` files are copied into the user's font
// directory and the fontconfig rules the package enables (its `conf.d` entries: DejaVu's family preferences and small-size
// hinting) into the user's fontconfig `conf.d`, so text renders as on the hosted runners. The job then must resolve the
// three generic families to DejaVu, or it stops. Only fixed status
// lines are printed, never a path, URL or tool output.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const ARCHIVE = 'https://archive.ubuntu.com/ubuntu/';
export const FONT_PACKAGES = Object.freeze([
  Object.freeze({ name: 'fonts-dejavu-core', version: '2.37-8', file: 'pool/main/f/fonts-dejavu/fonts-dejavu-core_2.37-8_all.deb',
    size: 835172, sha256: '40049660c194f3b8a2541fc7369efebb10e9f94bdac836a2f38fafedd10fa73a' }),
  Object.freeze({ name: 'fonts-dejavu-extra', version: '2.37-8', file: 'pool/main/f/fonts-dejavu/fonts-dejavu-extra_2.37-8_all.deb',
    size: 1947322, sha256: '5502e5ccc416683e5251dc105b37be31158bc2e02133221e56524ea2a8e426fe' }),
  Object.freeze({ name: 'fonts-dejavu-mono', version: '2.37-8', file: 'pool/main/f/fonts-dejavu/fonts-dejavu-mono_2.37-8_all.deb',
    size: 502232, sha256: '8a599d6553307db7ecb795d2f0e5a301e03234afc75c7358b0ba43466454c89a' }),
]);
// What fontconfig must resolve each generic family to afterwards (the hosted runners' defaults).
export const EXPECTED_DEFAULTS = Object.freeze({ 'sans-serif': 'DejaVu Sans', serif: 'DejaVu Serif', monospace: 'DejaVu Sans Mono' });
const ATTEMPTS = 3;
const ATTEMPT_TIMEOUT_MS = 30_000;
const RETRY_WAIT_MS = 5_000;

export class FontError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
const fail = code => { throw new FontError(code); };

// The exact pinned bytes of a package, or a failure; never a near match.
export function checkBytes(bytes, pkg) {
  if (!Buffer.isBuffer(bytes) || bytes.length !== pkg.size) fail('size-mismatch');
  if (createHash('sha256').update(bytes).digest('hex') !== pkg.sha256) fail('checksum-mismatch');
  return bytes;
}

// Downloads one package. Only transport failures (network errors, timeouts, HTTP 5xx) are retried, a bounded number of
// times; any other status, a wrong size or a wrong checksum fails at once.
export async function download(pkg, { fetchImpl = fetch, wait = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  for (let attempt = 1; ; attempt++) {
    let transient = false;
    try {
      const res = await fetchImpl(new URL(pkg.file, ARCHIVE), { redirect: 'error', signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS) });
      if (res.status >= 500) transient = true;
      else if (res.status !== 200) fail('http-status');
      else {
        const declared = Number(res.headers.get('content-length'));
        if (Number.isFinite(declared) && declared > pkg.size) fail('size-mismatch');
        return checkBytes(Buffer.from(await res.arrayBuffer()), pkg);
      }
    } catch (e) {
      if (e instanceof FontError) throw e;
      transient = true;
    }
    if (!transient || attempt >= ATTEMPTS) fail('download-failed');
    await wait(RETRY_WAIT_MS * attempt);
  }
}

// Every regular `.ttf` file under `dir` (symlinks and anything else are skipped).
export function fontFiles(dir) {
  const found = [];
  const walk = d => {
    for (const entry of readdirSync(d)) {
      const p = path.join(d, entry);
      const st = lstatSync(p);
      if (st.isDirectory()) walk(p);
      else if (st.isFile() && entry.endsWith('.ttf')) found.push(p);
    }
  };
  walk(dir);
  return found.sort();
}

// The fontconfig rules a package enables: each regular file in its `etc/fonts/conf.avail` that its `etc/fonts/conf.d` names.
export function enabledRules(dir) {
  const avail = path.join(dir, 'etc', 'fonts', 'conf.avail');
  const enabled = path.join(dir, 'etc', 'fonts', 'conf.d');
  let names;
  try { names = readdirSync(enabled); } catch { return []; }
  return names.filter(n => /^[0-9]{2}-[a-z0-9-]+\.conf$/.test(n)).sort().map(n => path.join(avail, n)).filter(f => {
    try { return lstatSync(f).isFile(); } catch { return false; }
  });
}

const xdg = (env, key, ...fallback) => env[key] && path.isAbsolute(env[key]) ? env[key] : path.join(os.homedir(), ...fallback);
// The user's font and fontconfig rule directories, which fontconfig's default configuration reads
// (`$XDG_DATA_HOME/fonts` and `$XDG_CONFIG_HOME/fontconfig/conf.d`).
export function fontDir(env = process.env) {
  return path.join(xdg(env, 'XDG_DATA_HOME', '.local', 'share'), 'fonts', 'velcro-dejavu');
}
export function ruleDir(env = process.env) {
  return path.join(xdg(env, 'XDG_CONFIG_HOME', '.config'), 'fontconfig', 'conf.d');
}

export function resolvedDefaults(run = spawnSync) {
  const out = {};
  for (const family of Object.keys(EXPECTED_DEFAULTS)) {
    const r = run('fc-match', ['-f', '%{family[0]}', family], { encoding: 'utf8', timeout: 30_000, stdio: ['ignore', 'pipe', 'pipe'] });
    out[family] = r.status === 0 && typeof r.stdout === 'string' ? r.stdout.trim() : '';
  }
  return out;
}

export async function installFonts({ target = fontDir(), rules = ruleDir(), fetchImpl = fetch, run = spawnSync } = {}) {
  const scratch = mkdtempSync(path.join(os.tmpdir(), 'velcro-fonts-'));
  try {
    mkdirSync(target, { recursive: true });
    mkdirSync(rules, { recursive: true });
    let copied = 0;
    let ruleCount = 0;
    for (const pkg of FONT_PACKAGES) {
      const deb = path.join(scratch, `${pkg.name}.deb`);
      writeFileSync(deb, await download(pkg, { fetchImpl }), { mode: 0o600 });
      const out = path.join(scratch, pkg.name);
      mkdirSync(out);
      const x = run('dpkg-deb', ['-x', deb, out], { timeout: 60_000, stdio: 'ignore' });
      if (x.status !== 0) fail('unpack-failed');
      const files = fontFiles(out);
      if (!files.length) fail('no-fonts');
      for (const f of files) copyFileSync(f, path.join(target, path.basename(f)));
      copied += files.length;
      for (const f of enabledRules(out)) copyFileSync(f, path.join(rules, path.basename(f)));
      ruleCount += enabledRules(out).length;
    }
    const cache = run('fc-cache', ['-f', target], { timeout: 120_000, stdio: 'ignore' });
    if (cache.status !== 0) fail('cache-failed');
    const defaults = resolvedDefaults(run);
    for (const [family, expected] of Object.entries(EXPECTED_DEFAULTS)) if (defaults[family] !== expected) fail('defaults-mismatch');
    return { copied, rules: ruleCount, defaults };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  try {
    if (process.argv.length !== 2) fail('usage');
    const { copied, rules, defaults } = await installFonts();
    const version = FONT_PACKAGES[0].version;
    process.stdout.write(`fonts: passed (DejaVu ${version}, ${copied} fonts, ${rules} rules; ${Object.entries(defaults).map(([f, v]) => `${f} ${v}`).join(', ')})\n`);
  } catch (e) {
    const code = e instanceof FontError ? e.message : 'install-failed';
    process.stdout.write(`fonts: blocked (${code})\n`);
    process.exitCode = 1;
  }
}
