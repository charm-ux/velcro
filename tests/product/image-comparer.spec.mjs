import { readdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { bundleExamples, docsDir, loadBundle, loadExamples } from './support/bundle.mjs';
import { pressReceived, recordKeys } from './support/keys.mjs';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';
import { reactWrapperPage } from './support/react.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/image-comparer';
// Shoelace 2.20.1's image comparer page has two previews (the opening one, then Initial Position), both ported in
// Shoelace's order, each live and with a React version.
const ORDER = [['basic', 'Default'], ['initial-position', 'Initial Position']];
const title = section => `Image comparer example: ${section}`;

async function openExample(page) {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  const frame = page.frameLocator(`iframe.example[title="${title('Default')}"]`);
  await expect(frame.locator('sl-image-comparer')).toBeVisible();
  // Rendering only: a test that reads the requests waits for the network to go quiet itself (documentsLoaded).
  return { frame, requests };
}

// Whether the handle icon of every image comparer in a frame has drawn its SVG. The icon fetches and draws its SVG after its
// first update (sl-icon's setIcon), so a read of the icon polls this first.
const iconsDrawn = frame => frame.locator('sl-image-comparer').evaluateAll(els => els.map(el => Boolean(el.shadowRoot.querySelector('sl-icon')?.shadowRoot?.querySelector('svg'))));

// Waits for every image comparer, image and icon update in a frame, and returns per comparer: [position, after clip-path,
// divider left, [slot, natural width, natural height, alt] per image, handle icon has an SVG].
const frameState = frame => frame.locator('body').evaluate(async () => {
  await customElements.whenDefined('sl-image-comparer');
  const comparers = [...document.querySelectorAll('sl-image-comparer')];
  await Promise.all(comparers.map(el => el.updateComplete));
  await Promise.all([...document.querySelectorAll('img')].map(img => img.decode()));
  return Promise.all(comparers.map(async el => {
    const icon = el.shadowRoot.querySelector('sl-icon');
    await icon.updateComplete;
    return [
      el.position,
      el.shadowRoot.querySelector('[part="after"]').style.clipPath,
      el.shadowRoot.querySelector('[part="divider"]').style.left,
      [...el.querySelectorAll('img')].map(img => [img.slot, img.naturalWidth, img.naturalHeight, img.alt]),
      `${icon.getAttribute('library')}:${icon.getAttribute('name')}:${Boolean(icon.shadowRoot.querySelector('svg'))}`,
    ];
  }));
});

// The package entries, in a top-level document of the test's own.
const ENTRY = `
  import '@charm-ux/velcro/image-comparer';
  window.loaded = true;
`;
const CLASS_ENTRY = `
  import { SlImageComparer, VelcroImageComparer } from '@charm-ux/velcro/image-comparer/class';
  window.imageComparerClass = { SlImageComparer, VelcroImageComparer };
  window.loaded = true;
`;

// A 400 x 200 placeholder image of one color (inline, so the tests make no request).
const image = color => `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Crect width='400' height='200' fill='%23${color}'/%3E%3C/svg%3E`;
const IMAGES = `<img slot="before" src="${image('888888')}" alt="Before"><img slot="after" src="${image('2563eb')}" alt="After">`;

// Replaces the document with an image comparer (id c) and waits for it and its images; returns nothing. sl-change events
// are recorded by a listener on the document, attached before the image comparer is connected.
async function mount(page, attrs = '', content = IMAGES) {
  await page.evaluate(async ([attrs, content]) => {
    window.events = [];
    if (!window.listening) {
      window.listening = true;
      document.addEventListener('sl-change', e => window.events.push(e.target.position));
    }
    document.body.innerHTML = `<sl-image-comparer id="c" ${attrs}>${content}</sl-image-comparer>`;
    const el = document.querySelector('#c');
    await el.updateComplete;
    await Promise.all([...el.querySelectorAll('img')].map(img => img.decode()));
    await el.shadowRoot.querySelector('sl-icon')?.updateComplete;
  }, [attrs, content]);
}
const events = page => page.evaluate(() => window.events.splice(0));
const state = page => page.evaluate(() => {
  const el = document.querySelector('#c');
  return {
    position: el.position,
    valuenow: el.shadowRoot.querySelector('[part="handle"]').getAttribute('aria-valuenow'),
    clip: el.shadowRoot.querySelector('[part="after"]').style.clipPath,
    left: el.shadowRoot.querySelector('[part="divider"]').style.left,
  };
});
// The viewport point at `fraction` of the image comparer's width, vertically centered.
const point = (page, fraction) => page.evaluate(fraction => {
  const box = document.querySelector('#c').shadowRoot.querySelector('[part="base"]').getBoundingClientRect();
  return [box.left + box.width * fraction, box.top + box.height / 2];
}, fraction);
const handleCenter = page => page.evaluate(() => {
  const box = document.querySelector('#c').shadowRoot.querySelector('[part="handle"]').getBoundingClientRect();
  return [box.left + box.width / 2, box.top + box.height / 2];
});
const position = page => state(page).then(s => s.position);
const focusedPart = page => page.evaluate(() => document.querySelector('#c').shadowRoot.activeElement?.getAttribute('part') ?? null);
const focusHandle = page => page.evaluate(() => document.querySelector('#c').shadowRoot.querySelector('[part="handle"]').focus());

test('docs page is prerendered with Velcro branding, prototype status, every ported section in order, the quirks and the gaps', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Image Comparer - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Upstream quirks matched');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('without changing the shared core prefix');
  expect(html).toContain('was run locally in Chromium and WebKit only, and Firefox is covered only by the project&#39;s CI run');
  expect(html).toContain('Playwright&#39;s ARIA snapshot');
  expect(html).toContain('sl-change is emitted for every change of position after the first update');
  expect(html).toContain('A position set by attribute or property is not clamped or rounded');
  expect(html).toContain('declares it in a static scopedElement field that its base element never reads');
  expect(html).toContain('inline placeholder images');
  const positions = ORDER.map(([, section]) => html.indexOf(`title="${title(section)}"`));
  expect(positions.every(p => p > 0)).toBe(true);
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  // The API tables: Shoelace's attribute, event, slots, parts and custom properties; ready is labelled as inherited.
  for (const name of ['position', 'sl-change', 'before', 'after', 'handle', 'base', 'divider', '--divider-width', '--handle-size']) {
    expect(html).toContain(`data-name="${name}"`);
  }
  expect(html).toContain('Inherited from core');
  expect(html).toContain('<summary>React</summary>');
  expect(html).toContain('import { VelcroImageComparer as SlImageComparer } from &#39;@charm-ux/velcro/react/VelcroImageComparer.js&#39;;');
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(html).not.toMatch(/(src|href)="[^"]*(shoelace|unsplash)/i);
  expect(await (await request.get('/')).text()).toContain('/components/image-comparer');
});

test('examples: Shoelace\'s order, live in their own documents, with a React version each; no Shoelace runtime or third-party image is requested', async ({ page }) => {
  const { requests } = await openExample(page);
  await documentsLoaded(page);
  const titles = await page.locator('iframe.example').evaluateAll(frames => frames.map(f => f.title));
  expect(titles).toEqual(ORDER.map(([, section]) => title(section)));
  const out = {};
  for (const [id, section] of ORDER) {
    const frame = page.frameLocator(`iframe.example[title="${title(section)}"]`);
    await expect.poll(() => iconsDrawn(frame), `${section}: the handle icon is drawn`).toEqual([true]);
    out[id] = await frameState(frame);
  }
  expect(out.basic).toEqual([[50, 'inset(0px 50% 0px 0px)', '50%', [
    ['before', 600, 400, 'A grayscale placeholder landscape: a pale sun over two hills.'],
    ['after', 600, 400, 'The same placeholder landscape in color: a yellow sun over green hills.'],
  ], 'system:grip-vertical:true']]);
  expect(out['initial-position']).toEqual([[25, 'inset(0px 75% 0px 0px)', '25%', [
    ['before', 600, 400, 'A placeholder drawing of a boot on a gray curb.'],
    ['after', 600, 400, 'A placeholder drawing of the same boot on a yellow curb.'],
  ], 'system:grip-vertical:true']]);
  const files = dir => readdirSync(path.join(docsDir, 'examples/image-comparer', dir)).filter(f => /\.(html|jsx)$/.test(f)).sort();
  expect(files('')).toEqual(ORDER.map(([id]) => `${id}.html`).sort());
  expect(files('react')).toEqual(ORDER.map(([id]) => `${id}.jsx`).sort());
  expect(requests.filter(url => /shoelace|unsplash/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
});

test('the Default example\'s divider follows a drag inside its frame', async ({ page }) => {
  await openExample(page);
  const frame = page.frameLocator(`iframe.example[title="${title('Default')}"]`);
  await frameState(frame);
  const comparer = frame.locator('sl-image-comparer');
  await comparer.scrollIntoViewIfNeeded();
  const handle = await frame.locator('sl-image-comparer').evaluate(el => {
    const r = el.shadowRoot.querySelector('[part="handle"]').getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  });
  const frameBox = await page.locator(`iframe.example[title="${title('Default')}"]`).boundingBox();
  const box = await comparer.boundingBox();
  await page.mouse.move(frameBox.x + handle[0], frameBox.y + handle[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  const position = await comparer.evaluate(el => el.position);
  expect(position).toBeGreaterThan(18);
  expect(position).toBeLessThan(22);
});

test('package entry: Shoelace\'s structure, accessibility attributes, default handle icon and styles', async ({ page }) => {
  const pageErrors = await loadBundle(page, ENTRY);
  await mount(page);
  // The icon fetches and draws its SVG after its first update (sl-icon's setIcon), so the draw is awaited before the read.
  await expect.poll(() => page.evaluate(() => Boolean(document.querySelector('#c').shadowRoot.querySelector('sl-icon')?.shadowRoot?.querySelector('svg')))).toBe(true);
  const r = await page.evaluate(() => {
    const el = document.querySelector('#c');
    const root = el.shadowRoot;
    const part = name => root.querySelector(`[part="${name}"]`);
    const token = (prop, value) => {
      const probe = document.createElement('span');
      probe.style[prop] = value;
      document.body.append(probe);
      const computed = getComputedStyle(probe)[prop];
      probe.remove();
      return computed;
    };
    const style = (node, props) => props.map(p => getComputedStyle(node)[p]);
    const before = el.querySelector('[slot="before"]');
    // The line box of an inline image in a plain block of the page: the image's height plus the gap the font leaves below
    // the baseline, which depends on the platform's default font.
    const reference = document.createElement('div');
    reference.append(before.cloneNode());
    reference.firstChild.removeAttribute('slot');
    document.body.append(reference);
    const lineBox = reference.getBoundingClientRect().height;
    reference.remove();
    return {
      lineBox: [part('before').getBoundingClientRect().height, lineBox],
      shadow: [...root.children].map(c => [c.localName, c.getAttribute('part'), c.id, c.getAttribute('class')]),
      tree: [...part('base').children].map(c => [c.localName, c.getAttribute('part'), c.getAttribute('class'), [...c.children].map(d => [d.localName, d.getAttribute('part'), d.getAttribute('class')])]),
      slots: [...root.querySelectorAll('slot')].map(s => [s.name, s.parentElement.getAttribute('part') ?? s.parentElement.getAttribute('class')]),
      handle: ['role', 'aria-valuenow', 'aria-valuemin', 'aria-valuemax', 'aria-controls', 'tabindex'].map(a => part('handle').getAttribute(a)),
      icon: root.querySelector('slot[name="handle"] > sl-icon')?.outerHTML,
      iconSvg: Boolean(root.querySelector('sl-icon').shadowRoot.querySelector('svg')),
      properties: [el.position, el.base === part('base'), el.handle === part('handle')],
      reflected: [...el.attributes].map(a => [a.name, a.value]).sort(),
      dynamic: [part('after').style.clipPath, part('divider').style.left],
      host: style(el, ['display', 'position']),
      base: style(part('base'), ['maxWidth', 'maxHeight', 'overflow']),
      before: style(part('before'), ['display', 'pointerEvents']),
      after: style(part('after'), ['display', 'pointerEvents', 'position', 'top', 'left', 'height', 'width']),
      image: style(before, ['display', 'maxWidth', 'height']),
      divider: [...style(part('divider'), ['display', 'alignItems', 'justifyContent', 'position', 'top', 'width', 'cursor', 'translate']), getComputedStyle(part('divider')).backgroundColor === token('color', 'var(--sl-color-neutral-0)'), part('divider').getBoundingClientRect().height],
      handleStyle: [...style(part('handle'), ['display', 'position', 'width', 'height', 'borderRadius', 'fontSize', 'cursor', 'zIndex', 'top']), getComputedStyle(part('handle')).backgroundColor === token('color', 'var(--sl-color-neutral-0)'), getComputedStyle(part('handle')).color === token('color', 'var(--sl-color-neutral-700)')],
      custom: ['--divider-width', '--handle-size'].map(p => getComputedStyle(el).getPropertyValue(p).trim()),
      size: [el.getBoundingClientRect().width, el.getBoundingClientRect().height],
      boxSizing: getComputedStyle(part('handle')).boxSizing,
    };
  });
  // Upstream quirk (below): the images stay inline, so each container is the line box of its image, taller than the 200px
  // image by the font's gap below the baseline (4px with the default font of a desktop system, other sizes elsewhere).
  // The heights below follow from it.
  const line = r.lineBox[1];
  expect(line).toBeGreaterThan(200);
  expect(r).toEqual({
    lineBox: [line, line],
    shadow: [['div', 'base', 'image-comparer', ' image-comparer ']],
    tree: [
      ['div', null, 'image-comparer__image', [['div', 'before', 'image-comparer__before'], ['div', 'after', 'image-comparer__after']]],
      ['div', 'divider', 'image-comparer__divider', [['div', 'handle', 'image-comparer__handle']]],
    ],
    slots: [['before', 'before'], ['after', 'after'], ['handle', 'handle']],
    handle: ['scrollbar', '50', '0', '100', 'image-comparer', '0'],
    // The icon hides itself from assistive technology (it has no label).
    icon: '<sl-icon library="system" name="grip-vertical" aria-hidden="true"></sl-icon>',
    iconSvg: true,
    properties: [50, true, true],
    reflected: [['id', 'c'], ['position', '50']],
    dynamic: ['inset(0px 50% 0px 0px)', '50%'],
    host: ['inline-block', 'relative'],
    base: ['100%', '100%', 'hidden'],
    // The slotted elements are not the containers' own styles; the containers are blocks that ignore the pointer.
    before: ['block', 'none'],
    after: ['block', 'none', 'absolute', '0px', '0px', `${line}px`, '400px'],
    // Upstream quirk: Shoelace's rules for slotted images never match (::slotted() follows the container's class, not a
    // slot), so the images keep the browser's inline display and no max-width; the line box adds a gap below them.
    image: ['inline', 'none', '200px'],
    // The 2px divider is translated left by half its width and spans the full height.
    divider: ['flex', 'center', 'center', 'absolute', '0px', '2px', 'ew-resize', '-1px', true, line],
    // --handle-size 2.5rem (40px) centered vertically: top = 50% - 20px of the height. The light theme's
    // --sl-border-radius-circle is 50%.
    handleStyle: ['flex', 'absolute', '40px', '40px', '50%', '20px', 'ew-resize', '10', `${line / 2 - 20}px`, true, true],
    custom: ['2px', '2.5rem'],
    size: [400, line],
    boxSizing: 'border-box',
  });
  expect(pageErrors).toEqual([]);
});

test('upstream quirk: an image wider than the space available is not scaled down (the slotted image rules never match)', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await page.evaluate(() => { document.body.style.width = '300px'; });
  await mount(page);
  const widths = () => page.evaluate(() => {
    const el = document.querySelector('#c');
    return [el.getBoundingClientRect().width, el.shadowRoot.querySelector('[part="base"]').getBoundingClientRect().width, ...[...el.querySelectorAll('img')].map(img => img.getBoundingClientRect().width)];
  });
  // The image comparer grows to the 400px images and overflows the 300px body.
  expect(await widths()).toEqual([400, 400, 400, 400]);
  // Given a width, it crops the images on the right (the base hides the overflow).
  await page.evaluate(() => { document.querySelector('#c').style.width = '300px'; });
  expect(await widths()).toEqual([300, 300, 400, 400]);
});

test('the handle shows the focus ring only for keyboard focus; the custom properties resize the divider and the handle', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'style="--divider-width: 6px; --handle-size: 3rem"');
  const r = await page.evaluate(() => {
    const el = document.querySelector('#c');
    const divider = el.shadowRoot.querySelector('[part="divider"]');
    const handle = el.shadowRoot.querySelector('[part="handle"]');
    return [getComputedStyle(divider).width, getComputedStyle(divider).translate, getComputedStyle(handle).width, getComputedStyle(handle).fontSize];
  });
  expect(r).toEqual(['6px', '-3px', '48px', '24px']);
  await mount(page);
  await page.keyboard.press('Tab');
  await expect.poll(() => focusedPart(page)).toBe('handle');
  const ring = await page.evaluate(() => {
    const handle = document.querySelector('#c').shadowRoot.querySelector('[part="handle"]');
    const s = getComputedStyle(handle);
    return [document.querySelector('#c').shadowRoot.activeElement === handle, s.outlineStyle, s.outlineWidth, s.outlineOffset];
  });
  // The light theme's --sl-focus-ring (solid 3px) and --sl-focus-ring-offset (1px).
  expect(ring).toEqual([true, 'solid', '3px', '1px']);
});

test('keyboard: the arrows move by 1 (by 10 with Shift), Home and End go to 0 and 100, clamped; each change emits sl-change', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page);
  await focusHandle(page);
  expect(await events(page)).toEqual([]);
  // Each step waits for the position its key produces before the next key: a key that changes the position is followed by a
  // poll for the new position; a key that changes nothing (clamped at an end, or not handled) waits until the whole press
  // was received and then reads the position.
  await recordKeys(page);
  const values = [];
  for (const [key, expected, changes] of [
    ['ArrowRight', 51, true], ['Shift+ArrowRight', 61, true], ['ArrowLeft', 60, true], ['Shift+ArrowLeft', 50, true], ['End', 100, true],
    ['ArrowRight', 100, false], ['Shift+ArrowRight', 100, false], ['Home', 0, true], ['ArrowLeft', 0, false], ['Shift+ArrowLeft', 0, false],
    ['ArrowUp', 0, false], ['ArrowDown', 0, false], ['PageUp', 0, false], ['Enter', 0, false],
  ]) {
    if (changes) {
      await page.keyboard.press(key);
      await expect.poll(() => position(page), key).toBe(expected);
    } else {
      await pressReceived(page, page, key);
      expect(await position(page), key).toBe(expected);
    }
    values.push(await position(page));
  }
  expect(values).toEqual([51, 61, 60, 50, 100, 100, 100, 0, 0, 0, 0, 0, 0, 0]);
  expect(await events(page)).toEqual([51, 61, 60, 50, 100, 0]);
  await page.keyboard.press('Shift+ArrowRight');
  await expect.poll(() => state(page)).toEqual({ position: 10, valuenow: '10', clip: 'inset(0px 90% 0px 0px)', left: '10%' });
  // The handled keys are prevented (the page does not scroll); others are not.
  const prevented = await page.evaluate(() => {
    const handle = document.querySelector('#c').shadowRoot.querySelector('[part="handle"]');
    return ['ArrowLeft', 'Home', 'ArrowDown', 'a'].map(key => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, composed: true });
      handle.dispatchEvent(event);
      return event.defaultPrevented;
    });
  });
  expect(prevented).toEqual([true, true, false, false]);
});

test('upstream quirk: sl-change follows every change of position after the first update, from script and attributes too, once per update', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'position="30"');
  // Not on the first render.
  expect(await events(page)).toEqual([]);
  const r = await page.evaluate(async () => {
    const el = document.querySelector('#c');
    const seen = [];
    el.addEventListener('sl-change', e => seen.push([el.position, e.bubbles, e.composed, e.cancelable, JSON.stringify(e.detail)]));
    el.position = 40;
    await el.updateComplete;
    el.setAttribute('position', '45');
    await el.updateComplete;
    // Two changes before one update: one event, with the last value.
    el.position = 60;
    el.position = 70;
    await el.updateComplete;
    // A change back to the old value before the update: no event.
    el.position = 10;
    el.position = 70;
    await el.updateComplete;
    // The same value: no event.
    el.position = 70;
    await el.updateComplete;
    return seen;
  });
  expect(r).toEqual([[40, true, true, false, '{}'], [45, true, true, false, '{}'], [70, true, true, false, '{}']]);
  const ready = await page.evaluate(async () => {
    const el = document.createElement('sl-image-comparer');
    const seen = [];
    for (const type of ['sl-change', 'ready']) el.addEventListener(type, e => seen.push([type, e.bubbles, e.composed]));
    el.position = 20;
    document.body.append(el);
    await el.updateComplete;
    return seen;
  });
  expect(ready).toEqual([['ready', false, false]]);
});

test('upstream quirk: a position set by attribute or property is not clamped or rounded', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'position="150"');
  expect(await state(page)).toEqual({ position: 150, valuenow: '150', clip: 'inset(0px -50% 0px 0px)', left: '150%' });
  await page.evaluate(() => {
    document.querySelector('#c').position = -20.456;
    return document.querySelector('#c').updateComplete;
  });
  expect(await state(page)).toEqual({ position: -20.456, valuenow: '-20.456', clip: 'inset(0px 120.456% 0px 0px)', left: '-20.456%' });
  // The keyboard clamps the next step.
  await focusHandle(page);
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => position(page)).toBe(0);
});

test('mouse drag: the divider follows the pointer from the first move (rounded to two decimals, clamped); the press alone does not move it', async ({ page }) => {
  await loadBundle(page, ENTRY);
  // 300px wide (the images are cropped), so that a whole-pixel pointer position gives a percentage that needs rounding.
  await mount(page, 'style="width: 300px"');
  // Room on the left, so the pointer can leave the image comparer without leaving the viewport (Firefox delivers no
  // pointer events at negative viewport coordinates).
  await page.evaluate(() => { document.body.style.paddingLeft = '100px'; });
  // Pressing on the divider away from its center (it is 2px wide, so near the center) does not move it.
  const [x0, y0] = await point(page, 0.5);
  await page.mouse.move(x0, y0 - 80);
  await page.mouse.down();
  expect((await state(page)).position).toBe(50);
  const [x1, y1] = await point(page, 0.25);
  await page.mouse.move(x1, y1);
  expect(await state(page)).toEqual({ position: 25, valuenow: '25', clip: 'inset(0px 75% 0px 0px)', left: '25%' });
  const box = await page.evaluate(() => document.querySelector('#c').getBoundingClientRect().toJSON());
  await page.mouse.move(box.left + 100, y1);
  expect((await state(page)).position).toBe(33.33);
  await page.mouse.move(box.left - 50, y1);
  expect((await state(page)).position).toBe(0);
  await page.mouse.move(box.right + 50, y1);
  expect((await state(page)).position).toBe(100);
  await page.mouse.up();
  // After the release, moving does nothing.
  await page.mouse.move(...await point(page, 0.4));
  expect((await state(page)).position).toBe(100);
  await expect.poll(() => events(page)).toEqual([25, 33.33, 0, 100]);
  // Pressing outside the divider starts nothing.
  await page.mouse.move(...await point(page, 0.3));
  await page.mouse.down();
  await page.mouse.move(...await point(page, 0.6));
  await page.mouse.up();
  expect((await state(page)).position).toBe(100);
});

test('upstream quirks: pressing the handle prevents its focus, any mouse button drags, and the width is measured when the drag starts', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page);
  await page.mouse.move(...await handleCenter(page));
  await page.mouse.down();
  await page.mouse.move(...await point(page, 0.6));
  await page.mouse.up();
  const focus = await page.evaluate(() => [document.activeElement?.localName ?? null, document.querySelector('#c').shadowRoot.activeElement]);
  expect(focus).toEqual(['body', null]);
  expect((await state(page)).position).toBe(60);
  // The middle button drags too.
  await page.mouse.move(...await handleCenter(page));
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(...await point(page, 0.3));
  await page.mouse.up({ button: 'middle' });
  expect((await state(page)).position).toBe(30);
  // The width read at the start of the drag (400px) is kept when the image comparer is resized during the drag.
  await page.mouse.move(...await handleCenter(page));
  await page.mouse.down();
  await page.evaluate(() => { document.querySelector('#c').style.width = '200px'; });
  const left = await page.evaluate(() => document.querySelector('#c').getBoundingClientRect().left);
  const [, y] = await point(page, 0.5);
  await page.mouse.move(left + 100, y);
  await page.mouse.up();
  expect((await state(page)).position).toBe(25);
});

test('touch: a touchstart on the divider is prevented and starts a drag that follows pointer moves until pointerup (synthetic events)', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page);
  // Synthetic events (no touch device): the touch handler reads nothing from the event besides calling preventDefault();
  // the drag then follows pointermove events on the document until a pointerup.
  const r = await page.evaluate(async () => {
    const el = document.querySelector('#c');
    const box = el.shadowRoot.querySelector('[part="base"]').getBoundingClientRect();
    const start = new Event('touchstart', { bubbles: true, cancelable: true, composed: true });
    el.shadowRoot.querySelector('[part="handle"]').dispatchEvent(start);
    await el.updateComplete;
    const afterStart = el.position;
    const pointer = (type, fraction) => document.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: box.left + box.width * fraction, clientY: box.top + 10 }));
    pointer('pointermove', 0.7);
    await el.updateComplete;
    const afterMove = el.position;
    pointer('pointerup', 0.7);
    pointer('pointermove', 0.2);
    await el.updateComplete;
    return [start.defaultPrevented, afterStart, afterMove, el.position];
  });
  expect(r).toEqual([true, 50, 70, 70]);
});

test('upstream quirk: the keys are handled on the base, so they also act while focus is on content slotted into the before slot', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, '', `<button slot="before" style="display: block; width: 400px; height: 200px">Before</button>${IMAGES.split('>').slice(1).join('>')}`);
  await page.evaluate(() => document.querySelector('#c button').focus());
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => position(page)).toBe(51);
  await page.keyboard.press('End');
  await expect.poll(() => position(page)).toBe(100);
  expect(await page.evaluate(() => document.activeElement.localName)).toBe('button');
  expect(await events(page)).toEqual([51, 100]);
});

test('right-to-left: the clipping and divider mirror, the arrows swap and the drag reads from the right; the document\'s direction applies when the element has none', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'dir="rtl" position="25"');
  expect(await state(page)).toEqual({ position: 25, valuenow: '25', clip: 'inset(0px 0px 0px 75%)', left: '75%' });
  expect(await page.evaluate(() => document.querySelector('#c').shadowRoot.querySelector('[part="base"]').className)).toContain('image-comparer--rtl');
  await focusHandle(page);
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => position(page)).toBe(26);
  await page.keyboard.press('Shift+ArrowRight');
  await expect.poll(() => position(page)).toBe(16);
  await page.keyboard.press('End');
  await expect.poll(() => state(page)).toEqual({ position: 100, valuenow: '100', clip: 'inset(0px 0px 0px 0%)', left: '0%' });
  // A drag 10% from the left edge is 90% from the right.
  await page.mouse.move(...await handleCenter(page));
  await page.mouse.down();
  await page.mouse.move(...await point(page, 0.1));
  await page.mouse.up();
  expect(await state(page)).toEqual({ position: 90, valuenow: '90', clip: 'inset(0px 0px 0px 10%)', left: '10%' });
  // The document's direction, when the image comparer has none of its own; re-rendered when it changes.
  await mount(page, 'position="25"');
  await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
  await expect.poll(() => state(page)).toEqual({ position: 25, valuenow: '25', clip: 'inset(0px 0px 0px 75%)', left: '75%' });
  await focusHandle(page);
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => position(page)).toBe(26);
  await page.evaluate(() => { document.documentElement.dir = 'ltr'; });
  await expect.poll(() => state(page)).toEqual({ position: 26, valuenow: '26', clip: 'inset(0px 74% 0px 0px)', left: '26%' });
});

test('upstream quirk: with dir="auto" the left and right arrows do nothing and the layout is left to right; Home and End still work', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'dir="auto" position="25"');
  expect(await state(page)).toEqual({ position: 25, valuenow: '25', clip: 'inset(0px 75% 0px 0px)', left: '25%' });
  await focusHandle(page);
  await recordKeys(page);
  for (const key of ['ArrowLeft', 'ArrowRight', 'Shift+ArrowRight']) {
    await pressReceived(page, page, key);
    expect(await position(page), key).toBe(25);
  }
  await page.keyboard.press('End');
  await expect.poll(() => position(page)).toBe(100);
  await page.keyboard.press('Home');
  await expect.poll(() => position(page)).toBe(0);
});

test('position reflects; set to null or undefined (or its attribute removed) it gets its initial value back (Shoelace\'s base element restore)', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'position="25"');
  const r = await page.evaluate(async () => {
    const el = document.querySelector('#c');
    el.position = 75;
    await el.updateComplete;
    const reflected = el.getAttribute('position');
    el.removeAttribute('position');
    await el.updateComplete;
    const removed = [el.position, el.getAttribute('position')];
    el.position = 30;
    await el.updateComplete;
    el.position = null;
    await el.updateComplete;
    const nulled = [el.position, el.getAttribute('position')];
    el.position = undefined;
    await el.updateComplete;
    return { reflected, removed, nulled, undefined: [el.position, el.getAttribute('position')] };
  });
  // The initial value is recorded on the first attribute change, during upgrade, before the attribute is applied: 50.
  expect(r).toEqual({ reflected: '75', removed: [50, '50'], nulled: [50, '50'], undefined: [50, '50'] });
});

test('accessibility tree (Playwright ARIA snapshot): the two images and a scrollbar without a name (upstream quirk), its value in aria-valuenow; the handle is in the tab order', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, 'position="25"');
  await expect(page.locator('#c')).toMatchAriaSnapshot(`
    - img "Before"
    - img "After"
    - scrollbar
  `);
  expect(await page.evaluate(() => document.querySelector('#c').shadowRoot.querySelector('[part="handle"]').getAttribute('aria-valuenow'))).toBe('25');
  await page.keyboard.press('Tab');
  await expect.poll(() => focusedPart(page)).toBe('handle');
  expect(await page.evaluate(() => document.querySelector('#c').shadowRoot.querySelector('[part="handle"]').hasAttribute('aria-label'))).toBe(false);
});

test('a handle slot replaces the default icon', async ({ page }) => {
  await loadBundle(page, ENTRY);
  await mount(page, '', `${IMAGES}<span slot="handle" id="custom">||</span>`);
  const r = await page.evaluate(() => {
    const el = document.querySelector('#c');
    const slot = el.shadowRoot.querySelector('slot[name="handle"]');
    return [slot.assignedElements().map(e => e.id), el.querySelector('#custom').getBoundingClientRect().width > 0];
  });
  expect(r).toEqual([['custom'], true]);
});

test('dir and lang are reactive, not reflected and undefined by default, as Shoelace\'s base element declares them', async ({ page }) => {
  await loadBundle(page, ENTRY);
  const r = await page.evaluate(async () => {
    const el = document.createElement('sl-image-comparer');
    const defaults = [el.dir, el.lang];
    document.body.append(el);
    await el.updateComplete;
    el.dir = 'RTL';
    el.lang = 'ar';
    await el.updateComplete;
    return { defaults, afterSet: [el.dir, el.lang, el.hasAttribute('dir'), el.hasAttribute('lang')], rtl: el.shadowRoot.querySelector('[part="base"]').classList.contains('image-comparer--rtl') };
  });
  // Shoelace lower-cases the direction it reads, so "RTL" is right-to-left.
  expect(r).toEqual({ defaults: [undefined, undefined], afterSet: ['RTL', 'ar', false, false], rtl: true });
});

test('class entry: SlImageComparer is VelcroImageComparer, nothing is registered on import, and constructing one defines sl-icon', async ({ page }) => {
  const pageErrors = await loadBundle(page, CLASS_ENTRY);
  const r = await page.evaluate(async () => {
    const { SlImageComparer, VelcroImageComparer } = window.imageComparerClass;
    const before = [customElements.get('sl-image-comparer'), customElements.get('sl-icon')].map(Boolean);
    customElements.define('my-image-comparer', VelcroImageComparer);
    document.body.innerHTML = '<my-image-comparer></my-image-comparer>';
    const el = document.querySelector('my-image-comparer');
    await el.updateComplete;
    const icon = el.shadowRoot.querySelector('sl-icon');
    await icon.updateComplete;
    return {
      same: SlImageComparer === VelcroImageComparer,
      before,
      icon: Boolean(customElements.get('sl-icon')),
      upgraded: icon instanceof customElements.get('sl-icon'),
      comparer: Boolean(customElements.get('sl-image-comparer')),
    };
  });
  expect(r).toEqual({ same: true, before: [false, false], icon: true, upgraded: true, comparer: false });
  expect(pageErrors).toEqual([]);
});

// Shoelace's React examples, ported in packages/docs/examples/image-comparer/react/*.jsx, bundled with React 19 and the
// generated wrapper.
test('React examples render the same image comparers as the HTML examples', async ({ page }) => {
  const code = await bundleExamples('image-comparer', ORDER.map(([id]) => id));
  const pageErrors = await loadExamples(page, code);
  const r = await page.evaluate(async () => {
    const out = {};
    for (const name of ['basic', 'initial-position']) {
      window.renderExample(name);
      await customElements.whenDefined('sl-image-comparer');
      const el = document.querySelector(`#${name} sl-image-comparer`);
      await el.updateComplete;
      await Promise.all([...el.querySelectorAll('img')].map(img => img.decode()));
      out[name] = [el.position, el.getAttribute('position'), [...el.querySelectorAll('img')].map(img => [img.slot, img.naturalWidth, img.alt])];
    }
    return { out, errors: window.errors.splice(0) };
  });
  expect(r.out).toEqual({
    basic: [50, '50', [
      ['before', 600, 'A grayscale placeholder landscape: a pale sun over two hills.'],
      ['after', 600, 'The same placeholder landscape in color: a yellow sun over green hills.'],
    ]],
    'initial-position': [25, '25', [
      ['before', 600, 'A placeholder drawing of a boot on a gray curb.'],
      ['after', 600, 'A placeholder drawing of the same boot on a yellow curb.'],
    ]],
  });
  expect(r.errors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test.describe('React wrapper', () => {
  const mountWrapper = reactWrapperPage(test);
  test('VelcroImageComparer passes Shoelace\'s position through and calls onSlChange', async ({ page }) => {
    const errors = await mountWrapper(page);
    const r = await page.evaluate(async () => {
      window.seen = [];
      window.renderWrapper('VelcroImageComparer', { position: 30, onSlChange: e => window.seen.push(e.target.position) });
      await customElements.whenDefined('sl-image-comparer');
      const el = document.querySelector('#wrapped');
      await el.updateComplete;
      el.shadowRoot.querySelector('[part="handle"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
      await el.updateComplete;
      return [el.position, window.seen];
    });
    expect(r).toEqual([31, [31]]);
    expect(errors).toEqual([]);
  });
});
