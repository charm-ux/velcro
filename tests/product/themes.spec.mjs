import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { openDocs } from './support/loaded.mjs';

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const SOURCES = ['light', 'dark'];

// SHA-256 of Shoelace 2.20.1 src/themes/<name>.css. Each Velcro theme is that file with a provenance comment on top and
// its `/* _utility.css */` marker replaced by src/themes/_utility.css, as Shoelace's theme build does for its dist themes.
const UPSTREAM_SHA256 = {
  light: '2f9e798c64b04a92ef41ae4d4a1a0392a29124ce35817fc5310c045407783147',
  dark: 'd326a50fa1cae6fcb6919cd6d660d66a7a78cba8dff57366c0cc7b4ffacc88fa',
};
// SHA-256 of Shoelace 2.20.1 src/themes/_utility.css (the toast stack and scroll lock rules).
const UTILITY_SHA256 = '1a3801c609954e832dcd6bcb9dd58ac44a8f0878e2646eba2f94adb8c8c3b539';
const UTILITY_MARKER = '/* _utility.css */\n';
// The embedded utility file runs from its own leading comment to the end of the theme.
const UTILITY_START = '/*\n * This file contains utility classes';
const splitUtility = css => {
  const at = css.indexOf(UTILITY_START);
  expect(at, 'embedded _utility.css').toBeGreaterThan(0);
  return { theme: css.slice(0, at), utility: css.slice(at) };
};

const DARK_EXPECTED = {
  cardPanel: 'rgb(36, 36, 40)',
  badgeNeutral: 'rgb(142, 142, 154)',
  buttonDefault: 'rgb(26, 26, 30)',
  progressTrack: 'rgb(54, 54, 59)',
  skeleton: 'rgb(54, 54, 59)',
  colorScheme: 'dark',
};

const sha = text => createHash('sha256').update(text).digest('hex');
const stripHeader = css => css.replace(/^\/\*[\s\S]*?\*\/\n/, '');

function parseTheme(css) {
  const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const block = body.match(/^([^{]+)\{([\s\S]*)\}\s*$/);
  const selectors = block[1].split(',').map(s => s.trim());
  const tokens = new Map();
  let colorScheme = null;
  for (const [, name, value] of block[2].matchAll(/(--[\w-]+|color-scheme)\s*:\s*([^;]+);/g)) {
    const v = value.replace(/\s+/g, ' ').trim();
    if (name === 'color-scheme') colorScheme = v;
    else {
      expect(tokens.has(name), `duplicate ${name}`).toBe(false);
      tokens.set(name, v);
    }
  }
  return { selectors, colorScheme, tokens };
}

for (const name of SOURCES) {
  test(`${name} theme is identical to Shoelace 2.20.1's built theme (same selectors, color-scheme, token values and utility rules) apart from the provenance header`, () => {
    const css = read(`packages/velcro/themes/${name}.css`);
    expect(css).toMatch(/^\/\*\n \* Velcro \w+ theme\. Copied from Shoelace v2\.20\.1/);
    expect(css).toContain('THIRD_PARTY_NOTICES.md');
    const { theme, utility } = splitUtility(stripHeader(css));
    expect(sha(theme + UTILITY_MARKER)).toBe(UPSTREAM_SHA256[name]);
    expect(sha(utility)).toBe(UTILITY_SHA256);
  });
}

test('light and dark define exactly the same tokens, with the upstream selectors and color-scheme', () => {
  const light = parseTheme(splitUtility(read('packages/velcro/themes/light.css')).theme);
  const dark = parseTheme(splitUtility(read('packages/velcro/themes/dark.css')).theme);
  expect(light.tokens.size).toBeGreaterThan(300);
  expect([...dark.tokens.keys()].sort()).toEqual([...light.tokens.keys()].sort());
  expect(light.selectors).toEqual([':root', ':host', '.sl-theme-light']);
  expect(dark.selectors).toEqual([':host', '.sl-theme-dark']);
  expect(light.colorScheme).toBe('light');
  expect(dark.colorScheme).toBe('dark');
});

async function openFrame(page) {
  await openDocs(page, '/components/card');
  const frame = page.frameLocator('iframe.example');
  await expect(frame.locator('#demo-basic')).toBeVisible();
  await frame.locator('#demo-basic').evaluate(() => customElements.whenDefined('sl-card'));
  return frame;
}

// Builds one light row (no theme class, the iframe default) and one dark row inside the example document, then reads
// computed values from real components. Every expected value is also asserted literally below.
function measure() {
  const make = cls => {
    const row = document.createElement('div');
    if (cls) row.className = cls;
    row.innerHTML = `
      <sl-card></sl-card><sl-badge variant="neutral">n</sl-badge><sl-button>b</sl-button><sl-button size="small">s</sl-button><sl-button size="large">l</sl-button>
      <sl-progress-bar value="50"></sl-progress-bar><sl-skeleton></sl-skeleton><i class="probe"></i>`;
    document.body.append(row);
    return row;
  };
  const read = row => {
    const part = (tag, p) => row.querySelector(tag).shadowRoot.querySelector(`[part~="${p}"]`);
    const bg = node => getComputedStyle(node).backgroundColor;
    return {
      cardPanel: bg(part('sl-card', 'base')),
      badgeNeutral: bg(part('sl-badge', 'base')),
      buttonDefault: bg(part('sl-button', 'base')),
      progressTrack: bg(part('sl-progress-bar', 'base')),
      skeleton: bg(part('sl-skeleton', 'indicator')),
      colorScheme: getComputedStyle(row).colorScheme,
    };
  };
  const buttonMetrics = row => {
    const metrics = ['small', 'medium', 'large'].map(size => {
      const host = size === 'medium' ? row.querySelector('sl-button') : row.querySelector(`sl-button[size="${size}"]`);
      const cs = getComputedStyle(host.shadowRoot.querySelector('[part~="base"]'));
      return [size, { fontSize: cs.fontSize, radius: cs.borderTopLeftRadius }];
    });
    return Object.fromEntries(metrics);
  };
  const light = make('');
  const lightExplicit = make('sl-theme-light');
  const dark = make('sl-theme-dark');
  return Promise.all(['sl-card', 'sl-badge', 'sl-button', 'sl-progress-bar', 'sl-skeleton'].map(t => customElements.whenDefined(t)))
    .then(() => Promise.all([...document.querySelectorAll('sl-card,sl-badge,sl-button,sl-progress-bar,sl-skeleton')].map(el => el.updateComplete)))
    .then(() => ({
      light: read(light), lightExplicit: read(lightExplicit), dark: read(dark),
      lightButtons: buttonMetrics(light), darkButtons: buttonMetrics(dark),
    }));
}

test('real components resolve Shoelace dark colors under .sl-theme-dark, and light colors and button sizes match Shoelace light values', async ({ page }) => {
  const frame = await openFrame(page);
  const result = await frame.locator('body').evaluate(measure);

  // The default (unclassed) document and an explicit .sl-theme-light row agree, and match Shoelace's light values.
  // This does not prove the appearance is unchanged from before the full light theme was added: it is not.
  expect(result.lightExplicit).toEqual(result.light);
  expect(result.light).toEqual({
    cardPanel: 'rgb(255, 255, 255)',
    badgeNeutral: 'rgb(82, 82, 91)',
    buttonDefault: 'rgb(255, 255, 255)',
    progressTrack: 'rgb(228, 228, 231)',
    skeleton: 'rgb(228, 228, 231)',
    colorScheme: 'light',
  });
  // Button typography and radii per size from the Shoelace light tokens (--sl-button-font-size-*,
  // --sl-input-border-radius-*): 12/14/16px text and a 4px radius. Dark changes neither.
  const BUTTON_SIZES = {
    small: { fontSize: '12px', radius: '4px' },
    medium: { fontSize: '14px', radius: '4px' },
    large: { fontSize: '16px', radius: '4px' },
  };
  expect(result.lightButtons).toEqual(BUTTON_SIZES);
  expect(result.darkButtons).toEqual(BUTTON_SIZES);
  // Dark: neutral-0/50/200/600 of Shoelace's dark theme.
  expect(result.dark).toEqual(DARK_EXPECTED);
});
