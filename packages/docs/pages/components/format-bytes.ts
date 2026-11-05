import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { examples, exampleDocument } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Format Bytes - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro format bytes (prototype).">',
}));

const attributes: Array<[string, string, string, string]> = [
  ['value', 'number', '0', 'The number to format in bytes.'],
  ['unit', 'byte | bit', 'byte', 'The type of unit to display.'],
  ['display', 'long | short | narrow', 'short', 'Determines how to display the result, e.g. "100 bytes", "100 b", or "100b".'],
  ['lang', 'string', '(none)', 'The number formatting locale. Falls back to the lang of the document element, then the browser language.'],
];

const gaps = [
  'There is no core format-bytes: the component extends the core CharmElement base and renders text only. The text is produced by Intl.NumberFormat with the unit style, through a minimal localization controller (packages/velcro/src/internal/localize.ts).',
  'The localization controller has no translation registry: nothing is translated (this component needs no strings), and registerTranslation / term() do not exist. It resolves lang from the element, then the document element, then the browser language, and re-renders when the document element lang or dir changes. The dir part is resolved but nothing here uses it.',
  'The formatted output depends on the browser Intl data. It was compared with Shoelace 2.20.1 only by the algorithm (the same prefix table, three significant digits and unit style) and by asserted strings in Chromium, not by running Shoelace.',
  'A negative value is not guarded: the prefix lookup yields NaN, so the component renders nothing (empty text, no exception), the same as a non-numeric value. A negative value is not formatted as a negative size. Whether Shoelace 2.20.1 behaves the same was not checked, because its formatting helper is an external package.',
  'Decimal (1000-based) prefixes are used, as in Shoelace; there are no binary (KiB) units, and petabits are not supported.',
  'The "ready" event of the core base is emitted once after the first update (non-bubbling, non-composed). Shoelace has no such event. The element has no other events, methods, slots, parts or custom properties.',
  'The Shoelace overview example with a number input is not ported because sl-input is not implemented. The example changes values by script in the tests instead.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Scope-dependent core features are not used. Server-side rendering is not supported.',
  'Checked in Chromium only; no Firefox, WebKit, screen reader or RTL check. Only the light theme exists; this component reads no theme tokens.',
];

@customElement('page-components-format-bytes')
export class FormatBytesPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    const source = examples['format-bytes/basic'];
    return docsShell('format-bytes', html`
      <h1>Format Bytes</h1>
      <p><code>&lt;sl-format-bytes&gt;</code> is registered by <code>@charm-ux/velcro</code> on the <code>@charm-ux/core</code> base element. Prototype status: unreleased.</p>
      <p>Formats a number as a human readable bytes value.</p>

      <h2 id="examples">Examples</h2>
      <iframe class="example" title="Format Bytes example" srcdoc=${exampleDocument(source)}></iframe>
      <pre><code>${source}</code></pre>

      <h2 id="attributes">Attributes and properties</h2>
      <table>
        <thead><tr><th>Name</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          ${attributes.map(([n, t, d, desc]) => html`<tr><td><code>${n}</code></td><td>${t}</td><td><code>${d}</code></td><td>${desc}</td></tr>`)}
        </tbody>
      </table>
      <p>As in Shoelace, none of these are reflected to attributes. Divergence: removing the <code>value</code>, <code>unit</code> or <code>display</code> attribute restores the default here, whereas Shoelace only restores reflected properties, so there the property would become null.</p>

      <h2 id="slots">Slots</h2>
      <p>None.</p>

      <h2 id="parts">CSS parts</h2>
      <p>None. The component renders text directly in its shadow root and has no ARIA role.</p>

      <h2 id="css-properties">CSS custom properties</h2>
      <p>None.</p>

      <h2 id="events">Events</h2>
      <p>Only the inherited <code>ready</code> event (see below); Shoelace 2.20.1 has none.</p>

      <h2 id="not-implemented">Not implemented or unverified</h2>
      <ul>
        ${gaps.map(g => html`<li>${g}</li>`)}
      </ul>
    `);
  }
}

export default FormatBytesPage;
