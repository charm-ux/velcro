import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/tab-group';
// Shoelace 2.20.1's tab group page has eight examples, in this order; every one is live and has a React version.
const ORDER = [
  ['basic', 'Default'], ['bottom', 'Tabs on Bottom'], ['start', 'Tabs on Start'], ['end', 'Tabs on End'], ['closable', 'Closable Tabs'],
  ['scrolling', 'Scrolling Tabs'], ['fixed-scroll-controls', 'Fixed scroll controls'], ['manual', 'Manual Activation'],
];
const SECTIONS = ORDER.map(([, section]) => section);
const title = section => `Tab Group example: ${section}`;
const docsDir = fileURLToPath(new URL('../../packages/docs/', import.meta.url));
const velcroDir = fileURLToPath(new URL('../../packages/velcro/', import.meta.url));

// Waits until the tab group in the frame has selected a tab (it does so once it is visible) and the panels have rendered.
const settled = frame => frame.locator('body').evaluate(async () => {
  await Promise.all(['sl-tab-group', 'sl-tab', 'sl-tab-panel'].map(t => customElements.whenDefined(t)));
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const groups = [...document.querySelectorAll('sl-tab-group')];
    if (groups.every(g => g.querySelector('sl-tab[active]') && g.querySelector('sl-tab-panel[active]'))) break;
    await new Promise(r => setTimeout(r, 20));
  }
  await Promise.all([...document.querySelectorAll('sl-tab-group, sl-tab, sl-tab-panel')].map(el => el.updateComplete));
  await new Promise(r => setTimeout(r, 50));
});

async function openPage(page, section = 'Default') {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  const frame = page.frameLocator(`iframe.example[title="${title(section)}"]`);
  await expect(frame.locator('sl-tab-group').first()).toBeVisible();
  await settled(frame);
  await documentsLoaded(page);
  // The tab group selects its first tab only once it intersects the viewport (Shoelace's intersection observer), so an
  // example frame is scrolled into view before it is used.
  const example = async s => {
    await page.locator(`iframe.example[title="${title(s)}"]`).scrollIntoViewIfNeeded();
    const f = page.frameLocator(`iframe.example[title="${title(s)}"]`);
    await settled(f);
    return f;
  };
  return { frame, requests, example };
}

// The state of a tab group: which tabs and panels are active, the tab stops and the ARIA links between them.
const describeGroup = group => {
  const tabs = [...group.querySelectorAll('sl-tab')];
  const panels = [...group.querySelectorAll('sl-tab-panel')];
  return {
    active: tabs.filter(t => t.active).map(t => t.panel),
    shown: panels.filter(p => getComputedStyle(p).display !== 'none').map(p => p.name),
    tabindex: tabs.map(t => t.getAttribute('tabindex')),
    selected: tabs.map(t => t.getAttribute('aria-selected')),
    controls: tabs.map(t => document.getElementById(t.getAttribute('aria-controls'))?.name ?? null),
    labelledBy: panels.map(p => document.getElementById(p.getAttribute('aria-labelledby'))?.panel ?? null),
  };
};

test('docs page is prerendered with Velcro branding, prototype status, every Shoelace section, the keyboard, the quirks and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Tab Group - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('without changing the shared core prefix');
  expect(html).toContain('id="keyboard"');
  for (const section of SECTIONS) expect(html).toContain(`title="${title(section)}"`);
  const positions = SECTIONS.map(section => html.indexOf(`title="${title(section)}"`));
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(await (await request.get('/')).text()).toContain('/components/tab-group');
});

test('sl-tab-group registers as the exported class, with sl-icon-button, sl-icon and sl-resize-observer, no core marker and no ch-* definitions', async ({ page }) => {
  const { frame, requests } = await openPage(page);
  const info = await frame.locator('#demo-default').evaluate(el => {
    const ctor = customElements.get('sl-tab-group');
    return {
      baseName: ctor.baseName, instance: el instanceof ctor, viaConstructor: new ctor().localName,
      deps: ['sl-icon-button', 'sl-icon', 'sl-resize-observer', 'sl-tab', 'sl-tab-panel'].map(t => customElements.get(t)?.baseName ?? null),
      chDefined: ['ch-tabs', 'ch-tab', 'ch-tab-group'].filter(t => customElements.get(t)),
      attrs: el.getAttributeNames().sort(),
      observed: [...ctor.observedAttributes].sort(),
    };
  });
  expect(info).toEqual({
    baseName: 'tab-group', instance: true, viaConstructor: 'sl-tab-group',
    deps: ['icon-button', 'icon', 'resize-observer', 'tab', 'tab-panel'], chDefined: [], attrs: ['id'],
    observed: ['activation', 'dir', 'fixed-scroll-controls', 'lang', 'no-scroll-controls', 'placement'],
  });
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
});

test('default example: Shoelace\'s structure and parts, the first tab active, its panel shown, only the active tab a tab stop, tabs and panels linked by id', async ({ page }) => {
  const { frame } = await openPage(page);
  const r = await frame.locator('#demo-default').evaluate((el, describe) => {
    const root = el.shadowRoot;
    const part = name => root.querySelector(`[part~="${name}"]`);
    const outline = node => [node.localName, node.getAttribute('part'), node.getAttribute('role'), [...node.children].map(c => outline(c))];
    const fn = new Function(`return (${describe})`)();
    return {
      outline: outline(part('base')),
      classes: part('base').className.trim().split(/\s+/),
      navSlot: root.querySelector('slot[name="nav"]').assignedElements().map(t => t.panel),
      bodySlot: part('body').assignedElements().map(p => p.name),
      scrollButtons: root.querySelectorAll('sl-icon-button').length,
      state: fn(el),
      roles: [...el.querySelectorAll('sl-tab')].map(t => t.getAttribute('role')),
      ids: [...el.querySelectorAll('sl-tab')].map(t => /^sl-tab-\d+$/.test(t.id)),
      disabled: el.querySelector('sl-tab[disabled]').getAttribute('aria-disabled'),
    };
  }, describeGroup.toString());
  expect(r.outline).toEqual(['div', 'base', null, [
    ['div', 'nav', null, [['div', null, null, [['div', 'tabs', 'tablist', [['div', 'active-tab-indicator', null, []], ['sl-resize-observer', null, null, [['slot', null, null, []]]]]]]]]],
    ['slot', 'body', null, []],
  ]]);
  expect(r.classes).toEqual(['tab-group', 'tab-group--top']);
  expect(r.navSlot).toEqual(['general', 'custom', 'advanced', 'disabled']);
  expect(r.bodySlot).toEqual(['general', 'custom', 'advanced', 'disabled']);
  expect(r.scrollButtons).toBe(0);
  expect(r.state).toEqual({
    active: ['general'], shown: ['general'], tabindex: ['0', '-1', '-1', '-1'], selected: ['true', 'false', 'false', 'false'],
    controls: ['general', 'custom', 'advanced', 'disabled'], labelledBy: ['general', 'custom', 'advanced', 'disabled'],
  });
  expect(r.roles).toEqual(['tab', 'tab', 'tab', 'tab']);
  expect(r.ids).toEqual([true, true, true, true]);
  expect(r.disabled).toBe('true');
});

test('computed styles match Shoelace: the track and indicator colors and widths, the indicator under the active tab, the panel padding and the body overflow', async ({ page }) => {
  const { frame } = await openPage(page);
  const r = await frame.locator('#demo-default').evaluate(el => {
    const root = el.shadowRoot;
    const cs = node => getComputedStyle(node);
    const probe = value => { const p = document.createElement('div'); p.style.color = value; document.body.append(p); const c = cs(p).color; p.remove(); return c; };
    const tabs = root.querySelector('[part="tabs"]');
    const indicator = root.querySelector('[part="active-tab-indicator"]');
    const active = el.querySelector('sl-tab[active]');
    const panel = el.querySelector('sl-tab-panel[active]');
    return {
      host: cs(el).display, base: [cs(root.querySelector('[part="base"]')).display, cs(root.querySelector('[part="base"]')).flexDirection],
      track: [cs(tabs).borderBottomStyle, cs(tabs).borderBottomWidth, cs(tabs).borderBottomColor], trackColor: probe('var(--sl-color-neutral-200)'),
      indicator: [cs(indicator).position, cs(indicator).borderBottomStyle, cs(indicator).borderBottomWidth, cs(indicator).borderBottomColor, cs(indicator).display, cs(indicator).bottom],
      indicatorColor: probe('var(--sl-color-primary-600)'),
      indicatorBox: [Math.round(indicator.getBoundingClientRect().width), Math.round(active.getBoundingClientRect().width), Math.round(indicator.getBoundingClientRect().left - active.getBoundingClientRect().left)],
      nav: [cs(root.querySelector('.tab-group__nav')).overflowX, cs(root.querySelector('.tab-group__nav')).display],
      body: [cs(root.querySelector('[part="body"]')).display, cs(root.querySelector('[part="body"]')).overflow],
      panelPadding: cs(panel.shadowRoot.querySelector('[part="base"]')).padding, spacing: (() => { const p = document.createElement('div'); p.style.padding = 'var(--sl-spacing-medium) 0'; document.body.append(p); const v = cs(p).padding; p.remove(); return v; })(),
      boxSizing: cs(el).boxSizing,
    };
  });
  expect(r.host).toBe('block');
  expect(r.base).toEqual(['flex', 'column']);
  expect(r.track).toEqual(['solid', '2px', r.trackColor]);
  expect(r.indicator).toEqual(['absolute', 'solid', '2px', r.indicatorColor, 'block', '-2px']);
  expect(r.indicatorBox[0]).toBe(r.indicatorBox[1]);
  expect(Math.abs(r.indicatorBox[2])).toBeLessThanOrEqual(1);
  expect(r.nav).toEqual(['auto', 'flex']);
  expect(r.body).toEqual(['block', 'auto']);
  expect(r.panelPadding).toBe(r.spacing);
  expect(r.boxSizing).toBe('border-box');
});

test('placement examples: the nav goes below, to the start and to the end of the body; the indicator follows the active tab on the matching side', async ({ page }) => {
  const { example } = await openPage(page);
  const out = {};
  for (const [section, placement] of [['Tabs on Bottom', 'bottom'], ['Tabs on Start', 'start'], ['Tabs on End', 'end']]) {
    const frame = await example(section);
    out[placement] = await frame.locator('sl-tab-group').evaluate(el => {
      const root = el.shadowRoot;
      const nav = root.querySelector('[part="nav"]').getBoundingClientRect();
      const body = root.querySelector('[part="body"]').getBoundingClientRect();
      const indicator = root.querySelector('[part="active-tab-indicator"]');
      const active = el.querySelector('sl-tab[active]').getBoundingClientRect();
      return {
        placement: el.placement, cls: root.querySelector('[part="base"]').classList.contains(`tab-group--${el.placement}`),
        below: body.bottom <= nav.top, before: nav.right <= body.left, after: body.right <= nav.left,
        indicatorHeight: Math.round(indicator.getBoundingClientRect().height) === Math.round(active.height),
        padding: getComputedStyle(el.querySelector('sl-tab-panel[active]').shadowRoot.querySelector('[part="base"]')).paddingLeft,
      };
    });
  }
  expect(out.bottom).toMatchObject({ placement: 'bottom', cls: true, below: true });
  expect(out.start).toMatchObject({ placement: 'start', cls: true, before: true, indicatorHeight: true });
  expect(out.end).toMatchObject({ placement: 'end', cls: true, after: true, indicatorHeight: true });
  expect(out.start.padding).not.toBe('0px');
});

test('clicks and show(): sl-tab-hide then sl-tab-show with the panel names, bubbling, composed and not cancelable; nothing for the active tab, a disabled tab or an unknown name', async ({ page }) => {
  const { frame } = await openPage(page);
  const r = await frame.locator('#demo-default').evaluate(async (el, describe) => {
    const fn = new Function(`return (${describe})`)();
    const log = [];
    for (const type of ['sl-tab-show', 'sl-tab-hide']) {
      document.addEventListener(type, e => log.push([e.type, e.detail.name, e.bubbles, e.composed, e.cancelable, e.target === el]));
    }
    el.querySelector('sl-tab[panel="custom"]').click();
    await new Promise(r => setTimeout(r, 50));
    const afterClick = fn(el);
    el.querySelector('sl-tab[panel="custom"]').click();
    el.querySelector('sl-tab[panel="disabled"]').click();
    el.show('missing');
    el.show('disabled');
    const quiet = log.length;
    el.show('advanced');
    await new Promise(r => setTimeout(r, 50));
    return { log, afterClick, quiet, afterShow: fn(el) };
  }, describeGroup.toString());
  expect(r.log).toEqual([
    ['sl-tab-hide', 'general', true, true, false, true], ['sl-tab-show', 'custom', true, true, false, true],
    ['sl-tab-hide', 'custom', true, true, false, true], ['sl-tab-show', 'advanced', true, true, false, true],
  ]);
  expect(r.quiet).toBe(2);
  expect(r.afterClick).toMatchObject({ active: ['custom'], shown: ['custom'], tabindex: ['-1', '0', '-1', '-1'], selected: ['false', 'true', 'false', 'false'] });
  expect(r.afterShow).toMatchObject({ active: ['advanced'], shown: ['advanced'] });
});

test('setting active on a tab selects it, with sl-tab-show', async ({ page }) => {
  const { frame } = await openPage(page);
  const r = await frame.locator('#demo-default').evaluate(async (el, describe) => {
    const fn = new Function(`return (${describe})`)();
    const log = [];
    el.addEventListener('sl-tab-show', e => log.push(e.detail.name));
    el.querySelector('sl-tab[panel="advanced"]').active = true;
    await new Promise(r => setTimeout(r, 50));
    return { log, state: fn(el) };
  }, describeGroup.toString());
  expect(r).toMatchObject({ log: ['advanced'], state: { active: ['advanced'], shown: ['advanced'] } });
});

test('scrolling example: scroll buttons with Shoelace\'s parts, icons, localized labels, tabindex -1 and aria-hidden; the start one is hidden at the start, and the end one scrolls the nav', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  const { example } = await openPage(page);
  const frame = await example('Scrolling Tabs');
  const group = frame.locator('sl-tab-group');
  await expect.poll(() => group.evaluate(el => el.shadowRoot.querySelectorAll('sl-icon-button').length)).toBe(2);
  const read = () => group.evaluate(el => {
    const root = el.shadowRoot;
    const button = which => root.querySelector(`sl-icon-button[part~="scroll-button--${which}"]`);
    return {
      classes: root.querySelector('[part="base"]').className.trim().split(/\s+/),
      buttons: ['start', 'end'].map(w => [button(w).getAttribute('part'), button(w).getAttribute('exportparts'), button(w).name, button(w).library, button(w).label,
        button(w).getAttribute('tabindex'), button(w).getAttribute('aria-hidden'), getComputedStyle(button(w)).visibility]),
      scrollLeft: root.querySelector('.tab-group__nav').scrollLeft,
    };
  });
  const before = await read();
  expect(before.classes).toEqual(['tab-group', 'tab-group--top', 'tab-group--has-scroll-controls']);
  expect(before.buttons).toEqual([
    ['scroll-button scroll-button--start', 'base:scroll-button__base', 'chevron-left', 'system', 'Scroll to start', '-1', 'true', 'hidden'],
    ['scroll-button scroll-button--end', 'base:scroll-button__base', 'chevron-right', 'system', 'Scroll to end', '-1', 'true', 'visible'],
  ]);
  expect(before.scrollLeft).toBe(0);
  await group.evaluate(el => el.shadowRoot.querySelector('sl-icon-button[part~="scroll-button--end"]').click());
  await expect.poll(async () => (await read()).scrollLeft).toBeGreaterThan(0);
  await expect.poll(async () => (await read()).buttons[0][7]).toBe('visible');
  // no-scroll-controls removes them; Shoelace's watcher reruns the check when the property changes.
  await group.evaluate(async el => { el.noScrollControls = true; await el.updateComplete; });
  expect(await group.evaluate(el => el.shadowRoot.querySelectorAll('sl-icon-button').length)).toBe(0);
});

test('fixed scroll controls example: both scroll buttons stay visible at the start', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  const { example } = await openPage(page);
  const frame = await example('Fixed scroll controls');
  const group = frame.locator('sl-tab-group');
  await expect.poll(() => group.evaluate(el => el.shadowRoot.querySelectorAll('sl-icon-button').length)).toBe(2);
  const r = await group.evaluate(el => [el.fixedScrollControls, [...el.shadowRoot.querySelectorAll('sl-icon-button')].map(b => getComputedStyle(b).visibility), el.shadowRoot.querySelector('.tab-group__nav').scrollLeft]);
  expect(r).toEqual([true, ['visible', 'visible'], 0]);
});

test('closable example: the close button removes the tab and its panel, and closing the active tab shows the previous one', async ({ page }) => {
  const { example } = await openPage(page);
  const frame = await example('Closable Tabs');
  const r = await frame.locator('sl-tab-group').evaluate(async el => {
    el.show('closable-2');
    await new Promise(r => setTimeout(r, 20));
    el.querySelector('sl-tab[panel="closable-2"]').shadowRoot.querySelector('sl-icon-button').click();
    await new Promise(r => setTimeout(r, 50));
    return {
      tabs: [...el.querySelectorAll('sl-tab')].map(t => t.panel), panels: [...el.querySelectorAll('sl-tab-panel')].map(p => p.name),
      active: el.querySelector('sl-tab[active]').panel, shown: [...el.querySelectorAll('sl-tab-panel')].filter(p => p.active).map(p => p.name),
    };
  });
  expect(r).toEqual({ tabs: ['general', 'closable-1', 'closable-3'], panels: ['general', 'closable-1', 'closable-3'], active: 'closable-1', shown: ['closable-1'] });
});

test('upstream quirk: placement is not reflected; setting it re-lays out the group without an attribute, and a placement attribute from markup stays as written', async ({ page }) => {
  const { frame, example } = await openPage(page);
  const bottom = await example('Tabs on Bottom');
  const markup = await bottom.locator('sl-tab-group').evaluate(async el => {
    el.placement = 'end';
    await el.updateComplete;
    return [el.getAttribute('placement'), el.placement, el.shadowRoot.querySelector('[part="base"]').classList.contains('tab-group--end')];
  });
  expect(markup).toEqual(['bottom', 'end', true]);
  const r = await frame.locator('#demo-default').evaluate(async el => {
    el.placement = 'bottom';
    el.activation = 'manual';
    el.noScrollControls = true;
    el.fixedScrollControls = true;
    await el.updateComplete;
    const attrs = el.getAttributeNames().sort();
    const cls = el.shadowRoot.querySelector('[part="base"]').classList.contains('tab-group--bottom');
    el.setAttribute('placement', 'end');
    el.removeAttribute('placement');
    return { attrs, cls, removed: el.placement };
  });
  expect(r).toEqual({ attrs: ['id'], cls: true, removed: null });
});

test('upstream quirk: a tab group that starts hidden selects nothing until it is displayed, and emits no sl-tab-show for the initial selection', async ({ page }) => {
  const { frame } = await openPage(page);
  const r = await frame.locator('body').evaluate(async body => {
    const host = document.createElement('div');
    host.style.display = 'none';
    host.innerHTML = '<sl-tab-group id="hidden"><sl-tab slot="nav" panel="a">A</sl-tab><sl-tab slot="nav" panel="b">B</sl-tab><sl-tab-panel name="a">A</sl-tab-panel><sl-tab-panel name="b">B</sl-tab-panel></sl-tab-group>';
    body.prepend(host);
    const el = host.firstElementChild;
    const log = [];
    el.addEventListener('sl-tab-show', e => log.push(e.detail.name));
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 200));
    const hidden = [...el.querySelectorAll('[active]')].length;
    host.style.display = '';
    const deadline = Date.now() + 3000;
    while (!el.querySelector('sl-tab[active]') && Date.now() < deadline) await new Promise(r => setTimeout(r, 20));
    return { hidden, shown: el.querySelector('sl-tab[active]')?.panel ?? null, log };
  });
  expect(r).toEqual({ hidden: 0, shown: 'a', log: [] });
});

test('upstream quirk: aria-controls and aria-labelledby are written once the group is visible and after a later change, only for a tab whose panel exists then, and nothing removes them', async ({ page }) => {
  const { frame } = await openPage(page);
  const r = await frame.locator('body').evaluate(async body => {
    const host = document.createElement('div');
    host.style.display = 'none';
    host.innerHTML = '<sl-tab-group><sl-tab slot="nav" panel="a">A</sl-tab><sl-tab slot="nav" panel="b">B</sl-tab><sl-tab slot="nav" panel="c">C</sl-tab><sl-tab-panel name="a">A</sl-tab-panel><sl-tab-panel name="b">B</sl-tab-panel></sl-tab-group>';
    body.prepend(host);
    const el = host.firstElementChild;
    const links = () => ({
      controls: [...el.querySelectorAll('sl-tab')].map(t => (t.hasAttribute('aria-controls') ? document.getElementById(t.getAttribute('aria-controls'))?.name ?? 'missing' : null)),
      labelledBy: [...el.querySelectorAll('sl-tab-panel')].map(p => (p.hasAttribute('aria-labelledby') ? document.getElementById(p.getAttribute('aria-labelledby'))?.panel ?? 'missing' : null)),
    });
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 200));
    const hidden = links();
    host.style.display = '';
    const until = async (check, ms = 3000) => { const end = Date.now() + ms; while (!check() && Date.now() < end) await new Promise(r => setTimeout(r, 20)); };
    await until(() => el.querySelector('sl-tab').hasAttribute('aria-controls'));
    const shown = links();
    // A panel removed later: the tab keeps its aria-controls, now pointing at nothing.
    el.querySelector('sl-tab-panel[name="b"]').remove();
    await new Promise(r => setTimeout(r, 200));
    const afterRemove = links();
    // A panel for tab C added later: the next change links it (in a timeout).
    const panel = document.createElement('sl-tab-panel');
    panel.name = 'c';
    el.append(panel);
    await until(() => el.querySelector('sl-tab[panel="c"]').hasAttribute('aria-controls'));
    return { hidden, shown, afterRemove, added: links() };
  });
  expect(r.hidden).toEqual({ controls: [null, null, null], labelledBy: [null, null] });
  expect(r.shown).toEqual({ controls: ['a', 'b', null], labelledBy: ['a', 'b'] });
  expect(r.afterRemove).toEqual({ controls: ['a', 'missing', null], labelledBy: ['a'] });
  expect(r.added).toEqual({ controls: ['a', 'missing', 'c'], labelledBy: ['a', 'c'] });
});

test('upstream quirk: setting active to false on the active tab leaves no tab active while its panel stays shown, and clicking it again does nothing', async ({ page }) => {
  const { frame } = await openPage(page);
  const r = await frame.locator('#demo-default').evaluate(async (el, describe) => {
    const fn = new Function(`return (${describe})`)();
    el.querySelector('sl-tab[panel="general"]').active = false;
    await new Promise(r => setTimeout(r, 50));
    el.querySelector('sl-tab[panel="general"]').click();
    await new Promise(r => setTimeout(r, 50));
    const stuck = fn(el);
    el.querySelector('sl-tab[panel="custom"]').click();
    await new Promise(r => setTimeout(r, 50));
    return { stuck, recovered: fn(el) };
  }, describeGroup.toString());
  expect(r.stuck).toMatchObject({ active: [], shown: ['general'] });
  expect(r.recovered).toMatchObject({ active: ['custom'], shown: ['custom'] });
});

test('accessibility tree (Playwright ARIA snapshot): a tablist of tabs, the active one selected, the disabled one disabled, and the shown tabpanel', async ({ page }) => {
  const { frame } = await openPage(page);
  await expect(frame.locator('#demo-default')).toMatchAriaSnapshot(`
    - tablist:
      - tab "General" [selected]
      - tab "Custom"
      - tab "Advanced"
      - tab "Disabled" [disabled]
    - tabpanel "General": This is the general tab panel.
  `);
});

test('the examples render in their own documents in Shoelace\'s order', async ({ page }) => {
  const { requests } = await openPage(page);
  const titles = await page.locator('iframe.example').evaluateAll(frames => frames.map(f => f.title));
  expect(titles).toEqual(SECTIONS.map(title));
  const counts = [];
  for (const section of SECTIONS) counts.push(await page.frameLocator(`iframe.example[title="${title(section)}"]`).locator('sl-tab').count());
  expect(counts).toEqual([4, 4, 4, 4, 4, 20, 20, 4]);
  const ids = await page.locator('h3[id]').evaluateAll(hs => hs.map(h => h.id));
  expect(ids.filter(id => ORDER.some(([known]) => known === id))).toEqual(ORDER.map(([id]) => id));
  const files = dir => readdirSync(path.join(docsDir, 'examples/tab-group', dir)).filter(f => /\.(html|jsx)$/.test(f)).sort();
  expect(files('')).toEqual(ORDER.map(([id]) => `${id}.html`).sort());
  expect(files('react')).toEqual(ORDER.map(([id]) => `${id}.jsx`).sort());
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
});

test('no upstream Shoelace runtime is requested or defined; no request leaves the local origin', async ({ page }) => {
  const { frame, requests } = await openPage(page);
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  expect(await frame.locator('body').evaluate(() => Boolean(window.Shoelace || document.querySelector('script[src*="shoelace"]')))).toBe(false);
});

// Bundles of the package entries through the package's real export map, loaded into top-level documents made by the test.
const ENTRY = `
  import '@charm-ux/velcro/tab-group';
  import '@charm-ux/velcro/tab';
  import '@charm-ux/velcro/tab-panel';
  import * as localize from '@charm-ux/velcro/utilities/localize';
  import en from '@charm-ux/velcro/translations/en';
  window.modules = { localize, en };
  window.loaded = true;
`;
const CLASS_ENTRY = `
  import { SlTabGroup, VelcroTabGroup } from '@charm-ux/velcro/tab-group/class';
  window.tabGroupClass = { SlTabGroup, VelcroTabGroup };
  window.loaded = true;
`;
const bundles = new Map();

async function build(entries, extra = {}) {
  const fromDocs = createRequire(path.join(docsDir, 'package.json'));
  const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
  const dir = mkdtempSync(path.join(tmpdir(), 'velcro-tab-group-'));
  try {
    for (const [name, source] of Object.entries(entries)) writeFileSync(path.join(dir, name), source);
    const out = await build({
      configFile: false, logLevel: 'silent', root: dir,
      plugins: [{
        name: 'velcro-package-exports',
        async resolveId(id) {
          if (!id.startsWith('@charm-ux/velcro/')) return null;
          return (await this.resolve(id, path.join(docsDir, 'app.ts'), { skipSelf: true })) ?? null;
        },
      }],
      ...extra,
      build: { write: false, minify: false, rollupOptions: { input: path.join(dir, 'entry.js'), output: { format: 'es', codeSplitting: false } } },
    });
    return (Array.isArray(out) ? out[0] : out).output.find(o => o.type === 'chunk').code;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function loadBundle(page, source) {
  if (!bundles.has(source)) bundles.set(source, await build({ 'entry.js': source }));
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.setContent('<!DOCTYPE html><html class="sl-theme-light" lang="en"><body></body></html>');
  await page.addStyleTag({ content: readFileSync(path.join(velcroDir, 'themes/light.css'), 'utf8') });
  await page.addScriptTag({ type: 'module', content: bundles.get(source) });
  await page.waitForFunction(() => window.loaded === true);
  return pageErrors;
}

const GROUP = (attrs = '') => `<button id="before">before</button><sl-tab-group id="g" ${attrs}>
  <sl-tab slot="nav" panel="a">A</sl-tab><sl-tab slot="nav" panel="b">B</sl-tab><sl-tab slot="nav" panel="c" disabled>C</sl-tab><sl-tab slot="nav" panel="d">D</sl-tab>
  <sl-tab-panel name="a">A</sl-tab-panel><sl-tab-panel name="b">B</sl-tab-panel><sl-tab-panel name="c">C</sl-tab-panel><sl-tab-panel name="d">D</sl-tab-panel>
</sl-tab-group><button id="after">after</button>`;

async function mountGroup(page, attrs) {
  await page.evaluate(async markup => {
    document.body.innerHTML = markup;
    const el = document.querySelector('#g');
    await el.updateComplete;
    while (!el.querySelector('sl-tab[active]')) await new Promise(r => setTimeout(r, 20));
  }, GROUP(attrs));
}

const focusedTab = page => page.evaluate(() => (document.activeElement?.localName === 'sl-tab' ? document.activeElement.panel : document.activeElement?.id ?? null));
const activeTab = page => page.evaluate(() => document.querySelector('#g sl-tab[active]')?.panel ?? null);

test.describe('keyboard (top-level documents)', () => {
  test('Tab reaches only the active tab; Right and Left move focus and selection, skipping the disabled tab and wrapping; Home and End go to the first and last enabled tab', async ({ page }) => {
    const pageErrors = await loadBundle(page, ENTRY);
    await mountGroup(page);
    await page.locator('#before').focus();
    await page.keyboard.press('Tab');
    expect(await focusedTab(page)).toBe('a');
    await page.keyboard.press('Tab');
    expect(await focusedTab(page)).toBe('after');
    await page.keyboard.press('Shift+Tab');
    expect(await focusedTab(page)).toBe('a');
    const steps = [];
    for (const key of ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowLeft', 'ArrowLeft', 'End', 'Home', 'ArrowDown']) {
      await page.keyboard.press(key);
      steps.push([key, await focusedTab(page), await activeTab(page)]);
    }
    expect(steps).toEqual([
      ['ArrowRight', 'b', 'b'], ['ArrowRight', 'd', 'd'], ['ArrowRight', 'a', 'a'], ['ArrowLeft', 'd', 'd'], ['ArrowLeft', 'b', 'b'],
      ['End', 'd', 'd'], ['Home', 'a', 'a'], ['ArrowDown', 'a', 'a'],
    ]);
    expect(await page.evaluate(() => [...document.querySelectorAll('#g sl-tab')].map(t => t.getAttribute('tabindex')))).toEqual(['0', '-1', '-1', '-1']);
    // Disabling a tab later (a mutation the group observes) removes it from keyboard navigation; enabling C brings it back.
    await page.evaluate(async () => {
      document.querySelector('#g sl-tab[panel="b"]').disabled = true;
      document.querySelector('#g sl-tab[panel="c"]').disabled = false;
      await new Promise(r => setTimeout(r, 50));
    });
    await page.locator('#g sl-tab[panel="a"]').focus();
    await page.keyboard.press('ArrowRight');
    expect([await focusedTab(page), await activeTab(page)]).toEqual(['c', 'c']);
    await page.keyboard.press('ArrowLeft');
    expect([await focusedTab(page), await activeTab(page)]).toEqual(['a', 'a']);
    expect(pageErrors).toEqual([]);
  });

  test('activation="manual": the arrow keys move focus only; Enter and Space select the focused tab', async ({ page }) => {
    const pageErrors = await loadBundle(page, ENTRY);
    await mountGroup(page, 'activation="manual"');
    await page.evaluate(() => { window.log = []; document.querySelector('#g').addEventListener('sl-tab-show', e => window.log.push(e.detail.name)); });
    await page.locator('#g sl-tab[panel="a"]').focus();
    await page.keyboard.press('ArrowRight');
    expect([await focusedTab(page), await activeTab(page)]).toEqual(['b', 'a']);
    expect(await page.evaluate(() => [...document.querySelectorAll('#g sl-tab')].map(t => t.getAttribute('tabindex')))).toEqual(['-1', '0', '-1', '-1']);
    await page.keyboard.press('Enter');
    expect(await activeTab(page)).toBe('b');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Space');
    expect([await focusedTab(page), await activeTab(page)]).toEqual(['d', 'd']);
    expect(await page.evaluate(() => window.log)).toEqual(['b', 'd']);
    expect(pageErrors).toEqual([]);
  });

  test('placement start: Up and Down move between tabs, Left and Right do nothing', async ({ page }) => {
    const pageErrors = await loadBundle(page, ENTRY);
    await mountGroup(page, 'placement="start"');
    await page.locator('#g sl-tab[panel="a"]').focus();
    const steps = [];
    for (const key of ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft']) {
      await page.keyboard.press(key);
      steps.push([key, await focusedTab(page), await activeTab(page)]);
    }
    expect(steps).toEqual([['ArrowDown', 'b', 'b'], ['ArrowRight', 'b', 'b'], ['ArrowUp', 'a', 'a'], ['ArrowLeft', 'a', 'a']]);
    expect(pageErrors).toEqual([]);
  });
});

test('the scroll button labels and the tab close label are the localization module\'s terms in each element\'s own language', async ({ page }) => {
  const pageErrors = await loadBundle(page, ENTRY);
  await page.setViewportSize({ width: 400, height: 600 });
  const r = await page.evaluate(async () => {
    const { localize: { registerTranslation }, en } = window.modules;
    registerTranslation({ ...en, $code: 'xq', $name: 'Test', $dir: 'ltr', close: 'Close-xq', scrollToStart: 'Start-xq', scrollToEnd: 'End-xq' });
    const tabs = Array.from({ length: 12 }, (_, i) => `<sl-tab slot="nav" panel="p${i}" ${i === 0 ? 'closable lang="xq"' : ''}>Tab number ${i}</sl-tab><sl-tab-panel name="p${i}">${i}</sl-tab-panel>`).join('');
    document.body.innerHTML = `<sl-tab-group id="g" lang="xq">${tabs}</sl-tab-group><sl-tab-group id="h">${tabs}</sl-tab-group>`;
    const labels = id => [...document.querySelector(`#${id}`).shadowRoot.querySelectorAll('sl-icon-button')].map(b => b.label);
    const deadline = Date.now() + 3000;
    while ((labels('g').length < 2 || labels('h').length < 2) && Date.now() < deadline) await new Promise(r => setTimeout(r, 20));
    return { g: labels('g'), h: labels('h'), close: document.querySelector('#g sl-tab').shadowRoot.querySelector('sl-icon-button').label };
  });
  expect(r).toEqual({ g: ['Start-xq', 'End-xq'], h: ['Scroll to start', 'Scroll to end'], close: 'Close-xq' });
  expect(pageErrors).toEqual([]);
});

test('dir="rtl" on the tab group: Left moves to the next tab, and the indicator moves with the tab', async ({ page }) => {
  const pageErrors = await loadBundle(page, ENTRY);
  await mountGroup(page, 'dir="rtl"');
  await page.locator('#g sl-tab[panel="a"]').focus();
  await page.keyboard.press('ArrowLeft');
  expect([await focusedTab(page), await activeTab(page)]).toEqual(['b', 'b']);
  await page.keyboard.press('ArrowRight');
  expect([await focusedTab(page), await activeTab(page)]).toEqual(['a', 'a']);
  const r = await page.evaluate(async () => {
    const el = document.querySelector('#g');
    el.show('b');
    await new Promise(r => setTimeout(r, 400));
    const indicator = el.shadowRoot.querySelector('[part="active-tab-indicator"]').getBoundingClientRect();
    const tab = el.querySelector('sl-tab[panel="b"]').getBoundingClientRect();
    return { rtl: el.shadowRoot.querySelector('[part="base"]').classList.contains('tab-group--rtl'), offset: Math.round(Math.abs(indicator.right - tab.right)) };
  });
  expect(r.rtl).toBe(true);
  expect(r.offset).toBeLessThanOrEqual(1);
  expect(pageErrors).toEqual([]);
});

test('a direction set only through the dir property (not reflected) controls the arrow keys and the rtl class, as in Shoelace; clearing it falls back to the document\'s', async ({ page }) => {
  const pageErrors = await loadBundle(page, ENTRY);
  await mountGroup(page);
  await page.evaluate(async () => {
    const el = document.querySelector('#g');
    el.dir = 'rtl';
    await el.updateComplete;
  });
  expect(await page.evaluate(() => {
    const el = document.querySelector('#g');
    return [el.hasAttribute('dir'), el.shadowRoot.querySelector('[part="base"]').classList.contains('tab-group--rtl')];
  })).toEqual([false, true]);
  await page.locator('#g sl-tab[panel="a"]').focus();
  await page.keyboard.press('ArrowLeft');
  expect([await focusedTab(page), await activeTab(page)]).toEqual(['b', 'b']);
  await page.evaluate(async () => {
    const el = document.querySelector('#g');
    el.dir = '';
    await el.updateComplete;
  });
  await page.keyboard.press('ArrowLeft');
  expect([await focusedTab(page), await activeTab(page)]).toEqual(['a', 'a']);
  // The document's direction applies when the tab group has none of its own.
  await page.evaluate(async () => {
    document.documentElement.dir = 'rtl';
    await new Promise(r => setTimeout(r, 50));
  });
  await page.keyboard.press('ArrowLeft');
  expect([await focusedTab(page), await activeTab(page)]).toEqual(['b', 'b']);
  await page.evaluate(() => document.documentElement.removeAttribute('dir'));
  expect(pageErrors).toEqual([]);
});

// The class-only entry: Shoelace's tab group declares sl-icon-button and sl-resize-observer in `static dependencies`, and its
// base element defines each missing one when a tab group is constructed; Velcro's does the same.
test('class-only entry: importing defines nothing; constructing a tab group defines Velcro\'s sl-icon-button and sl-resize-observer', async ({ page }) => {
  const pageErrors = await loadBundle(page, CLASS_ENTRY);
  const r = await page.evaluate(() => {
    const { SlTabGroup, VelcroTabGroup } = window.tabGroupClass;
    const tags = () => ['sl-tab-group', 'sl-icon-button', 'sl-resize-observer', 'sl-tab', 'sl-tab-panel'].map(t => customElements.get(t)?.name ?? null);
    const afterImport = tags();
    customElements.define('sl-tab-group', SlTabGroup);
    document.body.append(document.createElement('sl-tab-group'));
    return { afterImport, afterConstruct: tags(), alias: SlTabGroup === VelcroTabGroup };
  });
  expect(r).toEqual({
    afterImport: [null, null, null, null, null],
    afterConstruct: ['VelcroTabGroup', 'VelcroIconButton', 'VelcroResizeObserver', null, null],
    alias: true,
  });
  expect(pageErrors).toEqual([]);
});

// Shoelace's tab group imports its scrollend polyfill for its side effect; a bundler drops such an import from a module the
// package marks side-effect free, so the polyfill module is listed in the package's sideEffects.
test('bundles of the class-only and registering entries keep Shoelace\'s scrollend polyfill', async () => {
  for (const source of [CLASS_ENTRY, ENTRY]) {
    if (!bundles.has(source)) bundles.set(source, await build({ 'entry.js': source }));
    const code = bundles.get(source);
    expect(code).toMatch(/["']onscrollend["'] in window/);
    expect(code).toContain('touchcancel');
  }
});

// Shoelace's React examples, ported in packages/docs/examples/tab-group/react/*.jsx, bundled with React 19 and the generated
// wrappers, which are resolved through the package's real export map.
test('React examples render the same tab groups as the HTML examples through the generated wrappers; the closable one removes a tab', async ({ page }) => {
  const names = ORDER.map(([id]) => id);
  const fromVelcro = createRequire(path.join(velcroDir, 'package.json'));
  const pkgDir = name => path.dirname(fromVelcro.resolve(`${name}/package.json`));
  const entries = Object.fromEntries(names.map(n => [`${n}.jsx`, `${readFileSync(path.join(docsDir, `examples/tab-group/react/${n}.jsx`), 'utf8')}\nexport default App;\n`]));
  entries['entry.js'] = `
    import React from 'react';
    import { flushSync } from 'react-dom';
    import { createRoot } from 'react-dom/client';
    ${names.map((n, i) => `import App${i} from './${n}.jsx';`).join('\n')}
    const apps = { ${names.map((n, i) => `'${n}': App${i}`).join(', ')} };
    window.errors = [];
    addEventListener('error', e => window.errors.push(String(e.message)));
    window.renderExample = name => {
      const host = document.createElement('div');
      host.id = name;
      // At the top of the page, so that it is in the viewport (the tab group selects a tab once it is visible).
      document.body.prepend(host);
      window.scrollTo(0, 0);
      flushSync(() => createRoot(host).render(React.createElement(apps[name])));
    };
    window.loaded = true;
  `;
  const code = await build(entries, { resolve: { alias: { react: pkgDir('react'), 'react-dom': pkgDir('react-dom') } }, define: { 'process.env.NODE_ENV': '"production"' } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.setContent('<!DOCTYPE html><html class="sl-theme-light"><body style="margin: 0"></body></html>');
  await page.addStyleTag({ content: readFileSync(path.join(velcroDir, 'themes/light.css'), 'utf8') });
  await page.addScriptTag({ type: 'module', content: code });
  await page.waitForFunction(() => window.loaded === true);
  const r = await page.evaluate(async names => {
    const out = {};
    for (const name of names) {
      window.renderExample(name);
      const group = document.querySelector(`#${name} sl-tab-group`);
      await customElements.whenDefined('sl-tab-group');
      await group.updateComplete;
      const deadline = Date.now() + 3000;
      while (!group.querySelector('sl-tab[active]') && Date.now() < deadline) await new Promise(r => setTimeout(r, 20));
      out[name] = [group.placement, group.activation, group.fixedScrollControls, group.querySelectorAll('sl-tab').length, group.querySelector('sl-tab[active]')?.panel ?? null];
    }
    const closable = document.querySelector('#closable sl-tab[panel="closable-1"]');
    closable.shadowRoot.querySelector('sl-icon-button').click();
    out.afterClose = [...document.querySelectorAll('#closable sl-tab')].map(t => t.panel);
    return { out, errors: window.errors };
  }, names);
  expect(r.out).toEqual({
    basic: ['top', 'auto', false, 4, 'general'], bottom: ['bottom', 'auto', false, 4, 'general'], start: ['start', 'auto', false, 4, 'general'],
    end: ['end', 'auto', false, 4, 'general'], closable: ['top', 'auto', false, 4, 'general'], scrolling: ['top', 'auto', false, 20, 'tab-1'],
    // As on Shoelace's page, the React version of this example sets auto-hide-scroll-buttons, which nothing reads.
    'fixed-scroll-controls': ['top', 'auto', false, 20, 'tab-1'], manual: ['top', 'manual', false, 4, 'general'],
    afterClose: ['general', 'closable-2', 'closable-3'],
  });
  expect(r.errors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
