// Per-component rule for the inherited template-bound API in the manifest: an inherited core CSS custom property is
// listed exactly when it still has an effect on the Velcro element (core's styles are kept and their selector still
// matches the Velcro template), and an inherited core slot or part is listed exactly when the Velcro template renders
// it. Measured in the browser: each candidate is set on the host and every computed style in the shadow tree and of
// the slotted content is compared, in the default state and with each reflected boolean attribute set.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, test } from '@playwright/test';
import { customElements, readJson, velcroManifestPath } from '../../scripts/api/model.mjs';

const require = createRequire(new URL('../../packages/velcro/package.json', import.meta.url));
const core = JSON.parse(readFileSync(require.resolve('@charm-ux/core/custom-elements.json'), 'utf8'));
const coreDecls = new Map(core.modules.flatMap(m => m.declarations ?? []).map(d => [d.name, d]));
const elements = customElements(readJson(velcroManifestPath));

// Content that exercises each component's slots, including the slotted icon rules of core's button styles.
const CONTENT = {
  'sl-button': '<svg slot="prefix" viewBox="0 0 10 10"></svg><svg viewBox="0 0 10 10"></svg>Label<span slot="suffix">s</span>',
  'sl-badge': 'Badge',
  'sl-card': '<div slot="header">h</div>Body<div slot="footer">f</div>',
  'sl-progress-bar': 'Label',
  'sl-progress-ring': 'Label',
  'sl-resize-observer': '<div>x</div>',
  'sl-visually-hidden': 'Hidden',
};
const ATTRS = { 'sl-progress-bar': { value: '40' }, 'sl-progress-ring': { value: '40' }, 'sl-format-bytes': { value: '1000' }, 'sl-format-number': { value: '1000' } };
const VALUES = ['37px', 'rgb(1, 2, 3)', 'dotted', '3s', 'none', '0.25', 'flex-end'];

for (const [tag, decl] of elements) {
  test(`${tag}: inherited CSS custom properties, slots and parts are listed exactly when they still apply`, async ({ page }) => {
    test.setTimeout(120000);
    const parent = coreDecls.get(decl.superclass.name);
    expect(parent, `${tag} superclass in core's manifest`).toBeTruthy();
    const listed = key => (decl[key] ?? []).filter(x => x.inheritedFrom).map(x => x.name).sort();
    const own = key => new Set((decl[key] ?? []).filter(x => !x.inheritedFrom).map(x => x.name));
    const booleans = (decl.attributes ?? []).filter(a => a.type?.text?.replace(/ \| undefined/, '') === 'boolean').map(a => a.name);

    await page.goto('/components/button', { waitUntil: 'networkidle' });
    await page.evaluate(t => customElements.whenDefined(t), tag);
    const result = await page.evaluate(async ({ tag, content, attrs, booleans, candidates, slots, parts, values }) => {
      const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const host = document.createElement(tag);
      for (const [k, v] of Object.entries(attrs)) host.setAttribute(k, v);
      host.innerHTML = content;
      document.body.append(host);
      await host.updateComplete;
      await frame();
      const nodes = () => {
        const out = [host, ...host.children];
        const walk = root => { for (const el of root.querySelectorAll('*')) { out.push(el); if (el.shadowRoot) walk(el.shadowRoot); } };
        walk(host.shadowRoot);
        return out;
      };
      // Running animations and transitions would make snapshots differ: freeze them at their start.
      const freeze = new CSSStyleSheet();
      freeze.replaceSync('*, :host { animation-play-state: paused !important; animation-delay: 0s !important; transition: none !important; }');
      host.shadowRoot.adoptedStyleSheets = [...host.shadowRoot.adoptedStyleSheets, freeze];
      const snapshot = () => nodes().map(el => {
        const cs = getComputedStyle(el);
        return [...cs].filter(p => !p.startsWith('--')).map(p => `${p}:${cs.getPropertyValue(p)}`).join(';');
      }).join('|');
      const effective = new Set();
      for (const state of [null, ...booleans]) {
        if (state) host.setAttribute(state, '');
        await host.updateComplete;
        await frame();
        const base = snapshot();
        for (const name of candidates) {
          if (effective.has(name)) continue;
          for (const v of values) {
            // getComputedStyle recalculates synchronously, so no frame is needed between setting and reading.
            host.style.setProperty(name, v);
            const changed = snapshot() !== base;
            host.style.removeProperty(name);
            if (changed) { effective.add(name); break; }
          }
        }
        await frame();
        if (state) host.removeAttribute(state);
      }
      const shadow = host.shadowRoot;
      const renderedSlots = slots.filter(s => shadow.querySelector(s ? `slot[name="${s}"]` : 'slot:not([name])'));
      const renderedParts = parts.filter(p => [...shadow.querySelectorAll('[part]')].some(el => el.getAttribute('part').split(/\s+/).includes(p)));
      host.remove();
      return { cssProperties: [...effective].sort(), slots: renderedSlots.sort(), parts: renderedParts.sort() };
    }, {
      tag, content: CONTENT[tag] ?? '', attrs: ATTRS[tag] ?? {}, booleans, values: VALUES,
      candidates: (parent.cssProperties ?? []).map(p => p.name).filter(n => !own('cssProperties').has(n)),
      slots: (parent.slots ?? []).map(s => s.name).filter(n => !own('slots').has(n)),
      parts: (parent.cssParts ?? []).map(p => p.name).filter(n => !own('cssParts').has(n)),
    });
    expect({ cssProperties: listed('cssProperties'), slots: listed('slots'), parts: listed('cssParts') }).toEqual(result);
    for (const p of (decl.cssProperties ?? []).filter(x => x.inheritedFrom)) expect(p.inheritedFrom.package).toBe('@charm-ux/core');
  });
}
