import { expect, test } from '@playwright/test';

const PAGE = '/components/skeleton';

async function openExample(page, name = 'Overview', readyId = '#demo-avatar') {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  // Litro's client router remounts the page component once after load, which reloads the iframes; wait for it to settle.
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  const frame = page.frameLocator(`iframe.example[title="Skeleton example: ${name}"]`);
  await expect(frame.locator(readyId)).toBeAttached();
  await frame.locator(readyId).evaluate(() => customElements.whenDefined('sl-skeleton'));
  await page.waitForLoadState('networkidle');
  return { frame, requests };
}

const inner = (locator, part) =>
  locator.evaluate((el, p) => {
    const node = el.shadowRoot.querySelector(`[part~="${p}"]`);
    const cs = getComputedStyle(node);
    return {
      classes: node.classList.value.trim(),
      background: cs.backgroundColor,
      backgroundImage: cs.backgroundImage,
      backgroundSize: cs.backgroundSize,
      borderRadius: cs.borderRadius,
      display: cs.display,
      minHeight: cs.minHeight,
      animationName: cs.animationName,
      animationDuration: cs.animationDuration,
      animationDelay: cs.animationDelay,
      animationIterationCount: cs.animationIterationCount,
      animationTimingFunction: cs.animationTimingFunction,
      clipPath: cs.clipPath,
    };
  }, part);

test('docs page is prerendered with Velcro branding, prototype status, the Shoelace sections and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Skeleton - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Not implemented or unverified');
  for (const heading of ['Effects', 'Paragraphs', 'Avatars', 'Custom shapes', 'Custom colors']) expect(html).toContain(heading);
  expect(html).toContain('without changing the shared core prefix');
  expect(html).toContain('prefers-reduced-motion');
  expect(html).toContain('no Firefox, WebKit, RTL or localization check');
  expect(html).toContain('<code>indicator</code>');
  expect(html).toContain('inherits the core <code>ready</code> event');
  expect(html).toContain('It does not bubble, is not composed');
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
});

test('sl-skeleton registers inside the example documents (the docs page registers its own copy separately), as the exported class, and no core ch-skeleton element is defined', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  // The docs page loads the same runtime through its client entry (app-main.ts) into its own, separate registry.
  expect(await page.evaluate(() => customElements.whenDefined('sl-skeleton').then(ctor => typeof ctor))).toBe('function');
  const info = await frame.locator('body').evaluate(() => {
    const ctor = customElements.get('sl-skeleton');
    return {
      defined: ctor !== undefined,
      baseName: ctor?.baseName,
      coreTag: customElements.get('ch-skeleton') !== undefined,
      viaConstructor: ctor ? new ctor().localName : null,
    };
  });
  expect(info).toEqual({ defined: true, baseName: 'skeleton', coreTag: false, viaConstructor: 'sl-skeleton' });
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
});

test('structure: base and indicator parts only, no slots, no ARIA, Shoelace class names, core markup replaced', async ({ page }) => {
  const { frame } = await openExample(page);
  const info = await frame.locator('#demo-line-1').evaluate(el => {
    const base = el.shadowRoot.querySelector('[part~="base"]');
    const indicator = el.shadowRoot.querySelector('[part~="indicator"]');
    return {
      parts: [...el.shadowRoot.querySelectorAll('[part]')].map(n => n.getAttribute('part')),
      tags: [base.localName, indicator.localName],
      nested: indicator.parentElement === base,
      classes: [base.className.trim(), indicator.className.trim()],
      slots: el.shadowRoot.querySelectorAll('slot').length,
      shadowAria: [...el.shadowRoot.querySelectorAll('*')].flatMap(n => n.getAttributeNames().filter(a => a === 'role' || a.startsWith('aria-'))),
      hostAttrs: el.getAttributeNames().sort(),
      effect: el.effect,
      coreShape: el.shadowRoot.querySelector('.skeleton-rect, .skeleton-circle'),
      coreBase: el.shadowRoot.querySelector('[part~="skeleton-base"]'),
    };
  });
  expect(info).toEqual({
    parts: ['base', 'indicator'],
    tags: ['div', 'div'],
    nested: true,
    classes: ['skeleton', 'skeleton__indicator'],
    slots: 0,
    shadowAria: [],
    hostAttrs: ['id'],
    effect: 'none',
    coreShape: null,
    coreBase: null,
  });
});

test('default styles: block host, 1rem minimum height, neutral-200 pill indicator, no animation and no core border or clipping', async ({ page }) => {
  const { frame } = await openExample(page);
  const info = await frame.locator('#demo-line-1').evaluate(el => {
    const cs = getComputedStyle(el);
    return { display: cs.display, position: cs.position, overflow: cs.overflow, height: el.getBoundingClientRect().height };
  });
  expect(info).toEqual({ display: 'block', position: 'relative', overflow: 'visible', height: 16 });
  const base = await inner(frame.locator('#demo-line-1'), 'base');
  expect(base).toMatchObject({ display: 'flex', minHeight: '16px', classes: 'skeleton' });
  const indicator = await inner(frame.locator('#demo-line-1'), 'indicator');
  expect(indicator).toMatchObject({
    background: 'rgb(228, 228, 231)',
    borderRadius: '9999px',
    animationName: 'none',
    backgroundImage: 'none',
    classes: 'skeleton__indicator',
  });
  const border = await frame.locator('#demo-line-1').evaluate(el => getComputedStyle(el.shadowRoot.querySelector('[part~="base"]')).borderTopWidth);
  expect(border).toBe('0px');
});

test('overview layout: example CSS sizes the hosts and the indicator fills them', async ({ page }) => {
  const { frame } = await openExample(page);
  const box = async id => frame.locator(id).boundingBox();
  const avatar = await box('#demo-avatar');
  expect([avatar.width, avatar.height]).toEqual([48, 48]);
  const indicator = await frame.locator('#demo-avatar').evaluate(el => {
    const r = el.shadowRoot.querySelector('[part~="indicator"]').getBoundingClientRect();
    return [r.width, r.height];
  });
  expect(indicator).toEqual([48, 48]);
  const container = await frame.locator('.skeleton-overview').boundingBox();
  const line2 = await box('#demo-line-2');
  const line3 = await box('#demo-line-3');
  expect(line2.width).toBeCloseTo(container.width * 0.95, 0);
  expect(line3.width).toBeCloseTo(container.width * 0.8, 0);
});

test('effects: none is static, sheen draws the gradient with the Velcro keyframes, pulse fades the indicator', async ({ page }) => {
  const { frame } = await openExample(page, 'Effects', '#demo-none');
  const none = await inner(frame.locator('#demo-none'), 'indicator');
  expect(none).toMatchObject({ animationName: 'none', backgroundImage: 'none', background: 'rgb(228, 228, 231)' });
  expect((await inner(frame.locator('#demo-none'), 'base')).classes).toBe('skeleton');

  const sheen = await inner(frame.locator('#demo-sheen'), 'indicator');
  expect((await inner(frame.locator('#demo-sheen'), 'base')).classes).toBe('skeleton skeleton--sheen');
  expect(sheen).toMatchObject({ animationName: 'velcro-skeleton-sheen', animationDuration: '8s', animationIterationCount: 'infinite', background: expect.any(String) });
  expect(sheen.backgroundImage).toBe(
    'linear-gradient(270deg, rgb(212, 212, 216), rgb(228, 228, 231), rgb(228, 228, 231), rgb(212, 212, 216))'
  );
  expect(sheen.backgroundSize).toBe('400% 100%');

  const pulse = await inner(frame.locator('#demo-pulse'), 'indicator');
  expect((await inner(frame.locator('#demo-pulse'), 'base')).classes).toBe('skeleton skeleton--pulse');
  expect(pulse).toMatchObject({
    animationName: 'velcro-skeleton-pulse',
    animationDuration: '2s',
    animationDelay: '0.5s',
    animationIterationCount: 'infinite',
    animationTimingFunction: 'ease-in-out',
    backgroundImage: 'none',
  });

  const keyframes = await frame.locator('body').evaluate(async () => {
    const out = {};
    for (const id of ['sheen', 'pulse']) {
      const indicator = document.querySelector(`#demo-${id}`).shadowRoot.querySelector('[part~="indicator"]');
      const [animation] = indicator.getAnimations();
      await animation.ready;
      out[id] = {
        count: indicator.getAnimations().length,
        state: animation.playState,
        frames: animation.effect.getKeyframes().map(f => ({ offset: f.offset, opacity: f.opacity, position: `${f.backgroundPositionX} ${f.backgroundPositionY}` })),
      };
    }
    return out;
  });
  expect(keyframes.sheen.count).toBe(1);
  expect(keyframes.sheen.state).toBe('running');
  expect(keyframes.sheen.frames.map(f => [f.offset, f.position])).toEqual([
    [0, '200% 0px'],
    [1, '-200% 0px'],
  ]);
  expect(keyframes.pulse.state).toBe('running');
  expect(keyframes.pulse.frames.map(f => [f.offset, f.opacity])).toEqual([
    [0, '1'],
    [0.5, '0.4'],
    [1, '1'],
  ]);
  expect(await frame.locator('#demo-none').evaluate(el => el.shadowRoot.querySelector('[part~="indicator"]').getAnimations().length)).toBe(0);
});

test('effect property: not reflected, updates the classes, and an unknown value is static', async ({ page }) => {
  const { frame } = await openExample(page);
  const result = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-skeleton');
    document.body.append(el);
    await el.updateComplete;
    const read = () => ({
      classes: el.shadowRoot.querySelector('[part~="base"]').className.trim(),
      attr: el.getAttribute('effect'),
      prop: el.effect,
    });
    const steps = { initial: read() };
    el.effect = 'sheen';
    await el.updateComplete;
    steps.prop = read();
    el.setAttribute('effect', 'pulse');
    await el.updateComplete;
    steps.attr = read();
    el.setAttribute('effect', 'bogus');
    await el.updateComplete;
    steps.unknown = read();
    el.removeAttribute('effect');
    await el.updateComplete;
    steps.removed = read();
    // The inherited core properties do not drive the Shoelace markup.
    el.setAttribute('animation', 'wave');
    el.setAttribute('shape', 'circle');
    await el.updateComplete;
    steps.core = { ...read(), parts: [...el.shadowRoot.querySelectorAll('[part]')].map(n => n.getAttribute('part')) };
    el.remove();
    return steps;
  });
  expect(result.initial).toEqual({ classes: 'skeleton', attr: null, prop: 'none' });
  expect(result.prop).toEqual({ classes: 'skeleton skeleton--sheen', attr: null, prop: 'sheen' });
  expect(result.attr).toEqual({ classes: 'skeleton skeleton--pulse', attr: 'pulse', prop: 'pulse' });
  expect(result.unknown).toEqual({ classes: 'skeleton', attr: 'bogus', prop: 'bogus' });
  expect(result.removed.classes).toBe('skeleton');
  expect(result.core.classes).toBe('skeleton');
  expect(result.core.parts).toEqual(['base', 'indicator']);
});

test('inherited core ready event: fires once on the element after its first update, does not bubble and is not composed', async ({ page }) => {
  const { frame } = await openExample(page);
  const result = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-skeleton');
    const own = [];
    const onParent = [];
    el.addEventListener('ready', event => own.push({
      type: event.type,
      target: event.target === el,
      bubbles: event.bubbles,
      composed: event.composed,
      cancelable: event.cancelable,
      detail: event.detail,
      rendered: Boolean(el.shadowRoot?.querySelector('[part~="base"]')),
    }));
    document.body.addEventListener('ready', event => onParent.push(event.target.localName));
    document.addEventListener('ready', event => onParent.push(event.target.localName));
    const before = own.length;
    document.body.append(el);
    await el.updateComplete;
    el.effect = 'pulse';
    await el.updateComplete;
    el.remove();
    document.body.append(el);
    await el.updateComplete;
    return { before, own, onParent, total: own.length };
  });
  expect(result.before).toBe(0);
  expect(result.total).toBe(1);
  expect(result.own).toEqual([{ type: 'ready', target: true, bubbles: false, composed: false, cancelable: false, detail: {}, rendered: true }]);
  expect(result.onParent).toEqual([]);
});

test('paragraphs: the example widths apply to the hosts', async ({ page }) => {
  const { frame } = await openExample(page, 'Paragraphs', '.skeleton-paragraphs');
  const widths = await frame.locator('.skeleton-paragraphs sl-skeleton').evaluateAll(els => els.map(el => el.getBoundingClientRect().width));
  const container = await frame.locator('.skeleton-paragraphs').boundingBox();
  expect(widths).toHaveLength(5);
  const ratios = widths.map(w => Math.round((w / container.width) * 100));
  expect(ratios).toEqual([100, 95, 100, 90, 50]);
});

test('avatars: --border-radius on the host reaches the indicator (square, rounded, default pill)', async ({ page }) => {
  const { frame } = await openExample(page, 'Avatars', '#demo-av-sq');
  expect((await inner(frame.locator('#demo-av-sq'), 'indicator')).borderRadius).toBe('0px');
  expect((await inner(frame.locator('#demo-av-rounded'), 'indicator')).borderRadius).toBe('4px');
  expect((await inner(frame.locator('#demo-av-circle'), 'indicator')).borderRadius).toBe('9999px');
  const box = await frame.locator('#demo-av-circle').boundingBox();
  expect([box.width, box.height]).toEqual([48, 48]);
  expect(await frame.locator('#demo-av-circle').evaluate(el => getComputedStyle(el).display)).toBe('inline-block');
});

test('custom shapes: ::part(indicator) overrides --border-radius and applies clip-path', async ({ page }) => {
  const { frame } = await openExample(page, 'Custom shapes', '#demo-square');
  expect((await inner(frame.locator('#demo-square'), 'indicator')).borderRadius).toBe('4px');
  expect((await inner(frame.locator('#demo-circle'), 'indicator')).borderRadius).toBe('50%');
  const triangle = await inner(frame.locator('#demo-triangle'), 'indicator');
  expect(triangle.borderRadius).toBe('0px');
  expect(triangle.clipPath).toContain('polygon(');
  expect((await inner(frame.locator('#demo-cross'), 'indicator')).clipPath).toContain('polygon(');
  expect((await inner(frame.locator('#demo-comment'), 'indicator')).clipPath).toContain('polygon(');
  expect((await inner(frame.locator('#demo-square'), 'indicator')).clipPath).toBe('none');
  const box = await frame.locator('#demo-triangle').boundingBox();
  expect([box.width, box.height]).toEqual([50, 50]);
});

test('custom colors: --color and --sheen-color on the host drive the sheen gradient', async ({ page }) => {
  const { frame } = await openExample(page, 'Custom colors', '#demo-colors');
  const indicator = await inner(frame.locator('#demo-colors'), 'indicator');
  expect(indicator.backgroundImage).toBe('linear-gradient(270deg, rgb(255, 176, 148), rgb(255, 99, 71), rgb(255, 99, 71), rgb(255, 176, 148))');
  const solid = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-skeleton');
    el.style.setProperty('--color', 'rgb(1, 2, 3)');
    document.body.append(el);
    await el.updateComplete;
    const own = getComputedStyle(el.shadowRoot.querySelector('[part~="indicator"]')).backgroundColor;
    el.remove();
    // The component declares the properties on :host, so values inherited from an ancestor do not win over its defaults.
    const wrap = document.createElement('div');
    wrap.style.cssText = '--color: rgb(9, 9, 9)';
    const nested = document.createElement('sl-skeleton');
    wrap.append(nested);
    document.body.append(wrap);
    await nested.updateComplete;
    const inherited = getComputedStyle(nested.shadowRoot.querySelector('[part~="indicator"]')).backgroundColor;
    wrap.remove();
    return { own, inherited };
  });
  expect(solid).toEqual({ own: 'rgb(1, 2, 3)', inherited: 'rgb(228, 228, 231)' });
});

test('hidden attribute hides the host and ::part styling from the page reaches both parts', async ({ page }) => {
  const { frame } = await openExample(page);
  const result = await frame.locator('body').evaluate(async () => {
    const style = document.createElement('style');
    style.textContent = 'sl-skeleton#part-test::part(base) { min-height: 3rem; } sl-skeleton#part-test::part(indicator) { background: rgb(1, 2, 3); }';
    document.head.append(style);
    const el = document.createElement('sl-skeleton');
    el.id = 'part-test';
    document.body.append(el);
    await el.updateComplete;
    const out = {
      minHeight: getComputedStyle(el.shadowRoot.querySelector('[part~="base"]')).minHeight,
      background: getComputedStyle(el.shadowRoot.querySelector('[part~="indicator"]')).backgroundColor,
    };
    el.hidden = true;
    await el.updateComplete;
    out.hidden = getComputedStyle(el).display;
    el.remove();
    style.remove();
    return out;
  });
  expect(result).toEqual({ minHeight: '48px', background: 'rgb(1, 2, 3)', hidden: 'none' });
});

test.describe('prefers-reduced-motion: reduce', () => {
  test.use({ reducedMotion: 'reduce' });

  // Parity, not an accessibility endorsement: Shoelace 2.20.1's skeleton has no reduced-motion rule, and neither does
  // this one, so under the emulated preference the effects keep running. A future change must be deliberate.
  test('sheen and pulse keep their Shoelace animations (no reduced-motion rule is implemented)', async ({ page }) => {
    const { frame } = await openExample(page, 'Effects', '#demo-none');
    expect(await frame.locator('body').evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    expect((await inner(frame.locator('#demo-sheen'), 'indicator')).animationName).toBe('velcro-skeleton-sheen');
    expect((await inner(frame.locator('#demo-pulse'), 'indicator')).animationName).toBe('velcro-skeleton-pulse');
  });
});

test.describe('forced colors', () => {
  test.use({ forcedColors: 'active' });

  test('the indicator color is the GrayText system color', async ({ page }) => {
    const { frame } = await openExample(page);
    expect(await frame.locator('body').evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
    const result = await frame.locator('body').evaluate(() => {
      const probe = document.createElement('span');
      probe.style.color = 'GrayText';
      document.body.append(probe);
      const gray = getComputedStyle(probe).color;
      probe.remove();
      const indicator = document.querySelector('#demo-line-1').shadowRoot.querySelector('[part~="indicator"]');
      return { gray, background: getComputedStyle(indicator).backgroundColor };
    });
    expect(result.background).toBe(result.gray);
  });
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
