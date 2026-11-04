import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { get } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { startPreview, loopbackHost } from '../../packages/docs/scripts/preview.mjs';
import { parseSiteBase } from '../../packages/docs/site-base.ts';

test('base path input: empty means root, plain prefixes pass through', () => {
  assert.equal(parseSiteBase(undefined), '');
  assert.equal(parseSiteBase(''), '');
  assert.equal(parseSiteBase('/velcro'), '/velcro');
  assert.equal(parseSiteBase('/a/b-c-d.e'), '/a/b-c-d.e');
  // Boundaries: single character, digits first, dots and tildes inside, many segments, a long segment.
  for (const ok of ['/a', '/Z', '/9', '/v1.2~x', '/a.b', '/a/b/c/d/e', `/${'a'.repeat(200)}`]) assert.equal(parseSiteBase(ok), ok);
});

test('base path input: line terminators anywhere are rejected, as is any other control or separator character', () => {
  const terminators = ['\n', '\r', '\r\n', '\u2028', '\u2029', '\u0085', '\v', '\f', '\0'];
  for (const t of terminators) {
    for (const bad of [`/velcro${t}`, `/${t}velcro`, `/vel${t}cro`, `/a${t}/b`, `/a/b${t}`, `${t}/velcro`, `/a${t}/`]) {
      assert.throws(() => parseSiteBase(bad), /LITRO_BASE_PATH/, JSON.stringify(bad));
    }
  }
  for (const bad of ['/velcro ', ' /velcro', '/vel cro', '/velcro\t', '/velcro\u00a0', '/vélcro', '/velcro\u200b']) {
    assert.throws(() => parseSiteBase(bad), /LITRO_BASE_PATH/, JSON.stringify(bad));
  }
});

test('base path input: malformed values are rejected before any build runs', () => {
  for (const bad of ['/', 'velcro', '/velcro/', '//velcro', '/velcro//x', '/..', '/a/../b', '/.', '/a b', '/a?x', '/a#x', '/a\\b', '/%2e', 'https://example.invalid/x', '/-x']) {
    assert.throws(() => parseSiteBase(bad), /LITRO_BASE_PATH/, JSON.stringify(bad));
  }
});

function request(port, path) {
  return new Promise((resolve, reject) =>
    get({ host: loopbackHost, port, path }, res => {
      let body = '';
      res.on('data', chunk => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode, location: res.headers.location, body }));
    }).on('error', reject)
  );
}

test('preview with a prefix serves only under it and mirrors project-site redirects', async () => {
  const root = mkdtempSync(join(tmpdir(), 'velcro-prefix-'));
  mkdirSync(join(root, 'components'));
  writeFileSync(join(root, 'index.html'), 'home');
  writeFileSync(join(root, 'components', 'x.html'), 'x');
  const server = await startPreview({ port: 0, root, base: '/velcro' });
  try {
    const { port } = server.address();
    assert.equal((await request(port, '/velcro/')).body, 'home');
    assert.equal((await request(port, '/velcro/components/x')).body, 'x');
    assert.deepEqual(await request(port, '/velcro').then(r => [r.status, r.location]), [301, '/velcro/']);
    for (const outside of ['/', '/index.html', '/components/x', '/velcrox/', '/other/velcro/']) {
      assert.equal((await request(port, outside)).status, 404, outside);
    }
    for (const escape of ['/velcro/../index.html', '/velcro/%2e%2e/index.html']) {
      const result = await request(port, escape);
      assert.notEqual(result.body, 'home', escape);
      assert.equal(result.status, 403, escape);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
