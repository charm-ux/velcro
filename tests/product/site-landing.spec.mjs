// The landing page: hero, feature rows, install command and a showcase that renders every catalog component live.
import { expect, test } from '@playwright/test';
import { readCatalog } from '../../scripts/site/catalog.mjs';
import { openDocs } from './support/loaded.mjs';

const catalog = readCatalog();

test('the prerendered landing page carries the hero, the install command and one showcase tile per catalog component', async ({ request }) => {
  const html = await (await request.get('/')).text();
  expect(html).toContain('<title>Velcro</title>');
  expect(html).toContain('pnpm --filter @charm-ux/velcro run build');
  // The component count comes from the catalog.
  expect(html).toMatch(new RegExp(`(?:<!--[^>]*-->)?${catalog.length}(?:<!--[^>]*-->)? components so far`));
  for (const c of catalog) {
    expect(html, c.name).toContain(`data-component="${c.name}"`);
    expect(html, c.name).toContain(`<${c.tag}`);
    expect(html, c.name).toContain(`href="/components/${c.name}"`);
  }
  // Velcro elements are plain markup in the prerendered page: no server-side shadow root for them.
  expect(html).not.toMatch(/<sl-[a-z-]+[^>]*>\s*<template shadowroot/);
  // No recipe branding or upstream Shoelace runtime.
  expect(html).not.toMatch(/beatzball|supernova|starlight/i);
  expect(html).not.toMatch(/(src|href)="[^"]*shoelace/i);
});

test('showcase: every catalog component is rendered live, upgraded, and links to its docs page', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await openDocs(page, '/');
  const tiles = page.locator('#showcase [data-component]');
  await expect(tiles).toHaveCount(catalog.length);
  expect(await tiles.evaluateAll(els => els.map(e => e.dataset.component))).toEqual(catalog.map(c => c.name));
  for (const c of catalog) {
    const tile = page.locator(`#showcase [data-component="${c.name}"]`);
    const element = tile.locator(c.tag).first();
    await expect(element, c.name).toBeAttached();
    const upgraded = await element.evaluate(async el => {
      await customElements.whenDefined(el.localName);
      await el.updateComplete;
      return el.shadowRoot !== null && el.shadowRoot.childNodes.length > 0;
    });
    expect(upgraded, c.name).toBe(true);
    await expect(tile.getByRole('link', { name: c.title, exact: true })).toHaveAttribute('href', `/components/${c.name}`);
  }
  expect(errors).toEqual([]);
});

test('hero, feature rows and the copy button', async ({ page, context, browserName }) => {
  // Only Chromium has clipboard permissions, so it reads the real clipboard. In every engine the page's writeText call is also
  // recorded (and still forwarded), which is the engine-neutral proof of what the button copies.
  if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => {
    const original = navigator.clipboard.writeText.bind(navigator.clipboard);
    window.__copied = [];
    navigator.clipboard.writeText = text => { window.__copied.push(text); return original(text); };
  });
  await openDocs(page, '/');
  await expect(page.getByRole('heading', { level: 1, name: 'Velcro' })).toBeVisible();
  await expect(page.locator('.row')).toHaveCount(3);
  await page.getByRole('button', { name: 'Copy' }).click();
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
  expect(await page.evaluate(() => window.__copied)).toEqual(['pnpm --filter @charm-ux/velcro run build']);
  if (browserName === 'chromium') expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('pnpm --filter @charm-ux/velcro run build');
  await page.getByRole('link', { name: 'See every component' }).click();
  expect(new URL(page.url()).hash).toBe('#showcase');
});
