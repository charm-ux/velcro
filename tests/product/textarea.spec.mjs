import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { documentsLoaded, openDocs, watchNetwork } from './support/loaded.mjs';

test.beforeEach(({ page }) => watchNetwork(page));

const PAGE = '/components/textarea';

// The docs page's examples, in page order: the example's title, and the name of its files under examples/textarea/.
const EXAMPLES = [
  ['Overview', 'basic'],
  ['Labels', 'labels'],
  ['Help Text', 'help-text'],
  ['Rows', 'rows'],
  ['Placeholders', 'placeholders'],
  ['Filled Textareas', 'filled'],
  ['Disabled', 'disabled'],
  ['Sizes', 'sizes'],
  ['Prevent Resizing', 'prevent-resizing'],
  ['Expand with Content', 'expand-with-content'],
];

const frameFor = (page, title) => page.frameLocator(`iframe.example[title="Textarea example: ${title}"]`);

async function openExample(page, name = 'Overview') {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await openDocs(page, PAGE);
  const frame = frameFor(page, name);
  await expect(frame.locator('sl-textarea').first()).toBeVisible();
  await frame.locator('body').evaluate(() => customElements.whenDefined('sl-textarea'));
  await documentsLoaded(page);
  return { frame, requests };
}

// Appends markup to the example document and waits for every sl-textarea in it to render.
async function mount(frame, markup) {
  await frame.locator('body').evaluate(async (body, markup) => {
    const host = document.createElement('div');
    host.id = 'mount';
    host.innerHTML = markup;
    body.append(host);
    await Promise.all([...host.querySelectorAll('sl-textarea')].map(el => el.updateComplete));
  }, markup);
}

// The computed color of a theme token, read through a probe element in the example document.
const token = (frame, name) => frame.locator('body').evaluate((body, name) => {
  const probe = document.createElement('div');
  probe.style.color = `var(${name})`;
  body.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}, name);

// Starts keyboard navigation inside the example document from a button before the first element.
const addStartButton = frame => frame.locator('body').evaluate(body => {
  const start = document.createElement('button');
  start.id = 'start';
  start.textContent = 'start';
  body.prepend(start);
});

test('docs page is prerendered with Velcro branding, prototype status and explicit limits', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Textarea - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Not implemented or unverified');
  expect(html).toContain('Upstream quirks matched');
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
});

test('sl-textarea registers as the exported class with no core marker attribute, no ch-* definitions and no sl-icon in its template', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
  const r = await frame.locator('#demo-default').evaluate(el => ({
    ctor: customElements.get('sl-textarea') === el.constructor,
    // Core's base element would add its base-name marker attribute from a core scope; Velcro hosts carry none.
    attributes: el.getAttributeNames().sort(),
    chDefined: ['ch-text-area', 'ch-textarea', 'ch-icon'].filter(tag => customElements.get(tag)),
    slIcon: Boolean(el.shadowRoot.querySelector('sl-icon')),
    mode: el.shadowRoot.mode,
    delegatesFocus: el.shadowRoot.delegatesFocus,
    formAssociated: el.constructor.formAssociated === true,
  }));
  expect(r.ctor).toBe(true);
  // size and form reflect their initial values ('medium', ''), as in Shoelace; focusable is core's documented marker.
  expect(r.attributes).toEqual(['data-optional', 'data-valid', 'focusable', 'form', 'id', 'size']);
  expect(r.chDefined).toEqual([]);
  expect(r.slIcon).toBe(false);
  expect(r.mode).toBe('open');
  expect(r.delegatesFocus).toBe(false);
  // Not form-associated, as in Shoelace: the form value is added in the formdata event.
  expect(r.formAssociated).toBe(false);
});

test('structure: Shoelace\'s parts in order, a label bound to the inner textarea and the help text as its description', async ({ page }) => {
  const { frame } = await openExample(page, 'Help Text');
  const control = frame.getByRole('textbox', { name: 'Feedback' });
  await expect(control).toHaveCount(1);
  await expect(control).toHaveAccessibleDescription('Please tell us what you think.');
  const r = await frame.locator('#demo-help-text').evaluate(el => {
    const root = el.shadowRoot;
    const textarea = root.querySelector('textarea');
    return {
      parts: [...root.querySelectorAll('[part]')].map(n => `${n.localName}:${n.getAttribute('part')}`),
      labelFor: root.querySelector('label').getAttribute('for'),
      textareaId: textarea.id,
      describedBy: textarea.getAttribute('aria-describedby'),
      helpId: root.querySelector('[part="form-control-help-text"]').id,
      classes: root.querySelector('[part="form-control"]').className.trim().split(/\s+/),
      textareaClass: textarea.className,
      base: root.querySelector('[part="base"]').className.trim().split(/\s+/),
      inner: { rows: textarea.rows, spellcheck: textarea.getAttribute('spellcheck'), title: textarea.getAttribute('title') },
      adjusterHidden: root.querySelector('[part="textarea-adjuster"]').hidden,
      slots: [...root.querySelectorAll('slot')].map(s => s.name),
    };
  });
  expect(r).toEqual({
    parts: ['div:form-control', 'label:form-control-label', 'div:form-control-input', 'div:base', 'textarea:textarea', 'div:textarea-adjuster', 'div:form-control-help-text'],
    labelFor: 'input',
    textareaId: 'input',
    describedBy: 'help-text',
    helpId: 'help-text',
    classes: ['form-control', 'form-control--medium', 'form-control--has-label', 'form-control--has-help-text'],
    textareaClass: 'textarea__control',
    base: ['textarea', 'textarea--medium', 'textarea--standard', 'textarea--empty', 'textarea--resize-vertical'],
    inner: { rows: 4, spellcheck: 'true', title: '' },
    adjusterHidden: true,
    slots: ['label', 'help-text'],
  });
});

test('label and help text: the attributes render, the slots take precedence, and the label click focuses the textarea', async ({ page }) => {
  const { frame } = await openExample(page, 'Labels');
  await mount(frame, `
    <sl-textarea id="slots" label="Attribute label" help-text="Attribute help"><span slot="label">Slot label</span><span slot="help-text">Slot help</span></sl-textarea>
    <sl-textarea id="plain"></sl-textarea>`);
  await expect(frame.getByRole('textbox', { name: 'Comments' })).toHaveCount(1);
  await expect(frame.getByRole('textbox', { name: 'Slot label' })).toHaveAccessibleDescription('Slot help');
  const r = await frame.locator('body').evaluate(() => ['#demo-label', '#slots', '#plain'].map(id => {
    const root = document.querySelector(id).shadowRoot;
    const label = root.querySelector('label');
    const help = root.querySelector('[part="form-control-help-text"]');
    return {
      labelDisplay: getComputedStyle(label).display,
      labelHidden: label.getAttribute('aria-hidden'),
      helpDisplay: getComputedStyle(help).display,
      helpHidden: help.getAttribute('aria-hidden'),
      // The slot's fallback text stays in the DOM when a node is assigned, so the assigned node is read first.
      text: label.querySelector('slot').assignedNodes().length ? label.querySelector('slot').assignedNodes()[0].textContent : label.textContent.trim(),
    };
  }));
  expect(r).toEqual([
    { labelDisplay: 'inline-block', labelHidden: 'false', helpDisplay: 'none', helpHidden: 'true', text: 'Comments' },
    { labelDisplay: 'inline-block', labelHidden: 'false', helpDisplay: 'block', helpHidden: 'false', text: 'Slot label' },
    { labelDisplay: 'none', labelHidden: 'true', helpDisplay: 'none', helpHidden: 'true', text: '' },
  ]);
  const label = frame.locator('#demo-label');
  await label.evaluate(el => {
    window.__labelEvents = [];
    el.addEventListener('sl-focus', () => window.__labelEvents.push('sl-focus'));
  });
  await label.locator('label').click();
  expect(await label.evaluate(el => [document.activeElement === el, el.shadowRoot.activeElement?.localName, window.__labelEvents])).toEqual([true, 'textarea', ['sl-focus']]);
});

test('computed styles match Shoelace: sizes, border, radius, padding, colors and the focus ring', async ({ page }) => {
  const { frame } = await openExample(page, 'Sizes');
  const measure = id => frame.locator(id).evaluate(el => {
    const base = getComputedStyle(el.shadowRoot.querySelector('[part="base"]'));
    const control = getComputedStyle(el.shadowRoot.querySelector('textarea'));
    return {
      host: getComputedStyle(el).display,
      base: { display: base.display, font: base.fontSize, radius: base.borderTopLeftRadius, borderWidth: base.borderTopWidth, borderStyle: base.borderTopStyle, cursor: base.cursor },
      control: { padding: [control.paddingTop, control.paddingRight, control.paddingBottom, control.paddingLeft], lineHeight: control.lineHeight, border: control.borderTopStyle, resize: control.resize },
    };
  });
  const border = await token(frame, '--sl-input-border-color');
  const sizes = {};
  for (const size of ['small', 'medium', 'large']) sizes[size] = await measure(`#demo-${size}`);
  expect(sizes).toEqual({
    small: {
      host: 'block',
      base: { display: 'grid', font: '14px', radius: '4px', borderWidth: '1px', borderStyle: 'solid', cursor: 'text' },
      control: { padding: ['7px', '12px', '7px', '12px'], lineHeight: '19.6px', border: 'none', resize: 'vertical' },
    },
    medium: {
      host: 'block',
      base: { display: 'grid', font: '16px', radius: '4px', borderWidth: '1px', borderStyle: 'solid', cursor: 'text' },
      control: { padding: ['8px', '16px', '8px', '16px'], lineHeight: '22.4px', border: 'none', resize: 'vertical' },
    },
    large: {
      host: 'block',
      base: { display: 'grid', font: '20px', radius: '4px', borderWidth: '1px', borderStyle: 'solid', cursor: 'text' },
      control: { padding: ['10px', '20px', '10px', '20px'], lineHeight: '28px', border: 'none', resize: 'vertical' },
    },
  });
  const colors = await frame.locator('#demo-medium').evaluate(el => {
    const base = getComputedStyle(el.shadowRoot.querySelector('[part="base"]'));
    const control = getComputedStyle(el.shadowRoot.querySelector('textarea'));
    return { border: base.borderTopColor, background: base.backgroundColor, color: control.color };
  });
  expect(colors).toEqual({ border, background: await token(frame, '--sl-input-background-color'), color: await token(frame, '--sl-input-color') });
  // The class names follow the size.
  expect(await frame.locator('#demo-large').evaluate(el => [el.shadowRoot.querySelector('[part="form-control"]').classList.contains('form-control--large'), el.shadowRoot.querySelector('[part="base"]').classList.contains('textarea--large')])).toEqual([true, true]);

  // Focused: the border takes the focus color and a ring is drawn around the base (both transition, so poll).
  await frame.locator('#demo-medium textarea').focus();
  const focusBorder = await token(frame, '--sl-input-border-color-focus');
  const ring = await token(frame, '--sl-input-focus-ring-color');
  const readFocused = () => frame.locator('#demo-medium').evaluate(el => {
    const base = getComputedStyle(el.shadowRoot.querySelector('[part="base"]'));
    return { border: base.borderTopColor, shadow: base.boxShadow, focusedClass: el.shadowRoot.querySelector('[part="base"]').classList.contains('textarea--focused'), outline: getComputedStyle(el.shadowRoot.querySelector('textarea')).outlineStyle };
  });
  await expect.poll(async () => (await readFocused()).border).toBe(focusBorder);
  await expect.poll(async () => (await readFocused()).shadow).toContain(ring);
  const focused = await readFocused();
  expect(focused.shadow).toContain('3px');
  expect(focused.focusedClass).toBe(true);
  expect(focused.outline).toBe('none');
});

test('rows: the rows attribute sets the inner textarea\'s height, which follows the line height', async ({ page }) => {
  const { frame } = await openExample(page, 'Rows');
  await mount(frame, '<sl-textarea id="four"></sl-textarea>');
  const heights = await frame.locator('body').evaluate(() => ['#demo-rows', '#four'].map(id => {
    const el = document.querySelector(id);
    const textarea = el.shadowRoot.querySelector('textarea');
    return { rows: el.rows, inner: textarea.rows, height: textarea.getBoundingClientRect().height };
  }));
  expect(heights[0].rows).toBe(2);
  expect(heights[0].inner).toBe(2);
  expect(heights[1].rows).toBe(4);
  // Two more lines are 2 x 22.4px (the line height of the 16px text) taller; engines round the line box differently, so a
  // tolerance is allowed, and the padding cancels out of the difference.
  expect(Math.abs(heights[1].height - heights[0].height - 2 * 22.4)).toBeLessThan(4);
  expect(heights[0].height).toBeGreaterThan(2 * 22.4);
  // Changing rows re-renders the inner textarea and keeps the number type.
  const changed = await frame.locator('#four').evaluate(async el => {
    el.setAttribute('rows', '6');
    await el.updateComplete;
    return [el.rows, el.shadowRoot.querySelector('textarea').rows];
  });
  expect(changed).toEqual([6, 6]);
});

test('placeholder, filled and disabled render as in Shoelace', async ({ page, browserName }) => {
  const { frame } = await openExample(page, 'Placeholders');
  const placeholder = await frame.locator('#demo-placeholder').evaluate(el => {
    const textarea = el.shadowRoot.querySelector('textarea');
    return { placeholder: textarea.placeholder, color: getComputedStyle(textarea, '::placeholder').color, empty: el.shadowRoot.querySelector('[part="base"]').classList.contains('textarea--empty') };
  });
  expect(placeholder.placeholder).toBe('Type something');
  expect(placeholder.empty).toBe(true);
  // Computed style of the ::placeholder pseudo-element: Chromium and WebKit only, as Firefox (which only CI runs) is not
  // relied on for getComputedStyle of this pseudo-element.
  if (browserName !== 'firefox') expect(placeholder.color).toBe(await token(frame, '--sl-input-placeholder-color'));

  const filled = await openExample(page, 'Filled Textareas');
  const f = await filled.frame.locator('#demo-filled').evaluate(el => {
    const base = el.shadowRoot.querySelector('[part="base"]');
    const style = getComputedStyle(base);
    return { reflected: el.hasAttribute('filled'), classes: [base.classList.contains('textarea--filled'), base.classList.contains('textarea--standard')], border: style.borderTopStyle, background: style.backgroundColor };
  });
  expect(f).toEqual({ reflected: true, classes: [true, false], border: 'none', background: await token(filled.frame, '--sl-input-filled-background-color') });

  const disabled = await openExample(page, 'Disabled');
  const el = disabled.frame.locator('#demo-disabled');
  await el.evaluate(el => {
    window.__events = [];
    for (const type of ['sl-focus', 'sl-blur', 'sl-input', 'sl-change']) el.addEventListener(type, () => window.__events.push(type));
  });
  await el.click({ force: true });
  await el.evaluate(el => el.focus());
  const d = await el.evaluate(el => {
    const base = el.shadowRoot.querySelector('[part="base"]');
    const style = getComputedStyle(base);
    return { reflected: el.hasAttribute('disabled'), disabled: el.shadowRoot.querySelector('textarea').disabled, opacity: style.opacity, cursor: style.cursor, bg: style.backgroundColor, active: el.shadowRoot.activeElement?.localName ?? null, events: window.__events, valid: el.hasAttribute('data-valid') };
  });
  expect(d).toEqual({ reflected: true, disabled: true, opacity: '0.5', cursor: 'not-allowed', bg: await token(disabled.frame, '--sl-input-background-color-disabled'), active: null, events: [], valid: true });
  await addStartButton(disabled.frame);
  await disabled.frame.locator('#start').focus();
  await page.keyboard.press('Tab');
  expect(await disabled.frame.locator('body').evaluate(() => document.activeElement?.localName)).not.toBe('sl-textarea');
});

test('resize: vertical by default, none prevents resizing, auto grows and shrinks with the content and shows the size adjuster', async ({ page }) => {
  const { frame } = await openExample(page, 'Expand with Content');
  const none = await openExample(page, 'Prevent Resizing');
  expect(await none.frame.locator('#demo-resize-none').evaluate(el => {
    const root = el.shadowRoot;
    return [el.resize, getComputedStyle(root.querySelector('textarea')).resize, root.querySelector('[part="base"]').classList.contains('textarea--resize-none')];
  })).toEqual(['none', 'none', true]);

  const auto = frame.locator('#demo-resize-auto');
  const read = () => auto.evaluate(el => {
    const root = el.shadowRoot;
    const textarea = root.querySelector('textarea');
    const style = getComputedStyle(textarea);
    return { height: textarea.getBoundingClientRect().height, inline: textarea.style.height, resize: style.resize, overflowY: style.overflowY, adjusterHidden: root.querySelector('[part="textarea-adjuster"]').hidden, cls: root.querySelector('[part="base"]').classList.contains('textarea--resize-auto') };
  });
  const before = await read();
  expect(before).toMatchObject({ resize: 'none', overflowY: 'hidden', adjusterHidden: false, cls: true });
  await auto.locator('textarea').fill(Array.from({ length: 12 }, (_, i) => `line ${i}`).join('\n'));
  // Each step is its own assertion, so a failure says which one broke: the algorithm ran, it measured the content, and the
  // box followed.
  await expect.poll(async () => (await read()).inline).toMatch(/^\d+(\.\d+)?px$/);
  await expect.poll(() => auto.evaluate(el => el.shadowRoot.querySelector('textarea').scrollHeight)).toBeGreaterThan(before.height + 40);
  await expect.poll(async () => (await read()).height).toBeGreaterThan(before.height + 40);
  const grown = await read();
  expect(Math.abs(parseFloat(grown.inline) - (await auto.evaluate(el => el.shadowRoot.querySelector('textarea').scrollHeight)))).toBeLessThan(2);
  await auto.locator('textarea').fill('one line');
  await expect.poll(async () => (await read()).height).toBeLessThan(grown.height - 40);

  // Switching the mode at run time: vertical shows the browser's resize handle and hides the adjuster again. As in
  // Shoelace, a change of `resize` does not re-measure: the height that `auto` wrote stays until the value or the rows change.
  const switched = await auto.evaluate(async el => {
    el.resize = 'vertical';
    await el.updateComplete;
    const textarea = el.shadowRoot.querySelector('textarea');
    const kept = textarea.style.height;
    el.rows = 5;
    await el.updateComplete;
    return { kept, inline: textarea.style.height, resize: getComputedStyle(textarea).resize, adjusterHidden: el.shadowRoot.querySelector('[part="textarea-adjuster"]').hidden };
  });
  expect(switched.kept).toMatch(/px$/);
  expect(switched).toMatchObject({ inline: '', resize: 'vertical', adjusterHidden: true });
  // The core values horizontal and both are not styled: the browser's default resize of a textarea applies, as in Shoelace.
  const core = await auto.evaluate(async el => {
    const out = {};
    for (const value of ['horizontal', 'both']) {
      el.resize = value;
      await el.updateComplete;
      const base = el.shadowRoot.querySelector('[part="base"]');
      out[value] = [getComputedStyle(el.shadowRoot.querySelector('textarea')).resize, [...base.classList].filter(c => c.startsWith('textarea--resize'))];
    }
    return out;
  });
  expect(core).toEqual({ horizontal: ['both', []], both: ['both', []] });
});

test('events: sl-input per edit and sl-change on commit bubble and are composed; nothing is emitted for script changes', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<button id="before">before</button><sl-textarea id="ev"></sl-textarea><button id="after">after</button>');
  const el = frame.locator('#ev');
  await el.evaluate(el => {
    window.__events = [];
    for (const type of ['sl-focus', 'sl-blur', 'sl-input', 'sl-change', 'sl-invalid', 'input', 'change', 'focus', 'blur']) {
      el.addEventListener(type, event => window.__events.push(`${type}:${event.bubbles}:${event.composed}:${event.cancelable}:${event.target === el}`));
    }
    document.body.addEventListener('sl-input', () => window.__events.push('body sl-input'));
    document.body.addEventListener('change', () => window.__events.push('body change'));
  });
  await el.locator('textarea').pressSequentially('ab');
  await page.keyboard.press('Tab');
  const events = await el.evaluate(() => window.__events);
  // Shoelace's events bubble, are composed and not cancelable. The platform's composed input event also reaches the host;
  // the native change event does not leave the inner textarea.
  expect(events.filter(e => e.startsWith('sl-'))).toEqual([
    'sl-focus:true:true:false:true', 'sl-input:true:true:false:true', 'sl-input:true:true:false:true', 'sl-change:true:true:false:true', 'sl-blur:true:true:false:true',
  ]);
  expect(events.filter(e => e.startsWith('input:') || e.startsWith('change:')).map(e => e.split(':')[0])).toEqual(['input', 'input']);
  expect(events.filter(e => e === 'body sl-input').length).toBe(2);
  expect(events).not.toContain('body change');
  expect(await el.evaluate(el => [el.value, el.getAttribute('value')])).toEqual(['ab', null]);

  // Setting the value from script, or replacing a range of text, emits nothing.
  const quiet = await el.evaluate(async el => {
    window.__events = [];
    el.value = 'script';
    await el.updateComplete;
    el.setRangeText('S', 0, 1);
    await el.updateComplete;
    return { events: window.__events, value: el.value, inner: el.shadowRoot.querySelector('textarea').value };
  });
  expect(quiet).toEqual({ events: [], value: 'Script', inner: 'Script' });
});

test('keyboard: Tab focuses the textarea, Enter adds a line, the focus state follows, and typing stops at maxlength', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-textarea id="kb"></sl-textarea><sl-textarea id="max" maxlength="3"></sl-textarea>');
  await addStartButton(frame);
  await frame.locator('#start').focus();
  await page.keyboard.press('Tab');
  expect(await frame.locator('body').evaluate(() => document.activeElement?.id)).toBe('demo-default');
  await page.keyboard.press('Tab');
  expect(await frame.locator('body').evaluate(() => document.activeElement?.id)).toBe('kb');
  expect(await frame.locator('#kb').evaluate(el => [el.shadowRoot.activeElement?.localName, el.shadowRoot.querySelector('[part="base"]').classList.contains('textarea--focused')])).toEqual(['textarea', true]);
  await page.keyboard.type('a');
  await page.keyboard.press('Enter');
  await page.keyboard.type('b');
  expect(await frame.locator('#kb').evaluate(el => el.value)).toBe('a\nb');
  await page.keyboard.press('Shift+Tab');
  expect(await frame.locator('body').evaluate(() => document.activeElement?.id)).toBe('demo-default');
  expect(await frame.locator('#kb').evaluate(el => el.shadowRoot.querySelector('[part="base"]').classList.contains('textarea--focused'))).toBe(false);
  await frame.locator('#max textarea').pressSequentially('abcdef');
  expect(await frame.locator('#max').evaluate(el => [el.value, el.maxlength, el.shadowRoot.querySelector('textarea').getAttribute('maxlength')])).toEqual(['abc', 3, '3']);
});

test('forms: name and value are submitted, a required empty textarea blocks submit, and reset restores the default value', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, `
    <form id="f" action="about:blank">
      <sl-textarea id="req" name="comments" required></sl-textarea>
      <sl-textarea id="def" name="notes" value="start"></sl-textarea>
      <sl-textarea id="off" name="off" value="skipped" disabled></sl-textarea>
      <sl-textarea id="noname" value="anonymous"></sl-textarea>
      <button id="submit" type="submit">Submit</button><button id="reset" type="reset">Reset</button>
    </form>`);
  await frame.locator('#f').evaluate(form => {
    window.__submitted = [];
    form.addEventListener('submit', event => {
      event.preventDefault();
      window.__submitted.push(new URLSearchParams(new FormData(form)).toString());
    });
    window.__invalid = [];
    form.querySelector('#req').addEventListener('sl-invalid', e => window.__invalid.push(`${e.bubbles}:${e.cancelable}`));
  });
  const req = frame.locator('#req');
  await expect(req).toHaveAttribute('data-required', '');
  await expect(req).toHaveAttribute('data-invalid', '');
  // Core's invalid property is inert here, so the host gains no attribute Shoelace's textarea lacks.
  await expect(req).not.toHaveAttribute('invalid', '');
  expect(await frame.locator('#f').evaluate(form => [...form.elements].some(e => e.localName === 'sl-textarea'))).toBe(false);
  await frame.locator('#submit').click();
  expect(await frame.locator('body').evaluate(() => [window.__submitted, window.__invalid])).toEqual([[], ['false:true']]);
  await expect(req).toHaveAttribute('data-user-invalid', '');
  await req.locator('textarea').pressSequentially('hello');
  await expect(req).toHaveAttribute('data-valid', '');
  await expect(req).toHaveAttribute('data-user-valid', '');
  await frame.locator('#submit').click();
  // A disabled textarea and one without a name are not submitted.
  expect(await frame.locator('body').evaluate(() => window.__submitted)).toEqual(['comments=hello&notes=start']);
  await frame.locator('#def textarea').fill('changed');
  await frame.locator('#reset').click();
  expect(await frame.locator('#f').evaluate(() => ['#req', '#def'].map(id => [document.querySelector(id).value, document.querySelector(id).shadowRoot.querySelector('textarea').value]))).toEqual([['', ''], ['start', 'start']]);
  await expect(req).not.toHaveAttribute('data-user-valid', '');
  await expect(req).toHaveAttribute('data-invalid', '');
});

test('forms (Shoelace parity): the form attribute finds an outside form, a disabled fieldset does not disable the textarea, and form methods see Velcro controls', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, `
    <form id="outside" action="about:blank"></form>
    <sl-textarea id="remote" form="outside" name="remote" value="x"></sl-textarea>
    <form id="fs" action="about:blank"><fieldset disabled><sl-textarea id="in-fieldset" name="fs" value="y"></sl-textarea></fieldset></form>
    <form id="valid" action="about:blank"><sl-textarea id="needed" name="needed" required></sl-textarea></form>
    <form id="novalidate" action="about:blank" novalidate><sl-textarea id="skipped" name="skipped" required></sl-textarea></form>`);
  const r = await frame.locator('body').evaluate(() => ({
    remote: new URLSearchParams(new FormData(document.querySelector('#outside'))).toString(),
    remoteForm: document.querySelector('#remote').getForm()?.id,
    fieldset: new URLSearchParams(new FormData(document.querySelector('#fs'))).toString(),
    fieldsetDisabled: document.querySelector('#in-fieldset').shadowRoot.querySelector('textarea').disabled,
    formValidity: document.querySelector('#valid').checkValidity(),
    formReport: document.querySelector('#valid').reportValidity(),
    novalidate: [document.querySelector('#novalidate').checkValidity(), document.querySelector('#skipped').hasAttribute('data-invalid')],
    noForm: document.querySelector('#demo-default').getForm(),
  }));
  expect(r).toEqual({ remote: 'remote=x', remoteForm: 'outside', fieldset: 'fs=y', fieldsetDisabled: false, formValidity: false, formReport: false, novalidate: [true, true], noForm: null });
});

test('validation: required, minlength, maxlength and setCustomValidity use the inner textarea and keep the data attributes current', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, `
    <sl-textarea id="min" minlength="5"></sl-textarea>
    <sl-textarea id="cust"></sl-textarea>
    <sl-textarea id="dis" required disabled></sl-textarea>`);
  await frame.locator('#min textarea').pressSequentially('abc');
  const short = await frame.locator('#min').evaluate(async el => {
    await el.updateComplete;
    return { valid: el.checkValidity(), tooShort: el.validity.tooShort, message: typeof el.validationMessage, attr: [el.hasAttribute('data-invalid'), el.hasAttribute('data-valid')], min: [el.minlength, el.shadowRoot.querySelector('textarea').getAttribute('minlength')] };
  });
  expect(short).toEqual({ valid: false, tooShort: true, message: 'string', attr: [true, false], min: [5, '5'] });
  await frame.locator('#min textarea').pressSequentially('de');
  expect(await frame.locator('#min').evaluate(async el => { await el.updateComplete; return [el.checkValidity(), el.hasAttribute('data-valid')]; })).toEqual([true, true]);

  const cust = await frame.locator('#cust').evaluate(async el => {
    const seen = [];
    el.addEventListener('sl-invalid', event => seen.push(`${event.bubbles}:${event.cancelable}`));
    el.setCustomValidity('Nope');
    await el.updateComplete;
    const invalid = { valid: el.validity.valid, custom: el.validity.customError, message: el.validationMessage, data: el.hasAttribute('data-invalid') };
    const checked = el.checkValidity();
    const reported = el.reportValidity();
    el.setCustomValidity('');
    await el.updateComplete;
    return { invalid, checked, reported, seen, restored: [el.validity.valid, el.hasAttribute('data-valid')] };
  });
  expect(cust).toEqual({
    invalid: { valid: false, custom: true, message: 'Nope', data: true },
    checked: false,
    reported: false,
    seen: ['false:true', 'false:true'],
    restored: [true, true],
  });
  // A disabled form control is always valid, and becomes invalid again when enabled.
  const dis = await frame.locator('#dis').evaluate(async el => {
    const before = [el.checkValidity(), el.hasAttribute('data-valid')];
    el.disabled = false;
    await el.updateComplete;
    return { before, after: [el.checkValidity(), el.hasAttribute('data-invalid')] };
  });
  expect(dis).toEqual({ before: [true, true], after: [false, true] });
});

test('properties: defaults, reflection, value attribute sets defaultValue, and removing a reflected attribute restores its initial value', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-textarea id="p"></sl-textarea>');
  const r = await frame.locator('#p').evaluate(async el => {
    const defaults = {
      name: el.name, value: el.value, defaultValue: el.defaultValue, size: el.size, filled: el.filled, label: el.label, helpText: el.helpText,
      placeholder: el.placeholder, rows: el.rows, resize: el.resize, disabled: el.disabled, readonly: el.readonly, form: el.form, required: el.required,
      minlength: el.minlength, maxlength: el.maxlength, autocapitalize: el.autocapitalize, autocorrect: el.autocorrect, autocomplete: el.autocomplete,
      autofocus: el.autofocus, enterkeyhint: el.enterkeyhint, spellcheck: el.spellcheck, inputmode: el.inputmode, title: el.title,
    };
    el.setAttribute('value', 'v1');
    await el.updateComplete;
    const afterAttr = { value: el.value, defaultValue: el.defaultValue, inner: el.shadowRoot.querySelector('textarea').value };
    el.value = 'typed';
    await el.updateComplete;
    const afterProp = { attr: el.getAttribute('value'), defaultValue: el.defaultValue };
    el.size = 'large';
    el.filled = true;
    el.disabled = true;
    el.readonly = true;
    el.required = true;
    el.form = 'f';
    el.name = 'n';
    el.label = 'L';
    el.placeholder = 'P';
    el.rows = 7;
    el.resize = 'none';
    await el.updateComplete;
    const reflected = {
      size: el.getAttribute('size'), filled: el.getAttribute('filled'), disabled: el.getAttribute('disabled'), readonly: el.getAttribute('readonly'),
      required: el.getAttribute('required'), form: el.getAttribute('form'),
      // Not reflected in Shoelace either.
      name: el.getAttribute('name'), label: el.getAttribute('label'), placeholder: el.getAttribute('placeholder'), rows: el.getAttribute('rows'), resize: el.getAttribute('resize'),
    };
    const inner = el.shadowRoot.querySelector('textarea');
    const innerState = { name: inner.name, placeholder: inner.placeholder, rows: inner.rows, disabled: inner.disabled, readOnly: inner.readOnly, required: inner.required };
    el.removeAttribute('size');
    el.removeAttribute('form');
    el.removeAttribute('filled');
    await el.updateComplete;
    return { defaults, afterAttr, afterProp, reflected, innerState, restored: { size: el.size, form: el.form, filled: el.filled } };
  });
  expect(r).toEqual({
    defaults: {
      name: '', value: '', defaultValue: '', size: 'medium', filled: false, label: '', helpText: '', placeholder: '', rows: 4, resize: 'vertical', disabled: false,
      readonly: false, form: '', required: false, minlength: undefined, maxlength: undefined, autocapitalize: undefined, autocorrect: undefined,
      autocomplete: undefined, autofocus: undefined, enterkeyhint: undefined, spellcheck: true, inputmode: undefined, title: '',
    },
    afterAttr: { value: 'v1', defaultValue: 'v1', inner: 'v1' },
    afterProp: { attr: 'v1', defaultValue: 'v1' },
    reflected: {
      size: 'large', filled: '', disabled: '', readonly: '', required: '', form: 'f',
      name: null, label: null, placeholder: null, rows: null, resize: null,
    },
    innerState: { name: 'n', placeholder: 'P', rows: 7, disabled: true, readOnly: true, required: true },
    restored: { size: 'medium', form: '', filled: false },
  });
});

test('attributes pass through to the inner textarea: autocapitalize, autocorrect, autofocus, enterkeyhint, inputmode, spellcheck, title and the length limits, but not autocomplete', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, `
    <sl-textarea id="attrs" autocapitalize="words" autocorrect="off" autocomplete="off" autofocus enterkeyhint="send" inputmode="numeric" spellcheck="false" title="Tip" minlength="2" maxlength="9" placeholder="Hint"></sl-textarea>
    <sl-textarea id="plain"></sl-textarea>`);
  const r = await frame.locator('body').evaluate(() => {
    const read = id => {
      const el = document.querySelector(id);
      const inner = el.shadowRoot.querySelector('textarea');
      return {
        host: [el.autocapitalize, el.autocorrect, el.autocomplete, el.autofocus, el.enterkeyhint, el.inputmode, el.spellcheck, el.title, el.minlength, el.maxlength],
        inner: ['autocapitalize', 'autocorrect', 'autocomplete', 'autofocus', 'enterkeyhint', 'inputmode', 'spellcheck', 'title', 'minlength', 'maxlength'].map(name => inner.getAttribute(name)),
      };
    };
    return { attrs: read('#attrs'), plain: read('#plain') };
  });
  expect(r.attrs).toEqual({
    host: ['words', 'off', 'off', true, 'send', 'numeric', false, 'Tip', 2, 9],
    // Shoelace's template does not pass `autocomplete` to the inner textarea (upstream quirk), so it is null here.
    inner: ['words', 'off', null, '', 'send', 'numeric', 'false', 'Tip', '2', '9'],
  });
  // Undefined until set: nothing is rendered for them, but spellcheck is on and the title is empty.
  expect(r.plain).toEqual({
    host: [undefined, undefined, undefined, undefined, undefined, undefined, true, '', undefined, undefined],
    inner: [null, null, null, null, null, null, 'true', '', null, null],
  });
});

test('methods: select, setSelectionRange, setRangeText, scrollPosition, focus and blur act on the inner textarea', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-textarea id="m" rows="2"></sl-textarea>');
  const m = frame.locator('#m');
  const r = await m.evaluate(async el => {
    el.value = 'hello world';
    await el.updateComplete;
    const inner = el.shadowRoot.querySelector('textarea');
    el.select();
    const selected = [inner.selectionStart, inner.selectionEnd];
    el.setSelectionRange(1, 3);
    const range = [inner.selectionStart, inner.selectionEnd, inner.selectionDirection];
    el.setSelectionRange(2, 4, 'backward');
    const backward = inner.selectionDirection;
    el.setRangeText('XY', 0, 2);
    await el.updateComplete;
    const replaced = [el.value, inner.value];
    el.setSelectionRange(0, 0);
    el.setRangeText('>', undefined, undefined, 'end');
    await el.updateComplete;
    const atCaret = [el.value, inner.selectionStart];
    el.value = Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n');
    await el.updateComplete;
    const set = el.scrollPosition({ top: 20, left: 0 });
    const position = el.scrollPosition();
    // Read before focus(): some engines scroll the caret into view when a textarea gains focus.
    const innerTop = inner.scrollTop;
    const focused = (el.focus(), [document.activeElement === el, el.shadowRoot.activeElement === inner]);
    el.blur();
    return { selected, range, backward, replaced, atCaret, set, position, inner: innerTop, focused, blurred: el.shadowRoot.activeElement };
  });
  expect(r.selected).toEqual([0, 11]);
  // The platform may report an explicit 'none' direction as 'forward' (Chromium and WebKit do outside macOS).
  expect(r.range.slice(0, 2)).toEqual([1, 3]);
  expect(['none', 'forward']).toContain(r.range[2]);
  expect(r.backward).toBe('backward');
  expect(r.replaced).toEqual(['XYllo world', 'XYllo world']);
  expect(r.atCaret).toEqual(['>XYllo world', 1]);
  expect(r.set).toBeUndefined();
  expect(r.position.top).toBe(r.inner);
  expect(r.position.top).toBeGreaterThan(0);
  expect(r.focused).toEqual([true, true]);
  expect(r.blurred).toBeNull();
  // Only numbers are applied: a `top` of undefined leaves the scroll offset alone.
  const partial = await m.evaluate(el => {
    el.scrollPosition({ top: 0 });
    el.scrollPosition({ left: 3, top: undefined });
    return el.scrollPosition();
  });
  expect(partial.top).toBe(0);
});

test('core extensions kept: hide-label and error-message; invalid and label-position have no effect', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, `
    <sl-textarea id="hidden" hide-label label="Hidden label" help-text="Help"></sl-textarea>
    <sl-textarea id="err" error-message="Pick this"></sl-textarea>
    <sl-textarea id="pos" label-position="start" label="Start"></sl-textarea>
    <sl-textarea id="ref" label="Reference"></sl-textarea>`);
  const hidden = await frame.locator('#hidden').evaluate(el => ({
    label: el.shadowRoot.querySelector('label').getBoundingClientRect().width,
    help: el.shadowRoot.querySelector('[part="form-control-help-text"]').getBoundingClientRect().width,
    reflected: el.hasAttribute('hide-label'),
  }));
  expect(hidden).toEqual({ label: 1, help: 1, reflected: true });
  await expect(frame.getByRole('textbox', { name: 'Hidden label' })).toHaveAccessibleDescription('Help');
  const err = await frame.locator('#err').evaluate(async el => {
    const before = { valid: el.validity.valid, message: el.validationMessage, invalid: el.invalid, data: el.hasAttribute('data-invalid'), text: el.shadowRoot.textContent.includes('Pick this') };
    el.errorMessage = '';
    await el.updateComplete;
    const after = { valid: el.validity.valid, invalid: el.invalid, data: el.hasAttribute('data-invalid') };
    el.invalid = true;
    await el.updateComplete;
    return { before, after, inert: { valid: el.validity.valid, data: el.hasAttribute('data-invalid'), reflected: el.hasAttribute('invalid') } };
  });
  expect(err).toEqual({
    before: { valid: false, message: 'Pick this', invalid: false, data: true, text: false },
    after: { valid: true, invalid: false, data: false },
    inert: { valid: true, data: false, reflected: true },
  });
  // label-position is accepted (and reflected) but the layout is Shoelace's: the label stays above the textarea.
  const layout = await frame.locator('body').evaluate(() => ['#pos', '#ref'].map(id => {
    const root = document.querySelector(id).shadowRoot;
    const label = root.querySelector('label').getBoundingClientRect();
    const box = root.querySelector('[part="base"]').getBoundingClientRect();
    return [label.bottom <= box.top + 1, Math.round(label.left - box.left)];
  }));
  expect(layout).toEqual([[true, 0], [true, 0]]);
  // readonly is Shoelace's own attribute: the value cannot be edited.
  await mount(frame, '<sl-textarea id="ro" readonly value="fixed"></sl-textarea>');
  await frame.locator('#ro textarea').click();
  await page.keyboard.type('x');
  expect(await frame.locator('#ro').evaluate(el => [el.value, el.shadowRoot.querySelector('textarea').readOnly])).toEqual(['fixed', true]);
});

test('dir and lang are reactive, not reflected and undefined by default, as Shoelace\'s base element declares them', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-textarea id="dl"></sl-textarea><sl-textarea id="attrs" dir="rtl" lang="de"></sl-textarea>');
  const r = await frame.locator('body').evaluate(async () => {
    const el = document.querySelector('#dl');
    const attrs = document.querySelector('#attrs');
    const observed = customElements.get('sl-textarea').observedAttributes.filter(a => a === 'dir' || a === 'lang');
    const defaults = [el.dir, el.lang];
    el.dir = 'auto';
    el.lang = 'fr';
    await el.updateComplete;
    const assigned = [el.dir, el.lang, el.getAttribute('dir'), el.getAttribute('lang')];
    const fromAttributes = [attrs.dir, attrs.lang];
    attrs.removeAttribute('dir');
    attrs.removeAttribute('lang');
    await attrs.updateComplete;
    return { observed, defaults, assigned, fromAttributes, removed: [attrs.dir, attrs.lang] };
  });
  expect(r).toEqual({
    observed: ['dir', 'lang'],
    defaults: [undefined, undefined],
    assigned: ['auto', 'fr', null, null],
    fromAttributes: ['rtl', 'de'],
    // not reflected, so not restored to an initial value (Shoelace restores reflected properties only)
    removed: [null, null],
  });
});

test('focus is not delegated, as in Shoelace: clicking the help text neither focuses the textarea nor emits sl-focus', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-textarea id="nf" label="Label" help-text="Some help text"></sl-textarea>');
  const el = frame.locator('#nf');
  await el.evaluate(el => {
    window.__nfEvents = [];
    el.addEventListener('sl-focus', () => window.__nfEvents.push('sl-focus'));
  });
  expect(await el.evaluate(el => el.shadowRoot.delegatesFocus)).toBe(false);
  await el.locator('[part="form-control-help-text"]').click();
  expect(await frame.locator('body').evaluate(() => ({ active: document.activeElement?.localName, events: window.__nfEvents })))
    .toEqual({ active: 'body', events: [] });
  // focus() still focuses the inner textarea
  await el.evaluate(el => el.focus());
  expect(await el.evaluate(el => [document.activeElement === el, el.shadowRoot.activeElement?.localName, window.__nfEvents])).toEqual([true, 'textarea', ['sl-focus']]);
});

test('upstream quirks matched: hidden does not hide it, scrollPosition() reads left as top, form="" and aria-describedby are always set, removing value nulls it, autocomplete is not passed on, methods throw before rendering', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, '<sl-textarea id="h" hidden rows="2"></sl-textarea><sl-textarea id="v" value="a"></sl-textarea>');
  // Shoelace's :host { display: block } outranks the user agent's [hidden] rule.
  expect(await frame.locator('#h').evaluate(el => getComputedStyle(el).display)).toBe('block');
  const r = await frame.locator('body').evaluate(async () => {
    const h = document.querySelector('#h');
    h.value = Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n');
    await h.updateComplete;
    h.scrollPosition({ top: 15 });
    const pos = h.scrollPosition();
    const v = document.querySelector('#v');
    v.removeAttribute('value');
    await v.updateComplete;
    v.autocomplete = 'off';
    await v.updateComplete;
    const autocomplete = [v.shadowRoot.querySelector('textarea').getAttribute('autocomplete'), v.autocomplete];
    const fresh = document.createElement('sl-textarea');
    const thrown = {};
    for (const [name, call] of Object.entries({
      focus: () => fresh.focus(), blur: () => fresh.blur(), select: () => fresh.select(), scrollPosition: () => fresh.scrollPosition(),
      setSelectionRange: () => fresh.setSelectionRange(0, 0), setRangeText: () => fresh.setRangeText('x'), checkValidity: () => fresh.checkValidity(),
      reportValidity: () => fresh.reportValidity(), setCustomValidity: () => fresh.setCustomValidity(''), validity: () => fresh.validity, validationMessage: () => fresh.validationMessage,
    })) {
      try { call(); thrown[name] = false; } catch (error) { thrown[name] = error instanceof TypeError; }
    }
    return {
      leftIsTop: pos.left === pos.top && pos.top > 0,
      form: h.getAttribute('form'),
      describedBy: h.shadowRoot.querySelector('textarea').getAttribute('aria-describedby'),
      removed: [v.value, v.defaultValue],
      autocomplete,
      thrown,
    };
  });
  expect(r.leftIsTop).toBe(true);
  expect(r.form).toBe('');
  expect(r.describedBy).toBe('help-text');
  expect(r.removed).toEqual([null, null]);
  expect(r.autocomplete).toEqual([null, 'off']);
  expect(Object.values(r.thrown).every(Boolean)).toBe(true);
  expect(Object.keys(r.thrown).length).toBe(11);
});

test('inherited core ready event: dispatched once on the element after the first update, not bubbling or composed', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('body').evaluate(async body => {
    const el = document.createElement('sl-textarea');
    const seen = [];
    let bubbled = 0;
    el.addEventListener('ready', event => seen.push({ bubbles: event.bubbles, composed: event.composed }));
    body.addEventListener('ready', () => bubbled++);
    body.append(el);
    await el.updateComplete;
    el.rows = 3;
    await el.updateComplete;
    el.remove();
    return { seen, bubbled };
  });
  expect(r).toEqual({ seen: [{ bubbles: false, composed: false }], bubbled: 0 });
});

test('the form utilities are exported: serialize() turns repeated names into arrays and getFormControls() lists native and Velcro controls in DOM order', async ({ page }) => {
  const { frame } = await openExample(page);
  await mount(frame, `
    <form id="util" action="about:blank">
      <sl-textarea name="note" value="one"></sl-textarea>
      <input name="plain" value="native">
      <sl-textarea name="note" value="two"></sl-textarea>
      <sl-textarea name="solo" value="s"></sl-textarea>
    </form>`);
  const r = await frame.locator('body').evaluate(async () => {
    const { serialize, getFormControls } = await import('@charm-ux/velcro');
    const form = document.querySelector('#util');
    return { serialized: serialize(form), order: getFormControls(form).map(c => `${c.localName}:${c.getAttribute('name')}`) };
  });
  expect(r.serialized).toEqual({ plain: 'native', note: ['one', 'two'], solo: 's' });
  expect(r.order).toEqual(['sl-textarea:note', 'input:plain', 'sl-textarea:note', 'sl-textarea:solo']);
});

test('the ./utilities/form package export resolves to a module that exports exactly serialize and getFormControls', async () => {
  const velcroDir = fileURLToPath(new URL('../../packages/velcro/', import.meta.url));
  const entry = JSON.parse(readFileSync(path.join(velcroDir, 'package.json'), 'utf8')).exports['./utilities/form'];
  expect(entry).toEqual({ types: './dist/utilities/form.d.ts', import: './dist/utilities/form.js' });
  const module = await import(pathToFileURL(path.join(velcroDir, entry.import)).href);
  expect(Object.keys(module).sort()).toEqual(['getFormControls', 'serialize']);
});

test('every docs example renders in its own document', async ({ page }) => {
  await openDocs(page, PAGE);
  const titles = await page.locator('iframe.example').evaluateAll(frames => frames.map(f => f.title));
  expect(titles).toEqual(EXAMPLES.map(([title]) => `Textarea example: ${title}`));
  for (const title of titles) {
    const frame = page.frameLocator(`iframe.example[title="${title}"]`);
    await expect(frame.locator('sl-textarea').first()).toBeVisible();
    expect(await frame.locator('sl-textarea').first().evaluate(el => Boolean(el.shadowRoot?.querySelector('[part="base"]')))).toBe(true);
  }
});

test('no upstream Shoelace runtime is requested or defined; all requests stay on the local origin', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  expect(await frame.locator('body').evaluate(() => Boolean(window.Shoelace || document.querySelector('script[src*="shoelace"]')))).toBe(false);
});

// The values that matter in a rendered example, which an HTML example and its React version must share.
const summarize = () => [...document.querySelectorAll('sl-textarea')].map(el => {
  const root = el.shadowRoot;
  const inner = root.querySelector('textarea');
  return {
    label: el.label, helpText: el.helpText, rows: el.rows, placeholder: el.placeholder, filled: el.filled, disabled: el.disabled, size: el.size, resize: el.resize,
    innerRows: inner.rows, innerPlaceholder: inner.placeholder, innerDisabled: inner.disabled, base: root.querySelector('[part="base"]').className,
    control: root.querySelector('[part="form-control"]').className, help: root.querySelector('[part="form-control-help-text"]').getAttribute('aria-hidden'),
  };
});

// Shoelace's React examples, ported in packages/docs/examples/textarea/react/*.jsx (the files the docs page shows),
// bundled with React 19 and the generated wrapper, which is resolved through the package's real export map. Each one is
// rendered and compared with the HTML example it belongs to.
test.describe('React examples', () => {
  const reactDir = fileURLToPath(new URL('../../packages/docs/examples/textarea/react/', import.meta.url));
  const velcroDir = fileURLToPath(new URL('../../packages/velcro/', import.meta.url));
  let bundle;

  test.beforeAll(async () => {
    const fromVelcro = createRequire(path.join(velcroDir, 'package.json'));
    const fromDocs = createRequire(fileURLToPath(new URL('../../packages/docs/package.json', import.meta.url)));
    const pkgDir = name => path.dirname(fromVelcro.resolve(`${name}/package.json`));
    const { build } = await import(pathToFileURL(fromDocs.resolve('vite')).href);
    const dir = mkdtempSync(path.join(tmpdir(), 'velcro-textarea-react-'));
    try {
      // Each example file declares `App` without exporting it (as on Shoelace's page); the copy only appends the export.
      for (const [, name] of EXAMPLES) {
        writeFileSync(path.join(dir, `${name}.jsx`), `${readFileSync(path.join(reactDir, `${name}.jsx`), 'utf8')}\nexport default App;\n`);
      }
      const entry = path.join(dir, 'entry.js');
      writeFileSync(entry, `
        import React from 'react';
        import { flushSync } from 'react-dom';
        import { createRoot } from 'react-dom/client';
        import { VelcroTextarea } from '@charm-ux/velcro/react/VelcroTextarea.js';
        ${EXAMPLES.map(([, name], i) => `import App${i} from './${name}.jsx';`).join('\n')}
        const apps = { ${EXAMPLES.map(([, name], i) => `${JSON.stringify(name)}: App${i}`).join(', ')} };
        window.errors = [];
        addEventListener('error', e => window.errors.push(String(e.message)));
        addEventListener('unhandledrejection', e => window.errors.push(String(e.reason)));
        window.reactVersion = React.version;
        window.textareaRef = React.createRef();
        let propsRoot;
        window.renderWithProps = props => {
          if (!propsRoot) {
            const host = document.createElement('div');
            document.body.append(host);
            propsRoot = createRoot(host);
          }
          flushSync(() => propsRoot.render(React.createElement(VelcroTextarea, { ref: window.textareaRef, ...props })));
        };
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

  async function load(page) {
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.setContent('<!DOCTYPE html><html><body style="margin: 0"></body></html>');
    await page.addScriptTag({ type: 'module', content: bundle });
    await page.waitForFunction(() => typeof window.renderExample === 'function');
    return pageErrors;
  }

  async function render(page, name) {
    await page.evaluate(async n => {
      document.body.replaceChildren();
      window.renderExample(n);
      await customElements.whenDefined('sl-textarea');
      await Promise.all([...document.querySelectorAll('sl-textarea')].map(el => el.updateComplete));
      await new Promise(resolve => setTimeout(resolve, 50));
    }, name);
  }

  test('every React example renders the same textareas as the HTML example it belongs to', async ({ page }) => {
    test.setTimeout(150_000);
    // The HTML examples, from a second page, so that the two documents never share a registry.
    const htmlPage = await page.context().newPage();
    watchNetwork(htmlPage);
    const expected = {};
    try {
      await openDocs(htmlPage, PAGE);
      await documentsLoaded(htmlPage);
      for (const [title, name] of EXAMPLES) {
        const frame = frameFor(htmlPage, title);
        await expect(frame.locator('sl-textarea').first()).toBeAttached();
        await frame.locator('body').evaluate(async () => {
          await customElements.whenDefined('sl-textarea');
          await Promise.all([...document.querySelectorAll('sl-textarea')].map(el => el.updateComplete));
        });
        expected[name] = await frame.locator('body').evaluate(summarize);
      }
    } finally {
      await htmlPage.close();
    }
    const pageErrors = await load(page);
    expect(await page.evaluate(() => window.reactVersion)).toBe('19.2.0');
    for (const [, name] of EXAMPLES) {
      await render(page, name);
      const actual = await page.evaluate(summarize);
      expect(actual.length, name).toBeGreaterThan(0);
      expect(actual, name).toEqual(expected[name]);
    }
    expect(await page.evaluate(() => window.errors)).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('the wrapper passes properties and Shoelace\'s events: label, rows, helpText, value and onSlInput / onSlChange', async ({ page }) => {
    const pageErrors = await load(page);
    await page.evaluate(async () => {
      window.calls = [];
      window.props = {
        label: 'Notes', helpText: 'Be brief', rows: 3, name: 'notes', resize: 'auto', size: 'large',
        onSlInput: e => window.calls.push(`input:${e.target.value}`), onSlChange: e => window.calls.push(`change:${e.target.value}`),
      };
      window.renderWithProps(window.props);
      await customElements.whenDefined('sl-textarea');
      await window.textareaRef.current.updateComplete;
    });
    const read = () => page.evaluate(() => {
      const el = window.textareaRef.current;
      const inner = el.shadowRoot.querySelector('textarea');
      return { ctor: customElements.get('sl-textarea') === el.constructor, label: el.label, help: el.helpText, rows: [el.rows, inner.rows], value: [el.value, inner.value], name: inner.name, resize: el.resize, size: el.getAttribute('size') };
    });
    expect(await read()).toEqual({ ctor: true, label: 'Notes', help: 'Be brief', rows: [3, 3], value: ['', ''], name: 'notes', resize: 'auto', size: 'large' });
    await page.locator('sl-textarea textarea').pressSequentially('ab');
    // Leave the textarea through the blur() that Playwright calls on the inner element: a Tab out of the only focusable
    // element does not blur it in every engine.
    await page.locator('sl-textarea textarea').blur();
    expect(await page.evaluate(() => window.calls)).toEqual(['input:a', 'input:ab', 'change:ab']);
    // A later render passes a new value as a property.
    await page.evaluate(async () => {
      window.renderWithProps({ ...window.props, value: 'later' });
      await window.textareaRef.current.updateComplete;
    });
    expect((await read()).value).toEqual(['later', 'later']);
    expect(pageErrors).toEqual([]);
  });
});
