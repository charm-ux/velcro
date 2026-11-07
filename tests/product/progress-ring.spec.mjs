import { expect, test } from '@playwright/test';

const PAGE = '/components/progress-ring';

async function openExample(page) {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  // Litro's client router remounts the page component once after load, which reloads the iframes; wait for it to settle.
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  const frame = page.frameLocator('iframe.example');
  await expect(frame.locator('#demo-default')).toBeVisible();
  await expect(frame.locator('#demo-values')).toBeVisible();
  await frame.locator('#demo-default').evaluate(() => customElements.whenDefined('sl-progress-ring'));
  await page.waitForLoadState('networkidle');
  return { frame, requests };
}

const styleOf = (locator, selector) =>
  locator.evaluate((el, sel) => {
    const cs = getComputedStyle(el.shadowRoot.querySelector(sel));
    return {
      stroke: cs.stroke,
      strokeWidth: cs.strokeWidth,
      r: cs.r,
      cx: cs.cx,
      dasharray: cs.strokeDasharray,
      dashoffset: cs.strokeDashoffset,
      linecap: cs.strokeLinecap,
      transitionProperty: cs.transitionProperty,
      transitionDuration: cs.transitionDuration,
    };
  }, selector);

test('docs page is prerendered with Velcro branding, prototype status and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Progress Ring - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('registered by importing @charm-ux/velcro/translations/');
  expect(html).not.toContain('not public package exports yet');
  expect(html).toContain('as before Velcro had sl-icon');
  expect(html).toContain('--indicator-transition-duration');
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
  const home = await (await request.get('/')).text();
  expect(home).toContain('/components/progress-ring');
});

test('sl-progress-ring registers inside the example document, and separately in the docs page through the client entry', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  // The docs page loads the same runtime through its client entry (app-main.ts) into its own, separate registry.
  expect(await page.evaluate(() => customElements.whenDefined('sl-progress-ring').then(ctor => typeof ctor))).toBe('function');
  expect(await frame.locator('body').evaluate(() => customElements.get('sl-progress-ring') !== undefined)).toBe(true);
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
});

test('rendered structure, parts and ARIA: progressbar with value range, label slot and public parts only', async ({ page }) => {
  const { frame } = await openExample(page);
  const info = await frame.locator('#demo-default').evaluate(el => {
    const base = el.shadowRoot.querySelector('[part~="base"]');
    return {
      parts: [...el.shadowRoot.querySelectorAll('[part]')].map(n => n.getAttribute('part')),
      tag: base.localName,
      role: base.getAttribute('role'),
      label: base.getAttribute('aria-label'),
      describedby: base.getAttribute('aria-describedby'),
      min: base.getAttribute('aria-valuemin'),
      max: base.getAttribute('aria-valuemax'),
      now: base.getAttribute('aria-valuenow'),
      percentage: base.style.getPropertyValue('--percentage'),
      slotId: el.shadowRoot.querySelector('slot').id,
      circles: el.shadowRoot.querySelectorAll('svg circle').length,
      hostRole: el.getAttribute('role'),
    };
  });
  expect(info).toEqual({
    parts: ['base', 'label'],
    tag: 'div',
    role: 'progressbar',
    label: 'Progress',
    describedby: 'label',
    min: '0',
    max: '100',
    now: '25',
    percentage: '0.25',
    slotId: 'label',
    circles: 2,
    hostRole: null,
  });
  await expect(frame.getByRole('progressbar', { name: 'Upload progress' })).toHaveCount(1);
  await expect(frame.getByRole('progressbar')).toHaveCount(6);
});

test('computed styles: 128px host/ring, radius, dash geometry, track and indicator colors match the Shoelace CSS', async ({ page }) => {
  const { frame } = await openExample(page);
  const host = frame.locator('#demo-default');
  const hostInfo = await host.evaluate(el => {
    const cs = getComputedStyle(el);
    const image = getComputedStyle(el.shadowRoot.querySelector('.progress-ring__image'));
    const label = getComputedStyle(el.shadowRoot.querySelector('.progress-ring__label'));
    return {
      width: el.getBoundingClientRect().width,
      height: el.getBoundingClientRect().height,
      imageWidth: image.width,
      rotate: image.rotate,
      labelPosition: label.position,
      labelDisplay: label.display,
      labelSelect: label.userSelect,
    };
  });
  expect(hostInfo).toEqual({
    width: 128,
    height: 128,
    imageWidth: '128px',
    rotate: '-90deg',
    labelPosition: 'absolute',
    labelDisplay: 'flex',
    labelSelect: 'none',
  });
  // The example host sits in a flex wrapper, which blockifies its computed display; check a standalone element.
  expect(
    await frame.locator('body').evaluate(async () => {
      const el = document.createElement('sl-progress-ring');
      document.body.append(el);
      await el.updateComplete;
      const display = getComputedStyle(el).display;
      el.remove();
      return display;
    }),
  ).toBe('inline-flex');
  const circumference = 2 * Math.PI * 62;
  const indicator = await styleOf(host, '.progress-ring__indicator');
  expect(indicator).toMatchObject({
    stroke: 'rgb(2, 132, 199)',
    strokeWidth: '4px',
    r: '62px',
    cx: '64px',
    linecap: 'round',
    transitionProperty: 'stroke-dashoffset',
    transitionDuration: '0.35s',
  });
  const [dash] = indicator.dasharray.split(/[ ,]+/);
  expect(parseFloat(dash)).toBeCloseTo(circumference, 1);
  expect(parseFloat(indicator.dashoffset)).toBeCloseTo(circumference * 0.75, 1);
  const track = await styleOf(host, '.progress-ring__track');
  expect(track).toMatchObject({ stroke: 'rgb(228, 228, 231)', strokeWidth: '4px', r: '62px' });
});

test('CSS custom properties: --size, widths and colors from the docs examples', async ({ page }) => {
  const { frame } = await openExample(page);
  const size = frame.locator('#demo-size');
  expect((await size.boundingBox()).width).toBe(200);
  expect(await styleOf(size, '.progress-ring__indicator')).toMatchObject({ r: '98px', cx: '100px' });
  const width = frame.locator('#demo-width');
  // The radius uses the wider of the two strokes, so the thin track sits at the indicator's centre line.
  expect(await styleOf(width, '.progress-ring__indicator')).toMatchObject({ strokeWidth: '12px', r: '58px' });
  expect(await styleOf(width, '.progress-ring__track')).toMatchObject({ strokeWidth: '6px', r: '58px' });
  const colors = frame.locator('#demo-colors');
  expect((await styleOf(colors, '.progress-ring__indicator')).stroke).toBe('rgb(255, 20, 147)');
  expect((await styleOf(colors, '.progress-ring__track')).stroke).toBe('rgb(255, 192, 203)');
  const duration = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-progress-ring');
    el.style.setProperty('--indicator-transition-duration', '1s');
    document.body.append(el);
    await el.updateComplete;
    const out = getComputedStyle(el.shadowRoot.querySelector('.progress-ring__indicator')).transitionDuration;
    el.remove();
    return out;
  });
  expect(duration).toBe('1s');
});

test('value and label: defaults, reflection, aria updates and the dash offset follow changes', async ({ page }) => {
  const { frame } = await openExample(page);
  const result = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-progress-ring');
    document.body.append(el);
    await el.updateComplete;
    // The dash offset is set from updated(), which queues a second render that updateComplete does not wait for.
    const settle = async () => {
      await el.updateComplete;
      await el.updateComplete;
    };
    const read = () => {
      const base = el.shadowRoot.querySelector('[part~="base"]');
      return {
        now: base.getAttribute('aria-valuenow'),
        label: base.getAttribute('aria-label'),
        offset: el.shadowRoot.querySelector('.progress-ring__indicator').style.strokeDashoffset,
        attr: el.getAttribute('value'),
      };
    };
    await settle();
    const initial = { value: el.value, ...read() };
    el.value = 50;
    await settle();
    const afterProp = read();
    el.setAttribute('value', '75');
    await settle();
    const afterAttr = { value: el.value, type: typeof el.value, ...read() };
    el.label = 'Custom';
    await settle();
    const labelled = { ...read(), labelAttr: el.getAttribute('label') };
    el.remove();
    return { initial, afterProp, afterAttr, labelled };
  });
  const c = 2 * Math.PI * 62;
  expect(result.initial).toMatchObject({ value: 0, now: '0', label: 'Progress', attr: '0' });
  expect(parseFloat(result.initial.offset)).toBeCloseTo(c, 1);
  expect(result.afterProp).toMatchObject({ now: '50', attr: '50' });
  expect(parseFloat(result.afterProp.offset)).toBeCloseTo(c / 2, 1);
  expect(result.afterAttr).toMatchObject({ value: 75, type: 'number', now: '75' });
  expect(parseFloat(result.afterAttr.offset)).toBeCloseTo(c / 4, 1);
  expect(result.labelled).toMatchObject({ label: 'Custom', labelAttr: null });
});

test('the docs values example updates the ring and its slotted label through buttons, and fires no change or input events', async ({ page }) => {
  const { frame: valuesFrame } = await openExample(page);
  const ring = valuesFrame.locator('#demo-values');
  await ring.evaluate(el => {
    window.__events = [];
    for (const name of ['sl-change', 'change', 'input', 'ready']) el.addEventListener(name, () => window.__events.push(name));
  });
  await valuesFrame.locator('#demo-increase').click();
  await valuesFrame.locator('#demo-increase').click();
  await expect(ring).toHaveAttribute('value', '70');
  await expect(ring).toHaveText('70%');
  await valuesFrame.locator('#demo-decrease').click();
  await expect(ring).toHaveAttribute('value', '60');
  expect(await ring.evaluate(el => el.shadowRoot.querySelector('[part~="base"]').getAttribute('aria-valuenow'))).toBe('60');
  expect(await ring.evaluate(el => el.shadowRoot.querySelector('slot').assignedNodes().map(n => n.textContent).join(''))).toBe('60%');
  expect(await ring.evaluate(() => window.__events.filter(name => name !== 'ready'))).toEqual([]);
});

test('removing the value attribute restores the default 0, as in Shoelace', async ({ page }) => {
  const { frame } = await openExample(page);
  const result = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-progress-ring');
    el.setAttribute('value', '75');
    document.body.append(el);
    await el.updateComplete;
    el.removeAttribute('value');
    await el.updateComplete;
    await el.updateComplete;
    const out = {
      value: el.value,
      now: el.shadowRoot.querySelector('[part~="base"]').getAttribute('aria-valuenow'),
      attr: el.getAttribute('value'),
    };
    el.remove();
    return out;
  });
  expect(result).toEqual({ value: 0, now: '0', attr: '0' });
});

test('the inherited core ready event fires once on the host, without bubbling or composing (a Shoelace divergence)', async ({ page }) => {
  const { frame } = await openExample(page);
  const result = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-progress-ring');
    const seen = [];
    let bubbled = 0;
    el.addEventListener('ready', e => seen.push({ bubbles: e.bubbles, composed: e.composed, target: e.target === el }));
    document.body.addEventListener('ready', () => bubbled++);
    document.body.append(el);
    await el.updateComplete;
    await el.updateComplete;
    el.value = 10;
    await el.updateComplete;
    el.remove();
    return { seen, bubbled };
  });
  expect(result).toEqual({ seen: [{ bubbles: false, composed: false, target: true }], bubbled: 0 });
});

test.describe('forced colors', () => {
  test.use({ forcedColors: 'active' });

  test('track and indicator use the GrayText and Highlight system colors', async ({ page }) => {
    const { frame } = await openExample(page);
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
    expect((await styleOf(frame.locator('#demo-default'), '.progress-ring__track')).stroke).toBe(system.gray);
    expect((await styleOf(frame.locator('#demo-default'), '.progress-ring__indicator')).stroke).toBe(system.highlight);
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
