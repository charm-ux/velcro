import { expect, test } from '@playwright/test';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/resize-observer';

async function openExample(page) {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  const frame = page.frameLocator('iframe.example');
  await expect(frame.locator('#demo-box')).toBeVisible();
  await frame.locator('#demo-observer').evaluate(() => customElements.whenDefined('sl-resize-observer'));
  // Rendering only: a test that reads the requests waits for the network to go quiet itself (documentsLoaded).
  return { frame, requests };
}

// Resolves with the number of sl-resize events seen on `host` within a short window after `action` ran.
const countAfter = (host, action) =>
  host.evaluate(async (el, src) => {
    let n = 0;
    const onResize = () => n++;
    el.addEventListener('sl-resize', onResize);
    await new Promise(resolve => requestAnimationFrame(resolve));
    n = 0;
    // eslint-disable-next-line no-new-func
    await new Function('el', `return (${src})(el)`)(el);
    await new Promise(resolve => setTimeout(resolve, 300));
    el.removeEventListener('sl-resize', onResize);
    return n;
  }, action);

test('docs page is prerendered with Velcro branding, prototype status and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Resize Observer - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('sl-resize');
  expect(html).toContain('disabled');
  expect(html).toContain('without changing the shared core prefix');
  expect(html).toContain('Shoelace React example is not ported');
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
  const home = await (await request.get('/')).text();
  expect(home).toContain('/components/resize-observer');
});

test('sl-resize-observer registers inside the example document (the docs page registers its own copy separately), as the exported class', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  await documentsLoaded(page);
  // The docs page loads the same runtime through its client entry (app-main.ts) into its own, separate registry.
  expect(await page.evaluate(() => customElements.whenDefined('sl-resize-observer').then(ctor => typeof ctor))).toBe('function');
  const info = await frame.locator('body').evaluate(() => {
    const ctor = customElements.get('sl-resize-observer');
    return { defined: ctor !== undefined, baseName: ctor?.baseName, viaConstructor: ctor ? new ctor().localName : null };
  });
  expect(info).toEqual({ defined: true, baseName: 'resize-observer', viaConstructor: 'sl-resize-observer' });
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
});

test('structure: a default slot only, no parts, no host role; the example content is assigned to it', async ({ page }) => {
  const { frame } = await openExample(page);
  const info = await frame.locator('#demo-observer').evaluate(el => ({
    parts: [...el.shadowRoot.querySelectorAll('[part]')].map(n => n.getAttribute('part')),
    children: [...el.shadowRoot.children].filter(n => n.localName !== 'style').map(n => n.localName),
    slots: [...el.shadowRoot.querySelectorAll('slot')].map(s => s.name),
    assigned: el.shadowRoot.querySelector('slot').assignedElements().map(n => n.id),
    hostRole: el.getAttribute('role'),
    attrs: el.getAttributeNames().sort(),
  }));
  expect(info).toEqual({ parts: [], children: ['slot'], slots: [''], assigned: ['demo-box'], hostRole: null, attrs: ['id'] });
});

test('host is display: contents, so the slotted box lays out as if the host were absent', async ({ page }) => {
  const { frame } = await openExample(page);
  expect(await frame.locator('#demo-observer').evaluate(el => getComputedStyle(el).display)).toBe('contents');
  // No box of its own: the slotted box is a direct layout child of the example container.
  expect(await frame.locator('#demo-observer').evaluate(el => el.getClientRects().length)).toBe(0);
  expect(await frame.locator('#demo-box').evaluate(el => getComputedStyle(el).borderTopColor)).toBe('rgb(212, 212, 216)');
  // [hidden] still hides it (core base rule).
  const hidden = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-resize-observer');
    document.body.append(el);
    await el.updateComplete;
    el.hidden = true;
    await el.updateComplete;
    const out = getComputedStyle(el).display;
    el.remove();
    return out;
  });
  expect(hidden).toBe('none');
});

test('disabled: boolean property, reflected attribute, default false, restored when the attribute is removed', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-resize-observer');
    document.body.append(el);
    await el.updateComplete;
    const out = { initial: [el.disabled, el.hasAttribute('disabled')] };
    el.disabled = true;
    await el.updateComplete;
    out.afterProp = [el.disabled, el.getAttribute('disabled')];
    el.removeAttribute('disabled');
    await el.updateComplete;
    out.afterRemove = [el.disabled, el.hasAttribute('disabled')];
    el.setAttribute('disabled', '');
    await el.updateComplete;
    out.afterAttr = [el.disabled, el.hasAttribute('disabled')];
    out.observed = [...customElements.get('sl-resize-observer').observedAttributes].sort();
    el.remove();
    return out;
  });
  expect(r).toEqual({
    initial: [false, false],
    afterProp: [true, ''],
    afterRemove: [false, false],
    afterAttr: [true, true],
    observed: ['dir', 'disabled'],
  });
});

test('the example reports its initial size and resizes through sl-resize with entries in detail', async ({ page }) => {
  const { frame } = await openExample(page);
  await expect(frame.locator('#demo-count')).not.toHaveText('0');
  const result = await frame.locator('#demo-observer').evaluate(async el => {
    const box = el.querySelector('#demo-box');
    const seen = new Promise(resolve => el.addEventListener('sl-resize', event => resolve(event), { once: true }));
    box.style.width = '321px';
    const event = await seen;
    return {
      bubbles: event.bubbles,
      composed: event.composed,
      cancelable: event.cancelable,
      isArray: Array.isArray(event.detail.entries),
      length: event.detail.entries.length,
      isEntry: event.detail.entries[0] instanceof ResizeObserverEntry,
      target: event.detail.entries[0].target.id,
      width: Math.round(event.detail.entries[0].contentBoxSize[0].inlineSize),
      type: event.type,
    };
  });
  expect(result).toEqual({ bubbles: true, composed: true, cancelable: false, isArray: true, length: 1, isEntry: true, target: 'demo-box', width: 321, type: 'sl-resize' });
  await expect(frame.locator('#demo-log')).toHaveText(/^\d+ x \d+$/);
});

test('the event bubbles to ancestors outside the host', async ({ page }) => {
  const { frame } = await openExample(page);
  const got = await frame.locator('#demo-observer').evaluate(async el => {
    const seen = new Promise(resolve => document.body.addEventListener('sl-resize', event => resolve(event.target.localName), { once: true }));
    el.querySelector('#demo-box').style.width = '250px';
    return seen;
  });
  expect(got).toBe('sl-resize-observer');
});

test('disabled stops observation, re-enabling restarts it, and a disabled-at-creation observer stays silent', async ({ page }) => {
  const { frame } = await openExample(page);
  const host = frame.locator('#demo-observer');
  const widths = ['200px', '240px', '280px', '320px'];
  let i = 0;
  const resize = () => `el => { el.querySelector('#demo-box').style.width = '${widths[i++ % widths.length]}'; }`;
  expect(await countAfter(host, resize())).toBeGreaterThan(0);
  await host.evaluate(async el => { el.disabled = true; await el.updateComplete; });
  expect(await countAfter(host, resize())).toBe(0);
  await host.evaluate(async el => { el.disabled = false; await el.updateComplete; });
  // Restarting observes the element again, which reports its current size once.
  expect(await countAfter(host, resize())).toBeGreaterThan(0);
  const created = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-resize-observer');
    el.setAttribute('disabled', '');
    const child = document.createElement('div');
    child.style.width = '50px';
    child.textContent = 'x';
    el.append(child);
    document.body.append(el);
    await el.updateComplete;
    let n = 0;
    el.addEventListener('sl-resize', () => n++);
    await new Promise(resolve => setTimeout(resolve, 200));
    child.style.width = '90px';
    await new Promise(resolve => setTimeout(resolve, 200));
    const silent = n;
    el.disabled = false;
    await el.updateComplete;
    await new Promise(resolve => setTimeout(resolve, 200));
    const after = n;
    el.remove();
    return { silent, after };
  });
  expect(created.silent).toBe(0);
  expect(created.after).toBeGreaterThan(0);
});

test('slot changes: added elements are observed, removed elements stop being observed', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-resize-observer');
    const first = document.createElement('div');
    first.id = 'first';
    first.textContent = 'a';
    el.append(first);
    document.body.append(el);
    await el.updateComplete;
    const targets = [];
    el.addEventListener('sl-resize', event => event.detail.entries.forEach(e => targets.push(e.target.id)));
    const wait = () => new Promise(resolve => setTimeout(resolve, 250));
    await wait();
    const initial = [...new Set(targets)];
    targets.length = 0;
    const second = document.createElement('div');
    second.id = 'second';
    second.textContent = 'b';
    el.append(second);
    await wait();
    const afterAdd = [...new Set(targets)];
    targets.length = 0;
    first.remove();
    await wait();
    targets.length = 0;
    first.style.width = '77px';
    second.style.width = '66px';
    await wait();
    const afterRemove = [...new Set(targets)];
    el.remove();
    return { initial, afterAdd, afterRemove };
  });
  expect(r.initial).toEqual(['first']);
  expect(r.afterAdd).toContain('second');
  expect(r.afterRemove).toEqual(['second']);
});

test('disconnecting stops observation; reconnecting resumes it', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-resize-observer');
    const child = document.createElement('div');
    child.textContent = 'x';
    el.append(child);
    document.body.append(el);
    await el.updateComplete;
    let n = 0;
    el.addEventListener('sl-resize', () => n++);
    const wait = () => new Promise(resolve => setTimeout(resolve, 250));
    await wait();
    const connected = n;
    el.remove();
    n = 0;
    child.style.width = '123px';
    await wait();
    const whileDetached = n;
    document.body.append(el);
    await wait();
    const reconnected = n;
    el.remove();
    return { connected, whileDetached, reconnected };
  });
  expect(r.connected).toBeGreaterThan(0);
  expect(r.whileDetached).toBe(0);
  // Slotchange does not fire on reconnect, so the connectedCallback path restarts observation (as upstream).
  expect(r.reconnected).toBeGreaterThan(0);
});

test('emits the inherited core ready event once (non-bubbling) and sets no host role', async ({ page }) => {
  const { frame } = await openExample(page);
  const result = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-resize-observer');
    const events = [];
    el.addEventListener('ready', event => events.push({ bubbles: event.bubbles, composed: event.composed }));
    document.body.append(el);
    await el.updateComplete;
    const out = { events, role: el.getAttribute('role') };
    el.remove();
    return out;
  });
  expect(result.events).toEqual([{ bubbles: false, composed: false }]);
  expect(result.role).toBeNull();
});

test('no upstream Shoelace runtime is requested or defined; all requests stay on the local origin', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  await documentsLoaded(page);
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  expect(await frame.locator('body').evaluate(() => Boolean(window.Shoelace || document.querySelector('script[src*="shoelace"]')))).toBe(false);
});
