import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Format Number - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro format number (prototype).">',
}));

const gaps = [
  'There is no core format-number: the component extends the core CharmElement base and renders text only. The text is produced by Intl.NumberFormat through a minimal localization controller (packages/velcro/src/internal/localize.ts), with the same option mapping as Shoelace 2.20.1.',
  'The localization controller has no translation registry: nothing is translated (this component needs no strings), and registerTranslation / term() do not exist. It resolves lang from the element, then the document element, then the browser language, and re-renders when the document element lang or dir changes. The dir part is resolved but nothing here uses it.',
  'The formatted output depends on the browser Intl data. It was compared with Shoelace 2.20.1 only by the option mapping and by asserted strings in Chromium, Firefox and WebKit, not by running Shoelace.',
  'An invalid option (for example a malformed currency code or a digit count out of range) makes Intl.NumberFormat throw a RangeError during rendering. This is not guarded, as in Shoelace; the digit ranges listed above come from Shoelace\'s documentation and are enforced only by Intl.',
  'Divergence: removing the value, type, currency or currency-display attribute restores the default here, and removing a digit attribute makes it unset again, whereas Shoelace restores only reflected properties (none of these are), so there the property would become null (which Intl reads as 0 for the digit options). Setting a property to null from script is restored the same way.',
  'The "ready" event of the core base is emitted once after the first update (non-bubbling, non-composed). Shoelace has no such event. The element has no other events, methods, slots, parts or custom properties.',
  'The Shoelace overview example with a number input (and its React variants) is not ported because sl-input is not implemented. The tests change values by script instead. The React examples are not ported.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Scope-dependent core features are not used. Server-side rendering is not supported.',
  'Checked in Chromium, Firefox and WebKit by the product browser suite; no screen reader or RTL check. Both the light and dark themes exist; this component reads no theme tokens.',
];

@customElement('page-components-format-number')
export class FormatNumberPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    const source = examples['format-number/basic'];
    return docsShell('format-number', html`
      <h1>Format Number</h1>
      <p><code>&lt;sl-format-number&gt;</code> is registered by <code>@charm-ux/velcro</code> on the <code>@charm-ux/core</code> base element. Prototype status: unreleased.</p>
      <p>Formats a number using the specified locale and options.</p>

      <h2 id="examples">Examples</h2>
      <p>The default, percentages (<code>type="percent"</code>), localization (<code>lang</code>) and currency (<code>type="currency"</code> with <code>currency</code>).</p>
      <iframe class="example" title="Format Number example" srcdoc=${exampleDocument(source)}></iframe>
      <pre><code>${source}</code></pre>

      ${apiReference('sl-format-number', {
        attributes: html`<p>As in Shoelace, none of these are reflected to attributes. Divergence: removing an attribute restores the default here, whereas Shoelace only restores reflected properties, so there the property would become null.</p>`,
        parts: html`<p>The component renders text directly in its shadow root and has no ARIA role.</p>`,
        events: html`<p>Only the inherited <code>ready</code> event (see below); Shoelace 2.20.1 has none.</p>`,
      })}

      <h2 id="not-implemented">Not implemented or unverified</h2>
      <ul>
        ${gaps.map(g => html`<li>${g}</li>`)}
      </ul>
    `);
  }
}

export default FormatNumberPage;
