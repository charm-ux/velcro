import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { documentsLoaded, watchNetwork } from './support/loaded.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/radio-button';

// The docs page's examples, in page order: the example's title, and the name of its files under examples/radio-button/.
const EXAMPLES = [
  ['Overview', 'overview'],
  ['Checked States', 'checked-states'],
  ['Disabled', 'disabled'],
  ['Sizes', 'sizes'],
  ['Pill Buttons', 'pill'],
  ['Prefix and Suffix Icons', 'prefix-suffix'],
  ['Buttons with Icons', 'icons'],
];

const frameFor = (page, title) => page.frameLocator(`iframe.example[title="Radio Button example: ${title}"]`);

// Waits for every element in the document to render and for the groups' radio synchronisation.
async function settle(locator) {
  await locator.evaluate(async () => {
    await Promise.all(['sl-radio-group', 'sl-radio-button'].map(tag => customElements.whenDefined(tag)));
    const all = () => [...document.querySelectorAll('sl-radio-group, sl-radio-button, sl-button-group')];
    await Promise.all(all().map(el => el.updateComplete));
    await new Promise(resolve => setTimeout(resolve, 50));
    await Promise.all(all().map(el => el.updateComplete));
  });
}

async function openExample(page, title = 'Overview') {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  // Litro's client router remounts the page component once after load, which reloads the iframe; wait for it to settle.
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  await documentsLoaded(page);
  const frame = frameFor(page, title);
  await expect(frame.locator('sl-radio-button').first()).toBeAttached();
  await settle(frame.locator('body'));
  return { frame, requests };
}

// Appends markup to the example document (outside its radio group) and waits for it to render.
async function mount(frame, markup) {
  await frame.locator('body').evaluate((body, markup) => {
    document.querySelector('#mount')?.remove();
    const host = document.createElement('div');
    host.id = 'mount';
    host.innerHTML = markup;
    body.append(host);
  }, markup);
  await settle(frame.locator('body'));
}

test('docs page is prerendered with Velcro branding, prototype status, the quirks, explicit limits and the React examples', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Radio Button - Velcro</title>');
  // checked is @internal, so (as in Shoelace) neither the manifest nor the API table lists it, and the page says so.
  expect(html).toContain('the manifest and the API table below do not list it');
  expect(html).not.toContain('The API table lists it from the manifest');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('Not implemented or unverified');
  expect(html.match(/<summary>React<\/summary>/g)).toHaveLength(EXAMPLES.length);
  for (const [title] of EXAMPLES) expect(html).toContain(`title="Radio Button example: ${title}"`);
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
});

test('sl-radio-button registers as the exported class with no core marker or ch-* definitions; the host has role presentation', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
  const r = await frame.locator('#demo-default').evaluate(el => ({
    ctor: customElements.get('sl-radio-button') === el.constructor,
    attributes: el.getAttributeNames().filter(n => !n.startsWith('data-sl-button-group')).sort(),
    role: el.getAttribute('role'),
    chDefined: ['ch-radio-button', 'ch-button'].filter(tag => customElements.get(tag)),
    delegatesFocus: el.shadowRoot.delegatesFocus,
  }));
  expect(r.ctor).toBe(true);
  // checked and size reflect; the group checked this button and gave it its size.
  expect(r.attributes).toEqual(['checked', 'id', 'role', 'size', 'value']);
  expect(r.role).toBe('presentation');
  expect(r.chDefined).toEqual([]);
  expect(r.delegatesFocus).toBe(false);
});

test('structure: a presentational base around a role="radio" button with the prefix, label and suffix slots and Shoelace\'s parts and classes', async ({ page }) => {
  const { frame } = await openExample(page, 'Prefix and Suffix Icons');
  const s = await frame.locator('sl-radio-button').evaluateAll(els => els.map(el => {
    const root = el.shadowRoot;
    const button = root.querySelector('button');
    return {
      parts: [...root.querySelectorAll('[part]')].map(n => `${n.localName}:${n.getAttribute('part')}`),
      base: root.querySelector('[part="base"]').getAttribute('role'),
      button: ['role', 'aria-checked', 'aria-disabled', 'type', 'value'].map(a => button.getAttribute(a)),
      classes: [...button.classList].sort(),
    };
  }));
  expect(s[0].parts).toEqual(['div:base', 'button:button button--checked', 'slot:prefix', 'slot:label', 'slot:suffix']);
  expect(s[1].parts[1]).toBe('button:button');
  expect(s.map(x => x.base)).toEqual(['presentation', 'presentation', 'presentation']);
  expect(s.map(x => x.button)).toEqual([
    ['radio', 'true', 'false', 'button', '1'], ['radio', 'false', 'false', 'button', '2'], ['radio', 'false', 'false', 'button', '3'],
  ]);
  expect(s[0].classes).toEqual(['button', 'button--checked', 'button--default', 'button--has-label', 'button--has-prefix', 'button--medium', 'button--outline']);
  expect(s[1].classes).toEqual(['button', 'button--default', 'button--has-label', 'button--has-suffix', 'button--medium', 'button--outline']);
  expect(s[2].classes).toEqual(['button', 'button--default', 'button--has-label', 'button--has-prefix', 'button--has-suffix', 'button--medium', 'button--outline']);
});

test('in a group: a click checks the button and unchecks the others, a disabled button is not checked, sl-focus and sl-blur fire', async ({ page }) => {
  const { frame } = await openExample(page, 'Disabled');
  const state = () => frame.locator('sl-radio-button').evaluateAll(els => els.map(el => `${el.checked}:${el.hasAttribute('checked')}`));
  const second = frame.locator('sl-radio-button').nth(2);
  await second.evaluate(el => {
    window.__events = [];
    for (const type of ['sl-focus', 'sl-blur']) el.addEventListener(type, e => window.__events.push(`${type}:${e.bubbles}:${e.composed}`));
  });
  await second.click();
  expect(await state()).toEqual(['false:false', 'false:false', 'true:true']);
  await frame.locator('sl-radio-button').nth(1).click({ force: true });
  expect(await state()).toEqual(['false:false', 'false:false', 'true:true']);
  // A click does not focus a button in WebKit on macOS, so focus is moved from script.
  await second.evaluate(el => { el.blur(); window.__events = []; el.focus(); el.blur(); });
  expect(await frame.locator('body').evaluate(() => window.__events)).toEqual(['sl-focus:true:true', 'sl-blur:true:true']);
  // focus() and blur() go to the inner button.
  const focus = await second.evaluate(el => {
    el.focus();
    const inner = el.shadowRoot.activeElement?.localName;
    el.blur();
    return [inner, el.shadowRoot.activeElement];
  });
  expect(focus).toEqual(['button', null]);
});

test('upstream quirk: on its own a radio button is checked by a click or Space (native button activation) but never unchecked, and the arrow keys do nothing', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-radio-button id="solo" value="a">A</sl-radio-button><sl-radio-button id="solo-2" value="b">B</sl-radio-button>');
  const state = () => frame.locator('#mount').evaluate(host => [...host.querySelectorAll('sl-radio-button')].map(b => b.checked));
  await frame.locator('#solo').click();
  await frame.locator('#solo').click();
  expect(await state()).toEqual([true, false]);
  await frame.locator('#solo').evaluate(el => el.focus());
  for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) await page.keyboard.press(key);
  expect(await state()).toEqual([true, false]);
  await frame.locator('#solo-2').evaluate(el => el.focus());
  await page.keyboard.press('Space');
  // Space activates the native button, whose click checks it (the first stays checked: nothing unchecks it).
  expect(await state()).toEqual([true, true]);
});

test('upstream quirk: aria-disabled is written on the host only when disabled changes after the first render', async ({ page }) => {
  const { frame } = await openExample(page, 'Disabled');
  const r = await frame.locator('sl-radio-button').nth(1).evaluate(async el => {
    const initial = [el.disabled, el.getAttribute('aria-disabled'), el.shadowRoot.querySelector('button').getAttribute('aria-disabled')];
    el.disabled = false;
    await el.updateComplete;
    const enabled = el.getAttribute('aria-disabled');
    el.disabled = true;
    await el.updateComplete;
    return { initial, enabled, disabled: el.getAttribute('aria-disabled') };
  });
  expect(r).toEqual({ initial: [true, null, 'true'], enabled: 'false', disabled: 'true' });
});

test('upstream quirks: hiddenInput is always null, and the hidden attribute does not hide the radio button', async ({ page }) => {
  const { frame } = await openExample(page);
  // Outside a group (a button group's flex base would blockify the display).
  await mount(frame, '<sl-radio-button id="solo" value="a">A</sl-radio-button>');
  const r = await frame.locator('#solo').evaluate(el => {
    el.hidden = true;
    const display = getComputedStyle(el).display;
    el.hidden = false;
    return { hiddenInput: el.hiddenInput, input: el.input === el.shadowRoot.querySelector('button'), display };
  });
  expect(r).toEqual({ hiddenInput: null, input: true, display: 'inline-block' });
});

test('computed styles match Shoelace\'s button: heights by size, joined group borders, pill radius and the checked primary background', async ({ page }) => {
  const { frame } = await openExample(page, 'Pill Buttons');
  const s = await frame.locator('body').evaluate(() => {
    const probe = document.createElement('div');
    probe.style.backgroundColor = 'var(--sl-color-primary-600)';
    document.body.append(probe);
    const primary = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return [...document.querySelectorAll('sl-radio-group')].map(group => [...group.querySelectorAll('sl-radio-button')].map(b => {
      const button = b.shadowRoot.querySelector('button');
      const cs = getComputedStyle(button);
      // Shoelace's pill radius is the input height of the size (--sl-input-height-*), not --sl-border-radius-pill.
      const height = Math.round(button.getBoundingClientRect().height);
      const pill = `${height}px`;
      return [height, cs.borderTopLeftRadius === pill, cs.borderTopRightRadius === pill,
        cs.backgroundColor === primary];
    }));
  });
  expect(s).toEqual([
    [[30, true, false, true], [30, false, false, false], [30, false, true, false]],
    [[40, true, false, true], [40, false, false, false], [40, false, true, false]],
    [[50, true, false, true], [50, false, false, false], [50, false, true, false]],
  ]);
});

test('the icons example renders an sl-icon in each button with its label', async ({ page }) => {
  const { frame } = await openExample(page, 'Buttons with Icons');
  const r = await frame.locator('sl-radio-button').evaluateAll(els => els.map(el => {
    const icon = el.querySelector('sl-icon');
    return [el.value, el.checked, icon.label, Boolean(icon.shadowRoot?.querySelector('svg'))];
  }));
  expect(r.map(x => x[0])).toEqual(['angry', 'sad', 'neutral', 'happy', 'laughing']);
  expect(r.map(x => x[1])).toEqual([false, false, true, false, false]);
  expect(r.map(x => x[2])).toEqual(['Angry', 'Sad', 'Neutral', 'Happy', 'Laughing']);
  await expect.poll(() => frame.locator('sl-icon').evaluateAll(els => els.every(i => i.shadowRoot?.querySelector('svg')))).toBe(true);
});

test('label detection follows Shoelace\'s slot rule: text or an unslotted element counts, except sl-visually-hidden; a visually-hidden class does not exclude', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, `
    <sl-radio-button id="text" value="a">Label</sl-radio-button>
    <sl-radio-button id="blank" value="b">   </sl-radio-button>
    <sl-radio-button id="span" value="c"><span class="visually-hidden">Label</span></sl-radio-button>
    <sl-radio-button id="hidden" value="d"><sl-visually-hidden>Accessible label</sl-visually-hidden></sl-radio-button>
    <sl-radio-button id="icon" value="e"><sl-icon name="gear" label="Settings"></sl-icon></sl-radio-button>`);
  const read = () => frame.locator('#mount').evaluate(host => Object.fromEntries([...host.querySelectorAll('sl-radio-button')].map(el => {
    const button = el.shadowRoot.querySelector('button');
    const label = getComputedStyle(el.shadowRoot.querySelector('.button__label'));
    return [el.id, [button.classList.contains('button--has-label'), label.paddingLeft !== '0px']];
  })));
  expect(await read()).toEqual({
    text: [true, true], blank: [false, false], span: [true, true], hidden: [false, false], icon: [true, true],
  });
  // Replacing the default slot's content after the first render updates the class.
  await frame.locator('#text').evaluate(async el => {
    el.replaceChildren(document.createElement('sl-visually-hidden'));
    await new Promise(resolve => setTimeout(resolve, 20));
    await el.updateComplete;
  });
  await frame.locator('#blank').evaluate(async el => {
    el.textContent = 'Now labelled';
    await new Promise(resolve => setTimeout(resolve, 20));
    await el.updateComplete;
  });
  const after = await read();
  expect([after.text, after.blank]).toEqual([[false, false], [true, true]]);
});

test('the disabled watch hook runs as Shoelace\'s @watch decorator does: not on the first update, then with the previous and current values', async ({ page }) => {
  const { frame } = await openExample(page);
  const calls = await frame.locator('body').evaluate(async body => {
    const calls = [];
    const Base = customElements.get('sl-radio-button');
    class Traced extends Base {
      handleDisabledChange(...args) {
        calls.push([args, this.getAttribute('aria-disabled'), this.shadowRoot.querySelector('button').getAttribute('aria-disabled')]);
        super.handleDisabledChange(...args);
      }
    }
    customElements.define('velcro-traced-radio-button', Traced);
    const el = document.createElement('velcro-traced-radio-button');
    el.disabled = true;
    body.append(el);
    await el.updateComplete;
    calls.push('first update done');
    el.disabled = false;
    await el.updateComplete;
    el.disabled = true;
    await el.updateComplete;
    el.remove();
    return calls;
  });
  // The hook runs before the render: the inner button still has the previous aria-disabled.
  expect(calls).toEqual(['first update done', [[true, false], null, 'true'], [[false, true], 'false', 'false']]);
});

test('dir and lang are reactive, not reflected and undefined by default; removing a reflected attribute restores its initial value', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-radio-button id="r" value="a" pill size="large">A</sl-radio-button>');
  const r = await frame.locator('#r').evaluate(async el => {
    const before = [el.dir, el.lang];
    el.dir = 'rtl';
    el.lang = 'de';
    await el.updateComplete;
    const after = [el.dir, el.lang, el.hasAttribute('dir'), el.hasAttribute('lang')];
    el.removeAttribute('size');
    el.removeAttribute('pill');
    await el.updateComplete;
    return { before, after, restored: [el.size, el.pill] };
  });
  expect(r.before).toEqual([undefined, undefined]);
  expect(r.after).toEqual(['rtl', 'de', false, false]);
  // Boolean attributes go to false; size is restored to the value recorded at the first attribute change.
  expect(r.restored).toEqual(['medium', false]);
});

test('inherited core ready event: dispatched once after the first update, not bubbling or composed', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('body').evaluate(async body => {
    const events = [];
    const el = document.createElement('sl-radio-button');
    el.addEventListener('ready', e => events.push([e.bubbles, e.composed]));
    body.append(el);
    await el.updateComplete;
    el.pill = true;
    await el.updateComplete;
    return events;
  });
  expect(r).toEqual([[false, false]]);
});

test('every example renders its radio buttons and none requests the Shoelace runtime', async ({ page }) => {
  const { requests } = await openExample(page);
  for (const [title] of EXAMPLES) {
    const frame = frameFor(page, title);
    await expect(frame.locator('sl-radio-button').first()).toBeVisible();
    expect(await frame.locator('sl-radio-group').first().evaluate(el => el.shadowRoot.querySelector('sl-button-group') !== null)).toBe(true);
  }
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
});

// Shoelace's React examples, ported in packages/docs/examples/radio-button/react/*.jsx (the files the docs page shows),
// bundled with React 19 and the generated wrappers, resolved through the package's real export map.
test.describe('React examples', () => {
  const velcroDir = fileURLToPath(new URL('../../packages/velcro/', import.meta.url));
  const reactDir = fileURLToPath(new URL('../../packages/docs/examples/radio-button/react/', import.meta.url));
  const NAMES = EXAMPLES.map(([, name]) => name);
  let bundle;

  test.beforeAll(async () => {
    const fromVelcro = createRequire(path.join(velcroDir, 'package.json'));
    const fromDocs = createRequire(fileURLToPath(new URL('../../packages/docs/package.json', import.meta.url)));
    const pkgDir = name => path.dirname(fromVelcro.resolve(`${name}/package.json`));
    const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
    const dir = mkdtempSync(path.join(tmpdir(), 'velcro-radio-button-react-'));
    try {
      // Each example file declares `App` without exporting it (as on Shoelace's page); the copy only appends the export.
      for (const name of NAMES) {
        writeFileSync(path.join(dir, `${name}.jsx`), `${readFileSync(path.join(reactDir, `${name}.jsx`), 'utf8')}\nexport default App;\n`);
      }
      const entry = path.join(dir, 'entry.js');
      writeFileSync(entry, `
        import React from 'react';
        import { flushSync } from 'react-dom';
        import { createRoot } from 'react-dom/client';
        ${NAMES.map((name, i) => `import App${i} from './${name}.jsx';`).join('\n')}
        const apps = { ${NAMES.map((name, i) => `${JSON.stringify(name)}: App${i}`).join(', ')} };
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
    await page.evaluate(n => window.renderExample(n), name);
    await settle(page.locator('body'));
    return pageErrors;
  }

  const state = page => page.evaluate(() => [...document.querySelectorAll('sl-radio-group')].map(g =>
    [g.value, g.size, ...[...g.querySelectorAll('sl-radio-button')].map(b =>
      `${b.value}:${b.checked}:${b.disabled}:${b.pill}:${b.querySelectorAll('sl-icon').length}`)]));

  const three = (size, pill = false, disabled2 = false) => [['1', size, `1:true:false:${pill}:0`, `2:false:${disabled2}:${pill}:0`, `3:false:false:${pill}:0`]];
  const expected = {
    overview: three('medium'),
    'checked-states': three('medium'),
    disabled: three('medium', false, true),
    sizes: [...three('small'), ...three('medium'), ...three('large')],
    pill: [...three('small', true), ...three('medium', true), ...three('large', true)],
    'prefix-suffix': [['1', 'medium', '1:true:false:false:1', '2:false:false:false:1', '3:false:false:false:2']],
    icons: [['neutral', 'medium', 'angry:false:false:false:1', 'sad:false:false:false:1', 'neutral:true:false:false:1', 'happy:false:false:false:1', 'laughing:false:false:false:1']],
  };
  for (const name of NAMES) {
    test(`${name}: renders the same group and radio buttons as the HTML example, without errors`, async ({ page }) => {
      const pageErrors = await mountReact(page, name);
      expect(await page.evaluate(() => window.reactVersion)).toBe('19.2.0');
      expect(await state(page)).toEqual(expected[name]);
      expect(await page.evaluate(() => window.errors)).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  }

  test('overview: a click on another radio button moves the checked state', async ({ page }) => {
    await mountReact(page, 'overview');
    await page.locator('sl-radio-button').nth(2).click();
    expect(await state(page)).toEqual([['3', 'medium', '1:false:false:false:0', '2:false:false:false:0', '3:true:false:false:0']]);
  });
});
