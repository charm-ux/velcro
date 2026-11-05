import { html, nothing, type TemplateResult } from 'lit';
import { api, type ApiModel } from './api.generated.js';

/** The API sections every component page shows, in order. `attributes` holds the properties and their attributes. */
export const apiSections = [
  ['attributes', 'Attributes and properties'],
  ['methods', 'Methods'],
  ['events', 'Events'],
  ['slots', 'Slots'],
  ['parts', 'CSS parts'],
  ['css-properties', 'CSS custom properties'],
] as const;

export type ApiSection = (typeof apiSections)[number][0];
export type ApiNotes = Partial<Record<ApiSection, TemplateResult>>;

const code = (value: string) => (value ? html`<code>${value}</code>` : html`-`);
const source = (origin: string) => (origin ? `Inherited ${origin}` : 'Velcro');

function table(section: ApiSection, heads: string[], rows: Array<{ name: string; cells: unknown[] }>) {
  if (!rows.length) return html`<p>None.</p>`;
  return html`<table data-api=${section}>
    <thead><tr>${heads.map(h => html`<th>${h}</th>`)}</tr></thead>
    <tbody>${rows.map(r => html`<tr data-name=${r.name}>${r.cells.map(c => html`<td>${c}</td>`)}</tr>`)}</tbody>
  </table>`;
}

function body(model: ApiModel, section: ApiSection) {
  switch (section) {
    case 'attributes':
      return table(section, ['Property', 'Attribute', 'Type', 'Default', 'Reflects', 'Description', 'Source'],
        model.properties.map(p => ({ name: p.name || p.attribute, cells: [code(p.name), code(p.attribute), code(p.type),
          code(p.default), p.reflects ? 'yes' : 'no', p.description, source(p.origin)] })));
    case 'methods':
      return table(section, ['Name', 'Signature', 'Description', 'Source'],
        model.methods.map(m => ({ name: m.name, cells: [code(m.name), code(m.signature), m.description, source(m.origin)] })));
    case 'events':
      return table(section, ['Name', 'Detail', 'Description', 'Source'],
        model.events.map(e => ({ name: e.name, cells: [code(e.name), code(e.type), e.description, source(e.origin)] })));
    case 'slots':
      return table(section, ['Name', 'Description', 'Source'],
        model.slots.map(s => ({ name: s.name || '(default)', cells: [s.name ? code(s.name) : '(default)', s.description, source(s.origin)] })));
    case 'parts':
      return table(section, ['Name', 'Description', 'Source'],
        model.parts.map(p => ({ name: p.name, cells: [code(p.name), p.description, source(p.origin)] })));
    case 'css-properties':
      return table(section, ['Name', 'Default', 'Description', 'Source'],
        model.cssProperties.map(p => ({ name: p.name, cells: [code(p.name), code(p.default), p.description, source(p.origin)] })));
  }
}

/**
 * The component's API reference, generated from Velcro's Custom Elements Manifest (packages/velcro/custom-elements.json),
 * including members inherited from @charm-ux/core with their origin. Notes add hand-written prose under a section.
 */
export function apiReference(tag: string, notes: ApiNotes = {}): TemplateResult {
  const model = api[tag];
  if (!model) throw new Error(`no API model for ${tag}`);
  return html`
    <p class="api-source">Generated from the Custom Elements Manifest. "Inherited" rows come from <code>@charm-ux/core</code> and are part of the element's API even where Shoelace has no counterpart; the Shoelace API comparison is in <code>docs/api-parity.md</code> in the repository.</p>
    ${apiSections.map(([id, title]) => html`
      <h2 id=${id}>${title}</h2>
      ${body(model, id)}
      ${notes[id] ?? nothing}
    `)}
  `;
}
