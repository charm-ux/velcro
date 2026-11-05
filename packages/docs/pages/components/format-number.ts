import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { shell, shellStyles } from '../../src/shell.js';
import { examples, exampleDocument } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Format Number - Velcro',
  seoHead: '<meta name="description" content="Velcro format number (prototype).">',
}));

const attributes: Array<[string, string, string, string]> = [
  ['value', 'number', '0', 'The number to format.'],
  ['type', 'currency | decimal | percent', 'decimal', 'The formatting style to use.'],
  ['no-grouping (noGrouping)', 'boolean', 'false', 'Turns off grouping separators.'],
  ['currency', 'string', 'USD', 'The ISO 4217 currency code to use when formatting.'],
  ['currency-display (currencyDisplay)', 'symbol | narrowSymbol | code | name', 'symbol', 'How to display the currency.'],
  ['minimum-integer-digits (minimumIntegerDigits)', 'number', '(unset)', 'The minimum number of integer digits to use. Possible values are 1-21.'],
  ['minimum-fraction-digits (minimumFractionDigits)', 'number', '(unset)', 'The minimum number of fraction digits to use. Possible values are 0-20.'],
  ['maximum-fraction-digits (maximumFractionDigits)', 'number', '(unset)', 'The maximum number of fraction digits to use. Possible values are 0-20.'],
  ['minimum-significant-digits (minimumSignificantDigits)', 'number', '(unset)', 'The minimum number of significant digits to use. Possible values are 1-21.'],
  ['maximum-significant-digits (maximumSignificantDigits)', 'number', '(unset)', 'The maximum number of significant digits to use. Possible values are 1-21.'],
  ['lang', 'string', 'undefined', 'The number formatting locale. Falls back to the lang of the document element, then the browser language.'],
];

const gaps = [
  'There is no core format-number: the component extends the core CharmElement base and renders text only. The text is produced by Intl.NumberFormat through a minimal localization controller (packages/velcro/src/internal/localize.ts), with the same option mapping as Shoelace 2.20.1.',
  'The localization controller has no translation registry: nothing is translated (this component needs no strings), and registerTranslation / term() do not exist. It resolves lang from the element, then the document element, then the browser language, and re-renders when the document element lang or dir changes. The dir part is resolved but nothing here uses it.',
  'The formatted output depends on the browser Intl data. It was compared with Shoelace 2.20.1 only by the option mapping and by asserted strings in Chromium, not by running Shoelace.',
  'An invalid option (for example a malformed currency code or a digit count out of range) makes Intl.NumberFormat throw a RangeError during rendering. This is not guarded, as in Shoelace; the digit ranges listed above come from Shoelace\'s documentation and are enforced only by Intl.',
  'Divergence: removing the value, type, currency or currency-display attribute restores the default here, and removing a digit attribute makes it unset again, whereas Shoelace restores only reflected properties (none of these are), so there the property would become null (which Intl reads as 0 for the digit options). Setting a property to null from script is restored the same way.',
  'The "ready" event of the core base is emitted once after the first update (non-bubbling, non-composed). Shoelace has no such event. The element has no other events, methods, slots, parts or custom properties.',
  'The Shoelace overview example with a number input (and its React variants) is not ported because sl-input is not implemented. The tests change values by script instead. The React examples are not ported.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. Scope-dependent core features are not used. Server-side rendering is not supported.',
  'Checked in Chromium only; no Firefox, WebKit, screen reader or RTL check. Both the light and dark themes exist; this component reads no theme tokens.',
];

@customElement('page-components-format-number')
export class FormatNumberPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    const source = examples['format-number/basic'];
    return shell(html`
      <h1>Format Number</h1>
      <p><code>&lt;sl-format-number&gt;</code> is registered by <code>@charm-ux/velcro</code> on the <code>@charm-ux/core</code> base element. Prototype status: unreleased.</p>
      <p>Formats a number using the specified locale and options.</p>

      <h2 id="examples">Examples</h2>
      <p>The default, percentages (<code>type="percent"</code>), localization (<code>lang</code>) and currency (<code>type="currency"</code> with <code>currency</code>).</p>
      <iframe class="example" title="Format Number example" srcdoc=${exampleDocument(source)}></iframe>
      <pre><code>${source}</code></pre>

      <h2 id="attributes">Attributes and properties</h2>
      <table>
        <thead><tr><th>Name</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          ${attributes.map(([n, t, d, desc]) => html`<tr><td><code>${n}</code></td><td>${t}</td><td><code>${d}</code></td><td>${desc}</td></tr>`)}
        </tbody>
      </table>
      <p>As in Shoelace, none of these are reflected to attributes. Divergence: removing an attribute restores the default here, whereas Shoelace only restores reflected properties, so there the property would become null.</p>

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

export default FormatNumberPage;
