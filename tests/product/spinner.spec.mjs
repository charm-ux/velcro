import { expect, test } from '@playwright/test';

const PAGE = '/components/spinner';

async function openExample(page) {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  // Litro's client router remounts the page component once after load, which reloads the iframe; wait for it to settle.
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  const frame = page.frameLocator('iframe.example');
  await expect(frame.locator('#demo-default')).toBeVisible();
  await frame.locator('#demo-default').evaluate(() => customElements.whenDefined('sl-spinner'));
  await page.waitForLoadState('networkidle');
  return { frame, requests };
}

const styleOf = (locator, selector) =>
  locator.evaluate((el, sel) => {
    const node = el.shadowRoot.querySelector(sel);
    const cs = getComputedStyle(node);
    return {
      stroke: cs.stroke,
      strokeWidth: cs.strokeWidth,
      r: cs.r,
      cx: cs.cx,
      animationName: cs.animationName,
      animationDuration: cs.animationDuration,
      animationPlayState: cs.animationPlayState,
      transform: cs.transform,
      rotate: cs.rotate,
    };
  }, selector);

test('docs page is prerendered with Velcro branding, prototype status and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Spinner - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('localizes it through its localization controller');
  expect(html).toContain('prefers-reduced-motion');
  expect(html).toContain('fails when it is created, even when it is the only Charm library on the page');
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
  const home = await (await request.get('/')).text();
  expect(home).toContain('/components/spinner');
});

test('sl-spinner registers inside the example document, and separately in the docs page through the client entry', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  // The docs page loads the same runtime through its client entry (app-main.ts) into its own, separate registry.
  expect(await page.evaluate(() => customElements.whenDefined('sl-spinner').then(ctor => typeof ctor))).toBe('function');
  expect(await frame.locator('body').evaluate(() => customElements.get('sl-spinner') !== undefined)).toBe(true);
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
});

test('accessible loading semantics: one indeterminate progressbar named "Loading" per spinner, public base part only', async ({ page }) => {
  const { frame } = await openExample(page);
  const bars = frame.getByRole('progressbar', { name: 'Loading' });
  await expect(bars).toHaveCount(3);
  const info = await frame.locator('#demo-default').evaluate(el => {
    const base = el.shadowRoot.querySelector('[part~="base"]');
    return {
      parts: [...el.shadowRoot.querySelectorAll('[part]')].map(n => n.getAttribute('part')),
      // Shoelace's shadow DOM: svg.spinner around circle.spinner__track and circle.spinner__indicator (its own test queries the class).
      structure: [base.getAttribute('class'), ...[...base.children].map(n => `${n.localName}.${n.getAttribute('class')}`)],
      tag: base.localName,
      role: base.getAttribute('role'),
      label: base.getAttribute('aria-label'),
      valueNow: base.getAttribute('aria-valuenow'),
      slots: el.shadowRoot.querySelectorAll('slot').length,
      hostRole: el.getAttribute('role'),
      focusable: el.tabIndex,
    };
  });
  expect(info).toEqual({ parts: ['base'], structure: ['spinner', 'circle.spinner__track', 'circle.spinner__indicator'], tag: 'svg', role: 'progressbar', label: 'Loading', valueNow: null, slots: 0, hostRole: null, focusable: -1 });
});

test('geometry: 1em square by default, follows font-size, and does not shrink in a flex container (flex: none)', async ({ page }) => {
  const { frame } = await openExample(page);
  const box = async id => frame.locator(id).boundingBox();
  const base = await frame.locator('body').evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
  const def = await box('#demo-default');
  expect([def.width, def.height]).toEqual([base, base]);
  const large = await box('#demo-large');
  expect([large.width, large.height]).toEqual([48, 48]);
  const result = await frame.locator('body').evaluate(async () => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;width:4px;font-size:32px';
    const el = document.createElement('sl-spinner');
    wrap.append(el);
    document.body.append(wrap);
    await el.updateComplete;
    const cs = getComputedStyle(el);
    const out = { flex: cs.flex, display: cs.display, width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height };
    wrap.remove();
    return out;
  });
  // As a flex item the computed display is blockified (inline-flex -> flex); the standalone value is checked below.
  expect(result).toEqual({ flex: '0 0 auto', display: 'flex', width: 32, height: 32 });
  const standalone = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-spinner');
    document.body.append(el);
    await el.updateComplete;
    const display = getComputedStyle(el).display;
    el.remove();
    return display;
  });
  expect(standalone).toBe('inline-flex');
});

test('ring geometry follows the track width and font-size (circle radius is 0.5em minus half the track width)', async ({ page }) => {
  const { frame } = await openExample(page);
  const def = await styleOf(frame.locator('#demo-default'), '.spinner__indicator');
  const base = await frame.locator('body').evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
  expect(def.strokeWidth).toBe('2px');
  expect(def.r).toBe(`${base / 2 - 1}px`);
  expect(def.cx).toBe(`${base / 2}px`);
  const large = await styleOf(frame.locator('#demo-large'), '.spinner__indicator');
  expect(large.r).toBe('23px');
  const custom = await styleOf(frame.locator('#demo-custom'), '.spinner__indicator');
  expect(custom.strokeWidth).toBe('6px');
  expect(custom.r).toBe('21px');
  const track = await styleOf(frame.locator('#demo-custom'), '.spinner__track');
  expect(track.r).toBe('21px');
});

test('CSS custom properties: defaults, and --track-width, --track-color, --indicator-color, --speed overrides', async ({ page }) => {
  const { frame } = await openExample(page);
  const defIndicator = await styleOf(frame.locator('#demo-default'), '.spinner__indicator');
  const defTrack = await styleOf(frame.locator('#demo-default'), '.spinner__track');
  expect(defIndicator.stroke).toBe('rgb(2, 132, 199)'); // --sl-color-primary-600 from the light theme
  expect(defIndicator.animationDuration).toBe('2s');
  expect(defTrack.stroke).toBe('rgba(128, 128, 128, 0.25)');
  const custom = await styleOf(frame.locator('#demo-custom'), '.spinner__indicator');
  const customTrack = await styleOf(frame.locator('#demo-custom'), '.spinner__track');
  expect(custom.stroke).toBe('rgb(217, 119, 6)');
  expect(custom.animationDuration).toBe('3s');
  expect(customTrack.stroke).toBe('rgb(253, 230, 138)');
  // Overrides also work when inherited from an ancestor's custom properties, not only inline on the host.
  const inherited = await frame.locator('body').evaluate(async () => {
    const wrap = document.createElement('div');
    wrap.style.cssText = '--indicator-color: rgb(1, 2, 3); --speed: 750ms; --track-width: 4px';
    const el = document.createElement('sl-spinner');
    wrap.append(el);
    document.body.append(wrap);
    await el.updateComplete;
    const cs = getComputedStyle(el.shadowRoot.querySelector('.spinner__indicator'));
    const out = { stroke: cs.stroke, duration: cs.animationDuration, width: cs.strokeWidth };
    wrap.remove();
    return out;
  });
  // The component declares the properties on :host, so its own defaults win over ancestors (same as Shoelace).
  expect(inherited).toEqual({ stroke: 'rgb(2, 132, 199)', duration: '2s', width: '2px' });
});

test('indicator animates with transform: rotate (not the rotate property) and is running', async ({ page }) => {
  const { frame } = await openExample(page);
  const result = await frame.locator('#demo-default').evaluate(async el => {
    const indicator = el.shadowRoot.querySelector('.spinner__indicator');
    const [animation] = indicator.getAnimations();
    const frames = animation.effect.getKeyframes();
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      count: indicator.getAnimations().length,
      name: animation.animationName,
      state: animation.playState,
      keyframeTransforms: frames.map(f => f.transform),
      rotateProperty: getComputedStyle(indicator).rotate,
      advanced: animation.currentTime > 0,
    };
  });
  expect(result.count).toBe(1);
  expect(result.name).toBe('spin');
  expect(result.state).toBe('running');
  expect(result.keyframeTransforms).toEqual(['rotate(0deg)', 'rotate(450deg)', 'rotate(1080deg)']);
  expect(result.rotateProperty).toBe('none');
  expect(result.advanced).toBe(true);
});

test.describe('prefers-reduced-motion: reduce', () => {
  test.use({ reducedMotion: 'reduce' });

  // Parity, not an accessibility endorsement: Shoelace 2.20.1's spinner has no reduced-motion rule, and neither does
  // this one, so under the emulated preference the animation keeps running. A future change must be deliberate.
  test('the spinner keeps its Shoelace animation (no reduced-motion rule is implemented)', async ({ page }) => {
    const { frame } = await openExample(page);
    expect(await frame.locator('body').evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    const indicator = await styleOf(frame.locator('#demo-default'), '.spinner__indicator');
    expect(indicator.animationName).toBe('spin');
    expect(indicator.animationPlayState).toBe('running');
    expect(indicator.animationDuration).toBe('2s');
  });
});

test.describe('forced colors', () => {
  test.use({ forcedColors: 'active' });

  test('track and indicator use the GrayText and Highlight system colors', async ({ page }) => {
    const { frame } = await openExample(page);
    expect(await frame.locator('body').evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
    const system = await frame.locator('body').evaluate(() => {
      const probe = name => {
        const node = document.createElement('span');
        node.style.color = name;
        document.body.append(node);
        const value = getComputedStyle(node).color;
        node.remove();
        return value;
      };
      return { gray: probe('GrayText'), highlight: probe('Highlight') };
    });
    expect((await styleOf(frame.locator('#demo-default'), '.spinner__track')).stroke).toBe(system.gray);
    expect((await styleOf(frame.locator('#demo-default'), '.spinner__indicator')).stroke).toBe(system.highlight);
  });
});

test('dynamically created spinner renders, inherits nothing from core label properties and honors hidden', async ({ page }) => {
  const { frame } = await openExample(page);
  const result = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-spinner');
    el.setAttribute('label', 'Working');
    el.setAttribute('label-position', 'after');
    el.textContent = 'Slotted text';
    document.body.append(el);
    await el.updateComplete;
    const withLabel = {
      shadowText: el.shadowRoot.textContent.trim(),
      width: el.getBoundingClientRect().width,
      name: el.shadowRoot.querySelector('[part~="base"]').getAttribute('aria-label'),
    };
    // Core's `.spinner` flex wrapper rules (gap, label-position directions) must not reach Shoelace's `svg.spinner`.
    const leak = [];
    for (const position of ['before', 'after', 'above']) {
      el.setAttribute('label-position', position);
      await el.updateComplete;
      const cs = getComputedStyle(el.shadowRoot.querySelector('[part~="base"]'));
      leak.push([cs.gap, cs.flexDirection, cs.alignItems, cs.justifyContent]);
    }
    el.hidden = true;
    await el.updateComplete;
    const hidden = getComputedStyle(el).display;
    el.remove();
    return { withLabel, leak, hidden };
  });
  // The core label/label-position properties are inherited but have no effect (documented limitation).
  expect(result.withLabel.shadowText).toBe('');
  expect(result.withLabel.name).toBe('Loading');
  expect(result.withLabel.width).toBeGreaterThan(0);
  expect(result.leak).toEqual(Array(3).fill(['normal', 'row', 'normal', 'normal']));
  expect(result.hidden).toBe('none');
});

test('no upstream Shoelace runtime is requested or defined; all requests stay on the local origin', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  const defined = await frame.locator('body').evaluate(() => ['sl-icon', 'sl-dialog', 'sl-icon-button'].filter(tag => customElements.get(tag)));
  expect(defined).toEqual([]);
  expect(await frame.locator('body').evaluate(() => Boolean(window.Shoelace || document.querySelector('script[src*="shoelace"]')))).toBe(false);
});
