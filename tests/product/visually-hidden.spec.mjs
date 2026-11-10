import { expect, test } from '@playwright/test';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/visually-hidden';

async function openExample(page) {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  const frame = page.frameLocator('iframe.example');
  await expect(frame.locator('#demo-external')).toBeVisible();
  await frame.locator('#demo-skip').evaluate(() => customElements.whenDefined('sl-visually-hidden'));
  await documentsLoaded(page);
  return { frame, requests };
}

const hiddenStyles = locator =>
  locator.evaluate(el => {
    const cs = getComputedStyle(el);
    return {
      position: cs.position,
      width: cs.width,
      height: cs.height,
      clip: cs.clip,
      clipPath: cs.clipPath,
      borderStyle: cs.borderTopStyle,
      overflow: cs.overflow,
      whiteSpace: cs.whiteSpace,
      padding: cs.padding,
    };
  });

test('docs page is prerendered with Velcro branding, prototype status and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Visually Hidden - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('without changing the shared core prefix');
  expect(html).toContain('ready');
  expect(html).toContain('sl-icon');
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
  const home = await (await request.get('/')).text();
  expect(home).toContain('/components/visually-hidden');
});

test('sl-visually-hidden registers inside the example document (the docs page registers its own copy separately), as the exported class', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  // The docs page loads the same runtime through its client entry (app-main.ts) into its own, separate registry.
  expect(await page.evaluate(() => customElements.whenDefined('sl-visually-hidden').then(ctor => typeof ctor))).toBe('function');
  const info = await frame.locator('body').evaluate(() => {
    const ctor = customElements.get('sl-visually-hidden');
    return {
      defined: ctor !== undefined,
      baseName: ctor?.baseName,
      coreTag: customElements.get('ch-visually-hidden') !== undefined,
      viaConstructor: ctor ? new ctor().localName : null,
    };
  });
  expect(info).toEqual({ defined: true, baseName: 'visually-hidden', coreTag: false, viaConstructor: 'sl-visually-hidden' });
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
});

test('structure: a default slot only, no parts, no host role, and the content stays in the accessibility tree', async ({ page }) => {
  const { frame } = await openExample(page);
  const info = await frame.locator('#demo-skip').evaluate(el => ({
    parts: [...el.shadowRoot.querySelectorAll('[part]')].map(n => n.getAttribute('part')),
    children: [...el.shadowRoot.children].filter(n => n.localName !== 'style').map(n => n.localName),
    slots: [...el.shadowRoot.querySelectorAll('slot')].map(s => s.name),
    assigned: el.shadowRoot.querySelector('slot').assignedElements().map(n => n.id),
    attrs: el.getAttributeNames().sort(),
  }));
  expect(info).toEqual({ parts: [], children: ['slot'], slots: [''], assigned: ['demo-skip-link'], attrs: ['id'] });
  // Hidden by clipping, not by display or visibility, so the link is still exposed to assistive technology.
  await expect(frame.getByRole('link', { name: 'Skip to main content' })).toHaveCount(1);
  await expect(frame.locator('#demo-external')).toHaveAccessibleName('Visit External Page opens in a new window');
});

test('hidden state: clip-based styles match Shoelace', async ({ page }) => {
  const { frame } = await openExample(page);
  for (const id of ['demo-skip', 'demo-new-window']) {
    expect(await hiddenStyles(frame.locator(`#${id}`)), id).toEqual({
      position: 'absolute',
      width: '1px',
      height: '1px',
      clip: 'rect(0px, 0px, 0px, 0px)',
      clipPath: 'inset(50%)',
      borderStyle: 'none',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      padding: '0px',
    });
  }
  const display = await frame.locator('#demo-skip').evaluate(el => [getComputedStyle(el).display, getComputedStyle(el).visibility]);
  expect(display).toEqual(['block', 'visible']);
  // The page's own inline styles cannot override the !important rules.
  const overridden = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-visually-hidden');
    el.style.width = '200px';
    el.style.position = 'static';
    el.textContent = 'x';
    document.body.append(el);
    await el.updateComplete;
    const out = { width: getComputedStyle(el).width, position: getComputedStyle(el).position };
    el.remove();
    return out;
  });
  expect(overridden).toEqual({ width: '1px', position: 'absolute' });
});

test('focus reveals the content and blurring hides it again', async ({ page, browserName }) => {
  const { frame } = await openExample(page);
  const host = frame.locator('#demo-skip');
  await frame.locator('#demo-skip-link').focus();
  const shown = await hiddenStyles(host);
  expect(shown.width).not.toBe('1px');
  expect(shown.height).not.toBe('1px');
  expect(shown.overflow).not.toBe('hidden');
  expect(shown.clipPath).not.toBe('inset(50%)');
  expect(shown.position).toBe('static');
  await frame.locator('#demo-skip-link').blur();
  expect((await hiddenStyles(host)).clipPath).toBe('inset(50%)');
  // Keyboard path: the first Tab stop in the document is the hidden link.
  await frame.locator('body').evaluate(() => document.activeElement?.blur());
  await frame.locator('#demo-external').evaluate(el => el.focus());
  // Safari's default (and so WebKit's on macOS) skips links in the Tab order; Option moves through all focusable elements.
  await page.keyboard.press(browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Shift+Tab' : 'Shift+Tab');
  await expect(frame.locator('#demo-skip-link')).toBeFocused();
  expect((await hiddenStyles(host)).clipPath).toBe('none');
});

test('no properties, attributes, methods or Shoelace events; only the inherited core ready event', async ({ page }) => {
  const { frame } = await openExample(page);
  const result = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-visually-hidden');
    const events = [];
    el.addEventListener('ready', event => events.push({ bubbles: event.bubbles, composed: event.composed }));
    el.textContent = 'x';
    document.body.append(el);
    await el.updateComplete;
    const ctor = customElements.get('sl-visually-hidden');
    const out = {
      events,
      observed: [...ctor.observedAttributes].sort(),
      attrs: el.getAttributeNames(),
      hostRole: el.getAttribute('role'),
    };
    el.setAttribute('hidden', '');
    await el.updateComplete;
    out.hidden = getComputedStyle(el).display;
    el.remove();
    return out;
  });
  expect(result.events).toEqual([{ bubbles: false, composed: false }]);
  expect(result.observed).toEqual(['dir']);
  expect(result.attrs).toEqual([]);
  expect(result.hostRole).toBeNull();
  expect(result.hidden).toBe('none');
});

test('no upstream Shoelace runtime is requested or defined; all requests stay on the local origin', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  expect(await frame.locator('body').evaluate(() => ['sl-velcro-sentinel-not-a-component'].filter(tag => customElements.get(tag)))).toEqual([]);
});
