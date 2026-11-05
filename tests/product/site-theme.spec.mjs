// The docs theme: a light / dark / system control in the header, persisted in localStorage, defaulting to the system
// preference, applied by a synchronous head script before first paint, followed by the site palette, the Velcro
// components' theme class and the example iframes. Served from the root build (playwright.config.mjs webServer).
import { expect, test } from '@playwright/test';

const KEY = 'velcro-docs-theme';
const DARK_BG = 'rgb(18, 18, 20)';
const LIGHT_BG = 'rgb(255, 255, 255)';
const themeSelect = page => page.getByRole('combobox', { name: 'Color theme' });
const rootClass = page => page.evaluate(() => document.documentElement.className);
const settle = async page => {
  await expect(page.locator('litro-outlet')).toHaveAttribute('data-litro-settled', '');
  await page.waitForLoadState('networkidle');
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
  await page.goto('/components/badge', { waitUntil: 'networkidle' });
  expect(await page.evaluate(() => window.__classAtBody)).toBe('sl-theme-dark');
  await context.close();
});

for (const scheme of ['light', 'dark']) {
  test(`with no stored choice the site follows the system preference (${scheme}), and tracks system changes`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: scheme });
    const page = await context.newPage();
    await page.goto('/', { waitUntil: 'networkidle' });
    await settle(page);
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
  await page.goto('/', { waitUntil: 'networkidle' });
  await settle(page);
  await themeSelect(page).selectOption('dark');
  expect(await rootClass(page)).toBe('sl-theme-dark');
  expect(await page.evaluate(k => localStorage.getItem(k), KEY)).toBe('dark');

  await page.goto('/components/button', { waitUntil: 'networkidle' });
  await settle(page);
  expect(await rootClass(page)).toBe('sl-theme-dark');
  await expect(themeSelect(page)).toHaveValue('dark');
  await page.reload({ waitUntil: 'networkidle' });
  expect(await rootClass(page)).toBe('sl-theme-dark');
  // A stored choice is not overridden by a system change.
  await page.emulateMedia({ colorScheme: 'light' });
  expect(await rootClass(page)).toBe('sl-theme-dark');

  await settle(page);
  await themeSelect(page).selectOption('light');
  expect(await rootClass(page)).toBe('sl-theme-light');
  expect(await page.evaluate(k => localStorage.getItem(k), KEY)).toBe('light');

  await page.emulateMedia({ colorScheme: 'dark' });
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
  await page.goto('/', { waitUntil: 'networkidle' });
  await settle(page);
  expect(await rootClass(page)).toBe('sl-theme-light');
  await themeSelect(page).selectOption('dark');
  expect(await rootClass(page)).toBe('sl-theme-dark');
  expect(errors).toEqual([]);
  await context.close();
});

test('dark rendering: site chrome uses the dark palette and the example iframe follows the theme live', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'dark' });
  const page = await context.newPage();
  await page.goto('/components/badge', { waitUntil: 'networkidle' });
  await settle(page);
  await expect(page.locator('header.site')).toHaveCSS('background-color', DARK_BG);
  await expect(page.locator('header.site')).toHaveCSS('border-bottom-color', 'rgb(51, 51, 58)');
  await expect(page.locator('aside.sidebar')).toHaveCSS('background-color', 'rgb(24, 24, 27)');
  await expect(page.locator('main.content h1')).toHaveCSS('color', 'rgb(244, 244, 245)');
  // Velcro components in the chrome are upgraded in the docs page.
  expect(await page.locator('header.site sl-badge').evaluate(el => customElements.get(el.localName) !== undefined && el.shadowRoot !== null)).toBe(true);

  const frame = page.frameLocator('iframe.example');
  await expect(frame.locator('html')).toHaveClass('sl-theme-dark');
  await expect(frame.locator('body')).toHaveCSS('background-color', DARK_BG);
  await expect(frame.locator('body')).toHaveCSS('color', 'rgb(244, 244, 245)');

  await themeSelect(page).selectOption('light');
  await expect(frame.locator('html')).toHaveClass('sl-theme-light');
  await expect(frame.locator('body')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('header.site')).toHaveCSS('background-color', LIGHT_BG);
  await context.close();
});

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
    await expect(page.getByRole('navigation', { name: 'On this page' }).getByRole('link', { name: 'Examples' })).toBeVisible();
  });
});
