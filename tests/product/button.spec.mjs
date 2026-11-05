import { expect, test } from '@playwright/test';

const PAGE = '/components/button';

async function openExample(page) {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  // Litro's client router remounts the page component once after load, which reloads the iframe; wait for it to settle.
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  const frame = page.frameLocator('iframe.example');
  await expect(frame.locator('#demo-primary')).toBeVisible();
  await frame.locator('#demo-primary').evaluate(() => customElements.whenDefined('sl-button'));
  await page.waitForLoadState('networkidle');
  return { frame, requests };
}

test('docs page is prerendered with Velcro branding and prototype status', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Button - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Not implemented or unverified');
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
});

test('sl-button registers inside the example document, and separately in the docs page through the client entry', async ({ page }) => {
  const { requests } = await openExample(page);
  // The docs page loads the same runtime through its client entry (app-main.ts) into its own, separate registry.
  expect(await page.evaluate(() => customElements.whenDefined('sl-button').then(ctor => typeof ctor))).toBe('function');
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
});

test('renders: variants, prefix/suffix slots and public parts', async ({ page }) => {
  const { frame } = await openExample(page);
  const primary = frame.locator('#demo-primary');
  const box = await primary.boundingBox();
  expect(box.width).toBeGreaterThan(40);
  expect(box.height).toBeGreaterThan(30);
  const info = await primary.evaluate(el => ({
    tag: el.localName,
    variant: el.getAttribute('variant'),
    parts: [...el.shadowRoot.querySelectorAll('[part]')].flatMap(n => n.getAttribute('part').split(/\s+/)),
    background: getComputedStyle(el.shadowRoot.querySelector('[part~="base"]')).backgroundColor,
    prefixSlotted: el.shadowRoot.querySelector('slot[name="prefix"]').assignedNodes().length,
  }));
  expect(info.tag).toBe('sl-button');
  expect(info.parts).toEqual(expect.arrayContaining(['base', 'prefix', 'label', 'suffix']));
  expect(info.background).toBe('rgb(2, 132, 199)');
  expect(info.prefixSlotted).toBe(1);
  const pill = frame.locator('sl-button[pill]');
  expect(await pill.evaluate(el => el.querySelector('[slot="suffix"]') !== null)).toBe(true);
});

test('click increments the example counter through document-level wiring', async ({ page }) => {
  const { frame } = await openExample(page);
  await frame.locator('#demo-primary').click();
  await frame.locator('#demo-primary').click();
  await expect(frame.locator('#demo-count')).toHaveText('2');
});

test('disabled: swallows clicks and is not keyboard focusable', async ({ page }) => {
  const { frame } = await openExample(page);
  const disabled = frame.locator('#demo-disabled');
  await expect(disabled).toHaveAttribute('disabled', '');
  await disabled.click({ force: true });
  await expect(frame.locator('#demo-disabled-count')).toHaveText('0');
  await frame.locator('#demo-default').focus();
  await page.keyboard.press('Tab');
  const active = await frame.locator('body').evaluate(() => document.activeElement?.getAttribute('variant'));
  expect(active).toBe('success');
});

test('keyboard focus: Tab reaches the button, shows a focus ring, Enter/Space activate, sl-focus/sl-blur fire', async ({ page }) => {
  const { frame } = await openExample(page);
  const primary = frame.locator('#demo-primary');
  await primary.evaluate(el => {
    window.__events = [];
    el.addEventListener('sl-focus', () => window.__events.push('sl-focus'));
    el.addEventListener('sl-blur', () => window.__events.push('sl-blur'));
  });
  const activeId = () => frame.locator('body').evaluate(() => document.activeElement?.id);
  await frame.locator('#demo-count').click();
  for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+Tab');
  expect(await activeId()).toBe('demo-primary');
  const outline = await primary.evaluate(el => getComputedStyle(el.shadowRoot.querySelector('[part~="base"]')).outlineStyle);
  expect(outline).not.toBe('none');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await expect(frame.locator('#demo-count')).toHaveText('2');
  await page.keyboard.press('Tab');
  const events = await primary.evaluate(() => window.__events);
  expect(events).toEqual(['sl-focus', 'sl-blur']);
});

test('no upstream Shoelace runtime is requested or defined', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  const defined = await frame.locator('body').evaluate(() => ['sl-icon', 'sl-dialog'].filter(tag => customElements.get(tag)));
  // sl-spinner is Velcro's own component now; its upstream-free check lives in spinner.spec.mjs.
  expect(defined).toEqual([]);
  expect(await frame.locator('body').evaluate(() => Boolean(window.Shoelace || document.querySelector('script[src*="shoelace"]')))).toBe(false);
});

test('programmatic click(): ignored while disabled, exactly one click event when enabled', async ({ page }) => {
  const { frame } = await openExample(page);
  await frame.locator('#demo-disabled').evaluate(el => el.click());
  await expect(frame.locator('#demo-disabled-count')).toHaveText('0');
  await frame.locator('#demo-primary').evaluate(el => el.click());
  await expect(frame.locator('#demo-count')).toHaveText('1');
  await frame.locator('#demo-primary').evaluate(el => el.click());
  await expect(frame.locator('#demo-count')).toHaveText('2');
});

test('rendered link: click() emits exactly one host click and host preventDefault cancels the default action', async ({ page }) => {
  const { frame } = await openExample(page);
  const result = await frame.locator('body').evaluate(async () => {
    const run = async ({ prevent, disabled }) => {
      const el = document.createElement('sl-button');
      el.setAttribute('href', '#unused');
      if (disabled) el.setAttribute('disabled', '');
      document.body.append(el);
      await el.updateComplete;
      const seen = [];
      el.addEventListener('click', event => {
        if (prevent) event.preventDefault();
      });
      // Bubbles after the host listener: records whether the default action survived, then cancels it so the
      // example document never navigates.
      const record = event => {
        seen.push(event.defaultPrevented);
        event.preventDefault();
      };
      window.addEventListener('click', record);
      const control = el.shadowRoot.querySelector('.control');
      let controlClicks = 0;
      control.addEventListener('click', () => controlClicks++);
      el.click();
      window.removeEventListener('click', record);
      return { windowSeen: seen, controlClicks };
    };
    return { allowed: await run({}), prevented: await run({ prevent: true }), disabled: await run({ disabled: true }) };
  });
  expect(result.allowed).toEqual({ windowSeen: [false], controlClicks: 1 });
  expect(result.prevented).toEqual({ windowSeen: [true], controlClicks: 1 });
  expect(result.disabled).toEqual({ windowSeen: [], controlClicks: 0 });
});

test('rendered link: a real pointer click emits exactly one host click', async ({ page }) => {
  const { frame } = await openExample(page);
  await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-button');
    el.id = 'demo-link';
    el.setAttribute('href', '#pointer');
    el.textContent = 'Link';
    document.body.append(el);
    window.__linkClicks = 0;
    el.addEventListener('click', event => {
      window.__linkClicks++;
      event.preventDefault();
    });
    await el.updateComplete;
  });
  await frame.locator('#demo-link').click();
  expect(await frame.locator('body').evaluate(() => window.__linkClicks)).toBe(1);
});
