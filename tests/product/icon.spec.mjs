import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { collectRequestFailures } from './request-failures.mjs';
import { stubCdn } from './support/cdn.mjs';

const PAGE = '/components/icon';
const source = fileURLToPath(new URL('../../packages/velcro/assets/bootstrap-icons/', import.meta.url));
const dist = fileURLToPath(new URL('../../packages/velcro/dist/assets/icons/', import.meta.url));

async function openPage(page) {
  const cdn = await stubCdn(page);
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  const failures = collectRequestFailures(page);
  // Litro's client router remounts the page component once after load, which reloads the iframes; wait for it to settle.
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  await page.waitForLoadState('networkidle');
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

test('CDN icon library examples resolve the documented URLs and apply their mutators (CDN answered locally)', async ({ page }) => {
  const { cdn, failures } = await openPage(page);
  const expected = {
    Boxicons: ['https://cdn.jsdelivr.net/npm/boxicons@2.0.5/svg/regular/bx-', 'fill'],
    Lucide: ['https://cdn.jsdelivr.net/npm/lucide-static@0.16.29/icons/', null],
    'Font Awesome': ['https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@5.15.1/svgs/regular/', 'fill'],
    Heroicons: ['https://cdn.jsdelivr.net/npm/heroicons@2.0.1/24/outline/', null],
    Iconoir: ['https://cdn.jsdelivr.net/gh/lucaburgio/iconoir@latest/icons/', null],
    Ionicons: ['https://cdn.jsdelivr.net/npm/ionicons@5.1.2/dist/ionicons/svg/', null],
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
    expect(cdn.some(url => url.startsWith(prefix)), `${title} requests ${prefix}`).toBe(true);
    if (mutated) {
      expect(await icons.first().evaluate(el => el.shadowRoot.querySelector('svg').getAttribute('fill'))).toBe('currentColor');
    }
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
  await search.locator('input').fill('gear');
  await expect(shown).toHaveCount(12);
  await search.locator('select').selectOption('fill');
  await expect(shown).toHaveCount(5);
  expect(await search.locator('[data-name="gear-fill"] use').getAttribute('href')).toBe('/assets/images/sprite.svg#gear-fill');
  // Tags and categories match too: Bootstrap tags "settings" on the gear icons.
  await search.locator('select').selectOption('all');
  await search.locator('input').fill('settings');
  expect(await search.locator('.icon-list button:not([hidden])').count()).toBeGreaterThan(1);
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
