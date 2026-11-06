// Runtime check of the generated React wrappers in React 19 (dist/react, built by the library build): omitted props keep
// the element's defaults (React 19 assigns any prop it is given, including undefined, to the element property), and
// supplied values set, update and clear the properties. The wrappers are bundled with Vite for the browser.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const velcroDir = fileURLToPath(new URL('../../packages/velcro/', import.meta.url));
const fromVelcro = createRequire(path.join(velcroDir, 'package.json'));
const fromDocs = createRequire(fileURLToPath(new URL('../../packages/docs/package.json', import.meta.url)));
const pkgDir = name => path.dirname(fromVelcro.resolve(`${name}/package.json`));

let bundle;
test.beforeAll(async () => {
  const { build } = await import(fromDocs.resolve('vite'));
  const dir = mkdtempSync(path.join(tmpdir(), 'velcro-react-'));
  try {
    const entry = path.join(dir, 'entry.js');
    writeFileSync(entry, `
      import React from 'react';
      import { flushSync } from 'react-dom';
      import { createRoot } from 'react-dom/client';
      import { VelcroBadge, VelcroButton, VelcroInclude, VelcroMutationObserver, VelcroPopup, VelcroProgressRing } from 'velcro-react';
      import * as wrappers from 'velcro-react';
      window.errors = [];
      addEventListener('error', e => window.errors.push(String(e.message)));
      addEventListener('unhandledrejection', e => window.errors.push(String(e.reason)));
      window.reactVersion = React.version;
      window.slFocus = 0;
      const root = createRoot(document.getElementById('root'));
      window.renderScenario = p => flushSync(() => root.render(React.createElement(React.Fragment, null,
        React.createElement(VelcroProgressRing, { id: 'ring', ...p.ring }),
        React.createElement(VelcroBadge, { id: 'badge', ...p.badge }, 'Badge'),
        React.createElement(VelcroButton, { id: 'button', ...p.button, onSlFocus: () => { window.slFocus++; } }, 'Go'))));
      window.mutations = [];
      const observerRoot = createRoot(document.getElementById('observer-root'));
      window.renderObserver = p => flushSync(() => observerRoot.render(React.createElement(VelcroMutationObserver,
        { id: 'observer', ...p, onSlMutation: e => window.mutations.push(e.detail.mutationList.map(r => [r.type, r.attributeName])) },
        React.createElement('p', { id: 'observed-child' }, 'text'))));
      window.repositions = 0;
      const popupRoot = createRoot(document.getElementById('popup-root'));
      window.renderPopup = p => flushSync(() => popupRoot.render(React.createElement(VelcroPopup,
        { id: 'popup', active: true, ...p, onSlReposition: () => { window.repositions++; } },
        React.createElement('span', { slot: 'anchor', style: { display: 'inline-block', width: '100px', height: '40px', margin: '10px 0 0 150px' } }),
        React.createElement('div', { style: { width: '80px', height: '20px' } }))));
      window.includeEvents = [];
      const includeRoot = createRoot(document.getElementById('include-root'));
      window.renderInclude = p => flushSync(() => includeRoot.render(React.createElement(VelcroInclude, { id: 'include', ...p,
        onSlLoad: e => window.includeEvents.push(['load', e.detail]), onSlError: e => window.includeEvents.push(['error', e.detail]) })));
      const wrapperRoot = createRoot(document.getElementById('wrapper-root'));
      window.renderWrapper = (name, p) => flushSync(() => wrapperRoot.render(name ? React.createElement(wrappers[name], { id: 'wrapped', ...p }) : null));
    `);
    const out = await build({
      configFile: false, logLevel: 'silent', root: dir,
      resolve: { alias: { react: pkgDir('react'), 'react-dom': pkgDir('react-dom'), 'velcro-react': path.join(velcroDir, 'dist/react/index.js') } },
      define: { 'process.env.NODE_ENV': '"production"' },
      build: { write: false, minify: false, rollupOptions: { input: entry, output: { format: 'es', inlineDynamicImports: true } } },
    });
    bundle = (Array.isArray(out) ? out[0] : out).output.find(o => o.type === 'chunk').code;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

async function mount(page) {
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.setContent('<!DOCTYPE html><html><body><div id="root"></div><div id="observer-root"></div><div id="popup-root" style="position: relative; width: 400px; height: 60px; overflow: hidden"></div><div id="include-root"></div><div id="wrapper-root"></div></body></html>');
  await page.addScriptTag({ type: 'module', content: bundle });
  await page.waitForFunction(() => typeof window.renderScenario === 'function');
  return pageErrors;
}

const state = page => page.evaluate(async () => {
  const ring = document.getElementById('ring');
  const badge = document.getElementById('badge');
  const button = document.getElementById('button');
  await Promise.all([ring.updateComplete, badge.updateComplete, button.updateComplete]);
  return {
    ring: { label: ring.label, value: ring.value, aria: ring.shadowRoot.querySelector('[part~="base"]')?.getAttribute('aria-label') },
    badge: { variant: badge.variant, pill: badge.pill, cls: badge.shadowRoot.querySelector('[part~="base"]')?.className.trim().split(/\s+/).sort() },
    button: { variant: button.variant, size: button.size, disabled: Boolean(button.disabled), href: button.href ?? null },
    toggle: { pressed: Boolean(button.pressed), expanded: Boolean(button.expanded) },
    errors: window.errors,
  };
});

test('React 19 wrappers keep element defaults when props are omitted', async ({ page }) => {
  const pageErrors = await mount(page);
  expect(await page.evaluate(() => window.reactVersion)).toBe('19.2.0');
  await page.evaluate(() => window.renderScenario({ ring: { value: 50 }, badge: {}, button: {} }));
  const s = await state(page);
  expect(s.ring).toEqual({ label: '', value: 50, aria: 'Progress' });
  expect(s.badge.variant).toBe('primary');
  expect(s.badge.pill).toBe(false);
  expect(s.badge.cls).toContain('badge--primary');
  expect(s.button).toEqual({ variant: 'default', size: 'medium', disabled: false, href: '' });
  expect(s.errors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('React 19 wrappers set, update and clear supplied props and forward events', async ({ page }) => {
  const pageErrors = await mount(page);
  await page.evaluate(() => window.renderScenario({ ring: { value: 10, label: 'Uploading' }, badge: { variant: 'danger', pill: true }, button: { variant: 'primary', disabled: true } }));
  let s = await state(page);
  expect(s.ring).toEqual({ label: 'Uploading', value: 10, aria: 'Uploading' });
  expect(s.badge).toMatchObject({ variant: 'danger', pill: true });
  expect(s.badge.cls).toContain('badge--danger');
  expect(s.button).toMatchObject({ variant: 'primary', disabled: true });

  await page.evaluate(() => window.renderScenario({ ring: { value: 75, label: 'Almost' }, badge: { variant: 'success', pill: false }, button: { variant: 'success', disabled: false } }));
  s = await state(page);
  expect(s.ring).toEqual({ label: 'Almost', value: 75, aria: 'Almost' });
  expect(s.badge).toMatchObject({ variant: 'success', pill: false });
  expect(s.button).toMatchObject({ variant: 'success', disabled: false });

  await page.locator('#button').focus();
  await expect.poll(() => page.evaluate(() => window.slFocus)).toBe(1);
  expect(s.errors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('React 19 wrappers restore element defaults when a supplied prop is removed', async ({ page }) => {
  const pageErrors = await mount(page);
  await page.evaluate(() => window.renderScenario({ ring: { value: 5, label: 'Saving' }, badge: { variant: 'danger', pill: true }, button: { size: 'large', disabled: true } }));
  await page.evaluate(() => window.renderScenario({ ring: { value: 5 }, badge: {}, button: {} }));
  const s = await state(page);
  expect(s.ring).toEqual({ label: '', value: 5, aria: 'Progress' });
  expect(s.badge).toMatchObject({ variant: 'primary', pill: false });
  expect(s.badge.cls).toContain('badge--primary');
  expect(s.button).toEqual({ variant: 'default', size: 'medium', disabled: false, href: '' });
  expect(s.errors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('React 19 wrappers never touch props omitted on both renders: element-managed state survives re-renders', async ({ page }) => {
  const pageErrors = await mount(page);
  await page.evaluate(() => window.renderScenario({ ring: { value: 1 }, badge: {}, button: { toggle: true } }));
  // Uncontrolled toggle: the click sets pressed on the element itself.
  await page.locator('#button').click();
  expect((await state(page)).toggle.pressed).toBe(true);
  // State the element (or other code) sets directly, not through props.
  await page.evaluate(() => { document.getElementById('button').expanded = true; });
  // Parent re-renders with unchanged props, then with an unrelated prop change.
  await page.evaluate(() => window.renderScenario({ ring: { value: 1 }, badge: {}, button: { toggle: true } }));
  await page.evaluate(() => window.renderScenario({ ring: { value: 2 }, badge: { variant: 'success' }, button: { toggle: true, size: 'small' } }));
  const s = await state(page);
  expect(s.toggle).toEqual({ pressed: true, expanded: true });
  expect(s.button.size).toBe('small');
  // A supplied value that does not change is not re-assigned over element state.
  await page.locator('#button').click();
  await page.evaluate(() => window.renderScenario({ ring: { value: 2 }, badge: { variant: 'success' }, button: { toggle: true, size: 'small' } }));
  expect((await state(page)).toggle.pressed).toBe(false);
  expect(s.errors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('React 19 wrapper for the mutation observer sets its props and forwards sl-mutation with the record list', async ({ page }) => {
  const pageErrors = await mount(page);
  await page.evaluate(() => window.renderObserver({ attr: 'title' }));
  await page.evaluate(async () => { await document.getElementById('observer').updateComplete; });
  expect(await page.evaluate(() => document.getElementById('observer').attr)).toBe('title');
  await page.evaluate(() => document.getElementById('observed-child').setAttribute('title', 'one'));
  await expect.poll(() => page.evaluate(() => window.mutations)).toEqual([[['attributes', 'title']]]);
  // The disabled prop stops the observer; removing it starts it again.
  await page.evaluate(() => window.renderObserver({ attr: 'title', disabled: true }));
  await page.evaluate(async () => { await document.getElementById('observer').updateComplete; });
  await page.evaluate(() => document.getElementById('observed-child').setAttribute('title', 'two'));
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.mutations.length)).toBe(1);
  await page.evaluate(() => window.renderObserver({ attr: 'title' }));
  await page.evaluate(async () => { await document.getElementById('observer').updateComplete; });
  await page.evaluate(() => document.getElementById('observed-child').setAttribute('title', 'three'));
  await expect.poll(() => page.evaluate(() => window.mutations.length)).toBe(2);
  expect(await page.evaluate(() => window.errors)).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('React 19 wrapper for the popup sets camelCase props whose attribute is hyphenated as element properties', async ({ page }) => {
  const pageErrors = await mount(page);
  const read = () => page.evaluate(async () => {
    const el = document.getElementById('popup');
    await el.updateComplete;
    const keys = ['arrowPadding', 'arrowPlacement', 'autoSize', 'autoSizePadding', 'flipFallbackPlacements', 'flipFallbackStrategy',
      'flipPadding', 'shiftPadding'];
    // The wrapper always passes `style`, so that attribute is left out.
    return { props: Object.fromEntries(keys.map(k => [k, el[k] ?? null])), attrs: el.getAttributeNames().filter(n => n !== 'style').sort() };
  });
  const supplied = { arrowPadding: 4, arrowPlacement: 'start', autoSize: 'vertical', autoSizePadding: 3, flipFallbackPlacements: 'right bottom',
    flipFallbackStrategy: 'initial', flipPadding: 2, shiftPadding: 5 };
  await page.evaluate(p => window.renderPopup(p), supplied);
  // Set as properties: numbers stay numbers, a string flipFallbackPlacements is not split (as with Shoelace's wrapper), and
  // only the reflected attributes appear.
  expect(await read()).toEqual({ props: supplied, attrs: ['active', 'data-current-placement', 'id', 'placement', 'strategy'] });
  await expect.poll(() => page.evaluate(() => window.repositions)).toBeGreaterThan(0);
  // Removing the props restores the element's defaults.
  await page.evaluate(() => window.renderPopup({}));
  expect((await read()).props).toEqual({ arrowPadding: 10, arrowPlacement: 'anchor', autoSize: null, autoSizePadding: 0, flipFallbackPlacements: '',
    flipFallbackStrategy: 'best-fit', flipPadding: 0, shiftPadding: 0 });
  // A hyphenated spelling is still passed through as an attribute.
  await page.evaluate(() => window.renderPopup({ 'arrow-padding': '7' }));
  expect((await read()).props.arrowPadding).toBe(7);
  expect(await page.evaluate(() => window.errors)).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('React 19 wrapper for the popup: flip with fallback placements given as the prop, as the hyphenated attribute and directly', async ({ page }) => {
  const pageErrors = await mount(page);
  // The 60px-high, clipping popup root leaves no room above the anchor, so flip uses the fallbacks.
  // Positioned and auto-update quiet (no new sl-reposition across two frames), rather than a fixed wait.
  await page.evaluate(() => {
    window.positioned = async el => {
      const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await el.updateComplete;
      for (let n = -1, i = 0; (n !== window.repositions || !el.hasAttribute('data-current-placement')) && i < 20; i++) {
        n = window.repositions;
        await frame();
      }
      return el.getAttribute('data-current-placement');
    };
  });
  const placement = () => page.evaluate(() => window.positioned(document.getElementById('popup')));
  await page.evaluate(() => window.renderPopup({ flip: true, flipFallbackPlacements: 'right' }));
  const viaProp = await placement();
  // The same string assigned to the element property directly, outside React.
  const direct = await page.evaluate(async () => {
    const el = document.getElementById('popup');
    window.renderPopup({ flip: true });
    el.flipFallbackPlacements = 'right';
    await el.updateComplete;
    // Cleared first, so the value read is from a computation with the direct assignment.
    el.removeAttribute('data-current-placement');
    el.reposition();
    return window.positioned(el);
  });
  await page.evaluate(() => window.renderPopup({}));
  await page.evaluate(() => window.renderPopup({ flip: true, 'flip-fallback-placements': 'right' }));
  const viaAttribute = await placement();
  // As with Shoelace's wrapper, the prop sets the property, whose string is not split (the documented quirk); the
  // attribute is split into placements and its fallback is used.
  expect({ viaProp, direct, viaAttribute }).toEqual({ viaProp: direct, direct, viaAttribute: 'right' });
  expect(viaProp).not.toBe('right');
  // Computed (the attribute is set), not left over: Floating UI receives the string's characters as placements.
  expect(viaProp).toEqual(expect.any(String));
  expect(await page.evaluate(() => window.errors)).toEqual([]);
  expect(pageErrors).toEqual([]);
});

// Each camelCase prop whose attribute is hyphenated, in the existing wrappers the generator change also affects:
// [wrapper, tag, prop, attribute, supplied, updated, attribute text, property from that attribute].
const HYPHENATED = [
  ['VelcroCard', 'sl-card', 'mediaPosition', 'media-position', 'bottom', 'end', 'start', 'start'],
  ['VelcroDivider', 'sl-divider', 'alignContent', 'align-content', 'start', 'end', 'center', 'center'],
  ['VelcroFormatDate', 'sl-format-date', 'hourFormat', 'hour-format', '12', '24', '12', '12'],
  ['VelcroFormatDate', 'sl-format-date', 'timeZone', 'time-zone', 'UTC', 'Asia/Tokyo', 'UTC', 'UTC'],
  ['VelcroFormatDate', 'sl-format-date', 'timeZoneName', 'time-zone-name', 'short', 'long', 'long', 'long'],
  ['VelcroFormatNumber', 'sl-format-number', 'currencyDisplay', 'currency-display', 'code', 'name', 'narrowSymbol', 'narrowSymbol'],
  ['VelcroFormatNumber', 'sl-format-number', 'maximumFractionDigits', 'maximum-fraction-digits', 2, 4, '3', 3],
  ['VelcroFormatNumber', 'sl-format-number', 'maximumSignificantDigits', 'maximum-significant-digits', 3, 5, '2', 2],
  ['VelcroFormatNumber', 'sl-format-number', 'minimumFractionDigits', 'minimum-fraction-digits', 1, 2, '1', 1],
  ['VelcroFormatNumber', 'sl-format-number', 'minimumIntegerDigits', 'minimum-integer-digits', 2, 3, '4', 4],
  ['VelcroFormatNumber', 'sl-format-number', 'minimumSignificantDigits', 'minimum-significant-digits', 1, 2, '3', 3],
  ['VelcroProgressBar', 'sl-progress-bar', 'helpText', 'help-text', 'first', 'second', 'third', 'third'],
  ['VelcroSpinner', 'sl-spinner', 'labelPosition', 'label-position', 'before', 'after', 'above', 'above'],
  ['VelcroSwitch', 'sl-switch', 'errorMessage', 'error-message', 'first', 'second', 'third', 'third'],
  ['VelcroSwitch', 'sl-switch', 'helpText', 'help-text', 'first', 'second', 'third', 'third'],
  ['VelcroSwitch', 'sl-switch', 'labelPosition', 'label-position', 'start', 'top', 'start', 'start'],
];

test('React 19 wrappers set camelCase props with hyphenated attributes as properties: supplied, updated, removed, and the attribute spelling', async ({ page }) => {
  const pageErrors = await mount(page);
  const results = await page.evaluate(async table => {
    const read = async (tag, prop, attribute) => {
      const el = document.getElementById('wrapped');
      await el.updateComplete;
      return { value: el[prop] ?? null, attribute: el.getAttribute(attribute) };
    };
    const out = [];
    for (const [wrapper, tag, prop, attribute, supplied, updated, text] of table) {
      // The element's own value once connected without the prop (some elements settle a default on connection).
      window.renderWrapper(wrapper, {});
      const row = { key: `${wrapper}.${prop}`, initial: await read(tag, prop, attribute) };
      window.renderWrapper(null);
      window.renderWrapper(wrapper, { [prop]: supplied });
      row.supplied = await read(tag, prop, attribute);
      window.renderWrapper(wrapper, { [prop]: updated });
      row.updated = await read(tag, prop, attribute);
      window.renderWrapper(wrapper, {});
      row.removed = await read(tag, prop, attribute);
      // The same property sequence on an element outside React, ending with the value the element started with.
      const control = document.createElement(tag);
      document.body.append(control);
      const steps = [];
      for (const value of [supplied, updated, row.initial.value ?? undefined]) {
        control[prop] = value;
        await control.updateComplete;
        steps.push(control.getAttribute(attribute));
      }
      row.controlAttributes = steps;
      row.control = { value: control[prop] ?? null, attribute: control.getAttribute(attribute) };
      control.remove();
      window.renderWrapper(null);
      window.renderWrapper(wrapper, { [attribute]: text });
      row.viaAttribute = await read(tag, prop, attribute);
      window.renderWrapper(null);
      out.push(row);
    }
    return out;
  }, HYPHENATED);
  expect(results.map(r => r.key)).toEqual(HYPHENATED.map(([wrapper, , prop]) => `${wrapper}.${prop}`));
  for (const [i, [, , , , supplied, updated, text, fromAttribute]] of HYPHENATED.entries()) {
    const r = results[i];
    // Set as the property: the hyphenated attribute appears only when the element reflects it, as with a direct assignment
    // (passed as an attribute, it would always appear).
    expect.soft([r.supplied.attribute, r.updated.attribute], r.key).toEqual(r.controlAttributes.slice(0, 2));
    expect.soft(r.supplied.value, r.key).toBe(supplied);
    expect.soft(r.updated.value, r.key).toBe(updated);
    // Removal assigns the element's earlier value back, so it ends as the same assignments made directly do. That is
    // the initial value, except where an element restores a reflected property's recorded value when its attribute is
    // removed (the switch's labelPosition, recorded when its own reflection first changed an attribute).
    expect.soft(r.removed, r.key).toEqual(r.control);
    if (r.key !== 'VelcroSwitch.labelPosition') expect.soft(r.removed.value, r.key).toEqual(r.initial.value);
    // The hyphenated spelling reaches the element as the attribute, and the element converts it.
    expect.soft(r.viaAttribute, r.key).toEqual({ value: fromAttribute, attribute: text });
  }
  expect(await page.evaluate(() => window.errors)).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('React 19 wrapper for the include sets src, mode and allowScripts as element properties and maps onSlLoad and onSlError', async ({ page }) => {
  const pageErrors = await mount(page);
  await page.route('http://include.test/**', route => {
    const url = new URL(route.request().url());
    return url.pathname.startsWith('/ok')
      ? route.fulfill({ status: 200, contentType: 'text/html', body: '<p id="inc">Included</p><script>window.includeScript = (window.includeScript ?? 0) + 1</script>' })
      : route.fulfill({ status: 500, contentType: 'text/html', body: 'broken' });
  });
  const read = () => page.evaluate(async () => {
    const el = document.getElementById('include');
    await el.updateComplete;
    return { src: el.src, mode: el.mode, allowScripts: el.allowScripts, attrs: el.getAttributeNames().filter(n => n !== 'style').sort(), html: el.innerHTML.includes('id="inc"'), script: window.includeScript ?? 0 };
  });
  const events = () => page.evaluate(() => window.includeEvents);
  // Omitted props keep the element's defaults, src is set as a property (no attribute appears), and sl-load reaches onSlLoad.
  await page.evaluate(() => window.renderInclude({ src: 'http://include.test/ok' }));
  await expect.poll(async () => (await events()).length).toBe(1);
  expect(await read()).toEqual({ src: 'http://include.test/ok', mode: 'cors', allowScripts: false, attrs: ['id'], html: true, script: 0 });
  expect(await events()).toEqual([['load', {}]]);
  // allowScripts (the property for allow-scripts) applies to the next src: its script runs.
  await page.evaluate(() => window.renderInclude({ src: 'http://include.test/ok-2', allowScripts: true, mode: 'cors' }));
  await expect.poll(async () => (await events()).length).toBe(2);
  expect(await read()).toMatchObject({ allowScripts: true, mode: 'cors', attrs: ['id'], html: true, script: 1 });
  // An error status reaches onSlError as detail.status.
  await page.evaluate(() => window.renderInclude({ src: 'http://include.test/bad', allowScripts: true }));
  await expect.poll(async () => (await events()).length).toBe(3);
  expect((await events())[2]).toEqual(['error', { status: 500 }]);
  expect(await page.evaluate(() => window.errors)).toEqual([]);
  expect(pageErrors).toEqual([]);
});
