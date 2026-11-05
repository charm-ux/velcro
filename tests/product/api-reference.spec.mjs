// Every component page's API tables must match Velcro's Custom Elements Manifest: same rows in the same order, and the
// same attribute, type, default, reflection, signature, detail and origin cells. Fails when a page drifts from the CEM.
import { expect, test } from '@playwright/test';
import { apiModel, customElements, readJson, velcroManifestPath } from '../../scripts/api/model.mjs';
import { readCatalog } from '../../scripts/site/catalog.mjs';

const elements = customElements(readJson(velcroManifestPath));
const source = origin => (origin ? `Inherited ${origin}` : 'Velcro');
const cell = value => value || '-';

const expected = model => ({
  attributes: model.properties.map(p => [p.name || '-', cell(p.attribute), cell(p.type), cell(p.default), p.reflects ? 'yes' : 'no', p.description, source(p.origin)]),
  methods: model.methods.map(m => [m.name, m.signature, m.description, source(m.origin)]),
  events: model.events.map(e => [e.name, cell(e.type), e.description, source(e.origin)]),
  slots: model.slots.map(s => [s.name || '(default)', s.description, source(s.origin)]),
  parts: model.parts.map(p => [p.name, p.description, source(p.origin)]),
  'css-properties': model.cssProperties.map(p => [p.name, cell(p.default), p.description, source(p.origin)]),
});

for (const { name, tag } of readCatalog()) {
  test(`${tag}: the API tables on /components/${name} match the Custom Elements Manifest`, async ({ page }) => {
    // Litro's client router remounts the page component once after load; let it settle, and retry reads below.
    await page.goto(`/components/${name}`, { waitUntil: 'networkidle' });
    const want = expected(apiModel(elements.get(tag)));
    for (const [section, rows] of Object.entries(want)) {
      const heading = page.locator(`h2#${section}`);
      await expect(heading).toHaveCount(1);
      const table = page.locator(`table[data-api="${section}"]`);
      if (!rows.length) {
        await expect(table).toHaveCount(0);
        await expect(page.locator(`h2#${section} + p`)).toHaveText('None.');
        continue;
      }
      await expect(table).toHaveCount(1);
      await expect.poll(() => table.locator('tbody tr').evaluateAll(trs =>
        trs.map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent.replace(/\s+/g, ' ').trim()))), { message: `${tag} ${section}` })
        .toEqual(rows.map(r => r.map(c => String(c).replace(/\s+/g, ' ').trim())));
    }
  });
}

test('inherited members name their core origin on the page', async ({ page }) => {
  await page.goto('/components/button', { waitUntil: 'networkidle' });
  const disabled = page.locator('table[data-api="attributes"] tr[data-name="disabled"] td').last();
  await expect(disabled).toHaveText('Inherited from @charm-ux/core CoreButton');
  const variant = page.locator('table[data-api="attributes"] tr[data-name="variant"] td').last();
  await expect(variant).toHaveText('Velcro');
});
