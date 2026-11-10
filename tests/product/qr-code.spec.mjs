import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { expect, test } from '@playwright/test';
import { build, bundleExamples, loadBundle, loadExamples, velcroDir } from './support/bundle.mjs';
import { pressReceived, recordKeys } from './support/keys.mjs';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';
import { reactWrapperPage } from './support/react.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/qr-code';
// Shoelace 2.20.1's QR code page has five previews (the opening one, Colors, Size, Radius and Error Correction), all ported in
// Shoelace's order, each live and with a React version.
const ORDER = [['basic', 'Default'], ['colors', 'Colors'], ['size', 'Size'], ['radius', 'Radius'], ['error-correction', 'Error Correction']];
const title = section => `QR code example: ${section}`;
const VALUE = 'https://shoelace.style/';
const LABEL = 'Scan this code to visit Shoelace on the web!';

// qr-creator's own browser build (its package `main`, a classic script that defines `self.QrCreator`), the library and version
// Shoelace 2.20.1 draws its QR code with. The reference canvases below are drawn by it, from Shoelace's options.
const QR_CREATOR = createRequire(`${velcroDir}package.json`).resolve('qr-creator');

// The module pattern of Shoelace's example value at each error correction level, read at the centre of each module, as the
// number of modules per side and the sha256 of the rows ('1' dark, '0' light, joined by newlines). The 23-byte value needs a
// version 2 code (25 modules) at levels L and M and a version 3 code (29 modules) at Q and H, as the QR code capacity tables give.
const PATTERNS = {
  L: [25, '1dd0a7e7685ce467b015231eaa9e6e47e313aee2da24ff2e909a2c9e842873e6'],
  M: [25, '68468ce6740abec05c4415dd74316b20e55626461c1fa7caa7afa2352912c043'],
  Q: [29, '7faf3064c53fc2719c9cf36f42ccc06cd702455c0d87a4d9ae5e06a62252dac2'],
  H: [29, '388669391e87e185bf76c1116c28c2a93b2090445395291c99a34fd113e2fb1b'],
};

// The package entries, in a top-level document of the test's own.
const ENTRY = `
  import '@charm-ux/velcro/qr-code';
  window.loaded = true;
`;
const CLASS_ENTRY = `
  import { SlQrCode, VelcroQrCode } from '@charm-ux/velcro/qr-code/class';
  window.qrClass = { SlQrCode, VelcroQrCode };
  window.loaded = true;
`;

// In-page helpers, installed in the given frame or page: Shoelace's drawing call on a fresh canvas (`reference`), a byte
// comparison of two canvases (`differingBytes`), and the module pattern of a dark-on-light code read at the centre of each
// module (`modules`; engine-independent, because anti-aliasing only touches the module edges).
async function helpers(scope) {
  await scope.addScriptTag({ path: QR_CREATOR });
  await scope.evaluate(() => {
    const data = canvas => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    window.reference = el => {
      const canvas = document.createElement('canvas');
      // Shoelace 2.20.1's generate(): the same options, at twice the size.
      window.QrCreator.render({ text: el.value, radius: el.radius, ecLevel: el.errorCorrection, fill: el.fill, background: el.background, size: el.size * 2 }, canvas);
      return canvas;
    };
    window.differingBytes = (a, b) => {
      if (a.width !== b.width || a.height !== b.height) return -1;
      const x = data(a);
      const y = data(b);
      let n = 0;
      for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) n++;
      return n;
    };
    // Velcro's canvas against Shoelace's drawing of the same element: [bitmap width, height, differing bytes].
    window.againstShoelace = el => {
      const canvas = el.shadowRoot.querySelector('canvas');
      return [canvas.width, canvas.height, window.differingBytes(canvas, window.reference(el))];
    };
    // `known` is the module count of a code with rounded modules, whose corners are not dark.
    window.modules = (canvas, known) => {
      const pixels = data(canvas);
      const dark = (x, y) => pixels[(Math.floor(y) * canvas.width + Math.floor(x)) * 4] < 128;
      // The top-left finder pattern is 7 modules wide and starts at the corner (there is no quiet zone).
      let run = 0;
      while (run < canvas.width && dark(run, 1)) run++;
      const count = known ?? Math.round((7 * canvas.width) / run);
      if (!Number.isInteger(count) || count < 21 || count > 177) return null;
      const size = canvas.width / count;
      const rows = [];
      for (let r = 0; r < count; r++) {
        let row = '';
        for (let c = 0; c < count; c++) row += dark((c + 0.5) * size, (r + 0.5) * size) ? '1' : '0';
        rows.push(row);
      }
      return { count, rows: rows.join('\n') };
    };
  });
}
const sha = text => createHash('sha256').update(text).digest('hex');

// Mounts <sl-qr-code id="a" ...> in a fresh page with the package entry and the helpers; returns the page errors.
let quirksBundle;
async function mount(page, attrs = `value="${VALUE}"`, { doctype = true } = {}) {
  let pageErrors = [];
  if (doctype) {
    pageErrors = await loadBundle(page, ENTRY);
  } else {
    // A quirks-mode document (no doctype), as Shoelace's test runner page is, with the same package entry.
    quirksBundle ??= await build({ 'entry.js': ENTRY });
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.setContent('<html><body></body></html>');
    await page.addScriptTag({ type: 'module', content: quirksBundle });
    await page.waitForFunction(() => window.loaded === true);
  }
  await helpers(page);
  await page.evaluate(async attrs => {
    window.events = [];
    document.body.insertAdjacentHTML('beforeend', `<sl-qr-code id="a" ${attrs}></sl-qr-code>`);
    const el = document.querySelector('#a');
    el.addEventListener('ready', e => window.events.push(['ready', e.bubbles, e.composed, el.shadowRoot.querySelector('canvas').width]));
    await customElements.whenDefined('sl-qr-code');
    await el.updateComplete;
  }, attrs);
  return pageErrors;
}

// ---- the docs page and its examples ----

test('docs page is prerendered with Velcro branding, prototype status, every ported section in order, the quirks and the gaps', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>QR Code - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('without changing the shared core prefix');
  expect(html).toContain('was run locally in Chromium and WebKit only, and Firefox is covered only by the project&#39;s CI run');
  expect(html).toContain('setting fill and background in the same update draws the code twice');
  expect(html).toContain('The hidden attribute does not hide the QR code');
  expect(html).toContain('The code is drawn without a quiet zone');
  expect(html).toContain('compare each drawn canvas pixel for pixel with a canvas that qr-creator draws from Shoelace&#39;s options');
  const positions = ORDER.map(([, section]) => html.indexOf(`title="${title(section)}"`));
  expect(positions.every(p => p > 0)).toBe(true);
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  // The API tables: Shoelace's attributes, the public canvas field and generate() method and the base part; ready is labelled as inherited.
  for (const name of ['value', 'label', 'size', 'fill', 'background', 'radius', 'errorCorrection', 'canvas', 'generate', 'base', 'ready']) {
    expect(html).toContain(`data-name="${name}"`);
  }
  expect(html).toContain('Inherited from core');
  expect(html).toContain('<summary>React</summary>');
  expect(html).toContain('import { VelcroQrCode as SlQrCode } from &#39;@charm-ux/velcro/react/VelcroQrCode.js&#39;;');
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(html).not.toMatch(/(src|href)=(&quot;|")https?:\/\/[^"&]*shoelace/i);
  expect(await (await request.get('/')).text()).toContain('/components/qr-code');
});

async function openExamples(page) {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  // The example's own document (a Frame), so the helpers can be installed in it.
  const frame = async section => (await page.locator(`iframe.example[title="${title(section)}"]`).elementHandle()).contentFrame();
  return { requests, frame };
}

// The state of every QR code in an example frame, with its drawing compared with Shoelace's (qr-creator, in that frame).
async function frameCodes(frame) {
  await frame.evaluate(() => customElements.whenDefined('sl-qr-code'));
  await helpers(frame);
  return frame.evaluate(async count => {
    const codes = [...document.querySelectorAll('sl-qr-code')];
    await Promise.all(codes.map(c => c.updateComplete));
    return codes.map(el => {
      const canvas = el.shadowRoot.querySelector('canvas');
      return {
        // The radius example's rounded modules are read with the module count of the same value at the same level (H).
        props: [el.value, el.label, el.size, el.fill, el.background, el.radius, el.errorCorrection],
        css: [canvas.style.width, canvas.style.height, Math.round(canvas.getBoundingClientRect().width)],
        shoelace: window.againstShoelace(el),
        modules: el.fill === 'black' ? window.modules(canvas, el.radius > 0 ? count : undefined) : null,
      };
    });
  }, PATTERNS.H[0]);
}

test('examples: Shoelace\'s order, live in their own documents, with a React version each; no Shoelace runtime or other site is requested', async ({ page }) => {
  const { requests } = await openExamples(page);
  const frames = page.locator('iframe.example');
  await expect(frames).toHaveCount(ORDER.length);
  expect(await frames.evaluateAll(fs => fs.map(f => f.title))).toEqual(ORDER.map(([, s]) => title(s)));
  await expect(page.locator('details.react-example')).toHaveCount(ORDER.length);
  await documentsLoaded(page);
  expect(requests.filter(url => /shoelace|qrcode\.com/i.test(url))).toEqual([]);
});

test('examples draw exactly what Shoelace draws: values, sizes, colors, radius and error correction levels, pixel for pixel', async ({ page }) => {
  const { frame } = await openExamples(page);
  const codes = {};
  for (const [id, section] of ORDER) codes[id] = await frameCodes(await frame(section));
  const props = Object.fromEntries(Object.entries(codes).map(([id, list]) => [id, list.map(c => c.props)]));
  expect(props).toEqual({
    basic: [[VALUE, LABEL, 128, 'black', 'white', 0, 'H']],
    colors: [[VALUE, '', 128, 'deeppink', 'white', 0, 'H']],
    size: [[VALUE, '', 64, 'black', 'white', 0, 'H']],
    radius: [[VALUE, '', 128, 'black', 'white', 0.5, 'H']],
    'error-correction': ['L', 'M', 'Q', 'H'].map(level => [VALUE, '', 128, 'black', 'white', 0, level]),
  });
  for (const [id, list] of Object.entries(codes)) {
    for (const code of list) {
      const size = code.props[2];
      expect(code.css, id).toEqual([`${size}px`, `${size}px`, size]);
      expect(code.shoelace, id).toEqual([size * 2, size * 2, 0]);
    }
  }
  // The module patterns are pinned: square modules at each level, and the same pattern with rounded modules.
  const pattern = code => [code.modules.count, sha(code.modules.rows)];
  expect(codes['error-correction'].map(pattern)).toEqual(['L', 'M', 'Q', 'H'].map(level => PATTERNS[level]));
  expect(pattern(codes.basic[0])).toEqual(PATTERNS.H);
  expect(pattern(codes.size[0])).toEqual(PATTERNS.H);
  expect(pattern(codes.radius[0])).toEqual(PATTERNS.H);
});

test('Default example: typing in the input redraws the code with the new value, and the label stays the accessible name', async ({ page }) => {
  const { frame } = await openExamples(page);
  const example = await frame('Default');
  await example.evaluate(() => customElements.whenDefined('sl-qr-code'));
  const input = example.locator('sl-input input');
  await expect.poll(() => input.inputValue()).toBe(VALUE);
  await input.fill('');
  await input.pressSequentially('Velcro');
  await expect.poll(() => example.evaluate(() => document.querySelector('sl-qr-code').value)).toBe('Velcro');
  const r = await example.evaluate(async () => {
    const el = document.querySelector('sl-qr-code');
    await el.updateComplete;
    return [el.value, el.shadowRoot.querySelector('canvas').getAttribute('aria-label')];
  });
  expect(r).toEqual(['Velcro', LABEL]);
  await helpers(example);
  expect(await example.evaluate(() => window.againstShoelace(document.querySelector('sl-qr-code')))).toEqual([256, 256, 0]);
  await expect(example.locator('sl-qr-code')).toMatchAriaSnapshot(`- img "${LABEL}"`);
});

// ---- the package entry ----

test('package entry: Shoelace\'s structure, accessibility attributes, defaults, no reflected attribute and no marker attribute', async ({ page }) => {
  const pageErrors = await mount(page, `value="${VALUE}"`);
  const r = await page.evaluate(() => {
    const el = document.querySelector('#a');
    const root = el.shadowRoot;
    const canvas = root.querySelector('canvas');
    return {
      children: [...root.children].map(n => n.localName),
      canvas: ['part', 'class', 'role', 'aria-label', 'tabindex'].map(a => canvas.getAttribute(a)),
      style: [canvas.style.width, canvas.style.height],
      bitmap: [canvas.width, canvas.height],
      properties: [el.value, el.label, el.size, el.fill, el.background, el.radius, el.errorCorrection, el.canvas === canvas],
      attributes: el.getAttributeNames().sort(),
      observed: customElements.get('sl-qr-code').observedAttributes.slice().sort(),
    };
  });
  expect(r).toEqual({
    children: ['canvas'],
    canvas: ['base', 'qr-code', 'img', 'https://shoelace.style/', null],
    style: ['128px', '128px'],
    bitmap: [256, 256],
    properties: ['https://shoelace.style/', '', 128, 'black', 'white', 0, 'H', true],
    attributes: ['id', 'value'],
    observed: ['background', 'dir', 'error-correction', 'fill', 'label', 'lang', 'radius', 'size', 'value'],
  });
  expect(pageErrors).toEqual([]);
});

test('attributes and properties draw what Shoelace draws, and none of them is reflected', async ({ page }) => {
  await mount(page, 'value="Hello" label="Greeting" size="100" fill="rgb(0, 0, 255)" background="rgb(255, 255, 0)" radius="0.25" error-correction="Q"');
  const r = await page.evaluate(async () => {
    const el = document.querySelector('#a');
    const canvas = el.shadowRoot.querySelector('canvas');
    const out = { attrs: [el.value, el.label, el.size, el.fill, el.background, el.radius, el.errorCorrection], first: window.againstShoelace(el), label: canvas.getAttribute('aria-label') };
    Object.assign(el, { value: 'World', size: 60, fill: 'green', background: 'transparent', radius: 0.5, errorCorrection: 'L', label: '' });
    await el.updateComplete;
    out.second = window.againstShoelace(el);
    out.after = [canvas.getAttribute('aria-label'), canvas.style.width, el.getAttributeNames().sort()];
    // A transparent background leaves the light modules transparent.
    out.corner = [...canvas.getContext('2d').getImageData(canvas.width - 1, Math.round(canvas.width / 2), 1, 1).data].slice(3);
    return out;
  });
  expect(r.attrs).toEqual(['Hello', 'Greeting', 100, 'rgb(0, 0, 255)', 'rgb(255, 255, 0)', 0.25, 'Q']);
  expect(r.label).toBe('Greeting');
  expect(r.first).toEqual([200, 200, 0]);
  expect(r.second).toEqual([120, 120, 0]);
  expect(r.after).toEqual(['World', '60px', ['background', 'error-correction', 'fill', 'id', 'label', 'radius', 'size', 'value']]);
});

test('the label is the accessible name, the value when there is no label; the code is one image in the accessibility tree', async ({ page }) => {
  await mount(page, `value="${VALUE}"`);
  await expect(page.locator('#a')).toMatchAriaSnapshot(`- img "${VALUE}"`);
  await page.evaluate(async () => { const el = document.querySelector('#a'); el.label = 'Visit the site'; await el.updateComplete; });
  await expect(page.locator('#a')).toMatchAriaSnapshot('- img "Visit the site"');
});

test('styles are Shoelace\'s: an inline-block host with border-box sizing, and a canvas of size by size CSS pixels', async ({ page }) => {
  await mount(page, `value="${VALUE}" size="80"`);
  const r = await page.evaluate(() => {
    const el = document.querySelector('#a');
    const canvas = el.shadowRoot.querySelector('canvas');
    const host = getComputedStyle(el);
    const box = canvas.getBoundingClientRect();
    return [host.display, host.boxSizing, getComputedStyle(canvas).boxSizing, getComputedStyle(canvas).display, Math.round(box.width), Math.round(box.height), Math.round(el.getBoundingClientRect().width)];
  });
  expect(r).toEqual(['inline-block', 'border-box', 'border-box', 'inline', 80, 80, 80]);
});

test('upstream quirk: each changed drawing property draws the code once more, in the same update; label and unchanged values do not draw', async ({ page }) => {
  await mount(page);
  const r = await page.evaluate(async () => {
    const el = document.querySelector('#a');
    const calls = [];
    const generate = el.generate;
    el.generate = function () { calls.push(this.hasUpdated); return generate.call(this); };
    const count = async change => { calls.length = 0; change(); await el.updateComplete; return calls.length; };
    return {
      fillAndBackground: await count(() => { el.fill = 'red'; el.background = 'yellow'; }),
      all: await count(() => Object.assign(el, { value: 'x', size: 64, fill: 'blue', background: 'white', radius: 0.5, errorCorrection: 'L' })),
      label: await count(() => { el.label = 'Name'; }),
      same: await count(() => { el.value = 'x'; el.size = 64; }),
      matches: window.againstShoelace(el),
    };
  });
  expect(r).toEqual({ fillAndBackground: 2, all: 6, label: 0, same: 0, matches: [128, 128, 0] });
});

test('upstream quirk: the canvas is inline, so a standards-mode host is taller than size; in a quirks-mode page it is exactly size', async ({ page }) => {
  await mount(page, 'value="Hello" size="100"');
  const standards = await page.evaluate(() => [document.compatMode, Math.round(document.querySelector('#a').getBoundingClientRect().height), Math.round(document.querySelector('#a').shadowRoot.querySelector('canvas').getBoundingClientRect().height)]);
  expect(standards[0]).toBe('CSS1Compat');
  expect(standards[1]).toBeGreaterThan(100);
  expect(standards[2]).toBe(100);
  await mount(page, 'value="Hello" size="100"', { doctype: false });
  const quirks = await page.evaluate(() => [document.compatMode, Math.round(document.querySelector('#a').getBoundingClientRect().height), Math.round(document.querySelector('#a').getBoundingClientRect().width)]);
  expect(quirks).toEqual(['BackCompat', 100, 100]);
});

test('upstream quirk: a size that is not a number, or a removed size attribute, leaves a 0 by 0 bitmap and the previous displayed size', async ({ page }) => {
  await mount(page, 'value="Hello" size="100"');
  const r = await page.evaluate(async () => {
    const el = document.querySelector('#a');
    const canvas = el.shadowRoot.querySelector('canvas');
    el.removeAttribute('size');
    await el.updateComplete;
    const removed = [el.size, canvas.width, canvas.height, canvas.style.width, canvas.style.height];
    document.body.insertAdjacentHTML('beforeend', '<sl-qr-code id="b" value="Hello" size="big"></sl-qr-code>');
    const b = document.querySelector('#b');
    await b.updateComplete;
    const nan = b.shadowRoot.querySelector('canvas');
    return { removed, nan: [Number.isNaN(b.size), nan.width, nan.height, nan.style.width, Math.round(nan.getBoundingClientRect().width)] };
  });
  expect(r).toEqual({ removed: [null, 0, 0, '100px', '100px'], nan: [true, 0, 0, '', 0] });
});

test('upstream quirk: removing an attribute does not restore its default; a removed value leaves an empty aria-label', async ({ page }) => {
  const pageErrors = await mount(page, 'value="Hello" fill="red" error-correction="L"');
  const r = await page.evaluate(async () => {
    const el = document.querySelector('#a');
    el.removeAttribute('fill');
    el.removeAttribute('error-correction');
    el.removeAttribute('value');
    await el.updateComplete;
    return [el.value, el.fill, el.errorCorrection, el.shadowRoot.querySelector('canvas').getAttribute('aria-label')];
  });
  expect(r).toEqual([null, null, null, '']);
  expect(pageErrors).toEqual([]);
});

test('upstream quirk: the canvas ignores a fill it cannot parse, so the modules take the background color and the code is blank', async ({ page }) => {
  await mount(page, 'value="Hello" fill="var(--my-fill)" background="rgb(255, 255, 0)"');
  const r = await page.evaluate(() => {
    const canvas = document.querySelector('#a').shadowRoot.querySelector('canvas');
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const colors = new Set();
    for (let i = 0; i < data.length; i += 4) colors.add(data.slice(i, i + 4).join(','));
    return [...colors];
  });
  expect(r).toEqual(['255,255,0,255']);
});

test('upstream quirk: there is no quiet zone: the finder patterns are dark right at three corners of the canvas', async ({ page }) => {
  await mount(page, `value="${VALUE}" size="50"`);
  const r = await page.evaluate(() => {
    const canvas = document.querySelector('#a').shadowRoot.querySelector('canvas');
    const at = (x, y) => [...canvas.getContext('2d').getImageData(x, y, 1, 1).data];
    return [canvas.width, canvas.height, at(0, 0), at(canvas.width - 1, 0), at(0, canvas.height - 1)];
  });
  // Three corners are finder patterns (dark), right at the edge.
  expect(r).toEqual([100, 100, [0, 0, 0, 255], [0, 0, 0, 255], [0, 0, 0, 255]]);
});

test.describe('on a display with a pixel ratio of 3', () => {
  test.use({ deviceScaleFactor: 3 });
  test('upstream quirk: the bitmap is still twice size, and the canvas is displayed at size', async ({ page }) => {
    await mount(page, `value="${VALUE}" size="50"`);
    expect(await page.evaluate(() => {
      const canvas = document.querySelector('#a').shadowRoot.querySelector('canvas');
      return [window.devicePixelRatio, canvas.width, canvas.height, Math.round(canvas.getBoundingClientRect().width), window.againstShoelace(document.querySelector('#a'))[2]];
    })).toEqual([3, 100, 100, 50, 0]);
  });
});

test('upstream quirk: the hidden attribute does not hide the QR code', async ({ page }) => {
  await mount(page, 'value="Hidden" hidden');
  expect(await page.evaluate(() => { const el = document.querySelector('#a'); return [el.hidden, getComputedStyle(el).display, Math.round(el.getBoundingClientRect().width)]; })).toEqual([true, 'inline-block', 128]);
});

test('the QR code is not focusable and has no keyboard behavior', async ({ page }) => {
  await mount(page);
  await recordKeys(page);
  for (const key of ['Tab', 'Enter', 'Space']) {
    await pressReceived(page, page, key);
    expect(await page.evaluate(() => document.activeElement === document.body), `after ${key}`).toBe(true);
  }
  expect(await page.evaluate(() => document.querySelector('#a').shadowRoot.querySelectorAll('[tabindex]').length)).toBe(0);
});

test('ready (inherited from core) does not bubble and fires once, after the code is drawn; Shoelace\'s QR code emits nothing else', async ({ page }) => {
  await mount(page);
  const r = await page.evaluate(async () => {
    const el = document.querySelector('#a');
    el.value = 'Changed';
    await el.updateComplete;
    return window.events;
  });
  expect(r).toEqual([['ready', false, false, 256]]);
});

test('dir and lang are reactive, not reflected and undefined by default, as Shoelace\'s base element declares them', async ({ page }) => {
  await loadBundle(page, ENTRY);
  const r = await page.evaluate(async () => {
    const el = document.createElement('sl-qr-code');
    const defaults = [el.dir, el.lang];
    document.body.append(el);
    await el.updateComplete;
    el.dir = 'rtl';
    el.lang = 'ar';
    await el.updateComplete;
    return { defaults, afterSet: [el.dir, el.lang, el.hasAttribute('dir'), el.hasAttribute('lang')] };
  });
  expect(r).toEqual({ defaults: [undefined, undefined], afterSet: ['rtl', 'ar', false, false] });
});

test('class entry: SlQrCode is VelcroQrCode, nothing is registered on import, and another tag can define it', async ({ page }) => {
  const pageErrors = await loadBundle(page, CLASS_ENTRY);
  const r = await page.evaluate(async () => {
    const { SlQrCode, VelcroQrCode } = window.qrClass;
    const before = Boolean(customElements.get('sl-qr-code'));
    customElements.define('my-qr-code', VelcroQrCode);
    document.body.innerHTML = '<my-qr-code value="Mine"></my-qr-code>';
    const el = document.querySelector('my-qr-code');
    await el.updateComplete;
    return { same: SlQrCode === VelcroQrCode, before, after: Boolean(customElements.get('sl-qr-code')), baseName: VelcroQrCode.baseName, bitmap: el.shadowRoot.querySelector('canvas').width };
  });
  expect(r).toEqual({ same: true, before: false, after: false, baseName: 'qr-code', bitmap: 256 });
  expect(pageErrors).toEqual([]);
});

test('registration: sl-qr-code is the exported class, with no core marker attribute and no ch-* definition', async ({ page }) => {
  await mount(page);
  expect(await page.evaluate(() => {
    const el = document.querySelector('#a');
    return { ctor: customElements.get('sl-qr-code') === el.constructor, core: Boolean(customElements.get('ch-qr-code')), attributes: el.getAttributeNames().sort() };
  })).toEqual({ ctor: true, core: false, attributes: ['id', 'value'] });
});

// Shoelace's React examples, ported in packages/docs/examples/qr-code/react/*.jsx, bundled with React 19 and the generated wrappers.
test('React examples render the same QR codes as the HTML examples, and the first one follows its input', async ({ page }) => {
  const code = await bundleExamples('qr-code', ORDER.map(([id]) => id));
  const pageErrors = await loadExamples(page, code);
  await helpers(page);
  const r = await page.evaluate(async () => {
    const out = {};
    for (const name of ['basic', 'colors', 'size', 'radius', 'error-correction']) {
      window.renderExample(name);
      await customElements.whenDefined('sl-qr-code');
      const codes = [...document.querySelectorAll(`#${name} sl-qr-code`)];
      await Promise.all(codes.map(c => c.updateComplete));
      out[name] = codes.map(el => [el.value, el.label, el.size, el.fill, el.background, el.radius, el.errorCorrection, window.againstShoelace(el)]);
    }
    return { out, errors: window.errors };
  });
  const shoelace = size => [size * 2, size * 2, 0];
  // The JSX passes size="64" and radius="0.5" as strings, and the wrapper sets them as properties, so they stay strings (as with
  // Shoelace's own wrappers); the drawing is the same.
  expect(r.out).toEqual({
    basic: [[VALUE, LABEL, 128, 'black', 'white', 0, 'H', shoelace(128)]],
    colors: [[VALUE, '', 128, 'deeppink', 'white', 0, 'H', shoelace(128)]],
    size: [[VALUE, '', '64', 'black', 'white', 0, 'H', shoelace(64)]],
    radius: [[VALUE, '', 128, 'black', 'white', '0.5', 'H', shoelace(128)]],
    'error-correction': ['L', 'M', 'Q', 'H'].map(level => [VALUE, '', 128, 'black', 'white', 0, level, shoelace(128)]),
  });
  const input = page.locator('#basic sl-input input');
  await input.fill('React');
  await expect.poll(() => page.evaluate(() => document.querySelector('#basic sl-qr-code').value)).toBe('React');
  expect(await page.evaluate(async () => { const el = document.querySelector('#basic sl-qr-code'); await el.updateComplete; return window.againstShoelace(el); })).toEqual([256, 256, 0]);
  expect(r.errors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test.describe('React wrapper', () => {
  const mountWrapper = reactWrapperPage(test);
  test('VelcroQrCode passes value, label, size, fill, background, radius and errorCorrection through', async ({ page }) => {
    const errors = await mountWrapper(page);
    const r = await page.evaluate(async () => {
      window.renderWrapper('VelcroQrCode', { value: 'Wrapped', label: 'Wrapped code', size: 90, fill: 'navy', background: 'white', radius: 0.5, errorCorrection: 'M' });
      await customElements.whenDefined('sl-qr-code');
      const el = document.querySelector('#wrapped');
      await el.updateComplete;
      const canvas = el.shadowRoot.querySelector('canvas');
      return [el.value, el.label, el.size, el.fill, el.background, el.radius, el.errorCorrection, canvas.width, canvas.getAttribute('aria-label')];
    });
    expect(r).toEqual(['Wrapped', 'Wrapped code', 90, 'navy', 'white', 0.5, 'M', 180, 'Wrapped code']);
    expect(errors).toEqual([]);
  });
});
