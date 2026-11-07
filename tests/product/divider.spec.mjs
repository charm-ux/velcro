import { expect, test } from '@playwright/test';
import { documentsLoaded, watchNetwork } from './support/loaded.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/divider';

async function openExample(page) {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  // Litro's client router remounts the page component once after load, which reloads the iframe; wait for it to settle.
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  // The client router replaces the prerendered page once; until it has settled there can be two example iframes.
  await expect(page.locator('litro-outlet')).toHaveAttribute('data-litro-settled', '');
  const frame = page.frameLocator('iframe.example');
  await expect(frame.locator('#demo-horizontal')).toBeVisible();
  await frame.locator('#demo-horizontal').evaluate(() => customElements.whenDefined('sl-divider'));
  await documentsLoaded(page);
  return { frame, requests };
}

const hostStyle = locator =>
  locator.evaluate(el => {
    const cs = getComputedStyle(el);
    return {
      display: cs.display,
      borderTop: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`,
      borderLeft: `${cs.borderLeftWidth} ${cs.borderLeftStyle} ${cs.borderLeftColor}`,
      margin: cs.margin,
      padding: cs.padding,
      minHeight: cs.minHeight,
      color: cs.getPropertyValue('--color').trim(),
      width: cs.getPropertyValue('--width').trim(),
      spacing: cs.getPropertyValue('--spacing').trim(),
    };
  });

test('docs page is prerendered with Velcro branding, prototype status and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Divider - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('without changing the shared core prefix');
  expect(html).not.toContain('not isolated from core');
  expect(html).toContain('definite height');
  expect(html).toContain('no RTL or localization check');
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
  const home = await (await request.get('/')).text();
  expect(home).toContain('/components/divider');
});

test('sl-divider registers inside the example document (the docs page registers its own copy separately), as the exported class, and no core ch-divider element is defined', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  // The docs page loads the same runtime through its client entry (app-main.ts) into its own, separate registry.
  expect(await page.evaluate(() => customElements.whenDefined('sl-divider').then(ctor => typeof ctor))).toBe('function');
  const info = await frame.locator('body').evaluate(() => {
    const ctor = customElements.get('sl-divider');
    return { baseName: ctor?.baseName, coreTag: customElements.get('ch-divider') !== undefined, viaConstructor: ctor ? new ctor().localName : null };
  });
  expect(info).toEqual({ baseName: 'divider', coreTag: false, viaConstructor: 'sl-divider' });
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
});

test('semantics: separator role and aria-orientation on the host, nothing rendered inside, no slots or parts', async ({ page }) => {
  const { frame } = await openExample(page);
  await expect(frame.getByRole('separator')).toHaveCount(4);
  const info = await frame.locator('#demo-horizontal').evaluate(el => ({
    role: el.getAttribute('role'),
    orientation: el.getAttribute('aria-orientation'),
    vertical: el.vertical,
    attrs: el.getAttributeNames().sort(),
    shadowChildren: el.shadowRoot.querySelectorAll('*').length,
    parts: el.shadowRoot.querySelectorAll('[part]').length,
    slots: el.shadowRoot.querySelectorAll('slot').length,
    focusable: el.tabIndex,
  }));
  expect(info).toEqual({ role: 'separator', orientation: 'horizontal', vertical: false, attrs: ['aria-orientation', 'id', 'role'], shadowChildren: 0, parts: 0, slots: 0, focusable: -1 });
  const vertical = await frame.locator('#demo-vertical').evaluate(el => ({ role: el.getAttribute('role'), orientation: el.getAttribute('aria-orientation'), vertical: el.vertical, reflected: el.hasAttribute('vertical') }));
  expect(vertical).toEqual({ role: 'separator', orientation: 'vertical', vertical: true, reflected: true });
});

test('dynamic updates: vertical reflects, updates aria-orientation and switches the layout both ways', async ({ page }) => {
  const { frame } = await openExample(page);
  const result = await frame.locator('body').evaluate(async () => {
    const box = document.createElement('div');
    box.style.cssText = 'height:40px;width:300px';
    const el = document.createElement('sl-divider');
    box.append('a', el, 'b');
    document.body.append(box);
    await el.updateComplete;
    const read = () => ({
      orientation: el.getAttribute('aria-orientation'),
      attr: el.hasAttribute('vertical'),
      display: getComputedStyle(el).display,
      border: getComputedStyle(el).borderLeftWidth + '/' + getComputedStyle(el).borderTopWidth,
    });
    const steps = { initial: read() };
    el.vertical = true;
    await el.updateComplete;
    steps.property = read();
    el.removeAttribute('vertical');
    await el.updateComplete;
    steps.removed = read();
    el.setAttribute('vertical', '');
    await el.updateComplete;
    steps.attribute = read();
    box.remove();
    return steps;
  });
  expect(result.initial).toEqual({ orientation: 'horizontal', attr: false, display: 'block', border: '0px/1px' });
  expect(result.property).toEqual({ orientation: 'vertical', attr: true, display: 'inline-block', border: '1px/0px' });
  expect(result.removed).toEqual({ orientation: 'horizontal', attr: false, display: 'block', border: '0px/1px' });
  expect(result.attribute).toEqual({ orientation: 'vertical', attr: true, display: 'inline-block', border: '1px/0px' });
});

test('geometry: horizontal is a 1px block rule with 16px vertical margin; vertical is 1px wide, full container height, 16px side margin', async ({ page }) => {
  const { frame } = await openExample(page);
  const horizontal = await hostStyle(frame.locator('#demo-horizontal'));
  expect(horizontal).toMatchObject({ display: 'block', borderTop: '1px solid rgb(228, 228, 231)', borderLeft: '0px none rgb(0, 0, 0)', margin: '16px 0px', padding: '0px', minHeight: '0px' });
  // Sizes come from the element's own layout box inside its frame (not Playwright's cross-frame boundingBox, whose
  // coordinate transform rounds differently per engine).
  const sizeOf = locator => locator.evaluate(el => { const r = el.getBoundingClientRect(); return { width: r.width, height: r.height }; });
  const box = await sizeOf(frame.locator('#demo-horizontal'));
  const parent = await frame.locator('body').evaluate(el => el.getBoundingClientRect().width);
  // Block width: fills the container (body minus its 1rem margins), not core's width:100% flex item.
  expect(box.width).toBe(parent - 0);
  expect(box.height).toBe(1);
  const vertical = await hostStyle(frame.locator('#demo-vertical'));
  // The example puts the vertical divider in a flex container, which blockifies inline-block; the dynamic test checks it standalone.
  expect(vertical).toMatchObject({ display: 'block', borderLeft: '1px solid rgb(228, 228, 231)', margin: '0px 16px', padding: '0px', minHeight: '0px' });
  const v = await sizeOf(frame.locator('#demo-vertical'));
  expect([v.width, v.height]).toEqual([1, 32]);
});

test('CSS custom properties: defaults and --color, --width, --spacing overrides', async ({ page }) => {
  const { frame } = await openExample(page);
  const def = await hostStyle(frame.locator('#demo-horizontal'));
  // Custom property values are computed with the theme tokens substituted.
  expect([def.color, def.width, def.spacing]).toEqual(['#e4e4e7', '1px', '1rem']);
  const custom = await hostStyle(frame.locator('#demo-custom'));
  expect(custom).toMatchObject({ display: 'block', borderTop: '4px solid rgb(217, 119, 6)', margin: '32px 0px' });
  const customVertical = await frame.locator('div > sl-divider[vertical]').last().evaluate(el => {
    const cs = getComputedStyle(el);
    return { border: `${cs.borderLeftWidth} ${cs.borderLeftStyle} ${cs.borderLeftColor}`, margin: cs.margin };
  });
  expect(customVertical).toEqual({ border: '4px solid rgb(217, 119, 6)', margin: '0px 32px' });
  // The component declares the properties on :host, so its own defaults win over ancestors (same as Shoelace).
  const inherited = await frame.locator('body').evaluate(async () => {
    const wrap = document.createElement('div');
    wrap.style.cssText = '--color: rgb(1, 2, 3); --width: 5px; --spacing: 40px';
    const el = document.createElement('sl-divider');
    wrap.append(el);
    document.body.append(wrap);
    await el.updateComplete;
    const cs = getComputedStyle(el);
    const out = { border: `${cs.borderTopWidth} ${cs.borderTopColor}`, margin: cs.marginTop };
    wrap.remove();
    return out;
  });
  expect(inherited).toEqual({ border: '1px rgb(228, 228, 231)', margin: '16px' });
});

test('core divider attributes do not change the layout: orientation, inset, align-content and presentation are neutralized', async ({ page }) => {
  const { frame } = await openExample(page);
  const result = await frame.locator('body').evaluate(async () => {
    const make = attrs => {
      const el = document.createElement('sl-divider');
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      document.body.append(el);
      return el;
    };
    const els = {
      plain: make({}),
      orientation: make({ orientation: 'vertical' }),
      inset: make({ inset: '' }),
      both: make({ orientation: 'vertical', inset: '', 'align-content': 'start' }),
      presentation: make({ presentation: '' }),
    };
    await Promise.all(Object.values(els).map(el => el.updateComplete));
    const out = {};
    for (const [key, el] of Object.entries(els)) {
      const cs = getComputedStyle(el);
      out[key] = {
        display: cs.display,
        width: Math.round(el.getBoundingClientRect().width),
        height: el.getBoundingClientRect().height,
        padding: cs.padding,
        minHeight: cs.minHeight,
        role: el.getAttribute('role'),
        orientation: el.getAttribute('aria-orientation'),
        shadow: el.shadowRoot.querySelectorAll('*').length,
      };
    }
    Object.values(els).forEach(el => el.remove());
    return out;
  });
  const same = { display: 'block', padding: '0px', minHeight: '0px', role: 'separator', orientation: 'horizontal', shadow: 0, height: 1 };
  for (const key of ['plain', 'orientation', 'inset', 'both', 'presentation']) {
    expect(result[key], key).toMatchObject(same);
    expect(result[key].width, key).toBe(result.plain.width);
  }
});

test('a role set by the author is replaced by separator on connect (Shoelace behavior) and hidden is honored', async ({ page }) => {
  const { frame } = await openExample(page);
  const result = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-divider');
    el.setAttribute('role', 'presentation');
    document.body.append(el);
    await el.updateComplete;
    const out = { role: el.getAttribute('role'), shown: getComputedStyle(el).display };
    el.hidden = true;
    await el.updateComplete;
    out.hidden = getComputedStyle(el).display;
    el.remove();
    return out;
  });
  expect(result).toEqual({ role: 'separator', shown: 'block', hidden: 'none' });
});

test('no upstream Shoelace runtime is requested or defined; all requests stay on the local origin', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  const defined = await frame.locator('body').evaluate(() => ['sl-dialog', 'sl-icon-button'].filter(tag => customElements.get(tag)));
  expect(defined).toEqual([]);
  expect(await frame.locator('body').evaluate(() => Boolean(window.Shoelace || document.querySelector('script[src*="shoelace"]')))).toBe(false);
});
