import { expect, test } from '@playwright/test';
import { buildFixtures, gotoBlank } from './support/fixtures.mjs';

let outDir;
test.beforeAll(async () => {
  outDir = await buildFixtures({
    compat: `
      export * from 'velcro-internal:internal/shoelace-compat';
      export { CharmElement } from 'core-internal:base/charm-element/charm-element';
    `,
  });
});
test.beforeEach(async ({ page }) => gotoBlank(page, outDir));

test('captures inherited reflected values at the first attribute callback, not construction or the first update', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { CharmElement, ShoelaceCompat, restoreReflectedProperties } = await import('/compat.js');
    let nonReflectingReads = 0;
    class Parent extends CharmElement {
      static properties = {
        count: { type: Number, reflect: true },
        optional: { reflect: true },
        unreflected: {},
      };
      constructor() { super(); this.count = 0; }
      get unreflected() { nonReflectingReads++; return 'unused'; }
    }
    class Probe extends ShoelaceCompat(Parent, { lang: true, reflected: true }) {
      willUpdate(changed) { restoreReflectedProperties(this, changed); }
      render() { return this.count; }
    }
    customElements.define('sl-compat-probe', Probe);
    const first = new Probe();
    const second = new Probe();
    first.count = 7;
    first.optional = 'recorded';
    first.setAttribute('lang', 'en');
    first.count = 9;
    first.optional = 'later';
    second.setAttribute('lang', 'fr');
    const readsAtCapture = nonReflectingReads;
    document.body.append(first, second);
    await Promise.all([first.updateComplete, second.updateComplete]);
    first.removeAttribute('count');
    first.removeAttribute('optional');
    second.removeAttribute('count');
    second.optional = null;
    await Promise.all([first.updateComplete, second.updateComplete]);
    return {
      first: [first.count, first.optional, first.getAttribute('count'), first.getAttribute('optional')],
      second: [second.count, second.optional],
      readsAtCapture,
    };
  });
  expect(result).toEqual({ first: [7, 'recorded', '7', 'recorded'], second: [0, null], readsAtCapture: 0 });
});

test('does not capture before the first observed attribute, and keeps restoration at the caller lifecycle point', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { CharmElement, ShoelaceCompat, restoreReflectedProperties } = await import('/compat.js');
    const seen = [];
    class Parent extends CharmElement {
      static properties = { value: { reflect: true } };
      constructor() { super(); this.value = 'default'; }
      willUpdate() { seen.push('parent'); }
    }
    class Probe extends ShoelaceCompat(Parent, { reflected: true }) {
      willUpdate(changed) {
        seen.push(this.value);
        restoreReflectedProperties(this, changed);
        seen.push(this.value);
      }
    }
    customElements.define('sl-compat-order', Probe);
    const element = new Probe();
    element.value = null;
    document.body.append(element);
    await element.updateComplete;
    const beforeAttribute = element.value;
    element.value = 'snapshot';
    element.setAttribute('dir', 'rtl');
    element.value = undefined;
    await element.updateComplete;
    return { beforeAttribute, value: element.value, seen };
  });
  expect(result).toEqual({ beforeAttribute: null, value: 'snapshot', seen: [null, null, undefined, 'snapshot'] });
});

test('language-only compatibility retains computed core direction and does not restore reflected properties', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { CharmElement, ShoelaceCompat, restoreReflectedProperties } = await import('/compat.js');
    class Probe extends ShoelaceCompat(CharmElement, { lang: true }) {
      static properties = { value: { reflect: true } };
      constructor() { super(); this.value = 'default'; }
      willUpdate(changed) { restoreReflectedProperties(this, changed); }
    }
    customElements.define('sl-compat-language', Probe);
    const element = new Probe();
    document.body.append(element);
    await element.updateComplete;
    const initial = [element.lang, element.dir];
    element.lang = 'fr';
    await element.updateComplete;
    const language = [element.lang, element.getAttribute('lang')];
    element.removeAttribute('value');
    await element.updateComplete;
    return { initial, language, value: element.value };
  });
  expect(result).toEqual({ initial: [undefined, 'ltr'], language: ['fr', null], value: null });
});
