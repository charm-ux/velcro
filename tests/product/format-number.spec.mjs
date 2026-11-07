import { expect, test } from '@playwright/test';

const PAGE = '/components/format-number';

async function openExample(page) {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  // Litro's client router remounts the page component once after load, which reloads the iframe; wait for it to settle.
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  // The client router replaces the prerendered page once; until it has settled there can be two example iframes.
  await expect(page.locator('litro-outlet')).toHaveAttribute('data-litro-settled', '');
  const frame = page.frameLocator('iframe.example');
  await expect(frame.locator('#demo-default')).toBeVisible();
  await frame.locator('#demo-default').evaluate(() => customElements.whenDefined('sl-format-number'));
  await page.waitForLoadState('networkidle');
  return { frame, requests };
}

const texts = (frame, selector) =>
  frame.locator(selector).evaluateAll(els => els.map(el => el.shadowRoot.textContent.split('').map(c => (c.trim() === '' ? ' ' : c)).join('')));

// Creates an element in the example document, waits for its update, runs `fn` on it, removes it.
const withElement = (frame, attrs, fn) =>
  frame.locator('body').evaluate(
    async (body, { attrs, fn }) => {
      const el = document.createElement('sl-format-number');
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
  expect(html).toContain('<title>Format Number - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Formats a number using the specified locale and options.');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('uses no translated terms');
  expect(html).toContain('RangeError');
  expect(html).toContain('Divergence: removing');
  expect(html).toContain('<code>ready</code>');
  expect(html).toContain('minimum-significant-digits');
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
  const home = await (await request.get('/')).text();
  expect(home).toContain('/components/format-number');
});

test('sl-format-number registers inside the example document (the docs page registers its own copy separately), as its own class', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  // The docs page loads the same runtime through its client entry (app-main.ts) into its own, separate registry.
  expect(await page.evaluate(() => customElements.whenDefined('sl-format-number').then(ctor => typeof ctor))).toBe('function');
  expect(await frame.locator('body').evaluate(() => customElements.get('sl-format-number') !== undefined)).toBe(true);
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
});

test('the docs example formats the default, percentages, locales and currencies like the Shoelace examples', async ({ page }) => {
  const { frame } = await openExample(page);
  expect(await texts(frame, '#demo-default')).toEqual(['1,000']);
  expect(await texts(frame, '#demo-percent sl-format-number')).toEqual(['0%', '25%', '50%', '75%', '100%']);
  expect(await texts(frame, '#demo-lang sl-format-number')).toEqual(['2,000.00', '2.000,00', '2 000,00']);
  expect(await texts(frame, '#demo-currency sl-format-number')).toEqual(['$2,000.00', '£2,000.00', '2.000,00 €', '2 000,00 ₽', '¥2,000.00']);
  await expect(frame.getByText('Default: 1,000')).toBeVisible();
});

test('structure and accessibility: upstream host sizing (inline, content-box), text only in the shadow root, no parts, slots, role or generated elements', async ({ page }) => {
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
  expect(info).toEqual({ elements: 0, parts: 0, slots: 0, role: null, ariaAttrs: [], lightChildren: 0, display: 'inline', boxSizing: 'content-box' });
});

test('defaults, and properties are not reflected to attributes', async ({ page }) => {
  const { frame } = await openExample(page);
  const result = await withElement(frame, {}, `
    const names = ['value', 'type', 'no-grouping', 'currency', 'currency-display', 'minimum-integer-digits', 'minimum-fraction-digits',
      'maximum-fraction-digits', 'minimum-significant-digits', 'maximum-significant-digits'];
    const defaults = { value: el.value, type: el.type, noGrouping: el.noGrouping, currency: el.currency, currencyDisplay: el.currencyDisplay,
      mid: el.minimumIntegerDigits, mfd: el.minimumFractionDigits, xfd: el.maximumFractionDigits, msd: el.minimumSignificantDigits,
      xsd: el.maximumSignificantDigits, lang: el.lang, text: el.shadowRoot.textContent };
    el.value = 1500.5; el.type = 'currency'; el.noGrouping = true; el.currency = 'EUR'; el.currencyDisplay = 'code';
    el.minimumIntegerDigits = 2; el.minimumFractionDigits = 1; el.maximumFractionDigits = 3;
    await el.updateComplete;
    return { defaults, attrs: el.getAttributeNames().filter(n => names.includes(n)), text: el.shadowRoot.textContent.split('').map(c => (c.trim() === '' ? ' ' : c)).join('') };
  `);
  expect(result.defaults).toEqual({ value: 0, type: 'decimal', noGrouping: false, currency: 'USD', currencyDisplay: 'symbol',
    mid: undefined, mfd: undefined, xfd: undefined, msd: undefined, xsd: undefined, lang: undefined, text: '0' });
  expect(result.attrs).toEqual([]);
  expect(result.text).toBe('EUR 1500.5');
});

test('every option maps to Intl.NumberFormat: type, grouping, currency display, integer, fraction and significant digits', async ({ page }) => {
  const { frame } = await openExample(page);
  const out = await withElement(frame, { lang: 'en-US' }, `
    const run = async (attrs) => {
      for (const n of el.getAttributeNames()) if (n !== 'lang') el.removeAttribute(n);
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      await el.updateComplete;
      return el.shadowRoot.textContent.split('').map(c => (c.trim() === '' ? ' ' : c)).join('');
    };
    return {
      grouped: await run({ value: '1234567.891' }),
      noGrouping: await run({ value: '1234567.891', 'no-grouping': '' }),
      percent: await run({ value: '0.256', type: 'percent' }),
      symbol: await run({ value: '5', type: 'currency' }),
      narrow: await run({ value: '5', type: 'currency', currency: 'CAD', 'currency-display': 'narrowSymbol' }),
      code: await run({ value: '5', type: 'currency', 'currency-display': 'code' }),
      name: await run({ value: '5', type: 'currency', 'currency-display': 'name' }),
      minInt: await run({ value: '5', 'minimum-integer-digits': '3' }),
      minFrac: await run({ value: '5', 'minimum-fraction-digits': '2' }),
      maxFrac: await run({ value: '1.23456', 'maximum-fraction-digits': '2' }),
      minSig: await run({ value: '5', 'minimum-significant-digits': '3' }),
      maxSig: await run({ value: '123456', 'maximum-significant-digits': '2' }),
    };
  `);
  expect(out).toEqual({
    grouped: '1,234,567.891',
    noGrouping: '1234567.891',
    percent: '26%',
    symbol: '$5.00',
    narrow: '$5.00',
    code: 'USD 5.00',
    name: '5.00 US dollars',
    minInt: '005',
    minFrac: '5.00',
    maxFrac: '1.23',
    minSig: '5.00',
    maxSig: '120,000',
  });
});

test('non-numeric values render nothing and do not throw; negative and large values format', async ({ page }) => {
  const { frame } = await openExample(page);
  const out = await withElement(frame, { value: 'abc', lang: 'en-US' }, `
    const errors = [];
    const onError = e => errors.push(e.message);
    window.addEventListener('error', onError);
    const empty = el.shadowRoot.textContent;
    const results = {};
    for (const value of [-1500, 0, 1e21]) {
      el.value = value;
      await el.updateComplete;
      results[value] = el.shadowRoot.textContent;
    }
    window.removeEventListener('error', onError);
    return { empty, results, errors };
  `);
  expect(out).toEqual({ empty: '', results: { '-1500': '-1,500', 0: '0', 1e21: '1,000,000,000,000,000,000,000' }, errors: [] });
});

test('attribute changes update the output; removing an attribute restores the default (a documented divergence from Shoelace, which restores only reflected properties)', async ({ page }) => {
  const { frame } = await openExample(page);
  const out = await withElement(frame, { lang: 'en-US', value: '1200.5', type: 'currency', currency: 'EUR', 'currency-display': 'code', 'minimum-fraction-digits': '3' }, `
    const text = async () => { await el.updateComplete; return el.shadowRoot.textContent.split('').map(c => (c.trim() === '' ? ' ' : c)).join(''); };
    const steps = { initial: await text() };
    el.setAttribute('value', '3000'); steps.value = await text();
    el.removeAttribute('minimum-fraction-digits'); const t1 = await text(); steps.digitRemoved = [el.minimumFractionDigits, t1];
    el.removeAttribute('currency-display'); { const t = await text(); steps.displayRemoved = [el.currencyDisplay, t]; };
    el.removeAttribute('currency'); { const t = await text(); steps.currencyRemoved = [el.currency, t]; };
    el.removeAttribute('type'); { const t = await text(); steps.typeRemoved = [el.type, t]; };
    el.removeAttribute('value'); { const t = await text(); steps.valueRemoved = [el.value, t]; };
    el.minimumFractionDigits = null; el.type = null; await el.updateComplete; steps.propertyNull = [el.minimumFractionDigits, el.type, await text()];
    return steps;
  `);
  expect(out).toEqual({
    initial: 'EUR 1,200.500',
    value: 'EUR 3,000.000',
    digitRemoved: [undefined, 'EUR 3,000.00'],
    displayRemoved: ['symbol', '€3,000.00'],
    currencyRemoved: ['USD', '$3,000.00'],
    typeRemoved: ['decimal', '3,000'],
    valueRemoved: [0, '0'],
    propertyNull: [undefined, 'decimal', '0'],
  });
});

test('localization: lang attribute and property, document lang and dir changes re-render, host lang wins', async ({ page }) => {
  const { frame } = await openExample(page);
  const out = await withElement(frame, { value: '1234.5' }, `
    const text = async () => { await el.updateComplete; return el.shadowRoot.textContent.split('').map(c => (c.trim() === '' ? ' ' : c)).join(''); };
    const root = document.documentElement;
    const steps = { en: await text() };
    root.lang = 'de'; await new Promise(r => setTimeout(r, 50));
    steps.documentDe = await text();
    el.setAttribute('lang', 'fr'); steps.hostFr = await text();
    el.lang = 'en'; steps.hostProperty = [await text(), el.getAttribute('lang')];
    el.removeAttribute('lang'); await new Promise(r => setTimeout(r, 50));
    steps.removed = await text();
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
  expect(out.en).toBe('1,234.5');
  expect(out.documentDe).toBe('1.234,5');
  expect(out.hostFr).toBe('1 234,5'); // French groups with a narrow no-break space, normalized above
  expect(out.hostProperty).toEqual(['1,234.5', 'fr']); // lang is not reflected, as in Shoelace
  expect(out.removed).toBe('1.234,5');
  expect(out.dirChange).toEqual(['1,234.5', true]);
  expect(out.dirResolved).toEqual(['rtl', 'ltr']);
});

test('an invalid option throws a RangeError during the update, as Intl does', async ({ page }) => {
  const { frame } = await openExample(page);
  const out = await frame.locator('body').evaluate(async body => {
    const el = document.createElement('sl-format-number');
    el.setAttribute('type', 'currency');
    el.setAttribute('currency', 'not-a-code');
    const errors = [];
    const onError = e => { errors.push(e.error?.name); e.preventDefault(); };
    window.addEventListener('error', onError);
    const rejections = [];
    const onRejection = e => { rejections.push(e.reason?.name); e.preventDefault(); };
    window.addEventListener('unhandledrejection', onRejection);
    body.append(el);
    await new Promise(r => setTimeout(r, 100));
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
    el.remove();
    return { thrown: [...errors, ...rejections].includes('RangeError') };
  });
  expect(out).toEqual({ thrown: true });
});

test('document observer follows connection: a disconnected element is not re-rendered, a reconnected one is', async ({ page }) => {
  const { frame } = await openExample(page);
  const out = await frame.locator('body').evaluate(async body => {
    const el = document.createElement('sl-format-number');
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
    const el = document.createElement('sl-format-number');
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
    return Object.getOwnPropertyNames(proto).filter(n => n !== 'constructor').sort();
  });
  expect(own).toEqual([
    'currency', 'currencyDisplay', 'lang', 'maximumFractionDigits', 'maximumSignificantDigits', 'minimumFractionDigits',
    'minimumIntegerDigits', 'minimumSignificantDigits', 'noGrouping', 'render', 'type', 'value', 'willUpdate',
  ].sort());
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  expect(await frame.locator('body').evaluate(() => Boolean(window.Shoelace || document.querySelector('script[src*="shoelace"]')))).toBe(false);
});
