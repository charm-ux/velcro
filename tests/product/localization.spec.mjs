// Velcro's localization module (packages/velcro/src/utilities/localize.ts on internal/localize.ts) and the four components
// that render translated terms as Shoelace 2.20.1 does: sl-spinner ("loading"), sl-progress-bar and sl-progress-ring
// ("progress", when label is empty) and sl-split-panel's divider ("resize"). The registry and the vendored translation
// modules are not public package exports yet, so they are loaded through internal fixtures; the components through their
// public registering entries. Translation strings used here are generated per run.
import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { buildFixtures, gotoBlank } from './support/fixtures.mjs';

const CODES = ['ar', 'cs', 'da', 'de', 'de-ch', 'en', 'en-gb', 'es', 'fa', 'fi', 'fr', 'he', 'hr', 'hu', 'id', 'it', 'ja', 'nb',
  'nl', 'nn', 'pl', 'pt', 'ru', 'sl', 'sv', 'tr', 'uk', 'zh-cn', 'zh-tw'];
const fixtureName = code => `t_${code.replace('-', '_')}`;

let outDir;
test.beforeAll(async () => {
  const entries = {
    localize: "export * from 'velcro-internal:utilities/localize';",
    components: [
      "import '@charm-ux/velcro/spinner';",
      "import '@charm-ux/velcro/progress-bar';",
      "import '@charm-ux/velcro/progress-ring';",
      "import '@charm-ux/velcro/split-panel';",
    ].join('\n'),
  };
  for (const code of CODES) entries[fixtureName(code)] = `export { default } from 'velcro-internal:translations/${code}';`;
  outDir = await buildFixtures(entries);
});

test.beforeEach(async ({ page }) => {
  await gotoBlank(page, outDir);
});

// The expected term of a vendored translation, read from its source (de-CH and en-GB inherit from de and en).
function vendoredTerm(code, key) {
  const source = readFileSync(new URL(`../../packages/velcro/src/translations/${code}.ts`, import.meta.url), 'utf8');
  const match = source.match(new RegExp(`^  ${key}: '((?:[^'\\\\]|\\\\.)*)',?$`, 'm'));
  if (match) return match[1].replace(/\\'/g, "'");
  const base = source.match(/import baseTranslation from '\.\/([a-z-]+)\.js';/);
  if (!base) throw new Error(`${code}: no ${key}`);
  return vendoredTerm(base[1], key);
}

const unique = label => `${label}-${randomUUID()}`;

// Loads the localize module (or not) and the components, renders one of each, and exposes helpers on window.
async function setup(page, { first = [] } = {}) {
  await page.evaluate(async ({ first }) => {
    for (const path of first) await import(path);
    const loc = await import('/localize.js');
    await import('/components.js');
    window.loc = loc;
    document.body.innerHTML = `
      <sl-spinner></sl-spinner>
      <sl-progress-bar value="40"></sl-progress-bar>
      <sl-progress-ring value="40"></sl-progress-ring>
      <sl-split-panel><div slot="start"></div><div slot="end"></div></sl-split-panel>`;
    const tags = ['sl-spinner', 'sl-progress-bar', 'sl-progress-ring', 'sl-split-panel'];
    window.all = () => tags.map(t => document.querySelector(t));
    window.settle = async () => { for (const el of window.all()) await el.updateComplete; };
    window.names = async () => {
      await window.settle();
      const [spinner, bar, ring, split] = window.all();
      return {
        loading: spinner.shadowRoot.querySelector('[part~="base"]').getAttribute('aria-label'),
        bar: bar.shadowRoot.querySelector('[part~="base"]').getAttribute('aria-label'),
        ring: ring.shadowRoot.querySelector('[part~="base"]').getAttribute('aria-label'),
        resize: split.shadowRoot.querySelector('[part~="divider"]').getAttribute('aria-label'),
      };
    };
    window.setLang = lang => { for (const el of window.all()) { if (lang === null) el.removeAttribute('lang'); else el.setAttribute('lang', lang); } };
    await window.settle();
  }, { first });
}

const english = { loading: 'Loading', bar: 'Progress', ring: 'Progress', resize: 'Resize' };
const synthetic = () => ({ loading: unique('loading'), progress: unique('progress'), resize: unique('resize') });
const namesOf = t => ({ loading: t.loading, bar: t.progress, ring: t.progress, resize: t.resize });

test('the default accessible names are the English terms, as in Shoelace', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => document.documentElement.setAttribute('lang', 'en'));
  expect(await page.evaluate(() => window.names())).toEqual(english);
});

test('registering a translation re-renders connected components with its terms, through the element lang', async ({ page }) => {
  await setup(page);
  const terms = synthetic();
  await page.evaluate(() => window.setLang('xq'));
  expect(await page.evaluate(() => window.names())).toEqual(english);
  await page.evaluate(t => window.loc.registerTranslation({ $code: 'xq', $name: 'Test', $dir: 'ltr', ...t }), terms);
  expect(await page.evaluate(() => window.names())).toEqual(namesOf(terms));
});

test('a label overrides the progress term on the bar and the ring, as in Shoelace', async ({ page }) => {
  await setup(page);
  const terms = synthetic();
  const label = unique('label');
  const result = await page.evaluate(async ({ t, label }) => {
    window.loc.registerTranslation({ $code: 'xq', $name: 'Test', $dir: 'ltr', ...t });
    window.setLang('xq');
    const [, bar, ring] = window.all();
    bar.label = label;
    ring.label = label;
    return window.names();
  }, { t: terms, label });
  expect(result).toEqual({ ...namesOf(terms), bar: label, ring: label });
});

test('the element lang wins over the document lang, and the document lang applies when the element has none', async ({ page }) => {
  await setup(page);
  const doc = synthetic();
  const own = synthetic();
  await page.evaluate(({ doc, own }) => {
    window.loc.registerTranslation({ $code: 'xq', $name: 'Doc', $dir: 'ltr', ...doc }, { $code: 'xr', $name: 'Own', $dir: 'ltr', ...own });
    document.documentElement.lang = 'xq';
  }, { doc, own });
  expect(await page.evaluate(() => window.names())).toEqual(namesOf(doc));
  await page.evaluate(() => window.setLang('xr'));
  expect(await page.evaluate(() => window.names())).toEqual(namesOf(own));
  await page.evaluate(() => window.setLang(null));
  expect(await page.evaluate(() => window.names())).toEqual(namesOf(doc));
});

test('an ancestor lang is ignored: only the element and the document element count, as in Shoelace', async ({ page }) => {
  await setup(page);
  const terms = synthetic();
  const result = await page.evaluate(async t => {
    window.loc.registerTranslation({ $code: 'xq', $name: 'Test', $dir: 'ltr', ...t });
    document.documentElement.lang = 'en';
    document.body.setAttribute('lang', 'xq');
    return window.names();
  }, terms);
  expect(result).toEqual(english);
});

test('changing the document lang re-renders without touching the components', async ({ page }) => {
  await setup(page);
  const terms = synthetic();
  await page.evaluate(t => {
    window.loc.registerTranslation({ $code: 'xq', $name: 'Test', $dir: 'ltr', ...t });
    document.documentElement.lang = 'en';
  }, terms);
  expect(await page.evaluate(() => window.names())).toEqual(english);
  // The observer callback is a microtask; names() waits for the resulting updates.
  const after = await page.evaluate(async () => {
    document.documentElement.lang = 'xq';
    await new Promise(r => setTimeout(r));
    return window.names();
  });
  expect(after).toEqual(namesOf(terms));
});

test('terms resolve region first, then the base language, then English; codes are case-insensitive', async ({ page }) => {
  await setup(page);
  const base = synthetic();
  const regional = { progress: unique('regional-progress') };
  await page.evaluate(({ base, regional }) => {
    window.loc.registerTranslation({ $code: 'xq', $name: 'Base', $dir: 'ltr', loading: base.loading, progress: base.progress });
    window.loc.registerTranslation({ $code: 'XQ-YY', $name: 'Regional', $dir: 'ltr', ...regional });
  }, { base, regional });
  await page.evaluate(() => window.setLang('xq-YY'));
  expect(await page.evaluate(() => window.names())).toEqual({ loading: base.loading, bar: regional.progress, ring: regional.progress, resize: 'Resize' });
  await page.evaluate(() => window.setLang('xq_yy'));
  expect(await page.evaluate(() => window.names())).toEqual({ loading: base.loading, bar: regional.progress, ring: regional.progress, resize: 'Resize' });
  await page.evaluate(() => window.setLang('xq-ZZ'));
  expect(await page.evaluate(() => window.names())).toEqual({ loading: base.loading, bar: base.progress, ring: base.progress, resize: 'Resize' });
});

test('an unregistered language falls back to English', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { document.documentElement.lang = 'xs'; window.setLang('xt-QQ'); });
  expect(await page.evaluate(() => window.names())).toEqual(english);
});

test('registering a code again merges the new terms over the old ones', async ({ page }) => {
  await setup(page);
  const first = synthetic();
  const second = { resize: unique('resize-again') };
  const result = await page.evaluate(({ first, second }) => {
    window.loc.registerTranslation({ $code: 'xq', $name: 'Test', $dir: 'ltr', ...first });
    window.loc.registerTranslation({ $code: 'xq', $name: 'Test', $dir: 'ltr', ...second });
    window.setLang('xq');
    return window.names();
  }, { first, second });
  expect(result).toEqual({ ...namesOf(first), resize: second.resize });
});

test('the controller API: exists, term with arguments, lang and dir; quirks: a missing term logs and renders its key, an empty term falls through, an invalid lang throws', async ({ page }) => {
  await setup(page);
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const r = await page.evaluate(() => {
    window.loc.registerTranslation({ $code: 'xq', $name: 'Test', $dir: 'ltr', loading: 'xq-loading' });
    const [spinner] = window.all();
    const c = spinner.localize;
    spinner.setAttribute('lang', 'XQ');
    spinner.setAttribute('dir', 'RTL');
    return {
      lang: c.lang(),
      dir: c.dir(),
      existsOwn: c.exists('loading', {}),
      existsMissing: c.exists('progress', {}),
      existsFallback: c.exists('progress', { includeFallback: true }),
      existsOtherLang: c.exists('loading', { lang: 'en' }),
      slide: c.term('goToSlide', 2, 5),
      missing: c.term('notATerm'),
      emptyFallsThrough: (window.loc.registerTranslation({ $code: 'xq', $name: 'Test', $dir: 'ltr', progress: '' }), c.term('progress')),
      invalidLang: (() => { spinner.setAttribute('lang', 'not a tag'); try { c.term('loading'); return 'no error'; } catch (e) { return e.name; } })(),
    };
  });
  expect(r).toEqual({
    lang: 'xq', dir: 'rtl', existsOwn: true, existsMissing: false, existsFallback: true, existsOtherLang: true,
    slide: 'Go to slide 2 of 5', missing: 'notATerm', emptyFallsThrough: 'Progress', invalidLang: 'RangeError',
  });
  expect(errors).toContain('No translation found for: notATerm');
});

test('every vendored Shoelace translation registers itself and renders its terms', async ({ page }) => {
  await setup(page);
  for (const code of CODES) {
    const names = await page.evaluate(async ({ code, file }) => {
      await import(`/${file}.js`);
      window.setLang(code);
      return window.names();
    }, { code, file: fixtureName(code) });
    const progress = vendoredTerm(code, 'progress');
    expect(names, code).toEqual({ loading: vendoredTerm(code, 'loading'), bar: progress, ring: progress, resize: vendoredTerm(code, 'resize') });
  }
});

test('a vendored translation exports the registered object; its direction does not set the element direction', async ({ page }) => {
  await setup(page);
  const r = await page.evaluate(async () => {
    const ar = (await import('/t_ar.js')).default;
    const [, bar] = window.all();
    bar.setAttribute('lang', 'ar');
    bar.indeterminate = true;
    await bar.updateComplete;
    return { code: ar.$code, dir: ar.$dir, rtl: bar.shadowRoot.querySelector('[part~="base"]').classList.contains('progress-bar--rtl') };
  });
  expect(r).toEqual({ code: 'ar', dir: 'rtl', rtl: false });
});

test('progress-bar rtl follows its own dir, then the document dir (not an ancestor), and re-renders on a document change', async ({ page }) => {
  await setup(page);
  const r = await page.evaluate(async () => {
    const [, bar] = window.all();
    bar.indeterminate = true;
    const rtl = async () => { await new Promise(r => setTimeout(r)); await bar.updateComplete; return bar.shadowRoot.querySelector('[part~="base"]').classList.contains('progress-bar--rtl'); };
    const out = {};
    document.body.setAttribute('dir', 'rtl');
    out.ancestor = await rtl();
    document.body.removeAttribute('dir');
    document.documentElement.dir = 'rtl';
    out.document = await rtl();
    bar.setAttribute('dir', 'ltr');
    out.ownOverDocument = await rtl();
    bar.removeAttribute('dir');
    document.documentElement.dir = '';
    out.reset = await rtl();
    return out;
  });
  expect(r).toEqual({ ancestor: false, document: true, ownOverDocument: false, reset: false });
});

test('a translation that imports the public localize module, loaded first, keeps English the fallback', async ({ page }) => {
  await setup(page, { first: ['/t_de.js'] });
  await page.evaluate(() => { document.documentElement.lang = 'en'; window.setLang('xs'); });
  // de.ts imports the public localize module, which registers English first: English stays the fallback.
  expect(await page.evaluate(() => window.names())).toEqual(english);
});

test('upstream quirk matched: a translation that imports the registry directly (ar) becomes the fallback when loaded first', async ({ page }) => {
  await setup(page, { first: ['/t_ar.js'] });
  await page.evaluate(() => window.setLang('xs'));
  const progress = vendoredTerm('ar', 'progress');
  expect(await page.evaluate(() => window.names())).toEqual({ loading: vendoredTerm('ar', 'loading'), bar: progress, ring: progress, resize: vendoredTerm('ar', 'resize') });
});

test('the localization page documents the pending entry points, resolution, quirks and the localized components', async ({ request }) => {
  const res = await request.get('/localization');
  expect(res.status()).toBe(200);
  const html = await res.text();
  for (const text of ['Status: the entry points are pending', 'Translation resolution', 'Multiple locales per page', 'Upstream quirks matched',
    'Differences from Shoelace', 'Not implemented or unverified', 'registerTranslation', '/components/split-panel', 'zh-tw']) {
    expect(html, text).toContain(text);
  }
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  for (const name of ['spinner', 'progress-bar', 'progress-ring', 'split-panel']) {
    expect(await (await request.get(`/components/${name}`)).text(), name).toContain('/localization');
  }
});
