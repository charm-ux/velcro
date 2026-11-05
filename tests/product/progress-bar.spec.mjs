import { expect, test } from '@playwright/test';

const PAGE = '/components/progress-bar';

async function openExample(page) {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  // Litro's client router remounts the page component once after load, which reloads the iframe; wait for it to settle.
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  const frame = page.frameLocator('iframe.example');
  await expect(frame.locator('#demo-default')).toBeVisible();
  await frame.locator('#demo-default').evaluate(() => customElements.whenDefined('sl-progress-bar'));
  await page.waitForLoadState('networkidle');
  return { frame, requests };
}

const inspect = locator =>
  locator.evaluate(el => {
    const root = el.shadowRoot;
    const base = root.querySelector('[part~="base"]');
    const indicator = root.querySelector('[part~="indicator"]');
    const bs = getComputedStyle(base);
    const is = getComputedStyle(indicator);
    return {
      parts: [...root.querySelectorAll('[part]')].map(n => n.getAttribute('part')),
      role: base.getAttribute('role'),
      label: base.getAttribute('aria-label'),
      min: base.getAttribute('aria-valuemin'),
      max: base.getAttribute('aria-valuemax'),
      now: base.getAttribute('aria-valuenow'),
      classes: base.classList.value.trim(),
      hostDisplay: getComputedStyle(el).display,
      hostWidth: el.getBoundingClientRect().width,
      parentWidth: el.parentElement.getBoundingClientRect().width,
      height: bs.height,
      track: bs.backgroundColor,
      radius: bs.borderTopLeftRadius,
      overflow: bs.overflow,
      shadow: bs.boxShadow,
      indicatorColor: is.backgroundColor,
      indicatorWidth: indicator.getBoundingClientRect().width,
      baseWidth: base.getBoundingClientRect().width,
      labelColor: is.color,
      fontSize: is.fontSize,
      fontWeight: is.fontWeight,
      lineHeight: is.lineHeight,
      transition: is.transitionProperty + ' ' + is.transitionDuration,
      animationName: is.animationName,
      position: is.position,
    };
  });

test('docs page is prerendered with Velcro branding, prototype status and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Progress bar - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('localizes it through its localization controller');
  expect(html).toContain('prefers-reduced-motion');
  expect(html).toContain('sl-icon is not implemented');
  expect(html).toContain('--label-color');
  expect(html).toContain('fails when it is created, even when it is the only Charm library on the page');
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
});

test('sl-progress-bar registers inside the example document only, as the exported class', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  expect(await page.evaluate(() => customElements.get('sl-progress-bar'))).toBeUndefined();
  const info = await frame.locator('body').evaluate(() => {
    const ctor = customElements.get('sl-progress-bar');
    return { defined: ctor !== undefined, baseName: ctor?.baseName, coreTag: customElements.get('ch-progress-bar') !== undefined, viaConstructor: ctor ? new ctor().localName : null };
  });
  expect(info).toEqual({ defined: true, baseName: 'progress-bar', coreTag: false, viaConstructor: 'sl-progress-bar' });
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
});

test('semantics and parts: progressbar base with indicator and label parts, default name, 0-100 range', async ({ page }) => {
  const { frame } = await openExample(page);
  await expect(frame.getByRole('progressbar')).toHaveCount(6);
  const def = await inspect(frame.locator('#demo-default'));
  expect(def.parts).toEqual(['base', 'indicator', 'label']);
  expect([def.role, def.label, def.min, def.max, def.now]).toEqual(['progressbar', 'Progress', '0', '100', '50']);
  expect(def.classes).toBe('progress-bar');
  await expect(frame.getByRole('progressbar', { name: 'Upload progress' })).toHaveCount(1);
  const hostRole = await frame.locator('#demo-default').evaluate(el => ({ role: el.getAttribute('role'), tabIndex: el.tabIndex }));
  expect(hostRole).toEqual({ role: null, tabIndex: -1 });
  const slot = await frame.locator('#demo-values').evaluate(el => {
    const slotEl = el.shadowRoot.querySelector('slot');
    return { name: slotEl.name, part: slotEl.getAttribute('part'), assigned: slotEl.assignedNodes().map(n => n.textContent).join('') };
  });
  expect(slot).toEqual({ name: '', part: 'label', assigned: '50%' });
});

test('computed styles match Shoelace: block host, 1rem pill track, inset shadow, indicator width follows value', async ({ page }) => {
  const { frame } = await openExample(page);
  const def = await inspect(frame.locator('#demo-default'));
  expect(def.hostDisplay).toBe('block');
  expect(def.hostWidth).toBe(def.parentWidth);
  expect(def.height).toBe('16px');
  expect(def.track).toBe('rgb(228, 228, 231)');
  expect(def.radius).toBe('9999px');
  expect(def.overflow).toBe('hidden');
  expect(def.shadow).not.toBe('none');
  expect(def.shadow).toContain('inset');
  expect(def.indicatorColor).toBe('rgb(2, 132, 199)');
  expect(def.indicatorWidth).toBeCloseTo(def.baseWidth / 2, 0);
  expect(def.fontSize).toBe('12px');
  expect(def.fontWeight).toBe('400');
  expect(def.lineHeight).toBe('16px');
  expect(def.transition).toBe('width, background-color 0.4s, 0.4s');
  expect(def.labelColor).toBe('rgb(255, 255, 255)');
  expect(def.animationName).toBe('none');
  expect(def.position).toBe('static');
});

test('custom properties: --height, --track-color, --indicator-color, --label-color', async ({ page }) => {
  const { frame } = await openExample(page);
  const height = await inspect(frame.locator('#demo-height'));
  expect(height.height).toBe('6px');
  const colors = await inspect(frame.locator('#demo-colors'));
  expect(colors.track).toBe('rgb(253, 230, 138)');
  expect(colors.indicatorColor).toBe('rgb(217, 119, 6)');
  expect(colors.labelColor).toBe('rgb(255, 255, 255)');
  expect(colors.indicatorWidth).toBeCloseTo(colors.baseWidth * 0.75, 0);
  const label = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-progress-bar');
    el.style.setProperty('--label-color', 'rgb(1, 2, 3)');
    el.textContent = 'x';
    document.body.append(el);
    await el.updateComplete;
    const out = getComputedStyle(el.shadowRoot.querySelector('.progress-bar__indicator')).color;
    el.remove();
    return out;
  });
  expect(label).toBe('rgb(1, 2, 3)');
});

test('properties and attributes: defaults, reflection, and live updates of the rendered bar', async ({ page }) => {
  const { frame } = await openExample(page);
  const result = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-progress-bar');
    document.body.append(el);
    await el.updateComplete;
    const read = () => {
      const base = el.shadowRoot.querySelector('[part~="base"]');
      return { now: base.getAttribute('aria-valuenow'), label: base.getAttribute('aria-label'), width: el.shadowRoot.querySelector('[part~="indicator"]').style.width, slot: el.shadowRoot.querySelector('slot') !== null };
    };
    const out = { defaults: { value: el.value, indeterminate: el.indeterminate, rawLabel: el.label, ...read() }, attrs: [el.hasAttribute('value'), el.hasAttribute('indeterminate')] };
    el.value = 25;
    el.label = 'Saving';
    await el.updateComplete;
    out.afterProps = { reflected: el.getAttribute('value'), labelAttr: el.hasAttribute('label'), ...read() };
    el.setAttribute('value', '80');
    await el.updateComplete;
    out.afterAttr = { value: el.value, type: typeof el.value, ...read() };
    el.indeterminate = true;
    await el.updateComplete;
    out.indeterminate = { reflected: el.hasAttribute('indeterminate'), ...read(), animation: getComputedStyle(el.shadowRoot.querySelector('.progress-bar__indicator')).animationName, position: getComputedStyle(el.shadowRoot.querySelector('.progress-bar__indicator')).position };
    el.indeterminate = false;
    el.label = '';
    await el.updateComplete;
    out.restored = read();
    el.remove();
    return out;
  });
  expect(result.defaults).toEqual({ value: 0, indeterminate: false, rawLabel: '', now: '0', label: 'Progress', width: '0%', slot: true });
  expect(result.attrs).toEqual([true, false]);
  expect(result.afterProps).toEqual({ reflected: '25', labelAttr: false, now: '25', label: 'Saving', width: '25%', slot: true });
  expect(result.afterAttr).toEqual({ value: 80, type: 'number', now: '80', label: 'Saving', width: '80%', slot: true });
  expect(result.indeterminate).toEqual({ reflected: true, now: '0', label: 'Saving', width: '80%', slot: false, animation: 'velcro-progress-bar-indeterminate', position: 'absolute' });
  expect(result.restored).toMatchObject({ now: '80', label: 'Progress', slot: true });
});

test('indeterminate example: no label slot, running animation that moves the indicator, aria-valuenow 0', async ({ page }) => {
  const { frame } = await openExample(page);
  const info = await inspect(frame.locator('#demo-indeterminate'));
  expect(info.parts).toEqual(['base', 'indicator']);
  expect(info.now).toBe('0');
  expect(info.classes).toBe('progress-bar progress-bar--indeterminate');
  expect(info.animationName).toBe('velcro-progress-bar-indeterminate');
  const anim = await frame.locator('#demo-indeterminate').evaluate(async el => {
    const indicator = el.shadowRoot.querySelector('.progress-bar__indicator');
    const animations = indicator.getAnimations().filter(a => a.animationName);
    const first = indicator.getBoundingClientRect().left;
    await new Promise(resolve => setTimeout(resolve, 300));
    return { count: animations.length, state: animations[0].playState, moved: indicator.getBoundingClientRect().left !== first, frames: animations[0].effect.getKeyframes().map(f => f.left) };
  });
  expect(anim.count).toBe(1);
  expect(anim.state).toBe('running');
  expect(anim.moved).toBe(true);
  expect(anim.frames).toEqual(['-50%', '100%', '100%']);
});

test('rtl: the indeterminate bar uses the rtl keyframes', async ({ page }) => {
  const { frame } = await openExample(page);
  const result = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-progress-bar');
    el.setAttribute('dir', 'rtl');
    el.indeterminate = true;
    document.body.append(el);
    await el.updateComplete;
    const base = el.shadowRoot.querySelector('.progress-bar');
    const out = { classes: base.classList.value.trim(), name: getComputedStyle(base.firstElementChild).animationName };
    el.remove();
    return out;
  });
  expect(result).toEqual({ classes: 'progress-bar progress-bar--indeterminate progress-bar--rtl', name: 'velcro-progress-bar-indeterminate-rtl' });
});

test('title is forwarded to the base element', async ({ page }) => {
  const { frame } = await openExample(page);
  const result = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-progress-bar');
    el.title = 'Half way';
    document.body.append(el);
    await el.updateComplete;
    el.requestUpdate();
    await el.updateComplete;
    const out = el.shadowRoot.querySelector('[part~="base"]').getAttribute('title');
    el.remove();
    return out;
  });
  expect(result).toBe('Half way');
});

test('docs example script: the buttons change value and slotted label; value clamps in the example', async ({ page }) => {
  const { frame } = await openExample(page);
  const bar = frame.locator('#demo-values');
  await frame.locator('#demo-increase').click();
  await expect.poll(() => bar.evaluate(el => el.value)).toBe(60);
  await expect(bar).toHaveText('60%');
  expect(await bar.evaluate(el => el.shadowRoot.querySelector('[part~="base"]').getAttribute('aria-valuenow'))).toBe('60');
  for (let i = 0; i < 6; i++) await frame.locator('#demo-increase').click();
  await expect.poll(() => bar.evaluate(el => el.value)).toBe(100);
  await frame.locator('#demo-decrease').click();
  await expect.poll(() => bar.evaluate(el => el.value)).toBe(90);
});

test('events: only the inherited non-bubbling ready event fires, once, on first update; no sl-* or change events', async ({ page }) => {
  const { frame } = await openExample(page);
  const result = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-progress-bar');
    const seen = [];
    for (const type of ['ready', 'sl-change', 'sl-input', 'sl-focus', 'sl-blur', 'change', 'input']) {
      el.addEventListener(type, e => seen.push({ type, bubbles: e.bubbles, composed: e.composed }));
    }
    const bubbled = [];
    document.body.addEventListener('ready', () => bubbled.push('ready'));
    document.body.append(el);
    await el.updateComplete;
    el.value = 10;
    el.indeterminate = true;
    el.label = 'x';
    await el.updateComplete;
    el.remove();
    return { seen, bubbled };
  });
  expect(result.seen).toEqual([{ type: 'ready', bubbles: false, composed: false }]);
  expect(result.bubbled).toEqual([]);
});

test('removing the value attribute restores 0, which Lit reflects back as value="0", as in Shoelace', async ({ page }) => {
  const { frame } = await openExample(page);
  const result = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-progress-bar');
    el.setAttribute('value', '50');
    document.body.append(el);
    await el.updateComplete;
    const read = () => ({
      value: el.value,
      now: el.shadowRoot.querySelector('[part~="base"]').getAttribute('aria-valuenow'),
      width: el.shadowRoot.querySelector('[part~="indicator"]').style.width,
    });
    const before = read();
    el.removeAttribute('value');
    await el.updateComplete;
    const out = { before, after: read(), attribute: el.getAttribute('value') };
    el.remove();
    return out;
  });
  expect(result.before).toEqual({ value: 50, now: '50', width: '50%' });
  expect(result.after).toEqual({ value: 0, now: '0', width: '0%' });
  expect(result.attribute).toBe('0');
});

// Velcro divergence (documented on the page): Shoelace leaves a removed, non-reflected label null and then throws on render.
test('removing the label attribute keeps rendering: label returns to empty and the default name (Velcro robustness, not Shoelace parity)', async ({ page }) => {
  const { frame } = await openExample(page);
  const result = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-progress-bar');
    el.setAttribute('label', 'Upload');
    document.body.append(el);
    await el.updateComplete;
    const name = () => el.shadowRoot.querySelector('[part~="base"]').getAttribute('aria-label');
    const before = { label: el.label, name: name() };
    el.removeAttribute('label');
    await el.updateComplete;
    const out = { before, after: { label: el.label, name: name() } };
    el.remove();
    return out;
  });
  expect(result.before).toEqual({ label: 'Upload', name: 'Upload' });
  expect(result.after).toEqual({ label: '', name: 'Progress' });
});

test('the host is left untouched: no style attribute is written by core', async ({ page }) => {
  const { frame } = await openExample(page);
  const result = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-progress-bar');
    el.setAttribute('value', '40');
    document.body.append(el);
    await el.updateComplete;
    el.value = 60;
    await el.updateComplete;
    const out = { style: el.getAttribute('style'), percent: el.style.getPropertyValue('--progress-percent') };
    el.remove();
    return out;
  });
  expect(result).toEqual({ style: null, percent: '' });
  expect(await frame.locator('#demo-default').evaluate(el => el.getAttribute('style'))).toBeNull();
});

test('rich default-slot content: a slotted [icon] element inherits --label-color, not core\'s icon color', async ({ page }) => {
  const { frame } = await openExample(page);
  const result = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-progress-bar');
    el.setAttribute('value', '50');
    el.style.setProperty('--progress-bar-icon-color', 'rgb(255, 0, 0)');
    el.style.setProperty('--label-color', 'rgb(1, 2, 3)');
    el.innerHTML = '<span icon id="rich">50%</span>';
    document.body.append(el);
    await el.updateComplete;
    const out = getComputedStyle(el.querySelector('#rich')).color;
    el.remove();
    return out;
  });
  expect(result).toBe('rgb(1, 2, 3)');
});

test.describe('forced colors', () => {
  test.use({ forcedColors: 'active' });

  test('track outlines and indicator use the SelectedItem system color', async ({ page }) => {
    const { frame } = await openExample(page);
    const result = await frame.locator('#demo-default').evaluate(el => {
      const probe = name => {
        const node = document.createElement('span');
        node.style.color = name;
        document.body.append(node);
        const value = getComputedStyle(node).color;
        node.remove();
        return value;
      };
      const base = getComputedStyle(el.shadowRoot.querySelector('.progress-bar'));
      const indicator = getComputedStyle(el.shadowRoot.querySelector('.progress-bar__indicator'));
      return { system: probe('SelectedItem'), baseOutline: base.outlineColor, baseStyle: base.outlineStyle, indicatorOutline: indicator.outlineColor, indicatorBg: indicator.backgroundColor };
    });
    expect(result.baseStyle).toBe('solid');
    expect(result.baseOutline).toBe(result.system);
    expect(result.indicatorOutline).toBe(result.system);
    expect(result.indicatorBg).toBe(result.system);
  });
});

test('no upstream Shoelace runtime is requested or defined; all requests stay on the local origin', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  expect(await frame.locator('body').evaluate(() => ['sl-icon', 'sl-dialog'].filter(tag => customElements.get(tag)))).toEqual([]);
  expect(await frame.locator('body').evaluate(() => Boolean(window.Shoelace || document.querySelector('script[src*="shoelace"]')))).toBe(false);
});
