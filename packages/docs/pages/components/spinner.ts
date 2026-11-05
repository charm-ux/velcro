import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Spinner - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro spinner (prototype).">',
}));

const gaps = [
  'The accessible name is the fixed English string "Loading". Shoelace localizes it through its localization controller; that is not implemented and localized output has not been compared.',
  'The element has role="progressbar" without a value (an indeterminate progress bar), as in Shoelace. Whether a given screen reader announces it was not tested.',
  'Neither Shoelace 2.20.1 nor this component reduces or stops the animation for prefers-reduced-motion; the spinner keeps animating. This is recorded as parity, not as an accessibility endorsement.',
  'The inherited core properties label and label-position, the core "spinner-*" parts and the core "--spinner-*" custom properties exist on the element but have no effect; they are not part of the Shoelace contract.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix. The package root, which registers all four components, is checked in Chromium, Firefox and WebKit against core\'s prefix, project configuration and scope maps, with core\'s own button loaded in either order. Scope-dependent core features (declared dependencies, scope-aware templates) are not supported: a Velcro component that needs them fails when it is created, even when it is the only Charm library on the page. Server-side rendering is not supported.',
  'Geometry and animation were checked by computed-style assertions in Chromium, Firefox and WebKit; there is no pixel comparison against Shoelace.',
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
      <p>A spinner shows the progress of an indeterminate operation. It is sized by <code>font-size</code> (default <code>1em</code>).</p>

      <h2 id="examples">Examples</h2>
      <iframe class="example" title="Spinner example" srcdoc=${exampleDocument(source)}></iframe>
      <pre><code>${source}</code></pre>

      ${apiReference('sl-spinner', {
        attributes: html`<p>Shoelace 2.20.1 has no public attributes or properties on the spinner; the rows above are inherited from the core spinner.</p>`,
        parts: html`<p><code>base</code> (the <code>svg</code> element, with <code>role="progressbar"</code> and <code>aria-label="Loading"</code>).</p>`,
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
