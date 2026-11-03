import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanText, formatFindings, loadPolicy } from '../../scripts/security/privacy.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const cli = path.join(root, 'scripts/security/privacy.mjs');
const person = ['synthetic', 'person'].join('-');
const email = `${person}@${['private', 'example'].join('.')}`;
const home = ['','home',person,'checkout'].join('/');
const shebang = ['#!', 'usr', 'bin', 'env node'].join('/');
const policy = await loadPolicy(root);

test('candidate policy metadata remains narrow without adopting candidate rules', () => {
  const candidate = structuredClone(policy);
  candidate.forbiddenDirectories.push('extra-private');
  assert.deepEqual(scanText(JSON.stringify(candidate, null, 2), 'security/policy.json', { policy }), []);
  candidate.exceptions[0].purpose = policy.approvedIdentity.email;
  assert.ok(scanText(JSON.stringify(candidate, null, 2), 'security/policy.json', { policy })
    .some(f => f.rule === 'email' && f.line > 1));
  candidate.exceptions[0].purpose = JSON.stringify({ approvedIdentity: policy.approvedIdentity });
  assert.ok(scanText(JSON.stringify(candidate), 'security/policy.json', { policy }).some(f => f.rule === 'email'));
  candidate.exceptions[0].purpose = shebang;
  assert.ok(scanText(JSON.stringify(candidate), 'security/policy.json', { policy }).some(f => f.rule === 'machine-path'));
  candidate.exceptions[0].purpose = 'Standard interpreter metadata';
  candidate.approvedIdentity.email = email;
  assert.ok(scanText(JSON.stringify(candidate), 'security/policy.json', { policy }).some(f => f.rule === 'email'));
  const other = structuredClone(policy);
  other.exceptions[0].path = 'scripts/unreviewed.mjs';
  assert.deepEqual(scanText(JSON.stringify(other), 'security/policy.json', { policy }), []);
  assert.ok(scanText(shebang, 'scripts/unreviewed.mjs', { policy }).some(f => f.rule === 'machine-path'));
  const duplicate = JSON.stringify(policy).replace('"approvedIdentity":', `"approvedIdentity":{},"approvedIdentity":`);
  assert.ok(scanText(duplicate, 'security/policy.json', { policy }).some(f => f.rule === 'email'));
});

function jsDeclaration(key, rhs, kind = 'const') {
  return `${kind} ${key} = ${rhs};`;
}

function safeOutput(result, values = []) {
  const output = `${result.stdout}${result.stderr}`;
  for (const value of [root, home, email, ...values]) {
    assert.equal(output.includes(value), false, 'diagnostics must not disclose input');
  }
  return output;
}

async function fixture(t) {
  await mkdir(path.join(root, '.airig', 'privacy-tests'), { recursive: true });
  const dir = await mkdtemp(path.join(root, '.airig', 'privacy-tests', 'case-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  assert.equal(spawnSync('git', ['-C', dir, 'init', '-q']).status, 0);
  await mkdir(path.join(dir, 'security'));
  await writeFile(path.join(dir, 'security/policy.json'), JSON.stringify(policy));
  return dir;
}

function run(dir, ...args) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: dir, encoding: 'utf8', timeout: 60000 });
}

test('detects machine locations in plain and encoded forms without excerpts', () => {
  const drive = `${String.fromCharCode(67)}:\\${['Users', person, 'file'].join('\\')}`;
  const unc = `${'\\'.repeat(2)}${person}\\share\\file`;
  const cases = [home, drive, drive.replaceAll('\\', '/'), unc,
    `${String.fromCharCode(126)}/${person}`, `~${person}/file`, '$' + 'HOME/file', '${' + 'HOME}/file',
    '%' + 'USERPROFILE%\\file', `file://${home}`, encodeURIComponent(home),
    JSON.stringify(drive), home.replaceAll('/', '\\u002f'),
    Buffer.from(home).toString('base64'), Buffer.from(email).toString('base64'),
    home.replaceAll('/', '&#47;'), home.replaceAll('/', '\\x2f')];
  for (const value of cases) {
    const findings = scanText(`clean\n${value}`, 'docs/example.md', { policy });
    assert.ok(findings.length > 0, 'synthetic private representation must be found');
    assert.ok(findings.some(f => f.line === 2));
    assert.ok(findings.every(f => Object.keys(f).sort().join() === 'line,path,rule'));
    assert.equal(JSON.stringify(findings).includes(person), false);
  }
});

test('detects email, private hosts, endpoints and identifying key/value forms', () => {
  const cases = [email, `https://${person}.internal/api`, `${person}.local`,
    ['192', '168', '4', '5'].join('.'), ['10', '3', '2', '1'].join('.'),
    ['172', '20', '1', '2'].join('.'), `http://${['local', 'host'].join('')}:3000`,
    `http://[${['', '', '1'].join(':')}]/`,
    `hostname=${person}`, `username: ${person}`, `"userName": "${person}"`];
  for (const value of cases) assert.ok(scanText(value, 'example.txt', { policy }).length);
});

test('preserves portable routes, imports, public URLs, versions and exact shebang', () => {
  const text = ['import x from "@charm-ux/velcro";', './src/index.js', '../styles.css',
    '/api/components', '/docs/start', 'https://github.com/charm-ux/velcro',
    'https://example.com/api', '// public comment', '2.20.1', '24.22.1',
    './home/index.js', '../usr/styles.css', 'package@1.2.3'].join('\n');
  assert.deepEqual(scanText(text, 'docs/example.md', { policy }), []);
  assert.deepEqual(scanText(`${shebang}\n`, 'scripts/security/privacy.mjs', { policy }), []);
  assert.ok(scanText(`${shebang}\n`, 'other.mjs', { policy }).length);
});

test('default API and scanner-owned files are clean without source-wide exceptions', () => {
  assert.deepEqual(scanText('/api/components', 'example.md'), []);
  const result = run(root, 'files', 'security/policy.json', 'scripts/security/privacy.mjs',
    'tests/security/privacy.test.mjs');
  assert.equal(result.status, 0, 'owned portable source must pass its own scanner');
  safeOutput(result);
});

test('approved identity is scoped to validated policy metadata or explicit identity context', async () => {
  const text = await readFile(path.join(root, 'security/policy.json'), 'utf8');
  assert.deepEqual(scanText(text, 'security/policy.json', { policy }), []);
  assert.ok(scanText(text, 'other.json', { policy }).length);
  assert.ok(scanText(policy.approvedIdentity.email, 'docs/example.md', { policy }).length);
  assert.deepEqual(scanText(`${policy.approvedIdentity.name} <${policy.approvedIdentity.email}>`,
    'commit-author', { policy, context: 'identity' }), []);
  const altered = JSON.parse(text);
  altered.extra = email;
  assert.ok(scanText(JSON.stringify(altered), 'security/policy.json', { policy }).length);
  assert.ok(scanText(`${email}\n${policy.approvedIdentity.email}`, 'commit-author',
    { policy, context: 'identity' }).length);
  const duplicate = JSON.stringify(policy).replace('"version":1',
    `"version":${JSON.stringify(policy.approvedIdentity.email)},"version":1`);
  assert.ok(scanText(duplicate, 'security/policy.json', { policy }).length);
});

test('unsafe labels and runtime filenames are redacted, including encoded labels', () => {
  for (const label of [home, `docs/${email}.txt`, `docs/${encodeURIComponent(email)}.txt`,
    '.airig/brief.md', 'nested/.worktrees/session.txt', '.AIRIG/brief.md',
    '../escape.txt', 'docs/line\nbreak.txt']) {
    const findings = scanText('clean', label, { policy });
    assert.ok(findings.length);
    const output = formatFindings(findings);
    for (const value of [home, email, encodeURIComponent(email)]) assert.equal(output.includes(value), false);
  }
  const output = formatFindings([{ rule: email, path: home, line: -1 },
    { rule: 'email', path: `docs/${email}`, line: 1 }]);
  assert.equal(output.includes(email), false);
  assert.equal(output.includes(home), false);
});

test('policy loader fails closed on missing, malformed and broad exceptions', async t => {
  const dir = await fixture(t);
  for (const value of ['{', '{}', JSON.stringify({ ...policy, exceptions: [{ path: '**', rule: 'email', text: email }] }),
    JSON.stringify({ ...policy, approvedIdentity: { name: person, email } }),
    JSON.stringify({ ...policy, forbiddenDirectories: [] })]) {
    await writeFile(path.join(dir, 'security/policy.json'), value);
    await assert.rejects(loadPolicy(dir), e => !e.message.includes(dir) && !e.message.includes(email));
    const result = run(dir, 'files', 'security/policy.json');
    assert.equal(result.status, 2);
    safeOutput(result, [dir]);
  }
  await rm(path.join(dir, 'security/policy.json'));
  assert.equal(run(dir, 'files', 'security/policy.json').status, 2);
});

test('CLI scans only explicit text inputs and recursive directories with exit codes', async t => {
  const dir = await fixture(t);
  await mkdir(path.join(dir, 'docs'));
  await writeFile(path.join(dir, 'docs/clean.txt'), '/api/components\n@charm-ux/velcro');
  await writeFile(path.join(dir, 'unrequested.txt'), home);
  let result = run(dir, 'files', 'docs');
  assert.equal(result.status, 0);
  safeOutput(result, [dir]);
  await writeFile(path.join(dir, 'docs/bad.txt'), `ok\n${home}\n${email}`);
  result = run(dir, 'files', 'docs');
  assert.equal(result.status, 1);
  assert.match(safeOutput(result, [dir]), /docs\/bad\.txt:2/);
  assert.equal(run(dir, 'files', 'security/policy.json').status, 0);
});

test('CLI redacts hostile filename, input and filesystem failures', async t => {
  const dir = await fixture(t);
  const filename = `${email}.txt`;
  await writeFile(path.join(dir, filename), email);
  let result = run(dir, 'files', filename);
  assert.equal(result.status, 1);
  safeOutput(result, [dir, filename]);
  for (const args of [['files', path.join(dir, `${person}-missing`)], ['files', home],
    ['files', '../escape'], ['files'], [email], ['files', '--bad']]) {
    result = run(dir, ...args);
    assert.equal(result.status, 2);
    safeOutput(result, [dir, person]);
  }
});

test('CLI refuses binary, invalid UTF-8, symlinks and runtime directory inputs', async t => {
  const dir = await fixture(t);
  for (const bytes of [Buffer.from([0, 1, 2]), Buffer.from([0xff, 0xfe]), Buffer.from([27, 0x41])]) {
    await writeFile(path.join(dir, 'binary.dat'), bytes);
    const result = run(dir, 'files', 'binary.dat');
    assert.equal(result.status, 2);
    safeOutput(result, [dir]);
  }
  await writeFile(path.join(dir, 'clean.txt'), 'clean');
  await symlink('clean.txt', path.join(dir, 'link.txt'));
  await symlink('..', path.join(dir, 'escape'));
  for (const input of ['link.txt', 'escape/security-privacy.md']) {
    const result = run(dir, 'files', input);
    assert.equal(result.status, 2);
    safeOutput(result, [dir]);
  }
  await mkdir(path.join(dir, '.airig'));
  await writeFile(path.join(dir, '.airig/brief.txt'), 'clean');
  const result = run(dir, 'files', '.airig');
  assert.equal(result.status, 1);
  safeOutput(result, [dir]);
});

test('policy symlink is an infrastructure failure', async t => {
  const dir = await fixture(t);
  await writeFile(path.join(dir, 'copy.json'), JSON.stringify(policy));
  await rm(path.join(dir, 'security/policy.json'));
  await symlink('../copy.json', path.join(dir, 'security/policy.json'));
  const result = run(dir, 'files', 'copy.json');
  assert.equal(result.status, 2);
  safeOutput(result, [dir]);
});

test('scanner failures have safe messages and stacks, and excessive decoding fails closed', async t => {
  const dir = await fixture(t);
  await writeFile(path.join(dir, 'security/policy.json'), email);
  await assert.rejects(loadPolicy(dir), error => {
    for (const value of [root, dir, email]) assert.equal(String(error.stack).includes(value), false);
    return true;
  });
  let encoded = home;
  for (let i = 0; i < 7; i++) encoded = encodeURIComponent(encoded);
  assert.throws(() => scanText(encoded, 'example.txt', { policy }), /privacy:/);
  assert.throws(() => scanText('clean', 'example.txt', null), /privacy:/);
  // Deliberately retain a fail-closed limit on unusually deep backslash escaping.
  assert.throws(() => scanText(String.fromCharCode(92).repeat(256), 'example.js', { policy }), /privacy:/);
});

test('CLI bounds oversized input and rejects symlink ancestors of regular files', async t => {
  const dir = await fixture(t);
  await writeFile(path.join(dir, 'large.txt'), Buffer.alloc(8 * 1024 * 1024 + 1, 0x61));
  let result = run(dir, 'files', 'large.txt');
  assert.equal(result.status, 2);
  safeOutput(result, [dir]);
  await mkdir(path.join(dir, 'nested'));
  await writeFile(path.join(dir, 'nested/clean.txt'), 'clean');
  await symlink('nested', path.join(dir, 'alias'));
  result = run(dir, 'files', 'alias/clean.txt');
  assert.equal(result.status, 2);
  safeOutput(result, [dir]);
});

test('private IPv6 endpoints and mailto short-host addresses are detected', () => {
  for (const value of [`https://[${['fd12', '3456', '', '1'].join(':')}]/api`,
    ['fe80', '', '1'].join(':'), `mailto:${person}@${['local', 'host'].join('')}`]) {
    assert.ok(scanText(value, 'example.md', { policy }).length);
  }
});

test('short private URL hostnames are detected while public network URLs remain portable', () => {
  assert.ok(scanText(`https://${person}:8080/api`, 'example.md', { policy }).length);
  assert.deepEqual(scanText('//cdn.example.com/assets/main.js', 'example.md', { policy }), []);
});

test('regression: simple JSON/JS escapes cannot hide private values', async t => {
  const drive = `${String.fromCharCode(67)}:\\${['Users', person, 'file'].join('\\')}`;
  const unc = `${'\\'.repeat(2)}${person}\\share\\file`;
  const values = [home, drive, unc, `${String.fromCharCode(126)}/${person}`,
    '$' + 'HOME/file', ['192', '168', '4', '5'].join('.'), `${['local', 'host'].join('')}:3000`];
  for (const prefix of ['\n', '\r', '\t', '\b', '\f', '\r\n']) {
    for (const value of values) {
      assert.ok(scanText(JSON.stringify(`Scanning${prefix}${value}`), 'example.json', { policy }).length,
        'serialized private values must not become clean');
    }
  }
  for (const escaped of ['n', 'r', 't', 'b', 'f', 'v', '0', '"', "'"]) {
    assert.ok(scanText(`"Scanning${String.fromCharCode(92)}${escaped}${home}"`,
      'example.js', { policy }).length);
  }
  const dir = await fixture(t);
  await writeFile(path.join(dir, 'bad.json'), JSON.stringify(`Scanning\n${home}`));
  const result = run(dir, 'files', 'bad.json');
  assert.equal(result.status, 1);
  safeOutput(result, [dir, drive, unc]);
});

test('regression: symlinked main entry always executes the CLI', async t => {
  const dir = await fixture(t);
  const entry = path.join(dir, 'scanner.mjs');
  await symlink(cli, entry);
  await writeFile(path.join(dir, 'bad.txt'), home);
  for (const [args, status] of [[['files', 'missing.txt'], 2], [['files', 'bad.txt'], 1], [[], 2]]) {
    const result = spawnSync(process.execPath, [entry, ...args], { cwd: dir, encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, status);
    assert.ok(safeOutput(result, [dir]).length > 0, 'a main invocation cannot silently do nothing');
  }
});

test('regression: URL query, fragment and adjacent delimiters cannot erase private values', async t => {
  const drive = `${String.fromCharCode(67)}:\\${['Users', person, 'file'].join('\\')}`;
  const cases = [];
  for (const origin of ['https://example.com/view', '//cdn.example.com/view']) {
    for (const delimiter of ['?file=', '#', ',', '|', ')', ']', ';', '}']) {
      for (const value of [home, drive, encodeURIComponent(home), encodeURIComponent(drive)]) {
        cases.push(`${origin}${delimiter}${value}`);
      }
    }
    cases.push(`${origin}%3Ffile=${encodeURIComponent(home)}`);
    cases.push(`${origin}/${drive}`, `${origin}:location=${drive}`);
  }
  for (const value of cases) {
    assert.ok(scanText(value, 'example.md', { policy }).length,
      'URL preservation must not suppress arbitrary data');
  }
  assert.deepEqual(scanText('https://example.com/home/page?view=grid#heading', 'example.md', { policy }), []);
  const dir = await fixture(t);
  await writeFile(path.join(dir, 'bad.txt'), cases.join('\n'));
  const result = run(dir, 'files', 'bad.txt');
  assert.equal(result.status, 1);
  safeOutput(result, [dir, drive]);
});

test('trusted module policy boundary rejects candidate changes before scanning', async t => {
  const dir = await fixture(t);
  await writeFile(path.join(dir, 'clean.txt'), 'clean');
  assert.equal(run(dir, 'files', 'clean.txt').status, 0);
  const otherName = ['alternate', 'public'].join('-');
  const otherIdentity = { name: otherName,
    email: `${[1, 2, 3].join('')}+${otherName}@${['users', 'noreply', 'github', 'com'].join('.')}` };
  for (const candidate of [{ ...policy, forbiddenDirectories: ['.airig', '.worktrees'] },
    { ...policy, approvedIdentity: otherIdentity }, { ...policy, exceptions: [] }]) {
    await writeFile(path.join(dir, 'security/policy.json'), JSON.stringify(candidate));
    const result = run(dir, 'files', 'clean.txt');
    assert.equal(result.status, 2, 'candidate policy must not replace the scanner module policy');
    safeOutput(result, [dir, otherIdentity.email]);
  }
});

test('complete exception validator and policy bounds fail closed', async t => {
  const dir = await fixture(t);
  const exact = policy.exceptions[0];
  const badExceptions = [{ ...exact, path: '**' }, { ...exact, rule: 'email' },
    { ...exact, line: 2 }, { ...exact, text: 'not an interpreter' },
    { ...exact, path: '.airig/tool.mjs' }, { ...exact, path: 'scripts/tool.ts' },
    { ...exact, path: '../tool.mjs' }, { ...exact, purpose: '' },
    { ...exact, purpose: 1 }, { ...exact, purpose: 'x'.repeat(241) }];
  const mismatchedIdentity = { ...policy.approvedIdentity,
    name: ['different', 'public'].join('-') };
  const candidates = badExceptions.map(exception => ({ ...policy, exceptions: [exception] }));
  candidates.push({ ...policy, approvedIdentity: mismatchedIdentity },
    { ...policy, exceptions: Array.from({ length: 17 }, (_, i) => ({ ...exact, path: `scripts/tool-${i}.mjs` })) },
    { ...policy, forbiddenDirectories: ['.airig', '.worktrees', ...Array.from({ length: 63 }, (_, i) => `runtime-${i}`)] },
    { ...policy, forbiddenDirectories: [...policy.forbiddenDirectories, '.airig'] },
    { ...policy, forbiddenDirectories: [...policy.forbiddenDirectories, 'nested/runtime'] });
  for (const candidate of candidates) {
    await writeFile(path.join(dir, 'security/policy.json'), JSON.stringify(candidate));
    await assert.rejects(loadPolicy(dir), error => {
      assert.equal(String(error.stack).includes(dir), false);
      return true;
    });
  }
  // Exercise the allowed boundaries through loadPolicy, independently of CLI
  // policy equality. The CLI must still reject any candidate policy change.
  const atLimit = { ...policy,
    exceptions: Array.from({ length: 16 }, (_, i) => ({ ...exact, path: `scripts/tool-${i}.mjs` })),
    forbiddenDirectories: ['.airig', '.worktrees', ...Array.from({ length: 62 }, (_, i) => `runtime-${i}`)] };
  await writeFile(path.join(dir, 'security/policy.json'), JSON.stringify(atLimit));
  assert.deepEqual(await loadPolicy(dir), atLimit);
});

test('encoding coverage includes prefixed base64, invisible characters and additional machine forms', () => {
  for (const prefix of ['id-', 'id_', 'id/']) {
    assert.ok(scanText(`${prefix}${Buffer.from(email).toString('base64')}`, 'example.txt', { policy }).length);
  }
  const bs = String.fromCharCode(92);
  const cases = [`${bs.repeat(2)}${['wsl', '$'].join('')}${bs}Ubuntu${bs}home${bs}${person}`,
    `${bs.repeat(2)}?${bs}UNC${bs}${person}${bs}share`,
    `$${['env', ':', 'USERPROFILE'].join('')}${bs}file`,
    `%${['LOCAL', 'APPDATA'].join('')}%${bs}file`, `%${['APP', 'DATA'].join('')}%${bs}file`,
    ['', 'c', 'Users', person, 'file'].join('/'),
    `http://${['127', '1'].join('.')}:3000/`, ['100', '64', '1', '2'].join('.')];
  for (const value of cases) assert.ok(scanText(value, 'example.txt', { policy }).length);
  const invisible = home.replace('home', `ho${String.fromCodePoint(0x200b)}me`);
  assert.ok(scanText(invisible, 'example.txt', { policy }).length);
  assert.ok(scanText(JSON.stringify(invisible).replace(String.fromCodePoint(0x200b),
    `${bs}u200b`), 'example.txt', { policy }).length);
});

test('identifier expressions and hyphenated public routes avoid unnecessary false positives', () => {
  assert.deepEqual(scanText(jsDeclaration('hostname', 'location.hostname'), 'example.js', { policy }), []);
  assert.ok(scanText(`const hostname = "${person}";`, 'example.js', { policy }).length);
  assert.deepEqual(scanText('/dev-tools\n/home-page', 'example.md', { policy }), []);
  // Ambiguous paths and scp-style emails stay blocking without a reviewed context.
  assert.ok(scanText(['', 'media', 'file'].join('/'), 'example.md', { policy }).length);
  assert.ok(scanText(['', 'users', '42'].join('/'), 'example.md', { policy }).length);
  assert.ok(scanText(`${['git', 'github.com'].join('@')}:charm-ux/velcro`, 'example.md', { policy }).length);
  assert.deepEqual(scanText('https://example.com/users/42', 'example.md', { policy }), []);
});

test('CLI traversal depth and finding count bounds fail closed', async t => {
  const dir = await fixture(t);
  let deepest = path.join(dir, 'nested');
  for (let i = 0; i < 65; i++) deepest = path.join(deepest, 'd');
  await mkdir(deepest, { recursive: true });
  let result = run(dir, 'files', 'nested');
  assert.equal(result.status, 2);
  safeOutput(result, [dir]);
  await writeFile(path.join(dir, 'many.txt'), (home + '\n').repeat(10001));
  result = run(dir, 'files', 'many.txt');
  assert.equal(result.status, 2);
  safeOutput(result, [dir]);
});

test('CLI aggregate-byte and entry bounds fail closed, including tiny-file trees', async t => {
  const dir = await fixture(t);
  await mkdir(path.join(dir, 'bytes'));
  const chunk = Buffer.alloc(8 * 1024 * 1024, 0x20);
  for (let i = 0; i < 9; i++) await writeFile(path.join(dir, 'bytes', `${i}.txt`), chunk);
  let result = run(dir, 'files', 'bytes');
  assert.equal(result.status, 2);
  safeOutput(result, [dir]);
  await mkdir(path.join(dir, 'entries'));
  for (let batch = 0; batch < 101; batch++) {
    await Promise.all(Array.from({ length: 100 }, (_, i) =>
      writeFile(path.join(dir, 'entries', `${batch * 100 + i}.txt`), '')));
  }
  result = run(dir, 'files', 'entries');
  assert.equal(result.status, 2);
  safeOutput(result, [dir]);
});

test('CLI inputs are explicitly repository-root-relative even from a nested cwd', async t => {
  const dir = await fixture(t);
  await mkdir(path.join(dir, 'docs'));
  await writeFile(path.join(dir, 'root.txt'), 'clean');
  await writeFile(path.join(dir, 'docs/bad.txt'), home);
  assert.equal(run(path.join(dir, 'docs'), 'files', 'root.txt').status, 0);
  const result = run(path.join(dir, 'docs'), 'files', 'docs/bad.txt');
  assert.equal(result.status, 1);
  safeOutput(result, [dir]);
});

test('round 2: escaped UNC host prefixes and nested JSON remain findings', async t => {
  const bs = String.fromCharCode(92);
  const cases = [];
  const hosts = [];
  for (const first of ['n', 'r', 't', 'b', 'f', 'v', '0']) {
    const host = `${first}-${person}`;
    hosts.push(host);
    let encoded = `${bs.repeat(2)}${host}${bs}share${bs}file`;
    for (let depth = 0; depth <= 2; depth++) {
      assert.ok(scanText(encoded, 'example.json', { policy }).some(f => f.rule === 'machine-path'),
        'UNC escaping must not consume the first host character');
      cases.push(encoded);
      encoded = JSON.stringify(encoded);
    }
  }
  const dir = await fixture(t);
  await writeFile(path.join(dir, 'unc.json'), cases.join('\n'));
  const result = run(dir, 'files', 'unc.json');
  assert.equal(result.status, 1);
  safeOutput(result, [dir, ...hosts, ...cases]);
});

test('round 2: shell flag query and log identifiers retain coverage without member-expression findings', async t => {
  const cases = [`export USERNAME=${person}`, `export HOSTNAME=${person}`,
    `set USERNAME=${person}`, `docker run --hostname=${person} image`, `--hostname=${person}`,
    `https://example.com/x?hostname=${person}`, `https://example.com/?username=${person}`,
    `https://example.com/x?view=grid&user_name=${person}`,
    `log hostname=${person} user_name=${person}`, `log,computer_name=${person}`,
    `log;machine_name=${person}`, `export HOSTNAME=${person}.example`,
    `--hostname=${person}.example`, `https://example.com/x?hostname=${person}.example`];
  for (const value of cases) {
    assert.ok(scanText(value, 'example.txt', { policy }).some(f => f.rule === 'private-identifier'),
      'configuration-shaped identifiers must remain covered');
  }
  for (const expression of [jsDeclaration('hostname', 'location.hostname'), jsDeclaration('username', 'user.name', 'let'),
    jsDeclaration('hostname', 'location["hostname"]'), jsDeclaration('hostname', 'getHost()'),
    jsDeclaration('hostname', 'location?.hostname')]) {
    assert.deepEqual(scanText(expression, 'example.js', { policy }), []);
  }
  const dir = await fixture(t);
  await writeFile(path.join(dir, 'config.txt'), cases.join('\n'));
  const result = run(dir, 'files', 'config.txt');
  assert.equal(result.status, 1);
  safeOutput(result, [dir, person]);
});

test('round 2: legitimate format characters and ordinary escaped source are clean', async t => {
  const bs = String.fromCharCode(92);
  const cases = [`const clean = text.replace(/^${bs}uFEFF/, "");`,
    `const placeholder = "${bs}u200b";`, `const placeholder = "${String.fromCodePoint(0x200b)}";`,
    `emoji ${String.fromCodePoint(0x1f469, 0x200d, 0x1f4bb)}`,
    String.fromCodePoint(0x200f, 0x645, 0x631, 0x62d, 0x628, 0x627),
    `${String.fromCodePoint(0xfeff)}public text`];
  for (const value of cases) assert.deepEqual(scanText(value, 'example.js', { policy }), []);
  const dir = await fixture(t);
  await writeFile(path.join(dir, 'source.txt'), cases.join('\n'));
  const result = run(dir, 'files', 'source.txt');
  assert.equal(result.status, 0);
  safeOutput(result, [dir]);
});

test('round 2: format-normalized private values are findings while labels stay redacted', async t => {
  const bs = String.fromCharCode(92);
  const cases = [];
  for (const point of [0x200b, 0x200d, 0x200f, 0xfeff]) {
    const cf = String.fromCodePoint(point);
    const hidden = home.replace('home', `ho${cf}me`);
    const escaped = hidden.replace(cf, `${bs}u${point.toString(16).padStart(4, '0')}`);
    for (const value of [hidden, escaped, encodeURIComponent(hidden), JSON.stringify(`Scanning\n${hidden}`)]) {
      const findings = scanText(`clean\n${value}`, 'example.txt', { policy });
      assert.ok(findings.some(f => f.rule === 'machine-path' && f.line === 2));
      assert.equal(formatFindings(findings).includes(hidden), false);
      cases.push(value);
    }
    const label = `docs/ho${cf}me.txt`;
    const findings = scanText('clean', label, { policy });
    assert.ok(findings.some(f => f.rule === 'unsafe-filename' && f.path === '[redacted]'));
    const output = formatFindings([{ rule: 'email', path: label, line: 1 }]);
    assert.equal(output.includes(label), false);
    assert.equal(output.includes(cf), false);
  }
  const dir = await fixture(t);
  await writeFile(path.join(dir, 'hidden.txt'), cases.join('\n'));
  const result = run(dir, 'files', 'hidden.txt');
  assert.equal(result.status, 1);
  safeOutput(result, [dir, ...cases]);
});

test('round 3: identifier regression matrix covers key value quoting and context shapes', async t => {
  const keys = ['username', 'hostname', 'computer_name', 'machine-name',
    'SSH_USERNAME', 'DEPLOY_HOSTNAME', 'DB_USER_NAME', 'LOCAL_MACHINE_NAME',
    'process.env.USERNAME', 'this.hostname', 'settings.computerName', 'process.env.DEPLOY_HOSTNAME'];
  const values = [person.replaceAll('-', ''), person, person.replaceAll('-', '.')];
  const contexts = [
    (key, value) => `${key}=${value}`,
    (key, value) => `${key} = ${value}`,
    (key, value) => `${key}: ${value}`,
    (key, value) => `export ${key}=${value}`,
    (key, value) => `set ${key}=${value}`,
    (key, value) => `--${key}=${value}`,
    (key, value) => `docker run --${key}=${value} image`,
    (key, value) => `https://example.com/?${key}=${value}`,
    (key, value) => `https://example.com/?view=grid&${key}=${value}`,
    (key, value) => `log ${key}=${value}`,
    (key, value) => `"${key}": ${value}`,
    (key, value) => `{"${key}": ${value}}`,
    (key, value) => `metadata: ${key}=${value}`,
    (key, value) => `wrapper=${key}=${value}`,
  ];
  const cases = [];
  const missing = [];
  for (const [k, key] of keys.entries()) {
    for (const [v, value] of values.entries()) {
      for (const [q, quote] of ['', '"', "'"].entries()) {
        for (const [c, context] of contexts.entries()) {
          const text = context(key, quote + value + quote);
          cases.push(text);
          const findings = scanText(`clean\n${text}`, 'example.txt', { policy });
          if (!findings.some(f => f.rule === 'private-identifier' && f.line === 2)) {
            missing.push(`key-${k}/value-${v}/quote-${q}/context-${c}`);
          }
        }
      }
    }
  }
  assert.equal(cases.length, 1512);
  assert.deepEqual(missing, [], 'every promised literal/configuration cell must be a finding');
  // A dot is not expression evidence in bare YAML/INI/env, even before a command.
  for (const text of [`USERNAME=${person} ./run`, `hostname=${person}.example.org`,
    `username: ${person.replaceAll('-', '.')}`, `SSH_USERNAME="${person}"`,
    `process.env.USERNAME = "${person}";`, `this.hostname = '${person}';`]) {
    assert.ok(scanText(text, 'example.txt', { policy }).some(f => f.rule === 'private-identifier'));
  }
  const dir = await fixture(t);
  await writeFile(path.join(dir, 'matrix.txt'), cases.join('\n'));
  const result = run(dir, 'files', 'matrix.txt');
  assert.equal(result.status, 1);
  safeOutput(result, [dir, ...values]);
  assert.equal((result.stdout.match(/private-identifier/g) ?? []).length, cases.length);
});

test('round 3: only structurally clear dynamic expressions remain clean', () => {
  const expressions = ['location.hostname', 'user.name', 'location["hostname"]',
    'getHost()', 'location?.hostname', 'os.hostname()', 'process.env.X',
    'location . hostname', 'location ["hostname"]', 'location ?. hostname'];
  for (const key of ['hostname', 'SSH_USERNAME', 'DEPLOY_HOSTNAME']) {
    for (const declaration of ['const', 'let', 'var', 'export const']) {
      for (const expression of expressions) {
        assert.deepEqual(scanText(jsDeclaration(key, expression, declaration), 'example.js', { policy }), []);
      }
    }
    for (const expression of expressions) {
      // Quoting a value makes a literal; without declaration syntax even a
      // recognizable RHS remains ambiguous bare config and fails conservatively.
      const literal = JSON.stringify(expression);
      for (const text of [jsDeclaration(key, literal), `${key}: ${expression}`]) {
        assert.ok(scanText(text, 'example.js', { policy }).some(f => f.rule === 'private-identifier'));
      }
    }
  }
});

test('round 3: default-ignorable normalization preserves findings Unicode positives and label redaction', async t => {
  const bs = String.fromCharCode(92);
  const cases = [];
  // The final two are Cf-only, not Default_Ignorable_Code_Point. Neither
  // normalization category may be dropped when strengthening the other.
  for (const point of [0x034f, 0xfe0f, 0x3164, 0xfff9, 0x0600]) {
    const invisible = String.fromCodePoint(point);
    const hidden = home.replace('home', `ho${invisible}me`);
    const escaped = hidden.replace(invisible, `${bs}u${point.toString(16).padStart(4, '0')}`);
    for (const value of [hidden, escaped, encodeURIComponent(hidden), JSON.stringify(hidden)]) {
      assert.ok(scanText(`clean\n${value}`, 'example.txt', { policy })
        .some(f => f.rule === 'machine-path' && f.line === 2));
      cases.push(value);
    }
    const label = `docs/ho${invisible}me.txt`;
    assert.ok(scanText('clean', label, { policy }).some(f => f.rule === 'unsafe-filename'
      && f.path === '[redacted]'));
    const output = formatFindings([{ rule: 'email', path: label, line: 1 }]);
    assert.equal(output.includes(label), false);
    assert.equal(output.includes(invisible), false);
  }
  const positive = [`emoji ${String.fromCodePoint(0x2764, 0xfe0f)}`,
    `public ${String.fromCodePoint(0x034f, 0x3164)}text`,
    `public ${String.fromCodePoint(0xfff9, 0x0600)}text`];
  for (const text of positive) assert.deepEqual(scanText(text, 'example.txt', { policy }), []);
  const dir = await fixture(t);
  await writeFile(path.join(dir, 'hidden.txt'), cases.join('\n'));
  let result = run(dir, 'files', 'hidden.txt');
  assert.equal(result.status, 1);
  safeOutput(result, [dir, ...cases]);
  await writeFile(path.join(dir, 'public.txt'), positive.join('\n'));
  result = run(dir, 'files', 'public.txt');
  assert.equal(result.status, 0);
  safeOutput(result, [dir]);
});
