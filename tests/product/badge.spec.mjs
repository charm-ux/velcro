import { expect, test } from '@playwright/test';

const PAGE = '/components/badge';

async function openExample(page) {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  // Litro's client router remounts the page component once after load, which reloads the iframe; wait for it to settle.
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  const frame = page.frameLocator('iframe.example');
  await expect(frame.locator('#demo-default')).toBeVisible();
  await frame.locator('#demo-default').evaluate(() => customElements.whenDefined('sl-badge'));
  await page.waitForLoadState('networkidle');
  return { frame, requests };
}

const baseOf = locator =>
  locator.evaluate(el => {
    const node = el.shadowRoot.querySelector('[part~="base"]');
    const cs = getComputedStyle(node);
    return {
      classes: node.classList.value.trim(),
      role: node.getAttribute('role'),
      background: cs.backgroundColor,
      color: cs.color,
      borderRadius: cs.borderRadius,
      border: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      padding: cs.padding,
      display: cs.display,
      whiteSpace: cs.whiteSpace,
      animationName: cs.animationName,
      animationDuration: cs.animationDuration,
      animationIterationCount: cs.animationIterationCount,
    };
  });

test('docs page is prerendered with Velcro branding, prototype status and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Badge - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('without changing the shared core prefix');
  expect(html).not.toContain('not isolated from core');
  expect(html).toContain('prefers-reduced-motion');
  expect(html).toContain('no RTL or localization check');
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
  const home = await (await request.get('/')).text();
  expect(home).toContain('/components/badge');
});

test('sl-badge registers inside the example document (the docs page registers its own copy separately), as the exported class, and no core ch-badge element is defined', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  // The docs page loads the same runtime through its client entry (app-main.ts) into its own, separate registry.
  expect(await page.evaluate(() => customElements.whenDefined('sl-badge').then(ctor => typeof ctor))).toBe('function');
  const info = await frame.locator('body').evaluate(() => {
    const ctor = customElements.get('sl-badge');
    return {
      defined: ctor !== undefined,
      baseName: ctor?.baseName,
      coreTag: customElements.get('ch-badge') !== undefined,
      viaConstructor: ctor ? new ctor().localName : null,
    };
  });
  expect(info).toEqual({ defined: true, baseName: 'badge', coreTag: false, viaConstructor: 'sl-badge' });
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
});

test('semantics: one status base part with a default slot, no other parts, and Shoelace class names', async ({ page }) => {
  const { frame } = await openExample(page);
  await expect(frame.getByRole('status')).toHaveCount(7);
  const info = await frame.locator('#demo-default').evaluate(el => ({
    parts: [...el.shadowRoot.querySelectorAll('[part]')].map(n => n.getAttribute('part')),
    tag: el.shadowRoot.querySelector('[part~="base"]').localName,
    role: el.shadowRoot.querySelector('[part~="base"]').getAttribute('role'),
    slots: [...el.shadowRoot.querySelectorAll('slot')].map(s => s.name),
    text: el.textContent.trim(),
    variant: el.variant,
    pill: el.pill,
    pulse: el.pulse,
    attrs: el.getAttributeNames().sort(),
    hostRole: el.getAttribute('role'),
  }));
  expect(info.parts).toEqual(['base']);
  expect([info.tag, info.role, info.slots, info.text]).toEqual(['span', 'status', [''], 'Primary']);
  expect([info.variant, info.pill, info.pulse]).toEqual(['primary', false, false]);
  expect(info.hostRole).toBeNull();
  // Only the reflected variant exists besides the id (no role on the host; core's scoping attribute is not set).
  expect(info.attrs).toEqual(['id', 'variant']);
  expect(await baseOf(frame.locator('#demo-default')).then(b => b.classes)).toBe('badge badge--primary');
  expect(await baseOf(frame.locator('#demo-pill')).then(b => b.classes)).toBe('badge badge--primary badge--pill');
  expect(await baseOf(frame.locator('#demo-pulse')).then(b => b.classes)).toBe('badge badge--danger badge--pulse');
});

test('variant colors: each variant draws its theme token background with white text and a white border', async ({ page }) => {
  const { frame } = await openExample(page);
  const expected = {
    default: 'rgb(2, 132, 199)',
    success: 'rgb(22, 163, 74)',
    neutral: 'rgb(82, 82, 91)',
    warning: 'rgb(217, 119, 6)',
    danger: 'rgb(220, 38, 38)',
  };
  for (const [id, background] of Object.entries(expected)) {
    const base = await baseOf(frame.locator(`#demo-${id}`));
    expect(base.background, id).toBe(background);
    expect(base.color, id).toBe('rgb(255, 255, 255)');
    expect(base.border, id).toBe('1px solid rgb(255, 255, 255)');
    expect(base.role, id).toBe('status');
  }
});

test('shape and typography: square 3px radius by default, pill radius, content-sized padding in em and nowrap', async ({ page }) => {
  const { frame } = await openExample(page);
  const def = await baseOf(frame.locator('#demo-default'));
  expect(def.borderRadius).toBe('3px');
  expect((await baseOf(frame.locator('#demo-pill'))).borderRadius).toBe('9999px');
  // font-size is max(12px, 0.75em) of a 16px body = 12px; padding 0.35em 0.6em = 4.2px 7.2px.
  expect(def.fontSize).toBe('12px');
  expect(def.fontWeight).toBe('500');
  expect(def.padding).toBe('4.2px 7.2px');
  expect(def.whiteSpace).toBe('nowrap');
  // The example places the badge in a flex container, which blockifies the host and the base's display values.
  expect(def.display).toBe('flex');
  const standalone = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-badge');
    document.body.append(el);
    await el.updateComplete;
    const out = { host: getComputedStyle(el).display, base: getComputedStyle(el.shadowRoot.querySelector('[part~="base"]')).display };
    el.remove();
    return out;
  });
  expect(standalone).toEqual({ host: 'inline-flex', base: 'flex' });
  // The size follows the surrounding font size, with a 12px floor.
  const sizes = await frame.locator('body').evaluate(async () => {
    const out = [];
    for (const size of ['8px', '40px']) {
      const el = document.createElement('sl-badge');
      el.style.fontSize = size;
      el.textContent = '1';
      document.body.append(el);
      await el.updateComplete;
      out.push(getComputedStyle(el.shadowRoot.querySelector('[part~="base"]')).fontSize);
      el.remove();
    }
    return out;
  });
  expect(sizes).toEqual(['12px', '30px']);
});

test('dynamic updates: properties and attributes reflect to each other and re-render the base classes', async ({ page }) => {
  const { frame } = await openExample(page);
  const result = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-badge');
    el.textContent = 'New';
    document.body.append(el);
    await el.updateComplete;
    const read = () => ({
      classes: el.shadowRoot.querySelector('[part~="base"]').classList.value.trim(),
      variantAttr: el.getAttribute('variant'),
      pillAttr: el.hasAttribute('pill'),
      pulseAttr: el.hasAttribute('pulse'),
    });
    const steps = { initial: read() };
    el.variant = 'warning';
    el.pill = true;
    el.pulse = true;
    await el.updateComplete;
    steps.props = read();
    el.setAttribute('variant', 'success');
    el.removeAttribute('pill');
    await el.updateComplete;
    steps.attrs = read();
    el.variant = 'neutral';
    el.pulse = false;
    await el.updateComplete;
    steps.back = read();
    // Same as Shoelace: an unknown variant adds no variant class (and no validation).
    el.setAttribute('variant', 'bogus');
    await el.updateComplete;
    steps.unknown = read();
    el.textContent = 'Changed';
    await el.updateComplete;
    steps.text = el.shadowRoot.querySelector('slot').assignedNodes().map(n => n.textContent).join('');
    el.remove();
    return steps;
  });
  expect(result.initial).toEqual({ classes: 'badge badge--primary', variantAttr: 'primary', pillAttr: false, pulseAttr: false });
  expect(result.props).toEqual({ classes: 'badge badge--warning badge--pill badge--pulse', variantAttr: 'warning', pillAttr: true, pulseAttr: true });
  expect(result.attrs).toEqual({ classes: 'badge badge--pulse badge--success', variantAttr: 'success', pillAttr: false, pulseAttr: true });
  expect(result.back).toEqual({ classes: 'badge badge--neutral', variantAttr: 'neutral', pillAttr: false, pulseAttr: false });
  expect(result.unknown.classes).toBe('badge');
  expect(result.text).toBe('Changed');
});

test('pulse: animates the box-shadow with the Velcro keyframes and per-variant pulse color; static badges do not animate', async ({ page }) => {
  const { frame } = await openExample(page);
  const result = await frame.locator('#demo-pulse').evaluate(async el => {
    const base = el.shadowRoot.querySelector('[part~="base"]');
    const [animation] = base.getAnimations();
    await new Promise(resolve => setTimeout(resolve, 200));
    const cs = getComputedStyle(base);
    return {
      count: base.getAnimations().length,
      name: animation.animationName,
      state: animation.playState,
      advanced: animation.currentTime > 0,
      keyframes: animation.effect.getKeyframes().map(f => f.offset),
      duration: cs.animationDuration,
      iterations: cs.animationIterationCount,
      pulseColor: cs.getPropertyValue('--pulse-color').trim(),
    };
  });
  expect(result).toMatchObject({ count: 1, name: 'velcro-badge-pulse', state: 'running', advanced: true, duration: '1.5s', iterations: 'infinite' });
  expect(result.keyframes).toEqual([0, 0.7, 1]);
  expect(result.pulseColor).toBe('#dc2626'); // the custom property keeps the theme token's raw value
  expect(await frame.locator('#demo-default').evaluate(el => el.shadowRoot.querySelector('[part~="base"]').getAnimations().length)).toBe(0);
});

test.describe('prefers-reduced-motion: reduce', () => {
  test.use({ reducedMotion: 'reduce' });

  // Parity, not an accessibility endorsement: Shoelace 2.20.1's badge has no reduced-motion rule, and neither does
  // this one, so under the emulated preference the pulse keeps running. A future change must be deliberate.
  test('the pulse keeps its Shoelace animation (no reduced-motion rule is implemented)', async ({ page }) => {
    const { frame } = await openExample(page);
    expect(await frame.locator('body').evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    const base = await baseOf(frame.locator('#demo-pulse'));
    expect(base.animationName).toBe('velcro-badge-pulse');
    expect(base.animationDuration).toBe('1.5s');
  });
});

test('slotted content, host styling overrides and hidden', async ({ page }) => {
  const { frame } = await openExample(page);
  const result = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-badge');
    el.innerHTML = '<b>1</b> <i>new</i>';
    el.style.cursor = 'pointer';
    document.body.append(el);
    await el.updateComplete;
    const base = el.shadowRoot.querySelector('[part~="base"]');
    const out = {
      assigned: el.shadowRoot.querySelector('slot').assignedElements().map(n => n.localName),
      cursor: getComputedStyle(base).cursor,
      userSelect: getComputedStyle(base).userSelect,
      shown: getComputedStyle(el).display,
    };
    el.hidden = true;
    await el.updateComplete;
    out.hidden = getComputedStyle(el).display;
    el.remove();
    return out;
  });
  expect(result).toEqual({ assigned: ['b', 'i'], cursor: 'pointer', userSelect: 'none', shown: 'inline-flex', hidden: 'none' });
  // ::part styling from the page reaches the base part.
  const styled = await frame.locator('body').evaluate(async () => {
    const style = document.createElement('style');
    style.textContent = 'sl-badge#part-test::part(base) { background-color: rgb(1, 2, 3); }';
    document.head.append(style);
    const el = document.createElement('sl-badge');
    el.id = 'part-test';
    document.body.append(el);
    await el.updateComplete;
    const value = getComputedStyle(el.shadowRoot.querySelector('[part~="base"]')).backgroundColor;
    el.remove();
    style.remove();
    return value;
  });
  expect(styled).toBe('rgb(1, 2, 3)');
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
