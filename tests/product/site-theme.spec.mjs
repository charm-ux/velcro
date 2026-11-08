// The docs theme: a light / dark / system control in the header, persisted in localStorage, defaulting to the system
// preference, applied by a synchronous head script before first paint, followed by the site palette, the Velcro
// components' theme class and the example iframes. Served from the root build (playwright.config.mjs webServer).
import { expect, test } from '@playwright/test';
import { openDocs, reloadDocs } from './support/loaded.mjs';

const KEY = 'velcro-docs-theme';
const DARK_BG = 'rgb(18, 18, 20)';
const LIGHT_BG = 'rgb(255, 255, 255)';
const themeSelect = page => page.getByRole('combobox', { name: 'Color theme' });
const rootClass = page => page.evaluate(() => document.documentElement.className);
// emulateMedia is a protocol call; WebKit re-evaluates media queries at its next rendering update, so a synchronous read of
// matchMedia can still show the old scheme. Wait for the page to observe the new scheme before acting on it.
const emulate = async (page, scheme) => {
  await page.emulateMedia({ colorScheme: scheme });
  await page.waitForFunction(s => matchMedia('(prefers-color-scheme: dark)').matches === (s === 'dark'), scheme);
};

test('the theme is decided by a synchronous head script that runs before the body is parsed', async ({ request }) => {
  const html = await (await request.get('/components/badge')).text();
  const head = html.slice(0, html.indexOf('<body'));
  expect(head).toContain('<style id="velcro-docs-palette">');
  expect(head).toMatch(/<script id="velcro-docs-theme">[^<]*velcro-docs-theme/);
  expect(head).not.toMatch(/<script id="velcro-docs-theme"[^>]*(?:type="module"|defer|async)/);
});

test('the theme class is on the root before any page script or stylesheet runs (no flash of the wrong theme)', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'dark' });
  const page = await context.newPage();
  // Records the root class as the body element is created, before any deferred module (app, Velcro) runs.
  await page.addInitScript(() => {
    new MutationObserver((_m, observer) => {
      if (document.body) {
        window.__classAtBody = document.documentElement.className;
        observer.disconnect();
      }
    }).observe(document, { childList: true, subtree: true });
  });
  await openDocs(page, '/components/badge');
  expect(await page.evaluate(() => window.__classAtBody)).toBe('sl-theme-dark');
  await context.close();
});

for (const scheme of ['light', 'dark']) {
  test(`with no stored choice the site follows the system preference (${scheme}), and tracks system changes`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: scheme });
    const page = await context.newPage();
    await openDocs(page, '/');
    expect(await rootClass(page)).toBe(`sl-theme-${scheme}`);
    expect(await page.evaluate(k => localStorage.getItem(k), KEY)).toBeNull();
    await expect(themeSelect(page)).toHaveValue('system');
    await expect(page.locator('body')).toHaveCSS('background-color', scheme === 'dark' ? DARK_BG : LIGHT_BG);
    const other = scheme === 'dark' ? 'light' : 'dark';
    await page.emulateMedia({ colorScheme: other });
    await expect.poll(() => rootClass(page)).toBe(`sl-theme-${other}`);
    await context.close();
  });
}

test('an explicit choice persists across reloads and pages, wins over the system, and "system" clears it', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'light' });
  const page = await context.newPage();
  await openDocs(page, '/');
  await themeSelect(page).selectOption('dark');
  expect(await rootClass(page)).toBe('sl-theme-dark');
  expect(await page.evaluate(k => localStorage.getItem(k), KEY)).toBe('dark');

  await openDocs(page, '/components/button');
  expect(await rootClass(page)).toBe('sl-theme-dark');
  await expect(themeSelect(page)).toHaveValue('dark');
  await reloadDocs(page);
  expect(await rootClass(page)).toBe('sl-theme-dark');
  // A stored choice is not overridden by a system change.
  await emulate(page, 'light');
  expect(await rootClass(page)).toBe('sl-theme-dark');

  await themeSelect(page).selectOption('light');
  expect(await rootClass(page)).toBe('sl-theme-light');
  expect(await page.evaluate(k => localStorage.getItem(k), KEY)).toBe('light');

  await emulate(page, 'dark');
  await themeSelect(page).selectOption('system');
  expect(await page.evaluate(k => localStorage.getItem(k), KEY)).toBeNull();
  expect(await rootClass(page)).toBe('sl-theme-dark');
  await context.close();
});

test('blocked storage does not break the page: the choice holds for the current page', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'light' });
  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
  });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await openDocs(page, '/');
  expect(await rootClass(page)).toBe('sl-theme-light');
  await themeSelect(page).selectOption('dark');
  expect(await rootClass(page)).toBe('sl-theme-dark');
  expect(errors).toEqual([]);
  await context.close();
});

test('dark rendering: site chrome uses the dark palette and the example iframe follows the theme live', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'dark' });
  const page = await context.newPage();
  await openDocs(page, '/components/badge');
  await expect(page.locator('header.site')).toHaveCSS('background-color', DARK_BG);
  await expect(page.locator('header.site')).toHaveCSS('border-bottom-color', 'rgb(51, 51, 58)');
  await expect(page.locator('aside.sidebar')).toHaveCSS('background-color', 'rgb(24, 24, 27)');
  await expect(page.locator('main.content h1')).toHaveCSS('color', 'rgb(244, 244, 245)');
  // Velcro components in the chrome are upgraded in the docs page.
  expect(await page.locator('header.site sl-badge').evaluate(el => customElements.get(el.localName) !== undefined && el.shadowRoot !== null)).toBe(true);

  const frame = page.frameLocator('iframe.example');
  await expect(frame.locator('html')).toHaveClass('sl-theme-dark');
  // The example surface and text come from the component tokens, so they always pair with the components' own panels.
  const tokens = await frame.locator('body').evaluate(() => {
    const probe = document.createElement('span');
    document.body.append(probe);
    const read = v => { probe.style.color = `var(${v})`; return getComputedStyle(probe).color; };
    const out = { surface: read('--sl-color-neutral-0'), text: read('--sl-color-neutral-900') };
    probe.remove();
    return out;
  });
  await expect(frame.locator('body')).toHaveCSS('background-color', tokens.surface);
  await expect(frame.locator('body')).toHaveCSS('color', tokens.text);

  await themeSelect(page).selectOption('light');
  await expect(frame.locator('html')).toHaveClass('sl-theme-light');
  await expect(frame.locator('body')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('header.site')).toHaveCSS('background-color', LIGHT_BG);
  await context.close();
});

// WCAG relative-luminance contrast of two rgb()/rgba() strings (opaque colors only).
function contrast(a, b) {
  const lum = c => {
    const [r, g, bl] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

for (const scheme of ['light', 'dark']) {
  test(`card example text is readable on the card's own panel in ${scheme} mode`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: scheme });
    const page = await context.newPage();
    await openDocs(page, '/components/card');
    const frame = page.frameLocator('iframe.example');
    await expect(frame.locator('html')).toHaveClass(`sl-theme-${scheme}`);
    for (const id of ['#demo-basic', '#demo-header', '#demo-footer']) {
      const pair = await frame.locator(id).evaluate(el => ({
        text: getComputedStyle(el).color,
        panel: getComputedStyle(el.shadowRoot.querySelector('[part~="base"]')).backgroundColor,
      }));
      expect(pair.panel, id).not.toBe('rgba(0, 0, 0, 0)');
      expect(contrast(pair.text, pair.panel), `${id} ${JSON.stringify(pair)}`).toBeGreaterThanOrEqual(4.5);
    }
    await context.close();
  });
}

test('a failed storage write keeps the new choice for the page, over an older stored value', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'light' });
  const page = await context.newPage();
  await page.addInitScript(key => {
    localStorage.setItem(key, 'dark');
    Storage.prototype.setItem = () => { throw new Error('quota'); };
    Storage.prototype.removeItem = () => { throw new Error('quota'); };
  }, KEY);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await openDocs(page, '/');
  expect(await rootClass(page)).toBe('sl-theme-dark');
  await themeSelect(page).selectOption('light');
  expect(await rootClass(page)).toBe('sl-theme-light');
  expect(await page.evaluate(k => localStorage.getItem(k), KEY)).toBe('dark');
  await themeSelect(page).selectOption('system');
  expect(await rootClass(page)).toBe('sl-theme-light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => rootClass(page)).toBe('sl-theme-dark');
  expect(errors).toEqual([]);
  await context.close();
});

test('a choice made in another tab is followed, and the receiving tab\'s control shows it and stays usable', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'light' });
  const a = await context.newPage();
  const b = await context.newPage();
  for (const p of [a, b]) {
    await openDocs(p, '/');
  }
  await themeSelect(a).selectOption('dark');
  await expect.poll(() => rootClass(b)).toBe('sl-theme-dark');
  await expect(themeSelect(b)).toHaveValue('dark');
  await themeSelect(b).selectOption('system');
  await expect.poll(() => rootClass(a)).toBe('sl-theme-light');
  await expect(themeSelect(a)).toHaveValue('system');
  expect(await a.evaluate(() => window.__velcroDocsTheme.get())).toBe('system');
  // A genuinely different value chosen through the synchronized control in the receiving tab takes effect everywhere.
  await themeSelect(a).selectOption('light');
  await expect(themeSelect(b)).toHaveValue('light');
  await a.emulateMedia({ colorScheme: 'dark' });
  await b.emulateMedia({ colorScheme: 'dark' });
  expect(await rootClass(a)).toBe('sl-theme-light');
  await expect.poll(() => rootClass(b)).toBe('sl-theme-light');
  await themeSelect(b).selectOption('dark');
  await expect(themeSelect(a)).toHaveValue('dark');
  await expect.poll(() => rootClass(a)).toBe('sl-theme-dark');
  await context.close();
});

test('the docs page itself carries the Velcro light tokens and the theme control is shown once the script ran', async ({ page }) => {
  await openDocs(page, '/components/button');
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sl-color-primary-600').trim())).toBe('#0284c7');
  await expect(themeSelect(page)).toBeVisible();
  // The header's Components link marks the section, the sidebar marks the page.
  await expect(page.locator('header nav').getByRole('link', { name: 'Components' })).toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('navigation', { name: 'Components' }).getByRole('link', { name: 'Button', exact: true })).toHaveAttribute('aria-current', 'page');
});

const panelOf = locator =>
  locator.evaluate(async el => {
    await customElements.whenDefined(el.localName);
    await el.updateComplete;
    return {
      panel: getComputedStyle(el.shadowRoot.querySelector('[part~="base"]')).backgroundColor,
      text: getComputedStyle(el).color,
      token: getComputedStyle(el).getPropertyValue('--sl-color-neutral-0').trim(),
    };
  });

for (const scheme of ['light', 'dark']) {
  test(`Velcro components render with ${scheme} tokens on the page (showcase) and inside an example iframe`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: scheme });
    const page = await context.newPage();
    await openDocs(page, '/');
    const onPage = await panelOf(page.locator('#showcase [data-component="card"] sl-card'));
    await openDocs(page, '/components/card');
    const inFrame = await panelOf(page.frameLocator('iframe.example').locator('#demo-basic'));
    for (const [where, r] of [['page', onPage], ['iframe', inFrame]]) {
      // Shoelace's neutral-0 token is hsl(0 0% 100%) in light and hsl(240 5.9% 11%) in dark (bundled CSS is minified).
      expect(r.token, where).toBe(scheme === 'dark' ? '#1a1a1e' : '#fff');
      // The card panel (--sl-panel-background-color) is white in light and a near-black panel in dark.
      if (scheme === 'dark') expect(Math.max(...r.panel.match(/\d+/g).slice(0, 3).map(Number)), where).toBeLessThan(60);
      else expect(r.panel, where).toBe('rgb(255, 255, 255)');
      expect(contrast(r.text, r.panel), `${where} ${JSON.stringify(r)}`).toBeGreaterThanOrEqual(4.5);
    }
    await context.close();
  });
}

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false, colorScheme: 'dark' });

  test('pages stay readable and follow the system preference through CSS alone', async ({ page }) => {
    for (const route of ['/', '/components/card']) {
      await page.goto(route);
      await expect(page.locator('h1').first()).toBeVisible();
      await expect(page.getByText('Velcro is an unreleased prototype').first()).toBeVisible();
      await expect(page.locator('body')).toHaveCSS('background-color', DARK_BG);
      await expect(page.locator('header.site')).toHaveCSS('background-color', DARK_BG);
    }
    await expect(page.getByRole('navigation', { name: 'Components' }).getByRole('link')).not.toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Attributes and properties' })).toBeVisible();
    // The theme control would do nothing without the script, so it is not shown.
    await expect(page.locator('select.theme')).toBeHidden();
    await expect(page.getByRole('navigation', { name: 'On this page' }).getByRole('link', { name: 'Examples' })).toBeVisible();
  });
});
