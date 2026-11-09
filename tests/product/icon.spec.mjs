import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { collectRequestFailures } from './request-failures.mjs';
import { buildFixtures, openFixturePage, ORIGIN } from './support/fixtures.mjs';
import { guardCdn, stubCdn } from './support/cdn.mjs';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';

const PAGE = '/components/icon';
const source = fileURLToPath(new URL('../../packages/velcro/assets/bootstrap-icons/', import.meta.url));
const dist = fileURLToPath(new URL('../../packages/velcro/dist/assets/icons/', import.meta.url));

async function openPage(page) {
  watchNetwork(page);
  const cdn = guardCdn(page);
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  const failures = collectRequestFailures(page);
  await openDocs(page, PAGE);
  // Rendering only: a test that reads the requests waits for the network to go quiet itself (documentsLoaded).
  return { cdn, requests, failures };
}

const frameOf = (page, title) => page.frameLocator(`iframe[title="${title}"]`);
const drawn = icon => icon.evaluate(el => {
  const svg = el.shadowRoot.querySelector('svg');
  return svg ? { part: svg.getAttribute('part'), width: svg.getBoundingClientRect().width } : null;
});

test('docs page is prerendered with every Shoelace example section, the icon search and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Icon - Velcro</title>');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('Upstream quirks matched');
  // The remaining dir type gap is disclosed: runtime and setter match Shoelace, the read and generated types do not.
  expect(html).toContain('TypeScript types for dir are narrower than Shoelace');
  expect(html).toContain('the React wrapper');
  expect(html).toContain('the JSX dir and prop:dir types');
  expect(html).toContain('needs a change in @charm-ux/core and is deferred');
  for (const id of ['default-icons', 'colors', 'sizing', 'labels', 'custom-icons', 'icon-libraries', 'boxicons', 'lucide',
    'font-awesome', 'heroicons', 'iconoir', 'ionicons', 'jam', 'material', 'remix', 'tabler', 'unicons',
    'customizing-the-default-library', 'sprite', 'customizing-the-system-library']) {
    expect(html).toContain(`id="${id}"`);
  }
  expect(html).toContain('Bootstrap Icons 1.11.3');
  expect(html).toContain('skipped by Shoelace itself');
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  const home = await (await request.get('/')).text();
  expect(home).toContain('/components/icon');
});

test('the site serves the package icon assets byte for byte, with an SVG content type', async ({ request }) => {
  const names = JSON.parse(readFileSync(`${source}icons.json`, 'utf8')).map(i => i.name);
  expect(names.length).toBe(2050);
  // The package build generates dist/assets/icons from the pinned sprite and checks every file against SHA256SUMS.
  const sums = readFileSync(`${source}SHA256SUMS`, 'utf8').trimEnd().split('\n').map(l => l.slice(66));
  expect(sums.sort()).toEqual(names.map(n => `${n}.svg`).sort());
  expect(readdirSync(dist).sort()).toEqual([...sums, 'LICENSE', 'icons.json'].sort());
  for (const name of ['gear', 'star-fill', 'x-circle-fill', names.at(-1)]) {
    const res = await request.get(`/assets/icons/${name}.svg`);
    expect(res.ok()).toBe(true);
    expect(res.headers()['content-type']).toBe('image/svg+xml');
    expect(await res.text()).toBe(readFileSync(`${dist}${name}.svg`, 'utf8'));
  }
  expect((await request.get('/assets/images/sprite.svg')).headers()['content-type']).toBe('image/svg+xml');
  expect(await (await request.get('/assets/icons/LICENSE')).text()).toContain('The Bootstrap Authors');
});

test('default library: icons load from the site, inherit color, size with font-size and are presentational', async ({ page }) => {
  const { requests, failures } = await openPage(page);
  await documentsLoaded(page);
  const colors = frameOf(page, 'Icon example: Colors');
  const icon = colors.locator('sl-icon[name="exclamation-triangle"]');
  await expect.poll(() => drawn(icon)).toMatchObject({ part: 'svg' });
  expect(requests.some(url => new URL(url).pathname === '/assets/icons/exclamation-triangle.svg')).toBe(true);
  const style = await icon.evaluate(el => {
    const host = getComputedStyle(el);
    const svg = el.shadowRoot.querySelector('svg');
    return { display: host.display, width: host.width, height: host.height, fill: getComputedStyle(svg).fill, parentColor: getComputedStyle(el.parentElement).color, aria: el.getAttribute('aria-hidden'), role: el.getAttribute('role') };
  });
  // Shoelace's host: inline-block, 1em square (16px in the example's 16px text); Bootstrap's fill="currentColor".
  expect(style).toMatchObject({ display: 'inline-block', width: '16px', height: '16px', aria: 'true', role: null });
  expect(style.fill).toBe(style.parentColor);
  expect(style.parentColor).toBe('rgb(74, 144, 226)');

  const sizing = frameOf(page, 'Icon example: Sizing');
  const big = sizing.locator('sl-icon').first();
  await expect.poll(() => drawn(big)).toMatchObject({ part: 'svg', width: 32 });

  const labels = frameOf(page, 'Icon example: Labels').locator('sl-icon');
  await expect.poll(() => drawn(labels)).toMatchObject({ part: 'svg' });
  await expect(labels).toHaveAttribute('role', 'img');
  await expect(labels).toHaveAttribute('aria-label', 'Add to favorites');
  expect(await labels.getAttribute('aria-hidden')).toBeNull();
  await expect(frameOf(page, 'Icon example: Labels').getByRole('img', { name: 'Add to favorites' })).toHaveCount(1);
  expect(failures()).toEqual([]);
});

test('custom src and sprite sheet examples draw from this site', async ({ page }) => {
  const { requests, failures } = await openPage(page);
  await documentsLoaded(page);
  const custom = frameOf(page, 'Icon example: Custom icons').locator('#custom-icon');
  await expect.poll(() => drawn(custom)).toMatchObject({ part: 'svg', width: 128 });
  // getBasePath() is '' on the root build, so the example sets a root-relative src.
  expect(await custom.evaluate(el => el.src)).toBe('/assets/icons/emoji-sunglasses.svg');

  const sprite = frameOf(page, 'Icon example: Customize the default library to use SVG sprites');
  for (const name of ['clock', 'speedometer']) {
    const icon = sprite.locator(`sl-icon[name="${name}"]`);
    await expect.poll(() => icon.evaluate(el => {
      const use = el.shadowRoot.querySelector('svg[part="svg"] > use[part="use"]');
      return use && { href: use.getAttribute('href'), fill: use.parentElement.getAttribute('fill'), width: use.getBoundingClientRect().width };
    })).toMatchObject({ href: `/assets/images/sprite.svg#${name}`, fill: 'currentColor' });
    expect(await icon.evaluate(el => el.shadowRoot.querySelector('use').getBoundingClientRect().width)).toBeGreaterThan(0);
  }
  expect(requests.some(url => new URL(url).pathname === '/assets/images/sprite.svg')).toBe(true);
  expect(failures()).toEqual([]);
});

test('CDN icon library examples load only on request, then resolve the documented URLs and apply their mutators (CDN answered locally)', async ({ page }) => {
  const { cdn, failures } = await openPage(page);
  await documentsLoaded(page);
  // Nothing contacts the CDN until the reader asks: no CDN frame exists and no CDN request was made.
  const buttons = page.locator('button.load-cdn-example');
  await expect(buttons).toHaveCount(11);
  await expect(page.locator('iframe[title="Icon example: Boxicons"]')).toHaveCount(0);
  expect(cdn).toEqual([]);
  // From here the CDN is answered locally (installed now, after the docs page is ready: see support/cdn.mjs).
  const answered = await stubCdn(page);
  while (await buttons.count()) {
    await buttons.first().click();
  }
  const expected = {
    Boxicons: ['https://cdn.jsdelivr.net/npm/boxicons@2.0.5/svg/regular/bx-', 'fill'],
    Lucide: ['https://cdn.jsdelivr.net/npm/lucide-static@0.16.29/icons/', null],
    'Font Awesome': ['https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@5.15.1/svgs/regular/', 'fill'],
    Heroicons: ['https://cdn.jsdelivr.net/npm/heroicons@2.0.1/24/outline/', null],
    Iconoir: ['https://cdn.jsdelivr.net/gh/lucaburgio/iconoir@5.5.2/icons/', null],
    Ionicons: ['https://cdn.jsdelivr.net/npm/ionicons@5.1.2/dist/ionicons/svg/', 'fill'],
    'Jam Icons': ['https://cdn.jsdelivr.net/npm/jam-icons@2.0.0/svg/', 'fill'],
    'Material Icons': ['https://cdn.jsdelivr.net/npm/@material-icons/svg@1.0.5/svg/', 'fill'],
    'Remix Icon': ['https://cdn.jsdelivr.net/npm/remixicon@2.5.0/icons/', 'fill'],
    'Tabler Icons': ['https://cdn.jsdelivr.net/npm/@tabler/icons@1.68.0/icons/', null],
    Unicons: ['https://cdn.jsdelivr.net/npm/@iconscout/unicons@3.0.3/svg/line/', 'fill'],
  };
  for (const [title, [prefix, mutated]] of Object.entries(expected)) {
    const icons = frameOf(page, `Icon example: ${title}`).locator('sl-icon');
    await expect(icons.first()).toBeAttached();
    const count = await icons.count();
    expect(count).toBeGreaterThan(0);
    await expect.poll(() => icons.evaluateAll(els => els.filter(el => el.shadowRoot.querySelector('svg')).length), { message: title }).toBe(count);
    expect(answered.some(url => url.startsWith(prefix)), `${title} requests ${prefix}`).toBe(true);
    // The libraries with a mutator set fill (and Ionicons also stroke) to currentColor; the others have none.
    const attrs = await icons.first().evaluate(el => ['fill', 'stroke'].map(a => el.shadowRoot.querySelector('svg').getAttribute(a)));
    expect(attrs, title).toEqual(mutated ? ['currentColor', title === 'Ionicons' ? 'currentColor' : null] : [null, null]);
  }
  expect(failures()).toEqual([]);
});

test('icon search lists every default icon from icons.json and filters by name, tag and style', async ({ page }) => {
  await openPage(page);
  const search = frameOf(page, 'Icon search');
  const all = search.locator('.icon-list button');
  const shown = search.locator('.icon-list button:not([hidden])');
  await expect(all).toHaveCount(2050);
  // Outlined (no "-fill" in the name) is the default style, as in Shoelace.
  await expect(shown).toHaveCount(1355);
  await expect(search.getByRole('status')).toHaveText('1355 icons');
  await search.locator('select').selectOption('all');
  await expect(shown).toHaveCount(2050);
  await expect(search.locator('[data-name="alarm"]')).toBeVisible();
  await search.locator('input').fill('gear');
  await expect(shown).toHaveCount(12);
  // Filtered-out icons are really gone from the grid, not only marked hidden.
  await expect(search.locator('[data-name="alarm"]')).toBeHidden();
  await expect(search.locator('[data-name="gear"]')).toBeVisible();
  await search.locator('select').selectOption('fill');
  await expect(shown).toHaveCount(5);
  await expect(search.locator('[data-name="gear"]')).toBeHidden();
  await expect(search.locator('[data-name="gear-fill"]')).toBeVisible();
  expect(await search.locator('[data-name="gear-fill"] use').getAttribute('href')).toBe('/assets/images/sprite.svg#gear-fill');
  // Tags and categories match too: Bootstrap tags "settings" on the gear icons.
  await search.locator('select').selectOption('all');
  await search.locator('input').fill('settings');
  expect(await search.locator('.icon-list button:not([hidden])').count()).toBeGreaterThan(1);
});

test('icon search wraps an icon in a live sl-tooltip the first time the pointer lands on it and shows Copied! in it after a click', async ({ page }) => {
  await openPage(page);
  const search = frameOf(page, 'Icon search');
  await expect(search.locator('.icon-list button')).toHaveCount(2050);
  const r = await search.locator('body').evaluate(async () => {
    const button = document.querySelector('.icon-list [data-name="gear"]');
    const before = [button.parentElement.localName, button.hasAttribute('title')];
    button.dispatchEvent(new MouseEvent('mouseover'));
    const tooltip = button.closest('sl-tooltip');
    await customElements.whenDefined('sl-tooltip');
    await tooltip.updateComplete;
    const after = { parent: button.parentElement.localName, content: tooltip.content, defined: Boolean(customElements.get('sl-tooltip')), count: document.querySelectorAll('.icon-list sl-tooltip').length };
    // Wrapped once: a second mouseover does not wrap again.
    button.dispatchEvent(new MouseEvent('mouseover'));
    const again = document.querySelectorAll('.icon-list sl-tooltip').length;
    button.click();
    const copied = tooltip.content;
    // Filtering still reaches wrapped buttons.
    const input = document.querySelector('.icon-search input');
    input.value = 'zzzz-no-such-icon';
    input.dispatchEvent(new Event('input'));
    const hiddenWrapped = button.hidden;
    return { before, after, again, copied, hiddenWrapped };
  });
  expect(r.before).toEqual(['div', false]);
  expect(r.after).toEqual({ parent: 'sl-tooltip', content: 'gear', defined: true, count: 1 });
  expect(r.again).toBe(1);
  expect(r.copied).toBe('Copied!');
  expect(r.hiddenWrapped).toBe(true);
  // A second after the click the tooltip shows the name again.
  await expect.poll(() => search.locator('.icon-list [data-name="gear"]').evaluate(b => b.closest('sl-tooltip').content), { timeout: 5000 }).toBe('gear');
});

test('events, ARIA updates, library registration, the url extension and reflected attribute restore', async ({ page }) => {
  await openPage(page);
  const frame = frameOf(page, 'Icon example: Colors');
  const result = await frame.locator('body').evaluate(async () => {
    const { registerIconLibrary, unregisterIconLibrary, getBasePath } = await import('@charm-ux/velcro');
    const wait = (el, name) => new Promise(resolve => el.addEventListener(name, e => resolve(e), { once: true }));
    const out = {};

    const missing = document.createElement('sl-icon');
    const failed = Promise.all([wait(missing, 'sl-error'), wait(missing, 'icon-error')]);
    missing.name = 'definitely-not-an-icon';
    document.body.append(missing);
    const [slError, iconError] = await failed;
    out.error = { bubbles: slError.bubbles, composed: slError.composed, status: iconError.detail.status, svg: missing.shadowRoot.querySelector('svg') };

    const ok = document.createElement('sl-icon');
    const loaded = Promise.all([wait(ok, 'sl-load'), wait(ok, 'icon-load')]);
    ok.name = 'gear';
    document.body.append(ok);
    await loaded;
    out.loaded = !!ok.shadowRoot.querySelector('svg[part="svg"]');
    ok.label = 'Settings';
    await ok.updateComplete;
    out.labelled = [ok.getAttribute('role'), ok.getAttribute('aria-label'), ok.getAttribute('aria-hidden')];
    ok.label = '';
    await ok.updateComplete;
    out.unlabelled = [ok.getAttribute('role'), ok.getAttribute('aria-label'), ok.getAttribute('aria-hidden')];

    // Registered after use: the icon is empty first, then drawn when the library arrives. The mutator runs.
    const later = document.createElement('sl-icon');
    later.library = 'late';
    later.name = 'gear';
    document.body.append(later);
    await later.updateComplete;
    out.beforeRegistration = later.shadowRoot.querySelector('svg');
    const drawnLater = wait(later, 'sl-load');
    registerIconLibrary('late', { resolver: name => getBasePath(`assets/icons/${name}.svg?late`), mutator: svg => svg.setAttribute('data-mutated', '') });
    await drawnLater;
    out.afterRegistration = later.shadowRoot.querySelector('svg').hasAttribute('data-mutated');
    unregisterIconLibrary('late');

    // Removing a reflected attribute restores the value it had before its attributes were applied.
    const holder = document.createElement('div');
    holder.innerHTML = '<sl-icon library="system" name="x-lg"></sl-icon>';
    document.body.append(holder);
    const parsed = holder.firstElementChild;
    await parsed.updateComplete;
    parsed.removeAttribute('library');
    await parsed.updateComplete;
    out.restoredLibrary = parsed.library;

    // The system library needs no assets.
    const system = document.createElement('sl-icon');
    system.library = 'system';
    system.name = 'x-lg';
    const systemLoaded = wait(system, 'sl-load');
    document.body.append(system);
    await systemLoaded;
    out.system = !!system.shadowRoot.querySelector('svg');
    // Velcro extension from core: url is used when src is not set.
    const viaUrl = document.createElement('sl-icon');
    viaUrl.url = getBasePath('assets/icons/heart.svg');
    const urlLoaded = wait(viaUrl, 'sl-load');
    document.body.append(viaUrl);
    await urlLoaded;
    out.url = viaUrl.shadowRoot.querySelector('svg').classList.contains('bi-heart');
    out.basePath = getBasePath();
    return out;
  });
  expect(result.error).toEqual({ bubbles: true, composed: true, status: 404, svg: null });
  expect(result.loaded).toBe(true);
  expect(result.labelled).toEqual(['img', 'Settings', null]);
  expect(result.unlabelled).toEqual([null, null, 'true']);
  expect(result.beforeRegistration).toBeNull();
  expect(result.afterRegistration).toBe(true);
  expect(result.restoredLibrary).toBe('default');
  expect(result.system).toBe(true);
  expect(result.url).toBe(true);
  expect(result.basePath).toBe('');
});

// Local responses for the behavior tests below; counts how often each path was requested.
async function routeTestIcons(page) {
  const counts = {};
  const svg = id => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" data-id="${id}"><path d="M0 0h16v16H0z"/></svg>`;
  await page.route(url => url.pathname.startsWith('/__icon-test/'), async route => {
    const name = new URL(route.request().url()).pathname.slice('/__icon-test/'.length);
    counts[name] = (counts[name] ?? 0) + 1;
    if (name === 'gone.svg') return route.fulfill({ status: 410, body: '' });
    if (name === 'missing.svg') return route.fulfill({ status: 404, body: '' });
    if (name === 'text.svg') return route.fulfill({ status: 200, contentType: 'text/plain', body: 'not an svg' });
    if (name === 'handler.svg') {
      return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: `${svg('handler')}<img src="data:," onerror="window.iconHandlerRan = true">` });
    }
    if (name === 'slow.svg') await new Promise(resolve => setTimeout(resolve, 400));
    return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: svg(name) });
  });
  return counts;
}

test('upstream quirks matched: one draw per changed property, label after draw, hidden, system names, parsing, cache and stale responses', async ({ page }) => {
  await openPage(page);
  const counts = await routeTestIcons(page);
  const frame = frameOf(page, 'Icon example: Colors');
  const result = await frame.locator('body').evaluate(async () => {
    const { registerIconLibrary } = await import('@charm-ux/velcro');
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const events = el => {
      const log = [];
      for (const type of ['sl-load', 'sl-error', 'icon-load', 'icon-error']) el.addEventListener(type, () => log.push(type));
      return log;
    };
    const make = (props, attrs = {}) => {
      const el = document.createElement('sl-icon');
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      Object.assign(el, props);
      const log = events(el);
      document.body.append(el);
      return { el, log };
    };
    const out = {};

    // Resolver and mutator calls, and the aria-label the host had when the resolver ran.
    const calls = { resolveA: 0, resolveB: 0, mutateA: 0, mutateB: 0, labelSeen: [] };
    registerIconLibrary('quirk-a', { resolver: n => { calls.resolveA++; return `/__icon-test/a-${n}.svg`; }, mutator: () => { calls.mutateA++; } });
    registerIconLibrary('quirk-b', {
      resolver: n => { calls.resolveB++; calls.labelSeen.push(document.querySelector('#watched')?.getAttribute('aria-label') ?? null); return `/__icon-test/b-${n}.svg`; },
      mutator: () => { calls.mutateB++; },
    });
    const watched = make({ id: 'watched' }, { library: 'quirk-a', name: 'one' });
    await sleep(300);
    // First render: two watched properties changed before it, plus the first-update draw; one draw (and event) results.
    out.first = { resolveA: calls.resolveA, mutateA: calls.mutateA, log: [...watched.log] };
    watched.log.length = 0;
    watched.el.library = 'quirk-b';
    watched.el.name = 'two';
    watched.el.label = 'Two';
    await sleep(300);
    out.both = { mutateB: calls.mutateB, log: [...watched.log], labelSeen: calls.labelSeen, label: watched.el.getAttribute('aria-label') };

    // Velcro extension: url never adds a draw while src is the source in effect.
    const withSrc = make({ src: '/__icon-test/src.svg' });
    await sleep(300);
    withSrc.log.length = 0;
    withSrc.el.url = '/__icon-test/url.svg';
    await sleep(300);
    out.urlIgnored = [...withSrc.log];
    withSrc.el.src = undefined;
    await sleep(300);
    out.urlUsed = { log: [...withSrc.log], id: withSrc.el.shadowRoot.querySelector('svg')?.dataset.id };

    // hidden does not hide the icon (inline-block beats the browser's [hidden] rule).
    const hidden = make({}, { hidden: '', library: 'system', name: 'x-lg' });
    await sleep(100);
    out.hiddenDisplay = getComputedStyle(hidden.el).display;

    // The system library resolves inherited names to a non-SVG file.
    const inherited = make({ library: 'system', name: 'toString' });
    await sleep(300);
    out.systemToString = [...inherited.log];

    // Unsanitized parsing: an event handler in the fetched file runs.
    const handler = make({ src: '/__icon-test/handler.svg' });
    await sleep(300);
    out.handler = { ran: window.iconHandlerRan === true, log: [...handler.log] };

    // 410 and non-SVG errors stay cached; a 404 is requested again.
    for (const src of ['/__icon-test/gone.svg', '/__icon-test/text.svg', '/__icon-test/missing.svg']) {
      const a = make({ src });
      await sleep(200);
      const b = make({ src });
      await sleep(200);
      out[src] = [a.log.join(), b.log.join()];
    }

    // A response for a source that is no longer current is ignored.
    const stale = make({ src: '/__icon-test/slow.svg' });
    await stale.el.updateComplete;
    stale.el.src = '/__icon-test/fast.svg';
    await sleep(700);
    out.stale = { log: [...stale.log], id: stale.el.shadowRoot.querySelector('svg')?.dataset.id };

    // The cache is keyed by URL only: a sprite sheet library's entry is reused for src.
    registerIconLibrary('quirk-sprite', { resolver: n => `/__icon-test/shared.svg#${n}`, spriteSheet: true });
    make({ library: 'quirk-sprite', name: 'x' });
    await sleep(100);
    const shared = make({ src: '/__icon-test/shared.svg#x' });
    await sleep(300);
    out.shared = { use: !!shared.el.shadowRoot.querySelector('svg[part="svg"] > use[part="use"]'), log: [...shared.log] };
    return out;
  });
  expect(result.first).toEqual({ resolveA: 4, mutateA: 1, log: ['sl-load', 'icon-load'] });
  // name and library changed: two draws, two mutator calls, two events; the label was applied after the draws started.
  expect(result.both.mutateB).toBe(2);
  expect(result.both.log).toEqual(['sl-load', 'icon-load', 'sl-load', 'icon-load']);
  expect(result.both.labelSeen.slice(0, 2)).toEqual([null, null]);
  expect(result.both.label).toBe('Two');
  expect(counts['b-two.svg']).toBe(1);
  expect(result.urlIgnored).toEqual([]);
  expect(result.urlUsed).toEqual({ log: ['sl-load', 'icon-load'], id: 'url.svg' });
  expect(result.hiddenDisplay).toBe('inline-block');
  expect(result.systemToString).toEqual(['sl-error', 'icon-error']);
  expect(result.handler).toEqual({ ran: true, log: ['sl-load', 'icon-load'] });
  for (const src of ['/__icon-test/gone.svg', '/__icon-test/text.svg', '/__icon-test/missing.svg']) {
    expect(result[src], src).toEqual(['sl-error,icon-error', 'sl-error,icon-error']);
  }
  expect([counts['gone.svg'], counts['text.svg'], counts['missing.svg']]).toEqual([1, 1, 2]);
  expect(result.stale).toEqual({ log: ['sl-load', 'icon-load'], id: 'fast.svg' });
  // Drawn as a sprite reference (the browser then loads the file for <use>), with no load event.
  expect(result.shared).toEqual({ use: true, log: [] });
});

test('Shoelace styles only: content-box host and SVG, no core base rules; lang and dir as Shoelace declares them', async ({ page }) => {
  await openPage(page);
  const frame = frameOf(page, 'Icon example: Colors');
  const result = await frame.locator('body').evaluate(async () => {
    const style = document.createElement('style');
    style.textContent = 'sl-icon.padded::part(svg) { padding: 2px; }';
    document.head.append(style);
    const el = document.createElement('sl-icon');
    el.className = 'padded';
    el.style.fontSize = '16px';
    el.library = 'system';
    el.name = 'x-lg';
    const loaded = new Promise(resolve => el.addEventListener('sl-load', resolve, { once: true }));
    document.body.append(el);
    await loaded;
    await el.updateComplete;
    const svg = el.shadowRoot.querySelector('svg');
    const sheetText = el.shadowRoot.adoptedStyleSheets.flatMap(sheet => [...sheet.cssRules].map(rule => rule.cssText)).join('\n');
    const fresh = document.createElement('sl-icon');
    const out = {
      host: getComputedStyle(el).boxSizing,
      svg: getComputedStyle(svg).boxSizing,
      svgWidth: svg.getBoundingClientRect().width,
      sheetText,
      observed: ['lang', 'dir'].map(a => customElements.get('sl-icon').observedAttributes.includes(a)),
      initial: [fresh.lang, fresh.dir],
    };
    document.body.append(fresh);
    await fresh.updateComplete;
    fresh.lang = 'fr';
    fresh.dir = 'auto';
    await fresh.updateComplete;
    out.assigned = [fresh.lang, fresh.dir, fresh.getAttribute('lang'), fresh.getAttribute('dir')];
    fresh.setAttribute('lang', 'de');
    fresh.setAttribute('dir', 'rtl');
    out.fromAttributes = [fresh.lang, fresh.dir];
    fresh.removeAttribute('lang');
    fresh.removeAttribute('dir');
    out.removed = [fresh.lang, fresh.dir];
    return out;
  });
  // Shoelace: the host is content-box and its shadow content inherits it, so padding on the svg part adds to its width.
  expect([result.host, result.svg, result.svgWidth]).toEqual(['content-box', 'content-box', 20]);
  expect(result.sheetText).not.toMatch(/:host\(\[hidden\]\)|:focus|form-control/);
  expect(result.observed).toEqual([true, true]);
  expect(result.initial).toEqual([undefined, undefined]);
  // Not reflected, and `dir` returns the value as set (core would compute ltr/rtl for unset or auto).
  expect(result.assigned).toEqual(['fr', 'auto', null, null]);
  expect(result.fromAttributes).toEqual(['de', 'rtl']);
  expect(result.removed).toEqual([null, null]);
});

test('base path detection without any configuration matches Shoelace: data-shoelace, shoelace script names, else the site root', async ({ page }) => {
  const out = await buildFixtures({
    basepath: `import { getBasePath, setBasePath } from '@charm-ux/velcro/icon/class';
import '@charm-ux/velcro/icon';
window.basePath = { getBasePath, setBasePath };`,
  });
  await openFixturePage(page, out);
  const requests = [];
  page.on('request', request => requests.push(new URL(request.url()).pathname));
  await page.goto(`${ORIGIN}/`);
  const result = await page.evaluate(async () => {
    await import('/basepath.js');
    const { getBasePath, setBasePath } = window.basePath;
    const addScript = attrs => {
      // A non-JavaScript type keeps the browser from fetching the src; getBasePath only reads the attributes.
      const script = document.createElement('script');
      script.type = 'text/plain';
      for (const [k, v] of Object.entries(attrs)) script.setAttribute(k, v);
      document.head.append(script);
      return script;
    };
    const detect = () => { setBasePath(''); return getBasePath('assets/icons/alarm.svg'); };
    const r = {};
    // No script at all: the site root, so the default library requests /assets/icons/<name>.svg.
    r.none = getBasePath('assets/icons/alarm.svg');
    const icon = document.createElement('sl-icon');
    icon.name = 'alarm';
    const errored = new Promise(resolve => icon.addEventListener('sl-error', resolve, { once: true }));
    document.body.append(icon);
    await errored;
    // Empty results are not kept: the next call detects again.
    const config = addScript({ src: '/app.js', 'data-shoelace': '/from/config/' });
    r.redetected = getBasePath('assets/icons/alarm.svg');
    // Once found, the base path is kept even if the page changes.
    config.remove();
    r.kept = getBasePath();
    const names = {};
    for (const src of ['/cdn/shoelace.js', '/cdn/shoelace.min.js?v=2', '/cdn/x/shoelace-autoloader.js', '/cdn/x/shoelace-autoloader.min.js?v=2', '/cdn/velcro.js', '/cdn/shoelace.js.map']) {
      const script = addScript({ src });
      names[src] = detect();
      script.remove();
    }
    r.names = names;
    const fallback = addScript({ src: '/cdn/shoelace.js' });
    const configured = addScript({ src: '/bundle.js', 'data-shoelace': 'https://example.test/base' });
    r.configWins = detect();
    fallback.remove();
    configured.remove();
    setBasePath('/manual/');
    r.manual = [getBasePath(), getBasePath('/x.svg')];
    return r;
  });
  expect(result.none).toBe('/assets/icons/alarm.svg');
  expect(requests).toContain('/assets/icons/alarm.svg');
  expect(result.redetected).toBe('/from/config/assets/icons/alarm.svg');
  expect(result.kept).toBe('/from/config');
  expect(result.names).toEqual({
    '/cdn/shoelace.js': '/cdn/assets/icons/alarm.svg',
    '/cdn/shoelace.min.js?v=2': '/cdn/assets/icons/alarm.svg',
    '/cdn/x/shoelace-autoloader.js': '/cdn/x/assets/icons/alarm.svg',
    '/cdn/x/shoelace-autoloader.min.js?v=2': '/cdn/x/assets/icons/alarm.svg',
    '/cdn/velcro.js': '/assets/icons/alarm.svg',
    '/cdn/shoelace.js.map': '/assets/icons/alarm.svg',
  });
  expect(result.configWins).toBe('https://example.test/base/assets/icons/alarm.svg');
  expect(result.manual).toEqual(['/manual', '/manual/x.svg']);
});
