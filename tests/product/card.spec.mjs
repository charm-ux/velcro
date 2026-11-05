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
      baseAttributes: base.getAttributeNames().sort(),
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

test('docs page is prerendered with Velcro branding, prototype status, the ready event and explicit limits', async ({ request }) => {
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
  // The inherited ready event is documented as a divergence from Shoelace's card, which emits no events.
  expect(html).toContain('<code>ready</code>');
  expect(html).toContain('Emitted once, without bubbling, after the first render');
  expect(html).toContain('which emits no events');
  // The host hidden and box-sizing differences from Shoelace's shared base styles are listed as gaps.
  expect(html).toContain('The host hidden attribute hides the card');
  expect(html).toContain('box-sizing: border-box on the host and on every element in the shadow tree');
  expect(html).toContain('no Firefox, WebKit, RTL or localization check');
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
  expect(await (await request.get('/')).text()).toContain('/components/card');
});

test('sl-card registers inside the example document (the docs page registers its own copy separately), as the exported class, and no core ch-card is defined', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  // The docs page loads the same runtime through its client entry (app-main.ts) into its own, separate registry.
  expect(await page.evaluate(() => customElements.whenDefined('sl-card').then(ctor => typeof ctor))).toBe('function');
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

test('structure: a base div around image, header, body and footer slot parts, with no role on the host or the base', async ({ page }) => {
  const { frame } = await openExample(page);
  const basic = await describe(frame.locator('#demo-basic'));
  expect(basic.parts).toEqual(['base', 'image', 'header', 'body', 'footer']);
  expect(basic.slots).toEqual(['image', 'header', '', 'footer']);
  expect([basic.baseTag, basic.baseRole, basic.hostRole]).toEqual(['div', null, null]);
  expect(basic.classes).toBe('card');
  // No role or other ARIA: the base carries only its part and class, and the host nothing besides what the author wrote.
  expect(basic.baseAttributes).toEqual(['class', 'part']);
  expect(await frame.locator('#demo-basic').evaluate(el => el.getAttributeNames())).toEqual(['id']);
  // The card declares no attribute, property or method of its own: every observed attribute comes from the core classes
  // and the class adds only the protected template hook that core's render() calls.
  const surface = await frame.locator('#demo-basic').evaluate(el => ({
    observed: [...el.constructor.observedAttributes].sort(),
    own: Object.getOwnPropertyNames(el.constructor.prototype).filter(name => name !== 'constructor').sort(),
  }));
  expect(surface).toEqual({ observed: ['dir', 'heading', 'media-position', 'subheading'], own: ['cardTemplate'] });
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

test('custom property overrides and ::part styling take effect', async ({ page }) => {
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
  expect(result).toEqual({
    body: '10px',
    header: '5px 10px',
    footer: '10px',
    border: '3px rgb(1, 2, 3) 9px',
    headerBorder: '3px rgb(1, 2, 3)',
    partBackground: 'rgb(4, 5, 6)',
    partBody: '1px',
  });
});

test('slotting: adding, removing and re-slotting children updates the section classes, and ready is the only event dispatched', async ({ page }) => {
  const { frame } = await openExample(page);
  const steps = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-card');
    el.textContent = 'Body';
    // Record everything the card dispatches on itself. This is installed before the card connects, so it sees ready too.
    const dispatched = [];
    const dispatch = el.dispatchEvent.bind(el);
    el.dispatchEvent = event => {
      dispatched.push(event.type);
      return dispatch(event);
    };
    document.body.append(el);
    await el.updateComplete;
    const base = el.shadowRoot.querySelector('[part~="base"]');
    const classes = () => [...base.classList].sort();
    const slot = name => el.shadowRoot.querySelector(`slot[name="${name}"]`);
    // Applies the change, waits for slotchange on every named slot (the card re-renders from it) and then for the update.
    const change = async (names, mutate) => {
      const seen = names.map(name => new Promise(resolve => slot(name).addEventListener('slotchange', resolve, { once: true })));
      mutate();
      await Promise.all(seen);
      await el.updateComplete;
      return classes();
    };
    const child = name => {
      const node = document.createElement('div');
      node.slot = name;
      node.textContent = name;
      return node;
    };
    const out = { initial: classes() };
    out.headerAdded = await change(['header'], () => el.append(child('header')));
    out.footerAdded = await change(['footer'], () => el.append(child('footer')));
    out.imageAdded = await change(['image'], () => el.append(child('image')));
    const header = el.querySelector('[slot="header"]');
    out.headerUnassigned = await change(['header'], () => header.setAttribute('slot', 'unknown'));
    out.headerAssignedAgain = await change(['header'], () => header.setAttribute('slot', 'header'));
    out.headerMovedToFooter = await change(['header', 'footer'], () => header.setAttribute('slot', 'footer'));
    out.footersRemoved = await change(['footer'], () => el.querySelectorAll('[slot="footer"]').forEach(n => n.remove()));
    out.imageRemoved = await change(['image'], () => el.querySelector('[slot="image"]').remove());
    out.dispatched = dispatched;
    el.remove();
    return out;
  });
  expect(steps).toEqual({
    initial: ['card'],
    headerAdded: ['card', 'card--has-header'],
    footerAdded: ['card', 'card--has-footer', 'card--has-header'],
    imageAdded: ['card', 'card--has-footer', 'card--has-header', 'card--has-image'],
    headerUnassigned: ['card', 'card--has-footer', 'card--has-image'],
    headerAssignedAgain: ['card', 'card--has-footer', 'card--has-header', 'card--has-image'],
    headerMovedToFooter: ['card', 'card--has-footer', 'card--has-image'],
    footersRemoved: ['card', 'card--has-image'],
    imageRemoved: ['card'],
    dispatched: ['ready'],
  });
});

test('ready: inherited from the core base element, emitted once after the first render, without bubbling or composing', async ({ page }) => {
  const { frame } = await openExample(page);
  const result = await frame.locator('body').evaluate(async () => {
    const parent = document.createElement('div');
    document.body.append(parent);
    const el = document.createElement('sl-card');
    const own = [];
    const bubbled = [];
    el.addEventListener('ready', event => {
      own.push({
        bubbles: event.bubbles,
        composed: event.composed,
        cancelable: event.cancelable,
        detail: event.detail,
        targetIsCard: event.target === el,
        rendered: Boolean(el.shadowRoot?.querySelector('[part~="base"]')),
      });
    });
    parent.addEventListener('ready', () => bubbled.push('ready'));
    document.addEventListener('ready', () => bubbled.push('ready'));
    parent.append(el);
    await el.updateComplete;
    const afterFirstRender = own.length;
    // Later updates and a reconnect do not emit it again.
    el.setAttribute('media-position', 'end');
    await el.updateComplete;
    const slotChanged = new Promise(resolve => el.shadowRoot.querySelector('slot[name="footer"]').addEventListener('slotchange', resolve, { once: true }));
    const footer = document.createElement('div');
    footer.slot = 'footer';
    el.append(footer);
    await slotChanged;
    await el.updateComplete;
    el.remove();
    parent.append(el);
    await el.updateComplete;
    const detail = { afterFirstRender, final: own.length, bubbled, event: own[0] };
    parent.remove();
    return detail;
  });
  expect(result).toEqual({
    afterFirstRender: 1,
    final: 1,
    bubbled: [],
    event: { bubbles: false, composed: false, cancelable: false, detail: {}, targetIsCard: true, rendered: true },
  });
});

test('inherited core card properties have no effect, core slots render nothing and the core card styles are not applied', async ({ page }) => {
  const { frame } = await openExample(page);
  const result = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-card');
    el.innerHTML = 'Body<div slot="media" id="m">media</div><span slot="heading" id="h">heading</span><span slot="subheading" id="s">subheading</span>';
    document.body.append(el);
    await el.updateComplete;
    const snapshot = () => {
      const base = getComputedStyle(el.shadowRoot.querySelector('[part~="base"]'));
      return {
        tree: [...el.shadowRoot.querySelectorAll('*')].map(n => `${n.localName}|${n.getAttribute('class') ?? ''}|${n.getAttribute('part') ?? ''}|${n.getAttribute('name') ?? ''}`),
        base: [base.flexDirection, base.flexWrap, base.padding, base.gap, base.borderTopWidth, base.backgroundColor, base.height].join(' '),
        body: getComputedStyle(el.shadowRoot.querySelector('[part~="body"]')).padding,
        host: getComputedStyle(el).display,
      };
    };
    const before = snapshot();
    el.heading = 'Heading';
    el.subheading = 'Subheading';
    el.mediaPosition = 'end';
    for (const name of ['padding', 'border-size', 'border-style', 'border-radius', 'bg-color', 'fg-color', 'content-gap', 'box-shadow', 'body-padding-x', 'heading-size']) {
      el.style.setProperty(`--card-${name}`, name.includes('color') ? 'rgb(9, 9, 9)' : '37px');
    }
    await el.updateComplete;
    const after = snapshot();
    const css = el.shadowRoot.adoptedStyleSheets.map(sheet => [...sheet.cssRules].map(rule => rule.cssText).join('\n')).join('\n');
    const unslotted = ['m', 'h', 's'].map(id => {
      const node = el.querySelector(`#${id}`);
      return { assignedSlot: node.assignedSlot, boxes: node.getClientRects().length };
    });
    const out = {
      set: { heading: el.heading, subheading: el.subheading, mediaPosition: el.mediaPosition, attribute: el.getAttribute('media-position') },
      before,
      after,
      unslotted,
      sheetCount: el.shadowRoot.adoptedStyleSheets.length,
      coreRules: /--card-|\.base\b|\.card-content|\.footer\b|\[slot=["']?media/.test(css),
    };
    el.remove();
    return out;
  });
  // The properties were really set (and media-position reflected), yet nothing rendered or computed changed.
  expect(result.set).toEqual({ heading: 'Heading', subheading: 'Subheading', mediaPosition: 'end', attribute: 'end' });
  expect(result.after).toEqual(result.before);
  expect(result.before.base.startsWith('column nowrap 0px normal 1px')).toBe(true);
  expect(result.before.body).toBe('20px');
  expect(result.unslotted).toEqual([
    { assignedSlot: null, boxes: 0 },
    { assignedSlot: null, boxes: 0 },
    { assignedSlot: null, boxes: 0 },
  ]);
  // Only the core base element styles and the card styles are adopted; no core card rule is among them.
  expect(result.sheetCount).toBe(2);
  expect(result.coreRules).toBe(false);
});

test('the hidden attribute hides the host through the core base style (documented divergence from Shoelace)', async ({ page }) => {
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

test('the core base reset keeps shadow elements border-box when the host sets another box-sizing (documented divergence from Shoelace)', async ({ page }) => {
  const { frame } = await openExample(page);
  const result = await frame.locator('body').evaluate(async () => {
    const style = document.createElement('style');
    style.textContent = 'sl-card.box-test::part(body) { width: 100px; }';
    document.head.append(style);
    const el = document.createElement('sl-card');
    el.className = 'box-test';
    el.textContent = 'Body';
    document.body.append(el);
    await el.updateComplete;
    const read = () => {
      const base = el.shadowRoot.querySelector('[part~="base"]');
      const body = el.shadowRoot.querySelector('[part~="body"]');
      return {
        host: getComputedStyle(el).boxSizing,
        base: getComputedStyle(base).boxSizing,
        body: getComputedStyle(body).boxSizing,
        bodyPadding: getComputedStyle(body).paddingLeft,
        bodyWidth: body.getBoundingClientRect().width,
      };
    };
    const normal = read();
    el.style.boxSizing = 'content-box';
    const overridden = read();
    el.remove();
    style.remove();
    return { normal, overridden };
  });
  // By default the host and everything inside it are border-box, so the explicit part width includes the 20px padding.
  expect(result.normal).toEqual({ host: 'border-box', base: 'border-box', body: 'border-box', bodyPadding: '20px', bodyWidth: 100 });
  // content-box set on the host does not reach the shadow elements, so the padded part keeps its 100px border box.
  expect(result.overridden).toEqual({ host: 'content-box', base: 'border-box', body: 'border-box', bodyPadding: '20px', bodyWidth: 100 });
});

test('an sl-button inside the footer slot is assigned to the footer, and no upstream Shoelace runtime is requested', async ({ page }) => {
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
