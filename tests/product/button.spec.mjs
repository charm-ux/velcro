import { expect, test } from '@playwright/test';

const PAGE = '/components/button';

async function openExample(page, name = 'Overview') {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  // Litro's client router remounts the page component once after load, which reloads the iframe; wait for it to settle.
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  const frame = page.frameLocator(`iframe.example[title="Button example: ${name}"]`);
  await expect(frame.locator('sl-button').first()).toBeVisible();
  await frame.locator('body').evaluate(() => customElements.whenDefined('sl-button'));
  await page.waitForLoadState('networkidle');
  return { frame, requests };
}

test('docs page is prerendered with Velcro branding and prototype status', async ({ request }) => {
  const response = await request.get(PAGE);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('<title>Button - Velcro</title>');
  expect(html).toContain('Velcro is an unreleased prototype');
  expect(html).toContain('Not implemented or unverified');
  expect(html).not.toMatch(/<(script|link)[^>]*shoelace/i);
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
});

test('sl-button registers inside the example document, and separately in the docs page through the client entry', async ({ page }) => {
  const { requests } = await openExample(page);
  // The docs page loads the same runtime through its client entry (app-main.ts) into its own, separate registry.
  expect(await page.evaluate(() => customElements.whenDefined('sl-button').then(ctor => typeof ctor))).toBe('function');
  expect(requests.some(url => url.endsWith('/_litro/velcro.js'))).toBe(true);
});

test('renders: variants, prefix/suffix slots and public parts', async ({ page }) => {
  const { frame } = await openExample(page);
  const primary = frame.locator('#demo-primary');
  const box = await primary.boundingBox();
  expect(box.width).toBeGreaterThan(40);
  expect(box.height).toBeGreaterThan(30);
  const info = await primary.evaluate(el => ({
    tag: el.localName,
    variant: el.getAttribute('variant'),
    parts: [...el.shadowRoot.querySelectorAll('[part]')].flatMap(n => n.getAttribute('part').split(/\s+/)),
    background: getComputedStyle(el.shadowRoot.querySelector('[part~="base"]')).backgroundColor,
    prefixSlotted: el.shadowRoot.querySelector('slot[name="prefix"]').assignedNodes().length,
  }));
  expect(info.tag).toBe('sl-button');
  expect(info.parts).toEqual(expect.arrayContaining(['base', 'prefix', 'label', 'suffix']));
  expect(info.background).toBe('rgb(2, 132, 199)');
  expect(info.prefixSlotted).toBe(1);
  const pill = frame.locator('sl-button[pill]');
  expect(await pill.evaluate(el => el.querySelector('[slot="suffix"]') !== null)).toBe(true);
});

test('click increments the example counter through document-level wiring', async ({ page }) => {
  const { frame } = await openExample(page);
  await frame.locator('#demo-primary').click();
  await frame.locator('#demo-primary').click();
  await expect(frame.locator('#demo-count')).toHaveText('2');
});

test('disabled: a native button swallows clicks and is not keyboard focusable', async ({ page }) => {
  const { frame } = await openExample(page);
  const disabled = frame.locator('#demo-disabled');
  await expect(disabled).toHaveAttribute('disabled', '');
  await disabled.click({ force: true });
  await expect(frame.locator('#demo-disabled-count')).toHaveText('0');
  await frame.locator('#demo-default').focus();
  await page.keyboard.press('Tab');
  const active = await frame.locator('body').evaluate(() => document.activeElement?.getAttribute('variant'));
  expect(active).toBe('success');
});

test('keyboard focus: Tab reaches the button, shows a focus ring, Enter/Space activate, sl-focus/sl-blur fire', async ({ page }) => {
  const { frame } = await openExample(page);
  const primary = frame.locator('#demo-primary');
  await primary.evaluate(el => {
    window.__events = [];
    el.addEventListener('sl-focus', () => window.__events.push('sl-focus'));
    el.addEventListener('sl-blur', () => window.__events.push('sl-blur'));
  });
  const activeId = () => frame.locator('body').evaluate(() => document.activeElement?.id);
  await frame.locator('#demo-count').click();
  for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+Tab');
  expect(await activeId()).toBe('demo-primary');
  const outline = await primary.evaluate(el => getComputedStyle(el.shadowRoot.querySelector('[part~="base"]')).outlineStyle);
  expect(outline).not.toBe('none');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await expect(frame.locator('#demo-count')).toHaveText('2');
  await page.keyboard.press('Tab');
  const events = await primary.evaluate(() => window.__events);
  expect(events).toEqual(['sl-focus', 'sl-blur']);
});

test('no upstream Shoelace runtime is requested or defined', async ({ page }) => {
  const { frame, requests } = await openExample(page);
  expect(requests.filter(url => /shoelace/i.test(url))).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => url.startsWith(origin) || url.startsWith('about:') || url.startsWith('data:'))).toBe(true);
  const defined = await frame.locator('body').evaluate(() => ['sl-icon', 'sl-dialog'].filter(tag => customElements.get(tag)));
  // sl-spinner is Velcro's own component now; its upstream-free check lives in spinner.spec.mjs.
  expect(defined).toEqual([]);
  expect(await frame.locator('body').evaluate(() => Boolean(window.Shoelace || document.querySelector('script[src*="shoelace"]')))).toBe(false);
});

test('programmatic click(): ignored while disabled, exactly one click event when enabled', async ({ page }) => {
  const { frame } = await openExample(page);
  await frame.locator('#demo-disabled').evaluate(el => el.click());
  await expect(frame.locator('#demo-disabled-count')).toHaveText('0');
  await frame.locator('#demo-primary').evaluate(el => el.click());
  await expect(frame.locator('#demo-count')).toHaveText('1');
  await frame.locator('#demo-primary').evaluate(el => el.click());
  await expect(frame.locator('#demo-count')).toHaveText('2');
});

test('rendered link: click() emits exactly one host click and host preventDefault cancels the default action', async ({ page }) => {
  const { frame } = await openExample(page);
  const result = await frame.locator('body').evaluate(async () => {
    const run = async ({ prevent, disabled }) => {
      const el = document.createElement('sl-button');
      el.setAttribute('href', '#unused');
      if (disabled) el.setAttribute('disabled', '');
      document.body.append(el);
      await el.updateComplete;
      const seen = [];
      el.addEventListener('click', event => {
        if (prevent) event.preventDefault();
      });
      // Bubbles after the host listener: records whether the default action survived, then cancels it so the
      // example document never navigates.
      const record = event => {
        seen.push(event.defaultPrevented);
        event.preventDefault();
      };
      window.addEventListener('click', record);
      const control = el.shadowRoot.querySelector('.button');
      let controlClicks = 0;
      control.addEventListener('click', () => controlClicks++);
      el.click();
      window.removeEventListener('click', record);
      return { windowSeen: seen, controlClicks };
    };
    return { allowed: await run({}), prevented: await run({ prevent: true }), disabled: await run({ disabled: true }) };
  });
  expect(result.allowed).toEqual({ windowSeen: [false], controlClicks: 1 });
  expect(result.prevented).toEqual({ windowSeen: [true], controlClicks: 1 });
  // As in Shoelace, a disabled link still activates its inner <a> (rendered without href), so the click reaches host
  // listeners; the no-navigation check is the next test.
  expect(result.disabled).toEqual({ windowSeen: [false], controlClicks: 1 });
});

test('disabled link: click() and a real pointer click each reach the host once and do not navigate', async ({ page }) => {
  const { frame } = await openExample(page);
  const before = await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-button');
    el.id = 'demo-disabled-link';
    el.setAttribute('href', '#disabled-link');
    el.setAttribute('disabled', '');
    el.textContent = 'Link';
    document.body.append(el);
    window.__disabledLinkClicks = 0;
    // No preventDefault anywhere: a navigation would show up as a changed location.
    el.addEventListener('click', () => window.__disabledLinkClicks++);
    await el.updateComplete;
    const anchor = el.shadowRoot.querySelector('a');
    return { href: location.href, anchorHref: anchor.getAttribute('href'), ariaDisabled: anchor.getAttribute('aria-disabled') };
  });
  expect(before.anchorHref).toBeNull();
  expect(before.ariaDisabled).toBe('true');
  await frame.locator('#demo-disabled-link').evaluate(el => el.click());
  await frame.locator('#demo-disabled-link').click({ force: true });
  await page.waitForTimeout(100);
  const after = await frame.locator('body').evaluate(() => ({ href: location.href, clicks: window.__disabledLinkClicks }));
  expect(after).toEqual({ href: before.href, clicks: 2 });
});

test('rendered link: a real pointer click emits exactly one host click', async ({ page }) => {
  const { frame } = await openExample(page);
  await frame.locator('body').evaluate(async () => {
    const el = document.createElement('sl-button');
    el.id = 'demo-link';
    el.setAttribute('href', '#pointer');
    el.textContent = 'Link';
    document.body.append(el);
    window.__linkClicks = 0;
    el.addEventListener('click', event => {
      window.__linkClicks++;
      event.preventDefault();
    });
    await el.updateComplete;
  });
  await frame.locator('#demo-link').click();
  expect(await frame.locator('body').evaluate(() => window.__linkClicks)).toBe(1);
});

// Builds a form in the overview example document, clicks (or keys) the given control and reports what the form saw.
// Every submit is cancelled after it is recorded, so the example document never navigates.
async function formScenario(frame, markup, act) {
  return frame.locator('body').evaluate(
    async (body, { markup, act }) => {
      const host = document.createElement('div');
      host.innerHTML = markup;
      body.append(host);
      await Promise.all([...host.querySelectorAll('sl-button')].map(el => el.updateComplete));
      const form = host.querySelector('form') ?? document.querySelector('form#ext');
      const seen = { submits: [], resets: 0, invalid: 0 };
      const onSubmit = event => {
        const submitter = event.submitter;
        seen.submits.push({
          data: [...new FormData(form, submitter)].map(([k, v]) => `${k}=${v}`),
          submitterTag: submitter?.localName ?? null,
          formAction: submitter?.formAction ?? null,
          formMethod: submitter?.getAttribute('formmethod') ?? null,
          formNoValidate: submitter?.formNoValidate ?? null,
        });
        event.preventDefault();
      };
      document.addEventListener('submit', onSubmit);
      document.addEventListener('reset', () => seen.resets++);
      host.addEventListener('sl-invalid', () => seen.invalid++, true);
      const target = host.querySelector('#target');
      if (act === 'click') target.click();
      if (act === 'pointer') target.shadowRoot.querySelector('.button').dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
      await new Promise(r => setTimeout(r));
      document.removeEventListener('submit', onSubmit);
      const input = host.querySelector('input');
      seen.inputValue = input ? input.value : null;
      seen.elementsHasButton = form ? [...form.elements].some(el => el.localName === 'sl-button') : null;
      host.remove();
      document.querySelector('form#ext')?.remove();
      return seen;
    },
    { markup, act }
  );
}

test('forms: type=submit submits with the button as the submitter (name/value, no own FormData entry)', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await formScenario(
    frame,
    `<form action="/x"><input name="who" value="ada"><sl-button id="target" type="submit" name="act" value="save">Go</sl-button><sl-button name="other" value="no">x</sl-button></form>`,
    'click'
  );
  // The submitter is a temporary native button (Shoelace's approach), so event.submitter is a <button>, not sl-button.
  expect(r.submits).toEqual([expect.objectContaining({ data: ['who=ada', 'act=save'], submitterTag: 'button', formMethod: null, formNoValidate: false })]);
  // Like Shoelace's button, the element is not form-associated.
  expect(r.elementsHasButton).toBe(false);
});

test('forms: constraint validation blocks submit; novalidate and formnovalidate skip it', async ({ page }) => {
  const { frame } = await openExample(page);
  const blocked = await formScenario(frame, `<form><input name="who" required><sl-button id="target" type="submit">Go</sl-button></form>`, 'click');
  expect(blocked.submits).toEqual([]);
  const formNoValidate = await formScenario(frame, `<form><input name="who" required><sl-button id="target" type="submit" formnovalidate>Go</sl-button></form>`, 'click');
  expect(formNoValidate.submits).toHaveLength(1);
  expect(formNoValidate.submits[0].formNoValidate).toBe(true);
  const noValidate = await formScenario(frame, `<form novalidate><input name="who" required><sl-button id="target" type="submit">Go</sl-button></form>`, 'click');
  expect(noValidate.submits).toHaveLength(1);
});

test('forms: formaction / formmethod overrides reach the submitter; the form attribute finds an outside form', async ({ page }) => {
  const { frame } = await openExample(page);
  const overrides = await formScenario(
    frame,
    `<form action="/a"><sl-button id="target" type="submit" formaction="/b" formmethod="post">Go</sl-button></form>`,
    'click'
  );
  expect(overrides.submits[0].formAction).toMatch(/\/b$/);
  expect(overrides.submits[0].formMethod).toBe('post');
  const outside = await formScenario(
    frame,
    `<form id="ext"><input name="q" value="1"></form><sl-button id="target" type="submit" form="ext" name="act" value="x">Go</sl-button>`,
    'click'
  );
  expect(outside.submits).toEqual([expect.objectContaining({ data: ['q=1', 'act=x'] })]);
});

test('forms: type=reset resets the form and, as in Shoelace, the button value to undefined; type=button and disabled submit nothing', async ({ page }) => {
  const { frame } = await openExample(page);
  const reset = await frame.locator('body').evaluate(async body => {
    const host = document.createElement('div');
    host.innerHTML = `<form><input name="who" value="ada"><sl-button id="reset" type="reset">R</sl-button><sl-button id="go" type="submit" name="act" value="save">S</sl-button></form>`;
    body.append(host);
    const [resetButton, submitButton] = [host.querySelector('#reset'), host.querySelector('#go')];
    await Promise.all([resetButton.updateComplete, submitButton.updateComplete]);
    host.querySelector('input').value = 'changed';
    resetButton.click();
    let data = null;
    host.querySelector('form').addEventListener('submit', event => {
      data = [...new FormData(event.target, event.submitter)].map(([k, v]) => `${k}=${v}`);
      event.preventDefault();
    });
    submitButton.click();
    host.remove();
    return { value: host.querySelector('input').value, submitValueIsUndefined: submitButton.value === undefined, data };
  });
  // Shoelace's form controller assigns the button's (undefined) defaultValue on reset, so the submitter then sends
  // the string "undefined".
  expect(reset).toEqual({ value: 'ada', submitValueIsUndefined: true, data: ['who=ada', 'act=undefined'] });
  const plain = await formScenario(frame, `<form><sl-button id="target">Go</sl-button></form>`, 'click');
  expect(plain.submits).toEqual([]);
  // As in Shoelace there is no disabled guard in the click handler: the disabled inner native button is what keeps
  // both click() and a real pointer click from submitting.
  const disabled = await formScenario(frame, `<form><sl-button id="target" type="submit" disabled>Go</sl-button></form>`, 'click');
  expect(disabled.submits).toEqual([]);
  await frame.locator('body').evaluate(async body => {
    const host = document.createElement('div');
    host.innerHTML = `<form><sl-button id="disabled-submit" type="submit" disabled>Go</sl-button></form>`;
    body.append(host);
    window.__disabledSubmits = 0;
    host.querySelector('form').addEventListener('submit', event => {
      window.__disabledSubmits++;
      event.preventDefault();
    });
    await host.querySelector('sl-button').updateComplete;
  });
  await frame.locator('#disabled-submit').click({ force: true });
  await page.waitForTimeout(100);
  expect(await frame.locator('body').evaluate(() => window.__disabledSubmits)).toBe(0);
});

test('forms: keyboard Enter and Space on a focused submit button submit the form', async ({ page }) => {
  const { frame } = await openExample(page);
  await frame.locator('body').evaluate(async body => {
    const host = document.createElement('div');
    host.id = 'kbd';
    host.innerHTML = `<form><sl-button id="kbd-submit" type="submit" name="act" value="k">Go</sl-button></form>`;
    body.append(host);
    window.__kbdSubmits = 0;
    host.querySelector('form').addEventListener('submit', event => {
      window.__kbdSubmits++;
      event.preventDefault();
    });
    await host.querySelector('sl-button').updateComplete;
  });
  await frame.locator('#kbd-submit').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  expect(await frame.locator('body').evaluate(() => window.__kbdSubmits)).toBe(2);
});

test('validation API: setCustomValidity on a submit button blocks submit and emits a cancelable sl-invalid', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('body').evaluate(async body => {
    const host = document.createElement('div');
    host.innerHTML = `<form><sl-button type="submit">Go</sl-button></form>`;
    body.append(host);
    const el = host.querySelector('sl-button');
    const form = host.querySelector('form');
    await el.updateComplete;
    let submits = 0;
    let invalid = 0;
    form.addEventListener('submit', event => {
      submits++;
      event.preventDefault();
    });
    el.addEventListener('sl-invalid', event => {
      invalid++;
      event.preventDefault();
    });
    const initial = { valid: el.validity.valid, check: el.checkValidity(), formCheck: form.checkValidity(), getForm: el.getForm() === form };
    el.setCustomValidity('nope');
    await el.updateComplete;
    const after = { valid: el.validity.valid, message: el.validationMessage, check: el.checkValidity(), formCheck: form.checkValidity(), dataInvalid: el.hasAttribute('data-invalid') };
    el.click();
    host.remove();
    return { initial, after, submits, invalid };
  });
  expect(r.initial).toEqual({ valid: true, check: true, formCheck: true, getForm: true });
  expect(r.after).toEqual({ valid: false, message: 'nope', check: false, formCheck: false, dataInvalid: true });
  expect(r.submits).toBe(0);
  expect(r.invalid).toBeGreaterThanOrEqual(2);
});

test('rendering: caret, spinner, rel default, reflected-attribute restore and the Shoelace size heights', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('body').evaluate(async body => {
    const host = document.createElement('div');
    host.innerHTML = `
      <sl-button id="s" size="small">S</sl-button><sl-button id="m">M</sl-button><sl-button id="l" size="large">L</sl-button>
      <sl-button id="caret" caret>C</sl-button><sl-button id="load" loading variant="primary">Busy</sl-button>
      <sl-button id="link" href="#x" target="_blank">Link</sl-button><sl-button id="restore" variant="danger">R</sl-button>`;
    body.append(host);
    const all = [...host.querySelectorAll('sl-button')];
    await Promise.all(all.map(el => el.updateComplete));
    const q = id => host.querySelector(`#${id}`);
    const height = id => Math.round(q(id).getBoundingClientRect().height);
    const restore = q('restore');
    restore.removeAttribute('variant');
    await restore.updateComplete;
    const spinner = q('load').shadowRoot.querySelector('sl-spinner');
    const label = q('load').shadowRoot.querySelector('.button__label');
    const out = {
      heights: [height('s'), height('m'), height('l')],
      caretPart: q('caret').shadowRoot.querySelector('[part~="caret"] svg') !== null,
      spinnerDefined: Boolean(spinner && customElements.get('sl-spinner') && spinner.shadowRoot),
      spinnerPart: spinner?.getAttribute('part'),
      labelHidden: getComputedStyle(label).visibility,
      linkTag: q('link').shadowRoot.querySelector('[part~="base"]').localName,
      linkRel: q('link').shadowRoot.querySelector('a').getAttribute('rel'),
      restored: [restore.variant, restore.getAttribute('variant')],
    };
    host.remove();
    return out;
  });
  expect(r.heights).toEqual([30, 40, 50]);
  expect(r.caretPart).toBe(true);
  expect(r.spinnerDefined).toBe(true);
  expect(r.spinnerPart).toBe('spinner');
  expect(r.labelHidden).toBe('hidden');
  expect(r.linkTag).toBe('a');
  expect(r.linkRel).toBe('noreferrer noopener');
  expect(r.restored).toEqual(['default', 'default']);
});

test('every docs example renders in its own document', async ({ page }) => {
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  const titles = await page.locator('iframe.example').evaluateAll(frames => frames.map(f => f.title));
  expect(titles.length).toBeGreaterThanOrEqual(15);
  for (const title of titles) {
    const frame = page.frameLocator(`iframe.example[title="${title}"]`);
    await expect(frame.locator('sl-button').first()).toBeVisible();
    const box = await frame.locator('sl-button').first().boundingBox();
    expect(box.height, title).toBeGreaterThan(20);
  }
});

test('forms (Shoelace parity): a disabled fieldset does not disable the button, and it is not the implicit-submission default', async ({ page }) => {
  const { frame } = await openExample(page);
  const fieldset = await formScenario(
    frame,
    `<form><fieldset disabled><sl-button id="target" type="submit" name="act" value="f">Go</sl-button></fieldset></form>`,
    'click'
  );
  expect(fieldset.submits).toEqual([expect.objectContaining({ data: ['act=f'] })]);
  // Two text fields, so the browser only submits implicitly through a default (native) submit button; there is none.
  await frame.locator('body').evaluate(async body => {
    const host = document.createElement('div');
    host.innerHTML = `<form id="implicit"><input id="implicit-a" name="a"><input name="b"><sl-button type="submit">Go</sl-button></form>`;
    body.append(host);
    window.__implicitSubmits = 0;
    host.querySelector('form').addEventListener('submit', event => {
      window.__implicitSubmits++;
      event.preventDefault();
    });
    await host.querySelector('sl-button').updateComplete;
  });
  await frame.locator('#implicit-a').focus();
  await page.keyboard.press('Enter');
  expect(await frame.locator('body').evaluate(() => window.__implicitSubmits)).toBe(0);
});

test('core extension kept: a toggle button flips pressed / aria-pressed, emits change and does not submit', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('body').evaluate(async body => {
    const host = document.createElement('div');
    host.innerHTML = `<form><sl-button toggle type="submit">T</sl-button></form>`;
    body.append(host);
    const el = host.querySelector('sl-button');
    await el.updateComplete;
    let changes = 0;
    let submits = 0;
    el.addEventListener('change', () => changes++);
    host.querySelector('form').addEventListener('submit', event => {
      submits++;
      event.preventDefault();
    });
    el.click();
    await el.updateComplete;
    const out = { pressed: el.pressed, aria: el.shadowRoot.querySelector('.button').getAttribute('aria-pressed'), changes, submits };
    host.remove();
    return out;
  });
  expect(r).toEqual({ pressed: true, aria: 'true', changes: 1, submits: 0 });
});

test('inherited core ready event: dispatched once on the element after the first update, not bubbling or composed', async ({ page }) => {
  const { frame } = await openExample(page);
  const r = await frame.locator('body').evaluate(async body => {
    const el = document.createElement('sl-button');
    const seen = [];
    let bubbled = 0;
    el.addEventListener('ready', event => seen.push({ bubbles: event.bubbles, composed: event.composed }));
    body.addEventListener('ready', () => bubbled++);
    body.append(el);
    await el.updateComplete;
    el.variant = 'primary';
    await el.updateComplete;
    el.remove();
    return { seen, bubbled };
  });
  expect(r).toEqual({ seen: [{ bubbles: false, composed: false }], bubbled: 0 });
});
