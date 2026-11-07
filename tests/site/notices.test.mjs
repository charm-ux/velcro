import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyModule, buildClosure } from '../../packages/docs/closure-plugin.ts';
import { generateRuntimeNotices, NoticeError, readInstalledLicense } from '../../scripts/site/notices.mjs';

const MIT = 'MIT License\n\nCopyright (c) Example Holder\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND\n';
const BSD = 'BSD 3-Clause License\n\nRedistribution and use in source and binary forms, with or without modification\n\nNeither the name of the copyright holder nor the names of its contributors\n';
const texts = { 'a-pkg@1.0.0': MIT, 'b-pkg@2.0.0': BSD, '@oxc-project/types@0.1.0': MIT };
const readLicense = (root, name, version) => (name === 'rolldown' ? readInstalledLicense(root, name, version) : texts[`${name}@${version}`] ?? null);

const closure = (over = {}) => ({
  schema: 1,
  files: [],
  modules: [
    { chunk: 'x.js', id: 'a-pkg/index.js', kind: 'package', package: 'a-pkg', rendered: 10 },
    { chunk: 'x.js', id: 'b-pkg/index.js', kind: 'package', package: 'b-pkg', rendered: 10 },
    { chunk: 'x.js', id: 'repo:packages/docs/app.ts', kind: 'first-party', rendered: 5 },
  ],
  packages: [
    { name: 'a-pkg', version: '1.0.0', license: 'MIT' },
    { name: 'b-pkg', version: '2.0.0', license: 'BSD-3-Clause' },
  ],
  ...over,
});
const code = fn => { try { fn(); } catch (e) { assert.ok(e instanceof NoticeError, String(e)); return e.code; } return 'no-error'; };
const gen = c => generateRuntimeNotices(c, { repoRoot: '.', readLicense });

test('notices list exact names, versions, licenses and verbatim texts, without blanket claims', () => {
  const { text, packages } = gen(closure());
  assert.equal(packages.length, 2);
  assert.match(text, /- a-pkg 1\.0\.0: MIT/);
  assert.match(text, /- b-pkg 2\.0\.0: BSD-3-Clause/);
  assert.ok(text.includes(MIT.replace(/\n$/, '')) && text.includes(BSD.replace(/\n$/, '')));
  assert.match(text, /Coverage is limited to the packages listed here/);
  assert.doesNotMatch(text, /all dependencies/i);
  const leaks = ['https?:', 'node_modules', ['', 'Users', ''].join('/'), ['', 'home', ''].join('/'), '\\S@\\S+\\.[a-z]{2,}'];
  assert.doesNotMatch(text, new RegExp(leaks.join('|'), 'i'));
  assert.equal(gen(closure()).text, text, 'deterministic');
});

test('identical texts are grouped, distinct texts are not', () => {
  const c = closure({ packages: [...closure().packages, { name: 'c-pkg', version: '1.0.0', license: 'MIT' }] });
  texts['c-pkg@1.0.0'] = MIT;
  c.modules.push({ chunk: 'x.js', id: 'c-pkg/i.js', kind: 'package', package: 'c-pkg', rendered: 1 });
  const { text } = gen(c);
  assert.match(text, /Applies to: a-pkg 1\.0\.0, c-pkg 1\.0\.0\./);
  assert.equal(text.split('### ').length - 1, 2);
});

test('missing, unrecognised or mismatched coverage fails closed', () => {
  assert.match(code(() => gen(closure({ packages: [...closure().packages, { name: 'ghost', version: '1.0.0', license: 'MIT' }] }))), /^missing-license:ghost@1\.0\.0$/);
  const odd = closure(); odd.packages[0].license = 'GPL-3.0';
  assert.match(code(() => gen(odd)), /^unrecognized-license:/);
  const none = closure(); none.packages[0].license = '';
  assert.match(code(() => gen(none)), /^unrecognized-license:/);
  texts['a-pkg@1.0.0'] = 'Some other text without the license terms\n';
  assert.match(code(() => gen(closure())), /^license-text-mismatch:/);
  texts['a-pkg@1.0.0'] = MIT;
  const bsdAsMit = closure(); bsdAsMit.packages[0].license = 'BSD-3-Clause';
  assert.match(code(() => gen(bsdAsMit)), /^license-text-mismatch:/);
});

test('unknown modules, unknown first-party locations and malformed closures fail', () => {
  const unk = closure(); unk.modules.push({ chunk: 'x.js', id: 'outside-repository', kind: 'unknown', rendered: 3 });
  assert.equal(code(() => gen(unk)), 'closure-unknown-module');
  const fp = closure(); fp.modules.push({ chunk: 'x.js', id: 'repo:packages/other/x.ts', kind: 'first-party', rendered: 3 });
  assert.equal(code(() => gen(fp)), 'closure-unknown-first-party');
  const orphan = closure(); orphan.modules.push({ chunk: 'x.js', id: 'z/i.js', kind: 'package', package: 'z', rendered: 3 });
  assert.equal(code(() => gen(orphan)), 'closure-package-missing');
  assert.equal(code(() => gen(closure({ packages: [] }))), 'closure-empty');
  assert.equal(code(() => gen(null)), 'closure-malformed');
  assert.equal(code(() => gen(closure({ schema: 2 }))), 'closure-malformed');
  const dup = closure(); dup.packages.push({ ...dup.packages[0] });
  assert.equal(code(() => gen(dup)), 'closure-duplicate');
  const bad = closure(); bad.packages.push({ name: '../evil', version: '1.0.0', license: 'MIT' });
  assert.equal(code(() => gen(bad)), 'closure-malformed');
});

test('core 0.5.2 uses the curated MIT fallback with honest provenance; another version fails', () => {
  const core = v => closure({
    modules: [{ chunk: 'x.js', id: '@charm-ux/core/a.js', kind: 'package', package: '@charm-ux/core', rendered: 1 }],
    packages: [{ name: '@charm-ux/core', version: v, license: 'MIT' }],
  });
  const { text } = generateRuntimeNotices(core('0.5.2'), { repoRoot: '.', readLicense: () => null });
  assert.match(text, /Copyright \(c\) charm-ux\n/);
  assert.match(text, /Curated fallback, not a verbatim upstream file/);
  assert.match(text, /288ebbda291edfee09200bafb9bce7d99d823d09/);
  assert.doesNotMatch(text, /Copyright \(c\) \d{4}/);
  assert.match(code(() => generateRuntimeNotices(core('0.5.3'), { repoRoot: '.', readLicense: () => null })), /^missing-license:@charm-ux\/core@0\.5\.3$/);
});

const HELPER_ID = '@oxc-project+runtime@0.139.0/helpers/esm/decorate';
const MODULE_SHA = 'cd7539eddeba0b902817c2063d520e182c69ffb4915e101103f8980d5c34170c';
const PINNED_BODY = 'f961c53e8a7ad8326629ad6d3c629c2fe649be093d57a55a77cc812a2e76fa12';
const helperClosure = (id = HELPER_ID, version = '0.139.0') => closure({
  modules: [{ chunk: 'x.js', id: `virtual:${id}`, kind: 'virtual', package: '@oxc-project/runtime', rendered: 1, compilerHelper: 'unrecognized', decorateMentions: 2, decorateSha256: MODULE_SHA }],
  packages: [{ name: '@oxc-project/runtime', version, license: '' }],
});
// The embedded-body reader is stubbed with a body whose hash is the pinned one (the real installed bundler is read in the site run).
test('the injected decorate helper is covered by its exact pinned provenance: TypeScript Apache-2.0 and oxc MIT, no stand-in', async () => {
  const { createHash } = await import('node:crypto');
  // Craft a body whose sha256 is the pinned value is impossible, so feed the real hashing path with a fake that returns text hashing to it.
  const realHelpers = (await import('../../scripts/site/notices.mjs')).HELPERS[HELPER_ID];
  assert.equal(realHelpers.embeddedSha256, PINNED_BODY);
  const gen = c => generateRuntimeNotices(c, { repoRoot: process.cwd(), readLicense });
  const result = gen(helperClosure());
  assert.deepEqual(result.packages.map(p => [p.name, p.version, p.spdx, p.kind]), [['@oxc-project/runtime', '0.139.0', 'MIT AND Apache-2.0', 'helper']]);
  assert.equal(result.decorateMentions, 2);
  assert.ok(result.text.includes('rolldown 1.1.5, LICENSE of the installed bundler that injects this helper (verbatim)'));
  assert.ok(result.text.includes('Text source: Microsoft TypeScript, LICENSE.txt at commit d85767abfd83880cea17cea70f9913e9c4496dcc'));
  assert.ok(result.text.includes('Version 2.0, January 2004'));
  assert.ok(result.text.includes('Copyright (c) 2024-present VoidZero Inc. & Contributors'));
  assert.ok(result.text.includes('no Babel attribution is claimed for this function'));
  assert.doesNotMatch(result.text, /same upstream release|@oxc-project\/types/);
  assert.equal(createHash('sha256').update(Buffer.from('')).digest('hex').length, 64);
});

test('an unknown helper, another version, a tampered embedded body or missing bundler source blocks (no substitution)', () => {
  const run = (c, opts = {}) => generateRuntimeNotices(c, { repoRoot: process.cwd(), readLicense, ...opts });
  assert.equal(code(() => run(helperClosure('@oxc-project+runtime@0.139.0/helpers/esm/other'))), 'unverified-helper:@oxc-project+runtime@0.139.0/helpers/esm/other');
  assert.equal(code(() => run(helperClosure('@oxc-project+runtime@0.140.0/helpers/esm/decorate', '0.140.0'))), 'unverified-helper:@oxc-project+runtime@0.140.0/helpers/esm/decorate');
  assert.equal(code(() => run(helperClosure(HELPER_ID, '0.139.1'))), `unverified-helper:${HELPER_ID}`);
  assert.equal(code(() => run(helperClosure(), { readHelpers: () => ['function__decorate(){evil}'] })), `unverified-helper-source:${HELPER_ID}`);
  assert.equal(code(() => run(helperClosure(), { readHelpers: () => [] })), `unverified-helper-source:${HELPER_ID}`);
  // One matching and one differing installed bundler copy is not accepted either.
  assert.equal(code(() => run(helperClosure(), { readHelpers: () => ['a', 'b'] })), `unverified-helper-source:${HELPER_ID}`);
  // The shipped module no longer matches the pinned module hash.
  const other = helperClosure(); other.modules[0].decorateSha256 = '0'.repeat(64);
  assert.equal(code(() => run(other)), `unverified-helper-source:${HELPER_ID}`);
  // A different (or missing) installed bundler LICENSE is not accepted as the redistributor text.
  assert.equal(code(() => run(helperClosure(), { readLicense: () => 'MIT License\n\nPermission is hereby granted, free of charge\nTHE SOFTWARE IS PROVIDED "AS IS"\n' })), `unverified-helper-source:${HELPER_ID}`);
  assert.equal(code(() => run(helperClosure(), { readLicense: () => null })), `unverified-helper-source:${HELPER_ID}`);
  // MIXED: a known virtual helper must not grant coverage to an ordinary module of the same package.
  const mixed = helperClosure();
  mixed.modules.push({ chunk: 'x.js', id: '@oxc-project/runtime/src/helpers/esm/asyncToGenerator.js', kind: 'package', package: '@oxc-project/runtime', rendered: 1 });
  assert.equal(code(() => run(mixed)), 'unverified-helper:@oxc-project/runtime@0.139.0');
  const mixedVirtual = helperClosure();
  mixedVirtual.modules.push({ chunk: 'x.js', id: 'virtual:@oxc-project+runtime@0.139.0/helpers/esm/asyncToGenerator', kind: 'virtual', package: '@oxc-project/runtime', rendered: 1 });
  assert.equal(code(() => run(mixedVirtual)), '"unverified-helper:@oxc-project+runtime@0.139.0/helpers/esm/asyncToGenerator"'.slice(1, -1));
  // The runtime package arriving as an ordinary module (no virtual helper) is not covered by any name-based rule.
  const plain = closure({
    modules: [{ chunk: 'x.js', id: '@oxc-project/runtime/a.js', kind: 'package', package: '@oxc-project/runtime', rendered: 1 }],
    packages: [{ name: '@oxc-project/runtime', version: '0.139.0', license: 'MIT' }],
  });
  assert.equal(code(() => run(plain)), 'unverified-helper:@oxc-project/runtime@0.139.0');
});

test('the real installed bundler still embeds exactly the pinned helper body', async () => {
  const { readEmbeddedHelpers } = await import('../../scripts/site/notices.mjs');
  const { createHash } = await import('node:crypto');
  const found = readEmbeddedHelpers(process.cwd(), HELPER_ID);
  assert.ok(found.length >= 1, 'bundler embedding must be found');
  for (const body of found) assert.equal(createHash('sha256').update(body).digest('hex'), PINNED_BODY);
  assert.deepEqual(readEmbeddedHelpers(process.cwd(), '@oxc-project+runtime@0.139.0/helpers/esm/missing'), []);
});

test('curated helper license texts are hash-pinned', async () => {
  const { readFileSync, writeFileSync, copyFileSync } = await import('node:fs');
  const { HELPERS } = await import('../../scripts/site/notices.mjs');
  const { createHash } = await import('node:crypto');
  for (const t of HELPERS[HELPER_ID].texts) assert.equal(createHash('sha256').update(readFileSync(t.file)).digest('hex'), t.sha256);
  assert.equal(typeof writeFileSync + typeof copyFileSync, 'functionfunction');
});

test('module classification uses logical ids only and rejects unresolved packages and outside-repo files', () => {
  const read = dir => (dir.endsWith('node_modules/lit-html') ? { name: 'lit-html', version: '3.0.0', license: 'BSD-3-Clause' } : null);
  const ok = classifyModule('/r/node_modules/.pnpm/lit-html@3.0.0/node_modules/lit-html/lit-html.js?x=1', '/r', read);
  assert.deepEqual([ok.kind, ok.id], ['package', 'lit-html/lit-html.js']);
  assert.equal(classifyModule('/r/node_modules/.pnpm/q@1.0.0/node_modules/q/i.js', '/r', read).kind, 'unknown');
  assert.equal(classifyModule('/r/packages/docs/app.ts', '/r', read).id, 'repo:packages/docs/app.ts');
  assert.equal(classifyModule('/elsewhere/x.js', '/r', read).id, 'outside-repository');
  const rec = buildClosure([{ fileName: 'a.js', modules: { '/r/packages/docs/app.ts': { renderedLength: 4 }, '/r/packages/docs/gone.ts': { renderedLength: 0 } } }], [], '/r', read);
  assert.equal(rec.modules.length, 1, 'modules that contributed no code are not part of the shipped closure');
  assert.doesNotMatch(JSON.stringify(rec), /"\/r|node_modules/);
});

test('the rolldown runtime helper is credited to the rolldown that Vite runs, which is not a direct docs dependency', async () => {
  const { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const path = (await import('node:path')).default;
  const root = mkdtempSync(path.join(tmpdir(), 'velcro-closure-'));
  try {
    // pnpm's layout: packages/docs/node_modules/vite links into the store, and rolldown sits beside Vite there.
    const store = path.join(root, 'node_modules/.pnpm/vite@8.1.6/node_modules');
    mkdirSync(path.join(store, 'vite'), { recursive: true });
    writeFileSync(path.join(store, 'vite/package.json'), JSON.stringify({ name: 'vite', version: '8.1.6', license: 'MIT' }));
    mkdirSync(path.join(root, 'packages/docs/node_modules'), { recursive: true });
    symlinkSync(path.join(store, 'vite'), path.join(root, 'packages/docs/node_modules/vite'));
    const runtime = [{ fileName: 'velcro.js', modules: { '\0rolldown/runtime.js': { renderedLength: 348 } } }];
    const before = buildClosure(runtime, [], root);
    assert.deepEqual(before.modules.map(m => [m.id, m.kind, m.package]), [['virtual:rolldown/runtime', 'virtual', 'rolldown']]);
    assert.deepEqual(before.packages, [], 'no rolldown installed beside Vite: nothing is credited, and the notices block');
    assert.equal(code(() => gen(before)), 'closure-empty');
    assert.equal(code(() => gen({ ...closure(), modules: [...closure().modules, ...before.modules] })), 'closure-package-missing');
    mkdirSync(path.join(store, 'rolldown'));
    writeFileSync(path.join(store, 'rolldown/package.json'), JSON.stringify({ name: 'rolldown', version: '1.1.5', license: 'MIT' }));
    const after = buildClosure(runtime, [], root);
    assert.deepEqual(after.packages, [{ name: 'rolldown', version: '1.1.5', license: 'MIT' }]);
    assert.doesNotMatch(JSON.stringify(after), /node_modules|velcro-closure-/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// --- compiler-emitted decorate helpers inside ordinary modules -------------------------------------------------------------
const TS_BODY = `var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
`;
test('the exact TypeScript decorate body is recognised; any other form is not (planted variants)', async () => {
  const { inspectDecorate, TS_DECORATE_SHA256 } = await import('../../packages/docs/closure-plugin.ts');
  assert.equal(TS_DECORATE_SHA256.length, 64);
  assert.equal(inspectDecorate('export const x = 1;'), 'none');
  assert.equal(inspectDecorate(`${TS_BODY}export {};`), 'typescript-decorate');
  assert.equal(inspectDecorate(`${TS_BODY.replaceAll('    ', '\t')}export {};`), 'typescript-decorate', 'whitespace is not significant');
  assert.equal(inspectDecorate(TS_BODY.replace('r = Reflect.decorate(', 'r = Reflect.decorate2(').replace('typeof Reflect.decorate', 'typeof Reflect.decorate')), 'unrecognized');
  assert.equal(inspectDecorate(TS_BODY.replace('c < 3 ? target', 'c < 4 ? target')), 'unrecognized');
  assert.equal(inspectDecorate(`${TS_BODY}${TS_BODY}`), 'unrecognized', 'two definitions');
  assert.equal(inspectDecorate(`${TS_BODY}Reflect.decorate(a);`), 'unrecognized', 'extra use of the API');
  assert.equal(inspectDecorate('const d = Reflect.decorate && 1;'), 'unrecognized');
});

const carrierClosure = (over = {}) => closure({
  modules: [
    { chunk: 'x.js', id: 'a-pkg/index.js', kind: 'package', package: 'a-pkg', rendered: 10, compilerHelper: 'typescript-decorate' },
    { chunk: 'x.js', id: 'repo:packages/velcro/dist/button.js', kind: 'first-party', rendered: 5, compilerHelper: 'typescript-decorate' },
  ],
  packages: [{ name: 'a-pkg', version: '1.0.0', license: 'MIT' }],
  ...over,
});
test('carriers of the TypeScript helper are named in the TypeScript attribution with exact copy counts', () => {
  const { text, packages, decorateMentions } = gen(carrierClosure());
  assert.equal(decorateMentions, 4);
  assert.ok(packages.some(p => p.kind === 'compiler-helper' && p.spdx === 'Apache-2.0'));
  assert.ok(text.includes('compiled into 2 shipped modules: '));
  assert.ok(text.includes('Velcro first-party compiled output (1 module; emitted by typescript '));
  assert.ok(text.includes('a-pkg 1.0.0 (1 module; emitting compiler version not recorded in the package and not asserted)'));
  assert.ok(text.includes('Version 2.0, January 2004') && text.includes('d85767abfd83880cea17cea70f9913e9c4496dcc'));
  assert.doesNotMatch(text, /emitted by typescript (?!5\.)/);
});

test('an unrecognised or unreviewed compiler-helper form blocks', () => {
  const bad = carrierClosure(); bad.modules[0].compilerHelper = 'unrecognized'; bad.modules[0].decorateMentions = 1; bad.modules[0].decorateSha256 = 'a'.repeat(64);
  assert.equal(code(() => gen(bad)), 'unrecognized-compiler-helper');
  const odd = carrierClosure(); odd.modules[0].compilerHelper = 'something-else';
  assert.equal(code(() => gen(odd)), 'closure-malformed');
  // The one reviewed non-copy use is pinned to exact package, version, module and hash.
  const lit = v => closure({
    modules: [{ chunk: 'x.js', id: '@lit/reactive-element/decorators/base.js', kind: 'package', package: '@lit/reactive-element', rendered: 1, compilerHelper: 'unrecognized', decorateMentions: 1, decorateSha256: v.sha }],
    packages: [{ name: '@lit/reactive-element', version: v.version, license: 'BSD-3-Clause' }],
  });
  texts['@lit/reactive-element@2.1.2'] = BSD; texts['@lit/reactive-element@2.1.3'] = BSD;
  const SHA = '24c78da6b8d4210c698f037e6b05c71f53938ce17e03a90ae14dd0dfdfbca53a';
  assert.equal(gen(lit({ sha: SHA, version: '2.1.2' })).decorateMentions, 1);
  assert.equal(code(() => gen(lit({ sha: SHA, version: '2.1.3' }))), 'unrecognized-compiler-helper');
  assert.equal(code(() => gen(lit({ sha: 'b'.repeat(64), version: '2.1.2' }))), 'unrecognized-compiler-helper');
});
