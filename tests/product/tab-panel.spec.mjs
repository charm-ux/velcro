import { expect, test } from '@playwright/test';
import { documentsLoaded, watchNetwork } from './support/loaded.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/tab-panel';

async function openExample(page, name = 'Overview') {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  // Litro's client router remounts the page component once after load, which reloads the iframe; wait for it to settle.
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  const frame = page.frameLocator(`iframe.example[title="Tab Panel example: ${name}"]`);
  await expect(frame.locator('sl-tab-panel[active]').first()).toBeVisible();
  await frame.locator('body').evaluate(() => customElements.whenDefined('sl-tab-panel'));
  await documentsLoaded(page);
  return { frame, requests };
}

// Appends markup to the example document and waits for every sl-tab-panel in it to render.
async function mount(frame, markup) {
  await frame.locator('body').evaluate(async (body, markup) => {
    const host = document.createElement('div');
    host.id = 'mount';
    host.innerHTML = markup;
    body.append(host);
    await Promise.all([...host.querySelectorAll('sl-tab-panel')].map(el => el.updateComplete));
  }, markup);
}

test('docs page is prerendered with Velcro branding, prototype status, the quirks and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Tab Panel - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('sl-tab-group');
  expect(html).toContain('tab-after-hide');
  expect(html).toContain('without changing the shared core prefix');
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
  expect(await (await request.get('/')).text()).toContain('/components/tab-panel');
});

test('sl-tab-panel registers as the exported class with no core marker, slot or hidden attribute and no ch-* definitions', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
  const r = await frame.locator('#demo-default').evaluate(el => ({
    ctor: customElements.get('sl-tab-panel') === el.constructor,
    baseName: el.constructor.baseName,
    attributes: el.getAttributeNames().sort(),
    chDefined: ['ch-tab-panel', 'ch-tabs'].filter(tag => customElements.get(tag)),
  }));
  expect(r.ctor).toBe(true);
  expect(r.baseName).toBe('tab-panel');
  // Core's tab panel would also add slot="tabpanel" and hidden; Velcro hosts carry neither (and no base-name marker).
  expect(r.attributes).toEqual(['active', 'aria-hidden', 'id', 'name', 'role']);
  expect(r.chDefined).toEqual([]);
});

test('structure: one slot carrying the base part, tab-panel and tab-panel--active classes, with the content assigned to it', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-tab-panel id="inactive">Off</sl-tab-panel>');
  const info = await frame.locator('body').evaluate(() => {
    const describe = el => ({
      children: [...el.shadowRoot.children].filter(n => n.localName !== 'style').map(n => n.localName),
      part: el.shadowRoot.querySelector('slot').getAttribute('part'),
      slotName: el.shadowRoot.querySelector('slot').name,
      classes: [...el.shadowRoot.querySelector('slot').classList],
      text: el.shadowRoot.querySelector('slot').assignedNodes().map(n => n.textContent.trim()).join(''),
    });
    return { active: describe(document.querySelector('#demo-default')), inactive: describe(document.querySelector('#inactive')) };
  });
  expect(info.active).toEqual({ children: ['slot'], part: 'base', slotName: '', classes: ['tab-panel', 'tab-panel--active'], text: 'This is the general tab panel.' });
  expect(info.inactive).toEqual({ children: ['slot'], part: 'base', slotName: '', classes: ['tab-panel'], text: 'Off' });
});

test('computed styles match Shoelace: display none unless active, block when active, padding from --padding (0 by default)', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, `
    <sl-tab-panel id="off">Off</sl-tab-panel>
    <sl-tab-panel id="on" active>On</sl-tab-panel>
    <sl-tab-panel id="padded" active style="--padding: 12px">Padded</sl-tab-panel>`);
  const r = await frame.locator('body').evaluate(() => {
    const measure = id => {
      const el = document.querySelector(`#${id}`);
      const base = el.shadowRoot.querySelector('[part="base"]');
      return {
        host: getComputedStyle(el).display,
        base: getComputedStyle(base).display,
        padding: getComputedStyle(base).padding,
        boxSizing: getComputedStyle(base).boxSizing,
        boxes: el.getClientRects().length,
      };
    };
    return { off: measure('off'), on: measure('on'), padded: measure('padded') };
  });
  expect(r.off).toMatchObject({ host: 'none', boxes: 0 });
  expect(r.on).toEqual({ host: 'block', base: 'block', padding: '0px', boxSizing: 'border-box', boxes: 1 });
  expect(r.padded).toMatchObject({ host: 'block', padding: '12px', boxes: 1 });
});

test('properties: defaults, attribute and property reflection in both directions, and the id, role and aria-hidden Shoelace sets', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-tab-panel id="plain">Plain</sl-tab-panel><sl-tab-panel id="named" name="alpha" active>Named</sl-tab-panel>');
  const r = await frame.locator('body').evaluate(async () => {
    const plain = document.querySelector('#plain');
    const named = document.querySelector('#named');
    const out = {};
    out.defaults = { name: plain.name, active: plain.active, nameAttr: plain.getAttribute('name'), activeAttr: plain.hasAttribute('active'), role: plain.getAttribute('role'), hidden: plain.getAttribute('aria-hidden') };
    out.fromAttributes = { name: named.name, active: named.active, hidden: named.getAttribute('aria-hidden') };
    plain.name = 'beta';
    plain.active = true;
    await plain.updateComplete;
    out.reflected = { nameAttr: plain.getAttribute('name'), activeAttr: plain.hasAttribute('active'), hidden: plain.getAttribute('aria-hidden') };
    plain.active = false;
    await plain.updateComplete;
    out.deactivated = { activeAttr: plain.hasAttribute('active'), hidden: plain.getAttribute('aria-hidden') };
    named.removeAttribute('active');
    await named.updateComplete;
    out.removedActive = { active: named.active, hidden: named.getAttribute('aria-hidden') };
    named.setAttribute('active', '');
    await named.updateComplete;
    out.setActive = { active: named.active, hidden: named.getAttribute('aria-hidden') };
    named.setAttribute('name', 'gamma');
    await named.updateComplete;
    out.renamed = named.name;
    out.observed = customElements.get('sl-tab-panel').observedAttributes;
    return out;
  });
  expect(r.defaults).toEqual({ name: '', active: false, nameAttr: '', activeAttr: false, role: 'tabpanel', hidden: 'true' });
  expect(r.fromAttributes).toEqual({ name: 'alpha', active: true, hidden: 'false' });
  expect(r.reflected).toEqual({ nameAttr: 'beta', activeAttr: true, hidden: 'false' });
  expect(r.deactivated).toEqual({ activeAttr: false, hidden: 'true' });
  expect(r.removedActive).toEqual({ active: false, hidden: 'true' });
  expect(r.setActive).toEqual({ active: true, hidden: 'false' });
  expect(r.renamed).toBe('gamma');
  // Exactly Shoelace's list (base element dir and lang, then name and active): core's reflected `visible` is not observed.
  expect(r.observed).toEqual(['dir', 'lang', 'name', 'active']);
});

test('upstream quirk: the id comes from a counter that advances on construction; a page id is kept; role and aria-hidden are overwritten', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('body').evaluate(async body => {
    const number = el => Number(el.id.replace('sl-tab-panel-', ''));
    const first = document.createElement('sl-tab-panel');
    body.append(first);
    await first.updateComplete;
    const skipped = document.createElement('sl-tab-panel');
    const later = document.createElement('sl-tab-panel');
    const out = { constructedUnconnectedId: skipped.id };
    body.append(later);
    await later.updateComplete;
    out.gap = number(later) - number(first);
    body.append(skipped);
    await skipped.updateComplete;
    out.skippedNumber = number(skipped) - number(first);
    // Only written on connect, and only when there is none; a removed id returns the same one on the next connect.
    later.removeAttribute('id');
    out.removed = later.id;
    later.remove();
    body.append(later);
    out.reconnected = number(later) - number(first);
    const kept = document.createElement('div');
    kept.innerHTML = '<sl-tab-panel id="mine" role="region" aria-hidden="false">Mine</sl-tab-panel><sl-tab-panel role="region" active aria-hidden="true">Role</sl-tab-panel>';
    body.append(kept);
    const [mine, role] = kept.children;
    await Promise.all([mine.updateComplete, role.updateComplete]);
    out.mine = { id: mine.id, role: mine.getAttribute('role'), hidden: mine.getAttribute('aria-hidden') };
    out.role = { role: role.getAttribute('role'), hidden: role.getAttribute('aria-hidden') };
    // aria-hidden is only rewritten when active changes.
    mine.setAttribute('aria-hidden', 'false');
    mine.setAttribute('role', 'region');
    await mine.updateComplete;
    out.untouched = { role: mine.getAttribute('role'), hidden: mine.getAttribute('aria-hidden') };
    mine.active = true;
    mine.active = false;
    await mine.updateComplete;
    out.afterToggle = mine.getAttribute('aria-hidden');
    mine.remove();
    body.append(mine);
    out.reconnectRole = mine.getAttribute('role');
    first.remove();
    later.remove();
    skipped.remove();
    kept.remove();
    return out;
  });
  expect(r.constructedUnconnectedId).toBe('');
  expect(r.gap).toBe(2);
  expect(r.skippedNumber).toBe(1);
  expect(r.removed).toBe('');
  expect(r.reconnected).toBe(2);
  expect(r.mine).toEqual({ id: 'mine', role: 'tabpanel', hidden: 'true' });
  expect(r.role).toEqual({ role: 'tabpanel', hidden: 'false' });
  expect(r.untouched).toEqual({ role: 'region', hidden: 'false' });
  expect(r.afterToggle).toBe('false');
  expect(r.reconnectRole).toBe('tabpanel');
});

test('upstream quirk: the hidden attribute does not hide an active panel, and an inactive panel is hidden either way', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-tab-panel id="a" active hidden>Active</sl-tab-panel><sl-tab-panel id="i" hidden>Inactive</sl-tab-panel><sl-tab-panel id="i2">Inactive</sl-tab-panel>');
  const r = await frame.locator('body').evaluate(() => {
    const info = id => ({ display: getComputedStyle(document.querySelector(`#${id}`)).display, boxes: document.querySelector(`#${id}`).getClientRects().length });
    return { a: info('a'), i: info('i'), i2: info('i2') };
  });
  expect(r.a).toEqual({ display: 'block', boxes: 1 });
  expect(r.i).toEqual({ display: 'none', boxes: 0 });
  expect(r.i2).toEqual({ display: 'none', boxes: 0 });
});

test('upstream quirk: removing the name attribute restores the value recorded at the first attribute change (the initial reflection)', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-tab-panel id="viaAttr" name="x">A</sl-tab-panel><sl-tab-panel id="late">B</sl-tab-panel>');
  const r = await frame.locator('body').evaluate(async body => {
    const attr = document.querySelector('#viaAttr');
    const late = document.querySelector('#late');
    attr.removeAttribute('name');
    await attr.updateComplete;
    // The first attribute change is name="" being reflected at the first update, so a later assignment is not recorded.
    late.name = 'later';
    await late.updateComplete;
    late.removeAttribute('name');
    await late.updateComplete;
    // Assigned before the first update: it is the value reflected first, so it is the one recorded and restored.
    const early = document.createElement('sl-tab-panel');
    early.name = 'early';
    body.append(early);
    await early.updateComplete;
    early.removeAttribute('name');
    await early.updateComplete;
    const out = {
      attr: { name: attr.name, attribute: attr.getAttribute('name') },
      late: { name: late.name, attribute: late.getAttribute('name') },
      early: { name: early.name, attribute: early.getAttribute('name') },
    };
    early.remove();
    return out;
  });
  expect(r.attr).toEqual({ name: '', attribute: '' });
  expect(r.late).toEqual({ name: '', attribute: '' });
  expect(r.early).toEqual({ name: 'early', attribute: 'early' });
});

test('dir and lang are reactive, not reflected and undefined by default, as Shoelace\'s base element declares them', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-tab-panel id="dl">Lang</sl-tab-panel><sl-tab-panel id="attrs" dir="rtl" lang="de">Attrs</sl-tab-panel>');
  const r = await frame.locator('body').evaluate(async () => {
    const el = document.querySelector('#dl');
    const attrs = document.querySelector('#attrs');
    const defaults = [el.dir, el.lang];
    await el.updateComplete;
    el.dir = 'auto';
    const updateRequestedByDir = el.isUpdatePending;
    await el.updateComplete;
    el.lang = 'fr';
    const updateRequestedByLang = el.isUpdatePending;
    await el.updateComplete;
    const assigned = [el.dir, el.lang, el.getAttribute('dir'), el.getAttribute('lang')];
    // Shoelace declares `dir: string`: any string is stored and returned as set, not normalized to ltr or rtl.
    el.dir = 'sideways';
    const anyString = el.dir;
    el.dir = '';
    const emptyString = el.dir;
    const fromAttributes = [attrs.dir, attrs.lang];
    attrs.removeAttribute('dir');
    attrs.removeAttribute('lang');
    await attrs.updateComplete;
    return { defaults, updateRequestedByDir, updateRequestedByLang, assigned, anyString, emptyString, fromAttributes, removed: [attrs.dir, attrs.lang] };
  });
  expect(r).toEqual({
    defaults: [undefined, undefined],
    updateRequestedByDir: true,
    updateRequestedByLang: true,
    assigned: ['auto', 'fr', null, null],
    anyString: 'sideways',
    emptyString: '',
    fromAttributes: ['rtl', 'de'],
    removed: [null, null],
  });
});

test('core\'s tab coordination is switched off: no slot or hidden attribute, visible and tab without effect, no tab-* events, no transitionend handling', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('body').evaluate(async body => {
    const events = [];
    for (const name of ['tab-show', 'tab-hide', 'tab-after-show', 'tab-after-hide']) body.addEventListener(name, () => events.push(name));
    const el = document.createElement('sl-tab-panel');
    el.active = true;
    el.style.transition = 'opacity 30ms';
    body.append(el);
    await el.updateComplete;
    const initial = { slot: el.getAttribute('slot'), hidden: el.hasAttribute('hidden'), display: getComputedStyle(el).display };
    el.visible = true;
    await el.updateComplete;
    el.style.opacity = '0.5';
    await new Promise(resolve => setTimeout(resolve, 120));
    el.visible = false;
    el.tab = document.createElement('div');
    await el.updateComplete;
    el.style.opacity = '1';
    await new Promise(resolve => setTimeout(resolve, 120));
    const after = { slot: el.getAttribute('slot'), hidden: el.hasAttribute('hidden'), display: getComputedStyle(el).display, boxes: el.getClientRects().length };
    // Reconnecting adds nothing either.
    el.remove();
    body.append(el);
    await el.updateComplete;
    el.style.opacity = '0.8';
    await new Promise(resolve => setTimeout(resolve, 120));
    const reconnected = { slot: el.getAttribute('slot'), hidden: el.hasAttribute('hidden') };
    // Deterministic check that no transitionend handler is installed: a transitionend event aimed at the panel itself is
    // what core's handler turns into `hidden` and tab-after-hide. The listener below proves that the event reached it.
    let reached = 0;
    el.addEventListener('transitionend', () => reached++);
    el.visible = false;
    el.dispatchEvent(new TransitionEvent('transitionend', { propertyName: 'opacity', bubbles: true }));
    await el.updateComplete;
    const afterTransitionEnd = { reached, hidden: el.hasAttribute('hidden'), display: getComputedStyle(el).display };
    el.remove();
    return { initial, after, reconnected, afterTransitionEnd, events };
  });
  expect(r.initial).toEqual({ slot: null, hidden: false, display: 'block' });
  expect(r.after).toEqual({ slot: null, hidden: false, display: 'block', boxes: 1 });
  expect(r.reconnected).toEqual({ slot: null, hidden: false });
  expect(r.afterTransitionEnd).toEqual({ reached: 1, hidden: false, display: 'block' });
  expect(r.events).toEqual([]);
});

test('core\'s visible flag is not an attribute: not observed, not reflected, and it cannot change when Shoelace\'s restore of reflected values records them', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('body').evaluate(async body => {
    const el = document.createElement('sl-tab-panel');
    body.append(el);
    await el.updateComplete;
    const before = el.getAttributeNames().sort();
    el.visible = true;
    await el.updateComplete;
    const afterTrue = { attributes: el.getAttributeNames().sort(), value: el.visible };
    el.visible = false;
    await el.updateComplete;
    const afterFalse = el.getAttributeNames().sort();
    el.setAttribute('visible', '');
    await el.updateComplete;
    const fromAttribute = { value: el.visible, attributes: el.getAttributeNames().sort() };
    el.remove();
    return { before, afterTrue, afterFalse, fromAttribute };
  });
  const base = ['aria-hidden', 'id', 'name', 'role'];
  expect(r.before).toEqual(base);
  expect(r.afterTrue).toEqual({ attributes: base, value: true });
  expect(r.afterFalse).toEqual(base);
  // Setting the attribute by hand does not reach the property, as for any attribute Shoelace's panel does not observe.
  expect(r.fromAttribute).toEqual({ value: false, attributes: [...base, 'visible'].sort() });
});

test('upstream quirk with core\'s visible present: a visible attribute is not an observed change, so the first recorded name is the one that reflects first', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('body').evaluate(async body => {
    // The first observed attribute change records the initial values, and removing a reflected attribute later restores
    // the recorded value. `visible` is not observed (as in Shoelace), so setting it first must not start the recording.
    const early = document.createElement('sl-tab-panel');
    early.name = 'first';
    early.setAttribute('visible', '');
    early.name = 'second';
    body.append(early);
    await early.updateComplete;
    early.removeAttribute('name');
    await early.updateComplete;
    const restored = { name: early.name, attribute: early.getAttribute('name') };
    early.remove();
    return restored;
  });
  expect(r).toEqual({ name: 'second', attribute: 'second' });
});

test('inherited core ready event: dispatched once on the element after the first update, not bubbling or composed', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('body').evaluate(async body => {
    const el = document.createElement('sl-tab-panel');
    const seen = [];
    let bubbled = 0;
    el.addEventListener('ready', event => seen.push({ bubbles: event.bubbles, composed: event.composed }));
    body.addEventListener('ready', () => bubbled++);
    body.append(el);
    await el.updateComplete;
    el.active = true;
    await el.updateComplete;
    el.remove();
    return { seen, bubbled };
  });
  expect(r).toEqual({ seen: [{ bubbles: false, composed: false }], bubbled: 0 });
});

test('the overview example makes one panel active at a time, and a disabled button cannot activate its panel', async ({ page }) => {
  const { frame } = await openExample(page);
  const state = () =>
    frame.locator('body').evaluate(() => ({
      active: [...document.querySelectorAll('sl-tab-panel')].filter(p => getComputedStyle(p).display !== 'none').map(p => p.name),
      hidden: [...document.querySelectorAll('sl-tab-panel')].map(p => p.getAttribute('aria-hidden')),
      output: document.querySelector('#demo-active').textContent,
    }));
  expect(await state()).toEqual({ active: ['general'], hidden: ['false', 'true', 'true', 'true'], output: 'general' });
  await frame.locator('sl-button[data-panel="advanced"]').click();
  expect(await state()).toEqual({ active: ['advanced'], hidden: ['true', 'true', 'false', 'true'], output: 'advanced' });
  await expect(frame.locator('sl-tab-panel[name="advanced"]')).toBeVisible();
  await expect(frame.locator('sl-tab-panel[name="general"]')).toBeHidden();
  await frame.locator('sl-button[data-panel="disabled"]').click({ force: true });
  expect((await state()).active).toEqual(['advanced']);
});

test('every docs example renders in its own document', async ({ page }) => {
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  const titles = await page.locator('iframe.example').evaluateAll(frames => frames.map(f => f.title));
  expect(titles).toEqual(['Overview', 'Custom padding'].map(t => `Tab Panel example: ${t}`));
  for (const title of titles) {
    const frame = page.frameLocator(`iframe.example[title="${title}"]`);
    await expect(frame.locator('sl-tab-panel[active]').first()).toBeVisible();
    expect(await frame.locator('sl-tab-panel').first().evaluate(el => Boolean(el.shadowRoot?.querySelector('[part~="base"]')))).toBe(true);
  }
  const padded = page.frameLocator('iframe.example[title="Tab Panel example: Custom padding"]').locator('sl-tab-panel[active]');
  expect(await padded.evaluate(el => getComputedStyle(el.shadowRoot.querySelector('[part="base"]')).padding)).toBe('16px');
});

test('no upstream Shoelace runtime is requested or defined; all requests stay on the local origin', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  expect(await frame.locator('body').evaluate(() => Boolean(window.Shoelace || document.querySelector('script[src*="shoelace"]')))).toBe(false);
});
