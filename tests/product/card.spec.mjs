import { expect, test } from '@playwright/test';

const PAGE = '/components/card';

async function openExample(page) {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  // Litro's client router remounts the page component once after load, which reloads the iframe; wait for it to settle.
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  const frame = page.frameLocator('iframe.example');
  await expect(frame.locator('#demo-basic')).toBeVisible();
  await frame.locator('#demo-basic').evaluate(() => customElements.whenDefined('sl-card'));
  await page.waitForLoadState('networkidle');
  return { frame, requests };
}

const describe = locator =>
  locator.evaluate(el => {
    const root = el.shadowRoot;
    const base = root.querySelector('[part~="base"]');
    const style = node => getComputedStyle(node);
    const section = part => {
      const node = root.querySelector(`[part~="${part}"]`);
      const cs = style(node);
      return {
        tag: node.localName,
        slot: node.name,
        display: cs.display,
        padding: cs.padding,
        borderTop: `${cs.borderTopWidth} ${cs.borderTopStyle}`,
        borderBottom: `${cs.borderBottomWidth} ${cs.borderBottomStyle}`,
        radius: cs.borderTopLeftRadius,
      };
    };
    return {
      parts: [...root.querySelectorAll('[part]')].map(n => n.getAttribute('part')),
      slots: [...root.querySelectorAll('slot')].map(s => s.name),
      classes: base.classList.value.trim(),
      baseTag: base.localName,
      baseRole: base.getAttribute('role'),
      hostRole: el.getAttribute('role'),
      base: {
        display: style(base).display,
        direction: style(base).flexDirection,
        background: style(base).backgroundColor,
        border: `${style(base).borderTopWidth} ${style(base).borderTopStyle} ${style(base).borderTopColor}`,
        radius: style(base).borderTopLeftRadius,
        shadow: style(base).boxShadow,
      },
      host: style(el).display,
      image: section('image'),
      header: section('header'),
      body: section('body'),
      footer: section('footer'),
    };
  });

test('docs page is prerendered with Velcro branding, prototype status and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Card - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('sl-rating and sl-icon-button do not exist in Velcro');
  expect(html).toContain('--border-color');
  expect(html).toContain('--padding');
  expect(html).toContain('The container that wraps the card');
  expect(html).toContain('base wrapper');
  expect(html).toContain('no Firefox, WebKit, RTL or localization check');
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
});

test('sl-card registers inside the example document only, as the exported class, and no core ch-card is defined', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  expect(await page.evaluate(() => customElements.get('sl-card'))).toBeUndefined();
  const info = await frame.locator('body').evaluate(() => {
    const ctor = customElements.get('sl-card');
    return {
      defined: ctor !== undefined,
      baseName: ctor?.baseName,
      coreTag: customElements.get('ch-card') !== undefined,
      viaConstructor: ctor ? new ctor().localName : null,
    };
  });
  expect(info).toEqual({ defined: true, baseName: 'card', coreTag: false, viaConstructor: 'sl-card' });
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
});

test('structure: a base div with image, header, body and footer slot parts, no role and no core parts', async ({ page }) => {
  const { frame } = await openExample(page);
  const basic = await describe(frame.locator('#demo-basic'));
  expect(basic.parts).toEqual(['base', 'image', 'header', 'body', 'footer']);
  expect(basic.slots).toEqual(['image', 'header', '', 'footer']);
  expect([basic.baseTag, basic.baseRole, basic.hostRole]).toEqual(['div', null, null]);
  expect(basic.classes).toBe('card');
  // No reflected attributes: the inherited core properties (heading, subheading, media-position) are not set.
  expect(await frame.locator('#demo-basic').evaluate(el => el.getAttributeNames())).toEqual(['id']);
});

test('section classes follow the slotted content', async ({ page }) => {
  const { frame } = await openExample(page);
  expect((await describe(frame.locator('#demo-basic'))).classes).toBe('card');
  expect((await describe(frame.locator('#demo-header'))).classes).toBe('card card--has-header');
  expect((await describe(frame.locator('#demo-footer'))).classes).toBe('card card--has-footer');
  expect((await describe(frame.locator('#demo-image'))).classes).toBe('card card--has-image');
  expect((await describe(frame.locator('#demo-overview'))).classes).toBe('card card--has-footer card--has-image');
});

test('computed styles: Shoelace box model, tokens and hidden empty sections', async ({ page }) => {
  const { frame } = await openExample(page);
  const basic = await describe(frame.locator('#demo-basic'));
  expect(basic.base).toEqual({
    display: 'flex',
    direction: 'column',
    background: 'rgb(255, 255, 255)',
    border: '1px solid rgb(228, 228, 231)',
    radius: '4px',
    shadow: expect.stringContaining('0px 1px 2px'),
  });
  expect(basic.host).toBe('block'); // the example's flex container blockifies the inline-block host
  expect(basic.body.display).toBe('block');
  expect(basic.body.padding).toBe('20px');
  for (const part of ['image', 'header', 'footer']) expect(basic[part].display, part).toBe('none');

  const header = await describe(frame.locator('#demo-header'));
  expect(header.header).toMatchObject({ display: 'block', padding: '10px 20px', borderBottom: '1px solid', radius: '4px' });
  expect(header.footer.display).toBe('none');

  const footer = await describe(frame.locator('#demo-footer'));
  expect(footer.footer).toMatchObject({ display: 'block', padding: '20px', borderTop: '1px solid' });
  expect(footer.header.display).toBe('none');

  const image = await describe(frame.locator('#demo-image'));
  expect(image.image).toMatchObject({ display: 'flex', radius: '4px' });
  const overview = await describe(frame.locator('#demo-overview'));
  expect(overview.image.display).toBe('flex');
  expect(overview.footer.display).toBe('block');
  // The image is stretched to the card's inner width and overlaps the border by its width.
  const geometry = await frame.locator('#demo-image').evaluate(el => {
    const img = el.querySelector('img').getBoundingClientRect();
    const base = el.shadowRoot.querySelector('[part~="base"]').getBoundingClientRect();
    return { imgWidth: img.width, baseWidth: base.width, imgTop: img.top, baseTop: base.top };
  });
  expect(geometry.imgWidth).toBe(geometry.baseWidth);
  expect(geometry.imgTop).toBe(geometry.baseTop);
});

test('custom properties and ::part styling take effect', async ({ page }) => {
  const { frame } = await openExample(page);
  const result = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-card');
    el.innerHTML = '<div slot="header">H</div>Body<div slot="footer">F</div>';
    el.style.setProperty('--padding', '10px');
    el.style.setProperty('--border-width', '3px');
    el.style.setProperty('--border-color', 'rgb(1, 2, 3)');
    el.style.setProperty('--border-radius', '9px');
    document.body.append(el);
    await el.updateComplete;
    const get = part => getComputedStyle(el.shadowRoot.querySelector(`[part~="${part}"]`));
    const out = {
      defaults: null,
      body: get('body').padding,
      header: get('header').padding,
      footer: get('footer').padding,
      border: `${get('base').borderTopWidth} ${get('base').borderTopColor} ${get('base').borderTopLeftRadius}`,
      headerBorder: `${get('header').borderBottomWidth} ${get('header').borderBottomColor}`,
    };
    const style = document.createElement('style');
    style.textContent = 'sl-card.styled::part(base) { background-color: rgb(4, 5, 6); } sl-card.styled::part(body) { padding: 1px; }';
    document.head.append(style);
    el.classList.add('styled');
    out.partBackground = get('base').backgroundColor;
    out.partBody = get('body').padding;
    el.remove();
    style.remove();
    return out;
  });
  expect(result).toMatchObject({
    body: '10px',
    header: '5px 10px',
    footer: '10px',
    border: '3px rgb(1, 2, 3) 9px',
    headerBorder: '3px rgb(1, 2, 3)',
    partBackground: 'rgb(4, 5, 6)',
    partBody: '1px',
  });
});

test('dynamic slotting: adding and removing slotted children updates the section classes; no events fire', async ({ page }) => {
  const { frame } = await openExample(page);
  const steps = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-card');
    el.textContent = 'Body';
    const events = [];
    for (const type of ['sl-focus', 'sl-blur', 'change', 'input', 'sl-change']) el.addEventListener(type, () => events.push(type));
    document.body.append(el);
    await el.updateComplete;
    const classes = () => el.shadowRoot.querySelector('[part~="base"]').classList.value.trim();
    const settle = async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      await el.updateComplete;
    };
    const out = { initial: classes() };
    for (const name of ['header', 'footer', 'image']) {
      const child = document.createElement('div');
      child.slot = name;
      child.textContent = name;
      el.append(child);
      await settle();
      out[`${name}Added`] = classes();
    }
    for (const name of ['header', 'footer', 'image']) {
      el.querySelector(`[slot="${name}"]`).remove();
      await settle();
    }
    out.removed = classes();
    out.events = events;
    el.remove();
    return out;
  });
  expect(steps).toEqual({
    initial: 'card',
    headerAdded: 'card card--has-header',
    footerAdded: 'card card--has-header card--has-footer',
    imageAdded: 'card card--has-header card--has-footer card--has-image',
    removed: 'card',
    events: [],
  });
});

test('hidden attribute hides the host', async ({ page }) => {
  const { frame } = await openExample(page);
  const display = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-card');
    document.body.append(el);
    await el.updateComplete;
    const shown = getComputedStyle(el).display;
    el.hidden = true;
    const hidden = getComputedStyle(el).display;
    el.remove();
    return { shown, hidden };
  });
  expect(display).toEqual({ shown: 'inline-block', hidden: 'none' });
});

test('slotted button works inside the footer and no upstream Shoelace runtime is requested', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  const info = await frame.locator('#demo-footer').evaluate(el => {
    const slot = el.shadowRoot.querySelector('slot[name="footer"]');
    return slot.assignedElements().map(n => n.querySelector('sl-button')?.localName);
  });
  expect(info).toEqual(['sl-button']);
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  expect(await frame.locator('body').evaluate(() => Boolean(window.Shoelace || document.querySelector('script[src*="shoelace"]')))).toBe(false);
});
