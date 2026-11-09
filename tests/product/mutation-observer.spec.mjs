import { expect, test } from '@playwright/test';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/mutation-observer';
const TITLES = { overview: 'Mutation Observer example: Overview', 'child-list': 'Mutation Observer example: Child List' };

async function openExample(page, which = 'overview') {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  const frame = page.frameLocator(`iframe[title="${TITLES[which]}"]`);
  await expect(frame.locator('#demo-observer')).toBeAttached();
  await frame.locator('#demo-observer').evaluate(() => customElements.whenDefined('sl-mutation-observer'));
  // Rendering only: a test that reads the requests waits for the network to go quiet itself (documentsLoaded).
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
  expect(html).toContain('Upstream quirks matched');
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
  const home = await (await request.get('/')).text();
  expect(home).toContain('/components/mutation-observer');
});

test('sl-mutation-observer registers inside the example document (the docs page registers its own copy separately), as the exported class', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  await documentsLoaded(page);
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
});

// Shoelace 2.20.1's shadow styles for this host, verbatim: the shared component stylesheet followed by the component's own.
const SHOELACE_HOST_CSS = `
  :host { box-sizing: border-box; }
  :host *, :host *::before, :host *::after { box-sizing: inherit; }
  [hidden] { display: none !important; }
  :host { display: contents; }
`;

test('the hidden attribute renders exactly as with Shoelace\'s styles, alone and next to document rules that target [hidden]', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('body').evaluate(async (_, css) => {
    // A stand-in element carrying Shoelace's stylesheet (the real Shoelace is not loaded), to compare against.
    customElements.define(
      'shoelace-style-standin',
      class extends HTMLElement {
        constructor() {
          super();
          const root = this.attachShadow({ mode: 'open' });
          const sheet = new CSSStyleSheet();
          sheet.replaceSync(css);
          root.adoptedStyleSheets = [sheet];
          root.append(document.createElement('slot'));
        }
      }
    );
    await customElements.whenDefined('sl-mutation-observer');
    const out = {};
    for (const [label, rule] of [['alone', ''], ['document [hidden]', '[hidden] { display: none; }'], ['document [hidden] !important', '[hidden] { display: none !important; }']]) {
      const style = document.createElement('style');
      style.textContent = rule;
      document.head.append(style);
      const measure = async tag => {
        const el = document.createElement(tag);
        el.innerHTML = '<span>content</span>';
        el.hidden = true;
        document.body.append(el);
        await el.updateComplete; // the slot exists once Velcro's element has rendered (the stand-in has no update cycle)
        const result = { display: getComputedStyle(el).display, contentBoxes: el.firstElementChild.getClientRects().length };
        el.remove();
        return result;
      };
      out[label] = { velcro: await measure('sl-mutation-observer'), shoelace: await measure('shoelace-style-standin') };
      style.remove();
    }
    return out;
  }, SHOELACE_HOST_CSS);
  // Alone, `hidden` loses to the host's display: contents (the content stays visible); a document rule for [hidden] wins.
  expect(r).toEqual({
    alone: { velcro: { display: 'contents', contentBoxes: 1 }, shoelace: { display: 'contents', contentBoxes: 1 } },
    'document [hidden]': { velcro: { display: 'none', contentBoxes: 0 }, shoelace: { display: 'none', contentBoxes: 0 } },
    'document [hidden] !important': { velcro: { display: 'none', contentBoxes: 0 }, shoelace: { display: 'none', contentBoxes: 0 } },
  });
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
    // Shoelace's list: its six options plus the base element's `dir` and `lang`.
    observed: ['attr', 'attr-old-value', 'char-data', 'char-data-old-value', 'child-list', 'dir', 'disabled', 'lang'],
  });
});

test('lang is a reactive property with no default that is not reflected, as in Shoelace\'s base element: assigning it changes no attribute, so nothing is reported', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(
    frame,
    `
    const out = {};
    const { el, events } = await make({ attr: 'lang' });
    out.initial = [typeof el.lang, el.hasAttribute('lang')];
    el.lang = 'fr';
    await el.updateComplete;
    await tick();
    out.afterProperty = [el.lang, el.hasAttribute('lang'), events.length];
    // The attribute still feeds the property, and an author's attribute change is reported as usual.
    el.setAttribute('lang', 'de');
    await el.updateComplete;
    await tick();
    out.afterAttribute = [el.lang, events.flat().map(r => [r.type, r.name, r.old, r.target])];
    // Not reflected, so removing the attribute is not restored: the property is null, as for any non-reflected string.
    el.removeAttribute('lang');
    await el.updateComplete;
    out.afterRemoval = [el.lang, el.hasAttribute('lang')];
    el.lang = 'it';
    await el.updateComplete;
    out.reassigned = [el.lang, el.hasAttribute('lang')];
    el.remove();
    return out;
  `
  );
  expect(r).toEqual({
    initial: ['undefined', false],
    afterProperty: ['fr', false, 0],
    afterAttribute: ['de', [['attributes', 'lang', null, 'sl-mutation-observer']]],
    afterRemoval: [null, false],
    reassigned: ['it', false],
  });
});

test('attr: string property with no default, reflected in both directions', async ({ page }) => {
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
    el.remove();
    return out;
  `
  );
  expect(r).toEqual({ initial: ['undefined', false], afterProp: ['class id', 'class id'], afterAttr: 'title' });
});

test('upstream quirk: removing the attr attribute restores a value recorded at the first attribute change of any observed attribute, otherwise leaves null', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(
    frame,
    `
    const out = {};
    // Set as an attribute first: attr was still undefined when the first attribute change recorded the reflected
    // properties, so nothing is recorded for it and removal leaves null.
    const fromAttribute = await make({ attr: 'title' });
    fromAttribute.el.removeAttribute('attr');
    await fromAttribute.el.updateComplete;
    out.fromAttribute = [fromAttribute.el.attr, fromAttribute.el.hasAttribute('attr')];
    fromAttribute.el.remove();

    // Assigned as a property first: reflecting it is the first attribute change, so 'class' is recorded, and removing
    // the attribute sets the property back to 'class', which reflects again.
    const fromProperty = await make({});
    fromProperty.el.attr = 'class';
    await fromProperty.el.updateComplete;
    fromProperty.el.setAttribute('attr', 'title');
    await fromProperty.el.updateComplete;
    fromProperty.el.removeAttribute('attr');
    await fromProperty.el.updateComplete;
    out.fromProperty = [fromProperty.el.attr, fromProperty.el.getAttribute('attr')];
    fromProperty.el.remove();

    // The record is taken at the first change of any observed attribute, including the base element's lang and dir:
    // after one of those, attr is still undefined when recorded, so assigning it later and removing it leaves null.
    for (const name of ['lang', 'dir']) {
      const early = await make({ [name]: name === 'lang' ? 'en' : 'rtl' });
      early.el.attr = 'class';
      await early.el.updateComplete;
      early.el.removeAttribute('attr');
      await early.el.updateComplete;
      out[name + 'First'] = [early.el.attr, early.el.hasAttribute('attr')];
      early.el.remove();
    }
    return out;
  `
  );
  expect(r).toEqual({ fromAttribute: [null, false], fromProperty: ['class', 'class'], langFirst: [null, false], dirFirst: [null, false] });
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

test('upstream quirk: only attr and child-list restart the observer after the first update; the other options apply at the next restart', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(
    frame,
    `
    const out = {};
    const settle = async el => { await el.updateComplete; await tick(); };

    // attr and child-list restart the observer.
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

    // char-data does not: nothing is reported until the observer is restarted (here by disabling and re-enabling).
    const charData = await make({ attr: 'title' });
    charData.el.charData = true;
    await settle(charData.el);
    const text = charData.el.querySelector('p').firstChild;
    text.data = 'changed';
    await tick();
    out.charDataBefore = charData.events.length;
    charData.el.disabled = true;
    await settle(charData.el);
    charData.el.disabled = false;
    await settle(charData.el);
    text.data = 'again';
    await tick();
    out.charDataAfter = charData.events.flat().map(r => r.type);
    charData.el.remove();

    // attr-old-value does not: old values start being recorded only after a child-list change restarts the observer.
    const attrOld = await make({ attr: 'title' });
    const p = attrOld.el.querySelector('p');
    p.setAttribute('title', 'one');
    await tick();
    attrOld.el.attrOldValue = true;
    await settle(attrOld.el);
    p.setAttribute('title', 'two');
    await tick();
    attrOld.el.childList = true;
    await settle(attrOld.el);
    p.setAttribute('title', 'three');
    await tick();
    out.attrOldValue = attrOld.events.flat().map(r => r.old);
    attrOld.el.remove();

    // char-data-old-value does not either.
    const charDataOld = await make({ 'char-data': '' });
    const t = charDataOld.el.querySelector('p').firstChild;
    charDataOld.el.charDataOldValue = true;
    await settle(charDataOld.el);
    t.data = 'one';
    await tick();
    charDataOld.el.childList = true;
    await settle(charDataOld.el);
    t.data = 'two';
    await tick();
    out.charDataOldValue = charDataOld.events.flat().map(r => r.old);
    charDataOld.el.remove();

    // Turning char-data off after the first update does not stop the reporting either.
    const off = await make({ 'char-data': '' });
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
    charDataBefore: 0,
    charDataAfter: ['characterData'],
    attrOldValue: [null, null, 'two'],
    charDataOldValue: [null, 'one'],
    off: 1,
  });
});

test('upstream quirk: a change to attr or child-list starts a disabled observer', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(
    frame,
    `
    const out = {};
    const byAttr = await make({ 'child-list': '', disabled: '' });
    byAttr.el.append(document.createElement('i'));
    await tick();
    out.stillDisabled = byAttr.events.length;
    byAttr.el.attr = 'title';
    await byAttr.el.updateComplete;
    byAttr.el.append(document.createElement('i'));
    byAttr.el.querySelector('p').setAttribute('title', 'x');
    await tick();
    out.byAttr = [byAttr.el.disabled, byAttr.events.flat().map(r => r.type).sort()];
    // Disabling again stops it.
    byAttr.el.disabled = false;
    await byAttr.el.updateComplete;
    byAttr.el.disabled = true;
    await byAttr.el.updateComplete;
    byAttr.el.append(document.createElement('i'));
    await tick();
    out.disabledAgain = byAttr.events.length;
    byAttr.el.remove();

    const byChildList = await make({ attr: 'title', disabled: '' });
    byChildList.el.childList = true;
    await byChildList.el.updateComplete;
    byChildList.el.append(document.createElement('i'));
    await tick();
    out.byChildList = [byChildList.el.disabled, byChildList.events.flat().map(r => r.type)];
    byChildList.el.remove();

    // The other options are not watched, so they do not start it.
    const byCharData = await make({ 'child-list': '', disabled: '' });
    byCharData.el.charData = true;
    byCharData.el.attrOldValue = true;
    await byCharData.el.updateComplete;
    byCharData.el.append(document.createElement('i'));
    await tick();
    out.byCharData = byCharData.events.length;
    byCharData.el.remove();
    return out;
  `
  );
  expect(r).toEqual({
    stillDisabled: 0,
    byAttr: [true, ['attributes', 'childList']],
    disabledAgain: 1,
    byChildList: [true, ['childList']],
    byCharData: 0,
  });
});

test('upstream quirk: a restart while disconnected observes the detached subtree, and reconnecting then reports every mutation twice', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await run(
    frame,
    `
    const out = {};
    const add = el => el.append(document.createElement('i'));

    // Plain disconnect and reconnect: stopped while detached, one report per mutation afterwards.
    const plain = await make({ 'child-list': '' });
    plain.el.remove();
    add(plain.el);
    await tick();
    out.detached = plain.events.length;
    document.body.append(plain.el);
    await plain.el.updateComplete;
    add(plain.el);
    await tick();
    out.reconnected = plain.events.length;
    plain.el.remove();

    // A change to attr while detached restarts the old observer, which then keeps observing next to the new one.
    const stacked = await make({ 'child-list': '' });
    stacked.el.remove();
    stacked.el.attr = 'title';
    await stacked.el.updateComplete;
    add(stacked.el);
    await tick();
    out.restartedWhileDetached = stacked.events.length;
    document.body.append(stacked.el);
    await stacked.el.updateComplete;
    add(stacked.el);
    await tick();
    out.afterReconnect = stacked.events.length - out.restartedWhileDetached;
    stacked.el.remove();
    return out;
  `
  );
  expect(r).toEqual({ detached: 0, reconnected: 1, restartedWhileDetached: 1, afterReconnect: 2 });
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
  await documentsLoaded(page);
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  expect(await frame.locator('body').evaluate(() => Boolean(window.Shoelace || document.querySelector('script[src*="shoelace"]')))).toBe(false);
});
