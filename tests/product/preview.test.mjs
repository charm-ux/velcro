import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { get } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loopbackHost, startPreview } from '../../packages/docs/scripts/preview.mjs';

const previewScript = fileURLToPath(new URL('../../packages/docs/scripts/preview.mjs', import.meta.url));
const SENTINEL = 'OUTSIDE-SENTINEL-CONTENT';

function request(port, path) {
  return new Promise((resolve, reject) =>
    get({ host: loopbackHost, port, path }, res => {
      let body = '';
      res.on('data', chunk => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject)
  );
}

// A temp parent holds the served subdirectory, an outside sentinel file, and a symlink inside pointing at that file.
function fixture() {
  const parent = mkdtempSync(join(tmpdir(), 'velcro-preview-'));
  const root = join(parent, 'root');
  mkdirSync(root);
  writeFileSync(join(root, 'index.html'), 'ok');
  writeFileSync(join(parent, 'secret.txt'), SENTINEL);
  symlinkSync(join(parent, 'secret.txt'), join(root, 'link.txt'));
  return { parent, root };
}

const escapes = ['/../secret.txt', '/..%2fsecret.txt', '/%2e%2e/secret.txt', '/%2e%2e%2fsecret.txt', '/a/../../secret.txt', '/link.txt'];

async function probe(start) {
  const { root } = fixture();
  const server = await start({ port: 0, root });
  try {
    const port = server.address().port;
    return await Promise.all(escapes.map(async path => ({ path, ...(await request(port, path)) })));
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('preview server binds to IPv4 loopback by default, not all interfaces', async () => {
  const { root } = fixture();
  const server = await startPreview({ port: 0, root });
  try {
    const { address, family } = server.address();
    assert.equal(address, loopbackHost);
    assert.equal(family, 'IPv4');
    assert.notEqual(address, ['0', '0', '0', '0'].join('.'));
    assert.notEqual(address, '::');
    assert.deepEqual(await request(server.address().port, '/'), { status: 200, body: 'ok' });
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('plain, encoded and symlink escapes to an existing outside file get exactly 403', async () => {
  for (const result of await probe(startPreview)) {
    assert.equal(result.status, 403, result.path);
    assert.ok(!result.body.includes(SENTINEL), `${result.path} leaked the sentinel`);
  }
});

test('negative control: removing the containment guard makes the escape check fail', async () => {
  const source = readFileSync(previewScript, 'utf8');
  // The mutant lives in a temp directory, so its relative import of the base-path validator must become absolute.
  const siteBase = pathToFileURL(fileURLToPath(new URL('../../packages/docs/site-base.ts', import.meta.url))).href;
  const mutated = source.replace("'../site-base.ts'", JSON.stringify(siteBase)).replace(/export function isInside\([^)]*\) \{[\s\S]*?\n\}/, 'export function isInside() {\n  return true;\n}');
  assert.notEqual(mutated, source, 'guard not found; update this control');
  const dir = mkdtempSync(join(tmpdir(), 'velcro-mutant-'));
  const file = join(dir, 'preview.mjs');
  writeFileSync(file, mutated);
  const mutant = await import(pathToFileURL(file).href);
  const results = await probe(mutant.startPreview);
  assert.ok(results.some(r => r.status !== 403 || r.body.includes(SENTINEL)), 'mutant still passed the oracle');
});

test('malformed URLs and unreadable files get controlled errors and the process keeps serving', async () => {
  const { parent, root } = fixture();
  writeFileSync(join(root, 'locked.txt'), 'x');
  chmodSync(join(root, 'locked.txt'), 0o000);
  const child = spawn(process.execPath, [previewScript], { env: { ...process.env, PORT: '0', PREVIEW_ROOT: root }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const port = await new Promise((resolve, reject) => {
      let out = '';
      child.stdout.on('data', chunk => {
        out += chunk;
        const match = /port (\d+)/.exec(out);
        if (match) resolve(Number(match[1]));
      });
      child.once('exit', code => reject(new Error(`preview exited early (${code})`)));
    });
    for (const path of ['/%', '/%E0%A4%A', '/%00']) {
      const { status, body } = await request(port, path);
      assert.equal(status, 400, path);
      assert.ok(!body.includes(root) && !body.includes(parent));
    }
    const locked = await request(port, '/locked.txt');
    assert.equal(locked.status, 500, `locked file status ${locked.status}`);
    assert.ok(!locked.body.includes(root) && !locked.body.includes(parent));
    assert.deepEqual(await request(port, '/'), { status: 200, body: 'ok' });
    assert.equal(child.exitCode, null, 'preview process exited');
  } finally {
    child.kill();
    chmodSync(join(root, 'locked.txt'), 0o600);
  }
});
