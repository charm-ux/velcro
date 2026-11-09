import { readdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { bundleExamples, docsDir, loadBundle, loadExamples } from './support/bundle.mjs';
import { pressReceived, recordKeys } from './support/keys.mjs';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';
import { reactWrapperPage } from './support/react.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/rating';
// Shoelace 2.20.1's rating page has ten previews (the opening one, then Labels, Maximum Value, Precision, Symbol Sizes,
// Readonly, Disabled, Detecting Hover, Custom Icons and Value-based Icons), all ported in Shoelace's order, each live and
// with a React version.
const ORDER = [
  ['basic', 'Default'], ['labels', 'Labels'], ['max', 'Maximum Value'], ['precision', 'Precision'],
  ['symbol-sizes', 'Symbol Sizes'], ['readonly', 'Readonly'], ['disabled', 'Disabled'], ['detect-hover', 'Detecting Hover'],
  ['custom-icons', 'Custom Icons'], ['value-based-icons', 'Value-based Icons'],
];
const title = section => `Rating example: ${section}`;

async function openExample(page) {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  const frame = page.frameLocator(`iframe.example[title="${title('Default')}"]`);
  await expect(frame.locator('sl-rating')).toBeVisible();
  await documentsLoaded(page);
  return { frame, requests };
}

// Waits for every rating and icon in a frame, and returns per rating: [label, value, symbols ([classes, icon names])].
const frameState = frame => frame.locator('body').evaluate(async () => {
  await customElements.whenDefined('sl-rating');
  await Promise.all([...document.querySelectorAll('sl-rating')].map(el => el.updateComplete));
  return [...document.querySelectorAll('sl-rating')].map(el => [
    el.label,
    el.value,
    [...el.shadowRoot.querySelectorAll('.rating__symbols > span')].map(s => [
      s.className.trim().split(/\s+/).filter(c => c !== 'rating__symbol').join(' '),
      [...s.querySelectorAll('sl-icon')].map(i => `${i.getAttribute('library') ?? ''}:${i.getAttribute('name')}`).join(),
    ]),
  ]);
});

// The package entries, in a top-level document of the test's own.
const ENTRY = `
  import '@charm-ux/velcro/rating';
  window.loaded = true;
`;
const CLASS_ENTRY = `
  import { SlRating, VelcroRating } from '@charm-ux/velcro/rating/class';
  window.ratingClass = { SlRating, VelcroRating };
  window.loaded = true;
`;

// Replaces the document with a rating (id r) and waits for it; returns the sl-change and sl-hover events seen (a listener
// on the document, attached before the rating is connected).
async function mount(page, attrs = 'label="Rating"') {
  await page.evaluate(async attrs => {
    window.events = [];
    if (!window.listening) {
      window.listening = true;
      for (const type of ['sl-change', 'sl-hover']) {
        document.addEventListener(type, e => window.events.push(type === 'sl-hover' ? [type, e.detail.phase, e.detail.value] : [type, e.target.value]));
      }
    }
    document.body.innerHTML = `<sl-rating id="r" ${attrs}></sl-rating>`;
    const el = document.querySelector('#r');
    await el.updateComplete;
    await Promise.all([...el.shadowRoot.querySelectorAll('sl-icon')].map(i => i.updateComplete));
  }, attrs);
}
const events = page => page.evaluate(() => window.events.splice(0));
const state = page => page.evaluate(() => {
  const el = document.querySelector('#r');
  const base = el.shadowRoot.querySelector('[part="base"]');
  return {
    value: el.value,
    valuenow: base.getAttribute('aria-valuenow'),
    active: el.shadowRoot.querySelectorAll('.rating__symbol--active').length,
    hover: [...el.shadowRoot.querySelectorAll('.rating__symbols > span')].findIndex(s => s.classList.contains('rating__symbol--hover')) + 1,
  };
});
const value = page => state(page).then(s => s.value);
// The viewport point at `fraction` of the rating's width, vertically centered.
const point = (page, fraction) => page.evaluate(fraction => {
  const box = document.querySelector('#r').shadowRoot.querySelector('[part="base"]').getBoundingClientRect();
  return [box.left + box.width * fraction, box.top + box.height / 2];
}, fraction);

test('docs page is prerendered with Velcro branding, prototype status, every ported section in order, the quirks and the gaps', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Rating - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('without changing the shared core prefix');
  expect(html).toContain('was run locally in Chromium and WebKit only, and Firefox is covered only by the project&#39;s CI run');
  expect(html).toContain('Playwright&#39;s ARIA snapshot');
  expect(html).toContain('has no translation term for the rating');
  expect(html).toContain('Connecting a rating emits sl-hover twice without any pointer');
  expect(html).toContain('A click on a readonly rating leaves the value unchanged but still emits sl-change');
  expect(html).toContain('The end of a touch emits sl-change even when the rating is disabled or readonly');
  expect(html).toContain('throws a ReferenceError and the feedback never shows');
  const positions = ORDER.map(([, section]) => html.indexOf(`title="${title(section)}"`));
  expect(positions.every(p => p > 0)).toBe(true);
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  // The API tables: Shoelace's attributes, methods, events, part and custom properties; ready is labelled as inherited.
  for (const name of ['label', 'value', 'max', 'precision', 'readonly', 'disabled', 'getSymbol', 'focus', 'blur', 'sl-change', 'sl-hover', 'base', '--symbol-color', '--symbol-color-active', '--symbol-size', '--symbol-spacing']) {
    expect(html).toContain(`data-name="${name}"`);
  }
  expect(html).toContain('Inherited from core');
  expect(html).toContain('<summary>React</summary>');
  expect(html).toContain('import { VelcroRating as SlRating } from &#39;@charm-ux/velcro/react/VelcroRating.js&#39;;');
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(await (await request.get('/')).text()).toContain('/components/rating');
});

test('examples: Shoelace\'s order, live in their own documents, with a React version each; no Shoelace runtime is requested', async ({ page }) => {
  const { requests } = await openExample(page);
  const titles = await page.locator('iframe.example').evaluateAll(frames => frames.map(f => f.title));
  expect(titles).toEqual(ORDER.map(([, section]) => title(section)));
  const out = {};
  for (const [id, section] of ORDER) out[id] = await frameState(page.frameLocator(`iframe.example[title="${title(section)}"]`));
  const stars = (count, active, partial = -1) => Array.from({ length: count }, (_, i) => i === partial
    ? ['rating__partial-symbol-container', 'system:star-fill,system:star-fill']
    : [i < active ? 'rating__symbol--active' : '', 'system:star-fill']);
  expect(out.basic).toEqual([['Rating', 0, stars(5, 0)]]);
  expect(out.labels).toEqual([['Rate this component', 0, stars(5, 0)]]);
  expect(out.max).toEqual([['Rating', 0, stars(3, 0)]]);
  expect(out.precision).toEqual([['Rating', 2.5, stars(5, 2, 2)]]);
  expect(out['symbol-sizes']).toEqual([['Rating', 0, stars(5, 0)]]);
  expect(out.readonly).toEqual([['Rating', 3, stars(5, 3)]]);
  expect(out.disabled).toEqual([['Rating', 3, stars(5, 3)]]);
  expect(out['detect-hover']).toEqual([['Rating', 0, stars(5, 0)]]);
  expect(out['custom-icons']).toEqual([['Rating', 0, Array(5).fill(['', 'default:heart-fill'])]]);
  expect(out['value-based-icons']).toEqual([['Rating', 0, ['emoji-angry', 'emoji-frown', 'emoji-expressionless', 'emoji-smile', 'emoji-laughing'].map(n => ['', `default:${n}`])]]);
  const files = dir => readdirSync(path.join(docsDir, 'examples/rating', dir)).filter(f => /\.(html|jsx)$/.test(f)).sort();
  expect(files('')).toEqual(ORDER.map(([id]) => `${id}.html`).sort());
  expect(files('react')).toEqual(ORDER.map(([id]) => `${id}.jsx`).sort());
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
});

test('Symbol Sizes, Readonly, Disabled and Custom Icons examples: the symbol size, tab order, opacity and active color', async ({ page }) => {
  await openExample(page);
  const read = (section, fn) => page.frameLocator(`iframe.example[title="${title(section)}"]`).locator('sl-rating').evaluate(fn);
  expect(await read('Symbol Sizes', el => getComputedStyle(el.shadowRoot.querySelector('.rating__symbols')).fontSize)).toBe('32px');
  // 1.2rem (WebKit and Firefox report fractional pixels with rounding noise: Firefox snaps font sizes to 1/60 px).
  const [size, rem] = await read('Default', el => [getComputedStyle(el.shadowRoot.querySelector('.rating__symbols')).fontSize, getComputedStyle(document.documentElement).fontSize].map(parseFloat));
  expect(size).toBeCloseTo(1.2 * rem, 1);
  // Every symbol's icon resolves to an SVG (the default library's heart and emoji icons, the system star).
  for (const section of ['Default', 'Custom Icons', 'Value-based Icons']) {
    await expect.poll(() => read(section, el => [...el.shadowRoot.querySelectorAll('sl-icon')].map(i => Boolean(i.shadowRoot?.querySelector('svg'))))).toEqual(Array(5).fill(true));
  }
  const base = el => {
    const b = el.shadowRoot.querySelector('[part="base"]');
    return [b.getAttribute('tabindex'), b.getAttribute('aria-readonly'), b.getAttribute('aria-disabled'), getComputedStyle(b).opacity, getComputedStyle(el.shadowRoot.querySelector('.rating__symbols')).cursor];
  };
  expect(await read('Default', base)).toEqual(['0', 'false', 'false', '1', 'pointer']);
  expect(await read('Readonly', base)).toEqual(['-1', 'true', 'false', '1', 'default']);
  expect(await read('Disabled', base)).toEqual(['-1', 'false', 'true', '0.5', 'not-allowed']);
  expect(await read('Custom Icons', el => {
    el.value = 2;
    return el.updateComplete.then(() => [...el.shadowRoot.querySelectorAll('.rating__symbols > span')].map(s => getComputedStyle(s).color));
  })).toEqual(['rgb(255, 65, 54)', 'rgb(255, 65, 54)', ...Array(3).fill(await read('Default', () => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--sl-color-neutral-300)';
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }))]);
});

test('Detecting Hover example: "No rating" shows before any hover (upstream quirk: two sl-hover events on connect); hovering shows the term, leaving clears it', async ({ page }) => {
  await openExample(page);
  const frame = page.frameLocator(`iframe.example[title="${title('Detecting Hover')}"]`);
  const feedback = frame.locator('.detect-hover > span');
  await frameState(frame);
  await expect(feedback).toHaveText('No rating');
  await frame.locator('sl-rating').scrollIntoViewIfNeeded();
  const box = await frame.locator('sl-rating').boundingBox();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2);
  await expect(feedback).toHaveText('Good');
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height / 2);
  await expect(feedback).toHaveText('Terrible');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height + 40);
  await expect(feedback).toHaveText('');
  await expect(feedback).toBeHidden();
});

test('package entry: Shoelace\'s structure, accessibility attributes, default symbols and styles', async ({ page }) => {
  const pageErrors = await loadBundle(page, ENTRY);
  await mount(page);
  const r = await page.evaluate(() => {
    const el = document.querySelector('#r');
    const base = el.shadowRoot.querySelector('[part="base"]');
    const symbols = el.shadowRoot.querySelector('.rating__symbols');
    const token = name => {
      const probe = document.createElement('span');
      probe.style.color = `var(${name})`;
      document.body.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    };
    return {
      shadow: [...el.shadowRoot.children].map(c => [c.localName, c.getAttribute('part'), c.getAttribute('class')]),
      base: ['role', 'aria-label', 'aria-disabled', 'aria-readonly', 'aria-valuenow', 'aria-valuemin', 'aria-valuemax', 'tabindex'].map(a => base.getAttribute(a)),
      symbols: [...symbols.children].map(s => [s.localName, s.getAttribute('class'), s.getAttribute('role'), s.firstElementChild.outerHTML]),
      properties: [el.label, el.value, el.max, el.precision, el.readonly, el.disabled, typeof el.getSymbol, el.getSymbol(1), el.rating === base],
      reflected: [...el.attributes].map(a => a.name).sort(),
      layout: [getComputedStyle(el).display, getComputedStyle(base).display, getComputedStyle(base).position, getComputedStyle(base).verticalAlign, getComputedStyle(symbols).whiteSpace, getComputedStyle(symbols).lineHeight],
      colors: [getComputedStyle(symbols).color === token('--sl-color-neutral-300'), getComputedStyle(base).borderRadius],
      custom: ['--symbol-color', '--symbol-color-active', '--symbol-size', '--symbol-spacing'].map(p => getComputedStyle(el).getPropertyValue(p).trim()),
      padding: getComputedStyle(symbols.firstElementChild).padding,
      pointerEvents: getComputedStyle(symbols.firstElementChild).pointerEvents,
      transition: getComputedStyle(symbols.firstElementChild).transitionProperty,
    };
  });
  expect(r).toEqual({
    shadow: [['div', 'base', ' rating ']],
    base: ['slider', 'Rating', 'false', 'false', '0', '0', '5', '0'],
    symbols: Array(5).fill(['span', ' rating__symbol ', 'presentation', '<sl-icon name="star-fill" library="system" aria-hidden="true"></sl-icon>']),
    properties: ['Rating', 0, 5, 1, false, false, 'function', '<sl-icon name="star-fill" library="system"></sl-icon>', true],
    reflected: ['id', 'label'],
    // The base is a flex item of the inline-flex host, so its inline-flex computes to flex.
    layout: ['inline-flex', 'flex', 'relative', 'middle', 'nowrap', '0px'],
    // The light theme's --sl-border-radius-medium (0.25rem), --sl-color-neutral-300, --sl-color-amber-500 and
    // --sl-spacing-3x-small (0.125rem).
    colors: [true, '4px'],
    custom: ['hsl(240 4.9% 83.9%)', 'hsl(37.7 92.1% 50.2%)', '1.2rem', '0.125rem'],
    padding: '2px',
    pointerEvents: 'none',
    transition: 'scale',
  });
  expect(pageErrors).toEqual([]);
});

test('the active symbols use --symbol-color-active, and a partial value draws two clipped layers (mirrored in right-to-left)', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'label="Rating" precision="0.5" value="2.5"');
  const read = () => page.evaluate(() => {
    const el = document.querySelector('#r');
    const probe = document.createElement('span');
    probe.style.color = 'var(--sl-color-amber-500)';
    document.body.append(probe);
    const amber = getComputedStyle(probe).color;
    probe.remove();
    const partial = el.shadowRoot.querySelector('.rating__partial-symbol-container');
    const [back, front] = partial.children;
    return {
      classes: [...el.shadowRoot.querySelectorAll('.rating__symbols > span')].map(s => s.getAttribute('class').trim()),
      active: getComputedStyle(el.shadowRoot.querySelector('.rating__symbol--active')).color === amber,
      layers: [back.style.clipPath, front.getAttribute('class'), front.style.clipPath, getComputedStyle(front).position, getComputedStyle(front).color === amber],
      rtl: el.shadowRoot.querySelector('[part="base"]').classList.contains('rating--rtl'),
    };
  });
  expect(await read()).toEqual({
    classes: ['rating__symbol rating__symbol--active', 'rating__symbol rating__symbol--active', 'rating__symbol rating__partial-symbol-container', 'rating__symbol', 'rating__symbol'],
    active: true,
    layers: ['inset(0px 0px 0px 50%)', 'rating__partial--filled', 'inset(0px 50% 0px 0px)', 'absolute', true],
    rtl: false,
  });
  await page.evaluate(() => {
    document.querySelector('#r').dir = 'rtl';
    return document.querySelector('#r').updateComplete;
  });
  const rtl = await read();
  expect([rtl.layers[0], rtl.layers[2], rtl.rtl]).toEqual(['inset(0px 50% 0px 0px)', 'inset(0px 0px 0px 50%)', true]);
});

test('upstream quirk: connecting a rating emits sl-hover twice (end, then move, both with value 0) without any pointer', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page);
  expect(await events(page)).toEqual([['sl-hover', 'end', 0], ['sl-hover', 'move', 0]]);
  const r = await page.evaluate(async () => {
    const el = document.createElement('sl-rating');
    const seen = [];
    el.addEventListener('sl-hover', e => seen.push([e.detail.phase, e.bubbles, e.composed]));
    el.addEventListener('ready', e => seen.push(['ready', e.bubbles, e.composed]));
    document.body.append(el);
    await el.updateComplete;
    el.label = 'Other';
    await el.updateComplete;
    return seen;
  });
  expect(r).toEqual([['end', true, true], ['move', true, true], ['ready', false, false]]);
});

test('clicking sets the value at the pointer and emits sl-change; clicking the current value clears it; setting value from script emits nothing', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page);
  await events(page);
  await page.mouse.click(...await point(page, 0.5));
  expect(await state(page)).toEqual({ value: 3, valuenow: '3', active: 3, hover: 0 });
  // As in Shoelace, the click sets isHovering to false and emits sl-change at once; the hover end follows in the next update.
  expect((await events(page)).filter(e => e[1] !== 'move')).toEqual([['sl-hover', 'start', 3], ['sl-change', 3], ['sl-hover', 'end', 3]]);
  await page.mouse.click(...await point(page, 0.5));
  expect((await state(page)).value).toBe(0);
  expect((await events(page)).filter(e => e[0] === 'sl-change')).toEqual([['sl-change', 0]]);
  await page.evaluate(() => {
    document.querySelector('#r').value = 4;
    return document.querySelector('#r').updateComplete;
  });
  expect(await events(page)).toEqual([]);
  expect((await state(page)).valuenow).toBe('4');
});

test('precision 0.5: the pointer rounds up to the next half, clamped to 0..max', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'label="Rating" precision="0.5"');
  await page.mouse.click(...await point(page, 0.45));
  expect((await state(page)).value).toBe(2.5);
  await page.mouse.click(...await point(page, 0.99));
  expect((await state(page)).value).toBe(5);
  await page.mouse.click(...await point(page, 0.01));
  expect((await state(page)).value).toBe(0.5);
});

test('hovering emits sl-hover start, move and end and marks the hovered symbol; a disabled or readonly rating still emits them (upstream quirk) but keeps its value', async ({ page }) => {
  await loadBundle(page, ENTRY);
  for (const attrs of ['', 'disabled value="1"', 'readonly value="1"']) {
    await mount(page, `label="Rating" ${attrs}`);
    await events(page);
    await page.mouse.move(...await point(page, 0.1));
    await expect.poll(() => events(page)).toEqual([['sl-hover', 'start', 1], ['sl-hover', 'move', 1]]);
    await page.mouse.move(...await point(page, 0.7));
    await expect.poll(() => events(page)).toEqual([['sl-hover', 'move', 4]]);
    const interactive = attrs === '';
    expect(await state(page)).toEqual({ value: interactive ? 0 : 1, valuenow: interactive ? '0' : '1', active: interactive ? 4 : 1, hover: interactive ? 4 : 1 });
    if (!interactive) {
      // The hover class is set but neutralized: no scale.
      expect(await page.evaluate(() => getComputedStyle(document.querySelector('#r').shadowRoot.querySelector('.rating__symbol--hover')).scale)).toBe('none');
    }
    const [x, y] = await point(page, 0.5);
    await page.mouse.move(x, y + 200);
    await expect.poll(() => events(page)).toEqual([['sl-hover', 'end', 4]]);
    expect((await state(page)).hover).toBe(0);
  }
});

test('a click on a readonly rating keeps the value but emits sl-change (upstream quirk); a disabled rating emits nothing', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'label="Rating" readonly value="2"');
  await events(page);
  await page.mouse.click(...await point(page, 0.9));
  expect((await state(page)).value).toBe(2);
  expect((await events(page)).filter(e => e[0] === 'sl-change')).toEqual([['sl-change', 2]]);
  await mount(page, 'label="Rating" disabled value="2"');
  await events(page);
  await page.mouse.click(...await point(page, 0.9));
  expect((await state(page)).value).toBe(2);
  expect((await events(page)).filter(e => e[0] === 'sl-change')).toEqual([]);
});

test('keyboard: arrows step by precision (by 1 with Shift), Home and End go to 0 and max, each change emits sl-change; disabled and readonly ignore keys', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'label="Rating" precision="0.5"');
  await page.evaluate(() => document.querySelector('#r').focus());
  await events(page);
  // Each step waits for the value its key produces before the next key: a key that changes the value is followed by a
  // poll for the new value; a key that changes nothing (ArrowRight at max, ArrowLeft at 0, Enter) waits until the whole
  // press was received and then reads the value.
  await recordKeys(page);
  const values = [];
  for (const [key, expected, changes] of [
    ['ArrowRight', 0.5, true], ['ArrowUp', 1, true], ['Shift+ArrowRight', 2, true], ['ArrowLeft', 1.5, true], ['ArrowDown', 1, true],
    ['Shift+ArrowLeft', 0, true], ['End', 5, true], ['ArrowRight', 5, false], ['Home', 0, true], ['ArrowLeft', 0, false], ['Enter', 0, false],
  ]) {
    if (changes) {
      await page.keyboard.press(key);
      await expect.poll(() => value(page), key).toBe(expected);
    } else {
      await pressReceived(page, page, key);
      expect(await value(page), key).toBe(expected);
    }
    values.push(await value(page));
  }
  expect(values).toEqual([0.5, 1, 2, 1.5, 1, 0, 5, 5, 0, 0, 0]);
  expect((await events(page)).map(e => e[1])).toEqual([0.5, 1, 2, 1.5, 1, 0, 5, 0]);
  for (const attrs of ['disabled value="2"', 'readonly value="2"']) {
    await mount(page, `label="Rating" ${attrs}`);
    await events(page);
    await page.evaluate(() => document.querySelector('#r').shadowRoot.querySelector('[part="base"]').focus());
    for (const key of ['ArrowRight', 'Home', 'End']) {
      await pressReceived(page, page, key);
      expect(await value(page)).toBe(2);
    }
    expect(await events(page)).toEqual([]);
  }
});

test('right-to-left: the arrows swap and the pointer reads from the right; with dir="auto" the left and right arrows do nothing (upstream quirk)', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'label="Rating" dir="rtl" value="2"');
  await page.evaluate(() => document.querySelector('#r').focus());
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => value(page)).toBe(3);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => value(page)).toBe(2);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => value(page)).toBe(1);
  await page.mouse.click(...await point(page, 0.1));
  expect((await state(page)).value).toBe(5);
  // The document's direction, when the rating has none of its own; re-rendered when the document's direction changes.
  await mount(page, 'label="Rating" value="2"');
  await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
  await expect.poll(() => page.evaluate(() => document.querySelector('#r').shadowRoot.querySelector('[part="base"]').classList.contains('rating--rtl'))).toBe(true);
  await page.evaluate(() => document.querySelector('#r').focus());
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => value(page)).toBe(3);
  await page.evaluate(() => { document.documentElement.dir = 'ltr'; });
  await mount(page, 'label="Rating" dir="auto" value="2"');
  await page.evaluate(() => document.querySelector('#r').focus());
  await recordKeys(page);
  for (const key of ['ArrowLeft', 'ArrowRight']) {
    await pressReceived(page, page, key);
    expect(await value(page)).toBe(2);
  }
  await page.keyboard.press('ArrowUp');
  await expect.poll(() => value(page)).toBe(3);
});

test('touch: a drag sets the hover value and the end commits it and emits sl-change; the end of a touch emits sl-change on a disabled or readonly rating too (upstream quirk)', async ({ page }) => {
  await loadBundle(page, ENTRY);
  // Synthetic touch events (no touch device): the handlers read only touches[0].clientX and call preventDefault().
  const touch = (type, fraction) => page.evaluate(([type, fraction]) => {
    const base = document.querySelector('#r').shadowRoot.querySelector('[part="base"]');
    const box = base.getBoundingClientRect();
    const event = new Event(type, { bubbles: true, cancelable: true, composed: true });
    Object.defineProperty(event, 'touches', { value: fraction === null ? [] : [{ clientX: box.left + box.width * fraction }] });
    base.dispatchEvent(event);
    return [event.defaultPrevented, document.querySelector('#r').value];
  }, [type, fraction]);
  await mount(page);
  await events(page);
  expect(await touch('touchstart', 0.3)).toEqual([true, 0]);
  expect(await touch('touchmove', 0.5)).toEqual([false, 0]);
  expect(await touch('touchend', null)).toEqual([true, 3]);
  await expect.poll(() => events(page)).toEqual([['sl-hover', 'start', 2], ['sl-hover', 'move', 2], ['sl-hover', 'move', 3], ['sl-change', 3], ['sl-hover', 'end', 3]]);
  for (const attrs of ['disabled value="1"', 'readonly value="1"']) {
    await mount(page, `label="Rating" ${attrs}`);
    await events(page);
    await touch('touchstart', 0.9);
    expect(await touch('touchend', null)).toEqual([true, 1]);
    await expect.poll(() => events(page).then(e => e.filter(x => x[0] === 'sl-change'))).toEqual([['sl-change', 1]]);
  }
});

test('focus() and blur() move the focus to and from the base element', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page);
  const r = await page.evaluate(() => {
    const el = document.querySelector('#r');
    const base = el.shadowRoot.querySelector('[part="base"]');
    el.focus();
    const focused = [document.activeElement === el, el.shadowRoot.activeElement === base];
    el.blur();
    return [...focused, el.shadowRoot.activeElement];
  });
  expect(r).toEqual([true, true, null]);
});

test('upstream quirk: the arrow keys bound each step on one side only, so an out-of-range value moves one step and stays out of range', async ({ page }) => {
  await loadBundle(page, ENTRY);
  for (const [value, key, expected] of [[10, 'ArrowDown', 9], [-2, 'ArrowUp', -1], [10, 'ArrowUp', 5], [-2, 'ArrowDown', 0]]) {
    await mount(page);
    await page.evaluate(value => {
      const el = document.querySelector('#r');
      el.value = value;
      el.focus();
      return el.updateComplete;
    }, value);
    await events(page);
    await page.keyboard.press(key);
    await expect.poll(() => state(page).then(s => [s.value, s.valuenow])).toEqual([expected, String(expected)]);
    expect(await events(page)).toEqual([['sl-change', expected]]);
  }
});

test('readonly and disabled set to null or undefined get their initial value back (Shoelace\'s base element restore), once any attribute has been set', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'label="Rating" readonly');
  const r = await page.evaluate(async () => {
    const el = document.querySelector('#r');
    el.disabled = true;
    await el.updateComplete;
    el.readonly = null;
    el.disabled = undefined;
    await el.updateComplete;
    const restored = [el.readonly, el.disabled, el.hasAttribute('readonly'), el.hasAttribute('disabled')];
    // As in Shoelace, the initial values are recorded on the first attribute change: a rating that never had an
    // attribute keeps the null.
    const bare = document.createElement('sl-rating');
    document.body.append(bare);
    await bare.updateComplete;
    bare.disabled = null;
    await bare.updateComplete;
    return { restored, bare: bare.disabled };
  });
  expect(r).toEqual({ restored: [false, false, false, false], bare: null });
});

test('attributes: readonly and disabled reflect; value, max and precision do not and become null when removed; a getsymbol attribute breaks rendering (upstream quirks)', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'label="Rating" value="3" max="4" precision="0.5"');
  const r = await page.evaluate(async () => {
    const el = document.querySelector('#r');
    el.readonly = true;
    el.disabled = true;
    el.value = 1;
    el.max = 7;
    el.label = 'Changed';
    await el.updateComplete;
    const reflected = ['readonly', 'disabled', 'value', 'max', 'label'].map(a => el.getAttribute(a));
    el.removeAttribute('readonly');
    el.removeAttribute('value');
    el.removeAttribute('max');
    el.removeAttribute('precision');
    const removed = [el.readonly, el.value, el.max, el.precision];
    await el.updateComplete;
    const symbols = el.shadowRoot.querySelectorAll('.rating__symbols > span').length;
    let error = null;
    el.setAttribute('getsymbol', 'star');
    try {
      await el.updateComplete;
    } catch (e) {
      error = e.message;
    }
    return { reflected, removed, symbols, type: typeof el.getSymbol, error };
  });
  expect(r.reflected).toEqual(['', '', '3', '4', 'Rating']);
  expect(r.removed).toEqual([false, null, null, null]);
  // Array(null) has one element, as in Shoelace.
  expect(r.symbols).toBe(1);
  expect(r.type).toBe('string');
  expect(r.error).toContain('getSymbol is not a function');
});

test('accessibility tree (Playwright ARIA snapshot): a slider with its label; the value is in aria-valuenow; without a label it has no name (upstream quirk)', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'label="Rate this component" value="3"');
  await expect(page.locator('#r')).toMatchAriaSnapshot(`
    - slider "Rate this component"
  `);
  expect(await page.evaluate(() => document.querySelector('#r').shadowRoot.querySelector('[part="base"]').getAttribute('aria-valuenow'))).toBe('3');
  await mount(page, 'value="2"');
  expect(await page.evaluate(() => document.querySelector('#r').shadowRoot.querySelector('[part="base"]').getAttribute('aria-label'))).toBe('');
});

test('dir and lang are reactive, not reflected and undefined by default, as Shoelace\'s base element declares them', async ({ page }) => {
  await loadBundle(page, ENTRY);
  const r = await page.evaluate(async () => {
    const el = document.createElement('sl-rating');
    const defaults = [el.dir, el.lang];
    document.body.append(el);
    await el.updateComplete;
    el.dir = 'RTL';
    el.lang = 'ar';
    await el.updateComplete;
    return { defaults, afterSet: [el.dir, el.lang, el.hasAttribute('dir'), el.hasAttribute('lang')], rtl: el.shadowRoot.querySelector('[part="base"]').classList.contains('rating--rtl') };
  });
  // Shoelace lower-cases the direction it reads, so "RTL" is right-to-left.
  expect(r).toEqual({ defaults: [undefined, undefined], afterSet: ['RTL', 'ar', false, false], rtl: true });
});

test('class entry: SlRating is VelcroRating, nothing is registered on import, and constructing a rating defines sl-icon', async ({ page }) => {
  const pageErrors = await loadBundle(page, CLASS_ENTRY);
  const r = await page.evaluate(() => {
    const { SlRating, VelcroRating } = window.ratingClass;
    const before = [customElements.get('sl-rating'), customElements.get('sl-icon')].map(Boolean);
    customElements.define('my-rating', VelcroRating);
    document.body.innerHTML = '<my-rating></my-rating>';
    return { same: SlRating === VelcroRating, before, icon: Boolean(customElements.get('sl-icon')), rating: Boolean(customElements.get('sl-rating')) };
  });
  expect(r).toEqual({ same: true, before: [false, false], icon: true, rating: false });
  expect(pageErrors).toEqual([]);
});

// Shoelace's React examples, ported in packages/docs/examples/rating/react/*.jsx, bundled with React 19 and the generated wrapper.
test('React examples render the same ratings as the HTML examples; Shoelace\'s Detecting Hover handler throws on each sl-hover event', async ({ page }) => {
  const code = await bundleExamples('rating', ORDER.map(([id]) => id));
  const pageErrors = await loadExamples(page, code);
  const r = await page.evaluate(async () => {
    const out = {};
    for (const name of ['basic', 'labels', 'max', 'precision', 'symbol-sizes', 'readonly', 'disabled', 'detect-hover', 'custom-icons', 'value-based-icons']) {
      window.renderExample(name);
      await customElements.whenDefined('sl-rating');
      const el = document.querySelector(`#${name} sl-rating`);
      await el.updateComplete;
      out[name] = [el.label, el.value, el.max, el.precision, el.readonly, el.disabled, el.style.cssText,
        [...el.shadowRoot.querySelectorAll('sl-icon')].map(i => i.getAttribute('name')).filter((n, i, a) => a.indexOf(n) === i).join()];
    }
    return { out, errors: window.errors.splice(0), feedback: document.querySelector('#detect-hover span').textContent };
  });
  expect(r.out).toEqual({
    basic: ['Rating', 0, 5, 1, false, false, '', 'star-fill'],
    labels: ['Rate this component', 0, 5, 1, false, false, '', 'star-fill'],
    max: ['Rating', 0, 3, 1, false, false, '', 'star-fill'],
    precision: ['Rating', 2.5, 5, 0.5, false, false, '', 'star-fill'],
    'symbol-sizes': ['Rating', 0, 5, 1, false, false, '--symbol-size: 2rem;', 'star-fill'],
    readonly: ['Rating', 3, 5, 1, true, false, '', 'star-fill'],
    disabled: ['Rating', 3, 5, 1, false, true, '', 'star-fill'],
    'detect-hover': ['Rating', 0, 5, 1, false, false, '', 'star-fill'],
    'custom-icons': ['Rating', 0, 5, 1, false, false, '--symbol-color-active: #ff4136;', 'heart-fill'],
    'value-based-icons': ['Rating', 0, 5, 1, false, false, '', 'emoji-angry,emoji-frown,emoji-expressionless,emoji-smile,emoji-laughing'],
  });
  // As in Shoelace's React version, handleHover refers to `rating`, which is not defined: each sl-hover event throws, the two
  // on connect included, and the feedback (initially `true`, which React renders as nothing) never changes.
  // The page's error events count them (WebKit reports their message there only as "Script error."); Playwright's page
  // errors carry the message: Chromium and Firefox say "rating is not defined", WebKit "Can't find variable: rating".
  expect(r.errors.length).toBe(2);
  expect(r.feedback).toBe('');
  // Playwright delivers page errors asynchronously (Firefox later than the page's own error events).
  await expect.poll(() => pageErrors.length).toBe(2);
  expect(pageErrors.every(e => /rating is not defined|Can't find variable: rating/.test(e)), JSON.stringify(pageErrors)).toBe(true);
});

test.describe('React wrapper', () => {
  const mountWrapper = reactWrapperPage(test);
  test('VelcroRating passes Shoelace\'s props through and calls onSlChange and onSlHover', async ({ page }) => {
    const errors = await mountWrapper(page);
    const r = await page.evaluate(async () => {
      window.seen = [];
      window.renderWrapper('VelcroRating', { label: 'Score', value: 2, max: 4, precision: 0.5, onSlChange: e => window.seen.push(['change', e.target.value]), onSlHover: e => window.seen.push(['hover', e.detail.phase]) });
      await customElements.whenDefined('sl-rating');
      const el = document.querySelector('#wrapped');
      await el.updateComplete;
      el.focus();
      el.shadowRoot.querySelector('[part="base"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await el.updateComplete;
      return [el.label, el.value, el.max, el.precision, window.seen];
    });
    expect(r).toEqual(['Score', 2.5, 4, 0.5, [['hover', 'end'], ['hover', 'move'], ['change', 2.5]]]);
    expect(errors).toEqual([]);
  });
});
