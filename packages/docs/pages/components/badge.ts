import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { definePageData } from '@beatzball/litro';
import { docsShell, shellStyles } from '../../src/shell.js';
import { themeHead } from '../../src/theme.js';
import { apiReference } from '../../src/api.js';
import { examples, exampleDocument } from '../../src/example.js';

export const pageData = definePageData(async () => ({
  seoTitle: 'Badge - Velcro',
  seoHead: themeHead + '<meta name="description" content="Velcro badge (prototype).">',
}));

const gaps = [
  'The base part carries role="status", as in Shoelace, so each badge is a live region. Whether a given screen reader announces content changes was not tested.',
  'Neither Shoelace 2.20.1 nor this component stops the pulse animation for prefers-reduced-motion; a pulsing badge keeps animating. This is recorded as parity, not as an accessibility endorsement.',
  'The default badge colors just miss WCAG AA text contrast (Shoelace relaxes the same check in its own tests); contrast was not evaluated here beyond that note.',
  'The core badge markup (part "badge-base", the "--badge-*" custom properties and its 20px minimum size) is replaced by the Shoelace structure. The "--badge-*" properties exist on the element through core but have no effect.',
  'Registration is browser-only and uses the native custom element registry for Velcro\'s own class, without changing the shared core prefix; the sl-badge entry and the package root (which the examples load) both register this way. The root import of all four components is checked in Chromium against core\'s prefix, project configuration and scope maps, with core\'s own button loaded in either order. Scope-dependent core features (declared dependencies, scope-aware templates) are not supported: a Velcro component that needs them fails when it is created, even when it is the only Charm library on the page. Server-side rendering is not supported. There is no class-only entry (no @charm-ux/velcro/badge/class subpath or Sl alias) for this component yet.',
  'Rendering was checked by computed-style assertions in Chromium only; there is no pixel comparison against Shoelace, and no Firefox, WebKit, RTL or localization check.',
  'Both the light and dark themes exist (dark values are token-checked against Shoelace 2.20.1; dark rendering of this component is not screenshot-checked), and the theme must be loaded: the badge reads --sl-color-*, --sl-border-radius-* and --sl-font-weight-semibold.',
];

@customElement('page-components-badge')
export class BadgePage extends LitElement {
  static override styles = [shellStyles];

  override render() {
    const source = examples['badge/basic'];
    return docsShell('badge', html`
      <h1>Badge</h1>
      <p><code>&lt;sl-badge&gt;</code> is registered by <code>@charm-ux/velcro</code> on top of the <code>@charm-ux/core</code> badge. Prototype status: unreleased.</p>
      <p>Badges are used to draw attention and display statuses or counts.</p>

      <h2 id="examples">Examples</h2>
      <iframe class="example" title="Badge example" srcdoc=${exampleDocument(source)}></iframe>
      <pre><code>${source}</code></pre>

      ${apiReference('sl-badge', {
        attributes: html`<p><code>variant</code>, <code>pill</code> and <code>pulse</code> are reflected to attributes and update the rendered badge when changed.</p>`,
        parts: html`<p><code>base</code> (the <code>span</code> element, with <code>role="status"</code>).</p>`,
        'css-properties': html`<p>Colors and radius come from the theme tokens.</p>`,
        events: html`<p>None from Shoelace; only the inherited core <code>ready</code> event.</p>`,
      })}

      <h2 id="not-implemented">Not implemented or unverified</h2>
      <ul>
        ${gaps.map(g => html`<li>${g}</li>`)}
      </ul>
    `);
  }
}

export default BadgePage;
