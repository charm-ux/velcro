import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { withBase } from '../../src/base.js';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Spinner - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro spinner (prototype).">',
}));

const gaps = [
  'The accessible name is the localized "loading" term, as in Shoelace: "Loading" in English, the fallback. It follows the element\'s lang, then the document\'s, and re-renders when either changes or a translation is registered.',
  'A translation is registered by importing @charm-ux/velcro/translations/<code> (Shoelace\'s 29 files, which register themselves) or by calling registerTranslation from @charm-ux/velcro/utilities/localize, as with Shoelace\'s utilities/localize. The translated text is Shoelace\'s and was not reviewed by Velcro; localized output was checked in Chromium only. See the Localization page.',
  'The element has role="progressbar" without a value (an indeterminate progress bar), as in Shoelace. Whether a given screen reader announces it was not tested.',
  'Neither Shoelace 2.20.1 nor this component reduces or stops the animation for prefers-reduced-motion; the spinner keeps animating. This is recorded as parity, not as an accessibility endorsement.',
  'The inherited core properties label and label-position exist on the element but have no effect, and the core "spinner-*" parts and "--spinner-*" custom properties are not rendered or read; they are not part of the Shoelace contract. The core spinner styles are not applied, so core\'s label-position rules cannot reach the Shoelace markup.',
  'Two additions to Shoelace\'s styles: the default indicator color falls back to #0284c7 when the --sl-color-primary-600 token is not loaded, and a forced-colors rule draws the track in GrayText and the indicator in Highlight. Shoelace 2.20.1 has neither.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. The package root, which registers all four components, is checked in Chromium against core\'s prefix, project configuration and scope maps, with core\'s own button loaded in either order. Scope-dependent core features (declared dependencies, scope-aware templates) are not supported: a Velcro component that needs them fails when it is created, even when it is the only Charm library on the page. Server-side rendering is not supported.',
  'Geometry and animation were checked by computed-style assertions in Chromium only; there is no pixel comparison against Shoelace.',
  'sl-button still draws its own internal loading indicator; it does not use sl-spinner yet.',
  'Both the light and dark themes exist; dark values are token-checked against Shoelace 2.20.1, but dark rendering of this component is not screenshot-checked.',
];

@customElement('page-components-spinner')
export class SpinnerPage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    const source = examples['spinner/basic'];
    return docsShell('spinner', html`
      <h1>Spinner</h1>
      <p><code>&lt;sl-spinner&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> spinner. Prototype status: unreleased.</p>
      <p>Its built-in text is localized; see <a href=${withBase('/localization')}>Localization</a>.</p>
      <p>A spinner shows the progress of an indeterminate operation. It is sized by <code>font-size</code> (default <code>1em</code>).</p>

      <h2 id="examples">Examples</h2>
      <iframe class="example" title="Spinner example" srcdoc=${exampleDocument(source)}></iframe>
      <pre><code>${source}</code></pre>

      ${apiReference('sl-spinner', {
        attributes: html`<p>Shoelace 2.20.1 has no public attributes or properties on the spinner besides <code>dir</code> and <code>lang</code> from its base element. <code>lang</code> is declared the same way, as a reactive property with no initial value, and selects the language of the accessible name. The other rows are inherited from the core spinner.</p>`,
        parts: html`<p><code>base</code> (the <code>svg</code> element, with <code>role="progressbar"</code> and an <code>aria-label</code> from the localized "loading" term, "Loading" in English). Inside it, as in Shoelace, the shadow DOM is <code>svg.spinner</code> around <code>circle.spinner__track</code> and <code>circle.spinner__indicator</code>; only <code>base</code> is a public part, and Shoelace's own spinner test finds the indicator by that class name.</p>`,
        events: html`<p>None from Shoelace; only the inherited core <code>ready</code> event.</p>`,
      })}

      <h2 id="not-implemented">Not implemented or unverified</h2>
      <ul>
        ${gaps.map(g => html`<li>${g}</li>`)}
      </ul>
    `);
  }
}

export default SpinnerPage;
