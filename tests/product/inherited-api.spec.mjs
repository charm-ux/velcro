// Per-component rule for the inherited template-bound API in the manifest: an inherited core CSS custom property is
// listed exactly when it still has an effect on the Velcro element (core's styles are kept and their selector still
// matches the Velcro template), and an inherited core slot or part is listed exactly when the Velcro template renders
// it. Measured in the browser: each candidate is set on the host and every computed style in the shadow tree and of
// the slotted content is compared, in the default state, with each reflected boolean attribute set, and under real
// :hover, :active (pointer held) and :focus-visible (keyboard modality) interaction in each of those.
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
  'sl-mutation-observer': '<div>x</div>',
  'sl-resize-observer': '<div>x</div>',
  'sl-visually-hidden': 'Hidden',
  'sl-switch': 'Label<span slot="help-text">Help</span>',
};
const ATTRS = { 'sl-progress-bar': { value: '40' }, 'sl-progress-ring': { value: '40' }, 'sl-format-bytes': { value: '1000' }, 'sl-format-number': { value: '1000' } };
// One valid value of each kind a core custom property takes: length, color, border style, border shorthand, a visible
// box shadow, time, keyword, number, alignment.
const VALUES = ['37px', 'rgb(1, 2, 3)', 'dotted', '3px solid rgb(1, 2, 3)', '2px 2px rgb(1, 2, 3)', '3s', 'none', '0.25', 'flex-end'];

for (const [tag, decl] of elements) {
  test(`${tag}: inherited CSS custom properties, slots and parts are listed exactly when they still apply`, async ({ page }) => {
    // The probe measures every candidate property with every value in every state. sl-switch (55 core candidates,
    // 7 boolean states) takes about 1 minute on a fast workstation and about 2 at half that CPU speed, so 2 minutes is
    // too tight for slower runners.
    test.setTimeout(240000);
    const parent = coreDecls.get(decl.superclass.name);
    expect(parent, `${tag} superclass in core's manifest`).toBeTruthy();
    const listed = key => (decl[key] ?? []).filter(x => x.inheritedFrom).map(x => x.name).sort();
    const own = key => new Set((decl[key] ?? []).filter(x => !x.inheritedFrom).map(x => x.name));
    const booleans = (decl.attributes ?? []).filter(a => a.type?.text?.replace(/ \| undefined/, '') === 'boolean').map(a => a.name);

    await page.goto('/components/button', { waitUntil: 'networkidle' });
    await page.evaluate(t => customElements.whenDefined(t), tag);
    const candidates = (parent.cssProperties ?? []).map(p => p.name).filter(n => !own('cssProperties').has(n));
    await page.evaluate(async ({ tag, content, attrs }) => {
      const host = document.createElement(tag);
      host.id = 'probe';
      // On top of the page, so pointer states (:hover, :active) reach it.
      host.style.cssText = 'position: fixed; top: 8px; left: 8px; z-index: 2147483647;';
      for (const [k, v] of Object.entries(attrs)) host.setAttribute(k, v);
      host.innerHTML = content;
      document.body.prepend(host);
      await host.updateComplete;
      // Running animations and transitions would make snapshots differ: freeze them at their start.
      const freeze = new CSSStyleSheet();
      freeze.replaceSync('*, :host { animation-play-state: paused !important; animation-delay: 0s !important; transition: none !important; }');
      host.shadowRoot.adoptedStyleSheets = [...host.shadowRoot.adoptedStyleSheets, freeze];
      const nodes = () => {
        const out = [host, ...host.children];
        const walk = root => { for (const el of root.querySelectorAll('*')) { out.push(el); if (el.shadowRoot) walk(el.shadowRoot); } };
        walk(host.shadowRoot);
        return out;
      };
      const snapshot = () => nodes().map(el => {
        const cs = getComputedStyle(el);
        return [...cs].filter(p => !p.startsWith('--')).map(p => `${p}:${cs.getPropertyValue(p)}`).join(';');
      }).join('|');
      // getComputedStyle recalculates synchronously, so the current state (including a held pointer) is measured as is.
      window.probeMeasure = (candidates, values) => {
        const base = snapshot();
        const hit = [];
        for (const name of candidates) {
          for (const v of values) {
            host.style.setProperty(name, v);
            const changed = snapshot() !== base;
            host.style.removeProperty(name);
            if (changed) { hit.push(name); break; }
          }
        }
        return hit;
      };
      window.probeState = async (attr, on) => { host.toggleAttribute(attr, on); await host.updateComplete; };
    }, { tag, content: CONTENT[tag] ?? '', attrs: ATTRS[tag] ?? {} });

    const effective = new Set();
    const measure = async label => {
      for (const name of await page.evaluate(([c, v]) => window.probeMeasure(c, v), [candidates.filter(c => !effective.has(c)), VALUES])) {
        effective.add(name);
        found.push(`${name} (${label})`);
      }
    };
    const found = [];
    // A display: contents host has no box of its own; point at its slotted content instead.
    const box = (await page.locator('#probe').boundingBox()) ?? (await page.locator('#probe > *').first().boundingBox());
    const center = [box.x + box.width / 2, box.y + box.height / 2];
    // Default, each reflected boolean attribute, and the interaction states :hover, :active (pointer held down) and
    // :focus-visible (keyboard focus), each alone and combined with each boolean attribute.
    for (const state of [null, ...booleans]) {
      if (state) await page.evaluate(a => window.probeState(a, true), state);
      await measure(state ?? 'default');
      await page.mouse.move(...center);
      await measure(`${state ?? 'default'} + :hover`);
      await page.mouse.down();
      await measure(`${state ?? 'default'} + :active`);
      await page.mouse.up();
      await page.mouse.move(0, 0);
      await page.evaluate(() => { document.activeElement?.blur?.(); document.getElementById('probe').blur?.(); });
      await page.keyboard.down('Shift');
      await page.keyboard.up('Shift');
      await page.evaluate(() => document.getElementById('probe').focus?.());
      await measure(`${state ?? 'default'} + :focus-visible`);
      await page.evaluate(() => document.getElementById('probe').blur?.());
      if (state) await page.evaluate(a => window.probeState(a, false), state);
    }
    const result = await page.evaluate(({ slots, parts }) => {
      const shadow = document.getElementById('probe').shadowRoot;
      return {
        slots: slots.filter(s => shadow.querySelector(s ? `slot[name="${s}"]` : 'slot:not([name])')).sort(),
        parts: parts.filter(p => [...shadow.querySelectorAll('[part]')].some(el => el.getAttribute('part').split(/\s+/).includes(p))).sort(),
      };
    }, {
      slots: (parent.slots ?? []).map(s => s.name).filter(n => !own('slots').has(n)),
      parts: (parent.cssParts ?? []).map(p => p.name).filter(n => !own('cssParts').has(n)),
    });
    result.cssProperties = [...effective].sort();
    test.info().annotations.push({ type: 'effective', description: found.join(', ') });
    expect({ cssProperties: listed('cssProperties'), slots: listed('slots'), parts: listed('cssParts') }).toEqual(result);
    for (const p of (decl.cssProperties ?? []).filter(x => x.inheritedFrom)) expect(p.inheritedFrom.package).toBe('@charm-ux/core');
  });
}
