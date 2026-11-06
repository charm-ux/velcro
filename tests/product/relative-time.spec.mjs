import { expect, test } from '@playwright/test';

const PAGE = '/components/relative-time';
const RELEASE = '2020-07-15T09:17:00-04:00';

async function openExample(page) {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  // Litro's client router remounts the page component once after load, which reloads the iframe; wait for it to settle.
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  // The client router replaces the prerendered page once; until it has settled there can be two example iframes.
  await expect(page.locator('litro-outlet')).toHaveAttribute('data-litro-settled', '');
  const frame = page.frameLocator('iframe.example');
  await expect(frame.locator('#demo-default')).toBeVisible();
  await frame.locator('#demo-default').evaluate(() => customElements.whenDefined('sl-relative-time'));
  await page.waitForLoadState('networkidle');
  return { frame, requests };
}

// Creates an element in the example document, waits for its update, runs `fn` on it, removes it.
const withElement = (frame, attrs, fn) =>
  frame.locator('body').evaluate(
    async (body, { attrs, fn }) => {
      const el = document.createElement('sl-relative-time');
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
  expect(html).toContain('<title>Relative Time - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('translation registry');
  expect(html).toContain('Divergence: removing');
  expect(html).toContain('resumes updating');
  expect(html).toContain('<code>ready</code>');
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
  const home = await (await request.get('/')).text();
  expect(home).toContain('/components/relative-time');
});

test('sl-relative-time registers inside the example document (the docs page registers its own copy separately), as its own class', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  // The docs page loads the same runtime through its client entry (app-main.ts) into its own, separate registry.
  expect(await page.evaluate(() => customElements.whenDefined('sl-relative-time').then(ctor => typeof ctor))).toBe('function');
  expect(await frame.locator('body').evaluate(() => customElements.get('sl-relative-time') !== undefined)).toBe(true);
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
});

test('the docs example renders the Shoelace examples: release date, formats and languages', async ({ page }) => {
  const { frame } = await openExample(page);
  const text = selector => frame.locator(selector).evaluateAll(els => els.map(el => el.shadowRoot.textContent.trim()));
  const years = new Date().getFullYear() - 2020;
  const release = await text('#demo-default');
  expect(release).toHaveLength(1);
  expect(release[0]).toMatch(/^\d+ years ago$/);
  expect(Math.abs(parseInt(release[0], 10) - years)).toBeLessThanOrEqual(1);
  const formats = await text('#demo-formats sl-relative-time');
  expect(formats[2]).toMatch(/^\d+ years ago$/);
  expect(formats[1]).toMatch(/^\d+ yr\. ago$/);
  expect(formats[0]).toMatch(/^\d+y ago$/);
  const langs = await text('#demo-lang sl-relative-time');
  const n = parseInt(release[0], 10);
  expect(langs).toEqual([`${n} years ago`, `${n}年前`, `vor ${n} Jahren`, `πριν από ${n} έτη`, `${n} лет назад`]);
  const sync = await text('#demo-sync sl-relative-time');
  expect(sync).toEqual(['1 minute ago']);
});

test('structure and accessibility: one time element with an ISO datetime, no parts, slots or role', async ({ page }) => {
  const { frame } = await openExample(page);
  const info = await frame.locator('#demo-default').evaluate(el => {
    const time = el.shadowRoot.querySelector('time');
    return {
      elements: [...el.shadowRoot.querySelectorAll('*')].map(e => e.localName),
      datetime: time.getAttribute('datetime'),
      timeAttrs: time.getAttributeNames(),
      parts: el.shadowRoot.querySelectorAll('[part]').length,
      slots: el.shadowRoot.querySelectorAll('slot').length,
      role: el.getAttribute('role'),
      ariaAttrs: el.getAttributeNames().filter(n => n.startsWith('aria-')),
      lightChildren: el.childNodes.length,
      display: getComputedStyle(el).display,
      boxSizing: getComputedStyle(el).boxSizing,
    };
  });
  expect(info).toEqual({
    elements: ['time'],
    datetime: new Date(RELEASE).toISOString(),
    timeAttrs: ['datetime'],
    parts: 0,
    slots: 0,
    role: null,
    ariaAttrs: [],
    lightChildren: 0,
    display: 'inline',
    boxSizing: 'content-box',
  });
});

test('defaults, and properties are not reflected to attributes', async ({ page }) => {
  const { frame } = await openExample(page);
  const result = await withElement(frame, {}, `
    const before = Date.now();
    const defaults = { dateIsDate: el.date instanceof Date, dateNow: Math.abs(el.date.getTime() - before) < 5000, format: el.format, numeric: el.numeric,
      sync: el.sync, lang: el.lang, text: el.shadowRoot.textContent.trim() };
    el.date = new Date(Date.now() - 3 * 86400000); el.format = 'short'; el.numeric = 'always'; el.sync = true; el.lang = 'de';
    await el.updateComplete;
    return { defaults, attrs: el.getAttributeNames(), text: el.shadowRoot.textContent.trim() };
  `);
  expect(result.defaults).toEqual({ dateIsDate: true, dateNow: true, format: 'long', numeric: 'auto', sync: false, lang: undefined, text: 'this minute' });
  expect(result.attrs).toEqual([]);
  expect(result.text).toBe('vor 3 Tagen');
});

test('unit selection: thresholds, rounding, past and future, numeric auto and always, formats', async ({ page }) => {
  const { frame } = await openExample(page);
  const out = await withElement(frame, {}, `
    const M = 60000, H = 3600000, D = 86400000;
    const run = async (offset, extra = {}) => {
      Object.assign(el, { format: 'long', numeric: 'auto' }, extra);
      el.date = new Date(Date.now() + offset);
      await el.updateComplete;
      return el.shadowRoot.textContent.trim();
    };
    return {
      minutes5: await run(-5 * M - 5000),
      fortyFive: await run(-45 * M),
      fortySeven: await run(-47 * M),
      future: await run(3 * H + 5000),
      yesterday: await run(-1 * D - 5000),
      yesterdayAlways: await run(-1 * D - 5000, { numeric: 'always' }),
      tomorrow: await run(1 * D + 5000),
      days5: await run(-5 * D),
      week: await run(-7 * D),
      months: await run(-60 * D),
      years: await run(-800 * D),
      short: await run(-5 * M - 5000, { format: 'short' }),
      narrow: await run(-5 * M - 5000, { format: 'narrow' }),
    };
  `);
  expect(out).toEqual({
    minutes5: '5 minutes ago',
    fortyFive: '45 minutes ago',
    fortySeven: '1 hour ago',
    future: 'in 3 hours',
    yesterday: 'yesterday',
    yesterdayAlways: '1 day ago',
    tomorrow: 'tomorrow',
    days5: '5 days ago',
    week: 'last week',
    months: '2 months ago',
    years: '2 years ago',
    short: '5 min. ago',
    narrow: '5m ago',
  });
});

test('date accepts strings and Date objects; an invalid date renders nothing and does not throw', async ({ page }) => {
  const { frame } = await openExample(page);
  const out = await withElement(frame, {}, `
    const errors = [];
    const onError = e => errors.push(e.message);
    window.addEventListener('error', onError);
    const iso = new Date(Date.now() - 2 * 3600000 - 5000).toISOString();
    const read = () => ({ html: el.shadowRoot.querySelector('time')?.outerHTML ?? null, text: el.shadowRoot.textContent.trim() });
    el.setAttribute('date', iso); await el.updateComplete;
    const fromString = [typeof el.date, read().text, el.shadowRoot.querySelector('time').getAttribute('datetime') === iso];
    el.date = new Date(Date.now() + 2 * 3600000 + 5000); await el.updateComplete;
    const fromDate = [typeof el.date, read().text];
    el.setAttribute('date', 'not a date'); await el.updateComplete;
    const invalid = read();
    window.removeEventListener('error', onError);
    return { fromString, fromDate, invalid, errors };
  `);
  expect(out).toEqual({
    fromString: ['string', '2 hours ago', true],
    fromDate: ['object', 'in 2 hours'],
    invalid: { html: null, text: '' },
    errors: [],
  });
});

test('removing an attribute restores the default (a documented divergence from Shoelace, which restores only reflected properties)', async ({ page }) => {
  const { frame } = await openExample(page);
  const out = await withElement(frame, { date: RELEASE, format: 'narrow', numeric: 'always' }, `
    const state = async () => { await el.updateComplete; return [el.shadowRoot.textContent.trim().replace(/\\d+/, 'N'), el.format, el.numeric, typeof el.date]; };
    const steps = { initial: await state() };
    el.removeAttribute('format'); steps.format = await state();
    el.removeAttribute('numeric'); steps.numeric = await state();
    el.removeAttribute('date'); steps.date = await state();
    return steps;
  `);
  expect(out).toEqual({
    initial: ['Ny ago', 'narrow', 'always', 'string'],
    format: ['N years ago', 'long', 'always', 'string'],
    numeric: ['N years ago', 'long', 'auto', 'string'],
    date: ['this minute', 'long', 'auto', 'object'],
  });
});

test('localization: lang attribute and property, document lang and dir changes re-render, host lang wins', async ({ page }) => {
  const { frame } = await openExample(page);
  const out = await withElement(frame, {}, `
    el.date = new Date(Date.now() - 3 * 86400000 - 5000);
    const text = async () => { await el.updateComplete; return el.shadowRoot.textContent.trim(); };
    const root = document.documentElement;
    const steps = { en: await text() };
    root.lang = 'de'; await new Promise(r => setTimeout(r, 50));
    steps.documentDe = await text();
    el.setAttribute('lang', 'fr'); steps.hostFr = await text();
    el.lang = 'en'; steps.hostProperty = [await text(), el.getAttribute('lang')]; /* the attribute is not updated: lang is not reflected */;
    el.removeAttribute('lang'); await new Promise(r => setTimeout(r, 50));
    steps.removed = [await text(), el.lang];
    root.lang = 'en';
    let updates = 0;
    const original = el.requestUpdate.bind(el);
    el.requestUpdate = (...args) => { updates++; return original(...args); };
    root.dir = 'rtl'; await new Promise(r => setTimeout(r, 50));
    steps.dirChange = [el.shadowRoot.textContent.trim(), updates > 0];
    root.removeAttribute('dir');
    return steps;
  `);
  expect(out.en).toBe('3 days ago');
  expect(out.documentDe).toBe('vor 3 Tagen');
  expect(out.hostFr).toBe('il y a 3 jours');
  expect(out.hostProperty).toEqual(['3 days ago', 'fr']);
  expect(out.removed[0]).toBe('vor 3 Tagen');
  expect(out.dirChange).toEqual(['3 days ago', true]);
});

test('sync: a synced element updates as time passes, an unsynced one does not, and the timer stops when disconnected and resumes on reconnect', async ({ page }) => {
  const { frame } = await openExample(page);
  const out = await frame.locator('body').evaluate(async body => {
    const make = sync => {
      const el = document.createElement('sl-relative-time');
      el.sync = sync;
      // 89.5 seconds ago is "1 minute ago"; a render one to two seconds later it rounds to "2 minutes ago".
      el.date = new Date(Date.now() - 89500);
      body.append(el);
      return el;
    };
    const synced = make(true);
    const plain = make(false);
    await Promise.all([synced.updateComplete, plain.updateComplete]);
    const initial = [synced, plain].map(e => e.shadowRoot.textContent.trim());
    // The synced element re-renders on second boundaries, so two seconds guarantee a render after the rounding flips.
    await new Promise(r => setTimeout(r, 2300));
    await Promise.all([synced.updateComplete, plain.updateComplete]);
    const later = [synced, plain].map(e => e.shadowRoot.textContent.trim());

    // Disconnect: the pending timer is cleared, so no render happens while detached.
    const detached = make(true);
    await detached.updateComplete;
    detached.remove();
    let renders = 0;
    const render = detached.render.bind(detached);
    detached.render = () => { renders++; return render(); };
    await new Promise(r => setTimeout(r, 1300));
    const whileDetached = renders;
    body.append(detached);
    await detached.updateComplete;
    const afterReconnect = renders;
    await new Promise(r => setTimeout(r, 1300));
    const resumed = renders > afterReconnect;
    synced.remove(); plain.remove(); detached.remove();
    return { initial, later, whileDetached, resumed };
  });
  expect(out).toEqual({ initial: ['1 minute ago', '1 minute ago'], later: ['2 minutes ago', '1 minute ago'], whileDetached: 0, resumed: true });
});

test('events: only the inherited non-bubbling ready event is emitted, once, after the first update', async ({ page }) => {
  const { frame } = await openExample(page);
  const out = await frame.locator('body').evaluate(async body => {
    const el = document.createElement('sl-relative-time');
    const seen = [];
    for (const name of ['ready', 'sl-change', 'sl-input', 'sl-load']) el.addEventListener(name, e => seen.push([name, e.bubbles, e.composed]));
    let bodySaw = 0;
    body.addEventListener('ready', () => bodySaw++);
    body.append(el);
    await el.updateComplete;
    el.format = 'short';
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
  expect(own).toEqual(['connectedCallback', 'date', 'disconnectedCallback', 'format', 'lang', 'numeric', 'render', 'sync', 'willUpdate']);
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  expect(await frame.locator('body').evaluate(() => Boolean(window.Shoelace || document.querySelector('script[src*="shoelace"]')))).toBe(false);
});
