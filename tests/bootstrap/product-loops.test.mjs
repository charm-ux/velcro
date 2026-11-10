// Guard for the product specs' time budgets. Every Playwright test has one fixed budget (the config's 45 s), so a test that
// walks the catalog (every route, page or component) does more work with each component added until it times out in CI. The
// fix is a generated test per item, each with the default budget and no test.setTimeout (a longer budget is not a fix for a
// slow test): that is what base-path.spec.mjs, site-layout.spec.mjs, api-reference.spec.mjs and the others do.
//
// This guard reads the product specs as text and fails on a loop over a catalog-derived collection, inside a test body,
// that awaits work for each item (a navigation, a locator, a request, a page evaluation). What it deliberately leaves alone:
//   - loops outside a test body (they generate tests);
//   - loops with no awaited work (in-memory checks of strings or results; their cost does not grow with page loads);
//   - code inside a browser callback (evaluate, evaluateAll, evaluateHandle, addInitScript, waitForFunction, $eval, $$eval):
//     it runs in one round trip to one page.
// A collection is catalog-derived when a spec declares it from readCatalog() or from another catalog-derived name.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const productDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'product');

// Blank out strings, template literals, comments and regular expressions (newlines kept), so the structure that is left can
// be matched by parentheses and braces. The result has the length of the input, so an offset maps back to a line.
export function mask(text) {
  const out = [];
  const stack = []; // 'tpl', or { depth } for the code of a ${...} inside a template literal
  let i = 0;
  const blank = ch => (ch === '\n' ? '\n' : ' ');
  const lastCode = () => {
    for (let j = out.length - 1; j >= 0; j--) if (!/\s/.test(out[j])) return { ch: out[j], at: j };
    return { ch: '' , at: -1 };
  };
  while (i < text.length) {
    const ch = text[i];
    const top = stack.at(-1);
    if (top === 'tpl') {
      if (ch === '\\') { out.push(' ', blank(text[i + 1] ?? ' ')); i += 2; continue; }
      if (ch === '`') { stack.pop(); out.push('`'); i++; continue; }
      if (ch === '$' && text[i + 1] === '{') { stack.push({ depth: 0 }); out.push(' ', ' '); i += 2; continue; }
      out.push(blank(ch)); i++; continue;
    }
    // Code, at the top level or inside a ${...}: inside a template everything is blanked, whatever it is.
    const inTemplate = stack.length > 0;
    const emit = c => out.push(inTemplate ? blank(c) : c);
    if (ch === '/' && text[i + 1] === '/') { while (i < text.length && text[i] !== '\n') { out.push(' '); i++; } continue; }
    if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end === -1 ? text.length : end + 2;
      for (; i < stop; i++) out.push(blank(text[i]));
      continue;
    }
    if (ch === '"' || ch === "'") {
      emit(ch); i++;
      while (i < text.length && text[i] !== ch && text[i] !== '\n') { if (text[i] === '\\') { out.push(' '); i++; } out.push(' '); i++; }
      if (i < text.length && text[i] === ch) { emit(ch); i++; }
      continue;
    }
    if (ch === '`') { stack.push('tpl'); out.push(inTemplate ? ' ' : '`'); i++; continue; }
    if (ch === '/') {
      const prev = lastCode();
      const before = out.join('').slice(Math.max(0, prev.at - 6), prev.at + 1);
      if (prev.ch === '' || /[(,=:[!&|?{};]/.test(prev.ch) || /\breturn$/.test(before)) {
        emit('/'); i++;
        let inClass = false;
        while (i < text.length && text[i] !== '\n') {
          if (text[i] === '\\') { out.push(' ', ' '); i += 2; continue; }
          if (text[i] === '[') inClass = true;
          else if (text[i] === ']') inClass = false;
          else if (text[i] === '/' && !inClass) break;
          out.push(' '); i++;
        }
        if (text[i] === '/') { emit('/'); i++; }
        continue;
      }
    }
    if (inTemplate) {
      if (ch === '{') top.depth++;
      else if (ch === '}') {
        if (top.depth === 0) { stack.pop(); out.push(' '); i++; continue; }
        top.depth--;
      }
      out.push(blank(ch)); i++; continue;
    }
    out.push(ch); i++;
  }
  return out.join('');
}

// The index of the bracket that closes the one at `open` in masked text (or -1).
function closing(masked, open) {
  const pairs = { '(': ')', '{': '}', '[': ']' };
  const stack = [];
  for (let i = open; i < masked.length; i++) {
    const ch = masked[i];
    if (pairs[ch]) stack.push(pairs[ch]);
    else if (ch === ')' || ch === '}' || ch === ']') {
      if (stack.pop() !== ch) return -1;
      if (stack.length === 0) return i;
    }
  }
  return -1;
}

const blankRange = (text, from, to) => text.slice(0, from) + text.slice(from, to).replace(/[^\n]/g, ' ') + text.slice(to);

// A regular expression for the name itself: not a property of something (`x.name`), but a spread (`...name`) is the name.
const mentions = name => new RegExp(`(?<![\\w$])(?<!(?<!\\.)\\.)${name.replace(/\$/g, '\\$')}(?![\\w$])`);

// Names a spec declares from the catalog: `const x = readCatalog(...)`, then anything declared from one of those names.
export function catalogNames(masked) {
  const decls = [...masked.matchAll(/^[ \t]*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=([^\n]*)/gm)].map(m => [m[1], m[2]]);
  const names = new Set();
  let grew = true;
  while (grew) {
    grew = false;
    for (const [name, rhs] of decls) {
      if (names.has(name)) continue;
      if (/\breadCatalog\s*\(/.test(rhs) || [...names].some(n => mentions(n).test(rhs))) { names.add(name); grew = true; }
    }
  }
  return names;
}

const BROWSER_CALLBACK = /\.(?:evaluate|evaluateAll|evaluateHandle|addInitScript|waitForFunction|\$eval|\$\$eval)\s*\(/g;
const TEST_CALL = /(?<![\w$.])test(?:\.(?:only|skip|fixme))?\s*\(/g;

// The loops over catalog-derived collections, inside test bodies, that await work for each item: { line, loop }.
export function catalogLoopsInTests(text) {
  const masked = mask(text);
  const names = catalogNames(masked);
  const refers = code => /\breadCatalog\s*\(/.test(code) || [...names].some(n => mentions(n).test(code));
  const lineOf = at => text.slice(0, at).split('\n').length;
  const found = [];
  for (const call of masked.matchAll(TEST_CALL)) {
    const open = call.index + call[0].length - 1;
    const end = closing(masked, open);
    if (end === -1) continue;
    let body = masked.slice(0, end + 1);
    // Browser callbacks run in one page: blank them (inside this test only).
    for (const cb of masked.slice(open, end + 1).matchAll(BROWSER_CALLBACK)) {
      const from = open + cb.index + cb[0].length - 1;
      const stop = closing(masked, from);
      if (stop !== -1) body = blankRange(body, from + 1, stop);
    }
    const scan = body.slice(0, end + 1);
    for (const loop of scan.slice(open).matchAll(/(?<![\w$.])for\s*(await\s*)?\(/g)) {
      const at = open + loop.index;
      const headOpen = open + loop.index + loop[0].length - 1;
      const headEnd = closing(scan, headOpen);
      if (headEnd === -1) continue;
      const head = scan.slice(headOpen + 1, headEnd);
      const iterable = head.match(/\bof\b([\s\S]*)$/)?.[1];
      if (iterable === undefined || !refers(iterable)) continue;
      let stop = headEnd + 1;
      while (/\s/.test(scan[stop])) stop++;
      const bodyEnd = scan[stop] === '{' ? closing(scan, stop) : scan.indexOf(';', stop);
      const loopBody = scan.slice(stop, bodyEnd === -1 ? scan.length : bodyEnd + 1);
      if (loop[1] || /\bawait\b/.test(loopBody)) found.push({ line: lineOf(at), loop: `for (${head.trim().replace(/\s+/g, ' ')})` });
    }
    for (const each of scan.slice(open).matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)((?:\s*\.\s*[A-Za-z_$][\w$]*\s*\([^()]*\))*)\s*\.\s*(forEach|map|flatMap|filter|some|every|reduce)\s*\(/g)) {
      if (!refers(each[1])) continue;
      const from = open + each.index + each[0].length - 1;
      const stop = closing(scan, from);
      if (stop !== -1 && /\bawait\b/.test(scan.slice(from, stop + 1))) found.push({ line: lineOf(open + each.index), loop: `${each[1]}${each[2].replace(/\s+/g, '')}.${each[3]}(…)` });
    }
  }
  return found;
}

// The files that hold product test bodies: every spec (a per-item split such as <name>.inherited-api.spec.mjs included) and
// every support module that registers tests (support/inherited-api.mjs holds the inherited-API test bodies).
export function productSources(dir) {
  const read = names => names.sort().map(name => ({ name, text: readFileSync(join(dir, name), 'utf8') }));
  const support = existsSync(join(dir, 'support')) ? readdirSync(join(dir, 'support')).filter(name => name.endsWith('.mjs')).map(name => `support/${name}`) : [];
  return [
    ...read(readdirSync(dir).filter(name => name.endsWith('.spec.mjs'))),
    ...read(support).filter(({ text }) => /^\s*test\(/m.test(text)),
  ];
}
const specs = productSources(productDir);

// A scratch product directory: an ordinary spec, a per-item split spec, a support module that registers the split spec's
// tests (with the given body) and a plain helper that registers none.
function splitFixture(body) {
  const dir = mkdtempSync(join(tmpdir(), 'velcro-split-'));
  mkdirSync(join(dir, 'support'));
  writeFileSync(join(dir, 'alpha.spec.mjs'), "import { test } from '@playwright/test';\ntest('a', () => {});\n");
  writeFileSync(join(dir, 'beta.inherited-api.spec.mjs'), "import { register } from './support/split.mjs';\nregister('sl-beta');\n");
  writeFileSync(join(dir, 'support/split.mjs'), `import { test } from '@playwright/test';\nimport { readCatalog } from './c.mjs';\nconst catalog = readCatalog();\nexport function register(tag) {\n${body}\n}\n`);
  writeFileSync(join(dir, 'support/plain.mjs'), 'export const helper = () => 1;\n');
  return dir;
}

test('no product spec loops over the catalog inside one test, awaiting work for each item', () => {
  const offending = specs.flatMap(({ name, text }) => catalogLoopsInTests(text).map(({ line, loop }) => `${name}:${line} ${loop}`));
  assert.deepEqual(offending, [], 'generate one test per catalog item instead (each keeps the default budget and calls no test.setTimeout)');
});

test('the guard sees the catalog in the specs that read it', () => {
  const reading = specs.filter(({ text }) => /\breadCatalog\s*\(/.test(text));
  assert.ok(reading.length >= 5, `${reading.length} product specs read the catalog`);
  const names = file => catalogNames(mask(specs.find(s => s.name === file).text));
  assert.ok(names('base-path.spec.mjs').has('catalog') && names('base-path.spec.mjs').has('routes'));
  assert.ok(names('registration.spec.mjs').has('ALL_TAGS') && names('registration.spec.mjs').has('COMPONENTS'));
  assert.ok(names('site-landing.spec.mjs').has('catalog'));
});

// Fixtures: the guard flags what it should and nothing else.
const wrap = body => `import { readCatalog } from './c.mjs';\nconst catalog = readCatalog();\nconst names = catalog.map(c => c.name);\n${body}\n`;

test('the guard flags a loop over the catalog that awaits work for each item inside a test', () => {
  const flagged = body => catalogLoopsInTests(wrap(body)).length;
  assert.equal(flagged(`test('x', async ({ page }) => {\n  for (const c of catalog) {\n    await openDocs(page, c.name);\n  }\n});`), 1);
  assert.equal(flagged(`test('x', async ({ page }) => {\n  for (const [i, c] of catalog.entries()) await page.goto(c.name);\n});`), 1);
  assert.equal(flagged(`test('x', async ({ page }) => {\n  for (const n of names) {\n    await expect(page.locator(n)).toHaveCount(1);\n  }\n});`), 1);
  assert.equal(flagged(`test('x', async ({ page }) => {\n  for (const c of readCatalog()) await page.goto(c.name);\n});`), 1);
  assert.equal(flagged(`test('x', async ({ page }) => {\n  for await (const c of catalog) check(c);\n});`), 1);
  assert.equal(flagged(`test('x', async ({ page }) => {\n  await Promise.all(catalog.map(async c => { await page.goto(c.name); }));\n});`), 1);
  assert.equal(flagged(`test('x', async ({ page }) => {\n  names.filter(n => n).forEach(async n => { await page.goto(n); });\n});`), 1);
  assert.equal(flagged(`test.only('x', async ({ page }) => {\n  for (const c of catalog) await page.goto(c.name);\n});`), 1);
  assert.deepEqual(catalogLoopsInTests(wrap(`\ntest('x', async ({ page }) => {\n  for (const c of catalog) {\n    await page.goto(c.name);\n  }\n});`)), [{ line: 6, loop: 'for (const c of catalog)' }]);
});

test('the guard leaves alone loops that generate tests, in-memory loops and browser-side loops', () => {
  const flagged = body => catalogLoopsInTests(wrap(body)).length;
  // One generated test per item.
  assert.equal(flagged(`for (const c of catalog) {\n  test(c.name, async ({ page }) => { await page.goto(c.name); });\n}`), 0);
  assert.equal(flagged(`test.describe('x', () => {\n  for (const [i, c] of catalog.entries()) test(c.name, async ({ page }) => { await page.goto(c.name); });\n});`), 0);
  // No awaited work per item.
  assert.equal(flagged(`test('x', async ({ request }) => {\n  const html = await request.get('/');\n  for (const c of catalog) expect(html).toContain(c.name);\n});`), 0);
  assert.equal(flagged(`test('x', async () => {\n  const all = catalog.map(c => c.name);\n  expect(all).toEqual(names);\n});`), 0);
  // Inside one page round trip.
  assert.equal(flagged(`test('x', async ({ page }) => {\n  await page.evaluate(async list => { for (const c of list) await import(c); }, catalog);\n});`), 0);
  assert.equal(flagged(`test('x', async ({ page }) => {\n  await page.evaluate(async components => {\n    for (const { tag } of components) await customElements.whenDefined(tag);\n  }, catalog);\n});`), 0);
  // Not the catalog.
  assert.equal(flagged(`test('x', async ({ page }) => {\n  for (const tab of ['a', 'b']) await page.goto(tab);\n});`), 0);
  // Text that only looks like a loop.
  assert.equal(flagged(`test('x', async ({ page }) => {\n  // for (const c of catalog) await page.goto(c)\n  const s = 'for (const c of catalog) await page.goto(c)';\n  const t = \`for (const c of \${catalog}) await page.goto(c)\`;\n  await page.goto(/for (const c of catalog)/.source);\n});`), 0);
});

test('the guard finds the loop in a test that follows code with strings, templates and regular expressions', () => {
  const body = [
    `const re = /["'\`]x\\/y[/]/g;`,
    `const label = \`a \${ { b: 1 }.b } \${\`n\${1}\`}\`;`,
    `test("t's \\"quoted\\"", async ({ page }) => {`,
    `  const s = 'it\\'s';`,
    `  for (const c of catalog) await page.goto(\`/\${c.name}\`);`,
    `});`,
  ].join('\n');
  assert.deepEqual(catalogLoopsInTests(wrap(body)).map(f => f.loop), ['for (const c of catalog)']);
});

test('a split spec and the support module that registers its tests are scanned, and a catalog loop there is flagged', () => {
  const dir = splitFixture("test(`${tag} x`, async ({ page }) => {\n  for (const c of catalog) await page.goto(c.name);\n});");
  try {
    const sources = productSources(dir);
    assert.deepEqual(sources.map(s => s.name), ['alpha.spec.mjs', 'beta.inherited-api.spec.mjs', 'support/split.mjs']);
    const offending = sources.flatMap(({ name, text }) => catalogLoopsInTests(text).map(({ line }) => `${name}:${line}`));
    assert.deepEqual(offending, ['support/split.mjs:6']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
  // The real tree: every per-component split spec and the inherited-API support module are read.
  const names = specs.map(s => s.name);
  assert.ok(names.includes('support/inherited-api.mjs'));
  assert.ok(names.filter(n => n.endsWith('.inherited-api.spec.mjs')).length > 0);
});
