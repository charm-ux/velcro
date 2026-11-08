// Negative controls for the inherited-API probe (support/probe.mjs): it must keep measuring every candidate on its own, so a
// regression where two inherited custom properties interact is still caught, in every engine.
import { expect, test } from '@playwright/test';
import { makeProbe } from './support/probe.mjs';

const VALUES = ['37px', 'rgb(1, 2, 3)', 'dotted', '3px solid rgb(1, 2, 3)', '2px 2px rgb(1, 2, 3)', '3s', 'none', '0.25', 'flex-end'];

const setup = (page, css) => page.evaluate(async ({ source, css }) => {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  const host = document.createElement('x-probe-host');
  customElements.define('x-probe-host', class extends HTMLElement {
    constructor() { super(); this.attachShadow({ mode: 'open' }).innerHTML = '<div part="inner">x</div>'; this.shadowRoot.adoptedStyleSheets = [sheet]; }
  });
  document.body.append(host);
  window.probe = (0, eval)(`(${source})`)(host);
}, { source: makeProbe.toString(), css });

test('a candidate whose effect cancels against another set at the same time is still detected on its own', async ({ page }) => {
  await page.setContent('<!DOCTYPE html><html><body></body></html>');
  // Setting both to the same length leaves the padding at 40px, so a group measurement sees no change; each alone does.
  await setup(page, ':host { display: block; } div { padding-left: calc(40px + var(--a, 0px) - var(--b, 0px)); }');
  expect(await page.evaluate(v => window.probe.measure(['--a', '--b', '--unused'], v), VALUES)).toEqual(['--a', '--b']);
  const together = await page.evaluate(v => {
    const host = document.querySelector('x-probe-host');
    const read = () => getComputedStyle(host.shadowRoot.querySelector('div')).paddingLeft;
    const before = read();
    host.style.setProperty('--a', v); host.style.setProperty('--b', v);
    return [before, read()];
  }, '37px');
  expect(together).toEqual(['40px', '40px']);
});

test('candidates that feed one fallback chain, and unrelated ones, are told apart', async ({ page }) => {
  await page.setContent('<!DOCTYPE html><html><body></body></html>');
  await setup(page, ':host { display: block; } div { color: var(--first, var(--second, rgb(9, 9, 9))); }');
  expect(await page.evaluate(v => window.probe.measure(['--second', '--first', '--other'], v), VALUES)).toEqual(['--second', '--first']);
});

// A component can render another that animates in its own shadow root (sl-button renders an sl-spinner while loading),
// with CSS or with the Web Animations API. WebKit samples a running animation at every read, so an unfrozen one makes
// every candidate look effective; in every engine it moves between measurements. The probe must freeze nested shadow
// roots too, not only the host's, and pause script-driven animations, which no style sheet pauses. A transition in a
// nested shadow root would also hide a candidate's effect behind its start value. A pause only scheduled (pending until
// the next animation update) is not a freeze yet: every animation must be paused, and not pending, once measured.
test('animations and transitions in a nested shadow root neither count as an effect nor hide one', async ({ page }) => {
  await page.setContent('<!DOCTYPE html><html><body></body></html>');
  const result = await page.evaluate(async source => {
    customElements.define('x-probe-spin', class extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' }).innerHTML = '<style>@keyframes spin { to { transform: rotate(360deg); } }'
          + ' i { display: block; width: 10px; height: 10px; animation: spin 1s linear infinite; }'
          + ' u { display: block; padding-left: var(--used, 0px); transition: padding-left 10s linear; }</style><i></i><b>x</b><u>y</u>';
        this.shadowRoot.querySelector('b').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1000, iterations: Infinity });
      }
    });
    customElements.define('x-probe-outer', class extends HTMLElement {
      constructor() { super(); this.attachShadow({ mode: 'open' }).innerHTML = '<div part="inner">x</div><x-probe-spin></x-probe-spin>'; }
    });
    const host = document.createElement('x-probe-outer');
    document.body.append(host);
    const inner = host.shadowRoot.querySelector('x-probe-spin').shadowRoot;
    const read = () => [getComputedStyle(inner.querySelector('i')).transform, getComputedStyle(inner.querySelector('b')).opacity];
    const later = () => new Promise(resolve => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(resolve)), 100));
    await later();
    const probe = (0, eval)(`(${source})`)(host);
    const hit = probe.measure(['--unused', '--used', '--also-unused'], ['37px', 'rgb(1, 2, 3)', 'dotted', 'none']);
    const animations = [...inner.querySelectorAll('*')].flatMap(el => el.getAnimations());
    const unfrozen = animations.filter(animation => animation.playState !== 'paused' || animation.pending).length;
    const before = read();
    await later();
    const after = read();
    return { hit, animations: animations.length, unfrozen, moved: { css: after[0] !== before[0], script: after[1] !== before[1] } };
  }, makeProbe.toString());
  expect(result).toEqual({ hit: ['--used'], animations: 2, unfrozen: 0, moved: { css: false, script: false } });
});
