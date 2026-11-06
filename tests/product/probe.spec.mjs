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
