import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';
import { reactWrapperPage } from './support/react.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/avatar';
const SECTIONS = ['Default', 'Images', 'Initials', 'Custom Icons', 'Shapes', 'Avatar Groups'];
const title = section => `Avatar example: ${section}`;
const docsDir = fileURLToPath(new URL('../../packages/docs/', import.meta.url));
const velcroDir = fileURLToPath(new URL('../../packages/velcro/', import.meta.url));
// Requests to this same-origin path are answered by the tests' own routes, never by the site.
const TEST_PATH = '/__avatar-test/';

async function openPage(page) {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  const frame = page.frameLocator(`iframe.example[title="${title('Default')}"]`);
  await expect(frame.locator('sl-avatar').first()).toBeVisible();
  await frame.locator('body').evaluate(() => customElements.whenDefined('sl-avatar'));
  await documentsLoaded(page);
  return { frame, requests, example: section => page.frameLocator(`iframe.example[title="${title(section)}"]`) };
}

// Appends markup to the example document and waits for every sl-avatar in it to render.
async function mount(frame, markup) {
  await frame.locator('body').evaluate(async (body, markup) => {
    const host = document.createElement('div');
    host.className = 'mount';
    host.innerHTML = markup;
    body.append(host);
    await Promise.all([...host.querySelectorAll('sl-avatar')].map(el => el.updateComplete));
  }, markup);
}

test('docs page is prerendered with Velcro branding, prototype status, every Shoelace section, the quirks and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Avatar - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('without changing the shared core prefix');
  for (const section of SECTIONS) expect(html).toContain(`title="${title(section)}"`);
  expect(html).toContain('does not hide the avatar');
  expect(html).toContain('accessible name is empty');
  expect(html).toContain('Setting the same URL again keeps the fallback');
  expect(html).toContain('inline placeholder images');
  expect(html).toContain('was run locally in Chromium and WebKit only, and Firefox is covered only by the project&#39;s CI run');
  expect(html).toContain('Playwright&#39;s ARIA snapshot');
  // The API tables: Shoelace's members, plus the core ready event labelled as inherited.
  expect(html).toContain('Inherited from core');
  for (const name of ['image', 'label', 'initials', 'loading', 'shape', 'sl-error', 'icon', 'base', 'initials', '--size']) {
    expect(html).toContain(`data-name="${name}"`);
  }
  expect(html.match(/<summary>React<\/summary>/g)).toHaveLength(SECTIONS.length);
  expect(html).toContain('import { VelcroAvatar as SlAvatar } from &#39;@charm-ux/velcro/react/VelcroAvatar.js&#39;;');
  expect(html).not.toMatch(/(src|href|image)="[^"]*(shoelace|unsplash)/i);
  const home = await (await request.get('/')).text();
  expect(home).toContain('/components/avatar');
});

test('sl-avatar registers inside the example document as the exported class, with sl-icon, no core marker and no ch-* definitions', async ({ page }) => {
  const { frame, requests } = await openPage(page);
  expect(await page.evaluate(() => customElements.whenDefined('sl-avatar').then(ctor => typeof ctor))).toBe('function');
  const info = await frame.locator('body').evaluate(() => {
    const ctor = customElements.get('sl-avatar');
    const el = document.querySelector('sl-avatar');
    return {
      baseName: ctor?.baseName,
      coreTag: customElements.get('ch-avatar') !== undefined,
      viaConstructor: ctor ? new ctor().localName : null,
      instance: el instanceof ctor,
      icon: customElements.get('sl-icon')?.baseName,
      attrs: el.getAttributeNames().sort(),
    };
  });
  expect(info).toEqual({ baseName: 'avatar', coreTag: false, viaConstructor: 'sl-avatar', instance: true, icon: 'icon', attrs: ['id', 'label', 'shape'] });
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
});

test('default: a base part with role="img" and the label, around the icon part with the system person-fill sl-icon in the icon slot', async ({ page }) => {
  const { frame } = await openPage(page);
  const el = frame.locator('#demo-default');
  const r = await el.evaluate(async el => {
    const icon = el.shadowRoot.querySelector('slot[name="icon"] sl-icon');
    await icon.updateComplete;
    const base = el.shadowRoot.querySelector('[part="base"]');
    return {
      className: [...base.classList].join(' '), role: base.getAttribute('role'), ariaLabel: base.getAttribute('aria-label'),
      children: [...el.shadowRoot.children].filter(n => n.localName !== 'style').map(n => `${n.localName}:${n.getAttribute('part')}`),
      parts: [...el.shadowRoot.querySelectorAll('[part]')].map(n => `${n.localName}:${n.getAttribute('part')}:${[...n.classList].join(' ')}`),
      iconHidden: el.shadowRoot.querySelector('[part="icon"]').getAttribute('aria-hidden'),
      slots: [...el.shadowRoot.querySelectorAll('slot')].map(s => s.name),
      fallback: [icon.getAttribute('name'), icon.getAttribute('library')],
      drawn: Boolean(icon.shadowRoot.querySelector('svg')),
      img: el.shadowRoot.querySelector('img'),
    };
  });
  expect(r).toEqual({
    className: 'avatar avatar--circle', role: 'img', ariaLabel: 'User avatar',
    children: ['div:base'],
    parts: ['div:base:avatar avatar--circle', 'div:icon:avatar__icon'],
    iconHidden: 'true', slots: ['icon'], fallback: ['person-fill', 'system'], drawn: true, img: null,
  });
});

test('computed styles match Shoelace: inline-block host, a 3rem base drawn from the theme tokens, --size scales it and the initials', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-avatar id="i" initials="ab" label="ab"></sl-avatar><sl-avatar id="big" style="--size: 5rem" initials="CD"></sl-avatar>');
  const r = await frame.locator('body').evaluate(() => {
    const read = id => {
      const el = document.querySelector(id);
      const base = el.shadowRoot.querySelector('[part="base"]');
      const cs = getComputedStyle(base);
      const box = base.getBoundingClientRect();
      return {
        host: getComputedStyle(el).display,
        base: { display: cs.display, position: cs.position, width: box.width, height: box.height, fontSize: cs.fontSize,
          background: cs.backgroundColor, color: cs.color, fontFamily: cs.fontFamily, fontWeight: cs.fontWeight,
          verticalAlign: cs.verticalAlign, userSelect: cs.userSelect || cs.webkitUserSelect, radius: cs.borderTopLeftRadius },
        initials: el.shadowRoot.querySelector('[part="initials"]') && {
          transform: getComputedStyle(el.shadowRoot.querySelector('[part="initials"]')).textTransform,
          lineHeight: getComputedStyle(el.shadowRoot.querySelector('[part="initials"]')).lineHeight,
        },
      };
    };
    const probe = document.createElement('div');
    probe.style.cssText = 'background-color: var(--sl-color-neutral-400); color: var(--sl-color-neutral-0); font-family: var(--sl-font-sans); font-weight: var(--sl-font-weight-normal)';
    document.body.append(probe);
    const want = getComputedStyle(probe);
    const tokens = { background: want.backgroundColor, color: want.color, fontFamily: want.fontFamily, fontWeight: want.fontWeight };
    probe.remove();
    return { small: read('#i'), big: read('#big'), tokens };
  });
  expect(r.small.host).toBe('inline-block');
  expect(r.small.base).toEqual({
    display: 'inline-flex', position: 'relative', width: 48, height: 48, fontSize: '24px',
    ...r.tokens, verticalAlign: 'middle', userSelect: 'none', radius: r.small.base.radius,
  });
  // --sl-border-radius-circle is 50%, which a 48px box computes as 50%.
  expect(r.small.base.radius).toBe('50%');
  expect(r.small.initials).toEqual({ transform: 'uppercase', lineHeight: '24px' });
  expect(r.big.base).toMatchObject({ width: 80, height: 80, fontSize: '40px' });
  // The text the browser draws is upper case while the property keeps the case it was given.
  expect(await frame.locator('#i').evaluate(el => [el.initials, el.shadowRoot.querySelector('[part="initials"]').textContent])).toEqual(['ab', 'ab']);
  expect(await frame.locator('#i').evaluate(el => el.shadowRoot.querySelector('[part="initials"]').innerText)).toBe('AB');
});

test('the theme tokens drive the avatar: overriding them on the host changes the base', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-avatar id="t" shape="rounded" style="--sl-color-neutral-400: rgb(255, 0, 0); --sl-color-neutral-0: rgb(0, 0, 255); --sl-border-radius-medium: 9px"></sl-avatar>');
  const r = await frame.locator('#t').evaluate(el => {
    const cs = getComputedStyle(el.shadowRoot.querySelector('[part="base"]'));
    return { background: cs.backgroundColor, color: cs.color, radius: cs.borderTopLeftRadius };
  });
  expect(r).toEqual({ background: 'rgb(255, 0, 0)', color: 'rgb(0, 0, 255)', radius: '9px' });
});

test('images example: the image part replaces the icon, with an empty alt, the loading attribute, and covers the avatar', async ({ page }) => {
  const { example } = await openPage(page);
  const frame = example('Images');
  await frame.locator('sl-avatar').last().scrollIntoViewIfNeeded();
  // Both images are inline data: URLs; the lazy one loads once it is near the viewport.
  await expect.poll(() => frame.locator('sl-avatar').evaluateAll(els => els.map(el => el.shadowRoot.querySelector('img')?.complete && el.shadowRoot.querySelector('img').naturalWidth > 0))).toEqual([true, true]);
  const r = await frame.locator('sl-avatar').evaluateAll(els => els.map(el => {
    const img = el.shadowRoot.querySelector('img');
    const cs = getComputedStyle(img);
    const base = el.shadowRoot.querySelector('[part="base"]').getBoundingClientRect();
    const box = img.getBoundingClientRect();
    return {
      parts: [...el.shadowRoot.querySelectorAll('[part]')].map(n => n.getAttribute('part')),
      img: { cls: img.className, alt: img.getAttribute('alt'), loading: img.getAttribute('loading'), src: img.getAttribute('src') === el.image },
      fills: box.width === base.width && box.height === base.height,
      style: { position: cs.position, objectFit: cs.objectFit, radius: cs.borderTopLeftRadius, overflow: cs.overflow },
      label: el.shadowRoot.querySelector('[part="base"]').getAttribute('aria-label'),
      slots: el.shadowRoot.querySelectorAll('slot').length,
    };
  }));
  const common = { parts: ['base', 'image'], fills: true, slots: 0, style: { position: 'absolute', objectFit: 'cover', radius: '50%', overflow: 'hidden' } };
  expect(r).toEqual([
    { ...common, img: { cls: 'avatar__image', alt: '', loading: 'eager', src: true }, label: 'Avatar of a placeholder person on a blue background' },
    { ...common, img: { cls: 'avatar__image', alt: '', loading: 'lazy', src: true }, label: 'Avatar of a placeholder person on a purple background' },
  ]);
});

test('precedence and updates: an image wins over initials, initials over the icon, and each change re-renders', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-avatar id="p" initials="SL"><span slot="icon">x</span></sl-avatar>');
  const r = await frame.locator('#p').evaluate(async el => {
    const parts = () => [...el.shadowRoot.querySelectorAll('[part]')].map(n => n.getAttribute('part')).join(' ');
    const out = [parts()];
    el.image = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3E%3Crect width='8' height='8'/%3E%3C/svg%3E";
    await el.updateComplete;
    out.push(parts());
    el.image = '';
    await el.updateComplete;
    out.push(parts());
    el.initials = '';
    await el.updateComplete;
    out.push(parts());
    // The slotted icon is assigned only while the icon part is rendered.
    out.push(el.shadowRoot.querySelector('slot[name="icon"]').assignedElements().map(n => n.localName).join());
    el.removeAttribute('initials');
    el.setAttribute('initials', 'Z');
    await el.updateComplete;
    out.push(parts());
    return out;
  });
  expect(r).toEqual(['base initials', 'base image', 'base initials', 'base icon', 'span', 'base initials']);
});

test('image errors: a failed image falls back, emits a bubbling composed sl-error, and a new image clears the error', async ({ page }) => {
  const { frame } = await openPage(page);
  let served = 0;
  await page.route(url => url.pathname.startsWith(TEST_PATH), route => {
    served++;
    const ok = route.request().url().endsWith('/good.svg');
    return route.fulfill(ok
      ? { status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8"/></svg>' }
      : { status: 404, contentType: 'text/plain', body: 'missing' });
  });
  await mount(frame, '<div id="outer"><sl-avatar id="e" initials="EF" label="Broken"></sl-avatar></div>');
  const r = await frame.locator('#e').evaluate(async (el, testPath) => {
    const url = name => new URL(`${testPath}${name}`, document.baseURI).href;
    const parts = () => [...el.shadowRoot.querySelectorAll('[part]')].map(n => n.getAttribute('part')).join(' ');
    const seen = [];
    document.querySelector('#outer').addEventListener('sl-error', event => seen.push({
      target: event.target.id, bubbles: event.bubbles, composed: event.composed, cancelable: event.cancelable,
      detail: JSON.stringify(event.detail), isCustom: event instanceof CustomEvent,
    }));
    const failed = () => new Promise(resolve => el.addEventListener('sl-error', resolve, { once: true }));
    let wait = failed();
    el.image = url('missing.svg');
    await el.updateComplete;
    const whileLoading = parts();
    await wait;
    await el.updateComplete;
    const afterError = parts();
    // A good image after the failure is shown.
    el.image = url('good.svg');
    await el.updateComplete;
    await new Promise(resolve => el.shadowRoot.querySelector('img').complete ? resolve() : el.shadowRoot.querySelector('img').addEventListener('load', resolve, { once: true }));
    const afterGood = parts();
    // Another failure, then the same failing URL assigned again: unchanged, so no retry (quirk).
    wait = failed();
    el.image = url('missing-2.svg');
    await wait;
    await el.updateComplete;
    el.image = url('missing-2.svg');
    await el.updateComplete;
    const sameAgain = parts();
    return { whileLoading, afterError, afterGood, sameAgain, seen };
  }, TEST_PATH);
  expect(r.whileLoading).toBe('base image');
  expect(r.afterError).toBe('base initials');
  expect(r.afterGood).toBe('base image');
  expect(r.sameAgain).toBe('base initials');
  const event = { target: 'e', bubbles: true, composed: true, cancelable: false, detail: '{}', isCustom: true };
  expect(r.seen).toEqual([event, event]);
  // missing.svg, good.svg and missing-2.svg once each: the repeated assignment did not request it again.
  expect(served).toBe(3);
});

test('upstream quirk: a failed image is not retried when the same URL is set again, even after the server recovers', async ({ page }) => {
  const { frame } = await openPage(page);
  let healthy = false;
  await page.route(url => url.pathname.startsWith(TEST_PATH), route => route.fulfill(healthy
    ? { status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8"/></svg>' }
    : { status: 503, contentType: 'text/plain', body: 'down' }));
  await mount(frame, '<sl-avatar id="q" label="Flaky"></sl-avatar>');
  const url = await frame.locator('#q').evaluate(async (el, testPath) => {
    const url = new URL(`${testPath}flaky.svg`, document.baseURI).href;
    const failed = new Promise(resolve => el.addEventListener('sl-error', resolve, { once: true }));
    el.image = url;
    await failed;
    await el.updateComplete;
    return url;
  }, TEST_PATH);
  healthy = true;
  const parts = () => frame.locator('#q').evaluate(el => [...el.shadowRoot.querySelectorAll('[part]')].map(n => n.getAttribute('part')).join(' '));
  expect(await parts()).toBe('base icon');
  await frame.locator('#q').evaluate(async (el, url) => { el.image = url; el.setAttribute('image', url); await el.updateComplete; }, url);
  expect(await parts()).toBe('base icon');
  // Changing to another value and back is a change, so the recovered image is shown.
  await frame.locator('#q').evaluate(async (el, url) => {
    el.image = '';
    await el.updateComplete;
    el.image = url;
    await el.updateComplete;
    const img = el.shadowRoot.querySelector('img');
    await new Promise(resolve => img.complete && img.naturalWidth ? resolve() : img.addEventListener('load', resolve, { once: true }));
  }, url);
  expect(await parts()).toBe('base image');
});

test('shapes: the shape attribute reflects and selects the corner radius; removing it restores circle', async ({ page }) => {
  const { example, frame } = await openPage(page);
  const shapes = await example('Shapes').locator('sl-avatar').evaluateAll(els => els.map(el => [
    el.shape, el.getAttribute('shape'), [...el.shadowRoot.querySelector('[part="base"]').classList].join(' '),
    getComputedStyle(el.shadowRoot.querySelector('[part="base"]')).borderTopLeftRadius,
  ]));
  expect(shapes).toEqual([
    ['square', 'square', 'avatar avatar--square', '0px'],
    ['rounded', 'rounded', 'avatar avatar--rounded', '4px'],
    ['circle', 'circle', 'avatar avatar--circle', '50%'],
  ]);
  await mount(frame, '<sl-avatar id="s" shape="square"></sl-avatar><sl-avatar id="d"></sl-avatar>');
  const r = await frame.locator('body').evaluate(async () => {
    const el = document.querySelector('#s');
    const fresh = document.querySelector('#d');
    const state = e => [e.shape, e.getAttribute('shape'), [...e.shadowRoot.querySelector('[part="base"]').classList].join(' ')];
    const out = { fresh: state(fresh) };
    el.shape = 'rounded';
    await el.updateComplete;
    out.property = state(el);
    el.removeAttribute('shape');
    await el.updateComplete;
    out.removed = state(el);
    return out;
  });
  expect(r).toEqual({
    // The default shape is reflected on the first update, as in Shoelace (its own test reads the attribute).
    fresh: ['circle', 'circle', 'avatar avatar--circle'],
    property: ['rounded', 'rounded', 'avatar avatar--rounded'],
    // Shoelace's base element puts back the recorded initial value; it is reflected again.
    removed: ['circle', 'circle', 'avatar avatar--circle'],
  });
});

test('upstream quirk: an unknown shape sets no shape class, so the corners are square', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-avatar id="o" shape="oval"></sl-avatar>');
  const r = await frame.locator('#o').evaluate(el => {
    const base = el.shadowRoot.querySelector('[part="base"]');
    return [el.shape, [...base.classList].join(' '), getComputedStyle(base).borderTopLeftRadius];
  });
  expect(r).toEqual(['oval', 'avatar', '0px']);
});

test('upstream quirk: initials are not shortened; every character is drawn and long initials overflow the avatar', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-avatar id="l" initials="Velcro Avatar"></sl-avatar>');
  const r = await frame.locator('#l').evaluate(el => {
    const initials = el.shadowRoot.querySelector('[part="initials"]');
    return { text: initials.innerText, initialsWidth: initials.getBoundingClientRect().width, baseWidth: el.shadowRoot.querySelector('[part="base"]').getBoundingClientRect().width };
  });
  expect(r.text).toBe('VELCRO AVATAR');
  expect(r.baseWidth).toBe(48);
  expect(r.initialsWidth).toBeGreaterThan(r.baseWidth);
});

test('upstream quirk: the hidden attribute does not hide the avatar, because the host\'s own display: inline-block outranks the browser rule', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-avatar id="h" hidden initials="H"></sl-avatar>');
  const r = await frame.locator('#h').evaluate(el => {
    const before = { display: getComputedStyle(el).display, boxes: el.getClientRects().length, hidden: el.hidden };
    el.style.display = 'none';
    const withInline = getComputedStyle(el).display;
    el.style.display = '';
    // The shadow tree's own [hidden] rule applies to elements inside it, not to the host.
    const base = el.shadowRoot.querySelector('[part="base"]');
    base.hidden = true;
    const baseHidden = getComputedStyle(base).display;
    base.hidden = false;
    return { before, withInline, baseHidden };
  });
  expect(r).toEqual({ before: { display: 'inline-block', boxes: 1, hidden: true }, withInline: 'none', baseHidden: 'none' });
  await expect(frame.locator('#h')).toBeVisible();
});

// Playwright's ARIA snapshot is computed by Playwright from the DOM (roles, names, aria-hidden, hidden and inert content),
// not read from the browser's native accessibility tree, and no screen reader is involved.
test('accessibility tree (Playwright ARIA snapshot): one named image per avatar; no label gives an image with an empty name (quirk)', async ({ page }) => {
  const { frame, example } = await openPage(page);
  await expect(frame.locator('body')).toMatchAriaSnapshot('- img "User avatar"');
  await expect(example('Initials').locator('body')).toMatchAriaSnapshot(`- 'img "Avatar with initials: SL"'`);
  await expect(example('Custom Icons').locator('body')).toMatchAriaSnapshot(`
    - img "Avatar with an image icon"
    - img "Avatar with an archive icon"
    - img "Avatar with a briefcase icon"
  `);
  await expect(example('Avatar Groups').locator('body')).toMatchAriaSnapshot(`
    - img "Avatar 1 of 4"
    - img "Avatar 2 of 4"
    - img "Avatar 3 of 4"
    - img "Avatar 4 of 4"
  `);
  await mount(frame, '<div id="unnamed"><sl-avatar initials="NO"></sl-avatar></div><div id="removed"><sl-avatar label="Gone"></sl-avatar></div>');
  const unnamed = await frame.locator('#unnamed sl-avatar').evaluate(el => el.shadowRoot.querySelector('[part="base"]').getAttribute('aria-label'));
  expect(unnamed).toBe('');
  // An empty aria-label gives no name, and an img role takes none from its content.
  await expect(frame.locator('#unnamed sl-avatar [part="base"]')).toHaveRole('img');
  await expect(frame.locator('#unnamed sl-avatar [part="base"]')).toHaveAccessibleName('');
  await expect(frame.locator('#removed sl-avatar [part="base"]')).toHaveAccessibleName('Gone');
  // Removing the label attribute sets label to null, which the attribute binding writes as an empty string.
  const removed = await frame.locator('#removed sl-avatar').evaluate(async el => {
    el.removeAttribute('label');
    await el.updateComplete;
    return [el.label, el.shadowRoot.querySelector('[part="base"]').getAttribute('aria-label')];
  });
  expect(removed).toEqual([null, '']);
  await expect(frame.locator('#removed sl-avatar [part="base"]')).toHaveAccessibleName('');
});

test('custom icons example: the slotted sl-icon replaces the default icon and is drawn from the default library', async ({ page }) => {
  const { example } = await openPage(page);
  const frame = example('Custom Icons');
  await expect.poll(() => frame.locator('sl-avatar > sl-icon').evaluateAll(icons => icons.every(i => i.shadowRoot.querySelector('svg')))).toBe(true);
  const r = await frame.locator('sl-avatar').evaluateAll(els => els.map(el => {
    const slot = el.shadowRoot.querySelector('slot[name="icon"]');
    const icon = slot.assignedElements()[0];
    return [icon.getAttribute('name'), Boolean(slot.querySelector('sl-icon')), getComputedStyle(el.shadowRoot.querySelector('[part="icon"]')).position];
  }));
  expect(r).toEqual([['image', true, 'absolute'], ['archive', true, 'absolute'], ['briefcase', true, 'absolute']]);
});

test('avatar groups example: ::part(base) from the page draws the border and the avatars overlap by 1rem', async ({ page }) => {
  const { example } = await openPage(page);
  const r = await example('Avatar Groups').locator('.avatar-group').evaluate(group => {
    const avatars = [...group.querySelectorAll('sl-avatar')];
    const lefts = avatars.map(a => a.getBoundingClientRect().left);
    const cs = getComputedStyle(avatars[0].shadowRoot.querySelector('[part="base"]'));
    const probe = document.createElement('div');
    probe.style.color = 'var(--sl-color-neutral-0)';
    document.body.append(probe);
    const neutral0 = getComputedStyle(probe).color;
    probe.remove();
    return {
      steps: lefts.slice(1).map((l, i) => Math.round(l - lefts[i])),
      border: [cs.borderTopWidth, cs.borderTopStyle, cs.borderTopColor === neutral0],
      images: avatars.map(a => Boolean(a.shadowRoot.querySelector('[part="image"]'))),
    };
  });
  // Each avatar is 48px wide, plus the 2px borders, less the 16px negative margin.
  expect(r).toEqual({ steps: [36, 36, 36], border: ['2px', 'solid', true], images: [true, true, true, true] });
});

test('dir and lang are reactive, not reflected and undefined by default; the observed attributes are Shoelace\'s', async ({ page }) => {
  const { frame } = await openPage(page);
  await mount(frame, '<sl-avatar id="dl"></sl-avatar><sl-avatar id="attrs" dir="rtl" lang="de"></sl-avatar>');
  const r = await frame.locator('body').evaluate(async () => {
    const el = document.querySelector('#dl');
    const attrs = document.querySelector('#attrs');
    const ctor = customElements.get('sl-avatar');
    const defaults = [el.dir, el.lang];
    el.dir = 'auto';
    const updateRequestedByDir = el.isUpdatePending;
    await el.updateComplete;
    el.lang = 'fr';
    const updateRequestedByLang = el.isUpdatePending;
    await el.updateComplete;
    const assigned = [el.dir, el.lang, el.getAttribute('dir'), el.getAttribute('lang')];
    el.dir = 'sideways';
    const anyString = el.dir;
    const fromAttributes = [attrs.dir, attrs.lang];
    attrs.removeAttribute('dir');
    attrs.removeAttribute('lang');
    await attrs.updateComplete;
    return { observed: [...ctor.observedAttributes].sort(), defaults, updateRequestedByDir, updateRequestedByLang, assigned, anyString, fromAttributes, removed: [attrs.dir, attrs.lang] };
  });
  expect(r).toEqual({
    observed: ['dir', 'image', 'initials', 'label', 'lang', 'loading', 'shape'],
    defaults: [undefined, undefined],
    updateRequestedByDir: true,
    updateRequestedByLang: true,
    assigned: ['auto', 'fr', null, null],
    anyString: 'sideways',
    fromAttributes: ['rtl', 'de'],
    removed: [null, null],
  });
});

test('properties: Shoelace\'s defaults, only shape reflects, and the inherited core ready event fires once without bubbling', async ({ page }) => {
  const { frame } = await openPage(page);
  const r = await frame.locator('body').evaluate(async body => {
    const el = document.createElement('sl-avatar');
    const seen = [];
    let bubbled = 0;
    el.addEventListener('ready', event => seen.push({ bubbles: event.bubbles, composed: event.composed }));
    body.addEventListener('ready', () => bubbled++);
    const defaults = { image: el.image, label: el.label, initials: el.initials, loading: el.loading, shape: el.shape };
    body.append(el);
    await el.updateComplete;
    Object.assign(el, { image: 'data:,', label: 'L', initials: 'I', loading: 'lazy', shape: 'square' });
    await el.updateComplete;
    const attrs = el.getAttributeNames().sort();
    el.dir = 'rtl';
    await el.updateComplete;
    const own = Object.getOwnPropertyNames(customElements.get('sl-avatar').prototype).filter(n => n !== 'constructor').sort();
    el.remove();
    return { defaults, attrs, seen, bubbled, own };
  });
  expect(r.defaults).toEqual({ image: '', label: '', initials: '', loading: 'eager', shape: 'circle' });
  expect(r.attrs).toEqual(['shape']);
  expect(r.seen).toEqual([{ bubbles: false, composed: false }]);
  expect(r.bubbled).toBe(0);
  // Shoelace's members, the base element's dir and lang accessors, and the lifecycle hooks this class overrides.
  expect(r.own).toEqual(['attributeChangedCallback', 'avatarTemplate', 'dir', 'handleImageLoadError', 'hasError', 'image', 'initials',
    'label', 'lang', 'loading', 'shape', 'willUpdate'].sort());
});

test('the examples render in their own documents in Shoelace\'s order', async ({ page }) => {
  await openPage(page);
  const titles = await page.locator('iframe.example').evaluateAll(frames => frames.map(f => f.title));
  expect(titles).toEqual(SECTIONS.map(title));
  const counts = [];
  for (const section of SECTIONS) counts.push(await page.frameLocator(`iframe.example[title="${title(section)}"]`).locator('sl-avatar').count());
  expect(counts).toEqual([1, 2, 1, 3, 3, 4]);
});

// Shoelace's React examples, ported in packages/docs/examples/avatar/react/*.jsx (the files the docs page shows), bundled with
// React 19 and the generated wrappers, which are resolved through the package's real export map.
test.describe('React examples', () => {
  const names = ['basic', 'images', 'initials', 'custom-icons', 'shapes', 'groups'];
  let bundle;

  test.beforeAll(async () => {
    const fromVelcro = createRequire(path.join(velcroDir, 'package.json'));
    const fromDocs = createRequire(path.join(docsDir, 'package.json'));
    const pkgDir = name => path.dirname(fromVelcro.resolve(`${name}/package.json`));
    const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
    const dir = mkdtempSync(path.join(tmpdir(), 'velcro-avatar-react-'));
    try {
      // Each example declares `App` without exporting it (as on Shoelace's page); the copies only append the export.
      for (const name of names) {
        writeFileSync(path.join(dir, `${name}.jsx`), `${readFileSync(path.join(docsDir, `examples/avatar/react/${name}.jsx`), 'utf8')}\nexport default App;\n`);
      }
      const entry = path.join(dir, 'entry.js');
      writeFileSync(entry, `
        import React from 'react';
        import { flushSync } from 'react-dom';
        import { createRoot } from 'react-dom/client';
        ${names.map((n, i) => `import App${i} from './${n}.jsx';`).join('\n')}
        const apps = { ${names.map((n, i) => `'${n}': App${i}`).join(', ')} };
        window.errors = [];
        addEventListener('error', e => window.errors.push(String(e.message)));
        addEventListener('unhandledrejection', e => window.errors.push(String(e.reason)));
        window.renderExample = name => {
          const host = document.createElement('div');
          host.id = name;
          document.body.append(host);
          flushSync(() => createRoot(host).render(React.createElement(apps[name])));
        };
      `);
      const out = await build({
        configFile: false, logLevel: 'silent', root: dir,
        plugins: [{
          name: 'velcro-package-exports',
          async resolveId(id) {
            if (!id.startsWith('@charm-ux/velcro/')) return null;
            return (await this.resolve(id, path.join(docsDir, 'app.ts'), { skipSelf: true })) ?? null;
          },
        }],
        resolve: { alias: { react: pkgDir('react'), 'react-dom': pkgDir('react-dom') } },
        define: { 'process.env.NODE_ENV': '"production"' },
        build: { write: false, minify: false, rollupOptions: { input: entry, output: { format: 'es', codeSplitting: false } } },
      });
      bundle = (Array.isArray(out) ? out[0] : out).output.find(o => o.type === 'chunk').code;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('render the same avatars as the HTML examples, through the generated wrappers, with the theme tokens applied', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    const themeCss = readFileSync(path.join(velcroDir, 'themes/light.css'), 'utf8');
    await page.setContent('<!DOCTYPE html><html class="sl-theme-light"><body style="margin: 0"></body></html>');
    await page.addStyleTag({ content: themeCss });
    await page.addScriptTag({ type: 'module', content: bundle });
    await page.waitForFunction(() => typeof window.renderExample === 'function');
    const r = await page.evaluate(async names => {
      const out = {};
      for (const name of names) {
        window.renderExample(name);
        await customElements.whenDefined('sl-avatar');
        const avatars = [...document.querySelectorAll(`#${name} sl-avatar`)];
        await Promise.all(avatars.map(a => a.updateComplete));
        out[name] = avatars.map(a => {
          const base = a.shadowRoot.querySelector('[part="base"]');
          const shown = [...base.querySelectorAll('[part]')].map(n => n.getAttribute('part')).join();
          return [base.getAttribute('aria-label'), shown, a.shape, a.loading, a.querySelector('sl-icon')?.getAttribute('name') ?? null];
        });
      }
      const groupBase = getComputedStyle(document.querySelector('#groups sl-avatar').shadowRoot.querySelector('[part="base"]'));
      return { out, groupBorder: groupBase.borderTopWidth, background: groupBase.backgroundColor, errors: window.errors };
    }, names);
    expect(r.out).toEqual({
      basic: [['User avatar', 'icon', 'circle', 'eager', null]],
      images: [
        ['Avatar of a placeholder person on a blue background', 'image', 'circle', 'eager', null],
        ['Avatar of a placeholder person on a purple background', 'image', 'circle', 'lazy', null],
      ],
      initials: [['Avatar with initials: SL', 'initials', 'circle', 'eager', null]],
      'custom-icons': [
        ['Avatar with an image icon', 'icon', 'circle', 'eager', 'image'],
        ['Avatar with an archive icon', 'icon', 'circle', 'eager', 'archive'],
        ['Avatar with a briefcase icon', 'icon', 'circle', 'eager', 'briefcase'],
      ],
      shapes: [['Square avatar', 'icon', 'square', 'eager', null], ['Rounded avatar', 'icon', 'rounded', 'eager', null], ['Circle avatar', 'icon', 'circle', 'eager', null]],
      groups: [1, 2, 3, 4].map(i => [`Avatar ${i} of 4`, 'image', 'circle', 'eager', null]),
    });
    expect(r.groupBorder).toBe('2px');
    expect(r.background).toBe('rgb(161, 161, 170)');
    expect(r.errors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});

test.describe('React wrapper', () => {
  const mount = reactWrapperPage(test);

  test('passes Shoelace\'s props and calls onSlError when the image fails', async ({ page }) => {
    const errors = await mount(page);
    const r = await page.evaluate(async () => {
      const failures = [];
      window.renderWrapper('VelcroAvatar', { image: 'data:image/png;base64,AAAA', initials: 'RW', label: 'Wrapped', shape: 'rounded', loading: 'lazy', onSlError: e => failures.push(e.type) });
      const el = document.querySelector('#wrapped');
      await customElements.whenDefined('sl-avatar');
      await el.updateComplete;
      const img = el.shadowRoot.querySelector('img');
      const loading = img?.getAttribute('loading');
      await new Promise(resolve => { const t = setInterval(() => { if (failures.length) { clearInterval(t); resolve(); } }, 20); });
      await el.updateComplete;
      return { failures, loading, shape: el.getAttribute('shape'), label: el.shadowRoot.querySelector('[part="base"]').getAttribute('aria-label'),
        shown: el.shadowRoot.querySelector('[part="initials"]')?.textContent };
    });
    expect(r).toEqual({ failures: ['sl-error'], loading: 'lazy', shape: 'rounded', label: 'Wrapped', shown: 'RW' });
    expect(errors).toEqual([]);
  });
});

test('no upstream Shoelace runtime is requested or defined; no request leaves the local origin', async ({ page }) => {
  const { frame, requests } = await openPage(page);
  expect(requests.filter(url => /shoelace|unsplash/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  expect(await frame.locator('body').evaluate(() => Boolean(window.Shoelace || document.querySelector('script[src*="shoelace"]')))).toBe(false);
});

// The class-only entry (@charm-ux/velcro/avatar/class), bundled alone through the package's real export map: no
// registering entry, no aggregate and no docs page. Shoelace's avatar declares sl-icon in `static dependencies`, and its
// base element defines each missing dependency when an avatar is constructed; Velcro's does the same.
test.describe('class-only entry', () => {
  let bundle;

  test.beforeAll(async () => {
    const fromDocs = createRequire(path.join(docsDir, 'package.json'));
    const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
    const dir = mkdtempSync(path.join(tmpdir(), 'velcro-avatar-class-'));
    try {
      const entry = path.join(dir, 'entry.js');
      writeFileSync(entry, `
        import { SlAvatar, VelcroAvatar } from '@charm-ux/velcro/avatar/class';
        import { SlIcon } from '@charm-ux/velcro/icon/class';
        window.avatarClass = { SlAvatar, VelcroAvatar, SlIcon };
      `);
      const out = await build({
        configFile: false, logLevel: 'silent', root: dir,
        plugins: [{
          name: 'velcro-package-exports',
          async resolveId(id) {
            if (!id.startsWith('@charm-ux/velcro/')) return null;
            return (await this.resolve(id, path.join(docsDir, 'app.ts'), { skipSelf: true })) ?? null;
          },
        }],
        build: { write: false, minify: false, rollupOptions: { input: entry, output: { format: 'es', codeSplitting: false } } },
      });
      bundle = (Array.isArray(out) ? out[0] : out).output.find(o => o.type === 'chunk').code;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  async function load(page) {
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    const themeCss = readFileSync(path.join(velcroDir, 'themes/light.css'), 'utf8');
    await page.setContent('<!DOCTYPE html><html class="sl-theme-light"><body></body></html>');
    await page.addStyleTag({ content: themeCss });
    await page.addScriptTag({ type: 'module', content: bundle });
    await page.waitForFunction(() => Boolean(window.avatarClass));
    return pageErrors;
  }

  test('importing defines nothing; constructing an avatar defines Velcro\'s sl-icon, so the default icon renders', async ({ page }) => {
    const pageErrors = await load(page);
    const r = await page.evaluate(async () => {
      const { SlAvatar, VelcroAvatar } = window.avatarClass;
      const tags = () => ['sl-avatar', 'sl-icon'].map(t => customElements.get(t)?.name ?? null);
      const afterImport = tags();
      customElements.define('sl-avatar', SlAvatar);
      const afterDefine = tags();
      const avatar = document.createElement('sl-avatar');
      avatar.label = 'User avatar';
      document.body.append(avatar);
      await avatar.updateComplete;
      const icon = avatar.shadowRoot.querySelector('slot[name="icon"] sl-icon');
      await icon.updateComplete;
      return {
        afterImport, afterDefine, afterConstruct: tags(), alias: SlAvatar === VelcroAvatar,
        iconClass: customElements.get('sl-icon') === icon.constructor && icon.constructor.baseName,
        name: icon.getAttribute('name'), library: icon.getAttribute('library'),
      };
    });
    expect(r).toEqual({
      afterImport: [null, null], afterDefine: ['VelcroAvatar', null], afterConstruct: ['VelcroAvatar', 'VelcroIcon'], alias: true,
      iconClass: 'icon', name: 'person-fill', library: 'system',
    });
    await expect.poll(() => page.locator('sl-avatar sl-icon').evaluate(i => Boolean(i.shadowRoot.querySelector('svg')))).toBe(true);
    const box = await page.locator('sl-avatar').evaluate(a => a.shadowRoot.querySelector('[part="icon"] sl-icon').getBoundingClientRect().width);
    expect(box).toBeGreaterThan(0);
    expect(pageErrors).toEqual([]);
  });

  // The platform refuses to define one constructor under two names; Shoelace then defines an anonymous subclass.
  test('when the icon class is already defined under another tag, constructing an avatar defines sl-icon as a subclass of it', async ({ page }) => {
    const pageErrors = await load(page);
    const r = await page.evaluate(async () => {
      const { SlAvatar, SlIcon } = window.avatarClass;
      customElements.define('my-icon', SlIcon);
      customElements.define('sl-avatar', SlAvatar);
      const avatar = document.createElement('sl-avatar');
      avatar.label = 'User avatar';
      document.body.append(avatar);
      await avatar.updateComplete;
      const defined = customElements.get('sl-icon');
      const icon = avatar.shadowRoot.querySelector('slot[name="icon"] sl-icon');
      await icon.updateComplete;
      return {
        avatar: avatar instanceof SlAvatar, myIcon: customElements.get('my-icon') === SlIcon,
        subclass: Boolean(defined) && defined !== SlIcon && defined.prototype instanceof SlIcon, icon: icon instanceof defined,
      };
    });
    expect(r).toEqual({ avatar: true, myIcon: true, subclass: true, icon: true });
    await expect.poll(() => page.locator('sl-avatar').evaluate(a => Boolean(a.shadowRoot.querySelector('sl-icon').shadowRoot?.querySelector('svg')))).toBe(true);
    expect(pageErrors).toEqual([]);
  });

  test('an sl-icon another constructor already owns is left in place, without an error', async ({ page }) => {
    const pageErrors = await load(page);
    const r = await page.evaluate(async () => {
      class OtherIcon extends HTMLElement {}
      customElements.define('sl-icon', OtherIcon);
      customElements.define('sl-avatar', window.avatarClass.SlAvatar);
      const avatar = document.createElement('sl-avatar');
      document.body.append(avatar);
      await avatar.updateComplete;
      const icon = avatar.shadowRoot.querySelector('slot[name="icon"] sl-icon');
      return [customElements.get('sl-icon') === OtherIcon, icon instanceof OtherIcon];
    });
    expect(r).toEqual([true, true]);
    expect(pageErrors).toEqual([]);
  });
});
