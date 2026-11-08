import { expect, test } from '@playwright/test';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/format-date';

test.use({ timezoneId: 'UTC', locale: 'en-US' });

async function openExample(page) {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  const frame = page.frameLocator('iframe.example');
  await expect(frame.locator('#demo-default')).toBeVisible();
  await frame.locator('#demo-default').evaluate(() => customElements.whenDefined('sl-format-date'));
  await documentsLoaded(page);
  return { frame, requests };
}

const norm = text => text.replace(/\s+/g, ' ').trim();

// Creates an element in the example document, waits for its update, runs `fn` on it, removes it.
const withElement = (frame, attrs, fn) =>
  frame.locator('body').evaluate(
    async (body, { attrs, fn }) => {
      const el = document.createElement('sl-format-date');
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

const FIXED = { date: '2020-07-15T13:17:05Z', 'time-zone': 'UTC' };

test('docs page is prerendered with Velcro branding, prototype status and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Format Date - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('uses no translated terms');
  expect(html).toContain('Divergence: Shoelace restores');
  expect(html).toContain('<code>ready</code>');
  expect(html).toContain('hour-format');
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
  const home = await (await request.get('/')).text();
  expect(home).toContain('/components/format-date');
});

test('sl-format-date registers inside the example document (the docs page registers its own copy separately), as its own class', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  // The docs page loads the same runtime through its client entry (app-main.ts) into its own, separate registry.
  expect(await page.evaluate(() => customElements.whenDefined('sl-format-date').then(ctor => typeof ctor))).toBe('function');
  expect(await frame.locator('body').evaluate(() => customElements.get('sl-format-date') !== undefined)).toBe(true);
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
});

test('the docs example renders the release date, hour formats and localized dates like the Shoelace examples', async ({ page }) => {
  const { frame } = await openExample(page);
  const text = selector => frame.locator(selector).evaluateAll(els => els.map(el => el.shadowRoot.textContent.replace(/\s+/g, ' ').trim()));
  expect(await text('#demo-default')).toEqual(['7/15/2020']);
  expect(await frame.locator('#demo-default').evaluate(el => el.shadowRoot.querySelector('time').getAttribute('datetime'))).toBe('2020-07-15T13:17:00.000Z');
  expect(await text('#demo-hours sl-format-date')).toEqual(['3:17 PM', '15:17']);
  // The "current time" examples cannot be fixed, so compare them with Intl in the same browser.
  const now = await frame.locator('#demo-now sl-format-date').evaluateAll(els =>
    els.map(el => ({
      text: el.shadowRoot.textContent.replace(/\s+/g, ' ').trim(),
      expected: new Intl.DateTimeFormat('en-us', {
        weekday: el.weekday, year: el.year, month: el.month, day: el.day, hour: el.hour, minute: el.minute,
      }).format(new Date(el.shadowRoot.querySelector('time').getAttribute('datetime'))).replace(/\s+/g, ' ').trim(),
    })),
  );
  expect(now).toHaveLength(6);
  for (const { text, expected } of now) expect(text).toBe(expected);
  expect(now[0].text).toMatch(/^[A-Z][a-z]+ \d{1,2}, \d{4}$/);
  expect(await text('#demo-lang sl-format-date')).toEqual(await frame.locator('#demo-lang sl-format-date').evaluateAll(els =>
    els.map(el => new Intl.DateTimeFormat(el.getAttribute('lang')).format(new Date(el.shadowRoot.querySelector('time').dateTime)).replace(/\s+/g, ' ').trim()),
  ));
  await expect(frame.getByText('Release date: 7/15/2020')).toBeVisible();
});

test('structure and accessibility: one time element with an ISO datetime, no parts, slots, role or light children', async ({ page }) => {
  const { frame } = await openExample(page);
  const info = await frame.locator('#demo-default').evaluate(el => ({
    elements: [...el.shadowRoot.querySelectorAll('*')].map(e => e.localName),
    parts: el.shadowRoot.querySelectorAll('[part]').length,
    slots: el.shadowRoot.querySelectorAll('slot').length,
    timeAttrs: el.shadowRoot.querySelector('time').getAttributeNames(),
    role: el.getAttribute('role'),
    ariaAttrs: el.getAttributeNames().filter(n => n.startsWith('aria-')),
    lightChildren: el.childNodes.length,
    display: getComputedStyle(el).display,
    boxSizing: getComputedStyle(el).boxSizing,
  }));
  expect(info).toEqual({ elements: ['time'], parts: 0, slots: 0, timeAttrs: ['datetime'], role: null, ariaAttrs: [], lightChildren: 0, display: 'inline', boxSizing: 'border-box' });
});

test('defaults: the date is the current time, no format options, auto hour format, and nothing is reflected', async ({ page }) => {
  const { frame } = await openExample(page);
  const out = await withElement(frame, {}, `
    const before = Date.now();
    const defaults = { weekday: el.weekday, era: el.era, year: el.year, month: el.month, day: el.day, hour: el.hour,
      minute: el.minute, second: el.second, timeZoneName: el.timeZoneName, timeZone: el.timeZone, hourFormat: el.hourFormat };
    const stamp = new Date(el.shadowRoot.querySelector('time').getAttribute('datetime')).getTime();
    const isDate = el.date instanceof Date;
    const initialLang = el.lang;
    el.setAttribute('lang', 'fr'); el.removeAttribute('lang'); await el.updateComplete;
    const removedLang = el.lang;
    el.weekday = 'long'; el.month = 'short'; el.day = '2-digit'; el.year = '2-digit'; el.hour = 'numeric'; el.minute = '2-digit';
    el.second = '2-digit'; el.timeZoneName = 'short'; el.timeZone = 'UTC'; el.hourFormat = '24'; el.era = 'short'; el.date = '2021-03-04T05:06:07Z';
    await el.updateComplete;
    return { defaults, initialLang, removedLang, isDate, recent: before - stamp < 60000 && stamp - Date.now() < 1000, attrs: el.getAttributeNames(), text: el.shadowRoot.textContent.replace(/\\s+/g, ' ').trim() };
  `);
  expect(out.defaults).toEqual({ hourFormat: 'auto' });
  expect(out.isDate).toBe(true);
  expect([out.initialLang, out.removedLang]).toEqual([undefined, null]); // as in Shoelace: starts undefined; removal leaves null
  expect(out.recent).toBe(true);
  expect(out.attrs).toEqual([]);
  expect(out.text).toContain('Thursday');
  expect(out.text).toContain('UTC');
  expect(out.text).toContain('05:06:07');
});

test('each format option, time zones and hour-format produce the Intl result for a fixed date', async ({ page }) => {
  const { frame } = await openExample(page);
  const out = await withElement(frame, FIXED, `
    const run = async (props) => {
      for (const k of ['weekday', 'era', 'year', 'month', 'day', 'hour', 'minute', 'second', 'timeZoneName', 'timeZone', 'hourFormat']) el[k] = undefined;
      el.timeZone = 'UTC'; el.hourFormat = 'auto';
      Object.assign(el, props);
      await el.updateComplete;
      return el.shadowRoot.textContent.replace(/\\s+/g, ' ').trim();
    };
    return {
      none: await run({}),
      human: await run({ month: 'long', day: 'numeric', year: 'numeric' }),
      time: await run({ hour: 'numeric', minute: 'numeric' }),
      weekday: await run({ weekday: 'long' }),
      weekdayShort: await run({ weekday: 'short' }),
      month: await run({ month: 'long' }),
      year: await run({ year: 'numeric' }),
      year2: await run({ year: '2-digit' }),
      era: await run({ era: 'short', year: 'numeric' }),
      second: await run({ hour: 'numeric', minute: '2-digit', second: '2-digit' }),
      zoneName: await run({ hour: 'numeric', timeZoneName: 'short' }),
      zoneLong: await run({ hour: 'numeric', timeZoneName: 'long' }),
      newYork: await run({ hour: 'numeric', minute: 'numeric', timeZone: 'America/New_York' }),
      tokyo: await run({ hour: 'numeric', minute: 'numeric', timeZone: 'Asia/Tokyo' }),
      h12: await run({ hour: 'numeric', minute: 'numeric', hourFormat: '12' }),
      h24: await run({ hour: 'numeric', minute: 'numeric', hourFormat: '24' }),
      auto: await run({ hour: 'numeric', minute: 'numeric', hourFormat: 'auto' }),
    };
  `);
  expect(out).toEqual({
    none: '7/15/2020',
    human: 'July 15, 2020',
    time: '1:17 PM',
    weekday: 'Wednesday',
    weekdayShort: 'Wed',
    month: 'July',
    year: '2020',
    year2: '20',
    era: '2020 AD',
    second: '1:17:05 PM',
    zoneName: '1 PM UTC',
    zoneLong: '1 PM Coordinated Universal Time',
    newYork: '9:17 AM',
    tokyo: '10:17 PM',
    h12: '1:17 PM',
    h24: '13:17',
    auto: '1:17 PM',
  });
});

test('date accepts strings and Date objects; the time element carries the ISO datetime; invalid dates render nothing', async ({ page }) => {
  const { frame } = await openExample(page);
  const out = await withElement(frame, FIXED, `
    const state = () => ({ time: el.shadowRoot.querySelector('time')?.getAttribute('datetime') ?? null, text: el.shadowRoot.textContent.trim() });
    const steps = { attribute: state() };
    el.date = new Date(Date.UTC(2021, 0, 2, 3, 4, 5)); await el.updateComplete; steps.object = state();
    el.date = '2022-12-31T23:59:59+02:00'; await el.updateComplete; steps.offset = state();
    el.setAttribute('date', '2023-05-06'); await el.updateComplete; steps.dateOnly = state();
    el.date = 'not a date'; await el.updateComplete; steps.invalid = [state(), el.shadowRoot.querySelectorAll('*').length];
    el.date = '2020-07-15T13:17:05Z'; await el.updateComplete; steps.recovered = state();
    return steps;
  `);
  expect(out.attribute).toEqual({ time: '2020-07-15T13:17:05.000Z', text: '7/15/2020' });
  expect(out.object).toEqual({ time: '2021-01-02T03:04:05.000Z', text: '1/2/2021' });
  expect(out.offset).toEqual({ time: '2022-12-31T21:59:59.000Z', text: '12/31/2022' });
  expect(out.dateOnly).toEqual({ time: '2023-05-06T00:00:00.000Z', text: '5/6/2023' });
  expect(out.invalid).toEqual([{ time: null, text: '' }, 0]);
  expect(out.recovered).toEqual({ time: '2020-07-15T13:17:05.000Z', text: '7/15/2020' });
});

test('attributes map to properties (kebab-case ones included) and are not reflected back', async ({ page }) => {
  const { frame } = await openExample(page);
  const out = await withElement(frame, { ...FIXED, weekday: 'long', 'time-zone-name': 'short', 'hour-format': '12', hour: 'numeric', era: 'short', month: 'short', day: 'numeric', year: 'numeric', minute: 'numeric', second: 'numeric' }, `
    return { props: { weekday: el.weekday, timeZoneName: el.timeZoneName, timeZone: el.timeZone, hourFormat: el.hourFormat, hour: el.hour, era: el.era, month: el.month, day: el.day, year: el.year, minute: el.minute, second: el.second, date: el.date },
      before: el.getAttributeNames().sort(),
      reflectedAfter: await (async () => { el.hourFormat = '24'; el.weekday = 'short'; await el.updateComplete; return [el.getAttribute('hour-format'), el.getAttribute('weekday')]; })() };
  `);
  expect(out.props).toEqual({ weekday: 'long', timeZoneName: 'short', timeZone: 'UTC', hourFormat: '12', hour: 'numeric', era: 'short', month: 'short', day: 'numeric', year: 'numeric', minute: 'numeric', second: 'numeric', date: '2020-07-15T13:17:05Z' });
  expect(out.reflectedAfter).toEqual(['12', 'long']);
});

test('removing attributes: divergences from Shoelace (hour-format restores auto, date restores now, format attributes are unset)', async ({ page }) => {
  const { frame } = await openExample(page);
  const out = await withElement(frame, { ...FIXED, hour: 'numeric', minute: 'numeric', 'hour-format': '24', month: 'long' }, `
    const text = async () => { await el.updateComplete; return el.shadowRoot.textContent.replace(/\\s+/g, ' ').trim(); };
    const steps = { initial: await text() };
    el.removeAttribute('month'); await el.updateComplete; steps.monthRemoved = [el.month, await text()];
    el.removeAttribute('hour-format'); await el.updateComplete; steps.hourFormatRemoved = [el.hourFormat, await text()];
    el.removeAttribute('hour'); el.removeAttribute('minute'); steps.timeRemoved = await text();
    el.removeAttribute('time-zone'); await el.updateComplete; steps.timeZoneRemoved = [el.timeZone, (await text()).length > 0];
    el.removeAttribute('date'); await el.updateComplete;
    const stamp = new Date(el.shadowRoot.querySelector('time').getAttribute('datetime')).getTime();
    steps.dateRemoved = [el.date instanceof Date, Math.abs(Date.now() - stamp) < 60000];
    return steps;
  `);
  expect(out.initial).toContain('July');
  expect(out.initial).toContain('13:17');
  expect(out.monthRemoved[0]).toBeNull();
  expect(out.hourFormatRemoved[0]).toBe('auto');
  expect(out.timeZoneRemoved).toEqual([null, true]);
  expect(out.dateRemoved).toEqual([true, true]);
  expect(out.monthRemoved[1]).toContain('13:17');
  expect(out.hourFormatRemoved[1]).toContain('1:17');
  expect(out.hourFormatRemoved[1]).toContain('PM');
  expect(out.timeRemoved).toBe('7/15/2020');
});

test('localization: lang attribute and property, document lang and dir changes re-render, host lang wins', async ({ page }) => {
  const { frame } = await openExample(page);
  const out = await withElement(frame, FIXED, `
    const text = async () => { await el.updateComplete; return el.shadowRoot.textContent.replace(/\\s+/g, ' ').trim(); };
    const root = document.documentElement;
    const steps = { en: await text() };
    root.lang = 'de'; await new Promise(r => setTimeout(r, 50));
    steps.documentDe = await text();
    el.setAttribute('lang', 'fr'); steps.hostFr = await text();
    el.lang = 'ru'; steps.hostProperty = [await text(), el.getAttribute('lang')];
    el.removeAttribute('lang'); await new Promise(r => setTimeout(r, 50));
    steps.removed = await text();
    root.lang = 'en';
    let updates = 0;
    const original = el.requestUpdate.bind(el);
    el.requestUpdate = (...args) => { updates++; return original(...args); };
    root.dir = 'rtl'; await new Promise(r => setTimeout(r, 50));
    steps.dirChange = [el.shadowRoot.textContent.trim(), updates > 0];
    root.removeAttribute('dir');
    return steps;
  `);
  expect(out.en).toBe('7/15/2020');
  expect(out.documentDe).toBe('15.7.2020');
  expect(out.hostFr).toBe('15/07/2020');
  expect(out.hostProperty).toEqual(['15.07.2020', 'fr']);
  expect(out.removed).toBe('15.7.2020');
  expect(out.dirChange).toEqual(['7/15/2020', true]);
});

test('events: only the inherited non-bubbling ready event is emitted, once, after the first update', async ({ page }) => {
  const { frame } = await openExample(page);
  const out = await frame.locator('body').evaluate(async body => {
    const el = document.createElement('sl-format-date');
    const seen = [];
    for (const name of ['ready', 'sl-change', 'sl-input', 'sl-load']) el.addEventListener(name, e => seen.push([name, e.bubbles, e.composed]));
    let bodySaw = 0;
    body.addEventListener('ready', () => bodySaw++);
    body.append(el);
    await el.updateComplete;
    el.year = 'numeric';
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
  expect(own).toEqual(['date', 'day', 'era', 'hour', 'hourFormat', 'lang', 'minute', 'month', 'render', 'second', 'timeZone', 'timeZoneName', 'weekday', 'willUpdate', 'year'].sort());
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  expect(await frame.locator('body').evaluate(() => Boolean(window.Shoelace || document.querySelector('script[src*="shoelace"]')))).toBe(false);
});
