import { expect, test } from '@playwright/test';

const PAGE = '/components/mutation-observer';
const TITLES = { overview: 'Mutation Observer example: Overview', 'child-list': 'Mutation Observer example: Child List' };

async function openExample(page, which = 'overview') {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  // Litro's client router remounts the page component once after load, which reloads the iframes; wait for it to settle.
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  const frame = page.frameLocator(`iframe[title="${TITLES[which]}"]`);
  await expect(frame.locator('#demo-observer')).toBeAttached();
  await frame.locator('#demo-observer').evaluate(() => customElements.whenDefined('sl-mutation-observer'));
  await page.waitForLoadState('networkidle');
  return { frame, requests };
}

// Runs `body` (the text of an async function body) inside the example document, with two helpers in scope:
//   make(attrs, content) creates and connects an <sl-mutation-observer>, waits for its first update and returns
//     { el, events }, where `events` collects one summary array per sl-mutation event (one entry per record);
//   tick() waits long enough for a pending MutationObserver delivery.
// The body returns a JSON-serializable result.
const run = (frame, body) =>
  frame.locator('body').evaluate(async (_, src) => {
    const make = async (attrs = {}, content = '<p id="a" class="x">text</p>') => {
      const el = document.createElement('sl-mutation-observer');
      for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
      el.innerHTML = content;
      const events = [];
      el.addEventListener('sl-mutation', event => {
        events.push(
          event.detail.mutationList.map(r => ({
            type: r.type,
            name: r.attributeName,
            old: r.oldValue,
            added: r.addedNodes.length,
            removed: r.removedNodes.length,
            target: r.target.nodeType === Node.TEXT_NODE ? '#text' : r.target.localName,
          }))
        );
      });
      document.body.append(el);
      await el.updateComplete;
      return { el, events };
    };
    const tick = () => new Promise(resolve => setTimeout(resolve, 40));
    // eslint-disable-next-line no-new-func
    return new Function('make', 'tick', `return (async () => { ${src} })()`)(make, tick);
  }, body);

test('docs page is prerendered with Velcro branding, prototype status and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Mutation Observer - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('sl-mutation');
  expect(html).toContain('child-list');
  expect(html).toContain('char-data-old-value');
  expect(html).toContain('without changing the shared core prefix');
  expect(html).toContain('Shoelace React examples are not ported');
  expect(html).toContain('deliberately differs from Shoelace 2.20.1');
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
  const home = await (await request.get('/')).text();
  expect(home).toContain('/components/mutation-observer');
});

test('sl-mutation-observer registers inside the example document (the docs page registers its own copy separately), as the exported class', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  // The docs page loads the same runtime through its client entry (app-main.ts) into its own, separate registry.
  expect(await page.evaluate(() => customElements.whenDefined('sl-mutation-observer').then(ctor => typeof ctor))).toBe('function');
  const info = await frame.locator('body').evaluate(() => {
    const ctor = customElements.get('sl-mutation-observer');
    return { defined: ctor !== undefined, baseName: ctor?.baseName, viaConstructor: ctor ? new ctor().localName : null };
  });
  expect(info).toEqual({ defined: true, baseName: 'mutation-observer', viaConstructor: 'sl-mutation-observer' });
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
  expect(info).toEqual({ parts: [], children: ['slot'], slots: [''], assigned: ['demo-button'], hostRole: null, attrs: ['attr', 'id'] });
});

test('host is display: contents, so the slotted content lays out as if the host were absent', async ({ page }) => {
  const { frame } = await openExample(page);
  expect(await frame.locator('#demo-observer').evaluate(el => getComputedStyle(el).display)).toBe('contents');
  // No box of its own: the slotted button is a direct layout child of the example container.
  expect(await frame.locator('#demo-observer').evaluate(el => el.getClientRects().length)).toBe(0);
  expect(await frame.locator('#demo-button').evaluate(el => el.getClientRects().length)).toBe(1);
  // [hidden] hides it (core base rule; Shoelace has no such rule on the host).
  const hidden = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-mutation-observer');
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

test('boolean options: reflected properties, default false, removing the attribute restores false', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(
    frame,
    `
    const out = {};
    const el = document.createElement('sl-mutation-observer');
    document.body.append(el);
    await el.updateComplete;
    const options = [['attrOldValue', 'attr-old-value'], ['charData', 'char-data'], ['charDataOldValue', 'char-data-old-value'],
      ['childList', 'child-list'], ['disabled', 'disabled']];
    for (const [prop, attr] of options) {
      const step = {};
      step.initial = [el[prop], el.hasAttribute(attr)];
      el[prop] = true;
      await el.updateComplete;
      step.afterProp = [el[prop], el.getAttribute(attr)];
      el.removeAttribute(attr);
      await el.updateComplete;
      step.afterRemove = [el[prop], el.hasAttribute(attr)];
      el.setAttribute(attr, '');
      await el.updateComplete;
      step.afterAttr = [el[prop], el.hasAttribute(attr)];
      el[prop] = false;
      await el.updateComplete;
      step.afterFalse = [el[prop], el.hasAttribute(attr)];
      out[prop] = step;
    }
    out.observed = [...customElements.get('sl-mutation-observer').observedAttributes].sort();
    el.remove();
    return out;
  `
  );
  const step = { initial: [false, false], afterProp: [true, ''], afterRemove: [false, false], afterAttr: [true, true], afterFalse: [false, false] };
  expect(r).toEqual({
    attrOldValue: step,
    charData: step,
    charDataOldValue: step,
    childList: step,
    disabled: step,
    observed: ['attr', 'attr-old-value', 'char-data', 'char-data-old-value', 'child-list', 'dir', 'disabled'],
  });
});

test('attr: string property with no default, reflected, null when the attribute is removed', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(
    frame,
    `
    const el = document.createElement('sl-mutation-observer');
    document.body.append(el);
    await el.updateComplete;
    const out = { initial: [typeof el.attr, el.hasAttribute('attr')] };
    el.attr = 'class id';
    await el.updateComplete;
    out.afterProp = [el.attr, el.getAttribute('attr')];
    el.setAttribute('attr', 'title');
    await el.updateComplete;
    out.afterAttr = el.attr;
    el.removeAttribute('attr');
    await el.updateComplete;
    out.afterRemove = [el.attr, el.hasAttribute('attr')];
    el.remove();
    return out;
  `
  );
  expect(r).toEqual({
    initial: ['undefined', false],
    afterProp: ['class id', 'class id'],
    afterAttr: 'title',
    afterRemove: [null, false],
  });
});

test('attr="name": reports that attribute on descendants, with sl-mutation carrying a MutationRecord list, and nothing else', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(
    frame,
    `
    const { el, events } = await make({ attr: 'title' });
    const seen = new Promise(resolve => document.body.addEventListener('sl-mutation', e => resolve(e), { once: true }));
    const p = el.querySelector('p');
    p.setAttribute('class', 'y');
    await tick();
    const ignored = events.length;
    p.setAttribute('title', 'hello');
    const event = await seen;
    await tick();
    const out = {
      ignored,
      events,
      bubbles: event.bubbles,
      composed: event.composed,
      cancelable: event.cancelable,
      isArray: Array.isArray(event.detail.mutationList),
      isRecord: event.detail.mutationList[0] instanceof MutationRecord,
      keys: Object.keys(event.detail),
      target: event.target.localName,
    };
    el.remove();
    return out;
  `
  );
  expect(r).toEqual({
    ignored: 0,
    events: [[{ type: 'attributes', name: 'title', old: null, added: 0, removed: 0, target: 'p' }]],
    bubbles: true,
    composed: true,
    cancelable: false,
    isArray: true,
    isRecord: true,
    keys: ['mutationList'],
    target: 'sl-mutation-observer',
  });
});

test('attr takes a space-separated list, and "*" watches every attribute, including the host\'s own', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(
    frame,
    `
    const out = {};
    const list = await make({ attr: 'class id' });
    const p = list.el.querySelector('p');
    p.setAttribute('title', 'x');
    await tick();
    out.listIgnored = list.events.length;
    p.setAttribute('class', 'z');
    p.setAttribute('id', 'b');
    await tick();
    out.list = list.events.map(e => e.map(r => r.name));
    list.el.remove();

    const all = await make({ attr: '*' });
    await tick();
    out.allQuiet = all.events.length;
    all.el.querySelector('p').setAttribute('data-x', '1');
    await tick();
    // The host is observed too: its reflected option attributes are reported.
    all.el.childList = true;
    await all.el.updateComplete;
    await tick();
    out.all = all.events.flat().map(r => [r.name, r.target]);
    all.el.remove();
    return out;
  `
  );
  expect(r).toEqual({
    listIgnored: 0,
    list: [['class', 'id']],
    allQuiet: 0,
    all: [['data-x', 'p'], ['child-list', 'sl-mutation-observer']],
  });
});

test('an empty configuration observes nothing and raises no error', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const { frame } = await openExample(page);
  const r = await run(
    frame,
    `
    const out = {};
    for (const [label, attrs] of [['none', {}], ['empty attr', { attr: '' }], ['old value without target', { 'attr-old-value': '', 'char-data-old-value': '' }]]) {
      const { el, events } = await make(attrs);
      const p = el.querySelector('p');
      p.setAttribute('title', 'x');
      p.firstChild.data = 'changed';
      p.append(document.createElement('i'));
      await tick();
      out[label] = events.length;
      el.remove();
    }
    return out;
  `
  );
  expect(r).toEqual({ none: 0, 'empty attr': 0, 'old value without target': 0 });
  expect(errors).toEqual([]);
});

test('attr-old-value, char-data and char-data-old-value report old values and text changes', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(
    frame,
    `
    const out = {};
    const old = await make({ attr: 'title', 'attr-old-value': '' });
    const p = old.el.querySelector('p');
    p.setAttribute('title', 'one');
    await tick();
    p.setAttribute('title', 'two');
    await tick();
    out.attrOld = old.events.flat().map(r => r.old);
    old.el.remove();

    const noOld = await make({ attr: 'title' });
    const q = noOld.el.querySelector('p');
    q.setAttribute('title', 'one');
    await tick();
    q.setAttribute('title', 'two');
    await tick();
    out.attrNoOld = noOld.events.flat().map(r => r.old);
    noOld.el.remove();

    const text = await make({ 'char-data': '' });
    const t = text.el.querySelector('p').firstChild;
    t.data = 'one';
    await tick();
    out.charData = text.events.flat().map(r => [r.type, r.old, r.target]);
    text.el.remove();

    const textOld = await make({ 'char-data': '', 'char-data-old-value': '' });
    const u = textOld.el.querySelector('p').firstChild;
    u.data = 'one';
    await tick();
    u.data = 'two';
    await tick();
    out.charDataOld = textOld.events.flat().map(r => [r.type, r.old]);
    textOld.el.remove();

    // char-data alone does not report attribute or child changes.
    const only = await make({ 'char-data': '' });
    only.el.querySelector('p').setAttribute('title', 'x');
    only.el.querySelector('p').append(document.createElement('i'));
    await tick();
    out.charDataOnly = only.events.length;
    only.el.remove();
    return out;
  `
  );
  expect(r).toEqual({
    attrOld: [null, 'one'],
    attrNoOld: [null, null],
    charData: [['characterData', null, '#text']],
    charDataOld: [['characterData', 'text'], ['characterData', 'one']],
    charDataOnly: 0,
  });
});

test('child-list reports added and removed children anywhere in the subtree', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(
    frame,
    `
    const { el, events } = await make({ 'child-list': '' }, '<div id="outer"><p id="inner">text</p></div>');
    el.append(document.createElement('b'));
    await tick();
    const outer = el.querySelector('#outer');
    outer.querySelector('#inner').append(document.createElement('i'));
    await tick();
    el.querySelector('b').remove();
    await tick();
    // Attribute changes are not reported by child-list alone.
    outer.setAttribute('title', 'x');
    await tick();
    const out = events.flat().map(r => [r.type, r.added, r.removed, r.target]);
    el.remove();
    return out;
  `
  );
  expect(r).toEqual([
    ['childList', 1, 0, 'sl-mutation-observer'],
    ['childList', 1, 0, 'p'],
    ['childList', 0, 1, 'sl-mutation-observer'],
  ]);
});

test('mutations made together are delivered in one event, one record each', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(
    frame,
    `
    const { el, events } = await make({ attr: 'title' });
    const p = el.querySelector('p');
    p.setAttribute('title', 'a');
    p.setAttribute('title', 'b');
    await tick();
    const out = events.map(e => e.length);
    el.remove();
    return out;
  `
  );
  expect(r).toEqual([2]);
});

test('disabled stops observation, re-enabling restarts it, and a disabled-at-creation observer stays silent', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(
    frame,
    `
    const out = {};
    const { el, events } = await make({ 'child-list': '' });
    const add = () => el.append(document.createElement('i'));
    add();
    await tick();
    out.enabled = events.length;
    el.disabled = true;
    await el.updateComplete;
    add();
    await tick();
    out.disabled = events.length;
    el.disabled = false;
    await el.updateComplete;
    add();
    await tick();
    out.reenabled = events.length;
    el.remove();

    const created = await make({ 'child-list': '', disabled: '' });
    created.el.append(document.createElement('i'));
    await tick();
    out.createdDisabled = created.events.length;
    created.el.disabled = false;
    await created.el.updateComplete;
    created.el.append(document.createElement('i'));
    await tick();
    out.createdEnabled = created.events.length;
    created.el.remove();
    return out;
  `
  );
  expect(r).toEqual({ enabled: 1, disabled: 1, reenabled: 2, createdDisabled: 0, createdEnabled: 1 });
});

test('options assigned right after the element is connected, before its first update, take effect', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(
    frame,
    `
    const el = document.createElement('sl-mutation-observer');
    el.innerHTML = '<p>text</p>';
    const events = [];
    el.addEventListener('sl-mutation', e => events.push(e.detail.mutationList.length));
    document.body.append(el);
    el.childList = true;
    await el.updateComplete;
    el.append(document.createElement('i'));
    await tick();
    const out = events.length;
    el.remove();
    return out;
  `
  );
  expect(r).toBe(1);
});

test('changing any option after the first update restarts the observer (documented divergence from Shoelace 2.20.1, whose watchers for three of them never fire)', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(
    frame,
    `
    const out = {};
    const settle = async el => { await el.updateComplete; await tick(); };

    const attr = await make({ 'child-list': '' });
    attr.el.attr = 'title';
    await settle(attr.el);
    attr.el.querySelector('p').setAttribute('title', 'x');
    await tick();
    out.attr = attr.events.length;
    attr.el.remove();

    const childList = await make({ attr: 'title' });
    childList.el.childList = true;
    await settle(childList.el);
    childList.el.append(document.createElement('i'));
    await tick();
    out.childList = childList.events.flat().map(r => r.type);
    childList.el.remove();

    const charData = await make({ attr: 'title' });
    charData.el.charData = true;
    await settle(charData.el);
    charData.el.querySelector('p').firstChild.data = 'changed';
    await tick();
    out.charData = charData.events.flat().map(r => r.type);
    charData.el.remove();

    const attrOld = await make({ attr: 'title' });
    const p = attrOld.el.querySelector('p');
    p.setAttribute('title', 'one');
    await tick();
    attrOld.el.attrOldValue = true;
    await settle(attrOld.el);
    p.setAttribute('title', 'two');
    await tick();
    out.attrOldValue = attrOld.events.flat().map(r => r.old);
    attrOld.el.remove();

    const charDataOld = await make({ 'char-data': '' });
    const t = charDataOld.el.querySelector('p').firstChild;
    t.data = 'one';
    await tick();
    charDataOld.el.charDataOldValue = true;
    await settle(charDataOld.el);
    t.data = 'two';
    await tick();
    out.charDataOldValue = charDataOld.events.flat().map(r => r.old);
    charDataOld.el.remove();

    // Turning an option off stops reporting it.
    const off = await make({ 'child-list': '', 'char-data': '' });
    off.el.charData = false;
    await settle(off.el);
    off.el.querySelector('p').firstChild.data = 'changed';
    await tick();
    out.off = off.events.length;
    off.el.remove();
    return out;
  `
  );
  expect(r).toEqual({
    attr: 1,
    childList: ['childList'],
    charData: ['characterData'],
    attrOldValue: [null, 'one'],
    charDataOldValue: [null, 'one'],
    off: 0,
  });
});

test('a disabled observer stays stopped when an option changes (documented divergence: Shoelace 2.20.1 restarts it)', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(
    frame,
    `
    const { el, events } = await make({ 'child-list': '', disabled: '' });
    el.attr = 'title';
    el.charData = true;
    await el.updateComplete;
    el.childList = false;
    el.childList = true;
    await el.updateComplete;
    const p = el.querySelector('p');
    p.setAttribute('title', 'x');
    p.firstChild.data = 'changed';
    el.append(document.createElement('i'));
    await tick();
    const out = { whileDisabled: events.length };
    el.disabled = false;
    await el.updateComplete;
    p.setAttribute('title', 'y');
    el.append(document.createElement('i'));
    await tick();
    out.afterEnable = events.flat().map(r => r.type).sort();
    el.remove();
    return out;
  `
  );
  expect(r).toEqual({ whileDisabled: 0, afterEnable: ['attributes', 'childList'] });
});

test('nothing is observed while disconnected, and reconnecting reports each mutation once (documented divergence from Shoelace 2.20.1)', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(
    frame,
    `
    const out = {};
    const { el, events } = await make({ 'child-list': '' });
    const add = () => el.append(document.createElement('i'));
    el.remove();
    add();
    await tick();
    out.detached = events.length;
    // A property change while disconnected must not restart observation.
    el.childList = false;
    el.childList = true;
    await el.updateComplete;
    add();
    await tick();
    out.detachedAfterChange = events.length;
    document.body.append(el);
    await el.updateComplete;
    add();
    await tick();
    out.reconnected = events.length;
    // Reconnecting repeatedly never stacks observers.
    el.remove();
    document.body.append(el);
    el.remove();
    document.body.append(el);
    await el.updateComplete;
    add();
    await tick();
    out.reconnectedAgain = events.length;
    el.remove();
    return out;
  `
  );
  expect(r).toEqual({ detached: 0, detachedAfterChange: 0, reconnected: 1, reconnectedAgain: 2 });
});

test('core ready event: dispatched once after the first update, not bubbling', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(
    frame,
    `
    const el = document.createElement('sl-mutation-observer');
    const seen = [];
    el.addEventListener('ready', e => seen.push(e.bubbles));
    document.addEventListener('ready', () => seen.push('document'));
    document.body.append(el);
    await el.updateComplete;
    await tick();
    const out = seen;
    el.remove();
    return out;
  `
  );
  expect(r).toEqual([false]);
});

test('the overview example reports the button\'s first render and then each variant change through sl-mutation', async ({ page }) => {
  const { frame } = await openExample(page);
  // The button reflects its own variant attribute when it first renders (a Lit property with a default that is set from
  // the attribute), which is a mutation of the watched attribute like any other.
  await expect(frame.locator('#demo-count')).toHaveText('1');
  await expect(frame.locator('#demo-log')).toHaveText('attributes: variant = primary');
  await frame.locator('#demo-button').click();
  await expect(frame.locator('#demo-count')).toHaveText('2');
  await expect(frame.locator('#demo-log')).toHaveText('attributes: variant = success');
  await expect(frame.locator('#demo-button')).toHaveAttribute('variant', 'success');
  await frame.locator('#demo-button').click();
  await expect(frame.locator('#demo-count')).toHaveText('3');
  await expect(frame.locator('#demo-log')).toHaveText('attributes: variant = neutral');
});

test('the child list example reports buttons being added and removed', async ({ page }) => {
  const { frame } = await openExample(page, 'child-list');
  await expect(frame.locator('#demo-count')).toHaveText('0');
  await frame.locator('#demo-add').click();
  await expect(frame.locator('#demo-count')).toHaveText('1');
  await expect(frame.locator('#demo-log')).toHaveText('childList: 1 added, 0 removed');
  await frame.locator('#demo-add').click();
  await expect(frame.locator('#demo-count')).toHaveText('2');
  await frame.locator('.buttons sl-button:not([variant="primary"])').first().click();
  await expect(frame.locator('#demo-count')).toHaveText('3');
  await expect(frame.locator('#demo-log')).toHaveText('childList: 0 added, 1 removed');
  await expect(frame.locator('.buttons sl-button')).toHaveCount(2);
});

test('no Shoelace code or asset is loaded', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  expect(await frame.locator('body').evaluate(() => Boolean(window.Shoelace || document.querySelector('script[src*="shoelace"]')))).toBe(false);
});
