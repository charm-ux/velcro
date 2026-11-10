import { expect, test } from '@playwright/test';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/format-bytes';

async function openExample(page) {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  const frame = page.frameLocator('iframe.example');
  await expect(frame.locator('#demo-default')).toBeVisible();
  await frame.locator('#demo-default').evaluate(() => customElements.whenDefined('sl-format-bytes'));
  await documentsLoaded(page);
  return { frame, requests };
}

const texts = (frame, selector) =>
  frame.locator(selector).evaluateAll(els => els.map(el => el.shadowRoot.textContent));

// Creates an element in the example document, waits for its update, runs `fn` on it, removes it.
const withElement = (frame, attrs, fn) =>
  frame.locator('body').evaluate(
    async (body, { attrs, fn }) => {
      const el = document.createElement('sl-format-bytes');
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      body.append(el);
      await el.updateComplete;
      try {
        return await new Function('el', `return (async () => { ${fn} })()`)(el);
      } finally {
        el.remove();
      }
    },
    { attrs, fn },
  );

test('docs page is prerendered with Velcro branding, prototype status and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Format Bytes - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('uses no translated terms');
  expect(html).toContain('A negative value is not guarded');
  expect(html).toContain('Divergence: removing');
  expect(html).toContain('<code>ready</code>');
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
  const home = await (await request.get('/')).text();
  expect(home).toContain('/components/format-bytes');
});

test('sl-format-bytes registers inside the example document (the docs page registers its own copy separately), as its own class', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  // The docs page loads the same runtime through its client entry (app-main.ts) into its own, separate registry.
  expect(await page.evaluate(() => customElements.whenDefined('sl-format-bytes').then(ctor => typeof ctor))).toBe('function');
  expect(await frame.locator('body').evaluate(() => customElements.get('sl-format-bytes') !== undefined)).toBe(true);
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
});

test('the docs example formats bytes, bits and a German locale like the Shoelace examples', async ({ page }) => {
  const { frame } = await openExample(page);
  const all = await frame.locator('sl-format-bytes').evaluateAll(els =>
    els.map(el => ({ id: el.id, unit: el.unit, lang: el.getAttribute('lang'), text: el.shadowRoot.textContent })),
  );
  const bytes = all.filter(e => e.unit === 'byte' && !e.lang && e.id !== 'demo-long').map(e => e.text);
  expect(bytes).toEqual(['12 byte', '1.2 kB', '1.2 MB', '1.2 GB']);
  expect(all.filter(e => e.unit === 'bit').map(e => e.text)).toEqual(['12 bit', '1.2 kb', '1.2 Mb', '1.2 Gb']);
  expect(all.filter(e => e.lang === 'de').map(e => e.text.replace(/\s/g, ' '))).toEqual(['12 Byte', '1,2 kB', '1,2 MB', '1,2 GB']);
  expect(await texts(frame, '#demo-long')).toEqual(['1.2 megabytes']);
});

test('structure and accessibility: text only in the shadow root, no parts, slots, role or generated elements', async ({ page }) => {
  const { frame } = await openExample(page);
  const info = await frame.locator('#demo-default').evaluate(el => ({
    elements: el.shadowRoot.querySelectorAll('*').length,
    parts: el.shadowRoot.querySelectorAll('[part]').length,
    slots: el.shadowRoot.querySelectorAll('slot').length,
    role: el.getAttribute('role'),
    ariaAttrs: el.getAttributeNames().filter(n => n.startsWith('aria-')),
    lightChildren: el.childNodes.length,
    display: getComputedStyle(el).display,
    boxSizing: getComputedStyle(el).boxSizing,
  }));
  expect(info).toEqual({ elements: 0, parts: 0, slots: 0, role: null, ariaAttrs: [], lightChildren: 0, display: 'inline', boxSizing: 'border-box' });
  await expect(frame.getByText('Bytes: 12 byte, 1.2 kB, 1.2 MB, 1.2 GB')).toBeVisible();
});

test('defaults, and properties are not reflected to attributes', async ({ page }) => {
  const { frame } = await openExample(page);
  const result = await withElement(frame, {}, `
    const defaults = { value: el.value, unit: el.unit, display: el.display, lang: el.lang, text: el.shadowRoot.textContent };
    el.value = 1500; el.unit = 'bit'; el.display = 'long';
    await el.updateComplete;
    return { defaults, attrs: el.getAttributeNames().filter(n => ['value', 'unit', 'display'].includes(n)), text: el.shadowRoot.textContent };
  `);
  expect(result.defaults).toEqual({ value: 0, unit: 'byte', display: 'short', lang: undefined, text: '0 byte' }); // lang starts undefined, as in Shoelace
  expect(result.attrs).toEqual([]);
  expect(result.text).toBe('1.5 kilobits');
});

test('unit and prefix selection: thresholds, three significant digits, and the byte/bit prefix limits', async ({ page }) => {
  const { frame } = await openExample(page);
  const out = await withElement(frame, {}, `
    const run = async (value, unit, display = 'short') => {
      el.value = value; el.unit = unit; el.display = display;
      await el.updateComplete;
      return el.shadowRoot.textContent;
    };
    return {
      b999: await run(999, 'byte'),
      b1000: await run(1000, 'byte'),
      sig: await run(1234567, 'byte'),
      rounded: await run(999999, 'byte'),
      peta: await run(5e15, 'byte'),
      beyondPeta: await run(5e18, 'byte'),
      tera: await run(5e12, 'bit'),
      beyondTera: await run(5e15, 'bit'),
      narrow: await run(1200, 'byte', 'narrow'),
    };
  `);
  expect(out).toEqual({
    b999: '999 byte',
    b1000: '1 kB',
    sig: '1.23 MB',
    rounded: '1,000 kB',
    peta: '5 PB',
    beyondPeta: '5,000 PB',
    tera: '5 Tb',
    beyondTera: '5,000 Tb',
    narrow: '1.2kB',
  });
});

test('non-numeric and negative values render nothing and do not throw', async ({ page }) => {
  const { frame } = await openExample(page);
  const out = await withElement(frame, { value: 'abc' }, `
    const errors = [];
    const onError = e => errors.push(e.message);
    window.addEventListener('error', onError);
    const empty = el.shadowRoot.textContent;
    const results = {};
    for (const value of [-1, -1500, -0.5]) {
      el.value = value;
      await el.updateComplete;
      results[value] = el.shadowRoot.textContent;
    }
    window.removeEventListener('error', onError);
    return { empty, results, errors };
  `);
  expect(out).toEqual({ empty: '', results: { '-1': '', '-1500': '', '-0.5': '' }, errors: [] });
});

test('attribute changes update the output; removing an attribute restores the default (a documented divergence from Shoelace, which restores only reflected properties)', async ({ page }) => {
  const { frame } = await openExample(page);
  const out = await withElement(frame, { value: '1200', unit: 'bit', display: 'long' }, `
    const text = async () => { await el.updateComplete; return el.shadowRoot.textContent; };
    const steps = { initial: await text() };
    el.setAttribute('value', '1200000'); steps.value = await text();
    el.removeAttribute('value'); await el.updateComplete; steps.valueRemoved = [el.value, await text()];
    el.removeAttribute('unit'); await el.updateComplete; steps.unitRemoved = [el.unit, await text()];
    el.removeAttribute('display'); await el.updateComplete; steps.displayRemoved = [el.display, await text()];
    return steps;
  `);
  expect(out).toEqual({
    initial: '1.2 kilobits',
    value: '1.2 megabits',
    valueRemoved: [0, '0 bits'],
    unitRemoved: ['byte', '0 bytes'],
    displayRemoved: ['short', '0 byte'],
  });
});

test('localization: lang attribute and property, document lang and dir changes re-render, host lang wins', async ({ page }) => {
  const { frame } = await openExample(page);
  const out = await withElement(frame, { value: '1200' }, `
    const text = async () => { await el.updateComplete; return el.shadowRoot.textContent; };
    const root = document.documentElement;
    const steps = { en: await text() };
    root.lang = 'de'; await new Promise(r => setTimeout(r, 50));
    steps.documentDe = await text();
    el.setAttribute('lang', 'fr'); steps.hostFr = await text();
    el.lang = 'en'; steps.hostProperty = [await text(), el.getAttribute('lang')];
    el.removeAttribute('lang'); await new Promise(r => setTimeout(r, 50));
    steps.removed = await text();
    steps.removedLang = el.lang;
    root.lang = 'en';
    let updates = 0;
    const original = el.requestUpdate.bind(el);
    el.requestUpdate = (...args) => { updates++; return original(...args); };
    root.dir = 'rtl'; await new Promise(r => setTimeout(r, 50));
    steps.dirChange = [el.shadowRoot.textContent, updates > 0];
    steps.dirResolved = [el.localize.dir(), (el.setAttribute('dir', 'LTR'), el.localize.dir())];
    root.removeAttribute('dir');
    return steps;
  `);
  expect(out.en).toBe('1.2 kB');
  expect(out.documentDe).toBe('1,2 kB');
  expect(out.hostFr.replace(/\s/g, ' ')).toBe('1,2 ko'); // French uses "octet"
  expect(out.hostProperty[0]).toBe('1.2 kB');
  expect(out.removed).toBe('1,2 kB');
  expect(out.removedLang).toBeNull(); // a removed attribute leaves null, as in Shoelace
  expect(out.dirChange).toEqual(['1.2 kB', true]);
  expect(out.dirResolved).toEqual(['rtl', 'ltr']);
});

test('document observer follows connection: a disconnected element is not re-rendered, a reconnected one is', async ({ page }) => {
  const { frame } = await openExample(page);
  const out = await frame.locator('body').evaluate(async body => {
    const el = document.createElement('sl-format-bytes');
    el.value = 1200;
    body.append(el);
    await el.updateComplete;
    el.remove();
    let updates = 0;
    const original = el.requestUpdate.bind(el);
    el.requestUpdate = (...args) => { updates++; return original(...args); };
    document.documentElement.lang = 'de';
    await new Promise(r => setTimeout(r, 50));
    const whileDisconnected = updates;
    body.append(el);
    await el.updateComplete;
    document.documentElement.lang = 'en';
    await new Promise(r => setTimeout(r, 50));
    el.remove();
    return { whileDisconnected, afterReconnect: updates > 0 };
  });
  expect(out).toEqual({ whileDisconnected: 0, afterReconnect: true });
});

test('events: only the inherited non-bubbling ready event is emitted, once, after the first update', async ({ page }) => {
  const { frame } = await openExample(page);
  const out = await frame.locator('body').evaluate(async body => {
    const el = document.createElement('sl-format-bytes');
    const seen = [];
    for (const name of ['ready', 'sl-change', 'sl-input', 'sl-load']) el.addEventListener(name, e => seen.push([name, e.bubbles, e.composed]));
    let bodySaw = 0;
    body.addEventListener('ready', () => bodySaw++);
    body.append(el);
    await el.updateComplete;
    el.value = 5;
    await el.updateComplete;
    el.remove();
    return { seen, bodySaw };
  });
  expect(out).toEqual({ seen: [['ready', false, false]], bodySaw: 0 });
});

test('no public methods beyond the Lit and core base, no upstream Shoelace runtime, all requests local', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  const own = await frame.locator('#demo-default').evaluate(el => {
    const proto = Object.getPrototypeOf(el);
    return [...new Set([proto, Object.getPrototypeOf(proto)].flatMap(p => Object.getOwnPropertyNames(p)))]
      .filter(n => n !== 'constructor').sort();
  });
  expect(own).toEqual(['display', 'lang', 'render', 'unit', 'value', 'willUpdate'].sort());
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  expect(await frame.locator('body').evaluate(() => Boolean(window.Shoelace || document.querySelector('script[src*="shoelace"]')))).toBe(false);
});
