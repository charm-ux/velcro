import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { pressReceived, recordKeys } from './support/keys.mjs';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/radio';
const TITLES = ['Overview', 'Initial Value', 'Disabled', 'Sizes'];

async function openExample(page, name = 'Overview') {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  await expect(page.locator(`iframe.example[title="Radio example: ${name}"]`)).toHaveCount(1);
  const frame = page.frameLocator(`iframe.example[title="Radio example: ${name}"]`);
  await expect(frame.locator('sl-radio').first()).toBeVisible();
  await frame.locator('body').evaluate(() => customElements.whenDefined('sl-radio'));
  // The example's radio group checks the radio matching its value once sl-radio is defined.
  await expect.poll(() => frame.locator('body').evaluate(() => [...document.querySelectorAll('sl-radio')].some(r => r.checked))).toBe(true);
  // Rendering only: a test that reads the requests waits for the network to go quiet itself (documentsLoaded).
  return { frame, requests };
}

// Appends markup to the example document (outside its radio group) and waits for every sl-radio in it to render.
async function mount(frame, markup) {
  await frame.locator('body').evaluate(async (body, markup) => {
    document.querySelector('#mount')?.remove();
    const host = document.createElement('div');
    host.id = 'mount';
    host.innerHTML = markup;
    body.append(host);
    await Promise.all([...host.querySelectorAll('sl-radio')].map(el => el.updateComplete));
  }, markup);
}

const state = el => ({
  checked: el.checked,
  attributes: Object.fromEntries(el.getAttributeNames().sort().map(n => [n, el.getAttribute(n)])),
});

test('docs page is prerendered with Velcro branding, prototype status, explicit limits and the React examples', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Radio - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('The examples put the radios in Velcro&#39;s &lt;sl-radio-group&gt;');
  expect(html).not.toContain('stand-in');
  expect(html.match(/<summary>React<\/summary>/g)).toHaveLength(4);
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
});

test('sl-radio registers as the exported class with no core marker attribute or ch-* definitions; sl-icon is registered too', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  await documentsLoaded(page);
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
  const r = await frame.locator('#demo-default').evaluate(el => ({
    ctor: customElements.get('sl-radio') === el.constructor,
    attributes: el.getAttributeNames().sort(),
    chDefined: ['ch-radio', 'ch-icon'].filter(tag => customElements.get(tag)),
    icon: customElements.get('sl-icon') === el.shadowRoot.querySelector('sl-icon')?.constructor,
  }));
  expect(r.ctor).toBe(true);
  // The radio group checked this radio; size reflects its value, as in Shoelace.
  expect(r.attributes).toEqual(['aria-checked', 'aria-disabled', 'id', 'role', 'size', 'tabindex', 'value']);
  expect(r.chDefined).toEqual([]);
  expect(r.icon).toBe(true);
});

test('structure: base, control (control--checked), the system radio icon and the label slot, as Shoelace renders them', async ({ page }) => {
  const { frame } = await openExample(page);
  // The checked radio's icon fetches and draws its SVG after its first update (sl-icon's setIcon), so the draw is awaited first.
  await expect.poll(() => frame.locator('body').evaluate(() => Boolean(document.querySelector('sl-radio')?.shadowRoot
    ?.querySelector('.radio__control sl-icon')?.shadowRoot?.querySelector('svg circle')))).toBe(true);
  const structure = await frame.locator('body').evaluate(() => [...document.querySelectorAll('sl-radio')].slice(0, 2).map(el => {
    const root = el.shadowRoot;
    const base = root.querySelector('[part="base"]');
    const control = base.querySelector('.radio__control');
    const icon = control.querySelector('sl-icon');
    const label = base.querySelector('slot');
    return {
      base: [base.localName, base.className.split(' ').filter(Boolean).sort().join(' ')],
      control: control.getAttribute('part'),
      icon: icon && [icon.getAttribute('part'), icon.className, icon.getAttribute('library'), icon.getAttribute('name'),
        Boolean(icon.shadowRoot.querySelector('svg circle'))],
      label: [label.getAttribute('part'), label.className, label.name, label.assignedNodes().map(n => n.textContent).join('')],
    };
  }));
  expect(structure).toEqual([
    { base: ['span', 'radio radio--checked radio--medium'], control: 'control control--checked',
      icon: ['checked-icon', 'radio__checked-icon', 'system', 'radio', true],
      label: ['label', 'radio__label', '', 'Option 1'] },
    { base: ['span', 'radio radio--medium'], control: 'control', icon: null,
      label: ['label', 'radio__label', '', 'Option 2'] },
  ]);
});

test('semantics: role="radio" with aria-checked and aria-disabled, named by its label', async ({ page }) => {
  const { frame } = await openExample(page, 'Disabled');
  await expect(frame.getByRole('radio', { name: 'Option 1' })).toHaveAttribute('aria-checked', 'true');
  await expect(frame.getByRole('radio', { name: 'Option 2' })).toHaveAttribute('aria-disabled', 'true');
  await expect(frame.getByRole('radio', { name: 'Option 3' })).toHaveAttribute('aria-checked', 'false');
  await expect(frame.getByRole('radio', { checked: true })).toHaveCount(1);
});

test('defaults: unchecked, size medium, value undefined, role/tabindex/aria-* written on connect; checked and value never reflect', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-radio id="plain">Plain</sl-radio>');
  const r = await frame.locator('#plain').evaluate(async el => {
    const before = { checked: el.checked, value: el.value, size: el.size, disabled: el.disabled, dir: el.dir, lang: el.lang,
      attributes: el.getAttributeNames().sort().map(n => `${n}=${el.getAttribute(n)}`) };
    el.checked = true;
    el.value = 'x';
    await el.updateComplete;
    return { before, after: el.getAttributeNames().sort().map(n => `${n}=${el.getAttribute(n)}`) };
  });
  expect(r.before).toEqual({ checked: false, value: undefined, size: 'medium', disabled: false, dir: undefined, lang: undefined,
    attributes: ['aria-checked=false', 'aria-disabled=false', 'id=plain', 'role=radio', 'size=medium', 'tabindex=-1'] });
  expect(r.after).toEqual(['aria-checked=true', 'aria-disabled=false', 'id=plain', 'role=radio', 'size=medium', 'tabindex=0']);
});

test('upstream quirk: a checked attribute is ignored; only the property (set by a group or script) checks a radio', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-radio id="attr" checked>Attribute</sl-radio>');
  const r = await frame.locator('#attr').evaluate(async el => {
    const initial = el.checked;
    el.removeAttribute('checked');
    el.setAttribute('checked', '');
    await el.updateComplete;
    return { initial, later: el.checked, observed: el.constructor.observedAttributes.includes('checked'),
      aria: el.getAttribute('aria-checked') };
  });
  expect(r).toEqual({ initial: false, later: false, observed: false, aria: 'false' });
});

test('pointer: clicking a radio or its label checks it (never unchecks it); a disabled or readonly radio stays unchecked', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, `
    <sl-radio id="a" value="a">A</sl-radio>
    <sl-radio id="b" value="b" disabled>B</sl-radio>
    <sl-radio id="c" value="c" readonly>C</sl-radio>`);
  await frame.locator('#mount sl-radio').first().evaluate(() => {
    window.__events = [];
    for (const el of document.querySelectorAll('#mount sl-radio')) {
      el.addEventListener('selected', e => window.__events.push(`${el.id}:selected:${e.bubbles}:${e.composed}`));
    }
  });
  await frame.locator('#a').click();
  expect(await frame.locator('#a').evaluate(el => el.checked)).toBe(true);
  // Clicking the label text (the slotted content) also checks, and a second click does not uncheck.
  await frame.locator('#a').getByText('A').click();
  expect(await frame.locator('#a').evaluate(el => [el.checked, el.getAttribute('aria-checked'), el.getAttribute('tabindex')])).toEqual([true, 'true', '0']);
  await frame.locator('#b').click({ force: true });
  await frame.locator('#c').click();
  expect(await frame.locator('body').evaluate(() => ['b', 'c'].map(id => document.getElementById(id).checked))).toEqual([false, false]);
  // Velcro extension (core): `selected` once when the radio became checked, bubbling and composed.
  expect(await frame.locator('body').evaluate(() => window.__events)).toEqual(['a:selected:true:true']);
});

test('the radio part of Shoelace\'s upstream test: clicking a disabled radio in a group does not check it', async ({ page }) => {
  const { frame } = await openExample(page, 'Disabled');
  await frame.locator('#demo-disabled').click({ force: true });
  expect(await frame.locator('body').evaluate(() => [...document.querySelectorAll('sl-radio')].map(r => r.checked))).toEqual([true, false, false]);
});

test('radio group examples: the initial value is checked, a click moves the single checked radio and the tab stop', async ({ page }) => {
  const initial = await openExample(page, 'Initial Value');
  expect(await initial.frame.locator('body').evaluate(() => [...document.querySelectorAll('sl-radio')].map(r => r.checked))).toEqual([false, false, true]);
  const { frame } = await openExample(page);
  await frame.locator('sl-radio[value="2"]').click();
  expect(await frame.locator('body').evaluate(() => [...document.querySelectorAll('sl-radio')].map(r => [r.checked, r.getAttribute('tabindex')])))
    .toEqual([[false, '-1'], [true, '0'], [false, '-1']]);
});

test('keyboard: only a checked radio is a tab stop; outside a group Space and arrows do nothing on a radio (Shoelace leaves them to the group); sl-focus and sl-blur fire', async ({ page }) => {
  const { frame } = await openExample(page);
  const first = frame.locator('#demo-default');
  await first.evaluate(el => {
    window.__events = [];
    for (const type of ['sl-focus', 'sl-blur']) el.addEventListener(type, e => window.__events.push(`${type}:${e.bubbles}:${e.composed}`));
  });
  await frame.locator('body').evaluate(body => {
    const start = document.createElement('button');
    start.id = 'start';
    start.textContent = 'start';
    body.prepend(start);
    const end = document.createElement('button');
    end.id = 'end';
    end.textContent = 'end';
    body.append(end);
  });
  await frame.locator('#start').focus();
  await page.keyboard.press('Tab');
  await expect.poll(() => frame.locator('body').evaluate(() => document.activeElement?.id)).toBe('demo-default');
  // The focus ring is drawn on the control, as in Shoelace.
  const ring = await first.evaluate(el => {
    const control = getComputedStyle(el.shadowRoot.querySelector('[part~="control"]'));
    return { style: control.outlineStyle, width: control.outlineWidth, offset: control.outlineOffset,
      focused: el.shadowRoot.querySelector('[part="base"]').classList.contains('radio--focused') };
  });
  expect(ring).toEqual({ style: 'solid', width: '3px', offset: '1px', focused: true });
  // Unchecked radios have tabindex="-1", so Tab leaves the group.
  await page.keyboard.press('Tab');
  await expect.poll(() => frame.locator('body').evaluate(() => document.activeElement?.id)).toBe('end');
  expect(await first.evaluate(() => window.__events)).toEqual(['sl-focus:true:true', 'sl-blur:true:true']);
  expect(await first.evaluate(el => el.shadowRoot.querySelector('[part="base"]').classList.contains('radio--focused'))).toBe(false);
  // Outside a radio group, Space and the arrow keys do nothing on a radio, checked or not.
  await mount(frame, '<sl-radio id="solo-1" value="a">A</sl-radio><sl-radio id="solo-2" value="b">B</sl-radio>');
  const solo = () => frame.locator('#mount').evaluate(host => [...host.querySelectorAll('sl-radio')].map(r => r.checked));
  await frame.locator('#solo-1').evaluate(el => { el.checked = true; });
  await frame.locator('#solo-1').focus();
  await recordKeys(frame.locator('body'));
  for (const key of ['ArrowDown', 'ArrowRight', 'ArrowUp', 'Space']) await pressReceived(page, frame.locator('body'), key);
  expect(await solo()).toEqual([true, false]);
  await frame.locator('#solo-2').focus();
  await pressReceived(page, frame.locator('body'), 'Space');
  expect(await solo()).toEqual([true, false]);
});

test('computed styles match Shoelace: toggle and font sizes, checked colors, label spacing and the disabled opacity', async ({ page }) => {
  const { frame } = await openExample(page, 'Sizes');
  const sizes = await frame.locator('body').evaluate(() => ['small', 'medium', 'large'].map(size => {
    const el = document.querySelector(`#demo-${size}`);
    const control = el.shadowRoot.querySelector('[part~="control"]');
    const icon = control.querySelector('sl-icon');
    const label = el.shadowRoot.querySelector('[part="label"]');
    const r = control.getBoundingClientRect();
    return { w: r.width, h: r.height, icon: icon.getBoundingClientRect().width, font: getComputedStyle(label).fontSize,
      lineHeight: getComputedStyle(label).lineHeight };
  }));
  expect(sizes).toEqual([
    { w: 14, h: 14, icon: 12, font: '14px', lineHeight: '14px' },
    { w: 18, h: 18, icon: 16, font: '16px', lineHeight: '18px' },
    { w: 22, h: 22, icon: 20, font: '20px', lineHeight: '22px' },
  ]);

  const disabled = await openExample(page, 'Disabled');
  const styles = await disabled.frame.locator('body').evaluate(() => [...document.querySelectorAll('sl-radio')].map(el => {
    const base = getComputedStyle(el.shadowRoot.querySelector('[part="base"]'));
    const control = getComputedStyle(el.shadowRoot.querySelector('[part~="control"]'));
    const label = getComputedStyle(el.shadowRoot.querySelector('[part="label"]'));
    return { host: getComputedStyle(el).display, display: base.display, cursor: base.cursor, opacity: base.opacity,
      background: control.backgroundColor, border: `${control.borderTopWidth} ${control.borderTopStyle} ${control.borderTopColor}`,
      radius: control.borderTopLeftRadius, color: control.color, margin: label.marginInlineStart };
  }));
  expect(styles).toEqual([
    { host: 'block', display: 'inline-flex', cursor: 'pointer', opacity: '1', background: 'rgb(2, 132, 199)',
      border: '1px solid rgb(2, 132, 199)', radius: '50%', color: 'rgb(255, 255, 255)', margin: '8px' },
    { host: 'block', display: 'inline-flex', cursor: 'not-allowed', opacity: '0.5', background: 'rgb(255, 255, 255)',
      border: '1px solid rgb(212, 212, 216)', radius: '50%', color: 'rgba(0, 0, 0, 0)', margin: '8px' },
    { host: 'block', display: 'inline-flex', cursor: 'pointer', opacity: '1', background: 'rgb(255, 255, 255)',
      border: '1px solid rgb(212, 212, 216)', radius: '50%', color: 'rgba(0, 0, 0, 0)', margin: '8px' },
  ]);
});

test('properties: size and disabled reflect; removing a reflected attribute restores its initial value; disabled updates aria-disabled', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-radio id="r" size="large" disabled>R</sl-radio>');
  const r = await frame.locator('#r').evaluate(async el => {
    const initial = [el.size, el.disabled, el.getAttribute('aria-disabled')];
    el.removeAttribute('size');
    el.removeAttribute('disabled');
    await el.updateComplete;
    const removed = [el.size, el.getAttribute('size'), el.disabled, el.getAttribute('aria-disabled')];
    el.size = 'small';
    el.disabled = true;
    await el.updateComplete;
    return { initial, removed, set: [el.getAttribute('size'), el.hasAttribute('disabled'), el.getAttribute('aria-disabled')] };
  });
  // The recorded initial value is the default ('medium'): the attributes are applied after the first attribute change.
  expect(r).toEqual({ initial: ['large', true, 'true'], removed: ['medium', 'medium', false, 'false'], set: ['small', true, 'true'] });
});

test('upstream quirks: a disabled radio keeps checked and its tab stop, reconnecting resets tabindex to -1, role/tabindex/aria are rewritten on connect, hidden does not hide it', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-radio id="q" role="button" tabindex="3" aria-disabled="true">Q</sl-radio><sl-radio id="h" hidden>H</sl-radio>');
  const r = await frame.locator('#q').evaluate(async el => {
    const connected = [el.getAttribute('role'), el.getAttribute('tabindex'), el.getAttribute('aria-disabled')];
    el.checked = true;
    await el.updateComplete;
    el.disabled = true;
    await el.updateComplete;
    const disabled = [el.checked, el.getAttribute('tabindex'), el.getAttribute('aria-checked'), el.getAttribute('aria-disabled')];
    el.disabled = false;
    await el.updateComplete;
    el.parentElement.append(el);
    await el.updateComplete;
    const moved = [el.checked, el.getAttribute('tabindex'), el.getAttribute('aria-checked')];
    const hidden = document.getElementById('h');
    return { connected, disabled, moved, hidden: [getComputedStyle(hidden).display, hidden.getBoundingClientRect().height > 0] };
  });
  expect(r).toEqual({
    connected: ['radio', '-1', 'false'],
    disabled: [true, '0', 'true', 'true'],
    moved: [true, '-1', 'true'],
    hidden: ['block', true],
  });
});

test('core extensions kept: label fallback, hide-label and vertical; none is set by default', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, `
    <sl-radio id="l" label="From label"></sl-radio>
    <sl-radio id="s" label="Unused">Slotted</sl-radio>
    <sl-radio id="hl" hide-label>Hidden label</sl-radio>
    <sl-radio id="v" vertical>Vertical</sl-radio>
    <sl-radio id="d">Default</sl-radio>`);
  const r = await frame.locator('body').evaluate(async () => {
    const get = id => document.getElementById(id);
    const label = id => get(id).shadowRoot.querySelector('[part="label"]');
    const d = get('d');
    return {
      fallback: label('l').getBoundingClientRect().width > 0 && label('l').textContent.trim(),
      slotted: label('s').assignedNodes().map(n => n.textContent).join(''),
      hidden: [label('hl').classList.contains('visually-hidden'), label('hl').getBoundingClientRect().width],
      vertical: getComputedStyle(get('v').shadowRoot.querySelector('[part="base"]')).flexDirection,
      defaults: [getComputedStyle(d.shadowRoot.querySelector('[part="base"]')).flexDirection, label('d').className, d.readonly, d.hideLabel, d.vertical, d.label],
    };
  });
  expect(r).toEqual({
    fallback: 'From label',
    slotted: 'Slotted',
    hidden: [true, 1],
    vertical: 'column',
    defaults: ['row', 'radio__label', false, false, false, undefined],
  });
  await expect(frame.getByRole('radio', { name: 'Hidden label' })).toHaveCount(1);
});

test('autofocus is the platform property, as in Shoelace: synchronous reflection, not observed, kept on upgrade', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-radio id="af" autofocus>Autofocus</sl-radio><sl-radio id="plain-af">Plain</sl-radio>');
  const r = await frame.locator('body').evaluate(() => {
    const parsed = document.getElementById('af');
    const plain = document.getElementById('plain-af');
    const upgraded = [parsed.autofocus, parsed.hasAttribute('autofocus')];
    // Native HTMLElement.autofocus reflects synchronously; core's reactive property would wait for an update.
    plain.autofocus = true;
    const set = plain.getAttribute('autofocus');
    plain.autofocus = false;
    const cleared = plain.hasAttribute('autofocus');
    const created = document.createElement('sl-radio');
    created.autofocus = true;
    return { upgraded, set, cleared, created: created.getAttribute('autofocus'),
      observed: customElements.get('sl-radio').observedAttributes.includes('autofocus') };
  });
  expect(r).toEqual({ upgraded: [true, true], set: '', cleared: false, created: '', observed: false });
});

test('watch hooks run as Shoelace\'s @watch decorators do: disabled before checked, with the previous and current values', async ({ page }) => {
  const { frame } = await openExample(page);
  const calls = await frame.locator('body').evaluate(async body => {
    const calls = [];
    const Base = customElements.get('sl-radio');
    class Traced extends Base {
      handleCheckedChange(...args) {
        calls.push(['checked', args, this.getAttribute('aria-disabled')]);
        super.handleCheckedChange(...args);
      }
      handleDisabledChange(...args) {
        calls.push(['disabled', args, this.getAttribute('aria-checked')]);
        super.handleDisabledChange(...args);
      }
    }
    customElements.define('velcro-traced-radio', Traced);
    const el = document.createElement('velcro-traced-radio');
    body.append(el);
    await el.updateComplete;
    calls.push('first update done');
    el.checked = true;
    el.disabled = true;
    await el.updateComplete;
    calls.push('batched update done');
    el.disabled = false;
    await el.updateComplete;
    el.remove();
    return calls;
  });
  // The first update runs only the checked watcher (disabled waits for the first update), from undefined to false.
  expect(calls).toEqual([
    ['checked', [undefined, false], 'false'],
    'first update done',
    ['disabled', [false, true], 'false'],
    ['checked', [false, true], 'true'],
    'batched update done',
    ['disabled', [true, false], 'true'],
  ]);
});

test('upstream quirk: the .radio wrapper\'s invalid align-items: top is kept in the styles and ignored by the browser', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('#demo-default').evaluate(el => {
    const base = el.shadowRoot.querySelector('[part="base"]');
    const sheets = el.shadowRoot.adoptedStyleSheets.length
      ? el.shadowRoot.adoptedStyleSheets
      : [...el.shadowRoot.querySelectorAll('style')].map(s => s.sheet);
    const radioRule = sheets.flatMap(sheet => [...sheet.cssRules]).find(rule => rule.selectorText === '.radio');
    return {
      source: el.constructor.styles.some(s => /\.radio \{[^}]*align-items: top;/.test(s.cssText)),
      parsed: radioRule.style.getPropertyValue('align-items'),
      computed: getComputedStyle(base).alignItems,
    };
  });
  expect(r).toEqual({ source: true, parsed: '', computed: 'normal' });
});

test('dir and lang are reactive, not reflected and undefined by default, as Shoelace\'s base element declares them', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-radio id="dl" dir="rtl" lang="de">DL</sl-radio>');
  const r = await frame.locator('#dl').evaluate(async el => {
    const fromAttributes = [el.dir, el.lang];
    el.dir = 'ltr';
    el.lang = 'fr';
    await el.updateComplete;
    return { fromAttributes, set: [el.dir, el.lang, el.getAttribute('dir'), el.getAttribute('lang')] };
  });
  expect(r).toEqual({ fromAttributes: ['rtl', 'de'], set: ['ltr', 'fr', 'rtl', 'de'] });
});

test('inherited core ready event: dispatched once on the element after the first update, not bubbling or composed', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('body').evaluate(async body => {
    const el = document.createElement('sl-radio');
    const seen = [];
    let bubbled = 0;
    el.addEventListener('ready', event => seen.push({ bubbles: event.bubbles, composed: event.composed }));
    body.addEventListener('ready', () => bubbled++);
    body.append(el);
    await el.updateComplete;
    el.checked = true;
    await el.updateComplete;
    el.remove();
    return { seen, bubbled };
  });
  expect(r).toEqual({ seen: [{ bubbles: false, composed: false }], bubbled: 0 });
});

test('every docs example renders in its own document', async ({ page }) => {
  await openDocs(page, PAGE);
  const titles = await page.locator('iframe.example').evaluateAll(frames => frames.map(f => f.title));
  expect(titles).toEqual(TITLES.map(t => `Radio example: ${t}`));
  for (const title of titles) {
    const frame = page.frameLocator(`iframe.example[title="${title}"]`);
    await expect(frame.locator('sl-radio').first()).toBeVisible();
    expect(await frame.locator('sl-radio').first().evaluate(el => Boolean(el.shadowRoot?.querySelector('[part~="base"]')))).toBe(true);
  }
});

test('no upstream Shoelace runtime is requested or defined; all requests stay on the local origin', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  await documentsLoaded(page);
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  expect(await frame.locator('body').evaluate(() => Boolean(window.Shoelace || document.querySelector('script[src*="shoelace"]')))).toBe(false);
});

// Shoelace's four React examples, ported in packages/docs/examples/radio/react/*.jsx (the files the docs page shows), with
// Velcro's radio group, bundled with React 19 and the generated wrapper, resolved through the package's real export map.
test.describe('React examples', () => {
  const velcroDir = fileURLToPath(new URL('../../packages/velcro/', import.meta.url));
  const reactDir = fileURLToPath(new URL('../../packages/docs/examples/radio/react/', import.meta.url));
  const REACT_EXAMPLES = ['overview', 'initial-value', 'disabled', 'sizes'];
  let bundle;

  test.beforeAll(async () => {
    const fromVelcro = createRequire(path.join(velcroDir, 'package.json'));
    const fromDocs = createRequire(fileURLToPath(new URL('../../packages/docs/package.json', import.meta.url)));
    const pkgDir = name => path.dirname(fromVelcro.resolve(`${name}/package.json`));
    const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
    const dir = mkdtempSync(path.join(tmpdir(), 'velcro-radio-react-'));
    try {
      // Each example file declares `App` without exporting it (as on Shoelace's page); the copy only appends the export.
      for (const name of REACT_EXAMPLES) {
        writeFileSync(path.join(dir, `${name}.jsx`), `${readFileSync(path.join(reactDir, `${name}.jsx`), 'utf8')}\nexport default App;\n`);
      }
      const entry = path.join(dir, 'entry.js');
      writeFileSync(entry, `
        import React from 'react';
        import { flushSync } from 'react-dom';
        import { createRoot } from 'react-dom/client';
        ${REACT_EXAMPLES.map((name, i) => `import App${i} from './${name}.jsx';`).join('\n')}
        const apps = { ${REACT_EXAMPLES.map((name, i) => `${JSON.stringify(name)}: App${i}`).join(', ')} };
        window.errors = [];
        addEventListener('error', e => window.errors.push(String(e.message)));
        addEventListener('unhandledrejection', e => window.errors.push(String(e.reason)));
        window.reactVersion = React.version;
        window.renderExample = name => {
          const host = document.createElement('div');
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
            return (await this.resolve(id, path.join(fileURLToPath(new URL('../../packages/docs/', import.meta.url)), 'app.ts'), { skipSelf: true })) ?? null;
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

  async function mountReact(page, name) {
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.setContent('<!DOCTYPE html><html><body style="margin: 0"></body></html>');
    await page.addScriptTag({ type: 'module', content: bundle });
    await page.waitForFunction(() => typeof window.renderExample === 'function');
    await page.evaluate(async n => {
      window.renderExample(n);
      await customElements.whenDefined('sl-radio');
      await Promise.all([...document.querySelectorAll('sl-radio')].map(r => r.updateComplete));
    }, name);
    return pageErrors;
  }

  const radios = page => page.evaluate(async () => {
    await Promise.all([...document.querySelectorAll('sl-radio')].map(r => r.updateComplete));
    return [...document.querySelectorAll('sl-radio')].map(r => `${r.value}:${r.checked}:${r.size}:${r.disabled}`);
  });

  test('overview: the group value checks option 1 and a click moves the selection', async ({ page }) => {
    const pageErrors = await mountReact(page, 'overview');
    expect(await page.evaluate(() => window.reactVersion)).toBe('19.2.0');
    expect(await radios(page)).toEqual(['1:true:medium:false', '2:false:medium:false', '3:false:medium:false']);
    await page.locator('sl-radio').nth(1).click();
    await expect.poll(() => radios(page)).toEqual(['1:false:medium:false', '2:true:medium:false', '3:false:medium:false']);
    expect(await page.evaluate(() => window.errors)).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('initial value: the group value checks option 3', async ({ page }) => {
    const pageErrors = await mountReact(page, 'initial-value');
    expect(await radios(page)).toEqual(['1:false:medium:false', '2:false:medium:false', '3:true:medium:false']);
    expect(await page.evaluate(() => window.errors)).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('disabled: option 2 is disabled and a click does not check it', async ({ page }) => {
    const pageErrors = await mountReact(page, 'disabled');
    expect(await radios(page)).toEqual(['1:true:medium:false', '2:false:medium:true', '3:false:medium:false']);
    await page.locator('sl-radio').nth(1).click({ force: true });
    expect(await radios(page)).toEqual(['1:true:medium:false', '2:false:medium:true', '3:false:medium:false']);
    expect(await page.evaluate(() => window.errors)).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('sizes: the group size is applied to its radios', async ({ page }) => {
    const pageErrors = await mountReact(page, 'sizes');
    expect(await radios(page)).toEqual(['small', 'medium', 'large'].flatMap(size => [`1:true:${size}:false`, `2:false:${size}:false`, `3:false:${size}:false`]));
    expect(await page.evaluate(() => [...document.querySelectorAll('sl-radio')].filter((_, i) => i % 3 === 0)
      .map(r => r.shadowRoot.querySelector('[part="base"]').className.split(' ').filter(c => c.startsWith('radio--')).sort().join(' '))))
      .toEqual(['radio--checked radio--small', 'radio--checked radio--medium', 'radio--checked radio--large']);
    expect(await page.evaluate(() => window.errors)).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
